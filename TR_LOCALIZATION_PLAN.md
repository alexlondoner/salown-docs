# TR Localization Plan — Gap Analysis & Roadmap

> **Status:** 🔵 Planned (analysis complete 2026-07-23, no code changes yet).
> **Goal:** make salOWN usable by a Turkish salon (Turkish UI, ₺/TRY, `Europe/Istanbul`, 24-hour time, Turkish emails).
> **Method:** two parallel code-audit agents (frontend `src/` + `src/staff/`; backend `functions/src/` + `hosting/`), 2026-07-23.

---

## TL;DR

The app has **zero localization infrastructure**. There is no i18n library, no central strings file, no `navigator.language` detection (the "follows browser language" impression is false — every date format is hardcoded `'en-GB'`). Making the app usable in Turkish is **not a config toggle; it is a from-scratch i18n build**.

Scale of the hardcoding:

| Metric | Count |
|---|---|
| User-facing English strings (frontend) | ~1,500–2,000 (regex floor: 1,217 multi-word literals) |
| Hardcoded `£` occurrences (frontend) | 486 across 52 files |
| Hardcoded `'en-GB'` locale literals (frontend) | 110 across 38 files |
| Hardcoded `Europe/London` (frontend + functions) | ~45 sites |
| Hand-rolled English day/month name arrays | ~25 declarations (some used for **parsing**, not just display) |
| Toast/confirm/alert/error message sites | 268 |
| `placeholder=` / `title=` / `aria-label` / `alt=` English attributes | 155 / 79 / 9 / 8 |

**The single biggest structural blocker:** there is **no per-tenant `language` / `currency` / `timezone` field anywhere** — neither on `tenants/{id}` root nor `settings/settings`, and neither public projection (`_buildPublicProfile` / `_buildPublicBooking`) carries one. Even if everything else were ready, the code has no variable to key localization off.

---

## 1. Foundational gap — tenant locale fields (prerequisite for everything)

- No `language`, `currency`, `timezone` field exists in tenant data (confirmed by grep across `functions/src`).
- Insertion point: tenant root doc or `settings/settings`, then threaded through:
  `_loadEmailContext` → email template builders → all `toLocaleDateString`/`toLocaleTimeString` sites → Stripe session creation → `_buildPublicProfile`/`_buildPublicBooking` (so the public booking SPA can learn the tenant's language).
- The migration seam is already marked in code: `src/staff/lib/dateRange.ts:19` — `const TENANT_TZ = 'Europe/London'` with a comment saying "when non-UK tenants land, add tenants.timezone".

## 2. Frontend (panel + staff app + booking SPA)

### 2.1 UI strings
- No i18n library (`package.json` deps: firebase, qrcode, react, react-dom, react-router-dom — nothing else). No central strings file; everything inline in JSX / template literals / `alert()`/`confirm()` / attributes. Only string map found: status labels in `src/components/badges/StatusBadge.tsx`.
- Heaviest surfaces: `BookingDetailPanel.tsx` (2,215 lines), `Finance.tsx` (2,149), `Settings.tsx` (2,006), `OnlineProfile.tsx` (1,597), **`BookingPage.tsx` (1,500 — customer-facing, highest TR priority)**, plus `Barbers/CheckoutPanel/Dashboard/WalkInForm/Clients/Marketing` (~1,100–1,230 each).
- Several messages embed English grammar in interpolation (`${n} recipient(s)`, possessives, word order) — Turkish suffix/plural rules mean plain string swap is not enough; ICU-style message formatting is needed for those.

### 2.2 Dates & times
- 110 hardcoded `'en-GB'` (plus some `'en-US'`/`'en-CA'`) literals; never browser-default, never a variable.
- ~25 hand-rolled `['Mon','Tue',...]` / `{January: 0, ...}` arrays bypass `Intl` entirely — they render English regardless of locale. **Dangerous subset:** `src/firestoreActions.ts:302,392,437` use English month-name maps for **parsing** (data layer, not display).
- Time display uses `en-US` + `hour12: true` (AM/PM) in places — Turkey uses 24-hour.
- `isUkDst` / UK-DST helpers are hand-rolled; Turkey has **no DST since 2016** (fixed UTC+3) — DST logic must become tenant-timezone-aware.
- No date library (no date-fns/dayjs/moment) — nothing to hang a locale config on; all native `Date` + `Intl`.

### 2.3 Money
- No central formatter: 9+ divergent hand-rolled `£` helpers + 486 inline `£`.
- **Data-layer leak:** some paths store/parse money as `£`-prefixed strings — `src/pages/Clients.tsx:846` strips `'£'` from stored values; `src/firestoreActions.ts:57`. The symbol has leaked into stored data, so this is a data migration, not just a display fix.
- No per-tenant currency field anywhere. Target: single `formatMoney(amount, tenant.currency)` using `Intl.NumberFormat` (`₺`, `tr-TR` comma decimals).

### 2.4 Phones
- Country-code dropdown **already includes `+90`** (`src/components/BookingForm.tsx:49`) — good foundation.
- But defaults are hardcoded `+44` (`BookingForm.tsx:63,78,85,320`) and placeholders are UK-format (`"7700 000000"`, `"+44 7..."` in WalkInForm/BookingPage/Signup/Settings).
- Validation is length-only (≥10 digits) — already TR-compatible.

### 2.5 Shell & auth
- `index.html` / `staff.html`: `lang="en"`, meta description says "UK salons and barbers", English splash-screen text baked into `staff.html`.
- `src/firebase.ts:19` — `auth.languageCode = 'en'`: Firebase auth emails (password reset etc.) go out in English; `'tr'` is supported by Firebase, should follow tenant language.

### 2.6 Good news
- The old 21-service hardcoded list is **gone from `config.ts`** (`services: []`) — the service catalog is runtime-loaded from Firestore. A TR tenant enters Turkish service names as data; no code change needed there.
- English weekday keys in `config.hours` (`Monday`...`Sunday`) are **structural keys**, not display — keep them English internally, localize only rendering.

## 3. Backend (`functions/src`)

### 3.1 Emails (Brevo)
- Entire template library `emailTemplates.ts` (624 lines) is hardcoded English HTML builders ("Your Appointment", "Your booking is cancelled", "points earned", unsubscribe footers…). A second, older inline template set (loyalty card) duplicated in `index.ts:900–1035`.
- All subject lines are English string interpolation (`Booking Confirmed — …`, `Reminder — …`, `Your spot is still warm — …`) — no lookup table, no `lang` parameter anywhere in `sendBrevoEmail`/builders.
- Hardcoded policy copy (`'Free cancellation up to 8h before…'`, `emails/index.ts:204`) and a **hardcoded UK WhatsApp support number** baked into an email (`index.ts:287`).

### 3.2 Dates/timezone server-side
- ~30 sites, all `'en-GB'` + `Europe/London`: reminder/re-engagement crons (`notifications/index.ts`), loyalty receipts, iCal generation (`X-WR-TIMEZONE:Europe/London`, `index.ts:1632`), day-key helper `utils/parserTime.ts:67` (UK-DST aware), nightly backup cron schedule.

### 3.3 Currency
- Stripe: `index.ts:3377` `currency: 'gbp'` hardcoded (only currency in the codebase). Note `features.stripe` is currently OFF, so not an immediate blocker — but **Stripe does not onboard Turkey-resident businesses**; a real TR market entry needs a local PSP evaluation (iyzico/PayTR) or TR tenants stay on pay-at-venue.
- `£` hardcoded in loyalty template copy ("Every £1 earns 1 point") and `finance/exit.ts` (Whitecross-specific single-tenant English settlement doc — out of TR scope).

### 3.4 Parser & phones
- **Out of TR scope by owner decision (2026-07-23): no TR tenant will use the parser pipeline.** salOWN is the single booking source in the TR market; tenants on other systems get a one-way iCal feed instead. So the UK-only Fresha phone regex (`parsers/fresha.ts:115`, `/(?:\+44|0)…/` — would never match `+90 5xx`) needs **no change** for TR.
- Core client-identity matching key is last-10-digits (`clients/identity.ts:110`) — country-neutral in principle, untested with TR numbers.
- No SMS channel exists at all (nothing to localize there).

### 3.5 askAI
- System prompt hardcodes `"Use £ (GBP) for all monetary values"` and injects TODAY/YESTERDAY as `en-GB`/`Europe/London` strings (`ai/askAI.ts:39-50`). Mitigating: prompt says "answer in the language the user writes in" — Turkish questions get Turkish answers, but with £ amounts and UK dates.
- `ai/productGuide.ts` describes the UI with English labels — once the UI is Turkish, "how do I…" answers will mismatch the screen; needs a TR variant.

### 3.6 Legal
- Unsubscribe/loyalty T&C copy inline English; GDPR-framed. TR market requires **KVKK** (Turkish data-protection) equivalents and translated consent copy.

## 4. Marketing site (`hosting/`)

All hand-authored landing pages (`index.html`, `features.html`, `vs-*.html`, …) are English, `lang="en"`, no `hreflang`/`og:locale`, meta explicitly says "UK". Needed only for TR **market entry** (a `/tr/` tree or translations) — not a blocker for a TR tenant using the product.

---

## Recommended sequence (dependency order)

1. **Tenant locale triplet** — add `language`/`currency`/`timezone` to tenant settings + both public projections + a Settings picker UI. *Prerequisite for everything below.*
2. **Central `formatMoney` + `formatDate`/`formatTime` helpers** reading tenant locale; migrate 486 `£`, 110 `'en-GB'`, ~25 day/month arrays onto them. Includes a **data fix** for `£`-prefixed stored strings and the English month-name parse maps in `firestoreActions.ts`.
3. **i18n infrastructure** (suggested: `react-i18next`; ICU messages for pluralized/interpolated strings) + string extraction. Order: customer-facing surfaces first (`BookingPage`, `ManageBooking`, transactional emails), then panel, staff app last.
4. **Email `lang` parameter** through `_loadEmailContext` → template builders + TR string catalog + `auth.languageCode` from tenant language.
5. **Timezone/DST** — migrate `isUkDst`/`parserTime` to tenant-tz (TR side is easy: fixed UTC+3, no DST).
6. **Small items** — `+44` defaults & UK placeholders, `lang` attributes & meta, splash text, askAI GBP rule → tenant currency, `productGuide` TR variant, KVKK legal copy. *(Parser `+90` fix dropped — no parsers in the TR market, see §3.4.)*

**Minimum viable TR pilot:** items 1 + 2 + Turkish translation of customer-facing surfaces (booking SPA + transactional emails). The admin panel can stay English for a pilot — the salon customer never sees it.

**Effort ballpark:** items 1–2 are a few focused days; item 3 (string extraction + translation of ~1,500+ strings) is by far the largest line item.
