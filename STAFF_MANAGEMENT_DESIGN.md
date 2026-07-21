# Staff Management & Compensation — Design Document

> **Date:** 2026-07-14 · **Source:** [STAFF_MANAGEMENT_DESIGN_PROMPT.md](STAFF_MANAGEMENT_DESIGN_PROMPT.md) (owner direction) ·
> **Context:** ROADMAP **theme S** · [STAFF_SETTINGS_AUDIT.md](STAFF_SETTINGS_AUDIT.md) (G5 audit) · INCIDENTS 2026-07-14 (leave)
> **Status:** 🟢 **PHASE B LIVE (2026-07-16)** — UI + staffComp rules deployed (ruleset `1474907b`). Phase A data model + Phase B UI/safety were coded per this document; Phase C (Finance wiring + accrual engine + M1 migration) REMAINS. Line references verified against 2026-07-14 `main` (`79d034a`); post-code sections are in edit_log_salown + ROADMAP S2.
> **Owner decision 2026-07-15:** wage periods hour|day|week|month|year; accrual is ALWAYS actual worked days/hours (§2.1). paid-leave = owner-only toggle, default OFF ("didn't work → no money"); there is NO mandatory-paid-annual-leave framework (barbers are commission/self-employed). In self_employed, rent depends on `pauseRentOnLeave`.
> **Out of scope:** tax/VAT calculation, payroll integration, Stripe.

---

## 0 · Executive summary

Today the system knows one comp model: **fixed daily wage**, specific to whitecross, name-keyed
inside `partnerConfig` (`tenants/whitecross/settings/finance_config`). In the real world there are three models
(wage / commission / self-employed) and the three compute P&L completely differently.

The design's backbone is **four decisions**:

1. **Comp data does NOT go into the barber doc** — barbers are world-readable (`firestore.rules:92` `read: if true`;
   public booking sites read it). New, protected collection: `tenants/{tid}/staffComp/{barberId}`.
2. **Date-effective period history (append-only `history[]`)** — a comp change closes the old period, opens a new
   one; historical reports never change. The `startDate` concept dissolves into the first period's `effectiveFrom`.
3. **"Passive = comp period closed."** Setting to passive automatically closes the comp period → "no accrual if not
   active" becomes structural (the permanent fix for known bug 1); also past earnings stay untouched
   (the all-time G4 ledger is not corrupted).
4. **Comp is a DERIVATION layer** — no new field is written to the money fields in booking/sale records,
   no existing field changes (G4 ledger philosophy: "pure derivation without changing the data model").

The existing G5 infrastructure (single resolver priority `shiftChanges(open) > leave > passive > workingDays/dayHours`,
`barber.leaves[]` leave archive, automatic return) is **taken as the foundation as-is** — the lifecycle is not reinvented.

---

## 1 · Data schema

### 1.1 New collection: `tenants/{tid}/staffComp/{barberId}`

Doc id = **barber doc id** (NOT the name — `partnerConfig`'s name-keyed fragility ends here;
a rename does not break comp).

```jsonc
{
  "barberId": "barber-1781007454543",
  "barberName": "Muhamed",          // snapshot (this changes during GDPR anonymization)
  "nameKey": "muhamed",             // normalizeName(barberName) — revenue attribution key (same as Finance.tsx:248)
  "history": [
    {
      "effectiveFrom": "2026-06-09",     // inclusive
      "effectiveTo": null,               // null = open period; when closed 'YYYY-MM-DD' (inclusive)
      "type": "wage",                    // 'wage' | 'commission' | 'self_employed'
      "params": { "amount": 41.6, "period": "day" },
      "note": "start",
      "changedBy": "aerulas@…", "changedAt": "<ts>"
    }
  ],
  "updatedAt": "<ts>"
}
```

**`params` by type:**

| type | params | meaning |
|---|---|---|
| `wage` | `{ amount, period: 'hour'\|'day'\|'week'\|'month'\|'year' }` | fixed earnings; today's model = `period:'day'` — **owner decision 2026-07-15: full period range + actual-work accrual (see §2.1)** |
| `commission` | `{ servicePct, productPct }` | % of the NET service/product revenue they produced |
| `self_employed` | `{ rent: { mode:'fixed', amount, period:'week'\|'month' } \| { mode:'pct', pct }, productsThroughShop: true, pauseRentOnLeave: false, collectedByShop: false }` | chair renter; their revenue is NOT the shop's |

**Rules:**
- `history` is **append-only**: periods are chronological, gapless, non-overlapping (`effectiveTo`+1 = next
  `effectiveFrom`); active period = the LAST element with `effectiveTo:null`. Retroactive correction only via
  super-admin "correction mode" (audited) — in the normal flow a past period cannot be edited.
- If NO comp period exists on a date (before the first period / passive interval) → **no accrual at all that day.**
- No field in the barber doc is moved/changed; the lifecycle (status/active/leaveFrom-Until/leaves[])
  stays as-is (`Barbers.tsx:322-332` writing is unchanged).

### 1.2 Lifecycle ↔ comp linkage (single table)

The state model is EXISTING (G5): `barberStatusOf` (`bookingUtils.ts:139`) + `isBarberOnLeaveForDate` (`:157`,
including the `leaves[]` archive) + resolver priority (owner decision 2026-07-14: **an open shiftChange overrides leave and
counts toward pay that day**). The design only wires the comp effect:

| State | Booking/site | Grid | Occupancy capacity | Comp accrual |
|---|---|---|---|---|
| **active** | visible | column present | counted | ✓ if period open |
| **leave** (interval) | date-aware hidden, auto-returns | no column if no booking | **NOT counted (fix §3.3)** | wage: day not counted · commission: naturally 0 · rent: depends on `pauseRentOnLeave` (default continues) |
| **open shiftChange** (even inside leave) | works that day | column present | counted | **counted** (showed up = worked = paid) |
| **passive** (permanent) | invisible | no column* | not counted | **comp period closed → 0** (structural) |
| **deleted** (rare) | invisible | none | none | staffComp doc REMAINS (archive); accrual same as passive |

\* Known gap: `Dashboard.tsx:409` `activeBarbersForDay` does not filter passive independently
(if workingDays matches it draws a column) — wired into the resolver in Phase B (§7).

**Set-to-passive flow:** `cycleStatus` (`Barbers.tsx:385`) in addition to its existing confirm closes the open
period in staffComp with `effectiveTo = <last working day>`; reactivation proposes opening a new period with the
same params (prefill, confirmed). Audit: in addition to the existing `BARBER_STATUS_CHANGED` (`Barbers.tsx:400`),
new `COMP_PERIOD_CLOSED` / `COMP_CHANGED` events.

### 1.3 Firestore rules (new block)

```
match /staffComp/{barberId} {
  allow read, write: if isSuperAdmin() || isOwner(tenantId);   // financial data — even admin can't see it (consistent with the Finance gate, AppRouter.tsx:129)
}
```
- Since the catch-all is `write: false`, an explicit block is REQUIRED; the barbers block (`firestore.rules:91-95`) is not touched.
- Deploy discipline: fetch live rules from the API → diff → deploy **rules LAST** (feedback rule); staffComp read/write
  cases are added to the rules test suite (65/65).

---

## 2 · Calculation rules (per-type shop revenue + staff cost)

Common definitions — period P, staff s (assigned from CHECKED_OUT bookings via `nameKey`; Finance already
aggregates by name, `Finance.tsx:248`):

- `S(s,P)` = service NET revenue = sum of `price + serviceCharge − discount − loyaltyRedeemedValue`
  (the service component of the shared `bookingNetWithoutTip`; tip is in NO calculation — the tip is the staff's)
- `U(s,P)` = product NET revenue = `soldProducts` + standalone product sales (`createProductSale` records)
- `compForDate(comp, dk)` = the history period covering that day (null if none)
- `isCompensableDay(barber, comp, dk)` = a period exists **AND** the day-gate passes. Day-gate = the SAME as
  Finance's current 5-counter order (`c66320d`+`4b7b592`+`e68dca8` live):
  `shiftChange(closed→no / open→YES) → leave→no → workingDays/dayHours`.

### 2.1 `wage`

- **Shop revenue:** ALL of s's revenue is the shop's: `S + U` enters gross revenue (today's behavior).
- **Staff cost (accrual) — OWNER DECISION 2026-07-15 (replaced the calendar-day proration):**
  wage accrues by **actually worked days/hours** regardless of the agreed period
  ("however it was agreed, by the number of days/hours worked"). `Σ compensableDay × dailyRate(dk)`:
  - `period:'hour'` → that day's accrual = `amount × rotaHours(dk)` (the shift length the resolver gives:
    the shiftChange override if present, otherwise dayHours). NO clock-in/out tracking — the hours
    source is the rota; real-time measurement is v2 (staff app check-in).
  - `period:'day'` → `amount` (today's model, as-is).
  - `period:'week'` → `amount / contractedDays` (`workingDays.length` on that date) — whitecross:
    250/6 ≈ £41.67/day. A week worked 5 days pays 5 days (the £500/£600 example in a 6-day agreement).
  - `period:'month'` → `amount×12/52 / contractedDays` · `period:'year'` → `amount/52 / contractedDays`
    — no jump tied to month length; §6.4's goal is achieved this way too (the report-period ≠ pay-period
    problem does not arise because accrual is always day-based).
  - Day-gate is EXACTLY the existing 5-counter order (shiftChange > leave > workingDays/dayHours) —
    "worked 5 days this week" is counted correctly automatically; an exact continuation of today's Finance behavior.
  - ⚠️ M2 parity note: Muhamed £41.60/day (old) vs £250/week ÷ 6 = £41.67/day (new) —
    the 7p/day difference will show up in parity; the owner chooses the canonical figure.
- **Payable (ledger):** `earned − paid` — the G4 weekly ledger (`Finance.tsx:470-504`) as-is, the only difference
  being that the wage source is `compForDate` instead of `partnerConfig[name].wage`.
- **Example:** Muhamed £41.60/day, 22 compensable days in July → cost £915.20; £900 paid →
  carryover £15.20. Company P&L: revenue S+U full, expense £915.20.

### 2.2 `commission`

- **Shop revenue:** ALL of s's revenue is the shop's: `S + U` enters gross revenue.
- **Staff cost:** accrues not per day but **per booking**:
  `servicePct% × S(s,P) + productPct% × U(s,P)`.
  Day-gate is NOT needed — a leave/passive staff's revenue is already 0 → cost is structurally 0. (A comp period
  is still required: commission does not apply to a booking dated outside the period.)
- **Payable:** same `earned − paid` ledger pattern as wage (Record Payment as-is).
- **Example:** 45% service / 10% product. Week: S=£1,200, U=£80 → commission £540+£8=£548.
  Company P&L: revenue £1,280, expense £548, £732 stays in the shop.
- v2 extension (out of scope, field reserved): `guaranteeMin` (minimum guarantee — the gap if commission < guarantee).

### 2.3 `self_employed`

- **Shop revenue:** `S(s,P)` **does NOT enter gross revenue** (the person's own money). The shop's revenue from s:
  - `rent.mode='fixed'`: rent accrual = NOT compensable-day but **calendar accrual**: `amount/7 × day`
    (weekly) — accrues every day the period is open; leave does NOT stop rent by default
    (`pauseRentOnLeave:false`, in the real world the chair is being held; the salon can turn the flag on if it wishes).
  - `rent.mode='pct'`: shop revenue = `pct% × S(s,P)` ("shop cut"). NO cost line for the person —
    the cut is the shop's revenue, the remainder is already the person's.
- **Product:** `productsThroughShop:true` (default) → a product sold from shop stock is 100% the shop's
  (independent of S, U enters normal gross revenue). The renter's own product never enters the till.
- **Staff cost:** NONE. The wage/scheduled-day logic is never applied to this type
  (**UK legal distinction**: if you run a fixed salary/shift requirement it reverts to an employee — the model
  makes this impossible at the field level: self_employed params have no `amount/period` field).
- **Reverse-direction ledger:** the renter owes the shop: `rentAccrued − rentPaid` (the mirror row of the
  STAFF WAGES table, "CHAIR RENT" section).
- **Example (fixed):** £150/week rent, July 31 days → accrual £664.29; paid £600 → £64.29 owed.
  Company P&L: "Chair rent income" £664.29; the person's £2,400 revenue is company revenue NOWHERE.
- **Example (pct):** shop cut 30%, S=£2,400 → shop revenue £720; the person keeps their £1,680.
- The `collectedByShop:true` edge (if the money passes through the shop till) → §6.3.

### 2.4 Partner layer (untouched)

The `isPartner / share / creditTo` in `partnerConfig` + the capital ledger (`Finance.tsx:524-608`,
Plan A/B, settlement) **is an upper layer independent of the comp type and STAYS AS-IS** (owner decision
2026-07-13: the partner infrastructure is never deleted — it will be productized for partnered salons in the future). This design
moves only `wage` + `startDate` from partnerConfig to staffComp (§5); `share/isPartner/creditTo`
continue to live in finance_config. The `creditTo` chain (`Finance.tsx:399-420`) does not change the comp accrual,
it only selects whose ledger it is written to — works as-is.

---

## 3 · Reporting integration

### 3.1 Finance (whitecross, Tier 3)

- The 4 wage derivations (`dailyData:265` · `partnershipByMonth:347` · monthly partner/staff `:374-447` ·
  weekly ledger `:470`) are wired to a single selector: `staffCostForDay(barber, comp, dk)` — internally
  `compForDate` + type branching (§2). The day-gate code is ALREADY in the correct order; only the wage source changes.
- **The implicit £100 fallback is REMOVED** (`Finance.tsx:269,351` `realBarberSet.has(bk)?100:0`): a real barber
  without a comp doc → accrual **0** + a "⚠️ comp undefined" warning row in the table. Silent money
  generation was a dangerous default; once migration is done its rationale is gone too.
- Two new row types in P&L: **"Commission"** (expense) and **"Chair rent income"** (revenue);
  self-employed revenue is subtracted from the `grossRevenue` total via `nameKey` (comp-type lookup inside Finance
  — does not leak into Reports).
- The two-ledger (operational + capital) structure does not change.

### 3.2 Reports (platform, tenant-independent)

- **Reports does NOT read comp.** Two reasons: (1) CLAUDE.md rule — tenant-specific/financial logic does not
  enter Reports; (2) rules — staffComp is read only by owner+super, Reports is open to admin too. The
  revenue=activity view stays correct independent of comp.
- **S1 hole 2 fix (archive):** `barberStats` (`Reports.tsx:182`) is built only from live `barbers` →
  a deleted barber's row disappears. Fix: row source = live barbers **∪** distinct `barberName` from filtered
  bookings (snapshots are now in every record via `0db230c`). Names with no live counterpart go in an
  **"Former staff"** section at the end of the list, in a neutral color. The empty-state
  check (`:484`) stays the same.

### 3.3 Occupancy (structural fix for known bug 2)

- `barberWorksOn` (`OccupancyPanel.tsx:54-63`) looks at status/leave NOT AT ALL; the weekly denominator
  (`:260-265`) looks only at first-seen → a leave/passive barber is counted in capacity, artificially
  lowering the %. Fix: derive both denominators **from the resolver** (`getAvailableBarbersForDate` semantics,
  per day) — leave day = 0 capacity, passive = 0, open shiftChange = in capacity. Self-employed IS COUNTED
  in capacity (chair occupancy is a physical fact; not money).

### 3.4 Staff app

SalesView/WeekView already show revenue via the shared `bookingNetWithoutTip` (`79d034a`) — independent of comp,
no change. The "see your own commission" screen is deliberately **out of scope** (staffComp rules are closed to
staff; if opened it needs a separate projection design — v2 note).

---

## 4 · UI/UX — Staff Management screen

The concretization of the **Staff hub (4F)** vision from the G5 audit: the Barbers page stays a roster; clicking a
staff member opens a **tabbed detail panel**:

```
┌─ Muhamed ────────────────────────────────── [Set leave] [Set passive] [🗑] ─┐
│  Availability │ Pay 🔒 │ History                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ PAY (only owner + super-admin see it)                                        │
│  Current: 💷 Wage — £41.60/day · since 2026-06-09                            │
│  [Change compensation]                                                       │
│    → pick type (wage/commission/self-employed) → params → effectiveFrom      │
│      (min: today; NO past date — except correction mode) → confirm           │
│  History: 2026-06-09 → …  wage £41.60/day   (append-only timeline)          │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Availability** tab: the existing workingDays/dayHours/leave/shiftChange editors are gathered here
  (today two screens scattered across Barbers + Settings→Members come down to one place — audit §3.9).
- **Pay** tab: role gate same as Finance (`isSuperAdmin || tenantRole==='owner'`); other roles never see
  the tab. A comp change writes a `COMP_CHANGED` audit (`{barberId, from, to, effectiveFrom}`).
- **Lifecycle actions:** existing behavior preserved + strengthened:
  - *Set passive* → existing confirm + "comp accrual stops, past earnings/balance preserved" note +
    closes the comp period (§1.2).
  - *Delete* → existing strong modal (`Barbers.tsx:932-954`, "suggest Set passive") + gate
    (`canDelete:179`, rules `:93`) AS-IS; "comp history and all records stay in the archive" is added to the modal.
  - *Leave* → existing dated flow + `leaves[]` archive as-is.
- **"Former staff" view:** a collapsible section below the roster — passive/deleted staff,
  last comp type, balance (if any), link to the Reports archive row.
- Across tenants: the screen is platform-wide; **the Pay tab is populated on tenants that have a comp doc,
  otherwise a "comp not defined" empty state** (Finance's whitecross hardcode becomes a plan-flag in Phase C).

---

## 5 · Migration (partnerConfig → staffComp) — whitecross pilot

Data loss is made impossible: **nothing is deleted/overwritten; only new docs are added.**

| Step | Work | Guarantee |
|---|---|---|
| M1 | Admin-SDK script: read `finance_config.partnerConfig`, map each name to a barber doc via `normalizeName` (Finance's own mapping logic, `Finance.tsx:268`) → **dry-run CSV** (name, matched barberId, type=wage, amount, effectiveFrom=startDate, unmatched ⚠️ row) | CSV → owner approval → write (CLAUDE.md bulk rule). partnerConfig is NOT touched |
| M2 | Finance read order: `staffComp → partnerConfig.wage fallback`; **parity mode**: if the two sources give different results, console+UI warning. The G4 weekly ledger's live balances (Arda £0 / Muhamed £0 reconciliation) are compared penny-by-penny before/after migration (the byte-proof tradition) | Visible behavior change ZERO |
| M3 | Parity clean → the fallback + the implicit £100 default are removed; the `wage/startDate` fields in `partnerConfig` are marked "migrated" but NOT DELETED (the partner layer `share/isPartner/creditTo` still lives there) | Rollback: reopening the fallback is a single line |
| M4 | Other tenants: no partnerConfig in herohairs/eekurt → clean start, no migration needed; the Staff hub Pay tab writes directly to staffComp | The pilot → general order is preserved |

Old booking/sale records are NOT touched AT ALL (comp is pure derivation; the `paidAmount`/`platformDepositAmount`
semantics were already untouchable per INVARIANTS).

---

## 6 · Edge cases

1. **Mid-period comp change** (wage→commission, on the 15th of the month): 1–14 day-accrual from the old period,
   CHECKED_OUT bookings dated ≥15 get commission from the new period. In the weekly ledger the transition week shows two
   rows ("wage 4d £166.40 + commission £212"). Zero effect on the past — periods cannot intersect.
2. **GDPR "right to be forgotten":** not destruction but **anonymization**: the barber doc is deleted; `staffComp.barberName`
   → "Former staff"; the `barberName` snapshots in bookings are bulk-anonymized (export →
   dry-run CSV → owner approval → write); financial totals and row structure stay as-is. The Reports archive
   row keeps showing as "Former staff".
3. **If self-employed money passes through the shop till** (`collectedByShop:true`; the card device is the shop's):
   `S(s)` is still NOT revenue — it is **held in escrow** in the till. A pass-through row in Finance: "collected on behalf
   £X − rent/cut £Y = payout owed £Z". In v1 display only (no automatic payout).
4. **Rent period ≠ report period:** all fixed accruals (weekly rent, weekly/monthly wage)
   are reduced to a **calendar-day rate** (`amount/7`, `amount/monthDays`) → a jump/loss at the month boundary is
   mathematically impossible; the cash-collection difference already shows in the `accrued − paid` carryover row
   (G4 pattern).
5. **Reporting after deletion:** the staffComp doc lives independent of the barber doc (separate collection, same id)
   → a deleted staff's comp history + balance is in the archive; the Reports row comes from the `barberName` snapshots
   (§3.2). If deletion is attempted before the balance is zeroed, the modal warns: "there is an unpaid £X balance".
6. **Commission staff with 0 bookings on a scheduled day:** cost 0 (no guarantee — deliberate v1; the `guaranteeMin`
   field is reserved for v2). For wage staff, if the day is compensable, accrual is full (today's behavior).
7. **`creditTo` chain:** comp accrual is computed per person; creditTo only changes whose ledger row
   it is written to (existing `Finance.tsx:399-420` behavior) — there is NO field in staffComp,
   it stays in finance_config.
8. **Legacy `active`-only readers:** `WalkInFlow.tsx:186`, `NewBookingSheet.tsx:263`,
   `isBarberBookingDisabled` (`bookingUtils.ts:133`) look only at the `active` boolean. Because the editor writes the
   two fields in sync it is harmless today; in Phase B all three are wired to `barberStatusOf` so that no divergence
   arises when `status` is written alone (closing the audit's "TWO sources of truth" item).
9. **Leave + fixed rent:** by default rent accrues (`pauseRentOnLeave:false`); if the salon opens the flag by agreement,
   the days in the leave interval are dropped from rent accrual (leave is already date-ranged + archived → the
   calculation is deterministic).

---

## 7 · Phasing (each phase is independently deployable)

**Phase A — Data model + migration (visible change ZERO)**
`staffComp` collection + rules block + rules tests · `compForDate`/`staffCostForDay` helpers
(unit-tested, `bookingUtils`/new `compUtils`) · M1 migration script + dry-run CSV + owner approval ·
Finance fallback read + parity warning (M2). *Risk point: rules deploy — fetch live, push LAST.*

**Phase B — Staff hub UI + safety fixes**
Barbers detail panel (Availability/Pay/History tabs) · comp editor + `COMP_CHANGED` audit ·
passive→period-closing linkage · **S1 hole 2** Reports archive row · **occupancy resolver fix**
(§3.3) · migration of the legacy `active`-reader trio to `barberStatusOf` · passive check in the
Dashboard column filter. Each one small, a separate commit — Keep Scope Narrow.

**Phase C — Report integration + platformization**
Commission expense + Chair-rent revenue rows in Finance, subtracting self-employed revenue from gross ·
M3 (removing the fallback + implicit £100, with parity proof) · generalizing the weekly ledger to the 3 types
(CHAIR RENT mirror section) · turning Finance's `tenantId==='whitecross'` hardcode (AppRouter.tsx:129,
Sidebar.tsx:213) into a plan/feature-flag → the module opens to other tenants (can be gated with
planLimits — a Pro+ feature candidate).

The ordering follows ROADMAP: **BELOW the I2 + Pre-Scale gate**; Phase A is small code-wise but since it
contains money semantics it does not break the rule: **first this document → owner approval → code.**

---

## 8 · Open questions (to the owner)

> **2026-07-15 owner answers:** (0) NEW — wage periods full range hourly→yearly;
> accrual is ALWAYS over actually worked days/hours (§2.1 revised; "think broad:
> every salon's standard is different, we won't rent chairs but for those who do it stays in the model").

1. Is the commission percentage applied to **gross or net** revenue? (Design default: NET — the
   discount/loyalty-deducted `bookingNetWithoutTip` components; the staff shares in the cost of a discount. On
   Booksy/Fresha-sourced bookings should the platform commission also be deducted? Default: no, twFee stays a
   company expense.)
2. When a self-employed person takes leave the rent default is "accrues" — does it fit the whitecross/herohairs reality?
3. Should `guaranteeMin` (minimum guarantee for a commission worker) go into v1? (Default: no.)
4. Is a staff member's own commission/balance view wanted in the staff app? (If wanted it needs a separate projection
   design — staffComp rules are NOT opened to staff.)
