# IN_SALON_DEPOSIT_PLAN.md — taking money in advance, at the desk

> **Role:** how salOWN records money collected in person, today, against a service delivered later.
> **Status:** 🔵 Planned. Nothing is built.
> **Version:** v2 (2026-09-02). v1 proposed a single scalar on the booking; the owner rejected it
> before release — *"tek scalar yazmak, ilk vakayı çözer ama ikinci kapora, kısmi iade veya aktarım
> geldiğinde yeni bir para belirsizliği üretir."* That judgement is the spine of this version.
>
> **Related:** [PAYMENT_PLAN_ENGINE.md](PAYMENT_PLAN_ENGINE.md) (the generic fold) ·
> [STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md) (the online rail) ·
> [TR_CHECKOUT_ARCHITECTURE.md](TR_CHECKOUT_ARCHITECTURE.md) · [INCIDENTS.md](INCIDENTS.md) 2026-09-01

---

## 1. The rule, stated once

> **A deposit is not a checkout.** Cash moves today; service revenue, commission and loyalty are
> earned when the service is delivered.

The 2026-09-02 checkout day-guard closed the wrong door — you can no longer quietly check out a
booking that belongs to a later day. This document opens the right one.

## 2. Owner's product decisions (2026-09-02) — these are settled

**2.1 The till shows a MOVEMENT and a BALANCE, not one number.**

Today's till: `Deposit taken — cash £100`, `Deposit taken — card £50`, included in the day's
cash/card totals, and excluded from service revenue, barber revenue, commission and loyalty.
Alongside it a held-deposit summary: opening held · taken today · redeemed today · refunded today ·
closing held. This mirrors the report model Fresha ships (opening balance, collections,
redemptions, refunds, closing balance).

**2.2 Three concepts stay separate, permanently.**

`cash received` · `service revenue / commission earned` · `VAT tax point`. In the UK, an advance
payment for a specified service generally creates a VAT tax point on the day the money is received
(HMRC: VAT on instalments/deposits; VATTOS5120). So "revenue on the service day" is right for
salOWN's operational reporting and is **not** the whole of VAT reporting. The product records the
tax-point date per entry; it does not compute anybody's tax return.

**2.3 The system proposes the amount, an authorised operator changes it.**

Order: per-service `depositAmount` → tenant `defaultDepositAmount` → empty. Fixed amount or
percentage. Constrained to `0 < deposit ≤ outstanding balance`. A reason is required only when the
operator leaves the policy. Money beyond the outstanding balance is **not a deposit** — that is
customer credit, a different product, and must not be pushed through this field.

**2.4 Every not-yet-started, eligible booking qualifies. No price threshold.**

Eligible = starts in the future · not cancelled/no-show/checked-out · has a defined positive
commercial total · has balance beyond the advances already recorded. A threshold is meaningful only
for a future "is a deposit REQUIRED?" policy, never for "may the salon accept one?".
First release is gated to owner/admin/super-admin; the right long-term shape is a distinct
`take_deposit` permission — a receptionist taking money is normal, a receptionist holding every
admin right is not.

**2.5 Cancellation policy is NOT inherited from the online rule.**

Online, the client saw and accepted the terms; at the desk that consent may not exist. So:
reschedule → the advance follows the appointment automatically; salon cancellation → default full
refund; client cancellation / no-show → the owner must choose a disposition (refund · retain as
cancellation fee · transfer to the rescheduled appointment · convert to customer credit, later
phase). **"Retain" is offered only when a policy snapshot the client accepted exists.** No
automatic forfeiture in the first release.

## 3. The architectural correction, and what the code actually shows

v1's `platformDepositAmount` + `depositTakenAt` + `depositMethod` cannot answer: how much cash
entered the drawer today, which payment was refunded, on which day, by whom, whether a retry was
processed twice, or which booking the money moved to. The owner's case — online £50, then £100 cash
at the desk, then £30 refunded, then a reschedule — makes a scalar meaningless: with rails that are
never summed, it is undefined whether the field should read £100 or £150.

So the model is an **append-only advance-payment ledger**, and `platformDepositAmount` survives only
as a **derived compatibility projection** for the 19 existing readers.

### 3.1 What already exists and must be reused — verified in code, 2026-09-02

| Asset | Where | Why it fits |
|---|---|---|
| `foldReceivableLedger` | `packagePlan.ts:211` (mirrored in `functions/`) | Generic, **order-independent by construction**, `PAYMENT / REFUND / ADJUSTMENT / REVERSAL`, with reversal resolution and the money invariants already enforced: integer minor units, uniform currency, sign. |
| `ReceivableEntryLike` | `packagePlan.ts:176` | A **structural minimum of five fields**. Extra per-entry fields — method, occurredAt, actor, idempotency key, bookingId, policy snapshot, tax point — ride along untouched. The owner's entry shape needs **no change to the fold**. |
| `foldPackageLedger` | `packagePlan.ts:292` | The precedent for mapping the generic vocabulary onto a domain **without renaming a stored field or recomputing a value**. An advance-payment adapter is the same move. |
| `packageLedger` | `functions/src/packages/executor.ts:543,836` | The proven storage shape: **one document per entry** in a collection, queried and folded — not an array on the parent. |
| The append gate | `packages/executor.ts:874` | *"Refuse to append to a ledger that does not already add up"* — a reconciliation check before every append, so a new row can never bury an existing break. Copy this verbatim in spirit. |
| `financialCache` | `checkout/executor.ts:1240` | The precedent for a **derived projection stored beside the authority** — exactly the role `platformDepositAmount` would take. |

**Conclusion: do not invent a ledger.** The arithmetic authority exists, is tested, and already has
two consumers. New money maths would be the mistake.

### 3.2 What does NOT exist — "extend" is real work, not wiring

1. **There is no append path for receivables at all.** `receivables/` is written in exactly ONE
   place (`checkout/executor.ts:749`), and the only production call is
   `foldReceivableLedger([], …)` — a literal empty array. The comment *"the ledger opens empty and
   every later payment appends"* describes an intention; the appending code is not written. Only
   `packageLedger` is fed real entries today.
2. **The receivable is keyed by the checkout intent** (`receivableId = req.key`) and is created only
   when `outstanding_m > 0` **at checkout**. An advance taken three weeks earlier has no intent and
   no receivable. A booking-derived id and a create-on-first-advance path are required.
3. **Polarity and vocabulary.** A receivable is a DEBT (the client owes the salon); an advance is a
   LIABILITY (the salon holds the client's money). The arithmetic carries it — a `PAYMENT` against a
   total reduces `outstanding_m`, which is exactly "the deposit reduces the balance due" — but
   `REDEEMED`, `TRANSFERRED` and `RETAINED_AS_FEE` have no representation, and "held balance" is not
   a number the fold produces. `paid_m` equals the held balance only until the first redemption.
4. **`resolvePrePaidAmount` has no defined answer for two coexisting advances.** Rail 1 is a settled
   scalar; rails are never summed. Consolidating online £50 + desk £100 into £150 in that field is
   the only coherent scalar answer, and it destroys the movement history — which is precisely why
   the ledger must be the authority and the scalar must become derived.

### 3.3 The open architectural question for the owner

Does an advance live on the **same** `receivables` document (widening it from a debt into a
two-sided account), or on a **sibling** collection sharing the same fold?

**Recommendation: a sibling, sharing the fold.** A receivable is born at checkout and keyed by a
checkout intent; an advance exists before any checkout and must survive a reschedule. Overloading
one document makes its lifecycle answer to two unrelated triggers. What "don't invent" protects is
the **arithmetic**, and that is shared either way.

## 4. Phases

### Phase 1 — the money door
`Take advance payment` on an eligible booking. Writes an append-only `ADVANCE_COLLECTED` entry
(amount, method, occurredAt, actor, bookingId, idempotency key, policy reference, tax-point date),
updates the derived projection on the booking, leaves `status: CONFIRMED`, and produces **no**
revenue, commission or loyalty. Audit + idempotency + the reconciliation gate before append.
A **deposit acknowledgement** is sent — amount, method, estimated service total, remaining balance,
appointment date, refund/cancellation policy snapshot, transaction reference. It is not a service
receipt and creates no loyalty.

### Phase 1B — terminal safety (NOT deferred)
Accepting money without modelling how it closes creates an open liability. Ships with Phase 1:
disposition on cancel/no-show, transfer behaviour on reschedule, and at minimum a manual
refund/retain/transfer record.

### Phase 2 — till and liability reporting
Collections · redemptions · refunds · retained fees · opening/closing held balance · cash/card
split · a tax-point field for a VAT-aware export. **Note:** `receivables`, `packageLedger` and
`clientPackages` carry no rule in `firestore.rules.LIVE`, i.e. they are server-only. This report
must be served by a callable or a server-computed projection — the browser cannot query it.

### Phase 3 — policy automation
Online policy snapshot · in-person acknowledgement · automatic refund window · customer credit ·
payment links / terminal.

## 5. Out of scope

* No fourth "money arrived" field. The rails are never summed; a second answer to a question that
  must have one is where money bugs live.
* No change to how future bookings are saved, or to the TR executor's request contract.
* The product records the tax-point date. It does not compute VAT.
