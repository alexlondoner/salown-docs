# STAFF-AVAIL-GAP Phase 2 — Walk-in local verification evidence

Tested source: salown-app `9ea0aca076d80b05279be6b7135402ad7f049554` (`commit-9ea0aca-stat.txt`).
Environment: local Firebase emulators, project `demo-c1` (emulator-only), synthetic tenant `p2ui`
("P2 ui"); real-token HTTP checks on synthetic tenant `p2api`. Nothing deployed; no production record.
No password, ID token or emulator auth header value appears in any file here.

## Environment proof

| Claim | Evidence |
|---|---|
| Emulators on 127.0.0.1 (8080 Firestore, 9099 Auth, 5001 Functions), demo project | `env-proof.txt` (listeners, emulator log `Detected demo project ID "demo-c1"`) |
| Browser app = rehearsal copy wired to emulators; only `src/firebase.ts` differs from `9ea0aca` among tracked files | `env-proof.txt` (diff vs `git archive 9ea0aca`; untracked local files listed) |
| Repo `src/firebase.ts` unchanged (production config never edited in the repo) | `env-proof.txt` |
| Browser requests: 127.0.0.1 only, plus `fonts.googleapis.com` stylesheet; no Firebase production host | `browser-env-proof.json` |
| Signed-in role per run | `staff-profile-role.jpg`, `admin-profile-role.jpg`, `owner-profile-role.jpg` |
| Every before/after file records projectId `demo-c1`, host `127.0.0.1:8080`, tenant `p2ui` | `*.json` `environment` block |

## Scenarios (walk-in UI = WalkInFlow → `salownCreateStaffWalkIn`)

Counts are `bookings / idempotency / audits / checkedOut`.

| # | Actor | Scenario | Expected | Observed | Before → After | UI evidence | Write evidence | Result |
|---|---|---|---|---|---|---|---|---|
| S1 | staff | Alex 12:40 conflict, Save | no prompt, owner-required msg, form kept, 0 writes | 0 prompts; "Owner authorization is required for this."; form kept 12:40 | 8/4/8/1 → 8/4/8/1, ids identical | `S1-staff-conflict-denied-form-kept.jpg`, `staff-rerun-ui-observations.json` | `S0-before-staff-rerun.json`, `S1-after-staff-conflict-save.json` | PASS |
| S2 | staff | Lee (leave) 15:10, Save | no prompt, never-overridable msg, 0 writes | 0 prompts; "…not available… can never be overridden."; form kept | 8/4/8/1 → 8/4/8/1, ids identical | `S2-staff-leave-denied-form-kept.jpg` | `S2-after-staff-leave-save.json` | PASS |
| S3 | staff | Alex 12:45 conflict, Save & Checkout | no prompt, owner-required, stays on pay step, 0 writes/checkout | 0 prompts; owner-required toast; pay step kept | 8/4/8/1 → 8/4/8/1, ids identical | `S3-staff-checkout-denied-pay-step.jpg` | `S3-after-staff-conflict-save-and-checkout.json` | PASS |
| S-run1 | staff | first run (conflict Save, leave Save, untouched-time Save & Checkout ×2) | as above | as above | 2/0/0/0 → 2/0/0/0 | `staff-run1-observations.json` (no saved screenshots) | session output only; confirmed by `S9-after-staff-before-admin-owner.json` | supporting only |
| A1 | admin | Alex 12:30 conflict, Save | no prompt, owner-required, 0 writes | 0 prompts; owner-required toast; form kept 12:30 | 8/4/8/1 → 8/4/8/1, ids identical | `A1-admin-conflict-denied-form-kept.jpg`, `admin-ui-observations.json` | `A0-before-admin.json`, `A1-after-admin-conflict-save.json` | PASS |
| A2 | admin | Lee (leave) 15:00, Save | no prompt, never-overridable, 0 writes | 0 prompts; observer logged never-overridable msg; form kept | 8/4/8/1 → 8/4/8/1, ids identical | `A2-admin-leave-denied-form-kept.jpg` (toast expired before capture; message from observer log) | `A2-after-admin-leave-save.json` | PASS |
| A3 | admin | Alex 12:35 conflict, Save & Checkout | no prompt, owner-required, pay step kept, 0 writes | 0 prompts; owner-required toast on pay step | 8/4/8/1 → 8/4/8/1, ids identical | `A3-admin-checkout-denied-pay-step.jpg` | `A3-after-admin-conflict-save-and-checkout.json` | PASS |
| O1 (attempt 1) | owner | Alex 12:05 conflict, Save | reason prompt, 1 booking, audit | server side committed (audit reason + ack [A]); UI recorder LOST to a Vite dependency-optimisation reload | 2/0/0/0 → 3/1/2/0 | none (`owner-ui-observations.json` explains) | `O1-attempt1-aborted-page-navigated.json` | INCOMPLETE — not counted |
| O1b | owner | Alex 12:20 conflict (A + O1), Save | 1 reason prompt, 1 booking, audit with every acknowledged record | 1 prompt (conflict text); saved; audit role owner, tenant p2ui, flow walkin, reason, ids [A, O1] | 3/1/2/0 → 4/2/4/0 (+1 booking, +1 idem, +2 audit: override + WALK_IN_CREATED) | `O1b-after-save-today.jpg`, `owner-ui-observations.json` | `O1b-after-owner-conflict-save.json` | PASS |
| O2 | owner | Alex 12:25 selected, conflict, Save & Checkout (Cash) | 1 prompt, exactly 1 booking + 1 checkout, chosen time kept | 1 prompt; "Paid £20"; booking CHECKED_OUT start 12:25, paidAmount 20, Cash; one booking at 12:25; no prior booking changed; ack [A, O1, O1b] | 4/2/4/0 → 5/3/6/1 | `O2-after-checkout-today*.jpg` | `O2-after-owner-conflict-save-and-checkout.json` | PASS |
| O3 | owner | Bea 13:00 BLOCKED, Save (prompt armed with a reason) | no prompt for owner, blocked msg, 0 writes | 0 prompts; "The selected time conflicts with a break or blocked time. Pick another time."; form kept | 5/3/6/1 → 5/3/6/1, ids identical | `O3-blocked-form-kept.jpg` | `O3-after-owner-blocked.json` | PASS |
| O4 | owner | Bea 14:05 vs seeded B; C injected while the first prompt is open | re-approval prompt; audit covers B and C | prompt 1 conflict text; C written (HTTP 200) inside prompt 1; prompt 2 "The conflict just changed…" prefilled with reason 1; saved; audit ids [B, C] | 5/3/6/1 → seed B → 6/3/6/1 → 8/4/8/1 (+1 walk-in, +1 injected C, +1 idem, +2 audit) | `O4-after-reapproval-today.jpg` | `O4-before-owner-changed-conflict.json`, `O4-after-owner-changed-conflict.json` | PASS |

Checkout note: "checkout" is measured on the booking document (`status` CHECKED_OUT, `paidAmount`,
`paymentMethod`, `checkedOutAt`); side collections touched by the legacy client checkout (client
stats, loyalty) were not snapshotted.

## Automated checks

| Command | Target | Result | Log |
|---|---|---|---|
| `firebase emulators:exec --only firestore … node --test` (8 booking/walk-in/block/access emulator files) | working tree = 9ea0aca content | 211/211 | `test-emulator-targeted.log` |
| `cd functions && npm test` (full unit) | working tree before commit | 2689 pass, 43 skipped, 2 fail (13i/13j archive-manifest: new file untracked at the time) | `test-functions-unit-full.log` |
| `node --test src/staff/rotaWriter.test.js` | after commit | 115/115 incl. 13i/13j | `test-rotaWriter-after-commit.log` |
| real-token HTTP checks (`p2rehearsal.mjs tokens`) | emulators, tenant p2api | 17/17 | `token-checks.txt` |
| `vitest run --maxWorkers=1` (16 affected files) | `git archive 9ea0aca` | 466/466 | `check-vitest-affected.log` |
| `tsc --noEmit -p tsconfig.json` | archive (no functions/lib) | exit 2 — env artefact | `check-tsc-frontend.log` |
| same, after building functions/lib in the archive | archive | exit 0 | `check-tsc-frontend-archive-with-lib.log` |
| same, control | repo tree 0780fd1 | exit 0 | `check-tsc-frontend-repo-tree.log` |
| `tsc --noEmit -p tsconfig.build.json` (functions) | archive | exit 0 | `check-tsc-functions.log` |
| eslint on 7 changed frontend files | archive | exit 0 | `check-eslint.log` |

NOT run: full frontend vitest suite; full two-phase `ops/test-emulator.sh`.

Logs: `functions-emulator-run.log` (47 `salownCreateStaffWalkIn` executions, includes the p2api token run),
`vite-dev-server-run.log` (client refusal reasons: 11 SLOT_CONFLICT, 3 STAFF_UNAVAILABLE, 1 BLOCKED_TIME_CONFLICT;
one dependency-optimisation reload at 13:04:41). Integrity: `MANIFEST.sha256`.
