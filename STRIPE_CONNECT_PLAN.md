# STRIPE_CONNECT_PLAN.md

Salown platform ödeme (deposit/full) mimarisi planı. **Durum (2026-07-04): Faz 0–3 UÇTAN UCA CANLI (europe-west2, TEST mode). Backend 6 Connect fn + refund/configurable-window fn'leri deployed; Settings UI ("Online payments" kartı + "Booking policy" kartı) DEPLOYED (`8747fea`→CI hosting); Stripe TEST Connect app/webhook kuruldu (`ca_Uov4x…`, sandbox "Turquoise Swing"). KALAN: komisyon (%0 kablolu), canlı-mode açılışı, opsiyonel servis-bazlı deposit editör alanı. `features.stripe` yalnız connected+charges-enabled+ödemeli-modda açılır; canlı-mode henüz KAPALI. → test→live geçişi için aşağıda "Go-Live Runbook (test→live)" (2026-07-17); ilk canlı deneme whitecross online profili.**

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
- **whitecross:** Zaten Stripe hesabı var (whitecross-site'tan). OAuth'ta sadece login + Authorize → mevcut hesap bağlanır (yeni açmaz). 2 tık. NOT: bu yalnızca whitecross'un **Salown booking'leri** için; kendi sitesi eski akışında kalır (~~dokunulmaz~~ → **kısmen revize 2026-07-16: deposit config'i panelden okuyacak, bkz G**), iki kanal aynı Stripe hesabını kullanır.
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

### G. Premium custom-site deposit toggle (YENİ — owner kararı 2026-07-16) · 🔵 Planlandı
> **Karar revizyonu:** Yukarıdaki "whitecross-site DOKUNULMAZ" (2026-06-24) **kısmen revize edildi.** Rails aynı
> kalır (premium tenant kendi Stripe hesabı/kanalı, us-central1, kendi key'leri) — AMA custom site artık deposit
> **on/off + tutarını hardcode etmek yerine panelden/Firestore'dan OKUYACAK.** Owner yönü: "premium üyenin zaten
> sitesi var; deposit tam OnlineProfile'ın ayarlandığı gibi tek yerden ayarlanmalı ve Stripe otomatik şekillenmeli."

**Sorun (bugünkü):** whitecross-site `script.js` deposit'i **HARDCODED** (`depositTotal = totalPeople * 10`,
`groupDepositPerPerson = 10`); Firestore `paymentMode`'u (whitecross'ta = `pay_at_venue`) **yok sayıyor** → ayar
ile canlı davranış çelişik. On/off toggle yok.

**Köprü HAZIR:** `public/booking` projeksiyonu (Tier 2 Faz 1, `2db8721` CANLI 2026-07-16) zaten
`paymentMode` + `websiteDepositsEnabled` + `defaultDepositAmount`'ı taşıyor ve premium site (public) okuyabilir.
Plumbing'in yarısı hazır — geriye custom site'ın bunu OKUMASI + Settings toggle kaldı.

**🔑 KANAL AYRIMI (owner kararı 2026-07-16, kritik):** İki booking kanalı **BAĞIMSIZ** ödeme ayarına sahip olmalı —
tek toggle ikisini birden yönetmez. Owner: "kendi sitemden deposit/full alıp salown online-profil kısmında
almak istemeyebilirim." İki kanal:
1. **Salown-hosted** (`salown.com/s/{tenant}` profil + `/book/`) — mevcut `paymentMode` + `defaultDepositAmount` (BookingPage okur).
2. **Premium custom site** (whitecrossbarbers.com tipi) — **AYRI** `sitePaymentMode` + `siteDefaultDepositAmount` (yeni; whitecross-site okur).
- **Veri modeli:** salown-side alanları AYNEN kalır (rename YOK, kırma riski yok); premium-site için yeni ayrı alanlar
  (`sitePaymentMode`/`siteDefaultDepositAmount`, veya `sitePayments:{mode,deposit}` bloğu). Her ikisi de
  `public/booking` projeksiyonuna eklenir → BookingPage `paymentMode`'u, whitecross-site `sitePaymentMode`'u okur.
- **Settings UI:** İKİ ayrı kontrol (veya kanal seçici) — owner her kanalı bağımsız ayarlar. Bir kanal deposit AÇIK
  diğeri KAPALI olabilir. (Not: premium-site kontrolü yalnız custom-sitesi olan premium tenant'a görünür.)

**Yapılacak:**
1. **Settings** — İKİ AYRI ödeme kontrolü (kanal ayrımı): mevcut "Booking policy" kartı = salown-hosted
   (`paymentMode` + `defaultDepositAmount`, B'de deployed). YENİ = premium-site kartı (`sitePaymentMode` +
   `siteDefaultDepositAmount`), yalnız custom-sitesi olan premium tenant'a görünür. Her biri bağımsız.
2. **Premium site (whitecross-site `script.js`)** — hardcoded £10 → `public/booking`'ten **`sitePaymentMode`/
   `siteDefaultDepositAmount`** oku (salown-side `paymentMode`'u DEĞİL): kapalı/`pay_at_venue` → ödeme yok,
   direkt CONFIRMED; deposit/full → config tutarı (grup için kişi-başı desteği korunur).
3. **whitecross-site `createCheckoutSession`** (us-central1, kendi fn) → `unit_amount`'ı Firestore config'ten al
   (client'ın gönderdiğine GÜVENME — server tutarın tek otoritesi; şu an `parseFloat(client) || 10` = client'a
   güveniyor, düzeltilecek güvenlik noktası).

**Owner cevapları + Booksy modeli (2026-07-16, ekran görüntüleriyle doğrulandı):**
- **(a) Tutar:** group ise **kişi-başı** (sitedeki mevcut akış aynen — `groupDepositPerPerson`). Tekli = servis kuralı.
- **(b) DEPOSIT RULE modeli — Booksy birebir (KİLİT):** ödeme politikası **kural bazlı**. Booksy'de: "No-Show
  Protection → Deposits → Rules"; her kural = **% veya £ tutar** ("client pays £X / %Y of service price upfront,
  deducted from total on checkout") + **Valid for: servis listesi** (spesifik servisler atanır; "+ Apply to
  services"). Çok kural olabilir (£10 ucuz kesimlere, £30 premium'a); atanmayan servis → deposit yok (pay-at-venue).
  - **Salown veri modeli — `tenants/{id}/depositRules/{ruleId}`** (yeni koleksiyon, world-readable, servisler gibi):
    `{ type:'percent'|'fixed', value, mode:'deposit'|'full', serviceIds:[...] }`. `full` = %100 (Booksy'de %/£ 100'e
    çekilince). Bir servis en fazla BİR kuralda (yeni kurala atama eskisinden çıkarır — Booksy davranışı).
    **Çözümleme (booking anında):** servis → içeren kural → tutar; kural yoksa → deposit yok. Servisler+depositRules
    zaten public → site **doğrudan okur** (join client'ta; ekstra projeksiyon gerekmez).
  - **% opsiyonu → "sabit £ only" kararı (2026-06-24) revize:** Booksy hem % hem £ sunuyor; biz de ikisini destekleriz.
  - **Kanal ayrımı ile birlikte:** kanal **master switch** (premium site açık/kapalı · salown-hosted açık/kapalı,
    bağımsız — `public/booking` projeksiyonunda) kanalın deposit TOPLAYIP toplamayacağını belirler; **depositRules
    PAYLAŞILIR** (aynı servis aynı tutar, kanaldan bağımsız). Kanal kapalı → o kanalda hiç deposit, kurallara bakılmaz.
- **(c) Premium gating:** ⏳ owner henüz netleştirmedi (muhtemelen Pro+ / custom-site sahibi tenant).

**UI (Booksy-benzeri):** Settings'te "Deposits" bölümü — kural listesi (`£10 · 22 Services` satırı gibi) + "Add Rule";
edit ekranı: sol %/£ + tutar stepper, sağ "Valid for" servis seç/çıkar. (Mevcut `service.depositAmount` alanı bu
modele göç eder veya kural referansı olur — geçiş kararı build'de.)

**Faz sırası (owner 2026-07-16):** ÖNCE premium custom site (whitecross-site); **SONRAKİ aşamada** aynı depositRules
**salown-hosted (online profil) booking'lerine** de. İki kanal bağımsız (master switch) → ikinci faz birinciyi bozmaz.

**⚠️ Not (2026-07-16):** ROADMAP yeniden yapılandırıldı (Employment Model teması vb.); bu spec'in ROADMAP karşılığı
tekrar bağlanmalı (S/A2 item ID'leri değişmiş olabilir).

**⚠️ Risk (🔴 canlı gelir yolu):** whitecross-site CANLI, gerçek-para aktif Stripe akışı. Deposit mantığı değişimi
= gelir yolunu değiştirmek → **owner test booking'i ŞART**, ayrı + dikkatli adım. Salown-side `features.stripe`
canlı-mode açılışıyla KARIŞTIRMA (o europe-west2 Connect, ayrı). Tier 2 Faz 2/3'ten bağımsız; owner önceliğine göre.

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

---

## Go-Live Runbook (test→live) — 2026-07-17

**Bağlam (owner 2026-07-17):** Connect kodu TEST/sandbox key'iyle uçtan uca canlı. **Mimari Connect KALIR** —
sadece deploy edilen secret'ları test→live çeviririz (kod key-agnostic). İlk gerçek live deneme =
**whitecross'un Salown online profilinden.** whitecross-site'ın kendi us-central1 ödeme kanalı bundan
BAĞIMSIZ, **dokunulmaz.** Premium site `paymentMode` deposit/full/pay-at-venue seçimi (bölüm G) **EN SONA** bırakıldı.

**Kod durumu (2026-07-17 kanıtlı):** Connect borusu TAM — onboarding (`salownConnectStart/Callback/Disconnect/Status`),
checkout (`salownCreateCheckoutSession` server-side amount), webhook (`salownConnectWebhook` PENDING→CONFIRMED +
`charge.refunded`). Mode deploy edilen `STRIPE_SECRET_KEY` önekinden türer (`index.ts:3095`). Tek eklenen kod:
**mode-mismatch guard** — live key altında test `acct_` → cryptic Stripe hatası yerine net "reconnect" mesajı
(`salownCreateCheckoutSession`; `salownConnectStatus` `modeMismatch` flag'i döner).

### 1. Ön koşul — owner Stripe Dashboard'da (LIVE mode)
1. Dashboard'u **live mode**'a al; Connect'i live'da aktifleştir.
2. Connect application → **live `client_id`** (`ca_…`) al (test'inki `ca_Uov4x…` sandbox "Turquoise Swing").
3. **Live platform secret key** (`sk_live_…`).
4. Connect application → Webhooks → endpoint ekle (LIVE):
   - URL: `https://europe-west2-havuz-44f70.cloudfunctions.net/salownConnectWebhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`
   - → live signing secret (`whsec_…`).
   - OAuth redirect URI live app'te aynı olmalı: `…/salownConnectCallback`.

### 2. Deploy (secret swap + HEDEFLİ functions deploy)
```bash
# 3 secret'ı live değerlerle set et:
firebase functions:secrets:set STRIPE_SECRET_KEY --project havuz-44f70             # sk_live_…
firebase functions:secrets:set STRIPE_CONNECT_CLIENT_ID --project havuz-44f70      # ca_… (live)
firebase functions:secrets:set STRIPE_CONNECT_WEBHOOK_SECRET --project havuz-44f70 # whsec_… (live)

# HEDEFLİ deploy — codebase prefix ŞART (blanket --only functions = us-central1 orphan siler):
firebase deploy --project havuz-44f70 --only \
functions:salown:salownConnectStart,functions:salown:salownConnectCallback,\
functions:salown:salownConnectDisconnect,functions:salown:salownConnectStatus,\
functions:salown:salownCreateCheckoutSession,functions:salown:salownConnectWebhook
```
Smoke: `salownConnectCallback` + `salownConnectWebhook` GET → HTTP 400 = canlı.

### 3. Tenant re-onboard (whitecross İLK)
- **Kritik:** test'te bağlanmış hesap test `acct_` tutar; live key ile çalışmaz. Mode-mismatch guard bunu
  "reconnect" hatasıyla yakalar (sessiz çökme değil).
- whitecross Settings → Integrations → **Disconnect** (varsa test bağı) → **Connect with Stripe** (artık live OAuth)
  → login → `stripeConnectMode:'live'` yazılır.
- `salownConnectStatus` → `chargesEnabled:true` doğrula.

### 4. İlk canlı test + açılış
1. whitecross online profilinden 1 gerçek booking → deposit/full öde (küçük tutar).
2. Webhook PENDING→CONFIRMED çevirdi mi · `paidAmount`/`remaining` doğru mu · email gitti mi — doğrula.
3. Refund testi: Stripe Dashboard'dan refund → booking `paymentState:'REFUNDED'` yansıdı mı.
4. **Ancak hepsi ✅ ise** → `features.stripe` (super-admin) whitecross için AÇIK.

### 5. Rollback
- Sorun → `features.stripe` kapat (super-admin) → booking'ler ödemesiz CONFIRMED akışına döner.
- Secret'ları test'e geri set + redeploy (kod aynı, key-agnostic).

## Riskler
- Webhook secret modeli Connect'le zorunlu değişir (per-tenant → tek platform) — dikkatli migrate.
- **Tutarı asla client'tan alma** (forge; SYSTEM_ARCHITECTURE.md:75 kuralı).
- whitecross-site'a sıfır dokunuş.
- `features.stripe = !!stripeSecretKey` mantığı (`Settings.jsx:635`) Connect'e geçince `chargesEnabled`'a bağlanmalı.

## Efor (kaba)
Faz 0-1 ~2-3 gün · Faz 2 ~2 gün · Faz 3 ~1-2 gün · toplam ~1 hafta odaklı. Acil değil; herohairs ihtiyaç doğunca başlat.
