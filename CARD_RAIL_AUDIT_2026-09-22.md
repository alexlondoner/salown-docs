# CARD_RAIL_AUDIT_2026-09-22.md — which card payments the fee ledger can actually see

> **Read-only audit. No deploy, merge, migration, backfill, Stripe call, Monzo call or production write.**
> Every fact below came from a Firestore read or from source in `salown-app` / `whitecross-site`.
> It ends at a **scope proposal**; nothing was built.

## 0. The headline, and a correction to the earlier answer

An earlier answer in this thread said in-salon card payments are "probably a separate rail, maybe
Monzo acquiring, not Stripe — do not assume". **The production data says otherwise, and the owner's
instinct was right: those charges are on the salon's own Stripe account, and Stripe's fee applies.**

The ledger already **sees** the money. What it cannot do is **attribute** it to a booking — so no fee
is recorded, and B2a shows nothing on those bookings. **The gap is linkage, not integration.**

## 1. The evidence — two live charges, matched to two till checkouts

`wcSettlementSweeper` scans charges on the configured account (`WC_STRIPE_ACCOUNT_ID`
= `acct_1T3CrpRfgDnpYJzP`; an `ACCOUNT_MISMATCH` is refused, and there have been **zero** of those).
Today it listed two charges it could not bind, now sitting in
`tenants/whitecross/platform/settlementScan/unmatched`:

| Stripe charge | amount | created (UTC) | reason |
|---|---|---|---|
| `ch_3UITFURfgDnpYJzP0oFhy6jf` (`pi_3UITFU…`) | **£40.00** | 2026-09-22T12:57:19Z | `BOOKING_NOT_FOUND` |
| `ch_3UIV6lRfgDnpYJzP1t3OwGek` (`pi_3UIV6l…`) | **£23.00** | 2026-09-22T14:56:04Z | `BOOKING_NOT_FOUND` |

Both `livemode: true`. And today's till:

| Booking | method | amount | `checkedOutAt` | gap to the charge |
|---|---|---|---|---|
| Walk-in | `CARD` | **£40** | 12:57:47Z | **+28 s** |
| Walk-in | `CARD` | **£23** | 14:57:56Z | **+112 s** |

Two for two: exact amounts, the charge landing seconds before the operator pressed checkout. These
are the in-salon Tap to Pay payments, on the salon's Stripe account, with the fee already computed by
Stripe and already sitting in each charge's `balance_transaction`.

**Residual uncertainty, stated plainly:** reading `payment_method_details` (which would say
`card_present` / Terminal outright) needs a Stripe API call, which is out of scope here. The
identification above rests on the account, the amounts, the timestamps and the absence of any
checkout-session metadata — strong, but not the same as having read the charge object.

## 2. Why the bind fails

`resolveBookingForCharge` (`whitecross-site/functions/settlements.js`) accepts exactly two keys:

1. `charge.metadata.bookingDocId` — or the same key on the Checkout **session** for that payment intent;
2. a booking whose **`stripePaymentIntent`** equals the charge's payment intent.

A website checkout has both: the session carries `bookingDocId`, and the webhook writes
`stripePaymentIntent` onto the booking. **A till payment has neither.** The charge is created by the
card app, not by salOWN, so it carries no metadata; and nothing writes the payment intent back onto
the booking. `paymentMethod: 'CARD'` is a **tender label typed at the till**, not a rail record — it
proves how the customer paid, not which acquirer processed it, and it holds no reference at all.

## 3. What each rail looks like in production

Sample: the most recent **800** whitecross bookings (778 checked out), read 2026-09-22.

| Rail | how it is recognisable | gross stored | fee available? | covered by B1/B2a? |
|---|---|---|---|---|
| **Website Stripe Checkout** | `stripePaymentIntent` + `stripeSessionId` + `stripeAmountPaid`, `paymentProvider: EXTERNAL_CHECKOUT` on the newer rows | `stripeAmountPaid`, and `gross_m` in the ledger | **actual**, from `balance_transaction` | ✅ **yes** — 81 payments / £2,227.00 in this window |
| **In-salon card (Tap to Pay)** | `paymentMethod: 'CARD'` and **no Stripe field whatsoever** | `paidAmount` / `price` | **exists in Stripe, unreachable from the booking** | ❌ **no** — charge lands in `unmatched` |
| **Booksy prepaid** | `source: Booksy`, `platformDepositAmount` | booking fields | its own model, not Stripe | ❌ out of scope |
| **Treatwell** | `source: Treatwell`, commission fields | booking fields | its own commission line (already in Finance) | ❌ out of scope |
| **Pay at venue** | `paymentProvider: PAY_AT_VENUE` | booking fields | n/a until paid at the till, then it is the row above | ❌ |
| **Cash** | `paymentMethod: 'CASH'` | booking fields | none, correctly | n/a |

**Unlinked in-salon card volume in that window: 559 payments, £16,767.95 gross, over 85 trading days
(~6.6/day).** By source: walk-in 490, Booksy 35, Admin 16, salOWN 9, Treatwell 6, Fresha 2, Staff App 1
— i.e. it is not only walk-ins; any booking settled at the till by card is in here. At UK
**1.5% + 20p** the invisible fee on that window is **roughly £363** — *illustrative arithmetic, not a
figure read from Stripe.* The point is the order of magnitude: the fee the product currently shows
(£0.80 so far) is the small half of the problem.

## 4. Operational consequence that started today

Every in-salon card payment now creates one document in
`settlementScan/unmatched` with `BOOKING_NOT_FOUND`. `retryUnmatched` re-reads each one with
`stripe.charges.retrieve`, backing off 5 min → 10 → 20 → … capped at **24 h**, and **there is no
give-up path**: a document is only ever closed by `resolvedAt`. So the backlog grows by ~6–7
documents per trading day and each one costs a Stripe read every 24 h, forever.

This is not breaking anything and nothing on screen is wrong — but it is an accumulating cost and an
ever-growing "unresolved" list that will eventually obscure a *real* unmatched charge, which is the
condition that list exists to surface. It is the strongest practical argument for closing the linkage
rather than leaving it.

## 5. What must NOT be done

- **Do not infer the fee.** Stripe's actual `balance_transaction.fee` is the contract
  (`PROCESSOR_FEES_PLAN.md` §1.3); computing 1.5% + 20p and writing it would break the rule that an
  unknown fee is `null`, never a number.
- **Do not treat `paymentMethod: 'CARD'` as "Stripe".** The owner has already said the machine may
  change — another provider, another terminal. A rule that reads the tender label would silently
  start recording Stripe fees for a rail that is no longer Stripe. **Bind by reference, never by
  tender label.**
- **Do not match by amount and time.** It identified the rail here, with two samples and a human
  reading them. As an automatic rule it would mis-bind two £30 cuts checked out in the same minute.

## 6. Scope proposal — three options, ordered

The whole problem is one missing reference. Options differ in where that reference comes from.

**A. Write the reference at the till (the real fix).**
The checkout that takes a card payment learns the payment intent / charge id from the terminal
integration and stores it on the booking, exactly as the website webhook does. Then `resolveBookingRef`
binds on the key it already has and every existing piece of B1/B1b/B2a works unchanged — no ledger
change, no new rail concept, and it stays correct when the card machine changes, because the reference
travels with the payment rather than with the label. **Requires knowing how the Tap to Pay app is
integrated** (Stripe Terminal SDK? a Monzo app that settles into Stripe?) — that is the one fact this
audit could not establish without a Stripe call, and it decides whether A is cheap or impossible.

**B. Reconcile from the Stripe side, with a human confirming each bind.**
Surface the `unmatched` list in Finance with its candidate bookings (same day, same amount) and let
the owner confirm. The fee then attaches through the existing ledger path. Safe, provider-agnostic,
no guessing — but it is manual, ~6–7 confirmations a day.

**C. Leave it, and close the operational leak only.**
Give `unmatched` a terminal state so a charge that will never bind stops retrying forever. Fees for
in-salon card payments stay invisible; the P&L keeps overstating net by roughly the fee. Cheapest, and
honest as long as the product says so rather than implying the fee shown is the whole fee.

**Recommendation: establish the Tap to Pay integration first** — one read of how that charge is
created decides between A and B, and doing anything before that is guesswork. **C's retry cap is worth
doing regardless of which one wins**, because the backlog grows from today either way.

## 7. What this changes about what is already live

Nothing that is live is wrong. `R-2026-09-22-B` shows the fee on payments the ledger can attribute,
and correctly shows nothing where it cannot. But the product's coverage should be read honestly:
**in this sample the fee is visible on 81 of 640 card payments (13%).** The Finance surfaces that
later consume these figures (B2 P&L, Bank Balance) must not present a partial fee total as a complete
one — `summariseSettlementFacts` already refuses to call coverage complete while any fee is unknown,
and that refusal is now load-bearing.
