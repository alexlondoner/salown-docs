# EMAIL_ARCHITECTURE.md

## Core Rule — Sender Routing (ACTUAL STATE, 2026-06-25)

Routing is determined inside `_sendCustomerEmail()`. There are two inputs: the tenant's
`tenants/{id}/settings/emailConfig` (Gmail + appPassword) and the `FORCE_SALOWN_SENDER_TENANTS`
constant (functions/index.js). There is NO separate Settings/Super-Admin "Gmail or Brevo" toggle.

| Case | Sender |
|-------|--------|
| Tenant in `FORCE_SALOWN_SENDER_TENANTS` | **Brevo** → `"{Salon} via salOWN" <noreply@salown.com>` |
| `emailConfig.email` + `appPassword` populated | **Tenant Gmail** (nodemailer) → `"{Salon}" <emailConfig.email>` |
| `emailConfig` empty | **Brevo** → `"{Salon} via salOWN" <noreply@salown.com>` |

**whitecross (in `FORCE_SALOWN_SENDER_TENANTS` since 2026-06-25):** ALL customer
transactional mails (confirmation + cancel + reschedule, triggered by both customer and staff)
go through `noreply@salown.com` via Brevo. All 5 functions that pass through `_sendCustomerEmail`
are covered. To revert, remove the tenantId from the constant.

**Those going out via Brevo (noreply@salown.com):** loyalty (`salownSendLoyaltyEmail`),
all `FORCE_SALOWN_SENDER_TENANTS` tenants, and tenants with empty `emailConfig`.

> ⚠️ `whitecrossbarbers@gmail.com` NO LONGER SENDS mail TO CUSTOMERS — it is only
> read for the IMAP parser. (Exception: `sendMarketingEmail` marketing campaigns still go from the tenant Gmail,
> ROADMAP #7b design.)

### No-cash-value clause in loyalty mails (2026-07-13)
The loyalty receipt (`buildLoyaltyReceiptHtml`) and manual points update (`buildLoyaltyUpdateHtml`)
templates have a fixed line under the earn-rate strip: *"Points have no cash value, are
non-transferable and can only be redeemed against services at {salonName}."* (`2636d24`).
Tenant-agnostic — no link (the tenant-specific terms URL is not known in the template). Whitecross's
human-readable terms: whitecrossbarbers.com/terms.html ⭐ Loyalty Programme section.
⚠️ Consistency rule: the cancel mail says "your points are safe and never expire" → in the terms it says
"points do not currently expire"; if expiry is added, BOTH must change together.

### Member → double-points campaign is NOT SHOWN (2026-06-25)
No mail sent to a customer with `client.isMember === true` shows the double-points/campaign block
(they already get a standing discount). The suppression is at the data level: the confirmation trigger
(`_salownSendConfirmationEmail`, client lookup + `dpActive=!isMember&&…`) and the loyalty email
(`salownSendLoyaltyEmail`, `doublePointsActive=!isMember&&…`). The templates were not touched.

## `premiumEmailTemplate` — a Super Admin toggle that reaches NOTHING (WCP-3 P-2.5, 2026-08-27)

Recorded because the belief that "premium email is controlled from Super Admin" is reasonable,
matches a real UI control, and is **wrong** — and re-deriving it costs an audit every time.

The toggle exists: **Super Admin → Tenants → Branding & Email → "Premium email template"**
(`super-admin/src/pages/Tenants.jsx`) writes `tenants/{id}.premiumEmailTemplate` and records a
`branding_update` audit entry. Everything about it works except its effect.

| Layer | Reads it? | Evidence |
|---|---|---|
| Booking **confirmation** email | **No** | `functions/src/emails/index.ts` never mentions the field |
| Cancel / reschedule emails | **No** | same module, same absence |
| Loyalty **adjustment** email | reads, then **discards** | `functions/src/index.ts` — `const isPremium = tenantData.premiumEmailTemplate === true`, an `if (isPremium) { html = … }` branch, and then an **unconditional** `html = ET.buildLoyaltyUpdateHtml(…)` that overwrites it. The source labels the branch *"kept dead; safe to delete later."* |
| Shared type | declared only | `packages/shared/src/tenant.ts` — `premiumEmailTemplate?: boolean` |

So it is **vestigial, not broken in transit**: the unified templates deliberately superseded the
per-tenant premium/standard HTML. Reviving the dead branch would revert that decision, and giving
the confirmation email a premium variant means authoring a template that does not exist. Both are
product decisions, not repairs — which is why WCP-3 P-2.5 pinned the truth with tests
(`functions/src/bookings/createBooking.test.js` § 5EM-5/5EM-7) and changed no email source.

### What actually decides a customer's email — precedence, highest first

| # | Control | Where | Decides | Whitecross today |
|---|---|---|---|---|
| 1 | `FORCE_SALOWN_SENDER_TENANTS` | **hardcoded array**, `functions/src/emails/index.ts` | Forces the Brevo sender regardless of `emailConfig` | **listed** ⇒ Brevo |
| 2 | `settings/emailConfig` (`email` + `appPassword`) | private settings subdoc | Own-Gmail `"From: Salon"` sender when 1 does not apply | present but **overridden** by 1 |
| 3 | `salonName` → `name` → `'salOWN'` | tenant root doc | Display name in the sender, subject and calendar title | **"Whitecross Barbers"** |
| 4 | `presentation` (`EI.emailPresentation`) | settings + root mirror | Language, locale, currency, date format | UK / `en` |
| 5 | `premiumEmailTemplate` | tenant root doc, Super Admin toggle | **nothing** | irrelevant |

**Effective result for Whitecross:** a confirmation sent via **Brevo** as
**`"Whitecross Barbers via salOWN"`**, rendered by the unified `ET.buildConfirmationHtml`
template with UK presentation, carrying the **server-stamped** `barberName` from the booking
document. The email is sent only once the booking is `CONFIRMED`, so a `PENDING`
external-checkout booking is never announced before payment.

**If premium branded confirmations are actually wanted**, the smallest honest route is a template
variant in `ET.buildConfirmationHtml` selected by this existing toggle — a designed change with its
own approval, not a reconnection.

## Sender Branding

- Display name: `"{Salon Name} via salOWN"` — introduces the salon, grows the salOWN brand
- Every email contains a real unsubscribe link (not a reply)
- `List-Unsubscribe` + `List-Unsubscribe-Post` headers → Gmail native Unsubscribe button
- Goal: every transactional email is a salOWN brand touchpoint → users organically discover salown.com

## GDPR — emailOptOut

`salownEmailOptOut` HTTP function (no-auth required).
Params: `?email=xxx&tenant=yyy`

- Sets `clients/{id}.emailOptOut: true`
- If the client is not found → writes `tenants/{tenantId}/emailOptOuts/{email}`
- Returns an HTML confirmation page
- **Check `client.emailOptOut !== true` before every email send**

## Email Functions (salown-app/functions)

| Function | Trigger | Description |
|-----------|-------------|----------|
| `salownSendBookingConfirmation` | BookingPage callable | Accent `settings.brandColor` |
| `salownSendCancellationEmail` | Cancel callable | Multi-tenant HTML |
| `salownSendLoyaltyEmail` | Firestore trigger | `features.salownLoyaltyEmail` flag guard |
| `salownEmailOptOut` | HTTP | GDPR unsubscribe |

## Email Functions (whitecross-site/functions) — DISABLED

Whitecross is now a Class A tenant (migration completed 2026-06-19). All email functions were
moved to salown-app; the following are **disabled** in whitecross-site. See: [MULTI_TENANT_NOTES.md](MULTI_TENANT_NOTES.md)

| Function | Status | salown-app equivalent |
|-----------|-------|----------------------|
| `sendBookingConfirmation` | ❌ disabled 2026-06-19 | `salownBookingConfirmationTrigger` |
| `sendBookingConfirmationOnUpdate` | ❌ disabled 2026-06-19 | `salownCancelByToken` + `salownRescheduleByToken` |
| `sendLoyaltyCardEmail` | ❌ disabled 2026-06-19 | `salownSendLoyaltyEmail` (`salownLoyaltyEmail` flag) |

The only non-email flow still active in whitecross-site: Stripe (`createCheckoutSession` + `stripeWebhook`).

## Email Parser (IMAP)

Booksy/Fresha/Treatwell emails are parsed via IMAP.
- `extractTextFromRaw`: first the `text/plain` MIME part, base64-decode
  (Booksy embeds the `Booking #` only in the plain text MIME part)
- Parser changes: deployed only with `firebase deploy --only functions`
- Dedupe: `externalId` + `parserTombstones` (slot-based for Booksy)
- Re-run safe: manual import from a past date → creates missing bookings, does not duplicate existing ones

## "Powered by salOWN" — Self-Managed Email Footer

A small "Powered by salOWN" note can be added to the email footers of self-managed tenants.
Without breaking the email design, in a muted style. Optional — add when the template is updated.
