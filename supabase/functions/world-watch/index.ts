import { json, optionsResponse } from "../_shared/dashboard.ts";

const COUNTRIES = [
  {
    rank: 1,
    name: "North Korea",
    country: "North Korea",
    url: "https://www.opendoors.org/en-US/persecution/countries/north-korea/",
    flagImage: "https://flagcdn.com/w320/kp.png",
    christianPopulation: "400,000",
    population: "26,100,000",
    mainReligion: "Juche / Atheism",
    government: "Dictatorship",
    leader: "Kim Jong Un",
    prayerPoints: [
      "Pray for secret believers to be protected from discovery and punishment.",
      "Pray for Scripture, teaching, and Christian fellowship to reach isolated Christians.",
      "Pray that imprisoned and suffering believers would know Christ's nearness and endurance.",
    ],
  },
  {
    rank: 2,
    name: "Somalia",
    country: "Somalia",
    url: "https://www.opendoors.org/en-US/persecution/countries/somalia/",
    flagImage: "https://flagcdn.com/w320/so.png",
    christianPopulation: "Hundreds",
    population: "18,100,000",
    mainReligion: "Islam",
    government: "Federal parliamentary republic",
    leader: "Hassan Sheikh Mohamud",
    prayerPoints: [
      "Pray for Somali believers who must often worship and grow in secret.",
      "Pray for protection from extremist violence and family pressure.",
      "Pray that displaced Somalis would encounter faithful Christian witness and lasting peace.",
    ],
  },
  {
    rank: 9,
    name: "Iran",
    country: "Iran",
    url: "https://www.opendoors.org/en-US/persecution/countries/iran/",
    flagImage: "https://flagcdn.com/w320/ir.png",
    christianPopulation: "800,000",
    population: "90,411,000",
    mainReligion: "Shia Islam",
    government: "Theocratic Republic",
    leader: "Supreme Leader Ayatollah Ali Khamenei",
    prayerPoints: [
      "Pray for imprisoned church leaders and believers under interrogation.",
      "Pray for house churches to grow in wisdom, unity, and courage.",
      "Pray that Persian Scripture and discipleship resources would continue to reach seekers.",
    ],
  },
];

Deno.serve((req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  const manilaDay = Math.floor((Date.now() + 8 * 60 * 60 * 1000) / 86400000);
  const index = manilaDay % COUNTRIES.length;
  return json(COUNTRIES[index]);
});
