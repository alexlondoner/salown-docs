# `FIN-DATED-ROTA-R2c` — Team Members canonical rota cutover: inventory, design gaps, release order

**Status: `BLOCKED`. Nothing was implemented in this pass and nothing was deployed.**
Zero production access, zero production write, zero backfill, zero scheduler, zero activation,
zero business-data mutation. No `firestore.rules` change, no `SYNC.md` change, no salown-app
source change.

This file is the work product of the R2c scoping pass: the complete writer inventory the brief
asked for, the three structural gaps that stop the cutover, the smallest server change that
closes the largest of them (measured on a real emulator, not asserted), and the coordinated
release order for when it is unblocked.

---

## 0. Why this is `BLOCKED` and not `PUSHED_NOT_LIVE`

Two hard stops, both of them independent of the engineering.

### 0.1 The stated prerequisite is not met — and is in flight in another session

The R2c brief opens with *"SEC-CATCHALL-1 must be accepted and pushed."* It is not.
`SEC-CATCHALL-1` is `PLANNED` in the Master Active Table, and section 5's acceptance bullet —
*"browser super-admin denial from `SEC-CATCHALL-1` remains intact"* — asserts a denial that does
not exist yet, so it cannot be satisfied by any amount of R2c work.

It is not merely absent, it is **being written right now**. At the time of this pass the shared
salown-app tree carried:

```
ops/claims/SEC-CATCHALL-1--alish--sec-catchall.claim
  owner: alish/sec-catchall     started_uk: 2026-08-16T10:05:00+01:00     status: working
  locked_paths:
    firestore.rules
    test/rules/staffRota.emulator.test.js
    test/rules/availabilityFrom.emulator.test.js
    test/rules/superAdminCatchall.emulator.test.js
    ops/test-rules-emulator.sh
    scripts/testStaffRotaRules.py
    scripts/testSuperAdminCatchallRules.py
    SYNC.md
```

with `firestore.rules` dirty in the working tree (`+76 / −12`).

### 0.2 Claim rule 7 — a competing claim is a hard stop, and it covers R2c's own paths

`firestore.rules` is section 5's entire subject. `SYNC.md` is half of section 7's delivery. Both
are LOCKED by that session. The protocol's rule 7 is explicit that a competing claim is a stop and
that "append anyway" is forbidden, shared registration files included. **This pass therefore
yielded on `firestore.rules`, `SYNC.md` and all five rules suites, and touched none of them.**

That yield is not a formality here: R2c's rules edit and `SEC-CATCHALL-1`'s rules edit are the same
`match /barbers/{docId}` block and the same root catch-all. Two sessions editing it concurrently is
precisely the scenario the claim system exists to prevent.

**Consequence for the brief's section 7:** `R2c = PUSHED_NOT_LIVE` cannot be recorded, because no
R2c implementation was pushed. Recording it would put a known-false status into the file the
project treats as the status SSOT. The true status is `BLOCKED`, and it is recorded as that.

---

## 1. Complete writer inventory

Every writer of `workingDays` / `dayHours` / `hours` on `tenants/{tid}/barbers/{id}`, and of the
related rota provenance/cache fields, classified. Read-only consumers are listed separately at the
end so "not a writer" is a stated finding rather than an omission.

### 1.1 Canonical rota intent — browser (must move behind `salownRotaTransaction`)

| # | Site | Shape | Fields | Rules verdict under R2b |
|---|---|---|---|---|
| W1 | `salown-app/src/pages/Barbers.tsx:451` | `setDoc(…, {merge:true})` — **the same call serves CREATE and UPDATE** | `workingDays`, `hours`, `dayHours` (all three on **every** save) | **CREATE allowed** (documented bootstrap exemption) · **UPDATE denied** |
| W2 | `salown-app/src/pages/Settings.tsx:545` | `runTransaction` + `tx.update` with **dotted paths**, via `buildBarberRotaUpdate` (`src/utils/barberHoursPropagation.ts:152`) | `dayHours.{Day}` per day, `workingDays` when membership changes — **across every barber in the tenant** | **UPDATE denied** |
| W3 | `whitecross-site/barber-panel/src/pages/Barbers.js:131` | `setDoc(…)` **without merge** | `workingDays`, `hours`, `dayHours` | **CREATE allowed · UPDATE denied** |

**W1 is the blocker R2b already named**, and the reason is subtler than "it writes the fields":
`Barbers.tsx:430-432` re-stamps `source: 'staff'` onto **every** day of `dayHours` on every save.
So a name-only save is a real `dayHours` diff whenever the propagation had previously marked a day
`salon`. `affectedKeys()` does not save it. Test 3e in `test/rules/staffRota.emulator.test.js`
asserts exactly this.

**W2 was verified, not assumed.** The R2b commit message records that an earlier version of its
test encoded the dotted write wrongly and had to be corrected — a dotted `dayHours.Tuesday` write
*is* caught by `affectedKeys()`.

**W3 is a finding of this pass and is not in R2b's record.** `barber-panel` is legacy but it is
still configured to **two live hosting targets** in `whitecross-site/firebase.json` —
`whitecrossbarbers-admin` (line 11) and `whitecrossbarbers-owner` (line 47), both serving
`barber-panel/build`, and that build directory is present in the repo. Whether either site is
still reachable or used is a production question this pass deliberately did not ask (no production
access). **Either way it is a third repo, with its own release discipline and an anchored-deploy
constraint, and it is on the R2b rules-deploy blast radius.**

### 1.2 Bootstrap — server (rules-bypassing; establishes cache with no canonical log)

| # | Site | Subject | Note |
|---|---|---|---|
| B1 | `salown-app/functions/src/index.ts:334` (`provisionTenant`) | the tenant **owner's own** barber doc | Admin SDK `.set()` — six working days + full `dayHours`, plus `availabilityFrom` |
| B2 | `salown-app/functions/src/index.ts:3490` (`approveApplication`) | the tenant **owner's own** barber doc | same shape; `availabilityFrom` may be a supplied future date |
| B3 | `salown-app/scripts/seedDemoTenant.cjs:357-359` | four demo staff | Admin SDK; demo tenant only |

**This is the most important inventory finding.** Closing the browser seam alone does not close the
bootstrap seam. B1 and B2 are *live, deployed, rules-bypassing* writers that create a barber
carrying authoritative rota cache and **no `staffRota` header at all** — the exact state R2c exists
to make unrepresentable. Every tenant provisioned or approved from now until they are changed
produces one.

### 1.3 Canonical publisher — server (the only writer that should survive)

| # | Site | Note |
|---|---|---|
| P1 | `salown-app/functions/src/staff/rotaWriter.ts:1175` and `:1417` — `tx.update(barberRef, {…publish})` | The R2 engine. Publishes exactly `toRotaBarberFieldUpdate(pattern)` = `workingDays` + optional `dayHours` + optional `hours` (`utils/rotaFold.ts:408`), gated by `rotaLegacyWriteGate` |

### 1.4 Repair — one-shot, already run

| # | Site | Note |
|---|---|---|
| R1 | `salown-app/scripts/correctWhitecrossCompPeriods.cjs:285,303,306` | Admin SDK; writes `workingDays` to restore the rota corrupted by the 2026-08-10 unaudited write. Historical; not a standing writer |

### 1.5 Unrelated barber writes — MUST keep working after the cutover

`Barbers.tsx:559` (status/`active`/leave + `leaves` archive) · `Barbers.tsx:589`, `:603`, `:617`
(`shiftChanges` today-only overrides) · `Barbers.tsx:544` (`deleteDoc`) ·
`Settings.tsx:488`, `:497` (`shiftChanges`) · `OnlineProfile.tsx:298`, `:305` (`photoUrl`, `bio`).

None of these name the three fields, so `affectedKeys()` already leaves them alone. `bringInToday`
(`Barbers.tsx:599`) **reads** `dayHours` to seed an override and writes only `shiftChanges` — a read,
correctly classified as unrelated.

### 1.6 Read-only consumers — stated so "missed" is distinguishable from "checked"

`src/utils/staffAvailability.ts` · `src/utils/availabilityWindow.ts` · `src/utils/financeWages.ts` ·
`src/utils/bookingUtils.ts` · `src/utils/compUtils.ts` · `src/components/OccupancyPanel.tsx` ·
`src/components/BlockTimeForm.tsx` · `src/staff/sheets/NewBookingSheet.tsx` ·
`src/staff/sheets/WalkInFlow.tsx` · `src/pages/Dashboard.tsx` · `src/pages/Clients.tsx` ·
`src/pages/Finance.tsx` · `src/pages/ManageBooking.tsx` · `src/pages/SalonSitePage.tsx` ·
`functions/src/bookings/createBooking.ts:342-354` · `functions/src/utils/weekHours.ts` ·
`whitecross-site/script.js:2393-2395` (premium booking site).

**`src/staff/**` contains no barber-document writer**, which is why the brief's "do not add
Staff-app rota controls" needs no action: there is nothing there to cut over.

**The super-admin console writes no barber document** — checked across `~/Desktop/alex/super-admin`,
zero `setDoc`/`updateDoc` against `barbers`.

---

## 2. Gap 1 — new-team-member bootstrap cannot be made atomic **today**, but the fix is small and is now measured

### 2.1 There is no server-authoritative team-member provisioning flow to extend

The brief says to prefer extending one. There isn't one for an ordinary team member:

* `createStaffUser` (`functions/src/index.ts:3039`) provisions **login identity** — a Firebase Auth
  user, `tenants/{tid}/staff/{uid}`, and the `tenantRole` claim projection. It never touches
  `barbers/{id}`.
* `provisionTenant` / `approveApplication` create a barber doc for **the owner only**, at tenant
  birth.
* An ordinary team member's `barbers/{id}` document is created **only** by the browser, at
  `Barbers.tsx:451` (and `barber-panel` W3).

So "create barber, then call `ROTA_START`" from the browser is exactly the two-step the brief
forbids: `salownRotaTransaction` can fail after the document is committed, leaving a barber with
authoritative cache and no canonical log — indistinguishable from a legacy record, and silently
bookable.

### 2.2 The engine refuses before the co-commit hook can help

`appendRotaChange` already carries the right extension point. `RotaWriterDeps.attachExtraWrite`
(`rotaWriter.ts:329`) is documented as existing *"so a future callable can co-commit its own
document with the append"*, is invoked inside the transaction after every read and before the
canonical writes, and must not read.

But in the same function:

```
rotaWriter.ts:1062   if (!barberSnap.exists) return { ok:false, reason: BARBER_NOT_FOUND, … }
rotaWriter.ts:1123   deps.attachExtraWrite(tx, { header, barber, audit, entries })
```

The refusal is **61 lines before the hook**. A provisioning caller never gets to create the subject.
`availabilityStartVerdict(barber, from)` (`rotaWriter.ts:864`) then reads the same snapshot.

### 2.3 Measured, not assumed: the transaction shape works

The open question was whether Firestore permits the caller's `tx.create(barberRef, …)` and the
engine's `tx.update(barberRef, {…publish})` in one transaction, given the engine's first act is
`tx.get(barberRef)`. Probed against the **repo-pinned emulator** (firebase-tools 15.26.0 /
`cloud-firestore-emulator-v1.22.0.jar`, the same pin `ops/test-emulator.sh` enforces), 4/4:

| Probe | Shape | Result |
|---|---|---|
| A | `tx.create(ref)` → `tx.update(ref)` | **COMMITTED**, both payloads present |
| B | `tx.create(ref)` → `tx.set(ref, …, {merge:true})` | **COMMITTED** |
| **C** | `tx.get(ref)` *(sees `exists:false`)* → `tx.create(ref)` → `tx.update(ref)` | **COMMITTED** — this is the engine's exact shape |
| D | `tx.create(ref)` → `tx.get(other)` | **THREW** — *"Firestore transactions require all reads to be executed before all writes."* |

C is the decisive one: the engine may read the subject as absent, the hook may create it, and the
engine may still publish onto it — all in one atomic commit. D confirms why `attachExtraWrite`'s
"MUST NOT read" contract and its position after all reads are load-bearing rather than stylistic.

> The probe was a scratch file. It was **not** added to the repo, because a real test for this
> belongs beside the change it proves, not ahead of it.

### 2.4 The smallest required server change

**Two units, no new engine concepts, no scheduler, no activator, no trigger.**

**(a) One optional dep on the engine — a provisioning subject.**

Add to `RotaWriterDeps` an optional `provisioningSubject?: Record<string, unknown>`, honoured
**only** when `req.action === 'ROTA_START'` **and** `barberSnap.exists === false`. When both hold,
`rotaWriter.ts:1062` does not return `BARBER_NOT_FOUND`; `barber` becomes the supplied subject, so
`availabilityStartVerdict` reads a real `availabilityFrom` and the `BEFORE_AVAILABILITY_FROM` /
`AVAILABILITY_FROM_MALFORMED` / `BACKDATED` gates keep their exact current meaning. Every other
action, and `ROTA_START` on an existing subject, is byte-unchanged.

The dep must be **server-only and never caller-supplied**, on the same footing as `nowMs` and
`serverTimestamp`, and it must be refused by name in the callable body like `actor`/`origin`/
`revision` already are.

**(b) One new callable — `salownProvisionTeamMember`.**

Authority: the same audited policy R2b pinned — owner|admin from the **stored** staff document,
super-admin break-glass, ordinary `staff` denied, re-read **inside** the write transaction through
the same decorated handle. Body:

1. Validate the profile payload (name, role, colour, order, status, `availabilityFrom`) through the
   existing `resolveAvailabilityFromWrite` contract. `availabilityFrom` is **required** on creation
   — `STAFF-START-A1.1` already made that true in all three statuses.
2. Compose the initial `RotaPattern` and call `appendRotaChange` with `provisioningSubject` set and
   an `attachExtraWrite` that does `tx.create(refs.barber, profileFieldsOnly)` — **profile fields
   only, with no `workingDays`/`dayHours`/`hours`**. The engine's own publish writes the cache, so
   the initial cache is materialised by accepted server logic and by nothing else.
3. `tx.create` (not `set`) makes the retry deterministic: a second attempt with the same barber id
   fails `ALREADY_EXISTS`, and the engine's existing per-`changeId` idempotency covers the log half.
   Neither half can commit without the other, so there is no partial state to recover.

**Why not the alternative.** Letting the browser create the document and *then* call `ROTA_START` is
the failure mode the brief names. Letting the engine create the subject itself would put profile
authorship inside a rota engine that deliberately knows nothing about names, colours or roles.

---

## 3. Gap 2 — the salon-hours propagation writer (W2) has no callable path at all

`salownRotaTransaction` is **single-subject**: one `barberId` per call, one transaction, one
`(expectedRevision, expectedEntriesHash)` pair. `Settings.tsx`'s opening-hours save is inherently
**multi-subject** — it currently rewrites `dayHours.{Day}` on *every* barber in one transaction.

Routing it through the callable means N sequential calls, each able to fail independently, and no
transaction spans them. A partial failure leaves the salon half-propagated, with no marker saying
so — which is a worse state than the one the rules deny, because it is *silently* inconsistent
rather than loudly refused.

This gap has the same shape as Gap 1 and is **not** solved by it. It needs its own decision, and
the decision is a product one, not only a technical one:

* **(i)** a salon-scoped canonical concept (a tenant-level rota period that staff periods inherit
  from) — the largest change, and the only one that makes the operation genuinely atomic;
* **(ii)** a multi-subject server callable that fans out and reports per-subject outcomes, with an
  explicit, visible partial state in the UI;
* **(iii)** withdraw automatic propagation: the salon's hours stop rewriting anyone's rota, and
  changing a person's week stays a per-person act.

**(iii) is the smallest and is worth taking seriously** — `barberHoursPropagation.ts` exists
because a previous full-document propagation destroyed rotas, and its own header records that the
salon fallback never enters availability resolution when a staffer has per-day hours. The
propagation may be solving less than it costs. **This is an owner decision and this pass did not
take it.**

---

## 4. Gap 3 — on day one of the cutover, *every* barber is a legacy barber

R2/R2b are not deployed and nothing has ever called the engine, so **no `staffRota` header exists
in any tenant**. The brief's section 2 treats "legacy barber without a canonical header" as an edge
case; it is currently 100% of production.

The good news is that this half is genuinely implementable and needs no new server surface:

* an absent header is not an error — `revision = 0` and `expectedEntriesHash = ROTA_CHAIN_GENESIS`,
  which `rotaWriter.ts` re-exports at line 1592 *specifically* so a caller composing its first
  change need not reach into the fold;
* the UI reads the stored document through `normalizeRotaPattern` (`utils/rotaFold.ts:369`, present
  in the frontend twin), which resolves the canonical array, the legacy `{Monday:true}` object and
  lower-case spellings, and returns `null` for the ambiguous empty array;
* the first edit of a legacy barber is therefore a **`ROTA_START`**, not a `ROTA_CHANGE`, on a
  subject that already exists — one atomic transaction, no partial state, no fabricated history.

Two constraints the implementation must honour rather than work around:

1. **No backdating.** `ROTA_START` with `effectiveFrom < today` is refused outright when no
   `availabilityFrom` is on record (`rotaWriter.ts:882`), and `BEFORE_AVAILABILITY_FROM` refuses it
   when one is. So a legacy barber's canonical log begins **today or later** and the period before
   it stays legacy-resolved. That is correct and must be stated in the UI — it is not a defect to
   be engineered around, and **no historical start date may be fabricated to smooth it over.**
2. **`availabilityFrom` must be present first.** `STAFF-START-A2` is still open: herohairs' single
   barber has no `availabilityFrom`. A `ROTA_START` for that member is refused as `missing` +
   past-dated, or succeeds only from today forward. **`STAFF-START-A2` is therefore a de-facto
   prerequisite of the R2c UI cutover** and this pass is the first to say so.

`rotaLegacyWriteGate` was checked and does **not** add a fourth gap: a normal weekly pattern in
force falls to the default `ALLOW('canonical')` branch, so an ordinary rota change does publish.
The blocking branches are `INVALID`, `BY_EXCEPTION_LEGACY_UNSAFE` and `UNCOVERED`, and `UNKNOWN`
allows in `legacy` mode. `source` is an accepted `dayHours` key (`DAY_HOURS_KEYS`,
`utils/rotaFold.ts:171`), so the pattern can carry the `staff` provenance stamp and the cutover
loses nothing there.

---

## 5. Coordinated release order, and rollback

Recorded now so it is not composed under deploy pressure later. **Nothing below has been done.**

**Prerequisites, all three, before step 1:**
`SEC-CATCHALL-1` accepted and pushed (in flight) · `STAFF-START-A2` closed (§4.2) · the Gap 2
owner decision taken (§3).

| # | Unit | Target | Why this position |
|---|---|---|---|
| 1 | Functions — `salownRotaTransaction` **+** `salownProvisionTeamMember` **+** the engine's `provisioningSubject` dep | `firebase deploy --only functions:salown:<exact names>` | Server first, always. Both callables together: a UI that can edit but not create is not a shippable state. **Never blanket** — a blanket functions deploy removes 27 us-central1 orphans |
| 2 | Hosting — `hosting:salown` (Team Members UI) | CI on push, or `--only hosting:salown` | Must not precede step 1: the UI would call a function that is not there. Must not follow step 3: the old UI would be denied by the new rules |
| 3 | `whitecross-site` — `barber-panel` retired or cut over (W3) | anchored release, `ops/rel*/` | Independent repo. **Blocks step 4**, because the new rules deny its `setDoc` |
| 4 | `firestore.rules` — R2b's UPDATE guard **plus** the CREATE exemption removed | `--only firestore:rules` | **LAST, always.** Only now is every writer either behind the server or gone |
| — | B1/B2 (`provisionTenant`, `approveApplication`) | — | **Not in this release.** They bypass rules, so they do not block step 4 — but until they route through `ROTA_START` they keep minting cache-without-log records. Track as a named follow-up, do not silently fold in |

**Rollback, per unit.** Steps 1–2 roll back by redeploying the previous revision / Hosting **version
id** (Console → Hosting → Release history → ⋮ → Roll back; `hosting:clone` is not a rollback tool).
Step 4 rolls back by redeploying the previous ruleset id. **Order reverses**: rules first, then
hosting, then functions — the rules are the strictest unit, so they must be the first thing
loosened and the last thing tightened.

**The one-way door:** step 4 is reversible, but any `staffRota` document written between steps 1
and 4 is **not**. The log is append-only in the engine (`tx.create`) and client-unwritable by rule.
A rollback restores the code, never the history. Nothing between steps 1 and 4 may be treated as a
trial.

---

## 6. Test matrix — specified, not run

Nothing here was executed, because there is no implementation to execute it against. Recorded so
the next pass inherits the list rather than re-deriving it.

**Existing barber:** `ROTA_CHANGE` success · a future-dated change advances the log and publishes
**nothing** · stale `revision`/`entriesHash` → refresh-and-review, never a silent overwrite ·
double-submit is idempotent on one `changeId` · server-owned keys (`actor`, `origin`, `audit`,
`revision`, `entriesHash`, `cacheState`, `channel`, timestamps) are **never** sent · legacy barber
with no header starts at `revision 0` + `ROTA_CHAIN_GENESIS` and takes the `ROTA_START` path.

**Provisioning:** create + `ROTA_START` commit atomically · failure at each of the three steps
leaves **no** document and **no** entry · retry is deterministic (`tx.create` → `ALREADY_EXISTS`
on the doc, `changeId` idempotency on the log) · no orphan cache and no orphan header ·
`availabilityFrom` in the future ⇒ not bookable before it, and the hidden-then-appears path is
still unproven in production (`STAFF-START-A1`).

**Negative / regression:** unrelated barber edits (name, colour, photo, status, leave, order,
`shiftChanges`) still succeed · no direct cache write remains in production UI source (assert over
`src/**` **and** `whitecross-site/barber-panel/src/**`) · rules deny direct cache writes on
**CREATE and UPDATE** · no Finance, payroll, booking, loyalty or receipt behaviour changes —
by token assertion **and** by reading the database back · no scheduler and no activator introduced ·
`convergeRotaCache` is still reached by nothing.

**Gates to run when there is code:** focused suites · full Functions + frontend suites · both
emulator phases · Rules Test API · the real Firestore emulator matrix · both typechecks · real
scoped lint proven non-vacuous · both builds · archive twice identical · deploy-policy ·
release-guard · `git diff --check` + UTF-8 / no-NUL / no-CRLF.

---

## 7. What this pass changed

`docs/ROADMAP.md` — one new `FIN-DATED-ROTA-R2c` row, `BLOCKED`, and this file linked from it.
`docs/FIN_DATED_ROTA_R2C_DESIGN.md` — this file.

Nothing else, in any repo. In particular: no `firestore.rules`, no `SYNC.md`, no rules suite, no
salown-app source, no `whitecross-site` change, and no deploy.
