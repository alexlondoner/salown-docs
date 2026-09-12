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

### 7.1 Phase 0 findings — posted 2026-09-12 (read-only verification; no source file touched)

**Item 1 — does `createBookingCore` accept any override for `SLOT_CONFLICT`/`OUTSIDE_EFFECTIVE_SHIFT` today?**
**No, definitively.** The full input contract — `ALLOWED_ADMIN_INPUT_KEYS` (`createBooking.ts:144-150`)
and the server-built `CoreOpts`/`PrivilegedContext` (`:578-591`, `:180-191`) — carries no
`force`/`override`/`allowConflict`/`bypassHours` field of any kind, and the deny logic
(`:992-1033`) is unconditional on role: being a privileged (Admin/Staff-App) caller changes *which*
policy applies (skips same-day/notice/advance rules), never whether the shift-fit or busy-slot test
itself can be skipped. **Admin's client-side conflict `window.confirm`
(`src/components/BookingForm.tsx:340-344`) is confirmed misleading, not a real override**: the
payload it sends (`:364-378`) carries no flag derived from that confirm, and a rejected server call
always lands in the generic `saveFailed` catch (`:410-419`) regardless of what the operator clicked
through. This resolves §3.1's open question: the confirm dialog implies a choice that does not
exist server-side today. **Also newly confirmed**: Admin's outside-hours check is not even a soft
confirm — it is a hard **client-side** `alert()` that aborts before any server call
(`BookingForm.tsx:327`), stricter in practice than the conflict path even on the client.
→ **Consequence for Phase 1**: D3/D4's server-side reject-by-default is not a behavior change for
Admin at all (the server already always rejects); it *is* a behavior change for Staff App, whose
client never calls this core today.

**Item 2 — does Walk-in's Save path gate on leave today?**
**Client-side warning only; server-side: no check at all.** `WalkInFlow.tsx:289-292`'s
`confirmIfOffToday()` pops one dismissable `window.confirm` for any barber outside
`availableTodayIds` (which excludes leave-within-window barbers per `bookingUtils.ts:510`), then
`handleSave` (`:396-411`) proceeds straight to `createSaleBooking`/`salownCreateWalkIn` on
confirmation. Server-side, `assertAssignableStaff` → `staffEligibility.ts:128-150` checks only
`status === 'passive'` and `availabilityFrom` — **no `leave`/`leaveFrom`/`leaveUntil` reference
anywhere in that function.** So today, any staff member can click through and book a leave-status
barber with zero server-side resistance. → **Consequence for Phase 1**: Walk-in's leave-gap is not
"needs verification," it is a confirmed, currently-open gap identical in shape to New Booking's —
Phase 2 (§7, Walk-in) must add the same server-side leave evaluation this plan already scopes for
New Booking/Reschedule under D6, not just the conflict query originally scoped for that phase.

**Item 3 — is there an existing "owner-only, `admin` excluded, `superAdmin` does not bypass" helper?**
**No such helper exists; every current precedent does the opposite of at least one half.**
`blocks.ts:84-85`'s `PRIVILEGED_ROLES = {owner, admin}` and `identity.ts:437,468-470`'s
`setStaffRoleCore` both treat `admin` as equal to `owner` for the gate, and both let
`superAdmin === true` bypass the check entirely ("break-glass," `identity.ts:411` comment).
`packagePlan.ts:1097-1133`'s `canPerform` does the same (superAdmin bypasses everything, every
action resolves to `owner || admin`). The **one** partial precedent that is genuinely owner-only
— `index.ts:3216`'s "only an owner can create another owner" check inside `createStaffUser`
(`callerRole !== 'owner'` rejects `admin` too) — **still explicitly carves out `!callerIsSuper`**,
i.e. `superAdmin` bypasses even this one owner-only gate.

**⚠️ New open question surfaced by this finding — needs an explicit owner decision, not an
assumption, before Phase 1 writes the D3/D4 authorization check:**
Should a `superAdmin` claim bypass the new conflict/hours override gate the way it bypasses every
other privileged check in this codebase, or should this be the **first** gate in salOWN where
`superAdmin` does **not** automatically grant access and the caller must additionally hold tenant
`owner`? Per §6.5's existing instruction ("never silently treated as equivalent to tenant owner")
and `[[feedback_delete_superadmin_only]]`'s adjacent precedent (superAdmin authorized independently
of tenant-owner status for deletion), **the recommendation is: superAdmin may use the override, but
only via the documented super-admin console/tenant-selector path (same pattern as
`[[project_superadmin_tenant_selector]]`), never as a silent bypass reachable from the ordinary
Staff/Admin UI** — but this is a genuine departure from every existing convention in the codebase
and must be confirmed, not inferred, before Phase 1 implements the check.

**Item 3 (design note) — the BLOCKED-exclusion branch, exact shape:**
In the new conflict-scan loop (mirroring `blocks.ts:286-299`), before any override path is
considered, check whether **any** doc in the scanned range has `status === 'BLOCKED'`
(`blocks.ts:308` field). If so, return a distinct deny reason — e.g. `BLOCKED_TIME_CONFLICT`, not
`SLOT_CONFLICT` — and the authorization branch must refuse to accept an override request when the
reason is `BLOCKED_TIME_CONFLICT`, for **every** role including `owner`, with no code path that
converts it back to an overridable `SLOT_CONFLICT`. **Corrected finding on labeling:** `blocks.ts`'s
`blockKind` field has exactly two values, `'block'` and `'busy'` (`blocks.ts:191-194`,
`BLOCK_KINDS`) — **neither means "mola"/break; the data model has no field that distinguishes a
personal break from any other block today.** §5.1's instruction ("don't label as mola unless the
data says so") therefore resolves to: **never assert "mola" in the user-facing message** — use the
generic wording already drafted in §5.1 ("mola veya bloke edilmiş zaman"), since no structured field
currently supports a more specific claim. The free-text `note` field on a block is not a reliable
signal to pattern-match on.

**Item 4 (design note) — audit-entry shape for a D3/D4 override, on the `reassignBooking.ts:359-376`
pattern (atomic, same transaction, not fire-and-forget):**
```
tx.set(auditRef, {
  ...buildServerAuditEntry({
    action: 'BOOKING_CONFLICT_OVERRIDE' /* or 'BOOKING_HOURS_OVERRIDE' */,
    source: 'function',
    actor: { uid: actor.uid, email: actor.email || '', role: actorRole },
    target: { collection: 'bookings', docId: newBookingDocId, label: bookingId },
    meta: {
      dimension: 'conflict' /* or 'hours' */,
      reason: input.overrideReason,               // required, non-empty — "kayıtlı" means a reason exists
      barberId, barberName,
      requestedStartMs, requestedEndMs,
      conflictingRecordIds: [...matchedDocIds],    // every record the override actually overrode
    },
  }),
  timestamp: Timestamp.now(),
});
```
Written in the **same** transaction as the booking write (the row is the deliverable, per
`reassignBooking.ts:350-358`'s own rationale) — never fire-and-forget for this action, since a lost
audit write would mean an unrecorded override, which §5's "kayıtlı" requirement forbids.

### 7.2 Phase 0 — consolidated report (owner-requested structure, 2026-09-12)

**Correction to the draft's framing:** §2.1/§3.2 originally read as "mostly wiring already-built
pieces." That characterization is **not fully accurate** and is corrected here with an itemized
reuse-vs-new inventory (below) — several pieces are genuinely new engineering, not integration.

**1) Where the approved D1-D7 decisions differ from what the code does today**

| Dimension | Approved decision | Code today |
|---|---|---|
| Passive | HARD everywhere, no override | HARD only for Walk-in/Block Time/Admin; New Booking/Reschedule have none (§3) |
| Conflict | Reject-by-default, `owner`-only logged override | Admin: always hard-rejects server-side already, client confirm is inert/misleading (§7.1 item 1); Staff App: soft client confirm only, no server check at all except Block Time |
| Hours | Reject-by-default, `owner`-only override, effective-shift-based | Admin: hard client `alert()`, server already unconditionally rejects (§7.1 item 1); Staff New Booking: display-only warning, doesn't block submit; Walk-in/Reschedule: nothing |
| Leave | Dated-override contract, applies to New Booking/Walk-in/Reschedule, excludes Block Time | New Booking: one ungated `window.confirm` conflating passive+leave (§5.2); Walk-in: one dismissable `window.confirm`, **zero server check** (§7.1 item 2, newly confirmed — was "evidence insufficient" in the draft); Reschedule: nothing; the actual dated contract exists only in `staffEligibility.ts`'s `rescheduleStaffGate`, wired only to the public-link path |
| Mola/`BLOCKED` override-denial | Never overridable, explicit message, no "mola" label without data | Does not exist in any form — `blocks.ts`'s scan doesn't even distinguish `BLOCKED` today (§5.1) |
| `owner`-only auth (no `admin`, no silent `superAdmin` bypass) | Required | **No such helper exists anywhere in the codebase** — every precedent conflates `admin`=`owner` or lets `superAdmin` bypass (§7.1 item 3) |
| Race safety | Per-pair cross-flow proof | Only Block Time is race-safe; no cross-flow test of any kind exists today (§4.1, §8) |

**2) Reusable infrastructure vs. genuinely missing pieces — itemized, not assumed**

*Genuinely reusable, verified this pass:*
- `resolveBarberRef`/`matchesBarber` (read-time legacy-name resolution) — proven, already live for other writers (§2.1).
- `createBookingCore`'s candidate-selection **already supports a single pre-selected barber**: when
  a `barberId` is passed, `candidates` collapses to one entry (`createBooking.ts:775,782`), so New
  Booking's explicit-barber-pick UX maps onto a single-target check, not the multi-candidate
  auto-assign path — this is a real, usable seam, confirmed by reading the candidate-construction
  code (not assumed from the `surface:'staffApp'` comment alone).
- `rescheduleStaffGate` (`staffEligibility.ts:163`) is a **pure function** — `(barberDoc, dayKey,
  hasShiftOverride) → gate` — with no coupling to the public-link caller beyond being invoked from
  one call site (`index.ts:1943`). It is genuinely callable from a new staff-facing Reschedule path
  without modification — confirmed by reading its signature and its one call site, not inferred.
- `buildServerAuditEntry`/the `reassignBooking.ts` atomic-audit pattern — reusable as a template (§7.1 item 4).

*Genuinely new — not wiring, not reuse, and not previously scoped this precisely:*
- **The conflict-scan itself is not a shared function.** `createBooking.ts:992-1033`'s scan is
  inline inside `createBookingCore`, shaped around multi-candidate auto-assign (`belongsTo`,
  `busyDocs`, least-busy-first ordering) — structurally different from `blocks.ts:286-299`'s
  simpler single-target range scan, and `createWalkIn.ts` has neither. There is **no single
  conflict-check utility three writers can call** — Phase 1-3 either duplicate the check per-writer
  (as today's three writers already do, independently) or a shared extraction becomes its own
  precursor task. This plan does not resolve that choice; it is flagged for Phase 1 planning.
- **BLOCKED-exclusion branch** (§5.1/§7.1 item 3 design note) — zero precedent, net-new logic.
- **Server-side leave enforcement for Walk-in** — confirmed **absent entirely** (§7.1 item 2), not
  merely "not yet verified" as the draft table said. Phase 2's scope (§7) must grow from
  "conflict-only" to "conflict + leave," since passive was already the only dimension actually closed there.
- **The `owner`-only, no-`superAdmin`-bypass authorization check** — confirmed novel, and a
  deliberate departure from every existing convention in the codebase (§7.1 item 3), including a
  **new open question** (superAdmin bypass or not) that needs owner sign-off before it's written.
- **Override-capture UI** — a new interaction entirely: showing the specific conflicting record(s),
  collecting a mandatory reason from `owner`, and visibly differentiating "hard block, no dialog at
  all" (passive, mola) from "override available" (conflict, hours) from "dated-exception-only, no
  generic confirm" (leave). Nothing in the current four sheets has this shape; the existing
  `window.confirm`s are being removed, not extended (§5.2).
- **Cross-flow race tests** (§7.1 item 6 design note, §8) — no such test exists for any pair today.

**3) Race-condition avoidance across the four flows; other non-participating writers**

Full detail in §4/§4.1/§8. Summary: only `blocks.ts` is transactional+conflict-checked+race-safe
today; `createBooking.ts` (Admin) is transactional+conflict-checked; `createWalkIn.ts` is
transactional but explicitly skips the conflict query; Staff New Booking and Reschedule are raw,
non-transactional client writes. **Cross-flow safety is not established by any of the above being
individually race-safe** — Firestore transaction isolation only protects reads/writes *within* the
same transaction's read set; two *different* writers racing each other are only mutually safe if
both query and both write inside transactions over overlapping data, which today only
`blocks.ts`-vs-`blocks.ts` is proven to do. §8 now requires this proven per named pair
(New-Booking↔Walk-in, New-Booking↔Block-Time, Walk-in↔Reschedule, Reschedule↔Block-Time) rather than
inferred from each flow individually adopting "the `blocks.ts` pattern." **Parsers/aggregators
(`functions/src/parsers/{booksy,fresha,treatwell,ical}.ts`) do not participate in this coordination
at all** (no `runTransaction`, no `SLOT_CONFLICT` in that directory, §4.1) — named as an explicit,
out-of-scope, un-hidden gap.

**4) Owner-only override, approval validity, and audit design**

Decided (§5, D3/D4): `owner`-only in v1, not `admin` (despite `admin` holding `PRIVILEGED_ROLES`
parity with `owner` elsewhere, e.g. Block Time creation — that parity does not transfer here, by
explicit owner instruction). **New open question from Phase 0** (§7.1 item 3): whether `superAdmin`
bypasses this gate the way it bypasses every other privileged check in the codebase — recommendation
given, decision still owed before Phase 1 writes the check. Approval validity: scoped to *the
specific transaction and the specific conflicting record IDs shown at approval time* — re-running
the write after new conflicts appear requires a fresh approval, not a carried-forward one (§5, D3).
Audit: atomic (same transaction), on the `reassignBooking.ts:359-376` pattern, with actor/reason/
target/conflicting-record-ids — exact shape in §7.1 item 4.

**5) Canonical staff identity and legacy-record compatibility**

Unchanged from §2/§2.1, re-confirmed, not re-litigated this pass: `barbers`/`staff` remain two
separate identity systems (assignee schedulability vs. caller's login identity), and no
write-migration is needed because `resolveBarberRef` (server) and `matchesBarber` (client) already
resolve legacy name-keyed `barberId` values at read time, in production use today by
`createWalkIn.ts`/`reassignBooking.ts`. Any new server enforcement for New Booking/Reschedule
resolves through the same functions — this claim carries file:line evidence from the original pass
and was not contradicted by anything found in Phase 0.

**6) Phased implementation, meaningful acceptance tests, and release order**

Revised from §7's original phase list given the above (order unchanged, content per-phase updated):

- **Phase 1 — New Booking.** Carries the **full weight** of every new mechanism for the first time:
  wire `surface:'staffApp'` with an explicit `barberId` (reuse, confirmed single-candidate-safe);
  port (not call) a conflict-scan shaped like `blocks.ts`'s, with the new BLOCKED-exclusion branch;
  wire leave via `rescheduleStaffGate`'s logic (reuse the pure function, new call site) replacing the
  2026-06-29 guard per §5.2; write the novel `owner`-only auth check (pending the `superAdmin`
  decision); write the audit entry; build the override-capture UI; remove the old dual
  `window.confirm`. **Acceptance:** passive → hard refuse for every role incl. `owner`, no dialog;
  leave outside a dated override → refuse for every role incl. `owner` (no generic confirm exists to
  click through); leave inside a dated override → allowed; conflict/hours → refused by default,
  `owner` override succeeds only with a reason and produces the exact audit shape from §7.1 item 4;
  conflict against a `BLOCKED` record → refused for every role incl. `owner`, correct message, no
  "mola" claim unless justified; legacy name-keyed `barberId` on the conflicting record still
  resolves via `resolveBarberRef` (regression guard, §2.1); New-Booking-vs-New-Booking and
  New-Booking-vs-Block-Time cross-flow race tests both pass.
- **Phase 2 — Walk-in.** Reuses Phase 1's ported conflict-scan/BLOCKED-exclusion/leave-wiring/audit/
  UI mechanisms once built (do not re-invent). **Grows in scope from the original "conflict-only"**
  to **conflict + leave**, since §7.1 item 2 confirmed leave is entirely unenforced server-side here
  today — passive was already the only dimension actually closed. **Acceptance:** same battery as
  Phase 1, plus Walk-in-vs-New-Booking and Walk-in-vs-Reschedule cross-flow race tests.
- **Phase 3 — Reschedule.** New callable (no existing staff-facing precedent), re-validating the
  *already-assigned* barber's current passive/leave status (doesn't reassign) plus conflict/hours at
  the new time — reuses `rescheduleStaffGate` for leave and Phase 1's conflict-scan port.
  **Acceptance:** same battery, applied to a reschedule of an existing booking (own booking excluded
  from its own conflict scan, per §5, D3's note); Reschedule-vs-Walk-in and Reschedule-vs-Block-Time
  cross-flow race tests. Whether this callable also serves Admin's identically-gapped
  `BookingDetailPanel` reschedule (§3.1) is a scope call for whoever owns Admin panel work, not
  decided here.
- **Phase 4 — Block Time.** Already correct for passive/conflict/race-safety; only change is
  confirming D6's explicit leave-exclusion (no new check needed, verify no accidental leave-gate
  gets added here). **Acceptance:** existing Block Time tests stay green; a targeted test confirms a
  block CAN be added on a leave day (negative-of-the-other-three-flows regression guard).

**Release order stays New Booking → Walk-in → Reschedule → Block Time** (smallest-precedented-first,
per §6's original reasoning) — each phase is its own claim, its own deploy, its own owner
verification, per the workspace's one-change-at-a-time discipline; this plan does not bundle them.

**Item 6 (design note) — cross-flow race test harness, for §8's required pairs:**
One parameterized emulator helper: given two `(callableName, payloadBuilder)` pairs targeting the
same `barberId` and an overlapping `[startMs, endMs)` window, fire both via `Promise.all` against a
running emulator, then assert exactly one resolves with a real `bookingId`/block id and the other
resolves with `SLOT_CONFLICT` (or `BLOCKED_TIME_CONFLICT` where applicable). Parameterize the pair
list with the four named pairs (§8) plus same-flow races already covered by existing tests (don't
re-derive those). Reuse whatever harness `blocks.ts`'s own existing race test already uses for
emulator setup/teardown rather than building a second one — Phase 1's implementer should locate that
test file first (not located in this pass; a `find` for `blocks*.emulator.test` at Phase 1 start
will locate it).
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

---

## 9. Phase 1 — New Booking implementation status (2026-09-12) — **CODE WRITTEN + TESTED, NOT DEPLOYED**

Owner approved Phase 1 implementation + tests on the corrections below; **deploy remains a
separate, not-yet-granted approval** and nothing in this section has been released.

### 9.1 Corrections applied (owner review, verbatim intent preserved)

1. **"BLOCKED-hariç-tutma" terminology fixed.** A `BLOCKED` record was already, and remains,
   INCLUDED in the conflict scan (unchanged — `blocks.ts`'s shape). The only thing excluded is
   the *override*: if even one matching record has `status==='BLOCKED'`, the write is refused
   outright (`BLOCKED_TIME_CONFLICT`) with **no override path offered to any role, including
   `owner`** — never silently converted back to an overridable `SLOT_CONFLICT`.
2. **Admin isolation, verified not assumed.** Every new branch is gated on `isStaffApp`
   (`priv.surface === 'staffApp'`); the `else`/non-`isStaffApp` code paths are byte-identical to
   before. Confirmed three ways: (a) the full pre-existing test suite — including
   `createAdminBooking.emulator.test.js` and the public `createBooking.emulator.test.js` — passes
   unmodified; (b) a dedicated new test proves the Admin surface sending
   `overrideConflict`/`overrideReason` gets `INVALID_INPUT` ("override fields require the Staff App
   surface"), not silent ignoring; (c) `ALLOWED_ADMIN_INPUT_KEYS`' three new keys are validated
   closed for any non-staffApp `priv` inside `normalizeInput`, before the transaction ever runs.
3. **Authorization is never taken from the payload.** `overrideConflict`/`overrideReason`/
   `acknowledgedConflictIds` carry intent + reason only; eligibility is decided from `adminRole`,
   already re-read server-side from `staff/{actorUid}` inside the transaction (the pre-existing
   O1AB pattern, untouched). Approval is scoped to the *exact* conflicting record ids present at
   decision time — resubmitting after the conflict set has changed without a fresh, matching
   `acknowledgedConflictIds` is refused with `CONFLICT_ACK_REQUIRED`, not silently honored against
   stale ids. Audit is written with `tx.set` in the *same* transaction as the booking
   (`reassignBooking.ts`-style, deliberately diverging from this file's own fire-and-forget
   `STAFF_BOOKING_CREATED` audit for exactly the reason §5's "kayıtlı" requirement demands).
4. **Race-safety claimed only where tested.** New Booking is proven self-race-safe (pre-existing
   test) and proven race-safe **against a concurrently-created Block Time** for the same
   barber/slot (new cross-flow test, §9.2 #22) — genuine Firestore transaction contention, not two
   independent writes. It is explicitly **not** claimed race-safe against Walk-in or Reschedule
   (neither is wired to this coordination yet — Phases 2-3). Parser/aggregator writers
   (`functions/src/parsers/{booksy,fresha,treatwell,ical}.ts`, §4.1) are **not migrated onto this
   coordination within this plan's scope — this is a residual, standing race risk, not a
   permanent architectural exemption.** Concretely: a parser import and a Staff App write for the
   same barber/instant can still both land, because the parser side never reads the conflict query
   inside a transaction. No system-wide conflict-freedom guarantee is made or implied while this
   gap stands; closing it (or accepting it by an explicit, named product decision) is undecided and
   out of this plan's phases, not resolved by omission. §7.2's per-phase acceptance table is the
   source of record for which pairs are proven and which remain open.
5. **The callable-bypass gap is real, measured, and NOT closed this session.**
   `firestore.rules:510-514` (`match /bookings/{docId}`, `allow create`) lets **any authenticated
   member of the tenant** (`isTenantAny(tenantId)`) write a booking document directly via the
   client SDK, past `a1WithinWindow` and the anonymized-field ban only — passive/conflict/hours/
   leave/`BLOCKED` are enforced **only** by the callable Phase 1 just built, and a client that
   still calls `addDoc` (an old cached bundle, a compromised session, a devtools write) bypasses
   all of it. **This is not fixed here** — a rules change is its own review + its own deploy
   target (§9.3) — but it means Phase 1 is "the callable is now correct," not "the enforcement is
   airtight." The migration order that closes this: ship the callable (this phase) → verify no
   legitimate caller still uses the old path → THEN narrow `firestore.rules`' `bookings` `create`
   rule for authenticated writes (a separate, security-reviewed change). Shipping the rules change
   before every legitimate client is migrated would break any caller still on the old write path.
6. **"Tek deploy" varsayımı kaldırıldı.** See §9.3 — Functions, Staff hosting, and (later, separately)
   `firestore.rules` are three different deployable units with three different rollback identities;
   none was deployed this session.

### 9.2 Files changed (12; none deployed)

| File | What changed |
|---|---|
| `functions/src/bookings/createBooking.ts` | New override state machine in the per-candidate loop (`isStaffApp`-gated), `BLOCKED_TIME_CONFLICT`/`OVERRIDE_REQUIRES_OWNER`/`CONFLICT_ACK_REQUIRED` reasons, in-transaction audit write, 3 new allowlisted input fields, `_docId` on scanned day-docs, `CreateBookingResult` deny-detail fields |
| `functions/src/index.ts` | New `salownCreateStaffBooking` callable (mirrors `salownCreateAdminBooking`, `surface:'staffApp'`) |
| `functions/src/bookings/createStaffBooking.emulator.test.js` | +12 tests (11 override/BLOCKED/audit/Admin-isolation cases + 1 cross-flow race vs Block Time) |
| `functions/src/utils/deployableExports.test.js` | `RELEASE_PLAN` gained `salownCreateStaffBooking` (see §9.1 item 6 / §9.4 for the unrelated A1 cross-cutting note) |
| `src/utils/bookingCallables.ts` | New `callSalownCreateStaffBooking` + `StaffBookingInput`/`StaffBookingDenyDetails`/`staffBookingDenyDetails` |
| `src/staff/lib/staffBookingReason.ts` | **New file** — reason-code → i18n-key mapping for this callable (mirrors `staffCreateReason.ts`'s established pattern for `salownCreateWalkIn`) |
| `src/staff/sheets/NewBookingSheet.tsx` | Appointment-tab save routed through `callSalownCreateStaffBooking`; both legacy `window.confirm` dialogs removed; owner-only override reason-capture flow added |
| `src/i18n/dictionaries/{en,tr}/staffApp.ts` | Removed `offOnDateConfirm`/this tab's `conflictConfirm`; added override-prompt strings + a `bookingReason.*` table |
| `src/staff/sheets/staffBookingType.test.ts` | Updated stale "NewBookingSheet is not cut over" assertions to match the actual cutover |
| `src/staff/sheets/staffCreateCutover.test.ts` | Corrected a stale scope-note comment (no assertion change) |
| `src/utils/a2ServiceIdentity.test.ts` | Updated two assertions that pinned "NewBookingSheet stays untouched" |

### 9.3 Test results (all green; last run 2026-09-12)

| Suite | Result |
|---|---|
| Functions emulator gate (`ops/test-emulator.sh`, both phases) | **660/660 pass** |
| Functions unit tests (`functions && npm test`, no emulator) | **2683/2683 pass** |
| Frontend vitest (`npm test`) | **5530/5530 pass** |
| `tsc --noEmit` (functions + frontend) | **0 errors** |
| `eslint` (changed files) | **0 errors** |
| Local Chrome / live UI walk-through | **DONE — §9.6, full round** |
| Real Auth-token → HTTP → Firestore document verification | **DONE — §9.6, 26/26 checks** |

Live/Chrome and real-Auth-token verification were completed in a follow-up round after this
document's own review flagged that trigger-log evidence alone does not prove booking/audit
*content*, and that a hand-built `PrivilegedContext` in a unit test does not exercise the real
Auth → callable → role-re-read chain. See §9.6 for what was actually run and what it proved.

### 9.6 Round-2 verification — real Auth tokens, real Firestore documents, real Chrome (2026-09-12)

Owner review after §9.1-§9.5 identified two evidence gaps: trigger-log firing proves a write
happened, not that it wrote the *right* content; and a hand-built `PrivilegedContext` object
(the unit/emulator test style) proves the core's transaction logic, not the real
`request.auth` → verified-ID-token → `token.tenantId` → role-re-read chain a browser actually
exercises. Both are closed here, plus the Chrome UI checks §9.3 previously could not complete.

**Track A — no browser, three emulators (firestore+auth+functions), a throwaway rehearsal script
(seeded, run, deleted, not committed) driving REAL HTTP calls with REAL Auth-emulator ID tokens:**

| # | Check | Result |
|---|---|---|
| 1 | Bare `superAdmin` claim, no staff doc under the acting tenant, real ID token → override attempt | `PERMISSION_DENIED` before override logic is ever reached |
| 2 | Non-owner `staff` real token, non-owner `admin` real token → override attempt | both `OVERRIDE_REQUIRES_OWNER` — confirms `admin` ≠ `owner` for this gate via the real HTTP wrapper, not just the core |
| 3 | Genuine owner (real token, `staff/{uid}.role==='owner'`) vs a `BLOCKED` record | `BLOCKED_TIME_CONFLICT`; **zero** audit docs written for the refusal |
| 4 | Conflict-changed re-approval, two real sequential HTTP calls with a genuine Firestore write in between | stale ack → `CONFLICT_ACK_REQUIRED` with the real current ids; fresh ack with those ids → succeeds |
| 5 | Owner override success — **booking + audit DOCUMENT CONTENT**, not trigger logs | booking: correct `barberId`/`barberName`/`status`/`source`/exact `startTime`; audit: `actor.uid` is the real owner uid from the verified token, `actor.role==='owner'`, `meta.reason` is the exact typed text, `meta.dimensions.conflictingRecordIds` matches exactly what was acknowledged, `target.docId` points at the exact booking |

26/26 checks passed. This is the auth-chain + document-content evidence §9.1's original claims
lacked — verified, not merely asserted.

**Track B — real Chrome, real Vite dev server, the SAME three emulators, `src/firebase.ts`
temporarily pointed at them (reverted before this session ended, never committed), driving the
ACTUAL `NewBookingSheet.tsx` through the ACTUAL `salownCreateStaffBooking` callable:**

| # | Check | How proven |
|---|---|---|
| 1 | `BLOCKED` collision → **no override offered**, for owner | `window.prompt` was stubbed to *record* calls, not suppress them — zero calls recorded (`window.__promptCalls === []`); Firestore confirms no booking was created |
| 2 | **Form data preserved after a refused submit** | the SAME screenshot proving (1) also shows client name/phone/date/time/service/barber all still populated — the sheet does not clear or close on a denial |
| 3 | Conflict-changed re-approval, live in the browser | the prompt stub injected a genuinely NEW conflicting booking (via a synchronous Firestore REST write) between the first prompt and the resubmission; the app's own `tryOverride` correctly caught `CONFLICT_ACK_REQUIRED` and re-prompted with the exact second message string (`"The conflict just changed. Enter a reason to try again:"`); the resulting booking's audit doc records `conflictingRecordIds` for **both** the original and the newly-injected record |
| 4 | Non-owner (`staff`) denial, live in the browser | prompt was shown (any role sees it, by design) with the exact `overrideConflictPrompt` text; after resubmission the sheet stayed open, form data intact, Firestore confirms no booking was created |

Admin-in-Chrome specifically was not re-run as a fifth Chrome pass — Track A already proved
`admin` real-token denial via the real HTTP wrapper (item 2 above), and the Staff Chrome pass
(item 4) already exercises the identical non-owner code path and prompt/denial UI; repeating the
same UI behaviour a second time for a second non-owner role was judged low marginal value against
this machine's memory constraints (below).

**A note on the environment, not the feature:** getting Track B running took several failed
attempts, entirely due to Chrome-automation/environment issues, not the product code:
`src/firebase.ts` originally pointed the emulator wiring at the wrong Firestore *project id*
(`havuz-44f70` instead of `demo-c1`, so the seeded data was invisible); the on-screen
"Alex" chip resolved, via naive DOM text search, to a **hidden duplicate** rendered by the
always-mounted Walk-in tab, not the visible Appointment tab's own chip (fixed by filtering for
`getBoundingClientRect().width > 0`); and the machine ran out of memory once, killing the
Functions+Auth+Firestore emulator trio and the Vite dev server mid-session (66-75MB free,
`vm_stat`/`top`-confirmed) — cleanly restarted afterward rather than retried blindly. None of
this reflects on `createBooking.ts`/`NewBookingSheet.tsx`; it is recorded so a future session does
not waste time rediscovering the same three traps.

**Cleanup confirmed:** `src/firebase.ts` reverted (`git status` clean), both throwaway rehearsal
scripts deleted (not committed), `functions/.secret.local` restored, all emulator/dev-server
processes stopped. Nothing from this round was deployed.

### 9.4 Remaining gaps — named, not hidden

- **`firestore.rules` callable-bypass — owner review 2026-09-12: this is now a STATED CLOSING
  CRITERION of STAFF-AVAIL-GAP, not an out-of-scope footnote.** STAFF-AVAIL-GAP is not considered
  fully enforced — regardless of how many of Phases 1-4 ship — while `isTenantAny(tenantId)` still
  lets any authenticated tenant member bypass every callable this plan builds. Measured, not
  assumed: the SAME bypass exists on **both** rule branches that matter here —
  `match /bookings/{docId}` `allow create` (`firestore.rules:512`, relevant to New Booking/Walk-in)
  **and** `allow update` (`firestore.rules:533`, relevant to Reschedule) — so Reschedule's eventual
  Phase 3 callable is exposed to the identical gap New Booking has today, and Admin's own
  `BookingDetailPanel` reschedule (§3.1, platform-wide, still raw `updateDoc`) is exposed to it too.
  **Migration plan (stated, not executed — rules are not touched by this plan until every step below
  is true):**
  1. Confirm every legitimate CLIENT-SDK writer to `bookings` create/update is on a
     D1-D7-enforcing callable: New Booking ✅ (this Phase 1), Walk-in (Phase 2, conflict+leave),
     Reschedule — **both** Staff App's and Admin's (Phase 3 would need to cover both, or Admin's
     stays a named, accepted exception, decided explicitly, never left ambiguous).
  2. Confirm no OTHER client still calls the old raw-write path (a cached old bundle is the
     realistic risk, not a new caller — Staff/Admin hosting versions should be checked, not
     assumed, before narrowing).
  3. Only then does `isTenantAny(tenantId)` on these two branches become a rules-review task —
     its own, separately-approved, separately-deployed change (§9.5 step 3), sequenced LAST because
     a rules deploy has no partial-apply: narrowing it while any legitimate client still uses the
     old path breaks that client outright.
  **Out of this plan's scope, confirmed separately:** the SAME `allow create` rule's *anonymous*
  branch (public/customer bookings) is a **different, already-planned** effort
  (`STAFF-START-AUTHORITY-A1`, `docs/RELEASE_MANIFEST_A1.md` phase 1) — that manifest's Firestore
  rules phase touches the same file for a different branch of the same rule block. Whoever
  sequences either rules change should read both plans first; this plan does not merge into that
  one or vice versa.
- **Walk-in, Reschedule, Block Time** (Phases 2-4) — untouched. Walk-in in particular now has a
  **confirmed** (not just suspected) zero server-side leave check (§7.1 item 2) that Phase 2 must
  close alongside its originally-scoped conflict gap.
- **Parser/aggregator writers are NOT migrated onto this coordination within this plan's scope —
  a standing, residual race risk, not a permanent exemption.** (§4.1/§9.1 item 4). A parser import
  and a Staff App write for the same barber/instant can both still land. No claim of system-wide
  conflict-freedom is made while this stands; whether/when to close it is an undecided, separate
  product question, not resolved by this plan.
- **Cross-flow race proof is partial** — New-Booking-vs-New-Booking and New-Booking-vs-Block-Time
  are proven; New-Booking-vs-Walk-in and New-Booking-vs-Reschedule cannot be tested until those
  flows exist on the same coordination (Phases 2-3); the parser/aggregator gap above is a third,
  separate axis not covered by any phase's acceptance criteria.
- **Unrelated cross-cutting finding:** `salownCreateStaffBooking` is now an eighth consumer of
  `createBookingCore`, an entry point `docs/RELEASE_MANIFEST_A1.md` (`STAFF-START-AUTHORITY-A1`,
  hash-pinned 2026-08-14, a **separate, already-planned release this task did not open**) tracks as
  having exactly seven. That manifest was **not edited** here — it is evidence-pinned for someone
  else's release — but whoever next deploys either A1's Functions phase or this Phase 1 needs to
  know the two now overlap at `createBookingCore`, so A1's gate is not silently left off a function
  that did not exist when A1 was pinned.

### 9.5 Proposed targeted release order (NOT executed — for owner approval)

Three separate deployable units, three separate rollback identities, per §9.1 item 6:

1. **Functions** — `./scripts/deploy-functions.sh salownCreateStaffBooking` (targeted; blanket
   `--only functions` remains forbidden, `SEC-FN-NS-SALOWN-GUARD`). Rollback: redeploy the previous
   revision by id (no previous revision exists yet — this is a new export, so "rollback" here means
   deleting the function, not reverting one).
2. **Staff hosting** — `firebase deploy --only hosting:salown-staff`, from the isolated
   `git archive` workspace per `[[feedback_isolated_release_workspace]]`, only AFTER (1) is live and
   verified reachable (a bundle calling a callable that does not exist yet fails every save).
   Rollback: the prior `hosting:salown-staff` version id.
3. **`firestore.rules` narrowing** (§9.1 item 5) — its own, later, separately-reviewed change, only
   after (1)+(2) are `LIVE_VERIFIED` and no legitimate caller still uses the old direct-write path.
   Not scheduled by this plan; named here only so it is not forgotten.

Between (1) and (2), New Booking is DEPLOYED-BUT-UNREACHABLE from the client (the old
`createWalkInDetailed` path would need to stay live in that window if a rollback of (2) alone were
ever needed) — this is the same "server ships first, client cuts over second" shape as every prior
O1x package in this codebase (O1AB, O1C, O1S's own walk-in cutover).
