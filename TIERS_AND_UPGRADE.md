# TIERS_AND_UPGRADE.md

> **TASARIM — kod yok (2026-07-18).** salOWN tier'ları (Free/Starter/Pro/Pro+) ve
> tenant'ın **kendi Settings'inden plan yükseltebilmesi** ("Anthropic gibi hesap içi upgrade").
> Bugünkü gerçek: tier'ı **yalnız super-admin** flag'le atıyor; tenant'ın talep/yükseltme yolu YOK.
> Bu belge o boşluğu kapatan akışı + arkasındaki billing mimarisini (vizyon) tanımlar.
>
> **İlgili:** [planLimits.ts](../salown-app/src/utils/planLimits.ts) (tek kaynak) ·
> [STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md) (Connect = **deposit**, bu belge = **abonelik**, KARIŞTIRMA) ·
> [FEATURE_FLAGS.md](FEATURE_FLAGS.md) · [ROADMAP.md](ROADMAP.md) › *Monetization & Self-Serve Upgrade*.

---

## Kilitlenen kararlar (2026-07-18)

1. **Backend = "request → approve" (şimdi), Stripe Billing = vizyon (sonra).** salOWN tenant'tan
   para **çekemiyor** (Stripe yalnız Connect/deposit + TEST modu; abonelik borusu YOK). Yükseltme UX'i
   Anthropic-benzeri hesap-içi olur, ama **Faz 1'de gerçek tahsilat yok**: tenant "Upgrade" der →
   `planRequest` yazılır → super-admin onaylar → flag flip + tenant bildirilir. Gerçek self-serve
   kart-ödemeli abonelik **Faz 2 vizyon** (aşağıda tam mimari).
2. **Pro+ = en üst paket, premium website + SEO dahil.** Pro+ "Let's talk" (custom) kalır;
   Pro'daki her şeyin üstüne **premium hosted website + custom domain + SEO + white-label email +
   öncelikli destek** ekler (whitecross paketi). Satış-destekli, uzun vadede bile talep/görüşme tabanlı.
3. **Public pricing site'ta AÇILMAZ (şimdilik).** Landing bilinçli olarak fiyat göstermiyor; model
   "Request a demo" (vetted early-access). Bu belge **hesap-içi** (Settings) upgrade'i tanımlar;
   public pricing sayfası ayrı ve sonraki iş (bkz §9). Self-signup (`/signup`+`provisionTenant`) korunur.
4. **Enforcement SOFT kalır** (para tahsilatı başlayana kadar). Cap aşımı engellemez, nudge gösterir;
   Faz 2 canlı ödeme gelince seçilmiş cap'ler soft→hard olabilir (bkz A1 stylist cap, ROADMAP).

---

## Mevcut durum (2026-07-18, kanıtlı)

| Konu | Gerçek | Kanıt |
|------|--------|-------|
| Tier tanımı (tek kaynak) | `free / starter / pro / proplus`; price + maxStylists + maxBookingsPerMonth + `features{}` allow-list | `planLimits.ts:40-74` |
| Enforcement | SOFT — cap aşımı işlemi geçirir, yalnız nudge | `planLimits.ts:6-9`, `Settings.tsx:210-224` |
| Plan atama | **Yalnız super-admin** — Tenants.jsx "Save plan" (`plan` + `trialEndsAt` yazar, audit log) | `super-admin/src/pages/Tenants.jsx:576-600` |
| Tenant self-serve | **YOK** — Settings sadece FeatureLock nudge + booking-usage bar gösteriyor | `Settings.tsx:214`, `Settings.tsx:954-988` |
| Tenant plan alanları | `plan` (casing tutarsız → `normalizePlan`), `status` ('trial'\|'active'), `trialEndsAt` (provision'da +90 gün) | `tenant.ts:79-83`, `functions/src/index.ts:172` (provisionTenant) |
| Per-tenant override | `limitsOverride` (super-admin bir tenant'a plan-dışı cap/feature verebilir; additive) | `planLimits.ts:92-105`, `tenant.ts:61-66` |
| Billing pipe | **YOK.** Stripe Connect var ama tenant→**müşteri** deposit'i içindir (`salownConnect*` / `salownCreateCheckoutSession`, `index.ts:3028-3443`). salOWN'un tenant'ı **abone olarak** ücretlendirmesi için ayrı bir merchant borusu gerekir. | `index.ts:3028-3443` |
| Public pricing | Landing fiyat göstermiyor; CTA "Request a demo"→`#waitlist`. `.pricing-grid` CSS'i artık ölü. Tier'lar yalnız `features.html`'de soft tag ("Free forever" / "Included in Pro"). | `hosting/index.html:373`, `hosting/features.html:148-154` |
| Roadmap izi | H3 kalanı "Billing sayfası (placeholder)" + A1 stylist cap (enforcement Faz 4) zaten listede | `ROADMAP.md:118`, `ROADMAP.md:93` |

**Özet:** tier motoru (limit/feature çözümleme) hazır ve doğru; eksik olan **(a)** tenant'ın plan talep
edebileceği hesap-içi yüzey, **(b)** talebi karşılayan operasyon (approve queue), **(c)** ileride gerçek
tahsilat borusu.

---

## Tier matrisi (kanonik)

> Kaynak `planLimits.ts`. Bu tablo insanların okuması için; **tek doğru = kod.** Yeni tier alanı
> önce `planLimits.ts` + `PlanFeatureFlags`'a, sonra buraya.

| | **Free** | **Starter** | **Pro** | **Pro+** |
|---|---|---|---|---|
| Fiyat | £0 | £29/ay | £69/ay | **Let's talk** (custom) |
| Stylist | 1 | 2 | ∞ | ∞ |
| Booking / ay | 50 | ∞ | ∞ | ∞ |
| Online booking sayfası + calendar sync + Staff App (PWA) | ✓ | ✓ | ✓ | ✓ |
| Stripe deposit (`stripe`) | — | ✓ | ✓ | ✓ |
| Cancel/reschedule policy (`cancelReschedule`) | — | ✓ | ✓ | ✓ |
| Booksy/Fresha/Treatwell parser (`parsers`) | — | ✓ | ✓ | ✓ |
| Loyalty (`loyalty`) | — | — | ✓ | ✓ |
| salOWN AI (`ai`) | — | — | ✓ | ✓ |
| White-label email (`whiteLabel`) | — | — | ✓ | ✓ |
| Custom domain (`customDomain`) | — | — | — | ✓ |
| **Premium website + SEO (`premiumWebsite`)** *(yeni, aşağıda)* | — | — | — | ✓ |
| Öncelikli destek & onboarding | — | — | — | ✓ |

### Pro+ premium website + SEO — ne kapsıyor

whitecross'un kullandığı paket. Bugün `customDomain: true` flag'i bunun **proxy**'si; net olsun diye
**`premiumWebsite`** feature key'i öneriyoruz (Pro+ = true), şunları temsil eder:

- **Hosted premium public site** (whitecross-site modeli / Premium Themes F1 drop-in tema) — custom domain'e bağlı.
- **SEO paketi:** schema.org markup, meta/OG etiketleri, performans, sitemap — [Premium Themes](ROADMAP.md) `F1` ile aynı aile.
- **White-label email** (`whiteLabel`, zaten Pro'dan itibaren) + marka renkleri.
- **Öncelikli destek + elle onboarding.**

> **Karar:** `premiumWebsite` = Pro+ paketinin bir parçası (add-on DEĞİL). Pro+ zaten "Let's talk"
> olduğundan premium site kurulumu (domain, tema, SEO) doğal olarak satış-destekli akışa oturur.
> Uygulama küçük: `PlanFeatureFlags`'a `premiumWebsite: boolean` ekle, proplus=true diğerleri=false;
> `customDomain` mevcut haliyle kalır (ikisi Pro+'ta birlikte true). Premium site teslimi kod değil
> operasyon (whitecross-site / F1 tema deploy'u).

---

## Hesap-içi upgrade akışı — UX (Anthropic modeli)

**Yeni Settings sekmesi: "Plan"** (mevcut tab dizisi `general/hours/members/integrations/notifications/staff/danger`,
`Settings.tsx:21-27` — araya `plan` eklenir). İçerik:

```
Settings ▸ Plan
┌───────────────────────────────────────────────┐
│  Şu anki plan:  Free · trial 42 gün kaldı      │  ← plan + status + trialEndsAt
│  Bu ay 38/50 booking ────────────░░░           │  ← mevcut usage bar (Settings.tsx:954) buraya taşınır
├───────────────────────────────────────────────┤
│  Free      Starter £29    Pro £69    Pro+       │  ← 4 tier kartı, mevcut = "Current" rozetli
│  [current] [Upgrade →]   [Upgrade →] [Talk →]   │
│            karşılaştırma tablosu (yukarıdaki matris)
└───────────────────────────────────────────────┘
```

- **"Upgrade →"** (Starter/Pro): onay modalı ("Starter'a geçmek istiyorsun — ekibimiz kısa sürede
  aktive edip e-posta atacak"). Onayla → `requestPlanChange` callable → `planRequests` doc yazılır +
  tenant'a "talep alındı" hali. Buton "Requested — pending review" durumuna geçer (çift-talep guard).
- **"Talk →"** (Pro+): custom olduğu için form/e-posta (mailto veya aynı `planRequests` doc'u
  `note` ile). Premium site kurulumu satış-destekli.
- **Downgrade:** ayrı, düşük-öncelikli link ("Plan değiştir / iptal") → yine `planRequests` (type:
  `downgrade`), efektif dönem-sonu (bkz §8).
- **Zaten Pro+ (pilot: whitecross/herohairs):** üst tier'da → sadece "You're on Pro+" gösterir,
  upgrade butonu yok (FeatureLock'un pilotları vurmama prensibiyle tutarlı, `planLimits.ts:8`).

**İlke:** UX self-serve *hissettirir* (tek tık, anında geri-bildirim), backend Faz 1'de request-queue.
Faz 2'de aynı butonlar Stripe Checkout'a bağlanınca UX değişmez, sadece "pending review" → "active" anında olur.

---

## Faz 1 — Request → Approve (şimdi build edilebilir, tahsilatsız)

### Veri modeli

`tenants/{tenantId}/planRequests/{requestId}` (tenant-scoped; tenant kendi talebini oluşturur/okur,
super-admin hepsini görür):

```
{
  fromPlan: 'free',                 // normalizePlan(tenant.plan)
  toPlan: 'pro',                    // hedef PlanKey
  type: 'upgrade' | 'downgrade',
  status: 'pending' | 'approved' | 'declined' | 'cancelled',
  note?: string,                    // Pro+ "Talk to us" mesajı
  requestedByUid, requestedByEmail,
  createdAt,
  decidedByUid?, decidedAt?, decisionNote?
}
```

> **Neden subcollection, root doc alanı değil:** root doc world-readable (memory `tenant-root-doc-public`).
> Talep meta'sı (email, not) orada durmamalı. Ayrıca "tek aktif pending talep" guard'ı doc-query ile temiz.

### Fonksiyonlar (yeni, `functions/src/index.ts` veya modül)

- **`requestPlanChange`** (onCall, self-managed tenant guard): auth'lu owner/admin çağırır. Doğrular
  (`toPlan` geçerli PlanKey, aktif pending yoksa), `planRequests` doc yazar, `auditLogs`'a
  `PLAN_CHANGE_REQUESTED`, super-admin'e bildirim (Telegram/panel). **Para YOK.**
- **`decidePlanChange`** (onCall, **super-admin only**): approve → `tenants/{id}` `plan` (+ gerekiyorsa
  `status:'active'`, trial temizle) yazar, request `status:'approved'`, tenant'a onay e-postası
  (`noreply@salown.com`), audit `PLAN_CHANGED`. Decline → `status:'declined'` + sebep, tenant bilgilendirilir.
  *(Bu, super-admin'in bugün elle yaptığı `savePlan`'in — Tenants.jsx:576 — talebe bağlanmış hali.)*

### Super-admin — Upgrade requests queue

super-admin app'e (`~/Desktop/alex/super-admin`) yeni görünüm / Tenants içine kart: **pending
`planRequests` listesi** (tüm tenant'lar; `collectionGroup('planRequests').where('status','==','pending')`).
Her satır: tenant · fromPlan→toPlan · not · [Approve] [Decline]. Approve = `decidePlanChange`.
Zaten var olan Plan&Trial editörü (Tenants.jsx:776) elle override için kalır.

### Bildirim & güvenlik

- **Bildirim:** talep→super-admin (Telegram `notifyTenant` platform kanalı / panel); karar→tenant e-posta.
- **Rules:** `planRequests` create = self-managed tenant owner/admin; update(`decide`) yalnızca server
  (callable, super-admin claim). Root `plan` alanına tenant **yazamaz** (zaten öyle olmalı — doğrula,
  memory `firestore-rules-safety`). En son deploy = rules.
- **Audit:** iki uçta da `auditLogs` (kim talep etti / kim karar verdi).

### Efor (kaba)
Frontend Settings "Plan" sekmesi (~yarım gün) + 2 callable (~yarım gün) + super-admin queue (~yarım gün)
+ rules + test. Riski düşük: canlı-gelir yolu yok, enforcement zaten soft.

---

## Faz 2 — Gerçek self-serve Stripe **Billing** (VİZYON)

> **⚠️ Connect'ten AYRI borudur.** Stripe **Connect** = tenant'ın *müşterisinden* deposit toplaması
> (whitecross-site + salownConnect*). Stripe **Billing** = **salOWN'un merchant olarak tenant'ı**
> aylık abonelikle ücretlendirmesi. Farklı Stripe ürünü, farklı webhook, farklı key olabilir. Karıştırma.

**Hedef akış (Anthropic'in yaptığı):**
1. Settings ▸ Plan ▸ "Upgrade to Pro" → **Stripe Checkout (subscription mode)** — Price ID: Pro £69/ay.
2. Kart çekilir → `checkout.session.completed` webhook → tenant `plan:'pro'`, `status:'active'`,
   `stripeCustomerId` + `stripeSubscriptionId` yazılır → **flag anında flip**, "pending review" yok.
3. Aylık invoice otomatik; `invoice.paid` → devam, `invoice.payment_failed` → dunning (aşağıda).
4. Downgrade/cancel → `customer.subscription.updated/deleted` → dönem-sonu efektif (bkz §8).

**Bileşenler:**
- Stripe **Products/Prices**: Starter/Pro için Price ID (aylık; ileride yıllık). Pro+ = custom → Billing
  değil, satış (invoice-based / manuel) kalabilir.
- **`createBillingCheckout`** (onCall): tenant için Stripe Customer bul/oluştur → subscription Checkout
  Session → URL döner. Settings butonu buraya bağlanır.
- **`billingWebhook`** (onRequest, imza doğrulamalı): subscription lifecycle → tenant `plan/status` +
  billing alanları. **Bu, plan'in yeni otoritesi olur** (super-admin override her zaman elle kalır).
- **`createBillingPortalSession`** (onCall): Stripe **Customer Portal** — tenant kartını/faturasını/iptalini
  kendi yönetir (Anthropic'in "Manage billing" linki). En az kod, en çok değer.
- Tenant alanları: `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`, `currentPeriodEnd`,
  `cancelAtPeriodEnd` — hepsi world-readable OLMAYAN yere (`settings/billing` subdoc; root'a sır/PII koyma).

**Ön koşullar:** owner kararı + salOWN'un kendi Stripe hesabı (platform merchant) + live keys. Connect
go-live'dan bağımsız planlanabilir ama aynı Stripe org altında netleştirilmeli.

---

## Faz 3 — Olgunlaşma (proration, invoice, dunning)

- **Proration:** ay ortası upgrade → Stripe otomatik orantılar (Billing default). Downgrade = dönem-sonu.
- **Invoice/receipt:** Customer Portal + `invoice.paid` e-postası (`noreply@salown.com` veya Stripe hosted invoice).
- **Dunning:** `payment_failed` → retry schedule + tenant uyarısı; N denemede başarısız → `status:'past_due'`
  → soft grace → downgrade/free. **Karar:** grace süresi + hangi feature'lar kesilir.
- **Enforcement soft→hard:** para alınınca seçilmiş cap'ler (stylist/booking) hard-gate olabilir
  (A1, ROADMAP). Bugün DEĞİL.

---

## Trial

`provisionTenant` bugün +90 gün trial (`trialEndsAt`) veriyor ama **trial bitişi hiçbir şey yapmıyor**
(dekoratif). Faz 1'de: Settings "Plan" trial kalan-gün rozetini gösterir + trial biterken upgrade nudge.
Faz 2'de: trial bitişi → ödeme yoksa Free'ye düş (veya Stripe trial→subscription). Trial politikası
(süre, bitişte ne olur) Faz 2 kararı.

---

## Public pricing (§9) — ayrı ve sonraki iş

Bugün landing fiyat göstermiyor (vetted "Request a demo"). Hesap-içi upgrade bunu değiştirmez. **Ne
zaman public pricing sayfası açılır:** self-serve tahsilat (Faz 2) canlıyken + tier'lar stabilken.
O zaman `.pricing-grid` CSS'i (zaten dosyada, `hosting/index.html:156-174`) canlandırılır veya `/pricing`
sayfası eklenir; matris §3'ten türetilir. Self-signup korunur (memory `keep-self-onboarding-active`).
**Şimdilik kapsam dışı** — bu belge hesap-içi upgrade'e odaklı.

---

## Downgrade & iptal semantiği

- **Downgrade** (Pro→Starter/Free): efektif **dönem-sonu** (ödenen ay yanmaz). Faz 1'de `planRequests`
  type:`downgrade` + super-admin uygular; Faz 2'de `cancelAtPeriodEnd`.
- **Cap'in altına düşme:** ör. Pro→Starter'da 5 stylist varken cap 2. Enforcement soft → mevcut kayıtlar
  silinmez, yeni ekleme nudge'lanır. Hard-gate'e geçilirse "fazlalık" politikası ayrıca kararlaştırılır.
- **Feature kaybı:** loyalty/AI/parser kapanır ama **veri korunur** (ör. loyalty puanları silinmez, sadece
  yeni kazanım durur). GDPR/veri-koruma prensibi.

---

## Açık sorular (owner kararı bekler)

1. **Fiyatlar kesin mi?** Starter £29 / Pro £69 planLimits'te; yıllık indirim olacak mı? Pro+ taban fiyat aralığı?
2. **Faz 1 approve → e-posta şablonu:** onboarding-benzeri mi, sade mi?
3. **Trial politikası:** 90 gün doğru mu; bitişte Free'ye mi düşer, yoksa ödeme zorunlu mu?
4. **Pro+ premium site kapsamı sabitlensin:** hangi SEO işleri "dahil", hangileri ekstra?
5. **Faz 2 zamanlaması:** Connect go-live'dan önce mi sonra mı; aynı Stripe hesabı mı?

---

## Faz sırası (özet)

| Faz | İçerik | Tahsilat | Durum |
|-----|--------|----------|-------|
| **1** | Settings "Plan" sekmesi + `requestPlanChange`/`decidePlanChange` + super-admin queue + `premiumWebsite` flag | ❌ (request→approve) | 🔵 Planned |
| **2** | Stripe **Billing** self-serve (Checkout subscription + Customer Portal + webhook) | ✅ gerçek kart | 💡 Vision |
| **3** | Proration / invoice / dunning / soft→hard enforcement | ✅ | 💡 Vision |
| **9** | Public pricing sayfası (landing) | — | 💡 Future |

**Öneri:** Faz 1'i ayrı bir odak-günde build et (Settings + 2 callable + queue, canlı-gelir riski yok).
Faz 2 owner'ın "para almaya başlıyoruz" kararına ve live keys'e bağlı — Connect go-live ile birlikte planla.
