# TENANTS.md

## Aktif Tenantlar

> **Şu an CANLI kullanılan 2 tenant:** `whitecross` + `herohairs` (2026-07-18). `eekurt` artık platformu kullanmıyor (inaktif) — kaydı aşağıda korunuyor, Firestore verisi silinmedi.

| Tenant ID    | İşletme                   | Email                        | Firebase UID                          | Durum |
|-------------|---------------------------|------------------------------|---------------------------------------|-------|
| `whitecross` | I CUT Whitecross Barbers  | aerulas@gmail.com            | CsktIKNC0wRaP2eK8DECVMWPD0m1          | Premium pilot — her feature ilk burada |
| `herohairs`  | HeroHairs (Hairdresser)   | alex2ayyildiz3@gmail.com     | BRk26AmRLXUMjLNIoBRLJB11o3o1          | Pilot client — full access, trial bitmez |
| `eekurt`     | EeKurt Barbers            | eekurtbookings@gmail.com     | L6wsBgQmBYXIVBt3RYHS2LATsxH2          | ❌ İnaktif (2026-07-18 platformu bıraktı) — veri Firestore'da duruyor, rules/data silinmedi |

**Super Admin:** durvezek@gmail.com (Dursun Kahraman)

## Tenant Tipleri

### Class A — Salown-managed (standart, örn: herohairs)
- Tüm email, Telegram, in-app notif, push: yalnızca `salown-app/functions`
- Her capability bir feature flag ile açılır
- Ayrı function codebase yok

### Class B — Self-managed (kendi codebase'i var)
- Email, Telegram, push, in-app: kendi functions codebase'inde
- `salown-app/functions` trigger'ları bu tenant için guard'lanmış olmalı
- Bkz: [MULTI_TENANT_NOTES.md](MULTI_TENANT_NOTES.md)

**Self-managed tenant listesi:** Şu an aktif Class B tenant yok.

> **Not:** `whitecrossbarbers.com` (custom domain, cancel/reschedule sayfaları) Class B ile karıştırılmamalı.
> Bu, Salown'un premium tier özelliğidir — "kendi domain'inde salon sitesi". Functions mimarisi Class A,
> web sitesi ayrıdır. Whitecross, pilot premium tenant olarak bu özelliğin canlı örneğidir.

## Whitecross — İşletme Bilgisi

- Adres: 136 Whitecross Street, London EC1Y 8QJ
- Tel: 020 3621 5929
- Servisler: £22 (Clipper Cut) → £65 (iCuT Royal)
- Google Reviews: 408 yorum, 4.8★
- Google Ads: GA4 `G-TN2JGH5JLY`, Ads `AW-18017585907` (Stripe purchase only)
- SEO: `announcements.html` Schema.org ItemList, EC1Y, Old Street, Barbican, Moorgate

## Tenant Firestore Doc Alanları

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

⚠️ Feature flag'leri her zaman tenant doc'tan oku — hardcode etme.

## Onboarding Notu

Self-signup onboarding henüz yok — tenantlar manuel ekleniyor.
Custom claims Firebase Auth'da set ediliyor: `{ tenantId: 'whitecross' }` gibi.
Her tenant panel cross-tenant login'i engelliyor.
