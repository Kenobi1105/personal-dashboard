import { getAuthUser, json, optionsResponse, serviceRequest } from "../_shared/dashboard.ts";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

function config() {
  return {
    clientId: Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") || Deno.env.get("GOOGLE_CLIENT_ID") || "",
    clientSecret: Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") || Deno.env.get("GOOGLE_CLIENT_SECRET") || "",
    redirectUri: Deno.env.get("GOOGLE_CALENDAR_REDIRECT_URI") || "",
    appUrl: Deno.env.get("APP_URL") || "https://kenobi1105.github.io/personal-dashboard/",
  };
}

function addDays(value: string, amount: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function clock(date: Date) {
  return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
}

function timeSlot(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

function normalizeGoogleEvent(item: any, calendar: any = {}) {
  const allDay = Boolean(item.start?.date);
  const startDateTime = allDay ? null : new Date(item.start.dateTime);
  const start = allDay ? item.start.date : isoDate(startDateTime!);
  const end = allDay ? isoDate(addDays(item.end?.date + "T00:00:00", -1)) : isoDate(new Date(item.end?.dateTime || item.start?.dateTime));
  const calendarId = calendar.id || "primary";
  return {
    id: "google:" + calendarId + ":" + item.id,
    googleEventId: item.id,
    googleCalendarId: calendarId,
    googleCalendarName: calendar.summary || (calendar.primary ? "Primary" : "Google Calendar"),
    type: calendar.summary || "Google Calendar",
    passage: "",
    title: item.summary || "(No title)",
    start,
    end: end || start,
    timeSlot: allDay ? "All Day" : timeSlot(startDateTime!),
    timeStart: allDay ? "" : clock(startDateTime!),
    timeEnd: allDay ? "" : clock(new Date(item.end?.dateTime || item.start?.dateTime)),
    allDay,
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
    recurring: Boolean(item.recurringEventId || (item.recurrence || []).length),
    status: item.status || "",
  };
}

async function tokenRow(userId: string) {
  const response = await serviceRequest("/rest/v1/google_calendar_tokens?user_id=eq." + encodeURIComponent(userId) + "&select=*&limit=1");
  if (!response.ok) throw new Error(await response.text());
  const rows = await response.json();
  return rows[0] || null;
}

async function saveToken(userId: string, token: any, profile: any = {}) {
  const expiresAt = token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null;
  const existing = await tokenRow(userId).catch(() => null);
  const payload = {
    user_id: userId,
    access_token: token.access_token || existing?.access_token || "",
    refresh_token: token.refresh_token || existing?.refresh_token || "",
    expires_at: expiresAt || existing?.expires_at || null,
    scope: token.scope || existing?.scope || "",
    profile: Object.keys(profile || {}).length ? profile : existing?.profile || {},
    connected_at: existing?.connected_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const response = await serviceRequest("/rest/v1/google_calendar_tokens?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await response.text());
  return payload;
}

async function refreshToken(row: any) {
  const cfg = config();
  if (!row?.refresh_token) throw new Error("Google Calendar is not connected");
  if (row.expires_at && new Date(row.expires_at).getTime() - Date.now() > 60_000) return row.access_token;
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: row.refresh_token,
    grant_type: "refresh_token",
  });
  const response = await fetch(GOOGLE_TOKEN_URL, { method: "POST", body });
  const token = await response.json();
  if (!response.ok) throw new Error(token.error_description || token.error || "Token refresh failed");
  await saveToken(row.user_id, token);
  return token.access_token;
}

async function calendarRequest(userId: string, apiPath: string, init: RequestInit = {}) {
  const row = await tokenRow(userId);
  const accessToken = await refreshToken(row);
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", "Bearer " + accessToken);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(GOOGLE_CALENDAR_API + apiPath, { ...init, headers });
  if (response.status === 204) return {};
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || "Google Calendar request failed");
  return data;
}

async function visibleCalendars(userId: string) {
  const data = await calendarRequest(userId, "/users/me/calendarList?minAccessRole=reader&showDeleted=false&showHidden=false&maxResults=250");
  const calendars = (data.items || []).filter((calendar: any) => {
    if (!calendar?.id) return false;
    if (calendar.deleted || calendar.hidden) return false;
    return calendar.primary || calendar.selected !== false;
  });
  return calendars.length ? calendars : [{ id: "primary", summary: "Primary", primary: true }];
}

function googleDateTime(event: any, field: "start" | "end") {
  const date = field === "end" ? event.end || event.start : event.start;
  const time = field === "end" ? event.timeEnd : event.timeStart;
  if (event.allDay || !time) return { date };
  return { dateTime: date + "T" + time + ":00", timeZone: "Asia/Manila" };
}

function googleEnd(event: any) {
  if (event.allDay || !event.timeStart) return { date: isoDate(addDays((event.end || event.start) + "T00:00:00", 1)) };
  if (event.timeEnd) return googleDateTime(event, "end");
  const fallback = new Date(event.start + "T" + event.timeStart + ":00");
  fallback.setHours(fallback.getHours() + 1);
  return { dateTime: isoDate(fallback) + "T" + clock(fallback) + ":00", timeZone: "Asia/Manila" };
}

function recurrence(event: any) {
  const rule = event.repeatRule;
  if (!rule || rule.frequency === "none") return [];
  let frequency = rule.frequency;
  if (frequency === "custom") frequency = rule.unit === "day" ? "daily" : rule.unit === "week" ? "weekly" : rule.unit === "month" ? "monthly" : "yearly";
  const freq = frequency === "daily" ? "DAILY" : frequency === "weekly" ? "WEEKLY" : frequency === "monthly" ? "MONTHLY" : frequency === "yearly" ? "YEARLY" : "";
  if (!freq) return [];
  const pieces = ["FREQ=" + freq, "INTERVAL=" + Math.max(1, Number(rule.interval || 1))];
  if (rule.endMode === "on" && rule.endDate) pieces.push("UNTIL=" + rule.endDate.replace(/-/g, "") + "T235959Z");
  return ["RRULE:" + pieces.join(";")];
}

function googlePayload(event: any) {
  const payload: any = {
    summary: event.title || event.type || "Dashboard event",
    location: event.location || "",
    description: event.notes || "",
    start: googleDateTime(event, "start"),
    end: googleEnd(event),
  };
  const rules = recurrence(event);
  if (rules.length) payload.recurrence = rules;
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/google-calendar/, "") || "/";
  const cfg = config();

  if (path === "/callback") {
    const code = url.searchParams.get("code");
    const userId = url.searchParams.get("state");
    if (!code || !userId) return Response.redirect(cfg.appUrl + "?googleCalendar=invalid", 302);
    const body = new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      code,
      grant_type: "authorization_code",
    });
    const response = await fetch(GOOGLE_TOKEN_URL, { method: "POST", body });
    const token = await response.json();
    if (!response.ok) return Response.redirect(cfg.appUrl + "?googleCalendar=denied", 302);
    let profile = {};
    if (token.access_token) {
      profile = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: "Bearer " + token.access_token } }).then((r) => r.json()).catch(() => ({}));
    }
    await saveToken(userId, token, profile);
    return Response.redirect(cfg.appUrl + "?googleCalendar=connected", 302);
  }

  const user = await getAuthUser(req);
  if (!user?.id) return json({ error: "Sign in required", configured: Boolean(cfg.clientId && cfg.clientSecret && cfg.redirectUri), connected: false }, 401);

  if (path === "/status") {
    const row = await tokenRow(user.id).catch(() => null);
    return json({
      configured: Boolean(cfg.clientId && cfg.clientSecret && cfg.redirectUri),
      connected: Boolean(row?.refresh_token),
      redirectUri: cfg.redirectUri,
      account: row?.profile || null,
      connectedAt: row?.connected_at || "",
      needsReconnect: false,
    });
  }

  if (path === "/connect") {
    if (!cfg.clientId || !cfg.clientSecret || !cfg.redirectUri) return json({ error: "Google Calendar OAuth is not configured", configured: false }, 400);
    const authUrl = new URL(GOOGLE_AUTH_URL);
    authUrl.searchParams.set("client_id", cfg.clientId);
    authUrl.searchParams.set("redirect_uri", cfg.redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("state", user.id);
    return json({ authUrl: authUrl.toString(), configured: true });
  }

  if (path === "/disconnect" && req.method === "POST") {
    await serviceRequest("/rest/v1/google_calendar_tokens?user_id=eq." + encodeURIComponent(user.id), { method: "DELETE" });
    return json({ ok: true });
  }

  if (path === "/events" && req.method === "GET") {
    const params = new URLSearchParams({
      timeMin: url.searchParams.get("timeMin") || new Date(Date.now() - 7 * 86400000).toISOString(),
      timeMax: url.searchParams.get("timeMax") || new Date(Date.now() + 45 * 86400000).toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    const calendars = await visibleCalendars(user.id);
    const errors: string[] = [];
    const events: any[] = [];
    await Promise.all(calendars.map(async (calendar: any) => {
      try {
        const data = await calendarRequest(user.id, "/calendars/" + encodeURIComponent(calendar.id) + "/events?" + params.toString());
        (data.items || [])
          .filter((item: any) => item.status !== "cancelled")
          .forEach((item: any) => events.push(normalizeGoogleEvent(item, calendar)));
      } catch (error) {
        errors.push((calendar.summary || calendar.id) + ": " + (error instanceof Error ? error.message : String(error)));
      }
    }));
    events.sort((a, b) => String(a.start + (a.timeStart || "")).localeCompare(String(b.start + (b.timeStart || ""))));
    return json({ ok: true, configured: true, connected: true, calendarCount: calendars.length, errors, events });
  }

  if (path === "/events" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const event = body.event || body;
    const data = event.googleEventId
      ? await calendarRequest(user.id, "/calendars/primary/events/" + encodeURIComponent(event.googleEventId), { method: "PATCH", body: JSON.stringify(googlePayload(event)) })
      : await calendarRequest(user.id, "/calendars/primary/events", { method: "POST", body: JSON.stringify(googlePayload(event)) });
    return json({ ok: true, event: normalizeGoogleEvent(data) });
  }

  if (path.startsWith("/events/") && req.method === "DELETE") {
    const eventId = decodeURIComponent(path.replace(/^\/events\//, ""));
    await calendarRequest(user.id, "/calendars/primary/events/" + encodeURIComponent(eventId), { method: "DELETE" });
    return json({ ok: true });
  }

  return json({ error: "Not found" }, 404);
});
