# STRIPE_CONNECT_PLAN.md

salOWN platform payment (deposit/full) architecture plan. **Status (2026-07-04): Phases 0–3 END-TO-END LIVE (europe-west2, TEST mode). Backend 6 Connect fns + refund/configurable-window fns deployed; Settings UI ("Online payments" card + "Booking policy" card) DEPLOYED (`8747fea`→CI hosting); Stripe TEST Connect app/webhook set up (`ca_Uov4x…`, sandbox "Turquoise Swing"). REMAINING: commission (0% wired), live-mode go-live, optional service-based deposit editor field. `features.stripe` only opens when connected+charges-enabled+in-a-paid-mode; live-mode still OFF. → for the test→live transition see "Go-Live Runbook (test→live)" below (2026-07-17); first live attempt is the whitecross online profile.**

Related: [BUSINESS_RULES.md](BUSINESS_RULES.md) (deposit flow), [FEATURE_FLAGS.md](FEATURE_FLAGS.md) (`stripe` flag), memory `project-salown-payments-vision`.

---

## Locked decisions (2026-06-24)

| Decision | Choice | Rationale |
|-------|-------|---------|
| **Connect type** | **Standard** (OAuth) | ZERO liability on the payment side. Refund/dispute/support between tenant+Stripe; platform is just an intermediary. Tenant has full Stripe Dashboard. |
| **Charge type** | **Direct charge** (on tenant account) | "Money goes directly to the tenant" vision. |
| **Commission** | `application_fee_amount` infrastructure set up, **starts at 0%** | Ready to take commission later. |
| **Deposit amount** | **Fixed £** (service-based `depositAmount`, tenant `defaultDepositAmount` fallback) | whitecross habit; not %. |
| **Payment mode** | per-tenant: `off \| deposit \| full \| optional \| pay_at_venue` | Tenant chooses their own (Treatwell/Booksy parallel). |
| **whitecross-site** | **UNTOUCHED** | Premium tenant's own payment channel (us-central1, own keys, `source:'Website'`). |

**The cost of Standard:** During onboarding the tenant briefly goes to Stripe's site (OAuth). Accepted.

---

## Current state (2026-06-24, evidenced)

- `BookingPage.jsx:558-559` — booking PENDING + `expiresAt` 30min ✅
- `BookingPage.jsx:569,722-723` — **static Payment Link redirect** ⚠️ (dead end)
- `functions/index.js:3797-3888` `salownStripeWebhook` — based on the link model; `?tenant=` param, per-tenant `stripeSecretKey`+`stripeWebhookSecret` from Firestore, `paymentState` hardcoded `'DEPOSIT_PAID'`, no `remaining` ⚠️
- `functions/index.js:3756-3787` `salownCleanupExpiredPending` — cancels PENDING>expiresAt ✅
- `functions/index.js:3894-3906` `salownBookingConfirmedEmailTrigger` — email if `stripeSessionId` exists ✅
- `Settings.jsx:1122-1136,630-636` — manual secret key entry; `features.stripe = !!stripeSecretKey` ⚠️
- ~~**No Connect code AT ALL.**~~ **UPDATED 2026-07-02:** Phase 0 Connect backend WRITTEN (awaiting deploy) — `salownConnectStart`/`salownConnectCallback`/`salownConnectDisconnect`/`salownConnectStatus` (OAuth; only `acct_` id is stored, not the tenant secret key). See "To do → A" below. The old manual secret-key input (`Settings.jsx`) still stands (not removed in Phase 0; will be removed after Phase 1).

### Why Payment Link is a dead end
A static single-amount URL: a separate link is needed for each service×price×(deposit/full) (doesn't scale), can't open a booking-specific amount, no optional choice, refund can't be automated. → A real `checkout.sessions.create` API is required.

---

## Target flow

```
Tenant connects Stripe account via Connect/OAuth (once)
   → settings/integrations: stripeAccountId, chargesEnabled, payoutsEnabled
        ↓
Customer booking → salownCreateCheckoutSession (callable)
   → amount computed ON THE SERVER from the service doc (don't trust client price)
   → stripe.checkout.sessions.create({...}, { stripeAccount: acctId }) [+optional application_fee]
        ↓
Customer pays → checkout.session.completed (event.account = acctId)
        ↓
salownStripeWebhook (SINGLE platform secret, resolve tenant from event.account)
   → metadata.paymentType → write paidAmount/remaining/paymentState → CONFIRMED
        ↓
salownBookingConfirmedEmailTrigger → email (already exists)
```

The gain from Connect Standard: **the platform NEVER holds the tenant secret key** — it operates with its own API key via the `{ stripeAccount }` header.

---

## Onboarding Flow — how the tenant connects Stripe (UX + API)

Goal: for the tenant, **one button + Stripe login + choose mode + save.** NO secret key entry/storage.

### One-time platform setup (once)
1. Stripe Dashboard → Connect → Settings → create **Connect application** → `client_id` (`ca_...`).
2. **Redirect URI:** `https://europe-west2-havuz-44f70.cloudfunctions.net/salownConnectCallback`.
3. Platform secret key → Cloud Function secret (not the tenants', the PLATFORM key).

### The flow the tenant sees
1. Settings → Integrations → Payments: **"Connect with Stripe"** button (+ "Money goes directly to your Stripe account" explanation).
2. Click → Stripe hosted page: **login** with an existing account (whitecross) or inline **new account** (herohairs: business+bank, Stripe does KYC).
3. Authorize → returns to salOWN → **"✓ Connected to Stripe"**.
4. Payment setting appears: `paymentMode` (off/deposit/full/optional/pay_at_venue) + `defaultDepositAmount £`. Save.
5. Done — bookings now open a Checkout Session on the tenant account.

### The tech behind each step
| Step | Component |
|------|-------|
| "Connect with Stripe" | `salownConnectStart` (callable) → OAuth URL: `connect.stripe.com/oauth/authorize?response_type=code&client_id=ca_…&scope=read_write&state=<tenantId+csrf>` |
| Login/authorize | Stripe hosted (platform does nothing) |
| Return | `salownConnectCallback` (onRequest): `?code&state` → `POST connect.stripe.com/oauth/token` (`grant_type=authorization_code`) → **`stripe_user_id` (acct_…)** → write `settings/integrations.stripeAccountId` → success redirect to Settings |
| Mode+deposit | `paymentMode`+`defaultDepositAmount` fields on `Settings.jsx` save |
| Disconnect | `salownConnectDisconnect` → `POST oauth/deauthorize` → delete `stripeAccountId`, mode `off` |

**Critical:** at the end of OAuth all we get is `acct_...` (account ID) — NOT the tenant secret key. When opening a charge, platform key + `Stripe-Account: acct_...` header is enough → the risk of holding a secret key in Firestore is entirely eliminated.

### whitecross vs herohairs
- **whitecross:** Already has a Stripe account (from whitecross-site). In OAuth just login + Authorize → the existing account connects (doesn't create a new one). 2 clicks. NOTE: this is only for whitecross's **salOWN bookings**; its own site stays on the old flow (~~untouched~~ → **partially revised 2026-07-16: deposit config will be read from the panel, see G**), both channels use the same Stripe account.
- **herohairs:** No account → "Connect with Stripe" → Stripe inline sign-up + KYC → done. Without leaving salOWN.

---

## To do — components

### A. Connect Onboarding (NEW) — OAuth instead of manual key · ✅ backend DEPLOYED (2026-07-04, TEST mode) · UI remaining
- ✅ `salownConnectStart` (callable) → produces Standard OAuth authorize URL (CSRF nonce `superAdmin/oauthStates/{nonce}`, 10min TTL).
- ✅ `salownConnectCallback` (onRequest) → `?code` exchange (`stripe.oauth.token`) → write `stripeAccountId` → HTML success page → Settings link.
- ✅ `salownConnectDisconnect` (callable) → `oauth.deauthorize` + clear acctId.
- ✅ `salownConnectStatus` (callable) → `stripe.accounts.retrieve` → returns+mirrors `{connected,chargesEnabled,payoutsEnabled,detailsSubmitted}`. **NOTE:** this **live-fetch** was used instead of the `account.updated` webhook (sufficient for Phase 0; the webhook can be added with the Phase 1 webhook-upgrade).
- 🔴 **Settings UI:** "Connect with Stripe" button + badge + Disconnect → **STILL MISSING** (zero references in `src/`; another session was going to do it, didn't happen). (The old secret-key input isn't removed either.) Contract: Start→go to url, on return Status→badge.
- ✅ **Deploy (2026-07-04):** 3 secrets set (`STRIPE_SECRET_KEY`+`STRIPE_CONNECT_CLIENT_ID`+`STRIPE_CONNECT_WEBHOOK_SECRET`) + 6 functions targeted deploy. ⚠️ Filter is codebase-prefixed: `firebase deploy --only functions:salown:<fn>,...` (without prefix gives "No function matches"). Endpoint smoke: callback+webhook HTTP 400 = live.

### B. Payment policy config (NEW)
- `settings/integrations.paymentMode`: `off|deposit|full|optional|pay_at_venue`.
- `settings/integrations.defaultDepositAmount` (£) + service doc `depositAmount` override.
- Settings UI + OnlineProfile service editor field.

### C. `salownCreateCheckoutSession` (NEW — core)
- Callable, tenant-scoped, **compute the amount on the server from the service doc**.
- `paymentType` (deposit/full) → `unit_amount`.
- `metadata: { docId, tenantId, paymentType, fullPrice, depositAmount }`, `client_reference_id=docId`, success/cancel URL.
- `{ stripeAccount: acctId }` [+ `application_fee_amount`].
- return `session.url` → BookingPage redirect.

### D. `salownStripeWebhook` (UPGRADE)
- **Connect webhook model:** single platform endpoint + single signing secret; resolve tenant from `event.account` (existing `?tenant=`+per-tenant secret changes).
- `metadata.paymentType` → `paidAmount = deposit?depositAmount:fullPrice`, `remaining = fullPrice-paidAmount`, `paymentState = deposit?'DEPOSIT_PAID':'PAID'`.
- New events: `charge.refunded` (cancellation), `account.updated` (onboarding).

### E. BookingPage UI (UPGRADE)
- `paymentMode==='optional'` → deposit/full modal on submit (whitecross `script.js:1015` reference).
- Call `salownCreateCheckoutSession` instead of static link.
- `pay_at_venue` → existing CONFIRMED flow (no payment).

### F. Cancel/Refund
- `salownCancelByToken` + 8h rule (BUSINESS_RULES.md) → seize deposit / refund (`{ stripeAccount }`).

### G. Premium custom-site deposit toggle (NEW — owner decision 2026-07-16) · 🔵 Planned
> **Decision revision:** The "whitecross-site UNTOUCHED" above (2026-06-24) is **partially revised.** The rails stay
> the same (premium tenant's own Stripe account/channel, us-central1, own keys) — BUT the custom site will now
> **READ the deposit on/off + amount from the panel/Firestore instead of hardcoding it.** Owner direction: "the premium member already
> has a site; deposit should be set from a single place exactly like OnlineProfile is configured, and Stripe should shape automatically."

**Problem (as of today):** whitecross-site `script.js` **HARDCODES** the deposit (`depositTotal = totalPeople * 10`,
`groupDepositPerPerson = 10`); it **ignores** the Firestore `paymentMode` (= `pay_at_venue` for whitecross) → the setting
conflicts with live behavior. No on/off toggle.

**Bridge READY:** the `public/booking` projection (Tier 2 Phase 1, `2db8721` LIVE 2026-07-16) already
carries `paymentMode` + `websiteDepositsEnabled` + `defaultDepositAmount` and the premium site (public) can read it.
Half the plumbing is ready — what's left is the custom site READING this + a Settings toggle.

**🔑 CHANNEL SEPARATION (owner decision 2026-07-16, critical):** The two booking channels must have **INDEPENDENT** payment settings —
a single toggle does not govern both. Owner: "I may want to take deposit/full from my own site but not from
the salown online-profile part." The two channels:
1. **salOWN-hosted** (`salown.com/s/{tenant}` profile + `/book/`) — existing `paymentMode` + `defaultDepositAmount` (BookingPage reads).
2. **Premium custom site** (whitecrossbarbers.com type) — **SEPARATE** `sitePaymentMode` + `siteDefaultDepositAmount` (new; whitecross-site reads).
- **Data model:** salown-side fields stay AS-IS (NO rename, no breakage risk); for the premium-site new separate fields
  (`sitePaymentMode`/`siteDefaultDepositAmount`, or a `sitePayments:{mode,deposit}` block). Both are added to the
  `public/booking` projection → BookingPage reads `paymentMode`, whitecross-site reads `sitePaymentMode`.
- **Settings UI:** TWO separate controls (or a channel selector) — owner configures each channel independently. One channel can have deposit ON
  the other OFF. (Note: the premium-site control is only visible to premium tenants that have a custom site.)

**To do:**
1. **Settings** — TWO SEPARATE payment controls (channel separation): the existing "Booking policy" card = salown-hosted
   (`paymentMode` + `defaultDepositAmount`, deployed in B). NEW = premium-site card (`sitePaymentMode` +
   `siteDefaultDepositAmount`), only visible to premium tenants that have a custom site. Each independent.
2. **Premium site (whitecross-site `script.js`)** — hardcoded £10 → read **`sitePaymentMode`/
   `siteDefaultDepositAmount`** from `public/booking` (NOT the salown-side `paymentMode`): off/`pay_at_venue` → no payment,
   directly CONFIRMED; deposit/full → config amount (per-person support for groups is preserved).
3. **whitecross-site `createCheckoutSession`** (us-central1, own fn) → take `unit_amount` from the Firestore config
   (do NOT TRUST what the client sends — the server is the sole authority for the amount; currently `parseFloat(client) || 10` = trusting
   the client, a security point to be fixed).

**Owner answers + Booksy model (2026-07-16, verified with screenshots):**
- **(a) Amount:** if a group, **per-person** (existing flow on the site as-is — `groupDepositPerPerson`). Single = service rule.
- **(b) DEPOSIT RULE model — Booksy one-to-one (LOCKED):** payment policy is **rule-based**. In Booksy: "No-Show
  Protection → Deposits → Rules"; each rule = **% or £ amount** ("client pays £X / %Y of service price upfront,
  deducted from total on checkout") + **Valid for: service list** (specific services are assigned; "+ Apply to
  services"). There can be multiple rules (£10 for cheap cuts, £30 for premium); unassigned service → no deposit (pay-at-venue).
  - **salOWN data model — `tenants/{id}/depositRules/{ruleId}`** (new collection, world-readable, like services):
    `{ type:'percent'|'fixed', value, mode:'deposit'|'full', serviceIds:[...] }`. `full` = 100% (when %/£ is set to 100 in Booksy).
    A service is in at most ONE rule (assigning to a new rule removes it from the old — Booksy behavior).
    **Resolution (at booking time):** service → containing rule → amount; if no rule → no deposit. Services+depositRules
    are already public → the site **reads directly** (join on the client; no extra projection needed).
  - **% option → "fixed £ only" decision (2026-06-24) revised:** Booksy offers both % and £; we support both too.
  - **Together with channel separation:** the channel **master switch** (premium site on/off · salown-hosted on/off,
    independent — in the `public/booking` projection) determines whether the channel WILL COLLECT deposit; **depositRules
    are SHARED** (same service same amount, independent of channel). Channel off → no deposit on that channel, rules ignored.
- **(c) Premium gating:** ⏳ owner hasn't clarified yet (probably Pro+ / custom-site owner tenant).

**UI (Booksy-like):** a "Deposits" section in Settings — rule list (like a `£10 · 22 Services` row) + "Add Rule";
edit screen: left %/£ + amount stepper, right "Valid for" service select/remove. (The existing `service.depositAmount` field migrates to this
model or becomes a rule reference — the transition decision at build time.)

**Phase order (owner 2026-07-16):** FIRST premium custom site (whitecross-site); **in a LATER stage** the same depositRules
to **salown-hosted (online profile) bookings** too. The two channels are independent (master switch) → the second phase doesn't break the first.

**⚠️ Note (2026-07-16):** ROADMAP was restructured (Employment Model theme etc.); this spec's ROADMAP counterpart
must be re-linked (S/A2 item IDs may have changed).

**⚠️ Risk (🔴 live revenue path):** whitecross-site is LIVE, a real-money active Stripe flow. Changing deposit logic
= changing the revenue path → **owner test booking is REQUIRED**, a separate + careful step. Do NOT CONFUSE it with the salown-side `features.stripe`
live-mode go-live (that's europe-west2 Connect, separate). Independent of Tier 2 Phase 2/3; per owner priority.

---

## Data model — to add

```
settings/integrations:
  stripeAccountId, chargesEnabled, payoutsEnabled, detailsSubmitted   // Connect
  paymentMode, defaultDepositAmount
  (stripeSecretKey / stripeWebhookSecret → TO BE REMOVED)
services/{id}: depositAmount   // optional override
bookings/{id} (webhook writes):
  paymentType, paidAmount, remaining, paymentState,
  stripeSessionId, stripePaymentIntent, stripeAccountId, refundedAmount?
```

---

## Phase order
0. **Connect onboarding** (A) — connect account, remove secret key risk. (Payment still off.) → ✅ **backend DEPLOYED 2026-07-04 (TEST); Settings UI remaining.**
1. **Session + webhook** (C+D) — full payment end-to-end on a single service (test mode). → ✅ **backend DEPLOYED 2026-07-04 (`salownCreateCheckoutSession`+`salownConnectWebhook`); for end-to-end test from the UI, the Settings Connect button + a BookingPage attempt are needed.**
2. **Policy + deposit** (B+E) — deposit/full/optional, service-based fixed £. → ✅ **DEPLOYED 2026-07-04:** Settings "Online payments" card (mode selector + default deposit); BookingPage already wired. Service-based `depositAmount` supported in the backend, editor field remained optional.
3. **Refund/cancel** (F) + commission (`application_fee`). → ✅ **DEPLOYED 2026-07-04:** `salownCancelByToken` refunds on eligible cancellation; `salownConnectWebhook` reflects `charge.refunded` (collectionGroup index); cancel/reschedule windows tenant-configurable (Settings "Booking policy"). Commission wired at 0%.
4. **Go live:** first herohairs (no own site = the real need), then optionally whitecross. → ⏳ can be tried end-to-end in TEST mode; live-mode go-live depends on the real-money decision.

---

## Go-Live Runbook (test→live) — 2026-07-17

**Context (owner 2026-07-17):** Connect code is end-to-end live with a TEST/sandbox key. **The Connect architecture STAYS** —
we only switch the deployed secrets test→live (the code is key-agnostic). The first real live attempt =
**from whitecross's salOWN online profile.** whitecross-site's own us-central1 payment channel is
INDEPENDENT of this, **untouched.** The premium site `paymentMode` deposit/full/pay-at-venue selection (section G) is left **for LAST.**

**Code state (2026-07-17, evidenced):** the Connect pipe is COMPLETE — onboarding (`salownConnectStart/Callback/Disconnect/Status`),
checkout (`salownCreateCheckoutSession` server-side amount), webhook (`salownConnectWebhook` PENDING→CONFIRMED +
`charge.refunded`). Mode derives from the deployed `STRIPE_SECRET_KEY` prefix (`index.ts:3095`). Only added code:
**mode-mismatch guard** — test `acct_` under a live key → a clear "reconnect" message instead of a cryptic Stripe error
(`salownCreateCheckoutSession`; `salownConnectStatus` returns a `modeMismatch` flag).

### 1. Precondition — owner in Stripe Dashboard (LIVE mode)
1. Put the Dashboard in **live mode**; activate Connect in live.
2. Connect application → get **live `client_id`** (`ca_…`) (the test one is `ca_Uov4x…` sandbox "Turquoise Swing").
3. **Live platform secret key** (`sk_live_…`).
4. Connect application → Webhooks → add endpoint (LIVE):
   - URL: `https://europe-west2-havuz-44f70.cloudfunctions.net/salownConnectWebhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`
   - → live signing secret (`whsec_…`).
   - The OAuth redirect URI must be the same in the live app: `…/salownConnectCallback`.

### 2. Deploy (secret swap + TARGETED functions deploy)
```bash
# Set the 3 secrets to live values:
firebase functions:secrets:set STRIPE_SECRET_KEY --project havuz-44f70             # sk_live_…
firebase functions:secrets:set STRIPE_CONNECT_CLIENT_ID --project havuz-44f70      # ca_… (live)
firebase functions:secrets:set STRIPE_CONNECT_WEBHOOK_SECRET --project havuz-44f70 # whsec_… (live)

# TARGETED deploy — codebase prefix REQUIRED (blanket --only functions = deletes us-central1 orphans):
firebase deploy --project havuz-44f70 --only \
functions:salown:salownConnectStart,functions:salown:salownConnectCallback,\
functions:salown:salownConnectDisconnect,functions:salown:salownConnectStatus,\
functions:salown:salownCreateCheckoutSession,functions:salown:salownConnectWebhook
```
Smoke: `salownConnectCallback` + `salownConnectWebhook` GET → HTTP 400 = live.

### 3. Tenant re-onboard (whitecross FIRST)
- **Critical:** the account connected in test holds a test `acct_`; it won't work with a live key. The mode-mismatch guard catches this
  with a "reconnect" error (not a silent crash).
- whitecross Settings → Integrations → **Disconnect** (the test connection, if any) → **Connect with Stripe** (now live OAuth)
  → login → `stripeConnectMode:'live'` is written.
- `salownConnectStatus` → verify `chargesEnabled:true`.

### 4. First live test + go-live
1. 1 real booking from whitecross online profile → pay deposit/full (small amount).
2. Verify: did the webhook turn PENDING→CONFIRMED · are `paidAmount`/`remaining` correct · did the email go out.
3. Refund test: refund from Stripe Dashboard → did the booking reflect `paymentState:'REFUNDED'`.
4. **Only if all ✅** → `features.stripe` (super-admin) ON for whitecross.

### 5. Rollback
- Problem → turn off `features.stripe` (super-admin) → bookings revert to the payment-less CONFIRMED flow.
- Set the secrets back to test + redeploy (code is the same, key-agnostic).

## Risks
- The webhook secret model necessarily changes with Connect (per-tenant → single platform) — migrate carefully.
- **Never take the amount from the client** (forge; SYSTEM_ARCHITECTURE.md:75 rule).
- Zero touch on whitecross-site.
- The `features.stripe = !!stripeSecretKey` logic (`Settings.jsx:635`) must bind to `chargesEnabled` once it switches to Connect.

## Effort (rough)
Phase 0-1 ~2-3 days · Phase 2 ~2 days · Phase 3 ~1-2 days · total ~1 focused week. Not urgent; start when herohairs need arises.
