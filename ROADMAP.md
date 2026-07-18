# ROADMAP.md

> **Etiketler:** `✅ Done` · `🔄 In Progress` · `🔵 Planned` (kararlı, başlamadı) · `⏸ Waiting` (dış bağımlılık / bilinçli bekleme) · `💡 Future` (ölçek/yatırım sonrası) · `⚠️` (dikkat/çelişki).
> **Format:** aktif kısım = tema başlığı + tek-satır maddeler; her ✅'ün detayı/commit'i en alttaki **Completed** bölümünde. Temalar **önem sırasına** göre.
> **Son revizyon: 2026-07-16** — belge "feature list"ten "company roadmap"e yeniden yapılandırıldı: tamamlananlar Completed'a indirildi, temalar iş-alanına göre gruplandı, Employment Model birinci-sınıf tema yapıldı. Kod-doğrulamalı audit (4 paralel ajan) ile 🔵/🟡 maddeler gerçek durumlarına çekildi. Önceki uzun sürüm git geçmişinde.

---

## 🔄 TEK DURUM KAYNAĞI (Single Source of Truth) — her session OKUSUN

> **Kural: bir işin GÜNCEL DURUMU sadece burada, ROADMAP.md'de yaşar.** Detay dokümanları
> (SECURITY.md, TESTS.md, INCIDENTS.md, `*_PLAN.md`) *teknik detayı* tutar — durum rozetini DEĞİL.
> Durum çelişkisi çıkarsa **ROADMAP kazanır**; detay dokümanı buraya link verir.
>
> **İş bitince (her session, istisnasız):**
> 1. İlgili maddeyi ilgili tema altında ✅ yap + **commit hash** + "CANLI" yaz; detayı Completed'a taşı.
> 2. Deploy edildiyse gerçekten `origin/main`'de mi doğrula (`git branch -r --contains <hash>`).
> 3. Kod değişikliğini [edit-log-salown]/[edit-log-whitecross] memory'sine ekle.
> 4. Detay dokümanına (varsa) yalnız *teknik* güncelleme.
>
> **⚠️ Audit dersi (2026-07-16):** bir maddeyi "Done" işaretlemeden önce (a) **migration commit'ini değil, gerçek feature commit'ini** bul (`git log -S --follow`); (b) davranışa dayalı maddede **kod satırı ≠ çalışıyor** — sahadaki gözlemle çelişiyorsa canlı doğrulamadan kapatma (bkz G1 in-app notif). Aksi hâlde belge "geçmiş yolculuğun izini" taşır, proje o noktayı geçmiş görünür.

---

## 📍 Nerede duruyoruz

**Platform canlı ve gerçek kullanımda; proje "sıfırdan feature" fazını geçti.** Kalan iş çoğunlukla **ölçeklenme, operasyon ve ticari olgunlaşma**: staff/finansal model, ödeme canlıya alma, metrik/kanıt toplama, güvenlik gate'i, teknik borç.

- **2 tenant canlıda** (whitecross · herohairs), hepsi Class A. *(eekurt 2026-07-18 itibarıyla platformu bıraktı — inaktif; veri/rules silinmedi.)*
- **Gerçek sinyaller:** müşteriler loyalty puanı redeem ediyor · transactional+loyalty mailleri düzenli · website'ten booking düzenli geliyor · parser borusu (H4) organik mailde uçtan uca kanıtlı.
- **⚠️ Ticari not:** Stripe Connect **tamamen TEST modunda** — hiçbir tenant gerçek para almıyor. "Go LIVE" owner kararı + live keys bekliyor (Payments teması).

**Tek gerçek kapı:** Pre-Scale Hardening Gate (Security & Scale teması). Tier 1 ✅ kapandı; tenant #4'ten önce Tier 2 + takip işleri.

---

## 🎯 Şu an odak

- 🔄 **I2 Faz 2 — functions modülerleştirme** (owner seçimi 2026-07-14). Dilim 1 (askAI + auth guard) ✅ CANLI (`bccd828`). **Sıradaki dilim: parsers** (`salownParseEmails`/`salownInboundEmail`/`salownParseInboxDispatch`/`salownManualImport`/`salownIcalFeed` → domain modüllerine; 5'i de hâlâ `index.ts`'te inline, kod-teyitli). Sonra notifications → marketing; **stripe/bookings EN SON**. Altın kural: export adı+config birebir, saf taşıma, dilim başına tek commit + hedefli deploy. Detay: **Tech Debt** teması.
- 🔄 **Employment Model Faz C** (aşağıdaki tema) — owner'ın vurguladığı bir sonraki büyük modül.

---

## 👥 Employment Model & Staff Management

> **Sıradan bir "Staff" maddesi DEĞİL — salonun finansal modelini temsil ediyor.** Aynı sistemde **maaşlı + komisyonlu + chair-rent (self-employed)** çalışan bir arada yaşıyor; her birinin P&L'e etkisi bambaşka (+ UK'de self-employed≠employee yasal ayrımı). Booksy/Fresha/Treatwell'de "barber eklemek" kolay; asıl problem **employment model yönetmek**. Tasarım: [STAFF_MANAGEMENT_DESIGN.md](STAFF_MANAGEMENT_DESIGN.md). Omurga: `tenants/{tid}/staffComp/{barberId}` + append-only tarih-etkili `history[]` + "passive = comp dönemi kapalı" + salt-türetim.

- ✅ **Lifecycle** — active / leave (tarihli, otomatik döner) / passive / deleted; leave arşivi (`barber.leaves[]`), 5 yüzey tek önceliğe çekildi (override>leave>passive>workingDays), whitecross-site portu dahil. *(detay: Completed › G5)*
- ✅ **Compensation model UI (Faz B)** — Staff Hub sekmeli drawer (Profile/Availability/Pay/History), PayModelChip, 3-adım CompChangeFlow, wage periyotları hour..year + fiilî-çalışma tahakkuk semantiği, paid-leave toggle, passive=comp-dönem-kapat. Rules deploy (`1474907b`, staffComp=owner+super). *(detay: Completed › S2)*
- ✅ **Archive / snapshot güvenliği (delik 1)** — ürün satışı + blok `barberName` snapshot'lıyor (`0db230c`); silme yalnız super-admin+owner, güçlü onay modalı, `BARBER_DELETED` audit.
- 🔵 **Payroll / accrual engine (Faz C)** — wage worked-time accrual (hour..year gün/saat oranı) + paid-leave günleri normal oranla + commission booking-bazlı + chair-rent takvim tahakkuku.
- 🔵 **Settlement + Finance/Reports entegrasyonu (Faz C)** — M1 migration (partnerConfig→staffComp, dry-run CSV) · Finance staffComp'tan oku + örtük £100 fallback kaldır (parity kanıtıyla) · Balance satırı "Tracked in Finance".
- 🔵 **S1 delik 2** — Reports "Barbers" sekmesi listeyi yalnız CANLI barber'dan kuruyor (`Reports.tsx:182`) → silinen/pasif barber'ın geçmiş istatistik satırı yok oluyor. Fix: geçmiş booking isimlerini "Arşiv/eski personel" olarak dahil et. *(kod-teyitli açık 2026-07-16)*
- 🔵 **S3 Finance/Occupancy bug'ları** — (a) passive barber Finance'ta hâlâ günlük maaş tahakkuk ediyor (`Finance.tsx:265` leave var, passive filtresi YOK); (b) izindeki barber occupancy kapasite paydasında sayılıyor (`OccupancyPanel.tsx:54` `barberWorksOn` leave-check'siz). İkisi de Faz C comp motoruyla temiz çözülür. *(kod-teyitli açık 2026-07-16)*
- 🔵 **§7 emniyet fix'leri (ayrı mini-koşu)** — occupancy resolver, legacy active-okuyucular→barberStatusOf, Reports arşiv. **Keep Scope Narrow.**
- 🔵 **G5 adım 6 kalanı** — staff-app geçişi (diğer cihaz koordinasyonu); per-barber Staff Hub UI ✅ (yukarıda). §8'de 4 açık owner sorusu (kod öncesi cevaplanmalı).

---

## 🔒 Security, Scale & Pre-Scale Gate

> **Zihniyet:** "whitecross pilot, ne çalışıyorsa" → 1000 müşteride bu kararlar **herkesi** vurur. Roadmap'i gate oku. Detay: memory `project-salown-prescale-hardening`, [SECURITY.md](SECURITY.md), [ARCHITECTURE_REVIEW_2026-07-02.md](ARCHITECTURE_REVIEW_2026-07-02.md).

**Tier 1 gate — ✅ KAPANDI** (doğrulandı 2026-07-02): Gate-G1 rol-claim backfill (`0f8de7e`) · Gate-G2 bookings read tenant-scoped (`851efeb`) · Gate-G3 public-create financial forge guard (`851efeb`) · Gate-G4 staff-doc catch-all→false (`0f8de7e`). Test 49/49. + Takip: T-a1 silme=super-admin (`7e95d40`) · T-a2 admin rol-bazlı (`643c8ce`) · T-d self-escalate kapandı (`643c8ce`). *(detay: Completed › Security)*
- 🔄 **Gate-G5 blast radius** — tek global ruleset; disiplin var (API'den çek, en son deploy, rollback hazır), yapısal çözüm yok. **Süregelen.**

**Delete politikası — ✅ CANLI (E1b):** delete = `isSuperAdmin() || isOwner(tenantId)`, 10 koleksiyon (barbers dahil, güçlü onay modallı); owner yalnız kendi tenant'ında; staff/finance/settings/merge super-only (`8670051`+`2af303c`, test 83/83). *(detay: Completed › Security)*

**Tier 2 — ölçekte patlar, onboarding'i bloklamaz:**
- 🔵 **read:true yüzeyi → root doc kilidi** — asıl PII (`clients`/`products`) zaten auth-only; kalan meşru-public (`services`/`barbers`/`gallery`/…) + `tenants/{id}` root doc world-readable. **Tek iş:** `BookingPage.tsx:386` ham root yerine `public/booking` projeksiyonundan okusun (Faz 1 projeksiyon trigger + backfill ✅ `2db8721`; Faz 2 oku+fallback; Faz 3 rules `read:true`→`isTenantAny` EN SON). *(kod-teyitli: BookingPage hâlâ ham root okuyor 2026-07-16)*
- 🔵 **B3 `salownCreateBooking` transactional** — bkz Booking teması (double-booking race).
- 🔵 **A1 plan enforcement kalanı** — bkz Payments teması (stylist cap + hard-gate).

**Tier 3 — tenant-local, güvenli (contained):** Finance/partnerConfig · Muhamed wage · workingDays. *(review: "en büyük risk değil, contained"; 🔴 değil.)*

**Takip işleri (Tier 1'den kalan):**
- 🔵 **T-b app-password → Secret Manager** — `tenants/{id}/settings/emailConfig.appPassword` hâlâ düz metin, client-okunabilir (`index.ts:315` IMAP oradan okuyor). ⚠️ **H4'e bağlı** — parse-inbox modeli yerleşince app-password komple kalkar → T-b **buharlaşır**; H4 kararı beklenmeli. *(kod-teyitli: hâlâ plaintext 2026-07-16)*
- 🔵 **T-c auth user temizliği** — KORU `durvezek@`/`aerulas@`/`auzun9499@`; gerisi dök→CSV onay→sil. Körlemesine silme YOK.
- 🔵 **E1 Phase 2 scale** — owner kendi staff/barber'ını yönetsin (staff-atama hâlâ super-only) · super-admin panelden cross-tenant izin yönetimi · nihai: delete butonlarını tamamen kaldır · Staff App delete parity. ⚠️ review: delete-bottleneck 1000'de değil **~3. salonda** darboğaz.
- 🔵 **I3 reporting pre-aggregation** — `Reports.tsx` client-side aggregation yapıyor → ~100 salonda tarayıcıda çöker (1000'e kalmaz). Yön: `tenants/{id}/stats/{period}` pre-agg doc (trigger/job). *(kod-teyitli açık 2026-07-16)*
- 🔵 **I4 audit trail Faz B/C** — Faz A ✅ (staff/client, `2ab0328`). Faz B: katalog/fiyat + settings + discount codes (kod-teyitli: Services/Products/Settings/DiscountCodes `logAudit` çağırmıyor). Faz C: staff-user fn'leri, super-admin, TTL, viewer filtreleri, append-only rules. Tasarım: [AUDIT_TRAIL_PLAN.md](AUDIT_TRAIL_PLAN.md).
- 🔵 Tek Firebase projesi quota/blast radius (ölçek).

---

## 💳 Payments (Stripe Connect)

> **⚠️⚠️ TAMAMEN TEST MODUNDA — GERÇEK PARA YOK.** Tüm modlar Stripe **sandbox** ("Turquoise Swing") ile test edildi; `features.stripe`/`websiteDepositsEnabled` canlı-modda AÇILMADI. Yön: Standard + Direct charge, sabit £ deposit, per-tenant policy. Plan: [STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md).

- ✅ **A2 Connect — TEST modunda uçtan uca doğrulandı (2026-07-04):** Faz 0 onboarding (`salownConnect*`, tenant secret HİÇ tutulmaz) · Faz 1 Checkout (`salownCreateCheckoutSession` + paralel `salownConnectWebhook`, `863e3db`) · UI Settings→Integrations "Online payments" kartı (`8747fea`) · Faz 2 policy (paymentMode + defaultDepositAmount) · Faz 3 refund + configurable windows (`e3221cd`). Owner tüm modları test etti (deposit/full/optional/pay-at-venue/off). *(detay: Completed › Payments)*
- ⏸ **Go LIVE (gerçek para)** — kod tarafı HAZIR (2026-07-17, `138e8d7`): mode-mismatch guard (`salownCreateCheckoutSession` live-key altında test `acct_`'yi net "reconnect" hatasına çevirir; `salownConnectStatus` `modeMismatch` flag'i) + Settings reconnect banner + adım-adım **Go-Live Runbook** ([STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md)). Kod key-agnostic → test→live = secret-swap + hedefli functions deploy (tek blok). **Tek blokör = owner'ın live keys'i** (`sk_live_`/live `ca_`/live `whsec_`). İlk canlı deneme whitecross online profili; sonra komisyon aktivasyonu (`application_fee` %0 kablolu) + success'e refund testi. **Waiting (live keys).**
- 🔵 **Premium deposit rules (Booksy modeli) — design KESİN, build bekliyor** *(owner 2026-07-16)* — kural-bazlı: N tane deposit kuralı (`%/£` + tutar + `mode:deposit/full`) → istenen servislere atanır (`depositRules` koleksiyonu, world-readable; servis→kural çözümleme booking anında; atanmayan=deposit yok). **Kanal ayrımı:** premium custom site (whitecross-site) vs salown-hosted online-profil **bağımsız** master switch; depositRules paylaşılır. Group=kişi-başı. Server=tutar otoritesi (client'a güvenme, güvenlik fix'i). Köprü ✅ (`public/booking` `2db8721`). **Build fazları:** F1 depositRules + Settings "Deposits" UI (Booksy-benzeri, CANLI RİSK YOK) → F2 whitecross-site wiring (⚠️ **canlı-gelir-yolu, owner test-booking şart**) → F3 salown-hosted'a genişlet. Açık: premium gating (Pro+?). Spec: [STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md) §G.
- 🔵 **A1 stylist cap (plan enforcement Faz 4)** — plan enforcement büyük ölçüde ✅ (planLimits config `0a31141` + super-admin editör `e2cd4b4` + FeatureLock `8189df4` + usage nudge `2723220`, hepsi SOFT+pilot muaf). Kalan: `Barbers.tsx`'te `stylistLimitReached` helper VAR ama çağrılmıyor → cap enforce edilmiyor (kod-teyitli); + hard-gate kararı (para alımı başlayınca soft→hard).
- 🔵 **A3 product inventory / stok** — temel ✅ (`soldProducts` SSOT, `84635ed`+`b5cebac`). Kalan: numerik `stockQty` alanı (şu an sadece `inStock` boolean) + tek `applyStockDelta(soldProducts, sign)` helper (checkout+createProductSale ortak) + geri-alma diff + `productId` garanti + düşük-stok uyarısı. *(kod-teyitli: stockQty yok 2026-07-16)*
- 🧹 **Orphan cleanup** — `havuz-44f70`/us-central1'de 27 legacy fonksiyon (migration'dan, kodda yok). Blanket `deploy --only functions` bunları silmeyi önerir → bilinçli ayrı iş; eski endpoint çağrılmıyor mu doğrula.
- 🔵 **Whitecross Stripe checkout markalama** (owner istedi) — Seviye 1 Dashboard branding (owner, kod yok) · Seviye 2 küçük kod (whitecross-site `createCheckoutSession`: `product_data.images`+`custom_text`+`locale:'en-GB'`) · Seviye 3 embedded Elements → Phase 5'e ertelendi.

---

## 💰 Monetization & Self-Serve Upgrade

> **Vizyon:** tier'ı bugün **yalnız super-admin** flag'liyor; tenant kendi **Settings**'inden plan
> yükseltebilmeli ("Anthropic gibi hesap-içi upgrade"). Tier motoru (limit/feature çözümleme) hazır
> ve doğru (`planLimits.ts` tek kaynak, SOFT enforcement); eksik = **(a)** hesap-içi talep yüzeyi,
> **(b)** approve queue, **(c)** ileride gerçek tahsilat borusu. ⚠️ salOWN tenant'tan para **çekemiyor**
> (Stripe yalnız Connect/deposit + TEST modu; **abonelik borusu YOK**). Tam tasarım: [TIERS_AND_UPGRADE.md](TIERS_AND_UPGRADE.md).

- 🔵 **M1 hesap-içi upgrade (Faz 1 — request→approve, tahsilatsız)** — Settings'e **"Plan" sekmesi**
  (4 tier kartı + karşılaştırma + mevcut usage bar taşınır) + `requestPlanChange`/`decidePlanChange`
  callable'ları + **super-admin "Upgrade requests" queue** (`collectionGroup('planRequests')`). Akış:
  tenant "Upgrade" → `tenants/{id}/planRequests` doc → super-admin onaylar → flag flip + tenant e-posta.
  UX self-serve *hissettirir*, backend queue. Canlı-gelir riski YOK, enforcement SOFT kalır. Ayrı odak-günü işi.
- 🔵 **M2 Pro+ = premium website + SEO paketi** — top tier "Let's talk" kalır; `PlanFeatureFlags`'a
  **`premiumWebsite: boolean`** eklenir (proplus=true), whitecross paketini temsil eder: hosted premium
  site + custom domain + SEO (schema/meta/perf) + white-label email + öncelikli destek. Premium site
  teslimi kod değil operasyon → [Premium Themes F1](ROADMAP.md#-premium-themes-gelir-kalemi) ile aynı aile.
- 💡 **M3 gerçek self-serve Stripe *Billing* (Faz 2 — VİZYON)** — ⚠️ Connect'ten **AYRI** boru
  (Connect=müşteri deposit'i; Billing=**salOWN'un tenant'ı abonelikle ücretlendirmesi**). Bileşenler:
  Stripe Products/Prices (Starter/Pro Price ID) · `createBillingCheckout` (subscription Checkout) ·
  `billingWebhook` (lifecycle→`plan/status`, plan'in yeni otoritesi) · `createBillingPortalSession`
  (Stripe Customer Portal = "Manage billing"). Billing alanları `settings/billing` subdoc'a (root=public,
  sır koyma). Ön koşul: owner "para alıyoruz" kararı + salOWN platform-merchant Stripe + live keys.
- 💡 **M4 olgunlaşma (Faz 3)** — proration (Stripe default) · invoice/receipt e-posta · dunning
  (`payment_failed`→retry→`past_due`→grace→downgrade) · enforcement **soft→hard** (A1 stylist cap tetiği,
  para alımı başlayınca). Bugün DEĞİL.
- 💡 **M5 public pricing sayfası (Future)** — landing bugün fiyat göstermiyor (vetted "Request a demo",
  bilinçli). Self-serve tahsilat (M3) canlı + tier'lar stabil olunca `/pricing` açılır (ölü `.pricing-grid`
  CSS'i zaten `index.html:156` var); self-signup korunur (memory `keep-self-onboarding-active`). *(H3 "Billing sayfası placeholder" bu tema altına taşındı.)*

---

## 📊 Evidence & Metrics

> **Amaç:** her önemli üretim iddiası veriyle desteklensin — "çalıştığını düşünüyorum" değil "işte N aylık üretim verisi". **Operasyonel altyapı, pazarlama değil** (ağır stack YOK). ⏱ Platform+Reliability katmanları toplanmaya başlamadıkça BİRİKMEZ — bugün ölçülmeyen gün kayıp; bu yüzden EV1/EV2 küçük ama erken.

- 🔵 **EV1 parser telemetri** ⏱ — her inbound email'in parse sonucu Firestore'a kalıcı yazılsın (başarı/başarısızlık+sebep, dedup, gecikme receivedAt→parsedAt). Şu an başarısızlıklar yalnız Cloud Logging'de (~30 gün) → tarih birikmiyor. Not: `recordParserRun` günlük AGGREGATE yazıyor (I1 canary), EV1 per-email FARKLI. Küçük iş, I2'yi beklemez. *(kod-teyitli: per-email telemetri yok 2026-07-16)*
- 🔵 **EV2 health-check + uptime** ⏱ — scheduled fn kritik yüzeyleri yoklar (booking-create yolu, parser inbox, hosting 200), günlük doc'a yazar → aylık availability % kendiliğinden oluşur. INCIDENTS.md'nin sayısal kardeşi. *(kod-teyitli: health-check job yok 2026-07-16)*
- 🔵 **EV3 auto-generated METRICS.md** — script Firestore'dan business metrikleri (booking hacmi, repeat oranı, loyalty redemption, kaynak dağılımı, aktif tenant, avg spend) + EV1/EV2 birikimini snapshot'la üretir; elle sayı çürür. **Sıra: I2 Faz 2 + Tier 2 sonrası.**
- 🔵 **C7 otomasyon sonuç metrikleri** — her otomasyon kartı ("Birthday Treat", "Loyalty Boost", ileride C3) kendi sonucunu KARTIN ÜZERİNDE göstersin: **Sent / Opened / Booked (+£)**. *(kod-teyitli: kartlar en fazla "Sent" gösteriyor `Marketing.tsx:958`, Opened/Booked yok.)* İlke: yeni otomasyon Sent/Opened metriği olmadan "bitti" sayılmaz. Gate: scheduling cron (C3) + open-tracking ile aynı Faz-2 dalgası.

---

## 🎫 Onboarding, Super-Admin & Parser Pipeline

- ✅ **H1 early-access intake** (`a2689f9`) + **H2 davetiyeli onboarding** (demo funnel + Applications approve→provision, `ae495a1`/`57e3959`). Self-signup korundu (butonlar gizli, `/signup`+`provisionTenant` çalışıyor — memory `keep-self-onboarding-active`). *(detay: Completed › Onboarding)*
- ✅ **H3a analytics doğruluk** (`fb92c8b`/`2e04a66`) · **H3b owner login görünürlüğü** (`adminGetOwnerActivity`, `f4aee2b`) · **H3c parse-inbox address yönetimi UI** (`a31538f`).
- 🔄 **H4 parser mail girişi — parse-inbox hybrid + token izolasyon** · **PİLOT TAM CANLI** (2026-07-13/14): forwarding kuruldu, tam yaşam-döngüsü tatbikatı GEÇTİ (create/reschedule/chain/cancel × iki boru, sıfır çift kayıt), ilk organik müşteri maili + Fresha borusu canlıda kanıtlı. İzolasyon: token→tenant lookup, fail-closed (cross-tenant misroute yapısal imkânsız). *(detay: Completed › Onboarding)*
  - 🔵 **Kalan:** herohairs parse-inbox geçişi (token rotate ✅ `herohairs_2e1355…`, forwarding yeni adresle kurulacak) · Treatwell borusu ilk mail gözlemi · whitecross IMAP emekliliği (owner istekli — 5dk cron yükü; app-password kaldır, feature flag'lere DOKUNMA → **T-b buharlaşır**).
  - 🧹 **Ev işi:** tatbikatın UNSEEN test mailleri IMAP cron'unu 5dk'da bir aynı "not found" üçlüsünü yeniden loglatıyor (zararsız ama gürültü) → owner okundu işaretlesin YA DA parser'a terminal not-found mark-seen (out-of-order retry'ı bozmadan).
- 🔵 **H3 kalanı** — cross-tenant user/izin yönetimi (=E1) · tenant metrik derinleştirme. *(Billing sayfası → **Monetization & Self-Serve Upgrade** temasına taşındı: M1/M5.)*

---

## 📅 Booking Experience

- ✅ **B1 cancel/reschedule self-service UI** (`3d63c39`) — `/manage/{tenantId}/{bookingId}`, cancel+MiniCal reschedule, tüm tenant mailleri "Manage Booking" butonu taşıyor; owner uçtan uca test etti.
- ⚠️ **Panel in-app notification (reschedule/cancel) — KOD VAR, SAHA-ÇELİŞKİLİ, canlı test gerek.** In-app `writeNotification('cancelled'/'rescheduled')` çağrıları kodda **2026-06-05'ten beri var** (`54ee368`, `index.ts:2056/2095`, `ns.customerCancel/Reschedule` gate'li) + tıkla→booking aç bağlı (`NotificationBell.tsx:116`). AMA owner 07-13 H4 tatbikatında panelde bildirim ALMADI → git çözmüyor. **Yapılacak:** gerçek reschedule/cancel ile panelde zil çıkıyor mu canlı test — çıkarsa ✅ kapanır, çıkmazsa trigger/tetikleme bug'ı. + 🔵 kişi-bazlı bildirim tercihi (fcmToken filtresi; token doc'ları `uid`/`barberName`/`role` taşıyor).
- 🔵 **B2 booking settings (dinamik)** — cancel/reschedule pencereleri (8h/2h) ✅ CANLI Settings "Booking policy" (`Settings.tsx:1016`, `dcdf6e0`). **Kalan:** off-day reschedule davranışı (engelle/otomatik-geç/izin ver) tenant-configurable · müşteri reschedule'da barber değişimi (`newBarberId` var, UI kapalı) · min/max ileri tarih, slot aralığı (30dk hardcoded), aynı-gün izni → Settings→Booking altına topla.
- 🔵 **B3 `salownCreateBooking` transactional (Tier 2)** — booking create hâlâ direkt client-side `addDoc` (`BookingPage.tsx:659`, fail-open pre-check var ama transaction YOK) → double-booking race. HeroHairs trafiği artınca risk. *(kod-teyitli açık 2026-07-16)*
- 🔵 **B4 telefon ülke kodu standardizasyonu** (owner feedback'i var, İrlanda +353) — `COUNTRY_CODES` sadece `BookingForm.tsx:46`'da lokal (+353 YOK); diğer 4 giriş noktası serbest-metin. Telefon client-identity ana anahtarı → tutarsız kod aynı müşteriyi ikiye böler. İş: tek paylaşılan component (IE dahil) → 5 giriş noktası. *(kod-teyitli açık 2026-07-16)*
- ⏸ **B5 2-way sync / auto-block** (⭐ differentiator) — salOWN doluluğunu Booksy+Fresha'da OTOMATİK kapatsın. **Durum:** Treatwell ✅ canlı (`salownIcalFeed` iCal OUT) · Fresha ⏳ "Import from external calendar URL = COMING SOON" (yayınlanınca feed'i yapıştır, sıfır kod) · Booksy ❌ kapalı → Puppeteer-veya-kabul kararı (owner Faz 2 Playwright robotuna KARAR VERDİ, tasarım ADR'i ayrı; SINIR: yalnız dışarı-yön slot-kilitleme, İÇERİ akış her zaman parser'da). Faz 0 doğrulama sonuçları [B5 arşiv]. *(GCal köprüsü ÖLÜ — platformlar dış takvimi dinlemiyor.)*

---

## 📣 Marketing & Retention

- ✅ **Kampanya altyapısı** — C1 redesign (`3e26610`/`2ce03b1`) · discount codes 4 faz (`3c6c81d`..`fe875aa`) · re-engagement attribution (`ef7f751`) · C2/C2b/C2c premium email+preview (`82e86d6`/`1e81915`/`42cd5d4`) · C5 lapsed dedup A+B (`3c4039f`/`5fa051a`/`1bf3416`) · Marketing Performance card (`5218d91`) · email open/click tracking (`c87c883`/`7730e7f`) · C6 Marketing↔Analytics ayrımı (Marketing=`TABS=['campaigns']`, `2a2e92d`). *(detay: Completed › Marketing)*
- 🔵 **C3 abandoned-cart otomatik** — manuel "We've missed you" butonu ✅ CANLI. Kalan: terk sonrası X-saat scheduled trigger (tek-sefer guard + opt-out) · "You left something behind" prefill deep-link şablonu · dönüş-oranı funnel. *(kod-teyitli: yalnız manuel `sendAbandonedCart` onCall, scheduled yok.)* Motor C7/C3.1 scheduling ile ortak.
- 🔵 **C8 audience scope** — kampanyaya `audienceScope` (Clients default / Members / Everyone) + server-side member guard (`sendCampaignBulk`'ta YOK, `index.ts:2290`) + kategori kütüphanesi + founding-clients segmenti. Member'lar client promolarını alıyor (sızıntı kampanya katmanında). Spec: [CAMPAIGNS_V2.md](CAMPAIGNS_V2.md). *(kod-teyitli açık 2026-07-16)*
- 🔵 **C9 client kartı redesign** — Faz 1 ✅ CANLI (lifetime puan-harcama görünürlüğü + trusted client flag, `70247f0`). Faz 2: kart full-height premium drawer, hero header + inline edit (owner Claude Design ile yaptıracak → onay sonrası kod). Spec: [CLIENT_CARD_V2.md](CLIENT_CARD_V2.md).
- 🔵 **Slice 3b kalanı** — (1) Revenue SSOT: OverviewPanel gross `bookingRev` vs Reports net/paidAmount tek kaynağa indir (Finance ile tut) *(kod-teyitli: OverviewPanel hâlâ bağımsız `bookingRev()` `OverviewPanel.tsx:48`)*; (2) tasarım polish (iki-kolon, rakamlar/% daha belirgin).
- 🔵 **Discount codes kalanı** — kod uçtan uca canlı test (oncePerCustomer/limit/expiry) + %100-off online edge (£0 Stripe session).

---

## 🤖 AI

- ✅ **C10 salOWN AI doğruluk paketi + ürün-bilgisi** — buildContext DAILY TOTALS + DEFINITIONS, sohbet geçmişi, askAI auth guard (`1bd0885`/`695a61f`); `functions/src/ai/productGuide.ts` sitemap+~18 how-to (`58668af`). Bakım kuralı: user-visible feature çıkınca productGuide.ts'e satır ekle + askAI hedefli deploy. *(detay: Completed › AI)*
- 🔵 **C10 kalanı** — feature-flag farkındalığı + tool-use → C4. *(kod-teyitli: productGuide statik string, tool-use yok.)*
- 💡 **C4 Salown AI (cross-tenant veri asistanı)** — owner/super-admin doğal dille sorar, AI her tenant'ın Firestore'unu gezip derler. Parçalar: read-only tenant-scoped sorgu katmanı · Claude tool-use → aggregation fn'leri · NL→metrik/tablo · PII/GDPR/tenant izolasyon. ⚠️ cross-tenant erişim en hassas nokta. C1 suggestion + C3 funnel alt kümesi.

---

## 📱 Mobile (Staff App)

- ✅ **Staff App çekirdek** — D3 mobil stabilite (`4f1bd13`) · D4 modernizasyon: hız+haftalık+ikon sistemi+gün-kaydırma (`e3f3e9f`) · D5 walk-in Booksy-sepet redesign + iOS drift kök-fix (`7f46858`) · D7 haftalık program Day|Week (`20a3bcb`). Ayrıca: Setup/Shell/Today/Sheets/Clients/Sales/Reschedule/No-show/WorkingHours/Notification-bell hepsi ✅. *(detay: Completed › Mobile + Staff App)*
- 🔵 **D0 hardening kalanı** — push sessiz-hata (T2-7: FCM init try/catch var ama UI'a yansımıyor, `StaffApp.tsx:159`) · reschedule saat-guard (RescheduleSheet conflict-guard var ama açılış-saati guard'ı YOK, `RescheduleSheet.tsx:141`) · boş-durum/erişim mesajı · sessiz-hata yutma. Tam rapor: [STAFF_APP_HARDENING.md](STAFF_APP_HARDENING.md). *(kod-teyitli 2026-07-16.)*
- 🔵 **D2 Google/Apple sign-in + onboarding routing** — butonlar "coming soon" görsel (`LoginScreen.tsx:113`, provider wire YOK). Parçalar: Google provider · Apple ($99/yıl Service ID) · login-sonrası member-check · onboarding flow (yeni salon açan owner için, en büyük iş). *(kod-teyitli açık 2026-07-16)*
- 🤔 **D6 mobil katalog (karar bekliyor)** — telefondan yeni servis/barber ekleme yapılsın mı, yoksa panel-only mi? Owner erteledi (2026-07-16). Yapılırsa: "+" FAB → ekle-menüsü (Walk-in/Yeni servis[ad+fiyat+süre+kategori]/Yeni barber[ad+renk]), schema parity. *(kod-teyitli: staff app'te add-service/barber UI yok — doğru.)*
- ⏸ **D1 Capacitor / App Store** — iOS web push çalışmıyor → native wrap çözer. **HAZIR BEKLİYOR, acele YOK** (owner 2026-07-14: "app'in üzerinden daha çok geçmemiz lazım"). Hazırlık ✅ (D4 SVG ikon + D5 viewport fix "Capacitor-safe"). Plan: [D1_CAPACITOR_NATIVE_PLAN.md](D1_CAPACITOR_NATIVE_PLAN.md); ön koşul $99/yıl Apple+Mac+APNs. **Waiting.**

---

## 🛠️ Tech Debt & Reliability

- ✅ **TypeScript migration — v1.0.0 TAG'LENDİ (2026-07-13)** — codebase uçtan uca STRICT TS (frontend 1400→0, functions 355→0, bayt-kanıtlı). Post-1.0 ev işleri (release-blocker DEĞİL): ölü-kod chore (beklemede), any-daraltma, I2 split. Kalıplar: [MIGRATION_PATTERNS.md](MIGRATION_PATTERNS.md), [ARCHITECTURE_V2.md](ARCHITECTURE_V2.md). *(detay: Completed › Reliability)*
- ✅ **I1 parser sessiz-kırılma canary** — `recordParserRun` İKİ boruda da (`tenants/{id}/parserStats/{source}`, günlük sayaç + 0-import alarmı).
- 🔄 **I2 `functions/src/index.ts` split** — Faz 1 (helpers→domain modülleri) ✅ fiilen bitti (parity testli). Faz 2: 55 export'un gövdesini domain modüllerine taşı (index.ts 3816 satır). Dilim 1 (askAI+auth) ✅ `bccd828`; **sıradaki parsers** (bkz Şu an odak). 🔴 Altın kural: export adı+config birebir. Operasyon: tek TEMİZ pencerede, codebase-prefix'li deploy (`--only functions:salown`, ASLA blanket). Plan: [TYPESCRIPT_MIGRATION_PLAN.md](TYPESCRIPT_MIGRATION_PLAN.md).
- 🔵 **G3 unsaved-changes guard'ları** — backdrop/Esc/✕ ile formlar sessizce veri kaybediyor. Altın standart WalkInForm'da (dirtyRef) → ortak `ConfirmDiscard` bileşeni. F1 (6 yüzey): Products · AddClientModal · Clients edit · BookingForm · BulkCampaign Compose · SendCampaignPanel. F2: CheckoutPanel/Settings. F3: staff app Sheet'leri. *(kod-teyitli: 0/6 yüzeyde guard var 2026-07-16)*
- 🔵 **salOWN ToS/Privacy sayfaları** — landing footer Terms/Privacy `href="#"` ölü (`hosting/index.html:648-649`); salOWN'un kendi ToS/Privacy sayfası YOK (whitecross tenant tarafı ✅). Tenant onboarding ölçeklenmeden yazılmalı (SaaS ToS + GDPR privacy + loyalty çerçeve). *(kod-teyitli açık 2026-07-16)*
- 🔵 **Küçük infra** — G2 SalownHub DNS (`salown.web.app/app`→`hub.salown.com`) · ~~EeKurt legacy site redirect~~ (tenant inaktif 2026-07-18, düştü) · `categoryId` migration · dead `isStaff` Firestore rule.

---

## 🎨 Premium Themes (gelir kalemi)

- 🔵 **F1 per-tenant public site temaları** — iki drop-in tema (`style.original.css`+`style.premium.css`) lokal, **deploy YOK**. Kalan: site canlı senkron (whitecross-site `siteTheme` onSnapshot+href swap) · panel "Available Themes" (`OnlineProfile.jsx`, Premium-gated) · theme registry · *(kod-teyitli: OnlineProfile'da theme picker yok; whitecross-site hardcoded DEFAULT_THEME.)* Detay: memory `project_premium_themes`.
- 💡 **Subdomain temalı siteler** — `{tenant}.salown.com` themed public site (SalownHub DNS ile aynı altyapı ailesi).

---

## 🏪 Marketplace & Discovery

- 💡 **J1 Trust Score — outcome-based salon ranking** · 🕓 Vizyon kilitli (ADR-016, marketplace fazı başlayınca açılır). salown.com consumer marketplace'inde sıralama iç Trust Score ile (verified CHECKOUT, repeat-client, no-show davranışı, rating tutarlılığı, longevity…). İlke: "reward outcomes, not activity" — Fresha sahte-booking gaming'ine yapısal panzehir. Skor iç kullanım. Spec: [DECISIONS.md ADR-016](DECISIONS.md).

---

## 🧪 Test Listeleri → [TESTS.md](TESTS.md)
Tüm test kayıtları tek yerde: Firestore Rules (otomatik, son ✅ 95/95) · Güvenlik gate manuel · Stripe canlı (TEST) · Staff App · Post-Class-A · Busy-slot v2.

---

# ✅ Completed (arşiv)

> Aktif temalardaki her ✅'ün detayı + commit'leri burada; en altta tarihli dated tablolar.

### 🔒 Security & Rules
Tier 1 gate: Gate-G1 rol-claim (`0f8de7e`, `tenantRole==null→admin` fallback kaldırıldı, 49/49) · Gate-G2 bookings read tenant-scoped (`851efeb`, ruleset `22bdc429`) · Gate-G3 public-create financial forge guard (`851efeb`) · Gate-G4 staff-doc catch-all→false + 14 koleksiyon explicit (`0f8de7e`). Takip: T-a1 silme=super (`7e95d40`, AppRouter hardcoded `isAdmin=true` gerçek claim'e bağlandı) · T-a2 admin rol-bazlı (`643c8ce`, AuthContext tenantRole expose) · T-d self-escalate super arkasında (`643c8ce`). Delete=super/owner: `694a762` (super-only, 65/65) → E1b owner tenant-scoped (`8670051`, ruleset `1a818130`, 81/81, 9 koleksiyon) → E1b+ barbers (`2af303c`, 83/83) + güçlü onay modalı + '✓ Activate' (`25e6407`). Phase 1 cross-tenant açık (`ef31d16a`, 16/16, `firestore.rules` canonical).

### 👥 Employment Model & Staff (S + G4 + G5)
S2 Faz B: Staff Hub UI 12 commit (`c1103af..b7208a7`) + rules deploy (ruleset `1474907b`, staffComp=owner+super, 95/95) — sekmeli drawer, PayModelChip, CompChangeFlow, wage hour..year + fiilî-çalışma accrual semantiği, paid-leave toggle, passive=comp-dönem-kapat, compUtils/staffCompActions unit-testli (59/59). S1 delik 1 barberName snapshot (`0db230c`). G4 haftalık wages ledger (`1405020`, Pzt–Paz devirli defter, salt-türetim, Arda £87-devir doğrulandı). G5 staff availability overhaul (owner "tam kaos"): 2a-ek public projeksiyon `salownRepublishOnSettingsEdit` (`81f2824`) · 2a resolver shiftChange override (`282e5ae`) · 2b+3 Dashboard/BookingPage leave (`ca82f76`, izin bitince otomatik döner) · adım 4 server reschedule leave-guard (`2af65a0`) · adım 5 semantik birleştirme OVERRIDE KAZANIR 5 yüzey (`e68dca8`) + Finance günlük P/L leave-guard (`4b7b592`) + leave-history arşivi `barber.leaves[]` (`3898eb0`) · whitecross-site resolver portu (`bc2f98ef`) · cycleStatus leave koruması + audit (`b582042`). Muhamed on-leave vakası [STAFF_SETTINGS_AUDIT.md](STAFF_SETTINGS_AUDIT.md).

### 💳 Payments (A2, TEST mode)
Faz 0 onboarding `salownConnect{Start,Callback,Disconnect,Status}` (OAuth, tenant secret HİÇ tutulmaz, sadece `acct_`) · Faz 1 Checkout `salownCreateCheckoutSession` + paralel `salownConnectWebhook` (`863e3db`, tutar sunucuda, Direct charge, cross-check) · UI "Online payments" kartı (`8747fea`, mod seçici + default deposit £ + gate) · Faz 2 policy · Faz 3 refund + configurable windows (`e3221cd`, `cancellationWindowHours`/`rescheduleWindowHours`). Owner tüm modları TEST'te uçtan uca doğruladı (2026-07-04). whitecross-site eski Payment Link modeli (Phase 5) canlı ama Connect emekliye ayırıyor.

### 📣 Marketing
C1 redesign Aşama 1+2 (`3e26610`/`2ce03b1`, landing zone A-D + Templates + Compose 4-adım) · re-engagement attribution (`ef7f751`) · discount codes 4 faz (`3c6c81d`/`e3841f7`/`c932ccf`/`fe875aa`, salon-içi+online aynı kod) · C2 premium campaign email (`82e86d6`) + C2b compose preview (`1e81915`) + C2c per-client preview DRY util (`42cd5d4`) · C5 lapsed dedup (`3c4039f`) + C5-A booking-only (`5fa051a`) + C5-B bulk damga (`1bf3416`) · Marketing Performance card (`5218d91`, recovered revenue/returned/redeemed) · email open/click tracking `salownBrevoWebhook`→`emailEvents` (`c87c883`/`7730e7f`) · Marketing↔Analytics ayrımı Slice 1 Occupancy (`e8e57b5`) + Slice 2 campaigns-first (`5f4c874`) + Slice 3a Customers→Reports (`b9c5b2e`) + Slice 3b Overview→Insights, Marketing=campaigns (`5744937`, C6 fiilen tamam) + client-identity SSOT (`eca8cc8`) + filtre-scope netliği (`1fb9b28`) + orphan helper cleanup (`28bf376`). C9 Faz 1 client kartı lifetime+trusted (`70247f0`).

### 🤖 AI
C10 doğruluk paketi buildContext DAILY TOTALS+DEFINITIONS + sohbet geçmişi + askAI auth guard (`1bd0885`/`695a61f`) · productGuide.ts sitemap+how-to (`58668af`).

### 🎫 Onboarding & Parser Pipeline (H)
H1 `addToWaitlist` intake (`a2689f9`) · H2 P1 self-signup gizle + P2 tam form + P3 Applications sekmesi `approveApplication`+`adminPurgeTenant` (`ae495a1`/`57e3959`) + approve 2 bug fix (domain fallback + claim-clobber guard, INCIDENTS 07-02) · H3a analytics doğruluk source/MRR (`fb92c8b`/`88b92cc`/`2e04a66`) · H3b owner-activity `adminGetOwnerActivity` (`5fb26e9`/`f4aee2b`/`b424aeb`) · H3c parse-inbox address UI (`a31538f`). H4 pilot: parse dispatch `salownParseInboxDispatch` + `messages.test.js` fork-yok (41/41, `c944b28`) + DNS+Brevo inbound webhook + token'lar (`1183f50` named token `<slug>_<32hex>`) + zarf-öncelikli routing fix (`0b829ba`) + tam yaşam-döngüsü tatbikatı GEÇTİ + ilk organik mail + Fresha borusu kanıtlı.

### 📱 Mobile & Staff App
D3 mobil stabilite 3-katman clamp (`4f1bd13`) · D4 modernizasyon hız+Week sekmesi+Icon.tsx 28 SVG+gün-kaydırma (`e3f3e9f`) · D5 walk-in Booksy-sepet WalkInFlow+orphan fix+iOS viewport kök-fix (`7f46858`) · D7 haftalık program Day|Week WeekScheduleGrid (`20a3bcb`). Staff App TAM (OAuth hariç): Setup/Shell/Today/Sheets/Clients · Panel Parity · Permissions (7 izin) · Notification bell (FCM) · Reschedule · No-show · WorkingHours validation · Sales · Login redesign.

### 🛠️ Reliability
TS migration v1.0.0: rc3 src→lib pipeline (`73ce8f8`, `v0.9.0-rc3`, 52/52 fn) → functions %100 TS (`7881cfe`) → strict her yerde functions 355→0 (`71312de`) + frontend 1400→0 (`eb348b7`), bayt-kanıt v2. I1 canary `recordParserRun`. I4 Faz A staff/client audit (`2ab0328`).

### 🔧 Infra (G)
Email observability stamp'ler (`56c8e5e`, confirmation/reschedule/cancellation EmailSentAt) · `dailyFirestoreBackup` düzeltildi + 30-gün lifecycle + failure-alarm (`740916b`, INCIDENTS 07-13) · www.whitecrossbarbers.com→apex 301 + GH Pages kapanışı · confirmation email buton email-safe table (`0d974f3`) + week-view source etiketi + staff push Londra tarihi · bounce-checker fix (`62d79fe3`) · G6 landing mobile (`288e566`) · loyalty legal terms no-cash-value (`2636d24` + whitecross `terms.html`).

---

### 🗓️ Dated arşiv

**2026-07-13** — Loyalty programı yasal şartları (no-cash-value): emailTemplates (`2636d24`) + whitecross terms.html/loyalty.html.

**2026-07-03** — Online profil header resize+focal-point (`7d06c33`/`895a30a`) · Booking akışı reorder (Servis→Tarih→Saat→Barber-ops, `94b11f9`) · Barber chosen-vs-auto izleme + salon rozeti · Product-sale görünürlüğü soldProducts SSOT (`84635ed`/`b5cebac`).

**2026-07-02** — Early-access hunisi H1+H2 (`a2689f9`/`ae495a1`/`57e3959`) · Approve 2 bug fix · Mimari review + docs beyin sistemi (ARCHITECTURE_REVIEW + tema I + README/GLOSSARY/4-katman hafıza).

**2026-06-27→07-01** — Campaigns redesign Aşama 1+2 (`3e26610`/`2ce03b1`) · Plan enforcement Faz 1+3+5+6 (`0a31141`/`e2cd4b4`/`8189df4`/`2723220`) · Dashboard pill-customiser (`23f4191`) · Busy-slot v2 processing-time dinamik (`f958aee`) · whitecross→noreply@salown.com · Kampanya gönderen seçimi (`f519356`/`124321b`) · Abandoned-cart manuel buton.

**2026-06-26** — Finance Partner Settlement Plan A (`8fae0d8`) · Platform "Both per booking" (`dc1a471`) · Treatwell fee %35+VAT (`5f69f86`/`83b484c`) · Landing "OUR STORY" (`b89986d`) · Whitecross success "Add to Calendar" (`28262d9b`) · Confirmation/cancel/reschedule email 3-katman fix + canlı test · Google review teşviki.

**2026-06-23** — Para NaN süpürmesi (`pp()`) · Yeni müşteri email seti (5 builder) · Walk-in vs booking (`bookingType`) · Notification politikası (tek bildirim CONFIRMED) · Yeni Settings toggle'ları · Source Salown≠Website.

**2026-06-21** — 🔒 Firestore cross-tenant açığı kapatıldı (`ef31d16a`, 16/16) · Muhamed wage config · TEK KAYNAK `firestore.rules` · Staff App login redesign · Grid source-rengi · eekurt lingering auth fix. Araçlar: `test-firestore-rules.py`, `firestore.rules.LIVE/ROLLBACK`.

**Whitecross → Class A Migration ✅ TAM** — Booksy/Fresha/Treatwell parser · Loyalty email (Brevo) · Telegram+in-app notifications · Booking confirmation trigger · Cancel/reschedule email · `cleanupExpiredPending` multi-tenant · FCM push.

**Platform ✅ TAM** — GDPR rules · Actor tracking · Client dedup engine · Service-eligibility no-preference · BST/UK timezone · Cancel/reschedule server-side callables · Booksy SLOT tombstone+externalId dedup · Race-check at submit · White screen on deploy fix.

**Stripe Phase 5 (whitecross-site) ✅ Canlı parçalar** — `expiresAt` PENDING · `salownStripeWebhook` · `salownBookingConfirmedEmailTrigger` · Settings→Integrations→Stripe UI · E2E test · Canlı test (2026-06-26). *(salown.com/book Connect akışı = Payments teması.)*

---

### 📎 B5 Faz 0 arşiv (2-way sync doğrulama)
❌ İki platform da dış takvimi CANLI dinlemiyor (Booksy/Fresha sync yalnız DIŞARI) → GCal köprüsü (Faz 1) ÖLÜ. 🎯 Fresha "Import events from external calendar URL = COMING SOON" (birincil kaynak, owner panelden gördü) → yayınlanınca `salownIcalFeed?tenantId=X` yapıştır = sıfır kod. Booksy verdiği yok → Puppeteer-veya-kabul. Yan kazanım: Fresha EXPORT feed alındı (`integrations.freshaIcalExportUrls`, parser çapraz-kontrol adayı). Booksy robotu KARARI: owner onayladı (yalnız dışarı-yön, Secret Manager, dar yetki, audit, kill-switch, izole Cloud Run; İÇERİ akış her zaman parser'da).
