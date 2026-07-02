# Salown — Proje Dokümantasyonu (Beyin)

> **Bu repo (`salown-docs`) projenin hafızasıdır.** Kod değil — mimari, kararlar, kurallar, geçmiş kazalar ve yol haritası burada yaşar. Yeni katılan herkes (PM, mühendis, tasarımcı) **buradan başlar.**
>
> **Kod nerede:** `salown-app` (ana repo, `Salown.git`) · `super-admin` (`salownadmin.git`) · `whitecross-site` (`whitecross-site.git`). Bu docs onların hepsini kapsar → bilinçli olarak ayrı, cross-repo bir "beyin" repo'su ([DECISIONS.md](DECISIONS.md) ADR-012).

---

## 🎯 60 saniyede Salown

| | |
|---|---|
| **Ne** | Çoklu-salon (barber/kuaför) yönetimi için multi-tenant SaaS booking platformu |
| **Nasıl başladı** | Whitecross Barbers için özel sistem → bağımsız platforma evrildi |
| **Rakip / strateji** | Booksy · Fresha · Treatwell — onları **birleştirir** ("grabbing" felsefesi, [MANIFESTO.md](MANIFESTO.md)) |
| **Stack** | React (Vite, .jsx) · Firebase (Auth + Firestore + Functions, `havuz-44f70`, `europe-west2`) |
| **Veri modeli** | Tüm tenant verisi `tenants/{tenantId}/...` altında; `tenantId` Firebase custom claim'de |
| **Farklılaştırıcı** | Booksy/Fresha/Treatwell email'lerini tek ekranda birleştiren IMAP parser + Ask salOWN (AI) |
| **Canlı durum** | 👉 Tek kaynak: [ROADMAP.md](ROADMAP.md) (burada tekrarlanmaz — eskir) |

---

## 🚪 Yeni misin? Şu sırayla oku

**Product / PM isen (~30 dk):**
1. [MANIFESTO.md](MANIFESTO.md) — neden var, felsefe, hedef
2. [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) — parçalar nerede, repo haritası
3. [ROADMAP.md](ROADMAP.md) — ne bitti / sıradaki / blocker (**tek durum kaynağı**)
4. [DECISIONS.md](DECISIONS.md) — neden böyle yaptık (elenen alternatiflerle)
5. [INCIDENTS.md](INCIDENTS.md) — geçmişte ne patladı, ne öğrendik

**Mühendis isen (~60 dk):** yukarıdaki 1-2 + sonra
3. [FIRESTORE_SCHEMA.md](FIRESTORE_SCHEMA.md) — veri yapısı, booking model quirk'leri
4. [INVARIANTS.md](INVARIANTS.md) — **bozarsan sistem kırılır** (kod yazmadan ÖNCE)
5. [KNOWN_QUIRKS.md](KNOWN_QUIRKS.md) — tuhaf ama kasıtlı ("bug sanıp düzeltme")
6. [BUSINESS_RULES.md](BUSINESS_RULES.md) + [SECURITY.md](SECURITY.md) + [NORMALIZATION.md](NORMALIZATION.md)
7. Çalışacağın alanın detay dokümanı (aşağıdaki haritadan)

**Tasarımcı isen:** [MANIFESTO.md](MANIFESTO.md) → [SERVICE_EDITOR_DESIGN_BRIEF.md](SERVICE_EDITOR_DESIGN_BRIEF.md) → ilgili feature planı.

> 📖 **Bir terime takıldın mı?** ([GLOSSARY.md](GLOSSARY.md)) — tenant, Class A/B, walk-in, aggregator, squeeze-in, canary, SSOT, `pp()`, `toDateKey()`... hepsi tek satır açıklamayla orada. Okurken yanında açık tut.

---

## 🧠 Kayıt sistemi — 4 katmanlı hafıza

Projenin "neden/nasıl/ne oldu" bilgisi 4 dosyada, birbirine bağlı. Bir soru geldiğinde nereye bakacağını bil:

| Dosya | Cevapladığı soru | Ne zaman yazılır |
|-------|------------------|------------------|
| [INCIDENTS.md](INCIDENTS.md) | **"Ne patladı?"** — olay + kök neden + ders | Ciddi bir bug/kesinti çözülünce |
| [INVARIANTS.md](INVARIANTS.md) | **"Hep nasıl yapmalı?"** — bozulmaz kurallar | Bir incident kalıcı kural üretince |
| [KNOWN_QUIRKS.md](KNOWN_QUIRKS.md) | **"Buna neden dokunmamalı?"** — kasıtlı tuhaflıklar | Sezgiye aykırı ama doğru davranış bulununca |
| [DECISIONS.md](DECISIONS.md) | **"Neden böyle seçtik?"** — ADR + elenen yollar | Önemli mimari/ürün kararı alınınca |

**Akış:** `INCIDENTS (ne oldu) → INVARIANTS (kural) → QUIRKS (dokunma) → DECISIONS (neden)`. Dördü çapraz-linkli.

---

## 🗺️ Doküman haritası (34 dosya)

### 1. Oryantasyon
[MANIFESTO](MANIFESTO.md) · [SYSTEM_ARCHITECTURE](SYSTEM_ARCHITECTURE.md) · [GLOSSARY](GLOSSARY.md) (terim sözlüğü) · [TENANTS](TENANTS.md) (Whitecross/HeroHairs/EeKurt, Class A/B) · [PEOPLE](PEOPLE.md) (kişiler/roller/emailler)

### 2. Kurallar & Hafıza
[INVARIANTS](INVARIANTS.md) · [KNOWN_QUIRKS](KNOWN_QUIRKS.md) · [DECISIONS](DECISIONS.md) · [INCIDENTS](INCIDENTS.md)

### 3. Nasıl çalışır (domain kuralları)
[BUSINESS_RULES](BUSINESS_RULES.md) (cancel/reschedule/slot/deposit) · [FIRESTORE_SCHEMA](FIRESTORE_SCHEMA.md) · [NORMALIZATION](NORMALIZATION.md) (match/casing) · [EMAIL_ARCHITECTURE](EMAIL_ARCHITECTURE.md) (Brevo/GDPR) · [PARSER_NOTES](PARSER_NOTES.md) (Booksy/Fresha/Treatwell) · [FEATURE_FLAGS](FEATURE_FLAGS.md) · [MULTI_TENANT_NOTES](MULTI_TENANT_NOTES.md) (Class A/B guard'ları) · [SECURITY](SECURITY.md) (rules TEK KAYNAK)

### 4. Planlama & teşhis
[ROADMAP](ROADMAP.md) (**durum SSOT**) · [ARCHITECTURE_REVIEW_2026-07-02](ARCHITECTURE_REVIEW_2026-07-02.md) (dış-göz teşhis) · [TESTS](TESTS.md) (test kayıtları SSOT) · Tasarım/plan: [BUSY_SLOT_V2](BUSY_SLOT_V2.md) (+[RISKS](BUSY_SLOT_V2_RISKS.md)/[TESTPLAN](BUSY_SLOT_V2_TESTPLAN.md)) · [SERVICE_CONFIG_V2](SERVICE_CONFIG_V2.md) · [SERVICE_EDITOR_DESIGN_BRIEF](SERVICE_EDITOR_DESIGN_BRIEF.md) · [STRIPE_CONNECT_PLAN](STRIPE_CONNECT_PLAN.md) · [C5_LAPSED_DEDUP_PLAN](C5_LAPSED_DEDUP_PLAN.md)

### 5. Operasyon
[DEPLOY](DEPLOY.md) (build/deploy + güvenlik sırası) · [PROMPTS](PROMPTS.md) · `firestore.rules.{LIVE,DRAFT,PREV-*,ROLLBACK}` (canlı = **LIVE**) · `test-firestore-rules.py` (rules test suite)

---

## 📐 Kurallar & konvansiyonlar (herkes uyar)

**Durum kaynağı (SSOT):** Bir işin **güncel durumu** yalnız [ROADMAP.md](ROADMAP.md)'de yaşar. Detay dokümanları teknik içeriği tutar, durum rozetini DEĞİL. Durum rozetleri: ✅ Done · 🟡 Kısmen · 🔵 Sıradaki · 🟣 Vizyon · 🔴 Blocker.

**Yeni kayıt eklerken:**
- **Incident?** → [INCIDENTS.md](INCIDENTS.md) başındaki 8-alan şablonu (Severity/Owner/Status + Impact/Root Cause/Resolution/Prevention + Dersler).
- **Karar?** → [DECISIONS.md](DECISIONS.md) ADR formatı (Bağlam/Karar/Alternatifler/Sonuç).
- **Kural?** → [INVARIANTS.md](INVARIANTS.md); **kasıtlı tuhaflık?** → [KNOWN_QUIRKS.md](KNOWN_QUIRKS.md).
- **Yeni iş çıktı?** → [ROADMAP.md](ROADMAP.md)'e durum rozetiyle ekle (yoldan sapma; bkz roadmap disiplini).

**Bug teşhisine başlamadan ÖNCE:** [INCIDENTS.md](INCIDENTS.md)'de benzer olay ara — aynı kalıplar tekrar ediyor.

**Deploy'dan önce:** hedef tenant + URL'yi duyur, onay bekle. Sıra (güvenlik değişikliği): functions → hosting → rules EN SON. Detay: [DEPLOY.md](DEPLOY.md).

---

## ✍️ Bu docs repo'suna katkı

```bash
cd ~/Desktop/alex/docs        # = salown-docs (private)
# düzenle...
git pull                      # başka session güncellemiş olabilir (aktif, paylaşımlı repo)
git commit <dosya> -m "..."   # docs KENDİ repo'su → burada güvenli
git push
```
- **Docs repo'sunda** `git add` güvenli (kendi repo'su). Ama **app repo'larında** (salown-app vb.) SADECE kendi dosyanı explicit path ile commit et — asla `git add .` / `reset --hard` (başka session'ın işini siler).
- Yeni dosya eklersen bu README'nin **doküman haritasına** bir satır ekle.
- `alex/CLAUDE.md` (AI context index) versiyonsuz ve bu repo dışında — güncellemesi ayrı.

---

*Bu repo çoklu Claude session + founder tarafından ortak tutulur. Her session başında `git pull`, her anlamlı değişiklikten sonra `git push` — böylece hafıza tek ve güncel kalır.*
