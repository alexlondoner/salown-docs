# BUSY_SLOT_V2.md — Çok-Aralıklı Müsaitlik Motoru + Kanal Mimarisi

> **Durum (2026-06-26):** CANLI — **DİNAMİK / servis-bazlı**. Tenant-geneli
> `features.processingTime` flag'i KALDIRILDI (commit f958aee). Motor + grid render +
> staff bundle artık servisin kendi `segments` config'inden sürülüyor: processing penceresi
> olan servis gap açar + squeeze-in; olmayan servis tek-solid-aralık (v1 identik). Aşağıdaki
> "feature flag" / "Faz 4'e kadar açılmaz" ifadeleri TARİHSEL — flag artık yok.
> KAPSAM DIŞI (hâlâ): public `BookingPage` + email-parser booking'leri segment snapshot'ı
> yazmıyor → gridde solid kalır (Faz 5b). Salown→Treatwell iCal feed split (Faz 5a) yapılmadı.
> **Sahip:** Alfa (Whitecross owner + dev)
> **Amaç:** Hizmetlere *processing time* (boya bekleme vb.) desteği ekleyerek, bir
> berberin/kuaförün bir müşterinin işlem (bekleme) süresinde **başka bir müşteri**
> alabilmesini sağlamak — ve bunu Salown'un çok-kanallı (aggregator) yapısına oturtmak.
>
> ⚠️ Bu doküman kod tabanının **en hassas yerini** (`conflictUtils.js` / busy-slot)
> değiştiriyor. Bkz: `INCIDENTS.md`. Hiçbir değişiklik, mevcut davranışın birebir
> korunduğu **kanıtlanmadan** production'a çıkmaz.

---

## 1. Problem & Hedef

### Bugün
- Her booking, berber takviminde tek bir kesintisiz `[start, end]` aralığı kaplar.
- İki booking aynı berber + çakışan zaman aralığındaysa → çakışma, ikincisi engellenir.
- **Processing time / gap / parallel booking kavramı YOK.** (Doğrulandı: kod tabanında
  `processingTime`, `gap`, `buffer`, `parallel`, `capacity` (booking mantığında) yok.)

### İstenen (owner kararı)
- Bir hizmet 3 parçaya bölünebilmeli:
  `[ aktif-önce ][ processing (boş) ][ aktif-sonra ]`
- **Processing penceresi fiziksel olarak boş** kabul edilir → o aralığa walk-in, Salown
  sitesi, Treatwell veya herhangi bir kanaldan **ikinci bir booking** düşebilir.
- Tek fiziksel sandalye gerçeği kanaldan bağımsızdır: hangi kanal boşluğu yaratırsa
  yaratsın, hangi kanal doldurursa doldursun, Salown takvimi birleşik tek gerçeği gösterir.

### Sektör bağlamı
Bu, sektörde standart **"processing time"** özelliği (Square, Vagaro, Fresha, Treatwell).
Barber'larda (Booksy/Fresha çoğunlukla barber) processing genelde yok; asıl ihtiyaç
hairdresser/salon hizmetlerinde (boya, balyaj, perma) — Treatwell tarafında.

### Aggregator açısı (Salown'un kozu)
Salown **bütün kanalları aynı anda gören tek sistem.** Booksy'den gelen bir boya
randevusunun ortasındaki boşluğu, bir walk-in veya site müşterisiyle dolduran tek yer
Salown olabilir — çünkü tek-kanal araçları diğer kanalın yarattığı boşluğu göremez.
Bu özellik "kanallar arası gap-filling" olarak konumlanır.

---

## 2. Mevcut motor (referans — değiştireceğimiz kod)

**`src/utils/conflictUtils.js`**

```js
// getExistingRangeMinutes(booking) → { start, end } | null
//   duration kaynağı: BLOCKED ise endTime; yoksa booking.duration;
//   yoksa startTime/endTime timestamp farkı; yoksa service.duration; yoksa 30dk.

export function hasTimeConflict(existingBookings, options) {
  const { dateValue, barberValue, startMinutes, durationMinutes, ignoreBookingId } = options;
  const endMinutes = startMinutes + durationMinutes;
  return (existingBookings || []).some((booking) => {
    const st = normalizeBookingStatus(booking.status);
    if (st === 'CANCELLED' || st === 'NO_SHOW' || st === 'DELETED'
        || st === 'CHECKED_OUT' || st === 'COMPLETED') return false;   // bloklamaz
    if (ignoreBookingId && booking.bookingId === ignoreBookingId) return false;
    if (barberKey(booking.barber) !== barberKey(barberValue)) return false;
    if (booking.date !== dateValue) return false;
    const existingRange = getExistingRangeMinutes(booking);
    if (!existingRange) return false;
    return startMinutes < existingRange.end && endMinutes > existingRange.start;  // overlap
  });
}
```

**Bloklayan statüler:** `CONFIRMED, PENDING, UNPAID, BLOCKED`
**Bloklamayan:** `CANCELLED, NO_SHOW, DELETED, CHECKED_OUT, COMPLETED`

**Çağıran yerler (call sites — hepsi parite testinden geçmeli):**
- `BookingForm.jsx:114, :150` — form içi + save öncesi
- `BookingDetailPanel.jsx:986` — reschedule (`ignoreBookingId` ile)
- `Dashboard.jsx` (WalkInForm) — walk-in oluşturma
- `BookingPage.jsx:~400` — public slot üretimi
- `functions/index.js` `salownGetBusySlots` — public müsaitlik (ayrı implementasyon, **aynı segment mantığı taşımalı**)
- `whitecross-site/script.js` — ayrı kod tabanı, senkronda tutulmalı (bkz: BUSINESS_RULES no-preference)

---

## 3. Yeni motor: çok-aralıklı (segmented) busy

### 3.1 Çekirdek değişiklik

`getExistingRangeMinutes(booking)` → **`getBusyIntervals(booking)`**: tek aralık yerine
aralık **dizisi** döner. Aradaki boşluk(lar) serbest.

```
getBusyIntervals(booking):
  processing YOK  → [ {start, end} ]                                    // bugünle BİREBİR aynı
  processing VAR  → [ {start, start+aktifÖnce}, {end-aktifSonra, end} ] // orta boş
  BLOCKED         → [ {start, end} ]                                    // her zaman düz blok
```

> İleride 3+ segment gerekirse (örn. çok aşamalı işlem) dizi yapısı bunu doğal taşır.
> İlk sürümde sadece 2-aktif-1-boş yeterli.

### 3.2 Çakışma kuralı (multi × multi)

Yeni booking'in kendi busy aralıkları (kendisi de processing'li olabilir) ile mevcut
booking'in busy aralıkları **herhangi bir çift** kesişiyorsa → çakışma.

```
conflict(new, existing) =
  new.intervals  bir A,
  existing.intervals  bir B için
  ∃ (A, B): A.start < B.end && A.end > B.start
```

Boşluk listede olmadığından, boşluğa **tam oturan** yeni booking hiçbir aktif aralıkla
kesişmez → **izinli.** Boşluğu taşan (aktif segmente giren) yeni booking → **bloklu.**

### 3.3 Segment çözümleyici (resolver)

```
getServiceSegments(booking):
  1. booking explicit segment taşıyorsa (native Salown booking veya two-way Treatwell)
       → onu kullan
  2. yoksa servisin channel-profile'ındaki processing ayarını bul, start+duration'dan
       segmentleri YENİDEN KUR   ← Booksy düz-70dk boya senaryosu buraya düşer
  3. hiçbiri yoksa → tek düz blok [start, end]   (bugünkü davranış)
```

Adım 2 kritik: Booksy boyayı düz blok olarak gönderse bile, Salown o hizmetin processing
profilini bilerek boşluğu **fiziksel olarak** açar.

### 3.4 Değişmezler (invariant)
- `ignoreBookingId` (reschedule self-ignore) aynen korunur.
- Bloklamayan statü listesi (`CANCELLED/NO_SHOW/CHECKED_OUT/...`) aynen korunur.
- `barberKey` + `date` eşleşmesi aynen korunur.
- Duration fallback zinciri aynen korunur (segment'siz booking = tek aralık = eski sonuç).

---

## 4. ⭐ Güvenlik temeli: "sıfır davranış değişikliği" özelliği

**Şu an hiçbir serviste processing tanımlı değil.** Dolayısıyla çok-aralıklı motor
yazılsa bile, **her mevcut booking tam olarak tek aralık üretir** → bugünkü çıktının
matematiksel olarak aynısı.

Bu, riskli refactor'ü davranışı hiç değiştirmeden geçirmemizi sağlar:

```
Adım A: Motoru çok-aralıklıya çevir, processing'i HİÇBİR yerde açma
        → çıktı identik olmalı (test ile kanıtla)
Adım B: Mevcut tüm booking verisinde eski==yeni doğrula
Adım C: Tek pilot serviste (Whitecross) processing'i feature-flag arkasında aç
```

**Kural:** Processing özelliği, motor "identik davranış" testlerinden geçmeden
**hiçbir tenantta açılmaz.** Flag default = kapalı.

---

## 5. Kanal mimarisi (channel architecture)

### 5.1 Kanal katmanları

> **NET:** Treatwell entegrasyonu bir **write/two-way API DEĞİL.** İki tek-yönlü iCal
> mekanizması var; **operasyonel olan OUT'tur:**
> - **OUT (Salown → Treatwell) — ✅ ASIL ÇALIŞAN:** `salownIcalFeed` (`functions/index.js:1373`)
>   public bir iCal busy feed yayınlar (`?tenantId=...`, `text/calendar`). Treatwell buna
>   abone olur; Salown'da dolu olan her slot Treatwell takviminde "blocked time" olarak
>   yer kaplar. Nereden dolarsa dolsun (Booksy/Fresha/site/walk-in) feed'e girer, Treatwell'i
>   bloklar. **Booking yazma/değiştirme yok — sadece busy bloğu.**
> - **IN (Treatwell → Salown) — kodda var, ama gated:** `parseTreatwellIcalForTenant()`
>   (`functions/index.js:2586`) Treatwell iCal URL'sini import eder; `features.treatwellIcalSync`
>   flag'i **default `false`** (satır 374) → Whitecross'ta operasyonel değil. "Treatwell email"
>   parser de ayrı bir IN seçeneği.

| Kanal | IN (Salown'a) | OUT (Salown'dan) | Processing |
|---|---|---|---|
| **Treatwell** | iCal import (`treatwellIcalSync`, default off) / email parser | ✅ **`salownIcalFeed`** busy feed (asıl mekanizma) | ✅ var |
| **Booksy / Fresha** | email parser | **manuel** (Salown feed'ine abone değiller; ileride harici araç — Peepeet) | ✗ (barber odaklı) |
| **Walk-in / Salown sitesi** | native | `salownIcalFeed`'e dahil | ✅ (Salown profili) |
| **WhatsApp / Telegram / Instagram** | native / manuel (opsiyonel) | `salownIcalFeed`'e dahil | Salown profili |

> **`salownIcalFeed` mevcut davranışı (değiştireceğimiz):** −14/+90 gün penceresi;
> busy statüler `CONFIRMED, CHECKED_OUT, PENDING, BLOCKED` (satır 1398); her booking →
> **tek VEVENT**, tüm `[startTime, endTime]` span'i (satır 1426). Processing desteği =
> bu tek VEVENT'i, processing'li booking için **iki aktif-segment VEVENT'ine** bölmek.

### 5.2 Per-channel service profile

Processing **global değil, kanala bağlı** bir ayardır. Aynı hizmet Treatwell'de
processing'li, Booksy'de düz blok olabilir.

```
Service "Saç Boyası"
├── base:            { duration, price }            // Salown varsayılanı
└── channelProfiles:
    ├── treatwell:   { activeBefore:20, processing:30, activeAfter:20, out:"ical-busy", in:"email-parser" }
    ├── booksy:      { duration:70, out:"manual", in:"email-parser" }
    └── walkin:      { duration:70 }
```

**Altın kural:** Kullanıcı hangi platformu kullanıyorsa, Salown'un o kanal profili o
platformdaki ayarla **hizalı** olmalı. Salown = her bağlı platformun aynası / üst kümesi.

### 5.3 Fiziksel gerçek vs. kanal görünürlüğü
- **Fiziksel busy haritası birleşiktir** (berber başına tek segmentli zaman çizgisi).
  Tüm kanalların booking'leri buraya katkıda bulunur.
- **Kanal profili** iki şey için kullanılır:
  1. Gelen booking'in segmentlerini *yeniden kurmak* (Booksy düz-blok → boşluk aç).
  2. Dışarı *ne ihraç ettiğimiz* (Treatwell iCal feed'ine hangi saatlerin busy gideceği).

### 5.4 iCal export = aktif segmentlerin birleşimi (kritik bağ)
> ✅ **DOĞRULANDI:** Export mekanizması `salownIcalFeed` (`functions/index.js:1373`).
> Değişiklik tam burada yapılır.

Processing özelliğinin Treatwell ayağı **tamamen** `salownIcalFeed`'in ürettiği VEVENT'lere bağlı:

- iCal feed'i bir booking için **tüm span'i** busy yayınlarsa → Treatwell o boşluğa
  booking alamaz (bugünkü davranış).
- iCal feed'i **sadece aktif segmentleri** (`getBusyIntervals` çıktısı) busy yayınlarsa →
  ortadaki processing penceresi Treatwell'de **boş** görünür ve oraya booking düşebilir.

Yani `getBusyIntervals`, hem app içi çakışma motorunu **hem de** iCal export'unu besleyen
**tek kaynaktır.** Processing'li bir boya → iCal'e **iki** VEVENT (aktif-önce + aktif-sonra),
arada boşluk.

**Latency uyarısı:** iCal feed'leri Treatwell tarafından periyodik **poll** edilir (anlık
değil — dakikalar/saatler). Gap müsaitliği bu yüzden gerçek-zamanlı değildir; bu, §9'daki
çift-booking/no-show riskini büyütür. iCal'i mümkün olduğunca taze tut.

**Echo/dedup uyarısı:** OUT (iCal busy) ile IN (email parser) ayrı mekanizmalar — Salown
kendi ihraç ettiği busy bloğunu geri **import etmemeli.** Treatwell-origin booking'ler
yalnız email parser'dan, `externalId` dedup ile gelir (bkz: PARSER_NOTES).

---

## 6. Veri modeli değişiklikleri

> Hepsi **veri/şema** ekidir — davranışı tek başına değiştirmez. Davranış flag'e bağlı.

- **Service doc** (`tenants/{id}/config` services veya servis koleksiyonu):
  `channelProfiles` map + `processing` alanları (`activeBefore`, `processing`, `activeAfter`).
- **Booking doc** (opsiyonel): native/iki-yönlü booking'lerde explicit `segments` veya
  `processingTime` snapshot'ı (servis sonradan değişse bile geçmiş booking sabit kalsın).
- ~~**Feature flag:** `features.processingTime` (tenant doc) — default `false`.~~ **KALDIRILDI
  (2026-06-26).** Aktivasyon artık tenant flag değil servisin `segments` config'i: processing
  penceresi olan servis dinamik gap açar. `features.processingTime` alanı okunmuyor (tenant
  doc'larda artık tüketilmiyor; temizlenebilir ama zararsız).

---

## 7. Grid render (ayrı ve düşük riskli — motordan SONRA)

Motor doğruluğu kanıtlandıktan sonra ele alınır. Çakışma mantığından **bağımsızdır**.

- **Day view (`TimeGrid.jsx`):** şu an aynı kolonda kartlar üst üste yığılıyor (kolon
  ayırma yok). Processing bölgesi **taralı/şeffaf** çizilmeli; boşluğa düşen ikinci kart
  o bölgeye yerleşmeli. Hafta görünümündeki kolon-slotlama mantığı buraya uyarlanabilir.
- **Week view (`Dashboard.jsx`):** zaten overlap kolon-slotlama var (`cols[]` algoritması);
  processing görseli eklenir.
- Booking kartının processing aralığı görsel olarak "boş ama rezerve" gösterilir.
- **Squeeze-in rozeti:** Bir başka booking'in processing boşluğuna alınan booking, grid'de
  ayırt edici bir işaretle gösterilir (staff "bu, X'in bekleme süresine sıkıştırıldı" anlasın).

> **Kapsam dışı (ayrı feature):** "Müşteri 5dk önce hazır olmalı; gelmezse slotu dolar,
> next-available'a sıraya alınır" akışı bir **check-in / no-show** özelliğidir; busy-slot v2
> motoruyla **birleştirilmez** (scope dar tutulur). İleride ayrı ele alınır.

---

## 8. Test matrisi (kanıt katmanı — production'a dokunmaz)

| Test | İspat |
|---|---|
| **Characterization (golden)** | Gerçek booking export'u: her booking için `getBusyIntervals` uzunluk=1 ve `==` eski `getExistingRangeMinutes`. → mevcut veride sıfır regresyon |
| **Conflict parity** | (mevcut bookings × aday yeni booking) matrisi, processing KAPALI: `yeni hasTimeConflict == eski`. Zaman gridi üzerinde geniş tarama |
| **Gap-fill (yeni)** | Boşluğa tam oturan booking → izin. Boşluğu taşan → blok. Elle hesaplı |
| **Aktif çakışma (yeni)** | Yeni booking'in aktif segmenti, mevcut aktif segmente değerse → blok |
| **Nested / interleaved** | İki processing'li booking iç içe → pairwise doğru |
| **Reconstruct (Booksy)** | Düz-blok import + servis profili → boşluk doğru açılıyor |
| **Reschedule self-ignore** | `ignoreBookingId` ile kendi segmentlerine çakışmıyor |
| **BLOCKED** | Her zaman tek düz aralık, boşluk yok |
| **Edge: gap < min servis** | Doldurulamayan boşluk sorun çıkarmıyor (sadece boş kalır) |
| **Public müsaitlik pariteyi** | `salownGetBusySlots` çıktısı app motoruyla aynı segmenti veriyor |

**Opsiyonel — shadow mode:** Yeni motoru bir süre production'da read-only çalıştırıp
eski sonuçtan sapmayı logla; kullanıcıya yansıtmadan, flip öncesi son güvence.

---

## 9. Açık sorular (koda geçmeden netleşmeli)

1. ~~**Treatwell OUT mekanizması**~~ → **ÇÖZÜLDÜ:** OUT = `salownIcalFeed`
   (`functions/index.js:1373`), Treatwell'in abone olduğu busy feed. Write API yok ama
   gerek de yok — feed'in VEVENT içeriğini `getBusyIntervals` ile segmentlere bölmek
   yeterli. Gap tanımında efektif master Salown. Bkz §5.1, §5.4.
2. ~~**iCal latency / çift-booking**~~ → **KARAR:** First-come-first-served, slot koruması
   YOK. Aynı boşluğa iki kanal düşerse: ikincisi sığmıyorsa engine reddeder; sığıyorsa
   ikisi de geçerli, operasyonel hallet. iCal'i mümkün olduğunca taze tut (gerçek-zamanlı
   garanti değil).
3. ~~**No-show riski**~~ → **KARAR (owner):** Gap-fill TÜM kanallara serbest; tek kısıt
   boşluğa sığması (bunu engine zaten garanti eder — sığmayan booking aktif-sonra segmentine
   çakışır, reddedilir). Geç gelen orijinal müşterinin slotu **korunmaz**; yeri dolduysa
   "next available"a re-book. **Operasyonel kural:** müşteri appt'tan 5 dk önce hazır olmalı.
   "5dk erken + re-queue" akışı **v2 motor kapsamı DIŞI** — ayrı check-in/no-show feature.
   Motor tarafında ekstra çakışma mantığı GEREKMİYOR.
4. **Config hizalama:** Processing ayarı hem Salown'da hem Treatwell panelinde ayrı tanımlı.
   Manuel hizalı tutmak yeterli mi, yoksa Salown bir "uyumsuzluk uyarısı" göstermeli mi?
5. **Segment snapshot:** Geçmiş booking'ler servis profili değişince donmalı mı? (Öneri: evet,
   booking oluşturulurken segment snapshot'ı yaz.)

---

## 10. Fazlar

| Faz | İçerik | Risk | Prod davranış değişir mi |
|---|---|---|---|
| **0** | (Ayrı iş) No-show rozeti + geçmiş/gelecek cancelled görünürlüğü | Düşük | Sadece render | ✅ |
| **1** | Veri modeli: `channelProfiles` + processing alanları + feature flag (kapalı) | Düşük | Hayır | ✅ |
| **2** | Motor: `getBusyIntervals` + multi×multi conflict + `getServiceSegments`. Characterization + parity testleri YEŞİL | **Yüksek** | Hayır (flag kapalı, identik) | ✅ |
| **3** | Grid render: processing görseli + nested ikinci kart | Orta | Görsel | ✅ |
| **4** | ~~Pilot: tek serviste flag aç~~ → **DİNAMİK**: flag kaldırıldı, servis-bazlı otomatik (panel + staff bundle). Ön-uçuş: yalnız herohairs'te 1 processing servisi | Orta | Evet (servis bazlı) | ✅ 2026-06-26 (f958aee + 5dbdf31) |
| **5a** | `salownIcalFeed` (`functions/index.js:1373`) processing'li booking için 2 VEVENT yayınlar → Treatwell gap'i boş görür | Yüksek | Evet (Treatwell müsaitliği) | ⬜ |
| **5b** | Public booking page + `salownGetBusySlots` gap slotlarını sunar (online/parser snapshot dahil) | Yüksek | Evet | ⬜ |
| **6** | Kanal genişletme: Booksy/Fresha OUT otomasyonu (Peepeet), mesajlaşma kanalları | — | Evet | ⬜ |

**Sıra kuralı (tarihsel):** Faz 2 testleri yeşil olmadan Faz 3+ başlamadı. ~~Flag, Faz 4'e
kadar hiçbir tenantta açılmaz.~~ → Faz 4'te flag tamamen kaldırıldı; aktivasyon artık servisin
processing config'i. Sonraki: Faz 5b (online/parser snapshot + public gap slotları), Faz 5a (iCal split).

---

## İlgili dokümanlar
- `BUSINESS_RULES.md` — slot generation, no-preference assignment, reschedule invariant'ları
- `INCIDENTS.md` — conflict/slot mantığını geçmişte kırma kayıtları
- `MANIFESTO.md` — "grabbing" / aggregator felsefesi
- `FIRESTORE_SCHEMA.md` — booking model quirk'leri (duration, endTime şekilleri)
