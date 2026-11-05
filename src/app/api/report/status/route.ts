import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dualWrite } from "@/lib/report-server";
import { supabaseInfo, supabaseCount, supabasePing } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// GET /api/report/status — row counts for every table + Supabase sync state.
export async function GET() {
  const [users, tickets, passes, sos, events, syncLog] = await Promise.all([
    db.appUser.count(),
    db.ticketPurchase.count(),
    db.passPurchase.count(),
    db.sosEvent.count(),
    db.analyticsEvent.count(),
    db.syncLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const info = supabaseInfo();
  let supabase: {
    configured: boolean;
    url: string | null;
    reachable: boolean | null;
    error?: string;
    counts: Record<string, number | null> | null;
  } = { configured: info.configured, url: info.url, reachable: null, counts: null };

  if (info.configured) {
    const [ping, t, p, s, e] = await Promise.all([
      supabasePing(),
      supabaseCount("ticket_purchases"),
      supabaseCount("pass_purchases"),
      supabaseCount("sos_events"),
      supabaseCount("analytics_events"),
    ]);
    supabase = {
      configured: true,
      url: info.url,
      reachable: ping.ok,
      error: ping.error,
      counts: { ticket_purchases: t.count, pass_purchases: p.count, sos_events: s.count, analytics_events: e.count },
    };
  }

  return NextResponse.json({
    ok: true,
    local: { app_users: users, ticket_purchases: tickets, pass_purchases: passes, sos_events: sos, analytics_events: events },
    supabase,
    recentSync: syncLog.map((l) => ({ table: l.table, status: l.status, detail: l.detail, at: l.createdAt })),
  });
}
