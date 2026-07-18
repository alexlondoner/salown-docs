# FEATURE_FLAGS.md

Her tenant doc'unda `features` objesi var. Tüm flag'ler buradan okunur — hardcode etme.

## Flag Listesi

| Flag | Açıklama |
|------|----------|
| `ai` | AI önerileri / kişiselleştirilmiş yanıtlar aktif |
| `personalizedAI` | Daha derin AI kişiselleştirme |
| `booksy` | Booksy entegrasyonu aktif |
| `booksyParser` | Booksy email parser aktif (IMAP) |
| `fresha` | Fresha entegrasyonu aktif |
| `freshaParser` | Fresha email parser aktif |
| `treatwell` | Treatwell entegrasyonu aktif |
| `treatwellParser` | Treatwell email parser aktif |
| `cancelReschedule` | Self-service cancel/reschedule (email link) aktif |
| `emailConfirmation` | Booking confirmation email göndermek aktif |
| `loyalty` | Loyalty program gösterilsin mi (UI) |
| `loyaltySystem` | Loyalty earn/redeem aktif |
| `salownLoyaltyEmail` | Loyalty email salown-app/Brevo'dan gitsin (whitecross için toggle) |
| `stripe` | Stripe deposit aktif — bkz: BUSINESS_RULES.md (tamamlanmadı, etkinleştirme) |
| `telegram` | Telegram bildirim aktif |

## Loyalty Email Toggle (Whitecross'a Özel)

`sendLoyaltyCardEmail` (whitecross-site):
- `salownLoyaltyEmail: true` → whitecross-site early return, salown-app/Brevo gönderir
- `salownLoyaltyEmail: false` → whitecross-site kendi I CUT premium template'i gönderir

Super Admin → Tenants → whitecross → Feature Flags'dan yönetilir.

## Checkout'ta Loyalty Email Toggle

`CheckoutPanel.jsx` PaymentStep'te toggle:
- `loyaltyEnabled` (`loyaltyConfig.enabled`) VE `isPlatformBooking` ikisi de true olmalı
- Tenant loyalty disabled ise toggle görünmez, `sendLoyaltyEmail` = false

## Telegram Config

Token/chatIds Firestore tenant doc'unda tutuluyor (Cloud Function secrets'ta değil).
Super Admin → Tenants → tenant → Telegram Bot Token + Chat IDs.
`notifyTenant(db, tenantId, msg)`: `features.telegram` + `telegramToken` + `telegramChatIds` Firestore'dan okur.
Comma-separated chatIds destekleniyor.

**Namespace'ler:**
- Whitecross: `WC_TELEGRAM_TOKEN` / `WC_TELEGRAM_CHAT_IDS`
- EeKurt: `TELEGRAM_TOKEN` / `TELEGRAM_CHAT_IDS` (tenant İNAKTİF 2026-07-18 — config artık kullanılmıyor)
