# EMAIL_ARCHITECTURE.md

## Temel Kural — Sender Routing (GERÇEK DURUM, 2026-06-25)

Routing `_sendCustomerEmail()` içinde belirlenir. İki girdi var: tenant'ın
`tenants/{id}/settings/emailConfig`'i (Gmail + appPassword) ve `FORCE_SALOWN_SENDER_TENANTS`
sabiti (functions/index.js). Ayrı bir Settings/Super-Admin "Gmail mi Brevo mu" toggle'ı YOK.

| Durum | Sender |
|-------|--------|
| Tenant `FORCE_SALOWN_SENDER_TENANTS` içinde | **Brevo** → `"{Salon} via Salown" <noreply@salown.com>` |
| `emailConfig.email` + `appPassword` dolu | **Tenant Gmail** (nodemailer) → `"{Salon}" <emailConfig.email>` |
| `emailConfig` boş | **Brevo** → `"{Salon} via Salown" <noreply@salown.com>` |

**whitecross (2026-06-25'ten beri `FORCE_SALOWN_SENDER_TENANTS` içinde):** TÜM müşteri
transactional mailleri (confirmation + cancel + reschedule, hem müşteri hem staff tetiklemeli)
`noreply@salown.com` üzerinden Brevo'ya gider. `_sendCustomerEmail`'den geçen 5 fonksiyonun
hepsi kapsanır. Geri almak için tenantId'yi sabitten çıkar.

**Brevo'dan gidenler (noreply@salown.com):** loyalty (`salownSendLoyaltyEmail`),
`FORCE_SALOWN_SENDER_TENANTS` tenant'larının tümü, ve `emailConfig` boş olan tenant'lar.

> ⚠️ `whitecrossbarbers@gmail.com` artık MÜŞTERİYE mail GÖNDERMEZ — yalnızca IMAP parser için
> okunur. (İstisna: `sendMarketingEmail` marketing kampanyaları hâlâ tenant Gmail'inden gider,
> ROADMAP #7b tasarımı.)

### Member → double-points campaign GÖSTERİLMEZ (2026-06-25)
`client.isMember === true` olan müşteriye giden hiçbir mailde double-points/campaign bloğu çıkmaz
(zaten standing discount alıyorlar). Bastırma data seviyesinde: confirmation trigger
(`_salownSendConfirmationEmail`, client lookup + `dpActive=!isMember&&…`) ve loyalty email
(`salownSendLoyaltyEmail`, `doublePointsActive=!isMember&&…`). Template'lere dokunulmadı.

## Sender Branding

- Display name: `"{Salon Name} via Salown"` — salonu tanıtır, Salown markasını büyütür
- Her email gerçek unsubscribe link içerir (reply değil)
- `List-Unsubscribe` + `List-Unsubscribe-Post` headers → Gmail native Unsubscribe butonu
- Amaç: her transactional email bir Salown brand touchpoint → kullanıcılar salown.com'u organik keşfeder

## GDPR — emailOptOut

`salownEmailOptOut` HTTP function (no-auth required).
Params: `?email=xxx&tenant=yyy`

- `clients/{id}.emailOptOut: true` set eder
- Client bulunmazsa → `tenants/{tenantId}/emailOptOuts/{email}` yazar
- HTML confirmation page döner
- **Her email gönderiminden önce `client.emailOptOut !== true` kontrol et**

## Email Fonksiyonları (salown-app/functions)

| Fonksiyon | Tetikleyici | Açıklama |
|-----------|-------------|----------|
| `salownSendBookingConfirmation` | BookingPage callable | Accent `settings.brandColor` |
| `salownSendCancellationEmail` | Cancel callable | Multi-tenant HTML |
| `salownSendLoyaltyEmail` | Firestore trigger | `features.salownLoyaltyEmail` flag guard |
| `salownEmailOptOut` | HTTP | GDPR unsubscribe |

## Email Fonksiyonları (whitecross-site/functions) — DEVRE DIŞI

Whitecross artık Class A tenant (migration 2026-06-19 tamamlandı). Tüm email fonksiyonları
salown-app'e taşındı; aşağıdakiler whitecross-site'ta **disabled**. Bkz: [MULTI_TENANT_NOTES.md](MULTI_TENANT_NOTES.md)

| Fonksiyon | Durum | salown-app karşılığı |
|-----------|-------|----------------------|
| `sendBookingConfirmation` | ❌ disabled 2026-06-19 | `salownBookingConfirmationTrigger` |
| `sendBookingConfirmationOnUpdate` | ❌ disabled 2026-06-19 | `salownCancelByToken` + `salownRescheduleByToken` |
| `sendLoyaltyCardEmail` | ❌ disabled 2026-06-19 | `salownSendLoyaltyEmail` (`salownLoyaltyEmail` flag) |

Whitecross-site'ta aktif kalan tek email-dışı akış: Stripe (`createCheckoutSession` + `stripeWebhook`).

## Email Parser (IMAP)

Booksy/Fresha/Treatwell emailları IMAP ile parse ediliyor.
- `extractTextFromRaw`: önce `text/plain` MIME part, base64-decode
  (Booksy `Booking #`'ı sadece plain text MIME part'ta gömülü)
- Parser changes: sadece `firebase deploy --only functions` ile deploy edilir
- Dedupe: `externalId` + `parserTombstones` (Booksy için slot-based)
- Re-run safe: geçmiş tarihten manual import → missing booking'leri yaratır, mevcut olanları duplike etmez

## "Powered by Salown" — Self-Managed Email Footer

Self-managed tenant'ların email footer'larına küçük "Powered by Salown" notu eklenebilir.
Email tasarımını bozmadan, muted style ile. Opsiyonel — template güncellenirken ekle.
