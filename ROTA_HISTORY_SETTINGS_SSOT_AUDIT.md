# `ROTA-HISTORY-SETTINGS-SSOT-AUDIT`

**Two parts, deliberately kept apart.**

- **Part A — source audit (§1–§9).** Read-only. Zero production reads, zero writes, zero deploys,
  zero migration. Every claim is anchored to source in `salown-app` @ `ef5c0ed` and `whitecross-site`
  @ `18946538`, or to a live-bytes finding already recorded in `FIN_DATED_ROTA_R2C_DESIGN.md` §11.
- **Part B — production evidence (§1A).** A separately authorized, read-only probe of the Whitecross
  tenant, 2026-08-17. Its findings are recorded in their own section and are **never merged into
  Part A's source claims**, so a reader can always tell which sentence came from reading code and
  which came from reading production.

Part A was written *before* Part B and is preserved as written, including the hypotheses Part B went
on to test. Where Part B changes an answer it says so in Part B; Part A is not retro-edited into
looking prescient. **Neither part proposes a production mutation**, and §1A's probe must not be
repeated or widened.

**Trigger.** The owner set Alex's **Tuesday from OFF to ON on 2026-08-16** and asked two questions:
*did that touch the past?* and *why are there two staff-shift control surfaces?*

---

# Part A — source audit

## 1 · Verdict — the Alex Tuesday scenario

> ### `MIXED_BY_CONSUMER`
> — dominated by **`YES_RETROACTIVE_REINTERPRETATION`**, with a second, surface-dependent
> **`YES_DIRECT_HISTORY_MUTATION`** that is not about bookings at all.

**What is settled.**

1. **No past booking, receipt, checkout, tender or stored wage entry was rewritten.** The toggle
   writes one field — the undated `barbers/{id}.workingDays` array — plus its `dayHours`/`hours`
   summary. Nothing in either admin UI touches a historical document.
2. **Every Finance figure for a past Tuesday now answers differently.** This is not a maybe. The
   central wage rule reads *today's* array for *any* date:

   ```ts
   // src/utils/financeWages.ts:331-332
   const wdays = Array.isArray(barber?.workingDays) ? barber.workingDays : []
   if (wdays.length > 0) return !!sc || wdays.includes(dayName)
   ```

   The only date bounds above it are `wageStartDate ?? startDate` and, in `'periods'` mode, the
   `staffComp` employment interval. **Neither bounds a weekday change.** The module's own header says
   it: *"editing it today silently re-prices every past month"*, and it is already an invariant —
   **`INV-PARA-14`**.
3. **This exact class of event has happened before, on this tenant, for real money.** Arda's
   `workingDays` collapsing to one weekday moved ≈**£12,300**; the correct repair on 2026-08-13 moved
   another **≈£12,300** back, *by the same mechanism* (`INCIDENTS.md` 2026-08-12, ROADMAP §578).
   A rota edit re-pricing history is the documented behaviour of the system as deployed.

**Blast radius — bounded, and countable without a production read.**

| | |
|---|---|
| Lower bound | `max(staffComp.effectiveFrom, partnerConfig wageStart)`. Alex's `effectiveFrom` is **`2026-02-06`** (ROADMAP master table, `FIN-EFFECTIVEFROM-BACKDATE`, `LIVE_VERIFIED`) |
| Affected days | **at most 27 Tuesdays**, `2026-02-10` → `2026-08-11` — upper bound, correctly derived. **Measured net: 18** (§1A B.3) |
| Money delta | `27 × Alex's stored daily rate`, added to every recomputed P&L / Total Wages / partner + staff Wages Earned / G4 weekly ledger that spans those days |
| Comp-period gate | **cannot help.** `'periods'` mode is `LIVE_VERIFIED` (hosting `2620fb29bf2e064e`, source `d9bdbc5`), but Alex's period is *open* and starts 2026-02-06, so every past Tuesday is *inside* employment |
| Period closing | **does not exist.** `financePeriodClose.ts` is imported only by `financePeriodPreview.ts` and tests — no live consumer, no frozen snapshot. `FIN-PERIOD-CLOSE` is `PLANNED` |

**The second finding, and it may matter more than the first.**

Which surface was used decides whether the barber *document* survived.

| Surface | Live save shape | Consequence of one Tuesday toggle |
|---|---|---|
| `salown.com/app` → Team Members | `setDoc(..., { merge: true })` — `src/pages/Barbers.tsx:451` (pre-R2c `af8f89a^` identical) | Only the rota fields move. **Safe.** Writes a `BARBER_UPDATED` audit record carrying `changes.workingDays: [before, after]` |
| `whitecrossbarbers-admin` / `-owner` → Team Members | **two-argument `setDoc`, NO merge** — verified in *served production bytes*, release `2026-07-21T14:57:43Z`, both targets byte-identical | **The document is REPLACED by 9 fields.** `status`, `availabilityFrom`, `leaves`, `leaveFrom`, `leaveUntil`, `role`, `services`, `shiftChanges` are **deleted**. Writes **no audit record** |

The premium panel is the one the owner uses for Whitecross, and **`availabilityFrom` for all three
Whitecross staff was migrated by hand on 2026-08-15 — the day before this toggle.** If the toggle
went through that panel, Alex's `availabilityFrom` (and any `shiftChanges` and `leaves` history) was
destroyed roughly 24 hours after being set, and `status` was dropped alongside it.

**The discriminator is one cheap read, and it is unambiguous.** `tenants/whitecross/auditLogs` either
holds a `BARBER_UPDATED` document timestamped 2026-08-16 with `changes.workingDays` — in which case
salown-app did it under `{merge:true}` and nothing else was lost — or it does not, in which case the
premium panel did it and the field loss is not a hypothesis.

> ⚠️ **Cross-reference — this discriminator was tested and it FAILED.** Production returned no audit
> record **and** intact fields, which is neither branch. See **§1A B.2**: the writer is unidentified,
> and "fields intact" is not "writer safe". The paragraph above is left as written because it is the
> hypothesis the probe was designed to test; it is **not** the finding.

**What R2c / R2d do *not* fix — correcting one assumption in the brief.**

The target behaviour in the brief (pre-boundary Tuesdays stay OFF, post-boundary ON, closed periods
frozen) is **not** delivered by `FIN-DATED-ROTA-R2c` or `R2d`. R2c makes the rota a dated,
append-only log and stops browsers publishing the cache; R2d adds the activator. But:

> **No Finance consumer reads the rota log.** `rotaFold.ts` has exactly one importer in the product —
> `src/utils/rotaIntent.ts` — pinned by test (`FIN_DATED_ROTA_R2C_DESIGN.md` §8). Finance reads
> `barbers.workingDays`, i.e. the projection of the *current* period only.

So after R2c+R2d ship, the *history* exists and Finance still ignores it. Delivering the owner's
table needs a third, currently **unnamed** item — proposed here as **`FIN-ROTA-HISTORY-READ`** —
plus `FIN-PERIOD-CLOSE`. Naming it is part of this audit's output.

---

# Part B — production evidence

## 1A · Accepted read-only production evidence (2026-08-17)

**Provenance.** A separately authorized, read-only probe of tenant `whitecross`. No write, no
deploy, no migration, no callable invocation. **Do not repeat it and do not widen its scope** —
everything it can settle, it has settled, and everything it cannot settle is named below as
belonging to the bootstrap dry run instead.

> ### Outcome: `ALEX_FIELDS_INTACT_UNAUDITED_WRITER`

### B.1 · What was observed

| Fact | Value |
|---|---|
| Subject | barber id **`barber-1777257519766`** (Alex) |
| Barber document update time | **2026-08-16 20:31:22** |
| `auditLogs` `BARBER_UPDATED` for 2026-08-16 | **none found** |
| `workingDays` after the toggle | **7 days** |
| `availabilityFrom` | **`2026-02-06`** — present |
| `status` / `active` | `active` / `true` — **in parity** |
| `role` | present |
| `shiftChanges` | **12 keys** — present |

### B.2 · What this proves, and the thing it deliberately does **not** prove

Part A §1 offered a discriminator: *an audit record means salown-app did it under `{merge:true}`
and nothing was lost; no audit record means the premium panel did it and the field loss is not a
hypothesis.* Production returned **both halves of neither**: there is **no audit record** and the
fields are **intact**. The discriminator is therefore **falsified as a discriminator** and must not
be re-used in that form.

**Proven:**

1. The writer was **not** the audited `salown-app` Team Members path (`L1`). That path always emits
   `BARBER_UPDATED` with `changes.workingDays: [before, after]`, and no such record exists.
2. The 2026-08-15 `availabilityFrom` migration **survived** 2026-08-16. `status`, `active`, `role`
   and `shiftChanges` survived with it. The Part A worst case — a no-merge replacement stripping the
   nine-field document down — **did not occur on this write**.

**Not proven, and it is the more important half:**

> **"Document fields intact" is an observation about the document. "Safe writer proven" is a
> property of the writer. This evidence establishes the first and says nothing about the second.**

The writer that performed the 2026-08-16 20:31:22 update is **unidentified and unaudited**. A save
whose field set happens to cover everything the document already held leaves that document intact
while still being a whole-document replacement; the next save, carrying different form state, need
not. Nothing in this evidence narrows which surface wrote, and nothing in it demotes a row of the
Part A §2 writer inventory. **`L4` (no-merge premium save), `L5` (ghost minter) and `L6` (fan-out
race) stand exactly as recorded**, and the case for shipping `FIN-DATED-ROTA-R2c` — which removes
all three — is strengthened by an unattributable production write, not weakened by a lucky outcome.

`FIN-GHOST-PASSIVE` is **not** closed by row B.1's `status`/`active` parity: one document in parity
is one document, not the absence of a minting path. The path (`L5`) is still live.

### B.3 · Measured retroactive impact

Under the stated assumption that **only Tuesday changed**:

| Step | Count |
|---|---|
| Past Tuesday candidates in the window | 27 |
| less: carried a `closed` override (do not accrue) | −4 |
| less: already carried an open override (already accruing — no change) | −5 |
| **Net past Tuesdays reinterpreted** | **18** |

- **Wage recomputation impact: exactly +£1,800.**
- **Occupancy:** the capacity denominator rises, so every occupancy **percentage falls**. This
  confirms in production what Part A §3 derived from source, and confirms that the
  `OccupancyPanel.tsx:166-172` "no retroactive distortion" comment is wrong for `workingDays`.

Part A §1's *"at most 27 Tuesdays"* was a correctly derived **upper bound** and is left standing as
such. **The measured figure is net 18 and +£1,800**, and that is the number to quote.

### B.4 · Payment-vs-earned — recorded, not interpreted

The probe surfaced a payment-vs-earned figure of **−£13,061.28**.

> **This is an observation and nothing more. It is not a debt, not a loss, not a kâr/zarar (P/L)
> result, and not a settlement position. It produces no action, and it is not an input to any
> decision in this document or in the `FIN-DATED-ROTA-R2c` release.**

It is recorded here only so that a later reader who encounters the same number knows it was seen,
was deliberately left uninterpreted, and needs its own separately scoped piece of work before anyone
may say what it means.

### B.5 · Consequence for the Whitecross bootstrap

- The barber document changed at **2026-08-16 20:31:22**. Any `sourceFingerprint` produced before
  that instant is **void**. **A fresh `salownRotaBootstrapTenant` dry run is mandatory**, and its
  fingerprints are the only ones the apply phase may carry back.
- This probe covered **Alex only**. **Muhamed and every other subject of the tenant must be settled
  by that dry run**, not by extending this probe. The dry run is the instrument designed for the
  question; a wider ad-hoc read is not.
- Part A §7's concern that step 8 might refuse for want of Alex's `availabilityFrom` is **resolved
  for Alex** — the field is present and dated `2026-02-06`. It remains open for every other subject
  until the dry run says otherwise.

**No production mutation is proposed, implied or authorized by this section.**

---

# Part A (continued)

## 2 · Writer inventory — what is LIVE today

R2c is `PUSHED_NOT_LIVE`; every commit on the path carries `[skip ci]`, so no CI hosting release
happened. The rows below are the *serving* code.

| # | Surface | Fields written | Shape | Dated? | Audited? | Live |
|---|---|---|---|---|---|---|
| L1 | `salown-app/src/pages/Barbers.tsx` save | `workingDays`, `dayHours`, `hours` + profile | `setDoc` `{merge:true}` | ❌ undated | ✅ `BARBER_UPDATED` diff | ✅ |
| L2 | `Barbers.tsx` `markOffToday` / `bringInToday` / delete (`:855`,`:869`,`:883`) | `shiftChanges` | `updateDoc`, field-scoped | ✅ today only | ❌ **none** | ✅ |
| L3 | **`salown-app/src/pages/Settings.tsx` → Members** (`saveShiftChange :487`, `deleteShiftChange :496`) | `shiftChanges` | `updateDoc`, field-scoped | ✅ **any date, past allowed** | ❌ **none** | ✅ |
| L4 | `whitecross-site/barber-panel` Barbers save | `workingDays`, `hours`, `dayHours`, `id`, `name`, `color`, `photo`, `active`, `order` | **`setDoc`, NO merge — replaces the document** | ❌ undated | ❌ none | ✅ **both targets** |
| L5 | `barber-panel` active toggle | `active` only, **no `status`** | `updateDoc` | — | ❌ none | ✅ (ghost minter) |
| L6 | `barber-panel/src/pages/Settings.js` `updateAllBarbersDay()` | `dayHours.{Day}` + `workingDays` on **every barber** | 7 concurrent no-merge full-document writes | ❌ | ❌ | ✅ (the unfixed 2026-08-10 lost-update race) |
| L7 | `functions/src/index.ts` `provisionTenant` / `approveApplication` | initial cache | Admin SDK | ❌ | partial | ✅ (`ROTA-B1B2`) |

R2c (pushed) removes L4's direct publish, L5's half-write, L6 entirely, and routes L1 through
`salownRotaTransaction`. **It does not touch L2 or L3.**

---

## 3 · Consumer matrix — who re-reads the past

Column *Past* = "does a change to today's `workingDays` change this surface's answer for a date
already gone?"

| Consumer | Source | Past | Current | Future | Note |
|---|---|---|---|---|---|
| **Finance — 6 wage consumers** | `Finance.tsx:428,576,592,598,612,665` → `financeWages` | 🔴 **YES — money** | yes | yes | Total Wages · partner ledger · credited-employee ledger · staff ledger · G4 weekly ledger · single-day P&L row |
| **Occupancy denominator** | `OccupancyPanel.tsx:63` `barberWorksOn` | 🟠 **YES** | yes | n/a | Iterates `cutoff → now` (4–N weeks back). Capacity up ⇒ every occupancy % **down**. The comment at `:166-172` claims "no retroactive distortion" — true for leave and `availabilityFrom`, **false for `workingDays`** |
| **Dashboard grid columns** | `Dashboard.tsx:442-453` | 🟡 YES (cosmetic) | yes | yes | Navigating to a past Tuesday now draws an Alex column. No data changes; the `workedKeysForDay` keep-rule means a real past booking was always visible anyway |
| `wageDriftAudit.cjs` | mirrors `accruesWageOnDay` | 🟠 by design | — | — | It *is* the mirror; its "booking exists but no wage day" finding for past Tuesdays will now flip to clean |
| Booking forms · public BookingPage · TimeGrid slots | `staffAvailability.getEffectiveStaffShift`, `bookingUtils` | ⚪ n/a | yes | yes | Availability is only ever asked forward |
| Server reschedule guard · `createBooking.ts` | `functions/src/**` | ⚪ n/a | yes | yes | Same |
| Staff App sheets | `src/staff/sheets/**` | ⚪ n/a | yes | yes | Same |
| **Reports.tsx** | — | ✅ **no** | — | — | Zero `workingDays` / wage-resolver references. Platform-wide reporting is unaffected |
| Canonical rota log | `staffRota/{id}/rotaEntries` | ✅ dated, correct | | | **and read by no Finance surface** |

---

## 4 · Settings vs Team Members — ownership matrix

| Concern | Team Members (`Barbers.tsx`) | Settings → Members (`Settings.tsx`) | Settings → Staff |
|---|---|---|---|
| Add / provision member | ✅ (R2c: server callable) | — | — |
| Weekly working days | ✅ **sole writer** | 👁 read-only display (`:1855`) | — |
| Per-day hours | ✅ | — | — |
| Status · leave · availability start | ✅ | — | — |
| Colour · order · photo · role | ✅ | — | — |
| Service links | ✅ | — | — |
| **Dated shift override (`shiftChanges`)** | ✅ **today only**, quick actions | ✅ **any date incl. past**, full editor | — |
| Login / invite / password | — | — | ✅ |
| Role · permissions | — | — | ✅ |
| Staff App permissions | — | — | ✅ |
| Delete staff account | — | — | ✅ |

The overlap is exactly one row — and it is the row that decides a paid day.

---

## 5 · Confirmed duplicate + bypass paths

**D1 — two editors for one field, one of them unbounded and unaudited.** `shiftChanges` is written
from Team Members (today only, `L2`) and from Settings → Members (any date, `L3`). Settings' own card
copy admits it: *"Same overrides as the 'Off today' button on the Team page — same data."* Neither
writes an audit record. The past-date affordance is **deliberate** —
`Settings.tsx:1877` says so: *"past dates allowed: lets you back-date a missed day off so
wages/scheduled-days reconcile."* That is a real need, and it is currently met by a raw client write.

**D2 — `shiftChanges` outranks everything Finance knows about dates.** In `accruesWageOnDay` the
override is tested *above* leave and *above* `workingDays`, and any non-`closed` entry counts as a
paid day (`return !!sc || wdays.includes(dayName)`). So one row typed into Settings → Members for a
date in a closed month adds a paid day to that month, immediately, with no record of who did it.
**This is a sharper instrument than the Tuesday toggle**, because it needs no weekday semantics — it
is a direct, per-date write into wage history.

**D3 — R2c does not close D1 or D2.** The R2c `firestore.rules` guard names three fields and only
three:

```
allow update: if (!request.resource.data.diff(resource.data).affectedKeys()
                    .hasAny(['workingDays', 'dayHours', 'hours'])
                  || rotaLegacyBarberWriteAllowed(tenantId, docId)) && ...
```

`shiftChanges` is explicitly *retained* as freely writable (`firestore.rules:193`). It is also not an
action in the rota log — `rotaWriter.ts` publishes `workingDays` / `dayHours` / `hours` and nothing
else. **Result: after the canonical flip, a Whitecross barber whose rota is an append-only server
history still has a browser-writable, undated, unaudited override map sitting above it that Finance
reads first.** R2c's claim that "a staff rota changes in exactly one way" is true of the *weekly
pattern* and not true of *effective availability or of a paid day*.

**D4 — the destructive premium save is the live path for the tenant that has the money.** `L4` is
serving on two targets and drops `shiftChanges` on every save, so D1's two editors can also *delete*
each other's work. Already an open 🟡 incident (`INCIDENTS.md` 2026-08-17).

**D5 — no bypass found in the other direction.** `src/staff/**` and `super-admin/` write zero barber
documents (re-confirmed). `barber-panel/src/firestoreActions.js:477 seedBarbers()` is dead and
broken. `salown-panel/` is served by nothing (`R2c-EV.3`).

---

## 6 · Smallest safe SSOT cutover plan — `ROTA-SSOT-1`

**Plan only. Nothing implemented. Sequenced so nothing the owner does today stops working.**

**Target:** Team Members owns *when someone works*. Settings owns *who can log in and what they may
see*. One authority per question, and the dated-override need is kept, not removed.

### Phase 0 — evidence (before any code) — ✅ **DONE, read-only, 2026-08-17**

Executed as the §1A probe. **Closed. Do not re-run and do not widen.**

| # | Action | Outcome |
|---|---|---|
| 0.1 | Read `tenants/whitecross/auditLogs` for 2026-08-16, action `BARBER_UPDATED` | ✅ ran — **no record**. Settles that `L1` was not the writer; does **not** identify the writer, and the `workingDays` before-value is therefore **unrecoverable** (§1A B.2) |
| 0.2 | Read Alex's barber doc field-masked: `workingDays`, `availabilityFrom`, `status`, `active`, `shiftChanges`, `leaves` | ✅ ran — **fields intact** (`availabilityFrom 2026-02-06`, `status`/`active` in parity, `role` present, `shiftChanges` 12 keys). The 2026-08-15 migration survived. **Not** a proof that the writer is safe (§1A B.2) |
| 0.3 | `node scripts/wageDriftAudit.cjs …` to quantify the delta | ⛔ **no longer required.** §1A B.3 measured it directly: net **18** past Tuesdays, **+£1,800**. Running the drift audit now would re-read production for a number already settled |
| 0.4 | *(new, and it replaces the temptation to widen 0.1–0.3)* fresh `salownRotaBootstrapTenant` **dry run** | ⏳ **mandatory, not yet run.** Any pre-2026-08-16 20:31:22 `sourceFingerprint` is void. It is also the only sanctioned way to settle **Muhamed and the tenant's remaining subjects** — §1A B.5 |

### Phase 1 — stop the bleeding (independent of R2c, no rules change)

| # | Change | Size |
|---|---|---|
| 1.1 | `Settings.tsx` → Members becomes **read-only**: keep the list, the weekly summary and the existing overrides visible; replace the editor with **“Manage shifts in Team Members →”** deep-linking to the member's drawer. Delete `saveShiftChange` / `deleteShiftChange` | S |
| 1.2 | Team Members gains the capability Settings is losing: a **dated** override row (today **and past**, explicitly labelled *"back-dated — this changes wage totals for that day"*), plus the existing today quick-actions | M |
| 1.3 | **Every** `shiftChanges` write logs `BARBER_SHIFT_OVERRIDE_SET` / `_CLEARED` with `{ dateKey, before, after, backdated: dateKey < today }` — the gap D1 leaves | S |
| 1.4 | Static test: `shiftChanges` appears as a write target in **exactly one** module. Negative control — reintroduce it in `Settings.tsx`, the test must fail | S |

### Phase 2 — make the override honest (needs an owner decision)

`shiftChanges` is a *map on the barber doc*, not a log. Two options, and this is a real fork:

- **2a (smaller)** keep the map, keep the client write, gate a **back-dated** entry behind an
  owner-only confirm + audit. Cheap; leaves the field undated-authority.
- **2b (correct)** route overrides through `salownRotaTransaction` as a new dated action
  (`ROTA_OVERRIDE`), add `shiftChanges` to the rules guard, and make the map a published projection
  like `workingDays`. Closes D2 and D3 properly; is a real R2-engine extension.

**Recommendation: 1.1–1.4 now, 2b as `ROTA-SSOT-2` after R2c is `LIVE_VERIFIED`.** Doing 2b before
R2c ships adds a fourth action to an engine that is mid-release.

### Phase 3 — the history read (separate, and the actual answer to the brief)

`FIN-ROTA-HISTORY-READ` (new) — Finance resolves a past day's pattern from the dated rota log rather
than from the current projection, behind a `legacy | dated` cutover constant with golden-parity
assertions, exactly as `FINANCE_COMP_PERIOD_MODE` was built. Then `FIN-PERIOD-CLOSE`. **Only these
two deliver the owner's table**; R2c and R2d do not.

### Constraints carried through every phase

- Whitecross first; HeroHairs stays bounded-legacy (`STAFF-START-A2`).
- No backfill and no invented rota state. A past day with no evidence stays legacy-resolved.
- Legacy tenants keep a working Team Members screen at every step.
- No `ROTA_END`, no future-effective mutation — both stay refused until R2d.
- `availabilityFrom` stays availability-only; `availabilityFinanceIsolation.test.ts` must keep passing.
- Tests required: unit (override resolution + audit envelope), emulator (rules deny a second writer),
  UI (Settings cannot compose a `shiftChanges` write), **occupancy + wage historical
  non-regression** (a past-month total must not move when only Phase 1 lands).
- Rollback: Phase 1 is a hosting rollback. Phase 2b, once appending, is **not** reversible by code.

---

## 7 · Release-blocker decision

| Question | Answer |
|---|---|
| Does this block the `R2c` controlled release? | **No.** R2c is behaviour-preserving with respect to `shiftChanges`, and its live-verified defects (`L4` destructive save, `L5` ghost minter, `L6` fan-out race) are actively harming production every day it waits. **Ship R2c on the corrected §9 order.** |
| Does it change what R2c may be *claimed* to have achieved? | **Yes, and this is the blocking part.** R2c may not be described as "a staff rota changes in exactly one way" while `L2`/`L3` stand. The `FIN_DATED_ROTA_R2C_DESIGN.md` §1 writer inventory is **incomplete**: it lists W1–W4 for the three cache fields and omits both `shiftChanges` writers. Add them as `W5`/`W6`, marked *out of scope, retained deliberately*. |
| Is anything here P0? | ~~**Yes — Phase 0.**~~ ✅ **Resolved 2026-08-17** by the §1A probe: Alex's `availabilityFrom`, `status`, `active`, `role` and `shiftChanges` all survived 2026-08-16. What replaced it is **not** a P0 read — it is the mandatory fresh bootstrap dry run (§1A B.5). |
| Blocks the Whitecross **canonical flip** (§9 step 9)? | **No.** For **Alex** the fingerprint input exists (`availabilityFrom 2026-02-06`). For **every other subject, including Muhamed, it is unsettled** — and the instrument is the dry run itself, not another probe. **Hard condition: the dry run must be fresh.** The document changed at 2026-08-16 20:31:22, so any earlier `sourceFingerprint` is void and the apply phase must refuse it. |
| Does the intact document mean the live writers are safe? | **No — and this is the sentence most likely to be misread.** §1A proves fields survived one write. It does not identify the writer, does not audit it, and does not retire `L4`/`L5`/`L6`. An unattributable production write is an argument **for** shipping R2c, not against. |

---

## 8 · Unknowns requiring separately authorized production evidence

Recorded as `STATUS_UNKNOWN`, never as a guess. **Reconciled against the §1A probe, 2026-08-17.**

| # | Unknown | State after §1A | Detail |
|---|---|---|---|
| U1 | Which surface performed the 2026-08-16 toggle | 🔴 **STILL UNKNOWN** | The probe eliminated `L1` (no `BARBER_UPDATED`) and **did not identify a replacement**. The writer remains unattributed — outcome token `ALEX_FIELDS_INTACT_UNAUDITED_WRITER`. Cheapest remaining resolution is **not** another read: it is R2c, which leaves exactly one audited door |
| U2 | Alex's `workingDays` before the toggle | 🔴 **UNRECOVERABLE** | It lived only in the audit record that was never written. Superseded in practice: §1A B.3 measured the effect directly instead of reconstructing the input |
| U3 | Whether Alex's `availabilityFrom` / `status` / `shiftChanges` / `leaves` survived | ✅ **RESOLVED — they survived** | `availabilityFrom 2026-02-06`, `status active` / `active true` in parity, `role` present, `shiftChanges` 12 keys. **Document-level only** — see B.2 on why this is not a writer-safety proof |
| U4 | Alex's daily rate, and whether Alex accrues a wage at all | ✅ **RESOLVED via the outcome, not the input** | Not read separately. §1A B.3 gives the recomputation impact as **exactly +£1,800** over **18** net days, which is the figure U4 existed to produce |
| U5 | Whether the past Tuesdays already carried per-date `shiftChanges` overrides | ✅ **RESOLVED — yes, 9 of 27** | 4 `closed` (do not accrue) + 5 already open (already accruing). **The delta was indeed smaller: 27 → net 18** |
| U6 | Whether a divergent `status:'active', active:false` document exists | 🟠 **STILL OPEN** | Alex is in parity, which is one document, not the platform. The minting path (`L5`) is live and unchanged, so `FIN-GHOST-PASSIVE` stays **`CONFIRMED_OPEN`** rather than closing on a single clean sample |
| U7 | Every non-Alex subject of the tenant, **Muhamed included** | ⏳ **DEFERRED BY DESIGN** | Settled by the **fresh bootstrap dry run** (§1A B.5), which is the instrument built for it. Widening the read-only probe is explicitly **not** the answer |

**None of these needed or needs a write, and none is answered by re-running the §1A probe.** The two
that remain genuinely open (U1, U6) are closed by *shipping R2c*, not by reading production again.

---

## 9 · Documentation defects found while auditing

| Where | Defect |
|---|---|
| `ROADMAP.md` S3 theme detail | Said *"S1 + S2 + S3A landed, all `PUSHED_NOT_LIVE` · S3B/S3C not built"* and that the mode *"ships as `'legacy'`"*. The Master Active Table says `FIN-COMP-S3B`/`S3C` are **`LIVE_VERIFIED`** and `financeCompPeriodCutover.ts` reads `= 'periods'`. **✅ FIXED** in the `ROTA-DOCS-RECONCILE` pass (2026-08-17) — the stale sentence is replaced by the live truth and the duplicate status statement is gone |
| `OccupancyPanel.tsx:166-172` | The comment asserts *"historical days stay correct; no retroactive distortion."* True of leave and `availabilityFrom`, false of `workingDays` read two lines up at `:63`. **Now confirmed in production** (§1A B.3: denominator up, percentages down). 🟠 **OPEN — tracked as `OCC-CAPACITY-AUTHORITY`** |
| `FIN_DATED_ROTA_R2C_DESIGN.md` §1 | Writer inventory omits both `shiftChanges` writers (§7 above). 🟠 **OPEN** — deliberately **not** edited in this pass: that file is outside this session's claim, and adding `W5`/`W6` is a change to a design document mid-release. Tracked as part of `ROTA-SSOT-1` |

*`ROADMAP.md` is the status SSOT and was claimed for this pass (`ROTA-DOCS-RECONCILE`), so its defect
is fixed rather than merely flagged. The two remaining rows are flagged, not edited.*
