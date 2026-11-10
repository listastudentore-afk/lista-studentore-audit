#!/usr/bin/env node
// Lista Studentore: independent recount of the public vote log. Node 18+, no dependencies.
//   node verify.mjs                  check the chain, recount, compare with the published totals and heads.csv
//   node verify.mjs --heads FILE     use another heads.csv (for example an older copy you saved yourself)
//   node verify.mjs --no-heads       skip the heads.csv check
//   node verify.mjs --save FILE      also save everything that was downloaded, as JSON
// Exit code 0 = PASS, 1 = FAIL, 2 = could not download.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HEADS_COLUMNS, HEX64, here, rpc } from "./lib.mjs";

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const headsFile = args.includes("--no-heads") ? null : option("--heads") ?? join(here, "heads.csv");
const saveFile = option("--save");

const ACTIONS = new Set(["snapshot", "insert", "delete"]);
const HOUR = /^\d{4}-\d{2}-\d{2}T\d{2}:00:00Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_VOTES = 3;

const failures = [];
const warnings = [];
const fail = msg => failures.push(msg);
const warn = msg => warnings.push(msg);
const sha256 = text => createHash("sha256").update(text, "utf8").digest("hex");

/** The exact text that is hashed; documented in README.md. */
export function rowHash(r) {
  return sha256([r.prev_hash, r.id, r.action, r.voter_hash, r.nomination_id, r.occurred_at].join("|"));
}

async function download() {
  // Totals first: they name the log prefix (as_of_log_id) they were counted from.
  const totals = await rpc("get_vote_totals");
  const log = [];
  for (let after = 0; ;) {
    const page = await rpc("get_audit_log", { after_id: after, page_size: 5000 });
    if (!page.length) break;
    log.push(...page);
    after = page[page.length - 1].id;
  }
  const head = await rpc("get_audit_head");
  return { totals, log, head };
}

function checkChain(log) {
  let prev = "GENESIS";
  let lastId = 0;
  let live = false;
  for (const r of log) {
    const at = `row ${r.id}`;
    if (!Number.isSafeInteger(r.id) || r.id <= lastId) fail(`${at}: id does not increase (previous ${lastId})`);
    if (r.prev_hash !== prev) fail(`${at}: prev_hash does not match the previous row_hash, the chain is broken`);
    if (rowHash(r) !== r.row_hash) fail(`${at}: row_hash does not match its content, the row was changed`);
    if (!ACTIONS.has(r.action)) fail(`${at}: unknown action "${r.action}"`);
    if (r.action === "snapshot" && live) fail(`${at}: snapshot row after the genesis snapshot`);
    if (r.action !== "snapshot") live = true;
    if (!HEX64.test(r.voter_hash)) fail(`${at}: voter_hash is not 64 hex characters`);
    if (!UUID.test(r.nomination_id)) fail(`${at}: nomination_id is not a lowercase uuid`);
    if (!HOUR.test(r.occurred_at)) fail(`${at}: occurred_at is not a whole UTC hour`);
    prev = r.row_hash;
    lastId = r.id;
  }
}

/** Replays the log up to asOf; returns current votes per candidate. */
function recount(log, asOf) {
  const votes = new Set();
  const perCandidate = new Map();
  const perVoter = new Map();
  const add = (map, k, d) => map.set(k, (map.get(k) ?? 0) + d);
  for (const r of log) {
    if (r.id > asOf) break;
    const vote = `${r.voter_hash}|${r.nomination_id}`;
    if (r.action === "delete") {
      if (!votes.delete(vote)) { fail(`row ${r.id}: removes a vote that the log never added`); continue; }
      add(perCandidate, r.nomination_id, -1);
      add(perVoter, r.voter_hash, -1);
      continue;
    }
    if (votes.has(vote)) { fail(`row ${r.id}: the same voter votes twice for one candidate`); continue; }
    votes.add(vote);
    add(perCandidate, r.nomination_id, 1);
    add(perVoter, r.voter_hash, 1);
    if (perVoter.get(r.voter_hash) > MAX_VOTES) {
      // The genesis snapshot shows the state as it was; only new votes are held to the limit.
      (r.action === "snapshot" ? warn : fail)(`row ${r.id}: a voter holds more than ${MAX_VOTES} votes`);
    }
  }
  return { total: votes.size, perCandidate };
}

function compareTotals(totals, counted) {
  if (counted.total !== totals.total_votes) {
    fail(`total votes: the database says ${totals.total_votes}, the log gives ${counted.total}`);
  }
  const approved = new Set();
  for (const c of totals.candidates) {
    approved.add(c.nomination_id);
    const n = counted.perCandidate.get(c.nomination_id) ?? 0;
    if (n !== c.vote_count) fail(`${c.name} (${c.nomination_id}): published ${c.vote_count}, the log gives ${n}`);
  }
  for (const [id, n] of counted.perCandidate) {
    if (n > 0 && !approved.has(id)) warn(`${n} vote(s) in the log for ${id}, which is not an approved candidate`);
  }
}

function checkHead(head, byId, lastId) {
  if (head.latest_id > lastId) return; // new votes arrived while downloading
  const row = byId.get(head.latest_id);
  const hash = head.latest_id === 0 ? "GENESIS" : row?.row_hash;
  if (hash !== head.latest_hash) fail(`get_audit_head(): hash for id ${head.latest_id} is not the one in the log`);
  const rows = [...byId.keys()].filter(id => id <= head.latest_id).length;
  if (rows !== head.log_rows) fail(`get_audit_head(): says ${head.log_rows} rows up to id ${head.latest_id}, the log has ${rows}`);
}

/** Every head published earlier must still be in the current log, with the same hash. */
function checkPublishedHeads(file, byId, lastId) {
  if (!file || !existsSync(file)) return 0;
  const lines = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  if (lines[0] !== HEADS_COLUMNS.join(",")) { fail(`${file}: unexpected header`); return 0; }
  let checked = 0;
  for (const line of lines.slice(1)) {
    const [recordedAt, idText, hash] = line.split(",");
    const id = Number(idText);
    if (id > lastId) { fail(`head of ${recordedAt} (id ${id}) is beyond the end of the log: rows were removed`); continue; }
    const expected = id === 0 ? "GENESIS" : byId.get(id)?.row_hash;
    if (expected !== hash) fail(`head of ${recordedAt} (id ${id}) no longer matches: history was rewritten after it was published`);
    checked++;
  }
  return checked;
}

async function main() {
  let data;
  try {
    data = await download();
  } catch (err) {
    console.error(`Could not download the log: ${err.message}`);
    process.exit(2);
  }
  const { totals, log, head } = data;
  if (saveFile) writeFileSync(saveFile, JSON.stringify({ downloaded_at: new Date().toISOString(), ...data }, null, 1));

  const lastId = log.length ? log[log.length - 1].id : 0;
  const byId = new Map(log.map(r => [r.id, r]));

  checkChain(log);
  if (totals.as_of_log_id > lastId) fail(`get_vote_totals() counts up to id ${totals.as_of_log_id}, the log ends at ${lastId}`);
  else if (totals.as_of_log_id > 0 && !byId.has(totals.as_of_log_id)) fail(`id ${totals.as_of_log_id} from get_vote_totals() is missing from the log`);
  const counted = recount(log, totals.as_of_log_id);
  compareTotals(totals, counted);
  checkHead(head, byId, lastId);
  const headsChecked = checkPublishedHeads(headsFile, byId, lastId);

  const kinds = { snapshot: 0, insert: 0, delete: 0 };
  for (const r of log) kinds[r.action] = (kinds[r.action] ?? 0) + 1;
  console.log("Lista Studentore: vote log verification");
  console.log(`  log rows        ${log.length} (snapshot ${kinds.snapshot}, insert ${kinds.insert}, delete ${kinds.delete}), last id ${lastId}`);
  console.log(`  latest hash     ${log.length ? log[log.length - 1].row_hash : "GENESIS"}`);
  console.log(`  recounted       ${counted.total} votes up to id ${totals.as_of_log_id}; database says ${totals.total_votes}`);
  console.log(`  candidates      ${totals.candidates.length} approved, each compared with the recount`);
  console.log(`  published heads ${headsChecked} checked${headsFile && existsSync(headsFile) ? ` (${headsFile})` : " (no heads.csv)"}`);
  const show = (label, list) => {
    if (!list.length) return;
    console.log(`\n${label} (${list.length}):`);
    for (const m of list.slice(0, 50)) console.log(`  - ${m}`);
    if (list.length > 50) console.log(`  ... ${list.length - 50} more`);
  };
  show("WARNINGS", warnings);
  show("FAILURES", failures);
  console.log(failures.length ? "\nFAIL" : "\nPASS");
  process.exit(failures.length ? 1 : 0);
}

main();
