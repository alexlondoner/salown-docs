# Handoff → next session: STAFF-AVAIL-GAP Phase 2 (Staff App Walk-in)

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
