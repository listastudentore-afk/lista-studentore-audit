// Shared by verify.mjs and record-head.mjs. Node 18+, no dependencies.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const here = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(here, "config.json"), "utf8"));

// Environment variables win, so the same files can be pointed at a test database.
const baseUrl = (process.env.AUDIT_SUPABASE_URL ?? config.supabaseUrl).replace(/\/+$/, "");
const key = process.env.AUDIT_SUPABASE_KEY ?? config.publishableKey;

/** Calls a public read-only function with the public (anon/publishable) key. */
export async function rpc(name, body = {}) {
  const headers = { apikey: key, "Content-Type": "application/json", Accept: "application/json" };
  // Legacy anon keys are JWTs and also go in Authorization; sb_publishable_ keys must not.
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
    method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

export const HEADS_COLUMNS = ["recorded_at", "latest_id", "latest_hash", "log_rows", "total_votes", "generated_at"];
export const HEX64 = /^[0-9a-f]{64}$/;
