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
| [ADR-017](#adr-017--landing-live-chat-built-not-bought-bot-first) | Landing live chat = built, not bought (bot-first) | 🕓 | 2026-07-28 |

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

## ADR-017 — Landing live chat: built, not bought (bot-first)
**Status:** 🕓 Proposed (built and locally verified 2026-07-28; not deployed)

**Context:** salown.com is invite-only — every visitor who bounces without filling the demo form is a
lost salon. A live chat is the standard answer, but "live" assumes someone is at a desk, and salOWN
is one founder who is often behind a chair cutting hair. So the chat has to answer on its own first.
**Decision:** build it in-house rather than embed Crisp/Tawk/Intercom. The bot is Claude Haiku 4.5
behind a public HTTP function (`salownLandingChat`), fed a curated `landingGuide.ts`; the human takes
over from the super-admin panel and the bot goes silent for that conversation. Data lives under
`superAdmin/liveChat/**`, so the existing super-admin-only rule covers it and **no firestore.rules
change is needed** — and the visitor's browser never touches Firestore at all (it polls the endpoint,
and only once a human is involved).
**Why in-house won:** (a) the ANTHROPIC_API_KEY, the Firestore, the Brevo notifier and the
super-admin shell already exist — the marginal cost is a few files, not £25-50/mo forever; (b) a
third-party bot would have to be *taught* salOWN anyway, while `productGuide.ts` already exists and
is maintained; (c) visitor conversations stay on our own infrastructure, which matters for a product
whose whole pitch is "you own your client data"; (d) the widget matches the brand exactly with no
iframe.
**The cost of that choice, stated plainly:** this endpoint is unauthenticated by nature, so the auth
guard that closed the askAI spend hole is not available here. It is replaced by four independent
ceilings (message length, per-session, per-IP-hour, global daily) plus an `enabled:false` kill switch
readable from the panel with no deploy. A bought product would have absorbed that risk for us.
**Alternatives:** Crisp/Tawk/Intercom — fastest to ship, but a monthly fee forever, a third-party
script on the marketing page, visitor data off-platform, and the bot still needs our knowledge base.
A form-only "leave a message" — zero abuse surface, but answers nobody at 9pm, which is the whole
point. A Firestore realtime listener instead of polling — needs the Firebase SDK on a static page
plus a public read rule; polling costs less and risks nothing.
**Outcome:** the same principle as the rest of the product — *the system should keep working when the
owner is busy on the floor.* The bot is not a deflection layer; it is cover until a human arrives.

## Maintenance
- New significant decision → new ADR (next number). Fill in Context/Decision/Alternatives/Outcome, add a row to the Table of Contents.
- When a decision is replaced by a new one: **don't delete** the old one → mark it ⛔ Superseded + link to the new ADR.
- When a 🕓 Proposed decision is implemented → ✅ Accepted + date.
- Commit: `cd alex/docs && git commit DECISIONS.md && git push`.

---

## ADR-018 — Tenant presentation is ONE config on the existing settings doc, resolved leniently, written strictly

**Date:** 2026-07-31 · **Status:** ✅ Implemented (TR-A, `424747d`)

**Context.** The Turkey pilot needed language, locale, currency, timezone, time format and country
per tenant. There was no such field anywhere — the platform was hardcoded UK/GBP end to end — and
three live UK tenants had to keep behaving exactly as they do.

**Decision.**
1. **One namespaced key on the EXISTING settings doc** (`settings/settings.presentation`), not a new
   collection. It sits beside `bookingSettings` and reuses that package's layered-resolver contract:
   `locationOverride → tenant → platform default`, resolved per field by own-property (so `0`, `''`
   and `false` are *seen*; truthiness is banned).
2. **The platform default IS today's UK behaviour.** A tenant with no `presentation` resolves to
   English/GBP/Europe/London. That makes "existing tenants unchanged" true *by construction* rather
   than by migration — there is no backfill, and none is needed.
3. **Read leniently, write strictly** — deliberately the OPPOSITE of booking policy. Booking policy
   authorizes money and slots, so a malformed value must fail CLOSED. Presentation only decides how
   things LOOK, so a malformed value falls back per field and records an `issues[]` entry. Failing
   closed here would turn one typo in one settings field into a blank screen for a whole salon. The
   WRITE path is strict, so a value that is saved is always a value that takes effect.
4. **`navigator.language` is never a layer.** Money and calendar days are commercial facts. An owner
   viewing a Turkish tenant from a UK browser sees Turkish/TRY/Istanbul, and there is no
   browser-detection branch to disable later. (One bounded exception: after the panel has resolved a
   real tenant it remembers the LANGUAGE only, in that browser, so the pre-auth login screen reads
   right. It is never written back and never carries currency or timezone.)
5. **A public-safe mirror on the world-readable tenant root**, because the hosted booking page is
   unauthenticated and cannot read the settings subdoc, yet must show the salon's own language and
   currency. Presentation holds no secrets. Same pattern as the existing `settings/hours` mirror.
6. **Owner/super-admin only, enforced in `firestore.rules`** on both copies. Hiding the Settings tab
   is convenience; the rule is the control. Every other settings write keeps its existing
   permission — a localization package has no business tightening unrelated access.

**Alternatives rejected.**
- *A separate `localization` collection* — a second source of truth to keep in sync, an extra read on
  every surface, and it would not have inherited the resolver, the tests or the rules that already
  guard `settings/*`.
- *Infer currency/timezone from the browser or from `countryCode`* — a salon that prices in TRY while
  the owner is on holiday in London must not start quoting £. Country selection *pre-fills* the
  other fields as a convenience; nothing is derived at read time.
- *Fail closed on a malformed presentation* (mirroring booking policy) — correct for authorization,
  wrong for display. See point 3.

**Outcome.** 6 live tenants audited after deploy: only `tr-demo` carries the key.

---

## ADR-019 — Browser page-translation is DISABLED on the app shells; salOWN renders Turkish itself

**Date:** 2026-07-31 · **Status:** ✅ Implemented (TR-A, `424747d`)

**Context.** Chrome's page translation was actively damaging the product for Turkish viewers. It
read `OWN` in the wordmark as the English word and rendered `salOWN` as **`salSAHİP`**; it turned
the weekday abbreviation `Sun` into **`Güneş`** (the star) and `Sat` into **`Doygunluk`**
(saturation); and it was free to rewrite staff names, service names and other tenant content —
which is not cosmetic damage but *commercial* damage: a translated staff name is a different
person, a translated service name is a different price list.

**Decision.** `<html translate="no">` + `<meta name="google" content="notranslate">` on both
deployed **application** shells (`index.html` → panel/login/public booking, `staff.html` → Staff
app), plus `translate="no"` + `.notranslate` on the brand and on tenant-generated content.

This is only defensible *because* the app now speaks Turkish natively: tenant language `tr` →
salOWN renders Turkish itself. Nothing is lost by switching the machine translator off; a Turkish
tenant gets Turkish either way, only correctly.

Day and month names come from `Intl` with the tenant's locale — never from an English abbreviation
array. The `['Sun','Mon',…]` display array in `BookingPage` was **deleted**, not left unused: an
idle English weekday array is exactly what gets re-used by accident later.

**Deliberately NOT covered:** the English marketing pages under `hosting/*.html`. They are marketing
copy a Turkish visitor may legitimately want machine-translated; only their brand elements are
protected. Recorded here so the omission is not mistaken for one.

**Also decided:** technical identifiers keep their lowercase spelling (hosting targets `salown` /
`salown-staff`, `salown-app`, `salown-theme`, domains). Renaming an identifier for visual brand
consistency would break live infrastructure and buys nothing — the user never sees it.

---

## ADR-020 — A package refund SETTLES value; overpayment is REFUSED, not credited

**Date:** 2026-07-31 · **Status:** ✅ Implemented (TR-B, `c3716f7`)

**Context.** TR-B's brief fixes the reconciliation invariant
`packageTotal = paidAmount + outstandingAmount + refundedAmount`. That equation only holds under one
reading of what a refund *means*, and the reading is a product decision, not an arithmetic detail —
so it is recorded here rather than left implicit in a fold function.

Two readings were available:

**(a) A refund settles value.** Handing money back also discharges that part of the price. The three
buckets then genuinely partition the package: funded-and-kept, funded-then-returned, never-funded.
`paid = gross − refunded`, `outstanding = total − gross`, and the invariant holds by construction.

**(b) A refund is money-only.** The debt survives the refund, so a client who paid ₺8.000 and was
refunded ₺2.000 owes ₺2.000 again. Under this reading `paid + outstanding + refunded = ₺10.000` on an
₺8.000 package — the stated invariant is simply false, and one of the three figures has to be
redefined into something a salon owner would not recognise.

**Decision — (a).** A `REFUND` returns money *and* discharges the matching part of the price.

Reading (b) remains reachable **deliberately**, as a refund plus an explicit `ADJUSTMENT` that
re-raises the total. It is not the default because a salon that refunds a customer and silently keeps
billing them is exactly the failure this ledger exists to prevent — and because (b) makes the common
case (refund on cancellation) require a compensating entry nobody would remember to make, while (a)
makes the rare case explicit.

**Also decided: overpayment is REJECTED.** Accepting it would create salon-wide client credit with
nowhere to live. TR-B's ledger is scoped to ONE package, so an excess would either sit as negative
debt on a package it does not belong to — breaking `M2_NON_NEGATIVE_OUTSTANDING` and making every
balance on that package a lie — or require a **client wallet**, which is a different product with its
own expiry, transfer, refund and tax rules.

Refusing an amount a staff member can immediately retype is a smaller harm than inventing a liability
the system cannot explain. The friction is paid down in the UI instead: "pay the remaining ₺6.000,00"
and "pay instalment 2 — ₺2.666,67" are one tap each.

**Rejected alternatives.**

- *Silently clamp an overpayment to the outstanding balance.* Records a different amount from the one
  the salon says it took. A ledger that quietly disagrees with the till is worse than one that refuses.
- *Allow negative `outstanding_m` and call it credit.* Every downstream reader — the list, the Staff
  App, a future Finance row — would have to know that a negative debt is not a debt. One of them
  eventually would not.
- *Derive the plan's paid state from a per-instalment `paid` boolean.* Debt would be derived from a
  boolean, which the brief forbids and which cannot represent a part payment at all.

**Consequences.** `M1` is checked on every fold rather than assumed. The UI prints the arithmetic
under the figures so an owner can check the software rather than trust it. A client wallet, if ever
wanted, is a separate ledger and a separate ADR.

**See:** [TREATMENT_PACKAGE_SYSTEM.md](TREATMENT_PACKAGE_SYSTEM.md) §4 ·
[PAYMENT_PLAN_ENGINE.md](PAYMENT_PLAN_ENGINE.md) §8 · INV-PARA-8, INV-PARA-12

---

## ADR-021 — Package sessions are prepaid at LINK time (`price: 0`), so TR-B changes no checkout code

**Date:** 2026-07-31 · **Status:** ✅ Implemented (TR-B, `c3716f7`)

**Context.** A package client pays once, at sale, and then attends 8 appointments. If those bookings
carry their notional service price, the existing checkout flows that price into `receiptEarnBase_p`
and the client earns loyalty points **a second time** for treatment already paid for — the
double-award the brief explicitly names.

**Decision.** Redeeming a session stamps the booking `price: 0` plus the `BookingPackageLink` fields
at **link** time. The existing checkout, canonical receipt writer, receipt reader and loyalty award
then see a prepaid zero-value service and compute the right thing **without knowing packages exist**.

**Why not the obvious alternative** — teach `checkoutBooking` about packages and special-case the
earn base? Because that file is the most load-bearing money path in the product (P1-RECEIPT-MATH), it
is shared by every UK tenant, and a package-shaped conditional inside it would be a live regression
risk for six salons that will never sell a package. Zeroing one field at the boundary buys the same
outcome with a diff of zero lines in the financial core.

**Consequences.** `packageListPrice_m` preserves what a session was worth for reporting, without ever
re-entering the money math. Package revenue is therefore NOT in `bookings` — no existing total
silently changed, and recognising it in Finance is a deliberate later decision (cash-received vs.
delivered-value), not an accident.

**See:** [TREATMENT_PACKAGE_SYSTEM.md](TREATMENT_PACKAGE_SYSTEM.md) §6 · INV-PARA-11

---

## ADR-022 — Staff **access** is its own axis; `barbers.status` must never control it

**Date:** 2026-08-06 · **Status:** ✅ Implemented in source (STAFF-OFFBOARDING S4A) · **NOT deployed**

**Context.** The only lever that resembled "turn this person off" was `barbers/{id}.status`
(`active`/`passive`/`leave`). It is a **service-provider assignability** field: it answers *can a
booking be assigned TO this person*. Reaching for it as an access control has two failure modes, in
opposite directions. Wire `passive` to app access and the owner who stops taking clients is locked
out of their own business the day they stop cutting hair. Leave it as the only lever and a barber who
has **left** keeps a working Staff account, valid claims and live push tokens, because nothing about
`barbers.status` touches any of those.

**Decision.** A second, independent axis: `tenants/{tid}/staff/{uid}.accessStatus` =
`active | suspended | offboarded`, enforced server-side inside each mutation core's existing
transaction, on the staff snapshot **already read for the role** (no new Firestore read). **Absent
means active** (every pre-S4A document lacks the field; anything else would lock out every existing
user on deploy). A present-but-unrecognised value **fails closed**. `leave` is never an access value.
Every denial returns one code, `ACTOR_OFFBOARDED` → `permission-denied`; the precise state goes to
the audit record, not to the denied caller.

**Why not reuse `barbers.status`** — one field, less schema? Because the two questions have different
answers for the same person at the same time, and the product needs both: a passive barber who still
runs the salon, and an offboarded actor whose barber record is still active for historical
attribution. Collapsing them means one of those two states becomes unrepresentable.

**Consequences.** Two fields must be read to answer "what is this person's situation", and the S4B UI
has to present them as visibly different things or salons will conflate them again. Assignability
rules (`staffEligibility.ts`) and access rules (`accessStatus.ts`) stay in separate modules on
purpose. The gate is server-side only — any surface still writing to Firestore directly from the
client bypasses it (see O1S), so S4A is a foundation, not a finished enforcement story.

**See:** [STAFF_ACCESS_CONTROL.md](STAFF_ACCESS_CONTROL.md) · ADR-023

---

## ADR-023 — Offboarding is a resumable state machine, because it CANNOT be a transaction

**Date:** 2026-08-06 · **Status:** ✅ Implemented in source (STAFF-OFFBOARDING S4A) · **NOT deployed**

**Context.** Revoking access spans three systems: Firestore (`accessStatus`, FCM token documents,
audit), Firebase Auth (custom claims, refresh-token revocation) and the FCM registry. A Firestore
transaction covers Firestore documents only; `setCustomUserClaims` and `revokeRefreshTokens` are
Admin-Auth RPCs with no transactional participation and no rollback, and they take effect the moment
they return. **There is no way to make these atomic together**, and a design that claimed to would be
lying about its own failure modes.

**Decision.** Model it explicitly as a resumable, idempotent state machine — TX-1 (authorize, flip
`accessStatus`, open the op record) → individually idempotent effects → TX-2 (mark DONE, emit audit).
The **ordering is the safety property**: the Firestore state that *denies* access commits first, so a
crash at any later point leaves the person already locked out with the cleanup visibly pending. The
failure mode is *more revoked than recorded*, never *recorded as revoked but still able to act*.
Resumption works under the same idempotency key (same derived op document) or a different one (TX-1
adopts the op still open on the staff document and writes an alias).

**Why the audit is not `logAuditServer`.** Every other core uses that fire-and-forget sink, which is
at-most-once and best-effort. For a security event a lost record is as wrong as a duplicate one, so
the audit is written **inside TX-2 at a derived document id** (`staffaccess_{opId}`): exactly-once
without depending on the process surviving.

**Consequences.** There is a new server-only collection (`staffAccessOps`) that S4B must add to
`firestore.rules` before any client reads it, and op documents can sit at stage `PENDING` until
someone retries — a reconciliation sweep is deliberately deferred, not assumed. Refresh-token
revocation is one-way: **re-enable cannot un-revoke**, so every restore result carries
`mustSignInAgain: true` rather than pretending the session survived.

**See:** [STAFF_ACCESS_CONTROL.md](STAFF_ACCESS_CONTROL.md) §4 · ADR-022

---

## ADR-024 — A profit-and-loss statement is never tender-filtered; cash/card is collection analysis

**Status:** 🕓 Decided, not yet implemented · **Date:** 2026-08-13 · **Work ID:** `FIN-PL-SCOPE`

**Context.** Admin Finance has one `paymentFilter` (All / Cash / Card / Monzo) held in page state.
The control **renders only on the Daily Ledger and Monthly Summary tabs**, but the state is global
to the page and `monthlyTotals` — which the **Overview tab's P&L Statement** reads — is derived from
the filtered `dailyData`. So selecting Cash on Daily and switching to Overview produces a
cash-filtered P&L with **no visible control saying so and no way to clear it from that tab**.

The number it produces is not merely filtered, it is incoherent. `grossRevenue` is restricted to the
selected tender legs while **all five cost inputs stay whole-period**: `cashExpense`, `bankExpense`,
`platformFees` (Treatwell commission), `totalWages` and `fixedCost`. Live 2026-08-13:

| View | Gross | Wages | Fixed | Net P&L |
|---|---|---|---|---|
| All | £271.60 | £100.00 | £120.00 | **+£51.60** |
| Cash | £58.00 | £100.00 | £120.00 | **−£162.00** |
| Card | £213.60 | £100.00 | £120.00 | **−£6.40** |

Cash + Card = −£168.40 against a true +£51.60 — off by exactly £220.00, the whole cost base counted
twice. Neither filtered figure is the profit of anything: a barber's wage is not a cash cost or a
card cost, and rent is not settled per tender.

**Decision.**

1. **The Overview P&L is always authoritative whole-period "All".** It is the one surface where the
   answer must not depend on a control the reader cannot see.
2. **Entering Overview explicitly neutralises the tender filter** — reset it, or scope the filter
   state so it cannot reach P&L consumers. Silently ignoring it is not enough: the Daily tab must
   not appear to retain a selection that Overview is quietly discarding.
3. **Cash/Card filtering is COLLECTION analysis, not profitability.** It answers "what did this
   method take, and does the drawer reconcile" — `selectedTender`, Cash in Hand, Bank Balance. It
   never answers "did we make money".
4. Therefore **`platformFees` is not scoped per tender** (`FIN-TENDER-SCOPE-P1`). It is a period
   cost like the other four. Fixing it alone would make the filtered P&L *look* scope-clean while
   four larger costs are still doubled — a worse failure than the one it fixes, because it removes
   the visible incoherence without removing the incoherence.

**Rejected — allocating costs per tender.** Splitting wages, rent or commission across cash and card
by revenue share would make both filtered P&Ls add up. It would also be invented: no wage, lease or
Treatwell invoice is settled by tender, and the Treatwell fee in particular is a percentage of the
service price owed regardless of how the customer paid — on a `prepaid` booking it is netted from a
bank payout and never crosses the counter at all.

**Rejected — labelling the filtered P&L "(whole transactions)".** The scope suffix says *"correct
for the rows shown, do not add across filters"*. That claim is true of Gross and Loyalty. It is
false of a filtered Net P&L, which is not correct for the rows shown either — it charges one
method's revenue with every method's costs. A label that overstates its own guarantee is worse than
no label.

**Consequences.** The Daily Ledger keeps its filter and keeps its collection figures. The Overview
P&L Statement, the partnership summary and any future export of profitability are `All` by
construction. `partnershipByMonth` already satisfies this — it reads `bookings` directly and never
sees `paymentFilter`, asserted against the source in `financeSummary.test.ts` so it cannot drift.

**See:** [ROADMAP.md](ROADMAP.md) `FIN-PL-SCOPE` · `FIN-TENDER-SCOPE-P1` · ADR-008 (two-ledger
aggregator accounting, which is why the commission is a cost and not a discount)
