# FIRESTORE_SCHEMA.md

## General Structure

```
tenants/
  {tenantId}/
    settings/settings    ← business config, hours, loyalty, deposit rules
    settings/hours       ← mirror of hours (quick reads)
    settings/emailConfig ← gmail + app password for parsers
    settings/integrations ← treatwellIcalUrl
    barbers/             ← per-barber working days + hours
    bookings/            ← all bookings
    services/
    products/
    clients/
    staff/               ← staff accounts + roles + `accessStatus` (S4A access axis)
    staffAccessOps/      ← S4A: offboard/re-enable operation records (server-only, NOT in rules yet)
    emailOptOuts/        ← GDPR: opt-out records for unknown clients
    auditLogs/           ← booking audit trail
    parserTombstones/    ← deduplication guard (e.g.: SLOT-Booksy-{date}-{time})
    platform/settlementScan  ← FIN-B1 scan cursor — SOURCE ONLY, not in production
```

> ⚠️ This map is **partial** — it lists the collections a session most often gets wrong, not every
> collection on the platform. When it disagrees with the live database, the database wins.

## Booking Model — Critical Quirks

- **`date` is present on SOME bookings of EVERY source — never query by it.** The rule is unchanged and
  the reason is now stronger than the old one. *Measured 2026-09-09 on a 1,200-document sample of
  `tenants/whitecross/bookings`:*

  | source | has `date` | no `date` |
  |---|---|---|
  | `Walk-in` | 383 | **619** |
  | `Booksy` | 56 | 8 |
  | `Fresha` | 9 | 1 |
  | `Website` / `website` / `Salown` / `Admin` / `Treatwell` / `Manual` | all | — |
  | `Product Sale` / `block` | — | all |

  The old text said walk-ins have **no** `date` field. That is **not true any more** — they are *mixed*,
  and so is Booksy, and so is Fresha. That makes the rule **more** important, not less: a query filtered
  on `date` silently drops ~62 % of walk-ins and a slice of the aggregator rows, with no error.
  **Always use a `startTime` range.**

- ⚠️ **`source` casing is not canonical in live data:** the same sample holds both `Website` (78) and
  `website` (8). Compare case-insensitively; do not add a third spelling.

- `barberId` is inconsistent:
  - Walk-ins: lowercase barber NAME
  - Online (BookingPage): barber doc id + `barberName` field
  - Always match against both id and name (lowercased)

- `booking.duration` (minutes): the truth source for online bookings.
  `parseInt(booking.duration)` — use before the service lookup (variations break service list)

- `endTime` shape differs:
  - Dashboard: label string ("2:00 PM")
  - Bookings.jsx / Clients.jsx: raw Timestamp
  - `conflictUtils.getExistingRangeMinutes` handles both — keep this

- `bookingId`: **NOT the Firestore doc id.** Email cancel/reschedule links carry this field.
  The prefix list in this file used to name three; the live data has at least **eight**
  (same 1,200-document sample, 2026-09-09): `WCB-` 705 · `HIST-` 368 · `BOOKSY-` 64 · `WEB-` 18 ·
  **`walkin-` 13 (lower case)** · `FRESHA-` 10 · `SALE-` 8 · `TREATWELL-` 8 — plus `BLOCKED-`.
  **Never branch on the prefix as if the set were closed**, and match it case-insensitively.

- Status normalize: via `normalizeBookingStatus`. Blocking: `CONFIRMED`, `PENDING`, `UNPAID`, `BLOCKED`.
  Non-blocking: `CANCELLED`, `NO_SHOW`, `DELETED`, `CHECKED_OUT`, `COMPLETED`.
  *Checked 2026-09-09: **zero** lower-case `status` / `paymentState` / `paymentType` values in a
  1,200-document sample. That is a sample, not a proof over the whole collection — **keep normalising
  on read**; the guard costs nothing and one legacy import would defeat the sample.*
  ⚠️ Imports may bring lowercase 'checked_out' — normalize on load.

## Client Identity — Critical Rules

- Booking → client link: `clientManualId` (Firestore doc ID) → `clientPhone`/`clientEmail` exact match → `_aliases` → normalized phone (last 10 digits).
- **Never match by name** — if phone or email exists.

- `_aliases`: string array on the client doc. When a phone/email is changed the OLD value must be added to `_aliases` via `arrayUnion`.

- Lookup order (`checkoutBooking`, `getClientLoyaltyPoints`):
  1. `clientManualId` direct doc read
  2. Exact phone query → exact email query
  3. Full scan: aliases + normalized phone
  4. Name-only fallback: ONLY if the booking has no phone AND no email
  5. If all fail, create a new client doc

## Money & Loyalty

- `loyalty.cashbackPct` tenant-configurable — `settings.loyalty.cashbackPct`
- `loyaltyRedeemedValue` (£) written to the booking at checkout
- `bookingNetWithoutTip`: first `loyaltyRedeemedValue`, fallback `points / 20` (legacy, don't touch)
- `paidAmount`: the deposit amount for DEPOSIT bookings. NOT reset on edit/reschedule.
- On CHECKED_OUT bookings `paidAmount` = full previous total — on re-checkout don't treat it as a deposit, use `platformDepositAmount`.
- `pp()` preserves negative values (refunds). Don't strip the minus sign.

## Staff access — two axes, never one (S4A)

Full contract: [STAFF_ACCESS_CONTROL.md](STAFF_ACCESS_CONTROL.md).

- `barbers/{id}.status` (`active`/`passive`/`leave`) = **assignability** — can a booking be
  assigned *to* them. It does **NOT** control app access, and must never be wired to it:
  an owner who stops taking clients is a `passive` barber who still runs the salon.
- `staff/{uid}.accessStatus` (`active`/`suspended`/`offboarded`) = **account access**.
  **Absent ⇒ active** (every pre-S4A doc lacks it); a present-but-unrecognised value
  (`'ACTIVE'`, `''`, `'leave'`, …) **fails closed**. `leave` is never an access value.
- Denials return one code, `ACTOR_OFFBOARDED` → `permission-denied`. The precise state is
  in the audit record, never in the client response.
- Also on the staff doc: `accessStatusUpdatedAt` / `accessStatusUpdatedBy` /
  `accessRevocation{opId,op,stage,startedAt,completedAt,actorUid}`.
- `staffAccessOps/{opId}` — the resumable offboard/re-enable state machine's records.
  `opId` derived from `(op, tenantId, actorUid, rawKey)`; the raw client key is never the
  doc id. Audit written at the derived id `auditLogs/staffaccess_{opId}` = exactly-once.
- ⚠️ `staffAccessOps` has **no `firestore.rules` entry yet** — server-only writes today
  (Admin SDK bypasses rules); S4B must add one before any client reads it.

## parserTombstones

`parseBooksyForTenant`: on every successful import writes `parserTombstones/SLOT-Booksy-{date}-{time}`.
Two different emails for the same booking → different externalId → this tombstone prevents the duplication.


## FIN-B1 settlement ledger — ⚠️ **SOURCE ONLY, NOT IN PRODUCTION** (2026-09-09)

**Do not read these as live shapes.** The code exists (`whitecross-site/functions/settlements.js`,
commit `8137711b`) and passed 182/182 tests and the `salown-staging` rehearsals, but **nothing of it
is deployed**: no `wcSettlementSweeper` among the 121 live functions, `settlementLedgerEnabled` absent
from the live ruleset, and the supporting index absent from production (all three re-verified read-only
2026-09-09). The **contract lives in [`PROCESSOR_FEES_PLAN.md`](PROCESSOR_FEES_PLAN.md) §2** — it is not
restated here, because two descriptions of one contract is how they drift. This is the *location* map only.

| Path / field | What it is |
|---|---|
| `tenants/{tid}/bookings/{docId}/settlements/{entryId}` | The **append-only ledger**. `entryId` = the provider object id, so a redelivery writes the same document (create-if-absent → no-op). Never edited, never deleted; a correction is a `COMPENSATION` entry |
| `bookings/{docId}.settlementProjection` | **DERIVED**, recomputed from *all* entries inside the appending transaction — never incremented. Rebuildable at any time. Readers read only this |
| `bookings/{docId}.settlementSync` | **Operational marker**, not money: `state` (`pending`/`done`/`failed`/`unresolvable`), `attempts`, `nextAttemptAt`, `lastError` |
| `tenants/{tid}/platform/settlementScan` | The provider-scan cursor (`scannedUntil`, page cursor). Advances only after a page is fully applied |
| `tenants/{tid}/platform/settlementScan/unmatched/{id}` | Charges that could not be bound to a booking — persisted with backoff so they are **visible**, never dropped |
| `settings/settings.settlementLedgerEnabled` | **The kill switch.** Absent or `false` ⇒ every writer is inert (no marker, no entry). Owner-only in the *candidate* rules; those arms are not live yet |

**Index it needs:** `bookings` COLLECTION on `settlementSync.state` + `settlementSync.nextAttemptAt` —
in `salown-app/firestore.indexes.json`, **not deployed**.
**Release gate:** [`FIN_B1_RELEASE_PREFLIGHT.md`](FIN_B1_RELEASE_PREFLIGHT.md).
