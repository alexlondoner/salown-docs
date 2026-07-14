# Staff App — Pre-Capacitor Sağlamlaştırma (Çalışma Raporu)

> **Amaç:** Staff app'i native'e (D1 Capacitor — bkz [D1_CAPACITOR_NATIVE_PLAN.md](D1_CAPACITOR_NATIVE_PLAN.md)) sarmadan ÖNCE tutarsızlıkları ve eksikleri kapatmak. Native'e sarınca her düzeltme iki katman (web+store) demek; o yüzden temizlik ŞİMDİ, PWA'dayken yapılır.
>
> **Kaynak:** 3 paralel ajan denetimi (veri-tutarlılığı · UX/eksik-durum · aggregator kaynak-tutarlılığı) + owner'ın "244" olayı (bkz [[edit-log-salown]]). Tarih: 2026-07-14/15.
>
> **Statü anahtarı:** ✅ CANLI (düzeltildi+deploy) · 🔧 KALAN (kod işi, sıraya girdi) · 🎨 TASARIM (owner kararı/mimari gerekir) · ⚪ KABUL (bilinçli bırakıldı).
>
> **Multi-device:** Bu dosya diğer makinelerde `git pull` ile çekilir. Bir madde bitince statüyü ✅ + commit-hash yap, [[edit-log-salown]]'a kayıt düş.

---

## ✅ Bu turda düzeltildi — `Salown 0df2beb` (2026-07-15, CI staff deploy, bundle `staff-DJvCvRYK.js`)

Hepsi paylaşılan yardımcıları kullanır (`bookingNetWithoutTip` / `normalizeBookingStatus` / `resolveBarber`) → ekranlar web panel ile uyuşur, geçmiş kayıtlar da doğru render olur.

| # | Sorun | Dosya | Fix |
|---|---|---|---|
| T1-1 | Parsed booking £0'a checkout (sessiz ciro kaybı) | `staff/sheets/CheckoutSheet.tsx:37` | `basePrice` boş `price`'ta `paidAmount`/`platformDepositAmount`'a fallback |
| T1-2 | Sales ham statü karşılaştırması → eski/varyant statüler düşüyor | `staff/views/SalesView.tsx:88` | `normalizeBookingStatus(b.status)` ile filtre |
| T1-3 | Müşteri toplam harcama ham `price`'tan (Sales ile çelişik) | `staff/sheets/ClientDetailSheet.tsx:110,134` | `bookingNetWithoutTip(data)` → `netRevenue` |
| T2-4 | Booking detayında hep "Today" (yanlış gün riski) | `staff/sheets/BookingDetailSheet.tsx:172` | `startTime`/`date`'ten gerçek tarih etiketi |
| T2-5 | Booksy/online booking'de berber "—"/boş | `BookingDetailSheet.tsx` + `CheckoutSheet.tsx` (+ StaffRouter prop) | `resolveBarber(booking, barbers)` |
| T2-6 | Sales işlem satırları başlık toplamıyla tutmuyor + berber gruplama walk-in/online ayrışması | `staff/views/SalesView.tsx:373,146,162` | satır `bookingNetWithoutTip`; gruplama `resolveBarber` ile birleşik |

**Önceki ilgili düzeltmeler (aynı hafta):** Sales/Week ciro `bookingNetWithoutTip` (`79d034a`), Today "Est. revenue" yakınsayan tahmin (`b725434`).

---

## 🔧 KALAN — kod işi (sıradaki turlar)

### T2-7 · Push kaydı sessizce başarısız (yüksek)
`staff/StaffApp.tsx:159` — izin reddedilir/token alınamazsa sadece `console.warn`; kullanıcı hiç bildirim almaz ama bilmez. **Yapılacak:** izin durumunu state'te tut; `ProfileView`'e "Bildirimler kapalı — açmak için dokun" banner'ı + Settings'e yönlendirme. (Native'e geçince push kritik → D1 öncesi kapat.)

### T4-10 · Yanıltıcı boş durum (orta)
`staff/views/TodayView.tsx:340` — `canViewAllBookings=false` + berber-bağı yok → dolu günde "All clear · No bookings" gösteriyor. **Yapılacak:** izin yoksa "You don't have access to the schedule" mesajı (boş-gün ≠ erişim-yok).

### T4-11 · Reschedule çalışma-saati guard'ı yok (orta)
`staff/sheets/RescheduleSheet.tsx` — slotlar sabit 08:00–22:00, kapanış uyarısı yok (NewBookingSheet'te var). **Yapılacak:** açılış saatlerini baz al ya da en azından "outside opening hours" uyarısı.

### T4-12 · Sessiz hata yutma → mükerrer müşteri (orta)
`staff/components/ClientSearch.tsx` + `TodayView.tsx:279` — `.catch(()=>{})`. Müşteri listesi yüklenmezse arama boş döner, barber mükerrer kayıt açar. **Yapılacak:** hata durumunda küçük "couldn't load — retry" göstergesi.

### T4-16 · CheckoutSheet discard-guard yok (düşük)
Yanlışlıkla kapatınca girilen tip/indirim/method uyarısız gider (diğer sheet'lerde `window.confirm` var). **Yapılacak:** dirty-guard.

### Diğer düşük
- **T4-13** MEMBER rozeti bilerek yanlış veriden (`ClientsView.tsx:35`, `ClientDetailSheet.tsx:137`) — backfill'e kadar rozeti gizle. ⚪/🔧
- **T4-14** Bildirimler sadece bellekte (`StaffRouter.tsx:62`) — yenilemede zil sıfırlanıyor. Firestore'a taşınabilir (G1 kişi-bazlı bildirim işiyle birleştir).
- **T4-15** Detayda kaynak iki yerde farklı ("salOWN" pill vs ham "salown" satır) `BookingDetailSheet.tsx:174`; WeekView'de kaynak hiç yok.
- **T2-9** Booksy `duration` yoksa 30dk varsayılıyor `RescheduleSheet.tsx:87` — parser duration yazmıyor.

---

## 🎨 TASARIM — owner kararı / mimari gerekir

### T3-8 · Dış senkron — KAYNAK-BAZLI (owner netleştirdi 2026-07-15)
Denetimin "hiç geri-yazım yok" genellemesi YANLIŞTI. Gerçek durum kaynağa göre değişir:

| Kaynak | Sync kanalı | Durum | Salown'daki güvenilirlik |
|---|---|---|---|
| **Treatwell** | **iCal import** (`functions/src/parsers/ical.ts`) | ✅ CANLI | Tam yaşam-döngüsü gelir — event `STATUS:CANCELLED` → Salown booking CANCELLED (ical.ts:98-107), reschedule de (`:179`). Treatwell tarafı Salown'a otomatik yansır. |
| **Fresha** | iCal import | ⏳ YAKINDA | Aynı mekanizma gelince Treatwell gibi güvenilir olacak. |
| **Booksy** | Sadece email-parse | ⚠️ KIRILGAN | Takvim/iCal feed'i YOK. Geri-yazım imkânsız. İki yol: **(a) köprü kur** (büyük iş) **veya (b) şimdilik BUFFER + MANUEL BLOK** ile çift-rezervasyonu önle. |

**iCal not:** iCal INBOUND'dur (dış platform → Salown). Salown'dan Treatwell/Fresha'ya geri PUSH yoktur; ama o platformlar kendi kaynağı olduğu için orada yönetmek + Salown'un yansıtması doğru akış. Yani staff'ın Salown'da bir Treatwell/Fresha booking'ini editlemesi anlamsız (bir sonraki iCal pull ezer).

**Booksy karar yönü (owner 2026-07-15):** köprü şimdilik YOK → **buffer + manuel blok** ile idare. Booksy = tek gerçek kırılgan kaynak.

**Staff app'te önerilen somut adım (kaynak-farkındalıklı UI):**
1. **Booksy booking'lerinde:** "Booksy'de yönetiliyor" rozeti + reschedule'ı **kapat/uyar** ("Salown'dan değiştirmek Booksy'ye yansımaz"). Kapasite için manuel blok/buffer akışına yönlendir.
2. **Treatwell/Fresha:** "burada değil, {platform}'da yönetilir" notu (iCal ezeceği için local edit'i caydır).
3. **Cancel tombstone:** `cancelBooking`'i delete gibi `parserTombstones`'a yaz → geç gelen reschedule-email cancelled booking'i geri diriltmesin. (Kaynaktan bağımsız güvenli.)

> Bu, D1'den bağımsız; aggregator'ın "tek yerden yönet" vaadinin gerçek sınırını netleştirir. #1-2 küçük UI işi; buffer/manuel-blok operasyonel akış (Quick Block zaten var).

---

## Kapsam notu (ferah/grid'siz estetik)
Owner kararı: app **ferah, liste-odaklı, grid değil**. Yukarıdaki hiçbir madde grid/sıkıştırma gerektirmez — hepsi mantık düzeltmesi veya küçük etiket/uyarı. Öneriler bu estetiğe göre verilmiştir.

## Doğru çalıştığı doğrulanan (yeniden denetlenmesin)
Empty state'ler + skeleton'lar on-brand; Cancel/No-show iki-dokunuş inline confirm; SaveOverlay success feedback tutarlı; revenue permission gating (canViewRevenue) SalesView/WeekView/BottomNav'de tutarlı; tarih/tz her yerde `ukDayRange`/`ukWeekRange` (BST-güvenli), staff view/sheet'lerde `toISOString().split` YOK.
