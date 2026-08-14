# STAFF-START-AUTHORITY-A1 / A1.1 — coordinated release manifest

> **Status: NOTHING IN THIS DOCUMENT HAS BEEN DEPLOYED.** Every "live identity" below was
> read from production on **2026-08-14**; every "pinned artefact" was built from a detached
> worktree at the pinned commit and hashed. This is the plan and its evidence, not a record
> of a release. A release gets a `RELEASE_LEDGER.md` row; this file does not replace one.

**Work ID** `STAFF-START-A1` · **Source** `81e35d2` (salown-app) · `f046aa14` (whitecross-site)

---

## 0. The one-paragraph version

`barbers/{id}.availabilityFrom` is a tenant-local inclusive `YYYY-MM-DD` scheduling key. Six
Firebase Function exports, two hosting sites and one hand-anchored premium artefact carry
behaviour that depends on it. The safe ordering is **server gates first, clients second**,
because that direction can only ever produce "the client offered something the server
refused" — a visible error and no bad data. The reverse can produce a booking.

**There is one exception, and it is the most important line in this file.**
whitecrossbarbers.com does **not** submit through `salownCreateBooking` — the held W1/C1
cutover is what would change that, and it is held. The live artefact writes bookings
**straight to Firestore** (`setDoc(doc(db,'tenants/whitecross/bookings',id))`, baseline
`script.js:1794` and `:1558`). So for that channel **no server gate exists**, and the REL-5
client artefact is the *only* enforcement of the boundary. Phase 3 is not the cosmetic
tail of this release; it is the enforcement point for a whole channel.

---

## 1. Deployable units

### Phase 1 — server gates and writers (Functions, `europe-west2`, codebase `salown`)

Six exports. **Never a blanket `--only functions`** — that deletes the 27 legacy
us-central1 functions (CLAUDE.md). Every name is fully qualified.

| # | Export | Changed behaviour | Live revision (= rollback) |
|---|---|---|---|
| 1 | `salownCreateBooking` | `resolveEffectiveStaffShift` refuses a pre-start date above the `shiftChanges` read → `STAFF_UNAVAILABLE` (public booking) | `salowncreatebooking-00003-viv` |
| 2 | `salownCreateAdminBooking` | same core; admin path returns `STAFF_UNAVAILABLE` | `salowncreateadminbooking-00001-lav` |
| 3 | `salownCreateWalkIn` | `assertAssignableStaff` → new reason `STAFF_NOT_STARTED` (in-transaction) | `salowncreatewalkin-00001-voc` |
| 4 | `salownReassignBooking` | `assertAssignableStaff` → `STAFF_NOT_STARTED` for a today/future target | `salownreassignbooking-00001-hog` |
| 5 | `salownRescheduleByToken` | `rescheduleStaffGate` → new `NOT_STARTED`, customer-facing text identical to the passive case (a start date is internal) | `salownreschedulebytoken-00074-zab` |
| 6 | `approveApplication` | stamps `availabilityFrom` on the owner barber doc — supplied valid date, else tenant-local approval date | `approveapplication-00014-yup` |

**Pinned archive contents** (compiled from `81e35d2`, `tsc -p tsconfig.build.json`):

```
lib/utils/availabilityWindow.js   5d2b76a5fcbff42a9371c957f8e5b8b42da60e10b11d144e7514dc56d262fc8e
lib/bookings/staffEligibility.js  d0fe48427bca7d5bd20eaa04ad3f5b7550eeb6b70af4b5eee2a26198d9b199e9
lib/bookings/createBooking.js     f6921aa8cdc614b6701458761ccc58e53d8d294bbf00c9bb083dc9a6e64977a2
lib/index.js                      11fb423368b76d512e103e279ae8fec4b89098810c1344bac333b2a78ed51203
```

Deploy targets:

```
firebase deploy --project havuz-44f70 --only \
  functions:salown:salownCreateBooking,\
functions:salown:salownCreateAdminBooking,\
functions:salown:salownCreateWalkIn,\
functions:salown:salownReassignBooking,\
functions:salown:salownRescheduleByToken,\
functions:salown:approveApplication
```

### Phase 2 — Admin/public and Staff clients

| # | Unit | Changed behaviour | Live version (= rollback) | Pinned artefact |
|---|---|---|---|---|
| 7 | `hosting:salown` | Admin Calendar/TimeGrid columns + `record-only` lane, booking/walk-in/block/reschedule pickers, public BookingPage slots, customer self-reschedule calendar, Occupancy denominators, Team Members creation gate + roster badges + migration warning | **`6cc0254d73227a96`** (release `1786699000997000`) | `index-Bj5ICA9p.js` `75468839832898ed…9e3e` · `Barbers-CDtne5iw.js` `d7d6d1ba75a0a9b6…b317` · `Dashboard-CTWixo9p.js` `14e5a6d56177e73e…d8f7` |
| 8 | `hosting:salown-staff` | Staff app new-booking and walk-in barber pickers exclude a pre-start member (`getAvailableBarbersForDate`) | **`585dd333a4a429cf`** (release `1786641658556000`) | `staff-CQ2TzIGv.js` `c36e12774f70c667…ab20` |

> `hosting:salown-staff` is **hand-only** (`npm run deploy:staff`); CI cannot reach it.
> After any `hosting:salown` deploy, the REL-1 cleanup is still mandatory — the other
> target's predeploy hook dirties the tracked `hosting/staff-bundle/**`.

**Live negative control, measured today.** Both live client bundles were fetched and
searched: `index-jgFucvA0.js` (sha256 `3e5bee60…ee20`) → **0** occurrences of
`availabilityFrom`; live `staff-39ZjehjJ.js` (sha256 `07d623cb…99a2`) → **0**. The boundary
is provably absent from both clients right now, so "did the deploy land?" has an unambiguous
source-marker answer afterwards.

### Phase 3 — premium site (the enforcement point for its own channel)

| # | Unit | Changed behaviour | Live version (= rollback) | Pinned artefact |
|---|---|---|---|---|
| 9 | `hosting:whitecrossbarbers-saas` | `getBarberScheduleForDay` generates no slots before the start date; `refreshBarberButtonsForDate` withdraws the button per date | **`25b14188c8e6e9ed`** (release `1786646659069000`) | `ops/rel5/release/script.js` `f7332e13cebbc9667558f5be5fc1795ef6124e20f8e98a444d20be7a269d28a9` (129,479 bytes) |

Built and verified by `ops/rel5/assemble.sh` + `ops/rel5/verify.sh` (57/57 byte parity, PASS).
Baseline is the live artefact, re-fetched and confirmed `2abd181e…49575`.
**Not** a deploy of `main`: that would activate the held W1/C1 cutover and blank the live
Double Points promotion (`WCP-1`/`WCP-2`/`WCP-3`).

### Deliberately excluded

| Unit | Why |
|---|---|
| `provisionTenant` | Held out **on instruction**, pending ROADMAP `T-h`. See §4 — T-h's stated premise is now contradicted by production, and the exclusion costs nothing. |
| `salownCreateBlock` / `salownDeleteBlock` | `blocks.ts` applies neither gate, **by decision**: a block withholds time, it does not sell any, so blocking a not-yet-started member is a no-op. Pinned by a test so the absence reads as a decision. |
| `salownGetBusySlots` | Returns PII-free busy ranges + shop hours and never enumerates `barbers`. No availability rule lives in it. Pinned by a test. |
| `whitecross2` | Not version-controlled, **non-deployable**. Source parity only, recorded in `whitecross-site/ops/rel5/whitecross2/`. |
| Firestore rules / indexes / Storage | Untouched by A1/A1.1. |

The affected-export set is **derived** from `index.ts` and compared against this plan by
`functions/src/utils/deployableExports.test.js`. A new consumer that this plan would leave
behind fails that test with its name in the diff.

---

## 2. Required order, and what breaks at each boundary

```
1. server gates + writers   (6 Function exports)
2. Admin/public + Staff     (hosting:salown, hosting:salown-staff)
3. premium Whitecross       (hosting:whitecrossbarbers-saas, via ops/rel5)
4. authenticated read-only parity smoke
```

**The invariant this order protects:** *no interval may allow a client to show or submit a
pre-start slot that the server accepts.* Server-stricter-than-client produces a refusal the
operator can see. Client-stricter-than-server produces nothing worse than a hidden column.
Client-looser-than-server-on-an-ungated-channel produces a booking, which is why phase 3 is
where the residual risk actually lives.

### Boundary A — after phase 1, before phase 2

- Servers enforce; Admin/Staff/public clients do not yet know the rule.
- A client could still display a pre-start member and submit. The server refuses:
  `failed-precondition` with `STAFF_UNAVAILABLE` (booking paths) or `STAFF_NOT_STARTED`
  (walk-in/reassign) or the "not available on that date" sentence (customer reschedule).
  **Visible error, no bad data.**
- **In practice this window is empirically empty.** Every existing barber document is a
  legacy record with no `availabilityFrom` (fail-open), no backfill has run, and the only
  writer that can produce a pre-start member for an existing tenant is the Team Members
  drawer — which ships in phase 2. `approveApplication` stamps the *approval date*, so a new
  tenant's owner is started immediately. There is therefore no reachable pre-start state
  during boundary A on any current tenant.
- Rollback: redeploy the six revisions named above, individually.

### Boundary B — between `hosting:salown` and `hosting:salown-staff`

- Both are clients, and phase 1 is already behind them, so **either order is safe**: whichever
  lags can only show a member the server will refuse.
- Recommended `salown` first, purely so the surface that can *create* a team member (and the
  migration warning that explains why) is live before the Staff app starts hiding people.
- Rollback: Hosting → Release history → roll back to the version id in §1.

### Boundary C — before phase 3 (the real exposure)

- ⚠️ **whitecrossbarbers.com has no server gate on this path.** It writes bookings directly
  to Firestore, so phases 1–2 do nothing for it. Until REL-5 is live, a pre-start Whitecross
  barber remains bookable on the public premium site, and the booking will be *accepted*.
- Today that exposure is **latent, not active**: no whitecross barber document carries
  `availabilityFrom`, so the predicate fails open and behaviour is unchanged. It becomes live
  the moment the first whitecross start date is written — which is a Team Members save, i.e.
  phase 2. **Consequence: do not begin migrating whitecross start dates until phase 3 is
  live.** If the phases must be split across days, either ship phase 3 with phase 2, or hold
  whitecross data entry until it lands.
- Rollback: Hosting → roll back to `25b14188c8e6e9ed`.

### Boundary D — after phase 3, before the smoke

- All enforcement points agree. Outstanding risk is only "did it actually land", which is
  what phase 4 answers.

---

## 3. Phase 4 — the parity smoke (read-only, authenticated)

No credential to be typed, revealed or accepted; the owner's own session only. Every check
is a read or a local view-state click.

1. **Served-byte markers.** `salown.com/app` entry chunk and `staff.salown.com` chunk both
   contain `availabilityFrom` (they contain **0** today — §1). `whitecrossbarbers.com/script.js`
   sha256 = `f7332e13…9d28a9`, and `ops/rel5/verify.sh --live` passes 57/57.
2. **Team Members.** "Add team member" with no start date is refused in **all three** statuses;
   with a valid date it saves. The migration warning shows a count matching the roster.
3. **A future-start member** (created, not backfilled) is listed with `Starts DD MMM YYYY`,
   is absent from the Admin day grid, absent from booking/walk-in/block/reschedule pickers,
   absent from the Staff app pickers, and absent from the public booking page for pre-start
   dates — and present from the start date onward.
4. **Legacy parity.** An existing barber with no start date behaves exactly as before on
   every one of those surfaces.
5. **Finance unmoved.** Whitecross Net P&L, wages and the Daily Ledger read identical to the
   pre-release figures. This is the check that matters most: it is the one A1 promises by
   construction and the one that would be expensive to be wrong about.
6. **Console clean** on every screen visited.

---

## 4. `provisionTenant` — a finding that must not be buried

The instruction was to exclude `provisionTenant` "while `T-h` says this repository is not its
live authority." **`T-h`'s premise is now contradicted by production**, and it would be wrong
to leave that unsaid:

- the live revision is **`provisiontenant-00137-bij`** and carries
  `firebase-functions-codebase=salown` — not `whitecross`, which is what `T-h` records
  (it cites `provisiontenant-00136-taj`);
- `whitecross-site/functions/index.js` **no longer exports** `provisionTenant` or
  `addToWaitlist` — both were removed on 2026-08-12;
- `whitecross-site/scripts/deploy-functions.sh` step 5b **hard-fails** any attempt to deploy
  either name from that repo, in two independent ways.

So the contention `T-h` describes is resolved, in salown-app's favour, with live evidence.

**It is still excluded here**, for two reasons that survive that finding: the instruction was
explicit, and `T-h` has not been formally closed by an owner. The exclusion is cheap —
`provisionTenant` only stamps the field on a *brand-new* tenant's first barber document, so
holding it back creates no client/server disagreement for any existing tenant. A new tenant
provisioned in the gap simply gets a legacy owner document, indistinguishable from every
other legacy document, and is picked up by the same backfill.

**Recommended follow-up (not done here):** close or correct `T-h` against this evidence, then
release `provisionTenant` as a one-line addition to phase 1. Rollback identity is
`provisiontenant-00137-bij`.

---

## 5. What this release does *not* do

- **No backfill.** Every existing barber document stays legacy and fails open. The gate has
  no effect on any current tenant until someone sets a start date.
- **No inventory run.** `scripts/availabilityFromInventory.cjs` needs credentials and has not
  been executed; the migration is unsized.
- **No Finance change.** `partnerConfig.startDate` / `staffComp.effectiveFrom` remain the sole
  wage authorities, asserted by `availabilityFinanceIsolation.test.ts`.
- **No rules, indexes or Storage change.**
- **No W1/C1 activation and no promotion change** on the premium site (asserted by
  `rel5-availability-from.test.mjs` and `ops/rel5/verify.sh`).

## 6. Gates at the pinned commit

frontend **3945/3945** (131 files) · functions **1425 pass / 31 skip / 0 fail** · both
typechecks 0 · scoped lint 0 errors · build 0 · deploy-policy **28/28** · release-guard OK ·
whitecross-site **92/92** across five suites · REL-5 assemble + verify **57/57 PASS**.
