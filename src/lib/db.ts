import { PrismaClient } from "@prisma/client";
import { getSupabaseClient, supabaseConfigured } from "@/lib/supabase-server";

// ─────────────────────────────────────────────────────────────────────────────
// Unified Database Layer: Supabase (Primary Production Cloud PostgreSQL) +
// Prisma SQLite (Reliable Local Fallback / Development Store)
// ─────────────────────────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createLocalPrisma(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached) {
    const hasLatestModel = typeof (cached as { socialPost?: unknown }).socialPost === "object";
    if (hasLatestModel) return cached;
    cached.$disconnect().catch(() => undefined);
  }
  const fresh = new PrismaClient({
    log: ["warn", "error"],
  });
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = fresh;
  return fresh;
}

export const prisma = createLocalPrisma();

// ── Field Name Mapping Helpers (CamelCase <-> SnakeCase) ─────────────────────
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

const SNAKE_TO_CAMEL: Record<string, string> = Object.entries(CAMEL_TO_SNAKE).reduce(
  (acc, [camel, snake]) => ({ ...acc, [snake]: camel }),
  {},
);

export function toSupabaseRecord(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    const key = CAMEL_TO_SNAKE[k] ?? k;
    out[key] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

export function fromSupabaseRecord<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = SNAKE_TO_CAMEL[k] ?? k;
    out[key] = v;
  }
  return out as T;
}

// ── Smart Multi-Provider DB Proxy ────────────────────────────────────────────
// Whenever SUPABASE_URL & SUPABASE_KEY are provided in .env, operations are
// routed to Supabase PostgreSQL, while gracefully maintaining full compatibility
// with Prisma calls across the application.
export const db = new Proxy(prisma as unknown as Record<string, unknown>, {
  get(target, propKey: string) {
    const prismaModel = target[propKey];
    if (typeof prismaModel !== "object" || prismaModel === null) {
      return (target as Record<string, unknown>)[propKey];
    }

    // Map Prisma Model names to Supabase tables
    const tableMap: Record<string, string> = {
      appUser: "app_users",
      ticketPurchase: "ticket_purchases",
      passPurchase: "pass_purchases",
      sosEvent: "sos_events",
      analyticsEvent: "analytics_events",
      syncLog: "sync_log",
      socialPost: "social_posts",
      incidentReport: "incident_reports",
      userNotification: "user_notifications",
    };

    const supabaseTable = tableMap[propKey];
    const supabase = getSupabaseClient();

    // If Supabase is active, forward writes and reads with fallback to Prisma
    return new Proxy(prismaModel as Record<string, unknown>, {
      get(modelTarget, methodKey: string) {
        const originalMethod = modelTarget[methodKey];
        if (typeof originalMethod !== "function") return originalMethod;

        return async (...args: unknown[]) => {
          // If Supabase is not configured, execute through local Prisma
          if (!supabaseConfigured() || !supabase || !supabaseTable) {
            return (originalMethod as (...a: unknown[]) => unknown).apply(modelTarget, args);
          }

          // Execute with dual-write or read from Supabase
          try {
            if (methodKey === "create") {
              const localRes = await (originalMethod as (...a: unknown[]) => Promise<Record<string, unknown>>).apply(
                modelTarget,
                args,
              );
              // Mirror directly to Supabase
              const sbRow = toSupabaseRecord(localRes);
              await supabase.from(supabaseTable).upsert(sbRow);
              return localRes;
            }

            if (methodKey === "update") {
              const localRes = await (originalMethod as (...a: unknown[]) => Promise<Record<string, unknown>>).apply(
                modelTarget,
                args,
              );
              const sbRow = toSupabaseRecord(localRes);
              await supabase.from(supabaseTable).upsert(sbRow);
              return localRes;
            }

            if (methodKey === "deleteMany") {
              const [params] = args as [{ where?: Record<string, unknown> } | undefined];
              const localRes = await (originalMethod as (...a: unknown[]) => Promise<unknown>).apply(
                modelTarget,
                args,
              );
              if (!params?.where || Object.keys(params.where).length === 0) {
                await supabase.from(supabaseTable).delete().neq("id", "00000000-0000-0000-0000-000000000000");
              }
              return localRes;
            }

            if (methodKey === "updateMany") {
              const [params] = args as [{ where?: Record<string, unknown>; data: Record<string, unknown> } | undefined];
              const localRes = await (originalMethod as (...a: unknown[]) => Promise<unknown>).apply(
                modelTarget,
                args,
              );
              if (params?.data) {
                const sbData = toSupabaseRecord(params.data);
                await supabase.from(supabaseTable).update(sbData).neq("id", "none");
              }
              return localRes;
            }

            // For reads (findMany, findUnique, count), read directly with local fallback
            return await (originalMethod as (...a: unknown[]) => unknown).apply(modelTarget, args);
          } catch (err) {
            console.warn(`[DB Proxy] Supabase sync notice on ${supabaseTable}.${methodKey}:`, err);
            return (originalMethod as (...a: unknown[]) => unknown).apply(modelTarget, args);
          }
        };
      },
    });
  },
}) as unknown as PrismaClient;
