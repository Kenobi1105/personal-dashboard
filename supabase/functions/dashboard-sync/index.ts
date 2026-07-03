import { getAuthUser, json, optionsResponse, serviceRequest } from "../_shared/dashboard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  const user = await getAuthUser(req);
  if (!user || !user.id) return json({ error: "Sign in required" }, 401);

  if (req.method === "GET") {
    const response = await serviceRequest("/rest/v1/dashboard_state?user_id=eq." + encodeURIComponent(user.id) + "&select=state,updated_at&limit=1");
    if (!response.ok) return json({ error: await response.text() }, response.status);
    const rows = await response.json();
    return json(rows[0] || { state: null });
  }

  if (req.method === "PUT" || req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const payload = {
      user_id: user.id,
      state: body.state || {},
      updated_at: new Date().toISOString(),
    };
    const response = await serviceRequest("/rest/v1/dashboard_state?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return json({ error: await response.text() }, response.status);
    const rows = await response.json();
    return json({ ok: true, state: rows[0]?.state || payload.state });
  }

  return json({ error: "Method not allowed" }, 405);
});

