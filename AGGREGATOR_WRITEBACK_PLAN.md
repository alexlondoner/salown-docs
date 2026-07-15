# AGGREGATOR_WRITEBACK_PLAN.md — İki-Yönlü Blok / Dışa-Yazma (çok-platform)

> **Durum (2026-07-15):** TASARIM — kod yok, doğrulama bekliyor.
> **Sahip:** Alfa (Whitecross owner + dev)
> **Amaç:** salOWN'da bir blok/booking oluşunca, aynı slotu salonun **Fresha ve Booksy**
> takviminde de otomatik kapatmak (outbound blocking) — kullanıcı için **tek-tık kolay**
> entegrasyonla.
>
> **🎯 Bitiş noktası (kuzey yıldızı):** Her platform için hedef = **Treatwell modeli** —
> salon platforma salOWN'un **iCal feed'ini** (`salownIcalFeed`) verir, platform dış takvimden
> meşguliyeti içeri alır, slot otomatik kapanır. Feed **zaten var ve çalışıyor** (Treatwell'de
> canlı). Sorun: Fresha/Booksy şu an dış takvimden meşguliyet **import etmiyor** → resmi köprü
> onlarda ölü. **Fresha yakında iki-yönlü açacak (Treatwell gibi); açtığı an tek yapacağımız
> şey feed'i paylaşmak olacak.** O güne kadar boşluğu **headless automation** (Playwright)
> ile salon adına blok yazarak dolduruyoruz. Booksy de aynı köprüde — açtığında o da feed'e döner.
>
> Yani headless = **geçici iskele**; kalıcı bina = herkesin iCal feed'e abone olduğu Treatwell
> modeli. Mimari, bir platformu headless'tan iCal'a **tek satır adapter-swap** ile geçirir.
> **İlişki:** [BUSY_SLOT_V2.md](BUSY_SLOT_V2.md) (kanal mimarisi, iCal OUT=`salownIcalFeed`),
> [DECISIONS.md](DECISIONS.md) (izolasyon), Quick Block (`QuickBlockSheet.jsx`).

---

## 1. Problem — asimetri

| Yön | Anlamı | Bugün |
|---|---|---|
| **INBOUND** (platform → salOWN) | Platformdaki booking salOWN slotunu doldurur | ✅ Var — email-parse borusu (2026-07-14/15 Fresha uçtan uca kanıtlandı; Booksy/Treatwell aynı boru) |
| **OUTBOUND** (salOWN → platform) | salOWN blok/booking platform slotunu kapatır | ⚠️ Kısmi — **Treatwell ✅** (iCal feed), **Fresha/Booksy ❌** (bu dokümanın konusu) |

Inbound zaten iş görüyor. Çözülmemiş yarı = **Fresha/Booksy'ye outbound blocking**. Resmi
yollar bu iki platformda (şimdilik) kapalı:
- **iCal / Calendar-subscribe (Treatwell'in çalışan yolu):** Fresha/Booksy dış takvimden
  meşguliyet **henüz import etmiyor** → feed'i veremiyoruz. **Fresha yakında açacak → o an
  bu satır Fresha için de ✅ olur, headless emekliye ayrılır.**
- **Public API:** Fresha/Booksy dışa açık yazma API'si vermiyor (partner-kapalı).

→ Açılana kadar tek yol: **salon adına, salonun izniyle, headless tarayıcıyla platform
paneline blok yazmak.** Bu, salonun **kendi hesabının** otomasyonu (yetkili, owner-onaylı) —
üçüncü-taraf verisine izinsiz erişim değil.

---

## 2. Kapsam (scope)

**YAPILACAK:**
- salOWN blok/booking oluş/sil → platform takviminde eşleşen blok oluştur/kaldır.
- **Fresha + Booksy** (ikisi de aynı adapter arayüzü, ayrı implementasyon). Sadece **outbound**.
  Sadece **blok/meşguliyet** (müşteri PII taşımayız — platforma "salOWN-{id}" etiketli boş blok
  yazarız, müşteri adı/telefonu değil).
- Faz sırası: Fresha önce (doğrulama + MVP), Booksy hemen ardından **aynı iskeleyle** (yeni
  adapter + selector haritası, gerisi ortak).

**YAPILMAYACAK:**
- Inbound okuma (email-parse zaten yapıyor; tekrar etme).
- Platformda müşteri booking'i **oluşturmak** (sadece meşguliyet bloğu — daha az kırılgan,
  daha az PII, tek amaç: çift-booking önleme).

---

## 3. Çekirdek içgörü — **Pluggable PlatformAdapter**

En kritik tasarım kararı: **automation motorunu, iş mantığından ayır.** Tek bir arayüz:

```ts
interface PlatformAdapter {
  connect(cred: Credential): Promise<Session>          // login / session doğrula
  createBlock(s: Session, b: BlockSpec): Promise<ExternalRef>
  removeBlock(s: Session, ref: ExternalRef): Promise<void>
  healthCheck(s: Session): Promise<HealthStatus>       // login + blok akışı hâlâ çalışıyor mu
}
```

Her platformun **3 olası durumu** var, hepsi aynı arayüzün implementasyonu:

| Durum | Adapter | Ne zaman |
|---|---|---|
| **Kapalı** (dış takvim import yok) | `*PlaywrightAdapter` (headless) | Bugün Fresha + Booksy |
| **Açık — iCal** (Treatwell gibi) | `IcalAdapter` — sadece feed URL'ini platforma ver | **Fresha yakında** + Booksy açınca; Treatwell'de **bugün ✅** |
| **Açık — API** (tam partner API) | `*ApiAdapter` | Varsa (bonus) |

`IcalAdapter` **zaten çözülü** — feed (`salownIcalFeed`) canlı, Treatwell ona abone. Bir
platform iki-yönlü açtığında yaptığımız tek şey: o tenant-platform çiftini
`PlaywrightAdapter`'dan `IcalAdapter`'a çevirmek (config flip) + owner'a "artık Fresha'da
şu feed URL'ini yapıştır" onboarding'i. **Kuyruk, veri modeli, UI iskeleti, reconcile HİÇ
değişmez.** Bu sayede "Fresha yakında açacak" gerçeği bugünkü headless işini **çöpe atmaz** —
kirli yarı emekliye ayrılır, kalıcı iskele (Treatwell modeli) kalır.

---

## 4. Mimari

### 4.1 Automation NEREDE koşar
**Firebase Functions'ta DEĞİL.** Playwright + Chromium binary (~300MB), cold-start,
540s timeout, headful-fallback ihtiyacı Functions'a sığmaz. Ayrı bir worker:

- **Cloud Run (job veya min-instance servis)** — Playwright container'ı. Firestore'daki
  görev kuyruğunu tüketir. `havuz-44f70` projesinde, `europe-west2`.
- Tetik: Firestore trigger görev yazar → Cloud Run worker Pub/Sub veya Firestore-listen
  ile çeker. (Pub/Sub push = anlık; poll = basit. MVP'de poll yeterli.)

### 4.2 Veri modeli (Firestore)

```
tenants/{tid}/integrations/fresha
  status: 'connected'|'needs_reauth'|'error'|'disconnected'
  sessionSecretRef: 'projects/…/secrets/fresha-session-{tid}/versions/latest'  // Secret Manager
  lastHealthCheckAt, lastError, connectedAt

tenants/{tid}/syncTasks/{taskId}
  platform: 'fresha'
  action: 'block'|'unblock'
  start, end, barberRef            // BlockSpec — PII YOK
  sourceBlockId                    // salOWN blok/booking doc id (idempotency)
  externalRef                      // Fresha'daki blok kimliği (unblock için)
  status: 'PENDING'|'RUNNING'|'DONE'|'FAILED'|'DEAD'
  attempts, nextAttemptAt, error
```

### 4.3 Akış
```
salOWN blok/booking create ─┐
salOWN blok/booking cancel ─┤→ Firestore trigger → syncTasks/{id} PENDING
                            │      (self-managed tenant guard + features.freshaSync flag)
Cloud Run worker ──poll──> PENDING task
   → Secret Manager'dan session (storageState) yükle
   → FreshaPlaywrightAdapter.createBlock/removeBlock
   → DONE + externalRef  |  FAILED (retry)  |  needs_reauth (owner'a banner)
```

### 4.4 Kimlik bilgisi kasası (en hassas kısım)
- Salon Fresha login'ini **Secret Manager**'da tut — **asla Firestore düz metin**
  (bkz T-b app-password dersi). Şifre değil, tercihen **session** sakla:
- **Playwright `storageState`** (cookie + localStorage) ilk login'de yakala → şifrele →
  Secret Manager. Sonraki işler **re-login yapmadan** session'ı yükler → 2FA sürtünmesi
  ve bot-tespiti minimuma iner. Re-auth yalnız session ölünce.
- Şifreyi hiç saklamamak ideal (session yeterli); saklanırsa sadece Secret Manager +
  yalnız worker SA erişir.

---

## 5. Kullanıcı entegrasyonu — "tek-tık kolay" (owner'ın açık önceliği)

Settings → Integrations → **"Connect Fresha"** sihirbazı:

1. **Assisted login (bir kez):** Owner Fresha email+şifresini girer **veya** daha güvenlisi:
   worker geçici bir oturum açar, owner 2FA/OTP'yi tek seferlik tamamlar. Başarılı olunca
   `storageState` yakalanır → "Connected ✓".
2. **Doğrulama:** worker test bloğu oluşturur+siler (health check) → yeşil rozet.
3. **Sonrası tamamen sessiz:** owner hiçbir şey yapmaz; bloklar arkada senkronlanır.
4. **Session ölünce:** panelde **"Reconnect Fresha"** banner'ı + push/email; owner tek tık
   ile 2FA'yı tekrar geçer. Sessiz-arıza YOK.

Sürtünme hedefi: ilk kurulum < 60 sn, sonrası sıfır dokunuş.

---

## 6. Dayanıklılık / anti-fragility (headless'ın kırılganlığını yönet)

Headless'ın gerçek riski = platform UI değişince sessizce kırılması. Karşı önlemler:

- **Merkezî selector haritası:** her platformun selector'ları tek dosyada
  (`fresha.selectors.ts`, `booksy.selectors.ts`); text/role-based + data-testid tercih.
  UI değişince = tek dosya fix, platform-izole.
- **Health canary (zamanlanmış):** her gün worker login + test-blok-oluştur-sil akışını
  koşar; kırılırsa **owner'a değil önce BİZE** alarm (Brevo/Telegram) → müşteri fark etmeden
  onarılır. (I1 canary kalıbının aggregator-write karşılığı.)
- **Idempotency + reconcile:** her salOWN bloğu Fresha'da `salOWN-{sourceBlockId}` notuyla
  etiketlenir → tekrar çalıştırma çift blok yazmaz; periyodik reconcile "salOWN'da var ama
  Fresha'da yok / tersi" farkını düzeltir.
- **Retry + dead-letter:** exponential backoff; N denemeden sonra `DEAD` + owner'a "Fresha'da
  bu slotu **elle** blokla" fallback bildirimi (asla sessiz kayıp).
- **İnsan-benzeri pacing + rate limit:** bot-tespitini azalt; hesap başına eşzamanlı 1 oturum.
- **Failure UX = dürüstlük:** senkronlanamayan slot panelde "⚠️ Fresha'ya yansımadı"
  rozetiyle görünür; owner gerçeği bilir.

---

## 7. Riskler (dürüst) + azaltım

| Risk | Gerçek | Azaltım |
|---|---|---|
| **ToS / hesap ban** | Fresha otomasyonu yasaklayabilir | Owner kendi hesabını otomatikliyor (yetkili); insan-pacing; düşük hacim (sadece bloklar); API çıkınca hemen swap |
| **2FA / login challenge** | En sık kırılma noktası | Session (`storageState`) reuse → login nadir; assisted reconnect akışı |
| **UI değişimi** | Selector kırılır | Merkezî selector + günlük canary + hızlı fix |
| **Bot tespiti** | Otomasyon bloklanır | Pacing, tek-oturum, stabil session, gerçek tarayıcı fingerprint |
| **Kimlik bilgisi sorumluluğu** | Salon şifresini tutmak yük | Şifre yerine session; Secret Manager; yalnız worker SA; şeffaf owner onayı |
| **Kırılgan zemin** | Avantaj bir hack'e bağlı | Bilinçli **geçici iskele**; adapter-swap ile Treatwell-modeli (iCal feed) hazır |

**Duruş:** Bu bir **geçiş iskelesi**, ürünün kalıcı belkemiği değil. Kalıcı bina = herkesin
salOWN iCal feed'ine abone olduğu Treatwell modeli. Platform açılınca adapter-swap ile o
binaya geçilir, iskele sökülür — yatırım *korunur*. "Unfair advantage" = salon tüm
platformlarda tek merkezden (salOWN) senkron kalır; headless o güne kadar boşluğu doldurur.

---

## 8. Platform açılınca — migration (asıl hedef)
Bir platform (önce Fresha, sonra Booksy) dış-takvim import'unu açtığında:
`*PlaywrightAdapter` → **`IcalAdapter`** (Treatwell'in bugün kullandığı, **hazır** olan yol).
Owner'a tek onboarding: "Fresha ayarlarına şu feed URL'ini yapıştır." Bundan sonra bloklama
platformun **kendi** iCal-sync'iyle olur → headless worker o platform için **tamamen kapanır**
(login/session/2FA/canary/selector derdi biter). Değişmeyen: syncTasks kuyruğu, veri modeli,
onboarding UI iskeleti, reconcile, failure UX. **Bu, bugünkü headless işinin geçici ama
çöpe-gitmez olmasının garantisi** — kalıcı bina Treatwell modeli, headless sadece o binaya
kadarki iskele. (Tam API varsa `*ApiAdapter` de aynı swap'la bağlanır; iCal genelde yeterli.)

---

## 9. Fazlar

- **Faz 0 — Doğrulama (kod yok):** Fresha test hesabında blok oluştur/sil akışını **elle**
  kaydet (tam tıklama/selector dizisi, 2FA davranışı, session ömrü). Bu olmadan Faz 1 kör uçuş.
- **Faz 1 — Fresha MVP:** Cloud Run worker + Secret Manager session + assisted login sihirbazı +
  tek blok create/remove + syncTasks kuyruğu + `FreshaPlaywrightAdapter`. Tek tenant (whitecross).
- **Faz 2 — Booksy:** aynı iskele + `BooksyPlaywrightAdapter` + Booksy selector haritası +
  Faz 0'ın Booksy karşılığı. Kuyruk/UI/kasa ortak.
- **Faz 3 — Sağlamlaştırma:** reconcile job + günlük canary + retry/dead-letter + failure UX
  + reconnect banner (her iki platform).
- **Faz 4 — Ölçek:** çok-tenant session pool, eşzamanlılık, izleme dashboard.
- **Faz 5 — Migration (hedef):** platform iki-yönlü açınca `PlaywrightAdapter` → `IcalAdapter`
  (feed paylaş), o platformda headless kapanır. Fresha muhtemelen ilk.

---

## 10. Açık sorular (Faz 0'da yanıtlanacak — her platform için ayrı)
1. Session (storageState) kaç gün yaşıyor? (re-auth sıklığını belirler)
2. Login'de 2FA zorunlu mu, "trusted device" ile atlanıyor mu?
3. Panelde "blok/personal time" oluşturmanın en stabil UI yolu hangisi?
4. Bot-tespiti var mı (Cloudflare challenge, device fingerprint)?
5. Blok'a not/etiket eklenebiliyor mu (idempotency için `salOWN-{id}`)?
6. **Kritik / hedef:** Platform "dış iCal takvimine abone olup meşguliyeti içeri alma"yı
   destekliyor mu, ne zaman açacak? (Destekler desteklemez `IcalAdapter`'a geç, headless bitir.)

---

## 11. Referanslar
- [BUSY_SLOT_V2.md](BUSY_SLOT_V2.md) — kanal mimarisi, iCal OUT (Treatwell zaten çalışan köprü)
- [DECISIONS.md](DECISIONS.md) — izolasyon/güvenlik kararları
- [EMAIL_ARCHITECTURE.md](EMAIL_ARCHITECTURE.md) — inbound parse borusu (bu dokümanın tamamlayıcısı)
- Quick Block: `salown-app/src/…/QuickBlockSheet.jsx` — outbound tetiğin UI kaynağı
