# INVARIANTS.md — breaks the system if violated

> **What this file is:** the **invariants** the code must always obey. Each one was born from a past incident, a design decision, or a hard rule.
>
> **How to use it:** BEFORE touching a related area (money math, dates, booking writes, parser, email, rules...) read the relevant section here. If you're going to break an invariant it must be a **conscious decision** — write the reason in [DECISIONS.md](DECISIONS.md), don't slip it in as a one-line "fix".
>
> **Related files:** intentional oddities → [KNOWN_QUIRKS.md](KNOWN_QUIRKS.md) · why-decisions → [DECISIONS.md](DECISIONS.md) · past accidents → [INCIDENTS.md](INCIDENTS.md) · detailed rules → [BUSINESS_RULES.md](BUSINESS_RULES.md) / [NORMALIZATION.md](NORMALIZATION.md) / [SECURITY.md](SECURITY.md).

**Source abbreviations:** `INC <date>` = INCIDENTS.md record · `CLAUDE §X` = salown-app/CLAUDE.md section · sibling document names are linked.
**Fragility:** 🔴 breaks → live outage/data-money/security · 🟠 feature breaks · 🟡 wrong display/silent data loss.

---

## Contents
1. [Money & Accounting](#1-money--accounting)
2. [Date & Time (UK)](#2-date--time-uk)
3. [Booking Model](#3-booking-model)
4. [Barber & Client Matching](#4-barber--client-matching)
5. [Email & Notification](#5-email--notification)
6. [Security & GDPR](#6-security--gdpr)
7. [Deploy](#7-deploy)
8. [Multi-tenant](#8-multi-tenant)
9. [Parser](#9-parser)
10. [Channel Synchronization (iCal OUT)](#10-channel-synchronization-ical-out)

---

## 1. Money & Accounting

| ID | Invariant | If broken | 🔴 | Source |
|----|----------|-----------|----|--------|
| INV-PARA-1 | Firestore money fields (`price`, `paidAmount`, `tip`…) are NEVER summed with raw `parseFloat`/`Number` → `pp()` / `parsePrice()` or a `(Number(x)\|\|0)` guard | Import residue `"£20.00"` → `NaN`; **a single NaN poisons the whole total** | 🟡 | INC 2026-06-22 · CLAUDE §Money |
| INV-PARA-2 | `paidAmount` = **gross collection** (tip included), NOT revenue. For revenue use `− pp(tip)` or `bookingNetWithoutTip` | Tip mixes into revenue; screens don't add up; the HMRC-meaningful figure is wrong | 🟡 | INC 2026-06-28 |
| INV-PARA-3 | `paidAmount` (deposit) + `platformDepositAmount` are **NOT RESET** on edit/reschedule | The paid deposit is lost, requested from the customer again | 🟠 | CLAUDE §Money / §Reschedule |
| INV-PARA-4 | A tip is never revenue; the card/cash tip distinction is made from `tipPaymentMethod` (not from the service `paymentMethod`) | "Paid by card, tip in cash" → the card-tip total is wrong | 🟡 | INC 2026-06-28 |
| INV-PARA-5 | Aggregator gross price ≠ business net; commission (+VAT) is modelled as an **automatic expense**, gross stays visible | The books inflate revenue | 🟡 | INC 2026-06-26 (Treatwell) · [accounting](../salown-app) |
| INV-PARA-6 | `pp()` **preserves** negative values (refunds) — no clamping | Refunds are lost/turn positive | 🟡 | CLAUDE §Money |

## 2. Date & Time (UK)

| ID | Invariant | If broken | 🔴 | Source |
|----|----------|-----------|----|--------|
| INV-DATE-1 | NEVER `date.toISOString().split('T')[0]` → `toDateKey()` (`src/utils/timeUtils.js`) | In BST (summer time) the day **shifts by one day** → booking lands on the wrong day | 🟠 | CLAUDE §Dates · [BUSINESS_RULES](BUSINESS_RULES.md) |
| INV-DATE-2 | UK DST calculations via the `isUkDst` helpers (last Sunday of March/October, 01:00 UTC) | Time shifts ±1h | 🟡 | CLAUDE §Dates |

## 3. Booking Model

| ID | Invariant | If broken | 🔴 | Source |
|----|----------|-----------|----|--------|
| INV-BK-1 | **A business rule must exist on ALL paths that write/carry to data** (booking + reschedule + walk-in). When adding a new constraint, grep all write paths | One path skips the rule → inconsistent/ghost record | 🟠 | INC 2026-06-29 (ghost booking) |
| INV-BK-2 | The barber availability constraint is both shown in the UI and **rejected server-side** (an off-day booking cannot be written) | UI bypass + grid invisibility = unmanageable record | 🟠 | INC 2026-06-29 |
| INV-BK-3 | Reschedule is **direction-independent** — always **the arrival time of the newest email** wins (not the direction of the booking date) | A backward/earlier reschedule is not applied, the booking sticks at the old date | 🟠 | INC 2026-06-20 |
| INV-BK-4 | Reschedule conflict check (`hasTimeConflict(..., ignoreBookingId)`) **BEFORE** save; `barberValue` **lowercased**; `barberId = barbers.find(b=>b.name===sel).id` (don't fabricate from the display name) | Double-booking or assignment to the wrong barber | 🟠 | CLAUDE §Reschedule · [BUSINESS_RULES](BUSINESS_RULES.md) |
| INV-BK-5 | `actualDuration` ≠ service duration (the moment checkout is pressed). In geometry/overlap/capacity always cap with `min(scheduledDuration, actualDuration)` — the card can only SHRINK | A late checkout inflates the card → fake cascade/overlap | 🟡 | INC 2026-06-27 · [processing-time](BUSY_SLOT_V2.md) |
| INV-BK-6 | Slot generation: last bookable start = closing − 15min (`LAST_START_GAP_MINS`). The `start + duration <= close` check is **not brought back** (spillover analytics is in use) | Slots are cut wrong or spillover data is corrupted | 🟡 | CLAUDE §Slot |
| INV-BK-7 | Status always uppercase-normalized on load (`normalizeBookingStatus`). Blocking statuses: `CONFIRMED, PENDING, UNPAID, BLOCKED` | Lowercase `checked_out` from import escapes the filters | 🟡 | CLAUDE §Booking · [status norm](FIRESTORE_SCHEMA.md) |
| INV-BK-8 | `booking.duration` gets `parseInt()` before the service lookup | String duration → wrong/missing service match | 🟡 | CLAUDE §Booking |

## 4. Barber & Client Matching

| ID | Invariant | If broken | 🔴 | Source |
|----|----------|-----------|----|--------|
| INV-MATCH-1 | Barber matching is **exact case-insensitive** (`barberKey()`); NO partial/substring/first-word fallback. Wrong source name → **fix it at the source** | Aggregator full-name ("Arda Uzun") ≠ system ("Arda") → booking invisible | 🟡 | INC 2026-06-26 · [matching policy](NORMALIZATION.md) |
| INV-MATCH-2 | First-name matching in the parser is **ambiguity-safe**: if two barbers share the same first name, don't guess, leave raw | Booking written to the wrong barber (silently) | 🟡 | INC 2026-06-26 |
| INV-MATCH-3 | `barberName` must be written on EVERY parser write (matcher fallback) | Grid matching stays bound to a single `barberId`, fragile | 🟡 | INC 2026-06-26 |
| INV-MATCH-4 | Client lookup order: `clientManualId` → exact phone/email → `_aliases` → normalized phone (last 10 digits) → **name-only fallback (LAST resort)**. When phone/email is present, NEVER match by name alone | Booking/history bound to the wrong client (GDPR + data) | 🟠 | CLAUDE §Client identity |
| INV-MATCH-5 | When phone/email changes, the old value is added to `_aliases` via `arrayUnion` | Booking history is severed | 🟡 | CLAUDE §Client identity |
| INV-MATCH-6 | Client edit → **batch propagate** to all assigned bookings (client identity is snapshotted onto the booking) | Client doc is current, booking stays old/broken → email to the wrong address | 🟡 | INC 2026-06-24 |
| INV-MATCH-7 | Phone "last 4 digits" is not used as a match key on its own | Different people collide | 🟡 | [parser standard](NORMALIZATION.md) |

## 5. Email & Notification

| ID | Invariant | If broken | 🔴 | Source |
|----|----------|-----------|----|--------|
| INV-MAIL-1 | NEVER show an optimistic "sent" in email — the real state comes from the server (flag/live snapshot) | A failed send looks "successful", diagnosis is delayed for days | 🟡 | INC 2026-06-24 |
| INV-MAIL-2 | An external API (Brevo) call is ALWAYS inside try/catch; on failure reset the idempotency flag | Uncaught error → **stuck flag** → the function never fires again | 🟠 | INC 2026-06-24 |
| INV-MAIL-3 | In a trigger flag (`false→true`) design, a manual retry writes `false` first then `true` | No way out of a stuck `true` | 🟡 | INC 2026-06-24 |
| INV-MAIL-4 | `isValidEmail` (format) at all email entry points — "is it empty" alone is not enough | `name@gmailcom` gets saved → Brevo 400 chain | 🟡 | INC 2026-06-24 |
| INV-MAIL-5 | `client.emailOptOut !== true` check before sending email (GDPR); unsubscribe on every email → `salownEmailOptOut` | GDPR violation | 🔴 | CLAUDE §Email |
| INV-MAIL-6 | When the sender strategy changes (Gmail→Brevo), grep the `secrets` list of ALL functions on that path (`BREVO_API_KEY`) | A fn without the secret breaks silently | 🟠 | INC 2026-06-26 |

## 6. Security & GDPR

| ID | Invariant | If broken | 🔴 | Source |
|----|----------|-----------|----|--------|
| INV-SEC-1 | Booking `get`/`list`/`update` = auth-only. `create` = public but **financial fields blocked**. Cancel/reschedule = server-side callable only | Unauthorized read/write, price manipulation | 🔴 | CLAUDE §Security · [SECURITY.md](SECURITY.md) |
| INV-SEC-2 | A booking is **NEVER made public-readable** (GDPR). A public page (success/cancel/manage) gets the data from `sessionStorage` or a limited-field callable | All customer PII is exposed to the world | 🔴 | INC 2026-06-26 |
| INV-SEC-3 | `tenants/{id}` root doc is **world-readable** → NEVER put a secret in it; telegram/stripe token → `settings/integrations` subdoc; public data → `tenants/{id}/public/{doc}` projection | Secret leak | 🔴 | [tenant root public](MULTI_TENANT_NOTES.md) |
| INV-SEC-4 | Deploy order (security change): **functions → hosting → rules LAST**. Fetch the live rules from the API first, map the paths | Blind rules change broke booking create/reschedule/settings read (in the past) | 🔴 | CLAUDE §Commands · [rules safety](SECURITY.md) |
| INV-SEC-5 | Delete operations (at this stage) are ONLY super-admin (`isSuperAdmin` claim) — everyone, including owners, lost it (pilot) | Privilege escalation / data loss | 🔴 | [DECISIONS.md](DECISIONS.md) · INC 2026-07-02 |
| INV-SEC-6 | `serviceAccountKey.json` is NEVER committed to git (it's in `.gitignore`) | Admin SDK credential leak | 🔴 | INC (Key Exposure) |
| INV-SEC-7 | Bulk Firestore delete: export → dry-run CSV → owner approval → write. Never a blind bulk-delete | Irreversible data loss | 🔴 | CLAUDE §Commands |

## 7. Deploy

| ID | Invariant | If broken | 🔴 | Source |
|----|----------|-----------|----|--------|
| INV-DEP-1 | salown-app single deploy source = `hosting/`. EVERY `firebase deploy` that skips build deletes the bundle → `firebase.json` **predeploy hook** guarantees it | The whole SPA (login/signup/book/manage) falls to 404 | 🔴 | INC 2026-06-29 · [ci gap](../salown-app) |
| INV-DEP-2 | Before deploy **state** the tenant + URL, **wait for confirmation** | Deploy to the wrong target/old version | 🟠 | CLAUDE · [deploy safety](DEPLOY.md) |
| INV-DEP-3 | `git status` + `git log origin/main..HEAD` before every edit | Overwriting someone else's uncommitted work/unpushed commit | 🟠 | CLAUDE §Process |
| INV-DEP-4 | **Multi-session:** commit/deploy only your own file with an **explicit path**. NEVER `git add .` / `git restore .` / `git checkout .` / `git reset --hard` | Another session's uncommitted work is deleted | 🔴 | [git isolation](DEPLOY.md) |
| INV-DEP-5 | The single live source of the landing is `salown-app/hosting/index.html` (the symlink in DEPLOY.md is BROKEN) | Landing reverts to old / change is lost | 🟡 | [landing source](DEPLOY.md) |
| INV-DEP-6 | Post-deploy smoke test: if critical routes don't return 200 the deploy fails (see INC 2026-06-29 curl block) | Silent outage goes unnoticed for weeks | 🟠 | INC 2026-06-29 |

## 8. Multi-tenant

| ID | Invariant | If broken | 🔴 | Source |
|----|----------|-----------|----|--------|
| INV-MT-1 | New salown-app trigger → add a **self-managed tenant guard** | The trigger fires on all tenants, can't be isolated | 🟠 | CLAUDE · [MULTI_TENANT_NOTES.md](MULTI_TENANT_NOTES.md) |
| INV-MT-2 | A feature flag is always read from the tenant doc, not hardcoded | One tenant's flag spreads to everyone | 🟠 | CLAUDE §Feature flag |
| INV-MT-3 | `Reports.jsx` is platform-wide (NO hardcoded tenant-specific name); `Finance.jsx` is whitecross-only for now. Don't mix the two | One tenant's logic leaks into another | 🟠 | CLAUDE §Page ownership |
| INV-MT-4 | `/signup` + `provisionTenant` (self-onboarding) is NEVER disabled/gated ("we're not selling, we're testing") | The test flow dies | 🟠 | [DECISIONS.md](DECISIONS.md) |

## 9. Parser

| ID | Invariant | If broken | 🔴 | Source |
|----|----------|-----------|----|--------|
| INV-PAR-1 | `externalId` dedup is mandatory; a re-run from a past date must be safe | Duplicate booking | 🟡 | CLAUDE §Email parsers |
| INV-PAR-2 | If two parsers read the same inbox the `externalId` formats must **match exactly**; the tombstone = last safety net | The same reservation becomes two docs | 🟡 | INC 2026-06-17 |
| INV-PAR-3 | A "seen" email NEVER turns into a lost booking — idempotency guards take the place of seen-skip | The booking of a read email silently drops | 🟠 | INC 2026-06-20, 2026-06-24 |
| INV-PAR-4 | Refactor-orphan: when you change a variable's definition/name, grep ALL its uses (`node -c` does not catch a runtime ReferenceError) | Orphan variable → silent ReferenceError → booking doesn't land (an example of 11 days lost) | 🟠 | INC 2026-06-24 |
| INV-PAR-5 | When you find a bug in one parser, grep the same line in the other TWO (Booksy/Fresha/Treatwell repeat the same pattern). "There's a similar comment" ≠ "same behavior" | Half fix; the bug lives on in the other parser | 🟠 | INC 2026-06-24 · [PARSER_NOTES.md](PARSER_NOTES.md) |
| INV-PAR-6 | A parser change goes live only with `firebase deploy --only functions` | The change doesn't reach production | 🟡 | CLAUDE §Email parsers |

---

## 10. Channel Synchronization (iCal OUT)

| ID | Invariant | If broken | 🔴 | Source |
|----|----------|-----------|----|--------|
| INV-SYNC-1 | The two-way calendar feed (`salownIcalFeed`) does **not reflect a booking back to the platform it came from** → per-consumer `?exclude=<Source>` lets that subscriber filter its own source (if the param is missing, Treatwell default, back-compat). ALL OTHER sources (walk-in/website/Booksy/Fresha/BLOCKED/busy-time) STAY in the feed | The platform counts its own appointment **double** (duplicate display in Treatwell) | 🟡 | `index.js` salownIcalFeed · edit_log 2026-07-07(c) |
| INV-SYNC-2 | "Exclude all aggregator sources in a single shared feed" is **NOT DONE** — each consumer must exclude only **its own** source (Treatwell should see Booksy/Fresha bookings and block those slots) | Cross-platform **double-booking** (Treatwell thinks Booksy's full slot is empty) | 🟠 | `index.js` salownIcalFeed |

---

## Maintenance (how we keep this file current)
- If a new incident produces a **permanent rule** (INCIDENTS "Prevention/Lessons"), add a line here + cite the source.
- If you **consciously** change an invariant: first write it with rationale in [DECISIONS.md](DECISIONS.md), then update the line here.
- If the rule is an "intentional oddity" (not broken, designed that way) → not INVARIANTS, [KNOWN_QUIRKS.md](KNOWN_QUIRKS.md).
- A change in this repo (`salown-docs`): `cd alex/docs && git commit INVARIANTS.md && git push`.
