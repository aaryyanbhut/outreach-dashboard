import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const payload = await req.json().catch(() => null);

  // Tier 3 placeholder:
  // Verify provider webhook signature, parse email reply/open/click,
  // match to lead, then update database/app_state.

  return new Response(JSON.stringify({ ok: true, received: !!payload }), {
    headers: { "content-type": "application/json" }
  });
});
