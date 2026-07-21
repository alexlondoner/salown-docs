# DECISIONS.md — why we did it this way (ADR)

> **What this file is:** Architecture/product decisions and their **rationale** (Architecture Decision Records). The "so that when you ask '6 months from now, why Brevo? why not Payment Link?', the answer is here" file.
>
> **How to use it:** Before changing an established decision, read its record here — see which alternatives have already been ruled out, which pain has already been lived through. When you make a new significant decision, **add a new ADR** (don't delete the old one; mark it "Superseded").
>
> **Related:** rules → [INVARIANTS.md](INVARIANTS.md) · deliberate oddities → [KNOWN_QUIRKS.md](KNOWN_QUIRKS.md) · accidents → [INCIDENTS.md](INCIDENTS.md) · architecture → [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md).

**Status badges:** ✅ Accepted (in effect) · 🕓 Proposed (design, not yet implemented) · ⛔ Superseded (replaced by another decision) · 🧊 Deferred (postponed).
**Format:** each ADR = Context (why the decision was needed) → Decision → Alternatives (why not those) → Outcome.

---

## Table of Contents
| # | Decision | Status | Date |
|---|-------|-------|-------|
| [ADR-001](#adr-001--main-repo-salown-panel-cra--salown-app-vite) | Main repo salown-panel (CRA) → salown-app (Vite) | ✅ | — |
| [ADR-002](#adr-002--whitecross--not-a-separate-product-a-salown-premium-tenant) | Whitecross = not a separate product, a salOWN tenant | ✅ | 2026-06-19 |
| [ADR-003](#adr-003--transactional-email-tenant-gmail--brevo) | Transactional email: Gmail → Brevo | ✅ | 2026-06-19 |
| [ADR-004](#adr-004--payment--stripe-connect--checkout-session-not-payment-link) | Payment = Stripe Connect + Checkout Session | 🕓 | — |
| [ADR-005](#adr-005--in-salon-card--stripe-tap-to-pay-pilot) | In-salon card = Stripe Tap to Pay pilot | 🕓 | — |
| [ADR-006](#adr-006--deletion--super-admin-only-pilot) | Deletion = super-admin only (pilot) | ✅ | 2026-07-02 |
| [ADR-007](#adr-007--barber-matching-exact-no-fuzzy-fix-at-the-source) | Barber matching exact, no fuzzy | ✅ | 2026-06-26 |
| [ADR-008](#adr-008--aggregator-commission--two-ledger-accounting) | Aggregator commission = two-ledger accounting | ✅ | 2026-06-26 |
| [ADR-009](#adr-009--self-onboarding-is-never-turned-off) | Self-onboarding is never turned off | ✅ | — |
| [ADR-010](#adr-010--deploy-safety--predeploy-build-hook) | Deploy safety = predeploy build hook | ✅ | 2026-06-29 |
| [ADR-011](#adr-011--salown-site-deleted-single-hosting-source) | salown-site deleted, single hosting source | ✅ | 2026-06-29 |
| [ADR-012](#adr-012--docs--separate-private-repo-salown-docs) | docs = separate private repo (salown-docs) | ✅ | 2026-07-02 |
| [ADR-013](#adr-013--incident-record-standard-8-field-template) | Incident record standard (8-field template) | ✅ | 2026-07-02 |
| [ADR-014](#adr-014--ask-salown--claude-haiku-45) | Ask salOWN = Claude Haiku 4.5 | ✅ | — |
| [ADR-015](#adr-015--parser-mail-intake--parse-inbox-hybrid--per-tenant-token-isolation) | Parser mail intake = parse-inbox hybrid + per-tenant token isolation | ✅ | 2026-07-03 |
| [ADR-016](#adr-016--marketplace-ranking--outcome-based-trust-score-not-activity) | Marketplace ranking = outcome-based Trust Score, not activity | 🕓 | 2026-07-12 |

---

## ADR-001 — Main repo: salown-panel (CRA) → salown-app (Vite)
**Status:** ✅ Accepted

**Context:** The first panel was written with `salown-panel` CRA (.js). New development needed a faster build/dev experience.
**Decision:** All new work under `salown-app` (Vite + .jsx). `salown-panel` is legacy, being retired gradually.
**Alternatives:** Staying on CRA (slow, poorly maintained) — ruled out.
**Outcome:** MAIN ACTIVE REPO = salown-app. No features added to salown-panel. Details: [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md).

## ADR-002 — Whitecross = not a separate product, a salOWN premium tenant
**Status:** ✅ Accepted · **Date:** 2026-06-19 (migration completed)

**Context:** whitecross-site was a separate system with its own functions/email/booking. When salOWN went multi-tenant, a duplication arose.
**Decision:** Whitecross is salOWN's **premium tenant** (custom domain whitecrossbarbers.com is a premium feature). UI changes are made in salown-app; barber-panel/barber-mobile are LEGACY.
**Alternatives:** Continuing whitecross as a separate product — double maintenance, ruled out.
**Outcome:** Email/parser/notification moved from whitecross-site → salown-app triggers (table: [MULTI_TENANT_NOTES.md](MULTI_TENANT_NOTES.md)). Exception: Stripe is still whitecross-site/functions (us-central1), until Phase 5. This created a migration regression wave (INC 2026-06-26).

## ADR-003 — Transactional email: tenant Gmail → Brevo
**Status:** ✅ Accepted · **Date:** 2026-06-19

**Context:** Booking confirmation/cancel/reschedule emails were going from the tenant's Gmail; they landed in spam and could not be managed in multi-tenant.
**Decision:** Loyalty + mandatory transactional emails go through Brevo from `noreply@salown.com`. whitecross is forced onto Brevo via `FORCE_SALOWN_SENDER_TENANTS`. GDPR unsubscribe on every email.
**Alternatives:** Tenant Gmail (poor deliverability), other ESPs — Brevo was chosen.
**Outcome:** There are functions that require `secrets:['BREVO_API_KEY']` (if forgotten it silently breaks, INC 2026-06-26). Details: [EMAIL_ARCHITECTURE.md](EMAIL_ARCHITECTURE.md). Note: confirmation/cancel/reschedule use tenant Gmail (nodemailer), loyalty uses Brevo — hybrid; see CLAUDE §Email.

## ADR-004 — Payment = Stripe Connect + Checkout Session (not Payment Link)
**Status:** 🕓 Proposed (features.stripe OFF, future)

**Context:** A per-salon payment policy is needed (off / deposit / full / optional / pay-at-venue). Money must flow to the tenant, not the platform.
**Decision:** **Stripe Connect Standard + Checkout Session**; fixed £ deposit; per-tenant policy. NOT the Payment Link direction.
**Alternatives:** Stripe Payment Link (no per-tenant routing + policy flexibility) — ruled out.
**Outcome:** Currently off; deposit flow INCOMPLETE (no webhook/expiresAt — [KNOWN_QUIRKS.md](KNOWN_QUIRKS.md) §6). whitecross-site's existing Stripe flow is not touched. Details: [STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md).

## ADR-005 — In-salon card = Stripe Tap to Pay pilot
**Status:** 🕓 Proposed

**Context:** In-salon card payment is wanted. Cheap card machines are **locked** to a processor (won't connect to Stripe), and an expensive reader ($700) is unnecessary for a pilot.
**Decision:** Pilot = **Stripe Tap to Pay** (phone = the machine, $0 hardware; requires Capacitor). Mode B: the salon uses its own machine, staff mark "paid £X tip £Y" manually.
**Alternatives:** $700 reader (unnecessary cost), auto-connecting to another brand (not possible, device is locked) — ruled out. Deep multi-processor integration → at scale.
**Outcome:** There's a Capacitor dependency. Details: [salown-app POS notes](../salown-app).

## ADR-006 — Deletion = super-admin only (pilot)
**Status:** ✅ Accepted · **Date:** 2026-07-02

**Context:** Risk of data loss / privilege escalation during the pilot. Role hierarchy owner > admin > staff.
**Decision:** At this stage **all deletion operations + staff assignment are super-admin ONLY** (`isSuperAdmin` claim). Everyone, including owners, lost delete rights (pilot "Option a"). Later, owner→admin tenant-scoped rights will come.
**Alternatives:** Leaving deletion to the owner (risky in the pilot), removing delete buttons entirely (will happen later) — for now, super-admin gate.
**Outcome:** Rules (test 65/65) + UI (all delete buttons, Clients merge-drag, Settings Staff/Danger) behind `isSuperAdmin`. Details: [SECURITY.md](SECURITY.md). Related invariant: INV-SEC-5.
**Timing nuance ([ARCHITECTURE_REVIEW_2026-07-02](ARCHITECTURE_REVIEW_2026-07-02.md)):** As an **operational bottleneck** this bites not at 1000 but at the **~3rd salon** — every wrong-booking deletion request falls on a single person (aerulas@). Bus-factor + operational risk converge here → owner→admin tenant-scoped deletion rights (ROADMAP E1-b) may be needed earlier than assumed.

## ADR-007 — Barber matching exact, no fuzzy, fix at the source
**Status:** ✅ Accepted · **Date:** 2026-06-26

**Context:** Aggregators hold the full name ("Arda Uzun"), the system holds the first name ("Arda") → an unmatched booking disappears from the grid (INC 2026-06-26).
**Decision:** The matcher stays **exact case-insensitive** (`barberKey()`); fuzzy/partial is NOT added. The mismatch is resolved **at the source** (mapped to the canonical name in the parser) — with ambiguity-safe first-name matching.
**Alternatives:** Adding fuzzy to the matcher — risk of writing to the wrong barber, makes the whole system ambiguous; ruled out ("wrong source name = fix the source").
**Outcome:** `resolveBarberName()` is in the parser. Related: INV-MATCH-1/2/3, [NORMALIZATION.md](NORMALIZATION.md).

## ADR-008 — Aggregator commission = two-ledger accounting
**Status:** ✅ Accepted · **Date:** 2026-06-26

**Context:** The aggregator gross price (£40) ≠ the net entering the business (£23.20 after Treatwell's 35%+VAT). The gross=net assumption was inflating the ledgers (INC 2026-06-26).
**Decision:** Commission (`twFeeTotal`/`twNetPayout`) is modeled in the parser; Finance auto-expenses it via `platformFee()`; gross stays visible, net/PL/balance are reduced. Two ledgers across Finance (operational + capital).
**Alternatives:** Gross=net (wrong), entering the fee manually (error-prone) — ruled out.
**Outcome:** Related: INV-PARA-5, [whitecross accounting](../salown-app).

## ADR-009 — Self-onboarding is never turned off
**Status:** ✅ Accepted

**Context:** A "vetted" (apply→approve) flow is being considered, but access must stay open during the pilot.
**Decision:** `/signup` + `provisionTenant` are **NEVER turned off/gated** ("we're not selling, we're testing"). The vetted flow (apply→review→approve) is an **addition**, not a replacement.
**Alternatives:** Turning off self-signup and only allowing vetted — kills test velocity, ruled out.
**Outcome:** Related: INV-MT-4, [early access flow](../salown-app).

## ADR-010 — Deploy safety = predeploy build hook
**Status:** ✅ Accepted · **Date:** 2026-06-29

**Context:** `hosting/public-bundle` is gitignored; EVERY `firebase deploy` that skipped the build was deleting the bundle and dropping the whole SPA to 404 (INC 2026-06-29, weeks of downtime).
**Decision:** A **`predeploy` hook** (`npm run build` / `build:staff`) on both hosting sites in `firebase.json` → everyone who deploys (manual/CI/worktree) builds first.
**Alternatives:** Committing the build artifact (bloats the repo), trusting only CI (raw deploys were bypassing CI) — ruled out.
**Outcome:** The bundle cannot structurally drop. Extra: post-deploy smoke test (INC 2026-06-29 curl block). Related: INV-DEP-1/6.

## ADR-011 — salown-site deleted, single hosting source
**Status:** ✅ Accepted · **Date:** 2026-06-29

**Context:** Two separate hosting sources (salown-site + salown-app/hosting) were creating version divergence.
**Decision:** `salown-site/` was **DELETED**. EVERYTHING — landing, public profile (`/s/**`), booking (`/book/**`) — deploys from `salown-app/hosting` via GitHub Actions. Backup: `salown-site-backup-20260629-1841.zip`.
**Alternatives:** Keeping the two sources in sync — kept diverging, ruled out.
**Outcome:** The single source of the landing is `salown-app/hosting/index.html` (symlink broken). Related: INV-DEP-5, [DEPLOY.md](DEPLOY.md).

## ADR-012 — docs = separate private repo (salown-docs)
**Status:** ✅ Accepted · **Date:** 2026-07-02

**Context:** `docs/` (the project brain) was in no repo → unversioned, no undo across multi-session edits, and impossible to share with people/machines later.
**Decision:** `docs/` becomes its own **private** `salown-docs` repo, staying at the **same `alex/docs/` path**.
**Alternatives:** (a) Moving it into salown-app — breaks `../docs` references + traps cross-repo docs inside a single app; (b) making the alex root a repo — nested-git mess. Both ruled out.
**Outcome:** Because the path is preserved, references weren't broken and app repos weren't touched. `alex/CLAUDE.md` stayed unversioned (read from the root; moving it breaks auto-reading). Related: [KNOWN_QUIRKS.md](KNOWN_QUIRKS.md) §5.

## ADR-013 — Incident record standard (8-field template)
**Status:** ✅ Accepted · **Date:** 2026-07-02

**Context:** INCIDENTS.md was rich but unstructured; there was no Severity/Owner/Status → hard to spot "open work thought to be resolved" and recurring bugs.
**Decision:** Every event carries standard metadata: **Date · Severity · Impact · Root Cause · Resolution · Prevention · Owner · Status** + Lessons Learned. Prevention gets a permanent guard/test where possible. A recurrence = Status 🔴 Regressed.
**Alternatives:** Free prose (current) — weak scanning / missing-work visibility, ruled out.
**Outcome:** The template is at the top of INCIDENTS.md; the rule is in CLAUDE.md (alex + salown-app) + memory. Related: [INCIDENTS.md](INCIDENTS.md).

## ADR-014 — Ask salOWN = Claude Haiku 4.5
**Status:** ✅ Accepted

**Context:** The in-app AI assistant ("Ask salOWN") answers questions over the booking + finance + marketing + clients + loyalty data in a single DB. An LLM had to be chosen — a cost/speed/quality balance was needed.
**Decision:** **Anthropic Claude Haiku 4.5** (`askAI` onCall, `functions/index.js`, secret `ANTHROPIC_API_KEY`). Single AI touch point — the model is centralized here.
**Alternatives:** A larger model (Sonnet/Opus) — unnecessary cost/latency for assistant tasks (summary/Q&A); Haiku is enough for speed+cost. Another provider — Anthropic was chosen.
**Outcome:** The model is in one place (`index.js`) → easy to upgrade. Details: [ARCHITECTURE_REVIEW_2026-07-02](ARCHITECTURE_REVIEW_2026-07-02.md) 🟢-6, [GLOSSARY](GLOSSARY.md) "Ask salOWN". Note: the latest Claude models (Haiku 4.5, Opus/Sonnet) may change → one line when upgrading.

## ADR-015 — Parser mail intake = parse-inbox hybrid + per-tenant token isolation
**Status:** ✅ Accepted (implementation pending — infra + `salownInboundEmail` webhook) · Related roadmap: **H4**

**Context:** The parser (the differentiator) connects to each tenant's Gmail via **app-password + IMAP**. For a non-technical salon, 2FA+app-password is an onboarding-killer; a plain-text password = security debt (T-b); it's locked to Gmail; Google restricts app-passwords. What the parser actually needs is not the salon's inbox but the **notification emails** the aggregators (Booksy/Fresha/Treatwell) send.

**Decision:** Offer the tenant a **choice** (not a single mandatory path):
1. **Recommended — parse-inbox:** the tenant is given a **per-tenant opaque token address** (`bk_<random>@parse.salown.com`); the salon either replaces the notification address at the aggregator with this or sets up **forwarding**. Shown via video (the sector already does video-conference setup).
2. **Fallback — connect your own inbox:** existing app-password/IMAP + a guided video (a band-aid; grows fragile as Google restricts, no heavy investment).
- **A pipe, NOT a store:** inbound service (Cloudflare Email Routing) → `salownInboundEmail` webhook → parse → write to the tenant's Firestore → **the raw mail is NOT STORED.**
- **ISOLATION (most critical):** routing is **only `to:` token → tenantId lookup** (`superAdmin/parseAddresses/{token}`). Token opaque+random → a guess/typo **cannot land on** another tenant. Do NOT infer the tenant from content/from. Unknown token → **fail-closed**: quarantine + alarm, NEVER write to a random tenant. (+ sender-domain verification + `externalId` dedup exist.)

**Alternatives:** (a) **App-password only** — onboarding-killer + T-b + Google restriction, ruled out (but stays as fallback). (b) **Gmail OAuth read-only** — great one-tap UX but Google restricted-scope (CASA) security audit is expensive/slow, hard for a small project → deferred. (c) **A single shared inbox + inferring tenant from content** — cross-tenant leak risk (a whitecross booking lands on herohairs = "we're ruined") → **rejected**; isolation is structural via the token.

**Outcome:** Reduces app-password to an optional fallback, and in parse-inbox tenants **zero credentials are held** → as it's adopted **T-b evaporates** (see ROADMAP T-b note). Cross-tenant misroute is **structurally impossible** (opaque token + fail-closed). Real-time parse (better than cron). ⚠️ New tradeoff: a single inbound pipe = a single point of failure → **I1 parser canary** + a robust service are required. The sub-processor (mail service) is added to the GDPR list. First trial: whitecross + herohairs (each with a separate token). The parser logic already runs on the raw-email string (`extractPlainText`, `functions/index.js`) → wiring it to a webhook instead of IMAP is a medium refactor.

---

## ADR-016 — Marketplace ranking = outcome-based Trust Score (NOT activity)
**Status:** 🕓 Proposed (future — marketplace/discovery phase) · **Date:** 2026-07-12

**Context:** In Fresha-like marketplaces, salons game the ranking with fake bookings
(once an activity signal is rewarded, the proxy gets optimized — Goodhart's Law). For salOWN
discovery, the owner chose the eBay/Amazon Buy Box philosophy: not popularity but accumulated trust.
**Decision:** Salon ranking is done via an **outcome-based internal Trust Score**; raw booking count
is NEVER a signal. Signals: verified completed appointment (CHECKOUT, not booking) ·
repeat-client rate · no-show/cancel behavior · rating consistency (over time) · response
reliability · calendar accuracy · longevity · profile completeness. The score is for INTERNAL use (not a public
"92/100" badge).
**salOWN's structural advantage:** because we are the OS, we see the full journey (booked→confirmed→
arrived→checkout→loyalty→return 6 weeks later) — a platform that only sees the booking can't measure this.
Also, **a fake outcome burns your own pocket**: a fake checkout = fake revenue = tax + broken profit/loss
+ a drifting wage calculation (the booking system = the accounting system). The penalty for gaming comes not from the platform but
from reality. The converted-client metric (channel-grabber, 2026-07-07) is the first live example of that same
backbone.
**Anti-gaming nuances:** against low-ticket fake checkouts, distinct client identity
(phone/email dedup) + ticket-size weighting + time-consistency; **cold-start fairness** — a new
salon starts without outcomes → a starting ramp with day-1 checkable signals (profile, calendar accuracy,
response), otherwise the rich get richer.
**Alternatives:** Activity/recency-weighted ranking (the Fresha model) — incentivizes fake bookings,
ruled out. A public trust badge — creates a gaming target, kept as an internal score.
**Outcome:** Principle: **"Reward outcomes, not activity."** As the marketplace phase begins, this ADR is the opening
spec.

## Maintenance
- New significant decision → new ADR (next number). Fill in Context/Decision/Alternatives/Outcome, add a row to the Table of Contents.
- When a decision is replaced by a new one: **don't delete** the old one → mark it ⛔ Superseded + link to the new ADR.
- When a 🕓 Proposed decision is implemented → ✅ Accepted + date.
- Commit: `cd alex/docs && git commit DECISIONS.md && git push`.
