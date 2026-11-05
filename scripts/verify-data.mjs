#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// End-to-end data-transfer verification for the Chennai One reporting pipeline.
// Hits every /api/report/* endpoint, then confirms the rows landed in SQLite
// (and prints the Supabase mirror state). Run: node scripts/verify-data.mjs

const BASE = process.env.BASE_URL || "http://localhost:3000";
const DEVICE = `verify-${Date.now().toString(36)}`;

let failures = 0;
const ok = (cond, label, extra = "") => {
  console.log(`${cond ? "  ✅" : "  ❌"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
};

async function j(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

console.log(`\nChennai One · data-transfer verification\nbase: ${BASE}\ndevice: ${DEVICE}\n`);

// ── 1. baseline ───────────────────────────────────────────────────────────────
const before = await j("GET", "/api/report/status");
console.log("[1] baseline status");
ok(before.data.ok, "GET /api/report/status responds");
const b = before.data.local;

// ── 2. nearby stops API ───────────────────────────────────────────────────────
console.log("\n[2] transit API");
const stops = await j("GET", "/api/transit/stops/nearby?lat=13.032&lon=80.1755&mode=all&radius=7000");
ok(stops.data.ok && stops.data.count >= 15, `GET nearby stops returns ${stops.data.count} stops`);
ok(
  stops.data.stops.every((s) => typeof s.lat === "number" && typeof s.distanceM === "number"),
  "every stop has coordinates + distance",
);

// ── 3. sign-up ────────────────────────────────────────────────────────────────
console.log("\n[3] account sign-up");
const signup = await j("POST", "/api/report/signup", {
  name: "Verify Tester",
  phone: "90000 00000",
  email: "verify@test.dev",
  deviceId: DEVICE,
});
ok(signup.status === 201 && signup.data.ok, "POST /api/report/signup created a user");
ok(signup.data.user?.name === "Verify Tester", "user name persisted", signup.data.user?.name || "");
const userId = signup.data.user?.id;
ok(
  signup.data.supabase?.skipped === true || signup.data.supabase?.ok === true,
  `Supabase mirror: ${signup.data.supabase?.skipped ? "skipped (not configured — expected in local mode)" : signup.data.supabase?.ok ? "ok" : signup.data.supabase?.error}`,
);

// ── 4. ticket purchase ────────────────────────────────────────────────────────
console.log("\n[4] ticket purchase");
const ticket = await j("POST", "/api/report/ticket", {
  mode: "metro",
  routeNo: "BL-1",
  from: "Government Estate",
  to: "Meenambakkam",
  passengers: 2,
  fare: 80,
  deviceId: DEVICE,
  userId,
});
ok(ticket.status === 201 && ticket.data.ok, "POST /api/report/ticket recorded");
ok(/^MTX-\d{4}-\d{4}$/.test(ticket.data.ticket?.ref ?? ""), "ticket ref generated", ticket.data.ticket?.ref || "");

// ── 5. pass purchase ──────────────────────────────────────────────────────────
console.log("\n[5] pass purchase");
const pass = await j("POST", "/api/report/pass", {
  passId: "tourist",
  name: "Tourist Day Pass",
  price: 150,
  validity: "1 day · unlimited rides",
  deviceId: DEVICE,
  userId,
});
ok(pass.status === 201 && pass.data.ok, "POST /api/report/pass recorded");

// ── 6. SOS ────────────────────────────────────────────────────────────────────
console.log("\n[6] SOS alert");
const sos = await j("POST", "/api/report/sos", { kind: "sos_pressed", lat: 13.032, lon: 80.1755, deviceId: DEVICE, userId });
ok(sos.status === 201 && sos.data.ok, "POST /api/report/sos recorded");

// ── 7. analytics event + test event ───────────────────────────────────────────
console.log("\n[7] analytics events");
const ev = await j("POST", "/api/report/event", { name: "verify_tap", payload: { screen: "home" }, deviceId: DEVICE });
ok(ev.status === 201 && ev.data.ok, "POST /api/report/event recorded");
const test = await j("POST", "/api/report/test", { deviceId: DEVICE });
ok(test.status === 201 && test.data.ok, "POST /api/report/test recorded");

// ── 8. account summary ────────────────────────────────────────────────────────
console.log("\n[8] account summary");
const summary = await j("GET", `/api/account/summary?deviceId=${DEVICE}`);
ok(summary.data.ok && summary.data.user?.name === "Verify Tester", "summary returns the user");
ok(summary.data.tickets?.length === 1 && summary.data.tickets[0].fare === 80, "summary lists the ticket (₹80)");
ok(summary.data.passes?.length === 1 && summary.data.passes[0].price === 150, "summary lists the pass (₹150)");
ok(summary.data.stats?.spent === 230, "stats.spent = ₹230 (80 + 150)", `got ₹${summary.data.stats?.spent}`);

// ── 9. final status — everything incremented ─────────────────────────────────
console.log("\n[9] final status vs baseline");
const after = await j("GET", "/api/report/status");
const a = after.data.local;
ok(a.app_users === b.app_users + 1, `app_users ${b.app_users} → ${a.app_users}`);
ok(a.ticket_purchases === b.ticket_purchases + 1, `ticket_purchases ${b.ticket_purchases} → ${a.ticket_purchases}`);
ok(a.pass_purchases === b.pass_purchases + 1, `pass_purchases ${b.pass_purchases} → ${a.pass_purchases}`);
ok(a.sos_events === b.sos_events + 1, `sos_events ${b.sos_events} → ${a.sos_events}`);
ok(a.analytics_events >= b.analytics_events + 2, `analytics_events ${b.analytics_events} → ${a.analytics_events} (+2 events)`);
ok(after.data.supabase.configured === false || after.data.supabase.reachable === true, "Supabase state is coherent (not configured → local-only mode)");
ok(
  after.data.recentSync.length > 0 && after.data.recentSync.every((s) => s.status === "skipped" || s.status === "ok"),
  `sync log has ${after.data.recentSync.length} entries, all ok/skipped`,
);

console.log(`\n${failures === 0 ? "🎉 ALL CHECKS PASSED" : `⚠️  ${failures} check(s) failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
