# STAFF-AVAIL-GAP-P2 — stale test patch + UK backdated-checkout live check

Written 2026-09-14 ~01:25 UK by the session that picked up
`docs/HANDOFF_STAFF_AVAIL_GAP_P2.md`. No claim opened (nothing committed to the shared
tree). **Deploy: none. Production read/write: none.** This folder records two pieces of
work done entirely in isolated clones/rehearsal copies under a session scratchpad,
never in `~/Desktop/alex/salown-app`.

**The candidate `9ea0aca`'s frontend test failure is still open.** Nothing here has
been committed to salown-app. Only a real commit landing this patch (or an equivalent
fix), producing a new candidate SHA, and a full re-run of §4's round-2 gates against
that SHA would close it.

## 1. The stale-test patch

`staffPostWriteBoundary.patch` — a diff against `src/staff/lib/staffPostWriteBoundary.test.ts`
at `9ea0aca`, applied and run only in a git clone under scratchpad (`p2rehearsal`,
`relws-p2`), never in the shared tree.

**What was actually stale and why.** The Phase 2 refactor introduced
`createWalkInEnforced` in `WalkInFlow.tsx` — a shared owner-override wrapper used by
both the Save and the Pay handlers. Structurally, at `9ea0aca`:

- `async function createSaleBooking(...)` is declared once (its own definition), and is
  never called from anywhere in the file **except from inside** `createWalkInEnforced`'s
  own body, where it is referenced exactly twice: `return await createSaleBooking(time)`
  (the plain path) and `submit: (override) => createSaleBooking(time, override)` (the
  owner-override resubmission path). So `createSaleBooking` has exactly **one caller**
  (`createWalkInEnforced`), which itself invokes it from **two call sites**, both inside
  its own body.
- `createWalkInEnforced(` is itself called from **two places** at the component level —
  the Save handler and the Pay handler — matching "save + pay" in the original test's
  comment.
- `checkoutBooking(` still has exactly one call site, in the Pay handler, unchanged.

The original committed test asserted `wf.match(/await createSaleBooking\(/g)).toHaveLength(2)`
— a literal count of the pre-refactor shape, where Save and Pay each called
`createSaleBooking` directly. After the refactor that count is 1 (one `await` site;
the second reference inside `createWalkInEnforced` has no `await` prefix, since it's
passed as a callback), so the committed test fails on `9ea0aca` — not because the
boundary invariant broke, but because the test's shape assumption didn't move with the
refactor it's supposed to be testing.

**What the patch changes.** It replaces that one stale assertion with a test that:
1. Asserts the new literal counts (`createSaleBooking` await-count 1, `createWalkInEnforced`
   await-count 2, `checkoutBooking` await-count 1).
2. Asserts both of `createSaleBooking`'s reference sites live textually inside
   `createWalkInEnforced`'s body (sliced between its `async function` line and the
   following `const reportPresentationIssue` line).
3. Asserts that outside that body, `createSaleBooking(` appears exactly once — its own
   declaration — so no other function calls it directly.
4. Keeps every original forbidden-call check on `afterWriteSucceeded(...)` post-write
   blocks (no create/checkout/package-link/product-sale call inside one), and **adds**
   `createWalkInEnforced(` to that forbidden list, since it's now the thing that must
   never sit inside a post-write step either.

Nothing about the guard was loosened — the patch adds assertions, it doesn't drop any.
This mirrors (and formalizes into the actual committed test) the scratch-only check the
prior session wrote at `docs/evidence/staff-avail-gap-p2/2026-09-14-release-checks/12-scratchBoundaryInvariant.test.ts`,
which proved the same structural facts but, being scratch-only, never closed the
committed test's failure.

**Result, isolated clone at `9ea0aca` + this patch, `functions/lib` built:**
- `staffPostWriteBoundary-single-file.log`: that one file, 20/20 passing.
- `frontend-vitest-full-postfix.log`: full `npx vitest run` — **1 test file failed, 2
  tests failed, 5553 passed, 6 skipped, of 5561 total.** The 2 remaining failures are
  the same two environment negative controls already named in
  `2026-09-14-release-checks/RELEASE-EVALUATION-2.md` §5 (`functionsArchiveManifest.test.js`,
  expecting this machine's untracked `functions/.secret.local` / `functions/.claude/`,
  absent in a clean clone) — unrelated to this patch or to `9ea0aca`.
  - Environment note for whoever reruns this: a fresh clone has no `functions/lib` build.
    Before running `functions/`'s `npm run build` (`tsc -p tsconfig.build.json`), the full
    suite also shows 10 additional failures in `src/utils/staffLifecycle.test.ts`
    ("Cannot find module `.../functions/lib/staff/lifecycleRehire.js`") — a clone-setup
    gap, not a code regression. Build `functions/` before trusting a "3 fails" or "12
    fails" count from a fresh clone.

## 2. UK (Europe/London) backdated Save & Checkout — live check

The round-2 evidence (`RELEASE-EVALUATION-2.md` §6) named a real gap: the owner
untouched-time Save & Checkout backdate path had only been exercised on tenant `p2c`
(`America/Los_Angeles`). That leaves open whether the same path is genuinely correct
on a UK tenant, rather than assuming it because UK is the platform default.

**Setup:** isolated rehearsal copy of `9ea0aca` + the patch above
(`src/firebase.ts` temporarily wired to the local emulator suite, project `demo-c1`,
`connectAuthEmulator`/`connectFirestoreEmulator`/`connectFunctionsEmulator` — never
committed, reverted with the rest of the rehearsal copy). New synthetic tenant `p2uk`,
`presentation.timezone: 'Europe/London'` (seed script: `tools/p2uk.mjs`, mirrors the
existing `p2chrome.mjs` pattern for `p2c`). The always-on shared dev server on
`localhost:5173` (a different, non-emulator process, pointed at production
`havuz-44f70` per `src/firebase.ts`'s default config) was never touched, navigated to,
or interacted with.

**Verified before any UI action** (`read_network_requests` on the Chrome tab):
- Auth: `POST http://127.0.0.1:9099/identitytoolkit.googleapis.com/...` (sign-in, token
  refresh) — 200.
- Firestore: `http://127.0.0.1:8080/v1/projects/demo-c1/databases/(default)/...` and the
  `Listen/channel` long-poll, both against `demo-c1`.
- Functions: `POST http://127.0.0.1:5001/demo-c1/europe-west2/salownCreateStaffWalkIn` — 200.

No request went to `havuz-44f70`, `googleapis.com` (production), or any host besides
`127.0.0.1`.

**Scenario:** signed in as `uk-owner@p2.test` (tenant `p2uk`, role `owner`). Opened
Walk-in, selected professional Alex, added Haircut (30 min, £20), left the Time field
at its default (never edited — `timeTouched` stays false), clicked **Continue to
payment → Cash → Confirm payment** (the Pay/checkout path that applies the
backdate formula, `WalkInFlow.tsx` around the `minsToTimeStr(Math.max(9 * 60,
getNowMins(tz) - (totalDuration || 30)), tf)` line).

**Real London wall-clock time at the moment of the run was ~01:20 BST** (this session's
system clock; `date` → `Mon 14 Sep 2026 01:18:24 BST`; the Walk-in sheet's own default
Time field read "01:20", confirming the app resolved the tenant's real Europe/London
clock, not a fixed offset). At that hour, `getNowMins(tz) - 30` is far below `9*60`
(540), so the formula's expected result is the **floor branch**: `09:00`, not a
subtraction result like round 2's LA "16:11 → 15:40". This is a different branch of the
same formula than round 2 exercised, not a repeat of it — it is what a genuine UK clock
produces at this hour. A rerun during UK daytime would be needed to exercise the
subtraction branch specifically on a UK tenant; that is not covered by this run and is
not claimed here.

**Result** (`uk-backdated-checkout/after-checkout.json`, read directly from the
Firestore emulator after checkout): booking `WCB-1789345316430-3b73`,
`startTime = 2026-09-14T08:00:00.000Z` = **09:00 Europe/London (BST, UTC+1)** — exactly
the predicted floor value. `status: CHECKED_OUT`, `checkedOutAt` stamped once,
`paymentAllocation.reconciled: true`, `receiptFailures: []`, one `WALK_IN_CREATED`
audit row with `actor.role: owner`. No second write, no error toast observed.

**What this does and doesn't establish:**
- Confirms, live and unconfounded by any non-UK tenant, that the owner untouched-time
  Save & Checkout path works correctly on a genuine Europe/London tenant, using the
  Auth+Firestore+Functions emulator trio only (verified above) — not the LA run
  substituted in its place.
- Does **not** modify, retest, or comment further on the separate, already
  source-confirmed New Booking `Europe/London`-hardcode finding (below) — that finding
  is out of scope for this test-fix patch and was left untouched in both the shared
  tree and this rehearsal copy (`git diff --stat` in the rehearsal copy shows only
  `src/firebase.ts` and the test file changed; `functions/src/index.ts` is unmodified).

## 3. New Booking `Europe/London` hardcode — recorded as a separate, distinct finding

Source-verified (not inferred from any Chrome run, UK or LA):

- `functions/src/index.ts:1734`, inside the `salownCreateStaffBooking` callable, calls
  `createBookingCore(db, request.data || {}, { ..., timeZone: 'Europe/London', ... })`
  — hardcoded, regardless of the calling tenant's actual `presentation.timezone`. A
  non-UK tenant's New Booking wall-clock entry is interpreted as if it were London time
  server-side.
- By contrast, Walk-in resolves the instant on the **client**, using the tenant's real
  zone, before the server ever sees it: `WalkInFlow.tsx:339` passes `timeZone: tz`
  (`tz` = `presentation.timezone`) into `callSalownCreateStaffWalkIn`, which at
  `src/utils/bookingCallables.ts:320` computes
  `startTime = input.startTime || toIsoStartTime(input.date, input.time, input.timeZone)`
  — an absolute ISO instant built with the tenant's real zone. `functions/src/bookings/createWalkIn.ts`
  never re-interprets it; it only parses the already-correct `startTime` string
  (`parseInstantMs(raw.startTime)`). `salownCreateStaffWalkIn` (`index.ts:1599`) passes
  `request.data` straight through with no server-side timezone override.

This is a live, pre-existing (Phase 1 also) product defect, not something this test-fix
task introduced, touched, or is scoped to fix. It is named here only for the record.
Owner decision on whether/when to fix it is open and separate from the STAFF-AVAIL-GAP-P2
release decisions in `20-owner-decision-recommendations.md`.

## 4. What was NOT done

- No deploy, of any kind.
- No production Firestore/Auth/Functions read or write — the shared dev server on
  `:5173` (production-pointed per `src/firebase.ts`) was left running, untouched,
  never navigated to.
- The patch was not committed or applied to `~/Desktop/alex/salown-app`. No claim was
  opened, because nothing in the shared tree changed.
- The bypass exceptions and the Walk-in↔Reschedule Phase-3-deferral recommendation in
  `20-owner-decision-recommendations.md` remain **recommendations only** — not acted on,
  not treated as accepted.
- All emulator (Auth/Firestore/Functions, project `demo-c1`) and rehearsal Vite
  (port 5199) processes started for this check were stopped at the end of this session;
  ports 8080/9099/5001/4400/9150/5199 are free again. The Chrome tab opened for this
  check was closed.

## Files

- `staffPostWriteBoundary.patch` — the test-file diff (isolated clone only).
- `staffPostWriteBoundary-single-file.log` — that one file's result under the patch (20/20).
- `frontend-vitest-full-postfix.log` — the full suite's result under the patch (5553 pass / 6 skip / 2 fail, both environment).
- `tools/p2uk.mjs` — throwaway seed/snapshot script for the synthetic `p2uk` (Europe/London) tenant. Never committed; mirrors `2026-09-14-handoff-state/tools/p2chrome.mjs`'s pattern for `p2c`.
- `uk-backdated-checkout/seed-users.json` — seed output (tenant, timezone, London wall-clock at seed time, synthetic user emails).
- `uk-backdated-checkout/after-checkout.json` — full Firestore documents (bookings + auditLogs) for tenant `p2uk` after the checkout run.
