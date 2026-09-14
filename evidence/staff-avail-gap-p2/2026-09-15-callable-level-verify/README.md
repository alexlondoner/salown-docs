# STAFF-AVAIL-GAP-P2 — round 12 full-gate result + callable-level (no-Chrome) verification

2026-09-15 ~00:1x-00:3x BST. Isolated `git clone --no-hardlinks` of `salown-app`, checked out
detached at `aa2efd9` (`WALKIN-BACKDATE-FLOOR: remove untouched-time Save & Checkout 09:00 floor`),
under `/private/tmp/.../scratchpad/staff-avail-gap-p2/clone-aa2efd9`. No shared-tree source edit,
no deploy, no production access at any point. Claim: `STAFF-AVAIL-GAP-P2-VERIFY` (salown-app
`ops/claims/`), released at end of this session.

## 1. Round 12 — full two-phase `ops/test-emulator.sh`, one continuous run, **PASS**

First time in this diagnosis (rounds 1-11, see `../2026-09-14-emulator-gate-diagnosis/`) that the
**actual repo script** — not a manual re-split of its file globs — completed as one uninterrupted
invocation.

**Exact figures, read from `round12-full-gate.log` (copied here verbatim, 26 lines, nothing
elided):**

| Phase | tests | pass | fail | phase exit code |
|---|---|---|---|---|
| `general` | 655 | 655 | 0 | 0 |
| `packages` | 27 | 27 | 0 | 0 |
| **TOTAL** | **682** | **682** | **0** | — |

- The script's own final line: `RESULT   : PASS`.
- `GATE_EXIT=0` — this is `ops/test-emulator.sh`'s own exit status, captured by `$?` immediately
  after it returned, not the wrapper shell's exit status (which is a separate, later `echo`/`touch`
  and would say nothing about the gate itself). Reproduced in full in the log's last 6 lines.
- Wall-clock: build+general+packages, start `23:05:09Z` → end `23:15:36Z` UTC — **~10m27s**, not a
  ~28-minute stall like round 8/10's attempts.
- **655 = the exact historical baseline** recorded for `9ea0aca` (rounds 5/6/9/10/11) and for the
  split two-group runs earlier in this same diagnosis (runs #5+#6, 303+352).

**What this harness does NOT tell you, and neither does `ops/test-emulator.sh` itself:**
`node --test`'s own summary lines only ever report `tests`/`pass`/`fail` counts to the script's
`run_phase` grep (that's all it parses) — **skip/cancelled/todo counts are not captured by this
gate at all**, in this run or in any prior one. The **raw per-test `node --test` output** (which
would show individual skip/cancel lines if any exist) was written by the script to its own
`mktemp -d` phase logs, and the script's own `trap 'rm -rf "$TMP"' EXIT` **deletes those logs
whenever both phases pass** (it only preserves them on failure, copying to
`${TMPDIR}/emulator-gate-failure/`) — by the script's design, not an omission of this session. So
for a clean PASS like this one, only the phase-level `tests/pass/fail` totals survive; the
individual-test raw log does not. If skip/cancelled granularity is needed, the gate would need to
be re-run with `$P1_LOG`/`$P2_LOG` redirected to a durable path outside the script's own trap —
not done here, since a 682/682 clean pass gave no reason to suspect a hidden skip.

**Resource sampling caveat (round12-sampler-raw.log, kept for completeness, methodological note
only):** the sampler's own `pgrep -f cloud-firestore-emulator` picked up **its own external
reaper's** `sleep`/watchdog shell process instead of the real JVM — that shell's own script text
*contained* the literal string `cloud-firestore-emulator` (inside its own `pkill -f
"cloud-firestore-emulator"` line), which `pgrep -f` matches against full command-line text. The
"java: ... rss=640-784" lines in that log are **not the Firestore emulator** — confirmed by `ps -p`
after the run: the real emulator process was already gone, and PID had been the reaper's zsh the
whole time. Node fd-count and swap-usage lines are unaffected by this bug and show no growth over
the ~10-minute run. This is flagged here rather than silently corrected because it means round 12
adds **no new resource-usage evidence** about the emulator process itself beyond what rounds 8-11
already established (no swap growth, no fd leak on the Node side) — the earlier rounds' conclusion
that RAM/contention were checked-and-ruled-out (not "confirmed absent" — see the session-close note
in `../2026-09-14-emulator-gate-diagnosis/README.md`) stands unchanged by this run.

**What round 12 actually settles:** the `general`+`packages` gate, run as ONE continuous
`ops/test-emulator.sh` invocation with no manual splitting, completed cleanly once, on this
machine, against `aa2efd9`. It does not retroactively explain rounds 7/9's three anomalies (still
unexplained, still non-reproducing) — it adds a fourth continuous attempt, and this one passed.

## 2. Callable-level (no Chrome) verification — server-side only, explicitly NOT a UI proof

**Scope, per owner instruction:** verify (a) the submitted start instant is preserved through
conflict detection → owner override retry → the final Firestore record + audit log, (b) the
midnight-crossing/historical-day classification does not bypass `STAFF_PASSIVE`, and (c) do NOT
count this as proof the React client (`WalkInFlow.tsx`) itself computes/sends the same instant a
real click would — that remains open, pending an actual Chrome run (extension not connected this
session; see below).

**Method:** the real client Firebase Web SDK (`firebase/app`, `firebase/auth`,
`firebase/functions` — the same package `WalkInFlow.tsx` imports, v12.14.0), signed in against a
real local Auth emulator, calling the real `salownCreateStaffWalkIn` callable through a real
Functions emulator — **no admin-SDK bypass of the callable itself**. Synthetic tenant `p2mid`,
`presentation.timezone: Europe/London`, three barbers (`alex`, `cara` — active, `bea` — passive),
one 30-min service. `callable-check.mjs` (copied here) is the harness; `seed.mjs` (copied here)
seeds the tenant. Both throwaway, never committed to the shared tree.

**Controlled clock, not real Date.now():** per owner direction, the instants used are fixed
literals (`2026-09-14T22:15:00.000Z` / `...T19:00:00.000Z`), not `Date.now() - duration`. This
makes the check repeatable on any machine at any time of day — the first, discarded run in this
session *did* use `Date.now() - 30min` (the actual real BST midnight window happened to be open at
the time) and incidentally hit an unrelated barber-hours edge case (`OUTSIDE_EFFECTIVE_SHIFT` at
exactly the `23:59` shift-close boundary) rather than the intended conflict path — not a product
bug, just a seed artifact of choosing `hours: {close:'23:59'}` as "all day" and then landing a
request exactly on that edge. The controlled-instant version below avoids that by construction.
No production code was touched to make the clock controllable — only the harness's own literal.

**Results (full raw log: `callable-check-results.json`):**

| # | Actor | Barber | Instant (fixed) | Override sent? | Server response |
|---|---|---|---|---|---|
| 1a | staff | `cara` (active) | `22:15:00Z` 14 Sep | no | `SLOT_CONFLICT`, `conflictingRecordIds:["midConflictCara"]` |
| 1b | staff | `cara` | same | **yes** (smuggled, bypassing the client's own role gate) | `OVERRIDE_REQUIRES_OWNER` — **server refuses regardless of what the client sends** |
| 1c | owner | `cara` | same | no | `SLOT_CONFLICT`, same conflicting id |
| 1d | owner | `cara` | **same instant, reused verbatim** | yes, `acknowledgedConflictIds` from 1c's own response | **SUCCESS** — booking `r4QOodDI2aCDCm0cqclR` created |
| 2 | owner | `bea` (**passive**) | `19:00:00Z` 14 Sep (historical day vs. real today, 15 Sep) | no | `STAFF_PASSIVE` — **historical-day classification did NOT exempt it** |

**Instant-preservation, verified against the actual Firestore document** (not just the callable's
return value): booking `r4QOodDI2aCDCm0cqclR`'s stored `startTime` is
`2026-09-14T22:15:00.000Z` — **byte-identical** to the instant first submitted in 1a/1c, carried
through the conflict refusal and the owner's override retry with zero re-derivation. The
`STAFF_BOOKING_POLICY_OVERRIDE` audit doc for the same booking records
`requestedStartMs: 1789424100000`, which is exactly `Date.parse('2026-09-14T22:15:00.000Z')` —
same instant, third independent place it's recorded identically.

**What this proves:** the server-side contract (`createWalkIn.ts`'s `staffSurface` branch,
`assertAssignableStaff`'s `historicalExemptionAllowed: false` for that surface, the owner-only
override gate, and the atomic audit write) behaves exactly as `docs/STAFF_AVAIL_GAP_PLAN.md` D3/D4
and the `historicalExemptionAllowed` companion fix (round 6) specify, under a real Auth token, a
real conflict, a real override retry, and a real historical-day classification — all against a
real (non-mocked) emulator.

**What this explicitly does NOT prove — both still open:**
1. That `WalkInFlow.tsx`'s untouched-time branch (`timeTouched === false`) actually computes
   `new Date(Date.now() - duration*60000).toISOString()` and sends it as `startTimeIso` from a real
   click in a real browser, rather than some other value. (Source-verified only — see
   `src/staff/sheets/WalkInFlow.tsx:555-560` in the checked-out clone — not exercised here.)
2. Any of the 9 acceptance-test scenarios in
   `../2026-09-14-test-fix-and-uk-checkout/31-future-checkout-scope-options.md` §7 that require an
   actual UI interaction (no-crossing daytime click, exact-midnight click, owner re-prompt seen and
   answered by a human-shaped interaction, manual-time regression) — **none of these were run
   through Chrome this session.**

**Why no Chrome this session:** `mcp__claude-in-chrome__tabs_context_mcp` reported the browser
extension not connected. Per owner direction, this session did not wait for it and proceeded
callable-level only. The two UI checks remain the explicit next step and need an actual connected
Chrome session — real midnight is not required to redo them (see the controlled-instant method
above; a Chrome run can drive the UI at any wall-clock time and just needs the harness's discipline
about not conflating "click happened" with "click happened at instant X" — that part still needs a
human/live click, this session cannot fabricate it).

## 3. Environment cleanup, verified

- All three emulators (auth/firestore/functions) and the isolated `vite --port 5199` instance were
  stopped; ports 8080/9099/5001/5199 free again (confirmed via `lsof`).
- The shared dev server on `:5173` (production-connected, per `feedback_shared_dev_server`) was
  never touched — confirmed running throughout, same PID, before and after.
- No production Firestore/Auth/Functions read or write at any point. All seed/harness data lives
  only in the local emulator's in-memory state for tenant `p2mid`, which no longer exists once the
  emulator process exited.
- `ops/claims/STAFF-AVAIL-GAP-P2-VERIFY--alish--verify.claim` released at end of session.
