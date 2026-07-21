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
    staff/               ← staff accounts + roles
    emailOptOuts/        ← GDPR: opt-out records for unknown clients
    auditLogs/           ← booking audit trail
    parserTombstones/    ← deduplication guard (e.g.: SLOT-Booksy-{date}-{time})
```

## Booking Model — Critical Quirks

- Walk-in bookings (`createWalkIn`): NO `date` field — only `startTime` (Firestore Timestamp).
  **Never query by the `date` field** — use a `startTime` range.

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

- `bookingId`: `WCB-{ts}-{rand}` (walk-ins), `SALE-`, `BLOCKED-` prefixes.
  **It is NOT the Firestore doc id.** Email cancel/reschedule links carry this field.

- Status normalize: via `normalizeBookingStatus`. Blocking: `CONFIRMED`, `PENDING`, `UNPAID`, `BLOCKED`.
  Non-blocking: `CANCELLED`, `NO_SHOW`, `DELETED`, `CHECKED_OUT`, `COMPLETED`.
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

## parserTombstones

`parseBooksyForTenant`: on every successful import writes `parserTombstones/SLOT-Booksy-{date}-{time}`.
Two different emails for the same booking → different externalId → this tombstone prevents the duplication.
