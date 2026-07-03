# INCIDENTS.md

Geçmiş kazalar ve çıkarılan dersler. Her kayıt: ne oldu, neden, nasıl düzeltildi.

> **ÖNCE BURAYA BAK:** Bir problem (email gitmiyor, booking düşmüyor, sayfa boş, vb.) yaşandığında, teşhise başlamadan önce bu dosyada benzer bir olay raporlanmış mı diye ara — kök neden ve teşhis yöntemi muhtemelen burada yazılı.

---

## 📋 Kayıt standardı (yeni olaylar bu şablonu doldurur)

Her olay `## YYYY-MM-DD — kısa başlık` ile açılır, hemen altına **metadata satırı**, sonra detay + **Dersler / Lessons Learned**.

```
## 2026-XX-XX — kısa başlık

**Severity:** 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low · **Owner:** <kim> · **Status:** ✅ Resolved / 🟡 Open / 🔴 Regressed

**Impact:** kullanıcı/işletme ne yaşadı (bir cümle)
**Root Cause:** asıl neden (kısa) — detay aşağıda
**Resolution:** ne yapıldı + commit/deploy durumu
**Prevention:** tekrarı nasıl engelleriz (kalıcı kural / test / guard)

**Ne oldu / Teşhis / Fix:** (serbest, uzun anlatım)

**Dersler / Lessons Learned:**
- ...
- ...
```

**Severity lejantı:** 🔴 Critical (canlı kesinti / veri-para / güvenlik) · 🟠 High (özellik kırık, geçici çözüm var) · 🟡 Medium (yanlış gösterim / kısmi) · 🟢 Low (tek ekran / kozmetik).
**Status lejantı:** ✅ Resolved · 🟡 Open (kısmi/takip var) · 🔴 Regressed (geri geldi — recurrence).
**Owner:** düzeltmeyi yapan/sorumlu kişi. Bilinmiyorsa `—`, ama yeni kayıtlarda ZORUNLU (multi-session repo, "kime sorarım" cevabı).

---

## 2026-07-03 — Checkout özet paneli add-on'ları göstermiyordu (Subtotal eksik, Total doğru)

**Severity:** 🟢 Low · **Owner:** Claude (Opus 4.8) · **Status:** ✅ Resolved

**Impact:** Owner checkout'ta servise "Nose Wax £6" add-on ekledi; sağdaki özet panelinde **Subtotal £28** (add-on'suz) kalıyor, add-on satırı hiç görünmüyordu — ama **Total £40 doğruydu**. Subtotal+Tip (£28+£6) ≠ Total (£40) → tutarsız/yanıltıcı göründü ("eklediğim extra breakdown'a girmiyor"). **Veri ve receipt HER ZAMAN doğruydu** (booking `soldAddOns`, Service total £34, receipt "Nose Wax Add-on £6" hepsi doğru); sorun yalnızca checkout ekranındaki canlı gösterim.
**Root Cause:** `CheckoutPanel.jsx` `SummaryPanel`'e `localExtras` (add-on'lar) **hiç geçilmiyordu**. Panel yalnız `localProducts`'ı topluyor, `Subtotal = basePrice + productsTotal` — `addOnsTotal` eksik. `total` prop'u ise parent'ta add-on dahil hesaplandığı için (`startingTotal = basePrice + productsTotal + addOnsTotal`, `:687`) doğru geliyordu → Subtotal ile Total arasında add-on kadar fark. Latent bug (ürünler gösteriliyordu, add-on'lar hiç eklenmemişti).
**Resolution:** `CheckoutPanel.jsx` (+13/−2): `SummaryPanel`'e `localExtras` prop'u geçirildi; `addOnsTotal = getProductsTotal(localExtras)`; ürün bloğunun altına amber add-on bloğu (isim·£) eklendi; `Subtotal = basePrice + productsTotal + addOnsTotal`. Build sıfır-hata (`CheckoutPanel-Ck-OpAyi.js`). Deploy: salown.com `npm run deploy:panel` (staff app AYRI checkout, etkilenmedi).
**Prevention:** Bir para özeti hem "kalem listesi" hem "Subtotal" gösteriyorsa, ikisi de **aynı kaynaktan** (products **+ extras + service**) türemeli; Total ayrı formülden gelip kalem toplamıyla uyuşmuyorsa gösterim eksik demektir. Add-on = ürünle aynı `getProductsTotal` şekli, unutulması kolay ikinci dizi.

**Dersler / Lessons Learned:**
- "Total doğru ama breakdown yanlış" = neredeyse her zaman **gösterim** bug'ı, veri değil — önce persistan doc + receipt'e bak (ikisi de doğruysa panik yok).
- `soldProducts` ve `soldAddOns` İKİ ayrı dizi; bir yüzey ürünü gösterip add-on'u unutabiliyor (bkz aynı gün Staff/Panel Sales görünürlük işi — kalıp aynı: add-on/product ikinci diziyi kaçırmak).

## 2026-07-03 — Mesai-dışı "Busy" quick-block grid'de görünmedi → silinemeyen hayalet kayıt

**Severity:** 🟡 Medium · **Owner:** Claude (Opus 4.8) · **Status:** ✅ Resolved

**Impact:** Whitecross'ta owner tüm takıma **23:44'te bir "Busy" quick-block** attı (scope 'all' → alex/arda/muhamed, 23:44→ertesi 00:44 gece-yarısı geçen). Kayıtlar Calendar Day grid'inde görünmedi → tıklanıp silinemediler. Owner ayrıca "Alex'e off veremiyorum, booking var diyor" sandı.
**Root Cause:** `TimeGrid.jsx` görünür pencereyi `GRID_START = açılış−2s`, `GRID_END = kapanış+2s` ile sabitliyordu. 23:44'lük block, kapanış+2s (~21:00) penceresinin altına düşünce `top = (startMins − GRID_START*60)*…` ekranın altında konumlanıp görünmez oldu ("data valid, UI invalid" — INC 2026-06-29 hayalet-booking ailesi, farklı sebep: off-day değil, **mesai-dışı saat**). İkincil: `Barbers.jsx` "Off today" `_todayCount` uyarısı BLOCKED holdleri de sayıyordu → busy block "reassign manually" dedi (ama `markOffToday` ENGELLEMİYOR; off yine verilebilir).
**Resolution:** (1) 3 hayalet block salt-okunur admin sorguyla bulunup **imza-doğrulamalı** silindi (yalnız `status:BLOCKED·blockKind:busy·note:Busy·02Tem23:44`). (2) `TimeGrid.jsx` (+17/−2): `GRID_START/END` artık `OPEN/CLOSE` ile seed'lenip o günün gerçek kayıtlarını (CANCELLED hariç) kapsayacak şekilde **sadece dışarı** genişliyor — mesai-dışı hiçbir kayıt bir daha görünmez kalmaz. (3) `Barbers.jsx` (+2/−1): `_todayCount` BLOCKED'ı atlar. Commit `7d06c33` PUSHED→CI hosting deploy (tüm tenant Calendar). functions'a dokunulmadı.
**Prevention:** Grid penceresi artık **veriyi izler** (statik saat kutusu değil) → mesai-dışı kayıt yapısal olarak erişilebilir kalır. Normal günlerde byte-identical (pencere yalnız büyür, `OPEN_MINS/CLOSE_MINS` header/popup için gerçek mesai olarak korunur).

**Ne oldu / Teşhis / Fix:** Owner "dün bir walk-in ya da busy attım, grid'in görünmediği saate, silemiyorum" dedi. Kural #7 gereği önce bu dosya + KNOWN_QUIRKS/INVARIANTS okundu → INC 2026-06-29 "off-day hayalet booking" kalıbı ("grid'de yok = DISPLAY sorunu; önce Firestore'da doc'u DOĞRULA") uygulandı. `firebase-admin` + ADC ile `tenants/whitecross/bookings` 30Haz–6Tem sorgulandı → 3 BLOCKED/busy kaydı 02Tem 23:44'te bulundu. Off-day değil (kolonlar çiziliyor), **saat penceresi** sebebi doğrulandı. Silme imza-guard'lı script'le yapıldı; fix build sıfır-hata doğrulandı.

**Dersler / Lessons Learned:**
- **Grid gibi "görünür pencere" hesapları statik olmamalı, veriyi kapsamalı.** Kayıt penceresinin dışına düşerse UI'da erişilemez ("ghost") olur — off-day (kolon yok) ve mesai-dışı-saat (kart pencere dışında) iki ayrı görünmezlik sebebi, ikisi de aynı "data valid, UI invalid" sonucunu verir.
- **"Grid'de yok = create değil DISPLAY sorunu" (INC 2026-06-29 & 2026-06-26 ile aynı ders):** teşhise kod okumakla değil, **Firestore'da doc'u salt-okunur doğrulayarak** başla; sebep (off-day mı, saat mi, barber-eşleşme mi) veriden çıkar.
- **Production tekil silme = imza-guard'lı script.** Silmeden önce doc'un beklenen imzasını (status/kind/note/tarih) doğrula, uymuyorsa DURDUR — yanlış kaydı silmektense hiç silme.
- **Uyarı ≠ engel:** `markOffToday` sadece `_todayCount>0` uyarısı gösteriyordu, işlemi bloklamıyordu; "yapamıyorum" şikâyetinde önce gerçekten bloklanıyor mu diye kodu teyit et.

## 2026-07-02 — Demo başvurusu approve'u, mevcut bir tenant'ın (eekurt) auth hesabının claim'ini ezdi

**Severity:** 🟠 High · **Owner:** Claude (Opus 4.8) · **Status:** ✅ Resolved
**Impact:** H2 P3 test'inde super-admin, KWOLF BARBERS demo başvurusunu (email: `eekurtbookings@gmail.com`) approve etti. Bu email zaten **eekurt tenant'ının giriş hesabıydı** (uid `L6ws…`, `docs/TENANTS.md`). `approveApplication` mevcut hesabı yeniden kullanıp custom claim'ini `{tenantId:eekurt}` → `{tenantId:kwolf-barbers, tenantRole:owner}` yaptı → eekurt hesabı kwolf-barbers'a düştü, eekurt erişimi bu hesap üzerinden bozuldu. Ayrıca davet maili `Domain not allowlisted` ile patladı.
**Root Cause:** (1) `approveApplication` `getUserByEmail` ile bulduğu mevcut kullanıcının claim'ini **koşulsuz eziyordu** — başka tenant'a ait olup olmadığını kontrol etmiyordu. (2) `generatePasswordResetLink` continue-URL'i `salown.com` Firebase Auth Authorized domains'te değil.
**Resolution:** Guard eklendi — `getUserByEmail` bir kullanıcı bulur ve `customClaims.tenantId` doluysa approve **reddediyor** (`failed-precondition`), ezmiyor. Mail: `salown.com → salown.web.app → default` fallback zinciri. İkisi de redeploy (`functions:salown:approveApplication`). Temizlik: eekurt + kwolf-barbers Firestore'dan silindi (kullanıcı elle); orphan auth hesabı `eekurtbookings@gmail.com` Authentication'dan silinecek (düşük öncelik).
**Prevention:** Bir auth kullanıcısının claim'ini yazmadan **önce** o kullanıcının başka bir tenant'a bağlı olup olmadığını kontrol et. Provision/onboarding akışları asla mevcut bir hesabı sessizce başka tenant'a taşımamalı.

**Ne oldu / Teşhis / Fix:** P3 (Applications sekmesi + approve→provision) canlıya alındı. İlk gerçek approve testinde başvuru email'i mevcut bir tenant hesabıyla çakıştı. `firebase functions:log` → `invite email failed: Domain not allowlisted by project` (mail); `docs/TENANTS.md` → `eekurtbookings@gmail.com`'un eekurt'ün hesabı olduğu (claim clobber). Tenant kurulumu başarılıydı (approve akışı çalışıyor) ama iki yan bug çıktı. İkisi de kodda düzeltildi + redeploy; test verisi (kwolf-barbers) + eekurt (kullanıcı kararıyla komple) silindi.

**Dersler / Lessons Learned:**
- `setCustomUserClaims` **yıkıcı** bir işlem — mevcut claim'i tamamen değiştirir. Yazmadan önce "bu hesap zaten birine mi ait?" kontrolü şart.
- `generatePasswordResetLink`/`actionCodeSettings.url` domain'i Firebase Auth **Authorized domains**'te olmalı; custom domain (salown.com) default olarak değil — `salown.web.app` var. Kalıcı çözüm: salown.com'u Authorized domains'e ekle (Console).
- Firestore console'dan doc silmek **auth kullanıcısını silmez** (ayrı sistem) ve alt-koleksiyonları cascade etmeyebilir — tenant retire ederken üç yeri de düşün: Firestore doc, alt-koleksiyonlar, Auth user.
- Test verisi için gerçek/mevcut email kullanma (eekurtbookings@) — çakışma riski.

## 2026-06-29 — Müşteri reschedule barber off-gününü (Arda Çarşamba) kabul etti → "hayalet booking" (grid'de görünmez)

**Severity:** 🟠 High · **Owner:** — · **Status:** ✅ Resolved
**Impact:** Reschedule linki booking'i barber'ın off-gününe taşıdı; grid o kolonu çizmediği için kayıt görünmez/yönetilemez oldu ("data valid, UI invalid").
**Root Cause:** İş kuralı iki yoldan sadece birinde — `workingDays` gate BookingPage'de var, reschedule yolunda (`salownGetBusySlots`/`salownRescheduleByToken`) yok.
**Resolution:** Server-side barber müsaitlik doğrulaması + client MiniCal off-day disable (commit `5476238`, DEPLOYED).
**Prevention:** Business rules **UI'da yaşayamaz** — bir veriye yazan/taşıyan TÜM yolları grep'le, kısıtı hem UI'da göster hem server'da reddet.

**Ne oldu:** Email reschedule linkinden bir booking, Arda'nın **off günü Çarşamba**'ya (1 Temmuz 14:00) taşınabildi. Booking Firestore'da VAR ama Calendar grid o gün Arda kolonu çizmediği için **görünmüyordu** ("ama booking var, grid'de Arda yok") — görünmez/yönetilemez hayalet booking.

**Kök neden — iki reschedule yolundan biri workingDays kontrol etmiyor:** Barber müsaitliği `barber.workingDays` (capitalized gün adları) + `shiftChanges[dateKey]` + `dayHours[day].closed` ile modelleniyor. **Yeni booking** yolu (`BookingPage.jsx:248` `if(!workingDays.includes(dayName)) return null`) bunu uyguluyor → Arda Çarşamba gösterilmez. Ama **reschedule** yolu (`ManageBooking` + `salownGetBusySlots` + `salownRescheduleByToken`) barber'ı hiç okumuyordu: `salownGetBusySlots` yalnız **mağaza** saatleri + dolu slotları döndürüyor (per-barber YOK), `salownRescheduleByToken` yalnız çakışma + geçmiş-zaman + 2h kuralını kontrol ediyordu. Mağaza Çarşamba açık (Muhamed/Alex çalışıyor) → off-day reschedule kabul edildi. whitecross-site `Reschedule.html` zaten doğru yapıyordu (off ise o gün çalışan barber'a otomatik geçiş) — yani yeni Salown akışı regresyon.

**Fix (2026-06-29, DEPLOYED — functions:salown + hosting, commit `5476238`):** İki katman. (1) **Server (authoritative)** `salownRescheduleByToken`: yazmadan önce barbers koleksiyonundan barber'ı (id VEYA name, case-insensitive) bul, yeni günü `shiftChange→workingDays→dayHours.closed` ile doğrula, off-day ise `HttpsError('failed-precondition', '<barber> is not available on <day>...')`. (2) **Client (UX)** `ManageBooking`: public `barbers`'ı oku, `barberWorksOn()` helper (BookingPage mantığının aynası) ile MiniCal'da off-günleri disable + `loadSlots` guard. Barbers public-readable (`firestore.rules:83 allow read: if true`) → ekstra callable gerekmedi. Hatalı CANLI booking'e (Arda 1 Tem) owner kararıyla dokunulmadı.

**Dersler:**
- **Aynı işlemin iki yolu varsa (booking vs reschedule), iş kuralı İKİSİNDE de olmalı.** workingDays gate yalnız BookingPage'deydi; reschedule yolu sessizce atlamıştı. Yeni bir kısıt eklerken "bu veriye yazan/taşıyan TÜM yollar" grep'lenmeli.
- **Off-day'e düşen booking = hayalet booking.** Grid barberi o gün çizmediği için kayıt görünmez/yönetilemez olur. Müsaitlik kısıtı UI'da göstermemekle kalmamalı, server-side de reddetmeli (UI bypass + grid görünmezliği iki ayrı zarar).
- **Public callable PII-free veri döndürürken iş-kuralı verisini de taşımalı.** `salownGetBusySlots` sadece mağaza saatini döndürüp barber müsaitliğini dışarıda bıraktı → tüketen sayfa eksik kararla kaldı. Ya callable barber müsaitliğini döndürmeli ya client (public-readable ise) kendi okumalı.
- **Dinamik versiyon roadmap'te** (ROADMAP #3b): off-day reschedule davranışı + cancel/reschedule pencereleri + barber-değiştirme tenant-configurable olacak.

---

## 2026-06-29 — Confirmation email'deki reschedule/cancel linki + TÜM Salown app'i (login/signup/booking/manage) production'da 404 — CI deploy bundle'ı 14 Haz'dan beri canlıya indirmiyordu

**Severity:** 🔴 Critical · **Owner:** — · **Status:** ✅ Resolved
**Impact:** hub.salown.com panel rotaları (login/signup/app) + salown.com booking/manage + email linkleri haftalarca 404; "deployment pipeline silently broke".
**Root Cause:** `hosting/public-bundle` gitignored → build atlayan HER `firebase deploy` bundle'ı siliyordu (CI değil, ham deploy). Son başarılı deploy'da (14 Haz öncesi, statik-only) donmuştu, hata vermeden.
**Resolution:** `firebase.json`'a `predeploy` build hook (commit `026c914`, PUSHED) — deploy eden herkes önce build alır, bundle yapısal olarak düşemez.
**Prevention:** (1) "Sayfa yok + rota kodda VAR = önce deploy'a bak"; `curl <site>/public-bundle/index.html` 404 ise tüm SPA ölü. (2) **Post-deploy smoke test** — CI sonunda kritik rotalar 200 dönmezse fail (aşağıdaki blok). (3) Build-output ya commit'lenir ya predeploy hook'a bağlanır.

**Ne oldu:** Whitecross web booking'inin `noreply@salown.com` confirmation email'indeki **Reschedule** linkine tıklayınca "Firestore/page bulunamadı" (Firebase Hosting 404 "Page Not Found") çıkıyordu. Owner G1/G4 sonrası mı diye sordu + "normalde Salown'un kendi reschedule sayfasına gidiyordu" dedi (doğru hatırlıyordu). Sonradan `salown.com/login` de 404 verince kapsam genişledi.

**Teşhis yöntemi (sırayla):**
1. Email linki: `functions/index.js:551` → `https://salown.com/manage/${tenantId}/${bookingId}?email=...&action=reschedule` (hem `salownSendBookingConfirmation` onCall'da hem trigger `_salownSendConfirmationEmail`'de; `bookingId = data.bookingId || docId`).
2. Sayfa gerçekten VAR: `salown-app/src/App.jsx:25` `/manage/:tenantId/:bookingId` → `ManageBooking.jsx` (`salownGetBookingByToken` callable, Admin SDK → kuralları baypas). `firebase.json`'da `/manage/** → /public-bundle/index.html` rewrite mevcut, yerel build (`hosting/public-bundle`) bu rotayı içeriyor.
3. **Canlı testle kök neden bulundu:** `curl salown.com/{manage,app,login,signup,book}` → **hepsi 404**, ama `/` ve `/barbers` (statik) → 200. Kesin kanıt: `salown.com/public-bundle/index.html` → **404**. `salown.web.app` (site varsayılanı) da aynı → domain doğru site'a bağlı, deploy'un kendisi eski.
4. **Neden CI'dı:** `origin/main`'de firebase.json DOĞRU (tüm rewrite'lar var), `npm run build` lokalde SAĞLIKLI, `package-lock` senkron. Ama canlı, `public-bundle`'ın eklendiği commit `3d63c39` (14 Haz)'dan ÖNCEKİ deploy'da donmuş. `deploy.yml` (push→main → npm ci → build → `firebase deploy --only hosting`) origin'de var ama bundle production'a hiç inmemiş. 7 Haz commit geçmişi şüpheliyi veriyor: secret adı git-gel (`FIREBASE_SERVICE_ACCOUNT_HAVUZ_44F70` ↔ `FIREBASE_SERVICE_ACCOUNT`) + `c7424f1` "remove functions from CI (IAM permission issue)" → deploy adımının SA/secret yetkisi muhtemelen kırık.

**G1/G4 SUÇSUZ:** G1/G4 (`0f8de7e`) bir Firestore *rules* değişikliği. ManageBooking okumaları Admin SDK callable + public tenant-root (`firestore.rules:31 allow read: if true`) → rules'tan etkilenmez. Zamanlama tesadüfen yakındı; owner bağladı ama ilgisizdi.

**Fix (2026-06-29, MANUEL DEPLOY):** Bu makinede firebase CLI authed olduğu için `npm run deploy:panel` (= `vite build && firebase deploy --only hosting:salown`) ile bundle production'a alındı. Doğrulama: `/`, `/barbers` hâlâ 200 (landing kaybolmadı), `/login /app /manage/**` artık 200 (SPA shell yükleniyor). Owner teyit etti ("ok geldi"). **Kök neden (CI) ÇÖZÜLMEDİ** — bir sonraki `main` push'unda CI deploy yine fail edip eski state'e dönebilir.

**Dersler:**
- **"Sayfa bulunamadı" + rota kodda VAR = önce DEPLOY'a bak, koda değil.** `curl <site>/public-bundle/index.html` 404 ise tüm SPA rewrite'ları ölü demektir; tek route değil, bundle'ın tamamı eksiktir. Statik sayfa (/) çalışıp app rotaları (/app /login) 404 veriyorsa kesin tanı: bundle deploy edilmemiş.
- **Gitignored build + CI-build modeli sessizce kırılır.** `hosting/public-bundle` gitignore'da, CI'da `npm run build` üretiyor. Build veya deploy adımı fail ederse canlı SON BAŞARILI deploy'da donar (burada 14 Haz öncesi statik-only) — hata vermez, eski site çalışmaya devam eder. Düzenli "canlı rota smoke-test" olmadan haftalarca fark edilmez.
- **CI loglarına erişim yoksa kök neden lokalden daraltılır:** origin/main config doğru + build sağlıklı + lock senkron → kalan tek katman deploy adımı (secret/IAM). `git show origin/main:firebase.json` + `git log -- .github/workflows/deploy.yml` çok şey söyler.
- **AÇIK İŞ:** CI deploy adımı (FIREBASE_SERVICE_ACCOUNT secret / SA Hosting-deploy yetkisi) kalıcı düzeltilmeli; yoksa her manuel deploy geçici. Bkz [[project_salown_ci_deploy_gap]].

**GÜNCELLEME (aynı gün — KESİN kök neden + KALICI fix):** İlk manuel deploy ("ok geldi") 20 dk sonra YİNE 404'e döndü. Sebep CI/secret DEĞİLMİŞ: commit `222f2a1` "everdy" (aerulas, pazarlama sayfaları `/features /apps /story /emails` ekliyor) sahibinin **lokalden build YAPMADAN ham `firebase deploy`** çalıştırmasıyla geldi (commit'lenen `.firebase/hosting.*.cache` kanıt). **Asıl kök neden:** `hosting/public-bundle` **gitignored** — sadece `npm run build` üretir. Build atlayan HER deploy (pazarlama düzenlemesi dahil) bundle'sız site gönderip tüm SPA'yı (login/signup/book/manage) siler. Hem haftalarca süren orijinal kesintiyi hem de tekrarlayan revert'leri bu açıklıyor; CI değil (CI zaten build ediyor). **KALICI FIX (commit `026c914`, PUSHED):** `firebase.json` her iki hosting site'ına **`predeploy` hook** eklendi (`npm run build` / `build:staff`) → artık `firebase deploy` çalıştıran herkes (manuel/CI/worktree) deploy'dan ÖNCE otomatik build alır, bundle yapısal olarak düşemez. Test: bundle silinip ham `firebase deploy` → predeploy yeniden build etti, site ayakta kaldı. **Ek ders:** build-output gitignored + "deploy = ayrı adım" modeli kırılgandır; deploy'a predeploy hook bağla VEYA artefaktı commit'le. `.firebase/` cache git'e girmemeli (everdy yanlışlıkla commit'lemiş — gitignore'a eklenmeli).

**Prevention — post-deploy smoke test (ekle):** predeploy hook bundle'ın _oluşmasını_ garanti eder ama _sunulduğunu_ değil. Deploy sonrası kritik rotalar canlıda 200 dönmeli; dönmezse deploy fail sayılmalı (CI adımı veya deploy script sonu):
```bash
set -e
for url in \
  https://hub.salown.com/login \
  https://hub.salown.com/signup \
  https://salown.com/book \
  https://salown.com/ \
  https://salown.com/public-bundle/index.html ; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$url")
  echo "$code  $url"
  [ "$code" = "200" ] || { echo "SMOKE FAIL: $url → $code"; exit 1; }
done
```
`/public-bundle/index.html` özellikle önemli: bu 404 ise tüm SPA rewrite'ları ölü demektir (bu olayın kesin teşhis imzası).

---

## 2026-06-28 — Staff app gelir £370, web panel £335 (£35 fark) — `paidAmount` bahşiş-dahil + latent `tipPaymentMethod` açığı

**Severity:** 🟡 Medium (vergi-anlamlı, HMRC) · **Owner:** — · **Status:** 🟡 Open
**Impact:** Staff app geliri £35 fazla (bahşiş gelire karışmış); latent olarak kart/nakit bahşiş ayrımı yanlış.
**Root Cause:** `paidAmount = subtotal + tip` (brüt tahsilat, gelir değil); ayrıca `tipPaymentMethod` yazılıyor ama hiçbir rapor okumuyor.
**Resolution:** SalesView geliri `− pp(tip)` + Tips breakdown eklendi (LOCAL, deploy edilmedi).
**Prevention:** `paidAmount` = brüt tahsilat, gelir için bahşişi çıkar; bir alan yakalanıp okunmuyorsa = sessiz bug, tüm okuma noktalarını geçir.
**⚠️ Açık takip:** SalesView LOCAL (deploy bekliyor); Finance/Reports hâlâ servis `paymentMethod` kullanıyor → aynı `tipPaymentMethod` helper'ına geçmeli (whitecross-hassas, owner onayı bekliyor).

**Ne oldu:** Aynı gün için staff app "Total revenue" £370, web panel (Dashboard/Finance) £335 gösteriyordu. Owner farkın nereden geldiğini sordu.

**Kök neden — `paidAmount` bahşişi içeriyor:** Checkout `paidAmount`'a `total = subtotal + tip` yazıyor (`CheckoutPanel.jsx:688` → `firestoreActions.js:153`). Staff app gelir olarak `pp(paidAmount ?? price)` kullanıyordu (`SalesView.jsx:85`) → bahşişi geliri içine alıyor, üstelik `totalTips`'i ayrıca gösteriyordu (çift sunum). Web panel `bookingNetWithoutTip` (`bookingUtils.js`) bahşişi kasıtlı hariç tutuyor. Discount + loyalty iki tarafta da düşülüyor → sadeleşiyor; **tek fark = bahşiş** (£35). Owner teyidi: bahşiş hiçbir zaman gelir değildir, ayrı tutulur.

**İkinci (latent) bulgu — `tipPaymentMethod` hiçbir yerde okunmuyordu:** Checkout bahşişin yöntemini ayrı yakalıyor (`tipPaymentMethod`: Cash/Card, `CheckoutPanel.jsx:455`, yazımı `firestoreActions.js:157`) ama Finance/Reports/staff dahil **her yer** kart/nakit bahşiş ayrımını servisin `paymentMethod`'undan yapıyordu. "Kartla ödedi, bahşişi nakit verdi" (veya tersi) durumunda kart-bahşiş toplamı yanlış — tam da HMRC'nin gelir sayabileceği rakam.

**Fix (2026-06-28, LOCAL):** (1) `SalesView.jsx` gelir = `pp(paidAmount ?? price) − pp(tip)` (`revOf` helper, totalRevenue + ödeme-yöntemi + barber kırılımı üçü de tip-hariç) → staff app artık £335. (2) Staff app'e Tips breakdown eklendi: nakit/kart (artık `tipPaymentMethod ?? paymentMethod` ile DOĞRU) + barber settlement (`tipTakenAsCash` kasadan alınan vs borç), view-only. **Açık takip:** Finance/Reports hâlâ servis `paymentMethod`'unu kullanıyor → aynı `tipPaymentMethod` helper'ına geçmeli (whitecross-hassas, owner onayı bekliyor).

**Dersler:**
- **`paidAmount` brüt-tahsilat'tır (bahşiş dahil), gelir değildir.** Servis geliri isteniyorsa bahşişi çıkar (`− pp(tip)`) ya da `bookingNetWithoutTip` kullan. İki ekran aynı "gelir"i farklı gösteriyorsa önce birinin bahşiş/discount/loyalty muamelesine bak.
- **Bir alanı yakalayıp hiç okumamak sessiz bir bug'dır.** `tipPaymentMethod` aylarca yazıldı ama kart/nakit raporları servis yöntemini kullanmaya devam etti → vergi-anlamlı kart-bahşiş toplamı yanlıştı. Yeni alan eklenince tüm okuma noktalarını da geçir.
- **Bahşiş para akışı seçeresi (`tipTaken`/`tipTakenAsCash`) kart bahşişi için settlement demektir** — işletmeden geçen kart bahşişi barbere borçtur; nakit doğrudan barberin. Raporlarken bu ayrımı koru.

---

## 2026-06-27 — Calendar Day-view'da checked-out booking'ler "iç içe / cascade" göründü — geç checkout kart yüksekliğini şişirdi

**Severity:** 🟡 Medium (görsel/UX, veri sağlam) · **Owner:** — · **Status:** ✅ Resolved
**Impact:** Yoğun günde checked-out kartlar balonlaşıp altındakileri yuttu → sahte örtüşme / kademeli cascade.
**Root Cause:** `actualDuration` (checkout'a basma anı − başlangıç) kart yüksekliğini planlanan süreden UZATIYORDU; amaç sadece erken-bitişte KISALTMAKTI.
**Resolution:** `min(scheduledDuration, actualDuration)` — kart yalnız kısalabilir; render + `computeColumns` iki yerde birebir (commit `11318da`, PUSHED→CI).
**Prevention:** Süre alanı kart geometrisini sürüyorsa tek-yönlü olmalı; height ve kolon motoru AYNI süre kaynağını kullansın.

**Ne oldu:** Whitecross'ta eski yoğun bir gün (Sat 20 June, 16 walk-in, hepsi CHECKED_OUT) Day görünümünde açılınca booking kartları üst üste binip kademeli yan-yana daralan kolonlara (Treatwell-stili) dağılmıştı — "satışlar iç içe girmiş" görüntüsü. Owner bunun gridin başlama-bitiş saatine göre yükselmesinden ve manuel girilenlerin aşağı kaymasından şüphelendi (doğru sezgi).

**Kök neden — `actualDuration` kart yüksekliğini şişiriyor:** Checkout'ta `actualDuration = checkedOutAt − startTime` (dakika, clamp 5..240 = 4 saate kadar; `firestoreActions.js:146`). Bu, servisin GERÇEK süresi değil, booking başlangıcı ile **checkout'a basma anı** arasındaki süre. `TimeGrid.jsx` checked-out kartların hem yüksekliğini (`:343`) hem kolon matematiğini (`computeColumns :154`) doğrudan `actualDuration`'dan hesaplıyordu. Yoğun günde personel müşteriyi gerçek bitişten **çok sonra** (toplu/boş kalınca) checkout edince `actualDuration` 1.5–4 saate fırlıyor → kart balonlaşıyor → alttaki bookingleri "yutuyor" → `computeColumns` hepsini örtüşen küme sayıp kademeli kolonlara açıyor = cascade. Veri bozuk değil; görüntü her render'da `actualDuration`'dan türediği için o gün her açılışta yeniden oluşuyordu (tekrar riski yapısal).

**Tasarım hatası:** `actualDuration`'ın asıl amacı "erken biten servis slotu boşaltsın" (squeeze-in için kartı KISALTMAK). Ama implementasyon süreyi planlanan servisi AŞINCA da kartı UZATIYORDU — şişme buradan.

**Fix (2026-06-27, PUSHED→CI `11318da`, `src/components/TimeGrid.jsx` +14/−7):** Checked-out süresi artık `Math.min(scheduledDuration, actualDuration)` — kart yalnız KISALABİLİR (erken bitiş slotu boşaltır), planlanan `svc.duration`'ı ASLA aşamaz. İki yerde birebir aynı (render `:343` + `computeColumns :154`), yoksa height/kolon ayrışır. **Squeeze-in'e dokunulmadı:** gap band'leri `getBusyIntervals` → `getExistingRangeMinutes` + servis processing-segment'lerinden türüyor, `actualDuration` görmüyor → processing'li servis hâlâ araya sıkıştırılabilir. TENANT-BAĞIMSIZ (flag yok, ortak component) → tüm tenant'lara genel. localhost'ta 20 June cascade'in gittiği doğrulandı. Geçmiş veriye dokunulmadı (cap render anında).

**Dersler:**
- **Bir "süre" alanı kart geometrisini sürüyorsa, tek yönlü olmalı.** `actualDuration` = erken-bitiş sinyali; slotu sadece KISALTMALI. Planlanan süreyi aşmasına izin vermek (geç checkout) görsel taşmaya + sahte örtüşmeye yol açar. Cap = `min(scheduled, actual)`.
- **Örtüşme/kolon motoru (`computeColumns`) ile kart yüksekliği AYNI süre kaynağını kullanmalı.** İkisi ayrışırsa ya görünmez örtüşme ya hayalet cascade olur — fix'i her iki yere birebir uygula.
- **"Grid yükseldi/kaydı" şikâyeti = bir booking'in yüksekliği gerçek süresinden büyük.** Önce o günün checked-out kayıtlarının `actualDuration`'ına bak (checkout gecikmesi), `startTime`/`time` kaymasına değil.
- **actualDuration ≠ servis süresi.** Çakışma/kapasite/analitik hesaplarında kullanılırken her zaman planlanan süreyle cap'le ([[project_processing_time]] busy-slot v2 ile tutarlı kalsın).

---

## 2026-06-26 — Treatwell prepaid booking "Pay at venue" gösterdi + komisyon geliri şişirdi

**Severity:** 🟡 Medium (para/muhasebe + çift-tahsilat riski) · **Owner:** — · **Status:** ✅ Resolved
**Impact:** Prepaid £40 booking "Pay at venue" göründü (çift tahsilat riski) + brüt £40 gelir sayıldı (net £23.20).
**Root Cause:** Global `paymentType` per-booking gerçeği eziyor; aggregator brüt = net varsayımı (komisyon modellenmemiş).
**Resolution:** "Both (per booking)" modu + parser `twFeeTotal`/`twNetPayout` + Finance `platformFee()` otomatik gider (DEPLOYED).
**Prevention:** Per-booking değişen alan tek global ayarla gösterilmez; aggregator brüt ≠ işletme net (komisyon+VAT modellenmeli).

**Ne oldu:** Jeremiah (T2185837725) Treatwell'de prepaid £40 ödedi ama booking detayında ödeme "Pay at venue" görünüyordu (personel parayı yeniden almaya çalışabilirdi). Ayrıca bu booking checkout olunca Finance/Reports £40 brüt geliri kaydediyordu — oysa Treatwell ilk-müşteri komisyonu (%35 + VAT = £16.80) sonrası işletmeye net **£23.20** geliyor → gelir şişiyordu.

**Kök neden #1 — global ayar per-booking gerçeği eziyor:** Treatwell PER-BOOKING prepaid VEYA pay-at-venue olabilir (email `Status` alanı söyler). Ama Settings → Platforms → Treatwell tek **global** `paymentType` tutuyordu (`pay_at_venue`'ya set'liydi) ve BookingDetailPanel bu global ayarı okuyordu → her Treatwell booking'i pay-at-venue çiziliyordu. **Fix:** toggle'a "Both (per booking)" eklendi; `both` seçiliyse UI booking'in kendi `twPaymentMode`'una göre çiziyor (parser email Status'tan yazıyor). whitecross `both`'a alındı.

**Kök neden #2 — aggregator brüt ≠ işletme net:** Parser/Finance fee'yi hiç modellemiyordu; brüt = net varsayımı. Treatwell komisyonu prepaid'de kaynağında kesiliyor (£23.20 yatıyor), pay-at-venue'da ayrı fatura ediliyor — her iki halde gerçek net = brüt − fee. **Fix:** parser `twFeeTotal`/`twNetPayout` (35%+VAT) yazıyor; Finance `platformFee()` ile komisyonu **otomatik gider** sayıyor (brüt korunur, netRevenue/companyNetPL/bankBalance düşer); Reports source kartı net-after-fee; booking detay (checkout öncesi+sonrası) fee kırılımı gösteriyor.

**Doğrulama notları (ileride işe yarar):**
- Checkout tw* alanlarını KORUR (prepaid booking checkout → `paidAmount=0`, `paymentMethod=CARD`, `twFeeTotal` sağ çıkar). Finance `effectiveRevenue` paidAmount=0 olunca `price` fallback'ine düşer → brüt £40 korunur.
- Finance `dateKey`'i stored alandan değil `startTime`'dan türetir (`Finance.jsx:158`) — parser dateKey yazmasa da booking görünür.

**Dersler:**
- **Bir platform per-booking değişiyorsa, tek global ayar gösterimi yanıltır.** Per-booking gerçeği (parser alanı) varsa onu kullan; global ayarı yalnız "hepsi aynı" durumunda uygula ("Both" modeli).
- **Aggregator brüt fiyatı ≠ işletme geliri.** Komisyon (özellikle new-client + VAT) modellenmezse defterler geliri şişirir. Komisyonu otomatik gider olarak işle; brüt görünür kalsın ([[project_whitecross_muhasebe]] iki-defter).

---

## 2026-06-26 — Whitecross web booking confirmation email gitmiyor + success sayfası boş — Salown migration'ının açtığı ÇOK KATMANLI regresyon

**Severity:** 🟠 High · **Owner:** — · **Status:** ✅ Resolved
**Impact:** CONFIRMED web booking'lerde confirmation email gitmiyor; success.html detay + Add-to-Calendar boş.
**Root Cause:** 3 katman — katı gate + `BREVO_API_KEY` secret 4 fonksiyonda bağlı değil + `sendBrevoEmail` boş `headers:{}` → Brevo 400. Success: auth-only rules → public read 403.
**Resolution:** Gate genişletildi + secret 4 fn'e + headers guard; success `sessionStorage` fallback (DEPLOYED). GDPR: public booking read AÇILMADI.
**Prevention:** Gönderici stratejisi değişince (Gmail→Brevo) tüm fn `secrets` listesini grep'le; migration regresyonları KATMANLI, her fix sonrası yeni test; public sayfa auth-gated veri okuyamaz.

**Ne oldu:** whitecross premium → Salown tenant migrasyonundan sonra, whitecrossbarbers.com'dan yapılan online booking'lerde (ödeme tamamlanmış, CONFIRMED) confirmation email gitmiyordu. Ayrıca success.html "Booking Confirmed" sayfası detay satırlarını ve yeni eklenen Add to Calendar butonunu göstermiyordu (sadece statik kart).

**Teşhis yöntemi:**
1. Gerçek test booking'i + `salown-panel/serviceAccountKey.json` (havuz-44f70 admin SDK) ile Firestore doğrulandı: status CONFIRMED, source Website, stripeSessionId VAR, clientEmail dolu, emailOptOut yok, `settings.emailConfirmationEnabled=true` → veri sağlam, sorun gönderimde.
2. `firebase functions:log --only salownBookingConfirmedEmailTrigger` → trigger HER booking'de ATEŞLİYOR ama `[whitecross] confirmationEmail error: ...` veriyor. Hata mesajı **her fix sonrası değişti** (katmanlı bug).
3. success.html için: REST API ile **token'sız** okuma testi → `HTTP 403` (kurallar blokluyor), tenant root doc → 200. Public-read yasağı doğrulandı.

**Kök neden — email (3 ardışık katman):** Migration'da email gönderimi whitecross-site (kendi Gmail) → salown-app trigger'larına taşındı; `FORCE_SALOWN_SENDER_TENANTS=['whitecross']` ile whitecross Brevo (noreply@salown.com)'a zorlandı. Ama:
1. **Gate çok katı:** `salownBookingConfirmedEmailTrigger` `if(!after.stripeSessionId) return` (gerçek akışta stripeSessionId vardı, asıl blocker değildi ama yine de `isOnlineSelfBooking` ile genişletildi).
2. **Secret bağlı değil:** `salownBookingConfirmationTrigger` + `salownBookingConfirmedEmailTrigger`'da `secrets:['BREVO_API_KEY']` YOKTU → `sendBrevoEmail` "BREVO_API_KEY secret not set" fırlattı. Diğer email fonksiyonlarında secret vardı, bu ikisi (ve cancel/reschedule token fonksiyonları) atlanmıştı.
3. **Boş headers:** `sendBrevoEmail` payload'a `headers:{}` koyuyordu; confirmation/cancel/reschedule header göndermediği için Brevo `400 "headers is blank"` döndü.

**Kök neden — success sayfası:** success.html booking'i client-side **giriş yapmadan** okuyor (`getDocs where bookingId`). Salown kuralları booking read'i auth-only yaptı (`firestore.rules` `match /bookings/{docId}` → `isSuperAdmin()||isTenantAny()`) → public sorgu 403 → `data` null (try/catch yuttu) → ne detay ne buton. Buton kodu doğruydu; sorun public-read yasağıydı.

**Fix (2026-06-26, DEPLOYED):**
- functions (`firebase deploy --only functions:salown:<fn>`): gate genişletildi (`isOnlineSelfBooking`=source website/salown); `secrets:['BREVO_API_KEY']` **4 fonksiyona** eklendi (2 confirmation trigger + `salownCancelByToken` + `salownRescheduleByToken`); `sendBrevoEmail` headers'ı sadece doluysa ekliyor (`Object.keys(headers).length>0`).
- success.html (gh-pages, commit 62ef765b): Firestore public-read 403 olunca `sessionStorage.pendingBooking` (Stripe'a gitmeden saklanan, aynı tab/origin korunur) fallback → satırlar + buton ondan dolar; `buildCalendarUrl` startTime yoksa date+time parse eder. **GDPR: public booking read AÇILMADI.** NOT: çıplak `?id=` URL'i yeni sekmede çalışmaz (sessionStorage yok), gerçek ödeme akışında çalışır.

**Dersler:**
- **Trigger ateşliyor ama email yok = erken-return VEYA gönderim hatası.** `functions:log`'da fonksiyonun kendi `[tenant] ... error:` satırını ara; boş log satırı = erken return. Hata mesajı kök nedeni doğrudan verir — tahmin etme.
- **Email gönderici stratejisi değişince (Gmail→Brevo) o yola giren TÜM fonksiyonların `secrets` listesini grep'le.** `FORCE_SALOWN_SENDER_TENANTS` gibi bir bayrak, secret'i olmayan fonksiyonları sessizce kırar.
- **Migration regresyonları KATMANLIDIR:** bir fix sonraki hatayı açar. Her fix sonrası yeni test + log; "bu son katman" varsayma.
- **Public sayfa (success/cancel/manage) auth-gated veri okuyamaz.** Kurallar sıkılaşınca client-side public okumalar sessizce 403 alır (try/catch yutar → boş ekran). Çözüm: client'ta zaten olan veriyi (sessionStorage) kullan VEYA sınırlı-alan döndüren public Cloud Function — **booking'i public-readable YAPMA (GDPR).**
- **Tanı araçları:** `salown-panel/serviceAccountKey.json` admin SDK okuma + REST API token'sız okuma (rules testi) + `firebase functions:log`.

---

## 2026-06-26 — Treatwell booking grid'de görünmedi (Arda T2185837725) — barber tam-ad eşleşmesi

**Severity:** 🟡 Medium · **Owner:** — · **Status:** ✅ Resolved
**Impact:** Booking yazıldı + notification geldi ama hiçbir barber kolonunda görünmedi ("data valid, UI invalid").
**Root Cause:** Treatwell tam ad ("Arda Uzun") ↔ sistem ilk ad ("Arda"); exact matcher eşleşmedi + `barberName` yazılmıyordu.
**Resolution:** Parser'da `resolveBarberName()` (ambiguity-safe first-name map) + `barberName` write + telefon regex fix (DEPLOYED).
**Prevention:** Notification var + grid yok = **display** sorunu (create değil); eşleşme matcher'da fuzzy ile değil, kaynakta kanonik isme map'leyerek — [[feedback_barber_name_matching]].

**Ne oldu:** Treatwell'den Arda'ya booking geldi (T2185837725, Jeremiah Lewis, 26 June 15:00, The Full Experience £40). Email düştü, **notification de geldi**, ama Calendar grid'de hiçbir kolonda görünmedi. Owner telefon formatından (`+1 510-228-6000`, US numarası) şüphelendi.

**Teşhis yöntemi:** Notification geldiyse booking Firestore'a **yazılmış** demektir (notification trigger booking create'te ateşler) → sorun parse-and-create DEĞİL, görüntüleme. Service account ile Firestore doğrulandı: booking `status=CONFIRMED` mevcut ama `barberId="arda uzun"`, `barberName=undefined`. Sistemdeki barber sadece `name="Arda"` (docId `barber-1777655430086`).

**Kök neden — aggregator tam-ad vs sistem ilk-ad:** Treatwell `with **Arda Uzun**` (tam ad) gönderiyor → parser `barberId = barber.toLowerCase() = "arda uzun"`. `matchesBarber()` (case-insensitive exact, [[feedback_barber_name_matching]] gereği fuzzy YOK) "arda uzun" ≠ "arda" → booking hiçbir barber kolonuna düşmüyor → grid'de görünmez. **İkincil:** Treatwell yeni-booking `set()`'i `barberName`'i HİÇ yazmıyordu (tek istisna — Booksy/Fresha/Treatwell-reschedule hepsi yazıyor) → barberName fallback'i de yoktu. **Üçüncül (bağımsız):** telefon regex `[+\d][\d\s]+` ilk `-`'de duruyordu → `+1 510` olarak kesik kaydedildi (booking'i bozmaz, sadece veri kaybı).

**Fix (2026-06-26, DEPLOYED — `firebase deploy --only functions`):**
1. YENİ `resolveBarberName(rawName, barberCache)` helper: exact full-name match → yoksa first-name match, ama **SADECE tek barber'ın ilk adı eşleşiyorsa** (iki barber aynı ilk adı paylaşırsa tahmin etmez, raw döner). Matcher'a fuzzy eklemek yerine **kaynakta (parser) çözüm** — ilke korundu.
2. Treatwell parser loop başında `tenants/{tid}/barbers` cache fetch; `barber = resolveBarberName(rawBarber, barberCache)` (new + reschedule ikisi de yararlanır).
3. Eksik `barberName: barber` Treatwell new-booking write'ına eklendi.
4. Telefon regex → `[+(]?[\d][-\d\s().]*\d` (uluslararası numara `-`/parantez dahil tam yakalar).
5. Mevcut booking doğrudan düzeltildi (script): `barberId=arda`, `barberName=Arda`, telefon tam → Arda kolonunda göründü. (Dedup `hasExternalIdMulti` yüzünden re-parse etmezdi.)

**Dersler:**
- **Notification geldi + grid'de yok = create değil DISPLAY sorunu.** Önce Firestore'da doc'u doğrula; "parser patladı" sanma. Trigger ateşlediyse veri zaten yazılı.
- **Aggregator barber adı formatı tenant'la aynı olmayabilir** (Treatwell tam ad, sistem ilk ad). Eşleştirme matcher'da fuzzy ile DEĞİL, parser'da kanonik isme map'leyerek çözülür ([[feedback_barber_name_matching]]: "wrong source name = fix the source").
- **First-name match'te ambiguity koruması şart:** birden fazla barber aynı ilk adı paylaşıyorsa tahmin etme, raw bırak — yanlış barber'a yazmaktansa görünmez kalsın (teşhis edilebilir).
- **`barberName` her parser write'ında olmalı** (matcher fallback'i). Bir parser yolunda eksikse grid eşleşmesi tek `barberId`'ye bağımlı kalır ve kırılgandır — üç parser write'ını da grep'le doğrula.

---

## 2026-06-24 — Loyalty email belirli bir client'a gitmiyor (Adam Wu) — bozuk adres + stuck flag + propagasyon eksiği

**Severity:** 🟡 Medium · **Owner:** — · **Status:** ✅ Resolved
**Impact:** Loyalty email gitmedi ama panel "sent" dedi; retry hiç tetiklenmedi (optimistik UI yanıltması).
**Root Cause:** 3 zincir — email format validasyonu yok (`gmailcom`) + CF try-catch'siz → bayrak `true` takıldı + client edit booking'e propagate olmuyor.
**Resolution:** `isValidEmail` tüm girişlerde + try/catch bayrak sıfırlama + gerçek durum + Retry + batch propagate (commit `168bd35`/`9bf03a6`, DEPLOYED).
**Prevention:** Email'de asla optimistik "sent" (durum sunucudan); dış API hep try/catch; retry `false→true`; client kimliği booking'e snapshot → edit'te propagate.

**Ne oldu:** Adam Wu'nun checkout'unda loyalty email gitmedi. Panelden "Send loyalty email" denince ekran "sent" diyordu ama email gitmiyordu. Aynı saatte Alex üzerinden satış yapılan başka client'a email sorunsuz gitti → sistem geneli sağlam, soruna client'a özel.

**Teşhis:** Client email'i bozuk girilmişti — `adamwu838@gmailcom` (gmail.com'da **nokta eksik**). Geçersiz adres → Brevo 400.

**Kök neden (zincir, 3 katman):**
1. **Bozuk adres kaydedilebiliyordu:** Hiçbir giriş noktasında email format validasyonu yoktu (sadece "boş mu" kontrolü). `name@gmailcom` kabul ediliyordu.
2. **CF try-catch'siz → stuck flag:** `salownSendLoyaltyEmail` Brevo'ya gönderirken çöktü; `sendLoyaltyEmail` bayrağını `false`'a sıfırlayan satır hiç çalışmadı → booking'de bayrak **`true` takılı** kaldı. Fonksiyon sadece `false→true` geçişinde tetiklendiği için tekrar "Send" deyince HİÇ tetiklenmiyordu (panel "sent" diyor, hiçbir şey olmuyor — optimistik UI yanıltması).
3. **Client edit booking'e yansımıyordu:** Clients sayfasından email düzeltilse bile booking dökümanındaki `clientEmail` eski/bozuk kalıyordu → booking detail'den gönderince yine bozuk adrese gidiyordu.

**Fix (2026-06-24, DEPLOYED — commit `168bd35` + `9bf03a6` hosting, `salownSendLoyaltyEmail` functions deploy):**
1. `src/utils/email.js` (YENİ `isValidEmail`) → format validasyonu tüm giriş noktalarında: `BookingPage`, `AddClientModal`, `Clients` (edit), `WalkInForm`, `NewBookingSheet` (staff source pushlandı, bundle ertelendi).
2. `salownSendLoyaltyEmail`: gönderim öncesi format reddi (`loyaltyEmailBounced` işaretler) + `sendBrevoEmail` `try/catch` → başarısızlıkta çökmeden bayrağı sıfırlar + `loyaltyEmailError` kaydeder. Stuck flag bir daha oluşmaz.
3. `BookingDetailPanel`: optimistik "sent" KALDIRILDI → gerçek durum booking'den (live snapshot); başarısızlıkta "⚠️ Couldn't send" + **🔄 Retry**; manuel trigger artık önce `false` sonra `true` yazıyor → takılı bayrağı kırar.
4. `Clients.jsx handleEditClient`: client edit'i artık **tüm assigned booking'lere batch propagate** ediyor (manualId / eski email / eski telefon ile eşleştirip `clientName/clientEmail/clientPhone` günceller). Telefon stabil olduğu için email zaten düzeltilmiş olsa bile booking'i yakalar.

**Dersler:**
- **Email'i ASLA optimistik "sent" gösterme.** Gerçek gönderim sonucu sunucudan (bayrak) gelmeli; aksi halde başarısız gönderim "başarılı" görünür ve teşhis günlerce gecikir.
- **Dış API çağrısı (Brevo) HER ZAMAN try/catch içinde.** Yakalanmayan hata, sonraki idempotency bayrağını sıfırlamayı atlar → "stuck flag" → fonksiyon bir daha tetiklenmez.
- **Tetikleyici bayrak (`false→true`) tasarımında, manuel retry önce `false` yazıp sonra `true` yapmalı** — yoksa takılı `true` durumundan çıkış yok.
- **Client kimliği (isim/telefon/email) booking'e snapshot'lanıyor** → client doc'unu güncellemek booking'leri otomatik güncellemez; edit'te eski kimlikle eşleştirip booking'lere propagate ET.
- **Giriş validasyonu = ilk savunma hattı.** Bozuk veri hiç girmezse alt katmanlardaki crash senaryoları da tetiklenmez.

---

## 2026-06-24 — Treatwell booking sisteme düşmedi (Muhamed T2185616487) — İKİ üst üste bug

**Severity:** 🟠 High (**11 gün** tüm Treatwell yeni booking'leri kayıp) · **Owner:** — · **Status:** ✅ Resolved
**Impact:** Treatwell yeni booking Firestore'a hiç yazılmadı; 13→24 Haz arası tüm Treatwell yeni booking'leri sessizce kayıp.
**Root Cause:** `orderRef is not defined` (13 Haz refactor `96d6e7a` tanımı sildi, 3 kullanımı bıraktı → ReferenceError) + seen-skip yarım fix.
**Resolution:** `const orderRef` geri + seen-skip Fresha/Treatwell'de tamamen kaldırıldı, Booksy paritesi (DEPLOYED).
**Prevention:** Booking düşmüyorsa ÖNCE `functions:log`; refactor-orphan → değişkenin tüm kullanımlarını grep (`node -c` runtime hatasını yakalamaz); bir parser'da bug bulunca diğer ikisini de grep'le.

**Ne oldu:** Treatwell'den yeni booking yapıldı (T2185616487, Muhamed Kanidagli, 24 June 10:45, The Full Experience £40, Alex). Email salon Gmail'ine düştü ama booking Firestore'a hiç yazılmadı — Calendar'da iz yok. Aynı gün Booksy booking'i sorunsuz düştü → sorun ortak (Firestore rules/veri) DEĞİL, Treatwell'e özel.

**Teşhis yöntemi (önemli):** Firestore'a ADC olmadan bakılamadı; bunun yerine `firebase functions:log --only salownParseEmails | grep -i treatwell` çalıştırıldı → **`[whitecross] Treatwell parse error: orderRef is not defined`**. Loglar kök nedeni doğrudan verdi. (Booking düşmüyorsa ÖNCE parser loglarına bak — tahmin etme.)

**Kök neden #1 — `orderRef is not defined` (ASIL sebep, refactor-orphan):** Orijinal kod (commit `7f94588`, 2026-06-05) `const orderRef = refMatch ? refMatch[1] : ...` tanımlıyor, `externalId`'yi ondan türetiyordu. **2026-06-13 refactor'u (commit `96d6e7a` "source")** `externalId`'yi `TREATWELL-${refMatch[1]}` olarak sadeleştirdi ve `const orderRef` satırını sildi — ama `orderRef`'i kullanan 3 yeri (`treatwellRef: orderRef` + reschedule map push'u) SİLMEDİ. Öksüz kalan değişken her Treatwell yeni-booking + reschedule `set()`'inde `ReferenceError` atıyordu. Try/catch yakalayıp `result.errors`'a koyuyor, booking sessizce düşüyordu. **11 gün boyunca (13→24 Haziran) tüm Treatwell yeni booking'leri kayıptı.**

**Kök neden #2 — seen-skip (maske/ikincil):** Treatwell parser'ı (`:2279`) `if (seen && !isCancellation && !isReschedule) { skip }` ile okunmuş yeni booking'i atlıyordu. Owner email'i Gmail'de açınca tetiklendi. Bu 2026-06-20 "Damian 21 June" (Bug Kalıbı #8) olayının Treatwell tekrarı. 2026-06-20'de seen-skip Booksy'de TAM kaldırıldı ama aynı commit (`472fbec`) Fresha + Treatwell'e sadece `&& !isReschedule` istisnası ekledi — yarım fix. Yorum "No seen-skip for reschedules/cancels" diyordu, "halloldu" sanıldı.

**Fix (2026-06-24, ikisi de):**
1. `orderRef` tanımı geri eklendi: `externalId`'nin hemen altına `const orderRef = refMatch[1];` (`functions/index.js:2293`).
2. seen-skip Fresha (`:1978`) + Treatwell (`:2279`)'de tamamen kaldırıldı, Booksy paritesi. `grep "if (seen"` → sıfır kalıntı.
- `node -c` OK. `firebase deploy --only functions --project havuz-44f70` DEPLOYED (iki kez transient "Internal error", retry'da geçti).

**Dersler:**
- **Booking düşmüyorsa ÖNCE `functions:log`'a bak.** Loglar `orderRef is not defined` diyordu; tahminle uğraşmak yerine 1 komutla kök neden.
- **Refactor-orphan:** Bir değişkenin tanımını/adını değiştirirken TÜM kullanımlarını grep'le (`grep -n "orderRef" functions/index.js`). Tanım silindi ama kullanım kaldı = sessiz ReferenceError. `node -c` bunu yakalamaz (runtime hatası), sadece çalıştırma/lint yakalar.
- **Parser izolasyonu:** Her parser ayrı fonksiyon; birinde yapılan refactor diğerini etkilemez ama AYNI bug kalıbı (seen-skip, orderRef-türü tanımlar) hepsinde tekrar eder. Bir parser'da bug bulunca diğer ikisinde de aynı satırı grep'le.
- **Yarım fix > hiç fix tehlikesi:** Çoklu parser'a fix uygularken üçünü de fiziksel doğrula; "benzer yorum var" ≠ "aynı davranış".

---

## 2026-06-22 — Team Members'ta barber revenue "NaN" (Arda)

**Severity:** 🟢 Low (tek ekran) · **Owner:** — · **Status:** ✅ Resolved
**Impact:** Team Members'ta Arda'nın revenue değeri `£NaN` göründü.
**Root Cause:** `parseFloat("£20.00")` → NaN (import kalıntısı para-simgeli string); tek NaN tüm toplamı zehirler.
**Resolution:** `pp()` canonical para-parser + aynı-sınıf sweep (commit `198ffde`).
**Prevention:** Firestore para alanları ham `parseFloat`/`Number` ile toplanmaz; hep `pp()`/`parsePrice()` ya da `(Number(x)||0)` guard.

**Ne oldu:** salown-app → Team Members (Barbers.jsx) ekranında Arda'nın revenue değeri `£NaN` görünüyordu.

**Kök neden:** `src/pages/Barbers.jsx:88` revenue'yu `parseFloat(bk.price || 0)` ile topluyordu. Arda'nın booking'lerinden en az birinde `price` alanı sayısal değil para-simgeli string (`"£20.00"` — Booksy/Fresha import kalıntısı). `parseFloat("£20.00")` → `NaN`; tek bir NaN tüm toplamı NaN'e çevirir ve `.toFixed(0)` → `"NaN"`. Bu yüzden sadece o tür booking'i olan barber etkilendi.

**Fix (2026-06-22):**
1. Canonical para-parser `pp()` (`src/utils/bookingUtils.js`) import edildi — `£`/virgül temizler, sonuç NaN ise `|| 0` ile yutar.
2. `parseFloat(bk.price || 0)` → `pp(bk.price)`.

**Ders:** Firestore'daki para alanları (`price`, `paidAmount` …) ham `parseFloat`/`Number()` ile toplanmamalı veya gösterilmemeli — import edilmiş veride para simgeli/boş string olabilir. Daima `pp()`/`parsePrice()` kullan ya da `(Number(x)||0)` ile guard'la; tek NaN bütün toplamı zehirler.

**Sweep (aynı gün):** Tüm para okumaları tarandı, aynı sınıftaki kalan yerler kapatıldı (commit `198ffde`): `BookingPage.jsx` + `SalonSitePage.jsx:475` + `Products.jsx:222` müşteriye-dönük `Number(price).toFixed()` → `(Number(price)||0)`; `Finance.jsx` tip toplamları → `parsePrice(b.tip)`. Geri kalan okumalar zaten canonical (`replace(/[£,]/g,'')||0`) veya Finance-owned numeric.

---

## 2026-06-20 — Damian Adams-Peatling: geriye reschedule + zincir reschedule çöküşü

**Severity:** 🟠 High · **Owner:** — · **Status:** ✅ Resolved
**Impact:** Booking hiç düşmedi → sonra zincir reschedule (31 Jul→1 Jul) uygulanmadı, booking 31 Jul'da takıldı.
**Root Cause:** 3 katman — seen-skip booking kaybı + çok-kelimeli isimde string-parse ID kırılması + "hep ileri tarih" yön varsayımı.
**Resolution:** Booksy seen-skip kaldır + temiz `oldDate`/`oldTime` sorgu + `lastRescheduleEmailMs` ordering guard (`0a03411`/`42def41`).
**Prevention:** Reschedule YÖNDEN BAĞIMSIZ (en yeni email zamanı kazanır); "seen" email booking kaybına dönüşmez (idempotency guard); türev-ID string parse çok-kelimeli isimde kırılır.

**Ne oldu:**
1. Damian Booksy'den **Cut Deluxe** booking yaptı, 21 June için.
2. Booking **ilk başta sisteme hiç düşmedi** — Firestore'da iz yok, hata da yok.
3. Sonra Damian booking'i **21 June → 31 July**'a aldı (reschedule). Sistem bunu uyguladı.
4. Arda'yla "5 haftadan fazla fark var, bu adam bizi mi deniyor?" dedik; aradık. Müşteri
   "something came up, yanlış olmuş" dedi. **1 July**'a alalım dedik. Salown kuralı gereği
   reschedule'ı **müşterinin kendisi Booksy'den** yapması gerektiğini söyledik.
5. Damian kendisi **31 July → 1 July**'a aldı — yani ilk kez **daha ERKEN** bir tarihe.
6. Bu son reschedule **uygulanmadı**; booking 31 July'da takılı kaldı.

**Kök nedenler (üç ayrı katman):**
- **(2. adım) Seen-skip booking kaybı:** Onay email'i parser (5 dk periyot) çalışmadan önce Gmail'de
  açılmıştı (seen). `if (seen && !isCancellation) skip` okunmuş yeni booking'i sessizce düşürüyordu.
- **(6. adım) Zincir reschedule kırık eşleşme:** Booking 21Jun→31Jul taşınınca doc hâlâ orijinal
  ID'sini taşıyordu. İkinci reschedule (31Jul→1Jul) için booking'i mevcut tarih/saatiyle bulmak
  gerekiyordu; eski fallback `oldExternalId` string'ini parçalayıp tarih çıkarmaya çalışıyordu ve
  **"Damian Adams-Peatling"** çok-kelimeli isminde parçalama kayıyordu → booking bulunamadı.
  Ayrıca o email de seen'di → C sorunu üst üste bindi.
- **(Tasarım kusuru) Yön varsayımı:** Reschedule logic'i, müşterinin **hep ileri tarihe** alacağı
  varsayımıyla tasarlanmıştı. Doğru kıstas **en yeni email'in geliş zamanı (`emailDateMs`)** — booking
  tarihinin yönü değil. Geriye reschedule (1 July) bu varsayımı kırdı.

**Fixes (2026-06-20, commit 0a03411 + 42def41):**
1. **C** — Booksy'de seen-skip tamamen kaldırıldı (her yol idempotent). Yeni booking ve reschedule
   okunmuş olsa bile işlenir. (Fresha/Treatwell'de şimdilik sadece reschedule için — yeni booking açık, bkz PARSER_NOTES #8.)
2. **A** — Reschedule email'inden temiz `oldDate`/`oldTime` taşınıp canlı booking `where date==/time==`
   ile bulunuyor; kırılgan string parse kaldırıldı (Booksy'ye özgü).
3. **B** — `lastRescheduleEmailMs` ordering guard: eski/gecikmiş email yeniyi ezemez (üç parser).
4. Yanıltıcı `"higher date wins"` yorumları (Fresha/Treatwell) "en yeni email kazanır" diye düzeltildi.

**Doğrulandı:** Parser run otomatik 31 July→1 July'ı çekti, kullanıcı müdahalesi olmadan. ✅

**Dersler:**
- Reschedule YÖNDEN BAĞIMSIZ — erken/geç fark etmez, daima en yeni email'in zamanına bak.
- "Seen" bir email'i asla booking kaybına çevirme — idempotency guard'lar seen-skip'in yerini alır.
- Date/time türevli ID üzerinden string parse = çok-kelimeli isimde kırılır; stabil ref yoksa
  booking'i mevcut tarih/saatiyle sorgula.

---

## 2026-06-17 — Jakov Zorić Duplicate Booking

**Severity:** 🟡 Medium · **Owner:** — · **Status:** ✅ Resolved
**Impact:** Aynı Booksy rezervasyonu iki farklı doc olarak Firestore'a yazıldı.
**Root Cause:** İki parser aynı inbox'ı okuyor (Gmail API + IMAP), farklı `externalId` üretiyor (base64 decode eksikti); Gmail API `\Seen` set etmiyor.
**Resolution:** `extractTextFromRaw` base64 fix + slot tombstone + whitecross-site Booksy parser disabled.
**Prevention:** İki parser aynı inbox okursa `externalId` formatları tam eşleşmeli; tombstone = son güvenlik ağı.

**Ne oldu:** Aynı Booksy rezervasyonu iki farklı doc olarak Firestore'a yazıldı.

**Kök neden:** `parseBooksyConfirmations` (whitecross-site, Gmail API) ve `salownParseEmails` (salown-app, IMAP) aynı anda çalışıyordu. Gmail API `\Seen` flag'ini set etmez, IMAP aynı emailı yeniden gördü. İki parser farklı `externalId` üretiyordu:
- Gmail API: `BOOKSY-1780000805806` (base64 MIME part decode doğru)
- IMAP: `BOOKSY-Jakov-Zorić-29-May-2026-15:30` (base64 decode yoktu, booking# bulunamadı)

**Fixes (2026-06-17):**
1. `extractTextFromRaw` artık `text/plain` MIME part'ı önce çekiyor, base64-decode yapıyor
2. Slot tombstone: her başarılı Booksy import'ta `parserTombstones/SLOT-Booksy-{date}-{time}`
3. `parseBooksyConfirmations` + `parseBooksyCancellations` whitecross-site'da disabled

**Ders:** İki parser aynı inbox'ı okuyorsa, externalId formatları tam eşleşmeli. Tombstone = son güvenlik ağı.

---

## GitHub Key Exposure

**Severity:** 🔴 Critical (secret sızıntısı) · **Owner:** — · **Status:** ✅ Resolved · **Date:** ⚠️ kayıtta yok
**Impact:** `serviceAccountKey.json` GitHub'a push edildi (admin SDK credential sızıntısı).
**Root Cause:** Key `.gitignore`'da değildi / yanlışlıkla commit edildi.
**Resolution:** Key revoke + yeni key oluşturuldu.
**Prevention:** `serviceAccountKey.json` asla commit edilmez, `.gitignore`'da olmalı.

**Ne oldu:** `serviceAccountKey.json` GitHub'a push edildi.

**Çözüm:** Key revoke edildi, yeni key oluşturuldu.

**Kural:** `serviceAccountKey.json` asla git'e commit edilmez. `.gitignore`'da olmalı.

---

## Notlar

- `checkDuplicateInFirestore` (whitecross-site script.js:471): locked rules altında fails-open — kabul edilebilir, booking devam eder.
- `salownGetBusySlots` + `salownRescheduleByToken`: expired PENDING bookings'i (`expiresAt < now`) skip eder — abandoned Stripe sessions 0-20dk arasında slot ghost-block etmez.
