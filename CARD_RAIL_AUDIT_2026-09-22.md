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

**Read §8 before acting on §6:** the salon uses *two* card rails interchangeably — Stripe Tap to Pay
**and** the Monzo app — and the till writes `CARD` for both, so the data cannot say which acquirer took
any given payment. That changes which fix is even possible.

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

---

## 8. Addendum — the owner uses TWO card rails, and the till records both as `CARD`

Asked how Tap to Pay is set up, the owner answered: *"the Monzo app, but we can also do Tap to Pay
straight from Stripe — same thing."*

For the customer, and roughly for the rate, that is true. **For this system they are two different
acquirers, and only one of them is reachable:**

| What the operator taps | Where the charge lands | Is the fee reachable? |
|---|---|---|
| **Stripe** Tap to Pay | the salon's own Stripe account | **yes** — the actual fee is in `balance_transaction`; only the booking link is missing (§2) |
| **Monzo** app | Monzo's acquiring | **no** — it never appears in the Stripe account, so no amount of Stripe work will ever surface that fee |

**And nothing in the data says which one was used.** The current tender vocabulary
(`src/utils/checkoutTender.ts`) is `CASH · CARD · BANK_TRANSFER · CARD_INSTALMENT · SALON_CREDIT ·
VOUCHER · OTHER` — there is no acquirer field and no Monzo option. Both rails are written as `CARD`.

**The distinction used to exist and was lost.** `MONZO` was a real tender value in production for
**170 checkouts, 2026-02 → 2026-05**, carried on `paymentMethod` (167) and `paymentType` (170):

| month | CARD | MONZO | CASH |
|---|---|---|---|
| 2026-02 | 100 | 19 | 30 |
| 2026-03 | 6 | **148** | 51 |
| 2026-04 | 161 | 0 | 45 |
| 2026-05 → 2026-09 | 189–229/mo | **0** | 35–59/mo |

In March the till was recording Monzo explicitly and barely using `CARD`; from April it is `CARD` for
everything. That was a free-text label, not a rail record, and it is gone from today's vocabulary — but
it shows the salon itself once thought the two were worth telling apart.

**Consequence for §6.** Option **A** (write the reference at the till) only works for payments taken
on **Stripe** Tap to Pay. For Monzo payments there is nothing to reference; they would need a Monzo
statement import, which is a different piece of work with a different fee schedule and no per-booking
granularity. So the ordering changes:

1. **Decide the rail before building anything.** If the salon standardises on **Stripe** Tap to Pay —
   which the owner says is already available and equivalent for them — the entire problem collapses to
   option A: one acquirer, fee data already inside the ledger's reach, and only the booking link to
   write. That is a business decision with a large technical payoff, and it is the cheapest path by a
   wide margin.
2. If both rails stay in use, then **the till must record which acquirer took the money** before any
   fee work is meaningful — otherwise a fee lookup cannot even know which payments it is allowed to
   fail to find. That is a new field, not a new integration, and it must be an **acquirer reference,
   never a tender label** (the owner has also said the card machine may change again).

**A free measurement that settles the mix, costing nothing and touching nothing.** From today the
sweeper records every Stripe charge it cannot bind. So: count the till's `CARD` checkouts per day and
count the `unmatched` documents per day. If they match, everything is going through Stripe. If the
till count is higher, the difference is exactly the Monzo volume. **Today: 2 till card payments, 2
unmatched Stripe charges — 2 of 2, so both of today's were Stripe.** A week of this gives the real
split without a single line of code or one Stripe call.

---

## 9. The 170 `MONZO` rows — leave them, and why

The owner offered to migrate them to `CARD` ("there was no real difference, we just forgot to change
the label"). Two findings:

**They are already counted correctly. There is no defect to fix.**
`legacyTender.normaliseMethod('MONZO')` returns **`OTHER`**, and
`tenderSelection.selectTender` folds it straight into the card column —
`serviceCard_p = service.card_p + service.other_p` (same for tips). That is why the Finance line is
labelled *"Card / Monzo revenue"*: someone made the `other` bucket ride with card deliberately and
named it honestly. All **170 checkouts, £5,150.00**, are inside `cardRevenue` and therefore inside
Bank Balance today. Migrating changes exactly one thing: the Reports payment-method pie stops showing
a separate `MONZO` slice.

**And they are the only rows in the database that record which acquirer took the money.**
That is the exact dimension §8 shows is missing everywhere else. Rewriting them to `CARD` would delete
the salon's only historical sample of the Stripe/Monzo split — on the same day we discovered that split
is the thing standing between the salon and its real fee figure. `legacyTender.ts` already states the
principle in its own header: *"It does not migrate, rewrite or 'fix' any stored booking. The stored
shape is left exactly as it is; only the READING of it is corrected."*

**Recommendation: do not migrate.** If the `MONZO` slice in the Reports pie is untidy, that is a
one-line display mapping, not a rewrite of 170 money records.

---

## 10. Proposed scheme going forward

The whole mess comes from one conflation: **the till records a *tender* and the system needs an
*acquirer*.** They are different facts. "Card" says how the customer paid; it cannot say who processed
it, which is what determines whether a fee exists, where it lives and what it costs.

**The design rule: record the acquirer at checkout time, by reference, never by inference.**

**Step 1 — one setting, stamped per booking, zero extra taps.**
Settings gets one value: *in-salon card payments are taken on → [Stripe Tap to Pay | Monzo | …]*,
maintained beside the existing tender configuration in `checkoutSettingsWrite.ts`. Every card checkout
stamps that value onto the booking as it is written. No operator has to think about it, and the day
the machine changes the owner changes one setting — history stays right because each booking carries
the stamp it was taken under, not whatever is configured today. This is the piece that makes every
other option possible, and it needs no integration with anybody.

**Step 2 — the fee reader learns a third answer.**
`settlementFacts.ts` already has the right shape: a `rail` field and a `status` that distinguishes
"not recorded" from "cannot be read". Today an in-salon card payment is simply untracked. With the
stamp it becomes explicit: a Monzo payment is *"a rail this ledger does not see"* — the same honest
answer the Connect branch already gives — instead of an absence that looks like an oversight. And a
Stripe payment without a link becomes a **named gap** rather than a mystery, which is the difference
between a backlog you can work and one you can only watch grow.

**Step 3 — close the Stripe linkage (§6 option A), now well-defined.**
Only payments stamped `stripe` need a reference, and only those are expected to resolve. The sweeper's
`unmatched` list stops being a dumping ground and becomes what it was built to be: charges that should
have bound and did not.

**Step 4 — only then decide about Monzo fees.** A statement import is a separate piece of work with a
different fee schedule and no per-booking granularity. It is worth doing only if Monzo stays in use —
which is why the rail decision comes first.

**The lever the owner already holds.** The owner has said Stripe Tap to Pay is available and equivalent
for them. If the salon standardises on it, steps 2 and 4 largely disappear, every card fee becomes
actual and readable, and the work collapses to steps 1 and 3. **That single operational choice is worth
more than any code in this document.**

**Not in this proposal, deliberately:** no fee is ever computed from a rate card; no acquirer is ever
inferred from a tender label; no historical booking is rewritten; and nothing here touches
`R-2026-09-22-A` or `R-2026-09-22-B`.
