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

## 11. Writer-level audit — what the till can actually stamp (read-only, no code written)

§6 and §10 proposed *"stamp the reference at checkout"* and left one blocking unknown: **how the Tap to
Pay charge is created.** This section answers it from the code, and the answer changes the ordering.

### 11.1 The blocking question, answered: there is no terminal integration to take a reference from

Searched across both repos (`salown-app@origin/main`, `whitecross-site@main`):

| looked for | result |
|---|---|
| `@stripe/terminal-js`, `stripe-terminal-react-native`, any Terminal SDK dependency | **absent** — `package.json` (app) has no Stripe dependency at all; `functions/package.json` has server `stripe@^22` only |
| `stripe.terminal.*`, `connectionToken`, reader APIs | **no call sites** |
| `tapToPay` / "tap to pay" in any form | **no hits** |
| `stripe.paymentIntents.create` | **no call sites** — the only PaymentIntent salOWN ever causes is `stripe.checkout.sessions.create` (`functions/src/index.ts:4223`), i.e. the hosted web checkout |
| anything Monzo | **no integration** — the only hits are the 170 historical rows and two Finance labels (`src/pages/Finance.tsx:1954, :2025, :2631`, `src/components/checkoutDeskPrePaid.ts:75`) |

**Consequence.** Both in-salon rails are operated in a *separate app* on the operator's phone. salOWN
never creates, reads or is told about that charge. At the instant the till writes the money, **no
provider reference exists in the browser or on the server, for either rail.** §6 option A as written —
"put the payment intent id from the terminal integration onto the booking" — is not a small linkage
fix; it presupposes an integration that does not exist. Building it means salOWN taking the payment
itself (Stripe Terminal / Tap to Pay on iPhone inside the Staff app), which is a change to how the
operator charges a customer, not a field addition.

### 11.2 The money writers, and what each one has in hand

The three tills differ in UI and converge on **one** money writer — which is good news for a stamp.

| till (UI) | file | money write |
|---|---|---|
| Admin checkout | `src/components/CheckoutPanel.tsx:1668` | `checkoutBooking` (browser) |
| Admin checkout, TR tenants | `src/components/CheckoutPanel.tsx:1568` | `checkoutBookingViaExecutor` → `functions/src/checkout/executor.ts` (server) |
| Staff appointment checkout | `src/staff/sheets/CheckoutSheet.tsx:95` | `checkoutBooking` (browser) |
| Staff walk-in | `src/staff/sheets/WalkInFlow.tsx:588` | `createWalkIn` → then `checkoutBooking` (browser) |
| Staff product sale | `src/staff/sheets/WalkInFlow.tsx:508` | `salownCreateStaffProductSale` → `functions/src/sales/productSaleCore.ts` (server) |
| Admin product sale | `src/firestoreActions.ts:1151` | `createProductSale` (browser) |

`checkoutBooking` (`src/firestoreActions.ts:385`) writes `paymentMethod`, the canonical receipt and
`paymentAllocation` (`src/firestoreActions.ts:769-795`). **Four surfaces, one write for appointments:
the stamp has one home, not three.** Product sales are a second, separate home with the same blindness.

Fields available to a writer today: `paymentMethod` (tender label, operator-chosen), `paymentType`,
`tipPaymentMethod`, `paymentAllocation.*`. **No acquirer field exists anywhere in the booking schema,
and no writer has a provider reference to put in one.**

`stripePaymentIntent` — the key the matcher needs — is written by exactly two lines, both in the hosted
web checkout (`functions/src/index.ts:4369, :4763`). No till writer touches it, and no till writer can.

### 11.3 `checkoutSettings.providers` is NOT the home for the acquirer

`ResolvedCheckoutSettings.providers` already exists and looks tempting. It is the wrong shape:
`CardProviderConfig` (`packages/shared/src/checkout.ts:225`) is a **TR bank-instalment** provider,
carrying `supportedInstalmentCounts`, `commissionMode` and **commission basis points by instalment
count**. It is consumed only through `BankInstalmentMeta.providerId` for `CARD_INSTALMENT`
(`src/utils/checkoutTender.ts:458-460`).

Two reasons to keep the acquirer out of it: it would overload one id with two unrelated meanings, and
it is a structure whose purpose is **deriving a fee from a rate card** — the one thing §5 forbids. An
acquirer stamp must carry no rate.

Second trap: `checkoutSettings` defaults to `enabled: false` and the whole TR-D1 tender subsystem is
dark for UK tenants. Hanging a UK acquirer setting inside it would either be read by nobody or force a
TR subsystem on for whitecross. The stamp needs its own small field with its own read path.

### 11.4 The matcher accepts exactly two keys, and neither is reachable from the till

`resolveBookingRef` (`whitecross-site/functions/settlements.js:1186`):
1. `charge.metadata.bookingDocId` (or the Checkout Session's metadata, `:1477-1486`)
2. `bookings.where('stripePaymentIntent', '==', charge.payment_intent)` (`:1193`)

There is **no amount/time fallback** anywhere in the matcher — correct, and it must stay that way.
Both keys are produced only by salOWN-created payments. An in-salon charge carries neither.

### 11.5 The unmatched leak, measured

`retryUnmatched` (`settlements.js:1640`): due by `nextAttemptAt`, `orderBy nextAttemptAt` ascending,
`limit` 10; `wcSettlementSweeper` runs **every 15 minutes** (`whitecross-site/functions/index.js:3810`)
with `unmatchedLimit: 10`. Backoff `5 min → ×2 → capped 24 h` (`:259-260, :293`). A doc closes **only**
via `resolvedAt`.

- Capacity: 96 runs/day × 10 = **≈960 retries/day**. Each is one `stripe.charges.retrieve` (`:1658`).
- Standing population today ≈559, growing ≈6.6/day → **≈559 Stripe reads/day spent re-asking a question
  whose answer cannot change**, and capacity is reached at ≈960 standing docs, i.e. **around mid-February
  2027** on today's rate.
- Starvation order is the sting: a *genuine* new unmatched charge gets `nextAttemptAt = now + 5 min` and
  therefore sorts **behind** every overdue backlog doc. Past the crossover, the list starves exactly the
  cases it exists for.
- **The terminal-state machinery already exists and is simply not wired here.** `MAX_ATTEMPTS = 8`
  (`:261`) is applied only to the booking-side marker (`pendingMarker`, `:989`), and the booking side
  also has a true terminal state (`SYNC.UNRESOLVABLE`, `nextAttemptAt: null`, `:1213-1215`). The
  `unmatched` subcollection has neither.

### 11.6 What this does to the ordering in §6/§10

**Unchanged:** the acquirer stamp (§10 step 1) is still the cheapest and still correct. It needs no
integration and no reference — it records *which machine took the money*, which is a fact the salon
knows and the database currently does not. It is an operator/config assertion, not proof, and must be
labelled as such: it tells a reader **where to look for a fee**, never what the fee was.

**Unchanged:** the `settlementFacts` third answer (§10 step 2) fits the existing shape —
`rail: 'external'` alongside today's `'none' | 'stripe' | 'stripe_connect'`, consumed at
`src/components/OnlinePaymentFees.tsx` and `src/components/BookingDetailPanel.tsx:945`.

**Changed, and this is the finding:** §6-A ("write the reference at the till") is **not available** and
cannot be scheduled as a linkage fix. Reaching a per-booking Stripe reference requires salOWN to take
the card payment itself. So the practical order becomes:

1. **Stamp the acquirer** — one setting, one field on the booking, no integration. Makes every later
   step possible and makes the current silence honest.
2. **Cap the unmatched retry** — wire the existing `MAX_ATTEMPTS` / terminal state into the `unmatched`
   subcollection. Independent of every rail decision, and the only item here with a deadline.
3. **Then the rail decision** (§8): reconcile Stripe charges against candidate bookings with owner
   confirmation in Finance (§6-B, ~6-7/day, provider-agnostic), **or** invest in a real Stripe Terminal
   integration so that new payments bind by reference. Option B is reconciliation; the Terminal route is
   a product change. Neither is a field addition, and choosing between them is the owner's call.

**Still forbidden, unchanged:** no fee from a rate card · no acquirer inferred from `paymentMethod` · no
amount/time matching · no rewrite of the 170 `MONZO` rows · no backfill of any kind.

**Audit method:** read-only. Both repos read at `origin/main` / `main`; no working tree touched, no
branch created, no Stripe or Monzo API called, no production read or write, no deploy.

## 12. Audit closed — what is settled, and what is still a decision

### 12.1 The historical `MONZO` rows, verified from `origin/main`

§9 asserted the 170 rows already count correctly. Verified independently in the writer audit:

- `src/utils/legacyTender.ts:71-77` — `normaliseMethod` recognises `CASH`, `CARD`, `VOUCHER` and
  returns `'OTHER'` for everything else. `MONZO` is **not special-cased**; it lands in `OTHER` through
  the catch-all.
- `src/utils/tenderSelection.ts:82, :85, :103` — `other_p` is folded straight into the card column:
  `serviceCard_p = f.service.card_p + f.service.other_p`, and the same for the tip leg.

**Therefore: the 170 checkouts (£5,150.00) are already inside `cardRevenue` and Bank Balance.** There is
no defect to repair, and the Finance label *"Card / Monzo revenue"* is an accurate name for what that
figure contains. Migrating them would change no total, would delete the only rows in the database that
record an acquirer, and is **not proposed by this audit under any option.** The separate `MONZO` slice
in the Reports pie is a display mapping and can be handled there if it bothers anyone — without
rewriting a single money record.

### 12.2 Settled by this audit, not open to re-litigation

1. salOWN holds **no provider reference** for an in-salon card payment — Stripe or Monzo (§11.1).
2. There is **no Stripe Terminal SDK and no Monzo integration** in either repo (§11.1).
3. `paymentMethod: 'CARD'` is a **tender label, not evidence of a rail**, and must never be read as one.
4. The 170 historical `MONZO` rows **stay as they are** (§12.1).
5. An acquirer stamp, on its own, **does not create a fee linkage.** It records where to look for a
   fee; it cannot produce one. It is worth having for honesty, and it is not a fix.

### 12.3 The one item that is independent of every product decision

**Cap the `unmatched` retry and give the collection an explicit terminal state.**

It stops an unbounded queue (≈559 standing docs, +6.6/day, ≈559 pointless `stripe.charges.retrieve`
calls a day, capacity exhausted ≈mid-Feb 2027 — §11.5). It matches nothing by guess. It does not depend
on whether the salon standardises on Stripe or keeps Monzo. It does not touch the deployed ledger,
`R-2026-09-22-A` or `R-2026-09-22-B`. The machinery already exists on the booking side
(`MAX_ATTEMPTS = 8`, `SYNC.UNRESOLVABLE` with `nextAttemptAt: null`) and is simply not wired to the
`unmatched` subcollection.

**Status: recommended first, NOT approved, not started. No implementation without explicit approval.**

### 12.4 The two remaining product decisions — the owner's, not this audit's

1. **Manual reconciliation in Finance.** Show unmatched Stripe charges beside candidate bookings and
   let the owner confirm each one. ~6-7/day. Provider-agnostic. Never matches on amount or time by
   itself — a human confirms, and the confirmation is the reference.
2. **A real Stripe Terminal / Tap to Pay integration**, i.e. salOWN takes the card payment itself. This
   is the only route on which a new payment binds to its booking automatically and by reference. It
   changes how the operator charges a customer.

These are not alternatives to 12.3; 12.3 is due either way.

**Audit status: CLOSED.** Read-only throughout. No code written, no branch, no worktree change, no
settings file touched, no Stripe or Monzo API call, no production write, no migration, no backfill, no
merge, no deploy.

## 13. Owner decision, 2026-09-22 evening — an APPROXIMATE fee, checked monthly against Stripe

The owner has decided, after the §5/§12 objections were put: **an approximate fee is what the business
needs, and it is enough.** The decision carries its own control, and that control is what makes it
sound: **the monthly estimated total is to be compared against Stripe's actual monthly fee figure.**

This answers the objection rather than overriding it. A rate-card number is dangerous when nobody ever
checks it; a rate-card number with a monthly reconciliation against the real total is an estimate that
can be falsified and corrected. §5's prohibition stands where it matters — **no guess is ever presented
as, or summed into, an actual fee** — and this design keeps that line.

### 13.1 The reader already separates the two totals — this is why it is cheap and safe

`src/utils/settlementFacts.ts` was built with the estimate case as a first-class state, and nothing
currently produces it:

- `FeeStatus` already includes `'estimate'` (`:26`), `NetKind` already includes `'estimate'` (`:32`).
- `SettlementCoverage` carries **two separate totals**: `actualFee_p` — commented *"Sum of ACTUAL fees
  only … Never includes a guess for the rest"* — and `estimatedFee_p` (`:246-248`).
- `summariseSettlementFacts` routes `status === 'estimate'` into `estimatedFee_p` and **never** into
  `actualFee_p` (`:266`), and `complete` stays false unless every payment has an actual fee (`:274`).
- The ledger reserves `KIND.FEE_ESTIMATE` (`whitecross-site/functions/settlements.js:157`) and the fold
  reads it (`:672`, `feeSource: 'estimate'`), but **no writer ever creates one.**

So the contamination the prohibition exists to prevent is structurally impossible: an estimate cannot
reach the actual-fee total by construction. The work is to feed a state the system already understands.

### 13.2 Compute at READ time — which is how "the old ones" get covered with no migration

The estimate is **derived when the booking is read**, not written to any document. Consequences:

- The 559 historical unlinked card payments show an estimate **immediately**, with **no backfill, no
  migration and no write to a single money record** — which is also what §5/§9 require.
- A rate correction changes every displayed estimate at once, because nothing was frozen into a doc.
- The day a payment gets a real fee, the actual value simply wins — no stored guess to clean up.

### 13.3 The rate, and what the owner's chosen constant costs

Owner's instruction: **1.5% / 2.5% + 40p**, with *"we actually pay a bit more fee, never mind"* — i.e. a
deliberately conservative constant. That is the safe direction for a P&L (it understates profit rather
than overstating it) and it removes the one-directional-understatement objection from §5.

Worth stating plainly, because the salon's basket is small: **the average in-salon card payment is
£30.00** (£16,767.95 / 559). At that ticket the fixed component dominates — 20p is 0.67% of the sale,
40p is 1.33%.

| rate used | 4-month estimate on £16,767.95 / 559 payments | effective rate |
|---|---|---|
| 1.5% + 20p (Stripe's published UK standard) | £363.32 | 2.17% |
| **1.5% + 40p (owner's choice)** | **£475.12** | **2.83%** |
| 2.5% + 20p | £531.00 | 3.17% |
| 2.5% + 40p | £642.80 | 3.83% |

The 20p → 40p change alone adds **£111.80** over this period. This is not an argument against it — the
monthly comparison in 13.4 is precisely what will settle whether 40p is right — but the constant should
be an **owner-editable setting with an `effectiveFrom` date**, never a hardcoded number, so that
correcting it later does not silently rewrite what past months appeared to cost.

### 13.4 The control that makes this legitimate: the monthly comparison

Finance shows, per month:

> Estimated card fees: **£X** (N payments, rate 1.5% + 40p) · Stripe's actual: **£Y** · difference **£Z**

`£Y` is real and requires **no booking-level matching at all** — it is an account-level total. If the
gap is consistently one-sided, the owner changes the rate setting and the estimate tracks reality from
that month forward. That loop is the whole justification for the estimate, so it is not optional
polish: **the estimate and its monthly check ship together, or the estimate is exactly the unverified
guess §5 warned about.**

### 13.5 The acquirer/rail option — owner accepted, and it is the same setting

Owner: *"if we take payments with another card machine, we add that company as an option too — the TR
package already had `providers`, we can adapt it."* Accepted, with one adjustment from §11.3: do not
reuse `CardProviderConfig`, which is the TR **bank-instalment** structure (`supportedInstalmentCounts`,
`commissionMode`, commission bps by instalment count) and is consumed only through
`BankInstalmentMeta.providerId`. Overloading it would put two unrelated meanings on one id.

A separate, small list — one row per card machine the salon uses, each with its own name, percentage,
fixed amount and `effectiveFrom` — gives the owner exactly what was asked for and makes the estimate
correct per rail instead of assuming Stripe's rate for a Monzo payment. This is the acquirer stamp and
the rate in one setting, which is why it stops being a separate piece of work.

### 13.6 Revised order of work

1. **Cap the `unmatched` retry** — unchanged, still independent of everything here, still the only item
   with a deadline (§12.3).
2. **The estimate**: rail + rate setting, read-time estimate, `status: 'estimate'` on every unlinked
   in-salon card payment, **together with** the monthly Stripe comparison (13.4).
3. **Candidate reconciliation in Finance** (§12.4.1) — only if the owner later wants per-booking actual
   fees rather than a monthly check.
4. **Stripe Terminal integration** (§12.4.2) — the endgame, unchanged.

Still forbidden, unchanged: no estimate summed into an actual fee · no acquirer inferred from
`paymentMethod` · no amount/time auto-matching · no rewrite of the 170 `MONZO` rows · no backfill.

**Status: design agreed, implementation NOT started and NOT yet approved.**

## 14. Taking the payment inside salOWN — verified against Stripe's current docs (2026-09-22)

Owner's question: *can the Staff app talk to Stripe directly, so that pressing checkout opens Tap to
Pay and the payment lands on the right booking at the right moment?* Checked against Stripe's
documentation rather than answered from memory.

**Both routes below end in the same place, and that place is already built.** If salOWN creates the
PaymentIntent, it can put `bookingDocId` in its metadata, and metadata is copied onto the charge when
the charge is created. That is **key #1 of the existing matcher** (`resolveBookingRef`,
`whitecross-site/functions/settlements.js:1190-1191`). No new matching logic, no reconciliation screen,
no estimate: the fee is actual and binds at birth. The ledger has been waiting for this input.

### 14.1 Route A — a smart reader driven from the server (no app store, no native app)

Stripe's **JavaScript SDK supports smart readers only** — BBPOS WisePOS E, Reader S700/S710, supported
Verifone — connected over the internet. Better still, for exactly these readers Stripe recommends a
**server-driven integration** that uses the Stripe API instead of any Terminal SDK, and for which *"you
don't need to create a connection token."*

For salOWN that means: the Staff app calls a callable → a Cloud Function creates the PaymentIntent
(`payment_method_types: ['card_present']`, `metadata.bookingDocId`) and pushes it to the reader → the
customer taps the reader → the webhook/sweeper binds it automatically.

- **No native app, no Capacitor, no Apple entitlement, no App Store review.**
- Works with the Staff app exactly as it is deployed today.
- Cost: buying a reader, and the operator presents the reader instead of the phone.

### 14.2 Route B — Tap to Pay on iPhone inside the Staff app

Verified requirements:

- **Tap to Pay is NOT available in the JavaScript SDK.** It ships only in the Terminal **iOS**,
  **Android** and **React Native** SDKs — so it requires a native app. (Capacitor is already on the
  Staff-app roadmap, but bridging the Terminal SDK is real work, not a wrapper flag.)
- **GB is supported** (Tap to Pay availability list).
- **iPhone XS or later**, on an iOS version no more than about a year old.
- An **Apple entitlement** is mandatory — `com.apple.developer.proximity-reader.payment.acceptance` —
  requested first as a development entitlement, then again as a **distribution** entitlement. Stripe's
  own wording: *"Implementing Tap to Pay on iPhone is a complex process that requires submitting your
  app to Apple for approval."*
- Apple requires a **"How to Tap" instructional overlay** in the app before review.
- **UK-specific operational gotcha:** depending on the issuer, SCA can require some UK cards to be
  *inserted*; with Tap to Pay the payment is then declined as `offline_pin_required` before the PIN
  screen. A salon therefore still needs a fallback — a physical reader or another method.

### 14.3 What this changes about the plan

- **The fee question dissolves for new payments.** Actual fee, bound by reference, no rate card and no
  monthly check needed for anything taken this way. §13's estimate becomes a **transitional measure for
  history** (the 559 past payments and everything up to the switch-over), which is a reason to keep it
  small and not to build more of it than that.
- **The unmatched retry cap (§12.3) is still due** — the backlog exists either way.
- **This is a change in what salOWN is,** not only in what it stores: taking the payment brings
  refunds, disputes, declines, offline behaviour, receipts and PCI scope into the product. That is the
  real cost of both routes, and it is larger than the code.
- Multi-tenant note: Terminal works with Connect, which is the shape salOWN would need for other
  salons. Whitecross would run on its own existing account (`acct_1T3CrpRfgDnpYJzP`), so the fee lands
  in the same ledger the sweeper already reads.

**Recommendation: Route A.** It reaches the owner's stated goal — right payment, right booking, right
moment — with no App Store dependency, no Apple approval cycle and no native app, and it can be built
against the Staff app that is live today. Route B is the better *product* one day; it is not the
cheaper way to close this gap.

**Status: informational. Nothing approved, nothing started.**

**Sources:** Stripe docs — Tap to Pay setup (`/terminal/payments/setup-reader/tap-to-pay`, iOS
variant), Select a reader (`/terminal/payments/setup-reader`), Connect to a reader (JS/internet),
Set up your integration, Collect card payments, Terminal with Connect.

## 15. The reader is rejected on cost — and that makes the rail decision a PREREQUISITE, not a preference

Owner, on §14: the hardware is too expensive. Verified: **Stripe Reader S700 ≈ £229, BBPOS WisePOS E
≈ £249** in the UK (account-specific pricing shown in the Dashboard under Terminal → Shop).

**The objection is correct and should not be argued with.** A reader saves nothing: Stripe's fee is
identical whether the charge originates in the Stripe Dashboard app or on a reader. It buys visibility
and per-booking attribution, not money. Any "it pays for itself" argument would be false. Route A is
therefore **dropped** unless the owner later wants per-booking actual fees badly enough to pay for them.

(The cheaper Bluetooth reader — Stripe Reader M2 — is not a way around this: it is driven by the mobile
SDKs, so it needs the same native app Tap to Pay needs, and Tap to Pay then needs no hardware at all.
It buys nothing over Route B.)

### 15.1 The consequence that matters: §13's monthly check only works on ONE rail

This is a dependency inside the plan the owner already approved, and it is easy to miss.

§13's control is *"compare the estimated monthly total against Stripe's actual monthly figure."* But
with two acquirers in use, the two sides count **different populations**:

| | what it covers |
|---|---|
| Estimated total (from the till) | **every** `CARD` checkout — Stripe **and** Monzo |
| Stripe's actual monthly figure | **only** the Stripe ones |

The difference would then be dominated by the Monzo share, not by rate error. It would be large every
month, it would never converge, and it could never tell the owner whether 1.5% + 40p is the right
constant — which is the entire purpose of the check. **An estimate whose control cannot discriminate is
back to being the unverified guess §5 warned about.**

Two ways out, and both are free:

1. **Standardise on Stripe Tap to Pay via the Stripe Dashboard app** — already in use, costs nothing,
   needs no reader and no code. Both sides then measure the same population, the rate calibrates in the
   first month, and the salon's true total card fee becomes a known number (without per-booking
   breakdown).
2. **Record the rail per payment** (§13.5's setting) and compare *only the Stripe-stamped payments*
   against Stripe's figure. This works with both machines in use, and is the reason the rail setting is
   not optional decoration — it is what makes the monthly check arithmetically valid.

In practice both are wanted: 1 is the operational decision, 2 is what keeps the books honest if the
salon ever picks up a second machine again.

### 15.2 The free measurement, restated — it is now decision-relevant

§8's zero-code measurement decides this without anyone committing to anything: **compare the daily
count of `CARD` checkouts in the till against the daily count of `settlementScan/unmatched` documents.**
Equal ⇒ everything is already going through Stripe and option 1 above is already true in practice;
a surplus on the till side is exactly the Monzo volume. On 2026-09-22 it was 2 vs 2. **A week of this
costs nothing and settles the rail question with evidence instead of recollection.**

### 15.3 Standing plan after this

1. **Cap the `unmatched` retry** — unchanged, independent, the only dated item.
2. **A week of the free measurement** (15.2) — no code, no cost.
3. **Rail setting + read-time estimate + monthly Stripe comparison** (§13), with the rail setting now
   understood as load-bearing for the comparison rather than as future-proofing.
4. Per-booking actual fees (reader, candidate reconciliation, or Tap to Pay in a native app) — **only
   if the owner ever decides the breakdown is worth paying for.** Not proposed now.

**Status: no hardware, no implementation, nothing approved.**

## 16. Correction to §15 — the owner accepts the price, and the rate in §13 is probably wrong

Two corrections, one of them material to the money.

### 16.1 "S700" is a model name, not a price

The owner read "S700" as a dollar figure. It is the name of the device — **Stripe Reader S700** — and
its UK price is **£229**. No figure in this document is in dollars. With the price understood, the
owner's verdict is *"£229/£249 is not bad"*, so **§15's rejection of Route A is withdrawn** and Route A
(a smart reader driven server-side, §14.1) is live again as the leading option.

§15's reasoning still stands on its own terms and is left in the record: a reader saves nothing, it
buys correctness and per-booking attribution. That is now a price the owner is willing to pay, which is
a different answer to the same question, not a contradiction of it.

### 16.2 The rate the owner chose looks substantially too high — because the pasted card was the ONLINE one

§13 fixed the estimate at **1.5% / 2.5% + 40p**, taken from Stripe's published pricing panel. That panel
is the **online** rate. **In-person (card-present) pricing is different and lower:** published UK
Terminal pricing is **1.4% + 10p for EEA cards** and **2.9% + 10p for non-EEA cards**.

Every in-salon Tap to Pay payment is card-present, so the online rate never applied to them.

| rate | 4-month estimate on £16,767.95 / 559 payments | effective |
|---|---|---|
| **1.4% + 10p (published in-person, EEA)** | **£290.65** | **1.73%** |
| 1.5% + 20p (online — what was pasted) | £363.32 | 2.17% |
| 1.5% + 40p (§13's chosen constant) | £475.12 | 2.83% |

If the real rate is 1.4% + 10p, §13's constant **overstates fees by ≈£184 over this period — about 63%
too high**, roughly £46 a month of profit that would look spent and was not. A conservative constant is
sound in principle (§13.3), but this is no longer a small safety margin.

**Do not simply substitute 1.4% + 10p either.** Published rates are third-party summaries and account
pricing can be bespoke. The authoritative figure is one minute away and costs nothing: **open the Stripe
Dashboard, find one of the in-salon Tap to Pay charges, and read its actual fee.** For reference, the
B1 proof payment on 2026-09-22 (`CAPTURED 4000`, `FEE_ACTUAL 80` — 80p on £40.00) is exactly
1.5% + 20p, i.e. the online rate, consistent with it being a hosted web checkout rather than an
in-salon tap. So our own ledger does not yet contain a single confirmed in-person fee.

### 16.3 What this does to the order of work

If the reader is bought, **the estimate stops being needed for new payments entirely** — the fee binds
by reference and is actual from day one. That leaves the estimate as a **history-only** device for the
559 past payments, which argues for building the smallest possible version of it, or deferring it until
the reader is live and the real backlog is known.

Revised standing plan:

1. **Cap the `unmatched` retry** — unchanged, independent, dated.
2. **Read one real in-salon Stripe fee from the Dashboard** — one minute, zero cost, settles §13's rate
   and tells us what the in-person rate actually is on this account.
3. **Route A feasibility and cost** (reader + server-driven PaymentIntent with `metadata.bookingDocId`)
   — now the leading option rather than a rejected one.
4. **The estimate** — only for history, and only as large as history needs.

**Status: nothing bought, nothing approved, nothing started.**
