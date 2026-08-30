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

### ① The pay model — REHIRE writes it, ATOMICALLY, from a model the owner confirms

> **This answer was wrong twice, and the second version was wrong in a way that
> matters more than the first.** The history is kept because the two mistakes are
> the same mistake at different depths.
>
> **v1** — write no compensation period and merely *warn* that none is open. That
> left a reachable `active` + bookable + live weekly rota + **no valid `staffComp`
> period`: working and not accruing. A warning is not an authority.
>
> **v2** — write none, but **require** one the owner prepared first. That closed
> v1's hole and opened a worse one. Preparing the period is itself a write to the
> employment authority, performed **outside** the transaction, so between step 1
> and step 4 production holds:
>
> ```
> staffComp : employment has RESUMED (2026-08-30 →, open)
> barbers   : still passive
> staffRota : still the terminal archive
> ```
>
> If the owner closes the sheet, or the rehire is refused for any of the reasons
> §10.3 lists, **that drift is permanent** — and it is drift in the one authority
> this document had just finished arguing is the record of when employment
> resumed. v2 fixed a hole by digging a deeper one three lines away.

**v3, and it is smaller than both.** `REHIRE` writes the compensation period
**inside the same transaction** as the rota period and the status. The owner
selects and confirms the pay model **in the sheet**; nothing is written anywhere
until all three commit together.

**This does not make the operation a third writer of `staffComp`.** It reuses the
canonical domain helper — `compUtils.appendPeriod` — exactly as the rota half
reuses `appendRotaChange` rather than composing entries by hand. It is the
**second orchestration consumer of the same canonical write primitive**, which is
the identical relationship the departure already has with the rota engine. A
second *caller* of one rule is not a second *rule*.

**The invariant becomes unrepresentable rather than validated.** The request
carries the pay **model** only; the server composes the period:

```
effectiveFrom = returnOn        // server-derived — `effectiveFrom` is a FORBIDDEN key
effectiveTo   = null
type, params  = the model the owner confirmed in the sheet
```

So `effectiveFrom === returnOn` stops being a condition that could fail and
becomes a shape that cannot be built any other way. That is strictly better than
checking it: a check can be forgotten at a second call site, a construction
cannot.

**What the transaction still verifies**, because `appendPeriod` is append-only and
must land on the history it was composed against:

* the history reads as periods (`COMP_HISTORY_INVALID`);
* the trailing period is **CLOSED**, and closed strictly before `returnOn`. An
  open trailing period on a departed member means the departure never closed the
  wage boundary, or somebody opened one by hand — either way `appendPeriod` would
  silently *auto-close* it at `returnOn − 1`, editing a period nobody asked to
  edit. **`REHIRE_COMP_PERIOD_OPEN`**, zero writes;
* the document has not moved since the sheet read it — the precondition triple
  below, now guarding *the history the append will be applied to* rather than a
  period the owner prepared;
* `appendPeriod` itself does not throw (**`REHIRE_COMP_APPEND_REFUSED`**).

**The rejected alternative — a draft compensation record.** The owner prepares a
non-effective draft and the transaction promotes it. It is safe, but the model has
no draft concept anywhere today, so it means a new document state, a new lifecycle
for it, and a new way for a draft to be orphaned. It buys nothing v3 does not
already have. Recorded as considered and declined.

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
  "comp": { "type": "wage", "params": { … } },   // the MODEL only — the server
                                                 // composes effectiveFrom = returnOn
                                                 // and effectiveTo = null
  "expectedCompFingerprint": "sha256…",  // canonical fold of the WHOLE history
  "expectedCompUpdateTime": {            // Firestore's own physical precondition,
    "seconds": 1788049840,               //   carried as {seconds,nanoseconds} —
    "nanoseconds": 954000000             //   never round-tripped through an ISO
  }                                      //   string (CAM-5: toDate() rounds)
}
```

`restoreAppAccess` and `restoreServices` are **removed** from
`LIFECYCLE_REQUEST_KEYS.REHIRE`. **`comp` stays** — it is the pay model the owner
confirmed, and §10.2 ① is why. `effectiveFrom` / `effectiveTo` remain FORBIDDEN
keys: the caller states the model, never the dates.

**Authority:** owner or super-admin — the same gate as `OFFBOARD`. One lifecycle
boundary, one role list.

**Writes (all or nothing):**

```
barbers/{id}                     status: 'active', active: true, updatedAt   (set, merge)
staffRota/{id}/rotaEntries/{e1}  ROTA_CLOSE  → effectiveTo = returnOn − 1     (create)
staffRota/{id}/rotaEntries/{e2}  ROTA_OPEN   → effectiveFrom = returnOn, the confirmed week
staffRota/{id}                   revision, entriesHash, entryCount, lastChangeId, lastOrigin
barbers/{id}                     workingDays / dayHours / hours — by the ENGINE's convergence
staffComp/{id}                   history[] + the new OPEN period, via appendPeriod (set, merge)
auditLogs/stafflifecycle_rehire_…  the lifecycle record                      (create)
auditLogs/rota_append_…            the engine's own append record
```

`staffComp` **is** in that list, and that is the point: it commits with the other
two or not at all. What is NOT in the list is any date the caller chose.

**Refusals** — each costs zero writes:

| Code | When |
|---|---|
| **`REHIRE_COMP_MODEL_REQUIRED`** | no `comp` model in the payload. The sheet must not submit without one |
| **`REHIRE_COMP_PERIOD_OPEN`** | the trailing `staffComp` period is not closed, or not closed strictly before `returnOn`. `appendPeriod` would silently auto-close it at `returnOn − 1`, editing a period nobody asked to edit |
| **`REHIRE_COMP_APPEND_REFUSED`** | `appendPeriod` threw — the append would overlap a closed period |
| **`REHIRE_COMP_DOCUMENT_MOVED`** | the compensation document changed between the sheet reading it and the transaction — `updateTime` or the full-history fingerprint moved. A separate code from the one above on purpose: it means *re-open the sheet*, not *your period is wrong* |
| **`REHIRE_NOT_READY`** | this subject cannot be rehired at all yet — see the readiness verdict (§10.8 b2). Never falls back to a status-only write |
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
5. **The compensation period is composed by the SERVER and written in the SAME
   transaction** — `effectiveFrom = returnOn` by construction, never by a caller
   and never by a check. The trailing existing period must be **closed strictly
   before `returnOn`** (`REHIRE_COMP_PERIOD_OPEN`), `appendPeriod` must not throw
   (`REHIRE_COMP_APPEND_REFUSED`), and the document must not have moved since the
   sheet read it (`REHIRE_COMP_DOCUMENT_MOVED`). **No compensation write happens
   outside this transaction, at any point in the flow.**
6. **The same idempotency key produces no second entry and no second audit
   record**, against a real Firestore under contention.
7. **The archived weekly pattern is a SUGGESTION only** — §10.5.
8. **The sheet states explicitly that app access is still revoked** and that
   restoring it is a separate operation.
9. **`comp`, `restoreAppAccess` and `restoreServices` are removed** from the
   declared request keys.
10. **`cycleStatus` is unreachable from every UI call site in the ROLLOUT commit
    itself** — not later, and not per tenant. The legacy status-only write is not
    a fallback for anybody (§10.8). Physically deleting the function may follow;
    remaining **callable** may not.
11. **Every refusal writes nothing**, including the ones decided inside the
    transaction, proven against a real Firestore.
12. **The archived history is byte-identical after the rehire** — every entry
    committed before it, unchanged.
13. **`SETTLED` is decided from the three authorities' STATE**, never from the rota
    engine's replay flag (§10.8 (c)).
14. **The fingerprint covers the whole `history` array**, not the trailing period
    alone — overlapping periods are union-read, so an earlier edit can change the
    answer for `returnOn`.
15. **All three preconditions are enforced**, and a physical move is reported as
    `REHIRE_COMP_DOCUMENT_MOVED` rather than as a wrong period.
16. **The readiness inventory produces a verdict PER PASSIVE PERSON**, from the
    seven-value vocabulary, and the script prints categories and counts only.
17. **No surface can perform a status-only activation**, on any tenant, at any
    point during the rollout — asserted the way the departure's absence is
    asserted: a brace-matched sweep of every write on the page.

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

## 10.8 The rollout rule, and the consequences behind it

> **Legacy status-only activation is a fallback for NOBODY.** If the new `REHIRE`
> flow cannot be used, the operation is **fail-closed** and the surface shows the
> readiness verdict and what the tenant must do. `cycleStatus` is removed from
> every UI call site **during the rollout**, not after tenant readiness — the old
> broken writer is never kept reachable while salons are made ready.

The two findings that produced that rule, both from walking the design against
production rather than against itself.

Both were found by walking the design against production rather than against
itself, and neither is a detail.

### (a) Six of seven tenants cannot reach `REHIRE` at all

`NO_TERMINAL_PERIOD` and the comp-history refusals are fail-closed, and on
2026-08-30 the platform holds **one** tenant with any `staffComp` document and
**one** with any canonical rota log — whitecross, both times. Every other tenant
would find `REHIRE` structurally unusable: no terminal period to close, and no
readable compensation history to append to.

**Measured, not assumed:** the read-only inventory (§10.10) reports **one** passive
person platform-wide, on whitecross, and **zero** on the other six tenants. The
unready-tenant case is therefore real in contract and **empty in production
today** — which is why the rollout rule below costs nothing to apply.

That is the **correct** answer on its own terms — the whole point of §10.2 ① is
not to make somebody bookable that Finance would pay nothing for — but it must be
a decision, not a discovery. The sheet must say **which** condition failed and
what to do about it, and "adopt the pay model" is the honest answer for a tenant
that has never opened one.

### (b) The legacy activation writer is NOT the answer for them

The obvious reading of (a) — *keep `cycleStatus` until every tenant is ready* —
is wrong, and it is wrong in the direction that matters. That writer moves
`status`/`active` and **nothing else**: on an unready tenant the operator would
appear to rehire somebody while the compensation period and the rota drift
exactly as before. The feature looking available and quietly producing broken
data is worse than the feature being unavailable.

> **A feature that is temporarily unusable is safer than one that silently writes
> a wrong record.**

So the transition has three states and the third one is empty:

| tenant | activation path |
|---|---|
| **rehire-ready** | the new atomic sheet + callable. Legacy path **closed** |
| **not rehire-ready** | legacy path **also closed**. The sheet says *"rehire setup required"*, shows the read-only readiness result, and offers the super-admin migration/support route |
| **any tenant** | may **not** use the status-only activation writer |

**Therefore `cycleStatus` is removed from every UI call site in the rollout commit
itself**, before any tenant is ready. Deleting the function body can follow as
housekeeping; what may not survive the rollout is its **reachability**. An unready
tenant gets a refusal that explains itself and a route to readiness — never a
button that writes one third of an employment.

### (b2) Readiness is TWO questions, and conflating them gives a wrong answer

The first run of the inventory reported Arda **READY** — and a rehire submitted
that moment would have been **refused**, because under the then-current contract
he had no pre-created compensation period. The verdict was not wrong about the
data; it was answering a different question from the one it appeared to answer.

| | what it asks | who can fix it |
|---|---|---|
| **`INFRA_READY`** | is the STRUCTURE in place — a canonical rota that folds, a terminal offboard period, a readable compensation history? | a migration. Nothing an operator can supply at rehire time |
| **`AWAITING_OPERATOR_INPUT`** | the stored data raises no objection, but the two inputs that decide the operation — the weekly pattern and the pay model, with its commercial values — **have not been chosen yet** | the owner, in the sheet |
| **`APPLY_READY`** | a server dry-run has validated **those exact inputs**. Only the server may say this | — |

`APPLY_BLOCKED_INFRA` · `REHIRE_COMP_PERIOD_OPEN` ·
`RETURN_ON_NOT_AFTER_DEPARTURE` · `APPLY_MULTIPLE_BLOCKERS` are the apply-axis
blockers.

> **The inventory may never emit `APPLY_READY`.** Its ceiling is
> `AWAITING_OPERATOR_INPUT`, and that ceiling is the point. Nothing it can read
> tells it which week the owner will confirm or which pay model they will choose,
> so a green verdict from it would be a promise about inputs that do not exist —
> and the first thing it would produce is the drift *"the inventory said green,
> why was the apply refused?"*. `APPLY_READY` is produced by **one** thing: a
> server dry-run over the real submitted inputs.

**And its verdicts are contract-version dependent**: the same person was `READY`
under v2, then `APPLY_READY` under a v3 reading that overclaimed, and is
`AWAITING_OPERATOR_INPUT` under the corrected one — for identical data. Every
report names the contract it evaluated.

### (b3) Readiness is a property of a PERSON, not a tenant

"Does this tenant have any `staffComp` / any rota log" is the wrong question and
would give the wrong answer: within one salon, Alex can be rehire-ready while
another former staff member is not. The inventory must therefore produce a
verdict **per passive person**, from this vocabulary:

| verdict | meaning |
|---|---|
| `READY` | a rehire would be accepted today |
| `NO_STAFF_COMP` | no compensation document at all |
| `NO_CANONICAL_ROTA` | no canonical rota log for this subject |
| `NO_TERMINAL_OFFBOARD_PERIOD` | a log exists but holds no terminal archive — they were made passive the old way |
| `COMP_HISTORY_INVALID` | the history cannot be read as periods (malformed, overlapping, gapped) |
| `ROTA_HISTORY_INVALID` | the log does not fold |
| `MULTIPLE_BLOCKERS` | more than one of the above |

Two surfaces, two disclosure rules, and they are not the same: the **inventory
script** prints counts and category names only — the `analyseCompPeriods.cjs`
discipline, no names, no dates, no amounts — while the **sheet** shows one
authorized owner their own member's single verdict. A script that printed the
payroll to a console would be the wrong tool for making the payroll safe.

### (c) Two smaller edges, recorded so they are not rediscovered

* **Timezone is reported as a RESOLVED value with a PROVENANCE, never as a raw
  field.** An absent `presentation.timezone` is not an unknown: it is the
  authoritative platform default
  (`PLATFORM_PRESENTATION_DEFAULTS.timezone === 'Europe/London'`). Printing
  `UNRESOLVED` — as the first run of the inventory did for whitecross — reads as a
  failed measurement when the measurement was correct. The line is
  `timezone: Europe/London (provenance: platform default | settings/settings |
  tenant root)`.
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

## 10.9 The inventory, run 2026-08-30

Read-only, zero writes, no callable invoked, no payroll / pattern / name / contact
printed. Per person: the stable barber id and the two verdicts.

```
asOf(UTC)  : 2026-08-30T11:02:05.519Z
contract   : REHIRE v3
scope      : passive team members only

whitecross    tenantDate 2026-08-30 · timezone Europe/London (provenance: platform default)
              passive 1 · INFRA_READY 1 · AWAITING_OPERATOR_INPUT 1
              · barber-1777655430086  infra=INFRA_READY  apply=AWAITING_OPERATOR_INPUT

dayi-barbers · demo · herohairs · the-hair-lab · tr-demo · yusufo
              passive 0

PLATFORM TOTAL   INFRA_READY 1 · every other infra verdict 0
                 AWAITING_OPERATOR_INPUT 1 · every other apply verdict 0
                 APPLY_READY — never emitted by this tool, by construction
```

**What it settles.** There is exactly **one** passive person on the platform, the
infrastructure axis is green for them, and the apply axis raises no *data*
objection — it is waiting on the owner's two choices, which is the furthest an
inventory can honestly go. `NO_STAFF_COMP`, `NO_CANONICAL_ROTA`,
`NO_TERMINAL_OFFBOARD_PERIOD`, `COMP_HISTORY_INVALID` and `ROTA_HISTORY_INVALID`
are real contract states with **zero** occurrences today — design guarantees for
tenants that do not exist yet, not a migration backlog. The unready-tenant case
of §10.8 (b) is therefore **empty in production**, which is why the rollout rule
costs nothing to apply now and would cost a great deal to apply later.

**What it does not settle.** It is a snapshot, and the six tenants with no passive
member will acquire one the moment somebody is offboarded — through the new flow,
so their terminal periods are born correct. The inventory must be re-run
immediately before the rollout rather than trusted from this reading.

## 10.10 Deliberately still out of scope

* **Location transfer** (`LOCATION_LEAVE`) — declared, unimplemented, untouched.
* **Correcting a mistaken departure** — `ROTA_SUPERSEDE` plus an owner decision on
  the compensation period. A different operation, and it needs its own review.
* **Scheduled returns** — blocked on `ROTA_FUTURE_ACTIVATION_ENABLED`, §10.2 ②.
* **Restoring app access** — the S4A saga, §10.2 ④.
