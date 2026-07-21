# BUSINESS_RULES.md

## Campaign & Email Sending Rules (salOWN's built-in rules — GDPR + deliverability)

> These are **fixed rules** (NOT a per-tenant setting — deliberate). Purpose: don't land in the spam folder + comply with GDPR/consent. Can be made dynamic later if needed; for now it's salOWN's opinion.

- **Re-engagement suppress (30 days):** When "We miss you" is sent to a customer, `clients/{id}.reengagementSentAt` is stamped. A customer stamped **in the last 30 days** is NOT re-engaged again:
  - Home lapsed reminder → hides them from the list (30 days).
  - Bulk campaign lapsed segments (lapsed30/60/90) → **removes** them from recipients if `reengagedAtMs` is within the last 30 days (`BulkCampaignPanel`, `REENGAGE_SUPPRESS_MS`; the audience carries `reengagedAtMs`).
- **Birthday suppress:** someone who received a birthday campaign the same year → not sent again, via `birthdaySentYear`.
- **Opt-out / suppression (GDPR + spam-safety):** email is NEVER sent if:
  - `client.emailOptOut === true` (our unsubscribe link → `salownEmailOptOut`), OR
  - a Brevo **unsubscribed/spam/blocked** event arrived → `salownBrevoWebhook` writes the matching client's `emailOptOut=true` + `emailOptOutReason` → all filters (audience + server `sendCampaignBulk` guard) automatically respect it. **The single suppression mechanism.**
- **Engagement:** Brevo native open/click lands in `tenants/{id}/emailEvents/{emailKey}` (with the tenantId tag) → funnel + "engaged but not returned".
- **Sender:** transactional (Gmail or `noreply@salown.com`), every send carries a List-Unsubscribe header + an unsubscribe link.

## Cancel & Reschedule Policy

- **Cancel**: within the window (default 8 hours) free + **deposit refund** (if paid via Stripe Connect, `salownCancelByToken` issues an automatic refund). After the window closes, `salownCancelByToken` **rejects** the cancel (hard block, no self-service cancel — this is the code behavior, not "seizing money").
- **Reschedule**: allowed within the window (default 2 hours). After that → hard block ("call us").
- ⚠️ **Windows are tenant-configurable (2026-07-04):** `settings/settings.cancellationWindowHours` (default 8) + `rescheduleWindowHours` (default 2), the owner edits from Settings→General→"Booking policy". The functions read this value (the hardcoded 8/2 is gone); `0` = cancel/reschedule free up until the start.

## Slot Generation

- Last bookable start = closing time − 15 min (`LAST_START_GAP_MINS`)
- **For every service** — regardless of duration. Services may run past closing time (spillover).
- Do **NOT BRING BACK** the `start + duration <= close` check — the owner uses spillover analytics:
  Marketing heatmap striped cells + Spillover Summary → future working-hours decisions.
- This rule applies in both salown-app and whitecross-site — keep the two in sync.
- Conflict math still blocks the spilled time.

## No-Preference Barber Assignment (Both Sites)

When the customer doesn't pick a specific barber:
- Eligible pool = `service.barbers[]` (if non-empty, matched by barber doc ID; tolerant of legacy name entries)
- If no eligible pool → all active barbers
- Least-busy pick: **from within the ELIGIBLE pool**
- No eligible barber free → slot unavailable

Race-check (at submit): re-fetch `salownGetBusySlots`, verify the slot is still free. Network error → fails-open (the booking continues).

**No-preference race check (whitecross script.js):** if both `bId` and `bNm` are empty, the "slot is full" is only counted when ALL service-eligible barbers are blocked. Don't regress to a `some()` or `barbers[0]` fallback.

## Reschedule Modal — Invariants

- Conflict check: `hasTimeConflict(allBookings, {..., ignoreBookingId})` BEFORE save.
- Past date/time → hard block. Outside working hours → soft confirm.
- `rescheduledBy: 'staff'`, `rescheduledAt` are written.
- Audit action: `'RESCHEDULE'`
- `paidAmount` and `platformDepositAmount` are not touched on reschedule — the deposit travels with the booking.
- `hasTimeConflict` callers must pass `barberValue` lowercase.
- On barberId update: `barbers.find(b => b.name === selected).id` — don't fabricate from the display name.

## Dates & Timezone (UK)

- **NEVER** use `date.toISOString().split('T')[0]` — the day shifts under BST.
- Use `toDateKey()`: `src/utils/timeUtils.js`
- UK DST: `isUkDst` helpers (last Sunday of March/October, 01:00 UTC boundaries).
- Don't use the `month >= 4 && month <= 10` approximation.

`toStartAndEnd()` (whitecross script.js): `isUkDst()` + `Date.UTC` BST offset (-1h).
`new Date(dateStr + 'T00:00:00') + setHours()` → browser-local, don't use.

## Deposit Flow — NOT COMPLETE (Do Not Enable)

The salOWN tenant deposit flow is NOT production-ready:
1. No webhook to turn PENDING → CONFIRMED after Stripe payment
2. No confirmation email trigger on that transition
3. `salownSendBookingConfirmation`: not called for Stripe bookings (`!stripeOn` guard)
4. BookingPage PENDING bookings have no `expiresAt` → `cleanupExpiredPending` doesn't kick in

**The webhook + `expiresAt` MUST be built first — before enabling `features.stripe` / `websiteDepositsEnabled`.**

Whitecross (whitecross-site) has its own complete deposit flow — don't mix them.

## Barber Conflict — Platform Prepaid Flow

`isFullyPaidByPlatform = isPlatformBooking && (configuredPmt === 'prepaid' || booking.paymentType === 'FULL') && alreadyPaid > 0`

- If true: SummaryPanel shows "Prepaid by {source} ✓". PaymentStep skips the method grid.
- `depositAmount` fallback chain: `platformDepositAmount || paidAmount || priceFromBooking`
  (`priceFromBooking` is for iCal imports — no paidAmount)

## Actor Tracking

- `cancelledBy: 'customer'|'staff'`
- `rescheduledBy: 'customer'|'staff'`, `rescheduledVia: 'email-link'` (customer path)
- Both callables write to the `auditLogs` collection:
  `BOOKING_CANCELLED_BY_CUSTOMER` / `BOOKING_RESCHEDULED_BY_CUSTOMER`
