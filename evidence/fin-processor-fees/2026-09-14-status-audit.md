# FIN-PROCESSOR-FEES — status audit (2026-09-14, read-only)

**Question (owner):** "I remember the Stripe fee / payment-fee work being done and closed, but I see no result in the
product. Where is the data, was Finance connected, was the UX built, which parts are actually live?"

**Method.** Source read at `origin/main` of all three repos (salown-app `b6c325c`, docs `56ec6a1`, whitecross-site
`22850996`, all `0/0`, clean). Production checked read-only with the owner's existing gcloud credential: function and
Cloud Run inventory, Cloud Scheduler, Firestore rules release + ruleset content, composite indexes, field-mask read of
two booleans on `tenants/whitecross/settings/settings`, one document existence check, anonymous `count()` aggregations.
Served Admin and Staff bundles fetched and searched for markers. No customer names, e-mails, tokens, secrets or raw
payment records were read into this note. Stripe itself was **not** queried (no live Stripe credential used), so the
live webhook endpoint's event subscriptions are **unverified** here.

**Scope rule applied.** This note does not reclassify any status record. Where a record is stale it is listed in §5
for its owner to correct.

---

## 1. Answer in one paragraph

Only the **gross online leg** is live: since `R-2026-09-05-B` Finance, Reports and Sales show money paid before the
visit (website Stripe, Booksy prepaid) as an "Online (prepaid)" tender. **No Stripe fee exists anywhere in production
data**, so there is nothing for any screen to show: the settlement ledger (FIN-B1) is written and rehearsed but its
functions, index and flag were never released (only its rules half went out, piggy-backed on the A3 rules release of
2026-09-10). **No Finance fee UI exists in source** (B2 is a plan row, no component, no mockup). The only fee Finance
subtracts today is Treatwell's parser-written `twFeeTotal`. And Finance is visible only to the **whitecross** owner or a
super-admin. What "closed" was the incident about online money being invisible, and the B0 data contract — not fees.

## 2. Work items

| Work ID | Promised outcome | Code / data | UX | Live | Evidence | Remaining |
|---|---|---|---|---|---|---|
| `FIN-ONLINE-TENDER` (Phase 0) | Prepaid online money is its own tender leg in Finance, Reports, Sales | `src/utils/tenderFacts.ts:118-123` `onlinePrepaid_p` reads `platformDepositAmount` only; `815afed` on origin/main | Finance: Daily Ledger "Online prepaid" column (`Finance.tsx:2068,2097`), filter "Online (prepaid)" (`:2025`), Bank Balance / cash-flow line (`:1312,1955,2632`); Reports online column; Sales `ONLINE` method | **LIVE**, gross only. Admin live `827946e295c69eeb` (from `c8a64d6`, contains `815afed`); served `Finance-CbAHSkKb.js` carries `Online (prepaid)` ×3, `bankBalanceRaw` ×3. Staff live from `797c9b3` (contains `815afed`) | RELEASE_LEDGER `R-2026-09-05-B`; INCIDENTS 2026-09-05; whitecross bookings with `platformDepositAmount > 0`: 94 | None for its own scope. Not net of fees, not net of later refunds (§4) |
| `FIN-PROCESSOR-FEES` B0 | Data contract for fees (ledger, amounts, six dates, idempotency, tests) | docs only: `PROCESSOR_FEES_PLAN.md` §2-§7 | — | n/a (docs) | docs `d4ad62e`, `02b2b24` | — |
| `FIN-B1` / `FIN-B1-SETTLEMENTS` | Stripe captures + actual fee recorded per booking for new payments | whitecross-site `8137711b` (on origin/main): `functions/settlements.js`, `stripeWebhook` branch (`index.js` ~1242), `wcSettlementSweeper` (`index.js` ~3762); writes `tenants/{tid}/bookings/{id}/settlements/{entryId}` + `booking.settlementProjection` + `booking.settlementSync`. salown-app `9a9547a`: index + rules arms. Tests 182/182 and staging rehearsals recorded 2026-09-08/09 (not re-run here) | **none** — no reader of `settlementProjection` in salown-app `src` (grep: 0) or in any served Admin chunk (0) | **Partly deployed, functionally absent.** Rules arms LIVE (§3). Functions: no `wcSettlementSweeper` (functions list, Cloud Run list); `stripeWebhook` updateTime `2026-08-28T23:50:59Z` (predates `8137711b`); scheduler has 4 us-central1 jobs, none for settlements. Index: 2 READY, `settlementSync` absent. Flag `settlementLedgerEnabled` absent. `platform/settlementScan` 404. Collection-group `settlements` count **0**; bookings with `settlementSync.state` **0**; with `settlementProjection.version > 0` **0** | Live checks above, 2026-09-14 | Index deploy → env (`WC_SETTLEMENT_START_ISO` once) → Stripe `charge.updated` subscription → targeted functions deploy → flag `true` → first-capture verification. Preflight re-pin needed (§5) |
| `FIN-B1-INDEX` / `TEC-6` | Repo index file matches production; B1 index declared | `firestore.indexes.json` at `9a9547a` declares 3 | — | Drift closed in source; B1 index **not deployed** | indexes API: 2 READY | Part of B1 release |
| B1b | `REFUNDED` settlement entries | none | none | not started | plan §8 | build after B1 |
| B2 | Finance fee line per provider (actual / estimate / unknown count), Bank Balance + Net P&L net of fees, `multipleCharges` review strip, `CANONICAL_BASE_MISMATCH` count | **no source**; grep for fee UI strings in `salown-app/src`, docs and design-handoff folders finds only the plans and the existing Treatwell lines | **no mockup, no component** | not started | served Finance chunk: `Stripe fee` 0, `feeSource` 0, `CANONICAL_BASE_MISMATCH` 0 | Owner decision on P&L day (plan §9), then build on B1 data |
| B3 | Stripe history → read-only CSV → approved batch backfill | none | none | not started; B1 by design writes nothing before `WC_SETTLEMENT_START_ISO` | 92 whitecross bookings with `stripeAmountPaid > 0` have no fee record | script + owner approval |
| B4 / B5+ | Provider-neutral "net of rail fees" in Reports; Booksy/terminal/Treatwell as ledger entries, `railFees` estimates | none | none | not started | plan §8 | owner answers (terminal model, Booksy fee model) |
| Treatwell commission (pre-existing, no Work ID) | Treatwell new-client fee as an expense | parser `functions/src/parsers/treatwell.ts:290-291,361` writes `twFeeTotal`, `twNetPayout`; reader `Finance.tsx:136-139,640,676,952,1312`; `Reports.tsx:99-100`; `BookingDetailPanel.tsx:961-963` | Finance "Treatwell fees" (P&L) + "Treatwell commission" (cash flow), shown only when > 0 | **LIVE** (served chunk: `Treatwell fees` ×1, `Treatwell commission` ×1) | whitecross bookings with `twFeeTotal > 0`: 5 | Becomes the §6.5 provider rule in B2 |
| Connect `application_fee_amount` (platform fee) | salOWN's own commission on Connect payments | `functions/src/index.ts:4197,4216` — wired, 0 % | none | **not active**: `features.stripe` false on every tenant (ROADMAP 2026-09-09 read); Connect in test mode | ROADMAP Connect block | Out of fee scope (plan §11) |

## 3. Data flow as it exists today (real names)

```
Customer pays on whitecrossbarbers.com (whitecross's OWN Stripe account, WC_STRIPE_SECRET_KEY)
  └─ stripeWebhook (us-central1, live bundle 2026-08-28)
       externalCheckout.js:1044-1051 → booking.paidAmount, stripeAmountPaid,
       platformDepositAmount (= deposit for DEPOSIT, 0 for FULL), paymentProvider EXTERNAL_CHECKOUT
       ✗ no balance_transaction read, ✗ no fee, ✗ no settlements/ (B1 branch not deployed)
Desk checkout (Admin src/firestoreActions.ts:352-381 resolvePrePaidAmount; :774)
  └─ stamps platformDepositAmount = resolved prepaid ONLY IF the field is not already set
Finance (tenants/whitecross only; Sidebar.tsx:248)
  └─ rows bucketed by SERVICE day: tenantDayKey(startTime) (Finance.tsx:381, 594)
     online_p   = platformDepositAmount (gross)            → "Online (prepaid)"
     platformFees = Σ twFeeTotal (Treatwell only)          → "Treatwell fees"
     netRevenue = gross − cash exp − bank exp − platformFees   (Finance.tsx:676)
     bankBalance = card + online − bank exp − bank paid − fixed − platformFees (Finance.tsx:1312)
```

**Planned B1 flow (source ready, not live):** `charge.succeeded` / `charge.updated` → retrieve PaymentIntent with
`latest_charge.balance_transaction` outside the transaction → append `stripe:ch_…` `CAPTURED` + `stripe:txn_…`
`FEE_ACTUAL` → recompute `settlementProjection {gross_m, fee_m, feeSource, providerNet_m, refunded_m, settledNet_m,
paidOut}`; `wcSettlementSweeper` completes late fees and scans Stripe charges from `WC_SETTLEMENT_START_ISO`.
Missing fee = `null` / "unknown", never £0 (plan §2.6). No reader exists.

**Separation of concepts, as the code stands:**
- Gross: `effectiveRevenue` / `online_p` — unchanged by fees (plan T4).
- Stripe processing fee: **not recorded anywhere**. Bank Balance is overstated by every Stripe fee (plan §0; nothing
  in production contradicts it).
- Platform (salOWN) fee: Connect `application_fee_amount`, 0 %, inactive — not a Stripe processing fee.
- Payout: nothing reads `payout`; Finance's Bank Balance treats online money as bank money on the service day, which
  is neither Stripe's `available_on` nor `payout.arrival_date` (plan §5). Not income, not recorded.
- Deposit vs final collection: `platformDepositAmount` (online, before visit) vs canonical `paymentAllocation.collected`
  (desk). Kept disjoint by `tenderFacts` (live).
- Backfill: none performed; B3 is a plan row.

## 4. Refund — separate lane, and where it touches these numbers

**Status (BL-4 EXTERNAL_CHECKOUT automatic refunds).** Deployed and inert, as recorded:
- R1 reconciliation in `stripeWebhook` — live (updateTime 2026-08-28), live-verified on a real £10 Dashboard refund
  2026-08-30 (ROADMAP; that booking was later deleted).
- R2 `wcExternalCheckoutRefund` + `wcRefundSweeper` — live (updateTime 2026-08-29); scheduler job
  `wcRefundSweeper every 10 minutes ENABLED`.
- R3 intent writer in `salownCancelByToken` — live revision now **`salowncancelbytoken-00070-moq`** (redeployed by
  `R-2026-09-12-A` from `c8a64d6`). The flag gate `5172d32` **is an ancestor of `c8a64d6`**, and
  `functions/src/payments/refundIntent.ts` at `c8a64d6` references `autoRefundEnabled` ×6. Deployed-bytes check of
  revision 00070 was not repeated here.
- Rules: live ruleset carries `autoRefundEnabled` ×6 (owner authority).
- Flag `autoRefundEnabled`: **absent** (field-mask read, settings `updateTime 2026-09-09T16:05:57Z`).
- Remaining per ROADMAP: set the boolean, run a £10 paid booking + cancel, confirm one automatic refund and no second
  refund. Owner's statement "ready, only needs the flag test" matches the records and the live checks above.
- Production today: whitecross bookings with `refundedAmount > 0` **0**; `paymentState` REFUNDED/PARTIALLY_REFUNDED **0**.

**Coupling with fees / Finance (source reading; the last two are inferences, not yet tested):**
1. Stripe keeps its processing fee on a refund (plan §3, verified against Stripe docs 2026-09-06). Once refunds run
   automatically, each refunded booking is a pure fee cost — invisible until B1 + B1b + B2.
2. The auto-refund path is a customer cancellation → booking is not `CHECKED_OUT` → Finance already excludes it from
   revenue; its deposit never enters `online_p`. Activation therefore does not move Finance revenue by itself.
3. *Inference:* a refund recorded **after** checkout changes only `refundedAmount` / `paymentState`
   (`whitecross-site/functions/refunds.js:241-242,432-433`); `onlinePrepaid_p` reads `platformDepositAmount` only, so
   Finance online revenue and Bank Balance would stay at the pre-refund figure.
4. *Inference:* a partial refund **before** checkout on a DEPOSIT booking: the till nets it (`resolvePrePaidAmount`
   rail 0, live via `R-2026-09-10-B`), but `firestoreActions.ts:774` does not overwrite an already-stamped
   `platformDepositAmount`, so Finance could keep the gross deposit while the desk collected the net remainder.
   Needs a fixture test before it is called a defect.

## 5. Records that are stale or whose scope is easy to misread

1. **`PROCESSOR_FEES_PLAN.md` header (2026-09-09) and §9** say `settlementLedgerEnabled` is ×0 in the live ruleset and
   B1 is blocked on COA. Live ruleset is `5e102dd4-e7e7-4950-b12a-14a74daa82e8` (release 2026-09-10T13:39:16Z),
   `settlementLedgerEnabled` ×5, `coaNotOverAllocated` ×2, content byte-identical to salown-app `HEAD:firestore.rules`
   (80,896 B, sha256 `b05ac1e7515cb5a5…`). The COA blocker is cleared; the rules step is already done.
2. **ROADMAP `FIN-PROCESSOR-FEES` row** repeats (1): "absent from live ruleset `a0a10819-…` … blocked on COA".
3. **`DEPLOYMENT_STATUS.md` CURRENT table**, rules row: `a0a10819-…`, "`[COA]` and the B1 flag arms are both
   PUSHED_NOT_LIVE" — stale since `R-2026-09-10-C`.
4. **`FIN_B1_RELEASE_PREFLIGHT.md`** §1 live snapshot (rules `a0a10819`) and §4 step 5 (rules last, record rollback at
   that moment) no longer describe production; candidates `101c3c2d` / `e0fd2e8` are behind current heads
   (`22850996` / `b6c325c`). The rules half shipped before the functions, not last; its rollback cannot be separated
   from A3 any more.
5. **`RELEASE_LEDGER.md` `R-2026-09-09-A`, "Inventory" cell** says "`wcRefundSweeper`, `wcSettlementSweeper` present".
   Production has no `wcSettlementSweeper` (functions list, Cloud Run list, scheduler). The cell is wrong or ambiguous.
6. **INCIDENTS 2026-09-10 (till credited a refunded web deposit)** metadata still says "fixed in source (`3a02620`),
   NOT deployed"; `R-2026-09-10-B` records it released on `hosting:salown`.
7. **`FIN-ONLINE-TENDER` `LIVE_VERIFIED` / INCIDENTS 2026-09-05 "Resolved"** are correct but closed the *gross online
   leg only*. The same incident deferred "surface `CANONICAL_BASE_MISMATCH` on the Finance page" and "collapse the two
   revenue paths" to FIN-PROCESSOR-FEES Phase 2 — neither exists.
8. **`FIN-B1` "committed / staging all passed"** (memory and SYNC wording) describes source and rehearsal only, never a
   production fee. B0 "DONE" is a docs contract.
9. **`GTM_LAUNCH_GATE.md` §4** explicitly excludes `FIN-PROCESSOR-FEES` from the GTM sprint — which explains why nothing
   after 2026-09-10 advanced it.

## 6. Why the owner sees nothing

1. No fee data exists (settlements 0; B1 functions/index/flag not released).
2. No fee screen exists (B2 not built; no mockup).
3. What is live is labelled "Online (prepaid)" and is gross — easy to read as "not the fee work".
4. Finance is gated to tenant `whitecross` and owner / super-admin (`Sidebar.tsx:248`); an `admin` role or any other
   tenant never sees it.
5. Treatwell fee lines render only when `platformFees > 0` (`Finance.tsx:1851,1958`) — 5 whitecross bookings carry it.

## 7. Next steps (dependency order, max 5)

1. Record owners correct §5 items 1–6 (no product change).
2. Re-run `FIN_B1_RELEASE_PREFLIGHT.md` §5 against current heads, re-pin §1, drop the done rules step, confirm the live
   Stripe endpoint event list with a Stripe credential.
3. Owner-approved FIN-B1 release: index → `WC_SETTLEMENT_START_ISO` → `charge.updated` → `stripeWebhook` +
   `wcSettlementSweeper` (flag absent) → flag `true` → verify first live capture (`feeSource: 'actual'`).
4. Separate lane: auto-refund £10 activation test (flag on, one refund, no second). Before or after step 3 — neither
   blocks the other; B1b would make its fee cost visible later.
5. Owner decides fee P&L day (service vs payment); then B1b + B2 Finance fee line, including the refund-after-checkout
   behaviour in §4 items 3–4 as fixture tests.

---

## 8. Follow-up, same day (2026-09-14, later) — records corrected, preflight re-derived

**Status records corrected (docs repo, no product change):** §5 items 1–6 — `PROCESSOR_FEES_PLAN.md` header, §8 B1 row
step (5) and §9; ROADMAP `FIN-PROCESSOR-FEES` row; `DEPLOYMENT_STATUS.md` rules / indexes / `functions:whitecross` rows and
the struck "most consequential gap" line; `RELEASE_LEDGER.md` `R-2026-09-09-A` inventory cell (correction appended, the
original words kept); INCIDENTS 2026-09-10 status line. Each carries a dated "Corrected 2026-09-14" note.

**`FIN_B1_RELEASE_PREFLIGHT.md` re-derived** — candidates whitecross-site `22850996`, salown-app `b6c325c`; rules step
removed (done); live `stripeWebhook` bundle re-proven byte-identical to `6817356f` from the downloaded source zip;
functions suite 182/182 on an archive of `22850996`; salown-app ops guards 120/120.

**New findings while re-deriving:**
- The live Stripe endpoint is recorded (2026-08-29) with **no capture/fee-update event such as `charge.updated`** (its only
  `charge.*` event is `charge.refunded`; *wording corrected 2026-09-14 — an earlier version said "no `charge.*` event"*;
  the current subscription is unverified). The 2026-09-09 package assumed
  `charge.succeeded` was present. B1 still runs on `checkout.session.completed`; the fee then comes from the sweeper
  unless `charge.updated` is added. The endpoint list was not read today (no Stripe credential used).
- No activation tool exists for `settlementLedgerEnabled`.

**Finance UX + fee-date decision:** no existing design found; draft written as `docs/FIN_FEES_UX_DRAFT.md`.

**Auto-refund (BL-4) readiness — read-only check, kept separate from B1.** "Only the flag + a £10 test remain" is true for
a *controlled test*, not for routine use:
- VERIFIED: R1/R2 live and inert (`wcRefundSweeper` logs `autoRefundEnabled is not true — inert` 2026-09-14); the flag gate
  is in the deployed `salowncancelbytoken-00070-moq` bytes (source zip); flag absent; owner-only in rules; activation is
  `whitecross-site/scripts/activateAutoRefund.mjs` (dry-run, `--arm --expect-update-time`, audit row).
- VERIFIED coverage limit: intent and actuator both require `paymentProvider === 'EXTERNAL_CHECKOUT'`. Of **92** whitecross
  bookings with a Stripe payment, **18** carry that provider and **74** carry none — those would not refund automatically.
- VERIFIED scope: only the customer's own cancel link outside the 8-hour window writes an intent. Staff/Admin/Staff App and
  parser cancellations never refund. Full refunds only.
- OPEN: no customer refund e-mail or text; `refundState` `NEEDS_REVIEW`/`FAILED` is not shown to the owner (audit logs only);
  the cancel surface has no token/rate limit, which the refund runbook ties to rollout; switching the flag off does not clear
  intents already `REQUESTED`/`NEEDS_REVIEW` (they are paid when it is switched on again) — not in the runbook's stop step.
- UNVERIFIED today: the endpoint's `charge.refunded`/`refund.updated` subscription; "no intent while the flag is off" on
  revision 00070 (proven on 00069 only); whether the legacy whitecross tills (barber-mobile `e652bfac`, barber-panel
  `545d6de1`, both refund-blind in source) are still used — relevant to a partial refund followed by checkout, not to a
  full refund on a cancelled booking.
