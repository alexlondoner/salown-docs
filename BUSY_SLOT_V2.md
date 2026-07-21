# BUSY_SLOT_V2.md — Multi-Interval Availability Engine + Channel Architecture

> **Status (2026-06-26):** LIVE — **DYNAMIC / service-based**. The tenant-wide
> `features.processingTime` flag has been REMOVED (commit f958aee). The engine + grid render +
> staff bundle are now driven by the service's own `segments` config: a service with a processing
> window opens a gap + squeeze-in; a service without one is a single-solid-interval (identical to v1). The
> "feature flag" / "not enabled until Phase 4" statements below are HISTORICAL — the flag no longer exists.
> OUT OF SCOPE (still): public `BookingPage` + email-parser bookings do not write a segment snapshot
> → they stay solid in the grid (Phase 5b). The salOWN→Treatwell iCal feed split (Phase 5a) was not done.
> **Owner:** Alfa (Whitecross owner + dev)
> **Goal:** Add *processing time* (dye waiting etc.) support to services so that a
> barber/hairdresser can take **another customer** during a customer's processing (waiting)
> time — and fit this into salOWN's multi-channel (aggregator) structure.
>
> ⚠️ This document changes the **most sensitive place** in the codebase (`conflictUtils.js` / busy-slot).
> See: `INCIDENTS.md`. No change ships to production without it being **proven** that the
> existing behavior is preserved exactly.

---

## 1. Problem & Goal

### Today
- Every booking occupies a single uninterrupted `[start, end]` interval in the barber's calendar.
- If two bookings are on the same barber + overlapping time interval → conflict, the second is blocked.
- **There is NO concept of processing time / gap / parallel booking.** (Verified: the codebase has no
  `processingTime`, `gap`, `buffer`, `parallel`, `capacity` (in booking logic).)

### Desired (owner decision)
- A service should be divisible into 3 parts:
  `[ active-before ][ processing (empty) ][ active-after ]`
- **The processing window is considered physically empty** → a **second booking** from a walk-in, the salOWN
  site, Treatwell, or any channel can drop into that interval.
- The single-physical-chair reality is channel-independent: whichever channel creates the gap,
  whichever channel fills it, the salOWN calendar shows the unified single truth.

### Industry context
This is the standard **"processing time"** feature in the industry (Square, Vagaro, Fresha, Treatwell).
For barbers (Booksy/Fresha are mostly barber) processing generally doesn't exist; the real need
is in hairdresser/salon services (dye, balayage, perm) — on the Treatwell side.

### Aggregator angle (salOWN's trump card)
salOWN is **the single system that sees all channels at once.** The only place that can fill the gap in
the middle of a dye appointment coming from Booksy — with a walk-in or site customer — can be
salOWN, because single-channel tools can't see the gap created by the other channel.
This feature is positioned as "cross-channel gap-filling."

---

## 2. Current engine (reference — the code we will change)

**`src/utils/conflictUtils.js`**

```js
// getExistingRangeMinutes(booking) → { start, end } | null
//   duration source: if BLOCKED, endTime; else booking.duration;
//   else startTime/endTime timestamp diff; else service.duration; else 30min.

export function hasTimeConflict(existingBookings, options) {
  const { dateValue, barberValue, startMinutes, durationMinutes, ignoreBookingId } = options;
  const endMinutes = startMinutes + durationMinutes;
  return (existingBookings || []).some((booking) => {
    const st = normalizeBookingStatus(booking.status);
    if (st === 'CANCELLED' || st === 'NO_SHOW' || st === 'DELETED'
        || st === 'CHECKED_OUT' || st === 'COMPLETED') return false;   // doesn't block
    if (ignoreBookingId && booking.bookingId === ignoreBookingId) return false;
    if (barberKey(booking.barber) !== barberKey(barberValue)) return false;
    if (booking.date !== dateValue) return false;
    const existingRange = getExistingRangeMinutes(booking);
    if (!existingRange) return false;
    return startMinutes < existingRange.end && endMinutes > existingRange.start;  // overlap
  });
}
```

**Blocking statuses:** `CONFIRMED, PENDING, UNPAID, BLOCKED`
**Non-blocking:** `CANCELLED, NO_SHOW, DELETED, CHECKED_OUT, COMPLETED`

**Call sites (all must pass the parity test):**
- `BookingForm.jsx:114, :150` — in-form + before save
- `BookingDetailPanel.jsx:986` — reschedule (with `ignoreBookingId`)
- `Dashboard.jsx` (WalkInForm) — walk-in creation
- `BookingPage.jsx:~400` — public slot generation
- `functions/index.js` `salownGetBusySlots` — public availability (separate implementation, **must carry the same segment logic**)
- `whitecross-site/script.js` — separate codebase, must be kept in sync (see: BUSINESS_RULES no-preference)

---

## 3. New engine: multi-interval (segmented) busy

### 3.1 Core change

`getExistingRangeMinutes(booking)` → **`getBusyIntervals(booking)`**: returns an **array** of intervals
instead of a single interval. The gap(s) in between are free.

```
getBusyIntervals(booking):
  no processing   → [ {start, end} ]                                    // EXACTLY same as today
  has processing  → [ {start, start+activeBefore}, {end-activeAfter, end} ] // middle empty
  BLOCKED         → [ {start, end} ]                                    // always a solid block
```

> If 3+ segments are needed in the future (e.g. multi-stage processing) the array structure carries this naturally.
> In the first version, only 2-active-1-empty is sufficient.

### 3.2 Conflict rule (multi × multi)

If the new booking's own busy intervals (it too may have processing) intersect with the existing
booking's busy intervals for **any pair** → conflict.

```
conflict(new, existing) =
  for some A in new.intervals,
  for some B in existing.intervals,
  ∃ (A, B): A.start < B.end && A.end > B.start
```

Since the gap is not in the list, a new booking that **fits exactly** in the gap does not intersect
any active interval → **allowed.** A new booking that overflows the gap (enters an active segment) → **blocked.**

### 3.3 Segment resolver

```
getServiceSegments(booking):
  1. if the booking carries explicit segments (native salOWN booking or two-way Treatwell)
       → use them
  2. else find the processing setting in the service's channel-profile, REBUILD the
       segments from start+duration   ← the Booksy solid-70min dye scenario lands here
  3. if none → single solid block [start, end]   (today's behavior)
```

Step 2 is critical: even if Booksy sends the dye as a solid block, salOWN knows that service's processing
profile and opens the gap **physically**.

### 3.4 Invariants
- `ignoreBookingId` (reschedule self-ignore) is preserved as-is.
- The non-blocking status list (`CANCELLED/NO_SHOW/CHECKED_OUT/...`) is preserved as-is.
- `barberKey` + `date` matching is preserved as-is.
- The duration fallback chain is preserved as-is (segment-less booking = single interval = old result).

---

## 4. ⭐ Safety foundation: the "zero behavior change" property

**Right now no service has processing defined.** Therefore, even if the multi-interval engine is
written, **every existing booking produces exactly one interval** → mathematically the same as
today's output.

This lets us land the risky refactor without changing behavior at all:

```
Step A: Convert the engine to multi-interval, enable processing NOWHERE
        → output must be identical (prove with tests)
Step B: Verify old==new across all existing booking data
Step C: On a single pilot service (Whitecross) enable processing behind a feature flag
```

**Rule:** The processing feature **is not enabled on any tenant** until the engine passes the
"identical behavior" tests. Flag default = off.

---

## 5. Channel architecture

### 5.1 Channel layers

> **CLEAR:** The Treatwell integration is NOT a **write/two-way API.** There are two one-way iCal
> mechanisms; **the operational one is OUT:**
> - **OUT (salOWN → Treatwell) — ✅ THE ACTUAL WORKING ONE:** `salownIcalFeed` (`functions/index.js:1373`)
>   publishes a public iCal busy feed (`?tenantId=...`, `text/calendar`). Treatwell subscribes to it;
>   every slot that is busy in salOWN occupies "blocked time" in the Treatwell calendar. Wherever it
>   gets filled from (Booksy/Fresha/site/walk-in) it enters the feed and blocks Treatwell.
>   **No booking write/modify — only a busy block.**
> - **IN (Treatwell → salOWN) — exists in code, but gated:** `parseTreatwellIcalForTenant()`
>   (`functions/index.js:2586`) imports the Treatwell iCal URL; the `features.treatwellIcalSync`
>   flag is **default `false`** (line 374) → not operational on Whitecross. The "Treatwell email"
>   parser is a separate IN option.

| Channel | IN (to salOWN) | OUT (from salOWN) | Processing |
|---|---|---|---|
| **Treatwell** | iCal import (`treatwellIcalSync`, default off) / email parser | ✅ **`salownIcalFeed`** busy feed (the main mechanism) | ✅ yes |
| **Booksy / Fresha** | email parser | **manual** (they don't subscribe to the salOWN feed; external tool later — Peepeet) | ✗ (barber-focused) |
| **Walk-in / salOWN site** | native | included in `salownIcalFeed` | ✅ (salOWN profile) |
| **WhatsApp / Telegram / Instagram** | native / manual (optional) | included in `salownIcalFeed` | salOWN profile |

> **`salownIcalFeed` current behavior (which we will change):** −14/+90 day window;
> busy statuses `CONFIRMED, CHECKED_OUT, PENDING, BLOCKED` (line 1398); each booking →
> **one VEVENT**, the whole `[startTime, endTime]` span (line 1426). Processing support =
> splitting that single VEVENT, for a processing booking, into **two active-segment VEVENTs**.

### 5.2 Per-channel service profile

Processing is a **channel-dependent, not global** setting. The same service can be processing-enabled
on Treatwell and a solid block on Booksy.

```
Service "Hair Dye"
├── base:            { duration, price }            // salOWN default
└── channelProfiles:
    ├── treatwell:   { activeBefore:20, processing:30, activeAfter:20, out:"ical-busy", in:"email-parser" }
    ├── booksy:      { duration:70, out:"manual", in:"email-parser" }
    └── walkin:      { duration:70 }
```

**Golden rule:** Whichever platform the user is using, salOWN's profile for that channel must be
**aligned** with the setting on that platform. salOWN = the mirror / superset of every connected platform.

### 5.3 Physical reality vs. channel visibility
- **The physical busy map is unified** (a single segmented timeline per barber).
  Bookings from all channels contribute to it.
- **The channel profile** is used for two things:
  1. To *reconstruct* the incoming booking's segments (Booksy solid-block → open a gap).
  2. What we *export* outward (which hours go out as busy to the Treatwell iCal feed).

### 5.4 iCal export = the union of active segments (critical link)
> ✅ **VERIFIED:** The export mechanism is `salownIcalFeed` (`functions/index.js:1373`).
> The change is made exactly here.

The Treatwell leg of the processing feature depends **entirely** on the VEVENTs that `salownIcalFeed` produces:

- If the iCal feed publishes **the whole span** as busy for a booking → Treatwell can't take a booking
  into that gap (today's behavior).
- If the iCal feed publishes **only the active segments** (`getBusyIntervals` output) as busy →
  the processing window in the middle appears **empty** in Treatwell and a booking can drop into it.

So `getBusyIntervals` is the **single source** feeding both the in-app conflict engine **and** the iCal export.
A processing dye → **two** VEVENTs to iCal (active-before + active-after), with a gap between.

**Latency warning:** iCal feeds are periodically **polled** by Treatwell (not instant — minutes/hours).
Gap availability is therefore not real-time; this amplifies the double-booking/no-show risk in §9.
Keep the iCal as fresh as possible.

**Echo/dedup warning:** OUT (iCal busy) and IN (email parser) are separate mechanisms — salOWN must not
**import** back the busy block it exported itself. Treatwell-origin bookings come only from the
email parser, with `externalId` dedup (see: PARSER_NOTES).

---

## 6. Data model changes

> All are **data/schema** additions — they don't change behavior on their own. Behavior depends on the flag.

- **Service doc** (`tenants/{id}/config` services or the service collection):
  `channelProfiles` map + `processing` fields (`activeBefore`, `processing`, `activeAfter`).
- **Booking doc** (optional): explicit `segments` or `processingTime` snapshot on native/two-way bookings
  (so the past booking stays fixed even if the service changes later).
- ~~**Feature flag:** `features.processingTime` (tenant doc) — default `false`.~~ **REMOVED
  (2026-06-26).** Activation is no longer a tenant flag but the service's `segments` config: a service
  with a processing window opens a dynamic gap. The `features.processingTime` field is not read (no longer
  consumed in tenant docs; can be cleaned up but harmless).

---

## 7. Grid render (separate and low-risk — AFTER the engine)

Addressed after the engine's correctness is proven. It is **independent** of the conflict logic.

- **Day view (`TimeGrid.jsx`):** currently cards stack on top of each other in the same column (no column
  splitting). The processing region should be drawn **hatched/transparent**; the second card dropping into the
  gap should be placed in that region. The column-slotting logic of the week view can be adapted here.
- **Week view (`Dashboard.jsx`):** already has overlap column-slotting (`cols[]` algorithm);
  the processing visual is added.
- The booking card's processing interval is shown visually as "empty but reserved."
- **Squeeze-in badge:** a booking taken into another booking's processing gap is shown in the grid with
  a distinctive marker (so staff understand "this was squeezed into X's waiting time").

> **Out of scope (separate feature):** the "customer must be ready 5 min early; if they don't come the slot
> fills, they are re-queued to next-available" flow is a **check-in / no-show** feature; it is **not merged**
> with the busy-slot v2 engine (scope kept narrow). Addressed separately later.

---

## 8. Test matrix (proof layer — does not touch production)

| Test | Proof |
|---|---|
| **Characterization (golden)** | Real booking export: for each booking `getBusyIntervals` length=1 and `==` old `getExistingRangeMinutes`. → zero regression on existing data |
| **Conflict parity** | (existing bookings × candidate new booking) matrix, processing OFF: `new hasTimeConflict == old`. Wide scan over the time grid |
| **Gap-fill (new)** | Booking fitting exactly in the gap → allowed. Overflowing the gap → blocked. Hand-computed |
| **Active conflict (new)** | If the new booking's active segment touches the existing active segment → blocked |
| **Nested / interleaved** | Two processing bookings nested → pairwise correct |
| **Reconstruct (Booksy)** | Solid-block import + service profile → gap opens correctly |
| **Reschedule self-ignore** | With `ignoreBookingId`, doesn't conflict with its own segments |
| **BLOCKED** | Always a single solid interval, no gap |
| **Edge: gap < min service** | An unfillable gap causes no problem (just stays empty) |
| **Public availability parity** | `salownGetBusySlots` output gives the same segment as the app engine |

**Optional — shadow mode:** run the new engine read-only in production for a while, logging its
deviation from the old result; without reflecting it to the user, a final assurance before the flip.

---

## 9. Open questions (must be settled before writing code)

1. ~~**Treatwell OUT mechanism**~~ → **RESOLVED:** OUT = `salownIcalFeed`
   (`functions/index.js:1373`), the busy feed Treatwell subscribes to. No write API but
   none is needed either — splitting the feed's VEVENT content into segments with `getBusyIntervals`
   is enough. salOWN is the effective master in the gap definition. See §5.1, §5.4.
2. ~~**iCal latency / double-booking**~~ → **DECISION:** First-come-first-served, NO slot
   protection. If two channels drop into the same gap: if the second doesn't fit the engine rejects it;
   if it fits, both are valid, handle it operationally. Keep the iCal as fresh as possible (not a real-time
   guarantee).
3. ~~**No-show risk**~~ → **DECISION (owner):** Gap-fill is free to ALL channels; the only constraint is
   fitting in the gap (the engine already guarantees this — a booking that doesn't fit conflicts with the
   active-after segment and is rejected). The late original customer's slot is **not protected**; if their
   spot got filled, re-book to "next available". **Operational rule:** the customer must be ready 5 min
   before the appt. The "5min-early + re-queue" flow is **OUT of scope of the v2 engine** — a separate
   check-in/no-show feature. No extra conflict logic is NEEDED on the engine side.
4. **Config alignment:** The processing setting is defined separately in both salOWN and the Treatwell panel.
   Is keeping it manually aligned enough, or should salOWN show a "mismatch warning"?
5. **Segment snapshot:** Should past bookings be frozen when the service profile changes? (Proposal: yes,
   write a segment snapshot when the booking is created.)

---

## 10. Phases

| Phase | Content | Risk | Prod behavior change |
|---|---|---|---|
| **0** | (Separate work) No-show badge + past/future cancelled visibility | Low | Render only | ✅ |
| **1** | Data model: `channelProfiles` + processing fields + feature flag (off) | Low | No | ✅ |
| **2** | Engine: `getBusyIntervals` + multi×multi conflict + `getServiceSegments`. Characterization + parity tests GREEN | **High** | No (flag off, identical) | ✅ |
| **3** | Grid render: processing visual + nested second card | Medium | Visual | ✅ |
| **4** | ~~Pilot: turn on flag on a single service~~ → **DYNAMIC**: flag removed, service-based automatic (panel + staff bundle). Pre-flight: only 1 processing service on herohairs | Medium | Yes (service-based) | ✅ 2026-06-26 (f958aee + 5dbdf31) |
| **5a** | `salownIcalFeed` (`functions/index.js:1373`) publishes 2 VEVENTs for a processing booking → Treatwell sees the gap as empty | High | Yes (Treatwell availability) | ⬜ |
| **5b** | Public booking page + `salownGetBusySlots` serve gap slots (including online/parser snapshot) | High | Yes | ⬜ |
| **6** | Channel expansion: Booksy/Fresha OUT automation (Peepeet), messaging channels | — | Yes | ⬜ |

**Ordering rule (historical):** Phase 3+ did not start until Phase 2 tests were green. ~~The flag is not
enabled on any tenant until Phase 4.~~ → In Phase 4 the flag was removed entirely; activation is now the
service's processing config. Next: Phase 5b (online/parser snapshot + public gap slots), Phase 5a (iCal split).

---

## Related documents
- `BUSINESS_RULES.md` — slot generation, no-preference assignment, reschedule invariants
- `INCIDENTS.md` — records of past breakage of conflict/slot logic
- `MANIFESTO.md` — "grabbing" / aggregator philosophy
- `FIRESTORE_SCHEMA.md` — booking model quirks (duration, endTime shapes)
