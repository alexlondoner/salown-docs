# Staff App — Pre-Capacitor Sağlamlaştırma (Çalışma Raporu)

> **Amaç:** Staff app'i native'e (D1 Capacitor — bkz [D1_CAPACITOR_NATIVE_PLAN.md](D1_CAPACITOR_NATIVE_PLAN.md)) sarmadan ÖNCE tutarsızlıkları ve eksikleri kapatmak. Native'e sarınca her düzeltme iki katman (web+store) demek; o yüzden temizlik ŞİMDİ, PWA'dayken yapılır.
>
> **Kaynak:** 3 paralel ajan denetimi (veri-tutarlılığı · UX/eksik-durum · aggregator kaynak-tutarlılığı) + owner'ın "244" olayı (bkz [[edit-log-salown]]). Tarih: 2026-07-14/15.
>
> **Statü anahtarı:** ✅ CANLI (düzeltildi+deploy) · 🔧 KALAN (kod işi, sıraya girdi) · 🎨 TASARIM (owner kararı/mimari gerekir) · ⚪ KABUL (bilinçli bırakıldı).
>
> **Multi-device:** Bu dosya diğer makinelerde `git pull` ile çekilir. Bir madde bitince statüyü ✅ + commit-hash yap, [[edit-log-salown]]'a kayıt düş.

---

## 📌 OTURUM DURUMU — 2026-07-14/15 (son güncelleme snapshot'ı)

### ✅ YAPILDI (hepsi canlı + push'lu)
| İş | Commit | Durum |
|---|---|---|
| Sales/Week ciro `bookingNetWithoutTip` (panelle eşitlendi) | Salown `79d034a` | ✅ CANLI |
| Today "Est. revenue" yakınsayan tahmin (checkout=net, gelmemiş=price) | Salown `b725434` | ✅ CANLI |
| Pre-Capacitor Tier 1-2: parsed £0-checkout, ham-statü, müşteri-harcama net, "Today" sabit-tarih, Booksy boş-berber, Sales satır/gruplama | Salown `0df2beb` (bundle `staff-DJvCvRYK.js`) | ✅ CANLI |
| D1 Capacitor native plan (hazır bekliyor, acele yok) | docs `fa25129` (`D1_CAPACITOR_NATIVE_PLAN.md`) | 🅿️ BEKLİYOR |
| Bu rapor + ROADMAP D0/D1 + T3-8 kaynak-bazlı düzeltme | docs `ab1dc59`/`042da6c`/`ce9b9ff` | ✅ KAYITLI |

### 🔜 KALAN — sıradaki (owner yönü: "Salown master, editi koru")
1. **🟢 Cancel tombstone** — `cancelBooking` → `parserTombstones` (geç email iptal edileni diriltmesin). *En güvenli, önce bu.*
2. **🔴 Parser clobber guard** — booking manuel editlenince alan-bazlı bayrak (`barberManuallySet`); `booksy.ts:280` reschedule-apply barber'ı ezmesin (saat gelebilir). ⚠️ canlı boru → testli+hedefli deploy.
3. **🟠 Staff app'e barber yeniden-atama** — telefondan mis-assignment düzeltme (şu an panel-only); yazınca #2 bayrağını set eder.
4. **🔧 UX kalanlar** (aşağıdaki tier'larda): push sessiz-hata banner (T2-7), boş-durum/erişim mesajı (T4-10), reschedule saat-guard (T4-11), sessiz-hata yutma (T4-12).
5. **🅿️ D1 Capacitor** — ürün olgunlaşınca (owner acele etmiyor).

**Sıradaki aksiyon önerisi:** #1 → (#2+#3 birlikte). Owner onayı bekliyor.

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

**Owner iş modeli (2026-07-15, KRİTİK):** "Asıl toplanacak doğru yer BİZİZ (Salown master)." Booksy rastgele barber atıyor; seçilen barber müsait değilse **Salown'da hemen doğru barber'a çeviriyoruz.** Yani external booking editlemek İSTENİR — "editi kapat" YANLIŞ olur. Booksy'ye geri push zaten imkânsız/gereksiz (müşteri Booksy'de görür, dükkân Salown'da çalışır).

**Gerçek risk (kod-doğrulandı):** `functions/src/parsers/booksy.ts:277-285` reschedule-apply → `existingRef.update({ startTime, ...(r.newBarber ? { barberId: r.newBarber } : {}) })`. Booksy reschedule email'i "with {barber}" taşıdığı için, **manuel yapılan barber düzeltmesini geri EZİYOR.** Koruyucu bayrak repo'da YOK. Ayrıca staff app'te barber yeniden-atama UI'ı YOK (`RescheduleSheet` sadece saat) → owner bunu şu an panelden yapıyor.

**Doğru iş (owner modeline göre, "Salown master + editi koru"):**
1. **🔴 Parser clobber guard (backend, en yüksek değer):** booking manuel editlenince `manualOverride`/`barberManuallySet` bayrağı yaz; parser reschedule-apply bu bayrakta `barberId`'yi (ve gerekiyorsa saati) EZMESİN. ⚠️ `booksy.ts` = canlı boru, en hassas (CLAUDE.md "parser en son") → karakterizasyon testiyle, hedefli deploy.
2. **🟠 Staff app'e barber yeniden-atama:** RescheduleSheet'e (veya BookingDetail'e) barber seçici — owner telefondan da mis-assignment'ı düzeltsin (şu an panel-only). Yazınca #1'in bayrağını set etsin.
3. **🟢 Cancel tombstone:** `cancelBooking`'i delete gibi `parserTombstones`'a yaz → geç gelen reschedule-email cancelled booking'i diriltmesin. Kaynaktan bağımsız güvenli.
4. **Buffer + manuel blok:** Booksy takvim feed'i olmadığı için kapasite güvenliği operasyonel (Quick Block zaten var). Köprü = ileride.

> ESKİ (yanlış) yön "Booksy reschedule'ı kapat/uyar" İPTAL — owner Salown'u master kabul ediyor, edit İSTENİR; korunması gereken şey edit'in kalıcılığı.

---

## Kapsam notu (ferah/grid'siz estetik)
Owner kararı: app **ferah, liste-odaklı, grid değil**. Yukarıdaki hiçbir madde grid/sıkıştırma gerektirmez — hepsi mantık düzeltmesi veya küçük etiket/uyarı. Öneriler bu estetiğe göre verilmiştir.

## Doğru çalıştığı doğrulanan (yeniden denetlenmesin)
Empty state'ler + skeleton'lar on-brand; Cancel/No-show iki-dokunuş inline confirm; SaveOverlay success feedback tutarlı; revenue permission gating (canViewRevenue) SalesView/WeekView/BottomNav'de tutarlı; tarih/tz her yerde `ukDayRange`/`ukWeekRange` (BST-güvenli), staff view/sheet'lerde `toISOString().split` YOK.
