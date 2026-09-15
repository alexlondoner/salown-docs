# STAFF-AVAIL-GAP-P2 — closing items 4, 8, 9 of the 9-scenario checklist + independent item-6 re-run

2026-09-15 ~09:3x-09:5x UK. Continuation of `2026-09-15-callable-level-verify/` (round-12 full gate
+ items 2/5/7). This session picked up the handoff's remaining-checklist item under a new claim
(`STAFF-AVAIL-GAP-P2-VERIFY2`, released at end of session). Isolated `git clone --no-hardlinks` of
`salown-app`, checked out **detached at `aa2efd9c5efc875bea316c461e47bf0817728c3c`**, under
`/private/tmp/.../scratchpad/staff-avail-gap-p2/clone-aa2efd9` (deleted at session end, evidence
copied out first). No shared-tree source edit, no deploy, no production access at any point.

## 0. Chrome connectivity — checked first, as instructed

`mcp__claude-in-chrome__tabs_context_mcp` reported the browser extension **not connected**, same
as the prior session. Per instruction, this session did not wait for it and did not attempt the two
UK Chrome checks (A: daytime, B: midnight) or any of the acceptance items that need a real click
(1, 3, and the live-click half of 2/5/7). Those stay open — see §4.

## 1. Item 6 (manual-time regression) — independently re-run, not just cited

The handoff's checklist (table row 6) says "no change-specific re-verification yet (the existing
WYSIWYG invariant tests were not re-run against this specific change)". That is corrected here:
`aa2efd9`'s own commit already updated `src/staff/lib/staffTimeContract.test.ts` and
`src/staff/sheets/staffCreateCutover.test.ts` to pin the `timeTouched === true` (manual-time) branch
structurally unchanged (`{ time: timeStr }`, byte-identical wrapping) alongside the new
`{ startTimeIso: ... }` branch for the untouched-time backdate. This session **independently ran
both files** against the isolated `aa2efd9` clone (not trusting the commit message's own
self-reported "5569/5569 pass"): **89/89 tests pass**, including
`walk-in's plain (unpaid) Save takes timeStr verbatim — WYSIWYG, decision #2` and the structural
guard asserting exactly one ternary survives and the old `9 * 60` floor is gone. Raw log:
`item6-manual-time-vitest.log`. **This is unit/structural-level proof, not a live click** — it closes
the "not re-run" gap the handoff named, but does not substitute for an actual Chrome interaction
with a manually-typed time (still open, see §4).

## 2. Items 4, 8, 9 — callable-level (no Chrome), real client SDK, real emulators

Same method as `2026-09-15-callable-level-verify/`: the real client Firebase Web SDK (not an
admin-SDK bypass), signed in against a real local Auth emulator, calling the real
`salownCreateStaffWalkIn` callable through a real Functions emulator, against a real Firestore
emulator. Synthetic tenant `p2v2`, `presentation.timezone: Europe/London`. Two barbers: `alex`
(active, all-day hours, no dated overrides) and `cara` (active, `shiftChanges` differing between
2026-09-14 and 2026-09-15). Harnesses: `seed2.mjs`, `callable-check2.mjs` (both copied here,
throwaway, never committed to the shared tree). Full raw results:
`callable-check2-results.json`; Firestore before/after snapshots: `before.json`, `after.json`,
`diff__before__after.json`.

### Item 4 — `MAX_DURATION_MINS` (`createWalkIn.ts:74`, = 1440) still refuses correctly

| # | durationMins | Expected | Server response |
|---|---|---|---|
| item4 | 1441 (24h+1min) | `INVALID_INPUT` before the transaction even opens | **`INVALID_INPUT`**, `errors: ["durationMins must be a positive integer ≤ 1440"]` — confirmed no booking or idempotency doc written for this attempt (absent from `after.json`) |
| item4b | 1440 (exact boundary), start pinned to local midnight so the shift-overrun is exactly 1 minute | NOT rejected by the same input guard | **SUCCESS** — booking `bKoO8tHjoyNwFYdcmktz` created. Correction to this harness's own prediction: the default `shiftOverrunAllowanceMins` is **15** (`createBooking.ts:1303-1306`, `resolveOverrunAllowanceMins` fallback), so a 1440-minute request starting at minute-of-day 0 (`0+1440=1440 ≤ 1439+15`) **fits the shift outright** — no owner override was actually invoked, even though the harness sent `overrideConflict:true` defensively. This is a cleaner result than originally planned: 1440 succeeds via the ordinary `fits` path, isolating that the 1441 refusal above is precisely the `MAX_DURATION_MINS` input-validation boundary, not a downstream hours/conflict rejection that happens to also fire around 24h. |

**What this proves:** the instant-based backdate computation in `aa2efd9` did not widen or bypass
`MAX_DURATION_MINS` — the guard fires exactly at >1440 and only at the input-validation layer,
before any transaction read.

### Item 8 — conflict correctness across midnight, seed straddling midnight itself

Distinct from the existing-evidence item 5 (same-calendar-day conflict window): here the **existing
CONFIRMED booking's own interval crosses local midnight** — seeded `midStraddleSeed`, barber `alex`,
`22:50:00Z`→`23:30:00Z` 14 Sep (local BST `23:50` 14 Sep → `00:30` 15 Sep, 40 min). The walk-in
requests a backdated start of `22:40:00Z` 14 Sep (local `23:40` BST), 30 min → ends `23:10:00Z`
(local `00:10` BST 15 Sep) — a 20-minute overlap with the seed, entirely on the "yesterday" side.

| # | Actor | Override? | Server response |
|---|---|---|---|
| item8 | owner | no | **`SLOT_CONFLICT`**, `conflictingRecordIds: ["midStraddleSeed"]` — the midnight-straddling seed was correctly matched by the 24h-lookback query |
| item8b | owner | yes, same instant, acknowledging `midStraddleSeed` | **SUCCESS** — booking `TAka3cSXIxYK2Awq9bm8` created |

**Instant preservation, verified against the actual documents (not just the callable's return
value):** `TAka3cSXIxYK2Awq9bm8.startTime` = `2026-09-14T22:40:00.000Z`, byte-identical to the
submitted instant. Its `STAFF_BOOKING_POLICY_OVERRIDE` audit doc records
`requestedStartMs: 1789425600000` = `Date.parse('2026-09-14T22:40:00.000Z')` exactly — the same
instant, a third independent place, same discipline as the prior session's item-5 proof.

### Item 9 — shift-fit correctness across midnight

Barber `cara`: `shiftChanges: {"2026-09-14": {open:"22:00", close:"23:59"}, "2026-09-15": {closed:true}}`.
Walk-in requests a backdated start of `22:00:00Z` 14 Sep (local `23:00` BST 14 Sep), 30 min. If
`tenantDateKey(input.startMs, tz)` correctly resolves to `2026-09-14` ("yesterday" relative to the
real emulator clock, 15 Sep), this fits `cara`'s `22:00-23:59` window on that date and should
**succeed outright** (no override needed: `23:00+30=23:30 ≤ 23:59`). If the resolver instead used
"today" (`2026-09-15`, `closed:true`), it would be refused `STAFF_UNAVAILABLE`.

**Result: SUCCESS** — booking `y6iw4zynZbGVrn7IsshE` created, `startTime` =
`2026-09-14T22:00:00.000Z` (byte-identical to the submitted instant), no override audit row (none
was needed — confirms the request `fits` cleanly on the correct day rather than squeaking through
an override). This is only possible if the shift lookup used `2026-09-14`, proving
`tenantDateKey(startMs, tz)` is evaluated from the genuinely rolled-back instant, not the real
wall-clock date.

## 3. Side observation — flagged, not a defect in this work

The before/after Firestore diff shows one PRE-EXISTING document changed: the seeded conflict
booking `midStraddleSeed` gained a `loyaltyPromotionSnapshot` field between the `before` and `after`
snapshots. This happened at `09:41:07.766Z`, i.e. **before** the callable harness ran (`09:41:2x`) —
it is the tenant's real Firestore-triggered loyalty-evaluation function reacting to the seed
document being written directly via the admin SDK (a real, expected background trigger on any new
`tenants/{t}/bookings/*` doc in a real emulator, not something the Walk-in callable or this
session's harness did). No Walk-in-created document was mutated after its own creation. Noted here
for completeness, not corrected (nothing to correct).

## 4. What is still open — unchanged from the handoff, only Chrome-dependent items remain

Still needs an actual connected Chrome session (extension not connected either session):
1. The two UK Chrome checks (A: daytime, B: midnight) proving `WalkInFlow.tsx`'s untouched-time
   branch computes and sends `new Date(Date.now() - duration*60000).toISOString()` from a real
   click — source-verified and now unit-proven (§1), never exercised end-to-end through a browser.
2. Acceptance items 1 (no-crossing early morning) and 3 (boundary just inside the same day) — no
   coverage at all beyond source reading; both are pure client-formula checks, not server policy,
   so they cannot be closed callable-level the way 4/8/9 were.
3. The *client* half of items 2, 5, 7 — the server-side contract for all three is now proven
   real-emulator, real-callable (this session's predecessor + `31-future-checkout-scope-options.md`
   §7) — what remains is seeing the React owner-override prompt/re-prompt actually rendered and
   answered by a human-shaped interaction, and the passive-barber refusal actually surfacing in the
   Staff App UI.

**Every acceptance-test item that could be closed without a browser (4, 6, 8, 9) is now closed.**
The remaining gap is Chrome connectivity itself, not test design or environment — no further
non-Chrome work is available to advance this checklist.

## 5. Environment cleanup, verified

- Isolated emulator triple (auth/firestore/functions, `demo-c1`) stopped; ports
  8080/9099/5001/4400/9150 free again (`lsof` re-checked after kill).
- The shared dev server on `:5173` (production-connected) was never touched — running throughout,
  same PID, before and after.
- No production Firestore/Auth/Functions read or write at any point. All seed/harness data lived
  only in the local emulator's in-memory state for tenant `p2v2`, gone once the emulator exited.
- `ops/claims/STAFF-AVAIL-GAP-P2-VERIFY2--alish--staffgapv2.claim` released at end of session.
- Isolated clone `clone-aa2efd9` deleted after evidence was copied out.
