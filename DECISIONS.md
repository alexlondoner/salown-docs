# DECISIONS.md — neden böyle yaptık (ADR)

> **Bu dosya nedir:** Mimari/ürün kararları ve **gerekçeleri** (Architecture Decision Records). "6 ay sonra 'niye Brevo? niye Payment Link değil?' diye sorduğunda cevabın burada olsun" dosyası.
>
> **Nasıl kullanılır:** Yerleşik bir kararı değiştirmeden önce buradaki kaydı oku — hangi alternatifler zaten elenmiş, hangi acı zaten yaşanmış gör. Yeni önemli bir karar aldığında **yeni ADR ekle** (eskiyi silme; "Superseded" işaretle).
>
> **İlgili:** kurallar → [INVARIANTS.md](INVARIANTS.md) · kasıtlı tuhaflıklar → [KNOWN_QUIRKS.md](KNOWN_QUIRKS.md) · kazalar → [INCIDENTS.md](INCIDENTS.md) · mimari → [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md).

**Durum rozetleri:** ✅ Accepted (yürürlükte) · 🕓 Proposed (tasarım, henüz uygulanmadı) · ⛔ Superseded (yerine başka karar geçti) · 🧊 Deferred (ertelendi).
**Format:** her ADR = Bağlam (neden karar gerekti) → Karar → Alternatifler (neden onlar değil) → Sonuç.

---

## İçindekiler
| # | Karar | Durum | Tarih |
|---|-------|-------|-------|
| [ADR-001](#adr-001--salown-panel-cra--salown-app-vite) | Ana repo salown-panel (CRA) → salown-app (Vite) | ✅ | — |
| [ADR-002](#adr-002--whitecross--ayrı-ürün-değil-salown-premium-tenantı) | Whitecross = ayrı ürün değil, Salown tenant'ı | ✅ | 2026-06-19 |
| [ADR-003](#adr-003--transactional-email-tenant-gmail--brevo) | Transactional email: Gmail → Brevo | ✅ | 2026-06-19 |
| [ADR-004](#adr-004--ödeme--stripe-connect--checkout-session-payment-link-değil) | Ödeme = Stripe Connect + Checkout Session | 🕓 | — |
| [ADR-005](#adr-005--salon-içi-kart--stripe-tap-to-pay-pilot) | Salon-içi kart = Stripe Tap to Pay pilot | 🕓 | — |
| [ADR-006](#adr-006--silme--süper-admin-only-pilot) | Silme = super-admin only (pilot) | ✅ | 2026-07-02 |
| [ADR-007](#adr-007--barber-eşleşmesi-exact-fuzzy-yok-kaynakta-düzelt) | Barber eşleşmesi exact, fuzzy yok | ✅ | 2026-06-26 |
| [ADR-008](#adr-008--aggregator-komisyonu--iki-defter-muhasebe) | Aggregator komisyonu = iki-defter muhasebe | ✅ | 2026-06-26 |
| [ADR-009](#adr-009--self-onboarding-asla-kapatılmaz) | Self-onboarding asla kapatılmaz | ✅ | — |
| [ADR-010](#adr-010--bundle-predeploy-hook) | Deploy güvenliği = predeploy build hook | ✅ | 2026-06-29 |
| [ADR-011](#adr-011--salown-site-silindi-tek-hosting-kaynağı) | salown-site silindi, tek hosting kaynağı | ✅ | 2026-06-29 |
| [ADR-012](#adr-012--docs--ayrı-private-repo-salown-docs) | docs = ayrı private repo (salown-docs) | ✅ | 2026-07-02 |
| [ADR-013](#adr-013--incident-kayıt-standardı-8-alan-template) | Incident kayıt standardı (8-alan template) | ✅ | 2026-07-02 |

---

## ADR-001 — Ana repo: salown-panel (CRA) → salown-app (Vite)
**Durum:** ✅ Accepted

**Bağlam:** İlk panel `salown-panel` CRA (.js) ile yazıldı. Yeni geliştirme için daha hızlı build/dev deneyimi gerekiyordu.
**Karar:** Tüm yeni iş `salown-app` (Vite + .jsx) altında. `salown-panel` legacy, aşamalı emekliye ayrılıyor.
**Alternatifler:** CRA'da kalmak (yavaş, bakımı zayıf) — elendi.
**Sonuç:** MAIN ACTIVE REPO = salown-app. salown-panel'e feature eklenmiyor. Detay: [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md).

## ADR-002 — Whitecross = ayrı ürün değil, Salown premium tenant'ı
**Durum:** ✅ Accepted · **Tarih:** 2026-06-19 (migration tamamlandı)

**Bağlam:** whitecross-site kendi functions/email/booking'iyle ayrı bir sistemdi. Salown multi-tenant'a geçince ikilik oluştu.
**Karar:** Whitecross, Salown'un **premium tenant'ı** (custom domain whitecrossbarbers.com bir premium özellik). UI değişiklikleri salown-app'te yapılır; barber-panel/barber-mobile LEGACY.
**Alternatifler:** whitecross'u ayrı ürün olarak sürdürmek — çift bakım, elendi.
**Sonuç:** Email/parser/notification whitecross-site → salown-app trigger'larına taşındı (tablo: [MULTI_TENANT_NOTES.md](MULTI_TENANT_NOTES.md)). İstisna: Stripe hâlâ whitecross-site/functions (us-central1), Phase 5'e kadar. Bu bir migration regresyon dalgası yarattı (INC 2026-06-26).

## ADR-003 — Transactional email: tenant Gmail → Brevo
**Durum:** ✅ Accepted · **Tarih:** 2026-06-19

**Bağlam:** Booking confirmation/cancel/reschedule email'leri tenant Gmail'inden gidiyordu; spam'e düşüyor, multi-tenant'ta yönetilemiyordu.
**Karar:** Loyalty + zorunlu transactional email'ler Brevo üzerinden `noreply@salown.com`'dan. whitecross `FORCE_SALOWN_SENDER_TENANTS` ile Brevo'ya zorlandı. Her emailde GDPR unsubscribe.
**Alternatifler:** Tenant Gmail (deliverability kötü), diğer ESP'ler — Brevo seçildi.
**Sonuç:** `secrets:['BREVO_API_KEY']` gerektiren fonksiyonlar var (unutulursa sessiz kırılır, INC 2026-06-26). Detay: [EMAIL_ARCHITECTURE.md](EMAIL_ARCHITECTURE.md). Not: confirmation/cancel/reschedule tenant Gmail (nodemailer), loyalty Brevo — hibrit; CLAUDE §Email'e bak.

## ADR-004 — Ödeme = Stripe Connect + Checkout Session (Payment Link değil)
**Durum:** 🕓 Proposed (features.stripe KAPALI, future)

**Bağlam:** Salon başına ödeme politikası gerekli (kapalı / deposit / full / optional / pay-at-venue). Para tenant'a akmalı, platform'a değil.
**Karar:** **Stripe Connect Standard + Checkout Session**; sabit £ deposit; per-tenant policy. Payment Link yönü DEĞİL.
**Alternatifler:** Stripe Payment Link (per-tenant routing + policy esnekliği yok) — elendi.
**Sonuç:** Şu an kapalı; deposit flow INCOMPLETE (webhook/expiresAt yok — [KNOWN_QUIRKS.md](KNOWN_QUIRKS.md) §6). whitecross-site'ın mevcut Stripe akışına dokunulmaz. Detay: [STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md).

## ADR-005 — Salon-içi kart = Stripe Tap to Pay pilot
**Durum:** 🕓 Proposed

**Bağlam:** Salon-içi kart ödemesi isteniyor. Ucuz kart makineleri işlemciye **kilitli** (Stripe'a bağlanmaz), pahalı reader ($700) pilot için gereksiz.
**Karar:** Pilot = **Stripe Tap to Pay** (telefon = makine, $0 donanım; Capacitor gerektirir). Mod B: salon kendi makinesini kullanır, personel elle "ödendi £X tip £Y" işaretler.
**Alternatifler:** $700 reader (gereksiz maliyet), başka markaya otomatik bağlanma (mümkün değil, cihaz kilitli) — elendi. Multi-processor derin entegrasyon → scale'de.
**Sonuç:** Capacitor bağımlılığı var. Detay: [salown-app POS notları](../salown-app).

## ADR-006 — Silme = süper-admin only (pilot)
**Durum:** ✅ Accepted · **Tarih:** 2026-07-02

**Bağlam:** Pilotta veri kaybı/yetki eskalasyonu riski. Rol hiyerarşisi owner > admin > staff.
**Karar:** Bu aşamada **tüm silme işlemleri + staff atama SADECE super-admin** (`isSuperAdmin` claim). Owner'lar dahil herkes silme yetkisini kaybetti (pilot "Seçenek a"). İleride owner→admin tenant-scoped yetki gelecek.
**Alternatifler:** Owner'a silme bırakmak (pilotta riskli), delete butonlarını tamamen kaldırmak (ileride olacak) — şimdilik super-admin gate.
**Sonuç:** Rules (test 65/65) + UI (tüm delete butonları, Clients merge-drag, Settings Staff/Danger) `isSuperAdmin` arkasında. Detay: [SECURITY.md](SECURITY.md). İlgili invariant: INV-SEC-5.

## ADR-007 — Barber eşleşmesi exact, fuzzy yok, kaynakta düzelt
**Durum:** ✅ Accepted · **Tarih:** 2026-06-26

**Bağlam:** Aggregator'lar tam ad ("Arda Uzun"), sistem ilk ad ("Arda") tutuyor → eşleşmeyen booking grid'de kaybolur (INC 2026-06-26).
**Karar:** Matcher **exact case-insensitive** kalır (`barberKey()`); fuzzy/partial EKLENMEZ. Uyumsuzluk **kaynakta** (parser'da kanonik isme map) çözülür — ambiguity-safe first-name eşleşmesiyle.
**Alternatifler:** Matcher'a fuzzy eklemek — yanlış barber'a yazma riski, tüm sistemi belirsizleştirir; elendi ("wrong source name = fix the source").
**Sonuç:** `resolveBarberName()` parser'da. İlgili: INV-MATCH-1/2/3, [NORMALIZATION.md](NORMALIZATION.md).

## ADR-008 — Aggregator komisyonu = iki-defter muhasebe
**Durum:** ✅ Accepted · **Tarih:** 2026-06-26

**Bağlam:** Aggregator brüt fiyatı (£40) ≠ işletmeye giren net (Treatwell %35+VAT sonrası £23.20). Brüt=net varsayımı defterleri şişiriyordu (INC 2026-06-26).
**Karar:** Komisyon (`twFeeTotal`/`twNetPayout`) parser'da modellenir; Finance `platformFee()` ile **otomatik gider**; brüt görünür kalır, net/PL/bakiye düşer. Finance genelinde iki defter (operasyonel + sermaye).
**Alternatifler:** Brüt=net (yanlış), fee'yi elle girme (hata) — elendi.
**Sonuç:** İlgili: INV-PARA-5, [whitecross muhasebe](../salown-app).

## ADR-009 — Self-onboarding asla kapatılmaz
**Durum:** ✅ Accepted

**Bağlam:** "Vetted" (başvuru→onay) akışı düşünülüyor ama pilotta erişim serbest kalmalı.
**Karar:** `/signup` + `provisionTenant` **ASLA kapatılmaz/gate'lenmez** ("satmıyoruz, test ediyoruz"). Vetted akış (apply→review→approve) **EK** olur, yerine geçmez.
**Alternatifler:** Self-signup'ı kapatıp sadece vetted — test hızını öldürür, elendi.
**Sonuç:** İlgili: INV-MT-4, [early access flow](../salown-app).

## ADR-010 — Deploy güvenliği = predeploy build hook
**Durum:** ✅ Accepted · **Tarih:** 2026-06-29

**Bağlam:** `hosting/public-bundle` gitignored; build atlayan HER `firebase deploy` bundle'ı silip tüm SPA'yı 404'e düşürüyordu (INC 2026-06-29, haftalarca kesinti).
**Karar:** `firebase.json`'a her iki hosting site'ına **`predeploy` hook** (`npm run build` / `build:staff`) → deploy eden herkes (manuel/CI/worktree) önce build alır.
**Alternatifler:** Build artefaktını commit'lemek (repo şişer), sadece CI'ya güvenmek (ham deploy'lar CI'yı baypas ediyordu) — elendi.
**Sonuç:** Bundle yapısal olarak düşemez. Ek: post-deploy smoke test (INC 2026-06-29 curl bloğu). İlgili: INV-DEP-1/6.

## ADR-011 — salown-site silindi, tek hosting kaynağı
**Durum:** ✅ Accepted · **Tarih:** 2026-06-29

**Bağlam:** İki ayrı hosting kaynağı (salown-site + salown-app/hosting) sürüm ayrışması yaratıyordu.
**Karar:** `salown-site/` **SİLİNDİ**. Landing, public profile (`/s/**`), booking (`/book/**`) dahil HER ŞEY `salown-app/hosting`'den GitHub Actions ile deploy. Yedek: `salown-site-backup-20260629-1841.zip`.
**Alternatifler:** İki kaynağı senkron tutmak — sürekli ayrışıyordu, elendi.
**Sonuç:** Landing'in tek kaynağı `salown-app/hosting/index.html` (symlink kırık). İlgili: INV-DEP-5, [DEPLOY.md](DEPLOY.md).

## ADR-012 — docs = ayrı private repo (salown-docs)
**Durum:** ✅ Accepted · **Tarih:** 2026-07-02

**Bağlam:** `docs/` (proje beyni) hiçbir repo'da değildi → versiyonsuz, çok-session edit'te geri-alma yok, ileride kişi/makine paylaşımı imkânsız.
**Karar:** `docs/` kendi **private** `salown-docs` repo'su olur, **aynı `alex/docs/` yolunda** kalır.
**Alternatifler:** (a) salown-app içine taşımak — `../docs` referansları kırılır + cross-repo docs'u tek app'e hapseder; (b) alex kökünü repo yapmak — iç içe repo (nested git) karmaşası. İkisi de elendi.
**Sonuç:** Yol korunduğu için referanslar bozulmadı, app repo'larına dokunulmadı. `alex/CLAUDE.md` versiyonsuz kaldı (kökten okunur, taşımak otomatik-okumayı bozar). İlgili: [KNOWN_QUIRKS.md](KNOWN_QUIRKS.md) §5.

## ADR-013 — Incident kayıt standardı (8-alan template)
**Durum:** ✅ Accepted · **Tarih:** 2026-07-02

**Bağlam:** INCIDENTS.md zengin ama yapısızdı; Severity/Owner/Status yoktu → "resolved sanılan açık iş" ve tekrar eden bug'ları tanımak zordu.
**Karar:** Her olay standart metadata taşır: **Date · Severity · Impact · Root Cause · Resolution · Prevention · Owner · Status** + Dersler/Lessons Learned. Prevention'a mümkünse kalıcı guard/test. Tekrar = Status 🔴 Regressed.
**Alternatifler:** Serbest proza (mevcut) — tarama/eksik-iş görünürlüğü zayıf, elendi.
**Sonuç:** Şablon INCIDENTS.md başında; kural CLAUDE.md (alex + salown-app) + memory'de. İlgili: [INCIDENTS.md](INCIDENTS.md).

---

## Bakım
- Yeni önemli karar → yeni ADR (bir sonraki numara). Bağlam/Karar/Alternatifler/Sonuç doldur, İçindekiler tablosuna satır ekle.
- Bir kararın yerine yenisi geçince: eskiyi **silme** → ⛔ Superseded işaretle + yeni ADR'ye link ver.
- 🕓 Proposed bir karar uygulanınca → ✅ Accepted + tarih.
- Commit: `cd alex/docs && git commit DECISIONS.md && git push`.
