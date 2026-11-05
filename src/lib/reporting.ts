"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Client reporting layer.
//
// Every meaningful action in the app (sign-up, ticket purchase, pass purchase,
// SOS, analytics taps) is POSTed to /api/report/*, which dual-writes to the
// local SQLite DB + Supabase. Purchases are also kept in localStorage so the
// Tickets / Pass screens reflect them immediately.

export type StoredUser = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  deviceId: string;
};

export type StoredTicket = {
  id: string;
  ref: string;
  mode: "bus" | "metro";
  routeNo?: string | null;
  from: string;
  to: string;
  passengers: number;
  fare: number;
  issuedAt: string;
  synced: boolean;
};

export type StoredPass = {
  id: string;
  passId: string;
  name: string;
  price: number;
  validity: string;
  purchasedAt: string;
  synced: boolean;
};

const DEVICE_KEY = "chennai-one:deviceId";
const USER_KEY = "chennai-one:user";
const TICKETS_KEY = "chennai-one:tickets";
const PASSES_KEY = "chennai-one:passes";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  return safeParse<StoredUser | null>(window.localStorage.getItem(USER_KEY), null);
}

export function setStoredUser(user: StoredUser | null) {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(USER_KEY);
}

export function getStoredTickets(): StoredTicket[] {
  if (typeof window === "undefined") return [];
  return safeParse<StoredTicket[]>(window.localStorage.getItem(TICKETS_KEY), []);
}

export function addStoredTicket(t: StoredTicket) {
  if (typeof window === "undefined") return;
  const list = getStoredTickets();
  list.unshift(t);
  window.localStorage.setItem(TICKETS_KEY, JSON.stringify(list.slice(0, 30)));
  window.dispatchEvent(new CustomEvent("chennai-one:tickets-changed"));
}

export function getStoredPasses(): StoredPass[] {
  if (typeof window === "undefined") return [];
  return safeParse<StoredPass[]>(window.localStorage.getItem(PASSES_KEY), []);
}

export function addStoredPass(p: StoredPass) {
  if (typeof window === "undefined") return;
  const list = getStoredPasses();
  list.unshift(p);
  window.localStorage.setItem(PASSES_KEY, JSON.stringify(list.slice(0, 20)));
  window.dispatchEvent(new CustomEvent("chennai-one:passes-changed"));
}

export function clearStoredData() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(TICKETS_KEY);
  window.localStorage.removeItem(PASSES_KEY);
  window.dispatchEvent(new CustomEvent("chennai-one:tickets-changed"));
  window.dispatchEvent(new CustomEvent("chennai-one:passes-changed"));
}

// ─── reporting calls ─────────────────────────────────────────────────────────

type SyncInfo = { ok: boolean; skipped: boolean; error?: string };

async function post(path: string, body: Record<string, unknown>): Promise<{ ok: boolean; sync?: SyncInfo }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: getDeviceId(), userId: getStoredUser()?.id, ...body }),
      keepalive: true,
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok && json.ok !== false, sync: json.supabase };
  } catch {
    return { ok: false };
  }
}

export async function reportSignUp(input: { name: string; phone?: string; email?: string }) {
  try {
    const res = await fetch("/api/report/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, deviceId: getDeviceId() }),
    });
    const json = await res.json();
    if (json.ok && json.user) {
      const u: StoredUser = {
        id: json.user.id,
        name: json.user.name,
        phone: json.user.phone,
        email: json.user.email,
        deviceId: json.user.deviceId,
      };
      setStoredUser(u);
      return { ok: true as const, user: u, sync: json.supabase as SyncInfo };
    }
    return { ok: false as const, error: json.error ?? "Sign-up failed" };
  } catch {
    return { ok: false as const, error: "Network error" };
  }
}

export async function reportTicket(input: {
  mode: "bus" | "metro";
  routeNo?: string;
  from: string;
  to: string;
  passengers: number;
  fare: number;
}): Promise<{ ok: boolean; ticket?: StoredTicket; sync?: SyncInfo }> {
  try {
    const res = await fetch("/api/report/ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, deviceId: getDeviceId(), userId: getStoredUser()?.id }),
    });
    const json = await res.json();
    if (json.ok && json.ticket) {
      const t: StoredTicket = {
        id: json.ticket.id,
        ref: json.ticket.ref,
        mode: json.ticket.mode,
        routeNo: json.ticket.routeNo,
        from: json.ticket.fromStop,
        to: json.ticket.toStop,
        passengers: json.ticket.passengers,
        fare: json.ticket.fare,
        issuedAt: json.ticket.createdAt,
        synced: Boolean(json.supabase?.ok),
      };
      addStoredTicket(t);
      return { ok: true, ticket: t, sync: json.supabase };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function reportPass(input: {
  passId: string;
  name: string;
  price: number;
  validity: string;
}): Promise<{ ok: boolean; pass?: StoredPass; sync?: SyncInfo }> {
  try {
    const res = await fetch("/api/report/pass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, deviceId: getDeviceId(), userId: getStoredUser()?.id }),
    });
    const json = await res.json();
    if (json.ok && json.pass) {
      const p: StoredPass = {
        id: json.pass.id,
        passId: json.pass.passId,
        name: json.pass.name,
        price: json.pass.price,
        validity: json.pass.validity,
        purchasedAt: json.pass.createdAt,
        synced: Boolean(json.supabase?.ok),
      };
      addStoredPass(p);
      return { ok: true, pass: p, sync: json.supabase };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

export function reportSos(kind: "sos_pressed" | "sos_cancelled", lat?: number, lon?: number) {
  return post("/api/report/sos", { kind, lat, lon });
}

export function reportEvent(name: string, payload: Record<string, unknown> = {}) {
  return post("/api/report/event", { name, payload });
}

export async function sendTestEvent() {
  try {
    const res = await fetch("/api/report/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: getDeviceId(), userId: getStoredUser()?.id }),
    });
    return await res.json();
  } catch {
    return { ok: false, message: "Network error" };
  }
}
