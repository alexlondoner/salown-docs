# Handoff → next session: STAFF-AVAIL-GAP Phase 2 (Staff App Walk-in)

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
