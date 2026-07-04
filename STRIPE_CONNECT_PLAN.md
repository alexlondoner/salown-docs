# STRIPE_CONNECT_PLAN.md

Salown platform ödeme (deposit/full) mimarisi planı. **Durum (2026-07-04): Faz 0–3 UÇTAN UCA CANLI (europe-west2, TEST mode). Backend 6 Connect fn + refund/configurable-window fn'leri deployed; Settings UI ("Online payments" kartı + "Booking policy" kartı) DEPLOYED (`8747fea`→CI hosting); Stripe TEST Connect app/webhook kuruldu (`ca_Uov4x…`, sandbox "Turquoise Swing"). KALAN: komisyon (%0 kablolu), canlı-mode açılışı, opsiyonel servis-bazlı deposit editör alanı. `features.stripe` yalnız connected+charges-enabled+ödemeli-modda açılır; canlı-mode henüz KAPALI.**

İlgili: [BUSINESS_RULES.md](BUSINESS_RULES.md) (deposit flow), [FEATURE_FLAGS.md](FEATURE_FLAGS.md) (`stripe` flag), memory `project-salown-payments-vision`.

---

## Kilitlenen kararlar (2026-06-24)

| Karar | Seçim | Gerekçe |
|-------|-------|---------|
| **Connect tipi** | **Standard** (OAuth) | Ödeme tarafında SIFIR sorumluluk. Refund/dispute/destek tenant+Stripe arasında; platform sadece aracı. Tenant tam Stripe Dashboard'una sahip. |
| **Charge tipi** | **Direct charge** (tenant hesabında) | "Para direkt tenant'a gider" vizyonu. |
| **Komisyon** | `application_fee_amount` altyapısı kurulur, **%0 başlar** | İleride komisyon almak için hazır. |
| **Deposit tutarı** | **Sabit £** (servis bazlı `depositAmount`, tenant `defaultDepositAmount` fallback) | whitecross alışkanlığı; % değil. |
| **Ödeme modu** | per-tenant: `off \| deposit \| full \| optional \| pay_at_venue` | Tenant kendi seçer (Treatwell/Booksy paraleli). |
| **whitecross-site** | **DOKUNULMAZ** | Premium tenant kendi ödeme kanalı (us-central1, kendi key'leri, `source:'Website'`). |

**Standard'ın bedeli:** Onboarding'de tenant kısa süre Stripe'ın sitesine gider (OAuth). Kabul edildi.

---

## Mevcut durum (2026-06-24, kanıtlı)

- `BookingPage.jsx:558-559` — booking PENDING + `expiresAt` 30dk ✅
- `BookingPage.jsx:569,722-723` — **statik Payment Link redirect** ⚠️ (çıkmaz sokak)
- `functions/index.js:3797-3888` `salownStripeWebhook` — link modeline göre; `?tenant=` param, per-tenant `stripeSecretKey`+`stripeWebhookSecret` Firestore'dan, `paymentState` hardcoded `'DEPOSIT_PAID'`, `remaining` yok ⚠️
- `functions/index.js:3756-3787` `salownCleanupExpiredPending` — PENDING>expiresAt iptal ✅
- `functions/index.js:3894-3906` `salownBookingConfirmedEmailTrigger` — `stripeSessionId` varsa email ✅
- `Settings.jsx:1122-1136,630-636` — elle secret key girişi; `features.stripe = !!stripeSecretKey` ⚠️
- ~~**Connect kodu HİÇ yok.**~~ **GÜNCELLENDİ 2026-07-02:** Faz 0 Connect backend YAZILDI (deploy bekliyor) — `salownConnectStart`/`salownConnectCallback`/`salownConnectDisconnect`/`salownConnectStatus` (OAuth; sadece `acct_` id saklanır, tenant secret key değil). Bkz aşağıda "Yapılacaklar → A". Eski elle secret-key input'u (`Settings.jsx`) hâlâ duruyor (Faz 0'da silinmedi; Faz 1 sonrası kalkacak).

### Neden Payment Link çıkmaz
Statik tek-tutarlı URL: her servis×fiyat×(deposit/full) için ayrı link gerekir (ölçeklenmez), booking'e özel tutar açamaz, optional seçim yok, refund otomatize edilemez. → Gerçek `checkout.sessions.create` API'si şart.

---

## Hedef akış

```
Tenant Stripe hesabını Connect/OAuth ile bağlar (bir kez)
   → settings/integrations: stripeAccountId, chargesEnabled, payoutsEnabled
        ↓
Müşteri booking → salownCreateCheckoutSession (callable)
   → tutar SUNUCUDA servis doc'undan hesaplanır (client price'a güvenme)
   → stripe.checkout.sessions.create({...}, { stripeAccount: acctId }) [+opsiyonel application_fee]
        ↓
Müşteri öder → checkout.session.completed (event.account = acctId)
        ↓
salownStripeWebhook (TEK platform secret, tenant'ı event.account'tan çöz)
   → metadata.paymentType → paidAmount/remaining/paymentState yaz → CONFIRMED
        ↓
salownBookingConfirmedEmailTrigger → email (zaten var)
```

Connect Standard'ın kazancı: **platform tenant secret key'i HİÇ tutmaz** — kendi API key'iyle `{ stripeAccount }` header'ı üzerinden işler.

---

## Onboarding Flow — tenant Stripe'ı nasıl bağlar (UX + API)

Hedef: tenant için **tek buton + Stripe login + mod seç + kaydet.** Secret key giriş/saklama YOK.

### Tek seferlik platform kurulumu (bir kez)
1. Stripe Dashboard → Connect → Settings → **Connect application** oluştur → `client_id` (`ca_...`).
2. **Redirect URI:** `https://europe-west2-havuz-44f70.cloudfunctions.net/salownConnectCallback`.
3. Platform secret key → Cloud Function secret (tenant'larınki değil, PLATFORM key'i).

### Tenant'ın gördüğü akış
1. Settings → Integrations → Payments: **"Connect with Stripe"** butonu (+ "Para direkt senin Stripe hesabına gider" açıklaması).
2. Tıkla → Stripe hosted sayfası: mevcut hesapla **login** (whitecross) veya inline **yeni hesap** (herohairs: işletme+banka, Stripe KYC yapar).
3. Authorize → Salown'a döner → **"✓ Connected to Stripe"**.
4. Ödeme ayarı belirir: `paymentMode` (off/deposit/full/optional/pay_at_venue) + `defaultDepositAmount £`. Save.
5. Bitti — booking'ler artık tenant hesabında Checkout Session açar.

### Her adımın arkasındaki teknik
| Adım | Parça |
|------|-------|
| "Connect with Stripe" | `salownConnectStart` (callable) → OAuth URL: `connect.stripe.com/oauth/authorize?response_type=code&client_id=ca_…&scope=read_write&state=<tenantId+csrf>` |
| Login/authorize | Stripe hosted (platform hiçbir şey yapmaz) |
| Geri dönüş | `salownConnectCallback` (onRequest): `?code&state` → `POST connect.stripe.com/oauth/token` (`grant_type=authorization_code`) → **`stripe_user_id` (acct_…)** → `settings/integrations.stripeAccountId` yaz → Settings'e success redirect |
| Mod+deposit | `Settings.jsx` save'e `paymentMode`+`defaultDepositAmount` alanları |
| Disconnect | `salownConnectDisconnect` → `POST oauth/deauthorize` → `stripeAccountId` sil, mode `off` |

**Kritik:** OAuth sonunda elimize sadece `acct_...` (hesap ID) geçer — tenant secret key'i DEĞİL. Charge açarken platform key + `Stripe-Account: acct_...` header yeterli → Firestore'da secret key tutma riski tamamen kalkar.

### whitecross vs herohairs
- **whitecross:** Zaten Stripe hesabı var (whitecross-site'tan). OAuth'ta sadece login + Authorize → mevcut hesap bağlanır (yeni açmaz). 2 tık. NOT: bu yalnızca whitecross'un **Salown booking'leri** için; kendi sitesi eski akışında kalır (dokunulmaz), iki kanal aynı Stripe hesabını kullanır.
- **herohairs:** Hesap yok → "Connect with Stripe" → Stripe inline sign-up + KYC → biter. Salown'dan çıkmadan.

---

## Yapılacaklar — bileşenler

### A. Connect Onboarding (YENİ) — elle key yerine OAuth · ✅ backend DEPLOYED (2026-07-04, TEST mode) · UI kaldı
- ✅ `salownConnectStart` (callable) → Standard OAuth authorize URL üretir (CSRF nonce `superAdmin/oauthStates/{nonce}`, 10dk TTL).
- ✅ `salownConnectCallback` (onRequest) → `?code` exchange (`stripe.oauth.token`) → `stripeAccountId` yaz → HTML success sayfası → Settings linki.
- ✅ `salownConnectDisconnect` (callable) → `oauth.deauthorize` + acctId temizle.
- ✅ `salownConnectStatus` (callable) → `stripe.accounts.retrieve` → `{connected,chargesEnabled,payoutsEnabled,detailsSubmitted}` döner+mirror. **NOT:** `account.updated` webhook yerine bu **canlı-fetch** kullanıldı (Faz 0 için yeterli; webhook Faz 1 webhook-upgrade'iyle eklenebilir).
- 🔴 **Settings UI:** "Connect with Stripe" butonu + rozet + Disconnect → **HÂLÂ YOK** (`src/`'de sıfır referans; başka session yapacaktı, olmamış). (Eski secret-key input'u da silinmedi.) Kontrat: Start→url'ye git, dönüşte Status→rozet.
- ✅ **Deploy (2026-07-04):** 3 secret set (`STRIPE_SECRET_KEY`+`STRIPE_CONNECT_CLIENT_ID`+`STRIPE_CONNECT_WEBHOOK_SECRET`) + 6 fonksiyon hedefli deploy. ⚠️ Filtre codebase-prefix'li: `firebase deploy --only functions:salown:<fn>,...` (prefix'siz "No function matches" verir). Endpoint smoke: callback+webhook HTTP 400 = canlı.

### B. Ödeme politikası config (YENİ)
- `settings/integrations.paymentMode`: `off|deposit|full|optional|pay_at_venue`.
- `settings/integrations.defaultDepositAmount` (£) + servis doc `depositAmount` override.
- Settings UI + OnlineProfile servis editörü alanı.

### C. `salownCreateCheckoutSession` (YENİ — çekirdek)
- Callable, tenant-scoped, **tutarı sunucuda servis doc'undan hesapla**.
- `paymentType` (deposit/full) → `unit_amount`.
- `metadata: { docId, tenantId, paymentType, fullPrice, depositAmount }`, `client_reference_id=docId`, success/cancel URL.
- `{ stripeAccount: acctId }` [+ `application_fee_amount`].
- `session.url` döndür → BookingPage redirect.

### D. `salownStripeWebhook` (UPGRADE)
- **Connect webhook modeli:** tek platform endpoint + tek signing secret; tenant'ı `event.account`'tan çöz (mevcut `?tenant=`+per-tenant secret değişir).
- `metadata.paymentType` → `paidAmount = deposit?depositAmount:fullPrice`, `remaining = fullPrice-paidAmount`, `paymentState = deposit?'DEPOSIT_PAID':'PAID'`.
- Yeni event: `charge.refunded` (iptal), `account.updated` (onboarding).

### E. BookingPage UI (UPGRADE)
- `paymentMode==='optional'` → submit'te deposit/full modalı (whitecross `script.js:1015` referans).
- Statik link yerine `salownCreateCheckoutSession` çağır.
- `pay_at_venue` → mevcut CONFIRMED akışı (ödeme yok).

### F. İptal/Refund
- `salownCancelByToken` + 8h kuralı (BUSINESS_RULES.md) → deposit el koy / refund (`{ stripeAccount }`).

---

## Veri modeli — eklenecek

```
settings/integrations:
  stripeAccountId, chargesEnabled, payoutsEnabled, detailsSubmitted   // Connect
  paymentMode, defaultDepositAmount
  (stripeSecretKey / stripeWebhookSecret → KALDIRILACAK)
services/{id}: depositAmount   // opsiyonel override
bookings/{id} (webhook yazar):
  paymentType, paidAmount, remaining, paymentState,
  stripeSessionId, stripePaymentIntent, stripeAccountId, refundedAmount?
```

---

## Faz sırası
0. **Connect onboarding** (A) — hesap bağla, secret key riskini kaldır. (Ödeme hâlâ kapalı.) → ✅ **backend DEPLOYED 2026-07-04 (TEST); Settings UI kaldı.**
1. **Session + webhook** (C+D) — tek serviste full payment uçtan uca (test mode). → ✅ **backend DEPLOYED 2026-07-04 (`salownCreateCheckoutSession`+`salownConnectWebhook`); UI'dan uçtan uca test için Settings Connect butonu + BookingPage denemesi lazım.**
2. **Policy + deposit** (B+E) — deposit/full/optional, servis bazlı sabit £. → ✅ **DEPLOYED 2026-07-04:** Settings "Online payments" kartı (mod seçici + default deposit); BookingPage zaten wire'lı. Servis-bazlı `depositAmount` backend'de destekli, editör alanı opsiyonel kaldı.
3. **Refund/iptal** (F) + komisyon (`application_fee`). → ✅ **DEPLOYED 2026-07-04:** `salownCancelByToken` uygun iptalde refund; `salownConnectWebhook` `charge.refunded` yansıtma (collectionGroup index); iptal/erteleme pencereleri tenant-configurable (Settings "Booking policy"). Komisyon %0 kablolu.
4. **Aç:** önce herohairs (kendi sitesi yok = asıl ihtiyaç), sonra opsiyonel whitecross. → ⏳ TEST mode'da uçtan uca denenebilir; canlı-mode açılışı gerçek para kararına bağlı.

## Riskler
- Webhook secret modeli Connect'le zorunlu değişir (per-tenant → tek platform) — dikkatli migrate.
- **Tutarı asla client'tan alma** (forge; SYSTEM_ARCHITECTURE.md:75 kuralı).
- whitecross-site'a sıfır dokunuş.
- `features.stripe = !!stripeSecretKey` mantığı (`Settings.jsx:635`) Connect'e geçince `chargesEnabled`'a bağlanmalı.

## Efor (kaba)
Faz 0-1 ~2-3 gün · Faz 2 ~2 gün · Faz 3 ~1-2 gün · toplam ~1 hafta odaklı. Acil değil; herohairs ihtiyaç doğunca başlat.
