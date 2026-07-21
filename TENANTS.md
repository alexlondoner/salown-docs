# TENANTS.md

## Active Tenants

> **Currently 2 tenants LIVE in use:** `whitecross` + `herohairs` (2026-07-18). `eekurt` no longer uses the platform (inactive) — its record is kept below, Firestore data was not deleted.

| Tenant ID    | Business                  | Email                        | Firebase UID                          | Status |
|-------------|---------------------------|------------------------------|---------------------------------------|-------|
| `whitecross` | I CUT Whitecross Barbers  | aerulas@gmail.com            | CsktIKNC0wRaP2eK8DECVMWPD0m1          | Premium pilot — every feature ships here first |
| `herohairs`  | HeroHairs (Hairdresser)   | alex2ayyildiz3@gmail.com     | BRk26AmRLXUMjLNIoBRLJB11o3o1          | Pilot client — full access, trial never ends |
| `eekurt`     | EeKurt Barbers            | eekurtbookings@gmail.com     | L6wsBgQmBYXIVBt3RYHS2LATsxH2          | ❌ Inactive (left the platform 2026-07-18) — data still in Firestore, rules/data not deleted |

**Super Admin:** durvezek@gmail.com (Dursun Kahraman)

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
