import { fetchText, json, optionsResponse } from "../_shared/dashboard.ts";

function parseYouTube(xml: string) {
  return (xml.match(/<entry[\s\S]*?<\/entry>/gi) || []).slice(0, 7).map((block, index) => {
    const title = (block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    const videoId = block.match(/<yt:videoId>(.*?)<\/yt:videoId>/i)?.[1] || "";
    const published = block.match(/<published>(.*?)<\/published>/i)?.[1] || "";
    const thumb = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1] || "";
    return { id: videoId || String(index), title, videoId, url: "https://www.youtube.com/watch?v=" + videoId, embedUrl: "https://www.youtube.com/embed/" + videoId, thumbnail: thumb, publishedAt: published };
  }).filter((item) => item.videoId);
}

async function feed(source: string, channelId: string) {
  try {
    const xml = await fetchText("https://www.youtube.com/feeds/videos.xml?channel_id=" + encodeURIComponent(channelId));
    return { source, items: parseYouTube(xml) };
  } catch (error) {
    return { source, items: [], error: error instanceof Error ? error.message : String(error) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  const [greek, hebrew, septuagint] = await Promise.all([
    feed("Daily Dose of Greek", "UC0fRqEfY1ZaiWiJWTj7HQng"),
    feed("Daily Dose of Hebrew", "UCRSbS2XhqOhnSUzWfGHUkLg"),
    feed("Daily Dose of Septuagint", "UC5SB4egyj9-RNdjL-VxcDRw"),
  ]);
  return json({
    vocabulary: {
      greek: { word: "logos", original: "λόγος", gloss: "word, message, reason", form: "Noun, masculine", example: "John 1:1", source: "MorphGNT / SBLGNT curated cache" },
      hebrew: { word: "berit", original: "בְּרִית", gloss: "covenant", form: "Noun, feminine", example: "Genesis 17:7", source: "Open Scriptures Hebrew Bible curated cache" },
    },
    videos: { greek, hebrew, septuagint },
  });
});
