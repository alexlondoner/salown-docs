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

## 4. Not done — explicitly, so it isn't assumed

- No full-gate re-run.
- No comparison against a prior known-good source run in the same environment (candidate next
  step if the owner wants one — needs a source with a completed, evidence-backed emulator-gate
  pass to diff against; `9ea0aca`'s round-2 685/682 result predates this machine's current load
  conditions and was not captured with this level of process/timing detail, so it is not a
  like-for-like comparison without re-running something).
- No aggregate/multi-file contention test (a bounded step between "one file alone" and "the whole
  gate" — e.g. running just the handful of files most likely to carry their own concurrency tests,
  found by grepping for `Promise.all` across `functions/src/**/*.emulator.test.js`, together against
  one shared emulator, with the SAME real-wall-clock-capped, durable-log design as above). Proposed,
  not run.
- No deploy, no production access, at any point in this diagnosis.

## 5. Files in this folder

| File | Contents |
|---|---|
| `01-executor-test-output.log` | `node --test`'s real stdout/stderr for the single-file run — durable, complete |
| `02-firestore-emulator.log` | The Firestore emulator's own log for that run — durable, complete |
| `03-diag-watch.log` | The diagnostic watchdog's own real-wall-clock check-ins |
| `04-full-gate-attempt-2-watch.log` | Attempt 2's watch log, as actually written (survived; attempt 1's was overwritten by reusing the same path — noted, not repeated here) |
| `05-full-gate-attempt-1-watch-reconstructed.log` | Attempt 1's watch/gate-log content, reconstructed verbatim from the session transcript since the live file was overwritten by attempt 2 reusing the same filename |
