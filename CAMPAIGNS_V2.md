# CAMPAIGNS_V2.md — Audience Scope + Kategori Kütüphanesi (TASARIM)

> **Durum:** 🔵 Onaylı tasarım, implementasyon **TS migration bitene kadar BEKLİYOR** (feature-freeze, owner kararı 2026-07-10).
> Migration bitince tüm kod **TSX/TS altyapısı üzerinde** yazılacak. Bu doc, o gün sıfırdan keşif yapmamak için tam spec + kod çapaları tutar.

## 1. Problem (tespit 2026-07-10 audit)

Member'lar (standing discount aldıkları için puan biriktiremezler) client'lara yönelik
promosyon maillerini almaya devam ediyor. Puan kazanımı DOĞRU şekilde kapalı
(checkout member'a 0 puan yazar) — sızıntı **kampanya katmanında**:

| # | Sorun | Kanıt (dosya:satır, 2026-07-10) |
|---|-------|----------------------------------|
| 1 | Kampanya alıcı filtresi `isMember`'a hiç bakmıyor | `salown-app/src/components/BulkCampaignPanel.tsx:181-205` — email/opt-out/segment/suppression var, member yok |
| 2 | `haspoints` segmenti = sadece `points > 0` → member olmadan önce puan biriktirmiş member'lar "Redeem points" maili alıyor (bakiye silinmiyor, sadece kazanım duruyor) | `BulkCampaignPanel.tsx:187` |
| 3 | Sunucu tarafında member guard yok — `sendCampaignBulk` yalnız opt-out'u re-check eder | `salown-app/functions/index.js:2168-2172` (sendOne) |
| 4 | Per-client drawer member rozeti/uyarısı göstermiyor | `SendCampaignPanel.tsx` (isMember referansı yok) |
| 5 | **(Bağımsız latent bug)** `salownSendLoyaltyEmail` member tespiti tek, case-sensitive email sorgusu — checkout'un zinciri (manualId→phone→email(lc)→alias→norm-phone) ile uyumsuz. Telefonla eşleşen / email case'i farklı member'a tam loyalty-card'lı makbuz gider | `functions/index.js:585` vs `src/firestoreActions.js:55-101` |

Doğru çalışanlar (aksiyon gerekmez): checkout puan=0 (`CheckoutPanel.jsx:761`,
`firestoreActions.js:125`), makbuz maili member branch'i (`functions/index.js:702`,
`emailTemplates.js:332` MemberZone kartı), confirmation'da double-points gizleme
(`functions/emails/index.js:159,192`).

## 2. Onaylı tasarım — Audience Scope

Her kampanyaya tek alan: **`audienceScope: 'clients' | 'members' | 'everyone'`**.
"Member'ı hariç tut" gömülü kuralı DEĞİL — member'lar ayrı bir pazarlama kitlesi olur
(member-only kampanya atılabilir).

- **UI (Compose ①):** segment pill'lerinin üstünde 3'lü pill: 👥 Clients only (default) / ◆ Members only / 🌐 Everyone. Kaç member'ın neden düştüğü her zaman görünür ("182 recipients · 14 members excluded") — opt-out sayacı kalıbı.
- **Filtre:** `clients` → `isMember` düşer; `members` → sadece `isMember`; `everyone` → filtre yok. Veri hazır: `audienceUtils.ts:164` `isMember`'ı zaten hesaplıyor (şu an kullanılmıyor).
- **Sunucu (asıl güvence):** `sendCampaignBulk` `audienceScope` parametresi alır (**default `'clients'`** — parametresiz eski çağrı bile member'a promo gönderemez, en güvenli taraf). Server kendi member listesini çeker (`clients where isMember==true` → lowercase email set) — client'ın yolladığı `isMember` flag'ine güvenmez. `campaignRuns` log'una `audience` yazılır → geçmişte chip.
- **Template default'ları:** her şablon `audience` taşır. We-miss-you / Redeem-points / Fill-this-week → `clients`; **Birthday → `everyone`** (owner onayı 2026-07-10: kutlama herkese, içinde puan yoksa sorun yok); member şablonları → `members`.
- **Per-client drawer:** hedef member ise ◆ rozet + template clients-only ise uyarı; tekil gönderim bilinçli seçim olduğundan server bloklamaz (bulk'tan farkı bu).
- **Geriye dönük:** eski `campaignRuns` kayıtlarında alan yok → `everyone` sayılır (sadece görüntüleme etkisi). Migration yok.

## 3. Kategori kütüphanesi (vizyon, owner 2026-07-10)

Şu anki düz template listesi kategorilere ayrılır; Compose'da önce kategori seçilir:

| Kategori | Örnekler | Default audience |
|---|---|---|
| 🎂 Lifecycle | Birthday, "1. yıl bizimlesin", welcome | Everyone |
| 💤 Win-back | Lapsed 30/60/90 + indirim | Clients |
| ⭐ Loyalty | Redeem points, double points, milestone | Clients |
| 📦 Packages & Offers | Büyük paketler, **sakin gün %30-40**, bundle | Seçime göre |
| ◆ Members | Member appreciation, founding-member ayrıcalıkları | Members |
| 📣 Announcements | Yeni personel/servis, saatler, sezonluk | Everyone |

- **Founding clients segmenti:** `firstVisitMs` tenant'ın açılış dönemine denk gelenler ("ilk günden bizimle") — audienceUtils verisi mevcut, yeni segment küçük iş.
- **Sakin gün paketleri:** Faz 1 elle gün/saat seçimi ("Salı-Çarşamba %30"); Faz 2 occupancy verisinden otomatik "en sakin gün" önerisi. Amaç ikili: dışarıdan müşteri attract + member'larla uzun vadeli ilişki.
- İleride dinamik tenant ayarları: per-tenant default audience + tier bazlı alt kitleler (`memberTier: student` vs MemberZone) bu alanın üstüne oturur.

## 4. İmplementasyon dilimleri (migration SONRASI, TSX üzerinde)

1. **`BulkCampaignPanel.tsx`** — `AUDIENCES` sabiti + `audienceScope` state (default `clients`) + pill UI + alıcı filtresi + "N members excluded" sayacı + template `audience` default'ları + payload'a `audienceScope` (+ recipients'a `isMember`).
2. **`functions/index.js` `sendCampaignBulk`** — `audienceScope` param (whitelist, default `clients`) + server-side member email set + sendOne'da skip + `campaignRuns.audience`. (`where('isMember','==',true)` single-field → index gerekmez.)
3. **`SendCampaignPanel.tsx`** — member rozeti + clients-only template uyarısı.
4. **Kampanya geçmişi** — audience chip.
5. **(Bağımsız latent fix — owner kararı 2026-07-10: freeze'den muaf DEĞİL, C8 ile birlikte)** `salownSendLoyaltyEmail` member lookup'ını güçlendir: lowercase email + phone fallback (`functions/index.js:585`). Not: bu makbuz maili transactional'dır, audience scope kampanya katmanını kapsar — o yüzden scope'la kendiliğinden çözülmez, bu dilim ayrıca gerekli.
6. **Kategori kütüphanesi + founding-clients segmenti + sakin-gün paket şablonları** — ayrı dilim (Faz-2 backend dalgasıyla: scheduling cron C3.1 + open-tracking C3.3 + C7 metrikleri).

Not: 2026-07-10'da dilim 1 başlatılıp owner talimatıyla geri alındı (working tree temiz);
kod yazılmadı, sadece bu spec kaldı. Roadmap kaydı: **C8**.
