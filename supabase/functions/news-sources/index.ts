import { json, optionsResponse } from "../_shared/dashboard.ts";

const NEWS_FEEDS = {
  world: [
    { source: "Reuters", url: "https://www.reutersagency.com/feed/?best-topics=world&post_type=best" },
    { source: "CNN", url: "http://rss.cnn.com/rss/edition_world.rss" },
    { source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
    { source: "BBC", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
    { source: "The Guardian", url: "https://www.theguardian.com/world/rss" },
    { source: "France 24", url: "https://www.france24.com/en/rss" },
    { source: "Deutsche Welle", url: "https://rss.dw.com/rdf/rss-en-world" },
    { source: "NPR", url: "https://feeds.npr.org/1004/rss.xml" },
  ],
  philippines: [
    { source: "Rappler", url: "https://www.rappler.com/feed/" },
    { source: "Inquirer.net", url: "https://newsinfo.inquirer.net/feed" },
    { source: "GMA News Online", url: "https://www.gmanetwork.com/news/rss/news/" },
    { source: "ABS-CBN News", url: "https://news.abs-cbn.com/rss/news" },
    { source: "Philstar", url: "https://www.philstar.com/rss/headlines" },
    { source: "Manila Bulletin", url: "https://mb.com.ph/rss" },
  ],
  theology: [
    { source: "Open Doors", url: "https://www.opendoors.org/en-US/news/latest/rss/" },
    { source: "The Gospel Coalition", url: "https://www.thegospelcoalition.org/feed/" },
    { source: "Christianity Today", url: "https://www.christianitytoday.com/rss.xml" },
    { source: "Desiring God", url: "https://www.desiringgod.org/articles.atom" },
    { source: "Baptist Press", url: "https://www.baptistpress.com/feed/" },
    { source: "Religion News Service", url: "https://religionnews.com/feed/" },
  ],
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  return json(NEWS_FEEDS);
});

