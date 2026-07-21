# Staff App — Pre-Capacitor Hardening (Working Report)

> **Goal:** Close inconsistencies and gaps BEFORE wrapping the staff app in native (D1 Capacitor — see [D1_CAPACITOR_NATIVE_PLAN.md](D1_CAPACITOR_NATIVE_PLAN.md)). Once wrapped in native, every fix means two layers (web+store); so the cleanup is done NOW, while still a PWA.
>
> **Source:** 3 parallel agent audits (data-consistency · UX/missing-state · aggregator source-consistency) + the owner's "244" incident (see [[edit-log-salown]]). Date: 2026-07-14/15.
>
> **Status key:** ✅ LIVE (fixed+deployed) · 🔧 REMAINING (code work, queued) · 🎨 DESIGN (owner decision/architecture needed) · ⚪ ACCEPTED (deliberately left).
>
> **Multi-device:** This file is pulled on other machines via `git pull`. When an item is done, set the status to ✅ + commit-hash, and log a record in [[edit-log-salown]].

---

## 📌 SESSION STATUS — 2026-07-14/15 (last-update snapshot)

### ✅ DONE (all live + pushed)
| Work | Commit | Status |
|---|---|---|
| Sales/Week revenue `bookingNetWithoutTip` (synced with panel) | salOWN `79d034a` | ✅ LIVE |
| Today "Est. revenue" converging estimate (checkout=net, not-arrived=price) | salOWN `b725434` | ✅ LIVE |
| Pre-Capacitor Tier 1-2: parsed £0-checkout, raw-status, customer-spend net, "Today" fixed-date, Booksy empty-barber, Sales row/grouping | salOWN `0df2beb` (bundle `staff-DJvCvRYK.js`) | ✅ LIVE |
| D1 Capacitor native plan (ready and waiting, no rush) | docs `fa25129` (`D1_CAPACITOR_NATIVE_PLAN.md`) | 🅿️ WAITING |
| This report + ROADMAP D0/D1 + T3-8 source-based fix | docs `ab1dc59`/`042da6c`/`ce9b9ff` | ✅ RECORDED |

### 🔜 REMAINING — up next (owner direction: "salOWN is master, preserve the edit")
1. **🟢 Cancel tombstone** — `cancelBooking` → `parserTombstones` (so a late email can't resurrect a cancelled one). *Safest, do this first.*
2. **🔴 Parser clobber guard** — a field-level flag when a booking is manually edited (`barberManuallySet`); `booksy.ts:280` reschedule-apply should not overwrite the barber (the time may come). ⚠️ live pipeline → tested+targeted deploy.
3. **🟠 Barber re-assignment in the staff app** — fixing mis-assignment from the phone (currently panel-only); when written it sets flag #2.
4. **🔧 UX remainders** (in the tiers below): push silent-error banner (T2-7), empty-state/access message (T4-10), reschedule hour-guard (T4-11), silent-error swallowing (T4-12).
5. **🅿️ D1 Capacitor** — when the product matures (owner is not rushing).

**Suggested next action:** #1 → (#2+#3 together). Awaiting owner approval.

---

## ✅ Fixed this round — `salOWN 0df2beb` (2026-07-15, CI staff deploy, bundle `staff-DJvCvRYK.js`)

All of these use shared helpers (`bookingNetWithoutTip` / `normalizeBookingStatus` / `resolveBarber`) → the screens match the web panel, and past records also render correctly.

| # | Problem | File | Fix |
|---|---|---|---|
| T1-1 | Parsed booking checked out at £0 (silent revenue loss) | `staff/sheets/CheckoutSheet.tsx:37` | `basePrice` falls back to `paidAmount`/`platformDepositAmount` when `price` is empty |
| T1-2 | Sales raw status comparison → old/variant statuses drop | `staff/views/SalesView.tsx:88` | filter with `normalizeBookingStatus(b.status)` |
| T1-3 | Customer total spend from raw `price` (conflicts with Sales) | `staff/sheets/ClientDetailSheet.tsx:110,134` | `bookingNetWithoutTip(data)` → `netRevenue` |
| T2-4 | Booking detail always "Today" (wrong-day risk) | `staff/sheets/BookingDetailSheet.tsx:172` | real date label from `startTime`/`date` |
| T2-5 | Barber "—"/empty on Booksy/online booking | `BookingDetailSheet.tsx` + `CheckoutSheet.tsx` (+ StaffRouter prop) | `resolveBarber(booking, barbers)` |
| T2-6 | Sales transaction rows don't match the header total + barber grouping splits walk-in/online | `staff/views/SalesView.tsx:373,146,162` | row `bookingNetWithoutTip`; grouping unified via `resolveBarber` |

**Prior related fixes (same week):** Sales/Week revenue `bookingNetWithoutTip` (`79d034a`), Today "Est. revenue" converging estimate (`b725434`).

---

## 🔧 REMAINING — code work (upcoming rounds)

### T2-7 · Push registration silently fails (high)
`staff/StaffApp.tsx:159` — if permission is denied/token can't be obtained, only a `console.warn`; the user gets no notification but doesn't know. **To do:** keep the permission state in state; add a "Notifications off — tap to enable" banner to `ProfileView` + redirect to Settings. (Once native, push is critical → close before D1.)

### T4-10 · Misleading empty state (medium)
`staff/views/TodayView.tsx:340` — `canViewAllBookings=false` + no barber-binding → shows "All clear · No bookings" on a full day. **To do:** if no permission, show "You don't have access to the schedule" (empty-day ≠ no-access).

### T4-11 · No reschedule opening-hours guard (medium)
`staff/sheets/RescheduleSheet.tsx` — slots are fixed 08:00–22:00, no closing warning (present in NewBookingSheet). **To do:** base it on opening hours or at least an "outside opening hours" warning.

### T4-12 · Silent error swallowing → duplicate customer (medium)
`staff/components/ClientSearch.tsx` + `TodayView.tsx:279` — `.catch(()=>{})`. If the customer list doesn't load, search returns empty, the barber creates a duplicate record. **To do:** a small "couldn't load — retry" indicator on error.

### T4-16 · No CheckoutSheet discard-guard (low)
Closing by accident loses the entered tip/discount/method without warning (other sheets have `window.confirm`). **To do:** dirty-guard.

### Other low
- **T4-13** MEMBER badge from knowingly wrong data (`ClientsView.tsx:35`, `ClientDetailSheet.tsx:137`) — hide the badge until backfill. ⚪/🔧
- **T4-14** Notifications only in memory (`StaffRouter.tsx:62`) — the bell resets on refresh. Could move to Firestore (merge with the G1 per-person notification work).
- **T4-15** Source differs in two places in detail ("salOWN" pill vs raw "salown" row) `BookingDetailSheet.tsx:174`; no source at all in WeekView.
- **T2-9** Booksy `duration` defaults to 30 min when absent `RescheduleSheet.tsx:87` — the parser doesn't write duration.

---

## 🎨 DESIGN — owner decision / architecture needed

### T3-8 · External sync — SOURCE-BASED (owner clarified 2026-07-15)
The audit's "no write-back at all" generalization was WRONG. The real situation varies by source:

| Source | Sync channel | Status | Reliability in salOWN |
|---|---|---|---|
| **Treatwell** | **iCal import** (`functions/src/parsers/ical.ts`) | ✅ LIVE | Full lifecycle comes through — event `STATUS:CANCELLED` → salOWN booking CANCELLED (ical.ts:98-107), reschedule too (`:179`). The Treatwell side reflects into salOWN automatically. |
| **Fresha** | iCal import | ⏳ SOON | When the same mechanism arrives it will be reliable like Treatwell. |
| **Booksy** | Email-parse only | ⚠️ FRAGILE | NO calendar/iCal feed. Write-back is impossible. Two paths: **(a) build a bridge** (big job) **or (b) for now BUFFER + MANUAL BLOCK** to prevent double-booking. |

**iCal note:** iCal is INBOUND (external platform → salOWN). There is no PUSH-back from salOWN to Treatwell/Fresha; but since those platforms are their own source, managing there + salOWN reflecting is the correct flow. So staff editing a Treatwell/Fresha booking in salOWN is meaningless (the next iCal pull overwrites it).

**Owner business model (2026-07-15, CRITICAL):** "The real place to consolidate correctly is US (salOWN master)." Booksy assigns a random barber; if the chosen barber isn't available, **we switch to the correct barber immediately in salOWN.** So editing an external booking IS WANTED — "disable the edit" would be WRONG. Push-back to Booksy is anyway impossible/unnecessary (the customer sees it in Booksy, the shop works in salOWN).

**Real risk (code-verified):** `functions/src/parsers/booksy.ts:277-285` reschedule-apply → `existingRef.update({ startTime, ...(r.newBarber ? { barberId: r.newBarber } : {}) })`. Because the Booksy reschedule email carries "with {barber}", it **overwrites the manually made barber correction.** No protective flag exists in the repo. Also there is NO barber re-assignment UI in the staff app (`RescheduleSheet` is time only) → the owner is currently doing this from the panel.

**Correct work (per the owner model, "salOWN master + preserve the edit"):**
1. **🔴 Parser clobber guard (backend, highest value):** when a booking is manually edited write a `manualOverride`/`barberManuallySet` flag; the parser reschedule-apply should NOT overwrite the `barberId` (and the time if needed) when this flag is set. ⚠️ `booksy.ts` = live pipeline, most sensitive (CLAUDE.md "parser last") → with a characterization test, targeted deploy.
2. **🟠 Barber re-assignment in the staff app:** a barber picker in RescheduleSheet (or BookingDetail) — let the owner fix mis-assignment from the phone too (currently panel-only). When written it should set flag #1.
3. **🟢 Cancel tombstone:** write `cancelBooking` to `parserTombstones` like delete → so a late reschedule-email can't resurrect a cancelled booking. Safe independent of source.
4. **Buffer + manual block:** since Booksy has no calendar feed, capacity safety is operational (Quick Block already exists). A bridge = later.

> The OLD (wrong) direction "disable/warn on Booksy reschedule" is CANCELLED — the owner treats salOWN as master, the edit IS WANTED; what must be protected is the edit's persistence.

---

## Scope note (spacious/grid-free aesthetic)
Owner decision: the app is **spacious, list-focused, not a grid**. None of the items above require a grid/compression — they are all logic fixes or small labels/warnings. The suggestions are given per this aesthetic.

## Verified working correctly (do not re-audit)
Empty states + skeletons on-brand; Cancel/No-show two-tap inline confirm; SaveOverlay success feedback consistent; revenue permission gating (canViewRevenue) consistent in SalesView/WeekView/BottomNav; date/tz everywhere `ukDayRange`/`ukWeekRange` (BST-safe), NO `toISOString().split` in staff views/sheets.
