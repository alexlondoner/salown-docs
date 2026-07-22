# INCIDENTS.md

Past incidents and the lessons learned from them. Every entry: what happened, why, how it was fixed.

> **LOOK HERE FIRST:** When a problem occurs (email not sending, booking not landing, blank page, etc.), before starting the diagnosis, search this file for whether a similar incident has been reported — the root cause and diagnostic method are probably written here.

---

## 📋 Record standard (new incidents fill in this template)

Every incident opens with `## YYYY-MM-DD — short title`, immediately followed by the **metadata line**, then the fixed fields + **Lessons Learned**. **This field set is not broken** (2026-07-18 owner decision) — consistency means institutional memory; every incident fills in the same fields. If information is missing, write "yok"/"—", do not skip the field.

```
## 2026-XX-XX — short title

**Severity:** 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low · **Owner:** <who> · **Status:** ✅ Resolved / 🟡 Open / 🔴 Regressed · **Affected area:** <module/flow — e.g. checkout, delete, dashboard>

**Discovery:** who/how found the bug — owner test / customer report / regression test / during refactor / monitoring (years later "what catches the bugs" = quality metric)
**Impact:** what the user/business experienced (one sentence)
**Root Cause:** the actual cause — "write not the bug but the WHY" (e.g. "create works, blows up on update because of permission")
**Bug Class:** one-line classification — Permission mismatch / State normalization (SSOT violation) / Race condition / Legacy compatibility / Timezone / Firestore transaction / … (counted years later, the architecture's weak points emerge)
**Resolution:** what was done + deploy status
**Prevention:** how we prevent recurrence (permanent rule / guard)
**Regression Tests:** which test pinned the bug (file::name) — otherwise "yok (why)"
**Related:** commits <hash / uncommitted> · roadmap <ID/theme> · files <paths>

**What happened / Diagnosis / Fix:** (free-form, long narrative)

**Lessons Learned:**
- ...
- ...
```

**Severity legend:** 🔴 Critical (live outage / data-money / security) · 🟠 High (feature broken, workaround exists) · 🟡 Medium (wrong display / partial) · 🟢 Low (single screen / cosmetic).

**Tag dictionary (CANONICAL — only these; sprawl forbidden):** `#security` `#stripe` `#secrets` `#config` `#deploy` `#normalization` `#permission` `#race` `#timezone` `#parser` `#email` `#data-loss` `#shared-infra`. A new tag is added only if a genuinely new class emerges (e.g. twins like `#payment`+`#payments`+`#stripe-payment` are FORBIDDEN → all `#stripe`). Every entry carries a `**Tags:**` line.

## 2026-07-22 — Website booking add-on double-counted at checkout → overcharge + inflated loyalty points

**Severity:** 🔴 Critical (data-money — customer overcharged + loyalty over-credited, shipped live) · **Owner:** owner (spotted the wrong checkout total on a real booking) + Claude · **Status:** ✅ Resolved & DEPLOYED 2026-07-23 (`7d6eb25`; frontend hosting:salown + Ram record repaired) · **Affected area:** checkout total + loyalty earn (CheckoutPanel.tsx, firestoreActions.checkoutBooking)

**Tags:** `#normalization` `#data-loss`

**Discovery:** owner — checking out Ram Hillel's website booking (Classic Short Back & Side £28 + Nose Wax £6), the checkout subtotal showed £40 (should be £34), charge £30 (should be £24 remaining), points +80 (should be +68).
**Impact:** any online (website/salown) booking created WITH an add-on was charged the add-on twice at checkout and earned double-counted loyalty points; the client's balance was over-credited (Ram: 80 pts stored + client balance +12 too high). Walk-ins unaffected.
**Root Cause:** TWO price conventions for `booking.price` that were never reconciled: **walk-ins** store `price` = BASE service only (add-ons summed separately at checkout), but **online self-bookings** store `price` = GRAND TOTAL (base + add-ons folded in). CheckoutPanel took `basePrice = booking.price` (£34, already incl. £6 wax) then re-added `addOnsTotal` from `booking.soldAddOns` (£6 again) → £40. The backend `checkoutBooking` repeated the same on the loyalty earn base (`fullPrice=price + addOnTotal` → 40 → ×2 = 80). Display (frontend earnBase, later fixed) diverged from the stored value → owner saw 68 on screen but Firestore had 80.
**Bug Class:** State/convention normalization (SSOT violation) — one field (`booking.price`) carries two different meanings depending on creation path; no `servicePrice` field exists to disambiguate.
**Resolution:** strip folded add-ons for the online case only: `priceIncludesAddOns = bookedAddOnTotal>0 && status!=='CHECKED_OUT' && source∈{website,salown}` → `basePrice = price − bookedAddOnTotal`. Applied identically in CheckoutPanel (charge) and firestoreActions.checkoutBooking (loyalty earn base). Walk-ins and edit-mode re-checkouts untouched (no regression). Ram's live record repaired via drift-guarded transaction (booking loyaltyPointsEarned 80→68 / total 96, client loyaltyPoints 108→96; `totalSpent` was already correct — it uses `total+depositPaid`, not the inflated earnBase).
**Prevention:** **INVARIANT** — `booking.price` semantics differ by source: walk-in = base service, online (website/salown) = base+add-ons folded in. Any code that adds `soldAddOns` on top of `booking.price` MUST first strip the folded add-ons for online sources (guard on source + not-checked-out). Longer term: introduce an explicit `servicePrice` (base) field at write time so downstream never has to infer. Staff-app `CheckoutSheet` does NOT read `soldAddOns` → no double-count there, but also doesn't preserve/net website deposit+add-on bookings (separate limitation, flagged).
**Regression Tests:** yok (frontend money path; verified via 5-scenario simulation pre-deploy: Ram web 28/34/24, Paul walk-in 36 unchanged, web CHECKED_OUT no-regress, plain no-addon, web full — all pass. Convert to a real vitest case next session).
**Related:** commit `7d6eb25` · files `src/components/CheckoutPanel.tsx` (~687) + `src/firestoreActions.ts` (`checkoutBooking` ~46) · edit-log-salown 2026-07-22/23 · same root also fed the confirmation-email breakdown work (emailTemplates.ts).

**What happened / Diagnosis / Fix:** Owner opened checkout on a real website booking and the total looked £6 high. Traced to CheckoutPanel `basePrice = booking.price` double-adding the stored `soldAddOns`. Firestore data proved the two conventions (Ram website price=34 incl. wax; Paul walk-in price=28 base + Ear Wax £8 paid=36). Because `booking.service` is undefined on website bookings (id lives in `serviceId`), the service catalog can't be resolved in CheckoutPanel → used the source convention (matching the confirmation trigger's `isOnlineSelfBooking`) rather than a catalog price match. Backend loyalty (`checkoutBooking`) had the identical double-count on the earn base; fixed the same way. Ram's already-checked-out record was repaired with a transaction + drift guards.

**Lessons Learned:**
- One field, two meanings = a normalization landmine. `booking.price` meaning "base" for walk-ins and "total" for online bookings guarantees a double-count somewhere. Prefer an explicit base field over source-inferred stripping.
- Display and persistence computed the earn separately (frontend earnBase vs backend `fullPrice`) → the screen showed the right number (68) while Firestore stored the wrong one (80). When money/points show on screen, verify the STORED value too, not just the UI.
- Money fixes need the whole chain: charge (CheckoutPanel) + earn (firestoreActions) + any email that prints the figure. Fixing one surface leaves the others lying.

## 2026-07-21 — TEST key in the live Stripe slot → real customers dropped into test checkout, could not pay

**Severity:** 🔴 Critical (live payment outage / revenue loss — real customers could not pay) · **Owner:** owner (insisted on intuition, saying "these guys can't use a test link") + Claude · **Status:** ✅ Resolved & DEPLOYED 2026-07-21 (STRIPE_SECRET_KEY v5=sk_live, 4 payment fn redeployed, verified with live booking cs_live+CONFIRMED) · **Affected area:** whitecross-site payments / Stripe secret config (`createCheckoutSession`)
**Tags:** `#security` `#stripe` `#secrets` `#config` `#deploy` `#shared-infra`  *(the tag taxonomy started 2026-07-21 on the owner's suggestion — for incident search at scale; retroactive tagging is not on the ROADMAP; going forward every new entry carries a Tags line)*

**Discovery:** Owner — today 2 bookings showed as CANCELLED in the salOWN panel, but the "why not payment" diagnosis said **PAID**; when the owner insisted "Taylor+Jack are real/loyal customers, they can't find and enter the `?testMode=1` link", the link theory was eliminated → the Stripe key on the server was examined.
**Impact:** On the morning of 07-21, real customers (Taylor 2 attempts, Jack 1) booking from the normal site (NO testMode) dropped into **test Stripe checkout** → they could not pay with a real card → stayed PENDING → `salownCleanupExpiredPending` turned them `expired_pending` → CANCELLED within 15 min. No real money was taken but **2 real customers + lost appointments** (owner recovered with a manual rebook + apology message). Confirmed email did not go out (it was never CONFIRMED).
**Root Cause:** The **latest version (v4) of the `STRIPE_SECRET_KEY`** secret (LIVE slot) was a **TEST key** (`sk_test_51TB…`). In the non-testMode branch, `createCheckoutSession` uses `STRIPE_SECRET_KEY` for `chargeGBP` (`functions/index.js:175`) → because the value was test, Stripe produced a **cs_test** session (a real card is rejected). ⚠️ **THE ACTUAL ROOT CAUSE — SHARED SECRET COLLISION (transcript-proven):** `STRIPE_SECRET_KEY` is a secret name **SHARED between salOWN + Whitecross functions in the same Firebase project (havuz-44f70)**. On **2026-07-04 00:44 UTC**, a Claude session doing the **salOWN Stripe Connect setup** (`ba29869e`, at owner's direction) ran this command **from the `salown-app` directory**: `printf 'sk_test_51TBv2…' | firebase functions:secrets:set STRIPE_SECRET_KEY --force`. The intent was to test salOWN Connect (salOWN sandbox = "Turquoise" account, `sk_test_51TB…`); but because of the shared secret name it **also overwrote Whitecross's live payment key.** (Whitecross's real account is `51T3CrpR` — both live+test were correct; the problem was the foreign Turquoise `51TB` key overwriting the live slot.) **Why it stayed hidden for 17 days:** the whitecross functions were not redeployed between 07-04→07-21 → they stayed on the old live binding (Elie's 07-19 cs_live worked). ⚠️ the testMode CODE is much older (05-07 `f92ac1b8`) but the secret collision is 07-04. ⚠️ **Timing evidence (owner correction):** the testMode CODE was added on 05-07 (`f92ac1b8`/`017842e2`) but the secret error is NOT that old — the webhook logs have uninterrupted real `cs_live` bookings (07-08/09/10/13/17/18 + Elie 07-19 cs_live), i.e. live payment was working until 07-19. Because the functions were not deployed after v4 was written, it **stayed dormant**; when **Claude's 07-21 email-extras `functions:whitecross` deploy** rebound the secret to "latest = v4", live checkout silently reverted to test (the first real-customer cs_test = Jack 07-21 07:39). (v2 was also a broken "mk_…" value — the slot history is dirty.)
**Bug Class:** Secret/credential misconfiguration — a test key written to the wrong slot + **deploy-time secret rebind** (an unrelated redeploy activated the dormant faulty version as "latest").
**Resolution:** A new version (v5) of `STRIPE_SECRET_KEY` was written with the real `sk_live` value from v3 (`access @3 | set --data-file -`, newline preserved). 4 payment fn redeployed: `createCheckoutSession`, `stripeWebhook`, `checkBookingPayment`, `createMobileCheckout` (targeted `functions:whitecross:…`). Verification: the owner's real booking at 11:32 → **cs_live + CONFIRMED + DEPOSIT_PAID** (the last cs_test at 11:19 was an attempt a minute before the fix propagated, it expired). Owner sent Taylor+Jack a manual booking + apology message.
**Prevention:** (1) 🔑 **MOST IMPORTANT — Whitecross and salOWN MUST NOT SHARE the same `STRIPE_SECRET_KEY` secret.** Whitecross must use its own separately named secret (e.g. `WC_STRIPE_SECRET_KEY`) + `createCheckoutSession`/`stripeWebhook`/`checkBookingPayment`/`createMobileCheckout` must read it. That way salOWN Stripe (Connect/sandbox) work can never again overwrite whitecross live payment. A shared secret name = a standalone root risk. (2) **Post-deploy smoke check:** when the payment fns are deployed, confirm that a booking's session gets the `cs_live` prefix (this single check would have caught the whole chain). (3) NEVER write a test/sandbox key to the live secret slot; a guard/script that refuses to write an `sk_test`-prefixed value to the live slot. (4) ✅ The broken v4 (Turquoise test) version was **DESTROYED** (2026-07-21). (5) v4's exact createTime = transcript evidence **2026-07-04 00:44 UTC** (session `ba29869e`); can also be verified via Cloud Console → Secret Manager → Versions.
**Regression Tests:** yok (a secret-config error is not caught by a code test) → instead a **post-deploy cs_live smoke verification** should become a permanent step.
**Related:** **writing session `ba29869e` (2026-07-04 00:44 UTC, salOWN Connect setup, salown-app)** · trigger = this session's (`2357c819`) `functions:whitecross` email-extras deploy (2026-07-21) · commits `f92ac1b8`+`017842e2` (test mode support CODE, 2026-05-07 — unrelated to the secret error) · secret `STRIPE_SECRET_KEY` v4(Turquoise test, DESTROYED)→v5(sk_live fix) · files `functions/index.js` (`createCheckoutSession` key selection L173-177)

**What happened / Diagnosis / Fix:** The owner saw that today's 2 bookings were CANCELLED but "why not payment" said PAID. Initial theories: (a) expired_pending abandon (INCIDENTS 2026-07-12 pattern), (b) a circulating `?testMode=1` link. Firestore query: all 4 of today's bookings had a `cs_test` session; the live site does not drop into test on its own + there is no leaked test link in public → the link theory was eliminated. When the owner said "Taylor+Jack are real customers, they can't enter a test link", focus shifted to the server. `firebase functions:secrets:access STRIPE_SECRET_KEY` → `sk_test_51TB…` = **a test key in the live slot.** Version dump: v1/v3 sk_live, v4 sk_test (active), v2 broken. Timing: Elie 07-19 cs_live → v4 was activated afterwards; the first real-customer cs_test = Jack 07-21 07:39 → Claude's 07-21 deploy was the trigger. Fix: v3's sk_live was restored as v5 + 4 fn redeployed. Verification: 11:32 booking cs_live+CONFIRMED+DEPOSIT_PAID. **Forensics (when the owner said "there's no evidence"):** zsh history was empty; the Claude session transcripts (`~/.claude/projects/`) were scanned → the command `printf 'sk_test_51TBv2…' | firebase functions:secrets:set STRIPE_SECRET_KEY --force` ran in **session `ba29869e`, 2026-07-04 00:44 UTC**, from **salown-app**, during the **salOWN Stripe Connect setup**. The shared secret name overwrote Whitecross's live key.

**Lessons Learned:**
- **🏛️ INSTITUTIONAL PRINCIPLE (the real legacy of this incident):** *Secrets belong to the **application boundary**, not the tenant boundary. No secret name should be shared by two different applications.* ❌ `STRIPE_SECRET_KEY` (shared) → ✅ `WC_STRIPE_SECRET_KEY` / `SALOWN_STRIPE_SECRET_KEY` / `ADMIN_STRIPE_SECRET_KEY`; the same for `BREVO_API_KEY`→`SALOWN_BREVO_API_KEY`, and for Telegram/OpenAI/Google OAuth. This incident should go into history not as a "Stripe bug" but as a **shared-infrastructure naming problem**. → ROADMAP P0 "Namespace all shared secrets before tenant #4". (salOWN TENANTS already hold no secrets — the Connect model stores only `acct_`; the problem is at the app boundary.)
- **Secrets are bound to "latest" at deploy time:** a faulty secret version is activated not by the operation that wrote it, but by **the next unrelated redeploy**. A deploy rebinds the secret even if the code has not changed → the assumption "nothing changed after the deploy" is wrong.
- **A single `cs_live` confirmation after a payment deploy** catches this kind of silent credential error immediately — make it a permanent smoke step.
- **The owner's domain intuition guided the diagnosis:** the statement "this customer can't do this" eliminated the wrong theory (link); take the user's domain knowledge seriously.
- **Misleading diagnosis:** "why not payment → paid" saw the test-card payment in test Stripe and said PAID; saying "paid" when there is no real money misdirected the initial diagnosis — a diagnostic tool must clearly show which environment it is looking at (live vs test).
- **The test/live credential separation must be strict:** the mere ability to write a test value to the live slot is a standalone risk; guards/name discipline are mandatory.
- **🔑 A shared secret name is a landmine in multi-app:** when salOWN and Whitecross shared `STRIPE_SECRET_KEY` in the same project (`havuz-44f70`), one app's Stripe test silently overwrote the other's live payment. Secret names for different apps/tenants must be SEPARATE (namespace: `WC_…` / `SALOWN_…`).
- **Forensics = session transcripts:** a credential change that looks like "there's no evidence" can be found in `~/.claude/projects/*.jsonl` with the exact command + timestamp + from which directory + as which task. When there is no Cloud audit log access, this is the first stop.

## 2026-07-18 — Inbound parse: manually forwarded emails "UNKNOWN_SOURCE" — never parsed at all

**Severity:** 🟠 High (feature broken: with manual forward no booking/reschedule/cancel gets in; it drops silently) · **Owner:** owner (found the root cause on intuition) + Claude · **Status:** ✅ Resolved & DEPLOYED 2026-07-18 (`functions:salown:salownInboundEmail` europe-west2, targeted; `tsc` clean + 7 regression tests + full suite 53/0) · **Affected area:** inbound email routing (`salownInboundEmail` → `parseInbox` → dispatch) / platform source-detection

**Discovery:** Owner — during an end-to-end recreation of natasha Gilbert's Treatwell booking + a reschedule chain test; the emails she forwarded did not turn into bookings. The owner guessed the root cause himself ("it's not doing it because it's not coming from noreply"). Inspecting `parseInbox` showed all 3 emails as `UNKNOWN_SOURCE`.
**Impact:** When the salon manually **"Fwd:"** a Booksy/Fresha/Treatwell notification to the parse address, the email is never parsed — the booking does not land, the reschedule is not applied, and no error shows either (it stays silently stuck as `UNKNOWN_SOURCE` in `parseInbox`). Only Gmail **filter auto-forward** (via Brevo, original `From` preserved) was working.
**Root Cause:** The source (booksy/fresha/treatwell) was detected **only from the sender**: `String(msg.from || msg.raw)` → when `msg.from` was populated it never fell through to `msg.raw`. On a manual forward the `from` is no longer `noreply@treatwell.co.uk` but **the forwarding salon's Gmail** → `/treatwell/` does not match → `source='unknown'` → the dispatch trigger writes `UNKNOWN_SOURCE` and gives up. So "the real provider email works, the forward blows up" — because the signal is lost in `from`.
**Bug Class:** Source/identity detection — dependence on a single signal (sender); when the forward changes the sender identity, detection collapses (loss of State/identity provenance). Sibling pattern: parser barber-name matching, client identity lookup.
**Resolution:** Extracted into the pure function `_detectInboundSource(msg)`: **first `from`** (existing priority + behavior preserved EXACTLY — the real provider email is not affected at all), and if unrecognized, **fall through to `subject` + `raw` body** (on a forward the original `From: noreply@treatwell...` and brand name remain in the body). Because priority stays on `from`, a brand name that appears in the body never misclassifies a real email.
**Prevention:** (1) Source detection via a `from → subject/raw` fallback chain, not a single signal. (2) A regression test pinned the bug: manual-forward (from=forwarder) → 'treatwell'; priority guard (from=booksy, even if 'treatwell' appears in the body → 'booksy'); junk → 'unknown'. (3) **Note:** natasha's original booking was re-imported NOT via forward, but after the tombstone was deleted, by the scheduled IMAP scan from the `noreply@treatwell` email in the real inbox — a diagnostic clue showing that the two pipes (IMAP cron + inbound webhook) behave separately.
**Regression Tests:** `functions/src/inbound/source-detect.test.js` (7 tests — genuine-from, manual-forward-subject/body, body-only, priority guard, unknown, empty-no-throw); full functions suite 53 pass / 0 fail.
**Related:** commits <uncommitted (awaiting owner approval)> · roadmap <parser/inbound> · files `functions/src/inbound/index.ts` (`_detectInboundSource` + export) · `functions/src/inbound/source-detect.test.js`

**What happened / Diagnosis / Fix:** In the natasha test the forwards did not land. Looking at `parseInbox` with the admin SDK, all 3 docs came out `source:"unknown"`/`UNKNOWN_SOURCE` (2× natasha new-booking dup + 1× **Chloé Lopez** reschedule — the stuck reschedule was actually not natasha's). At `inbound/index.ts:127` it was seen that the `String(msg.from || msg.raw)` fallback only kicks in when `from` is empty; on a manual forward `from` is populated so raw was never read. The fix reduced it to a `from`-priority + subject/raw fallback pure function, and it was tested.

**Lessons Learned:**
- **Identity/source detection must not hang on a single signal:** a forward changes the sender address; if the signal is lost, the feature collapses silently. Graded fallback like `from → subject → body` + priority protection is the right pattern.
- **A silent `UNKNOWN_SOURCE` is not an alarm:** while the user says "it didn't work" the system does not even error. The first stop in diagnosis is the raw stage table (`parseInbox`) — seeing the state there, the root cause emerged in 2 minutes.
- **Two pipes = two behaviors:** the IMAP cron receives the same email correctly (from=noreply), the inbound webhook misclassifies it on a forward. When one pipe works while the other blows up, look at exactly where they diverge.
- The owner's "it's not coming from noreply" intuition was directly the root cause — take field intuition seriously.

## 2026-07-18 — Checkout: extra service (child) "merges" into the main service / disappears

**Severity:** 🟠 High (data loss on multi-service bookings: the extra-service line drops, its price stays on the parent; money/record impact) · **Owner:** owner (caught it) + Claude · **Status:** ✅ Resolved (LOCAL; typecheck+lint+7 regression tests passed; verified on live dev Alex+Ladies-Haircut £40 preserved; deploy awaiting owner approval) · **Affected area:** checkout (Save unpaid + Complete Checkout) / soldAddOns persist

**Discovery:** Owner — noticed while checking out / "Save unpaid" on a multi-service booking at HeroHairs (while testing the new inline "Extra services" work).
**Impact:** When an extra service (a full service like Beard/Facial) is added to a booking and then **checked out** or saved via **"Save unpaid"** (on account), the extra service(s) would **disappear**; because the total price stayed at the parent service's price, the extra service **looked as if it had "merged" into the main service** (e.g. HeroHairs "Highlights & Toner & Blowdry — …" £330 single-service, ADD-ONS empty; the original for Alex Perry was "Men Highlights", the old flow had shifted it to Wash & Blow Dry).
**Root Cause:** The checkout pipe **filters extra services against the "Extras" catalog** + normalizes them with `normalizeSoldProducts` and **drops the serviceId + duration.** `CheckoutPanel.tsx` init (`localExtras = soldAddOns.filter(extrasList.find(...))`) → full-service add-ons not in the "Extras" category were eliminated as the panel opened; `ProductSelector.setQty` re-normalized the list on every stepper touch and dropped them again; the write in `saveUnpaidBooking` + `checkoutBooking` also normalized without duration/serviceId. Three layers made the same mistake because **the draft "Save unpaid" and "Complete Checkout" normalized the extra service SEPARATELY** (there was no single source of truth).
**Bug Class:** State normalization — Single Source of Truth violation (3 paths normalized the same data separately) + wrong-normalize (`normalizeSoldProducts` applied to an add-on → dropping duration/serviceId).
**Resolution:** A single source of truth `normalizeSoldAddOns` (`bookingUtils.ts`) — preserves serviceId+duration+qty, NO catalog filter, missing qty→1 / explicit 0→dropped. Every path now goes through it: CheckoutPanel init (filter removed), ProductSelector.setQty (works on the raw value, untouched/off-catalog item + duration preserved), `saveUnpaidBooking`, `checkoutBooking`, `createWalkIn`, BookingDetailPanel (local `normAddOns` deleted, imported). The Products (retail) filter was not touched (the report was about an add-on). **Regression test:** `src/utils/soldAddOns.test.ts` (7 tests) — Haircut+Beard+Facial scenario: add-ons don't drop, serviceId+duration preserved, qty defaults, junk-input.
**Prevention:** (1) `normalizeSoldAddOns` is the single source — EVERY path that persists an extra service must use it, NEVER `normalizeSoldProducts` (it drops duration/serviceId) or a local second normalize. (2) A regression test pinned the bug (`npm test`). (3) **Architectural direction:** "Save unpaid" and "Complete Checkout" should go through a single `buildCheckoutPayload` (service/add-on/product/payment prepared in one place, draft/final split only at the last step) → to ROADMAP. As long as two separate flows prepare the same payload separately, this class of bug will recur.
**Regression Tests:** `src/utils/soldAddOns.test.ts` (7 tests — Haircut+Beard+Facial: don't drop, serviceId+duration preserved, qty defaults, junk); full suite 66/66.
**Related:** commits <uncommitted (awaiting owner approval)> · roadmap <Monetization/checkout — `buildCheckoutPayload` unification> · files `bookingUtils.ts` (normalizeSoldAddOns) · `CheckoutPanel.tsx` · `firestoreActions.ts` (saveUnpaidBooking/checkoutBooking/createWalkIn) · `BookingDetailPanel.tsx` · `soldAddOns.test.ts`

**What happened / Diagnosis / Fix:** The owner noticed while testing: a booking with an extra service loses the extra after checkout/save-unpaid, the name doubles and the price inflates ("merge"). The audit log (Alex Perry) confirmed the root cause: the original "Men Highlights (Short Hair variation)" → on 10 July it had shifted to Wash & Blow Dry via the OLD BookingForm "Edit" popup's "if it doesn't match, default to config.services[0]" bug (that form was separately removed from the panel). The actual checkout-merge bug, however, was in the `CheckoutPanel` init filter + the 3-layer normalize. The fix reduced it to a single source of truth.

**Lessons Learned:**
- If there is **more than one path** persisting the same data (soldAddOns) (draft-save + checkout + walk-in create), ALWAYS route it through a single normalize function — otherwise one fixes it and another drops it.
- `normalizeSoldProducts` MUST NOT BE APPLIED to add-ons: it's designed for retail products (qty matters, no duration); an extra service carries serviceId+duration. Wrong normalize = silent data loss.
- The "catalog filter" must not be confused with the persist list: the filter is for DISPLAY; **the save list must never be trimmed based on catalog matching** (otherwise off-catalog items are deleted).
- The owner's reflex was right: "don't just fix it, write a regression test" — this class (multi-flow payload) is exactly the place that needs testing.

## 2026-07-18 — Owner can't delete a walk-in: "insufficient permissions" (delete tombstone write blocked)

**Severity:** 🟡 Medium (function broken — the owner gets stuck on a second delete in the same slot; no data loss) · **Owner:** owner (caught it) + Claude · **Status:** ✅ Resolved (LOCAL frontend fix; typecheck+lint clean; verified on live dev — owner deleted it; a hard-refresh suffices, no deploy needed) · **Affected area:** delete (deleteBooking / parserTombstones)

**Discovery:** Owner — while trying to delete a walk-in at HeroHairs (while preparing for the unpaid-checkout regression test).
**Impact:** When the HeroHairs OWNER tried to delete a walk-in, he got "insufficient permissions"; the booking would not delete. The first delete worked, the second delete in the same slot blew up (the owner said "but normally I do have delete permission" — correct).
**Root Cause:** `deleteBooking` (`firestoreActions.ts`), for a walk-in, writes a `parserTombstones/SLOT-{source}-{date}-{time}` `setDoc` BEFORE `deleteDoc` for re-import protection. The `parserTombstones` rules (`firestore.rules:159-161`): create=tenant-member (owner ✅) BUT **update=super-admin-only.** `setDoc` is a create if the doc doesn't exist, and an update if it DOES → if a tombstone remains from a previous delete in the same slot, `setDoc`=UPDATE → owner denied → the error is thrown before `deleteDoc`, so the delete never happens. Unrelated to UNPAID/status.
**Bug Class:** Permission mismatch — create-vs-update rule difference + `setDoc` (create-or-update) ambiguity; also a side-effect-write blocked the actual operation (best-effort violation).
**Resolution:** The two tombstone `setDoc` calls were made best-effort with `try/catch` — a tombstone write (re-import protection) must NEVER block the delete; if the tombstone already exists there's no need to rewrite it, and if it doesn't the create is already open to the owner. Frontend fix, no functions/rules deploy needed.
**Prevention:** A "side-effect write" (tombstone/audit/projection) must not block the actual operation (delete) → best-effort/try-catch. Still open (separate, needs rules deploy + a security decision): open `parserTombstones` update to `isTenantAny(tenantId)` (so the owner can update a tombstone in their own tenant).
**Regression Tests:** yok — not a pure-function (Firestore rules + setDoc interaction); the guard is in code via try/catch. Future: emulator integration test.
**Related:** commits <uncommitted (awaiting owner approval)> · roadmap <SECURITY — parserTombstones update rule> · files `firestoreActions.ts` (deleteBooking) · `firestore.rules:159-161` (parserTombstones)

**Lessons Learned:**
- The "works the first time, 'permission' error the second time" pattern → almost always a create-vs-update rule difference + `setDoc` (create-or-update) usage.
- Helper writes done BEFORE the actual operation (tombstone, audit), if they throw, mean the actual operation never happens — do these with try/catch or AFTER the operation.

## 2026-07-14 — Dashboard week view "screen shaking" — an infinite ping-pong render loop of two useEffects

**Severity:** 🟡 Medium (week view unusable; day/month unaffected, no data impact) · **Owner:** Claude + owner · **Status:** ✅ Resolved (`82490c1` PUSHED→CI deploy; owner tested on live, the shaking stopped)

**Impact:** In the panel Dashboard, switching to week view caused the screen to shake continuously (shaking/flicker) — the component re-rendered every frame; week view was effectively unusable.
**Root Cause:** Two useEffects triggered each other in an infinite loop. Effect A (`Dashboard.tsx:324`, with NO view check): if the selected barber does not work on the `selectedDate` day (workingDays/dayHours.closed), `setBarberFilter('all')`. Effect B (`:335`, only week view): if the filter is `'all'`, `setBarberFilter(barbers[0].id)`. If `barbers[0]` is off/closed that day, A↔B ping-pong = infinite re-render.
**Resolution:** A `if (view === 'week') return;` guard added to Effect A + `view` added to deps (`82490c1`, +4/-1 single file). Rationale: week view shows 7 days — a single-day "not working today" reset is meaningless there, the barber may work on other days of the week. Build 0 errors; owner confirmed on live.
**Prevention:** When adding two useEffects that write the same state, the intersection of their conditions must be checked — if one undoes the value the other wrote, a loop is guaranteed. If you see the "screen shaking" symptom, the first suspect is a ping-pong of useEffect pairs with setState (React DevTools confirms via an explosion in the render count).

**What happened / Diagnosis:** The symptom was only in week view → the week-specific state logic was grepped. Two effects writing `barberFilter` were found: A day-based reset (view-less), B week-view mandatory-single-barber. The conditions clash: A pulls to `'all'`, B pulls back to barbers[0]; on days barbers[0] is off, an unclosing loop. Definitive diagnosis by reading the code, no live repro needed.

**Lessons Learned:**
- If two useEffects write the same state in opposite directions, an infinite loop can be set up via deps — when adding a new effect, check its condition intersection with the OTHER effects that write that state.
- For symptoms like "only happens in view X", effects conditional on that view are the first place to look; when half the loop is conditional the bug appears only in that view.
- Day-based business rules (working days reset) should be asked "is this meaningful in this view" before being applied in multi-day views (week/month).

## 2026-07-14 — Two consecutive walk-ins overlapped in Calendar Day-view — the card min-height floor was missing in computeColumns

**Severity:** 🟡 Medium (wrong display; no data/money impact) · **Owner:** Claude + owner · **Status:** ✅ Resolved (`5b1c67f` PUSHED→CI; owner verified on live — consecutive walk-ins now split into side-by-side columns) · **Related:** [[INC 2026-06-27 checked-out cascade]]

**Impact:** The owner saw two walk-ins on Arda's day (6:15 + 6:35, both Classic Short Back & Side) overlap instead of splitting into side-by-side columns — the 6:15 card sat on top of the 6:35 card.
**Root Cause:** The render draws each card at a **min 30 min** height via `Math.max(duration*slotHeight/15 − 4, slotHeight*2)`; `computeColumns` did NOT SEE this floor. Arda checked out his 6:15 walk-in early → `actualDuration` shortened (min(scheduled, actual)) → the column engine considered the card to end at ~6:30-6:35 and said it "doesn't clash" with the next one (same column, full width), but the card visually snapped to the 30 min floor and drew to 6:45 → it physically swallowed the 6:35 card below = silent visual overlap.
**Resolution:** `end = Math.max(end, start + 30)` in `computeColumns` — the render's 30 min floor was added to the column math too; now a short card is also counted as 30 min and the clash is detected → it splits into side-by-side columns (`TimeGrid.tsx` +8/−0). Main build 0 errors. Squeeze-in was not touched (gap bands come from `getBusyIntervals`, don't see `actualDuration`/floor).
**Prevention:** EVERY transformation affecting card geometry (top cap `min(scheduled,actual)` AND bottom floor `max(.., 30min)`) must be applied identically in both the render and `computeColumns`. The 2026-06-27 lesson was "the same duration source"; the missing half = the min floor. The column engine must see the "effective drawn height", not the raw duration.

**What happened / Diagnosis / Fix:** The owner shared a screenshot: two consecutive walk-ins overlapping. Per Rule #7, INCIDENTS was read first → 2026-06-27 "checked-out cascade" came up as directly related (at that time `actualDuration` was LENGTHENING the card, the fix was `min(scheduled, actual)`; its lesson was "card height must use the same duration source as computeColumns"). The code was read: the `TimeGrid.tsx` render (`:374`) applies `Math.max(.., slotHeight*2)` = a 30 min hard floor; `computeColumns` (`:159`) does not → an early-checkout-shortened card diverges between the two calculations. A neighboring bug of the same class: the cap was aligned, the floor was not. A single-line clamp re-aligned the two calculations.

**Lessons Learned:**
- **If an "effective height" clamp (min OR max) entered the render, the same must enter the overlap/column engine.** On 2026-06-27 the max cap was aligned but the min floor was forgotten — a half-alignment produced the same "invisible overlap" result from the other end.
- **"Two appointments overlapping, didn't split" complaint = computeColumns thinks they don't clash.** First suspect: one of the cards' REAL duration is shorter than its drawn height (early checkout / min floor), i.e. the column calculation and the visual diverged.
- Card geometry derivations (`duration → height`) should be collected in a single helper so render + computeColumns call the same function; a formula copied by hand into two places diverges eventually (this is the third divergence).

## 2026-07-14 — whitecross-site: a barber on leave kept showing in the booking list (leave-hide, the `active !== false` guard returned early)

**Severity:** 🟡 Medium (wrong display; the booking slots are already blocked correctly, no data/money impact) · **Owner:** Claude + owner · **Status:** ✅ Resolved (`cddf0d02` first fix → `f2ba207f` date-aware correction; both deployed to live via `firebase.saas.json`; whitecrossbarbers-saas) · **Related:** G5 leave semantics unification

**Impact:** Muhamed went on holiday (`status:'leave'`), and on the premium site (whitecrossbarbers.com) **his name still showed** in the booking barber picker — no slots but the name in the list, filling the list for the whole 1-month leave. Expected: fully hidden during the leave, automatically back on return.
**Root Cause:** `whitecross-site/script.js` `_shouldShowBarber()` line 138 `if (b.active !== false) return true;` — returned BEFORE the leave check (line 142). Going on leave sets `status:'leave'` but leaves `active` as `true` → the guard says "show" and never runs the `isBarberOnLeaveForKey` date check below. The leave-hide logic was mistakenly written with the assumption "a barber on leave has `active===false`" (whereas leave and active are independent fields).
**Resolution:** TWO STAGES. (1) `cddf0d02`: `if (isBarberOnLeaveForKey(b, _barberTodayKey())) return false;` at the top of `_shouldShowBarber` — hide by TODAY. **This created a regression:** the booking window is today→+90 days but because barber buttons were filtered once by TODAY, the barber dropped off the list for 90 days during the leave → the owner wanted to book a date AFTER the return, and the barber could not be selected ("wasn't it supposed to open automatically?"). (2) `f2ba207f` FIX: today-hide was removed; the barber stays in the master list, and their button is hidden by the SELECTED DATE via `refreshBarberButtonsForDate(dateKey)` (`isBarberOnLeaveForKey(b, dateKey)`) — called in the date-change handler + at the end of render. The default date is today → a clean opening during leave (no clutter); when a post-return date is selected the button comes back automatically → the comeback can be pre-booked. If a selected barber is hidden on a date change, it falls back to "Any Barber". Slot generation (`getBarberScheduleForDay :1588`) already blocked leave by the selected date, untouched. Normal off-days are NOT leave (shiftChanges/dayHours) → unaffected, "not available" stayed the same (owner-approved). The salOWN online profile "Team" list was deliberately NOT TOUCHED (owner: it's a promotional list, let it stay there).
**Prevention:** `active` (lifecycle) and `status:'leave'` (date-range) are INDEPENDENT fields — one does not imply the other. Leave/off hiding guards must come BEFORE the `active` short-circuit in the visibility function. The same `barberStatusOf` + `isBarberOnLeaveForKey` helpers are separate copies in salown-app (`isBarberOnLeaveForDate`) and whitecross-site → when one is fixed, the same ordering bug should be looked for in the other.

**Lessons Learned:**
- **The `active` boolean ≠ leave/off status.** A barber stays `active:true` while on leave; if the visibility filter looks at `active` and returns early, the date-range leave is never evaluated. Guard order: first "should it be hidden" (leave/off), then "is it active".
- **"No slots but the name is there" = the filter diverged across two layers:** slot generation sees the leave, the name list doesn't. Both layers must use the same `isBarberOnLeave*` helper.
- **By which date is visibility computed? If the booking window is multi-day (90 days), don't filter the picker by a SINGLE day (today).** A barber on leave should be hidden today BUT stay selectable for post-return dates → the filter must depend on the SELECTED date and be re-evaluated when the date changes. Today-based hiding satisfies "hide during leave" but breaks "reappear on return / book a future date" (the first fix broke exactly this in this incident).
- The whitecross-site public site does NOT deploy via CI (`deploy.yml` only on `barber-panel/**`+`functions/**` paths, `firebase.admin.json`). A root `script.js` change requires a MANUAL `firebase.saas.json` deploy — a push alone does not push it live.

## 2026-07-13 — dailyFirestoreBackup silently failing every night — the daily backup was never taken

**Severity:** 🟠 High (in a data-loss scenario there was NO backup; no live impact) · **Owner:** Claude + owner approval · **Status:** ✅ Resolved (2026-07-13 evening — IAM granted + live export verified)

**Impact:** Ever since the scheduled 03:00 London backup was deployed, it fell over every night with "The caller does not have permission" → there was no nightly backup anywhere under `firestore-backups/`. Silent risk: if a bulk data incident happened in Firestore there was no point to return to.
**Root Cause:** Two IAM permissions were never granted: (1) the function's runtime SA (`1050766582653-compute@developer.gserviceaccount.com`) could not call `datastore.exportDocuments` — there was no project-level `roles/datastore.importExportAdmin`; (2) the Firestore service agent that actually writes the export (`service-1050766582653@gcp-sa-firestore.iam.gserviceaccount.com`) had no write permission on the target bucket. The code was correct (a comment in the code already documented the permission) — the setup step was simply never done.
**Resolution:** With owner approval ("just handle it"), the two permissions were granted via the REST API (no gcloud — using the firebase CLI OAuth token, `cloudresourcemanager` `setIamPolicy` + Storage bucket IAM PUT; script in scratchpad `fix_backup_iam.py`). Verification: the Cloud Scheduler job (`firebase-schedule-dailyFirestoreBackup-europe-west2`) was manually `:run` → in ~10 s `gs://havuz-44f70.firebasestorage.app/firestore-backups/2026-07-13/` filled, `overall_export_metadata` written = export DONE. No code change.
**Prevention:** (1) The next night's cron passes with the same permissions — on the morning of 14 Jul check whether `firestore-backups/2026-07-14/` exists; (2) ✅ a failure-alarm was added the SAME DAY (`740916b` + targeted deploy): on an export error, a Brevo email to `info@salown.com` + rethrow (so the run shows as failed) — the alarm path was verified live (a second same-day export "Path already exists" error → the alarm email went out; the "🔴 backup FAILED" email in the owner's inbox on 13 Jul is that test, ignore it); (3) ✅ a 30-day lifecycle delete rule was set up the SAME DAY — ONLY on the `firestore-backups/` prefix in the bucket (`age>30 → Delete`) (the `tenants/` uploads in the same bucket are OUT of scope, deliberately scoped).

**Lessons Learned:**
- "Scheduled function deployed" ≠ "working" — functions that require IAM must be closed out with proof of AT LEAST ONE successful run after deploy (scheduled fns should be included in the rc3 smoke list).
- Silently failing nightly jobs are invisible until a log scan — critical crons need a failure-path alarm (same class as the success/failure-marker lesson from the Guru incident).
- Even without gcloud installed, GCP REST APIs (IAM/Scheduler/Storage) work fully via the firebase CLI OAuth token — the write-side counterpart of the read-logs-oauth pattern.

## 2026-07-12 — Guru 3× "Payment setup failed" (whitecrossbarbers.com) — the Stripe session was never created

**Severity:** 🟠 High (the customer could not pay 3 times; self-resolved) · **Owner:** Claude (rc3 session) + owner · **Status:** ✅ Resolved (2026-07-12 ~13:00: owner turned on GH Pages **Enforce HTTPS**; verified via curl — apex+www `http://` → **301** → https 200. The error class is permanently closed.)

**🎯 DEFINITIVE ROOT CAUSE (Cloud Logging httpRequest evidence, 2026-07-12):** In the 3 failed attempts `referer: http://whitecrossbarbers.com/` — in the 2 successful ones `https://`. The `createCheckoutSession` CORS allowlist contains ONLY https origins (`https://whitecrossbarbers.com` + `https://www...`) → a preflight from an http page returns 204 but does NOT INCLUDE `Access-Control-Allow-Origin` (OPTIONS responseSize 222B vs 278B on success — the difference is exactly that header) → the browser blocks the POST → "Payment setup failed". Two different devices (iPhone Chrome + iPhone Safari) + two different networks, common denominator = http. **GitHub Pages `http://whitecrossbarbers.com/` does NOT 301, it returns 200 (confirmed via curl)** — Enforce HTTPS off → the unencrypted page looks fully working, only the payment step dies silently. Because the Firestore SDK talks to its own google endpoints, the PENDING write works even over http (hence the "booking created but no payment" pattern).
**Permanent fix (NO CODE):** GitHub repo Settings → Pages → **turn on Enforce HTTPS** → http requests 301 to https, the problem closes as a class. (The alternative of adding the http origin to CORS is NOT RECOMMENDED — a page that initiates payment should not be served unencrypted.) Log access was also solved in this investigation: the Logging API can be queried directly with the firebase CLI OAuth token (scratchpad read-logs-oauth.cjs pattern; the CLI's own `functions:log` is days behind).

**Impact:** A real customer (Guru) tried to book from whitecrossbarbers.com 3 times between 09:56–09:59 BST (1×DEPOSIT, 2×FULL) — in all three he never even reached the payment screen. The 4th attempt (~10:29, in the shop, with the owner present) was smooth: he paid, CHECKED_OUT £34.
**Root Cause (most likely):** Client-environment — of the flow's 3 stages the first two worked (race-check fail-open; **the PENDING docs were written to Firestore**), the 3rd failed: `fetch('https://createcheckoutsession-…-uc.a.run.app')`. Evidence: none of the 3 docs have a `stripeSessionId` (the function writes it best-effort when it creates a session) + no session in the Stripe dashboard = the function was never reached, or errored instantly. The same backend (post-rc3, unchanged) worked 30 min later both in the owner's test and in Guru's in-shop attempt → variable environment/network (home wifi DNS filter/VPN/in-app browser `*.run.app` block are the typical suspects).
**rc3 IRRELEVANT (proven):** source=Website → us-central1 legacy `createCheckoutSession` (rc3 changed the europe-west2 salown codebase, did not touch us-central1). The only salown function in the flow (`salownGetBusySlots` race-check) fail-opens with `.catch(()=>null)` AND the successful 4th attempt worked on the same deploy.
**Resolution:** Self-resolved (when the environment changed). The 3 PENDING docs were turned `expired_pending` CANCELLED within 15 min by `salownCleanupExpiredPending` — the system cleaned up as designed.
**Prevention (post-freeze):** (1) `createCheckoutSession`'s catch should write `stripeSessionError:{ts,msg}` to the booking doc — "why is there no session" becomes readable from the data (today we inferred it from the sessionId absence); (2) **the log blindness must be fixed:** `firebase functions:log` in this environment returns a page ~1-2 days behind, and the salown-panel SA has no permission on the Logging API (`roles/logging.viewer` can be granted) — during a live incident the function log is UNREADABLE; (3) the popup already gives the phone number (good); retry-with-backoff can be added.

**Side findings (same investigation):** (a) **POINTS WERE NOT APPLIED to the 3 cancelled bookings** — the owner's suspicion was checked, the loyalty fields are absent in all three; Guru's 123 points = 55 (21 Jun Booksy) + 68 (today's real checkout £34). If the panel shows something different that's a display matter, the data is clean. (b) **The "Your spot is still warm" email is NOT AUTOMATIC** — the only place that calls the `sendAbandonedCart` onCall is the panel `BookingDetailPanel.sendFinishBooking`. Log correlation: the 10:23 BST "Why no payment?" click and the 10:24 email are from the SAME Mac + SAME IP (60 s apart; the owner's morning diagnosis was on a different IP) — during diagnosis, the unconfirmed-silent "Send Finish your booking" button right below the result box was pressed unintentionally. The identity is NOT in the logs (the callable doesn't log uid — a 3rd piece of evidence for the I4 audit rationale). **UX lesson → G1:** the email-sending button must not sit unconfirmed right beneath a read-only diagnosis button (confirm + visual distinction). Real automation is already planned in ROADMAP C3. (c) A ready diagnostic tool exists: `checkBookingPayment` (card decline vs page abandon) — staff-auth'd, used on unpaids that HAVE a session.

**Lessons Learned:**
- Thanks to the success-path marker (`stripeSessionId`) we could prove "the session was never created" from the data — with a failure-path marker too, the root cause would be certain. The two should be designed together.
- In a live-customer incident, log access = diagnosis speed. Don't rely on the CLI; grant the SA logging.viewer.
- The PENDING→expired_pending→CANCELLED chain + the fail-open race-check worked correctly today — don't touch it.

## 2026-07-12 — Muhamed's on-leave record was silently deleted (single-click "Activate")

**Severity:** 🟡 Medium · **Owner:** Claude (night session) · **Status:** ✅ Resolved (2026-07-13: guard LIVE `b582042` — a toggle on a member on leave asks for confirm + writes a `BARBER_STATUS_CHANGED` audit; the data had already been re-entered on the 12th [14 Jul–19 Aug]. Also, via G5 step 1 `c66320d` Finance NO LONGER COUNTS leave days — the £1,331 risk is closed. G5's remaining steps [grid/BookingPage/server resolver] are open on the ROADMAP.)

**Update (2026-07-12 afternoon):** The owner re-entered the leave but Muhamed kept showing in the grid → a full audit was done: availability logic behaves in 5 different ways across 5 surfaces — the grid doesn't read leave at all, BookingPage hangs on the `active` boolean (doesn't auto-return when leave ends), the server reschedule allows leave, and **Finance keeps counting leave days (~£1,331 ghost-wage risk, fix recommended before 14 Jul)**. Inventory + target model + order: [STAFF_SETTINGS_AUDIT.md](STAFF_SETTINGS_AUDIT.md), ROADMAP G5.

**Impact:** At Whitecross, Muhamed had been set on-leave; the owner noticed the leave had vanished (doc: `status:'active'`, `leaveFrom/leaveUntil:null`) — the barber appeared bookable again.
**Root Cause:** `Barbers.tsx:358 cycleStatus` — regardless of the status (including leave), a single click flips to active/passive and **writes `leaveFrom/leaveUntil:null` every time**; no confirm. Moreover, for `_status!=='active'` members the button is deliberately "unmissable green ✓ Activate" (a side effect of the passive-confusion fix) → so even on an on-leave card there is an inviting single-click leave-eraser. The alternative path (changing status in the editor and saving, `:313`) gives the same result.
**Resolution:** The leave data will be re-set with the dates the owner provides (data correction). The code fix is 2026-07-14+ due to the freeze (ROADMAP G1).
**Prevention:** (1) a confirm modal on the toggle for an on-leave member ("X is on leave until Y — end leave?"), (2) a `BARBER_STATUS_CHANGED` auditLogs record — in this incident **who/when could not be found because barber changes are not logged** (auditLogs is only booking/finance).

**What happened / Diagnosis:** Per Rule #7, INCIDENTS was scanned (nothing similar). A read-only snapshot of the doc was taken via the admin SDK: leave fields null + status active = NOT an expiry (expiry doesn't rewrite the doc, the status would stay 'leave') → an active overwrite. The writing paths were grepped: panel `cycleStatus` + editor save; the staff app doesn't write to barbers (its only updateDoc is RescheduleSheet=bookings); functions don't write to barbers. UNRELATED to rc3 (same night but the code content didn't change, functions don't touch barbers, and the panel push is also pending). The last 25 auditLogs were scanned — no barber event (not logged).

**Lessons Learned:**
- A button emphasized "so it's visible" (green Activate) becomes **invitingly destructive** in the wrong state — the emphasis must change according to the meaning of the state (on leave say "End leave", not Activate).
- A confirm is mandatory for single-click actions that change status AND delete data (zeroing a date field); a toggle ≠ harmless.
- The auditLogs coverage gap leaves the diagnosis blind: staff/rota changes must also be logged.
**Status legend:** ✅ Resolved · 🟡 Open (partial/follow-up) · 🔴 Regressed (came back — recurrence).
**Owner:** the person who did/is responsible for the fix. If unknown `—`, but MANDATORY on new records (multi-session repo, the answer to "who do I ask").

---

## 2026-07-11 — The Products page was "orphaned" in the panel redesign — the route is live, unreachable from any menu

**Severity:** 🟡 Medium · **Owner:** Alish + Claude · **Status:** ✅ Resolved

**Impact:** The owner wanted to add a product, couldn't find Products in the sidebar — the page had for months only opened if you manually typed the `/app/products` URL (the data model was live: sales kept flowing through `soldProducts`, only the path to the MANAGEMENT screen was missing).
**Root Cause:** In the legacy panel (salown-panel), Products was a TAB of the Online Profile; when OnlineProfile was rewritten in the salown-app redesign with a new tab set (profile/gallery/team/announce/seo), the products tab was not carried over, nor was it ever added to the Sidebar — because the route (`AppRouter.tsx`) was carried over, the page stayed "works but unreachable". Related but SEPARATE layer: `settings.products.enabled` (the public shop gate) had been properly moved to Settings → the "the setting exists, the page doesn't" confusion.
**Resolution:** `7cb698c` (push→CI) — a `products` entry in the Sidebar CONFIG section next to Services (visible to owner+admin; OWNER_ONLY set). The public-shop gate was not touched.
**Prevention:** **In a redesign, route↔nav parity must be checked:** that every page registered in the router has at least one UI entry (nav/tab/button) must be verified in the redesign PR's checklist. "The route works" ≠ "the feature is accessible".

**Lessons Learned:**
- When a feature is said to have "disappeared", check three layers SEPARATELY: the data model (was it working?) → the route (is it registered?) → the nav entry (is there a link to it?). Here only the third was broken.
- A legacy feature's "special setting" can be two different things: the management UI (panel) vs the public gate (website). Map them without conflating.

---

## 2026-07-11 — After a client edit, the walk-in picker split the same person in two → contactless booking, loyalty email did not go out

**Severity:** 🟠 High · **Owner:** Alish + Claude · **Status:** ✅ Resolved

**Impact:** The owner added an email via Clients edit to the client doc of a name-only customer ("Alex Software Dev"); then entered a walk-in from the grid — the booking was written **without email/phone/manualId**, the confirmation/loyalty email did NOT go out, and no points/visits were applied to the client doc. The owner thought "a duplicate record was created" but there was a single client doc in Firestore — the duplicate lived only in the WalkInForm dropdown.
**Root Cause:** The `WalkInForm` client list is built **BEFORE** the bookings, and the merge key is `phone||email||name`. When the doc gained contact, its key shifted from name to email; the old name-only bookings stayed on the name key → so the same person became TWO rows in the dropdown. Because the contactless ghost row was added first, `nearMatch`/banner/save-confirm always suggested THAT one; auto-link also didn't kick in (it requires "full name + a SINGLE match", and there were 2 matches) → whichever way it was selected the ghost got linked → the booking became `email:'' phone:''`. Chain reaction: `salownSendLoyaltyEmail` saw the empty `clientEmail` and returned early (the flag `sendLoyaltyEmail:true` stayed STUCK, exiting without reset); `checkoutBooking`'s client-doc update is behind `if (phone || email)` → so points/stats were never written to the doc (they were written to the booking: earned 38 / total 66, doc stayed at 28).
**Resolution:** (1) **Data repair** (admin script, owner-approved): to the booking `clientEmail`+`clientManualId`; to the client doc the skipped stats exactly (loyaltyPoints 28→66, totalSpent +£41.80, totalVisits +1, lastVisit/lastBarber/lastService); the loyalty email was fired by a `sendLoyaltyEmail` false→true transition → `loyaltyEmailSent:true` confirmed in 4 s. (2) **Permanent fix** `540db5a` (push→CI, salown.com panel): client docs are processed FIRST as canonical; bookings merge onto the doc row by exact phone/email, and contactless bookings ONLY by an unambiguous normalized name (2 docs with the same name → no merge; the NORMALIZATION rule "no name-matching when contact exists" is preserved). The doc-less-customer + docs-fetch-error path keeps the old behavior. Verified with a 4-case simulation + tsc/eslint/vitest 25/25/build.
**Prevention:** On EVERY surface that merges identity, the canonical source (client doc) comes first; a booking-derived record can only MERGE, never open a row ahead of the canonical. A single `phone||email||name` key splits the identity when a person gains contact — use a multi-index (phone + email + guarded name). Also, triggers must reset the request flags (`sendLoyaltyEmail`) or mark the state when returning early from a guard — a stuck `true` blocks the next trigger too (today the second write needed a `false→true`). **✅ BOTH WERE APPLIED (same day):** (a) the same bug was found and fixed in BookingForm too (`40c79e9`, push→CI; staff ClientSearch + Reports/Clients came out clean — already canonical); (b) trigger hardening is LIVE (`35818d2` + targeted deploy `functions:salown:salownSendLoyaltyEmail`, ghost-booking prod smoke PASS): every early exit resets the flag + writes `loyaltyEmailSkipped: 'tenant-flag-off'|'checkout-email-disabled'|'no-email'|'opt-out'` — Brevo sees only ATTEMPTED sends, and the reason for un-attempted ones is now on top of the booking. Scan inventory: 366 stuck flags (whitecross 343 · herohairs 13 · demo 9 · hair-lab 1); the historical cleanup (bulk `false` reset) is awaiting owner approval — inert, not urgent.

**What happened / Diagnosis / Fix:** The owner said "I entered phone+email from the edit, made a walk-in, no contact in the detail, the email didn't go; and I can't see a duplicate record either". Rule #7 → in INCIDENTS the 2026-07-05 "matched-but-not-linked customer" precedent was found (same file, neighboring flow). Evidence was collected with a read-only admin SDK query: the doc HAS email/NO phone; today's + 22 May bookings are name-only. Reading the code, the `WalkInForm` map build order + key selection emerged as the root cause. The repair script was written with safety re-checks (state drift guard); the email confirmation was obtained by polling the booking's `loyaltyEmailSent` marker. Note: the doc's `phone:""` was empty; the owner later clarified — the phone was simply never entered (only birthday + email were added), there's NO issue in Clients edit.

**Lessons Learned:**
- **"No duplicate record but the behavior is like a duplicate record" = the identity split may be in the UI layer.** When Firestore is clean, look at the dropdown/list build logic — an identity key that changes over time splits the person.
- **Gaining contact is an identity-transition moment:** in single-key schemes like `phone||email||name` the person's key changes; old records stay on the old key. Merging requires a multi-index.
- **An early-returning trigger must clear the request flag** — a stuck `sendLoyaltyEmail:true` both makes the state misleading ("will be sent" appears) and requires two writes to re-trigger.
- **TS migration does not fix a behavior bug (deliberately):** by the type-only constitution, migration slices don't touch logic; the expectation "it'll fix itself when TS lands" is invalid for this class of bug — a separate `fix:` commit is needed.

## 2026-07-06 — The Marketing list showed opt-out/suppressed people (list ≠ send)

**Severity:** 🟡 Medium · **Owner:** Claude (Opus 4.8 · owner reported) · **Status:** ✅ Resolved

**Impact:** The owner was seeing **people who had unsubscribed / bounced / been marked spam** in the Marketing campaign recipient list ("someone who was emailed / opted out shouldn't appear in the list"). In reality email was **not going** to those people (the server send guard was correctly skipping them) — the problem was **display only**: the list was looser than the actual send → misleading.
**Root Cause:** The suppression data existed in salOWN but was **not connected to the list.** `salownBrevoWebhook` (`functions/index.js:4213`) writes Brevo events to `tenants/{id}/emailEvents/{key}` as `suppressed:true` + mirrors `emailOptOut` onto the matching client doc — BUT the mirror works only for a person who **has an exact-email client doc** (`:4253` `where email==`, limit 5). For someone without a client doc (walk-in/aggregator) or whose email is letter/space-mismatched, the mirror is skipped; the suppress info stays only in `emailEvents`. The list, meanwhile (`buildAudience` → `BulkCampaignPanel`), read `emailOptOut` **only from the client doc** and never read `emailEvents` (`audienceUtils.js:114`). `emailEvents` was loaded to the frontend (`Marketing.jsx:249`) but used only for the re-engagement STATS panel, not for the send list.
**Resolution:** `cf62f72` (push→CI, salown.com). `buildAudience(bookings, clients, emailEvents)` — the 3rd arg is opt-in (default `[]`, other callers Overview/Customers unchanged). A `suppressed` set is built from `emailEvents` via normalize-email, folded into `emailOptOut` (`emailOptOut: clientDoc.emailOptOut || suppressedEmails.has(normEmail(email))`) + a `brevoSuppressed` field for transparency. `BulkCampaignPanel` was not touched — its existing `:178` opt-out filter now also eliminates Brevo-suppressed ones. Verified locally: list renders OK, "76 will receive · 1 unsubscribed (skipped)", walk-in contacts in scope. Side benefit: the "Unsubscribed" panel now also shows the Brevo opt-outs.
**Prevention:** If a suppression/opt-out mechanism exists, EVERY surface that consumes it (display + send) must read from **the same source(s)**. When the send guard checks `emailOptOut` + the `emailOptOuts` collection + (now) `emailEvents.suppressed`, but the list only looks at the client-doc flag = a list-send inconsistency. Rule: "who gets an email" must derive from a single predicate. **REMAINING (#2) → ✅ RESOLVED (2026-07-14, `1bf3416`):** bulk-send now stamps every successful recipient — `lastMarketingSentAt` on every send, `reengagementSentAt` on lapsed/re-engage (BulkCampaignPanel sends `campaignType:'re-engagement'` on lapsed segments), `birthdayCampaignYear` on birthday; a doc-less re-engage recipient gets C5-A find-or-create (against a single clients snapshot, no per-recipient scan) + every send is logged to `campaignsSent`. The "Slipping away" card counter also applies the same 30d suppress as the compose filter. Because of this bug whitecross sent the same blast to lapsed30 3 times in 9 days (04/06/13 July); the 75 recipients of the 13 July run were retroactively stamped by a script (75/75 name→doc matched). Residual: the list still doesn't hide "sent in the last N days" on the `all`/`haspoints` segments (the data now exists: `lastMarketingSentMs` is read in the audience, a UI filter later). See [[project-lapsed-dedup-limitation]].

**What happened / Diagnosis / Fix:** The owner said "people who were emailed + opted out shouldn't appear in the list". At first it was assumed the list and the send guard used separate filters; when the owner said "we set up the Brevo hook a few days ago, the details must be inside", `salownBrevoWebhook` + `emailEvents` + `ROADMAP:135` were found → the data was already being collected, only the list wasn't consuming it. Fix = connect the existing data (not tracking from scratch).

**Lessons Learned:**
- **"List ≠ send" = almost always a display bug, not a data one.** The send was correctly skipping; before panicking, looking at the actual send guard showed no one had been wrongly emailed.
- **Collected data ≠ connected data.** `emailEvents` was being filled by the webhook and used in the STATS panel but was not connected to the send list — "it exists inside" ≠ "it's used in the right place". When adding a new data source, connect ALL of its consumers too.
- **Suppression is a single predicate.** Opt-out can be written to three places (client `emailOptOut`, the `emailOptOuts` collection, `emailEvents.suppressed`); every surface must read all three or the surfaces diverge.
- The owner's "we planned this, we set up the hook" reminder was critical — it steered toward finding the existing infrastructure instead of a from-scratch solution.

## 2026-07-05 — Walk-in/booking client search: a matched-but-not-linked customer = a silent duplicate record

**Severity:** 🟠 High · **Owner:** Claude (Opus 4.8 · Arda reported) · **Status:** ✅ Resolved

**Impact:** When adding a walk-in/booking, Arda would type the customer name and, **when the name appeared, press Enter on the keyboard** (natural muscle memory: type→Enter→select) — but **the person he saw was not being assigned**. Continuing without selecting and saving, the booking was not linked to the existing client, and a name-only **duplicate record** without phone/email/docId was written → visit history + loyalty **disconnected**, a duplicate client. It was silent (no error, no warning) and Arda had been saying this **for a while in live use**.
**Root Cause:** TWO layers. (1) The `WalkInForm.jsx` client search input had **NO `onKeyDown` handler AT ALL → Enter was a dead key**; keyboard selection was impossible, the link happened ONLY via mouse on the dropdown row's `onClick` (`setSelectedClient`). Arda's "type→Enter" reflex therefore never linked (and every keystroke also `setSelectedClient(null)`). (2) On save, `name: selectedClient ? selectedClient.name : titleCase(search.trim())` — a **legitimate, load-bearing** fallback for an anonymous walk-in; BUT it also SILENTLY routed the "a match is on screen but wasn't selected" case into the same branch. Because two different scenarios (new/anonymous customer **vs** matched-but-not-linked) collapsed into one branch, one of them was corrupting the data. So the real trigger was not "forgetting to click" but **the expected interaction (Enter) never being wired up at all**.
**Resolution:** `07fb06c` (push→CI, salown.com panel). Four guards (walk-in + booking tab, shared `clientSearchBlock`+`resolveClientForSave`): (2) **keyboard** ↑/↓ highlight + Enter only on a highlighted OR a **single** match (no guessing on multiple — "B safer") + Esc — **the ACTUAL fix for Arda's type→Enter flow**; (1) **exact full-name** → a single clear match auto-links; (3) an **amber "Not linked — did you mean X? [Link]" banner** (`nearMatch`); (4) a **save-time backstop** `resolveClientForSave()` → on Save/Checkout with an unlinked-but-matching name, a `window.confirm` (link-existing vs add-new). + `onMouseDown preventDefault` on the dropdown rows (so a blur-timeout doesn't swallow the click). The staff `NewBookingSheet.jsx` does NOT have this trap (walk-in is a plain name input, appointment is `ClientSearch onSelect`) → not touched.
**Prevention:** In "find → CLICK to select" autocompletes, there must be a backstop **at save time**: if the typed value matches an existing record but isn't linked, don't SILENTLY write an orphan — ask or auto-link. **If a load-bearing fallback also swallows a second illegitimate case, that's a latent bug.** The same "typed-but-unlinked" pattern is risky on other search surfaces too: **Reschedule modal** client change, **Clients merge-drag**, **campaign audience** search → consider the same guard.

**What happened / Diagnosis / Fix:** Arda said "I search, I find, but it doesn't assign without clicking". Diagnosis: the code was type-correct, there was no crash/exception; the problem was that with `selectedClient=null` the typed-name fallback also silently swallowed the near-match (the anonymous-walk-in fallback masked the near-match case). Verified end-to-end in local Chrome: type name → click → banner appeared, [Link] → linked chip; **Total 13 stayed fixed** = no test data was written. Only the `WalkInForm.jsx` explicit-path commit; the staff-bundle (another session) + aerulas `b9c5b2e` (already pushed to origin by then) were not touched → the push deployed ONLY its own commit. CI run #225 = success.

**Lessons Learned:**
- **"I find it but it doesn't assign" = the expected key may not be wired at all.** The real cause was not "forgetting to click" but the absence of `onKeyDown` on the input → **Enter a dead key**. Reproduce the user's complaint literally (what Arda did: type→**Enter**, not click) — diagnosing with the wrong mental model ("didn't click") shadows the actual root cause (Enter not wired). Every searchable/selectable autocomplete must support keyboard selection (Enter/↑↓).
- **A recurring user complaint over time = prioritize it.** Arda said it for a long time; while it was being deferred as "he's probably not clicking", duplicate clients were silently accumulating. A recurring operational complaint can be a signal of silent data loss.
- **A latent _data_ bug ≠ a UX rough edge:** the criterion = does it silently produce a **persistently wrong state**? Duplicate client + disconnected loyalty/history → yes, a bug. If it were merely "one extra click, data correct" it would be pure UX.
- **A bug hidden inside a load-bearing fallback:** the anonymous-walk-in fallback was a correct quirk but was also swallowing a second scenario — "the second job of code that looks correct". The distinction between KNOWN_QUIRKS (deliberate) and latent (accidental) is exactly here.
- **TypeScript would not have caught it:** `null` selectedClient is valid state, the fallback is a valid branch → not a type but a **logic/data** error. TS's blind spot (see the TS-migration decision).
- In "find-but-click" autocompletes, make **save-time guard + single-clear-match auto-link** a permanent pattern; don't silently create a new record for a near-match.

## 2026-07-04 — Off-day barber bookable (empty-day fast path skipped schedule)

**Severity:** 🟠 High · **Owner:** Claude (Opus 4.8) · **Status:** ✅ Resolved

**Impact:** A customer was able to book online with a barber who was **off that day** (Alex doesn't work Tuesdays but a CONFIRMED booking with Alex landed for Tue 7 Jul 10:15 — and paid). An appointment with the wrong barber = operational confusion.
**Root Cause:** `BookingPage.getAvailableSlots` is two-path: the **busy-day path** (if there are bookings that day) filtered working-days/hours correctly via `getBarberSchedule`; but the **empty-day fast path** (`existingBookings.length === 0`) marked ALL eligible barbers "free" WITHOUT any schedule check → on an empty day (Tuesday, no bookings) an off-barber entered both the auto-assign and the selection list. Also: `handleSubmit` fell back to `barbers[0]` (schedule-blind).
**Resolution:** `0ffabf4` (push→CI). The fast path now filters by `getBarberSchedule(b, date)` + slot-time (the same as the busy-day path); an off/out-of-range barber is not counted `free`, and if no one works at that slot, `available:false`. The `handleSubmit` fallback = the first barber working that day (`barbers.find(b => getBarberSchedule(b, selectedDate))`), never `barbers[0]`. Tenant-agnostic (each barber's `workingDays`/`shiftChanges`).
**Prevention:** BOTH availability paths (fast/busy) must apply the SAME rules — the "empty day = everyone available" shortcut skips working-days. Rule: barber availability = shop-open ∧ barber-working-day ∧ barber-hours ∧ slot-free; no path may skip any of these. The same pattern exists in reschedule/manage too (see 2026-06-29 off-day ghost booking) — a recurring pattern.

**Lessons Learned:**
- "Empty data = everything allowed" fast-paths are dangerous: they must carry all the guards of the correct path, otherwise there's a silent hole only-in-empty-state.
- Barber auto-assign must assign ONLY to barbers working that day+time; display-list (freeBarbers) = auto-assign pool = the same filter.
- A 2nd similar off-day bug (first reschedule/manage `5476238`, now booking) → availability logic must rest on a single helper (`getBarberSchedule`), and every call-site must use it.

## 2026-07-04 — "Connect with Stripe" internal error (Firestore odd-path)

**Severity:** 🟠 High · **Owner:** Claude (Opus 4.8) · **Status:** ✅ Resolved

**Impact:** When the owner pressed "Connect with Stripe" in Settings→Integrations, an `internal` error — Stripe Connect onboarding never started (both local and salown.com).
**Root Cause:** `salownConnectStart` wrote the CSRF nonce to the path `superAdmin/oauthStates/${nonce}` = **3 segments** (odd). Firestore `.doc()` requires an even number of segments; a 3-segment collection path → `Value for argument "documentPath" must point to a document ... does not contain an even number of components` → unhandled → callable `internal`.
**Resolution:** The path was made `superAdmin/oauthStates/nonces/${nonce}` (4 segments); BOTH the writer (`salownConnectStart`) + the reader (`salownConnectCallback`) were fixed + targeted deploy (`functions:salown:salownConnectStart,salownConnectCallback`).
**Prevention:** In Firestore `.doc(path)` strings the segment count must be **even** (collection/doc/collection/doc…); `.collection()` is odd. Count when writing a new path. The Phase 0 code was deployed but had NEVER been run → "deployed ≠ tested"; trigger the secret/happy-path once after deploy.

**Lessons Learned:**
- The odd/even segment rule: `.doc()` even, `.collection()` odd. For nested state use `col/doc/col/doc` (e.g. `superAdmin/oauthStates/nonces/{id}`), not `col/doc/{id}`.
- Deployed-but-never-triggered code = untested code. Phase 0 was written weeks ago, the first real click was today → the bug surfaced today. Smoke the critical happy-path on deploy day.

## 2026-07-03 — The checkout summary panel wasn't showing add-ons (Subtotal missing, Total correct)

**Severity:** 🟢 Low · **Owner:** Claude (Opus 4.8) · **Status:** ✅ Resolved

**Impact:** The owner added a "Nose Wax £6" add-on to the service at checkout; in the summary panel on the right, **Subtotal £28** (no add-on) remained and the add-on line never appeared — but **Total £40 was correct**. Subtotal+Tip (£28+£6) ≠ Total (£40) → looked inconsistent/misleading ("the extra I added doesn't enter the breakdown"). **The data and receipt were ALWAYS correct** (booking `soldAddOns`, Service total £34, receipt "Nose Wax Add-on £6" all correct); the problem was only the live display on the checkout screen.
**Root Cause:** `CheckoutPanel.jsx` **never passed** `localExtras` (add-ons) to `SummaryPanel`. The panel only summed `localProducts`, `Subtotal = basePrice + productsTotal` — `addOnsTotal` missing. The `total` prop, however, came correct because in the parent it's computed with add-ons included (`startingTotal = basePrice + productsTotal + addOnsTotal`, `:687`) → hence a gap between Subtotal and Total equal to the add-on. A latent bug (products were shown, add-ons had never been added).
**Resolution:** `CheckoutPanel.jsx` (+13/−2): the `localExtras` prop was passed to `SummaryPanel`; `addOnsTotal = getProductsTotal(localExtras)`; an amber add-on block (name·£) added below the product block; `Subtotal = basePrice + productsTotal + addOnsTotal`. Build zero-error (`CheckoutPanel-Ck-OpAyi.js`). Deploy: salown.com `npm run deploy:panel` (the staff app has a SEPARATE checkout, unaffected).
**Prevention:** If a money summary shows both a "line-item list" and a "Subtotal", both must derive from **the same source** (products **+ extras + service**); if the Total comes from a separate formula and doesn't match the line total, the display is missing something. An add-on = the same `getProductsTotal` shape as a product, an easy-to-forget second array.

**Lessons Learned:**
- "Total correct but breakdown wrong" = almost always a **display** bug, not data — look first at the persistent doc + receipt (if both are correct, no panic).
- `soldProducts` and `soldAddOns` are TWO separate arrays; a surface can show the product and forget the add-on (see the same-day Staff/Panel Sales visibility work — the same pattern: missing the second add-on/product array).

## 2026-07-03 — An after-hours "Busy" quick-block didn't show in the grid → an un-deletable ghost record

**Severity:** 🟡 Medium · **Owner:** Claude (Opus 4.8) · **Status:** ✅ Resolved

**Impact:** At Whitecross the owner set a **"Busy" quick-block at 23:44** for the whole team (scope 'all' → alex/arda/muhamed, crossing midnight 23:44→next 00:44). The records didn't show in the Calendar Day grid → they couldn't be clicked and deleted. The owner also thought "I can't give Alex off, it says there's a booking".
**Root Cause:** `TimeGrid.jsx` fixed the visible window with `GRID_START = open−2h`, `GRID_END = close+2h`. When the 23:44 block fell below the close+2h (~21:00) window, `top = (startMins − GRID_START*60)*…` positioned it below the screen and it became invisible ("data valid, UI invalid" — the INC 2026-06-29 ghost-booking family, different cause: not off-day but **after-hours time**). Secondary: the `Barbers.jsx` "Off today" `_todayCount` warning was also counting BLOCKED holds → the busy block said "reassign manually" (but `markOffToday` does NOT BLOCK; off can still be given).
**Resolution:** (1) The 3 ghost blocks were found and **signature-verified** deleted via a read-only admin query (only `status:BLOCKED·blockKind:busy·note:Busy·02Jul23:44`). (2) `TimeGrid.jsx` (+17/−2): `GRID_START/END` are now seeded with `OPEN/CLOSE` and expand **outward only** to cover that day's real records (excluding CANCELLED) — no after-hours record ever stays invisible again. (3) `Barbers.jsx` (+2/−1): `_todayCount` skips BLOCKED. Commit `7d06c33` PUSHED→CI hosting deploy (all-tenant Calendar). Functions not touched.
**Prevention:** The grid window now **follows the data** (not a static time box) → after-hours records stay structurally accessible. On normal days byte-identical (the window only grows, `OPEN_MINS/CLOSE_MINS` are preserved as real hours for the header/popup).

**What happened / Diagnosis / Fix:** The owner said "yesterday I set a walk-in or busy at a time the grid doesn't show, and I can't delete it". Per Rule #7, this file + KNOWN_QUIRKS/INVARIANTS were read first → the INC 2026-06-29 "off-day ghost booking" pattern ("not in grid = a DISPLAY problem; first VERIFY the doc in Firestore") was applied. With `firebase-admin` + ADC, `tenants/whitecross/bookings` was queried for 30Jun–6Jul → 3 BLOCKED/busy records were found at 02Jul 23:44. Not off-day (columns are drawn), the **time-window** cause was confirmed. The delete was done with a signature-guarded script; the fix was verified zero-error build.

**Lessons Learned:**
- **"Visible window" calculations like a grid must not be static; they must cover the data.** If a record falls outside the record window it becomes inaccessible in the UI ("ghost") — off-day (no column) and after-hours-time (card outside the window) are two separate causes of invisibility, both giving the same "data valid, UI invalid" result.
- **"Not in grid = not a create but a DISPLAY problem" (the same lesson as INC 2026-06-29 & 2026-06-26):** start the diagnosis not by reading code but by **read-only verifying the doc in Firestore**; the cause (off-day, time, or barber-match) emerges from the data.
- **A production single delete = a signature-guarded script.** Before deleting, verify the doc's expected signature (status/kind/note/date); if it doesn't match, STOP — better to not delete at all than to delete the wrong record.
- **A warning ≠ a block:** `markOffToday` was only showing a `_todayCount>0` warning, not blocking the operation; on an "I can't" complaint, first confirm in the code whether it's actually being blocked.

## 2026-07-02 — Approving a demo application overwrote the claim of an existing tenant's (eekurt) auth account

**Severity:** 🟠 High · **Owner:** Claude (Opus 4.8) · **Status:** ✅ Resolved
**Impact:** In an H2 P3 test, the super-admin approved the KWOLF BARBERS demo application (email: `eekurtbookings@gmail.com`). This email was already **eekurt tenant's login account** (uid `L6ws…`, `docs/TENANTS.md`). `approveApplication` reused the existing account and changed its custom claim from `{tenantId:eekurt}` → `{tenantId:kwolf-barbers, tenantRole:owner}` → the eekurt account dropped into kwolf-barbers, and eekurt access via this account broke. Also, the invite email blew up with `Domain not allowlisted`.
**Root Cause:** (1) `approveApplication` was **unconditionally overwriting** the claim of the existing user it found via `getUserByEmail` — it didn't check whether it belonged to another tenant. (2) The `generatePasswordResetLink` continue-URL `salown.com` is not in Firebase Auth Authorized domains.
**Resolution:** A guard was added — if `getUserByEmail` finds a user and `customClaims.tenantId` is populated, approve **rejects** (`failed-precondition`) instead of overwriting. Email: a `salown.com → salown.web.app → default` fallback chain. Both redeployed (`functions:salown:approveApplication`). Cleanup: eekurt + kwolf-barbers deleted from Firestore (by the user manually); the orphan auth account `eekurtbookings@gmail.com` to be deleted from Authentication (low priority).
**Prevention:** **Before** writing an auth user's claim, check whether that user is bound to another tenant. Provision/onboarding flows must never silently move an existing account to another tenant.

**What happened / Diagnosis / Fix:** P3 (Applications tab + approve→provision) went live. In the first real approve test the application email collided with an existing tenant account. `firebase functions:log` → `invite email failed: Domain not allowlisted by project` (email); `docs/TENANTS.md` → that `eekurtbookings@gmail.com` is eekurt's account (claim clobber). The tenant setup succeeded (the approve flow works) but two side bugs emerged. Both were fixed in code + redeployed; the test data (kwolf-barbers) + eekurt (deleted entirely by the user's decision) were removed.

**Lessons Learned:**
- `setCustomUserClaims` is a **destructive** operation — it completely replaces the existing claim. Before writing, a "does this account already belong to someone?" check is mandatory.
- The `generatePasswordResetLink`/`actionCodeSettings.url` domain must be in Firebase Auth **Authorized domains**; a custom domain (salown.com) isn't there by default — `salown.web.app` is. Permanent fix: add salown.com to Authorized domains (Console).
- Deleting a doc from the Firestore console **does not delete the auth user** (a separate system) and may not cascade sub-collections — when retiring a tenant, consider all three places: the Firestore doc, the sub-collections, and the Auth user.
- Don't use a real/existing email for test data (eekurtbookings@) — collision risk.

## 2026-06-29 — A customer reschedule accepted a barber's off-day (Arda Wednesday) → "ghost booking" (invisible in the grid)

**Severity:** 🟠 High · **Owner:** — · **Status:** ✅ Resolved
**Impact:** A reschedule link moved a booking to the barber's off-day; because the grid doesn't draw that column, the record became invisible/unmanageable ("data valid, UI invalid").
**Root Cause:** The business rule was on only one of two paths — the `workingDays` gate is in BookingPage, but not in the reschedule path (`salownGetBusySlots`/`salownRescheduleByToken`).
**Resolution:** Server-side barber availability validation + client MiniCal off-day disable (commit `5476238`, DEPLOYED).
**Prevention:** Business rules **cannot live in the UI** — grep ALL paths that write/move a piece of data, and both show the constraint in the UI and reject it on the server.

**What happened:** Via an email reschedule link, a booking could be moved to **Wednesday, Arda's off-day** (1 July 14:00). The booking EXISTS in Firestore but because the Calendar grid doesn't draw Arda's column that day it was **invisible** ("but the booking exists, Arda's not in the grid") — an invisible/unmanageable ghost booking.

**Root cause — one of two reschedule paths doesn't check workingDays:** Barber availability is modeled by `barber.workingDays` (capitalized day names) + `shiftChanges[dateKey]` + `dayHours[day].closed`. The **new booking** path (`BookingPage.jsx:248` `if(!workingDays.includes(dayName)) return null`) applies this → Arda isn't shown on Wednesday. But the **reschedule** path (`ManageBooking` + `salownGetBusySlots` + `salownRescheduleByToken`) never read the barber: `salownGetBusySlots` returns only **shop** hours + busy slots (NO per-barber), and `salownRescheduleByToken` only checked the clash + past-time + 2h rule. The shop is open on Wednesday (Muhamed/Alex work) → the off-day reschedule was accepted. whitecross-site `Reschedule.html` already did this correctly (auto-switch to a barber working that day if off) — so the new salOWN flow is a regression.

**Fix (2026-06-29, DEPLOYED — functions:salown + hosting, commit `5476238`):** Two layers. (1) **Server (authoritative)** `salownRescheduleByToken`: before writing, find the barber (by id OR name, case-insensitive) from the barbers collection, validate the new day via `shiftChange→workingDays→dayHours.closed`, and if off-day `HttpsError('failed-precondition', '<barber> is not available on <day>...')`. (2) **Client (UX)** `ManageBooking`: read the public `barbers`, and via a `barberWorksOn()` helper (a mirror of BookingPage's logic) disable off-days in the MiniCal + a `loadSlots` guard. Barbers is public-readable (`firestore.rules:83 allow read: if true`) → no extra callable needed. The erroneous LIVE booking (Arda 1 Jul) was left untouched by the owner's decision.

**Lessons:**
- **If an operation has two paths (booking vs reschedule), the business rule must be on BOTH.** The workingDays gate was only in BookingPage; the reschedule path had silently skipped it. When adding a new constraint, "ALL paths that write/move this data" must be grepped.
- **A booking that falls on an off-day = a ghost booking.** Because the grid doesn't draw the barber that day the record becomes invisible/unmanageable. An availability constraint must not merely be hidden in the UI, it must also be rejected server-side (UI bypass + grid invisibility are two separate harms).
- **A public callable returning PII-free data must also carry the business-rule data.** `salownGetBusySlots` returned only the shop hours and left barber availability out → the consuming page was left with an incomplete decision. Either the callable must return barber availability, or the client (if public-readable) must read it itself.
- **The dynamic version is on the roadmap** (ROADMAP #3b): off-day reschedule behavior + cancel/reschedule windows + barber-change will become tenant-configurable.

---

## 2026-06-29 — The reschedule/cancel link in the confirmation email + the ENTIRE salOWN app (login/signup/booking/manage) 404 in production — the CI deploy had not been shipping the bundle to live since 14 Jun

**Severity:** 🔴 Critical · **Owner:** — · **Status:** ✅ Resolved
**Impact:** The hub.salown.com panel routes (login/signup/app) + salown.com booking/manage + email links 404'd for weeks; "deployment pipeline silently broke".
**Root Cause:** `hosting/public-bundle` was gitignored → EVERY `firebase deploy` that skipped the build was deleting the bundle (not CI, a raw deploy). It had frozen on the last successful deploy (pre-14 Jun, static-only), without erroring.
**Resolution:** A `predeploy` build hook was added to `firebase.json` (commit `026c914`, PUSHED) — everyone who deploys builds first, and the bundle can't structurally drop.
**Prevention:** (1) "Page missing + route EXISTS in code = look at the deploy first"; if `curl <site>/public-bundle/index.html` is 404, the entire SPA is dead. (2) **Post-deploy smoke test** — fail if critical routes don't return 200 at the end of CI (the block below). (3) Build-output is either committed or bound to a predeploy hook.

**What happened:** Clicking the **Reschedule** link in the `noreply@salown.com` confirmation email of a Whitecross web booking gave "Firestore/page not found" (Firebase Hosting 404 "Page Not Found"). The owner asked whether it was after G1/G4 + said "normally it went to salOWN's own reschedule page" (he remembered correctly). Later, when `salown.com/login` also 404'd, the scope widened.

**Diagnostic method (in order):**
1. Email link: `functions/index.js:551` → `https://salown.com/manage/${tenantId}/${bookingId}?email=...&action=reschedule` (both in the `salownSendBookingConfirmation` onCall and in the trigger `_salownSendConfirmationEmail`; `bookingId = data.bookingId || docId`).
2. The page really EXISTS: `salown-app/src/App.jsx:25` `/manage/:tenantId/:bookingId` → `ManageBooking.jsx` (`salownGetBookingByToken` callable, Admin SDK → bypasses rules). The `/manage/** → /public-bundle/index.html` rewrite exists in `firebase.json`, and the local build (`hosting/public-bundle`) includes this route.
3. **Root cause found via live test:** `curl salown.com/{manage,app,login,signup,book}` → **all 404**, but `/` and `/barbers` (static) → 200. Definitive proof: `salown.com/public-bundle/index.html` → **404**. `salown.web.app` (the site default) is the same → the domain points to the right site, the deploy itself is old.
4. **Why it was CI:** in `origin/main` the firebase.json is CORRECT (all rewrites present), `npm run build` is HEALTHY locally, `package-lock` is in sync. But live is frozen on a deploy from BEFORE the commit `3d63c39` (14 Jun) that added `public-bundle`. `deploy.yml` (push→main → npm ci → build → `firebase deploy --only hosting`) exists in origin, but the bundle never shipped to production. The 7 Jun commit history offers the suspect: the secret name went back and forth (`FIREBASE_SERVICE_ACCOUNT_HAVUZ_44F70` ↔ `FIREBASE_SERVICE_ACCOUNT`) + `c7424f1` "remove functions from CI (IAM permission issue)" → the deploy step's SA/secret permission is probably broken.

**G1/G4 INNOCENT:** G1/G4 (`0f8de7e`) is a Firestore *rules* change. ManageBooking reads are an Admin SDK callable + public tenant-root (`firestore.rules:31 allow read: if true`) → unaffected by rules. The timing happened to be close; the owner connected it but it was irrelevant.

**Fix (2026-06-29, MANUAL DEPLOY):** Because the firebase CLI is authed on this machine, the bundle was shipped to production via `npm run deploy:panel` (= `vite build && firebase deploy --only hosting:salown`). Verification: `/`, `/barbers` still 200 (the landing didn't disappear), `/login /app /manage/**` now 200 (the SPA shell loads). The owner confirmed ("ok it came"). **The root cause (CI) was NOT SOLVED** — on the next `main` push CI deploy may fail again and revert to the old state.

**Lessons:**
- **"Page not found" + the route EXISTS in code = look at the DEPLOY first, not the code.** If `curl <site>/public-bundle/index.html` is 404, all the SPA rewrites are dead — it's not one route, the whole bundle is missing. If the static page (/) works but app routes (/app /login) 404, the definitive diagnosis: the bundle wasn't deployed.
- **A gitignored build + CI-build model breaks silently.** `hosting/public-bundle` is in gitignore, produced by `npm run build` in CI. If the build or deploy step fails, live freezes on the LAST SUCCESSFUL deploy (here pre-14 Jun static-only) — it doesn't error, the old site keeps working. Without a regular "live route smoke-test" it goes unnoticed for weeks.
- **Without CI log access, the root cause is narrowed from local:** origin/main config correct + build healthy + lock in sync → the only remaining layer is the deploy step (secret/IAM). `git show origin/main:firebase.json` + `git log -- .github/workflows/deploy.yml` say a lot.
- **OPEN WORK:** the CI deploy step (FIREBASE_SERVICE_ACCOUNT secret / SA Hosting-deploy permission) must be permanently fixed; otherwise every manual deploy is temporary. See [[project_salown_ci_deploy_gap]].

**UPDATE (same day — DEFINITIVE root cause + PERMANENT fix):** The first manual deploy ("ok it came") reverted to 404 AGAIN 20 min later. The cause was NOT CI/secret: commit `222f2a1` "everdy" (aerulas, adding marketing pages `/features /apps /story /emails`) arrived because the owner ran a raw `firebase deploy` **WITHOUT building locally** (the committed `.firebase/hosting.*.cache` is the evidence). **The actual root cause:** `hosting/public-bundle` is **gitignored** — only `npm run build` produces it. EVERY deploy that skips the build (including a marketing edit) ships a bundle-less site and wipes the whole SPA (login/signup/book/manage). This explains both the weeks-long original outage and the recurring reverts; not CI (CI already builds). **PERMANENT FIX (commit `026c914`, PUSHED):** a **`predeploy` hook** was added to both hosting sites in `firebase.json` (`npm run build` / `build:staff`) → now everyone who runs `firebase deploy` (manual/CI/worktree) auto-builds BEFORE the deploy, and the bundle can't structurally drop. Test: the bundle was deleted and a raw `firebase deploy` → predeploy rebuilt it, the site stayed up. **Additional lesson:** a gitignored build-output + "deploy = a separate step" model is fragile; bind a predeploy hook to the deploy OR commit the artifact. `.firebase/` cache must not enter git (everdy committed it by mistake — it should be added to gitignore).

**Prevention — post-deploy smoke test (add):** the predeploy hook guarantees the bundle is _produced_ but not that it is _served_. After a deploy, critical routes must return 200 live; if they don't, the deploy should be treated as a failure (a CI step or at the end of the deploy script):
```bash
set -e
for url in \
  https://hub.salown.com/login \
  https://hub.salown.com/signup \
  https://salown.com/book \
  https://salown.com/ \
  https://salown.com/public-bundle/index.html ; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$url")
  echo "$code  $url"
  [ "$code" = "200" ] || { echo "SMOKE FAIL: $url → $code"; exit 1; }
done
```
`/public-bundle/index.html` is especially important: if this is 404, all the SPA rewrites are dead (the definitive diagnostic signature of this incident).

---

## 2026-06-28 — Staff app revenue £370, web panel £335 (£35 difference) — `paidAmount` tip-inclusive + latent `tipPaymentMethod` gap

**Severity:** 🟡 Medium (tax-significant, HMRC) · **Owner:** — · **Status:** 🟡 Open
**Impact:** The staff app revenue is £35 too high (tips mixed into revenue); latently, the card/cash tip distinction is wrong.
**Root Cause:** `paidAmount = subtotal + tip` (gross collection, not revenue); also `tipPaymentMethod` is written but no report reads it.
**Resolution:** SalesView revenue `− pp(tip)` + a Tips breakdown added (LOCAL, not deployed).
**Prevention:** `paidAmount` = gross collection, subtract the tip for revenue; if a field is captured but not read = a silent bug, route all read points through it.
**⚠️ Open follow-up:** SalesView LOCAL (awaiting deploy); Finance/Reports still use the service `paymentMethod` → must move to the same `tipPaymentMethod` helper (whitecross-sensitive, awaiting owner approval).

**What happened:** For the same day the staff app showed "Total revenue" £370, the web panel (Dashboard/Finance) £335. The owner asked where the difference came from.

**Root cause — `paidAmount` includes the tip:** Checkout writes `total = subtotal + tip` to `paidAmount` (`CheckoutPanel.jsx:688` → `firestoreActions.js:153`). The staff app used `pp(paidAmount ?? price)` as revenue (`SalesView.jsx:85`) → so it takes the tip into revenue, and moreover showed `totalTips` separately (double presentation). The web panel uses `bookingNetWithoutTip` (`bookingUtils.js`), which deliberately excludes the tip. Discount + loyalty are subtracted on both sides → they cancel; **the only difference = the tip** (£35). Owner confirmation: a tip is never revenue, it's kept separate.

**Second (latent) finding — `tipPaymentMethod` was read nowhere:** Checkout captures the tip's method separately (`tipPaymentMethod`: Cash/Card, `CheckoutPanel.jsx:455`, written at `firestoreActions.js:157`) but **everywhere** (Finance/Reports/staff included) made the card/cash tip distinction from the service's `paymentMethod`. In a "paid by card, tipped in cash" (or vice versa) case the card-tip total is wrong — precisely the figure HMRC might count as revenue.

**Fix (2026-06-28, LOCAL):** (1) `SalesView.jsx` revenue = `pp(paidAmount ?? price) − pp(tip)` (the `revOf` helper; totalRevenue + payment-method + barber breakdown are all three tip-excluded) → the staff app is now £335. (2) A Tips breakdown was added to the staff app: cash/card (now CORRECT via `tipPaymentMethod ?? paymentMethod`) + barber settlement (`tipTakenAsCash` taken-from-till vs owed), view-only. **Open follow-up:** Finance/Reports still use the service `paymentMethod` → must move to the same `tipPaymentMethod` helper (whitecross-sensitive, awaiting owner approval).

**Lessons:**
- **`paidAmount` is the gross collection (tip included), not revenue.** If service revenue is wanted, subtract the tip (`− pp(tip)`) or use `bookingNetWithoutTip`. If two screens show the same "revenue" differently, look first at one's tip/discount/loyalty treatment.
- **Capturing a field and never reading it is a silent bug.** `tipPaymentMethod` was written for months but the card/cash reports kept using the service method → the tax-significant card-tip total was wrong. When adding a new field, route all read points through it too.
- **The tip money-flow lineage (`tipTaken`/`tipTakenAsCash`) means settlement for a card tip** — a card tip passing through the business is owed to the barber; a cash tip goes directly to the barber. Preserve this distinction when reporting.

---

## 2026-06-27 — Checked-out bookings looked "nested / cascaded" in Calendar Day-view — a late checkout inflated card height

**Severity:** 🟡 Medium (visual/UX, data intact) · **Owner:** — · **Status:** ✅ Resolved
**Impact:** On a busy day checked-out cards ballooned and swallowed the ones below → fake overlap / gradual cascade.
**Root Cause:** `actualDuration` (moment of pressing checkout − start) was LENGTHENING card height beyond the scheduled duration; the intent was to SHORTEN only on an early finish.
**Resolution:** `min(scheduledDuration, actualDuration)` — the card can only shorten; identical in two places, render + `computeColumns` (commit `11318da`, PUSHED→CI).
**Prevention:** If a duration field drives card geometry it must be one-directional; the height and the column engine must use the SAME duration source.

**What happened:** When an old busy day at Whitecross (Sat 20 June, 16 walk-ins, all CHECKED_OUT) was opened in Day view, the booking cards overlapped and scattered into progressively narrowing side-by-side columns (Treatwell-style) — a "the sales are nested" look. The owner suspected it came from the grid rising by the start-end time and the manually entered ones shifting down (a correct intuition).

**Root cause — `actualDuration` inflates card height:** At checkout `actualDuration = checkedOutAt − startTime` (minutes, clamp 5..240 = up to 4 hours; `firestoreActions.js:146`). This is not the service's REAL duration, but the time between the booking start and **pressing checkout**. `TimeGrid.jsx` computed both the height (`:343`) and the column math (`computeColumns :154`) of checked-out cards directly from `actualDuration`. On a busy day, when staff check a customer out **much later** than the real finish (in bulk / when free), `actualDuration` jumps to 1.5–4 hours → the card balloons → it "swallows" the bookings below → `computeColumns` counts them all as one overlapping cluster and fans them into progressive columns = cascade. The data isn't corrupt; because the display derives from `actualDuration` on every render, it re-formed on every opening of that day (structural recurrence risk).

**Design flaw:** `actualDuration`'s real purpose is "let an early-finishing service free the slot" (SHORTENING the card for squeeze-in). But the implementation was also LENGTHENING the card when the duration EXCEEDED the scheduled service — the inflation came from here.

**Fix (2026-06-27, PUSHED→CI `11318da`, `src/components/TimeGrid.jsx` +14/−7):** The checked-out duration is now `Math.min(scheduledDuration, actualDuration)` — the card can only SHORTEN (an early finish frees the slot), and can NEVER exceed the scheduled `svc.duration`. Identical in two places (render `:343` + `computeColumns :154`), otherwise the height/column diverge. **Squeeze-in not touched:** gap bands derive from `getBusyIntervals` → `getExistingRangeMinutes` + service processing-segments, don't see `actualDuration` → a service with processing can still be squeezed in. TENANT-AGNOSTIC (no flag, shared component) → applies to all tenants. Verified on localhost that the 20 June cascade is gone. Historical data untouched (the cap is at render time).

**Lessons:**
- **If a "duration" field drives card geometry, it must be one-directional.** `actualDuration` = an early-finish signal; it should only SHORTEN the slot. Allowing it to exceed the scheduled duration (late checkout) leads to visual overflow + fake overlap. Cap = `min(scheduled, actual)`.
- **The overlap/column engine (`computeColumns`) and card height must use the SAME duration source.** If they diverge, you get either an invisible overlap or a ghost cascade — apply the fix identically to both places.
- **A "the grid rose/shifted" complaint = a booking's height is greater than its real duration.** First look at that day's checked-out records' `actualDuration` (checkout delay), not at `startTime`/`time` shift.
- **actualDuration ≠ service duration.** When used in overlap/capacity/analytics calculations, always cap it with the scheduled duration (keep consistent with [[project_processing_time]] busy-slot v2).

---

## 2026-06-26 — A Treatwell prepaid booking showed "Pay at venue" + inflated commission revenue

**Severity:** 🟡 Medium (money/accounting + double-charge risk) · **Owner:** — · **Status:** ✅ Resolved
**Impact:** A prepaid £40 booking showed "Pay at venue" (double-charge risk) + counted as £40 gross revenue (net £23.20).
**Root Cause:** A global `paymentType` overrides the per-booking truth; the aggregator gross = net assumption (commission not modeled).
**Resolution:** A "Both (per booking)" mode + parser `twFeeTotal`/`twNetPayout` + Finance `platformFee()` automatic expense (DEPLOYED).
**Prevention:** A field that varies per-booking isn't shown by a single global setting; aggregator gross ≠ business net (commission+VAT must be modeled).

**What happened:** Jeremiah (T2185837725) paid prepaid £40 on Treatwell, but in the booking detail the payment showed as "Pay at venue" (staff might try to collect the money again). Also, when this booking was checked out, Finance/Reports recorded £40 gross revenue — whereas after the Treatwell first-customer commission (35% + VAT = £16.80) the business nets **£23.20** → revenue was inflated.

**Root cause #1 — a global setting overrides the per-booking truth:** Treatwell can be prepaid OR pay-at-venue PER-BOOKING (the email `Status` field says). But Settings → Platforms → Treatwell held a single **global** `paymentType` (set to `pay_at_venue`) and BookingDetailPanel read this global setting → so every Treatwell booking was drawn pay-at-venue. **Fix:** "Both (per booking)" was added to the toggle; if `both` is selected the UI draws by the booking's own `twPaymentMode` (the parser writes it from the email Status). whitecross was set to `both`.

**Root cause #2 — aggregator gross ≠ business net:** The parser/Finance never modeled the fee; the gross = net assumption. The Treatwell commission is deducted at source on prepaid (£23.20 lands), and invoiced separately on pay-at-venue — in either case the real net = gross − fee. **Fix:** the parser writes `twFeeTotal`/`twNetPayout` (35%+VAT); Finance counts the commission as an **automatic expense** via `platformFee()` (gross preserved, netRevenue/companyNetPL/bankBalance decrease); the Reports source card is net-after-fee; the booking detail (pre- and post-checkout) shows the fee breakdown.

**Verification notes (useful later):**
- Checkout PRESERVES the tw* fields (prepaid booking checkout → `paidAmount=0`, `paymentMethod=CARD`, `twFeeTotal` comes out right). When `paidAmount=0`, Finance `effectiveRevenue` falls back to `price` → the £40 gross is preserved.
- Finance derives the `dateKey` not from a stored field but from `startTime` (`Finance.jsx:158`) — so even if the parser doesn't write a dateKey, the booking shows.

**Lessons:**
- **If a platform varies per-booking, a single global-setting display misleads.** If a per-booking truth (a parser field) exists, use it; apply the global setting only in the "all the same" case (the "Both" model).
- **An aggregator's gross price ≠ business revenue.** If the commission (especially new-client + VAT) is not modeled, the books inflate revenue. Treat the commission as an automatic expense; keep the gross visible ([[project_whitecross_muhasebe]] two-ledger).

---

## 2026-06-26 — Whitecross web booking confirmation email not sending + success page blank — a MULTI-LAYER regression opened by the salOWN migration

**Severity:** 🟠 High · **Owner:** — · **Status:** ✅ Resolved
**Impact:** Confirmation email not sending on CONFIRMED web bookings; success.html detail + Add-to-Calendar blank.
**Root Cause:** 3 layers — a strict gate + the `BREVO_API_KEY` secret not bound on 4 functions + `sendBrevoEmail` empty `headers:{}` → Brevo 400. Success: auth-only rules → public read 403.
**Resolution:** The gate widened + the secret onto 4 fns + a headers guard; success `sessionStorage` fallback (DEPLOYED). GDPR: public booking read was NOT opened.
**Prevention:** When the sender strategy changes (Gmail→Brevo) grep all fn `secrets` lists; migration regressions are LAYERED, a new test after each fix; a public page can't read auth-gated data.

**What happened:** After the whitecross premium → salOWN tenant migration, confirmation emails were not sending on online bookings made from whitecrossbarbers.com (payment completed, CONFIRMED). Also, the success.html "Booking Confirmed" page wasn't showing the detail lines and the newly added Add to Calendar button (only the static card).

**Diagnostic method:**
1. Verified in Firestore with a real test booking + `salown-panel/serviceAccountKey.json` (havuz-44f70 admin SDK): status CONFIRMED, source Website, stripeSessionId PRESENT, clientEmail populated, no emailOptOut, `settings.emailConfirmationEnabled=true` → data intact, the problem is in the send.
2. `firebase functions:log --only salownBookingConfirmedEmailTrigger` → the trigger FIRES on every booking but gives `[whitecross] confirmationEmail error: ...`. The error message **changed after each fix** (a layered bug).
3. For success.html: a **token-less** read test via the REST API → `HTTP 403` (rules blocking), tenant root doc → 200. The public-read ban was confirmed.

**Root cause — email (3 successive layers):** In the migration, email sending was moved from whitecross-site (its own Gmail) → salown-app triggers; forced to whitecross Brevo (noreply@salown.com) via `FORCE_SALOWN_SENDER_TENANTS=['whitecross']`. But:
1. **The gate is too strict:** `salownBookingConfirmedEmailTrigger` `if(!after.stripeSessionId) return` (in the real flow stripeSessionId was present, so not the actual blocker, but it was still widened with `isOnlineSelfBooking`).
2. **The secret is not bound:** `salownBookingConfirmationTrigger` + `salownBookingConfirmedEmailTrigger` did NOT have `secrets:['BREVO_API_KEY']` → `sendBrevoEmail` threw "BREVO_API_KEY secret not set". The other email functions had the secret; these two (and the cancel/reschedule token functions) had been skipped.
3. **Empty headers:** `sendBrevoEmail` was putting `headers:{}` in the payload; because confirmation/cancel/reschedule sent no header, Brevo returned `400 "headers is blank"`.

**Root cause — success page:** success.html reads the booking client-side **without logging in** (`getDocs where bookingId`). The salOWN rules made booking read auth-only (`firestore.rules` `match /bookings/{docId}` → `isSuperAdmin()||isTenantAny()`) → the public query 403'd → `data` null (try/catch swallowed it) → neither detail nor button. The button code was correct; the problem was the public-read ban.

**Fix (2026-06-26, DEPLOYED):**
- functions (`firebase deploy --only functions:salown:<fn>`): the gate widened (`isOnlineSelfBooking`=source website/salown); `secrets:['BREVO_API_KEY']` added to **4 functions** (2 confirmation triggers + `salownCancelByToken` + `salownRescheduleByToken`); `sendBrevoEmail` adds headers only if populated (`Object.keys(headers).length>0`).
- success.html (gh-pages, commit 62ef765b): when the Firestore public-read 403's, a `sessionStorage.pendingBooking` (stored before going to Stripe, preserved on the same tab/origin) fallback → the lines + button fill from it; `buildCalendarUrl` parses date+time when startTime is absent. **GDPR: public booking read was NOT opened.** NOTE: a bare `?id=` URL doesn't work in a new tab (no sessionStorage), but it works in the real payment flow.

**Lessons:**
- **Trigger fires but no email = an early-return OR a send error.** Look in `functions:log` for the function's own `[tenant] ... error:` line; an empty log line = an early return. The error message gives the root cause directly — don't guess.
- **When the email sender strategy changes (Gmail→Brevo), grep the `secrets` list of ALL functions on that path.** A flag like `FORCE_SALOWN_SENDER_TENANTS` silently breaks functions that lack the secret.
- **Migration regressions are LAYERED:** one fix opens the next error. A new test + log after each fix; don't assume "this is the last layer".
- **A public page (success/cancel/manage) can't read auth-gated data.** When rules tighten, client-side public reads silently 403 (try/catch swallows → blank screen). Solution: use data the client already has (sessionStorage) OR a public Cloud Function returning a limited field set — **do NOT make the booking public-readable (GDPR).**
- **Diagnostic tools:** `salown-panel/serviceAccountKey.json` admin SDK read + REST API token-less read (rules test) + `firebase functions:log`.

---

## 2026-06-26 — A Treatwell booking didn't show in the grid (Arda T2185837725) — barber full-name matching

**Severity:** 🟡 Medium · **Owner:** — · **Status:** ✅ Resolved
**Impact:** The booking was written + a notification arrived, but it didn't show in any barber column ("data valid, UI invalid").
**Root Cause:** Treatwell full name ("Arda Uzun") ↔ system first name ("Arda"); the exact matcher didn't match + `barberName` wasn't written.
**Resolution:** `resolveBarberName()` in the parser (ambiguity-safe first-name map) + `barberName` write + phone regex fix (DEPLOYED).
**Prevention:** Notification present + no grid = a **display** problem (not create); matching is done not by fuzzy in the matcher but by mapping to the canonical name at source — [[feedback_barber_name_matching]].

**What happened:** A booking came from Treatwell for Arda (T2185837725, Jeremiah Lewis, 26 June 15:00, The Full Experience £40). The email landed, **a notification arrived too**, but it didn't show in any column in the Calendar grid. The owner suspected the phone format (`+1 510-228-6000`, a US number).

**Diagnostic method:** If a notification arrived the booking was **written** to Firestore (the notification trigger fires on booking create) → the problem is NOT parse-and-create, it's display. Verified in Firestore via the service account: the booking `status=CONFIRMED` exists but `barberId="arda uzun"`, `barberName=undefined`. The barber in the system is only `name="Arda"` (docId `barber-1777655430086`).

**Root cause — aggregator full-name vs system first-name:** Treatwell sends `with **Arda Uzun**` (full name) → the parser `barberId = barber.toLowerCase() = "arda uzun"`. `matchesBarber()` (case-insensitive exact, NO fuzzy per [[feedback_barber_name_matching]]) "arda uzun" ≠ "arda" → the booking falls into no barber column → invisible in the grid. **Secondary:** the Treatwell new-booking `set()` never wrote `barberName` (the only exception — Booksy/Fresha/Treatwell-reschedule all write it) → so there was no barberName fallback either. **Tertiary (independent):** the phone regex `[+\d][\d\s]+` stopped at the first `-` → it was saved truncated as `+1 510` (doesn't break the booking, just data loss).

**Fix (2026-06-26, DEPLOYED — `firebase deploy --only functions`):**
1. A NEW `resolveBarberName(rawName, barberCache)` helper: exact full-name match → else first-name match, but **ONLY if a single barber's first name matches** (if two barbers share the same first name it doesn't guess, returns raw). Instead of adding fuzzy to the matcher, **solve at source (parser)** — the principle is preserved.
2. At the start of the Treatwell parser loop, a `tenants/{tid}/barbers` cache fetch; `barber = resolveBarberName(rawBarber, barberCache)` (both new + reschedule benefit).
3. The missing `barberName: barber` was added to the Treatwell new-booking write.
4. Phone regex → `[+(]?[\d][-\d\s().]*\d` (captures an international number fully including `-`/parentheses).
5. The existing booking was fixed directly (script): `barberId=arda`, `barberName=Arda`, phone full → it showed in Arda's column. (Dedup `hasExternalIdMulti` meant it wouldn't re-parse.)

**Lessons:**
- **Notification arrived + not in grid = not a create but a DISPLAY problem.** First verify the doc in Firestore; don't assume "the parser blew up". If the trigger fired, the data is already written.
- **An aggregator's barber name format may not be the same as the tenant's** (Treatwell full name, system first name). Matching is solved NOT by fuzzy in the matcher, but by mapping to the canonical name in the parser ([[feedback_barber_name_matching]]: "wrong source name = fix the source").
- **Ambiguity protection is mandatory in first-name matching:** if more than one barber shares the same first name, don't guess, leave it raw — better invisible (diagnosable) than writing to the wrong barber.
- **`barberName` must be on every parser write** (the matcher fallback). If it's missing on one parser path, the grid match depends solely on `barberId` and is fragile — grep-verify all three parser writes.

---

## 2026-06-24 — Loyalty email not going to a specific client (Adam Wu) — corrupt address + stuck flag + propagation gap

**Severity:** 🟡 Medium · **Owner:** — · **Status:** ✅ Resolved
**Impact:** The loyalty email didn't go but the panel said "sent"; the retry never fired (optimistic-UI deception).
**Root Cause:** 3 chain — no email format validation (`gmailcom`) + the CF without try-catch → the flag stuck `true` + a client edit not propagating to the booking.
**Resolution:** `isValidEmail` on all inputs + try/catch flag reset + real status + Retry + batch propagate (commit `168bd35`/`9bf03a6`, DEPLOYED).
**Prevention:** Never optimistic "sent" for email (status from the server); an external API always in try/catch; retry `false→true`; the client identity is snapshotted to the booking → propagate on edit.

**What happened:** The loyalty email didn't go on Adam Wu's checkout. When "Send loyalty email" was pressed from the panel, the screen said "sent" but the email didn't go. At the same time an email went fine to another client sold to via Alex → the system is healthy overall, the problem is client-specific.

**Diagnosis:** The client email was entered corrupted — `adamwu838@gmailcom` (a **missing dot** in gmail.com). An invalid address → Brevo 400.

**Root cause (chain, 3 layers):**
1. **A corrupt address could be saved:** there was no email format validation at any entry point (only a "is it empty" check). `name@gmailcom` was accepted.
2. **The CF without try-catch → stuck flag:** `salownSendLoyaltyEmail` crashed while sending to Brevo; the line that resets the `sendLoyaltyEmail` flag to `false` never ran → the flag stayed **stuck `true`** on the booking. Because the function only fires on a `false→true` transition, pressing "Send" again NEVER triggered it (the panel says "sent", nothing happens — optimistic-UI deception).
3. **The client edit didn't propagate to the booking:** even if the email was corrected from the Clients page, the `clientEmail` in the booking document stayed old/corrupt → sending from the booking detail still went to the corrupt address.

**Fix (2026-06-24, DEPLOYED — commit `168bd35` + `9bf03a6` hosting, `salownSendLoyaltyEmail` functions deploy):**
1. `src/utils/email.js` (NEW `isValidEmail`) → format validation at all entry points: `BookingPage`, `AddClientModal`, `Clients` (edit), `WalkInForm`, `NewBookingSheet` (staff source pushed, bundle deferred).
2. `salownSendLoyaltyEmail`: a format rejection before sending (marks `loyaltyEmailBounced`) + `sendBrevoEmail` in `try/catch` → on failure resets the flag without crashing + records `loyaltyEmailError`. The stuck flag no longer forms.
3. `BookingDetailPanel`: the optimistic "sent" was REMOVED → the real status from the booking (live snapshot); on failure "⚠️ Couldn't send" + **🔄 Retry**; the manual trigger now writes `false` first then `true` → breaking the stuck flag.
4. `Clients.jsx handleEditClient`: a client edit now **batch-propagates to all assigned bookings** (matching by manualId / old email / old phone and updating `clientName/clientEmail/clientPhone`). Because the phone is stable, it catches the booking even if the email had already been corrected.

**Lessons:**
- **NEVER show an optimistic "sent" for email.** The real send result must come from the server (the flag); otherwise a failed send looks "successful" and the diagnosis is delayed for days.
- **An external API call (Brevo) is ALWAYS inside try/catch.** An uncaught error skips resetting the next idempotency flag → "stuck flag" → the function never fires again.
- **In a trigger-flag (`false→true`) design, a manual retry must write `false` first then `true`** — otherwise there's no exit from a stuck `true` state.
- **The client identity (name/phone/email) is snapshotted to the booking** → updating the client doc does not auto-update the bookings; on edit, match by the old identity and propagate to the bookings.
- **Input validation = the first line of defense.** If corrupt data never gets in, the crash scenarios in lower layers are never triggered either.

---

## 2026-06-24 — A Treatwell booking didn't land in the system (Muhamed T2185616487) — TWO back-to-back bugs

**Severity:** 🟠 High (**11 days** of all Treatwell new bookings lost) · **Owner:** — · **Status:** ✅ Resolved
**Impact:** The Treatwell new booking was never written to Firestore; all Treatwell new bookings between 13→24 Jun were silently lost.
**Root Cause:** `orderRef is not defined` (the 13 Jun refactor `96d6e7a` deleted the definition, left 3 uses → ReferenceError) + a half-done seen-skip fix.
**Resolution:** `const orderRef` restored + seen-skip fully removed in Fresha/Treatwell, Booksy parity (DEPLOYED).
**Prevention:** If a booking isn't landing, FIRST `functions:log`; a refactor-orphan → grep all uses of the variable (`node -c` doesn't catch a runtime error); when you find a bug in one parser, grep the other two too.

**What happened:** A new booking was made on Treatwell (T2185616487, Muhamed Kanidagli, 24 June 10:45, The Full Experience £40, Alex). The email landed in the salon Gmail but the booking was never written to Firestore — no trace in the Calendar. The same day a Booksy booking landed fine → so the problem is Treatwell-specific, NOT a shared one (Firestore rules/data).

**Diagnostic method (important):** Firestore couldn't be accessed without ADC; instead `firebase functions:log --only salownParseEmails | grep -i treatwell` was run → **`[whitecross] Treatwell parse error: orderRef is not defined`**. The logs gave the root cause directly. (If a booking isn't landing, look at the parser logs FIRST — don't guess.)

**Root cause #1 — `orderRef is not defined` (the ACTUAL cause, a refactor-orphan):** The original code (commit `7f94588`, 2026-06-05) defined `const orderRef = refMatch ? refMatch[1] : ...` and derived `externalId` from it. **The 2026-06-13 refactor (commit `96d6e7a` "source")** simplified `externalId` to `TREATWELL-${refMatch[1]}` and deleted the `const orderRef` line — but did NOT DELETE the 3 places that used `orderRef` (`treatwellRef: orderRef` + the reschedule map push). The orphaned variable threw a `ReferenceError` on every Treatwell new-booking + reschedule `set()`. Try/catch caught it and put it in `result.errors`, and the booking silently dropped. **For 11 days (13→24 June) all Treatwell new bookings were lost.**

**Root cause #2 — seen-skip (mask/secondary):** The Treatwell parser (`:2279`) skipped a read new booking with `if (seen && !isCancellation && !isReschedule) { skip }`. It was triggered when the owner opened the email in Gmail. This is a Treatwell recurrence of the 2026-06-20 "Damian 21 June" (Bug Pattern #8) incident. On 2026-06-20 seen-skip was FULLY removed in Booksy but the same commit (`472fbec`) added only a `&& !isReschedule` exception to Fresha + Treatwell — a half fix. The comment said "No seen-skip for reschedules/cancels", and it was assumed "done".

**Fix (2026-06-24, both):**
1. The `orderRef` definition was restored: `const orderRef = refMatch[1];` right below `externalId` (`functions/index.js:2293`).
2. seen-skip was fully removed in Fresha (`:1978`) + Treatwell (`:2279`), Booksy parity. `grep "if (seen"` → zero remnants.
- `node -c` OK. `firebase deploy --only functions --project havuz-44f70` DEPLOYED (twice transient "Internal error", passed on retry).

**Lessons:**
- **If a booking isn't landing, look at `functions:log` FIRST.** The logs said `orderRef is not defined`; instead of struggling with guesses, the root cause in 1 command.
- **Refactor-orphan:** When changing a variable's definition/name, grep ALL its uses (`grep -n "orderRef" functions/index.js`). Definition deleted but use remained = a silent ReferenceError. `node -c` doesn't catch this (a runtime error), only running/lint catches it.
- **Parser isolation:** Each parser is a separate function; a refactor in one doesn't affect another, but the SAME bug pattern (seen-skip, orderRef-type definitions) recurs in all. When you find a bug in one parser, grep the same line in the other two.
- **The danger of a half fix > no fix:** when applying a fix to multiple parsers, physically verify all three; "there's a similar comment" ≠ "the same behavior".

---

## 2026-06-22 — Barber revenue "NaN" in Team Members (Arda)

**Severity:** 🟢 Low (single screen) · **Owner:** — · **Status:** ✅ Resolved
**Impact:** Arda's revenue value showed as `£NaN` in Team Members.
**Root Cause:** `parseFloat("£20.00")` → NaN (a currency-symboled string, an import remnant); a single NaN poisons the whole sum.
**Resolution:** The `pp()` canonical money-parser + a same-class sweep (commit `198ffde`).
**Prevention:** Firestore money fields aren't summed with raw `parseFloat`/`Number`; always `pp()`/`parsePrice()` or a `(Number(x)||0)` guard.

**What happened:** On the salown-app → Team Members (Barbers.jsx) screen, Arda's revenue value showed as `£NaN`.

**Root cause:** `src/pages/Barbers.jsx:88` summed revenue with `parseFloat(bk.price || 0)`. In at least one of Arda's bookings the `price` field is not numeric but a currency-symboled string (`"£20.00"` — a Booksy/Fresha import remnant). `parseFloat("£20.00")` → `NaN`; a single NaN turns the whole sum into NaN, and `.toFixed(0)` → `"NaN"`. That's why only a barber who has that kind of booking was affected.

**Fix (2026-06-22):**
1. The canonical money-parser `pp()` (`src/utils/bookingUtils.js`) was imported — it strips `£`/commas, and swallows a NaN result with `|| 0`.
2. `parseFloat(bk.price || 0)` → `pp(bk.price)`.

**Lesson:** Money fields in Firestore (`price`, `paidAmount` …) must not be summed or displayed with raw `parseFloat`/`Number()` — imported data can have currency-symboled/empty strings. Always use `pp()`/`parsePrice()` or guard with `(Number(x)||0)`; a single NaN poisons the whole sum.

**Sweep (same day):** All money reads were scanned, the remaining places of the same class were closed (commit `198ffde`): `BookingPage.jsx` + `SalonSitePage.jsx:475` + `Products.jsx:222` customer-facing `Number(price).toFixed()` → `(Number(price)||0)`; `Finance.jsx` tip sums → `parsePrice(b.tip)`. The rest of the reads are already canonical (`replace(/[£,]/g,'')||0`) or Finance-owned numeric.

---

## 2026-06-20 — Damian Adams-Peatling: a backward reschedule + a chained-reschedule collapse

**Severity:** 🟠 High · **Owner:** — · **Status:** ✅ Resolved
**Impact:** The booking never landed → then the chained reschedule (31 Jul→1 Jul) wasn't applied, the booking stuck on 31 Jul.
**Root Cause:** 3 layers — seen-skip booking loss + string-parse ID breakage on a multi-word name + a "always a future date" direction assumption.
**Resolution:** Remove Booksy seen-skip + a clean `oldDate`/`oldTime` query + a `lastRescheduleEmailMs` ordering guard (`0a03411`/`42def41`).
**Prevention:** A reschedule is DIRECTION-INDEPENDENT (the newest email time wins); a "seen" email doesn't turn into a booking loss (an idempotency guard); a derived-ID string parse breaks on a multi-word name.

**What happened:**
1. Damian made a **Cut Deluxe** booking on Booksy, for 21 June.
2. The booking **never landed in the system at first** — no trace in Firestore, no error either.
3. Then Damian moved the booking **21 June → 31 July** (reschedule). The system applied this.
4. We said with Arda "the gap is more than 5 weeks, is this guy testing us?"; we called. The customer
   said "something came up, it was a mistake". We said let's move it to **1 July**. Per the salOWN rule we told him the
   reschedule must be done **by the customer himself on Booksy**.
5. Damian himself moved it **31 July → 1 July** — i.e. for the first time to an **EARLIER** date.
6. This last reschedule **was not applied**; the booking stuck on 31 July.

**Root causes (three separate layers):**
- **(Step 2) Seen-skip booking loss:** The confirmation email had been **opened** in Gmail (seen) before the parser (5-min period) ran.
  `if (seen && !isCancellation) skip` silently dropped the read new booking.
- **(Step 6) Chained-reschedule broken matching:** When the booking moved 21Jun→31Jul the doc still carried its original
  ID. For the second reschedule (31Jul→1Jul) the booking had to be found by its current date/time;
  the old fallback tried to split the `oldExternalId` string to extract the date, and
  the split **broke on the multi-word name "Damian Adams-Peatling"** → the booking couldn't be found.
  Also that email was seen too → problem C stacked on top.
- **(Design flaw) Direction assumption:** The reschedule logic was designed with the assumption the customer would **always move to a future date**.
  The correct criterion is **the arrival time of the newest email (`emailDateMs`)** — not the direction of the booking
  date. A backward reschedule (1 July) broke this assumption.

**Fixes (2026-06-20, commit 0a03411 + 42def41):**
1. **C** — seen-skip was fully removed in Booksy (every path idempotent). A new booking and a reschedule are processed
   even if read/seen. (In Fresha/Treatwell only for reschedule for now — new booking still open, see PARSER_NOTES #8.)
2. **A** — a clean `oldDate`/`oldTime` is carried from the reschedule email and the live booking is found by `where date==/time==`;
   the fragile string parse was removed (Booksy-specific).
3. **B** — `lastRescheduleEmailMs` ordering guard: an old/delayed email can't overwrite a newer one (all three parsers).
4. The misleading `"higher date wins"` comments (Fresha/Treatwell) were corrected to "the newest email wins".

**Verified:** A parser run automatically pulled the 31 July→1 July, with no user intervention. ✅

**Lessons:**
- A reschedule is DIRECTION-INDEPENDENT — earlier/later doesn't matter, always look at the newest email's time.
- Never turn a "seen" email into a booking loss — idempotency guards replace seen-skip.
- A string parse over a date/time-derived ID = breaks on a multi-word name; if there's no stable ref, query
  the booking by its current date/time.

---

## 2026-06-17 — Jakov Zorić Duplicate Booking

**Severity:** 🟡 Medium · **Owner:** — · **Status:** ✅ Resolved
**Impact:** The same Booksy reservation was written to Firestore as two different docs.
**Root Cause:** Two parsers read the same inbox (Gmail API + IMAP), producing different `externalId` (base64 decode was missing); the Gmail API doesn't set `\Seen`.
**Resolution:** `extractTextFromRaw` base64 fix + slot tombstone + whitecross-site Booksy parser disabled.
**Prevention:** If two parsers read the same inbox, the `externalId` formats must match exactly; the tombstone = the last safety net.

**What happened:** The same Booksy reservation was written to Firestore as two different docs.

**Root cause:** `parseBooksyConfirmations` (whitecross-site, Gmail API) and `salownParseEmails` (salown-app, IMAP) were running at the same time. The Gmail API doesn't set the `\Seen` flag, so IMAP saw the same email again. The two parsers produced different `externalId`:
- Gmail API: `BOOKSY-1780000805806` (correct base64 MIME part decode)
- IMAP: `BOOKSY-Jakov-Zorić-29-May-2026-15:30` (no base64 decode, the booking# not found)

**Fixes (2026-06-17):**
1. `extractTextFromRaw` now pulls the `text/plain` MIME part first and does a base64-decode
2. Slot tombstone: on every successful Booksy import a `parserTombstones/SLOT-Booksy-{date}-{time}`
3. `parseBooksyConfirmations` + `parseBooksyCancellations` disabled in whitecross-site

**Lesson:** If two parsers read the same inbox, the externalId formats must match exactly. The tombstone = the last safety net.

---

## GitHub Key Exposure

**Severity:** 🔴 Critical (secret leak) · **Owner:** — · **Status:** ✅ Resolved · **Date:** ⚠️ not in the record
**Impact:** `serviceAccountKey.json` was pushed to GitHub (admin SDK credential leak).
**Root Cause:** The key was not in `.gitignore` / was committed by mistake.
**Resolution:** Key revoked + a new key created.
**Prevention:** `serviceAccountKey.json` is never committed, must be in `.gitignore`.

**What happened:** `serviceAccountKey.json` was pushed to GitHub.

**Resolution:** The key was revoked, a new key was created.

**Rule:** `serviceAccountKey.json` is never committed to git. It must be in `.gitignore`.

---

## Notlar

- `checkDuplicateInFirestore` (whitecross-site script.js:471): under locked rules it fails-open — acceptable, the booking continues.
- `salownGetBusySlots` + `salownRescheduleByToken`: skip expired PENDING bookings (`expiresAt < now`) — abandoned Stripe sessions don't ghost-block a slot for 0-20 min.
