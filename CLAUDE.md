<!--
  KANONİK KAYNAK. Bu dosya alex/CLAUDE.md üzerinden symlink ile tüketilir (Claude Code root context).
  Düzenlemeyi HER ZAMAN burada (docs/CLAUDE.md) yap → commit + push → her makinede güncel.
  İçindeki `docs/...` linkleri alex/ köküne göredir (symlink oradan çözülür); docs/ içinden doğrudan
  açarsan linkler bir dizin şaşar — bu kasıtlı, tüketim yeri alex/ köküdür.
  Yeni makine bootstrap: bkz docs/README.md → "Bootstrap".
-->
# Salown — AI Context Index

Multi-tenant SaaS barbershop booking platform. Firebase project `havuz-44f70` (europe-west2).
Tüm tenant verisi `tenants/{tenantId}/...` altında.

**Ana repo:** `salown-app/` (Vite + .jsx). Diğer klasörlere bkz: [SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md)

---

## Dokümantasyon

| Dosya | İçerik |
|-------|--------|
| [README.md](docs/README.md) | **GİRİŞ KAPISI** — yeni gelen (PM/mühendis/tasarımcı) buradan başlar: 60-sn özet, role göre okuma sırası, doküman haritası, kayıt sistemi |
| [GLOSSARY.md](docs/GLOSSARY.md) | Terim sözlüğü — tenant/Class A-B/walk-in/aggregator/squeeze-in/canary/SSOT/`pp()`/`toDateKey()`... jargonda takılınca bak |
| [MANIFESTO.md](docs/MANIFESTO.md) | Neden var, "grabbing" felsefesi, hedef |
| [SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) | Repo map, Firebase, stack, key files, DO NOT listesi |
| [TENANTS.md](docs/TENANTS.md) | Whitecross/HeroHairs/EeKurt detayları, Class A/B tanımı |
| [PEOPLE.md](docs/PEOPLE.md) | Kişiler, roller, emailler |
| [FIRESTORE_SCHEMA.md](docs/FIRESTORE_SCHEMA.md) | Veri yapısı, booking model quirk'leri, client identity |
| [BUSINESS_RULES.md](docs/BUSINESS_RULES.md) | Cancel/reschedule policy, slot generation, deposit flow |
| [BUSY_SLOT_V2.md](docs/BUSY_SLOT_V2.md) | TASARIM: processing-time / çok-aralıklı busy motoru + kanal mimarisi, test matrisi, fazlar |
| [SERVICE_CONFIG_V2.md](docs/SERVICE_CONFIG_V2.md) | TASARIM: detaylı servis config (Booksy+Fresha+Treatwell superset), segment dizisi modeli (service/processing/blocked), editör bölümleri |
| [SERVICE_EDITOR_DESIGN_BRIEF.md](docs/SERVICE_EDITOR_DESIGN_BRIEF.md) | Servis editörü REDESIGN brief'i (tasarımcıya): tüm alanlar, bölümler, wait/squeeze-in hero modülü, durumlar, marka token'ları, "sadece görsel" kuralı |
| [FEATURE_FLAGS.md](docs/FEATURE_FLAGS.md) | Flag listesi + ne yapıyor, loyalty/telegram config |
| [EMAIL_ARCHITECTURE.md](docs/EMAIL_ARCHITECTURE.md) | Brevo, "via Salown", GDPR unsubscribe, IMAP parser |
| [DEPLOY.md](docs/DEPLOY.md) | Build/deploy komutları, symlink, güvenlik sırası |
| [INCIDENTS.md](docs/INCIDENTS.md) | Geçmiş kazalar + çıkarılan dersler — **bug teşhisine başlamadan ÖNCE oku** (bkz Hızlı Kural #7) |
| [INVARIANTS.md](docs/INVARIANTS.md) | **Bozulursa sistem kırılır** — para/tarih/booking/eşleşme/güvenlik/deploy değişmezleri, kaynak atıflı; ilgili alana dokunmadan ÖNCE oku |
| [KNOWN_QUIRKS.md](docs/KNOWN_QUIRKS.md) | Tuhaf ama **kasıtlı** davranışlar — "bug sanıp düzeltme"; INVARIANTS/latent-bug farkı içeride |
| [DECISIONS.md](docs/DECISIONS.md) | **Neden böyle yaptık** (ADR): email/ödeme/POS/silme/repo kararları + gerekçe + elenen alternatifler |
| [PRINCIPLES.md](docs/PRINCIPLES.md) | **Cross-cutting mühendislik ilkeleri** (P1-P14): deploy discipline, SSOT, secrets=app-boundary, change discipline, safety; her ilke **Enforcement** satırıyla (✅ guard/test var / 🟡 prose-only). DECISIONS=tekil karar, PRINCIPLES=her yere uygulanan kural |
| [PARSER_NOTES.md](docs/PARSER_NOTES.md) | Booksy/Fresha/Treatwell parser mimarisi, dedup sistemi, tekrarlayan bug kalıpları |
| [STRIPE_CONNECT_PLAN.md](docs/STRIPE_CONNECT_PLAN.md) | TASARIM: Salown ödeme = Stripe Connect Standard + Checkout Session; sabit £ deposit; per-tenant policy; kapalı/future |
| [TIERS_AND_UPGRADE.md](docs/TIERS_AND_UPGRADE.md) | TASARIM: tier'lar (Free/Starter/Pro/Pro+) + tenant'ın **hesap-içi** plan yükseltmesi ("Anthropic gibi"); Faz 1 request→approve (tahsilatsız), Faz 2 Stripe **Billing** abonelik (Connect≠Billing), Pro+ = premium website+SEO; ROADMAP **Monetization** teması |
| [MIGRATION_PATTERNS.md](docs/MIGRATION_PATTERNS.md) | TS migration'da kanıtla keşfedilen 21 mühendislik kalıbı (bayt-nötr çözüm alfabesi, Kalıp 20 TS import-elision teşhis reçetesi, bayt-kanıt v2 yöntemi) — dilim çevirirken AÇIK TUT |
| [SECURITY.md](docs/SECURITY.md) | **Firestore rules & güvenlik TEK KAYNAK**: rules mimarisi, Phase 1 (done), açık gate'ler G1–G5 (kod karşı analiz + blast radius + fix), booking akış güvenliği |
| [STAFF_SETTINGS_AUDIT.md](docs/STAFF_SETTINGS_AUDIT.md) | Staff müsaitlik/ayar denetimi (2026-07-12): leave 5 yüzeyde 5 farklı davranış, Finance hayalet-maaş riski, hedef model (tek resolver) + uygulama sırası — ROADMAP G5 |
| [STAFF_MANAGEMENT_DESIGN.md](docs/STAFF_MANAGEMENT_DESIGN.md) | TASARIM: Staff Management & Compensation (ROADMAP **Employment Model** teması, S1-S3) — staffComp koleksiyonu, wage/commission/self-employed hesap kuralları, göç planı, Staff hub UI, 3 faz |
| [NORMALIZATION.md](docs/NORMALIZATION.md) | Tüm normalize/match/casing kuralları, helper tablosu, bilinen tutarsızlıklar |
| [MULTI_TENANT_NOTES.md](docs/MULTI_TENANT_NOTES.md) | Class A/B guard'ları, whitecross migration tablosu |
| [ROADMAP.md](docs/ROADMAP.md) | **Company roadmap** (2026-07-16 yeniden yapılandırıldı): önem-sıralı iş temaları + 5 etiket (✅/🔄/🔵 Planned/⏸ Waiting/💡 Future); aktif=tek-satır, tamamlananlar altta **Completed**'da; item ID'leri (A1/B3/C8/S1…) korundu |
| [TESTS.md](docs/TESTS.md) | **Tüm test kayıtları TEK KAYNAK**: rules (otomatik), güvenlik gate manuel, Stripe canlı, Staff App, Post-Class-A, busy-slot pointer |
| [PROMPTS.md](docs/PROMPTS.md) | Claude Code prompt template'leri |

---

## salown-app/CLAUDE.md

Teknik detaylar (booking model, conflict utils, reschedule invariant'ları, GDPR rules) orada.

---

## Hızlı Kurallar

1. **Deploy öncesi:** tenant + URL'yi söyle, onay bekle
2. **Yeni salown-app trigger:** self-managed tenant guard ekle (bkz: MULTI_TENANT_NOTES.md)
3. **Tarih:** `toDateKey()` kullan, asla `.toISOString().split('T')[0]`
4. **Bulk delete:** export → dry-run CSV → onay → write
5. **Feature flag:** tenant doc'tan oku, hardcode etme
6. **Fix:** tek bug, changed lines raporu, sonra diğerine geç
7. **Bug/incident:** Bir sorun (email gitmiyor, booking düşmüyor/görünmüyor, sayfa boş, 404, ödeme/confirmation) teşhisine başlamadan **ÖNCE [docs/INCIDENTS.md](docs/INCIDENTS.md)** oku — aynı kalıplar tekrar ediyor, kök neden + teşhis yöntemi muhtemelen orada. Çözülen ciddi olayı da oraya **standart şablonla** ekle: `## YYYY-MM-DD — başlık` + metadata satırı (**Severity** 🔴/🟠/🟡/🟢 · **Owner** · **Status** ✅/🟡/🔴) + **Impact/Root Cause/Resolution/Prevention** + **Dersler**. Şablon dosyanın başında; Prevention'a mümkünse kalıcı guard/test yaz. Aynı bug geri gelirse Status = 🔴 Regressed.
