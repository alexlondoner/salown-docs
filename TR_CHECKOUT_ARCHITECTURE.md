# TR_CHECKOUT_ARCHITECTURE.md — the server-authoritative in-salon checkout

> **Role:** the record of **how a checkout is decided and committed** — the executor, its one
> transaction, its idempotency contract, and the boundaries it deliberately does not cross.
>
> **Not** the settings contract (that is [PAYMENT_SETTINGS.md](PAYMENT_SETTINGS.md)), not the
> receivable arithmetic (that is [PAYMENT_PLAN_ENGINE.md](PAYMENT_PLAN_ENGINE.md)), and not package
> semantics (that is [TREATMENT_PACKAGE_SYSTEM.md](TREATMENT_PACKAGE_SYSTEM.md)).

**Status: Phase 3 DEPLOYED 2026-08-02 · the executor is now CONFIGURABLE but still UNREACHABLE.**
`salownCheckoutBooking` is live in `europe-west2` at `salowncheckoutbooking-00001-taf` — the revision
Phase 2B created, unchanged by Phase 3 — and **nothing calls it.** The Admin panel and the Staff App
keep their existing browser checkout path.

What Phase 3 added is the owner's control panel for it: `salownSaveCheckoutSettings`
(`salownsavecheckoutsettings-00001-pic`) plus a Settings screen, so a tenant can now switch this
checkout on and configure it. A tenant that does not resolves to `enabled: false` and the executor
still refuses with `CHECKOUT_DISABLED`. **The UI cutover is a later package.** See
[PAYMENT_SETTINGS.md](PAYMENT_SETTINGS.md) for the settings contract and
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

**Who has opted in, live (2026-08-02).** Exactly one tenant, and it is a demo:

| Tenant | Country | `checkoutSettings` | Resolves to |
|---|---|---|---|
| `demo` | TR | **PRESENT** — `enabled: true`, `mode: tr`, `schemaVersion: 3` | checkout **enabled**, TR mode |
| `tr-demo` | TR | PRESENT — `enabled: true`, `mode: uk` | legacy — `MODE_UK` |
| `whitecross` | GB | ABSENT | legacy — `NON_TR_TENANT`, and `CHECKOUT_DISABLED` if ever called |
| `herohairs` | GB | ABSENT | legacy — `NON_TR_TENANT` |

**Updated 2026-08-03: `demo` is no longer a dark opt-in.** The Admin panel was cut over, so `demo`
now genuinely checks out through this executor. Two independent gates keep everyone else off it: the
client route is **country-gated** (a non-TR tenant can never call it, whatever it stores), and the
executor's own `enabled` check refuses a tenant with no configuration.

> ⚠️ **Residual, reported not fixed:** the executor gates on `checkoutSettings.enabled`, **not** on
> the tenant's country. A non-TR tenant with an enabled TR configuration would be accepted *if
> something called it*. Nothing does — the only caller is country-gated, and both real UK tenants
> have `checkoutSettings` absent so they fail `CHECKOUT_DISABLED` anyway. Closing it means changing
> and redeploying a Function, which was deliberately out of scope for the Admin cutover. Roles and per-tenant configuration: [TENANTS.md](TENANTS.md#demo--verification-tenants). Do not
read `tr-demo`'s absent settings as a decision — it is the restored verification baseline.

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

## 11b. What Phase 3 changed about this executor: nothing

Worth stating plainly, because "Phase 3" and "checkout" in the same sentence invite the assumption
that the executor moved. It did not:

- `functions/src/checkout/executor.ts` — **unedited**.
- `checkoutTender.ts`, the Phase 1 parity core it imports — **unedited**, byte-for-byte as deployed.
  The Phase 3 strict validator lives in a **separate** twin (`checkoutSettingsWrite.ts`) precisely so
  this one did not have to be touched and the deployed revision stays honest about its source.
- `salowncheckoutbooking-00001-taf` — **not redeployed**.

The one thing that *did* become real is the staleness gate. The executor has always compared
`req.settingsVersion !== settings.schemaVersion`; until Phase 3 nothing incremented that number, so
the comparison could never fire. Now every owner save increments it, which is why the incrementing
value went into `schemaVersion` rather than a tidier new `revision` field the deployed executor would
never have read. Proven live: against `tr-demo` with a superseded version the deployed executor
answered `TENDER_REFUSED / STALE_SETTINGS_VERSION`, and with the current one it moved past the gate to
`BOOKING_NOT_FOUND`.

`archived` on a provider is likewise invisible here. It is a presentation concern; archiving always
sets `enabled: false` alongside, and the executor's existing `PROVIDER_DISABLED` refusal already
covers it, so the Phase 1 resolver does not project the field at all.

---

## 12. What Phase 2B deliberately did not do

- No UI change. Admin `CheckoutPanel`, Staff `CheckoutSheet` / `WalkInFlow`, Payment Settings,
  Reports and Finance are untouched and nothing calls the callable.

> **Still true at `4476fc9` (2026-08-02) — `salownCheckoutBooking` is deployed and
> user-unreachable.** `grep -rn salownCheckoutBooking src/` returns **no call site**. Admin
> `CheckoutPanel.tsx:948` and Staff `CheckoutSheet.tsx:79` both still call the legacy client-side
> `checkoutBooking` from `firestoreActions`. The executor cutover is **not** done, and it is one half
> of the next implementation package — the other half being the P0 package→service auto-link, without
> which a user cannot reach a checkout with a package on it at all
> ([TREATMENT_PACKAGE_SYSTEM.md §15.1](TREATMENT_PACKAGE_SYSTEM.md#151-p0--package-selection-does-not-reach-the-cart)).
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
