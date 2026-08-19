# REL-R1-2026-08-20-A — SALOWN coordinated release manifest

> **NOTHING IN THIS DOCUMENT HAS BEEN DEPLOYED.** No production Firestore or Auth access
> occurred, no callable was invoked, and no live authenticated check was run while preparing
> it. A prepared manifest is not a deployment; a release gets a `RELEASE_LEDGER.md` row and
> **no row has been created**.
>
> **Where the "live" identities come from.** Every live identity below is read from
> `RELEASE_LEDGER.md` row `R-2026-08-17-A` and its predecessors — the recorded evidence —
> **not** from a fresh production read, because this task did not authorise one. Where the
> ledger does not record an identity, this manifest says **UNPROVEN** and names what must be
> read at deploy time. It does not guess.

**Release ID** `REL-R1-2026-08-20-A`
**Prepared** 2026-08-20 (UK) · `alish/release-prep-r1` · macOS
**Project** `havuz-44f70`

| Repo | Source HEAD | State |
|---|---|---|
| salown-app | **`19f9703`** (work commits `8195449`, `2e66f9d`) | clean · 0/0 |
| whitecross-site | **`f2577871`** | clean · 0/0 |
| salown-docs | this commit | clean · 0/0 |

**Live anchors this release moves from:** salown-app **`ef5c0ed`** (Functions + `hosting:salown`
+ rules, per `R-2026-08-17-A`), salown-app **`d64f098`** (`hosting:salown-staff`, per
`R-2026-08-14-B`), whitecross-site **`18946538`** (both premium panel targets, per
`R-2026-08-17-A`). All three are proven ancestors of their repo's current HEAD.

---

## 0. Lint closure — the blocker that opened this work

`eslint functions/src/finance/periodClose.ts` answered *"File ignored because no matching
configuration was supplied"*. That is a **warning**, it **exits 0**, and in a gate log it is
indistinguishable from a clean pass — for the file that is the **sole writer of a write-once
closed Finance period**, a document with no update and no delete path anywhere.

| | |
|---|---|
| **Commit** | **`8195449`** — period-close module + twin + its three `node:test` suites |
| **Commit** | **`2e66f9d`** — `staff/rotaSeedImport.ts`, the NEW callable's module |
| **What the coverage exposed** | 4 stale `@typescript-eslint/no-explicit-any` disable directives in `periodClose.ts` (removed); 3 redundant `/* global … */` comments in the suites (removed). `rotaSeedImport.ts` needed **no change at all** |
| **Non-behavioural, proven** | Every source line removed is a comment. Compiled `lib/finance/periodClose.js` differs from `ef5c0ed`'s by **exactly those four comment lines**; with comment lines stripped both sides hash `12dca34d68c770e11395a1806a06ac9844857039212d3d470bbe2cf4b6478354` |
| **Negative controls** | Injected unused const → `eslint` exit **1**; re-introduced stale directive → exit **1**; both restored → exit **0**. `--format json` reports **13 suppressed** messages on the clean run, so the pass is analysis, not absence |
| **Not done, measured** | `functions/src/index.ts` (**365** problems) and `functions/src/finance/exit.ts` (**12**) are still unmatched by any config block. Both ship in this release. See §9 |

---

## 1. Deployable units

Six units. Serial. Rules **last**, and §5 proves why with executable evidence rather than
convention.

### 1.1 — Functions (exactly 7, targeted, never blanket)

All `europe-west2` · GEN_2 · `nodejs22` (`functions/package.json` `engines.node: "22"`) ·
codebase `salown` · project `havuz-44f70`.

| # | Export | Live revision | Why it changed | Inert before invocation? |
|---|---|---|---|---|
| 1 | `salownRotaTransaction` | `salownrotatransaction-00001-biy` | ROTA-SSOT-2 adds the **`ROTA_OVERRIDE`** action. The live build carries **0** occurrences of that literal; HEAD carries 3 in `rotaCallable.ts`, 20 in `rotaWriter.ts`, 11 in `rotaFold.ts` | Yes — a callable does nothing until called |
| 2 | `salownProvisionTeamMember` | `salownprovisionteammember-00001-log` | **Dependency graph only.** Its own source is unchanged; its compiled require closure pulls `staff/rotaCallable` → `staff/rotaWriter` → `utils/rotaFold`, all three changed | Yes |
| 3 | `salownRotaBootstrapTenant` | `salownrotabootstraptenant-00001-bup` | **Dependency graph only.** Closure pulls `staff/rotaWriter` → `utils/rotaFold` | Yes — and it is **not invoked by this release** (§7) |
| 4 | `salownRotaSeedTenantHistory` | **ABSENT** — a CREATE | New export (`9348b38`), post-dates `ef5c0ed`, zero `RELEASE_LEDGER` rows | Yes — server-only seed path, **not invoked** |
| 5 | `salownCloseFinancePeriod` | **ABSENT** — a CREATE | New export (`ec8fbe7`), post-dates `ef5c0ed`, zero `RELEASE_LEDGER` rows | Yes — **must not be invoked**; both reader modes stay `legacy` |
| 6 | `salownEmailExitAgreement` | **UNPROVEN** ⚠️ | `finance/exit.ts` (`19b5aa3`) replaces `exitAssertStaff` (staff-doc-exists) with `exitAssertOwner` (tenant owner or sanctioned super-admin) | Yes |
| 7 | `salownSendExitSignLink` | **UNPROVEN** ⚠️ | Same guard change. This callable mints a signing token and writes it to `settings/exit_agreement` through the Admin SDK, which bypasses `firestore.rules` entirely | Yes |

⚠️ **UNPROVEN is a real gap, not a formality.** `RELEASE_LEDGER.md` contains **zero** rows
naming `salownEmailExitAgreement` or `salownSendExitSignLink`. Their source is provably stale
(it moved after `ef5c0ed` with no release row since), but **which** revision is live cannot be
established without a production read, which this task did not authorise. Their rollback
identity **must be read immediately before deploy** — see §6 and the stopping condition in §8.

**`finance/exit.ts` also reaches `salownGetExitByToken` and `salownSignExitByToken`.** They are
deliberately **NOT** in the target list: neither handler calls the changed guard (verified by
scanning each export's own body for `exitAssertOwner` / `exitAssertStaff`), so redeploying them
would move two revisions this release has no reason to move.

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

Validated offline at **`--check-only`**: *"OK — 7 target(s) owned by codebase 'salown'"*, every
one resolved to `europe-west2`. The same guard **refuses** a blanket `functions` selector,
because that proposes deleting the 27 legacy `us-central1` functions
(`docs/INCIDENTS.md`, 2026-08-11). **`firebase deploy --only functions` must never be typed.**

**Deploy archive:** 168 files, 4.15 MiB, manifest digest
**`64ea02abd8c1a3031e2af97bda8bf3622c141170b80b5a5e012779415f1a683f`** —
`scripts/functionsArchiveManifest.cjs` reports no secret-like file, no debug or test artefact,
no unexpected untracked file, and confirms `package.json` + `lib/index.js` are present.

### 1.2 — `hosting:salown` (canonical panel/admin)

| | |
|---|---|
| Live version | **`fa3c670ddfbdc34a`** (release `1786984855256000`, from `ef5c0ed`) |
| Source | `19f9703` |
| Build | `npm run build` (also the `firebase.json` predeploy hook) |
| Artifact dir | `hosting/` (excluding `hosting/staff-bundle/**`, which is its own site) |
| Files | **98** · manifest sha256 **`936833618b967e02dd69f161e317dad153c222e736df81f77fe142ccdcf3f4ee`** |
| Entry chunk | `assets/index-6xSRd30w.js` sha256 `c61c68749d420a9b0f6a605f1e64100c094de6a3e6a67436c12e285be87b15c9` |
| Command | `npm run deploy:panel` (= `vite build && firebase deploy --only hosting:salown --project havuz-44f70`) |

**User-visible:** the Team Members and Settings → Members shift-override editors now write
through `salownRotaTransaction` instead of `updateDoc(..., { shiftChanges })`; Settings' PAST
rows lose "Remove" and gain required reason + reference fields.
**Inert:** the Finance closed-period reader and status panel ship behind
`FINANCE_PERIOD_CLOSE_MODE = 'legacy'` and perform **zero** extra Firestore reads; no badge, no
panel, no figure moves.

### 1.3 — `hosting:salown-staff`

| | |
|---|---|
| Live version | **`9cd83c70960e062f`** (release `1786747190806000`, from `d64f098`; re-read and **unmoved** through `R-2026-08-17-A`) |
| Source | `19f9703` |
| Build | `npm run build:staff` |
| Artifact dir | `hosting/staff-bundle/` |
| Files | **25** · manifest sha256 **`fd81783172ee876cfc2b906bb54aef0164a09edfee07990908dbea3a85e4a627`** |
| Chunks | `assets/staff-SnJz1KZk.js` `9f6c589ee388576d839afe50e476ed0568b8737f0ccc33e6763be17bbecbd3dc` · `assets/staff-h5sE0F85.css` `012863198518600fd47c3c2a99690231b5f9c833e31b720268e5fbb275deede7` |
| Command | `npm run deploy:staff` |

**User-visible:** the 24-hour checkout fix. Whitecross has no `presentation` record, so it
resolves to the platform default `timeFormat: '24h'`; walk-in create and payment currently die
with `INVALID_DATE_TIME` **before any write**. This is the unit that repairs a till that does
not work today.
**⚠️ REL-1, expected:** `hosting/staff-bundle/**` is **tracked**, and `deploy:staff` writes into
it. The deploy WILL dirty tracked paths. Reconcile afterwards with explicit pathspecs only —
never `git restore .` — exactly as `R-2026-08-17-A` records.

### 1.4 / 1.5 — `hosting:whitecrossbarbers-admin` and `hosting:whitecrossbarbers-owner`

Two sites, **one artefact**: both publish `barber-panel/build`. Their version ids differ and
always will — a Hosting version is scoped to one site, so **the two rollback identities are not
interchangeable**.

| | |
|---|---|
| Live | admin **`982fcf79b4add1f1`** · owner **`0b46e7a98bfca1f8`** (both from `18946538`) |
| Source | `f2577871` |
| Build | `npm --prefix barber-panel run build` — **mandatory**: this repo has **no Hosting predeploy hook** and `barber-panel/build` is gitignored, so without an explicit rebuild the deploy ships a working-directory artefact pinned to no commit |
| Files | **36** · manifest sha256 **`63ce7c18045a8d7df60f9a9272c407cf67165ea91090dca790e36ea7263a3023`** — reproduced **identically across two independent builds** |
| Key files | `static/js/main.99826fdd.js` `cf0415603f8e6d39a3b65ed9a3293f4eb46027408ec96a9140000a7f52c16d38` · `index.html` `e7765421e4cf7276450b7da5291c49220b97785cc7bd87227c22cad8fd99b364` |
| Command | `./deploy.sh` → option **1** (admin), then option **4** (owner). Both resolve to an explicit `hosting:<site>`; **never** a bare `--only hosting` |

**User-visible:** the premium panel's Finance tab renders a deprecation notice instead of a
second, divergent Finance engine.
**`REACT_APP_SALOWN_APP_ORIGIN` is unset and stays unset.** No `.env` file exists in
`barber-panel/`, and the built bundle contains **zero** occurrences of `salown.com` or any
`https://…salown…` origin. Unset is the **shipped default**: the notice renders a navigation
instruction, not a link. Do **not** invent or hardcode an origin, and nothing identifying a
session may travel in a URL — auth stays a Firebase session plus the `tenantId` claim,
resolved by the destination on its own origin.

### 1.6 — `firestore:rules` — LAST

| | |
|---|---|
| Live ruleset | **`60abf8e4-e6ca-43e0-8bb7-26ef72ae58ba`** · 48,130 B · sha256 `b04f7745c5b420db3aaeeefdc7355e085f9115a28b573e7ed80ff1ba1b9809a4` |
| Candidate | `salown-app/firestore.rules` @ `19f9703` · **66,071 B** · sha256 **`1818bd219513308145518fa51f0dd1324c977df4a03c6f1e18c0d91a1b135c0a`** |
| Diff | **+263 / −6** lines across 5 source commits (`fe57640`, `ec8fbe7`, `19b5aa3`, `f533dbf`, `5881006`) |
| Command | `firebase deploy --only firestore:rules --project havuz-44f70` — the single sanctioned command (`ops/rulesAuthority.mjs`). whitecross-site declares **no** Firestore target and its offline authority check confirms it |
| Gate | rules emulator **123/123** across 6 suites (availabilityFrom 17 · staffRota 30 · rotaRollout 21 · superAdminCatchall 21 · financeConfig 20 · financePeriods 14) |

**Exact clauses changed:**

* `function ownsFinanceAuthority(tid)` and `function isFinanceReader(tid)` — new.
* `match /financePeriods/{periodKey}` — read for super-admin or an owner/admin of the tenant;
  **`allow create, update, delete: if false`** for every browser principal, super-admin
  included. There is no reopen path.
* `match /financePeriods/{periodKey}/{sub=**}` — `read, write: if false`.
* `match /settings/{document=**}` split into `match /settings/{docId}` + a `{sub=**}` form,
  with `allow delete: if isSuperAdmin()` and narrowed create/update.
* `match /{coll}/{document=**}` split into `{docId}` + `{sub=**}`, adding `allow write: if false`
  on the document form.
* `barbers.shiftChanges` closure (already present in the live text as a comment; the guard
  itself is new here): a create carrying any `shiftChanges` key is refused, and an update
  touching `shiftChanges` is refused — **unconditional, every role, every tenant, no staged
  exception**.

---

## 2. Indexes and Storage — EXCLUDED, on executable evidence

* `firestore.indexes.json`: `git diff ef5c0ed HEAD` is **empty**. sha256
  `30202560bf0f480f756034de14840041e549620cec7b51f17d8a3f4f5a8cab7e`. **Not deployed.**
* **Storage:** `salown-app/firebase.json` has **no** `storage` key at all. whitecross-site has a
  `storage.rules`, and `git diff 18946538 HEAD -- storage.rules` is **empty**. **Not deployed.**

---

## 3. Gate counts — run against the exact final committed source

**salown-app**

| Gate | Result |
|---|---|
| Frontend suite | **4538 / 4538** (150 files) |
| Functions `node:test` | **1891** — 1854 pass · **0 fail** · 37 emulator self-skips |
| Canonical Firestore emulator gate | **523 / 523** (general 496 · packages 27) · toolchain firebase-tools 15.26.0 / emulator v1.22.0 |
| Rules emulator gate | **123 / 123** across 6 suites |
| ROTA focused | 140 / 140 |
| Period-close A/B/C focused (frontend) | 203 / 203 |
| Period-close unit + twin/golden parity (functions) | 93 / 93 |
| Staff 24h parser + walk-in/create/payment + post-write boundary | 228 / 228 |
| Fold twin/golden parity | 70 / 70 |
| Frontend typecheck · Functions typecheck · Functions build | 0 errors each |
| salown production build · Staff build | OK, artifacts reproducible |
| Scoped lint over the release diff | clean, with a **firing** negative control (probe → exit 1, restored → exit 0). One pre-existing `react-hooks/exhaustive-deps` *rule-not-found* error in `WeekScheduleGrid.tsx`, a plugin-resolution defect also present in untouched `WeekView.tsx` |
| ops guards (deploy-policy · functions-ownership · rules-authority) | **119 / 119** |
| Functions archive manifest guard | 12 / 12 |
| Release guard + its selftest | OK · 19 / 19 |
| Claims selftest + regression | PASS · 45 / 45 |
| Export inventory | **78** |
| `git diff --check` | clean |

**whitecross-site**

| Gate | Result |
|---|---|
| Legacy Finance closure focused | **37 / 37** |
| Full configured suite | **70 pass · 1 fail · 71 total** |
| Baseline reproduction | At the recorded live commit **`18946538`**, in a detached worktree: **33 pass · 1 fail · 34 total**, failing the **same** test (`src/App.test.js` "renders learn react link" — the untouched CRA scaffold). `src/App.test.js` and `src/App.js` are **byte-identical** between `18946538` and HEAD. Same one failure before and after; +37 new passing tests |
| Admin build · Owner build | one artefact, 36 files, digest reproduced identically twice |
| `git diff --check` | clean |

**Bundle / source-map reachability scan** (36 build files):

* Source-map `sources[]` entries naming a deleted `Finance.js`: **0**.
* Calculator and config signatures across **all** build files: `calculatePartnerSettlement`,
  `calculateFinance`, `computeSettlement`, `partnerSettlement`, `settlementBasis`,
  `finance_config`, `financeConfig`, `ghostWage`, `workedDaysFromBookings`, `PARTNER_SPLIT`,
  `calcWages` — **0 files each**.
* Two literal `pages/Finance` hits exist and are **accounted for, not waved away**: both sit
  inside `sourcesContent` **prose**, in the header comments of `pages/legacyFinanceClosure.js`
  and `pages/Marketing.js`, which explain what was removed. Neither is code and neither is the
  deleted engine.
* Retained: `Reports` 5 files · `Marketing` 7 · `Breakdown` 4 · `text/csv` 4 (the ledger's CSV
  export survives as `exportFinanceCSV`).
* Closure marker `legacy-finance-closed:v1` present in the reachable chunk.

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

Three measurements, all offline:

1. The **live** `salownRotaTransaction` build (`ef5c0ed`) contains **0** occurrences of
   `ROTA_OVERRIDE`. It cannot accept a dated override yet.
2. The **live** panel source (`ef5c0ed`) contains **5** direct browser `shiftChanges` write
   sites — 3 in `src/pages/Barbers.tsx`, 2 in `src/pages/Settings.tsx`.
3. The **new** bundles contain **0** write-shaped `shiftChanges:` occurrences in
   `hosting/public-bundle` and **0** in `hosting/staff-bundle`. Every remaining occurrence is a
   **read** (`e.shiftChanges?.[t]`) — the map stays a projection the fold still honours, which
   is what the rules change permits.

So if rules landed first, the browser clients that are live *right now* would start failing
their override writes with permission-denied while the Admin-SDK path that replaces them does
not yet exist. Functions first, then both salown hosting targets, then rules. **The order is
not changed.**

---

## 6. Rollback identity — one per unit

| Unit | Rollback |
|---|---|
| `salownRotaTransaction` | `salownrotatransaction-00001-biy` |
| `salownProvisionTeamMember` | `salownprovisionteammember-00001-log` |
| `salownRotaBootstrapTenant` | `salownrotabootstraptenant-00001-bup` |
| `salownRotaSeedTenantHistory` | **No prior revision — a CREATE.** Rollback is deleting that one function by exact name in `europe-west2`. Never a blanket `--only functions` |
| `salownCloseFinancePeriod` | **CREATE.** Same: delete by exact name, `europe-west2` |
| `salownEmailExitAgreement` | ⚠️ **UNPROVEN — must be read immediately before deploy** |
| `salownSendExitSignLink` | ⚠️ **UNPROVEN — must be read immediately before deploy** |
| `hosting:salown` | `fa3c670ddfbdc34a` |
| `hosting:salown-staff` | `9cd83c70960e062f` |
| `hosting:whitecrossbarbers-admin` | `982fcf79b4add1f1` |
| `hosting:whitecrossbarbers-owner` | `0b46e7a98bfca1f8` (**not** the admin id) |
| `firestore:rules` | Ruleset **`60abf8e4-e6ca-43e0-8bb7-26ef72ae58ba`**. Byte-exact source is reproducible from git: `git show ef5c0ed:firestore.rules` → **48,130 B**, sha256 **`b04f7745c5b420db3aaeeefdc7355e085f9115a28b573e7ed80ff1ba1b9809a4`**, which **matches the hash the ledger recorded from production**. A copy is staged for the release |

---

## 7. Modes and production state after this release

* `FINANCE_ROTA_HISTORY_MODE` = **`legacy`** (unchanged)
* `FINANCE_PERIOD_CLOSE_MODE` = **`legacy`** (unchanged)
* **Zero** period-close UI reads under legacy · no badge, no panel, no extra Firestore read
* **No** historical Finance movement — no figure moves
* **August 2026 remains OPEN**; no `financePeriods` document exists for any tenant
* Server release allowlist stays **`whitecross` 2026-02 … 2026-07** and nothing else
* **HeroHairs untouched**
* Every rota guard deployed here stays **inert** until a bootstrap declares a tenant canonical,
  and **no bootstrap is invoked**

### Included as inert / source deployment

ROTA-SSOT-2 server + client + rules support · Finance period-close callable and reader source ·
Finance P&L / badge source behind legacy mode · Whitecross legacy Finance removal ·
Staff 24-hour checkout fix.

### Excluded

Production bootstrap dry-run · seed · bootstrap apply · rota dated cutover · Finance period
close · period-closed cutover · the £7,939 liability representation · March–July closes · any
August operation.

---

## 8. Stopping conditions

Stop and do not continue if, at deploy time, any of these is true:

1. Any repo is dirty, or not `0/0` against `origin/main`, or an active claim overlaps.
2. Either Finance mode is not `legacy`.
3. Export count is not **78**.
4. `./scripts/deploy-functions.sh --check-only` does not return exactly **7 owned targets**.
5. **The live revision of `salownEmailExitAgreement` or `salownSendExitSignLink` cannot be
   read.** Deploying without a rollback identity is not a release, it is a one-way door.
6. A live identity read at deploy time disagrees with §1 — that means an **unrecorded
   deployment** happened and this manifest is stale.
7. Any gate in §3 does not reproduce.
8. `hosting:salown-admin` (`9f457fc2c8ee4b35`) moves. It is not a target of this release and
   is not deployable from either repo's config.

---

## 9. Open items this release does NOT close

* **`functions/src/index.ts` (365 problems) and `functions/src/finance/exit.ts` (12) are still
  unlinted**, and both ship here. Measured, not estimated: 274 + 11 `no-explicit-any`,
  63 + 1 `no-require-imports`, and **28 `no-unused-vars` on the main entrypoint**, which may
  not all be cosmetic. This is the widening the ESLint config already records as a separate
  change; folding 377 problems into a release-prep commit would have hidden them.
* **Two Functions have no recorded live identity** (§1.1). The `RELEASE_LEDGER` rule — *a
  release that appears in prose but not here has not been recorded* — has a matching blind
  spot: a function deployed before the ledger existed has no row, and nothing detects that.
* `SEC-CATCHALL-1` remains an asserted known exception.
* The python rules suites (`scripts/testStaffRotaRules.py` and friends) are **not** part of the
  registered `ops/test-rules-emulator.sh` gate; only the six `test/rules/*.emulator.test.js`
  suites are.
* `scripts/verifyReleaseManifest.mjs` is **A1-specific** — its invariants are literal to
  `RELEASE_MANIFEST_A1.md` (exactly seven Functions *of that release*, exactly three hosting
  units, `provisionTenant`/`T-h`). Running it against this file would report false failures. It
  is not a gate for R1.

---

## 10. Post-deploy verification — non-mutating only

Per target, after its own step:

* **Functions** — read each new revision id and traffic split; confirm exactly **7** revisions
  were created and no unnamed function moved; confirm `us-central1` is still **27**.
* **`hosting:salown`** — served entry chunk sha256 == `c61c6874…b15c9`; the previous entry chunk
  404s, proving the release moved.
* **`hosting:salown-staff`** — served `staff-SnJz1KZk.js` sha256 == `9f6c589e…bd3dc`.
* **Whitecross admin + owner** — served `main.99826fdd.js` sha256 == `cf041560…16d38` on
  **both** sites; sorted path+hash manifests byte-identical between the two versions.
* **Rules** — fetch the live source back out, hash it, `diff` against
  `salown-app/firestore.rules`; record the new ruleset id and `createTime`.

**Staff fix — non-mutating checks only:**

1. Staff bundle revision matches this manifest.
2. Whitecross presentation resolves to **24-hour**.
3. The walk-in time dropdown shows 24-hour labels.
4. The New Booking initial value is present among its options.
5. No `AM`/`PM` appears on any Whitecross Staff time surface.
6. Opening the flows produces no console error.

**A real Confirm Payment or Save Unpaid is a production mutation and is NOT part of this
release.** It requires its own bounded approval — see §11.

---

## 11. Separately gated: the Staff production-write test

This is prepared, **not** requested here, and must be approved on its own terms.

| Field | Value |
|---|---|
| Tenant | `whitecross` (the tenant that carries the defect) |
| Staff actor | the owner's own authenticated Staff session — **no credential typed, revealed or accepted by the releasing session** |
| Service | to be named by the owner from the live catalogue at approval time. Not chosen here: a service id picked from source could be stale or priced differently |
| Date / time | today, a time chosen from the walk-in picker — the value under test is the picker's own 24-hour output |
| Price / payment | the selected service's live price; method **Cash**; tip **0**; discount **0** |
| Does it remain? | ⚠️ **Undecided, deliberately.** A checkout is not reversible by design — it writes `paidAmount`, the receipt, loyalty points and `checkedOutAt`. The owner must choose **before** the test: (a) it **stays** as a real £N sale on a real trading day, or (b) a **separately approved** cancellation follows |
| Loyalty / receipt | a real client would receive a real receipt and real points. Use an anonymous walk-in with no contact, so `receiptPossible` is false and no email can be sent |
| Verification | the booking appears with the **expected time**, not 00:00 and not shifted; status `CHECKED_OUT`; `paidAmount` == the expected total; `checkedOutAt` stamped once; **no** "Checkout failed" toast on a successful write |
| Cleanup | whatever the owner chose above, executed openly and recorded |

**Do not create a test booking and then quietly delete it.** A deletion that nobody agreed to
is a second unapproved production write, and it removes the evidence of the first.

---

## 12. What preparing this manifest did NOT do

No deployment. No production Firestore or Auth read or write. No callable invoked, not even a
dry run. No live authenticated check. No booking, payment or checkout. No seed, bootstrap,
migration or backfill. No period close or adjustment. No mode cutover. No `RELEASE_LEDGER` row.
