import { db } from "@/lib/db";
import { supabaseInsert, type SupabaseTable } from "@/lib/supabase-server";

// ─────────────────────────────────────────────────────────────────────────────
// Cloud-Native Supabase Store & Dual-Write Resilience Layer:
// Every transaction is stored directly in Supabase (when keys are configured)
// and synced to the local store with full audit tracking in sync_log.
// ─────────────────────────────────────────────────────────────────────────────

export type DualWriteResult<T> = {
  local: { ok: boolean; row: T };
  supabase: { ok: boolean; skipped: boolean; error?: string };
};

const CAMEL_TO_SNAKE: Record<string, string> = {
  deviceId: "device_id",
  userId: "user_id",
  routeNo: "route_no",
  fromStop: "from_stop",
  toStop: "to_stop",
  createdAt: "created_at",
  updatedAt: "updated_at",
  passId: "pass_id",
  authorHandle: "author_handle",
  authorMeta: "author_meta",
  postedAt: "posted_at",
  ingestedAt: "ingested_at",
  isMobility: "is_mobility",
  eventType: "event_type",
  placeLabel: "place_label",
  matchedPlaces: "matched_places",
  trustScore: "trust_score",
  nlpMeta: "nlp_meta",
  lastScenarioAt: "last_scenario_at",
  lastActivityAt: "last_activity_at",
  resolvedAt: "resolved_at",
  resolvedBy: "resolved_by",
  resolutionNote: "resolution_note",
  postCount: "post_count",
  maxTrust: "max_trust",
  postIds: "post_ids",
  notificationsSent: "notifications_sent",
  reportId: "report_id",
  areaLabel: "area_label",
  radiusKm: "radius_km",
  readAt: "read_at",
  openedAt: "opened_at",
  timeScale: "time_scale",
  externalId: "external_id",
};

function toSupabaseRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = CAMEL_TO_SNAKE[k] ?? k;
    out[key] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

export async function dualWrite<T extends { id: string } = { id: string } & Record<string, unknown>>(
  prismaTable:
    | "appUser"
    | "ticketPurchase"
    | "passPurchase"
    | "sosEvent"
    | "analyticsEvent"
    | "socialPost"
    | "incidentReport"
    | "userNotification",
  supabaseTable: SupabaseTable,
  create: Record<string, unknown>,
  { upsertOn }: { upsertOn?: string } = {},
): Promise<DualWriteResult<T>> {
  // 1) Primary write to store
  const row = (await (db as any)[prismaTable].create({ data: create })) as T;

  // 2) Supabase cloud sync (with conflict merge on primary key/unique columns)
  const mirror = await supabaseInsert(supabaseTable, [toSupabaseRow(row as unknown as Record<string, unknown>)], { upsertOn: upsertOn || "id" });

  // 3) Record sync status in log table
  await db.syncLog
    .create({
      data: {
        table: supabaseTable,
        rowId: row.id,
        target: "supabase",
        status: mirror.skipped ? "skipped" : mirror.ok ? "ok" : "error",
        detail: mirror.error ?? null,
      },
    })
    .catch(() => undefined);

  return {
    local: { ok: true, row },
    supabase: { ok: mirror.ok, skipped: Boolean(mirror.skipped), error: mirror.error },
  };
}
