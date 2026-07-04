export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function optionsResponse() {
  return new Response("ok", { headers: corsHeaders });
}

export function decodeEntities(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, num) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function stripTags(value = "") {
  return decodeEntities(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[char] || char));
}

export function absoluteUrl(url = "", base = "") {
  if (!url) return "";
  try {
    return new URL(decodeEntities(url), base).toString();
  } catch {
    return decodeEntities(url);
  }
}

function tag(block: string, name: string) {
  const match = block.match(new RegExp("<" + name + "[^>]*>([\\s\\S]*?)<\\/" + name + ">", "i"));
  return match ? decodeEntities(match[1]).trim() : "";
}

function attr(block: string, tagName: string, attrName: string) {
  const re = new RegExp("<" + tagName + "[^>]*\\s" + attrName + "=[\"']([^\"']+)[\"'][^>]*>", "i");
  const match = block.match(re);
  return match ? decodeEntities(match[1]).trim() : "";
}

export function metaTag(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp("<meta[^>]+(?:property|name)=[\"']" + escaped + "[\"'][^>]+content=[\"']([^\"']+)[\"'][^>]*>", "i"),
    new RegExp("<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name)=[\"']" + escaped + "[\"'][^>]*>", "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeEntities(match[1]).trim();
  }
  return "";
}

export function extractArticleImage(html: string, pageUrl: string) {
  const metaImage = metaTag(html, "og:image") || metaTag(html, "twitter:image") || metaTag(html, "image");
  if (metaImage) return absoluteUrl(metaImage, pageUrl);

  const jsonLdBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const block of jsonLdBlocks) {
    const text = block.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();
    try {
      const parsed = JSON.parse(text);
      const queue = Array.isArray(parsed) ? parsed.slice() : [parsed];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== "object") continue;
        if (Array.isArray(item)) {
          queue.push(...item);
          continue;
        }
        const image = item.image || item.thumbnailUrl;
        if (typeof image === "string") return absoluteUrl(image, pageUrl);
        if (Array.isArray(image) && image[0]) return absoluteUrl(typeof image[0] === "string" ? image[0] : image[0].url || "", pageUrl);
        if (image && typeof image === "object" && image.url) return absoluteUrl(image.url, pageUrl);
        Object.keys(item).forEach((key) => {
          if (item[key] && typeof item[key] === "object") queue.push(item[key]);
        });
      }
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  }

  const imgMatches = Array.from(html.matchAll(/<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["'][^>]*>/gi));
  const found = imgMatches
    .map((match) => decodeEntities(match[1]))
    .find((src) => /^https?:\/\//i.test(src) || /^\//.test(src));
  return found ? absoluteUrl(found, pageUrl) : "";
}

export async function enrichItemMedia(item: any) {
  if (!item || item.image || !/^https?:\/\//i.test(item.url || "")) return item;
  try {
    const html = await fetchText(item.url, 7000);
    item.image = extractArticleImage(html, item.url);
  } catch {
    item.image = item.image || "";
  }
  return item;
}

export async function fetchText(url: string, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "MinistryDashboard/1.0" },
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export function parseFeed(xml: string, feed: { source: string; url: string; priority?: number }) {
  const items: any[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  blocks.slice(0, 20).forEach((block, index) => {
    const title = stripTags(tag(block, "title"));
    const link = tag(block, "link") || attr(block, "link", "href") || tag(block, "guid");
    const rawContent = tag(block, "content:encoded") || tag(block, "content") || tag(block, "description") || tag(block, "summary");
    const description = stripTags(tag(block, "description") || tag(block, "summary") || tag(block, "content:encoded"));
    const published = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated");
    let image = attr(block, "media:content", "url") || attr(block, "media:thumbnail", "url") || attr(block, "enclosure", "url");
    const enclosureType = attr(block, "enclosure", "type") || attr(block, "media:content", "type");
    let video = "";
    if (/video/i.test(enclosureType || "")) {
      video = image;
      image = "";
    }
    if (!image) {
      const img = block.match(/<img[^>]+src=["']([^"']+)["']/i);
      image = img ? decodeEntities(img[1]) : "";
    }
    if (!title || !link) return;
    items.push({
      id: feed.source.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + index,
      title,
      url: absoluteUrl(link, feed.url),
      summary: description,
      contentHtml: rawContent,
      image: absoluteUrl(image, feed.url),
      video: absoluteUrl(video, feed.url),
      isVideo: !!video || /\/video\/|video/i.test(link + " " + title),
      source: feed.source,
      feedUrl: feed.url,
      publishedAt: published,
      publishedTime: Date.parse(published) || 0,
      sourcePriority: feed.priority || index + 1,
      feedOrder: index,
    });
  });
  return items;
}

export function compareNews(a: any, b: any) {
  if ((b.publishedTime || 0) !== (a.publishedTime || 0)) return (b.publishedTime || 0) - (a.publishedTime || 0);
  if ((a.sourcePriority || 999) !== (b.sourcePriority || 999)) return (a.sourcePriority || 999) - (b.sourcePriority || 999);
  return (a.feedOrder || 0) - (b.feedOrder || 0);
}

export function uniqueItems(items: any[]) {
  const seen: Record<string, boolean> = {};
  return items.filter((item) => {
    const key = String(item.url || item.title || "").replace(/[?#].*$/, "").toLowerCase();
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

export function supabaseEnv() {
  const url = Deno.env.get("SUPABASE_URL") || "https://txowrviwvulkuopmugfb.supabase.co";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || "";
  return { url, anonKey, serviceRoleKey };
}

export async function getAuthUser(req: Request) {
  const { url, anonKey } = supabaseEnv();
  const auth = req.headers.get("Authorization") || "";
  if (!auth) return null;
  const response = await fetch(url + "/auth/v1/user", {
    headers: { Authorization: auth, apikey: anonKey },
  });
  if (!response.ok) return null;
  return await response.json();
}

export async function serviceRequest(path: string, init: RequestInit = {}) {
  const { url, serviceRoleKey } = supabaseEnv();
  if (!serviceRoleKey) throw new Error("SERVICE_ROLE_KEY is not set");
  const headers = new Headers(init.headers || {});
  headers.set("apikey", serviceRoleKey);
  headers.set("Authorization", "Bearer " + serviceRoleKey);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  return await fetch(url + path, { ...init, headers });
}
