# Handoff → next session: STAFF-AVAIL-GAP Phase 2 (Staff App Walk-in)

## ⏩ SESSION CLOSE 2026-09-15 ~11:5x UK — Chrome connected, both UK checks + items 1/2/3/5/6 closed live; item 7 resolved as a finding; NO acceptance-test item remains open — READ THIS FIRST

Picked up the ~09:5x session below mid-session, once the owner reported the Chrome extension
connected. This was the exact, sole blocker every prior session recorded. Full record:
`docs/evidence/staff-avail-gap-p2/2026-09-15-chrome-uk-checks/README.md`. Fresh isolated clone,
same verified source `aa2efd9c5efc875bea316c461e47bf0817728c3c`, `src/firebase.ts` rewired to local
emulators in that throwaway clone only (never committed), real `staff.html` served via Vite, driven
by real clicks through the actual `WalkInFlow.tsx`. No shared-tree source edit, no deploy, no
production access.

**Check A (UK daytime) and Check B (UK midnight crossing) — the owner's explicit minimum ask —
both CLOSED with a real click and a real persisted Firestore document**, using a controlled-clock
technique (`window.Date` patched in the page before each click, verified by the TIME field itself
showing the expected value) rather than waiting for real wall-clock time. Real midnight/real 08:50
was never needed.

- Check A = acceptance item 1: 08:50 checkout → recorded start 08:20, same day. Confirmed exactly.
- Check B = acceptance item 2: 00:10 checkout → recorded start 23:40 **previous** day. Confirmed
  exactly, including that the booking correctly did NOT appear on "today"'s dashboard.
- Item 3 (boundary just inside same day, 00:40 → 00:10 same day, no rollover): confirmed exactly.
- Item 6 (manual-time regression): a manually-picked "09:15" (unrelated to the patched clock) was
  sent verbatim, not backdated — live-click proof, superseding the unit-only proof from the ~09:5x
  session below.
- Item 5 (owner-override re-prompt reuses the identical instant): a real seeded conflict triggered
  the real denial, which triggered the actual React `staffOverrideFlow.ts` calling the real
  `window.prompt` with the real server-derived message — first live proof of the client re-prompt UI
  itself (previously server-simulated only). `window.prompt` was patched to answer synchronously so
  no native blocking dialog was ever shown. The override reason and the exact backdated instant
  (`11:30 BST`) landed identically in the booking doc and its audit log — three-way match.
- Item 7 (passive-barber historical refusal): **not reachable through the normal UI at all** — the
  Professional picker unconditionally excludes `passive` barbers
  (`src/utils/bookingUtils.ts:496`), on any date. This is reported as a finding, not a gap: the
  server's `STAFF_PASSIVE` check (already proven server-side) is genuine defense-in-depth for a
  stale/bypassed client list, and the UI simply never offers the path a live click could exercise.

**Combined with items 4/8/9 (closed callable-level, `2026-09-15-callable-level-verify-2/`, pure
server logic with no UI involved by design), every one of the 9 acceptance-test scenarios in
`31-future-checkout-scope-options.md` §7 is now closed at the level that actually applies to it. No
acceptance-test item remains open.**

Bypass exceptions and the Walk-in↔Reschedule Phase-3 deferral remain **not accepted**. **No deploy
approval exists.** This is a verification-gap closure, not a release decision — the next step is an
owner release conversation for `aa2efd9`/`a7b1f33` (Phase 2 candidate), not further testing.

---

## ⏩ SESSION CLOSE 2026-09-15 ~09:5x UK — items 4/8/9 closed callable-level, item 6 independently re-run; ONLY Chrome-dependent items remain

Picked up the previous session's close (below). **Chrome extension checked first, same result:
not connected.** Per instruction, did not wait — spent the session closing every remaining
9-scenario checklist item that does NOT require an actual click, in a fresh isolated clone
detached at the same verified source, `aa2efd9c5efc875bea316c461e47bf0817728c3c`. Full record:
`docs/evidence/staff-avail-gap-p2/2026-09-15-callable-level-verify-2/README.md`. Claim
`STAFF-AVAIL-GAP-P2-VERIFY2` released at end of session. No shared-tree source edit, no deploy, no
production access.

**Items 4, 8, 9 — closed, callable-level (no Chrome), real client SDK + real emulators:**
- **Item 4** (`MAX_DURATION_MINS` refusal): durationMins=1441 → `INVALID_INPUT` before the
  transaction opens, zero write. durationMins=1440 (the exact boundary) → NOT rejected by the same
  guard, reaches the transaction and succeeds — isolates the refusal to precisely the >1440
  input-validation boundary.
- **Item 8** (conflict across midnight, seed straddling midnight itself — distinct from the prior
  session's item-5 same-day conflict): an existing booking whose own interval crosses local
  midnight (23:50→00:30 BST) is correctly detected as `SLOT_CONFLICT` against a backdated walk-in
  request on the "yesterday" side, then correctly overridable by the owner with the instant
  preserved byte-identical into the booking doc AND its audit log (`requestedStartMs` matches
  exactly).
- **Item 9** (shift-fit across midnight): a barber with different `shiftChanges` for "yesterday" vs
  "today" is correctly checked against **yesterday's** shift when the backdated instant rolls back a
  day — proven by success where today's shift (closed) would have refused it.

**Item 6** (manual-time regression): the handoff's own checklist said this had "no
change-specific re-verification yet". Corrected — `aa2efd9`'s commit already updated
`staffTimeContract.test.ts` + `staffCreateCutover.test.ts` to structurally pin the
`timeTouched === true` branch unchanged; this session **independently re-ran both files** against
the isolated clone (not just trusted the commit message): **89/89 pass**. This is unit/structural
proof, not a live click — it closes the "not re-run" gap but does not replace an actual Chrome
interaction with a manually-typed time.

**What is left is now ONLY Chrome-dependent** — the two UK checks (A: daytime, B: midnight) and
acceptance items 1, 3, plus the client-UI half of 2/5/7 (all already proven server-side). No
further non-Chrome work is available to advance this checklist; the next session's entire job,
once Chrome connects, is those checks — see the checklist table in the 2026-09-15 ~00:5x section
below (still accurate for what remains, minus items 4/6/8/9 which this session closed).

Bypass exceptions and the Walk-in↔Reschedule Phase-3 deferral remain **not accepted**. **No deploy
approval exists.**

---

## ⏩ SESSION CLOSE 2026-09-15 ~00:5x UK — full gate + callable verification COMPLETE, no new tests to start, only Chrome checks remain

**Full gate and callable verification are complete. Do not start new tests.** This closes the
`STAFF-AVAIL-GAP-P2-VERIFY` session at ~289k tokens (context-budget handoff, not a stopping point in
the work itself). The next session's only job is the two remaining Chrome checks below, then an
owner release decision. Bypass exceptions and the Walk-in↔Reschedule Phase-3 deferral are still
**not accepted**. **No deploy approval exists.** This is a verification-gap closure, not a release
approval — the gate passing does not authorize deploying anything.

### Exact SHA tested this session

`aa2efd9c5efc875bea316c461e47bf0817728c3c` (`WALKIN-BACKDATE-FLOOR: remove untouched-time Save &
Checkout 09:00 floor`) — both the round-12 full gate and the callable-level harness ran against an
isolated `git clone --no-hardlinks` checked out **detached** at this exact SHA, under
`/private/tmp/.../scratchpad/staff-avail-gap-p2/clone-aa2efd9` (deleted at session end, evidence
copied out first). Nothing in the shared `salown-app` tree was edited. `a7b1f33` (the Phase 2
release candidate that `aa2efd9` sits downstream of) was not separately re-tested this session —
everything here is evidence for `aa2efd9`, which is `a7b1f33` plus the backdate-floor commit.

### The 9 UI acceptance scenarios vs. the "two UK Chrome checks" — checklist

The two Chrome checks the owner asked for (UK daytime, UK midnight-crossing Save & Checkout) are
the **minimum requested scope**, not full coverage of all 9 scenarios in
`2026-09-14-test-fix-and-uk-checkout/31-future-checkout-scope-options.md` §7. Four of the nine need
a *third* kind of setup beyond a plain daytime-click / midnight-click pair (a long-duration service,
a manually-typed time, or a conflict/shift seeded to straddle the boundary itself). Status per item,
as of this session:

| # | Scenario | Which Chrome check | Coverage before this session | Coverage after this session |
|---|---|---|---|---|
| 1 | No-crossing early morning (08:50→08:20 same day) | **A — UK daytime** | none | still none (Chrome only) |
| 2 | Exact midnight crossing (00:10→23:40 prev. day) | **B — UK midnight** | unit-level only | **+ callable-level** (this session, controlled instant) — Chrome still open |
| 3 | Boundary just inside same day (00:40→00:10, no rollover) | A-variant (near-midnight, no crossing) | unit-level only | unchanged — Chrome still open |
| 4 | Long service crossing midnight by hours, `MAX_DURATION_MINS` refuses correctly | **neither — needs its own setup** (long-duration service) | none | none |
| 5 | Owner-override resubmission reuses identical instant across `CONFLICT_ACK_REQUIRED` retry | A or B + a seeded conflict | none | **+ callable-level, PROVEN generically** (this session — see §2 above: byte-identical instant through conflict→override→record). Chrome still needed to prove the *React prompt UI* reuses it, not just that the server accepts a repeated payload |
| 6 | Manual-time regression (`timeTouched===true` unchanged) | **neither — needs its own click** (a manually-typed time, not the untouched-time path) | none (existing WYSIWYG tests not re-run against this change) | unchanged |
| 7 | Historical-day eligibility exemption (passive/not-started barber on a backdated day) | B + a passive/not-started barber | unit-level only (flag mechanics) | **+ callable-level, PROVEN end-to-end** through the real `createWalkIn.ts` staff-surface path (this session: real `STAFF_PASSIVE` refusal, historical exemption correctly disabled). Chrome still needed to see the actual refusal UI |
| 8 | Conflict correctness across midnight (23:50-yesterday booking vs 23:40-yesterday walk-in) | **B, but with the conflict seeded to straddle the midnight boundary itself** — not the same as item 5's same-day conflict | none | **not fully covered** — this session's conflict test (item 5) used a same-calendar-day conflict window, not one straddling midnight; item 8 needs its own seed |
| 9 | Shift-fit correctness across midnight (yesterday's shift applies, not today's) | **B, with a barber whose shift differs by day** — this session's seed used all-day (`00:00`-`23:59`) hours, which sidesteps this entirely | none | none |

**Reading this table:** items 2, 5 and 7 are now de-risked by real (non-mocked) server-side
evidence and only need the *client* half proven. Items 1, 3, 4, 6, 8, 9 have no evidence beyond
source-reading — items 4, 6, 8, 9 in particular will not be satisfied by just "do the daytime click
and the midnight click"; each needs its own deliberate seed/setup even after checks A and B are done.

### Git provenance, exact — do not rewrite history

- **`salown-app` SYNC + claim-release commit, actual pushed SHA after rebase onto a concurrent
  session's `FIN-B2-FEE-READER` work:** `055a020` (`docs(sync): STAFF-AVAIL-GAP-P2 round-12 full
  gate PASS + callable-level verification note; release claim`). Confirmed via
  `git log --oneline -5` and the push output `7b03fd9..055a020 main -> main`. This is the correct
  SHA to cite, not the pre-rebase `6bd279e` (that one was rejected by `origin` as non-fast-forward
  and never landed).
- **`docs` (salown-docs) repo — the finance session's commit that this session's evidence landed
  inside of, via a shared-working-tree git race (documented, not corrected):** `01be737`
  (`docs(fin-fees): B2a reader in source (74922bd, not deployed); B1b blocked on the
  FIN-B1-SETTLEMENTS claim`), authored by session `session_01QEUppR9VGp4Y7h49hU5V2A`. Contains, in
  addition to that session's own `PROCESSOR_FEES_PLAN.md`/`ROADMAP.md` edits, all 7 files of
  `evidence/staff-avail-gap-p2/2026-09-15-callable-level-verify/` plus the updated aggregate
  `evidence/staff-avail-gap-p2/MANIFEST.sha256` — verified via `git show --stat 01be737`. **The
  other session independently added its own provenance note afterward: `0ab4376`
  ("provenance: 01be737 also carried STAFF-AVAIL-GAP-P2-VERIFY evidence staged by another
  session").** This session's own clean, single-purpose commit is `5a619e3` (the HANDOFF §1/§2
  write-up above). No `git commit --amend`, no rebase, no history rewrite was performed on either
  repo to "fix" the mixed commit — the content is intact and verified; only the commit boundary is
  imprecise.

### For the next session

Start from the checklist above, not from re-deriving scope. Chrome extension connectivity is the
only blocker — once connected, checks A and B (with the controlled-instant method from
`2026-09-15-callable-level-verify/README.md §2`, real midnight not required) plus items 4/6/8/9's
own setups are the entire remaining scope before an owner release conversation. **Do not re-run the
full `ops/test-emulator.sh` gate** — round 12 already closed that verification gap; re-running it
without new information is process waste, and unrelated concurrent sessions' commits may again
interleave with any docs-repo write, so keep commits narrow and expect to rebase.

---

## ⏩ SESSION UPDATE 2026-09-15 ~00:3x UK — round-12 full gate PASS + callable-level verification, Chrome checks still open

Full record: `docs/evidence/staff-avail-gap-p2/2026-09-15-callable-level-verify/README.md`.
Isolated clone of `aa2efd9`, no shared-tree edit, no deploy, no production access. Claim
`STAFF-AVAIL-GAP-P2-VERIFY` released at end of session.

**1. Emulator-gate diagnosis — round 12, the actual `ops/test-emulator.sh` script run as ONE
continuous invocation, completed cleanly: `general` 655/655, `packages` 27/27, TOTAL 682/682,
script's own `RESULT: PASS`, `GATE_EXIT=0`, wall-clock ~10m27s.** First time in 12 rounds this
exact script (not a manual re-split of its globs) has completed end-to-end without a stall. This
does **not** retroactively explain rounds 7/9's three anomalies (still open, still non-reproducing)
— it is a fourth continuous attempt, and this one passed. Skip/cancelled counts are not captured by
this gate at all (by the script's own design, confirmed this round); the raw per-test log is
deleted by the script's own `trap` whenever both phases pass, so only the phase-level totals above
survive for a clean run. A resource-sampling bug this round (documented in the evidence README) means
round 12 adds no new RAM/fd evidence beyond rounds 8-11 — their "checked, no signature found" stands
unchanged, not strengthened.

**2. Callable-level (no Chrome) verification, against the real `salownCreateStaffWalkIn`
callable + real Auth/Firestore/Functions emulators, real client SDK, controlled fixed instants (not
`Date.now()`):** confirmed server-side — (a) a submitted start instant survives conflict detection
→ owner-override retry → the final booking doc AND its audit log, byte-identical, three independent
places; (b) server-side owner-only enforcement holds even when a non-owner client sends override
fields directly (bypassing the UI's own role gate); (c) the midnight-crossing/historical-day
classification does **not** exempt a `passive` barber from `STAFF_PASSIVE` on the Staff App
surface (`historicalExemptionAllowed: false` works as designed).

**Explicitly NOT proven — both still open, unchanged from the 2026-09-14 23:5x checklist below:**
Chrome extension was not connected this session, so **zero** UI interaction happened. Still needed,
with an actual connected Chrome session (real midnight not required — a fixed/controlled instant
works, see the evidence README's method note):
1. That `WalkInFlow.tsx`'s untouched-time branch actually computes and sends
   `Date.now() - duration` from a real click (source-verified only, never exercised).
2. Any of the 9 acceptance scenarios in `31-future-checkout-scope-options.md` §7 requiring a real
   UI interaction (no-crossing daytime, exact-midnight click, a human-shaped owner re-prompt,
   manual-time regression).

**Housekeeping note:** this session's docs-repo commit landed *inside* another concurrent session's
commit (`01be737`, "docs(fin-fees): B2a reader in source…") due to a shared-working-tree git race —
this session staged only its own explicit evidence paths and never ran a broad `git add`, but the
other session's own commit swept up what was already staged before this session's `git commit`
executed. Content is verified intact (`git show --stat 01be737`, all 7 evidence files + both
MANIFESTs present, nothing else). No history rewrite attempted. Flagged here as a docs-repo
coordination gap (it has no per-path claim mechanism like `salown-app/ops/claims/`), not corrected.

Bypass exceptions and the Walk-in↔Reschedule Phase-3 deferral remain unaccepted. Deploy: none, at
any point. Candidate SHAs unchanged: Phase 2 release candidate still `a7b1f33`; `aa2efd9` still sits
downstream, still lacking any Chrome verification.

---

## ⏩ SESSION CLOSE 2026-09-14 ~23:5x UK — READ THIS FIRST, supersedes the 23:4x summary below on precision

This session is ending here. **No new tests were started after this point.** This section is the
exact, durable record the next session needs — SHAs, HEADs, claims, every run with its command and
raw log, and two corrections to how the 23:4x summary below characterized the result.

### Corrections to this session's own 23:4x wording, made explicit

- **Do not say "the product code is clean."** What is actually proven: the general phase, split
  into two groups, passed completely twice-in-aggregate (655/655, matching the historical
  baseline), and every individual file involved in a full-gate anomaly also passed alone when
  re-run immediately after. That is the full extent of what was established — it does not license
  a broader claim that the product is clean, because **the full gate has never completed as one
  continuous run, and the mechanism behind three real anomalies inside that continuous run remains
  unknown.**
- **Do not say the anomalies were "RAM-caused" or attribute them to any other specific mechanism.**
  RAM/swap growth and server-side transaction contention were the only two candidate mechanisms
  directly measured, and neither showed the expected signature in any of the three cases. This
  means those two are ruled out as the mechanism for what was observed — it does **not** mean the
  cause is known. It is not.
- **An isolated re-run passing does not close a full-run failure.** Each of the three anomalies
  below is still an open, unresolved, unexplained event that happened once inside a real gate run.
  Passing in isolation only proves the anomaly did not repeat that specific time — it is evidence
  against "this file/test is inherently broken," not evidence that the anomaly itself is resolved
  or understood.

### Candidate SHAs and current repo state (re-verify at session start, don't trust past the moment this was written)

| Repo | Path | HEAD = origin | Clean? | Notes |
|---|---|---|---|---|
| salown-app | `~/Desktop/alex/salown-app` | `a3da1b23e3a05f03bc530c5ebed6dd0e57d57042` | yes, 0/0 | |
| docs (salown-docs, private) | `~/Desktop/alex/docs` | `2963d8e73f36b86b80202e6a82388f6fc92a3d80` | untracked `prototypes/` present — **not this session's, not touched, not committed** | |

- **`STAFF-AVAIL-GAP-P2` Phase 2 release candidate: still `a7b1f33`** — unchanged by anything in
  this session. No emulator/Chrome verification exists for it beyond what was already recorded
  before this session started.
- **`WALKIN-BACKDATE-FLOOR` implementation: still `aa2efd9`**, sitting downstream of `a7b1f33` on
  `main`, unchanged by this session's diagnosis work (which used source-identical clones of it, not
  a rebuild). No emulator/Chrome verification exists for it either.
- **Claims:** `ops/claims/` holds only the pre-existing, unrelated, blocked `WHATSAPP-B7`
  (`since: 2026-09-05`). Nothing from this session's diagnosis work remains claimed — every
  `EMULATOR-GATE-DIAGNOSIS*` claim opened this session was released the same session, verified via
  `./ops/claims/claims.sh list` immediately before this update was written.
- **Every diagnostic run this session used an isolated clone whose HEAD, while numerically
  different from `aa2efd9` (it carries this session's own later claim/`SYNC.md` bookkeeping
  commits), is byte-identical to `aa2efd9` in every other tracked path** — verified explicitly:
  `git diff --stat aa2efd9 <clone-HEAD> -- . ':!ops/claims' ':!SYNC.md'` returns empty for every
  clone HEAD used (`a993feb`, `e639a1c`, `2a2038f`, `a3da1b2`). Read every run below as "against
  `aa2efd9`'s source," regardless of which of those four exact clone HEADs it names.

### Every run this session, in order — SHA, command, result, raw log

All commands below ran with `JAVA_HOME=/opt/homebrew/opt/openjdk`,
`JAVA_TOOL_OPTIONS=-Xmx512m`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`,
`GCLOUD_PROJECT=demo-c1`, against `firebase-tools 15.26.0` /
`cloud-firestore-emulator-v1.22.0.jar` (the repo's pinned toolchain), from
`functions/`. Every raw log path below is relative to
`docs/evidence/staff-avail-gap-p2/2026-09-14-emulator-gate-diagnosis/`.

| # | Source | Command (files) | Result | Raw log(s) |
|---|---|---|---|---|
| 1 | shared tree, `a993feb` | full 2-phase `ops/test-emulator.sh` (attempt 1) | **INCOMPLETE** — watchdog output lost to a `tee` buffering bug; cannot say what ran | `05-full-gate-attempt-1-watch-reconstructed.log` |
| 2 | shared tree, `a993feb` | full 2-phase `ops/test-emulator.sh` (attempt 2) | **INCOMPLETE** — killed by an external Monitor timeout after the script's own iteration-count cap failed to fire in real time | `04-full-gate-attempt-2-watch.log` |
| 3 | clone `e639a1c` | `node --test --test-concurrency=1 src/inventory/executor.emulator.test.js` alone | **PASS 20/20** | `01-executor-test-output.log`, `02-firestore-emulator.log`, `03-diag-watch.log` |
| 4 | clone `e639a1c` | 5-file subset: `bookings/blocks`, `bookings/createWalkIn`, `parsers/importAssignment`, `staff/rotaWriter`, `inventory/executor` (real order differed from listed order — see log) | **PASS 79/79** | `06-subset-test-output.log`, `07-subset-firestore-emulator.log`, `08-subset-resource-samples.log`, `09-subset-watch.log` |
| 5 | clone `2a2038f` | Step 1: the 10 real predecessors + `inventory/executor` (11 files) | **PASS 303/303** | `10-step1-test-output.log`, `11-step1-observed-file-order.log`, `12-step1-watch.log` |
| 6 | clone `2a2038f` | Step 2: the 20 remaining `PHASE1_GLOBS` files | **PASS 352/352** (303+352=655, matches `9ea0aca`'s historical 655/655) | `13-step2-test-output.log`, `14-step2-observed-file-order.log`, `15-step2-watch.log` |
| 7 | clone `2a2038f` | Step 3, general phase, full 31-file continuous run (attempt A) | **INCOMPLETE — TIMEOUT/EXTREME-SLOWNESS symptom**: `bookings/createAdminBooking.emulator.test.js:88` took 1,700,752.35ms (~28m21s); own gate cap fired next, mid-`reassignBooking` | `16-step3-general-test-output.log`, `17-step3-general-observed-file-order.log`, `18-step3-snapshot-at-limit.txt`, `19-step3-watch.log`, `20-step3-firestore-debug-FULL.log` |
| 8 | clone `2a2038f` | `createAdminBooking.emulator.test.js` alone, immediately after #7 | **PASS 9/9** (3,598.0ms; does not reproduce #7 — does not close it) | `21-repro-test-output.log`, `22-repro-mem-swap-samples.log`, `23-repro-firestore-debug-full.log`, `24-repro-watch.log` |
| 9 | clone `2a2038f` | Step 3, general phase, full 31-file continuous run (attempt B, clean restart) | **INCOMPLETE — TWO SEPARATE symptoms in one run:** (a) **ASSERTION FAILURE** — `finance/periodClose.emulator.test.js` test `R21` failed after 323,843.15ms; (b) **PENDING-PROMISE / HANG** — `treatmentSessions/integration.emulator.test.js` reported by Node itself as `1,379,525.89ms` with `'Promise resolution is still pending but the event loop has already resolved'`, requiring external termination. Own gate cap fired after this | `25-step3retry-general-test-output.log`, `26-step3retry-general-observed-file-order.log`, `27-step3retry-snapshot-at-limit.txt`, `28-step3retry-watch.log` |
| 10 | clone `2a2038f` | `treatmentSessions/integration.emulator.test.js` alone, after #9 | **PASS 15/15** (7.2s; does not reproduce #9b — does not close it) | `29-repro2-integration-test-output.log`, `30-repro2-integration-mem-swap-samples.log` |
| 11 | clone `2a2038f` | `finance/periodClose.emulator.test.js` alone, after #9 | **PASS 31/31**, `R21` at 2,122.27ms — its own designed 2-second-hold duration (does not reproduce #9a — does not close it) | `31-repro3-periodclose-test-output.log` |

### Split general phase — the one thing that is unambiguously PASS

Runs #5+#6 together cover every file the full gate's `general` phase covers, split into two
groups: **655/655, zero failures.** This is the historical baseline number exactly. This is the
only PASS result in this whole session that spans the full file set.

### Full gate — status, stated precisely, per phase

- **`general` phase: NOT completed as one continuous run, in either of two attempts (#7, #9).**
  Attempt #7 stopped on a slowness/timeout symptom before reaching `packages`. Attempt #9 stopped
  after encountering BOTH an assertion failure and a hang before reaching `packages`. Neither
  attempt's `general` phase reached its own natural end.
- **`packages` phase (`src/packages/executor.emulator.test.js`, historically 27/27): NEVER
  REACHED, in either attempt.** The `run_phase` design used this session explicitly does not
  proceed to `packages` unless `general` finishes cleanly first (matching `ops/test-emulator.sh`'s
  own gating) — so there is **zero evidence about `packages` from this session**, neither pass nor
  fail. This is distinct from `general`'s status and must not be reported alongside it as if both
  were tested.

### Remaining Chrome/emulator checks for the new backdate formula (`WALKIN-BACKDATE-FLOOR`, `aa2efd9`)

None of the following have been run through a live Chrome/emulator rehearsal — `aa2efd9`'s own
gates this session (and the original implementing session) were unit/vitest-level only. Source:
`docs/evidence/staff-avail-gap-p2/2026-09-14-test-fix-and-uk-checkout/31-future-checkout-scope-options.md`
§7's 9 candidate acceptance tests. Two already have UNIT-level coverage (noted); none have live
Chrome coverage:

1. No-crossing early morning (08:50 → 08:20 same day) — **no coverage at all yet.**
2. Exact midnight crossing (00:10 → 23:40 previous day) — **unit-level covered**
   (`src/staff/lib/staffTimeContract.test.ts`), **not Chrome-verified.**
3. Boundary just inside the same day (00:40 → 00:10, no rollover) — **unit-level covered**
   (same file), **not Chrome-verified.**
4. Long service crossing midnight by hours, `MAX_DURATION_MINS` still refuses correctly — **no
   coverage at all yet.**
5. Owner-override resubmission reuses the identical instant across a real `CONFLICT_ACK_REQUIRED`
   retry — **no coverage at all yet; needs live Chrome.**
6. Manual-time regression (`timeTouched === true` byte-identical before/after) — **no
   change-specific re-verification yet** (the existing WYSIWYG invariant tests were not re-run
   against this specific change).
7. Historical-day eligibility exemption — **the target behavior itself CHANGED since this list was
   written**: the owner's later decision (this session, before the emulator-gate diagnosis began)
   was to SCOPE DOWN the exemption for the staff surface, not accept it as-is. The companion fix
   (`historicalExemptionAllowed`) has **unit-level coverage** (`functions/src/bookings/staffEligibility.test.js`)
   proving the flag's mechanics, but **no live emulator/Chrome test exercises the actual
   `createWalkIn.ts` staff-surface call path end-to-end** with a real midnight-crossing walk-in
   against a real passive/not-yet-started barber.
8. Conflict correctness across midnight (23:50-yesterday booking vs. 23:40-yesterday walk-in) —
   **no coverage at all yet; needs a real emulator, not assumed from source reading.**
9. Shift-fit correctness across midnight (yesterday's shift, not today's) — **no coverage at all
   yet; needs a real emulator, not assumed from source reading.**

### Unchanged, reaffirmed

Bypass exceptions and the Walk-in↔Reschedule Phase-3 deferral remain recommendations only, **not
accepted**. **No deploy happened or is proposed anywhere in this session.** No production
read/write at any point.

### Verified before writing this section

- `MANIFEST.sha256` in the evidence folder: `shasum -a 256 -c MANIFEST.sha256` — **all 32 entries
  OK.**
- No emulator/Java/Node-test process left running (`ps aux` swept for
  `cloud-firestore-emulator|node --test|firebase emulators` — none found); all emulator ports
  (8080/9099/5001/4400/9150) free.
- Both repos: `git fetch --prune` run, HEAD = origin confirmed for both, working tree clean for
  salown-app (docs carries only the untracked, not-this-session's `prototypes/` noted above).

---

## ⏩ UPDATE 2026-09-14 ~23:4x UK — READ THIS FIRST, the emulator-gate diagnosis conclusion

Written by the same session as the 20:0x update below, after an owner-directed systematic
diagnosis: run the real predecessor set, the remaining files, then the full gate itself, with
proper real-time-based logging. Full record:
`docs/evidence/staff-avail-gap-p2/2026-09-14-emulator-gate-diagnosis/README.md` §3a-§3c.

**The product code is clean.** All 31 general-phase files were run split into two groups
(11 + 20) and passed completely: **655/655 — exactly matching the historical known-good baseline**
recorded for `9ea0aca`. Every individual file implicated in every anomaly below also passes cleanly
and quickly the moment it is run alone.

**The full gate has NOT yet completed as one clean, continuous, uninterrupted run — twice
attempted, twice stopped by a different, non-reproducing anomaly:**
1. `bookings/createAdminBooking.emulator.test.js:88` took ~28m21s once; the emulator's own debug
   log proved it was doing NOTHING server-side for that entire window.
2. `finance/periodClose.emulator.test.js` R21 FAILED once, after ~5m24s, in a test whose own design
   only holds a 2-second barrier.
3. `treatmentSessions/integration.emulator.test.js` produced Node's own definitive file-level hang
   report — `1,379,525.89ms` with `'Promise resolution is still pending but the event loop has
   already resolved'` — once.

**None of the three reproduced** when the exact same file was re-run alone immediately afterward
(473x, 153x, and 191x faster respectively, all passing). This is reported as an observed pattern —
one stochastic anomaly per full-gate attempt, in a different file each time — **not** a diagnosed
root cause, and specifically **not** attributed to RAM or contention: both were directly checked in
each case and neither showed the expected signature. **No third full-gate attempt was made** — two
attempts plus three independent non-reproductions was judged sufficient to report rather than keep
re-running blind. No deploy, no production access, at any point.

**What this means for STAFF-AVAIL-GAP-P2 and `aa2efd9` specifically:** neither has advanced through
this diagnosis — this work was about understanding the GATE's own reliability (using files spanning
well beyond either candidate's own changes), not about re-verifying either SHA. The candidate-SHA
state from the 16:3x update is UNCHANGED: `a7b1f33` remains Phase 2's release candidate; `aa2efd9`
sits downstream, still Phase-2-release-unverified; both still lack emulator/Chrome verification.

---

## ⏩ UPDATE 2026-09-14 ~20:0x UK — READ THIS FIRST, corrects this session's own emulator-gate framing below

Written by the same session as the 16:3x update below, after two attempts to re-run the two-phase
`ops/test-emulator.sh` against `aa2efd9` (§3 of the 16:3x section's "next step"). **Retracting this
session's own "RAM constraint" framing for why that gate stays open** (16:3x §3 and its "explicitly
OPEN" line) — that framing was never actually confirmed and should not be repeated. Full record:
`docs/evidence/staff-avail-gap-p2/2026-09-14-emulator-gate-diagnosis/README.md`.

- **Two full-gate attempts this session, both INCOMPLETE** — not a pass, not a fail, not a
  confirmed RAM/thrash cause. Attempt 1's watchdog output was lost to a `tee`-buffering bug.
  Attempt 2's "time cap" counted loop iterations, not real elapsed time, so an external tool
  timeout — not a designed stop — is what actually ended it, 33 real minutes in. **Swap never grew
  past baseline in either attempt.**
- **Separately, a narrow single-file diagnostic (owner-directed, not a full-gate retry):**
  `src/inventory/executor.emulator.test.js` — the SAME file the ORIGINAL 2026-09-13 incident (§9.7d
  below) named as where the machine "sat stuck" — run ALONE in an isolated clone, same pinned
  toolchain/heap/concurrency, durable logs, a real wall-clock cap. **Result: 20/20 PASS, ~3 minutes,
  no hang.** ~157.7s of that is four deliberately concurrent tests hitting real, documented
  Firestore transaction-contention/retry-backoff latency (not a defect) — see the evidence README
  §2 for the exact per-test breakdown. This does not retroactively prove the ORIGINAL §9.7d incident
  (against `a7b1f33`, a different session, different exact conditions) was something other than what
  it said — it establishes that THIS file, on ITS OWN, at `aa2efd9`, today, is not broken and does
  not hang.
- **Still does not explain why the full multi-file gate stalls.** Leading, UNTESTED hypothesis:
  aggregate contention when ~20 files' own concurrent tests all hit the ONE shared Firestore
  emulator instance together. Not run. **No full-gate re-run until this is actually understood** —
  per explicit instruction, don't repeat the full gate blind again.
- No deploy, no production access. Bypass/Phase-3 decisions unchanged from every prior record.

---

## ⏩ UPDATE 2026-09-14 ~16:3x UK — READ THIS FIRST, supersedes the 04:50 update below on the candidate-SHA question

Written by the session that picked up the 04:50 update below, did a separate, unrelated
piece of work (`WALKIN-BACKDATE-FLOOR`) on the owner's go-ahead, then received an owner
correction on how that work's same-session report described its relationship to this item.
This section is that correction, made durable. Full detail: [[project_staff_avail_gap]] round 6,
`docs/evidence/staff-avail-gap-p2/2026-09-14-walkin-backdate-floor/README.md` §2 (the reasoning in
full, with the exact file-overlap evidence).

### The short version

1. **`WALKIN-BACKDATE-FLOOR` is DONE, at salown-app `aa2efd9`** (pushed, not deployed): the
   Walk-in untouched-time Save & Checkout backdate no longer has a 09:00 floor — one absolute
   instant is computed instead, correctly rolling the calendar day back across midnight — with a
   companion fix so a midnight-crossing backdate still gates `STAFF_PASSIVE`/`STAFF_NOT_STARTED`
   (`assertAssignableStaff`'s new `historicalExemptionAllowed` flag). This was a separate,
   owner-approved piece of work, decided and implemented in one session; see round 6 for the four
   decision points and their answers.
2. **"Separate work" is a scope/decision statement, not a deployability one.** `aa2efd9` sits
   downstream of `a7b1f33` on `main` and edits `createWalkIn.ts` / `WalkInFlow.tsx` directly — the
   SAME runtime files that ARE this item's Walk-in payload, plus `staffEligibility.ts`, the module
   they call into. **The Phase 2 release candidate remains `a7b1f33`** — the only SHA that has
   actually been through this item's own release verification (round-2 emulator/Chrome/compat
   gates). `aa2efd9` has passed its OWN gates (functions unit, frontend vitest, `tsc`,
   deploy-guard) but has **not** been through Phase 2's release verification. **A deploy of
   `salownCreateStaffWalkIn` or `hosting:salown-staff` from current `main` HEAD (or anything at or
   after `aa2efd9`) would ship both together, whether or not that is the intent** — there is no
   ordinary build of `main` that contains one without the other; isolating either one requires this
   repo's established pinned-workspace release pattern. Do not describe a future Phase 2 candidate
   as simply "`a7b1f33`" without saying which SHA a build actually pins to.
3. **`aa2efd9`'s emulator/Chrome verification stays explicitly OPEN** — same reason as `a7b1f33`'s
   own open emulator-gate re-run below: this machine's RAM constraint, owner chose to defer both
   this session. Neither SHA may be reported as emulator/Chrome-verified until that actually runs.
4. **No deploy happened or is proposed. The bypass exceptions and the Phase-3 deferral remain
   unchanged, unaccepted recommendations** — nothing in this update touches §8 below.
5. **Raw-log discipline:** the first same-session report of `aa2efd9`'s gates stated results from
   inline terminal output with nothing persisted — self-reported, not independently checkable. The
   evidence folder named above now carries the actual log files; read those (or re-run the
   commands) rather than trusting a prose summary, this one included.

---

## ⏩ UPDATE 2026-09-14 ~04:50 UK — READ THIS FIRST, supersedes the "first concrete step" below

Written by the session that picked up the original handoff below, worked the whole way through
its own "first concrete step," and is now closing out. **Everything below this update section is
the ORIGINAL handoff as written 2026-09-13 night — it is historical record, not current
instructions.** Full detail in [[project_staff_avail_gap]] and `docs/STAFF_AVAIL_GAP_PLAN.md`
§9.7c–§9.7e; this section is the short version.

### Status in one line
`STAFF-AVAIL-GAP-P2` is **still `PUSHED_NOT_LIVE`, still NOT releasable, no deploy**. The one
code-side blocker the original handoff named (the stale `staffPostWriteBoundary.test.ts`) **is
now fixed and committed** — the candidate SHA changed from `9ea0aca` to **`a7b1f33`**. Three things
remain open before this could even be considered for release, and none of them are close to done.

### What changed since the original handoff (all in `salown-app` unless noted)
1. **Test-fix committed**, not just prepared. Claim `STAFF-AVAIL-GAP-P2-TESTFIX`
   (`5788d8a` → impl `a7b1f33` → release `b6c325c`). Only
   `src/staff/lib/staffPostWriteBoundary.test.ts` + `SYNC.md` touched — no app/functions source.
   In the real tree: fixed test 20/20, full frontend `vitest run` 5567 pass/1 fail (the same
   pre-existing `functionsArchiveManifest.test.js` environment negative control this machine
   always shows), functions unit (full) 2691 pass/0 fail/43 skipped, `tsc`/`eslint` clean,
   `deploy-functions.sh --check-only`/archive-manifest/`build:staff` all PASS (`build:staff`'s
   output is byte-identical to the pre-fix bundle, sha256 `882813e2…` — expected, no shipped file
   changed). `salown-app` HEAD = origin = **`b6c325c`**, 0/0 clean.
2. **⚠️ The two-phase `ops/test-emulator.sh` did NOT get re-run against `a7b1f33` — this is the
   most important open item.** It was attempted once. This machine (the documented 8GB-RAM trap)
   thrashed under memory pressure and sat stuck on `src/inventory/executor.emulator.test.js` for
   ~1h40m with near-zero CPU progress before being killed rather than left running indefinitely.
   The gate's file set (`functions/src/**/*.emulator.test.js` + a few `scripts/*.emulator.test.cjs`)
   is entirely disjoint from the one file the test-fix commit touched, so its last completed
   result — **682/682**, recorded pre-fix — is *reasoned*, not *proven*, to still hold. **Do not
   report this gate as passing for `a7b1f33` without actually running it.** If this machine is
   still memory-constrained, either free real RAM first (this session's own attempt didn't try
   closing the user's other Chrome tabs — that would need the user's own action, not something to
   do unilaterally) or run it on a different machine.
3. **UK (Europe/London) backdated-checkout Chrome check — done, but narrower than it first
   looked.** Ran live against a genuine `Europe/London` synthetic tenant (`p2uk`) with
   Auth+Firestore+Functions all confirmed on the local emulator (network-request-verified, no
   production contact). At the real wall-clock time of the run (~01:20 BST) this only exercised
   the formula's **floor branch** (`max(9*60, now−duration) → 09:00`) — an earlier draft of this
   session's own report overclaimed "closes the round-2 gap" and "equally valid branch," both
   **withdrawn same-night as overreach** (see `docs/STAFF_AVAIL_GAP_PLAN.md` §9.7c/§9.7d). The
   UK-daytime **subtraction** branch (what round 2's LA tenant actually exercised, 16:11 → 15:40)
   is **still not tested on a UK tenant**. Do not claim this is done.
4. **The future-dated-checkout finding this UK check surfaced now has an owner-specified target
   behavior, worked through against source, but zero code written.**
   `docs/evidence/staff-avail-gap-p2/2026-09-14-test-fix-and-uk-checkout/31-future-checkout-scope-options.md`
   (superseding its own earlier three-generic-options draft, kept as an appendix) has: why the
   existing `minsToTimeStr` clamp can't express a midnight day-rollover and an absolute-instant
   computation is needed instead; the existing `startTime`-wins seam in `bookingCallables.ts` as
   the natural (unbuilt) implementation path; that `time` is already captured once and reused on
   an owner-override retry but `date` (`getTodayStr()`) is not; **the one real, previously-invisible
   consequence found** — `classifyTenantDay`/`assertAssignableStaff` in
   `functions/src/bookings/staffEligibility.ts` would newly exempt `STAFF_PASSIVE`/`STAFF_NOT_STARTED`
   for a duration-driven midnight-crossing backdate (unreachable today because the floor keeps
   every untouched-time backdate inside "today"); confirmation that conflict-scan (24h lookback)
   and shift-fit (`tenantDateKey` from the instant) already handle a rolled-back day correctly;
   confirmation the manual-time-picker flow is structurally unaffected; 9 candidate acceptance
   tests; 4 real remaining decision points (the eligibility exemption chief among them). **This is
   a separate, unrelated finding from the Phase 2 release decisions** — not a blocker for, and not
   bundled with, Phase 2's release.

### Repos and claims (re-verify, don't trust this table past the moment it was written)
| Repo | Path | HEAD = origin at writing |
|---|---|---|
| salown-app | `~/Desktop/alex/salown-app` | `b6c325cc5262c267fe37cc7b83e7380f0c074af9`, clean, 0/0 |
| docs (private) | `~/Desktop/alex/docs` | `eca2ef4565b1c54f6f16283c4cc1e5e0f4722a4f` (includes one unrelated same-night commit from another session, `FIN-PROCESSOR-FEES` evidence — no conflict), clean, 0/0 |

`ops/claims/` holds only the unrelated `WHATSAPP-B7` (blocked). `STAFF-AVAIL-GAP-P2-TESTFIX` was
opened, used, and released within this session — nothing is claimed by this work now.

### Local environment
Nothing emulator/rehearsal-related is running. Ports 8080/9099/5001/4400/9150/5199 all free,
verified at close. **The one thing that IS running and must stay untouched:** the shared Vite dev
server on `localhost:5173` (PID varies by session, currently ~94201) — pointed at **production**
Firebase (`havuz-44f70`) per `src/firebase.ts`'s default config, not an emulator. Per
[[feedback_shared_dev_server]]: never restart/kill it; if a hard refresh is needed, ask the owner.

### First concrete step for the next session (supersedes §9's below, which is now done)
1. Read this update, then `docs/STAFF_AVAIL_GAP_PLAN.md` §9.7c–§9.7e and
   `docs/evidence/staff-avail-gap-p2/2026-09-14-test-fix-and-uk-checkout/` in full (README +
   `31-future-checkout-scope-options.md`) before doing anything else.
2. `git fetch --prune` both repos, confirm the HEADs above still match, confirm no claim conflicts.
3. **Priority: get `ops/test-emulator.sh` to actually complete against `a7b1f33`.** Check real
   available RAM before starting (`top -l 1 | grep PhysMem`); if this machine is still tight,
   either ask the owner whether other apps/tabs can be closed, or use a different machine. Do not
   report a gate result without it actually having run to completion this session.
4. UK-daytime backdated-subtraction check on a genuine UK tenant — still not done, still needed
   before Phase 2 could be considered release-ready on that front.
5. The future-checkout target-behavior spec (§`31-future-checkout-scope-options.md` §8) has 4 real
   decision points that need the owner, not an engineering default — surface them, don't guess.
6. **No deploy, no production read/write, no code change without a claim and explicit go-ahead** —
   all of this session's own constraints carry forward unchanged. Bypass exceptions and the
   Walk-in↔Reschedule Phase-3 deferral (`20-owner-decision-recommendations.md`) remain
   recommendations only, still not accepted.

---

## ORIGINAL HANDOFF (2026-09-13 night) — historical record below this line, superseded by the update above

**Written:** 2026-09-13 23:4x UTC (2026-09-14 00:4x UK) by the session that implemented and evaluated
Phase 2. **Status:** `PUSHED_NOT_LIVE`, **NOT releasable**, no release approved. Nothing is claimed by
this work (`ops/claims/` holds only the unrelated `WHATSAPP-B7`). Every value below was read at the time of
writing — re-verify, do not assume.

---

## 1. Goal and the user's constraints (verbatim intent, all still in force)

- **Goal:** Staff App Walk-in (Save and Save & Checkout) enforced server-side with the same D1-D7 contract
  as Phase 1 New Booking: passive and undated leave never overridable; conflict and hours reject-by-default
  with an **owner-only**, reason-required, atomically audited override; BLOCKED time never overridable;
  race-safe with New Booking and Block Time. Decision record: [`STAFF_AVAIL_GAP_PLAN.md`](STAFF_AVAIL_GAP_PLAN.md)
  §5, §7.2, §8, §9.4, §9.7, §9.7a, §9.7b.
- **No deploy. No production read or write.** (Functions, hosting, rules — none.)
- **Do not change the shared working tree** (`~/Desktop/alex/salown-app`). Prepare the required test fix as a
  concrete patch in an **isolated workspace**; committing it needs a claim and the normal commit rules.
- **Not approved:** any bypass exception (Admin `salownCreateWalkIn` staff bypass, release with the
  `firestore.rules` bypass open) and the deferral of the Walk-in↔Reschedule race criterion to Phase 3.
  The recommendations exist; the decisions do not.
- Do not re-run completed checks without a reason. Do not hide failed checks; separate environment failures
  from code failures with evidence. No passwords/tokens in any artefact.
- Do not start Phase 3. WhatsApp B7, e-mail localisation and A5 path 1/5 are out of scope.

## 2. Repositories and rules

| Repo | Path | HEAD = origin (at writing) |
|---|---|---|
| salown-app | `~/Desktop/alex/salown-app` | `e48300eadc6ecefc3e583fc66fa649389d42e441`, clean, 0/0 |
| docs (salown-docs, private) | `~/Desktop/alex/docs` | `503158dfa5c0379e74b1a0c3a232c81bdce5e2d6` + this handoff commit |

Rules to read first: `salown-app/AGENTS.md`, `salown-app/CLAUDE.md`, `~/Desktop/alex/CLAUDE.md` (Daily
Project Truth, claims protocol rules 1-10), `salown-app/ops/claims/README.md`, `docs/DEPLOY.md`.
Key rules: claim before editing; explicit-path commits only (never `git add .`, `git restore .`,
`reset --hard`); every outgoing salown-app commit carries `[skip ci]` and passes `./ops/release-guard.sh`
(never `ALLOW_CI_RELEASE`); English in all repo artefacts; docs edits are committed and pushed in the docs
repo; a release happens only from an isolated `git archive`/clone workspace with an owner-approved,
announced target list and a `RELEASE_LEDGER.md` row.

## 3. What was built (tested release candidate)

- **Candidate SHA:** salown-app **`9ea0aca076d80b05279be6b7135402ad7f049554`** (claim `9c2ecd6`, SYNC/claim
  release `e48300e`). Later salown-app commits `2f1007a`…`0780fd1` are a different session's Admin
  INSIGHTS-PASSIVE-BARBER work — separate release scope, not part of this candidate.
- 19 files: `functions/src/bookings/staffPolicyGate.ts` (new shared contract), `createBooking.ts` (Phase 1
  core refactored onto it), `createWalkIn.ts` (`opts.surface: 'staffApp'`), `functions/src/index.ts` (new
  callable `salownCreateStaffWalkIn`), `src/staff/lib/staffOverrideFlow.ts` (shared owner-override client
  flow), `WalkInFlow.tsx`, `NewBookingSheet.tsx`, `bookingCallables.ts`, `staffCreateReason.ts`, en/tr
  `staffApp.ts`, tests. `salownCreateWalkIn` (Admin WalkInForm, Clients quick book) is unchanged.
- Proposed release targets (not approved): `salownCreateStaffWalkIn` first, then `hosting:salown-staff`.
  `salownCreateStaffBooking` is **not** a target (old/new server responses identical, §9.7a).

## 4. Completed checks and raw evidence

Evidence root: `docs/evidence/staff-avail-gap-p2/` — top-level `MANIFEST.sha256` covers every run
(verify: `cd docs/evidence/staff-avail-gap-p2 && shasum -a 256 -c MANIFEST.sha256`).

| Check | Result | Raw evidence |
|---|---|---|
| Targeted Firestore-emulator suites (booking/walk-in/block/access), incl. 22 new walk-in tests + 4 cross-flow races | 211/211 | `2026-09-13-local-verification/test-emulator-targeted.log` |
| Real Auth-emulator ID token → HTTP → callables | 17/17 | `…/token-checks.txt` |
| Chrome round 1 (tenant `p2ui`, **Europe/London**): walk-in staff S1-S3, admin A1-A3, owner O1b/O2/O3/O4 | PASS (O1 attempt 1 incomplete) | `…/README.md`, `*-observations.json`, `*.jpg`, before/after `*.json` |
| Content-level zero-write + updateTime inventory | 0 changes in every zero-write scenario | `…/zero-write-content-check.json` |
| Old live server (797c9b3) vs new server, new client payloads | 13/13 identical for `salownCreateStaffBooking` | `…/compat-*.json` |
| **Round 2, git-backed isolated clone at `9ea0aca`:** functions unit (full) | 2734: 2689 pass, **0 fail**, 45 skipped | `2026-09-14-release-checks/01-functions-unit-full.log` |
| two-phase `ops/test-emulator.sh` | **682/682 PASS** | `…/03-emulator-gate-two-phase.log` |
| `deploy-functions.sh --check-only salownCreateStaffWalkIn` | PASS (uncommitted-changes step ran clean) | `…/04-deploy-guard-check-only.log` |
| `functionsArchiveManifest.cjs` | PASS | `…/05-functions-archive-manifest.log` |
| `npm run build:staff` | PASS, `staff-BGZUV_T1.js` sha256 `882813e2…` | `…/06-build-staff.log` |
| **full frontend `npx vitest run`** | **5552 pass, 6 skipped, 3 FAIL** — see §5 | `…/02-frontend-vitest-full.log` |
| Chrome round 2 (tenant `p2c`, **America/Los_Angeles**): staff New Booking conflict/BLOCKED/leave; owner New Booking override + changed-conflict re-approval; owner walk-in with the time picker untouched + Save & Checkout | PASS on the London-interpreted fixtures; see §6 for scope | `…/chrome/ui-observations-round2.json`, `…/chrome/C*.json`, `…/chrome/diff__*.json`, `…/chrome/*.jpg` |
| Evaluation / recommendations / finding | — | `…/RELEASE-EVALUATION-2.md`, `…/20-owner-decision-recommendations.md`, `…/30-finding-new-booking-london-timezone.md` |

## 5. Open failures at the candidate — NOT closed by 682/682

The emulator gate passing does not cover `vitest`. The full frontend suite is **red at `9ea0aca`**:

1. **CODE-SIDE, release blocker:** `src/staff/lib/staffPostWriteBoundary.test.ts` › "WalkInFlow: the
   create/checkout calls are not inside a post-write step" expects `await createSaleBooking(` twice. The
   Phase 2 refactor routes Save and Save & Checkout through one `createWalkInEnforced`, so the source has it
   once. This test was **not updated** in `9ea0aca`.
   - A scratch-only test (`2026-09-14-release-checks/12-scratchBoundaryInvariant.test.ts`, run in a rehearsal
     copy, `12-boundary-invariant-proof.log`) shows the protected invariant still holds. **It does not fix the
     failing test in the release candidate** and is not a substitute for it.
   - Fixing it requires a real change to `src/staff/lib/staffPostWriteBoundary.test.ts`, a new commit, a **new
     candidate SHA**, and a full re-run of the frontend suite (plus whatever the rules require for that SHA).
2. **ENVIRONMENT ×2:** `scripts/functionsArchiveManifest.test.js` › NEGATIVE CONTROL. The control expects this
   machine's untracked `functions/.secret.local` and `functions/.claude/`, which a clean clone does not have
   (`11-manifest-negative-control-environment.txt`). They fail in any clean release workspace; they pass only
   where those local files exist. Treat as environment, but name them in every future gate report.

## 6. Scope limits of the Chrome evidence — do not over-read

- **Round 2 ran on `p2c` with `presentation.timezone = America/Los_Angeles`** (chosen so the backdated start is
  daytime). **UK behaviour is not separately proven by round 2**: the owner untouched-time Save & Checkout was
  observed only on the LA tenant; the New Booking regression used an LA tenant with seeds placed on the London
  interpretation. Round 1 walk-in scenarios ran on a Europe/London tenant but did not include the owner
  untouched-time path.
- The first round-2 New Booking attempt "saved" two conflicting bookings because the seeds were LA-placed while
  New Booking reads the form in Europe/London — a fixture error that exposed the finding below; it is not a
  policy pass or fail.
- Backdated start = `minsToTimeStr(max(09:00, now − duration))`, rounded to the nearest 5 minutes
  (`walkinTime.ts:88`; unchanged since live `797c9b3`): observed 16:11 → 15:40.
- Not verified: transactional single execution of `checkoutBooking` (legacy client writer, no server guard);
  registered-client checkout side effects; the UI message when `salownCreateStaffWalkIn` is missing.
- **Finding (pre-existing, live Phase 1 too):** Staff New Booking interprets date/time in Europe/London regardless
  of the tenant timezone (`salownCreateStaffBooking` wrapper `timeZone: 'Europe/London'`, `londonMs`). Non-London
  tenants get a different instant and a conflict check at that instant; Walk-in uses the tenant timezone. Not
  fixed, not scoped.

## 7. Local environment — processes, ports, browser

**Nothing is running now.** At writing: no listeners on 8080/9099/5001/4400/9150/5199, no emulator or Vite
process, no Chrome tab group for this session. All were stopped at the end of round 2 (last PIDs 4768 firebase
`emulators:start`, 4831 Firestore Java, 4897 Vite — terminated). Emulator data was in memory and is gone.
Capture: `docs/evidence/staff-avail-gap-p2/2026-09-14-handoff-state/handoff-state.txt`.

Scratch directories (session-specific `/private/tmp/claude-501/-Users-alish/1b4e7c9f-b90b-4cb4-9da8-c744b257a970/scratchpad/`,
may be deleted by the OS — not authoritative; not cleaned by this session):

| Dir | What |
|---|---|
| `relws/salown-app` | git clone detached at `9ea0aca` (round-2 release workspace); only `hosting/staff-bundle/**` rewritten by the build |
| `p2app2` | rehearsal copy of `9ea0aca`, `src/firebase.ts` emulator-wired (project `demo-c1`), `functions/lib` built — served Chrome round 2 |
| `oldws/salown-app` | `git archive 797c9b3` (live Phase-1 source), `functions/lib` built — compat matrix |
| `guardws/salown-app`, `archive-9ea0aca`, `p2app` | earlier archive/guard/round-1 copies |

To restart a Chrome rehearsal (only if a check needs it): Java `export JAVA_HOME=/opt/homebrew/opt/openjdk
PATH="$JAVA_HOME/bin:$PATH" JAVA_TOOL_OPTIONS=-Xmx512m`; in the rehearsal copy
`./functions/node_modules/.bin/firebase emulators:start --only auth,firestore,functions --project demo-c1`
(ports: Firestore 8080, Auth 9099, Functions 5001, Hub 4400, UI ws 9150); after it is ready,
`npx vite --config vite.staff.config.js --port 5199 --strictPort --host 127.0.0.1`. Seed/snapshot/diff helpers:
`docs/evidence/staff-avail-gap-p2/2026-09-14-handoff-state/tools/*.mjs` (they read the synthetic account password
from `P2_TEST_PASSWORD`; choose any value when seeding — it is emulator-only and not recorded anywhere). Traps
met: 8 GB RAM (close other apps; start Vite only after the emulators), Vite reloads the page the first time it
optimises a dependency (warm the page before recording), the shared-tree dev server must never be restarted,
`ops/test-emulator.sh` also needs port 8080 (never run it while a rehearsal emulator is up).

## 8. Owner decisions — recommendations only, NOT approved

From `20-owner-decision-recommendations.md`:
1. Walk-in↔Reschedule race criterion → recommended: defer to Phase 3 explicitly. **Not approved.**
2. Admin `salownCreateWalkIn` staff bypass → recommended: written named exception for this release, then gate the
   Admin callable for the `staff` role only. Denying `staff` outright would break staff walk-ins from Admin Calendar
   and Clients quick book. **Not approved.**
3. Claim while `firestore.rules` bypass is open → only "Phase 2 Walk-in callable transition published", with the
   bypasses named. **Not approved.**
4. Staff notice (EN/TR draft) — **not sent.**
5. Rollback keeping the callable alive: sufficient for data correctness; no drain signal, offline devices, and no
   effect on old-bundle tabs at release time.

## 9. First concrete step for the next session

1. Read this file and the rules in §2; `git fetch` both repos; confirm HEADs, `./ops/claims/claims.sh list`, and
   that no emulator/Vite process or port from §7 is running.
2. **Prepare the stale-test fix as a patch, outside the shared tree:** fresh `git clone --no-hardlinks
   ~/Desktop/alex/salown-app` into the new session's scratchpad, detach at `9ea0aca`, symlink `node_modules`.
   Update only `src/staff/lib/staffPostWriteBoundary.test.ts` so the WalkInFlow boundary assertion matches the
   `createWalkInEnforced` structure without weakening the rule (expected shape: `await createWalkInEnforced(` ×2,
   the awaited `createSaleBooking` and the override resubmission confined to `createWalkInEnforced`, one
   `checkoutBooking`, and no create/checkout/package-link/product-sale call inside any `afterWriteSucceeded`
   block — see `12-scratchBoundaryInvariant.test.ts`).
3. In that clone run the single file, then the full `npx vitest run`; expected remaining failures: only the two
   environment negative controls. Save `git diff` as a `.patch` plus both logs into a new evidence run folder and
   update/verify the manifests.
4. Report the patch; do not commit it to the shared tree without a claim and an explicit go-ahead. After it lands,
   the new commit is the next candidate SHA and the §4 round-2 gates must be re-run for it.
