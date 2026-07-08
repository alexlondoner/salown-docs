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
| **B** | 🛠 Toolchain | `tsconfig` (allowJs/checkJs:false/noEmit/strict:false), pipeline değişmez |
| **C** | 📦 Shared types | `packages/shared` modeller + domain dili |
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
| **1** | **Önce tipler, sonra implementasyon** (owner 07-08): ilk hafta hedefi = `Booking`, `Client`, `Tenant`, `Campaign`, `Coupon`, `Loyalty`, `Invoice`, `Payment` (`PaymentType='DEPOSIT'\|'FULL'`) + `BookingStatus`, `BookingSource` interface'leri. **Kod aynı kalır** — sadece tip tanımı. Bu bile yüzlerce hatayı önlemeye başlar. | **Sıfır** | Modeller derlenir; henüz kimse import etmese de tip-doğru |
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
2. ~~`shared/` konumu~~ → **KARARLAŞTI (07-08): monorepo `packages/shared` workspace,
   type-only + `shared-validation` ayrı zod paketi.** (bkz §2)
3. **Tempo:** Faz 0+1 (sıfır-risk zemin) bu hafta; sonrası parity ile (deadline yok).
   İlk somut adımın onayı senin.

---

## 7. Faz 0 — kickoff notu (recon 2026-07-08, yeni oturuma devir)

**Recon bulguları (repo yapısı):**
- `alex/` bir **git repo DEĞİL** + kök `package.json` **YOK**.
- `salown-app` = **kendi başına git root**; `functions/` onun içinde (ayrı deploy birimi).
- Frontend: typescript kurulu **değil** (ama `@types/react`/`@types/react-dom` var); scripts'te `dev/build/lint/test(vitest)`.
- functions: typescript **yok**, CommonJS, `main: index.js`.

**⚠️ AÇIK YAPISAL KARAR (packages/shared'dan ÖNCE):** monorepo `packages/shared`'ın
doğal bir evi yok (kök yok). Seçenekler:
- **(a)** `alex/`'i monorepo kökü yap (kök `package.json` + npm workspaces + `git init`) — en temiz ama en çok yapısal dokunuş.
- **(b)** `shared/`'ı `salown-app` içine koy; functions'a path/kopya ile ver — daha az yapısal, ama functions-tarafı çözümleme yine düşünülmeli.
- **(c)** ayrı bir `salown-shared` repo/paket — bağımsız ama kurulum yükü.
→ Bu karar **Milestone C'ye (shared types) ait**; Faz 0'ı bloklamamalı.

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

---

*Bu plan yaşayan bir belge — her faz bitince DoD'yi ✅ işaretle, sapma olursa
"planda yok, ekleyelim" diyerek bilinçli ekle (ROADMAP disiplini).*
