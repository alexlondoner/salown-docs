# MULTI_TENANT_NOTES.md

## Two-Tier Architecture (PERMANENT RULE)

### Class A — salOWN-managed (standard)
- `salown-app/functions` manages everything
- Capability is enabled via a feature flag
- New trigger → add a feature flag → done
- Active Class A tenants: whitecross (since 2026-06-19), herohairs. *(eekurt went inactive on 2026-07-18 — data preserved.)*

### Class B — Self-managed (has its own codebase)
- `whitecross-site/functions` manages email, Telegram, push, in-app notif
- `salown-app/functions` triggers **must be guarded** — otherwise double-fire
- **There is currently no active Class B tenant.** whitecross moved to Class A on 2026-06-19.

**Why critical:** Both codebases deploy to the same Firebase project (`havuz-44f70`). salown-app Firestore triggers fire for whitecross bookings too.

## Guard Patterns

**When adding a new salown-app Firestore trigger/email function:**

1. **Feature flag guard** (preferred):
   ```js
   if (!tenantData.features?.salownXxx) return;
   ```
   Used by: `salownSendLoyaltyEmail`

2. **Hard tenantId guard** (fallback):
   ```js
   if (tenantId === 'whitecross') return;
   ```
   Used by: `salownNotifyBookingCreated`, `salownNotifyBookingUpdated` (cancel branch)

**New trigger rule:** before writing a trigger that affects all tenants, check whether there's a tenant that could be Class B. Document the guard with a comment stating which codebase manages that tenant.

## Notification Channels (per booking)

| Event | Channel | Function | Count |
|------|-------|-----------|------|
| New booking (CONFIRMED) | Telegram + in-app | `salownNotifyBookingCreated` | 1 |
| New booking (CONFIRMED) | FCM push | `salownNotifyBookingPush` | 1 |
| New booking (CONFIRMED) | Client email | `salownBookingConfirmationTrigger` | 1 |
| PENDING→CONFIRMED | FCM push | `salownNotifyBookingConfirmedPush` | 1 |
| Cancel (customer) | Telegram + in-app + email | `salownNotifyBookingUpdated` + `salownCancelByToken` | 1 each |
| Cancel (staff) | in-app only | `salownNotifyBookingUpdated` | 1 |
| Reschedule (customer) | Telegram + in-app + email | `salownNotifyBookingUpdated` + `salownRescheduleByToken` | 1 each |
| Checkout | Loyalty email | `salownSendLoyaltyEmail` | 1 |

⚠️ **Stripe Phase 5 note:** `salownNotifyBookingCreated` sends Telegram for PENDING bookings too. On the PENDING→CONFIRMED transition `salownNotifyBookingUpdated` also fires — since the source 'salOWN' isn't in the ONLINE list there's no duplicate Telegram, but the "New Booking" message on PENDING is a bit misleading. To be fixed in Phase 5.

## Whitecross Migration — COMPLETED (2026-06-19)

| Function | Status | salown-app equivalent |
|----------|-------|---------------------|
| `parseBooksyConfirmations` | ❌ disabled 2026-06-17 | `salownParseEmails` |
| `parseBooksyCancellations` | ❌ disabled 2026-06-17 | `salownParseEmails` |
| `parseFreshaConfirmations` | ❌ disabled 2026-06-08 | `salownParseEmails` |
| `parseTreatwell` | ❌ disabled | `salownParseEmails` |
| `notifyNewBooking` | ❌ disabled 2026-06-17 | `salownNotifyBookingCreated` |
| `notifyBookingCancelled/Confirmed/Rescheduled` | ❌ disabled 2026-06-17 | `salownNotifyBookingUpdated` |
| `sendBookingConfirmation` | ❌ disabled 2026-06-19 | `salownBookingConfirmationTrigger` |
| `sendBookingConfirmationOnUpdate` | ❌ disabled 2026-06-19 | `salownCancelByToken` + `salownRescheduleByToken` |
| `sendLoyaltyCardEmail` | ❌ disabled 2026-06-19 | `salownSendLoyaltyEmail` (flag: `salownLoyaltyEmail: true`) |
| `cleanupExpiredPending` | ❌ disabled 2026-06-19 | `salownCleanupExpiredPending` (multi-tenant) |
| `onNewBookingPush` / `onBookingConfirmedPush` | ❌ disabled 2026-06-19 | `salownNotifyBookingPush` / `salownNotifyBookingConfirmedPush` |
| FCM token registration (barber-mobile) | ❌ disabled 2026-06-19 | salOWN Staff App (`salown-staff.web.app`) |
| `createCheckoutSession` + `stripeWebhook` | ✅ active | ⏳ Phase 5 |

## Deliberately Kept in whitecross-site

- `createCheckoutSession` + `stripeWebhook` — Stripe deposit, until Phase 5
- Static public website (`cancel.html`, `reschedule.html`, `whitecrossbarbers.com`) — premium member feature, not legacy

## whitecross-site Rule

Don't add new logic to `whitecross-site/`. Whitecross is Class A.

**`whitecrossbarbers.com` — not legacy, a premium member feature.**
"Custom website on your own domain" = a salOWN premium tier feature. The functions architecture is Class A; the website is a separate matter.

## salOWNHub Vision

- `hub.salown.com` = partner portal (currently `salown.web.app/app`)
- `salown.com` = consumer marketplace
- DNS migration is in the Phase 4 plan
