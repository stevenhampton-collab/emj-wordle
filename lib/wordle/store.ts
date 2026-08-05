// Storage for EMJ Wordle, backed by Vercel KV.
//
// We talk to Vercel KV over its REST API with plain fetch — no SDK, matching
// the app's dependency-light style. When KV isn't configured (local dev,
// preview before the store is attached) we fall back to an in-memory map so the
// game still runs; that data is per-instance and non-durable, which is fine for
// a demo but means production must have KV attached.
//
// Keys:
//   player:{email}  -> PlayerRecord (JSON)
//   leaderboard     -> LeaderboardEntry[] (JSON)

import type { LeaderboardEntry, PlayerRecord } from "./types";

const LEADERBOARD_KEY = "leaderboard";

// Resolve the KV connection from the environment. We accept both the Vercel KV
// names (KV_REST_API_*) and Upstash's own names (UPSTASH_REDIS_REST_*), since a
// database created directly on Upstash exposes the latter. Values are trimmed
// and stripped of any accidental surrounding quotes so a copy/paste slip does
// not silently break the connection.
function cleanEnv(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const trimmed = v.trim().replace(/^["']|["']$/g, "").trim();
  return trimmed || undefined;
}

function kvUrl(): string | undefined {
  return (
    cleanEnv(process.env.KV_REST_API_URL) ??
    cleanEnv(process.env.UPSTASH_REDIS_REST_URL)
  );
}

function kvToken(): string | undefined {
  return (
    cleanEnv(process.env.KV_REST_API_TOKEN) ??
    cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

export function isKvConfigured(): boolean {
  return Boolean(kvUrl() && kvToken());
}

// ---- in-memory fallback (dev/preview only) ----
const memory = new Map<string, string>();

async function rawGet(key: string): Promise<string | null> {
  if (!isKvConfigured()) return memory.get(key) ?? null;

  const url = `${kvUrl()}/get/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${kvToken()}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV get failed (${res.status})`);
  const data = (await res.json()) as { result: string | null };
  return data.result ?? null;
}

async function rawSet(key: string, value: string): Promise<void> {
  if (!isKvConfigured()) {
    memory.set(key, value);
    return;
  }
  const url = `${kvUrl()}/set/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${kvToken()}` },
    body: value,
  });
  if (!res.ok) throw new Error(`KV set failed (${res.status})`);
}

// Diagnostics: confirm the KV connection works end-to-end, without ever
// exposing the secret URL or token. Reports whether the env vars are present
// and whether a real write/read round trip against KV succeeds. A stray space
// or typo in a value shows up here as a failed round trip rather than silently
// falling back to in-memory.
export async function kvSelfTest(): Promise<{
  configured: boolean;
  urlPresent: boolean;
  tokenPresent: boolean;
  kvOk: boolean;
  detail: string;
}> {
  const urlPresent = Boolean(kvUrl());
  const tokenPresent = Boolean(kvToken());
  const configured = isKvConfigured();
  if (!configured) {
    return {
      configured,
      urlPresent,
      tokenPresent,
      kvOk: false,
      detail:
        "KV env vars not detected in this deployment; the app is using the in-memory fallback (data will not persist).",
    };
  }

  const key = "healthcheck";
  const value = "ok";
  try {
    const setUrl = `${kvUrl()}/set/${encodeURIComponent(key)}`;
    const setRes = await fetch(setUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${kvToken()}` },
      body: value,
    });
    if (!setRes.ok) {
      return {
        configured,
        urlPresent,
        tokenPresent,
        kvOk: false,
        detail: `KV write rejected (HTTP ${setRes.status}) — the URL or token value is likely wrong.`,
      };
    }

    const getUrl = `${kvUrl()}/get/${encodeURIComponent(key)}`;
    const getRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${kvToken()}` },
      cache: "no-store",
    });
    if (!getRes.ok) {
      return {
        configured,
        urlPresent,
        tokenPresent,
        kvOk: false,
        detail: `KV read rejected (HTTP ${getRes.status}) — the URL or token value is likely wrong.`,
      };
    }

    const data = (await getRes.json()) as { result: string | null };
    const kvOk = data.result === value;
    return {
      configured,
      urlPresent,
      tokenPresent,
      kvOk,
      detail: kvOk
        ? "KV read/write round trip succeeded — durable storage is live."
        : "KV responded but the value did not read back correctly.",
    };
  } catch (err) {
    return {
      configured,
      urlPresent,
      tokenPresent,
      kvOk: false,
      detail: `KV request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function playerKey(email: string): string {
  return `player:${email.trim().toLowerCase()}`;
}

export async function getPlayer(email: string): Promise<PlayerRecord | null> {
  const raw = await rawGet(playerKey(email));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlayerRecord;
  } catch {
    return null;
  }
}

export async function savePlayer(player: PlayerRecord): Promise<void> {
  await rawSet(playerKey(player.email), JSON.stringify(player));
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const raw = await rawGet(LEADERBOARD_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LeaderboardEntry[]) : [];
  } catch {
    return [];
  }
}

// Upsert one player's summary into the leaderboard index. Called on every game
// completion so the board can be rendered (and read externally) without
// scanning every player key.
export async function upsertLeaderboardEntry(
  entry: LeaderboardEntry,
): Promise<void> {
  const board = await getLeaderboard();
  const email = entry.email.trim().toLowerCase();
  const idx = board.findIndex((e) => e.email.trim().toLowerCase() === email);
  if (idx >= 0) board[idx] = entry;
  else board.push(entry);
  await rawSet(LEADERBOARD_KEY, JSON.stringify(board));
}

// Wipe all game data: every player record and the leaderboard. Clears the
// in-memory fallback and, when KV is configured, flushes the store's dedicated
// Redis database. This database is single-purpose (only this app writes to it),
// so a full flush is the reliable way to clear everything without having to
// scan for keys. Guarded by the admin secret at the API layer.
export async function resetAll(): Promise<void> {
  memory.clear();
  if (!isKvConfigured()) return;
  const url = `${kvUrl()}/flushdb`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${kvToken()}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV flush failed (${res.status})`);
}
