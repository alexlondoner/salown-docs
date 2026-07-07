# INVARIANTS.md — bozulursa sistem kırılır

> **Bu dosya nedir:** Kodun her zaman uyması gereken **değişmezler** (invariants). Her biri geçmişte bir incident'tan, bir tasarım kararından veya sert bir kuraldan doğdu.
>
> **Nasıl kullanılır:** İlgili bir alana dokunmadan ÖNCE (para hesabı, tarih, booking yazma, parser, email, rules...) buradaki ilgili bölümü oku. Bir invariant'ı bozacaksan bu **bilinçli bir karar** olmalı — sebebini [DECISIONS.md](DECISIONS.md)'e yaz, tek satır "düzeltme" olarak geçme.
>
> **İlgili dosyalar:** kasıtlı tuhaflıklar → [KNOWN_QUIRKS.md](KNOWN_QUIRKS.md) · neden kararları → [DECISIONS.md](DECISIONS.md) · geçmiş kazalar → [INCIDENTS.md](INCIDENTS.md) · detaylı kurallar → [BUSINESS_RULES.md](BUSINESS_RULES.md) / [NORMALIZATION.md](NORMALIZATION.md) / [SECURITY.md](SECURITY.md).

**Kaynak kısaltmaları:** `INC <tarih>` = INCIDENTS.md kaydı · `CLAUDE §X` = salown-app/CLAUDE.md bölümü · sibling doküman adları linklidir.
**Kırılganlık:** 🔴 bozulursa canlı kesinti/veri-para/güvenlik · 🟠 özellik kırılır · 🟡 yanlış gösterim/sessiz veri kaybı.

---

## İçindekiler
1. [Para & Muhasebe](#1-para--muhasebe)
2. [Tarih & Zaman (UK)](#2-tarih--zaman-uk)
3. [Booking Modeli](#3-booking-modeli)
4. [Barber & Client Eşleşme](#4-barber--client-eşleşme)
5. [Email & Bildirim](#5-email--bildirim)
6. [Güvenlik & GDPR](#6-güvenlik--gdpr)
7. [Deploy](#7-deploy)
8. [Multi-tenant](#8-multi-tenant)
9. [Parser](#9-parser)
10. [Kanal Senkronizasyonu (iCal OUT)](#10-kanal-senkronizasyonu-ical-out)

---

## 1. Para & Muhasebe

| ID | Değişmez | Bozulursa | 🔴 | Kaynak |
|----|----------|-----------|----|--------|
| INV-PARA-1 | Firestore para alanları (`price`, `paidAmount`, `tip`…) ASLA ham `parseFloat`/`Number` ile toplanmaz → `pp()` / `parsePrice()` ya da `(Number(x)\|\|0)` guard | Import kalıntısı `"£20.00"` → `NaN`; **tek NaN tüm toplamı zehirler** | 🟡 | INC 2026-06-22 · CLAUDE §Money |
| INV-PARA-2 | `paidAmount` = **brüt tahsilat** (bahşiş dahil), gelir DEĞİL. Gelir için `− pp(tip)` veya `bookingNetWithoutTip` | Bahşiş gelire karışır; ekranlar tutmaz; HMRC-anlamlı rakam yanlış | 🟡 | INC 2026-06-28 |
| INV-PARA-3 | `paidAmount` (deposit) + `platformDepositAmount` edit/reschedule'da **SIFIRLANMAZ** | Ödenmiş depozito kaybolur, müşteriden tekrar istenir | 🟠 | CLAUDE §Money / §Reschedule |
| INV-PARA-4 | Bahşiş asla gelir değildir; kart/nakit bahşiş ayrımı `tipPaymentMethod`'dan yapılır (servis `paymentMethod`'undan değil) | "Kartla ödedi, bahşişi nakit" → kart-bahşiş toplamı yanlış | 🟡 | INC 2026-06-28 |
| INV-PARA-5 | Aggregator brüt fiyatı ≠ işletme net; komisyon (+VAT) **otomatik gider** modellenir, brüt görünür kalır | Defterler geliri şişirir | 🟡 | INC 2026-06-26 (Treatwell) · [muhasebe](../salown-app) |
| INV-PARA-6 | `pp()` negatif değerleri **korur** (refund'lar) — clamp'leme | İadeler kaybolur/pozitife döner | 🟡 | CLAUDE §Money |

## 2. Tarih & Zaman (UK)

| ID | Değişmez | Bozulursa | 🔴 | Kaynak |
|----|----------|-----------|----|--------|
| INV-DATE-1 | ASLA `date.toISOString().split('T')[0]` → `toDateKey()` (`src/utils/timeUtils.js`) | BST'de (yaz saati) gün **bir gün kayar** → booking yanlış güne düşer | 🟠 | CLAUDE §Dates · [BUSINESS_RULES](BUSINESS_RULES.md) |
| INV-DATE-2 | UK DST hesapları `isUkDst` helper'ları ile (Mart/Ekim son Pazar, 01:00 UTC) | Saat ±1h kayar | 🟡 | CLAUDE §Dates |

## 3. Booking Modeli

| ID | Değişmez | Bozulursa | 🔴 | Kaynak |
|----|----------|-----------|----|--------|
| INV-BK-1 | **İş kuralı, veriye yazan/taşıyan TÜM yollarda olmalı** (booking + reschedule + walk-in). Yeni kısıt eklerken tüm yazma yollarını grep'le | Bir yol kuralı atlar → tutarsız/hayalet kayıt | 🟠 | INC 2026-06-29 (hayalet booking) |
| INV-BK-2 | Barber müsaitlik kısıtı hem UI'da gösterilir hem **server-side reddedilir** (off-day booking yazılamaz) | UI bypass + grid görünmezliği = yönetilemez kayıt | 🟠 | INC 2026-06-29 |
| INV-BK-3 | Reschedule **yönden bağımsız** — daima **en yeni email'in geliş zamanı** kazanır (booking tarihinin yönü değil) | Geriye/erken reschedule uygulanmaz, booking eski tarihte takılır | 🟠 | INC 2026-06-20 |
| INV-BK-4 | Reschedule conflict check (`hasTimeConflict(..., ignoreBookingId)`) save'den **ÖNCE**; `barberValue` **lowercased**; `barberId = barbers.find(b=>b.name===sel).id` (display name'den fabricate etme) | Çift-booking veya yanlış barber'a atama | 🟠 | CLAUDE §Reschedule · [BUSINESS_RULES](BUSINESS_RULES.md) |
| INV-BK-5 | `actualDuration` ≠ servis süresi (checkout'a basma anı). Geometri/çakışma/kapasitede daima `min(scheduledDuration, actualDuration)` ile cap'le — kart sadece KISALABİLİR | Geç checkout kartı şişirir → sahte cascade/örtüşme | 🟡 | INC 2026-06-27 · [processing-time](BUSY_SLOT_V2.md) |
| INV-BK-6 | Slot üretimi: son bookable start = kapanış − 15dk (`LAST_START_GAP_MINS`). `start + duration <= close` check'i **geri getirilmez** (spillover analytics kullanılıyor) | Slotlar yanlış kesilir veya spillover verisi bozulur | 🟡 | CLAUDE §Slot |
| INV-BK-7 | Status daima yüklemede uppercase normalize (`normalizeBookingStatus`). Blocking statüler: `CONFIRMED, PENDING, UNPAID, BLOCKED` | Import'tan gelen lowercase `checked_out` filtrelerden kaçar | 🟡 | CLAUDE §Booking · [status norm](FIRESTORE_SCHEMA.md) |
| INV-BK-8 | `booking.duration` service lookup'tan önce `parseInt()` | String duration → yanlış/eksik servis eşleşmesi | 🟡 | CLAUDE §Booking |

## 4. Barber & Client Eşleşme

| ID | Değişmez | Bozulursa | 🔴 | Kaynak |
|----|----------|-----------|----|--------|
| INV-MATCH-1 | Barber eşleşmesi **exact case-insensitive** (`barberKey()`); partial/substring/ilk-kelime fallback YOK. Yanlış kaynak isim → **kaynakta düzelt** | Aggregator tam-ad ("Arda Uzun") ≠ sistem ("Arda") → booking görünmez | 🟡 | INC 2026-06-26 · [matching politikası](NORMALIZATION.md) |
| INV-MATCH-2 | Parser'da ilk-ad eşleşmesi **ambiguity-safe**: iki barber aynı ilk adı paylaşıyorsa tahmin etme, raw bırak | Yanlış barber'a booking yazılır (sessiz) | 🟡 | INC 2026-06-26 |
| INV-MATCH-3 | `barberName` HER parser write'ında yazılmalı (matcher fallback'i) | Grid eşleşmesi tek `barberId`'ye bağlı kalır, kırılgan | 🟡 | INC 2026-06-26 |
| INV-MATCH-4 | Client lookup sırası: `clientManualId` → exact phone/email → `_aliases` → normalized phone (son 10 hane) → **name-only fallback (SON çare)**. Phone/email varken ASLA sadece isimle eşleme | Yanlış client'a booking/geçmiş bağlanır (GDPR + veri) | 🟠 | CLAUDE §Client identity |
| INV-MATCH-5 | Phone/email değişince eski değer `_aliases`'a `arrayUnion` ile eklenir | Booking geçmişi kopar | 🟡 | CLAUDE §Client identity |
| INV-MATCH-6 | Client edit → tüm assigned booking'lere **batch propagate** (client kimliği booking'e snapshot'lanır) | Client doc güncel, booking eski/bozuk kalır → yanlış adrese email | 🟡 | INC 2026-06-24 |
| INV-MATCH-7 | Telefon "son 4 hane" tek başına eşleşme anahtarı olarak kullanılmaz | Farklı kişiler çakışır | 🟡 | [parser standardı](NORMALIZATION.md) |

## 5. Email & Bildirim

| ID | Değişmez | Bozulursa | 🔴 | Kaynak |
|----|----------|-----------|----|--------|
| INV-MAIL-1 | Email'de ASLA optimistik "sent" gösterme — gerçek durum sunucudan (bayrak/live snapshot) | Başarısız gönderim "başarılı" görünür, teşhis günlerce gecikir | 🟡 | INC 2026-06-24 |
| INV-MAIL-2 | Dış API (Brevo) çağrısı HER ZAMAN try/catch içinde; başarısızlıkta idempotency bayrağını sıfırla | Yakalanmayan hata → **stuck flag** → fonksiyon bir daha tetiklenmez | 🟠 | INC 2026-06-24 |
| INV-MAIL-3 | Tetikleyici bayrak (`false→true`) tasarımında manuel retry önce `false` sonra `true` yazar | Takılı `true`'dan çıkış olmaz | 🟡 | INC 2026-06-24 |
| INV-MAIL-4 | Tüm email giriş noktalarında `isValidEmail` (format) — sadece "boş mu" yetmez | `name@gmailcom` kaydedilir → Brevo 400 zinciri | 🟡 | INC 2026-06-24 |
| INV-MAIL-5 | Email göndermeden önce `client.emailOptOut !== true` kontrolü (GDPR); her emailde unsubscribe → `salownEmailOptOut` | GDPR ihlali | 🔴 | CLAUDE §Email |
| INV-MAIL-6 | Gönderici stratejisi değişince (Gmail→Brevo) o yola giren TÜM fonksiyonların `secrets` listesini grep'le (`BREVO_API_KEY`) | Secret'i olmayan fn sessizce kırılır | 🟠 | INC 2026-06-26 |

## 6. Güvenlik & GDPR

| ID | Değişmez | Bozulursa | 🔴 | Kaynak |
|----|----------|-----------|----|--------|
| INV-SEC-1 | Booking `get`/`list`/`update` = auth-only. `create` = public ama **financial fields blocked**. Cancel/reschedule = server-side callable only | Yetkisiz okuma/yazma, fiyat manipülasyonu | 🔴 | CLAUDE §Security · [SECURITY.md](SECURITY.md) |
| INV-SEC-2 | Booking **ASLA public-readable yapılmaz** (GDPR). Public sayfa (success/cancel/manage) veriyi `sessionStorage`'dan veya sınırlı-alan callable'dan alır | Tüm müşteri PII'si dünyaya açılır | 🔴 | INC 2026-06-26 |
| INV-SEC-3 | `tenants/{id}` root doc **world-readable** → ASLA sır koyma; telegram/stripe token → `settings/integrations` subdoc; public veri → `tenants/{id}/public/{doc}` projeksiyonu | Sır sızıntısı | 🔴 | [tenant root public](MULTI_TENANT_NOTES.md) |
| INV-SEC-4 | Deploy sırası (güvenlik değişikliği): **functions → hosting → rules EN SON**. Canlı rules'ı önce API'den çek, path'leri haritala | Rules kör değişimi booking create/reschedule/settings okumayı kırdı (geçmişte) | 🔴 | CLAUDE §Commands · [rules safety](SECURITY.md) |
| INV-SEC-5 | Silme işlemleri (bu aşamada) SADECE super-admin (`isSuperAdmin` claim) — owner'lar dahil herkes kaybetti (pilot) | Yetki eskalasyonu / veri kaybı | 🔴 | [DECISIONS.md](DECISIONS.md) · INC 2026-07-02 |
| INV-SEC-6 | `serviceAccountKey.json` ASLA git'e commit edilmez (`.gitignore`'da) | Admin SDK credential sızıntısı | 🔴 | INC (Key Exposure) |
| INV-SEC-7 | Bulk Firestore silme: export → dry-run CSV → owner onayı → write. Asla kör bulk-delete | Geri dönülemez veri kaybı | 🔴 | CLAUDE §Commands |

## 7. Deploy

| ID | Değişmez | Bozulursa | 🔴 | Kaynak |
|----|----------|-----------|----|--------|
| INV-DEP-1 | salown-app tek deploy kaynağı = `hosting/`. Build atlayan HER `firebase deploy` bundle'ı siler → `firebase.json` **predeploy hook** garanti eder | Tüm SPA (login/signup/book/manage) 404'e düşer | 🔴 | INC 2026-06-29 · [ci gap](../salown-app) |
| INV-DEP-2 | Deploy öncesi tenant + URL'yi **söyle, onay bekle** | Yanlış hedefe/eskiye deploy | 🟠 | CLAUDE · [deploy safety](DEPLOY.md) |
| INV-DEP-3 | Her edit'ten önce `git status` + `git log origin/main..HEAD` | Başkasının uncommitted işini/unpushed commit'i ezme | 🟠 | CLAUDE §Process |
| INV-DEP-4 | **Multi-session:** sadece kendi dosyanı **explicit path** ile commit/deploy et. ASLA `git add .` / `git restore .` / `git checkout .` / `git reset --hard` | Başka session'ın uncommitted işi silinir | 🔴 | [git isolation](DEPLOY.md) |
| INV-DEP-5 | Landing'in tek canlı kaynağı `salown-app/hosting/index.html` (DEPLOY.md'deki symlink KIRIK) | Landing eskiye döner / değişiklik kaybolur | 🟡 | [landing source](DEPLOY.md) |
| INV-DEP-6 | Post-deploy smoke test: kritik rotalar 200 dönmezse deploy fail (bkz INC 2026-06-29 curl bloğu) | Sessiz kesinti haftalarca fark edilmez | 🟠 | INC 2026-06-29 |

## 8. Multi-tenant

| ID | Değişmez | Bozulursa | 🔴 | Kaynak |
|----|----------|-----------|----|--------|
| INV-MT-1 | Yeni salown-app trigger → **self-managed tenant guard** ekle | Trigger tüm tenant'larda ateşler, izole edilemez | 🟠 | CLAUDE · [MULTI_TENANT_NOTES.md](MULTI_TENANT_NOTES.md) |
| INV-MT-2 | Feature flag daima tenant doc'tan okunur, hardcode edilmez | Bir tenant'ın flag'i herkese yayılır | 🟠 | CLAUDE §Feature flag |
| INV-MT-3 | `Reports.jsx` platform-wide (tenant-specific isim hardcode YOK); `Finance.jsx` şimdilik whitecross-only. İkisini karıştırma | Bir tenant'ın mantığı diğerine sızar | 🟠 | CLAUDE §Page ownership |
| INV-MT-4 | `/signup` + `provisionTenant` (self-onboarding) ASLA kapatılmaz/gate'lenmez ("satmıyoruz, test ediyoruz") | Test akışı ölür | 🟠 | [DECISIONS.md](DECISIONS.md) |

## 9. Parser

| ID | Değişmez | Bozulursa | 🔴 | Kaynak |
|----|----------|-----------|----|--------|
| INV-PAR-1 | `externalId` dedup zorunlu; geçmiş tarihten re-run güvenli olmalı | Duplicate booking | 🟡 | CLAUDE §Email parsers |
| INV-PAR-2 | İki parser aynı inbox'ı okuyorsa `externalId` formatları **tam eşleşmeli**; tombstone = son güvenlik ağı | Aynı rezervasyon iki doc olur | 🟡 | INC 2026-06-17 |
| INV-PAR-3 | "Seen" bir email ASLA booking kaybına dönüşmez — idempotency guard'lar seen-skip'in yerini alır | Okunmuş email'in booking'i sessizce düşer | 🟠 | INC 2026-06-20, 2026-06-24 |
| INV-PAR-4 | Refactor-orphan: bir değişkenin tanımını/adını değiştirince TÜM kullanımlarını grep'le (`node -c` runtime ReferenceError'ı yakalamaz) | Öksüz değişken → sessiz ReferenceError → booking düşmez (11 gün kayıp örneği) | 🟠 | INC 2026-06-24 |
| INV-PAR-5 | Bir parser'da bug bulunca diğer İKİsinde de aynı satırı grep'le (Booksy/Fresha/Treatwell aynı kalıbı tekrarlar). "Benzer yorum var" ≠ "aynı davranış" | Yarım fix; bug diğer parser'da yaşar | 🟠 | INC 2026-06-24 · [PARSER_NOTES.md](PARSER_NOTES.md) |
| INV-PAR-6 | Parser değişikliği yalnız `firebase deploy --only functions` ile yayına girer | Değişiklik canlıya inmez | 🟡 | CLAUDE §Email parsers |

---

## 10. Kanal Senkronizasyonu (iCal OUT)

| ID | Değişmez | Bozulursa | 🔴 | Kaynak |
|----|----------|-----------|----|--------|
| INV-SYNC-1 | İki-yönlü takvim feed'i (`salownIcalFeed`) bir booking'i **geldiği platforma geri yansıtmaz** → tüketici-başına `?exclude=<Source>` ile o abone kendi source'unu filtreler (param yoksa Treatwell default, back-compat). Diğer TÜM source (walk-in/website/Booksy/Fresha/BLOCKED/busy-time) feed'de KALIR | Platform kendi randevusunu **çift** sayar (Treatwell'de çift görüntü) | 🟡 | `index.js` salownIcalFeed · edit_log 2026-07-07(c) |
| INV-SYNC-2 | "Tek paylaşılan feed'de tüm aggregator source'ları hariç tut" **YAPILMAZ** — her tüketici yalnız **kendi** source'unu hariç tutmalı (Treatwell, Booksy/Fresha booking'lerini görüp o slotları bloklamalı) | Cross-platform **çift-booking** (Treatwell, Booksy'nin dolu slotunu boş sanır) | 🟠 | `index.js` salownIcalFeed |

---

## Bakım (bu dosyayı nasıl güncel tutarız)
- Yeni bir incident **kalıcı bir kural** üretiyorsa (INCIDENTS "Prevention/Dersler"), buraya bir satır ekle + kaynağı göster.
- Bir invariant'ı **bilinçli** değiştiriyorsan: önce [DECISIONS.md](DECISIONS.md)'e gerekçeyle yaz, sonra buradaki satırı güncelle.
- Kural "kasıtlı tuhaflık" ise (bozuk değil, öyle tasarlandı) → INVARIANTS değil [KNOWN_QUIRKS.md](KNOWN_QUIRKS.md).
- Bu repo'da (`salown-docs`) değişiklik: `cd alex/docs && git commit INVARIANTS.md && git push`.
