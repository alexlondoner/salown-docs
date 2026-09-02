# BOOKSY_HAPPY_HOURS_PLAN.md — a platform discount that arrives invisible

> **Role:** how salOWN records a discount that Booksy applied and did not tell us about.
> **Status:** 🔵 Planned → implementation in progress, **not deployed**.
> **Related:** [IN_SALON_DEPOSIT_PLAN.md](IN_SALON_DEPOSIT_PLAN.md) · [NORMALIZATION.md](NORMALIZATION.md)
> (parser matching discipline) · [PAYMENT_SETTINGS.md](PAYMENT_SETTINGS.md)

---

## 1. What happened

On 2026-09-02 a Booksy booking imported at **£22.40** for a service the catalogue prices at
**£28**. The owner reported it as a broken breakdown. It was not: Booksy had applied a **Happy
Hours** discount and the salOWN import recorded exactly what the email said.

The Booksy app shows the sale in full:

```
Deposit     £10.00
Discount    −£5.60
Total       £22.40
To be paid  £12.40
```

The **email** shows only this:

```
Standard Packages: Classic Short Back and Side
£22.40, 09:30 - 09:50
with Alex
```

**The discount line does not exist in the email.** There is no Booksy API. So the discount is
undetectable from the message itself — the only signal available to us is that the imported price
is lower than the catalogue price.

## 2. Why it started now

The owner's Happy Hours schedule at the time of writing:

| Day | Discount | Window |
|---|---|---|
| Monday | 15% | 10:00–12:00 |
| Tuesday | 15% | 10:00–12:00 |
| Wednesday | **20%** | 09:00–12:00 |
| Thursday | 15% | 09:00–12:00 |
| Fri / Sat / Sun | — | inactive |

Matthew Farrell's booking was Wednesday 09:30 — inside the 20% window, and £28 × 0.80 = £22.40
exactly.

Every Booksy booking in the tenant's history was tested against this schedule. **Two earlier
bookings fell inside a window and imported at FULL price** — 2026-06-24 Wed 09:00 (£28) and
2026-08-13 Thu 09:45 (£48). So the schedule was widened recently, which matches the owner's account:
the discount was meant for grooming packages and was applied to everything.

**Consequence for the design, and it is not optional:** the schedule is mutable and Booksy keeps no
history of it. Applying today's schedule to an older booking mis-explains it — this document's own
analysis did exactly that before the reason was understood. **The explanation must be computed and
frozen at import time**, never recomputed later. This is the same rule
`loyaltyPromotionSnapshot` already follows for campaigns.

## 3. What is wrong today, precisely

* The discount is **invisible**. `price: 22.40` is stored and nothing records that £5.60 was given
  away. The salon cannot answer "what did Happy Hours cost me this month?" — a P/L question with no
  answer in the product.
* An imported price that is wrong for any OTHER reason looks identical to a legitimate discount, and
  surfaces at the till or not at all.

## 4. Design

Booksy's own model is `base price + separate discount`. salOWN already has both fields — `price`
and `discount`, and Finance already sums `discount` as "discount given". So the fix is to align our
fields with the model rather than invent a new one.

### 4.1 Configuration — an owner-maintained MIRROR

`tenants/{id}/settings/settings` → `platforms.booksy.happyHours`:

```js
{
  enabled: true,
  schedule: {
    monday:    { pct: 15, from: '10:00', to: '12:00' },
    wednesday: { pct: 20, from: '09:00', to: '12:00' },
    // a day that is absent is not running
  }
}
```

Booksy has no API, so this is a mirror the owner keeps in step by hand. That is a real weakness and
is handled by making a mismatch a FLAG, never a block (§4.3).

### 4.2 Import — explain, or say you cannot

At import, when the email price is **below** the resolved catalogue price:

* compute the expected discount from the schedule for that booking's tenant-local day and start time;
* **explained** (expected price matches the email price): store
  `price` = catalogue, `discount` = delta, `discountReason = 'BOOKSY_HAPPY_HOUR'`, and a frozen
  `discountSnapshot` naming the rule that was applied;
* **unexplained**: store exactly what today's code stores (`price` = the email price, no discount) and
  set `discountSnapshot.matched = false` so the panel can say so.

Nothing changes when `happyHours` is absent or disabled: the import behaves byte-for-byte as it does
today. A tenant that never configures this never notices the feature exists.

### 4.3 The till and the panel — the half that must not be forgotten

`CheckoutPanel` seeds its discount from **nothing**: `discountValue` starts `''` and
`discountApplied` starts `0`, and no code path reads `booking.discount`. If the import wrote a
discount and the till did not show it, every Happy Hours customer would be **overcharged by the
discount amount**. So:

* the till pre-fills the discount from `booking.discount`, labelled with its origin, and the operator
  can still change it;
* `BookingDetailPanel`'s "Remaining at venue" — today literally `servicePrice − platformDepAmt`
  (`:1738`) — subtracts the discount, and a discount row is shown. This is why the panel currently
  says £18 while Booksy says £12.40.

**These two halves ship together.** The import half alone overcharges customers.

## 5. What it buys

* Finance can answer what Happy Hours costs, per month, per service.
* A price that no rule explains is flagged at import — visible before the client is at the desk,
  instead of discovered at the till or never.
* The same shape extends to Fresha and Treatwell later; nothing here is Booksy-specific except the
  schedule's location.

## 6. Out of scope

* Changing what the client pays. The discount is Booksy's and already promised to them.
* Blocking an unexplained price. Legitimate discounts exist that we cannot model; a flag informs, a
  block would stop a salon serving a customer.
* Any change to the deposit rails — see IN_SALON_DEPOSIT_PLAN.md.
