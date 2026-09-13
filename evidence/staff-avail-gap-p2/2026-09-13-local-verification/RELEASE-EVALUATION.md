# STAFF-AVAIL-GAP Phase 2 — release evaluation evidence (2026-09-13)

No deploy, no production read or write was performed for any item below. Owner has NOT approved a
release. This file extends `README.md` (local verification) with the release-evaluation checks.

## 1. Content-level "zero write" check

File: `zero-write-content-check.json`. Two independent methods, per zero-write scenario
(S1, S2, S3, A1, A2, A3, O3):

| Method | Covers | Result |
|---|---|---|
| Before/after snapshot, compared by document CONTENT (not id/count) | `tenants/p2ui/bookings` — projected fields only (docId, bookingId, barberId, status, source, bookingType, startTime, endTime, duration, price, paidAmount, paymentMethod, checkedOutAt, total); `tenants/p2ui/bookingRequests` — full document data; `tenants/p2ui/auditLogs` — projected fields (action, actor, tenantId, target, meta, timestamp) | 0 added, 0 removed, 0 content-changed in every scenario |
| Server `updateTime`/`createTime` inventory of EVERY document now under `tenants/p2ui` (33 docs; collections auditLogs, barbers, bookingRequests, bookings, public, services, settings, staff) plus the tenant root doc, against each scenario's before→after capture window | the whole tenant subtree as it exists now | no document created or updated inside any zero-write window |

Explicit limits: booking/audit fields outside the projection were compared only through `updateTime`;
a document created-then-deleted, or deleted, inside a window leaves no trace; other tenants, Firebase
Auth and anything outside Firestore are not covered.

## 2. O2 (owner Save & Checkout) — what is and is not proven

Proven (`O2-after-owner-conflict-save-and-checkout.json`, `write-window-side-effects.json`):
- exactly one NEW booking (5 → bookings, one booking at 12:25), status CHECKED_OUT, start 12:25 (the
  selected time), paidAmount 20, paymentMethod Cash, checkedOutAt set, receipt/loyalty fields written
  on that booking (`o2CheckedOutBookingPaymentFields`);
- inside the O2 window only 4 documents under `tenants/p2ui` were created/updated: that booking, its
  idempotency record, the override audit and WALK_IN_CREATED. No client/loyalty document exists in the
  tenant (anonymous walk-in; `sendLoyaltyEmail` false).

NOT proven:
- transactional single execution of checkout. `checkoutBooking` (`src/firestoreActions.ts:385-854`) is a
  legacy client writer: query + `updateDoc` of the booking + separate client-stat writes, no
  transaction and no server-side "already checked out" refusal. Existing tests are call-site / math
  tests (`src/staff/lib/staffPostWriteBoundary.test.ts` source-scan of the staff checkout boundary;
  `src/firestoreActions.{receipt,totalsClosure,overAllocation,blockGuard}.test.ts` unit tests with
  mocks; `src/staff/sheets/staffCreateCutover.test.ts` Test 6/8 source order). None proves that a
  second checkout of the same booking cannot happen → **single checkout: not verified** beyond the
  observed single run and the UI's disabled button.
- side effects for a REGISTERED client (client stats, loyalty email) — not exercised.
- the UNTOUCHED-time (backdated) Save & Checkout: only staff run 1 exercised it, refused with zero
  writes (`staff-run1-observations.json`, no screenshot). The owner/allowed backdated path has
  **no evidence**.

## 3. Old live server + new Staff client compatibility

Files: `compat-new-server-9ea0aca.json`, `compat-old-server-797c9b3.json`, `compat-diff-old-vs-new.json`,
`compat-old-server-build.log`, `compat-old-server-emulator.log`.
Method: the same 14-case HTTP matrix, with real Auth-emulator ID tokens and the payload exactly as the
NEW client's `callSalownCreateStaffBooking` builds it, against functions built from `9ea0aca` and from
`797c9b3` (the source of live `salownCreateStaffBooking`, R-2026-09-13-A), synthetic tenant `p2nb`.

| Result | |
|---|---|
| `salownCreateStaffBooking`, 13 cases (plain create, SLOT_CONFLICT + ids, staff/admin override, bare superAdmin, owner no-ack, owner ack, replay, BLOCKED, outside shift + bounds, hours override, undated leave, unauthenticated) | identical responses (HTTP status, error status, message, detail keys, reason, conflictingRecordIds, shift bounds, replayed) |
| Override audit rows | same actor role, dimensions, acknowledged ids, reason; new server adds `tenantId` and `meta.flow` |
| `salownCreateStaffWalkIn` | new server 200; old server 404 (not deployed there) |

Limit: protocol level; the refactored New Booking sheet was not re-driven in Chrome in this round.

## 4. Release-tooling checks run offline on `git archive 9ea0aca`

| Check | Result | Log |
|---|---|---|
| `scripts/functionsArchiveManifest.cjs` (git init + one commit) | exit 0, digest `ba7d3436…` | `check-functions-archive-manifest.log` |
| `scripts/deploy-functions.sh --check-only` in the scratch dir | exit 1 — workspace collision with the rehearsal copy (environment) | `check-deploy-functions-guard.log` |
| same, in a clean workspace (one salOWN tree) | exit 0 for `salownCreateStaffWalkIn` and `salownCreateStaffBooking`; its "uncommitted changes" warning could not run (workspace not a git repo) | `check-deploy-functions-guard-clean-workspace.log` |
| `npm run build:staff` | exit 0; entry `/assets/staff-BGZUV_T1.js` sha256 `882813e2…`; Phase-2 markers present | `check-build-staff.log` |
