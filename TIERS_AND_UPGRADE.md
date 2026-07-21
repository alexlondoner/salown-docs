# TIERS_AND_UPGRADE.md

> **DESIGN — no code (2026-07-18).** salOWN tiers (Free/Starter/Pro/Pro+) and
> the tenant being able to **upgrade their plan from their own Settings** ("in-account upgrade like Anthropic").
> Today's reality: the tier is set **only by super-admin** via flag; the tenant has NO request/upgrade path.
> This document defines the flow that closes that gap + the billing architecture behind it (vision).
>
> **Related:** [planLimits.ts](../salown-app/src/utils/planLimits.ts) (single source) ·
> [STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md) (Connect = **deposit**, this document = **subscription**, DON'T CONFUSE) ·
> [FEATURE_FLAGS.md](FEATURE_FLAGS.md) · [ROADMAP.md](ROADMAP.md) › *Monetization & Self-Serve Upgrade*.

---

## Locked decisions (2026-07-18)

1. **Backend = "request → approve" (now), Stripe Billing = vision (later).** salOWN **can't** charge
   money from the tenant (Stripe is only Connect/deposit + TEST mode; there's NO subscription pipe). The upgrade UX
   is Anthropic-like in-account, but **in Phase 1 there's no real collection**: tenant says "Upgrade" →
   `planRequest` is written → super-admin approves → flag flip + tenant is notified. Real self-serve
   card-payment subscription is **Phase 2 vision** (full architecture below).
2. **Pro+ = top package, includes premium website + SEO.** Pro+ stays "Let's talk" (custom);
   on top of everything in Pro it adds **premium hosted website + custom domain + SEO + white-label email +
   priority support** (the whitecross package). Sales-assisted, request/conversation-based even in the long run.
3. **NOT exposed on the public pricing site (for now).** The landing deliberately doesn't show prices; the model is
   "Request a demo" (vetted early-access). This document defines the **in-account** (Settings) upgrade;
   the public pricing page is separate and later work (see §9). Self-signup (`/signup`+`provisionTenant`) is preserved.
4. **Enforcement stays SOFT** (until money collection begins). Cap overage doesn't block, shows a nudge;
   once Phase 2 live payment arrives, selected caps may go soft→hard (see A1 stylist cap, ROADMAP).

---

## Current state (2026-07-18, evidenced)

| Topic | Reality | Evidence |
|------|--------|-------|
| Tier definition (single source) | `free / starter / pro / proplus`; price + maxStylists + maxBookingsPerMonth + `features{}` allow-list | `planLimits.ts:40-74` |
| Enforcement | SOFT — cap overage lets the operation through, just a nudge | `planLimits.ts:6-9`, `Settings.tsx:210-224` |
| Plan assignment | **Only super-admin** — Tenants.jsx "Save plan" (writes `plan` + `trialEndsAt`, audit log) | `super-admin/src/pages/Tenants.jsx:576-600` |
| Tenant self-serve | **NONE** — Settings only shows a FeatureLock nudge + booking-usage bar | `Settings.tsx:214`, `Settings.tsx:954-988` |
| Tenant plan fields | `plan` (casing inconsistent → `normalizePlan`), `status` ('trial'\|'active'), `trialEndsAt` (+90 days at provision) | `tenant.ts:79-83`, `functions/src/index.ts:172` (provisionTenant) |
| Per-tenant override | `limitsOverride` (super-admin can give a tenant an off-plan cap/feature; additive) | `planLimits.ts:92-105`, `tenant.ts:61-66` |
| Billing pipe | **NONE.** Stripe Connect exists but is for the tenant→**customer** deposit (`salownConnect*` / `salownCreateCheckoutSession`, `index.ts:3028-3443`). For salOWN to charge the tenant **as a subscriber**, a separate merchant pipe is needed. | `index.ts:3028-3443` |
| Public pricing | Landing doesn't show prices; CTA is "Request a demo"→`#waitlist`. The `.pricing-grid` CSS is now dead. Tiers only as a soft tag in `features.html` ("Free forever" / "Included in Pro"). | `hosting/index.html:373`, `hosting/features.html:148-154` |
| Roadmap trace | H3 remainder "Billing page (placeholder)" + A1 stylist cap (enforcement Phase 4) already in the list | `ROADMAP.md:118`, `ROADMAP.md:93` |

**Summary:** the tier engine (limit/feature resolution) is ready and correct; what's missing is **(a)** an in-account surface where the tenant can request a plan,
**(b)** the operation that fulfills the request (approve queue), **(c)** later a real collection pipe.

---

## Tier matrix (canonical)

> Source `planLimits.ts`. This table is for humans to read; **the single truth = code.** A new tier field
> goes to `planLimits.ts` + `PlanFeatureFlags` first, then here.

| | **Free** | **Starter** | **Pro** | **Pro+** |
|---|---|---|---|---|
| Price | £0 | £29/mo | £69/mo | **Let's talk** (custom) |
| Stylists | 1 | 2 | ∞ | ∞ |
| Bookings / mo | 50 | ∞ | ∞ | ∞ |
| Online booking page + calendar sync + Staff App (PWA) | ✓ | ✓ | ✓ | ✓ |
| Stripe deposit (`stripe`) | — | ✓ | ✓ | ✓ |
| Cancel/reschedule policy (`cancelReschedule`) | — | ✓ | ✓ | ✓ |
| Booksy/Fresha/Treatwell parser (`parsers`) | — | ✓ | ✓ | ✓ |
| Loyalty (`loyalty`) | — | — | ✓ | ✓ |
| salOWN AI (`ai`) | — | — | ✓ | ✓ |
| White-label email (`whiteLabel`) | — | — | ✓ | ✓ |
| Custom domain (`customDomain`) | — | — | — | ✓ |
| **Premium website + SEO (`premiumWebsite`)** *(new, below)* | — | — | — | ✓ |
| Priority support & onboarding | — | — | — | ✓ |

### Pro+ premium website + SEO — what it covers

The package whitecross uses. Today `customDomain: true` flag is its **proxy**; for clarity we
propose a **`premiumWebsite`** feature key (Pro+ = true), which represents:

- **Hosted premium public site** (whitecross-site model / Premium Themes F1 drop-in theme) — bound to a custom domain.
- **SEO package:** schema.org markup, meta/OG tags, performance, sitemap — same family as [Premium Themes](ROADMAP.md) `F1`.
- **White-label email** (`whiteLabel`, already from Pro onward) + brand colors.
- **Priority support + manual onboarding.**

> **Decision:** `premiumWebsite` = part of the Pro+ package (NOT an add-on). Since Pro+ is already "Let's talk",
> premium site setup (domain, theme, SEO) naturally sits in the sales-assisted flow.
> Implementation is small: add `premiumWebsite: boolean` to `PlanFeatureFlags`, proplus=true others=false;
> `customDomain` stays as-is (both true together on Pro+). Premium site delivery is not code but
> operation (whitecross-site / F1 theme deploy).

---

## In-account upgrade flow — UX (Anthropic model)

**New Settings tab: "Plan"** (current tab sequence `general/hours/members/integrations/notifications/staff/danger`,
`Settings.tsx:21-27` — `plan` is inserted in between). Content:

```
Settings ▸ Plan
┌───────────────────────────────────────────────┐
│  Current plan:  Free · trial 42 days left      │  ← plan + status + trialEndsAt
│  This month 38/50 bookings ──────────░░░       │  ← existing usage bar (Settings.tsx:954) moved here
├───────────────────────────────────────────────┤
│  Free      Starter £29    Pro £69    Pro+       │  ← 4 tier cards, current = "Current" badged
│  [current] [Upgrade →]   [Upgrade →] [Talk →]   │
│            comparison table (the matrix above)
└───────────────────────────────────────────────┘
```

- **"Upgrade →"** (Starter/Pro): confirmation modal ("You want to move to Starter — our team will
  activate it shortly and send an email"). Confirm → `requestPlanChange` callable → `planRequests` doc written +
  tenant is in "request received" state. Button transitions to "Requested — pending review" state (double-request guard).
- **"Talk →"** (Pro+): since it's custom, a form/email (mailto or the same `planRequests` doc
  with `note`). Premium site setup is sales-assisted.
- **Downgrade:** separate, low-priority link ("Change plan / cancel") → again `planRequests` (type:
  `downgrade`), effective at period-end (see §8).
- **Already Pro+ (pilots: whitecross/herohairs):** on the top tier → just shows "You're on Pro+",
  no upgrade button (consistent with FeatureLock's principle of not hitting pilots, `planLimits.ts:8`).

**Principle:** the UX *feels* self-serve (one click, instant feedback), the backend is a request-queue in Phase 1.
In Phase 2, when the same buttons connect to Stripe Checkout, the UX doesn't change, only "pending review" → "active" becomes instant.

---

## Phase 1 — Request → Approve (buildable now, no collection)

### Data model

`tenants/{tenantId}/planRequests/{requestId}` (tenant-scoped; tenant creates/reads its own request,
super-admin sees all):

```
{
  fromPlan: 'free',                 // normalizePlan(tenant.plan)
  toPlan: 'pro',                    // target PlanKey
  type: 'upgrade' | 'downgrade',
  status: 'pending' | 'approved' | 'declined' | 'cancelled',
  note?: string,                    // Pro+ "Talk to us" message
  requestedByUid, requestedByEmail,
  createdAt,
  decidedByUid?, decidedAt?, decisionNote?
}
```

> **Why a subcollection, not a root doc field:** the root doc is world-readable (memory `tenant-root-doc-public`).
> Request meta (email, note) shouldn't sit there. Also the "single active pending request" guard is clean with a doc-query.

### Functions (new, `functions/src/index.ts` or a module)

- **`requestPlanChange`** (onCall, self-managed tenant guard): called by an authenticated owner/admin. Validates
  (`toPlan` is a valid PlanKey, no active pending), writes a `planRequests` doc,
  `PLAN_CHANGE_REQUESTED` to `auditLogs`, notification to super-admin (Telegram/panel). **NO money.**
- **`decidePlanChange`** (onCall, **super-admin only**): approve → writes `tenants/{id}` `plan` (+ if needed
  `status:'active'`, clear trial), request `status:'approved'`, approval email to tenant
  (`noreply@salown.com`), audit `PLAN_CHANGED`. Decline → `status:'declined'` + reason, tenant is notified.
  *(This is the request-bound version of the `savePlan` the super-admin does manually today — Tenants.jsx:576.)*

### Super-admin — Upgrade requests queue

New view in the super-admin app (`~/Desktop/alex/super-admin`) / a card inside Tenants: **pending
`planRequests` list** (all tenants; `collectionGroup('planRequests').where('status','==','pending')`).
Each row: tenant · fromPlan→toPlan · note · [Approve] [Decline]. Approve = `decidePlanChange`.
The existing Plan&Trial editor (Tenants.jsx:776) stays for manual override.

### Notification & security

- **Notification:** request→super-admin (Telegram `notifyTenant` platform channel / panel); decision→tenant email.
- **Rules:** `planRequests` create = self-managed tenant owner/admin; update(`decide`) only server
  (callable, super-admin claim). The tenant **cannot write** to the root `plan` field (it should already be so — verify,
  memory `firestore-rules-safety`). Latest deploy = rules.
- **Audit:** `auditLogs` at both ends (who requested / who decided).

### Effort (rough)
Frontend Settings "Plan" tab (~half a day) + 2 callables (~half a day) + super-admin queue (~half a day)
+ rules + test. Low risk: no live-revenue path, enforcement is already soft.

---

## Phase 2 — Real self-serve Stripe **Billing** (VISION)

> **⚠️ It's a SEPARATE pipe from Connect.** Stripe **Connect** = the tenant collecting a deposit *from its customer*
> (whitecross-site + salownConnect*). Stripe **Billing** = **salOWN, as merchant, charging the tenant**
> a monthly subscription. Different Stripe product, different webhook, possibly a different key. Don't confuse.

**Target flow (what Anthropic does):**
1. Settings ▸ Plan ▸ "Upgrade to Pro" → **Stripe Checkout (subscription mode)** — Price ID: Pro £69/mo.
2. Card is charged → `checkout.session.completed` webhook → tenant `plan:'pro'`, `status:'active'`,
   `stripeCustomerId` + `stripeSubscriptionId` written → **flag flips instantly**, no "pending review".
3. Monthly invoice automatic; `invoice.paid` → continue, `invoice.payment_failed` → dunning (below).
4. Downgrade/cancel → `customer.subscription.updated/deleted` → effective at period-end (see §8).

**Components:**
- Stripe **Products/Prices**: Price ID for Starter/Pro (monthly; yearly later). Pro+ = custom → not Billing
  but sales (invoice-based / manual) may stay.
- **`createBillingCheckout`** (onCall): find/create a Stripe Customer for the tenant → subscription Checkout
  Session → returns URL. The Settings button connects here.
- **`billingWebhook`** (onRequest, signature-verified): subscription lifecycle → tenant `plan/status` +
  billing fields. **This becomes the new authority for plan** (super-admin override always stays manual).
- **`createBillingPortalSession`** (onCall): Stripe **Customer Portal** — the tenant manages its own card/invoice/cancellation
  (Anthropic's "Manage billing" link). Least code, most value.
- Tenant fields: `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`, `currentPeriodEnd`,
  `cancelAtPeriodEnd` — all in a place that is NOT world-readable (`settings/billing` subdoc; don't put secret/PII in root).

**Preconditions:** owner decision + salOWN's own Stripe account (platform merchant) + live keys. Can be planned
independently of Connect go-live but should be clarified under the same Stripe org.

---

## Phase 3 — Maturation (proration, invoice, dunning)

- **Proration:** mid-month upgrade → Stripe prorates automatically (Billing default). Downgrade = period-end.
- **Invoice/receipt:** Customer Portal + `invoice.paid` email (`noreply@salown.com` or Stripe hosted invoice).
- **Dunning:** `payment_failed` → retry schedule + tenant warning; failed after N attempts → `status:'past_due'`
  → soft grace → downgrade/free. **Decision:** grace duration + which features are cut.
- **Enforcement soft→hard:** once money is taken, selected caps (stylist/booking) may become hard-gate
  (A1, ROADMAP). NOT today.

---

## Trial

`provisionTenant` today gives a +90 day trial (`trialEndsAt`) but **trial end does nothing**
(decorative). In Phase 1: Settings "Plan" shows the trial days-left badge + an upgrade nudge as the trial ends.
In Phase 2: trial end → if no payment, drop to Free (or Stripe trial→subscription). Trial policy
(duration, what happens at end) is a Phase 2 decision.

---

## Public pricing (§9) — separate and later work

Today the landing doesn't show prices (vetted "Request a demo"). In-account upgrade doesn't change this. **When
the public pricing page opens:** when self-serve collection (Phase 2) is live + tiers are stable.
Then the `.pricing-grid` CSS (already in the file, `hosting/index.html:156-174`) is revived or a `/pricing`
page is added; the matrix is derived from §3. Self-signup is preserved (memory `keep-self-onboarding-active`).
**Out of scope for now** — this document is focused on in-account upgrade.

---

## Downgrade & cancellation semantics

- **Downgrade** (Pro→Starter/Free): effective at **period-end** (the paid month isn't burned). In Phase 1 `planRequests`
  type:`downgrade` + super-admin applies; in Phase 2 `cancelAtPeriodEnd`.
- **Dropping below the cap:** e.g. on Pro→Starter with 5 stylists while the cap is 2. Enforcement soft → existing records
  aren't deleted, new additions are nudged. If switched to hard-gate, the "excess" policy is decided separately.
- **Feature loss:** loyalty/AI/parser turn off but **data is preserved** (e.g. loyalty points aren't deleted, only
  new earning stops). GDPR/data-protection principle.

---

## Open questions (awaiting owner decision)

1. **Are prices final?** Starter £29 / Pro £69 in planLimits; will there be a yearly discount? Pro+ base price range?
2. **Phase 1 approve → email template:** onboarding-like, or plain?
3. **Trial policy:** is 90 days right; at end does it drop to Free, or is payment mandatory?
4. **Fix the Pro+ premium site scope:** which SEO work is "included", which is extra?
5. **Phase 2 timing:** before or after Connect go-live; same Stripe account?

---

## Phase order (summary)

| Phase | Content | Collection | Status |
|-----|--------|----------|-------|
| **1** | Settings "Plan" tab + `requestPlanChange`/`decidePlanChange` + super-admin queue + `premiumWebsite` flag | ❌ (request→approve) | 🔵 Planned |
| **2** | Stripe **Billing** self-serve (Checkout subscription + Customer Portal + webhook) | ✅ real card | 💡 Vision |
| **3** | Proration / invoice / dunning / soft→hard enforcement | ✅ | 💡 Vision |
| **9** | Public pricing page (landing) | — | 💡 Future |

**Recommendation:** build Phase 1 on a separate focus-day (Settings + 2 callables + queue, no live-revenue risk).
Phase 2 depends on the owner's "we're starting to take money" decision and live keys — plan it together with Connect go-live.
