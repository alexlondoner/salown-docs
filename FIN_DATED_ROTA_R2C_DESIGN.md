# `FIN-DATED-ROTA-R2c` — Team Members canonical rota cutover

**Status: `PUSHED_NOT_LIVE`.** The implementation is on `origin/main` in three repositories.
**Nothing is deployed.** Zero production access, zero production read, zero production write, zero
backfill, zero migration, zero scheduler, zero activation, zero business-data mutation. No ruleset
was published; the live ruleset is unchanged and was not read.

| Repo | SHA | Contents |
|---|---|---|
| `salown-app` | **`af8f89a`** (bulk) + **`919e9a2`** (corrections) | engine seam, three server modules, two callables, rules, Team Members cutover, salon-hours withdrawal, suites |
| `whitecross-site` | **`6a53ec44`** | premium `barber-panel` cutover + document-integrity fixes |
| `salown-docs` | this file + `ROADMAP.md` | — |

> ⚠️ **Two commits are misattributed, and neither is being rewritten.** `af8f89a` carries the bulk
> of this implementation under a `claim:` message, because `git commit` without pathspecs commits
> the whole index and the index already held the staged work. The same mistake put this package's
> two deletions (`src/utils/barberHoursPropagation.ts` and its test) inside **another session's**
> claim commit `6565707`. `main` is shared and pushed, so rewriting it would be worse than the
> defect; both are recorded here and in `SYNC.md` instead. The lesson is the protocol's own rule:
> **commit with explicit pathspecs, always** — a bare `git commit` in a shared tree ships whatever
> anybody else has staged.

---

## 0. What R2c is

R2b landed a server boundary in front of the R2 rota engine and a `firestore.rules` change that
would make `workingDays` / `dayHours` / `hours` client-unwritable. It could not be deployed: the
Team Members editor still wrote those fields on every save, so publishing the ruleset would have
broken the screen.

R2c is the cutover. After it, a staff rota changes in exactly one way — a server transaction against
an append-only dated log — and the three legacy fields become the *published projection* of that log
rather than a setting anybody edits.

**Four owner decisions, fixed before implementation:**

1. add a server-authoritative, idempotent team-member provisioning flow;
2. **salon opening-hours changes must not rewrite staff rotas** — withdraw the propagation;
3. roll canonical rota out to **Whitecross first**; do not guess or backfill HeroHairs'
   `availabilityFrom`;
4. HeroHairs' existing legacy barber stays in a clearly bounded legacy mode until separately
   approved.

---

## 1. Writer inventory — reconciled against current `main`

The R2c scoping pass produced this inventory. It was re-derived from source after `SEC-CATCHALL-1`
and `FIRESTORE-RULES-SSOT-P0`, and **it was incomplete**. Three writers were missing and are added
below, marked **NEW**.

### 1.1 Canonical rota intent — browser

| # | Site | Before | After R2c |
|---|---|---|---|
| W1 | `salown-app/src/pages/Barbers.tsx` | one `setDoc(…, {merge:true})` served CREATE and UPDATE, and re-stamped `source:'staff'` onto all seven days on every save | profile-only merge + `salownRotaTransaction`; new members go through `salownProvisionTeamMember` and the browser creates no barber document at all |
| W2 | `salown-app/src/pages/Settings.tsx` | `runTransaction` + dotted `dayHours.{Day}` across **every barber in the tenant** | **REMOVED.** The module is deleted; the screen says where staff hours live |
| W3 | `whitecross-site/barber-panel/src/pages/Barbers.js` | `setDoc` **without merge** — a partial document that REPLACED the record | profile-only merge + the same two callables |
| **W4 NEW** | `whitecross-site/barber-panel/src/pages/Settings.js` | the **original** `updateAllBarbersDay()` — seven concurrent no-merge full-document writes, i.e. the literal code of the 2026-08-10 lost-update incident, never fixed here | **REMOVED** |

**W4 is the most serious omission of the scoping pass.** `BARBER-HOURS-PROPAGATION-RACE-P0` fixed
salown-app's copy and nobody checked the premium panel, which has been serving the unfixed version
on two live hosting targets ever since.

### 1.2 Bootstrap — server (rules-bypassing)

| # | Site | Status after R2c |
|---|---|---|
| B1 | `functions/src/index.ts` `provisionTenant` | unchanged shape; now stamps an explicit bounded-legacy `rotaPolicy/rollout` record |
| B2 | `functions/src/index.ts` `approveApplication` | same |
| B3 | `scripts/seedDemoTenant.cjs` | unchanged (already A1.1-compliant) |
| **B4 NEW** | `scripts/seedTrDemoTenant.cjs` | **wrote four barbers with NO `availabilityFrom`** — brand-new legacy records created behind the `STAFF-START-A2` backfill. Missed by A1.1 *and* by the R2c scoping pass. Fixed |

### 1.3 Canonical publisher — server

`functions/src/staff/rotaWriter.ts` — the R2 engine. Still the only writer of the three fields.

### 1.4 Out of scope, and named rather than omitted

| Site | Finding |
|---|---|
| **`~/Desktop/alex/salown-panel/`** | **NOT A GIT REPOSITORY.** An untracked local directory containing a **byte-identical copy** of `barber-panel/src/pages/Barbers.js` and a near-identical `Settings.js`, with a `firebase.json` that deploys to hosting target **`salown-admin`** and a populated `build/`. It writes all three cache fields and carries the unfixed propagation. It is outside both claim registries and has no release discipline, so R2c did not touch it. **Whether `salown-admin` is live is `STATUS_UNKNOWN`** — answering it needs a production read this session did not take. If it is live, it is on the rules-deploy blast radius. |
| `barber-panel/src/firestoreActions.js:477` `seedBarbers()` | Exported, imported by nothing, and **broken**: the path is `'tenants/${tenantId}/barbers'` in SINGLE quotes, so it addresses a literal collection. Dead code; writes no cache field. Left alone. |
| `scripts/correctWhitecrossCompPeriods.cjs` | the one-shot 2026-08-10 repair. Historical, not a standing writer |
| `scripts/wageDriftAudit.cjs` | read-only (`mode: 'read-only'`) |
| `src/staff/**` (Staff app) | **zero** barber-document writers — confirmed again |
| `super-admin/` | **zero** barber-document writers — confirmed again |

---

## 2. The rollout boundary — two conditions, not one

The central design decision, and the thing that made a Whitecross-first release possible at all.

```
PER-TENANT    tenants/{tid}/rotaPolicy/rollout.mode == 'canonical'
              A DECLARATION. Creation has no history to look at — that is the whole
              bootstrap seam — and a cutover is a release event somebody performs.

PER-SUBJECT   tenants/{tid}/staffRota/{barberId} EXISTS
              NOT a declaration. It becomes true the moment the engine commits that
              person's first transaction, so it cannot drift out of step with the
              log: it IS the log's header.
```

The narrow legacy exception is `!canonicalTenant && !subjectHasHeader` — and **both** halves are
load-bearing:

* without the tenant half, a cut-over salon's barber who happens to have no header yet would still
  be directly writable;
* without the subject half, a person whose rota is a *history* could have that history contradicted
  by a write that never appears in it — "a canonical barber cannot fall back to a direct cache
  write" becomes a **property** rather than a policy, with no flag anybody can forget to set.

**Why a subcollection and not a feature flag.** `tenants/{tid}` is client-writable by any tenant
admin (the `[P1-D]` update rule), so a rollout flag living there would be forgeable by exactly the
role it constrains. Adding it to `[P1-D]`'s super-admin-only key list does not help either — that
clause sits *below* an `isSuperAdmin()` short-circuit. A tenant subcollection is already
write-closed for every browser role by the `[G4]` catch-all, and `rotaPolicy` is then restated
explicitly, exactly as `staffRota` is, so a future `[G4]` edit cannot open it silently.

**Absence resolves to LEGACY**, which is the fail-safe direction: it is what every tenant is today,
and a missing or half-written document can only make the boundary *looser* — never stricter — so a
bug here cannot lock a salon out of its own team page. The strict half does not depend on it at all.

**Cleanup condition, pinned in `firestore.rules` beside the helpers:** when every active tenant is
`canonical`, both helpers and both call sites are **deleted**, `allow create` returns to the plain
role disjunction and `allow update` returns to R2b's unconditional form. That is a removal, not a
rewrite.

---

## 3. Atomic provisioning — and the boundary that honestly is not

`salownProvisionTeamMember`. One Firestore transaction commits the profile document, the canonical
`ROTA_START`, the rota header, its entry and two audit records.

**The engine seam.** `RotaWriterDeps.provisioningSubject` — a **server-only** dep, honoured under
exactly two conditions together: `action === 'ROTA_START'` **and** `barberSnap.exists === false`. A
stored subject always wins, so the dep can never shadow or contradict one. Every other action, and
`ROTA_START` on an existing subject, is byte-unchanged; ordinary `ROTA_START` on a missing barber
still returns `BARBER_NOT_FOUND`. The callable refuses `provisioningSubject` by name in the request
body alongside `tenantId`, `actor`, `origin` and `revision`.

**`attachExtraWrite` co-commits PROFILE FIELDS ONLY** — never `workingDays`, `dayHours` or `hours`,
not at creation, not ever. The initial cache is materialised by the engine's own publish path from
the accepted convergence, or it is not materialised at all.

**Firebase Auth cannot join a Firestore transaction**, and this is not papered over. The optional
login half is three phases, and the safety argument is *convergence on retry*, not atomicity:

| Failure point | State left behind | Why a retry fixes it |
|---|---|---|
| A (Auth) | nothing, anywhere | retry from the top |
| A ✔, B ✘ | an Auth account with no Firestore state | the retry **adopts** it, by email, reaching the same uid. Nothing is bookable, nothing is payable, no rota exists — a barber document is exactly what did not get written |
| B ✔, C ✘ | staff document exists, claim does not | every rota fact is already correct; `applyTenantClaims` is a merge, so re-applying is a no-op. The O1 order (document = authority, claim = projection) is what makes this recoverable |
| all ✔, retry | — | the engine's per-`changeId` idempotency returns `replay` with **zero** writes, *before* `attachExtraWrite` runs |

The one state a retry may **not** absorb is a barber document that exists but was not written by
this flow: refused by name (`BARBER_EXISTS`). Its own prior commit is distinguished from a stranger's
document by the presence of the deterministic provisioning audit record — an exact test, not a guess.

### 3.1 The future-start gap — real, bounded, and not engineered around

A member whose rota starts in the **future** commits a canonical log and **no cache**:
`computeCacheConvergence` materialises the period covering *today* and no other. They are not
bookable before `availabilityFrom` (A1, an absolute stop evaluated before the weekly pattern), so
the specified contract holds exactly.

What does **not** hold without an activator is the day *after*: an absent `workingDays` reads as
"available every day" to `staffAvailability.worksOnDay`. Writing the cache at provisioning time
would "fix" it by making the caller a second publisher of the three fields — which is the entire
defect R2c removes — so it is **not** done.

**The gap is inherited from R2** (`convergeRotaCache` is still reached by nothing), the brief
explicitly excludes an activator from R2c, and it **cannot bite until a canonical tenant hires
somebody with a future start date**. Whitecross — the first canonical tenant — has three past-dated
staff and no pending hire. That same event is the one `STAFF-START-A1` has been waiting on to prove
its hidden-then-appears path. Tracked as `FIN-DATED-ROTA-R2d` (activation).

---

## 4. Migration — prepared, guarded, and NOT run

`salownRotaBootstrapTenant`, **super-admin only** (R2b's owner|admin policy governs one person's
rota; this declares a whole salon's rota server-owned and writes irreversible history for every
member — the `adminPurgeTenant` / `approveApplication` class).

* **`dryRun` defaults to TRUE.** Omitting it cannot write.
* **Two-phase precondition.** The dry run returns a `sourceFingerprint` per subject, over exactly
  the five inputs a rota decision depends on (`workingDays`, `dayHours`, `hours`,
  `availabilityFrom`, `status`) using the accepted fold's own hash. The apply must hand every one
  back; a subject whose source moved is `SOURCE_CHANGED` and **nothing is written for it**. A
  content hash is used rather than `updateTime` because the engine takes its Firestore handle
  structurally, and because a content hash does not fire on a no-op write.
* **No backdating** — stricter than the engine on purpose. `buildAppend` permits a `ROTA_START`
  back to a stored `availabilityFrom`, because for a brand-new member that is a fact; for a
  migration it is a restatement of days already worked and already priced.
* **No fabricated history.** The period before the cutover date stays legacy-resolved and no entry
  is written for it.
* **Eligibility:** `passive` is SKIPPED (a departed member's rota is not a thing to freeze);
  an ACTIVE subject with no usable `availabilityFrom` or no usable pattern **BLOCKS the tenant
  flip**. That is `STAFF-START-A2` in executable form — HeroHairs' sole barber refuses by id, and
  the module will not invent a date to make the run succeed.
* **All-or-nothing flip.** A half-flipped salon — some staff behind the server, some not, no marker
  saying which — is unrepresentable.
* **One deterministic audit** for the run; the per-subject audits are the engine's own.
* **A cutover changes no availability.** Proven, not assumed: the frozen pattern is the one the
  document already carries, so convergence finds nothing to publish and the barber document is
  byte-unchanged by its own migration.

**Whitecross's three staff are recorded as carrying valid `availabilityFrom`. That is memory, not
evidence.** The release session must re-read and prove it before any mutation.

---

## 5. Salon-hours propagation — withdrawn

`propagateSalonHoursToBarbers` and the whole `src/utils/barberHoursPropagation.ts` module are
**deleted**, on both panels. Rerouting through the callable was rejected: it is N independent calls
with no transaction spanning them, which leaves a salon half-propagated with **no marker saying so**
— worse than the state the rules refuse, because it is silently inconsistent rather than loudly
declined. And it would mean the salon's opening hours could still restate a person's working week,
which is the mechanism `FIN-DATED-ROTA` exists to remove.

**What is lost, honestly:** the propagation did one job nothing else does — it added and removed the
day from `workingDays`, and `worksOnDay` gates *before* the salon fallback is reached. So opening a
new salon day no longer makes every barber available on it. Both Opening-hours screens now say so on
screen, rather than leaving an owner to discover an empty Sunday from a customer.

`openingHoursWrite.test.ts`'s assertion is **inverted**: it used to require propagation, and now
requires its absence — by name, by shape, and by the module being gone from the tree.

---

## 6. FIN-GHOST-PASSIVE — document integrity in the premium panel

Folded into this package because both defects are inside the path R2c already owns.

1. **`toggleBarberActive` wrote `{ active }` alone**, minting `status:'active', active:false`.
   `barberStatusOf` returns `status` whenever it holds one of the three literals, so the
   `active === false` fallback is **unreachable** on such a record: every passive-authority surface
   reads a deactivated barber as ACTIVE and keeps offering their slots, while `OccupancyPanel`
   (filtering on `active !== false`) drops them. Two surfaces failing in opposite directions on one
   document. Both fields now travel together; the card and the button read the canonical status.
2. **The save used `setDoc` with no merge** — a partial document that REPLACED the record, deleting
   `status`, `availabilityFrom`, `leaves`, `leaveFrom`/`leaveUntil`, `role`, `services` and
   `shiftChanges`. Two of those are safety boundaries. Now `{merge:true}` and profile-scoped.
3. **Leave is refused, not guessed.** salown-app's equivalent archives the outgoing range into
   `leaves[]` before clearing it, so wage math never re-counts those days. This panel has no leave UI
   and no archive helper; porting one would be a second implementation. It stops and says where the
   decision belongs.

Regression tests run against a Firestore write **simulator**, because `{merge:true}` versus no-merge
*is* the behaviour under test and a mock recording call arguments would pass either way. Both
negative controls fire.

**Whether a divergent-status document exists in production is `STATUS_UNKNOWN`** — it needs a
production read this session did not take.

---

## 7. Evidence

| Gate | Result |
|---|---|
| Functions unit suite | **1638 tests, 1604 pass, 0 fail** |
| Functions emulator gate (both phases, pinned toolchain) | **466/466**, `firebase-tools 15.26.0` / `cloud-firestore-emulator-v1.22.0.jar` |
| Frontend suite (vitest) | **4043/4043**, 136 files |
| Rules emulator gate — 4 suites | **78/78** (`availabilityFrom` 17 · `staffRota` 21 · `rotaRollout` **19** · `superAdminCatchall` 21) |
| Rules Test API corpus | **104/104** (was 72/72 at R2b) |
| barber-panel suite | **25/25** |
| Typechecks | frontend ✔ · functions ✔ |
| Scoped lint (26 changed files) | **0 errors, 0 warnings**, proven non-vacuous |
| Repo lint delta | **0/0** on every changed file; 3245/6 pre-existing on untouched files |
| Builds | salown-app admin ✔ · barber-panel ✔ |
| Archive manifest ×2 from a clean tree | identical — **160 files**, `a3a622a5701224f2…`, `ok: true` (154 → 160 = 3 modules + their 3 compiled `lib/` outputs) |
| Callable export diff | **74 → 76**, exactly `salownProvisionTeamMember` + `salownRotaBootstrapTenant` |
| rules-authority | **30/30** · deploy-policy ✔ · functions-ownership ✔ · release-guard 19/19 · whitecross rules-authority ✔ |
| Hosting target parity | `firebase.json` byte-identical; both whitecross targets preserved |
| `git diff --check` | clean · no NUL byte · all changed files valid UTF-8 |

### 7.1 Mutation controls — the matrix can fail

| Control | Effect |
|---|---|
| rules M1 — drop the tenant condition | the canonical edit becomes ALLOWED |
| rules M2 — drop the subject condition | a migrated barber on a legacy tenant becomes writable |
| rules M3 — open `rotaPolicy` | owner demotes their own tenant **and then rewrites the cache** — the attack, executed |
| rules M4 — drop the create clause | browser barber creation re-opens |
| panel NC1 — restore the half-write toggle | 1 test fails |
| panel NC2 — restore the non-merge `setDoc` | 4 tests fail |
| lint NC — inject an unused const | reported in both a functions module and a frontend module |

### 7.2 Two findings the gates produced

* **The new functions modules were silently UNLINTED.** `functions/src/**/*.ts` matches no eslint
  config block, so all three reported *"File ignored because no matching configuration was
  supplied"* — which reads like a pass. This is R2-EV.1's defect recurring, and the recurring cost
  of not widening the block is now recorded in `eslint.config.js` itself.
* **The Rules Test API corpus was partly vacuous.** R2c's clauses call `exists()`/`get()`, which the
  Test API does not resolve without `functionMocks` — an unresolved access is an evaluation *error*,
  and an error denies. Every R2c DENY was therefore "passing" for the wrong reason and would have
  gone on passing with the guard deleted. Mocks added; corpus 72 → 104.

---

## 8. Assertions that CHANGED, and why

Recorded explicitly, because each was a deliberate R2b property that R2c supersedes.

| Assertion | R2b | R2c |
|---|---|---|
| `staffRota.emulator §3f` "the bootstrap exemption must not survive into UPDATE" | always true | true **as soon as there is a history**. §3g demonstrates it on the same document, same principal, same write — the only change being that a header now exists |
| `rotaCallable §9a` / `rotaWriter §13d` "exactly ONE callable" | 1 | **3**, pinned by name. `convergeRotaCache` is still exposed by nothing |
| `rotaCallable §9b` / `rotaWriter §13b` engine importers | 1 | **3**, all under `functions/src/staff/` |
| `rotaCallable §9c` / `rotaWriter §13c` "no UI importer" | app names none of it | app names the **callables**; the engine, `appendRotaChange` and `convergeRotaCache` stay absent from every browser bundle |
| `rotaFold §11b` / `§23` "nothing in the product imports this core" | none | **exactly one** — `src/utils/rotaIntent.ts`. A page that imported the fold directly would be a second opinion about what a log means |
| `openingHoursWrite §7` "propagation must still happen" | required | **inverted** — required absent |

---

## 9. Release order — recorded, NOT executed

**Prerequisites:** none outstanding. `SEC-CATCHALL-1` ✅ landed. `STAFF-START-A2` is **no longer a
blocker** — it blocks only HeroHairs' own cutover, which the rollout boundary defers by design. The
§3 propagation decision ✅ taken (withdrawn).

| # | Unit | Command | Why this position |
|---|---|---|---|
| 1 | capture live identities | Functions revisions, Hosting version ids, **the live ruleset id** | the rollback identities. The pre-change ruleset id is currently `STATUS_UNKNOWN` — fetch it here |
| 2 | Functions | `./scripts/deploy-functions.sh salownRotaTransaction salownProvisionTeamMember salownRotaBootstrapTenant` | server first, always. All three together: a UI that can edit but not create is not a shippable state. **Never blanket** — the wrapper refuses it offline |
| 3 | `hosting:salown` | CI on push, or `--only hosting:salown` | must not precede 2 (the UI would call a function that is not there); must not follow 6 (the old UI would be denied) |
| 4 | whitecross `barber-panel` | anchored release, **both** targets: `whitecrossbarbers-admin` **and** `whitecrossbarbers-owner` | independent repo; blocks 6, because the new rules deny its old `setDoc` |
| 5 | **dry run** `salownRotaBootstrapTenant { tenantId: 'whitecross' }` | — | **re-read and PROVE all three `availabilityFrom` values first.** Review the plan and the fingerprints |
| 6 | apply the cutover with the exact fingerprints | — | flips `whitecross` to `canonical`. **One-way:** the log is append-only and client-unwritable; a rollback restores code, never history |
| 7 | verify callable + UI behaviour | — | before the rules make the old path impossible |
| 8 | `firestore.rules` | `--only firestore:rules` | **LAST, always.** Only now is every writer either behind the server or gone |
| 9 | verify rules + rollback readiness | — | — |
| — | HeroHairs | — | **NOT in this release.** Stays bounded-legacy until its barber's real start date is a business fact |
| — | `provisionTenant` / `approveApplication` routing through `ROTA_START` | — | **NOT in this release.** Tracked as `ROTA-B1B2` |
| — | activation / `convergeRotaCache` | — | **NOT in this release.** Tracked as `FIN-DATED-ROTA-R2d` |

**Rollback order reverses:** rules first, then hosting, then functions — the rules are the strictest
unit, so they are the first thing loosened and the last thing tightened.

---

## 10. Named follow-ups

| Id | What |
|---|---|
| `FIN-DATED-ROTA-R2d` | the activator. Until it ships, a future-start member on a canonical tenant has no published cache on their start date (§3.1) |
| `ROTA-B1B2` | route `provisionTenant` / `approveApplication` owner-barber creation through `ROTA_START`. They currently mint a bootstrap cache-without-log record — now **attributed** by an explicit `rotaPolicy/rollout` stamp rather than left as an absence |
| `STAFF-START-A2` | unchanged: HeroHairs' sole barber needs a real start date before that tenant can be cut over |
| `SALOWN-PANEL-1` | `~/Desktop/alex/salown-panel/` — an untracked, unclaimed, deployable copy of the old panel. Is `salown-admin` live? `STATUS_UNKNOWN` |
| `FIN-GHOST-PASSIVE` residual | (a) passive-wage comp-close reliability and (b) the occupancy denominator remain open — **out of R2c's scope**, and `Barbers.tsx` was claimed by this session while it ran |
