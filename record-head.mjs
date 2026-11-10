#!/usr/bin/env node
// Appends the current get_audit_head() to heads.csv. Run every hour by .github/workflows/hourly-hash.yml.
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HEADS_COLUMNS, HEX64, here, rpc } from "./lib.mjs";

const file = join(here, "heads.csv");
const head = await rpc("get_audit_head");

// Only well-formed values reach the CSV: the file is the public record.
const ok = Number.isSafeInteger(head.latest_id) && head.latest_id >= 0
  && (HEX64.test(head.latest_hash) || (head.latest_id === 0 && head.latest_hash === "GENESIS"))
  && Number.isSafeInteger(head.log_rows) && Number.isSafeInteger(head.total_votes)
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(head.generated_at);
if (!ok) throw new Error(`Unexpected get_audit_head() answer: ${JSON.stringify(head)}`);

if (!existsSync(file)) writeFileSync(file, HEADS_COLUMNS.join(",") + "\n");
const recordedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const row = [recordedAt, head.latest_id, head.latest_hash, head.log_rows, head.total_votes, head.generated_at];
appendFileSync(file, row.join(",") + "\n");
console.log(row.join(","));
