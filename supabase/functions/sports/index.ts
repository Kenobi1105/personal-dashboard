import { enrichItemMedia, fetchText, json, optionsResponse, parseFeed, uniqueItems } from "../_shared/dashboard.ts";

const SPORT_NEWS: Record<string, Array<{ source: string; url: string; priority: number }>> = {
  mlb: [
    { source: "MLB.com", url: "https://www.mlb.com/feeds/news/rss.xml", priority: 1 },
    { source: "CBS Sports MLB", url: "https://www.cbssports.com/rss/headlines/mlb/", priority: 2 },
  ],
  nba: [
    { source: "ESPN NBA", url: "https://www.espn.com/espn/rss/nba/news", priority: 1 },
    { source: "CBS Sports NBA", url: "https://www.cbssports.com/rss/headlines/nba/", priority: 2 },
  ],
  nfl: [
    { source: "NFL.com", url: "https://www.nfl.com/feeds/rss/news", priority: 1 },
    { source: "ESPN NFL", url: "https://www.espn.com/espn/rss/nfl/news", priority: 2 },
  ],
};

function addDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function fetchJson(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("HTTP " + response.status);
  return await response.json();
}

function mlbTeam(team: any, homeAway: string) {
  return {
    name: team?.team?.name || "",
    abbreviation: team?.team?.abbreviation || "",
    logo: team?.team?.id ? "https://www.mlbstatic.com/team-logos/" + team.team.id + ".svg" : "",
    score: team?.score === undefined ? "-" : String(team.score),
    homeAway,
  };
}

function inningLabel(game: any) {
  const linescore = game.linescore || {};
  const inning = linescore.currentInningOrdinal || "";
  const state = String(linescore.inningState || "").toLowerCase();
  if (!inning) return "";
  if (state.startsWith("top")) return "Top " + inning;
  if (state.startsWith("middle")) return "Mid " + inning;
  if (state.startsWith("bottom")) return "Bot " + inning;
  return inning;
}

function normalizeMlbGame(game: any) {
  const away = mlbTeam(game.teams?.away, "away");
  const home = mlbTeam(game.teams?.home, "home");
  return {
    id: game.gamePk,
    name: away.name && home.name ? away.name + " at " + home.name : "",
    shortName: away.abbreviation && home.abbreviation ? away.abbreviation + " - " + home.abbreviation : "",
    date: game.gameDate,
    status: game.status?.detailedState || game.status?.abstractGameState || "Scheduled",
    statusDetail: inningLabel(game),
    clock: "",
    url: "https://www.mlb.com/gameday/" + game.gamePk,
    competitors: [away, home],
  };
}

async function mlbSchedule(date: Date) {
  const url = "https://statsapi.mlb.com/api/v1/schedule?sportId=1&hydrate=team,linescore&date=" + ymd(date);
  const data = await fetchJson(url);
  return (data.dates || []).flatMap((day: any) => day.games || []).map(normalizeMlbGame);
}

function divisionName(record: any) {
  const id = Number(record.division?.id || 0);
  return ({ 200: "AL West", 201: "AL East", 202: "AL Central", 203: "NL West", 204: "NL East", 205: "NL Central" } as Record<number, string>)[id] || "Standings";
}

async function mlbStandings() {
  const season = new Date().getFullYear();
  const data = await fetchJson("https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=" + season + "&standingsTypes=regularSeason");
  const groups: Record<string, any[]> = {};
  (data.records || []).forEach((record: any) => {
    const name = divisionName(record);
    groups[name] = (record.teamRecords || []).map((entry: any) => ({
      name: entry.team?.name || "",
      abbreviation: entry.team?.abbreviation || "",
      logo: entry.team?.id ? "https://www.mlbstatic.com/team-logos/" + entry.team.id + ".svg" : "",
      wins: entry.wins,
      losses: entry.losses,
      gb: entry.gamesBack || "-",
    }));
  });
  return ["AL East", "AL Central", "AL West", "NL East", "NL Central", "NL West"].filter((name) => groups[name]).map((name) => ({ name, entries: groups[name] }));
}

function findTeamGame(games: any[], teamName: string) {
  const lower = teamName.toLowerCase();
  return games.find((game) => (game.competitors || []).some((team: any) => (team.name || "").toLowerCase().includes(lower))) || null;
}

function finished(game: any) {
  return /final|completed|game over/i.test(game?.status || "");
}

async function leagueNews(sport: string) {
  const feeds = SPORT_NEWS[sport] || [];
  const settled = await Promise.allSettled(feeds.map(async (feed) => parseFeed(await fetchText(feed.url), feed)));
  let items: any[] = [];
  settled.forEach((entry) => {
    if (entry.status === "fulfilled") items = items.concat(entry.value);
  });
  const selected = uniqueItems(items).slice(0, 6);
  return await Promise.all(selected.map(enrichItemMedia));
}

async function getMlb() {
  const [yesterday, today, tomorrow] = await Promise.all([mlbSchedule(addDays(new Date(), -1)), mlbSchedule(new Date()), mlbSchedule(addDays(new Date(), 1))]);
  const all = yesterday.concat(today, tomorrow);
  const favoriteTeams = [
    { label: "New York Yankees", name: "Yankees" },
    { label: "Los Angeles Dodgers", name: "Dodgers" },
  ];
  const priorityGames = favoriteTeams.map((favorite) => {
    const game = findTeamGame(all, favorite.name);
    return {
      label: favorite.label,
      team: favorite.name,
      game,
      latestGame: all.filter((item) => findTeamGame([item], favorite.name) && finished(item)).at(-1) || null,
      nextGame: all.find((item) => findTeamGame([item], favorite.name) && !finished(item)) || null,
      nextLabel: "",
      displayKind: game && finished(game) ? "result" : game ? "current" : "none",
    };
  }).filter((item, index, list) => item.game && list.findIndex((other) => other.game?.id === item.game?.id) === index);
  return {
    sport: "mlb",
    label: "MLB",
    priorityTeam: "Yankees",
    priorityTeamLabel: "New York Yankees",
    priorityGames,
    priorityGame: priorityGames[0]?.game || null,
    games: today,
    gamesByDay: { yesterday, today, tomorrow },
    standings: await mlbStandings().catch(() => []),
    leagueNews: await leagueNews("mlb"),
    errors: [],
  };
}

async function espnSport(sport: string) {
  const path = sport === "nba" ? "basketball/nba" : "football/nfl";
  const label = sport === "nba" ? "NBA" : "NFL";
  const team = sport === "nba" ? "Los Angeles Lakers" : "New England Patriots";
  const data = await fetchJson("https://site.api.espn.com/apis/site/v2/sports/" + path + "/scoreboard");
  const games = (data.events || []).map((event: any) => ({
    id: event.id,
    name: event.name || event.shortName || "",
    shortName: event.shortName || event.name || "",
    date: event.date,
    status: event.status?.type?.shortDetail || event.status?.type?.description || "",
    statusDetail: event.status?.period ? (sport === "nba" ? event.status.period + "Q" : event.status?.type?.shortDetail || "") : "",
    clock: event.status?.displayClock || "",
    url: event.links?.[0]?.href || "",
    competitors: (event.competitions?.[0]?.competitors || []).map((item: any) => ({
      name: item.team?.displayName || item.team?.shortDisplayName || "",
      abbreviation: item.team?.abbreviation || "",
      logo: item.team?.logo || item.team?.logos?.[0]?.href || "",
      score: item.score || "0",
      homeAway: item.homeAway || "",
    })),
  }));
  return {
    sport,
    label,
    priorityTeam: team,
    priorityTeamLabel: team,
    priorityGames: [{ label: team, team, game: findTeamGame(games, team), displayKind: "current" }],
    priorityGame: findTeamGame(games, team),
    games,
    gamesByDay: { yesterday: [], today: games, tomorrow: [] },
    standings: [],
    leagueNews: await leagueNews(sport),
    errors: [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  const sport = new URL(req.url).pathname.split("/").filter(Boolean).pop() || "mlb";
  try {
    if (sport === "mlb") return json(await getMlb());
    if (sport === "nba" || sport === "nfl") return json(await espnSport(sport));
    return json({ sport, games: [], standings: [], errors: ["Unsupported sport"] }, 404);
  } catch (error) {
    return json({ sport, games: [], standings: [], errors: [error instanceof Error ? error.message : String(error)] }, 200);
  }
});
