# Walk-in early-morning backdate floor — scope/options for an owner decision

Written 2026-09-14, following up on README §3a. **No code changed. No decision made here** —
this lays out the choices for the owner to pick from (or reject all of, i.e. leave as-is
deliberately). Nothing below is a recommendation ranking; they are presented in the order a
fix would grow in scope, not in order of preference.

## The defect, restated precisely

`src/staff/sheets/WalkInFlow.tsx`, untouched-time Save & Checkout:

```
minsToTimeStr(Math.max(9 * 60, getNowMins(tz) - (totalDuration || 30)), tf)
```

When the tenant-local time of the checkout is early enough that `getNowMins(tz) - duration`
is less than `540` (09:00), the floor wins, and the recorded service window can be **later
than the real moment of the write**. Confirmed live (README §2): write at 01:21:56 BST
produced a service window of 09:00–09:30 BST, ~7h38m in the "future" relative to the write.
No documented decision anywhere names this as intended (README §3a).

## Option 1 — Leave it exactly as-is; document it as an accepted quirk

- **Change:** none. Add an entry to `docs/KNOWN_QUIRKS.md` naming the exact condition (real
  time before ~09:30, for a 30-min service) and its effect, so the next person who finds it
  in an audit doesn't reopen it as a fresh bug.
- **Rationale for this option:** no UK salon this platform serves is realistically doing an
  untouched-time checkout at 1am; the floor's practical exposure may be effectively zero.
  Whether that premise holds is a business judgment, not something this note can verify —
  it depends on actual salon operating hours across tenants, which are not audited here.
- **Cost of being wrong:** if a genuine early-morning walk-in does happen (a very early
  opener, a late-running previous-day service crossing midnight, testing/support activity),
  the resulting record misrepresents when the service happened, which could affect reporting,
  payroll-by-shift logic, or a client dispute about when they were served.

## Option 2 — Cap the floor at "not later than now"

- **Change:** `Math.min(Math.max(9 * 60, getNowMins(tz) - duration), getNowMins(tz))` (or
  equivalent) — the floor still nudges an early result toward 09:00, but never past the
  actual current minute. A checkout at 01:20 would then record `01:20` (or `getNowMins - 0`,
  effectively "now"), not `09:00`.
- **Effect:** eliminates the future-dating defect outright. Introduces a new visible
  behavior change: a genuinely early walk-in's recorded start time moves from a fixed 09:00
  to the real (early) clock time — a schedule entry at 01:20 is unusual-looking but at least
  never wrong-directioned.
- **Requires:** owner sign-off (behavior change to a live formula, `STAFF_SHIFT_OVERRUN`-style
  precedent for "small deliberate constant" changes needing explicit approval), a new test
  pinning the capped behavior, and the same distinction Option 1 doesn't need: is an
  early-morning record showing the *real* early time better or worse than one showing a
  fixed 09:00? Not obviously "better" without knowing why 09:00 was chosen as the floor in
  the first place (only rationale found: "salon doesn't open before 9am" — a display/business
  assumption, not a hard technical constraint).

## Option 3 — Floor from the tenant's actual configured opening time, still capped at "now"

- **Change:** replace the hardcoded `9 * 60` with the tenant's real opening time (from
  `settings/hours` or the effective staff shift start, both of which already exist and are
  used elsewhere per `SYSTEM_ARCHITECTURE.md`'s slot-generation SSOT), combined with the
  "not later than now" cap from Option 2.
- **Effect:** the floor becomes tenant-accurate instead of a hardcoded UK constant (matters
  for TR tenants once Walk-in ships there, per `project_turkey_no_parser`/TR-A localization
  work — a TR salon that opens later or earlier than 9am gets a floor that doesn't match its
  own hours) — and the future-dating defect is still eliminated by the "now" cap.
- **Cost:** most invasive of the three. Needs the settings/shift value threaded into
  `WalkInFlow.tsx` (may already be available via `presentation`/`hours` props — not verified
  here, would need its own investigation), a decision on which of "salon hours" vs "this
  staffer's shift start" is the right floor source (the codebase's existing SSOT for
  schedule questions is the staffer's effective shift, not raw salon hours —
  `salown-app/CLAUDE.md` "Slot generation — business rule"), and new tests. Largest scope,
  but the only option that also closes the separate "hardcoded 9am doesn't fit every
  tenant" gap, not just the future-dating one.

## What this document does NOT do

- Does not pick an option. Does not change `WalkInFlow.tsx` or any other source file.
- Does not assume Option 1 is acceptable because it's cheapest — that's the owner's call on
  real-world exposure, not an engineering default.
- Does not bundle this with the STAFF-AVAIL-GAP-P2 release decisions
  (`20-owner-decision-recommendations.md`) — it is a separate, unrelated product question
  discovered incidentally by that work, not a blocker for or dependency of Phase 2's release.
