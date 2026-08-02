# TR_CHECKOUT_ARCHITECTURE.md — the server-authoritative in-salon checkout

> **Role:** the record of **how a checkout is decided and committed** — the executor, its one
> transaction, its idempotency contract, and the boundaries it deliberately does not cross.
>
> **Not** the settings contract (that is [PAYMENT_SETTINGS.md](PAYMENT_SETTINGS.md)), not the
> receivable arithmetic (that is [PAYMENT_PLAN_ENGINE.md](PAYMENT_PLAN_ENGINE.md)), and not package
> semantics (that is [TREATMENT_PACKAGE_SYSTEM.md](TREATMENT_PACKAGE_SYSTEM.md)).

**Status: Phase 2B DEPLOYED 2026-08-02 · `salownCheckoutBooking` live in `europe-west2` · NOTHING
CALLS IT YET.** The Admin panel and the Staff App keep their existing browser checkout path. See
[DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md) for the live/pushed ledger.

---

## 1. Why a server executor exists at all

Today's checkout is a **browser** function — `checkoutBooking` and `createProductSale` in
`src/firestoreActions.ts`. It reads the catalogue, computes the money and writes the booking and the
client document from the client, across several non-atomic writes. That is adequate for one desk on
one till and untenable for what the Turkish market needs: split tenders, partial balances, salon
instalments, bank instalments, a receivable ledger — and a phone that loses signal halfway through a
charge.

The executor (`functions/src/checkout/executor.ts`, `checkoutBookingCore`) is the replacement
authority. One callable, one transaction, one decision.

### The phases, and why the order is fixed

Firestore forbids a read after a write in the same transaction and has no nested transactions. So
the body runs in three strict phases:

1. **Every read** — intent, settings, staff, tenant, booking, service, options, products, client,
   clientPackage.
2. **`packageSessionTx`** — the TR-D1 Phase 2A seam. It opens with its own `tx.getAll` and then
   writes, so it must run after phase 1 and before any write of ours.
3. **Our writes.**

> ### ⚠️ The sharpest edge in the file
>
> `packageSessionTx` **stages writes**, and returning a refusal after it has run does **not** abort a
> Firestore transaction: the callback returns normally, the commit lands, and the salon has a
> consumed entitlement with no checkout attached to it.
>
> Every remaining refusal — the tender snapshots, the salon-instalment policy, the schedule, the
> receivable fold, the sale-id collision — was therefore moved **ahead** of the seam, where a
> refusal still costs nothing. A static test in `executor.test.js` fails if one ever moves back.
>
> This was a real defect in the first draft, caught by writing that test. It is recorded here
> because the next person to add a validation rule will want to put it next to the code it guards,
> and that instinct is wrong in this one file.

The public package **callable** is never invoked from the executor. That would be a second commit a
failure could leave half-applied — the exact thing Phase 2A was extracted to prevent.

---

## 2. The trust boundary

The client submits **intent**, never money. Every one of these is resolved inside the transaction,
and a submitted value is either not part of the request shape at all or rejected outright as an
unknown field:

price · product total · package credit · currency · chargeable total · loyalty amount ·
commission · provider configuration · receivable total · receipt amount · permission flags

`tenantId` is the auth **claim**, never a request field.

An unknown key is a **hard rejection, never a silent drop** — a caller that believes it is setting
the price must be told that it is not. `{ productId, qty, price: 1 }` fails with `INVALID_INPUT`
rather than quietly ignoring the price.

### What the client legitimately decides

Only what an operator decides at the till: the tender allocations, the discount, the tip, the
service charge, the product ids and quantities, the add-on option ids, the package to redeem, the
outstanding arrangement and its due date. All bounded, all integer minor units, all fingerprinted.

---

## 3. Where each amount comes from

| Amount | Source | Why |
|---|---|---|
| Base service | the **BOOKING**, via the shared fold contract (`resolveServiceBaseAmount`, hand-mirrored) | It is what the customer was quoted. Re-quoting from today's catalogue would let a Monday price rise change what a Friday customer pays — the same "read tomorrow's price" failure the receipt snapshot exists to prevent. |
| Service existence / archival | the live service document, read in the transaction | A missing or archived service refuses the checkout. Existence is a guard; price is not re-derived from it. |
| Add-ons | **ids in, prices resolved** by `resolveSelectedOptions` — the same resolver `salownCreateBooking` uses | One resolver, two callers, no drift. A concurrent option price edit aborts and re-runs. |
| Products | `tenants/{tid}/products/{productId}`, read in the transaction | Authoritative catalogue price. See §5. |
| Currency + calendar day | the tenant's own `presentation` contract | TR resolves TRY, UK resolves GBP. Nothing selects it from IP, and the client cannot send it. |
| Redemption value | derived: `points × (minorPerMajor ÷ 20)` | The client says how many points to spend; the platform decides what they are worth. |
| Instalment commission | the tenant's own provider configuration, **snapshotted** | Never a live lookup — the same reason TR-B freezes a package price at sale. |

`known zero is zero`: an explicit `price: 0` is a real amount (a product-only sale, a package-linked
booking), while a document recording no parseable price at all is refused rather than invented.

---

## 4. Package prepayment

A linked session covers the **whole base service line**. That is not a new decision — it is exactly
what `price: 0` at link time already means in production. Removing it before the charge is computed
is the same seam that keeps the loyalty award from paying twice for a session the client already
bought.

```
chargeableTotal_m = grossTotal_m − packagePrepaid_m − discount − redeemed − paidEarlier   (floored at 0)
```

Because `packagePrepaid_m` is removed **first**, a package payment plan's outstanding balance — which
lives in TR-B's ledger and nowhere else — can never be restruck here as an ordinary receivable. That
is structural, not a check. Proven by test and live.

---

## 5. Products: authoritative price, explicitly no stock movement

**Settled in the Phase 2B-0 inventory audit, result I2.**

Validated per line, inside the transaction: same tenant, document exists, `active !== false`,
`inStock !== false`, quantity a positive safe integer, price a valid non-negative conversion from the
stored schema (`price` is stored as a **major-unit string** — `'50'` → `5000` minor).

Snapshotted onto the sale/receipt: product id, name, authoritative unit price, quantity, line total,
currency. A historical receipt reads its snapshot, never tomorrow's catalogue.

### The explicit limitation

> **Product catalogue pricing is authoritative; quantity stock tracking remains not wired.
> `inventorySaleTx` (I2) extraction is deferred until stock management is activated.**

The executor does **not** decrement `stockQty`, does not call any dormant inventory mutation, does
not create stock ledger rows, and does not reject on `stockQty`. The live availability guard is the
product document's `active` / `inStock` state, which is what the product page actually maintains.

The reason is not laziness: `stockQty` is dormant and nothing in production maintains it, so a
decrement would produce a stock figure that is *confidently wrong* — worse than no figure. Extracting
`inventorySaleTx` is the prerequisite for enabling quantity tracking, and it is a separate package.

---

## 6. Idempotency

A stable caller-minted `idempotencyKey` — **minted when the checkout screen OPENS**, not at submit —
**is** the intent document id (`tenants/{tid}/checkoutIntents/{key}`). Two devices contend for the
same path and Firestore lets exactly one create it.

| Situation | Result |
|---|---|
| same key, same fingerprint | **replay** — the stored result, zero writes |
| same key, different fingerprint | `IDEMPOTENCY_CONFLICT` — zero writes |
| double tap | one charge, one intent record |
| two devices, same booking, different keys | one winner; the loser gets `ALREADY_CHECKED_OUT` |
| `checking_unknown_result` | re-submit the SAME key; the server says which it was |

The fingerprint covers every operator decision and **excludes the clock and every resolved price**,
so a retry sent after a catalogue edit still replays the original result rather than being refused
as a different intent.

Derived, never random: the product-only sale document id is `sale__{intentKey}` with
`bookingId: SALE-{intentKey}`. No `Date.now()`, no `Math.random()`.

---

## 7. Receivables

Built on Phase 1's **generic** `foldReceivableLedger` (package-free, B2). Created at
`tenants/{tid}/receivables/{intentKey}` with a plan from `buildInstalmentSchedule`, a due date, the
currency, booking/sale/client references and audit metadata.

The ledger opens **empty**, deliberately: what was collected today reduced the charge *before* the
debt was struck, so nothing has moved *against* the debt yet. Every later payment appends.

| Arrangement | Who owes | Salon receivable? |
|---|---|---|
| **Kart Taksiti** (`CARD_INSTALMENT`) | the customer owes their **BANK** | **No.** The salon is paid today; provider, count, commission bp, fixed fee and expected settlement are snapshotted on the allocation. |
| **Salon Taksit Planı** (`outstandingKind: SCHEDULED`) | the customer owes the **SALON** | **Yes** — with a real instalment schedule summing exactly to the debt. |
| Partial / unpaid (`OPEN`) | the customer owes the **SALON** | Yes, ad-hoc, no schedule. |
| Package plan debt | TR-B's ledger | Never restruck here (§4). |

---

## 8. Loyalty and client statistics

**Canonical, reused rather than reinvented.** `computeEarnBase_p` and `expectedPointsFor` are
hand-mirrored twins of `src/utils/receiptMath.ts`, **byte-proven** by a test that reads both files
and compares the extracted function bodies character for character. `functions/` is a separate CJS
build with `noResolve` and cannot import the frontend ESM module; copying a money rule across that
boundary *without* the proof is how a product grows two loyalty policies.

```
eligibleCeiling = max(0, (service − packagePrepaid) + addOns + products − discount − redeemed)
earnBase        = min(eligibleCeiling, collected − min(tip + serviceCharge, collected))
points          = floor(earnBase ÷ 100) × earnRate × multiplier
```

The ceiling is the canonical rule, unchanged. The award is that ceiling **capped by what was actually
collected** — so a full payment hits the ceiling exactly (byte-identical to today's award, which is
what every existing test pins), a partial earns on what was taken, and a fully unpaid checkout earns
nothing. `collected` includes a prior deposit, so a platform booking still earns on the whole
service.

### Visit semantics — the distinction that matters

| Transaction | Loyalty | Visit | Client stats |
|---|---|---|---|
| **Booking** checkout | earns | **+1 visit** | totalSpent / totalDiscount / lastVisit / lastBarber / lastService |
| Products **alongside** a service | earns, via the earn base | (the booking's visit) | as above |
| **Product-only** sale | **none** | **none** | **untouched** |

The product-only row is not a new policy — it is exactly what `createProductSale` has always done:
write the sale row and stop. A tub of pomade is not a completed treatment.

The award is gated **at source**, not merely omitted from the client write. An earlier draft computed
and *stored* 100 points on a product-only sale document while granting nothing; the emulator suite
caught it. A document that records an award nobody received is a lie every later reader compounds.

### Email is never sent inside the transaction

A transaction callback can be RETRIED. The executor writes one deterministic marker,
`receiptEmailIntentKey: checkout:{intentKey}`, and deliberately does **not** flip `sendLoyaltyEmail`:
the existing trigger renders a `£`-formatted receipt, and nothing calls the executor yet. Wiring the
marker to an actual send is the Phase 3 cutover, together with the reader.

---

## 9. Receipt and currency honesty

Two snapshots, on purpose.

- **`checkoutReceipt`** — always written. Versioned, integer minor units, **explicit currency**.
  Distinguishes gross service value, package-prepaid, discount, redemption, tip, service charge, paid
  today, paid earlier, the tender allocations with their instalment metadata, outstanding, and the
  product line snapshots.
- **`receipt*_p`** (the legacy pence contract read by the loyalty email, Sales, Finance and Reports)
  — written **only when the resolved currency is GBP**.

Putting kuruş in a field named `_p` beside `receiptCurrency: 'GBP'` would be precisely the silent
misstatement the P1-RECEIPT-MATH work exists to prevent. So a TRY checkout gets the currency-explicit
snapshot and nothing else, and pointing those readers at it is the Phase 3 cutover.

When the GBP snapshot *is* written it follows the writer's contract exactly: a breakdown that does
not reconcile is still stored, flagged `receiptReconciled: false` with its invariant codes. A partial
or unpaid checkout cannot make the customer-facing column add up, and saying so plainly is the point.

This is **not** an e-Fatura / e-Arşiv and not a fiscal receipt. It is the salon's own record.

---

## 10. Guards

Refused, each with a stable PII-free reason: unauthenticated · wrong tenant · unrecognised role ·
role not permitted · `BLOCKED` record (the phantom-sale path, re-closed server-side) · cancelled ·
no-show · already checked out · missing or archived service · missing / inactive / out-of-stock /
malformed-price product · cross-tenant client or package · another client's package · exhausted
entitlement · stale settings version · malformed money · unsupported method, provider or instalment
count · discount above the discountable subtotal · checkout not enabled for the tenant.

**Fail closed.** An absent `checkoutSettings` resolves to `enabled: false`, so every tenant that has
not deliberately opted in gets `CHECKOUT_DISABLED`. That is what makes deploying this callable safe
while the UI still uses the old path.

---

## 11. Rules boundary — nothing changed, and that is the point

**No `firestore.rules` change was made and none is needed.** The executor's new collections —
`checkoutIntents`, `receivables`, `receivableLedger` — are not in the `[G4]` explicit write list, so
the catch-all `allow write: if false` already denies every client write to them.

Nine rules cases now **pin** that (`docs/test-firestore-rules.py`, 145 → 154), because the guarantee
is currently a property of a list nobody edited rather than of a rule anybody wrote. The day somebody
adds one of these names to the `[G4]` list "so the panel can read it", those cases fail — instead of
a salon discovering that staff can forge a receivable.

Read stays same-tenant ALLOW, deliberately and explicitly asserted: the till has to show a client
their outstanding balance. Tightening it belongs **with** the Admin/Staff UI cutover, never before —
the current UI still writes bookings directly.

---

## 12. What Phase 2B deliberately did not do

- No UI change. Admin `CheckoutPanel`, Staff `CheckoutSheet` / `WalkInFlow`, Payment Settings,
  Reports and Finance are untouched and nothing calls the callable.
- No rules change, no migration, no backfill.
- No `inventorySaleTx` extraction, no stock decrement (§5).
- No re-checkout / later-collection verb. `staffMayRecordLaterPayment` is a named capability with no
  executor yet; the loyalty rule it must honour (earn on the newly collected eligible amount, once)
  is recorded here, and the executor stores `loyaltyEarnBase_m` and `loyaltyPointsEarned` on the
  document precisely so that unit can compute the remainder without re-deriving anything.
- No package output changed. TR-B's `snapshot` / `financialCache` / `plan` are byte-identical.

---

## 13. Files

| Path | What |
|---|---|
| `functions/src/checkout/executor.ts` | the executor |
| `functions/src/checkout/checkoutTender.ts` | Phase 1 settings resolver + pure tender engine (parity twin) |
| `functions/src/index.ts` | `salownCheckoutBooking` onCall shell |
| `functions/src/checkout/executor.test.js` | 32 pure tests incl. the byte-proofs and the static ordering guard |
| `functions/src/checkout/executor.emulator.test.js` | 42 real-Firestore tests |
| `docs/test-firestore-rules.py` | 9 cases pinning the client-write denial |
