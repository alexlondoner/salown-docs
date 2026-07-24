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

**Last run: 2026-07-24 → ✅ 131/131 passed** (R1 phase-A added 36 cases on top of the 95/95 baseline).

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

## Related
- [SECURITY.md](SECURITY.md) — rules/security (source of the tested behaviors)
- [ROADMAP.md](ROADMAP.md) — work list (tests moved here, only a pointer there)
- [DEPLOY.md](DEPLOY.md) — deploy order (rules LAST; test → deploy)
