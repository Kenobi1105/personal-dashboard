var STORAGE_KEY = "ministry-dashboard-state-v2";
var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var TIME_SLOTS = ["All Day", "Morning", "Afternoon", "Evening"];
var EVENT_COLORS = [
  { key: "plum", name: "Plum", value: "#493548", bg: "rgba(73, 53, 72, 0.13)" },
  { key: "gold", name: "Gold", value: "#D8A94D", bg: "rgba(240, 208, 143, 0.34)" },
  { key: "sage", name: "Sage", value: "#6F7D5C", bg: "rgba(111, 125, 92, 0.15)" },
  { key: "rose", name: "Rose", value: "#B85C5A", bg: "rgba(184, 92, 90, 0.14)" },
  { key: "blue", name: "Blue", value: "#4E647E", bg: "rgba(78, 100, 126, 0.14)" },
  { key: "green", name: "Green", value: "#4F7A65", bg: "rgba(79, 122, 101, 0.15)" }
];

var SUPABASE_URL = "https://txowrviwvulkuopmugfb.supabase.co";
var SUPABASE_PUBLISHABLE_KEY = "sb_publishable_r8EhucgXv5nSDisLvtwW5Q_LnqS454a";
var SUPABASE_FUNCTIONS_BASE = SUPABASE_URL + "/functions/v1";
var CLOUD_APP_URL = "https://kenobi1105.github.io/personal-dashboard/";
var isHostedDashboard = /github\.io$/i.test(window.location.hostname);
var cloudClient = null;
var cloudSession = null;
var cloudStateLoaded = false;
var cloudSaveTimer = null;
var cloudSaveInFlight = false;

function cloudAvailable() {
  return !!(window.supabase && SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

function apiUrl(path) {
  if (!isHostedDashboard || /^https?:\/\//i.test(path)) return path;
  var split = String(path).split("?");
  var pathname = split[0];
  var query = split[1] ? "?" + split.slice(1).join("?") : "";
  var routes = [
    ["/api/bible/net", "/bible-net"],
    ["/api/google-calendar", "/google-calendar"],
    ["/api/dashboard-sync", "/dashboard-sync"],
    ["/api/news-sources", "/news-sources"],
    ["/api/news", "/news"],
    ["/api/article", "/article"],
    ["/api/rss", "/rss"],
    ["/api/world-watch", "/world-watch"],
    ["/api/missions", "/missions"],
    ["/api/languages", "/languages"],
    ["/api/sports", "/sports"]
  ];
  for (var index = 0; index < routes.length; index += 1) {
    var route = routes[index];
    if (pathname.indexOf(route[0]) === 0) {
      return SUPABASE_FUNCTIONS_BASE + route[1] + pathname.slice(route[0].length) + query;
    }
  }
  return path;
}

async function dashboardFetch(path, options) {
  var target = apiUrl(path);
  var fetchOptions = Object.assign({}, options || {});
  fetchOptions.headers = Object.assign({}, fetchOptions.headers || {});
  if (isHostedDashboard && target.indexOf(SUPABASE_FUNCTIONS_BASE) === 0) {
    fetchOptions.headers.apikey = SUPABASE_PUBLISHABLE_KEY;
    fetchOptions.headers.Authorization = "Bearer " + (cloudSession && cloudSession.access_token ? cloudSession.access_token : SUPABASE_PUBLISHABLE_KEY);
  }
  return fetch(target, fetchOptions);
}

async function readDashboardJson(response, label) {
  var text = await response.text().catch(function () { return ""; });
  var payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (_error) {
      payload = null;
    }
  }
  if (!response.ok) {
    var detail = payload && payload.error ? payload.error : payload && payload.errors ? [].concat(payload.errors).join("; ") : text.slice(0, 160);
    throw new Error(label + " failed (" + response.status + ")" + (detail ? ": " + detail : "."));
  }
  return payload || {};
}

function hostedHint(functionName, error) {
  var message = error && error.message ? error.message : String(error || "Unknown error");
  if (!isHostedDashboard) return message;
  return functionName + " Edge Function did not return data. Check that deploy-supabase.bat finished, then confirm the required Supabase secrets are set. " + message;
}

var els = {
  greeting: document.getElementById("greeting"),
  todayLabel: document.getElementById("todayLabel"),
  dateLine: document.getElementById("dateLine"),
  timeLine: document.getElementById("timeLine"),
  settingsButton: document.getElementById("settingsButton"),
  accountButton: document.getElementById("accountButton"),
  obsidianButton: document.getElementById("obsidianButton"),
  settingsModal: document.getElementById("settingsModal"),
  settingsForm: document.getElementById("settingsForm"),
  preferredName: document.getElementById("preferredName"),
  timeFormat: document.getElementById("timeFormat"),
  timeZone: document.getElementById("timeZone"),
  apiSportsKey: document.getElementById("apiSportsKey"),
  apiSportsKeySetting: document.getElementById("apiSportsKeySetting"),
  cloudPrivateSettingsNote: document.getElementById("cloudPrivateSettingsNote"),
  cloudStatusGrid: document.getElementById("cloudStatusGrid"),
  cloudStatusRefresh: document.getElementById("cloudStatusRefresh"),
  cloudSyncNow: document.getElementById("cloudSyncNow"),
  googleCalendarList: document.getElementById("googleCalendarList"),
  googleCalendarRefreshCalendars: document.getElementById("googleCalendarRefreshCalendars"),
  googleCalendarShowAllButton: document.getElementById("googleCalendarShowAllButton"),
  calendarPanel: document.getElementById("calendarPanel"),
  calendarGrid: document.getElementById("calendarGrid"),
  googleCalendarButton: document.getElementById("googleCalendarButton"),
  googleCalendarSyncButton: document.getElementById("googleCalendarSyncButton"),
  googleCalendarReconnectButton: document.getElementById("googleCalendarReconnectButton"),
  monthLabel: document.getElementById("monthLabel"),
  prevMonth: document.getElementById("prevMonth"),
  nextMonth: document.getElementById("nextMonth"),
  normalModeButton: document.getElementById("normalModeButton"),
  scheduleModeButton: document.getElementById("scheduleModeButton"),
  planningModeButton: document.getElementById("planningModeButton"),
  classScheduleModeButton: document.getElementById("classScheduleModeButton"),
  birthdayModeButton: document.getElementById("birthdayModeButton"),
  birthdayHideToggle: document.getElementById("birthdayHideToggle"),
  hideBirthdaysFromCalendar: document.getElementById("hideBirthdaysFromCalendar"),
  addScheduleButton: document.getElementById("addScheduleButton"),
  finalizePlansButton: document.getElementById("finalizePlansButton"),
  cancelPlansButton: document.getElementById("cancelPlansButton"),
  undoPlanButton: document.getElementById("undoPlanButton"),
  planningHint: document.getElementById("planningHint"),
  eventModal: document.getElementById("eventModal"),
  eventForm: document.getElementById("eventForm"),
  eventModalEyebrow: document.getElementById("eventModalEyebrow"),
  eventModalTitle: document.getElementById("eventModalTitle"),
  eventType: document.getElementById("eventType"),
  eventTypeForm: document.getElementById("eventTypeForm"),
  eventTypeInput: document.getElementById("eventTypeInput"),
  eventTypeAddButton: document.getElementById("eventTypeAddButton"),
  eventTypeList: document.getElementById("eventTypeList"),
  eventColorPalette: document.getElementById("eventColorPalette"),
  eventTimeSlot: document.getElementById("eventTimeSlot"),
  eventDate: document.getElementById("eventDate"),
  eventEndDate: document.getElementById("eventEndDate"),
  eventTimeRow: document.getElementById("eventTimeRow"),
  eventTimeStart: document.getElementById("eventTimeStart"),
  eventTimeEnd: document.getElementById("eventTimeEnd"),
  eventAllDay: document.getElementById("eventAllDay"),
  eventAlarm: document.getElementById("eventAlarm"),
  eventRepeatRow: document.getElementById("eventRepeatRow"),
  eventRepeat: document.getElementById("eventRepeat"),
  eventRepeatCustomNumberLabel: document.getElementById("eventRepeatCustomNumberLabel"),
  eventRepeatCustomNumber: document.getElementById("eventRepeatCustomNumber"),
  eventRepeatCustomUnitLabel: document.getElementById("eventRepeatCustomUnitLabel"),
  eventRepeatCustomUnit: document.getElementById("eventRepeatCustomUnit"),
  eventRepeatEndLabel: document.getElementById("eventRepeatEndLabel"),
  eventRepeatEnd: document.getElementById("eventRepeatEnd"),
  eventRepeatEndDateLabel: document.getElementById("eventRepeatEndDateLabel"),
  eventRepeatEndDate: document.getElementById("eventRepeatEndDate"),
  eventLocation: document.getElementById("eventLocation"),
  eventPassage: document.getElementById("eventPassage"),
  eventPassageLabel: document.getElementById("eventPassageLabel"),
  eventTitle: document.getElementById("eventTitle"),
  eventNotes: document.getElementById("eventNotes"),
  eventTemplateSelect: document.getElementById("eventTemplateSelect"),
  addTemplateToEvent: document.getElementById("addTemplateToEvent"),
  eventChecklist: document.getElementById("eventChecklist"),
  eventChecklistForm: document.getElementById("eventChecklistForm"),
  eventChecklistInput: document.getElementById("eventChecklistInput"),
  eventChecklistDue: document.getElementById("eventChecklistDue"),
  eventChecklistAddButton: document.getElementById("eventChecklistAddButton"),
  deleteEventButton: document.getElementById("deleteEventButton"),
  scheduleModal: document.getElementById("scheduleModal"),
  scheduleForm: document.getElementById("scheduleForm"),
  scheduleCategory: document.getElementById("scheduleCategory"),
  scheduleTitle: document.getElementById("scheduleTitle"),
  scheduleLocation: document.getElementById("scheduleLocation"),
  scheduleStartDate: document.getElementById("scheduleStartDate"),
  scheduleEndDate: document.getElementById("scheduleEndDate"),
  scheduleStartTime: document.getElementById("scheduleStartTime"),
  scheduleEndTime: document.getElementById("scheduleEndTime"),
  scheduleColorPalette: document.getElementById("scheduleColorPalette"),
  eventDetailModal: document.getElementById("eventDetailModal"),
  eventDetailHero: document.getElementById("eventDetailHero"),
  eventImageButton: document.getElementById("eventImageButton"),
  eventImageInput: document.getElementById("eventImageInput"),
  eventDetailType: document.getElementById("eventDetailType"),
  eventDetailTitle: document.getElementById("eventDetailTitle"),
  eventDetailMeta: document.getElementById("eventDetailMeta"),
  eventDetailNotes: document.getElementById("eventDetailNotes"),
  eventDetailChecklist: document.getElementById("eventDetailChecklist"),
  eventDetailDelete: document.getElementById("eventDetailDelete"),
  eventDetailClose: document.getElementById("eventDetailClose"),
  eventDetailEdit: document.getElementById("eventDetailEdit"),
  dayDrawer: document.getElementById("dayDrawer"),
  drawerDate: document.getElementById("drawerDate"),
  drawerGroups: document.getElementById("drawerGroups"),
  drawerAddEvent: document.getElementById("drawerAddEvent"),
  closeDayDrawer: document.getElementById("closeDayDrawer"),
  priorityList: document.getElementById("priorityList"),
  priorityTitle: document.getElementById("priorityTitle"),
  priorityScopeToggle: document.getElementById("priorityScopeToggle"),
  verseReference: document.getElementById("verseReference"),
  verseText: document.getElementById("verseText"),
  originalLine: document.getElementById("originalLine"),
  verseToggle: document.getElementById("verseToggle"),
  verseDetails: document.getElementById("verseDetails"),
  verseSource: document.getElementById("verseSource"),
  bibleReaderVerseButton: document.getElementById("bibleReaderVerseButton"),
  taskForm: document.getElementById("taskForm"),
  taskInput: document.getElementById("taskInput"),
  taskDueDate: document.getElementById("taskDueDate"),
  taskDueTime: document.getElementById("taskDueTime"),
  taskAlarm: document.getElementById("taskAlarm"),
  taskGroupForm: document.getElementById("taskGroupForm"),
  taskGroupInput: document.getElementById("taskGroupInput"),
  taskList: document.getElementById("taskList"),
  workPanelEyebrow: document.getElementById("workPanelEyebrow"),
  workPanelTitle: document.getElementById("workPanelTitle"),
  tasksWorkspaceButton: document.getElementById("tasksWorkspaceButton"),
  workflowsWorkspaceButton: document.getElementById("workflowsWorkspaceButton"),
  tasksWorkspaceView: document.getElementById("tasksWorkspaceView"),
  workflowsWorkspaceView: document.getElementById("workflowsWorkspaceView"),
  activeTasksButton: document.getElementById("activeTasksButton"),
  finishedTasksButton: document.getElementById("finishedTasksButton"),
  taskModal: document.getElementById("taskModal"),
  taskModalForm: document.getElementById("taskModalForm"),
  taskModalEyebrow: document.getElementById("taskModalEyebrow"),
  taskModalTitle: document.getElementById("taskModalTitle"),
  taskModalInput: document.getElementById("taskModalInput"),
  taskModalDueDate: document.getElementById("taskModalDueDate"),
  taskModalDueTime: document.getElementById("taskModalDueTime"),
  taskModalAlarm: document.getElementById("taskModalAlarm"),
  taskModalNotes: document.getElementById("taskModalNotes"),
  taskModalSource: document.getElementById("taskModalSource"),
  taskModalView: document.getElementById("taskModalView"),
  taskModalViewDue: document.getElementById("taskModalViewDue"),
  taskModalViewNotes: document.getElementById("taskModalViewNotes"),
  taskModalEditFields: document.getElementById("taskModalEditFields"),
  editTaskButton: document.getElementById("editTaskButton"),
  saveTaskButton: document.getElementById("saveTaskButton"),
  deleteTaskPermanentlyButton: document.getElementById("deleteTaskPermanentlyButton"),
  templateForm: document.getElementById("templateForm"),
  templateName: document.getElementById("templateName"),
  templateList: document.getElementById("templateList"),
  activeWorkflow: document.getElementById("activeWorkflow"),
  sportSelector: document.getElementById("sportSelector"),
  scoreboard: document.getElementById("scoreboard"),
  headlineStory: document.getElementById("headlineStory"),
  headlineImage: document.getElementById("headlineImage"),
  headlineKicker: document.getElementById("headlineKicker"),
  headlineTitle: document.getElementById("headlineTitle"),
  headlineSummary: document.getElementById("headlineSummary"),
  headlineMedia: document.getElementById("headlineMedia"),
  worldNewsList: document.getElementById("worldNewsList"),
  philippinesNewsList: document.getElementById("philippinesNewsList"),
  theologyNewsList: document.getElementById("theologyNewsList"),
  newsSourcesButton: document.getElementById("newsSourcesButton"),
  sourceModal: document.getElementById("sourceModal"),
  sourceForm: document.getElementById("sourceForm"),
  sourceGrid: document.getElementById("sourceGrid"),
  closeSourceButton: document.getElementById("closeSourceButton"),
  resetSourcesButton: document.getElementById("resetSourcesButton"),
  rssForm: document.getElementById("rssForm"),
  rssName: document.getElementById("rssName"),
  rssUrl: document.getElementById("rssUrl"),
  rssReadMoreUrl: document.getElementById("rssReadMoreUrl"),
  rssFeedList: document.getElementById("rssFeedList"),
  rssCardGrid: document.getElementById("rssCardGrid"),
  rssReadMoreLink: document.getElementById("rssReadMoreLink"),
  readerModal: document.getElementById("readerModal"),
  readerSource: document.getElementById("readerSource"),
  readerTitle: document.getElementById("readerTitle"),
  readerBody: document.getElementById("readerBody"),
  readerOriginalLink: document.getElementById("readerOriginalLink"),
  splitReaderButton: document.getElementById("splitReaderButton"),
  closeReaderButton: document.getElementById("closeReaderButton"),
  readerDoneButton: document.getElementById("readerDoneButton"),
  splitReaderModal: document.getElementById("splitReaderModal"),
  splitReaderSource: document.getElementById("splitReaderSource"),
  splitReaderTitle: document.getElementById("splitReaderTitle"),
  splitReaderLayout: document.getElementById("splitReaderLayout"),
  splitReaderArticle: document.getElementById("splitReaderArticle"),
  splitReaderDivider: document.getElementById("splitReaderDivider"),
  splitReaderFrame: document.getElementById("splitReaderFrame"),
  splitReaderFallback: document.getElementById("splitReaderFallback"),
  splitReaderOriginalLink: document.getElementById("splitReaderOriginalLink"),
  splitReaderFallbackLink: document.getElementById("splitReaderFallbackLink"),
  closeSplitReaderButton: document.getElementById("closeSplitReaderButton"),
  splitReaderDock: document.getElementById("splitReaderDock"),
  dockReaderSource: document.getElementById("dockReaderSource"),
  dockReaderTitle: document.getElementById("dockReaderTitle"),
  dockReaderBody: document.getElementById("dockReaderBody"),
  dockReaderOriginalLink: document.getElementById("dockReaderOriginalLink"),
  closeDockReaderButton: document.getElementById("closeDockReaderButton"),
  dockReaderBack: document.getElementById("dockReaderBack"),
  dockReaderForward: document.getElementById("dockReaderForward"),
  mainSplitDivider: document.getElementById("mainSplitDivider"),
  scrollDots: document.getElementById("scrollDots"),
  languageTabs: document.getElementById("languageTabs"),
  languageContent: document.getElementById("languageContent"),
  languageVideoModal: document.getElementById("languageVideoModal"),
  languageVideoSource: document.getElementById("languageVideoSource"),
  languageVideoTitle: document.getElementById("languageVideoTitle"),
  languageVideoFrame: document.getElementById("languageVideoFrame"),
  closeLanguageVideoButton: document.getElementById("closeLanguageVideoButton"),
  moduleMenuButton: document.getElementById("moduleMenuButton"),
  moduleMenu: document.getElementById("moduleMenu"),
  worldWatchCard: document.getElementById("worldWatchCard"),
  missionsTabs: document.getElementById("missionsTabs"),
  missionsCard: document.getElementById("missionsCard"),
  closeSettingsButton: document.getElementById("closeSettingsButton")
};

var DEFAULT_EVENT_TYPES = ["General Event", "Reminder", "Sermon", "Bible Study", "Sermon Prep", "Bible Study Prep", "Class", "Ministry", "Others"];
var PROTECTED_EVENT_TYPES = ["Sermon", "Bible Study"];
var deliveredAlarmKeys = {};
var FALLBACK_NEWS_SOURCES = {
  world: [
    { source: "Reuters", url: "https://www.reutersagency.com/feed/?best-topics=world&post_type=best" },
    { source: "CNN", url: "http://rss.cnn.com/rss/edition_world.rss" },
    { source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
    { source: "BBC", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
    { source: "The Guardian", url: "https://www.theguardian.com/world/rss" },
    { source: "France 24", url: "https://www.france24.com/en/rss" },
    { source: "Deutsche Welle", url: "https://rss.dw.com/rdf/rss-en-world" },
    { source: "NPR", url: "https://feeds.npr.org/1004/rss.xml" }
  ],
  philippines: [
    { source: "Rappler", url: "https://www.rappler.com/feed/" },
    { source: "Inquirer.net", url: "https://newsinfo.inquirer.net/feed" },
    { source: "GMA News Online", url: "https://www.gmanetwork.com/news/rss/news/" },
    { source: "ABS-CBN News", url: "https://news.abs-cbn.com/rss/news" },
    { source: "Philstar", url: "https://www.philstar.com/rss/headlines" },
    { source: "Manila Bulletin", url: "https://mb.com.ph/rss" }
  ],
  theology: [
    { source: "Open Doors", url: "https://www.opendoors.org/en-US/news/latest/rss/" },
    { source: "The Gospel Coalition", url: "https://www.thegospelcoalition.org/feed/" },
    { source: "Christianity Today", url: "https://www.christianitytoday.com/rss.xml" },
    { source: "Desiring God", url: "https://www.desiringgod.org/articles.atom" },
    { source: "Baptist Press", url: "https://www.baptistpress.com/feed/" },
    { source: "Religion News Service", url: "https://religionnews.com/feed/" }
  ]
};

function id(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function dashboardTimeZone() {
  return (typeof state !== "undefined" && state.settings && state.settings.timeZone) || "Asia/Manila";
}

function datePartsInTimeZone(date, timeZone) {
  var parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || dashboardTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date).reduce(function (result, part) {
    result[part.type] = part.value;
    return result;
  }, {});
  var hour = Number(parts.hour || 0);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: hour === 24 ? 0 : hour,
    minute: Number(parts.minute || 0),
    second: Number(parts.second || 0)
  };
}

function dateISOInTimeZone(date, timeZone) {
  var parts = datePartsInTimeZone(date, timeZone);
  return String(parts.year).padStart(4, "0") + "-" +
    String(parts.month).padStart(2, "0") + "-" +
    String(parts.day).padStart(2, "0");
}

function timeInTimeZone(date, timeZone) {
  var parts = datePartsInTimeZone(date, timeZone);
  return String(parts.hour).padStart(2, "0") + ":" + String(parts.minute).padStart(2, "0");
}

function timeZoneOffsetMs(date, timeZone) {
  var parts = datePartsInTimeZone(date, timeZone);
  var asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUTC - date.getTime();
}

function zonedDateTimeToDate(dateISO, time, timeZone) {
  var dateParts = dateISO.split("-").map(Number);
  var timeParts = (time || "00:00").split(":").map(Number);
  var utcGuess = Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0] || 0, timeParts[1] || 0, 0);
  var offset = timeZoneOffsetMs(new Date(utcGuess), timeZone);
  var instant = new Date(utcGuess - offset);
  var correctedOffset = timeZoneOffsetMs(instant, timeZone);
  return new Date(utcGuess - correctedOffset);
}

function dashboardTodayISO() {
  return dateISOInTimeZone(new Date(), dashboardTimeZone());
}

function toISO(date) {
  var copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  var year = copy.getFullYear();
  var month = String(copy.getMonth() + 1).padStart(2, "0");
  var day = String(copy.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function parseISO(value) {
  var parts = value.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function addDays(date, amount) {
  var copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function addMonths(date, amount) {
  var copy = new Date(date);
  var day = copy.getDate();
  copy.setDate(1);
  copy.setMonth(copy.getMonth() + amount);
  copy.setDate(Math.min(day, new Date(copy.getFullYear(), copy.getMonth() + 1, 0).getDate()));
  return copy;
}

function addYears(date, amount) {
  var copy = new Date(date);
  copy.setFullYear(copy.getFullYear() + amount);
  return copy;
}

function formatShortDate(value) {
  if (!value) return "";
  var date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return String(date.getMonth() + 1).padStart(2, "0") + "/" +
    String(date.getDate()).padStart(2, "0") + "/" +
    String(date.getFullYear()).slice(-2);
}

function startOfWeek(date) {
  return addDays(date, -date.getDay());
}

function isWithin(dateISO, startISO, endISO) {
  var current = parseISO(dateISO).getTime();
  var start = parseISO(startISO).getTime();
  var end = parseISO(endISO || startISO).getTime();
  return current >= start && current <= end;
}

function displayDate(iso) {
  return parseISO(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function displayLongDate(iso) {
  return parseISO(iso).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function weekOfYearLabel(date) {
  var weekStart = startOfWeek(date);
  var firstWeekStart = startOfWeek(new Date(weekStart.getFullYear(), 0, 1));
  var weekNumber = Math.floor((weekStart - firstWeekStart) / 604800000) + 1;
  return weekStart.getFullYear() + " Wk " + weekNumber;
}

function currentWeekRange() {
  var today = parseISO(dashboardTodayISO());
  var weekStart = startOfWeek(today);
  return {
    start: toISO(weekStart),
    end: toISO(addDays(weekStart, 6))
  };
}

function dayDiff(startISO, endISO) {
  if (!startISO || !endISO) return 0;
  return Math.max(0, Math.round((parseISO(endISO) - parseISO(startISO)) / 86400000));
}

function normalizeRange(a, b) {
  if (parseISO(a) <= parseISO(b)) return { start: a, end: b };
  return { start: b, end: a };
}

function getTimeSlotFromTime(value) {
  value = normalizeTimeInput(value);
  if (!value) return "Morning";
  var hour = Number(value.split(":")[0]);
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

function defaultTimeForSlot(slot) {
  if (slot === "Evening") return "18:00";
  if (slot === "Afternoon") return "12:00";
  return "08:00";
}

function formatTimeOption(value) {
  if (state.settings.timeFormat !== "12") return value;
  var parts = value.split(":").map(Number);
  var hour = parts[0];
  var minute = String(parts[1]).padStart(2, "0");
  var suffix = hour >= 12 ? "PM" : "AM";
  var hour12 = hour % 12 || 12;
  return hour12 + ":" + minute + " " + suffix;
}

function alarmLabel(value) {
  var minutes = Number(value);
  if (!minutes) return "No alarm";
  if (minutes === 60) return "1 hour before";
  if (minutes === 120) return "2 hours before";
  if (minutes === 1440) return "1 day before";
  return minutes + " minutes before";
}

function notifyDashboardAlarm(key, title) {
  if (deliveredAlarmKeys[key]) return;
  deliveredAlarmKeys[key] = true;
  showToast("Alarm: " + title);
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification("Ministry Dashboard", { body: title });
  }
}

function checkDashboardAlarms() {
  var now = Date.now();
  function checkItem(item, date, time, title) {
    var offset = Number(item.alarm || 0);
    if (!offset || !date || !time) return;
    var target = new Date(date + "T" + time).getTime() - (offset * 60000);
    if (Number.isNaN(target) || now < target || now - target > 65000) return;
    notifyDashboardAlarm(item.id + ":" + date + ":" + item.alarm, title);
  }
  state.events.forEach(function (item) {
    checkItem(item, item.start, item.timeStart, eventTitle(item));
  });
  state.tasks.filter(function (item) { return !item.done; }).forEach(function (item) {
    checkItem(item, item.dueDate, item.dueTime, "Task: " + item.title);
  });
}

function timeToMinutes(value) {
  value = normalizeTimeInput(value);
  if (!value || value.indexOf(":") === -1) return null;
  var parts = value.split(":").map(Number);
  return (parts[0] * 60) + parts[1];
}

function minutesToTime(minutes) {
  var clamped = Math.max(0, Math.min((24 * 60) - 1, minutes));
  var hour = String(Math.floor(clamped / 60)).padStart(2, "0");
  var minute = String(clamped % 60).padStart(2, "0");
  return hour + ":" + minute;
}

function normalizeTimeInput(value) {
  var source = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!source) return "";
  var match = source.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!match) match = source.match(/^(\d{1,2})(\d{2})(am|pm)?$/);
  if (!match) return "";
  var hour = Number(match[1]);
  var minute = match[2] === undefined ? 0 : Number(match[2]);
  var suffix = match[3] || "";
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute > 59) return "";
  if (suffix) {
    if (hour < 1 || hour > 12) return "";
    if (suffix === "pm" && hour !== 12) hour += 12;
    if (suffix === "am" && hour === 12) hour = 0;
  } else if (hour > 23) {
    return "";
  }
  return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
}

function normalizeTimeField(field) {
  var normalized = normalizeTimeInput(field.value);
  if (normalized) field.value = normalized;
  return normalized;
}

function getValidatedTimeRange(startField, endField) {
  var start = normalizeTimeField(startField);
  var end = normalizeTimeField(endField);
  if (!start || !end) {
    showToast("Enter valid start and end times, for example 13:50.");
    return null;
  }
  if (timeToMinutes(end) < timeToMinutes(start)) {
    showToast("End time cannot be earlier than start time.");
    return null;
  }
  return { start: start, end: end };
}

function populateTimeSuggestions() {
  var list = document.getElementById("dashboardTimeOptions");
  if (!list) return;
  list.innerHTML = "";
  for (var minutes = 0; minutes < 24 * 60; minutes += 15) {
    var value = minutesToTime(minutes);
    var option = document.createElement("option");
    option.value = value;
    option.label = formatTimeOption(value);
    list.appendChild(option);
  }
}

function populateTimeSelects() {
  populateTimeSuggestions();
  [els.eventTimeStart, els.eventTimeEnd].forEach(function (select) {
    var current = select.value || select.dataset.pendingValue || "";
    var normalized = normalizeTimeInput(current) || (select === els.eventTimeStart ? "08:00" : "09:00");
    select.innerHTML = "";
    for (var minutes = 0; minutes < 24 * 60; minutes += 15) {
      var value = minutesToTime(minutes);
      var option = document.createElement("option");
      option.value = value;
      option.textContent = formatTimeOption(value);
      select.appendChild(option);
    }
    select.value = normalized;
  });
}

function updateEventEndTimeOptions() {
  var start = normalizeTimeField(els.eventTimeStart);
  var end = normalizeTimeField(els.eventTimeEnd);
  if (start && (!end || timeToMinutes(end) < timeToMinutes(start))) {
    els.eventTimeEnd.value = start;
  }
}

function shouldHideEventTimes() {
  return els.eventAllDay.checked || (els.eventDate.value && els.eventEndDate.value && els.eventDate.value !== els.eventEndDate.value);
}

function syncEventTimeControls() {
  if (els.eventDate.value) els.eventEndDate.min = els.eventDate.value;
  var hideTimes = shouldHideEventTimes();
  els.eventTimeRow.classList.toggle("time-disabled", hideTimes);
  els.eventTimeStart.disabled = hideTimes;
  els.eventTimeEnd.disabled = hideTimes;
  els.eventTimeSlot.disabled = hideTimes;
  if (hideTimes) {
    els.eventTimeSlot.value = "All Day";
    return;
  }
  if (!els.eventTimeStart.value) els.eventTimeStart.value = "08:00";
  if (!els.eventTimeEnd.value) els.eventTimeEnd.value = "09:00";
  updateEventEndTimeOptions();
  els.eventTimeSlot.value = getTimeSlotFromTime(els.eventTimeStart.value);
}

function handleEventTimeSlotChange() {
  var slot = els.eventTimeSlot.value;
  if (slot === "All Day") {
    els.eventAllDay.checked = true;
    syncEventTimeControls();
    return;
  }
  if (els.eventDate.value && els.eventEndDate.value && els.eventDate.value !== els.eventEndDate.value) {
    els.eventEndDate.value = els.eventDate.value;
  }
  els.eventAllDay.checked = false;
  els.eventTimeStart.value = defaultTimeForSlot(slot);
  els.eventTimeEnd.value = minutesToTime(timeToMinutes(els.eventTimeStart.value) + 60);
  rememberEventTimeRange();
  syncEventTimeControls();
}

function isPassageEventType(type) {
  return PROTECTED_EVENT_TYPES.indexOf(type) > -1;
}

function syncEventPassageField() {
  if (!els.eventPassageLabel) return;
  var showPassage = isPassageEventType(els.eventType.value);
  els.eventPassageLabel.hidden = !showPassage;
  els.eventPassage.disabled = !showPassage;
}

function rememberEventDateRange() {
  lastEventStartDate = els.eventDate.value;
  lastEventRangeDays = dayDiff(els.eventDate.value, els.eventEndDate.value || els.eventDate.value);
}

function rememberEventTimeRange() {
  var startMinutes = timeToMinutes(els.eventTimeStart.value);
  var endMinutes = timeToMinutes(els.eventTimeEnd.value);
  if (startMinutes === null || endMinutes === null) return;
  lastEventStartTime = els.eventTimeStart.value;
  lastEventDurationMinutes = Math.max(0, endMinutes - startMinutes);
}

function handleEventStartDateChange() {
  if (!els.eventDate.value) return;
  if (lastEventStartDate && els.eventEndDate.value) {
    var nextEnd = addDays(parseISO(els.eventDate.value), lastEventRangeDays);
    els.eventEndDate.value = toISO(nextEnd);
  } else if (!els.eventEndDate.value || parseISO(els.eventEndDate.value) < parseISO(els.eventDate.value)) {
    els.eventEndDate.value = els.eventDate.value;
  }
  rememberEventDateRange();
  syncEventTimeControls();
  syncRepeatControls();
}

function handleEventEndDateChange() {
  if (!els.eventEndDate.value || parseISO(els.eventEndDate.value) < parseISO(els.eventDate.value)) {
    els.eventEndDate.value = els.eventDate.value;
  }
  rememberEventDateRange();
  syncEventTimeControls();
  syncRepeatControls();
}

function handleEventStartTimeChange() {
  var start = normalizeTimeField(els.eventTimeStart);
  var startMinutes = timeToMinutes(start);
  if (startMinutes === null) return;
  if (lastEventStartTime && els.eventTimeEnd.value) {
    els.eventTimeEnd.value = minutesToTime(startMinutes + lastEventDurationMinutes);
  }
  updateEventEndTimeOptions();
  rememberEventTimeRange();
  syncEventTimeControls();
}

function handleEventEndTimeChange() {
  if (els.eventTimeEnd.value && !normalizeTimeField(els.eventTimeEnd)) return;
  updateEventEndTimeOptions();
  rememberEventTimeRange();
  syncEventTimeControls();
}

function updateScheduleEndTimeOptions() {
  var start = normalizeTimeField(els.scheduleStartTime);
  var end = normalizeTimeField(els.scheduleEndTime);
  if (start && (!end || timeToMinutes(end) < timeToMinutes(start))) {
    els.scheduleEndTime.value = start;
  }
}

function rememberScheduleDateRange() {
  lastScheduleStartDate = els.scheduleStartDate.value;
  lastScheduleRangeDays = dayDiff(els.scheduleStartDate.value, els.scheduleEndDate.value || els.scheduleStartDate.value);
}

function rememberScheduleTimeRange() {
  var startMinutes = timeToMinutes(els.scheduleStartTime.value);
  var endMinutes = timeToMinutes(els.scheduleEndTime.value);
  if (startMinutes === null || endMinutes === null) return;
  lastScheduleStartTime = els.scheduleStartTime.value;
  lastScheduleDurationMinutes = Math.max(0, endMinutes - startMinutes);
}

function handleScheduleStartDateChange() {
  if (!els.scheduleStartDate.value) return;
  if (lastScheduleStartDate && els.scheduleEndDate.value) {
    els.scheduleEndDate.value = toISO(addDays(parseISO(els.scheduleStartDate.value), lastScheduleRangeDays));
  } else if (!els.scheduleEndDate.value || parseISO(els.scheduleEndDate.value) < parseISO(els.scheduleStartDate.value)) {
    els.scheduleEndDate.value = els.scheduleStartDate.value;
  }
  els.scheduleEndDate.min = els.scheduleStartDate.value;
  rememberScheduleDateRange();
}

function handleScheduleEndDateChange() {
  if (!els.scheduleEndDate.value || parseISO(els.scheduleEndDate.value) < parseISO(els.scheduleStartDate.value)) {
    els.scheduleEndDate.value = els.scheduleStartDate.value;
  }
  rememberScheduleDateRange();
}

function handleScheduleStartTimeChange() {
  var start = normalizeTimeField(els.scheduleStartTime);
  var startMinutes = timeToMinutes(start);
  if (startMinutes === null) return;
  if (lastScheduleStartTime && els.scheduleEndTime.value) {
    els.scheduleEndTime.value = minutesToTime(startMinutes + lastScheduleDurationMinutes);
  }
  updateScheduleEndTimeOptions();
  rememberScheduleTimeRange();
}

function handleScheduleEndTimeChange() {
  if (els.scheduleEndTime.value && !normalizeTimeField(els.scheduleEndTime)) return;
  updateScheduleEndTimeOptions();
  rememberScheduleTimeRange();
}

function defaultRepeatRule() {
  return { frequency: "none", interval: 1, unit: "week", endMode: "never", endDate: "" };
}

function normalizeRepeatRule(rule) {
  var source = rule || {};
  var frequency = source.frequency || "none";
  var interval = Math.max(1, Number(source.interval || 1));
  var unit = source.unit || "week";
  var endMode = source.endMode === "on" ? "on" : "never";
  var endDate = source.endDate || "";
  if (frequency === "biweekly") {
    frequency = "weekly";
    interval = 2;
  }
  if (frequency !== "custom" && ["none", "daily", "weekly", "monthly", "yearly"].indexOf(frequency) === -1) frequency = "none";
  if (["day", "week", "month", "year"].indexOf(unit) === -1) unit = "week";
  if (frequency === "none") return defaultRepeatRule();
  return { frequency: frequency, interval: interval, unit: unit, endMode: endMode, endDate: endDate };
}

function repeatRuleFromForm() {
  if (!els.eventRepeat || eventModalMode === "plan") return defaultRepeatRule();
  var repeat = els.eventRepeat.value || "none";
  if (repeat === "none") return defaultRepeatRule();
  var rule = {
    frequency: "custom",
    interval: Math.max(1, Number(els.eventRepeatCustomNumber.value || 1)),
    unit: els.eventRepeatCustomUnit.value || "week",
    endMode: els.eventRepeatEnd.value || "never",
    endDate: els.eventRepeatEndDate.value || ""
  };
  if (rule.endMode === "on" && !rule.endDate) rule.endMode = "never";
  return normalizeRepeatRule(rule);
}

function repeatFormValue(rule) {
  var normalized = normalizeRepeatRule(rule);
  if (normalized.frequency === "none") return "none";
  if (normalized.frequency === "custom") return "custom";
  return "custom";
}

function applyRepeatRuleToForm(rule) {
  if (!els.eventRepeat) return;
  var normalized = normalizeRepeatRule(rule);
  if (normalized.frequency === "daily") normalized.unit = "day";
  if (normalized.frequency === "weekly") normalized.unit = "week";
  if (normalized.frequency === "monthly") normalized.unit = "month";
  if (normalized.frequency === "yearly") normalized.unit = "year";
  els.eventRepeat.value = repeatFormValue(normalized);
  els.eventRepeatCustomNumber.value = normalized.interval || 1;
  els.eventRepeatCustomUnit.value = normalized.unit || "week";
  els.eventRepeatEnd.value = normalized.endMode || "never";
  els.eventRepeatEndDate.value = normalized.endDate || "";
  syncRepeatControls();
}

function syncRepeatControls() {
  if (!els.eventRepeat) return;
  var repeat = els.eventRepeat.value || "none";
  var showRepeatMeta = repeat !== "none";
  var showEndDate = showRepeatMeta && els.eventRepeatEnd.value === "on";
  els.eventRepeatCustomNumberLabel.hidden = !showRepeatMeta;
  els.eventRepeatCustomUnitLabel.hidden = !showRepeatMeta;
  els.eventRepeatEndLabel.hidden = !showRepeatMeta;
  els.eventRepeatEndDateLabel.hidden = !showEndDate;
  if (els.eventDate.value) els.eventRepeatEndDate.min = els.eventDate.value;
}

function eventColor(key) {
  return EVENT_COLORS.find(function (color) { return color.key === key; }) || EVENT_COLORS[0];
}

function renderColorPalette(container, selectedKey, onSelect) {
  if (!container) return;
  var activeKey = eventColor(selectedKey).key;
  container.innerHTML = "";
  EVENT_COLORS.forEach(function (color) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "color-swatch" + (color.key === activeKey ? " active" : "");
    button.style.setProperty("--swatch", color.value);
    button.title = color.name;
    button.setAttribute("aria-label", color.name + " event color");
    button.addEventListener("click", function () {
      onSelect(color.key);
      renderColorPalette(container, color.key, onSelect);
    });
    container.appendChild(button);
  });
}

function seedState() {
  var today = new Date();
  var sermonDate = toISO(addDays(today, 13));
  var bibleStudyDate = toISO(addDays(today, 3));
  return {
    settings: { preferredName: "", timeFormat: "24", timeZone: "Asia/Manila", headlineCarouselPaused: false, readerSplit: 50, mainReaderSplit: 62, hideBirthdaysFromCalendar: false, classScheduleEventIds: [], classScheduleStartTime: "08:00", classScheduleEndTime: "18:00", googleCalendarUseAll: true, googleCalendarIds: [], eventTypes: DEFAULT_EVENT_TYPES.slice(), newsSources: { world: [], philippines: [], theology: [] }, customNewsSources: { world: [], philippines: [], theology: [] }, newsSourceOrder: { world: [], philippines: [], theology: [] } },
    events: [
      createEvent({ type: "Sermon", passage: "Jn 3:16", title: "Sermon: Jn 3:16", start: sermonDate, end: sermonDate, timeSlot: "Morning", source: "dashboard" }),
      createEvent({ type: "Bible Study", passage: "Rom 8:1-11", title: "Bible Study: Rom 8:1-11", start: bibleStudyDate, end: bibleStudyDate, timeSlot: "Evening", source: "dashboard" })
    ],
    plans: [],
    tasks: [],
    taskGroups: [],
    templates: [],
    activeTemplateId: null,
    rssFeeds: [],
    activeRssSource: "",
    rssReadMoreUrl: "",
    updatedAt: ""
  };
}

function createEvent(values) {
  return {
    id: values.id || id(values.draft ? "plan" : "event"),
    googleEventId: values.googleEventId || "",
    googleCalendarId: values.googleCalendarId || "",
    type: values.type || defaultEventType(),
    passage: values.passage || "",
    title: values.title || "",
    start: values.start || dashboardTodayISO(),
    end: values.end || values.start || dashboardTodayISO(),
    timeSlot: values.timeSlot || "Morning",
    timeStart: values.timeStart || "",
    timeEnd: values.timeEnd || "",
    allDay: !!values.allDay,
    alarm: values.alarm || "none",
    location: values.location || "",
    notes: values.notes || "",
    image: values.image || "",
    checklist: values.checklist || [],
    taskGroupId: values.taskGroupId || "",
    source: values.source || "dashboard",
    readOnly: !!values.readOnly,
    syncStatus: values.syncStatus || "",
    lastSyncedAt: values.lastSyncedAt || "",
    htmlLink: values.htmlLink || "",
    updatedAt: values.updatedAt || "",
    scheduleId: values.scheduleId || "",
    scheduleCategory: values.scheduleCategory || "",
    colorKey: values.colorKey || "",
    repeatRule: normalizeRepeatRule(values.repeatRule),
    recurrence: values.recurrence || [],
    googleRecurringEventId: values.googleRecurringEventId || "",
    recurrenceInstance: !!values.recurrenceInstance,
    occurrenceOf: values.occurrenceOf || "",
    occurrenceDate: values.occurrenceDate || "",
    recurring: !!values.recurring,
    draft: !!values.draft
  };
}

function normalizeEvent(event) {
  return createEvent(event || {});
}

function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    var loaded = JSON.parse(raw);
    loaded.settings = loaded.settings || {};
    loaded.settings.preferredName = loaded.settings.preferredName || "";
    loaded.settings.timeFormat = loaded.settings.timeFormat || "24";
    loaded.settings.timeZone = loaded.settings.timeZone || "Asia/Manila";
    loaded.settings.headlineCarouselPaused = !!loaded.settings.headlineCarouselPaused;
    loaded.settings.readerSplit = loaded.settings.readerSplit || 50;
    loaded.settings.mainReaderSplit = loaded.settings.mainReaderSplit || 62;
    loaded.settings.hideBirthdaysFromCalendar = !!loaded.settings.hideBirthdaysFromCalendar;
    loaded.settings.classScheduleEventIds = Array.isArray(loaded.settings.classScheduleEventIds) ? loaded.settings.classScheduleEventIds.filter(Boolean) : [];
    loaded.settings.classScheduleStartTime = normalizeTimeInput(loaded.settings.classScheduleStartTime) || "08:00";
    loaded.settings.classScheduleEndTime = normalizeTimeInput(loaded.settings.classScheduleEndTime) || "18:00";
    loaded.settings.googleCalendarUseAll = loaded.settings.googleCalendarUseAll !== false;
    loaded.settings.googleCalendarIds = Array.isArray(loaded.settings.googleCalendarIds) ? loaded.settings.googleCalendarIds.filter(Boolean) : [];
    var storedEventTypes = Array.isArray(loaded.settings.eventTypes) && loaded.settings.eventTypes.length
      ? loaded.settings.eventTypes
      : DEFAULT_EVENT_TYPES;
    loaded.settings.eventTypes = Array.from(new Set(storedEventTypes.concat(PROTECTED_EVENT_TYPES))).filter(Boolean);
    loaded.settings.newsSources = loaded.settings.newsSources || { world: [], philippines: [], theology: [] };
    loaded.settings.customNewsSources = loaded.settings.customNewsSources || { world: [], philippines: [], theology: [] };
    loaded.settings.newsSourceOrder = loaded.settings.newsSourceOrder || { world: [], philippines: [], theology: [] };
    ["world", "philippines", "theology"].forEach(function (section) {
      loaded.settings.newsSources[section] = (loaded.settings.newsSources[section] || []).filter(function (source) { return source !== "Vatican News"; });
      loaded.settings.customNewsSources[section] = (loaded.settings.customNewsSources[section] || []).filter(function (source) {
        return source && source.source && /^https?:\/\//i.test(source.url || "");
      }).map(function (source) {
        source.custom = true;
        return source;
      }).slice(0, 20);
    loaded.settings.newsSourceOrder[section] = (loaded.settings.newsSourceOrder[section] || []).filter(function (source) { return source !== "Vatican News"; });
    });
    loaded.events = (loaded.events || []).map(normalizeEvent);
    loaded.events = loaded.events.filter(function (event) {
      return !(event.source === "google" && event.title === "Google Calendar sync placeholder" && !event.googleEventId);
    });
    loaded.plans = (loaded.plans || []).map(function (plan) {
      plan.draft = true;
      return normalizeEvent(plan);
    });
    loaded.tasks = (loaded.tasks || []).map(function (task, index) {
      task.groupId = task.groupId || "";
      task.sortOrder = typeof task.sortOrder === "number" ? task.sortOrder : index;
      return task;
    });
    loaded.taskGroups = (loaded.taskGroups || []).map(function (group, index) {
      return {
        id: group.id || id("task-group"),
        name: group.name || "Untitled group",
        collapsed: !!group.collapsed,
        sortOrder: typeof group.sortOrder === "number" ? group.sortOrder : index
      };
    });
    if (typeof loaded.settings.openTaskGroupId !== "string") {
      var legacyOpenGroup = loaded.taskGroups.find(function (group) { return !group.collapsed; });
      loaded.settings.openTaskGroupId = legacyOpenGroup
        ? legacyOpenGroup.id
        : (loaded.settings.ungroupedTasksCollapsed ? "" : "__ungrouped__");
    }
    loaded.templates = loaded.templates || [];
    loaded.activeTemplateId = loaded.activeTemplateId || null;
    loaded.rssFeeds = (loaded.rssFeeds || []).slice(0, 10);
    loaded.activeRssSource = loaded.activeRssSource || "";
    loaded.rssReadMoreUrl = loaded.rssReadMoreUrl || "";
    loaded.updatedAt = loaded.updatedAt || "";
    return loaded;
  } catch (error) {
    console.warn(error);
    return seedState();
  }
}

var state = loadState();
headlineCarouselPaused = !!state.settings.headlineCarouselPaused;
var viewDate = parseISO(dashboardTodayISO());
var scheduleWeekStart = startOfWeek(parseISO(dashboardTodayISO()));
var calendarMode = "normal";
var planningMode = false;
var selectedDate = dashboardTodayISO();
var eventModalMode = "create";
var editingEventId = null;
var viewingEventId = null;
var editingTaskId = null;
var taskView = "active";
var workspaceView = "tasks";
var taskModalOpenSource = "";
var draggedTaskId = "";
var taskPointerDrag = null;
var taskGroupPointerDrag = null;
var workflowPointerDrag = null;
var templatePointerDrag = null;
var modalChecklistPointerDrag = null;
var eventDetailChecklistPointerDrag = null;
var modalChecklist = [];
var selectingPlan = false;
var selectionStart = null;
var selectionEnd = null;
var editingScheduleId = null;
var editingScheduleFromDate = "";
var currentSport = "mlb";
var priorityScope = "week";
var priorityClassGroupOpen = true;
var lastEventStartDate = "";
var lastEventRangeDays = 0;
var lastEventStartTime = "";
var lastEventDurationMinutes = 60;
var lastScheduleStartDate = "";
var lastScheduleRangeDays = 0;
var lastScheduleStartTime = "";
var lastScheduleDurationMinutes = 60;
var selectedEventColorKey = "plum";
var selectedScheduleColorKey = "green";
var generatedOccurrenceMap = {};
var openBirthdayMonthIndex = parseISO(dashboardTodayISO()).getMonth();
var newsData = null;
var headlineIndex = 0;
var activeHeadlineItem = null;
var headlineTimer = null;
var headlineCarouselPaused = false;
var sportsData = {};
var standingSelection = {};
var gamesDaySelection = {};
var worldWatchData = null;
var missionsData = null;
var activeMission = "operation";
var languageData = null;
var activeLanguageView = "vocabulary";
var activeVerse = null;
var verseTextCache = {};
var verseFetches = {};
var newsSourceOptions = null;
var newsSourceLoadError = "";
var newsLoadError = "";
var rssData = { items: [], errors: [] };
var activeDeleteMenu = null;
var activeReaderItem = null;
var readerHistory = [];
var readerHistoryIndex = -1;
var splitDragging = false;
var mainSplitDragging = false;
var googleCalendarStatus = { configured: false, connected: false, redirectUri: "" };
var googleCalendarChoices = [];
var googleCalendarLoading = false;
var googleCalendarLastMessage = "";
var cloudStatusChecks = {
  auth: { state: "idle", detail: "Not checked yet." },
  sync: { state: "idle", detail: "Not checked yet." },
  news: { state: "idle", detail: "Not checked yet." },
  sports: { state: "idle", detail: "Not checked yet." },
  rss: { state: "idle", detail: "Not checked yet." },
  language: { state: "idle", detail: "Not checked yet." },
  google: { state: "idle", detail: "Not checked yet." }
};

var DAILY_VERSES = [
  {
    reference: "John 3:16",
    passage: "John 3:16",
    language: "greek",
    originalSource: "SBLGNT",
    netFallback: "For this is the way God loved the world: He gave his one and only Son, so that everyone who believes in him will not perish but have eternal life.",
    original: "Οὕτως γὰρ ἠγάπησεν ὁ θεὸς τὸν κόσμον, ὥστε τὸν υἱὸν τὸν μονογενῆ ἔδωκεν, ἵνα πᾶς ὁ πιστεύων εἰς αὐτὸν μὴ ἀπόληται ἀλλ’ ἔχῃ ζωὴν αἰώνιον.",
    parses: [["ἠγάπησεν", "aorist active indicative, 3rd singular"], ["ἔδωκεν", "aorist active indicative, 3rd singular"], ["πιστεύων", "present active participle, nominative masculine singular"], ["ἀπόληται", "aorist middle subjunctive, 3rd singular"], ["ἔχῃ", "present active subjunctive, 3rd singular"]]
  },
  {
    reference: "Genesis 1:1",
    passage: "Genesis 1:1",
    language: "hebrew",
    originalSource: "WLC",
    netFallback: "In the beginning God created the heavens and the earth.",
    original: "בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ.",
    parses: [["בָּרָא", "Qal perfect, 3rd masculine singular"]]
  },
  {
    reference: "Philippians 1:6",
    passage: "Philippians 1:6",
    language: "greek",
    originalSource: "SBLGNT",
    netFallback: "For I am sure of this very thing, that the one who began a good work in you will perfect it until the day of Christ Jesus.",
    original: "πεποιθὼς αὐτὸ τοῦτο, ὅτι ὁ ἐναρξάμενος ἐν ὑμῖν ἔργον ἀγαθὸν ἐπιτελέσει ἄχρι ἡμέρας Χριστοῦ Ἰησοῦ.",
    parses: [["πεποιθὼς", "perfect active participle, nominative masculine singular"], ["ἐναρξάμενος", "aorist middle participle, nominative masculine singular"], ["ἐπιτελέσει", "future active indicative, 3rd singular"]]
  },
  {
    reference: "Psalm 23:1",
    passage: "Psalm 23:1",
    language: "hebrew",
    originalSource: "WLC",
    netFallback: "The Lord is my shepherd, I lack nothing.",
    original: "יְהוָה רֹעִי לֹא אֶחְסָר.",
    parses: [["אֶחְסָר", "Qal imperfect, 1st common singular"]]
  },
  {
    reference: "Romans 8:1",
    passage: "Romans 8:1",
    language: "greek",
    originalSource: "SBLGNT",
    netFallback: "There is therefore now no condemnation for those who are in Christ Jesus.",
    original: "Οὐδὲν ἄρα νῦν κατάκριμα τοῖς ἐν Χριστῷ Ἰησοῦ.",
    parses: []
  },
  {
    reference: "Deuteronomy 6:4",
    passage: "Deuteronomy 6:4",
    language: "hebrew",
    originalSource: "WLC",
    netFallback: "Listen, Israel: The Lord is our God, the Lord is one.",
    original: "שְׁמַע יִשְׂרָאֵל יְהוָה אֱלֹהֵינוּ יְהוָה אֶחָד.",
    parses: [["שְׁמַע", "Qal imperative, masculine singular"]]
  },
  {
    reference: "Matthew 28:19",
    passage: "Matthew 28:19",
    language: "greek",
    originalSource: "SBLGNT",
    netFallback: "Therefore go and make disciples of all nations, baptizing them in the name of the Father and the Son and the Holy Spirit.",
    original: "πορευθέντες οὖν μαθητεύσατε πάντα τὰ ἔθνη, βαπτίζοντες αὐτοὺς εἰς τὸ ὄνομα τοῦ πατρὸς καὶ τοῦ υἱοῦ καὶ τοῦ ἁγίου πνεύματος.",
    parses: [["πορευθέντες", "aorist passive participle, nominative masculine plural"], ["μαθητεύσατε", "aorist active imperative, 2nd plural"], ["βαπτίζοντες", "present active participle, nominative masculine plural"]]
  },
  {
    reference: "Isaiah 40:31",
    passage: "Isaiah 40:31",
    language: "hebrew",
    originalSource: "WLC",
    netFallback: "But those who wait for the Lord will renew their strength; they will soar on wings like eagles.",
    original: "וְקוֹיֵ יְהוָה יַחֲלִיפוּ כֹחַ יַעֲלוּ אֵבֶר כַּנְּשָׁרִים.",
    parses: [["יַחֲלִיפוּ", "Hiphil imperfect, 3rd masculine plural"], ["יַעֲלוּ", "Qal imperfect, 3rd masculine plural"]]
  },
  {
    reference: "Ephesians 2:8",
    passage: "Ephesians 2:8",
    language: "greek",
    originalSource: "SBLGNT",
    netFallback: "For by grace you are saved through faith, and this is not from yourselves, it is the gift of God.",
    original: "τῇ γὰρ χάριτί ἐστε σεσῳσμένοι διὰ πίστεως· καὶ τοῦτο οὐκ ἐξ ὑμῶν, θεοῦ τὸ δῶρον.",
    parses: [["ἐστε", "present active indicative, 2nd plural"], ["σεσῳσμένοι", "perfect passive participle, nominative masculine plural"]]
  },
  {
    reference: "Numbers 6:24",
    passage: "Numbers 6:24",
    language: "hebrew",
    originalSource: "WLC",
    netFallback: "The Lord bless you and protect you.",
    original: "יְבָרֶכְךָ יְהוָה וְיִשְׁמְרֶךָ.",
    parses: [["יְבָרֶכְךָ", "Piel imperfect, 3rd masculine singular with 2nd masculine singular suffix"], ["יִשְׁמְרֶךָ", "Qal imperfect, 3rd masculine singular with 2nd masculine singular suffix"]]
  },
  {
    reference: "Colossians 1:15",
    passage: "Colossians 1:15",
    language: "greek",
    originalSource: "SBLGNT",
    netFallback: "He is the image of the invisible God, the firstborn over all creation.",
    original: "ὅς ἐστιν εἰκὼν τοῦ θεοῦ τοῦ ἀοράτου, πρωτότοκος πάσης κτίσεως.",
    parses: [["ἐστιν", "present active indicative, 3rd singular"]]
  },
  {
    reference: "Micah 6:8",
    passage: "Micah 6:8",
    language: "hebrew",
    originalSource: "WLC",
    netFallback: "He has told you, O man, what is good, and what the Lord really wants from you.",
    original: "הִגִּיד לְךָ אָדָם מַה־טּוֹב וּמָה־יְהוָה דּוֹרֵשׁ מִמְּךָ.",
    parses: [["הִגִּיד", "Hiphil perfect, 3rd masculine singular"], ["דּוֹרֵשׁ", "Qal participle, masculine singular"]]
  },
  {
    reference: "1 Peter 1:3",
    passage: "1 Peter 1:3",
    language: "greek",
    originalSource: "SBLGNT",
    netFallback: "Blessed be the God and Father of our Lord Jesus Christ, who according to his great mercy gave us new birth into a living hope.",
    original: "Εὐλογητὸς ὁ θεὸς καὶ πατὴρ τοῦ κυρίου ἡμῶν Ἰησοῦ Χριστοῦ, ὁ κατὰ τὸ πολὺ αὐτοῦ ἔλεος ἀναγεννήσας ἡμᾶς εἰς ἐλπίδα ζῶσαν.",
    parses: [["ἀναγεννήσας", "aorist active participle, nominative masculine singular"], ["ζῶσαν", "present active participle, accusative feminine singular"]]
  }
];

function saveState(options) {
  options = options || {};
  if (options.touch !== false) state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (options.cloud !== false) queueCloudStateSave();
}

function syncableStateSnapshot() {
  return {
    settings: state.settings,
    events: state.events,
    plans: state.plans,
    tasks: state.tasks,
    taskGroups: state.taskGroups,
    templates: state.templates,
    activeTemplateId: state.activeTemplateId,
    rssFeeds: state.rssFeeds,
    activeRssSource: state.activeRssSource,
    rssReadMoreUrl: state.rssReadMoreUrl,
    updatedAt: state.updatedAt || new Date().toISOString()
  };
}

function mergeCloudState(remote) {
  if (!remote || typeof remote !== "object") return false;
  var localUpdated = Date.parse(state.updatedAt || "") || 0;
  var remoteUpdated = Date.parse(remote.updatedAt || "") || 0;
  if (localUpdated && remoteUpdated && localUpdated > remoteUpdated) return false;
  state.settings = Object.assign({}, state.settings, remote.settings || {});
  state.events = (remote.events || state.events || []).map(normalizeEvent);
  state.plans = (remote.plans || state.plans || []).map(normalizeEvent);
  state.tasks = (remote.tasks || state.tasks || []).map(function (task, index) {
    task.groupId = task.groupId || "";
    task.sortOrder = typeof task.sortOrder === "number" ? task.sortOrder : index;
    return task;
  });
  state.taskGroups = (remote.taskGroups || state.taskGroups || []).map(function (group, index) {
    return {
      id: group.id || id("task-group"),
      name: group.name || "Untitled group",
      collapsed: !!group.collapsed,
      sortOrder: typeof group.sortOrder === "number" ? group.sortOrder : index
    };
  });
  state.templates = remote.templates || state.templates || [];
  state.activeTemplateId = remote.activeTemplateId || state.activeTemplateId || null;
  state.rssFeeds = remote.rssFeeds || state.rssFeeds || [];
  state.activeRssSource = remote.activeRssSource || state.activeRssSource || "";
  state.rssReadMoreUrl = remote.rssReadMoreUrl || state.rssReadMoreUrl || "";
  state.updatedAt = remote.updatedAt || state.updatedAt || "";
  saveState({ touch: false, cloud: false });
  return true;
}

function queueCloudStateSave() {
  if (!cloudSession || !cloudStateLoaded || cloudSaveInFlight) return;
  window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(saveCloudState, 900);
}

async function saveCloudState() {
  if (!cloudClient || !cloudSession) return;
  cloudSaveInFlight = true;
  try {
    state.updatedAt = state.updatedAt || new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    var payload = syncableStateSnapshot();
    var response = await dashboardFetch("/api/dashboard-sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: payload })
    });
    var data = await readDashboardJson(response, "dashboard-sync save");
    if (data && data.state && data.state.updatedAt) {
      state.updatedAt = data.state.updatedAt;
      saveState({ touch: false, cloud: false });
    }
    setCloudStatus("sync", "ok", "Dashboard saved to cloud.");
  } catch (error) {
    console.warn(error);
    setCloudStatus("sync", "warn", hostedHint("dashboard-sync save", error));
  } finally {
    cloudSaveInFlight = false;
  }
}

async function loadCloudState() {
  if (!cloudClient || !cloudSession) return;
  var shouldUploadLocal = false;
  try {
    var response = await dashboardFetch("/api/dashboard-sync", { cache: "no-store" });
    var data = await readDashboardJson(response, "dashboard-sync load");
    var remote = data && data.state ? data.state : null;
    if (remote && Object.keys(remote).length) {
      var localUpdated = Date.parse(state.updatedAt || "") || 0;
      var remoteUpdated = Date.parse(remote.updatedAt || "") || 0;
      if (localUpdated && remoteUpdated && localUpdated > remoteUpdated) {
        shouldUploadLocal = true;
        setCloudStatus("sync", "checking", "This device has newer changes. Uploading them to cloud...");
      } else if (mergeCloudState(remote)) {
        renderAll();
        renderRssFeeds();
        showToast("Synced dashboard data loaded.");
        setCloudStatus("sync", "ok", "Cloud dashboard data loaded.");
      } else {
        setCloudStatus("sync", "ok", "Cloud dashboard data is current.");
      }
    } else {
      shouldUploadLocal = true;
      setCloudStatus("sync", "checking", "No cloud dashboard found. Seeding this account from this device...");
    }
  } catch (error) {
    console.warn(error);
    setCloudStatus("sync", "warn", hostedHint("dashboard-sync load", error));
  } finally {
    cloudStateLoaded = true;
  }
  if (shouldUploadLocal) await saveCloudState();
}

function updateAccountButton() {
  if (!els.accountButton) return;
  if (!cloudAvailable()) {
    els.accountButton.hidden = true;
    return;
  }
  els.accountButton.hidden = false;
  var email = cloudSession && cloudSession.user && cloudSession.user.email ? cloudSession.user.email : "";
  els.accountButton.classList.toggle("connected", !!email);
  els.accountButton.title = email ? "Signed in as " + email + ". Click to sign out." : "Sign in to sync";
  els.accountButton.setAttribute("aria-label", email ? "Signed in. Click to sign out." : "Sign in to sync");
  renderCloudStatus();
}

function applyHostedModeUi() {
  document.body.classList.toggle("hosted-dashboard", isHostedDashboard);
  if (els.apiSportsKeySetting) els.apiSportsKeySetting.hidden = isHostedDashboard;
  if (els.cloudPrivateSettingsNote) els.cloudPrivateSettingsNote.hidden = !isHostedDashboard;
  if (els.accountButton) {
    els.accountButton.title = isHostedDashboard ? "Sign in / Account sync" : "Local account sync";
  }
}

function cloudStatusClass(state) {
  return state === "ok" ? "ok" : state === "warn" ? "warn" : state === "checking" ? "checking" : "idle";
}

function cloudStatusText(state) {
  return state === "ok" ? "OK" : state === "warn" ? "Needs attention" : state === "checking" ? "Checking" : "Not checked";
}

function setCloudStatus(key, state, detail) {
  cloudStatusChecks[key] = { state: state, detail: detail };
  renderCloudStatus();
}

function renderCloudStatus() {
  if (!els.cloudStatusGrid) return;
  var labels = {
    auth: "Supabase sign-in",
    sync: "Dashboard sync",
    news: "News functions",
    sports: "Sports function",
    rss: "RSS / article functions",
    language: "Language Lab",
    google: "Google Calendar"
  };
  els.cloudStatusGrid.innerHTML = Object.keys(labels).map(function (key) {
    var item = cloudStatusChecks[key] || { state: "idle", detail: "Not checked yet." };
    return "<div class='cloud-status-row " + cloudStatusClass(item.state) + "'><span class='cloud-status-dot'></span><strong>" + labels[key] + "</strong><em>" + cloudStatusText(item.state) + "</em><p>" + escapeHTML(item.detail || "") + "</p></div>";
  }).join("");
}

async function checkCloudEndpoint(key, label, request, okDetail) {
  setCloudStatus(key, "checking", "Checking " + label + "...");
  try {
    var response = await request();
    var payload = await readDashboardJson(response, label);
    setCloudStatus(key, "ok", okDetail(payload));
    return payload;
  } catch (error) {
    setCloudStatus(key, "warn", hostedHint(label, error));
    return null;
  }
}

async function runCloudStatusChecks() {
  renderCloudStatus();
  if (!isHostedDashboard) {
    setCloudStatus("auth", "ok", "Local dashboard mode. Cloud sign-in is optional here.");
  } else if (!cloudAvailable()) {
    setCloudStatus("auth", "warn", "Supabase client could not load from the CDN.");
  } else if (cloudSession && cloudSession.user) {
    setCloudStatus("auth", "ok", "Signed in as " + (cloudSession.user.email || "your Supabase account") + ".");
  } else {
    setCloudStatus("auth", "warn", "Not signed in. Click the account icon at the top right.");
  }

  if (!cloudSession) {
    setCloudStatus("sync", "warn", "Sign in first so dashboard state can sync across devices.");
  } else {
    await checkCloudEndpoint("sync", "dashboard-sync", function () {
      return dashboardFetch("/api/dashboard-sync", { cache: "no-store" });
    }, function () {
      return "Dashboard state sync is reachable.";
    });
  }

  await checkCloudEndpoint("news", "news-sources", function () {
    return dashboardFetch("/api/news-sources", { cache: "no-store" });
  }, function (payload) {
    var total = ["world", "philippines", "theology"].reduce(function (sum, section) { return sum + ((payload && payload[section]) || []).length; }, 0);
    return total ? total + " source choices loaded." : "Function responded, but returned no source choices.";
  });

  await checkCloudEndpoint("sports", "sports/mlb", function () {
    return dashboardFetch("/api/sports/mlb?statusCheck=1", { cache: "no-store" });
  }, function (payload) {
    if (payload && payload.errors && payload.errors.length) return "Function responded, but upstream sports feed reported warnings.";
    return "MLB scoreboard function is reachable.";
  });

  setCloudStatus("rss", "checking", "Checking RSS and article functions...");
  try {
    var rssResponse = await dashboardFetch("/api/rss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feeds: [] })
    });
    await readDashboardJson(rssResponse, "rss");
    var articleResponse = await dashboardFetch("/api/article", { cache: "no-store" });
    if (articleResponse.status !== 400) await readDashboardJson(articleResponse, "article");
    setCloudStatus("rss", "ok", "RSS and article functions are reachable.");
  } catch (error) {
    setCloudStatus("rss", "warn", hostedHint("rss/article", error));
  }

  await checkCloudEndpoint("language", "languages", function () {
    return dashboardFetch("/api/languages", { cache: "no-store" });
  }, function (payload) {
    var vocabulary = payload && payload.vocabulary ? payload.vocabulary : {};
    if (!vocabulary.greek || !vocabulary.hebrew) throw new Error("Language Lab vocabulary is missing.");
    var videos = payload && payload.videos ? payload.videos : {};
    var videoCount = ["greek", "hebrew", "septuagint"].reduce(function (sum, key) {
      return sum + (((videos[key] || {}).items || []).length);
    }, 0);
    return videoCount ? "Vocabulary and " + videoCount + " video entries loaded." : "Vocabulary loaded. Video feeds returned no entries yet.";
  });

  setCloudStatus("google", "checking", "Checking Google Calendar...");
  var status = await loadGoogleCalendarStatus();
  if (!cloudSession) setCloudStatus("google", "warn", "Sign in before connecting Google Calendar.");
  else if (!status.configured) setCloudStatus("google", "warn", googleCalendarLastMessage || "Google Calendar OAuth secrets are missing or not deployed.");
  else if (status.connected) {
    try {
      var diagnostics = await loadGoogleCalendarDiagnostics();
      setGoogleCalendarDiagnosticStatus(diagnostics);
    } catch (error) {
      setCloudStatus("google", "warn", hostedHint("google-calendar/diagnostics", error));
    }
  }
  else setCloudStatus("google", "warn", "Configured, but not connected. Click Connect Google Calendar.");
}

async function syncCloudNow(showNotice) {
  if (!cloudAvailable()) {
    showToast("Dashboard sync is not available yet.");
    return;
  }
  if (!cloudSession) {
    setCloudStatus("sync", "warn", "Sign in first so dashboard state can sync across devices.");
    showToast("Sign in to dashboard sync first.");
    return;
  }
  setCloudStatus("sync", "checking", "Syncing dashboard state...");
  await loadCloudState();
  if (showNotice) showToast("Dashboard sync checked.");
}

async function initCloudIdentity() {
  if (!cloudAvailable()) return;
  cloudClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  var sessionResult = await cloudClient.auth.getSession();
  cloudSession = sessionResult && sessionResult.data ? sessionResult.data.session : null;
  updateAccountButton();
  if (cloudSession) {
    await loadCloudState();
    await refreshGoogleCalendar(false);
  }
  cloudClient.auth.onAuthStateChange(function (_event, session) {
    cloudSession = session;
    updateAccountButton();
    if (cloudSession) {
      loadCloudState();
      refreshGoogleCalendar(false);
    }
  });
}

async function toggleCloudSignIn() {
  if (!cloudClient) {
    showToast("Supabase sync is not available yet.");
    return;
  }
  if (cloudSession) {
    await saveCloudState();
    await cloudClient.auth.signOut();
    cloudSession = null;
    cloudStateLoaded = false;
    updateAccountButton();
    showToast("Signed out of dashboard sync.");
    return;
  }
  await cloudClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: isHostedDashboard ? CLOUD_APP_URL : window.location.origin + window.location.pathname
    }
  });
}

function showToast(message) {
  var existing = document.querySelector(".toast");
  if (existing) existing.remove();
  var toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  var host = [els.eventModal, els.scheduleModal, els.settingsModal, els.sourceModal, els.readerModal, els.splitReaderModal, els.languageVideoModal].find(function (dialog) {
    return dialog && dialog.open;
  }) || document.body;
  host.appendChild(toast);
  window.setTimeout(function () { toast.remove(); }, 3200);
}

function renderGreeting() {
  var now = new Date();
  var timeZone = dashboardTimeZone();
  var parts = datePartsInTimeZone(now, timeZone);
  var hour = parts.hour;
  var greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
  var name = state.settings.preferredName.trim();
  els.greeting.textContent = name ? greeting + ", " + name : greeting;
  els.todayLabel.textContent = now.toLocaleDateString(undefined, { weekday: "long", timeZone: timeZone });
  els.dateLine.textContent = now.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric", timeZone: timeZone });
  els.timeLine.textContent = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: state.settings.timeFormat === "12", timeZone: timeZone });
}

function renderVerseOfDay() {
  var start = parseISO("2026-01-01").getTime();
  var today = parseISO(dashboardTodayISO()).getTime();
  var index = Math.floor((today - start) / 86400000) % DAILY_VERSES.length;
  if (index < 0) index = 0;
  var verse = DAILY_VERSES[index];
  activeVerse = verse;
  els.verseReference.textContent = verse.reference;
  els.verseText.textContent = verseTextCache[verse.passage] || verse.netFallback;
  els.verseText.title = verseTextCache[verse.passage] ? "NET Bible" : "NET fallback text";
  els.originalLine.innerHTML = highlightedOriginalText(verse);
  els.originalLine.classList.toggle("hebrew-text", verse.language === "hebrew");
  els.originalLine.classList.toggle("greek-text", verse.language !== "hebrew");
  els.verseDetails.classList.toggle("hebrew-text", verse.language === "hebrew");
  els.verseDetails.classList.toggle("greek-text", verse.language !== "hebrew");
  els.verseSource.textContent = "English: NET. " + (verse.language === "hebrew" ? "Hebrew: " : "Greek: ") + verse.originalSource + ". Verb parsing shown below.";
  var dl = els.verseDetails.querySelector("dl");
  dl.innerHTML = "";
  verse.parses.forEach(function (parse) {
    var row = document.createElement("div");
    var term = document.createElement("dt");
    var detail = document.createElement("dd");
    term.textContent = parse[0];
    detail.textContent = parse[1];
    row.append(term, detail);
    dl.appendChild(row);
  });
  loadNetVerse(verse);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightedOriginalText(verse) {
  var html = escapeHTML(verse.original || "");
  (verse.parses || []).forEach(function (parse) {
    var word = parse && parse[0];
    if (!word) return;
    html = html.replace(new RegExp(escapeRegExp(escapeHTML(word)), "g"), "<strong class='verse-verb'>" + escapeHTML(word) + "</strong>");
  });
  return html;
}

function loadNetVerse(verse) {
  if (!verse || verseTextCache[verse.passage] || verseFetches[verse.passage]) return;
  verseFetches[verse.passage] = dashboardFetch("/api/bible/net?passage=" + encodeURIComponent(verse.passage))
    .then(function (response) {
      if (!response.ok) throw new Error("NET request failed");
      return response.json();
    })
    .then(function (data) {
      if (data && data.text) verseTextCache[verse.passage] = data.text;
      if (activeVerse && activeVerse.passage === verse.passage && verseTextCache[verse.passage]) {
        els.verseText.textContent = verseTextCache[verse.passage];
        els.verseText.title = "NET Bible";
      }
    })
    .catch(function () {
      if (activeVerse && activeVerse.passage === verse.passage) els.verseText.title = "NET fallback text";
    })
    .finally(function () {
      delete verseFetches[verse.passage];
    });
}

function openSettings() {
  els.preferredName.value = state.settings.preferredName || "";
  els.timeFormat.value = state.settings.timeFormat || "24";
  if (els.timeZone) els.timeZone.value = state.settings.timeZone || "Asia/Manila";
  if (els.apiSportsKey) els.apiSportsKey.value = "";
  if (els.apiSportsKeySetting) els.apiSportsKeySetting.hidden = isHostedDashboard;
  if (els.cloudPrivateSettingsNote) els.cloudPrivateSettingsNote.hidden = !isHostedDashboard;
  renderCloudStatus();
  renderGoogleCalendarChoices();
  if (typeof els.settingsModal.showModal === "function") els.settingsModal.showModal();
  loadGoogleCalendarStatus().then(function (status) {
    if (status && status.connected) loadGoogleCalendarChoices(false);
  });
  runCloudStatusChecks();
}

function openVaultPlaceholder() {
  showToast("Obsidian vault settings were removed for now. We can reconnect this later.");
}

function calendarVisibleRange() {
  if (calendarMode === "birthdays") {
    var birthdayStart = new Date(viewDate.getFullYear(), 0, 1);
    var birthdayEnd = new Date(viewDate.getFullYear() + 1, 11, 31);
    return {
      timeMin: zonedDateTimeToDate(toISO(birthdayStart), "00:00", dashboardTimeZone()).toISOString(),
      timeMax: zonedDateTimeToDate(toISO(birthdayEnd), "23:59", dashboardTimeZone()).toISOString()
    };
  }
  var weekMode = calendarMode === "schedule" || calendarMode === "class-schedule";
  var base = weekMode ? scheduleWeekStart : new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  var start = weekMode ? startOfWeek(base) : addDays(base, -base.getDay());
  var end = weekMode ? addDays(start, 7) : addDays(start, 42);
  return {
    timeMin: zonedDateTimeToDate(toISO(start), "00:00", dashboardTimeZone()).toISOString(),
    timeMax: zonedDateTimeToDate(toISO(end), "23:59", dashboardTimeZone()).toISOString()
  };
}

function updateGoogleCalendarControls() {
  if (!els.googleCalendarButton) return;
  els.googleCalendarButton.disabled = googleCalendarLoading;
  if (els.googleCalendarSyncButton) {
    els.googleCalendarSyncButton.disabled = googleCalendarLoading || !googleCalendarStatus.connected || googleCalendarStatus.needsReconnect;
    els.googleCalendarSyncButton.hidden = !googleCalendarStatus.connected || googleCalendarStatus.needsReconnect;
    els.googleCalendarSyncButton.textContent = googleCalendarLoading ? "Syncing..." : "Sync Google";
    els.googleCalendarSyncButton.title = "Refresh Google Calendar events for the visible calendar range.";
  }
  if (els.googleCalendarReconnectButton) {
    els.googleCalendarReconnectButton.disabled = googleCalendarLoading || !googleCalendarStatus.connected;
    els.googleCalendarReconnectButton.hidden = !googleCalendarStatus.connected;
    els.googleCalendarReconnectButton.textContent = googleCalendarLoading ? "Working..." : "Reconnect Google";
    els.googleCalendarReconnectButton.title = "Clear the saved Google Calendar permission and ask Google for fresh Calendar access.";
  }
  if (!googleCalendarStatus.configured) {
    els.googleCalendarButton.textContent = "Connect Google Calendar";
    els.googleCalendarButton.title = googleCalendarLastMessage || "Google Calendar OAuth is not configured yet.";
  } else if (googleCalendarStatus.connected) {
    els.googleCalendarButton.textContent = googleCalendarLoading ? "Syncing..." : "Google Connected";
    els.googleCalendarButton.title = googleCalendarStatus.needsReconnect ? "Use Reconnect Google to approve the latest permissions." : googleCalendarAccountLabel() || "Google Calendar is connected.";
  } else {
    els.googleCalendarButton.textContent = "Connect Google Calendar";
    els.googleCalendarButton.title = "Connect Google Calendar.";
  }
  renderGoogleCalendarChoices();
}

function googleCalendarAccountLabel() {
  if (!googleCalendarStatus.connected) return "";
  return googleCalendarStatus.account && googleCalendarStatus.account.email ? googleCalendarStatus.account.email : "Google Calendar";
}

function recurrenceStep(rule) {
  var normalized = normalizeRepeatRule(rule);
  if (normalized.frequency === "daily") return { unit: "day", amount: normalized.interval || 1 };
  if (normalized.frequency === "weekly") return { unit: "week", amount: normalized.interval || 1 };
  if (normalized.frequency === "monthly") return { unit: "month", amount: normalized.interval || 1 };
  if (normalized.frequency === "yearly") return { unit: "year", amount: normalized.interval || 1 };
  if (normalized.frequency === "custom") return { unit: normalized.unit || "week", amount: normalized.interval || 1 };
  return null;
}

function advanceRecurrenceDate(date, step) {
  if (!step) return null;
  if (step.unit === "day") return addDays(date, step.amount);
  if (step.unit === "week") return addDays(date, step.amount * 7);
  if (step.unit === "month") return addMonths(date, step.amount);
  if (step.unit === "year") return addYears(date, step.amount);
  return null;
}

function isRecurringEvent(item) {
  return item && normalizeRepeatRule(item.repeatRule).frequency !== "none";
}

function generatedOccurrence(base, occurrenceStartISO) {
  var duration = dayDiff(base.start, base.end || base.start);
  var occurrence = createEvent(Object.assign({}, base, {
    id: base.id + "::occ::" + occurrenceStartISO,
    start: occurrenceStartISO,
    end: toISO(addDays(parseISO(occurrenceStartISO), duration)),
    recurrenceInstance: true,
    occurrenceOf: base.id,
    occurrenceDate: occurrenceStartISO
  }));
  generatedOccurrenceMap[occurrence.id] = occurrence;
  return occurrence;
}

function recurringOccurrencesForRange(event, startISO, endISO) {
  var rule = normalizeRepeatRule(event.repeatRule);
  var step = recurrenceStep(rule);
  if (!step || !event.start) return [];
  var rangeEnd = parseISO(endISO);
  var stopDate = rule.endMode === "on" && rule.endDate ? parseISO(rule.endDate) : null;
  var date = parseISO(event.start);
  var items = [];
  var guard = 0;
  while (date <= rangeEnd && guard < 1000) {
    var iso = toISO(date);
    if ((!stopDate || date <= stopDate) && isWithinRange({ start: iso, end: iso }, startISO, endISO)) {
      items.push(generatedOccurrence(event, iso));
    }
    date = advanceRecurrenceDate(date, step);
    guard += 1;
    if (!date) break;
  }
  return items;
}

function isWithinRange(item, startISO, endISO) {
  var itemStart = parseISO(item.start).getTime();
  var itemEnd = parseISO(item.end || item.start).getTime();
  var rangeStart = parseISO(startISO).getTime();
  var rangeEnd = parseISO(endISO).getTime();
  return itemStart <= rangeEnd && itemEnd >= rangeStart;
}

function eventIsBirthday(item) {
  if (!item) return false;
  var title = String(item.title || "").toLowerCase();
  var hasBirthdayText = title.indexOf("birthday") > -1 || title.indexOf("bday") > -1;
  var yearlyRule = normalizeRepeatRule(item.repeatRule).frequency === "yearly";
  var googleYearly = (item.recurrence || []).some(function (rule) { return /FREQ=YEARLY/i.test(rule); });
  var googleRecurringBirthday = !!item.googleRecurringEventId && hasBirthdayText;
  return hasBirthdayText && (yearlyRule || googleYearly || googleRecurringBirthday);
}

function visibleCalendarEvents(startISO, endISO, options) {
  var settings = options || {};
  var items = [];
  state.events.forEach(function (item) {
    if (state.settings.hideBirthdaysFromCalendar && !settings.includeBirthdays && eventIsBirthday(item)) return;
    if (settings.onlyBirthdays && !eventIsBirthday(item)) return;
    if (isRecurringEvent(item)) {
      items = items.concat(recurringOccurrencesForRange(item, startISO, endISO));
    } else if (isWithinRange(item, startISO, endISO)) {
      items.push(item);
    }
  });
  return items;
}

function findEventForView(eventId) {
  return state.events.find(function (item) { return item.id === eventId; }) || generatedOccurrenceMap[eventId] || null;
}

async function loadGoogleCalendarStatus() {
  googleCalendarLastMessage = "";
  try {
    var response = await dashboardFetch("/api/google-calendar/status", { cache: "no-store" });
    var payload = await response.json().catch(function () { return null; });
    if (!response.ok && payload) {
      googleCalendarStatus = Object.assign({ configured: false, connected: false, redirectUri: "" }, payload);
      googleCalendarLastMessage = payload.error || "Sign in required.";
    } else if (!response.ok) {
      throw new Error("Status request failed");
    } else {
      googleCalendarStatus = payload;
    }
  } catch (error) {
    googleCalendarStatus = { configured: false, connected: false, redirectUri: "" };
    googleCalendarLastMessage = hostedHint("google-calendar/status", error);
  }
  updateGoogleCalendarControls();
  return googleCalendarStatus;
}

function googleCalendarRangeQuery() {
  var range = calendarVisibleRange();
  return {
    range: range,
    query: "?timeMin=" + encodeURIComponent(range.timeMin) + "&timeMax=" + encodeURIComponent(range.timeMax) + "&timeZone=" + encodeURIComponent(dashboardTimeZone())
  };
}

function googleCalendarSelectionQuery() {
  if (state.settings.googleCalendarUseAll !== false) return "";
  return "&calendarIds=" + encodeURIComponent((state.settings.googleCalendarIds || []).join(","));
}

function renderGoogleCalendarChoices() {
  if (!els.googleCalendarList) return;
  if (!googleCalendarStatus.connected) {
    els.googleCalendarList.innerHTML = '<p class="empty-state">Connect Google Calendar, then load calendars.</p>';
    return;
  }
  if (!googleCalendarChoices.length) {
    els.googleCalendarList.innerHTML = '<p class="empty-state">Load calendars to choose which ones appear here.</p>';
    return;
  }
  var allIds = googleCalendarChoices.map(function (calendar) { return calendar.id; });
  var activeIds = state.settings.googleCalendarUseAll === false ? state.settings.googleCalendarIds || [] : allIds;
  var activeSet = new Set(activeIds);
  els.googleCalendarList.innerHTML = googleCalendarChoices.map(function (calendar) {
    var color = calendar.backgroundColor || "#F0D08F";
    var meta = (calendar.primary ? "Primary" : calendar.accessRole || "Calendar");
    return '<label class="google-calendar-choice">'
      + '<input type="checkbox" data-calendar-id="' + escapeAttr(calendar.id) + '"' + (activeSet.has(calendar.id) ? " checked" : "") + '>'
      + '<span class="calendar-color-dot" style="background:' + escapeAttr(color) + '"></span>'
      + '<span><span class="google-calendar-name">' + escapeHTML(calendar.summary || calendar.id) + '</span><span class="google-calendar-meta">' + escapeHTML(meta) + '</span></span>'
      + '</label>';
  }).join("");
  els.googleCalendarList.querySelectorAll("input[data-calendar-id]").forEach(function (input) {
    input.addEventListener("change", function () {
      state.settings.googleCalendarUseAll = false;
      state.settings.googleCalendarIds = Array.from(els.googleCalendarList.querySelectorAll("input[data-calendar-id]:checked")).map(function (control) {
        return control.getAttribute("data-calendar-id");
      }).filter(Boolean);
      saveState();
      renderGoogleCalendarChoices();
      loadGoogleCalendarEvents(false);
    });
  });
}

async function loadGoogleCalendarChoices(showNotice) {
  if (!googleCalendarStatus.connected) {
    renderGoogleCalendarChoices();
    if (showNotice) showToast("Connect Google Calendar first.");
    return [];
  }
  try {
    var response = await dashboardFetch("/api/google-calendar/calendars", { cache: "no-store" });
    var payload = await readDashboardJson(response, "Google Calendar calendars");
    googleCalendarChoices = Array.isArray(payload.calendars) ? payload.calendars : [];
    renderGoogleCalendarChoices();
    if (showNotice) showToast(googleCalendarChoices.length ? "Google calendars loaded." : "No Google calendars were returned.");
    return googleCalendarChoices;
  } catch (error) {
    googleCalendarLastMessage = hostedHint("google-calendar/calendars", error);
    setCloudStatus("google", "warn", googleCalendarLastMessage);
    renderGoogleCalendarChoices();
    if (showNotice) showToast("Google calendar list needs attention.");
    return [];
  }
}

async function loadGoogleCalendarDiagnostics() {
  var rangeQuery = googleCalendarRangeQuery();
  var response = await dashboardFetch("/api/google-calendar/diagnostics" + rangeQuery.query + googleCalendarSelectionQuery(), { cache: "no-store" });
  return readDashboardJson(response, "Google Calendar diagnostics");
}

function googleCalendarDiagnosticDetail(payload) {
  if (!payload) return "Diagnostics returned no details.";
  if (!payload.configured) return "Google Calendar OAuth secrets are missing or not deployed.";
  if (!payload.connected) return "Google Calendar is configured, but this dashboard account is not connected yet.";
  if (!payload.hasRefreshToken) return "Google Calendar connection has no refresh token. Disconnect and reconnect Google Calendar.";
  if (payload.scope && payload.scope.length && !payload.hasCalendarReadonlyScope && !payload.hasCalendarEventsScope) {
    return "Google Calendar is connected, but the saved permission scope does not include calendar access. Disconnect and reconnect Google Calendar.";
  }
  if (!payload.tokenRefreshOk) return "Google Calendar token refresh failed: " + ((payload.errors || [])[0] || "Reconnect Google Calendar.");
  if (!payload.calendarListOk) return "Google Calendar calendar-list request failed: " + ((payload.errors || [])[0] || "No calendar-list response.");
  if (!payload.eventsOk) return "Google Calendar event request failed: " + ((payload.errors || [])[0] || "No event response from Google.");
  var calendarCount = Number(payload.calendarCount || 0);
  var eventCount = Number(payload.eventCount || 0);
  var rangeStart = payload.range && payload.range.timeMin ? formatShortDate(payload.range.timeMin) : "";
  var rangeEnd = payload.range && payload.range.timeMax ? formatShortDate(payload.range.timeMax) : "";
  var rangeText = rangeStart && rangeEnd ? " Range: " + rangeStart + "-" + rangeEnd + "." : "";
  var sampleText = payload.sampleEvents && payload.sampleEvents.length
    ? " Sample: " + payload.sampleEvents.slice(0, 3).map(function (event) { return event.title; }).join("; ") + "."
    : "";
  var warning = payload.errors && payload.errors.length ? " Warnings: " + payload.errors.slice(0, 2).join(" | ") : "";
  return "Connected to " + (googleCalendarAccountLabel() || "Google Calendar") + ". " + calendarCount + " calendar" + (calendarCount === 1 ? "" : "s") + " checked; " + eventCount + " event" + (eventCount === 1 ? "" : "s") + " returned." + rangeText + sampleText + warning;
}

function setGoogleCalendarDiagnosticStatus(payload) {
  var stateName = payload && payload.configured && payload.connected && payload.tokenRefreshOk && payload.calendarListOk && payload.eventsOk ? "ok" : "warn";
  setCloudStatus("google", stateName, googleCalendarDiagnosticDetail(payload));
}

async function startGoogleCalendarConnect() {
  if (!isHostedDashboard) {
    window.location.href = "/api/google-calendar/connect";
    return;
  }
  var response = await dashboardFetch("/api/google-calendar/connect", { cache: "no-store" });
  var data = await readDashboardJson(response, "Google Calendar connect");
  if (!data.authUrl) throw new Error("Missing Google auth URL");
  window.location.href = data.authUrl;
}

async function reconnectGoogleCalendar() {
  if (isHostedDashboard && !cloudSession) {
    showToast("Sign in first, then reconnect Google Calendar.");
    await toggleCloudSignIn();
    return;
  }
  await loadGoogleCalendarStatus();
  if (!googleCalendarStatus.configured) {
    showToast(isHostedDashboard ? "Google Calendar is not configured in Supabase yet." : "Google Calendar is not configured on this device yet.");
    return;
  }
  googleCalendarLoading = true;
  updateGoogleCalendarControls();
  try {
    if (googleCalendarStatus.connected) {
      var disconnectResponse = await dashboardFetch("/api/google-calendar/disconnect", { method: "POST", cache: "no-store" });
      await readDashboardJson(disconnectResponse, "Google Calendar disconnect");
    }
    googleCalendarStatus.connected = false;
    googleCalendarStatus.needsReconnect = false;
    updateGoogleCalendarControls();
    await startGoogleCalendarConnect();
  } catch (error) {
    googleCalendarLastMessage = hostedHint("google-calendar/reconnect", error);
    setCloudStatus("google", "warn", googleCalendarLastMessage);
    showToast("Google Calendar reconnect needs attention. Check Settings.");
  } finally {
    googleCalendarLoading = false;
    updateGoogleCalendarControls();
  }
}

async function loadGoogleCalendarEvents(showNotice, localSyncResult) {
  if (!cloudSession && isHostedDashboard) {
    if (showNotice) showToast("Sign in to dashboard sync first.");
    return;
  }
  if (!googleCalendarStatus.connected || googleCalendarStatus.needsReconnect || googleCalendarLoading) return;
  googleCalendarLoading = true;
  updateGoogleCalendarControls();
  try {
    var rangeQuery = googleCalendarRangeQuery();
    var range = rangeQuery.range;
    var response = await dashboardFetch("/api/google-calendar/events" + rangeQuery.query + googleCalendarSelectionQuery(), { cache: "no-store" });
    if (response.status === 401) {
      googleCalendarStatus.connected = false;
      updateGoogleCalendarControls();
      return;
    }
    var data = await readDashboardJson(response, "Google Calendar events");
    if (!data.ok) return;
    var syncedIds = state.events.reduce(function (ids, event) {
      if (event.source !== "google" && event.googleEventId) ids[event.googleEventId] = true;
      if (event.source !== "google" && event.googleRecurringEventId) ids[event.googleRecurringEventId] = true;
      return ids;
    }, {});
    var rawGoogleEvents = data.events || [];
    var googleEvents = rawGoogleEvents.map(normalizeEvent).filter(function (event) {
      return !syncedIds[event.googleEventId] && !syncedIds[event.googleRecurringEventId];
    });
    state.events = state.events.filter(function (event) { return event.source !== "google"; }).concat(googleEvents);
    saveState();
    renderAll();
    var count = googleEvents.length;
    var rawCount = rawGoogleEvents.length;
    var duplicateCount = Math.max(0, rawCount - count);
    var calendarCount = Number(data.calendarCount || 1);
    var rangeLabel = calendarCount + " calendar" + (calendarCount === 1 ? "" : "s") + " checked";
    var rangeStart = data.range && data.range.timeMin ? formatShortDate(data.range.timeMin) : formatShortDate(range.timeMin);
    var rangeEnd = data.range && data.range.timeMax ? formatShortDate(data.range.timeMax) : formatShortDate(range.timeMax);
    var rangeText = rangeStart && rangeEnd ? " Range: " + rangeStart + "-" + rangeEnd + "." : "";
    var duplicateText = duplicateCount ? " " + duplicateCount + " duplicate synced event" + (duplicateCount === 1 ? "" : "s") + " hidden." : "";
    var warning = data.errors && data.errors.length ? " Warnings: " + data.errors.slice(0, 2).join(" | ") : "";
    var localSyncText = "";
    if (localSyncResult && localSyncResult.attempted) {
      localSyncText = " " + localSyncResult.synced + " pending dashboard event" + (localSyncResult.synced === 1 ? " was" : "s were") + " uploaded.";
      if (localSyncResult.failed) localSyncText += " " + localSyncResult.failed + " still pending.";
    }
    var summary = count
      ? count + " Google Calendar event" + (count === 1 ? "" : "s") + " loaded; " + rangeLabel + "." + duplicateText + rangeText + localSyncText + warning
      : "Google Calendar returned " + rawCount + " event" + (rawCount === 1 ? "" : "s") + " for this view; " + rangeLabel + "." + duplicateText + rangeText + localSyncText + warning;
    setCloudStatus("google", data.errors && data.errors.length && !count ? "warn" : "ok", summary);
    if (showNotice) {
      var notice = count ? "Google Calendar synced: " + count + " event" + (count === 1 ? "" : "s") + "." : "Google Calendar synced. " + rawCount + " event" + (rawCount === 1 ? "" : "s") + " returned for this range.";
      if (localSyncResult && localSyncResult.attempted) {
        notice += " " + localSyncResult.synced + " pending dashboard event" + (localSyncResult.synced === 1 ? " was" : "s were") + " uploaded.";
        if (localSyncResult.failed) notice += " " + localSyncResult.failed + " still pending.";
      }
      showToast(notice);
    }
  } catch (error) {
    googleCalendarLastMessage = hostedHint("google-calendar/events", error);
    try {
      var diagnostics = await loadGoogleCalendarDiagnostics();
      setGoogleCalendarDiagnosticStatus(diagnostics);
    } catch (diagnosticError) {
      setCloudStatus("google", "warn", googleCalendarLastMessage + " Diagnostics also failed: " + hostedHint("google-calendar/diagnostics", diagnosticError));
    }
    if (showNotice) showToast("Google Calendar needs attention. Check Settings.");
  } finally {
    googleCalendarLoading = false;
    updateGoogleCalendarControls();
  }
}

function isGoogleReadOnlyEvent(item) {
  return item && item.source === "google";
}

function canSyncToGoogle(item) {
  return item && !item.draft && !item.taskDeadline && !isGoogleReadOnlyEvent(item);
}

function applyGoogleSyncResult(localEvent, googleEvent) {
  if (!localEvent || !googleEvent) return;
  localEvent.googleEventId = googleEvent.googleEventId || googleEvent.id || localEvent.googleEventId || "";
  localEvent.googleCalendarId = googleEvent.googleCalendarId || "primary";
  localEvent.htmlLink = googleEvent.htmlLink || localEvent.htmlLink || "";
  localEvent.updatedAt = googleEvent.updatedAt || googleEvent.updated || localEvent.updatedAt || "";
  localEvent.syncStatus = "synced";
  localEvent.lastSyncedAt = new Date().toISOString();
}

async function syncDashboardEventToGoogle(localEvent, showNotice) {
  if (!canSyncToGoogle(localEvent)) return false;
  if (!googleCalendarStatus.connected || googleCalendarStatus.needsReconnect) return false;
  localEvent.syncStatus = "syncing";
  saveState();
  try {
    var response = await dashboardFetch("/api/google-calendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: Object.assign({}, localEvent, { dashboardTimeZone: dashboardTimeZone() }) })
    });
    if (response.status === 401) {
      googleCalendarStatus.connected = false;
      updateGoogleCalendarControls();
      localEvent.syncStatus = "pending";
      return false;
    }
    if (!response.ok) throw new Error("Google event save failed");
    var data = await response.json();
    if (!data.ok) throw new Error(data.error || "Google event save failed");
    applyGoogleSyncResult(localEvent, data.event);
    if (showNotice) showToast("Event synced to Google Calendar.");
    return true;
  } catch (error) {
    localEvent.syncStatus = "pending";
    if (showNotice) showToast("Event saved locally. Google sync will need another try.");
    return false;
  } finally {
    saveState();
    renderCalendar();
    updateGoogleCalendarControls();
  }
}

function getPendingGoogleCalendarEvents() {
  return state.events.filter(function (event) {
    if (!canSyncToGoogle(event)) return false;
    if (event.syncStatus === "syncing") return false;
    return !event.googleEventId || event.syncStatus === "pending";
  });
}

async function syncPendingDashboardEventsToGoogle() {
  if (!googleCalendarStatus.connected || googleCalendarStatus.needsReconnect) {
    return { attempted: 0, synced: 0, failed: 0 };
  }

  var pendingEvents = getPendingGoogleCalendarEvents();
  var result = { attempted: pendingEvents.length, synced: 0, failed: 0 };

  for (var index = 0; index < pendingEvents.length; index += 1) {
    var synced = await syncDashboardEventToGoogle(pendingEvents[index], false);
    if (synced) result.synced += 1;
    else result.failed += 1;
    if (!googleCalendarStatus.connected || googleCalendarStatus.needsReconnect) break;
  }

  return result;
}

async function deleteGoogleCalendarEvent(localEvent) {
  if (!localEvent || !localEvent.googleEventId || !googleCalendarStatus.connected || googleCalendarStatus.needsReconnect) return false;
  try {
    var response = await dashboardFetch("/api/google-calendar/events/" + encodeURIComponent(localEvent.googleEventId), { method: "DELETE" });
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function refreshGoogleCalendar(showNotice) {
  await loadGoogleCalendarStatus();
  if (googleCalendarStatus.connected) {
    await loadGoogleCalendarChoices(false);
    var localSyncResult = await syncPendingDashboardEventsToGoogle();
    await loadGoogleCalendarEvents(showNotice, localSyncResult);
  }
  else if (showNotice && googleCalendarStatus.configured) showToast("Connect Google Calendar first.");
}

function handleGoogleCalendarReturnMessage() {
  var params = new URLSearchParams(window.location.search);
  var result = params.get("googleCalendar");
  if (!result) return;
  if (result === "connected") showToast("Google Calendar connected.");
  else if (result === "denied") showToast("Google Calendar connection was canceled.");
  else showToast("Google Calendar connection could not be completed.");
  params.delete("googleCalendar");
  var clean = window.location.pathname + (params.toString() ? "?" + params.toString() : "") + window.location.hash;
  window.history.replaceState({}, "", clean);
}

function getTaskDeadlineItems() {
  return state.tasks
    .filter(function (task) { return !task.done && !!task.dueDate; })
    .map(function (task) {
      return {
        id: task.id,
        title: "Task: " + task.title,
        start: task.dueDate,
        end: task.dueDate,
        taskDeadline: true,
        task: task
      };
    });
}

function eventTitle(item) {
  if (item.title) return item.title;
  if ((item.type === "Sermon" || item.type === "Bible Study" || item.type.indexOf("Prep") > -1) && item.passage) return item.type + ": " + item.passage;
  return item.type || "Event";
}

function eventTimingLabel(item) {
  if (item.allDay || item.timeSlot === "All Day") return "All Day";
  if (item.timeStart && item.timeEnd) return item.timeStart + "-" + item.timeEnd;
  if (item.timeStart) return item.timeStart;
  return item.timeSlot;
}

function eventDateRangeLabel(item) {
  return displayDate(item.start) + (item.end && item.end !== item.start ? " to " + displayDate(item.end) : "");
}

function viewEvent(eventId) {
  var item = findEventForView(eventId);
  if (!item) return;
  viewingEventId = eventId;
  els.eventDetailType.textContent = item.type || "Event";
  els.eventDetailTitle.textContent = eventTitle(item);
  els.eventDetailHero.style.backgroundImage = item.image
    ? "linear-gradient(145deg, rgba(73, 53, 72, 0.2), rgba(31, 30, 30, 0.22)), url('" + item.image + "')"
    : "";
  els.eventDetailHero.classList.toggle("has-image", !!item.image);

  var meta = [
    ["Date", eventDateRangeLabel(item)],
    ["Time", eventTimingLabel(item)],
    ["Location", item.location || "Not listed"]
  ];
  if (item.passage) meta.splice(2, 0, ["Passage", item.passage]);
  if (item.alarm && item.alarm !== "none") meta.push(["Alarm", alarmLabel(item.alarm)]);
  if (item.source === "google") meta.push(["Source", "Google Calendar"]);
  else if (item.googleEventId) meta.push(["Sync", "Google Calendar"]);
  els.eventDetailMeta.classList.toggle("no-passage", !item.passage);
  els.eventDetailMeta.innerHTML = meta.map(function (entry) {
    return "<div><span>" + escapeHTML(entry[0]) + "</span><strong>" + escapeHTML(entry[1]) + "</strong></div>";
  }).join("");
  els.eventDetailNotes.innerHTML = "<h3>Notes</h3><p>" + escapeHTML(item.notes || "No notes yet.") + "</p>";
  var readOnly = isGoogleReadOnlyEvent(item);
  var sourceEvent = state.events.find(function (event) {
    return event.id === item.id || event.id === item.occurrenceOf;
  }) || null;
  var checklistOwner = sourceEvent || item;
  var canReorderChecklist = !readOnly && !!sourceEvent;
  if (checklistOwner.checklist && checklistOwner.checklist.length) {
    var checklistHeading = document.createElement("h3");
    checklistHeading.textContent = "Checklist";
    var checklistList = document.createElement("ul");
    checklistList.className = "event-detail-checklist";
    checklistOwner.checklist.forEach(function (check) {
      var row = document.createElement("li");
      row.className = "event-detail-checklist-row" + (check.done ? " done" : "") + (canReorderChecklist ? " can-reorder" : "");
      row.dataset.itemId = check.id;
      if (canReorderChecklist) {
        var grip = document.createElement("button");
        grip.type = "button";
        grip.className = "event-detail-checklist-drag-handle";
        grip.innerHTML = dragHandleIcon();
        grip.setAttribute("aria-label", "Reorder " + (check.title || "checklist item"));
        grip.addEventListener("pointerdown", function (event) {
          beginEventDetailChecklistPointerDrag(event, sourceEvent, check, row, eventId);
        });
        row.appendChild(grip);
      }
      var toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.checked = !!check.done;
      toggle.disabled = readOnly || !sourceEvent;
      toggle.className = "event-detail-checklist-toggle";
      toggle.setAttribute("aria-label", "Mark " + (check.title || "checklist item") + " complete");
      toggle.addEventListener("change", function () {
        check.done = toggle.checked;
        var linkedTask = check.taskId ? state.tasks.find(function (task) { return task.id === check.taskId; }) : null;
        if (linkedTask) setTaskCompletion(linkedTask, check.done);
        else {
          saveState();
          renderAll();
        }
        viewEvent(eventId);
      });
      var text = document.createElement("span");
      text.className = "event-detail-check-title";
      text.textContent = check.title || "Untitled checklist item";
      var due = document.createElement("small");
      due.className = "event-detail-check-due";
    var checklistDate = check.dueDate || item.start || "";
    due.textContent = checklistDate ? "Due " + displayDate(checklistDate) : "";
    due.hidden = !checklistDate;
      row.append(toggle, text, due);
      checklistList.appendChild(row);
    });
    els.eventDetailChecklist.replaceChildren(checklistHeading, checklistList);
  } else {
    els.eventDetailChecklist.innerHTML = "<h3>Checklist</h3><p>No checklist items yet.</p>";
  }
  els.eventDetailEdit.hidden = readOnly;
  els.eventDetailDelete.hidden = readOnly;
  if (readOnly && item.htmlLink) {
    els.eventDetailNotes.innerHTML += "<p><a href='" + escapeHTML(item.htmlLink) + "' target='_blank' rel='noopener'>Open in Google Calendar</a></p>";
  }
  if (!els.eventDetailModal.open) els.eventDetailModal.showModal();
}

function clearEventDetailChecklistPointerDrag(commit) {
  if (!eventDetailChecklistPointerDrag) return;
  var drag = eventDetailChecklistPointerDrag;
  var list = drag.placeholder.parentElement;
  var nextItemId = "";
  if (list) {
    var siblings = Array.prototype.slice.call(list.children);
    var placeholderIndex = siblings.indexOf(drag.placeholder);
    for (var index = placeholderIndex + 1; index < siblings.length; index += 1) {
      if (siblings[index].classList && siblings[index].classList.contains("event-detail-checklist-row")) {
        nextItemId = siblings[index].dataset.itemId || "";
        break;
      }
    }
  }
  if (drag.placeholder.parentElement) drag.placeholder.remove();
  drag.row.classList.remove("pointer-dragging");
  drag.row.removeAttribute("style");
  eventDetailChecklistPointerDrag = null;
  document.removeEventListener("pointermove", moveEventDetailChecklistPointerDrag);
  document.removeEventListener("pointerup", finishEventDetailChecklistPointerDrag);
  document.removeEventListener("pointercancel", cancelEventDetailChecklistPointerDrag);
  if (!commit) {
    viewEvent(drag.viewEventId);
    return;
  }
  var ordered = (drag.sourceEvent.checklist || []).filter(function (check) { return check.id !== drag.itemId; });
  var position = ordered.length;
  if (nextItemId) {
    var nextIndex = ordered.findIndex(function (check) { return check.id === nextItemId; });
    if (nextIndex >= 0) position = nextIndex;
  }
  ordered.splice(position, 0, drag.item);
  drag.sourceEvent.checklist = ordered;
  ensureEventChecklistTasks(drag.sourceEvent);
  saveState();
  renderAll();
  viewEvent(drag.viewEventId);
}

function moveEventDetailChecklistPointerDrag(event) {
  if (!eventDetailChecklistPointerDrag || event.pointerId !== eventDetailChecklistPointerDrag.pointerId) return;
  var drag = eventDetailChecklistPointerDrag;
  drag.row.style.left = Math.max(8, event.clientX - drag.offsetX) + "px";
  drag.row.style.top = Math.max(8, event.clientY - drag.offsetY) + "px";
  var target = document.elementFromPoint(event.clientX, event.clientY);
  var list = target && target.closest(".event-detail-checklist");
  if (!list) return;
  var rows = Array.prototype.slice.call(list.children).filter(function (row) {
    return row.classList && row.classList.contains("event-detail-checklist-row");
  });
  var nextRow = rows.find(function (row) {
    var rect = row.getBoundingClientRect();
    return event.clientY < rect.top + (rect.height / 2);
  });
  if (nextRow) list.insertBefore(drag.placeholder, nextRow);
  else list.appendChild(drag.placeholder);
}

function finishEventDetailChecklistPointerDrag(event) {
  if (!eventDetailChecklistPointerDrag || event.pointerId !== eventDetailChecklistPointerDrag.pointerId) return;
  clearEventDetailChecklistPointerDrag(true);
}

function cancelEventDetailChecklistPointerDrag(event) {
  if (!eventDetailChecklistPointerDrag || event.pointerId !== eventDetailChecklistPointerDrag.pointerId) return;
  clearEventDetailChecklistPointerDrag(false);
}

function beginEventDetailChecklistPointerDrag(event, sourceEvent, item, row, viewEventId) {
  if (event.button !== 0 || eventDetailChecklistPointerDrag) return;
  event.preventDefault();
  event.stopPropagation();
  var rect = row.getBoundingClientRect();
  var placeholder = document.createElement("li");
  placeholder.className = "event-detail-check-placeholder";
  placeholder.style.height = rect.height + "px";
  row.parentElement.insertBefore(placeholder, row.nextSibling);
  row.classList.add("pointer-dragging");
  row.style.width = rect.width + "px";
  row.style.height = rect.height + "px";
  row.style.left = rect.left + "px";
  row.style.top = rect.top + "px";
  document.body.appendChild(row);
  eventDetailChecklistPointerDrag = {
    row: row,
    item: item,
    itemId: item.id,
    sourceEvent: sourceEvent,
    viewEventId: viewEventId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    placeholder: placeholder,
    pointerId: event.pointerId
  };
  if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
  document.addEventListener("pointermove", moveEventDetailChecklistPointerDrag);
  document.addEventListener("pointerup", finishEventDetailChecklistPointerDrag);
  document.addEventListener("pointercancel", cancelEventDetailChecklistPointerDrag);
}

function isMinistryPriority(item) {
  return item.type === "Sermon" || item.type === "Bible Study";
}

function hasGoogleItem(iso) {
  return visibleCalendarEvents(iso, iso).some(function (event) { return event.source === "google" && isWithin(iso, event.start, event.end); });
}

function isInSelection(iso) {
  if (!selectionStart || !selectionEnd) return false;
  var range = normalizeRange(selectionStart, selectionEnd);
  return isWithin(iso, range.start, range.end);
}

function renderCalendar() {
  els.calendarGrid.innerHTML = "";
  generatedOccurrenceMap = {};
  els.calendarPanel.classList.toggle("planning-mode", planningMode);
  els.calendarPanel.classList.toggle("schedule-mode", calendarMode === "schedule");
  els.calendarPanel.classList.toggle("class-schedule-mode", calendarMode === "class-schedule");
  els.calendarPanel.classList.toggle("birthday-mode", calendarMode === "birthdays");
  if (calendarMode === "schedule") {
    renderScheduleView();
    return;
  }
  if (calendarMode === "class-schedule") {
    renderClassScheduleView();
    return;
  }
  if (calendarMode === "birthdays") {
    renderBirthdayView();
    return;
  }
  renderMonthCalendar();
}

function birthdayName(item) {
  var title = String(eventTitle(item));
  return title
    .replace(/[’']s\s+birthday/ig, "")
    .replace(/[’']s\b/ig, "")
    .replace(/\bbirthday\b/ig, "")
    .replace(/\bbday\b/ig, "")
    .replace(/\s+/g, " ")
    .trim() || eventTitle(item);
}

function nextBirthdayOccurrence(item) {
  var today = parseISO(dashboardTodayISO());
  var sourceDate = parseISO(item.start);
  var candidate = new Date(today.getFullYear(), sourceDate.getMonth(), sourceDate.getDate());
  if (candidate < today) candidate.setFullYear(candidate.getFullYear() + 1);
  var iso = toISO(candidate);
  var duration = dayDiff(item.start, item.end || item.start);
  var occurrence = createEvent(Object.assign({}, item, {
    id: item.id + "::birthday::" + iso,
    start: iso,
    end: toISO(addDays(parseISO(iso), duration)),
    recurrenceInstance: true,
    occurrenceOf: item.id,
    occurrenceDate: iso
  }));
  generatedOccurrenceMap[occurrence.id] = occurrence;
  return occurrence;
}

function renderBirthdayView() {
  els.monthLabel.textContent = viewDate.getFullYear() + " Birthdays";
  els.monthLabel.classList.toggle("current-month", viewDate.getFullYear() === parseISO(dashboardTodayISO()).getFullYear());
  var wrapper = document.createElement("section");
  wrapper.className = "birthday-view";
  var tools = document.createElement("div");
  tools.className = "birthday-view-tools";
  tools.appendChild(document.createTextNode("Recurring yearly birthdays"));
  wrapper.appendChild(tools);

  var birthdayEvents = state.events.filter(eventIsBirthday);
  var seen = {};
  var birthdays = birthdayEvents.filter(function (item) {
    var key = birthdayName(item).toLowerCase() + "|" + item.start.slice(5);
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  }).sort(function (a, b) {
    var dateA = parseISO(a.start);
    var dateB = parseISO(b.start);
    return dateA.getMonth() - dateB.getMonth() || dateA.getDate() - dateB.getDate();
  });

  if (!birthdays.length) {
    wrapper.innerHTML += "<p class='empty-state'>No recurring yearly birthdays found yet.</p>";
    els.calendarGrid.appendChild(wrapper);
    return;
  }

  var grouped = Array.from({ length: 12 }, function () { return []; });
  birthdays.forEach(function (item) {
    grouped[parseISO(item.start).getMonth()].push(item);
  });

  grouped.forEach(function (monthItems, monthIndex) {
    var section = document.createElement("section");
    section.className = "birthday-month" + (monthIndex === openBirthdayMonthIndex ? " open" : "");
    var heading = document.createElement("button");
    heading.type = "button";
    heading.className = "birthday-month-heading";
    heading.innerHTML = "<span>" + new Date(viewDate.getFullYear(), monthIndex, 1).toLocaleDateString(undefined, { month: "long" }) + "</span><small>" + monthItems.length + "</small>";
    heading.addEventListener("click", function () {
      openBirthdayMonthIndex = monthIndex;
      renderCalendar();
    });
    section.appendChild(heading);
    var list = document.createElement("div");
    list.className = "birthday-list";
    monthItems.forEach(function (item) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "birthday-card";
      var date = parseISO(item.start);
      card.innerHTML = "<strong>" + date.getDate() + "</strong><span>" + escapeHTML(birthdayName(item)) + "</span>";
      card.addEventListener("click", function () {
        var occurrence = nextBirthdayOccurrence(item);
        viewEvent(occurrence.id);
      });
      list.appendChild(card);
    });
    if (!monthItems.length) list.innerHTML = "<p class='empty-state'>No birthdays listed.</p>";
    section.appendChild(list);
    wrapper.appendChild(section);
  });
  els.calendarGrid.appendChild(wrapper);
}

function renderMonthCalendar() {
  WEEKDAYS.forEach(function (day, weekdayIndex) {
    var label = document.createElement("div");
    label.className = "weekday";
    if (weekdayIndex === 0) label.classList.add("sunday");
    label.textContent = day;
    els.calendarGrid.appendChild(label);
  });

  var firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  var gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
  els.monthLabel.textContent = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  var now = parseISO(dashboardTodayISO());
  els.monthLabel.classList.toggle("current-month", viewDate.getFullYear() === now.getFullYear() && viewDate.getMonth() === now.getMonth());

  var todayISO = dashboardTodayISO();
  var gridEnd = addDays(gridStart, 41);
  var allItems = visibleCalendarEvents(toISO(gridStart), toISO(gridEnd)).concat(getTaskDeadlineItems());
  if (planningMode) allItems = allItems.concat(state.plans);

  for (var index = 0; index < 42; index += 1) {
    var date = addDays(gridStart, index);
    var iso = toISO(date);
    var cell = document.createElement("div");
    cell.className = "day-cell";
    cell.setAttribute("role", "button");
    cell.tabIndex = 0;
    if (date.getDay() === 0) cell.classList.add("sunday");
    if (date.getMonth() !== viewDate.getMonth()) cell.classList.add("outside");
    if (iso === todayISO) cell.classList.add("today");
    if (els.dayDrawer.classList.contains("open") && selectedDate === iso) cell.classList.add("selected-day");
    if (planningMode) cell.classList.add("planning-surface");
    if (isInSelection(iso)) cell.classList.add("selected-plan-day");
    if (state.plans.some(function (plan) { return isWithin(iso, plan.start, plan.end); })) cell.classList.add("has-plan");
    cell.dataset.date = iso;

    cell.addEventListener("click", function (event) {
      if (event.target.closest(".event-pill")) return;
      if (planningMode) {
        selectionStart = event.currentTarget.dataset.date;
        selectionEnd = selectionStart;
        openPlanningModal();
        return;
      }
      toggleDayDrawer(event.currentTarget.dataset.date);
    });

    cell.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.currentTarget.click();
      }
    });

    cell.addEventListener("mousedown", function (event) {
      if (!planningMode || event.button !== 0 || event.target.closest(".event-pill")) return;
      selectingPlan = true;
      selectionStart = event.currentTarget.dataset.date;
      selectionEnd = selectionStart;
      renderCalendar();
    });

    cell.addEventListener("mouseenter", function (event) {
      if (!planningMode || !selectingPlan) return;
      selectionEnd = event.currentTarget.dataset.date;
      renderCalendar();
    });

    cell.addEventListener("mouseup", function (event) {
      if (!planningMode || !selectingPlan) return;
      event.preventDefault();
      selectingPlan = false;
      selectionEnd = event.currentTarget.dataset.date;
      renderCalendar();
      openPlanningModal();
    });

    var dayNumber = document.createElement("div");
    dayNumber.className = "day-number";
    dayNumber.innerHTML = "<span>" + date.getDate() + "</span>" + (hasGoogleItem(iso) ? "<span class='google-pill'>GCal</span>" : "");
    cell.appendChild(dayNumber);

    var visibleItems = sortCalendarItemsByTime(allItems.filter(function (item) { return isWithin(iso, item.start, item.end); }));
    visibleItems.slice(0, 2).forEach(function (item) { cell.appendChild(renderCalendarPill(item)); });
    if (visibleItems.length > 2) {
      var more = document.createElement("div");
      more.className = "more-pill";
      more.textContent = "+" + (visibleItems.length - 2) + " more";
      cell.appendChild(more);
    }

    els.calendarGrid.appendChild(cell);
  }
}

function slotOrder(slot) {
  var index = TIME_SLOTS.indexOf(slot);
  return index === -1 ? 99 : index;
}

function calendarTimeValue(item) {
  if (item.allDay || item.timeSlot === "All Day") return "00:00";
  if (item.taskDeadline) return item.task && item.task.dueTime ? item.task.dueTime : "23:59";
  if (item.timeStart) return item.timeStart;
  return defaultTimeForSlot(item.timeSlot || "Morning");
}

function sortCalendarItemsByTime(items) {
  return items.slice().sort(function (a, b) {
    var timeDelta = calendarTimeValue(a).localeCompare(calendarTimeValue(b));
    if (timeDelta) return timeDelta;
    return eventTitle(a).localeCompare(eventTitle(b));
  });
}

function scheduledCategoryClass(item) {
  if (!item.scheduleCategory) return "";
  return "schedule-" + item.scheduleCategory.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function eventsForDate(dateISO) {
  return sortCalendarItemsByTime(visibleCalendarEvents(dateISO, dateISO).filter(function (item) { return isWithin(dateISO, item.start, item.end); }));
}

function renderScheduleView() {
  els.monthLabel.textContent = weekOfYearLabel(scheduleWeekStart);
  var nowWeek = startOfWeek(parseISO(dashboardTodayISO()));
  els.monthLabel.classList.toggle("current-month", toISO(nowWeek) === toISO(scheduleWeekStart));
  WEEKDAYS.forEach(function (day, weekdayIndex) {
    var label = document.createElement("div");
    label.className = "schedule-weekday";
    if (weekdayIndex === 0) label.classList.add("sunday");
    label.textContent = day;
    els.calendarGrid.appendChild(label);
  });

  for (var dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    var date = addDays(scheduleWeekStart, dayIndex);
    var iso = toISO(date);
    var column = document.createElement("section");
    column.className = "schedule-day";
    if (date.getDay() === 0) column.classList.add("sunday");
    if (iso === dashboardTodayISO()) column.classList.add("today");
    column.dataset.date = iso;

    var dateBadge = document.createElement("button");
    dateBadge.type = "button";
    dateBadge.className = "schedule-date-badge";
    dateBadge.textContent = displayDate(iso);
    dateBadge.addEventListener("click", function (event) {
      selectedDate = event.currentTarget.closest(".schedule-day").dataset.date;
      toggleDayDrawer(selectedDate);
    });
    column.appendChild(dateBadge);

    ["Morning", "Afternoon", "Evening"].forEach(function (slot) {
      var row = document.createElement("div");
      row.className = "schedule-slot";
      var label = document.createElement("span");
      label.className = "schedule-slot-label";
      label.textContent = slot;
      row.appendChild(label);

      var slotEvents = eventsForDate(iso).filter(function (item) {
        return item.timeSlot === slot || (slot === "Morning" && item.timeSlot === "All Day");
      });
      if (!slotEvents.length) {
        var empty = document.createElement("span");
        empty.className = "schedule-empty-line";
        row.appendChild(empty);
      } else {
        slotEvents.forEach(function (item) {
          var pill = renderCalendarPill(item);
          pill.classList.add("schedule-view-pill");
          row.appendChild(pill);
        });
      }
      column.appendChild(row);
    });

    els.calendarGrid.appendChild(column);
  }
}

function classScheduleKey(item) {
  return item.scheduleId || item.id;
}

function classScheduleSources() {
  var seen = {};
  return state.events.filter(isClassEvent).filter(function (item) {
    var key = classScheduleKey(item);
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  }).sort(function (a, b) {
    return eventTitle(a).localeCompare(eventTitle(b));
  });
}

function classScheduleTimeLabel(minutes) {
  var start = minutesToTime(minutes).replace(":", "");
  var end = minutes + 30 >= 24 * 60 ? "2400" : minutesToTime(minutes + 30).replace(":", "");
  return start + "-" + end;
}

function saveClassScheduleBounds(start, end) {
  var startTime = normalizeTimeInput(start) || "08:00";
  var endTime = normalizeTimeInput(end) || "18:00";
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    endTime = minutesToTime(Math.min(timeToMinutes(startTime) + 30, (24 * 60) - 1));
  }
  state.settings.classScheduleStartTime = startTime;
  state.settings.classScheduleEndTime = endTime;
  saveState();
}

function renderClassScheduleView() {
  var weekStart = startOfWeek(scheduleWeekStart);
  els.monthLabel.textContent = "Class Schedule · " + weekOfYearLabel(weekStart);
  els.monthLabel.classList.toggle("current-month", toISO(weekStart) === toISO(startOfWeek(parseISO(dashboardTodayISO()))));

  var wrapper = document.createElement("section");
  wrapper.className = "class-schedule-view";
  var sources = classScheduleSources();
  var selectedKeys = state.settings.classScheduleEventIds || [];
  var selectedLookup = selectedKeys.reduce(function (lookup, key) {
    lookup[key] = true;
    return lookup;
  }, {});

  var controls = document.createElement("div");
  controls.className = "class-schedule-controls";
  var details = document.createElement("details");
  details.className = "class-schedule-picker";
  var summary = document.createElement("summary");
  summary.textContent = "Classes (" + selectedKeys.length + " selected)";
  details.appendChild(summary);
  var checklist = document.createElement("div");
  checklist.className = "class-schedule-checklist";
  if (!sources.length) {
    checklist.innerHTML = "<p class='empty-state'>No Class events are available yet.</p>";
  } else {
    sources.forEach(function (item) {
      var key = classScheduleKey(item);
      var label = document.createElement("label");
      var input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!selectedLookup[key];
      input.addEventListener("change", function () {
        var next = new Set(state.settings.classScheduleEventIds || []);
        if (input.checked) next.add(key);
        else next.delete(key);
        state.settings.classScheduleEventIds = Array.from(next);
        saveState();
        renderCalendar();
      });
      var text = document.createElement("span");
      text.textContent = eventTitle(item);
      label.append(input, text);
      checklist.appendChild(label);
    });
  }
  details.appendChild(checklist);
  controls.appendChild(details);

  var bounds = document.createElement("div");
  bounds.className = "class-schedule-bounds";
  var startLabel = document.createElement("label");
  startLabel.textContent = "Start";
  var startInput = document.createElement("input");
  startInput.type = "time";
  startInput.step = "1800";
  startInput.value = state.settings.classScheduleStartTime || "08:00";
  startLabel.appendChild(startInput);
  var endLabel = document.createElement("label");
  endLabel.textContent = "End";
  var endInput = document.createElement("input");
  endInput.type = "time";
  endInput.step = "1800";
  endInput.value = state.settings.classScheduleEndTime || "18:00";
  endLabel.appendChild(endInput);
  [startInput, endInput].forEach(function (input) {
    input.addEventListener("change", function () {
      saveClassScheduleBounds(startInput.value, endInput.value);
      renderCalendar();
    });
  });
  bounds.append(startLabel, endLabel);
  controls.appendChild(bounds);
  wrapper.appendChild(controls);

  var startMinutes = timeToMinutes(state.settings.classScheduleStartTime || "08:00");
  var endMinutes = timeToMinutes(state.settings.classScheduleEndTime || "18:00");
  if (endMinutes <= startMinutes) endMinutes = startMinutes + 30;
  var slots = [];
  for (var minute = startMinutes; minute < endMinutes; minute += 30) slots.push(minute);

  var grid = document.createElement("div");
  grid.className = "class-schedule-grid";
  grid.style.setProperty("--class-schedule-rows", String(slots.length));
  var corner = document.createElement("div");
  corner.className = "class-schedule-corner";
  corner.textContent = "Time";
  corner.style.gridColumn = "1";
  corner.style.gridRow = "1";
  grid.appendChild(corner);
  ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].forEach(function (day, index) {
    var header = document.createElement("div");
    header.className = "class-schedule-day-header" + (index === 0 ? " sunday" : "");
    header.textContent = day;
    header.style.gridColumn = String(index + 2);
    header.style.gridRow = "1";
    grid.appendChild(header);
  });
  slots.forEach(function (minute, rowIndex) {
    var time = document.createElement("div");
    time.className = "class-schedule-time";
    time.textContent = classScheduleTimeLabel(minute);
    time.style.gridColumn = "1";
    time.style.gridRow = String(rowIndex + 2);
    grid.appendChild(time);
    WEEKDAYS.forEach(function (_day, dayIndex) {
      var cell = document.createElement("div");
      cell.className = "class-schedule-slot";
      cell.style.gridColumn = String(dayIndex + 2);
      cell.style.gridRow = String(rowIndex + 2);
      grid.appendChild(cell);
    });
  });

  var weekEnd = toISO(addDays(weekStart, 6));
  var classEvents = visibleCalendarEvents(toISO(weekStart), weekEnd).filter(function (item) {
    return isClassEvent(item) && selectedLookup[classScheduleKey(item)];
  });
  classEvents.forEach(function (item) {
    if (!item.timeStart) return;
    var eventStart = timeToMinutes(item.timeStart);
    var eventEnd = timeToMinutes(item.timeEnd || item.timeStart) || eventStart + 30;
    if (eventEnd <= eventStart) eventEnd = eventStart + 30;
    var rowStart = Math.max(0, Math.floor((eventStart - startMinutes) / 30));
    var rowEnd = Math.min(slots.length, Math.ceil((eventEnd - startMinutes) / 30));
    if (rowStart >= slots.length || rowEnd <= 0) return;
    var day = parseISO(item.start).getDay();
    var block = document.createElement("button");
    block.type = "button";
    block.className = "class-schedule-event";
    block.style.gridColumn = String(day + 2);
    block.style.gridRow = String(rowStart + 2) + " / span " + Math.max(1, rowEnd - rowStart);
    block.textContent = eventTitle(item);
    block.title = eventTitle(item) + " · " + eventTimingLabel(item);
    block.addEventListener("click", function () { viewEvent(item.id); });
    grid.appendChild(block);
  });
  wrapper.appendChild(grid);
  els.calendarGrid.appendChild(wrapper);
}

function renderCalendarPill(item) {
  var pill = document.createElement("button");
  pill.type = "button";
  pill.className = "event-pill";
  if (isMinistryPriority(item)) pill.classList.add("priority");
  if (eventIsBirthday(item)) pill.classList.add("birthday-event");
  if (item.recurring || item.scheduleId) {
    pill.classList.add("scheduled-event");
    var categoryClass = scheduledCategoryClass(item);
    if (categoryClass) pill.classList.add(categoryClass);
  }
  if (item.draft) pill.classList.add("plan");
  if (item.colorKey) {
    var color = eventColor(item.colorKey);
    pill.classList.add("colored-event");
    pill.style.setProperty("--event-color", color.value);
    pill.style.setProperty("--event-bg", color.bg);
  }
  if (item.source === "google-ready") pill.classList.add("finalized-plan");
  if (item.source === "google") pill.classList.add("google-event");
  if (item.googleEventId && item.source !== "google") pill.classList.add("synced-event");
  if (item.taskDeadline) pill.classList.add("task-deadline");
  pill.textContent = item.taskDeadline ? item.title : eventTitle(item);
  pill.title = pill.textContent;
  if (item.taskDeadline) {
    pill.addEventListener("click", function () { showToast("Task due: " + item.task.title); });
  } else if (!item.draft) {
    pill.addEventListener("click", function () { viewEvent(item.id); });
    bindEventCardKeyboard(pill, item.id);
  }
  return pill;
}

function bindEventCardKeyboard(element, eventId) {
  element.dataset.eventId = eventId;
  element.addEventListener("keydown", function (event) {
    if (event.key !== "Delete") return;
    event.preventDefault();
    event.stopPropagation();
    confirmDeleteEvent(eventId, event.currentTarget);
  });
}

function deleteFocusedEventCard(event) {
  if (event.key !== "Delete" || isTypingTarget(event.target)) return false;
  var target = event.target && event.target.closest ? event.target.closest("[data-event-id]") : null;
  if (!target) return false;
  var eventId = target.dataset.eventId;
  if (!eventId) return false;
  event.preventDefault();
  event.stopPropagation();
  confirmDeleteEvent(eventId, target);
  return true;
}

function toggleDayDrawer(dateISO) {
  if (els.dayDrawer.classList.contains("open") && selectedDate === dateISO) {
    closeDayDrawer();
    return;
  }
  openDayDrawer(dateISO);
}

function openDayDrawer(dateISO) {
  selectedDate = dateISO;
  els.drawerDate.textContent = displayLongDate(dateISO);
  renderDayDrawer();
  els.dayDrawer.classList.add("open");
  els.dayDrawer.setAttribute("aria-hidden", "false");
  renderCalendar();
}

function closeDayDrawer() {
  els.dayDrawer.classList.remove("open");
  els.dayDrawer.setAttribute("aria-hidden", "true");
  renderCalendar();
}

function renderDayDrawer() {
  els.drawerGroups.innerHTML = "";
  TIME_SLOTS.forEach(function (slot) {
    var group = document.createElement("section");
    group.className = "drawer-group";
    var title = document.createElement("h3");
    title.textContent = slot;
    group.appendChild(title);

    var events = document.createElement("div");
    events.className = "drawer-events";
    var items = eventsForDate(selectedDate).filter(function (item) {
      return item.timeSlot === slot && isWithin(selectedDate, item.start, item.end);
    });

    if (!items.length) {
      events.innerHTML = "<p class='empty-state'>No events.</p>";
    } else {
      items.forEach(function (item) {
        var card = document.createElement("div");
        card.className = "drawer-event";
        var button = document.createElement("button");
        button.type = "button";
        button.className = "drawer-event-button";
        button.innerHTML = "<strong>" + eventTitle(item) + "</strong><span>" + eventTimingLabel(item) + (item.location ? " / " + item.location : "") + (item.passage ? " / " + item.passage : "") + "</span>";
        button.addEventListener("click", function () { viewEvent(item.id); });
        bindEventCardKeyboard(button, item.id);
        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "delete-button trash-button event-card-delete";
        remove.innerHTML = trashIcon();
        remove.setAttribute("aria-label", "Delete event");
        remove.addEventListener("click", function (event) {
          event.stopPropagation();
          confirmDeleteEvent(item.id, event.currentTarget);
        });
        card.append(button, remove);
        events.appendChild(card);
      });
    }

    group.appendChild(events);
    els.drawerGroups.appendChild(group);
  });

  var taskGroup = document.createElement("section");
  taskGroup.className = "drawer-group";
  taskGroup.innerHTML = "<h3>Tasks Due</h3>";
  var taskEvents = document.createElement("div");
  taskEvents.className = "drawer-events";
  var dueTasks = state.tasks.filter(function (task) { return !task.done && task.dueDate === selectedDate; });
  if (!dueTasks.length) {
    taskEvents.innerHTML = "<p class='empty-state'>No task deadlines.</p>";
  } else {
    dueTasks.forEach(function (task) {
      var card = document.createElement("div");
      card.className = "drawer-event drawer-task";

      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !!task.done;
      checkbox.setAttribute("aria-label", "Mark " + task.title + " complete");
      checkbox.addEventListener("change", function () {
        setTaskCompletion(task, checkbox.checked);
      });

      var button = document.createElement("button");
      button.type = "button";
      button.className = "drawer-event-button";
      var taskName = document.createElement("strong");
      taskName.textContent = task.title;
      var taskMeta = document.createElement("span");
      taskMeta.textContent = (task.eventTitle ? task.eventTitle + " / " : "") + "Due " + displayDate(task.dueDate) + (task.dueTime ? " at " + formatTimeOption(task.dueTime) : "");
      button.append(taskName, taskMeta);
      button.addEventListener("click", function () { openTaskModal(task.id); });

      card.append(checkbox, button);
      taskEvents.appendChild(card);
    });
  }
  taskGroup.appendChild(taskEvents);
  els.drawerGroups.appendChild(taskGroup);
}

function openEventModal(options) {
  var settings = options || {};
  eventModalMode = settings.mode || "create";
  editingEventId = settings.eventId || null;
  var event = editingEventId ? state.events.find(function (item) { return item.id === editingEventId; }) : null;
  if (isGoogleReadOnlyEvent(event)) {
    viewingEventId = event.id;
    viewEvent(event.id);
    showToast("Google Calendar events are read-only here for now.");
    return;
  }
  var source = event || createEvent({
    type: settings.type || (eventModalMode === "plan" ? "Sermon Prep" : "General Event"),
    start: settings.start || selectedDate,
    end: settings.end || settings.start || selectedDate,
    timeSlot: settings.timeSlot || "Morning",
    timeStart: settings.timeStart || "08:00",
    timeEnd: settings.timeEnd || "09:00",
    allDay: !!settings.allDay,
    draft: eventModalMode === "plan"
  });

  modalChecklist = (source.checklist || []).map(function (item) {
    return {
      id: item.id || id("check"),
      title: item.title || "",
      dueDate: item.dueDate || "",
      done: !!item.done,
      promoted: !!item.promoted,
      taskId: item.taskId || null
    };
  });

  els.eventModalEyebrow.textContent = eventModalMode === "plan" ? "Planning Block" : event ? "Edit Event" : "Add Event";
  els.eventModalTitle.textContent = eventModalMode === "plan" ? "Draft Calendar Block" : event ? eventTitle(event) : displayLongDate(source.start);
  populateTimeSelects();
  renderEventTypes(source.type);
  els.eventTimeSlot.value = source.timeSlot;
  els.eventDate.value = source.start;
  els.eventEndDate.value = source.end;
  els.eventTimeStart.value = source.timeStart || (source.allDay || source.timeSlot === "All Day" ? "" : defaultTimeForSlot(source.timeSlot));
  els.eventTimeEnd.value = source.timeEnd || "";
  els.eventAllDay.checked = !!source.allDay || source.timeSlot === "All Day";
  els.eventLocation.value = source.location || "";
  els.eventPassage.value = source.passage || "";
  els.eventAlarm.value = source.alarm || "none";
  els.eventTitle.value = source.title || "";
  els.eventNotes.value = source.notes || "";
  selectedEventColorKey = source.colorKey || (eventModalMode === "plan" ? "gold" : "plum");
  renderColorPalette(els.eventColorPalette, selectedEventColorKey, function (key) { selectedEventColorKey = key; });
  els.eventRepeatRow.hidden = eventModalMode === "plan";
  applyRepeatRuleToForm(source.repeatRule);
  syncEventTimeControls();
  syncEventPassageField();
  els.deleteEventButton.hidden = !event;
  els.eventForm.querySelector(".form-button").textContent = eventModalMode === "plan" ? "Create Draft" : event ? "Save Event" : "Add Event";
  rememberEventDateRange();
  rememberEventTimeRange();
  renderEventTemplateSelect();
  renderModalChecklist();
  if (typeof els.eventModal.showModal === "function") els.eventModal.showModal();
}

function openPlanningModal() {
  if (!selectionStart || !selectionEnd) return;
  var range = normalizeRange(selectionStart, selectionEnd);
  openEventModal({ mode: "plan", type: "Sermon Prep", start: range.start, end: range.end, timeSlot: "Morning" });
}

function openContextCreateModal() {
  if (calendarMode === "schedule") {
    openScheduleModal();
    return;
  }
  if (planningMode) {
    openEventModal({ mode: "plan", type: "Sermon Prep", start: selectedDate, end: selectedDate, timeSlot: "Morning", timeStart: "08:00", timeEnd: "09:00" });
    return;
  }
  openEventModal({ mode: "create", start: selectedDate, end: selectedDate, timeStart: "08:00", timeEnd: "09:00" });
}

function renderEventTemplateSelect() {
  els.eventTemplateSelect.innerHTML = "<option value=''>Add template...</option>";
  state.templates.forEach(function (template) {
    var option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.name;
    els.eventTemplateSelect.appendChild(option);
  });
}

function renderModalChecklist() {
  els.eventChecklist.innerHTML = "";
  if (!modalChecklist.length) {
    els.eventChecklist.innerHTML = "<p class='empty-state'>No checklist items yet. Add a template or create one item. Items are added to the Main Task List when the event is saved.</p>";
    return;
  }
  modalChecklist.forEach(function (item) {
    var row = document.createElement("div");
    row.className = "event-checklist-row" + (item.done ? " done" : "");
    row.dataset.itemId = item.id;

    var grip = document.createElement("button");
    grip.type = "button";
    grip.className = "event-checklist-drag-handle";
    grip.innerHTML = dragHandleIcon();
    grip.setAttribute("aria-label", "Reorder checklist item");
    grip.addEventListener("pointerdown", function (event) {
      beginModalChecklistPointerDrag(event, item, row);
    });

    var toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.className = "event-checklist-toggle";
    toggle.checked = !!item.done;
    toggle.setAttribute("aria-label", "Mark " + (item.title || "checklist item") + " complete");
    toggle.addEventListener("change", function () {
      item.done = toggle.checked;
      if (item.taskId) syncTaskFromChecklist(item);
      renderModalChecklist();
    });

    var title = document.createElement("span");
    title.className = "event-checklist-title";
    title.textContent = item.title;

    var due = document.createElement("input");
    due.type = "date";
    due.className = "event-checklist-due";
    due.value = item.dueDate || "";
    due.addEventListener("change", function () {
      item.dueDate = due.value;
      if (item.taskId) syncTaskFromChecklist(item);
    });

    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-button trash-button";
    remove.innerHTML = trashIcon();
    remove.setAttribute("aria-label", "Delete checklist item");
    remove.addEventListener("click", function () {
      if (item.taskId) state.tasks = state.tasks.filter(function (task) { return task.id !== item.taskId; });
      modalChecklist = modalChecklist.filter(function (check) { return check.id !== item.id; });
      renderModalChecklist();
      renderTasks();
      renderCalendar();
    });

    row.append(grip, toggle, title, due, remove);
    els.eventChecklist.appendChild(row);
  });
}

function clearModalChecklistPointerDrag(commit) {
  if (!modalChecklistPointerDrag) return;
  var drag = modalChecklistPointerDrag;
  var list = drag.placeholder.parentElement;
  var nextItemId = "";
  if (list) {
    var siblings = Array.prototype.slice.call(list.children);
    var placeholderIndex = siblings.indexOf(drag.placeholder);
    for (var index = placeholderIndex + 1; index < siblings.length; index += 1) {
      if (siblings[index].classList && siblings[index].classList.contains("event-checklist-row")) {
        nextItemId = siblings[index].dataset.itemId || "";
        break;
      }
    }
  }
  if (drag.placeholder.parentElement) drag.placeholder.remove();
  drag.row.classList.remove("pointer-dragging");
  drag.row.removeAttribute("style");
  modalChecklistPointerDrag = null;
  document.removeEventListener("pointermove", moveModalChecklistPointerDrag);
  document.removeEventListener("pointerup", finishModalChecklistPointerDrag);
  document.removeEventListener("pointercancel", cancelModalChecklistPointerDrag);
  if (commit) {
    var ordered = modalChecklist.filter(function (item) { return item.id !== drag.itemId; });
    var position = ordered.length;
    if (nextItemId) {
      var nextIndex = ordered.findIndex(function (item) { return item.id === nextItemId; });
      if (nextIndex >= 0) position = nextIndex;
    }
    ordered.splice(position, 0, drag.item);
    modalChecklist = ordered;
  }
  renderModalChecklist();
}

function moveModalChecklistPointerDrag(event) {
  if (!modalChecklistPointerDrag || event.pointerId !== modalChecklistPointerDrag.pointerId) return;
  var drag = modalChecklistPointerDrag;
  drag.row.style.left = Math.max(8, event.clientX - drag.offsetX) + "px";
  drag.row.style.top = Math.max(8, event.clientY - drag.offsetY) + "px";
  var target = document.elementFromPoint(event.clientX, event.clientY);
  var list = target && target.closest(".event-checklist");
  if (!list) return;
  var rows = Array.prototype.slice.call(list.children).filter(function (row) {
    return row.classList && row.classList.contains("event-checklist-row");
  });
  var nextRow = rows.find(function (row) {
    var rect = row.getBoundingClientRect();
    return event.clientY < rect.top + (rect.height / 2);
  });
  if (nextRow) list.insertBefore(drag.placeholder, nextRow);
  else list.appendChild(drag.placeholder);
}

function finishModalChecklistPointerDrag(event) {
  if (!modalChecklistPointerDrag || event.pointerId !== modalChecklistPointerDrag.pointerId) return;
  clearModalChecklistPointerDrag(true);
}

function cancelModalChecklistPointerDrag(event) {
  if (!modalChecklistPointerDrag || event.pointerId !== modalChecklistPointerDrag.pointerId) return;
  clearModalChecklistPointerDrag(false);
}

function beginModalChecklistPointerDrag(event, item, row) {
  if (event.button !== 0 || modalChecklistPointerDrag) return;
  event.preventDefault();
  event.stopPropagation();
  var rect = row.getBoundingClientRect();
  var placeholder = document.createElement("div");
  placeholder.className = "event-checklist-drag-placeholder";
  placeholder.style.height = rect.height + "px";
  row.parentElement.insertBefore(placeholder, row.nextSibling);
  row.classList.add("pointer-dragging");
  row.style.width = rect.width + "px";
  row.style.height = rect.height + "px";
  row.style.left = rect.left + "px";
  row.style.top = rect.top + "px";
  document.body.appendChild(row);
  modalChecklistPointerDrag = {
    row: row,
    item: item,
    itemId: item.id,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    placeholder: placeholder,
    pointerId: event.pointerId
  };
  if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
  document.addEventListener("pointermove", moveModalChecklistPointerDrag);
  document.addEventListener("pointerup", finishModalChecklistPointerDrag);
  document.addEventListener("pointercancel", cancelModalChecklistPointerDrag);
}

function eventTaskGroupName(eventItem) {
  var parts = String(eventItem.start || dashboardTodayISO()).split("-");
  var shortDate = parts.length === 3 ? parts[1] + "/" + parts[2] + "/" + parts[0].slice(-2) : dashboardTodayISO();
  return shortDate + " " + eventTitle(eventItem);
}

function ensureEventTaskGroup(eventItem) {
  state.taskGroups = state.taskGroups || [];
  var hasChecklistItems = (eventItem.checklist || []).some(function (item) {
    return String(item.title || "").trim();
  });
  if (!hasChecklistItems) return null;

  var group = eventItem.taskGroupId
    ? state.taskGroups.find(function (item) { return item.id === eventItem.taskGroupId; })
    : null;
  if (!group) {
    group = {
      id: id("task-group"),
      name: eventTaskGroupName(eventItem),
      eventId: eventItem.id,
      collapsed: false,
      sortOrder: state.taskGroups.length
    };
    state.taskGroups.push(group);
    eventItem.taskGroupId = group.id;
  } else {
    group.name = eventTaskGroupName(eventItem);
    group.eventId = eventItem.id;
  }
  return group;
}

function ensureChecklistTask(item, eventItem, groupId) {
  var title = item.title.trim();
  if (!title) return null;
  var task = item.taskId ? state.tasks.find(function (taskItem) { return taskItem.id === item.taskId; }) : null;
  if (!task) {
    task = {
      id: id("task"),
      title: title,
      dueDate: item.dueDate || eventItem.start,
      done: !!item.done,
      completedAt: item.done ? new Date().toISOString() : "",
      notes: "",
      source: "event",
      eventId: eventItem.id,
      eventTitle: eventTitle(eventItem),
      groupId: groupId || "",
      sortOrder: -Date.now()
    };
    state.tasks.unshift(task);
  } else {
    task.title = title;
    task.dueDate = item.dueDate || eventItem.start;
    task.done = item.done;
    task.completedAt = item.done ? task.completedAt || new Date().toISOString() : "";
    if (typeof task.notes !== "string") task.notes = "";
    task.eventId = eventItem.id;
    task.eventTitle = eventTitle(eventItem);
    task.groupId = groupId || "";
  }
  item.promoted = true;
  item.taskId = task.id;
  return task;
}

function ensureEventChecklistTasks(eventItem) {
  var group = ensureEventTaskGroup(eventItem);
  var tasks = (eventItem.checklist || []).map(function (item) {
    return ensureChecklistTask(item, eventItem, group ? group.id : "");
  }).filter(Boolean);
  if (group) setTaskSortOrder(group.id, tasks);
}

function syncTaskFromChecklist(item) {
  var task = state.tasks.find(function (taskItem) { return taskItem.id === item.taskId; });
  if (!task) return;
  task.title = item.title;
  task.dueDate = item.dueDate;
  task.done = item.done;
  task.completedAt = item.done ? task.completedAt || new Date().toISOString() : "";
  task.eventTitle = els.eventTitle.value.trim() || task.eventTitle;
  saveState();
}

function addTemplateToModalEvent() {
  var template = state.templates.find(function (item) { return item.id === els.eventTemplateSelect.value; });
  if (!template) {
    showToast("Choose a template first.");
    return;
  }
  template.items.forEach(function (item) {
    modalChecklist.push({ id: id("check"), title: item.title, dueDate: "", done: false, promoted: false, taskId: null });
  });
  renderModalChecklist();
  showToast("Template copied into this event.");
}

function populateScheduleTimeSelects() {
  populateTimeSuggestions();
  [els.scheduleStartTime, els.scheduleEndTime].forEach(function (input) {
    var fallback = input === els.scheduleStartTime ? "08:00" : "09:00";
    input.value = normalizeTimeInput(input.value) || fallback;
  });
}

function getScheduleSeriesDefaults(scheduleId, fromDate) {
  var seriesEvents = state.events
    .filter(function (item) { return item.scheduleId === scheduleId && (!fromDate || item.start >= fromDate); })
    .sort(function (a, b) { return a.start.localeCompare(b.start); });
  if (!seriesEvents.length) return null;
  var first = seriesEvents[0];
  return {
    scheduleId: scheduleId,
    category: first.scheduleCategory || first.type || "Class",
    title: first.title || eventTitle(first),
    location: first.location || "",
    startDate: seriesEvents[0].start,
    endDate: seriesEvents[seriesEvents.length - 1].start,
    startTime: first.timeStart || "08:00",
    endTime: first.timeEnd || "09:00",
    colorKey: first.colorKey || scheduleCategoryDefaultColor(first.scheduleCategory || first.type),
    days: Array.from(new Set(seriesEvents.map(function (item) { return parseISO(item.start).getDay(); })))
  };
}

function scheduleCategoryDefaultColor(category) {
  var key = String(category || "").toLowerCase();
  if (key === "class") return "blue";
  if (key === "ministry") return "green";
  return "sage";
}

function openScheduleModal(options) {
  var settings = options || {};
  populateScheduleTimeSelects();
  var today = dashboardTodayISO();
  var weekEnd = toISO(addDays(scheduleWeekStart, 6));
  var series = settings.scheduleId ? getScheduleSeriesDefaults(settings.scheduleId, settings.fromDate) : null;
  editingScheduleId = series ? series.scheduleId : null;
  editingScheduleFromDate = series && settings.fromDate ? settings.fromDate : "";
  els.scheduleCategory.value = series ? series.category : "Class";
  els.scheduleTitle.value = series ? series.title : "";
  els.scheduleLocation.value = series ? series.location : "";
  els.scheduleStartDate.value = series ? series.startDate : toISO(scheduleWeekStart);
  els.scheduleEndDate.value = series ? series.endDate : weekEnd < today ? today : weekEnd;
  els.scheduleEndDate.min = els.scheduleStartDate.value;
  els.scheduleStartTime.value = series ? series.startTime : "08:00";
  els.scheduleEndTime.value = series ? series.endTime : "09:00";
  selectedScheduleColorKey = series ? series.colorKey : scheduleCategoryDefaultColor(els.scheduleCategory.value);
  renderColorPalette(els.scheduleColorPalette, selectedScheduleColorKey, function (key) { selectedScheduleColorKey = key; });
  updateScheduleEndTimeOptions();
  rememberScheduleDateRange();
  rememberScheduleTimeRange();
  Array.from(els.scheduleForm.querySelectorAll("input[name='scheduleDay']")).forEach(function (input) {
    input.checked = series ? series.days.indexOf(Number(input.value)) > -1 : false;
  });
  var heading = els.scheduleForm.querySelector("h2");
  var submit = els.scheduleForm.querySelector(".accent-button[value='default']");
  if (heading) heading.textContent = series ? "Edit Schedule" : "Add Schedule";
  if (submit) submit.textContent = series ? "Save Schedule" : "Create Schedule";
  if (typeof els.scheduleModal.showModal === "function") els.scheduleModal.showModal();
}

function scheduleCategoryClass(category) {
  return "schedule-" + String(category || "Others").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function saveSchedule(event) {
  event.preventDefault();
  if (event.submitter && event.submitter.value === "cancel") {
    editingScheduleId = null;
    editingScheduleFromDate = "";
    els.scheduleModal.close();
    return;
  }
  var category = els.scheduleCategory.value;
  var title = els.scheduleTitle.value.trim();
  var location = els.scheduleLocation.value.trim();
  var startDate = els.scheduleStartDate.value;
  var endDate = els.scheduleEndDate.value || startDate;
  if (!title) {
    showToast("Add a title before saving.");
    return;
  }
  if (!startDate) return;
  if (parseISO(endDate) < parseISO(startDate)) endDate = startDate;
  var timeRange = getValidatedTimeRange(els.scheduleStartTime, els.scheduleEndTime);
  if (!timeRange) return;

  var selectedDays = Array.from(els.scheduleForm.querySelectorAll("input[name='scheduleDay']:checked")).map(function (input) {
    return Number(input.value);
  });
  if (!selectedDays.length) {
    showToast("Choose at least one weekday.");
    return;
  }

  var wasEditing = !!editingScheduleId;
  var isFutureEdit = wasEditing && !!editingScheduleFromDate;
  var oldScheduleId = editingScheduleId;
  var scheduleId = isFutureEdit ? id("schedule") : editingScheduleId || id("schedule");
  var nextEvents = [];
  for (var date = parseISO(startDate); date <= parseISO(endDate); date = addDays(date, 1)) {
    if (selectedDays.indexOf(date.getDay()) === -1) continue;
    var iso = toISO(date);
    nextEvents.push(createEvent({
      type: category,
      title: title,
      start: iso,
      end: iso,
      timeSlot: getTimeSlotFromTime(timeRange.start),
      timeStart: timeRange.start,
      timeEnd: timeRange.end,
      location: location,
      colorKey: selectedScheduleColorKey,
      source: "schedule",
      scheduleId: scheduleId,
      scheduleCategory: category,
      recurring: true
    }));
  }

  if (!nextEvents.length) {
    showToast("No dates matched that schedule.");
    return;
  }
  if (isFutureEdit) removeScheduleEventsFrom(oldScheduleId, editingScheduleFromDate);
  else if (wasEditing) removeEventSeries(scheduleId);
  state.events = state.events.concat(nextEvents);
  editingScheduleId = null;
  editingScheduleFromDate = "";
  els.scheduleModal.close();
  saveState();
  renderAll();
  showToast(nextEvents.length + " scheduled event" + (nextEvents.length === 1 ? "" : "s") + (wasEditing ? " saved." : " created."));
}

async function addEventOrPlan(event) {
  event.preventDefault();
  if (event.submitter && event.submitter.value === "cancel") {
    closeEventModal();
    return;
  }
  var start = els.eventDate.value;
  if (!start) return;
  var title = els.eventTitle.value.trim();
  if (!title) {
    showToast("Add a title before saving.");
    return;
  }
  var end = els.eventEndDate.value || start;
  if (parseISO(end) < parseISO(start)) end = start;
  var allDay = els.eventAllDay.checked || start !== end;
  var timeRange = allDay ? null : getValidatedTimeRange(els.eventTimeStart, els.eventTimeEnd);
  if (!allDay && !timeRange) return;
  var timeStart = allDay ? "" : timeRange.start;
  var timeEnd = allDay ? "" : timeRange.end;
  var timeSlot = allDay ? "All Day" : getTimeSlotFromTime(timeStart);
  var previousEvent = editingEventId ? state.events.find(function (eventItem) { return eventItem.id === editingEventId; }) : null;
  var nextRepeatRule = eventModalMode === "plan" ? defaultRepeatRule() : repeatRuleFromForm();
  var item = createEvent({
    id: editingEventId || id(eventModalMode === "plan" ? "plan" : "event"),
    type: els.eventType.value,
    passage: isPassageEventType(els.eventType.value) ? els.eventPassage.value.trim() : "",
    title: title,
    start: start,
    end: end,
    timeSlot: timeSlot,
    timeStart: timeStart,
    timeEnd: timeEnd,
    allDay: allDay,
    alarm: els.eventAlarm.value || "none",
    location: els.eventLocation.value.trim(),
    notes: els.eventNotes.value.trim(),
    image: previousEvent ? previousEvent.image : "",
    checklist: modalChecklist,
    colorKey: selectedEventColorKey,
    repeatRule: nextRepeatRule,
    source: eventModalMode === "plan" ? "draft" : "dashboard",
    googleEventId: previousEvent ? previousEvent.googleEventId : "",
    googleCalendarId: previousEvent ? previousEvent.googleCalendarId : "",
    htmlLink: previousEvent ? previousEvent.htmlLink : "",
    syncStatus: previousEvent ? previousEvent.syncStatus : "",
    lastSyncedAt: previousEvent ? previousEvent.lastSyncedAt : "",
    scheduleId: previousEvent ? previousEvent.scheduleId : "",
    scheduleCategory: previousEvent ? previousEvent.scheduleCategory : "",
    taskGroupId: previousEvent ? previousEvent.taskGroupId : "",
    recurring: !!(previousEvent && previousEvent.scheduleId) || nextRepeatRule.frequency !== "none",
    draft: eventModalMode === "plan"
  });

  if (eventModalMode === "plan") {
    state.plans.push(item);
    showToast("Grey striped planning block created.");
  } else if (editingEventId) {
    var index = state.events.findIndex(function (eventItem) { return eventItem.id === editingEventId; });
    if (index > -1) {
      state.events[index] = item;
    }
    selectedDate = start;
    ensureEventChecklistTasks(item);
    syncEventTasks(item);
    showToast("Event saved.");
  } else {
    ensureEventChecklistTasks(item);
    state.events.push(item);
    selectedDate = start;
    showToast("Event added.");
  }

  closeEventModal();
  saveState();
  if (eventModalMode !== "plan") {
    if (!googleCalendarStatus.connected && googleCalendarStatus.configured) await loadGoogleCalendarStatus();
    if (googleCalendarStatus.connected) await syncDashboardEventToGoogle(item, false);
  }
  renderAll();
  if (eventModalMode !== "plan") openDayDrawer(selectedDate);
}

function syncEventTasks(event) {
  event.checklist.forEach(function (item) {
    if (!item.taskId) return;
    var task = state.tasks.find(function (taskItem) { return taskItem.id === item.taskId; });
    if (!task) return;
    task.title = item.title;
    task.dueDate = item.dueDate;
    task.done = item.done;
    task.eventId = event.id;
    task.eventTitle = eventTitle(event);
    task.groupId = event.taskGroupId || task.groupId || "";
  });
}

function defaultEventTitle(type, passage) {
  if ((type === "Sermon" || type === "Bible Study" || type.indexOf("Prep") > -1) && passage) return type + ": " + passage;
  return type;
}

function defaultEventType() {
  var types = state && state.settings ? eventTypes() : DEFAULT_EVENT_TYPES;
  return types.indexOf("General Event") > -1 ? "General Event" : (types[0] || "Sermon");
}

function eventTypes() {
  var configured = Array.isArray(state.settings.eventTypes) && state.settings.eventTypes.length
    ? state.settings.eventTypes
    : DEFAULT_EVENT_TYPES;
  state.settings.eventTypes = Array.from(new Set(configured.concat(PROTECTED_EVENT_TYPES))).filter(Boolean);
  return state.settings.eventTypes;
}

function renderEventTypes(selected) {
  if (!els.eventType) return;
  var current = selected || els.eventType.value || defaultEventType();
  if (eventTypes().indexOf(current) < 0) current = defaultEventType();
  els.eventType.innerHTML = "";
  eventTypes().forEach(function (type) {
    var option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    els.eventType.appendChild(option);
  });
  els.eventType.value = current;
  renderEventTypeList();
  syncEventPassageField();
}

function renderEventTypeList() {
  if (!els.eventTypeList) return;
  els.eventTypeList.innerHTML = "";
  eventTypes().forEach(function (type) {
    var row = document.createElement("div");
    row.className = "event-type-chip";
    row.innerHTML = "<span>" + escapeHTML(type) + "</span>";
    if (PROTECTED_EVENT_TYPES.indexOf(type) > -1) {
      els.eventTypeList.appendChild(row);
      return;
    }
    var remove = document.createElement("button");
    remove.className = "trash-button";
    remove.type = "button";
    remove.setAttribute("aria-label", "Delete " + type);
    remove.textContent = "x";
    remove.addEventListener("click", function () {
      state.settings.eventTypes = eventTypes().filter(function (item) { return item !== type; });
      if (els.eventType.value === type) els.eventType.value = defaultEventType();
      saveState();
      renderEventTypes(els.eventType.value);
    });
    row.appendChild(remove);
    els.eventTypeList.appendChild(row);
  });
}

function closeEventModal() {
  closeDeleteScopeMenu();
  if (document.activeElement && els.eventModal.contains(document.activeElement)) document.activeElement.blur();
  els.eventModal.close();
  clearSelection();
  editingEventId = null;
  modalChecklist = [];
  renderCalendar();
}

function deleteEditingEvent(event) {
  if (!editingEventId) return;
  confirmDeleteEvent(editingEventId, event.currentTarget, closeEventModal);
}

function removeEventById(eventId) {
  var removed = state.events.find(function (event) { return event.id === eventId; });
  if (removed && removed.googleEventId && removed.source !== "google") deleteGoogleCalendarEvent(removed);
  state.events = state.events.filter(function (event) { return event.id !== eventId; });
  state.tasks = state.tasks.filter(function (task) { return task.eventId !== eventId; });
  saveState();
}

function removeEventSeries(scheduleId) {
  if (!scheduleId) return;
  var removedEvents = state.events.filter(function (event) { return event.scheduleId === scheduleId; });
  removedEvents.forEach(function (event) {
    if (event.googleEventId && event.source !== "google") deleteGoogleCalendarEvent(event);
  });
  var removedIds = removedEvents.map(function (event) { return event.id; });
  state.events = state.events.filter(function (event) { return event.scheduleId !== scheduleId; });
  state.tasks = state.tasks.filter(function (task) { return removedIds.indexOf(task.eventId) === -1; });
  saveState();
}

function removeScheduleEventsFrom(scheduleId, fromDate) {
  if (!scheduleId || !fromDate) return;
  var removedEvents = state.events.filter(function (event) { return event.scheduleId === scheduleId && event.start >= fromDate; });
  removedEvents.forEach(function (event) {
    if (event.googleEventId && event.source !== "google") deleteGoogleCalendarEvent(event);
  });
  var removedIds = removedEvents.map(function (event) { return event.id; });
  state.events = state.events.filter(function (event) {
    return !(event.scheduleId === scheduleId && event.start >= fromDate);
  });
  state.tasks = state.tasks.filter(function (task) { return removedIds.indexOf(task.eventId) === -1; });
  saveState();
}

function closeDeleteScopeMenu() {
  if (activeDeleteMenu) {
    activeDeleteMenu.remove();
    activeDeleteMenu = null;
  }
}

function deleteEventWithScope(eventId, scope, onComplete) {
  var item = state.events.find(function (event) { return event.id === eventId; });
  if (!item) return;
  var isSeries = scope === "series";
  var label = isSeries ? "the whole series" : eventTitle(item);
  if (!window.confirm("Delete " + label + "?")) {
    closeDeleteScopeMenu();
    return;
  }
  if (isSeries) removeEventSeries(item.scheduleId);
  else removeEventById(eventId);
  closeDeleteScopeMenu();
  if (typeof onComplete === "function") onComplete();
  renderAll();
  if (els.dayDrawer.classList.contains("open")) renderDayDrawer();
  showToast("Event deleted.");
}

function openScheduledDeleteMenu(eventId, anchor, onComplete) {
  closeDeleteScopeMenu();
  var rect = anchor.getBoundingClientRect();
  var menu = document.createElement("div");
  menu.className = "delete-scope-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML =
    "<button type='button' role='menuitem'>Single Event</button>" +
    "<button type='button' role='menuitem'>Series</button>";
  var host = els.eventModal.open ? els.eventModal : els.eventDetailModal.open ? els.eventDetailModal : document.body;
  host.appendChild(menu);
  var left = Math.min(rect.left, window.innerWidth - 168);
  var top = rect.bottom + 6;
  if (top + 92 > window.innerHeight) top = Math.max(8, rect.top - 92);
  menu.style.left = Math.max(8, left) + "px";
  menu.style.top = Math.max(8, top) + "px";
  var buttons = menu.querySelectorAll("button");
  buttons[0].addEventListener("click", function (event) {
    event.stopPropagation();
    deleteEventWithScope(eventId, "single", onComplete);
  });
  buttons[1].addEventListener("click", function (event) {
    event.stopPropagation();
    deleteEventWithScope(eventId, "series", onComplete);
  });
  menu.addEventListener("click", function (event) { event.stopPropagation(); });
  activeDeleteMenu = menu;
}

function openScheduledEditMenu(eventId, anchor) {
  closeDeleteScopeMenu();
  var item = state.events.find(function (event) { return event.id === eventId; });
  if (!item) return;
  var rect = anchor.getBoundingClientRect();
  var menu = document.createElement("div");
  menu.className = "delete-scope-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML =
    "<button type='button' role='menuitem'>Single Event</button>" +
    "<button type='button' role='menuitem'>Series</button>";
  var host = els.eventDetailModal.open ? els.eventDetailModal : document.body;
  host.appendChild(menu);
  var left = Math.min(rect.left, window.innerWidth - 168);
  var top = rect.bottom + 6;
  if (top + 92 > window.innerHeight) top = Math.max(8, rect.top - 92);
  menu.style.left = Math.max(8, left) + "px";
  menu.style.top = Math.max(8, top) + "px";
  var buttons = menu.querySelectorAll("button");
  buttons[0].addEventListener("click", function (event) {
    event.stopPropagation();
    closeDeleteScopeMenu();
    els.eventDetailModal.close();
    openEventModal({ mode: "edit", eventId: eventId });
  });
  buttons[1].addEventListener("click", function (event) {
    event.stopPropagation();
    closeDeleteScopeMenu();
    els.eventDetailModal.close();
    openScheduleModal({ scheduleId: item.scheduleId, fromDate: item.start });
  });
  menu.addEventListener("click", function (event) { event.stopPropagation(); });
  activeDeleteMenu = menu;
}

function confirmDeleteEvent(eventId, anchor, onComplete) {
  var item = state.events.find(function (event) { return event.id === eventId; });
  if (!item) return;
  if (isGoogleReadOnlyEvent(item)) {
    showToast("Google Calendar events are read-only here for now.");
    return;
  }
  if (item.scheduleId) {
    if (anchor) openScheduledDeleteMenu(eventId, anchor, onComplete);
    else deleteEventWithScope(eventId, "single", onComplete);
    return;
  }
  deleteEventWithScope(eventId, "single", onComplete);
}

function clearSelection() {
  selectingPlan = false;
  selectionStart = null;
  selectionEnd = null;
}

function finalizePlans() {
  if (!state.plans.length) return;
  var count = state.plans.length;
  var finalizedEvents = [];
  state.plans.forEach(function (plan) {
    var finalizedEvent = createEvent({
      type: plan.type,
      passage: plan.passage,
      title: plan.title,
      start: plan.start,
      end: plan.end,
      timeSlot: plan.timeSlot,
      timeStart: plan.timeStart,
      timeEnd: plan.timeEnd,
      allDay: plan.allDay,
      location: plan.location,
      notes: plan.notes,
      checklist: plan.checklist,
      colorKey: plan.colorKey,
      source: "google-ready"
    });
    ensureEventChecklistTasks(finalizedEvent);
    state.events.push(finalizedEvent);
    finalizedEvents.push(finalizedEvent);
  });
  state.plans = [];
  saveState();
  setMode("normal");
  if (googleCalendarStatus.connected) {
    finalizedEvents.forEach(function (item) { syncDashboardEventToGoogle(item, false); });
  }
  showToast(count + " planning block" + (count === 1 ? "" : "s") + " finalized as calendar events.");
}

function cancelPlans() {
  if (!state.plans.length) return;
  var count = state.plans.length;
  state.plans = [];
  clearSelection();
  saveState();
  renderAll();
  showToast(count + " planning draft" + (count === 1 ? "" : "s") + " canceled.");
}

function undoPlan() {
  if (!planningMode || !state.plans.length) return;
  var removed = state.plans.pop();
  saveState();
  renderAll();
  showToast("Undid " + eventTitle(removed) + ".");
}

function setMode(nextMode) {
  calendarMode = nextMode === "schedule" ? "schedule" : nextMode === "planning" ? "planning" : nextMode === "class-schedule" ? "class-schedule" : nextMode === "birthdays" ? "birthdays" : "normal";
  planningMode = calendarMode === "planning";
  clearSelection();
  closeDayDrawer();
  els.normalModeButton.classList.toggle("active", calendarMode === "normal");
  els.scheduleModeButton.classList.toggle("active", calendarMode === "schedule");
  els.planningModeButton.classList.toggle("active", planningMode);
  if (els.classScheduleModeButton) els.classScheduleModeButton.classList.toggle("active", calendarMode === "class-schedule");
  if (els.birthdayModeButton) els.birthdayModeButton.classList.toggle("active", calendarMode === "birthdays");
  els.planningHint.hidden = !planningMode;
  els.addScheduleButton.hidden = calendarMode !== "schedule";
  if (els.birthdayHideToggle) els.birthdayHideToggle.hidden = calendarMode !== "birthdays";
  if (els.hideBirthdaysFromCalendar) els.hideBirthdaysFromCalendar.checked = !!state.settings.hideBirthdaysFromCalendar;
  renderAll();
  loadGoogleCalendarEvents(false);
}

function updatePlanButtons() {
  var show = planningMode && state.plans.length > 0;
  els.finalizePlansButton.hidden = !show;
  els.cancelPlansButton.disabled = !show;
  els.undoPlanButton.disabled = !show;
  els.addScheduleButton.hidden = calendarMode !== "schedule";
  if (els.birthdayHideToggle) els.birthdayHideToggle.hidden = calendarMode !== "birthdays";
}

function goToCurrentCalendarPeriod() {
  if (calendarMode === "schedule" || calendarMode === "class-schedule") {
    scheduleWeekStart = startOfWeek(parseISO(dashboardTodayISO()));
  } else if (calendarMode === "birthdays") {
    viewDate = parseISO(dashboardTodayISO());
  } else {
    viewDate = parseISO(dashboardTodayISO());
  }
  renderCalendar();
}

function goToPreviousCalendarPeriod() {
  if (calendarMode === "schedule" || calendarMode === "class-schedule") {
    scheduleWeekStart = addDays(scheduleWeekStart, -7);
  } else if (calendarMode === "birthdays") {
    viewDate = new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1);
  } else {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
  }
  renderCalendar();
}

function goToNextCalendarPeriod() {
  if (calendarMode === "schedule" || calendarMode === "class-schedule") {
    scheduleWeekStart = addDays(scheduleWeekStart, 7);
  } else if (calendarMode === "birthdays") {
    viewDate = new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1);
  } else {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
  }
  renderCalendar();
}

function isWithinNextDays(item, days) {
  var today = parseISO(dashboardTodayISO()).getTime();
  var target = parseISO(item.start).getTime();
  var diff = Math.round((target - today) / 86400000);
  return diff >= 0 && diff <= days;
}

function isClassEvent(item) {
  return item.type === "Class" || item.scheduleCategory === "Class";
}

function isInCurrentCalendarMonth(item) {
  var now = parseISO(dashboardTodayISO());
  var start = parseISO(item.start);
  return start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth() && start >= parseISO(toISO(now));
}

function renderPriorityList() {
  els.priorityList.innerHTML = "";
  els.priorityTitle.textContent = priorityScope === "month"
    ? "Upcoming Studies for " + parseISO(dashboardTodayISO()).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "Seven Days";
  els.priorityScopeToggle.textContent = priorityScope === "month" ? "Seven Days" : "Month";
  var items;
  var birthdayItems = [];
  if (priorityScope === "month") {
    var monthToday = parseISO(dashboardTodayISO());
    var monthStart = toISO(new Date(monthToday.getFullYear(), monthToday.getMonth(), 1));
    var monthEnd = toISO(new Date(monthToday.getFullYear(), monthToday.getMonth() + 1, 0));
    items = visibleCalendarEvents(monthStart, monthEnd).filter(function (item) {
      return isMinistryPriority(item) && isInCurrentCalendarMonth(item);
    });
  } else {
    var rangeStart = dashboardTodayISO();
    var rangeEnd = toISO(addDays(parseISO(rangeStart), 6));
    var visible = visibleCalendarEvents(rangeStart, rangeEnd);
    var ministry = visible.filter(function (item) { return isMinistryPriority(item); });
    var scoped = visible.filter(function (item) { return !isMinistryPriority(item) && !eventIsBirthday(item); });
    items = ministry.concat(scoped);
    birthdayItems = visibleCalendarEvents(rangeStart, rangeEnd, { includeBirthdays: true, onlyBirthdays: true })
      .sort(function (a, b) { return parseISO(a.start) - parseISO(b.start); });
  }
  items = items.sort(function (a, b) {
    var dateDelta = parseISO(a.start) - parseISO(b.start);
    if (dateDelta) return dateDelta;
    return calendarTimeValue(a).localeCompare(calendarTimeValue(b));
  });
  if (!items.length && !birthdayItems.length) {
    var message = priorityScope === "month"
      ? "No upcoming teachings this month."
      : "No events in the next seven days.";
    els.priorityList.innerHTML = "<p class='empty-state'>" + message + "</p>";
    return;
  }
  function appendPriorityItem(item, birthday) {
    var div = document.createElement("div");
    div.className = "priority-item" + (isMinistryPriority(item) ? " ministry" : "") + (birthday ? " birthday-priority" : "");
    var details = document.createElement("button");
    details.type = "button";
    details.className = "priority-event-button";
    details.innerHTML = "<strong>" + (birthday ? escapeHTML(birthdayName(item)) : eventTitle(item)) + "</strong><span>" + eventDateRangeLabel(item) + (birthday ? "" : " / " + eventTimingLabel(item)) + "</span>";
    details.addEventListener("click", function () { viewEvent(item.id); });
    bindEventCardKeyboard(details, item.id);
    div.appendChild(details);
    if (!birthday) {
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete-button trash-button event-card-delete";
      remove.innerHTML = trashIcon();
      remove.setAttribute("aria-label", "Delete event");
      remove.addEventListener("click", function (event) {
        event.stopPropagation();
        confirmDeleteEvent(item.id, event.currentTarget);
      });
      div.appendChild(remove);
    }
    els.priorityList.appendChild(div);
  }
  var itemLimit = priorityScope === "month" ? 12 : items.length;
  if (priorityScope === "week") {
    var classItems = items.filter(isClassEvent);
    var otherItems = items.filter(function (item) { return !isClassEvent(item); });
    if (classItems.length) {
      var group = document.createElement("section");
      group.className = "priority-group" + (priorityClassGroupOpen ? "" : " collapsed");
      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "priority-group-toggle";
      toggle.setAttribute("aria-expanded", String(priorityClassGroupOpen));
      toggle.innerHTML = "<span class='priority-group-chevron' aria-hidden='true'>&#8964;</span><strong>Class</strong><small>" + classItems.length + " event" + (classItems.length === 1 ? "" : "s") + "</small>";
      toggle.addEventListener("click", function () {
        priorityClassGroupOpen = !priorityClassGroupOpen;
        renderPriorityList();
      });
      group.appendChild(toggle);
      var groupItems = document.createElement("div");
      groupItems.className = "priority-group-items";
      classItems.slice(0, itemLimit).forEach(function (item) {
        var groupItem = document.createElement("div");
        groupItem.className = "priority-item";
        var details = document.createElement("button");
        details.type = "button";
        details.className = "priority-event-button";
        details.innerHTML = "<strong>" + escapeHTML(eventTitle(item)) + "</strong><span>" + eventDateRangeLabel(item) + " / " + eventTimingLabel(item) + "</span>";
        details.addEventListener("click", function () { viewEvent(item.id); });
        bindEventCardKeyboard(details, item.id);
        groupItem.appendChild(details);
        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "delete-button trash-button event-card-delete";
        remove.innerHTML = trashIcon();
        remove.setAttribute("aria-label", "Delete event");
        remove.addEventListener("click", function (event) {
          event.stopPropagation();
          confirmDeleteEvent(item.id, event.currentTarget);
        });
        groupItem.appendChild(remove);
        groupItems.appendChild(groupItem);
      });
      group.appendChild(groupItems);
      els.priorityList.appendChild(group);
    }
    otherItems.slice(0, itemLimit).forEach(function (item) {
      appendPriorityItem(item, false);
    });
  } else {
    items.slice(0, itemLimit).forEach(function (item) {
      appendPriorityItem(item, false);
    });
  }
  if (birthdayItems.length) {
    var heading = document.createElement("h3");
    heading.className = "priority-subheading";
    heading.textContent = "Birthdays";
    els.priorityList.appendChild(heading);
    birthdayItems.slice(0, 8).forEach(function (item) {
      appendPriorityItem(item, true);
    });
  }
}

function addTask(title, dueDate, source, eventId, eventTitleValue, dueTime, alarm) {
  var cleanTitle = title.trim();
  if (!cleanTitle) return;
  state.tasks.unshift({
    id: id("task"),
    title: cleanTitle,
    dueDate: dueDate || "",
    dueTime: dueTime || "",
    alarm: alarm || "none",
    done: false,
    completedAt: "",
    notes: "",
    groupId: "",
    sortOrder: -Date.now(),
    source: source || "dashboard",
    eventId: eventId || null,
    eventTitle: eventTitleValue || ""
  });
  saveState();
  renderTasks();
  renderCalendar();
}

function createTaskGroup(name) {
  var cleanName = String(name || "").trim();
  if (!cleanName) {
    showToast("Name the task group first.");
    if (els.taskGroupInput) els.taskGroupInput.focus();
    return;
  }
  var duplicate = (state.taskGroups || []).some(function (group) {
    return group.name.toLowerCase() === cleanName.toLowerCase();
  });
  if (duplicate) {
    showToast("That task group already exists.");
    return;
  }
  state.taskGroups.push({ id: id("task-group"), name: cleanName, collapsed: false, sortOrder: state.taskGroups.length });
  saveState();
  renderTasks();
  els.taskGroupInput.value = "";
  showToast("Task group created.");
}

function orderedTaskGroups() {
  return (state.taskGroups || []).slice().sort(function (left, right) {
    return (left.sortOrder || 0) - (right.sortOrder || 0);
  });
}

function orderedTasksForGroup(groupId) {
  return state.tasks.filter(function (task) {
    return (task.groupId || "") === (groupId || "");
  }).sort(function (left, right) {
    return (left.sortOrder || 0) - (right.sortOrder || 0);
  });
}

function setTaskSortOrder(groupId, tasks) {
  (tasks || orderedTasksForGroup(groupId)).forEach(function (task, index) {
    task.sortOrder = index;
  });
}

function moveTaskToGroup(taskId, groupId, targetTaskId, placeAfter) {
  var task = state.tasks.find(function (item) { return item.id === taskId; });
  if (!task) return;
  var source = task.groupId || "";
  var destination = groupId || "";
  var ordered = orderedTasksForGroup(destination).filter(function (item) { return item.id !== taskId; });
  task.groupId = destination;
  var position = ordered.length;
  if (targetTaskId) {
    var targetIndex = ordered.findIndex(function (item) { return item.id === targetTaskId; });
    if (targetIndex >= 0) position = targetIndex + (placeAfter ? 1 : 0);
  }
  ordered.splice(position, 0, task);
  setTaskSortOrder(destination, ordered);
  if (source !== destination) setTaskSortOrder(source);
  saveState();
  renderTasks();
}

function clearTaskPointerDrag(commit) {
  if (!taskPointerDrag) return;
  var drag = taskPointerDrag;
  var destinationList = drag.placeholder.parentElement;
  var destinationGroup = destinationList && destinationList.closest(".task-group");
  var destinationGroupId = destinationGroup ? (destinationGroup.dataset.groupId || "") : drag.groupId;
  var nextTaskId = "";
  if (destinationList) {
    var siblings = Array.prototype.slice.call(destinationList.children);
    var placeholderIndex = siblings.indexOf(drag.placeholder);
    for (var index = placeholderIndex + 1; index < siblings.length; index += 1) {
      if (siblings[index].classList && siblings[index].classList.contains("task-card")) {
        nextTaskId = siblings[index].dataset.taskId || "";
        break;
      }
    }
  }
  if (drag.placeholder.parentElement) drag.placeholder.remove();
  drag.card.classList.remove("pointer-dragging");
  drag.card.removeAttribute("style");
  taskPointerDrag = null;
  document.removeEventListener("pointermove", moveTaskPointerDrag);
  document.removeEventListener("pointerup", finishTaskPointerDrag);
  document.removeEventListener("pointercancel", cancelTaskPointerDrag);
  if (commit) moveTaskToGroup(drag.taskId, destinationGroupId, nextTaskId || null, false);
  else renderTasks();
}

function moveTaskPointerDrag(event) {
  if (!taskPointerDrag || event.pointerId !== taskPointerDrag.pointerId) return;
  var drag = taskPointerDrag;
  drag.card.style.left = Math.max(8, event.clientX - drag.offsetX) + "px";
  drag.card.style.top = Math.max(8, event.clientY - drag.offsetY) + "px";
  var target = document.elementFromPoint(event.clientX, event.clientY);
  var list = target && target.closest(".task-group-list");
  if (!list) return;
  var cards = Array.prototype.slice.call(list.querySelectorAll(":scope > .task-card"));
  var nextCard = cards.find(function (card) {
    var rect = card.getBoundingClientRect();
    return event.clientY < rect.top + (rect.height / 2);
  });
  if (nextCard) list.insertBefore(drag.placeholder, nextCard);
  else list.appendChild(drag.placeholder);
}

function finishTaskPointerDrag(event) {
  if (!taskPointerDrag || event.pointerId !== taskPointerDrag.pointerId) return;
  clearTaskPointerDrag(true);
}

function cancelTaskPointerDrag(event) {
  if (!taskPointerDrag || event.pointerId !== taskPointerDrag.pointerId) return;
  clearTaskPointerDrag(false);
}

function beginTaskPointerDrag(event, task, card, groupId) {
  if (event.button !== 0 || task.done || taskPointerDrag) return;
  event.preventDefault();
  var rect = card.getBoundingClientRect();
  var placeholder = document.createElement("li");
  placeholder.className = "task-drag-placeholder";
  placeholder.style.height = rect.height + "px";
  card.parentElement.insertBefore(placeholder, card.nextSibling);
  card.classList.add("pointer-dragging");
  card.style.width = rect.width + "px";
  card.style.height = rect.height + "px";
  card.style.left = rect.left + "px";
  card.style.top = rect.top + "px";
  document.body.appendChild(card);
  taskPointerDrag = {
    card: card,
    groupId: groupId || "",
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    placeholder: placeholder,
    pointerId: event.pointerId,
    taskId: task.id
  };
  if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
  document.addEventListener("pointermove", moveTaskPointerDrag);
  document.addEventListener("pointerup", finishTaskPointerDrag);
  document.addEventListener("pointercancel", cancelTaskPointerDrag);
}

function setTaskGroupSortOrderFromDom() {
  var ids = Array.prototype.slice.call(els.taskList.querySelectorAll(":scope > .task-group"))
    .map(function (groupItem) { return groupItem.dataset.groupId || ""; })
    .filter(Boolean);
  ids.forEach(function (groupId, index) {
    var group = (state.taskGroups || []).find(function (item) { return item.id === groupId; });
    if (group) group.sortOrder = index;
  });
}

function clearTaskGroupPointerDrag(commit) {
  if (!taskGroupPointerDrag) return;
  var drag = taskGroupPointerDrag;
  if (drag.placeholder.parentElement) drag.placeholder.replaceWith(drag.groupItem);
  else drag.originList.appendChild(drag.groupItem);
  drag.groupItem.classList.remove("pointer-dragging");
  drag.groupItem.removeAttribute("style");
  taskGroupPointerDrag = null;
  document.removeEventListener("pointermove", moveTaskGroupPointerDrag);
  document.removeEventListener("pointerup", finishTaskGroupPointerDrag);
  document.removeEventListener("pointercancel", cancelTaskGroupPointerDrag);
  if (commit) {
    setTaskGroupSortOrderFromDom();
    saveState();
  }
  renderTasks();
}

function moveTaskGroupPointerDrag(event) {
  if (!taskGroupPointerDrag || event.pointerId !== taskGroupPointerDrag.pointerId) return;
  var drag = taskGroupPointerDrag;
  drag.groupItem.style.left = Math.max(8, event.clientX - drag.offsetX) + "px";
  drag.groupItem.style.top = Math.max(8, event.clientY - drag.offsetY) + "px";
  var target = document.elementFromPoint(event.clientX, event.clientY);
  var targetGroup = target && target.closest(".task-group");
  if (!targetGroup || targetGroup === drag.groupItem || targetGroup.parentElement !== els.taskList || !targetGroup.dataset.groupId) return;
  var rect = targetGroup.getBoundingClientRect();
  if (event.clientY < rect.top + (rect.height / 2)) {
    els.taskList.insertBefore(drag.placeholder, targetGroup);
  } else {
    els.taskList.insertBefore(drag.placeholder, targetGroup.nextSibling);
  }
}

function finishTaskGroupPointerDrag(event) {
  if (!taskGroupPointerDrag || event.pointerId !== taskGroupPointerDrag.pointerId) return;
  clearTaskGroupPointerDrag(true);
}

function cancelTaskGroupPointerDrag(event) {
  if (!taskGroupPointerDrag || event.pointerId !== taskGroupPointerDrag.pointerId) return;
  clearTaskGroupPointerDrag(false);
}

function beginTaskGroupPointerDrag(event, groupItem) {
  if (event.button !== 0 || taskGroupPointerDrag || taskPointerDrag) return;
  event.preventDefault();
  event.stopPropagation();
  var rect = groupItem.getBoundingClientRect();
  var placeholder = document.createElement("li");
  placeholder.className = "task-group-drag-placeholder";
  placeholder.style.width = rect.width + "px";
  placeholder.style.height = rect.height + "px";
  groupItem.parentElement.insertBefore(placeholder, groupItem.nextSibling);
  groupItem.classList.add("pointer-dragging");
  groupItem.style.width = rect.width + "px";
  groupItem.style.height = rect.height + "px";
  groupItem.style.left = rect.left + "px";
  groupItem.style.top = rect.top + "px";
  document.body.appendChild(groupItem);
  taskGroupPointerDrag = {
    groupItem: groupItem,
    originList: els.taskList,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    placeholder: placeholder,
    pointerId: event.pointerId
  };
  if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
  document.addEventListener("pointermove", moveTaskGroupPointerDrag);
  document.addEventListener("pointerup", finishTaskGroupPointerDrag);
  document.addEventListener("pointercancel", cancelTaskGroupPointerDrag);
}

function clearTemplatePointerDrag(commit) {
  if (!templatePointerDrag) return;
  var drag = templatePointerDrag;
  var list = drag.placeholder.parentElement;
  var nextTemplateId = "";

  if (list) {
    var siblings = Array.prototype.slice.call(list.children);
    var placeholderIndex = siblings.indexOf(drag.placeholder);
    for (var index = placeholderIndex + 1; index < siblings.length; index += 1) {
      if (siblings[index].classList && siblings[index].classList.contains("template-row")) {
        nextTemplateId = siblings[index].dataset.templateId || "";
        break;
      }
    }
  }

  if (drag.placeholder.parentElement) drag.placeholder.remove();
  drag.card.classList.remove("pointer-dragging");
  drag.card.removeAttribute("style");
  if (drag.card.parentElement === document.body) drag.card.remove();
  templatePointerDrag = null;
  document.removeEventListener("pointermove", moveTemplatePointerDrag);
  document.removeEventListener("pointerup", finishTemplatePointerDrag);
  document.removeEventListener("pointercancel", cancelTemplatePointerDrag);

  if (commit) {
    var ordered = state.templates.filter(function (template) { return template.id !== drag.templateId; });
    var position = ordered.length;
    if (nextTemplateId) {
      var nextIndex = ordered.findIndex(function (template) { return template.id === nextTemplateId; });
      if (nextIndex >= 0) position = nextIndex;
    }
    ordered.splice(position, 0, drag.template);
    state.templates = ordered;
    saveState();
  }

  renderTemplates();
  renderActiveTemplate();
}

function moveTemplatePointerDrag(event) {
  if (!templatePointerDrag || event.pointerId !== templatePointerDrag.pointerId) return;
  var drag = templatePointerDrag;
  drag.card.style.left = Math.max(8, event.clientX - drag.offsetX) + "px";
  drag.card.style.top = Math.max(8, event.clientY - drag.offsetY) + "px";

  var target = document.elementFromPoint(event.clientX, event.clientY);
  var list = target && target.closest("#templateList");
  if (!list) return;
  var rows = Array.prototype.slice.call(list.children).filter(function (row) {
    return row.classList && row.classList.contains("template-row");
  });
  var nextRow = rows.find(function (row) {
    var rect = row.getBoundingClientRect();
    return event.clientY < rect.top + (rect.height / 2);
  });
  if (nextRow) list.insertBefore(drag.placeholder, nextRow);
  else list.appendChild(drag.placeholder);
}

function finishTemplatePointerDrag(event) {
  if (!templatePointerDrag || event.pointerId !== templatePointerDrag.pointerId) return;
  clearTemplatePointerDrag(true);
}

function cancelTemplatePointerDrag(event) {
  if (!templatePointerDrag || event.pointerId !== templatePointerDrag.pointerId) return;
  clearTemplatePointerDrag(false);
}

function beginTemplatePointerDrag(event, template, row) {
  if (event.button !== 0 || templatePointerDrag || workflowPointerDrag) return;
  event.preventDefault();
  event.stopPropagation();

  var rect = row.getBoundingClientRect();
  var placeholder = document.createElement("div");
  placeholder.className = "template-drag-placeholder";
  placeholder.style.height = rect.height + "px";
  row.parentElement.insertBefore(placeholder, row.nextSibling);
  row.classList.add("pointer-dragging");
  row.style.width = rect.width + "px";
  row.style.height = rect.height + "px";
  row.style.left = rect.left + "px";
  row.style.top = rect.top + "px";
  document.body.appendChild(row);

  templatePointerDrag = {
    card: row,
    template: template,
    templateId: template.id,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    placeholder: placeholder,
    pointerId: event.pointerId
  };
  if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
  document.addEventListener("pointermove", moveTemplatePointerDrag);
  document.addEventListener("pointerup", finishTemplatePointerDrag);
  document.addEventListener("pointercancel", cancelTemplatePointerDrag);
}

function clearWorkflowPointerDrag(commit) {
  if (!workflowPointerDrag) return;
  var drag = workflowPointerDrag;
  var list = drag.placeholder.parentElement;
  var nextItemId = "";
  if (list) {
    var siblings = Array.prototype.slice.call(list.children);
    var placeholderIndex = siblings.indexOf(drag.placeholder);
    for (var index = placeholderIndex + 1; index < siblings.length; index += 1) {
      if (siblings[index].classList && siblings[index].classList.contains("workflow-item")) {
        nextItemId = siblings[index].dataset.itemId || "";
        break;
      }
    }
  }
  if (drag.placeholder.parentElement) drag.placeholder.remove();
  drag.card.classList.remove("pointer-dragging");
  drag.card.removeAttribute("style");
  workflowPointerDrag = null;
  document.removeEventListener("pointermove", moveWorkflowPointerDrag);
  document.removeEventListener("pointerup", finishWorkflowPointerDrag);
  document.removeEventListener("pointercancel", cancelWorkflowPointerDrag);
  if (commit) {
    var ordered = drag.template.items.filter(function (item) { return item.id !== drag.itemId; });
    var position = ordered.length;
    if (nextItemId) {
      var nextIndex = ordered.findIndex(function (item) { return item.id === nextItemId; });
      if (nextIndex >= 0) position = nextIndex;
    }
    ordered.splice(position, 0, drag.item);
    drag.template.items = ordered;
    saveState();
  }
  renderActiveTemplate();
}

function moveWorkflowPointerDrag(event) {
  if (!workflowPointerDrag || event.pointerId !== workflowPointerDrag.pointerId) return;
  var drag = workflowPointerDrag;
  drag.card.style.left = Math.max(8, event.clientX - drag.offsetX) + "px";
  drag.card.style.top = Math.max(8, event.clientY - drag.offsetY) + "px";
  var target = document.elementFromPoint(event.clientX, event.clientY);
  var list = target && target.closest(".workflow-items");
  if (!list) return;
  var rows = Array.prototype.slice.call(list.children).filter(function (row) {
    return row.classList && row.classList.contains("workflow-item");
  });
  var nextRow = rows.find(function (row) {
    var rect = row.getBoundingClientRect();
    return event.clientY < rect.top + (rect.height / 2);
  });
  if (nextRow) list.insertBefore(drag.placeholder, nextRow);
  else list.appendChild(drag.placeholder);
}

function finishWorkflowPointerDrag(event) {
  if (!workflowPointerDrag || event.pointerId !== workflowPointerDrag.pointerId) return;
  clearWorkflowPointerDrag(true);
}

function cancelWorkflowPointerDrag(event) {
  if (!workflowPointerDrag || event.pointerId !== workflowPointerDrag.pointerId) return;
  clearWorkflowPointerDrag(false);
}

function beginWorkflowPointerDrag(event, template, item, row) {
  if (event.button !== 0 || workflowPointerDrag) return;
  event.preventDefault();
  event.stopPropagation();
  var rect = row.getBoundingClientRect();
  var placeholder = document.createElement("div");
  placeholder.className = "workflow-drag-placeholder";
  placeholder.style.height = rect.height + "px";
  row.parentElement.insertBefore(placeholder, row.nextSibling);
  row.classList.add("pointer-dragging");
  row.style.width = rect.width + "px";
  row.style.height = rect.height + "px";
  row.style.left = rect.left + "px";
  row.style.top = rect.top + "px";
  document.body.appendChild(row);
  workflowPointerDrag = {
    card: row,
    template: template,
    item: item,
    itemId: item.id,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    placeholder: placeholder,
    pointerId: event.pointerId
  };
  if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
  document.addEventListener("pointermove", moveWorkflowPointerDrag);
  document.addEventListener("pointerup", finishWorkflowPointerDrag);
  document.addEventListener("pointercancel", cancelWorkflowPointerDrag);
}

function editWorkflowItem(template, item, row) {
  if (row.classList.contains("editing")) return;
  row.classList.add("editing");
  var label = row.querySelector(".workflow-item-label");
  var input = document.createElement("input");
  input.type = "text";
  input.className = "workflow-item-input";
  input.value = item.title;
  label.replaceWith(input);
  var finished = false;
  function finish(save) {
    if (finished) return;
    finished = true;
    var value = input.value.trim();
    if (save && !value) {
      showToast("Checklist items need a name.");
      renderActiveTemplate();
      return;
    }
    if (save) {
      item.title = value;
      saveState();
    }
    renderActiveTemplate();
  }
  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  });
  input.addEventListener("blur", function () { finish(true); });
  input.focus();
  input.select();
}

function toggleTaskGroup(groupId) {
  state.settings = state.settings || {};
  var key = groupId || "__ungrouped__";
  state.settings.openTaskGroupId = state.settings.openTaskGroupId === key ? "" : key;
  saveState();
  renderTasks();
}

function deleteTaskGroup(groupId) {
  var group = state.taskGroups.find(function (item) { return item.id === groupId; });
  if (!group) return;
  if (!window.confirm("Delete the \"" + group.name + "\" group? Its tasks will move to Ungrouped.")) return;
  state.settings = state.settings || {};
  if (state.settings.openTaskGroupId === groupId) state.settings.openTaskGroupId = "__ungrouped__";
  state.tasks.forEach(function (task) {
    if (task.groupId === groupId) task.groupId = "";
  });
  state.taskGroups = state.taskGroups.filter(function (item) { return item.id !== groupId; });
  orderedTasksForGroup("").forEach(function (task, index) { task.sortOrder = index; });
  saveState();
  renderTasks();
  showToast("Task group removed. Its tasks are still saved.");
}

function taskSourceLabel(task) {
  if (task.eventTitle) return "From event: " + task.eventTitle;
  return task.source === "event" ? "Event checklist item" : "Dashboard task";
}

function syncChecklistCompletion(task) {
  state.events.forEach(function (event) {
    (event.checklist || []).forEach(function (item) {
      if (item.taskId !== task.id) return;
      item.title = task.title;
      item.dueDate = task.dueDate || "";
      item.done = !!task.done;
    });
  });
}

function setTaskCompletion(task, done) {
  if (!task) return;
  task.done = !!done;
  task.completedAt = done ? new Date().toISOString() : "";
  syncChecklistCompletion(task);
  saveState();
  renderAll();
}

function permanentlyDeleteTask(task) {
  if (!task) return;
  if (!window.confirm("Permanently delete \"" + task.title + "\"? This cannot be undone.")) return;
  state.tasks = state.tasks.filter(function (item) { return item.id !== task.id; });
  state.events.forEach(function (event) {
    event.checklist = (event.checklist || []).filter(function (item) {
      return item.taskId !== task.id;
    });
  });
  saveState();
  if (els.taskModal.open) els.taskModal.close();
  editingTaskId = null;
  renderAll();
  if (els.eventDetailModal.open && viewingEventId) viewEvent(viewingEventId);
  showToast("Task permanently deleted.");
}

function openTaskModal(taskId, options) {
  var task = state.tasks.find(function (item) { return item.id === taskId; });
  if (!task) return;
  var settings = options || {};
  var editMode = !!settings.edit;
  taskModalOpenSource = settings.source || "";
  editingTaskId = task.id;
  els.taskModalEyebrow.textContent = task.done ? "Finished Task" : "Task";
  els.taskModalTitle.textContent = editMode ? "Edit Task" : task.title || "Task";
  els.taskModalInput.value = task.title || "";
  els.taskModalDueDate.value = task.dueDate || "";
  els.taskModalDueTime.value = task.dueTime || "";
  els.taskModalAlarm.value = task.alarm || "none";
  els.taskModalNotes.value = task.notes || "";
  els.taskModalDueDate.required = false;
  els.taskModalSource.textContent = taskSourceLabel(task);
  els.taskModalViewDue.textContent = task.dueDate
    ? "Due " + displayDate(task.dueDate) + (task.dueTime ? " at " + formatTimeOption(task.dueTime) : "") + (task.alarm && task.alarm !== "none" ? " · " + alarmLabel(task.alarm) : "")
    : "No due date";
  els.taskModalViewNotes.textContent = task.notes || "No notes added.";
  els.taskModal.dataset.mode = editMode ? "edit" : "view";
  els.taskModalView.hidden = editMode;
  els.taskModalEditFields.hidden = !editMode;
  els.editTaskButton.hidden = editMode;
  els.deleteTaskPermanentlyButton.hidden = !task.done;
  els.saveTaskButton.hidden = !editMode;
  els.saveTaskButton.textContent = "Save Task";
  els.taskModal.showModal();
  window.setTimeout(function () {
    if (editMode) els.taskModalInput.focus();
    else els.editTaskButton.focus();
  }, 0);
}

function renderTasks() {
  els.taskList.innerHTML = "";
  var completedView = taskView === "finished";
  var visibleTasks = state.tasks.filter(function (task) { return completedView ? !!task.done : !task.done; });
  els.activeTasksButton.classList.toggle("active", !completedView);
  els.activeTasksButton.setAttribute("aria-selected", String(!completedView));
  els.finishedTasksButton.classList.toggle("active", completedView);
  els.finishedTasksButton.setAttribute("aria-selected", String(completedView));

  if (!visibleTasks.length && (completedView || !(state.taskGroups || []).length)) {
    els.taskList.innerHTML = "<li class='task-empty'><span class='empty-state'>" + (completedView ? "No finished tasks yet." : "No saved tasks yet.") + "</span></li>";
    return;
  }

  state.settings = state.settings || {};
  var openTaskGroupId = typeof state.settings.openTaskGroupId === "string"
    ? state.settings.openTaskGroupId
    : "__ungrouped__";
  var groups = orderedTaskGroups().map(function (group) {
    return {
      id: group.id,
      name: group.name,
      eventId: group.eventId || "",
      collapsed: openTaskGroupId !== group.id
    };
  });
  var ungroupedVisible = visibleTasks.some(function (task) { return !(task.groupId || ""); });
  if (ungroupedVisible || !groups.length) groups.unshift({
    id: "",
    name: "Ungrouped",
    collapsed: openTaskGroupId !== "__ungrouped__",
    implicit: true
  });

  function appendTaskCard(list, task, groupId) {
    var li = document.createElement("li");
    li.className = "task-card";
    li.dataset.taskId = task.id;
    if (task.done) li.classList.add("done");

    var dragHandle = document.createElement("button");
    dragHandle.type = "button";
    dragHandle.className = "task-drag-handle";
    dragHandle.disabled = completedView;
    dragHandle.title = "Drag to reorder";
    dragHandle.setAttribute("aria-label", "Drag " + task.title + " to reorder");
    dragHandle.innerHTML = dragHandleIcon();

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.setAttribute("aria-label", "Mark task complete");
    checkbox.addEventListener("change", function () {
      setTaskCompletion(task, checkbox.checked);
    });

    var titleWrap = document.createElement("div");
    titleWrap.className = "task-title";
    if (task.eventTitle) {
      var eventTitleLabel = document.createElement(task.eventId ? "button" : "strong");
      eventTitleLabel.textContent = task.eventTitle;
      if (task.eventId) {
        eventTitleLabel.type = "button";
        eventTitleLabel.className = "task-event-link";
        eventTitleLabel.title = "Open " + task.eventTitle;
        eventTitleLabel.addEventListener("click", function () {
          var linkedEvent = findEventForView(task.eventId);
          if (linkedEvent) viewEvent(linkedEvent.id);
          else showToast("The linked event is no longer available.");
        });
      }
      titleWrap.appendChild(eventTitleLabel);
    }
    var taskButton = document.createElement("button");
    taskButton.type = "button";
    taskButton.className = "task-edit-button";
    var taskTitleLabel = document.createElement("span");
    taskTitleLabel.textContent = task.title;
    var dueLabel = document.createElement("small");
    dueLabel.textContent = task.dueDate
      ? "Due " + displayDate(task.dueDate) + (task.dueTime ? " at " + formatTimeOption(task.dueTime) : "") + (task.alarm && task.alarm !== "none" ? " · " + alarmLabel(task.alarm) : "")
      : "No due date";
    taskButton.append(taskTitleLabel, dueLabel);
    taskButton.addEventListener("click", function () { openTaskModal(task.id, { source: taskView }); });
    titleWrap.appendChild(taskButton);

    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-button trash-button";
    remove.innerHTML = trashIcon();
    remove.setAttribute("aria-label", task.done ? "Permanently delete task" : "Delete task");
    remove.addEventListener("click", function () {
      permanentlyDeleteTask(task);
    });

    li.append(dragHandle, checkbox, titleWrap, remove);
    if (!completedView) {
      dragHandle.addEventListener("pointerdown", function (event) {
        beginTaskPointerDrag(event, task, li, groupId);
      });
    }
    list.appendChild(li);
  }

  groups.forEach(function (group) {
    var matchingTasks = orderedTasksForGroup(group.id).filter(function (task) {
      return completedView ? !!task.done : !task.done;
    });
    if (completedView && !matchingTasks.length) return;
    var groupItem = document.createElement("li");
    groupItem.className = "task-group" + (group.collapsed ? " collapsed" : "");
    groupItem.dataset.groupId = group.id;
    var header = document.createElement("div");
    header.className = "task-group-header" + (!group.implicit && !completedView ? " can-reorder" : "");
    if (!group.implicit && !completedView) {
      var groupDragHandle = document.createElement("button");
      groupDragHandle.type = "button";
      groupDragHandle.className = "task-group-drag-handle";
      groupDragHandle.title = "Drag to reorder group";
      groupDragHandle.setAttribute("aria-label", "Drag " + group.name + " group to reorder");
      groupDragHandle.innerHTML = dragHandleIcon();
      groupDragHandle.addEventListener("pointerdown", function (event) {
        beginTaskGroupPointerDrag(event, groupItem);
      });
      header.appendChild(groupDragHandle);
    }
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "task-group-toggle";
    toggle.setAttribute("aria-expanded", String(!group.collapsed));
    toggle.setAttribute("aria-label", (group.collapsed ? "Expand " : "Collapse ") + group.name);
    toggle.innerHTML = "<span class='task-group-chevron' aria-hidden='true'></span>";
    toggle.addEventListener("click", function () {
      toggleTaskGroup(group.id);
    });
    header.appendChild(toggle);
    var linkedEventId = group.eventId || ((matchingTasks.find(function (task) { return !!task.eventId; }) || {}).eventId || "");
    var groupName = document.createElement(linkedEventId ? "button" : "span");
    groupName.className = linkedEventId ? "task-group-event-link" : "task-group-name";
    groupName.textContent = group.name;
    if (linkedEventId) {
      groupName.type = "button";
      groupName.title = "Open " + group.name;
      groupName.addEventListener("click", function () {
        var linkedEvent = findEventForView(linkedEventId);
        if (linkedEvent) viewEvent(linkedEvent.id);
        else showToast("The linked event is no longer available.");
      });
    }
    var count = document.createElement("small");
    count.className = "task-group-count";
    count.textContent = matchingTasks.length;
    header.append(groupName, count);
    if (!group.implicit) {
      var deleteGroup = document.createElement("button");
      deleteGroup.type = "button";
      deleteGroup.className = "trash-button task-group-delete";
      deleteGroup.innerHTML = trashIcon();
      deleteGroup.setAttribute("aria-label", "Delete " + group.name + " group");
      deleteGroup.addEventListener("click", function () { deleteTaskGroup(group.id); });
      header.appendChild(deleteGroup);
    }
    groupItem.appendChild(header);
    var list = document.createElement("ul");
    list.className = "task-group-list";
    matchingTasks.forEach(function (task) { appendTaskCard(list, task, group.id); });
    if (!matchingTasks.length && !completedView) {
      var empty = document.createElement("p");
      empty.className = "task-group-empty";
      empty.textContent = "Drop tasks here";
      list.appendChild(empty);
    }
    if (!group.collapsed) groupItem.appendChild(list);
    els.taskList.appendChild(groupItem);
  });
}

function setWorkspaceView(view) {
  workspaceView = view === "workflows" ? "workflows" : "tasks";
  var workflowsActive = workspaceView === "workflows";
  els.tasksWorkspaceButton.classList.toggle("active", !workflowsActive);
  els.tasksWorkspaceButton.setAttribute("aria-selected", String(!workflowsActive));
  els.workflowsWorkspaceButton.classList.toggle("active", workflowsActive);
  els.workflowsWorkspaceButton.setAttribute("aria-selected", String(workflowsActive));
  els.tasksWorkspaceView.hidden = workflowsActive;
  els.workflowsWorkspaceView.hidden = !workflowsActive;
  els.workPanelEyebrow.textContent = workflowsActive ? "Routines" : "Tasks";
  els.workPanelTitle.textContent = workflowsActive ? "Workflow Templates" : "Main Task List";
}

function renderTemplates() {
  els.templateList.innerHTML = "";
  if (!state.templates.length) {
    els.templateList.innerHTML = "<p class='empty-state'>Create your first workflow template.</p>";
  } else {
    state.templates.forEach(function (template) {
      var row = document.createElement("div");
      row.className = "template-row" + (template.id === state.activeTemplateId ? " active" : "");
      row.dataset.templateId = template.id;

      var grip = document.createElement("button");
      grip.type = "button";
      grip.className = "template-drag-handle";
      grip.innerHTML = dragHandleIcon();
      grip.setAttribute("aria-label", "Drag to reorder " + template.name);
      grip.title = "Drag to reorder";
      grip.addEventListener("pointerdown", function (event) {
        beginTemplatePointerDrag(event, template, row);
      });

      var name = document.createElement("button");
      name.type = "button";
      name.className = "template-name-button";
      name.textContent = template.name;
      name.addEventListener("click", function () {
        state.activeTemplateId = state.activeTemplateId === template.id ? null : template.id;
        saveState();
        renderTemplates();
        renderActiveTemplate();
      });

      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete-button trash-button";
      remove.innerHTML = trashIcon();
      remove.setAttribute("aria-label", "Delete template");
      remove.addEventListener("click", function () {
        state.templates = state.templates.filter(function (item) { return item.id !== template.id; });
        if (state.activeTemplateId === template.id) state.activeTemplateId = null;
        saveState();
        renderTemplates();
        renderActiveTemplate();
      });

      row.append(grip, name, remove);
      els.templateList.appendChild(row);
    });
  }
  renderEventTemplateSelect();
}

function renderActiveTemplate() {
  var template = state.templates.find(function (item) { return item.id === state.activeTemplateId; });
  els.activeWorkflow.innerHTML = "";
  if (!template) {
    els.activeWorkflow.innerHTML = "<p class='empty-state'>Click a template name to edit its checklist.</p>";
    return;
  }

  var title = document.createElement("h3");
  title.textContent = template.name;
  els.activeWorkflow.appendChild(title);

  var list = document.createElement("div");
  list.className = "workflow-items";
  if (!template.items.length) {
    list.innerHTML = "<p class='empty-state'>No checklist items yet.</p>";
  } else {
    template.items.forEach(function (item) {
      var row = document.createElement("div");
      row.className = "workflow-item";
      row.dataset.itemId = item.id;
      var grip = document.createElement("button");
      grip.type = "button";
      grip.className = "workflow-drag-handle";
      grip.innerHTML = dragHandleIcon();
      grip.setAttribute("aria-label", "Reorder checklist item");
      grip.title = "Drag to reorder";
      grip.addEventListener("pointerdown", function (event) {
        beginWorkflowPointerDrag(event, template, item, row);
      });
      var label = document.createElement("button");
      label.type = "button";
      label.className = "workflow-item-label";
      label.textContent = item.title;
      label.setAttribute("aria-label", "Edit checklist item " + item.title);
      label.addEventListener("click", function () { editWorkflowItem(template, item, row); });
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete-button trash-button";
      remove.innerHTML = trashIcon();
      remove.setAttribute("aria-label", "Delete checklist item");
      remove.addEventListener("click", function () {
        template.items = template.items.filter(function (check) { return check.id !== item.id; });
        saveState();
        renderActiveTemplate();
      });
      row.append(grip, label, remove);
      list.appendChild(row);
    });
  }
  els.activeWorkflow.appendChild(list);

  var extra = document.createElement("form");
  extra.className = "workflow-extra";
  extra.innerHTML = "<input type='text' placeholder='Add checklist item'><button class='text-button small-control' type='submit'>Add</button>";
  extra.addEventListener("submit", function (event) {
    event.preventDefault();
    var input = extra.querySelector("input");
    var value = input.value.trim();
    if (!value) return;
    template.items.push({ id: id("template-item"), title: value });
    input.value = "";
    saveState();
    renderActiveTemplate();
  });
  els.activeWorkflow.appendChild(extra);
}

function createTemplate(event) {
  event.preventDefault();
  var name = els.templateName.value.trim();
  if (!name) {
    showToast("Name the template first.");
    return;
  }
  var template = { id: id("template"), name: name, items: [] };
  state.templates.unshift(template);
  state.activeTemplateId = template.id;
  els.templateName.value = "";
  saveState();
  renderTemplates();
  renderActiveTemplate();
}

function openLink(url) {
  if (!url || url === "#") return;
  window.open(url, "_blank", "noopener");
}

function newsItems(section) {
  if (!newsData || !newsData[section]) return [];
  var top = newsData.top && newsData.top[section];
  return newsData[section].filter(function (item) {
    if (!top) return true;
    return item.url !== top.url && item.title !== top.title;
  });
}

function sourceInitials(source) {
  return String(source || "News")
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(function (part) { return part.charAt(0).toUpperCase(); })
    .join("") || "N";
}

function setNewsThumb(media, item) {
  if (item && item.image) {
    media.style.backgroundImage = "url('" + item.image.replace(/'/g, "%27") + "')";
    return;
  }
  media.classList.add("no-image");
  media.textContent = sourceInitials(item && item.source);
}

function renderNewsList(list, items) {
  list.innerHTML = "";
  if (!items.length) {
    list.innerHTML = "<li class='news-card-empty'><span class='empty-state'>No feed items loaded yet.</span></li>";
    return;
  }
  items.slice(0, 5).forEach(function (item) {
    var li = document.createElement("li");
    li.className = "news-card-item";
    var link = document.createElement("a");
    link.className = "news-card-link";
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.addEventListener("click", function (event) {
      event.preventDefault();
      openReader(newsReaderItem(item));
    });
    var media = document.createElement("span");
    media.className = "news-card-thumb";
    setNewsThumb(media, item);
    var copy = document.createElement("span");
    copy.className = "news-card-copy";
    var title = document.createElement("strong");
    title.textContent = item.title;
    var source = document.createElement("span");
    source.textContent = item.source;
    copy.append(title, source);
    link.append(media, copy);
    li.appendChild(link);
    list.appendChild(li);
  });
}

function pauseIcon() {
  return "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M7 5h4v14H7V5Zm6 0h4v14h-4V5Z'/></svg>";
}

function playIcon() {
  return "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M8 5v14l11-7L8 5Z'/></svg>";
}

function renderHeadlinePauseButton() {
  var button = document.createElement("button");
  button.type = "button";
  button.className = "headline-pause-button";
  button.innerHTML = headlineCarouselPaused ? playIcon() : pauseIcon();
  button.title = headlineCarouselPaused ? "Play carousel" : "Pause carousel";
  button.setAttribute("aria-label", headlineCarouselPaused ? "Play carousel" : "Pause carousel");
  button.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    setHeadlinePaused(!headlineCarouselPaused);
  });
  return button;
}

function renderHeadlineMedia(item) {
  els.headlineMedia.innerHTML = "";
  if (item.video) {
    var video = document.createElement("video");
    video.controls = true;
    video.preload = "metadata";
    video.poster = item.image || "";
    video.src = item.video;
    video.className = "headline-video";
    video.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
    });
    els.headlineMedia.appendChild(video);
    els.headlineMedia.appendChild(renderHeadlinePauseButton());
    return;
  }
  var image = document.createElement("div");
  image.className = "headline-image";
  if (item.image) image.style.backgroundImage = "linear-gradient(145deg, rgba(73, 53, 72, 0.22), rgba(31, 30, 30, 0.28)), url('" + item.image.replace(/'/g, "%27") + "')";
  if (item.isVideo && !item.video) {
    var badge = document.createElement("span");
    badge.className = "video-badge";
    badge.textContent = "Watch video";
    image.appendChild(badge);
  }
  els.headlineMedia.appendChild(image);
  els.headlineMedia.appendChild(renderHeadlinePauseButton());
}

function renderHeadline() {
  var topItems = [];
  if (newsData && newsData.top && newsData.top.world) topItems.push({ label: "World", item: newsData.top.world });
  if (newsData && newsData.top && newsData.top.philippines) topItems.push({ label: "Philippines", item: newsData.top.philippines });
  if (newsData && newsData.top && newsData.top.theology) topItems.push({ label: "Theology", item: newsData.top.theology });
  if (!topItems.length) {
    activeHeadlineItem = null;
    els.headlineStory.href = "#";
    els.headlineMedia.innerHTML = "<div class='headline-image'></div>";
    els.headlineKicker.textContent = "Top Headline";
    els.headlineTitle.textContent = newsLoadError ? "News feeds need attention." : "News feeds are loading.";
    els.headlineSummary.textContent = newsLoadError || "If a source blocks its feed, the dashboard will use the other available sources.";
    return;
  }
  if (headlineIndex >= topItems.length) headlineIndex = 0;
  var active = topItems[headlineIndex];
  var item = active.item;
  activeHeadlineItem = item;
  els.headlineStory.href = item.url;
  els.headlineKicker.textContent = active.label + " / " + item.source;
  els.headlineTitle.textContent = item.title;
  els.headlineSummary.textContent = item.summary || "Click to open the full story.";
  renderHeadlineMedia(item);
  document.querySelectorAll(".headline-dot").forEach(function (button, index) {
    button.classList.toggle("active", index === headlineIndex);
  });
}

function newsReaderItem(item) {
  return {
    source: item.source || "News",
    title: item.title || "Article",
    summary: item.summary || "",
    contentHtml: item.contentHtml || "",
    url: item.url || "#",
    image: item.image || "",
    isVideo: item.isVideo,
    video: item.video,
    articleKind: "news",
    fullArticleLoaded: false
  };
}

function prayerReaderItem(item, fallbackTitle) {
  var title = item.peopleGroup || item.country || item.name || fallbackTitle || "Prayer Focus";
  var points = (item.prayerPoints || []).length
    ? "<h2>Prayer Points</h2><ul>" + item.prayerPoints.map(function (point) { return "<li>" + escapeHTML(point) + "</li>"; }).join("") + "</ul>"
    : "";
  var summary = item.summary ? "<p>" + escapeHTML(item.summary) + "</p>" : "";
  var flagImage = highResolutionFlagUrl(item.flagImage || "");
  return {
    source: item.source || fallbackTitle || "Prayer Focus",
    title: title,
    summary: item.summary || "",
    contentHtml: summary + points,
    url: item.url || "#",
    image: flagImage,
    imageKind: flagImage ? "flag" : "",
    articleKind: "news",
    fullArticleLoaded: false
  };
}

function highResolutionFlagUrl(url) {
  return String(url || "").replace(/flagcdn\.com\/w(?:80|160|320)\//i, "flagcdn.com/w640/");
}

function renderNews() {
  renderHeadline();
  renderNewsList(els.worldNewsList, newsItems("world"));
  renderNewsList(els.philippinesNewsList, newsItems("philippines"));
  renderNewsList(els.theologyNewsList, newsItems("theology"));
}

function selectedNewsQuery() {
  var params = new URLSearchParams();
  var selected = state.settings.newsSources || {};
  ["world", "philippines", "theology"].forEach(function (section) {
    var sources = (selected[section] || []);
    if (!sources.length) sources = orderedNewsSources(section).slice(0, 10).map(function (source) { return source.source; });
    if (sources.length) params.set(section + "Sources", sources.join("|"));
  });
  var custom = state.settings.customNewsSources || {};
  var cleanCustom = { world: [], philippines: [], theology: [] };
  ["world", "philippines", "theology"].forEach(function (section) {
    cleanCustom[section] = (custom[section] || []).filter(function (source) {
      return source && source.source && /^https?:\/\//i.test(source.url || "");
    });
  });
  if (cleanCustom.world.length || cleanCustom.philippines.length || cleanCustom.theology.length) {
    params.set("customSources", JSON.stringify(cleanCustom));
  }
  var query = params.toString();
  return query ? "?" + query : "";
}

function orderedNewsSources(section) {
  var options = newsSourceOptions || { world: [], philippines: [], theology: [] };
  var custom = state.settings.customNewsSources || { world: [], philippines: [], theology: [] };
  var sources = (options[section] || []).concat(custom[section] || []).filter(function (source) {
    return source.source !== "Vatican News";
  });
  var order = state.settings.newsSourceOrder && state.settings.newsSourceOrder[section] ? state.settings.newsSourceOrder[section] : [];
  if (!order.length) return sources;
  var byName = {};
  sources.forEach(function (source) { byName[source.source] = source; });
  var ordered = order.map(function (name) { return byName[name]; }).filter(Boolean);
  sources.forEach(function (source) {
    if (order.indexOf(source.source) < 0) ordered.push(source);
  });
  return ordered;
}

function saveSourceOrder(section, names) {
  state.settings.newsSourceOrder = state.settings.newsSourceOrder || { world: [], philippines: [], theology: [] };
  state.settings.newsSourceOrder[section] = names;
  saveState();
}

async function loadNews() {
  newsLoadError = "";
  try {
    var response = await dashboardFetch("/api/news" + selectedNewsQuery());
    newsData = await readDashboardJson(response, "News");
    if (newsData && newsData.errors && newsData.errors.length) {
      console.warn("News feed warnings", newsData.errors);
    }
  } catch (error) {
    newsLoadError = hostedHint("news", error);
    newsData = { world: [], philippines: [], theology: [], top: {}, errors: [newsLoadError] };
    showToast("News feeds need attention. See the Daily Brief panel.");
  }
  renderNews();
}

async function loadNewsSources() {
  if (newsSourceOptions) return newsSourceOptions;
  newsSourceLoadError = "";
  try {
    var response = await dashboardFetch("/api/news-sources");
    newsSourceOptions = await readDashboardJson(response, "News sources");
  } catch (error) {
    newsSourceLoadError = hostedHint("news-sources", error);
    newsSourceOptions = JSON.parse(JSON.stringify(FALLBACK_NEWS_SOURCES));
    showToast("News source choices are using fallback data.");
  }
  return newsSourceOptions;
}

function renderSourceModal() {
  if (!els.sourceGrid) return;
  var options = newsSourceOptions || { world: [], philippines: [], theology: [] };
  var labels = { world: "World", philippines: "Philippines", theology: "Theology" };
  var selected = state.settings.newsSources || {};
  var custom = state.settings.customNewsSources || { world: [], philippines: [], theology: [] };
  els.sourceGrid.innerHTML = "";
  if (newsSourceLoadError) {
    var errorNote = document.createElement("p");
    errorNote.className = "source-error-note";
    errorNote.textContent = newsSourceLoadError + " Showing built-in source choices for now.";
    els.sourceGrid.appendChild(errorNote);
  }
  ["world", "philippines", "theology"].forEach(function (section) {
    var sources = orderedNewsSources(section);
    var chosen = selected[section] || [];
    var block = document.createElement("section");
    block.className = "source-section" + (!sources.length ? " unavailable" : "");
    block.innerHTML =
      "<div class='source-section-head'><h3>" + labels[section] + "</h3><label class='check-all-source'><input type='checkbox' data-check-all='" + section + "'" + (chosen.length && chosen.length === sources.length ? " checked" : "") + "> Check all</label><span class='source-count'>" + chosen.length + "/10</span></div>" +
      "<div class='source-add-row'><input data-custom-name='" + section + "' type='text' placeholder='Source name'><input data-custom-url='" + section + "' type='url' placeholder='RSS / Atom URL'><button class='text-button small-control' data-add-source='" + section + "' type='button'>Add</button></div>" +
      "<div class='source-options'></div>";
    var list = block.querySelector(".source-options");
    if (!sources.length) {
      list.innerHTML = "<p class='source-empty'>No sources are available yet. Add an RSS or Atom feed above.</p>";
    }
    sources.forEach(function (source) {
      var idValue = "source-" + section + "-" + source.source.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      var row = document.createElement("label");
      row.className = "source-option" + (source.custom ? " custom-source-option" : "");
      row.htmlFor = idValue;
      row.dataset.section = section;
      row.dataset.sourceName = source.source;
      row.innerHTML =
        "<input id='" + idValue + "' type='checkbox' data-section='" + section + "' value='" + escapeHTML(source.source) + "'" + (chosen.indexOf(source.source) >= 0 ? " checked" : "") + ">" +
        "<span>" + escapeHTML(source.source) + "</span>" +
        (source.custom ? "<button class='trash-button' data-remove-source='" + section + "' data-source-name='" + escapeHTML(source.source) + "' type='button' aria-label='Remove custom source'>" + trashIcon() + "</button>" : "");
      addSourceOptionDrag(row);
      list.appendChild(row);
    });
    updateSourceCount(block);
    els.sourceGrid.appendChild(block);
  });
}

function renderSourceLoading(message) {
  if (!els.sourceGrid) return;
  els.sourceGrid.innerHTML = "<p class='source-loading-note'>" + escapeHTML(message || "Loading sources...") + "</p>";
}

function updateSourceCount(block) {
  var count = block.querySelectorAll("input[data-section]:checked").length;
  var countEl = block.querySelector(".source-count");
  if (!countEl) return;
  countEl.textContent = count + "/10";
  countEl.classList.toggle("over-limit", count > 10);
  countEl.classList.toggle("within-limit", count <= 10);
}

function addSourceOptionDrag(row) {
  var startX = 0;
  var startY = 0;
  var dragging = false;
  row.addEventListener("pointerdown", function (event) {
    if (event.target.closest("input, button")) return;
    startX = event.clientX;
    startY = event.clientY;
    dragging = false;
    row.setPointerCapture(event.pointerId);
  });
  row.addEventListener("pointermove", function (event) {
    if (!row.hasPointerCapture(event.pointerId)) return;
    var moved = Math.abs(event.clientX - startX) + Math.abs(event.clientY - startY);
    if (moved < 8) return;
    dragging = true;
    row.classList.add("dragging");
    event.preventDefault();
  });
  row.addEventListener("pointerup", function (event) {
    if (!row.hasPointerCapture(event.pointerId)) return;
    row.releasePointerCapture(event.pointerId);
    row.classList.remove("dragging");
    if (!dragging) return;
    var target = document.elementFromPoint(event.clientX, event.clientY);
    var targetRow = target && target.closest ? target.closest(".source-option") : null;
    if (!targetRow || targetRow.dataset.section !== row.dataset.section || targetRow === row) return;
    state.settings.newsSources = collectSelectedSources();
    var section = row.dataset.section;
    var rows = Array.from(row.closest(".source-options").querySelectorAll(".source-option"));
    var names = rows.map(function (item) { return item.dataset.sourceName; });
    var fromIndex = names.indexOf(row.dataset.sourceName);
    var toIndex = names.indexOf(targetRow.dataset.sourceName);
    if (fromIndex < 0 || toIndex < 0) return;
    var movedName = names.splice(fromIndex, 1)[0];
    names.splice(toIndex, 0, movedName);
    saveSourceOrder(section, names);
    renderSourceModal();
  });
  row.addEventListener("pointercancel", function () {
    row.classList.remove("dragging");
  });
}

async function openSourceModal() {
  renderSourceLoading("Loading sources...");
  els.sourceModal.showModal();
  await loadNewsSources();
  renderSourceModal();
}

function collectSelectedSources() {
  var next = { world: [], philippines: [], theology: [] };
  els.sourceGrid.querySelectorAll("input[type='checkbox']:checked").forEach(function (input) {
    var section = input.dataset.section;
    if (next[section]) next[section].push(input.value);
  });
  return next;
}

function sourceSelectionOverLimit() {
  return ["world", "philippines", "theology"].some(function (section) {
    return els.sourceGrid.querySelectorAll("input[data-section='" + section + "']:checked").length > 10;
  });
}

function plainTextFromHtml(html) {
  var div = document.createElement("div");
  div.innerHTML = html || "";
  return div.textContent || div.innerText || "";
}

function sanitizeArticleHtml(html) {
  var template = document.createElement("template");
  template.innerHTML = html || "";
  template.content.querySelectorAll("script,style,iframe,object,embed,form,input,button").forEach(function (node) {
    node.remove();
  });
  template.content.querySelectorAll("*").forEach(function (node) {
    Array.from(node.attributes).forEach(function (attribute) {
      var name = attribute.name.toLowerCase();
      var value = attribute.value || "";
      if (name.indexOf("on") === 0 || /javascript:/i.test(value)) node.removeAttribute(attribute.name);
    });
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener");
    }
  });
  return template.innerHTML;
}

function renderRssFeeds() {
  if (!els.rssFeedList) return;
  var feeds = state.rssFeeds || [];
  els.rssReadMoreUrl.value = state.rssReadMoreUrl || "";
  if (!feeds.length) {
    els.rssFeedList.innerHTML = "<p class='empty-state'>No RSS sources yet.</p>";
    return;
  }
  els.rssFeedList.innerHTML = "";
  feeds.forEach(function (feed, index) {
    var row = document.createElement("div");
    var sourceName = feed.name || feed.url;
    var sourceKey = feed.url || sourceName;
    var isActive = state.activeRssSource === sourceKey || state.activeRssSource === sourceName;
    row.className = "rss-feed-chip" + (isActive ? " active" : "");
    row.dataset.index = String(index);
    row.innerHTML = "<button class='rss-source-button' type='button'><span>" + escapeHTML(sourceName) + "</span></button><button class='trash-button' type='button' aria-label='Remove RSS feed'>" + trashIcon() + "</button>";
    addRssChipDrag(row, index);
    row.addEventListener("click", function (event) {
      if (event.target.closest(".trash-button")) return;
      if (row.dataset.dragMoved === "true") {
        row.dataset.dragMoved = "";
        return;
      }
      state.activeRssSource = isActive ? "" : sourceKey;
      saveState();
      renderRssFeeds();
      renderRssCards();
    });
    row.querySelector(".trash-button").addEventListener("click", function () {
      state.rssFeeds.splice(index, 1);
      if (state.activeRssSource === sourceName || state.activeRssSource === sourceKey) state.activeRssSource = "";
      saveState();
      renderRssFeeds();
      loadRssFeeds();
    });
    els.rssFeedList.appendChild(row);
  });
}

function addRssChipDrag(row, index) {
  var startX = 0;
  var startY = 0;
  var dragging = false;
  row.addEventListener("pointerdown", function (event) {
    if (event.target.closest(".trash-button")) return;
    startX = event.clientX;
    startY = event.clientY;
    dragging = false;
    row.dataset.dragMoved = "";
    row.setPointerCapture(event.pointerId);
  });
  row.addEventListener("pointermove", function (event) {
    if (!row.hasPointerCapture(event.pointerId)) return;
    var moved = Math.abs(event.clientX - startX) + Math.abs(event.clientY - startY);
    if (moved < 8) return;
    dragging = true;
    row.dataset.dragMoved = "true";
    row.classList.add("dragging");
    event.preventDefault();
  });
  row.addEventListener("pointerup", function (event) {
    if (!row.hasPointerCapture(event.pointerId)) return;
    row.releasePointerCapture(event.pointerId);
    row.classList.remove("dragging");
    if (!dragging) return;
    var target = document.elementFromPoint(event.clientX, event.clientY);
    var targetChip = target && target.closest ? target.closest(".rss-feed-chip") : null;
    var toIndex = targetChip ? Number(targetChip.dataset.index) : -1;
    if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex === index || !state.rssFeeds[index]) return;
    var moved = state.rssFeeds.splice(index, 1)[0];
    state.rssFeeds.splice(toIndex, 0, moved);
    saveState();
    renderRssFeeds();
    loadRssFeeds();
  });
  row.addEventListener("pointercancel", function () {
    row.classList.remove("dragging");
    row.dataset.dragMoved = "";
  });
}

function selectRssItems(items) {
  var sorted = items.slice().sort(function (a, b) {
    return (b.publishedTime || Date.parse(b.publishedAt) || 0) - (a.publishedTime || Date.parse(a.publishedAt) || 0);
  });
  if (!sorted.length) return [];
  var first = sorted[0];
  var remaining = sorted.slice(1).sort(function () { return Math.random() - 0.5; }).slice(0, 4);
  return [first].concat(remaining);
}

function readerArticleBody(item) {
  var body = item.contentHtml || item.summary || "";
  var imageClass = item.imageKind === "flag" ? "reader-hero-image reader-hero-flag" : "reader-hero-image";
  var image = item.image ? "<figure class='" + imageClass + "'><img src='" + escapeHTML(item.image) + "' alt=''></figure>" : "";
  var videoNote = item.isVideo && !item.video ? "<p><strong>Video article:</strong> open the original story to watch the embedded video.</p>" : "";
  var loading = item.articleKind === "news" && !item.fullArticleLoaded ? "<p class='reader-loading-note'>Loading full article text...</p>" : "";
  return image + videoNote + loading + (sanitizeArticleHtml(body) || "<p>" + escapeHTML(plainTextFromHtml(body) || "This feed only provided a short preview.") + "</p>");
}

async function enrichReaderArticle(item) {
  if (!item || item.articleKind !== "news" || item.fullArticleLoaded || !/^https?:\/\//i.test(item.url || "")) return;
  try {
    var response = await dashboardFetch("/api/article?url=" + encodeURIComponent(item.url));
    var article = await readDashboardJson(response, "Article");
    if (article.title && (!item.title || item.title === "Article")) item.title = article.title;
    if (article.image && !item.image) item.image = article.image;
    if (article.contentHtml) item.contentHtml = article.contentHtml;
    item.fullArticleLoaded = true;
    if (activeReaderItem && activeReaderItem.url === item.url) {
      activeReaderItem = item;
      if (document.body.classList.contains("main-reader-active")) renderDockReader(item);
      else if (els.readerModal.open) {
        els.readerTitle.textContent = item.title || "Article";
        els.readerBody.innerHTML = readerArticleBody(item);
      }
    }
  } catch (error) {
    item.fullArticleLoaded = true;
    item.contentHtml = item.contentHtml || item.summary || hostedHint("article", error);
    if (activeReaderItem && activeReaderItem.url === item.url) {
      if (document.body.classList.contains("main-reader-active")) renderDockReader(item);
      else if (els.readerModal.open) els.readerBody.innerHTML = readerArticleBody(item);
    }
  }
}

function pushReaderHistory(item) {
  if (!item) return;
  var last = readerHistory[readerHistoryIndex];
  if (last && last.url === item.url && last.title === item.title) return;
  readerHistory = readerHistory.slice(0, readerHistoryIndex + 1);
  readerHistory.push(item);
  readerHistoryIndex = readerHistory.length - 1;
}

function updateReaderHistoryButtons() {
  if (!els.dockReaderBack || !els.dockReaderForward) return;
  els.dockReaderBack.disabled = readerHistoryIndex <= 0;
  els.dockReaderForward.disabled = readerHistoryIndex >= readerHistory.length - 1;
}

function renderDockReader(item) {
  if (!item) return;
  els.dockReaderSource.textContent = item.source || "RSS";
  els.dockReaderTitle.textContent = item.title || "Article";
  els.dockReaderBody.innerHTML =
    "<h1>" + escapeHTML(item.title || "Article") + "</h1>" +
    readerArticleBody(item);
  els.dockReaderOriginalLink.href = item.url || "#";
  updateReaderHistoryButtons();
}

function loadReaderItem(item, options) {
  if (!item) return;
  activeReaderItem = item;
  if (!options || options.record !== false) pushReaderHistory(item);
  if (document.body.classList.contains("main-reader-active")) {
    renderDockReader(item);
    enrichReaderArticle(item);
    return;
  }
  els.readerSource.textContent = item.source || "RSS";
  els.readerTitle.textContent = item.title || "Article";
  els.readerBody.innerHTML = readerArticleBody(item);
  els.readerOriginalLink.href = item.url || "#";
  els.readerModal.showModal();
  updateReaderHistoryButtons();
  enrichReaderArticle(item);
}

function openReader(item) {
  loadReaderItem(item);
}

function applySplitRatio(ratio) {
  var clean = Math.min(78, Math.max(28, Number(ratio) || 50));
  els.splitReaderLayout.style.setProperty("--split-left", clean + "%");
  state.settings.readerSplit = clean;
  saveState();
}

function openSplitReader() {
  if (!activeReaderItem) return;
  els.splitReaderSource.textContent = activeReaderItem.source || "RSS";
  els.splitReaderTitle.textContent = activeReaderItem.title || "Article";
  els.splitReaderArticle.innerHTML = readerArticleBody(activeReaderItem);
  els.splitReaderOriginalLink.href = activeReaderItem.url || "#";
  els.splitReaderFallback.hidden = true;
  els.splitReaderFrame.hidden = false;
  els.splitReaderFrame.src = activeReaderItem.url || "about:blank";
  applySplitRatio(state.settings.readerSplit || 50);
  els.splitReaderFallbackLink.href = activeReaderItem.url || "#";
  els.splitReaderModal.showModal();
}

function updateSplitFromPointer(clientX) {
  var rect = els.splitReaderLayout.getBoundingClientRect();
  if (!rect.width) return;
  applySplitRatio(((clientX - rect.left) / rect.width) * 100);
}

function applyMainSplitRatio(ratio) {
  var clean = Math.min(78, Math.max(38, Number(ratio) || 62));
  document.body.style.setProperty("--main-left", clean + "%");
  state.settings.mainReaderSplit = clean;
  saveState();
}

function openMainSplitReader() {
  if (!activeReaderItem) return;
  els.readerModal.close();
  renderDockReader(activeReaderItem);
  applyMainSplitRatio(state.settings.mainReaderSplit || 62);
  document.body.classList.add("main-reader-active");
  els.splitReaderDock.setAttribute("aria-hidden", "false");
  els.mainSplitDivider.hidden = false;
  var shell = document.querySelector(".app-shell");
  var rssPanel = document.querySelector(".rss-panel");
  if (shell && rssPanel) shell.scrollTop = Math.max(0, rssPanel.offsetTop - 24);
}

function closeMainSplitReader() {
  document.body.classList.remove("main-reader-active");
  els.splitReaderDock.setAttribute("aria-hidden", "true");
  els.mainSplitDivider.hidden = true;
  els.dockReaderBody.innerHTML = "";
  mainSplitDragging = false;
}

function updateMainSplitFromPointer(clientX) {
  var width = window.innerWidth || document.documentElement.clientWidth;
  if (!width) return;
  applyMainSplitRatio((clientX / width) * 100);
}

function scrollSegmentTargets() {
  var max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  var watch = document.querySelector(".tools-prayer-grid");
  var news = document.querySelector(".news-sports-grid");
  return [
    0,
    watch ? Math.min(max, Math.max(0, watch.offsetTop - 8)) : Math.round(max * 0.35),
    news ? Math.min(max, Math.max(0, news.offsetTop - 8)) : Math.round(max * 0.7),
    max
  ];
}

function currentScrollSegment() {
  var y = window.scrollY || document.documentElement.scrollTop || 0;
  var targets = scrollSegmentTargets();
  var closest = 0;
  var distance = Infinity;
  targets.forEach(function (target, index) {
    var nextDistance = Math.abs(y - target);
    if (nextDistance < distance) {
      closest = index;
      distance = nextDistance;
    }
  });
  return closest;
}

function updateScrollDots() {
  if (!els.scrollDots) return;
  var active = currentScrollSegment();
  els.scrollDots.querySelectorAll("[data-scroll-target]").forEach(function (button) {
    button.classList.toggle("active", Number(button.dataset.scrollTarget) === active);
  });
}

function scrollToSegment(index) {
  var targets = scrollSegmentTargets();
  var clean = Math.max(0, Math.min(targets.length - 1, index));
  window.scrollTo({ top: targets[clean], behavior: "smooth" });
  window.setTimeout(updateScrollDots, 360);
}

function renderRssCards() {
  if (!els.rssCardGrid) return;
  var activeFeed = (state.rssFeeds || []).find(function (feed) {
    var sourceName = feed.name || feed.url;
    var sourceKey = feed.url || sourceName;
    return state.activeRssSource === sourceKey || state.activeRssSource === sourceName;
  });
  var candidates = (rssData.items || []).filter(function (item) {
    if (!state.activeRssSource) return true;
    if (activeFeed) {
      var sourceName = activeFeed.name || activeFeed.url;
      return item.feedUrl === activeFeed.url || item.source === sourceName || item.source === activeFeed.url;
    }
    return item.source === state.activeRssSource || item.feedUrl === state.activeRssSource;
  });
  var items = selectRssItems(candidates);
  els.rssCardGrid.innerHTML = "";
  if (!items.length) {
    var errorText = rssData.errors && rssData.errors.length ? rssData.errors[0] : "";
    els.rssCardGrid.innerHTML = "<p class='empty-state'>" + escapeHTML(errorText || (state.activeRssSource ? "No posts found for this RSS source yet." : "Add an RSS feed to read latest posts here.")) + "</p>";
  } else {
    items.forEach(function (item) {
      var button = document.createElement("button");
      button.className = "rss-card";
      button.type = "button";
      button.innerHTML =
        "<span class='rss-card-meta'>" + escapeHTML(item.source || "RSS") + "</span>" +
        "<h3>" + escapeHTML(item.title || "Untitled") + "</h3>" +
        "<p>" + escapeHTML(item.summary || plainTextFromHtml(item.contentHtml).slice(0, 150) || "Open to read from the dashboard.") + "</p>";
      button.addEventListener("click", function () { openReader(item); });
      els.rssCardGrid.appendChild(button);
    });
  }
  if (state.rssReadMoreUrl) {
    els.rssReadMoreLink.hidden = false;
    els.rssReadMoreLink.href = state.rssReadMoreUrl;
  } else {
    els.rssReadMoreLink.hidden = true;
  }
}

async function loadRssFeeds() {
  renderRssFeeds();
  if (!(state.rssFeeds || []).length) {
    rssData = { items: [], errors: [] };
    renderRssCards();
    return;
  }
  try {
    var response = await dashboardFetch("/api/rss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feeds: state.rssFeeds })
    });
    rssData = await readDashboardJson(response, "RSS");
  } catch (error) {
    var message = hostedHint("rss", error);
    rssData = { items: [], errors: [message] };
    showToast("RSS feeds need attention. See the RSS panel.");
  }
  renderRssCards();
}

function startHeadlineCarousel() {
  if (headlineTimer) window.clearInterval(headlineTimer);
  headlineTimer = null;
  if (headlineCarouselPaused) return;
  headlineTimer = window.setInterval(function () {
    var total = [newsData && newsData.top && newsData.top.world, newsData && newsData.top && newsData.top.philippines, newsData && newsData.top && newsData.top.theology].filter(Boolean).length || 1;
    headlineIndex = (headlineIndex + 1) % total;
    renderHeadline();
  }, 20000);
}

function setHeadlinePaused(paused) {
  headlineCarouselPaused = !!paused;
  state.settings.headlineCarouselPaused = headlineCarouselPaused;
  saveState();
  renderHeadline();
  startHeadlineCarousel();
}

function renderScoreboard() {
  document.querySelectorAll(".sport-tab").forEach(function (button) {
    button.classList.toggle("active", button.dataset.sport === currentSport);
  });
  els.scoreboard.className = "scoreboard " + currentSport + "-scoreboard";
  els.scoreboard.innerHTML = "";
  var data = sportsData[currentSport];
  if (!data) {
    els.scoreboard.innerHTML = "<div class='score-card featured'><strong>Loading " + currentSport.toUpperCase() + "</strong><span>Connecting to free scoreboard data.</span></div>";
    return;
  }
  if (data.errors && data.errors.length && !(data.games || []).length && !(data.priorityGames || []).length) {
    els.scoreboard.innerHTML = "<div class='score-card featured error-card'><strong>" + currentSport.toUpperCase() + " feed needs attention</strong><span>" + escapeHTML(data.errors[0]) + "</span></div>";
    return;
  }
  renderLeagueScoreboard(data);
}

function teamLogo(team) {
  var abbreviation = teamAbbreviation(team);
  var logo = team && team.logo ? team.logo : "";
  if (currentSport === "nba") logo = nbaLogoFallback(team) || logo;
  return logo
    ? "<img src='" + escapeHTML(logo) + "' alt='' onerror=\"this.replaceWith(Object.assign(document.createElement('span'),{className:'team-logo-fallback',textContent:'" + escapeHTML(abbreviation) + "'}))\">"
    : "<span class='team-logo-fallback'>" + escapeHTML(abbreviation) + "</span>";
}

function statValue(value) {
  return value === 0 || value ? value : "-";
}

function isFinishedStatus(status) {
  return /final|finished|full time|game finished|completed/i.test(status || "");
}

function isScheduledStatus(status) {
  return /scheduled|not started|pre-game|preview|time tbd/i.test(status || "");
}

function isLiveGame(game) {
  return !!game && !isFinishedStatus(game.status) && !isScheduledStatus(game.status);
}

function gameMood(game, label) {
  var teams = game && game.competitors ? game.competitors : [];
  var normalizedLabel = String(label || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  var favorite = teams.find(function (team) {
    var normalizedTeam = String(team.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return normalizedTeam === normalizedLabel || normalizedTeam.indexOf(normalizedLabel) !== -1 || normalizedLabel.indexOf(normalizedTeam) !== -1;
  });
  var opponent = teams.find(function (team) { return team !== favorite; });
  var favoriteScore = favorite ? Number(favorite.score) : NaN;
  var opponentScore = opponent ? Number(opponent.score) : NaN;
  var live = isLiveGame(game);
  if (!Number.isFinite(favoriteScore) || !Number.isFinite(opponentScore)) return { className: live ? "is-live" : "", message: live ? "Live now" : "Game day" };
  if (favoriteScore === opponentScore) return { className: live ? "is-live is-tied" : "", message: live ? "All even. Keep pressing." : "Even score" };
  var winning = favoriteScore > opponentScore;
  if (live) return { className: "is-live " + (winning ? "is-winning" : "is-losing"), message: winning ? "Leading live" : "Keep fighting" };
  if (isFinishedStatus(game.status)) return { className: winning ? "is-winner" : "is-loser", message: winning ? "Final win" : "Final" };
  return { className: winning ? "is-winning" : "is-losing", message: winning ? "In front" : "Game day" };
}

function liveGameMarker(game) {
  if (!game) return "";
  var status = game.status || "";
  if (isFinishedStatus(status) || isScheduledStatus(status)) return status || "Scheduled";
  var detail = game.statusDetail || game.period || "";
  if (detail && !/in progress|live/i.test(detail)) return detail + (game.clock ? " / " + game.clock : "");
  if (game.clock) return game.clock;
  return status || "Live";
}

function shortMonthDay(value) {
  var date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) date = new Date();
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function todayLongDate() {
  return new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function teamAbbreviation(team) {
  var value = team && team.name ? team.name : "";
  var existing = team && team.abbreviation ? String(team.abbreviation).trim() : "";
  if (existing && existing.length <= 4 && !/\s/.test(existing)) return existing.toUpperCase();
  var known = {
    "Atlanta Hawks": "ATL",
    "Boston Celtics": "BOS",
    "Brooklyn Nets": "BKN",
    "Charlotte Hornets": "CHA",
    "Chicago Bulls": "CHI",
    "Cleveland Cavaliers": "CLE",
    "Dallas Mavericks": "DAL",
    "Denver Nuggets": "DEN",
    "Detroit Pistons": "DET",
    "Golden State Warriors": "GSW",
    "Houston Rockets": "HOU",
    "Indiana Pacers": "IND",
    "LA Clippers": "LAC",
    "Los Angeles Clippers": "LAC",
    "Los Angeles Lakers": "LAL",
    "Memphis Grizzlies": "MEM",
    "Miami Heat": "MIA",
    "Milwaukee Bucks": "MIL",
    "Minnesota Timberwolves": "MIN",
    "New Orleans Pelicans": "NOP",
    "New York Knicks": "NYK",
    "Oklahoma City Thunder": "OKC",
    "Orlando Magic": "ORL",
    "Philadelphia 76ers": "PHI",
    "Phoenix Suns": "PHX",
    "Portland Trail Blazers": "POR",
    "Sacramento Kings": "SAC",
    "San Antonio Spurs": "SAS",
    "Toronto Raptors": "TOR",
    "Utah Jazz": "UTA",
    "Washington Wizards": "WAS",
    "New York Yankees": "NYY",
    "Los Angeles Dodgers": "LAD",
    "New York Mets": "NYM",
    "Chicago White Sox": "CWS",
    "Boston Red Sox": "BOS",
    "Toronto Blue Jays": "TOR",
    "New England Patriots": "NE",
    "Los Angeles Rams": "LAR",
    "Los Angeles Chargers": "LAC",
    "New York Giants": "NYG",
    "New York Jets": "NYJ"
  };
  if (known[value]) return known[value];
  return (existing || value || "?").slice(0, 3).toUpperCase();
}

function nbaLogoFallback(team) {
  var code = teamAbbreviation(team).toLowerCase();
  var espnCodes = { phx: "phx", por: "por", sac: "sac", uta: "utah" };
  var codeForUrl = espnCodes[code] || code;
  return codeForUrl && codeForUrl !== "?" ? "https://a.espncdn.com/i/teamlogos/nba/500/" + codeForUrl + ".png" : "";
}

function shortTeamName(team) {
  var value = team && team.name ? team.name : "";
  if (!value) return "";
  var known = {
    "Los Angeles Lakers": "Lakers",
    "New England Patriots": "Patriots",
    "New York Yankees": "Yankees",
    "Los Angeles Dodgers": "Dodgers",
    "Boston Red Sox": "Red Sox",
    "Chicago White Sox": "White Sox",
    "Toronto Blue Jays": "Blue Jays"
  };
  if (known[value]) return known[value];
  var parts = value.split(" ");
  if (parts.length > 2 && /^(New|Los|San|St\.|St|Kansas|Las|Oklahoma|Golden|Tampa|Green)$/i.test(parts[0])) return parts.slice(-2).join(" ");
  return parts[parts.length - 1] || value;
}

function gameScoreLine(game) {
  var teams = game.competitors || [];
  if (teams.length < 2) return game.shortName || game.name || "";
  return teams.map(function (team) {
    return teamAbbreviation(team) + (team.score && team.score !== "-" ? " " + team.score : "");
  }).join(" - ");
}

function leagueScoreboardUrl() {
  if (currentSport === "mlb") return "https://www.mlb.com/scores";
  if (currentSport === "nfl") return "https://www.nfl.com/scores/";
  return "https://www.nba.com/games";
}

function gameLink(game) {
  return (game && game.url) || leagueScoreboardUrl();
}

function renderGameCard(game, label, meta) {
  var card = document.createElement("a");
  var mood = gameMood(game, label);
  card.className = "priority-matchup " + mood.className;
  card.href = gameLink(game);
  card.target = "_blank";
  card.rel = "noopener";
  card.setAttribute("aria-label", "Open " + label + " game page");
  if (!game) {
    card.innerHTML = "<strong>" + escapeHTML(label) + "</strong><span>No current game for your favorite team.</span>";
    return card;
  }
  var teams = game.competitors || [];
  var scores = teams.map(function (team) { return Number(team.score); });
  var maxScore = Math.max.apply(Math, scores.filter(function (score) { return Number.isFinite(score); }));
  var hasWinner = Number.isFinite(maxScore) && scores.filter(function (score) { return score === maxScore; }).length === 1;
  var nextLine = meta && meta.nextLabel ? "<span class='next-game-line'>" + escapeHTML(meta.nextLabel) + "</span>" : "";
  card.innerHTML =
    "<div class='favorite-card-head'><div><strong class='favorite-team-label'>" + escapeHTML(label) + "</strong><span>" + escapeHTML(shortMonthDay(game.date)) + " Game</span></div><span class='score-status'>" + (isLiveGame(game) ? "<i class='live-pulse' aria-hidden='true'></i>" : "") + escapeHTML(liveGameMarker(game)) + "</span></div>" +
    "<div class='matchup-teams'>" + teams.map(function (team) {
      var score = Number(team.score);
      var winner = hasWinner && score === maxScore;
      var normalizedTeam = String(team.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      var normalizedLabel = String(label || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      var favorite = normalizedTeam === normalizedLabel || normalizedTeam.indexOf(normalizedLabel) !== -1 || normalizedLabel.indexOf(normalizedTeam) !== -1;
      return "<div class='matchup-team" + (favorite ? " favorite-team" : "") + "'>" + teamLogo(team) + "<span>" + escapeHTML(team.name) + "</span><strong class='" + (winner ? "winning-score" : "") + "'>" + escapeHTML(team.score) + "</strong></div>";
    }).join("") + "</div><span class='favorite-momentum'>" + escapeHTML(mood.message) + "</span>" + nextLine;
  return card;
}

function renderPriorityGames(data) {
  var games = data.priorityGames && data.priorityGames.length
    ? data.priorityGames
    : [{ label: data.priorityTeamLabel || data.priorityTeam, game: data.priorityGame }];
  var wrap = document.createElement("div");
  wrap.className = "priority-matchups";
  games.forEach(function (item) {
    wrap.appendChild(renderGameCard(item.game, item.label, item));
  });
  return wrap;
}

function renderLeagueNews(data) {
  var section = document.createElement("section");
  section.className = "scoreboard-section league-news-section";
  section.innerHTML = "<h3>League News</h3>";
  var items = (data.leagueNews || []).slice(0, 3);
  if (!items.length) {
    section.innerHTML += "<p class='empty-state'>League headlines are not loaded yet.</p>";
    return section;
  }
  var list = document.createElement("div");
  list.className = "league-news-list";
  items.forEach(function (item) {
    var link = document.createElement("a");
    link.className = "league-news-item";
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.addEventListener("click", function (event) {
      event.preventDefault();
      openReader(newsReaderItem({
        title: item.title,
        summary: item.summary || "",
        source: item.source || data.label || "League News",
        url: item.url,
        image: item.image || ""
      }));
    });
    var media = document.createElement("span");
    media.className = "league-news-thumb";
    setNewsThumb(media, item);
    var copy = document.createElement("span");
    copy.className = "league-news-copy";
    var title = document.createElement("strong");
    title.textContent = item.title;
    var source = document.createElement("span");
    source.textContent = item.source;
    copy.append(title, source);
    link.append(media, copy);
    list.appendChild(link);
  });
  section.appendChild(list);
  return section;
}

function renderLeagueScoreboard(data) {
  els.scoreboard.appendChild(renderPriorityGames(data));
  var board = document.createElement("div");
  board.className = "scoreboard-columns";
  var scores = document.createElement("section");
  scores.className = "scoreboard-section";
  var selectedDay = gamesDaySelection[currentSport] || "today";
  var dayLabels = {
    yesterday: shortMonthDay(addDays(new Date(), -1)),
    today: shortMonthDay(new Date()),
    tomorrow: shortMonthDay(addDays(new Date(), 1))
  };
  var scoreGames = data.gamesByDay && data.gamesByDay[selectedDay] ? data.gamesByDay[selectedDay] : (selectedDay === "today" ? data.games || [] : []);
  scores.innerHTML = "<div class='scoreboard-section-head'><h3>Games and Scores</h3><div class='games-tabs'></div></div>";
  var tabs = scores.querySelector(".games-tabs");
  ["yesterday", "today", "tomorrow"].forEach(function (day) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "games-tab" + (selectedDay === day ? " active" : "");
    button.textContent = dayLabels[day];
    button.addEventListener("click", function () {
      gamesDaySelection[currentSport] = day;
      renderScoreboard();
    });
    tabs.appendChild(button);
  });
  scoreGames.slice(0, 8).forEach(function (game) {
    var item = document.createElement("div");
    item.className = "mini-score";
    item.innerHTML = "<strong>" + escapeHTML(gameScoreLine(game)) + "</strong><span>" + escapeHTML(liveGameMarker(game)) + "</span>";
    scores.appendChild(item);
  });
  if (!scoreGames.length) {
    var empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No games on " + dayLabels[selectedDay] + ".";
    scores.appendChild(empty);
  }

  var standings = document.createElement("section");
  standings.className = "scoreboard-section standings-section";
  standings.innerHTML = "<h3>Standings</h3>";
  var groups = data.standings || [];
  var selected = standingSelection[currentSport] || 0;
  if (selected >= groups.length) selected = 0;
  if (groups.length) {
    var controls = document.createElement("div");
    controls.className = "standing-tabs";
    if (currentSport === "mlb") controls.classList.add("mlb-division-tabs");
    groups.slice(0, 6).forEach(function (group, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "standing-tab" + (index === selected ? " active" : "");
      button.textContent = group.name;
      button.addEventListener("click", function () {
        standingSelection[currentSport] = index;
        renderScoreboard();
      });
      controls.appendChild(button);
    });
    standings.appendChild(controls);
    standings.appendChild(renderStandingsTable(groups[selected].entries || []));
  } else {
    standings.innerHTML += "<p class='empty-state'>Standings data is unavailable from the free feed.</p>";
  }
  board.append(scores, standings);
  els.scoreboard.appendChild(board);
  els.scoreboard.appendChild(renderLeagueNews(data));
}

function escapeHTML(value) {
  return String(value || "").replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char];
  });
}

function escapeAttr(value) {
  return escapeHTML(value);
}

function renderWorldWatch() {
  if (!worldWatchData) {
    els.worldWatchCard.innerHTML = "<p class='empty-state'>Loading prayer country...</p>";
    return;
  }
  var watchName = worldWatchData.name || worldWatchData.country || "Open Doors";
  var watchFlagImage = worldWatchData.flagImage || (/^https?:\/\//i.test(worldWatchData.flag || "") ? worldWatchData.flag : "");
  var watchFlagText = watchFlagImage ? "" : (worldWatchData.flag || "");
  var points = (worldWatchData.prayerPoints || []).length
    ? worldWatchData.prayerPoints.map(function (point) { return "<li>" + escapeHTML(point) + "</li>"; }).join("")
    : "<li>Prayer points are not listed for this country.</li>";
  var flag = watchFlagImage
    ? "<img class='watch-flag-img' src='" + escapeHTML(watchFlagImage) + "' alt='" + escapeHTML(watchName) + " flag'>"
    : "<span class='watch-flag'>" + escapeHTML(watchFlagText) + "</span>";
  var heroOpen = worldWatchData.url
    ? "<a class='watch-hero watch-hero-button' href='" + escapeHTML(worldWatchData.url) + "' data-world-watch-link>"
    : "<div class='watch-hero'>";
  var heroClose = worldWatchData.url ? "</a>" : "</div>";
  els.worldWatchCard.innerHTML =
    heroOpen +
      "<div class='watch-rank-block'><p class='watch-label'>World Watch Ranking</p><strong class='watch-rank'>#" + escapeHTML(worldWatchData.rank) + "</strong></div>" +
      "<div class='watch-country'><div><p class='watch-country-kicker'>Today's prayer focus</p><h3>" + escapeHTML(watchName) + "</h3></div><div class='watch-flag-frame'>" + flag + "</div></div>" +
    heroClose +
    "<dl class='watch-stats'>" +
      "<div><dt>Christian population</dt><dd>" + escapeHTML(worldWatchData.christianPopulation || "Not listed") + "</dd></div>" +
      "<div><dt>Population</dt><dd>" + escapeHTML(worldWatchData.population || "Not listed") + "</dd></div>" +
      "<div><dt>Main religion</dt><dd>" + escapeHTML(worldWatchData.mainReligion || "Not listed") + "</dd></div>" +
      "<div><dt>Government</dt><dd>" + escapeHTML(worldWatchData.government || "Not listed") + "</dd></div>" +
      "<div><dt>Leader</dt><dd>" + escapeHTML(worldWatchData.leader || "Not listed") + "</dd></div>" +
    "</dl>" +
    "<section class='watch-prayer-section'><div class='watch-prayer-heading'><div><p class='watch-country-kicker'>Stand with the church</p><h4>Pray for " + escapeHTML(watchName) + "</h4></div><span aria-hidden='true' class='watch-prayer-mark'>Pray</span></div><ul class='watch-prayers'>" + points + "</ul></section>";
  var watchLink = els.worldWatchCard.querySelector("[data-world-watch-link]");
  if (watchLink) {
    watchLink.addEventListener("click", function (event) {
      event.preventDefault();
      openReader(prayerReaderItem(worldWatchData, "Open Doors"));
    });
  }
}

async function loadWorldWatch() {
  try {
    var response = await dashboardFetch("/api/world-watch");
    if (!response.ok) throw new Error("World Watch request failed.");
    worldWatchData = await response.json();
  } catch (error) {
    worldWatchData = { name: "Open Doors", rank: "-", prayerPoints: ["World Watch List could not be loaded yet."] };
  }
  renderWorldWatch();
}

function missionItemMarkup(item, fallbackTitle) {
  if (!item) return "<p class='empty-state'>Loading " + escapeHTML(fallbackTitle) + "...</p>";
  var missionFlagImage = item.flagImage || (/^https?:\/\//i.test(item.flag || "") ? item.flag : "");
  var flag = missionFlagImage
    ? "<img class='mission-flag-img' src='" + escapeHTML(missionFlagImage) + "' alt='" + escapeHTML(item.country || item.name || fallbackTitle) + " flag'>"
    : "";
  var isJoshua = activeMission === "joshua";
  var title = isJoshua ? (item.peopleGroup || item.name || fallbackTitle) : (item.country || item.name || fallbackTitle);
  var subtitle = isJoshua ? item.country : item.peopleGroup;
  var points = (item.prayerPoints || []).length
    ? "<ul class='mission-prayer-list'>" + item.prayerPoints.slice(0, 4).map(function (point, index) { return "<li><span class='mission-prayer-number'>" + (index + 1) + "</span><span>" + escapeHTML(point) + "</span></li>"; }).join("") + "</ul>"
    : "<p>" + escapeHTML(item.summary || "Prayer details are not listed yet.") + "</p>";
  var focusClass = isJoshua ? "joshua-focus" : "operation-focus";
  var focusLabel = isJoshua ? "Unreached people group" : "Urgent prayer focus";
  var focusPrompt = isJoshua ? "Pray, send, and help the gospel take root." : "Set apart a moment to intercede for this nation.";
  return "<article class='mission-focus-card " + focusClass + "'>" +
    "<div class='mission-head'>" +
      "<div><p class='mission-focus-label'>" + escapeHTML(focusLabel) + "</p><p class='eyebrow'>" + escapeHTML(item.source || fallbackTitle) + "</p><h3>" + escapeHTML(title) + "</h3>" +
      (subtitle ? "<p class='mission-subtitle'>" + escapeHTML(subtitle) + "</p>" : "") + "</div>" +
      flag +
    "</div>" +
    "<p class='mission-prompt'>" + escapeHTML(focusPrompt) + "</p>" +
    points +
    (item.url ? "<a class='text-button mission-link' href='" + escapeHTML(item.url) + "' target='_blank' rel='noopener'>Open full prayer page</a>" : "") +
  "</article>";
}

function renderMissions() {
  if (!els.missionsCard) return;
  var item = missionsData && missionsData[activeMission];
  var missionTitle = activeMission === "operation" ? "Operation World" : "Joshua Project";
  els.missionsCard.innerHTML = missionItemMarkup(item, missionTitle);
  var missionLink = els.missionsCard.querySelector(".mission-link");
  if (missionLink && item) {
    missionLink.addEventListener("click", function (event) {
      event.preventDefault();
      openReader(prayerReaderItem(item, missionTitle));
    });
  }
  if (els.missionsTabs) {
    els.missionsTabs.querySelectorAll(".missions-tab").forEach(function (button) {
      button.classList.toggle("active", button.dataset.mission === activeMission);
    });
  }
}

async function loadMissions() {
  try {
    var response = await dashboardFetch("/api/missions");
    if (!response.ok) throw new Error("Missions request failed.");
    missionsData = await response.json();
  } catch (error) {
    missionsData = {
      operation: { source: "Operation World", country: "Prayer Calendar", summary: "Operation World prayer focus could not be loaded yet.", url: "https://operationworld.org/prayer-resources/today/" },
      joshua: { source: "Joshua Project", name: "Unreached of the Day", summary: "Joshua Project prayer focus could not be loaded yet.", url: "https://joshuaproject.net/pray/unreachedoftheday" }
    };
  }
  renderMissions();
}

function languageVocabularyCard(item, type) {
  if (!item) return "";
  var textClass = type === "hebrew" ? "hebrew-text" : "greek-text";
  var original = item.original || item.word || "";
  var transliteration = item.transliteration || item.word || "";
  var parsing = item.parsing || item.form || "";
  return "<article class='language-vocab-card " + type + "'>" +
    "<p class='eyebrow'>" + (type === "hebrew" ? "Hebrew" : "Greek") + "</p>" +
    "<h3 class='" + textClass + "'>" + escapeHTML(original) + "</h3>" +
    "<p class='language-translit'>" + escapeHTML(transliteration) + "</p>" +
    "<dl>" +
      "<div><dt>Gloss</dt><dd>" + escapeHTML(item.gloss) + "</dd></div>" +
      "<div><dt>Form</dt><dd>" + escapeHTML(parsing) + "</dd></div>" +
      "<div><dt>Example</dt><dd>" + escapeHTML(item.example) + "</dd></div>" +
      (item.source ? "<div><dt>Source</dt><dd>" + escapeHTML(item.source) + "</dd></div>" : "") +
    "</dl>" +
  "</article>";
}

function languageVideoButton(item, index) {
  var uploaded = formatShortDate(item.publishedAt || item.publishedTime);
  return "<button class='language-video-list-button' type='button' data-video-view='" + escapeHTML(activeLanguageView) + "' data-video-index='" + index + "'>" +
    "<span>" + escapeHTML(item.title) + "</span>" +
    (uploaded ? "<small>" + escapeHTML(uploaded) + "</small>" : "") +
  "</button>";
}

function renderVocabularyView() {
  var vocabulary = languageData && languageData.vocabulary ? languageData.vocabulary : {};
  els.languageContent.innerHTML =
    "<div class='language-vocab-grid'>" +
      languageVocabularyCard(vocabulary.greek, "greek") +
      languageVocabularyCard(vocabulary.hebrew, "hebrew") +
    "</div>";
}

function renderDoseView(view) {
  var feed = languageData && languageData.videos ? languageData.videos[view] : null;
  var items = feed && Array.isArray(feed.items) ? feed.items : [];
  if (!items.length) {
    els.languageContent.innerHTML =
      "<p class='empty-state'>Latest " + escapeHTML(feed && feed.source ? feed.source : "Daily Dose") + " videos are not loaded yet.</p>";
    return;
  }
  var latest = items[0];
  var list = items.slice(1, 7).map(function (item, index) {
    return languageVideoButton(item, index + 1);
  }).join("");
  var latestImage = latest.image || latest.thumbnail || (latest.videoId ? "https://i.ytimg.com/vi/" + encodeURIComponent(latest.videoId) + "/hqdefault.jpg" : "");
  els.languageContent.innerHTML =
    "<button class='language-feature-video' type='button' data-video-view='" + escapeHTML(view) + "' data-video-index='0'>" +
      (latestImage ? "<img src='" + escapeHTML(latestImage) + "' alt=''>" : "<span class='language-video-placeholder'></span>") +
      "<span class='language-play-pill'>Play latest</span>" +
      "<strong>" + escapeHTML(latest.title) + "</strong>" +
    "</button>" +
    "<div class='language-video-list'>" +
      "<h3>Recent Uploads</h3>" +
      (list || "<p class='empty-state'>No more recent uploads are listed yet.</p>") +
    "</div>";
}

function renderLanguagePanel() {
  if (!els.languageContent) return;
  if (!languageData) {
    els.languageContent.innerHTML = "<p class='empty-state'>Loading language tools...</p>";
    return;
  }
  if (els.languageTabs) {
    els.languageTabs.querySelectorAll(".language-tab").forEach(function (button) {
      button.classList.toggle("active", button.dataset.languageView === activeLanguageView);
    });
  }
  if (activeLanguageView === "vocabulary") renderVocabularyView();
  else renderDoseView(activeLanguageView);
}

async function loadLanguagePanel() {
  try {
    var response = await dashboardFetch("/api/languages");
    if (!response.ok) throw new Error("Language tools request failed.");
    languageData = await response.json();
  } catch (error) {
    languageData = {
      vocabulary: {
        greek: { word: "logos", original: "λόγος", transliteration: "logos", gloss: "word, message, reason", parsing: "Noun, masculine", example: "John 1:1", source: "MorphGNT / SBLGNT curated cache" },
        hebrew: { word: "berit", original: "בְּרִית", transliteration: "berit", gloss: "covenant", parsing: "Noun, feminine", example: "Genesis 17:7", source: "Open Scriptures Hebrew Bible curated cache" }
      },
      videos: {}
    };
  }
  renderLanguagePanel();
}

function openLanguageVideo(view, index) {
  var feed = languageData && languageData.videos ? languageData.videos[view] : null;
  var item = feed && feed.items ? feed.items[Number(index)] : null;
  if (!item) return;
  if (!item.embedUrl) {
    window.open(item.url, "_blank", "noopener");
    return;
  }
  els.languageVideoSource.textContent = feed.source || "Daily Dose";
  els.languageVideoTitle.textContent = item.title || "Video";
  els.languageVideoFrame.src = item.embedUrl;
  els.languageVideoModal.showModal();
}

function closeModuleMenu() {
  if (!els.moduleMenu || !els.moduleMenuButton) return;
  els.moduleMenu.setAttribute("hidden", "");
  els.moduleMenuButton.setAttribute("aria-expanded", "false");
}

function openModuleMenu() {
  if (!els.moduleMenu || !els.moduleMenuButton) return;
  els.moduleMenu.removeAttribute("hidden");
  els.moduleMenuButton.setAttribute("aria-expanded", "true");
}

function renderStandingsTable(entries) {
  var table = document.createElement("div");
  table.className = "standings-table";
  table.innerHTML = "<div class='standings-head'><span></span><span>Team</span><span>W</span><span>L</span><span>GB</span></div>";
  entries.slice(0, 12).forEach(function (entry) {
    var row = document.createElement("div");
    row.className = "standings-row";
    row.innerHTML = "<span class='standing-logo'>" + teamLogo(entry) + "</span><strong>" + entry.name + "</strong><span>" + statValue(entry.wins) + "</span><span>" + statValue(entry.losses) + "</span><span>" + statValue(entry.gb) + "</span>";
    table.appendChild(row);
  });
  return table;
}

async function loadSport(sport, options) {
  var settings = options || {};
  if (!settings.quiet) {
    sportsData[sport] = null;
    renderScoreboard();
  }
  try {
    var response = await dashboardFetch("/api/sports/" + sport + "?ts=" + Date.now(), { cache: "no-store" });
    sportsData[sport] = await readDashboardJson(response, sport.toUpperCase() + " scoreboard");
    if (sportsData[sport] && sportsData[sport].errors && sportsData[sport].errors.length) {
      sportsData[sport].errors = sportsData[sport].errors.map(function (message) {
        return hostedHint("sports/" + sport, new Error(message));
      });
    }
  } catch (error) {
    var message = hostedHint("sports/" + sport, error);
    sportsData[sport] = { sport: sport, games: [], standings: [], errors: [message] };
    showToast("Scoreboard feed needs attention. See the sports panel.");
  }
  renderScoreboard();
}

function refreshLiveSportIfNeeded() {
  var data = sportsData[currentSport];
  var priorityGames = data && data.priorityGames ? data.priorityGames : [];
  var active = priorityGames.some(function (item) { return isLiveGame(item.game); });
  if (active) loadSport(currentSport, { quiet: true });
}

function renderAll() {
  if (els.hideBirthdaysFromCalendar) els.hideBirthdaysFromCalendar.checked = !!state.settings.hideBirthdaysFromCalendar;
  renderGreeting();
  renderVerseOfDay();
  renderCalendar();
  renderPriorityList();
  renderTasks();
  renderTemplates();
  renderActiveTemplate();
  renderScoreboard();
  renderRssFeeds();
  renderRssCards();
  renderEventTypeList();
  updatePlanButtons();
  if (els.dayDrawer.classList.contains("open")) renderDayDrawer();
  updateScrollDots();
}

function trashIcon() {
  return "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.8 11H7.8L7 9Zm3 2 .3 7h1.5l-.2-7H10Zm3.4 0-.2 7h1.5l.3-7h-1.6Z'/></svg>";
}

function dragHandleIcon() {
  return "<svg viewBox='0 0 24 24' aria-hidden='true'><circle cx='8' cy='6' r='1.5'/><circle cx='16' cy='6' r='1.5'/><circle cx='8' cy='12' r='1.5'/><circle cx='16' cy='12' r='1.5'/><circle cx='8' cy='18' r='1.5'/><circle cx='16' cy='18' r='1.5'/></svg>";
}

function isTypingTarget(target) {
  if (!target) return false;
  var dialog = target.closest ? target.closest("dialog") : null;
  if (dialog && !dialog.open) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable;
}

function submitFormOnEnter(form, submitSelector) {
  form.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target && event.target.tagName === "TEXTAREA") return;
    var submit = submitSelector ? form.querySelector(submitSelector) : form.querySelector("button[type='submit']");
    if (!submit) return;
    event.preventDefault();
    if (form.requestSubmit) form.requestSubmit(submit);
    else submit.click();
  });
}

els.settingsButton.addEventListener("click", openSettings);
if (els.accountButton) els.accountButton.addEventListener("click", toggleCloudSignIn);
if (els.cloudStatusRefresh) els.cloudStatusRefresh.addEventListener("click", runCloudStatusChecks);
if (els.cloudSyncNow) els.cloudSyncNow.addEventListener("click", function () { syncCloudNow(true); });
els.closeSettingsButton.addEventListener("click", function () { els.settingsModal.close(); });
els.obsidianButton.addEventListener("click", openVaultPlaceholder);
els.settingsModal.addEventListener("click", function (event) {
  if (event.target === els.settingsModal) els.settingsModal.close();
});
els.taskModal.addEventListener("click", function (event) {
  if (event.target === els.taskModal) {
    editingTaskId = null;
    els.taskModal.close();
  }
});
els.eventModal.addEventListener("click", function (event) {
  if (event.target === els.eventModal) closeEventModal();
});
els.scheduleModal.addEventListener("click", function (event) {
  if (event.target === els.scheduleModal) {
    editingScheduleId = null;
    editingScheduleFromDate = "";
    els.scheduleModal.close();
  }
});
els.eventDetailModal.addEventListener("click", function (event) {
  if (event.target === els.eventDetailModal) {
    closeDeleteScopeMenu();
    els.eventDetailModal.close();
  }
});
els.eventDetailClose.addEventListener("click", function () {
  closeDeleteScopeMenu();
  els.eventDetailModal.close();
});
els.eventDetailEdit.addEventListener("click", function (event) {
  var eventId = viewingEventId;
  var item = eventId ? findEventForView(eventId) : null;
  var targetId = item && item.occurrenceOf ? item.occurrenceOf : eventId;
  if (item && item.scheduleId) {
    openScheduledEditMenu(targetId, event.currentTarget);
    return;
  }
  els.eventDetailModal.close();
  if (targetId) openEventModal({ mode: "edit", eventId: targetId });
});
els.eventDetailDelete.addEventListener("click", function (event) {
  var eventId = viewingEventId;
  if (!eventId) return;
  var item = findEventForView(eventId);
  var targetId = item && item.occurrenceOf ? item.occurrenceOf : eventId;
  if (item && item.scheduleId) {
    confirmDeleteEvent(targetId, event.currentTarget, function () { els.eventDetailModal.close(); });
    return;
  }
  els.eventDetailModal.close();
  confirmDeleteEvent(targetId, event.currentTarget);
});
els.eventImageButton.addEventListener("click", function () {
  if (!viewingEventId) return;
  els.eventImageInput.click();
});
els.eventImageInput.addEventListener("change", function () {
  var file = els.eventImageInput.files && els.eventImageInput.files[0];
  if (!file || !viewingEventId) return;
  if (!file.type || file.type.indexOf("image/") !== 0) {
    showToast("Choose an image file.");
    return;
  }
  var reader = new FileReader();
  reader.onload = function () {
    var visibleItem = findEventForView(viewingEventId);
    var targetId = visibleItem && visibleItem.occurrenceOf ? visibleItem.occurrenceOf : viewingEventId;
    var item = state.events.find(function (eventItem) { return eventItem.id === targetId; });
    if (!item) return;
    item.image = reader.result;
    saveState();
    viewEvent(item.id);
  };
  reader.readAsDataURL(file);
  els.eventImageInput.value = "";
});
els.settingsForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  if (event.submitter && event.submitter.value === "cancel") {
    els.settingsModal.close();
    return;
  }
  state.settings.preferredName = els.preferredName.value.trim();
  state.settings.timeFormat = els.timeFormat.value || "24";
  state.settings.timeZone = els.timeZone ? (els.timeZone.value || "Asia/Manila") : "Asia/Manila";
  populateTimeSelects();
  saveState();
  renderAll();
  loadGoogleCalendarEvents(false);
  var privateSettingsPayload = {
    apiSportsKey: els.apiSportsKey ? els.apiSportsKey.value.trim() : ""
  };
  if (!isHostedDashboard && privateSettingsPayload.apiSportsKey) {
    try {
      var response = await dashboardFetch("/api/private-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(privateSettingsPayload)
      });
      if (!response.ok) throw new Error("Key save failed");
      sportsData.nba = null;
      sportsData.nfl = null;
      if (currentSport === "nba" || currentSport === "nfl") loadSport(currentSport);
    } catch (error) {
      showToast("Private settings could not be saved.");
    }
  }
  els.settingsModal.close();
  showToast("Settings saved.");
});

document.addEventListener("keydown", function (event) {
  if (deleteFocusedEventCard(event)) return;
  if ((event.ctrlKey || event.metaKey) && event.key === ",") {
    event.preventDefault();
    openSettings();
  }
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && !isTypingTarget(event.target) && !els.eventModal.open && !els.scheduleModal.open && !els.settingsModal.open) {
    if (event.key.toLowerCase() === "c") {
      event.preventDefault();
      openContextCreateModal();
    } else if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      goToCurrentCalendarPeriod();
    } else if (event.code === "BracketLeft" || event.key === "[" || event.key === "{") {
      event.preventDefault();
      goToPreviousCalendarPeriod();
    } else if (event.code === "BracketRight" || event.key === "]" || event.key === "}") {
      event.preventDefault();
      goToNextCalendarPeriod();
    }
  }
  if (event.altKey && !event.ctrlKey && !event.metaKey && !isTypingTarget(event.target) && !els.eventModal.open && !els.scheduleModal.open && !els.settingsModal.open) {
    if (event.key === "1") {
      event.preventDefault();
      setMode("normal");
    } else if (event.key === "2") {
      event.preventDefault();
      setMode("schedule");
    } else if (event.key === "3") {
      event.preventDefault();
      setMode("planning");
    } else if (event.key === "4") {
      event.preventDefault();
      setMode("class-schedule");
    } else if (event.key === "5") {
      event.preventDefault();
      setMode("birthdays");
    }
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && planningMode && !els.eventModal.open && !els.scheduleModal.open) {
    event.preventDefault();
    undoPlan();
  }
  if (event.key === "Escape") {
    if (activeDeleteMenu) closeDeleteScopeMenu();
    else if (els.eventModal.open) closeEventModal();
    else if (els.scheduleModal.open) {
      editingScheduleId = null;
      editingScheduleFromDate = "";
      els.scheduleModal.close();
    }
    else if (els.eventDetailModal.open) {
      closeDeleteScopeMenu();
      els.eventDetailModal.close();
    }
    else closeDayDrawer();
  }
});

document.addEventListener("pointerdown", function (event) {
  if (els.moduleMenu && !els.moduleMenu.hasAttribute("hidden") && !event.target.closest(".mobile-module-menu")) closeModuleMenu();
  if (activeDeleteMenu && !activeDeleteMenu.contains(event.target)) closeDeleteScopeMenu();
  if (els.eventModal.open || els.scheduleModal.open || els.settingsModal.open || els.eventDetailModal.open || els.taskModal.open) return;
  if (!els.dayDrawer.classList.contains("open")) return;
  if (els.dayDrawer.contains(event.target)) return;
  if (event.target.closest(".day-cell")) return;
  closeDayDrawer();
});

els.prevMonth.addEventListener("click", function () {
  goToPreviousCalendarPeriod();
  loadGoogleCalendarEvents(false);
});
els.nextMonth.addEventListener("click", function () {
  goToNextCalendarPeriod();
  loadGoogleCalendarEvents(false);
});
els.monthLabel.addEventListener("click", function () {
  goToCurrentCalendarPeriod();
  loadGoogleCalendarEvents(false);
});
els.googleCalendarButton.addEventListener("click", async function () {
  if (isHostedDashboard && !cloudSession) {
    showToast("Sign in first, then connect Google Calendar.");
    await toggleCloudSignIn();
    return;
  }
  await loadGoogleCalendarStatus();
  if (!googleCalendarStatus.configured) {
    showToast(isHostedDashboard ? "Google Calendar is not configured in Supabase yet." : "Google Calendar is not configured on this device yet.");
    return;
  }
  if (googleCalendarStatus.connected && !googleCalendarStatus.needsReconnect) {
    loadGoogleCalendarEvents(true);
    return;
  }
  try {
    await startGoogleCalendarConnect();
  } catch (error) {
    googleCalendarLastMessage = hostedHint("google-calendar/connect", error);
    setCloudStatus("google", "warn", googleCalendarLastMessage);
    showToast("Google Calendar needs attention. Check Settings.");
  }
});
if (els.googleCalendarReconnectButton) {
  els.googleCalendarReconnectButton.addEventListener("click", reconnectGoogleCalendar);
}
if (els.googleCalendarSyncButton) {
  els.googleCalendarSyncButton.addEventListener("click", function () {
    loadGoogleCalendarEvents(true);
  });
}
if (els.googleCalendarRefreshCalendars) {
  els.googleCalendarRefreshCalendars.addEventListener("click", function () {
    loadGoogleCalendarChoices(true);
  });
}
if (els.googleCalendarShowAllButton) {
  els.googleCalendarShowAllButton.addEventListener("click", function () {
    state.settings.googleCalendarUseAll = true;
    state.settings.googleCalendarIds = [];
    saveState();
    renderGoogleCalendarChoices();
    loadGoogleCalendarEvents(false);
  });
}
els.normalModeButton.addEventListener("click", function () { setMode("normal"); });
els.scheduleModeButton.addEventListener("click", function () { setMode("schedule"); });
els.planningModeButton.addEventListener("click", function () { setMode("planning"); });
if (els.classScheduleModeButton) els.classScheduleModeButton.addEventListener("click", function () { setMode("class-schedule"); });
if (els.birthdayModeButton) els.birthdayModeButton.addEventListener("click", function () { setMode("birthdays"); });
if (els.hideBirthdaysFromCalendar) {
  els.hideBirthdaysFromCalendar.addEventListener("change", function () {
    state.settings.hideBirthdaysFromCalendar = els.hideBirthdaysFromCalendar.checked;
    saveState();
    renderAll();
  });
}
els.addScheduleButton.addEventListener("click", openScheduleModal);
els.finalizePlansButton.addEventListener("click", finalizePlans);
els.cancelPlansButton.addEventListener("click", cancelPlans);
els.undoPlanButton.addEventListener("click", undoPlan);
els.eventForm.addEventListener("submit", addEventOrPlan);
els.scheduleForm.addEventListener("submit", saveSchedule);
if (els.eventRepeat) {
  [els.eventRepeat, els.eventRepeatCustomNumber, els.eventRepeatCustomUnit, els.eventRepeatEnd, els.eventRepeatEndDate].forEach(function (control) {
    control.addEventListener("change", syncRepeatControls);
  });
}
els.scheduleCategory.addEventListener("change", function () {
  selectedScheduleColorKey = scheduleCategoryDefaultColor(els.scheduleCategory.value);
  renderColorPalette(els.scheduleColorPalette, selectedScheduleColorKey, function (key) { selectedScheduleColorKey = key; });
});
function addCustomEventType() {
  var type = els.eventTypeInput.value.trim();
  if (!type) return;
  if (eventTypes().some(function (item) { return item.toLowerCase() === type.toLowerCase(); })) {
    showToast("That event type already exists.");
    return;
  }
  state.settings.eventTypes.push(type);
  els.eventTypeInput.value = "";
  saveState();
  renderEventTypes(type);
}
els.eventTypeAddButton.addEventListener("click", addCustomEventType);
els.eventTypeInput.addEventListener("keydown", function (event) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  addCustomEventType();
});
submitFormOnEnter(els.eventForm, ".form-button");
submitFormOnEnter(els.scheduleForm, ".accent-button[value='default']");
submitFormOnEnter(els.taskForm, "button[type='submit']");
submitFormOnEnter(els.taskModalForm, "#saveTaskButton");
submitFormOnEnter(els.templateForm, "button[type='submit']");
submitFormOnEnter(els.rssForm, "button[type='submit']");
els.deleteEventButton.addEventListener("click", deleteEditingEvent);
els.addTemplateToEvent.addEventListener("click", addTemplateToModalEvent);
els.eventChecklistAddButton.addEventListener("click", function () {
  var title = els.eventChecklistInput.value.trim();
  if (!title) return;
  modalChecklist.push({ id: id("check"), title: title, dueDate: els.eventChecklistDue.value, done: false, promoted: false, taskId: null });
  els.eventChecklistInput.value = "";
  els.eventChecklistDue.value = "";
  renderModalChecklist();
});
els.eventDate.addEventListener("change", handleEventStartDateChange);
els.eventEndDate.addEventListener("change", handleEventEndDateChange);
els.eventTimeStart.addEventListener("change", handleEventStartTimeChange);
els.eventTimeEnd.addEventListener("change", handleEventEndTimeChange);
els.eventTimeStart.addEventListener("blur", handleEventStartTimeChange);
els.eventTimeEnd.addEventListener("blur", handleEventEndTimeChange);
els.eventAllDay.addEventListener("change", syncEventTimeControls);
els.eventTimeSlot.addEventListener("change", handleEventTimeSlotChange);
els.eventType.addEventListener("change", syncEventPassageField);
els.scheduleStartDate.addEventListener("change", handleScheduleStartDateChange);
els.scheduleEndDate.addEventListener("change", handleScheduleEndDateChange);
els.scheduleStartTime.addEventListener("change", handleScheduleStartTimeChange);
els.scheduleEndTime.addEventListener("change", handleScheduleEndTimeChange);
els.scheduleStartTime.addEventListener("blur", handleScheduleStartTimeChange);
els.scheduleEndTime.addEventListener("blur", handleScheduleEndTimeChange);
els.drawerAddEvent.addEventListener("click", function () { openEventModal({ mode: "create", start: selectedDate, end: selectedDate, timeStart: "08:00", timeEnd: "09:00" }); });
els.closeDayDrawer.addEventListener("click", closeDayDrawer);
els.verseToggle.addEventListener("click", function () {
  var expanded = els.verseToggle.getAttribute("aria-expanded") === "true";
  els.verseToggle.setAttribute("aria-expanded", String(!expanded));
  els.verseToggle.textContent = expanded ? "Expand" : "Hide";
  els.verseDetails.hidden = expanded;
});
els.bibleReaderVerseButton.addEventListener("click", function () {
  if (!activeVerse) renderVerseOfDay();
  showToast("Bible Reader placeholder: " + (activeVerse ? activeVerse.reference : "today's verse") + " will open here once the Bible Reader app is connected.");
});
els.taskForm.addEventListener("submit", function (event) {
  event.preventDefault();
  addTask(els.taskInput.value, els.taskDueDate.value, "dashboard", null, "", els.taskDueTime.value, els.taskAlarm.value);
  els.taskInput.value = "";
  els.taskDueDate.value = "";
  els.taskDueTime.value = "";
  els.taskAlarm.value = "none";
});
els.taskGroupForm.addEventListener("submit", function (event) {
  event.preventDefault();
  createTaskGroup(els.taskGroupInput.value);
});
els.activeTasksButton.addEventListener("click", function () {
  taskView = "active";
  renderTasks();
});
els.finishedTasksButton.addEventListener("click", function () {
  taskView = "finished";
  renderTasks();
});
els.tasksWorkspaceButton.addEventListener("click", function () { setWorkspaceView("tasks"); });
els.workflowsWorkspaceButton.addEventListener("click", function () { setWorkspaceView("workflows"); });
els.editTaskButton.addEventListener("click", function () {
  if (editingTaskId) openTaskModal(editingTaskId, { edit: true, source: taskModalOpenSource });
});
els.deleteTaskPermanentlyButton.addEventListener("click", function () {
  var task = state.tasks.find(function (item) { return item.id === editingTaskId; });
  permanentlyDeleteTask(task);
});
els.taskModalForm.addEventListener("submit", function (event) {
  event.preventDefault();
  if (event.submitter && event.submitter.value === "cancel") {
    editingTaskId = null;
    els.taskModal.close();
    return;
  }
  if (els.taskModal.dataset.mode !== "edit") return;
  var task = state.tasks.find(function (item) { return item.id === editingTaskId; });
  if (!task) return;
  var title = els.taskModalInput.value.trim();
  if (!title) {
    showToast("Task title is required.");
    els.taskModalInput.focus();
    return;
  }
  task.title = title;
  task.dueDate = els.taskModalDueDate.value;
  task.dueTime = els.taskModalDueTime.value;
  task.alarm = els.taskModalAlarm.value || "none";
  task.notes = els.taskModalNotes.value.trim();
  syncChecklistCompletion(task);
  saveState();
  renderAll();
  if (els.eventDetailModal.open && viewingEventId) viewEvent(viewingEventId);
  openTaskModal(task.id, { source: taskModalOpenSource });
  showToast("Task saved.");
});
els.templateForm.addEventListener("submit", createTemplate);
els.priorityScopeToggle.addEventListener("click", function () {
  priorityScope = priorityScope === "month" ? "week" : "month";
  renderPriorityList();
});
document.querySelectorAll(".sport-tab").forEach(function (button) {
  button.addEventListener("click", function () {
    currentSport = button.dataset.sport;
    if (sportsData[currentSport]) renderScoreboard();
    else loadSport(currentSport);
  });
});
document.querySelectorAll(".headline-dot").forEach(function (button) {
  button.addEventListener("click", function () {
    headlineIndex = Number(button.dataset.headlineIndex || 0);
    renderHeadline();
    startHeadlineCarousel();
  });
});
els.headlineStory.addEventListener("click", function (event) {
  event.preventDefault();
  if (activeHeadlineItem) openReader(newsReaderItem(activeHeadlineItem));
});
if (els.missionsTabs) {
  els.missionsTabs.querySelectorAll(".missions-tab").forEach(function (button) {
    button.addEventListener("click", function () {
      activeMission = button.dataset.mission || "operation";
      renderMissions();
    });
  });
}
els.newsSourcesButton.addEventListener("click", openSourceModal);
els.closeSourceButton.addEventListener("click", function () {
  els.sourceModal.close();
});
els.sourceModal.addEventListener("click", function (event) {
  if (event.target === els.sourceModal) els.sourceModal.close();
});
els.sourceGrid.addEventListener("change", function (event) {
  if (event.target.matches("input[data-check-all]")) {
    var checkSection = event.target.dataset.checkAll;
    els.sourceGrid.querySelectorAll("input[data-section='" + checkSection + "']").forEach(function (input) {
      input.checked = event.target.checked;
    });
    var checkParent = event.target.closest(".source-section");
    if (checkParent) updateSourceCount(checkParent);
    return;
  }
  if (!event.target.matches("input[type='checkbox']")) return;
  var section = event.target.dataset.section;
  var parent = event.target.closest(".source-section");
  if (parent) updateSourceCount(parent);
});
els.sourceGrid.addEventListener("click", function (event) {
  var addButton = event.target.closest("[data-add-source]");
  if (addButton) {
    var section = addButton.dataset.addSource;
    var nameInput = els.sourceGrid.querySelector("input[data-custom-name='" + section + "']");
    var urlInput = els.sourceGrid.querySelector("input[data-custom-url='" + section + "']");
    var name = nameInput.value.trim();
    var url = urlInput.value.trim();
    if (!name || !/^https?:\/\//i.test(url)) {
      showToast("Custom news source needs a name and an RSS/Atom URL.");
      return;
    }
    state.settings.customNewsSources = state.settings.customNewsSources || { world: [], philippines: [], theology: [] };
    state.settings.customNewsSources[section] = state.settings.customNewsSources[section] || [];
    if (state.settings.customNewsSources[section].some(function (source) { return source.source === name || source.url === url; })) {
      showToast("That custom source is already listed.");
      return;
    }
    state.settings.customNewsSources[section].push({ source: name, url: url, custom: true });
    saveState();
    renderSourceModal();
    return;
  }
  var removeButton = event.target.closest("[data-remove-source]");
  if (removeButton) {
    event.preventDefault();
    event.stopPropagation();
    var removeSection = removeButton.dataset.removeSource;
    var sourceName = removeButton.dataset.sourceName;
    state.settings.customNewsSources[removeSection] = (state.settings.customNewsSources[removeSection] || []).filter(function (source) {
      return source.source !== sourceName;
    });
    state.settings.newsSources[removeSection] = (state.settings.newsSources[removeSection] || []).filter(function (source) {
      return source !== sourceName;
    });
    saveState();
    renderSourceModal();
  }
});
els.resetSourcesButton.addEventListener("click", function () {
  state.settings.newsSources = { world: [], philippines: [], theology: [] };
  saveState();
  renderSourceModal();
  loadNews();
});
els.sourceForm.addEventListener("submit", function (event) {
  event.preventDefault();
  if (sourceSelectionOverLimit()) {
    showToast("Reduce each category to 10 sources or fewer before saving.");
    return;
  }
  state.settings.newsSources = collectSelectedSources();
  saveState();
  els.sourceModal.close();
  headlineIndex = 0;
  loadNews();
});
els.rssForm.addEventListener("submit", function (event) {
  event.preventDefault();
  var name = els.rssName.value.trim();
  var url = els.rssUrl.value.trim();
  var readMore = els.rssReadMoreUrl.value.trim();
  if (readMore) state.rssReadMoreUrl = readMore;
  if (url) {
    if (!/^https?:\/\//i.test(url)) {
      showToast("RSS feed needs to start with http:// or https://.");
      return;
    }
    if ((state.rssFeeds || []).length >= 10) {
      showToast("RSS panel supports up to 10 feeds.");
      return;
    }
    state.rssFeeds = state.rssFeeds || [];
    state.rssFeeds.push({ name: name || url, url: url });
    els.rssName.value = "";
    els.rssUrl.value = "";
  }
  saveState();
  renderRssFeeds();
  loadRssFeeds();
});
els.closeReaderButton.addEventListener("click", function () { els.readerModal.close(); });
els.readerDoneButton.addEventListener("click", function () { els.readerModal.close(); });
els.readerModal.addEventListener("click", function (event) {
  if (event.target === els.readerModal) els.readerModal.close();
});
els.splitReaderButton.addEventListener("click", openMainSplitReader);
els.closeDockReaderButton.addEventListener("click", closeMainSplitReader);
els.dockReaderBack.addEventListener("click", function () {
  if (readerHistoryIndex <= 0) return;
  readerHistoryIndex -= 1;
  activeReaderItem = readerHistory[readerHistoryIndex];
  renderDockReader(activeReaderItem);
});
els.dockReaderForward.addEventListener("click", function () {
  if (readerHistoryIndex >= readerHistory.length - 1) return;
  readerHistoryIndex += 1;
  activeReaderItem = readerHistory[readerHistoryIndex];
  renderDockReader(activeReaderItem);
});
els.mainSplitDivider.addEventListener("mousedown", function (event) {
  mainSplitDragging = true;
  event.preventDefault();
});
els.mainSplitDivider.addEventListener("keydown", function (event) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  applyMainSplitRatio(Number(state.settings.mainReaderSplit || 62) + (event.key === "ArrowRight" ? 3 : -3));
});
els.closeSplitReaderButton.addEventListener("click", function () {
  els.splitReaderFrame.src = "about:blank";
  els.splitReaderModal.close();
});
els.splitReaderModal.addEventListener("click", function (event) {
  if (event.target === els.splitReaderModal) {
    els.splitReaderFrame.src = "about:blank";
    els.splitReaderModal.close();
  }
});
if (els.scrollDots) {
  els.scrollDots.addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.scrollTarget !== undefined) {
      scrollToSegment(Number(button.dataset.scrollTarget));
      return;
    }
    var step = Number(button.dataset.scrollStep || 0);
    if (step) scrollToSegment(currentScrollSegment() + step);
  });
  window.addEventListener("scroll", updateScrollDots, { passive: true });
  window.addEventListener("resize", updateScrollDots);
}
els.splitReaderFrame.addEventListener("error", function () {
  els.splitReaderFrame.hidden = true;
  els.splitReaderFallback.hidden = false;
});
els.splitReaderDivider.addEventListener("mousedown", function (event) {
  splitDragging = true;
  event.preventDefault();
});
els.splitReaderDivider.addEventListener("keydown", function (event) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  var current = Number(state.settings.readerSplit || 50);
  applySplitRatio(current + (event.key === "ArrowRight" ? 3 : -3));
});
window.addEventListener("mousemove", function (event) {
  if (!splitDragging) return;
  updateSplitFromPointer(event.clientX);
});
window.addEventListener("mousemove", function (event) {
  if (!mainSplitDragging) return;
  updateMainSplitFromPointer(event.clientX);
});
window.addEventListener("mouseup", function () {
  splitDragging = false;
  mainSplitDragging = false;
});
window.addEventListener("scroll", closeModuleMenu, { passive: true });
window.addEventListener("resize", closeModuleMenu);
document.querySelectorAll(".study-launch-button").forEach(function (button) {
  button.addEventListener("click", function () {
    closeModuleMenu();
    showToast(button.dataset.app + " launcher placeholder. Add its local URL or GitHub repo in the next phase.");
  });
});
if (els.moduleMenuButton) {
  els.moduleMenuButton.addEventListener("click", function (event) {
    event.stopPropagation();
    if (els.moduleMenu.hasAttribute("hidden")) openModuleMenu();
    else closeModuleMenu();
  });
}
if (els.moduleMenu) {
  els.moduleMenu.addEventListener("click", function (event) {
    event.stopPropagation();
  });
}
if (els.languageTabs) {
  els.languageTabs.querySelectorAll(".language-tab").forEach(function (button) {
    button.addEventListener("click", function () {
      activeLanguageView = button.dataset.languageView || "vocabulary";
      renderLanguagePanel();
    });
  });
}
if (els.languageContent) {
  els.languageContent.addEventListener("click", function (event) {
    var button = event.target.closest("[data-video-view]");
    if (!button) return;
    openLanguageVideo(button.dataset.videoView, button.dataset.videoIndex);
  });
}
function closeLanguageVideo() {
  els.languageVideoFrame.src = "about:blank";
  els.languageVideoModal.close();
}
els.closeLanguageVideoButton.addEventListener("click", closeLanguageVideo);
els.languageVideoModal.addEventListener("click", function (event) {
  if (event.target === els.languageVideoModal) closeLanguageVideo();
});
window.addEventListener("mouseup", function () {
  if (selectingPlan) {
    selectingPlan = false;
    if (selectionStart && selectionEnd) openPlanningModal();
  }
});

try {
  applyHostedModeUi();
  renderAll();
  initCloudIdentity();
  handleGoogleCalendarReturnMessage();
  refreshGoogleCalendar(false);
  loadNewsSources().then(loadNews);
  loadRssFeeds();
  loadWorldWatch();
  loadMissions();
  loadLanguagePanel();
  loadSport(currentSport);
  startHeadlineCarousel();
  checkDashboardAlarms();
  window.setTimeout(runCloudStatusChecks, 1500);
  setInterval(loadNews, 5 * 60 * 1000);
  setInterval(loadRssFeeds, 30 * 60 * 1000);
  setInterval(function () { refreshGoogleCalendar(false); }, 10 * 60 * 1000);
  setInterval(refreshLiveSportIfNeeded, 60 * 1000);
  setInterval(checkDashboardAlarms, 30 * 1000);
  setInterval(renderGreeting, 1000);
} catch (error) {
  document.body.dataset.appError = error && error.stack ? error.stack : String(error);
  console.error(error);
}

