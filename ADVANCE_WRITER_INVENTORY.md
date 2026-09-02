# ADVANCE_WRITER_INVENTORY.md — who can move a booking's commercial total, and what each must do

> **Role:** the two investigations the owner required BEFORE a collection callable is written, so the
> callable is not redesigned four times once the other price writers are met.
> **Status:** 🔵 Investigation complete. No code written for either outcome yet.
> **Related:** [IN_SALON_DEPOSIT_PLAN.md](IN_SALON_DEPOSIT_PLAN.md)

---

## 1. Owner's classification (2026-09-02) — not one guard for all writers

* **Interactive** (owner/operator, decides in the same flow) → **REJECT** the save; show the excess;
  a refund disposition must come first.
* **External** (Booksy/Fresha/Treatwell bring outside reality) → **ACCEPT** the price, because
  refusing it leaves the booking lying about the world — but raise an explicit `OVERFUNDED` state
  that fail-closed locks new collections and checkout, and surface it to the owner as an exception.
  *An explicit overfunded state is acceptable; silent overfunding is not.*
* **Checkout** → increases free; a reduction below prepaid means the checkout cannot complete, and no
  receipt, loyalty or commission may be written until the disposition is resolved.
* **Reschedule / service replacement** → the ledger travels with the booking identity; the new total
  is re-assessed and the same exception path applies.

## 2. The inventory

| # | Writer | Class | Price authority | Rejectable? | Overfunded behaviour | Transaction boundary |
|---|---|---|---|---|---|---|
| 1 | `firestoreActions.patchBooking` (`:1060`) — **the interactive chokepoint**. `BookingDetailPanel.performSave` folds service swap + add-ons into `patch.price` (`:1053`, `:1099`) and calls it | Interactive | operator, from the service catalogue | **YES** | Reject the save, name the exact excess | single `updateDoc`, **not** a transaction |
| 2 | `firestoreActions.checkoutBooking` (`:268`) — writes `soldProducts`, `soldAddOns`, `serviceCharge`, `discount`, all of which move the gross | Checkout (browser, UK tenants) | operator at the till | **YES**, before the write | Refuse completion until disposition | sequential `updateDoc`s, **not** atomic |
| 3 | `firestoreActions.saveUnpaidBooking` (`:793`) — same total-bearing fields, no money taken | Checkout-adjacent | operator | **YES** | Same as #2 | single `updateDoc` |
| 4 | `salownCheckoutBooking` executor | Checkout (TR tenants) | `computeCheckoutTotals` | **YES** | Refuse completion until disposition | one `db.runTransaction` |
| 5 | `parsers/booksy.ts:462` — a reschedule email carrying `newPrice` (`:210`). **Live today** | External | Booksy | **NO** | Record the price, set `OVERFUNDED`, lock collection + checkout | `db.runTransaction` (O1P) |
| 6 | `parsers/treatwell.ts` / `fresha.ts` / `ical.ts` — import + reschedule-apply phases | External | the platform | **NO** | Same as #5 | `db.runTransaction` |
| 7 | `createBooking` / `createWalkIn` / `productSaleCore` / first import | Creation | catalogue or operator | n/a | **Out of scope** — no advance can exist before the booking does | transactional |

**The most useful finding is #1:** every interactive edit funnels through ONE function, which already
carries `assertNotBlock`. The interactive guard is one chokepoint, not four screens. #2 and #3 are
separate entry points in the same file and need their own call.

**The most urgent is #5:** Booksy already ships a price change on a reschedule, in production, today.
It is the first writer that will meet an advance from the outside.

**Two facts that constrain the design:** the interactive and browser-checkout writers are **not
transactional** (#1, #2, #3), so "assess then write" is not atomic there — the guard must re-read and
re-assess inside the same write path, and any atomic disposition must live on the server. And the
external writers ARE transactional, so raising `OVERFUNDED` alongside the price is atomic and safe.

## 3. Pricing fingerprint — no canonical identity exists, proven from source

Two existing digests were examined and **both must be refused**, each on its own contract:

**`checkoutFingerprint` (`checkout/executor.ts:647`) — wrong by design.** Its own documentation says
it *"deliberately EXCLUDES the clock and every resolved price, so a retry sent after a catalogue edit
still replays the original result"*. An advance snapshot needs the exact opposite: a fingerprint that
CHANGES when the price changes. It also hashes `allocations` — tenders that do not exist when an
advance is taken. It is a REQUEST identity for idempotency, not a state identity for pricing.

**`receiptFingerprint` (`receipts/index.ts:348`) — post-checkout only.** It reads
`receiptTransactionTotal_p` / `receiptSubtotal_p`, canonical receipt fields written at checkout, and
falls back to `paidAmount + platformDepositAmount` — money collected, not the priced state. Before a
checkout it has nothing to read. This is exactly the case the owner ruled out.

**Conclusion: build it, but not in the advance core.** The fingerprint belongs beside
`computeCheckoutTotals` (`checkout/checkoutTender.ts:354`), derived from the same normalised inputs
that function actually consumes, so the total and its identity can never disagree:

currency · canonical service/base amount and its id · variation · normalised add-on and product lines
(stable id, quantity, unit amount, sorted by id) · discount · package/prepaid effect · service charge.

Excluded: UI labels, display formatting, and anything that does not change the arithmetic.

## 4. The collection callable, once the above exists

1. Re-read the booking inside the transaction.
2. Build the canonical pricing input.
3. `computeCheckoutTotals` → `commercialTotal_m`.
4. Build the fingerprint from that same input.
5. Compare against the fingerprint/`updateTime` the UI saw; a mismatch is a conflict, not a retry.
6. Only then: ledger entry + compatibility projection + audit, in one commit.
