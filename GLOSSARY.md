# GLOSSARY — salOWN terms glossary

> **What this file is:** One-line definitions of the jargon, abbreviations and code terms used in the project. When a newcomer (PM/engineer/designer) gets stuck on a term, they look here.
>
> **How to use:** Search for the term with `Ctrl/Cmd+F`. If you need deeper detail, follow the **detail** link on the right. When a new term/abbreviation becomes common, add a line here.

**Note:** The brand is always written **salOWN** (never "salown"/"salOWN") — even though "salOWN" sometimes appears in plain text in the docs, the correct form is salOWN.

---

## 🏢 Product & Business (Domain)

| Term | Meaning | Detail |
|-------|--------|-------|
| **Tenant** | A salon (customer) on the platform. All its data lives under `tenants/{tenantId}/...` | [MULTI_TENANT_NOTES](MULTI_TENANT_NOTES.md) |
| **Multi-tenant** | A single codebase hosting many salons in isolation | [SYSTEM_ARCHITECTURE](SYSTEM_ARCHITECTURE.md) |
| **`tenantId`** | The identity that identifies the salon; in the Firebase **custom claim** (JWT), not in app-state | [TENANTS](TENANTS.md) |
| **Class A / Class B** | Tenant maturity/migration class. All active tenants are Class A (whitecross completed 2026-06-19) | [TENANTS](TENANTS.md) |
| **Grabbing** | salOWN philosophy: it doesn't replace the existing channels (Booksy/Fresha/Treatwell), it **unifies** them | [MANIFESTO](MANIFESTO.md) |
| **Aggregator** | External booking platform (Booksy, Fresha, Treatwell) — pulled in via the email parser | [PARSER_NOTES](PARSER_NOTES.md) |
| **Walk-in** | A customer without an appointment; entered via `createWalkIn` (NO `date` field, only `startTime`) | [KNOWN_QUIRKS](KNOWN_QUIRKS.md) |
| **Squeeze-in** | Squeezing a small service into a left-open gap (born from processing-time) | [BUSY_SLOT_V2](BUSY_SLOT_V2.md) |
| **Processing time** | The intermediate period where a service is physically idle (the stylist isn't busy); the gap-fill engine uses this | [BUSY_SLOT_V2](BUSY_SLOT_V2.md) |
| **Busy-slot v2** | Multi-interval availability engine (with processing-time support) | [BUSY_SLOT_V2](BUSY_SLOT_V2.md) |
| **No-show** | A customer who doesn't show up | [BUSINESS_RULES](BUSINESS_RULES.md) |
| **Deposit / prepaid / pay-at-venue** | Payment modes: upfront payment / paid in advance / pay at the venue. Can vary per-booking for an aggregator | [KNOWN_QUIRKS](KNOWN_QUIRKS.md) |
| **Loyalty / cashback / points** | Loyalty system; `loyalty.cashbackPct` tenant-configurable (`points/20` legacy fallback) | [FEATURE_FLAGS](FEATURE_FLAGS.md) |
| **Ask salOWN** | In-app AI assistant; `askAI` callable, **Claude Haiku 4.5** | [DECISIONS](DECISIONS.md) ADR-014 |

## 👥 Tenants & People

| Term | Meaning |
|-------|--------|
| **Whitecross** | First/pilot tenant (I CUT Whitecross Barbers); premium tenant (custom domain whitecrossbarbers.com) |
| **HeroHairs** | Hairdresser tenant; processing-time/squeeze-in pilot |
| **EeKurt** | Tenant 2 |
| **I CUT** | Whitecross's business name (the starting point) |
| **Barber vs Stylist/Hairdresser** | Barber = men's barber (Whitecross); hairdresser = stylist with processing-time (HeroHairs) |

People/roles/emails → [PEOPLE](PEOPLE.md).

## 🔧 Technical — Firebase & Backend

| Term | Meaning | Detail |
|-------|--------|-------|
| **`havuz-44f70`** | Firebase project id (region `europe-west2`) | [SYSTEM_ARCHITECTURE](SYSTEM_ARCHITECTURE.md) |
| **Custom claim** | Authorization data inside the JWT (`tenantId`, `isSuperAdmin`, `tenantRole`) | [SECURITY](SECURITY.md) |
| **`isSuperAdmin`** | Platform-owner claim (currently only one: aerulas@). Delete/staff-assign permission depends on this | [DECISIONS](DECISIONS.md) ADR-006 |
| **`tenantRole`** | Role within the tenant: owner > admin > staff | [SECURITY](SECURITY.md) |
| **Callable / onCall** | A Cloud Function called by an authed client (can bypass rules with the Admin SDK) | — |
| **onRequest** | HTTP-endpoint type function (e.g. `addToWaitlist`, `salownEmailOptOut`) | — |
| **Trigger** | A function that runs automatically on a Firestore event (e.g. `salownNotifyBookingCreated`) | — |
| **IMAP parser** | Cron that reads the salon Gmail via IMAP+regex (`salownParseEmails`); pulls in aggregator emails | [PARSER_NOTES](PARSER_NOTES.md) |
| **`externalId`** | The unique identity of an aggregator booking; for dedup (re-run safe) | [PARSER_NOTES](PARSER_NOTES.md) |
| **Tombstone** | A trace marking a deleted/processed record; the last safety net against duplicates | [INCIDENTS](INCIDENTS.md) (Jakov) |
| **Canary** | "Fewer imports than expected → alarm" silent-break detector (for the parser, ROADMAP I1) | [ARCHITECTURE_REVIEW_2026-07-02](ARCHITECTURE_REVIEW_2026-07-02.md) |
| **Brevo** | Transactional/loyalty email provider (`noreply@salown.com`) | [EMAIL_ARCHITECTURE](EMAIL_ARCHITECTURE.md) |
| **nodemailer** | confirmation/cancel/reschedule email via the tenant Gmail | [EMAIL_ARCHITECTURE](EMAIL_ARCHITECTURE.md) |
| **FCM** | Firebase Cloud Messaging — staff app push notification (`fcmTokens/`) | — |
| **Telegram (notifyTenant)** | Booking notification to the tenant; reads the token from `settings/integrations` | — |
| **Capacitor** | Layer that wraps the web app into a native mobile app (required for Tap to Pay) | [DECISIONS](DECISIONS.md) ADR-005 |
| **Stripe Connect / Checkout Session** | The chosen payment direction (per-tenant policy; NOT Payment Link) | [STRIPE_CONNECT_PLAN](STRIPE_CONNECT_PLAN.md) |
| **Tap to Pay** | Stripe feature that turns the phone into a card reader (POS pilot direction) | [DECISIONS](DECISIONS.md) ADR-005 |

## 🚀 Deploy & Infrastructure

| Term | Meaning | Detail |
|-------|--------|-------|
| **Bundle / public-bundle / staff-bundle** | Build output (gitignored); served from `hosting/`. If the build is skipped, the SPA drops to 404 | [INCIDENTS](INCIDENTS.md) 2026-06-29 |
| **Predeploy hook** | Automatic `npm run build` before every deploy in `firebase.json` (so the bundle doesn't drop) | [DECISIONS](DECISIONS.md) ADR-010 |
| **CI** | GitHub Actions — push to `salown-app` main = automatic hosting deploy | [DEPLOY](DEPLOY.md) |
| **Vite / CRA** | salown-app = Vite (.jsx, active); salown-panel = CRA (.js, legacy) | [DECISIONS](DECISIONS.md) ADR-001 |
| **Smoke test** | Post-deploy 200 check of critical routes (fail → deploy fail) | [INCIDENTS](INCIDENTS.md) 2026-06-29 |

**Domains:** `salown.com` (consumer booking) · `hub.salown.com` (partner portal / panel) · `admin.salown.com` (super-admin) · `staff.salown.com` (salOWN Staff App).

## 🗂️ Repos

| Repo | What | Status |
|------|-----|-------|
| **salown-app** (`salOWN.git`) | Main code — Vite + .jsx | ✅ active |
| **super-admin** (`salownadmin.git`) | Super-admin panel | ✅ active |
| **whitecross-site** (`whitecross-site.git`) | Whitecross premium + legacy Stripe (us-central1) | 🟡 phased retirement |
| **salown-docs** (`salown-docs.git`) | This repo — project brain (private) | ✅ active |
| **salown-panel** | Old CRA panel | ⛔ legacy |
| **barber-panel / barber-mobile** | Whitecross old panels (FCM disabled) | ⛔ legacy |

## 📐 Process & Documentation terms

| Term | Meaning | Detail |
|-------|--------|-------|
| **SSOT** | Single Source of Truth — the one place a piece of info lives (status → ROADMAP; tests → TESTS) | [ROADMAP](ROADMAP.md) |
| **ADR** | Architecture Decision Record — decision + rationale + rejected alternatives | [DECISIONS](DECISIONS.md) |
| **Invariant** | An immutable rule that breaks the system if violated ("always do it this way") | [INVARIANTS](INVARIANTS.md) |
| **Quirk** | Odd but intentional behavior ("don't mistake for a bug and fix") | [KNOWN_QUIRKS](KNOWN_QUIRKS.md) |
| **Latent bug** | A bug that hasn't blown up yet but needs fixing (NOT a quirk) | [NORMALIZATION](NORMALIZATION.md) |
| **Regressed** | A previously-solved bug coming back (INCIDENTS Status 🔴) | [INCIDENTS](INCIDENTS.md) |
| **Tier 1/2/3** | Pre-scale hardening priority layers (Tier 1 = must close before onboarding) | [SECURITY](SECURITY.md) |
| **Blast radius** | The breadth of the area affected by a change/error | [SECURITY](SECURITY.md) |
| **GDPR / opt-out / unsubscribe** | Data protection; before email `emailOptOut !== true`, unsubscribe in every mail | [EMAIL_ARCHITECTURE](EMAIL_ARCHITECTURE.md) |

## 💻 Code helpers (frequently seen)

| Symbol | What it does | Detail |
|--------|----------|-------|
| **`pp()` / `parsePrice()`** | Safely converts a money string to a number (strips `£`/comma, NaN→0, preserves negative) | [INVARIANTS](INVARIANTS.md) INV-PARA-1 |
| **`toDateKey()`** | UK-safe date key (never `toISOString().split('T')[0]` — BST shifts) | [INVARIANTS](INVARIANTS.md) INV-DATE-1 |
| **`barberKey()` / `matchesBarber()`** | Exact case-insensitive barber match (NO fuzzy) | [NORMALIZATION](NORMALIZATION.md) |
| **`normalizeBookingStatus()`** | Normalizes status to uppercase (imports may be lowercase) | [INVARIANTS](INVARIANTS.md) INV-BK-7 |
| **`_aliases`** | The client's old phones/emails (preserved with arrayUnion, so history isn't broken) | [INVARIANTS](INVARIANTS.md) INV-MATCH-5 |
| **`clientManualId`** | The first key in client lookup | [INVARIANTS](INVARIANTS.md) INV-MATCH-4 |
| **`actualDuration`** | The moment checkout is hit − start (NOT the service duration; capped in the geometry) | [KNOWN_QUIRKS](KNOWN_QUIRKS.md) |
| **`bookingId` prefixes** | `WCB-` (walk-in) · `SALE-` · `BLOCKED-` — NOT the Firestore doc id | [KNOWN_QUIRKS](KNOWN_QUIRKS.md) |
| **`provisionTenant`** | The function that sets up a new tenant (self-onboarding `/signup`) | [DECISIONS](DECISIONS.md) ADR-009 |

---

## Maintenance
- When a new term/abbreviation becomes common (especially when a newcomer asks "what does this mean?"), add a line here, and if possible link to the detail doc.
- If a term changes/dies, update or remove the line (e.g. when a legacy repo is retired).
- Commit: `cd alex/docs && git commit GLOSSARY.md && git push`.
