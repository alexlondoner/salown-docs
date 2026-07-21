# PRINCIPLES.md — Engineering Principles (kurumsal mühendislik ilkeleri)

> **Bu dosya ne:** Zamanla incident'lardan, kararlardan ve tekrar eden hatalardan damıtılmış **cross-cutting mühendislik kuralları.** [DECISIONS.md](DECISIONS.md) (ADR) *tekil kararları* (neden email için Brevo), bu dosya *her yere uygulanan ilkeleri* tutar.
>
> **En önemli kural (meta-ilke):** *Bir prensip prose kaldıkça dekoratiftir.* Her ilke mümkünse bir **guard / test / hook / lint**'e gömülmeli. Aşağıda her ilkenin **Enforcement** satırı var: `✅ enforced` (mekanizma var) · `🟡 prose-only` (henüz sadece disiplin — aspirational, encode edilmeli). Yeni bir ilke eklerken hedef: 🟡'yi ✅'e taşımak.
>
> Kaynak: bu ilkeler [INCIDENTS.md](INCIDENTS.md) + [ROADMAP.md](ROADMAP.md) + memory'de dağınıktı; owner önerisiyle (2026-07-21) tek yere toplandı.

---

## 1. Deploy Discipline

**P1 — Targeted deploy, never blanket.**
Fonksiyon deploy'u her zaman codebase/hedef prefix'iyle (`functions:salown:X`, `functions:whitecross:Y`); asla çıplak `--only functions`.
- *Why:* çıplak deploy başka bölgedeki (us-central1) orphan'ları siler + alakasız fonksiyonları yeniden bağlar.
- *Source:* memory `functions_deploy_gotcha`; INCIDENTS 2026-07-21 (deploy-time secret rebind).
- *Enforcement:* 🟡 prose-only → **hedef:** pre-deploy wrapper script hedefsiz `--only functions`'ı reddetsin.

**P2 — Announce before deploy; confirm.**
Deploy öncesi tenant + URL söyle, onay bekle. İstisna: acil incident'ta owner "önce düzelt" derse uygula.
- *Source:* CLAUDE.md Hızlı Kural #1; memory `deploy_safety`.
- *Enforcement:* 🟡 prose-only (davranışsal).

**P3 — Post-deploy smoke on the money path.**
Ödeme/kritik fonksiyon deploy'undan sonra tek bir uçtan-uca teyit (ör. yeni booking `cs_live` session alıyor mu).
- *Why:* sessiz kredensiyel/binding hataları koddan görünmez; tek smoke check tüm zinciri yakalar.
- *Source:* INCIDENTS 2026-07-21 (canlı slotta test key, 17 gün gizli kaldı).
- *Enforcement:* 🟡 prose-only → **hedef:** deploy sonrası otomatik `cs_live` prefix kontrolü.

---

## 2. Data Integrity & SSOT

**P4 — One source of truth per concept.**
Her kavram (booking, normalize kuralı, slot üretimi, sourceColors) **tek** yerde tanımlanır; tüketen her yol oradan geçer.
- *Why:* iki ayrı kopya kaçınılmaz olarak ayrışır → saha-çelişkisi.
- *Source:* booking = SSOT (SYSTEM_ARCHITECTURE); `generateSlots` dış-scope refaktörü; `sourceColors.js`.
- *Enforcement:* 🟡 prose-only (code review).

**P5 — Never duplicate normalization.**
Add-on/status/isim/tarih normalizasyonu tek helper'dan (`normalizeSoldAddOns`, `barberKey()`, status uppercase, `toDateKey()`). İkinci bir yerel normalize YAZMA.
- *Why:* üç katmanın aynı yanlışı yapması = veri kaybı (ek servis düşmesi).
- *Source:* INCIDENTS 2026-07-18 (child→parent merge); memory `status_normalization`, `barber_name_matching`.
- *Enforcement:* ✅ `soldAddOns.test.ts` (7 regression) · 🟡 diğerleri prose-only.

**P6 — Dates: `toDateKey()`, asla `toISOString().split('T')[0]`.**
- *Why:* timezone kayması → yanlış günde booking.
- *Source:* CLAUDE.md Hızlı Kural #3; memory `firestore_rules_safety`.
- *Enforcement:* 🟡 prose-only → **hedef:** lint kuralı `toISOString().split` yasağı.

---

## 3. Secrets & Config

**P7 — Secrets belong to the application boundary, not the tenant boundary. No secret name is shared across two apps.**
❌ `STRIPE_SECRET_KEY` (paylaşılan) → ✅ `WC_STRIPE_SECRET_KEY` / `SALOWN_STRIPE_SECRET_KEY` / `ADMIN_STRIPE_SECRET_KEY`. Aynısı Brevo/Telegram/OpenAI/Google OAuth: app-prefix.
- *Why:* paylaşılan isim = bir app'in Stripe testi diğerinin canlı ödemesini sessizce ezer.
- *Source:* 🏛️ INCIDENTS 2026-07-21 (bu ilkenin doğduğu olay); ROADMAP P0 "Namespace all shared secrets before tenant #4".
- *Enforcement:* 🟡 prose-only → **hedef:** secret split (ROADMAP P0) + canlı slota `sk_test` yazmayı reddeden guard. *(Not: tenant'lar zaten secret tutmaz — Connect `acct_` modeli; sorun app-sınırında.)*

**P8 — Feature flags from tenant doc, before rollout.**
Flag'i tenant doc'tan oku (hardcode etme); yeni feature flag'in arkasında çıkar, canlı test edip aç.
- *Source:* CLAUDE.md Hızlı Kural #5; EXTRAS_ENABLED akışı; memory `feature_flags`.
- *Enforcement:* 🟡 prose-only.

---

## 4. Change Discipline

**P9 — One bug at a time; report changed lines; keep scope narrow.**
"Şunu düzelt" = tam onu düzelt; fırsatı bahset ama onaysız yayma.
- *Source:* CLAUDE.md #6; memory `keep_scope_narrow` (Finance yuvarlama → 27 dosya yanlışı).
- *Enforcement:* 🟡 prose-only.

**P10 — Every fix ships a regression test that pins the bug.**
- *Why:* aynı sınıf bug geri gelmesin; "bug'ı değil NEDEN'ini yok et".
- *Source:* memory `incidents_discipline`; `soldAddOns.test.ts`, rules test suite.
- *Enforcement:* ✅ rules suite (95/95) + `npm test` · 🟡 frontend geniş kapsamda değil.

**P11 — Check INCIDENTS.md before diagnosing.**
Bir problem (email gitmiyor, booking düşmüyor, 404, ödeme) teşhisine başlamadan önce INCIDENTS'e bak — kök neden + yöntem muhtemelen orada.
- *Source:* CLAUDE.md #7; memory `check_incidents_first`.
- *Enforcement:* 🟡 prose-only (session disiplini).

---

## 5. Safety & Isolation

**P12 — Best-effort side effects never break the main path.**
Bildirim/email/telemetri/loyalty yan-etkileri try/catch'le izole; ana akış (booking/ödeme) onlara bağlı düşmez.
- *Source:* confirmation email `sendBrevoEmail` try/catch; INCIDENTS 2026-07-04 (side-effect izolasyonu).
- *Enforcement:* 🟡 prose-only (kod deseni).

**P13 — Multi-session git isolation: explicit paths only.**
Tek repo/çok session — yalnız kendi dosyanı explicit path ile commit/deploy et; asla `git restore .`/`checkout .`/`reset --hard`/`add .`.
- *Why:* başkasının uncommitted işini siler.
- *Source:* memory `multi_session_git_isolation`.
- *Enforcement:* 🟡 prose-only.

**P14 — Destructive bulk ops: export → dry-run → confirm → write.**
- *Source:* CLAUDE.md #4.
- *Enforcement:* 🟡 prose-only.

---

## Nasıl büyür

- Yeni bir incident tekrar eden bir kalıba işaret ediyorsa → buraya bir ilke (veya mevcut ilkeye satır) ekle, **Source**'a incident'ı bağla.
- Her review'da bir 🟡'yi ✅'e taşımayı hedefle (prose → guard/test/hook). Süsleme değil, **canlı sistem** olması bununla ölçülür.
