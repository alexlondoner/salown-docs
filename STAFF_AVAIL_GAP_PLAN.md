# STAFF_AVAIL_GAP_PLAN.md — availability/conflict enforcement decision + plan

> Work ID `STAFF-AVAIL-GAP` (ROADMAP.md §4, `CONFIRMED_OPEN`). Surfaced 2026-09-11 while auditing
> `STAFF-SLOT-INTERVAL`'s save chains — **not caused, not fixed, by that release.** This document is
> research + a decision proposal only. **No code changed, nothing deployed, as of this writing.**
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

---

## 5. Decision table

| # | Question | Current state | Proposed direction | Type |
|---|---|---|---|---|
| D1 | Should New Booking and Reschedule get server-side enforcement at all? | Neither has any (raw Firestore writes, no callable) | Yes — route both through `createBookingCore`-family logic (New Booking: wire the existing `surface:'staffApp'` path; Reschedule: needs new work, since no reschedule-guard is reachable from any staff-facing surface today) | **Gap → decision needed** |
| D2 | Passive barber — absolute stop everywhere? | Already the documented principle (PASSIVE-AUTHORITY-R3, "nothing overrides it"); already enforced HARD server-side for Walk-in, Block Time, Admin New Booking; **not** enforced anywhere for Staff New Booking/Reschedule | Close the gap so R3 actually holds everywhere it claims to — this is finishing a decision already made, not making a new one | **Gap, not a new decision** |
| D3 | Conflict — reject by default, or stay staff-overridable? | Comment convention across Admin+Staff says overlaps "can be legitimate" (soft, overridable) — **except** Block Time (hard, no override) and, apparently, Admin's own server layer (hard, per `createBookingCore`'s codes, contradicting its own client's soft confirm — needs verification, §3.1) | Adopt "reject by default; an authorized, logged override is a separate, explicit action" — this is a **real behavior change** from today's default-overridable client confirm, not a gap-close. Directly relevant: `[[project_squeeze_in_origin]]` — controlled overlap ("squeeze-in") is an intentional, evolving product feature, so a blanket hard-reject with no override path would regress it. The override must be a real designed feature, not the removal of squeeze-in | **New decision, with a named product dependency** |
| D4 | Outside working hours — warn or block? | Least decided dimension: Admin soft-confirms server-hard-rejects (per §3.1's open question); Staff New Booking shows a display-only warning that doesn't even block submit; Walk-in/Reschedule have nothing | Needs an explicit choice; recommend matching whatever D2/D3 lands on for consistency, but this is genuinely open, not a "finish the existing decision" case like D2 | **New decision** |
| D5 | Break (mola) | Not a separate mechanism — already unified with conflict via `BLOCKED`-status bookings | No separate decision needed — whatever D3 decides for conflict automatically covers breaks, since they're the same document type | **Resolved by D3** |
| D6 | Leave (izin) | Existing soft/explicit-ask pattern for New Booking (2026-06-29 incident fix); nothing for Reschedule/Block Time; Walk-in evidence insufficient | Recommend preserving the existing soft/explicit-ask contract (it was a deliberate incident fix, not an oversight) rather than tightening to hard — unless the owner wants to revisit that 2026-06-29 decision itself | **Preserve existing decision, extend its reach** |
| D7 | Race safety | Only Block Time is race-safe today | Close for whichever of New Booking/Walk-in/Reschedule gets server enforcement under D1, using the `blocks.ts` pattern | **Gap, mechanical once D1 is decided** |

---

## 6. Recommendation

1. **D2 (passive) and D7 (race safety) are not really open questions** — they're unfinished
   application of principles already on record (R3; the working `blocks.ts` transaction pattern).
   Close them as part of D1's implementation, not as a separate debate.
2. **D3 (conflict) is the one genuine policy change**, and it should be presented to the owner as
   exactly that: moving from "staff can always click through an overlap" to "overlap is refused by
   default; a real, separately-designed, logged override exists for legitimate cases (squeeze-in and
   similar)." Do not build the override as an afterthought inside this work — it is its own design
   with its own audit trail, per the owner's own framing ("yetkili ve kayıtlı override ayrı
   tasarlanır").
3. **D4 (hours) and D6 (leave)** are lower-stakes and can follow whatever precedent D2/D3 set, but
   name them explicitly to the owner rather than silently picking a side while implementing D1-D3.
4. **Do not touch Admin's flows in this pass** — but D1's platform-wide reschedule gap (§3.1) and the
   possible Admin conflict/hours client-vs-server mismatch (§3.1) should go on record as their own
   items once verified, since a Staff-only fix leaves Admin's reschedule equally open.

---

## 7. Phased implementation plan (not started — awaiting the D1-D4 decisions above)

**Phase 0 — verification, before writing any server logic**
- Confirm precisely whether `createBookingCore`'s `SLOT_CONFLICT`/`OUTSIDE_EFFECTIVE_SHIFT` accept
  any override parameter today, and reconcile that against Admin's client-side soft confirm (§3.1).
  This changes what D3/D4's "already decided" baseline actually is.
- Confirm whether Walk-in's Save path gates on `availableTodayIds`/leave today (§3, İzin row,
  evidence insufficient) before assuming it needs new leave-checking work.

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

## 8. Test plan (to be written alongside each phase, not written yet)

- **Emulator, per phase**: a `@firebase/rules-unit-testing`-style suite (matching the existing
  `test/rules/availabilityFrom.emulator.test.js` pattern) asserting: passive barber → refused;
  active barber, no conflict → allowed; the specific name-keyed-`barberId` legacy shape still resolves
  correctly through `resolveBarberRef` (a direct regression guard for §2.1's claim).
- **Race-condition test, per phase that gets a conflict transaction**: fire two concurrent
  create/reschedule calls for the same barber and overlapping range (Node's `Promise.all` against the
  emulator, or two callable invocations racing) and assert exactly one succeeds and the other receives
  `SLOT_CONFLICT` — mirroring however `blocks.ts` itself is tested today (check for an existing
  `blocks` race test first and reuse its harness rather than inventing a new one).
- **Override path (once D3 is designed)**: assert the override requires whatever authorization D3
  specifies, is refused for an unauthorized caller, and is recorded (audit log / booking field) when
  used — an override with no record is not what "kayıtlı" means.
