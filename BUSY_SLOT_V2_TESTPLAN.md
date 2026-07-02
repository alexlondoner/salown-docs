# BUSY_SLOT_V2_TESTPLAN.md — Kapsamlı Test Listesi (deploy ÖNCESİ)

> Processing-time / segment / channel özelliklerinin **deploy edilmeden önce** HeroHairs
> üzerinde test edilmesi gereken her şey + olabilecek sorunlar. Pilot tenant: **HeroHairs**
> (Treatwell + panel erişimi var). Tasarım: `BUSY_SLOT_V2.md`, `SERVICE_CONFIG_V2.md`.
> Riskler: `BUSY_SLOT_V2_RISKS.md`. **Şu an: flag KAPALI, deploy YOK.**

## 🔴 GLOBAL KILL-SWITCH
Sorun → HeroHairs tenant doc `features.processingTime = false`. Her şey v1'e döner
(motor delegasyon + flag-gate sayesinde birebir eski davranış).

## Önkoşul
1. `tenants/herohairs` doc → `features.processingTime: true` (SADECE HeroHairs).
2. Bölüm D/E (Treatwell) için `firebase deploy --only functions` — **deploy onayı ayrı alınacak.**

---

## A — Servis config / segment editörü (DEPLOY GEREKMEZ, panel)
- [ ] A1. Flag açık HeroHairs → Services → servis aç → **"Timing — processing & buffer"** bölümü görünür.
- [ ] A2. Flag kapalı tenant (Whitecross) → bölüm **görünmez**.
- [ ] A3. Segment ekle: Service 20 + Processing 30 + Service 20 → "Segments total 70 / 70 · ✓ active".
- [ ] A4. Toplam ≠ duration → kırmızı "⚠ must equal duration". Kaydet → motor bunu **uygulamaz** (solid).
- [ ] A5. Processing segment'i yok (sadece Service'ler) → "⚠ needs a Processing segment".
- [ ] A6. Blocked segment ekle (buffer) → kaydet → busy sayılır ama serbest değil (D'de doğrulanır).
- [ ] A7. Kaydet → yenile → segment'ler aynen geldi (persist). Firestore'da `service.segments[]` var.
- [ ] A8. Variation'lı servis → segment editörü görünmez (sadece base servis).
- [ ] A9. Segment'leri sil → kaydet → `service.segments = null`, servis normal davranır.

## B — Booking create + snapshot (panel)
- [ ] B1. Segment'li servisle **walk-in** oluştur → Firestore booking'de `segments[]` snapshot var.
- [ ] B2. Segment'li servisle **panel booking** (BookingForm) → `segments[]` var.
- [ ] B3. Servisin segment'ini sonradan değiştir → **eski booking** eski segment'i korur (snapshot dondu).
- [ ] B4. Variation seçili booking → `segments` yazılmaz (base-only kuralı).

## C — Motor / çakışma + render (panel)
- [ ] C1. Günlük takvimde segment'li booking'in processing pencereleri **taralı bant** gösterir (çoklu gap dahil).
- [ ] C2. Processing penceresine **sığan** 2. booking → **kabul** (eskiden "slot dolu").
- [ ] C3. Pencereyi **aşan** booking (aktif/blocked segmente giren) → **"slot dolu"**.
- [ ] C4. İki processing penceresi olan servis → iki ayrı bant + her ikisine de booking alınır.
- [ ] C5. Reschedule: booking'i processing'li bir slotun gap'ine taşı → izin/red doğru.
- [ ] C6. **Regresyon (flag kapalı tenant):** normal booking/çakışma/reschedule/walk-in eskisi gibi.
- [ ] C7. **Regresyon (flag açık ama segment'siz servis):** normal davranır, hiç gap yok.

## D — iCal feed çıktısı (FUNCTIONS DEPLOY GEREKİR)
- [ ] D1. Feed: `…/salownIcalFeed?tenantId=herohairs` → segment'li booking için **çoklu VEVENT** (UID `x`, `x-1`…), aralarında boşluk.
- [ ] D2. Blocked segment → VEVENT'e dahil (busy), processing → dahil DEĞİL (boş).
- [ ] D3. Flag kapalı tenant feed'i → tek VEVENT (tüm span) — eskisi gibi.
- [ ] D4. Segment toplamı ≠ duration → tek solid VEVENT (güvenli fallback).
- [ ] D5. UID çakışması yok (2 segment ayrı UID).

## E — Treatwell uçtan uca (DEPLOY + Treatwell)
- [ ] E1. Treatwell feed'i poll edince processing penceresi **boş/bookable** görünür; aktif/blocked dolu.
- [ ] E2. Treatwell'den o boş pencereye booking → alınır; Salown'a email parser ile döner.
- [ ] E3. Latency: poll gecikmesi makul mü (dk—saat); çift-booking riski gözlemle.

## F — Olabilecek sorunlar / kenar durumlar (özellikle dene)
- [ ] F1. **Source→channel key uyuşmazlığı:** Treatwell/Booksy booking'inin `source` değeri channelProfile key'iyle eşleşmezse processing **sessizce** uygulanmaz. (`getServiceSegments` normalize: lowercase + boşluk/alt-çizgi→tire.)
- [ ] F2. **Online site booking (BookingPage):** şu an snapshot YAZMIYOR → online müşteri booking'i gap taşımaz. (Kasıtlı, follow-up.)
- [ ] F3. **Email parser booking'leri:** Treatwell/Fresha/Booksy import'u snapshot YAZMIYOR → gap taşımaz. (Kasıtlı.)
- [ ] F4. **Day-view squeeze-in:** 2. (gap'e alınan) kart hâlâ üst üste biner (column-split yok). Görsel; booking doğru.
- [ ] F5. **Hafta görünümü:** processing render'ı yok (sadece günlük).
- [ ] F6. **BLOCKED booking** + yanlışlıkla segment → solid kalmalı (gap açılmamalı).
- [ ] F7. **Çok kısa gap** (örn. 5dk, en kısa servisten kısa) → kimse dolduramaz, sorun çıkarmaz.
- [ ] F8. **Firestore rules:** segment'li servis/booking yazımı rules'a takılmıyor (panel auth; create whitelist'siz — doğrulandı).
- [ ] F9. **Reschedule self-ignore:** segment'li booking kendi gap'ine çakışmıyor (`ignoreBookingId`).
- [ ] F10. **No-show/iptal:** segment'li booking iptal → gap'e alınan 2. booking etkilenmez (FIFO, koruma yok — kasıtlı).

## Geri alma
- Kill-switch `features.processingTime=false` → anında v1.
- Functions geri alınacaksa: flag-off zaten tek-VEVENT veriyor; gerekirse revert+redeploy.

## Otomatik testler (geliştirici)
- `npm test` → `conflictUtils.test.js` 24/24 (parity + v1-equivalence + segment modeli + back-compat).
- Build: `npm run build` sıfır error. `node --check functions/index.js`.
