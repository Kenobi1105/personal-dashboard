import { json, optionsResponse } from "../_shared/dashboard.ts";

const COUNTRIES = [
  { rank: 1, country: "North Korea", flag: "https://flagcdn.com/w160/kp.png", christianPopulation: "400,000", population: "26,100,000", mainReligion: "Juche / Atheism", government: "Dictatorship", leader: "Kim Jong Un", prayerPoints: ["Pray for secret believers to be protected.", "Pray for Scripture to reach isolated Christians.", "Pray for courage and endurance."] },
  { rank: 2, country: "Somalia", flag: "https://flagcdn.com/w160/so.png", christianPopulation: "Hundreds", population: "18,100,000", mainReligion: "Islam", government: "Federal parliamentary republic", leader: "Hassan Sheikh Mohamud", prayerPoints: ["Pray for hidden believers.", "Pray for protection from extremist violence.", "Pray for peace and stability."] },
  { rank: 9, country: "Iran", flag: "https://flagcdn.com/w160/ir.png", christianPopulation: "800,000", population: "90,411,000", mainReligion: "Shia Islam", government: "Theocratic Republic", leader: "Supreme Leader Ayatollah Ali Khamenei", prayerPoints: ["Pray for imprisoned church leaders.", "Pray for house churches.", "Pray for believers under surveillance."] },
];

Deno.serve((req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  const index = Math.floor(Date.now() / 86400000) % COUNTRIES.length;
  return json(COUNTRIES[index]);
});

