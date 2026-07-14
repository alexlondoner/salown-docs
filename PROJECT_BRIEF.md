# salOWN — Proje Durum Raporu (SaaS danışmanlık için bağlam)

> Dış danışmana (ChatGPT vb.) yapıştırılmak üzere kendi başına yeten özet.
> **Snapshot: 2026-07-14.** Tek gerçek durum kaynağı: [ROADMAP.md](ROADMAP.md).
> Bu dosya eskir — büyük durum değişiminde güncelle veya ROADMAP'e yönlendir.

## salOWN at a glance (30-second read)

- **Multi-tenant salon/barber operating system** — booking, loyalty, staff mobile app,
  finance, marketing, admin panel.
- **Born inside a real barbershop.** We didn't set out to build salon software — we couldn't
  run our own shop on existing tools, so we built our own system. Today the platform powers
  the business that created it (Whitecross = premium pilot tenant).
- **Running in production across 3 tenants** — real customers, daily operational use.
- **Current focus: hardening, security and scale readiness.** Features still ship weekly, but
  the strategic weight is on production maturity — closing security gates, tenant isolation,
  operational safety — not feature count.

## Production today

*(Snapshot: 2026-07-14 — see header note; durum tek kaynağı ROADMAP.md)*

- **3 live tenants** (`whitecross` · `herohairs` · `eekurt`), all full-feature ("Class A")
- **Real customer bookings** — regular, often daily: website + external platforms
  (Booksy/Fresha/Treatwell email ingestion) + walk-ins, all in one system
- **Loyalty redemptions happening in production** (customers actually redeem points)
- **Transactional + loyalty email system live** (`noreply@salown.com`, Brevo)
- **Staff mobile app in daily operational use** by barbers
- **Automated CI deployment** — push to `main` → Firebase Hosting (Whitecross public site
  deployed separately, by design)
- **Payments:** all Stripe Connect modes verified end-to-end in TEST mode; live mode (real
  money) not yet enabled — pending owner decision

## 1. Ürün nedir
**salOWN** — çok-kiracılı (multi-tenant) salon/barber yönetim SaaS'ı. Booking, ödeme, sadakat
(loyalty), bildirimler, personel mobil uygulaması, admin panel, raporlama.
- **3 tenant canlıda:** `whitecross` (premium pilot — her özellik önce burada), `herohairs`,
  `eekurt`. Hepsi "Class A" (tam özellik).
- **Gerçek kullanım sinyalleri:** müşteriler loyalty puanı redeem ediyor; transactional + loyalty
  mailleri düzenli gidiyor; website'ten düzenli (bazen günlük) booking geliyor. Platform operasyonel.

## 2. Teknik mimari
- **Frontend:** React + Vite + **TypeScript**. Admin panel + booking + public profil.
- **Backend:** Firebase — Firestore (veri), Cloud Functions (region `europe-west2`), Hosting.
  Proje `havuz-44f70`.
- **Veri modeli:** her şey `tenants/{tenantId}/...` altında (barbers, bookings, clients, settings,
  finance…).
- **Yüzeyler:**
  - salOWN-hosted booking/profil (`salown.web.app`) — multi-tenant.
  - **whitecross premium site** (`whitecrossbarbers.com`) — özel domain, statik HTML/JS storefront
    (ayrı repo).
  - **Staff mobil app** (`salown-staff.web.app`) — barber'ların günlük operasyonu.
- **Repolar:** `Salown` (ana app + functions), `whitecross-site` (premium storefront),
  `salownadmin` (super-admin panel), `salown-docs` (roadmap/incidents/security "brain" dokümanları).
- **Deploy:** `main`'e push → GitHub Actions otomatik Firebase Hosting deploy. (İstisna: whitecross
  public site **manuel** deploy gerektiriyor.)

## 3. TypeScript migrasyonu — durum (%91 genel)
| Alan | Durum |
|---|---|
| **Frontend (TS/TSX)** | ✅ **%100** — 113 ts / 0 js |
| **Functions `index.js` split** | ✅ **%100** — tek dev dosya domain modüllerine bölündü (`src/index.ts`) |
| **Functions TS (build)** | 🟡 **%65** — 22 ts / 12 js |
| **Shared models** | ✅ **%100** |
| `@ts-ignore` | **0** ✅ · `any` (etiketli/kasıtlı) 1408 (101 × `TODO(ts-migration)`) |

**Sıradaki teknik-borç işi (aktif öncelik):** *I2 Faz 2* — fonksiyon export'larını domain
modüllerine taşıma. Faz 1 (helper'lar) bitti; kalan = export'lar (parsers → notifications →
marketing; Stripe/bookings **en son**, canlı boru en hassas). Altın kural: export adı + config
birebir, saf taşıma, dilim başına tek commit + hedefli deploy.

## 4. Yol haritası — nerede duruyoruz
Proje "sıfırdan özellik" aşamasında değil; kalan iş çoğunlukla **ölçeğe hazırlık** + **para
almadan önce** + **retention derinleştirme**.

**Aktif öncelikler:**
1. **I2 Faz 2** (functions modülerleştirme) — yukarıda.
2. **Pre-Scale Hardening Gate:** Tier 1 (kritik güvenlik) ✅ **kapandı** (rol-claim, tenant-scoped
   rules, financial-forge guard, staff self-escalate). Kalan **Tier 2 🔴-1:** `read: if true`
   yüzeyi — `services`/`products`/`clients` + tenant root doc hâlâ herkese açık okunur; 1000 salonda
   PII enumerate + read-cost riski → tenant hacmi artmadan kapanmalı.
3. **Ödeme (Stripe Connect):** tüm modlar TEST mode'da uçtan uca doğrulandı (deposit/full/optional/
   pay-at-venue). **Canlı-mode (gerçek para) henüz açılmadı** — owner kararı + live keys bekliyor.
4. **YENİ tema — Staff Management & Compensation** (bugün eklendi, aşağıda).

## 5. Son yapılan işler (2026-07-14)
- **Takvim grid bug:** art arda checked-out walk-in'ler üst üste biniyordu → `computeColumns`'a
  render'ın 30dk min-yükseklik tabanı eklendi (kolon motoru ile çizim eşitlendi). ✅ Canlı.
- **whitecross-site leave:** izinli barber booking listesinde ismi kalıyordu → **tarihe-duyarlı
  gizleme**: izin günlerinde gizli, dönüş sonrası tarihte otomatik geri geliyor (90 günlük pencere
  içinde pre-book edilebilir). ✅ Canlı.
- **Veri-emniyeti (S1):** ürün satışı + blok artık `barberName` snapshot'lıyor → barber silinse bile
  satış ismini koruyor. ✅ Canlı.
- **Staff Management & Compensation** ROADMAP'e yeni tema (S) olarak eklendi + tasarım prompt'u
  yazıldı ([STAFF_MANAGEMENT_DESIGN_PROMPT.md](STAFF_MANAGEMENT_DESIGN_PROMPT.md)).

## 6. Staff Management & Compensation (yeni büyük modül — tasarım aşamasında)
**Sorun:** personel farklı ödeme modelleriyle çalışıyor, sistem sadece sabit maaş biliyor
(whitecross'a özel Finance).
**3 model:** **wage** (sabit £/gün-hafta-ay) · **commission** (cironun %'si) · **self-employed**
(koltuk kirası: sabit £ veya % — kişi kendi parasını alır, dükkan kira/komisyon toplar). Üçü P&L'i
farklı hesaplattığı için ayrı, birinci-sınıf modül gerekiyor (multi-tenant, Finance'a gömülmez).
**Kapsam:** comp modeli + yaşam döngüsü (active/leave/passive/deleted) + veri-emniyeti (snapshot/
soft-delete/GDPR anonimleştirme) + Reports/Finance/Occupancy entegrasyonu + göç + UK yasal ayrım
(self-employed ≠ employee).

## 7. Bilinen açık buglar / işler
- **passive-maaş:** passive (işten ayrılmış) barber Finance'ta hâlâ günlük maaş tahakkuk ediyor
  (filtre eksik). *(Finance whitecross-özel = düşük öncelik.)*
- **occupancy-leave:** izindeki barber occupancy kapasite paydasında sayılıyor → % yapay düşük.
- **Reports arşiv:** silinen barber'ın geçmiş istatistik satırı Reports "Barbers" sekmesinden
  düşüyor (arşiv olarak gösterilmeli).
- **Tier 2 read:true yüzeyi** (yukarıda) — ölçek öncesi kapanmalı.
- Ufak: bounce-checker (email) hâlâ kırık.

## 8. Operasyonel kurallar (kritik)
- `main`'e push = otomatik hosting deploy (CI). Her edit öncesi `git status` + unpushed kontrol.
- whitecross public site = **manuel** deploy (`firebase.saas.json`); yanlış config canlı EeKurt
  sitesini ezer → dikkat.
- Firestore'da **toplu silme YOK** (export → dry-run → owner onayı → yaz).
- Booking veri tuhaflığı: walk-in `barberId` = küçük-harf isim; online = doc id + `barberName`.
- Tüm ciddi olaylar `INCIDENTS.md`'ye, durum tek kaynak `ROADMAP.md`'de.

## 9. Danışmana sorulabilecek iyi sorular
1. self-employed/chair-rent comp modelini Firestore'da tarih-etkili nasıl modellemeli?
2. Pre-Scale `read:true` yüzeyini public-projeksiyon deseniyle kapatma stratejisi?
3. Stripe Connect canlı-mode geçişinde komisyon (`application_fee`) ve KDV/VAT ele alışı?
4. 3→100+ tenant ölçeğinde tek Firebase projesi vs izolasyon?
