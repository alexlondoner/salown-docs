# B7 — WhatsApp booking confirmations (Meta Cloud API)

*Detail document. Status lives in [ROADMAP.md](ROADMAP.md) (`B7`, Booking Experience theme); this file carries no status badge.*

Fresha-style: a customer who books online receives a WhatsApp confirmation from salOWN's own WhatsApp Business number, **in addition to** the email. The email stays as it is. Premium (plan-gated), per-tenant opt-in.

## 1. Why

2026-09-04: a Whitecross customer mistyped his email at booking (`conraddjswift@` instead of `conradjswift@`), the confirmation hard-bounced at Gmail, and there was no second channel. Phone is mandatory on both public booking surfaces, so WhatsApp closes that gap at pennies per message.

## 2. Decisions (owner, 2026-09-05)

| # | Decision | Value |
|---|---|---|
| 1 | Feature tier | **Premium, plan-gated** — `whatsapp` flag in `PLAN_LIMITS.features` (`pro`, `proplus`); the server gate is the authority |
| 2 | Meta Business account | **salOWN's** (multi-tenant; one WhatsApp Business Account, per-tenant sending can be added later) |
| 3 | Sender number | **A new number**, bought by the owner on 2026-09-06 — the shop's live WhatsApp number is NOT migrated (a number moved to the API leaves the WhatsApp app) |
| 4 | Scope of the pilot | Booking confirmation only. Reschedule and the 24-hour reminder are follow-ups |

## 3. What exists in code (commit `b3b6cb4`, salown-app, `[skip ci]`, NOT deployed)

```
functions/src/whatsapp/
  phone.ts          E.164 from the stored phone + tenant countryCode (GB/TR/IE), masked logging
  gate.ts           delivery decision: status → source → future-only → tenant opt-in → plan → phone
  template.ts       approved-template payload builder + the exact template TEXT (§5)
  client.ts         Meta Graph API v21.0 client (fetch injected), secret names
  webhook.ts        GET handshake, X-Hub-Signature-256 check, status parsing, write-back
  confirmation.ts   orchestration; never throws; stamps the booking
  index.ts          module surface
functions/src/index.ts
  salownWhatsAppOnBookingCreated     onCreate,  status CONFIRMED          secrets: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID
  salownWhatsAppOnBookingConfirmed   onUpdate,  PENDING → CONFIRMED       same secrets
  salownWhatsAppWebhook              onRequest, Meta delivery statuses    secrets: WHATSAPP_APP_SECRET, WHATSAPP_WEBHOOK_VERIFY_TOKEN
src/utils/planLimits.ts              `whatsapp` feature flag (pro/proplus true)
src/pages/Settings.tsx               Notifications → "WhatsApp messages" card, opt-in toggle, FeatureLock hint
```

The two email triggers are untouched on purpose: the email path was proven healthy on 2026-09-04 and a function whose bound secret is missing cannot be deployed at all.

**Booking stamps** (all written by the server): `whatsappConfirmationSentAt`, `whatsappMessageId`, `whatsappTo` (E.164), `whatsappStatus` (`sent` → `delivered` → `read`, or `failed`), `whatsappStatusAt`, `whatsappStatusError`, and on a send failure `whatsappConfirmationError` + `whatsappConfirmationErrorAt`. The booking is found from a webhook status through `platform/whatsapp/messages/{wamid}` (no collection-group index).

**Gate order and what each refusal means** (`gate.ts`): `NOT_CONFIRMED` · `NOT_ELIGIBLE_SOURCE` (same policy as email: online self-booking or `bookingType: 'booking'`; walk-ins and aggregator imports never) · `IN_PAST` · `ALREADY_SENT` (idempotent across the two triggers, fresh read) · `TENANT_DISABLED` (`settings/settings.whatsappConfirmationEnabled !== true`) · `PLAN_NOT_INCLUDED` (explicit `tenant.features.whatsapp` → `limitsOverride.features.whatsapp` → plan tier) · `NO_PHONE` · `INVALID_PHONE`.

Tests: `functions/src/whatsapp/*.test.js` 41/41 · `src/utils/planLimits.whatsapp.test.ts` 3/3 (includes a client/server tier-list parity check).

## 4. Owner checklist — Meta side (nothing here is code)

1. **Meta Business Manager** (business.facebook.com) under salOWN → *Business verification* (company name, address, a document). Days, sometimes a week.
2. **Meta App** (developers.facebook.com) → create app, type *Business* → add the **WhatsApp** product. Note the **App Secret** (App settings → Basic).
3. **Add the new phone number** in WhatsApp → API Setup. It must NOT be registered in the WhatsApp/WhatsApp Business app; verify by SMS/voice. Note the **Phone number ID** (not the number itself).
4. **Display name**: "salOWN" (must match the verified business). Tenant identity goes into the message body (`{{5}}` = salon name).
5. **System user + permanent token**: Business settings → Users → System users → add "salown-functions" (Admin) → *Generate token* with `whatsapp_business_messaging` + `whatsapp_business_management`, no expiry. This is `WHATSAPP_ACCESS_TOKEN`. Temporary dashboard tokens expire in 24 h — do not use one.
6. **Template**: WhatsApp Manager → Message templates → Create → category **Utility**, name exactly `salown_booking_confirmation`, one version per language (`en`, `tr`) with the text in §5, body sample values filled, and a **URL button** "Manage booking" → `https://salown.com/manage/{{1}}` with a sample suffix. Approval is usually minutes to a day.
7. **Webhook** (after the function is deployed): App → WhatsApp → Configuration → Callback URL = the `salownWhatsAppWebhook` URL, Verify token = the value chosen for `WHATSAPP_WEBHOOK_VERIFY_TOKEN` → *Verify and save* → subscribe to the **messages** field.
8. **Payment method** on the WhatsApp Business Account (Business settings → Billing). Without it, sending stops at the free-tier limit.

## 5. Template text (verbatim — `template.ts` `CONFIRMATION_TEMPLATE`)

`{{1}}` client first name · `{{2}}` service · `{{3}}` date & time · `{{4}}` staff · `{{5}}` salon

**en**

```
Hi {{1}}, your booking is confirmed ✅

{{2}}
{{3}}
with {{4}}

{{5}} — see you there!
```
Button (URL): **Manage booking** → `https://salown.com/manage/{{1}}`

**tr**

```
Merhaba {{1}}, randevunuz onaylandı ✅

{{2}}
{{3}}
{{4}} ile

{{5}} — görüşmek üzere!
```
Button (URL): **Randevuyu yönet** → `https://salown.com/manage/{{1}}`

If Meta asks for edits, change the text in Meta AND in `template.ts` together — the parameter order is the contract.

## 6. Secrets and deploy order (operator, after §4 steps 1–6)

```
cd salown-app
firebase functions:secrets:set WHATSAPP_ACCESS_TOKEN          # system-user permanent token
firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID       # numeric id from API Setup
firebase functions:secrets:set WHATSAPP_APP_SECRET            # App settings → Basic
firebase functions:secrets:set WHATSAPP_WEBHOOK_VERIFY_TOKEN  # any long random string, chosen by us
```

Deploy is **targeted, codebase-prefixed, never blanket** (memory: a blanket deploy deletes the 27 us-central1 orphans):

```
firebase deploy --only functions:salown:salownWhatsAppWebhook
# → register the webhook URL in Meta (§4.7), confirm the GET handshake returns 200
firebase deploy --only functions:salown:salownWhatsAppOnBookingCreated,functions:salown:salownWhatsAppOnBookingConfirmed
```

Hosting (`planLimits` flag + the Settings toggle) ships with the next `hosting:salown` release from the isolated `git archive` workspace, per the release rule. Until then the toggle is simply absent from the panel and the server sends nothing — the opt-in is `false` by default.

Then, per tenant: Settings → Notifications → **WhatsApp messages** → on. Whitecross first; its plan/override must include `whatsapp` (Pro+ pilots do).

## 7. Live test (owner, one booking)

1. Owner books on the hosted page with their own mobile number.
2. Expect within seconds: a WhatsApp from the salOWN number with the §5 text; the booking doc shows `whatsappStatus: 'sent'`, then `delivered`, then `read` once opened.
3. Evidence: `gcloud logging read 'resource.labels.service_name="salownwhatsapponbookingcreated" AND textPayload:"whatsappConfirmation"' --project havuz-44f70 --freshness=1d` — a `sent to +44…NNN (booking …) wamid=…` line, never a full number.
4. Negative: toggle off, book again → no message, no log line (quiet reason). Cancel the test bookings afterwards.

## 8. Cost

Meta charges per delivered template message; a UK utility message is a few pence (check Meta's current rate card at build time — it changed to per-message pricing in July 2025). Whitecross volume is 2–4 confirmations a day, so single-digit pounds a month. The first 1,000 service conversations a month are free but do not apply to utility templates.

## 9. Follow-ups (not in the pilot)

- Reschedule template (the email has one; the WhatsApp equivalent is a second approved template and a hook in the reschedule paths).
- 24-hour reminder — Fresha's most useful message; needs a scheduled function and a third template.
- Inbound replies: a customer answering the WhatsApp lands in the same webhook (`messages` field, `value.messages[]`) — today it is ignored; a "reply STOP" opt-out and a staff-visible inbox are the obvious next steps.
- **B4** phone country-code standardisation on the booking forms; until then `phone.ts` infers the country from the tenant presentation.
- Per-tenant sender numbers under the salOWN WABA when a second tenant wants its own identity.
