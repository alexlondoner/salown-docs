# TENANTS.md

## Active Tenants

> **Currently 2 tenants LIVE in use:** `whitecross` + `herohairs` (2026-07-18). `eekurt` no longer uses the platform (inactive) — the historical roster is kept below. A 2026-09-09 operator query reported no `tenants/eekurt` document; the time and cause of that difference are not established.
>
> This table is **real salons only**. `demo` and `tr-demo` are not real salons and are not listed here — see [Demo & verification tenants](#demo--verification-tenants) for what each one is for and how each is configured.

| Tenant ID    | Business                  | Email                        | Firebase UID                          | Status |
|-------------|---------------------------|------------------------------|---------------------------------------|-------|
| `whitecross` | I CUT Whitecross Barbers  | aerulas@gmail.com            | CsktIKNC0wRaP2eK8DECVMWPD0m1          | Premium pilot — every feature ships here first |
| `herohairs`  | HeroHairs (Hairdresser)   | alex2ayyildiz3@gmail.com     | BRk26AmRLXUMjLNIoBRLJB11o3o1          | Pilot client — full access, trial never ends |
| `eekurt`     | EeKurt Barbers            | eekurtbookings@gmail.com     | L6wsBgQmBYXIVBt3RYHS2LATsxH2          | ❌ Inactive (left the platform 2026-07-18) — historical record; 2026-09-09 query reported the tenant document absent (cause/time unverified) |

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

Self-signup exists at `/signup`; the separate application approval/invite flow also exists. Source implementation is not proof of successful provisioning for every account. See `CONNECT_PROFILE_READINESS.md` for the draft/public-profile distinction.
Custom claims are set in Firebase Auth: e.g. `{ tenantId: 'whitecross' }`.
Each tenant panel blocks cross-tenant login.

### Aggregator mailbox — mandatory "never Spam" filters (every tenant, at contract/onboarding)

*Added 2026-11-02 after HeroHairs lost three Treatwell bookings to Gmail's Spam folder (see INCIDENTS.md 2026-11-02).*

The email parsers read **only the INBOX** of the salon's booking mailbox (`settings/emailConfig.email`), and only
mail from the exact sender below, within a 7-day window. A booking email that Gmail classifies as Spam is invisible
to salOWN: no error, no quarantine entry, no alert. Forwarding does not help either — Gmail never forwards Spam.

So before a salon goes live with any aggregator, and as a clause in the onboarding agreement, the salon (or we, with
the owner's approval) must add one Gmail filter per enabled platform in that mailbox, action **"Never send it to Spam"**
(TR UI: *Asla Spam'a gönderme*), and nothing else (no archive / skip-inbox / mark-read / delete):

| Platform | Filter `from:` (must match the parser's IMAP criteria) |
|---|---|
| Treatwell | `noreply@treatwell.co.uk` |
| Booksy | `no-reply@booksy.com` |
| Fresha | `fresha.com` |

Rules:
- The filter must **not** skip the Inbox or archive — the parser only searches INBOX.
- Do not let anyone mark these mails as spam or delete/archive them within minutes of arrival.
- Verify after setup: Settings → Filters lists the rule; `in:spam <platform>` is empty.
- If the parser's sender criteria change (`functions/src/parsers/*.ts`), update this table and every tenant's filter.

Status (2026-11-02): HeroHairs (`durvezek@gmail.com`, Treatwell only) — `from:(noreply@treatwell.co.uk)` filter added. Whitecross (`whitecrossbarbers@gmail.com`, Treatwell+Booksy+Fresha) — `from:(treatwell.co.uk OR treatwell.com OR booksy.com OR fresha.com)` filter added alongside its existing forward filters; Spam had no aggregator mail. No other tenant has an aggregator mailbox configured. **Open:** HeroHairs Treatwell forward filter to its `herohairs_…@parse.salown.com` address (address verified → tenant herohairs) is not saved yet — Gmail requires the account owner to re-authenticate; to be done by the owner. Optional second path; the IMAP path is working.
