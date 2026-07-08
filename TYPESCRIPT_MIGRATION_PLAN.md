# TypeScript Migration Plan — Salown

> _Bu artık sadece bir "migration checklist" değil — canlı, gerçek-para dönen bir
> SaaS'ın önümüzdeki 2-3 yıldaki teknik evriminin **anayasası.** Dosya uzantısı
> değiştirmiyoruz; üretim temelini uzun vadeye hazırlıyoruz. Invariants + Rules +
> DoD bölümleri bu yüzden var: plan değişse de bu sınırlar sabit kalır._

> **Karar: 2026-07-08 (owner).** Sistem TS üzerinden kurulacak. Bu doküman
> *nasıl* — canlı sisteme sıfır risk vererek, fazlı, geri-alınabilir şekilde.
> Kaynak tartışma: owner + Xlaude. İlgili: [ROADMAP.md](ROADMAP.md) I2 (index.js
> split) · [INVARIANTS.md](INVARIANTS.md) (externalId/para/tarih değişmezleri).

> ## 🚫 FAZ 0'DA HİÇBİR PRODUCTION KODU TAŞINMAZ
> Faz 0'ın **tek** çıktısı: `toolchain` + `type infrastructure`. **Feature = 0**,
> refactor = 0, taşınan prod modülü = 0. Bu kural scope-creep'i keser: ilk teknik
> adımın tek amacı altyapıyı kurmak; davranış değiştiren hiçbir iş aynı commit'e
> karışmaz → ileride sorun çıkarsa nedeni izole etmek kolay olur.

## Milestone haritası (owner+GPT 07-08)
Tempo — her biri ayrı, doğrulanıp geçilir (bugüne kadarki disiplin: *küçük değişiklik
→ production doğrulama → dokümantasyon → sonraki adım*):
| | Milestone | İçerik |
|---|-----------|--------|
| **A** | 📄 Docs | Bu plan + ROADMAP commit+push → resmi karar (ADR) |
| **B** | 🛠 Toolchain ✅ **(2026-07-08)** | `tsconfig` (allowJs/checkJs:false/noEmit/strict:false), pipeline değişmez — bkz §7 DoD |
| **C** | 📦 Shared types ✅ **(2026-07-08)** | `packages/shared` modeller + domain dili — seçenek (b), bkz §7 Faz 1 DoD |
| **D** | 🔧 İlk gerçek migration | ilk küçük modül (identity/utils), `.js`+JSDoc |
| **E** | 💳 Stripe / Checkout | **EN SON** — money-modülleri, parite + rollback |

## 📜 Migration Invariants (bozulursa migration durur — GPT 07-08)
Bu 8 madde, "planı değil kodu okumaya başlayanlar" için referans. İhlal = dur.
1. **Hiçbir tenant downtime yaşamaz.**
2. **Hiçbir Firestore path değişmez** (koleksiyon/doc yolları sabit).
3. **Hiçbir API response shape değişmez** (callable/HTTP function çıktı sözleşmesi).
4. **Database migration YOK** (TS geçişi veri şeması/dokümanı değiştirmez).
5. **Stripe webhook sözleşmesi değişmez** (event'ten okuduğumuz alanlar + handler davranışı sabit).
6. **Feature development DURMAZ** (migration yeni özelliği bloklamaz; yeni özellik TS gelir).
7. **Her faz rollback edilebilir** (git revert + release tag + smoke).
8. **Production davranışı REFERANS implementasyondur** — eski JS = spec. Şüphede kalınca
   "TS ne yapmalı?" değil, "bugünkü JS ne yapıyor?" sorulur. Parity bu maddeden doğar.
9. **Dokümantasyon implementasyondan ÖNCE güncellenir** — karar önce burada/ROADMAP'te
   yazılır, sonra kod. (Bu planın ta kendisi bunun kanıtı; kararsızlıkları azaltır.)

## 📏 Migration Rules (ekip disiplini — bugün 1 kişi+Claude, yarın 2+ mühendis)
Migration'ın yarıda kalmamasını sağlayan kurallar:
- **Yeni JS yazılmaz.** Yeni dosya = `.ts`/`.tsx` (veya ara-adımda `.js`+JSDoc).
- **Yeni feature TS gelir.**
- **Eski JS yalnızca bugfix için değişir** (fırsattan refactor YOK).
- **Refactor yalnız migration PR'ında** yapılır (feature PR'ına karışmaz).
- **One concern per PR** — bir PR ya migration ya feature ya bugfix; karışım yok.
- **Behavior parity before optimization** — önce birebir aynı davranış, iyileştirme sonra.
- **Kod ve kod içi yorumlar İNGİLİZCE** (owner kararı 2026-07-08) — yarın ekibe Türkçe
  bilmeyen mühendis katıldığında engel olmasın. Docs Türkçe kalabilir; kod artefaktı
  (tip dosyaları, yorumlar, commit mesajları, script çıktıları) İngilizce.

## 📊 KPI — ilerleme panosu (yönsel, deadline DEĞİL · **otomatik sayılır**)
> Bu sayılar *yön* gösterir, tarih değil (bkz §0.6 parity-driven). "0 JS" bir hedef
> yönü; kapı değil. **Manuel güncellenmez** → `npm run migration:stats` üretir (spec §7),
> böylece dokümandaki sayılar her zaman gerçek.

| Metric | Başlangıç (2026-07-08) | Hedef yönü |
|--------|------------------------|-----------|
| Frontend JS/JSX dosya | **104** | → 0 |
| Frontend TS/TSX dosya | **0** | → 104 |
| Functions JS dosya | **5** (index.js 5759 satır dahil) | → 0 (split + .ts) |
| Functions TS | **0%** | → 100% |
| Shared models | **0 / 8** | → 8 / 8 |
| `any` kullanımı | 0 | → mümkün olduğunca 0 |
| `@ts-ignore` | 0 | → 0 (sıfır kalır) |
| `strict` hataları | N/A (kapalı) | → 0 (Faz 4 sonunda) |

## Neden şimdi
İlk 3-4 ay "çabuk çalışan ürün" doğru hedefti. Bugün: multi-tenant, Stripe
Connect, loyalty, marketing automation, campaign attribution, finance, AI, email
webhooks, discount engine, (yakında) Capacitor — birbirine bağlı onlarca modül,
gerçek para, gerçek müşteri. Bu ölçekte bugün elle yakaladığımız hata sınıfı
(`'deposit'≠'DEPOSIT'` casing, telefon format `083...`≠`+447...`, slug serviceId,
Firestore odd-path, dupe'lar) **compile-time yakalanabilir.** TS yeni özellik
değil — ölçekte tenant'ları koruyan zırh.

---

## 0. Pazarlıksız güvenlik ilkeleri (önce bunlar)

> **ALTIN KURAL:** Çalışan sistem, biz *bilinçli + doğrulanmış* şekilde anahtarı
> çevirene kadar birebir aynı kodu çalıştırır — ve anahtar her an geri çevrilir.

1. **Faz 0 tamamen inert.** Yeni `.ts` dosyaları kimse `require`/`import` etmediği
   sürece çalışma anına DEĞMEZ. Canlı sistem bit-bit aynı byte'ları çalıştırır.
2. **Davranış taşıyan her dönüşüm parite testiyle gelir** (aynı girdi → aynı
   çıktı, eski JS ile karşılaştırmalı) — özellikle para/tarih/dedup.
3. **Deploy disiplini:** yalnız temiz-pencerede (index.js `git status` temiz +
   diğer session'lar 30 dk durur) · **`firebase deploy --only functions:salown`**
   (ASLA blanket `--only functions` = 27 us-central1 orphan siler) · deploy'dan
   önce tenant+URL söyle, onay bekle · sonra booking-confirmation + Telegram smoke.
4. **Rollback = `git revert` + redeploy** (2 dk, bilinen-iyi hale dönüş). Her faz
   bağımsız revert edilebilir olmalı.
5. **Frontend ile functions AYRI build.** Biri diğerini deploy'da kıramaz; her
   faz tek tarafı hedefler.
6. **Deadline YOK — parity ile ilerler.** Bu planın hiçbir yerinde "3 haftada biter"
   yazmaz. İlerleme: `JS → TS → davranış birebir aynı mı? → evet → sonraki modül`.
   Production migration takvimle değil, parite ile yürür. Hız değil güven kriter.

---

## 1. Toolchain — iki taraf, iki gerçek

### Frontend (`salown-app/src/`) — düşük sürtünme
Vite TS'i **native** destekler (esbuild transpile eder). `.jsx→.tsx` yeniden
adlandırma kademeli; Vite hiç config'siz çalışır. Tip-kontrolü opsiyonel katman
(`tsc --noEmit` CI'da), build'i bloklamaz. → **React tarafı risksiz + kademeli.**

### Functions (`salown-app/functions/`) — dikkatli taraf
Şu an: `main: index.js`, CommonJS, tsconfig yok, build yok. Gerçek `.ts` için
`tsc` build gerekir: `src/*.ts → lib/*.js`, `main` → `lib/index.js`, `predeploy`
build hook. **Bu, pipeline'ı değiştiren TEK gerçek karar** → tek temiz-pencerede,
eski `index.js` anında-rollback olarak korunarak yapılır.

**✅ TOOLCHAIN KARARI (owner+GPT 07-08): ara-adımı ATLAMA — production stability >
developer convenience.** Sıra:
1. **Faz 0:** `allowJs/checkJs:false/noEmit` — pipeline HİÇ değişmez, sadece tip bilgisi.
2. **Faz 1:** `packages/shared` modeller — runtime değişmez.
3. **Faz 2:** ilk küçük modül (identity, utils) + **gerçek deploy** — pipeline HÂLÂ aynı.
4. **Faz 3:** toolchain denenmiş + tipler oturmuş + ekip alışmış → **functions tam `.ts`
   build**'e (main→lib) o zaman geç. Erken değil.

> **⚠️ CommonJS limitation (functions) — DİKKAT**
> - `tsc --noEmit` yalnızca **tip kontrolü** yapar; JS üretmez.
> - CommonJS `index.js`, **derlenmemiş `.ts` dosyalarını `require()` edemez.**
> - Bu nedenle Faz 0-2 boyunca çalışan Functions kodu **`.js` + JSDoc** olarak kalır.
> - `.ts` implementasyonuna geçiş, **yalnızca build pipeline (`src → lib`) etkinleştiğinde**
>   (Faz 3) yapılır.
> - → Mevcut `functions/clients/identity.ts` taslağı: ya Faz 2 için `identity.js`+JSDoc'a
>   çevrilir, ya da Faz 3'e kadar inert bekletilir. (Frontend'de bu sorun YOK — Vite
>   `.ts`/`.tsx`'i native derler.)

### Faz mekaniği — tek bakışta "ne değişiyor?" (owner+GPT 07-08)
| Faz | Runtime | Type checking | Build (src→lib) |
|-----|---------|---------------|-----------------|
| **0** | JS | JSDoc + `tsc --noEmit` | ❌ pipeline aynı |
| **1** | JS | + shared types | ❌ pipeline aynı |
| **2** | JS (`.js`+JSDoc) | JSDoc + shared types | ❌ pipeline aynı |
| **3** | **TS (`src/`)** | **Full TS** | ✅ **`src → lib`, `main: lib/index.js`** |
| **4** | TS | **`strict: true`** | ✅ |

> **Pipeline'ın gerçekten değiştiği tek an = Faz 3.** Faz 0-2 boyunca functions deploy
> bugünküyle bit-bit aynı; `main: index.js` korunur. Faz 3'te `main: lib/index.js` olur
> ve eski `index.js` rollback için saklanır. Not: bu tablonun Faz'ları *runtime/build*
> merceğidir; §3'teki modül-sırası tablosu *hangi modül ne zaman* merceği — ikisi
> dikey/yatay eksen gibi birbirini tamamlar.

### Kademeli tsconfig — büyük-bang YOK (owner ekleme 07-08)
İlk gün her şeyi çevirme. Başlangıç config:
```jsonc
{
  "compilerOptions": {
    "allowJs": true,     // mevcut .js çalışmaya devam eder
    "checkJs": false,    // eski JS'i henüz tip-kontrol etme (gürültü yok)
    "strict": false,     // ⚠️ ilk gün AÇMA — yoksa binlerce hata (bkz aşağı)
    "noEmit": true       // Faz 0'da sadece kontrol, emit yok
  }
}
```
Böylece: mevcut JS aynen çalışır · yeni dosyalar TS · big-bang yok.

### `strict` ilk gün AÇILMAZ (owner ekleme 07-08)
Migration boyunca `strict:false` (veya seçici: `strictNullChecks` önce). **Migration
bitince** `strict:true`. Erken açmak = binlerce eski-kod hatasıyla boğulmak →
gerçek işi gizler. Strict'i bir bitiş çizgisi olarak tut, başlangıç değil.

---

## 2. `shared/` — tek tip kaynağı (ve deploy tuzağı)

Hedef: `Booking`, `Client`, `Tenant`, `Campaign`, `Coupon`, `Payment`, `Loyalty`
modelleri **tek yerde** → hem React hem Functions kullanır, duplicate interface yok.

**Tuzak:** Firebase Functions deploy'da yalnız `functions/` klasörünü yükler →
repo-kökü `shared/`'ı require EDEMEZ. Frontend (Vite) alias'la sorunsuz alır.

**Çözüm — monorepo workspace (owner tercihi 07-08, tercih edilen):**
```
packages/shared/src/{booking,client,tenant,campaign,coupon,loyalty,invoice,payment}.ts
salown-app/            (frontend, Vite)
salown-app/functions/  (Cloud Functions)
```
`packages/shared` gerçek bir npm **workspace paketi** (`@salown/shared`) → hem
frontend hem functions `import type { Booking } from '@salown/shared'` der. Kopya
script yok, duplicate interface yok.

> **🔑 Neden functions deploy'unu KIRMAZ (kritik içgörü):** `packages/shared`
> **type-only** (sadece `interface`/`type`, runtime kod YOK) olduğu sürece, `tsc`
> functions'ı derlerken `import type`'lar **tamamen silinir** → derlenmiş `lib/`
> içinde `@salown/shared`'a **hiç referans kalmaz** → deploy artifact self-contained,
> workspace-symlink çözme derdi yok. Type-only shared, monorepo'yu functions için
> de temiz yapan şeydir.
>
> ⚠️ **Sınır:** shared'a bir gün runtime kod girerse (zod validator'lar vb.) bu
> silinme bozulur → o an functions deploy'u için bundling (esbuild/tsc `outDir`
> içine dahil) gerekir. Kural: **`packages/shared` type-only kalır**; runtime
> doğrulama (zod) ayrı bir pakete/katmana gider.

- Tek gerçek (SSOT) = `packages/shared/src/`; iki taraf da onu import eder.
- Repo yapısı workspace'e uygun değilse geçici kopya/generation kullanılabilir; ama
  uzun vade = ortak paket (daha temiz).

### `packages/shared` — sıkı kurallar (owner+GPT 07-08): GERÇEKTEN "zero runtime"
"import type silinir" garantisi **her yerde `import type` kullanılmasına** bağlı. Biri
`import { Booking }` (type'sız) yazarsa TS bunu runtime import bırakabilir → functions'ta
paket-çözümleme hatası. Bunu **iki katmanlı** engelliyoruz:

**(1) Paket içeriği kuralı** — `packages/shared` yalnız:
| ✔ İZİN | ✘ YASAK |
|--------|---------|
| `interface`, `type` | `function`, `class`, `const` (runtime değer) |
| `enum` → **union type tercih** (`type X = 'a'\|'b'`, enum runtime kod üretir) | runtime validation / **zod** |
| utility types | `firebase`, `stripe` importları |

**(2) ESLint zorlaması** — `@typescript-eslint/consistent-type-imports` kuralı editör +
CI seviyesinde `import type`'a **zorlar** → yanlış runtime import oluşamaz. (Bu kural
DoD'nin "ESLint temiz" maddesine dahil.)

### Zod = AYRI paket (type ≠ validation)
Tipler compile'da kaybolur; zod runtime çalışır. Karıştırma:
```
packages/shared-types/       # Booking.ts, Client.ts ...  → compile-time, silinir
packages/shared-validation/  # booking.schema.ts ...      → runtime zod (Firestore sınırı)
```
`shared-types` type-only kalır (functions deploy'u temiz); `shared-validation` runtime
olduğu için onu kullanan taraf onu bundle'lar. Ayrım ileride çok rahat ettirir.

### Shared = sadece interface değil, DOMAIN DİLİ
Ortak union/enum'lar tek yerde → frontend + functions + admin + marketing **aynı dili**
konuşur: `BookingStatus`, `BookingSource`, `PaymentType`, `CampaignType`, `CampaignStatus`,
`CouponType`, `LoyaltyReason` (`LoyaltyAdjustmentReason`), `EmailEventType`,
`StripePaymentMode`, `TenantRole` (owner/admin/staff — bkz güvenlik/permissions).
Bunlar bugün string literal olarak dağınık (casing bug'ının kaynağı)
→ tek union type = compile-time koruma. Bu "domain vocabulary" zamanla onlarca yerde
kullanılacak → tek kaynak şart.

---

## 3. Faz planı (sıra + her fazın "bitti" tanımı)

| Faz | Kapsam | Risk | Bitti tanımı (DoD) |
|-----|--------|------|--------------------|
| **0** | Toolchain iskeleti: `shared/types/` + functions `tsconfig` (noEmit) + Vite alias. Hiçbir prod dosyası require etmez. | **Sıfır** | `tsc --noEmit` yeşil; deploy DEĞİŞMEDEN çalışır; canlı bit-bit aynı |
| **1** ✅ **(2026-07-08)** | **Önce tipler, sonra implementasyon** (owner 07-08): ilk hafta hedefi = `Booking`, `Client`, `Tenant`, `Campaign`, `Coupon`, `Loyalty`, `Invoice`, `Payment` (`PaymentType='DEPOSIT'\|'FULL'`) + `BookingStatus`, `BookingSource` interface'leri. **Kod aynı kalır** — sadece tip tanımı. Bu bile yüzlerce hatayı önlemeye başlar. | **Sıfır** | ✅ Modeller derlenir; henüz kimse import etmiyor (bkz §7 Faz 1 DoD — invoice gerçeği dahil) |
| **2** | Functions split → TS, **sıra: kararlı/pure ÖNCE** (`clients/identity`, `utils/`, `parsers/`, `notifications/`, `marketing/`), **money-modülleri EN SON** (`checkout/`, `stripe/`, `bookings/` — aktif düzenleniyor + para-kritik). Her modül: taşı → tiple → parite testi → temiz-pencere deploy. | **Kontrollü** | Her modül: parite testi geçer + `functions:salown` deploy + 50 fn ACTIVE + booking-confirmation & Telegram smoke; index.js küçülür |
| **3** | React `src/` modülleri `.tsx`; `utils/` + yeni componentler önce; `strict` kademeli. | **Düşük** (Vite native) | `tsc --noEmit` yeşil; `npm run build` sıfır-error; app canlı doğrulanır |
| **4** | En büyük/riskli dosyalar en son (index.js kalıntısı, Finance, Dashboard). | **Yüksek → izole** | Tam parite + smoke; rollback hazır |

**Klasörleme (functions):** `bookings/ · checkout/ · stripe/ · marketing/ ·
finance/ · loyalty/ · clients/ · parsers/ · notifications/ · reports/ · ai/ ·
utils/ · shared/`. (Sadece okunabilirlik değil — TS tip kontrolünden de daha iyi
yararlanma.)

**İlk somut modül (Faz 2 başlangıcı):** `clients/identity.ts` — kanonik kimlik
çözücü (`normalizePhone/Email`, `matchIdentity`). Neden ilk: (a) pure + tam
test-edilebilir, (b) para/stripe/bookings'e dokunmaz, (c) bugün yaşadığımız
cross-source tanıma + dedup + converted-client problemini aynı anda çözer. Taslak
zaten yazıldı (`functions/clients/identity.ts`, şu an inert, kimse require etmiyor).

---

## 3b. Kanonik migration sırası (owner 07-08)
Faz 2-4'ün *içindeki* dosya sırası — düşük-riskten para'ya doğru. Frontend TS'i
Vite-native olduğu için (deploy riski yok) erken gelebilir; canlı para hareketi
oluşturan hiçbir modül **ilk dalgada** dokunulmaz:

```
Utilities → Types → Hooks → UI Components → Marketing → Clients →
Calendar → Reports → Admin → Functions → Notifications → Emails →
Stripe → Checkout → Payments
```

Yani: utils/tipler/hook'lar/pure-UI en önce (en ucuz, en güvenli) → feature
alanları → **Stripe / Checkout / Payments EN SON**, tek tek, parite + smoke ile.

## 4. Sıra gerekçesi (neden money en son)
`Discount Codes → Checkout → Finance → Marketing Attribution → Reports` hepsi aynı
alanları paylaşır — TS burada en çok yardım eder AMA en çok da hasar verir.
Bu zincir **aktif düzenleniyor** (Stripe Phase 5, discount engine) ve **para
taşıyor.** O yüzden: önce çevresini tiple (modeller + pure modüller sağlamlaşsın),
zincire en son ve tek tek dokun, her adımda parite + smoke.

---

## 5. Her migration PR'ının "Definition of Done" (owner 07-08)
Her PR şu 7 şartı geçmeden birleşmez:
- ✅ TypeScript compile ediyor (`tsc --noEmit` yeşil)
- ✅ ESLint temiz
- ✅ Vite build başarılı (`npm run build`)
- ✅ Firebase Functions build başarılı (functions tarafına dokunduysa)
- ✅ **Mevcut davranış değişmedi** (davranış-taşıyan dönüşümde parite testi)
- ✅ Production deploy gerektirmiyorsa **deploy YOK**
- ✅ ROADMAP / bu plan güncellendi (DoD ✅ işaretlendi)

## 5b. Faz X — Production Verification (owner+GPT 07-08)
"TypeScript compile oluyor" YETMEZ — canlı sistem, gerçek akışlar doğrulanmalı. Para
veya sık-yol taşıyan bir modül taşındıktan sonra (özellikle Faz 6 functions), şu
uçtan-uca akışlar elle/otomatik çalıştırılır:
- ✅ Vite build · ✅ Functions build · ✅ Firebase deploy smoke
- ✅ Stripe test ödeme · ✅ Walk-in checkout · ✅ Online booking
- ✅ Loyalty earn · ✅ Loyalty redeem
- ✅ Campaign send · ✅ Coupon redeem · ✅ Reports açılıyor

(bkz `/verify` skill mantığı — değişikliği gerçek app'te sür, sadece test/typecheck değil.)

## 5c. Rollback stratejisi (her faz için yazılı — owner+GPT 07-08)
Özellikle Stripe/Checkout/Payments'e gelince "geri dönüş" anında karar vermek zorunda
kalınmasın diye **önceden yazılı:**
- **Kod:** `git revert <commit>` → temiz working tree'ye dönüş.
- **Deploy:** önceki **git tag / release** (her money-faz deploy'undan önce tag at).
- **Functions artifact:** önceki deploy'a `firebase deploy --only functions:salown` ile
  revert edilmiş koddan geri yükle (blanket ASLA).
- **Doğrulama:** rollback sonrası §5b smoke checklist'i tekrar koş.
- **Kural:** money-modülü (stripe/checkout/bookings) deploy'undan ÖNCE release tag +
  rollback adımları PR'da yazılı olmadan birleşme yok.

## 6. Açık kararlar (owner)
1. ~~Toolchain~~ → **KARARLAŞTI (07-08): ara-adım (allowJs/checkJs) ile başla; tam
   `.ts` build Faz 3'te, toolchain denenip tipler oturunca.** (bkz §1)
2. ~~`shared/` konumu~~ → **KARARLAŞTI (07-08, revize aynı gün): seçenek (b) —
   `salown-app/packages/shared/src/` (workspace değil, type-only klasör; bkz §7).**
   Type-only kuralı + `shared-validation` ayrı zod paketi ilkesi (§2) aynen geçerli;
   §2'deki "monorepo workspace" anlatımı hedef mimariydi, (b) onun kök-gerektirmeyen hali.
3. **Tempo:** Faz 0+1 (sıfır-risk zemin) bu hafta; sonrası parity ile (deadline yok).
   İlk somut adımın onayı senin.

---

## 7. Faz 0 — kickoff notu (recon 2026-07-08, yeni oturuma devir)

**Recon bulguları (repo yapısı):**
- `alex/` bir **git repo DEĞİL** + kök `package.json` **YOK**.
- `salown-app` = **kendi başına git root**; `functions/` onun içinde (ayrı deploy birimi).
- Frontend: typescript kurulu **değil** (ama `@types/react`/`@types/react-dom` var); scripts'te `dev/build/lint/test(vitest)`.
- functions: typescript **yok**, CommonJS, `main: index.js`.

**✅ YAPISAL KARAR KARARLAŞTI (owner 2026-07-08): seçenek (b)** — `shared` `salown-app` içinde.
Elenen alternatifler: (a) `alex/`'i monorepo kökü yapmak (en temiz ama en çok yapısal dokunuş;
`alex/` git repo değil), (c) ayrı `salown-shared` repo (kurulum + senkron yükü).

**(b)'nin somut şekli:**
- Konum: **`salown-app/packages/shared/src/{booking,client,tenant,campaign,coupon,loyalty,invoice,payment}.ts`**
  — npm workspace DEĞİL, sadece type-only `.ts` dosyaları klasörü (kök package.json gerekmez).
- **Frontend çözümleme:** Vite/`tsc` göreli path (ileride istenirse tsconfig `paths` alias'ı `@salown/shared`).
- **Functions çözümleme:** Faz 0-2'de functions `.js`+JSDoc kaldığından tipler
  `/** @type {import('../packages/shared/src/booking').Booking} */` JSDoc type-import'u ile
  kullanılır — bu SADECE compile-time (`tsc --noEmit`); deploy artifact'ında yorumdan ibaret
  → runtime'a sıfır etki, `firebase deploy` functions-klasörü-dışı dosya yükleme sorunu YAŞAMAZ.
- ⚠️ Faz 3'te (functions `src→lib` build) bu path'ler yeniden ele alınır (rootDir/kopya kararı
  o zaman) — §2'deki type-only kuralı geçerli kaldıkça çözüm basit kalır.

### ✅ Faz 1 DoD — TAMAMLANDI (2026-07-08)
**"Önce tipler, sonra implementasyon"** dilimi indi: `salown-app/packages/shared/src/`
altında 8/8 model + domain dili, tamamı **type-only** (interface/type/union; runtime kod,
enum, firebase/stripe importu YOK), tamamı **İngilizce yorumlu** (Migration Rules'a eklenen
dil kuralı). Kod aynı kaldı — hiçbir dosya bu tipleri henüz import etmiyor (Faz 1 DoD'nin
tanımı gereği). Tipler "eski JS = spec" ile yazıldı: 5 paralel kod-envanteri (booking/client/
tenant/campaign+coupon/payment) tüm yazım sitelerini file:line kanıtıyla çıkardı; quirk'ler
(walk-in'de `date` yok, `barberId` ad-vs-id, parser `price` "£25.00" string, üç ayrı
paymentType sözlüğü, `paymentType:'CONFIRMED'` sentinel'i...) tiplerde belgelendi.

Dosyalar: `booking client tenant campaign coupon loyalty invoice payment` + `firestore`
(TimestampLike/DateLike/MoneyValue stand-in'leri) + `index` barrel. Domain dili:
`BookingStatus` (7), `BookingSource` (7+`'block'`), `BookingPaymentType` (6, UPPERCASE),
`PaymentMethod`, `PaymentState`, `StripePaymentMode` (5, lowercase), `AggregatorPaymentType`,
`CouponType` (`'percent'|'amount'`), `CampaignType`, `EmailEventType` (Brevo, açık-uçlu),
`TenantRole` (`owner|admin|staff`), `PlanKey`, `TenantFeatureKey`, `EmailOptOutReason`.

**Envanterin plan varsayımlarını DÜZELTTİĞİ yerler (spec > plan):**
- **Invoice kodda YOK** — koleksiyon/numara/PDF yok; tek artefakt ReceiptPanel (persist
  edilmeyen booking projeksiyonu). `invoice.ts` REZERVE taslak olarak yazıldı, açıkça işaretli.
- **CampaignStatus persist edilmiyor** (scheduling kapalı; her campaignRun = gönderilmiş) —
  enum uydurulmadı. `campaigns` koleksiyonu şablon kütüphanesi, gönderim logu `campaignRuns`.
- **LoyaltyReason enum'u yok** — adjustment `reason` serbest metin, earn/redeem `points`
  işaretinden; auditLogs `manual_points_adjustment` şekli tiplendi.
- **PaymentType üç ayrı sözlük** (booking UPPERCASE / Stripe policy lowercase / aggregator
  config) — bilinçli olarak üç ayrı union; tarihî `'deposit'≠'DEPOSIT'` bug'ının sınırı.

Doğrulama: `tsc --noEmit` yeşil (frontend `include: ["src","packages"]` + functions) ·
`npm run build` değişmeden yeşil (hosting çıktısı DEĞİŞMEDİ) · `migration:stats` **8/8**
shared, diğer sayılar baseline'da sabit (104 js/jsx, 5 fn js, index.js 5759, any 0,
@ts-ignore 0) · deploy YOK · davranış bit-bit aynı. Sıradaki: **Faz 2** — ilk gerçek modül
`clients/identity` (`.js`+JSDoc, parite testi + temiz-pencere deploy ile).

### ✅ Faz 2 (ilk dalga: identity + utils) — CANLI (2026-07-09 sabah, owner "go" ile)
**Taşı ✅ tiple ✅ parite ✅ deploy ✅ smoke ✅.** İki ayrı deploy (`--only functions:salown`):
1. **identity wiring** (`cedc677`): index.js `./clients/identity`'yi require ediyor; inline
   `_resolveClientDocId`/`_redemptionKey` silindi, 4 çağrı noktası modüle döndü.
2. **utils wiring** (`aab2e73`): `./utils/{emailText,parserTime,campaignMerge}` require;
   16 inline helper silindi. **index.js 5759 → 5582 satır (−177).**

Doğrulama: parite suite bağlama sonrası 6 pass / 6 self-skip (tasarlandığı gibi) · tsc +
require-smoke yeşil · 57 fn ACTIVE · iCal feed deploy öncesi/sonrası birebir (whitecross
137, herohairs 2 VEVENT) · salownInboundEmail gate'i yanlış key'e 401 · loglarda çökme yok.

**Deploy'un ortaya çıkardığı bagaj (migration-dışı, çözüldü):** `salownInboundEmail`
index.js'e eklenmiş ama HİÇ deploy edilmemişti; istediği `INBOUND_WEBHOOK_SECRET`
Secret Manager'da yoktu → full-codebase deploy pre-flight'ta durdu. Owner onayıyla
rastgele güçlü secret oluşturuldu (`functions:secrets:set`, boş secret = gate AÇIK
olurdu) ve fonksiyon İLK KEZ canlıya çıktı (staging-only davranış, secret'la kilitli).

**Faz 3 dilim-1 de CANLI:** 15 `src/utils` dosyası → TypeScript (`9bd50df` rename +
`b2da067` anotasyon; bundle bayt-aynı kanıtlı → hosting no-op). KPI: frontend 89 js/jsx +
15 ts · functions 11 js (index.js 5582) · shared 8/8. Kalan Faz 2 sırası: parsers →
notifications → marketing → (EN SON) checkout/stripe/bookings.

### ✅ Faz 2 TAMAMLANDI — functions split bitti, TÜM dalgalar CANLI (2026-07-08 öğleden sonra)
Aynı gün 5 dalga daha, her biri ayrı test + owner-onaylı deploy (`--only functions:salown`):
| Dalga | Commit | Modüller | index.js |
|---|---|---|---|
| parsers | `c8196ac` | parsers/{shared,booksy,fresha,treatwell,ical} | 5582→4395 |
| notifications | `37f1bcd` | notifications/ (Telegram+in-app+FCM) | →4250 |
| emails | `1eb1e45` | emails/ (transporter/Brevo/confirmation/reschedule) | →4001 |
| marketing | `764e074` | marketing/ (campaign render+sender routing) | →3950 |
| misc | `a74de84` | utils/ical + tenants/ + bookings/shared + inbound/ | →3719 |
| **money (SON)** | `fde49bd` + tag `pre-money-modules-20260708` | checkout/ + finance/exit | **→3597** |

**Yöntem (tüm dalgalar):** script'li BAYT-VERBATIM taşıma → test katmanı 1: git HEAD'e karşı
bayt-eşitlik (wiring sonrası self-skip) → katman 2: fake IMAP/Firestore ile davranış pinleri
→ tsc + require → deploy → smoke. Suite toplamı **47 test: 36 pass / 0 fail / 11 self-skip**.
Öne çıkan pinler: inbound ADR-015 izolasyonu (body'deki token ASLA yönlendirmez; bilinmeyen
token karantina) · checkout paymentMode matrisi (off/pay_at_venue reddi, optional seçimi,
deposit→full fallback, deposit≤indirimli-full cap, over-discount THROW = bedava checkout
Stripe'a ulaşamaz) · EXIT_TERMS rakamları pinli (sessiz drift imkânsız).

**Smoke:** her deploy sonrası iCal feed birebir + parser cron sağlıklı (13:02 koşusu yeni
parser modülleriyle doğrulandı) · inbound gate 401 · **money smoke:** whitecross'a geçici
görünmez PENDING doc ile canlı `salownCreateCheckoutSession` çağrısı → yeni checkout
modülünün kendi hatası ("Online payment is not enabled") prod'da döndü = taşınan para kodu
canlıda yürüyor; artefakt silindi. Pozitif-yol tam ödeme smoke'u: Stripe TEST modda; whitecross
paymentMode=pay_at_venue olduğundan gerçek session ancak mod geçici açılırsa/demo Connect'e
bağlanırsa atılabilir — owner ile ayrıca (matris zaten tüm dalları pinliyor).

**tsc'nin taşımada yakaladıkları** (migration'ın varlık sebebi): INBOUND_TOKEN_RE,
extractSubjectFromRaw, isUkDst — üç eksik bağımlılık compile-time'da yakalandı.

**index.js kalan içerik (~3597):** 52 export (trigger/callable orchestrator'ları) + Stripe
Connect fonksiyonları + AI (askAI). Bunların modüllere inmesi Faz 3'ün functions build'iyle
(src→lib) birlikte ele alınacak. **Kalan büyük iş:** Faz 3 frontend (89 js/jsx), Faz 3
functions build, Faz 4 strict.

### 🗄️ Arşiv — gece hazırlık notu (2026-07-08→09)
**Taşı + tiple + parite testi ✅ · temiz-pencere deploy ⏳ (owner kararı: sabah birlikte).**
- **`functions/clients/identity.js`** (INERT, `91eb3d5`): `_resolveClientDocId` (:3818) +
  `_redemptionKey` (:4811) verbatim; `@ts-check`+JSDoc→shared tipler. Quirk'ler bilinçli
  korundu (loose telefon normalizasyonu ülke-prefix'i KATLAMAZ; email match trim'siz;
  yalnız-telefon probe null döner). Parite: node:test, eski impl index.js kaynağından test
  anında dilimlenip eval edilir → old===new, fixture + seeded sweep, 6/6. Server
  `_redemptionKey` === frontend `discountCodes.js redemptionKey` aynası da kanıtlandı.
- **`functions/utils/{emailText,parserTime,campaignMerge}.js`** (INERT, `6de0bf9`):
  parser/campaign plumbing 16 helper verbatim (QP/RFC2047/multipart decode, UK-DST tarih
  matematiği, parseTwTime, merge fields). Parite 6/6 — bozuk tarih girdisinde THROW
  paritesi dahil (eski kod da fırlatıyor). Testler wiring sonrası kendini skip eder
  (karakterizasyon pinleri kalıcı bekçi).
- **ESLint type-only guard ✅** (§2 DoD maddesi, `6de0bf9`): `typescript-eslint` +
  `packages/shared` scope'lu `consistent-type-imports` + firebase/stripe/zod import BAN'ı.
- **Bağlama (wiring) hazır, UYGULANMADI:** index.js diff'i scratchpad'de
  (`phase2/identity-wiring.patch` 92 satır + `identity-plus-utils-wiring.patch` 326 satır,
  kümülatif). Sandbox provası: patch'li index.js `node --check` + `require()` OK; test
  takımı wiring-sonrası 6 pass / 6 self-skip. Deploy planı (owner onaylı, sabah):
  1) identity wire → hedefli `functions:salown` deploy → smoke (etki: sendMarketingEmail,
  salownSetEmailConsent), 2) utils wire → deploy → sonraki parser koşusunu izle (etki:
  salownParseEmails + iCal + campaign yolları). Rollback: git revert + redeploy.

**Faz 0'ın YAPISAL-KARAR GEREKTİRMEYEN güvenli kısmı (bunu yap):**
1. `salown-app/tsconfig.json` (frontend): `allowJs, checkJs:false, noEmit, strict:false, jsx:"react-jsx"` — Vite build'i ETKİLEMEZ (Vite esbuild kullanır); bu config sadece `tsc --noEmit` tip-kontrolü + editör için.
2. `salown-app/functions/tsconfig.json`: `allowJs, checkJs:false, noEmit, strict:false`.
3. `typescript` devDep (frontend + functions) + `"typecheck": "tsc --noEmit"` script.
4. **`npm run migration:stats`** — küçük read-only dev script (`scripts/migration-stats.mjs`):
   JS/JSX + TS/TSX dosya sayısı, functions TS %, shared models N/8, `any` + `@ts-ignore`
   grep sayısı, tarih → konsola basar. KPI tablosunu (§KPI) **elle değil bu** besler.
   Prod'a dokunmaz, deploy'a girmez (sadece geliştirici aracı).
5. **Doğrula:** `tsc --noEmit` yeşil (henüz .ts yok → kontrol edilecek şey yok, trivially geçer) · `npm run build` (Vite) değişmeden yeşil · deploy YOK · hiçbir davranış değişmedi.
> Bu adım pipeline'ı DEĞİŞTİRMEZ, prod kodu TAŞIMAZ, deploy GEREKTİRMEZ. `packages/shared`
> standup'ı yukarıdaki (a/b/c) kararına kadar bekler (Milestone C).

### ✅ Faz 0 DoD — TAMAMLANDI (2026-07-08)
Yapılan (salown-app, tek commit):
- ✅ `tsconfig.json` (frontend): allowJs / checkJs:false / noEmit / strict:false / jsx:react-jsx — Vite build'e dokunmaz
- ✅ `functions/tsconfig.json`: allowJs / checkJs:false / noEmit / strict:false / module+moduleResolution:`nodenext` (TS6 `moduleResolution:node`'u deprecate etti; package.json'da `type` yok → .js dosyaları CJS çözülür, runtime ile birebir)
- ✅ `typescript` devDep (frontend + functions) + iki tarafta `npm run typecheck`
- ✅ `scripts/migration-stats.mjs` + `npm run migration:stats` (read-only KPI sayacı)

Doğrulama sonuçları:
- ✅ `tsc --noEmit` yeşil (frontend + functions; henüz .ts yok → trivially geçer)
- ✅ `npm run build` (Vite) değişmeden yeşil — hosting bundle çıktısı DEĞİŞMEDİ
- ✅ `migration:stats` baseline'ı birebir doğruladı: frontend **104** js/jsx / **0** ts, functions **5** js (index.js **5759** satır) / **0%** TS, shared **0/8**, `any` **0**, `@ts-ignore` **0**
- ✅ Deploy YOK · `main: index.js` aynen · hiçbir prod dosyası taşınmadı · davranış bit-bit aynı

Not: `packages/shared` bilinçli olarak KURULMADI (yapısal a/b/c kararı → Milestone C). Sıradaki adım: **Faz 1** (shared model tipleri) — ~~önce a/b/c kararı~~ → karar verildi: **(b)**, aşağıda.

---

---

## 9. Release Candidate disiplini (teknik-lider tavsiyesi, 2026-07-08 — KABUL)
Bundan sonra ilerleme commit'le değil RELEASE ile anlatılır. Duraklar:

| Tag | Kapı | Durum |
|---|---|---|
| `v0.9.0-rc1` | Faz 2 tamam (functions split, 6 dalga canlı) | ✅ 2026-07-08 |
| `v0.9.0-rc2` | Frontend TS ≥ %50 | ⏳ |
| `v0.9.0-rc3` | Functions TS build (`src→lib`, `main` değişimi) | ⏳ |
| `v1.0.0` | `strict: true` + `any`=0 + ARCHITECTURE_V2.md | ⏳ |

**Her RC'nin DEĞİŞMEZ checklist'i** (annotated tag mesajına yazılır):
- ✅ Type coverage (TYPE_COVERAGE.md güncel, panodan sayılar)
- ✅ Test sayısı (functions npm test + vitest, 0 fail)
- ✅ Production smoke (§5b — o fazın etkilediği yollar canlıda doğrulanmış)
- ✅ Rollback doğrulanmış (önceki tag'den dönüş yolu yazılı + denenebilir)
- ✅ Dokümantasyon güncel (bu plan + TESTS.md + edit log)

## 8. Migration-sonrası teslimat: `docs/ARCHITECTURE_V2.md` (teknik-lider tavsiyesi, 2026-07-08)
Migration bittiğinde (Faz 4 sonrası) bu doküman YAZILACAK — "sistem bugün nasıl çalışıyor"
sorusunun cevabı. İçerik: repository yapısı · packages/shared neden var (type-only kuralı)
· functions build zinciri (src→lib) · frontend-functions tip paylaşımı · deployment akışı
(CI hosting + hedefli functions) · domain boundary'leri (modül haritası) · alınan kararların
gerekçeleri (DECISIONS.md'ye pointer'larla). Bu plan migration'ın belgesi; V2 mimarinin belgesi.
Ayrıca test sınıflandırması TESTS.md'ye işlendi (parity/pin/money/integration/cross-mirror/smoke)
ve tüm bilinçli `any`'ler `TODO(ts-migration)` etiketli (grep'lenebilir).

*Bu plan yaşayan bir belge — her faz bitince DoD'yi ✅ işaretle, sapma olursa
"planda yok, ekleyelim" diyerek bilinçli ekle (ROADMAP disiplini).*
