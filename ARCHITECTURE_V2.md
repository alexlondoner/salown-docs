# ARCHITECTURE V2 — TypeScript-sonrası mimari (v1.0.0, 2026-07-13)

> TYPESCRIPT_MIGRATION_PLAN'ın vaadi olan kapanış dokümanı. V1 mimarisi =
> migration öncesi durum (SYSTEM_ARCHITECTURE.md hâlâ repo/servis haritası
> olarak geçerli — bu doküman onu İKAME ETMEZ, dil/derleme/kanıt katmanını anlatır).

## 1. Dil durumu

| Katman | Durum | Kaynak |
|---|---|---|
| Frontend (panel + staff + booking) | **104/104 dosya .ts/.tsx** (2026-07-11) | `salown-app/src/` |
| Functions (52 export) | **22/22 runtime dosyası .ts** (2026-07-13) | `salown-app/functions/src/` |
| Bilinçli .js kalanlar | `functions/src/_demoEmails.js` + `_previewEmails.js` (dev-only preview script'leri) | — |
| Shared tipler | `packages/shared/src/` (type-only, 10 dosya) | frontend+functions ortak |

**strict: TRUE her iki katmanda** (functions 2026-07-13 sabah, frontend aynı gün).
`any` politikası: strict-temizlik sırasında bilinçli `any` serbest bırakıldı
(veri Firestore doc-bag'i olduğunda dürüst tip budur); daraltma isteyen yerler
`TODO(ts-strict)` / `TODO(ts-migration)` işaretli — iyileştirme fırsatçı, toplu değil.

## 2. Build & çalışma zamanı

- **Frontend:** Vite (esbuild transpile — tip anotasyonları codegen'den önce
  silinir; bu yüzden type-only değişikliklerde bundle BAYT-AYNI kalır = kanıt
  yöntemimizin temeli). İki bundle: ana (`npm run build`) + staff
  (`npm run build:staff`, `vite.staff.config.js`). CI (GitHub Actions) main'e
  push'ta ikisini de kaynaktan build edip hosting'e basar.
- **Functions:** `tsconfig.build.json` = SALT-EMIT (`noCheck`+`noResolve`;
  tip denetimi build'i asla kırmaz) → `src/ → lib/`, runtime `main: lib/index.js`.
  Tip denetimi ayrı kapıda: `npm run typecheck` (`tsconfig.json`, strict).
  `firebase.json` functions predeploy hook'u build'i garantiler. Testler
  `lib/`'i (shipped artifact) require eder; `pretest` build koşar.
- **Deploy:** functions HEP codebase-prefix'li targeted (`--only
  functions:salown:X,...`); blanket YASAK (us-central1'de 27 legacy fn +
  `npm run deploy` script'i kilitli). Sıra: functions → hosting → rules EN SON.

## 3. Kanıt kültürü (migration'ın kalıcı mirası)

1. **Bayt-kanıt (frontend):** değişiklik sonrası iki build (ana+staff) HEAD
   worktree build'iyle `diff -r` — type-only iş bayt-aynı çıkmak zorunda.
   Yöntem detayı: MIGRATION_PATTERNS.md "bayt-kanıt v2".
2. **lib-diff (functions):** dosya çevirisi/tip işi sonrası `lib/` çıktısında
   yalnız hedef dosya değişebilir; tek kabul edilen gürültü tsc printer'ının
   ok-parametre parantezi. Export yüzeyi `Object.keys(require(...))` ile birebir
   doğrulanır (`__esModule` non-enumerable — sayımı bozmaz, Firebase'in
   fonksiyon keşfini de etkilemez).
3. **Karakterizasyon/parite testleri:** `functions/src/**/*.test.js` (node --test,
   47 test) — eski inline davranış spec kabul edilir; kaynak-metin çapaları
   `src/index.ts` + `HEAD:functions/src/index.ts`.
4. **Hayalet-booking smoke:** canlıda iz bırakmayan uçtan uca tetik kanıtı
   (2020 tarihli + testMode + plus-alias; scratchpad `rc3-ghost-smoke.cjs` deseni).
5. **Canlı gözlem:** deploy sonrası Cloud Logging'den scheduled koşu taraması
   (firebase CLI OAuth ile `entries:list` — CLI'ın kendi `functions:log`'u
   günler geride kalabiliyor, güvenme).

## 4. TS yazım sözleşmeleri (functions)

- Modüller **named export** kullanır (`export function` / `export { _x as x }`)
  — `module.exports`/`export =` @ts-check'li tüketicilerle çatışıyor (TS2459/2497).
- CJS değer import'u: `const { X } = require('...')`; tip gerekiyorsa yanına
  `import type { X as XT } from '...'`. **ESM `import`'a geçilmez** — emit değişir.
- Firestore doc verisi `any`/`Rec` ile taşınır; alan sözleşmeleri
  FIRESTORE_SCHEMA.md + packages/shared'dedir, TS tipi değil dokümantasyon
  bağlayıcıdır (index tabanlı sorgular/dinamik alanlar yüzünden).
- Yeni fonksiyon = `export const adi = onCall/onRequest/...` (`src/index.ts`);
  I2 split (modüllere dağıtma) hâlâ açık iş, ayrı karar.

## 5. Sürüm çizgisi

- `v0.9.0-rc1/rc2` — Faz 0-2 (toolchain, shared, modül extraction)
- `v0.9.0-rc3` — runtime flip: src→lib pipeline (2026-07-12; RC3_RUNBOOK)
- **`v1.0.0`** — codebase uçtan uca TS + strict her yerde (2026-07-13; V1_RUNBOOK)
- Sonrası: TYPE_COVERAGE panosu CI'da yaşamaya devam eder; `any` daraltma +
  I2 index split fırsatçı işler.
