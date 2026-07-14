# Staff Management & Compensation — Tasarım Prompt'u

> **Nasıl kullanılır:** Bu dosyanın tamamını yeni bir Claude oturumuna (MacBook / Claude
> design) yapıştır. Çıktı = kodlanabilir bir **tasarım dokümanı** (veri şeması + hesap
> kuralları + UI + göç planı). Kod YAZDIRMA — önce tasarım. Owner: whitecrossbarbers@gmail.com.
> Bağlam: ROADMAP.md **tema S**, INCIDENTS.md 2026-07-14 (leave), bu repo (`salown-docs`).

---

## Rol & bağlam

salOWN çok-kiracılı (multi-tenant) bir salon yönetim SaaS'ı. Stack: React + Vite +
TypeScript + Firebase/Firestore (proje `havuz-44f70`, region europe-west2). Tüm tenant
verisi `tenants/{tenantId}/...` altında. Aktif tenant'lar: whitecross, herohairs, eekurt
(hepsi Class A). Barber'lar: `tenants/{tid}/barbers/{id}`. Booking/satışlar:
`tenants/{tid}/bookings/{id}`.

Sen bir SaaS ürün mimarı + veri modelcisisin. Görevin: **Staff Management & Compensation**
modülünün tasarımını çıkarmak.

## İş problemi

Personel **farklı ödeme modelleriyle** çalışıyor ve şu an sistem sadece "sabit maaş"ı
biliyor (whitecross'a özel `Finance.jsx` içindeki `partnerConfig`). Gerçek dünya (UK barber):

- Kimi **maaşlı** (wage) — sabit £/gün-hafta-ay.
- Kimi **komisyonlu** (commission) — ürettiği cironun %'si.
- Kimi **self-employed / koltuk kiracısı** — bağımsız çalışır, koltuk kirası öder (sabit £
  veya cironun %'si), kendi parasını kendi alır.

Bu üç model kârı (P&L) tamamen farklı hesaplattığı için hepsinin tek, birinci-sınıf bir
**Staff Management** modülünde ayrılması gerekiyor. Bu **platform (multi-tenant) özelliği** —
whitecross'a özel Finance içine gömülmez.

## Kapsam / gereksinimler

### 1. Compensation modeli (staff başına)
Her personelde bir `compensation` nesnesi tasarla. Minimum tipler:
- `wage`: `{ amount, period: 'day' | 'week' | 'month' }` — dükkan tüm hizmet gelirini alır,
  maaş sabit gider.
- `commission`: `{ servicePct, productPct }` — kişi ürettiği cironun %'sini alır; dükkan
  geliri = satış − komisyon. Hizmet ve ürün farklı % olabilir.
- `self_employed`: `{ rentAmount, rentPeriod }` **VEYA** `{ shopCutPct }` — kişinin cirosu
  **dükkanın geliri değil**; dükkan geliri = kira / komisyon (+ belki ürün satışı).

Tasarımda net söyle: her tip için **dükkan geliri** ve **personel maliyeti/ödemesi** nasıl
hesaplanır (formül + örnek senaryo). Geçiş (bir personel wage'den commission'a geçerse)
tarih-etkili olmalı (geçmiş raporlar bozulmasın) — bunu nasıl modelleyeceğini öner.

### 2. Yaşam döngüsü (lifecycle)
Durumlar: **active** / **leave** (tarih-aralıklı `leaveFrom`/`leaveUntil`, otomatik döner) /
**passive** (kalıcı soft-delete, geçmiş korunur) / **deleted** (nadir, yalnız super-admin).
Bunları tek tutarlı state modeline oturt. "leave" ile "passive" farkını ve her birinin
booking/site/finance/occupancy'ye etkisini tablola.

### 3. Veri-emniyeti (silme = veri kaybı OLMAMALI)
- **Snapshot/denormalizasyon:** her booking/satış kaydı barber ADINI metin olarak taşımalı
  (`barberName`) — sadece `barberId` referansı değil. Böylece barber silinse bile geçmiş
  Reports/Finance ismi korur. *(Not: walk-in/online/ürün-satışı/blok artık `barberName`
  snapshot'lıyor — 2026-07-14 `0db230c`. Reports canlı barber yoksa `barberName`'e düşüyor.)*
- **Reports arşivi:** silinen/passive barber'ın geçmiş istatistik satırı kaybolmamalı;
  "eski personel / arşiv" olarak gösterilmeli.
- **Silme bariyerleri** zaten var (super-admin+owner, onay modalı "passive yap" öneriyor,
  audit log) — tasarım bunları korusun, güçlendirsin.
- **GDPR:** "unutulma hakkı" = yok etme değil **anonimleştirme** (isim → "Former staff",
  finansal toplamlar kalır). Bunu tasarıma koy.

### 4. Multi-tenant & raporlama
- **Reports** = platform geneli (tenant-bağımsız). **Finance** = şu an whitecross-özel.
  Comp tipi Staff Management'ta tanımlı, Reports/Finance oradan **türetir** (mantık kopyalanmaz).
- Kalıcı kural (CLAUDE.md): tenant-özel isim/mantık Reports'a hardcode edilmez.

### 5. Yasal not (UK)
Self-employed birini employee gibi işlersen (sabit maaş, vardiya zorunluluğu) vergi/istihdam
riski doğar. Model bu ayrımı net tutmalı (self-employed = bağımsız; dükkan kira/komisyon alır,
maaş vermez). Vergi/VAT hesaplama KAPSAM DIŞI ama ayrım korunmalı.

## Mevcut kod haritası (tasarımı gerçeğe oturt)
- Comp'un bugünkü hâli: `src/pages/Finance.tsx` → `partnerConfig[name]` = `{ wage, isPartner,
  creditTo, startDate, ... }`. Günlük/aylık wage döngüleri (~satır 265, 347, 474).
- Barber durum helper'ları: `src/utils/bookingUtils.ts` → `barberStatusOf`,
  `isBarberOnLeaveForDate`, `getAvailableBarbersForDate` (passive+leave filtreliyor).
- Barber lifecycle UI + silme: `src/pages/Barbers.tsx` → `cycleStatus` (~385), delete (~380),
  gate `canDelete` (~179); Firestore rules `firestore.rules` barbers delete = super-admin/owner.
- Snapshot yazımları: `src/firestoreActions.ts` (`createWalkIn`, `createProductSale`,
  `blockTime`, `editBooking`), `src/pages/BookingPage.tsx` (online).
- Raporlama okuma: `src/pages/Reports.tsx` (~143 `d.barberName || lookup || raw`; ~182
  `barberStats` yalnız CANLI barber'lardan → silineni düşürür), `src/pages/Finance.tsx` (~161).
- Occupancy: `src/components/OccupancyPanel.tsx` (`barberWorksOn`, kapasite paydası).
- Booking veri modeli tuhaflıkları (CLAUDE.md): walk-in `barberId` = küçük-harf İSİM; online =
  doc id + `barberName`. `booking.duration` online'da doğru kaynak.

## Bilinen buglar (tasarım bunları çözmeli, ayrıca değil)
1. **passive-maaş:** passive barber Finance'ta hâlâ günlük maaş tahakkuk ediyor
   (`Finance.tsx` wage döngüsünde leave kontrol var, `barberStatusOf !== 'passive'` filtresi
   yok). Comp modeli "aktif değilse ödeme yok"u yapısal çözmeli.
2. **occupancy-leave:** izindeki barber occupancy kapasite paydasında sayılıyor
   (`OccupancyPanel` `barberWorksOn` leave-check'siz) → occupancy %'sini yapay düşürür.
   Kapasite **tarih-aralıklı** olmalı (izin günü = 0 kapasite).

## İstenen çıktı (deliverable)
Kodlanabilir bir tasarım dokümanı (Markdown), şunları içersin:
1. **Veri şeması** — `compensation` + lifecycle alanları, Firestore doküman şekli, tarih-etkili
   geçmiş (comp değişimi geçmişi).
2. **Hesap kuralları** — her comp tipi için dükkan-geliri + personel-ödemesi formülü + örnek.
3. **Raporlama entegrasyonu** — Reports/Finance/Occupancy bu modelden nasıl türer; passive/leave
   nasıl dışlanır; arşiv barber nasıl gösterilir.
4. **Göç (migration)** — mevcut `partnerConfig` → yeni model; veri kaybı olmadan, geriye dönük
   uyumlu (eski kayıtlar bozulmasın).
5. **UI/UX** — Staff Management ekranı (personel listesi, comp editörü, lifecycle aksiyonları,
   silme bariyerleri).
6. **Kenar durumlar** — comp ortası değişim, self-employed'ın ürün satışı, kira periyodu ≠ rapor
   periyodu, silme sonrası rapor.
7. **Fazlama** — (a) veri modeli + göç, (b) Staff UI, (c) rapor entegrasyonu; her faz bağımsız
   deploy edilebilir.

## Kısıtlar (CLAUDE.md — uy)
- Firestore'da **toplu silme YOK** (export → dry-run CSV → owner onayı → yaz).
- Finansal alan semantiği (`paidAmount`, `platformDepositAmount`) reschedule/edit'te sıfırlanmaz.
- Değişiklik önce tek tenant'ta (whitecross pilot), sonra genele.
- Para/alan-semantiği değişikliği = riskli → önce rapor + owner onayı, sonra kod.
