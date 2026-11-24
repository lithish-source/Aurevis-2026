import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Client & High-Availability Service for Server Environments
// ─────────────────────────────────────────────────────────────────────────────

export type SupabaseResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

export const TABLES = [
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

export function getSupabaseUrl(): string {
  const u = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  return u.replace(/\/+$/, "");
}

export function getSupabaseKey(): string {
  return (
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  );
}

export function supabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseKey());
}

let _supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseConfigured()) return null;
  if (!_supabaseInstance) {
    _supabaseInstance = createClient(getSupabaseUrl(), getSupabaseKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return _supabaseInstance;
}

export function supabaseInfo() {
  const u = getSupabaseUrl();
  const k = getSupabaseKey();
  return {
    configured: supabaseConfigured(),
    url: u || null,
    keyPrefix: k ? `${k.slice(0, 8)}…` : null,
  };
}

/** Insert or upsert rows directly into Supabase */
export async function supabaseInsert(
  table: SupabaseTable,
  rows: Record<string, unknown>[],
  { upsertOn }: { upsertOn?: string } = {},
): Promise<SupabaseResult> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, skipped: true, error: "Supabase not configured" };

  try {
    const query = client.from(table);
    const { error } = upsertOn
      ? await query.upsert(rows, { onConflict: upsertOn })
      : await query.insert(rows);

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Count total rows in a Supabase table */
export async function supabaseCount(
  table: SupabaseTable,
): Promise<{ ok: boolean; count: number | null; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, count: null, error: "not configured" };

  try {
    const { count, error } = await client
      .from(table)
      .select("*", { count: "exact", head: true });

    if (error) {
      return { ok: false, count: null, error: error.message };
    }
    return { ok: true, count: count ?? 0 };
  } catch (e) {
    return { ok: false, count: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Lightweight reachability probe for Supabase connection */
export async function supabasePing(): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: "not configured" };

  try {
    const { error } = await client.from("app_users").select("id").limit(1);
    if (error && error.code !== "PGRST116") {
      // If table exists and responds, connection is successful
      return { ok: true };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
