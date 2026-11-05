// ─────────────────────────────────────────────────────────────────────────────
// Supabase REST bridge (server-side only).
//
// The app always writes to the local SQLite DB (source of truth / offline
// fallback) and then mirrors each row to the user's Supabase project via the
// PostgREST API. Configure it by setting these in .env:
//
//   SUPABASE_URL=https://<project-ref>.supabase.co
//   SUPABASE_KEY=<anon or service-role key>
//
// Table definitions matching this schema are in download/supabase-schema.sql.

export type SupabaseResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

const TABLES = [
  "app_users",
  "ticket_purchases",
  "pass_purchases",
  "sos_events",
  "analytics_events",
  "sync_log",
  "social_posts",
  "incident_reports",
  "user_notifications",
] as const;
export type SupabaseTable = (typeof TABLES)[number];

export function supabaseConfigured(): boolean {
  return Boolean(url() && key());
}

function url(): string {
  const u = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  return u.replace(/\/+$/, "");
}

function key(): string {
  return (
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  );
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: key(),
    Authorization: `Bearer ${key()}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export function supabaseInfo() {
  const u = url();
  return {
    configured: supabaseConfigured(),
    url: u || null,
    keyPrefix: key() ? `${key().slice(0, 8)}…` : null,
  };
}

/** Insert rows into a Supabase table. Returns skipped when not configured. */
export async function supabaseInsert(
  table: SupabaseTable,
  rows: Record<string, unknown>[],
  { upsertOn }: { upsertOn?: string } = {},
): Promise<SupabaseResult> {
  if (!supabaseConfigured()) return { ok: false, skipped: true, error: "not configured" };
  try {
    const res = await fetch(`${url()}/rest/v1/${table}`, {
      method: "POST",
      headers: headers({
        Prefer: upsertOn
          ? "return=minimal,resolution=merge-duplicates"
          : "return=minimal",
      }),
      body: JSON.stringify(rows),
      signal: AbortSignal.timeout(8000),
    });
    // 201 created, 200 for upserts; 409 on conflict without upsert
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status} ${body.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Count rows in a Supabase table (uses content-range). */
export async function supabaseCount(
  table: SupabaseTable,
): Promise<{ ok: boolean; count: number | null; error?: string }> {
  if (!supabaseConfigured()) return { ok: false, count: null, error: "not configured" };
  try {
    const res = await fetch(`${url()}/rest/v1/${table}?select=*&limit=1`, {
      method: "HEAD",
      headers: headers({ Prefer: "count=exact" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, count: null, error: `HTTP ${res.status}` };
    const range = res.headers.get("content-range"); // e.g. "0-0/42" or "*/0"
    const total = range ? Number(range.split("/")[1]) : null;
    return { ok: true, count: Number.isFinite(total) ? total : null };
  } catch (e) {
    return { ok: false, count: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Lightweight reachability probe used by /api/report/status. */
export async function supabasePing(): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseConfigured()) return { ok: false, error: "not configured" };
  try {
    const res = await fetch(`${url()}/rest/v1/`, {
      method: "GET",
      headers: headers(),
      signal: AbortSignal.timeout(6000),
    });
    // PostgREST root returns 200 with an OpenAPI doc
    return { ok: res.ok };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
