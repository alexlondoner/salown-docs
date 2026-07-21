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
