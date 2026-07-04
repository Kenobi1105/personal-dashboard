import { absoluteUrl, decodeEntities, extractArticleImage, fetchText, json, metaTag, optionsResponse, stripTags } from "../_shared/dashboard.ts";

const OPERATION_CALENDAR_URL = "https://operationworld.org/prayer-calendar/";
const OPERATION_TODAY_URL = "https://operationworld.org/prayer-resources/today/";
const JOSHUA_URL = "https://joshuaproject.net/pray/unreachedoftheday";

const FLAG_CODES: Record<string, string> = {
  "afghanistan": "af",
  "azerbaijan": "az",
  "bangladesh": "bd",
  "cape verde": "cv",
  "china": "cn",
  "india": "in",
  "iran": "ir",
  "japan": "jp",
  "laos": "la",
  "malaysia": "my",
  "maldives": "mv",
  "mongolia": "mn",
  "morocco": "ma",
  "nepal": "np",
  "nigeria": "ng",
  "north korea": "kp",
  "pakistan": "pk",
  "somalia": "so",
  "sri lanka": "lk",
  "turkey": "tr",
  "vietnam": "vn",
  "yemen": "ye",
};

const OPERATION_FALLBACKS = [
  {
    country: "Afghanistan",
    summary: "Pray for Afghan believers, many of whom follow Jesus under deep pressure and isolation.",
    prayerPoints: ["Pray for courage and protection for secret believers.", "Pray for Scripture access in local languages.", "Pray for displaced families to encounter faithful Christian witness."],
  },
  {
    country: "Bangladesh",
    summary: "Pray for churches and workers serving amid poverty, social pressure, and religious tension.",
    prayerPoints: ["Pray for mature local leaders.", "Pray for protection for converts from Muslim, Hindu, and Buddhist backgrounds.", "Pray for gospel witness among unreached communities."],
  },
  {
    country: "India",
    summary: "Pray for India's churches as they serve in a vast and religiously diverse nation.",
    prayerPoints: ["Pray for wisdom for pastors and evangelists.", "Pray for believers facing anti-conversion pressure.", "Pray for unreached people groups to hear the gospel clearly."],
  },
  {
    country: "Iran",
    summary: "Pray for house churches and believers under surveillance in Iran.",
    prayerPoints: ["Pray for imprisoned Christians and their families.", "Pray for secure discipleship and Bible distribution.", "Pray for the gospel to spread through families and communities."],
  },
  {
    country: "Japan",
    summary: "Pray for a fresh gospel awakening in a country where Christians remain a small minority.",
    prayerPoints: ["Pray for churches to be strengthened across generations.", "Pray for students and young adults to encounter Christ.", "Pray for faithful witness amid loneliness and spiritual searching."],
  },
  {
    country: "Morocco",
    summary: "Pray for Moroccan believers who often follow Jesus quietly and carefully.",
    prayerPoints: ["Pray for encouragement for isolated disciples.", "Pray for wise fellowship and pastoral care.", "Pray for gospel conversations among families and friends."],
  },
  {
    country: "Nigeria",
    summary: "Pray for Nigerian churches serving amid violence, displacement, and rapid growth.",
    prayerPoints: ["Pray for protection for vulnerable communities.", "Pray for comfort for families affected by attacks.", "Pray for bold and gracious gospel witness."],
  },
  {
    country: "Somalia",
    summary: "Pray for Somali believers, most of whom must worship and grow in secret.",
    prayerPoints: ["Pray for protection from extremist violence.", "Pray for hidden believers to receive Scripture and discipleship.", "Pray for peace and gospel hope across Somali communities."],
  },
  {
    country: "Turkey",
    summary: "Pray for churches in Turkey to persevere and bear witness with patience and love.",
    prayerPoints: ["Pray for unity among small congregations.", "Pray for gospel openness among students and families.", "Pray for wisdom for Christian leaders."],
  },
  {
    country: "Vietnam",
    summary: "Pray for believers in Vietnam, especially ethnic minority Christians facing pressure.",
    prayerPoints: ["Pray for steadfast discipleship.", "Pray for pastors serving rural and minority communities.", "Pray for churches to grow in love, courage, and truth."],
  },
];

const JOSHUA_FALLBACKS = [
  {
    peopleGroup: "Shaikh",
    country: "Bangladesh",
    summary: "Pray for the Shaikh community to encounter faithful Christian witness through Scripture, friendship, and local believers.",
    prayerPoints: ["Pray for whole families to hear the gospel.", "Pray for culturally wise discipleship.", "Pray for workers who can serve with patience and humility."],
  },
  {
    peopleGroup: "Brahmin",
    country: "India",
    summary: "Pray for Brahmin communities to see the beauty and sufficiency of Christ.",
    prayerPoints: ["Pray for seekers to find Scripture and Christian fellowship.", "Pray for bridges of trust and honest conversation.", "Pray for believers from Hindu backgrounds to grow strong in faith."],
  },
  {
    peopleGroup: "Uyghur",
    country: "China",
    summary: "Pray for Uyghur families facing deep pressure, grief, and limited access to gospel resources.",
    prayerPoints: ["Pray for comfort and justice.", "Pray for Scripture access in the Uyghur language.", "Pray for workers who can serve with courage and compassion."],
  },
  {
    peopleGroup: "Pashtun",
    country: "Pakistan",
    summary: "Pray for Pashtun communities to hear the gospel through faithful witness and media resources.",
    prayerPoints: ["Pray for peace in Pashtun regions.", "Pray for discipleship for new believers.", "Pray for Christian media to reach homes and phones."],
  },
  {
    peopleGroup: "Yemeni Arab",
    country: "Yemen",
    summary: "Pray for Yemeni Arabs amid war, displacement, hunger, and spiritual need.",
    prayerPoints: ["Pray for mercy and peace.", "Pray for believers to endure with hope.", "Pray for gospel witness through humanitarian service and digital media."],
  },
  {
    peopleGroup: "Malay",
    country: "Malaysia",
    summary: "Pray for Malay communities to encounter Christ through dreams, Scripture, and faithful relationships.",
    prayerPoints: ["Pray for seekers to find safe Christian fellowship.", "Pray for wisdom for local churches.", "Pray for the gospel to move through families."],
  },
];

const PAGE_CHROME_RE = /groups resources|mobile app|email|podcast|prayer resources|pray today|world\s*&\s*regions|special issues|resources for churches|follow unreached|join thousands|prayer cards|social media|get involved|download ow prayer app|prayer and world evangelization|about wec international|sign up|daily prayer e-mail|resources|app/i;

function manilaDate() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000);
}

function dayOfYear(date: Date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const now = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((now - start) / 86400000);
}

function cleanText(value = "") {
  return decodeEntities(value)
    .replace(/\u00a0|&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromHtml(html: string) {
  return cleanText(stripTags(metaTag(html, "og:title") || metaTag(html, "twitter:title") || (html.match(/<h1[^>]*>[\s\S]*?<\/h1>/i)?.[0] || "")));
}

function flagForCountry(country = "") {
  const code = FLAG_CODES[country.toLowerCase()];
  return code ? "https://flagcdn.com/w320/" + code + ".png" : "";
}

function curatedOperationFallback(date = manilaDate()) {
  const entry = OPERATION_FALLBACKS[dayOfYear(date) % OPERATION_FALLBACKS.length];
  return operationEntryToResponse(entry, true);
}

function operationEntryToResponse(entry: typeof OPERATION_FALLBACKS[number], fallback: boolean, url = OPERATION_TODAY_URL) {
  return {
    source: "Operation World",
    country: entry.country,
    name: entry.country,
    flagImage: flagForCountry(entry.country),
    summary: entry.summary,
    prayerPoints: entry.prayerPoints,
    url,
    fallback,
  };
}

function curatedJoshuaFallback(date = manilaDate()) {
  const entry = JOSHUA_FALLBACKS[dayOfYear(date) % JOSHUA_FALLBACKS.length];
  return joshuaEntryToResponse(entry, true);
}

function joshuaEntryToResponse(entry: typeof JOSHUA_FALLBACKS[number], fallback: boolean, url = JOSHUA_URL) {
  return {
    source: "Joshua Project",
    name: entry.peopleGroup,
    peopleGroup: entry.peopleGroup,
    country: entry.country,
    flagImage: flagForCountry(entry.country),
    summary: entry.summary,
    prayerPoints: entry.prayerPoints,
    url,
    fallback,
  };
}

function operationFallbackForCountry(country: string, baseFallback = curatedOperationFallback(), url = OPERATION_TODAY_URL) {
  const entry = OPERATION_FALLBACKS.find((item) => item.country.toLowerCase() === cleanText(country).toLowerCase());
  return entry ? operationEntryToResponse(entry, true, url) : baseFallback;
}

function cleanPrayerPoints(items: string[]) {
  return Array.from(new Set(items.map(cleanText)))
    .filter((text) => text.length > 20 && text.length < 360)
    .filter((text) => !/cookie|privacy|subscribe|newsletter|javascript|unreached of day\s+today/i.test(text))
    .filter((text) => !PAGE_CHROME_RE.test(text))
    .slice(0, 4);
}

function hasUsefulPrayerPoints(items: string[]) {
  return items.length >= 2 && items.some((text) => /pray for|ask god|ask the lord|pray that|pray with/i.test(text));
}

function prayerPointsFromHtml(html: string) {
  const listItems = (html.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) || []).map(stripTags);
  const paragraphs = (html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || []).map(stripTags);
  return cleanPrayerPoints(listItems.concat(paragraphs).filter((text) => /pray|ask|church|gospel|believer|people|nation|lord|christ|scripture|worker/i.test(text)));
}

function paragraphSummary(html: string) {
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const paragraphs = (clean.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [])
    .map(stripTags)
    .map(cleanText)
    .filter((text) => text.length > 45 && !/cookie|privacy|subscribe|newsletter|unreached of day\s+today/i.test(text));
  return paragraphs[0] || "";
}

function contextAround(html: string, needle: RegExp, before = 1400, after = 2200) {
  const match = needle.exec(html);
  if (!match || match.index < 0) return "";
  return html.slice(Math.max(0, match.index - before), Math.min(html.length, match.index + (match[0]?.length || 0) + after));
}

function findHref(block: string, base: string) {
  const href = block.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] || "";
  return href ? absoluteUrl(href, base) : "";
}

function findCountryInText(text: string) {
  const rejected = /operation world|prayer calendar|prayer resources|today|daily prayer/i;
  const candidates = text
    .split(/[|•\n\r]+/)
    .map(cleanText)
    .filter((part) => part.length > 2 && part.length < 45 && !rejected.test(part) && !PAGE_CHROME_RE.test(part));
  return candidates[0] || "";
}

function isBadMissionTitle(value: string) {
  const text = cleanText(value);
  return !text || text.length > 80 || PAGE_CHROME_RE.test(text) || /\b(resources|groups|mobile|email|podcast)\b/i.test(text);
}

async function operationWorld() {
  const fallback = curatedOperationFallback();
  try {
    const date = manilaDate();
    const month = date.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
    const day = date.getUTCDate();
    const calendarHtml = await fetchText(OPERATION_CALENDAR_URL, 9000);
    const todayBlock = contextAround(calendarHtml, new RegExp(month + "\\s+" + day + "(?:\\D|$)", "i"));
    const prayerUrl = findHref(todayBlock, OPERATION_CALENDAR_URL) || OPERATION_TODAY_URL;
    const detailHtml = await fetchText(prayerUrl, 9000);
    const detailTitle = titleFromHtml(detailHtml).replace(/\s*-\s*Operation World\s*$/i, "");
    const calendarText = cleanText(stripTags(todayBlock));
    const calendarCountry = findCountryInText(calendarText.replace(new RegExp(month + "\\s+" + day, "i"), ""));
    const country = (detailTitle && !/prayer|operation world|today/i.test(detailTitle) ? detailTitle : calendarCountry) || fallback.country;
    const curated = operationFallbackForCountry(country, fallback, prayerUrl);
    return {
      ...curated,
      flagImage: flagForCountry(curated.country) || extractArticleImage(detailHtml, prayerUrl) || curated.flagImage,
      fallback: true,
    };
  } catch {
    return fallback;
  }
}

function parseJoshuaPlainText(plain: string) {
  const peopleFromPray = plain.match(/pray\s+for\s+the\s+(.+?)\s+in\s+([A-Z][A-Za-z .'-]{2,45})(?:[.!,]|$)/i);
  const hubCountry = plain.match(/(?:Hub|Primary)\s+Country:?\s*([A-Z][A-Za-z .'-]{2,45})/i);
  const peopleField = plain.match(/(?:People|People Group|People Name):?\s*([A-Z][A-Za-z .'-]{2,70})/i);
  return {
    peopleGroup: cleanText(peopleField?.[1] || peopleFromPray?.[1] || ""),
    country: cleanText(hubCountry?.[1] || peopleFromPray?.[2] || ""),
  };
}

function joshuaPrayerPoints(plain: string, html: string) {
  const focus = plain.match(/Prayer Focus\s+([\s\S]{40,700}?)(?:Profile|Location|People|Source|$)/i)?.[1] || "";
  const focusSentences = focus
    .split(/(?<=[.!?])\s+/)
    .map(cleanText)
    .filter((text) => /pray|ask|god|lord|christ|scripture|gospel|worker/i.test(text));
  return cleanPrayerPoints(focusSentences.concat(prayerPointsFromHtml(html)));
}

async function joshuaProject() {
  const fallback = curatedJoshuaFallback();
  try {
    const html = await fetchText(JOSHUA_URL, 9000);
    const plain = cleanText(stripTags(html));
    const parsed = parseJoshuaPlainText(plain);
    const title = titleFromHtml(html).replace(/\s*-\s*Joshua Project\s*$/i, "");
    const titleParts = /unreached of the day/i.test(title) ? [] : title.split(/\s+in\s+/i);
    const peopleGroup = parsed.peopleGroup || titleParts[0] || fallback.peopleGroup;
    const country = parsed.country || titleParts[1] || fallback.country;
    const points = joshuaPrayerPoints(plain, html);
    if (isBadMissionTitle(peopleGroup) || !hasUsefulPrayerPoints(points)) {
      return fallback;
    }
    const matchedFallback = JOSHUA_FALLBACKS.find((item) => item.peopleGroup.toLowerCase() === cleanText(peopleGroup).toLowerCase());
    if (matchedFallback) {
      return joshuaEntryToResponse(matchedFallback, true);
    }
    return fallback;
  } catch {
    return fallback;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  return json({
    operation: await operationWorld(),
    joshua: await joshuaProject(),
  });
});
