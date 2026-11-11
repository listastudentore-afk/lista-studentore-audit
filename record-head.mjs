#!/usr/bin/env node
// Appends the current head of each chain to its CSV: get_audit_head() → heads.csv,
// get_tirana_audit_head() → tirana-heads.csv. Run every hour by .github/workflows/hourly-hash.yml.
// Each chain is recorded on its own: if one cannot be read, the other is still written, and the script
// exits 1 so the run shows red.
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHAINS, HEADS_COLUMNS, HEX64, here, rpc } from "./lib.mjs";

let failed = false;
for (const chain of Object.values(CHAINS)) {
  try {
    const head = await rpc(chain.headRpc);
    // Only well-formed values reach the CSV: the file is the public record.
    const ok = Number.isSafeInteger(head.latest_id) && head.latest_id >= 0
      && (HEX64.test(head.latest_hash) || (head.latest_id === 0 && head.latest_hash === "GENESIS"))
      && Number.isSafeInteger(head.log_rows) && Number.isSafeInteger(head.total_votes)
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(head.generated_at);
    if (!ok) throw new Error(`Unexpected ${chain.headRpc}() answer: ${JSON.stringify(head)}`);

    const file = join(here, chain.headsFile);
    if (!existsSync(file)) writeFileSync(file, HEADS_COLUMNS.join(",") + "\n");
    const recordedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const row = [recordedAt, head.latest_id, head.latest_hash, head.log_rows, head.total_votes, head.generated_at];
    appendFileSync(file, row.join(",") + "\n");
    console.log(`${chain.headsFile}: ${row.join(",")}`);
  } catch (err) {
    failed = true;
    console.error(`${chain.title}: ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
