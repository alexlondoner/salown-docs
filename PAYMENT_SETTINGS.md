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
providers[]     { id, name, enabled, archived, supportedInstalmentCounts[], commissionMode,
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

**Live opt-in status (2026-08-02).** The default is still doing its job everywhere that matters:
`whitecross`, `herohairs` and `tr-demo` have `checkoutSettings` **ABSENT**. The single tenant with a
stored configuration is **`demo`** — `enabled: true`, `mode: tr`, `schemaVersion: 2` — the persistent
Turkish sales demo, set deliberately so it stops resolving UK checkout while presenting as Turkish.
Roles and the full per-tenant table: [TENANTS.md](TENANTS.md#demo--verification-tenants).

Enabling a tenant here still reaches no user: nothing in `src/` calls `salownCheckoutBooking`, so
`enabled: true` currently only changes what the resolver returns, not what a till does.

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

> ✅ **CLOSED by Phase 3** (2026-08-02, ruleset `b30abf64-5515-4429-87f8-fafaa085af2c`). The list is
> now `['presentation', 'packageSettings', 'checkoutSettings']` — one added key, no new match block,
> and the **read** rule untouched, so same-tenant members still read the private Settings document
> they already needed.
>
> Phase 1 left it open deliberately and recorded it as a follow-on rather than an oversight: while the
> feature was dark and nothing wrote the field, `checkoutSettings` inherited the general `isTenantAny`
> write, so an **admin** — not only an owner — could have written it. That was acceptable exactly
> until a UI exposed the switches, which Phase 3 does. They decide who may create salon debt and above
> what amount approval is required, so a stylist who could edit them could raise their own unpaid
> limit.
>
> Proven by 16 new cases in `docs/test-firestore-rules.py` (suite 154 → 170), including the
> self-escalation attempt itself, and by live verification against the deployed ruleset.

---

## 7. Settings versioning — two numbers, and why

The client sends the version it rendered against; the executor refuses a mismatch with
`STALE_SETTINGS_VERSION` **before anything is priced**. That is what stops a till that has been open
since this morning from committing a checkout under rules the owner changed at lunchtime.

Phase 3 made that gate real, and doing so split the number in two:

| Stored field | Meaning | Who writes it |
|---|---|---|
| `schemaVersion` | The **monotonic settings version**. Starts at 1 and goes up by exactly one on every successful owner save. | `salownSaveCheckoutSettings` only |
| `contractVersion` | The **contract** version — bumped only when the MEANING of a stored field changes. `CHECKOUT_CONTRACT_VERSION`, currently 1. | `salownSaveCheckoutSettings` only |

**Why `schemaVersion` carries the revision.** The Phase 2B executor is deployed and compares
`req.settingsVersion !== settings.schemaVersion`. That comparison *is* the staleness gate. A separate
`revision` field would have been tidier taxonomy and would have been enforced by **nothing**, because
the deployed executor does not read it — and reworking the executor was out of scope. So the
incrementing number went where the gate already looks, and the meaning-version moved to
`contractVersion`, where a future contract change can still be expressed. Net effect: a till opened
before a change cannot commit under it, with zero change to deployed code.

**The ceiling is real.** `schemaVersion` is clamped to 1–9999 by the lenient reader, so past 9999 a
stored value would fall back to 1 and every open till would look current again. The writer refuses at
that point (`SETTINGS_VERSION_EXHAUSTED`) rather than wrapping silently. At ~27 owner saves a day that
is a year of headroom; it is refused rather than ignored because the failure would otherwise be
invisible.

**Two guards, one number.** The same value is also optimistic concurrency on the WRITE path: the form
submits `expectedVersion`, and a save made against a version another owner has already superseded is
refused with `SETTINGS_VERSION_CONFLICT` and changes nothing.

**Server-owned fields.** `schemaVersion`, `contractVersion`, `updatedAt` and `updatedBy` are refused
on input. A browser that could set its own settings version could defeat the staleness gate by simply
claiming to be current.

---

## 7b. The write path (Phase 3)

The read path is lenient; the write path is **strict**, and the two are not redundant. The reader's
forgiveness is a **safety net, not a storage format**: writing a value the reader would have to repair
is how a salon ends up with settings that silently mean something other than what the owner selected.

`validateCheckoutSettingsInput` (`checkoutSettingsWrite.ts`, a byte-identical frontend/Functions parity
twin, separate from the Phase 1 core so the deployed executor's twin stays untouched) refuses:

- any unknown key, top-level or nested — never stored, never ignored;
- a wrong type, including a string where a boolean belongs — never coerced;
- a float where minor units or basis points belong — never rounded, because a rate that arrives as
  `2.9` and is stored as `3` under-reports every settlement taken under it;
- a duplicate provider id, or an id outside `^[a-z0-9][a-z0-9_-]{1,39}$`;
- an instalment count outside 2–36 (the reader tolerates `1` because it must tolerate what is already
  stored; the writer does not create it);
- a commission rate for a count the provider does not support;
- an archived provider that is also enabled;
- salon instalments switched ON with no permitted count;
- an empty split-method list;
- any server-owned field.

**Explicit `false` and `0` survive; `null` stays distinct from `0`** (it is the stored way to say "no
limit"). Own-property checks throughout — never truthiness.

**One writer, by design.** `salownSaveCheckoutSettings` re-validates, decides the role from the
**stored** staff doc rather than the token, merges at the top level only, increments the version and
writes the audit metadata — all in one transaction. The browser runs the same validator so an invalid
form is refused before the round-trip, but it is not the authority. The rule is the boundary that holds
when no callable runs.

**Archive, never delete.** A provider id is snapshotted into `BankInstalmentMeta` on every instalment
payment, so destroying the row would leave settled money pointing at nothing. Archiving always sets
`enabled: false` alongside, and the deployed executor already refuses a disabled provider with
`PROVIDER_DISABLED` — so the archive flag needs no new gate on the checkout path and the Phase 1
resolver deliberately does not project it.

**The TR template is offered, never written.** A conservative Turkey starting point can be loaded into
the form — cash, single card payment and split payment on; bank transfer, card instalments and every
debt-producing capability off — but the owner must save it deliberately. No tenant is backfilled.

---

## 8. Related

- [TENANTS.md](TENANTS.md#demo--verification-tenants) — which tenant has which configuration, and why `demo` ≠ `tr-demo`
- [TR_CHECKOUT_ARCHITECTURE.md](TR_CHECKOUT_ARCHITECTURE.md) — how a checkout is decided and committed
- [PAYMENT_PLAN_ENGINE.md](PAYMENT_PLAN_ENGINE.md) — the receivable/instalment arithmetic
- [TREATMENT_PACKAGE_SYSTEM.md](TREATMENT_PACKAGE_SYSTEM.md) — TR-B package semantics
- [STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md) — PAY-1's online payment pipe
- [SECURITY.md](SECURITY.md) — rules architecture
