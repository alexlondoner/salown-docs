# Release preparation — 2026-09-24 (`RELEASE-PREP-0924`)

Source-only preparation after `STAFF-LIVE-RECONCILE` (`e0c2e6f`). **Nothing deployed, no
production write.** Every "live source" below was re-proven today, and every net
difference was measured from source AND from built output — not from commit history.

## 1. Live sources (re-verified 2026-09-24)

| Target | Live version | Source | Proof |
|---|---|---|---|
| `hosting:salown` | `ef9aceae78492916` | salown-app `af8347d` | clean rebuild: served entry `index-BOjABFr-.js` sha256 `9e6aba93…` byte-identical |
| `hosting:salown-staff` | `e0fab0365adaca37` | salown-app `440e275` | clean rebuild: `staff-DQxUpHor.js` sha256 `0bbf6da0…37b014` byte-identical |
| `functions:salown` | 94 functions | **44 distinct deployed source trees**, none equal to main | every `function-source.zip` pulled read-only from `gcf-v2-sources-1050766582653-europe-west2` and diffed |
| Firestore rules | ruleset `5e102dd4-…` (2026-09-10) | — | live source **byte-identical** to main `firestore.rules` |
| Firestore indexes | 3 composite | — | live set == main `firestore.indexes.json` (3/3) |

## 2. Net differences, main (`a139d8d`) vs live

### `hosting:salown` (Admin)
Unminified builds of both sources, import/export aliases normalised: **3 of 32 chunks differ** —
`Home.js`, `Reports.js`, `index.js`. Source-level (non-test, Admin-shipped paths): 12 files.

| Change | Files | Status |
|---|---|---|
| **A1** Staff-lane shared loyalty reader/writer (shown == debited; `loyaltyClientId` ownership guard) | `firestoreActions.ts`, `clientIdentityQueries.ts` | candidate ready |
| **A2** `INSIGHTS-PASSIVE-BARBER` (ROADMAP P2, `PUSHED_NOT_LIVE` since 2026-09-13) | `Reports.tsx` | candidate ready |
| **HOME** Top Clients / loyalty leaderboards / Ignore + pager fix | `Home.tsx`, `homeMetrics.ts`, panel dictionaries | candidate exists (`443f762`), **blocked** |
| behaviour-neutral | `bookingCallables.ts` (`walkInPayload` extraction; the rest is Staff-only code), `staffApp` dictionaries (never rendered by Admin), `BookingDetailPanel.tsx` (import order), `vite.config.js` (test exclude) | ride along with any main build |

### `hosting:salown-staff`
Single chunk, compared per `//#region` module: **4 modules differ**.
- `src/utils/availabilityWindow.ts` — the `availabilityUntil` upper bound (the only behavioural change);
- `LocaleProvider.tsx` / `dictionaries/en/index.ts` — Home + calendar strings the Staff app never renders;
- `firestoreActions.ts` — comments only.

**The loyalty/redeem work needs no Staff release** — it is already live.

### `functions:salown`
No single live source exists; a functions release must stay per-function, targeted, built on
THAT function's own deployed tree (the `R-2026-09-23-D` method). The Staff integration touched
no `functions/` file.

### Rules / indexes
No difference. Nothing to release.

## 3. Staff integration → Admin impact
- Admin never sends `loyaltyClientId` → the ownership refusal cannot fire from Admin.
  `adminCheckoutWriter.emulator.test.ts` (redeem, no id) passes through the integrated writer.
- `getClientLoyaltyPoints` now resolves in the writer's order for Admin callers too
  (`CheckoutPanel`, `BookingDetailPanel`). **On the live source the Admin till SHOWS one
  client's balance and DEBITS another's** when a booking's legacy phone and canonical e-mail
  resolve to different client documents: `adminLoyaltyReader.emulator.test.ts` fails 2/2 on
  live `af8347d` and passes on A1.
- **Reports:** the Staff integration changes nothing in Reports. The only Reports difference
  vs live is `INSIGHTS-PASSIVE-BARBER` (display-only: whether a passive member with no period
  data gets a card; no total moves). Loyalty redemptions were already being written by the live
  Staff till since 2026-09-20, so no new data shape reaches Reports from this work.

## 4. Candidates (all on the live source of their target; none deployed)

| ID | Target | Branch @ SHA | Delta vs live | Gates |
|---|---|---|---|---|
| **A1** | `hosting:salown` | `release/admin-loyalty-reader-on-live-af8347d` @ **`764ff84`** | 4 files (2 shipped); built output: **`index.js` only** | tsc 0 · vitest 5799 pass / 0 fail vs base 5790 / 0 · build + build:staff 0 · emulator `adminCheckoutWriter` + `adminLoyaltyReader` **7/7** (base: 5/7, the 2 reader tests fail) |
| **A2** | `hosting:salown` | `release/admin-reports-passive-on-live-af8347d` @ **`3887397`** | 2 files (1 shipped); built output: **`Reports.js` only** | tsc 0 · vitest 5797 pass / 0 fail vs base 5790 / 0 · builds 0 |
| **HOME** | `hosting:salown` | `release/home-on-live-af8347d` @ **`443f762`** (other session) | 5 Home files, == main | see SYNC 2026-09-24 ~00:56 — **blocked on the owner's Ignore decision** |

The only suite failure in every tree is `functionsArchiveManifest.test.js`, which cannot load in a
non-git `git archive` tree (layout, identical in base and candidates).

**Sequencing:** A1, A2 and HOME touch disjoint files but the same site. Release one at a time
(owner's one-change-at-a-time rule); after each, the next candidate is re-cut on the NEW live
source and its output delta re-measured. Rollback for the first: `ef9aceae78492916`.

**No Staff candidate.** An S1 (`availabilityUntil` in the Staff bundle) was built and then
**dropped**: both Staff sheets keep an "unavailable" member selectable behind a confirm
dialog, so it would add a warning, not a block — see §5.

## 5. Blockers and dated risks

1. **HOME — owner decision:** reminder Ignore keys carry no date, so a dismissal is permanent.
   Not changed here.
2. **⚠️ `availabilityUntil` is enforced in NO booking-creating function (dated: Muhamed's cutoff
   is 2026-09-27).** Read from the deployed archives: only `salownStaffLifecycle` carries the
   upper bound; `salownCreateBooking`, `salownGetBusySlots`, `salownCreateStaffBooking`,
   `salownCreateStaffWalkIn`, `salownCreateWalkIn`, `salownCreateAdminBooking`,
   `salownEditBookingForm`, `salownReassignBooking` and the parsers do not. The live Staff bundle
   and the live whitecrossbarbers.com `script.js` do not read it either. Only the Admin panel and
   the salown.com booking page honour it. From 2026-09-28 until `OFFBOARD` runs, a Muhamed
   booking can still be created from whitecrossbarbers.com, the Staff app, or any direct call.
   Options for the owner: run `OFFBOARD` on the 28th (passive IS server-enforced), or a targeted
   functions release of the booking callables on their own live trees. No action taken.
3. **Functions:** no candidate prepared; not needed for any item above except (2).
