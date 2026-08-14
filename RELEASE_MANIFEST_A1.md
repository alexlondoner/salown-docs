# STAFF-START-AUTHORITY-A1 / A1.1 / A1.2 — coordinated release manifest

> **Status: NOTHING IN THIS DOCUMENT HAS BEEN DEPLOYED.** Every "live identity" was read
> from production on **2026-08-14**; every "pinned artefact" was built from a detached
> worktree at the pinned commit and hashed. This is the plan and its evidence, not a record
> of a release. A release gets a `RELEASE_LEDGER.md` row; this file does not replace one.

**Work ID** `STAFF-START-A1` · **Source** `51171e8` (salown-app) · `f046aa14` (whitecross-site)

---

## 0. Read this first

`barbers/{id}.availabilityFrom` is a tenant-local inclusive `YYYY-MM-DD` scheduling key.
Four different kinds of thing enforce it, and conflating them is how a release like this goes
wrong:

| Kind | Unit(s) | What it means |
|---|---|---|
| **AUTHORITY — Functions** | 7 exports | Runs in-process on a callable. Cannot be bypassed by a client. |
| **AUTHORITY — Firestore rules** | `firestore.rules` | The **only** server-side gate on the premium site's direct writes. Cannot be bypassed by a client. |
| **CLIENT GUARD** | `hosting:whitecrossbarbers-saas` (REL-5) | Withholds the button and the slots. Not an authority: it is code the browser runs. |
| **UI CONSUMER** | `hosting:salown`, `hosting:salown-staff` | Presentation only — columns, pickers, badges, occupancy denominators. Every submit behind them is already covered by an authority. |
| **WRITER** | `approveApplication`, `provisionTenant`, Team Members drawer | Produces the field. Nothing enforces anything here; they stop *creating* legacy documents. |

**The single most important fact:** whitecrossbarbers.com does **not** submit through
`salownCreateBooking` — the W1/C1 cutover that would change that is HELD (`WCP-3`) — so it
writes bookings **straight to Firestore** (`setDoc(doc(db,'tenants/whitecross/bookings',id))`,
`ops/rel5/baseline/script.js:1794` group and `:1558` single). A1.2 therefore adds the rules
gate, so that channel has a real authority instead of only a client guard.

---

## 1. Deployable units

### Phase 1 — Firestore rules (AUTHORITY for direct writes)

| Unit | Live identity (= rollback) | Pinned artefact |
|---|---|---|
| `firestore:rules` | ruleset **`640c3dae-a9c8-4cb3-80c4-bc189e72874a`**, released `2026-08-05T12:52:07.274488Z`, 23,547 bytes, sha256 `ded4a970…244d` | `firestore.rules` @ `51171e8` — 29,068 bytes, sha256 `eba9f378cf79f52f8283ba813458e7f505655d33085cf9fdc46bc597c34dbab1` |

**Live parity was proven before the file was touched**, as required: `node
scripts/availabilityRulesParity.cjs` fetched the live release and its ruleset and found it
**byte-identical** to the repository file at `145b5c2`. Re-run it immediately before deploying;
a red result means STOP, not rebase. A rules deploy replaces the whole ruleset — there is no
partial apply — so a drifted repo file would silently revert every rule it does not know about.

The edit is additive: **88 lines added, 2 real lines removed** (the two `allow create:` /
`allow update:` headers, re-emitted with the gate prefixed).

Rollback: re-deploy the previous ruleset, or Console → Firestore → Rules → history →
`640c3dae-a9c8-4cb3-80c4-bc189e72874a`.

⚠️ **Rules go FIRST here, which inverts this project's usual "rules LAST" order** (`DEPLOY.md`).
That order exists so a rules tightening cannot outrun the code that satisfies it. It does not
apply: this gate constrains *data*, not app capability, and every existing barber document is a
legacy record that fails open — so on the day it lands it changes nothing for anyone. Going
first is what closes the direct-write channel before any start date exists to enforce.

### Phase 2 — Functions (AUTHORITY for every callable path) + writers

Seven exports, `europe-west2`, codebase `salown`. **Never a blanket `--only functions`** — that
deletes the 27 legacy us-central1 functions (CLAUDE.md).

| # | Export | Kind | Changed behaviour | Live revision (= rollback) |
|---|---|---|---|---|
| 1 | `salownCreateBooking` | authority | pre-start date refused above the `shiftChanges` read → `STAFF_UNAVAILABLE` | `salowncreatebooking-00003-viv` |
| 2 | `salownCreateAdminBooking` | authority | same core, admin path | `salowncreateadminbooking-00001-lav` |
| 3 | `salownCreateWalkIn` | authority | `assertAssignableStaff` → `STAFF_NOT_STARTED`, in-transaction | `salowncreatewalkin-00001-voc` |
| 4 | `salownReassignBooking` | authority | `assertAssignableStaff` → `STAFF_NOT_STARTED` | `salownreassignbooking-00001-hog` |
| 5 | `salownRescheduleByToken` | authority | `rescheduleStaffGate` → `NOT_STARTED`; customer text identical to the passive case | `salownreschedulebytoken-00074-zab` |
| 6 | `approveApplication` | writer | stamps `availabilityFrom` — supplied valid date, else tenant-local approval date | `approveapplication-00014-yup` |
| 7 | `provisionTenant` | writer | stamps the tenant-local provisioning date (see §4) | `provisiontenant-00137-bij` |

Pinned archive contents, compiled from `51171e8`:

```
lib/index.js                      11fb423368b76d512e103e279ae8fec4b89098810c1344bac333b2a78ed51203
lib/utils/availabilityWindow.js   5d2b76a5fcbff42a9371c957f8e5b8b42da60e10b11d144e7514dc56d262fc8e
lib/bookings/staffEligibility.js  d0fe48427bca7d5bd20eaa04ad3f5b7550eeb6b70af4b5eee2a26198d9b199e9
lib/bookings/createBooking.js     f6921aa8cdc614b6701458761ccc58e53d8d294bbf00c9bb083dc9a6e64977a2
```

```
firebase deploy --project havuz-44f70 --only \
  functions:salown:salownCreateBooking,\
functions:salown:salownCreateAdminBooking,\
functions:salown:salownCreateWalkIn,\
functions:salown:salownReassignBooking,\
functions:salown:salownRescheduleByToken,\
functions:salown:approveApplication,\
functions:salown:provisionTenant
```

The affected-export set is **derived** from `index.ts` by
`functions/src/utils/deployableExports.test.js` and compared against this list; it also asserts
that no affected export can be *silently* omitted.

### Phase 3 — `hosting:salown` (UI CONSUMER)

| Live version (= rollback) | Pinned artefact |
|---|---|
| **`6cc0254d73227a96`** (release `1786699000997000`) | `index-Bj5ICA9p.js` `75468839832898ed…9e3e` · `Barbers-CDtne5iw.js` `d7d6d1ba75a0a9b6…b317` |

Admin Calendar/TimeGrid + `record-only` lane, all pickers, public BookingPage slots, customer
self-reschedule calendar, Occupancy denominators, Team Members creation gate + `Starts …` badges
+ migration warning.

### Phase 4 — `hosting:salown-staff` (UI CONSUMER)

| Live version (= rollback) | Pinned artefact |
|---|---|
| **`585dd333a4a429cf`** (release `1786641658556000`) | `staff-CQ2TzIGv.js` `c36e12774f70c667…ab20` |

Staff app new-booking and walk-in pickers exclude a pre-start member. **Hand-only**
(`npm run deploy:staff`); CI cannot reach it. The REL-1 cleanup after any `hosting:salown`
deploy is still mandatory.

### Phase 5 — `hosting:whitecrossbarbers-saas` (CLIENT GUARD, via REL-5)

| Live version (= rollback) | Pinned artefact |
|---|---|
| **`25b14188c8e6e9ed`** (release `1786646659069000`) | `ops/rel5/release/script.js` `f7332e13cebbc9667558f5be5fc1795ef6124e20f8e98a444d20be7a269d28a9`, 129,479 bytes |

Built and checked by `ops/rel5/assemble.sh` + `ops/rel5/verify.sh` (57/57, PASS). **Not** a
deploy of `main` — that would activate the held W1/C1 cutover and blank the live Double Points
promotion.

**Live negative control, measured today.** `index-jgFucvA0.js` (sha256 `3e5bee60…ee20`) → **0**
occurrences of `availabilityFrom`; live `staff-39ZjehjJ.js` (`07d623cb…99a2`) → **0**; the live
`provisionTenant` archive → **0**. The boundary is provably absent from production right now, so
"did it land" has an unambiguous marker answer afterwards.

### Deliberately excluded

| Unit | Why |
|---|---|
| `salownCreateBlock` / `salownDeleteBlock` | `blocks.ts` applies neither gate, **by decision**: a block withholds time, it does not sell any. Pinned by a test. |
| `salownGetBusySlots` | Returns PII-free busy ranges + shop hours; never enumerates `barbers`. Pinned by a test. |
| `whitecross2` | Not version-controlled, **non-deployable**. Source parity tracked in `whitecross-site/ops/rel5/whitecross2/`. |
| Firestore **indexes**, Storage | Untouched. |

---

## 2. Required order, and what breaks at each boundary

```
1. Firestore rules            (authority — direct writes)   ← only if parity re-proven
2. Functions exports x7       (authority — callables; writers)
3. hosting:salown             (UI consumer)
4. hosting:salown-staff       (UI consumer)
5. hosting:whitecrossbarbers-saas via ops/rel5 (client guard)
6. authenticated read-only parity smoke
```

**The invariant:** *no interval may allow a client to show or submit a pre-start slot that the
server accepts.* Authorities first, clients second. Server-stricter-than-client yields a visible
refusal and no bad data; the reverse yields a booking.

### Boundary A — after rules, before Functions
Rules deny a pre-start direct write; callables do not yet. Both are servers, so nothing is
*shown* that was not shown before. **No reachable behaviour change on any current tenant:** every
barber document is a legacy record with no `availabilityFrom`, so both paths fail open.
Rollback: previous ruleset.

### Boundary B — after Functions, before clients
Servers enforce; Admin/Staff/public clients do not yet know the rule. A client could display a
pre-start member and submit; the server refuses with `failed-precondition`
(`STAFF_UNAVAILABLE` / `STAFF_NOT_STARTED`, or the "not available on that date" sentence).
**Visible error, no bad data.** Again empirically empty until a start date exists — and the only
surface that can create one ships in phase 3.

### Boundary C — between `hosting:salown` and `hosting:salown-staff`
Both are UI consumers behind authorities that are already live, so **either order is safe**.
`salown` first is recommended only so the surface that creates team members — and the warning
explaining why — lands before the Staff app starts hiding people.

### Boundary D — before phase 5 (materially smaller than it was)
Before A1.2 this was the real exposure: the premium site had no server gate at all. **Phase 1
closes it.** With rules live, a pre-start direct write is refused whether or not REL-5 has
shipped; what remains without phase 5 is a poor experience — the site would offer a slot and the
write would fail — not an accepted booking. Ship phase 5 promptly, but it is no longer the sole
protection.
Rollback: Hosting → roll back to `25b14188c8e6e9ed`.

### Data rule that spans every boundary
**No `availabilityFrom` may be written to any production document until every unit above is
live.** The field is inert while absent; the first one written is what activates every gate at
once. That applies to the backfill, to the Team Members screen, and to any manual edit.

---

## 3. Phase 6 — the parity smoke (read-only, authenticated)

No credential to be typed, revealed or accepted; the owner's own session only.

1. **Served-byte markers.** `salown.com/app` and `staff.salown.com` chunks contain
   `availabilityFrom` (they contain **0** today); `whitecrossbarbers.com/script.js` sha256
   `f7332e13…9d28a9`; `ops/rel5/verify.sh --live` 57/57; live ruleset sha256 `eba9f378…dbab1`.
2. **Team Members.** Creating a member with no start date is refused in **all three** statuses;
   with a valid date it saves. The migration warning's count matches the roster.
3. **A future-start member** is listed with `Starts DD MMM YYYY`, absent from the Admin day grid,
   every picker, the Staff app and the public booking page for pre-start dates — present from the
   start date onward.
4. **Legacy parity.** An existing barber with no start date behaves exactly as before, everywhere.
5. **Finance unmoved.** Whitecross Net P&L, wages and Daily Ledger identical to pre-release.
6. **Console clean** on every screen visited.

---

## 4. `provisionTenant` — `T-h` reconciled and CLOSED

A1.1 excluded it pending ROADMAP `T-h`. A1.2 checked every part of `T-h`'s premise against
production and none of it survived:

- live revision **`provisiontenant-00137-bij`** carries `firebase-functions-codebase=salown`
  — `T-h` cites `provisiontenant-00136-taj` / `whitecross`;
- the **deployed source archive** was downloaded from
  `gs://gcf-v2-sources-1050766582653-europe-west2/provisionTenant/function-source.zip#1786488838028611`
  (sha256 `e15527cd…9bd3`) and its `src/index.ts` is **byte-identical** (sha256
  `65021917405f9ccb7ddfae663aa7404832775ecf01750ec2d23939220569a8a7`) to commit **`c8036f0`**,
  which `git merge-base --is-ancestor` confirms is an ancestor of HEAD. The live function is this
  repository's code, not a foreign build sharing a name;
- **inside `provisionTenant`'s own body the only change since that archive is the A1
  `availabilityFrom` stamp.** Every other `index.ts` diff belongs to a different export
  (`salownSendLoyaltyEmail` — already live as `-00065-hej`; `adminPurgeTenant` /
  `adminGetOwnerActivity` from the approved `d316893`; `salownRescheduleByToken` from A1), and
  each export runs its own revision, so an unnamed export cannot move;
- `whitecross-site/functions/index.js` no longer exports it, and
  `whitecross-site/scripts/deploy-functions.sh` step 5b hard-fails the name in two ways.

**Conclusion: salown-app is conclusively the deployment authority.** `provisionTenant` is in
phase 2, rollback `provisiontenant-00137-bij`. **`T-h` should be closed in ROADMAP** against this
evidence; it is currently stale in a way that would mislead the next reader.

### Incidental finding (not fixed here)
`firebase.json`'s functions `ignore` is `["node_modules", ".git"]`, so the deploy archive is built
from the **working directory**, not from git. The live archive contains a 26,947-byte
`firestore-debug.log` — emulator startup output, checked: no PII, no secrets, and gitignored in
the repo, which is exactly why nobody noticed it shipping. Harmless here; worth tightening
separately, since any untracked local file in `functions/` rides along to GCP.

---

## 5. What this release does *not* do

- **No backfill, no inventory run.** `scripts/availabilityFromInventory.cjs` needs credentials
  and has not been executed; the migration is unsized.
- **No Finance change.** `partnerConfig.startDate` / `staffComp.effectiveFrom` remain the sole
  wage authorities, asserted by `availabilityFinanceIsolation.test.ts`.
- **No W1/C1 activation, no promotion change** on the premium site.
- **No index or Storage change.**

### Disclosed residue
The root rule `match /{document=**} { allow read, write: if isSuperAdmin(); }` ORs across every
match, so **a super-admin browser session can still create a pre-start booking.** No clause
inside `/bookings/{docId}` can take that away. This is the same residue
`testPromotionSnapshotRules.py` already discloses, from the same catch-all; closing it means
editing a platform-wide rule with real blast radius, which is not this package.

---

## 6. Gates at the pinned commit

frontend **3945/3945** (131 files) · functions **1426 pass / 31 skip / 0 fail** ·
rules **33/33** (`scripts/testAvailabilityRules.py`) + **17/17** (promotion snapshot) +
**170/170** (`docs/test-firestore-rules.py`, green against the live ruleset *and* the edited one)
· whitecross-site **92/92** · REL-5 assemble + verify **57/57 PASS** · both typechecks 0 ·
build 0 · deploy-policy **28/28** · release-guard OK.

**Lint, stated accurately:** the changed files carry only the pre-existing `no-undef` class that
already affects every `functions/**/*.test.js` under the browser-globals ESLint block
(`weekHours.test.js` has 3 today). Project-wide `eslint .` reports **2,957 pre-existing errors**
and is not a usable gate in this repository; scoped lint on changed files is.
