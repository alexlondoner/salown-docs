# BUSY_SLOT_V2_RISKS.md — Risk & Sorun Defteri

> Amaç: processing-time / busy-slot v2 işinden doğabilecek sorunları **önceden** kayda
> geçirmek; bir şey ters giderse zaman kaybetmeden nereye bakacağımızı bilmek.
> Tasarım: `BUSY_SLOT_V2.md`. Bu dosya **çalışan** bir günlük — her faz ilerledikçe güncelle.

## 🔴 GLOBAL KILL-SWITCH
Bir sorun çıkarsa ilk hamle: tenant doc → **`features.processingTime = false`**.
Motor v1 davranışına döner (tek-aralık). Çünkü `getBusyIntervals`, processing yokken
`getExistingRangeMinutes`'e **delege eder** → davranış birebir eski.

---

## UYGULAMA DURUMU (2026-06-26) — DİNAMİK/servis-bazlı, CANLI (flag kaldırıldı)
> Aşağıdaki "flag KAPALI / flag AÇILINCA" çerçevesi TARİHSEL. 2026-06-26'da tenant flag'i
> (`features.processingTime`) tamamen kaldırıldı (commit f958aee + staff bundle 5dbdf31);
> aktivasyon artık servisin `segments` config'i. Ön-uçuş: yalnız herohairs'te 1 processing
> servisi → diğer tenant'larda davranış değişmedi. Faz 2 "kalan riskler" tablosu artık
> "izlenecek" değil **canlı** — test 25/25 yeşil. Açık kalanlar: Faz 5a (iCal split), 5b
> (online/parser snapshot + public gap).

### eski başlık (tarihsel): UYGULAMA DURUMU (2026-06-24) — hepsi flag KAPALI, deploy YOK
- ✅ Faz 1 (motor additive) · ✅ Faz 1-UI (Services.jsx config) · ✅ Faz 2 (rewire+16 test)
- ✅ Faz 1.5 (snapshot @ PANEL create: walk-in + booking formu) · ✅ Faz 3-lite (gap bandı, day view)
- ✅ Faz 5a (salownIcalFeed 2-VEVENT split)
- ⚠️ **Kasıtlı wire EDİLMEYEN (pilot için gerekirse eklenecek):**
  - Public `BookingPage` create → processing snapshot yazmıyor (online müşteri booking'i gap taşımaz)
  - Email parser'lar (Treatwell/Fresha/Booksy) → snapshot yazmıyor (import edilen booking gap taşımaz)
  - Day-view **column-split** + squeeze-in rozeti (2. kart hâlâ üst üste biner) — risk 3.1
  - Dashboard **hafta görünümü** processing render'ı yok

## Faz 1 (mevcut — additive) — durum: ✅ uygulandı, akış değişmedi
`conflictUtils.js`'e yalnızca **yeni export'lar** eklendi (`getServiceSegments`,
`getBusyIntervals`, `intervalsOverlap`). `getExistingRangeMinutes` ve `hasTimeConflict`
**hiç değişmedi** → mevcut çakışma akışı bayt-bayt aynı. `features.processingTime: false`
yeni tenant default'u eklendi (mevcut tenant'lar falsy = kapalı).

**Risk yok ama doğrula:** `npm run build` sıfır error. Yeni fonksiyonlar henüz hiçbir yerden
çağrılmıyor (dead code = güvenli).

**Faz 1-UI (servis config) — ✅:** `Services.jsx` editörüne flag-gated processing input'ları.
Servis save'i `data.processing` yazıyor (gap>0 ise obje, yoksa null). Risk: servis doc'una
yeni `processing` alanı yazımı — owner-auth update, Firestore rules'a takılırsa save sessiz
console.error olur (try/catch). Flag kapalı tenant'ta UI hiç render olmaz.

---

## Faz 2 (motor rewire) — durum: ✅ uygulandı + testler YEŞİL, flag HÂLÂ KAPALI
`hasTimeConflict` artık `getBusyIntervals` + `intervalsOverlap` kullanıyor.
**Flag-off garantisi:** `processingEnabled` falsy (tüm mevcut caller'lar göndermiyor) →
`getBusyIntervals` anında `[getExistingRangeMinutes(b)]` döner; candidate tek span →
`intervalsOverlap(single, single)` = `start<end' && end>start'` = **eski satırla birebir**.
Yeni opsiyonlar (geriye dönük uyumlu, default'ları v1): `processingEnabled`, `candidateSegments`, `serviceOf`.
Testler: `src/utils/conflictUtils.test.js` — `npm test` → **16/16**. Build ✅.
> Not: "Gerçek export golden diff" testi yapısal delegasyon sayesinde teknik olarak
> gereksiz (flag-off → aynı fonksiyon), ama istenirse eklenebilir.

### Faz 2 kalan riskler (flag AÇILINCA — Faz 4 öncesi izlenecek)

| # | Risk | Belirti | Nerede bak | Hızlı düzeltme |
|---|---|---|---|---|
| 2.1 | `hasTimeConflict` çok-aralıklıya geçince çift-booking koruması bozulur | Aynı berber+saate iki booking girer VEYA boş slot "dolu" görünür | `conflictUtils.js` hasTimeConflict; caller'lar (BookingForm:114/150, BookingDetailPanel:986, Dashboard WalkIn, BookingPage:~400) | flag kapat; parity testini çalıştır |
| 2.2 | Reschedule self-conflict (`ignoreBookingId`) regression | Booking kendi saatine reschedule edilemiyor | hasTimeConflict ignoreBookingId dalı | ignoreBookingId mantığını koru — v1 ile aynı kalmalı |
| 2.3 | `barberValue` lowercase invariant kırılır | Yanlış berberde çakışma/çakışmama | caller'lar barberKey lowercase veriyor mu | BUSINESS_RULES "barberValue lowercased" kuralı |
| 2.4 | Duration fallback zinciri değişir | Walk-in / online booking yanlış süre kaplar | getExistingRangeMinutes (DOKUNMA) | base hesabı hep getExistingRangeMinutes'tan gelmeli |

**Kural:** Faz 2'de characterization + parity testleri YEŞİL olmadan + flag açılmadan
merge yok. Test runner yok → Faz 2'de **vitest** eklenecek (devDep, runtime'a etkisiz).

---

## Faz 3 (grid render)

| # | Risk | Belirti | Nerede bak |
|---|---|---|---|
| 3.1 | Day view kolon-ayırma yok → gap'e nested kart üst üste biner | İki kart çakışık görünür | `TimeGrid.jsx:294` kart pozisyonu (left/right sabit 5px) |
| 3.2 | Processing bölgesi görseli yanlış yükseklik/offset | Taralı alan kaymış | slotHeight/15 matematiği |
| 3.3 | Squeeze-in rozeti yanlış booking'e | Normal booking "squeeze-in" görünür | render'da gap-fill tespiti |

Render **çakışma mantığından bağımsız** — buradaki bug booking'i bozmaz, sadece görseli.

---

## Faz 5a (salownIcalFeed segment split) — TREATWELL'E YANSIR, DİKKAT

| # | Risk | Belirti | Nerede bak | Hızlı düzeltme |
|---|---|---|---|---|
| 5.1 | Feed gap'i yanlış açar/hiç kapatmaz | Treatwell'de çift-booking VEYA dolu slot boş görünür | `functions/index.js:1373` salownIcalFeed; VEVENT span (1426) | feed'i tek-VEVENT (full span) haline geri al = eski davranış |
| 5.2 | Segment'li VEVENT'lerin UID'leri çakışır | Treatwell event'leri birbirini ezer | UID `${docId}@salown.com` (1428) — iki segment için UID-1/UID-2 gerekir | her segmente farklı UID suffix |
| 5.3 | ALLOWED statü seti farklı (CHECKED_OUT busy) | Geçmiş checkout Treatwell'i bloklar | ALLOWED set (1398) | mevcut davranışı koru, sadece span'i böl |
| 5.4 | iCal poll gecikmesi → gap'e çift kanal düşer | Treatwell + walk-in aynı boşluğa | (kabul edildi — operasyonel) | feed cache header taze (`no-cache` zaten var) |

---

## Çapraz-kesen riskler (her zaman akılda tut)

| # | Risk | Not |
|---|---|---|
| X.1 | **İki kod tabanı paritesi** | `salownGetBusySlots` (functions), `BookingPage.jsx`, ve `whitecross-site/script.js` ayrı slot mantıkları taşıyor. Biri güncellenip diğeri unutulursa public ile panel farklı davranır. BUSINESS_RULES uyarısı. |
| X.2 | **Source → channel key normalizasyonu** | `getServiceSegments` source'u `lowercase + [\s_]→-` ile normalize ediyor. `sourceColors.js` / parser source değerleriyle **aynı** olmalı; uyuşmazsa processing sessizce uygulanmaz (gap açılmaz). |
| X.3 | **Segment snapshot eksikliği** | Booking create'te `booking.processing` snapshot yazılmazsa, servis sonradan değişince geçmiş booking yanlış segmentlenir. Create akışına eklenmeli (Faz 1.5/2). |
| X.4 | **BLOCKED korunması** | getBusyIntervals BLOCKED'ı her zaman solid bırakıyor — manuel blok asla gap açmamalı. Değiştirme. |
| X.5 | **Firestore rules** | Yeni `processing` / `channelProfiles` alanları service/booking yazımında rules'a takılabilir. Rules değişikliği EN SON, canlı rules'ı API'den çekerek. |

---

## Değişiklik günlüğü
Tüm kod edit'leri ayrıca memory `edit_log_salown.md`'ye yazılır. Bu dosya sadece
**risk/sorun** odaklı; faz ilerledikçe yukarıdaki tabloları "✅ doğrulandı / ⚠️ açık"
diye işaretle.
