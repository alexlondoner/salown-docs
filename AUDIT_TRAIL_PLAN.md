# AUDIT_TRAIL_PLAN — Full-coverage audit trail (ROADMAP I4)

> Source: owner request 2026-07-12 (Muhamed leave-wipe case — INCIDENTS 2026-07-12:
> the "who did it" question had no answer because barber changes are not logged).
> Owner principle: **"shouldn't there be one for every operation done in the system?"** → yes,
> every WRITE operation; reads are not logged (noise + cost + no value).
> **Gate: TS migration freeze — no code is written before 2026-07-14.** State SSOT: ROADMAP I4.

## 1. Current state (2026-07-12 inventory, verified with grep)

**Infrastructure exists and is good:** `src/utils/auditLogger.ts` `logAudit(action, details)` —
adds the actor (uid/email/name) automatically, writes to `tenants/{id}/auditLogs`,
fail-silent. Viewer: `src/pages/AuditLog.tsx`. Functions side uses raw `.add()`.

**Covered (~25 types):**
| Area | Types | Source |
|---|---|---|
| Booking ops | CHECKOUT, WALK_IN_CREATED, BOOKING_EDITED, RESCHEDULE, CANCEL_BOOKING, DELETE_BOOKING, NO_SHOW, BLOCK_TIME_ADDED/REMOVED, PRODUCT_SALE_CREATED | firestoreActions + BookingDetailPanel/CheckoutPanel/Bookings/BlockTimeForm |
| Customer-sourced | BOOKING_CANCELLED_BY_CUSTOMER, BOOKING_RESCHEDULED_BY_CUSTOMER | functions (cancel/reschedule callables) |
| Finance | EXPENSE_ADDED/UPDATED/DELETED, PAYMENT_ADDED/DELETED, INVESTMENT_TX_*, INVESTMENT_REQUIRED_SET, FINANCE_LEDGER_UPLOADED, PARTNER_SETTLEMENT_SIGNED/REVERSED, EXIT_AGREEMENT_* | Finance.tsx + ExitSettlementCard |
| Loyalty | manual_points_adjustment | Clients.tsx |

**Blind spots (unlogged mutations):**
- **Barbers:** status/leave (today's case!), working hours/dayHours, shiftChanges (the shift part of off-today/quick block), create/delete, color/role/order.
- **Clients:** create/edit (including the alias chain!), delete, **merge (drag-drop, destructive)**, consent (Stop/Resume emails), member promote/demote, trusted (when it arrives).
- **Catalog:** services/products/categories create/edit/delete — **price change is money-affecting**, and currently leaves no trace at all.
- **Settings:** permissions (7 permissions!), notification toggles, integrations (telegram/stripe), emailConfig, loyalty config, plan/trial (super-admin app).
- **Other:** discount codes create/delete, campaign sends (present in the campaignsSent subcol but not in audit), staff-user create/delete (functions), gallery/announcements, super-admin panel actions (cross-tenant!).

## 2. Design

### 2a. Standard envelope — one helper, two sides
```
{ action: 'BARBER_STATUS_CHANGED',        // SCREAMING_SNAKE, area prefix
  actor:  { uid, email, name, role },     // logAudit already does this; ADD role
  source: 'panel'|'staff-app'|'booking-site'|'function:<fnName>'|'super-admin',
  target: { collection:'barbers', docId, label:'Muhamed' },   // HUMAN-READABLE label REQUIRED
  changes: { status:['leave','active'], leaveUntil:['2026-07-20',null] },  // before→after, ONLY changed fields
  timestamp: serverTimestamp() }
```
- `changes` must be a summary (changed fields), NOT a full-doc snapshot (cost + PII expansion).
- Frontend: `logAudit` is extended (source+target+changes params; existing calls don't break — backward-compatible).
- Functions: `logAuditServer(db, tenantId, {...})` shared helper (currently 3 places with hand-written `.add()`).
- Super-admin app: cross-tenant actions write to the target tenant's auditLogs with `source:'super-admin'`.

### 2b. What we DON'T log (deliberately)
- Reads/views — never.
- Machine-volume events: parser booking imports (externalId+parserStats are already a trail),
  scheduled cleanups, triggers' own internal writes (loyaltyEmailSent marker etc).
  Exception: if the parser creates a client DOC (C5-A) that can be logged (identity-affecting).
- Booking create (online/walk-in) is already covered; the booking doc's own meta
  fields (cancelledBy etc) don't replace audit but there's also no need to duplicate them —
  audit focuses on destructive/administrative actions like DELETE/EDIT.

### 2c. Security & lifecycle
- **Rules: append-only** — create: staff+; update/delete: NOBODY (including super-admin;
  a correction = a new record). Read: owner/admin (does staff see their own actions → owner's call).
- **Retention:** Firestore TTL policy (`expireAt`, suggested 24 months) — cost control;
  finance/exit records without TTL (may carry legal value).
- Never a secret in the envelope's `changes` (appPassword etc → `changes:{appPassword:['***','***']}`).

### 2d. Viewer (AuditLog.tsx)
Category filter (Bookings/Finance/Team/Clients/Catalog/Settings) + actor + date
range + target-search. "What happened to Muhamed?" must be answerable in a single query.

## 3. Phases (a slice = deployable, each phase delivers value on its own)
- **Phase A (first — the class of today's case):** barbers (status/leave/hours/create/delete
  + G1 confirm modal together) + clients (edit/delete/merge/consent/member). ~10 call sites.
- **Phase B:** catalog (price!) + settings (permissions/integrations) + discount codes.
- **Phase C:** staff-user fns + super-admin panel + campaign send + the rest + TTL + viewer filters.
- Each phase adds a manual-verification line to TESTS.md (do the action → see the record).

## 4. Links
- ROADMAP **I4** (state SSOT) · G1 `BARBER_STATUS_CHANGED` = pioneer slice ·
  INCIDENTS 2026-07-12 (triggering case) · SECURITY.md (the append-only rules change
  is recorded there too) · memory `feedback_firestore_rules_safety` (rules deploy LAST).
