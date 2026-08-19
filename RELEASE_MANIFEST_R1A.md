# REL-R1-2026-08-19-A — SALOWN coordinated release manifest

> **NOTHING IN THIS DOCUMENT HAS BEEN DEPLOYED.** No production Firestore or Auth access, no
> callable invocation, no booking, payment or checkout, no seed or bootstrap, no mode flip, no
> period close. A prepared manifest is not a deployment; a release gets a `RELEASE_LEDGER.md`
> row and **no row has been created**.
>
> **Supersedes** [`RELEASE_MANIFEST_R1.md`](RELEASE_MANIFEST_R1.md) (`REL-R1-2026-08-20-A`),
> which is retained unaltered with a superseded banner. Its identity was **not** rewritten. The
> `2026-08-20` in the old ID was my own inference that UK local time had crossed midnight; the
> intended deployment date is **2026-08-19**, so the ID now matches it.
>
> **Owner decision, 2026-08-19:** both exit callables are **INCLUDED** in R1.
>
> **Where the "live" identities come from.** Recorded evidence — `RELEASE_LEDGER.md` row
> `R-2026-08-17-A` and predecessors — **except** the two exit identities, which came from an
> owner-authorised bounded production **metadata read**
> (`APPROVE PROD RELEASE METADATA READ REL-R1-PREP`). That read covered **name, region,
> generation, state, `updateTime` and live revision identity only**, for those two function
> names and no others, executed with explicit `--format` field projections. No environment
> variable, secret, log line, source, Firestore document or Auth record was requested or
> returned. **Runtime (`nodejs22`) was NOT in the approved field set and remains a
> source-derived claim** (`functions/package.json` `engines.node`), not live-verified.

**Release ID** `REL-R1-2026-08-19-A`
**Prepared** 2026-08-19 (UK) · `alish/release-prep-r1` · macOS
**Project** `havuz-44f70`

| Repo | Source HEAD | State |
|---|---|---|
| salown-app | **`e80f783`** (work commits `8195449`, `2e66f9d`, **`670cb81`**) | clean · 0/0 |
| whitecross-site | **`f2577871`** | clean · 0/0 |
| salown-docs | this commit | clean · 0/0 |

**Live anchors this release moves from:** salown-app **`ef5c0ed`** (rota Functions +
`hosting:salown` + rules) · salown-app **`d64f098`** (`hosting:salown-staff`) · salown-app
**`124c67e`** (the two exit callables — see §1.1a) · whitecross-site **`18946538`** (both
premium panel targets). All are proven ancestors of their repo's current HEAD.

---

## 0. Lint closure — three blockers, all opened by the same defect

A file that matches no ESLint configuration block reports *"File ignored because no matching
configuration was supplied"*. That is a **warning**. It **exits 0**. In a gate log it is
indistinguishable from a clean pass. Three modules that ship in this release were in that state,
and every scoped-lint "clean" ever reported for them was vacuous.

| Commit | Module | What it is |
|---|---|---|
| **`8195449`** | `finance/periodClose.ts` + twin + 3 suites | sole writer of a write-once closed Finance period |
| **`2e66f9d`** | `staff/rotaSeedImport.ts` | the NEW callable `salownRotaSeedTenantHistory`, absent from production |
| **`670cb81`** | `finance/exit.ts` + its suite | holds `exitAssertOwner`, the settlement mutation guard |

**What coverage exposed, and what was done with it**

| Module | Findings | Resolution |
|---|---|---|
| `periodClose.ts` | 4 stale `no-explicit-any` directives | removed; the 2 load-bearing ones kept |
| its 3 `node:test` suites | 3 redundant `/* global … */` comments | removed |
| `rotaSeedImport.ts` | **none** | config only, module untouched |
| `exit.ts` | **12** — 11 `no-explicit-any` + 1 `no-require-imports` | see §0.1 |
| its suite | 1 redundant `/* global … */` comment | removed |

No rule was weakened anywhere. No file-wide disable was added. No `ignores` entry was created.
`functions/src/index.ts` is deliberately still out of scope — §9.

### 0.1 — How the exit module's 12 findings were resolved

**11 × `no-explicit-any` → real structural types, no `any` at all.**

Deliberately **not** the `export type Firestore = any` house pattern used by `rotaWriter.ts` and
`periodClose.ts`. Those modules drive a wide slice of the admin SDK, where a hand-maintained
structural type would be a fiction. This module calls exactly `db.doc(path).get()` and reads
exactly `auth.uid` and `auth.token.superAdmin` — the real surface fits in four interfaces, and a
test double satisfies it the same way the admin SDK does.

```
ExitDocSnapshot / ExitDocRef / ExitDb   the Firestore surface, and nothing wider
ExitAuth                                the VERIFIED callable auth context
ExitAmount / ExitTermsShape             money-ish values and the finalised terms
ExitLedgerEntry / ExitAgreement         the append-only ledger and its document
```

**1 × `no-require-imports` → a narrow one-line disable.** The runtime is CommonJS
(`main: index.js`, no `"type"` in `package.json`). Converting the require to an `import` would
change the emitted JS of a settlement boundary to satisfy a stylistic rule — the one kind of
change this closure must not make. It is the same one-line form the S4A require two lines below
already carries, and the same form `periodClose.ts` uses. Not a file-wide disable.

**No finding required a behavioural change, so nothing was escalated.**

### 0.2 — Zero executable change, proven not asserted

| Module | Evidence |
|---|---|
| `exit.ts` | Compiled `lib/finance/exit.js` differs from HEAD's by the **8 added comment lines only**. Comment-stripped, both sides hash **`47b2b95e0da8cde927da4f969b023db92769ea3c70365433a099378a937b2b1c`**, and a line-by-line diff of the non-comment output is **EMPTY**. Every source change is a type annotation, an interface declaration or a non-null assertion — all erased by TypeScript |
| `periodClose.ts` | Same method: differs by exactly 4 comment lines; comment-stripped both sides hash `12dca34d68c770e11395a1806a06ac9844857039212d3d470bbe2cf4b6478354` |
| `rotaSeedImport.ts` | source byte-unchanged |

The exit guard, the finalised 28-Jun-2026 settlement terms, the ledger arithmetic and the email
copy are untouched.

### 0.3 — Negative controls, every one fired and restored

| Target | Probe | Result |
|---|---|---|
| `exit.ts` | unused variable | exit **1** |
| `exit.ts` | re-introduced `any` (the rule class just resolved) | exit **1** |
| `exit.ts` | stale disable directive | exit **1** |
| `periodClose.ts` | unused variable · stale directive | exit **1** each |
| `rotaSeedImport.ts` | unused const | exit **1** |
| all, after restore | — | exit **0** |

**Genuinely linted, not merely silent:** `--format json` on the clean run reports **2 suppressed
`no-require-imports`** messages for `exit.ts` and **13 suppressed** for `periodClose.ts`. A file
that were still unmatched would report zero of either.

---

## 1. Deployable units

Six units. Serial. Rules **last**, and §5 proves why with executable evidence.

### 1.1 — Functions (exactly 7, targeted, never blanket)

All `europe-west2` · GEN_2 · `nodejs22` (source-derived) · codebase `salown` · project
`havuz-44f70`.

| # | Export | Live revision | Why it changed | Inert before invocation? |
|---|---|---|---|---|
| 1 | `salownRotaTransaction` | `salownrotatransaction-00001-biy` | ROTA-SSOT-2 adds the **`ROTA_OVERRIDE`** action. Live build carries **0** occurrences; HEAD carries 3 + 20 + 11 across `rotaCallable`/`rotaWriter`/`rotaFold` | Yes |
| 2 | `salownProvisionTeamMember` | `salownprovisionteammember-00001-log` | **Dependency graph only** — own source unchanged; closure pulls `rotaCallable` → `rotaWriter` → `rotaFold` | Yes |
| 3 | `salownRotaBootstrapTenant` | `salownrotabootstraptenant-00001-bup` | **Dependency graph only** — closure pulls `rotaWriter` → `rotaFold` | Yes — **not invoked** (§7) |
| 4 | `salownRotaSeedTenantHistory` | **ABSENT** — a CREATE | New export (`9348b38`), post-dates `ef5c0ed`, zero ledger rows | Yes — **not invoked** |
| 5 | `salownCloseFinancePeriod` | **ABSENT** — a CREATE | New export (`ec8fbe7`), post-dates `ef5c0ed`, zero ledger rows | Yes — **must not be invoked**; both reader modes stay `legacy` |
| 6 | `salownEmailExitAgreement` | **`salownemailexitagreement-00011-sif`** · GEN_2 · ACTIVE · `updateTime` **2026-07-13T02:11:54.304323118Z** | `19b5aa3` replaces `exitAssertStaff` (staff-doc-exists) with `exitAssertOwner` | Yes |
| 7 | `salownSendExitSignLink` | **`salownsendexitsignlink-00012-suz`** · GEN_2 · ACTIVE · `updateTime` **2026-07-13T02:11:59.368342604Z** | Same guard change. Mints a signing token and writes it to `settings/exit_agreement` through the Admin SDK, bypassing `firestore.rules` | Yes |

**`finance/exit.ts` also reaches `salownGetExitByToken` and `salownSignExitByToken`.** Both are
deliberately **excluded**: neither handler calls the changed guard (verified by scanning each
export's own body for `exitAssertOwner` / `exitAssertStaff`), so deploying them would move two
revisions this release has no reason to move.

#### 1.1a — The exit pair is a 38-day jump. Included on the owner's decision.

Their live revisions were last updated **2026-07-13T02:11:5x Z**; the repo commit live at that
instant is **`124c67e`**. All timestamps UTC.

| | rota three | **exit two** |
|---|---|---|
| Live source epoch | `ef5c0ed` · 2026-08-17 | **`124c67e` · 2026-07-13** |
| Age of the jump | 2 days | **38 days** |
| Shared `index.ts` drift taken | +143 / −4 | **+1,922 / −342** |
| New top-level declarations at cold start | few | **57** |
| New runtime dependency | none | **`staff/accessStatus.ts`** (did not exist at `124c67e`; `3097521`, S4A, recorded as not-live) |

**Their own handler delta is two lines each**, and is exactly the intended fix:

```
- async (request) => {                            + async (request: any) => {        (type only)
- await exitAssertStaff(db, request.auth?.uid);   + await exitAssertOwner(db, request.auth);
```

`finance/exit.ts` is missing two commits relative to live: `c81d5d5` (strict types, type-level)
and `19b5aa3` (**the authorization change**). The `.js → .ts` conversion (`ce973fb`, 01:31Z) is
**already live**.

**The risk is not in the handlers; it is in the shared module they cold-start.** The owner
weighed that against what staying stale costs — under `exitAssertStaff`, **any** staff document
at the tenant, every barber and every receptionist, can email the signed partner exit agreement
to an arbitrary address and mint a signing token through a path `firestore.rules` cannot see —
and decided to **include** them. Rollback is a proven, targeted, one-command-per-function
operation.

**Command — the approved wrapper, one invocation:**

```
cd ~/Desktop/alex/salown-app
./scripts/deploy-functions.sh \
  salownRotaTransaction \
  salownProvisionTeamMember \
  salownRotaBootstrapTenant \
  salownRotaSeedTenantHistory \
  salownCloseFinancePeriod \
  salownEmailExitAgreement \
  salownSendExitSignLink
```

Validated offline at `--check-only`: **"OK — 7 target(s) owned by codebase 'salown'"**, all
`europe-west2`. The same guard **refuses** a blanket `functions` selector, which would propose
deleting the 27 legacy `us-central1` functions (`docs/INCIDENTS.md`, 2026-08-11).
**`firebase deploy --only functions` must never be typed.**

**Deploy archive:** 168 files, 4.15 MiB, manifest digest
**`1a859ee690e4d633bc6b28ff26c31207597ee29467360edf6ff69bc502ef3c7b`**
(was `64ea02ab…683f` before `670cb81`; `src/**` ships in the archive, so the exit source change
moves it). `scripts/functionsArchiveManifest.cjs`: no secret-like file, no debug or test
artefact, no unexpected untracked file; `package.json` + `lib/index.js` present.

### 1.2 — `hosting:salown` (canonical panel/admin)

| | |
|---|---|
| Live version | **`fa3c670ddfbdc34a`** (release `1786984855256000`, from `ef5c0ed`) |
| Source | `e80f783` |
| Build | `npm run build` (also the `firebase.json` predeploy hook) |
| Artifact dir | `hosting/` excluding `hosting/staff-bundle/**` |
| Files | **98** · manifest sha256 **`936833618b967e02dd69f161e317dad153c222e736df81f77fe142ccdcf3f4ee`** |
| Entry chunk | `assets/index-6xSRd30w.js` sha256 `c61c68749d420a9b0f6a605f1e64100c094de6a3e6a67436c12e285be87b15c9` |
| Command | `npm run deploy:panel` |

Unchanged by `670cb81` — the exit closure is Functions-only and `eslint.config.js` is not
bundled. The hashes are identical to the superseded manifest's, which is itself the evidence.
**User-visible:** shift-override editors write through `salownRotaTransaction`; Settings' PAST
rows lose "Remove" and gain required reason + reference. **Inert:** the Finance closed-period
reader and panel ship behind `FINANCE_PERIOD_CLOSE_MODE = 'legacy'` with **zero** extra reads.

### 1.3 — `hosting:salown-staff`

| | |
|---|---|
| Live version | **`9cd83c70960e062f`** (release `1786747190806000`, from `d64f098`; re-read and unmoved through `R-2026-08-17-A`) |
| Source | `e80f783` |
| Build | `npm run build:staff` · Artifact dir `hosting/staff-bundle/` |
| Files | **25** · manifest sha256 **`fd81783172ee876cfc2b906bb54aef0164a09edfee07990908dbea3a85e4a627`** |
| Chunks | `staff-SnJz1KZk.js` `9f6c589ee388576d839afe50e476ed0568b8737f0ccc33e6763be17bbecbd3dc` · `staff-h5sE0F85.css` `012863198518600fd47c3c2a99690231b5f9c833e31b720268e5fbb275deede7` |
| Command | `npm run deploy:staff` |

**User-visible:** the 24-hour checkout fix — Whitecross resolves to the platform default
`timeFormat: '24h'`, and walk-in create and payment currently die with `INVALID_DATE_TIME`
**before any write**. This unit repairs a till that does not work today.
**⚠️ REL-1, expected:** `hosting/staff-bundle/**` is tracked and `deploy:staff` writes into it.
Reconcile afterwards with explicit pathspecs only — never `git restore .`.

### 1.4 / 1.5 — `hosting:whitecrossbarbers-admin` and `hosting:whitecrossbarbers-owner`

Two sites, **one artefact**. Version ids differ and always will — a Hosting version is scoped to
one site, so **the two rollback identities are not interchangeable**.

| | |
|---|---|
| Live | admin **`982fcf79b4add1f1`** · owner **`0b46e7a98bfca1f8`** (both from `18946538`) |
| Source | `f2577871` |
| Build | `npm --prefix barber-panel run build` — **mandatory**: no Hosting predeploy hook in this repo and `barber-panel/build` is gitignored, so without an explicit rebuild the deploy ships a working-directory artefact pinned to no commit |
| Files | **36** · manifest sha256 **`63ce7c18045a8d7df60f9a9272c407cf67165ea91090dca790e36ea7263a3023`** — reproduced identically across **three** independent builds |
| Key files | `static/js/main.99826fdd.js` `cf0415603f8e6d39a3b65ed9a3293f4eb46027408ec96a9140000a7f52c16d38` · `index.html` `e7765421e4cf7276450b7da5291c49220b97785cc7bd87227c22cad8fd99b364` |
| Command | `./deploy.sh` → option **1** (admin), then option **4** (owner). Both resolve to an explicit `hosting:<site>`; never a bare `--only hosting` |

**`REACT_APP_SALOWN_APP_ORIGIN` is unset and stays unset.** No `.env` in `barber-panel/`; the
built bundle contains **zero** `salown.com` or `https://…salown…` occurrences. Unset is the
shipped default — the notice renders a navigation instruction, not a link. Do not invent or
hardcode an origin, and nothing identifying a session may travel in a URL.

### 1.6 — `firestore:rules` — LAST

| | |
|---|---|
| Live ruleset | **`60abf8e4-e6ca-43e0-8bb7-26ef72ae58ba`** · 48,130 B · sha256 `b04f7745c5b420db3aaeeefdc7355e085f9115a28b573e7ed80ff1ba1b9809a4` |
| Candidate | `firestore.rules` @ `e80f783` · **66,071 B** · sha256 **`1818bd219513308145518fa51f0dd1324c977df4a03c6f1e18c0d91a1b135c0a`** |
| Diff | **+263 / −6** across `fe57640`, `ec8fbe7`, `19b5aa3`, `f533dbf`, `5881006` |
| Command | `firebase deploy --only firestore:rules --project havuz-44f70` — the single sanctioned command (`ops/rulesAuthority.mjs`); whitecross-site declares no Firestore target and its offline check confirms it |
| Gate | rules emulator **123/123** across 6 suites |

**Exact clauses changed:** new `ownsFinanceAuthority(tid)` / `isFinanceReader(tid)` ·
`match /financePeriods/{periodKey}` read for super-admin or owner/admin, **`create, update,
delete: if false`** for every browser principal including super-admin ·
`match /financePeriods/{periodKey}/{sub=**}` `read, write: if false` ·
`match /settings/{document=**}` split into `{docId}` + `{sub=**}` with `allow delete: if
isSuperAdmin()` and narrowed create/update · `match /{coll}/{document=**}` split with
`allow write: if false` on the document form · the `barbers.shiftChanges` closure —
unconditional, every role, every tenant, no staged exception.

---

## 2. Indexes and Storage — EXCLUDED, on executable evidence

* `firestore.indexes.json`: `git diff ef5c0ed HEAD` **empty**; sha256
  `30202560bf0f480f756034de14840041e549620cec7b51f17d8a3f4f5a8cab7e`. **Not deployed.**
* **Storage:** `salown-app/firebase.json` has **no** `storage` key. whitecross-site's
  `storage.rules` diff vs `18946538` is **empty**. **Not deployed.**

---

## 3. Gate counts — run against the exact final committed source (`e80f783`)

**salown-app**

| Gate | Result |
|---|---|
| Frontend suite | **4538 / 4538** (150 files) |
| Functions `node:test` | **1891** — 1854 pass · **0 fail** · 37 emulator self-skips |
| Canonical Firestore emulator gate | **523 / 523** (general 496 · packages 27) · firebase-tools 15.26.0 / emulator v1.22.0 |
| Rules emulator gate | **123 / 123** (availabilityFrom 17 · staffRota 30 · rotaRollout 21 · superAdminCatchall 21 · financeConfig 20 · financePeriods 14) |
| **Focused exit authorization suite** | **18 / 18** — owner allowed · **tenant admin DENIED** · staff denied · cross-tenant denied by construction · unauthenticated refused before any read · a `tenantRole` claim cannot outrank the document · a request body grants nothing · `superAdmin` must be exactly `true` · suspended/offboarded owner denied · revoked super-admin denied · absent `accessStatus` active, unknown fails closed |
| ROTA focused | 140 / 140 |
| Period-close A/B/C focused (frontend) | 203 / 203 |
| Period-close unit + twin/golden parity (functions) | 93 / 93 |
| Staff 24h parser + walk-in/create/payment + post-write boundary | 228 / 228 |
| Fold twin/golden parity | 70 / 70 |
| Frontend typecheck · Functions typecheck · Functions build | 0 errors each |
| salown production build · Staff build · Whitecross build | OK; all three artifact digests reproduced across independent builds |
| Scoped lint | clean, with **firing** negative controls (§0.3). One pre-existing `react-hooks/exhaustive-deps` *rule-not-found* error in `WeekScheduleGrid.tsx` — a plugin-resolution defect also present in untouched `WeekView.tsx` |
| ops guards (deploy-policy · functions-ownership · rules-authority) | **119 / 119** |
| Functions archive manifest guard | 12 / 12 |
| Release guard + selftest | OK · 19 / 19 |
| Claims selftest + regression | PASS · 45 / 45 |
| Export inventory | **78** |
| `git diff --check` | clean |

**whitecross-site** — unchanged at `f2577871`; gates re-run for completeness.

| Gate | Result |
|---|---|
| Legacy Finance closure focused | **37 / 37** |
| Full configured suite | **70 pass · 1 fail · 71 total** |
| Baseline reproduction | At the recorded live commit **`18946538`** in a detached worktree: **33 pass · 1 fail · 34 total**, failing the **same** untouched CRA scaffold test (`src/App.test.js`). `App.test.js` and `App.js` are **byte-identical** between `18946538` and HEAD. Same one failure before and after; +37 new passing |
| Bundle / source-map reachability | **0** source-map `sources[]` entries naming a deleted `Finance.js`; **0** files carrying any of 11 calculator/config signatures. The two literal `pages/Finance` hits are **comment prose inside `sourcesContent`** in `legacyFinanceClosure.js` and `Marketing.js`. Retained: `Reports` 5 · `Marketing` 7 · `Breakdown` 4 · `text/csv` 4. Closure marker `legacy-finance-closed:v1` present |
| `git diff --check` | clean |

---

## 4. Release order

1. **Functions** — the 7 named above, one guarded invocation.
2. **`hosting:salown`**
3. **`hosting:salown-staff`**
4. **`hosting:whitecrossbarbers-admin`**
5. **`hosting:whitecrossbarbers-owner`**
6. **`firestore:rules`** — LAST.

---

## 5. Why rules must be last — proven, not assumed

1. The **live** `salownRotaTransaction` build (`ef5c0ed`) contains **0** `ROTA_OVERRIDE`. It
   cannot accept a dated override yet.
2. The **live** panel source (`ef5c0ed`) contains **5** direct browser `shiftChanges` write
   sites — 3 in `Barbers.tsx`, 2 in `Settings.tsx`.
3. The **new** bundles contain **0** write-shaped `shiftChanges:` occurrences in either
   `public-bundle` or `staff-bundle`. Every remaining occurrence is a **read**
   (`e.shiftChanges?.[t]`) — the map stays a projection the fold honours, which the rules change
   permits.

Rules first would make the browser clients that are live *right now* start failing their
override writes with permission-denied while the Admin-SDK path that replaces them does not yet
exist. **The order is not changed.**

---

## 6. Rollback identity — one per unit

| Unit | Rollback |
|---|---|
| `salownRotaTransaction` | `salownrotatransaction-00001-biy` |
| `salownProvisionTeamMember` | `salownprovisionteammember-00001-log` |
| `salownRotaBootstrapTenant` | `salownrotabootstraptenant-00001-bup` |
| `salownRotaSeedTenantHistory` | **CREATE — no prior revision.** Rollback is deleting that one function by exact name in `europe-west2`. Never a blanket `--only functions` |
| `salownCloseFinancePeriod` | **CREATE.** Same |
| `salownEmailExitAgreement` | **`salownemailexitagreement-00011-sif`** (GEN_2, ACTIVE, `updateTime` 2026-07-13T02:11:54.304323118Z) |
| `salownSendExitSignLink` | **`salownsendexitsignlink-00012-suz`** (GEN_2, ACTIVE, `updateTime` 2026-07-13T02:11:59.368342604Z) |
| `hosting:salown` | `fa3c670ddfbdc34a` |
| `hosting:salown-staff` | `9cd83c70960e062f` |
| `hosting:whitecrossbarbers-admin` | `982fcf79b4add1f1` |
| `hosting:whitecrossbarbers-owner` | `0b46e7a98bfca1f8` (**not** the admin id) |
| `firestore:rules` | Ruleset **`60abf8e4-e6ca-43e0-8bb7-26ef72ae58ba`**. Byte-exact source reproducible from git: `git show ef5c0ed:firestore.rules` → 48,130 B, sha256 `b04f7745c5b420db3aaeeefdc7355e085f9115a28b573e7ed80ff1ba1b9809a4`, **matching the hash the ledger recorded from production**. A copy is staged |

---

## 7. Modes and production state after this release

* `FINANCE_ROTA_HISTORY_MODE` = **`legacy`** · `FINANCE_PERIOD_CLOSE_MODE` = **`legacy`**
* **Zero** period-close UI reads under legacy — no badge, no panel, no extra Firestore read
* **No** historical Finance movement; no figure moves
* **August 2026 remains OPEN**; no `financePeriods` document exists for any tenant
* Server release allowlist stays **`whitecross` 2026-02 … 2026-07** and nothing else
* **HeroHairs untouched**
* Every rota guard stays **inert** until a bootstrap declares a tenant canonical; **no bootstrap
  is invoked**

**Included as inert / source deployment:** ROTA-SSOT-2 server + client + rules support · Finance
period-close callable and reader source · Finance P&L / badge source behind legacy mode ·
Whitecross legacy Finance removal · Staff 24-hour checkout fix · **the exit settlement
authorization tightening**.

**Excluded:** production bootstrap dry-run · seed · bootstrap apply · rota dated cutover ·
Finance period close · period-closed cutover · the £7,939 liability representation · March–July
closes · any August operation.

---

## 8. Stopping conditions

1. Any repo dirty, not `0/0`, or an active claim overlaps.
2. Either Finance mode is not `legacy`.
3. Export count is not **78**.
4. `./scripts/deploy-functions.sh --check-only` does not return exactly **7 owned targets**.
5. ~~The live revision of either exit callable cannot be read.~~ **RESOLVED** by the bounded
   metadata read. ~~The owner has not chosen on the exit pair.~~ **RESOLVED — both INCLUDED.**
6. A live identity read at deploy time disagrees with §1 — that means an **unrecorded
   deployment** happened and this manifest is stale.
7. Any gate in §3 does not reproduce.
8. `hosting:salown-admin` (`9f457fc2c8ee4b35`) moves. Not a target of this release and not
   deployable from either repo's config.

---

## 9. Open items this release does NOT close

### 9.1 — Technical debt: `functions/src/index.ts` is unlinted (**365 problems**)

Recorded here as a standalone debt item, deliberately **not** folded into this release.

| Rule | Count |
|---|---|
| `@typescript-eslint/no-explicit-any` | **274** |
| `@typescript-eslint/no-require-imports` | **63** |
| `@typescript-eslint/no-unused-vars` | **28** |
| **Total** | **365** |

Measured, not estimated, by temporarily adding the file to a block and reverting the probe. This
is the main Functions entrypoint — every callable in the codebase lives in it — and it matches
no configuration block, so it reports the same false "clean" the three modules above did. The
**28 `no-unused-vars`** are the ones that may not be cosmetic: an unused binding in a 5,000-line
entrypoint can be a dropped guard rather than dead decoration.

It is excluded because clearing 365 problems is a change with its own review surface, and
folding it into a release-prep commit would hide it. **It should be its own Work ID.** The
ESLint config's rota block already records this widening as the intended separate change.

### 9.2 — Other open items

* **`finance/exit.ts` is now covered**, so the residual named in the superseded manifest is
  half closed: only `index.ts` remains.
* **Two Functions have no `RELEASE_LEDGER` row** even though their identities are now known.
  The 2026-07-13 deploy that produced `-00011-sif` and `-00012-suz` is invisible to every
  document in `docs/`. The ledger rule — *a release that appears in prose but not here has not
  been recorded* — has a matching blind spot for pre-ledger deploys, and **nothing detects it**.
  A backfill row, or an explicit "pre-ledger, identity read on 2026-08-19" marker, would close it.
* `SEC-CATCHALL-1` remains an asserted known exception.
* The python rules suites (`scripts/testStaffRotaRules.py` and friends) are **not** part of the
  registered `ops/test-rules-emulator.sh` gate; only the six `test/rules/*.emulator.test.js`
  suites are.
* `scripts/verifyReleaseManifest.mjs` is **A1-specific** — its invariants are literal to
  `RELEASE_MANIFEST_A1.md`. Running it against this file would report false failures. It is not
  a gate for R1.

---

## 10. Post-deploy verification — non-mutating only

Per target, after its own step:

* **Functions** — read each new revision id and traffic split; confirm exactly **7** revisions
  created and no unnamed function moved; confirm `us-central1` still **27**.
* **`hosting:salown`** — served entry chunk sha256 == `c61c6874…b15c9`; previous entry chunk
  404s, proving the release moved.
* **`hosting:salown-staff`** — served `staff-SnJz1KZk.js` sha256 == `9f6c589e…bd3dc`.
* **Whitecross admin + owner** — served `main.99826fdd.js` sha256 == `cf041560…16d38` on
  **both**; sorted path+hash manifests byte-identical between the two versions.
* **Rules** — fetch the live source back out, hash it, `diff` against `firestore.rules`; record
  the new ruleset id and `createTime`.

**Staff fix — non-mutating checks only:** ① Staff bundle revision matches this manifest ②
Whitecross presentation resolves to **24-hour** ③ walk-in dropdown shows 24-hour labels ④ New
Booking initial value is present among its options ⑤ no `AM`/`PM` on any Whitecross Staff time
surface ⑥ opening the flows produces no console error.

**Exit pair — non-mutating only.** Do **not** call either callable. There is no read-only probe
of a callable, and invoking `salownSendExitSignLink` would mint a token and send an email.
Verification is limited to: the two new revision ids exist, are `ACTIVE`, and carry 100 % of
traffic. The guard's behaviour is proven by the 18/18 focused suite, not in production.

**A real Confirm Payment or Save Unpaid is a production mutation and is NOT part of this
release.** It requires its own bounded approval — §11.

---

## 11. Separately gated: the Staff production-write test

Prepared, **not** requested here.

| Field | Value |
|---|---|
| Tenant | `whitecross` (the tenant carrying the defect) |
| Staff actor | the owner's own authenticated Staff session — **no credential typed, revealed or accepted by the releasing session** |
| Service | to be named by the owner from the live catalogue at approval time; a service id chosen from source could be stale or repriced |
| Date / time | today, a time chosen from the walk-in picker — the value under test is the picker's own 24-hour output |
| Price / payment | the selected service's live price; **Cash**; tip 0; discount 0 |
| Does it remain? | ⚠️ **Undecided, deliberately.** A checkout is not reversible by design — it writes `paidAmount`, the receipt, loyalty points and `checkedOutAt`. The owner must choose **before** the test: (a) it **stays** as a real £N sale on a real trading day, or (b) a **separately approved** cancellation follows |
| Loyalty / receipt | a real client would get a real receipt and real points. Use an anonymous walk-in with no contact so `receiptPossible` is false and no email can be sent |
| Verification | booking appears at the **expected time**, not 00:00 and not shifted; status `CHECKED_OUT`; `paidAmount` == expected total; `checkedOutAt` stamped once; **no** "Checkout failed" toast on a successful write |
| Cleanup | whatever the owner chose, executed openly and recorded |

**Do not create a test booking and then quietly delete it.** An unapproved deletion is a second
unapproved production write, and it removes the evidence of the first.

---

## 12. What preparing this manifest did NOT do

No deployment. **No production Firestore or Auth read or write.** No callable invoked, not even
a dry run. No booking, payment or checkout. No seed, bootstrap, migration or backfill. No period
close or adjustment. No mode cutover. No `RELEASE_LEDGER` row.

**One production operation occurred across the whole preparation, under its own explicit
approval:** a read-only Cloud Functions **metadata** describe for exactly two function names,
returning exactly six fields. No environment variable, secret, log, source, Firestore document
or Auth record was requested or returned, and no other function was queried.
