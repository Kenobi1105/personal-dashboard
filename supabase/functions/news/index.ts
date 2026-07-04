import { compareNews, enrichItemMedia, fetchText, json, optionsResponse, parseFeed, uniqueItems } from "../_shared/dashboard.ts";

const FEEDS: Record<string, Array<{ source: string; url: string; priority: number }>> = {
  world: [
    { source: "Reuters", url: "https://www.reutersagency.com/feed/?best-topics=world&post_type=best", priority: 1 },
    { source: "CNN", url: "http://rss.cnn.com/rss/edition_world.rss", priority: 2 },
    { source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", priority: 3 },
    { source: "BBC", url: "https://feeds.bbci.co.uk/news/world/rss.xml", priority: 4 },
    { source: "The Guardian", url: "https://www.theguardian.com/world/rss", priority: 5 },
    { source: "France 24", url: "https://www.france24.com/en/rss", priority: 6 },
    { source: "Deutsche Welle", url: "https://rss.dw.com/rdf/rss-en-world", priority: 7 },
    { source: "NPR", url: "https://feeds.npr.org/1004/rss.xml", priority: 8 },
  ],
  philippines: [
    { source: "Rappler", url: "https://www.rappler.com/feed/", priority: 1 },
    { source: "Inquirer.net", url: "https://newsinfo.inquirer.net/feed", priority: 2 },
    { source: "GMA News Online", url: "https://www.gmanetwork.com/news/rss/news/", priority: 3 },
    { source: "ABS-CBN News", url: "https://news.abs-cbn.com/rss/news", priority: 4 },
    { source: "Philstar", url: "https://www.philstar.com/rss/headlines", priority: 5 },
    { source: "Manila Bulletin", url: "https://mb.com.ph/rss", priority: 6 },
  ],
  theology: [
    { source: "Open Doors", url: "https://www.opendoors.org/en-US/news/latest/rss/", priority: 1 },
    { source: "The Gospel Coalition", url: "https://www.thegospelcoalition.org/feed/", priority: 2 },
    { source: "Christianity Today", url: "https://www.christianitytoday.com/rss.xml", priority: 3 },
    { source: "Desiring God", url: "https://www.desiringgod.org/articles.atom", priority: 4 },
    { source: "Baptist Press", url: "https://www.baptistpress.com/feed/", priority: 5 },
    { source: "Religion News Service", url: "https://religionnews.com/feed/", priority: 6 },
  ],
};

function selectedFeeds(url: URL, section: string) {
  const selected = (url.searchParams.get(section + "Sources") || "").split("|").filter(Boolean);
  let custom: Record<string, Array<{ source: string; url: string; priority: number }>> = {};
  try {
    custom = JSON.parse(url.searchParams.get("customSources") || "{}");
  } catch {
    custom = {};
  }
  const feeds = FEEDS[section].concat((custom[section] || []).map((feed, index) => ({
    source: String(feed.source || "").slice(0, 80),
    url: String(feed.url || ""),
    priority: 50 + index,
  })).filter((feed) => feed.source && /^https?:\/\//i.test(feed.url)));
  if (!selected.length) return feeds.slice(0, 10);
  const byName = Object.fromEntries(feeds.map((feed) => [feed.source, feed]));
  return selected.map((name) => byName[name]).filter(Boolean).slice(0, 10);
}

async function sectionNews(url: URL, section: string) {
  const feeds = selectedFeeds(url, section);
  const settled = await Promise.allSettled(feeds.map(async (feed) => parseFeed(await fetchText(feed.url), feed)));
  const errors: any[] = [];
  let items: any[] = [];
  settled.forEach((entry, index) => {
    if (entry.status === "fulfilled") items = items.concat(entry.value);
    else errors.push({ section, source: feeds[index].source, message: entry.reason?.message || "Feed failed" });
  });
  items = balanceSources(uniqueItems(items).sort(compareNews), 12);
  const enriched = await Promise.all(items.slice(0, 8).map(enrichItemMedia));
  return { items: enriched.concat(items.slice(8)), errors };
}

function balanceSources(items: any[], limit: number) {
  const firstPass: any[] = [];
  const used: Record<string, boolean> = {};
  for (const item of items) {
    const source = String(item.source || "unknown").toLowerCase();
    if (used[source]) continue;
    firstPass.push(item);
    used[source] = true;
    if (firstPass.length >= limit) return firstPass;
  }
  const seen = new Set(firstPass.map((item) => item.url || item.title));
  for (const item of items) {
    const key = item.url || item.title;
    if (seen.has(key)) continue;
    firstPass.push(item);
    seen.add(key);
    if (firstPass.length >= limit) break;
  }
  return firstPass;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  const url = new URL(req.url);
  const result: any = { world: [], philippines: [], theology: [], top: {}, generatedAt: new Date().toISOString(), errors: [] };
  for (const section of ["world", "philippines", "theology"]) {
    const data = await sectionNews(url, section);
    result[section] = data.items;
    result.errors.push(...data.errors);
    result.top[section] = data.items[0] || null;
  }
  return json(result);
});
