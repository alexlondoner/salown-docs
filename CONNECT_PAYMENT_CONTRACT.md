# Connect capture/refund → desk checkout: the payment contract

Status: **source analysis and a proposed contract + test matrix. NOT IMPLEMENTED, not
deployed, no production payment touched.** This is package D of
[`CONNECT_PROFILE_READINESS.md`](CONNECT_PROFILE_READINESS.md) §C1, written so the C2b
projection-parity owner and the Connect owner can pin ONE contract before either writes code.

Evidence base: salown-app `9c0ae88` (source read on 2026-09-10). `features.stripe` is OFF for
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
  Smallest change; `externalNetPaidPence` already nets refunds in pence.
- **B — stamp at capture AND net at read.** The capture writes `platformDepositAmount`, and
  step 1 stops being unconditional. Larger blast radius: step 1 is what every existing
  settled sale relies on.

A cannot be adopted without proving EXTERNAL_CHECKOUT behaviour is byte-identical
afterwards; B cannot be adopted without proving no settled sale changes.

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

Agree shape A or B with the C2b owner, then implement it with the matrix above and a
connected-account **test-mode** rehearsal in an explicitly authorised isolated environment
before any production activation is requested.
