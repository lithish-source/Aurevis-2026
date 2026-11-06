// Race/regression test for the IncidentReport `code` unique-constraint bug.
//
// Original bug: nextReportCode() used count()+1. Two concurrent absorbs
// (e.g. background replay + a citizen report POST) read the same count,
// generated the same RPT-XXXX code, and the loser crashed with
// "Unique constraint failed on the fields: (`code`)" — silently dropping
// the citizen's report.
//
// This test fires N concurrent ingest requests at distinct locations
// (>2.5 km apart so each must create a SEPARATE report), then asserts:
//   1. every request returns 201 ok
//   2. exactly N new incident reports exist afterwards
//   3. all new report codes are unique and well-formed (RPT-NNNN)
//
// Usage: bun scripts/tests/report-code-race.mjs [baseURL] [N]
const BASE = process.argv[2] ?? "http://localhost:3000";
const N = Number(process.argv[3] ?? 6);

// distinct spots around Chennai, all >2.5 km apart
const SPOTS = [
  { name: "Poonamallee", lat: 13.048, lon: 80.095 },
  { name: "Guindy", lat: 13.006, lon: 80.2206 },
  { name: "T. Nagar", lat: 13.0418, lon: 80.2341 },
  { name: "Vadapalani", lat: 13.0523, lon: 80.2123 },
  { name: "Perungudi", lat: 12.9611, lon: 80.2412 },
  { name: "Ambattur", lat: 13.1143, lon: 80.1548 },
  { name: "Velachery", lat: 12.9791, lon: 80.221 },
  { name: "Anna Nagar", lat: 13.0878, lon: 80.2107 },
];

const STUB = [
  "Stuck here — heavy traffic jam, nothing is moving",
  "Road accident ahead, police at the spot",
  "Bad waterlogging after the rain, buses stuck",
  "Tree fell on the road, blocked one side",
  "Signal stuck red for 15 minutes, long queue",
  "Bus broke down mid-route, huge pile up",
  "Metro work diversion, long detour via side roads",
  "Procession on the main road, crawl traffic",
];

const codesBefore = async () => {
  const res = await fetch(`${BASE}/api/reports?limit=500`);
  const j = await res.json();
  const rows = j.reports ?? j.rows ?? [];
  return new Set(rows.map((r) => r.code));
};

const main = async () => {
  console.log(`[race] target ${BASE}, firing ${N} concurrent ingests…`);
  const before = await codesBefore();
  const stamp = Date.now();

  const reqs = Array.from({ length: N }, (_, i) => {
    const spot = SPOTS[i % SPOTS.length];
    const body = {
      id: `race-test-${stamp}-${i}`,
      source: "race_test",
      handle: `race_tester_${i}`,
      text: `${STUB[i % STUB.length]} at ${spot.name}`,
      geo: { lat: spot.lat, lon: spot.lon },
      postedAt: new Date().toISOString(),
      timeScale: 1,
      citizen: { eventType: "congestion", severity: "medium", placeName: spot.name },
    };
    return fetch(`${BASE}/api/social/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  });

  const responses = await Promise.all(reqs);
  const statuses = responses.map((r) => r.status);
  const allOk = statuses.every((s) => s === 201);
  console.log(`[race] ingest statuses: ${statuses.join(", ")} → ${allOk ? "OK" : "FAIL"}`);

  // absorbs run in the background — poll until the new reports appear
  let after = before;
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 500));
    after = await codesBefore();
    if (after.size - before.size >= N) break;
  }

  const newCodes = [...after].filter((c) => !before.has(c));
  console.log(`[race] new report codes (${newCodes.length}/${N}): ${newCodes.sort().join(", ")}`);

  const unique = new Set(newCodes);
  const wellFormed = newCodes.every((c) => /^RPT-\d{4,}$/.test(c));

  const pass =
    allOk &&
    newCodes.length === N &&
    unique.size === newCodes.length &&
    wellFormed;

  console.log(
    `[race] checks — statuses 201: ${allOk}; count ${newCodes.length}===${N}: ${newCodes.length === N}; unique: ${unique.size === newCodes.length}; well-formed: ${wellFormed}`,
  );
  console.log(pass ? "[race] PASS ✅" : "[race] FAIL ❌");
  process.exit(pass ? 0 : 1);
};

main().catch((e) => {
  console.error("[race] ERROR:", e);
  process.exit(1);
});
