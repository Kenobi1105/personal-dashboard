import { json, optionsResponse } from "../_shared/dashboard.ts";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  return json({
    operation: {
      source: "Operation World",
      country: "Prayer Calendar",
      flag: "https://flagcdn.com/w160/un.png",
      summary: "Open the full Operation World prayer page for today's country prayer focus.",
      prayerPoints: ["Pray for gospel witness among the nations.", "Pray for churches serving under pressure.", "Pray for wise and courageous mission workers."],
      url: "https://operationworld.org/prayer-resources/today/",
    },
    joshua: {
      source: "Joshua Project",
      name: "Unreached of the Day",
      country: "Global",
      flag: "https://flagcdn.com/w160/un.png",
      summary: "Open Joshua Project for today's unreached people group prayer focus.",
      prayerPoints: ["Pray for Scripture access.", "Pray for local gospel workers.", "Pray for receptive hearts."],
      url: "https://joshuaproject.net/pray/unreachedoftheday",
    },
  });
});

