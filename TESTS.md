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

**Last run: 2026-07-31 → ✅ 145/145 passed** (TR-A added 14 cases on top of the 131/131 R1 phase-A baseline).

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
| Firestore rules (`test-firestore-rules.py`) | ✅ **145/145** (+14 TR-A) |
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

**22/23 passed**, plus **8/8** read-only anchor checks. Drove the exact deployed engine against production Firestore.

- [x] sale dated by the **Istanbul** calendar; session recognised on its own Istanbul day
- [x] cash ₺2.000 · delivered ₺1.000 (one eighth) · outstanding ₺6.000 · deferred ₺1.000 · accrued 0
- [x] the deferred/accrued identity and TR-B's `M1` both hold on live data
- [x] a period before the sale reports zero
- [x] export typing and minor-unit serialisation on real documents
- [x] **cleanup verified** — 3 synthetic docs deleted, `packageSettings` removed, settings doc otherwise byte-identical

**The one failure was a stale assertion, and it found something real.** The test asserted TR-B's
2026-07-31 baseline *"no live tenant carries `packageSettings`"*. That is **no longer true**: the
`demo` tenant has since opted in (`enabled: true`, 1 definition, 0 sold). That is deliberate use of a
shipped feature, not a leak — so the assertion was corrected to the claim that actually matters:

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
