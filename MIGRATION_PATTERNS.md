# MIGRATION_PATTERNS.md — TS Migration Sırasında Keşfedilen Mühendislik Kalıpları

> **Ne bu:** Salown TS migration'ı (2026-07, Faz 3) sırasında **kanıtla** keşfedilen
> kalıpların kalıcı kaydı. Her kalıp gerçek bir dilimde yaşandı, bayt-kanıt diff'iyle
> doğrulandı ve tekrar kullanılabilir çözümüyle yazıldı. Bunlar internetten
> öğrenilmiyor — bu repo'nun kendi mühendislik birikimi.
>
> **Bağlam:** [TYPESCRIPT_MIGRATION_PLAN.md](TYPESCRIPT_MIGRATION_PLAN.md)
> (§10 Firebreak · §11 Type-only · Evidence-driven migration çerçevesi).
> Yöntem özeti en altta. Yeni kalıp keşfedilirse: buraya numarayla ekle + dilim
> edit-log'una işle. **RC3'e kadar bu belge canlı.**

---

## Temel ilke (tüm kalıpların anası)

**Migration dilimi = type-only.** Davranışa dokunulmaz; kanıt = derlenen bundle'ın
HEAD ile **bayt bayt aynı** olması. Aşağıdaki kalıpların çoğu şu iki gerçeğin
sonucudur:

1. **Minifier sandığından azını siler:** destructure key'leri, obje prop'ları,
   JSX prop'ları korunur. "Ölü" kodu silmek çoğu zaman baytı DEĞİŞTİRİR.
2. **TS transform sandığından fazlasını siler:** tip anotasyonları erased'dir
   (güvenli), ama kullanılmayan value import'ları da elide edilir (Kalıp 20 — sinsi).

Çözüm alfabesi: *tip anotasyonu* (her zaman güvenli) → *`as any` cast* (erased;
parens minifier'da katlanır) → *eslint-disable + temizlik listesi* (silmek yerine) →
*interface'e deprecated üye* (call-site'ı değiştirmek yerine) → *bare side-effect
import* (import'u silmek yerine).

---

## Tip-hatası kalıpları (tsc'yi susturmanın bayt-nötr yolları)

**Kalıp 01 — Tarih aritmetiği `a - b`:** ikisi de Date ise TS2363; **iki değişkene
de** `: any` (tek taraf yetmez).

**Kalıp 02 — Firestore spread daralması:** `{...d.data(), id: d.id}` → `{id: string}`'e
daralır; map callback'ine dönüş tipi ver: `(d): Rec =>`.

**Kalıp 03 — Karışık stil haritası** (düz obje + fonksiyon üye) →
`satisfies Record<string, CSSProperties | ((...args:any[])=>CSSProperties)>`.

**Kalıp 04 — Boolean'lı tuple destructure** (React key hatası TS2322) →
`([l,v,c,bold]: any[])`.

**Kalıp 05 — `isNaN(new Date(...))`:** değişkene `: any` + TODO yorumu
(runtime'da çalışır, Faz 4'te düzgün tiplenir).

**Kalıp 06 — Heterojen object-literal dizisinin map destructure'ı** → param'a `: Rec`.

**Kalıp 07 — jsx kalıntısı eslint-disable yorumu** (`react-hooks/exhaustive-deps` vb)
TS config'de "rule not found" hatası verir → yorumu kaldır (comment-only, bayt-nötr).

**Kalıp 08 — Neyin silinmesi güvenli:** `let→const` + kullanılmayan map-index silme
bayt-nötr KANITLI; **destructure key silme DEĞİL** (minifier korur).

**Kalıp 09 — Kısmî reassign'lı destructure** (`let [h,m]`, yalnız h değişiyor) →
prefer-const'a eslint-disable (bölmek type-only değil); tümü const olabiliyorsa let→const.

**Kalıp 10 — Stil const'ları:** `{position:'relative'}` widened string CSSProperties'e
atanamaz → const'a `: CSSProperties` + `import type`; CSS custom-property objesi
(`'--brand'`) → `as CSSProperties` cast.

**Kalıp 11 — `querySelector` sonrası atama** declared union'a narrow olur →
`querySelector<HTMLMetaElement>` generic'i.

**Kalıp 12 — Arity:** tek-argümanlı çağrı varken ikinci param `?:` ŞART — TS2554
strict'ten bağımsız. (Ters yönü için bkz Kalıp 15: callee'yi değiştirmek bayt
değiştirirse `(fn as any)(...)`.)

**Kalıp 13 — Kullanılmayan useState SİLİNMEZ** (hook sırası = davranış) →
eslint-disable + temizlik listesine ekle.

**Kalıp 14 — Duplicate object key (TS1117):** ölü ilk key'i silmek bayt DEĞİŞTİRİR;
computed key de TS1117; çözüm **inline spread `...{ key: val }`** — minifier aynı
bayta katlar.

**Kalıp 15 — React 19 `useRef()` 0-arg overload yok (TS2554)** ve genel arity/tip
uyumsuzluğu: argüman/param eklemek bayt değiştirir → **`(fn as any)(...)`** bayt-nötr
kanıtlı (erasure sonrası `(fn)(...)` parens'i minifier düşürür). Aynı teknik:
`(window as any).webkitAudioContext`, `(location.state as any)?.x`,
`new Date(parts[3] as any, ...)`.

**Kalıp 16 — Değer döndüren ref callback (TS2322):** tüm arrow'u cast'lemek parens
bırakır (+2 bayt, yakalandı) → **assignment'ı cast'le**: `ref={el => (x[k] = el) as any}`.

**Kalıp 17 — Callable result `res.data` unknown** → `const res: Rec = await fn(...)`.

**Kalıp 18 — Inline options literal'inde ölü prop (TS2353 excess-property):**
prop'u call'dan silmek bayt değiştirir → **hedef interface'e `@deprecated prop?: tip`
ekle** (erased). İlk kullanım: 4a BookingDetailPanel → conflictUtils `ConflictOptions.processingEnabled`.

**Kalıp 19 — Rec spread'i map dönüşünde index signature kaybeder:**
`rows.map(r => ({...r, start, end}))` dönüşü `{start,end}`'e daralır → sonraki
erişimler TS2339; callback dönüşünü anotla `(r): Rec =>`. Ek: callee
`{name:string} & Rec` istiyorsa const'u aynı intersection'la tiple — Rec tek
başına TS2345.

**Kalıp 21 — Typed component prop'una `Rec[]` atanamaz, `any[]` atanır:**
`SelectorProduct[]` gibi somut prop tiplerine `Rec[]` TS2322 verir → o state'leri
`useState<any[]>([])` yap. Ek: zorunlu-param fonksiyon `() => void` prop'una
atanamaz (TS2322) → param'ı opsiyonel tiple: `(force?: any) =>` (erased, bayt-aynı).
Excess-property varyantı: alıcı komponente gevşek `: Rec` prop kontratı ver
(4a/4c — legacy fazla prop'lar type-legal kalır).

---

## 🔴 Kalıp 20 — TS'in unused-import elision'ı module graph'ı değiştirir (EN SİNSİ)

```
Unused value import (import X from './X'; X hiç kullanılmıyor)
        ↓
TS transform import'u ELİDE eder ("tip importu olabilir" varsayımı)
        ↓
module graph'tan o kenar düşer → modül keşif SIRASI değişir
  (modül başka bir importer üzerinden daha geç keşfedilir)
        ↓
chunk içi modül sırası + minifier alias dağılımı değişir
        ↓
chunk hash değişir → TÜM bundle hash'leri kaskat değişir
```

- **Ne zaman patlar:** modülü **başka biri de kullanıyor** + migrate edilen
  dosyadaki ölü import **tek doğrudan kenar**. (4c Dashboard: ölü `SlotPopup`
  import'u; modül TimeGrid üzerinden de geliyordu → sıra kaydı, chunk −5 bayt.)
- **Ne zaman patlamaz:** modül zaten iki build'de de tree-shaken (hiç kullanılmayan
  saf modül) → elision görünmez (4c'de ReceiptPanel/ResizeHandle).
- **Çözüm:** ölü import'u SİLME (silmek de bayt değiştirir) — **bare side-effect
  formuna çevir:** `import SlotPopup from '../components/SlotPopup'` →
  `import '../components/SlotPopup'`. TS side-effect import'u asla elide etmez;
  graph kenarı aynı satır pozisyonunda kalır → bayt-aynı KANITLI.
- **Teşhis reçetesi** ("neden bütün hash'ler değişti?"):
  1. Hash'leri normalize et: `sed -E 's/-[A-Za-z0-9_-]{8}\.js/.HASH.js/g'`
  2. Chunk çiftlerini isim öneki üzerinden eşleyip `cmp` ile karşılaştır →
     gerçek fark genelde TEK chunk'tadır (gerisi hash kaskatı).
  3. O chunk'ta `cmp` ofsetiyle ilk farkı bul; import satırı/alias reshuffle
     görünüyorsa sıra değişimi = elision şüphesi; `;` split + diff ile modül
     sırasını karşılaştır.

---

## Yöntem — bayt-kanıt v2 (her dilimin kanıt zinciri)

```
git mv X.jsx X.tsx
→ surgical type-only anotasyon (yukarıdaki kalıplarla)
→ npx tsc --noEmit                        (tip kanıtı)
→ bayt-kanıt v2:                          (davranış kanıtı)
    git worktree add <scratch>/wt-head HEAD
    ln -s <repo>/node_modules <scratch>/wt-head/node_modules
    iki build de scratchpad'e (--outDir ... --emptyOutDir)
    diff -r base after   → exit 0 ŞART
    (staff dosyasında --config vite.staff.config.js ŞART;
     bitince symlink sil + git worktree remove --force)
→ eslint (dosya)                          (disiplin kanıtı)
→ vitest                                  (regresyon kanıtı)
→ explicit-path commit (refactor(ts): ... (slice NX))
→ git pull --rebase --autostash → push
```

Kanıttan SONRA yapılan her edit (comment-only dahil) için **final re-proof** koş —
ucuz, ve "comment'ler kesin bayt-nötr" varsayımını her seferinde kanıta çevirir.

## Temizlik disiplini

Migration sırasında disable'lanan her ölü şey (import/useState/const/destructure)
**temizlik listesine** gider (memory `project_ts_migration` → "Birikmiş temizlik
listesi"); migration sonrası TEK chore commit'te, repo-wide grep kanıtıyla silinir.
Grep çapası: `type-only rule`.
