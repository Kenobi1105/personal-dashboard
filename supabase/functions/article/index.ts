import { escapeHtml, extractArticleImage, fetchText, json, metaTag, optionsResponse, stripTags } from "../_shared/dashboard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  const pageUrl = new URL(req.url).searchParams.get("url") || "";
  if (!/^https?:\/\//i.test(pageUrl)) return json({ error: "Valid article URL required" }, 400);
  const html = await fetchText(pageUrl);
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const paragraphs = (clean.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [])
    .map(stripTags)
    .filter((text) => text.length >= 45 && text.length <= 1800 && !/newsletter|subscribe|advertisement|cookie|related article/i.test(text))
    .slice(0, 18);
  return json({
    url: pageUrl,
    title: stripTags(metaTag(html, "og:title") || metaTag(html, "twitter:title")),
    image: extractArticleImage(html, pageUrl),
    contentHtml: paragraphs.map((paragraph) => "<p>" + escapeHtml(paragraph) + "</p>").join(""),
    extracted: paragraphs.length > 0,
  });
});
