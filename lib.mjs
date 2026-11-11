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

/** The two independent chains. Same hash format; only the item column, the RPC names and the vote limit differ.
 *  src/auditVerify.ts on the site has the same table: keep them identical. */
export const CHAINS = {
  main: {
    title: "Main ranking",
    headRpc: "get_audit_head", logRpc: "get_audit_log", totalsRpc: "get_vote_totals",
    headsFile: "heads.csv",
    itemKey: "nomination_id", itemsKey: "candidates", item: "candidate", itemRule: "a lowercase uuid",
    itemPattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    notListed: "which is not an approved candidate", countedLabel: "approved",
    maxVotes: 3,
  },
  tirana: {
    title: "Tirana 2027",
    headRpc: "get_tirana_audit_head", logRpc: "get_tirana_audit_log", totalsRpc: "get_tirana_totals",
    headsFile: "tirana-heads.csv",
    itemKey: "option_id", itemsKey: "options", item: "option", itemRule: "a lowercase option key",
    itemPattern: /^[a-z][a-z0-9_-]{0,31}$/,
    notListed: "which is not an option in get_tirana_totals()", countedLabel: "on the ballot",
    maxVotes: 1,
  },
};
