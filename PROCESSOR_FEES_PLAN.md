# PROCESSOR_FEES_PLAN.md — payment-rail fees, provider-agnostic, in phases

> **Status (2026-09-14, re-verified read-only — `evidence/fin-processor-fees/2026-09-14-status-audit.md`):** 🟡
> **B0 design complete. B1 IMPLEMENTED IN SOURCE; only its rules arm is in production.**
> Phase 0 (the online tender leg, **gross only**) is LIVE (`FIN-ONLINE-TENDER`, R-2026-09-05-B).
> **B1 source:** `whitecross-site/functions/settlements.js` + the `stripeWebhook` branch, landed `8137711b`;
> `salown-app` side (index + `settlementLedgerEnabled` rules arms) landed `9a9547a`. Functions suite **182/182 pass**
> (re-run 2026-09-14 on a `git archive` of whitecross-site `22850996`). Staging rehearsals on `salown-staging` all passed
> 2026-09-08 (index, real HTTP, scheduler, kill switch) and the staging resources were torn down afterwards.
> **B1 production state, 2026-09-14:** rules arm **LIVE** — ruleset `5e102dd4-e7e7-4950-b12a-14a74daa82e8`
> (`R-2026-09-10-C`, shipped inseparably with GTM A3), `settlementLedgerEnabled` ×5, byte-identical to salown-app
> `HEAD:firestore.rules`. Everything functional is **absent**: no `wcSettlementSweeper` (functions list, Cloud Run, Scheduler);
> `stripeWebhook` still `stripewebhook-00106-dof` (bundle byte-identical to `6817356f`); **2** composite `bookings` indexes,
> `settlementSync` not among them; flag absent; `settlements` collection-group count **0**. No Finance reader exists.
> *Corrected 2026-09-14: the 2026-09-09 status said the rules arm was absent and B1 was blocked on COA; COA and the arm went
> live together on 2026-09-10.* Current release package: `FIN_B1_RELEASE_PREFLIGHT.md`.
> B1b and later packages remain planned. This document is the B0 data contract; it is not an implementation or release
> approval, and the source being ready is not a release approval either.
> **Owner decisions that created this document:** "Stripe's cut needs its own calculation in Finance — split it into
> phases. Finance is premium; many tenants will never use it, so Reports/Insights must stay provider-agnostic. We are on
> Stripe today; tomorrow we may buy a different card machine with different fees." (2026-09-05) · "Don't leave the
> architecture choice to me as fast-vs-correct; bring the evidenced recommendation." (2026-09-06)
> **Related:** `src/utils/tenderFacts.ts` (the online leg) · `functions/src/advances/advanceCore.ts` (the advance ledger and
> the 2026-09-02 decision) · `whitecross-site/functions/externalCheckout.js`, `index.js` (the live Stripe path) ·
> `docs/INCIDENTS.md` 2026-09-05 (online money invisible in every tender view) · ROADMAP `FIN-ONLINE-TENDER`,
> `FIN-PROCESSOR-FEES`.

---

## 0 · The problem in one paragraph

Money reaches a salon over several **rails**: cash at the desk, a card terminal at the desk, a website payment (Stripe
today), and aggregator prepayments (Booksy, Fresha, Treatwell). Every rail except cash keeps a **fee** before the money
lands in the bank, and every rail prices it differently. Finance shows the customer-facing amount (gross) and, for
Treatwell only, subtracts a commission the parser already knows (`twFeeTotal`). Stripe's fee, the terminal's fee and
Booksy's cut are invisible, so **Bank Balance is overstated by every fee not yet modelled**. A fee is a **cost**, never a
reduction of revenue: gross stays what the customer paid, the fee is a line under *Expenses & Fees*, net is derived.

## 1 · Principles

1. **Rail, then provider.** A settlement names the rail it came over and the provider that ran it. Swapping providers is
   configuration, not code.
2. **One writer per fact, one reader everywhere.** The component that knows the truth (webhook, sweeper, parser) writes
   it once; every presenter reads the same projection through `tenderFacts`. No presenter recomputes a fee from a rate
   table it keeps privately (INCIDENTS 2026-08-30 and 2026-09-05: presenter/writer splits).
3. **Actual beats estimate; unknown is not zero.** `feeSource` says which the reader got. An estimate never overwrites an
   actual. A missing fee is `null` and is rendered as "unknown (n transactions)", never as £0.
4. **Append-only.** No settlement entry is ever edited. Corrections and rollbacks are compensating entries. Readers
   derive the current truth by folding entries with a fixed precedence.
5. **Premium stays premium; platform stays neutral.** Finance (whitecross, Tier 3) may show provider names, payout
   timing and reconciliation. Reports/Insights (every tenant) shows at most *net of rail fees* with a generic label.
6. **No real money movement is dropped silently.** A second collection, a refund, a failed payout — each becomes an
   entry and, where the product cannot resolve it, a review flag. Nothing here spends or refunds automatically.
7. **Historical figures are measurements, not expectations.** Numbers quoted below carry their measurement date and
   query scope; acceptance tests measure their own fixtures.

## 2 · Where the record lives — decision, with the evidence

### 2.1 The 2026-09-02 owner decision (verbatim, `functions/src/advances/advanceCore.ts:3-9`)

> "booking advance payments, receivables ile aynı fold aritmetiğini kullanan kardeş, booking-bound append-only
> koleksiyonda yaşayacak. Receivables dokümanının yaşam döngüsü genişletilmeyecek. platformDepositAmount yalnız derived
> compatibility projection olacak. Faz 1'de mevcut Stripe/legacy prepayment bulunan booking'e yeni in-salon advance
> ekleme fail-closed reddedilecek; farklı rail'ler scalar üzerinde konsolide edilmeyecek."

Consequences this plan must respect: (a) `platformDepositAmount` and `paidAmount` are **derived projections**, not
records — the whitecross webhook writes `paidAmount = total, platformDepositAmount = 0` for a FULL payment
(`externalCheckout.js:1044-1051`) and the desk checkout later inverts them (`src/firestoreActions.ts:657`); (b) no new
rail scalar goes on the booking; (c) different rails are never consolidated in one number.

### 2.2 The advance ledger does NOT cover processor fees

* Its subject is "money taken at the **desk**, today, for a service delivered later" (`advanceCore.ts:1`).
* Its kinds are COLLECTED, TRANSFERRED_IN, REFUNDED, REDEEMED, TRANSFERRED_OUT, RETAINED_AS_FEE (`:123-127`);
  `RETAINED_AS_FEE` is a cancellation fee the **salon keeps from the client**, not a fee a processor keeps from the salon.
* Its fold vocabulary is PAYMENT / REFUND only (`:139-141`); a processor fee is neither an inflow nor an outflow of the
  held balance, so folding it there would break the ledger's own invariants (`M3_NON_NEGATIVE_PAID`).
* A booking with an existing Stripe prepayment is a **foreign rail** to it: new desk advances are refused fail-closed
  (owner decision above; `advanceGuard`).
* It has no fee field and no writer yet (no `index.ts` export).

### 2.3 The one recommendation: a sibling **settlement ledger**

`tenants/{tid}/bookings/{bookingDocId}/settlements/{entryId}` — booking-bound, append-only, integer minor units, one
currency per entry, corrections by compensating entry. Exactly the discipline of the advance ledger, next to it, for a
different question: *what did each rail actually do with this booking's money?*

| Ledger | Question it answers | Owner |
|---|---|---|
| `advances/` | How much did the salon take at the desk before the visit, and what happened to that held money? | desk writers (not yet wired) |
| `settlements/` | What did the provider capture, keep, refund and pay out for this booking, and on which dates? | provider-facing writers: Stripe webhook + sweeper, parsers, backfill scripts |

**Why not flat fields on the booking:** they are what 2.1 forbids, they are un-auditable (one scalar cannot say which
event set it), and they would need a second migration into a ledger later. The earlier `paymentRails[]` array proposal
is withdrawn for the same reasons: an array on the booking is still a scalar family that every writer must re-read and
rewrite whole.

**Why not the advance ledger:** 2.2.

**Second migration later?** No. Entries are the permanent record; a backfill writes the same entries under the same
contract; only the derived projection (2.6) can change shape, and it is recomputed from entries.

### 2.4 Entry identity

The document id is derived from the **provider object id**, so a repeated delivery or a second event about the same
object writes the same document (create-if-absent) and is a no-op:

| entryId | kind | Provider object |
|---|---|---|
| `stripe:ch_<id>` | `CAPTURED` | Charge |
| `stripe:txn_<id>` | `FEE_ACTUAL` | Balance transaction of the charge |
| `stripe:re_<id>` | `REFUNDED` | Refund |
| `stripe:po_<id>:txn_<id>` | `PAID_OUT` | Payout membership of a balance transaction |
| `estimate:v<rateVersion>:ch_<id>` | `FEE_ESTIMATE` | the `railFees` rate table (§4) |
| `treatwell:<externalId>` | `FEE_ACTUAL` (provider `treatwell`) | parser (later package) |
| `comp:<uuid>` | `COMPENSATION` (`compensatesEntryId`, `reason`, `batchId?`) | a correction or rollback |

Every entry carries: `kind`, `rail` (`online_checkout` \| `aggregator_prepaid` \| `desk_card`), `provider`,
`providerAccountId` (Stripe `acct_…` of the key that took the money), `livemode`, `currency`, the amounts of its kind in
minor units, the provider timestamps of its kind, `bookingDocId`, `recordedBy`
(`stripe-webhook` \| `wcSettlementSweeper` \| `parser:treatwell` \| `script:<name>`), `recordedAt`, and for
`COMPENSATION` the entry it compensates and why. Entries are never updated or deleted.

### 2.5 Amount contract (names are exact; Stripe's own names keep Stripe's meaning)

| Name | Definition | Source |
|---|---|---|
| `gross_m` | what the customer was charged on this rail | `charge.amount_captured` |
| `fee_m` | the rail's fee on the capture | `balance_transaction.fee` |
| `providerNet_m` | the provider's own net of the capture = `gross_m − fee_m`, **before refunds** | `balance_transaction.net` (Stripe: "amount − fee") |
| `refunded_m` | Σ refund amounts | Refund objects; cross-check `charge.amount_refunded` |
| `feeOnRefund_m` | any fee the provider charges on a refund | the refund's own balance transaction `fee` (card refunds: expected 0; modelled, not assumed) |
| `settledNet_m` | **our** derivation = `providerNet_m − refunded_m − feeOnRefund_m` | fold |

`providerNet_m` is never presented as "net after refunds"; `settledNet_m` is never presented as Stripe's net.

### 2.6 The projection and how a reader derives the current total

`booking.settlementProjection` is written by every settlement writer **inside the same transaction** that appends the
entry, and is always recomputed from **all** entries (never incrementally):

```
projection = fold(entries):
  drop every entry named by a COMPENSATION (and the COMPENSATION itself)
  gross_m        = Σ CAPTURED.gross_m
  captures       = count(CAPTURED); multipleCharges = captures > 1
  fee_m, feeSource:
      if any FEE_ACTUAL for a CAPTURED charge   → Σ actual fee_m, 'actual'
      else if any FEE_ESTIMATE                  → Σ estimate fee_m, 'estimate'
      else                                      → null, null            # unknown ≠ 0
  providerNet_m  = gross_m − fee_m             (null when fee_m is null)
  refunded_m     = Σ REFUNDED.amount_m ; feeOnRefund_m = Σ REFUNDED.feeOnRefund_m
  settledNet_m   = providerNet_m − refunded_m − feeOnRefund_m   (null when providerNet_m is null)
  paidOut        = { payoutIds, lastPayoutStatus, lastArrivalDate }  (informational; §5 dates)
  version        = count(entries)
```

Readers (Finance, Reports, Sales) read the projection through `tenderFacts` only. `online_p` (Phase 0) stays what it is
today — the salon's gross receipt over the booking rail — and will be reconciled to `gross_m` by acceptance test T5
(§7) once B1 writes captures; until then it keeps coming from `platformDepositAmount`.

**State transitions, all by appending:** unknown → actual: a `FEE_ACTUAL` entry appears. estimate → actual: both entries
exist, the fold's precedence picks actual, the estimate remains as history. wrong actual (e.g. a later dispute fee):
a `COMPENSATION` naming the old entry plus a new `FEE_ACTUAL`. Rollback of a batch (backfill): one `COMPENSATION` per
entry of that `batchId`; originals, their `recordedBy` and any webhook entries that arrived later stay untouched and
keep folding.

## 3 · Stripe facts — verified against the official API reference (2026-09-06)

| Fact | Source | Standing |
|---|---|---|
| Balance transaction: `fee` "Fees paid for this transaction"; `net` = `amount − fee`; `available_on` "date that the transaction's net funds become available in the Stripe balance"; `status` `available`/`pending` | API reference, Balance Transaction object | verified |
| Charge: `balance_transaction` "ID of the balance transaction that describes the impact of this charge on your account balance (not including refunds or disputes)" — **nullable, expandable**; `amount_captured`, `amount_refunded`, `refunded` (true only when fully refunded) | API reference, Charge object | verified |
| Payout: `arrival_date` "Date that you can **expect** the payout to arrive in the bank"; `status` `paid`/`pending`/`in_transit`/`canceled`/`failed`, and "some payouts that fail might initially show as `paid`, then change to `failed`"; `reconciliation_status: completed` allows listing the balance transactions paid out in that payout | API reference, Payout object | verified |
| Refunds: "Stripe's processing fees from the original transaction aren't returned"; more than one refund per charge is allowed, never exceeding the charge; `charge.refunded` fires for partial refunds too | Refunds guide | verified |
| Webhooks: live-mode retries "for up to three days with an exponential back off"; "Stripe doesn't guarantee the delivery of events in the order that they're generated"; duplicates possible, dedupe by event id, and "in some cases, two separate Event objects are generated" — use `data.object.id` + `event.type`; manual resend 15 days (Dashboard) / 30 days (CLI) | Webhooks guide | verified |
| `checkout.session.completed` carries the Session (with `payment_intent` id); the fee lives on the Charge's balance transaction, not in that payload | API object shapes | API inference, not a code finding |
| Neither repo reads `balance_transaction` or `payout` anywhere; SDK `stripe` 18.4 (whitecross-site) / 22.2 (salown-app) | grep, `package.json` | code finding |
| Today's dedupe: `stripeEventId` equality, then "already CONFIRMED and paid" — both **before any write** in the transaction | `externalCheckout.js:1098-1105` | code finding |
| A second successful payment for an already-paid booking is returned as `ALREADY_CONFIRMED` **without writing anything** | `externalCheckout.js:1102-1105` | code finding — the money is real and currently unrecorded |
| whitecross pays on its **own** Stripe account (`WC_STRIPE_SECRET_KEY`), so the fee is entirely the salon's cost; the salOWN Connect path (`salown-app/functions/src/index.ts:4087-4120`) adds `application_fee_amount` and is enabled for no tenant | `whitecross-site/functions/index.js:614-635`; live tenant docs read 2026-09-05 | code + data finding |
| Only `gbp` is accepted on the live path; Connect hard-codes `gbp` | `externalCheckout.js:70`; `index.ts:4097` | code finding |

## 4 · Rate configuration (later package) — `settings/settings.railFees`

Owner-only, per tenant, produces `FEE_ESTIMATE` entries only: `{ desk_card: {provider, pct, fixed_m}, online_checkout:
{provider, pct, fixed_m}, aggregator_prepaid: {booksy:…, fresha:…, treatwell:{newClientPct, vatPct}} }`, versioned
(`rateVersion`). Changing a rate never rewrites actuals and never rewrites past estimates (a new version, new entries).
The terminal model, its API and Booksy's fee model are **open owner questions** that gate this package, not B1.

## 5 · Dates — seven of them, kept apart

| Date | Field | Meaning | Used by |
|---|---|---|---|
| service | booking `startTime` (fallback `date`) | the appointment's start | **revenue in every view today** (Finance, Reports, Sales — measured in §5.1). Not the fee day |
| checkout | booking `checkedOutAt`, calendar day in the **salon's time zone** | when the sale was checked out | **the fee day in P&L — owner decision 2026-09-15** (§9, tests T11–T18) |
| payment | `paidAt` | when the customer paid | Sales/Reports "paid on" |
| fee known | `balance_transaction.created` | when Stripe priced the capture | audit |
| available | `available_on` | when funds become usable in the Stripe balance | Stripe-balance bridge |
| expected arrival | `payout.arrival_date` | Stripe's **estimate** of bank arrival | information only, never "in the bank" |
| arrived | payout `status = paid` **and** a matching bank statement line | the only "money in the bank" | bank reconciliation (§7) |

### 5.1 Fee day vs revenue day — measured 2026-09-15 (read-only; revenue date NOT changed)

**Which day revenue books on today (source):** Finance `dateKey = tenantDayKey(startTime)`, with a fallback to
`date`+`time` (`src/pages/Finance.tsx:377-381`). Reports builds daily revenue from `startTime`
(`src/pages/Reports.tsx:251,326`); Sales uses canonical `startTime` (`src/utils/salesPeriod.ts:191-209`). None of them read
`checkedOutAt`. **The fee day (checkout) and the revenue day (appointment start) are therefore different fields.**

**Writers of `checkedOutAt`:** the Admin/Staff till `checkoutBooking` stamps `new Date()` at checkout
(`src/firestoreActions.ts:680,787`). It does so unconditionally, so **a correction re-checkout overwrites it** with the
correction time (open point T18). Product sales stamp their sale date (`:1059`, `functions/src/sales/productSaleCore.ts:359`).
The not-yet-called server executor stamps `now` (`functions/src/checkout/executor.ts:1508`). Historical aggregator imports
write `CHECKED_OUT` without a checkout stamp (`functions/src/parsers/booksy.ts:374`, `fresha.ts:293`).

**Production census, `tenants/whitecross/bookings`, status CHECKED_OUT, day in Europe/London (aggregates only):**

| Measure | Count |
|---|---|
| CHECKED_OUT bookings | 1,799 |
| `checkedOutAt` **missing** | 564: 563 walk-ins with appointment dates Feb–May 2026, 1 Fresha |
| checkout day = appointment day | 1,142 |
| checkout day ≠ appointment day | 93: +1 day 27 · +2…+7 days 17 · **> 7 days 47** · −1 day 1 · < −1 day 1 |
| … of which the checkout falls in a **different month** | 47. All land in May–Jul 2026, mostly Mar/Apr → May, which is consistent with later correction re-checkouts; the cause is not proven |
| bookings with an online payment (`stripeAmountPaid` or `platformDepositAmount` > 0) | 150 |
| … online-paid, checkout day ≠ appointment day | 6 (5 Booksy, 1 website; 4 cross a month; all dated Mar–Jun 2026) |
| … online-paid, `checkedOutAt` missing | 0 |
| stored closed Finance periods (`financePeriods`) | 0 documents |

**Impact:**
- **Today:** none. No Stripe fee is recorded yet (B1 not deployed), and every mismatch above predates any possible
  `WC_SETTLEMENT_START_ISO`.
- **Once B1 + B2 run:** a fee sits on the checkout day while its revenue sits on the appointment day. In the measured
  history that happens for 6 of 150 online-paid bookings (4.0 %), and for 4 of them the two fall in different months.
  Daily and monthly Net Revenue then carry a fee without its sale, or a sale without its fee. B2 must show this rather than
  hide it: T12 (fee on checkout day) together with T17 (revenue unchanged).
- **Missing `checkedOutAt`:** none on online-paid bookings today. The 563 legacy walk-ins carry no online fee, so T15's
  review list starts empty.
- **Re-checkout:** the 47 checkouts landing more than a week after the appointment show that `checkedOutAt` is not a
  stable first-checkout time. Deciding T18 is required before B2 ships.

## 6 · Writers, retries and idempotency

### 6.1 Two idempotency boundaries, deliberately separate

* **Booking confirmation** (existing, untouched): keyed by `stripeEventId` and booking state; returns early
  (`DUPLICATE_EVENT`, `ALREADY_CONFIRMED`) before any write.
* **Settlement entries** (new): keyed by provider object id (2.4). The settlement path runs **regardless of** the
  confirmation gates: the handler resolves the booking, then independently asks "does `stripe:ch_…` / `stripe:txn_…`
  exist? if not, create". An `ALREADY_CONFIRMED` booking therefore still gets its fee recorded.

### 6.2 Stripe API calls never inside a Firestore transaction

Order in every writer: (1) take ids from the event; (2) **outside any transaction** call
`paymentIntents.retrieve(pi, { expand: ['latest_charge.balance_transaction'] })` (idempotent read); (3) one Firestore
transaction: read the booking + its settlement entries, create the missing entries, recompute the projection from all
entries. A transaction retry re-runs only step 3; an interrupted run leaves either nothing or a complete, consistent
set, because the projection is derived, not incremented.

### 6.3 Completing a late or missing fee — the concrete mechanism

* Webhook subscriptions: `charge.succeeded` and `charge.updated` (the latter covers a `balance_transaction` that was
  `null` at capture time).
* **`wcSettlementSweeper`** (scheduled, precedent `wcRefundSweeper`): two bounded passes, both idempotent.
  *Due pass:* bookings whose `settlementSync` is pending/failed and due (composite index
  `settlementSync.state ASC, settlementSync.nextAttemptAt ASC`), oldest first, no age window — same retrieve, same
  idempotent write. *Provider scan (B1 revision, 2026-09-07):* discovery is **provider-side**, not booking-side.
  Stripe `charges.list` over a bounded `created` window `[scannedUntil, now − lag)` (Stripe: most-recent-first,
  `limit ≤ 100`, `starting_after`, `has_more`, `created` interval — verified against the API reference), expanded with
  balance transactions; each charge is resolved to its booking by PaymentIntent, then by Checkout Session metadata, and
  recorded exactly as the webhook would. So a new charge on an old booking, a second charge on a `done` booking, and a
  charge captured while the kill switch was off are all found; a charge created before `WC_SETTLEMENT_START_ISO` is
  never even listed, so nothing historical is written by this path. The cursor (`platform/settlementScan.scannedUntil`)
  advances only after a window is listed to its end and every charge in it is handled; **within a window a persistent
  page cursor** (`page.{from,to,startingAfter,version}`) is committed after every fully handled page, in a transaction
  that requires the expected state — a concurrent or stale invocation cannot overwrite newer state, an interruption
  re-lists the same page and entry ids make that a no-op, and a window larger than one run's page budget is continued
  next run (at least one page of progress per run, never skipped, never halved). *Kill switch authority:*
  `settings/settings.settlementLedgerEnabled` is owner authority in `firestore.rules` (all four settings arms, like
  `autoRefundEnabled`; `test/rules/settlementLedgerFlag.emulator.test.js`) — that rules change is a **separate,
  owner-approved ruleset release** and a B1 release dependency. Rehearsal happens only in the emulator or an explicitly
  isolated test/staging project; the composite index is never exercised against production as a rehearsal.
  A charge that resolves to no booking (or to two) is queued under `platform/settlementScan/unmatched/{stripe:ch_…}`
  with backoff — visible, retried, never bound to a guess, never blocking the cursor (single-field range query, no new
  composite index). Cost per run is bounded and reported (`maxPages`, `pageSize`, `unmatchedLimit`).
  Discovery by `booking.paidAt` was tried and withdrawn: it could not see a new charge on an old booking, nor a second
  charge on a booking already marked done.
* Two Event objects for one fact, or the same event redelivered: same entry id → no-op.

### 6.4 A second collection is never silent

If a capture arrives for a booking that already has a different `CAPTURED` charge (Session metadata `bookingDocId`
matches, `chargeId` differs — `externalCheckout.js:862` puts both identities in metadata), the writer appends the
second `CAPTURED` entry, the projection sets `multipleCharges: true`, and the booking gets
`paymentNeedsReview: true` with reason `SECOND_CAPTURE` (the existing review-flag pattern,
`externalCheckout.js:1119-1123`). **No automatic refund.** Reconciliation proposal: Finance lists such bookings in a
"needs review" strip; the owner resolves with the existing refund actuator (`wcExternalCheckoutRefund`) or marks the
second capture as intended (a `COMPENSATION` with reason). Today this money is dropped at `ALREADY_CONFIRMED`; making it
visible is part of B1.

### 6.5 Fee sources are per provider, never per booking

For provider *P*, the reader takes `FEE_ACTUAL(P)` from the ledger when present, else *P*'s legacy field
(`twFeeTotal` for Treatwell; Stripe has no legacy field), else `FEE_ESTIMATE(P)`, else unknown. A Stripe entry never
hides a Treatwell fee and vice versa; a booking cannot be charged twice for one provider's fee because the ledger holds
at most one active `FEE_ACTUAL` per capture. Test-pinned (T7).

## 7 · Acceptance tests and reconciliation

Fixed scope for every revenue/tender test: CHECKED_OUT bookings · period by **service date** · GBP-only
(`isGbpOnlySafe`) · the surface's own revenue base (`effectiveRevenue` in Finance, `financeNet` in Reports,
`bookingNet` in Sales).

| # | Test | Where |
|---|---|---|
| T1 | Row level, canonical rows: `collected.total_p + online_p === base_p` ⇔ no `CANONICAL_BASE_MISMATCH` | `tenderFacts.test.ts` (exists as the mismatch check; add the live-shaped fixture) |
| T2 | Surface level: Σ(cash + card + other + online) = Σ base; and the cash, card and online views reproduce `all` | `tenderSelection.test.ts` (second half exists) |
| T3 | Finance Day = Month: Σ daily `grossRevenue` (filter All) = `partnershipByMonth.grossRev` for the same month | new Finance parity test |
| T4 | Fees never move revenue: with and without settlement entries, `effectiveRevenue`, `financeNet`, `bookingNet`, `online_p` are byte-identical | new |
| T5 | Capture parity: for a booking with `CAPTURED`, `projection.gross_m === online_p` (Phase 0 leg) or the row is listed | new, B1 |
| T6 | Stripe invariant on every `FEE_ACTUAL`: `fee_m + providerNet_m === gross_m` | B1 |
| T7 | Per-provider fee source: a fixture with both a Stripe `FEE_ACTUAL` and a Treatwell `twFeeTotal` counts each once and neither hides the other | B1 / Finance phase |
| T8 | Idempotency: same event twice → one entry each; `checkout.session.completed` after `charge.succeeded` → confirmation unchanged, fee completed by the sweeper; `balance_transaction: null` → `fee_m: null`, later `charge.updated` fills it; a failed retrieve writes nothing | B1 |
| T9 | Precedence: `FEE_ESTIMATE` then `FEE_ACTUAL` → projection actual, estimate entry still present; a `COMPENSATION` removes its target from the fold | B1 |
| T10 | Second capture: different `chargeId`, same booking → second `CAPTURED`, `multipleCharges: true`, `paymentNeedsReview: true`, booking money fields untouched, no refund call | B1 |

Source-level assertions for B1 (same standard as `analyseCompPeriods.test.js`): no Stripe API call inside
`runTransaction`; the settlement writer never touches `paidAmount`, `platformDepositAmount`, `paymentAllocation`,
receipt or loyalty fields.

### 7.1 Fee day — owner decision 2026-09-15 (B2 reader; B1 unchanged)

The fee day is a **reader derivation**, not a stored field: B1 keeps writing every provider date separately (§5) and the
projection gains no "fee day". The B2 reader places a fee by `booking.checkedOutAt`, converted to a calendar day in the
salon's time zone (the same zone Finance already uses for `tenantDayKey`). Revenue keeps its own day (§5.1) and is not
changed by this decision.

| # | Test | Where |
|---|---|---|
| T11 | **Salon time zone, not UTC or the browser.** A capture checked out at 23:30 UTC on the last Saturday of October (BST, so 00:30 local on the next day) lands on the salon's next calendar day. A second fixture in winter time lands on the same day. The browser time zone of the test runner does not change the result. | B2 reader, new |
| T12 | **Checkout day only.** One booking whose `startTime`, `paidAt`, `balance_transaction.created`, `available_on`, `payout.arrival_date` and `checkedOutAt` fall on six different days. The fee appears on the `checkedOutAt` day and on no other day, in the Day, Week and Month views. | B2 reader, new |
| T13 | **Late fee keeps the checkout day.** `FEE_ACTUAL` recorded (`recordedAt`) days after checkout, or a pending fee completed later by the sweeper, is attributed to the original checkout day, not to the day the fee arrived. | B1 fixture + B2 reader |
| T14 | **Closed period is not restated.** The checkout day falls in a stored (closed) period. The period's stored totals are byte-identical before and after the fee arrives. The fee reaches Finance only through the existing post-close adjustment path (`FIN_PERIOD_CLOSE_DESIGN.md` §8): a super-admin `PeriodAdjustment` on the operating expense component, shown as a prior-period memo. The reader never adds it silently to the closed month or to the open month. | B2 reader + period-close reader, new |
| T15 | **Missing `checkedOutAt`: no silent fallback.** A `CHECKED_OUT` booking with a fee and no `checkedOutAt` gets no day. It is not placed by `startTime`, `paidAt`, `date` or `updatedAt`. It is listed for review (`FEE_DAY_UNRESOLVED`), counted in coverage, and the affected totals are shown as incomplete. | B2 reader, new |
| T16 | **No checkout: no automatic date.** A fee on a booking that was paid and then cancelled or fully refunded without ever being checked out gets no day and is listed separately. Assigning it a date is a separate owner decision (§9), so this test pins the absence of a date. *2026-09-15 (owner): the date stays undecided on purpose; it will be chosen from a worked example in which the cancellation and the refund fall on different days.* | B2 reader, new |
| T17 | **Revenue untouched** (extends T4). With fee-day attribution on, every revenue figure and its day bucketing are byte-identical: `effectiveRevenue` by `startTime` in Finance, Reports and Sales. | new |
| T18 | **Re-checkout keeps the first checkout day — DECIDED 2026-09-15 (owner).** A technical correction re-checkout must not move the fee to another day: the fee day is the **first successful checkout time**. A genuine change of the checkout date is a separate, audited operation, not a side effect of re-checkout. Where existing data cannot show the first checkout time, it is **not estimated** — the fee gets no day and goes to review (as T15). *Implementation gap, not yet built:* today a correction re-checkout overwrites `checkedOutAt` with the correction time (`src/firestoreActions.ts` ~680/787, unconditional), so the reader alone cannot honour this; it needs a write-once first-checkout time from the checkout writer (field name and package not decided). Until then, a booking with evidence of a re-checkout cannot be dated from `checkedOutAt`. Test: checkout on day 1, correction re-checkout on day 3 → fee on day 1; a booking re-checked out before the write-once time existed → no day, review. | B2 reader + checkout writer, pending build |

**Bank reconciliation (Finance phase), three layers — never "service-month online minus fees = payout":**
1. *Inside Stripe:* for a payout with `reconciliation_status = completed`, Σ `balance_transaction.net` over the
   transactions Stripe lists for that payout = `payout.amount`.
2. *Coverage:* every charge/refund balance transaction in that list has a settlement entry; unmatched ones are listed.
3. *Bank:* only payouts with `status = paid`, by arrival date, matched to a bank statement line by amount and date.
   Finance shows a Stripe-balance bridge: opening balance + net captures − refunds − payouts arrived = closing balance.

## 8 · Packages

| # | Package | Scope | Depends on | Release unit | Rollback |
|---|---|---|---|---|---|
| **0** | Online leg visible | `tenderFacts.online_p`; Finance/Reports/Sales | — | `hosting:salown` — **LIVE** `ff183fbbb067b6b7` | previous version |
| **B0** | This contract | §2–§7 | — | docs only — **DONE 2026-09-07** | — |
| **B1** | Stripe captures + actual fees, new payments only | `stripeWebhook`: handle `charge.succeeded`/`charge.updated` (the fee arrives with `charge.updated` — verified on the real test API: `balance_transaction` is `null` in `charge.succeeded`), retrieve outside the transaction, append `CAPTURED` + `FEE_ACTUAL`, recompute projection; **`wcSettlementSweeper`**: due pass + provider scan with persistent page cursor; second-capture flag; kill switch `settlementLedgerEnabled`. Confirmation gates and every existing booking field untouched. **No Finance change, no hosting release.** | B0 · composite index (`settlementSync.state`, `settlementSync.nextAttemptAt`) · `charge.updated` subscription on the live endpoint · env `WC_STRIPE_ACCOUNT_ID`, `WC_STRIPE_LIVEMODE`, **`WC_SETTLEMENT_START_ISO` set once, at first release, and never moved on a redeploy** (it is the ledger's permanent origin) · rules release (`settlementLedgerEnabled` owner authority) | in this order (preflight `FIN_B1_RELEASE_PREFLIGHT.md`, candidate identities are maintained only in preflight §1 and must pass its pre-release re-check): (1) index deploy — **`FIN-B1-INDEX-DRIFT` is closed** (`9a9547a` wrote the two live indexes into `salown-app/firestore.indexes.json`; verified read-only 2026-09-09: live 2, file 3, live-not-in-file none), so this deploy now **creates** the `settlementSync` index and deletes nothing; still never answer a deletion prompt with yes; (2) env values; (3) `charge.updated` subscription; (4) targeted Functions deploy of exactly `stripeWebhook` + `wcSettlementSweeper` with the flag absent/false (both inert, logs show `DISABLED`); (5) ~~rules last~~ — **done 2026-09-10** inside `R-2026-09-10-C` (ruleset `5e102dd4-…`, together with A3; not separately rollbackable), so the 2026-09-14 package has no rules step; (6) owner sets the flag `true` only after (5) is verified | **Stop = flag `false`**: new invocations inert at once; in-flight ones finish (webhook ≤ its timeout, sweeper ≤ 120 s, no retry); then verify quiescence (no new `settlements` entry / marker across two scheduler intervals). Then, if needed: pause the Cloud Scheduler job, `functions:delete wcSettlementSweeper` (there is no earlier revision of a new function to return to), redeploy `stripeWebhook` from the previous source SHA to drop the branch. The index is left in place (it is inert and deleting it is not a rollback step); entries already written are correct facts and stay |
| B1b | Refund entries — **`BLOCKED` (2026-09-15):** the writer change belongs in `functions/settlements.js` (+ `settlements.test.js`, `settlements.fakes.js`, `stripeWebhook.integration.test.js`), all held by the `FIN-B1-SETTLEMENTS` claim in the whitecross-site registry "until production release". The fold already reads `REFUNDED` entries and `refundsComplete`; missing are the writer, the refund entry ids `stripe:re_…`, and partial / full / repeated-event tests. Owner decision needed to release or hand over the claim | `REFUNDED` entries from the existing `charge.refunded` reconcile (`index.js:700-735`) | B1 | same unit | same |
| B2 | Finance shows fees — **2026-09-15: the policy-free part is in source, `PUSHED_NOT_LIVE`, salown-app `74922bd`.** It adds `src/utils/settlementFacts.ts` (the one reader of `settlementProjection`, `settlementSync`, review flags and refund fields: known / partial / estimate / pending / not recorded / unresolved / unreadable; unknown fee = null) and a Stripe fee block in the booking detail (`OnlinePaymentFees`). No P&L, Bank Balance, fee-day or closed-period change. The parts below are **not started** | *Expenses & Fees* line per provider (actual/estimate labelled; unknown counted, not zeroed), Bank Balance and Net P&L net of fees, `multipleCharges` review strip, `CANONICAL_BASE_MISMATCH` count; Treatwell line becomes the provider rule of §6.5 | B1 (P&L day decided 2026-09-15: checkout day; §9 edge cases still open) | `hosting:salown` | previous version |
| B3 | History, read-only first | script: every `stripePaymentIntent` since go-live → Balance Transactions → CSV (no writes); then, on approval, a batch-stamped backfill of entries | B1 contract | script; then a production operation with a ledger row | per-batch `COMPENSATION` entries (2.6); nothing nulled |
| B4 | Reports, all tenants | optional "net of rail fees", provider-neutral | B2 | `hosting:salown` | previous version |
| B5+ | Other providers | parser fee entries (Treatwell first), `railFees` estimates, terminal APIs | owner answers (§9) | per provider, feature-flagged | per provider |

## 9 · Open decisions, bound to the phase that needs them

| Decision | Needed by | Blocks B1? |
|---|---|---|
| ~~P&L day for fees~~ — **DECIDED 2026-09-15 (owner, refined the same day): the fee belongs to the day the checkout happened** — not the appointment/service day, not the online payment day, not the payout day. (1) Source: `booking.checkedOutAt`, as a calendar day in the salon's time zone (T11, T12). (2) A fee Stripe reports later still attaches to that checkout day (T13). (3) If that period is closed, stored totals are not changed silently; the existing post-close adjustment mechanism is used (T14). (4) No `checkedOutAt` → no fallback to any other date; raised for review (T15). (5) The fee left on a payment cancelled or fully refunded **without** a checkout is a **separate decision** — this one assigns it no date (T16). **Added 2026-09-15 (owner):** (6) re-checkout keeps the **first successful checkout time**; a real date change is a separate audited operation; a first checkout time that the data cannot show is not estimated (T18 — needs a write-once first-checkout time, not built). (7) The no-checkout fee date stays open on purpose and will be chosen from a worked example where cancellation and refund fall on different days (T16). (8) Closed periods: confirmed — never changed silently, only through the post-close adjustment path (T14); **which open-period day a refund lands on is still a separate, open decision.** (9) B1 is its own release lane that starts fee collection; B2a verification does not wait for the B1 deploy. Revenue stays where it is today (`startTime`); the owner asked for the impact to be shown, not for revenue to move — see §5.1 | B2 | **No** — B1 stores every provider date separately (§5) |
| Second capture handling beyond the flag (refund vs keep) | B2 review strip | **No** — B1 records and flags, never spends |
| Card terminal on the counter: model, API or statements only; Booksy fee model (per booking / subscription / both) | B5+ (`railFees`, terminal APIs) | **No** |

**B1 design blockers: none** — no open decision in this table blocks B1, and implementation approval has been given and
spent: the code is written, tested (182/182) and rehearsed on staging. **B1 release blockers (2026-09-14):**
~~(1) COA first~~ — **cleared 2026-09-10**: `R-2026-09-10-C` released COA and B1's `settlementLedgerEnabled` rules arm
together (ruleset `5e102dd4-…`), so B1's rules step is already done. Still open: (a) the targeted-deploy approval for
the index + functions sequence; (b) the live Stripe endpoint's event list, which has not been read since 2026-08-29 and
then carried no capture/fee-update event such as `charge.updated` (its only `charge.*` event was `charge.refunded`;
current subscription unverified — `FIN_B1_RELEASE_PREFLIGHT.md` §2). Until both clear, the kill-switch flag stays absent.

## 10 · Historical reference measurements (not live expectations)

Measured 2026-09-05 from Firestore, CHECKED_OUT bookings with `platformDepositAmount > 0`, `startTime` bucketed by UTC
date, from 2026-08-01: August £130 across 9 bookings; 1–5 September £82 across 6 bookings; 5 September online £32.
These were the Phase 0 gap and its proof; they are not targets for any test.

## 11 · Out of scope

Refund fee treatment beyond recording `feeOnRefund_m` · multi-currency conversion for TR tenants · VAT treatment of
fees · salOWN's own Connect application fee (platform revenue — `docs/TIERS_AND_UPGRADE.md`) · disputes.
