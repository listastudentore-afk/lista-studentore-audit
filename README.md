### Ndryshime

2026-11-13: Opsioni `goxhaj` u hoq me kërkesë të personit. Votat ekzistuese u fshinë përmes rrugës normale; rreshtat `delete` mbeten në regjistrin e auditimit, bashkë me historikun e mëparshëm.

 Lista Studentore: verifikimi publik i votave / public vote verification

[Shqip](#shqip) · [English](#english)

---

## Shqip

### Çfarë publikohet

Votat në [listastudentore.com](https://listastudentore.com) shkruhen automatikisht nga databaza në dy regjistra
publikë, secili një zinxhir më vete:

- `vote_audit_log`: renditja kryesore e kandidatëve; gjurmët e çdo ore në `heads.csv`;
- `tirana_audit_log`: sondazhi Tirana 2027; gjurmët e çdo ore në `tirana-heads.csv`.

Çdo rresht përmban:

| fusha | çfarë është |
|---|---|
| `id` | numër rendor (rritet gjithmonë; mund të kapërcejë numra kur një votë dështon) |
| `action` | `snapshot` (vota ekzistuese ditën kur nisi regjistri), `insert` (votë e re), `delete` (votë e hequr) |
| `voter_hash` | një kod i rastësishëm për çdo votues, i njëjtë për të gjitha votat e tij. **Nuk** është emaili dhe nuk mund të kthehet në email |
| `nomination_id` | kandidati (vetëm te `vote_audit_log`) |
| `option_id` | zgjedhja në Tirana 2027 (vetëm te `tirana_audit_log`): `alimehmeti`, `hasimja`, `binaj`, `qori`, `pashaj`, `bojaxhi` ose `none` ("Asnjërin prej tyre") |
| `occurred_at` | vetëm ora (UTC), pa minuta: p.sh. çdo votë nga 14:00 deri 14:59 shënohet `14:00:00Z` |
| `prev_hash`, `row_hash` | "gjurma" që lidh çdo rresht me të mëparshmin |

Asnjë email, ID përdoruesi apo IP nuk publikohet.

Çdo rresht përmban gjurmën e rreshtit para tij. Nëse dikush ndryshon, fshin ose fut një rresht në mes,
gjurmët pas tij nuk përputhen më. Çdo orë, ky repo ruan gjurmën e fundit të secilit regjistër në `heads.csv` dhe
`tirana-heads.csv` (me commit në GitHub, me datë dhe orë). Kështu, edhe ne vetë nuk mund ta rishkruajmë historinë
pa u vënë re.

### Si ta verifikosh vetë

Mënyra më e lehtë: hap [listastudentore.com/verifiko](https://listastudentore.com/verifiko) dhe shtyp
**Verifiko tani**. Shfletuesi yt bën të njëjtat kontrolle si `verify.mjs`, për të dy regjistrat, dhe i merr gjurmët
direkt nga ky repo.

Pa iu besuar kodit të faqes: të duhet vetëm [Node.js](https://nodejs.org) 18 ose më i ri. Nuk ka asnjë paketë për
të instaluar.

```sh
git clone https://github.com/listastudentore-afk/lista-studentore-audit.git
cd lista-studentore-audit
node verify.mjs
```

Skripti, për secilin regjistër:

1. shkarkon gjithë regjistrin dhe numrat aktualë të votave (me çelësin publik të faqes);
2. rillogarit çdo gjurmë dhe kontrollon që zinxhiri është i pandërprerë;
3. rinumëron votat për çdo kandidat ose zgjedhje duke ndjekur `snapshot`, `insert` dhe `delete` me radhë;
4. i krahason me numrat që shfaq faqja;
5. kontrollon që çdo gjurmë e publikuar më parë në `heads.csv` / `tirana-heads.csv` ndodhet ende në regjistër,
   e pandryshuar.

Në fund shkruan **PASS** ose **FAIL** me arsyen. `node verify.mjs --chain main` ose `--chain tirana` kontrollon
vetëm njërin. `node verify.mjs --save regjistri.json` ruan edhe një kopje të gjithë asaj që u shkarkua.

### Çfarë provon

- Numri i votave që shfaq faqja për çdo kandidat është i njëjtë me numërimin e regjistrit publik.
- Pasi një gjurmë publikohet këtu, asnjë votë e mëparshme nuk mund të ndryshohet, fshihet ose shtohet pa u
  zbuluar, as nga ne.
- Askush (as ne) nuk mund të shtojë vota në renditje pa i shfaqur edhe në regjistrin publik, sepse numërimi
  nuk do të përputhej. (Kjo nuk do të thotë se votat janë të vërteta: shih më poshtë.)
- Asnjë votues nuk ka më shumë se 3 vota njëkohësisht në renditje, as më shumë se 1 votë në Tirana 2027, dhe
  askush nuk ka votuar dy herë për të njëjtin kandidat.
- E njëjta vlen për Tirana 2027: numri për çdo zgjedhje është i njëjtë me numërimin e `tirana_audit_log`.

### Çfarë NUK provon

- **Para gjurmës së parë publike**, pronari i databazës mund ta kishte ndërtuar gjithë zinxhirin nga e para.
  Gjendja e nisjes (`snapshot`) është ajo që kishte databaza atë ditë; nuk mund të provohet se votat para saj
  ishin të sakta. Pas commit-it të parë në `heads.csv`, rishkrimi i historisë zbulohet.
- **Edhe pas kësaj**, pronari i databazës mund të ndryshojë votat më të reja deri në commit-in e radhës, pra
  deri në rreth 1 orë. (GitHub ndonjëherë e vonon ose e kapërcen një ekzekutim të planifikuar; atëherë dritarja
  zgjatet deri në commit-in e ardhshëm.) Mbrojtja vlen për gjithçka para gjurmës së fundit të publikuar.
- **Llogaritë false nuk ndalohen.** Votimi kërkon një llogari Google, por një person me shumë llogari Google
  mund të votojë me secilën. Regjistri e bën këtë të dukshëm vetëm si model (p.sh. shumë vota të reja për një
  kandidat brenda së njëjtës orë), jo të pamundur.
- **Pronari i databazës mund të krijojë vota nga votues të shpikur**, pa llogari Google. Ato hyjnë në regjistër
  si vota të zakonshme dhe zinxhiri mbetet i saktë. Regjistri provon që çdo votë e numëruar është publike dhe
  nuk ndryshohet më pas; nuk provon që pas çdo `voter_hash` ka një person.
- **Nuk provon që votuesit janë njerëz realë apo studentë**, as që një votë i përket një personi të caktuar.
- **Një votues nuk mund ta gjejë vetë votën e tij** në regjistër, sepse kodi `voter_hash` llogaritet me një
  sekret që nuk publikohet.
- **Kodi `voter_hash` lidh votat e të njëjtit person brenda një regjistri.** Koha ruhet vetëm me orë, por kur
  votojnë pak njerëz brenda një ore, dikush që di orën kur votoi një mik mund ta dallojë kodin e tij dhe të shohë
  edhe votat e tjera të tij në renditje. Dy regjistrat përdorin sekrete të ndryshme, ndaj i njëjti person ka kod
  tjetër në Tirana 2027 dhe regjistrat nuk mund të lidhen me njëri-tjetrin.
- **Ne mund ta fikim regjistrin.** Pronari i databazës ka gjithmonë akses të plotë. Por çdo votë e futur pa
  regjistër bën që numërimi të mos përputhet, dhe `verify.mjs` shfaq FAIL.
- **Nuk mbulon** sondazhet për persona, sondazhin për deputetët dhe drejtuesit e partive (`politikane-2026`) dhe
  as votat "Para verifikimit", të cilat shfaqen veçmas dhe nuk llogariten në renditje.
- **Te Tirana 2027, regjistri nis ditën kur u shtua** (migrimi 38). Votat e hequra apo të ndryshuara para asaj
  dite nuk duken; `snapshot` tregon vetëm gjendjen e asaj dite.
- **Nuk provon që kodi i faqes është ai që thotë se është.** Kontrollohet rezultati, jo serveri.

---

## English

### What is published

Votes on [listastudentore.com](https://listastudentore.com) are written automatically by the database to two
public logs, each its own chain:

- `vote_audit_log`: the main candidate ranking; hourly fingerprints in `heads.csv`;
- `tirana_audit_log`: the Tirana 2027 poll; hourly fingerprints in `tirana-heads.csv`.

Each row contains:

| field | meaning |
|---|---|
| `id` | sequence number (always increasing; may skip numbers when a vote fails) |
| `action` | `snapshot` (votes that existed the day the log started), `insert` (new vote), `delete` (vote removed) |
| `voter_hash` | a random-looking code per voter, the same for all of that voter's votes. **Not** the email, and it cannot be turned back into one |
| `nomination_id` | the candidate (`vote_audit_log` only) |
| `option_id` | the Tirana 2027 choice (`tirana_audit_log` only): `alimehmeti`, `hasimja`, `binaj`, `qori`, `pashaj`, `bojaxhi` or `none` ("none of them") |
| `occurred_at` | the hour only (UTC), no minutes: every vote from 14:00 to 14:59 is recorded as `14:00:00Z` |
| `prev_hash`, `row_hash` | the fingerprint that links each row to the one before it |

No emails, user ids or IP addresses are published.

Every row includes the fingerprint of the row before it. If anyone changes, deletes or inserts a row in the
middle, every fingerprint after it stops matching. Every hour, this repository records the latest fingerprint of
each log in `heads.csv` and `tirana-heads.csv` as a timestamped GitHub commit, so not even we can rewrite history
without it being detected.

### How to verify it yourself

Easiest: open [listastudentore.com/verifiko](https://listastudentore.com/verifiko) and press **Verifiko tani**.
Your browser runs the same checks as `verify.mjs` on both logs and takes the fingerprints straight from this
repository.

Without trusting the site's code: you only need [Node.js](https://nodejs.org) 18 or newer. There is nothing to
install.

```sh
git clone https://github.com/listastudentore-afk/lista-studentore-audit.git
cd lista-studentore-audit
node verify.mjs
```

For each log, the script:

1. downloads the whole log and the current vote counts, using the site's public key;
2. recomputes every fingerprint and checks the chain is unbroken;
3. recounts the votes per candidate or option by replaying `snapshot`, `insert` and `delete` in order;
4. compares the recount with the numbers the site shows;
5. checks that every fingerprint published earlier in `heads.csv` / `tirana-heads.csv` is still in the log,
   unchanged.

It ends with **PASS** or **FAIL** and the reason. Exit code: 0 = PASS, 1 = FAIL, 2 = download error.
`node verify.mjs --chain main` or `--chain tirana` checks only one log.
`node verify.mjs --save log.json` also keeps a copy of everything it downloaded. Keep your own copies of
`heads.csv` too: they are evidence that does not depend on this repository.

### What it proves

- The vote count the site shows for each candidate equals a recount of the public log.
- After a fingerprint is published here, no vote from before that moment can be changed, removed or added
  without detection, including by us.
- Nobody, including us, can add votes to the ranking without them also showing in the public log, because
  the recount would no longer match. (That does not make the votes genuine: see below.)
- No voter holds more than 3 votes at once in the ranking or more than 1 in Tirana 2027, and nobody voted twice
  for the same candidate.
- The same holds for Tirana 2027: each option's count equals a recount of `tirana_audit_log`.

### What it does NOT prove

- **Before the first public fingerprint**, the database owner could have built the whole chain from scratch.
  The starting state (`snapshot`) is whatever the database held that day; nothing proves the votes before it
  were correct. After the first commit to `heads.csv`, rewriting history is detectable.
- **Even after that**, the database owner can change the newest votes until the next commit, which is up to
  about 1 hour. (GitHub sometimes delays or skips a scheduled run; the window then lasts until the next
  commit.) The protection covers everything before the latest published fingerprint.
- **Fake accounts are not prevented.** Voting requires a Google account, but one person with many Google
  accounts can vote with each. The log only makes this visible as a pattern (for example many new votes for
  one candidate within the same hour); it does not make it impossible.
- **The database owner can create votes from invented voters**, with no Google account at all. They enter
  the log as ordinary new votes and the chain stays valid. The log proves every counted vote is public and is
  not changed afterwards; it does not prove there is a person behind each `voter_hash`.
- **It does not prove that voters are real people or students**, or that a vote belongs to a given person.
- **A voter cannot find their own vote** in the log, because `voter_hash` uses a secret that is not published.
- **`voter_hash` links the votes of the same person within one log.** Time is kept only to the hour, but when
  few people vote in a given hour, someone who knows the hour a friend voted may pick out that friend's code and
  see their other ranking votes. The two logs use different secrets, so the same person has a different code in
  Tirana 2027 and the logs cannot be joined.
- **We could switch the log off.** The database owner always has full access. But any vote added without the
  log makes the recount disagree, and `verify.mjs` reports FAIL.
- **Not covered:** the person polls, the poll about MPs and party leaders (`politikane-2026`) and the
  "Para verifikimit" votes, which are shown separately and never counted in the ranking.
- **For Tirana 2027, the log starts on the day it was added** (migration 38). Votes withdrawn or changed before
  that day are not visible; `snapshot` only shows the state on that day.
- **It does not prove the website runs the code it claims.** It checks the result, not the server.

---

## Technical reference

### Hash format

All hashes are SHA-256, written as 64 lowercase hex characters, computed over the UTF-8 bytes of the text.

```
row_hash = sha256( prev_hash | id | action | voter_hash | nomination_id | occurred_at )
```

joined with a single `|` and no spaces, where:

- `prev_hash` is `GENESIS` for the first row, otherwise the previous row's `row_hash`
- `id` is a decimal number with no padding (`1`, `2`, `17`)
- `action` is `snapshot`, `insert` or `delete`
- `voter_hash` is 64 lowercase hex characters
- `nomination_id` is a lowercase UUID with dashes
- `occurred_at` is UTC, truncated to the hour: `YYYY-MM-DDTHH:00:00Z`

For `tirana_audit_log` the format is identical, with `option_id` in place of `nomination_id`:

```
row_hash = sha256( prev_hash | id | action | voter_hash | option_id | occurred_at )
```

Historical entries for the removed `goxhaj` option, including its deletes, remain valid and must still be hashed.

The current option keys are (`alimehmeti`, `hasimja`, `binaj`, `qori`, `pashaj`, `bojaxhi`, `none`). The two logs
are separate chains: each has its own `GENESIS`, its own ids starting at 1 and its own head.

Rows are hashed in `id` order. Gaps in `id` are normal (a rolled-back vote uses up a number). A gap in the
chain is not: every `prev_hash` must equal the previous row's `row_hash`.

Example (from a test database):

```
GENESIS|1|snapshot|72ac1d4c5d03367176f8b4b36d86d724270dbdec0edb391fc044c08b28e4388a|aaaaaaaa-0000-4000-8000-000000000001|2026-11-01T10:00:00Z
```

```sh
printf '%s' 'GENESIS|1|snapshot|72ac1d4c5d03367176f8b4b36d86d724270dbdec0edb391fc044c08b28e4388a|aaaaaaaa-0000-4000-8000-000000000001|2026-11-01T10:00:00Z' | sha256sum
# b1640e528e8d089b192a3e67235cb470da652cb3dc1b541c72e939fa72704c36
```

`voter_hash = sha256(salt || voter_uuid)`, where `salt` is a random 32-byte secret kept in the database and
never published. It cannot be recomputed from outside; it is only compared for equality. `tirana_audit_log` uses
its own, separate secret salt, so the same person has a different `voter_hash` in each log.

### Public functions

All are `POST {SUPABASE_URL}/rest/v1/rpc/<name>` with header `apikey: <publishable key>` and a JSON body.

| function | returns |
|---|---|
| `get_audit_head()` | `{ latest_id, latest_hash, log_rows, total_votes, generated_at }` |
| `get_audit_log({ after_id, page_size })` | log rows with `id > after_id`, ordered by `id`; `page_size` at most 5000. The server may return fewer: keep paging from the last `id` you received until a page is empty |
| `get_vote_totals()` | `{ as_of_log_id, total_votes, candidates: [{ nomination_id, name, vote_count }] }` for approved candidates; the counts match the log up to `as_of_log_id` exactly |
| `get_tirana_audit_head()` | the same as `get_audit_head()`, for `tirana_audit_log` |
| `get_tirana_audit_log({ after_id, page_size })` | the same as `get_audit_log()`, with `option_id` instead of `nomination_id` |
| `get_tirana_totals()` | `{ as_of_log_id, total_votes, options: [{ option_id, name, vote_count }] }`: every option on the ballot (also with 0 votes), in ballot order |

### Files

| file | purpose |
|---|---|
| `verify.mjs` | full recount and check |
| `record-head.mjs` | appends the current `get_audit_head()` to `heads.csv` and `get_tirana_audit_head()` to `tirana-heads.csv` |
| `heads.csv` | main ranking, one row per hour: `recorded_at,latest_id,latest_hash,log_rows,total_votes,generated_at` |
| `tirana-heads.csv` | Tirana 2027, same columns |
| `config.json` | the site's public Supabase URL and publishable key (the same ones every visitor's browser uses) |
| `.github/workflows/hourly-hash.yml` | runs `record-head.mjs` every hour, commits both CSV files as the generic `github-actions[bot]`, then runs `verify.mjs` |

To test against another database, set `AUDIT_SUPABASE_URL` and `AUDIT_SUPABASE_KEY`.


## status.json — gjendja e kontrollit / verification status

**Shqip.** Pas regjistrimit të `heads.csv` dhe `tirana-heads.csv`, workflow-i orar ekzekuton
`node verify.mjs --status status.json` për të dy zinxhirët. Skedari publikohet në të njëjtin commit
me gjurmët, edhe kur kontrolli dështon; më pas workflow-i mbetet me gabim. `FAIL` nuk fshihet.
`checked_at` është koha UTC kur përfundoi kontrolli, `main` / `tirana` janë `PASS` ose `FAIL`,
`main_votes` / `tirana_votes` janë votat e rinumëruara, dhe `heads_checked` është shuma e gjurmëve
të kontrolluara në të dy skedarët CSV. Një gabim shkarkimi shënohet `FAIL`, me 0 vota për zinxhirin
që nuk u lexua (0 nuk është pretendim për numrin real të votave). Pa gjurmë të publikuara nuk jepet `PASS`.
Faqja lexon këtë përmbledhje një herë në ngarkim; një kontroll më i vjetër se 3 orë shfaqet portokalli,
`FAIL` i cilitdo zinxhir shfaqet i kuq edhe kur është i vjetër, dhe një skedar që mungon ose është i pavlefshëm
nuk shfaq status. `/verifiko` bën kontrollin e plotë kur e kërkon përdoruesi. Përmbledhja orare
nuk është kontroll në kohë reale dhe nuk zëvendëson rinumërimin e pavarur.

**English.** After recording both heads files, the hourly workflow runs
`node verify.mjs --status status.json` for both chains. It commits the status together with the heads,
even on verification failure, then the run remains failed. FAIL is public information.
`checked_at` is the UTC completion time; `main` / `tirana` are `PASS` or `FAIL`;
`main_votes` / `tirana_votes` are recounted active votes; `heads_checked` sums the checked CSV heads
across both chains. A download error yields FAIL and a zero count for the unread chain; that zero is
not a claim about the real vote total. Status mode requires at least one published head per chain for PASS.
The site fetches this snapshot once per page load, marks checks older than three hours orange, gives
FAIL priority in red, and hides missing or invalid status. `/verifiko` provides the full on-demand check.
This hourly summary is not real-time verification and does not replace independent recounting.

```json
{"checked_at":"2026-11-12T10:20:00.000Z","main":"PASS","tirana":"PASS","main_votes":12345,"tirana_votes":130,"heads_checked":48}
```
