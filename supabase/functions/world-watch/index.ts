import { json, optionsResponse } from "../_shared/dashboard.ts";

const COUNTRIES = [
  { rank: 1, name: "North Korea", country: "North Korea", flagImage: "https://flagcdn.com/w320/kp.png", flag: "🇰🇵", christianPopulation: "400,000", population: "26,100,000", mainReligion: "Juche / Atheism", government: "Dictatorship", leader: "Kim Jong Un", prayerPoints: ["Pray for secret believers to be protected.", "Pray for Scripture to reach isolated Christians.", "Pray for courage and endurance."] },
  { rank: 2, name: "Somalia", country: "Somalia", flagImage: "https://flagcdn.com/w320/so.png", flag: "🇸🇴", christianPopulation: "Hundreds", population: "18,100,000", mainReligion: "Islam", government: "Federal parliamentary republic", leader: "Hassan Sheikh Mohamud", prayerPoints: ["Pray for hidden believers.", "Pray for protection from extremist violence.", "Pray for peace and stability."] },
  { rank: 9, name: "Iran", country: "Iran", flagImage: "https://flagcdn.com/w320/ir.png", flag: "🇮🇷", christianPopulation: "800,000", population: "90,411,000", mainReligion: "Shia Islam", government: "Theocratic Republic", leader: "Supreme Leader Ayatollah Ali Khamenei", prayerPoints: ["Pray for imprisoned church leaders.", "Pray for house churches.", "Pray for believers under surveillance."] },
];

Deno.serve((req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  const index = Math.floor(Date.now() / 86400000) % COUNTRIES.length;
  return json(COUNTRIES[index]);
});
