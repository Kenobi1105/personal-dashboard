import { compareNews, fetchText, json, optionsResponse, parseFeed, uniqueItems } from "../_shared/dashboard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return json({ items: [], errors: [] }, 405);
  const body = await req.json().catch(() => ({}));
  const feeds = (body.feeds || []).filter((feed: any) => /^https?:\/\//i.test(feed.url || "")).slice(0, 10).map((feed: any, index: number) => ({
    source: String(feed.name || feed.url || "RSS Feed").slice(0, 80),
    url: String(feed.url),
    priority: index + 1,
  }));
  const settled = await Promise.allSettled(feeds.map(async (feed: any) => parseFeed(await fetchText(feed.url), feed)));
  const payload: any = { items: [], errors: [], generatedAt: new Date().toISOString() };
  settled.forEach((entry, index) => {
    if (entry.status === "fulfilled") payload.items = payload.items.concat(entry.value);
    else payload.errors.push({ source: feeds[index].source, message: entry.reason?.message || "Feed failed" });
  });
  payload.items = uniqueItems(payload.items).sort(compareNews).slice(0, 120);
  return json(payload);
});

