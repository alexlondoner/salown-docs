# FEATURE_FLAGS.md

Every tenant doc has a `features` object. All flags are read from here — do not hardcode.

## Flag List

| Flag | Description |
|------|----------|
| `ai` | AI suggestions / personalized responses enabled |
| `personalizedAI` | Deeper AI personalization |
| `booksy` | Booksy integration enabled |
| `booksyParser` | Booksy email parser enabled (IMAP) |
| `fresha` | Fresha integration enabled |
| `freshaParser` | Fresha email parser enabled |
| `treatwell` | Treatwell integration enabled |
| `treatwellParser` | Treatwell email parser enabled |
| `cancelReschedule` | Self-service cancel/reschedule (email link) enabled |
| `emailConfirmation` | Sending booking confirmation email enabled |
| `loyalty` | Whether to show the loyalty program (UI) |
| `loyaltySystem` | Loyalty earn/redeem enabled |
| `salownLoyaltyEmail` | Send loyalty email from salown-app/Brevo (toggle for whitecross) |
| `stripe` | Stripe deposit enabled — see: BUSINESS_RULES.md (not completed, activation) |
| `telegram` | Telegram notifications enabled |

## Loyalty Email Toggle (Whitecross-specific)

`sendLoyaltyCardEmail` (whitecross-site):
- `salownLoyaltyEmail: true` → whitecross-site early return, salown-app/Brevo sends
- `salownLoyaltyEmail: false` → whitecross-site sends its own I CUT premium template

Managed from Super Admin → Tenants → whitecross → Feature Flags.

## Loyalty Email Toggle at Checkout

Toggle in `CheckoutPanel.jsx` PaymentStep:
- `loyaltyEnabled` (`loyaltyConfig.enabled`) AND `isPlatformBooking` must both be true
- If tenant loyalty is disabled the toggle isn't shown, `sendLoyaltyEmail` = false

## Telegram Config

Token/chatIds are kept in the Firestore tenant doc (not in Cloud Function secrets).
Super Admin → Tenants → tenant → Telegram Bot Token + Chat IDs.
`notifyTenant(db, tenantId, msg)`: reads `features.telegram` + `telegramToken` + `telegramChatIds` from Firestore.
Comma-separated chatIds are supported.

**Namespaces:**
- Whitecross: `WC_TELEGRAM_TOKEN` / `WC_TELEGRAM_CHAT_IDS`
- EeKurt: `TELEGRAM_TOKEN` / `TELEGRAM_CHAT_IDS` (tenant INACTIVE 2026-07-18 — config no longer used)
