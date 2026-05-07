/* AK Reliance Outreach Dashboard - Hardened Cloud Sync Layer */
(function () {
  let supabaseClient = null;
  let currentUser = null;
  let originalSaveState = null;
  let syncing = false;
  let initialized = false;

  function $(id) { return document.getElementById(id); }

  function ensureStatusBox() {
    let box = $("cloudAuthStatus");
    if (!box) {
      const modal = $("cloudAuthModal")?.querySelector(".modal");
      if (modal) {
        box = document.createElement("div");
        box.id = "cloudAuthStatus";
        box.className = "small-note";
        box.style.marginTop = "12px";
        box.style.padding = "10px 12px";
        box.style.borderRadius = "14px";
        box.style.border = "1px solid rgba(167,139,250,.28)";
        box.style.background = "rgba(15,23,42,.55)";
        modal.appendChild(box);
      }
    }
    return box;
  }

  function authStatus(msg) {
    const box = ensureStatusBox();
    if (box) box.textContent = msg;
    console.log("[Cloud Auth]", msg);
  }

  function notify(msg) {
    authStatus(msg);
    if (typeof toast === "function") toast(msg);
    else console.log(msg);
  }

  function hasConfig() {
    return !!(
      window.AK_SUPABASE_URL &&
      window.AK_SUPABASE_ANON_KEY &&
      !String(window.AK_SUPABASE_URL).includes("PASTE_") &&
      !String(window.AK_SUPABASE_ANON_KEY).includes("PASTE_")
    );
  }

  function authReady() {
    return !!(supabaseClient && supabaseClient.auth && typeof supabaseClient.auth.getSession === "function");
  }

  function setCloudStatus(text, loggedIn) {
    const label = $("cloudStatusText");
    const profile = $("profileCloudStatus");
    const login = $("openCloudAuth");
    const sync = $("cloudSyncNow");
    const logout = $("cloudLogout");
    const pLogin = $("profileCloudLogin");
    const pSync = $("profileSyncNow");
    const pLogout = $("profileLogout");

    if (label) label.textContent = text;
    if (profile) profile.textContent = text;

    if (login) login.style.display = loggedIn ? "none" : "inline-block";
    if (sync) sync.style.display = loggedIn ? "inline-block" : "none";
    if (logout) logout.style.display = loggedIn ? "inline-block" : "none";

    if (pLogin) pLogin.style.display = loggedIn ? "none" : "inline-block";
    if (pSync) pSync.style.display = loggedIn ? "inline-block" : "inline-block";
    if (pLogout) pLogout.style.display = loggedIn ? "inline-block" : "none";
  }

  function initClient() {
    if (!hasConfig()) {
      setCloudStatus("Local mode · add Supabase config", false);
      authStatus("Supabase config is missing. Check config.js.");
      return false;
    }

    const lib = window.supabase;
    if (!lib || typeof lib.createClient !== "function") {
      setCloudStatus("Supabase library missing", false);
      authStatus("Supabase library did not load. Check internet/CDN/ad blocker.");
      return false;
    }

    try {
      supabaseClient = lib.createClient(window.AK_SUPABASE_URL, window.AK_SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "ak-reliance-outreach-os-auth"
        }
      });
    } catch (e) {
      supabaseClient = null;
      setCloudStatus("Supabase init failed", false);
      authStatus("Supabase client could not start: " + (e.message || "Unknown error"));
      return false;
    }

    if (!authReady()) {
      setCloudStatus("Supabase auth unavailable", false);
      authStatus("Supabase loaded, but auth is unavailable. Refresh or check the CDN script.");
      return false;
    }

    initialized = true;
    authStatus("Supabase connected. You can log in or create account.");
    return true;
  }

  function getAppState() {
    try { return state; } catch (e) { return window.state; }
  }

  async function pushCloudState() {
    const appState = getAppState();
    if (!authReady()) return authStatus("Cloud sync skipped: Supabase auth is not ready.");
    if (!currentUser || syncing || !appState) return;

    syncing = true;
    try {
      const payload = JSON.parse(JSON.stringify(appState));
      payload.meta = payload.meta || {};
      payload.meta.lastCloudSyncedAt = new Date().toISOString();

      const { error } = await supabaseClient.from("app_state").upsert({
        user_id: currentUser.id,
        data: payload,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

      if (error) throw error;
      setCloudStatus("Cloud synced", true);
      authStatus("Cloud synced successfully.");
    } catch (e) {
      console.error(e);
      setCloudStatus("Cloud sync failed", true);
      authStatus("Cloud sync failed: " + (e.message || "Unknown error"));
    } finally {
      syncing = false;
    }
  }

  async function fetchCloudState() {
    if (!authReady()) throw new Error("Supabase auth is not ready.");
    if (!currentUser) throw new Error("Not logged in.");

    const { data, error } = await supabaseClient.from("app_state")
      .select("data")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error) throw error;
    return data ? data.data : null;
  }

  async function loadCloudIntoApp() {
    try {
      const cloud = await fetchCloudState();
      if (!cloud) { await pushCloudState(); return; }

      const appState = getAppState();
      const localCount = Array.isArray(appState?.leads) ? appState.leads.length : 0;
      const cloudCount = Array.isArray(cloud?.leads) ? cloud.leads.length : 0;

      if (localCount && cloudCount) {
        const useCloud = confirm(`Cloud data found (${cloudCount} leads). Local has ${localCount}. Load cloud data?`);
        if (!useCloud) { await pushCloudState(); return; }
      }

      try { state = cloud; } catch (e) { window.state = cloud; }
      if (typeof saveState === "function") saveState();
      if (typeof render === "function") render();
      if (typeof renderChannelConv === "function") renderChannelConv();
      notify("Cloud data loaded.");
    } catch (e) {
      console.error(e);
      notify("Could not load cloud data: " + (e.message || "Unknown error"));
    }
  }

  async function refreshAuth() {
    if (!initialized && !initClient()) return;
    if (!authReady()) return notify("Supabase auth is not ready. Refresh the page and try again.");

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) return notify("Session check failed: " + error.message);

    currentUser = data.session ? data.session.user : null;

    if (currentUser) {
      setCloudStatus("Cloud connected", true);
      authStatus("Logged in as " + currentUser.email);
      await loadCloudIntoApp();
    } else {
      setCloudStatus("Local mode", false);
      authStatus("Not logged in yet.");
    }
  }

  function openModal() {
    const modal = $("cloudAuthModal");
    if (!modal) return notify("Cloud login modal is missing in index.html.");
    modal.style.display = "flex";
    modal.style.zIndex = "100000";
    modal.classList.add("show");
    ensureStatusBox();
    if (!initialized) initClient();
    authStatus(authReady() ? "Cloud login ready." : "Supabase not connected. Check config.js and Supabase CDN.");
    setTimeout(() => $("cloudEmail")?.focus(), 50);
  }

  function closeModal() {
    const modal = $("cloudAuthModal");
    if (!modal) return;
    modal.style.display = "none";
    modal.classList.remove("show");
  }

  async function login() {
    if (!initialized && !initClient()) return;
    if (!authReady()) return notify("Supabase auth is not ready. Refresh the page and try again.");

    const email = $("cloudEmail")?.value.trim();
    const password = $("cloudPassword")?.value;
    if (!email || !password) return notify("Enter email and password.");

    authStatus("Logging in...");
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return notify("Login failed: " + error.message);

    currentUser = data.user;
    closeModal();
    setCloudStatus("Cloud connected", true);
    notify("Logged in successfully.");
    await loadCloudIntoApp();
  }

  async function signup() {
    if (!initialized && !initClient()) return;
    if (!authReady()) return notify("Supabase auth is not ready. Refresh the page and try again.");

    const email = $("cloudEmail")?.value.trim();
    const password = $("cloudPassword")?.value;
    if (!email || !password) return notify("Enter email and password.");
    if (password.length < 6) return notify("Password must be at least 6 characters.");

    authStatus("Creating account...");
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) return notify("Signup failed: " + error.message);

    if (!data.session) {
      authStatus("Account created. If email confirmation is ON, check your email, then come back and click Log In.");
      if (typeof toast === "function") toast("Account created. Check email, then log in.");
      return;
    }

    currentUser = data.user;
    closeModal();
    setCloudStatus("Cloud connected", true);
    notify("Account created and logged in.");
    await loadCloudIntoApp();
  }

  async function logout() {
    if (!authReady()) return;
    await pushCloudState();
    await supabaseClient.auth.signOut();
    currentUser = null;
    setCloudStatus("Local mode", false);
    notify("Logged out.");
  }

  function patchSaveState() {
    if (typeof saveState !== "function" || originalSaveState) return;
    originalSaveState = saveState;
    saveState = function () {
      originalSaveState();
      if (currentUser) {
        clearTimeout(window.__cloudDebounce);
        window.__cloudDebounce = setTimeout(pushCloudState, 900);
      }
    };
  }

  function wireUI() {
    const bind = (id, fn) => {
      const el = $(id);
      if (!el) return;
      el.onclick = function (e) { e.preventDefault(); e.stopPropagation(); fn(); };
    };

    bind("openCloudAuth", openModal);
    bind("profileCloudLogin", openModal);
    bind("closeCloudAuth", closeModal);
    bind("cloudLogin", login);
    bind("cloudSignup", signup);
    bind("cloudSyncNow", async () => { await pushCloudState(); notify("Synced now."); });
    bind("profileSyncNow", async () => { await pushCloudState(); notify("Synced now."); });
    bind("cloudLogout", logout);
    bind("profileLogout", logout);
  }

  async function boot() {
    wireUI();
    patchSaveState();
    if (!initClient()) return;

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentUser = session ? session.user : null;
      setCloudStatus(currentUser ? "Cloud connected" : "Local mode", !!currentUser);
    });

    await refreshAuth();
    setInterval(pushCloudState, 15000);
  }

  window.AKCloudSync = {
    open: openModal,
    close: closeModal,
    refresh: refreshAuth,
    syncNow: pushCloudState,
    logout,
    getClient: () => supabaseClient
  };

  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
