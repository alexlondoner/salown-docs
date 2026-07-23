# ROADMAP.md

> **Labels:** `✅ Done` · `🔄 In Progress` · `🔵 Planned` (stable, not started) · `⏸ Waiting` (external dependency / deliberate hold) · `💡 Future` (post scale/investment) · `⚠️` (caution/conflict).
> **Format:** active section = theme heading + one-line items; the detail/commit of each ✅ is in the **Completed** section at the bottom. Themes are ordered by **importance**.
> **Last revision: 2026-07-16** — document restructured from a "feature list" into a "company roadmap": completed items moved down to Completed, themes grouped by work area, Employment Model made a first-class theme. With a code-verified audit (4 parallel agents), 🔵/🟡 items were pulled to their real status. The previous long version is in git history.

---

## 🔄 SINGLE SOURCE OF TRUTH — every session should READ this

> **Rule: the CURRENT STATUS of a piece of work lives only here, in ROADMAP.md.** Detail documents
> (SECURITY.md, TESTS.md, INCIDENTS.md, `*_PLAN.md`) hold the *technical detail* — NOT the status badge.
> If a status conflict arises, **ROADMAP wins**; the detail document links here.
>
> **When work is done (every session, no exceptions):**
> 1. Mark the relevant item ✅ under its theme + **commit hash** + write "LIVE"; move the detail to Completed.
> 2. If deployed, verify it is actually on `origin/main` (`git branch -r --contains <hash>`).
> 3. Add the code change to the [edit-log-salown]/[edit-log-whitecross] memory.
> 4. Only a *technical* update to the detail document (if any).
>
> **⚠️ Audit lesson (2026-07-16):** before marking an item "Done", (a) find the **real feature commit, not the migration commit** (`git log -S --follow`); (b) for a behavior-based item, a **line of code ≠ working** — if it conflicts with the field observation, don't close it without live verification (see G1 in-app notif). Otherwise the document carries "traces of the past journey" and the project appears to be past that point.

---

## 📍 Where we stand

**The platform is live and in real use; the project is past the "feature from scratch" phase.** The remaining work is mostly **scaling, operations, and commercial maturation**: staff/financial model, taking payments live, metric/evidence collection, security gate, technical debt.

- **2 tenants live** (whitecross · herohairs), all Class A. *(eekurt left the platform as of 2026-07-18 — inactive; data/rules not deleted.)*
- **Real signals:** customers are redeeming loyalty points · transactional+loyalty emails going out regularly · bookings coming in regularly from the website · the parser pipeline (H4) is proven end-to-end on organic email.
- **⚠️ Commercial note:** Stripe Connect is **entirely in TEST mode** — no tenant is taking real money. "Go LIVE" awaits an owner decision + live keys (Payments theme).

**The one real gate:** Pre-Scale Hardening Gate (Security & Scale theme). Tier 1 ✅ closed; Tier 2 + follow-up work before tenant #4.

---

## 🎯 Current focus

> **🏁 COMPLETION SPRINT (owner decision 2026-07-20):** BEFORE moving to vision work (marketplace / billing / hub), finish everything on the roadmap that is *started but not closed*. The list below is a **sequential index + closing gate** — the status badge still lives under its theme (SSOT); this is just to gather the "unfinished tails" in one place and keep the order. When an item is done: ✅ + commit under the theme, then check the box here. **Do not enter vision themes (💡) before the sprint is finished.**
>
> **🧪 To be tested (code ready → awaits owner live verification; does not block the flow):**
> - [ ] **In-app notification (reschedule/cancel) live test** — *code review ✅ 2026-07-20:* the pipe is wired correctly end-to-end (write `notifications/index.ts:66` → trigger `index.ts:2056/2095`, gate `ns.customerCancel/Reschedule !== false` = default ON → bell `NotificationBell.tsx:80`, no filter). The reschedule notification doesn't distinguish staff/customer (`index.ts:2094`) → **reschedule a real (not walk-in) booking from the panel, the bell + 🔄 diff should appear.** If it appears ✅ closes; if not, the live `salownNotifyBookingUpdated` is stale → targeted redeploy.
>
> **A — open ends waiting to close a ✅ (first; small):**
> - [ ] **A1 stylist cap enforce** — `stylistLimitReached` helper exists but isn't called in `Barbers.tsx`. *(Payments theme)*
> - [ ] **A3 inventory stockQty** — numeric field + single `applyStockDelta(soldProducts, sign)` helper + low-stock warning. *(Payments theme)*
> - [ ] **C3 abandoned-cart scheduled** — manual button ✅; X-hours-later scheduled trigger + one-time guard + opt-out. *(Marketing theme)*
>
> **B — active in-progress (🔄):**
> - [ ] **I2 Phase 2 parsers slice** — 5 parser fns → domain module (the old focus item below). *(Tech Debt)*
> - [ ] **H4 remainder** — herohairs parse-inbox migration + Treatwell first mail + whitecross IMAP retirement. *(Onboarding theme)*
>
> **C — the "remainder" of shipped features:**
> - [ ] **B2 booking settings** — off-day reschedule behavior + barber-change UI + configurable slot interval. *(Booking)*
> - [ ] **B4 phone country code** — single shared component (5 entry points, IE +353). *(Booking)*
> - [ ] **C8 audience scope** — member leak + server-side guard (`sendCampaignBulk`). *(Marketing)*
> - [ ] **Marketing Slice 3b** — Revenue SSOT (OverviewPanel vs Reports to a single source). *(Marketing)*
> - [ ] **S1 + S3 Employment** — passive barber ghost-wage + Reports deleted-barber statistic. *(Employment Model)*
> - [ ] **G3 unsaved-changes guard** — 6 forms (ConfirmDiscard shared component). *(Tech Debt)*

- 🔄 **I2 Phase 2 — functions modularization** (owner choice 2026-07-14). Slice 1 (askAI + auth guard) ✅ LIVE (`bccd828`). **Next slice: parsers** (`salownParseEmails`/`salownInboundEmail`/`salownParseInboxDispatch`/`salownManualImport`/`salownIcalFeed` → to domain modules; all 5 still inline in `index.ts`, code-confirmed). Then notifications → marketing; **stripe/bookings LAST**. Golden rule: export name+config exactly matched, pure move, one commit + targeted deploy per slice. Detail: **Tech Debt** theme.
- 🔄 **Employment Model Phase C** (theme below) — the next big module the owner emphasized.

---

## 👥 Employment Model & Staff Management

> **NOT an ordinary "Staff" item — it represents the salon's financial model.** In the same system, **salaried + commission + chair-rent (self-employed)** staff coexist; each affects P&L completely differently (+ the UK legal distinction self-employed≠employee). "Adding a barber" is easy in Booksy/Fresha/Treatwell; the real problem is **managing the employment model**. Design: [STAFF_MANAGEMENT_DESIGN.md](STAFF_MANAGEMENT_DESIGN.md). Backbone: `tenants/{tid}/staffComp/{barberId}` + append-only date-effective `history[]` + "passive = comp period closed" + pure-derivation.

- ✅ **Lifecycle** — active / leave (dated, returns automatically) / passive / deleted; leave archive (`barber.leaves[]`), 5 surfaces pulled to a single precedence (override>leave>passive>workingDays), including the whitecross-site port. *(detail: Completed › G5)*
- ✅ **Compensation model UI (Phase B)** — Staff Hub tabbed drawer (Profile/Availability/Pay/History), PayModelChip, 3-step CompChangeFlow, wage periods hour..year + actual-work accrual semantics, paid-leave toggle, passive=close-comp-period. Rules deploy (`1474907b`, staffComp=owner+super). *(detail: Completed › S2)*
- ✅ **Archive / snapshot safety (hole 1)** — product sale + block snapshot `barberName` (`0db230c`); deletion is super-admin+owner only, strong confirmation modal, `BARBER_DELETED` audit.
- 🔵 **Payroll / accrual engine (Phase C)** — wage worked-time accrual (hour..year day/hour rate) + paid-leave days at normal rate + commission booking-based + chair-rent calendar accrual.
- 🔵 **Settlement + Finance/Reports integration (Phase C)** — M1 migration (partnerConfig→staffComp, dry-run CSV) · Finance reads from staffComp + remove implicit £100 fallback (with parity proof) · Balance line "Tracked in Finance".
- 🔵 **S1 hole 2** — the Reports "Barbers" tab builds the list only from LIVE barbers (`Reports.tsx:182`) → a deleted/passive barber's historical statistic row disappears. Fix: include historical booking names as "Archive/former staff". *(code-confirmed open 2026-07-16)*
- 🔵 **S3 Finance/Occupancy bugs** — (a) a passive barber still accrues a daily wage in Finance (`Finance.tsx:265` has leave, NO passive filter); (b) a barber on leave is counted in the occupancy capacity denominator (`OccupancyPanel.tsx:54` `barberWorksOn` without a leave-check). Both cleanly resolved by the Phase C comp engine. *(code-confirmed open 2026-07-16)*
- 🔵 **§7 safety fixes (separate mini-run)** — occupancy resolver, legacy active-readers→barberStatusOf, Reports archive. **Keep Scope Narrow.**
- 🔵 **G5 step 6 remainder** — staff-app migration (coordination with the other device); per-barber Staff Hub UI ✅ (above). §8 has 4 open owner questions (must be answered before code).

---

## 🔒 Security, Scale & Pre-Scale Gate

> **Mindset:** "whitecross pilot, whatever works" → at 1000 customers these decisions hit **everyone**. Read the roadmap as a gate. Detail: memory `project-salown-prescale-hardening`, [SECURITY.md](SECURITY.md), [ARCHITECTURE_REVIEW_2026-07-02.md](ARCHITECTURE_REVIEW_2026-07-02.md).

**Tier 1 gate — ✅ CLOSED** (verified 2026-07-02): Gate-G1 role-claim backfill (`0f8de7e`) · Gate-G2 bookings read tenant-scoped (`851efeb`) · Gate-G3 public-create financial forge guard (`851efeb`) · Gate-G4 staff-doc catch-all→false (`0f8de7e`). Test 49/49. + Follow-up: T-a1 delete=super-admin (`7e95d40`) · T-a2 admin role-based (`643c8ce`) · T-d self-escalate closed (`643c8ce`). *(detail: Completed › Security)*
- 🔄 **Gate-G5 blast radius** — single global ruleset; discipline exists (pull from API, latest deploy, rollback ready), no structural solution. **Ongoing.**

**Delete policy — ✅ LIVE (E1b):** delete = `isSuperAdmin() || isOwner(tenantId)`, 10 collections (including barbers, with a strong confirmation modal); owner only within their own tenant; staff/finance/settings/merge super-only (`8670051`+`2af303c`, test 83/83). *(detail: Completed › Security)*

**🔑 P0 — Shared secret namespacing (from INCIDENTS 2026-07-21):** *Corporate principle: secrets belong to the **application boundary**, not the tenant boundary; no secret name should be SHARED by two different applications.* This is not a "Stripe bug" but a shared-infrastructure naming problem.
- 🔄 **Split `STRIPE_SECRET_KEY`** → `WC_STRIPE_SECRET_KEY` + `SALOWN_STRIPE_SECRET_KEY`. **Whitecross side ✅ DONE (2026-07-21):** `WC_STRIPE_SECRET_KEY` + `WC_STRIPE_TEST_SECRET_KEY` created (byte-identical to originals); 4 payment fns (`createCheckoutSession`/`stripeWebhook`/`checkBookingPayment`/`createMobileCheckout`) migrated + deployed via the guarded `scripts/deploy-functions.sh`; live smoke passed (`cs_live` + `CONFIRMED` + `DEPOSIT_PAID`, booking `WCB-1784645026181-qq8o`); `STRICT_NAMESPACE` default=1 so shared `STRIPE_SECRET_KEY` in code now hard-fails. **Remaining:** (a) salOWN Connect → `SALOWN_STRIPE_SECRET_KEY` (salown-app session); (b) THEN retire old shared `STRIPE_SECRET_KEY` — **blocked until salOWN migrates** (salownConnect still binds it); (c) follow-up: webhook signing secrets (`STRIPE_WEBHOOK_SECRET`) + `/v1/account` API account-identity guard. **Why P0:** the shared `STRIPE_SECRET_KEY` let the salOWN Connect sandbox setup overwrite whitecross's **live** payment (2 real customers lost); whitecross is now isolated, salOWN still shares the name.
- 🔵 **Namespace all shared secrets before tenant #4** — the same principle for all shared credentials: `BREVO_API_KEY`→`SALOWN_BREVO_API_KEY`, Telegram/OpenAI/Google OAuth etc. app-prefix. Small but permanent; removes a big risk at scale. *(Note: salOWN TENANTS already hold no secret — only `acct_`, the Connect model; this item is within the application-boundary, not the tenant-boundary.)*

**Tier 2 — blows up at scale, does not block onboarding:**
- 🔵 **read:true surface → root doc lock** — the real PII (`clients`/`products`) is already auth-only; the remaining legitimately-public (`services`/`barbers`/`gallery`/…) + `tenants/{id}` root doc is world-readable. **The one task:** `BookingPage.tsx:386` should read from the `public/booking` projection instead of the raw root (Phase 1 projection trigger + backfill ✅ `2db8721`; Phase 2 read+fallback; Phase 3 rules `read:true`→`isTenantAny` LAST). *(code-confirmed: BookingPage still reads the raw root 2026-07-16)*
- 🔵 **B3 `salownCreateBooking` transactional** — see Booking theme (double-booking race).
- 🔵 **A1 plan enforcement remainder** — see Payments theme (stylist cap + hard-gate).

**Tier 3 — tenant-local, safe (contained):** Finance/partnerConfig · Muhamed wage · workingDays. *(review: "not the biggest risk, contained"; not 🔴.)*

**Follow-up work (remaining from Tier 1):**
- 🔵 **T-b app-password → Secret Manager** — `tenants/{id}/settings/emailConfig.appPassword` is still plaintext, client-readable (`index.ts:315` IMAP reads from there). ⚠️ **depends on H4** — once the parse-inbox model settles, the app-password is removed entirely → T-b **evaporates**; must wait for the H4 decision. *(code-confirmed: still plaintext 2026-07-16)*
- 🔵 **T-c auth user cleanup** — KEEP `durvezek@`/`aerulas@`/`auzun9499@`; dump the rest→CSV confirm→delete. NO blind deletion.
- 🔵 **E1 Phase 2 scale** — let the owner manage their own staff/barbers (staff-assignment still super-only) · cross-tenant permission management from the super-admin panel · final: remove delete buttons entirely · Staff App delete parity. ⚠️ review: the delete-bottleneck is a chokepoint not at 1000 but at **~the 3rd salon**.
- 🔵 **I3 reporting pre-aggregation** — `Reports.tsx` does client-side aggregation → crashes in the browser at ~100 salons (won't last to 1000). Direction: `tenants/{id}/stats/{period}` pre-agg doc (trigger/job). *(code-confirmed open 2026-07-16)*
- 🔵 **I4 audit trail Phase B/C** — Phase A ✅ (staff/client, `2ab0328`). Phase B: catalog/price + settings + discount codes (code-confirmed: Services/Products/Settings/DiscountCodes don't call `logAudit`). Phase C: staff-user fns, super-admin, TTL, viewer filters, append-only rules. Design: [AUDIT_TRAIL_PLAN.md](AUDIT_TRAIL_PLAN.md).
- 🔵 Single Firebase project quota/blast radius (scale).

---

## 💳 Payments (Stripe Connect)

> **⚠️⚠️ ENTIRELY IN TEST MODE — NO REAL MONEY.** All modes were tested with the Stripe **sandbox** ("Turquoise Swing"); `features.stripe`/`websiteDepositsEnabled` were NOT turned on in live mode. Direction: Standard + Direct charge, fixed £ deposit, per-tenant policy. Plan: [STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md).

- ✅ **A2 Connect — verified end-to-end in TEST mode (2026-07-04):** Phase 0 onboarding (`salownConnect*`, tenant secret NEVER stored) · Phase 1 Checkout (`salownCreateCheckoutSession` + parallel `salownConnectWebhook`, `863e3db`) · UI Settings→Integrations "Online payments" card (`8747fea`) · Phase 2 policy (paymentMode + defaultDepositAmount) · Phase 3 refund + configurable windows (`e3221cd`). Owner tested all modes (deposit/full/optional/pay-at-venue/off). *(detail: Completed › Payments)*
- ⏸ **Go LIVE (real money)** — the code side is READY (2026-07-17, `138e8d7`): mode-mismatch guard (`salownCreateCheckoutSession` under a live key turns a test `acct_` into a clear "reconnect" error; `salownConnectStatus` `modeMismatch` flag) + Settings reconnect banner + step-by-step **Go-Live Runbook** ([STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md)). The code is key-agnostic → test→live = secret-swap + targeted functions deploy (single block). **The only blocker = the owner's live keys** (`sk_live_`/live `ca_`/live `whsec_`). First live attempt is whitecross's online profile; then commission activation (`application_fee` wired at 0%) + a refund test on success. **Waiting (live keys).**
- 🔵 **Premium deposit rules (Booksy model) — design FINAL, build pending** *(owner 2026-07-16)* — rule-based: N deposit rules (`%/£` + amount + `mode:deposit/full`) → assigned to desired services (`depositRules` collection, world-readable; service→rule resolution at booking time; unassigned=no deposit). **Channel split:** premium custom site (whitecross-site) vs salown-hosted online-profile have **independent** master switches; depositRules is shared. Group=per-person. Server=amount authority (don't trust the client, a security fix). Bridge ✅ (`public/booking` `2db8721`). **Build phases:** F1 depositRules + Settings "Deposits" UI (Booksy-like, NO LIVE RISK) → F2 whitecross-site wiring (⚠️ **live-revenue path, owner test-booking required**) → F3 extend to salown-hosted. Open: premium gating (Pro+?). Spec: [STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md) §G.
- 🔵 **A1 stylist cap (plan enforcement Phase 4)** — plan enforcement largely ✅ (planLimits config `0a31141` + super-admin editor `e2cd4b4` + FeatureLock `8189df4` + usage nudge `2723220`, all SOFT+pilot exempt). Remaining: the `stylistLimitReached` helper EXISTS in `Barbers.tsx` but isn't called → cap not enforced (code-confirmed); + hard-gate decision (soft→hard once money-taking starts).
- 🔵 **A3 product inventory / stock** — basics ✅ (`soldProducts` SSOT, `84635ed`+`b5cebac`). Remaining: numeric `stockQty` field (currently only `inStock` boolean) + single `applyStockDelta(soldProducts, sign)` helper (shared by checkout+createProductSale) + undo diff + `productId` guarantee + low-stock warning. *(code-confirmed: no stockQty 2026-07-16)*
- 🧹 **Orphan cleanup** — 27 legacy functions in `havuz-44f70`/us-central1 (from the migration, not in code). A blanket `deploy --only functions` proposes to delete them → deliberate separate task; verify the old endpoints aren't being called.
- 🔵 **Whitecross Stripe checkout branding** (owner requested) — Level 1 Dashboard branding (owner, no code) · Level 2 small code (whitecross-site `createCheckoutSession`: `product_data.images`+`custom_text`+`locale:'en-GB'`) · Level 3 embedded Elements → deferred to Phase 5.

---

## 💰 Monetization & Self-Serve Upgrade

> **Vision:** today the tier is flagged **only by super-admin**; a tenant should be able to
> upgrade its own plan from **Settings** ("in-account upgrade like Anthropic"). The tier engine (limit/feature resolution) is ready
> and correct (`planLimits.ts` single source, SOFT enforcement); what's missing = **(a)** the in-account request surface,
> **(b)** the approve queue, **(c)** later a real billing pipeline. ⚠️ salOWN **cannot** take money from a tenant
> (Stripe is only Connect/deposit + TEST mode; there is **NO subscription pipeline**). Full design: [TIERS_AND_UPGRADE.md](TIERS_AND_UPGRADE.md).

- 🔵 **M1 in-account upgrade (Phase 1 — request→approve, no charging)** — a **"Plan" tab** in Settings
  (4 tier cards + comparison + the current usage bar moved in) + `requestPlanChange`/`decidePlanChange`
  callables + a **super-admin "Upgrade requests" queue** (`collectionGroup('planRequests')`). Flow:
  tenant "Upgrade" → `tenants/{id}/planRequests` doc → super-admin approves → flag flip + tenant email.
  UX *feels* self-serve, backend is a queue. NO live-revenue risk, enforcement stays SOFT. A separate focus-day task.
- 🔵 **M2 Pro+ = premium website + SEO package** — the top tier stays "Let's talk"; add
  **`premiumWebsite: boolean`** to `PlanFeatureFlags` (proplus=true), representing the whitecross package: hosted premium
  site + custom domain + SEO (schema/meta/perf) + white-label email + priority support. Premium site
  delivery is operations, not code → same family as [Premium Themes F1](ROADMAP.md#-premium-themes-gelir-kalemi).
- 💡 **M3 real self-serve Stripe *Billing* (Phase 2 — VISION)** — ⚠️ a **SEPARATE** pipe from Connect
  (Connect=customer deposit; Billing=**salOWN charging the tenant via subscription**). Components:
  Stripe Products/Prices (Starter/Pro Price ID) · `createBillingCheckout` (subscription Checkout) ·
  `billingWebhook` (lifecycle→`plan/status`, the new authority for plan) · `createBillingPortalSession`
  (Stripe Customer Portal = "Manage billing"). Billing fields go in the `settings/billing` subdoc (root=public,
  keep no secrets). Precondition: owner "we're taking money" decision + salOWN platform-merchant Stripe + live keys.
- 💡 **M4 maturation (Phase 3)** — proration (Stripe default) · invoice/receipt email · dunning
  (`payment_failed`→retry→`past_due`→grace→downgrade) · enforcement **soft→hard** (A1 stylist cap trigger,
  once money-taking starts). NOT today.
- 💡 **M5 public pricing page (Future)** — the landing shows no price today (vetted "Request a demo",
  deliberate). Once self-serve billing (M3) is live + tiers are stable, `/pricing` opens (the dead `.pricing-grid`
  CSS already exists `index.html:156`); self-signup is preserved (memory `keep-self-onboarding-active`). *(H3 "Billing page placeholder" moved under this theme.)*

---

## 📊 Evidence & Metrics

> **Goal:** every important production claim should be backed by data — not "I think it works" but "here is N months of production data". **Operational infrastructure, not marketing** (NO heavy stack). ⏱ Nothing ACCUMULATES until the Platform+Reliability layers start being collected — a day unmeasured today is a lost day; that's why EV1/EV2 are small but early.

- 🔵 **EV1 parser telemetry** ⏱ — the parse result of every inbound email should be written persistently to Firestore (success/failure+reason, dedup, latency receivedAt→parsedAt). Currently failures are only in Cloud Logging (~30 days) → history doesn't accumulate. Note: `recordParserRun` writes a daily AGGREGATE (I1 canary), EV1 per-email is DIFFERENT. Small task, doesn't wait for I2. *(code-confirmed: no per-email telemetry 2026-07-16)*
- 🔵 **EV2 health-check + uptime** ⏱ — a scheduled fn probes the critical surfaces (booking-create path, parser inbox, hosting 200), writes to a daily doc → a monthly availability % forms by itself. The numeric sibling of INCIDENTS.md. *(code-confirmed: no health-check job 2026-07-16)*
- 🔵 **EV3 auto-generated METRICS.md** — a script produces a snapshot of business metrics from Firestore (booking volume, repeat rate, loyalty redemption, source distribution, active tenants, avg spend) + the EV1/EV2 accumulation; hand-entered numbers rot. **Order: after I2 Phase 2 + Tier 2.**
- 🔵 **C7 automation outcome metrics** — each automation card ("Birthday Treat", "Loyalty Boost", later C3) should show its own outcome ON THE CARD: **Sent / Opened / Booked (+£)**. *(code-confirmed: cards show at most "Sent" `Marketing.tsx:958`, no Opened/Booked.)* Principle: a new automation isn't "done" without a Sent/Opened metric. Gate: same Phase-2 wave as the scheduling cron (C3) + open-tracking.

---

## 🎫 Onboarding, Super-Admin & Parser Pipeline

- ✅ **H1 early-access intake** (`a2689f9`) + **H2 invite-based onboarding** (demo funnel + Applications approve→provision, `ae495a1`/`57e3959`). Self-signup preserved (buttons hidden, `/signup`+`provisionTenant` works — memory `keep-self-onboarding-active`). *(detail: Completed › Onboarding)*
- ✅ **H3a analytics accuracy** (`fb92c8b`/`2e04a66`) · **H3b owner login visibility** (`adminGetOwnerActivity`, `f4aee2b`) · **H3c parse-inbox address management UI** (`a31538f`).
- 🔄 **H4 parser email intake — parse-inbox hybrid + token isolation** · **PILOT FULLY LIVE** (2026-07-13/14): forwarding set up, full lifecycle drill PASSED (create/reschedule/chain/cancel × two pipes, zero duplicate records), first organic customer mail + Fresha pipe proven live. Isolation: token→tenant lookup, fail-closed (cross-tenant misroute structurally impossible). *(detail: Completed › Onboarding)*
  - 🔵 **Remaining:** herohairs parse-inbox migration (token rotate ✅ `herohairs_2e1355…`, forwarding to be set up with the new address) · Treatwell pipe first-mail observation · whitecross IMAP retirement (owner keen — 5min cron overhead; remove the app-password, DON'T TOUCH the feature flags → **T-b evaporates**).
  - 🧹 **Chore:** the drill's UNSEEN test emails cause the IMAP cron to re-log the same "not found" triple every 5min (harmless but noise) → owner should mark them read OR add a terminal not-found mark-seen to the parser (without breaking out-of-order retry).
- 🔵 **H3 remainder** — cross-tenant user/permission management (=E1) · tenant metric deepening. *(Billing page → moved to the **Monetization & Self-Serve Upgrade** theme: M1/M5.)*

---

## 📅 Booking Experience

- ✅ **B1 cancel/reschedule self-service UI** (`3d63c39`) — `/manage/{tenantId}/{bookingId}`, cancel+MiniCal reschedule, all tenant emails carry a "Manage Booking" button; owner tested end-to-end.
- ✅ **B6 BookingDetailPanel size + compact** (`36d58a4`, LIVE 2026-07-18) — the panel opened via "View full details" from the notification bell was in a hand-written fixed `380px` wrapper (narrow + no `overflowY` → the bottom was clipped); equalized to Dashboard/Bookings' `Drawer width="540px"` size (`PanelLayout.tsx`, maxWidth 96vw + overflowY:auto + border/shadow). Also the detail-view vertical spacing was measuredly tightened (section/field/client-row; only spacing, font/color unchanged) → a typical booking fits without scroll. Because it's a single component, it reflects across all panel usages.
- ⚠️ **Panel in-app notification (reschedule/cancel) — CODE EXISTS, FIELD-CONFLICTING, needs live test.** The in-app `writeNotification('cancelled'/'rescheduled')` calls have **existed in the code since 2026-06-05** (`54ee368`, `index.ts:2056/2095`, gated by `ns.customerCancel/Reschedule`) + click→open-booking wired (`NotificationBell.tsx:116`). BUT the owner did NOT get a notification in the panel during the 07-13 H4 drill → git doesn't resolve it. **To do:** live-test whether the bell appears in the panel on a real reschedule/cancel — if it appears ✅ closes, if not it's a trigger/firing bug. + 🔵 per-person notification preference (fcmToken filter; token docs carry `uid`/`barberName`/`role`).
- 🔵 **B2 booking settings (dynamic) — Booksy-level Booking Rules** — cancel/reschedule windows (8h/2h) ✅ LIVE in Settings "Booking policy" (`Settings.tsx:1016`, `dcdf6e0`). **Vision (owner 2026-07-23):** move the hardcoded booking rules into a tenant-scoped **Settings → Booking Settings** block (extend the existing tenant `settings/settings` model — do NOT open a new collection; missing value ⇒ back-compat default). Server-side validation MUST read the same tenant value, never just the UI. Candidate settings: **`shiftOverrunAllowanceMins`** (default 15 — the FIRST to dynamicize: constant `STAFF_SHIFT_OVERRUN_ALLOWANCE_MINS` is already the single default and `generateStaffSlots` already takes an `overrunAllowanceMins` override, so the tenant value plugs straight in) · slot interval (5/10/15/30, currently 15) · min advance notice · max advance booking (e.g. 60 days) · same-day on/off · service-fit policy (strict / allowance) · late-booking permission · online reschedule cutoff · deposit/full-payment rules (service/price based). **Fixed system rule, NOT a setting:** staff-shift precedence (INV-BK-6) stays hardcoded. Prior remaining also here: off-day reschedule behavior (block/auto-shift/allow) · barber change on customer reschedule (`newBarberId` exists, UI closed).
- 🔵 **B3 `salownCreateBooking` transactional (Tier 2)** — booking create is still a direct client-side `addDoc` (`BookingPage.tsx:659`, has a fail-open pre-check but NO transaction) → double-booking race. Risk once HeroHairs traffic grows. *(code-confirmed open 2026-07-16)*
- 🔵 **B4 phone country code standardization** (owner has feedback, Ireland +353) — `COUNTRY_CODES` is local only in `BookingForm.tsx:46` (NO +353); the other 4 entry points are free-text. The phone is the main key of client-identity → an inconsistent code splits the same customer in two. Task: single shared component (including IE) → 5 entry points. *(code-confirmed open 2026-07-16)*
- ⏸ **B5 2-way sync / auto-block** (⭐ differentiator) — salOWN should AUTOMATICALLY close its occupancy in Booksy+Fresha. **Status:** Treatwell ✅ live (`salownIcalFeed` iCal OUT) · Fresha ⏳ "Import from external calendar URL = COMING SOON" (when released, paste the feed, zero code) · Booksy ❌ closed → Puppeteer-or-accept decision (owner DECIDED on the Phase 2 Playwright robot, the design ADR is separate; BOUNDARY: outbound slot-locking only, INBOUND flow is always in the parser). Phase 0 verification results [B5 archive]. *(GCal bridge DEAD — the platforms don't listen to an external calendar.)*

---

## 📣 Marketing & Retention

- ✅ **Campaign infrastructure** — C1 redesign (`3e26610`/`2ce03b1`) · discount codes 4 phases (`3c6c81d`..`fe875aa`) · re-engagement attribution (`ef7f751`) · C2/C2b/C2c premium email+preview (`82e86d6`/`1e81915`/`42cd5d4`) · C5 lapsed dedup A+B (`3c4039f`/`5fa051a`/`1bf3416`) · Marketing Performance card (`5218d91`) · email open/click tracking (`c87c883`/`7730e7f`) · C6 Marketing↔Analytics split (Marketing=`TABS=['campaigns']`, `2a2e92d`). *(detail: Completed › Marketing)*
- 🔵 **C3 abandoned-cart automatic** — manual "We've missed you" button ✅ LIVE. Remaining: X-hours-after-abandonment scheduled trigger (one-time guard + opt-out) · "You left something behind" prefill deep-link template · return-rate funnel. *(code-confirmed: only manual `sendAbandonedCart` onCall, no scheduled.)* Engine shared with C7/C3.1 scheduling.
- 🔵 **C8 audience scope** — `audienceScope` on a campaign (Clients default / Members / Everyone) + server-side member guard (NOT in `sendCampaignBulk`, `index.ts:2290`) + category library + founding-clients segment. Members receive client promos (a leak at the campaign layer). Spec: [CAMPAIGNS_V2.md](CAMPAIGNS_V2.md). *(code-confirmed open 2026-07-16)*
- 🔵 **C9 client card redesign** — Phase 1 ✅ LIVE (lifetime point-spend visibility + trusted client flag, `70247f0`). Phase 2: card full-height premium drawer, hero header + inline edit (owner will have it done with Claude Design → code after approval). Spec: [CLIENT_CARD_V2.md](CLIENT_CARD_V2.md).
- 🔵 **Slice 3b remainder** — (1) Revenue SSOT: reduce OverviewPanel gross `bookingRev` vs Reports net/paidAmount to a single source (keep aligned with Finance) *(code-confirmed: OverviewPanel still uses independent `bookingRev()` `OverviewPanel.tsx:48`)*; (2) design polish (two-column, numbers/% more prominent).
- 🔵 **Discount codes remainder** — end-to-end live test of a code (oncePerCustomer/limit/expiry) + %100-off online edge (£0 Stripe session).

---

## 🤖 AI

- ✅ **C10 salOWN AI accuracy pack + product knowledge** — buildContext DAILY TOTALS + DEFINITIONS, chat history, askAI auth guard (`1bd0885`/`695a61f`); `functions/src/ai/productGuide.ts` sitemap+~18 how-to (`58668af`). Maintenance rule: when a user-visible feature ships, add a line to productGuide.ts + targeted askAI deploy. *(detail: Completed › AI)*
- 🔵 **C10 remainder** — feature-flag awareness + tool-use → C4. *(code-confirmed: productGuide is a static string, no tool-use.)*
- 💡 **C4 salOWN AI (cross-tenant data assistant)** — owner/super-admin asks in natural language, the AI walks each tenant's Firestore and compiles. Parts: read-only tenant-scoped query layer · Claude tool-use → aggregation fns · NL→metric/table · PII/GDPR/tenant isolation. ⚠️ cross-tenant access is the most sensitive point. A subset of C1 suggestion + C3 funnel.

---

## 📱 Mobile (Staff App)

- ✅ **Staff App core** — D3 mobile stability (`4f1bd13`) · D4 modernization: speed+weekly+icon system+day-swipe (`e3f3e9f`) · D5 walk-in Booksy-cart redesign + iOS drift root-fix (`7f46858`) · D7 weekly schedule Day|Week (`20a3bcb`). Also: Setup/Shell/Today/Sheets/Clients/Sales/Reschedule/No-show/WorkingHours/Notification-bell all ✅. *(detail: Completed › Mobile + Staff App)*
- 🔵 **D0 hardening remainder** — push silent-failure (T2-7: FCM init try/catch exists but not surfaced in the UI, `StaffApp.tsx:159`) · reschedule time-guard (RescheduleSheet has a conflict-guard but NO opening-hours guard, `RescheduleSheet.tsx:141`) · empty-state/access message · silent-error swallowing. Full report: [STAFF_APP_HARDENING.md](STAFF_APP_HARDENING.md). *(code-confirmed 2026-07-16.)*
- 🔵 **D2 Google/Apple sign-in + onboarding routing** — the buttons are "coming soon" visuals (`LoginScreen.tsx:113`, NO provider wire). Parts: Google provider · Apple ($99/yr Service ID) · post-login member-check · onboarding flow (for an owner opening a new salon, the biggest task). *(code-confirmed open 2026-07-16)*
- 🤔 **D6 mobile catalog (decision pending)** — should adding a new service/barber from the phone be allowed, or panel-only? Owner deferred (2026-07-16). If done: "+" FAB → add-menu (Walk-in/New service[name+price+duration+category]/New barber[name+color]), schema parity. *(code-confirmed: no add-service/barber UI in the staff app — correct.)*
- ⏸ **D1 Capacitor / App Store** — iOS web push doesn't work → a native wrap solves it. **READY & WAITING, NO rush** (owner 2026-07-14: "we need to go over the app more"). Prep ✅ (D4 SVG icons + D5 viewport fix "Capacitor-safe"). Plan: [D1_CAPACITOR_NATIVE_PLAN.md](D1_CAPACITOR_NATIVE_PLAN.md); precondition $99/yr Apple+Mac+APNs. **Waiting.**

---

## 🛠️ Tech Debt & Reliability

- ✅ **TypeScript migration — v1.0.0 TAGGED (2026-07-13)** — codebase end-to-end STRICT TS (frontend 1400→0, functions 355→0, byte-proven). Post-1.0 chores (NOT release-blockers): dead-code chore (pending), any-narrowing, I2 split. Patterns: [MIGRATION_PATTERNS.md](MIGRATION_PATTERNS.md), [ARCHITECTURE_V2.md](ARCHITECTURE_V2.md). *(detail: Completed › Reliability)*
- ✅ **I1 parser silent-breakage canary** — `recordParserRun` in BOTH pipes (`tenants/{id}/parserStats/{source}`, daily counter + 0-import alarm).
- 🔄 **I2 `functions/src/index.ts` split** — Phase 1 (helpers→domain modules) ✅ effectively done (parity-tested). Phase 2: move the bodies of 55 exports into domain modules (index.ts 3816 lines). Slice 1 (askAI+auth) ✅ `bccd828`; **next is parsers** (see Current focus). 🔴 Golden rule: export name+config exactly matched. Operation: in a single CLEAN window, codebase-prefixed deploy (`--only functions:salown`, NEVER blanket). Plan: [TYPESCRIPT_MIGRATION_PLAN.md](TYPESCRIPT_MIGRATION_PLAN.md).
- 🔵 **G3 unsaved-changes guards** — forms silently lose data via backdrop/Esc/✕. The gold standard is in WalkInForm (dirtyRef) → shared `ConfirmDiscard` component. F1 (6 surfaces): Products · AddClientModal · Clients edit · BookingForm · BulkCampaign Compose · SendCampaignPanel. F2: CheckoutPanel/Settings. F3: staff app Sheets. *(code-confirmed: guard exists on 0/6 surfaces 2026-07-16)*
- 🔵 **salOWN ToS/Privacy pages** — the landing footer Terms/Privacy `href="#"` is dead (`hosting/index.html:648-649`); salOWN has NO ToS/Privacy page of its own (the whitecross tenant side ✅). Must be written before tenant onboarding scales (SaaS ToS + GDPR privacy + loyalty framework). *(code-confirmed open 2026-07-16)*
- 🔵 **Small infra** — G2 salOWNHub DNS (`salown.web.app/app`→`hub.salown.com`) · ~~EeKurt legacy site redirect~~ (tenant inactive 2026-07-18, dropped) · `categoryId` migration · dead `isStaff` Firestore rule.

---

## 🎨 Premium Themes (revenue line)

- 🔵 **F1 per-tenant public site themes** — two drop-in themes (`style.original.css`+`style.premium.css`) local, **NO deploy**. Remaining: live site sync (whitecross-site `siteTheme` onSnapshot+href swap) · panel "Available Themes" (`OnlineProfile.jsx`, Premium-gated) · theme registry · *(code-confirmed: no theme picker in OnlineProfile; whitecross-site hardcoded DEFAULT_THEME.)* Detail: memory `project_premium_themes`.
- 🔵 **F2 premium custom-domain site = ONE shared template, tenant-agnostic (owner 2026-07-23)** — the custom-domain booking site (`whitecross-site`) must NOT become per-tenant cloned copies; every premium tenant is served by a single tenant-parameterized codebase (reads `TENANT`, no salon hardcoding), so booking logic lives in one place and cannot drift. **Precedent set:** the staff-shift SSOT + 15-min overrun allowance fix (`whitecross-site/script.js` `e0003845`) was written tenant-agnostically for exactly this reason. Note: the salown-hosted booking (`/book/:tenantId`, `BookingPage.tsx`) ALREADY covers all tenants with the same rule (Phase 1) — so a premium tenant on the salown-hosted flow is already correct; F2 only concerns the custom-domain path. Keep the two engines' rules in sync (both reference `STAFF_SHIFT_OVERRUN_ALLOWANCE_MINS`) until they can share source.
- 💡 **Subdomain themed sites** — `{tenant}.salown.com` themed public site (same infra family as salOWNHub DNS).

---

## 🏪 Marketplace & Discovery

- 💡 **J1 Trust Score — outcome-based salon ranking** · 🕓 Vision locked (ADR-016, opens when the marketplace phase begins). Ranking in the salown.com consumer marketplace via an internal Trust Score (verified CHECKOUT, repeat-client, no-show behavior, rating consistency, longevity…). Principle: "reward outcomes, not activity" — a structural antidote to Fresha's fake-booking gaming. The score is for internal use. Spec: [DECISIONS.md ADR-016](DECISIONS.md).

---

## 🌍 Internationalization (TR market)

- 💡 **L1 TR localization** — gap analysis ✅ 2026-07-23: zero i18n infra; ~1,500–2,000 hardcoded EN strings, 486 `£`, 110 `'en-GB'`, ~45 `Europe/London`, no tenant `language`/`currency`/`timezone` field (the foundational blocker). Sequence: tenant locale triplet → central money/date formatters (incl. `£`-in-stored-data fix) → i18n + string extraction (customer-facing first) → email `lang` → tz/DST → small items. Minimum TR pilot = locale fields + formatters + booking SPA/email translation (panel may stay EN). Parser explicitly out of TR scope (owner 2026-07-23: no parsers in TR; iCal feed instead). Full analysis: [TR_LOCALIZATION_PLAN.md](TR_LOCALIZATION_PLAN.md).

---

## 🧪 Test Lists → [TESTS.md](TESTS.md)
All test records in one place: Firestore Rules (automatic, latest ✅ 95/95) · Security gate manual · Stripe live (TEST) · Staff App · Post-Class-A · Busy-slot v2.

---

# ✅ Completed (archive)

> The detail + commits of each ✅ in the active themes; dated tables at the very bottom.

### 🔒 Security & Rules
Tier 1 gate: Gate-G1 role-claim (`0f8de7e`, `tenantRole==null→admin` fallback removed, 49/49) · Gate-G2 bookings read tenant-scoped (`851efeb`, ruleset `22bdc429`) · Gate-G3 public-create financial forge guard (`851efeb`) · Gate-G4 staff-doc catch-all→false + 14 collections explicit (`0f8de7e`). Follow-up: T-a1 delete=super (`7e95d40`, AppRouter hardcoded `isAdmin=true` wired to the real claim) · T-a2 admin role-based (`643c8ce`, AuthContext exposes tenantRole) · T-d self-escalate behind super (`643c8ce`). Delete=super/owner: `694a762` (super-only, 65/65) → E1b owner tenant-scoped (`8670051`, ruleset `1a818130`, 81/81, 9 collections) → E1b+ barbers (`2af303c`, 83/83) + strong confirmation modal + '✓ Activate' (`25e6407`). Phase 1 cross-tenant hole (`ef31d16a`, 16/16, `firestore.rules` canonical).

### 👥 Employment Model & Staff (S + G4 + G5)
S2 Phase B: Staff Hub UI 12 commits (`c1103af..b7208a7`) + rules deploy (ruleset `1474907b`, staffComp=owner+super, 95/95) — tabbed drawer, PayModelChip, CompChangeFlow, wage hour..year + actual-work accrual semantics, paid-leave toggle, passive=close-comp-period, compUtils/staffCompActions unit-tested (59/59). S1 hole 1 barberName snapshot (`0db230c`). G4 weekly wages ledger (`1405020`, Mon–Sun carry-over ledger, pure-derivation, Arda £87-carry verified). G5 staff availability overhaul (owner "total chaos"): 2a-extra public projection `salownRepublishOnSettingsEdit` (`81f2824`) · 2a resolver shiftChange override (`282e5ae`) · 2b+3 Dashboard/BookingPage leave (`ca82f76`, returns automatically when leave ends) · step 4 server reschedule leave-guard (`2af65a0`) · step 5 semantic merge OVERRIDE WINS 5 surfaces (`e68dca8`) + Finance daily P/L leave-guard (`4b7b592`) + leave-history archive `barber.leaves[]` (`3898eb0`) · whitecross-site resolver port (`bc2f98ef`) · cycleStatus leave protection + audit (`b582042`). Muhamed on-leave case [STAFF_SETTINGS_AUDIT.md](STAFF_SETTINGS_AUDIT.md).

### 💳 Payments (A2, TEST mode)
Phase 0 onboarding `salownConnect{Start,Callback,Disconnect,Status}` (OAuth, tenant secret NEVER stored, only `acct_`) · Phase 1 Checkout `salownCreateCheckoutSession` + parallel `salownConnectWebhook` (`863e3db`, amount on the server, Direct charge, cross-check) · UI "Online payments" card (`8747fea`, mode selector + default deposit £ + gate) · Phase 2 policy · Phase 3 refund + configurable windows (`e3221cd`, `cancellationWindowHours`/`rescheduleWindowHours`). Owner verified all modes end-to-end in TEST (2026-07-04). whitecross-site's old Payment Link model (Phase 5) is live but Connect is retiring it.

### 📣 Marketing
C1 redesign Stage 1+2 (`3e26610`/`2ce03b1`, landing zone A-D + Templates + Compose 4-step) · re-engagement attribution (`ef7f751`) · discount codes 4 phases (`3c6c81d`/`e3841f7`/`c932ccf`/`fe875aa`, in-salon+online same code) · C2 premium campaign email (`82e86d6`) + C2b compose preview (`1e81915`) + C2c per-client preview DRY util (`42cd5d4`) · C5 lapsed dedup (`3c4039f`) + C5-A booking-only (`5fa051a`) + C5-B bulk stamp (`1bf3416`) · Marketing Performance card (`5218d91`, recovered revenue/returned/redeemed) · email open/click tracking `salownBrevoWebhook`→`emailEvents` (`c87c883`/`7730e7f`) · Marketing↔Analytics split Slice 1 Occupancy (`e8e57b5`) + Slice 2 campaigns-first (`5f4c874`) + Slice 3a Customers→Reports (`b9c5b2e`) + Slice 3b Overview→Insights, Marketing=campaigns (`5744937`, C6 effectively done) + client-identity SSOT (`eca8cc8`) + filter-scope clarity (`1fb9b28`) + orphan helper cleanup (`28bf376`). C9 Phase 1 client card lifetime+trusted (`70247f0`).

### 🤖 AI
C10 accuracy pack buildContext DAILY TOTALS+DEFINITIONS + chat history + askAI auth guard (`1bd0885`/`695a61f`) · productGuide.ts sitemap+how-to (`58668af`).

### 🎫 Onboarding & Parser Pipeline (H)
H1 `addToWaitlist` intake (`a2689f9`) · H2 P1 hide self-signup + P2 full form + P3 Applications tab `approveApplication`+`adminPurgeTenant` (`ae495a1`/`57e3959`) + approve 2 bug fixes (domain fallback + claim-clobber guard, INCIDENTS 07-02) · H3a analytics accuracy source/MRR (`fb92c8b`/`88b92cc`/`2e04a66`) · H3b owner-activity `adminGetOwnerActivity` (`5fb26e9`/`f4aee2b`/`b424aeb`) · H3c parse-inbox address UI (`a31538f`). H4 pilot: parse dispatch `salownParseInboxDispatch` + `messages.test.js` no-fork (41/41, `c944b28`) + DNS+Brevo inbound webhook + tokens (`1183f50` named token `<slug>_<32hex>`) + envelope-priority routing fix (`0b829ba`) + full lifecycle drill PASSED + first organic mail + Fresha pipe proven.

### 📱 Mobile & Staff App
D3 mobile stability 3-layer clamp (`4f1bd13`) · D4 modernization speed+Week tab+Icon.tsx 28 SVG+day-swipe (`e3f3e9f`) · D5 walk-in Booksy-cart WalkInFlow+orphan fix+iOS viewport root-fix (`7f46858`) · D7 weekly schedule Day|Week WeekScheduleGrid (`20a3bcb`). Staff App COMPLETE (except OAuth): Setup/Shell/Today/Sheets/Clients · Panel Parity · Permissions (7 permissions) · Notification bell (FCM) · Reschedule · No-show · WorkingHours validation · Sales · Login redesign.

### 🛠️ Reliability
TS migration v1.0.0: rc3 src→lib pipeline (`73ce8f8`, `v0.9.0-rc3`, 52/52 fn) → functions 100% TS (`7881cfe`) → strict everywhere functions 355→0 (`71312de`) + frontend 1400→0 (`eb348b7`), byte-proof v2. I1 canary `recordParserRun`. I4 Phase A staff/client audit (`2ab0328`).

### 🔧 Infra (G)
Email observability stamps (`56c8e5e`, confirmation/reschedule/cancellation EmailSentAt) · `dailyFirestoreBackup` fixed + 30-day lifecycle + failure-alarm (`740916b`, INCIDENTS 07-13) · www.whitecrossbarbers.com→apex 301 + GH Pages shutdown · confirmation email button email-safe table (`0d974f3`) + week-view source label + staff push London date · bounce-checker fix (`62d79fe3`) · G6 landing mobile (`288e566`) · loyalty legal terms no-cash-value (`2636d24` + whitecross `terms.html`).

---

### 🗓️ Dated archive

**2026-07-13** — Loyalty program legal terms (no-cash-value): emailTemplates (`2636d24`) + whitecross terms.html/loyalty.html.

**2026-07-03** — Online profile header resize+focal-point (`7d06c33`/`895a30a`) · Booking flow reorder (Service→Date→Time→Barber-ops, `94b11f9`) · Barber chosen-vs-auto tracking + salon badge · Product-sale visibility soldProducts SSOT (`84635ed`/`b5cebac`).

**2026-07-02** — Early-access funnel H1+H2 (`a2689f9`/`ae495a1`/`57e3959`) · Approve 2 bug fixes · Architecture review + docs brain system (ARCHITECTURE_REVIEW + theme I + README/GLOSSARY/4-layer memory).

**2026-06-27→07-01** — Campaigns redesign Stage 1+2 (`3e26610`/`2ce03b1`) · Plan enforcement Phase 1+3+5+6 (`0a31141`/`e2cd4b4`/`8189df4`/`2723220`) · Dashboard pill-customiser (`23f4191`) · Busy-slot v2 processing-time dynamic (`f958aee`) · whitecross→noreply@salown.com · Campaign sender selection (`f519356`/`124321b`) · Abandoned-cart manual button.

**2026-06-26** — Finance Partner Settlement Plan A (`8fae0d8`) · Platform "Both per booking" (`dc1a471`) · Treatwell fee 35%+VAT (`5f69f86`/`83b484c`) · Landing "OUR STORY" (`b89986d`) · Whitecross success "Add to Calendar" (`28262d9b`) · Confirmation/cancel/reschedule email 3-layer fix + live test · Google review incentive.

**2026-06-23** — Money NaN sweep (`pp()`) · New customer email set (5 builders) · Walk-in vs booking (`bookingType`) · Notification policy (single notification CONFIRMED) · New Settings toggles · Source salOWN≠Website.

**2026-06-21** — 🔒 Firestore cross-tenant hole closed (`ef31d16a`, 16/16) · Muhamed wage config · SINGLE SOURCE `firestore.rules` · Staff App login redesign · Grid source-color · eekurt lingering auth fix. Tools: `test-firestore-rules.py`, `firestore.rules.LIVE/ROLLBACK`.

**Whitecross → Class A Migration ✅ COMPLETE** — Booksy/Fresha/Treatwell parser · Loyalty email (Brevo) · Telegram+in-app notifications · Booking confirmation trigger · Cancel/reschedule email · `cleanupExpiredPending` multi-tenant · FCM push.

**Platform ✅ COMPLETE** — GDPR rules · Actor tracking · Client dedup engine · Service-eligibility no-preference · BST/UK timezone · Cancel/reschedule server-side callables · Booksy SLOT tombstone+externalId dedup · Race-check at submit · White screen on deploy fix.

**Stripe Phase 5 (whitecross-site) ✅ Live parts** — `expiresAt` PENDING · `salownStripeWebhook` · `salownBookingConfirmedEmailTrigger` · Settings→Integrations→Stripe UI · E2E test · Live test (2026-06-26). *(salown.com/book Connect flow = Payments theme.)*

---

### 📎 B5 Phase 0 archive (2-way sync verification)
❌ Neither platform listens to an external calendar LIVE (Booksy/Fresha sync is OUTBOUND only) → the GCal bridge (Phase 1) is DEAD. 🎯 Fresha "Import events from external calendar URL = COMING SOON" (primary source, owner saw it in the panel) → when released, paste `salownIcalFeed?tenantId=X` = zero code. Booksy offers none → Puppeteer-or-accept. Side gain: the Fresha EXPORT feed was obtained (`integrations.freshaIcalExportUrls`, a parser cross-check candidate). Booksy robot DECISION: owner approved (outbound only, Secret Manager, narrow permission, audit, kill-switch, isolated Cloud Run; INBOUND flow always in the parser).
