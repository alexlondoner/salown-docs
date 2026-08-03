# TESTS.md — All test records (single source)

> **Purpose:** Every test to be done/done, in one place. It was previously scattered across ROADMAP.md;
> collected here so we don't have to search "was that test done?" every time. Each section can be handled at a
> different time — the status checkboxes (`[ ]`/`[x]`) are kept up to date.
>
> **Categories:** 1) Firestore Rules (automated) · 2) Security gate manual · 3) Stripe live ·
> 4) Staff App · 5) Post-Class-A migration · 6) Busy-slot v2 (separate doc).

---

## 0. 🔥 PRIORITY — Whitecross-site EXTRA SERVICE go-live (2026-07-18)

> **Context:** Single-person multi-service (extras) added to whitecross-site (client Phase 1). Currently `EXTRAS_ENABLED=false` (dormant). Enabling step = flag `true` + `firebase.saas.json` hosting redeploy. The salOWN consuming side is ready (`normalizeSoldAddOns` bookingUtils.ts, `CheckoutPanel` idOf=`productId||serviceId||id`, `TimeGrid` duration>0 chaining). The webhook was NOT touched (client writes `soldAddOns` to PENDING, webhook merge preserves it).
> **Environment:** `whitecrossbarbers.com/?testMode=1` (noindex + test Stripe), card `4242 4242 4242 4242`. Check: site + salOWN panel/calendar + staff app + Firestore.
> **Ordering rule:** Don't move to Section 3 until Section 1 (regression) is fully ✓ (so the issue is isolated).
> **Warning:** A test booking triggers Telegram/push (salOWN app functions, no testMode exemption).

**1. 🔴 Regression — is the existing flow the same (this first):**
- [ ] Single service, NO extra → slot → Book → Stripe **deposit** → success → salOWN CONFIRMED, duration/price correct.
- [ ] Same with **full payment (full)**.
- [ ] **Group booking** works (2 people, separate slots, groupId).
- [ ] A single **Extras service as the main service** (deposit-less flow) works.
- [ ] Confirmation email + Telegram/push arrives.

**2. Extra UI (new):**
- [ ] Panel opens when a main service is selected; not visible before selection.
- [ ] Chips are only the Extras category, excluding the selected main service.
- [ ] Add/remove → cart correct (quantity · +duration · +£).
- [ ] When main service changes, invalid extras drop off.
- [ ] When group mode opens, extras are hidden/cleared.

**3. 🔴 salOWN compatibility — "must not drop/collide" (the real thing):**
- [ ] **Slot duration:** adding an extra narrows the slots by TOTAL duration (main+extra).
- [ ] **🔴 Collision:** booking with extras → in salOWN, a time overlapping the extra's queue for the same barber → **blocked** (no double-booking).
- [ ] Firestore PENDING: `duration`=total, `endTime`=start+total, `soldAddOns`={serviceId,name,price,qty,duration}.
- [ ] CONFIRMED (after Stripe): `soldAddOns` + total duration preserved (webhook didn't overwrite).
- [ ] salOWN calendar: extra chained below the main block with correct duration.
- [ ] salOWN checkout: extra comes into the total, checkout completes, `paidAmount` includes the extras.

**4. Smart date (already live, verify in the same round):**
- [ ] After evening/closing → next open day; daytime → today; closed day skipped; 6:45 last slot holds; today can be selected manually.

**5. Edge cases:**
- [ ] Deposit+extra: deposit £10 fixed, remaining=total−10, extra pay-at-venue.
- [ ] Confirmation email lists the extras.
- [ ] Mobile (form+chip+cart). Cancel/reschedule links work.

---

## 0. 🔥 PRIORITY — Abandoned-cart "We've missed you" + Marketing email delivery (2026-06-26)

> Code ready, build ✓. **A (app)** = `BookingDetailPanel.jsx` button (main push → CI hosting). **B (functions GDPR)** = `sendMarketingEmail` opt-out+unsubscribe (`firebase deploy --only functions`). The opt-out/unsubscribe items below **don't pass until B is deployed**.

**Precondition:**
- [ ] On the tested tenant, `tenants/{tid}/settings/emailConfig` is filled (Gmail `email` + `appPassword`). Filled on whitecross (booking confirmations go with the same creds).

**Existing flow — "is email really being sent?" (can be tested even without B deploy, LIVE):**
- [ ] Marketing → Campaigns → create a `re-engagement` template (name/subject/message, should contain `{name}`).
- [ ] Clients → a customer with an email → "Send campaign" → re-engagement → pick template → Send. **Does the real email reach the customer** (from the salon Gmail, "via salOWN")?
- [ ] For a customer with empty email, is the button/send blocked with "No email address"?

**RENEWED 2026-06-30 — "Finish your booking" button (direct-send, commit 870c46d, DEPLOYED):**
> The old "We've missed you" → renamed to "Send 'Finish your booking'" and now, INSTEAD of `SendCampaignPanel`/generic re-engagement, sends the dedicated `sendAbandonedCart` callable + the `buildAbandonedCartHtml` ("Your spot is still warm") email with a **single click**.
- [ ] When a booking that left without paying from the web (PENDING or CANCELLED + `source==='website'` + has email) is opened, the **"Send 'Finish your booking'"** button appears in the panel.
- [ ] On walk-in / staff-created / email-less bookings the button is **not visible**.
- [ ] On press it sends **instantly** (no panel opens) → toast "Recovery email sent".
- [ ] Arriving email: "Still want that fresh cut?" + "You were booking" card + single CTA **"Book My Slot →"** → `salown.com/book/{tenant}?service=<id>` (service opens pre-selected) + "No deposit — pay at the salon" + Unsubscribe in the footer.
- [ ] **GDPR:** to a customer who opted out (`client.emailOptOut===true` or `emailOptOuts/{email}`) → email is NOT sent, toast "Client opted out". Arriving email has Unsubscribe + `List-Unsubscribe` header.

**NEW 2026-06-30 — Appointment reminder (commit 870c46d, DEPLOYED):**
> `salownSendReminder` callable + `buildReminderHtml` ("See you soon"). The email is automatically light/dark based on the customer's DEVICE theme (`prefers-color-scheme`; light fallback in Gmail).
- [ ] When a CONFIRMED + emailed booking with **≤2 hours** left to the appointment is opened, the 🔔 **"Send reminder email"** button appears in the panel.
- [ ] Appointment >2 hours away / past / no email / not CONFIRMED → button **not visible**.
- [ ] On press it sends instantly → toast "Reminder sent"; email has date/service/barber/location/price + "Manage Booking" + hoursUntil ("in about 2 hours") correct.
- [ ] **Dark mode:** on a dark-themed device/in Apple Mail the email renders dark (background/card/text); light in Gmail web.
- [ ] (The existing WhatsApp "Send Reminder" button is a separate channel, not affected.)

---

## 1. Firestore Rules — AUTOMATED (`docs/test-firestore-rules.py`)

No Emulator/Java REQUIRED; uses the Firebase Rules Test API (token: firebase-tools login).
```bash
python3 docs/test-firestore-rules.py salown-app/firestore.rules
```

**Last run: 2026-08-02 → ✅ 170/170 passed** (TR-D1 Phase 3 added 16 on top of Phase 2B's 154; Phase 2B added 9 on top of the TR-A 145; TR-A added 14 on top of the 131/131 R1 phase-A baseline).

TR-A's 14 cases gate the `presentation` write (owner/super-admin only, on BOTH the canonical
settings doc and the world-readable root mirror). Half of them are deliberately NO-REGRESSION
cases — staff and admin must still be able to write every OTHER settings field — because a
localization package has no business tightening unrelated permissions.

> **Count history — the `49/49` figure is dead.** `49/49` was the 2026-06-27 G1+G4 run and it
> lingered in this file, in the `firestore.rules` header and in `firestore.rules.LIVE` long after
> the suite had grown. The real pre-R1-A baseline was **95/95** (after the S1/staffComp deploy
> `1474907b`). Corrected here and in `salown-app/firestore.rules` by R1 phase-A (`2a6a641`).
> `firestore.rules.LIVE` still shows the stale marker **on purpose** — it is a verbatim snapshot of
> the deployed ruleset and must not be hand-edited; it refreshes on the next rules deploy.

Behaviors covered (run AFTER every rules change + BEFORE deploy):
- Cross-tenant isolation (WX→HERO read/write/deep/delete → DENY) — Phase 1
- Same-tenant flows (booking create, checkout update, clients write, deep campaignsSent, Settings tenant-root write → ALLOW)
- Public/unauth (booking create ALLOW, services read ALLOW, cancel-update-only-status ALLOW, forbidden-field-update DENY)
- Super-admin (cross-tenant ALLOW, top-level fallback ALLOW; tenant user top-level → DENY)
- **[G2]** unauth booking read DENY · WX own read ALLOW · cross-tenant read DENY · super ALLOW
- **[G3]** unauth create + paidAmount/tip/discount DENY · plain create ALLOW · auth+paidAmount ALLOW
- **[R1-A]** (2026-07-24, 36 cases) anonymous create + each of `clientManualId` / `matchedBy` /
  `identityLinkedBy` / `identityLinkedAt` / `clientPhoneCanonical` / `emailCanonical` / `note` → DENY,
  individually and combined · verbatim hosted legacy payload (`BookingPage.tsx:739`, CONFIRMED +
  PENDING) and verbatim Whitecross premium single + group payloads (`script.js:1462`, `:1695`) →
  ALLOW · anonymous update adding or modifying any of the seven → DENY (asserts the existing
  `hasOnly` allowlist) · authenticated staff/admin create with `note` + link fields → ALLOW · staff
  `BLOCKED` and `Busy` block-time → ALLOW · cross-tenant staff create with staff-only fields → DENY ·
  **three phase-B guards**: plain anonymous PENDING / CONFIRMED / paymentState creates must stay
  ALLOW, so an accidental R1 phase-B turns the suite red.
  ⚠️ The Admin SDK / `salownCreateBooking` callable is deliberately **not** represented — it bypasses
  rules, so emulating it as a client would assert a permission it never requests.

> ⚠️ **When G4 is applied** (staff catch-all enumeration) new cases to be added to this suite:
> - [ ] staff (not admin) writing own `staff/{uid}.permissions` → **DENY**
> - [ ] admin → staff doc write → **ALLOW**
> - [ ] tenant member → clients/campaigns/settings/finance/products/auditLogs write → **ALLOW** (did the enumeration leave anything out?)
> - [ ] ALLOW for EVERY writable collection under the catch-all (advances, cover, expenses, investment, logo, notifications, team, fcmTokens)
>
> See: [SECURITY.md](SECURITY.md) §3 G4.

---

## 2. Security gates — MANUAL (around deploy)

Context: [SECURITY.md](SECURITY.md). **Status source = [ROADMAP.md](ROADMAP.md) Pre-Scale Gate** (SSOT).
✅ **G1+G2+G3+G4 LIVE** (verified 2026-07-02): `0f8de7e` (G1+G4) + `851efeb` (G2+G3), ruleset `22bdc429`,
automated test 49/49. The manual smoke cases below are kept for **one more confirmation after deploy**.

### G1 — role-claim backfill ✅ LIVE (`0f8de7e`) — smoke confirmation
- [x] Fallback removed (`firestore.rules`), claims were already complete (dry-run "0 changes"), 49/49 test.
- [ ] (smoke) An admin user re-login → can they write tenant-doc (features) from Settings? (didn't break)
- [ ] (smoke) A staff user re-login → is an admin-only operation still blocked?
- [ ] ⚠️ **T-a follow-up:** `AppRouter.jsx:104` `isAdmin=true` hardcode → tie the new staff to the real role before entering the web panel.

### G2/G3 — live smoke after deploy (once rules are deployed)
- [ ] **whitecross booking CREATE** (from whitecrossbarbers.com) → successful (G3 didn't break it)
- [ ] **herohairs booking CREATE** (salown.com/book) → successful
- [ ] **Panel** (salown.com/app) bookings/calendar loads (G2 auth read works)
- [ ] **Staff app** (staff.salown.com) today's appointments load
- [ ] whitecross Stripe-back scenario: payment cancelled → slot frees up ~15 min later (cleanup; not instant — expected)
- [ ] whitecross-site console: `permission-denied` log does NOT BLOCK the booking (fails-open)

---

## 3. Stripe Live Test (whitecross) — 🗄️ LEGACY (not done, NOT NEEDED)

> **SUPERSEDED (2026-07-02):** This was the test of the old **Payment Link + manual secret-key + `salownStripeWebhook`**
> model — since we moved to Stripe **Connect**, that flow is being retired. Do **not** do this test;
> **Section 3b (Stripe Connect)** replaced it. The below stays as archive/reference.
> (Note: whitecross-site's OWN Stripe flow is separate and live — see [STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md) line 18; that is not touched.)

**Setup (one time):**
- [ ] Stripe Dashboard → Webhooks → Add endpoint:
  `https://europe-west2-havuz-44f70.cloudfunctions.net/salownStripeWebhook?tenant=whitecross`
  Events: `checkout.session.completed` + `checkout.session.async_payment_succeeded`
- [ ] Copy `whsec_...` signing secret
- [ ] salOWN panel → Settings → Integrations → Stripe: secret key + webhook secret → Save

**Test A — End-to-end test button:**
- [ ] Settings → Integrations → Stripe → test Payment Link URL → Run test booking
- [ ] Pay with test card `4242 4242 4242 4242`
- [ ] Firestore `STRIPE-TEST-...` → `status: CONFIRMED`
- [ ] "Booking Confirmed" email to `whitecrossbarbers@gmail.com`
- [ ] Functions logs: both functions ran

**Test B — Real booking:**
- [ ] Booking from the Whitecross booking page (service has `depositUrl` set)
- [ ] Stripe payment → webhook → CONFIRMED + email

**Test C — Cleanup:**
- [ ] Wait 30 min (salown) / 15 min (whitecross-site) for a PENDING booking → `CANCELLED`

---

## 3b. Stripe Connect — END-TO-END TEST PLAN (2026-07-04)

> Standard Connect + Direct charge. Plan: [STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md).
> **All in TEST mode** (`sk_test_` platform key, Stripe sandbox "Turquoise Swing") → NO real money.
> **Status:** Phase 0–3 backend + UI LIVE. **A + B + D + E ✅ TEST DONE** (owner verified all modes end-to-end 2026-07-04). Remaining: G (refund), H (windows), F (webhook edge), I/J (security/isolation), K (barber availability retest).
> Test card: `4242 4242 4242 4242` · future date · any CVC/postcode. In the cancel-refund test, verify the refund in Stripe Dashboard → Payments.
> **Marker:** `✅ TEST DONE` = owner verified live · `[x]` verified · `[ ]` pending.

**Setup (one time) — ✅ DONE:** `client_id ca_Uov4x…` + redirect URI + platform `sk_test` + webhook (`salOWN-connect`, Connected-accounts scope, `checkout.session.completed`+`charge.refunded`) + 3 secrets set + 6 fn deploy (with `functions:salown:<fn>` codebase-prefix).

### A. Onboarding (Settings → Integrations → Online payments) — ✅ TEST DONE
- [x] "Connect with Stripe" → OAuth → Authorize → on return `?tab=integrations` + "✓ Connected" badge ✅
- [x] `integrations.stripeAccountId=acct_…` written (no tenant secret key) ✅
- [x] `salownConnectStatus` → charges/payouts status reflected in the badge ✅
- [ ] `superAdmin/auditLog` → `stripe_connected` record exists
- [ ] **Disconnect** → `stripeAccountId` cleared + badge gone + root `features.stripe/paymentMode` closed → next booking CONFIRMED without payment

### B. Payment modes — ✅ TEST DONE (owner verified all modes, 2026-07-04)
- [x] **off** ("Don't take payment") → instant CONFIRMED, "Pay at the salon", NO Stripe ✅
- [x] **pay_at_venue** → instant CONFIRMED, no payment step ✅
- [x] **deposit** → confirmation breakdown (total/deposit/remaining) → Pay now → Stripe → success → CONFIRMED ✅
- [x] **full** → "Pay £X now" → Stripe → success "Paid in full", remaining=0 ✅
- [x] **optional** → 2 buttons in confirmation (deposit / full); both paths correct amount ✅
- [x] Payment-policy save → confirmation step ("your payment system will work like this") + processing→saved ✅ (`e3221cd`)

### C. Amount accuracy (computed on the server — client not trusted)
- [ ] deposit amount = service `depositAmount` ?? tenant `defaultDepositAmount`
- [ ] full amount = service (or variation) price
- [ ] Attempt to forge the amount from the client → server computes from the service doc, forge ineffective (`SYSTEM_ARCHITECTURE.md:75`)
- [ ] both slug/real-id serviceId resolve (fn: id→slug(name)→booking.price fallback)

### D. Success page (Stripe return `?paid=1`) — ✅ TEST DONE (owner + Chrome local)
- [x] salOWN-style "You're all set!" + gradient badge + confetti + breakdown ✅
- [x] deposit variant: Service total / Deposit paid / Due at salon ✅
- [x] full variant: "Paid in full £X" ✅
- [x] if loyalty on: points + ≈£ reward card; double-points → "⚡ Double points" ✅ (Chrome local + live)
- [ ] Add to calendar link correct date/time; "Book another" resets (spot-check)

### E. Staff/Admin booking detail (BookingDetailPanel) — ✅ TEST DONE (deposit)
- [x] deposit booking → "Deposit paid £10 / Remaining / Total" (paymentType UPPERCASE) ✅
- [ ] full booking → "Fully paid online" (spot-check)
- [ ] pay-at-venue booking → "Amount"/"Pay at venue" (spot-check)

### F. Webhook & data integrity
- [x] `checkout.session.completed` → PENDING→CONFIRMED + `paidAmount/remaining/paymentType(UPPERCASE)/paymentState/stripeSessionId/stripePaymentIntent` ✅
- [ ] **Isolation:** `event.account` ≠ stored `stripeAccountId` → `account_mismatch`, NO write
- [ ] Cleanup: unpaid PENDING 30 min → CANCELLED (`salownCleanupExpiredPending`)
- [ ] Confirmation email is sent on CONFIRMED (`salownBookingConfirmationTrigger`)

### G. Cancellation / Refund — ✅ TEST DONE (2026-07-04, synthetic real-charge test)
- [x] Cancel a deposit-paid booking **OUTSIDE the window** → `salownCancelByToken` `{cancelled:true,refunded:true,refundedAmount:10}`; Firestore `status=CANCELLED`+`paymentState=REFUNDED`+`refundedAmount=10`+`stripeRefundId`; Stripe `charge.refunded=true`, `amount_refunded=£10` ✅
- [x] Cancel **INSIDE the window** (2h) → rejected: *"Cancellations must be made at least 8 hours before the appointment"* (NO refund) ✅
- [x] Staff panel refunded booking → **"Refunded £10 · Card (online)"** (`01b8342`) ✅
- [ ] Manual refund from Stripe Dashboard → `charge.refunded` webhook → reflected in the booking (collectionGroup index) — not tested yet

### H. Cancellation/reschedule windows (Settings → General → Booking policy)
- [ ] Change `cancellationWindowHours` (e.g. 8→2) → cancellation limit per the new value
- [ ] Change `rescheduleWindowHours` → reschedule limit per the new value; `0` = unrestricted
- [ ] After reschedule, `paidAmount`/deposit preserved (not reset)

### I. Security / edge cases
- [ ] checkout attempt for a non-PENDING booking → rejected
- [ ] paying-mode on a charges-enabled=false account → gate doesn't open (booking CONFIRMED without payment, "Pay at salon")
- [ ] `integrations` doc not publicly readable (no secrets); only `paymentMode`/`defaultDepositAmount` public at root

### J. Isolation / regression
- [ ] **whitecross-site (whitecrossbarbers.com)** own payment flow NOT AFFECTED (separate fn/key, `source:'Website'`)
- [ ] Walk-in / other source bookings + checkout work normally

### K. Barber availability (bug fix `0ffabf4`, retest) + booking celebration (`890c481`)
- [ ] On an off-day the barber **cannot be selected** (not in the barber step list) — all tenants
- [ ] On an off-day the barber is **not auto-assigned** (No preference → only those working that day)
- [ ] On an empty day (no booking that day) the off-barber also doesn't drop in (fast-path fix)
- [ ] Booking submit → "Securing your spot…" processing → "You're all booked!" animation (pay-at-venue/off); paying-mode → goes to Stripe

---

## 4. Staff App (staff.salown.com) — to do

**Reschedule:**
- [ ] Booking detail → "Reschedule" → sheet opened
- [ ] New date/time → "Confirm" → Firestore updated
- [ ] Attempt a full time → conflict warning
- [ ] Reschedule not visible on a CHECKED_OUT booking

**No-show:**
- [ ] "No show" → "Confirm?" → `NO_SHOW`
- [ ] No button for a user with `canCancelBookings:false`

**Working hours:**
- [ ] Appointment outside hours → ⚠️ warning appears but the record is saved
- [ ] Within hours → no warning

**Sales tab:**
- [ ] 💷 Sales → opened; has checkout → revenue; none → empty state
- [ ] `canViewRevenue:false` → figures hidden, only the count
- [ ] Barber mode → only own sales

---

## 5. Post-Class-A Migration Verification

| # | Scenario | Manual ✓ | Watched 24h | Clean |
|---|---------|----------|-------------|-------|
| 1 | New booking from Panel → customer confirmation email | ☐ | ☐ | ☐ |
| 2 | Add walk-in → email NOT SENT | ☐ | ☐ | ☐ |
| 3 | Booksy/Fresha import → email NOT SENT | ☐ | ☐ | ☐ |
| 4 | Customer cancels from email link → cancellation email | ☐ | ☐ | ☐ |
| 5 | Customer reschedules from email link → email with new date | ☐ | ☐ | ☐ |
| 6 | Checkout + loyalty toggle → loyalty email | ☐ | ☐ | ☐ |
| 7 | Staff App login → push permission → push when a booking arrives | ☐ | ☐ | ☐ |
| 8 | Staff App logout → token removed from `fcmTokens` | ☐ | ☐ | ☐ |
| 9 | on barber-mobile, no push when a booking arrives | ☐ | ☐ | ☐ |
| 10 | For a single booking, Firebase logs: each channel only once | ☐ | ☐ | ☐ |

---

## 6. Busy-slot v2 / Processing-time — SEPARATE DOC

Full matrix: **[BUSY_SLOT_V2_TESTPLAN.md](BUSY_SLOT_V2_TESTPLAN.md)** (sections A–F).
**🚀 DEPLOYED 2026-06-24** (functions + hosting:salown, commit a0d70e0). Flag ONLY HeroHairs.
Live verification checklist → **§7 (below).**
Design: [BUSY_SLOT_V2.md](BUSY_SLOT_V2.md) · unit test: `salown-app/src/utils/conflictUtils.test.js` (25/25)

---

## 7. 🚀 Live Release Verification — 2026-06-24 (Service Editor + Squeeze-in + Self-booking)

> Commit `a0d70e0`, functions + hosting:salown **LIVE** (salown.web.app). `features.processingTime`
> only on for HeroHairs → squeeze-in BEHAVIOR gated; UI redesign live on all tenants.
> Kill-switch: HeroHairs tenant doc `features.processingTime=false`.

### A. Regression — ALL tenants (UI went to everyone) — MOST CRITICAL
- [ ] **Whitecross:** calendar opens; booking/walk-in/reschedule normal; "slot full" works correctly
- [ ] **eekurt:** same checks
- [ ] On a flag-OFF tenant NO squeeze-in (wait fields don't appear in the service editor, calendar as before)

### B. Service Editor — all tenants
- [ ] Sidebar → **Services** → click a service → full-page editor opens
- [ ] Section switches (Basic / Pricing & timing / Online / Team)
- [ ] Save+load: name, **category (changing it moves the service)**, description, price type (Fixed/From/Free), price/deposit/duration, variations, team
- [ ] Active toggle · ★ Featured · Archive · Discard works
- [ ] **Online Profile → NO Services tab** (single home = sidebar Services)

### C. Squeeze-in — ONLY HeroHairs (flag on)
- [ ] Service → Pricing & timing → enter wait (e.g. before 15 / wait 30) → visual bar + green confirmation → Save
- [ ] Calendar: booking with that service → in the middle a **hatched gap + "+ Squeeze in"**
- [ ] Click the gap → **walk-in window opens with the gap's time**
- [ ] Booking into the gap → **accepted** (overflow also accepted = squeeze-in leniency); starting in the active segment → rejected
- [ ] Two bookings **side-by-side columns**, both readable (WALK-IN/✓ doesn't close)
- [ ] Future-dated gap → **Booking** tab opens (not walk-in)

### D. Self-booking
- [ ] Editor → Online booking → "Allow self-booking" **OFF** → Save
- [ ] That service NOT ON **the public booking page**
- [ ] That service NOT ON **the public salon site**
- [ ] The service is STILL there **in the staff panel** (walk-in/booking) (staff-only)

### E. Treatwell / iCal — HeroHairs (functions live)
- [ ] Feed: `https://europe-west2-havuz-44f70.cloudfunctions.net/salownIcalFeed?tenantId=herohairs` → **2 VEVENTs** for a booking with processing (empty gap in the middle)
- [ ] After Treatwell poll the gap appears **available**; active segments full
- [ ] ⚠️ **Echo-dedup NOT YET** → a Treatwell-origin booking may go back into the feed and appear doubled (known, future — risk ledger)

### F. Gallery
- [ ] Online Profile → Gallery → images **small + consistent** thumbnail (not enlarging on wide screen)

### G. Email (prior session — went live with this deploy)
- [ ] Confirmation / cancellation / reschedule / loyalty emails are sent
- [ ] Broken-address + client-edit propagation fix works

### Automated (developer)
- [x] `npm test` (salown-app) → `conflictUtils.test.js` **25/25** ✅
- [ ] `python3 docs/test-firestore-rules.py` → 25/25 (rules DID NOT CHANGE, must stay constant)

---

## TS Migration test suite — CLASSIFICATION (2026-07-08, tech-lead recommendation)
Run: `cd salown-app/functions && npm test` (node:test, no deps) + `cd salown-app && npm test` (vitest).
Total **47 (functions) + 25 (frontend conflictUtils)**. Categories:

| Category | What it proves | Files |
|---|---|---|
| **Parity** (old-vs-new) | Migrated code behaves the same as the old inline implementation; the old source is sliced at test time from index.js/git-HEAD. SELF-SKIP after wiring (job done, pins remain) | clients/identity.test.js, utils/parity.test.js + all waves' HEAD byte-equality tests |
| **Contract/Characterization (pin)** | Critical behavior permanently pinned: redemptionKey format, UK-DST, emailable gate = source-based, formatBookingLine, EXIT_TERMS figures | each module's "characterization pins" tests |
| **Money** | paymentMode matrix (off/pay_at_venue rejection · optional selection · deposit→full fallback · deposit≤discounted-full · over-discount THROW) + discount validation rejections | checkout/parity.test.js |
| **Integration (fake IMAP/Firestore)** | Parsers end-to-end: empty inbox = 0 writes; junk message = 0 bookings; inbound isolation (body token doesn't route, unknown token quarantined) | parsers/parity.test.js, inbound/parity.test.js |
| **Cross-mirror** | Server ↔ frontend copy consistency (redemptionKey) | clients/identity.test.js |
| **Smoke (live, non-test)** | After deploy: iCal feed exact, parser cron run, inbound gate 401, checkout negative-path ("not enabled" from the new module) | manual — see TYPESCRIPT_MIGRATION_PLAN.md §5b |

Note: `any` usage is intentional and labeled — `grep -rn "TODO(ts-migration)" salown-app/src` (zeroed out in Phase 4 strict).

## 21. LOYALTY-RECEIPT-SALVAGE — zero-price walk-in guard + unambiguous flagged-receipt recovery (`4587f50` · `53bf4a1`, 2026-08-02)

**Status:** ✅ DEPLOYED + LIVE-VERIFIED. Functions `salownSendLoyaltyEmail` rev `-00063-vec`; `hosting:salown` + `hosting:salown-staff` released 2026-08-02 15:53:59 UK (CI, one `--only hosting` deploy covers both targets).

Context: [INCIDENTS.md 2026-08-02](INCIDENTS.md). One booking (`WCB-1785666258751-w5ee`) stored `price: 0` and collected £38, so its canonical receipt was flagged and the emailed breakdown withheld the customer's own £2 redemption.

### Automated

| Suite | Cases | Pins |
|---|---|---|
| `src/utils/walkInPrice.test.ts` | 13 | The 8 required shapes: cleared price · accidental zero · genuine £0 catalogue service · valid explicit override · discount represented AS a discount (incl. 100% = complimentary) · package-prepaid known zero · product-only known zero · ordinary UK walk-in. Plus junk/negative/unknown-catalogue refusals and once-only pence rounding. |
| `functions/src/receipts/salvage.test.js` | 23 | The salvageable shape and its derivation · award mismatch diagnosed not repaired · every ambiguous refusal (discount, tip, service charge, deposit, add-ons, products, non-zero service line, failure outside the explained set, £0 transaction, forged `receiptFailures`, future version, no snapshot, malformed, negative redemption) · **no mutation during render** (frozen input) · rendered HTML asserts the redemption row appears for salvage and still does NOT for legacy. |
| `src/utils/receiptMath.test.ts` | +9 | Frontend mirror of the salvage contract; salvage never promotes to canonical. |
| `src/utils/bookingUtils.test.ts` | +7 | `bookingNetWithoutTip` reports **£38, not £36**; canonical, ordinary legacy, ambiguous-flagged, products/add-ons/deposits/tips, product-only and package-prepaid all unchanged. |
| drift guard (existing) | 1 | `reader.test.js` still proves the CJS mirror matches `src/utils/receiptMath.ts`. |

Full run at the deploy commit: frontend **1098/1098** (50 files), functions **864 pass / 20 skipped, 0 fail**, both typechecks clean, both builds clean, lint delta **zero** on every touched file.

> ⚠️ Flake note: `src/staff/lib/dateRange.test.ts` (a 365-day loop) can hit the 5 s vitest timeout on a cold transform. It is unrelated to this work and passes on a warm run.

### Live verification (synthetic only — Mason's record was never used for testing)

Two throwaway whitecross bookings (`__synthetic: true`, undeliverable `@example.com` address), triggered and then deleted:

| Record | Shape | Deployed function logged |
|---|---|---|
| `SYNTH-SALVAGE-20260802` | the confirmed flagged shape | `receipt: salvaged view — derived-service-line (service 4000p, redeemed 200p, points awarded 36 implied 38 MISMATCH)` |
| `SYNTH-AMBIGUOUS-20260802` | same + a £5 discount | `receipt: legacy view — writer-flagged` |

Independent real-world confirmation: the owner's first post-deploy redemption, `WCB-1785686381122-9uzy` (Sean Glynn), reconciled **canonically** — Service £40 + Add-on Nose Wax £6 → Subtotal £46, `Points redeemed · 40 pts −£2.00`, Total Paid £44.00, +44 pts on £44. The canonical path was never broken; only the £0-price booking ever fell through it.

### Deliberately not done — owner decision 2026-08-02

The +2 loyalty correction for Mason Borrett (`uKNNUjZDp0xntHhxUrCP`, 36 → 38) and a resend of his receipt were both **declined by the owner** ("it's fine if it's gonna work ok from now on, no need another email"). The dry run stands recorded in case it is ever wanted; nothing was written to his booking or client doc. **This is closed, not pending** — do not action it from a later reading.

---

## Related
- [SECURITY.md](SECURITY.md) — rules/security (source of the tested behaviors)
- [ROADMAP.md](ROADMAP.md) — work list (tests moved here, only a pointer there)
- [DEPLOY.md](DEPLOY.md) — deploy order (rules LAST; test → deploy)

---

## 12. TR-A — Turkey pilot foundation (2026-07-31)

**Shipped:** `424747d` · functions 9 targeted revisions · hosting `salown` + `salown-staff` ·
rules 145/145 · `tenants/tr-demo` seeded.

### 12.1 Automated — ✅ DONE

| Suite | Result |
|---|---|
| Frontend (`npx vitest run`) | ✅ **702 pass / 33 files** (+96 new) |
| Functions (`npm test` in `functions/`) | ✅ **678: 662 pass / 16 skip / 0 fail** (+16 new) |
| Firestore rules (`test-firestore-rules.py`) | ✅ **145/145** (+14 TR-A) — superseded, now **170/170**, see §21 |
| `tsc --noEmit` (frontend + functions) | ✅ clean |
| `npm run build` + `build:staff` | ✅ both green |
| `eslint src scripts` | 3 errors — all **pre-existing** (verified against a stashed tree) |

Coverage of the brief's required list, by file:

- UK default compatibility · explicit Turkish resolution · precedence · missing-key fallback ·
  TRY/GBP formatting · Istanbul/London boundaries · tenant-beats-browser →
  `src/utils/presentation.test.ts` (45), `src/i18n/i18n.test.ts` (25)
- authorization on regional settings → `docs/test-firestore-rules.py` (14 TR-A cases)
- existing UK tenants unchanged → `src/staff/lib/dateRange.test.ts` **365-day anchor**: every 2026
  UK day range is millisecond-identical to the old hand-rolled `isUkDst` maths
- seed dry run · idempotency · cannot overwrite a non-demo tenant · no parser dependency →
  `scripts/seedTrDemoTenant.test.js` (31)
- email locale selection → `functions/src/emails/i18n.test.js` (16), incl. a test that moves
  `process.env.TZ` and asserts the output does **not** follow
- brand / browser-translation / day names → `src/components/Brand.test.ts` (32)

### 12.2 Live verification — ✅ DONE

| Check | Evidence |
|---|---|
| Function name set unchanged (no orphan deleted) | 65 before → 65 after, `diff` empty |
| Deployed revisions | 9 captured as rollback anchors (see DEPLOYMENT_STATUS) |
| `<html translate="no">` + `<meta name="google" content="notranslate">` live | `curl` on both deployed shells |
| PWA install names | live manifest: `salOWN Professionals` / `salOWN Pro` |
| Splash wordmark | live HTML shows `>OWN<`, never `>own<` |
| Turkish in the shipped bundle | `Randevu al`, `Randevuyu onayla`, `Bölgesel ayarlar` present |
| No corrupted brand/day names in the bundle | `salSahip`, `Güneş`, `Doygunluk` all absent |
| `tr-demo` seeded + idempotent | 23 docs; re-run hit the demo-marker guard and rewrote the same 23 |
| `/book/tr-demo` reachable | HTTP 200, shell carries the translate guards |
| Unauthenticated read of the TR presentation | root-doc mirror returns the full Turkish triplet |
| **UK regression** | all 6 live tenants audited: **only `tr-demo` carries a `presentation` key**; whitecross/herohairs have none ⇒ platform default ⇒ unchanged behaviour |

> Weekday names are deliberately ABSENT from the shipped bundle — they come from `Intl` at
> runtime, never from a dictionary. Finding "Pazartesi" in the JS would mean the design had been
> violated, not that it was working.

### 12.3 Visual verification — ⚠️ NOT DONE (outstanding, release-blocking per the TR-A brief)

The browser extension was not connected during this session, and Chrome's
"auto-translate English pages to Turkish" preference cannot be set programmatically. The
MECHANISM is verified statically and live (12.2), but the human visual pass is **not** done.

Run each row at **desktop AND mobile width**, twice: **(A)** Chrome page translation disabled,
**(B)** Chrome previously set to auto-translate English pages to Turkish. In BOTH conditions the
brand and the Turkish day names must be correct.

| # | Surface | Look for | A | B |
|---|---|---|---|---|
| 1 | `/login` | wordmark reads `salOWN` (never salSahip/Sahip) | ☐ | ☐ |
| 2 | Dashboard | headings + stat pills; money in the tenant currency | ☐ | ☐ |
| 3 | Sidebar / navigation | Turkish labels, brand chip intact | ☐ | ☐ |
| 4 | `/book/tr-demo` | full journey in Turkish; service/staff names NOT translated | ☐ | ☐ |
| 5 | Booking date picker | weekday row = `Paz Pzt Sal Çar Per Cum Cmt`, never `Güneş`/`Doygunluk` | ☐ | ☐ |
| 6 | Staff Today | day header + prices; `staff.salown.com` splash wordmark | ☐ | ☐ |
| 7 | Staff Week | Mon–Sun grid in Istanbul time | ☐ | ☐ |
| 8 | Client detail | client name unchanged by the translator | ☐ | ☐ |
| 9 | Checkout | totals in ₺, labels Turkish | ☐ | ☐ |
| 10 | Settings → Regional settings | effective values + provenance + live preview | ☐ | ☐ |
| 11 | A UK tenant (whitecross) | **unchanged**: English, £, London times | ☐ | ☐ |
| 12 | Logos | correct aspect ratio, adequate contrast, no duplicate wordmark beside a logo | ☐ | ☐ |

Attach screenshots (or tick + sign) here when complete.

---

## 13. TR-B — treatment packages, partial payments and the open-account ledger (2026-07-31)

**Automated: 131 tests, all green.** Baseline `c3716f7`.

| Suite | Count | Command |
|---|---|---|
| Engine — money, schedules, entitlement, settings, authorization, twin byte-check | 72 | `cd functions && node --test src/packages/packagePlan.test.js` |
| **Emulator concurrency** — real Firestore transaction engine | 27 | `cd functions && firebase emulators:exec --only firestore --project demo-c1 --config ../firebase.json 'node --test --test-concurrency=1 src/packages/*.emulator.test.js'` |
| Frontend twin parity + behaviour | 8 | `npx vitest run src/utils/packagePlan.parity.test.ts` |
| Money input parsing (TR/UK keyboards) | 12 | `npx vitest run src/lib/packagesApi.test.ts` |

✅ **RESOLVED 2026-07-31 by TR-C Phase 2 (`d9856e5`).** Both `functions/` suites are now in the
default globs: `src/packages/*.test.js` in `test` and `src/packages/*.emulator.test.js` in
`test:emulator`. `npm --prefix functions test` went **742 → 816** tests and
`npm run test:emulator` now runs the package concurrency suite alongside bookings, inventory and
treatment sessions. Nothing was removed and nothing is silently skipped. (No CI depends on it —
`deploy.yml` does not run `npm test`.)

### What the emulator suite proves (a fake could not)

- [x] six concurrent **identical** payments → exactly ONE ledger row, five replays, all reporting success
- [x] same key + **different** amount → `IDEMPOTENCY_CONFLICT`, still one row
- [x] a retried **sale** replays instead of selling the package twice
- [x] two concurrent payments that would together **overpay** → exactly one refused, `outstanding_m` never negative
- [x] five concurrent completions of the **same booking** → exactly ONE entitlement consumed, one session doc
- [x] two bookings racing for the **last** session → exactly one winner, loser gets `NO_SESSIONS_REMAINING`
- [x] a booking already linked to one package cannot be linked to another
- [x] editing a definition after a sale leaves the sold package **byte-identical** (snapshot immutability)
- [x] reserving stamps the booking `price: 0` + `packagePrepaid` (the loyalty double-award seam)
- [x] no-show burns / does not burn per tenant policy; cancel releases
- [x] exhausting entitlement completes the package **even with money still owed**
- [x] cancelled and expired packages refuse redemption; an authorized override is recorded
- [x] cancelling a package moves **no** money
- [x] tenant isolation — a `whitecross` claim cannot reach a `tr-demo` package
- [x] staff may take a payment but not a refund when the salon requires approval; owner can
- [x] an unknown uid is refused even inside the right tenant
- [x] a tenant with packages OFF cannot sell or take money (the UK anchor)
- [x] a required sale deposit is enforced **before anything is written**
- [x] the sale is dated by the TENANT calendar, not the server region

### Live verification — production, `tr-demo` only (2026-07-31 ~16:2x UK)

**37/37 passed.** Script drove the exact deployed executor against production Firestore.

- [x] no live tenant carries `packageSettings` (feature dark on all six)
- [x] strict validator rejects a malformed setting; a staffer cannot change payment settings; owner can
- [x] 3-instalment sale with a ₺2.000 deposit — instalments sum exactly, remainder on the first, TRY stamped from the tenant, Istanbul calendar day
- [x] `M1` reconciles at every step
- [x] double-tap → one row; overpayment refused; staff refund refused, staff payment allowed
- [x] refund then reversal — balance restored, all 5 rows still present (append-only)
- [x] booking stamped `price: 0` + `packagePrepaid` + `packageListPrice_m`
- [x] one entitlement consumed, retry refused, counters unchanged
- [x] a `whitecross` claim cannot reach the `tr-demo` package
- [x] cancellation moves no money; a cancelled package refuses redemption
- [x] **cleanup verified** — 12 synthetic docs deleted, `packageSettings` removed, tenant left as found

No email sent, no card touched, no other tenant read or written.

### ⚠️ Manual visual pass — NOT yet done

- [ ] Panel `/app/packages` in **Turkish** (`tr-demo`): catalogue, sell flow, schedule preview, client drawer, payment history
- [ ] Panel `/app/packages` in **English** on a UK tenant with the feature enabled — confirm £ everywhere, no ₺
- [ ] Settings → Payment settings as **owner** (editable) and as **admin** (read-only strip shown)
- [ ] Staff App client card → packages block → use a session, record a payment, on a real phone
- [ ] Chrome auto-translate ON, Turkish tenant: confirm package names, client names and amounts are NOT rewritten
- [ ] A UK tenant with `packageSettings` absent still shows **no** Packages nav item and an unchanged client card

---

## 14. TR-C — treatment session lifecycle, continuity and client recovery (2026-07-31)

**Automated: 265 tests across the two packages, all green.** Baseline `d9856e5`
(chain: TR-A `424747d` → TR-C P1 `bc82454` → TR-B `c3716f7` → TR-C P2 `d9856e5`).

| Suite | Count | Command |
|---|---|---|
| Lifecycle table + TR-B verb mapping | 48 | `npx vitest run src/utils/treatmentLifecycle.test.ts` |
| Continuity engine (flags, evidence, tenant-tz day maths) | 34 | `npx vitest run src/utils/treatmentContinuity.test.ts` |
| Recovery derivation + dashboard/list parity | 16 | `npx vitest run src/utils/treatmentQueries.test.ts` |
| Twin byte-parity + purity scan | 3 | `npx vitest run src/utils/treatmentParity.test.ts` |
| Dictionary shape, coverage, language discipline | 13 | `npx vitest run src/i18n/treatments.dictionary.test.ts` |
| Server cores (auth, validation, idempotency, roles) | 47 | `cd functions && node --test src/treatmentSessions/sessions.test.js` |
| Twin parity + CJS export surface | 3 | `cd functions && node --test src/treatmentSessions/parity.test.js` |
| **Emulator — TR-C internals** | 10 | in `npm run test:emulator` |
| **Emulator — TR-C ↔ TR-B cross-contract** | 15 | in `npm run test:emulator` |

### Canonical gate totals after Phase 2

| Gate | Before TR-C | After |
|---|---|---|
| `npm test` (frontend) | 807 | **833** |
| `npm --prefix functions test` | 742 | **816** (797 pass / 19 emulator self-skips / 0 fail) |
| `npm --prefix functions run test:emulator` | 78 | **105** |

The functions figure includes TR-B's 72-test engine suite, which was outside the default
glob until this package registered it — see the §13 note above.

### What the cross-contract suite proves (neither package could alone)

Run against the REAL emulator and the REAL TR-B executor, injected exactly as
`functions/src/index.ts` injects it (`packageSession: PKG.packageSessionCore`):

- [x] a TR-C scheduled session may reference a TR-B `clientPackage`; the stored link carries **no money field**
- [x] completing emits one `consume` and TR-B consumes exactly one entitlement
- [x] **six concurrent completions → exactly ONE entitlement consumed, one TR-B session row**
- [x] marked absent → corrected → completed burns **one** session, not two (TR-B's decision is final)
- [x] cancelling releases the hold through TR-B's own contract
- [x] a no-show writes **no ledger row** — attendance is not a money event
- [x] a full TR-C lifecycle leaves `snapshot`, `financialCache` and `plan` **byte-identical**
- [x] a payload carrying `packageListPrice_m` is refused outright, nothing written
- [x] a packages-disabled tenant gets no package behaviour; the lifecycle still works
- [x] a package-linked session in a disabled tenant **reports** the refusal instead of hiding it
- [x] a legacy barber booking is untouched — no `price: 0` zeroing, no `packagePrepaid`
- [x] a BLOCKED booking never enters the lifecycle, package or not
- [x] tenant isolation across both the lifecycle **and** the package reference
- [x] dashboard count === Follow-ups list, from real stored documents
- [x] overdue computed in the tenant calendar; UK/London behaviour unchanged

### Live verification — production, `tr-demo` only (2026-07-31 ~20:5x UK)

**37/37 passed.** Drove the deployed cores + the real TR-B executor against production
Firestore. Highlights: 4-entitlement package → one consume on completion → repeat and 4
concurrent completions consumed nothing further → no-show burnt under policy → owner
correction moved no entitlement (total stayed at 2, not 3) → `MISSED_LAST_THREE` with
streak 3 → overdue **45 days** in `Europe/Istanbul` → all four dashboard cards equalled
their list lengths → outstanding ₺1600.00 byte-identical after the run.

**Cleanup verified:** 32 synthetic documents deleted, `packageSettings` removed again (it
was absent before), `treatmentSessions` / `treatmentFollowUps` / `clientPackages` all back
to 0. No email, no payment, no message; no other tenant read or written.

Deployed endpoints independently confirmed: unauthenticated POST to each of the three
callables returns `UNAUTHENTICATED`.

### ⚠️ Manual visual pass — NOT yet done

- [ ] `/app/follow-ups` in **Turkish** (`tr-demo`): filters, evidence chips, drawer, journey
- [ ] dashboard card strip + click-through carrying the filter
- [ ] a UK tenant (`whitecross`) sees only the new nav item and the empty state

---

## 15. TR-B2 — package booking UX, custom instalments, Finance/Reports (2026-07-31)

### Stage 1 — package accounting + Reports (`c5bd1dc`)

**Automated: 41 new tests.** Frontend gate **897/897**.

| Suite | Count | Command |
|---|---|---|
| Accounting engine — allocation, period flows, stocks, filters, export | 41 | `npx vitest run src/utils/packageAccounting.test.ts` |

What it proves that a simpler test could not:

- [x] allocation sums back to the total **exactly**, for every session count 1…120 across seven totals
- [x] the remainder lands on session #1 — TR-B's own `splitEvenly`, so it IS the instalment rule
- [x] a reversal recorded in a LATER period is negative cash in **that** period; July is not restated and the periods sum to the final balance
- [x] an ADJUSTMENT is **not** cash, and restates what the remaining sessions are worth
- [x] delivered > paid reports **ACCRUED**, never a negative deferral; `paid − delivered = deferred − accrued` on every row
- [x] a no-show follows the **stored** `holdsEntitlement` consequence, not a re-decided policy
- [x] scheduled reserves but earns nothing; cancelled earns nothing
- [x] a session whose ordinal exceeds the sold count is counted but carries **no** value
- [x] Istanbul vs London: the same instant lands in different periods, and the engine follows the key it was given
- [x] DST boundaries (2026-03-29, 2026-10-25), month/year/leap-day rollover
- [x] mixed currency is **flagged**, not silently totalled
- [x] a fold failure (`M6`) propagates to the totals instead of being swallowed
- [x] an empty tenant produces zeroes, not `NaN` — the packages-off anchor
- [x] export rows state their amount type; a negative flow is still exported; CSV carries minor units and **no** currency symbol

### Stage 1 live verification — production, `tr-demo` only

**23/23 automated live checks passed**, plus **8/8** read-only anchor checks. Drove the exact deployed
engine against production Firestore. (First run was 22/23 — see the corrected assertion below.)

- [x] sale dated by the **Istanbul** calendar; session recognised on its own Istanbul day
- [x] cash ₺2.000 · delivered ₺1.000 (one eighth) · outstanding ₺6.000 · deferred ₺1.000 · accrued 0
- [x] the deferred/accrued identity and TR-B's `M1` both hold on live data
- [x] a period before the sale reports zero
- [x] export typing and minor-unit serialisation on real documents
- [x] **cleanup verified** — 3 synthetic docs deleted, `packageSettings` removed, settings doc otherwise byte-identical

#### The one first-run failure was a stale ASSERTION, now corrected — and it found something real

Check #1 originally read *"no live tenant carries `packageSettings`"*, copied from TR-B's
2026-07-31 baseline. It **failed** on the first run, reporting `["demo"]`.

That was a genuine automated assertion failure, **not** a manual check, **not** a skip, **not** a
negative control, and **not** a product defect. It failed because its premise had expired: the
`demo` tenant deliberately opted into a shipped feature. **An assertion that fails on correct use
is not a regression gate.**

It now asserts the guarantee that actually matters, and asserts **behaviour** rather than storage —
the same semantics as the committed anchor (`scripts/packageAnchor.cjs`, `4408759`):

> *every currently-active real tenant resolves packages-**DISABLED*** — `whitecross`, `herohairs`

Re-run 2026-08-01: **23/23, zero failures.** It would break if either protected tenant ever
resolved enabled, or if either disappeared from the roster.

Expected vs actual on the original run: expected `withPkg.length === 0`; actual `["demo"]`
(`{ enabled: true, staffMayAdjustPayments: true }`). **No production behaviour, demo flow, money
invariant or tenant-isolation guarantee was affected** — `demo` seeing the Packages report is the
correct consequence of that tenant enabling it.

The read-only anchor checks, unchanged and still passing:

- [x] `whitecross`, `herohairs`, `the-hair-lab`, `yusufo` — `packageSettings` **absent** ⇒ resolver `enabled: false` ⇒ **no** Packages report tab
- [x] `demo` — resolves `enabled: true` with **no** issues ⇒ the tab **is** shown, and renders the empty state without `NaN`

> **Anyone re-running a TR-B/TR-C live script should expect the "no tenant carries packageSettings"
> check to fail on `demo` from now on.** It is a stale baseline, not a regression.

### Deployment evidence

- Hosting `salown` released **2026-07-31 23:18:12** by GitHub Actions. Functions and rules **not** touched — all seven package/treatment callables unchanged and still failing closed (`UNAUTHENTICATED`).
- `hosting:salown-staff` deliberately **not** deployed: the staff bundle's only delta is the inert `packages.finance.*` dictionary (the i18n barrel is shared). `PackageFinancePanel` is absent from that bundle and no staff component renders those keys. The tracked staff bundle therefore leads the deployed staff release until Stage 3 deploys it.
- `Finance-*.js` live vs local: **byte-identical** once the entry-chunk filename is normalised ⇒ `Finance.tsx` and the `2a69735` date fix provably unchanged.

> ⚠️ **CI observability trap, worth knowing before the next deploy.** CI's `npm ci` resolves
> dependencies differently from a local `node_modules`, so **CI's content hashes differ from a local
> build's**. "Is my push live?" therefore *cannot* be answered by polling for the filename your own
> build produced — that file will never exist on the server. Check for a **source marker string**
> inside the live bundle instead. Ten minutes were lost to this; the deploy had succeeded all along.

### Stage 2 — catalogue archive/restore + custom instalments (`b0a2051`)

**Automated: 19 new tests.** Frontend gate **916/916**. No Function deployed — the
server contract already backed both features.

| Suite | Count | Command |
|---|---|---|
| Custom instalment reconciliation + engine agreement | 19 | `npx vitest run src/components/packages/CustomInstalmentEditor.test.ts` |

- [x] reconciles **exactly**, and only exactly — under- and over-allocation both refused
- [x] an unreadable amount is an unfinished row, never `0`; a zero instalment is refused (the engine calls it `INSTALMENT_TOO_SMALL`)
- [x] a malformed due date (`2026-010-01`) is rejected — found by a fixture bug in the test file itself, then pinned
- [x] duplicate due dates are **allowed** and flagged, because the engine permits them
- [x] `1.234,50` (TR keyboard) and `1,234.50` (UK) produce the same integer; a GBP plan reconciles identically
- [x] rows are sorted by due date so `seq` is chronological however they were typed; an empty note is omitted rather than stored
- [x] **every plan the editor accepts, the engine accepts**; a plan the editor refuses, the engine refuses with `CUSTOM_SUM_MISMATCH`
- [x] seeding from an equal split carries the odd-kuruş remainder row across intact

### Stage 2 live verification — production, `tr-demo` only

**35/35 passed.** Drove the deployed executor; the point was to prove the *existing* contract
really backs the new controls.

- [x] ordinary staff cannot archive; a `whitecross` claim cannot archive a `tr-demo` definition
- [x] archived ⇒ a new sale is **refused inside the sell transaction** (`DEFINITION_ARCHIVED`) ⇒ a stale browser cannot sell one
- [x] the already-sold package is **byte-identical** after archiving — snapshot, plan and financial cache — and stays redeemable: a session was delivered and a payment recorded on it *while its definition was archived*
- [x] archive retry is **state**-idempotent; `definitionVersion` does advance (documented, not claimed otherwise)
- [x] restore returns it to `active` under the **same definition id** — no duplicate — and it is sellable again
- [x] a custom 3-row plan typed in the editor was stored **verbatim**, in date order, notes intact, summing exactly; an over-allocated plan was refused server-side
- [x] **cleanup verified** — all four collections back to 0, `packageSettings` removed, settings doc otherwise unchanged

Hosting `salown` deployed by CI (entry `index-CBqtF43Y.js`); EN and TR markers confirmed live.
`hosting:salown-staff` intentionally not deployed — see the Stage 1 note and Stage 3.

### Production regression anchor — package gating (`4408759`)

`node scripts/packageAnchor.cjs` · policy unit-tested by `npx vitest run scripts/packageAnchor.test.js` (14 tests, no credentials needed).

Replaces TR-B's *"no live tenant carries `packageSettings`"* baseline, which was true when written
and false within a day — `demo` deliberately opted into a shipped feature. **A gate that fails on
correct use teaches people to ignore the gate.**

| | Old baseline | This anchor |
|---|---|---|
| Asserts | a field is absent (**storage**) | `resolvePackageSettings(...).settings.enabled` (**behaviour**) |
| Protected | "every live tenant" | `whitecross`, `herohairs` — the two `TENANTS.md` lists as live |
| Demo/pilot | asserted, so it broke | **reported, never asserted** — `demo`/`tr-demo` exist to be switched |
| Unlisted tenants | not covered | covered by a **universal property**, not by name |

- [x] absent settings ⇒ disabled; an explicit `enabled: false` doc ⇒ equally disabled; a malformed layer ⇒ still disabled, and not a violation
- [x] a protected tenant resolving `enabled: true` ⇒ **BREAKS**
- [x] a protected tenant missing from the roster ⇒ **BREAKS** (silence is not proof)
- [x] the platform default ever ceasing to mean disabled ⇒ **BREAKS** — the tripwire for every unconfigured salon silently gaining the feature
- [x] `demo`/`tr-demo` flipping either way ⇒ still holds
- [x] an unlisted self-signup tenant opting in ⇒ not a violation (the roster is open; `/signup` is never gated)

**`eekurt` is deliberately NOT protected** — it left the platform 2026-07-18 (owner). Its Firestore
data is untouched; if it returns it comes back through onboarding with explicit fresh configuration.
The exclusion is asserted as a decision so it does not read as an oversight later.

Live run 2026-08-01: **anchor holds** — `whitecross` and `herohairs` both effective-disabled;
`demo` enabled (reported); `the-hair-lab`, `tr-demo`, `yusufo` disabled.

### Stage 3 — package selection in booking and walk-in flows (`b40e182`)

**Automated: 23 new tests.** Gates: frontend **953/953** · functions **816** (797 pass / 19 self-skip / 0 fail) · emulator **105/105**.

| Suite | Count | Command |
|---|---|---|
| Eligibility — service/expiry/barber/tenant/client rules | 23 | `npx vitest run src/utils/packageEligibility.test.ts` |

- [x] eligible for a matching service; the session number counts reservations (`3 of 8`)
- [x] refused for: packages off · no client · cancelled · exhausted · expired · wrong service · disallowed barber · other tenant · other client · booking already linked · location mismatch
- [x] exhausted **and** expired reads as **exhausted** — the reason staff can act on
- [x] expiry is judged on the **appointment date**, not today, and the expiry day itself is inclusive
- [x] ineligible packages are still listed, ordered after eligible ones, with their reason
- [x] most-used course offered first; a legacy barber tenant and a packages-off tenant get `[]`

### Stage 3 live verification — production, `tr-demo` only

**29/29 passed**, including a deliberate **negative control**.

- [x] `reserve` stamps the booking `price: 0` + `packagePrepaid` + `packageListPrice_m`, and leaves `soldProducts` untouched
- [x] reserve → complete consumes **exactly one** entitlement (8 → 7); a repeat completion **replays**, still 7
- [x] **the negative control:** `complete` WITHOUT `reserve` consumes the entitlement but leaves the booking at **full price** — the double-charge and double-loyalty the reserve-first rule exists to prevent, demonstrated rather than asserted
- [x] linking a booking writes **no ledger entry** — delivery is not a payment; the balance is untouched
- [x] a booking already using a package cannot be linked to a second
- [x] anonymous walk-in gets nothing; cross-tenant refused; wrong service refused
- [x] **cleanup verified** — all five collections back to 0, `packageSettings` removed

### Stage 3 deployment

- `hosting:salown` — entry `index-dGzcP6IS.js`, EN + TR markers confirmed live.
- `hosting:salown-staff` — **deployed**, and the live bundle `staff-CE_2hRPk.js` is **byte-identical** to the tested tracked bundle. The pushed-but-undeployed Staff discrepancy carried since Stage 1 is **cleared**.
- **No Function deployed** — Stage 3 changed no `functions/` path.

### Stage 4 — Follow-ups into the Clients segmented control (`a5b6f20`)

**Automated: 16 new tests.** Frontend gate **969/969**; TR-C's own 111 tests re-run green.

| Suite | Count | Command |
|---|---|---|
| Clients view routing — URL contract, legacy redirect, card deep-links | 16 | `npx vitest run src/pages/clientsView.test.ts` |

- [x] Clients defaults to **All Clients**; a bad/unknown/removed `?view=` value falls back to it rather than blanking the page
- [x] the default view writes **no** parameter, so Back does not stutter between `/clients` and `/clients?view=list`
- [x] a direct refresh on `?view=follow-ups&flag=…` stays on Follow-ups, filtered
- [x] unrelated query parameters are preserved; the params object is never mutated
- [x] leaving Follow-ups **clears the flag** — an armed but invisible filter is worse than none
- [x] `/app/follow-ups` resolves to Clients → Follow-ups, carrying `?flag=` verbatim, and **can never target itself** (no redirect loop)
- [x] every Dashboard recovery flag round-trips to the filtered list, so a card's count and the list it opens cannot diverge

**Structural checks, asserted against the codebase:**

- [x] exactly **one** `<FollowUps>` mount exists (`src/pages/Clients.tsx`) — the legacy route is a redirect, not a second mount
- [x] the standalone Follow-ups **sidebar item is gone**; the only remaining reference is a comment
- [x] `isAdmin` is the prop `AppRouter` already computes, not a second derivation ⇒ authorization provably unchanged
- [x] the workspace is **lazily loaded**, so the continuity engine is never mounted behind the client list

### Stage 4 deployment

- `hosting:salown` — entry `index-DEnMEobb.js`; `Tüm Müşteriler` / `Segmentler` / `Takip Listesi` and the `/app/clients?` redirect target confirmed live, `nav.clientsTabs.*` + `treatments.navLabel` present in `Clients-DFYjn-yt.js`.
- `hosting:salown-staff` — redeployed with the shared i18n barrel; live bundle `staff-bURxN_lq.js` **byte-identical** to the tracked one.
- **No Function deployed** — Stage 4 touched no `functions/` path, no collection, no callable.

### ⚠️ Manual visual pass — NOT done

- [ ] `/app/clients` in **Turkish** (`tr-demo`): the three-option control, and that `+ Müşteri Ekle` still reads as the primary action
- [ ] a Dashboard recovery card → the filtered Follow-ups list, then **Back** returns to the card
- [ ] an old `/app/follow-ups?flag=…` bookmark
- [ ] narrow-screen: the control does not clip or overflow the page
- [ ] a UK tenant (`whitecross`): All Clients and Segments unchanged, no new sidebar row

---

## 16. Pre-TR-D IA remediation — package catalogue under Services (`58624ea`, 2026-08-01)

**Why this exists.** The pre-TR-D audit found a **SOURCE GAP**: `a5b6f20` reported the
information-architecture work complete, but `Sidebar.tsx` still carried a top-level Packages item —
in source *and* in production. Source and live agreed with each other and disagreed with the report.
Prose could not catch that, so **the navigation contract is now asserted against the source.**

**Automated: 24 tests.** Frontend gate **993/993**.

| Suite | Count | Command |
|---|---|---|
| Services view routing + navigation contract | 24 | `npx vitest run src/pages/servicesView.test.ts` |

Routing contract:
- [x] default Services URL resolves to Services; `?view=packages` resolves to Packages
- [x] invalid/unknown/foreign view names fall back safely — a bad URL never blanks the page
- [x] each segment produces the canonical URL; the default view writes **no** parameter
- [x] `/app/packages` redirects to `?view=packages`, preserves the query, and **cannot loop**
- [x] direct refresh preserves the view; params are never mutated in place
- [x] Services and Clients share one convention, and neither accepts the other's view name

Navigation contract, read from the **source registry** (not prose):
- [x] **no** top-level Packages nav entry — the gap this closes
- [x] **no** top-level Follow-ups nav entry
- [x] exactly **one** Services entry; exactly **one** Clients entry
- [x] `OWNER_ONLY` still contains `services` and was **not** weakened (`packages`/`clients` not added)
- [x] `/app/packages` is a redirect, **not** a second catalogue mount (`element={<Packages ` absent)
- [x] `/app/follow-ups` compatibility redirect still intact
- [x] the Services route is **role-gated**, so an unauthorized URL cannot open configuration
- [x] Clients still shows All Clients | Segments | Follow-ups, with + Add Client separate

### Live verification — downloaded production artefacts

Entry `index-DTpuvt8f.js`:

| Check | Result |
|---|---|
| top-level Packages nav item | **absent** (`id:\`packages\`` = 0, `ti-ticket` = 0) |
| Services nav item | present **exactly once** |
| top-level Follow-ups nav item | absent (`ti-phone-call` = 0) |
| `/app/services?` redirect target | present |
| `/app/clients?` (Follow-ups) redirect | still present |
| Services chunk `Services-DvIUckd2.js` | carries `nav.servicesTabs.` + lazy `Packages-BO7Ma3e2.js` |
| Packages chunk | HTTP 200, catalogue intact (`packages.catalogue.archive`, `packages.sell.title`) |
| EN / TR labels | `servicesTabs:{services:\`Services\`,packages:\`Packages\`}` and `{services:\`Hizmetler\`,packages:\`Paketler\`}` |

**Auto-translate ruled out by evidence:** the Turkish labels are **literal values inside the deployed
bundle**, not runtime translations of English ones.

**No service-worker/cache explanation applies** — `/sw.js` and `/service-worker.js` are 404, and the
new navigation was verified by downloading the server artefact itself.

Deployed: `hosting:salown` only. **`hosting:salown-staff` deliberately NOT deployed** — no staff
source changed; the staff bundle was rebuilt only because `panel.ts` rides in the shared i18n barrel,
so the rebuild was reverted and the tracked artefact remains **byte-identical** to production.
No Functions, rules or indexes touched.

### ⚠️ Manual visual pass — NOT done

The Chrome extension is not connected in this environment and the panel requires an authenticated
session, so no screenshot pass was performed. Recorded as outstanding rather than claimed.

- [ ] `/app/services` desktop, EN — the `Services | Packages` control, and `+ Add service` only on the Services view
- [ ] `/app/services` desktop, native TR — `Hizmetler | Paketler`
- [ ] a staff-role account confirms Services (and therefore the catalogue) is not reachable

---

## 17. TR-D1 Phase 0.5 — legacy split-payment report correction (`5926c1c`, 2026-08-01)

**An existing production defect**, found by the Phase 0 audit — not introduced by TR-D1.

### The two failures (they were different)

| Aggregation | Old code | Effect on a £30 cash + £20 card checkout |
|---|---|---|
| `financeGrouped` | `if(pm==='CASH')…; if(pm==='CARD')…` | `'SPLIT'` matched **neither** ⇒ the whole £50 **vanished** |
| `financeTotals` | `if(pm==='CASH')…; else card+=net` | fell into the `else` ⇒ reported as **£50 card, £0 cash** |

### Semantics pinned from the WRITER, not the field names

The names invite the wrong reading. `CheckoutPanel.tsx` renders *"Split between Cash and:"* with the
input labelled **"Cash £"**, and displays the second leg as `total - splitAmount`. Therefore:

- the primary leg is always **CASH**, and its amount **is** `splitAmount`;
- the secondary is `splitSecond`, taking `total − splitAmount`;
- `paidAmount` is the **full collected total**, not the primary allocation.

Split is written by the **admin panel only** — the Staff App has no split flow — so there is one
writer and one convention, which is what makes the legacy shape reconcilable at all.

**Automated: 21 tests.** Frontend **1014/1014**.

- [x] cash-only, card-only, and non-split rows **unchanged**; a stale `splitAmount` on a non-split row is ignored
- [x] £30 cash + £20 card, both entry orders; zero secondary; zero cash leg; VOUCHER as second method
- [x] missing second method → remainder to **OTHER**, never a guessed CARD; flagged
- [x] over-allocation **clamped** and flagged; negative and absent legs handled; empty split still names a bucket
- [x] discounts/tips: allocates the caller's `net`, never a re-derived total
- [x] **Σ allocations === net across a 1,728-case matrix** of valid and malformed inputs; no float residue
- [x] input object never mutated

### Live verification — `tr-demo` synthetic + `whitecross` negative control

**16/16 passed.** Seven synthetic bookings covering every legacy tender shape, expected net **£340**:

| | cash | card | total |
|---|---|---|---|
| **corrected** | 222.50 | 117.50 | **340.00** ✅ |
| old `financeTotals` | 50.00 | 290.00 | 340.00 (mis-attributed) |
| old `financeGrouped` | 50.00 | 50.00 | **100.00 — £240 lost** |

**UK negative control:** 400 checked-out `whitecross` bookings read **read-only** — **0 SPLIT rows** ⇒
cash `£2449.10` / card `£9466.50` **byte-identical** before and after. No whitecross document was
written. All synthetic `tr-demo` bookings deleted; collection back to 0.

Deployed `hosting:salown` only (entry `index-BKqdCc8k.js`, chunk `Reports-_UZ4qFUZ.js`); the old
`g.cash+=net` predicate is **absent** from the live bundle. No Functions, rules or staff deploy.

### ⚠️ Finance.tsx shares a DIFFERENT defect — reported, NOT fixed

`src/pages/Finance.tsx:48` — `m==='cash' ? 'CASH' : 'CARD'` maps `'SPLIT'` wholly to **CARD**. It was
not claimed and is not changed here; it needs its own authorization. Finance is `whitecross`-gated and
whitecross currently has **0** split rows, so the live impact is nil today.

---

## 18. TR-D1 Phase 1 — contracts and pure engines (`881a6ef`, `22cf85f`, 2026-08-01)

**Built and pushed. NOT registered, NOT deployed as a feature, NOT user-reachable.**

**Automated: 55 new tests.** Frontend **1069/1069**; Functions package engine **72/72**.

| Suite | Count | Command |
|---|---|---|
| checkoutSettings resolver, capability, tender engine, twin parity | 55 | `npx vitest run src/utils/checkoutTender.test.ts` |

### B2 logical extraction — the safety proof

Pinned **before** the edit, re-run **after**:

| Evidence | Before | After |
|---|---|---|
| Serialized fold over 10 fixtures | sha `9a891b62…` | sha `9a891b62…` **identical** |
| Functions package-engine tests | 72 pass / 0 fail | **72 pass / 0 fail** |
| Frontend package tests | 103 | **103** |
| `packagePlan` parity cores | byte-identical | **byte-identical** |
| Test files modified | — | **none** |

Fixtures: empty · partial payment · paid in full · refund · adjustment · reversal · bad reversal
(`M7`) · negative amount (`M6`) · foreign currency (`M4`) · zero base. **No expected value was
updated to bless the refactor** — that is the only thing that makes this proof mean anything.

`foldReceivableLedger` contains no `clientPackageId`, definition, entitlement, `PER_SESSION`,
delivered-session or package-status concept. It stays **inside** the existing parity core because
that core has never had a runtime import (`import type` only, elided at compile time), which is what
lets the Functions CJS build resolve nothing there. Physical relocation waits for Phase 3's second
consumer.

### Contracts

- [x] absent settings ⇒ UK default, feature dark; TR settings select TR mode
- [x] **no IP/geo concept exists in the contract** — asserted by grep over the resolved shape and the core
- [x] explicit `false`/`0` survive (own-property, never truthiness); `null` meaningful only where a limit means "none"
- [x] malformed layers resolve conservatively with `issues[]`; duplicate provider ids rejected; a nonsense split list falls back rather than locking the till
- [x] **no PAY-1 field** is readable as a checkoutSettings field; **no `packageSettings` permission** is duplicated
- [x] capability returns a struct so a screen can say WHICH of platform/tenant/role refused

### Tender engine

- [x] cash · card · bank transfer · **three-way split** (the legacy two-tender ceiling is gone)
- [x] partial · fully unpaid · bank instalment (no receivable) · salon instalment (receivable)
- [x] **package-only checkout succeeds with every tender disabled** — there is no money to take
- [x] package + paid extra charges only the extra
- [x] rejects: negative · non-integer · unknown method · duplicate allocation id · over-allocation · unexplained shortfall · disabled checkout/method/split · unknown/disabled provider · unsupported instalment count · staff over unpaid limit · partial below minimum · missing due date/note · **stale settings version**
- [x] reports **every** reason, not just the first

### Loyalty basis (pure contract, not wired)

- [x] partial earns on the collected eligible portion; unpaid earns zero; package-prepaid earns zero; a paid extra stays eligible; tips/service charge never earn

### Currency boundary

`receiptCurrency` is widened to an explicit ISO string **in the new shared contract only**.
`src/utils/receiptMath.ts` still types `'GBP'` and the live client-side writer is **unchanged** —
switching it before the server executor exists would alter deployed behaviour. **Writer migration is
Phase 3**, where currency will be resolved server-side from tenant presentation.

### ⚠️ Process deviation — `[skip ci]` omitted

Both Phase 1 commits were pushed **without `[skip ci]`**, so CI deployed hosting
(`index-BETIZlFt.js`). Phase 1 was specified as no-deploy. **What actually reached production was
nothing new:**

| Marker | entry | Services | Packages | PackageAtoms |
|---|---|---|---|---|
| `CHECKOUT_SETTINGS_DEFAULTS` / `admitTender` / `checking_unknown_result` / `SALON_CREDIT` | 0 | 0 | 0 | — |
| package engine (`M1_RECONCILES`) | 0 | 0 | 0 | **1 — intact** |

The tender/settings engine is **tree-shaken out entirely** (nothing imports it). The only shipped
delta is the `packagePlan` adapter, whose output is proven byte-identical. No Functions, rules or
staff deploy occurred. Nothing became user-reachable.

---

## 19. TR-D1 Phase 2A — package session transaction seam (`ef2cd1f`, 2026-08-02)

**Behaviour-neutral refactor. Pushed, NOT deployed** — the public callable behaves identically and
the seam has no external consumer until Phase 2B.

**Why it exists:** `packageSessionCore` owned its `db.runTransaction`, and Firestore has no nested
transactions, so a checkout executor could not consume an entitlement *and* complete a booking in one
atomic commit. The two alternatives were forbidden and wrong — uncoordinated double-commit, or a
second copy of the entitlement arithmetic.

**Automated: 12 new seam tests.**

| Gate | Pinned before | After |
|---|---|---|
| Package engine | 72 pass / 0 fail | **72 / 0** |
| Package emulator concurrency | 27 pass / 0 fail | **27 / 0** |
| Full emulator suite | 105 | **105** |
| Full Functions suite | 816 (797 pass / 19 skip) | **828** (809 / 19) — the +12 are the seam tests |
| Frontend | 1069 | **1069** |

**No existing financial expectation changed; no existing test file touched.**

### What the seam tests pin (contract, not arithmetic)

- [x] exactly **ONE** entitlement implementation — counted over code lines, ignoring the import line and the prose comment a naive substring count mistakes for duplicates
- [x] the wrapper **delegates** and contains no `tx.*`, no `applyEntitlementTransition`, no `derivePackageStatus`
- [x] the body opens **no nested transaction**
- [x] the body performs **no external side effect** — a transaction callback can be RETRIED, so `emitAudit` stays in the wrapper, after commit (order asserted)
- [x] **every read precedes every write** (one `tx.getAll` at the top)
- [x] `prepareSessionRequest` is **pure of I/O**
- [x] derived ids unchanged: `{cp}__{booking}` and `{cp}__manual__{key}`
- [x] every existing rejection preserved (`INVALID_IDEMPOTENCY_KEY`, `INVALID_INPUT` incl. unknown field, `INVALID_TENANT`)
- [x] an **external transaction can drive the body** — proven with a fake tx that throws if nesting is attempted, observing exactly one entitlement reserved (8 → 7, scheduled 1)
- [x] a denied path stages **no write at all**

**Not deployed.** `packageSessionCore`'s runtime behaviour is unchanged, so redeploying the package
Functions would be churn without benefit. Phase 2B deploys the new checkout callable that consumes
this seam.

---

## 24. ADMIN TR CHECKOUT — package auto-link, executor cutover, regional isolation (`8eaf741` → `d2e3ee2`, 2026-08-03)

**Frontend 1229 → 1383 (+154).** Functions **877 pass / 0 fail** and rules **170/170** are unchanged and were re-run, because this package changed no Function and no rule.

### What the suites pin, and why each one exists

**Package → service auto-link (`packageAutoLink.test.ts`, 45).** The mapping is READ from the sale snapshot (`allowedServiceIds`, else `serviceId`) and never inferred. The load-bearing tests are the refusals: a snapshot naming no service, or naming one this catalogue no longer has, is REFUSED with an actionable message rather than matched by name — a fuzzy match would burn a paid session off the wrong client's course, which is worse than the bug being fixed. A multi-service package always asks; it never auto-picks. A static guard greps the module for `serviceName`, `toLowerCase`, `localeCompare` and `.name ===` **with comments stripped**, because a guard that trips on its own documentation is one the next person weakens.

**Routing and isolation (`adminCheckoutRouting.test.ts`, 50).** Two writers are live at once. The tests assert a tenant reaches EXACTLY one: TR returns immediately after the executor call so it cannot fall through to the legacy writer below, the executor seam imports nothing from `firestoreActions`, and a refusal is surfaced rather than routed around.

**Intent and double-charge (`checkoutIntent.test.ts`, 19).** The key is minted once per screen, pinned against the executor's OWN `IDEMPOTENCY_KEY_RE` so a key this app mints can never be refused as malformed. The fingerprint is order-independent for allocations, products and option ids — cash-then-card and card-then-cash are the same checkout — but changes on any real money edit. An unrecognised error code is treated as UNKNOWN, because guessing "definitely failed" on an error nobody has seen is the guess that double-charges.

**Payment summary and debt (`trCheckoutSummary.test.ts`, 40).** Package value is removed BEFORE discount, proven by a case where the two orders differ. `collected + remaining === due` reconciles exactly in integer minor units. A fully unpaid checkout creates NO tender allocation: a zero-amount CASH leg would read as a completed cash payment in every report that counts allocations.

**Regional isolation (owner decision 2026-08-03).** `countryCode: GB` never renders the TR panel and never routes to the executor — including with a stale stored `mode: tr`, which is what makes hiding it safe rather than deceptive. Both modules are greped for `navigator`, `geolocation`, `language`, `Intl`, `timeZone` and `fetch(`, so no VPN, device language, timezone or page translation can participate.

**Live tenant fixtures.** The shipped decision functions are run over the configuration the four real tenants actually carry, so "whitecross is safe" is an assertion, not a claim: whitecross/herohairs → `HIDDEN` + `uk-legacy`; demo → `TR_ON` + `tr-executor` at version 3.

### Two defects the suites caught before they reached a salon

1. **`outstanding_m` was in the client payload and is not an accepted executor key.** Every TR checkout would have failed `INVALID_INPUT: unknown field(s)`. The executor derives the shortfall itself; a client that could state the balance could understate a client's debt. Now pinned against the sent payload specifically, excluding the local fingerprint.
2. **`isTurkeyCountry` trimmed whitespace and `isTurkeyTenant` did not**, so `' tr '` would have routed to the executor while the Settings card stayed hidden — a live Turkish checkout nobody could configure. A drift test now runs both over every casing/whitespace input.

### One defect the suites did NOT catch — see INCIDENTS 2026-08-03

The `settingsLoaded` gate that disabled the whitecross till passed 1361 tests, typecheck, build and lint. Every test asserted the guard was *present*, which was the thing that was wrong. A test that pins new behaviour cannot notice the behaviour is harmful; only asking "what must still be true for everyone else" does. That is now `::the UK Checkout button reduces EXACTLY to the old disabled={saving}`, which parses the button's `disabled` expression and fails on any term that can be truthy for a UK tenant.

### ⚠️ NOT verified

**No browser UI pass was performed** — the Chrome extension was not connected. Everything above is source, unit and deployed-artifact evidence. The live Admin flow on `demo` (package auto-link → Save → full → partial → unpaid) is **unverified through the UI** and is listed as the outstanding step in DEPLOYMENT_STATUS. A direct callable run was deliberately NOT substituted for it.

One functions-suite run reported 876/1 and three consecutive re-runs reported 877/0; the failing test was not identified before it stopped reproducing, so it is recorded as an unexplained flake rather than a clean result.

---

## 23. PRE-ADMIN-TR-CHECKOUT — `demo` checkout mode remediation (documentation + config, 2026-08-02)

**No test-suite change. No code change.** One configuration save on the `demo` tenant, verified
read-only. Recorded here because it is live evidence, and because the same pass corrected a stale
claim that this file's neighbours had been repeating.

**Method.** Written through the deployed owner-authoritative callable **`salownSaveCheckoutSettings`**
— *not* a direct Firestore patch — authenticated as the `demo` tenant **owner** (`tenantId` claim
`demo`, stored staff role `owner`, `superAdmin: false`), under the real `expectedVersion: 1`
stale-version gate. The harness refuses to run if the minted token's `tenantId` is anything but
`demo`, or if it carries `superAdmin` — the callable writes to `token.tenantId` and nothing else, so a
wrong token would have silently configured a different salon.

**Payload — the whole of it:** `{ enabled: true, mode: 'tr' }`, `expectedVersion: 1`. Everything else
was omitted deliberately, so the callable's top-level merge preserves each stored owner value.

### What the read-back proves (all pass)

- **Exactly 3 of 46 stored fields differ:** `mode` `uk → tr`, plus the two the server owns
  (`schemaVersion` `1 → 2`, `updatedAt`). **43 fields byte-unchanged** — every `methods`,
  `providers`, `permissions` and `receivables` value survived.
- Settings version incremented **exactly once**; `contractVersion` still `1`.
- `demo` presentation still **TR** (`countryCode: TR`, `TRY`, `tr-TR`) on the root doc **and**
  `settings/settings`.
- `packageSettings` **byte-identical** — canonical `sha256/16` `40a4e26d0a7d0cc8` before and after.
- PAY-1 `paymentSettings` still **absent**; the settings key set is unchanged (nothing added or removed).
- **No financial record created.** `bookings` 772 · `receipts` 0 · `receivables` 0 · `loyalty` 0 ·
  `checkoutIntents` 0 · `clientPackages` 1 · `packageLedger` 1 · `packageSessions` 0 ·
  `packageDefinitions` 2 — every count flat. `auditLogs` `70 → 71`: the one expected
  `CHECKOUT_SETTINGS_SAVED` row, which is the writer behaving correctly, not a side effect.
- **`tr-demo` untouched** — settings doc hash identical, `updateTime` still `2026-08-02T20:32:29Z`,
  `checkoutSettings` still **ABSENT**, all 10 collection counts flat.
- **`whitecross` and `herohairs` untouched** — settings doc hashes and `updateTime` identical
  (`2026-07-12T19:31:48Z` / `2026-07-13T14:32:21Z`), `checkoutSettings` still ABSENT.

### The stale claim that was corrected

`DEPLOYMENT_STATUS.md` and `ROADMAP.md` both asserted that *"`whitecross`, `herohairs`, `demo` and
`tr-demo` all have `checkoutSettings` ABSENT."* True when Phase 3 was verified; false within the hour,
because the owner saved a real configuration on `demo` at `2026-08-02T20:58:43Z` from the Phase 3B UI.
Both are corrected, and [TENANTS.md](TENANTS.md#demo--verification-tenants) is now the single durable
home for per-tenant configuration truth so the fact lives in one place rather than three.

### Not covered by this record

**The P0 package→Save gap is documented, not fixed** — no test asserts it and none should yet
([TREATMENT_PACKAGE_SYSTEM.md §15.1](TREATMENT_PACKAGE_SYSTEM.md#151-p0--package-selection-does-not-reach-the-cart)).
Nothing about the executor was exercised: `salownCheckoutBooking` still has **no call site in `src/`**,
so `demo` resolving `enabled: true` changes nothing a user can reach.

---

## 22. TR-D1 Phase 3B — regional disclosure on Payment Settings (`ecb6d93`, 2026-08-02)

Phase 3 passed every gate in §21 and **failed the owner's visual review**. Both things are true, and
the gap between them is the lesson: a settings screen can be correct, validated, permission-gated and
still unusable, because "every control is present and disabled" is not a design — it is the absence of
one. A UK owner met the whole Turkey-native checkout form greyed out.

Presentation only. No Functions, no rules, no shared schema — verified against `git status`, not
asserted.

| Gate | Before | After (measured 2026-08-02) |
|---|---|---|
| Frontend (`npm test`) | 1185 / 52 files | **1229 / 1229**, 53 files — +44 disclosure |
| Frontend typecheck | clean | clean |
| Production build | clean | clean |
| Lint | 2377 | **2377 — delta ZERO** |
| Functions / emulator / rules | 877 · 165/165 · 170/170 | **not run — untouched by this phase** |
| Live `tr-demo` | — | Save + version + blast radius re-checked |

### What the 44 tests pin (`src/components/settingsDisclosure.test.ts`)

The decision table across all five tenant shapes, and — the load-bearing group — that **disclosure
cannot change data**:

- a permission the screen no longer renders is still submitted **with its stored value**;
- a hidden `unpaid.staffLimit_m` and its approval threshold survive a save;
- hidden provider commission terms survive turning Kart Taksiti off;
- the section toggle is asserted **in source** to call `setOpenSection` and never the form setter, so
  expanding an accordion cannot mark the page dirty and be saved as a change;
- the Save payload still has exactly the six Phase 3 top-level keys.

Plus: the module is proven to contain no `fetch`, `geo`, `navigator`, `Intl`, `timeZone`,
`localStorage` or `document` — **IP address cannot participate in the decision**, which is the one
property this screen shares with the executor.

`LEGACY_TR_ACTIVE` earns its own tests. A non-TR tenant with an **enabled** configuration is not
hidden, because it is a live policy; a saved-but-off one is reported without a warning. Collapsing
those two into "not TR → show nothing" would have been simpler and would have hidden a financial
setting from the only person allowed to change it.

Packages: `resolvePackageDisclosure` is asserted to be **explicit-true only** (`1` and `'yes'` resolve
compact), every existing package control is still present in source, and the panel is proven **not** to
consult `countryCode` at all — packages are not being made a Turkey-only feature by a UX change.

### A guard that fired, and was obeyed rather than weakened

The first version of the module was called `paymentSettingsDisclosure.ts`, which broke §21's blunt
"no Phase 3 source may contain `paymentSettings`" check — the guard against confusing PAY-1 with the
private contract. The *file name* was the only offender, but the correct move was to rename the module
(`settingsDisclosure.ts`), not to teach the guard about exceptions. A guard with a carve-out is a guard
that will miss the real thing later.

### Live verification

Deployed `Settings-DeAHVGgw.js` is **byte-identical** to the local build. The shipped decision table was
executed across all five shapes and matched. On `tr-demo`, Save still reaches the deployed callable
(version `1 → 2`), nothing financial was created, and the tenant was restored byte-exactly.

> ✅ **Visual pass: CONFIRMED BY THE OWNER**, 2026-08-02, on the deployed release
> (`hosting:salown` `34d390b1afb16bc9`) — *"its fine i checked it"*. This closes the review that
> **failed** on Phase 3 and is what this package existed to fix.
>
> Recorded precisely, because the two are not the same evidence: the automated side asserts the
> touch-target and wrap affordances statically in source (`minHeight: 44`, `flexWrap`, `wordBreak`),
> and the owner looked at the live page. **No per-width matrix (320/360/390/430/desktop) was walked
> by either side** — the Chrome extension was disconnected for this session, so if a specific narrow
> width regresses later, that is a gap this record does not cover.

---

## 21. TR-D1 Phase 3 — private checkout Payment Settings (`9dfb2c8` · `8239620`, 2026-08-02)

The owner's control panel for the executor Phase 2B deployed. **The executor itself was not touched**
and was not redeployed — see [TR_CHECKOUT_ARCHITECTURE.md §11b](TR_CHECKOUT_ARCHITECTURE.md).

| Gate | Before | After (measured 2026-08-02) |
|---|---|---|
| Frontend (`npm test`) | 1098 | **1185 / 1185**, 52 files — +59 write-core, +28 form-logic |
| Functions (`npm test`) | 864 pass / 20 skip | **877 pass / 0 fail / 21 skip** (898 total) — +13 pure |
| Functions emulator (`npm run test:emulator`) | 147/147 | **165/165, 0 fail** — +18 new |
| Firestore rules (`test-firestore-rules.py`) | 154/154 | **170/170** — +16 new |
| Frontend typecheck | clean | clean |
| Functions typecheck | clean | clean |
| Panel + staff builds | clean | clean |
| Live `tr-demo` | — | **22/22** |

> The emulator total is a real run, not `147 + 18` on paper: the full suite was re-run because
> package and treatment emulator tests share the same `settings/settings` document this phase writes
> to, and "my 18 pass" would not have shown a collision there.

### What the 59 write-core tests pin (`src/utils/checkoutSettingsWrite.test.ts`)

The strict WRITE half of the contract, whose lenient READ half Phase 1 pinned. The valuable
assertions are the negative ones — what the writer **refuses** to store — because a settings document
the reader has to repair is a document that silently means something other than what the owner chose.

Contract separation is asserted **structurally, not by intention**: the Phase 3 sources are stripped
of comments and scanned, so `paymentSettings` and `packageSettings` cannot appear as code in any of
them (the files discuss both at length in prose, which is why a naive substring scan would have been
useless — and weakening it to let prose through would have let a real reference through with it). The
writer is proven to name exactly two document paths, to write exactly one field, never to write the
staff doc it reads, and never to mention a money, mail, package or booking collection. The Phase 1
core is asserted un-imported by this phase.

Also pinned: explicit `false` and `0` survive; `null` stays distinct from `0`; every one of the 15
method switches and all 9 staff permissions flip independently **without disturbing a neighbour**;
duplicate provider ids, unsupported instalment counts, float commission rates, rates for unsupported
counts, and an archived-but-enabled provider are each refused; the TR template is a pure value that
the panel loads into the form and never saves; and no tenant id appears anywhere in the sources, so a
pilot cannot become a production anchor.

### What the 28 form-logic tests pin (`src/components/checkoutSettingsPanel.test.ts`)

That **what the owner sees is what gets sent**: an untouched form round-trips to a payload resolving
to exactly the stored values. That an unreadable box is **reported, never defaulted** — a blank
"smallest deposit" that silently became 0 would change salon policy with nobody deciding to. That a
Turkish-typed `1.250,50` is read as 125050 minor units. That a provider id survives a rename, that
archiving always disables, and that `archived` is read from the RAW document rather than guessed from
`enabled` — the bug this suite actually caught during development, where a merely switched-off
provider would have been reported as archived.

### What the 18 emulator tests pin (`checkoutSettings.emulator.test.js`)

The properties only a real transaction engine shows. Owner writes; **stylist AND admin are refused**;
the role comes from the STORED staff doc, so a token minted before a demotion does not work; a caller
with no staff doc is refused; super-admin works without one; cross-tenant is structurally impossible
because the claim picks the document. The version increments by exactly one per save, a stale save is
refused **and changes nothing**, and a document written by a newer contract is not overwritten.

The blast-radius test is the one worth keeping: after a save, `bookings`, `receivables`,
`clientPackages`, `packageLedger`, `checkoutIntents`, `finance_payments`, `notifications` and
`auditLogs` are all still empty, `packageSettings` and `presentation` are byte-identical to seed, and
the **public tenant root was never even created**.

### The 16 rules cases

staff/admin denied · owner/super-admin allowed · cross-tenant denied · unauthenticated read AND write
denied · the create branch (which cannot diff against a prior resource) · **the self-escalation
attempt the rule exists to stop** — a stylist raising their own `unpaid.staffLimit_m` · and three
no-regression proofs: same-tenant staff still READ the settings doc, PAY-1 on the public root is
unchanged, and `packageSettings` keeps its own independent gate.

### Live verification — `tr-demo`, 22/22

Against the **deployed** callable and **deployed** rules with real minted ID tokens. Owner saved;
version `1 → 2`; superseded-version save refused `SETTINGS_VERSION_CONFLICT` and changed nothing;
stylist `PERMISSION_DENIED`; unauthenticated `UNAUTHENTICATED`; unauthenticated REST read **HTTP 403**.
The deployed Phase 2B executor resolved the saved configuration without redeploy —
`STALE_SETTINGS_VERSION` on a superseded version, past the gate to `BOOKING_NOT_FOUND` on the current
one. PAY-1, `packageSettings` and `presentation` byte-compared unchanged. `tr-demo` restored
byte-exactly, and the two synthetic staff docs minted for the role test removed (the tenant had none).

> One probe failed on the first run and it was the **test** that was wrong, not the product: the
> payload carried `outstanding_m`, which is not in the executor's accepted request field list, so it
> was refused at input validation before ever reaching the settings gate — proving nothing. Recorded
> because a green "executor accepts the version" that never reached the version check is exactly the
> kind of false pass a verification run exists to avoid.

### Lint

+16 problems, all `no-undef` on `require`/`process`/`__dirname` in the two new CJS Functions test
files — identical in class to every existing functions test, since the frontend ESLint config has no
Node environment for `functions/`. **Zero** new problems in any TypeScript or TSX source.

---

## 20. TR-D1 Phase 2B — the server-authoritative checkout executor (`a0bc7fa` · `ceb5316`, 2026-08-02)

**DEPLOYED + LIVE-VERIFIED.** One new callable, `salownCheckoutBooking` (europe-west2).
**Nothing calls it yet** — see [TR_CHECKOUT_ARCHITECTURE.md](TR_CHECKOUT_ARCHITECTURE.md).

| Gate | Pinned before | After |
|---|---|---|
| Functions suite | 828 (809 pass / 19 skip) | **861** (841 / 20) — +32 new, +1 pre-existing skip counted |
| Full emulator suite | 105 | **147** — +42 new |
| Frontend | 1069 | **1069** unchanged |
| Firestore rules | 145/145 | **154/154** — +9 new |
| Package engine · concurrency | 72 · 27 | **72 · 27** unchanged |
| Frontend + Functions typecheck | clean | **clean** |
| `git diff --check` · secret scan | clean | **clean** |

**No existing test file was touched and no existing expected value was changed.** Lint is +14, all
`no-undef` on `require`/`process`/`__dirname` in the two new CJS test files — byte-for-byte the
pattern every existing functions test file already carries; `executor.ts` itself lints clean.

### 32 pure tests (`functions/src/checkout/executor.test.js`)

The load-bearing ones are **byte-proofs**: the suite reads `src/utils/receiptMath.ts` and the
executor, extracts `computeEarnBase_p` and `expectedPointsFor` from each, and compares the bodies
character for character. `functions/` is a separate CJS build with `noResolve` and cannot import the
frontend ESM module; copying a money rule across that boundary *without* the proof is how a product
grows two loyalty policies.

Also pinned statically:
- [x] exactly ONE definition of each loyalty function in the executor
- [x] the Phase 2A seam is driven; the package **callable** never is
- [x] exactly one transaction, no nesting
- [x] every read precedes every write
- [x] no external side effect inside the transaction body (a callback can be RETRIED)
- [x] **NOTHING can refuse after the seam has staged its writes**
- [x] no `stockQty` write, no dormant inventory call
- [x] no customer name, phone or email in the returned result
- [x] the request shape: unknown fields rejected loudly, client product price/name rejected,
      currency not a field at all, money integer-minor-units only, known zero accepted
- [x] the fingerprint: same intent replays, every operator decision changes it, the clock and every
      resolved price are excluded, cart order is irrelevant, tenants cannot collide

### 42 real-Firestore tests (`functions/src/checkout/executor.emulator.test.js`)

Genuine optimistic concurrency, genuine `tx.create` rejection, genuine rollback — a fake would only
prove that our fake behaves the way we imagined Firestore behaves.

Auth + tenant isolation · role denial · BLOCKED / cancelled / no-show / already-checked-out · cash ·
card · bank transfer · 3-way split · partial · fully unpaid · Kart Taksiti with **no** salon
receivable and snapshotted commission · Salon Taksit Planı with a schedule summing to the debt ·
disabled methods · unknown provider · unsupported bank and salon instalment counts · stale settings ·
checkout disabled · known zero vs unrecorded price · package-only · package plus extra · exhausted
and cross-client packages · **a refused checkout rolling the package consumption back with it** ·
product-only catalogue pricing · service plus products · inactive / out-of-stock / malformed-price /
missing products · client-supplied price · historical snapshot stability across a price rise ·
anonymous sale · product-only earning nothing and counting no visit · replay · fingerprint conflict ·
double tap · two-device race · one visit/spend/award/receipt-intent/receivable · TRY · GBP incl. the
flagged non-reconciling receipt · prior deposit · discount and tip bounds · **no `stockQty`
movement** · a package plan never restruck as an ordinary receivable · missing/archived service.

### Two real defects this suite caught

Both fixed in the executor before commit, rather than pinned as expected behaviour:

1. **Refusals sited AFTER the package seam** would have committed an entitlement consumption with no
   checkout attached — `packageSessionTx` stages writes, and a `return { kind: 'reject' }` afterwards
   does not abort a Firestore transaction. Every refusal moved ahead of the seam; the static test now
   forbids the regression.
2. **A product-only sale computed and STORED a loyalty award it never granted** — 100 points on the
   sale document, nothing on the client. The award is now gated at source. A document that records an
   award nobody received is a lie every later reader compounds.

### 9 rules cases (`docs/test-firestore-rules.py`, 145 → 154)

**No rules change was made and none is needed** — `checkoutIntents`, `receivables` and
`receivableLedger` are not in the `[G4]` explicit write list, so the catch-all `allow write: if
false` already denies every client write. The cases pin that, because the guarantee is currently a
property of a list nobody edited rather than of a rule anybody wrote. Admin/owner/staff create and
update are DENY; cross-tenant and unauthenticated read are DENY; same-tenant read stays ALLOW
(deliberately — the till must show a client their balance).

### 28 live assertions on `tr-demo` (2026-08-02)

Invoked through the **deployed** callable with a real Firebase ID token, not the local core.

- Unauthenticated HTTP POST → `401 UNAUTHENTICATED` with the executor's own `sign-in required`,
  proving the deployed revision runs the new code.
- Before enabling anything: `CHECKOUT_DISABLED` — the fail-closed default, live.
- Cash · card · 3-way split · partial (+ receivable TRY/OPEN/reconciled) · fully unpaid ·
  Kart Taksiti (no receivable; 250bp + 25 fee → settlement 9725) · Salon Taksit Planı (3 instalments
  summing to 9000).
- Product-only sale priced from the catalogue · service+product earning 150 · client-submitted price
  rejected · **`stockQty` 7 → 7 unchanged**.
- Replay returns the stored result · fingerprint conflict · double tap charges once · two-device race
  has one winner.
- TRY receipt currency-explicit · the pence-named legacy snapshot **not** written for TRY · one
  deterministic `receiptEmailIntentKey` and `sendLoyaltyEmail` untouched.
- BLOCKED refused · stale settings refused · booking outside the claimed tenant not found.

**Cleanup verified.** 34 synthetic documents plus 12 `CHECKOUT_COMPLETED` audit rows deleted; the
synthetic auth user deleted; `settings/settings` restored and confirmed **identical by sha256**
(1178 bytes, all 18 original keys, `checkoutSettings` removed). Seeded content untouched — services
12, barbers 4, serviceCategories 4. `bookings`/`clients`/`products`/`staff` are 0 because the seeder
never creates them, not because anything was removed.

> One honest note on the run: the harness first reported the settings restore as *not* byte-identical.
> That was the harness comparing JSON key ORDER after a Firestore round-trip, not a data difference —
> confirmed by canonical-form sha256 equality. The check was wrong, not the restore.

