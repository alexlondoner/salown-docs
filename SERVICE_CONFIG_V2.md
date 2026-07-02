# SERVICE_CONFIG_V2.md — Detaylı Servis Konfigürasyonu (3-platform superset)

> Amaç: Salown servis editörünü Booksy + Fresha + Treatwell'in **üst kümesi** yapmak.
> "Kullanıcı hangi platformu kullanıyorsa Salown o ayarlarla aynı olmalı" (channelProfiles).
> İlişkili: `BUSY_SLOT_V2.md` (zamanlama motoru), `MANIFESTO.md` (aggregator).
> **Durum:** TASARIM. Zamanlama motoru kısmı kısmen kodlu (processing); gerisi pending.

---

## 0.5 ⭐ Karar (owner, 2026-06-24): SOON alanları = source-connection-driven
Treatment type + SOON bölümleri (Capacity/Parallel, Tax, Booking interval, Padding/cleanup)
**manuel doldurulmayacak** — tenant'ın **bağlı source'una göre akıllı** dolacak/eşleşecek
(Booksy/Fresha/Treatwell). Yani bu alanlar channelProfiles üzerinden platform ayarından
türetilecek; owner tek tek girmeyecek. Şimdilik editörde "SOON" stub olarak duruyor.
Treatment type da şu an kaydediyor ama parser/marketplace eşleşmesine bağlanınca anlam kazanacak.

## 0. ⭐ Mimari karar: ortak mı, ayrı mı? → HİBRİT

Üç platformun çekirdeği **aynı mantık** (segment + price + team + buffer + capacity); farklar
isimlendirme + birkaç platforma-özel alan. Karar:

**TEK ortak base model + ince per-channel override katmanı (channelProfiles).**
- Tam ortak değil: fiyat platforma göre değişir (Treatwell off-peak −20%), bir servis bir
  kanalda açık diğerinde kapalı olabilir.
- Tam ayrı (3 model) değil: sandalyenin fiziksel gerçeği TEK; 3 model = 3× bakım + senkron.

| Alan | Katman |
|---|---|
| Segments (timing), duration, cleanup/padding, treatment type, category, description, team, parallel clients, booking interval | 🔵 **Ortak base** (fiziksel/tek doğru) |
| Price, sale/off-peak discount, online-booking aç/kapa, (ileride processing override) | 🟢 **Per-channel override** (meşru değişir) |

Owner servisi bir kez tanımlar; gerekirse kanal başına fiyat/görünürlük override'ı ekler.
`service.channelProfiles[platform]` sadece **delta** tutar; eksikse base'e düşer.

### Platforma-özel alanlar (sadece ilgili kanalda anlamlı)
- **Treatwell:** off-peak discount, Sale price, Fine print, Distribution, Cleanup time
- **Booksy:** No-show protection, Combo services, Mobile/Virtual service, Padding rule, Tax rate
- **Fresha:** Resources, Forms, Commissions, Portfolio, segment tipleri (blocked dahil)

---

## 1. Üç platform — alan karşılaştırması

| Alan | Booksy | Fresha | Treatwell | Salown (superset) |
|---|---|---|---|---|
| Service name | ✓ | ✓ | ✓ | ✓ (var) |
| Menu category | ✓ | ✓ (online'a yansır) | ✓ | ✓ (var) |
| Treatment type (marketplace eşleşmesi) | – | ✓ | ✓ | **yeni** |
| Description | ✓ | ✓ (+AI Enhance) | ✓ | ✓ (var) |
| Price type (Fixed / From / Free) | ✓ | ✓ | ✓ | kısmen (Fixed var) |
| Price | ✓ | ✓ | ✓ | ✓ (var) |
| **Duration (segmentli)** | sabit alanlar | **segment dizisi** | süre | **segment dizisi** (aşağıda) |
| Variations / variants | ✓ | ✓ (Add variant) | ✓ | ✓ (var) |
| Deposit | ✓ | ✓ | ✓ | ✓ (var) |
| **Booking interval** (servis bazında) | ✓ (15min) | – | – | **yeni** (global var) |
| **Padding time** | ✓ | (blocked ile) | – | **yeni** |
| **Parallel clients** (kapasite) | ✓ | (resources) | yanyana blok | **yeni — ayrı motor** |
| Online booking aç/kapa | ✓ (self-booking) | ✓ | ✓ | kısmen (`active`) |
| Team members (kim yapıyor) | ✓ | ✓ | ✓ | ✓ (`barbers[]`) |
| Resources (oda/koltuk) | – | ✓ | – | **yeni** |
| Service add-ons | ✓ | ✓ | ✓ | kısmen (addOns) |
| Forms / Commissions / Portfolio | – | ✓ | – | **yeni (düşük öncelik)** |
| Tax rate | ✓ | (hesap düzeyi) | – | **yeni** |
| Mobile / Virtual service | ✓ | – | – | **yeni (düşük öncelik)** |

---

## 2. ⭐ Zamanlama modeli: segment dizisi (3 tip)

Fresha "Add extra time" menüsü modeli netleştiriyor — **üç segment tipi**:

| Tip | Berber durumu | Müşteri süresinde | **Salown busy?** | Kaynak |
|---|---|---|---|---|
| **service** | meşgul | görünür | ✅ busy | Fresha "Servicing / Extra servicing" |
| **processing** | **boş (doldurulabilir)** | görünür | ❌ **free** | Fresha "Processing", Booksy "during" |
| **blocked** | meşgul | **gizli** | ✅ busy | Fresha "Blocked", Booksy "padding/after" |

**Depolama:**
```
service.segments = [
  { type: 'service',    duration: 20 },
  { type: 'processing', duration: 30 },   // ← boş pencere, başka müşteri girer
  { type: 'service',    duration: 20 },
]
// toplam süre = segment'lerin toplamı
```

**Busy intervals** = ardışık `service`+`blocked` koşularının birleşimi; `processing` = boşluk.
Bu, `BUSY_SLOT_V2`'deki `getBusyIntervals`'ın genellenmiş hali.

**Müşteriye gösterilen süre** = `service + processing` (blocked hariç).

### Mevcut kodla ilişki
Şu an kodlu model `processing: {activeBefore, processing, activeAfter}` =
`[service:activeBefore, processing, service:activeAfter]` özel hali. v2'de depolama
**`segments[]`**'e taşınır; `getBusyIntervals` + `salownIcalFeed` N-segment'e genellenir
(busy = service∪blocked). Geriye uyumluluk: eski `processing` objesi okunup segments'e map
edilir. Hepsi yine **flag-gated + test-first**.

---

## 3. Parallel clients (kapasite) — AYRI motor konsepti

Booksy "Parallel Clients" ve Treatwell'in yanyana blok görseli (Image 5) farklı bir şey:
**aynı anda N müşteriye tam hizmet** (processing-gap DEĞİL). Bu, interval başına bir
**kapasite sayacı** gerektirir (berber/kaynak başına eşzamanlı booking ≤ N). Motorun ayrı
bir uzantısı; processing-gap ile karıştırılmaz. Ayrı faz, ayrı test.

---

## 4. Treatwell yanyana blok (Image 5)
Bir booking alındığında bitişik kolonda gri blok = slotun yanyana bloklanması. Salown
açısından bu, `salownIcalFeed`'in busy bloklarının Treatwell'de nasıl göründüğü. Processing
ile: aktif segmentler gri (dolu), processing penceresi açık kalır.

---

## 5. Editör tasarımı (Fresha-style bölümler)
Servis editörü bölümlere ayrılır (mevcut tek-panel yerine):
1. **Basic** — name, menu category, treatment type, description
2. **Pricing & duration** — price type (Fixed/From/Free), price, **segment editörü** (service/processing/blocked ekle), variants, deposit
3. **Online booking** — self-booking aç/kapa, booking interval, padding
4. **Capacity** — parallel clients (kapasite)
5. **Team & resources** — kim yapıyor (barbers), oda/koltuk
6. **Add-ons / Tax** — ek hizmetler, vergi oranı

Motoru etkileyen alanlar: **segments, padding, parallel-clients, booking-interval** →
her biri flag-gated + test-first. Diğerleri (description, treatment type, tax) saf veri/UI.

---

## 6. Fazlar
| Faz | İçerik | Motor? |
|---|---|---|
| **SC-1** ✅ KODLU | `segments[]` modeli + segment editörü (service/processing/blocked) — processing migrate edildi. Motor/iCal/render N-segment, 24/24 test, flag OFF | ✅ getBusyIntervals N-segment |
| **SC-2** kısmen ✅ | Price type (Fixed/From/Free) + treatment type EKLENDİ. Tax = sensitive (Finance), ayrı | ❌ veri/UI |
| **SC-3** ⏳ | Booking interval (servis bazında). **Padding/cleanup = ZATEN segment `blocked` ile çözülü** | ✅ slot gen — sensitive |
| **SC-4** ⏳ | Parallel clients (kapasite sayacı) — ayrı motor, sensitive | ✅ ayrı motor |
| **SC-5** | Resources (oda/koltuk), forms, commissions, portfolio | ✅/❌ kapsam büyük |

**Sıra:** SC-1 önce (zamanlama superset'i, mevcut processing'i içine alır), sonra UI/veri
fazları. Motor fazları her zaman characterization+parity testleriyle.
