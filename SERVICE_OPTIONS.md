# SERVICE_OPTIONS.md — OPT-1: tenant-configurable service options & authoritative add-ons

**Status:** code + tests landed (salown-app `b6b622e`, 2026-07-27, `[skip ci]`, **not deployed**).
Production option configuration is **pending** (no prod config/data write in this package).
**Contract parent:** [BOOKING_SECURITY_POLICY_MIGRATION.md](BOOKING_SECURITY_POLICY_MIGRATION.md) (C1 authoritative create) · **companion:** PAY-1 payment adapter.

---

## 1. The problem it solves

Add-ons ("Extras") used to be a single global notion: an extra was either charged or
not, the same way everywhere. Reality is per-relationship. The **same** option — e.g.
*Wash & Hot Towel* — must be able to be:

- **INCLUDED** for one tenant/service (complimentary, part of the service),
- **OPTIONAL_PAID** elsewhere (a real chargeable add-on),
- **OPTIONAL_FREE** elsewhere (selectable, £0, but occupies chair time),
- **UNAVAILABLE** elsewhere (not offered).

This is exactly the live incident behind the ADDON-PRICE regressions (INCIDENTS
2026-07-22 / 2026-07-26): a *Wash & Hot Towel* that was **already included** in a Skin
Fade got booked as a £10 paid extra, and the folded-price editor could not correct it
cleanly. OPT-1 makes "included vs charged" a first-class, tenant-configurable, **server-
authoritative** distinction.

---

## 2. Relationship-based model (additive, not a new catalogue)

The **option catalogue is the existing option/service records** — the Extras-category
services already carry a stable id + name + price + duration. OPT-1 does **not** duplicate
them. It adds a thin **per-option RULE** at three layers, keyed by the stable optionId:

| Layer | Where it lives (existing docs — no new collection) |
|---|---|
| **service override** | `tenants/{t}/services/{svc}.optionConfig[optionId]` |
| **category default** | `tenants/{t}/settings/settings.optionConfig.categories[categoryName][optionId]` |
| **tenant default** | `tenants/{t}/settings/settings.optionConfig.tenant[optionId]` |
| **catalogue default** | intrinsic to the option's own service doc (price/duration; optional `optionDefaultMode`) |

A **rule** = `{ mode?, price?, duration? }`. All layers are read by C1 **inside the booking
transaction** (settings + service docs it already reads, plus a bounded second read of the
selected/configured option docs) — so the decision is read-consistent with the price/slot
the booking is stamped with. No new collection, no location layer, no backfill.

Types: `packages/shared/src/serviceOption.ts` (type-only). Authoritative resolver:
`functions/src/utils/serviceOptions.ts`. Advisory mirror: `src/utils/serviceOptions.ts`
(parity pinned by `packages/shared/src/serviceOption.golden.json`, asserted in both suites).

---

## 3. Resolution precedence

Per option, **most specific wins for the mode**:

```
service override → category default → tenant default → catalogue default
```

- The catalogue default is **OPTIONAL_PAID at the option's intrinsic price/duration** →
  a tenant with **no** option config behaves **byte-for-byte as today** (every Extras
  service is a paid selectable add-on). This is the legacy-compatibility guarantee.
- `price`/`duration` come from the mode-deciding layer's rule when present, else the
  catalogue intrinsic. The resolved value records its **source** (`service|category|tenant|catalogue`).

### Configuration semantics (trust discipline)

- **Own-property checks, never truthiness.** Explicit `price: 0` / `duration: 0` are honoured.
- A **missing** field falls through to the next layer / the catalogue.
- A raw `null` mode, an unknown mode string, a negative/NaN price, or a non-integer
  duration is **invalid** → `OPTION_CONFIGURATION_INVALID` (fail-closed — the whole create
  is rejected, mirroring how paymentSettings rejects a malformed payment block). A config
  key pointing at a **deleted** option is dead config → skipped, never a booking blocker.

### Mode behaviour

| Mode | Price | Duration | Selectable? | Stored where |
|---|---|---|---|---|
| **INCLUDED** | £0 | 0, unless config explicitly models an included duration | no (rejected if submitted paid) | `includedOptionsSnapshot` |
| **OPTIONAL_PAID** | trusted server price | trusted server duration | yes | `selectedAddOns` (+ legacy `soldAddOns`) |
| **OPTIONAL_FREE** | £0 | trusted server duration | yes | `selectedAddOns` (+ legacy `soldAddOns`) |
| **UNAVAILABLE** | — | — | hidden (advisory); server rejects if submitted | — |

---

## 4. C1 request & transaction changes

**Callable allowlist gains exactly one field: `selectedOptionIds: string[]` (IDS ONLY).**
The browser can never send an option name, price, duration or mode — all are recomputed
server-side (and the resolved artefacts `selectedAddOns` / `includedOptionsSnapshot` /
`soldAddOns` are in the forbidden set).

- IDs are validated (format/length), **deduped, sorted**, bounded (`MAX_SELECTED_OPTIONS = 20`),
  and included in the **idempotency fingerprint** — a retry with the same set replays; the
  same key with a **different** set is `IDEMPOTENCY_CONFLICT`; reordering is identical.
- Inside the existing booking transaction: load the trusted catalogue/config → resolve
  effective mode → validate service/category/tenant compatibility → **recompute total price
  and duration/end** → **re-run the staff-shift/allowance decision and SLOT_CONFLICT on the
  FINAL duration** → write trusted snapshots. Client totals are never trusted.
- **Booking representation (additive; legacy readers preserved):**
  `selectedAddOns` (trusted, typed) + `includedOptionsSnapshot` (complimentary, always £0,
  **never** mixed into charged `soldAddOns`) + `servicePrice` (the explicit BASE — the field
  the ADDON-PRICE incident asked for, so no reader must strip folded extras heuristically).
  `price` stays the online grand total (charged options folded in) so PAY-1 / checkout /
  loyalty math is unchanged. A booking with **no** options is written exactly as today.

### Stable machine reason codes

`OPTION_NOT_FOUND` · `OPTION_UNAVAILABLE` · `OPTION_ALREADY_INCLUDED` ·
`OPTION_NOT_ALLOWED_FOR_SERVICE` · `INVALID_OPTION_SELECTION` ·
`OPTION_CONFIGURATION_INVALID` · `REFUND_OR_CREDIT_REQUIRED`. Never a UI string as a
server decision.

---

## 5. PAY-1 compatibility

Payment provider/requirement remain **independent** and PAY-1-owned; the PENDING/CONFIRMED
decision is unchanged. Folding charged options into `price` means an external/Connect
checkout later charges the **trusted final booking total** naturally; the deposit is still
credited exactly once. OPT-1 modifies **no** PAY-1 semantics.

---

## 6. Checkout / edit behaviour & the ADDON-PRICE closure

The folded-price maintenance that lived inline in `BookingDetailPanel.performSave` is now a
pure, directly-tested helper `src/utils/bookingPrice.ts` (`recomputeFoldedPrice`):

- Removing an OPTIONAL_PAID extra reduces the total by the trusted amount **exactly once**;
  removing an OPTIONAL_FREE changes duration where configured but **not** price.
- **INCLUDED can never be "removed as a discount"** — it is never a `soldAddOns` member.
- Remaining balance = trusted final total − verified prior payment; the deposit/paid amount
  is preserved; **no fake discount** is ever invented.
- Repeated save is **idempotent** (an identical re-save moves nothing).
- If the new total would fall **below** the already-paid amount, it returns a stable
  `REFUND_OR_CREDIT_REQUIRED` state (operator is stopped) rather than silently corrupting
  the total. Products, tips, discounts and unrelated checkout fields are untouched.

**Regression:** `src/utils/bookingPrice.test.ts` replays the exact live booking (Skin Fade
£32, wrongly-added Wash & Hot Towel £10, £10 deposit, stored £42 → corrected £32, deposit
£10, balance £22, no discount) plus the refund/credit guard. This **closes the ADDON-PRICE
test debt** owed in INCIDENTS 2026-07-22 / 2026-07-26 (commit `694c2bb`, deployed +
live-verified 2026-07-26 18:39Z).

---

## 7. Whitecross is a FIXTURE, not a hardcode

There is **no tenantId condition anywhere** in the resolver or C1. The tests prove the same
option resolves oppositely per tenant/service through the identical generic code path. The
future Whitecross production configuration (owner-gated, **not written by this package**) is:

```jsonc
// tenants/whitecross/settings/settings.optionConfig
{ "tenant": { "wash-hot-towel": { "mode": "INCLUDED" } } }
```

A generically-named tenant with the identical config produces the identical decision. Any
other tenant may set the same option `OPTIONAL_PAID` at £10; any service may override it to
`INCLUDED` or `UNAVAILABLE`.

---

## 8. Scope, dependencies, handoff

- **Landed:** shared types + golden fixture; authoritative resolver + advisory mirror; C1
  `selectedOptionIds`; folded-price helper + BookingDetailPanel wiring; tests (resolver 24,
  C1 67, emulator 11/11 real Firestore, frontend +32) + both typechecks + Vite build (main +
  staff) + eslint + `diff --check`, all green.
- **Not in this package:** any deploy; production option config/data write; the option
  config **admin UI** (Settings → service/category/tenant option matrix); Whitecross premium
  booking UI; group booking; **W1 website cutover** (the premium `whitecross-site` booking
  path must route through `salownCreateBooking` before Whitecross's INCLUDED config takes
  live effect); a location layer; any backfill.
- **W1 dependency:** OPT-1 is authoritative on the C1 callable path. Until W1, the premium
  `whitecross-site` direct-write path does not consult it — so Whitecross's future INCLUDED
  config is inert on that path until cutover.
- **C2/next:** wire the advisory resolver into the booking/checkout UI (Included band vs
  selectable add-ons), build the option-config admin surface, and (post-W1) migrate checkout
  readers from the folded-price heuristic to the trusted `servicePrice` + `selectedAddOns` /
  `includedOptionsSnapshot` snapshots.
