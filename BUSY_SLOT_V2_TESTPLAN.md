# BUSY_SLOT_V2_TESTPLAN.md — Comprehensive Test List (BEFORE deploy)

> Everything that needs to be tested on HeroHairs **before the processing-time / segment / channel
> features are deployed** + the problems that could occur. Pilot tenant: **HeroHairs**
> (has Treatwell + panel access). Design: `BUSY_SLOT_V2.md`, `SERVICE_CONFIG_V2.md`.
> Risks: `BUSY_SLOT_V2_RISKS.md`.
>
> **Status (updated 2026-07-22 — flag lifecycle re-verified against code):** The busy-slot **conflict engine**
> shipped **dynamic / service-`segments` based** — it no longer reads `features.processingTime` (engine
> flag-gate removed in `f958aee`, 2026-06-26). `features.processingTime` is classified **D) mixed transition
> state**:
> - **HISTORICAL:** any step/claim that treats `features.processingTime=false` as a **kill-switch that reverts
>   the engine** (it doesn't — the engine honours each booking's own `segments`).
> - **STALE — the flag does NOT gate the Services editor:** the `Services.tsx:154` read is **dead** (stored in
>   `pcEnabled`, never consumed — `:110` TODO). So **A1/A2 and Prerequisite-1 below no longer hold as written**
>   — the segment editor's visibility does not depend on the flag (see the rewritten A1/A2).
> - **STILL CURRENT (dormant):** the flag's one live read is the **Treatwell iCal split** (`salownIcalFeed`,
>   `functions/src/index.ts:1511` → `:1518`) — sections D/E, which also need a functions deploy. Dormant:
>   no supported path sets it `true` (see the Manual-activation note below).
> See ROADMAP for status; `BUSY_SLOT_V2_RISKS.md` → Rollback/Recovery for the recovery procedure.

## 🔴 ROLLBACK / RECOVERY (current — verified against code 2026-07-22)
**No single tenant-wide runtime kill-switch reverts the feature.** The in-app engine is service-`segments`
driven and ignores `features.processingTime`. To revert one service: clear its `segments` in the Services
editor (→ `service.segments = null`, single solid interval = v1). The flag's only live read is the Treatwell
iCal split (`salownIcalFeed`, `functions/src/index.ts:1511` → `:1518`); `features.processingTime=false` keeps
the feed on single-VEVENT, but it does not disable already-saved per-service processing in the engine, and it
is dormant (nothing sets it true). Full detail: `BUSY_SLOT_V2_RISKS.md` → Rollback/Recovery.

> **⚠️ Manual activation is UNSUPPORTED.** No UI / super-admin / onboarding / `salownadmin` path sets
> `features.processingTime=true`; tenant creation writes `false`. Enabling it means an out-of-band manual
> Firestore edit — outside normal rollout, not a product feature. Treat sections D/E as gated by this
> manual-only hook (Phase 5a, ⬜ not shipped).

> **Historical kill-switch:** Problem → HeroHairs tenant doc `features.processingTime = false` → everything
> reverts to v1 (byte-identical old behaviour thanks to engine delegation + flag-gate). This applied while
> the engine was flag-gated (before `f958aee`); it no longer reverts the engine.

## Prerequisite
> ⚠️ Updated 2026-07-22: setting `features.processingTime: true` is a **manual, unsupported** Firestore edit
> (no product path does it) and now affects **only** the Treatwell iCal split (D/E) — NOT the engine
> (segment-driven) or the segment editor (flag-independent, dead read). For A/B/C panel tests you do **not**
> need the flag.
1. *(D/E only)* `tenants/herohairs` doc → `features.processingTime: true` — manual Firestore edit, out-of-band.
2. For sections D/E (Treatwell) `firebase deploy --only functions` — **deploy approval to be obtained separately.**

---

## A — Service config / segment editor (NO DEPLOY NEEDED, panel)
> ⚠️ A1/A2 rewritten 2026-07-22: the segment editor is **NOT** gated by `features.processingTime`. The only
> flag-derived state (`pcEnabled`, `Services.tsx:154`) is **never read** (`:110` TODO), so editor visibility
> is flag-independent. The original flag-on/flag-off steps are HISTORICAL (struck through below).
- [ ] A1. The **"Timing — processing & buffer"** segment editor's visibility does **not** depend on
  `features.processingTime` — verify the section behaves identically whether the tenant flag is set or unset.
- [ ] A2. *(Superseded)* The old "flag-off → section hidden" expectation is invalid — the flag does not gate the editor.
- ~~A1 (historical). Flag-on HeroHairs → Services → open a service → the "Timing — processing & buffer" section appears.~~
- ~~A2 (historical). Flag-off tenant (Whitecross) → the section is **not visible**.~~
- [ ] A3. Add segment: Service 20 + Processing 30 + Service 20 → "Segments total 70 / 70 · ✓ active".
- [ ] A4. Total ≠ duration → red "⚠ must equal duration". Save → the engine **does not apply** it (solid).
- [ ] A5. No Processing segment (only Services) → "⚠ needs a Processing segment".
- [ ] A6. Add a Blocked segment (buffer) → save → counts as busy but not free (verified in D).
- [ ] A7. Save → refresh → segments came back exactly (persist). `service.segments[]` exists in Firestore.
- [ ] A8. Service with variations → segment editor is not visible (base service only).
- [ ] A9. Delete the segments → save → `service.segments = null`, service behaves normally.

## B — Booking create + snapshot (panel)
- [ ] B1. Create a **walk-in** with a segmented service → the Firestore booking has a `segments[]` snapshot.
- [ ] B2. **Panel booking** (BookingForm) with a segmented service → `segments[]` exists.
- [ ] B3. Change the service's segment later → the **old booking** keeps the old segment (snapshot frozen).
- [ ] B4. Booking with a variation selected → `segments` is not written (base-only rule).

## C — Engine / conflict + render (panel)
- [ ] C1. On the daily calendar, the segmented booking's processing windows show a **hatched band** (including multiple gaps).
- [ ] C2. A 2nd booking that **fits** in the processing window → **accepted** (previously "slot full").
- [ ] C3. A booking that **exceeds** the window (enters an active/blocked segment) → **"slot full"**.
- [ ] C4. Service with two processing windows → two separate bands + a booking can be taken into both.
- [ ] C5. Reschedule: move a booking into the gap of a processing slot → allow/deny correct.
- [ ] C6. **Regression (flag-off tenant):** normal booking/conflict/reschedule/walk-in as before.
- [ ] C7. **Regression (flag-on but segment-less service):** behaves normally, no gap at all.

## D — iCal feed output (FUNCTIONS DEPLOY REQUIRED)
- [ ] D1. Feed: `…/salownIcalFeed?tenantId=herohairs` → **multiple VEVENTs** for a segmented booking (UID `x`, `x-1`…), with a gap between them.
- [ ] D2. Blocked segment → included in VEVENT (busy), processing → NOT included (empty).
- [ ] D3. Flag-off tenant's feed → single VEVENT (whole span) — as before.
- [ ] D4. Segment total ≠ duration → single solid VEVENT (safe fallback).
- [ ] D5. No UID clash (2 segments separate UIDs).

## E — Treatwell end-to-end (DEPLOY + Treatwell)
- [ ] E1. When Treatwell polls the feed, the processing window appears **empty/bookable**; active/blocked full.
- [ ] E2. Booking from Treatwell into that empty window → taken; comes back to salOWN via the email parser.
- [ ] E3. Latency: is the poll delay reasonable (min—hours); observe the double-booking risk.

## F — Possible problems / edge cases (try these especially)
- [ ] F1. **Source→channel key mismatch:** if a Treatwell/Booksy booking's `source` value doesn't match the channelProfile key, processing is **silently** not applied. (`getServiceSegments` normalizes: lowercase + space/underscore→hyphen.)
- [ ] F2. **Online site booking (BookingPage):** currently does NOT write a snapshot → the online customer booking carries no gap. (Intentional, follow-up.)
- [ ] F3. **Email parser bookings:** Treatwell/Fresha/Booksy import does NOT write a snapshot → carries no gap. (Intentional.)
- [ ] F4. **Day-view squeeze-in:** the 2nd card (taken into the gap) still overlaps (no column-split). Visual; booking is correct.
- [ ] F5. **Week view:** no processing render (daily only).
- [ ] F6. **BLOCKED booking** + accidental segment → must stay solid (no gap should open).
- [ ] F7. **Very short gap** (e.g. 5min, shorter than the shortest service) → nobody can fill it, causes no problem.
- [ ] F8. **Firestore rules:** writing a segmented service/booking doesn't hit rules (panel auth; create without whitelist — verified).
- [ ] F9. **Reschedule self-ignore:** a segmented booking doesn't conflict with its own gap (`ignoreBookingId`).
- [ ] F10. **No-show/cancel:** cancelling a segmented booking → the 2nd booking taken into the gap is unaffected (FIFO, no protection — intentional).

## Rollback
- **Current:** no tenant-wide runtime kill-switch. Revert one service by clearing its `segments` (→ solid,
  v1). Treatwell iCal (OUT) leg only: `features.processingTime=false` still forces single-VEVENT
  (`functions/src/index.ts:1511`). Full engine revert = revert `f958aee` (+ `5dbdf31`) and redeploy — owner
  approval required. See `BUSY_SLOT_V2_RISKS.md` → Rollback/Recovery.
- **Historical:** kill-switch `features.processingTime=false` → instant v1 (applied while the engine was
  flag-gated, pre-`f958aee`). If functions must be rolled back: flag-off already gives single-VEVENT for the
  feed; revert+redeploy if needed.

## Automated tests (developer)
- `npm test` → `conflictUtils.test.js` 24/24 (parity + v1-equivalence + segment model + back-compat).
- Build: `npm run build` zero errors. `node --check functions/index.js`.
