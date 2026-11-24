-- ─────────────────────────────────────────────────────────────────────────────
-- Chennai One / CUMTA Operations Supabase Database Schema (PostgreSQL)
-- 
-- Run this SQL in your Supabase Dashboard SQL Editor (https://app.supabase.com)
-- to create all tables, indexes, row-level security (RLS) policies, and realtime
-- publication settings required to scale Chennai One natively on Supabase.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pgcrypto / uuid extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. App Users
CREATE TABLE IF NOT EXISTS public.app_users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    device_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    city TEXT NOT NULL DEFAULT 'Chennai',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Ticket Purchases
CREATE TABLE IF NOT EXISTS public.ticket_purchases (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    ref TEXT UNIQUE NOT NULL,
    mode TEXT NOT NULL, -- bus | metro
    route_no TEXT,
    from_stop TEXT NOT NULL,
    to_stop TEXT NOT NULL,
    passengers INT NOT NULL DEFAULT 1,
    fare INT NOT NULL,
    user_id TEXT,
    device_id TEXT,
    status TEXT NOT NULL DEFAULT 'issued',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Pass Purchases
CREATE TABLE IF NOT EXISTS public.pass_purchases (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    pass_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price INT NOT NULL,
    validity TEXT NOT NULL,
    user_id TEXT,
    device_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. SOS Events
CREATE TABLE IF NOT EXISTS public.sos_events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    kind TEXT NOT NULL, -- sos_pressed | sos_cancelled
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    user_id TEXT,
    device_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Analytics Events
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    payload TEXT NOT NULL, -- JSON string
    user_id TEXT,
    device_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Sync Log (for audit / sync tracking)
CREATE TABLE IF NOT EXISTS public.sync_log (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT 'supabase',
    status TEXT NOT NULL, -- ok | error | skipped
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Social Posts (NLP mobility-pulse ingest pipeline)
CREATE TABLE IF NOT EXISTS public.social_posts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    external_id TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL, -- instagram | facebook | twitter | reddit | telegram | news | official | bluesky
    author_handle TEXT,
    author_meta TEXT, -- JSON: { accountAgeDays, followers, verified }
    text TEXT NOT NULL,
    posted_at TIMESTAMPTZ NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_mobility BOOLEAN NOT NULL DEFAULT false,
    event_type TEXT, -- congestion | accident | flood | transit_disruption | road_closure | infrastructure | protest | hazard | other
    severity TEXT, -- low | medium | high | critical
    sentiment TEXT, -- negative | neutral | positive
    summary TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    place_label TEXT,
    matched_places TEXT, -- JSON
    trust_score DOUBLE PRECISION,
    verification TEXT, -- verified | unverified | flagged
    corroborates INT NOT NULL DEFAULT 0,
    nlp_meta TEXT, -- JSON
    scenario TEXT,
    time_scale DOUBLE PRECISION NOT NULL DEFAULT 1,
    report_id TEXT
);

-- 8. Incident Reports (CUMTA Control Room / Operations Command)
CREATE TABLE IF NOT EXISTS public.incident_reports (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT UNIQUE NOT NULL, -- e.g. RPT-0042
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    place_label TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    advisory TEXT, -- JSON: { headline, busNote, metroNote, extra, metro:[{name,km}] }
    status TEXT NOT NULL DEFAULT 'open', -- open | resolved
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_scenario_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    resolution_note TEXT,
    post_count INT NOT NULL DEFAULT 1,
    max_trust DOUBLE PRECISION,
    verification TEXT,
    scenario TEXT,
    post_ids TEXT NOT NULL DEFAULT '[]', -- JSON array of SocialPost ids
    notifications_sent INT NOT NULL DEFAULT 0
);

-- 9. User Notifications (Geo-targeted Commuter Alerts)
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    report_id TEXT,
    code TEXT UNIQUE,
    kind TEXT NOT NULL, -- incident | escalation | cleared
    area_label TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    radius_km DOUBLE PRECISION NOT NULL DEFAULT 5,
    headline TEXT NOT NULL,
    body TEXT NOT NULL,
    meta TEXT, -- JSON: { eventType, severity, advisory }
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ
);

-- ── Indexes for fast geospatial and high-throughput queries ───────────────────
CREATE INDEX IF NOT EXISTS idx_social_posts_posted_at ON public.social_posts (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_is_mobility ON public.social_posts (is_mobility);
CREATE INDEX IF NOT EXISTS idx_social_posts_scenario ON public.social_posts (scenario);
CREATE INDEX IF NOT EXISTS idx_social_posts_report_id ON public.social_posts (report_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_event_type ON public.social_posts (event_type);

CREATE INDEX IF NOT EXISTS idx_incident_reports_status ON public.incident_reports (status);
CREATE INDEX IF NOT EXISTS idx_incident_reports_last_activity ON public.incident_reports (last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_reports_geo ON public.incident_reports (lat, lon);

CREATE INDEX IF NOT EXISTS idx_user_notifications_created ON public.user_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_geo ON public.user_notifications (lat, lon);

CREATE INDEX IF NOT EXISTS idx_ticket_purchases_device ON public.ticket_purchases (device_id);
CREATE INDEX IF NOT EXISTS idx_pass_purchases_device ON public.pass_purchases (device_id);
CREATE INDEX IF NOT EXISTS idx_sos_events_device ON public.sos_events (device_id);

-- ── Row Level Security (RLS) & Public Grants ──────────────────────────────────
-- Allow public API reading and writing via Supabase Anon/Service Key
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pass_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-write on app_users" ON public.app_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write on ticket_purchases" ON public.ticket_purchases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write on pass_purchases" ON public.pass_purchases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write on sos_events" ON public.sos_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write on analytics_events" ON public.analytics_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write on sync_log" ON public.sync_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write on social_posts" ON public.social_posts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write on incident_reports" ON public.incident_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write on user_notifications" ON public.user_notifications FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime broadcast on live streams & incident reports
ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;
