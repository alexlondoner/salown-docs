# TENANTS.md

## Active Tenants

> **Currently 2 tenants LIVE in use:** `whitecross` + `herohairs` (2026-07-18). `eekurt` no longer uses the platform (inactive) — its record is kept below, Firestore data was not deleted.
>
> This table is **real salons only**. `demo` and `tr-demo` are not real salons and are not listed here — see [Demo & verification tenants](#demo--verification-tenants) for what each one is for and how each is configured.

| Tenant ID    | Business                  | Email                        | Firebase UID                          | Status |
|-------------|---------------------------|------------------------------|---------------------------------------|-------|
| `whitecross` | I CUT Whitecross Barbers  | aerulas@gmail.com            | CsktIKNC0wRaP2eK8DECVMWPD0m1          | Premium pilot — every feature ships here first |
| `herohairs`  | HeroHairs (Hairdresser)   | alex2ayyildiz3@gmail.com     | BRk26AmRLXUMjLNIoBRLJB11o3o1          | Pilot client — full access, trial never ends |
| `eekurt`     | EeKurt Barbers            | eekurtbookings@gmail.com     | L6wsBgQmBYXIVBt3RYHS2LATsxH2          | ❌ Inactive (left the platform 2026-07-18) — data still in Firestore, rules/data not deleted |

**Super Admin:** durvezek@gmail.com (Dursun Kahraman)

## Demo & verification tenants

Neither is a real salon, and the two are **not interchangeable** — one is a permanent product surface,
the other is scratch space. Confusing them is how a synthetic fixture ends up quoted as the product's
configuration.

| Tenant ID | Role | Lifecycle |
|---|---|---|
| `demo` | **Persistent Turkish product / sales demo.** The tenant a prospect is actually shown. | **Kept.** Its configuration is a deliberate owner decision and is a legitimate anchor for what TR should look like. |
| `tr-demo` | **Disposable synthetic verification tenant** (`demo: true`, `demoKind: 'tr-pilot'`, seeded by `scripts/seedTrDemoTenant.cjs`). Exists so live tests never touch a real salon. | **Restored after every test run** — settings byte-identical, synthetic docs deleted. |

### Durable configuration truth (verified live 2026-08-02)

| Tenant | Country / presentation | Packages | `checkoutSettings` |
|---|---|---|---|
| `demo` | **TR** — `countryCode: TR`, `TRY`, `tr-TR`, `Europe/Istanbul` (root **and** `settings/settings`) | **Enabled** (`packageSettings.enabled: true`) | **PRESENT — `enabled: true`, `mode: tr`** (intentional) |
| `tr-demo` | **TR** — same presentation contract | absent | **ABSENT** — resolves to today's UK behaviour, feature dark |
| `whitecross` | UK (no `presentation` block — UK is the default) | absent | **ABSENT** — current UK behaviour |
| `herohairs` | UK (no `presentation` block) | absent | **ABSENT** — current UK behaviour |

**`demo` checkout is intentionally enabled in TR mode.** It presents as Turkish, so an authoritative
mode of `uk` made the Turkish sales demo resolve UK checkout. Set to `tr` on 2026-08-02 through the
owner-authoritative callable `salownSaveCheckoutSettings` (`schemaVersion` 1 → 2). It is **not** a
leftover from a test and must not be "cleaned up".

> **`tr-demo`'s configuration is not a product anchor.** It is whatever the last verification run left
> behind, and it is *supposed* to be default/absent at rest. Never cite it as evidence of how a TR
> tenant should be configured, and never treat its absent `checkoutSettings` as a decision — it is the
> restored baseline. For that question the answer is `demo`, and the row above is the record.

## Tenant Types

### Class A — salOWN-managed (standard, e.g. herohairs)
- All email, Telegram, in-app notif, push: only `salown-app/functions`
- Each capability is enabled by a feature flag
- No separate function codebase

### Class B — Self-managed (has its own codebase)
- Email, Telegram, push, in-app: in its own functions codebase
- `salown-app/functions` triggers must be guarded for this tenant
- See: [MULTI_TENANT_NOTES.md](MULTI_TENANT_NOTES.md)

**Self-managed tenant list:** No active Class B tenant at the moment.

> **Note:** `whitecrossbarbers.com` (custom domain, cancel/reschedule pages) must not be confused with Class B.
> This is salOWN's premium tier feature — "salon site on your own domain". The functions architecture is Class A,
> the website is separate. Whitecross, as the pilot premium tenant, is the live example of this feature.

## Whitecross — Business Info

- Address: 136 Whitecross Street, London EC1Y 8QJ
- Tel: 020 3621 5929
- Services: £22 (Clipper Cut) → £65 (iCuT Royal)
- Google Reviews: 408 reviews, 4.8★
- Google Ads: GA4 `G-TN2JGH5JLY`, Ads `AW-18017585907` (Stripe purchase only)
- SEO: `announcements.html` Schema.org ItemList, EC1Y, Old Street, Barbican, Moorgate

## Tenant Firestore Doc Fields

```
tenants/{tenantId}/
  name, businessType, city, domain
  ownerEmail, ownerName, ownerUID
  plan: "free" | "pro" | ...
  status: "trial" | "active" | ...
  trialEndsAt, createdAt
  onboardingComplete: bool
  telegramToken, telegramChatIds

  features: {
    ai, booksy, booksyParser,
    cancelReschedule, emailConfirmation,
    fresha, freshaParser,
    loyalty, loyaltySystem,
    personalizedAI,
    salownLoyaltyEmail,
    stripe, telegram,
    treatwell, treatwellParser
  }
```

⚠️ Always read feature flags from the tenant doc — do not hardcode.

## Onboarding Note

Self-signup onboarding does not exist yet — tenants are added manually.
Custom claims are set in Firebase Auth: e.g. `{ tenantId: 'whitecross' }`.
Each tenant panel blocks cross-tenant login.
