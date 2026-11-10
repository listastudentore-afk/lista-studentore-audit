# Lista Studentore: verifikimi publik i votave / public vote verification

[Shqip](#shqip) · [English](#english)

---

## Shqip

### Çfarë publikohet

Çdo votë në renditjen kryesore të [listastudentore.com](https://listastudentore.com) shkruhet automatikisht nga
databaza në një regjistër publik (`vote_audit_log`). Çdo rresht përmban:

| fusha | çfarë është |
|---|---|
| `id` | numër rendor (rritet gjithmonë; mund të kapërcejë numra kur një votë dështon) |
| `action` | `snapshot` (vota ekzistuese ditën kur nisi regjistri), `insert` (votë e re), `delete` (votë e hequr) |
| `voter_hash` | një kod i rastësishëm për çdo votues, i njëjtë për të gjitha votat e tij. **Nuk** është emaili dhe nuk mund të kthehet në email |
| `nomination_id` | kandidati |
| `occurred_at` | vetëm ora (UTC), pa minuta: p.sh. çdo votë nga 14:00 deri 14:59 shënohet `14:00:00Z` |
| `prev_hash`, `row_hash` | "gjurma" që lidh çdo rresht me të mëparshmin |

Asnjë email, ID përdoruesi apo IP nuk publikohet.

Çdo rresht përmban gjurmën e rreshtit para tij. Nëse dikush ndryshon, fshin ose fut një rresht në mes,
gjurmët pas tij nuk përputhen më. Çdo orë, ky repo ruan gjurmën e fundit në `heads.csv` (me commit në GitHub,
me datë dhe orë). Kështu, edhe ne vetë nuk mund ta rishkruajmë historinë pa u vënë re.

### Si ta verifikosh vetë

Të duhet vetëm [Node.js](https://nodejs.org) 18 ose më i ri. Nuk ka asnjë paketë për të instaluar.

```sh
git clone https://github.com/listastudentore-afk/lista-studentore-audit.git
cd lista-studentore-audit
node verify.mjs
```

Skripti:

1. shkarkon gjithë regjistrin dhe numrat aktualë të votave (me çelësin publik të faqes);
2. rillogarit çdo gjurmë dhe kontrollon që zinxhiri është i pandërprerë;
3. rinumëron votat për çdo kandidat duke ndjekur `snapshot`, `insert` dhe `delete` me radhë;
4. i krahason me numrat që shfaq faqja;
5. kontrollon që çdo gjurmë e publikuar më parë në `heads.csv` ndodhet ende në regjistër, e pandryshuar.

Në fund shkruan **PASS** ose **FAIL** me arsyen. `node verify.mjs --save regjistri.json` ruan edhe një kopje
të gjithë asaj që u shkarkua.

### Çfarë provon

- Numri i votave që shfaq faqja për çdo kandidat është i njëjtë me numërimin e regjistrit publik.
- Pasi një gjurmë publikohet këtu, asnjë votë e mëparshme nuk mund të ndryshohet, fshihet ose shtohet pa u
  zbuluar, as nga ne.
- Askush (as ne) nuk mund të shtojë vota në renditje pa i shfaqur edhe në regjistrin publik, sepse numërimi
  nuk do të përputhej. (Kjo nuk do të thotë se votat janë të vërteta: shih më poshtë.)
- Asnjë votues nuk ka më shumë se 3 vota njëkohësisht dhe askush nuk ka votuar dy herë për të njëjtin kandidat.

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
- **Kodi `voter_hash` lidh votat e të njëjtit person.** Koha ruhet vetëm me orë, por kur votojnë pak njerëz
  brenda një ore, dikush që di orën kur votoi një mik mund ta dallojë kodin e tij dhe të shohë edhe votat e
  tjera të tij.
- **Ne mund ta fikim regjistrin.** Pronari i databazës ka gjithmonë akses të plotë. Por çdo votë e futur pa
  regjistër bën që numërimi të mos përputhet, dhe `verify.mjs` shfaq FAIL.
- **Nuk mbulon** sondazhet e tjera (sondazhet për persona, Tirana 2027) dhe as votat "Para verifikimit", të
  cilat shfaqen veçmas dhe nuk llogariten në renditje.
- **Nuk provon që kodi i faqes është ai që thotë se është.** Kontrollohet rezultati, jo serveri.

---

## English

### What is published

Every vote in the main ranking on [listastudentore.com](https://listastudentore.com) is written automatically
by the database to a public log (`vote_audit_log`). Each row contains:

| field | meaning |
|---|---|
| `id` | sequence number (always increasing; may skip numbers when a vote fails) |
| `action` | `snapshot` (votes that existed the day the log started), `insert` (new vote), `delete` (vote removed) |
| `voter_hash` | a random-looking code per voter, the same for all of that voter's votes. **Not** the email, and it cannot be turned back into one |
| `nomination_id` | the candidate |
| `occurred_at` | the hour only (UTC), no minutes: every vote from 14:00 to 14:59 is recorded as `14:00:00Z` |
| `prev_hash`, `row_hash` | the fingerprint that links each row to the one before it |

No emails, user ids or IP addresses are published.

Every row includes the fingerprint of the row before it. If anyone changes, deletes or inserts a row in the
middle, every fingerprint after it stops matching. Every hour, this repository records the latest fingerprint
in `heads.csv` as a timestamped GitHub commit, so not even we can rewrite history without it being detected.

### How to verify it yourself

You only need [Node.js](https://nodejs.org) 18 or newer. There is nothing to install.

```sh
git clone https://github.com/listastudentore-afk/lista-studentore-audit.git
cd lista-studentore-audit
node verify.mjs
```

The script:

1. downloads the whole log and the current vote counts, using the site's public key;
2. recomputes every fingerprint and checks the chain is unbroken;
3. recounts the votes per candidate by replaying `snapshot`, `insert` and `delete` in order;
4. compares the recount with the numbers the site shows;
5. checks that every fingerprint published earlier in `heads.csv` is still in the log, unchanged.

It ends with **PASS** or **FAIL** and the reason. Exit code: 0 = PASS, 1 = FAIL, 2 = download error.
`node verify.mjs --save log.json` also keeps a copy of everything it downloaded. Keep your own copies of
`heads.csv` too: they are evidence that does not depend on this repository.

### What it proves

- The vote count the site shows for each candidate equals a recount of the public log.
- After a fingerprint is published here, no vote from before that moment can be changed, removed or added
  without detection, including by us.
- Nobody, including us, can add votes to the ranking without them also showing in the public log, because
  the recount would no longer match. (That does not make the votes genuine: see below.)
- No voter holds more than 3 votes at once, and nobody voted twice for the same candidate.

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
- **`voter_hash` links the votes of the same person.** Time is kept only to the hour, but when few people vote
  in a given hour, someone who knows the hour a friend voted may
  pick out that friend's code and see their other votes.
- **We could switch the log off.** The database owner always has full access. But any vote added without the
  log makes the recount disagree, and `verify.mjs` reports FAIL.
- **Not covered:** the other polls (person polls, Tirana 2027) and the "Para verifikimit" votes, which are
  shown separately and never counted in the ranking.
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
never published. It cannot be recomputed from outside; it is only compared for equality.

### Public functions

All are `POST {SUPABASE_URL}/rest/v1/rpc/<name>` with header `apikey: <publishable key>` and a JSON body.

| function | returns |
|---|---|
| `get_audit_head()` | `{ latest_id, latest_hash, log_rows, total_votes, generated_at }` |
| `get_audit_log({ after_id, page_size })` | log rows with `id > after_id`, ordered by `id`; `page_size` at most 5000. The server may return fewer: keep paging from the last `id` you received until a page is empty |
| `get_vote_totals()` | `{ as_of_log_id, total_votes, candidates: [{ nomination_id, name, vote_count }] }` for approved candidates; the counts match the log up to `as_of_log_id` exactly |

### Files

| file | purpose |
|---|---|
| `verify.mjs` | full recount and check |
| `record-head.mjs` | appends the current `get_audit_head()` to `heads.csv` |
| `heads.csv` | one row per hour: `recorded_at,latest_id,latest_hash,log_rows,total_votes,generated_at` |
| `config.json` | the site's public Supabase URL and publishable key (the same ones every visitor's browser uses) |
| `.github/workflows/hourly-hash.yml` | runs `record-head.mjs` every hour, commits `heads.csv` as the generic `github-actions[bot]`, then runs `verify.mjs` |

To test against another database, set `AUDIT_SUPABASE_URL` and `AUDIT_SUPABASE_KEY`.
