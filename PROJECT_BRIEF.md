# salOWN — Project Status Report (context for SaaS consulting)

> A self-contained summary to paste to an external consultant (ChatGPT etc.).
> **Snapshot: 2026-07-14.** Single source of truth for status: [ROADMAP.md](ROADMAP.md).
> This file goes stale — update it on a major status change or redirect to ROADMAP.

## salOWN at a glance (30-second read)

- **Multi-tenant salon/barber operating system** — booking, loyalty, staff mobile app,
  finance, marketing, admin panel.
- **Born inside a real barbershop.** We didn't set out to build salon software — we couldn't
  run our own shop on existing tools, so we built our own system. Today the platform powers
  the business that created it (Whitecross = premium pilot tenant).
- **Running in production across 3 tenants** — real customers, daily operational use.
- **Current focus: hardening, security and scale readiness.** Features still ship weekly, but
  the strategic weight is on production maturity — closing security gates, tenant isolation,
  operational safety — not feature count.

## Production today

*(Snapshot: 2026-07-14 — see header note; single source of status is ROADMAP.md)*

- **2 live tenants** (`whitecross` · `herohairs`), all full-feature ("Class A"). *(`eekurt` left the platform 2026-07-18 — inactive; data retained.)*
- **Real customer bookings** — regular, often daily: website + external platforms
  (Booksy/Fresha/Treatwell email ingestion) + walk-ins, all in one system
- **Loyalty redemptions happening in production** (customers actually redeem points)
- **Transactional + loyalty email system live** (`noreply@salown.com`, Brevo)
- **Staff mobile app in daily operational use** by barbers
- **Automated CI deployment** — push to `main` → Firebase Hosting (Whitecross public site
  deployed separately, by design)
- **Payments:** all Stripe Connect modes verified end-to-end in TEST mode; live mode (real
  money) not yet enabled — pending owner decision

## 1. What the product is
**salOWN** — a multi-tenant salon/barber management SaaS. Booking, payment, loyalty,
notifications, staff mobile app, admin panel, reporting.
- **2 tenants live:** `whitecross` (premium pilot — every feature lands here first) and `herohairs`.
  All "Class A" (full feature). *(`eekurt` left the platform on 2026-07-18 — inactive; data retained.)*
- **Real usage signals:** customers redeem loyalty points; transactional + loyalty
  emails go out regularly; bookings come regularly (sometimes daily) from the website. The platform
  is operational.

## 2. Technical architecture
- **Frontend:** React + Vite + **TypeScript**. Admin panel + booking + public profile.
- **Backend:** Firebase — Firestore (data), Cloud Functions (region `europe-west2`), Hosting.
  Project `havuz-44f70`.
- **Data model:** everything lives under `tenants/{tenantId}/...` (barbers, bookings, clients, settings,
  finance…).
- **Surfaces:**
  - salOWN-hosted booking/profile (`salown.web.app`) — multi-tenant.
  - **whitecross premium site** (`whitecrossbarbers.com`) — custom domain, static HTML/JS storefront
    (separate repo).
  - **Staff mobile app** (`salown-staff.web.app`) — barbers' daily operations.
- **Repos:** `salOWN` (main app + functions), `whitecross-site` (premium storefront),
  `salownadmin` (super-admin panel), `salown-docs` (roadmap/incidents/security "brain" docs).
- **Deploy:** push to `main` → GitHub Actions automatic Firebase Hosting deploy. (Exception: whitecross
  public site requires a **manual** deploy.)

## 3. TypeScript migration — status (91% overall)
| Area | Status |
|---|---|
| **Frontend (TS/TSX)** | ✅ **100%** — 113 ts / 0 js |
| **Functions `index.js` split** | ✅ **100%** — single dev file split into domain modules (`src/index.ts`) |
| **Functions TS (build)** | 🟡 **65%** — 22 ts / 12 js |
| **Shared models** | ✅ **100%** |
| `@ts-ignore` | **0** ✅ · `any` (labeled/intentional) 1408 (101 × `TODO(ts-migration)`) |

**Next tech-debt work (active priority):** *I2 Phase 2* — moving function exports into the domain
modules. Phase 1 (helpers) is done; the remainder = the exports (parsers → notifications →
marketing; Stripe/bookings **last**, the live pipe is the most sensitive). Golden rule: export name +
config identical, pure move, one commit per slice + targeted deploy.

## 4. Roadmap — where we stand
The project is not in a "features from scratch" phase; the remaining work is mostly **scale
readiness** + **before taking money** + **deepening retention**.

**Active priorities:**
1. **I2 Phase 2** (functions modularization) — above.
2. **Pre-Scale Hardening Gate:** Tier 1 (critical security) ✅ **closed** (role-claim, tenant-scoped
   rules, financial-forge guard, staff self-escalate). Remaining **Tier 2 🔴-1:** the `read: if true`
   surface — `services`/`products`/`clients` + the tenant root doc are still world-readable; at 1000 salons
   PII enumeration + read-cost risk → must close before tenant volume grows.
3. **Payments (Stripe Connect):** all modes verified end-to-end in TEST mode (deposit/full/optional/
   pay-at-venue). **Live-mode (real money) not yet enabled** — awaiting owner decision + live keys.
4. **NEW theme — Staff Management & Compensation** (added today, below).

## 5. Recent work (2026-07-14)
- **Calendar grid bug:** consecutive checked-out walk-ins overlapped each other → a 30-min
  min-height floor for the render was added to `computeColumns` (drawing aligned with the column
  engine). ✅ Live.
- **whitecross-site leave:** a barber on leave stayed in the booking list → **date-aware
  hiding**: hidden on leave days, automatically returning on the post-return date (bookable in advance
  within a 90-day window). ✅ Live.
- **Data-safety (S1):** product sales + blocks now snapshot `barberName` → the sale keeps
  the name even if the barber is deleted. ✅ Live.
- **Staff Management & Compensation** added to ROADMAP as a new theme (S) + a design prompt was
  written ([STAFF_MANAGEMENT_DESIGN_PROMPT.md](STAFF_MANAGEMENT_DESIGN_PROMPT.md)).

## 6. Staff Management & Compensation (new large module — in the design phase)
**Problem:** staff work with different pay models, and the system only knows a fixed wage
(whitecross-specific Finance).
**3 models:** **wage** (fixed £/day-week-month) · **commission** (% of revenue) · **self-employed**
(chair rent: fixed £ or % — the person collects their own money, the shop takes rent/commission). Because
each computes P&L differently, a separate, first-class module is needed (multi-tenant, not buried in Finance).
**Scope:** comp model + lifecycle (active/leave/passive/deleted) + data-safety (snapshot/
soft-delete/GDPR anonymization) + Reports/Finance/Occupancy integration + migration + UK legal distinction
(self-employed ≠ employee).

## 7. Known open bugs / work
- **passive-wage:** a passive (departed) barber still accrues a daily wage in Finance
  (filter missing). *(Finance is whitecross-specific = low priority.)*
- **occupancy-leave:** a barber on leave is counted in the occupancy capacity denominator → % artificially low.
- **Reports archive:** a deleted barber's historical stat row drops off the Reports "Barbers" tab
  (should be shown as an archive).
- **Tier 2 read:true surface** (above) — must close before scale.
- Minor: the bounce-checker (email) is still broken.

## 8. Operational rules (critical)
- push to `main` = automatic hosting deploy (CI). Before every edit `git status` + check for unpushed.
- whitecross public site = **manual** deploy (`firebase.saas.json`); wrong config overwrites the live EeKurt
  site → careful.
- **NO bulk deletion** in Firestore (export → dry-run → owner approval → write).
- Booking data quirk: walk-in `barberId` = lowercase name; online = doc id + `barberName`.
- All serious incidents to `INCIDENTS.md`, single source of status in `ROADMAP.md`.

## 9. Good questions to ask the consultant
1. How should the self-employed/chair-rent comp model be modeled date-effectively in Firestore?
2. Strategy to close the Pre-Scale `read:true` surface with a public-projection pattern?
3. Commission (`application_fee`) and VAT handling on the Stripe Connect live-mode transition?
4. Single Firebase project vs isolation at 3→100+ tenant scale?
