# SESSION_LIFECYCLE.md — treatment sessions, continuity and client recovery (TR-C)

> **Status:** ✅ **DEPLOYED + LIVE-VERIFIED** — `d9856e5` on `origin/main`, 2026-07-31.
> Baseline chain: TR-A `424747d` → TR-C Phase 1 `bc82454` → TR-B `c3716f7` → TR-C Phase 2 `d9856e5`.
> Functions `salownCreateTreatmentSession-00001-vap` · `salownTransitionTreatmentSession-00001-jur` ·
> `salownRecordFollowUp-00001-mez`. Hosting `salown` `a5c3f0e4622644a7` (rollback `f2428d9b468ac4bf`),
> `salown-staff` `c10550cbbe1ffebb` (rollback `d8275712fa1a828a`). Live-verified on `tr-demo`: **37/37**.

**Contract:** `packages/shared/src/treatment.ts` (TYPE-ONLY)
**Cores:** `src/utils/treatmentLifecycle.ts` ↔ `functions/src/treatmentSessions/lifecycle.ts` (byte-identical twins)
`src/utils/treatmentContinuity.ts` ↔ `functions/src/treatmentSessions/continuity.ts` (byte-identical twins)
**Server authority:** `functions/src/treatmentSessions/sessions.ts`, `functions/src/treatmentSessions/followUps.ts`
**Related:** [TR_BEAUTY_MARKET_REQUIREMENTS.md](TR_BEAUTY_MARKET_REQUIREMENTS.md) · [TR_LOCALIZATION_PLAN.md](TR_LOCALIZATION_PLAN.md) · TR-B's `packages/shared/src/treatmentPackage.ts`

---

## 1. Why this exists

A Turkish laser/beauty salon sells a **course**, not a haircut. Its staff are asked the
same eight questions all day:

- Which session is this?
- How many are left?
- When did they last come?
- Did they miss the last one?
- Have they missed the last three?
- Are they overdue?
- Who is drifting away?
- Who do I ring today?

salOWN's booking model answers none of them. A booking is a slot in a diary; a treatment
session is one step in a course with a number, an interval and a history.

## 2. The ownership split with TR-B — the single most important thing in this document

| | TR-C (this document) | TR-B (`treatmentPackage.ts`) |
|---|---|---|
| Owns | the OPERATIONAL life of a session | every FINANCIAL and ENTITLEMENT fact |
| Collections written | `treatmentSessions`, `treatmentFollowUps`, `treatmentRequests` | `clientPackages`, `packageSessions`, `packageLedger`, `packageDefinitions` |
| Money | **names no money field at all** | owns every `_m` amount |
| Counters | never writes one | owns `counters.*` |

**Why the split.** "The client did not turn up" is an operational fact, true regardless of
who paid what. "The entitlement was consumed anyway because tenant policy burns no-shows"
is an *accounting consequence* of it. Modelling both as one row would mean a salon could
not correct an attendance mistake without touching money — which is precisely the coupling
that makes staff stop correcting attendance at all.

### The write-side seam is one enum

TR-C computes a `TreatmentEntitlementEffect` and **stops**:

| effect | meaning |
|---|---|
| `reserve` | hold one entitlement for a future appointment |
| `consume` | the entitlement is spent (delivered, or burnt by policy) |
| `release` | give the held entitlement back |
| `none` | no movement |

TR-B's executor is the only thing that may act on it. TR-C also exports
`toPackageSessionStatus()`, which projects the nine operational states onto TR-B's
four-state `PackageSessionStatus`, so TR-B never re-implements the table.

### The read-side seam is one interface

`TreatmentPackageLink` — id, display name, **entitlement COUNT**, ordinal, expiry. There is
no money field in it *by construction rather than by discipline*: if TR-C cannot name an
amount, it cannot accidentally compute with one. The create callable **rejects** a payload
carrying e.g. `packageListPrice_m` rather than silently ignoring it.

`RecoveryRow.outstandingBalance_m` is a **read-only passthrough** of TR-B's own cached
figure, so the recovery screen can offer a "has a balance" filter. TR-C never compares it,
never formats it itself, and treats `null` as "no data" rather than "zero".

### 2.1 Two contract corrections the cross-contract suite forced

Both were found by wiring the **real** TR-B executor rather than a stub, and in both
cases the honest answer was to REMOVE a TR-C capability rather than keep one that
could lie.

**`cancelledConsumesSession` is gone.** TR-B is the financial authority and its
contract has no verb for "cancelled but consumed" — `cancel` releases, full stop. A
TR-C-only flag would have let TR-C's audited history record a `consume` that TR-B's
ledger never made. That is a quieter and worse failure than simply not offering the
option. A cancellation always releases; if a salon ever needs otherwise it becomes a
TR-B setting **and** a TR-B verb.

**Correcting a no-show no longer restores the entitlement.** TR-B treats a no-show
entitlement as FINAL, deliberately: *"re-deciding a delivered session days later would
silently move money-adjacent entitlement with no record of the first decision; the
correction is a new session row, not an edit."* It is right to. So the TR-C correction
fixes the **attendance record** — which is TR-C's domain, and is what the recovery
queue actually reads — and does not pretend it can un-burn a session.

"Settledness" is DERIVED from the audited history (`entitlementIsSettled`), never
stored as a flag that could drift: once a session has been to `no_show`, no later
transition moves anything. So *marked absent → corrected → completed* burns exactly
**one** session, which is what the requirement asked for. A salon that wants to be
generous makes a deliberate TR-B package adjustment, with its own ledger row.

### 2.2 The two-transaction seam is reported, not hidden

The lifecycle write and the entitlement write are two transactions in two packages, so
a partial outcome is genuinely possible: the session can be `completed` while the
entitlement has not moved. The result carries `entitlementApplied` (`true` / `false` /
`null` = nothing to move) and `entitlementReason` (TR-B's machine code) rather than
swallowing it — a salon's delivery record and its accounting silently disagreeing is
exactly the failure this package exists to prevent.

The retry is **safe**: the delegated idempotency key is derived from
`(tenant, session, from, to)`, so re-running the same transition replays inside TR-B
instead of consuming a second entitlement.

### Degradation is the default

Every TR-C feature works with no TR-B data at all. A salon with no packages still gets
attendance tracking, overdue detection and the recovery queue; the package-shaped filters
match nothing. That is what makes TR-C shippable before, during and after TR-B.

## 3. The lifecycle

```
                    ┌──────────┐
                    │ planned  │  in a course, not booked yet
                    └────┬─────┘
             ┌───────────┼─────────────┐
             ▼           ▼             ▼
       ┌───────────┐  cancelled     skipped ⚠reason
       │ scheduled │◄──────┐
       └─────┬─────┘       │
             ├─────────────┤ (un-confirm)
             ▼             │
       ┌───────────┐       │
       │ confirmed ├───────┘
       └─────┬─────┘
             │
   ┌─────────┼──────────┬────────────┬───────────┐
   ▼         ▼          ▼            ▼           ▼
arrived   no_show   cancelled   rescheduled   skipped ⚠reason
   │         │
   │         └── ⚠reason, owner/admin ──► arrived   (the ONE correction edge)
   ▼
completed ▪ TERMINAL
```

**Terminal:** `completed`, `cancelled`, `rescheduled`, `skipped`.

### Why `in_progress` is absent

The brief allowed it "only if current workflows need it". **No salOWN surface has a
start-treatment action** — not the panel, not the Staff App. Adding the state now would
ship something that only ever appears in a test. `arrived` already carries the fact that
matters operationally (they are here, so this is not a no-show).

> **Condition for adding it:** a real surface that marks treatment *start* — e.g. a laser
> device hand-off log, or a Staff App "begin session" action. When that exists, add
> `in_progress` between `arrived` and `completed`, with `arrived → in_progress → completed`
> and effect `none` on entry. Bump `TreatmentLifecycleVersion` only if a stored field
> changes meaning; adding a state does not.

### Why `no_show` is NOT terminal

A client marked absent who then walks in twenty minutes late is an ordinary evening in a
salon. Forbidding the correction does not prevent the mistake — it guarantees the record
stays wrong, and a wrong attendance record is what a dispute is argued from.

So `no_show → arrived` exists. It **requires a written reason**, it is **owner/admin only**,
it is audited, and it **clears `noShowAt`** so nothing that trusts the timestamp still reads
an absence. Because state is a single field, a row is never simultaneously no-show and
completed; it simply stops being a no-show, and every count that reads it moves with it.

### The five guarantees, and how each is actually enforced

| Guarantee | Mechanism — not a check, a structure |
|---|---|
| A session cannot be completed twice | `completed` is terminal. A repeat returns `ALREADY_IN_STATE`, which the callable converts to an idempotent replay with effect `none`. Ordering matters: `ALREADY_IN_STATE` is tested **before** `TERMINAL_STATE` so a double-tapped button is not reported as a fault. |
| Two entitlements cannot be consumed | Twice over, independently: `completed` is terminal *here*, and TR-B's derived doc id `{clientPackageId}__{bookingDocId}` is single-winner *there*. Neither layer relies on the other being careful. **Proved against the real emulator: six concurrent completions → exactly one `consume`.** |
| No-show and completed cannot coexist | One `state` field. There is no second boolean to disagree with it. |
| A cancelled session does not consume | Policy, defaulting to **false**. `cancelledConsumesSession` must be switched on out loud. `noShowConsumesSession` mirrors TR-B's field of the same name (Turkish laser salons overwhelmingly burn the session). A malformed `packageSettings` falls back to consuming **nothing** — a wrong `true` silently burns a session the client paid for. |
| BLOCKED records cannot enter | Screened on **all three** markers the booking model writes inconsistently (`status`, `source`, the `BLOCKED-` id prefix). Any one is disqualifying. Checked in the pure core *and* again inside the create transaction. |
| Cross-tenant mutation | `tenantId` is **always** the auth claim, never the payload (a payload carrying one is rejected as a forbidden field). The stored row's own `tenantId` is re-checked against the claim, so a mis-seeded row cannot be mutated from a neighbouring tenant even if its path were guessed. |

### Roles

| Action | Who |
|---|---|
| Ordinary transitions | `owner`, `admin`, `staff`, super-admin — delivering treatments is the job, not a privilege |
| `→ skipped` and `no_show → arrived` | `owner`, `admin`, super-admin only |
| Lifting a `do_not_contact` | `owner`, `admin`, super-admin only |

Role is read **inside** the transaction, so a concurrent revocation aborts and retries; a
write can never land on stale authorization. (Same discipline as `bookings/blocks.ts`.)

## 4. The treatment record

`tenants/{tid}/treatmentSessions/{sessionDocId}` — **server-written only**.

Doc id is the **booking doc id** when the session has an appointment. That makes "one
booking cannot spawn two treatment sessions" structural rather than checked: two concurrent
creates race for the same path and Firestore lets exactly one win. Appointment-less
sessions (a `planned` step in a course) get a server-generated id.

Carries: session number · package link · frozen service snapshot · scheduled/arrived/
completed/no-show/cancelled/skipped timestamps · staff · `locationId` (always present,
`null` until multi-location — so a future location layer is a backfill, not a mid-flight
schema change) · attendance state · operational notes · next-recommended window ·
supersedes/superseded-by chain · append-only audited `history[]` · actor + timestamps.

### Notes are operational, not clinical

salOWN makes **no medical claim**, stores no diagnosis and asks for no clinical consent, so
nothing in the UI may imply one. The notes field is for settings used, areas treated and how
the client found it. A dictionary test fails the build on clinical vocabulary in either
language.

### §Media — before/after photographs are DEFERRED, not designed-and-disabled

**Decision: no media field ships in Phase 1.** Treatment photographs of an identifiable
person are special-category data under **KVKK art. 6** and **UK GDPR art. 9**. salOWN today
has:

- no consent capture for image processing,
- no retention or deletion policy for images,
- no per-image access control (Storage rules are tenant-wide),
- no KVKK compliance work at all (still open — `TR_LOCALIZATION_PLAN.md` §3.6).

Shipping the field now would invite staff to fill it before any safeguard exists, and the
resulting images would be the hardest thing in the product to lawfully delete.

> **Preconditions for adding it**, all four: (1) explicit, recorded, withdrawable client
> consent for image processing; (2) a retention policy with automatic deletion; (3)
> per-image access control, not tenant-wide; (4) KVKK/GDPR review signed off. Until then the
> UI says "not available yet" rather than hiding the gap.

## 5. The continuity engine

Pure function of `(sessions, followUp, policy, nowMs, timeZone, packageRemaining, expiry)`.
No clock read, no Firestore read, no locale lookup — a parity test greps the core for
`Date.now(`, `new Date()`, `navigator.`, `process.env` and `Math.random(` and fails if any
appears. That is what makes "pure" a property rather than an intention.

**Day arithmetic goes through TR-A's `tenantDateKey`,** never `(b - a) / 86400000`: across
a DST boundary the naive form is an hour out, and near midnight it is a whole day out —
which is the difference between "overdue" and "due today" on a screen staff act on. A span
straddling 21:00 UTC in July is one day in Istanbul and zero in London; both are tested.

### Flags — observations, never predictions

| Code | Says |
|---|---|
| `NO_FUTURE_APPOINTMENT` | nothing booked ahead |
| `MISSED_LATEST_APPOINTMENT` | the most recent *eligible* session is a no-show |
| `MISSED_LAST_THREE` | the last N eligible sessions were all no-shows (N = policy, not a literal 3) |
| `OVERDUE_FOR_NEXT_SESSION` | past the recommended window + grace, nothing booked |
| `PACKAGE_REMAINING_INACTIVE` | entitlements left, no recent activity |
| `PACKAGE_NEARING_EXPIRY` | TR-B expiry close and sessions remain |
| `OUTSTANDING_FOLLOW_UP` | a follow-up is open, or its snooze has elapsed |
| `FOLLOW_UP_RECOMMENDED` | the roll-up — at least one actionable flag above |

**There is deliberately no code meaning "this client will churn".** The product has no basis
for it and a salon would act on it as if it did. `FOLLOW_UP_RECOMMENDED` is the strongest
thing salOWN will say. Every flag carries `evidence` — a machine message key plus count/date
params plus the session ids it was computed from — so the screen can always answer "why am I
being shown this person?". A queue a salon cannot interrogate is a queue telling it what to
think.

**Eligibility.** Only `completed` and `no_show` count as attendance opportunities. A client
who **cancels in good time has not missed anything** — folding that into a miss streak would
put well-behaved clients in the recovery queue. `rescheduled` and `skipped` are excluded for
the same reason.

**Suppression.** `do_not_contact` kills the recommendation entirely, and is checked in the
*engine*, not the UI — a suppression that only hides a row from one filter is not a
suppression. The underlying facts stay visible on the client's own record. `booked` and
`not_interested` are answered questions; a live snooze hides the client until it elapses.

### Policy — every threshold is named, none is a literal at a call site

`defaultIntervalDays` 28 · `overdueGraceDays` 7 · `expiryWindowDays` 30 ·
`inactivityDays` 45 · `consecutiveMissThreshold` 3.

Deliberately conservative: a salon should find the queue quiet and true rather than loud and
noisy, because a queue that cries wolf is ignored within a week.

## 6. Dashboard/list parity is structural

A dashboard card count is `applyRecoveryFilter(rows, {flags:[CODE]}).length` over the **same
`rows` the list renders**. The card and the list cannot disagree — not because a test
compares two code paths, but because they are one call. The one exception is "Today's
treatment sessions", which is session-level rather than client-level, and the code says so
rather than pretending to share a contract it does not.

## 7. Inert for every existing tenant

whitecross, herohairs and eekurt have **zero** `treatmentSessions` documents. Therefore
`buildRecoveryRows` returns `[]`, the dashboard strip renders `null`, and the client card is
unchanged. This is the same regression anchor TR-A used ("existing UK tenants carry no
`presentation` key ⇒ platform default ⇒ unchanged"), and it is asserted directly:
*"leaves a legacy barber tenant completely untouched"* in `treatmentQueries.test.ts`.

## 8. Client recovery workspace

`treatmentFollowUps/{clientId}` — **doc id IS the client doc id**, so one client has exactly
one follow-up record structurally. Two staff working the queue cannot both own the same
call, and there is no "which of these three rows is current?" question to get wrong.

Statuses: `open`, `contacted`, `snoozed`, `booked`, `no_response`, `not_interested`,
`do_not_contact`. Channels are recorded, not used to send.

### salOWN sends nothing, and says so

There is **no automated WhatsApp/SMS/email** here. A client's consent basis for an
appointment reminder does not extend to a win-back message; sending one anyway is a
KVKK/UK-GDPR breach, not a growth feature. The UI offers `tel:` links and copy-to-clipboard;
a human contacts the client and records what happened. The page states this out loud so
nobody assumes a message went out — a load-bearing string, asserted in both languages by
`treatments.dictionary.test.ts`.

If a provider and a lawful basis ever land, they arrive as their own package with their own
consent capture and audit, not as a flag flipped here.

`do_not_contact` is a **one-way door for staff**: anyone may set it, only owner/admin may
lift it. "The client asked us to stop" is exactly the instruction that must survive staff
turnover.

## 9. Verification

| Suite | Result |
|---|---|
| Frontend (`npm test`) | **807/807** |
| Functions (`npm --prefix functions test`) | **742 — 725 pass, 17 emulator self-skips, 0 fail** |
| Emulator (`npm run test:emulator`) | **10/10**, incl. the six-way completion stampede |
| `tsc --noEmit` frontend + functions | clean |
| `npm run build` + `build:staff` | clean |
| eslint on all new files | clean |

Notable cases proved: exact allow-list per state · duplicate completion · concurrent
completion (real engine) · BLOCKED exclusion on all three markers · consecutive no-show ·
missed-last-three at a configurable threshold · cancellation is not a miss · reschedule
chain · overdue in tenant timezone · Istanbul/London day boundaries both directions ·
no-future-booking · completed package clears the inappropriate flags · legacy barber tenant
untouched · tenant isolation (fake + real) · role permissions on the sensitive edges ·
dashboard/list parity across every card · TR/EN key-shape and language discipline.

## 10. Phase 2 — shipped

Phase 1 stopped short of five shared registration files because TR-B held their claims and
CLAUDE.md rule 7 makes a claim conflict a hard stop. TR-B released at `c3716f7`; Phase 2
took a narrow `TR-C-INTEGRATION` claim over exactly those files and landed:

| Registration | What |
|---|---|
| `functions/src/index.ts` | 3 onCall shells + **`packageSession: PKG.packageSessionCore`** — the whole financial seam |
| `src/pages/AppRouter.tsx` | `follow-ups` route (lazy, not admin-gated) |
| `src/components/Sidebar.tsx` | one nav entry, plus generic per-item `labelKey` support |
| `src/i18n/dictionaries/{en,tr}/index.ts` | the `treatments` namespace |
| `packages/shared/src/index.ts` | `export type * from './treatment.js'` |
| `functions/package.json` | **TR-B's two omitted suites** + TR-C's, into the default gate |

**Not needed, and not done:** `firestore.rules` — the `[G4]` catch-all already grants
same-tenant READ and denies client WRITE on any unlisted collection, which is exactly the
server-authoritative posture the three new collections want. Adding explicit blocks would be
documentation, not a control. **Not needed:** `firestore.indexes.json` — every query is a
plain collection read, filtered and sorted in memory.

### Two things that DID change for existing UK tenants

1. A **"Follow-ups" sidebar item** now appears for every tenant. Opening it shows
   *"This salon has no treatment sessions yet."* — cards and timeline render nothing.
   (Same precedent TR-B set with "Packages".)
2. The **Staff App bundle** grew the treatments dictionary, because the Staff App consumes
   the same i18n barrel. It renders none of those strings.

Everything else remains inert: zero `treatmentSessions` ⇒ empty rows ⇒ unchanged screens.

## 11. Live verification — production, `tr-demo` only (2026-07-31 ~20:5x UK)

**37/37 passed.** The script drove the exact deployed cores — including the real TR-B
executor through the same `packageSession` seam `functions/src/index.ts` injects — against
production Firestore.

- [x] guard refused to run against anything not marked `demo:true` + `demoKind:'tr-pilot'`
- [x] TR-B package sold (4 entitlements) → TR-C session created and linked
- [x] completion consumed **exactly one** entitlement (4 → 3)
- [x] repeat completion replayed with effect `none`; 4 concurrent completions consumed nothing further
- [x] no-show burnt the session under tenant policy; owner corrected the attendance record
- [x] the correction moved **no** entitlement — total consumed stayed at 2, not 3
- [x] `MISSED_LATEST_APPOINTMENT`, `MISSED_LAST_THREE` (streak 3), `NO_FUTURE_APPOINTMENT`
- [x] overdue **45 days** computed in `Europe/Istanbul`, 80 days since last attendance
- [x] every flag carried machine evidence with its session ids; no predictive/clinical code
- [x] follow-up recorded; the client appeared in the queue with a reason
- [x] dashboard card count === Follow-ups list length, for all four cards
- [x] outstanding balance readable (₺1600.00) and **byte-identical** after the whole run
- [x] no ledger row from any attendance event; demo tenant still cannot email/message/charge
- [x] **cleanup verified** — 32 synthetic docs deleted, `packageSettings` removed again,
      `treatmentSessions`/`treatmentFollowUps`/`clientPackages` all back to 0

Deployed endpoints independently confirmed live and failing closed: an unauthenticated POST
to each of the three returns `UNAUTHENTICATED`.

### ⚠️ Manual visual pass — NOT done

- [ ] `/app/follow-ups` in **Turkish** (`tr-demo`): filters, evidence chips, drawer, journey
- [ ] dashboard card strip renders and click-through carries the filter
- [ ] a UK tenant (`whitecross`) sees the nav item and the empty state, nothing else changed

The mechanism is verified statically, on the emulator and live; the human pass is not.
Same standing gap as TR-A's §12.3.
