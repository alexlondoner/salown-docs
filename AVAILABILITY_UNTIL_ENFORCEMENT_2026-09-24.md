# `availabilityUntil` enforcement — evidence, candidates, open items (2026-09-24)

Owner rule: `availabilityUntil` is **inclusive** — a member may be given work ON that day and
on nothing after it, however far ahead the request is made. A dated `shiftChanges` override
and the owner conflict/hours override cannot beat it. Muhamed (`barber-1781007454543`):
`availabilityUntil = 2026-09-27`; his `status`/`staffComp` were **not** touched.

**Nothing deployed.** Main (`8d1f724`) untouched. Hosting still `salown ef9aceae78492916`,
`salown-staff e0fab0365adaca37`, `whitecrossbarbers-saas 22137b7d0313a4d0`; no function updated.

## 1. Production, read-only

- Whole `tenants/whitecross/bookings` scanned (1,920 docs, every date shape parsed): **0 Muhamed
  bookings after 2026-09-27** (matcher found his 189 bookings under 3 id spellings; latest 23 Sep).
- The one unparseable doc, `KAKAKAKLASDALLALS`, held a single field `PENDING: "PENDING"` (created
  2026-04-21, no barber/date) — not a booking, unrelated to Muhamed. **Deleted at the owner's
  request** (one document, `currentDocument.updateTime` precondition, backup kept, re-read 404).
  This is the only production write of the task.

## 2. The gap, proven on the DEPLOYED code

Every relevant function's `function-source.zip` was pulled read-only and matched blob-for-blob to
a commit. A new emulator harness (`functions/src/bookings/availabilityUntilPaths.emulator.test.js`)
drives each path's real core against a seeded emulator, "today" = 2026-09-24.

On every live source the 27th is accepted (control) and the 28th / 5 Oct are **also accepted**;
a dated override and the owner override do not stop it; name-keyed refs (`leaver`, `Leaver`) pass;
an edit form can hand a later booking to the leaver; the reschedule gate returns OK; an import
after the cutoff is assigned with **no flag**. Only `salownStaffLifecycle` carries the upper bound.

## 3. Candidates (each on its function's exact live source; none merged, none deployed)

| Target / functions to name | Live source → candidate | Live baseline revision (rollback) | Harness | Unit (live → cand, same failure names) | Canonical emulator gate |
|---|---|---|---|---|---|
| `salownCreateBooking` | `af7b5ec` → `release/au-public-on-live-af7b5ec` **`a88f400`** | `salowncreatebooking-00006-mim` | 31/31 | 2093/3 → 2103/3 | **585/585** |
| `salownCreateAdminBooking`, `salownCreateWalkIn` | `5035f22` → `release/au-admin-on-live-5035f22` **`b033167`** | `salowncreateadminbooking-00002-sem`, `salowncreatewalkin-00002-miw` | 31/31 | 1479/3 → 1489/3 | **474/474** |
| `salownCreateStaffBooking` | `da44310` → `release/au-staffbook-on-live-da44310` **`dd13381`** | `salowncreatestaffbooking-00001-jan` | 38/38 | 2679/2 → 2695/2 | **694/695** ¹ |
| `salownCreateStaffWalkIn` | `aa2efd9` → `release/au-staffwalk-on-live-aa2efd9` **`630e811`** | `salowncreatestaffwalkin-00001-pur` | 38/38 | 2692/2 → 2708/2 | **720/720** |
| `salownEditBookingForm` | `0b2ada6` → `release/au-edit-on-live-0b2ada6` **`3e9e21d`** | `salowneditbookingform-00001-maq` | 38/38 | 2584/2 → 2600/2 | **650/650** |
| `salownPatchBookingDetails` | `6ebf430` → `release/au-patch-on-live-6ebf430` **`5351a89`** | `salownpatchbookingdetails-00003-rav` | 38/38 | 2704/2 → 2720/2 | **680/680** |
| `salownReassignBooking` | `179cff5` → `release/au-reassign-on-live-179cff5` **`53b4c80`** | `salownreassignbooking-00003-yan` | 31/31 | 2168/3 → 2178/3 | **643/643** |
| `salownRescheduleByToken` | `c8a64d6` → `release/au-resched-on-live-c8a64d6` **`2e4b672`** | `salownreschedulebytoken-00076-mot` | 38/38 | 2679/2 → 2695/2 | **683/683** |
| `salownParseEmails`, `salownParseInboxDispatch`, `salownManualImport` | `2439e37` → `release/au-import-on-live-2439e37` **`a1206b3`** | `salownparseemails-00130-riy`, `salownparseinboxdispatch-00013-nev`, `salownmanualimport-00119-fic` | 31/31 | 2237/2 → 2247/2 | **656/656** |
| `hosting:salown-staff` | `440e275` → `release/au-staff-on-live-440e275` **`790f6c7`** | `e0fab0365adaca37` | — | vitest 0 fail | staff-gate **30/30 + 54/54** ² |
| `hosting:whitecrossbarbers-saas` (REL-15) | REL-14 → whitecross-site `release/rel15-availability-until` **`cc71f9bd`** | `22137b7d0313a4d0` | — | rel15 7/7; full suite same 30 failures as clean main | local screen ³ |

¹ The one failure (`O1S CROSS-FLOW: New Booking vs concurrent Block Time`, `PERMISSION_DENIED`
≠ `SLOT_CONFLICT`) fails **3/3 on the live `da44310` source too** — pre-existing, not caused here.
Unit "fail" counts are the archive-layout tests (`11b`, `13i`, `13j`), identical on both sides.
Revisions were read today; re-read them immediately before any release.

² Negative control, live `440e275`: the four cutoff screen tests fail (28 Sep offered, override
reopens it, yesterday's cutoff ignored in walk-in, Reschedule to 28 Sep written).

³ Local copy with an in-memory stub roster (no production access, writes disabled): REL-15 — 27
Sep leaver offered (40 starts); 28 Sep / 5 Oct button hidden, selection falls back to Any Barber;
with a dated override still hidden; Alex unaffected. Live REL-14 bytes: leaver offered 28 Sep and
5 Oct with 40 starts. REL-15 workspace assembles: 56 live files byte-verified + 2 release files.

**Order:** functions first (all rows above), then `hosting:salown-staff` and REL-15 (REL-15 only
after `salownCreateBooking`). Each functions deploy names ONLY its own functions and is run from
its own candidate tree (`./scripts/deploy-functions.sh <names>`); never a blanket deploy.
Rollback per function: `gcloud run services update-traffic <svc> --to-revisions=<rev>=100
--region europe-west2`; hosting: re-release the version in the table.

## 4. What the uniform patch changes, per target

Every function candidate carries the same server set: **P1** (window predicate upper bound;
`assertAssignableStaff` gets the real window; `rescheduleStaffGate` → `AFTER_LAST_DAY` + the
`salownRescheduleByToken` branch), **P2** (edit executor window gate + barber-only fix) where the
tree has the executor, **P3** (import flag). Carried so a later redeploy from any tree has all of it.

| Function | Behaviour it EXECUTES that changes | Carried but NOT executed by it |
|---|---|---|
| `salownCreateBooking`, `salownCreateAdminBooking`, `salownCreateStaffBooking` | predicate upper bound inside `resolveEffectiveStaffShift` → `STAFF_UNAVAILABLE` (never overridable) | `assertAssignableStaff`, reschedule branch, P2, P3 |
| `salownCreateWalkIn`, `salownCreateStaffWalkIn` | `assertAssignableStaff` real window → `STAFF_UNAVAILABLE_AFTER_DATE` | reschedule branch, P2, P3 |
| `salownReassignBooking` | `assertAssignableStaff` real window | reschedule branch, P3 |
| `salownEditBookingForm`, `salownPatchBookingDetails` | executor gates the landing day of a MOVE, incl. barber-only change; past landing day and non-moving edits allowed | reschedule branch, P3 |
| `salownRescheduleByToken` | `AFTER_LAST_DAY` → same customer sentence as before | P2, P3 |
| parsers ×3 | after-cutoff import kept + flagged `needsReassignment` / `STAFF_AFTER_LAST_DAY_AT_IMPORT` | `assertAssignableStaff`, reschedule branch (tree has no edit executor, so no P2) |

**Harness/uniformity only, no runtime effect on any deployed function:** the frontend parity copy
`src/utils/availabilityWindow.ts` in function trees (a functions deploy does not ship it), the
`fs`/`path` requires in `staffEligibility.test.js`, and the emulator harness file itself.

## 5. Main integration

`integrate/availability-until-main` **`6b45e3b`** (= `0c0f852` + the Staff screen suite), off
`8d1f724`, **not merged**. Identical content to the candidates (every file had the same base on
main). vitest 5888/0 (main 5880/0) · functions unit 2929/2, same names as main · Admin + Staff
builds 0 · Staff gate 37/37 + 54/54 · canonical emulator gate **770/770 PASS** · ESLint source delta:
22 findings, all in the new CJS harness file (the `require`/`__dirname` pattern every functions
test file carries).

## 6. Open items

1. **Staff Reschedule is a DIRECT Firestore write — the guard added is a UI guard, not server
   enforcement.** Proven on the emulator with the live ruleset (byte-identical to `5e102dd4`): a
   signed-in staff user's direct move past the cutoff is ALLOWED in both the label shape the
   sheet writes (`date: "28 September 2026"`) and the ISO + doc-id shape. Why: the update rule
   re-runs its gate only on `barberId`/`date` change, reads `availabilityFrom` only, and treats a
   non-ISO date or a name-keyed `barberId` as undecidable → allow. Permanent options (none done):
   (a) route Staff Reschedule through the existing edit executor callable (server-gated by the
   candidates above) — recommended; (b) rules: forbid direct `date`/`startTime`/`barberId` changes
   by non-owner staff so every move goes through a callable; (c) rules: add an `availabilityUntil`
   branch — only effective once the date shape is decidable (ISO), so it needs (a) or a data change.
2. **`needsReassignment` is not shown to operators.** No Admin/Staff UI reads it. An after-cutoff
   import stays visible in the leaver's (dimmed) calendar lane and `OFFBOARD` refuses with
   `BOOKINGS_AFTER_LAST_WORKING_DAY` while such bookings exist — so it is not lost — but the flag
   itself is silent. A UI surface is a follow-up.
3. **Pre-existing** `createStaffBooking.emulator.test.js` cross-flow failure on the live source.
4. Product sales (`salownCreate(Staff)ProductSale`) also call `assertAssignableStaff`; not a
   booking path, not in these candidates.
5. Main integration `6b45e3b` awaits owner approval to merge; A1 `764ff84`, A2 `3887397` and
   HOME `443f762` untouched.
