import { absoluteUrl, fetchText, json, optionsResponse, parseFeed, stripTags } from "../_shared/dashboard.ts";

const VOCABULARY = {
  greek: [
    { original: "\u03bb\u03cc\u03b3\u03bf\u03c2", transliteration: "logos", gloss: "word, message, reason", parsing: "Noun, masculine", example: "John 1:1" },
    { original: "\u03c7\u03ac\u03c1\u03b9\u03c2", transliteration: "charis", gloss: "grace, favor", parsing: "Noun, feminine", example: "Ephesians 2:8" },
    { original: "\u03c0\u03af\u03c3\u03c4\u03b9\u03c2", transliteration: "pistis", gloss: "faith, faithfulness", parsing: "Noun, feminine", example: "Romans 3:22" },
    { original: "\u1f00\u03b3\u03ac\u03c0\u03b7", transliteration: "agape", gloss: "love", parsing: "Noun, feminine", example: "1 Corinthians 13:13" },
    { original: "\u1f10\u03ba\u03ba\u03bb\u03b7\u03c3\u03af\u03b1", transliteration: "ekklesia", gloss: "assembly, church", parsing: "Noun, feminine", example: "Matthew 16:18" },
    { original: "\u03bc\u03b1\u03b8\u03b7\u03c4\u03ae\u03c2", transliteration: "mathetes", gloss: "disciple, learner", parsing: "Noun, masculine", example: "Matthew 28:19" },
    { original: "\u03b2\u03b1\u03c3\u03b9\u03bb\u03b5\u03af\u03b1", transliteration: "basileia", gloss: "kingdom, reign", parsing: "Noun, feminine", example: "Mark 1:15" },
    { original: "\u03b4\u03b9\u03ba\u03b1\u03b9\u03bf\u03c3\u03cd\u03bd\u03b7", transliteration: "dikaiosyne", gloss: "righteousness, justice", parsing: "Noun, feminine", example: "Romans 1:17" },
    { original: "\u03b5\u1f30\u03c1\u03ae\u03bd\u03b7", transliteration: "eirene", gloss: "peace", parsing: "Noun, feminine", example: "John 14:27" },
    { original: "\u03ba\u03cd\u03c1\u03b9\u03bf\u03c2", transliteration: "kyrios", gloss: "Lord, master", parsing: "Noun, masculine", example: "Romans 10:9" },
  ],
  hebrew: [
    { original: "\u05d1\u05bc\u05b0\u05e8\u05b4\u05d9\u05ea", transliteration: "berit", gloss: "covenant", parsing: "Noun, feminine", example: "Genesis 17:7" },
    { original: "\u05d7\u05b6\u05e1\u05b6\u05d3", transliteration: "hesed", gloss: "steadfast love, covenant loyalty", parsing: "Noun, masculine", example: "Psalm 136:1" },
    { original: "\u05e9\u05c1\u05b8\u05dc\u05d5\u05b9\u05dd", transliteration: "shalom", gloss: "peace, wholeness", parsing: "Noun, masculine", example: "Numbers 6:26" },
    { original: "\u05e8\u05d5\u05bc\u05d7\u05b7", transliteration: "ruach", gloss: "spirit, wind, breath", parsing: "Noun, common gender", example: "Genesis 1:2" },
    { original: "\u05ea\u05bc\u05d5\u05b9\u05e8\u05b8\u05d4", transliteration: "torah", gloss: "instruction, law", parsing: "Noun, feminine", example: "Psalm 1:2" },
    { original: "\u05de\u05b6\u05dc\u05b6\u05da\u05b0", transliteration: "melek", gloss: "king", parsing: "Noun, masculine", example: "1 Samuel 8:5" },
    { original: "\u05e7\u05b8\u05d3\u05d5\u05b9\u05e9\u05c1", transliteration: "qadosh", gloss: "holy, set apart", parsing: "Adjective", example: "Isaiah 6:3" },
    { original: "\u05d0\u05b1\u05de\u05d5\u05bc\u05e0\u05b8\u05d4", transliteration: "emunah", gloss: "faithfulness, firmness", parsing: "Noun, feminine", example: "Habakkuk 2:4" },
    { original: "\u05d7\u05b8\u05db\u05b0\u05de\u05b8\u05d4", transliteration: "chokmah", gloss: "wisdom", parsing: "Noun, feminine", example: "Proverbs 1:7" },
    { original: "\u05de\u05b4\u05e9\u05b0\u05c1\u05e4\u05b8\u05bc\u05d8", transliteration: "mishpat", gloss: "justice, judgment", parsing: "Noun, masculine", example: "Micah 6:8" },
  ],
};

function manilaDayNumber() {
  return Math.floor((Date.now() + 8 * 60 * 60 * 1000) / 86400000);
}

function dailyVocabulary() {
  const day = manilaDayNumber();
  return {
    greek: { ...VOCABULARY.greek[day % VOCABULARY.greek.length], source: "MorphGNT / SBLGNT curated cache" },
    hebrew: { ...VOCABULARY.hebrew[day % VOCABULARY.hebrew.length], source: "Open Scriptures Hebrew Bible curated cache" },
  };
}

function cleanTitle(value = "") {
  return value.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").trim();
}

function youtubeImage(videoId: string, thumb = "") {
  return thumb || (videoId ? "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg" : "");
}

function youtubeVideoIdFromUrl(url = "") {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{6,})/,
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /\/shorts\/([a-zA-Z0-9_-]{6,})/,
    /\/embed\/([a-zA-Z0-9_-]{6,})/,
  ];
  for (const pattern of patterns) {
    const match = String(url).match(pattern);
    if (match) return match[1];
  }
  return "";
}

function parseYouTube(xml: string) {
  return (xml.match(/<entry[\s\S]*?<\/entry>/gi) || []).slice(0, 7).map((block, index) => {
    const title = stripTags(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    const link = block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] || "";
    const videoId = block.match(/<yt:videoId>(.*?)<\/yt:videoId>/i)?.[1] || youtubeVideoIdFromUrl(link);
    const published = block.match(/<published>(.*?)<\/published>/i)?.[1] || "";
    const thumb = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1] || "";
    const image = youtubeImage(videoId, thumb);
    return {
      id: videoId || String(index),
      title,
      videoId,
      url: videoId ? "https://www.youtube.com/watch?v=" + videoId : absoluteUrl(link, "https://www.youtube.com/"),
      embedUrl: videoId ? "https://www.youtube.com/embed/" + videoId : "",
      thumbnail: image,
      image,
      publishedAt: published,
      publishedTime: Date.parse(published) || 0,
    };
  }).filter((item) => item.videoId);
}

async function resolveYouTubeChannelId(handle: string) {
  const html = await fetchText("https://www.youtube.com/@" + handle, 9000);
  const patterns = [
    /"channelId"\s*:\s*"([^"]+)"/,
    /"externalId"\s*:\s*"([^"]+)"/,
    /\/channel\/(UC[a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  throw new Error("Could not resolve YouTube channel for " + handle);
}

function extractEmbeddedVideoId(html: string) {
  return youtubeVideoIdFromUrl(html.match(/(?:src|href)=["']([^"']*(?:youtube\.com|youtu\.be)[^"']*)["']/i)?.[1] || "");
}

async function siteFeedFallback(config: LanguageFeedConfig) {
  if (!config.feedUrl) return [];
  const xml = await fetchText(config.feedUrl, 9000);
  const items = parseFeed(xml, { source: config.source, url: config.feedUrl }).slice(0, 7);
  const enriched = await Promise.all(items.map(async (item, index) => {
    let videoId = youtubeVideoIdFromUrl(item.url || "");
    if (!videoId && item.url) {
      try {
        videoId = extractEmbeddedVideoId(await fetchText(item.url, 7000));
      } catch {
        videoId = "";
      }
    }
    const image = item.image || youtubeImage(videoId);
    return {
      id: videoId || config.source.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + index,
      title: item.title || "Latest lesson",
      videoId,
      url: videoId ? "https://www.youtube.com/watch?v=" + videoId : item.url || config.url,
      embedUrl: videoId ? "https://www.youtube.com/embed/" + videoId : "",
      thumbnail: image,
      image,
      publishedAt: item.publishedAt || "",
      publishedTime: item.publishedTime || 0,
    };
  }));
  return enriched.filter((item) => item.title);
}

type LanguageFeedConfig = {
  source: string;
  channelId: string;
  handle: string;
  url: string;
  feedUrl: string;
};

const VIDEO_FEEDS: Record<string, LanguageFeedConfig> = {
  greek: {
    source: "Daily Dose of Greek",
    channelId: "UC0fRqEfY1ZaiWiJWTj7HQng",
    handle: "DailyDoseOfGreek",
    url: "https://dailydoseofgreek.com/",
    feedUrl: "https://dailydoseofgreek.com/feed/",
  },
  hebrew: {
    source: "Daily Dose of Hebrew",
    channelId: "UCRSbS2XhqOhnSUzWfGHUkLg",
    handle: "DailyDoseOfHebrew",
    url: "https://dailydoseofhebrew.com/",
    feedUrl: "https://dailydoseofhebrew.com/feed/",
  },
  septuagint: {
    source: "Daily Dose of Septuagint",
    channelId: "UC5SB4egyj9-RNdjL-VxcDRw",
    handle: "DailyDoseOfSeptuagint",
    url: "https://dailydoseofseptuagint.com/",
    feedUrl: "https://dailydoseofseptuagint.com/feed/",
  },
};

function openChannelFallback(config: LanguageFeedConfig) {
  return [{
    id: config.handle,
    title: "Open " + config.source,
    videoId: "",
    url: config.url,
    embedUrl: "",
    thumbnail: "",
    image: "",
    publishedAt: "",
    publishedTime: 0,
  }];
}

async function feed(config: LanguageFeedConfig) {
  const errors: string[] = [];
  try {
    const xml = await fetchText("https://www.youtube.com/feeds/videos.xml?channel_id=" + encodeURIComponent(config.channelId));
    const items = parseYouTube(xml);
    if (items.length) return { source: config.source, url: config.url, items };
    errors.push("YouTube channel feed returned no entries.");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  try {
    const resolved = await resolveYouTubeChannelId(config.handle);
    const xml = await fetchText("https://www.youtube.com/feeds/videos.xml?channel_id=" + encodeURIComponent(resolved));
    const items = parseYouTube(xml);
    if (items.length) return { source: config.source, url: config.url, channelId: resolved, items, warnings: errors };
    errors.push("Resolved YouTube feed returned no entries.");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  try {
    const items = await siteFeedFallback(config);
    if (items.length) return { source: config.source, url: config.url, items, warnings: errors };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return { source: config.source, url: config.url, items: openChannelFallback(config), error: errors.join(" | ") };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  const [greek, hebrew, septuagint] = await Promise.all([
    feed(VIDEO_FEEDS.greek),
    feed(VIDEO_FEEDS.hebrew),
    feed(VIDEO_FEEDS.septuagint),
  ]);
  return json({
    vocabulary: dailyVocabulary(),
    videos: { greek, hebrew, septuagint },
  });
});
