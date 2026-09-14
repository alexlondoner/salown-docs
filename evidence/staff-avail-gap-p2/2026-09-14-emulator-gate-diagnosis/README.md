# Emulator-gate diagnosis — two full-gate attempts INCOMPLETE, single-file diagnostic clean

Written 2026-09-14 ~19:58 UK, at the owner's explicit direction after two full two-phase
`ops/test-emulator.sh` attempts against `aa2efd9` produced no PASS, no FAIL, and no confirmed
cause. **Neither prior attempt is evidence of a RAM/thrash-caused stall — that claim is retracted
here.** This folder is the narrow diagnosis the owner asked for instead of a third full-gate
attempt: don't wait longer, find out which operation isn't finishing and why.

## 1. The two full-gate attempts — both INCOMPLETE, not PASS/FAIL, not RAM-confirmed

| # | Log | What happened |
|---|---|---|
| 1 | `05-full-gate-attempt-1-watch-reconstructed.log` | Killed by Monitor's own 35-minute timeout after printing only its startup lines. **Root cause of the silence, found afterward:** the watchdog's logging piped through `tee` to a non-tty consumer, which fully-buffered instead of line-buffered — any check-ins the loop performed were sitting in a buffer and lost when the process was hard-killed rather than exiting and flushing. Whether the loop ran normally the whole time and was merely invisible, or never executed, cannot be determined after the fact. **INCOMPLETE, not a stall observation.** |
| 2 | `04-full-gate-attempt-2-watch.log` | The buffering bug was fixed; check-ins DID stream this time. But the "30-minute cap" in that version counted `sleep 60`-based loop *iterations*, not real elapsed time — and iterations were taking far longer than 60s in real time on this loaded system (gaps of 60s, 24min, 60s, 60s, 60s between prints), so the script's own counter only reached "5 counted minutes" after 33 REAL minutes had passed. Monitor's own external 33-minute timeout is what actually stopped it, not the script's logic. **During that window: one burst of 124% CPU, then several checks at 0-1% CPU while running `src/inventory/executor.emulator.test.js` — but swap never grew (flat at ~814-822M throughout, never exceeding the 100MB-growth stall threshold).** No memory-pressure signature. Also **INCOMPLETE** — killed mid-run by an external timeout, not a designed stop, and no pass/fail conclusion is available because the test's own live output lives in an ephemeral directory the wrapper script deletes on exit (`trap ... EXIT`), which was lost when the process was killed. |

**Conclusion from these two attempts: nothing.** No confirmed cause, no confirmed pass, no
confirmed fail, no confirmed RAM/swap involvement. Both are recorded here purely as INCOMPLETE
attempts with known tooling bugs, not as findings about the product or the gate.

## 2. Single-file diagnostic — `src/inventory/executor.emulator.test.js` alone: PASSED, 20/20, ~3 minutes

Design, per the owner's brief:
- **Isolated clone**, never the shared tree: `git clone --no-hardlinks --shared` of `salown-app` at
  `e639a1c` (= `aa2efd9` + two docs-only commits, no source difference), `node_modules` symlinked,
  `npm run build` run fresh in the clone.
- **Same pinned toolchain** as the real gate: `firebase-tools 15.26.0`, `cloud-firestore-emulator-v1.22.0.jar`
  (verified against the clone's own `functions/node_modules/firebase-tools/lib/emulator/downloadableEmulatorInfo.json`),
  same `JAVA_TOOL_OPTIONS=-Xmx512m` heap cap, same `node --test --test-concurrency=1`.
- **No test expectations loosened, nothing skipped** — the file's real Firestore-emulator-backed
  suite ran exactly as written (`FIRESTORE_EMULATOR_HOST` set, the file's own self-skip guard for
  that unset case never triggers here).
- **Durable logs from the start**, not the wrapper's self-deleting `mktemp -d`: the Firestore
  emulator was started directly (`emulators:start`, not `emulators:exec`) with its own log
  redirected straight to a persistent file (`02-firestore-emulator.log`), and `node --test`'s
  stdout/stderr likewise redirected straight to a persistent file (`01-executor-test-output.log`)
  from the moment each process launched — both survive regardless of how the run ends.
- **Real wall-clock time limit**, not an iteration counter: `start_epoch=$(date +%s)` captured once;
  every check computes `$(date +%s) - start_epoch` fresh. Verified working correctly this run — the
  printed `real_elapsed` values (23s, 100s, 120s, 140s, 160s, 180s) are internally consistent with
  the 20-second check interval and match real wall-clock time, unlike attempt 2's broken counter.
- **On a hypothetical time-cap hit**: the script saves a full snapshot (`ps` tree, `lsof` on the
  test process, `lsof -iTCP:8080`, memory/swap, and a Node `--report-signal=SIGUSR2` diagnostic
  report if the process honors it) to `snapshot-at-limit/` *before* stopping anything, and stops
  only the processes it itself started (identified by PID, never a blanket pattern-kill of
  unrelated processes). **Not exercised this run — the file finished naturally, well under the
  600-second cap, so no snapshot exists; this describes the design, not an observed event.**

**Result — `01-executor-test-output.log`:** `tests 20, pass 20, fail 0, duration_ms 159996.5`
(≈2m40s reported by node itself; ≈3m0s including emulator startup and process teardown by the
watchdog's own wall clock). **`02-firestore-emulator.log` contains no error/exception/abort lines.**

### Where the time actually went

| Test | Duration |
|---|---|
| EMU 5a: two concurrent SAME-mutation attempts (x8 rounds) | **88,183.8 ms** |
| EMU 5b: two concurrent DIFFERENT mutations (x8 rounds) | **25,253.1 ms** |
| EMU 5c: high-concurrency stampede, 6-way (x4 rounds) | **21,351.4 ms** |
| EMU 8a: concurrent decrement, retry-safety | **22,928.9 ms** |
| every other test (16 of them) | 8 ms – 1.7 s each, ~2.2s combined |

The four concurrency-race tests account for **~157.7s of the ~160s total** — essentially the
entire runtime of the file. This is real, measured Firestore-transaction-contention latency (the
emulator retrying real optimistic-concurrency conflicts under real backoff), not a hang: every one
of these tests completed and passed. `ops/test-emulator.sh`'s own header documents that the pinned
emulator version (`v1.22.0`) **contends harder, not less, than the previous version** — "687
ABORTED and 229 transaction retries" in its own isolated probe — specifically so that a genuine
race is classified retryable instead of a false permanent failure. High per-test latency under
deliberate concurrent contention is that fix's known, accepted cost, not a defect newly introduced
here.

## 3. What this does and does NOT establish

**Does establish:** this specific file is not broken, does not hang, and is not a "stuck forever"
case in isolation — it is *slow* (dominated by its own deliberately-concurrent tests), and that
slowness is bounded (real, measured, ~3 minutes) and explainable by documented emulator behavior,
not a mystery.

**Does NOT establish** why the full two-phase gate (running this file together with ~20 other
`*.emulator.test.js` files under one shared Firestore emulator instance, since `--test-isolation=process`
gives each FILE its own process but all of them contend on the SAME emulator) stalled or appeared
to stall in either full-gate attempt. The leading, *unverified* hypothesis: several files across
the "general" phase glob (`src/bookings/*`, `src/staff/*`, `src/sales/*`, etc.) likely contain
similar concurrent-transaction tests of their own; if enough of them land in the same real-time
window, their retry/backoff contention against the one shared emulator could compound well beyond
any single file's own ~3-minute cost — plausibly enough to look like a stall from outside, even
without any process actually being stuck. **This has not been tested and is not asserted as the
cause.** Per the owner's explicit instruction, the full gate is not being re-run to test it without
a scoped step in between.

## 3a. Round 2 — subset diagnostic, per owner-approved scope (2026-09-14 ~20:4x UK)

Owner-approved 3-point scope: (1) verify sequential-vs-parallel execution to reconcile with the
aggregate-contention hypothesis, (2) identify files preceding `executor.emulator.test.js` in the
real gate order and run a small subset with it under the same settings, (3) investigate cross-file
data/connection/teardown effects with durable logs. No expectations loosened, nothing skipped, full
gate not started, no production access.

**Point 1 — sequential vs. parallel, empirically verified.** Two throwaway test files, one with
`--test-concurrency=1` and one without: with the flag, file B's first line printed only after file
A's last line (a ~65ms gap, zero overlap); without it, both files' first lines printed within 2ms of
each other. **Confirmed: `--test-concurrency=1` (used by the real gate) makes files run strictly
one-at-a-time, never in parallel with each other.** This directly **refutes §3's "aggregate parallel
contention across ~20 files" hypothesis as stated** — files cannot contend with each other at the
same instant under this setting, so if there is a cross-file effect at all, it cannot be simultaneous
resource contention between files; it would have to be a *sequential carry-over* effect (leaked
state, degrading JVM/emulator health run-over-run) instead.

**Point 1a — a second, more consequential ordering finding, found while building the subset.**
`node --test`, given multiple file arguments, does **not** execute them in the order listed on the
command line (or in glob-expansion order) — it runs them in **alphabetical order by full path**,
confirmed by direct observation: 5 files were passed in the order
`blocks, createWalkIn, importAssignment, rotaWriter, executor`, but the actual execution order in the
log was `blocks → createWalkIn → executor → importAssignment → rotaWriter` — exactly alphabetical
(`bookings/blocks` < `bookings/createWalkIn` < `inventory/executor` < `parsers/importAssignment` <
`staff/rotaWriter`). **This means the original handoff's mental model of "gate order" (reading
`PHASE1_GLOBS` left to right: bookings, parsers, staff, inventory, …) does not describe what
actually runs before `inventory/executor.emulator.test.js`.** The real preceding set, by directory
alphabetical order (`bookings < checkout < finance < inventory < parsers < payments < sales < staff
< tenants < treatmentSessions`), is only:

| Directory | Files preceding `inventory/executor.emulator.test.js` |
|---|---|
| `bookings/` | `blocks`, `createAdminBooking`, `createBooking`, `createStaffBooking`, `createStaffWalkIn`, `createWalkIn`, `reassignBooking` (7) |
| `checkout/` | `checkoutSettings`, `executor` (2 — note: a DIFFERENT `executor.emulator.test.js`, in `checkout/`, not the inventory one) |
| `finance/` | `periodClose` (1) |

**10 files total**, not the 20 originally assumed (which wrongly included `parsers/` and `staff/`,
both of which actually run AFTER `inventory/` alphabetically, not before).

**Point 2 — subset run.** 5 files, spanning the real order: `bookings/blocks.emulator.test.js`,
`bookings/createWalkIn.emulator.test.js`, `parsers/importAssignment.emulator.test.js`,
`staff/rotaWriter.emulator.test.js`, `inventory/executor.emulator.test.js` — run together as ONE
`node --test --test-concurrency=1` invocation against ONE shared emulator (matching the real gate's
design exactly), same pinned toolchain/heap. Actual order per point 1a:
blocks → createWalkIn → **executor** → importAssignment → rotaWriter.

**Result: 79/79 PASS, 166s total (`duration_ms 158064.4`), rc=0.** No failures, no hang.

**Executor's own timing, run 3rd in this sequence, compared to running totally alone (round 1):**

| Test | Standalone (round 1) | In this 5-file subset | Δ |
|---|---|---|---|
| EMU 5a | 88,183.8 ms | 22,377.0 ms | **~4x faster** |
| EMU 5b | 25,253.1 ms | 22,292.4 ms | ~same |
| EMU 5c | 21,351.4 ms | 12,950.7 ms | faster |
| EMU 8a | 22,928.9 ms | 19,024.3 ms | ~same/faster |
| **executor file total** | ~160 s | **~79 s** | **~2x faster** |

Nothing got slower when preceded by other files — most got faster or stayed the same. This is
evidence AGAINST a cross-file degradation effect for this specific sequence, and evidence FOR high
inherent run-to-run variance in these contention-based tests (the same test, same code, same
machine, differing by up to 4x between two runs minutes apart) — consistent with real Firestore
transaction retry/backoff timing being sensitive to exact scheduling, not a symptom pointing at any
particular file ordering.

**Point 3 — cross-file connection/memory tracking, sampled every 10s for the full 166s run.**
`lsof -iTCP:8080` established-connection count to the Firestore emulator: **flat at 2 for the entire
run**, dropping to 0 only after teardown at the very end. Firestore emulator JVM RSS: fluctuated
262–317 MB with no upward trend — it was actually LOWER in the second half of the run (262–279 MB)
than the first (297–317 MB), consistent with normal GC, not accumulation. **No connection leak, no
memory growth signature across these 5 files.**

### What round 2 establishes and does not

**Establishes:** the "aggregate PARALLEL contention" hypothesis from round 1 is wrong (files never
run concurrently under `--test-concurrency=1`); `node --test`'s real execution order is alphabetical,
not glob-written order, which changes what "preceding files" even means; the file set genuinely
tested here (2 real predecessors + 2 non-predecessors + the target) shows no cross-run degradation
and no resource-leak signature; the timing variance in the contention tests themselves is large
enough (4x) to be the dominant unexplained factor.

**Does not establish:** what happens with the FULL 10-file real predecessor set (only 2 of the 7
`bookings/` files were actually tested here, and `checkout/`+`finance/`'s 3 files were not tested at
all); whether variance of this magnitude, compounded across many files' own contention tests
sequentially (not in parallel — additive, not simultaneous), could plausibly sum to the scale of the
original incident's duration; nor anything about the ~20 files that run AFTER `inventory/` in the
real order, several of which (per round 1's grep) also contain their own `Promise.all`-based
concurrency tests and were never part of either incident's implicated file.

## 3b. Round 3 — full systematic run: Steps 1-2 clean (655/655, matches historical baseline exactly), Step 3 finds and isolates a genuine, non-reproducing stall

Owner-directed, no further check-ins requested mid-run. Three steps, executed in order, with the
explicit rule that subsets passing does not substitute for the full gate — Step 3 (the full gate)
was always the target, not optional.

**Step 1 — all 10 real predecessors + `inventory/executor.emulator.test.js` (11 files), one
`node --test` invocation, one shared emulator, order OBSERVED (not assumed) via live process-argv
polling every 5s.** Observed order matched alphabetical again, but this run treats that as measured,
not guaranteed. **Result: 303/303 PASS, `duration_ms 265174.2` (~4m25s), rc=0.** `executor`'s own
contribution: ~71s (faster than both round 1's 160s alone and round 2's 79s in a 5-file subset —
consistent with round 2's finding that nothing here degrades with more preceding files).

**Step 2 — the 20 remaining `PHASE1_GLOBS` files not covered by Step 1** (`inventory/reconcile`,
`parsers/` both files, `payments/`, `sales/`, `staff/` all 11, `tenants/`, `treatmentSessions/` both
files, the `.cjs` script), same mechanism. **Result: 352/352 PASS, `duration_ms 240267.3` (~4m00s),
rc=0.** 303 + 352 = **655 tests — exactly matching the historical known-good general-phase baseline**
recorded for `9ea0aca` (`03-emulator-gate-two-phase.log`: "tests=655 pass=655 fail=0"). Both splits
clean, zero failures, no stall in either.

**Step 3 — the full real two-phase gate, all 31 general + 1 packages file, in ONE continuous
`node --test` invocation per phase** (replicating `ops/test-emulator.sh` exactly, but with durable
logs instead of its self-deleting `mktemp -d`, and a REAL epoch-seconds time cap — 1800s for
`general`, informed by Steps 1+2's measured 520s combined, not a guess). **Found a genuine, isolated
stall, proven with hard evidence:**

- `src/bookings/createAdminBooking.emulator.test.js:88`, test `'ADMIN EMU: two concurrent
  same-barber overlapping Admin requests → one ALLOWED + one SLOT_CONFLICT, one booking'`, took
  **1,700,752.35 ms (≈28 minutes 21 seconds)** — see `16-step3-general-test-output.log`. Confirmed by
  file:line via direct source grep, not inferred from test-name pattern-matching.
- **This is the first time this file was exercised anywhere in this whole diagnosis** — it was never
  part of round 1's single-file check, round 2's 5-file subset, or Step 1 (it is one of the 10 real
  predecessors, but Step 1's file list happened not to include it — corrected in this reproduction
  step).
- **Ruled out, with direct measurement, not assumption:** server-side transaction
  contention/retry. The Firestore emulator's own `FINE`-level debug log
  (`20-step3-firestore-debug-FULL.log`, recovered from `functions/firestore-debug.log`, which
  `ops/test-emulator.sh` never surfaces) shows lock-timeout/retry warnings clustered at
  21:10:38-21:11:16 PM (`blocks.emulator.test.js`'s own already-known concurrent tests) — then
  **complete silence, zero log lines of any kind, for the entire stall window, 21:11:16 to 21:39:33
  PM (~28m17s)**. The emulator was not doing anything. This rules out "the server was retrying hard"
  as the mechanism for this specific stall — whatever was stuck was on the client
  (Node/firebase-admin/gRPC) side, or on the connection between them, not inside Firestore's
  transaction engine.
- The gate's own time cap correctly fired afterward (at 1801s, mid-`reassignBooking`), saved a full
  snapshot (`18-step3-snapshot-at-limit.txt`: ps tree, `lsof:8080`, tail of both logs, memory/swap)
  BEFORE killing anything, and stopped only the processes this run itself started. Execution had
  already resumed completely normally for the four files after the stalled one
  (`createBooking`/`createStaffBooking`/`createStaffWalkIn`/`createWalkIn`, each 5-15s, matching
  every prior measurement) — this was not a cascading or worsening failure, one single test spent
  almost the entire time budget and the run was healthy on both sides of it.

**Reproduction check — `createAdminBooking.emulator.test.js` run alone, immediately after, same
toolchain/settings, this time with live CPU/memory/swap/connection sampling every 10s (the one gap
in Step 3's instrumentation).** **Did not reproduce.** The identical test took **3,598.0 ms** —
**473x faster** than Step 3's 1,700,752.35 ms. The whole file: 9/9 PASS, `duration_ms 12411.3`
(~12.4s), rc=0. Swap held flat (782.38M, both samples) during the run; `unused` RAM was tight (68-
120MB) but nothing grew, and nothing stalled despite that.

### What round 3 establishes

- **A definitive, evidence-backed instance of "which operation, and proof it isn't a hang":** one
  specific test, in one specific file, took 473x longer than normal exactly once, with the emulator
  provably idle throughout — then never reproduced under identical conditions immediately after.
- **This is not the same file the original 2026-09-13 incident named** (`inventory/executor.emulator.test.js`,
  round 1 of this diagnosis, cleared). It is a DIFFERENT file, in a DIFFERENT part of the file order,
  that had never been tested until Step 3.
- **Neither RAM/swap growth nor server-side contention is confirmed as the cause** — both were
  directly checked (swap flat before/after in the reproduction run; the emulator's own debug log
  proves zero server activity during the stall itself) and neither shows the expected signature. The
  actual mechanism (a stuck gRPC channel, a client-side hang, a scheduling anomaly on this specific
  machine) remains unidentified — this is reported as an open, unexplained, non-reproducing
  transient, not attributed to a cause that wasn't measured.
- **The full gate is NOT yet confirmed PASS or FAIL end-to-end.** Step 3's `general` phase was
  stopped by its own time cap partway through `reassignBooking` (file 27 of 31) specifically because
  the one pathological test consumed almost the entire 1800s budget; `packages` was never reached.
  Steps 1+2 together prove all 31 general-phase files pass with correct results (655/655) when
  split into two runs; Step 3 proves the same files pass when run continuously too, MINUS the time
  lost to one non-reproducing anomaly.

## 3c. Round 4 — Step 3 retried, a SECOND and THIRD distinct anomaly found, neither reproduces either

Since Step 3's `createAdminBooking` stall did not reproduce in isolation, Step 3 (the full
continuous two-phase gate) was retried from a clean state to see if it would complete now. It did
not — it hit a **different** anomaly this time, and along the way exposed a genuine (but also
non-reproducing) assertion failure. Both were checked in isolation afterward.

**`finance/periodClose.emulator.test.js` — a real assertion FAILURE, not just slowness:**
`✖ R21. the read→commit window is EMPTY — the writer cannot cross it` failed after
**323,843.15ms (~5m24s)** — see `25-step3retry-general-test-output.log`. R21's own design
(`src/finance/periodClose.emulator.test.js:619`) holds a transaction at its commit barrier for an
intentional, hard-coded `HOLD_MS = 2000` (2 seconds) and asserts a competing write cannot land
inside that window. 323.8 seconds is nowhere close to the test's own 2-second design — something
well outside the test's own logic caused the delay. **Reproduction check
(`31-repro3-periodclose-test-output.log`): run alone, R21 PASSED at 2,122.27ms — its designed
duration almost exactly (the diagnostic even reads `window held 2000ms · writer committed inside
it = false · writer committed 6ms after the window closed`, textbook-correct). 31/31 pass. Does
NOT reproduce.**

**`src/treatmentSessions/integration.emulator.test.js` — a genuine HANG, not just slowness, proven
by Node's own diagnostic, not inferred:** Node's file-level failure report reads verbatim:
`✖ src/treatmentSessions/integration.emulator.test.js (1,379,525.89ms)` immediately followed by
`'Promise resolution is still pending but the event loop has already resolved'` — Node's own
language for "this file was killed with an unresolved promise still outstanding." **This is
qualitatively different from the other two anomalies: it never would have finished on its own
within the observed window; it required external termination.** (The initial live process-argv
polling misattributed this ~23-minute gap to `rotaWriter.emulator.test.js`, which was actually
fast and complete, all 24 of its own tests present and normal in the log — a real limitation of
that detection method, corrected here by finding Node's own definitive file-level report instead of
trusting the poller.) **Reproduction check (`29-repro2-integration-test-output.log`): run alone,
finished in 7.2 seconds, rc=0, 15/15 pass — 191x faster. Live CPU/mem/swap sampling
(`30-repro2-integration-mem-swap-samples.log`) shows nothing unusual in the one sample taken. Does
NOT reproduce.**

### What round 4 establishes

- **Three anomalies now found across two full-gate attempts, in three different files, at three
  different points in the file order** (`bookings/createAdminBooking`, `finance/periodClose`,
  `treatmentSessions/integration`) **— and NONE of the three reproduces when the same file is run
  alone immediately afterward, under identical settings.** This is now a pattern, not a coincidence:
  each full-gate attempt encountered exactly one such event, consuming most or all of that attempt's
  time budget, while isolated single-file runs of the very same files are consistently fast and
  clean.
- **This pattern is consistent with a low-probability, per-unit-time stochastic event** (on this
  specific machine, in this specific long-running session) whose chance of firing during any given
  short (10-90 second) isolated file run is low, but which has a meaningful chance of firing
  somewhere across a ~10-40 minute continuous multi-file run — rather than a deterministic defect
  tied to any specific test, file, or product code path. It is reported as exactly that: an
  observed pattern, not a diagnosed root cause.
- **Neither RAM/swap growth nor sustained server-side contention is confirmed as the mechanism for
  any of the three** — each was checked (the emulator's own debug log for `createAdminBooking`;
  live swap sampling for the `integration` reproduction attempt; nothing anomalous in either). The
  actual mechanism (OS-level scheduling, a JVM GC pause, a gRPC channel/keepalive edge case, or
  something specific to this machine after hours of continuous emulator/JVM/Node churn across many
  consecutive test runs) remains genuinely unidentified.
- **The full gate has still not completed as one clean, uninterrupted, continuous run within any
  time budget tried, across two attempts.** Both attempts' `general` phase failed to reach
  `packages`. This is the honest, current state — it is not being reported as a pass.

## 4. Not done — explicitly, so it isn't assumed

- **The full gate has not completed cleanly end-to-end, in either of two attempts.** Both times, one
  anomaly (different each time) consumed the time budget before all 31 general-phase files plus the
  1 packages file could run to completion in one continuous invocation. A third attempt was not
  made — the pattern from two attempts plus three independent non-reproductions was judged
  sufficient evidence to report rather than keep re-running blind.
- No comparison against a prior known-good source run in the same environment (candidate next
  step if the owner wants one — needs a source with a completed, evidence-backed emulator-gate
  pass to diff against; `9ea0aca`'s round-2 685/682 result predates this machine's current load
  conditions and was not captured with this level of process/timing detail, so it is not a
  like-for-like comparison without re-running something).
- No deeper instrumentation of the stochastic anomaly itself (no `strace`/`dtrace`, no
  `GRPC_TRACE`/`GRPC_VERBOSITY`, no attempt on a different/fresher machine) — each of the three
  occurrences was investigated after the fact from the durable logs already being captured, not
  chased live with additional tooling armed in advance.
- No deploy, no production access, at any point in this diagnosis.

## 5. Files in this folder

| File | Contents |
|---|---|
| `01-executor-test-output.log` | Round 1: `node --test`'s real stdout/stderr for the single-file run — durable, complete |
| `02-firestore-emulator.log` | Round 1: the Firestore emulator's own log for that run — durable, complete |
| `03-diag-watch.log` | Round 1: the diagnostic watchdog's own real-wall-clock check-ins |
| `04-full-gate-attempt-2-watch.log` | Attempt 2's watch log, as actually written (survived; attempt 1's was overwritten by reusing the same path — noted, not repeated here) |
| `05-full-gate-attempt-1-watch-reconstructed.log` | Attempt 1's watch/gate-log content, reconstructed verbatim from the session transcript since the live file was overwritten by attempt 2 reusing the same filename |
| `06-subset-test-output.log` | Round 2: `node --test`'s real stdout/stderr for the 5-file subset run — durable, complete, 79/79 pass |
| `07-subset-firestore-emulator.log` | Round 2: the Firestore emulator's own log for the subset run |
| `08-subset-resource-samples.log` | Round 2: TCP:8080 established-connection count + Firestore JVM RSS, sampled every 10s across the whole run — the cross-file leak/teardown evidence (§3a point 3) |
| `09-subset-watch.log` | Round 2: the diagnostic watchdog's own real-wall-clock check-ins for the subset run |
| `10-step1-test-output.log` | Round 3 Step 1: `node --test` output for the 11-file run (10 real predecessors + `inventory/executor`) — 303/303 pass |
| `11-step1-observed-file-order.log` | Round 3 Step 1: observed (not assumed) per-file start/end times from live process-argv polling |
| `12-step1-watch.log` | Round 3 Step 1: the watchdog's own check-ins |
| `13-step2-test-output.log` | Round 3 Step 2: `node --test` output for the 20 remaining files — 352/352 pass (303+352=655, matches the historical general-phase baseline exactly) |
| `14-step2-observed-file-order.log` | Round 3 Step 2: observed per-file start/end times |
| `15-step2-watch.log` | Round 3 Step 2: the watchdog's own check-ins |
| `16-step3-general-test-output.log` | Round 3 Step 3: `node --test` output for the FULL continuous 31-file general phase — contains the 1,700,752.35ms `createAdminBooking` stall's exact line |
| `17-step3-general-observed-file-order.log` | Round 3 Step 3: observed per-file order/timing, including the anomalous gap |
| `18-step3-snapshot-at-limit.txt` | Round 3 Step 3: full state snapshot (ps tree, `lsof:8080`, log tails, memory/swap) captured the instant the 1800s cap fired, before anything was killed |
| `19-step3-watch.log` | Round 3 Step 3: the watchdog's own check-ins, including the file-order gap around the stall |
| `20-step3-firestore-debug-FULL.log` | Round 3 Step 3: the Firestore emulator's `FINE`-level debug log (`functions/firestore-debug.log`, not surfaced by `ops/test-emulator.sh`) — the direct proof of zero server activity during the stall |
| `21-repro-test-output.log` | Round 3 reproduction check: `createAdminBooking.emulator.test.js` alone — 9/9 pass, the same test at 3,598.0ms (vs. 1,700,752.35ms) |
| `22-repro-mem-swap-samples.log` | Round 3 reproduction check: live CPU/memory/swap/connection samples every 10s — the instrumentation gap from Step 3, filled in here |
| `23-repro-firestore-debug-full.log` | Round 3 reproduction check: the emulator's debug log for the non-reproducing run |
| `24-repro-watch.log` | Round 3 reproduction check: the watchdog's own check-ins |
| `25-step3retry-general-test-output.log` | Round 4: the SECOND full-gate `general`-phase attempt — contains both the `periodClose` R21 failure (323,843.15ms) and the `treatmentSessions/integration` hang (1,379,525.89ms, with Node's own "Promise resolution is still pending" diagnostic) |
| `26-step3retry-general-observed-file-order.log` | Round 4: observed per-file order/timing for the second attempt (includes the polling misattribution to `rotaWriter`, corrected in §3c by reading Node's own file-level report instead) |
| `27-step3retry-snapshot-at-limit.txt` | Round 4: full state snapshot captured when the second attempt's cap fired |
| `28-step3retry-watch.log` | Round 4: the watchdog's own check-ins for the second attempt |
| `29-repro2-integration-test-output.log` | Round 4: `treatmentSessions/integration.emulator.test.js` alone — 15/15 pass, 7.2s, does not reproduce the hang |
| `30-repro2-integration-mem-swap-samples.log` | Round 4: live CPU/memory/swap/connection samples for that reproduction attempt |
| `31-repro3-periodclose-test-output.log` | Round 4: `finance/periodClose.emulator.test.js` alone — 31/31 pass including R21 at its designed 2,122.27ms, does not reproduce the failure |
