# BUSY_SLOT_V2_RISKS.md — Risk & Issue Log

> Purpose: record **in advance** the problems that could arise from the processing-time / busy-slot v2
> work; so that if something goes wrong we know where to look without losing time.
> Design: `BUSY_SLOT_V2.md`. This file is a **living** log — update it as each phase progresses.

## 🔴 GLOBAL KILL-SWITCH
If a problem arises, the first move: tenant doc → **`features.processingTime = false`**.
The engine reverts to v1 behavior (single-interval). Because `getBusyIntervals`, when there is no
processing, **delegates** to `getExistingRangeMinutes` → behavior identical to the old.

---

## IMPLEMENTATION STATUS (2026-06-26) — DYNAMIC/service-based, LIVE (flag removed)
> The "flag OFF / WHEN flag ON" framing below is HISTORICAL. On 2026-06-26 the tenant flag
> (`features.processingTime`) was removed entirely (commit f958aee + staff bundle 5dbdf31);
> activation is now the service's `segments` config. Pre-flight: only 1 processing service on herohairs
> → behavior did not change on other tenants. The Phase 2 "remaining risks" table is no longer
> "to be watched" but **live** — tests 25/25 green. Still open: Phase 5a (iCal split), 5b
> (online/parser snapshot + public gap).

### old heading (historical): IMPLEMENTATION STATUS (2026-06-24) — all flag OFF, NO deploy
- ✅ Phase 1 (engine additive) · ✅ Phase 1-UI (Services.jsx config) · ✅ Phase 2 (rewire+16 tests)
- ✅ Phase 1.5 (snapshot @ PANEL create: walk-in + booking form) · ✅ Phase 3-lite (gap band, day view)
- ✅ Phase 5a (salownIcalFeed 2-VEVENT split)
- ⚠️ **Deliberately NOT wired (will be added if needed for the pilot):**
  - Public `BookingPage` create → does not write processing snapshot (online customer booking carries no gap)
  - Email parsers (Treatwell/Fresha/Booksy) → do not write snapshot (imported booking carries no gap)
  - Day-view **column-split** + squeeze-in badge (2nd card still overlaps) — risk 3.1
  - Dashboard **week view** has no processing render

## Phase 1 (current — additive) — status: ✅ implemented, flow unchanged
Only **new exports** were added to `conflictUtils.js` (`getServiceSegments`,
`getBusyIntervals`, `intervalsOverlap`). `getExistingRangeMinutes` and `hasTimeConflict`
**did not change at all** → the existing conflict flow is byte-for-byte the same. The
`features.processingTime: false` new-tenant default was added (existing tenants falsy = off).

**No risk but verify:** `npm run build` zero errors. The new functions are not yet called from anywhere
(dead code = safe).

**Phase 1-UI (service config) — ✅:** flag-gated processing inputs in the `Services.jsx` editor.
Service save writes `data.processing` (object if gap>0, else null). Risk: writing the new
`processing` field to the service doc — owner-auth update, if it hits Firestore rules the save silently
becomes a console.error (try/catch). On a flag-off tenant the UI does not render at all.

---

## Phase 2 (engine rewire) — status: ✅ implemented + tests GREEN, flag STILL OFF
`hasTimeConflict` now uses `getBusyIntervals` + `intervalsOverlap`.
**Flag-off guarantee:** `processingEnabled` falsy (all existing callers don't send it) →
`getBusyIntervals` immediately returns `[getExistingRangeMinutes(b)]`; candidate is a single span →
`intervalsOverlap(single, single)` = `start<end' && end>start'` = **byte-identical to the old line**.
New options (backward compatible, defaults are v1): `processingEnabled`, `candidateSegments`, `serviceOf`.
Tests: `src/utils/conflictUtils.test.js` — `npm test` → **16/16**. Build ✅.
> Note: The "real export golden diff" test is technically unnecessary thanks to structural delegation
> (flag-off → same function), but can be added if desired.

### Phase 2 remaining risks (WHEN flag ON — to be watched before Phase 4)

| # | Risk | Symptom | Where to look | Quick fix |
|---|---|---|---|---|
| 2.1 | `hasTimeConflict` going multi-interval breaks double-booking protection | Two bookings enter the same barber+time OR an empty slot appears "full" | `conflictUtils.js` hasTimeConflict; callers (BookingForm:114/150, BookingDetailPanel:986, Dashboard WalkIn, BookingPage:~400) | turn off flag; run the parity test |
| 2.2 | Reschedule self-conflict (`ignoreBookingId`) regression | Booking cannot be rescheduled to its own time | hasTimeConflict ignoreBookingId branch | preserve ignoreBookingId logic — must stay same as v1 |
| 2.3 | `barberValue` lowercase invariant breaks | Conflict/no-conflict on the wrong barber | are callers giving barberKey lowercase | BUSINESS_RULES "barberValue lowercased" rule |
| 2.4 | Duration fallback chain changes | Walk-in / online booking occupies wrong duration | getExistingRangeMinutes (DON'T TOUCH) | the base computation must always come from getExistingRangeMinutes |

**Rule:** In Phase 2, no merge until characterization + parity tests are GREEN + the flag is turned off.
No test runner → **vitest** will be added in Phase 2 (devDep, no effect on runtime).

---

## Phase 3 (grid render)

| # | Risk | Symptom | Where to look |
|---|---|---|---|
| 3.1 | Day view has no column-splitting → nested card overlaps in the gap | Two cards appear overlapping | `TimeGrid.jsx:294` card position (left/right fixed 5px) |
| 3.2 | Processing region visual has wrong height/offset | Hatched area shifted | slotHeight/15 math |
| 3.3 | Squeeze-in badge on the wrong booking | Normal booking appears "squeeze-in" | gap-fill detection in render |

Render is **independent of the conflict logic** — a bug here doesn't break the booking, only the visual.

---

## Phase 5a (salownIcalFeed segment split) — REFLECTS TO TREATWELL, CAUTION

| # | Risk | Symptom | Where to look | Quick fix |
|---|---|---|---|---|
| 5.1 | Feed opens the gap wrong / never closes it | Double-booking in Treatwell OR a full slot appears empty | `functions/index.js:1373` salownIcalFeed; VEVENT span (1426) | revert the feed to single-VEVENT (full span) = old behavior |
| 5.2 | Segmented VEVENTs' UIDs clash | Treatwell events overwrite each other | UID `${docId}@salown.com` (1428) — needs UID-1/UID-2 for two segments | a different UID suffix per segment |
| 5.3 | ALLOWED status set differs (CHECKED_OUT busy) | Past checkout blocks Treatwell | ALLOWED set (1398) | preserve current behavior, only split the span |
| 5.4 | iCal poll delay → double channel drops into the gap | Treatwell + walk-in in the same gap | (accepted — operational) | feed cache header fresh (`no-cache` already present) |

---

## Cross-cutting risks (always keep in mind)

| # | Risk | Note |
|---|---|---|
| X.1 | **Two-codebase parity** | `salownGetBusySlots` (functions), `BookingPage.jsx`, and `whitecross-site/script.js` carry separate slot logic. If one is updated and the other forgotten, public and panel behave differently. BUSINESS_RULES warning. |
| X.2 | **Source → channel key normalization** | `getServiceSegments` normalizes source with `lowercase + [\s_]→-`. It must be **the same** as the `sourceColors.js` / parser source values; if mismatched, processing is silently not applied (no gap opens). |
| X.3 | **Missing segment snapshot** | If the `booking.processing` snapshot is not written at booking create, the past booking is segmented wrongly when the service later changes. Must be added to the create flow (Phase 1.5/2). |
| X.4 | **BLOCKED preservation** | getBusyIntervals always leaves BLOCKED solid — a manual block must never open a gap. Don't change. |
| X.5 | **Firestore rules** | New `processing` / `channelProfiles` fields may hit rules on service/booking writes. Rules change LAST, pulling the live rules from the API. |

---

## Change log
All code edits are additionally written to the `edit_log_salown.md` memory. This file is only
**risk/issue** focused; as phases progress mark the tables above as "✅ verified / ⚠️ open".
