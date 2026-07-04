# TESTS.md — Tüm test kayıtları (tek kaynak)

> **Amaç:** Yapılacak/yapılan tüm testler tek yerde. Daha önce ROADMAP.md içine dağılmıştı;
> "şu test yapıldı mı?" diye her seferinde aramamak için buraya toplandı. Her bölüm ayrı
> zamanda ele alınabilir — durum kutucukları (`[ ]`/`[x]`) güncel tutulur.
>
> **Kategoriler:** 1) Firestore Rules (otomatik) · 2) Güvenlik gate manuel · 3) Stripe canlı ·
> 4) Staff App · 5) Post-Class-A migration · 6) Busy-slot v2 (ayrı doc).

---

## 0. 🔥 ÖNCELİKLİ — Abandoned-cart "We've missed you" + Marketing email teslimatı (2026-06-26)

> Kod hazır, build ✓. **A (app)** = `BookingDetailPanel.jsx` butonu (main push → CI hosting). **B (functions GDPR)** = `sendMarketingEmail` opt-out+unsubscribe (`firebase deploy --only functions`). Aşağıdaki opt-out/unsubscribe maddeleri **B deploy edilmeden geçmez**.

**Ön koşul:**
- [ ] Test edilen tenant'ta `tenants/{tid}/settings/emailConfig` dolu (Gmail `email` + `appPassword`). whitecross'ta dolu (booking confirmation'ları aynı creds ile gidiyor).

**Mevcut akış — "email gerçekten gidiyor mu?" (B deploysuz da test edilebilir, CANLI):**
- [ ] Marketing → Campaigns → `re-engagement` şablonu oluştur (name/subject/message, `{name}` içersin).
- [ ] Clients → email'i olan bir müşteri → "Send campaign" → re-engagement → şablon seç → Send. **Gerçek email müşteriye ulaşıyor mu** (salon Gmail'inden, "via Salown")?
- [ ] Boş email'li müşteride buton/gönderim "No email address" ile engelleniyor mu?

**YENİLENDİ 2026-06-30 — "Finish your booking" butonu (direct-send, commit 870c46d, DEPLOYED):**
> Eski "We've missed you" → "Send 'Finish your booking'" olarak yeniden adlandırıldı ve artık `SendCampaignPanel`/generic re-engagement YERİNE özel `sendAbandonedCart` callable'ı + `buildAbandonedCartHtml` ("Your spot is still warm") email'ini **tek-tıkla** gönderiyor.
- [ ] Webden ödemeden gidmiş booking (PENDING veya CANCELLED + `source==='website'` + email var) açılınca panelde **"Send 'Finish your booking'"** butonu görünüyor.
- [ ] Walk-in / staff-created / email'siz booking'lerde buton **görünmüyor**.
- [ ] Butona basınca **anında** gidiyor (panel açılmıyor) → toast "Recovery email sent".
- [ ] Ulaşan email: "Still want that fresh cut?" + "You were booking" kartı + tek CTA **"Book My Slot →"** → `salown.com/book/{tenant}?service=<id>` (servis önden seçili açılıyor) + "No deposit — pay at the salon" + footer'da Unsubscribe.
- [ ] **GDPR:** opt-out etmiş müşteriye (`client.emailOptOut===true` veya `emailOptOuts/{email}`) → email GİTMİYOR, toast "Client opted out". Ulaşan emailde Unsubscribe + `List-Unsubscribe` header var.

**YENİ 2026-06-30 — Appointment reminder (commit 870c46d, DEPLOYED):**
> `salownSendReminder` callable + `buildReminderHtml` ("See you soon"). Email müşterinin CİHAZ temasına göre otomatik light/dark (`prefers-color-scheme`; Gmail'de light fallback).
- [ ] CONFIRMED + email'li + randevuya **≤2 saat** kalan booking açılınca panelde 🔔 **"Send reminder email"** butonu görünüyor.
- [ ] Randevuya >2 saat / geçmiş / email yok / CONFIRMED değil → buton **görünmüyor**.
- [ ] Butona basınca anında gidiyor → toast "Reminder sent"; email'de tarih/servis/barber/lokasyon/fiyat + "Manage Booking" + hoursUntil ("in about 2 hours") doğru.
- [ ] **Dark mode:** koyu temalı cihazda/Apple Mail'de email koyu render oluyor (zemin/kart/metin); Gmail web'de light.
- [ ] (Mevcut WhatsApp "Send Reminder" butonu ayrı kanal, etkilenmedi.)

---

## 1. Firestore Rules — OTOMATİK (`docs/test-firestore-rules.py`)

Emulator/Java GEREKMEZ; Firebase Rules Test API kullanır (token: firebase-tools login).
```bash
python3 docs/test-firestore-rules.py salown-app/firestore.rules
```

**Son çalıştırma: 2026-06-27 → ✅ 49/49 geçti** (G2 + G3 + G1 + G4 dahil; mock token'lara `tenantRole` eklendi).

Kapsanan davranışlar (her rules değişikliğinden SONRA + deploy'dan ÖNCE çalıştır):
- Cross-tenant izolasyon (WX→HERO read/write/deep/delete → DENY) — Phase 1
- Same-tenant akışlar (booking create, checkout update, clients write, deep campaignsSent, Settings tenant-root write → ALLOW)
- Public/unauth (booking create ALLOW, services read ALLOW, cancel-update-only-status ALLOW, forbidden-field-update DENY)
- Super-admin (cross-tenant ALLOW, top-level fallback ALLOW; tenant user top-level → DENY)
- **[G2]** unauth booking read DENY · WX kendi read ALLOW · cross-tenant read DENY · super ALLOW
- **[G3]** unauth create + paidAmount/tip/discount DENY · düz create ALLOW · auth+paidAmount ALLOW

> ⚠️ **G4 uygulanınca** (staff catch-all enumerasyonu) bu suite'e eklenecek yeni case'ler:
> - [ ] staff (admin değil) kendi `staff/{uid}.permissions` write → **DENY**
> - [ ] admin → staff doc write → **ALLOW**
> - [ ] tenant üyesi → clients/campaigns/settings/finance/products/auditLogs write → **ALLOW** (enumerasyon eksik bırakmadı mı?)
> - [ ] catch-all altındaki HER yazılır koleksiyon için ALLOW (advances, cover, expenses, investment, logo, notifications, team, fcmTokens)
>
> Bkz: [SECURITY.md](SECURITY.md) §3 G4.

---

## 2. Güvenlik gate'leri — MANUEL (deploy etrafında)

Bağlam: [SECURITY.md](SECURITY.md). **Durum kaynağı = [ROADMAP.md](ROADMAP.md) Pre-Scale Gate** (SSOT).
✅ **G1+G2+G3+G4 CANLI** (2026-07-02 doğrulandı): `0f8de7e` (G1+G4) + `851efeb` (G2+G3), ruleset `22bdc429`,
otomatik test 49/49. Aşağıdaki manuel smoke case'leri **deploy sonrası bir kez daha** teyit için tutuluyor.

### G1 — rol-claim backfill ✅ CANLI (`0f8de7e`) — smoke teyidi
- [x] Fallback kaldırıldı (`firestore.rules`), claim'ler zaten tamdı (dry-run "0 değişiklik"), 49/49 test.
- [ ] (smoke) Bir admin user re-login → Settings'ten tenant-doc (features) yazabiliyor mu? (kırılmadı mı)
- [ ] (smoke) Bir staff user re-login → admin-only işlem hâlâ engelli mi?
- [ ] ⚠️ **T-a takibi:** `AppRouter.jsx:104` `isAdmin=true` hardcode → yeni staff web panele girmeden gerçek role'e bağla.

### G2/G3 — deploy sonrası canlı smoke (rules deploy edilince)
- [ ] **whitecross booking CREATE** (whitecrossbarbers.com'dan) → başarılı (G3 bozmadı)
- [ ] **herohairs booking CREATE** (salown.com/book) → başarılı
- [ ] **Panel** (salown.com/app) bookings/takvim yükleniyor (G2 auth read çalışıyor)
- [ ] **Staff app** (staff.salown.com) bugünkü randevular yükleniyor
- [ ] whitecross Stripe-back senaryosu: ödeme iptal → slot ~15dk sonra boşalıyor (cleanup; anlık değil — beklenen)
- [ ] whitecross-site konsol: `permission-denied` logu booking'i ENGELLEMİYOR (fails-open)

---

## 3. Stripe Canlı Test (whitecross) — 🗄️ LEGACY (yapılmadı, GEREKMİYOR)

> **SUPERSEDED (2026-07-02):** Bu, eski **Payment Link + elle secret-key + `salownStripeWebhook`**
> modelinin testiydi — Stripe **Connect**'e geçtiğimiz için o akış emekliye ayrılıyor. Bu testi
> **yapma**; yerine **Bölüm 3b (Stripe Connect)** geldi. Aşağısı arşiv/referans olarak duruyor.
> (Not: whitecross-site'ın KENDİ Stripe akışı ayrı ve canlı — bkz [STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md) satır 18; o dokunulmuyor.)

**Hazırlık (bir kez):**
- [ ] Stripe Dashboard → Webhooks → Add endpoint:
  `https://europe-west2-havuz-44f70.cloudfunctions.net/salownStripeWebhook?tenant=whitecross`
  Events: `checkout.session.completed` + `checkout.session.async_payment_succeeded`
- [ ] `whsec_...` signing secret kopyala
- [ ] Salown panel → Settings → Integrations → Stripe: secret key + webhook secret → Save

**Test A — End-to-end test butonu:**
- [ ] Settings → Integrations → Stripe → test Payment Link URL → Run test booking
- [ ] Test kartı `4242 4242 4242 4242` ile öde
- [ ] Firestore `STRIPE-TEST-...` → `status: CONFIRMED`
- [ ] `whitecrossbarbers@gmail.com`'a "Booking Confirmed" emaili
- [ ] Functions logs: her iki fonksiyon çalıştı

**Test B — Gerçek booking:**
- [ ] Whitecross booking sayfasından booking (serviste `depositUrl` ayarlı)
- [ ] Stripe ödeme → webhook → CONFIRMED + email

**Test C — Cleanup:**
- [ ] PENDING booking 30dk (salown) / 15dk (whitecross-site) bekle → `CANCELLED`

---

## 3b. Stripe Connect — UÇTAN UCA TEST PLANI (2026-07-04)

> Standard Connect + Direct charge. Plan: [STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md).
> **Hepsi TEST mode** (`sk_test_` platform key, Stripe sandbox "Turquoise Swing") → gerçek para YOK.
> **Durum:** Faz 0–3 backend + UI CANLI. Onboarding + deposit-checkout uçtan uca owner tarafından doğrulandı ✅ (2026-07-04). Aşağısı tam regresyon/kabul matrisi — yeni tenant onboarding'inden ÖNCE hepsi ✅ olmalı.
> Test kartı: `4242 4242 4242 4242` · ileri tarih · herhangi CVC/postcode. İptal-refund testinde Stripe Dashboard → Payments'ta refund'ı doğrula.

**Kurulum (bir kez) — ✅ TAMAM:** `client_id ca_Uov4x…` + redirect URI + platform `sk_test` + webhook (`salOWN-connect`, Connected-accounts scope, `checkout.session.completed`+`charge.refunded`) + 3 secret set + 6 fn deploy (`functions:salown:<fn>` codebase-prefix'li).

### A. Onboarding (Settings → Integrations → Online payments)
- [x] "Connect with Stripe" → OAuth → Authorize → dönüşte `?tab=integrations` + "✓ Connected" rozeti ✅
- [x] `integrations.stripeAccountId=acct_…` yazıldı (tenant secret key YOK) ✅
- [x] `salownConnectStatus` → charges/payouts durumu rozete yansıyor ✅
- [ ] `superAdmin/auditLog` → `stripe_connected` kaydı var
- [ ] **Disconnect** → `stripeAccountId` temizlendi + rozet gitti + root `features.stripe/paymentMode` kapandı → sonraki booking ödemesiz CONFIRMED

### B. Ödeme modları (her biri: Settings→mod seç→**Save**→`salown.com/book/whitecross`→booking→doğrula)
- [ ] **off** ("Don't take payment") → anında CONFIRMED, "Pay at the salon", Stripe YOK
- [ ] **pay_at_venue** → anında CONFIRMED, ödeme adımı yok
- [x] **deposit** → confirmation breakdown (total/deposit/kalan) → Pay now → Stripe → success → CONFIRMED ✅
- [ ] **full** → "Pay £X now" → Stripe → success "Paid in full", remaining=0
- [ ] **optional** → confirmation'da 2 buton (deposit / full); deposit yolu ✅ + full yolu ✅ (her biri doğru tutar)

### C. Tutar doğruluğu (sunucuda hesaplanır — client'a güvenilmez)
- [ ] deposit tutarı = servis `depositAmount` ?? tenant `defaultDepositAmount`
- [ ] full tutarı = servis (veya variation) fiyatı
- [ ] Tutarı client'tan forge denemesi → sunucu servis doc'undan hesaplıyor, forge etkisiz (`SYSTEM_ARCHITECTURE.md:75`)
- [ ] slug/gerçek-id serviceId ikisi de çözülüyor (fn: id→slug(isim)→booking.price fallback)

### D. Success page (Stripe dönüşü `?paid=1`)
- [x] salOWN-stili "You're all set!" + gradient badge + konfeti + breakdown ✅
- [ ] deposit varyant: Service total / Deposit paid / Due at salon
- [ ] full varyant: "Paid in full £X"
- [ ] loyalty açıksa: puan + ≈£ reward kartı; double-points kampanyası aktifse "⚡ Double points"
- [ ] Add to calendar linki doğru tarih/saat; "Book another" resetliyor

### E. Staff/Admin booking detail (BookingDetailPanel)
- [x] deposit booking → "Deposit paid £10 / Remaining / Total" (paymentType UPPERCASE) ✅
- [ ] full booking → "Fully paid online"
- [ ] pay-at-venue booking → "Amount"/"Pay at venue"

### F. Webhook & veri bütünlüğü
- [x] `checkout.session.completed` → PENDING→CONFIRMED + `paidAmount/remaining/paymentType(UPPERCASE)/paymentState/stripeSessionId/stripePaymentIntent` ✅
- [ ] **İzolasyon:** `event.account` ≠ stored `stripeAccountId` → `account_mismatch`, yazma YOK
- [ ] Cleanup: ödenmemiş PENDING 30dk → CANCELLED (`salownCleanupExpiredPending`)
- [ ] Confirmation email CONFIRMED'de gidiyor (`salownBookingConfirmationTrigger`)

### G. İptal / Refund
- [ ] Deposit-ödenmiş booking'i **pencere DIŞINDA** onay-mail linkinden iptal → Stripe refund atıldı (Dashboard'da görünür) + booking `paymentState=REFUNDED`+`refundedAmount`
- [ ] **Pencere İÇİNDE** iptal → `salownCancelByToken` reddediyor ("at least X hours before")
- [ ] Stripe Dashboard'dan elle refund → `charge.refunded` webhook → booking'e yansıdı (collectionGroup index)

### H. İptal/erteleme pencereleri (Settings → General → Booking policy)
- [ ] `cancellationWindowHours` değiştir (örn 8→2) → iptal sınırı yeni değere göre
- [ ] `rescheduleWindowHours` değiştir → erteleme sınırı yeni değere göre; `0` = serbest
- [ ] Reschedule sonrası `paidAmount`/deposit korunuyor (sıfırlanmıyor)

### I. Güvenlik / kenar durumlar
- [ ] non-PENDING booking için checkout denemesi → reddediliyor
- [ ] charges-enabled=false hesapta paying-mod → gate açılmıyor (booking ödemesiz CONFIRMED, "Pay at salon")
- [ ] `integrations` doc public okunamıyor (sır yok); yalnız `paymentMode`/`defaultDepositAmount` root'ta public

### J. İzolasyon / regresyon
- [ ] **whitecross-site (whitecrossbarbers.com)** kendi ödeme akışı ETKİLENMEDİ (ayrı fn/key, `source:'Website'`)
- [ ] Walk-in / diğer source booking'ler + checkout normal çalışıyor

---

## 4. Staff App (staff.salown.com) — yapılacak

**Reschedule:**
- [ ] Booking detayı → "Reschedule" → sheet açıldı
- [ ] Yeni tarih/saat → "Confirm" → Firestore güncellendi
- [ ] Dolu saate deneme → conflict uyarısı
- [ ] CHECKED_OUT booking'de Reschedule görünmüyor

**No-show:**
- [ ] "No show" → "Confirm?" → `NO_SHOW`
- [ ] `canCancelBookings:false` kullanıcısında buton yok

**Working hours:**
- [ ] Saatler dışı appointment → ⚠️ uyarı görünüyor ama kayıt yapılıyor
- [ ] Saatler içi → uyarı yok

**Sales tab:**
- [ ] 💷 Sales → açıldı; checkout var → gelir; yok → boş durum
- [ ] `canViewRevenue:false` → rakamlar gizli, sadece sayı
- [ ] Barber modu → sadece kendi satışları

---

## 5. Post-Class-A Migration Verification

| # | Senaryo | Manuel ✓ | 24h izlendi | Temiz |
|---|---------|----------|-------------|-------|
| 1 | Panel'den yeni booking → müşteri confirmation emailı | ☐ | ☐ | ☐ |
| 2 | Walk-in ekleme → email GELMİYOR | ☐ | ☐ | ☐ |
| 3 | Booksy/Fresha import → email GELMİYOR | ☐ | ☐ | ☐ |
| 4 | Müşteri email linkinden cancel → cancellation emailı | ☐ | ☐ | ☐ |
| 5 | Müşteri email linkinden reschedule → yeni tarihli email | ☐ | ☐ | ☐ |
| 6 | Checkout + loyalty toggle → loyalty emailı | ☐ | ☐ | ☐ |
| 7 | Staff App login → push izni → booking gelince push | ☐ | ☐ | ☐ |
| 8 | Staff App logout → `fcmTokens`'dan token silindi | ☐ | ☐ | ☐ |
| 9 | barber-mobile'da booking gelince push GELMİYOR | ☐ | ☐ | ☐ |
| 10 | Tek booking için Firebase logs: her kanal sadece 1 kez | ☐ | ☐ | ☐ |

---

## 6. Busy-slot v2 / Processing-time — AYRI DOC

Tam matris: **[BUSY_SLOT_V2_TESTPLAN.md](BUSY_SLOT_V2_TESTPLAN.md)** (A–F bölümleri).
**🚀 DEPLOYED 2026-06-24** (functions + hosting:salown, commit a0d70e0). Flag SADECE HeroHairs.
Canlı doğrulama checklist'i → **§7 (aşağıda).**
Tasarım: [BUSY_SLOT_V2.md](BUSY_SLOT_V2.md) · birim test: `salown-app/src/utils/conflictUtils.test.js` (25/25)

---

## 7. 🚀 Canlı Release Doğrulama — 2026-06-24 (Service Editor + Squeeze-in + Self-booking)

> Commit `a0d70e0`, functions + hosting:salown **CANLI** (salown.web.app). `features.processingTime`
> SADECE HeroHairs'te açık → squeeze-in DAVRANIŞI gated; UI redesign tüm tenant'larda canlı.
> Kill-switch: HeroHairs tenant doc `features.processingTime=false`.

### A. Regresyon — TÜM tenant'lar (UI herkese gitti) — EN KRİTİK
- [ ] **Whitecross:** takvim açılıyor; booking/walk-in/reschedule normal; "slot dolu" doğru çalışıyor
- [ ] **eekurt:** aynı kontroller
- [ ] Flag KAPALI tenant'ta squeeze-in YOK (servis editöründe wait alanları çıkmıyor, takvim eskisi gibi)

### B. Service Editor — tüm tenant'lar
- [ ] Sidebar → **Services** → servise tıkla → tam-sayfa editör açılıyor
- [ ] Bölüm geçişleri (Basic / Pricing & timing / Online / Team)
- [ ] Kaydet+yükle: name, **category (değiştirince servis taşınıyor)**, description, price type (Fixed/From/Free), price/deposit/duration, variations, team
- [ ] Active toggle · ★ Featured · Archive · Discard çalışıyor
- [ ] **Online Profile → Services tab YOK** (tek home = sidebar Services)

### C. Squeeze-in — SADECE HeroHairs (flag açık)
- [ ] Servis → Pricing & timing → wait gir (örn. before 15 / wait 30) → görsel bar + yeşil onay → Save
- [ ] Takvim: o servisle booking → ortada **taralı gap + "+ Squeeze in"**
- [ ] Gap'e tıkla → **walk-in penceresi gap saatiyle** açılıyor
- [ ] Gap'e booking → **kabul** (taşma da kabul = squeeze-in leniency); aktif segmentte başlayan → red
- [ ] İki booking **yan-yana kolon**, ikisi de okunur (WALK-IN/✓ kapanmıyor)
- [ ] İleri tarihli gap → **Booking** sekmesi açılıyor (walk-in değil)

### D. Self-booking
- [ ] Editör → Online booking → "Allow self-booking" **KAPAT** → Save
- [ ] **Public booking sayfasında** o servis YOK
- [ ] **Public salon sitesinde** o servis YOK
- [ ] **Staff panelinde** (walk-in/booking) servis HÂLÂ var (staff-only)

### E. Treatwell / iCal — HeroHairs (functions canlı)
- [ ] Feed: `https://europe-west2-havuz-44f70.cloudfunctions.net/salownIcalFeed?tenantId=herohairs` → processing'li booking için **2 VEVENT** (ortada gap boş)
- [ ] Treatwell poll sonrası gap **müsait** görünüyor; aktif segmentler dolu
- [ ] ⚠️ **Echo-dedup HENÜZ YOK** → Treatwell-origin booking feed'e geri gidip double görünebilir (bilinen, future — risk defteri)

### F. Gallery
- [ ] Online Profile → Gallery → resimler **küçük + tutarlı** thumbnail (geniş ekranda büyümüyor)

### G. Email (prior session — bu deploy'la canlıya çıktı)
- [ ] Confirmation / cancellation / reschedule / loyalty emailları gidiyor
- [ ] Bozuk-adres + client-edit propagasyon fix'i çalışıyor

### Otomatik (geliştirici)
- [x] `npm test` (salown-app) → `conflictUtils.test.js` **25/25** ✅
- [ ] `python3 docs/test-firestore-rules.py` → 25/25 (rules DEĞİŞMEDİ, sabit kalmalı)

---

## İlgili
- [SECURITY.md](SECURITY.md) — rules/güvenlik (test edilen davranışların kaynağı)
- [ROADMAP.md](ROADMAP.md) — iş listesi (testler buraya taşındı, orada yalnız pointer)
- [DEPLOY.md](DEPLOY.md) — deploy sırası (rules EN SON; test → deploy)
</content>
