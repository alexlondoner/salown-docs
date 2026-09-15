# STAFF-AVAIL-GAP-P2 + WALKIN-BACKDATE-FLOOR — release plan for `aa2efd9`

**Status: PLAN ONLY. Not executed. This document does not authorize a deploy.** It exists so the
actual deploy, when separately approved, follows a fixed, pre-agreed script rather than being
improvised — the same discipline as every prior release in `RELEASE_LEDGER.md`. The three scope
decisions this plan assumes were approved by the owner 2026-09-15 (see
`HANDOFF_STAFF_AVAIL_GAP_P2.md`'s "OWNER RECONCILIATION" and the follow-up approval message):
release `aa2efd9` (includes `WALKIN-BACKDATE-FLOOR`); the legacy Admin walk-in callable and the
`firestore.rules` gap stand as **named, standing exceptions**, not closed; the Walk-in↔Reschedule
race check is deferred to Phase 3.

**How this release must be described, per explicit owner instruction:** the claim covers the
**Staff App Walk-in flow only**. Do not write "tenant-wide", "zero regression", "all gaps closed",
or any equivalent generalization anywhere in the release record.

## 1. Source

**`aa2efd9c5efc875bea316c461e47bf0817728c3c`** — `salown-app`, `main`. Verified ancestor of current
`HEAD`; verified this session (`ops/claims/STAFF-AVAIL-GAP-P2-VERIFY*`) with 682/682 full emulator
gate, real-callable server-side checks, and real Chrome UI checks — see
`docs/evidence/staff-avail-gap-p2/2026-09-15-callable-level-verify/`,
`2026-09-15-callable-level-verify-2/`, `2026-09-15-chrome-uk-checks/`.

**Full diff since the last LIVE baseline** (`797c9b3`, `STAFF-AVAIL-GAP-P1`'s deployed source —
`git diff --stat 797c9b3 aa2efd9`): 28 files, +1932/−329, excluding the tracked
`hosting/staff-bundle/**` build artifact. The tree at `aa2efd9` also contains unrelated, already-
merged ancestor work (`src/pages/Reports.tsx` + its test, `INSIGHTS-PASSIVE-BARBER`, committed
2026-09-13, before `aa2efd9`) — this is **not** part of what ships: neither deploy target's build
touches it (§2). No commits from **after** `aa2efd9` (e.g. `FIN-B2-FEE-READER`, the round-12
verification docs commits) are included — the isolated workspace is built by checking out this
exact SHA detached, not `main`'s current `HEAD`.

## 2. What is actually deployed — exactly 2 units, in this order

| # | Unit | Command | Why this and not more |
|---|---|---|---|
| 1 | `functions:salownCreateStaffWalkIn` | `./scripts/deploy-functions.sh salownCreateStaffWalkIn` (namespace guard `--check-only` first; **never** a blanket `--only functions`) | New export (`functions/src/index.ts`, +32 lines, confirmed by diff to add nothing but this one `onCall` — see below). Does not exist live today (confirmed 404 this session, see §3) |
| 2 | `hosting:salown-staff` | `firebase deploy --only hosting:salown-staff --project havuz-44f70`, only after unit 1 is verified `ACTIVE` and reachable | Ships the updated `WalkInFlow.tsx` (the backdate-instant formula + the new callable wiring) and the shared modules it now uses (`staffOverrideFlow.ts`, `staffCreateReason.ts`) |

**`hosting:salown` (Admin) is explicitly NOT a deploy target.** Its live bundle is unaffected
regardless of what changed in its source tree, because it is not rebuilt or uploaded in this
release.

### 2a. `salownCreateStaffBooking` is deliberately NOT redeployed — read this before reporting the release

`functions/src/bookings/createBooking.ts` changed by 178 lines between `797c9b3` and `aa2efd9`
(refactored onto the shared `functions/src/bookings/staffPolicyGate.ts` contract that
`salownCreateStaffWalkIn` also uses). **This source change is not what ships.** Firebase deploys
per named function: only `salownCreateStaffWalkIn` gets a new revision; `salownCreateStaffBooking`
keeps serving its currently-live revision (`salowncreatestaffbooking-00001-jan`, unchanged since
`R-2026-09-13-A`, confirmed this session — §3) regardless of what the repo's `main` branch now
contains for that file. This is intentional — it is the same minimal-blast-radius pattern
`R-2026-09-13-A` itself used — but it means the live `salownCreateStaffBooking` and the `main`
branch's `createBooking.ts` are **not** the same code until a separate, later release redeploys it.
Do not describe this release as having touched New Booking's server behaviour.

### 2b. The Staff hosting bundle also carries New Booking's client, unchanged server

`src/staff/sheets/NewBookingSheet.tsx` changed by 74 lines in the same range (refactored onto the
shared override-flow module). Deploying `hosting:salown-staff` therefore also updates New Booking's
**client** code, while its **server** (`salownCreateStaffBooking`, §2a) does not move. This
combination — new client, old server, for a DIFFERENT flow than the one being released — was
already checked in round 2 of this work (`RELEASE-EVALUATION-2.md`, `compat-*.json`): 13/13 old-vs-
new server responses identical for `salownCreateStaffBooking`'s payload shape. Flagged here as a
blast-radius fact, not a new open question.

### 2c. `functions/src/index.ts` diff, confirmed clean

`git diff 797c9b3 aa2efd9 -- functions/src/index.ts` adds exactly one export
(`salownCreateStaffWalkIn`, 32 lines) and nothing else — verified by reading the diff in full, not
inferred from the line count.

## 3. Live identities, read fresh this session (2026-09-15, before writing this plan) — **NOT a substitute for re-reading them again immediately before the actual deploy**

| Item | Value | Source |
|---|---|---|
| `salownCreateStaffWalkIn` | **does not exist** (`gcloud functions describe` → 404) | confirms this is a genuinely new function, not a redeploy |
| `salownCreateStaffBooking` | `ACTIVE`, revision `salowncreatestaffbooking-00001-jan`, `updateTime 2026-09-13T00:41:34Z` | unchanged since `R-2026-09-13-A` — must still read this exact value immediately before deploying unit 1, to prove unit 1 didn't touch it |
| Functions total | 93 `europe-west2` / 30 `us-central1` | matches `R-2026-09-13-A`'s post-Phase-1 count exactly — no drift |
| `hosting:salown-staff` | version `62aa1ac4a0302593`, release `1789260207173000` (2026-09-13T00:43:26Z) | **this is the pre-deploy baseline and the rollback target for unit 2** |
| `hosting:salown` (Admin, negative control) | version `827946e295c69eeb`, release `1789224104649000` (2026-09-12T14:41:44Z) | must read the SAME value again after both units deploy — any change here means something leaked into the Admin site and the release must stop |
| Firestore ruleset | not re-read this session (a stray `firebase firestore:databases:list` call hung and was killed; no rules deploy is planned so this is not release-blocking) | re-read via the method in `SECURITY.md` immediately before deploy anyway, as every prior release does |

## 4. Deploy sequence

1. `git fetch --prune` both repos; confirm no active claim conflicts with the paths this release
   touches (`ops/claims/claims.sh list`).
2. Fresh isolated workspace: `git archive aa2efd9 | tar -x` into a scratch dir **outside**
   `~/Desktop/alex` (never the shared tree); symlink `node_modules` (root + `functions/`); `git init`
   + one commit so `functionsArchiveManifest.cjs` can run.
3. `functions`: `npm run build` (tsc), `node scripts/functionsArchiveManifest.cjs` — expect the same
   hygiene result as prior releases (no secret-like file, no debug artefact, `functions/.secret.local`
   absent from the archive).
4. Re-read `salownCreateStaffBooking`'s live revision (must still be `salowncreatestaffbooking-00001-jan`)
   and the function counts (93/30) — the pre-deploy baseline, read again, not trusted from §3.
5. `./scripts/deploy-functions.sh salownCreateStaffWalkIn` (`--check-only` first, then live). Verify
   from the live artifact: `gcloud functions describe` → `ACTIVE`, `europe-west2`, correct
   `entryPoint`; an unauthenticated HTTP call returns the `UNAUTHENTICATED` reason string this
   codebase's own `staffBookingReason.ts` produces (same method `R-2026-09-13-A` used); function
   count 93→94 (`europe-west2`); `salownCreateStaffBooking`'s revision **still**
   `salowncreatestaffbooking-00001-jan` (proves unit 1 did not touch it).
6. Only after 5 passes: `npm run build:staff` in the same workspace, then
   `firebase deploy --only hosting:salown-staff --project havuz-44f70`. (Note the known CLI quirk,
   also hit in `R-2026-09-13-A`: `hosting:salown`'s own predeploy hook fires too and rebuilds the
   Admin bundle inside the ephemeral workspace — this is harmless as long as only
   `hosting[salown-staff]` is finalized/released; confirm `hosting:salown`'s live version is
   unchanged afterward, §3's negative control.)
7. Verify unit 2 from the live artifact: served path read first (`curl staff.salown.com`), confirm
   200, then sha256-compare the served bundle to the isolated-workspace build (byte-identical
   required). Grep the served bundle for a source marker unique to this fix — e.g. the literal
   absence of the old floor expression (`9 * 60`) inside the walk-in chunk, or the presence of
   `startTimeIso` — the same discipline `R-2026-09-13-A` used (`OVERRIDE_REQUIRES_OWNER` marker).
8. Re-read `hosting:salown`'s live version (negative control, §3) — must be unchanged.
9. One production Chrome check, **reachability and rendering only, not a re-run of the behaviour
   verification already done in emulator + this session's live-click evidence**: sign in to
   `staff.salown.com` as a real tenant owner already authenticated, open Walk-in, confirm it renders
   with real tenant data, close via discard without creating anything. Zero production records
   created. Do not describe this step as proving the backdate formula or the conflict/override
   contract in production — it only proves the deployed page loads and renders.
10. Write the `RELEASE_LEDGER.md` row immediately (not from memory afterward), including both
    rollback identities (§5), and update `docs/ROADMAP.md`'s active table entry for this Work ID:
    status, source SHA, "pushed" vs "deployed" stated explicitly, live revision only after the
    production check in step 9.

## 5. Rollback

| Unit | Rollback identity | Method | Order if both must roll back |
|---|---|---|---|
| `hosting:salown-staff` | version **`62aa1ac4a0302593`** (§3) | Console → Hosting → site `salown-staff` → Release history → that version → ⋮ → Roll back | **Roll this back FIRST** — it stops the client from calling the new function at all |
| `functions:salownCreateStaffWalkIn` | none exists (new export, no prior revision) | Delete the function (`gcloud functions delete salownCreateStaffWalkIn --region=europe-west2 --project=havuz-44f70`, or via Console) | Only after the hosting rollback above, and only if actually necessary — deleting first while the old client is still cached in some tab would surface `NOT_FOUND` calls uselessly |

`salownCreateStaffBooking` is not part of this release (§2a) and has no rollback identity to track
here.

## 6. Post-release checks (beyond the deploy sequence's own verification in §4)

- No Firestore document, tenant config, or rule was written by this release process itself (no data
  migration, no rules deploy).
- `hosting:salown`, Firestore ruleset, indexes, Storage rules — all confirmed unchanged (§3 negative
  controls re-read after both units land).
- The two named exceptions (legacy Admin `salownCreateWalkIn` bypass, `firestore.rules`
  `isTenantAny` gap) remain **open**, tracked as separate follow-up items — do not let this release
  close either in `docs/ROADMAP.md` or `SECURITY.md`.
- The Walk-in↔Reschedule race criterion remains **deferred to Phase 3** — do not record it as
  resolved.
- `RELEASE_LEDGER.md`'s own wording for this release must say "Staff App Walk-in flow" as the scope,
  never "STAFF-AVAIL-GAP fully closed" or any tenant-wide/zero-regression claim, per the owner's
  explicit instruction.

## 7. What this plan does not cover

Actually running any of the above. That requires a separate, explicit go-ahead naming this exact
plan (or an amended version of it), per the owner's own message: *"Bu mesaj kapsam kararlarını
onaylar; henüz deploy onayı değildir."*
