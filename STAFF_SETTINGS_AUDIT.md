# Staff Settings & Availability — Audit + Consolidation Plan

> **Date:** 2026-07-12 (rc3+1 day — ANALYSIS ONLY, no code) · **Trigger:** Muhamed on-leave (14 Jul–19 Aug)
> was entered but kept showing in the Dashboard grid + owner: "staff settings are a total mess, the settings are all over the place."
> **Status:** 🔴 Audit done, fixes after TS-freeze (2026-07-14+). Related: INCIDENTS 2026-07-12 (leave deletion), ROADMAP G1.

---

## 1 · Immediate case: why is Muhamed still in the grid?

Muhamed's doc is CORRECT (`barber-1781007454543`: `status:'leave'`, `leaveFrom:'2026-07-14'`,
`leaveUntil:'2026-08-19'`, `active:false`). The problem is not in the data, but in **the grid never reading leave**:

- `Dashboard.tsx:406` `activeBarbersForDay` builds columns with `workingDays → shiftChanges → dayHours`;
  **`status`/`active`/`leaveFrom-Until` are NEVER checked.** A column is drawn throughout the leave too.
- Note: today is 12 Jul — leave starts on the 14th, so it showing today is actually correct. But it would also show
  if you navigated to 14 Jul–19 Aug; the bug is not the date, it's the source.

## 2 · The real finding: 5 surfaces give 5 different answers to the same question

The answer to "is Muhamed available on day X?" by surface (live code, with line references):

| Surface | What it looks at | Result for Muhamed (leave 14 Jul–19 Aug) |
|---|---|---|
| **Dashboard grid** (`Dashboard.tsx:406`) | workingDays + shiftChanges + dayHours | ❌ VISIBLE throughout the leave too (the owner's complaint) |
| **Panel forms** WalkIn/Booking/BlockTime (`getAvailableBarbersForDate`, `bookingUtils.ts:163`) | status/leave date range ✅ but **does NOT read shiftChanges** | ⚠️ Counts the leave range correctly BUT is unaware of per-date overrides: a barber brought in to work on their off-day (e.g. Muhamed's 13 Jul `{open,close}` override) is NOT VISIBLE in the form dropdowns; a barber closed via markOffToday keeps showing in the forms |
| **Public BookingPage** (`BookingPage.tsx:396` `where('active','==',true)`) | just the `active` boolean | ⚠️ WRONG IN BOTH DIRECTIONS: it dropped off online THE MOMENT leave was entered (didn't wait for the 14th) + it does NOT come **back automatically** after 19 Aug (until someone manually sets status to 'active'; `active:false` stays in the doc) |
| **Server reschedule** (`functions/src/index.js:1238` off-day guard) | shiftChanges + workingDays + dayHours | ❌ During leave a customer CAN RESCHEDULE to Muhamed via the email link (a ghost booking, the leave version of the 2026-06-29 incident) |
| **Finance staff wages** (`Finance.tsx:425-432`) | workingDays + shiftChanges + startDate | 🔴 **MONEY BUG:** it doesn't know about leave → it KEEPS COUNTING £41.60 daily earnings for Muhamed between 14 Jul–19 Aug. ~32 scheduled days ≈ **£1,331 ghost wage** accrues |
| Staff app (`src/staff/`) | no leave reference | ❌ its own calendar is unaware of leave |

**Root cause:** the availability decision is not in one place — each surface wrote its own copy of the logic,
and when leave was added later it was only wired into `getAvailableBarbersForDate`.

## 3 · Data model mess (inventory of the chaos)

The barber doc + surroundings, with overlapping/competing fields:

1. **`active` (boolean) vs `status` ('active'|'passive'|'leave') — TWO sources of truth.**
   `Barbers.tsx:303` derives `active = status==='active'` on write; but the BookingPage query looks at
   `active`, the panel helpers at `status`. Leave = even if future-dated `active:false`
   → drops off online INSTANTLY; even when leave ends `active:false` stays → doesn't return online. In legacy docs
   there is only `active` (`barberStatusOf` back-compat).
2. **`hours` (single open/close) vs `dayHours` (per-day) — dual hours model.** `hours` is now
   a summary derived from the "primary day" (`Barbers.tsx:310`); readers are confused.
3. **`shiftChanges[dateKey]`** — a single-day exception (closed / special hours). UNRELATED to leave, two separate
   mechanisms; Finance recognizes only this one. Today the only way to tell Finance about a 36-day leave correctly
   is to write 36 separate shiftChanges (nobody does that).
4. **`partnerConfig` (Finance) is NAME-keyed** (`tenants/whitecross/settings/finance_config`),
   the barber docs are ID'd — breaks on rename; wage/startDate is not on the barber itself.
5. **Leave has no lifecycle:** when `leaveUntil` passes, status does not automatically return to 'active'
   (the helpers return false within the date range but `active:false` + `status:'leave'` stay in the doc);
   also leave is a single range — a second leave can't be entered, the dates get overwritten.
6. **cycleStatus one-tap leave deletion** (INCIDENTS 2026-07-12, ROADMAP G1) + **barber changes
   are not written to auditLogs** (who/when can't be tracked).
7. The GEOGRAPHY of the settings is scattered: availability on the Barbers page, wage/startDate in Finance ⚙,
   leaves in Settings, color/order in Barbers — "everything about one employee" is not visible in one place.
8. **Forms are unaware of shiftChanges (proven with the 2026-07-13 case):** `getAvailableBarbersForDate`
   (`bookingUtils.ts:163`) reads only status/leave/workingDays/dayHours — NO `shiftChanges`. Yet
   the Barbers page's own quick-actions ("bring in today" `Barbers.tsx:383` / "mark off today"
   `:371`) write exactly these overrides: **the product's own feature is not seen by
   its own forms.** The grid + Finance count the override, the forms don't → the same barber is in the grid,
   not in the walk-in dropdown. The resolver (item 4A) must cover this too: priority `shiftChanges > leave > ...`.
9. **TWO separate "members" screens:** Team Members (Barbers page, roster+quick actions) vs
   Settings → Members (per-date shift override editor). On 2026-07-13 the owner went back and forth between
   the two to enter the rota; which setting is where is unclear. The Staff hub (4F) brings this down to one screen.

## 4 · Target model (proposal)

**A. Single resolver:** `getBarberAvailability(barber, date) → {available, reason: 'off-day'|'leave'|'passive'|'shift-closed'|'shift-open'}`
one function in `bookingUtils`; **the grid, forms, BookingPage, staff app AND the server callable** (a JS copy of the
same logic in functions — an extension of the existing off-day guard) all use it. Priority:
`shiftChanges > leave > passive > workingDays/dayHours`.

**B. Remove `active` from being a source of truth:** instead of the BookingPage query `where('active'==true)`,
fetch all barbers and pass them through the client-side resolver (barbers are already public-readable; N is small).
The `active` field keeps being written for legacy compatibility but is false ONLY for 'passive'
(stays true during leave → the date range decides). The return bug thus dies too.
⚠️ No `firestore.rules` impact (read is already `if true`) but note it in INVARIANTS.

**C. Grid behavior:** the barber column on a leave day is either not drawn at all or drawn with a faded "On leave · til 19 Aug"
header (if there IS a booking that day — ghost prevention — show faded; otherwise hide.
Same as the 2026-06-29 lesson: an invisible column = an unmanageable booking).

**D. Finance leave-awareness:** add `isBarberOnLeaveForDate` to the staff/partner day counter
(a line to the scheduled-day filter: a leave day is not counted). For the Muhamed case alone a ~£1,331 fix.

**E. Lifecycle:** when leaveUntil passes the visible status automatically becomes 'active' (INSTEAD of a write job,
a date-aware version of `barberStatusOf`: `status==='leave' && today>until` → count as 'active').
A leave-confirm on cycleStatus ("Muhamed is on leave until 19 Aug — end leave?") + a `BARBER_STATUS_CHANGED`
audit record (merges with G1).

**F. (Phase 2, separate work) Staff hub:** a tabbed single screen on the Barbers card — Availability (workingDays/
dayHours/leave/shift) · Pay (bind partnerConfig to barber-ID) · Permissions · Appearance.
The UX leg of the chaos; planned independently of A–E, and G4 (weekly wage ledger) sits here.

## 5 · Implementation order (post-freeze, 14 Jul+)

| Step | Work | Size | Note |
|---|---|---|---|
| 1 | D — Finance leave filter | S | the money bug, FIRST this; Muhamed goes on leave on 14 Jul |
| 2 | A — resolver + grid/form/staff-app migration | M | the behavior change is tested in one place |
| 3 | B — BookingPage active→resolver | S | also closes the online return bug |
| 4 | Server callable leave guard | S | a leave line to the off-day guard |
| 5 | E + G1 — lifecycle + confirm + audit | S | closes INCIDENTS 07-12 |
| 6 | F — Staff hub redesign | L | separate brief; includes G4 ledger |

**Interim business rule (until the code arrives):** Muhamed showing in the grid between 14 Jul–19 Aug is
cosmetic but **the earnings in Finance are real money** — either take step 1 before the 14th (recommended)
or manually deduct Muhamed's July/August day count at month end.
