#!/usr/bin/env node
// Lista Studentore: independent recount of the public vote logs. Node 18+, no dependencies.
// Two separate chains: the main ranking (heads.csv) and Tirana 2027 (tirana-heads.csv).
//   node verify.mjs                     check both chains, recount, compare with the published totals and heads
//   node verify.mjs --chain main        only the main ranking (or: --chain tirana)
//   node verify.mjs --heads FILE        use another heads.csv for the main ranking (for example a copy you saved)
//   node verify.mjs --tirana-heads FILE the same for tirana-heads.csv
//   node verify.mjs --no-heads          skip the published-heads check
//   node verify.mjs --save FILE         also save everything that was downloaded, as JSON
// Exit code 0 = PASS, 1 = FAIL, 2 = could not download.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHAINS, HEADS_COLUMNS, here, rpc } from "./lib.mjs";

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const only = option("--chain");
if (only && !CHAINS[only]) {
  console.error(`--chain must be one of: ${Object.keys(CHAINS).join(", ")}`);
  process.exit(2);
}
const noHeads = args.includes("--no-heads");
const headsFor = {
  main: noHeads ? null : option("--heads") ?? join(here, CHAINS.main.headsFile),
  tirana: noHeads ? null : option("--tirana-heads") ?? join(here, CHAINS.tirana.headsFile),
};
const saveFile = option("--save");

const ACTIONS = new Set(["snapshot", "insert", "delete"]);
const HOUR = /^\d{4}-\d{2}-\d{2}T\d{2}:00:00Z$/;
const HEX64 = /^[0-9a-f]{64}$/;
const sha256 = text => createHash("sha256").update(text, "utf8").digest("hex");

/** The exact text that is hashed; documented in README.md. `item` is nomination_id or option_id. */
export function rowHash(r, itemKey = "nomination_id") {
  return sha256([r.prev_hash, r.id, r.action, r.voter_hash, r[itemKey], r.occurred_at].join("|"));
}

async function download(chain) {
  // Totals first: they name the log prefix (as_of_log_id) they were counted from.
  const totals = await rpc(chain.totalsRpc);
  const log = [];
  for (let after = 0; ;) {
    const page = await rpc(chain.logRpc, { after_id: after, page_size: 5000 });
    if (!page.length) break;
    log.push(...page);
    after = page[page.length - 1].id;
  }
  const head = await rpc(chain.headRpc);
  return { totals, log, head };
}

/** All checks for one chain; returns what it found, prints nothing. */
function check(chain, { totals, log, head }, headsFile) {
  const failures = [];
  const warnings = [];
  const fail = msg => failures.push(msg);
  const warn = msg => warnings.push(msg);
  const key = chain.itemKey;

  // ---- chain ----
  let prev = "GENESIS";
  let lastSeen = 0;
  let live = false;
  for (const r of log) {
    const at = `row ${r.id}`;
    if (!Number.isSafeInteger(r.id) || r.id <= lastSeen) fail(`${at}: id does not increase (previous ${lastSeen})`);
    if (r.prev_hash !== prev) fail(`${at}: prev_hash does not match the previous row_hash, the chain is broken`);
    if (rowHash(r, key) !== r.row_hash) fail(`${at}: row_hash does not match its content, the row was changed`);
    if (!ACTIONS.has(r.action)) fail(`${at}: unknown action "${r.action}"`);
    if (r.action === "snapshot" && live) fail(`${at}: snapshot row after the genesis snapshot`);
    if (r.action !== "snapshot") live = true;
    if (!HEX64.test(r.voter_hash)) fail(`${at}: voter_hash is not 64 hex characters`);
    if (!chain.itemPattern.test(r[key])) fail(`${at}: ${key} is not ${chain.itemRule}`);
    if (!HOUR.test(r.occurred_at)) fail(`${at}: occurred_at is not a whole UTC hour`);
    prev = r.row_hash;
    lastSeen = r.id;
  }

  const lastId = log.length ? log[log.length - 1].id : 0;
  const byId = new Map(log.map(r => [r.id, r]));
  const fn = `${chain.totalsRpc}()`;
  if (totals.as_of_log_id > lastId) fail(`${fn} counts up to id ${totals.as_of_log_id}, the log ends at ${lastId}`);
  else if (totals.as_of_log_id > 0 && !byId.has(totals.as_of_log_id)) fail(`id ${totals.as_of_log_id} from ${fn} is missing from the log`);

  // ---- recount: replay the log up to as_of_log_id ----
  const votes = new Set();
  const perItem = new Map();
  const perVoter = new Map();
  const add = (map, k, d) => map.set(k, (map.get(k) ?? 0) + d);
  for (const r of log) {
    if (r.id > totals.as_of_log_id) break;
    const vote = `${r.voter_hash}|${r[key]}`;
    if (r.action === "delete") {
      if (!votes.delete(vote)) { fail(`row ${r.id}: removes a vote that the log never added`); continue; }
      add(perItem, r[key], -1);
      add(perVoter, r.voter_hash, -1);
      continue;
    }
    if (votes.has(vote)) { fail(`row ${r.id}: the same voter votes twice for one ${chain.item}`); continue; }
    votes.add(vote);
    add(perItem, r[key], 1);
    add(perVoter, r.voter_hash, 1);
    if (perVoter.get(r.voter_hash) > chain.maxVotes) {
      // The genesis snapshot shows the state as it was; only new votes are held to the limit.
      (r.action === "snapshot" ? warn : fail)(`row ${r.id}: a voter holds more than ${chain.maxVotes} ${chain.maxVotes === 1 ? "vote" : "votes"}`);
    }
  }
  const recounted = votes.size;

  // ---- compare with the published totals ----
  if (recounted !== totals.total_votes) fail(`total votes: the database says ${totals.total_votes}, the log gives ${recounted}`);
  const listed = new Set();
  for (const c of totals[chain.itemsKey]) {
    listed.add(c[key]);
    const n = perItem.get(c[key]) ?? 0;
    if (n !== c.vote_count) fail(`${c.name} (${c[key]}): published ${c.vote_count}, the log gives ${n}`);
  }
  for (const [id, n] of perItem) {
    if (n > 0 && !listed.has(id)) warn(`${n} vote(s) in the log for ${id}, ${chain.notListed}`);
  }

  // ---- live head ----
  if (head.latest_id <= lastId) { // otherwise new votes arrived while downloading
    const row = byId.get(head.latest_id);
    const hash = head.latest_id === 0 ? "GENESIS" : row?.row_hash;
    if (hash !== head.latest_hash) fail(`${chain.headRpc}(): hash for id ${head.latest_id} is not the one in the log`);
    const rows = [...byId.keys()].filter(id => id <= head.latest_id).length;
    if (rows !== head.log_rows) fail(`${chain.headRpc}(): says ${head.log_rows} rows up to id ${head.latest_id}, the log has ${rows}`);
  }

  // ---- every head published earlier must still be in the current log, with the same hash ----
  let headsChecked = 0;
  if (headsFile && existsSync(headsFile)) {
    const lines = readFileSync(headsFile, "utf8").split(/\r?\n/).filter(Boolean);
    if (lines[0] !== HEADS_COLUMNS.join(",")) fail(`${headsFile}: unexpected header`);
    else for (const line of lines.slice(1)) {
      const [recordedAt, idText, hash] = line.split(",");
      const id = Number(idText);
      if (id > lastId) { fail(`head of ${recordedAt} (id ${id}) is beyond the end of the log: rows were removed`); continue; }
      const expected = id === 0 ? "GENESIS" : byId.get(id)?.row_hash;
      if (expected !== hash) fail(`head of ${recordedAt} (id ${id}) no longer matches: history was rewritten after it was published`);
      headsChecked++;
    }
  }
  return { failures, warnings, recounted, lastId, headsChecked };
}

function report(chain, data, result, headsFile) {
  const { totals, log } = data;
  const kinds = { snapshot: 0, insert: 0, delete: 0 };
  for (const r of log) kinds[r.action] = (kinds[r.action] ?? 0) + 1;
  console.log(`\n== ${chain.title} ==`);
  console.log(`  log rows        ${log.length} (snapshot ${kinds.snapshot}, insert ${kinds.insert}, delete ${kinds.delete}), last id ${result.lastId}`);
  console.log(`  latest hash     ${log.length ? log[log.length - 1].row_hash : "GENESIS"}`);
  console.log(`  recounted       ${result.recounted} votes up to id ${totals.as_of_log_id}; database says ${totals.total_votes}`);
  console.log(`  ${(chain.itemsKey + "         ").slice(0, 15)} ${totals[chain.itemsKey].length} ${chain.countedLabel}, each compared with the recount`);
  console.log(`  published heads ${result.headsChecked} checked${headsFile && existsSync(headsFile) ? ` (${headsFile})` : ` (no ${chain.headsFile})`}`);
  const show = (label, list) => {
    if (!list.length) return;
    console.log(`\n${label} (${list.length}):`);
    for (const m of list.slice(0, 50)) console.log(`  - ${m}`);
    if (list.length > 50) console.log(`  ... ${list.length - 50} more`);
  };
  show("WARNINGS", result.warnings);
  show("FAILURES", result.failures);
  console.log(`  result          ${result.failures.length ? "FAIL" : "PASS"}`);
}

async function main() {
  const names = only ? [only] : Object.keys(CHAINS);
  const downloaded = {};
  for (const name of names) {
    try {
      downloaded[name] = await download(CHAINS[name]);
    } catch (err) {
      console.error(`Could not download the ${CHAINS[name].title} log: ${err.message}`);
      process.exit(2);
    }
  }
  if (saveFile) writeFileSync(saveFile, JSON.stringify({ downloaded_at: new Date().toISOString(), ...downloaded }, null, 1));

  console.log("Lista Studentore: vote log verification");
  let failed = false;
  for (const name of names) {
    const result = check(CHAINS[name], downloaded[name], headsFor[name]);
    report(CHAINS[name], downloaded[name], result, headsFor[name]);
    failed ||= result.failures.length > 0;
  }
  console.log(failed ? "\nFAIL" : "\nPASS");
  process.exit(failed ? 1 : 0);
}

main();
