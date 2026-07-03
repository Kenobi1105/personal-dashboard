import { fetchText, json, optionsResponse, stripTags } from "../_shared/dashboard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  const passage = (new URL(req.url).searchParams.get("passage") || "").trim();
  if (!passage) return json({ error: "Bible passage is required" }, 400);
  const url = "https://labs.bible.org/api/?passage=" + encodeURIComponent(passage) + "&type=json&formatting=plain";
  const raw = await fetchText(url);
  const data = JSON.parse(raw);
  const text = Array.isArray(data) ? data.map((item) => stripTags(item.text || "")).join(" ").replace(/\s+/g, " ").trim() : stripTags(raw);
  return json({ translation: "NET", passage, text, source: "NET Bible API" });
});
