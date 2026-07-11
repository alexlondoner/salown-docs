# RC3 Runbook — Functions `src → lib` Build Günü (hedef: 2026-07-12)

> **BAĞLAYICI:** rc3 = bütün migration'da runtime modelini değiştiren TEK adım
> (TYPESCRIPT_MIGRATION_PLAN.md §9). O gün BAŞKA HİÇBİR büyük iş yapılmaz.
> Günün dört hedefi: **pipeline değişti · deploy başarılı · smoke geçti ·
> rollback doğrulandı** — ve gün biter. Ertesi gün (2026-07-13) = rc3+1
> ürün-doğrulama günü (kod yok, ürün kullanılır).

Hazırlayan: Claude (2026-07-11 akşamı, TimeGrid slice 6 sonrası). Bu runbook
keşif maliyetini sabaha bırakmamak için yazıldı; tüm sayılar o akşam canlı
repo'dan doğrulandı.

---

## 0. Mevcut durum fotoğrafı (2026-07-11 doğrulandı)

| Gerçek | Değer |
|---|---|
| Runtime | CommonJS, `main: index.js` (3619 satır, **52 export**) |
| Modüller | 11 klasör / 26 `.js` dosya (bookings, checkout, clients, emails, finance, inbound, marketing, notifications, parsers, tenants, utils) |
| Testler | **8 `.test.js`** — `npm test` = `node --test` (clients/utils/parsers/notifications/emails/marketing/inbound/checkout) |
| tsconfig | Faz-0 modu: `allowJs`, `checkJs:false`, `noEmit`, `strict:false`, `nodenext` |
| Node | `engines.node = 22` |
| firebase.json | functions source `functions`, codebase **`salown`**, predeploy hook YOK |
| Shared tipler | `salown-app/packages/shared/src/` 10 dosya (8 model + firestore + index), type-only |
| JSDoc shared import'ları | compile-time only (`checkJs:false`) — path kayması runtime'ı ETKİLEMEZ |
| ⚠️ package.json `deploy` script'i | `firebase deploy --only functions` = **BLANKET — ASLA KULLANMA** (feedback_functions_deploy_gotcha: us-central1'de 27 orphan siler) |

## 1. Strateji kararı (sabah owner onayı — öneri: B)

- **A) Big-bang `.ts`:** 27 dosyayı aynı gün `.ts`'e çevir + pipeline değiştir.
  ❌ İki büyük değişken aynı günde — evidence-driven ilkeye aykırı; regresyon
  çıkarsa pipeline mi çeviri mi ayırt edilemez (firebreak dersinin tersi).
- **B) Pipeline-first (ÖNERİLEN):** Bugün SADECE pipeline değişir. `.js`
  dosyaları **kopyalanarak** `src/` altına alınır (orijinaller kökte AYNEN
  kalır → anında rollback), tsc `allowJs` ile `src → lib` emit eder,
  `main: lib/index.js` olur. Kod içeriği bugün HİÇ değişmez. `.js → .ts`
  çevirisi rc3 SONRASI, dosya-dosya, lib-çıktı-diff kanıtıyla ayrı dilimler.
  Plan §9'un rc3 tanımı ("pipeline değişti · deploy · smoke · rollback")
  birebir bu kapsam. Orijinal kök kopyalar 13'ü ürün-doğrulama TEMİZ geçince
  ayrı bir cleanup commit'iyle silinir.

## 2. Sabah ön-uçuş (değişiklik YOKKEN)

```bash
cd salown-app && git status && git log origin/main..HEAD   # temiz olmalı
cd functions && npm test          # 8 dosya yeşil (baseline)
npx tsc --noEmit                  # 0 hata (baseline)
```

## 3. Build kurulumu (tek commit)

1. `functions/src/` oluştur; `index.js` + 11 modül klasörü + `emailTemplates.js`
   + `_demoEmails.js` + `_previewEmails.js` **kopyala** (git cp yok → `cp -R`,
   orijinaller yerinde). `_preview/` ve `test-parser.js` dev-only → src dışı.
   `*.test.js` dosyaları src'a KOPYALANMAZ (testler kök kopyada koşmaya devam eder).
2. `tsconfig.build.json` (yeni): `allowJs:true, checkJs:false, outDir:"lib",
   rootDir:"src", module:"nodenext", target:"ES2022", noEmit KAPALI`,
   include `src`, exclude testler. (Mevcut tsconfig.json = editor/typecheck
   olarak kalır, dokunma.)
3. `package.json`: `"main": "lib/index.js"` + `"build": "tsc -p tsconfig.build.json"`.
4. `firebase.json` functions bloğuna predeploy:
   `"predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]`.
5. `.gitignore`'a `functions/lib/` ekle.

## 4. Parite kanıtı (deploy'dan ÖNCE, lokal)

```bash
cd functions && npm run build
node -e "const a=Object.keys(require('./index.js')).sort();
         const b=Object.keys(require('./lib/index.js')).sort();
         if(JSON.stringify(a)!==JSON.stringify(b)){console.error('EXPORT DIFF',a.filter(x=>!b.includes(x)),b.filter(x=>!a.includes(x)));process.exit(1)}
         console.log('EXPORT-PARITY OK:',a.length)"   # 52 beklenir
npm test                                              # hâlâ yeşil
```
⚠️ `require('./lib/index.js')` firebase-admin'i initialize etmeye çalışır —
sorun değil (idempotent); patlarsa emulator ile doğrula:
`firebase emulators:start --only functions` → 52 fonksiyon listelenmeli.

## 5. Deploy (kanarya → gruplu; ASLA blanket)

1. **Kanarya (1 fonksiyon, düşük risk):**
   `firebase deploy --only functions:salown:salownCleanupExpiredPending --project havuz-44f70`
   → log temiz + scheduled çalışması OK.
2. **Kalanlar gruplu** (5-8'li `functions:salown:X,functions:salown:Y,...`
   listeleriyle sıralı; parsers+emails → notifications → bookings/checkout →
   money/stripe EN SON).
3. **CLI herhangi bir fonksiyon SİLMEYİ önerirse → ABORT** (export parity
   bozulmuş demektir; hiçbir delete onaylanmaz).

## 6. Smoke (canlı)

- `salownBrevoWebhook` POST 200 (curl, boş event → `ignored` cevabı yeter)
- Booking sayfası: `/book/whitecross` slot yükleniyor (salownGetBusySlots)
- Gerçek akış: 1 test booking → confirmation email + Telegram düştü mü
- Para yolu: hayalet-booking tekniği (2020 tarihli, görünmez; 07-08'de kanıtlı)
- Frontend smoke: salown.com / login / staff 200 (functions dokunmadı ama ritüel)

## 7. Rollback provası (BAĞLAYICI — gün bitmeden)

`main`'i `index.js`'e geri çevir → kanarya fonksiyonunu redeploy → eski
pipeline'dan çalıştığını doğrula → tekrar `lib/index.js`'e al + redeploy.
Süreyi not et (gerçek olayda beklenen MTTR). Orijinal kök `.js`'ler yerinde
olduğu için rollback = 1 satır + 1 deploy.

## 8. Gün sonu

- Annotated tag `v0.9.0-rc3` (checklist §9: coverage + test sayısı + smoke)
- TYPE_COVERAGE panosu CI'da güncellenir; edit log + devir memory'si güncelle
- Gece gözlemi; 2026-07-13 = ürün-doğrulama günü (tek soru: "salon fark etti mi?")

## Açık noktalar (sabah owner'a sorulacak)

1. Strateji A/B onayı (öneri B).
2. Kanarya fonksiyonu seçimi (öneri salownCleanupExpiredPending).
3. Deploy saat penceresi (öneri: sabah, salon trafiği düşükken).
