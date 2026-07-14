# Staff Management & Compensation — Tasarım Dokümanı

> **Tarih:** 2026-07-14 · **Kaynak:** [STAFF_MANAGEMENT_DESIGN_PROMPT.md](STAFF_MANAGEMENT_DESIGN_PROMPT.md) (owner yönü) ·
> **Bağlam:** ROADMAP **tema S** · [STAFF_SETTINGS_AUDIT.md](STAFF_SETTINGS_AUDIT.md) (G5 denetimi) · INCIDENTS 2026-07-14 (leave)
> **Durum:** 📐 TASARIM — kod yok. Satır atıfları 2026-07-14 `main` (`79d034a`) üzerinden doğrulandı.
> **Kapsam dışı:** vergi/VAT hesabı, payroll/bordro entegrasyonu, Stripe.

---

## 0 · Yönetici özeti

Bugün sistem tek comp modeli biliyor: **sabit günlük wage**, whitecross'a özel, isim-anahtarlı
`partnerConfig` içinde (`tenants/whitecross/settings/finance_config`). Gerçek dünyada üç model var
(wage / commission / self-employed) ve üçü P&L'i bambaşka hesaplatıyor.

Tasarımın omurgası **dört karar**:

1. **Comp verisi barber doc'una GİRMEZ** — barbers world-readable (`firestore.rules:92` `read: if true`;
   public booking siteleri okuyor). Yeni, korumalı koleksiyon: `tenants/{tid}/staffComp/{barberId}`.
2. **Tarih-etkili dönem geçmişi (append-only `history[]`)** — comp değişimi eski dönemi kapatır, yeni
   dönem açar; geçmiş raporlar asla değişmez. `startDate` kavramı ilk dönemin `effectiveFrom`'una erir.
3. **"Passive = comp dönemi kapalı."** Passive'e alma comp dönemini otomatik kapatır → "aktif değilse
   tahakkuk yok" yapısal olur (bilinen bug 1'in kalıcı çözümü); ayrıca geçmiş hakediş dokunulmaz kalır
   (all-time G4 ledger bozulmaz).
4. **Comp bir TÜRETİM katmanıdır** — booking/satış kayıtlarındaki para alanlarına hiçbir yeni alan
   yazılmaz, hiçbir mevcut alan değişmez (G4 ledger felsefesi: "veri modeli değişmeden salt türetim").

Mevcut G5 altyapısı (tek resolver önceliği `shiftChanges(açık) > leave > passive > workingDays/dayHours`,
`barber.leaves[]` izin arşivi, otomatik dönüş) **aynen temel alınır** — lifecycle yeniden icat edilmez.

---

## 1 · Veri şeması

### 1.1 Yeni koleksiyon: `tenants/{tid}/staffComp/{barberId}`

Doc id = **barber doc id** (isim DEĞİL — `partnerConfig`'in isim-anahtarlı kırılganlığı burada biter;
rename comp'u koparmaz).

```jsonc
{
  "barberId": "barber-1781007454543",
  "barberName": "Muhamed",          // snapshot (GDPR anonimleştirmede burası değişir)
  "nameKey": "muhamed",             // normalizeName(barberName) — ciro atama anahtarı (Finance.tsx:248 ile aynı)
  "history": [
    {
      "effectiveFrom": "2026-06-09",     // dahil
      "effectiveTo": null,               // null = açık dönem; kapatılınca 'YYYY-MM-DD' (dahil)
      "type": "wage",                    // 'wage' | 'commission' | 'self_employed'
      "params": { "amount": 41.6, "period": "day" },
      "note": "başlangıç",
      "changedBy": "aerulas@…", "changedAt": "<ts>"
    }
  ],
  "updatedAt": "<ts>"
}
```

**`params` tipe göre:**

| type | params | anlam |
|---|---|---|
| `wage` | `{ amount, period: 'day'\|'week'\|'month' }` | sabit hakediş; bugünkü model = `period:'day'` |
| `commission` | `{ servicePct, productPct }` | ürettiği hizmet/ürün NET cirosunun %'si |
| `self_employed` | `{ rent: { mode:'fixed', amount, period:'week'\|'month' } \| { mode:'pct', pct }, productsThroughShop: true, pauseRentOnLeave: false, collectedByShop: false }` | koltuk kiracısı; cirosu dükkanın DEĞİL |

**Kurallar:**
- `history` **append-only**: dönemler kronolojik, aralıksız çakışmasız (`effectiveTo`+1 = sonraki
  `effectiveFrom`); aktif dönem = `effectiveTo:null` olan SON eleman. Geriye dönük düzeltme yalnız
  super-admin "correction mode" (audit'li) — normal akışta geçmiş dönem edit edilemez.
- Bir tarihte comp dönemi YOKSA (ilk dönemden önce / passive aralığı) → **o gün hiçbir tahakkuk yok.**
- Barber doc'undaki hiçbir alan taşınmaz/değişmez; lifecycle (status/active/leaveFrom-Until/leaves[])
  olduğu gibi kalır (`Barbers.tsx:322-332` yazımı aynen).

### 1.2 Lifecycle ↔ comp bağlantısı (tek tablo)

Durum modeli MEVCUT (G5): `barberStatusOf` (`bookingUtils.ts:139`) + `isBarberOnLeaveForDate` (`:157`,
`leaves[]` arşivi dahil) + resolver önceliği (owner kararı 2026-07-14: **açık shiftChange izni yener ve
o gün ücrete sayılır**). Tasarım yalnız comp etkisini bağlar:

| Durum | Booking/site | Grid | Occupancy kapasitesi | Comp tahakkuku |
|---|---|---|---|---|
| **active** | görünür | kolon var | sayılır | dönem açıksa ✓ |
| **leave** (aralıklı) | tarihe-duyarlı gizli, otomatik döner | booking yoksa kolon yok | **sayılMAZ (fix §3.3)** | wage: gün sayılmaz · commission: doğal 0 · rent: `pauseRentOnLeave`'e bağlı (default devam) |
| **açık shiftChange** (izin içinde bile) | o gün çalışır | kolon var | sayılır | **sayılır** (geldi=çalıştı=para) |
| **passive** (kalıcı) | görünmez | kolon yok* | sayılmaz | **comp dönemi kapalı → 0** (yapısal) |
| **deleted** (nadir) | görünmez | yok | yok | staffComp doc'u KALIR (arşiv); tahakkuk pasifle aynı |

\* Bilinen boşluk: `Dashboard.tsx:409` `activeBarbersForDay` passive'i bağımsız elemiyor (workingDays
uyarsa kolon çizer) — Faz B'de resolver'a bağlanır (§7).

**Passive'e alma akışı:** `cycleStatus` (`Barbers.tsx:385`) mevcut confirm'üne ek olarak staffComp'ta
açık dönemi `effectiveTo = <son çalışma günü>` ile kapatır; reaktivasyon aynı paramlarla yeni dönem
açmayı önerir (prefill, onaylı). Audit: mevcut `BARBER_STATUS_CHANGED`'e (`Barbers.tsx:400`) ek
`COMP_PERIOD_CLOSED` / `COMP_CHANGED` event'leri.

### 1.3 Firestore rules (yeni blok)

```
match /staffComp/{barberId} {
  allow read, write: if isSuperAdmin() || isOwner(tenantId);   // finansal veri — admin bile göremez (Finance gate'iyle tutarlı, AppRouter.tsx:129)
}
```
- Catch-all `write: false` olduğundan explicit blok ŞART; barbers bloğuna (`firestore.rules:91-95`) dokunulmaz.
- Deploy disiplini: canlı rules'ı API'den çek → diff → **rules EN SON** deploy (feedback kuralı); rules
  test suite'ine (65/65) staffComp read/write vakaları eklenir.

---

## 2 · Hesap kuralları (tip başına dükkan geliri + personel maliyeti)

Ortak tanımlar — dönem P, personel s (`nameKey` ile CHECKED_OUT booking'lerden atanır; Finance zaten
isim-bazlı topluyor, `Finance.tsx:248`):

- `S(s,P)` = hizmet NET cirosu = `price + serviceCharge − discount − loyaltyRedeemedValue` toplamı
  (paylaşılan `bookingNetWithoutTip`'in hizmet bileşeni; tip HİÇBİR hesapta yok — bahşiş personelin)
- `U(s,P)` = ürün NET cirosu = `soldProducts` + bağımsız ürün satışları (`createProductSale` kayıtları)
- `compForDate(comp, dk)` = o günü kapsayan history dönemi (yoksa null)
- `isCompensableDay(barber, comp, dk)` = dönem var **VE** gün-gate'i geçer. Gün-gate = Finance'in
  bugünkü 5-sayaç sırasının AYNISI (`c66320d`+`4b7b592`+`e68dca8` ile canlı):
  `shiftChange(kapalı→hayır / açık→EVET) → leave→hayır → workingDays/dayHours`.

### 2.1 `wage`

- **Dükkan geliri:** s'nin TÜM cirosu dükkanın: `S + U` brüt gelire girer (bugünkü davranış).
- **Personel maliyeti (tahakkuk):** `Σ compensableDay × günlükOran`.
  `günlükOran` = `amount` (period:day) · `amount/7` (week) · `amount/ayınGünSayısı` (month) —
  hafta/ay maaşı **takvim-günü bazında** günlüğe indirgenir ki rapor dönemi ≠ maaş dönemi sorunu
  hiç doğmasın (§6.4).
- **Ödenecek (ledger):** `earned − paid` — G4 haftalık ledger (`Finance.tsx:470-504`) AYNEN, tek fark
  wage kaynağının `partnerConfig[name].wage` yerine `compForDate` olması.
- **Örnek:** Muhamed £41.60/gün, Temmuz'da 22 compensable gün → maliyet £915.20; £900 ödendi →
  devir £15.20. Şirket P&L: gelir S+U tam, gider £915.20.

### 2.2 `commission`

- **Dükkan geliri:** s'nin TÜM cirosu dükkanın: `S + U` brüt gelire girer.
- **Personel maliyeti:** güne değil **booking'e** tahakkuk eder:
  `servicePct% × S(s,P) + productPct% × U(s,P)`.
  Gün-gate GEREKMEZ — izinli/pasif personelin cirosu zaten 0 → maliyet yapısal 0. (Comp dönemi yine
  şart: dönem dışı tarihli booking'e komisyon işlemez.)
- **Ödenecek:** wage ile aynı `earned − paid` ledger kalıbı (Record Payment aynen).
- **Örnek:** %45 hizmet / %10 ürün. Hafta: S=£1,200, U=£80 → komisyon £540+£8=£548.
  Şirket P&L: gelir £1,280, gider £548, dükkanda kalan £732.
- v2 uzantısı (kapsam dışı, alan ayrılmış): `guaranteeMin` (asgari garanti — komisyon < garanti ise fark).

### 2.3 `self_employed`

- **Dükkan geliri:** `S(s,P)` **brüt gelire GİRMEZ** (kişinin kendi parası). Dükkanın s'den geliri:
  - `rent.mode='fixed'`: kira tahakkuku = compensable-gün DEĞİL, **takvim tahakkuku**: `amount/7 × gün`
    (haftalık) — dönem açık olduğu her gün işler; izin default'ta kirayı DURDURMAZ
    (`pauseRentOnLeave:false`, gerçek dünyada koltuk bekliyor; salon isterse flag'i açar).
  - `rent.mode='pct'`: dükkan geliri = `pct% × S(s,P)` ("shop cut"). Kişiye maliyet satırı YOK —
    kesinti dükkanın geliridir, kalan zaten kişinin.
- **Ürün:** `productsThroughShop:true` (default) → dükkan stoğundan satılan ürün %100 dükkanın
  (S'den bağımsız, U normal brüt gelire girer). Kiracının kendi ürünü kasaya hiç girmez.
- **Personel maliyeti:** YOK. Wage/scheduled-day mantığı bu tipe hiçbir zaman uygulanmaz
  (**UK yasal ayrımı**: sabit maaş/vardiya zorunluluğu işlersen employee'ye döner — model bunu
  alan düzeyinde imkânsız kılar: self_employed params'ında `amount/period` alanı yoktur).
- **Ters yön ledger'ı:** kiracı dükkana borçlanır: `rentAccrued − rentPaid` (STAFF WAGES tablosunun
  ayna satırı, "CHAIR RENT" bölümü).
- **Örnek (fixed):** £150/hafta kira, Temmuz 31 gün → tahakkuk £664.29; £600 ödedi → £64.29 borç.
  Şirket P&L: "Chair rent income" £664.29; kişinin £2,400 cirosu HİÇBİR yerde şirket geliri değil.
- **Örnek (pct):** shop cut %30, S=£2,400 → dükkan geliri £720; kişi £1,680'ini kendi alır.
- `collectedByShop:true` edge'i (para dükkan kasasından geçiyorsa) → §6.3.

### 2.4 Partner katmanı (dokunulmaz)

`partnerConfig`'teki `isPartner / share / creditTo` + sermaye defteri (`Finance.tsx:524-608`,
Plan A/B, settlement) **comp tipinden bağımsız bir üst katmandır ve AYNEN KALIR** (owner kararı
2026-07-13: partner altyapısı asla silinmez — ileride ortaklı salonlara ürünleşecek). Bu tasarım
partnerConfig'ten yalnız `wage` + `startDate`'i staffComp'a taşır (§5); `share/isPartner/creditTo`
finance_config'te yaşamaya devam eder. `creditTo` zinciri (`Finance.tsx:399-420`) comp tahakkukunu
değiştirmez, yalnız kimin defterine yazılacağını seçer — aynen çalışır.

---

## 3 · Raporlama entegrasyonu

### 3.1 Finance (whitecross, Tier 3)

- 4 wage türetimi (`dailyData:265` · `partnershipByMonth:347` · aylık partner/staff `:374-447` ·
  haftalık ledger `:470`) tek selector'a bağlanır: `staffCostForDay(barber, comp, dk)` — içinde
  `compForDate` + tip dallanması (§2). Gün-gate kodu ZATEN doğru sırada; yalnız wage kaynağı değişir.
- **Örtük £100 fallback KALKAR** (`Finance.tsx:269,351` `realBarberSet.has(bk)?100:0`): comp doc'u
  olmayan gerçek barber → tahakkuk **0** + tabloda "⚠️ comp tanımsız" uyarı satırı. Sessiz para
  üretimi tehlikeli bir default'tu; göç bitince gerekçesi de kalmaz.
- P&L'e iki yeni satır tipi: **"Commission"** (gider) ve **"Chair rent income"** (gelir);
  self-employed cirosu `grossRevenue` toplamından `nameKey` ile düşülür (comp tipi lookup'ı Finance
  içinde — Reports'a sızmaz).
- İki defter (operasyonel + sermaye) yapısı değişmez.

### 3.2 Reports (platform, tenant-bağımsız)

- **Reports comp OKUMAZ.** İki sebep: (1) CLAUDE.md kuralı — tenant-özel/finansal mantık Reports'a
  girmez; (2) rules — staffComp yalnız owner+super okur, Reports admin'e de açık. Ciro=aktivite
  görünümü comp'tan bağımsız doğru kalır.
- **S1 delik 2 fix'i (arşiv):** `barberStats` (`Reports.tsx:182`) yalnız canlı `barbers`'tan kuruluyor →
  silinen barber'ın satırı yok oluyor. Fix: satır kaynağı = canlı barber'lar **∪** filtrelenmiş
  booking'lerdeki distinct `barberName` (snapshot'lar `0db230c` ile artık her kayıtta). Canlıda
  karşılığı olmayan isimler listenin sonunda **"Eski personel"** bölümünde, nötr renkle. Boş-durum
  kontrolü (`:484`) aynı kalır.

### 3.3 Occupancy (bilinen bug 2'nin yapısal çözümü)

- `barberWorksOn` (`OccupancyPanel.tsx:54-63`) status/leave'e HİÇ bakmıyor; haftalık payda
  (`:260-265`) yalnız first-seen'e bakıyor → izinli/pasif barber kapasitede sayılıp %'yi yapay
  düşürüyor. Fix: her iki payda da **resolver'dan** türet (`getAvailableBarbersForDate` semantiği,
  gün bazında) — izin günü = 0 kapasite, passive = 0, açık shiftChange = kapasitede. Self-employed
  kapasitede SAYILIR (koltuk doluluk fiziksel gerçek; para değil).

### 3.4 Staff app

SalesView/WeekView ciroyu zaten paylaşılan `bookingNetWithoutTip` ile gösteriyor (`79d034a`) — comp'tan
bağımsız, değişiklik yok. "Kendi komisyonunu gör" ekranı bilinçli **kapsam dışı** (staffComp rules'u
staff'a kapalı; açılacaksa ayrı projeksiyon tasarımı gerekir — v2 notu).

---

## 4 · UI/UX — Staff Management ekranı

G5 denetimindeki **Staff hub (4F)** vizyonunun somutlanması: Barbers sayfası roster kalır; personele
tıklayınca **sekmeli detay paneli** açılır:

```
┌─ Muhamed ────────────────────────────────── [Set leave] [Set passive] [🗑] ─┐
│  Availability │ Pay 🔒 │ History                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ PAY (yalnız owner + super-admin görür)                                       │
│  Mevcut: 💷 Wage — £41.60/gün · 2026-06-09'dan beri                          │
│  [Change compensation]                                                       │
│    → tip seç (wage/commission/self-employed) → paramlar → effectiveFrom      │
│      (min: bugün; geçmişe tarih YOK — correction mode hariç) → onay          │
│  Geçmiş: 2026-06-09 → …  wage £41.60/gün   (append-only zaman çizgisi)      │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Availability** sekmesi: mevcut workingDays/dayHours/leave/shiftChange editörleri buraya toplanır
  (bugün Barbers + Settings→Members'a dağılmış iki ekran tek yere iner — denetim §3.9).
- **Pay** sekmesi: rol gate'i Finance ile aynı (`isSuperAdmin || tenantRole==='owner'`); diğer roller
  sekmeyi hiç görmez. Comp değişimi `COMP_CHANGED` audit'i yazar (`{barberId, from, to, effectiveFrom}`).
- **Lifecycle aksiyonları:** mevcut davranış korunur + güçlendirilir:
  - *Set passive* → mevcut confirm + "comp tahakkuku durur, geçmiş hakediş/bakiye korunur" ibaresi +
    comp dönemini kapatır (§1.2).
  - *Delete* → mevcut güçlü modal (`Barbers.tsx:932-954`, "Set passive öner") + gate
    (`canDelete:179`, rules `:93`) AYNEN; modale "comp geçmişi ve tüm kayıtlar arşivde kalır" eklenir.
  - *Leave* → mevcut tarihli akış + `leaves[]` arşivi aynen.
- **"Eski personel" görünümü:** roster'ın altında katlanır bölüm — passive/silinmiş personel,
  son comp tipi, bakiye (varsa), Reports arşiv satırına link.
- Tenant'lar arası: ekran platform geneli; **Pay sekmesi comp doc'u olan tenant'larda dolu, yoksa
  "comp tanımlı değil" boş-durumu** (Finance'in whitecross hardcode'u Faz C'de plan-flag'ine döner).

---

## 5 · Göç (partnerConfig → staffComp) — whitecross pilot

Veri kaybı imkânsız kılınır: **hiçbir şey silinmez/üzerine yazılmaz; yalnız yeni doc'lar eklenir.**

| Adım | İş | Güvence |
|---|---|---|
| M1 | Admin-SDK script: `finance_config.partnerConfig` oku, her ismi `normalizeName` ile barber doc'una eşle (Finance'in kendi eşleme mantığı, `Finance.tsx:268`) → **dry-run CSV** (isim, eşleşen barberId, type=wage, amount, effectiveFrom=startDate, eşleşmeyenler ⚠️ satırı) | CSV → owner onayı → yaz (CLAUDE.md bulk kuralı). partnerConfig'e DOKUNULMAZ |
| M2 | Finance okuma sırası: `staffComp → partnerConfig.wage fallback`; **parity modu**: iki kaynak farklı sonuç verirse console+UI uyarısı. G4 haftalık ledger'ın canlı bakiyeleri (Arda £0 / Muhamed £0 mutabakatı) göç öncesi/sonrası kuruş-kuruş karşılaştırılır (bayt-kanıt geleneği) | Görünür davranış değişikliği SIFIR |
| M3 | Parity temiz → fallback + örtük £100 default kaldırılır; `partnerConfig`'te `wage/startDate` alanları "migrated" işaretlenir ama SİLİNMEZ (partner katmanı `share/isPartner/creditTo` zaten orada yaşamaya devam ediyor) | Geri dönüş: fallback'i geri açmak tek satır |
| M4 | Diğer tenant'lar: herohairs/eekurt'ta partnerConfig yok → temiz başlangıç, migration gerekmez; Staff hub Pay sekmesi doğrudan staffComp yazar | Pilot → genel sırası korunur |

Eski booking/satış kayıtlarına HİÇ dokunulmaz (comp salt türetim; `paidAmount`/`platformDepositAmount`
semantiği INVARIANTS gereği zaten dokunulmazdı).

---

## 6 · Kenar durumlar

1. **Dönem ortası comp değişimi** (wage→commission, ayın 15'i): 1–14 eski dönemden gün-tahakkuk,
   ≥15 tarihli CHECKED_OUT booking'ler yeni dönemden komisyon. Haftalık ledger'da geçiş haftası iki
   satır gösterir ("wage 4g £166.40 + commission £212"). Geçmişe etki sıfır — dönemler kesişemez.
2. **GDPR "unutulma":** yok etme değil **anonimleştirme**: barber doc silinir; `staffComp.barberName`
   → "Former staff"; booking'lerdeki `barberName` snapshot'ları bulk-anonimleştirilir (export →
   dry-run CSV → owner onayı → yaz); finansal toplamlar ve satır yapısı aynen kalır. Reports arşiv
   satırı "Former staff" olarak görünmeye devam eder.
3. **Self-employed parası dükkan kasasından geçiyorsa** (`collectedByShop:true`; kart cihazı dükkanın):
   `S(s)` yine gelir DEĞİL — kasada **emanet**tir. Finance'e pass-through satırı: "collected on behalf
   £X − rent/cut £Y = payout owed £Z". v1'de yalnız gösterim (otomatik payout yok).
4. **Kira periyodu ≠ rapor periyodu:** tüm fixed tahakkuklar (haftalık kira, haftalık/aylık wage)
   **takvim-günü oranına** indirgenir (`amount/7`, `amount/ayGünü`) → ay sınırında sıçrama/kayıp
   matematiksel olarak imkânsız; nakit tahsilat farkı zaten `accrued − paid` devir satırında görünür
   (G4 kalıbı).
5. **Silme sonrası rapor:** staffComp doc'u barber doc'undan bağımsız yaşar (ayrı koleksiyon, aynı id)
   → silinen personelin comp geçmişi + bakiyesi arşivde; Reports satırı `barberName` snapshot'larından
   gelir (§3.2). Bakiye sıfırlanmadan silme denenirse modal uyarır: "ödenmemiş £X bakiyesi var".
6. **Komisyonlu personel planlı gününde 0 booking:** maliyet 0 (garanti yok — v1 bilinçli; `guaranteeMin`
   alanı v2'ye ayrıldı). Wage'li personelde ise gün compensable ise tahakkuk tam (bugünkü davranış).
7. **`creditTo` zinciri:** comp tahakkuku kişi bazında hesaplanır; creditTo yalnız defter satırının
   kime yazılacağını değiştirir (mevcut `Finance.tsx:399-420` davranışı) — staffComp'ta alan YOK,
   finance_config'te kalır.
8. **Legacy `active`-only okuyucular:** `WalkInFlow.tsx:186`, `NewBookingSheet.tsx:263`,
   `isBarberBookingDisabled` (`bookingUtils.ts:133`) yalnız `active` boolean'ına bakıyor. Editör iki
   alanı senkron yazdığı için bugün zararsız; Faz B'de üçü de `barberStatusOf`'a bağlanır ki `status`
   tek yazıldığında ayrışma doğmasın (denetim "İKİ gerçek kaynak" maddesinin kapanışı).
9. **İzin + fixed kira:** default kira işler (`pauseRentOnLeave:false`); salon anlaşarak flag'i açarsa
   izin aralığındaki günler kira tahakkukundan düşer (leave zaten tarih-aralıklı + arşivli → hesap
   deterministik).

---

## 7 · Fazlama (her faz bağımsız deploy edilebilir)

**Faz A — Veri modeli + göç (görünür değişiklik SIFIR)**
`staffComp` koleksiyonu + rules bloğu + rules testleri · `compForDate`/`staffCostForDay` helper'ları
(unit test'li, `bookingUtils`/yeni `compUtils`) · M1 migration script + dry-run CSV + owner onayı ·
Finance fallback'li okuma + parity uyarısı (M2). *Riskli nokta: rules deploy — canlıyı çek, EN SON bas.*

**Faz B — Staff hub UI + emniyet fix'leri**
Barbers detay paneli (Availability/Pay/History sekmeleri) · comp editörü + `COMP_CHANGED` audit ·
passive→dönem-kapatma bağlantısı · **S1 delik 2** Reports arşiv satırı · **occupancy resolver fix'i**
(§3.3) · legacy `active`-okuyucu üçlüsünün `barberStatusOf`'a geçişi · Dashboard kolon filtresine
passive kontrolü. Her biri küçük, ayrı commit — Keep Scope Narrow.

**Faz C — Rapor entegrasyonu + platformlaşma**
Finance'te Commission gideri + Chair-rent geliri satırları, self-employed cirosunun brütten düşülmesi ·
M3 (fallback + örtük £100 kaldırma, parity kanıtıyla) · haftalık ledger'ın 3 tipe genellenmesi
(CHAIR RENT ayna bölümü) · Finance'in `tenantId==='whitecross'` hardcode'unun (AppRouter.tsx:129,
Sidebar.tsx:213) plan/feature-flag'e dönmesi → modül diğer tenant'lara açılır (planLimits ile
gate'lenebilir — Pro+ özelliği adayı).

Sıralama ROADMAP'e uyar: **I2 + Pre-Scale gate'in ALTINDA**; Faz A kod açısından küçüktür ama para
semantiği içerdiğinden kuralı bozmaz: **önce bu doküman → owner onayı → kod.**

---

## 8 · Açık sorular (owner'a)

1. Komisyon yüzdesi **brüt mü net mi** ciroya uygulanır? (Tasarım default'u: NET — discount/loyalty
   düşülmüş `bookingNetWithoutTip` bileşenleri; personel indirimin maliyetine ortak olur. Booksy/Fresha
   kaynaklı booking'lerde platform komisyonu da düşülsün mü? Default: hayır, twFee şirket gideri kalır.)
2. Self-employed izin yaparken kira default'u "işler" — whitecross/herohairs gerçeğine uyuyor mu?
3. `guaranteeMin` (komisyoncuya asgari garanti) v1'e alınsın mı? (Default: hayır.)
4. Staff app'te personelin kendi komisyon/bakiye görünümü isteniyor mu? (İstenirse ayrı projeksiyon
   tasarımı gerekir — staffComp rules'u staff'a açılMAZ.)
