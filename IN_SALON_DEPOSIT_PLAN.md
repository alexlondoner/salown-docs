# IN_SALON_DEPOSIT_PLAN.md — taking a deposit at the desk for a future booking

> **Role:** the plan for letting a salon collect money in person, today, against a booking that
> happens later. It is deliberately a PLAN and not a build: the owner's instruction on 2026-09-02
> was *"bir plan yapıp ona göre yapalım, öyle boşlama gitmeyelim — etkilenecek yerler olabilir,
> o yüzden basitleştirip yapmak lazım."*
>
> **Related:** [STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md) (the ONLINE deposit rail, live in
> test mode) · [PAYMENT_SETTINGS.md](PAYMENT_SETTINGS.md) · [PAYMENT_PLAN_ENGINE.md](PAYMENT_PLAN_ENGINE.md)
> (instalments / receivables) · [INCIDENTS.md](INCIDENTS.md) 2026-09-01 (the incident that started
> this line of thinking).
>
> **Status:** 🔵 Planned. Nothing in this document is built.

---

## 1. Why this exists

A salon books £500 of work for next month and wants part of it up front. Today the panel has no way
to record that. The only control that says "money arrived" is **checkout**, and checkout asserts
something else entirely: that the money was taken *and the service was delivered*. Using it for a
deposit back-dates a service that has not happened, which is exactly the failure recorded in
INCIDENTS 2026-09-01 — two paid sales stamped onto a day four days out, invisible in today's grid
and counted in the wrong day's takings.

The 2026-09-02 guard (OFF-DAY-AUTHORITY, `a0fad85`) now asks before that can happen silently. But a
guard only closes the wrong door. This document opens the right one.

## 2. What already exists — most of it

This is the important finding: the deposit **domain model is already built**. What is missing is one
entry point, not a concept.

### 2.1 Three pre-paid rails, and they are never summed

`resolvePrePaidAmount` (`src/firestoreActions.ts:233`) answers "how much of this booking is already
paid?" by picking exactly ONE rail:

| # | Field | Written by | Note |
|---|---|---|---|
| 0 | `refundedAmount` (EXTERNAL_CHECKOUT) | refund flow | a recorded refund is newer than any snapshot |
| 1 | `platformDepositAmount` | *"the settled answer, whatever wrote it"* | **generic — has no owner today** |
| 2 | `stripeAmountPaid` − `refundedAmount` | Stripe webhook | the online rail |
| 3 | `paidAmount` when `paymentType === 'DEPOSIT'` | legacy | kept for old rows |

Rail 1 is the seam this plan uses. It is already documented as writer-agnostic, and the till already
nets it off: `checkoutDeskPrePaid.ts` bills only the remainder.

### 2.2 The surrounding configuration is built too

* per-tenant `paymentMode` ∈ `off | deposit | full | optional | pay_at_venue`
* `defaultDepositAmount` (£) with a per-service `depositAmount` override
* `paymentState` ∈ `DEPOSIT_PAID | PAID | …`
* a receivable/instalment engine — `foldReceivableLedger` + `buildInstalmentSchedule` — already
  live for the TR checkout executor, which is the machinery a £500 job paid in parts needs.

## 3. Blast radius — MEASURED, not estimated

`platformDepositAmount` is read in **19 non-test modules**:

```
functions: checkout/executor · parsers/booksy · parsers/fresha · receipts/index
frontend:  BookingDetailPanel · BookingForm · CheckoutPanel · ReceiptPanel · checkoutDeskPrePaid
           firestoreActions · Bookings · Dashboard · Finance · Reports · clientSpend
           staff/checkoutSheetPayload · bookingPrice · bookingUtils · salesPeriod
```

Every revenue reader computes the same thing — `paidAmount + platformDepositAmount − tip` — and
**every one of them is gated on `status === 'CHECKED_OUT'`** (`Finance.tsx:603,631,641,943`,
`Reports.tsx:363`, `salesPeriod.ts:312`, `bookingUtils.ts:285`). They also key the day off
`startTime`, not off when the money arrived.

**Consequence, and it is the whole design:** a deposit written onto a future booking that stays
`CONFIRMED` changes **nothing** in any of those 19 readers. Revenue continues to land on the service
day, which is the correct accounting treatment, and no reader needs to be touched.

## 4. The one real gap: today's cash has no home

If a salon takes £100 today for a booking on the 5th, that £100 is physically in the drawer tonight.
Revenue-wise it belongs to the 5th; cash-wise it belongs to today. Those are two different ledgers —
the same split Finance already maintains (operational vs capital).

Nothing in the product currently records "money received today that is not a sale today". That, and
only that, is what has to be built. Everything else is wiring an existing rail to a button.

**This is also the trap to avoid:** the tempting shortcut is to mark the booking checked out so the
cash shows up. That reproduces the 2026-09-01 incident exactly — right cash day, wrong revenue day,
wrong commission, wrong loyalty.

## 5. Plan — three phases, smallest first

### Phase 1 · The door (no reader changes)
A **Take deposit** action on a future booking's detail panel. It writes, in one update:

* `platformDepositAmount` — the amount
* `paymentState: 'DEPOSIT_PAID'`
* `depositTakenAt` (server timestamp) and `depositMethod` (CASH / CARD)
* an audit entry `DEPOSIT_TAKEN`

and does **NOT**: change `status` (stays `CONFIRMED`), award loyalty, send a receipt, or touch
`paidAmount`. On the service day the existing till already bills the remainder.

Gated by the same authority as OFF-DAY-AUTHORITY (`canWriteOffDay`): owner / admin / super-admin.
A deposit is a financial commitment, not a counter action.

### Phase 2 · The cash line
Show deposits received on a given day in that day's cash reconciliation, as a line that is explicitly
**not revenue**. Keyed on `depositTakenAt`, never on `startTime` — this is the only place in the
product where money is deliberately attributed to a different day from its booking, so it is named
and visible rather than blended in.

### Phase 3 · The endings (defer until 1–2 are live)
What happens to a deposit when the booking is cancelled, no-shows, or is rescheduled — forfeit,
refund, or carry. The online rail already has an 8-hour rule in BUSINESS_RULES.md; the in-salon rule
should not be invented separately, it should be the same policy read from the same setting.

## 6. Decisions the owner still owes

1. **Cash vs revenue presentation.** Deposits taken today: a separate line in the day's cash count,
   or a running "deposits held" balance, or both?
2. **Amount source.** Free-typed by the operator, or the configured `defaultDepositAmount` /
   per-service `depositAmount` offered as a default?
3. **Which bookings qualify.** Any future booking, or only above a threshold (the £500-job case)?
4. **Phase 3 policy** — same as the online cancellation rule, or a separate in-salon one?

## 7. Explicitly out of scope

* No fourth "money arrived" field. `resolvePrePaidAmount`'s contract is that the rails are never
  summed; a `savePaid`-style flag on the booking form would create a second answer to a question
  that must have exactly one, and money bugs live in that gap.
* No change to how future bookings are SAVED. Booking a future date from the panel or the Staff App
  is ordinary work and stays warning-free.
* No change to the TR checkout executor's request contract.
