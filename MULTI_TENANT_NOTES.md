# MULTI_TENANT_NOTES.md

## İki Tier Mimari (KALICI KURAL)

### Class A — Salown-managed (standart)
- `salown-app/functions` her şeyi yönetir
- Feature flag ile capability açılır
- Yeni trigger → feature flag ekle → done
- Aktif Class A tenantlar: whitecross (2026-06-19'dan itibaren), herohairs. *(eekurt 2026-07-18'de inaktif oldu — veri korunuyor.)*

### Class B — Self-managed (kendi codebase'i var)
- `whitecross-site/functions` email, Telegram, push, in-app notif'i yönetir
- `salown-app/functions` trigger'ları **guard'lanmış olmalı** — yoksa double-fire
- **Şu an aktif Class B tenant yok.** whitecross 2026-06-19'da Class A'ya geçti.

**Neden kritik:** Her iki codebase aynı Firebase project'e deploy (`havuz-44f70`). Salown-app Firestore trigger'ları whitecross booking'leri için de tetiklenir.

## Guard Patterns

**Yeni salown-app Firestore trigger/email function eklerken:**

1. **Feature flag guard** (tercih edilen):
   ```js
   if (!tenantData.features?.salownXxx) return;
   ```
   Kullanılan: `salownSendLoyaltyEmail`

2. **Hard tenantId guard** (fallback):
   ```js
   if (tenantId === 'whitecross') return;
   ```
   Kullanılan: `salownNotifyBookingCreated`, `salownNotifyBookingUpdated` (cancel branch)

**Yeni trigger ekleme kuralı:** Tüm tenantları etkileyen trigger yazmadan önce Class B olabilecek tenant var mı kontrol et. Guard'ı hangi codebase'in o tenant'ı yönettiğini belirten comment'la belgele.

## Notification Kanalları (her booking için)

| Olay | Kanal | Fonksiyon | Sayı |
|------|-------|-----------|------|
| Yeni booking (CONFIRMED) | Telegram + in-app | `salownNotifyBookingCreated` | 1 |
| Yeni booking (CONFIRMED) | FCM push | `salownNotifyBookingPush` | 1 |
| Yeni booking (CONFIRMED) | Client email | `salownBookingConfirmationTrigger` | 1 |
| PENDING→CONFIRMED | FCM push | `salownNotifyBookingConfirmedPush` | 1 |
| Cancel (müşteri) | Telegram + in-app + email | `salownNotifyBookingUpdated` + `salownCancelByToken` | 1 her |
| Cancel (staff) | in-app only | `salownNotifyBookingUpdated` | 1 |
| Reschedule (müşteri) | Telegram + in-app + email | `salownNotifyBookingUpdated` + `salownRescheduleByToken` | 1 her |
| Checkout | Loyalty email | `salownSendLoyaltyEmail` | 1 |

⚠️ **Stripe Phase 5 notu:** `salownNotifyBookingCreated` PENDING booking'leri için de Telegram gönderiyor. PENDING→CONFIRMED geçişinde `salownNotifyBookingUpdated` da tetiklenir — source 'Salown' ONLINE listesinde olmadığı için duplicate Telegram yok, ama PENDING'de "New Booking" mesajı biraz yanıltıcı. Phase 5'te düzeltilmeli.

## Whitecross Migration — TAMAMLANDI (2026-06-19)

| Function | Durum | salown-app karşılığı |
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
| FCM token kayıt (barber-mobile) | ❌ disabled 2026-06-19 | Salown Staff App (`salown-staff.web.app`) |
| `createCheckoutSession` + `stripeWebhook` | ✅ active | ⏳ Phase 5 |

## Whitecross-site'ta Kasıtlı Kalanlar

- `createCheckoutSession` + `stripeWebhook` — Stripe deposit, Phase 5'e kadar
- Static public website (`cancel.html`, `reschedule.html`, `whitecrossbarbers.com`) — premium üye özelliği, legacy değil

## whitecross-site Kuralı

`whitecross-site/`'a yeni logic ekleme. Whitecross Class A'dır.

**`whitecrossbarbers.com` — legacy değil, premium üye özelliği.**
"Kendi domain'inde custom web sitesi" = Salown premium tier feature. Functions mimarisi Class A, web sitesi ayrı konudur.

## SalownHub Vision

- `hub.salown.com` = partner portal (şu an `salown.web.app/app`)
- `salown.com` = consumer marketplace
- DNS migrasyonu Phase 4 planında
