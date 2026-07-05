# ROADMAP.md

> Format: her iş bir **durum rozeti** taşır — ✅ Done · 🟡 Kısmen · 🔵 Sıradaki · 🟣 Vizyon · 🔴 Blocker.
> Tarih vermiyoruz (eskir) — istisna: canlı doğrulama/deploy kayıtları. Test maddeleri iş listesine karışmaz → [TESTS.md](TESTS.md).
> **Son revizyon: 2026-07-02** (yeniden yapılandırıldı 07-01; C2/C2b/C2c/C5 + H teması eklendi 07-02; **G1-G4 gerçek deploy durumuna düzeltildi + SSOT protokolü eklendi 07-02**; **I teması (Güvenilirlik & Teknik Borç) + Tier 2 read:true yüzeyi eklendi 07-02, kaynak [ARCHITECTURE_REVIEW_2026-07-02.md](ARCHITECTURE_REVIEW_2026-07-02.md); H1 early-access intake ✅ CANLI `a2689f9` 07-02; H2 vetted-onboarding (demo funnel + Applications approve→provision) ✅ CANLI 07-02, INCIDENTS 2026-07-02 (claim clobber guard) eklendi**; **I2 `index.js` split planı zenginleştirildi + GATE=sonraki feature'dan ÖNCE, blocker=index.js commit'siz, 07-04**).

---

## 🔄 TEK DURUM KAYNAĞI (Single Source of Truth) — her session OKUSUN

> **Kural: bir işin GÜNCEL DURUMU sadece burada, ROADMAP.md'de yaşar.** Detay dokümanları
> (SECURITY.md, TESTS.md, INCIDENTS.md, `*_PLAN.md`) *teknik detayı* tutar — durum rozetini DEĞİL.
> Durum çelişkisi çıkarsa **ROADMAP kazanır**; detay dokümanı buraya link verir.
>
> **İş bitince (her session, istisnasız):**
> 1. İlgili maddeyi burada 🔵/🟡 → ✅ yap, yanına **commit hash** + "CANLI" yaz.
> 2. Deploy edildiyse: gerçekten `origin/main`'de mi doğrula (`git branch -r --contains <hash>`), öyle yaz.
> 3. Kod değişikliğini [edit-log-salown]/[edit-log-whitecross] memory'sine ekle (ayrı iş kaydı).
> 4. Detay dokümanına (varsa) yalnız *teknik* güncelleme; durum satırını değil.
>
> **Neden:** 2026-07-02'de G1-G4 üç dosyada üç farklı durumla duruyordu (SECURITY ✅, ROADMAP 🔴,
> TESTS çelişkili) — deploy edilmiş güvenlik açıkları "hâlâ açık" görünüyordu. Bu protokol onu önler.

---

## 📍 Nerede duruyoruz

**Proje tamamlanmak üzere — platform canlı ve gerçek kullanımda.**

- **3 tenant canlıda** (whitecross · herohairs · eekurt), hepsi Class A.
- **Gerçek dünya sinyalleri (2026-07-01):**
  - 💳 Müşteriler **loyalty puanı redeem etmeye başladı** (sistem operasyonel kullanımda).
  - ✉️ Transactional + loyalty **mailler düzenli gidiyor** (confirmation/cancel/reschedule/loyalty, `noreply@salown.com` + tenant Gmail).
  - 📅 **Website'ten booking düzenli geliyor** — her hafta, bazen günlük. Online huni çalışıyor.
- **İyi gidiyoruz.** Kalan iş "sıfırdan özellik" değil; çoğu **ölçeğe hazırlık** (güvenlik gate) + **para-almadan-önce** (plan/ödeme) + **retention derinleştirme** (kampanya backend).

**Tek gerçek kapı:** aşağıdaki **Pre-Scale Hardening Gate**. Tenant #4'ü almadan önce Tier 1 kapanmalı — pilotta zararsız kısayollar, ölçekte platform politikası olur.

### 🎯 Sıradaki oturum — ÖNCELİK (2026-07-03 sonu)
> **H4 — Parser mail girişi (parse-inbox)** öncelikli işaretlendi (kullanıcı kararı 2026-07-03). Karar verildi (ADR-015); yarın uygulamaya başlanacak.
> **Başlangıç noktası (net):** ben `salownInboundEmail` webhook'unu yazıp deploy → kullanıcıya 3 değer (webhook URL + Brevo inbound MX host + whitecross/herohairs token adresleri) → kullanıcı GoDaddy'de 1 MX (`parse.salown.com`) + Brevo Inbound Parsing + whitecross bildirim adresini token'a çevirir → whitecross'ta test.
> **Güvence:** EKLEME, değiştirme değil — eski `salownParseEmails` IMAP cron'a dokunulmaz, paralel çalışır, `externalId`+tombstone dedup çakışmayı önler, downstream trigger'lar (email/FCM/telegram) ingestion yolunu umursamaz. Deploy anında sıfır davranış değişikliği. Tenant-tenant kademeli + geri alınabilir. **I1 canary ile birlikte** kurulmalı (tek pipe = tek arıza).
> Detay: **H4** (aşağıda) + [DECISIONS.md](DECISIONS.md) ADR-015.
> *(Paralel devam: A2 Stripe Connect Faz 0 backend yazıldı, deploy kullanıcının Stripe Dashboard değerlerini bekliyor.)*

---

## 🚦 EN ÖNCELİKLİ — Pre-Scale Hardening Gate

> **Zihniyet:** "whitecross pilot, ne çalışıyorsa olur" → 1000 müşteride bu kararlar **herkesi** vurur.
> Roadmap'i feature sırası değil bir **gate** oku. Detay: memory `project-salown-prescale-hardening`, [SECURITY.md](SECURITY.md), [TESTS.md](TESTS.md) §2.
> Dış-göz teşhisi (GPT+Claude, 🔴 read:true yüzeyi + parser canary + reporting pre-agg): [ARCHITECTURE_REVIEW_2026-07-02.md](ARCHITECTURE_REVIEW_2026-07-02.md).
>
> **✅ TIER 1 GATE KAPANDI (2026-07-02 doğrulandı).** G1+G4 commit `0f8de7e` (2026-06-27) ve G2+G3
> commit `851efeb` (ruleset `22bdc429`) **`origin/main`'de + canlıda** (git ile doğrulandı). Rules'ta
> `tenantRole==null → admin` fallback'i KALDIRILDI + catch-all write→false. Test 49/49. Onboarding'i
> bloklayan yapısal açık kalmadı; kalan = takip işleri (aşağıda) + G5 (süregelen disiplin).

### ✅ Tier 1 — KAPANDI (canlı, doğrulandı 2026-07-02)
| # | İş | Durum |
|---|----|-------|
| **G1** | Rol-claim backfill — `tenantRole == null → admin` fallback'i kaldır. | ✅ **CANLI** `0f8de7e` — fallback kaldırıldı, claim'ler zaten tamdı (49/49 test). |
| **G2** | `bookings read: if true` → tenant-scoped. | ✅ **CANLI** `851efeb` (ruleset `22bdc429`) — `read: isSuperAdmin() \|\| isTenantAny`. |
| **G3** | Public create financial forge (`paidAmount`/`discount`/`tip`). | ✅ **CANLI** `851efeb` — create guard `!hasAny([...])`. |
| **G4** | staff-doc recursive catch-all (staff self-escalate). | ✅ **CANLI** `0f8de7e` — catch-all write→false + 14 koleksiyon explicit (49/49 test). |
| **G5** | Tek global ruleset blast radius → deploy disiplini (API'den çek, en son deploy, rollback hazır). | 🟡 **Süregelen** — disiplin var, yapısal çözüm yok. |

### 🔴 Tier 1 — KALAN TAKİP İŞLERİ (gate kapandı ama bunlar açık)
| # | İş | Durum |
|---|----|-------|
| **T-a1** | **Silme = super-admin only.** `AppRouter.jsx` `isSuperAdmin` prop'una hardcoded `isAdmin=true` gidiyordu → giren herkes super-admin, silme butonları herkeste. Gerçek `superAdmin` claim'ine bağlandı (`useAuth`); Clients silme gate'i `isAdmin\|\|isSuperAdmin`→`isSuperAdmin`. `auth:export` ile doğrulandı: yalnız `aerulas@` `superAdmin:true` → silme sadece onda; owner/admin/staff (Arda dahil) kaybetti (kilitlenme yok). | ✅ **CANLI** `7e95d40` (2026-07-02, push→CI). Barbers silme zaten `isSuperAdmin`. |
| **T-a2** | **Admin kontrolleri rol-bazlı.** `isAdmin` = `isSuperAdmin \|\| tenantRole in [owner,admin]` (AuthContext artık `tenantRole` claim'ini expose ediyor). Staff hesaplar (whitecrossbarbers@/muhammed) temel panele erişir ama admin ekstralarını (finansal pill, admin aksiyonları) kaybeder; sayfalar graceful degrade (gate değil). tenantRole yoksa → admin değil (G1 ile tutarlı; ⚠️ ee-kurt `cpsuk@` claim'siz → gerekirse rol backfill). | ✅ **CANLI** `643c8ce` (2026-07-02). owner/admin/super korunur. |
| **T-b** | App-password **priority-3**: client sızıntısı düzeldi (`0ebdcef`) ama `tenants/{id}/settings/emailConfig.appPassword` hâlâ düz metin, client-okunabilir. En sağlam: Secret Manager / client-okunamaz path'e taşı (parser zaten Admin SDK). **⚠️ Bkz H4** — parse-inbox modeli (A) seçilirse app-password komple kalkar → T-b **gereksizleşir**; H4 kararı beklenmeli, Secret Manager'a taşımadan önce. | 🟡 **Kısmen** — sızıntı kapalı; H4 kararına bağlı. |
| **T-c** | Auth user temizliği — KORU: `durvezek@`/`aerulas@`/`auzun9499@`; gerisi dök→CSV onay→sil. (Not: 2026-07-02 `auth:export` ile 11 hesap + claim'leri dökuldü; scratchpad'de.) | 🔵 **Sıradaki** — körlemesine silme YOK. |
| **T-d** | **Self-escalate kapatıldı:** `Settings.jsx` "Register me as owner" butonu (`registerMeAsAdmin` → caller'ın `staff/{uid}` doc'unu role:owner yazıyordu) artık `isSuperAdmin` arkasında. Legit owner bootstrap = provisionTenant/super-admin. | ✅ **CANLI** `643c8ce` (2026-07-02). |

### 🟠 Tier 2 — ölçekte patlar ama onboarding'i bloklamaz
`salownCreateBooking` transactional (double-booking race, aşağıda **C3**) · plan enforcement (aşağıda **A1**) · parser matching compound hatası · tek Firebase projesi quota/blast radius.
- **🔴-1 `read: if true` yüzeyi** (ARCHITECTURE_REVIEW): G2 sadece `bookings`'i tenant-scope'ladı; `services`/`products`/`clients` + world-readable `tenants/{id}` root doc hâlâ herkese açık okunur. 10 salonda görünmez, **1000 salonda PII enumerate + Firestore read-cost bombası** — ve tenant'lar bu davranışa güvenince geri sarması zor. Public booking sitesinin gerçekten neye ihtiyacı olduğunu ayır (public projeksiyon `tenants/{id}/public/{doc}`, bkz memory `tenant-root-doc-public`) → gerisini tenant-scope'a çek. Onboarding'i bloklamaz ama **tenant hacmi artmadan** kapanmalı.

### 🟢 Tier 3 — tenant-local, güvenli (pilot mantığı kalabilir)
Finance/partnerConfig · Muhamed wage · workingDays — tenant'ın kendi verisi, ölçek riski yok.

---

## 🔨 Sıradaki İş — temaya göre

### A · Para almadan önce (💰)

**A1 — Plan enforcement** · 🟡 **Büyük ölçüde DONE**
`plan`/`trial` alanları artık dekoratif değil. **Canlı (2026-06-30):** planLimits.js config (`0a31141`) + super-admin Plan&Trial editörü (`e2cd4b4`, admin.salown.com) + Settings.jsx FeatureLock (`8189df4`: loyalty=Pro, parsers=Pro+) + booking/ay usage nudge (`2723220`, capped planda 50-cap bar). Hepsi SOFT + pilot Pro+ muaf.
**Kalan:** Faz 4 **stylist cap** (`Barbers.jsx` — başka session'da başlandı) + hard-gate kararı (para alımı başlayınca soft→hard).

**A2 — Stripe Connect (ödeme)** · ✅ **BİTTİ — TÜM MODLAR CANLI TEST EDİLDİ (2026-07-04, TEST mode).** Owner tüm ödeme modlarını (deposit/full/optional/pay-at-venue/off) uçtan uca doğruladı: bağla→mod seç→öde→success page→CONFIRMED→staff breakdown. Ek: premium salOWN success page (animasyon+loyalty önizleme), confirmation breakdown, optional müşteri seçimi, payment-policy **onay adımı + processing→saved** (`e3221cd`). **Kalan (opsiyonel):** komisyon (`application_fee` %0 kablolu, aktivasyon), **canlı-mode açılışı** (gerçek para — Stripe live keys + owner kararı), servis-bazlı deposit editör alanı, success'e refund testi. Test matrisi: [TESTS.md](TESTS.md) §3b.
whitecross-site Stripe akışı **canlı ve doğrulandı** (2026-06-26). Webhook/cleanup/email-trigger parçaları ✅ LIVE (ama o ESKİ Payment Link modeli — Connect emekliye ayırıyor).
**Yön (2026-06-24):** salown.com/book için **Stripe Connect Standard + Direct charge** (sabit £ deposit, per-tenant policy, ödeme tarafında sıfır sorumluluk). Tam plan: [STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md).
- ✅ **Faz 0 — Connect onboarding (DEPLOYED 2026-07-04):** `salownConnectStart`/`salownConnectCallback`/`salownConnectDisconnect`/`salownConnectStatus` (OAuth; tenant secret key HİÇ tutulmaz, sadece `acct_` id) canlı europe-west2. Stripe TEST Connect app kuruldu: `client_id ca_Uov4x…`, redirect URI = callback fonksiyonu, sandbox="Turquoise Swing"/WHITECROSS BARBERS LTD. Test: [TESTS.md](TESTS.md) §3b.
- ✅ **Faz 1 — Checkout (DEPLOYED 2026-07-04, `863e3db`):** `salownCreateCheckoutSession` (public callable, tutar SUNUCUDA servis doc'undan, Direct charge `{stripeAccount}`, deposit/full per `paymentMode`, metadata=docId/tenantId/paymentType) + **`salownConnectWebhook`** (YENİ paralel webhook — tek platform key + `STRIPE_CONNECT_WEBHOOK_SECRET`; tenant'ı metadata'dan çözer, `event.account` vs stored `stripeAccountId` cross-check; `paidAmount`/`remaining`/`paymentState` yazar). Eski `salownStripeWebhook` DOKUNULMADI. BookingPage checkout-session'ı dener, başarısızsa static link'e düşer (stripe kapalıyken inert). Stripe webhook endpoint kaydı = "Connected accounts" scope, events `checkout.session.completed`+`charge.refunded` (dest `salOWN-connect` we_1TpHfU…). Deploy notu: filtre **codebase-prefix'li** olmalı → `firebase deploy --only functions:salown:salownConnectStart,...` (prefix'siz "no match" verir). Secret'lar set: `STRIPE_SECRET_KEY`(⚠️paylaşılıyor→us-central1 legacy checkout fn'leri de kullanıyor, redeploy'da bu key'i alır)+`STRIPE_CONNECT_CLIENT_ID`+`STRIPE_CONNECT_WEBHOOK_SECRET`.
- ✅ **UI (DEPLOYED 2026-07-04, `8747fea`→CI hosting):** Settings→Integrations **"Online payments"** kartı — "Connect with Stripe" (`salownConnectStart`→redirect) / yeşil "✓ Connected" rozeti + test/live etiketi + charges-enabled durumu / **Disconnect** / **mod seçici** (off/deposit/full/optional/pay_at_venue) + **default deposit £**. Kaydet → `integrations.paymentMode`+`defaultDepositAmount` yazar VE `features.stripe`/`websiteDepositsEnabled` gate'i **yalnız** connected+charges-enabled+ödemeli-modda AÇAR (BookingPage bu gate'e bakıyordu; zaten checkout-session wire'lıydı). OAuth dönüşü `?tab=integrations`→otomatik status refresh.
- ✅ **Faz 2 — Policy (DEPLOYED):** `paymentMode` per-tenant + `defaultDepositAmount`; servis-bazlı `depositAmount` override backend'de destekli (`_resolveCheckoutAmount`), servis-editörü alanı henüz opsiyonel eklenmedi (default £ yeterli).
- ✅ **Faz 3 — Refund + configurable windows (DEPLOYED 2026-07-04, functions targeted):** `salownCancelByToken` pencereyi `settings/settings.cancellationWindowHours`'tan okur (default 8) + uygun iptalde Stripe Connect refund atar (`refunds.create {stripeAccount}`, paymentState=REFUNDED). `salownRescheduleByToken` `rescheduleWindowHours` (default 2). `salownConnectWebhook` `charge.refunded`→booking'e yansıtır (Dashboard iadeleri dahil; collectionGroup `bookings.stripePaymentIntent` index deploy edildi). Pencereler owner Settings→General→"Booking policy"'den düzenlenir. Komisyon: `application_fee` kablolu, %0.
- ⚠️ `features.stripe`/`websiteDepositsEnabled` gerçek para başlayana kadar canlı-mode'da AÇMA; şu an hepsi TEST mode (Stripe sandbox). herohairs/whitecross test hesabı bağlayıp uçtan uca denenebilir.
- 🧹 **Ayrı temizlik:** `havuz-44f70`/us-central1'de 27 orphan legacy fonksiyon (migration'dan kalma, kodda yok — `createCheckoutSession`/`stripeWebhook`/`icalFeed`/`parseBookingEmails`... prefix'siz). Blanket `deploy --only functions` bunları silmeyi önerir → bilinçli, ayrı iş; eski endpoint çağrılmıyor mu doğrula.

**A3 — Product inventory / stok takibi** · 🔵 **Planlandı (temel atıldı 2026-07-03)**
Retail ürünlerde numerik stok tut, satılan üründen düş — **nereden satılırsa satılsın aynı stoğu düşer.**
- **Temel HAZIR (2026-07-03, CANLI):** "ürün satıldı"nın **tek gerçek kaynağı = `soldProducts`** (her booking taşır); `source==='Product Sale'` sadece giriş biçimi. Görünürlük hizalandı: Staff Sales ürün kartı/rozeti (`84635ed`) + Panel Sales (`Bookings.jsx`) satır rozeti + 🛍️ Products pill (`b5cebac`); Reports → products zaten sayıyordu. Böylece raporlama ↔ (gelecek) stok-hareketi **aynı alandan** beslenir, uyuşmazlık/shrinkage-denetimi mümkün.
- **Kalan iş:** (1) Product doc'a numerik `stockQty` alanı (şu an sadece `inStock` boolean — `Products.jsx`). (2) Tek `applyStockDelta(soldProducts, sign)` helper — hem `checkoutBooking` hem `createProductSale` ORTAK çağırır (kaynak fark etmez, stok her durumda düşer). (3) Geri-alma: booking edit / iade / ürün çıkarma → eski vs yeni `soldProducts` diff'le, farkı stoğa iade et (helper diff üzerine kurulursa bedava). (4) `soldProducts` satırlarında `productId` **her zaman dolu** garantisi (join key; boşsa isimle fallback riskli — bkz memory `barber-name-matching` mantığı). (5) Düşük-stok uyarısı + "out of stock" satış-anı guard'ı (opsiyonel).
- Bkz memory `salown-pos`, `reset-services`; POS/Tap-to-Pay ile aynı retail temasında.

---

### B · Booking deneyimi (📅)

**B1 — Cancel/reschedule self-service UI** · 🔵 Sıradaki (HeroHairs blocker)
Backend hazır (`salownCancelByToken` + `salownRescheduleByToken`). Email link'leri salown-hosted UI'ya yönlendirilecek.

**B2 — Booking Settings (dinamik ayarlar)** · 🔵 Planlandı
**Bağlam (2026-06-29):** müşteri reschedule barber off-gününü kontrol etmiyordu → off-güne "hayalet booking" yazıldı. **Hotfix CANLI:** server-side off-day guard (`salownRescheduleByToken`: shiftChange→workingDays→dayHours.closed) + client MiniCal off-günleri disable. **Roadmap:** bu kuralları tenant-configurable yap:
- Off-day reschedule: engelle (şimdiki) / otomatik uygun barber'a geç (whitecross-stili) / izin ver.
- Cancel & reschedule pencereleri (hardcoded 8h/2h) → ayar.
- Müşteri reschedule'da barber değişimi (`newBarberId` destekli, UI kapalı).
- Min/max ileri tarih, slot aralığı (30dk hardcoded), aynı-gün izni.
- Tüm dinamik booking ayarları Settings → Booking altına toplanacak (owner ile gözden geçir).

**B3 — `salownCreateBooking` transactional** · 🔵 Sıradaki (Tier 2)
Direkt Firestore yazımı → double-booking race window. HeroHairs trafiği artınca risk.

---

### C · Marketing & Retention (📣)

**✅ Marketing Performance card — DONE (2026-07-04, `5218d91`):** Campaigns tab headline (son 30g): recovered revenue + customers returned + coupons redeemed + avg return value + top-performing codes (redeemed/discount/net). Booking marketing-attributed sayılır (kod kullandı VEYA ziyaret öncesi re-engage maili almış); revenue = gerçek paidAmount. Vanity yok. → salOWN "email sender" değil **revenue-recovery** tarafına geçti.

**✅ Email engagement / open-click tracking — DONE (2026-07-04, `c87c883`+`7730e7f`):** Brevo'nun native open/click/unsub/bounce/spam/block event'leri `salownBrevoWebhook` ile `tenants/{id}/emailEvents`'e alınıyor (pixel'e gerek YOK — Brevo zaten izliyor). Gönderimlere `tenantId` tag'i (sendBrevoEmail) → event tenant'a atfediliyor; blocked/unsub/spam suppressed işaretleniyor. Marketing re-engagement paneli **Opened/Clicked** + **"🔥 Engaged but not returned"** (açtı/tıkladı, dönmedi → hedefli offer) gösteriyor. Full funnel: sent→opened→clicked→returned→paid. ⚠️ **OWNER SETUP (1 kez):** Brevo → Settings → Webhooks → URL `https://europe-west2-havuz-44f70.cloudfunctions.net/salownBrevoWebhook` + event'leri seç (opened/click/unsubscribed/hard_bounce/spam/blocked). O yapılana kadar emailEvents boş.

**🟡 Marketing ↔ Analytics ayrımı — SLICE 1+2 DONE (2026-07-05), slice 3 kaldı:**
- ✅ **Slice 1** (`e8e57b5`): Occupancy → `OccupancyPanel` bileşenine çıkarıldı + **Reports'a yeni tab** (self-contained: kendi bookings/barbers/hours + weeks/barber filtresi). Marketing'e dokunulmadı (additive).
- ✅ **Slice 2** (`5f4c874`): Marketing **campaigns-first** (default tab) + `occupancy` (Reports'a taşındı) ve `bookings` (Reports barbers+services kapsıyor = duplicate) sekmeleri Marketing'den kaldırıldı. ⚠️ dead render-block'lar unreachable kaldı (cleanup follow-up).
- 🔵 **Slice 3 (KALAN, owner ile):** Marketing'de `overview` + `customers` sekmeleri hâlâ duruyor çünkü Reports'ta OLMAYAN özel metrikler içeriyorlar (MoM, iptal oranları, retention, inactive 30/60/90, revenue quality, AI insights). Bunları Reports'a **porte et + iki revenue formülünü uzlaştır** (Marketing `bookingRev` gross vs Reports `bookingNetWithoutTip`/paidAmount — SSOT seç), sonra Marketing'den kaldır → Marketing = sadece campaigns. Owner canlı rakamları doğrulamalı (blind yapılmadı). Ayrıca dead occupancy/bookings kod temizliği.
- Kalan marketing derinleştirme: scheduling (C3.1), suggestion ranking (C4).

**C1 — Campaigns tab REDESIGN** · ✅ **DONE (2026-07-01, CANLI)**
Design handoff'a göre 2 aşama deploy edildi (gönderim/merge/sender-pick/birthday-guard mantığı AYNEN korundu):
- **Aşama 1** (`3e26610`): landing zone A-D (Hero + Recommended-for-you + Your campaigns geçmişi + Running automatically) + Templates library drawer.
- **Aşama 2** (`2ce03b1`): Compose 4-adım (①Who ②Write+template ③Offer ④When) + per-client drawer step-1 restyle (client-context kartı).
Detay: memory `campaigns-redesign` + `edit_log_salown`.
**✅ Re-engagement attribution (first cut) — DONE (2026-07-04, `ef7f751`):** Campaigns tab "Re-engagement results" zone — `reengagementSentAt` damgalı müşterilerden kaç kişi damga-sonrası CHECKED_OUT (döndü), return rate, revenue, kullanılan indirim + dönen-müşteri listesi. Pure client+booking join (yeni fetch yok). Zone C'nin "what came back" vaadini karşılar.

**✅ Discount codes — DONE (2026-07-04, 4 faz CANLI):** Self-managed kod sistemi, salon-içi + online AYNI kod.
- Faz1 (`3c6c81d`): `discountCodes` koleksiyonu (%/£, expiry, usageLimit, usedCount, oncePerCustomer) + `DiscountCodesPanel` (Marketing) + rules (deploy'lu, additive).
- Faz2 (`e3841f7`): salon-içi checkout promo input (`src/utils/discountCodes.js` ortak validator) → booking'e `discountCode` + usedCount++ + redemption.
- Faz3 (`c932ccf`): online — `salownCreateCheckoutSession` `promoCode` sunucuda doğrular + full price'ı düşürür; webhook redemption'ı işler. BookingPage: ödemeli modlar artık confirmation→Pay (auto-redirect kalktı, kod girişi için).
- Faz4 (`fe875aa`): `BulkCampaignPanel` gerçek-kod picker (typo-safe; e-postadaki kod garanti çalışır). Per-code "Used N" = kampanya attribution.
- ⚠️ Kalan: kod uçtan uca canlı test (oncePerCustomer/limit/expiry) + %100-off online edge (£0 Stripe session kuramaz).

**Kalan → C2/C4 (backend, faz-2, gated):**
- **Scheduling (send later)** — Compose ④ `SCHEDULING_ENABLED=false` ile kapalı; cron/queue trigger gerektiriyor (→ **C3.1** ile aynı altyapı).
- **Open-tracking pixel** — opened% için; booking-attribution first-cut ✅ yapıldı (yukarıda), open-tracking hâlâ kaldı (→ **C3.3**).
- **Suggestion ranking engine** — sayılar türetiliyor; ranking/dismiss/telemetri sonra (→ **C4** vizyon).

**C2 — Premium campaign email şablonu** · ✅ **DONE (2026-07-02, CANLI · commit `82e86d6` + functions deploy)**
Kampanya mailleri artık house-style (Manrope/Space Grotesk, gradient header, premium offer kartı, gradient CTA, salON mark footer) — eski basit dark inline HTML gitti.
1. ✅ `emailTemplates.js` → `buildCampaignHtml(d)` (gradient header tenant marka rengiyle, koşullu offer/CTA, unsubscribe footer); `sendMarketingEmail` **+** `sendCampaignBulk` (per-client + bulk) ona bağlandı.
2. ✅ GDPR opt-out guard + Unsubscribe + List-Unsubscribe header'ları — **zaten canlıydı** (önceki "deploy bekliyor" notu eskiydi). C2 ile birlikte doğrulandı.

**C2b — Compose canlı preview'u premium'a hizala** · ✅ **DONE (2026-07-02, CANLI · commit `1e81915`)**
Compose modal canlı preview'u (`BulkCampaignPanel.jsx` `previewHtml`) `buildCampaignHtml` görünümüne portlandı → WYSIWYG (owner göndermeden gerçek premium görünümü görür). Frontend-only.

**C2c — Per-client drawer preview branded + preview DRY util** · ✅ **DONE (2026-07-02, CANLI · commit `42cd5d4`)**
Per-client Send drawer'ı (`SendCampaignPanel`) da branded WYSIWYG oldu (eski düz-metin gitti; salon markası/rengi tenant doc'tan yüklenir). İki frontend preview (`BulkCampaignPanel` + `SendCampaignPanel`) tek **`src/utils/campaignEmailPreview.js`** util'ine çekildi → tekrar yok, senkron sorunu çözüldü (util = backend `buildCampaignHtml`'in aynası, "KEEP IN SYNC" yorumuyla). Per-client'ta offer/CTA yok → header+body+footer.

**C3 — Abandoned-cart "We've missed you" recovery** · 🟡 Manuel canlı, otomatik kaldı
✅ **Manuel CANLI (2026-06-27):** ödemeden giden booking'lerde (PENDING/CANCELLED + `source==='website'`) "Send 'We've missed you'" butonu → re-engagement preselect, `noreply@salown.com` + opt-out. **Kalan:**
1. **Otomatik gönderim** — terk sonrası X saat scheduled trigger (`salownCleanupExpiredPending` benzeri); tek-sefer guard + opt-out. *(C1 scheduling ile aynı motor.)*
2. **"You left something behind" formatı** — booking'e özel şablon + "Rezervasyonu tamamla" CTA. Gerektirir: booking prefill deep-link (`?service=&barber=&date=&time=`) — ⚠️ eski Stripe URL saklanmıyor + booking 15-30dk'da CANCELLED, o yüzden "aynı sayfaya dön" güvenilmez; doğru yol prefill'li akışa dönüş.
3. **Dönüş-oranı funnel** — terk eden → mail → tıklayan → tekrar booking → ödeyen. Kampanya ROI. *(C1 stats ile aynı attribution altyapısı.)*

**C4 — 🤖 Salown AI (cross-tenant veri asistanı)** · 🟣 Vizyon
Owner/super-admin doğal dille sorar, AI her tenant'ın Firestore'unu gezip derler ("bu ay kaç kişi ödemeden çıktı?", "Temmuz doğumlu kaç kişi, kampanya değer mi?"). C1 suggestion + C3 funnel bunun alt kümesi. **Parçalar:** (1) read-only tenant-scoped sorgu katmanı, (2) Claude tool-use → Firestore aggregation fonksiyonları, (3) doğal dil → metrik/tablo, (4) PII/GDPR/tenant izolasyon sınırları. ⚠️ cross-tenant erişim en hassas nokta.

**C5 — Lapsed re-engage dedup** · ✅ **DONE (2026-07-02, CANLI · commit `3c4039f` + functions deploy)**
"Re-engage" gönderilen lapsed client Home listesinde her gün tekrar çıkıyordu — çözüldü (birthday `birthdayCampaignYear` modelinin lapsed karşılığı).
1. ✅ **Backend:** `sendMarketingEmail` `campaignType === 're-engagement'` olunca client doc'a `reengagementSentAt: new Date()` yazıyor.
2. ✅ **Frontend:** `Home.jsx` `lapsedClients` son 30 gün (`REENGAGE_SUPPRESS_DAYS`) içinde `reengagementSentAt` olanı düşürüyor. (Birthday tarafının Home guard'ı da aynı commit'te canlıya gitti.)
3. ✅ **ÇÖZÜLDÜ — C5-A (2026-07-02, CANLI · commit `5fa051a` + functions deploy):** booking-only (walk-in/aggregator) müşteriler artık kapsanıyor. `sendMarketingEmail` re-engage'te `clientId` yoksa `_resolveClientDocId` (backend find-first phone→email→name, sonra create) ile doc bul-ya-da-yarat → `reengagementSentAt` oraya yazılır → kişi Home `clients` dizisine girince mevcut suppress yakalar. `SendCampaignPanel` payload'a `clientPhone`. Find-first ile duplicate dedup'lı, müşteriye otomatik gönderim yok, geri alınabilir. **Residual (küçük):** Home suppress hâlâ **isim-eşleşmeli** (aynı isim ≠ aynı kişi nüansı) — canonical identity'ye taşıma ileride; bugünkü davranıştan kesinlikle daha iyi. Aşağısı = orijinal teşhis (arşiv).
   ⚠️ (arşiv) KISITLI ETKİ teşhisi: dedup yalnızca **kayıtlı client doc'u (manualId) olan** kişilerde çalışıyordu. Kök neden: lapsed listesi **booking-türevi kimlikle** hesaplanıyor (`Home.jsx:251`, booking'lerden), canonical client doc'la değil. Stamp hem yazım (`functions/index.js:3562` `if(clientId)`, `clientId=manualId||null` `SendCampaignPanel:127`) hem Home suppress kümesi (`clients` doc dizisi) **manualId'ye bağlı**. Walk-in/aggregator müşterisi (client doc'u yok) → `clientId=null` → stamp atılmaz + suppress kümesinde bulunmaz → **her gün tekrar çıkar.** Birthday bağışık (`birthday` sadece client doc'unda → listedeki herkes manualId'li). **Şiddet tenant-tipine bağlı:** whitecross (barbershop, walk-in ağırlıklı) = çoğu lapsed etkilenir; HeroHairs (online-booking) = çalışır.
   **Tam fix — iki yol (ikisi de orta risk, ayrı iş):** (A) re-engage gönderiminde `resolveMemberDocId` (`Clients.jsx:255`, zaten var) ile booking-only kişiye client doc üret→manualId→stamp; yan etki: müşteri DB'si kurulur; risk: kusurlu eşleşmede duplicate doc. (B) client doc üretmeden canonical key'li (normalize phone/email/isim) ayrı `reengagements` koleksiyonu → Home eşleştirir; doc çoğalması yok, daha hafif. Ayrıca isim-only eşleşme (aynı isim ≠ aynı kişi) her iki yolda canonical identity'ye taşınmalı. **Paste-hazır plan (A önerili, backend find-or-create): `docs/C5_LAPSED_DEDUP_PLAN.md`.**

**C6 — Analytics'i Marketing'den AYIR (sayfa refactor)** · 🔵 Planlandı (2026-07-03)
Nav ayrımı CANLI (`0b916ef`): Sidebar'da Marketing kendi **MARKETING** başlığına alındı, ANALYTICS=Reports+Finance. **AMA sayfa içeriği hâlâ karışık:** `Marketing.jsx`'in ~%80'i aslında analytics (Overview KPI'lar, Bookings, Customers, **Occupancy heatmap**) — sadece **Campaigns** sekmesi gerçek pazarlama. `Reports.jsx` ile ciddi overlap (gelir/booking-kaynağı/barber-servis performansı iki yerde).
- **Hedef:** Marketing = **Campaigns + Occupancy** (aksiyon/pazarlama). Analytics (Reports) = tüm gelir/KPI/performans. Marketing'in Overview/Bookings/Customers sekmeleri Reports'a taşınır/birleştirilir → overlap temizlenir, kavramsal netlik.
- **Efor:** orta-büyük (ayrı iş). Dosyalar: `Marketing.jsx` (TABS ~870: overview/bookings/customers/occupancy/campaigns), `Reports.jsx` (tabs ~212), `Sidebar.jsx` (label zaten ayrık). Analiz kaynağı: bu session'ın 3-kollu taraması (memory `edit_log_salown` 2026-07-03).

---

### D · Mobil (📱)

**D1 — Capacitor / App Store** · 🔵 Sıradaki (business-critical)
iOS'ta web push çalışmıyor → barberlar push alamıyor.
```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios && npx cap init && npx cap add ios
```

**D2 — Staff App: Google/Apple sign-in + onboarding routing** · 🔵 Planlandı
Login redesign ✅ canlı (animated hub); Google/Apple butonları **görsel var ama "coming soon"**. **Parçalar:**
1. **Google provider** — Firebase Auth enable → `signInWithPopup(GoogleAuthProvider)`.
2. **Apple provider** — Apple Developer ($99/yıl): Service ID + Key + Team ID + domain → `OAuthProvider('apple.com')`.
3. **Login sonrası member-check** — OAuth user → `tenants/*/staff/{uid}` var mı? Üye→içeri, değil→onboarding.
4. **Onboarding flow (en büyük iş, henüz YOK):** **Karar (2026-06-21):** onboarding = **yeni salon açan owner** için (staff self-signup DEĞİL). Salon bilgileri → `tenants/{yeniId}` → `owner` rolü → panele düşür. Referans: `salownSelfSignup` Cloud Function.

---

### E · Yetki & Güvenlik Phase 2 (🔒)

**E1 — Rules Phase 2: delete = super-admin + cross-tenant user yönetimi** · 🟡 Kısmen (çekirdek ✅ CANLI, scale işleri kaldı)
> Phase 1 ✅ DEPLOYED (2026-06-21): cross-tenant deliği kapatıldı, `firestore.rules` canonical oldu.

Politika: `owner > admin > staff`. **Silme SADECE super-admin** (`isSuperAdmin` claim).
**✅ DONE (2026-07-02) — delete + staff-atama = super-admin only, iki katman CANLI:**
- **Rules** (`694a762`, DEPLOYED, test 65/65): tüm tenant koleksiyonlarında `write`→`create,update`+`delete`; `delete: isSuperAdmin()`. staff create/update/delete de super-admin only.
- **UI** (`7e95d40`/`643c8ce`/`851fd43`/`b20f105`): tüm delete butonları + Clients merge (drag) + Settings Staff/Danger tab'ları `isSuperAdmin` arkasına alındı. "Register me as owner" da super-admin.
- Doğrulandı: yalnız `aerulas@`=superAdmin:True → tek silebilen/atayabilen. Arda + diğer admin/owner (herohairs dahil) kaybetti (pilot kararı Seçenek a).
**Kalan (scale):** (b) owner→admin tenant-scoped yetki (herohairs owner kendi staff'ını yönetsin); (c) super-admin panelden cross-tenant staff izin yönetimi; (d) nihai: delete butonlarını tamamen kaldır. Staff App (staff.salown.com) delete parity ayrıca kontrol edilmeli.
Bkz memory `feedback-delete-superadmin-only`, `feedback-firestore-rules-safety`. *(Not: E1'in temeli olan G2/G3/G4 rules açıkları ✅ KAPANDI (`851efeb`+`0f8de7e`) — kalan E1 işi = delete'leri super-admin gate'i + owner→admin yetki UI, yukarıdaki Pre-Scale değil.)*

---

### F · Premium Themes (🎨 · gelir kalemi)

**F1 — Per-tenant public site temaları** · 🟡 Başlangıç yapıldı (lokal, deploy yok)
İki drop-in tema `style.original.css` + `style.premium.css` (champagne-gold), aynı class sözleşmesi → markup'sız geçiş. whitecross-site'ta loader + ✨ toggle. Detay: memory `project_premium_themes`.
**Yapılacak (öncelik):**
1. **Site canlı senkron** (whitecross-site): `settings/settings` onSnapshot'a `siteTheme` + `#siteTheme` href swap + localStorage (FOUC yok).
2. **Panel "Available Themes"** → `salown-app/src/pages/OnlineProfile.jsx` (barber-panel DEĞİL): tema kartları + Premium rozeti → `setDoc(...{siteTheme})`. **Premium-gated** (A1 plan enforcement ile hizalı). ⚠️ panelin kendi dark/light `ThemeContext`'inden FARKLI; public tema = `siteTheme`.
3. **Theme registry** manifesti `[{id,label,css,thumb}]` → yeni tema = dosya + satır.
4. **Subdomain teklifi (büyük, ileride):** `{tenant}.salown.com` themed public site. #10 EeKurt redirect + SalownHub DNS ile aynı altyapı ailesi.

---

### G · Küçük işler & Altyapı

**G1 — Minor** · 🔵
- EeKurt legacy site → salown subdomain redirect
- `categoryId` migration
- Dead `isStaff` Firestore rule

**G2 — SalownHub DNS** · 🔵 Phase 4
`salown.web.app/app` → `hub.salown.com`. (`salown-staff.web.app` → `staff.salown.com` ✅ aktif.)

---

### H · Onboarding & Super-Admin (🎫)

> **Durum netliği (2026-07-02):** Self-onboarding (`/signup` → `provisionTenant`) **AÇIK ve çalışıyor** — kapatılmadı, sadece görünür self-signup butonları gizlendi (H2 P1). Davetiye = üstüne konan ek kapı. Memory `keep-self-onboarding-active` hâlâ geçerli. **✅ Tüm eski blokajlar kapandı:** G1 rol-claim (`0f8de7e`), T-a `isAdmin=true` hardcode (`7e95d40`/`643c8ce`), ve davet formu/mail (H2 ✅ `ae495a1`/`57e3959`). Onboarding otomasyonu artık uçtan uca canlı.

> **✅ H1 + H2 KAPANDI (2026-07-02)** — early-access hunisi uçtan uca canlı: demo formu (tam bilgi) → `superAdmin/waitlist` → super-admin Applications sekmesi → Approve → tenant kurulur + davet maili. Self-signup butonları gizlendi (flow korundu).

**H1 — Early-access başvuru intake (inbound)** · ✅ **DONE (2026-07-02, CANLI · commit `a2689f9` + functions deploy)**
Landing formu var olmayan fonksiyona POST edip 404'ü `.catch` ile yutuyordu → başvuru kayboluyordu. **Çözüldü:** `addToWaitlist` onRequest (`functions:salown:addToWaitlist`, europe-west2, cors:true) → başvuruyu **önce** `superAdmin/waitlist/entries`'e yazar (`{email, source, status:'new', createdAt}`, email-dedup) → **sonra** best-effort Brevo bildirimi `info@salown.com`'a (mail patlasa bile kayıt durur). Frontend değişmedi (form zaten doğru URL'ye gidiyordu). Canlı test: GET→405, invalid→400, CORS preflight→204, valid→`{ok:true}`, dedup→`{duplicate:true}` ✅.
- **Küçük temizlik:** `h1-deploy-test@salown.com` (source `deploy-test`) test doc'u `superAdmin/waitlist/entries`'te duruyor — Firebase console'dan sil ya da H3 Applications sekmesi gelince yönet.
- **Sıradaki (H2):** başvuruyu okuyup onaylayan super-admin Applications sekmesi + davet-link maili.

**H2 — Davetiyeli onboarding (outbound)** · ✅ **DONE (2026-07-02, CANLI) — P1+P2+P3 hepsi canlı**
Vetted huni: millet self-signup yerine **demo talep etsin → biz bakıp onaylayalım**.
- ✅ **P1 — Self-signup kapıları gizlendi (akış korundu):** Login "Sign up free" → "Request a demo", tour.html başlığı, 11 marketing sayfasında "Apply for early access" → "Request a demo". `/signup`+`Signup.jsx`+`provisionTenant`+`OnboardingWizard` DOKUNULMADI (URL elle yazılırsa hâlâ çalışır → memory `keep-self-onboarding-active`).
- ✅ **P2 — Tam başvuru formu:** landing #waitlist email-only → business/kişi/email/telefon/adres/platform/personel/website/not. `addToWaitlist` hepsini `superAdmin/waitlist/entries`'e yazar + `info@salown.com`'a tam-detay maili (H1 fonksiyonu genişletildi). Canlı doğrulandı.
- ✅ **P3 — CANLI:** super-admin (`admin.salown.com`) **Applications sekmesi** (commit `57e3959`) → `superAdmin/waitlist/entries` listesi (New/Approved/Rejected filtre + yeni-başvuru badge) + **Approve** → `approveApplication` callable (owner auth user oluştur/bul → başvurudan tenant kur → owner claim → şifre-belirleme/davet maili Brevo) + Reject/Delete (client-write). Ayrıca super-admin **Tenant maintenance** aracı: `adminPurgeTenant` callable (inspect → backup→purge + owner auth sil).
- ⚠️ **Approve testinde 2 bug bulundu+düzeltildi (CANLI):** (a) davet maili `Domain not allowlisted` → `salown.com→salown.web.app→default` fallback; (b) **mevcut tenant hesabının claim'ini ezme** → guard eklendi (email başka tenant'a aitse approve reddeder). Detay: [INCIDENTS.md](INCIDENTS.md) 2026-07-02.
- 🟢 **Kalan (opsiyonel polish):** salown.com'u Firebase Auth Authorized domains'e ekle (davet maili branded salown.com/login linki için); test başvuru doc'ları (`h1-*`, kwolf) UI Delete ile temizlenebilir; orphan auth user `eekurtbookings@gmail.com` Console'dan silinecek (düşük öncelik).

**H3 — super-admin panel genel** · 🟡 Kısmen
Sayfalar: Overview · **Applications** (✅ H2 P3 — başvuru onay/red + tenant maintenance) · Tenants (yayın-onayı ✅ `salownReviewProfile`) · Analytics · AuditLog · Infrastructure · OnboardImport (`salownManualImport`) · Settings. **Kalan:** cross-tenant user/izin yönetimi (= **E1**), tenant metrik derinleştirme, Billing sayfası (placeholder).

**H3a — Analytics doğruluk pass'i** · ✅ **DONE (2026-06-30, CANLI · admin.salown.com)**
Analytics sayfası gerçek veriyi düzgün yansıtıyor (doğrulandı 2026-07-02: kaynak dosyalarla senkron).
- **Source breakdown** (`fb92c8b`+`88b92cc`+`d1d857c`): `normalizeSource` casing/alias kopyalarını katlıyor (website/web/direct→Website, manual/walkin→Walk-in, app→Client App, product_sale→Product Sale); Website (tenant sitesi) ↔ salOWN (salown.com/book) AYRI kalır; Blocked/Product Sale breakdown'dan düşer. Renkler `SOURCE_COLOR` = salown-app `sourceColors.js` border'larının aynısı (birebir doğrulandı).
- **MRR** (`2e04a66`): hardcoded £0 gitti → gerçek tenant `plan`+`status`'ından türer; `PLAN_PRICE {free:0,starter:29,pro:69,proplus:custom}` = `planLimits.js` aynası; yalnız `status==='active'` + sayısal fiyat sayılır (trial/Pro+ → £0, dürüst; Phase 5 billing'de gerçek paid-status).
- ⚠️ super-admin ayrı repo → import edemez, renk/fiyat **mirror**; `sourceColors.js` veya `planLimits.js` değişirse `Analytics.jsx`'i senkronla. Bkz [[edit-log-salown]].

**H4 — Parser mail girişi: parse-inbox hybrid + token izolasyon** · ⭐ **ÖNCELİK** · 🟡 webhook+izolasyon YAZILDI (`863e3db`, deploy edilmedi), **parse dispatch kaldı** · 🔴 onboarding-kritik
**Sorun:** `salownParseEmails` her tenant Gmail'ine **app-password + IMAP** (`functions/index.js:3065`) = onboarding-katili + düz-metin şifre (**T-b**) + Gmail-kilidi + Google app-password'leri kısıtlıyor.
**Karar (ADR-015):** Tenant'a **seçenek** — (önerilen) **parse-inbox** `bk_<token>@parse.salown.com`, salon bildirim adresini değiştirir ya da forward eder (+video); (fallback) mevcut app-password+video. **Boru-değil-depo:** inbound servis→`salownInboundEmail` webhook→parse→Firestore, ham mail saklanmaz.
**🔒 İZOLASYON (en kritik — "mahvoluruz" riski):** routing YALNIZ **`to:` opak-token → tenantId lookup** (`superAdmin/parseAddresses/{token}`). Token rastgele → typo/tahmin başka tenant'a **denk gelemez**; içerikten tenant çıkarma YOK; bilinmeyen token → **fail-closed** (quarantine+alarm, asla yanlış tenant'a yazma). Cross-tenant misroute **yapısal imkânsız**.
**Yapılacak:** (1) kullanıcı: mail servis (Cloudflare Email Routing öneri) + `parse.salown.com` MX + per-tenant token adres. (2) ben: ~~`salownInboundEmail` webhook + `parseAddresses` lookup + fail-closed~~ ✅ YAZILDI (`863e3db`) — izolasyon sertleştirildi: token **yalnızca teslimat alıcısından/başlıktan** okunuyor, **asla gövdeden** (gövde-enjeksiyonu misroute açığı kapatıldı); bilinmeyen token→quarantine+alarm; raw mail `parseInbox`'a stage'lenir. **KALAN = parse dispatch:** stage'lenen maili booking'e çevirmek IMAP parser'larıyla (`parseBooksy/Fresha/TreatwellForTenant`) **AYNI** kodu paylaşmalı (externalId/dedup ikiye bölünmesin) → per-mesaj mantığın IMAP döngüsünden ayıklanması, gerçek örnek maile karşı yapılmalı. (2b) **Token üretimi (super-admin) YAZILMADI:** `parseAddresses/{token}` `crypto.randomBytes` uzun-rastgele + bir token=bir tenant. (3) İlk deneme **whitecross + herohairs** (her biri AYRI token). ⚠️ tek pipe = tek arıza → **I1 canary** ✅ kuruldu. A seçildikçe **T-b buharlaşır**. **IMAP cron DOKUNULMADI — mevcut tenant'lar app-password ile çalışmaya devam.**

---

### I · Güvenilirlik & Teknik Borç (🛠️ · kaynak [ARCHITECTURE_REVIEW_2026-07-02.md](ARCHITECTURE_REVIEW_2026-07-02.md))

> Dış-göz review'ın (GPT SaaS lensi + Claude repo lensi) çıkardığı, ROADMAP'te henüz olmayan işler.
> Sıra = ROI: **I1 en yüksek** (differentiator'ı sessiz ölümden korur), sonra ucuz-borç, sonra ölçek.

**I1 — Parser sessiz-kırılma canary'si** · 🟡 YAZILDI (`863e3db`, deploy edilmedi)
`salownParseEmails` cron API entegrasyonu değil — salon Gmail'ini IMAP+regex ile okur. Booksy/Fresha email formatını değiştirirse parser **exception atmaz, sadece 0 booking import eder** → en güçlü özellik sessizce ölür, kimse fark etmez. **Yapıldı:** `recordParserRun` her kaynağın (Booksy/Fresha/Treatwell ayrı) günlük import sayısını `tenants/{tid}/parserStats/{source}`'a yazar; yeni günün ilk run'ında ÖNCEKİ tam gün 0 import ederken son geçmiş sağlıklıysa (3-gün ort ≥2) `notifyTenant` ile **alarm** verir (per-gün bir kez). Parser'ın **dönüş değerini** okur — parse davranışını DEĞİŞTİRMEZ. Deploy: functions batch ile.

**I2 — `functions/index.js` split (5562 satır, 50 export)** · 🔵 **GATE: testler/mevcut iş bitince, SONRAKİ feature'dan ÖNCE yapılır** (owner kararı 2026-07-04)
v2 functions → her export bağımsız redeploy; refactor **saf taşıma, düşük risk** — ama 2 şart var.

**🔴 Altın kural:** Firebase export **adına** göre eşler → `exports.X` isimleri + config'leri (region/secrets/schedule) **birebir aynı kalmalı**. Ad/konum değişirse Firebase "sil+yeniden ekle" sanar → trigger düşer, scheduler sıfırlanır, webhook URL kopar. Refactor'a "hazır girmişken şunu düzelteyim" KARIŞTIRMA (bug tam oradan girer; saf taşıma = sıfır davranış değişikliği).

**Plan (2 faz):**
- **Faz 1 — helper'lar → `utils/`** (düşük risk, deploy'a görünmez): tepedeki ~230 satır paylaşılan helper (telegram/email/ical/profile/bookingClass) modüllere; 50 export kıpırdamaz → Firebase'de fonksiyonlar aynı, deploy no-op-ish. Modül desenini kurar.
- **Faz 2 — fonksiyonlar → domain modülleri** (per-domain, Boy Scout): `exports.X = require('./domain/X')` (ad+config AYNI). Sıra STABİL→aktif: **ilk `ai/askAI.js`** (taşırken auth guard + tenant-scope de eklenir → tek taşta refactor+güvenlik, bkz [[project_salown_ai]] + SECURITY askAI açığı), sonra parsers/notifications/marketing; **stripe/bookings EN SON** (şu an aktif düzenleniyorlar, birinin işini bozma). Klasörleme: `bookings/ · marketing/ · notifications/ · parsers/ · stripe/ · ai/ · staff/ · clients/ · utils/`.

**Operasyon:** tek TEMİZ pencerede (index.js `git status` temizken) → diğer session'lara "commit'leyip ~30 dk durun" → tek commit → deploy **codebase-prefix'li** (`firebase deploy --only functions:salown`, ASLA blanket `--only functions` = 27 us-central1 orphan siler) → doğrula: 50 fn ACTIVE + booking-confirmation + Telegram testi.

**🔴 BLOKER (2026-07-04):** index.js şu an working-tree'de "M" (backend + başka session işi karışık, commit'siz) → refactor başlayamaz. Önce onu YAZAN session commit+push etsin (`git restore` risk'ini de kapatır). Ucuz borç ama okunabilirliği hemen açar; sonraki her iş (askAI dahil) kolaylaşır.

**I3 — Reporting pre-aggregation** · 🔵 (~100 salon, 1000'i beklemez)
`Reports.jsx` client-side aggregation yapıyor (Firestore'dan çekip tarayıcıda `reduce`). Tenant × aylık booking büyüdükçe **~100 salonda tarayıcıda çöker** (1000'e kalmaz). **Yön:** `tenants/{id}/stats/{period}` pre-aggregated doc (booking trigger'ı veya scheduled job günceller) → Reports önce onu okur. Finance (Whitecross-only, contained) bu kapsamda değil.

> **Zamanlama notları (review'dan, mevcut maddelere):**
> - **Delete-bottleneck** (`delete = super-admin only`, T-a1/E1): review bunu 1000 değil **~3. salonda** operasyonel darboğaz olarak işaretledi (her yanlış-booking silme tek kişiye düşer). E1 (b) owner→admin tenant-scoped yetki bu yüzden düşünüldüğünden erken gerekebilir.
> - **Finance hardcoded** (Tier 3): review "en büyük risk mi?" → **hayır, contained** (tek dosya/tek tenant, veri bütünlüğü tehdidi yok). Tier 3'te doğru yerde; 🔴 değil.

---

## 🧪 Test Listeleri → [TESTS.md](TESTS.md)
Tüm test kayıtları tek yerde. Kapsam: 1) Firestore Rules (otomatik, `test-firestore-rules.py`, son ✅ **49/49** — G1-G4 dahil), 2) Güvenlik gate manuel (G1–G4 ✅ CANLI), 3) Stripe canlı, 4) Staff App, 5) Post-Class-A, 6) Busy-slot v2.

---

## ✅ Tamamlananlar (arşiv)

### 🗓️ 2026-07-03 — CANLI
| İş | Detay |
|----|-------|
| **Online profil header (cover) — resize + focal-point** | `7d06c33` + `895a30a` (push→CI hosting + functions deploy). Yükleme sırasında canvas otomatik downscale (`src/utils/imageResize.js`, ~2000px/JPEG); dikey konum kaydırıcısı (`coverPosition`, projeksiyona + auto-republish); limit 2→4 MB; landing rehber "yatay/landscape". ⚠️ Tam functions deploy STRIPE_CONNECT_CLIENT_ID secret 404 (başka session) yüzünden bloktu → yalnız 3 profil fonksiyonu deploy edildi (`salownPublishProfile`/`ReviewProfile`/`RepublishProfileOnEdit`). |
| **Booking akışı reorder — tarih/saat önce, barber opsiyonel** | `94b11f9` (push→CI). `BookingPage.jsx` Servis→**Tarih→Saat→Barber(ops)**→Bilgiler (Fresha "any professional"). Müsaitlik tüm ekibin birleşimi (bir barber off olsa takvim boş görünmez); "No preference" default, atanan isim müşteriye gösterilmez ("Best available barber"). Bkz **B**. |
| **Barber "chosen vs auto-assigned" izleme + salon rozeti** | Booking doc'a `barberSelection`/`barberAutoAssigned`. salOWN (`BookingPage`) + whitecross ana site (`script.js` website tekli+grup, `ff654dff`→GitHub Pages). Salon: `BookingDetailPanel` + staff `BookingDetailSheet`'te ♥ "Requested by client" vs "Auto-assigned · free to reassign" (auto=salon serbestçe reassign edebilir). Eski booking'lerde alan yok→rozet yok. whitecross client-app DEPRECATED (kullanılmıyor, atlandı). |
| **Product-sale görünürlüğü — `soldProducts` SSOT hizalaması** | Walk-in içine satılan ürün booking'in `soldProducts`'ına yazılıyordu ama yalnız `source==='Product Sale'` yüzeyleri gösteriyordu → walk-in ürünü görünmezdi. **Staff Sales** (`84635ed`, staff.salown.com): Products stat kartı + "Products sold" kırılımı + transaction 🛍️ rozeti. **Panel Sales** (`b5cebac`, salown.com, `Bookings.jsx`): satır 🛍️ rozeti + soldProducts-bazlı "🛍️ Products" filtre pill'i. Reports→products zaten doğruydu; Dashboard denemesi geri alındı. Inventory'nin temeli (bkz **A3**). İki commit LOCAL—push edilmedi (firebase ile doğrudan deploy). |

### 🗓️ 2026-07-02 — CANLI
| İş | Detay |
|----|-------|
| **Early-access hunisi H1 + H2** | `a2689f9` (intake fix) + `ae495a1` (demo funnel + tam form) + super-admin `57e3959` (Applications sekmesi + `approveApplication` approve→provision + `adminPurgeTenant`). Self-signup butonları gizlendi (flow korundu). Bkz **H1/H2**. |
| **Approve 2 bug fix** | Davet maili domain-allowlist fallback + claim-clobber guard. Bkz [INCIDENTS.md](INCIDENTS.md) 2026-07-02. |
| **Mimari review + docs beyin sistemi** | `ARCHITECTURE_REVIEW_2026-07-02` (GPT+Claude) + ROADMAP tema I (parser canary/functions split/reporting pre-agg) + Tier 2 read:true. README/GLOSSARY/4-katmanlı hafıza (INCIDENTS/INVARIANTS/QUIRKS/DECISIONS). |

### 🗓️ 2026-06-27 → 07-01 — Son dönem (hepsi CANLI)
| İş | Detay |
|----|-------|
| **Campaigns tab REDESIGN Aşama 1+2** | `3e26610` + `2ce03b1` — landing zone A-D + Templates library + Compose 4-adım + per-client drawer restyle. Bkz **C1**. |
| **Plan enforcement Faz 1+3+5+6** | `0a31141` + `e2cd4b4` + `8189df4` + `2723220` — planLimits config + super-admin editör + FeatureLock + usage nudge. Bkz **A1**. |
| **Dashboard pill-customiser** | `23f4191` — Dashboard pill'leri strip'e taşındı. |
| **Busy-slot v2 processing-time DİNAMİK** | `f958aee` — tenant flag silindi, grid servis bazlı kurar (herohairs pilot). |
| **whitecross → noreply@salown.com** | Tüm transactional mailler + member double-points gizleme + review CTA + profil dark/light fix. |
| **Kampanya gönderen seçimi (own vs salOWN)** | `f519356` + `124321b` — "Which sender?" pop-up, premium verified-domain vs salOWN. |
| **Abandoned-cart manuel buton** | Ödemeden giden booking'de "We've missed you" → re-engagement (opt-out + unsubscribe). Bkz **C3**. |

### 🗓️ 2026-06-26 — CANLI
Finance Partner Settlement Plan A (`8fae0d8`) · Platform "Both (per booking)" (`dc1a471`) · Treatwell fee %35+VAT + Finance/Reports yansıma (`5f69f86`, `83b484c`) · Landing "OUR STORY" (`b89986d`) · Whitecross success "Add to Calendar" (`28262d9b`) · Confirmation/cancel/reschedule email 3-katman bug fix + canlı test · #7 Google review teşviki TAM KAPANDI (whitecross `googleReviews.url` doğrulandı).

### 🗓️ 2026-06-23 — CANLI
Para NaN süpürmesi (`pp()`) · Yeni müşteri email seti (5 builder) · Walk-in vs booking ayrımı (`bookingType`) · Notification politikası (tek bildirim CONFIRMED'de, spam durdu) · Yeni Settings toggle'ları · Source: Salown ≠ Website.

### 🗓️ 2026-06-21 — CANLI
🔒 Firestore cross-tenant açığı kapatıldı (fallback `isAuth`→`isSuperAdmin`, ruleset `ef31d16a`, 16/16 test) · Muhamed wage config · TEK KAYNAK `firestore.rules` · Staff App login redesign · Grid source-rengi · eekurt lingering auth + source data fix.
**Araçlar:** `test-firestore-rules.py`, `firestore.rules.LIVE`, `firestore.rules.ROLLBACK.txt`.

### Whitecross → Class A Migration — ✅ TAM
Booksy/Fresha/Treatwell parser · Loyalty email (Brevo) · Telegram + in-app notifications · Booking confirmation trigger · Cancel/reschedule email (self-service) · `cleanupExpiredPending` multi-tenant · FCM push (server + Staff App token) · barber-mobile FCM disabled.

### Platform — ✅ TAM
GDPR Firestore rules · Actor tracking · Client dedup engine · Service-eligibility no-preference assignment · BST/UK timezone · Cancel/reschedule server-side callables · Booksy SLOT tombstone + externalId dedup · Race-check at submit · White screen on deploy fix.

### Stripe Phase 5 (whitecross-site) — ✅ Canlı parçalar
`expiresAt` PENDING · `salownStripeWebhook` (LIVE) · `salownBookingConfirmedEmailTrigger` (LIVE) · Settings→Integrations→Stripe UI · E2E test butonu · Canlı test (2026-06-26). *(salown.com/book Connect akışı = A2, future.)*

### Staff App (staff.salown.com) — ✅ TAM (OAuth hariç)
Setup/Shell/Today/Sheets/Clients · Panel Parity · Launch/dark/PWA · Real-time ClientsView · Permissions (7 izin + enforcement) · Notification bell (FCM) · Reschedule · No-show · Working hours validation · Sales tab · Login redesign (LIVE).
**Kalan:** Google/Apple sign-in + onboarding → **D2** · Capacitor → **D1**.
