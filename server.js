var http = require("http");
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");

var PORT = Number(process.env.PORT || 5177);
var ROOT = __dirname;
var PRIVATE_CONFIG_PATH = path.join(ROOT, ".dashboard-private.json");
var GOOGLE_CALENDAR_TOKEN_PATH = path.join(ROOT, ".google-calendar-token.json");
var GOOGLE_OAUTH_SECRET_PATHS = [
  path.join(ROOT, ".secrets", "google-oauth-client.json"),
  path.join(ROOT, ".secret", "google-oauth-client.json")
];
var GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events"
];
var GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
var GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
var GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
var GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

var NEWS_FEEDS = {
  world: [
    { source: "Reuters", url: "https://www.reutersagency.com/feed/?best-topics=world&post_type=best", priority: 1 },
    { source: "CNN", url: "http://rss.cnn.com/rss/edition_world.rss", priority: 2 },
    { source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", priority: 3 },
    { source: "BBC", url: "https://feeds.bbci.co.uk/news/world/rss.xml", priority: 4 },
    { source: "The Guardian", url: "https://www.theguardian.com/world/rss", priority: 5 },
    { source: "France 24", url: "https://www.france24.com/en/rss", priority: 6 },
    { source: "Deutsche Welle", url: "https://rss.dw.com/rdf/rss-en-world", priority: 7 },
    { source: "NPR", url: "https://feeds.npr.org/1004/rss.xml", priority: 8 }
  ],
  philippines: [
    { source: "Rappler", url: "https://www.rappler.com/feed/", priority: 1 },
    { source: "Inquirer.net", url: "https://newsinfo.inquirer.net/feed", priority: 2 },
    { source: "GMA News Online", url: "https://www.gmanetwork.com/news/rss/news/", priority: 3 },
    { source: "ABS-CBN News", url: "https://news.abs-cbn.com/rss/news", priority: 4 },
    { source: "Philstar", url: "https://www.philstar.com/rss/headlines", priority: 5 },
    { source: "Manila Bulletin", url: "https://mb.com.ph/rss", priority: 6 }
  ],
  theology: [
    { source: "Open Doors", url: "https://www.opendoors.org/en-US/news/latest/rss/", priority: 1 },
    { source: "The Gospel Coalition", url: "https://www.thegospelcoalition.org/feed/", priority: 2 },
    { source: "Christianity Today", url: "https://www.christianitytoday.com/rss.xml", priority: 3 },
    { source: "Desiring God", url: "https://www.desiringgod.org/articles.atom", priority: 4 },
    { source: "Baptist Press", url: "https://www.baptistpress.com/feed/", priority: 5 },
    { source: "Religion News Service", url: "https://religionnews.com/feed/", priority: 6 }
  ]
};

var THEOLOGY_PAGES = [
  { source: "Christianity Today", url: "https://www.christianitytoday.com/", priority: 1 },
  { source: "The Gospel Coalition", url: "https://www.thegospelcoalition.org/", priority: 2 },
  { source: "Desiring God", url: "https://www.desiringgod.org/", priority: 3 },
  { source: "Open Doors", url: "https://www.opendoors.org/en-US/", priority: 4 }
];

var WORLD_WATCH_COUNTRIES = [
  { rank: 1, name: "North Korea", slug: "north-korea", flag: "🇰🇵" },
  { rank: 2, name: "Somalia", slug: "somalia", flag: "🇸🇴" },
  { rank: 3, name: "Yemen", slug: "yemen", flag: "🇾🇪" },
  { rank: 4, name: "Libya", slug: "libya", flag: "🇱🇾" },
  { rank: 5, name: "Sudan", slug: "sudan", flag: "🇸🇩" },
  { rank: 6, name: "Eritrea", slug: "eritrea", flag: "🇪🇷" },
  { rank: 7, name: "Nigeria", slug: "nigeria", flag: "🇳🇬" },
  { rank: 8, name: "Pakistan", slug: "pakistan", flag: "🇵🇰" },
  { rank: 9, name: "Iran", slug: "iran", flag: "🇮🇷" },
  { rank: 10, name: "Afghanistan", slug: "afghanistan", flag: "🇦🇫" },
  { rank: 11, name: "India", slug: "india", flag: "🇮🇳" },
  { rank: 12, name: "Syria", slug: "syria", flag: "🇸🇾" },
  { rank: 13, name: "Saudi Arabia", slug: "saudi-arabia", flag: "🇸🇦" },
  { rank: 14, name: "Myanmar", slug: "myanmar", flag: "🇲🇲" },
  { rank: 15, name: "Maldives", slug: "maldives", flag: "🇲🇻" },
  { rank: 16, name: "China", slug: "china", flag: "🇨🇳" },
  { rank: 17, name: "Mali", slug: "mali", flag: "🇲🇱" },
  { rank: 18, name: "Iraq", slug: "iraq", flag: "🇮🇶" },
  { rank: 19, name: "Algeria", slug: "algeria", flag: "🇩🇿" },
  { rank: 20, name: "Mauritania", slug: "mauritania", flag: "🇲🇷" }
];

var SPORT_CONFIG = {
  nba: {
    label: "NBA",
    team: "Lakers",
    teamLabel: "Los Angeles Lakers",
    scoreboard: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
    standings: "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings"
  },
  nfl: {
    label: "NFL",
    team: "Patriots",
    teamLabel: "New England Patriots",
    scoreboard: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
    standings: "https://site.api.espn.com/apis/v2/sports/football/nfl/standings"
  },
  mlb: {
    label: "MLB",
    team: "Yankees",
    teamLabel: "New York Yankees",
    teamId: 147,
    favoriteTeams: [
      { name: "Yankees", label: "New York Yankees", teamId: 147 },
      { name: "Dodgers", label: "Los Angeles Dodgers", teamId: 119 }
    ]
  }
};

var SPORT_NEWS_FEEDS = {
  nba: [
    { source: "ESPN NBA", url: "https://www.espn.com/espn/rss/nba/news", priority: 1 },
    { source: "CBS Sports NBA", url: "https://www.cbssports.com/rss/headlines/nba/", priority: 2 },
    { source: "Yahoo Sports NBA", url: "https://sports.yahoo.com/nba/rss/", priority: 3 }
  ],
  mlb: [
    { source: "MLB.com", url: "https://www.mlb.com/feeds/news/rss.xml", priority: 1 },
    { source: "ESPN MLB", url: "https://www.espn.com/espn/rss/mlb/news", priority: 2 },
    { source: "CBS Sports MLB", url: "https://www.cbssports.com/rss/headlines/mlb/", priority: 3 }
  ],
  nfl: [
    { source: "NFL.com", url: "https://www.nfl.com/feeds/rss/news", priority: 1 },
    { source: "ESPN NFL", url: "https://www.espn.com/espn/rss/nfl/news", priority: 2 },
    { source: "CBS Sports NFL", url: "https://www.cbssports.com/rss/headlines/nfl/", priority: 3 }
  ]
};

var LANGUAGE_VIDEO_FEEDS = {
  greek: { source: "Daily Dose of Greek", handle: "DailyDoseOfGreek", channelId: "UC0fRqEfY1ZaiWiJWTj7HQng", url: "https://dailydoseofgreek.com/" },
  hebrew: { source: "Daily Dose of Hebrew", handle: "DailyDoseOfHebrew", channelId: "UCRSbS2XhqOhnSUzWfGHUkLg", url: "https://dailydoseofhebrew.com/" },
  septuagint: { source: "Daily Dose of Septuagint", handle: "DailyDoseOfSeptuagint", channelId: "UC5SB4egyj9-RNdjL-VxcDRw", url: "https://dailydoseofseptuagint.com/" }
};

var LANGUAGE_VOCABULARY = {
  greek: [
    { word: "λόγος", transliteration: "logos", gloss: "word, message, reason", parsing: "Noun, masculine", example: "John 1:1" },
    { word: "χάρις", transliteration: "charis", gloss: "grace, favor", parsing: "Noun, feminine", example: "Ephesians 2:8" },
    { word: "πίστις", transliteration: "pistis", gloss: "faith, faithfulness", parsing: "Noun, feminine", example: "Romans 3:22" },
    { word: "ἀγάπη", transliteration: "agape", gloss: "love", parsing: "Noun, feminine", example: "1 Corinthians 13:13" },
    { word: "ἐκκλησία", transliteration: "ekklesia", gloss: "assembly, church", parsing: "Noun, feminine", example: "Matthew 16:18" },
    { word: "μαθητής", transliteration: "mathetes", gloss: "disciple, learner", parsing: "Noun, masculine", example: "Matthew 28:19" },
    { word: "βασιλεία", transliteration: "basileia", gloss: "kingdom, reign", parsing: "Noun, feminine", example: "Mark 1:15" }
  ],
  hebrew: [
    { word: "בְּרִית", transliteration: "berit", gloss: "covenant", parsing: "Noun, feminine", example: "Genesis 17:7" },
    { word: "חֶסֶד", transliteration: "hesed", gloss: "steadfast love, covenant loyalty", parsing: "Noun, masculine", example: "Psalm 136:1" },
    { word: "שָׁלוֹם", transliteration: "shalom", gloss: "peace, wholeness", parsing: "Noun, masculine", example: "Numbers 6:26" },
    { word: "רוּחַ", transliteration: "ruach", gloss: "spirit, wind, breath", parsing: "Noun, common gender", example: "Genesis 1:2" },
    { word: "תּוֹרָה", transliteration: "torah", gloss: "instruction, law", parsing: "Noun, feminine", example: "Psalm 1:2" },
    { word: "מֶלֶךְ", transliteration: "melek", gloss: "king", parsing: "Noun, masculine", example: "1 Samuel 8:5" },
    { word: "קָדוֹשׁ", transliteration: "qadosh", gloss: "holy, set apart", parsing: "Adjective", example: "Isaiah 6:3" }
  ]
};

var API_FOOTBALL_BASE = process.env.API_FOOTBALL_BASE || "https://v3.football.api-sports.io";
var API_NBA_BASE = process.env.API_NBA_BASE || "https://v2.nba.api-sports.io";
var API_NFL_BASE = process.env.API_NFL_BASE || "https://v1.american-football.api-sports.io";
var CURRENT_YEAR = new Date().getFullYear();
var CURRENT_MONTH = new Date().getMonth();
var DOMESTIC_FOOTBALL_SEASON = Number(process.env.FOOTBALL_SEASON || (CURRENT_MONTH >= 6 ? CURRENT_YEAR : CURRENT_YEAR - 1));
var WORLD_CUP_SEASON = Number(process.env.WORLD_CUP_SEASON || (CURRENT_YEAR === 2026 ? 2026 : CURRENT_YEAR));
var NBA_SEASON = Number(process.env.NBA_SEASON || (CURRENT_MONTH >= 8 ? CURRENT_YEAR : CURRENT_YEAR - 1));
var NFL_SEASON = Number(process.env.NFL_SEASON || (CURRENT_MONTH >= 7 ? CURRENT_YEAR : CURRENT_YEAR - 1));
var FOOTBALL_CAROUSEL = [
  { id: "brazil", label: "Brazil Men", mode: "team", team: "Brazil", teamId: 6 },
  { id: "dortmund", label: "Borussia Dortmund", mode: "team", team: "Borussia Dortmund", teamId: 165 },
  { id: "international", label: "FIFA World Cup", mode: "worldCup", leagueId: 1, season: WORLD_CUP_SEASON },
  { id: "champions", label: "UEFA Champions League", mode: "standings", leagueId: 2, season: DOMESTIC_FOOTBALL_SEASON },
  { id: "domesticLeague", label: "Domestic League", mode: "standings", leagueId: 78, season: DOMESTIC_FOOTBALL_SEASON },
  { id: "domesticCup", label: "Domestic Cup", mode: "bracket", leagueId: 81, season: DOMESTIC_FOOTBALL_SEASON }
];

var newsCache = { time: 0, data: null };
var sportsCache = {};
var leagueNewsCache = {};
var worldWatchCache = { key: "", data: null };
var missionsCache = { key: "", data: null };
var languageCache = { time: 0, data: null };
var bibleCache = {};
var customRssCache = {};
var articleCache = {};

function readPrivateConfig() {
  try {
    return JSON.parse(fs.readFileSync(PRIVATE_CONFIG_PATH, "utf8"));
  } catch (error) {
    return {};
  }
}

function writePrivateConfig(config) {
  fs.writeFileSync(PRIVATE_CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getApiSportsKey() {
  var config = readPrivateConfig();
  return process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY || config.apiSportsKey || config.apiFootballKey || "";
}

function defaultGoogleCalendarRedirectUri() {
  return process.env.GOOGLE_CALENDAR_REDIRECT_URI || "http://127.0.0.1:" + PORT + "/api/google-calendar/oauth/callback";
}

function readGoogleOAuthClientFile() {
  for (var index = 0; index < GOOGLE_OAUTH_SECRET_PATHS.length; index += 1) {
    var filePath = GOOGLE_OAUTH_SECRET_PATHS[index];
    try {
      if (!fs.existsSync(filePath)) continue;
      var json = JSON.parse(fs.readFileSync(filePath, "utf8"));
      var source = json.web || json.installed || json;
      return {
        clientId: source.client_id || source.clientId || "",
        clientSecret: source.client_secret || source.clientSecret || "",
        redirectUris: source.redirect_uris || source.redirectUris || [],
        source: filePath
      };
    } catch (error) {
      return { clientId: "", clientSecret: "", redirectUris: [], source: filePath, error: error.message };
    }
  }
  return { clientId: "", clientSecret: "", redirectUris: [], source: "" };
}

function getGoogleCalendarConfig() {
  var config = readPrivateConfig();
  var oauthFile = readGoogleOAuthClientFile();
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID || oauthFile.clientId || config.googleClientId || config.googleCalendarClientId || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CALENDAR_CLIENT_SECRET || oauthFile.clientSecret || config.googleClientSecret || config.googleCalendarClientSecret || "",
    redirectUri: defaultGoogleCalendarRedirectUri(),
    credentialSource: process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID ? "environment" : oauthFile.clientId && oauthFile.clientSecret ? "secret-file" : config.googleClientId || config.googleCalendarClientId ? "private-config" : "",
    credentialFile: oauthFile.source || "",
    credentialFileError: oauthFile.error || ""
  };
}

function googleCalendarConfigured() {
  var config = getGoogleCalendarConfig();
  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

function ensureTokenSecret() {
  var config = readPrivateConfig();
  if (!config.googleCalendarTokenSecret) {
    config.googleCalendarTokenSecret = crypto.randomBytes(32).toString("hex");
    writePrivateConfig(config);
  }
  return crypto.createHash("sha256").update(String(config.googleCalendarTokenSecret)).digest();
}

function encryptJson(value) {
  var iv = crypto.randomBytes(12);
  var cipher = crypto.createCipheriv("aes-256-gcm", ensureTokenSecret(), iv);
  var plaintext = Buffer.from(JSON.stringify(value), "utf8");
  var encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64")
  };
}

function decryptJson(envelope) {
  var decipher = crypto.createDecipheriv("aes-256-gcm", ensureTokenSecret(), Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  var decrypted = Buffer.concat([
    decipher.update(Buffer.from(envelope.data, "base64")),
    decipher.final()
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

function readGoogleCalendarToken() {
  try {
    var envelope = JSON.parse(fs.readFileSync(GOOGLE_CALENDAR_TOKEN_PATH, "utf8"));
    return decryptJson(envelope);
  } catch (error) {
    return null;
  }
}

function writeGoogleCalendarToken(tokenData) {
  fs.writeFileSync(GOOGLE_CALENDAR_TOKEN_PATH, JSON.stringify(encryptJson(tokenData), null, 2));
}

function deleteGoogleCalendarToken() {
  try {
    fs.unlinkSync(GOOGLE_CALENDAR_TOKEN_PATH);
  } catch (error) {
    if (error && error.code !== "ENOENT") throw error;
  }
}

function saveGoogleCalendarOauthState(state) {
  var config = readPrivateConfig();
  config.googleCalendarOauthState = state;
  config.googleCalendarOauthStartedAt = Date.now();
  writePrivateConfig(config);
}

function consumeGoogleCalendarOauthState(state) {
  var config = readPrivateConfig();
  var stored = config.googleCalendarOauthState || "";
  var startedAt = Number(config.googleCalendarOauthStartedAt || 0);
  delete config.googleCalendarOauthState;
  delete config.googleCalendarOauthStartedAt;
  writePrivateConfig(config);
  return Boolean(state && stored && state === stored && Date.now() - startedAt < 10 * 60 * 1000);
}

function encodeForm(values) {
  var params = new URLSearchParams();
  Object.keys(values).forEach(function (key) {
    if (values[key] !== undefined && values[key] !== null) params.set(key, values[key]);
  });
  return params.toString();
}

async function postGoogleToken(values) {
  var response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: encodeForm(values)
  });
  var body = await response.json().catch(function () { return {}; });
  if (!response.ok) throw new Error(body.error_description || body.error || "Google token request failed");
  return body;
}

async function fetchGoogleUser(accessToken) {
  try {
    var response = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: "Bearer " + accessToken }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function exchangeGoogleCalendarCode(code) {
  var config = getGoogleCalendarConfig();
  var token = await postGoogleToken({
    code: code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code"
  });
  var profile = await fetchGoogleUser(token.access_token);
  writeGoogleCalendarToken({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    scope: token.scope,
    token_type: token.token_type,
    expires_at: Date.now() + Number(token.expires_in || 3600) * 1000,
    connected_at: new Date().toISOString(),
    profile: profile ? {
      email: profile.email || "",
      name: profile.name || "",
      picture: profile.picture || ""
    } : null
  });
}

async function getGoogleCalendarAccessToken() {
  var token = readGoogleCalendarToken();
  if (!token || !token.access_token) return null;
  if (token.expires_at && Date.now() < Number(token.expires_at) - 60 * 1000) return token.access_token;
  if (!token.refresh_token) return token.access_token;

  var config = getGoogleCalendarConfig();
  var refreshed = await postGoogleToken({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: token.refresh_token,
    grant_type: "refresh_token"
  });
  token.access_token = refreshed.access_token;
  token.scope = refreshed.scope || token.scope;
  token.token_type = refreshed.token_type || token.token_type;
  token.expires_at = Date.now() + Number(refreshed.expires_in || 3600) * 1000;
  writeGoogleCalendarToken(token);
  return token.access_token;
}

async function googleCalendarRequest(apiPath, options) {
  var accessToken = await getGoogleCalendarAccessToken();
  if (!accessToken) {
    var missing = new Error("Google Calendar is not connected");
    missing.statusCode = 401;
    throw missing;
  }
  var response = await fetch(GOOGLE_CALENDAR_API + apiPath, Object.assign({}, options || {}, {
    headers: Object.assign({
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json"
    }, options && options.headers ? options.headers : {})
  }));
  var text = await response.text();
  var body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    var error = new Error(body.error && body.error.message ? body.error.message : "Google Calendar request failed");
    error.statusCode = response.status;
    throw error;
  }
  return body;
}

function apiErrorMessage(errors, fallback) {
  if (!errors) return fallback;
  if (typeof errors === "string") return errors || fallback;
  if (Array.isArray(errors)) return errors.filter(Boolean).join("; ") || fallback;
  if (typeof errors === "object") {
    return Object.keys(errors).map(function (key) {
      return key + ": " + errors[key];
    }).join("; ") || fallback;
  }
  return fallback;
}

function isPlanSeasonError(error) {
  return error && /free plans do not have access to this season|try from 2022 to 2024/i.test(error.message || "");
}

async function withSeasonFallback(primarySeason, fallbackSeasons, loader) {
  try {
    return await loader(primarySeason);
  } catch (error) {
    if (!isPlanSeasonError(error)) throw error;
    var seasons = fallbackSeasons || [];
    var lastError = error;
    for (var i = 0; i < seasons.length; i += 1) {
      try {
        var value = await loader(seasons[i]);
        value.fallbackSeason = seasons[i];
        value.requestedSeason = primarySeason;
        return value;
      } catch (fallbackError) {
        lastError = fallbackError;
      }
    }
    throw lastError;
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, function (_, hex) { return String.fromCodePoint(parseInt(hex, 16)); })
    .replace(/&#(\d+);/g, function (_, num) { return String.fromCodePoint(parseInt(num, 10)); })
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value) {
  return decodeEntities(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char];
  });
}

function absoluteUrl(url, base) {
  if (!url) return "";
  try {
    return new URL(decodeEntities(url), base).toString();
  } catch (error) {
    return decodeEntities(url);
  }
}

function tag(block, name) {
  var match = block.match(new RegExp("<" + name + "[^>]*>([\\s\\S]*?)<\\/" + name + ">", "i"));
  return match ? decodeEntities(match[1]).trim() : "";
}

function tagRaw(block, name) {
  var match = block.match(new RegExp("<" + name + "[^>]*>([\\s\\S]*?)<\\/" + name + ">", "i"));
  return match ? decodeEntities(match[1]).trim() : "";
}

function attr(block, tagName, attrName) {
  var re = new RegExp("<" + tagName + "[^>]*\\s" + attrName + "=[\"']([^\"']+)[\"'][^>]*>", "i");
  var match = block.match(re);
  return match ? decodeEntities(match[1]).trim() : "";
}

function metaContent(html, name) {
  var patterns = [
    new RegExp("<meta[^>]+(?:property|name)=[\"']" + name + "[\"'][^>]+content=[\"']([^\"']+)[\"'][^>]*>", "i"),
    new RegExp("<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name)=[\"']" + name + "[\"'][^>]*>", "i")
  ];
  for (var i = 0; i < patterns.length; i += 1) {
    var match = html.match(patterns[i]);
    if (match) return decodeEntities(match[1]);
  }
  return "";
}

function parseFeed(xml, feed) {
  var items = [];
  var blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  blocks.slice(0, 16).forEach(function (block, index) {
    var title = stripTags(tag(block, "title"));
    var link = tag(block, "link") || attr(block, "link", "href") || tag(block, "guid");
    var rawContent = tagRaw(block, "content:encoded") || tagRaw(block, "content") || tagRaw(block, "description") || tagRaw(block, "summary");
    var description = stripTags(tag(block, "description") || tag(block, "summary") || tag(block, "content:encoded"));
    var published = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated");
    var image = attr(block, "media:content", "url") || attr(block, "media:thumbnail", "url") || attr(block, "enclosure", "url");
    var video = "";
    var enclosureType = attr(block, "enclosure", "type") || attr(block, "media:content", "type");
    if (/video/i.test(enclosureType || "")) {
      video = attr(block, "enclosure", "url") || attr(block, "media:content", "url");
      if (image === video) image = "";
    }
    if (!image) {
      var img = block.match(/<img[^>]+src=["']([^"']+)["']/i);
      image = img ? decodeEntities(img[1]) : "";
    }
    if (!title || !link) return;
    items.push({
      id: feed.source.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + index,
      title: title,
      url: absoluteUrl(link, feed.url),
      summary: description,
      contentHtml: rawContent,
      image: absoluteUrl(image, feed.url),
      video: absoluteUrl(video, feed.url),
      isVideo: !!video || /\/video\/|video/i.test(link + " " + title),
      source: feed.source,
      feedUrl: feed.url,
      publishedAt: published,
      sourcePriority: feed.priority,
      feedOrder: index,
      publishedTime: Date.parse(published) || 0,
      score: feed.priority * 100 + index
    });
  });
  return items;
}

function sourceFilterFor(url) {
  var selected = {};
  ["world", "philippines", "theology"].forEach(function (section) {
    var value = url.searchParams.get(section + "Sources");
    if (!value) return;
    selected[section] = value.split("|").map(decodeURIComponent).filter(Boolean).slice(0, 10);
  });
  var customRaw = url.searchParams.get("customSources");
  if (customRaw) {
    try {
      var parsed = JSON.parse(customRaw);
      selected.customSources = {};
      ["world", "philippines", "theology"].forEach(function (section) {
        selected.customSources[section] = (parsed[section] || []).filter(function (feed) {
          return feed && feed.source && /^https?:\/\//i.test(feed.url || "");
        }).slice(0, 20).map(function (feed, index) {
          return {
            source: String(feed.source).slice(0, 80),
            url: String(feed.url),
            priority: 50 + index,
            custom: true
          };
        });
      });
    } catch (error) {
      selected.customSources = {};
    }
  }
  return selected;
}

function feedsForSection(section, selected) {
  var feeds = (NEWS_FEEDS[section] || []).concat(selected && selected.customSources && selected.customSources[section] ? selected.customSources[section] : []);
  var chosen = selected && selected[section] && selected[section].length ? selected[section] : null;
  if (!chosen) return feeds.slice(0, 10);
  var byName = {};
  feeds.forEach(function (feed) { byName[feed.source] = feed; });
  return chosen.map(function (name) { return byName[name]; }).filter(Boolean).slice(0, 10);
}

async function enrichNewsMedia(item) {
  if (!item || item.image || item.video || !item.url || !/^https?:/i.test(item.url)) return item;
  try {
    var html = await fetchText(item.url);
    var image = metaContent(html, "og:image") || metaContent(html, "twitter:image");
    var video = metaContent(html, "og:video") || metaContent(html, "og:video:url") || metaContent(html, "twitter:player");
    if (image) item.image = absoluteUrl(image, item.url);
    if (video && /\.(mp4|webm|ogg)(\?|$)/i.test(video)) item.video = absoluteUrl(video, item.url);
    if (video) item.isVideo = true;
  } catch (error) {
    item.mediaError = error.message;
  }
  return item;
}

function extractArticleHtml(html, pageUrl) {
  var clean = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");
  var containers = [];
  var article = clean.match(/<article[\s\S]*?<\/article>/i);
  if (article) containers.push(article[0]);
  var main = clean.match(/<main[\s\S]*?<\/main>/i);
  if (main) containers.push(main[0]);
  containers.push(clean);

  var best = [];
  containers.some(function (container) {
    var paragraphs = [];
    var matches = container.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [];
    matches.forEach(function (paragraph) {
      if (/newsletter|subscribe|advertisement|sign up|cookie|related article|read more|follow us/i.test(paragraph)) return;
      var text = stripTags(paragraph);
      if (text.length < 45 || text.length > 1800) return;
      paragraphs.push(text);
    });
    if (paragraphs.length >= 3) {
      best = paragraphs;
      return true;
    }
    if (paragraphs.length > best.length) best = paragraphs;
    return false;
  });

  var image = metaContent(html, "og:image") || metaContent(html, "twitter:image") || "";
  var description = stripTags(metaContent(html, "og:description") || metaContent(html, "description"));
  if (!best.length && description) best = [description];
  return {
    title: stripTags(metaContent(html, "og:title") || metaContent(html, "twitter:title") || ""),
    image: absoluteUrl(image, pageUrl),
    contentHtml: best.slice(0, 18).map(function (paragraph) {
      return "<p>" + escapeHtml(paragraph) + "</p>";
    }).join(""),
    extracted: best.length > 0
  };
}

async function getArticle(urlValue) {
  var pageUrl = String(urlValue || "");
  if (!/^https?:\/\//i.test(pageUrl)) throw new Error("A valid article URL is required.");
  var cacheKey = pageUrl.replace(/#.*$/, "");
  if (articleCache[cacheKey] && Date.now() - articleCache[cacheKey].time < 30 * 60 * 1000) return articleCache[cacheKey].data;
  var html = await fetchText(pageUrl);
  var data = Object.assign({ url: pageUrl }, extractArticleHtml(html, pageUrl));
  articleCache[cacheKey] = { time: Date.now(), data: data };
  return data;
}

async function enrichSectionMedia(items) {
  var targets = items.filter(function (item) { return !item.image && !item.video; }).slice(0, 12);
  await Promise.allSettled(targets.map(enrichNewsMedia));
  return items;
}

function parseHomepageLinks(html, page) {
  var items = [];
  var seen = {};
  var image = metaContent(html, "og:image") || metaContent(html, "twitter:image") || "";
  var matches = html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi) || [];
  matches.forEach(function (anchor, index) {
    var href = attr(anchor, "a", "href");
    var title = stripTags(anchor);
    if (!href || !title || title.length < 24 || title.length > 140) return;
    if (/javascript:|browsehappy|#|donate|subscribe|newsletter|privacy|account|login|stichting|international|serving persecuted|cookie|menu|contact|read more|making a difference|our work|about us|get involved|campaign|\/blogs\//i.test(href + " " + title)) return;
    var url = absoluteUrl(href, page.url);
    if (seen[url]) return;
    seen[url] = true;
    items.push({
      id: page.source.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-page-" + index,
      title: title,
      url: url,
      summary: "Latest from " + page.source + ".",
      image: image,
      video: "",
      isVideo: /\/video\/|video|watch/i.test(url + " " + title),
      source: page.source,
      publishedAt: "",
      sourcePriority: page.priority,
      feedOrder: index,
      publishedTime: Date.now() - index,
      score: page.priority * 100 + index
    });
  });
  return items.slice(0, 6);
}

function compareNews(a, b) {
  var now = Date.now();
  var aAge = a.publishedTime ? now - a.publishedTime : Infinity;
  var bAge = b.publishedTime ? now - b.publishedTime : Infinity;
  var week = 7 * 24 * 60 * 60 * 1000;
  var aFresh = aAge <= week;
  var bFresh = bAge <= week;
  if (aFresh !== bFresh) return aFresh ? -1 : 1;
  if (aFresh && bFresh && Math.abs(aAge - bAge) > 6 * 60 * 60 * 1000) return b.publishedTime - a.publishedTime;
  if (a.sourcePriority !== b.sourcePriority) return a.sourcePriority - b.sourcePriority;
  return a.feedOrder - b.feedOrder;
}

function uniqueNewsItems(items) {
  var seen = {};
  return items.filter(function (item) {
    var key = (item.url || item.title || "").replace(/[?#].*$/, "").toLowerCase();
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function balancedNewsItems(items, limit, perSourceLimit) {
  var sorted = uniqueNewsItems(items.slice().sort(compareNews));
  var picked = [];
  var grouped = {};
  sorted.forEach(function (item) {
    var source = item.source || "Unknown";
    if (!grouped[source]) grouped[source] = [];
    grouped[source].push(item);
  });
  var sources = Object.keys(grouped).sort(function (a, b) {
    return compareNews(grouped[a][0], grouped[b][0]);
  });
  for (var pass = 0; picked.length < limit && pass < perSourceLimit; pass += 1) {
    sources.forEach(function (source) {
      if (picked.length >= limit) return;
      if (grouped[source][pass]) picked.push(grouped[source][pass]);
    });
  }
  if (picked.length < limit) {
    sorted.forEach(function (item) {
      if (picked.indexOf(item) >= 0) return;
      picked.push(item);
    });
  }
  return picked.slice(0, limit);
}

function rotateTopCandidate(items, sectionOffset) {
  var slate = balancedNewsItems(items, 6, 1);
  if (!slate.length) return null;
  var dayNumber = Math.floor(Date.now() / 86400000);
  return slate[(dayNumber + sectionOffset) % slate.length];
}

async function fetchText(url) {
  var controller = new AbortController();
  var timeout = setTimeout(function () { controller.abort(); }, 9000);
  try {
    var response = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "MinistryDashboard/1.0" } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function getNetPassage(passage) {
  var key = String(passage || "").trim();
  if (!key) throw new Error("Bible passage is required");
  if (bibleCache[key] && Date.now() - bibleCache[key].time < 24 * 60 * 60 * 1000) return bibleCache[key].data;
  var url = "https://labs.bible.org/api/?passage=" + encodeURIComponent(key) + "&type=json&formatting=plain";
  var raw = await fetchText(url);
  var items = JSON.parse(raw);
  var text = Array.isArray(items)
    ? items.map(function (item) { return stripTags(item.text || ""); }).join(" ").replace(/\s+/g, " ").trim()
    : stripTags(raw).replace(/\s+/g, " ").trim();
  var data = { translation: "NET", passage: key, text: text, source: "NET Bible API" };
  bibleCache[key] = { time: Date.now(), data: data };
  return data;
}

async function getNews(selectedSources) {
  var cacheKey = JSON.stringify(selectedSources || {});
  if (newsCache.data && newsCache.key === cacheKey && Date.now() - newsCache.time < 5 * 60 * 1000) return newsCache.data;
  var result = { world: [], philippines: [], theology: [], generatedAt: new Date().toISOString(), errors: [] };
  await Promise.all(Object.keys(NEWS_FEEDS).map(async function (section) {
    var feeds = feedsForSection(section, selectedSources);
    var settled = await Promise.allSettled(feeds.map(async function (feed) {
      var xml = await fetchText(feed.url);
      return parseFeed(xml, feed);
    }));
    settled.forEach(function (entry, index) {
      if (entry.status === "fulfilled") result[section] = result[section].concat(entry.value);
      else result.errors.push({ section: section, source: feeds[index].source, message: entry.reason.message });
    });
    result[section].sort(compareNews);
  }));
  var theologySourceCount = Object.keys(result.theology.reduce(function (sources, item) {
    sources[item.source] = true;
    return sources;
  }, {})).length;
  if (!result.theology.length || theologySourceCount < 4) {
    var theologySettled = await Promise.allSettled(THEOLOGY_PAGES.map(async function (page) {
      return parseHomepageLinks(await fetchText(page.url), page);
    }));
    theologySettled.forEach(function (entry, index) {
      if (entry.status === "fulfilled") result.theology = result.theology.concat(entry.value);
      else result.errors.push({ section: "theology", source: THEOLOGY_PAGES[index].source, message: entry.reason.message });
    });
    result.theology.sort(compareNews);
  }
  await Promise.all(Object.keys(NEWS_FEEDS).map(async function (section) {
    result[section] = await enrichSectionMedia(result[section]);
    result[section] = balancedNewsItems(result[section], 12, 2);
  }));
  result.top = {
    world: rotateTopCandidate(result.world, 0),
    philippines: rotateTopCandidate(result.philippines, 2),
    theology: rotateTopCandidate(result.theology, 4)
  };
  newsCache = { key: cacheKey, time: Date.now(), data: result };
  return result;
}

async function getLeagueNews(sport) {
  if (leagueNewsCache[sport] && Date.now() - leagueNewsCache[sport].time < 30 * 60 * 1000) return leagueNewsCache[sport].data;
  var feeds = SPORT_NEWS_FEEDS[sport] || [];
  var payload = { items: [], errors: [] };
  var settled = await Promise.allSettled(feeds.map(async function (feed) {
    var xml = await fetchText(feed.url);
    return parseFeed(xml, feed);
  }));
  settled.forEach(function (entry, index) {
    if (entry.status === "fulfilled") payload.items = payload.items.concat(entry.value);
    else payload.errors.push({ source: feeds[index].source, message: entry.reason.message });
  });
  payload.items = await enrichSectionMedia(payload.items);
  payload.items = balancedNewsItems(payload.items, 6, 2);
  leagueNewsCache[sport] = { time: Date.now(), data: payload };
  return payload;
}

function publicNewsSources() {
  var output = {};
  Object.keys(NEWS_FEEDS).forEach(function (section) {
    output[section] = NEWS_FEEDS[section].map(function (feed) {
      return { source: feed.source, url: feed.url };
    });
  });
  return output;
}

async function getCustomRss(feeds) {
  var normalized = (feeds || []).filter(function (feed) {
    return feed && /^https?:\/\//i.test(feed.url || "");
  }).slice(0, 10).map(function (feed, index) {
    return {
      source: String(feed.name || feed.url || "RSS Feed").slice(0, 80),
      url: String(feed.url || ""),
      priority: index + 1
    };
  });
  var key = JSON.stringify(normalized);
  if (customRssCache[key] && Date.now() - customRssCache[key].time < 30 * 60 * 1000) return customRssCache[key].data;
  var payload = { items: [], errors: [], generatedAt: new Date().toISOString() };
  var settled = await Promise.allSettled(normalized.map(async function (feed) {
    return parseFeed(await fetchText(feed.url), feed);
  }));
  settled.forEach(function (entry, index) {
    if (entry.status === "fulfilled") payload.items = payload.items.concat(entry.value);
    else payload.errors.push({ source: normalized[index].source, message: entry.reason.message });
  });
  payload.items = await enrichSectionMedia(payload.items);
  payload.items = uniqueNewsItems(payload.items).sort(compareNews).slice(0, 120);
  customRssCache[key] = { time: Date.now(), data: payload };
  return payload;
}

function fieldAfterHeading(html, heading) {
  var re = new RegExp("<h6[^>]*>\\s*" + heading + "\\s*<\\/h6>\\s*([\\s\\S]*?)(?:<hr|<h6|<\\/div>\\s*<hr)", "i");
  var match = html.match(re);
  if (!match) return "Not listed";
  var number = match[1].match(/data-number=["']([^"']+)["']/i);
  if (number) return Number(number[1]).toLocaleString("en-US");
  return stripTags(match[1]) || "Not listed";
}

function extractPrayerPoints(html, countryName) {
  var marker = "How can you pray for " + countryName;
  var index = html.indexOf(marker);
  if (index < 0) index = html.indexOf("How can you pray");
  if (index < 0) return [];
  var chunk = html.slice(index, index + 4000);
  var list = chunk.match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
  if (!list) return [];
  return (list[1].match(/<li[^>]*>[\s\S]*?<\/li>/gi) || []).map(stripTags).filter(Boolean).slice(0, 3);
}

function dailyWatchCountry() {
  var stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  var seed = Number(stamp);
  var index = (seed * 17 + 11) % WORLD_WATCH_COUNTRIES.length;
  return WORLD_WATCH_COUNTRIES[index];
}

function countryFlagCode(countryName) {
  var codes = {
    "North Korea": "kp",
    "Somalia": "so",
    "Yemen": "ye",
    "Libya": "ly",
    "Sudan": "sd",
    "Eritrea": "er",
    "Nigeria": "ng",
    "Pakistan": "pk",
    "Iran": "ir",
    "Afghanistan": "af",
    "India": "in",
    "Syria": "sy",
    "Saudi Arabia": "sa",
    "Myanmar": "mm",
    "Maldives": "mv",
    "China": "cn",
    "Mali": "ml",
    "Iraq": "iq",
    "Algeria": "dz",
    "Mauritania": "mr"
  };
  return codes[countryName] || "";
}

function generalCountryFlagCode(countryName) {
  var codes = {
    "Afghanistan": "af", "Albania": "al", "Algeria": "dz", "Andorra": "ad", "Angola": "ao", "Argentina": "ar",
    "Armenia": "am", "Australia": "au", "Austria": "at", "Azerbaijan": "az", "Bahamas": "bs", "Bahrain": "bh",
    "Bangladesh": "bd", "Belarus": "by", "Belgium": "be", "Belize": "bz", "Benin": "bj", "Bhutan": "bt",
    "Bolivia": "bo", "Bosnia and Herzegovina": "ba", "Botswana": "bw", "Brazil": "br", "Brunei": "bn", "Bulgaria": "bg",
    "Burkina Faso": "bf", "Burundi": "bi", "Cambodia": "kh", "Cameroon": "cm", "Canada": "ca", "Chad": "td",
    "Chile": "cl", "China": "cn", "Colombia": "co", "Comoros": "km", "Congo": "cg", "Costa Rica": "cr",
    "Croatia": "hr", "Cuba": "cu", "Cyprus": "cy", "Czech Republic": "cz", "Denmark": "dk", "Djibouti": "dj",
    "Dominican Republic": "do", "Ecuador": "ec", "Egypt": "eg", "El Salvador": "sv", "Eritrea": "er", "Estonia": "ee",
    "Ethiopia": "et", "Finland": "fi", "France": "fr", "Gabon": "ga", "Gambia": "gm", "Georgia": "ge",
    "Germany": "de", "Ghana": "gh", "Greece": "gr", "Guatemala": "gt", "Guinea": "gn", "Haiti": "ht",
    "Honduras": "hn", "Hungary": "hu", "India": "in", "Indonesia": "id", "Iran": "ir", "Iraq": "iq",
    "Ireland": "ie", "Israel": "il", "Italy": "it", "Japan": "jp", "Jordan": "jo", "Kazakhstan": "kz",
    "Kenya": "ke", "Kuwait": "kw", "Kyrgyzstan": "kg", "Laos": "la", "Latvia": "lv", "Lebanon": "lb",
    "Liberia": "lr", "Libya": "ly", "Lithuania": "lt", "Madagascar": "mg", "Malawi": "mw", "Malaysia": "my",
    "Maldives": "mv", "Mali": "ml", "Mauritania": "mr", "Mexico": "mx", "Moldova": "md", "Mongolia": "mn",
    "Morocco": "ma", "Mozambique": "mz", "Myanmar": "mm", "Nepal": "np", "Netherlands": "nl", "Nicaragua": "ni",
    "Niger": "ne", "Nigeria": "ng", "North Korea": "kp", "Norway": "no", "Oman": "om", "Pakistan": "pk",
    "Panama": "pa", "Paraguay": "py", "Peru": "pe", "Philippines": "ph", "Poland": "pl", "Portugal": "pt",
    "Qatar": "qa", "Romania": "ro", "Russia": "ru", "Rwanda": "rw", "Saudi Arabia": "sa", "Senegal": "sn",
    "Serbia": "rs", "Sierra Leone": "sl", "Singapore": "sg", "Somalia": "so", "South Africa": "za", "South Korea": "kr",
    "Spain": "es", "Sri Lanka": "lk", "Sudan": "sd", "Sweden": "se", "Switzerland": "ch", "Syria": "sy",
    "Taiwan": "tw", "Tajikistan": "tj", "Tanzania": "tz", "Thailand": "th", "Tunisia": "tn", "Turkey": "tr",
    "Turkmenistan": "tm", "Uganda": "ug", "Ukraine": "ua", "United Arab Emirates": "ae", "United Kingdom": "gb",
    "United States": "us", "Uruguay": "uy", "Uzbekistan": "uz", "Venezuela": "ve", "Vietnam": "vn", "Yemen": "ye",
    "Zambia": "zm", "Zimbabwe": "zw"
  };
  return countryFlagCode(countryName) || codes[countryName] || "";
}

function highQualityFlag(countryName) {
  var code = generalCountryFlagCode(countryName);
  return code ? "https://flagcdn.com/w640/" + code + ".png" : "";
}

function tableValue(html, label) {
  var re = new RegExp("<td[^>]*>\\s*" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*:?\\s*<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>", "i");
  var match = html.match(re);
  return match ? stripTags(match[1]) : "";
}

async function getWorldWatch() {
  var dateKey = new Date().toISOString().slice(0, 10);
  if (worldWatchCache.key === dateKey && worldWatchCache.data) return worldWatchCache.data;
  var country = dailyWatchCountry();
  var flagCode = countryFlagCode(country.name);
  var url = "https://www.opendoors.org/en-US/persecution/countries/" + country.slug + "/";
  var data = {
    generatedAt: new Date().toISOString(),
    name: country.name,
    flag: country.flag,
    flagImage: flagCode ? "https://flagcdn.com/w320/" + flagCode + ".png" : "",
    rank: country.rank,
    url: url,
    image: "",
    christianPopulation: "Not listed",
    population: "Not listed",
    mainReligion: "Not listed",
    government: "Not listed",
    leader: "Not listed",
    prayerPoints: []
  };
  try {
    var html = await fetchText(url);
    var title = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    var rank = html.match(/<span[^>]+class=["'][^"']*wwl-country__ranking[^"']*["'][^>]*>\s*([^<]+)/i);
    var image = html.match(/<img[^>]+alt=["']featured-image["'][^>]+src=["']([^"']+)["']/i);
    data.name = title ? stripTags(title[1]) : data.name;
    data.rank = rank && /^\d+/.test(stripTags(rank[1])) ? stripTags(rank[1]).match(/\d+/)[0] : data.rank;
    data.image = image ? absoluteUrl(image[1], url) : "";
    data.christianPopulation = fieldAfterHeading(html, "Population of Christians");
    data.population = fieldAfterHeading(html, "Population");
    data.mainReligion = fieldAfterHeading(html, "Main Religion");
    data.government = fieldAfterHeading(html, "Government");
    data.leader = fieldAfterHeading(html, "Leader");
    data.prayerPoints = extractPrayerPoints(html, data.name);
  } catch (error) {
    data.error = error.message;
  }
  worldWatchCache = { key: dateKey, data: data };
  return data;
}

function firstHeadingText(html) {
  var match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  return match ? stripTags(match[1]) : "";
}

function paragraphsNearFirstHeading(html, maxCount) {
  var heading = html.search(/<h1[^>]*>[\s\S]*?<\/h1>/i);
  var chunk = heading >= 0 ? html.slice(heading, heading + 9000) : html.slice(0, 9000);
  return (chunk.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [])
    .map(stripTags)
    .filter(function (text) { return text && text.length > 35; })
    .slice(0, maxCount || 4);
}

function countryFromTitle(title) {
  var clean = stripTags(title).replace(/\s+/g, " ").trim();
  var parts = clean.split(/\s+[-|]\s+|:\s+/);
  return (parts[0] || clean).replace(/^(Pray for|Prayer for|Today:?)/i, "").trim();
}

async function getOperationWorldPrayer() {
  var url = "https://operationworld.org/prayer-resources/today/";
  var data = {
    source: "Operation World",
    country: "Prayer Calendar",
    name: "Prayer Calendar",
    summary: "Operation World prayer focus is not listed yet.",
    prayerPoints: [],
    flagImage: "",
    url: url
  };
  try {
    var html = await fetchText(url);
    var redirect = html.match(/window\.location\s*=\s*["']([^"']+)["']/i) || html.match(/url=([^"'>]+)/i);
    if (redirect) {
      url = absoluteUrl(redirect[1], "https://operationworld.org");
      html = await fetchText(url);
    }
    var title = firstHeadingText(html) || metaContent(html, "og:title") || "Operation World";
    var countryMatch = title.match(/Pray for:\s*([^,\n]+)/i);
    var country = countryMatch ? countryMatch[1].trim() : countryFromTitle(title);
    var prayBlock = html.match(/<h2[^>]*>\s*Pray today\s*<\/h2>[\s\S]*?<div class=["'][^"']*card-body[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    var paragraphs = prayBlock
      ? (prayBlock[1].match(/<p[^>]*>[\s\S]*?<\/p>/gi) || []).map(stripTags).filter(Boolean)
      : paragraphsNearFirstHeading(html, 4);
    var flag = html.match(/<img[^>]+class=["'][^"']*the-flag_img[^"']*["'][^>]+src=["']([^"']+)["']/i);
    data.country = country || data.country;
    data.name = title;
    data.summary = paragraphs[0] || stripTags(metaContent(html, "og:description")) || data.summary;
    data.prayerPoints = paragraphs.slice(0, 3);
    data.flagImage = flag ? absoluteUrl(flag[1], url) : highQualityFlag(data.country);
    data.url = url;
  } catch (error) {
    data.error = error.message;
  }
  return data;
}

async function getJoshuaProjectPrayer() {
  var url = "https://joshuaproject.net/pray/unreachedoftheday/today";
  var data = {
    source: "Joshua Project",
    name: "Unreached of the Day",
    country: "",
    peopleGroup: "",
    summary: "Joshua Project unreached people focus is not listed yet.",
    prayerPoints: [],
    flagImage: "",
    url: url
  };
  try {
    var html = await fetchText(url);
    var prayFor = html.match(/<div class=["']pray-for["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
    var photo = html.match(/<div class=["']profile_image["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
    var prayerFocus = html.match(/<h4>\s*Prayer Focus\s*<\/h4>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
    var intro = html.match(/<div class=["']profile-text["'][^>]*>[\s\S]*?<h4>[\s\S]*?<\/h4>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
    data.name = prayFor ? stripTags(prayFor[1]) : "Unreached of the Day";
    data.peopleGroup = data.name;
    data.country = tableValue(html, "Hub Country") || tableValue(html, "Country");
    data.summary = intro ? stripTags(intro[1]) : stripTags(metaContent(html, "og:description")) || data.summary;
    data.prayerPoints = prayerFocus ? [stripTags(prayerFocus[1])] : [];
    data.flagImage = highQualityFlag(data.country);
    data.image = photo ? absoluteUrl(photo[1], url) : "";
    data.url = url;
  } catch (error) {
    data.error = error.message;
  }
  return data;
}

async function getMissions() {
  var dateKey = new Date().toISOString().slice(0, 10);
  if (missionsCache.key === dateKey && missionsCache.data) return missionsCache.data;
  var settled = await Promise.allSettled([getOperationWorldPrayer(), getJoshuaProjectPrayer()]);
  var data = {
    generatedAt: new Date().toISOString(),
    operation: settled[0].status === "fulfilled" ? settled[0].value : { source: "Operation World", country: "Prayer Calendar", summary: "Operation World could not be loaded yet.", url: "https://operationworld.org/prayer-resources/today/" },
    joshua: settled[1].status === "fulfilled" ? settled[1].value : { source: "Joshua Project", name: "Unreached of the Day", summary: "Joshua Project could not be loaded yet.", url: "https://joshuaproject.net/pray/unreachedoftheday" }
  };
  missionsCache = { key: dateKey, data: data };
  return data;
}

function dailyVocabulary() {
  var dayNumber = Math.floor(Date.now() / 86400000);
  return {
    greek: Object.assign({ source: "MorphGNT / SBLGNT curated cache" }, LANGUAGE_VOCABULARY.greek[dayNumber % LANGUAGE_VOCABULARY.greek.length]),
    hebrew: Object.assign({ source: "Open Scriptures Hebrew Bible curated cache" }, LANGUAGE_VOCABULARY.hebrew[dayNumber % LANGUAGE_VOCABULARY.hebrew.length])
  };
}

function youtubeVideoIdFromUrl(url) {
  var text = String(url || "");
  var patterns = [
    /[?&]v=([a-zA-Z0-9_-]{6,})/,
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /\/shorts\/([a-zA-Z0-9_-]{6,})/,
    /\/embed\/([a-zA-Z0-9_-]{6,})/
  ];
  for (var i = 0; i < patterns.length; i += 1) {
    var match = text.match(patterns[i]);
    if (match) return match[1];
  }
  return "";
}

async function resolveYouTubeChannelId(handle) {
  var html = await fetchText("https://www.youtube.com/@" + handle);
  var patterns = [
    /"channelId"\s*:\s*"([^"]+)"/,
    /"externalId"\s*:\s*"([^"]+)"/,
    /\/channel\/(UC[a-zA-Z0-9_-]+)/
  ];
  for (var i = 0; i < patterns.length; i += 1) {
    var match = html.match(patterns[i]);
    if (match) return match[1];
  }
  throw new Error("Could not resolve YouTube channel for " + handle);
}

function parseYouTubeFeed(xml, config) {
  var blocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  return blocks.slice(0, 7).map(function (block, index) {
    var title = stripTags(tag(block, "title"));
    var link = attr(block, "link", "href") || tag(block, "link");
    var videoId = tag(block, "yt:videoId") || youtubeVideoIdFromUrl(link);
    var published = tag(block, "published") || tag(block, "updated");
    var image = attr(block, "media:thumbnail", "url") || (videoId ? "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg" : "");
    return {
      id: videoId || config.source.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + index,
      title: title || "Untitled video",
      url: absoluteUrl(link, "https://www.youtube.com/"),
      videoId: videoId,
      embedUrl: videoId ? "https://www.youtube.com/embed/" + videoId : "",
      image: image,
      publishedAt: published,
      publishedTime: Date.parse(published) || 0
    };
  }).filter(function (item) { return item.videoId || item.url; });
}

async function getLanguageFeed(key) {
  var config = LANGUAGE_VIDEO_FEEDS[key];
  if (!config) return { source: key, url: "", items: [] };
  try {
    var channelId = config.channelId || await resolveYouTubeChannelId(config.handle);
    var xml = await fetchText("https://www.youtube.com/feeds/videos.xml?channel_id=" + encodeURIComponent(channelId));
    return {
      source: config.source,
      url: config.url,
      channelId: channelId,
      items: parseYouTubeFeed(xml, config)
    };
  } catch (error) {
    return {
      source: config.source,
      url: config.url,
      error: error.message,
      items: []
    };
  }
}

async function getLanguages() {
  if (languageCache.data && Date.now() - languageCache.time < 30 * 60 * 1000) return languageCache.data;
  var settled = await Promise.allSettled([getLanguageFeed("greek"), getLanguageFeed("hebrew"), getLanguageFeed("septuagint")]);
  var data = {
    vocabulary: dailyVocabulary(),
    videos: {
      greek: settled[0].status === "fulfilled" ? settled[0].value : { source: "Daily Dose of Greek", items: [] },
      hebrew: settled[1].status === "fulfilled" ? settled[1].value : { source: "Daily Dose of Hebrew", items: [] },
      septuagint: settled[2].status === "fulfilled" ? settled[2].value : { source: "Daily Dose of Septuagint", items: [] }
    }
  };
  languageCache = { time: Date.now(), data: data };
  return data;
}

async function fetchJson(url) {
  var controller = new AbortController();
  var timeout = setTimeout(function () { controller.abort(); }, 15000);
  try {
    var response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function serverISODate(date) {
  var year = date.getFullYear();
  var month = String(date.getMonth() + 1).padStart(2, "0");
  var day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function serverTime(date) {
  return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
}

function addServerDays(value, days) {
  var date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function inclusiveAllDayEnd(exclusiveEnd) {
  if (!exclusiveEnd) return "";
  return serverISODate(addServerDays(exclusiveEnd + "T00:00:00", -1));
}

function timeSlotForDate(date) {
  var hour = date.getHours();
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

function normalizeGoogleCalendarEvent(item) {
  var allDay = Boolean(item.start && item.start.date);
  var startDateTime = allDay ? null : new Date(item.start.dateTime);
  var startDate = allDay ? item.start.date : serverISODate(new Date(item.start.dateTime));
  var endDate = allDay ? inclusiveAllDayEnd(item.end && item.end.date) : serverISODate(new Date(item.end.dateTime || item.start.dateTime));
  var startTime = allDay ? "" : serverTime(startDateTime);
  var endTime = allDay ? "" : serverTime(new Date(item.end.dateTime || item.start.dateTime));
  return {
    id: "google:" + item.id,
    googleEventId: item.id,
    type: "Google Calendar",
    passage: "",
    title: item.summary || "(No title)",
    start: startDate,
    end: endDate || startDate,
    timeSlot: allDay ? "All Day" : timeSlotForDate(startDateTime),
    timeStart: startTime,
    timeEnd: endTime,
    allDay: allDay,
    location: item.location || "",
    notes: item.description || "",
    image: "",
    checklist: [],
    source: "google",
    readOnly: true,
    htmlLink: item.htmlLink || "",
    updatedAt: item.updated || "",
    recurrence: item.recurrence || [],
    googleRecurringEventId: item.recurringEventId || "",
    repeatRule: googleRepeatRule(item.recurrence || []),
    recurring: Boolean(item.recurringEventId || (item.recurrence || []).length),
    status: item.status || ""
  };
}

function googleRepeatRule(recurrence) {
  var ruleText = (recurrence || []).find(function (rule) { return /^RRULE:/i.test(rule); }) || "";
  if (!ruleText) return { frequency: "none", interval: 1, unit: "week", endMode: "never", endDate: "" };
  var parts = ruleText.replace(/^RRULE:/i, "").split(";").reduce(function (result, part) {
    var pair = part.split("=");
    result[pair[0]] = pair[1];
    return result;
  }, {});
  var freq = String(parts.FREQ || "").toUpperCase();
  var frequency = freq === "DAILY" ? "daily" : freq === "WEEKLY" ? "weekly" : freq === "MONTHLY" ? "monthly" : freq === "YEARLY" ? "yearly" : "none";
  var endDate = "";
  if (parts.UNTIL && /^\d{8}/.test(parts.UNTIL)) {
    endDate = parts.UNTIL.slice(0, 4) + "-" + parts.UNTIL.slice(4, 6) + "-" + parts.UNTIL.slice(6, 8);
  }
  return {
    frequency: frequency,
    interval: Math.max(1, Number(parts.INTERVAL || 1)),
    unit: "week",
    endMode: endDate ? "on" : "never",
    endDate: endDate
  };
}

function googleDateTimeForEvent(event, field) {
  var date = field === "end" ? event.end || event.start : event.start;
  var time = field === "end" ? event.timeEnd : event.timeStart;
  if (!date) date = serverISODate(new Date());
  if (event.allDay || !time) return { date: date };
  return {
    dateTime: date + "T" + time + ":00",
    timeZone: process.env.TZ || "Asia/Manila"
  };
}

function googleExclusiveEndForEvent(event) {
  if (!(event.allDay || !event.timeStart)) {
    if (event.timeEnd) return googleDateTimeForEvent(event, "end");
    var fallbackEnd = new Date(event.start + "T" + event.timeStart + ":00");
    fallbackEnd.setHours(fallbackEnd.getHours() + 1);
    return {
      dateTime: serverISODate(fallbackEnd) + "T" + serverTime(fallbackEnd) + ":00",
      timeZone: process.env.TZ || "Asia/Manila"
    };
  }
  var date = event.end || event.start || serverISODate(new Date());
  return { date: serverISODate(addServerDays(date + "T00:00:00", 1)) };
}

function dashboardEventToGoogle(event) {
  var payload = {
    summary: event.title || event.type || "Dashboard event",
    location: event.location || "",
    description: event.notes || "",
    start: googleDateTimeForEvent(event, "start"),
    end: googleExclusiveEndForEvent(event)
  };
  var recurrence = googleRecurrenceForEvent(event);
  if (recurrence.length) payload.recurrence = recurrence;
  return payload;
}

function googleRecurrenceForEvent(event) {
  var rule = event && event.repeatRule ? event.repeatRule : null;
  if (!rule || rule.frequency === "none") return [];
  var frequency = rule.frequency;
  var interval = Math.max(1, Number(rule.interval || 1));
  var unit = rule.unit || "week";
  if (frequency === "custom") {
    frequency = unit === "day" ? "daily" : unit === "week" ? "weekly" : unit === "month" ? "monthly" : unit === "year" ? "yearly" : "weekly";
  }
  var freq = frequency === "daily" ? "DAILY" : frequency === "weekly" ? "WEEKLY" : frequency === "monthly" ? "MONTHLY" : frequency === "yearly" ? "YEARLY" : "";
  if (!freq) return [];
  var pieces = ["FREQ=" + freq, "INTERVAL=" + interval];
  if (rule.endMode === "on" && rule.endDate) {
    pieces.push("UNTIL=" + rule.endDate.replace(/-/g, "") + "T235959Z");
  }
  return ["RRULE:" + pieces.join(";")];
}

function googleCalendarStatusPayload() {
  var token = readGoogleCalendarToken();
  var config = getGoogleCalendarConfig();
  var tokenScopeText = token && token.scope ? String(token.scope) : "";
  var tokenScopes = tokenScopeText ? tokenScopeText.split(/\s+/).filter(Boolean) : [];
  var missingScopes = token ? GOOGLE_CALENDAR_SCOPES.filter(function (scope) { return tokenScopes.indexOf(scope) === -1; }) : [];
  var requiredCalendarScopes = GOOGLE_CALENDAR_SCOPES.filter(function (scope) {
    return scope.indexOf("https://www.googleapis.com/auth/calendar") === 0;
  });
  var missingCalendarScopes = token ? requiredCalendarScopes.filter(function (scope) { return tokenScopes.indexOf(scope) === -1; }) : [];
  return {
    configured: Boolean(config.clientId && config.clientSecret && config.redirectUri),
    connected: Boolean(token && token.refresh_token),
    redirectUri: defaultGoogleCalendarRedirectUri(),
    credentialSource: config.credentialSource || "",
    credentialFileLoaded: config.credentialSource === "secret-file",
    credentialFileError: config.credentialFileError || "",
    scopes: GOOGLE_CALENDAR_SCOPES,
    tokenScopes: tokenScopes,
    missingScopes: missingScopes,
    missingCalendarScopes: missingCalendarScopes,
    needsReconnect: Boolean(token && missingCalendarScopes.length),
    account: token && token.profile ? token.profile : null,
    connectedAt: token ? token.connected_at || "" : "",
    expiresAt: token && token.expires_at ? new Date(token.expires_at).toISOString() : ""
  };
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function handleGoogleCalendarConnect(res) {
  var config = getGoogleCalendarConfig();
  if (!config.clientId || !config.clientSecret) {
    return sendJson(res, 400, {
      ok: false,
      error: "Google Calendar OAuth is not configured.",
      redirectUri: config.redirectUri
    });
  }
  var state = crypto.randomBytes(24).toString("hex");
  saveGoogleCalendarOauthState(state);
  var url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  redirect(res, url.toString());
}

async function handleGoogleCalendarCallback(url, res) {
  if (url.searchParams.get("error")) {
    return redirect(res, "/?googleCalendar=denied");
  }
  var code = url.searchParams.get("code");
  var state = url.searchParams.get("state");
  if (!code || !consumeGoogleCalendarOauthState(state)) {
    return redirect(res, "/?googleCalendar=invalid");
  }
  await exchangeGoogleCalendarCode(code);
  redirect(res, "/?googleCalendar=connected");
}

async function handleGoogleCalendarEvents(url, res) {
  if (!googleCalendarConfigured()) {
    return sendJson(res, 200, { ok: false, configured: false, connected: false, events: [] });
  }
  var timeMin = url.searchParams.get("timeMin") || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  var timeMax = url.searchParams.get("timeMax") || new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString();
  var query = new URLSearchParams({
    timeMin: timeMin,
    timeMax: timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250"
  });
  var data = await googleCalendarRequest("/calendars/primary/events?" + query.toString());
  var events = (data.items || [])
    .filter(function (item) { return item.status !== "cancelled"; })
    .map(normalizeGoogleCalendarEvent);
  sendJson(res, 200, { ok: true, configured: true, connected: true, events: events });
}

async function handleGoogleCalendarUpsert(req, res) {
  var body = JSON.parse(await readRequestBody(req) || "{}");
  var event = body.event || body;
  if (!event || typeof event !== "object") return sendJson(res, 400, { ok: false, error: "Missing event payload." });
  var googleEventId = event.googleEventId || "";
  var payload = dashboardEventToGoogle(event);
  var data = googleEventId
    ? await googleCalendarRequest("/calendars/primary/events/" + encodeURIComponent(googleEventId), { method: "PATCH", body: JSON.stringify(payload) })
    : await googleCalendarRequest("/calendars/primary/events", { method: "POST", body: JSON.stringify(payload) });
  sendJson(res, 200, { ok: true, event: normalizeGoogleCalendarEvent(data) });
}

async function handleGoogleCalendarDelete(url, res) {
  var googleEventId = decodeURIComponent(url.pathname.replace(/^\/api\/google-calendar\/events\//, ""));
  if (!googleEventId) return sendJson(res, 400, { ok: false, error: "Missing Google event id." });
  await googleCalendarRequest("/calendars/primary/events/" + encodeURIComponent(googleEventId), { method: "DELETE" });
  sendJson(res, 200, { ok: true });
}

async function fetchApiFootball(route, params) {
  var apiSportsKey = getApiSportsKey();
  if (!apiSportsKey) throw new Error("API-SPORTS key is not set");
  var url = new URL(route, API_FOOTBALL_BASE);
  Object.keys(params || {}).forEach(function (key) {
    if (params[key] !== undefined && params[key] !== null && params[key] !== "") url.searchParams.set(key, params[key]);
  });
  var controller = new AbortController();
  var timeout = setTimeout(function () { controller.abort(); }, 9000);
  try {
    var response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "x-apisports-key": apiSportsKey,
        "User-Agent": "MinistryDashboard/1.0"
      }
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    var json = await response.json();
    if (json.errors && Object.keys(json.errors).length) throw new Error(apiErrorMessage(json.errors, "API-Football returned an error"));
    return json.response || [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchApiSports(base, route, params) {
  var apiSportsKey = getApiSportsKey();
  if (!apiSportsKey) throw new Error("API-SPORTS key is not set");
  var url = new URL(route, base);
  Object.keys(params || {}).forEach(function (key) {
    if (params[key] !== undefined && params[key] !== null && params[key] !== "") url.searchParams.set(key, params[key]);
  });
  var host = new URL(base).host;
  var controller = new AbortController();
  var timeout = setTimeout(function () { controller.abort(); }, 9000);
  try {
    var response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "x-apisports-key": apiSportsKey,
        "x-rapidapi-key": apiSportsKey,
        "x-rapidapi-host": host,
        "User-Agent": "MinistryDashboard/1.0"
      }
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    var json = await response.json();
    if (json.errors && Object.keys(json.errors).length) throw new Error(apiErrorMessage(json.errors, "API-SPORTS returned an error"));
    return json.response || [];
  } finally {
    clearTimeout(timeout);
  }
}

function formatMlbDate(date) {
  var formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
  return formatter.format(date);
}

function formatLeagueDate(date) {
  var formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
  return formatter.format(date);
}

function normalizeApiSportsGame(item, sport) {
  if (sport === "nba") {
    var nbaTeams = item.teams || {};
    var nbaScores = item.scores || {};
    var nbaStatus = item.status || {};
    var nbaPeriods = item.periods || {};
    var nbaPeriod = nbaStatus.short || nbaStatus.clock ? nbaStatus.short : "";
    if (!nbaPeriod && nbaPeriods.current) nbaPeriod = String(nbaPeriods.current) + "Q";
    return {
      id: item.id,
      name: (nbaTeams.visitors && nbaTeams.home) ? nbaTeams.visitors.name + " at " + nbaTeams.home.name : "",
      shortName: (nbaTeams.visitors && nbaTeams.home) ? nbaTeams.visitors.nickname + " at " + nbaTeams.home.nickname : "",
      date: item.date && (item.date.start || item.date),
      status: nbaStatus.long || nbaStatus.short || "Scheduled",
      statusDetail: nbaPeriod || "",
      clock: nbaStatus.clock || "",
      url: "https://www.nba.com/games",
      competitors: [
        { name: nbaTeams.visitors ? nbaTeams.visitors.name : "", abbreviation: nbaTeams.visitors ? nbaTeams.visitors.code : "", logo: nbaTeams.visitors ? nbaTeams.visitors.logo : "", score: nbaScores.visitors && nbaScores.visitors.points !== null ? String(nbaScores.visitors.points) : "-", homeAway: "away" },
        { name: nbaTeams.home ? nbaTeams.home.name : "", abbreviation: nbaTeams.home ? nbaTeams.home.code : "", logo: nbaTeams.home ? nbaTeams.home.logo : "", score: nbaScores.home && nbaScores.home.points !== null ? String(nbaScores.home.points) : "-", homeAway: "home" }
      ]
    };
  }
  var teams = item.teams || {};
  var scores = item.scores || {};
  var status = item.game && item.game.status ? item.game.status : item.status || {};
  return {
    id: item.game ? item.game.id : item.id,
    name: (teams.away && teams.home) ? teams.away.name + " at " + teams.home.name : "",
    shortName: (teams.away && teams.home) ? teams.away.name + " at " + teams.home.name : "",
    date: item.game && item.game.date ? item.game.date.date || item.game.date : item.date,
    status: status.long || status.short || "Scheduled",
    statusDetail: status.short || "",
    clock: status.timer || status.clock || "",
    url: "https://www.nfl.com/scores/",
    competitors: [
      { name: teams.away ? teams.away.name : "", abbreviation: teams.away ? teams.away.code || teams.away.name : "", logo: teams.away ? teams.away.logo : "", score: scores.away && scores.away.total !== null ? String(scores.away.total) : "-", homeAway: "away" },
      { name: teams.home ? teams.home.name : "", abbreviation: teams.home ? teams.home.code || teams.home.name : "", logo: teams.home ? teams.home.logo : "", score: scores.home && scores.home.total !== null ? String(scores.home.total) : "-", homeAway: "home" }
    ]
  };
}

function normalizeApiSportsStandings(rows, sport) {
  var groups = {};
  (rows || []).forEach(function (entry) {
    var team = entry.team || {};
    var conference = entry.conference || {};
    var division = entry.division || {};
    var rawGroup = sport === "nfl" ? (conference.name || conference || "Standings") : (conference.name || conference || division.name || "Standings");
    var groupName = String(rawGroup).toLowerCase();
    if (sport === "nba") groupName = groupName.indexOf("west") > -1 ? "West" : groupName.indexOf("east") > -1 ? "East" : rawGroup.toString();
    if (sport === "nfl") groupName = groupName.indexOf("american") > -1 || groupName === "afc" ? "AFC" : groupName.indexOf("national") > -1 || groupName === "nfc" ? "NFC" : rawGroup.toString();
    if (!groups[groupName]) groups[groupName] = [];
    var wins = entry.won !== undefined ? entry.won : entry.win && (entry.win.total !== undefined ? entry.win.total : entry.win);
    var losses = entry.lost !== undefined ? entry.lost : entry.loss && (entry.loss.total !== undefined ? entry.loss.total : entry.loss);
    var gb = entry.gamesBehind || entry.gamesBehindConference || entry.gamesBehindDivision || entry.gb || "-";
    groups[groupName].push({
      name: team.name || team.nickname || "",
      abbreviation: team.code || team.abbreviation || "",
      logo: team.logo || "",
      wins: wins !== undefined ? wins : "-",
      losses: losses !== undefined ? losses : "-",
      gb: gb === null || gb === undefined || gb === "" ? "-" : gb
    });
  });
  var order = sport === "nba" ? ["West", "East"] : sport === "nfl" ? ["AFC", "NFC"] : Object.keys(groups);
  return order.filter(function (name) { return groups[name]; }).map(function (name) {
    return { name: name, entries: groups[name] };
  });
}

async function getApiSportsLeague(sport, config) {
  var date = formatLeagueDate(new Date());
  var data = { sport: sport, label: config.label, priorityTeam: config.team, priorityTeamLabel: config.teamLabel, priorityGame: null, priorityGames: [], games: [], gamesByDay: { yesterday: [], today: [], tomorrow: [] }, standings: [], leagueNews: [], errors: [], provider: "API-SPORTS" };
  var favoriteWindowGames = [];
  try {
    var gamesRoute = sport === "nba" ? "/games" : "/games";
    var gamesParams = sport === "nba" ? { date: date } : { date: date };
    var games = await fetchApiSports(sport === "nba" ? API_NBA_BASE : API_NFL_BASE, gamesRoute, gamesParams);
    data.games = games.map(function (game) { return normalizeApiSportsGame(game, sport); });
    favoriteWindowGames = favoriteWindowGames.concat(data.games);
  } catch (error) {
    data.errors.push(config.label + " schedule: " + error.message);
  }
  try {
    var base = sport === "nba" ? API_NBA_BASE : API_NFL_BASE;
    var offsets = [];
    for (var past = -10; past <= 14; past += 1) offsets.push(past);
    var settled = await Promise.allSettled(offsets.map(async function (offset) {
      var day = formatLeagueDate(addDateDays(new Date(), offset));
      var games = await fetchApiSports(base, "/games", { date: day });
      return games.map(function (game) { return normalizeApiSportsGame(game, sport); });
    }));
    settled.forEach(function (entry) {
      if (entry.status === "fulfilled") favoriteWindowGames = favoriteWindowGames.concat(entry.value);
    });
    var favorite = attachFavoriteGameData({ label: config.teamLabel, team: config.team }, favoriteWindowGames, config.team);
    data.priorityGame = favorite.game;
    data.priorityGames = [favorite];
    data.latestGames = favoriteWindowGames.filter(isFinishedGame).sort(function (a, b) { return gameTime(b) - gameTime(a); }).slice(0, 8).map(enrichGameMetadata);
    data.gamesByDay = {
      yesterday: gamesForDate(favoriteWindowGames, addDateDays(new Date(), -1)),
      today: gamesForDate(favoriteWindowGames, new Date()),
      tomorrow: gamesForDate(favoriteWindowGames, addDateDays(new Date(), 1))
    };
  } catch (error) {
    data.errors.push(config.label + " favorite team: " + error.message);
    data.priorityGame = findPriority(data.games, config.team) || null;
  }
  try {
    var standingsResult = await withSeasonFallback(sport === "nba" ? NBA_SEASON : NFL_SEASON, [2024, 2023, 2022], async function (season) {
      var standingsParams = sport === "nba" ? { league: "standard", season: season } : { league: 1, season: season };
      return { season: season, rows: await fetchApiSports(sport === "nba" ? API_NBA_BASE : API_NFL_BASE, "/standings", standingsParams) };
    });
    data.standings = normalizeApiSportsStandings(standingsResult.rows, sport);
    if (standingsResult.fallbackSeason) data.errors.push(config.label + " standings using " + standingsResult.fallbackSeason + " because the free API-SPORTS plan blocked " + standingsResult.requestedSeason + ".");
  } catch (error) {
    data.errors.push(config.label + " standings: " + error.message);
  }
  try {
    var news = await getLeagueNews(sport);
    data.leagueNews = news.items;
    if (news.errors.length) data.errors = data.errors.concat(news.errors.map(function (item) { return item.source + " news: " + item.message; }));
  } catch (error) {
    data.errors.push(config.label + " news: " + error.message);
  }
  return data;
}

function mlbLogo(teamId) {
  return "https://www.mlbstatic.com/team-logos/" + teamId + ".svg";
}

function normalizeMlbGame(game) {
  var teams = game.teams || {};
  var away = teams.away || {};
  var home = teams.home || {};
  var awayTeam = away.team || {};
  var homeTeam = home.team || {};
  var status = game.status || {};
  var inningState = game.linescore && game.linescore.inningState ? game.linescore.inningState : "";
  var inning = game.linescore && game.linescore.currentInningOrdinal ? game.linescore.currentInningOrdinal : "";
  var compactInningState = { Top: "Top", Middle: "Mid", Bottom: "Bot" }[inningState] || inningState;
  var statusDetail = compactInningState && inning ? compactInningState + " " + inning : "";
  return {
    id: game.gamePk,
    name: awayTeam.name && homeTeam.name ? awayTeam.name + " at " + homeTeam.name : "",
    shortName: awayTeam.teamName && homeTeam.teamName ? awayTeam.teamName + " at " + homeTeam.teamName : game.gameDate || "",
    date: game.gameDate,
    status: status.detailedState || status.abstractGameState || "Scheduled",
    statusDetail: statusDetail,
    url: game.gamePk ? "https://www.mlb.com/gameday/" + game.gamePk : "https://www.mlb.com/scores",
    competitors: [
      { name: awayTeam.name || "", abbreviation: awayTeam.abbreviation || "", logo: awayTeam.id ? mlbLogo(awayTeam.id) : "", score: away.score === undefined ? "-" : String(away.score), homeAway: "away" },
      { name: homeTeam.name || "", abbreviation: homeTeam.abbreviation || "", logo: homeTeam.id ? mlbLogo(homeTeam.id) : "", score: home.score === undefined ? "-" : String(home.score), homeAway: "home" }
    ]
  };
}

function normalizeMlbStandings(data) {
  var divisionNames = {
    201: "AL East",
    202: "AL Central",
    200: "AL West",
    204: "NL East",
    205: "NL Central",
    203: "NL West"
  };
  var groups = (data.records || []).map(function (record) {
    var divisionId = record.division && record.division.id;
    return {
      id: divisionId,
      name: divisionNames[divisionId] || (record.division && record.division.name ? record.division.name : "Standings"),
      entries: (record.teamRecords || []).slice(0, 12).map(function (entry) {
        var team = entry.team || {};
        return {
          name: team.name || "",
          logo: team.id ? mlbLogo(team.id) : "",
          wins: entry.wins !== undefined ? entry.wins : "-",
          losses: entry.losses !== undefined ? entry.losses : "-",
          gb: entry.gamesBack === "-" ? "0" : entry.gamesBack || "-"
        };
      })
    };
  });
  var order = [201, 202, 200, 204, 205, 203];
  return order.map(function (id) {
    return groups.find(function (group) { return group.id === id; });
  }).filter(Boolean);
}

async function getMlb() {
  var today = formatMlbDate(new Date());
  var season = new Date().getFullYear();
  var data = { sport: "mlb", label: "MLB", priorityTeam: "Yankees", priorityTeamLabel: "New York Yankees", priorityGame: null, priorityGames: [], games: [], gamesByDay: { yesterday: [], today: [], tomorrow: [] }, standings: [], leagueNews: [], errors: [] };
  var favoriteWindowGames = [];
  try {
    async function fetchMlbSchedule(params) {
      params.hydrate = params.hydrate || "linescore";
      var query = Object.keys(params).map(function (key) {
        return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
      }).join("&");
      var schedule = await fetchJson("https://statsapi.mlb.com/api/v1/schedule?" + query);
      return (schedule.dates || []).flatMap(function (day) { return day.games || []; }).map(normalizeMlbGame);
    }
    var dayResults = await Promise.allSettled([
      fetchMlbSchedule({ sportId: 1, date: formatMlbDate(addDateDays(new Date(), -1)) }),
      fetchMlbSchedule({ sportId: 1, date: today }),
      fetchMlbSchedule({ sportId: 1, date: formatMlbDate(addDateDays(new Date(), 1)) })
    ]);
    data.gamesByDay = {
      yesterday: dayResults[0].status === "fulfilled" ? dayResults[0].value : [],
      today: dayResults[1].status === "fulfilled" ? dayResults[1].value : [],
      tomorrow: dayResults[2].status === "fulfilled" ? dayResults[2].value : []
    };
    data.games = data.gamesByDay.today;
    favoriteWindowGames = favoriteWindowGames.concat(data.gamesByDay.yesterday, data.gamesByDay.today, data.gamesByDay.tomorrow);
    var startDate = formatMlbDate(addDateDays(new Date(), -10));
    var endDate = formatMlbDate(addDateDays(new Date(), 14));
    var teamRanges = await Promise.allSettled(SPORT_CONFIG.mlb.favoriteTeams.map(function (favorite) {
      return fetchMlbSchedule({ sportId: 1, teamId: favorite.teamId, startDate: startDate, endDate: endDate });
    }));
    teamRanges.forEach(function (entry) {
      if (entry.status === "fulfilled") favoriteWindowGames = favoriteWindowGames.concat(entry.value);
    });
    var seen = {};
    SPORT_CONFIG.mlb.favoriteTeams.forEach(function (favorite) {
      var item = attachFavoriteGameData({ label: favorite.label, team: favorite.name }, favoriteWindowGames, favorite.name);
      if (!item.game || seen[item.game.id]) return;
      seen[item.game.id] = true;
      data.priorityGames.push(item);
    });
    data.priorityGame = data.priorityGames[0] ? data.priorityGames[0].game : null;
    data.latestGames = favoriteWindowGames.filter(isFinishedGame).sort(function (a, b) { return gameTime(b) - gameTime(a); }).slice(0, 8).map(enrichGameMetadata);
    dayResults.forEach(function (entry, index) {
      if (entry.status === "rejected") data.errors.push(["MLB yesterday", "MLB today", "MLB tomorrow"][index] + ": " + entry.reason.message);
    });
  } catch (error) {
    data.errors.push("MLB schedule: " + error.message);
  }
  try {
    var standingsUrl = "https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=" + season + "&standingsTypes=regularSeason";
    data.standings = normalizeMlbStandings(await fetchJson(standingsUrl));
  } catch (error) {
    data.errors.push("MLB standings: " + error.message);
  }
  try {
    var news = await getLeagueNews("mlb");
    data.leagueNews = news.items;
    if (news.errors.length) data.errors = data.errors.concat(news.errors.map(function (item) { return item.source + " news: " + item.message; }));
  } catch (error) {
    data.errors.push("MLB news: " + error.message);
  }
  return data;
}

function normalizeCompetitor(item) {
  var team = item.team || {};
  return {
    name: team.displayName || team.shortDisplayName || team.name || "",
    abbreviation: team.abbreviation || "",
    logo: team.logo || (team.logos && team.logos[0] && team.logos[0].href) || "",
    score: item.score || "0",
    homeAway: item.homeAway || ""
  };
}

function normalizeEvent(event) {
  var competition = event.competitions && event.competitions[0];
  var competitors = competition && competition.competitors ? competition.competitors.map(normalizeCompetitor) : [];
  var statusType = event.status && event.status.type ? event.status.type : {};
  return {
    id: event.id,
    name: event.name || event.shortName || "",
    shortName: event.shortName || event.name || "",
    date: event.date,
    status: statusType.shortDetail || statusType.description || "",
    statusDetail: statusType.detail || statusType.shortDetail || "",
    clock: event.status && event.status.displayClock ? event.status.displayClock : "",
    competitors: competitors
  };
}

function findPriority(events, teamName) {
  var lower = teamName.toLowerCase();
  return events.find(function (event) {
    return event.competitors.some(function (team) {
      return (team.name + " " + team.abbreviation).toLowerCase().indexOf(lower) > -1;
    });
  }) || null;
}

function addDateDays(date, amount) {
  var copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function gameTime(game) {
  var time = game && game.date ? new Date(game.date).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function isFinishedGame(game) {
  return /final|finished|full time|game finished|completed/i.test(game && game.status ? game.status : "");
}

function isScheduledGame(game) {
  return /scheduled|not started|pre-game|preview|time tbd/i.test(game && game.status ? game.status : "");
}

function enrichGameMetadata(game) {
  if (!game) return null;
  var copy = Object.assign({}, game);
  copy.resultDate = game.date ? formatDisplayDate(game.date) : "";
  return copy;
}

function gamesForDate(games, date) {
  var target = formatLeagueDate(date);
  return (games || []).filter(function (game) {
    if (!game || !game.date) return false;
    return formatLeagueDate(new Date(game.date)) === target;
  }).map(enrichGameMetadata);
}

function attachFavoriteGameData(item, games, teamName) {
  var teamGames = games.filter(function (game) {
    return !!findPriority([game], teamName);
  }).sort(function (a, b) { return gameTime(a) - gameTime(b); });
  var now = Date.now();
  var current = teamGames.find(function (game) { return !isFinishedGame(game) && !isScheduledGame(game); }) || teamGames.find(function (game) {
    var diff = Math.abs(gameTime(game) - now);
    return diff < 6 * 60 * 60 * 1000 && !isFinishedGame(game);
  }) || null;
  var latest = teamGames.filter(isFinishedGame).sort(function (a, b) { return gameTime(b) - gameTime(a); })[0] || null;
  var next = teamGames.filter(function (game) { return gameTime(game) >= now && !isFinishedGame(game); }).sort(function (a, b) { return gameTime(a) - gameTime(b); })[0] || null;
  item.game = enrichGameMetadata(current || latest || next || null);
  item.latestGame = enrichGameMetadata(latest);
  item.nextGame = enrichGameMetadata(next);
  item.displayKind = current ? "current" : latest ? "result" : next ? "upcoming" : "none";
  if (item.game && item.displayKind === "result") item.game.displayLabel = "Game Results for " + (item.game.resultDate || "latest game");
  item.nextLabel = opponentLine(next, teamName);
  return item;
}

function formatDisplayDate(value) {
  var date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function opponentLine(game, teamName) {
  if (!game || !game.competitors || game.competitors.length < 2) return "";
  var lower = teamName.toLowerCase();
  var mine = game.competitors.find(function (team) { return (team.name || "").toLowerCase().indexOf(lower) > -1; });
  var opponent = game.competitors.find(function (team) { return team !== mine; });
  if (!mine || !opponent) return "";
  return "Next: " + (mine.homeAway === "home" ? "vs. " : "@ ") + opponent.name;
}

function normalizeApiFootballFixture(item) {
  var home = item.teams && item.teams.home ? item.teams.home : {};
  var away = item.teams && item.teams.away ? item.teams.away : {};
  var goals = item.goals || {};
  var status = item.fixture && item.fixture.status ? item.fixture.status : {};
  var league = item.league || {};
  return {
    id: item.fixture && item.fixture.id,
    name: home.name && away.name ? home.name + " vs " + away.name : "",
    shortName: home.name && away.name ? home.name + " vs " + away.name : "",
    date: item.fixture && item.fixture.date,
    status: status.long || status.short || "Scheduled",
    round: league.round || "",
    league: league.name || "",
    competitors: [
      { name: home.name || "", abbreviation: "", logo: home.logo || "", score: goals.home === null || goals.home === undefined ? "-" : String(goals.home), homeAway: "home" },
      { name: away.name || "", abbreviation: "", logo: away.logo || "", score: goals.away === null || goals.away === undefined ? "-" : String(goals.away), homeAway: "away" }
    ]
  };
}

function normalizeApiFootballStandings(rows) {
  return (rows || []).slice(0, 10).map(function (row) {
    var team = row.team || {};
    var all = row.all || {};
    return {
      name: team.name || "",
      logo: team.logo || "",
      record: [row.rank ? "#" + row.rank : "", row.points !== undefined ? row.points + " pts" : "", all.played !== undefined ? all.played + " GP" : ""].filter(Boolean).join(" / ")
    };
  });
}

async function findApiFootballTeam(name) {
  var teams = await fetchApiFootball("/teams", { search: name });
  var lower = name.toLowerCase();
  return teams.find(function (item) {
    return item.team && item.team.name && item.team.name.toLowerCase() === lower;
  }) || teams.find(function (item) {
    return item.team && item.team.name && item.team.name.toLowerCase().indexOf(lower) > -1;
  }) || teams[0] || null;
}

async function findApiFootballLeague(search) {
  var leagues = await fetchApiFootball("/leagues", { search: search });
  var lower = search.toLowerCase();
  return leagues.find(function (item) {
    return item.league && item.league.name && item.league.name.toLowerCase() === lower;
  }) || leagues.find(function (item) {
    return item.league && item.league.name && item.league.name.toLowerCase().indexOf(lower) > -1;
  }) || leagues[0] || null;
}

async function getFootballTeamSlide(config) {
  var found = config.teamId ? { team: { id: config.teamId, name: config.team, logo: "" } } : await findApiFootballTeam(config.team);
  var team = found && found.team ? found.team : null;
  if (!team) throw new Error("Team not found");
  var today = formatLeagueDate(new Date());
  var requestedSeason = config.id === "brazil" ? WORLD_CUP_SEASON : DOMESTIC_FOOTBALL_SEASON;
  var result = await withSeasonFallback(requestedSeason, config.id === "brazil" ? [2024, 2023, 2022] : [2024, 2023, 2022], async function (season) {
    var todayGames = await fetchApiFootball("/fixtures", { team: team.id, season: season, date: today });
    return { season: season, games: todayGames.map(normalizeApiFootballFixture) };
  });
  var games = result.games;
  return {
    id: config.id,
    label: config.label,
    mode: config.mode,
    team: { name: team.name, logo: team.logo },
    priorityGame: games.find(function (game) { return game.date && game.date.indexOf(today) === 0; }) || games.find(function (game) { return game.status && !/match finished/i.test(game.status); }) || games[0] || null,
    games: games,
    standings: [],
    bracket: [],
    errors: result.fallbackSeason ? ["Using " + result.fallbackSeason + " because the free API-SPORTS plan blocked " + result.requestedSeason + "."] : []
  };
}

async function getFootballLeagueSlide(config) {
  var found = config.leagueId ? { league: { id: config.leagueId, name: config.label, logo: "" } } : await findApiFootballLeague(config.leagueSearch);
  var league = found && found.league ? found.league : null;
  if (!league) throw new Error("League not found");
  var season = config.season || DOMESTIC_FOOTBALL_SEASON;
  var slide = {
    id: config.id,
    label: config.label,
    mode: config.mode,
    league: { id: league.id, name: league.name, logo: league.logo },
    priorityGame: null,
    games: [],
    standings: [],
    bracket: [],
    errors: []
  };
  if (config.mode === "bracket") {
    var bracketResult = await withSeasonFallback(season, [2024, 2023, 2022], async function (activeSeason) {
      return { season: activeSeason, bracket: (await fetchApiFootball("/fixtures", { league: league.id, season: activeSeason })).map(normalizeApiFootballFixture) };
    });
    slide.bracket = bracketResult.bracket;
    if (bracketResult.fallbackSeason) slide.errors.push("Using " + bracketResult.fallbackSeason + " because the free API-SPORTS plan blocked " + bracketResult.requestedSeason + ".");
  } else if (config.mode === "worldCup") {
    var worldResult = await withSeasonFallback(season, [2022], async function (activeSeason) {
      var worldStandings = await fetchApiFootball("/standings", { league: league.id, season: activeSeason });
      var worldFixtures = await fetchApiFootball("/fixtures", { league: league.id, season: activeSeason });
      return {
        season: activeSeason,
        standings: normalizeApiFootballStandings(worldStandings[0] && worldStandings[0].league && worldStandings[0].league.standings ? worldStandings[0].league.standings.flat() : []),
        bracket: worldFixtures.map(normalizeApiFootballFixture)
      };
    });
    slide.standings = worldResult.standings;
    slide.bracket = worldResult.bracket;
    if (worldResult.fallbackSeason) slide.errors.push("Using " + worldResult.fallbackSeason + " because the free API-SPORTS plan blocked " + worldResult.requestedSeason + ".");
  } else {
    var standingsResult = await withSeasonFallback(season, [2024, 2023, 2022], async function (activeSeason) {
      var standings = await fetchApiFootball("/standings", { league: league.id, season: activeSeason });
      var games = await fetchApiFootball("/fixtures", { league: league.id, season: activeSeason, next: 4 });
      return {
        season: activeSeason,
        standings: normalizeApiFootballStandings(standings[0] && standings[0].league && standings[0].league.standings ? standings[0].league.standings[0] : []),
        games: games.map(normalizeApiFootballFixture)
      };
    });
    slide.standings = standingsResult.standings;
    slide.games = standingsResult.games;
    if (standingsResult.fallbackSeason) slide.errors.push("Using " + standingsResult.fallbackSeason + " because the free API-SPORTS plan blocked " + standingsResult.requestedSeason + ".");
  }
  slide.priorityGame = slide.games[0] || slide.bracket[0] || null;
  return slide;
}

function normalizeStandings(data) {
  var groups = [];
  function walk(node, name) {
    if (!node) return;
    if (node.standings && node.standings.entries) {
      groups.push({
        name: node.name || node.displayName || name || "Standings",
        entries: node.standings.entries.slice(0, 12).map(function (entry) {
          var team = entry.team || {};
          return {
            name: team.displayName || team.shortDisplayName || team.name || "",
            logo: team.logo || (team.logos && team.logos[0] && team.logos[0].href) || "",
            record: entry.stats && entry.stats[0] ? entry.stats[0].displayValue : entry.summary || ""
          };
        })
      });
    }
    (node.children || []).forEach(function (child) { walk(child, node.name || node.displayName); });
  }
  if (data.children) data.children.forEach(function (child) { walk(child); });
  if (!groups.length && data.standings && data.standings.entries) walk(data, "Standings");
  return groups;
}

async function getSport(sport) {
  if (sportsCache[sport] && Date.now() - sportsCache[sport].time < 2 * 60 * 1000) return sportsCache[sport].data;
  if (sport === "football") return getFootball();
  if (sport === "mlb") {
    var mlbData = await getMlb();
    sportsCache.mlb = { time: Date.now(), data: mlbData };
    return mlbData;
  }
  var config = SPORT_CONFIG[sport] || SPORT_CONFIG.nba;
  if (sport === "nba" || sport === "nfl") {
    var apiSportsData = await getApiSportsLeague(sport, config);
    sportsCache[sport] = { time: Date.now(), data: apiSportsData };
    return apiSportsData;
  }
  var data = { sport: sport, label: config.label, priorityTeam: config.team, priorityTeamLabel: config.teamLabel, priorityGame: null, games: [], standings: [], errors: [] };
  try {
    var board = await fetchJson(config.scoreboard);
    data.games = (board.events || []).map(normalizeEvent);
    data.priorityGame = findPriority(data.games, config.team);
  } catch (error) {
    data.errors.push("Scoreboard: " + error.message);
  }
  try {
    data.standings = normalizeStandings(await fetchJson(config.standings));
  } catch (error) {
    data.errors.push("Standings: " + error.message);
  }
  sportsCache[sport] = { time: Date.now(), data: data };
  return data;
}

async function getFootball() {
  if (sportsCache.football && Date.now() - sportsCache.football.time < 2 * 60 * 1000) return sportsCache.football.data;
  var slides = [];
  var errors = [];
  for (var index = 0; index < FOOTBALL_CAROUSEL.length; index += 1) {
    var config = FOOTBALL_CAROUSEL[index];
    try {
      slides.push(config.mode === "team" ? await getFootballTeamSlide(config) : await getFootballLeagueSlide(config));
    } catch (error) {
      errors.push(config.label + ": " + error.message);
      slides.push({
        id: config.id,
        label: config.label,
        mode: config.mode,
        games: [],
        standings: [],
        bracket: [],
        errors: [error.message]
      });
    }
  }
  var data = { sport: "football", label: "Football", slides: slides, errors: errors, apiConfigured: Boolean(getApiSportsKey()) };
  sportsCache.football = { time: Date.now(), data: data };
  return data;
}

function readRequestBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on("data", function (chunk) {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 1024 * 32) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", function () { resolve(Buffer.concat(chunks).toString("utf8")); });
    req.on("error", reject);
  });
}

async function savePrivateSettings(req, res) {
  var body = await readRequestBody(req);
  var incoming = JSON.parse(body || "{}");
  var config = readPrivateConfig();
  var apiSportsKey = typeof incoming.apiSportsKey === "string" && incoming.apiSportsKey.trim() ? incoming.apiSportsKey.trim() : typeof incoming.apiFootballKey === "string" && incoming.apiFootballKey.trim() ? incoming.apiFootballKey.trim() : "";
  if (apiSportsKey) {
    config.apiSportsKey = apiSportsKey;
    config.apiFootballKey = apiSportsKey;
    sportsCache = {};
  }
  writePrivateConfig(config);
  sendJson(res, 200, {
    ok: true,
    apiSportsConfigured: Boolean(config.apiSportsKey || config.apiFootballKey),
    googleCalendarConfigured: googleCalendarConfigured(),
    googleCalendarRedirectUri: defaultGoogleCalendarRedirectUri()
  });
}

async function handleCustomRss(req, res) {
  var body = await readRequestBody(req);
  var incoming = JSON.parse(body || "{}");
  sendJson(res, 200, await getCustomRss(incoming.feeds || []));
}

function serveFile(req, res) {
  var rawPath = req.url.split("?")[0];
  var relative = rawPath === "/" ? "index.html" : decodeURIComponent(rawPath.replace(/^\//, ""));
  var filePath = path.join(ROOT, relative);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, function (error, data) {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    var type = ext === ".html" ? "text/html" : ext === ".css" ? "text/css" : ext === ".js" ? "application/javascript" : "text/plain";
    res.writeHead(200, { "Content-Type": type + "; charset=utf-8" });
    res.end(data);
  });
}

http.createServer(async function (req, res) {
  try {
    var url = new URL(req.url, "http://localhost:" + PORT);
    if (url.pathname === "/api/private-settings" && req.method === "POST") return savePrivateSettings(req, res);
    if (url.pathname === "/api/rss" && req.method === "POST") return handleCustomRss(req, res);
    if (url.pathname === "/api/google-calendar/status") return sendJson(res, 200, googleCalendarStatusPayload());
    if (url.pathname === "/api/google-calendar/connect") return handleGoogleCalendarConnect(res);
    if (url.pathname === "/api/google-calendar/oauth/callback") return handleGoogleCalendarCallback(url, res);
    if (url.pathname === "/api/google-calendar/disconnect" && req.method === "POST") {
      deleteGoogleCalendarToken();
      return sendJson(res, 200, { ok: true });
    }
    if (url.pathname === "/api/google-calendar/events" && req.method === "GET") return handleGoogleCalendarEvents(url, res);
    if (url.pathname === "/api/google-calendar/events" && req.method === "POST") return handleGoogleCalendarUpsert(req, res);
    if (url.pathname.indexOf("/api/google-calendar/events/") === 0 && req.method === "DELETE") return handleGoogleCalendarDelete(url, res);
    if (url.pathname === "/api/bible/net") return sendJson(res, 200, await getNetPassage(url.searchParams.get("passage")));
    if (url.pathname === "/api/news-sources") return sendJson(res, 200, publicNewsSources());
    if (url.pathname === "/api/news") return sendJson(res, 200, await getNews(sourceFilterFor(url)));
    if (url.pathname === "/api/article") return sendJson(res, 200, await getArticle(url.searchParams.get("url")));
    if (url.pathname === "/api/world-watch") return sendJson(res, 200, await getWorldWatch());
    if (url.pathname === "/api/missions") return sendJson(res, 200, await getMissions());
    if (url.pathname === "/api/languages") return sendJson(res, 200, await getLanguages());
    if (url.pathname.indexOf("/api/sports/") === 0) return sendJson(res, 200, await getSport(url.pathname.split("/").pop()));
    serveFile(req, res);
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message });
  }
}).listen(PORT, function () {
  console.log("Ministry Dashboard running at http://127.0.0.1:" + PORT + "/");
});
