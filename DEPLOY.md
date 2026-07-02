# DEPLOY.md

## Temel Kural

**Her deploy öncesi tenant + URL'yi söyle, onay bekle.**
Deploy script'leri: `salown-app/` ve `whitecross-site/` altında mevcut.

## ⛔ TEK KAYNAK KURALI — asla eskiyi başka yerden build/deploy etme

**Her site için TEK doğru kaynak klasör vardır. Deploy SADECE oradan yapılır.**
Bir özelliği bir yerde güncelleyip sonra başka bir klasörden (eski bundle/eski kaynak)
build alıp deploy edersek, canlı ESKİ versiyona geri döner ve emeğimiz silinir.

| Canlı URL / site | TEK doğru kaynak | Build | ASLA buradan deploy etme |
|---|---|---|---|
| salown.com `/`, `/app`, `/book`, `/s` (`salown`) | `salown-app/hosting/` | `npm run build` | — (`salown-site/` SİLİNDİ 2026-06-29) |
| staff.salown.com (`salown-staff`) | `salown-app/` | `npm run build:staff` | ❌ başka bundle |
| whitecrossbarbers.com (`whitecrossbarbers-*`) | `whitecross-site/` | site içi | — |

**Deploy öncesi her zaman:** `git status` + `git log origin/main..HEAD` temiz mi? Değilse
önce commit/push — çünkü `main`'e push = CI otomatik deploy, ve uncommitted dosyalar
canlıya GİTMEZ → partial/eski state riski.

### Firestore Rules — TEK KAYNAK = `salown-app/firestore.rules` (2026-06-21)
Birden çok repo (salown-panel, whitecross-site, eekurt…) `havuz-44f70`'a rules deploy edebiliyordu →
**en son deploy eden kazanır** → eski kopya güvenli kuralı geri ezebilir (cross-tenant deliği geri açılır).
**Bundan sonra rules YALNIZCA `salown-app/firestore.rules`'tan deploy edilir.**
```bash
cd ~/Desktop/alex/salown-app
firebase deploy --only firestore:rules --project havuz-44f70
```
- Diğer repolardaki `firestore.rules` kopyaları ÖLÜ — onlardan `firestore:rules` deploy etme.
- CI (`--only hosting`) rules'a dokunmaz; rules deploy hep manuel + onaylı.
- Canlı kuralı çekme + test (Java/emulator gerekmez): `python3 docs/test-firestore-rules.py salown-app/firestore.rules`.
- Rollback: `docs/firestore.rules.ROLLBACK.txt` (eski ruleset adı). Snapshot: `docs/firestore.rules.LIVE` (değişiklik öncesi).

### Hub.salown.com dersi (2026-06-21)
`hub.salown.com` ayrı bir hosting site DEĞİL — `salown` site'ına bağlı bir custom domain.
Kök yolu (`/`) `hosting/index.html` (landing) serve ediyor → salown.com ile **birebir aynı**
açılıyor. Asıl hub sayfası `/hub` rewrite'ında (app bundle). Firebase tek site içinde
host'a göre farklı kök veremez. "Eski build ezdi" değil — **domain yanlış site'a bağlı**.
Düzeltmek için: hub'a ayrı hosting site (`salown-hub`) aç + domaini ona taşı, VEYA
landing index.html'de `location.host==='hub.salown.com'` ise `/hub`'a yönlendir.

## salown-app Deploy

```bash
cd ~/Desktop/alex/salown-app
npm run build          # sadece src/ değişmişse gerekli
npx firebase-tools deploy --only hosting --project havuz-44f70
```

**Ayrı deploy hedefleri** (owner onayı gerekli):
```bash
firebase deploy --only functions
firebase deploy --only firestore:rules
```

**Security değişikliklerinde sıra:** functions → hosting → rules SON.

⚠️ **`salown-site/` SİLİNDİ (2026-06-29)** — tek hosting kaynağı artık `salown-app/hosting/`. Landing, public profile (`/s/**`), booking (`/book/**`) hepsi buradan deploy olur. Yedek: `../salown-site-backup-20260629-1841.zip`.

## Landing / hosting kaynağı

`salown-app/hosting/index.html` artık GERÇEK dosya (eski salown-site symlink'i kaldırıldı).
- `salown-app/hosting/*.html` düzenle → landing sayfaları (`/`, `/barbers`, `/vs-*`, …)
- `salown-app/src/` düzenle → `npm run build` → `/app`, `/login`, `/s/**`, `/book/**` güncellenir

## whitecross-site Deploy

```bash
cd ~/Desktop/alex/whitecross-site
# deploy.sh mevcut
```

Whitecross functions deploy:
```bash
firebase deploy --only functions --project havuz-44f70
```

## Kritik Kural: Veri Silme

**ASLA Firestore'dan bulk-delete yapma.**
1. Full export: `gcloud firestore export gs://...`
2. Dry-run → CSV → owner review
3. Ancak onay sonrası write

## Build Kontrolü

`npm run build` — sıfır error olmadan geçmeli. Deploy öncesi zorunlu.
