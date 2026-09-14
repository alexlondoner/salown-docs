# WALKIN-BACKDATE-FLOOR — raw gate logs + candidate-clarity correction

Written 2026-09-14 ~16:3x UK, in response to an owner correction on the same-session report of
`WALKIN-BACKDATE-FLOOR` (salown-app `aa2efd9`). The prior report stated gate results (functions
unit 2696/2696, frontend vitest 5569/5569, `tsc` clean, `deploy-functions.sh --check-only` PASS)
from this session's own inline terminal output, with no persisted raw logs — self-reported, not
independently checkable. This folder fixes that: every number below is re-run with output
captured to a file in this directory, from a **clean working tree at `a993feb`** (HEAD at the
time of this re-run; a993feb is `aa2efd9` plus two later claim-only commits, no source change —
verifiable with `git diff --stat aa2efd9 a993feb -- ':!ops/claims' ':!SYNC.md'` returning empty).

**Owner's own framing, verbatim intent, recorded here so it isn't lost:** "these results have not
yet been independently verified from raw logs" — this folder is what makes that verification
possible; it does not itself constitute that independent verification. Someone still needs to
read these logs (or re-run the commands) without relying on this session's summary.

## 1. Raw logs in this folder

| File | Command | Result |
|---|---|---|
| `01-functions-unit-full.log` | `npm test` in `functions/` | 2739 tests: 2696 pass, 0 fail, 43 skipped |
| `02-functions-tsc.log` | `npx tsc -p tsconfig.build.json` in `functions/` | empty (clean), exit 0 |
| `03-app-tsc.log` | `npx tsc --noEmit` at repo root | empty (clean), exit 0 |
| `04-frontend-vitest-full.log` | `npx vitest run` at repo root | 189 files, 5569 tests, all pass |
| `05-deploy-guard-check-only.log` | `./scripts/deploy-functions.sh --check-only salownCreateStaffWalkIn salownCreateWalkIn` | guard passed, nothing deployed |
| `06-diff-stat-a7b1f33-vs-aa2efd9.log` | `git diff --stat a7b1f33 aa2efd9` | see §2 below |
| `07-staff-bundle-sha256.log` | `shasum -a 256 hosting/staff-bundle/assets/staff-CxdWlU6-.js` | `ee92f6df93ac8dfecf349d61816230051bc0fb6f3a8a676d5693da8fccf8dc6a` |
| `08-candidate-sha.txt` | `git log -1 --format=%H` for `aa2efd9` then `a7b1f33` | full 40-char SHAs |

**Not re-run here** (unchanged from the same-session report, already true and not disputed):
`npm run build:staff` PASS (the bundle in `07` is its output, already committed to salown-app).

**Still not run at all, for either candidate discussed below:** the two-phase
`ops/test-emulator.sh` gate, and any Chrome/emulator live check of the new absolute-instant
backdate formula or of the `historicalExemptionAllowed` companion fix. **This stays explicitly
open** — RAM-constrained machine (61MB free at last check), owner chose to defer it this session.
Do not report either candidate as emulator/Chrome-verified until this actually runs.

## 2. Which SHA is the Phase 2 release candidate — the distinction the prior report blurred

The prior report called `WALKIN-BACKDATE-FLOOR` "a separate, unrelated finding from
`STAFF-AVAIL-GAP-P2` — not bundled with, and not a blocker for, that release decision." That
sentence is true about **scope and decision ownership** (the four owner decisions for this fix did
not need Phase 2's release approval, and this fix's own merits don't depend on Phase 2 shipping).
It does **not** mean the two are independently deployable from where `main` sits today, and the
prior report did not make that second, different claim explicit. This section does.

- **`a7b1f33`** is `STAFF-AVAIL-GAP-P2`'s last release candidate that has actually been through
  that item's OWN full release verification: the round-2 gates recorded in
  `docs/evidence/staff-avail-gap-p2/2026-09-14-release-checks/` (functions unit, two-phase emulator
  682/682, Chrome walk-in/admin/owner scenarios, compat matrix against the live server) plus the
  `staffPostWriteBoundary.test.ts` fix this SHA itself is. **If Phase 2 is released today, the only
  SHA with that full verification behind it is `a7b1f33` — reachable only by building from an
  isolated workspace pinned exactly there (`git archive`/detached clone at `a7b1f33`), discarding
  everything after it on `main`, per this repo's established isolated-release pattern.**
- **`aa2efd9`** is a later commit on the SAME branch (`git merge-base --is-ancestor a7b1f33 aa2efd9`
  confirms `a7b1f33` is an ancestor). §1's diff-stat shows it touches `createWalkIn.ts` and
  `WalkInFlow.tsx` directly — **the same runtime files that ARE the Phase 2 Walk-in payload**
  (both appear in the original Phase 2 candidate's 19-file list, `HANDOFF_STAFF_AVAIL_GAP_P2.md`
  §3) — plus `staffEligibility.ts`, the eligibility module `createWalkIn.ts` calls into. It has
  passed its OWN gates (this folder), but **not** Phase 2's release verification: no emulator-gate
  or Chrome re-run has exercised `salownCreateStaffWalkIn`/`WalkInFlow.tsx` at `aa2efd9`
  specifically.
- **The practical consequence:** a `functions` deploy of `salownCreateStaffWalkIn`/
  `salownCreateWalkIn`, or a `hosting:salown-staff` deploy, from current `main` HEAD (or any commit
  at or after `aa2efd9`) **will ship both changes together** — Phase 2's walk-in enforcement AND
  the backdate-floor removal — regardless of the "separate work" framing above, because they are
  the same files at that point in history. There is no ordinary build of `main` that contains one
  without the other. The only way to release Phase 2 WITHOUT `aa2efd9` is the isolated-workspace
  pin at `a7b1f33` named above; the only way to release `aa2efd9`'s fix WITHOUT also shipping
  Phase 2's enforcement is the same kind of pin, built from a point before Phase 2's own callable
  (`9ea0aca`'s ancestor) — which would defeat the purpose, since `aa2efd9`'s fix is written against
  the Phase 2 code shape (`createWalkInEnforced`, `staffPolicyGate.ts`) and does not exist
  independently of it.
- **So: is a NEW Phase 2 candidate being proposed that includes `aa2efd9`?** Not by this note —
  that is an owner/release decision, not a default. Until someone runs Phase 2's own release gates
  (emulator + Chrome) against `aa2efd9` and the owner accepts it as the candidate, **the release
  candidate for Phase 2 remains `a7b1f33`**, and `aa2efd9` is a verified-on-its-own-gates but
  Phase-2-release-unverified commit sitting downstream of it on `main`.

## 3. Unchanged (reaffirmed, not re-decided here)

No deploy happened or is proposed by this note. The bypass exceptions and the Walk-in↔Reschedule
Phase-3 deferral (`20-owner-decision-recommendations.md`) remain recommendations only, still not
accepted — unchanged from every prior record. `ops/claims/` holds nothing from this work once the
`WALKIN-BACKDATE-FLOOR-RECORD` claim (SYNC.md only, this correction) is released.
