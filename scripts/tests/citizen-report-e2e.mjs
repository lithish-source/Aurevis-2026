// End-to-end citizen-report test — the exact flow that hit the bug in the
// wild: POST /api/citizen/report while other ingests are running. The server
// runs BERT over the description (no photo), then the post flows through
// ingest → absorb → IncidentReport creation → notification.
//
// Asserts: HTTP 201, ok=true, a report code came back (previously the absorb
// crashed on the unique `code` constraint and `report` came back null).
//
// Usage: bun scripts/tests/citizen-report-e2e.mjs [baseURL]
const BASE = process.argv[2] ?? "http://localhost:3000";

const main = async () => {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/citizen/report`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: "Serious waterlogging under the Kodambakkam bridge, two-wheelers stalling and buses diverted",
      lat: 13.0517,
      lon: 80.2255,
      occurredAt: new Date().toISOString(),
      name: "E2E Tester",
    }),
  });
  const j = await res.json();
  const ms = Date.now() - t0;

  console.log(`[citizen] status ${res.status} in ${ms}ms`);
  console.log(`[citizen] AI verdict: type=${j.ai?.eventType} severity=${j.ai?.severity} score=${j.ai?.finalScore}`);
  console.log(`[citizen] post: ${j.post?.placeLabel} (trust ${j.post?.trustScore}, ${j.post?.verification})`);
  console.log(`[citizen] report: ${j.report ? `${j.report.code} — "${j.report.title}" (${j.report.action})` : "null"}`);

  const pass = res.status === 201 && j.ok === true && typeof j.report?.code === "string" && /^RPT-\d+$/.test(j.report.code);
  console.log(pass ? "[citizen] PASS ✅" : "[citizen] FAIL ❌");
  process.exit(pass ? 0 : 1);
};

main().catch((e) => {
  console.error("[citizen] ERROR:", e);
  process.exit(1);
});
