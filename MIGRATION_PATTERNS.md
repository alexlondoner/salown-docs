# MIGRATION_PATTERNS.md — TS Migration Sırasında Keşfedilen Mühendislik Kalıpları

> **Ne bu:** Salown TS migration'ı (2026-07, Faz 3) sırasında **kanıtla** keşfedilen
> kalıpların kalıcı kaydı. Her kalıp gerçek bir dilimde yaşandı, bayt-kanıt diff'iyle
> doğrulandı ve tekrar kullanılabilir çözümüyle yazıldı. Bunlar internetten
> öğrenilmiyor — bu repo'nun kendi mühendislik birikimi.
>
> **Bağlam:** [TYPESCRIPT_MIGRATION_PLAN.md](TYPESCRIPT_MIGRATION_PLAN.md)
> (§10 Firebreak · §11 Type-only · Evidence-driven migration çerçevesi).
> Plan "ne yapacağız?"ı anlatır; bu belge "neden böyle oldu?"yu.
> Yöntem özeti en altta. Yeni kalıp keşfedilirse: buraya numara + metadata ile
> ekle ve dilim edit-log'una işle. **RC3'e kadar bu belge canlı.**
>
> **Metadata alanları (her kalıpta):**
> - **İlk:** ilk görüldüğü dilim/dosya + tarih ("≈" = kesin dilim kaydı yok, erken dönem).
> - **Şiddet:** düşük = tsc anında yakalar, çözüm mekanik · orta = kanıt diff'i
>   olmadan sızabilirdi · yüksek = davranış/byte etkisi görünmez, sadece disiplin yakalar.
> - **Geçerlilik:** 🔁 **migration-boyunca** — bayt-aynı şartı kalkınca (Faz 4
>   strict + temizlik commit'i) workaround gereksizleşir, kalıcı tiple çözülür ·
>   ♾️ **kalıcı** — migration bitse de geçerli mühendislik bilgisi.

---

## Temel ilke (tüm kalıpların anası)

**Migration dilimi = type-only.** Davranışa dokunulmaz; kanıt = derlenen bundle'ın
HEAD ile **bayt bayt aynı** olması. Aşağıdaki kalıpların çoğu şu iki gerçeğin
sonucudur:

1. **Minifier sandığından azını siler:** destructure key'leri, obje prop'ları,
   JSX prop'ları korunur. "Ölü" kodu silmek çoğu zaman baytı DEĞİŞTİRİR. *(♾️ kalıcı bilgi)*
2. **TS transform sandığından fazlasını siler:** tip anotasyonları erased'dir
   (güvenli), ama kullanılmayan value import'ları da elide edilir (Kalıp 20 — sinsi). *(♾️ kalıcı bilgi)*

Çözüm alfabesi: *tip anotasyonu* (her zaman güvenli) → *`as any` cast* (erased;
parens minifier'da katlanır) → *eslint-disable + temizlik listesi* (silmek yerine) →
*interface'e deprecated üye* (call-site'ı değiştirmek yerine) → *bare side-effect
import* (import'u silmek yerine).

---

## Tip-hatası kalıpları (tsc'yi susturmanın bayt-nötr yolları)

**Kalıp 01 — Tarih aritmetiği `a - b`:** ikisi de Date ise TS2363; **iki değişkene
de** `: any` (tek taraf yetmez).
*İlk: ≈2026-07-09 erken dilimler · Şiddet: düşük · Geçerlilik: 🔁 migration*

**Kalıp 02 — Firestore spread daralması:** `{...d.data(), id: d.id}` → `{id: string}`'e
daralır; map callback'ine dönüş tipi ver: `(d): Rec =>`.
*İlk: ≈2026-07-09 erken dilimler (sonra hemen her dilimde) · Şiddet: düşük · Geçerlilik: 🔁 migration (Faz 4'te gerçek Booking/Client tipleriyle kalkar)*

**Kalıp 03 — Karışık stil haritası** (düz obje + fonksiyon üye) →
`satisfies Record<string, CSSProperties | ((...args:any[])=>CSSProperties)>`.
*İlk: OnboardingWizard (dilim 3o civarı) · 2026-07-10 · Şiddet: düşük · Geçerlilik: ♾️ (satisfies tekniği kalıcı; TS 6.0.3)*

**Kalıp 04 — Boolean'lı tuple destructure** (React key hatası TS2322) →
`([l,v,c,bold]: any[])`.
*İlk: ≈2026-07-09/10 · Şiddet: düşük · Geçerlilik: 🔁 migration*

**Kalıp 05 — `isNaN(new Date(...))`:** değişkene `: any` + TODO yorumu
(runtime'da çalışır, Faz 4'te düzgün tiplenir).
*İlk: ≈2026-07-09/10 (tekrar: 4b WalkInForm, 4c Dashboard) · Şiddet: düşük · Geçerlilik: 🔁 migration*

**Kalıp 06 — Heterojen object-literal dizisinin map destructure'ı** → param'a `: Rec`.
*İlk: ≈2026-07-09/10 · Şiddet: düşük · Geçerlilik: 🔁 migration*

**Kalıp 07 — jsx kalıntısı eslint-disable yorumu** (`react-hooks/exhaustive-deps` vb)
TS config'de "rule not found" hatası verir → yorumu kaldır (comment-only, bayt-nötr).
*İlk: ≈2026-07-10 (tekrar: 4b, 4c) · Şiddet: düşük · Geçerlilik: 🔁 migration (tüm jsx çevrilince biter)*

**Kalıp 08 — Neyin silinmesi güvenli:** `let→const` + kullanılmayan map-index silme
bayt-nötr KANITLI; **destructure key silme DEĞİL** (minifier korur).
*İlk: ProfileBar · 2026-07-09 (type-only kuralının kendini kanıtladığı olay: "zararsız" prop silme bundle diff'ini kırmızı yaktı) · Şiddet: ORTA · Geçerlilik: ♾️ (minifier davranışı kalıcı bilgi)*

**Kalıp 09 — Kısmî reassign'lı destructure** (`let [h,m]`, yalnız h değişiyor) →
prefer-const'a eslint-disable (bölmek type-only değil); tümü const olabiliyorsa let→const.
*İlk: staff NewBookingSheet (dilim 3s) · 2026-07-10 · Şiddet: düşük · Geçerlilik: 🔁 migration*

**Kalıp 10 — Stil const'ları:** `{position:'relative'}` widened string CSSProperties'e
atanamaz → const'a `: CSSProperties` + `import type`; CSS custom-property objesi
(`'--brand'`) → `as CSSProperties` cast.
*İlk: OccupancyPanel (3t) / SalonSitePage (3u) · 2026-07-10 · Şiddet: düşük · Geçerlilik: 🔁 migration*

**Kalıp 11 — `querySelector` sonrası atama** declared union'a narrow olur →
`querySelector<HTMLMetaElement>` generic'i.
*İlk: SalonSitePage (3u) · 2026-07-10 · Şiddet: düşük · Geçerlilik: ♾️ (doğru TS tekniği, kalıcı)*

**Kalıp 12 — Arity:** tek-argümanlı çağrı varken ikinci param `?:` ŞART — TS2554
strict'ten bağımsız. (Ters yönü için bkz Kalıp 15: callee'yi değiştirmek bayt
değiştirirse `(fn as any)(...)`.)
*İlk: SalonSitePage (3u) · 2026-07-10 · Şiddet: düşük · Geçerlilik: ♾️*

**Kalıp 13 — Kullanılmayan useState SİLİNMEZ** (hook sırası = davranış) →
eslint-disable + temizlik listesine ekle.
*İlk: SalonSitePage/Bookings (3u/3v) · 2026-07-10 (tekrar: 4b extrasCategoryId, 4c dört state) · Şiddet: ORTA (silinirse runtime crash — React state cleanup dersi) · Geçerlilik: ♾️ (hook sırası gerçeği kalıcı; workaround 🔁)*

**Kalıp 14 — Duplicate object key (TS1117):** ölü ilk key'i silmek bayt DEĞİŞTİRİR;
computed key de TS1117; çözüm **inline spread `...{ key: val }`** — minifier aynı
bayta katlar.
*İlk: Bookings (3v) · 2026-07-10 · Şiddet: ORTA · Geçerlilik: 🔁 migration*

**Kalıp 15 — React 19 `useRef()` 0-arg overload yok (TS2554)** ve genel arity/tip
uyumsuzluğu: argüman/param eklemek bayt değiştirir → **`(fn as any)(...)`** bayt-nötr
kanıtlı (erasure sonrası `(fn)(...)` parens'i minifier düşürür). Aynı teknik:
`(window as any).webkitAudioContext`, `(location.state as any)?.x`,
`new Date(parts[3] as any, ...)`.
*İlk: OnlineProfile (3z) · 2026-07-10 (genellendi: 4c Dashboard ×4) · Şiddet: düşük · Geçerlilik: 🔁 migration*

**Kalıp 16 — Değer döndüren ref callback (TS2322):** tüm arrow'u cast'lemek parens
bırakır (+2 bayt, yakalandı) → **assignment'ı cast'le**: `ref={el => (x[k] = el) as any}`.
*İlk: OnlineProfile (3z) · 2026-07-10 · Şiddet: ORTA (bayt-kanıt olmadan +2 bayt sızardı) · Geçerlilik: 🔁 migration*

**Kalıp 17 — Callable result `res.data` unknown** → `const res: Rec = await fn(...)`.
*İlk: OnlineProfile (3z) · 2026-07-10 · Şiddet: düşük · Geçerlilik: 🔁 migration (Faz 4'te callable dönüş tipleri)*

**Kalıp 18 — Inline options literal'inde ölü prop (TS2353 excess-property):**
prop'u call'dan silmek bayt değiştirir → **hedef interface'e `@deprecated prop?: tip`
ekle** (erased).
*İlk: BookingDetailPanel→conflictUtils.ConflictOptions.processingEnabled (4a) · 2026-07-10 · Şiddet: ORTA (ikinci dosyaya type-only dokunuş gerektirir) · Geçerlilik: 🔁 migration (temizlik commit'inde prop + deprecated üye birlikte kalkar)*

**Kalıp 19 — Rec spread'i map dönüşünde index signature kaybeder:**
`rows.map(r => ({...r, start, end}))` dönüşü `{start,end}`'e daralır → sonraki
erişimler TS2339; callback dönüşünü anotla `(r): Rec =>`. Ek: callee
`{name:string} & Rec` istiyorsa const'u aynı intersection'la tiple — Rec tek
başına TS2345.
*İlk: WalkInForm (4b) · 2026-07-11 · Şiddet: düşük · Geçerlilik: 🔁 migration*

**Kalıp 21 — Typed component prop'una `Rec[]` atanamaz, `any[]` atanır:**
`SelectorProduct[]` gibi somut prop tiplerine `Rec[]` TS2322 verir → o state'leri
`useState<any[]>([])` yap. Ek: zorunlu-param fonksiyon `() => void` prop'una
atanamaz (TS2322) → param'ı opsiyonel tiple: `(force?: any) =>` (erased, bayt-aynı).
Excess-property varyantı: alıcı komponente gevşek `: Rec` prop kontratı ver
(4a/4c — legacy fazla prop'lar type-legal kalır).
*İlk: Dashboard (4c) · 2026-07-11 · Şiddet: düşük · Geçerlilik: 🔁 migration (Faz 4'te any'ler gerçek tiplere döner)*

---

## 🔴 Kalıp 20 — TS'in unused-import elision'ı module graph'ı değiştirir (EN SİNSİ)

| Alan | Değer |
|---|---|
| **First seen** | 2026-07-11 |
| **First file** | `Dashboard.tsx` (dilim 4c; tetikleyen import: ölü `SlotPopup`) |
| **Severity** | **YÜKSEK** — davranışta sıfır fark, hiçbir test/lint yakalamaz; sadece bayt-kanıt disiplini görür (fark 5 bayttı) |
| **Evidence** | `BYTE_IDENTICAL ❌` → normalized hash diff → tek chunk'ta gerçek fark → modül sırası karşılaştırması → import elision doğrulandı |
| **Permanent solution** | Migration sırasında ölü import'u **bare side-effect import**'a çevir — graph kenarı korunur |
| **Applies until** | Frontend TS migration bitene kadar (bayt-aynı şartı kalkınca bare import'lar temizlik commit'inde gerçek silmeyle gider) — ama *TS'in elision davranışı* ♾️ kalıcı bilgidir |

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
  dosyadaki ölü import **tek doğrudan kenar**. (4c: `SlotPopup` TimeGrid
  üzerinden de geliyordu → sıra kaydı, chunk −5 bayt.)
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

*Geçerlilik: 🔁 migration-boyunca (bayt-aynı şartıyla birlikte yaşar); ama
"iddia değil diff" ilkesi ♾️ kalıcı — evidence-driven migration'ın davranış-kanıtı katmanı.*

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

*Geçerlilik: 🔁 migration-boyunca — liste, migration sonrası TEK chore commit'te kapanır.*

Migration sırasında disable'lanan her ölü şey (import/useState/const/destructure)
**temizlik listesine** gider (memory `project_ts_migration` → "Birikmiş temizlik
listesi"); migration sonrası TEK chore commit'te, repo-wide grep kanıtıyla silinir.
Grep çapası: `type-only rule`.
