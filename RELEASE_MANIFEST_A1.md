# STAFF-START-AUTHORITY-A1 — coordinated release manifest

> **NOTHING IN THIS DOCUMENT HAS BEEN DEPLOYED.** Every live identity was read from
> production on **2026-08-14**; every pinned artefact was built from a detached worktree at
> the pinned commit and hashed. This is the plan and its evidence. A release gets a
> `RELEASE_LEDGER.md` row; this file does not replace one.
>
> Consistency is machine-checked: `node scripts/verifyReleaseManifest.mjs` (salown-app),
> which also runs inside `npm test`. It exists because a manifest accretes contradictions
> across packages, and every contradiction is a chance to deploy the wrong thing.

**Work ID** `STAFF-START-A1` · **Source** `d64f098` (salown-app) · `f046aa14` (whitecross-site)

---

## 0. Four kinds of unit, and why conflating them is dangerous

`barbers/{id}.availabilityFrom` is a tenant-local inclusive `YYYY-MM-DD` scheduling key.

| Kind | Unit(s) | What it means |
|---|---|---|
| **AUTHORITY — Firestore rules** | `firestore:rules` | The only server-side gate on the premium site's direct writes. A client cannot bypass it. |
| **AUTHORITY — Functions** | 7 exports | Runs in-process on a callable. A client cannot bypass it. |
| **UI CONSUMER** | `hosting:salown`, `hosting:salown-staff` | Presentation — columns, pickers, badges, occupancy. Every submit behind them is covered by an authority. |
| **CLIENT GUARD** | `hosting:whitecrossbarbers-saas` (REL-5) | Withholds the button and the slots. Code the browser runs, not an authority. |
| **WRITER** | `approveApplication`, `provisionTenant`, Team Members drawer | Produces the field. Stops *creating* legacy documents. |

whitecrossbarbers.com does **not** submit through `salownCreateBooking` — the W1/C1 cutover
that would change that is HELD (`WCP-3`) — so it writes bookings **straight to Firestore**
(`setDoc(doc(db,'tenants/whitecross/bookings',id))`, `ops/rel5/baseline/script.js:1794` group,
`:1558` single). That is why phase 1 exists.

---

## 1. Deployable units

### Phase 1 — `firestore:rules` (AUTHORITY, direct writes)

| Live identity (= rollback) | Pinned artefact |
|---|---|
| ruleset **`640c3dae-a9c8-4cb3-80c4-bc189e72874a`**, released `2026-08-05T12:52:07.274488Z`, 23,547 bytes, sha256 `ded4a970…244d` | `firestore.rules` @ `d64f098` — `30,132` bytes, sha256 `2d2097a0cd9262dc6db819097ba9c6c6f08977b3b488c5b41c6e3b55b93c6c8e` |

Live parity was proven **byte-identical before the file was touched**
(`node scripts/availabilityRulesParity.cjs`). Re-run it immediately before deploying: a rules
deploy replaces the whole ruleset — there is no partial apply — so a drifted repo file would
silently revert every rule it does not know about. A red result means STOP, not rebase.

Rules go **first**, which inverts this project's usual "rules LAST" order (`DEPLOY.md`). That
order protects against a rules tightening outrunning the code that satisfies it; it does not
apply here, because this gate constrains *data* and every barber document is currently a
legacy record that fails open. Going first closes the direct-write channel before any start
date exists to enforce.

Rollback: Console → Firestore → Rules → history → the ruleset id above.

### Phase 2 — Functions (AUTHORITY for callables, plus both writers)

Seven exports, `europe-west2`, codebase `salown`.

| # | Export | Kind | Changed behaviour | Live revision (= rollback) |
|---|---|---|---|---|
| 1 | `salownCreateBooking` | authority | pre-start date refused above the `shiftChanges` read → `STAFF_UNAVAILABLE` | `salowncreatebooking-00003-viv` |
| 2 | `salownCreateAdminBooking` | authority | same core, admin path | `salowncreateadminbooking-00001-lav` |
| 3 | `salownCreateWalkIn` | authority | `assertAssignableStaff` → `STAFF_NOT_STARTED`, in-transaction | `salowncreatewalkin-00001-voc` |
| 4 | `salownReassignBooking` | authority | `assertAssignableStaff` → `STAFF_NOT_STARTED` | `salownreassignbooking-00001-hog` |
| 5 | `salownRescheduleByToken` | authority | `rescheduleStaffGate` → `NOT_STARTED`; customer text identical to the passive case | `salownreschedulebytoken-00074-zab` |
| 6 | `approveApplication` | writer | stamps `availabilityFrom` — supplied valid date, else tenant-local approval date | `approveapplication-00014-yup` |
| 7 | `provisionTenant` | writer | stamps the tenant-local provisioning date (§4) | `provisiontenant-00137-bij` |

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

Never a blanket `--only functions` — that deletes the 27 legacy us-central1 functions. The
affected-export set is **derived** from `index.ts` by
`functions/src/utils/deployableExports.test.js`, which also forbids silent omission.

**Deploy archive** (A1.3). The archive is built from the working directory, not from git.
`node scripts/functionsArchiveManifest.cjs` enumerates it using the pinned CLI's own file
walker and gates on it:

```
files            150   (was 238 under the pre-A1.3 policy)
size             3.28 MiB
manifest digest  763521f6ff6c5e3b09230830cce3115d9ae44f6e2f706f7dbaa5846a98abd079
```

Compiled `lib/` hashes at `d64f098`:

```
lib/index.js                      11fb423368b76d512e103e279ae8fec4b89098810c1344bac333b2a78ed51203
lib/utils/availabilityWindow.js   5d2b76a5fcbff42a9371c957f8e5b8b42da60e10b11d144e7514dc56d262fc8e
lib/bookings/staffEligibility.js  d0fe48427bca7d5bd20eaa04ad3f5b7550eeb6b70af4b5eee2a26198d9b199e9
lib/bookings/createBooking.js     f6921aa8cdc614b6701458761ccc58e53d8d294bbf00c9bb083dc9a6e64977a2
```

### Phase 3 — `hosting:salown` (UI CONSUMER)

| Live version (= rollback) | Pinned artefact |
|---|---|
| **`6cc0254d73227a96`** (release `1786699000997000`) | `index-Bj5ICA9p.js` `75468839832898ed…9e3e` · `Barbers-CDtne5iw.js` `d7d6d1ba75a0a9b6…b317` |

Admin Calendar/TimeGrid + `record-only` lane, all pickers, public BookingPage slots, customer
self-reschedule calendar, Occupancy denominators, Team Members creation gate + `Starts …`
badges + migration warning.

### Phase 4 — `hosting:salown-staff` (UI CONSUMER)

| Live version (= rollback) | Pinned artefact |
|---|---|
| **`585dd333a4a429cf`** (release `1786641658556000`) | `staff-CQ2TzIGv.js` `c36e12774f70c667…ab20` |

Staff app new-booking and walk-in pickers exclude a pre-start member. Hand-only
(`npm run deploy:staff`). The REL-1 cleanup after any `hosting:salown` deploy still applies.

### Phase 5 — `hosting:whitecrossbarbers-saas` (CLIENT GUARD, via REL-5)

| Live version (= rollback) | Pinned artefact |
|---|---|
| **`25b14188c8e6e9ed`** (release `1786646659069000`) | `ops/rel5/release/script.js` `f7332e13cebbc9667558f5be5fc1795ef6124e20f8e98a444d20be7a269d28a9`, 129,479 bytes |

Built and checked by `ops/rel5/assemble.sh` + `ops/rel5/verify.sh` (57/57). Not a deploy of
`main`: that would activate the held W1/C1 cutover and blank the live Double Points promotion.

**Live negative control, measured today.** `index-jgFucvA0.js` (`3e5bee60…ee20`) → **0**
occurrences of `availabilityFrom`; live `staff-39ZjehjJ.js` (`07d623cb…99a2`) → **0**; the live
`provisionTenant` archive → **0**. The boundary is provably absent from production, so "did it
land" has an unambiguous marker answer afterwards.

### Deliberately excluded

| Unit | Why |
|---|---|
| `salownCreateBlock` / `salownDeleteBlock` | `blocks.ts` applies neither gate, **by decision**: a block withholds time, it does not sell any. Pinned by a test. |
| `salownGetBusySlots` | Returns PII-free busy ranges + shop hours; never enumerates `barbers`. Pinned by a test. |
| `whitecross2` | Not version-controlled, **non-deployable**. Source parity tracked in `whitecross-site/ops/rel5/whitecross2/`. |
| Firestore **indexes**, Storage | Not part of this work. |

---

## 2. Release order, and what breaks at each boundary

```
1. firestore:rules                             (authority — direct writes)
2. seven Functions exports                     (authority — callables; writers)
3. hosting:salown                              (UI consumer)
4. hosting:salown-staff                        (UI consumer)
5. hosting:whitecrossbarbers-saas via ops/rel5 (client guard)
6. read-only parity smoke
```

**The invariant:** no interval may allow a client to show or submit a pre-start slot that the
server accepts. Authorities first, clients second. Server-stricter-than-client yields a visible
refusal and no bad data; the reverse yields a booking.

**Boundary A — after rules, before Functions.** Both are servers; nothing shown changes. No
reachable behaviour change on any current tenant, because every barber document is a legacy
record with no `availabilityFrom` and both paths fail open.

**Boundary B — after Functions, before clients.** Servers enforce; clients do not yet know the
rule. A client could display a pre-start member and submit; the server refuses with
`failed-precondition`. Visible error, no bad data.

**Boundary C — between the two hosting UI consumers.** Both sit behind live authorities, so
either order is safe. `hosting:salown` first is recommended only so the surface that creates
team members, and the warning explaining why, lands before the Staff app starts hiding people.

**Boundary D — before phase 5.** Phase 1 already refuses a pre-start direct write, so what
remains without phase 5 is a poor experience — the site offers a slot and the write fails — not
an accepted booking.

**Spanning every boundary:** no `availabilityFrom` may be written to any production document
until every unit above is live. The field is inert while absent; the first value written
activates every gate at once.

---

## 3. Phase 6 — the parity smoke (genuinely read-only)

This section creates nothing. It navigates, reads and compares. Form validation may be
*exercised* without submitting — open the drawer, observe the required-field error, close it.
No member creation, no booking, no reschedule, no write of any kind.

1. **Served-byte and revision markers.** `salown.com/app` and `staff.salown.com` chunks contain
   `availabilityFrom` (they contain 0 today); `whitecrossbarbers.com/script.js` sha256
   `f7332e13…9d28a9`; `ops/rel5/verify.sh --live` 57/57; live ruleset sha256 matches the
   pinned artefact; the seven function revisions have advanced from the identities in §1.
2. **Legacy fail-open parity.** An existing barber with no start date behaves exactly as before
   on the Admin grid, every picker, the Staff app and the public booking page.
3. **Finance unchanged.** Whitecross Net P&L, wages and the Daily Ledger read identical to the
   pre-release figures.
4. **Validation, exercised not submitted.** The Team Members drawer shows the required-date
   error for a new member in all three statuses; the drawer is then closed unsaved.
5. **Console clean** on every screen visited.

### The first real future-start member is a separate, authorised action

Verifying the before/start/after surfaces needs a record that has a start date, and no such
record exists until the owner makes one. That is a **business action, not a test step**, and it
is not part of this release:

- the **owner** picks the real person's real start date and saves **once**;
- no synthetic or demo staff member is created in Whitecross;
- the write is monitored and separately authorised;
- **afterwards**, the before / start / after surface checks are performed read-only around that
  real record.

**A1.3 does not execute that write.**

---

## 4. `provisionTenant` — `T-h` reconciled and CLOSED

Every part of `T-h`'s premise was checked against production and none survived:

- the live revision carries `firebase-functions-codebase=salown` — `T-h` cites
  `provisiontenant-00136-taj` / `whitecross`;
- the **deployed source archive** was downloaded from
  `gs://gcf-v2-sources-1050766582653-europe-west2/provisionTenant/function-source.zip#1786488838028611`
  and its `src/index.ts` is **byte-identical** (sha256 `65021917…a8a7`) to commit **`c8036f0`**,
  which `git merge-base --is-ancestor` confirms is an ancestor of HEAD;
- inside `provisionTenant`'s own body the only change since that archive is the A1
  `availabilityFrom` stamp. Every other `index.ts` diff belongs to a different export, and each
  export runs its own revision, so an unnamed export cannot move;
- `whitecross-site/functions/index.js` no longer exports it, and its `deploy-functions.sh`
  step 5b hard-fails the name in two independent ways.

salown-app is conclusively the deployment authority. `T-h` is **CLOSED**; it should be marked so
in ROADMAP, where it is currently stale in a way that would mislead the next reader.

---

## 5. Known exception — the platform-wide super-admin catch-all

The root rule `match /{document=**} { allow read, write: if isSuperAdmin(); }` ORs across every
match, so **no clause inside `/bookings/{docId}` can take it away**: a super-admin browser
session can still create a pre-start booking.

This is a **known exception, tracked as ROADMAP `SEC-CATCHALL-1`** — it is NOT enforcement, and
this release does not claim otherwise. It is asserted rather than described, by the last case in
`test/rules/availabilityFrom.emulator.test.js`, so if the catch-all is ever scoped that test
goes red and this section must be updated. The same residue is already disclosed by
`scripts/testPromotionSnapshotRules.py`, from the same rule.

Closing it means editing a platform-wide grant with real blast radius, which is its own package.

---

## 6. What this release does not do

- **No backfill, no inventory run.** `scripts/availabilityFromInventory.cjs` needs credentials
  and has not been executed; the migration is unsized.
- **No Finance change.** `partnerConfig.startDate` / `staffComp.effectiveFrom` remain the sole
  wage authorities, asserted by `availabilityFinanceIsolation.test.ts`.
- **No W1/C1 activation, no promotion change** on the premium site.
- **No production business-data write of any kind.**

---

## 7. Gates at the pinned commit

frontend `**3960/3960** (133 files)` · functions `**1426 pass / 31 skip / 0 fail**` · rules Test API **38/38** (incl. an exhaustive
1583–2400 Gregorian corpus) · rules **real emulator 15/15** with two mutation controls ·
promotion-snapshot rules **17/17** · `docs/test-firestore-rules.py` **170/170** (green against
the live ruleset *and* the edited one) · whitecross-site **92/92** · REL-5 assemble + verify
**57/57** · archive policy **12/12** · manifest consistency ****31/31**** · both
typechecks 0 · build 0 · deploy-policy **28/28** · release-guard OK.

**Scoped lint:** every file introduced or modified by A1.2/A1.3 reports **0 errors, 0 warnings**.
Repo-wide `eslint .` baseline delta vs `145b5c2`: **0 errors, 0 warnings**.
