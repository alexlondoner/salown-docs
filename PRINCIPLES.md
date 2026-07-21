# PRINCIPLES.md — Engineering Principles (kurumsal mühendislik ilkeleri)

> **Bu dosya ne:** Incident'lardan, kararlardan ve tekrar eden hatalardan damıtılmış **cross-cutting mühendislik kuralları.** Kardeş belgelerle görev ayrımı korunur (birbirinin kopyası OLMAZ):
>
> | Belge | Sorumluluğu |
> |---|---|
> | [DECISIONS.md](DECISIONS.md) | **Neden** bu yolu seçtik? (tekil ADR) |
> | [INCIDENTS.md](INCIDENTS.md) | **Ne kırıldı?** (postmortem) |
> | [INVARIANTS.md](INVARIANTS.md) | **Asla bozulmaması gerekenler** |
> | **PRINCIPLES.md** | **Nasıl mühendislik yapıyoruz?** (her yere uygulanan kural) |

> **Meta-ilke:** *Bir prensip prose kaldıkça dekoratiftir.* Ama her ilke otomatik enforce EDİLEMEZ — bu onu değersiz yapmaz. O yüzden her ilkenin bir **Type**'ı var:
> - **⚙️ Machine-enforceable** — guard/test/CI/lint'e gömülebilir. Bunlarda **Status:** `✅ enforced` veya `⏳ guard TODO`.
> - **🧠 Human discipline** — doğası gereği otomatikleşmez (ör. "owner'ın saha bilgisini dinle"). Prose kalması DOĞRU; okuyanın beklentisini doğru kurar.
>
> ⚠️ **"enforced sayısı"nı KPI yapma.** Amaç "14'ün 12'si enforced" değil; amaç ⚙️ olanların guard'a taşınması, 🧠 olanların net ifade edilmesi. İki kategori okuyucuya doğru beklentiyi verir — hepsi bu.

> Kaynak: bu ilkeler [INCIDENTS.md](INCIDENTS.md) + [ROADMAP.md](ROADMAP.md) + memory'de dağınıktı; owner önerisiyle (2026-07-21) tek yere toplandı.

---

## 1. Deploy Discipline

**P1 — Targeted deploy, never blanket.** Fonksiyon deploy'u codebase prefix'iyle (`functions:salown:X` / `functions:whitecross:Y`); asla çıplak `--only functions`.
- *Why:* çıplak deploy başka bölgedeki orphan'ları siler + alakasız fonksiyonları yeniden bağlar. · *Source:* memory `functions_deploy_gotcha`; INCIDENTS 2026-07-21.
- **Type:** ⚙️ Machine-enforceable — **Status:** ✅ `whitecross-site/scripts/deploy-functions.sh` (fonksiyon ismi zorunlu; `all`/`functions`/blanket reddedilir; test edildi).

**P2 — Announce before deploy; confirm.** Deploy öncesi tenant + URL, onay bekle (istisna: incident'ta owner "önce düzelt" derse).
- *Source:* CLAUDE.md #1; memory `deploy_safety`.
- **Type:** 🧠 Human discipline.

**P3 — Post-deploy smoke on the money path.** Ödeme/kritik fn deploy'undan sonra tek uçtan-uca teyit (yeni booking `cs_live` alıyor mu).
- *Why:* sessiz kredensiyel/binding hataları koddan görünmez. · *Source:* INCIDENTS 2026-07-21 (17 gün gizli kalan test key).
- **Type:** ⚙️ Machine-enforceable — **Status:** ✅ `whitecross-site/scripts/check-stripe-live-key.sh` (deploy öncesi/sonrası canlı slotun `sk_live` olduğunu doğrular; test key → deploy reddedilir).

---

## 2. Data Integrity & SSOT

**P4 — One source of truth per concept.** Her kavram (booking, normalize kuralı, slot üretimi, sourceColors) tek yerde; tüketen her yol oradan geçer.
- *Why:* iki kopya ayrışır → saha-çelişkisi. · *Source:* booking=SSOT; `generateSlots` dış-scope; `sourceColors.js`.
- **Type:** 🧠 Human discipline (code review).

**P5 — Never duplicate normalization.** Add-on/status/isim/tarih tek helper'dan (`normalizeSoldAddOns`, `barberKey()`, status uppercase, `toDateKey()`); ikinci yerel normalize YAZMA.
- *Why:* üç katmanın aynı yanlışı = veri kaybı. · *Source:* INCIDENTS 2026-07-18.
- **Type:** ⚙️ Machine-enforceable — **Status:** ✅ `soldAddOns.test.ts` (7 regression); ⏳ diğer helper'lar için lint/test genişletilebilir.

**P6 — Dates: `toDateKey()`, asla `toISOString().split('T')[0]`.**
- *Why:* timezone kayması → yanlış gün. · *Source:* CLAUDE.md #3.
- **Type:** ⚙️ Machine-enforceable — **Status:** ⏳ guard TODO: lint kuralı `toISOString().split` yasağı.

---

## 3. Secrets & Config

**P7 — Secrets belong to the application boundary, not the tenant boundary. No secret name shared across two apps.** ❌ `STRIPE_SECRET_KEY` → ✅ `WC_STRIPE_SECRET_KEY` / `SALOWN_STRIPE_SECRET_KEY` / `ADMIN_…`; aynısı Brevo/Telegram/OpenAI/Google OAuth.
- *Why:* paylaşılan isim = bir app'in Stripe testi diğerinin canlı ödemesini ezer. · *Source:* 🏛️ INCIDENTS 2026-07-21 (bu ilkenin doğduğu olay); ROADMAP P0. *(Tenant'lar zaten secret tutmaz — Connect `acct_` modeli; sorun app-sınırında.)*
- **Type:** ⚙️ Machine-enforceable — **Status:** ⏳ guard TODO: secret split (ROADMAP P0) + canlı slota `sk_test` yazmayı reddeden validator. (P3 guard'ı ara-kalkan sağlıyor.)

**P8 — Feature flags from tenant doc, before rollout.** Flag'i tenant doc'tan oku (hardcode etme); yeni feature flag arkasında çıkar, canlı test edip aç.
- *Source:* CLAUDE.md #5; `EXTRAS_ENABLED` akışı.
- **Type:** 🧠 Human discipline.

---

## 4. Change Discipline

**P9 — One bug at a time; report changed lines; keep scope narrow.** "Şunu düzelt" = tam onu; fırsatı bahset, onaysız yayma.
- *Source:* CLAUDE.md #6; memory `keep_scope_narrow`.
- **Type:** 🧠 Human discipline.

**P10 — Every fix ships a regression test that pins the bug.**
- *Why:* aynı sınıf bug geri gelmesin. · *Source:* memory `incidents_discipline`.
- **Type:** ⚙️ Machine-enforceable — **Status:** ✅ rules suite (95/95) + `npm test`; ⏳ PR template + CI check "değişen davranış için test?" (frontend geniş değil).

**P11 — Check INCIDENTS.md before diagnosing.**
- *Source:* CLAUDE.md #7; memory `check_incidents_first`.
- **Type:** 🧠 Human discipline.

---

## 5. Safety & Isolation

**P12 — Best-effort side effects never break the main path.** Bildirim/email/telemetri/loyalty try/catch'le izole; ana akış onlara bağlı düşmez.
- *Source:* confirmation email `sendBrevoEmail` try/catch.
- **Type:** 🧠 Human discipline (kod deseni).

**P13 — Multi-session git isolation: explicit paths only.** Yalnız kendi dosyanı explicit path ile; asla `git restore .`/`checkout .`/`reset --hard`/`add .`.
- *Why:* başkasının uncommitted işini siler. · *Source:* memory `multi_session_git_isolation`.
- **Type:** 🧠 Human discipline.

**P14 — Destructive bulk ops: export → dry-run → confirm → write.**
- *Source:* CLAUDE.md #4.
- **Type:** 🧠 Human discipline.

---

## Nasıl büyür

- Yeni incident tekrar eden kalıba işaret ediyorsa → buraya ilke ekle, **Source**'a incident'ı bağla.
- **Asıl iş prose değil, ⚙️ olanları guard'a taşımak.** Loop: `Incident → Root Cause → Principle → Roadmap → Automation/Guard → tekrar edemez`. 🧠 olanlar prose kalır — bu bir eksik değil, doğru sınıflandırma.
