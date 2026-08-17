# `FIN-DATED-ROTA-R2c` — Team Members canonical rota cutover

**Status: `PUSHED_NOT_LIVE`.** The implementation is on `origin/main` in three repositories.
**Nothing is deployed.** Zero production access, zero production read, zero production write, zero
backfill, zero migration, zero scheduler, zero activation, zero business-data mutation. No ruleset
was published; the live ruleset is unchanged and was not read.

| Repo | SHA | Contents |
|---|---|---|
| `salown-app` | **`af8f89a`** (bulk) + **`919e9a2`** (corrections) + **`cf52f7a`** (EV.1) | engine seam, four server modules, two callables, rules, Team Members cutover, salon-hours withdrawal, the future-activation gate, suites |
| `whitecross-site` | **`6a53ec44`** + **`83d5b83a`** (EV.1) | premium `barber-panel` cutover + document-integrity fixes + the future affordance |
| `salown-docs` | this file + `ROADMAP.md` + `SYSTEM_ARCHITECTURE.md` | — |

**What R2c supports, precisely:**

| | |
|---|---|
| CURRENT-date canonical rota | ✅ supported — start, change, end and supersede, all taking effect today |
| FUTURE-dated rota | ⛔ **disabled until `FIN-DATED-ROTA-R2d`** — refused server-side with `FUTURE_ACTIVATION_NOT_READY`; see §3.1 |
| Whitecross | canonical after the §9 cutover |
| HeroHairs | **bounded legacy**, until its barber's start date is a business fact (`STAFF-START-A2`) |
| `ROTA-B1B2` | named follow-up — owner-barber bootstrap still mints a cache-without-log record |
| `SALOWN-PANEL-1` | **RELEASE BLOCKER** — see §11 |

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

### 3.1 Future-dated changes are REFUSED until R2d (`R2c-EV.1`)

R2c's first pass accepted a future-dated `ROTA_START` / `ROTA_CHANGE` / `ROTA_END` and told the
owner *"a future date is recorded now and nothing changes on the calendar until that day"*. Only the
first half of that sentence was ever true. **Nothing changes on that day either**, because
`computeCacheConvergence` publishes the period covering TODAY and the thing that looks again on the
effective date — `convergeRotaCache` — is reached by no scheduler and no trigger.

So the product would have recorded an intention it cannot carry out, on an append-only log, behind a
screen that promised otherwise. The honest answer is not a better sentence:

> **Future-dated mutations fail closed until `FIN-DATED-ROTA-R2d` is live.**

**The capability, not a bug fix.** The engine is right — future-dating is the whole point of a dated
rota and the fold models it correctly. What is missing is a DEPLOYMENT fact: whether anything runs
on the effective date. So it is modelled exactly as R2b modelled `passiveAuthorityLive` — a proof
the deployment supplies, `RotaWriterDeps.futureActivationEnabled`, **defaulting to `false`**.

| Property | How |
|---|---|
| one stable reason | `FUTURE_ACTIVATION_NOT_READY` |
| server-owned | a **dep**, not an input. Absent from `RotaWriteInput`, absent from both request allowlists, and asserted absent from both |
| impossible to override | a body carrying it reaches the envelope validator, which does not know the name — negative control 3 proves the bypass fails |
| tenant-local today | the ENGINE's own `resolveTodayKey`, inside its transaction, via the TR-A precedence and `tenantTodayKey`. Never the browser, the device or the runtime's UTC day |
| one answer | the gate runs where the day is already resolved, so no second resolver can disagree across a midnight boundary |
| fail-closed default | a new caller that forgets the dep gets the safe behaviour, not the capable one |

**`provisionTeamMember` pre-checks as well**, and that is not a duplicate authority. It is the only
boundary with a side effect no transaction can roll back — creating a Firebase Auth account — so the
refusal must land before Phase A. A refused future-start member leaves **no Firestore document and
no orphan login**, proven on the emulator.

**The cutover is pinned to the tenant's current day.** A cutover is a controlled *current* act: dry
run, read the plan, apply, verify the salon, in one sitting. Dating it for next week would freeze
every member's schedule into an append-only log and wait for an activator that does not exist.

**`ROTA_SUPERSEDE` was reviewed separately and is deliberately NOT gated.** It withdraws; it carries
no `effectiveFrom` and no `effectiveTo` (asserted against the shared entry shape), the fold gives it
no lane, and it creates no effective state — so it cannot schedule anything. Gating it would be
actively harmful: a future change recorded before this shipped could then be neither activated (no
scheduler) nor withdrawn, **the one state with no way out**.

**Both admin UIs stop offering a date.** The picker is removed rather than offered with a caveat — a
control that must be remembered is a control that will be forgotten — and a new member's start date
is capped at today, because their rota starts on it. The client constants are **affordances, not
gates**: `rotaSurfaceGuard.test.ts` asserts the client and server constants agree, and a stale
cached bundle that still submits a date gets `FUTURE_ACTIVATION_NOT_READY` rendered as a sentence
that says what happened, why, and what to do instead — never "try again".

**Engine contracts still prove the capability.** `rotaWriter.test.js` and
`rotaWriter.emulator.test.js` pass `futureActivationEnabled: true` explicitly, so they read as what
they are: proofs of a capability production currently disables, ready for the day R2d turns it on.

**Known residue, stated rather than quietly excluded.** `ROTA_END` with `effectiveTo == today` is
not future-dated and is allowed; from tomorrow the subject is UNCOVERED and, with no activator,
nothing re-converges. That is R2's accepted `rotaLegacyWriteGate` behaviour (`UNCOVERED` blocks the
publish unless the subject is proven passive), it predates this gate, and it is not what EV.1 was
asked to change.

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
| Functions unit suite | **1657 tests, 1623 pass, 0 fail** |
| Functions emulator gate (both phases, pinned toolchain) | **466/466**, `firebase-tools 15.26.0` / `cloud-firestore-emulator-v1.22.0.jar` |
| Frontend suite (vitest) | **4047/4047**, 136 files |
| Rules emulator gate — 4 suites | **80/80** (`availabilityFrom` 17 · `staffRota` 21 · `rotaRollout` **21** · `superAdminCatchall` 21) |
| Rules Test API corpus | **104/104** (was 72/72 at R2b) |
| barber-panel suite | **31/31** |
| Typechecks | frontend ✔ · functions ✔ |
| Scoped lint (26 changed files) | **0 errors, 0 warnings**, proven non-vacuous |
| Repo lint delta | **0/0** on every changed file; 3245/6 pre-existing on untouched files |
| Builds | salown-app admin ✔ · barber-panel ✔ |
| Archive manifest ×2 from a clean tree | identical — **162 files**, `75bcfdc79bc40221…`, `ok: true` (160 → 162 = `rotaActivation.ts` + its compiled `lib/` output) |
| Callable export diff | **74 → 76** at R2c, exactly `salownProvisionTeamMember` + `salownRotaBootstrapTenant`. **EV.1 adds NO export** — 76 → 76, byte-identical |
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
| **EV.1** NC-A — remove the engine's future gate | 4 tests fail across three suites |
| **EV.1** NC-B — a boundary passes `futureActivationEnabled: true` | 3 tests fail |
| **EV.1** NC-C — the client constant disagrees with the server's | the parity test fails |
| **EV.1** NC-1 — capability ENABLED | the unsafe future write succeeds, which is what the gate holds back |
| **EV.1** NC-3 — the capability sent in the request body | ignored; the gate still refuses |

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

Recorded explicitly, because each was a deliberate property that this work supersedes. **An
inverted assertion is a decision, and a decision belongs in the record** — not in a diff somebody
has to reconstruct.

| Assertion | R2b | R2c |
|---|---|---|
| `staffRota.emulator §3f` "the bootstrap exemption must not survive into UPDATE" | always true | true **as soon as there is a history**. §3g demonstrates it on the same document, same principal, same write — the only change being that a header now exists |
| `rotaCallable §9a` / `rotaWriter §13d` "exactly ONE callable" | 1 | **3**, pinned by name. `convergeRotaCache` is still exposed by nothing |
| `rotaCallable §9b` / `rotaWriter §13b` engine importers | 1 | **3**, all under `functions/src/staff/` |
| `rotaCallable §9c` / `rotaWriter §13c` "no UI importer" | app names none of it | app names the **callables**; the engine, `appendRotaChange` and `convergeRotaCache` stay absent from every browser bundle |
| `rotaFold §11b` / `§23` "nothing in the product imports this core" | none | **exactly one** — `src/utils/rotaIntent.ts`. A page that imported the fold directly would be a second opinion about what a log means |
| `openingHoursWrite §7` "propagation must still happen" | required | **inverted** — required absent |
| **EV.1** `rotaCallable §5e` / `.emulator §3c` "a future change advances the log and publishes nothing" | true, and a trap — nothing published on the effective date either | **inverted** — the boundary REFUSES it, with zero writes |
| **EV.1** `provisionTeamMember §4b` / `.emulator §3c` "a future-start member commits and publishes nothing" | same trap: they arrive on day one with no `workingDays`, which reads as *available every day* | **inverted** — refused before Firebase Auth, no document and no orphan login |
| **EV.1** `rotaBootstrap §2b` "a later cutover date is allowed" | allowed | **inverted** — pinned to the tenant's current day |
| **EV.1** engine suites (`rotaWriter.test.js`, `.emulator`) | future-dating implicit | now pass `futureActivationEnabled: true` **explicitly**, so they read as proofs of a capability production disables |

---

## 9. Release order — CORRECTED, and NOT executed

**Prerequisites:** none outstanding except §11. `SEC-CATCHALL-1` ✅. `STAFF-START-A2` is **not** a
blocker — it blocks only HeroHairs' own cutover, which the rollout boundary defers by design. The
§5 propagation decision ✅ taken.

### 9.1 Why the rules move EARLIER, not last

R2c's first release order put `firestore.rules` last, on the general principle that the rules are
the strictest unit and therefore go last. That principle is right in general and **wrong here**, and
the reason is a property of the staged boundary rather than a preference:

> The staged rules are **behaviour-preserving while a tenant is legacy.** The exception is
> `!canonicalTenant && !subjectHasHeader`, and before a cutover **both halves hold for every
> subject**. So publishing them over a wholly-legacy platform changes nothing at all.

And publishing them last would open a window that does not otherwise exist. The bootstrap
transaction creates canonical headers; until the rules are published, a canonical barber is still
directly writable by any browser. That window is exactly the state R2c exists to make
unrepresentable, and the old order created it deliberately.

**This is executed evidence, not an argument.** `test/rules/rotaRollout.emulator.test.js` §8a loads
the ruleset **once** and never swaps it again: it exercises the legacy path (allowed), performs the
flip the way the cutover does — a canonical header, then the `rotaPolicy/rollout` write — and shows
the same ruleset now denying, with no redeploy between the two states. §8b shows the staged rules
changing nothing across a wholly-legacy platform.

### 9.2 The order

| # | Unit | Command | Why this position |
|---|---|---|---|
| 1 | capture live identities | Functions revisions, Hosting version ids, **the live ruleset id** | the rollback identities. The pre-change ruleset id is `STATUS_UNKNOWN` — fetch it here |
| 2 | Functions — all three rota callables | `./scripts/deploy-functions.sh salownRotaTransaction salownProvisionTeamMember salownRotaBootstrapTenant` | server first, always. All three together: a UI that can edit but not create is not a shippable state. The wrapper refuses a blanket target offline |
| 3 | `hosting:salown` | CI on push, or `--only hosting:salown` | must not precede 2 — the UI would call a function that is not there |
| 4 | whitecross `barber-panel` — **both** targets | anchored release: `whitecrossbarbers-admin` **and** `whitecrossbarbers-owner` | independent repo. Both serve `barber-panel/build`; releasing one leaves the other writing the old way |
| 5 | **verify every updated UI while Whitecross is still LEGACY** | — | the safest possible state to find a UI defect in: nothing is canonical, the legacy exception still applies, and a mistake is recoverable by a hosting rollback alone |
| 6 | **`firestore.rules`** | `--only firestore:rules` | **behaviour-preserving here** (§9.1), and it removes the post-bootstrap window. Rules are now in place BEFORE any canonical header exists |
| 7 | prove legacy Whitecross **and HeroHairs** editing still behaves | — | the staged rules' whole claim, verified on production before anything becomes canonical |
| 8 | **dry run** `salownRotaBootstrapTenant { tenantId: 'whitecross' }` | — | **re-read and PROVE all three `availabilityFrom` values.** Review the plan and the fingerprints |
| 9 | apply with the exact fingerprints | — | — |
| 10 | — | — | **the canonical rules become effective the instant the rollout transaction flips.** No redeploy, no direct-cache-write window (§8a) |
| 11 | verify canonical callable / UI / rules behaviour | — | — |
| — | HeroHairs | — | **NOT in this release.** Bounded-legacy until its barber's start date is a business fact |
| — | `provisionTenant` / `approveApplication` | — | **NOT in this release.** `ROTA-B1B2` |
| — | activation / `convergeRotaCache` | — | **NOT in this release.** `FIN-DATED-ROTA-R2d` |

### 9.3 Rollback

* **Before step 9 (the bootstrap):** ordinary per-unit rollback — Hosting by version id, Functions
  by revision, rules by the ruleset id captured at step 1. Nothing canonical exists yet, so every
  unit is independently reversible.
* **After step 9:** **history is append-only and cannot be rolled back by code.** The log is written
  with `tx.create` and is client-unwritable by rule; a rollback restores code, never history.
  Nothing between steps 6 and 11 may be treated as a trial.
* **The rules must NEVER be rolled back to a version that allows canonical direct cache writes while
  canonical headers exist.** That would leave a person whose rota is a history editable by a write
  that never appears in it — the exact defect, reintroduced by the recovery. If the rules must be
  reverted after a cutover, the cutover has to be reasoned about first.

---

## 10. Named follow-ups

| Id | What |
|---|---|
| `FIN-DATED-ROTA-R2d` | **the activator, and the only thing that unlocks future-dated rotas.** Until it ships, every future-dated `ROTA_START`/`ROTA_CHANGE`/`ROTA_END` is refused server-side with `FUTURE_ACTIVATION_NOT_READY` and neither admin UI offers a date (§3.1). Shipping it means: build the activator, prove it, and flip `ROTA_FUTURE_ACTIVATION_ENABLED` in `functions/src/staff/rotaActivation.ts` **together with** the thing that makes it true — plus the client constants in `src/utils/rotaIntent.ts` and `barber-panel/src/rota/rotaClient.js`, which a test pins to the server's value |
| `ROTA-B1B2` | route `provisionTenant` / `approveApplication` owner-barber creation through `ROTA_START`. They currently mint a bootstrap cache-without-log record — now **attributed** by an explicit `rotaPolicy/rollout` stamp rather than left as an absence |
| `STAFF-START-A2` | unchanged: HeroHairs' sole barber needs a real start date before that tenant can be cut over |
| `SALOWN-PANEL-1` | **RELEASE BLOCKER** — see §11. `STATUS_UNKNOWN` blocks step 8 of the release order |
| `FIN-GHOST-PASSIVE` residual | (a) passive-wage comp-close reliability and (b) the occupancy denominator remain open — **out of R2c's scope**, and `Barbers.tsx` was claimed by this session while it ran |
## 11. `SALOWN-PANEL-1` — a RELEASE BLOCKER, not an observation

`~/Desktop/alex/salown-panel/` is **not a git repository**, is in no claim registry, and its
`firebase.json` deploys to hosting target **`salown-admin`**. It holds a **byte-identical copy** of
`whitecross-site/barber-panel/src/pages/Barbers.js` and a near-identical `Settings.js`, so it writes
all three rota cache fields directly and still carries the unfixed 2026-08-10 propagation fan-out —
and it has a populated `build/`.

**EV.1 did not modify it, deliberately.** It has no release discipline and no owner, and editing a
deployable surface nobody owns is how a second unreviewed panel gets shipped.

**It is a blocker, and `STATUS_UNKNOWN` is not a pass:**

1. its live/retired status must be resolved by **read-only** Hosting target/artifact inspection —
   `firebase hosting:channel:list --site salown-admin --project havuz-44f70 --json`, and comparing
   the served bundle against `salown-panel/build` — **before step 8** of the release order;
2. **if it can edit Whitecross barbers, it must be retired or cut over before the canonical flip.**
   After step 9 a Whitecross barber has a canonical header, and this panel's saves would be denied
   mid-edit in front of whoever is using it;
3. `STATUS_UNKNOWN` blocks step 8. It is not an optional observation, and "probably retired" is not
   an answer — the whole point of a release blocker is that the unknown is resolved, not weighed.

---
