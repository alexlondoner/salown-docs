# Staff Settings & Availability — Denetim + Toparlama Planı

> **Tarih:** 2026-07-12 (rc3+1 günü — SADECE analiz, kod yok) · **Tetik:** Muhamed on-leave (14 Tem–19 Ağu)
> girildi ama Dashboard grid'inde görünmeye devam etti + owner: "staff settings tam bir kaos, ayarlar çok dağınık."
> **Durum:** 🔴 Denetim tamam, fix'ler TS-freeze sonrası (2026-07-14+). İlgili: INCIDENTS 2026-07-12 (leave silme), ROADMAP G1.

---

## 1 · Anlık vaka: Muhamed neden hâlâ grid'de?

Muhamed'in doc'u DOĞRU (`barber-1781007454543`: `status:'leave'`, `leaveFrom:'2026-07-14'`,
`leaveUntil:'2026-08-19'`, `active:false`). Sorun veride değil, **grid'in leave'i hiç okumamasında**:

- `Dashboard.tsx:406` `activeBarbersForDay` kolonları `workingDays → shiftChanges → dayHours` ile kurar;
  **`status`/`active`/`leaveFrom-Until` HİÇ kontrol edilmez.** Leave boyunca da kolon çizilir.
- Not: bugün 12 Tem — leave 14'ünde başlıyor, yani bugün görünmesi zaten doğru. Ama 14 Tem–19 Ağu
  arasına gidilse de görünecek; bug tarih değil, kaynak.

## 2 · Asıl bulgu: aynı soruya 5 yüzey 5 farklı cevap veriyor

"Muhamed X gününde müsait mi?" sorusunun yüzeylere göre cevabı (canlı kod, satır atıflı):

| Yüzey | Neye bakar | Muhamed için sonuç (leave 14 Tem–19 Ağu) |
|---|---|---|
| **Dashboard grid** (`Dashboard.tsx:406`) | workingDays + shiftChanges + dayHours | ❌ Leave boyunca da GÖRÜNÜR (owner'ın şikayeti) |
| **Panel formları** WalkIn/Booking/BlockTime (`getAvailableBarbersForDate`, `bookingUtils.ts:163`) | + status/leave tarih aralığı ✅ | ✅ TEK DOĞRU: 13 Tem'e kadar bookable, aralıkta gizli, 20 Ağu'da döner |
| **Public BookingPage** (`BookingPage.tsx:396` `where('active','==',true)`) | sadece `active` boolean | ⚠️ İKİ YÖNLÜ YANLIŞ: leave girildiği AN online'dan düştü (14'ünü beklemedi) + 19 Ağu geçince de **kendiliğinden GERİ GELMEZ** (biri status'u elle 'active' yapana kadar; `active:false` doc'ta kalır) |
| **Server reschedule** (`functions/src/index.js:1238` off-day guard) | shiftChanges + workingDays + dayHours | ❌ Leave sırasında müşteri email-linkiyle Muhamed'e RESCHEDULE EDEBİLİR (hayalet booking, 2026-06-29 incident'ının leave versiyonu) |
| **Finance staff wages** (`Finance.tsx:425-432`) | workingDays + shiftChanges + startDate | 🔴 **PARA BUG'I:** leave'i bilmez → 14 Tem–19 Ağu arası Muhamed'e günlük £41.60 hakediş SAYMAYA DEVAM EDER. ~32 planlı gün ≈ **£1,331 hayalet maaş** tahakkuk eder |
| Staff app (`src/staff/`) | leave referansı yok | ❌ kendi takvimi leave'den habersiz |

**Kök neden:** müsaitlik kararı tek bir yerde değil — her yüzey kendi kopya mantığını yazmış,
leave sonradan eklenince sadece `getAvailableBarbersForDate`'e işlenmiş.

## 3 · Veri modeli dağınıklığı (kaosun envanteri)

Barber doc + çevresi, üst üste binen/yarışan alanlar:

1. **`active` (boolean) vs `status` ('active'|'passive'|'leave') — İKİ gerçek kaynak.**
   `Barbers.tsx:303` kayıtta `active = status==='active'` türetir; ama BookingPage query'si
   `active`'e, panel helper'ları `status`'a bakar. Leave = gelecek tarihli bile olsa `active:false`
   → online'dan ANINDA düşer; leave bitse de `active:false` kalır → online'a dönmez. Legacy doc'larda
   yalnız `active` var (`barberStatusOf` back-compat).
2. **`hours` (tek open/close) vs `dayHours` (gün-bazlı) — çift saat modeli.** `hours` artık
   "primary day"den türetilen özet (`Barbers.tsx:310`); okuyanlar karışık.
3. **`shiftChanges[dateKey]`** — tek-gün istisnası (closed / özel saat). Leave'le İLİŞKİSİZ iki ayrı
   mekanizma; Finance yalnız bunu tanır. 36 günlük izni bugün Finance'e doğru anlatmanın tek yolu
   36 ayrı shiftChange yazmak (kimse yazmaz).
4. **`partnerConfig` (Finance) İSİM-anahtarlı** (`tenants/whitecross/settings/finance_config`),
   barber doc'ları ID'li — rename'de kopar; wage/startDate barber'ın kendisinde değil.
5. **Leave'in yaşam döngüsü yok:** `leaveUntil` geçince status kendiliğinden 'active'e dönmez
   (helper'lar tarih aralığında false döner ama `active:false` + `status:'leave'` doc'ta kalır);
   ayrıca leave tek aralık — ikinci izin girilemez, tarihler üst üste yazılır.
6. **cycleStatus tek-tık leave silme** (INCIDENTS 2026-07-12, ROADMAP G1) + **barber değişiklikleri
   auditLogs'a yazılmıyor** (kim/ne zaman izlenemiyor).
7. Ayarların COĞRAFYASI dağınık: müsaitlik Barbers sayfasında, wage/startDate Finance ⚙'de,
   izinler Settings'te, renk/sıra Barbers'ta — "bir çalışanın her şeyi" tek yerde görünmüyor.

## 4 · Hedef model (öneri)

**A. Tek resolver:** `getBarberAvailability(barber, date) → {available, reason: 'off-day'|'leave'|'passive'|'shift-closed'|'shift-open'}`
`bookingUtils`'te tek fonksiyon; **grid, formlar, BookingPage, staff app VE server callable** (functions'ta
aynı mantığın JS kopyası — mevcut off-day guard'ın genişletilmişi) hepsi bunu kullanır. Öncelik:
`shiftChanges > leave > passive > workingDays/dayHours`.

**B. `active`'i gerçek kaynak olmaktan çıkar:** BookingPage query'si `where('active'==true)` yerine
tüm barber'ları çekip client-side resolver'dan geçirir (barbers zaten public-readable; N küçük).
`active` alanı legacy uyumluluk için yazılmaya devam eder ama SADECE 'passive' için false olur
(leave'de true kalır → tarih aralığı karar verir). Geri-dönüş bug'ı da böylece ölür.
⚠️ `firestore.rules` etkisi yok (read zaten `if true`) ama INVARIANTS'a not düş.

**C. Grid davranışı:** leave günündeki barber kolonu ya hiç çizilmez ya soluk "On leave · til 19 Aug"
başlığıyla çizilir (o gün booking'i VARSA — hayalet önleme — soluk göster; yoksa gizle.
2026-06-29 dersinin aynısı: görünmez kolon = yönetilemez booking).

**D. Finance leave-farkındalığı:** staff/partner gün sayacına `isBarberOnLeaveForDate` eklenir
(scheduled-day filtresine bir satır: leave günü sayılmaz). Muhamed vakası için tek başına ~£1,331'lik fix.

**E. Yaşam döngüsü:** leaveUntil geçince görünür durum otomatik 'active' (yazma job'ı YERİNE
`barberStatusOf`'un tarih-duyarlı hali: `status==='leave' && bugün>until` → 'active' say).
cycleStatus'a leave-confirm ("Muhamed is on leave until 19 Aug — end leave?") + `BARBER_STATUS_CHANGED`
audit kaydı (G1 ile birleşir).

**F. (Faz 2, ayrı iş) Staff hub:** Barbers kartında sekmeli tek ekran — Availability (workingDays/
dayHours/leave/shift) · Pay (partnerConfig'i barber-ID'ye bağla) · Permissions · Appearance.
Kaosun UX ayağı; A–E'den bağımsız planlanır, G4 (haftalık wage ledger) buraya oturur.

## 5 · Uygulama sırası (freeze sonrası, 14 Tem+)

| Adım | İş | Boyut | Not |
|---|---|---|---|
| 1 | D — Finance leave filtresi | S | para bug'ı, İLK bu; Muhamed 14 Tem'de izne çıkıyor |
| 2 | A — resolver + grid/form/staff-app geçişi | M | davranış değişikliği tek yerde test edilir |
| 3 | B — BookingPage active→resolver | S | online dönüş bug'ını da kapatır |
| 4 | Server callable leave guard | S | off-day guard'a leave satırı |
| 5 | E + G1 — lifecycle + confirm + audit | S | INCIDENTS 07-12 kapanışı |
| 6 | F — Staff hub redesign | L | ayrı brief; G4 ledger dahil |

**Geçici işletme kuralı (kod gelene dek):** 14 Tem–19 Ağu arası Muhamed'in grid'de görünmesi
kozmetik ama **Finance'teki hakediş gerçek para** — ya adım 1'i 14'ünden önce almalı (önerilen)
ya da ay sonunda Muhamed'in Temmuz/Ağustos gün sayısı elle düşülmeli.
