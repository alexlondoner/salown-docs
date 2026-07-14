# D1 — Staff App'i Native'e Taşıma (Capacitor + App Store) — Detaylı Plan

> **Durum: 🅿️ HAZIR BEKLİYOR / acele YOK.** Owner kararı (2026-07-14): *"bizim app'in üzerinden daha çok geçmemiz lazım, acele etmiyorum."* Native sarma bir **paketleme/dağıtım** adımı — ürün (staff app'in kendi akışları) olgunlaştıktan sonra istenen an uygulanır. Plan hazırdır ki o gün geldiğinde sıfırdan düşünmeyelim.
>
> ROADMAP özeti: bkz `ROADMAP.md` → D1. İlgili: D2 (Apple sign-in — aynı Apple Developer hesabını paylaşır), D4 (emoji→SVG ikon sistemi = Capacitor-safe hazırlık ZATEN yapıldı), D5 (iOS viewport/drift kök-neden fix ZATEN yapıldı).

## 1. Neden (gerekçe)
- **iOS'ta web push kırılgan:** PWA bildirimi sadece "ana ekrana ekle" ile kurulmuşsa ve iOS 16.4+ ile çalışır; kullanıcı deneyimi güvenilmez. Native app **gerçek APNs push** verir → barberlar bildirimi güvenilir alır.
- **"Sil-yükle / cache temizle" derdi biter:** Native app + OTA ile sürüm yönetimi geliştiricinin kontrolüne geçer; kullanıcı elle cache temizlemek zorunda kalmaz (bkz §5).
- App Store'da olmak = kurumsal güven + kolay dağıtım (barber'a link yerine "App Store'dan indir").

## 2. Mevcut durum (2026-07-14 repo tespiti)
- **Capacitor kurulu DEĞİL** — sıfırdan native wrap. `package.json`'da hiçbir `@capacitor/*` yok; `ios/` `android/` klasörleri yok.
- Staff app **ayrı Vite build**: `vite.staff.config.js` → çıktı `hosting/staff-bundle/` (entry `staff.html` → `index.html`'e rename edilir). **Bu klasör aynen Capacitor'ın `webDir`'i olur — mimari uyumlu.**
- **Push şu an web FCM ile:** `src/staff/StaffApp.tsx` `firebase/messaging` `getToken` (VAPID key) + `hosting/staff-bundle/sw.js` (service worker, `onBackgroundMessage`). Token → `tenants/{tid}/fcmTokens/{token}` (`uid`/`barberName`/`role`/`updatedAt`).
- **Sunucu tarafı hazır ve native-uyumlu:** `functions/src/notifications/index.ts` `_sendFcmPush` → `admin.messaging().sendEachForMulticast(tokens)` + ölü token temizliği (`registration-token-not-registered` → doc.delete). **Bu FCM multicast native token'larla da aynen çalışır → backend'e neredeyse hiç dokunulmaz.**
- Stack: Firebase v12, React 19, react-router 7, Vite 8 — hepsi Capacitor ile uyumlu.
- **Zaten yapılmış hazırlık:** D4 ikon sistemi (tüm emoji → inline SVG, "Capacitor-safe") + D5 viewport fix (`maximum-scale=1`, `touch-action`). Yani zemin kademeli hazırlanıyor.

## 3. Ön koşullar (kod yazmadan önce edinilmesi gerekenler)
| Gereksinim | Detay | Maliyet | Kim |
|---|---|---|---|
| **Apple Developer Program** | App Store yayını + APNs için zorunlu. D2 (Apple sign-in) ile ORTAK. | **$99/yıl** | Owner |
| **Mac + Xcode** | iOS build **yalnızca macOS'ta** yapılır (Linux'ta imkânsız). Ekipte Mac var (diğer session'lar oradan çalışıyor). | — | Var ✅ |
| **APNs Auth Key (.p8)** | Apple Developer → Keys → yeni APNs key → Firebase Console → Cloud Messaging → iOS app'e yüklenir. FCM'in iPhone'a ulaşması için köprü. | Ücretsiz | Owner + geliştirici |
| **Bundle ID** | ör. `com.whitecross.staff` (ya da `com.salown.staff` — multi-tenant marka kararı). Apple'da App ID olarak kaydedilir. | — | Owner kararı |
| **Google Play Console** (Android da istenirse) | Tek seferlik kayıt. | $25 (tek sefer) | Owner |

## 4. Fazlar

### Faz 1 — Capacitor kabuğu (½–1 gün)
1. `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`
2. `npx cap init` → app name + **Bundle ID**; `capacitor.config.ts` `webDir: 'hosting/staff-bundle'`.
3. `npx cap add ios` (+ istenirse `android`) → native projeler üretilir (`ios/`, `android/`).
4. Build akışı: `npm run build:staff && npx cap sync` (web build'i native kabuğa kopyalar). Bunu bir `npm run build:native` script'ine bağla.
5. İkon + splash: `@capacitor/assets` ile tek kaynaktan üretilir.
6. `npx cap open ios` → Xcode → simülatörde çalıştır.
- **DoD:** Staff app iPhone simülatöründe açılıyor, login + temel akış çalışıyor (henüz native push YOK).

### Faz 2 — Native push (1–2 gün — işin kalbi)
1. `npm i @capacitor/push-notifications` (veya `@capacitor-firebase/messaging` — Firebase token'ı doğrudan verir, tercih edilir).
2. `src/staff/StaffApp.tsx` `initFCM`'i **platforma göre dallandır** (`Capacitor.isNativePlatform()`):
   - **Web** → mevcut `firebase/messaging` yolu AYNEN kalır (PWA çalışmaya devam eder).
   - **Native** → Capacitor plugin ile: izin iste → register → **FCM token** al → aynı `tenants/{tid}/fcmTokens/{token}` yoluna aynı şema ile yaz (`uid`/`barberName`/`role`/`updatedAt`). **Firestore şeması + sunucu gönderimi DEĞİŞMEZ.**
   - Foreground mesaj: `onMessage` yerine native `pushNotificationReceived` listener (StaffRouter'daki toast mantığı korunur).
3. **iOS APNs:** `.p8` anahtarını Firebase Console'a yükle. Xcode'da **Signing & Capabilities → Push Notifications + Background Modes (Remote notifications)** aç.
4. Logout'ta token silme (mevcut `handleLogout` mantığı) native token için de çalışsın.
- **DoD:** Gerçek iPhone'a (TestFlight) native push düşüyor; web-push'un iOS kırılganlığı bitti. `fcmTokens`'ta native token görünüyor, ölü web token'ları eskisi gibi temizleniyor.

### Faz 3 — OTA / havadan güncelleme (½ gün)
- **Amaç:** JS/HTML/CSS değişiklikleri (ör. bugünkü ciro fix'i gibi) App Store onayı beklemeden anında gitsin. Kullanıcı hiçbir şey yapmasın.
- **Araç:** **Capgo** (açık kaynak, uygun fiyat — önerilen) veya Ionic Appflow Live Updates. Build sonrası bundle Capgo'ya push edilir; uygulama açılışta yeni sürümü indirir + uygular.
- **Apple kuralı (kritik):** OTA yalnız web katmanı içindir. Native işlevsellik/izin değişikliği yine App Store build'i gerektirir (App Store Guideline 4.2/2.5.2 — sadece "bug fix ve içerik güncellemesi" OTA'dan geçebilir).
- **DoD:** Bir JS değişikliği build edip Capgo'ya push → yüklü cihaz açılışta yeni sürümü alıyor (store'a uğramadan).

### Faz 4 — Store yayını (½ gün geliştirme + Apple inceleme 1–3 gün)
1. Privacy manifest (`PrivacyInfo.xcprivacy`), bildirim izni açıklama metni (`NSUserNotificationsUsageDescription` benzeri Info.plist alanları).
2. App Store Connect: uygulama kaydı, ekran görüntüleri, açıklama, kategori.
3. TestFlight → owner + barberlar gerçek cihazda test.
4. App Store'a gönderim → Apple review → yayın.
- **DoD:** App Store'da canlı; barberlar mağazadan indiriyor.

## 5. "Sil-yükle" derdi neden biter? (owner sorusu 2026-07-14)
| Değişiklik türü | Nasıl gider | Apple onayı | Kullanıcı ne yapar |
|---|---|---|---|
| Bug/mantık/ekran (ör. ciro fix'i) | **OTA — anında** (Faz 3) | ❌ Gerekmez | Hiçbir şey; açınca güncel |
| Yeni native özellik / izin / SDK | Yeni App Store build (Faz 4) | ✅ 1–3 gün | Otomatik güncellenir (iOS default auto-update) |

PWA'daki "cache temizle / kısayolu sil-yükle" ihtiyacı native'de yok — sürümü uygulama kendi yönetir.

## 6. Efor & maliyet özeti
| Faz | Süre | Not |
|---|---|---|
| 1 — Kabuk | ½–1 gün | Geliştirici (Mac'te) |
| 2 — Native push | 1–2 gün | En kritik; backend değişmez |
| 3 — OTA | ½ gün | Sil-yükle derdini bitirir |
| 4 — Store | ½ gün + Apple review | İmza/gönderim adımları Mac'te owner+geliştirici |
| **Toplam** | **~3–4 gün geliştirme** | + $99/yıl Apple (+$25 tek sefer Play, istenirse) |

## 7. Riskler & açık kararlar (owner'a)
1. **Bundle ID / marka:** `com.whitecross.staff` mı `com.salown.staff` mı? Multi-tenant olduğu için tek "Salown Staff" app'i mi, yoksa tenant başına white-label app mi? → **Öneri:** tek `Salown Staff` app'i (tenant login ile ayrışır); white-label ileride ayrı iş.
2. **Apple guideline 4.2 ("minimum functionality"):** salt web-wrapper app'ler bazen reddedilir. Native push + offline + native hissi ekleyerek geçilir; tam-remote (`server.url` ile canlı siteyi yükleme) yaklaşımından kaçın → bundle'ı gömülü tut + OTA ile güncelle.
3. **Android paralelliği:** aynı Capacitor projesinden gelir; ekstra ~½ gün + Play $25. Owner Android da istiyor mu?
4. **D2 bağı:** Apple Developer hesabı D2 (Apple sign-in) ile ORTAK — ikisini aynı hesap kurulumunda halletmek verimli.

## 8. Başlarken ilk komut (referans)
```bash
cd ~/alex/Salown
npm i @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "Salown Staff" com.salown.staff --web-dir hosting/staff-bundle
npx cap add ios
npm run build:staff && npx cap sync
npx cap open ios   # Xcode açar (Mac gerekir)
```

---
*Bu doküman HAZIR-BEKLE statüsündedir; iş başlayınca ROADMAP D1 ✅+hash ile işaretlenir ve [[edit-log-salown]]'a kayıt düşülür. Bakım: staff app'te native-alakalı bir değişiklik olursa (ör. yeni izin gereksinimi) buraya not düş.*
