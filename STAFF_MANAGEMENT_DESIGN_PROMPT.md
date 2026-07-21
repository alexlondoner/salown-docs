# Staff Management & Compensation — Design Review + UI Prompt (v2)

> **How to use:** Paste TWO files together into a new Claude session (Claude design):
> **(1) this file + (2) [STAFF_MANAGEMENT_DESIGN.md](STAFF_MANAGEMENT_DESIGN.md)** (the existing v1 design).
> Output = a two-part document: **A. Design Review Report** + **B. Staff Hub UI/UX Design**.
> DO NOT write code. Owner: whitecrossbarbers@gmail.com.
>
> *v2 note (2026-07-14):* the v1 prompt was "produce a design from scratch" and it was run — its output is
> in this repo as STAFF_MANAGEMENT_DESIGN.md (code map verified with line references).
> This v2 combines the product context of [PROJECT_BRIEF.md](PROJECT_BRIEF.md) with v1's specification
> and turns the task from "do the same work again" into **"stress the existing design + produce its UI."**

---

## Role

You will work wearing two hats: **(A) senior SaaS product architect / data modeler** — you will
adversarially review the existing design; **(B) senior product designer** — you will produce the module's screen design.

## Product context (you have no repo access — this section is self-sufficient)

**salOWN** — a multi-tenant salon/barber management SaaS: booking, payment, loyalty,
notifications, staff mobile app, admin panel, reporting.

- **Stack:** React + Vite + strict TypeScript · Firebase (Firestore, Cloud Functions
  `europe-west2`, Hosting; project `havuz-44f70`). All tenant data lives under `tenants/{tenantId}/...`.
- **3 live tenants:** `whitecross` (premium pilot — every feature lands here first), `herohairs`, `eekurt`.
  There is real usage: daily online booking, loyalty redeem, transactional mail traffic.
- **Surfaces:** admin panel (salown.com) · salOWN-hosted booking/profile · whitecross premium site
  (separate static repo) · staff mobile app (staff.salown.com).
- **Deploy:** push to main → CI auto hosting deploy. Changes land first in the whitecross pilot.

## Business problem

Staff work with **different pay models**; today the system knows only fixed daily wage
(the name-keyed `partnerConfig` on the Finance page specific to whitecross). The real world (UK):

- **wage** — fixed £/day-week-month; the shop takes all service revenue, salary is a fixed expense.
- **commission** — the person takes a % of the NET revenue they produce (service/product separate %); shop revenue = revenue − commission.
- **self-employed / chair renter** — the person's revenue is **not the shop's revenue**; the shop collects rent
  (fixed £ OR a % of revenue). UK legal distinction: if you run a salary/shift on a self-employed person they revert
  to an employee (tax/employment risk) — the model protects against this structurally.

Because the three models compute P&L completely differently, a first-class, multi-tenant **Staff Management**
module is needed.

## Current code facts (the design sits on these — assume in review)

- `partnerConfig` = inside `tenants/whitecross/settings/finance_config`, **name-keyed**:
  `{share, wage, isPartner, creditTo, startDate}`. For a real barber without a config there is an **implicit £100/day
  fallback** (dangerous default). `tenantId==='whitecross'` hardcoded in the Finance route/sidebar.
- **Barber docs are world-readable** (`firestore.rules` `read: if true` — public booking sites
  read them). Comp data CANNOT be placed in this doc.
- The lifecycle is LIVE and solid (G5, 2026-07-13/14): `status: active|leave|passive` + date-ranged
  `leaveFrom/Until` + `leaves[]` leave archive + automatic return. Single resolver priority (owner decision):
  **`shiftChanges (open) > leave > passive > workingDays/dayHours`** — an open special-day entered within a
  leave WORKS and counts toward pay.
- Revenue attribution is **name-based** (`normalizeName`); bookings snapshot `barberName` (a deleted
  barber's history stays by name). Walk-in oddity: `barberId` = lowercase NAME; online = doc id.
- The net-revenue helper is shared: `bookingNetWithoutTip` (price + serviceCharge + product/addon − discount −
  loyalty; **tip is in no calculation**, the tip is the staff's).
- **2 known bugs (the design solves structurally — verify in review):** (1) a passive barber still accrues
  daily wage in Finance; (2) a barber on leave is counted in the occupancy capacity denominator.
- Constraints: no bulk delete in Firestore (export → dry-run CSV → owner approval → write); the semantics of booking
  money fields cannot be changed; a money/semantics change = report first + owner approval.

## TASK A — Design Review Report

For the attached **STAFF_MANAGEMENT_DESIGN.md** (v1):

1. **Answer the open questions (the 4 questions in v1 §8):** commission gross/net base (+ platform cut on
   aggregator-sourced bookings), rent default on leave, should `guaranteeMin` go into v1, staff's
   own commission view. For each a reasoned recommendation + counter-scenario.
2. **Stress adversarially:** the data schema (`staffComp/{barberId}`, append-only `history[]`,
   "passive = period closed"), the calculation rules (§2 formulas, day-rate reduction), the migration plan (M1–M4
   parity approach), the rules block. Where does it break? Which edge case is missing? The Firestore read-cost /
   index need / offline-cache angle? Label each finding **CONFIRMED** (breaks with a concrete scenario) /
   **PLAUSIBLE** (risky but you couldn't build a scenario).
3. **Missing-piece hunt:** things the design never touches but this module will need at scale
   (e.g. multi-location, hourly rate, payroll export) — propose as a "v2 parking list," don't
   bloat the scope.

## TASK B — Staff Hub UI/UX Design

Turn the rough skeleton in v1 §4 into a real screen design (v1's data model/phasing is FIXED —
the UI cannot change it):

- **Screen inventory:** roster list + staff detail panel (Availability / Pay / History
  tabs) + "Former staff" archive section + comp-change flow (pick type → params →
  effectiveFrom → confirm) + lifecycle actions (leave/passive/delete, existing strong-confirm modal preserved).
- **For each screen:** markdown/ASCII wireframe + state matrix (empty/full/error/loading;
  comp-undefined warning; leave/passive badges) + micro-copy suggestions (English UI text).
- **Role visibility:** Pay tab only owner + super-admin; admin/staff never see the tab.
  If comp is undefined on the tenant, empty state.
- **Visual language of the 3 comp types:** a distinctive summary card per type (wage £/day · commission %'s ·
  self-employed rent + "their revenue is not company revenue" note) — when the owner looks at the table they
  should distinguish who is on which model in 2 seconds.
- **Panel pattern:** consistent with the existing salOWN admin panel (both dark + light), mobile-friendly;
  the "visual only" rule — do not redesign existing behaviors, design layout/hierarchy/flow.

## Requested output format

A single markdown document, two sections: **A. Review Report** (findings tagged CONFIRMED/PLAUSIBLE,
open-question answers, v2 parking list) + **B. UI Design** (screen inventory, wireframes, state
matrices, copy). Do not write code; give Firestore rules/schema suggestions as text. The output will be committed to
this repo (`salown-docs`) and the code phases (A/B/C, v1 §7) will proceed per this document.
