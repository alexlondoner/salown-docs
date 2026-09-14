# Walk-in early-morning backdate floor — target specification for an owner decision

Written 2026-09-14, updated same night with a concrete target behavior. §1 replaces the original
three generic options (§Appendix, superseded) with the owner's specified target behavior, worked
through against the actual source. §2–§5 extract what would need to change, how it interacts with
existing shift/conflict/historical-day authority, what the manual-time flow does (unaffected), and
candidate acceptance tests. §8 lists the real open decision points.

**⏩ UPDATE 2026-09-14 ~16:1x UK — all four §8 decision points answered by the owner, and
implemented same session.** (1) Scope down the historical-day exemption via a companion fix,
rather than shipping the floor removal with that consequence merely documented. (2) Remove the
floor entirely — including the non-midnight-crossing early-checkout case, not just the
midnight-crossing one. (3) Track the adjacent `tz: undefined` → `LONDON_TZ` default separately,
not bundled into this change. (4) Confirmed separate from, and not a blocker for, the
`STAFF-AVAIL-GAP-P2` release decision. Implementation: salown-app `aa2efd9` (claim
`WALKIN-BACKDATE-FLOOR`, `SYNC.md` 2026-09-14 16:1x, `docs/ROADMAP.md` §12). **This document is
now historical record of the analysis that led to those decisions — read §1–§7 as the reasoning,
not as still-open.** Not yet emulator/Chrome-verified end-to-end; not deployed.

## 0. The defect, restated precisely

`src/staff/sheets/WalkInFlow.tsx` (~line 530), untouched-time Save & Checkout:

```
minsToTimeStr(Math.max(9 * 60, getNowMins(tz) - (totalDuration || 30)), tf)
```

When the tenant-local time of the checkout is early enough that `getNowMins(tz) - duration` is
less than `540` (09:00), the floor wins, and the recorded service window can be **later than the
real moment of the write**. Confirmed live (README §2): write at 01:21:56 BST produced a service
window of 09:00–09:30 BST, ~7h38m in the "future" relative to the write.

## 1. Target behavior (owner-specified, 2026-09-14 night)

1. **When the time field is untouched, start = the checkout instant, captured once, minus the
   total service duration.** No floor. No clamp toward "now" either (that would just be a
   differently-wrong "always show something suspiciously close to real time" answer, not the
   actual service start) — the SAME subtraction, unconditionally.
2. **Crossing midnight moves the date back a day**, correctly — a checkout at 00:10 for a
   30-minute service records a start of 23:40 on the *previous* calendar day, not 00:00 today
   and not (as today) 09:00 today.
3. **The 09:00/opening-time floor is removed from this path entirely.** It does not push the
   computed instant forward under any circumstance.
4. **One computed instant, reused everywhere.** The same value is what the conflict check reads,
   what an owner sees/approves in the override flow, and what is ultimately persisted — it is
   captured once and never re-derived from a fresh `new Date()` read at any later step,
   including an owner-override resubmission.

Neither "leave as-is" nor "pin the start to the current moment" satisfies this — both are
explicitly ruled out by the owner. The target is genuine backdating (checkout time minus
duration), unclamped, with correct calendar-day rollover, computed exactly once.

## 2. Why "just remove the floor" is not enough — the clamp is also wrong for this

`minsToTimeStr` (`src/staff/lib/walkinTime.ts`) is a **minutes-of-day** producer:

```ts
export function minsToTimeStr(totalMins: number, timeFormat: '24h' | '12h' = '12h') {
  const clamped = Math.max(0, Math.min(totalMins, 23 * 60 + 59))
  const rounded = Math.round(clamped / 5) * 5
  return timeLabelFromMins(rounded, timeFormat)
}
```

Even with the `9 * 60` floor deleted, a negative `getNowMins(tz) - duration` (the exact
midnight-crossing case) clamps to `0` — "00:00" **today**, not 23:40 **yesterday**. Minutes-of-day
arithmetic has no concept of "yesterday." Target behavior 1(2) needs an **absolute-instant**
computation, not a minutes-of-day one: capture `nowMs` once, subtract `duration * 60000`, and
derive the calendar date *and* the time-of-day from that resulting instant in the tenant's zone —
the date falls out of the instant automatically; it never needs separate handling.

## 3. The seam already in the codebase for this

The client already has a way to send a fully-resolved absolute instant instead of reconstructing
one from a date label + a time label:

- `src/utils/bookingCallables.ts:270`: `date?: string; time?: string; startTime?: string; // ISO wins if present`.
- `src/utils/bookingCallables.ts:320`: `const startTime = input.startTime || toIsoStartTime(input.date || '', input.time || '', input.timeZone);`

If the untouched-time path computed `const backdatedIso = new Date(anchorMs - totalDuration * 60000).toISOString()`
and sent it as `startTime` (instead of building a `date` string via `getTodayStr()` and a `time`
label via `minsToTimeStr()` and letting the client re-derive an instant from them), the date/time
reconstruction — and its midnight-blind clamp — is sidestepped entirely, and the "one computed
instant" requirement (target 4) becomes structural rather than a discipline to maintain by hand.
This is the natural implementation seam, not a recommendation to build something new — **noted
here, not built**.

## 4. Where the current code stands relative to "one computed instant, reused everywhere"

Closer than it looks, but not there:

- `time` (the minutes-of-day label) **is** captured once, outside `createWalkInEnforced`, and
  reused unchanged through an owner-override resubmission — the comment directly above
  `createWalkInEnforced` (`WalkInFlow.tsx` ~line 367) says so explicitly: "a backdated Save &
  Checkout start is never re-derived." True for `time`.
- `date`, however, is **not** captured once. `createSaleBooking(time, override)`
  (`WalkInFlow.tsx:319`) calls `getTodayStr(tz, loc)` — which reads `new Date()` fresh — **every
  time it runs**, including on the override-resubmission call (`submit: (override) =>
  createSaleBooking(time, override)`, line 384). Today this is silently safe because `date` is
  always "today" and the floor never lets a backdated instant leave "today." Under the target
  behavior, `date` becomes load-bearing (it can legitimately be "yesterday"), so it must move into
  the same "captured once" discipline `time` already has — or, per §3, be replaced entirely by one
  `startTime` ISO string computed once and passed straight through, which removes the split
  date/time re-derivation problem structurally instead of patching around it.

## 5. Points in source that would need to change (identified, not changed)

**Client:**
- `src/staff/sheets/WalkInFlow.tsx` — the backdate formula call site (~line 530: delete the
  `9 * 60` floor and the `minsToTimeStr`/minutes-of-day framing for this path; compute an absolute
  instant instead) and `createSaleBooking`'s `date: getTodayStr(tz, loc)` (~line 336: stop
  re-reading `new Date()` here — the caller's single captured instant must flow through instead).
- `src/staff/lib/walkinTime.ts` — `minsToTimeStr` itself does not need to change (it is correctly
  scoped to same-day picker labels elsewhere); a new instant-based helper (or just
  `new Date(ms).toISOString()` inline, per §3) is what the untouched-time path needs instead of
  reusing `minsToTimeStr` for something it was never designed for.
- `src/utils/bookingCallables.ts` — likely **no change**: the `startTime`-wins seam (§3) already
  exists; confirm `StaffWalkInInput`'s type and any client-side validation accept `startTime` on
  this call path (not verified here — would need checking, not assumed).

**Server (`functions/src/bookings/createWalkIn.ts`) — no change needed for the core mechanics:**
- The conflict query (`createWalkIn.ts:255`) already scans `[startMs − 24h, endMs]`, an
  absolute-instant window with a 24h lookback ≥ `MAX_DURATION_MINS` — it already handles a
  midnight-crossing `startMs` correctly with no change.
- `resolveEffectiveStaffShift(barberData, tenantDateKey(input.startMs, tz), ...)`
  (`createWalkIn.ts:314`) already derives the shift-lookup day **from the instant itself**
  (`tenantDateKey(input.startMs, tz)`), not from "today" — a backdated-to-yesterday walk-in is
  already checked against *yesterday's* shift, correctly, with no change needed.
- See §5a below for the one place that **would** need an explicit decision (not necessarily a
  code change) before shipping this.

### 5a. The one real interaction found: historical-day classification exempts passive/not-started checks

`functions/src/bookings/staffEligibility.ts`:

```ts
export function classifyTenantDay(startMs: number, nowMs: number, tz: string = LONDON_TZ): DayClass {
  const s = tenantDateKey(startMs, tz)
  const n = tenantDateKey(nowMs, tz)
  if (s < n) return 'historical'
  ...
}
export function assertAssignableStaff(args): EligibilityResult {
  ...
  const when = classifyTenantDay(args.whenMs, args.nowMs, tz)
  if (barber.status === 'passive' && when !== 'historical') return { ok: false, reason: 'STAFF_PASSIVE', ... }
  if (when !== 'historical' && !isWithinAvailabilityWindow(...)) return { ok: false, reason: 'STAFF_NOT_STARTED', ... }
  return { ok: true, ... }
}
```

`createWalkIn.ts:281` calls this with `whenMs: input.startMs, nowMs` (the real server-side "now"
for this request). **Today, this branch is unreachable for Walk-in**: the floor keeps every
untouched-time backdate inside "today," so `classifyTenantDay` always returns `'today'`, never
`'historical'`. **Once the floor is removed and midnight-crossing is allowed**, an untouched-time
checkout shortly after midnight computes a `startMs` whose tenant-local date is *yesterday* — and
`classifyTenantDay` classifies that as `'historical'`. The consequence: for that walk-in,
**`STAFF_PASSIVE` and `STAFF_NOT_STARTED` are silently skipped** — a barber who was offboarded
(`passive`) as of today, or whose `availabilityFrom` is today, can still be assigned to a walk-in
backdated into yesterday, because the eligibility gate treats it as historical record-keeping
(the same reason it exempts genuine parser backfills and imports) rather than a live assignment.

This is a **real, previously-invisible consequence of the target behavior**, not a hypothetical —
it exists in the shipped code today, just unreachable because of the floor this change removes.
It needs an explicit decision (§6), not a silent "it'll be fine" — the HOURS/CONFLICT checks in
`staffPolicyGate.ts` are **not** affected the same way (they don't consult `classifyTenantDay` at
all, so a backdated-to-yesterday walk-in still gets a real shift-fit and conflict check either
way — only the passive/not-started *eligibility* gate has this exemption).

**Adjacent, separate observation (not part of this fix, noted for completeness):**
`assertAssignableStaff` is called with `tz: undefined` (`createWalkIn.ts:281`), which makes
`classifyTenantDay` always use `LONDON_TZ` internally, regardless of the tenant's real zone —
while the shift-fit check two lines later correctly resolves the tenant's actual
`presentation.timezone`. For a non-UK tenant, "today" for eligibility purposes and "today" for
shift-fit purposes could theoretically disagree right around each zone's own midnight. Pre-existing,
unrelated to the floor, not scoped to this fix — flagged so it isn't rediscovered as a surprise
later.

## 6. Effect on the manually-selected-time flow — none, and why

When the operator touches the time field (`timeTouched === true`), `WalkInFlow.tsx`'s `time`
becomes `timeStr` — the raw picked label — and the backdate formula (§0) is never evaluated at
all. This fix is scoped entirely to the `timeTouched === false` branch. The manual-time path
would keep sending `date: getTodayStr(tz, loc)` + the picked `time` exactly as today (or, if the
implementation switches to `startTime` per §3, an equivalent instant built from "today" + the
picked label) — **no behavior change, no new test risk**, as long as the implementation keeps the
two branches structurally separate rather than routing both through one shared "backdate" helper.
Worth a regression test asserting exactly that separation continues to hold (§7).

## 7. Candidate acceptance tests (specification, not code)

1. **No-crossing early morning:** checkout at (say) tenant-local 08:50 for a 30-min service →
   recorded start 08:20 **same day**. (Today this floors to 09:00 — this is a real, deliberate
   behavior change even without crossing midnight, and should be pinned explicitly.)
2. **Exact midnight crossing:** checkout at tenant-local 00:10 for a 30-min service → recorded
   start 23:40 on the **previous** calendar day. Assert both the date and the time-of-day.
3. **Boundary just inside the same day:** checkout at tenant-local 00:40 for a 30-min service →
   recorded start 00:10, **same day**, no rollover. (Pins the off-by-one at exactly `duration`
   minutes past midnight.)
4. **Long service crossing midnight by hours:** a multi-hour service (e.g. a package/treatment
   session, if walk-in ever carries one that long) checked out just after midnight rolls back
   correctly by more than one calendar day's worth of minutes if duration exceeds 24h is refused
   upstream (`MAX_DURATION_MINS` validation, `createWalkIn.ts:74`) — confirm that refusal still
   fires correctly and isn't accidentally bypassed by an instant-based computation.
5. **Owner-override resubmission reuses the identical instant.** Force a `CONFLICT_ACK_REQUIRED`
   retry (same shape as the existing round-2 Chrome evidence) and assert the resubmitted
   `startTime`/`date`+`time` is byte-identical to the first attempt, even if real wall-clock time
   has visibly advanced between the two calls (e.g. the owner took 30+ seconds to type a reason).
6. **Manual-time regression (§6):** `timeTouched === true` produces byte-identical `date`/`time`
   values before and after this change, for both a normal-hours pick and an early-morning pick.
7. **Historical-day eligibility exemption, explicitly pinned (§5a):** a walk-in whose computed
   start crosses into yesterday, assigned to a barber who is `passive` as of today (or whose
   `availabilityFrom` is today), is accepted rather than refused with `STAFF_PASSIVE` /
   `STAFF_NOT_STARTED` — asserted as a **known, deliberate** consequence so a future change to
   `classifyTenantDay` or `assertAssignableStaff` can't silently flip it without a test noticing.
8. **Conflict correctness across midnight:** an existing booking ending at 23:50 "yesterday" is
   detected as conflicting with a walk-in whose computed backdated start is 23:40 "yesterday"
   (exercises the already-correct 24h lookback window from a genuinely rolled-back `startMs`, not
   assumed from source reading alone).
9. **Shift-fit correctness across midnight:** a barber whose shift on "yesterday" differs from
   their shift "today" — the backdated walk-in is checked against *yesterday's* shift, not
   today's (exercises `tenantDateKey(input.startMs, tz)` from a genuinely rolled-back instant).

## 8. Real decision points — an owner call is still needed even with a target specified

1. **Is the §5a historical-day eligibility exemption acceptable for this specific trigger** (a
   duration-driven backdate crossing midnight), or should removing the floor be paired with a
   change so that only a *genuine* backfill/import gets the historical exemption, not an
   untouched-time Walk-in checkout that merely happens to cross midnight? This is a real design
   fork, not a detail — it decides whether `classifyTenantDay`/`assertAssignableStaff` needs a
   companion change alongside the floor removal, or whether the floor removal ships alone with
   this consequence explicitly accepted and documented.
2. **Behavior change beyond the future-dating bug itself:** even a non-midnight-crossing early
   checkout (test 1, e.g. 08:50 → 08:20) changes today's live 09:00-floor behavior. Confirm this
   is intended and not just "fix the midnight case, keep the floor otherwise" — the owner's
   instruction reads as "no floor at all," but this is worth one explicit confirmation given it's
   a visible change to every early-morning walk-in, not only the rare midnight-crossing one.
3. **The adjacent `tz: undefined` LONDON_TZ default in `assertAssignableStaff`** (§5a) — bundle a
   fix into this same change, or leave it as a separately-tracked, unrelated finding? Not required
   for UK tenants (unaffected); relevant once Walk-in reaches a non-UK tenant.
4. Scope/timing: this and the STAFF-AVAIL-GAP-P2 release decisions remain **separate** — this
   finding is not a blocker for, and not bundled with, Phase 2's release.

---

## Appendix — superseded: the original three generic options (kept for the record)

The three options below were the first pass at this finding, before the owner specified the
target behavior in §1. They are superseded by §1–§8 above and kept only so the record shows what
was considered before the concrete target arrived — do not act on them.

### Option 1 (superseded) — Leave it exactly as-is; document it as an accepted quirk
Ruled out explicitly by the owner ("'olduğu gibi bırak'... çözüm olmasın").

### Option 2 (superseded) — Cap the floor at "not later than now"
Also ruled out explicitly ("'başlangıcı şimdiye sabitle' çözüm olmasın") — pinning the start to
the checkout moment itself is not the same as checkout-moment-minus-duration, which is what §1
specifies.

### Option 3 (superseded) — Floor from the tenant's actual configured opening time, capped at "now"
Superseded: §1 removes the floor concept entirely rather than making it tenant-accurate.
