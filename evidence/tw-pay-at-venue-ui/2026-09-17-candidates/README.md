# TW-PAY-AT-VENUE-UI — candidate evidence (2026-09-17)

A Treatwell pay-at-venue booking (stored `status: 'UNPAID'`) is an expected appointment, not a
post-service debt. This folder is the evidence for the fix and its two release candidates.
Nothing here was merged or deployed, and nothing touched production data.

| Role | Branch | SHA | Base |
|---|---|---|---|
| Fix (to integrate into main) | `claude/tw-pay-at-venue-ui` | `6d00628` | `0d31b79` → `1036b58` |
| Admin release candidate | `claude/tw-pay-at-venue-admin-on-live-c8a64d6` | `6b3f19f` | live Admin `c8a64d6` |
| Staff release candidate | `claude/tw-pay-at-venue-staff-on-live-aa2efd9` | `76e58fe` | live Staff `aa2efd9` |

Plan: `../../../RELEASE_PLAN_TW_PAY_AT_VENUE_UI.md`.

## Results, stated exactly

**Full frontend suite on the fix commit `6d00628`** (fresh `npm ci` clone, functions built):
**5624 passed · 16 failed · 2 skipped** (5642 tests, 193 files; 3 files failed) — `logs/fix-6d00628-full-vitest.log`.
The candidate branches did NOT pass the full suite.

The 16 failures are all in three workspace-scanning files:

- `ops/functions-ownership.test.js` (6)
- `ops/rules-authority.test.js` (8)
- `scripts/functionsArchiveManifest.test.js` (2)

The first two scan the directory above the checkout. In the scratch clone that directory held the
screen-check harness copies, and the log itself names them (`COLLISION … salown (harness/admin)`).
The third needs the machine's untracked `functions/.secret.local`, which was deliberately not copied.
The branch does not modify `ops/`, `scripts/` or `firebase.json`.

**Separate environment evidence, not a result for the candidates:** the same three files, run
unchanged in the main checkout (`~/Desktop/alex/salown-app`, main at that time), passed
**104/104**. That run was not saved to a log file; it is recorded in `salown-app/SYNC.md`
(2026-09-17 round-2 row).

Other results:

| Check | Tree | Result | Log |
|---|---|---|---|
| `npm run typecheck` | `0d31b79` (round 1, real env) | exit 2, 1 error (TS2783 in the new test) | `logs/fix-0d31b79-typecheck-TS2783.log` |
| `npm run typecheck` | round 2, before the lint fix | exit 0, 0 errors | `logs/fix-round2-pre-lint-fix-typecheck.log` |
| `npm run typecheck` | `6d00628` | exit 0 (run before the final full suite; output not saved) | — |
| eslint, touched files | round 2, before the lint fix | 2 errors (`_drop` unused) | `logs/fix-round2-pre-lint-fix-eslint.log` |
| eslint, touched files | after the lint fix (= `6d00628`) | exit 0 (output not saved) | — |
| targeted `unpaidState` + `salesPeriod` | `6d00628` | 77/77; 4 fail on `0d31b79`'s surfaces | — |
| `npm run build` / `build:staff` | `6d00628` | OK | `logs/fix-6d00628-build-*.log` |
| typecheck | `6b3f19f` / `76e58fe` | exit 0, 0 errors each | `logs/*-typecheck.log` |
| targeted + `src/i18n` | `6b3f19f` / `76e58fe` | 275/275 each (not saved) | — |
| build | `6b3f19f` / `76e58fe` | OK | `logs/*-build.log` |

`logs/superseded-pre-lint-fix-full-vitest.log` is an earlier full run on the round-2 tree before the
lint fix: 5623 passed, 17 failed, 2 skipped. The extra failure was a `staffTimeContract` timeout
under load; that file passed on its own afterwards. This log is kept for honesty only; it is not
the result of record.

## Live identities verified (read-only, 2026-09-17)

- Admin `salown`: live release `1789224104649000`, version `827946e295c69eeb` (2026-09-12T14:41:44Z).
  A rebuild of `c8a64d6` matched **55/55** served files under `/public-bundle/`.
- Staff `salown-staff`: live release `1789477084532000`, version `27b0c5187cb9976b` (2026-09-15T12:58:04Z).
  A rebuild of `aa2efd9` matched **25/25** served files.
- Firestore rules: live ruleset `5e102dd4-…` equals `firestore.rules` at `c8a64d6` byte for byte.

## Candidate deltas

- Each candidate's source delta over its base equals the fix delta at hunk level
  (`git diff -U0`, ignoring line numbers). A grep for `settlement|stripe|OnlinePaymentFees`
  over the candidate diffs finds 0 lines.
- The import conflict in `BookingDetailPanel.tsx` was resolved by dropping the Finance/Stripe
  imports (`OnlinePaymentFees`, `settlementFacts`) that the fix branch had inherited from main.
- Built bundles vs the live rebuilds, after normalising hashed names and 1–3-character
  identifiers:
  - **Admin:** 28 files identical, 19 differ only by minifier renames. Content changes are only
    in the `index`, `BookingForm` (till), `Bookings`, `Dashboard` and `Home` chunks.
  - **Staff:** 24 files identical; the only content change is in `staff-*.js`.
- Booksy Happy Hours: whatever of it exists in the bases (`7aa716f` is an ancestor of both) is
  already what is live; neither candidate adds or changes a Happy Hours line.

## Screen check (local only)

Harness setup (a scratch directory, since deleted):

- `git archive` copies of the candidates, with `src/firebase.ts` replaced so the copy used project
  `demo-pav` and local emulators only.
- Its own `npm ci` install and its own Vite `cacheDir`.
- Emulators: Firestore + Auth with the live-identical rules.
- Sign-in: an emulator custom token. No password was typed and no production endpoint was
  reachable.
- Data: `harness-seed.cjs` (the script as run, plus a three-line header comment).

| # | File | Shows |
|---|---|---|
| 01 | `screenshots/01-admin-dashboard-confirmed-filter.jpg` | Pills Confirmed 2 / Checked Out 1 / Unpaid 1; the Confirmed list includes the pay-at-venue row labelled "Pay at venue" |
| 02 | `screenshots/02-admin-dashboard-unpaid-filter.png` | The Unpaid list holds only the till-saved booking |
| 03 | `screenshots/03-admin-panel-pay-at-venue-noshow-visible.jpg` | Panel: "Pay at venue" badge, no debt banner, No Show + Checkout |
| 04 | `screenshots/04-admin-till-pay-at-venue-banner.jpg` | Till: "Pay at venue — no payment taken online · Treatwell booking", to pay £40.00 |
| 05 | `screenshots/05-admin-after-no-show.jpg` | After No Show: pills Confirmed 1 / No Show 1; panel "Client did not attend" |
| 06 | `screenshots/06-admin-panel-saved-unpaid.jpg` | Till-saved booking: "Unpaid" badge, debt banner, no No Show |
| 07 | `screenshots/07-admin-panel-checked-out.jpg` | Checked-out booking unchanged (£40 collected, CASH) |
| 08 | `screenshots/08-admin-bookings-pills.jpg` | Bookings: Confirmed 2 / Cancelled 1 / Unpaid 1; status column "Pay at venue" |
| 09 | `screenshots/09-admin-home-schedule.jpg` | Home schedule: "Unpaid" for the till-saved booking, "Conf" for pay-at-venue |
| 10 | `screenshots/10-staff-today-list.jpg` | Staff list: Unpaid / Checked out / Cancelled / Confirmed / Pay at venue |
| 11 | `screenshots/11-staff-sheet-pay-at-venue.jpg` | Staff sheet: "Pay at venue", Check out £40, No show |
| 12 | `screenshots/12-staff-after-no-show.jpg` | Staff list after No Show |

The No Show write proofs are in `emulator-no-show-readback.md`.

## Observed, not changed (tracked separately)

- The Dashboard grid hover card labels a stored `UNPAID` booking "CONFIRMED" (screenshots 03 and 06).
- A `NO_SHOW` platform booking still shows "Payment due" in the panel (screenshot 05).
- `src/pages/Calendar.tsx` is not routed, so the fix's edits there are inert.
- A Treatwell re-import replaces the whole document (`TW-REIMPORT-CLOBBER`).

## Incident during the check

The first harness start used a symlink to the main repo's `node_modules`. Vite therefore
re-optimised `salown-app/node_modules/.vite/deps` at 16:38 UK while the shared dev server
(pid 94201) was running. That server was not stopped or restarted. If its tabs show an
"Outdated Optimize Dep" error, a hard refresh clears it.

`MANIFEST.sha256` covers every other file in this folder (`shasum -a 256 -c MANIFEST.sha256`,
run from `docs/evidence/tw-pay-at-venue-ui/`).
