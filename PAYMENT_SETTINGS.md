# PAYMENT_SETTINGS.md — the three payment settings contracts

> **Role:** the single record of **which settings contract owns which decision**. Three payment-ish
> contracts now exist. They are **not** interchangeable and must never be merged.
>
> The same table lives in the root `CLAUDE.md` as a working reminder; this file is the long form —
> what each field decides, where it is stored, who may write it, and what happens when it is absent.

---

## 1. The three contracts

| Contract | Location | Public? | Owns |
|---|---|---|---|
| **PAY-1** `paymentSettings` | `tenants/{tid}` **root** | **PUBLIC** | ONLINE booking payment: pay-at-venue vs salOWN Connect, deposit/full/optional, expiry |
| **TR-B** `packageSettings` | `settings/settings` | private, owner-only | package sale, ledger, plan, outstanding, refunds, entitlement, **package payment permission** |
| **TR-D1** `checkoutSettings` | `settings/settings` | private, owner-only | IN-SALON tender methods, split, partial, unpaid, salon instalments, POS providers, general checkout permissions, receivables policy |

**Where both apply, both gates apply.** A staff member recording a PACKAGE payment by card needs
`packageSettings.staffMayRecordPayments` **and** the checkout card permission. There is deliberately
**no second `staffMayRecordPayments`** in `checkoutSettings`.

**Never read PAY-1 as `checkoutSettings`.** They answer different questions and share no field. PAY-1
decides what a stranger on the internet is asked to pay before they arrive; `checkoutSettings`
decides what the desk may do once they are in the chair.

**Nothing selects checkout mode from IP.** `countryCode` / tenant configuration decides. A TR tenant
opened from London stays TR.

---

## 2. Why `checkoutSettings` is private

It is **never** on the world-readable tenant root. Commission rates, settlement terms, approval
thresholds and staff permissions are commercial facts about the salon. No unauthenticated surface
needs in-salon tender configuration, so no public mirror exists.

See [feedback: tenant root doc is public] — `tenants/{id}` is world-readable, so a secret placed
there is published. `checkoutSettings` lives in `settings/settings`, which is auth-gated.

---

## 3. `checkoutSettings` — the shape

Defined in `packages/shared/src/checkout.ts`, resolved by `resolveCheckoutSettings` in the
`checkoutTender` parity twin. Every field optional; absence means the documented default.

```
schemaVersion   CHECKOUT_SETTINGS_VERSION (currently 1)
enabled         false by default — see §4
mode            'uk' | 'tr'
methods
  cash              { enabled }
  card              { enabled, singlePaymentEnabled, bankInstalmentsEnabled }
  bankTransfer      { enabled, requireReference }
  splitTender       { enabled, allowedMethods[], maxAllocations }        ≥ 2
  partial           { enabled, minimumPaidPercent?, requireDueDate, requireNote }
  unpaid            { enabled, requireDueDate, requireNote, staffLimit_m?, ownerApprovalAbove_m? }
  salonInstalments  { enabled, allowedCounts[], maximumTermDays?, requireDeposit, minimumDepositPercent? }
providers[]     { id, name, enabled, supportedInstalmentCounts[], commissionMode,
                  commissionRatesByCount (BASIS POINTS, integer), fixedFee_m, effectiveFrom/To }
permissions     staffMayTakeCash | TakeCard | TakeBankTransfer | UseSplitTender |
                CreatePartialBalance | MarkUnpaid | CreateSalonInstalments |
                RecordLaterPayment | ReversePayment | ownerApprovalAbove_m
receivables     { defaultDueDays, overdueGraceDays, allowNoDueDate, reminderPolicy }
```

**Money is integer minor units, suffixed `_m`.** Commission is **basis points**, integer — a
percentage float never takes part in money math.

### The read path is LENIENT, the write path is STRICT

`resolveCheckoutSettings` never throws and always returns a usable configuration. The same asymmetry
TR-A `presentation` and TR-B `packageSettings` use, for the same reason: these values decide how a
till *behaves*, and one bad stored integer must not take checkout away from a whole salon. A rejected
value lands in `issues[]` so it is diagnosable rather than invisible.

One deliberate consequence: a `splitTender.allowedMethods` list of pure nonsense falls back to the
default rather than resolving to empty — a salon whose list was all typos must still be able to
split, not be locked out of the till by one bad save.

---

## 4. `enabled: false` is the load-bearing default

**The most conservative salon that still works.** A tenant that never asked for TR checkout resolves
to today's UK behaviour with the whole feature dark, and every debt-producing capability — partial,
unpaid, salon instalments — defaults **OFF** and must be switched on out loud.

This is what makes the Phase 2B deploy safe: `salownCheckoutBooking` is live in production, and every
tenant lacking `checkoutSettings` gets `CHECKOUT_DISABLED`. Absent settings preserve current UK
defaults, and the existing UK UI stays on its old browser path regardless.

---

## 5. Three-level capability resolution

```
allowed = platformSupported && tenantEnabled && roleAllowed
```

`effectiveCapability()` returns a **struct**, not a boolean, so a screen can say *which* level
refused. "Your salon has this switched off" and "you are not allowed to do this" are different
sentences, and collapsing them produces a support ticket.

Owner / admin / super-admin bypass the per-staff permission but **not** the tenant switch: an owner
cannot take a bank transfer at a salon that has bank transfer disabled.

The server re-runs the same gate inside its transaction against freshly read settings, so a policy
change or a role revocation mid-checkout aborts the commit rather than letting a write land on stale
authorization. The browser runs it too, only to grey controls out — one rule, two callers, no drift.

---

## 6. Who may write it

Owner or super-admin only, enforced in `firestore.rules` beside `presentation` and `packageSettings`
— one key in an existing `hasAny()` list, no new match block:

```
match /settings/{document=**} {
  allow update: if isSuperAdmin() || (isTenantAny(tenantId)
    && (!request.resource.data.diff(resource.data).affectedKeys()
          .hasAny(['presentation','packageSettings']) || isOwner(tenantId)));
}
```

> ⚠️ **`checkoutSettings` is NOT yet in that `hasAny()` list.** Today it inherits the general
> `isTenantAny` write on `settings/settings`, so an admin — not only an owner — can write it. That is
> acceptable *while the feature is dark and no UI writes it*, and it must be closed **with** the
> Settings-UI package that first exposes these switches: they decide who may create salon debt and at
> what threshold approval is required, and a stylist who could edit them could raise their own unpaid
> limit. Tracked as an explicit follow-on, not an oversight.

---

## 7. Settings versioning

`CHECKOUT_SETTINGS_VERSION` is bumped when the **meaning** of a stored field changes. The client
sends the version it rendered against; the executor refuses a mismatch with
`STALE_SETTINGS_VERSION` **before anything is priced**.

That is what stops a till that has been open since this morning from committing a checkout under
rules the owner changed at lunchtime.

---

## 8. Related

- [TR_CHECKOUT_ARCHITECTURE.md](TR_CHECKOUT_ARCHITECTURE.md) — how a checkout is decided and committed
- [PAYMENT_PLAN_ENGINE.md](PAYMENT_PLAN_ENGINE.md) — the receivable/instalment arithmetic
- [TREATMENT_PACKAGE_SYSTEM.md](TREATMENT_PACKAGE_SYSTEM.md) — TR-B package semantics
- [STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md) — PAY-1's online payment pipe
- [SECURITY.md](SECURITY.md) — rules architecture
