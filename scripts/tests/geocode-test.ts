import { geocodePost } from "../../src/lib/social/gazetteer";

const cases = [
  "Route 54 Broadway bus stuck before the Poonamallee bypass for 40 mins now. Driver says no diversion announced yet.",
  "578 from CMBT diverted at Maduravoyal itself via Nazarethpettai. Adds 45 mins to the Sriperumbudur run.",
  "Stuck at Madhya Kailash underpass, water rising fast on both sides. Cabs refusing to go towards Taramani.",
  "Waterlogging right in front of Sri Ramachandra hospital gate on Mount-Poonamallee road.",
  "Kumananchavadi signal queue is not moving an inch. Everyone trying to skip the Poonamallee bypass mess.",
  "Water entering shops on Usman Road T Nagar. Pondy Bazaar side also bad.",
  "Brick lorry stalled right at Poonamallee bypass junction, half the carriageway blocked.",
];

for (const t of cases) {
  const r = geocodePost(t, []);
  console.log(`→ ${r.primary?.name} (${r.primary?.prep ? "prep" : "pos"})`, "| others:", r.matches.slice(0, 3).map(m => m.name).join(", "));
}
