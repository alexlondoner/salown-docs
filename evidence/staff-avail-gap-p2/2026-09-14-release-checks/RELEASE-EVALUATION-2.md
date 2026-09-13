# STAFF-AVAIL-GAP Phase 2 — owner-independent release checks (round 2, 2026-09-13/14 UTC)

Candidate: salown-app **`9ea0aca076d80b05279be6b7135402ad7f049554`**. No deploy, no production read or
write, shared working tree untouched. Owner has NOT approved a release.

## 1. Automated checks — git-backed isolated release workspace

Workspace: `git clone` of the local repo into the session scratchpad, detached at `9ea0aca`, shared
`node_modules` symlinked (`00-release-workspace.log`: HEAD 9ea0aca, 0 status lines before the run).

| # | Command | Result | Classification | Log |
|---|---|---|---|---|
| 01 | `cd functions && npm test` (pretest `tsc`) | 2734 tests: 2689 pass, **0 fail**, 45 skipped (all "run npm run test:emulator" suites); 13i/13j pass | PASS | `01-functions-unit-full.log` |
| 02 | `npx vitest run` (full frontend) | 188 files: 5552 pass, 6 skipped, **3 fail** | FAIL — see §2 | `02-frontend-vitest-full.log` |
| 03 | `cd functions && npm run test:emulator` (two-phase `ops/test-emulator.sh`, pinned firebase-tools 15.26.0 / firestore emulator v1.22.0) | general 655/655, packages 27/27, **TOTAL 682/682, RESULT PASS** | PASS | `03-emulator-gate-two-phase.log` |
| 04 | `./scripts/deploy-functions.sh --check-only salownCreateStaffWalkIn` | namespace guard OK, 1 target owned by codebase `salown`; the uncommitted-changes step ran with no warning | PASS | `04-deploy-guard-check-only.log` |
| 05 | `node scripts/functionsArchiveManifest.cjs` | no secret-like file, no debug/test artefact, no unexpected untracked file; runtime files present | PASS | `05-functions-archive-manifest.log` |
| 06 | `npm run build:staff` | exit 0; entry `/assets/staff-BGZUV_T1.js`, sha256 `882813e2…` — identical to the earlier archive build | PASS | `06-build-staff.log` |
| 07 | `git status` after all steps | only tracked `hosting/staff-bundle/**` rewritten by the build (committed bundle `staff-CLriqZe3.js` is older) — the known tracked-build-artefact behaviour | info | `07-release-workspace-status-after.log` |

## 2. The three frontend failures, separated

| Test | Class | Evidence |
|---|---|---|
| `src/staff/lib/staffPostWriteBoundary.test.ts` › "WalkInFlow: the create/checkout calls are not inside a post-write step" | **CODE-SIDE (stale test introduced by 9ea0aca)** — expects 2 `await createSaleBooking(`, the refactor routes Save and Save & Checkout through one `createWalkInEnforced`, so there is 1. The protected invariant still holds. | `12-boundary-invariant-proof.log`: the original file fails ONLY this count assertion (1 failed / 19 passed), while `12-scratchBoundaryInvariant.test.ts` (scratch copy only) proves: the awaited `createSaleBooking` and the override resubmission live inside `createWalkInEnforced`; Save and Pay each call it once; `checkoutBooking` once; no `afterWriteSucceeded` block contains a create, checkout, package link or product sale (4/4 pass). **Consequence: the full suite is red at the candidate SHA. Fixing it needs a new commit and therefore a new candidate SHA, followed by a full re-run. Not done (shared tree not touched).** |
| `scripts/functionsArchiveManifest.test.js` › NEGATIVE CONTROL ×2 | **ENVIRONMENT** — the control asserts that the pre-A1.3 ignore list would ship THIS MACHINE's local `functions/.secret.local` and `functions/.claude/`; a clean clone has neither | `11-manifest-negative-control-environment.txt`: `.secret.local` and `.claude` absent in the clean clone, present in the shared dev tree, not tracked by git at `9ea0aca`; the test's own header says "`functions/.secret.local` exists on this machine". |

## 3. Chrome — New Booking regression and owner backdated Save & Checkout

Environment: rehearsal copy of `9ea0aca` whose only difference is `src/firebase.ts` (emulator wiring,
`10-chrome-copy-provenance.txt`); Auth/Firestore/Functions emulators built from that copy; synthetic tenant
`p2c`, `presentation.timezone = America/Los_Angeles` (chosen so "now − duration" is daytime while London is at
night). Full-document snapshots of the whole tenant subtree before/after every scenario, `chrome/`.
UI transcript: `chrome/ui-observations-round2.json`.

| Scenario | Expected | Observed | Writes (full-content diff) | Result |
|---|---|---|---|---|
| N1 attempt 1 (staff) | — | UI recorder lost to a Vite dependency reload; server executed once | 0 / 0 / 0 (`diff__C1-…__C1b-…`) | INCOMPLETE, not counted |
| N1/N2 against LA-placed seeds (staff) | refusals | "Booking saved!" twice | 2 bookings + 2 idempotency + 2 `STAFF_BOOKING_CREATED` + trigger notifications, no override audit | **Fixture error, not a policy result**: stored at 13:00Z/12:00Z (London reading), seeds at 21:00Z/20:00Z → no overlap. Exposed finding §5 |
| N3 staff, Lee undated leave | no prompt, never-overridable message, form kept, 0 writes | 0 prompts; "…not available… can never be overridden."; form kept | nothing for Lee in the C1b→C2 diff | PASS |
| N1L staff, Alex 11:00 London vs seed | no prompt, owner-required, form kept, 0 writes | 0 prompts; "Owner authorization is required for this."; form kept | 0 / 0 / 0 (`diff__C3-…__C4-…`, together with N2L) | PASS |
| N2L staff, Bea 12:00 London vs BLOCKED seed | no prompt, blocked message, 0 writes | 0 prompts; "The selected time conflicts with a break or blocked time. Pick another time."; form kept | (same diff) 0 / 0 / 0 | PASS |
| O-NB1 owner, Alex 11:00 London conflict + reason | 1 prompt, 1 booking, override audit | 1 prompt (conflict text); form closed | +1 booking (11:00 London, Staff App), +1 idempotency, +2 audits (`STAFF_BOOKING_CREATED`; override `flow: booking`, `tenantId: p2c`, ids `[nbLonAlex1100]`, reason), +1 trigger notification, 0 changed/removed | PASS |
| O-NB2 owner, Bea 13:10 London; C injected during prompt 1 | 2 prompts, audit covers both | prompt 1 conflict text; C written (HTTP 200) inside it; prompt 2 "The conflict just changed…" prefilled with reason 1; form closed | +2 bookings (new 13:10, injected C), +1 idempotency, +2 audits; override ids = existing Bea booking + C; 0 changed/removed | PASS |
| BD owner, walk-in, time picker untouched, Save & Checkout (Cash), seed overlapping the backdated window | backdated start = formula, 1 prompt, 1 booking + checkout fields, 0 other writes | shown time 16:11 (LA); confirm at LA 16:11; 1 prompt (conflict text); "Paid £20" | +1 booking `CHECKED_OUT`, start **15:40 LA** (22:40Z), end 16:10, paidAmount 20, Cash, checkedOutAt set, loyaltyPointsEarned 20; +1 idempotency; +2 audits (`WALK_IN_CREATED`; override `flow: walkin`, `tenantId: p2c`, ids `[bdSeedAlexRecent]`, reason); 0 changed/removed | PASS — see note |

**Backdated start.** The formula is `minsToTimeStr(Math.max(9 * 60, getNowMins(tz) − totalDuration), tf)`
(`src/staff/sheets/WalkInFlow.tsx:530` at 9ea0aca; same line `:513` in live `797c9b3`) and `minsToTimeStr`
rounds to the nearest 5 minutes (`src/staff/lib/walkinTime.ts:88`). 16:11 − 30 = 15:41 → **15:40**, which is
what was written. The page-side expectation "15:41" in the transcript omitted that rounding. The override
resubmission reused the same time and idempotency key (one idempotency record, one booking). The "exact minute"
guarantee therefore applies to explicitly chosen times, not to this backdated path — unchanged by Phase 2.

**Single execution — what the evidence does and does not show.** Proven by Firestore: one idempotency record
and one booking per scenario; browser console: one refusal per refused submit. The functions emulator logged
more executions than UI submits (New Booking 18 vs 11; walk-in 3 vs 2) with several sub-10 ms durations; they
wrote nothing, but their nature (e.g. preflight) is **not proven** here. Transactional single execution of
`checkoutBooking` remains **not verified** (legacy client writer, see `RELEASE-EVALUATION.md` §2).

## 4. Recommendations for the open owner decisions

`20-owner-decision-recommendations.md` — Walk-in↔Reschedule deferral risk, closing the Admin
`salownCreateWalkIn` staff bypass and its Admin impact, the claim limit while the rules bypass is open, the
staff notice draft (EN/TR, not sent), and the sufficiency of keeping the callable during a rollback.
No scope, code, authorization or rules change was made.

## 5. New finding (pre-existing, not Phase 2)

`30-finding-new-booking-london-timezone.md`: Staff New Booking interprets the form's date/time in
Europe/London regardless of the tenant timezone (wrapper `timeZone: 'Europe/London'`, `londonMs`), in the live
Phase 1 source too. For non-London tenants the booking is written at a different instant than chosen and its
conflict/BLOCKED check runs at that instant; Walk-in uses the tenant timezone. Live UK tenants are unaffected.

## 6. Release-blocking status after round 2

- **Blocking, code-side:** stale `staffPostWriteBoundary.test.ts` assertion → full frontend suite red at `9ea0aca`.
- **Owner decisions still open:** Walk-in↔Reschedule criterion, Admin `salownCreateWalkIn` staff bypass,
  release claim with the rules bypass open, staff notice, cached old-bundle exposure.
- **Still not verified:** transactional single checkout; registered-client checkout side effects.
