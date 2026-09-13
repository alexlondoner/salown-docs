# Finding — Staff New Booking interprets date/time in Europe/London regardless of the tenant timezone

**Status:** found during the STAFF-AVAIL-GAP Phase 2 release-evaluation Chrome round (2026-09-13/14).
Pre-existing in the LIVE Phase 1 source; not introduced by Phase 2; not fixed (out of scope, no owner
decision). Local emulator evidence only.

## Evidence

- `chrome/C2-after-staff-N1-N3.json`, `chrome/diff__C1b-after-N1-interrupted__C2-after-staff-N1-N3.json`:
  synthetic tenant `p2c` with `presentation.timezone = America/Los_Angeles`. Staff picked 2026-09-14 14:00
  (Alex) and 13:00 (Bea) in the Staff App New Booking form. The stored bookings start at
  `2026-09-14T13:00:00Z` and `2026-09-14T12:00:00Z` = **London** 14:00/13:00 = **LA 06:00/05:00**.
  Seeds placed at LA 14:00/13:00 (`21:00Z`/`20:00Z`) were therefore not in conflict, and both saves
  succeeded ("Booking saved!", screenshots `chrome/N1-…-LA-fixture-saved.jpg`, `chrome/N2-…`).
  Only `STAFF_BOOKING_CREATED` audits were written — no override path was taken.
- Source, `9ea0aca`: `functions/src/index.ts` `salownCreateStaffBooking` passes `timeZone: 'Europe/London'`;
  `functions/src/bookings/createBooking.ts:675` `const startMs = londonMs(y, mo, dy, h, mn)` and
  `:702-703` the day window also via `londonMs`. The client sends the raw form values
  (`NewBookingSheet.tsx:278-279` `date: dateStr, time: serverTime`).
- Same code at the live Phase 1 source `797c9b3` (`createBooking.ts:694`, wrapper hardcodes Europe/London).

## Consequence

For any tenant whose timezone is not Europe/London (the Turkey tenants are `Europe/Istanbul`), a Staff App
New Booking is written at a different instant than the one the staff member chose, and its conflict /
BLOCKED check runs at that wrong instant. The shift/hours check uses the wall-clock minutes and is not
affected. Walk-in (`salownCreateStaffWalkIn`, Phase 2) resolves the tenant timezone correctly, so the two
flows disagree for such tenants. Both live UK tenants (whitecross, herohairs) are Europe/London and are not
affected.

## What this does NOT change about the Phase 2 regression

The N1/N2 results above are fixture artefacts of choosing an LA tenant, not a policy regression: the server
refused nothing because nothing overlapped at the instant it computed. The regression is re-run with seeds
placed on the London interpretation (`chrome/*london*`).
