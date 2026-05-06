(function () {
  let supabaseClient = null;
  let currentUser = null;
  let originalSaveState = null;
  let syncing = false;

  function hasConfig() {
    return window.AK_SUPABASE_URL &&
      window.AK_SUPABASE_ANON_KEY &&
      !window.AK_SUPABASE_URL.includes("PASTE_") &&
      !window.AK_SUPABASE_ANON_KEY.includes("PASTE_");
  }

  function $(id) { return document.getElementById(id); }
  function notify(msg) { if (typeof toast === "function") toast(msg); else console.log(msg); }

  function status(text, loggedIn) {
    $("cloudStatusText").textContent = text;
    $("openCloudAuth").style.display = loggedIn ? "none" : "inline-block";
    $("cloudSyncNow").style.display = loggedIn ? "inline-block" : "none";
    $("cloudLogout").style.display = loggedIn ? "inline-block" : "none";
  }

  function initClient() {
    if (!hasConfig()) { status("Local mode · add Supabase config", false); return false; }
    supabaseClient = window.supabase.createClient(window.AK_SUPABASE_URL, window.AK_SUPABASE_ANON_KEY);
    return true;
  }

  async function pushCloudState() {
    if (!currentUser || syncing || typeof state === "undefined") return;
    syncing = true;
    try {
      const payload = JSON.parse(JSON.stringify(state));
      payload.meta = payload.meta || {};
      payload.meta.lastCloudSyncedAt = new Date().toISOString();
      const { error } = await supabaseClient.from("app_state").upsert({
        user_id: currentUser.id,
        data: payload,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      if (error) throw error;
      status("Cloud synced", true);
    } catch (e) {
      console.error(e);
      status("Cloud sync failed", true);
    } finally {
      syncing = false;
    }
  }

  async function fetchCloudState() {
    const { data, error } = await supabaseClient.from("app_state")
      .select("data").eq("user_id", currentUser.id).maybeSingle();
    if (error) throw error;
    return data ? data.data : null;
  }

  async function loadCloudIntoApp() {
    try {
      const cloud = await fetchCloudState();
      if (!cloud) { await pushCloudState(); return; }
      const localCount = Array.isArray(state?.leads) ? state.leads.length : 0;
      const cloudCount = Array.isArray(cloud?.leads) ? cloud.leads.length : 0;
      if (localCount && cloudCount) {
        const useCloud = confirm(`Cloud data found (${cloudCount} leads). Local has ${localCount}. Load cloud data?`);
        if (!useCloud) { await pushCloudState(); return; }
      }
      state = cloud;
      if (typeof saveState === "function") saveState();
      if (typeof render === "function") render();
      notify("Cloud data loaded.");
    } catch (e) {
      console.error(e);
      notify("Could not load cloud data.");
    }
  }

  async function refreshAuth() {
    const { data } = await supabaseClient.auth.getSession();
    currentUser = data.session ? data.session.user : null;
    if (currentUser) {
      status("Cloud connected", true);
      await loadCloudIntoApp();
    } else {
      status("Local mode", false);
    }
  }

  async function login() {
    const email = $("cloudEmail").value.trim();
    const password = $("cloudPassword").value;
    if (!email || !password) return notify("Enter email and password.");
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return notify(error.message);
    $("cloudAuthModal").style.display = "none";
    await refreshAuth();
  }

  async function signup() {
    const email = $("cloudEmail").value.trim();
    const password = $("cloudPassword").value;
    if (!email || !password) return notify("Enter email and password.");
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) return notify(error.message);
    $("cloudAuthModal").style.display = "none";
    notify("Account created. Check email if confirmation is enabled.");
    await refreshAuth();
  }

  async function logout() {
    await pushCloudState();
    await supabaseClient.auth.signOut();
    currentUser = null;
    status("Local mode", false);
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

  window.addEventListener("load", async () => {
    $("openCloudAuth").onclick = () => $("cloudAuthModal").style.display = "flex";
    $("closeCloudAuth").onclick = () => $("cloudAuthModal").style.display = "none";
    $("cloudLogin").onclick = login;
    $("cloudSignup").onclick = signup;
    $("cloudSyncNow").onclick = async () => { await pushCloudState(); notify("Synced now."); };
    $("cloudLogout").onclick = logout;

    patchSaveState();
    if (!initClient()) return;
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentUser = session ? session.user : null;
      status(currentUser ? "Cloud connected" : "Local mode", !!currentUser);
    });
    await refreshAuth();
    setInterval(pushCloudState, 15000);
  });
})();
