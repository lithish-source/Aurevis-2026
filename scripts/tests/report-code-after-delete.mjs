// Deletion-collision regression test for the IncidentReport `code` bug.
//
// Original bug: nextReportCode() used count()+1. After deleting a MIDDLE
// report row, count() drops by one, so the next generated code re-issues an
// ALREADY-USED code → "Unique constraint failed on the fields: (`code`)" →
// the absorb fails and the citizen's report is lost.
//
// This test deletes a middle report, ingests one new post, and asserts the
// new report gets a FRESH code (previous max + 1), with no absorb failure.
//
// Usage: bun scripts/tests/report-code-after-delete.mjs [baseURL]
import { PrismaClient } from "@prisma/client";

const BASE = process.argv[2] ?? "http://localhost:3000";
const prisma = new PrismaClient();

const num = (c) => Number.parseInt(/^RPT-(\d+)$/.exec(c)?.[1] ?? "0", 10);

const codesFromApi = async () => {
  const res = await fetch(`${BASE}/api/reports?limit=500`);
  const j = await res.json();
  return (j.reports ?? []).map((r) => r.code);
};

const main = async () => {
  const before = await codesFromApi();
  const nums = before.map(num).sort((a, b) => a - b);
  const maxBefore = nums.at(-1);
  // pick a middle report (not the newest) — count() would then regenerate a used code
  const midCode = `RPT-${String(nums[Math.floor(nums.length / 2)]).padStart(4, "0")}`;
  const mid = await prisma.incidentReport.findUnique({ where: { code: midCode } });
  if (!mid) throw new Error(`middle report ${midCode} not found`);
  await prisma.userNotification.deleteMany({ where: { reportId: mid.id } });
  await prisma.incidentReport.delete({ where: { id: mid.id } });
  console.log(`[delete] removed middle report ${midCode} (count ${nums.length} → ${nums.length - 1})`);

  const stamp = Date.now();
  const res = await fetch(`${BASE}/api/social/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: `del-test-${stamp}`,
      source: "race_test",
      handle: "delete_tester",
      text: "Huge jam near Adyar depot after signal failure",
      geo: { lat: 13.0067, lon: 80.257 }, // Adyar — far from other test spots
      postedAt: new Date().toISOString(),
      timeScale: 1,
      citizen: { eventType: "congestion", severity: "medium", placeName: "Adyar" },
    }),
  });
  if (res.status !== 201) throw new Error(`ingest failed: ${res.status}`);
  console.log("[delete] ingest 201 OK — waiting for background absorb…");

  // poll for the new report (absorb is backgrounded)
  let newCode = null;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const now = await codesFromApi();
    const fresh = now.filter((c) => !before.includes(c) && c !== midCode);
    if (fresh.length > 0) {
      newCode = fresh.sort().at(-1);
      break;
    }
  }

  const dbCodes = (await prisma.incidentReport.findMany({ select: { code: true } })).map((r) => r.code);
  const dupes = dbCodes.filter((c, i) => dbCodes.indexOf(c) !== i);

  const pass =
    newCode != null &&
    num(newCode) === maxBefore + 1 &&
    dupes.length === 0;

  console.log(`[delete] new code: ${newCode} (expected RPT-${String(maxBefore + 1).padStart(4, "0")}), duplicate codes in DB: ${dupes.length}`);
  console.log(pass ? "[delete] PASS ✅" : "[delete] FAIL ❌");
  await prisma.$disconnect();
  process.exit(pass ? 0 : 1);
};

main().catch(async (e) => {
  console.error("[delete] ERROR:", e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
