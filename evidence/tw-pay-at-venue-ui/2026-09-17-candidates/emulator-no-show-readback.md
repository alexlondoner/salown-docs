# Emulator No Show write proofs — TW-PAY-AT-VENUE-UI, 2026-09-17

Local only: Firestore + Auth emulators, project `demo-pav`, tenant `pav-test`, synthetic data
(`harness-seed.cjs`). Rules loaded from `c8a64d6:firestore.rules`, which is byte-identical to the
live ruleset `projects/havuz-44f70/rulesets/5e102dd4-e7e7-4950-b12a-14a74daa82e8` (live release
2026-09-10T13:39:16Z; compared on 2026-09-17, 79060 = 79060 characters, equal: True).

The client wrote with the signed-in owner's ID token (claims `tenantId: pav-test`,
`tenantRole: owner`, emulator custom token), so the write went through the rules. The read-backs
below used the Admin SDK against the emulator. The lines are the command output, copied verbatim.

## 1. Admin panel (candidate `6b3f19f`) — No Show on the pay-at-venue booking

The panel's `window.confirm` was pre-answered in the local page so the browser was not blocked;
the page recorded the one prompt it raised: `["Mark as No Show?"]`.

Read-back of every seeded booking right after the click:

```
BOOKSY-9500005 CONFIRMED noShowAt=- paidAmount=10 
TREATWELL-T9500001 NO_SHOW noShowAt=2026-09-17T15:41:55.497Z paidAmount=0 
TREATWELL-T9500002 UNPAID noShowAt=- paidAmount=0 serviceCharge
TREATWELL-T9500003 CANCELLED noShowAt=- paidAmount=0 
TREATWELL-T9500004 CHECKED_OUT noShowAt=- paidAmount=40 serviceCharge
```

Only the pay-at-venue booking changed; no money field changed.
Screenshots: `screenshots/03-…` (before: No Show visible), `screenshots/05-…` (after).

## 2. Staff App (candidate `76e58fe`) — No Show on the same booking, after a re-seed

The data was reset with `harness-seed.cjs` first. The Staff sheet uses its own two-tap confirm
("No show" → "Confirm?"), with no browser dialog.

```
TREATWELL-T9500001 NO_SHOW 2026-09-17T15:44:19.618Z paidAmount=0
```

Screenshots: `screenshots/11-…` (sheet before), `screenshots/12-…` (list after, "No show").

## What this does and does not prove

- It proves that the live ruleset accepts the existing Admin and Staff No Show writes on a Treatwell
  pay-at-venue booking (stored `UNPAID`) for an owner.
- It does NOT prove the same for the `admin` or `staff` roles; only the owner was exercised.
- It does NOT exercise production: no production read or write happened in this check.
