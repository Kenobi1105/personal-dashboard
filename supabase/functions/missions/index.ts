import { extractArticleImage, fetchText, json, metaTag, optionsResponse, stripTags } from "../_shared/dashboard.ts";

const OPERATION_URL = "https://operationworld.org/prayer-resources/today/";
const JOSHUA_URL = "https://joshuaproject.net/pray/unreachedoftheday";

function titleFromHtml(html: string) {
  return stripTags(metaTag(html, "og:title") || metaTag(html, "twitter:title") || (html.match(/<h1[^>]*>[\s\S]*?<\/h1>/i)?.[0] || ""));
}

function paragraphSummary(html: string) {
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const paragraphs = (clean.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [])
    .map(stripTags)
    .filter((text) => text.length > 45 && !/cookie|privacy|subscribe|newsletter/i.test(text));
  return paragraphs[0] || "";
}

function prayerPointsFromHtml(html: string) {
  const listItems = (html.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) || [])
    .map(stripTags)
    .filter((text) => text.length > 25 && text.length < 320 && /pray|ask|church|gospel|believer|people|nation|lord|christ/i.test(text));
  return Array.from(new Set(listItems)).slice(0, 4);
}

async function operationWorld() {
  const fallback = {
    source: "Operation World",
    country: "Prayer Calendar",
    name: "Prayer Calendar",
    flagImage: "",
    summary: "Open the full Operation World prayer page for today's country prayer focus.",
    prayerPoints: ["Pray for gospel witness among the nations.", "Pray for churches serving under pressure.", "Pray for wise and courageous mission workers."],
    url: OPERATION_URL,
  };
  try {
    const html = await fetchText(OPERATION_URL);
    const title = titleFromHtml(html).replace(/\s*-\s*Operation World\s*$/i, "").trim();
    return {
      ...fallback,
      country: title && !/prayer/i.test(title) ? title : fallback.country,
      name: title || fallback.name,
      flagImage: extractArticleImage(html, OPERATION_URL) || fallback.flagImage,
      summary: paragraphSummary(html) || fallback.summary,
      prayerPoints: prayerPointsFromHtml(html).length ? prayerPointsFromHtml(html) : fallback.prayerPoints,
    };
  } catch {
    return fallback;
  }
}

async function joshuaProject() {
  const fallback = {
    source: "Joshua Project",
    name: "Unreached of the Day",
    peopleGroup: "Unreached of the Day",
    country: "Global",
    flagImage: "",
    summary: "Open Joshua Project for today's unreached people group prayer focus.",
    prayerPoints: ["Pray for Scripture access.", "Pray for local gospel workers.", "Pray for receptive hearts."],
    url: JOSHUA_URL,
  };
  try {
    const html = await fetchText(JOSHUA_URL);
    const title = titleFromHtml(html).replace(/\s*-\s*Joshua Project\s*$/i, "").trim();
    const titleParts = title.split(/\s+in\s+/i);
    return {
      ...fallback,
      name: titleParts[0] || title || fallback.name,
      peopleGroup: titleParts[0] || title || fallback.peopleGroup,
      country: titleParts[1] || fallback.country,
      flagImage: extractArticleImage(html, JOSHUA_URL) || fallback.flagImage,
      summary: paragraphSummary(html) || fallback.summary,
      prayerPoints: prayerPointsFromHtml(html).length ? prayerPointsFromHtml(html) : fallback.prayerPoints,
    };
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
