# STAFF_AVAIL_GAP_PLAN.md — availability/conflict enforcement decision + plan

> Work ID `STAFF-AVAIL-GAP` (ROADMAP.md §4). Surfaced 2026-09-11 while auditing
> `STAFF-SLOT-INTERVAL`'s save chains — **not caused, not fixed, by that release.** Sections 1-4
> are research; **§5's D1-D7 decision table was FINALIZED by the owner on 2026-09-12** (see §5-§5.2
> for the decisions and §7 for what Phase 0 covers). **No code changed, nothing deployed, as of this
> writing — implementation and deploy are separate approvals, not granted by this document.**
> Out of scope: WhatsApp (B7), Path 4 (`A5 T-e`, owner decision on binding a `superAdmin` claim to a
> tenant — its completion report is not in this document and is **not assumed closed** here).

---

## 1. What this covers

Four Staff App manual booking surfaces: **New Booking**, **Walk-in**, **Reschedule**, **Block Time**
(`src/staff/sheets/{NewBookingSheet,WalkInFlow,RescheduleSheet,BlockTimeSheet}.tsx`). For each: what
staff identity it writes, what actually gates a save (client vs server, hard-refuse vs
overridable-warning), and where the Admin panel already does something different for the same
concept.

---

## 2. Identity — what `barberId` actually is, per writer

| Writer | Surface | Shape written | Evidence |
|---|---|---|---|
| `createWalkInInner` (`firestoreActions.ts:987`) | **Staff App New Booking** (`NewBookingSheet.tsx:297`) | **name string** — `barberId: barber, barberName: barber`, no resolution | direct assignment, no lookup |
| `salownCreateWalkIn` callable (`functions/src/bookings/createWalkIn.ts:246-247`) | **Staff App Walk-in** (`WalkInFlow.tsx` passes `barber!.id`) | **canonical doc id**, resolved via `assertAssignableStaff`/`resolveBarberRef` regardless of what the caller sent | server-side resolution |
| `RescheduleSheet.tsx:161-170` | Staff App Reschedule | **doesn't write `barberId` at all** — `updateDoc` touches only `date/time/startTime/endTime`; whatever shape was already on the doc stays |
| `salownCreateBlock` (`blocks.ts`) | Staff App Block Time | canonical doc id, same `resolveBarberRef` family |
| Booksy / Fresha / Treatwell / iCal parsers | import | mixed — Booksy name-only, others carry both `barber`/`barberName` alongside `barberId` |

**CLAUDE.md's "walk-ins = name, online = doc id + name" is imprecise.** The real split is *which
writer*, not *which channel* — the Staff App itself straddles both shapes: its Walk-in tab is already
canonical, its New Booking tab is not.

### 2.1 No write-migration needed — two read-time resolvers already exist and are already in use

- **Server**: `resolveBarberRef` (`functions/src/bookings/staffEligibility.ts:103-117`) — doc-id
  match first, else normalized-name match, fails closed on zero/ambiguous matches. Already the
  resolver `createWalkIn.ts` and `reassignBooking.ts` use today.
- **Client**: `matchesBarber` / `barberKey` (`src/utils/barberUtils.ts:66-84`) — the same
  doc-id-or-normalized-name match, case-insensitive. Already powers Dashboard, Reports, and the
  notification bell's `resolveBarberDisplayName`.

Any new server-side enforcement (passive/conflict/hours) for New Booking or Reschedule can resolve a
**legacy name-keyed booking to its canonical barber at decision time** via `resolveBarberRef` —
exactly what `createWalkIn.ts`/`reassignBooking.ts` already do for every OTHER booking they touch. No
backfill script, no bulk write, no downtime. `grep barberId scripts/ ops/` found no existing
migration precedent, and none is needed.

### 2.2 `barbers` and `staff` are separate identity systems — this is not the Team Identity Contract problem

`createWalkIn.ts:198-199` reads them as two distinct collections in the same transaction:
`staff/{actor.uid}` = the **caller's** login/role identity (Auth-keyed, governed by
`TEAM_IDENTITY_CONTRACT.md`) vs `barbers/{docId}` = the **assignee's** schedulability (Firestore-id
keyed, no Auth relationship required — a barber can exist with no login at all;
`createWalkIn.ts:216-217`'s own comment makes the distinction explicit). Closing this gap does not
touch the Team Identity Contract; it is a parallel, structurally similar, but separate problem — and
per 2.1, it is already mostly solved on the read side.

---

## 3. Behavior matrix — current state, evidenced

Legend: **HARD** = refuses outright, no path through. **SOFT** = `window.confirm`, staff can click
through. **NONE** = no check exists, at any layer. **N/A** = doesn't apply to this surface.

| | New Booking | Walk-in | Reschedule | Block Time |
|---|---|---|---|---|
| **Pasiflik** | **NONE** (client or server) — `NewBookingSheet.tsx` | Server **HARD**, non-overridable — barber doc re-read in-transaction, `createWalkIn.ts` | **NONE** — doesn't re-check the already-assigned barber's current status on a date/time change | Server **HARD**, non-overridable — `blocks.ts` |
| **Çakışma** | Client **SOFT** confirm (`hasTimeConflict`); server **NONE** | Client **SOFT** confirm; server **NONE** ("carries no slot-conflict scan today (legacy parity)" — `createWalkIn.ts:35`) | Client **SOFT** confirm; server **NONE** | Server **HARD**, non-overridable, **race-safe** transaction+query (`blocks.ts:239-319`) — the one surface where this is actually closed |
| **Mesai dışı** | Client warning is **display-only** — does not even block submit (`outsideHours`, `NewBookingSheet.tsx`) | **NONE** — no evidence of any check | **NONE** | N/A by design — blocking your own time outside opening hours is presumably intentional (marking a day off, closing early) |
| **Mola** | Not a separate mechanism — a break **is** a `BLOCKED`-status booking in the same `bookings` collection (`blocks.ts:231,308`, `conflictUtils.ts:28,165-166`), so it inherits the **Çakışma** row exactly | same | same | *(a break is created here — Block Time is the producer, not a consumer, of this row)* |
| **İzin** | Client **SOFT** confirm (`availableBarberIds`/`getAvailableBarbersForDate`) | evidence insufficient — visual "off" styling on the barber chip exists (`availableTodayIds`), but whether Save itself gates on it was not independently confirmed this pass — **do not treat as decided either way** | **NONE** | **NONE** — `leave` is a distinct enum value in the barber doc but the server's deny check tests only `=== 'passive'` |

### 3.1 The Admin panel is not a clean "already correct" reference — it disagrees with itself and with Staff App

- **Admin `BookingForm.tsx` HARD-blocks** (`alert()`, no override) on off-day/off-shift-day
  (`:320-325`) — stricter than Staff App's New Booking, which **SOFT**-allows the same concept with an
  explicit ask (a **deliberate** 2026-06-29 incident fix, comment: *"Off-day / leave guard — staff
  override allowed... the person booking gets asked explicitly"*). These are two different decisions
  for the same category, live at the same time, on two different surfaces of the same product.
- **Admin's own Reschedule** (`BookingDetailPanel.tsx`) is **also** a raw `updateDoc()` with no server
  validation — the identical weakness reported for Staff App's `RescheduleSheet.tsx`. This is a
  **platform-wide** gap, not Staff-App-specific; closing it only on the Staff App side would leave
  Admin's reschedule equally exposed.
- **Admin's New Booking already routes through a real, hard-gated server engine** —
  `salownCreateAdminBooking` → `createBookingCore` (`functions/src/bookings/createBooking.ts:604`),
  which HARD-refuses `STAFF_UNAVAILABLE` (passive), `OUTSIDE_EFFECTIVE_SHIFT`, and `SLOT_CONFLICT`,
  transactionally, with (as read) no override parameter found. **This appears to contradict the
  client's own soft `window.confirm` for conflict** (`BookingForm.tsx:337-339`, *"Staff override:
  overlaps can be legitimate"*) and for outside-hours — if an admin confirms past that dialog, the
  server may reject anyway. **This needs to be verified precisely before any design decision is
  made** — either `createBookingCore` has an override path this pass didn't surface, or Admin's own
  confirm dialog is currently misleading. Flagging as an open question, not resolving it here.

### 3.2 The server infrastructure to fix New Booking already exists, unwired

`createBookingCore` carries a `surface?: 'admin' | 'staffApp'` discriminant and a
`STAFF_APP_BOOKING_SOURCE` constant explicitly commented **"NewBookingSheet appointment path"**
(`createBooking.ts:171,190,614-615`) — built, apparently for exactly this purpose, and never
connected. `grep 'staffApp'` across `functions/src/` returns zero callers of that literal outside the
core's own definition. `NewBookingSheet.tsx` still calls the legacy raw-write `createWalkInDetailed`.
This is **"built, never wired,"** not **"never built."**

---

## 4. Race-condition design — also already has a working precedent

Today's conflict check everywhere is check-then-act: query for overlaps, then write, as two separate
steps — two near-simultaneous bookings for the same barber/slot can both pass the check before either
write lands.

- **`salownCreateBlock`'s overlap scan is already race-safe**, not merely server-side:
  `tx.get(conflictQuery)` (`blocks.ts:283`, a compound `.where('startTime',...)` **query**, not a
  single-doc read) runs inside `db.runTransaction` (`:239`), before any write. Firestore retries a
  transaction whose read set changed before commit — two concurrent `salownCreateBlock` calls for an
  overlapping range cannot both succeed.
- **`createWalkIn.ts` already has the transaction skeleton** (reads `staffRef`, `barbersCol`, the
  service doc, all before deciding) but explicitly skips the conflict query — its own comment:
  *"Walk-ins carry no slot-conflict scan today (legacy parity)"* (`:35`). Adding a `blocks.ts`-shaped
  conflict query to this existing transaction is a **small, precedented addition**, not new
  infrastructure.
- **No new Firestore index is required.** `blocks.ts`'s `conflictQuery` isn't even barber-filtered —
  a single-field `startTime` range query, bounded by max block duration, with barber-matching done
  in-memory after the read. The deployed composite index (`bookings` `barberId+startTime`) is
  available if a tighter, barber-scoped query is preferred, but the working precedent doesn't need it.
- **A slot-lock document (`${barberId}_${slotStart}`, `create()`-fails-if-exists) does not fit this
  app.** Bookings have arbitrary start times and durations (a 12-minute service was an explicit test
  case this session, not a grid slot) — a single lock id per nominal slot misses partial overlaps.
  Covering a duration with per-minute locks is possible but wasteful and works against Firestore's
  per-transaction write-count limits for anything but short bookings.
- **Idempotency keys (`newBookingIdempotencyKey`/`newIdempotencyKey`) are orthogonal, not a
  substitute.** They stop the *same* retried request from double-creating; they do nothing for two
  *different* concurrent requests claiming overlapping slots.

**Conclusion: the transaction + range-query pattern from `blocks.ts` is the only option with an
existing, working, deployed implementation in this codebase**, and it already has a partial start
inside `createWalkIn.ts`.

### 4.1 Which writers actually participate in this coordination today — measured, not assumed

`grep -rl 'runTransaction'`/`grep -rl 'SLOT_CONFLICT'` across `functions/src/bookings/`:

| Writer | Transactional? | Conflict-checked? |
|---|---|---|
| `createBooking.ts` (Admin New Booking, `createBookingCore`) | Yes | Yes (`SLOT_CONFLICT`) |
| `blocks.ts` (Block Time) | Yes | Yes (`SLOT_CONFLICT`) |
| `createWalkIn.ts` (Staff Walk-in) | Yes (skeleton exists) | **No** — explicitly skipped, "legacy parity" (§4) |
| `reassignBooking.ts` | Yes | Not verified this pass — out of scope for this plan, flagged only |
| Staff New Booking (`NewBookingSheet.tsx` → `createWalkInInner`) | No — raw client write | No (client soft-confirm only) |
| Staff Reschedule (`RescheduleSheet.tsx`) | No — raw `updateDoc` | No |
| **Parsers** (`functions/src/parsers/{booksy,fresha,treatwell,ical}.ts`) | **No** — no `runTransaction` anywhere in this directory | **No** — no `SLOT_CONFLICT` anywhere in this directory |

**The parser gap is real and out of this plan's scope, but must be named, not hidden.** Every one
of D1/D3/D7's new transactions will still correctly see an already-written parser-imported booking
(the conflict query scans the whole `bookings` collection by time range, regardless of who wrote
it) — so a *Staff App* write racing against an *existing* parser import is caught. What is **not**
caught: two concurrent parser imports for the same slot (aggregator-side dedup is assumed, not
verified here), and a parser import racing against an *in-flight* Staff App transaction landing in
the same instant (the parser write itself never reads the conflict query, so it cannot be blocked
by, or itself detect, a same-instant Staff App write). This plan does not propose fixing the parser
side — it is a materially different writer (webhook/poll-driven, no interactive user to show a
conflict dialog to) — but Phase 0's acceptance criteria (§7) require this table to be published so
"race-safe" is never reported as platform-wide when it is Staff-App-and-Admin-only.

---

## 5. Decision table — FINALIZED 2026-09-12 (owner decisions below; no code/deploy yet)

| # | Question | Current state | **Final decision** | Type |
|---|---|---|---|---|
| D1 | Should New Booking and Reschedule get server-side enforcement at all? | Neither has any (raw Firestore writes, no callable) | **Yes.** Route both through `createBookingCore`-family logic (New Booking: wire the existing `surface:'staffApp'` path; Reschedule: needs new work). Deciding D1 does **not** pre-approve D3/D4's policy — those are decided independently below, not implied by "moving server-side" | **DECIDED** |
| D2 | Passive barber — absolute stop everywhere? | Already the documented principle (PASSIVE-AUTHORITY-R3); HARD for Walk-in/Block Time/Admin New Booking; **not** enforced for Staff New Booking/Reschedule | **HARD, everywhere, no override — ever.** Closes as part of D1's implementation | **DECIDED** |
| D3 | Conflict — reject by default, or stay staff-overridable? | Client soft-confirm today, no role gate, no record (§3.1) | **Reject by default.** `owner`-only override in v1 (see §5.2 — not `admin`, no new role/permission system). Override is scoped to *that specific transaction and the specific conflicting records shown* — it does not carry forward, and does not extend to passivity, leave, working-hours, or a `BLOCKED` (mola/Block Time) record (see §5.1). Actor/reason/target/conflicting-record-ids audited in the same transaction, on the `reassignBooking.ts:359-376` pattern | **DECIDED** |
| D4 | Outside working hours — warn or block? | Admin soft-confirms, server hard-rejects (contradiction, §3.1, still unverified); Staff New Booking shows a display-only warning that doesn't block submit; Walk-in/Reschedule have nothing | **Reject by default**, independent of D3 (a staff member taking one more client past shift end is not the same failure as double-booking one slot). `owner`-only override, same audit shape as D3. Hours computed from the barber's **effective shift**, not a blanket salon closing time; the existing 15-minute controlled-overflow allowance is preserved and does not itself require an override. An hours override does **not** cross into passivity, mola, or leave — each dimension needs its own separate approval if more than one is violated | **DECIDED** |
| D5 | Break (mola) | Not a separate mechanism — unified with conflict via `BLOCKED`-status bookings; today's conflict scan (`blocks.ts:286-299`) does not distinguish a `BLOCKED` record from a real booking | D3's override **must not** reach a `BLOCKED` record — see §5.1 for the required behavior and why this needs new logic, not just D3's transaction reused as-is | **Resolved by D3, with a named implementation requirement (§5.1)** |
| D6 | Leave (izin) | 2026-06-29's `NewBookingSheet.tsx` guard conflates passive+leave in one ungated `window.confirm` (§3.1, §5.2); the actual dated-window leave contract (`status:'leave'` + `leaveFrom/leaveUntil` + "explicit shift override beats leave", owner 2026-07-14) already exists in `staffEligibility.ts` but is wired only to the public-link reschedule gate | Apply the **existing** dated-leave contract — unchanged in its own terms — to **New Booking, Walk-in, and Reschedule only**. **Block Time is excluded**: creating a block is not a customer booking, so adding a block on a leave day is not automatically forbidden, and Block Time's existing passive/conflict protections are untouched. A plain booking confirmation must never itself alter the leave record or the shift; only the existing explicit, dated shift-override can beat leave | **DECIDED — corrects the draft table's earlier over-broad wording** |
| D7 | Race safety | Only Block Time is race-safe today (§4.1) | Each flow that gets server enforcement under D1 must **prove** — via a cross-flow concurrency test, not by inspection — that it shares transaction coordination with the other flows for the same barber/time (§8). "Uses the `blocks.ts` pattern" is necessary but not sufficient; parser/aggregator writers do not participate and that gap is named, not hidden (§4.1) | **DECIDED — with a proof obligation, not a mechanical close** |

### 5.1 Mola / Block Time conflict — required behavior (new logic, does not exist today)

Per D3/D5: an override must never let a New Booking/Walk-in/Reschedule write land on top of an
existing `BLOCKED` record (a mola or an admin/staff Block Time). Today's `blocks.ts:286-299` scan
does not distinguish `BLOCKED` from a real booking, so this is **new branching logic**, not a reuse
of the existing query as-is.

- If **any** conflicting record in the scanned range has `status === 'BLOCKED'`, the write is
  **refused outright, with no override path offered at all** — not even to `owner`. The UI must
  show an explicit message, not a silent rejection:
  *"Seçilen saat mola veya bloke edilmiş zamanla çakışıyor. Başka bir saat seçin."*
- **Mixed conflict** (the scanned range contains both a real booking and a `BLOCKED` record):
  no override either — the presence of any `BLOCKED` record voids the override path for the whole
  request, not just for that one record.
- **Do not label a `BLOCKED` record as "mola" unless the data actually says so.** `blocks.ts:303-315`
  writes `blockKind` on every block; only surface "mola" in the user-facing message when the
  colliding record's `blockKind` (or equivalent field) indicates a break. A `BLOCKED` record without
  that signal should read as a generic blocked/reserved time, not be asserted as a break the data
  doesn't confirm.
- Block Time's own creation path keeps its existing hard, non-overridable passive+conflict
  protection unchanged — D3's override never applies to Block Time as the *actor*, only concerns
  whether Block Time (or a break) can be the *target* an override tries to write over.

### 5.2 What this changes about the 2026-06-29 decision — scope of the update

`NewBookingSheet.tsx:260-283`'s existing guard is a **single** `window.confirm`, reached by any
staff member, gating an **"off-day"** concept that today conflates at least passive and leave (§3.1
already flagged this imprecision; this pass confirms it in the actual code, not just by inference),
plus a **separate** second `window.confirm` for time conflict, also ungated and unrecorded.

That single mechanism is being **replaced by two independent, differently-governed checks**, not
tightened uniformly:
- **Passive** → HARD, no override, no dialog at all (D2). This is a real behavior change from
  today: a passive barber currently can be booked past with one click; after this change, no staff
  member — including `owner` — can.
- **Leave** → governed **only** by the existing dated shift-override contract (D6, §5.2 above),
  evaluated server-side. The generic `window.confirm` that lets *any* staff member click through a
  leave day disappears; a leave day can now only be booked if the specific date already has an
  explicit shift override on record. This is a real behavior change: today's "ask and let the person
  booking decide" becomes "only a pre-existing, dated exception decides."
- **Conflict** (the second, separate `window.confirm` in the same file) → replaced by D3's
  reject-by-default + `owner`-only logged override.

**Net effect for staff (non-owner) users:** three things that a plain confirm click can do today —
override an off/passive day, override a leave day, override a time conflict — will do none of them
after this ships. Only `owner` retains a path through conflict/hours, and no one retains a path
through passive or (without a pre-existing dated override) leave. This must be communicated to the
owner as a **staff-facing behavior change**, not an invisible hardening, before Phase 1 ships.

---

## 6. Recommendation

1. **D2 (passive) and D7 (race safety) are not open policy questions** — they are unfinished
   application of principles already on record (R3; the working `blocks.ts` transaction pattern).
   D7 additionally carries a **proof obligation** (§8): "mechanically closed" is not an acceptable
   report for this item; a cross-flow race test is.
2. **D3 (conflict) and D4 (hours) are the two genuine policy changes**, both **decided**:
   reject-by-default, `owner`-only override in v1, with an audit trail on the existing
   `reassignBooking.ts`-style pattern. Neither override crosses into the other's dimension, nor into
   passivity/leave/mola — each violated dimension needs its own separate authorization.
3. **D6 (leave)** is decided as a **scope correction**, not a preservation: the existing dated-leave
   contract now applies to New Booking/Walk-in/Reschedule, explicitly **excluding** Block Time, and
   explicitly replacing the old ungated `window.confirm` (§5.2) — this is a staff-facing behavior
   change that must be flagged to the owner before ship, not silently rolled out.
4. **D5 (mola)** requires new branching logic (§5.1) that does not exist in `blocks.ts` today —
   budget real implementation time for this, it is not "covered for free" by D3's transaction.
5. **`owner`-only is the authorization boundary for v1, by explicit owner instruction** — `admin`
   holding `PRIVILEGED_ROLES` parity with `owner` for Block Time creation does **not** transfer to
   booking-policy overrides; that would require a new, separately-decided permission, which is out
   of scope here. If a `superAdmin` claim can reach this code path at all, that is a distinct,
   platform-level authority (`[[project_superadmin_tenant_selector]]`-style) and must be documented
   explicitly wherever it applies — **never silently treated as equivalent to tenant `owner`**.
6. **Do not touch Admin's flows in this pass** — but D1's platform-wide reschedule gap (§3.1) and the
   possible Admin conflict/hours client-vs-server mismatch (§3.1) should go on record as their own
   items once verified, since a Staff-only fix leaves Admin's reschedule equally open.

---

## 7. Phased implementation plan — D1-D7 decided (§5); **Phase 0 is documentation/analysis only,
implementation/deploy for Phase 1+ is a separate, not-yet-granted approval**

### Phase 0 — scope and acceptance criteria (analysis only; no server logic, no callable, no UI change)

**Scope — Phase 0 produces answers and a design note, nothing runnable in production:**
1. Confirm precisely whether `createBookingCore`'s `SLOT_CONFLICT`/`OUTSIDE_EFFECTIVE_SHIFT` accept
   any override parameter today, and reconcile that against Admin's client-side soft confirm (§3.1).
   This changes what D3/D4's implementation has to build vs. reuse in Admin's own engine.
2. Confirm whether Walk-in's Save path gates on `availableTodayIds`/leave today (§3, İzin row,
   evidence was insufficient this pass) before assuming Phase 2 needs new leave-checking work there.
3. Write the exact `BLOCKED`-exclusion branch design for §5.1 (field(s) checked, where in the
   transaction it runs relative to the existing conflict scan, exact refusal error code) — a design
   note, not code.
4. Write the exact audit-entry shape for D3/D4 overrides (fields, which existing helper from
   `utils/audit.ts` or the in-transaction `reassignBooking.ts`-style write it follows) — a design
   note, not code.
5. Name, for each of D3/D4's override, the precise authorization check to be used (`actor.role ===
   'owner'` at which call site / claim) and confirm no `superAdmin`-vs-tenant-`owner` conflation
   exists in that check (§6.5) — read-only verification against `identity.ts`, no code change.
6. Design the cross-flow race test harness required by D7/§8 (which flows it drives concurrently,
   what shared fixture proves shared coordination) — a test plan, not a written test yet.

**Acceptance criteria — Phase 0 is done when:**
- Items 1-2 above are answered with file:line evidence, not assumption, and posted to this document.
- Items 3-5 exist as reviewable design notes in this document (or a linked doc), not as diffs.
- Item 6's test plan is written into §8 with enough detail that Phase 1's implementer does not have
  to re-derive it.
- **No file under `functions/src/`, `src/staff/`, or `firestore.rules` has changed.** Phase 0 is
  read/design-only; if any of the above cannot be answered without writing throwaway code to probe
  behavior, that code is written in an isolated scratch location, never committed, and the finding
  is what gets recorded here — not the probe code itself.
- This document is updated with Phase 0's findings and re-shared for owner sign-off **before Phase 1
  opens a claim or touches a source file.**

Per the owner's explicit instruction: **Phase 0 may proceed now on this basis. Phase 1 (or any code/
callable/rules change) requires a separate, later approval and its own claim — it is not
pre-authorized by this document.**

**Phase 1 — New Booking → wire the existing engine (smallest, most precedented change)**
- Point `NewBookingSheet.tsx` at a callable built on `createBookingCore` with `surface: 'staffApp'`
  instead of the legacy `createWalkInInner`/raw `addDoc`. This alone closes passive (D2) for New
  Booking using code that already exists, and resolves the name-keyed `barberId` problem at the
  source (the callable would write canonical ids the way `createWalkIn.ts` already does), with zero
  legacy-record migration (§2.1).
- Add the `blocks.ts`-shaped conflict transaction+query to this same callable per D3's chosen policy.

**Phase 2 — Walk-in → close the "legacy parity" conflict gap**
- Extend `createWalkIn.ts`'s existing transaction (already reads `staffRef`/`barbersCol`/service doc)
  with the same conflict query. Passive is already handled here; this phase is conflict-only.

**Phase 3 — Reschedule → new server surface (no existing precedent to lean on)**
- Needs its own callable — no reschedule guard is reachable from any staff-facing surface today
  (`rescheduleStaffGate` only guards the public token-link path). Design should re-validate the
  *existing* assigned barber's current passive status (since reschedule doesn't reassign) plus
  conflict, at the new date/time, transactionally.
- Consider whether this callable should also serve Admin's `BookingDetailPanel` reschedule, since
  §3.1 established that surface has the identical gap — a shared fix avoids building the same thing
  twice, but that decision belongs to whoever owns Admin panel scope.

**Phase 4 — Block Time**
- Already correct for passive + conflict + race-safety. Only open item is D6 (leave not checked) if
  the owner decides that should change.

---

## 8. Test plan (design due in Phase 0 per §7; tests themselves written alongside each phase)

- **Emulator, per phase**: a `@firebase/rules-unit-testing`-style suite (matching the existing
  `test/rules/availabilityFrom.emulator.test.js` pattern) asserting: passive barber → refused, no
  override, for any role including `owner`; active barber, no conflict → allowed; the specific
  name-keyed-`barberId` legacy shape still resolves correctly through `resolveBarberRef` (a direct
  regression guard for §2.1's claim).
- **Race-condition test, per phase that gets a conflict transaction**: fire two concurrent
  create/reschedule calls for the same barber and overlapping range (Node's `Promise.all` against the
  emulator, or two callable invocations racing) and assert exactly one succeeds and the other receives
  `SLOT_CONFLICT` — mirroring however `blocks.ts` itself is tested today (check for an existing
  `blocks` race test first and reuse its harness rather than inventing a new one).
- **Cross-flow race tests — required for D7, not optional (§5, §6.1):** a single-flow race test
  (e.g. two `createWalkIn` calls racing each other) does **not** prove D7. At minimum:
  New-Booking-vs-Walk-in, New-Booking-vs-Block-Time, Walk-in-vs-Reschedule, and
  Reschedule-vs-Block-Time, each pair racing for the same barber and an overlapping time range,
  asserting exactly one write lands and the other receives `SLOT_CONFLICT`. Record the result as a
  table (pair × pass/fail) in this document once run — "race-safe" is a claim about the *set* of
  flows, and must be reported per-pair, not as one aggregate pass.
- **Parser-writer gap (§4.1) — explicitly NOT covered by the above.** Do not write a parser-vs-Staff
  cross-flow test and report it as closing D7; record instead, once, that this remains an open,
  named, out-of-scope gap per §4.1's table.
- **Passive/leave — no-override regression tests:** attempt the old client-only override path
  (whatever UI affordance remains, if any) against a passive barber and against a barber on leave
  outside any dated shift-override window, for **every** role including `owner`, and assert refusal
  in both cases — this is the regression guard for §5.2's "no one retains a path through passive or
  undated leave" claim.
- **Mola/`BLOCKED` override-denial test (§5.1):** attempt a `owner`-authorized conflict override
  against a slot that collides with a `BLOCKED` record, and against a mixed booking+`BLOCKED`
  collision, and assert both are refused with no override path offered — not merely warned.
- **Override path (D3/D4, now designed in §5):** assert the override requires `owner` specifically
  (not `admin`, not any other role), is refused for every non-`owner` caller including `admin`, and
  is recorded (audit log, `reassignBooking.ts`-style, in the same transaction) with actor, reason,
  target, and the conflicting record id(s) — an override with no record is not what "kayıtlı" means.
