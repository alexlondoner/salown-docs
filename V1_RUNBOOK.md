# V1 RUNBOOK — Migration Kapanış Sprinti (başlangıç: 2026-07-13)

> Owner kararı (2026-07-12 gece): "12'den sonra her şeyi bitiriyoruz."
> Ürün-doğrulama 12'sinde BİR GÜN ERKEN geçti (uçtan uca temiz, "salon fark
> etti mi?" → HAYIR) → takvim öne çekildi. Bu runbook 12'si gecesi hazırlandı;
> tüm sayılar canlı repo'dan doğrulandı. Durum SSOT: ROADMAP. Yöntem anayasası:
> TYPESCRIPT_MIGRATION_PLAN + MIGRATION_PATTERNS (22 kalıp) + RC3_RUNBOOK sonuç bloğu.

---

## FAZ A — Kapanış vidaları (yarım gün, önce bu)

1. **Push + tag** (owner GO ile): working tree fotoğrafı → `73ce8f8` (rc3
   pipeline) main'e push + `v0.9.0-rc3` tag push. Staff-bundle endişesi
   ÇÖZÜLDÜ: CI predeploy iki bundle'ı da kaynaktan yeniden build ediyor
   (firebase.json:6,63) → push staff'ı regress EDEMEZ. Working tree'deki
   staff-bundle artifact kirini (D CyIL0mgg.js / ?? sBQBfyg0.js / M index.html)
   O session commit'lemeli ya da owner "at gitsin" demeli — bizim commit'lerimiz
   explicit-path, dokunmuyoruz.
2. **Testleri src'a taşı:** `*.test.js` 8 dosya şu an KÖK kopyaların yanında
   ve onları import ediyor — kök silinince kırılırlar. `git mv` ile
   `src/<modül>/` altına (relative import'lar aynen çalışır; build zaten
   `**/*.test.js` exclude ediyor) + package.json test glob'u `src/...`'a çevir
   → `npm test` yeşil (35 pass).
3. **Kök kopya temizliği (rc3'ün ertelenen commit'i):** kökteki 22 runtime
   `.js` + `test-parser.js` + `_preview/` kararı → sil (runtime zaten
   `lib/`'den; kök dosyaları HİÇBİR ŞEY kullanmıyor). Ardından kanıt üçlüsü:
   `npm run build` + export-parity 52/52 + `npm test`. Tek commit:
   `chore(rc3): remove root .js originals — src/ is the single source`.
4. **Hosting kapanışı (bağımsız, kod değil):** www → Firebase (console +
   GoDaddy CNAME) → GH Pages custom domain kaldır → **repo private** →
   DEPLOY.md + project_whitecross memory güncelle (site deploy artık
   `firebase deploy --config firebase.saas.json --only hosting`; GitHub push
   siteyi ARTIK GÜNCELLEMEZ).

## FAZ B — Functions `.js → .ts` (asıl iş; dalga dalga, her dosya kanıtlı)

**Kanıt yöntemi (bayt-kanıt v2'nin backend karşılığı — "lib-diff"):**
tsc emit'i deterministik printer olduğu için lib çıktısı stabil. Dosya başına:
```
cp -R lib <scratchpad>/lib-base
git mv src/X.js src/X.ts && <salt type anotasyonu, davranış SIFIR>
npx tsc --noEmit                 # 0 hata (editor config, .ts'i tam denetler)
npm run build && diff -r <scratchpad>/lib-base lib   # SADECE X.js farkı beklenir
node -e "<52-export-parity>"     # index'e dokunan dalgalarda
npm test                         # yeşil
git commit (explicit path, refactor(ts): ... )
```
- `diff`'te X.js DIŞINDA fark çıkarsa → Kalıp 20 şüphesi (import-elision) → DUR, teşhis et.
- **Import stili:** CJS emit'i bayt-stabil tutmak için `import x = require('y')`
  (TS-CJS sözdizimi, `const x = require('y')` olarak emit eder) ya da mevcut
  `const {a} = require('y')` AYNEN kalır. ESM `import`'a GEÇME — emit değişir.
- `strict` hâlâ OFF (Faz C'de açılır) — anotasyon minimal, `Rec`/`any` serbest
  (frontend kalıpları geçerli), davranış commit'i YASAK (§11).

**Dalga sırası (küçük→büyük, para EN SON; satır sayıları 2026-07-12):**
| Dalga | Dosyalar | Not |
|---|---|---|
| B1 — utils (testli, pure) | utils/ical 24 · bookings/shared 33 · utils/campaignMerge 51 · utils/parserTime 85 · utils/emailText 169 | Isınma; parity testleri zaten pinli |
| B2 — parsers (testli) | parsers/shared 86 · ical 223 · booksy 288 · treatwell 302 · fresha 368 | Salown'un en hassas alanı (memory parser-priority) — dalga sonrası 1 gece gözlem |
| B3 — domain | marketing 70 · finance/exit 87 · tenants 95 · clients/identity 127 (JSDoc→gerçek tip) · inbound 129 · notifications 171 · emails 279 | identity'de @ts-check/typedef kalkar, shared'den import type gelir |
| B4 — para | checkout/index 79 | Küçük ama para — TEK BAŞINA, deploy sonrası hayalet-smoke (rc3-ghost-smoke.cjs deseni) |
| B5 — şablonlar | emailTemplates 618 | Pure string builder; preview script'leri (_demo/_preview) .js kalabilir (allowJs, dev-only) |
| B6 — FİNAL BOSS | **index.js 3619 / 52 export** | Aşağıya bak |
- Dalga sonu = targeted deploy (o dalganın fonksiyonları, `functions:salown:X,...`)
  + smoke; ASLA blanket. Para dalgasından önce gece gözlemi.

**B6 karar noktası (owner'a sorulacak):** index.ts'e **yerinde çeviri** (önerilen:
tek değişken ilkesi — split ayrı iş olarak I2'de kalır, v1.0.0'ı bloklamaz) vs
**split+çeviri birlikte** (I2'yi de bitirir ama iki büyük değişken aynı anda —
rc3'te reddettiğimiz A stratejisinin aynısı, önerilmez). Yerinde çeviri 2-3
oturum sürebilir; her oturum lib-diff'li ara commit.

## FAZ C — v1.0.0 kapanışı

1. `strict: true` (functions tsconfig + build config'e `noCheck` kalkar mı → HAYIR,
   build salt-emit kalır; strict yalnız typecheck config'de) + frontend tsconfig.
   Fallout dosya dosya sıfırlanır (bayt/lib-diff kanıtı devam).
2. **Birikmiş temizlik listesi** (project_ts_migration memory'deki envanter:
   ölü import/state/prop'lar) — TEK chore commit, ilk kez davranış değişikliği
   serbest (artık type-only kuralı bitti), yine de vitest+build+smoke.
3. `any` avı: `TODO(ts-migration)` işaretli bilinçli any'ler kapatılır (hedef 0;
   kalan varsa gerekçeli inline yorum).
4. Tag **v1.0.0** + `docs/ARCHITECTURE_V2.md` + TYPE_COVERAGE son pano +
   ROADMAP/memory kapanış güncellemeleri.

## Riskler / kurallar (değişmedi)
- Deploy = önce tenant+URL duyur; functions HEP codebase-prefix'li targeted.
- Para dosyasına dokunulan gün başka yüksek-risk iş YOK (firebreak ruhu).
- 14'ünde feature-freeze kalkıyor → başka session'lar feature işine dönebilir;
  bu sprint sürerken **functions/ dizini bu session'ın** (çakışma önleme),
  frontend'e dokunmuyoruz (temizlik commit'i hariç, o da koordineli).
- Rollback her aşamada ucuz: dosya bazında `git revert` + targeted redeploy
  (rc3 provası: ~90 sn).
