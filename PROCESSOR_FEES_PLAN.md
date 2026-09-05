# PROCESSOR_FEES_PLAN.md — payment-rail fees, provider-agnostic, in phases

> **Status:** 🟡 PLANNED (2026-09-05). Phase 0 is landing with `FIN-ONLINE-TENDER`; nothing below Phase 0 is built.
> **Owner decision that created this document:** "Stripe's cut needs its own calculation in Finance — split it
> into phases. Finance is a premium feature; many tenants will never use it, so Reports/Insights must stay
> provider-agnostic. We are on Stripe today; tomorrow we may buy a different card machine with different fees."
> **Related:** `src/utils/tenderFacts.ts` (the online leg) · `docs/STRIPE_CONNECT_PLAN.md` · `docs/PAYMENT_SETTINGS.md`
> · `docs/INCIDENTS.md` 2026-08-30 (prepaid double count) · ROADMAP `FIN-ONLINE-TENDER`, `FIN-PROCESSOR-FEES`.

---

## 0 · The problem in one paragraph

Money reaches a salon over several **rails**: cash at the desk, a card terminal at the desk, a website payment
(Stripe today), and aggregator prepayments (Booksy, Fresha, Treatwell). Every rail except cash keeps a **fee**
before the money lands in the bank, and every rail's fee is priced differently — a percentage, a fixed pence
amount, a per-booking commission, or a monthly bundle. Finance today shows the customer-facing amount (gross)
and, for Treatwell only, subtracts a commission the parser already knows (`twFeeTotal`). Stripe's fee, the card
terminal's fee and Booksy's cut are invisible, so **Bank Balance is overstated by every fee not yet modelled**.

The fee is a **cost**, never a reduction of revenue: gross stays what the customer paid, the fee is a line under
*Expenses & Fees*, and net-of-fees is derived. That rule already holds for Treatwell and is kept everywhere.

## 1 · Principles (fixed before any code)

1. **Rail, not provider, is the first-class concept.** A booking records *which rail settled which amount*; the
   provider is an attribute of the rail. Swapping Stripe for another checkout, or one terminal for another, is a
   configuration change, not a code change.
2. **One writer per rail, one reader everywhere.** The rail record is written by the component that knows the
   truth (webhook, parser, desk checkout) and read by every presenter through `tenderFacts`. No presenter
   recomputes a fee from a rate table it keeps privately (the 2026-08-30 lesson: presenter and writer must
   resolve the same fact from the same function).
3. **Actual beats estimate, and the reader can tell which it got.** When the provider tells us the real fee
   (Stripe balance transaction, Treatwell email), it is stored as *actual*. When it cannot (a terminal with no
   API), a configured rate produces an *estimate*, labelled as such on screen. An estimate never overwrites an
   actual.
4. **Premium stays premium; platform stays neutral.** Finance (whitecross-only, Tier 3) may show provider names,
   payout timing and reconciliation. Reports/Insights (every tenant) shows at most *net of rail fees* with a
   generic label, and never a provider-specific control.
5. **No retroactive restatement without a ledger row.** Backfilling historical fees is a production operation:
   read-only dry run → CSV → owner approval → write fee fields only → RELEASE_LEDGER row.

## 2 · Data model — `paymentRails[]` on the booking (additive, optional)

```ts
// tenants/{tid}/bookings/{id}.paymentRails — absent on every booking written before Phase 1
interface PaymentRailSettlement {
  rail: 'desk_cash' | 'desk_card' | 'online_checkout' | 'aggregator_prepaid';
  provider: string | null;      // 'stripe' | 'sumup' | 'zettle' | 'dojo' | 'booksy' | 'fresha' | 'treatwell' | null
  gross_p: number;              // what the customer paid on this rail, pence (minor units per tenant currency)
  fee_p: number | null;         // the rail's fee, pence; null = unknown
  feeSource: 'actual' | 'estimate' | null;   // where fee_p came from
  net_p: number | null;         // gross_p − fee_p when fee_p is known
  externalRef: string | null;   // Stripe balance_transaction id, Booksy booking id, terminal receipt id …
  settledAt: Timestamp | null;  // when the provider paid out, if known
  recordedBy: string;           // 'stripe-webhook' | 'parser:treatwell' | 'desk-checkout' | 'script:stripe-fees-backfill'
}
```

* `online_p` in `tenderFacts` (Phase 0) is exactly the sum of `gross_p` over `online_checkout` +
  `aggregator_prepaid` rails; until Phase 1 writes rails it keeps coming from `platformDepositAmount`.
* Desk legs are already canonical in `paymentAllocation`; a `desk_card` rail adds only the fee facts.
* Nothing here touches `paidAmount`, `platformDepositAmount`, receipts, loyalty or `paymentAllocation`.

## 3 · Rate configuration — `settings/settings.railFees` (owner-only, per tenant)

```ts
railFees: {
  desk_card:        { provider: 'sumup',  pct: 1.69, fixed_p: 0 },   // the machine on the counter
  online_checkout:  { provider: 'stripe', pct: 1.5,  fixed_p: 20 },  // UK/EEA cards; fallback when no actual
  aggregator_prepaid: { booksy: { pct: 0, fixed_p: 0 }, fresha: { … }, treatwell: { newClientPct: 35, vatPct: 20 } },
}
```

Used **only** to produce `feeSource: 'estimate'`. Shown in Finance ▸ Settings with the same owner-only gate
as `checkoutSettings`. Changing a rate never rewrites stored actuals; it changes future estimates and the
*estimated* lines only.

## 4 · Phases

| Phase | Scope | Surfaces | Release unit |
|---|---|---|---|
| **0 — Online leg visible** (this week) | `tenderFacts.online_p`; Finance Day/Week/Month rows, Bank Balance, Monthly Summary; Reports and Sales get an ONLINE method and filter. **Gross only, no fees.** | Finance · Reports · Sales · Staff Sales | `hosting:salown` (+ `hosting:salown-staff` for the staff view) |
| **1 — Rail records from the writers that know** | Stripe webhook stores `online_checkout` rail with the **actual** fee from `charge.balance_transaction` (`fee`, `net`, `available_on`). Treatwell parser moves `twFeeTotal` into an `aggregator_prepaid` rail (field kept for compatibility). Booksy/Fresha parsers write rails with `fee_p: null`. Desk checkout writes `desk_card` with `fee_p: null`. | Functions + parsers | targeted Functions deploy (`./scripts/deploy-functions.sh <names>`) |
| **2 — Finance shows fees** | *Expenses & Fees* gets one line per rail-provider ("Stripe fees −£0.68 (actual)", "Card terminal fees −£1.20 (est.)"); Bank Balance and Net P&L subtract them; the Treatwell line becomes one of these. Finance ▸ Settings gets the `railFees` editor. Estimates labelled; a day with mixed actual/estimate says so. | Finance (premium) | `hosting:salown` |
| **3 — Backfill Stripe actuals for whitecross** | Read-only script over Stripe Balance Transactions (Connect account) → dry-run CSV per booking (`stripePaymentIntent` → `balance_transaction`) → owner approval → writes `paymentRails` only. Reconciles against Stripe payout reports. | script + ledger row | production operation (no release) |
| **4 — Reports / Insights, all tenants** | One optional toggle "net of rail fees" on the finance tab; provider-neutral label; uses the same rail records or estimates. Tenants without Finance still see correct gross by method (Phase 0) and, if they configured rates, an estimated net. Never a provider name in the platform UI. | Reports | `hosting:salown` |
| **5 — Terminal integrations (only if a tenant buys one with an API)** | SumUp / Zettle / Dojo transaction APIs supply actual fees for `desk_card` rails; same rail record, `feeSource: 'actual'`. | Functions | targeted deploy, per provider, behind a tenant feature flag |

Each phase is independently deployable and independently reversible; none rewrites an earlier phase's data.

## 5 · What each phase must prove before it ships

* **0:** parity tool for tenders — cash + card + online views reproduce ALL on every row (`tenderSelection.test.ts`);
  the 2026-08-15 → today Finance gap (£130 Aug, £82 Sep as of 2026-09-05) reappears in Day/Week/Month and the
  Day and Overview views agree for the same month.
* **1:** for every Stripe-paid booking since go-live, `rail.gross_p` equals `stripeAmountPaid × 100` and
  `fee_p + net_p = gross_p` (Stripe's own invariant); Treatwell rail equals the legacy `twFeeTotal` to the penny.
* **2:** Finance Bank Balance for a closed month = Σ card + Σ online − Σ fees − expenses − payments − fixed cost,
  and the fee total matches the Stripe payout report for that month within rounding.
* **3:** dry-run CSV count == number of Stripe-paid bookings; zero rows with `fee_p > gross_p`; before/after
  Finance figures move only on the new fee lines.
* **4:** with rates unset, every tenant's Reports output is byte-identical to Phase 0.

## 6 · Explicitly out of scope

Refund fee treatment (Stripe keeps its fee on refund — needs the refund pipeline from `docs/IN_SALON_DEPOSIT_PLAN.md`
first) · multi-currency fee conversion for TR tenants · VAT treatment of fees · Stripe Connect **platform**
application fees (salOWN's own cut) — these are salOWN revenue, not the salon's cost, and belong in the
platform billing plan (`docs/TIERS_AND_UPGRADE.md`).

## 7 · Open questions for the owner

1. Which card terminal is on the counter today, and does it have an API or only monthly statements?
2. Should Finance show fees per day (accrual on the booking date) or on payout date (cash basis)? Recommendation:
   accrual on the booking date, payout date shown as information — it keeps Net P&L per day meaningful.
3. Booksy: is the salon charged per booking, a monthly subscription, or both? This decides whether Booksy gets a
   per-rail fee or a fixed-cost line.
