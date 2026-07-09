import { fetchText, json, optionsResponse } from "../_shared/dashboard.ts";

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

function parseYouTube(xml: string) {
  return (xml.match(/<entry[\s\S]*?<\/entry>/gi) || []).slice(0, 7).map((block, index) => {
    const title = cleanTitle(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    const videoId = block.match(/<yt:videoId>(.*?)<\/yt:videoId>/i)?.[1] || "";
    const published = block.match(/<published>(.*?)<\/published>/i)?.[1] || "";
    const thumb = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1] || "";
    const image = youtubeImage(videoId, thumb);
    return {
      id: videoId || String(index),
      title,
      videoId,
      url: "https://www.youtube.com/watch?v=" + videoId,
      embedUrl: "https://www.youtube.com/embed/" + videoId,
      thumbnail: image,
      image,
      publishedAt: published,
      publishedTime: Date.parse(published) || 0,
    };
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
    vocabulary: dailyVocabulary(),
    videos: { greek, hebrew, septuagint },
  });
});
