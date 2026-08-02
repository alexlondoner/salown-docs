# PAYMENT_PLAN_ENGINE.md — TR-B instalment arithmetic, allocation and overdue

> **Role:** the arithmetic half of TR-B. The domain model, entitlement, authorization and loyalty
> reasoning live in [TREATMENT_PACKAGE_SYSTEM.md](TREATMENT_PACKAGE_SYSTEM.md); read that first.
>
> **Source of truth:** `src/utils/packagePlan.ts` ⇄ `functions/src/packages/packagePlan.ts` —
> byte-identical PARITY CORE, pinned from both sides. This file explains *why* it does what it does.
>
> **Status:** ✅ DEPLOYED + LIVE-VERIFIED 2026-07-31 (baseline `c3716f7`).

---

## 0. The generic receivable fold now has a second consumer (TR-D1, 2026-08-02)

`foldReceivableLedger` was extracted in TR-D1 Phase 1 (`22cf85f`) as strategy B — a *logical*
extraction. It names nothing about packages: no `clientPackageId`, no definition, no entitlement, no
`PER_SESSION`, no delivered sessions, no package status. `foldPackageLedger` became a thin adapter
mapping the generic `total_m` onto the package contract's `packageTotal_m` — the same number under
two names, no stored field renamed and no value recomputed.

As of Phase 2B it has that second consumer: the **checkout executor** folds an ordinary salon
receivable — a partial balance, an unpaid checkout, a Salon Taksit Planı — through exactly this
function, and `buildInstalmentSchedule` builds its schedule. So the remainder rule documented in §3
below is now literally the same rule for a course of laser treatment and for a haircut paid off over
three months, and a reconciliation of either can be repeated from the ledger alone.

**Physical relocation is still deferred.** These functions live inside the package-named parity core
because that core has never had a runtime import — only `import type`, which is elided, which is
exactly what lets the Functions CJS build resolve nothing there. Moving them into their own file
would introduce the first runtime import into the most load-bearing money code in the product, plus a
second twin pair to keep byte-identical. Semantic independence is what matters and these signatures
have it; the move is a separate, mechanical change whenever it earns its keep.

**What the checkout executor does NOT reuse:** package semantics. An ordinary receivable never
carries an entitlement, and a package payment plan's debt is never restruck as one — the checkout's
`chargeableTotal_m` has `packagePrepaid_m` removed before the debt is struck, so the exclusion is
structural rather than a check. See [TR_CHECKOUT_ARCHITECTURE.md](TR_CHECKOUT_ARCHITECTURE.md) §4/§7.

---

## 1. The engine is pure

Nothing in `packagePlan.ts` reads Firestore, the clock, `Intl`, or any global. Plain data in,
decision out.

That is what makes every balance in the product **reproducible**: a disputed total can be recomputed
from the stored ledger alone, months later, on a different machine, and must come out identical. The
transactional wrapper (`executor.ts`) owns all I/O; the engine owns all arithmetic.

Every amount is an **integer in minor units**. `isMinorUnits()` requires `Number.isSafeInteger` —
not merely `Number.isInteger`, which accepts 2^60 and then loses precision on the next addition,
exactly the drift integer minor units exist to prevent.

---

## 2. Plan kinds

| Kind | Schedule |
|---|---|
| `FULL` | One instalment, due on the purchase date. |
| `INSTALMENTS` | *n* dated instalments — equal split, or caller-supplied amounts and dates. |
| `PER_SESSION` | One instalment per session, due as each session is **delivered**. |
| `OPEN` | **No schedule at all.** An open account, paid off in arbitrary partial amounts. |

`OPEN` is deliberately *not* modelled as "one instalment for the whole amount, due today" — that
would render as overdue the day after the sale, which is precisely the opposite of what an open
account means. An open account can never be overdue, by construction.

`PER_SESSION` instalments carry `dueDate: null`, because no calendar can know in advance when a
session will be delivered. They become `due` only once the session count they sit at has actually
been delivered, and can therefore never be `overdue` either.

---

## 3. The rounding rule

```
base      = floor(total_m / n)
remainder = total_m − base × n          // strictly < n
instalment[1] = base + remainder
instalment[k] = base                     for k > 1
```

**The whole remainder goes on instalment #1.** A deliberate, documented choice, not an accident of
the loop:

1. **It is deterministic.** Regenerating a schedule from the same inputs is byte-identical, so a
   reconciliation can be repeated and will agree.
2. **The odd kuruş lands at the desk.** Instalment #1 is the payment the client makes in person, with
   a human present to see it — not a payment three months away that arrives as a surprise.
3. **Every later instalment is a round, quotable figure** — *"then 500 ₺ a month"*, which is how the
   salon actually sells the plan.

`Σ instalments === total_m` **always**, with no float ever constructed. Exhaustively tested for every
count up to the hard cap (120) across a range of totals including 0, `n−1`, `n` and `n+1`.

The instalment that carries the remainder stores `carriesRemainder: true`, so the schedule is
self-explaining in the UI and in an export — a client asking *"why is the first one 1 kuruş more?"*
gets an answer from the document. The sell screen states it in words, in the salon's own currency,
before Save is pressed.

### Refused schedules

`total_m < n` → `INSTALMENT_TOO_SMALL`. An instalment of zero is not a payment.
Custom instalments that do not sum to the total → `CUSTOM_SUM_MISMATCH`, and **the message states
both numbers** — this is the one schedule error a human fixes by editing a field, and "they don't add
up" without saying by how much is a support ticket rather than a correction.

---

## 4. Due dates are calendar arithmetic on tenant date keys

Due dates are `"YYYY-MM-DD"` strings produced by adding whole days to the purchase date key:

```
seq k is due on  purchaseDateKey + (k − 1) × intervalDays
```

The arithmetic runs **in UTC on the key**, and never consults a timezone — because the key is
*already* tenant-local (TR-A's `tenantDateKey`). Doing it in a zone would apply the offset twice and
shift a due date across a DST boundary.

`isDateKey()` round-trips through `Date.UTC` so `2026-02-30` is **rejected** rather than silently
rolling forward to March 2nd the way `new Date` would.

The sale itself is dated by the tenant calendar: a package sold at 22:30 UTC on 2026-08-01 is a
**2026-08-02** sale in Istanbul, and its first instalment is due that day. Tested, and verified live.

---

## 5. Allocation is a waterfall, not a spread

Paid money is allocated across the schedule **oldest first**:

> When a client pays 500 against three 400-instalments, the salon's answer to *"what have I paid
> off?"* is **"the first one and a bit of the second"** — never *"41.6% of each"*.

This is also what makes `nextDue` a single, nameable row a staff member can point at on screen.

Allocation uses `paid_m` (**cash retained, net of refunds**), not gross: money handed back has not
paid off an instalment.

The stored instalment array is **sorted by `seq` defensively** before allocating, so an array whose
order was disturbed by a merge cannot silently change who gets paid first.

---

## 6. Instalment status

| Status | Meaning |
|---|---|
| `paid` | `remaining_m === 0` |
| `partial` | some paid, some left, inside the grace window |
| `due` | nothing paid, inside the grace window |
| `overdue` | `dueDate + overdueGraceDays < todayKey` and not fully paid |
| `unscheduled` | no promised date yet (`PER_SESSION` before delivery, `OPEN`) |

**`overdue` beats `partial`.** A part-paid instalment past its grace window is both; overdue wins,
because it is the one that requires an action.

`settled` is decided by the **package balance**, not by the schedule — an `OPEN` account has no
instalments at all, and a schedule can be fully allocated while an adjustment has since raised the
total.

---

## 7. Payment admissibility

`admitPaymentEntry()` is the single gate, run **locally first** (so the desk is told instantly, in
the salon's own currency) and again **inside the server transaction** against a freshly folded
balance (the only authority).

| Reason | When |
|---|---|
| `OVERPAYMENT` | `amount_m > outstanding_m` — see §8 |
| `BELOW_MINIMUM_PARTIAL` | part payment under `minPartialPayment_m` |
| `PARTIAL_NOT_ALLOWED` | salon does not take part payments |
| `METHOD_NOT_ACCEPTED` | method not in the salon's list |
| `REFUND_EXCEEDS_PAID` | refunding more than the salon is holding |
| `ADJUSTMENT_BELOW_PAID` | adjustment would take the total below what was already paid |
| `ADJUSTMENT_NEGATIVE_TOTAL` | adjustment would make the price negative |
| `PACKAGES_DISABLED` | tenant has the feature off |

Paying the **exact** outstanding balance is never treated as a part payment, so a
`minPartialPayment_m` floor cannot block settling an account.

`ADJUSTMENT_BELOW_PAID`'s message names the action actually wanted — *"record a refund instead"* —
because negative debt is a liability this ledger has no concept of, and the salon's real intent in
that moment is always a refund.

---

## 8. Overpayment is REJECTED, not credited

An explicit product decision (ADR-020), not an oversight.

Accepting an overpayment would create salon-wide client credit **with nowhere to live**. TR-B's
ledger is scoped to **one package**, so a 100 ₺ excess would either:

- sit as negative debt on a package it does not belong to — breaking `M2_NON_NEGATIVE_OUTSTANDING`
  and making every balance on that package a lie; or
- need a **client wallet**, which is a different product with its own expiry, transfer, refund and
  tax rules.

Refusing an amount the staff member can immediately retype is a **smaller harm** than inventing a
liability the system cannot then explain. The UI mitigates the friction directly: "pay the remaining
₺6.000,00" and "pay instalment 2 — ₺2.666,67" are one tap each, filling the field rather than
submitting, so the staff member still confirms.

If a salon genuinely wants to hold client credit, that is a wallet package, and it should be built as
one.

---

## 9. Money input parsing

The boundary where keystrokes become an integer the ledger treats as fact
(`src/lib/packagesApi.ts` → `parseMinorUnits`).

A Turkish keyboard writes `1.234,50` and a UK one writes `1,234.50` for the same amount. The salon
should not have to know which one the box wants, and the ledger must never see the difference.

Resolution order, by conclusiveness of evidence:

1. **two different separator characters** → the last one is the decimal (`1.234,50` = `1,234.50`)
2. **the same separator more than once** → all grouping (`1.234.567`)
3. **one separator, exactly three digits after it** → grouping (`1.234` is 1234)
4. otherwise → decimal (`12.50`, `12,5`)

Rule 3 is the only genuinely ambiguous case. `12.567` is 12,567 to a Turkish salon, and no salon
prices anything to three decimals — so grouping is the only reading ever meant. Someone who wants
12.56 types `12.56`, which has two digits and parses as a fraction.

A long fraction is **truncated, never rounded**: rounding up would invent a kuruş nobody handed over.

**Unreadable input returns `null`, never `0`.** A `0` would record a payment of nothing and look like
a success.

---

## 10. Idempotency

Every mutation takes a caller-supplied `idempotencyKey` matching
`/^[A-Za-z0-9_.:-]{8,128}$/` — the same shape `salownCreateBooking` and the inventory executor use.

For money, **the key IS the ledger doc id**, so a double-tapped "Record payment" cannot write twice:
the second attempt is a `tx.create` on an existing path. The stored `fingerprint` (sha256 of the
caller's intent) then decides:

- same key + same intent → **REPLAY**, zero writes, `ok: true`
- same key + different intent → **`IDEMPOTENCY_CONFLICT`**, zero writes

The fingerprint deliberately **excludes the clock and the current balance**, so a retry replays even
after other entries landed in between.

### The UI half, which is where this is usually lost

> The key is minted when the **form opens**, and reused for every submit attempt from that form.

A key minted at submit time is a *new key on every click* — three taps on a slow connection become
three payments, reintroducing in the UI exactly the bug the mechanism exists to prevent. Both the
panel's `RecordEntryModal` and the Staff App's payment sheet mint once, in `useState`'s initialiser.

---

## 11. Settings: lenient read, strict write

Same asymmetry as TR-A `presentation`, and for the same reason: these values decide how a screen
*behaves*, and one bad stored integer must not take the Packages page away from a whole salon.

- **`resolvePackageSettings`** is TOTAL — never throws, falls back per field, and puts what it
  rejected in `issues[]` so a bad value is diagnosable rather than invisible. The Settings panel
  shows those issues.
- **`validatePackageSettingsInput`** is STRICT — the UI and the server both run it, so a value the
  reader would have to fall back on is never stored in the first place.

Two details worth knowing:

- A `methods` list of pure nonsense **falls back to the default list** rather than resolving to an
  empty one. A tenant whose whole methods list was typos must still be able to take cash; one bad
  save must not lock the till.
- `saleDepositRequired_m` is the **one** field where explicit `null` is meaningful — it is the stored
  way to say "no deposit". Everywhere else `null` is rejected; omitting a key is how you inherit the
  default.

A cross-field check refuses to save a salon with **no** payment arrangement enabled, which would
otherwise produce a Sell button that always fails.

Defaults are the most conservative salon that still works, and `enabled: false` is the important one:
a tenant that never asked for packages resolves to today's behaviour with the whole feature dark.

---

## 12. Reason codes

All PII-free and safe to log verbatim. Money invariants `M1`–`M8` and entitlement invariants
`E1`–`E3` are listed in [INVARIANTS.md](INVARIANTS.md) §1. Executor envelope reasons are in
`functions/src/packages/executor.ts` (`PACKAGE_REASONS`), and each one that a salon can act on has a
plain-language translation under `packages.error.*` in both dictionaries. An unmapped code falls back
to a generic sentence rather than showing `SCREAMING_SNAKE_CASE` to a receptionist.
