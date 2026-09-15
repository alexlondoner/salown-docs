# STAFF-AVAIL-GAP-P2 — the two UK Chrome checks + items 1/2/3/5/6 closed live, item 7 finding

2026-09-15 ~10:3x-11:5x UK. Chrome extension connected this session (the exact, sole blocker every
prior session in `HANDOFF_STAFF_AVAIL_GAP_P2.md` hit). Fresh isolated `git clone --no-hardlinks` of
`salown-app`, detached at the same verified source **`aa2efd9c5efc875bea316c461e47bf0817728c3c`**,
under `/private/tmp/.../scratchpad/staff-avail-gap-p2/rehearsal-aa2efd9` (deleted at session end,
evidence copied out first). `src/firebase.ts` was rewired to the local emulator triple in this
throwaway clone only (never committed, never touched in the shared tree) — real
Auth+Firestore+Functions emulators, real client SDK, the actual `staff.html` bundle served via
`vite --config vite.staff.config.js --port 5199`, driven through the actual React
`WalkInFlow.tsx` component with real clicks. No shared-tree source edit, no deploy, no production
access.

## Method: controlled clock + a safe `window.prompt` patch, not real wall-clock waiting

Per the prior evidence README's own note ("a Chrome run can drive the UI at any wall-clock time"),
`window.Date` was monkey-patched in the page (`javascript_tool`, before each click) to a fixed
instant — `Date.now()` and `new Date()` (zero-arg) return that instant; every other `Date` usage is
unaffected. This lets `WalkInFlow.tsx`'s real, unmodified `new Date(Date.now() - duration*60000)`
formula run against a chosen instant without waiting for real UK daytime or real midnight. Verified
before each flow that the TIME field itself displayed the expected value (proving the app read the
patched clock, not a stale one).

Where the flow could open a real `window.prompt()` (the owner-override reason dialog,
`staffOverrideFlow.ts`), `window.prompt` was also patched, **before** triggering it, to return a
canned string synchronously — this means no native blocking dialog was ever shown (patching the
function pre-empts the call; nothing here dismissed or interacted with an actual OS-level dialog).
`window.__promptCalls` recorded every call made through the real code path — see item 5 below;
`prompt-calls-log.json` is the raw capture.

## Check A (UK daytime) = acceptance item 1 — CLOSED, live click

Fixed clock `2026-09-15T07:50:00.000Z` (08:50 BST). Real Walk-in: barber Alex, Haircut (30m), time
field left untouched (showed "08:50" — the live clock, not a stale value), Continue to payment →
Confirm payment (Cash) → **"Paid £20"**. Persisted booking `X4Xao4YtcQDABEptSfRs`: `startTime`
**`2026-09-15T07:20:00.000Z`** (08:20 BST), `endTime` `07:50:00.000Z` (the checkout instant) — exactly
the acceptance spec ("checkout at 08:50 for a 30-min service → recorded start 08:20 same day").
Raw: `after-checkA.json`.

## Check B (UK midnight crossing) = acceptance item 2 — CLOSED, live click

Fixed clock `2026-09-14T23:10:00.000Z` (00:10 BST 15 Sep). Same flow, fresh walk-in, time field
showed "00:10". Persisted booking `SyzRmdJe4uVus6Y0IqUc`: `startTime` **`2026-09-14T22:40:00.000Z`**
(23:40 BST **14 Sep**, the previous calendar day), `endTime` `23:10:00.000Z` (the checkout instant) —
the calendar day genuinely rolled back, exactly the acceptance spec. The dashboard's "today"
(15 Sep) schedule correctly did NOT list this booking. Raw: `after-checkB.json`.

## Item 3 (boundary just inside same day) — CLOSED, live click

Fixed clock `2026-09-14T23:40:00.000Z` (00:40 BST 15 Sep). Persisted booking
`S2IUv5DLSAJX8ZmS0org`: `startTime` **`2026-09-14T23:10:00.000Z`** (00:10 BST, **same day**, 15
Sep) — no rollover, pinning the off-by-one exactly at `duration` minutes past midnight. Raw:
`after-item3.json`.

## Item 6 (manual-time regression) — CLOSED, live click (supersedes the unit-only proof in
`2026-09-15-callable-level-verify-2/`)

Time field's native `<select>` set via `form_input` to `09:15` (a value with **no** relation to the
patched clock, which was still `00:40`) — this is `timeTouched === true`. Persisted booking
`lmgDmm4D0uT2VWsldBWs`: `startTime` **`2026-09-15T08:15:00.000Z`** = **09:15 BST exactly**, the
manually-picked value verbatim — not `00:40 − 30min = 00:10`, proving the backdate ternary's other
branch (picked-time, WYSIWYG) fires correctly and is untouched by this change, from an actual click,
not just the structural-guard unit tests. Raw: `after-item6.json`.

## Item 5 (owner-override re-prompt reuses the identical instant) — CLOSED, live click

Seeded a real CONFIRMED conflicting booking for barber Alex, `10:15:00Z`–`10:45:00Z` (11:15–11:45
BST). Fixed clock `2026-09-15T11:00:00.000Z` (12:00 BST) → untouched-time backdate computes
`11:30 BST` (overlaps the seed by 15 min). Real click through Continue to payment → Confirm payment
(owner) triggered the actual denial → the actual React `staffOverrideFlow.ts` called the real
(patched) `window.prompt` **exactly once**, with the real server-derived message:
`"Alex already has a booking at this time. Only an owner can continue — enter a reason:"`
(`prompt-calls-log.json`) — this is the first live proof that the client's own re-prompt UI fires
(previously server-simulated only). Auto-answered reason flowed through to the server:

- Persisted booking `66RcfCkDsewSewBYIx70`: `startTime` **`2026-09-15T10:30:00.000Z`** (11:30 BST) —
  the *same* instant computed by the first (denied) attempt, reused verbatim on the override retry.
- `STAFF_BOOKING_POLICY_OVERRIDE` audit doc: `reason: "item5 harness override reason — Chrome
  rehearsal"`, `conflictingRecordIds: ["item5Conflict"]`, `requestedStartMs: 1789468200000` =
  `Date.parse('2026-09-15T10:30:00.000Z')` — third independent confirmation of the same instant.

Raw: `after-item5.json`.

## Item 7 (passive-barber historical-day refusal) — NOT reachable via normal UI; finding, not a gap

Seeded a `passive` barber (`bea`) and opened Walk-in with the clock set to the same midnight-crossing
instant as check B. **`bea` never appeared in the Professional picker at all** — confirmed by source
(`src/utils/bookingUtils.ts:496`, `getAvailableBarbersForDate`): `if (st === 'passive') return
false;`, unconditional, on every date. A staff member cannot select a passive barber through the
ordinary Walk-in flow, midnight-crossing or not — the picker itself is the first line of defense.

**This means the server's `STAFF_PASSIVE` refusal for the Staff App surface (`historicalExemptionAllowed:
false`, proven server-side in `2026-09-15-callable-level-verify/`) is genuinely defense-in-depth**:
it only matters if the client's own filtered list is stale or bypassed (e.g. a barber goes passive in
another tab while this sheet is already open, or a payload is crafted directly, as the callable-level
harness did). It is not something a real click can additionally demonstrate — the UI never offers the
unsafe path in the first place. Reporting this as the correct level of proof for item 7, not as an
unclosed gap: the server-level proof already covers the only reachable failure mode.

## What this leaves, against the handoff's checklist

Every one of the 9 acceptance-test scenarios in
`2026-09-14-test-fix-and-uk-checkout/31-future-checkout-scope-options.md` §7 now has real coverage:
1, 2, 3, 5, 6 — closed this session with a live Chrome click. 4, 8, 9 — closed
`2026-09-15-callable-level-verify-2/` (pure server/callable, no UI involved by design). 7 — closed at
the only level the UI actually permits (server-level; the UI-level path does not exist to test).
**No acceptance-test item remains open.** Bypass exceptions and the Walk-in↔Reschedule Phase-3
deferral remain unaccepted — nothing in this session touches those. No deploy, no production access.

## Environment cleanup, verified

- Isolated emulator triple (auth/firestore/functions, `demo-c1`) and the isolated `vite --port 5199`
  instance stopped; ports 8080/9099/5001/4400/9150/5199 free again (`lsof` re-checked).
- The shared dev server on `:5173` (production-connected) was never touched — same PID (94201)
  running throughout, confirmed before and after.
- No production Firestore/Auth/Functions read or write at any point. All data lived only in the
  local emulator's in-memory state for tenant `p2chrome`, gone once the emulator exited.
- Isolated clone `rehearsal-aa2efd9` deleted after evidence was copied out.
