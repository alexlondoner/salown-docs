# Connect capture/refund → desk checkout: the payment contract

Status: **source analysis and a proposed contract + test matrix. NOT IMPLEMENTED, not
deployed, no production payment touched.** This is package D of
[`CONNECT_PROFILE_READINESS.md`](CONNECT_PROFILE_READINESS.md) §C1, written so the C2b
projection-parity owner and the Connect owner can pin ONE contract before either writes code.

Evidence base: salown-app `9c0ae88` for §1-§5; §2a is an executable measurement against `4d2eb73` on 2026-09-10. `features.stripe` is OFF for
every production tenant, so nothing described here is currently taking money.

## 1. What the writer actually writes

`salownConnectWebhook`, `functions/src/index.ts` ~4248-4265, on
`checkout.session.completed` / `checkout.session.async_payment_succeeded`:

| field | value |
|---|---|
| `status` | `CONFIRMED` |
| `stripeAmountPaid` | `session.amount_total / 100` |
| `paidAmount` | the same figure |
| `paymentType` | `FULL` or `DEPOSIT` (from `metadata.paymentType`) |
| `paymentState` | `PAID` (full) or `DEPOSIT_PAID` (deposit) |
| `remaining` | `0` for full, `fullPrice − amountPaid` for a deposit |
| `stripeSessionId` / `stripePaymentIntent` / `stripeAccountId` / `stripeEventId` | Stripe identities |

and on `charge.refunded` (~4185-4195): `refundedAmount`, `paymentState` =
`REFUNDED`/`PARTIALLY_REFUNDED`, `stripeRefundedAt`.

**It never writes `paymentProvider` and never writes `platformDepositAmount`.**
`paymentProvider` is stamped once, at booking creation
(`functions/src/bookings/createBooking.ts:1127`, `paymentProvider: pay.provider`), so a
Connect booking carries `SALOWN_CONNECT` from birth — the capture neither confirms nor
changes it.

## 2. What the desk reads

`resolvePrePaidAmount`, `src/firestoreActions.ts:280-313`, in order:

0. refund precedence — **only** when `paymentProvider === 'EXTERNAL_CHECKOUT'`;
1. `platformDepositAmount` if > 0 — "the settled answer, whatever wrote it";
2. the verified net online amount — **only** for `EXTERNAL_CHECKOUT`;
3. legacy — `paymentType === 'DEPOSIT'` ⇒ `paidAmount`;
4. otherwise `0`.

## 2a. MEASURED 2026-09-10 — the desk does not always ask the resolver

An executable probe against salown-app `4d2eb73` drove the **real**
`resolvePrePaidAmount` and the **real** `resolveDeskPrePaid` over the same bookings —
no transcription of either. `correct` is the money the salon still holds.

| booking | correct | `resolvePrePaidAmount` | `resolveDeskPrePaid` (Admin till) |
|---|---|---|---|
| EXTERNAL DEPOSIT £10, fully refunded | 0 | 0 | **10** ❌ |
| EXTERNAL DEPOSIT £10, £4 refunded | 6 | 6 | **10** ❌ |
| EXTERNAL FULL £32, fully refunded | 0 | 0 | 0 |
| Connect DEPOSIT £10, fully refunded | 0 | **10** ❌ | **10** ❌ |
| Connect DEPOSIT £10, paid | 10 | 10 | 10 |
| Connect FULL £40, paid | 40 | **0** ❌ | **0** ❌ |
| Connect FULL £40, fully refunded | 0 | 0 | 0 |

D1 and D2 are confirmed exactly as §3 states them. Connect FULL *refunded* lands on 0
for the wrong reason — rail 3 demands `DEPOSIT` and returns 0 by omission, not by netting.

Two further facts change the plan.

### The Admin till has a branch in front of the resolver

`resolveDeskPrePaid` (`src/components/checkoutDeskPrePaid.ts`) returns
`paidAmount || platformDepositAmount || 0` whenever `paymentType === 'DEPOSIT'`, and
only falls through to `resolvePrePaidAmount` when that test fails. The rows above prove
the independence directly: the resolver already answers `0` where the till answers `10`.

**Therefore no change confined to `resolvePrePaidAmount` can move the till's answer for
any DEPOSIT-typed booking.** Shape A as written in §4 closes D1 (a FULL booking does
fall through to the resolver) and leaves **D2 open at the Admin till**.

Not every surface shares the branch. `src/staff/lib/checkoutSheetPayload.ts:105` calls
`resolvePrePaidAmount` directly, so the **Staff app and the Admin till already disagree**
on a refunded DEPOSIT booking today.

### D3 (new) — the same defect is already live on EXTERNAL_CHECKOUT

> **Status 2026-09-10: fixed in source, `PUSHED_NOT_LIVE` (salown-app `3a02620`).** By owner
> decision D3 was released from this package and fixed on its own, ahead of any Connect work,
> because it is a live money defect and Connect is switched off. It still needs its own hosting
> release and live verification. `SALOWN_CONNECT` was deliberately left unchanged by that fix and
> is pinned by a test, so shape A+ below cannot land as a side effect of it. The rows in the §2a
> table marked ❌ for the Admin till on the EXTERNAL rail now read correctly.


This is not a Connect-only problem, and it is on the rail Whitecross runs on. The chain
is complete in shipped code:

1. `whitecross-site/script.js:2468` — the live web checkout writes
   `paymentType: 'DEPOSIT'` with `paidAmount = _depositFlat` (£10, `script.js:3280`)
   on a `source: 'Website'` / `EXTERNAL_CHECKOUT` booking.
2. `whitecross-site/functions/refunds.js` writes `refundedAmount` and the refunded
   `paymentState`; it deliberately never lowers `paidAmount`.
3. The customer attends and the till runs `resolveDeskPrePaid` → the `DEPOSIT`
   short-circuit credits the **original** deposit, ignoring the refund, and the desk
   under-charges by the refunded amount.

BL-6 fixed exactly this arithmetic in the resolver; the presenter never inherited it.
The full-refund case is largely self-limiting (a refunded booking is usually cancelled,
and a cancelled booking cannot be checked out), so the live shape to worry about is a
**partial** refund on a booking that stays `CONFIRMED` and is then attended.
**Production incidence is unmeasured** — this is a reachability proof from shipped
source, not a count of affected bookings.

### D4 (new) — a second refund-blind copy outside this repo

`whitecross-site/barber-mobile/app.js:47` carries the same rule
(`platformDepositAmount || (paymentType === 'DEPOSIT' && status !== 'CHECKED_OUT' ? paidAmount : 0)`)
with no refund term at all. It is a separate deploy unit and no change in salown-app
reaches it.

## 3. The two defects, as arithmetic

A Connect booking has `paymentProvider === 'SALOWN_CONNECT'`, so steps 0 and 2 do not apply
to it, and step 1 is empty because the capture writes no `platformDepositAmount`.

**D1 — a fully prepaid Connect booking resolves to ZERO at the desk.**
£40 taken online, `paymentType: 'FULL'`. Step 3 requires `DEPOSIT`, so the resolver returns
`0` and the desk bills £40 that the customer has already paid. The receipt then reports the
whole £40 as collected at the terminal.

**D2 — a refunded Connect deposit still resolves to its ORIGINAL amount.**
£10 deposit, then refunded: `refundedAmount: 10`, `paymentState: 'REFUNDED'`,
`paidAmount` untouched at `10`. Step 0 is EXTERNAL-only, so step 3 returns `10` — the desk
credits money the salon has already sent back and under-charges by the refund. This is the
expensive direction, and it is the same class of mistake BL-6 fixed for EXTERNAL_CHECKOUT.

## 4. Why "just stamp `platformDepositAmount`" is not the fix

Stamping it at capture would close D1 and would leave D2 open, or make it worse: step 1
returns a **stored snapshot** and outranks every later fact, so a refund arriving after the
capture would be ignored by construction — precisely the staleness BL-6 documents at
`src/firestoreActions.ts:288-294`. Whatever the contract turns out to be, `SALOWN_CONNECT`
needs the refund-aware branch, not a compatibility field.

Two candidate shapes, to be decided by the two owners together:

- **A — generalise the verified rail.** Steps 0 and 2 stop naming `EXTERNAL_CHECKOUT` and
  test "the provider whose webhook writes `stripeAmountPaid`", which is both of them.
  Smallest change; `externalNetPaidPence` already nets refunds in pence. Its safety for
  the live rail is now provable rather than argued: widening a `===` test to set
  membership changes the answer for the added member only, so every `EXTERNAL_CHECKOUT`
  and every provider-less legacy row is byte-identical by construction (matrix rows 10
  and 11).
  **But §2a shows A alone is incomplete**: it never reaches the Admin till for a
  DEPOSIT-typed booking, so it closes D1 and leaves D2 open. A is necessary, not
  sufficient — it needs **A+** below.
- **B — stamp at capture AND net at read.** The capture writes `platformDepositAmount`, and
  step 1 stops being unconditional. Larger blast radius: step 1 is what every existing
  settled sale relies on.

- **A+ — A, plus the presenter's DEPOSIT branch defers to the resolver.** The
  `paymentType === 'DEPOSIT'` short-circuit in `resolveDeskPrePaid` stops answering from
  `paidAmount` when the booking carries a webhook-verified rail, and asks
  `resolvePrePaidAmount` instead. This is the only shape that closes D2 at the till, and
  it closes **D3 on the live Whitecross rail** in the same change. Its blast radius is
  the 69 live aggregator/legacy bookings the desk matrix already pins — the aggregator
  branch sits above it and is not touched, and a booking with no verified rail keeps the
  legacy reading exactly.

A cannot be adopted without proving EXTERNAL_CHECKOUT behaviour is byte-identical
afterwards; B cannot be adopted without proving no settled sale changes. **A+ additionally
changes a live answer on purpose** (D3), so it is a fix that needs owner authorisation and
its own live verification, not a silent side effect of the Connect work.

Whichever shape is chosen, the twin `externalNetPaidMinor` /
`resolvePrePaidAmount` in `functions/src/checkout/executor.ts` must move with it —
`parity.test.js` pins the two writers to the penny and will fail if only one changes.
`whitecross-site/barber-mobile/app.js` (D4) is a separate deploy unit and does not move
with either.

## 5. The test matrix this needs before either shape ships

Drive the REAL writer's output into the REAL readers — not a transcription of either.
One shared fixture, both sides, as `parserImportHealthVectors.json` already does:

| # | scenario | must resolve to |
|---|---|---|
| 1 | Connect FULL captured | the full amount |
| 2 | Connect DEPOSIT captured | the deposit |
| 3 | Connect DEPOSIT, fully refunded | 0 |
| 4 | Connect DEPOSIT, partially refunded | deposit − refund, in pence |
| 5 | Connect FULL, fully refunded | 0 |
| 6 | capture webhook delivered twice (same `stripeEventId`) | unchanged after the second |
| 7 | refund webhook BEFORE capture (out of order) | never a negative or inflated prepaid |
| 8 | checkout retry after a desk correction | the remainder, never the resolver's own output |
| 9 | desk remainder + totals | `paidAmount + prepaid` equals the sale total |
| 10 | EXTERNAL_CHECKOUT regression, all of 1-9 | byte-identical to today |
| 11 | legacy DEPOSIT with no provider | byte-identical to today |
| 12 | `paymentState` PENDING / absent | 0 (nothing was taken) |
| 13 | **Admin till** — Connect DEPOSIT, refunded (§2a) | 0 — not `paidAmount` |
| 14 | **Admin till** — EXTERNAL DEPOSIT, partly refunded (D3) | deposit − refund |
| 15 | **Admin till** — aggregator + legacy DEPOSIT with no verified rail | byte-identical to today |
| 16 | Staff sheet and Admin till, every row above | the same figure on both |

Rows 10 and 11 are the ones that decide whether the change is releasable at all: Whitecross
is live on EXTERNAL_CHECKOUT.

## 6. Coordination

`SYNC.md` and `test/fixtures/checkoutProjectionParity.json` +
`functions/src/checkout/legacyProjectionParity.test.js` +
`src/utils/checkoutProjectionParity.test.ts` belong to **C2B-B0-PARITY**. This document
deliberately writes none of them and proposes no second allocation model: the canonical
allocation and the advance ledger keep their current responsibilities.

Whitecross's B1 external-account fee ledger is not a Connect rehearsal and does not close
any row above. COA over-allocation rejection is a separate defence, not a correct prepaid
display.

## 7. Next step

Rows 10, 11 and 15 decide releasability; rows 13, 14 and 16 are what §2a added.

1. **Owner decision required — D3 is a live defect on Whitecross's rail and Connect is
   not.** It can be fixed on its own schedule, ahead of and independently of any Connect
   work, or deliberately deferred. It should not be bundled into a Connect activation
   package by default.
2. Agree **A+** (or B) as the shape. The C2b owner's 2026-09-10 `SYNC.md` entry states
   "C-1 Connect prepaid, untouched and explicitly NOT closed by this package", so the
   boundary is already drawn; what still needs their sign-off is that the presenter
   change lands in `checkoutDeskPrePaid.ts`, which their scope item 1 names as a
   gate-free raw scalar consumer.
3. Implement against the 16-row matrix, driving real writer output into real readers,
   with the current behaviour pinned first as the negative control.
4. Only then a connected-account **test-mode** rehearsal in an explicitly authorised
   isolated environment, before any production activation is requested.
