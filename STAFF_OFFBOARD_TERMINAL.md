# STAFF-OFFBOARD-TERMINAL — the canonical departure

**Status:** implemented `2026-08-29`. Server core + callable op + owner UI.
**Contract owners:** `functions/src/staff/lifecycleOffboard.ts` (the operation) ·
`functions/src/staff/rotaWriter.ts` (the `ROTA_OFFBOARD` action) ·
`functions/src/staff/lifecycleContract.ts` (the vocabulary).

---

## 1. Why it exists

A departure is **three facts held in three authorities**:

| # | Authority | Fact | Who may read it |
|---|---|---|---|
| 1 | `tenants/{t}/barbers/{id}` — `status: 'passive'`, `active: false` | assignability + availability, **undated and absolute** (PASSIVE-AUTHORITY-R3) | world-readable |
| 2 | `tenants/{t}/staffComp/{id}` — the open period closed at the last working day | the **wage** boundary Finance gates on | owner / super-admin only |
| 3 | `tenants/{t}/staffRota/{id}` — the **terminal archive** | the **schedule** the dated readers use | any tenant member |

Before this operation the three were three separate hand-writes. Whitecross/Arda
had **two of them**: `status: passive` and `staffComp.effectiveTo: 2026-08-04`
were written on the day he left; the rota was never told, so its last period
stayed open-ended at six days a week — for ever. Home read that and credited him
24 working days in a month he worked 3 ([INCIDENTS 2026-08-29](INCIDENTS.md)).

The screen was fixed by `HOME-ACCRUAL-PERIOD-PARITY`. The **data** is fixed by
making the three inseparable.

## 2. The operation

`salownStaffLifecycle` · `op: 'OFFBOARD'` — the existing lifecycle callable, one
more op. No new callable, no new collection, no rules change.

```jsonc
{
  "op": "OFFBOARD",
  "barberId": "barber-…",
  "idempotencyKey": "slv-off-…",     // 8–128 chars [A-Za-z0-9_.:-]
  "lastWorkingDay": "2026-08-04",    // INCLUSIVE, tenant-local
  "reason": "…",                     // required when backdated
  "evidenceRef": "…"                 // required when backdated
}
```

Everything else is **server-derived** and refused by name if supplied
(`LIFECYCLE_FORBIDDEN_KEYS`): `status`, `active`, `tenantId`, the actor, any rota
field, `effectiveFrom`/`effectiveTo`, `staffComp`.

**`lastWorkingDay` is inclusive.** The terminal rota period opens on
`lastWorkingDay + 1`; the compensation period closes **on** `lastWorkingDay`. So
the last day worked is still a paid rota day and the day after is not — one date,
two records, derived once (`nextDayKey`, plain UTC arithmetic on a calendar key,
no zone, asserted across the BST→GMT changeover).

## 3. Authority

| Case | Who |
|---|---|
| `lastWorkingDay` = tenant today | **owner** or super-admin |
| `lastWorkingDay` in the past (backdated) | **super-admin only**, plus a `reason`, plus an `evidenceRef`, plus an attributable audit identity — all four or nothing is written |
| `lastWorkingDay` in the future | **refused** (`LAST_WORKING_DAY_IN_FUTURE`) |

An `admin` may record a **leave** and may **not** record a departure: a departure
closes a compensation period and `staffComp` is owner-only in `firestore.rules`.
Granting it through a callable would be an escalation invisible in the rules file.

A future departure is refused because this operation writes `status: 'passive'`,
which is **undated and absolute** — it would make the member unbookable on days it
simultaneously claims they work. A *scheduled* departure is a different operation
and does not exist.

The backdate rule is `ROTA_OVERRIDE`'s, applied to a period. **`ROTA_CHANGE`'s own
`BACKDATED` refusal is untouched** — the rule the 2026-08-12 wage incident bought
stays exactly as it was for every start and every schedule change.

## 4. Atomicity

One Firestore transaction. The **rota engine owns it**, because it owns the hash
chain, the revision and the cache convergence; the departure core rides inside it
through two seams:

* `attachExtraRead` — the core's own reads (actor, subject, compensation history)
  in the READ phase, so every decision is made against the same snapshot the
  append is made against. **A refusal here throws, and the throw aborts the commit
  with zero writes.**
* `attachExtraWrite` — the status write, the compensation close and the lifecycle
  audit record, queued **before** the engine's own writes so a rejected write
  takes the append down with it.

Six writes commit together:

```
barbers/{id}                        status, active, updatedAt        (set, merge)
staffComp/{id}                      history[] with effectiveTo       (set, merge — skipped if nothing is open)
staffRota/{id}/rotaEntries/{e1}     ROTA_CLOSE  → effectiveTo = lastWorkingDay   (create)
staffRota/{id}/rotaEntries/{e2}     ROTA_OPEN   → effectiveFrom = lastWorkingDay+1, terminal pattern (create)
staffRota/{id}                      revision, entriesHash, entryCount, lastChangeId, lastOrigin
auditLogs/stafflifecycle_offboard_… the lifecycle record            (create — the derived id IS the idempotency)
auditLogs/rota_append_…             the engine's own append record
```

## 5. The rota half — `ROTA_OFFBOARD`

A **seventh engine action** and a **seventh origin**. Same *shape* as
`ROTA_CHANGE` (`[ROTA_CLOSE, ROTA_OPEN]`, enforced by the fold's group rule),
different *name*, different *authority*, and the pattern is **composed by the
engine**, never accepted from a caller:

```
scheduleMode: 'by_exception' · workingDays: [] · dayHours: null · hours: null
```

`salownRotaTransaction` **refuses `ROTA_OFFBOARD` by name**
(`ROTA_CALLABLE_DENIED_ACTIONS`), the treatment `ROTA_IMPORT` gets. Reaching it
directly would be a way to write the rota third of a departure and neither of the
others.

### The legacy mirror is deliberately NOT re-authored

`rotaLegacyWriteGate` **blocks** the cache publish for a terminal period
(`BY_EXCEPTION_LEGACY_UNSAFE`, because this core passes the fail-closed
`legacyReadersEnabled: true`). That is load-bearing, not incidental:
`financeWages.hasWeeklyPattern` reads `barbers.workingDays`, and an empty array
would flip every accrual for that subject from the rota branch to the
booking-derived fallback — answering **2** for a month somebody worked **3**.
Pinned by `lifecycleOffboard.test.js` (25).

## 6. Error codes

| Code | Meaning | HTTPS |
|---|---|---|
| `LAST_WORKING_DAY_INVALID` | not a real `YYYY-MM-DD` (shape *and* calendar) | `invalid-argument` |
| `LAST_WORKING_DAY_IN_FUTURE` | dated after the tenant's today | `failed-precondition` |
| `BACKDATED_NOT_PERMITTED` | already happened, actor is not super-admin | `permission-denied` |
| `BACKDATED_REASON_REQUIRED` / `BACKDATED_EVIDENCE_REQUIRED` | backdated without both | `failed-precondition` |
| `COMP_PERIOD_CONFLICT` | a period is already closed on a **different** day — never overwritten | `failed-precondition` |
| `COMP_DATA_UNREADABLE` | `history` is not an array | `failed-precondition` |
| `ROTA_TERMINAL_CONFLICT` | a terminal period already starts on a different day | `failed-precondition` |
| `BOOKINGS_AFTER_LAST_WORKING_DAY` | unresolved bookings after that day; `errors[0]` is a **count**, never a customer | `failed-precondition` |
| `ROTA_REFUSED` | the engine refused; its own reason is in `errors[0]` | `failed-precondition` |
| `PARTIAL_STATE` | the three authorities disagree about a departure already on file — a report, not a write | `failed-precondition` |
| `PERMISSION_DENIED` / `ACTOR_OFFBOARDED` | actor may not act, or their own access is revoked | `permission-denied` |
| `IDEMPOTENCY_CONFLICT` | same key, different request | `failed-precondition` |

Two success states: **`APPLIED`** (written now) and **`SETTLED`** (every authority
already says exactly this — zero writes, however many times it is asked, and
under any idempotency key).

## 7. Operator runbook

1. **Team Members → the member → “Set passive”.** The sheet is the only door.
2. Enter the **last working day**. It defaults to the tenant's today and cannot be
   in the future.
3. If it is in the past the sheet demands a **reason** and an **evidence
   reference**, and only a super-admin can send it.
4. Read the four rows — status, pay period, rota, unchanged — and type the confirm
   phrase.
5. **Record departure.** One request; there is no retry and no browser fallback.
6. An ambiguous outcome (`verification_required`) means **it is not known whether
   it was saved**. Do not resend. Reload and read the member's status and the
   audit log.

## 8. Rollback and recovery

**There is no undo, and that is the design.** The rota log is append-only with no
delete and no rewind — the same property that makes it evidence.

* **Wrong last working day, caught before anything else happens:** it cannot be
  overwritten (`COMP_PERIOD_CONFLICT` / `ROTA_TERMINAL_CONFLICT`). A correction is
  a `ROTA_SUPERSEDE` on the departure's `changeId` plus an owner decision about
  the compensation period — a separate, reviewed operation, not a second offboard.
* **Code rollback:** the callable is one `CORES` entry; reverting the
  implementation commit removes the op and returns `OP_NOT_IMPLEMENTED`. Nothing
  already written changes.
* **Deploy rollback:** redeploy `salownStaffLifecycle` from the previous source
  revision, targeted (`./scripts/deploy-functions.sh salownStaffLifecycle`).
  Hosting rolls back by VERSION ID.
* **Recovery from a torn state:** `PARTIAL_STATE` is reported, never repaired
  silently. It cannot arise from this operation (one transaction); it would mean
  somebody wrote one authority by hand.

## 9. Deliberately out of scope

* **REHIRE.** Reopening a compensation period and a rota is its own operation with
  its own authority. `LIFECYCLE_OPS.REHIRE` stays declared and unimplemented, and
  is tracked as **`STAFF-REHIRE`** on the roadmap (`PLANNED`, model not designed).

  Two facts worth carrying into that design, both established here:

  - **the rota half needs no new action.** An ordinary `ROTA_CHANGE` on the return
    date closes the terminal archive and opens a new weekly period, with every
    archived entry preserved byte for byte — `rotaArchive.test.js` A3a proves it
    end to end;
  - **activation today writes only the status.** `cycleStatus` sets
    `status: 'active'` / `active: true` and nothing else, so after it the terminal
    rota period is still in force (the dated readers keep answering `works:false`)
    while `barbers.workingDays` was never cleared, so legacy availability offers
    the member again. That is the mirror image of the drift this document exists
    to describe — bookable, scheduled for zero days, accruing nothing — and it is
    the actual reason `STAFF-REHIRE` matters.
* **App access.** `staff/{uid}.accessStatus` is the S4A offboarding state machine
  (`offboarding.ts`), which is *resumable* precisely because Auth + Firestore +
  FCM cannot be made atomic. Folding it in would make this transaction unable to
  keep the promise its whole design is.
* **Services, bookings, receipts, wages already paid.** Nothing historical is
  edited, ever.

---


# 10. REHIRE — the model

**Status:** model DECIDED 2026-08-30 and **amended the same day by the owner**
(§10.2 ①, §10.5). Implementation not started — `STAFF-REHIRE`, `PLANNED`.
Nothing below is built.

## 10.1 What a rehire is, and the one thing it is not

A rehire is a **new employment period** for somebody whose previous one is closed.
It appends; it never edits. The archived rota entries, the closed compensation
period and every past booking stay exactly as they are.

It is **not** the correction of a mistaken departure:

| | rehire | correction |
|---|---|---|
| the departure | really happened | should never have been recorded |
| the gap | real, and accrues nothing | does not exist |
| the log | append a new period | withdraw the departure (`ROTA_SUPERSEDE`) |
| the pay period | a NEW one, opened by the owner first | the closed one is amended |

`compUtils.appendPeriod` already enforces the distinction and will not be argued
with, and it does so with **the same boundary this design arrived at
independently**:

* `next.effectiveFrom > last.effectiveTo` ⇒ appends cleanly. That is exactly the
  rehire case, and it is exactly `RETURN_ON_NOT_AFTER_DEPARTURE`;
* `next.effectiveFrom === last.effectiveTo` ⇒ it pulls the close back a day —
  the branch its own comment calls *"same-day passive reversal"*. That is the
  **correction**, and it is a Pay-tab operation;
* anything earlier ⇒ **throws**.

So the two operations are already distinguishable in the data model, by a rule
written before either of them existed. `REHIRE` accepts only the first and
refuses rather than amending. **This also confirms the design is implementable:**
the period it requires is one the Pay tab can already create for a departed
member, with no change to `appendPeriod`.

## 10.2 The four questions, answered

### ① The pay model — REHIRE does not WRITE one, and REFUSES without one

> **Owner amendment, 2026-08-30.** The first version of this model said the
> operation would open no compensation period and merely *warn* that none was
> open. That was wrong, and wrong in the exact way this whole document exists to
> prevent. It produced a reachable state of
> **`active` + bookable + a live weekly rota + no valid `staffComp` period** —
> working and not accruing. That is not a smaller version of the departure drift,
> it is the same drift wearing the other face, and a warning is not an authority.

The correction keeps what was right and fixes what was not:

* **`REHIRE` still writes NO compensation period.** `comp` stays out of the
  request keys and out of the write set. The reason is unchanged: a departure has
  an unambiguous date to close on, a rehire has no unambiguous **amount** to open
  with, and inventing one writes a commercial decision nobody made into the
  document Finance prices from. `staffComp` keeps its two writers — the Pay tab
  and the departure — and gains no third.
* **`REHIRE` REQUIRES one to already exist.** Inside the transaction it re-reads
  `staffComp/{barberId}` and refuses unless a **usable period covers `returnOn`**.
  No period, a gap, a malformed record, or one that stops before `returnOn`
  ⇒ **`REHIRE_COMP_PERIOD_REQUIRED`**, zero writes.

The distinction is the whole point: **not writing** something is a scope decision;
**not requiring** it was a hole. The operation refuses to make somebody bookable
that Finance would pay nothing for.

**What counts as usable — four conditions, and each rejects something the others
let through:**

```
period.effectiveFrom === returnOn            // starts ON the day they return
period.effectiveTo   === null                // and is the trailing OPEN period
compPeriodVerdict(history, returnOn) === 'covered'
fingerprint(period)  === expectedCompFingerprint
```

* **`effectiveFrom === returnOn`, exactly.** "Covers `returnOn`" is not enough,
  and the gap is not theoretical: an owner who mis-types the date opens a period
  from 2026-08-20 for somebody returning on 2026-08-30, and the record then
  **claims an employment that covers ten days the person did not work**. The rota
  terminal stops the money — `compPeriodVerdict` answers `'outside'` for those
  days once the terminal period is in force — but that is a second authority
  compensating for a wrong one, not a correct record. `staffComp` is not merely an
  accrual input: it is the document that says **when employment resumed**, and two
  authorities disagreeing about that date is the class of drift this whole item
  exists to remove. An earlier `effectiveFrom` is refused, not silently priced
  around.
* **`effectiveTo === null`.** A closed period that happens to span `returnOn` is an
  employment already scheduled to end, and a rehire is not the operation that
  records that.
* **`compPeriodVerdict === 'covered'`** is kept even though the first two conditions
  imply it, because it is the canonical predicate every Finance accrual path gates
  on and it is the one that rejects a **malformed** record: a period whose
  `effectiveFrom` is not a real date key resolves to `'unknown'`, never
  `'covered'`. Restating the rule here instead of borrowing it would be a second
  opinion about what "employed on this day" means.
* **the fingerprint** covers the **whole `history` array**, not just the trailing
  period. `compPeriodVerdict` reads overlapping periods as a **union** — legal by
  contract but real in production — so an edit to an *earlier* entry can change
  the answer for `returnOn` without touching the trailing one. Fingerprinting only
  the period the sheet displayed would leave exactly that gap open.

**Drift between the sheet and the commit is refused, not tolerated.** The sheet
shows the period read-only; the request carries the fingerprint of exactly what
it displayed; the transaction re-reads the document and refuses if the answer
moved. That is the treatment the rota preconditions already get
(`expectedRevision` / `expectedEntriesHash`), applied to the other authority, and
wage data earns it: without it, a rate edited between render and submit would be
committed under a period the operator never saw.

**The resulting operation order:**

1. the owner opens the new compensation period on the **Pay tab** —
   `effectiveFrom` **exactly** `returnOn`, open-ended, no overlap with the closed
   one, a live model;
2. the rehire sheet displays that period **read-only** — the owner sees what
   Finance will price before agreeing to anything;
3. `REHIRE` re-reads the same document **inside the transaction**;
4. valid ⇒ the rota period and the status open together;
5. missing, changed or not covering ⇒ **zero writes**.

### ② Backdated? No. Future-dated? Also no. `returnOn` is TODAY.

Both halves are refusals, for **opposite** reasons — which is why neither is
grounds for the other's exception.

* **The past** is refused because `ROTA_CHANGE` refuses it outright, and that rule
  is the one the 2026-08-12 wage incident bought. `ROTA_OFFBOARD` was given a
  narrow, argued exception because a departure is the one period edit with a
  legitimate past — somebody left three weeks ago and the log was never told. A
  rehire has no such story: the person is standing in the salon. **No exception is
  argued, so none is taken.**
* **The future** is refused because publishing a future period is a job somebody
  must do on the effective date and nothing runs
  (`ROTA_FUTURE_ACTIVATION_ENABLED = false`). `ROTA_OFFBOARD` was exempted from
  that gate on the argument that `passive` is an undated absolute stop, so the
  legacy cache did not matter. **For a rehire the opposite is true**: the member
  becomes bookable, and the legacy cache is precisely what the availability
  surfaces read. The exemption is not merely unavailable here — it would be wrong.

`returnOn` must equal the tenant's today, resolved from the **authoritative tenant
timezone** (`resolveTenantTodayKey`, the tenant's own presentation) and never from
the browser or the server's clock. It must also be **strictly after the last
working day** the departure recorded — the equal date is refused as well, which is
why the code is `RETURN_ON_NOT_AFTER_DEPARTURE` and not `…_BEFORE_…`.

### ③ One transaction, through the same seam

An ordinary **`ROTA_CHANGE`** — no new engine action, because the rota half
already works: A3a in `functions/src/staff/rotaArchive.test.js` proves a
`ROTA_CHANGE` on the return date closes the terminal archive and opens a new
weekly period with every archived entry preserved byte for byte.

The status write rides in `attachExtraWrite` and the reads — actor, subject **and
the compensation document** — in `attachExtraRead`. That seam gets its second
consumer, which is the argument for having added it.

**The legacy cache republishes itself**, and `rotaLegacyWriteGate` gives the two
operations opposite answers, both correct:

| | new period | convergence reason | gate |
|---|---|---|---|
| `OFFBOARD` | `by_exception` / `[]` | `BY_EXCEPTION_LEGACY_UNSAFE` | **BLOCK** — an empty `workingDays` would flip `hasWeeklyPattern` and drop every accrual to the booking fallback |
| `REHIRE` | `weekly` / real days | `PATTERN_CHANGED` | **ALLOW** — the engine republishes `workingDays` / `dayHours` / `hours` |

### ④ App access — excluded, for the reason `OFFBOARD` excluded it

`restoreAppAccess` and `restoreServices` leave the request keys.
`staff/{uid}.accessStatus` belongs to the S4A offboarding state machine, which is
**resumable precisely because Auth + Firestore + FCM cannot be made atomic**.
Restoring an account stays separate — and because it stays separate, the sheet
must **say so** (§10.5).

## 10.3 The contract

```jsonc
{
  "op": "REHIRE",
  "barberId": "barber-…",
  "idempotencyKey": "slv-rhr-…",
  "returnOn": "2026-09-01",              // MUST equal the tenant's today
  "pattern": { "scheduleMode": "weekly", "workingDays": [...], … },
  "expectedCompFingerprint": "sha256…"   // the period the sheet displayed
}
```

`comp`, `restoreAppAccess` and `restoreServices` are **removed** from
`LIFECYCLE_REQUEST_KEYS.REHIRE`.

**Authority:** owner or super-admin — the same gate as `OFFBOARD`. One lifecycle
boundary, one role list.

**Writes (all or nothing):**

```
barbers/{id}                     status: 'active', active: true, updatedAt   (set, merge)
staffRota/{id}/rotaEntries/{e1}  ROTA_CLOSE  → effectiveTo = returnOn − 1     (create)
staffRota/{id}/rotaEntries/{e2}  ROTA_OPEN   → effectiveFrom = returnOn, the confirmed week
staffRota/{id}                   revision, entriesHash, entryCount, lastChangeId, lastOrigin
barbers/{id}                     workingDays / dayHours / hours — by the ENGINE's convergence
auditLogs/stafflifecycle_rehire_…  the lifecycle record                      (create)
auditLogs/rota_append_…            the engine's own append record
```

`staffComp` appears nowhere in that list, and that is the point.

**Refusals** — each costs zero writes:

| Code | When |
|---|---|
| **`REHIRE_COMP_PERIOD_REQUIRED`** | the trailing `staffComp` period does not satisfy all four conditions: `effectiveFrom === returnOn`, `effectiveTo === null`, verdict `'covered'`, fingerprint unchanged since the sheet displayed it |
| `SUBJECT_NOT_PASSIVE` | the member is not departed. **An already-active member is refused**, not settled — see §10.4 |
| `NO_TERMINAL_PERIOD` | the rota holds no terminal `ROTA_OFFBOARD` archive to close. **Fail-closed**: they were never properly offboarded, so the answer is `OFFBOARD` first, or this is a correction |
| `RETURN_ON_NOT_TODAY` | `returnOn` is not the tenant's today (both directions) |
| `RETURN_ON_NOT_AFTER_DEPARTURE` | `returnOn` is not **strictly** after the recorded last working day. Named for what it refuses rather than for one side of it: the equal date is rejected too, and `…_BEFORE_…` would have read as if it were allowed |
| `PATTERN_REQUIRED` | no weekly pattern supplied; its CONTENT is judged by the fold, not here |
| `PERMISSION_DENIED` · `ACTOR_OFFBOARDED` · `IDEMPOTENCY_CONFLICT` · `ROTA_REFUSED` · `PARTIAL_STATE` | as `OFFBOARD` |

## 10.4 Acceptance criteria

The list an implementation is measured against. Every line is testable.

1. **An already-active member is REFUSED** (`SUBJECT_NOT_PASSIVE`) — `SETTLED` is
   reserved for a genuine replay of the **same idempotency key**, and for nothing
   else. This is stricter than `OFFBOARD`'s settled rule, deliberately: a
   departure that is already recorded is a repeat of a fact, whereas an active
   member being "rehired" is a request nobody can interpret.
2. **No terminal `ROTA_OFFBOARD` period ⇒ fail-closed** (`NO_TERMINAL_PERIOD`).
3. **`returnOn` is STRICTLY after the recorded last working day** — the equal date
   is refused too (`RETURN_ON_NOT_AFTER_DEPARTURE`).
4. **`returnOn` equals the tenant's today**, resolved from the authoritative tenant
   timezone — never the browser clock, never the server's.
5. **The trailing `staffComp` period satisfies all four conditions** —
   `effectiveFrom === returnOn` **exactly**, `effectiveTo === null`, verdict
   `'covered'`, and unchanged since the sheet displayed it. An `effectiveFrom`
   earlier than `returnOn` is refused even though the rota terminal would stop the
   money: the record would claim an employment covering days nobody worked.
   Otherwise `REHIRE_COMP_PERIOD_REQUIRED` with zero writes.
6. **The same idempotency key produces no second entry and no second audit
   record**, against a real Firestore under contention.
7. **The archived weekly pattern is a SUGGESTION only** — §10.5.
8. **The sheet states explicitly that app access is still revoked** and that
   restoring it is a separate operation.
9. **`comp`, `restoreAppAccess` and `restoreServices` are removed** from the
   declared request keys.
10. **`cycleStatus` is deleted only once every tenant can COMPLETE a rehire** — a
    canonical rota log and a pay model they can open — not merely once every call
    site points at the new door. See §10.8 (b): on a tenant with neither, the new
    flow refuses every rehire, and deleting the browser write there leaves the
    salon unable to reactivate anybody.
11. **Every refusal writes nothing**, including the ones decided inside the
    transaction, proven against a real Firestore.
12. **The archived history is byte-identical after the rehire** — every entry
    committed before it, unchanged.
13. **`SETTLED` is decided from the three authorities' STATE**, never from the rota
    engine's replay flag (§10.8 (c)).
14. **The fingerprint covers the whole `history` array**, not the trailing period
    alone — overlapping periods are union-read, so an earlier edit can change the
    answer for `returnOn`.

## 10.5 The UI

The Former staff row's **"✓ Activate"** becomes the rehire sheet:

* **`returnOn`** — fixed to the tenant's today, read-only, with the reason stated.
* **The compensation period** — displayed **read-only**, exactly as it will be
  priced, with its `effectiveFrom` beside `returnOn` so a mismatch is visible
  rather than inferred. If no period satisfies the four conditions, the sheet does
  not offer a submit at all: it says which condition failed and sends the owner to
  the Pay tab. The operator never discovers this as a server refusal.
* **The weekly pattern** — the archived pre-departure week is a **starting
  suggestion and nothing more**. It is shown as such, labelled with the period it
  came from, and the owner must **confirm or edit** it before the sheet will
  submit.

  > Silently restoring the old shift is the risk this rule exists for: somebody
  > returning after a year is not returning to the rota they left, and a schedule
  > that reappears without anyone agreeing to it is a schedule nobody owns.

  It is read from the **canonical log**, never from `barbers.workingDays`, which
  is a cache and may have been republished since.
* **App access** — the sheet says plainly that the account is **still revoked** and
  that restoring it is a separate operation (§10.2 ④).
* The consequence rows, the confirm phrase, and the same single-flight and
  ambiguity rules the other two sheets use.

## 10.6 The payoff

Once every activation call site is on the new flow, `cycleStatus` has no caller
and is deleted. The Team Members page then performs **no lifecycle status write at
all** — leave, return, departure and rehire all go through
`salownStaffLifecycle`, and `barbers.status` ends with exactly **one writer**.

## 10.7 What this fixes, stated plainly

Today, activating a departed member writes only `status`/`active`. The terminal
rota period stays in force, so every dated reader keeps answering `works: false`
— verified on Whitecross/Arda out to 2027-01-04 — while `barbers.workingDays` was
never cleared, so legacy availability offers them again. The member is **bookable,
scheduled for zero days and accruing nothing**: the mirror image of the drift this
document describes. `STAFF-REHIRE` closes it, and §10.2 ① is what stops the fix
from reintroducing it in a new place.

## 10.8 Two consequences that must be settled BEFORE implementation

Both were found by walking the design against production rather than against
itself, and neither is a detail.

### (a) Six of seven tenants cannot reach `REHIRE` at all

`NO_TERMINAL_PERIOD` and `REHIRE_COMP_PERIOD_REQUIRED` are both fail-closed, and
on 2026-08-30 the platform holds **one** tenant with any `staffComp` document and
**one** with any canonical rota log — whitecross, both times. Every other tenant
would find `REHIRE` structurally unusable: no terminal period to close, and no pay
period to validate.

That is the **correct** answer on its own terms — the whole point of §10.2 ① is
not to make somebody bookable that Finance would pay nothing for — but it must be
a decision, not a discovery. The sheet must say **which** condition failed and
what to do about it, and "adopt the pay model" is the honest answer for a tenant
that has never opened one.

### (b) …which makes acceptance criterion 10 a trap as written

Criterion 10 says `cycleStatus` may be deleted once every activation **call site**
has moved. That is not sufficient, and the gap is dangerous: on a tenant with no
rota log and no `staffComp`, every call site can be migrated and the new flow
still refuses **every** rehire. Deleting the browser write at that point leaves
those salons **unable to reactivate anybody at all**.

The precondition is therefore stronger and must be stated as such:

> `cycleStatus` may be deleted only once every tenant that can hold a passive
> member can actually **complete** a rehire — a canonical rota log and a pay model
> they can open — not merely once the call sites point at the new door.

Until then the two coexist, and the honest intermediate state is: the new flow is
the door, and the old write remains reachable **only** where the new one provably
cannot answer. That is a migration, and it needs its own measurement — the same
`scripts/analyseCompPeriods.cjs`-shaped read-only inventory that gated
`FIN-COMP-S3C`, asking "which tenants could complete a rehire today".

### (c) Two smaller edges, recorded so they are not rediscovered

* **Midnight.** `returnOn` must equal the tenant's today AND the comp period's
  `effectiveFrom`. A period opened at 23:55 and a rehire submitted at 00:05 is a
  legitimate refusal, but a confusing one. The sheet must re-resolve the tenant
  day at submit time and say plainly that the day moved, rather than reporting a
  mismatch the operator cannot see the cause of.
* **`SETTLED` is decided from STATE, never from the rota replay flag.** The
  `changeId` is derived from the idempotency key and the comp fingerprint is not
  part of it, so a retry under the same key after the comp period changed would
  find the rota replaying while the comp condition no longer holds. The settled
  answer must be read from the three authorities, exactly as `OFFBOARD`'s is.

## 10.9 Deliberately still out of scope

* **Location transfer** (`LOCATION_LEAVE`) — declared, unimplemented, untouched.
* **Correcting a mistaken departure** — `ROTA_SUPERSEDE` plus an owner decision on
  the compensation period. A different operation, and it needs its own review.
* **Scheduled returns** — blocked on `ROTA_FUTURE_ACTIVATION_ENABLED`, §10.2 ②.
* **Restoring app access** — the S4A saga, §10.2 ④.
