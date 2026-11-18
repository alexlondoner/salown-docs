# salOWN Customer App — discovery of the current QR / customer portal and plan for a separate customer app

- **Status:** DISCOVERY / PLAN ONLY. No code, no deploy, no production write, no message sent, no app created.
- **Date:** 2026-11-18 (UK)
- **Author:** alish / customer-app-discovery session
- **Sources:**
  - **Main:** `salown-app` `origin/main` **`ab671a7f`**, read from a `git archive` snapshot outside the shared tree.
  - **Docs:** `salown-docs` `origin/main` **`d73932d`**.
  - **whitecross-site:** working copy at `d21fa91e`.
- **Live reads:** read-only, with no customer data, no tokens and no personal data.
  - Live Firestore ruleset `a5f92395-132a-4524-bf30-eb1bb9c78331`, created 2026-11-09T20:24:48Z, fetched through the Rules REST API (sha256 `edf88dab…60cb`).
  - Live `salown.com` HTML and JS: Admin entry `index-CIeQoMJK.js`, `Clients-BawILY2F.js` chunk.
  - Live `whitecrossbarbers.com/loyalty.html` bytes.
  - Live HTTP status of `/loyalty/x`, `/manage/x` and `/.well-known/apple-app-site-association`.
- **Not touched:** Stripe (`SALOWN-STRIPE-PLATFORM`), onboarding (`ONB-GUIDED-SETUP` W3a/W3b), native Staff (`STAFF-NATIVE-D1`) claims and paths.

> **Main vs live.** Every finding is labelled **LIVE** (measured on production bytes or the live ruleset), **MAIN** (read in `ab671a7f` source only) or **UNVERIFIED**. Live Cloud Functions revisions were **not** measured in this pass. A callable described from main source is "main source", not "live behaviour". Note that main's `firestore.rules` differs from the live ruleset: main contains the unreleased `tenantLifecycleActive` W3a gate. The booking/client clauses quoted below were checked in **both**.

---

## A. Current flow map: QR → identity → client record → actions

### A1. The Clients-page QR ("Digital Loyalty Card")

```
Admin → Clients → client drawer → "Digital Loyalty Card"
  └─ "⭐ Generate QR Card"  (src/pages/Clients.tsx:389-395)
       writes tenants/{t}/clients/{id}.loyaltyToken = crypto.randomUUID()   (browser, staff auth)
  └─ URL  https://salown.com/loyalty/{tenantId}?t={token}                 (Clients.tsx:1011)
  └─ QR image = <img src="https://api.qrserver.com/v1/create-qr-code/?…data={URL}">  (Clients.tsx:1012)
  └─ "Copy Link" copies the same URL                                       (Clients.tsx:1019)
```

- **LIVE:** the live `Clients-BawILY2F.js` contains `loyaltyToken`, `api.qrserver.com`, `salown.com/loyalty` and "Generate QR Card". The feature is shipped.
- **LIVE:** `GET https://salown.com/loyalty/x` returns **404** (Firebase "Page Not Found").
  - `firebase.json:57-77` has no `/loyalty` rewrite and no catch-all.
  - The SPA has no `/loyalty` route (`src/App.tsx:26-36`).
  - **Every QR and "Copy Link" handed out by the salOWN Admin leads to a 404.**
- **LIVE:** the public salon page also links to the dead path. The loyalty button is at `src/pages/SalonSitePage.tsx:723`, `href="https://salown.com/loyalty/${tenantId}"`, and is present in the live bundle.
- **Token lifecycle:**
  - no expiry, rotation, revoke or device binding;
  - it is generated once, only if missing (`Clients.tsx:390`);
  - the tenant data export scrubs it (`functions/src/onboarding/dataExport.test.js:97`).
- **Answers to the brief, for this QR:**
  - **What is inside:** `tenantId` + a UUIDv4 bearer token. No client id, email or phone.
  - **How the customer is recognised:** they are not. Nothing on salown.com consumes the token.
  - **Is there a customer account:** no.

### A2. The only consumer of `loyaltyToken`: the Whitecross-only page

```
whitecrossbarbers.com/loyalty.html  (PWA: loyalty-manifest.json, loyalty-sw.js; T='tenants/whitecross' hard-coded, :666)
  startup: ?t=token → Firestore query clients where loyaltyToken==t limit 1      (:796)
  or "Find my card": phone / clientPhone / email → clients … limit 1              (:760-771) + client-side surname check (:726-735)
  "session" = localStorage 'wc_loyalty_id' = "phone:+44…" | "email:…"            (:692, :749)
  loadApp: bookings where clientPhone==… / clientEmail==… limit 100               (:876, :882)
  booking: addDoc(bookings, {status:'CONFIRMED', source:'App', …})                (:1298-1312)
```

- The legacy barber panel generates QR codes for this page (`whitecross-site/barber-panel/src/pages/Clients.js:488-494, :1297`), also through `api.qrserver.com`.
- **LIVE:** the served `loyalty.html` is byte-identical to the working copy (sha256 `e2b0eb85…56c5`).
- **LIVE (rules):** every read above is **denied** for an unauthenticated browser.
  - Rule: `match /clients/{document=**} { allow read, create, update: if isSuperAdmin() || isTenantAny(tenantId); … }` (live ruleset line 1043; main `firestore.rules:1071`).
  - Bookings: `allow read: if isSuperAdmin() || isTenantAny(tenantId)` (live line 577; main `:601`).
  - So the page cannot load anyone's card today. It is **functionally dead, and safe only because of the rules**.
- **Answers to the brief, for this page:**
  - **Can someone who copies the QR see the client's history?** Not today, because the rules deny it. By its design, yes: the token, or a phone/email plus surname, exposes the whole client document and up to 100 bookings.
  - **Does an id, email or phone in the URL grant access on its own?** By design, a phone or email does (plus a surname typed client-side). Live, no.

### A3. The working customer surface: "Manage booking" links in e-mails

```
Confirmation / reschedule / reminder e-mail
  link https://salown.com/manage/{t}/{bookingId}?email=…        (functions/src/emails/index.ts:233,317; reminderEmail.ts:77)
    → /manage/** rewrite → ManageBooking.tsx (src/App.tsx:33; firebase.json:74)          LIVE 200
    → salownGetBookingByToken   (index.ts:1820)  returns service, time, staff, status, clientName, duration, add-ons
    → salownCancelByToken       (index.ts:1889)  tenant gate, past/checked-out refused, cancellationWindowHours (default 8), Stripe Connect refund
    → salownRescheduleByToken   (index.ts:2060)  rescheduleWindowHours (default 2), transaction re-check
    → salownGetBusySlots        (index.ts:1435)  slots, excludeBookingId + email
```

- **The "token" is `bookingId` + email.** `findBookingByToken` queries `bookingId == X limit 1` inside `tenants/{t}` and compares `clientEmail` case-insensitively (`functions/src/bookings/shared.ts:20-31`).
- It has no expiry and no login.
- **LIVE (bundle):** the live Admin bundle contains all four callable names. The Functions revisions themselves are **UNVERIFIED** in this pass.
- whitecross-site `cancel.html` (`:376,406`) and `Reschedule.html` (`:620,694`) call the same callables with `?id=&email=`.

### A4. Guest booking (`/s/{t}`, `/book/{t}`)

- **Identity captured:** name, e-mail and phone are all required and **never verified** (`src/pages/BookingPage.tsx:941-944`).
- **Write path:** the `salownCreateBooking` callable (`BookingPage.tsx:528`; mode pinned to `callable` at `src/utils/hostedBookingCutover.ts:36`). A legacy `addDoc` fallback still exists in code (`BookingPage.tsx:1044`).
- **Linking to a client record:** done on the server by `resolveClientIdentity` on email/phone (`functions/src/bookings/createBooking.ts:671-674`; `functions/src/clients/identity.ts:204-232`).
  - It never trusts a caller-supplied `clientManualId` or name.
  - On a match it stamps `clientManualId` (`createBooking.ts:1236`).

### A5. What a "customer" is today

- **No customer accounts exist.** There is no `signInWithEmailLink`, phone auth, anonymous auth or `createCustomToken`, and no `customers`, `users` or `platformUsers` collection. All Firebase Auth users are staff, owners or super-admins (email + password only: `Login.tsx:214`, `StaffApp.tsx:306`, `Signup.tsx:231`).
- A person exists only as **per-tenant** `tenants/{t}/clients/{id}` documents. **Nothing links the same person across salons.**
- **Login, session, token lifetime, revoke, device change:** none of these exist for customers. The only proofs are the e-mail-link pair (`bookingId` + email) and the loyalty UUID. Neither is verified, expiring or revocable.
- **Page refresh, other device, multiple salons:**
  - The manage link works on any device, because it is a bearer link.
  - Nothing persists between visits.
  - Each salon is entirely separate, and a person with bookings at two salons has two unrelated links.

---

## B. Feature status table

Legend:
- **LIVE**: measured on production in this pass.
- **MAIN**: present in main source; live parity not measured.
- **PARTIAL**: exists but is incomplete or broken.
- **NONE**: does not exist.
- **UNVERIFIED**: not checked.

| Capability | Status | Evidence / note |
|---|---|---|
| QR / "Digital Loyalty Card" generation in Admin | **LIVE, broken target** | `Clients.tsx:389,1011`; target 404 (A1) |
| `/loyalty` customer page on salown.com | **NONE** (404 LIVE) | `firebase.json:57-77` |
| Whitecross `loyalty.html` card / history / booking | **PARTIAL, dead under live rules** | A2 |
| Guest online booking | **LIVE (UI)** · callable MAIN | `BookingPage.tsx:528` |
| View one booking via e-mail link | **LIVE (UI)** · callable MAIN | `/manage/**` 200; `index.ts:1820` |
| Cancel via link, with window and auto refund | **LIVE (UI)** · callable MAIN | `index.ts:1889-1938` |
| Reschedule via link, with window | **LIVE (UI)** · callable MAIN | `index.ts:2060-2085` |
| Upcoming + past bookings list for a customer | **NONE** on salOWN (dead WC page only) | — |
| Rebook / favourite salon or staff | **NONE** | — |
| One customer account across several salons | **NONE** | A5 |
| Customer login (any method) | **NONE** | A5 |
| Membership coverage, remaining allowance, expiry (customer view) | **NONE**: all collections staff/admin-only | `firestore.rules:1342-1351` |
| Package sessions (customer view) | **NONE** | — |
| Points balance (customer view) | **E-mail only**: loyalty receipt shows points | `salownSendLoyaltyEmail`, `index.ts:841` |
| Payment / deposit / refund status shown to the customer | **NONE** beyond e-mails | — |
| Profile / contact-preference editing | **NONE**; only unsubscribe | `salownEmailOptOut`, `index.ts:3568-3628` |
| Customer account deletion / self-service export | **NONE** | owner export only, `index.ts:2503` |
| Customer reminders | **PARTIAL**: staff-triggered `salownSendReminder` (`index.ts:753`); no scheduled reminder job | — |
| Add to calendar | **PARTIAL**: Google Calendar render URL in e-mail (`emails/index.ts:90`); no `.ics` | — |
| Customer WhatsApp confirmation | **MAIN**: B7 is `PUSHED_NOT_LIVE` (`ROADMAP.md:283`) | `index.ts:4968-4996` |
| Customer push / SMS | **NONE** (FCM is staff-only) | `firestore.rules:1315` |
| Contact the salon from a booking | **NONE** in-product (e-mail reply-to only) | — |
| Universal links / app association | **LIVE file, empty**: `{"applinks":{"apps":[],"details":[]}}`. Its source is not in the repo; Hosting ignores `**/.*` (`firebase.json:7,84`) | UNVERIFIED origin |
| Public promise "Client app · Pro & Pro+" / "Native App Store apps on Pro+" | **LIVE marketing copy with no product behind it** | `hosting/apps.html:10,166-169`; `index.html:519-522`; `features.html:195` |

---

## C. Security and data-model findings

The "Reach" line on each finding says who can trigger it. None of these was exploited or tested against production. Findings marked *PLAUSIBLE* need an emulator test before they count as confirmed.

### C1. MEDIUM — the public booking update rule bypasses the server cancel/reschedule logic (LIVE rule)

- **Where:** live ruleset `bookings` update (lines 126-137); main `firestore.rules:722-737`.
- **What the rule allows:** any unauthenticated caller may update a booking whose `clientEmail` is set, provided `clientEmail` and `bookingId` are unchanged and only `status`, `rescheduledTo`, `cancelledAt`, `cancelReason`, `date`, `time`, `startTime`, `endTime`, `rescheduledAt`, `barberName`, `barberId` or `updatedAt` change.
- **What it bypasses:** the cancellation/reschedule windows, the conflict check, the refund flow and the tenant gate, all of which live in the callables.
- **Reach:** needs the Firestore **doc id**.
  - Strangers cannot guess it (20 random characters).
  - The booker has it: `salownCreateBooking` returns `docId` (`functions/src/index.ts:1548`).
  - So this is self-service tampering by the person who booked: moving their own slot onto someone else's, or changing status.
- *PLAUSIBLE, not tested:* whether `PENDING → CONFIRMED` (escaping `salownCleanupExpiredPending`, `index.ts:4787-4797`) is blocked by `m3UpdateAllowed()` / `checkoutLifecycleHeld()` needs an emulator case.
- **Customer-app implication:** an authenticated app must never write bookings directly. This clause should be narrowed or removed once the remaining legacy writers are gone (`whitecross-site` reschedule pages were already moved to callables).

### C2. MEDIUM — the public booking create rule allows direct `addDoc` (LIVE rule)

- **Where:** live lines 104-125; main `:696-721`.
- **What it allows:** `status in ['PENDING','CONFIRMED']` with a tenant that accepts public bookings. Money and identity fields are banned. Caller-chosen `bookingId`, `clientEmail`, `price`, `source` and time are allowed.
- **Risks:**
  - slot squatting with no server conflict check;
  - a confirmation e-mail sent under the salon's name to any address (`salownBookingConfirmationTrigger`, `index.ts:4678-4727`, for `source:'website'|'salown'`, `emails/index.ts:106-109`), i.e. spam or phishing;
  - a duplicate `bookingId` can shadow a real customer's manage link, because the lookup is `limit 1` (`shared.ts:23-26`).
- **Reach:** unauthenticated. Writers that still depend on this are `BookingPage.tsx:1044` (fallback) and Whitecross `loyalty.html:1298`.

### C3. MEDIUM — the manage link is a weak, permanent bearer credential (MAIN source; live UI uses it)

- **The credential:** `bookingId` (`WEB-{epochMs}-{6 hex}`, `createBooking.ts:1145-1147`, i.e. about 24 random bits plus a guessable timestamp) together with an often-known e-mail.
- It never expires, cannot be revoked and survives being forwarded.
- **No protection on the calls:**
  - `salownGetBookingByToken`, `salownCancelByToken`, `salownRescheduleByToken` and `salownGetBusySlots` have **no rate limit and no App Check**;
  - `salownGetBookingByToken` has no `maxInstances` either.
- **Reach:** unauthenticated. Brute force needs the victim's e-mail and an approximate booking time.
- **Customer-app implication:** fine as a "manage one booking" fallback once hardened, but it must not become the app's identity model.

### C4. HIGH (latent) / dead today — the Whitecross `loyalty.html` design

- Phone, e-mail or token gives the whole client document plus booking history, with the surname check done only in the browser. "Login" is a phone number stored in `localStorage`.
- Today this is blocked only by the rules (A2).
- **It must not be revived or used as a template.** Re-opening `clients` or `bookings` reads to the public for it would be a PII leak.
- Its booking path writes `status:'CONFIRMED'` directly (C2). Whether that is reachable live while the read path fails is **UNVERIFIED**.

### C5. HIGH (blocker for the plan) — customer Auth users in the same project could call owner-onboarding and AI functions (MAIN)

- **`provisionTenant`** (`functions/src/index.ts:411-447`) requires only `request.auth` and no existing `tenantId` claim. It does not check `email_verified` or the account type.
  - A customer Auth account could create a trial salon as its owner.
- **`askAI`** (`functions/src/ai/askAI.ts:23`) is auth-only and spends the Anthropic key. The gate lets claim-less users through (`functions/src/onboarding/tenantCallableGate.ts:140-149`).
- Owner self-signup also produces claim-less users, so a customer is today indistinguishable from a half-finished owner signup.
- **Firestore rules are fine:** no rule grants anything to "signed in" alone. The only `isAuth()` grant is `staff/{uid}` with uid/tenant conditions (`:1041-1045`), and the catch-all is super-admin-only (`:1519-1521`).
- **Required before any customer login ships:**
  - an explicit account-type marker (claim set server-side, e.g. `acct:'customer'`, or a blocking function);
  - every owner/staff callable refuses customer principals.

### C6. LOW — the QR token is sent to a third party (LIVE)

- The full loyalty URL with its bearer token goes to `api.qrserver.com` when the image loads (`Clients.tsx:1012`; also the legacy panel `Clients.js:1297`).
- Harmless while the target is a 404, but any revival of a token-based page makes it a leak.
- **Fix:** generate the QR locally, and don't carry a long-lived bearer token in the QR anyway (D3).

### C7. LOW — dead customer-facing links (LIVE)

- The Admin QR / "Copy Link" and the `SalonSitePage` loyalty button point at a 404.
- This is a trust and support issue, not a data issue.

### C8. LOW — unsigned unsubscribe (MAIN)

- `salownEmailOptOut` takes a raw `email` + `tenant`.
- Anyone can unsubscribe anyone, and `tenantId` goes into the path unvalidated (`index.ts:3568-3628`).

### C9. MEDIUM (data model) — unverified identity attaches bookings to existing client history (MAIN)

- Guest booking matches `clients` by **unverified** e-mail or phone (A4).
- Anyone typing someone else's e-mail or phone gets their booking linked to that person's client record.
- **Customer-app implication:** the app must never show "your history" based on a booking-supplied identity. It may only show records reached through a **verified** link (D2).

### C10. Data-model questions from the brief

- **Families sharing a phone or e-mail:**
  - The current resolver links by exact e-mail/phone.
  - For the app, a verified login (e-mail X) may match **several** client documents in one salon (e.g. parent and child).
  - **Rule:** more than one candidate means no automatic link. The customer chooses which profiles are theirs, with salon confirmation, or the salon links them.
  - Never decide by name.
- **Wrong-salon / name-only match:**
  - Links are always created **per tenant** and need a verified identifier match or a salon-issued invite.
  - Name-only is never a linking signal (consistent with the CLAUDE.md "NEVER match by name alone" rule).
- **The same person at several salons:** one platform account, with **one link per salon** to that salon's own client document. Balances, points and memberships are never merged or summed across salons.
- **Change of e-mail or phone:**
  - The account identifier change is verified on the platform side.
  - The salon's client record is not silently rewritten. The salon's existing `_aliases` mechanism stays the salon's.
- **Account deletion:**
  - Delete the platform account and all links.
  - Salon client records are **controlled by each salon** (they hold visit and finance history). They are unlinked, not erased, and the customer is told to ask the salon for erasure, or a salon erasure request is filed.
  - This needs a legal / UK GDPR check (open decision E3).

---

## D. Proposed customer account model and sign-in

### D1. Model (proposal, not built)

```
Firebase Auth user (uid)  ── custom claim {acct:'customer'}  (set server-side only)
   │
   └─ customerAccounts/{uid}                       platform-level, server-write only
        verifiedEmail, verifiedPhone?, createdAt, deletedAt?, notificationPrefs
        │
        └─ customerLinks/{uid}_{tenantId}         platform-level, server-write only
             tenantId, clientId (tenants/{t}/clients/{id}), linkedBy: 'verified_email'|'salon_invite'|'staff',
             linkedAt, linkedByActor?, status: active|revoked
                │
                └─ tenants/{t}/clients/{clientId}   unchanged, salon-owned; balances stay here
```

- **Reads go through callables:**
  - `customerGetHome`, `customerListBookings`, `customerGetEntitlements` and similar resolve `uid → active links → tenant docs` with the Admin SDK and return **whitelisted fields only**.
  - **No Firestore rules opening `clients`, `bookings` or membership collections to customers.** That keeps the one global ruleset unchanged for v1.
- **Writes** (book, cancel, reschedule) go through authenticated twins of the existing callables. They take `uid`, not `bookingId`+email, and assert `booking.clientManualId ∈ linked clientIds` for that tenant on the server.
- **Salon control:**
  - Salon staff can see and revoke a link from the client drawer.
  - A salon can disable the customer app per tenant (feature flag + plan gate).

### D2. How a link is created (in order of trust)

1. **Salon invite (recommended QR use).** Staff press "Invite to app" in the client drawer. This makes a **one-time, hashed, expiring invite** with the same shape as owner invites:
   - `inviteCore.ts:12-19`: locator + secret, only sha256 stored, `timingSafeEqual`, 7-day TTL, CONSUMED/EXPIRED;
   - shown as a QR (rendered locally) or sent by e-mail.
   - The customer signs in (D3) and redeems the invite, which creates `customerLinks` for exactly that client document.
   - The QR is a **link-once invitation, not a login key**. Copying a used or expired QR gives nothing.
2. **Verified-email auto-suggest.** After login, if the verified e-mail matches **exactly one** client in a salon where the customer has a booking, offer "Is this you at {Salon}?". The link is created only on confirmation.
   - Two or more matches give no auto-link.
   - A phone-only match gives no auto-link in v1 (shared or recycled numbers).
3. **Guest booking → account.** A booking made as a guest is attached when the customer later signs in with the **same verified e-mail** used on that booking.
   - Because the e-mail is verified at sign-in, this proves control of the address the booking was made with.
   - The server then links the booking's `clientManualId` only if it is unambiguous; otherwise the booking still shows but the client link waits for salon confirmation.

### D3. Sign-in options compared

| | **E-mail one-time code (6 digits)** | **E-mail magic link** (Firebase email-link) | **SMS one-time code** (Firebase phone auth) |
|---|---|---|---|
| Security | Good if hashed, short TTL, limited attempts. Proves inbox control. | Good. Link is the secret; risk if forwarded. | Weaker: SIM swap, recycled numbers. Firebase itself calls phone-only "less secure". |
| UX on phone | Type a code, so it works when the mail app is on another device | Must open the link on the same device; another device must re-enter the e-mail. Since Dynamic Links shut down (25 Aug 2025) it needs Hosting `linkDomain` + associated domains. | Best (auto-fill) |
| Cost | E-mail only (Brevo/Workspace) | E-mail only; Blaze quota 25k/day | UK ≈ **$0.04/SMS**, first 10/day free; traffic-pumping risk |
| Build in this codebase | Server callable + `createCustomToken`: new pattern (no custom tokens today); reuse `serverRateLimits` (`inviteRateLimit.ts`) and the invite hashing | Firebase SDK flow; needs deep-link plumbing in Capacitor | Firebase SDK; needs App Check / reCAPTCHA / silent push, SMS region policy = GB, Identity Platform for App Check |
| Delivery | Sender must be salOWN (not tenant Gmail): ties to EMAIL-SENDER-SPLIT | same | carrier dependent |

**Recommendation (for the owner to confirm):**
- **v1 = e-mail one-time code.** E-mail is already the identifier the system holds and uses for manage links.
- **SMS = later, optional second factor or alternative,** once App Check and a budget are in place.
- **No Google/Facebook login in v1.** That would make Sign in with Apple mandatory under Guideline 4.8. Using only our own sign-in system is exempt.

**OTP requirements (for the eventual spec):**
- 6-digit code, CSPRNG; stored as a hash with salt/pepper.
- **TTL 10 minutes, single use, invalidated by a newer code.**
- **Max 5 verify attempts per code.**
- Send limits per e-mail (e.g. 3 per 15 min, 10 per day) and per IP hash, using `serverRateLimits`.
- **No account discovery:** "If that address can sign in, we've sent a code" for every request; same timing and response for unknown e-mails.
- Constant-time compare.
- App Check on the send and verify callables.
- Audit row per issue / verify / fail.
- Session: Firebase ID token + refresh token. Logout = sign out + delete the device push installation. "Sign out everywhere" = `revokeRefreshTokens(uid)`.
- **New device = sign in again with a code.** No QR or device-transfer secrets.

---

## E. Scope: first release, later phases, open decisions

### E1. First release (v1) — matches the owner's proposal, with security first

1. **Secure sign-in** (e-mail code) + account deletion in-app (Apple 5.1.1(v)).
2. **Salon linking** via invite QR/e-mail and verified-e-mail suggestion (D2).
3. **Upcoming and past bookings** per linked salon (read-only callable).
4. **Rebook**: "book this again" = same service + same staff, next free slots, through the authenticated booking callable.
5. **Cancel / reschedule** under each salon's existing windows (`cancellationWindowHours`/`rescheduleWindowHours`, `BUSINESS_RULES.md:17-21`). Show the deadline in plain words, and show the refund outcome where Stripe Connect applies.
6. **Membership / package view (read-only)**: plan, period, remaining allowance and expiry, from the membership ledger via a whitelisted callable. **Package and loyalty-points views only where the salon uses them.** Points are per salon, never pooled.
7. **Notifications:** booking confirmation / change by push + e-mail; reminder scheduling is a separate server job (none exists today).
8. **Contact the salon:** tap-to-call / WhatsApp deep link / e-mail, using the salon's public details. **No in-app chat in v1.**

### E2. Explicitly not in v1

- Salon discovery / search / map.
- Marketplace ranking, commission, reviews and moderation.
- Full messaging.
- Buying memberships or packages in-app (MEMBERSHIP-PHASE1 is staff-sold, no Stripe: `ROADMAP.md:222`).
- Gift cards.
- Social login.

### E3. Later phases

| Phase | Content |
|---|---|
| v1.1 | Add to calendar (`.ics`); directions; post-visit rating that stays private to the salon; contact request form |
| v1.2 | Waiting list; SMS code (opt-in); favourite staff alerts |
| v2 | Buy membership / package via Stripe Connect (physical in-person service, see F-note); deposits shown with refund status |
| v3 (platform) | Multi-salon discovery, availability search, location; public reviews with moderation; marketplace (ADR-016 Trust Score still *Proposed*, `DECISIONS.md:167-190`) |

### E4. "Contact the salon": options compared

| | Phone / WhatsApp deep link | Contact-request form (stored, e-mailed to salon) | In-app messaging |
|---|---|---|---|
| Build cost | Very low | Low–medium | High (threads, push, unread, moderation) |
| Spam risk | Salon's existing channels | Need rate limits; only linked customers | Need block / report, rate limits |
| Staff workload | Unchanged | New inbox duty, light | Ongoing; needs response-time expectations |
| Notifications | None needed | E-mail / Telegram to salon | Push to staff + customer both ways |
| Record keeping | None in salOWN | Stored per booking; retention rule needed | Full retention / GDPR export / erasure |

**Recommendation:** v1 = deep links. v1.1 = a booking-scoped contact request. Chat only after demand is measured. Fresha only lets clients start a chat after booking; Booksy documents a Call button, not chat.

### E5. Extra product ideas, ranked (suggestions, not approved)

| # | Idea | User value | Cost |
|---|---|---|---|
| 1 | One-tap rebook (same service + staff) | High | Low (v1) |
| 2 | Add to calendar (.ics) | Medium | Very low |
| 3 | Directions to salon | Medium | Very low |
| 4 | Plain-language cancel / refund deadline on each booking | High (fewer disputes) | Low |
| 5 | Waiting list / "notify me if a slot opens" | High | Medium-high (needs slot-freed events) |
| 6 | Private post-visit feedback to the salon | Medium | Low-medium |
| 7 | Public reviews | Medium | High (moderation, fraud) |

### E6. Open decisions (owner)

- **E-OPEN-1** — the account-deletion contract for the salon-held client record (unlink only, or also file an erasure request to each salon). Needs a UK GDPR check.
- **E-OPEN-2** — whether salons opt in per tenant and which plan includes it.
  - The public site already promises "Client app · Pro & Pro+" and "Native App Store apps on Pro+".
  - Per-salon App Store apps conflict with Apple 4.2.6: template apps must be submitted by the content provider, i.e. each salon's own developer account.
  - A single multi-salon app is the "picker" model 4.2.6 explicitly allows.
  - **Marketing copy will need correcting either way.**
- **E-OPEN-3** — the customer-app brand / name and bundle id. Proposal: `com.salown.app` or `com.salown.client`. Must not be `com.salown.staff`.

---

## F. Screen flow and text wireframes

```
[1 Welcome]                      [2 Enter e-mail]                 [3 Enter code]
 salOWN                           What's your e-mail?              We sent a 6-digit code
 Book and manage your             [ name@example.com     ]         to n***@example.com
 salon appointments               [ Send code ]                    [ _ _ _ _ _ _ ]
 [ Continue with e-mail ]         We'll only use it to sign        Code expires in 10 min
 Have an invite? Scan QR          you in.                          [ Resend in 0:45 ]

[4 Home]                                     [5 Booking detail]
 Next appointment                             Skin fade · Sam
 ┌───────────────────────────┐                Thu 27 Nov · 14:30 – 15:00
 │ Thu 27 Nov 14:30          │                Example Barbers   
 │ Skin fade · Sam          │                Paid: deposit £10 (refundable until Wed 06:30)
 │ Example Barbers           │                [ Reschedule ] (until Thu 12:30)
 └───────────────────────────┘                [ Cancel ]     (free until Wed 06:30)
 Book again                                   [ Add to calendar ] [ Directions ]
  [Skin fade · Sam →]  [Beard trim →]        [ Call ] [ WhatsApp ]
 My salons
  Example Barbers     · Membership active
  Second Salon        · 120 points

[6 Salon tab]                                [7 Membership]
 Example Barbers                              Gold Cut Club · renews 1 Dec
 [ Book ]  [ Call ] [ Directions ]            This month: 1 of 2 cuts left
 Membership: Gold Cut Club →                  Valid until 30 Nov
 Points: 340 (this salon only)                What's covered: Haircut, Beard trim
 Past visits ▸                                Questions? [ Contact salon ]

[8 Account]
 n***@example.com
 Notifications: Booking updates ✓ · Reminders ✓ · Offers ☐ (per salon)
 Linked salons ▸ (unlink)
 Sign out · Sign out on all devices
 Delete account  → explains: your salOWN login and links are removed;
                   salons keep their own visit records; how to ask a salon to erase them
```

Copy rules: always name the salon. Show deadlines as clock times. Never show balances added up across salons.

---

## G. Dependencies on current work and recommended order

| Dependency | Why it matters | Status (ROADMAP / memory, 18 Nov) |
|---|---|---|
| **STAFF-NATIVE-D1** | Same Apple Developer membership, the same Capacitor toolchain, privacy/support URLs (`/privacy`, `/support` 404 on 2026-11-10 per `ops/releases/staff-native-d1/URL_REQUIREMENTS.md`) | Source only, unsigned, waiting on Apple membership. **Do not share bundle id or push config.** |
| **ONB-GUIDED-SETUP W3a** | `tenantLifecycleActive` in main rules (not live) changes which tenants are "active"; customer callables must use the same tenant gate | Main candidate, not deployed; claim OPEN |
| **SALOWN-STRIPE-PLATFORM** | Refund on cancel and future membership purchase run on Connect; platform still sandbox-only | Closed 18 Nov (sandbox); live mode not set |
| **EMAIL-SENDER-SPLIT** | The OTP and customer mail sender must be salOWN-owned, not tenant Gmail | Investigation opened 18 Nov |
| **WHATSAPP-B7** | Optional customer channel | PUSHED_NOT_LIVE |
| **MEMBERSHIP-PHASE1** | Source of entitlement data for the read-only view | Live per memory index |
| Public-site copy (`apps.html`, `index.html`, `features.html`) | Promises a client app that doesn't exist | Needs a copy decision |

**Recommended order:**

0. **Security hardening (P0, independent of the app, small):**
   - local QR rendering and hiding the dead loyalty links (C6, C7);
   - rate limits + App Check on the token callables (C3);
   - remove the `BookingPage` `addDoc` fallback, then narrow the public booking create/update rules with emulator tests (C1, C2);
   - signed unsubscribe (C8).
1. **Principal separation:** account-type claim + `provisionTenant` / `askAI` / owner callables refuse customer principals (C5). This is a prerequisite for any customer login.
2. **Customer identity backend:** e-mail OTP callables, `customerAccounts` / `customerLinks`, invite issue/redeem (reusing `inviteCore`), deletion. Emulator-tested.
3. **Customer web portal** (`salown.com/me`, inside the public bundle or a new Vite entry): home, bookings, rebook, cancel/reschedule via authenticated callables, membership view. This makes the flow usable on web first, and is also the App Store web fallback.
4. **Customer native app** (separate Capacitor project/target, own bundle id, own Firebase iOS app):
   - push via a customer-scoped installation callable;
   - universal links: `salown.com/.well-known/apple-app-site-association` must be deployable (Hosting currently ignores dot-paths);
   - privacy manifest + labels;
   - in-app account deletion.
5. **Later:** contact requests, waiting list, discovery / marketplace.

---

## H. Mobile architecture notes

### H1. Options compared

| | Extend web portal (`/me`) | PWA | Separate Capacitor app |
|---|---|---|---|
| Reuse | Highest: same Vite public bundle, `src/firebase.ts`, booking utils | Same as web + manifest / SW | Same web code in a third Vite build (pattern: `vite.staff.config.js` `--mode native`) |
| Push | E-mail only (web push on iOS needs Home-Screen install) | iOS 16.4+ web push only if installed | Native APNs via FCM (`@capacitor-firebase/messaging`, as Staff) |
| Store presence | No | No | Yes; must be "more than a repackaged website" (4.2) |
| Risk | Lowest | Low | Review, signing, privacy manifests, release ops |

**Recommendation:** build the customer **API + web portal first** (H-order steps 1-3). Then ship a **separate Capacitor app** on the same code with native push, deep links, calendar and wallet-style booking cards.

### H2. Separation from the Staff app

- Distinct `appId` / bundle id, Firebase iOS app, APNs topic, associated domains and Vite build output (`native-build/customer-www`).
- No shared Auth persistence: different app sandboxes, so separation is natural on iOS.
- Server-side, staff and customer principals are separated by claim (C5).

### H3. Code that can be shared vs app-specific

- **Shareable:**
  - `packages/shared` (types only);
  - `src/utils/staffAvailability.ts` (`generateStaffSlots` `:239`, `getEffectiveStaffShift` `:144`);
  - `src/utils/bookingPrice.ts`, `bookingOptions.ts`, `bookingSettings.ts`, `availabilityWindow.ts`;
  - the time helpers in `src/utils/bookingCallables.ts:44-134`;
  - the BookingPage service / staff / slot steps (to be extracted into components).
- **App-specific:** auth screens, account / links, push installation, deep-link router, deletion flow.

### H4. Links

- **Paths into the app:** QR invite, e-mail manage link and booking link become universal links on `salown.com` (`/i/{invite}`, `/manage/...`, `/s/{tenant}`).
- **Fallback:** without the app installed, the same URL opens the web portal.
- **Requirements:**
  - AASA at `https://salown.com/.well-known/apple-app-site-association`, no redirect;
  - the live file is currently empty and its source is untraced (B table);
  - Apple's CDN caches the file, so allow about 24 hours for changes.

### H5. Token storage and logout

- **Token storage:** Firebase Auth persistence in WKWebView IndexedDB, as Staff does (`src/firebase.ts:42-49`), or Keychain via a native plugin. Decide in the build spec.
- **Logout:** sign out + delete the push installation server-side.

### H6. App Store rules relevant to this app (retrieved 18 Nov 2026)

- **5.1.1(v):** in-app account deletion is required.
  - A link to a web deletion page is allowed.
  - Deactivation alone is insufficient.
  - Don't require phone, e-mail or chat to delete.
  - Delayed deletion is OK if the timing is stated and confirmed.
- **4.8:** Sign in with Apple is not required if only our own sign-in is used (e-mail code). Adding Google or Facebook makes an equivalent privacy-preserving option mandatory.
- **3.1.3(e):** physical goods or services consumed outside the app **must** use non-IAP payment (Stripe / Apple Pay).
  - This covers appointments and deposits.
  - In-salon memberships and prepaid packages of in-person sessions are not named by Apple. Treating them as 3.1.3(e) is **inference**: get them reviewed before selling them in-app.
  - Anything unlocking in-app or digital features needs IAP (3.1.1).
  - Do not sell points or digital vouchers in-app.
- **4.2.6:** see E-OPEN-2.
- **4.5.4:** push must not be required to use the app. Marketing pushes need explicit in-app opt-in and opt-out.
- **5.1.1(i):** privacy policy link in App Store Connect and in the app. Privacy nutrition labels are required. Firebase SDKs need privacy manifests and signatures.
- **Sources:**
  - developer.apple.com/app-store/review/guidelines/
  - developer.apple.com/support/offering-account-deletion-in-your-app/
  - developer.apple.com/documentation/xcode/supporting-associated-domains
  - firebase.google.com/docs/auth/ios/email-link-auth
  - firebase.google.com/docs/auth/limits
  - cloud.google.com/identity-platform/pricing

### H7. Not ready for the App Store; needed first

- Apple Developer membership (shared with D1).
- New App ID + push capability, and a Firebase iOS app.
- Privacy policy and support URLs (currently 404).
- Privacy labels / manifest.
- In-app deletion.
- A deployable AASA.
- Demo account for App Review.
- Salon opt-in for the review tenant.

### H8. Competitor references (official help pages only)

- **Fresha:**
  - a client account is required to book online;
  - prepaid bookings can't be self-cancelled online;
  - chat only after booking, from the booking page.
- **Booksy:**
  - verified mobile number at registration (SMS code);
  - reschedule cancels and rebooks;
  - contact via a Call button.
- **Treatwell:**
  - My Bookings, with per-salon cancel / reschedule terms;
  - account "deactivate" flow.
- Multi-salon account behaviour was not documented by Fresha. Not inferred here.

---

## I. Evidence index (main = `ab671a7f` unless marked)

| Area | Location |
|---|---|
| QR generation / URL / third-party image | `src/pages/Clients.tsx:389-395, 1010-1027` |
| Dead loyalty link on public page | `src/pages/SalonSitePage.tsx:716-723` |
| Hosting rewrites (no `/loyalty`; `/manage/**`) | `firebase.json:57-77` |
| Whitecross loyalty page | `whitecross-site/loyalty.html:666, 692, 726-771, 796, 876-882, 1298-1312` |
| Clients / bookings / membership rules | main `firestore.rules:601, 696-737, 1071, 1342-1351, 1519-1521`; live ruleset `a5f92395…` lines 577, 104-137, 1043 |
| Manage-link lookup | `functions/src/bookings/shared.ts:20-31` |
| Token callables | `functions/src/index.ts:1435, 1820, 1889, 2060` |
| Booking id format / docId returned | `functions/src/bookings/createBooking.ts:1145-1147`; `functions/src/index.ts:1544-1550` |
| Client identity resolution | `functions/src/bookings/createBooking.ts:671-674, 1236`; `functions/src/clients/identity.ts:204-232` |
| Auth methods / claims | `src/pages/Login.tsx:214`; `src/staff/StaffApp.tsx:306`; `src/pages/Signup.tsx:231`; `functions/src/staff/identity.ts:308,332`; `src/auth/AuthContext.tsx:31-35` |
| Auth-only callables | `functions/src/index.ts:411-447` (`provisionTenant`); `functions/src/ai/askAI.ts:23`; `functions/src/onboarding/tenantCallableGate.ts:140-149` |
| Reusable invite / rate-limit | `functions/src/onboarding/inviteCore.ts:12-19,115,265-286`; `functions/src/onboarding/inviteRateLimit.ts:1-56` |
| Opt-out | `functions/src/index.ts:3568-3628` |
| Staff native config | `capacitor.config.ts` (`com.salown.staff`); `src/firebase.ts:42-49`; `src/staff/native/nativeStaffPush.ts` |
| Public "client app" promise | `hosting/apps.html:10,166-169`; `hosting/index.html:519-522`; `hosting/features.html:195` |
| Policy windows | `docs BUSINESS_RULES.md:17-21`; `functions/src/index.ts:1910-1914, 2082-2085` |

### Live measurements (2026-11-18, read-only)

- `GET salown.com/loyalty/x` → 404.
- `GET salown.com/manage/x` → 200 (SPA).
- `GET salown.com/.well-known/apple-app-site-association` → 200 `{"applinks":{"apps":[],"details":[]}}`.
- Live Admin entry `index-CIeQoMJK.js` contains `salownGetBookingByToken`, `salownCancelByToken`, `salownRescheduleByToken`, `salownCreateBooking` and `salownGetBusySlots`.
- `Clients-BawILY2F.js` contains `loyaltyToken`, `api.qrserver.com` and `salown.com/loyalty`.
- `whitecrossbarbers.com/loyalty.html` sha256 `e2b0eb85…56c5` = working copy.
- Firestore release `cloud.firestore` → ruleset `a5f92395-132a-4524-bf30-eb1bb9c78331`.

### Not done in this pass

- Live Functions revision describe.
- Emulator tests for C1/C2.
- No production document was read.

---

## J. Proposed follow-up scopes (each needs separate owner approval)

1. **CUSTAPP-P0-HARDEN:**
   - C6 + C7: local QR, hide or redirect dead links;
   - C3: rate limits / App Check on the token callables;
   - C1 / C2: emulator cases, then rule narrowing after the `addDoc` fallback is removed;
   - C8: signed unsubscribe.
   - Code + emulator only, then a normal gated release.
2. **CUSTAPP-PRINCIPAL-SPLIT:** C5.
3. **CUSTAPP-IDENTITY-SPEC:** a written spec for D1–D3 with an emulator test plan. No provider or secret chosen until approved.
4. **CUSTAPP-WEB-PORTAL v1:** steps H-order 3.
5. **CUSTAPP-NATIVE:** after D1's Apple prerequisites and E-OPEN-2/3.
6. **Docs push:** this file to `salown-docs` + a ROADMAP row. Not pushed by this session.
