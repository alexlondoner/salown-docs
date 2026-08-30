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

**Status:** model DECIDED 2026-08-30, implementation not started (`STAFF-REHIRE`,
`PLANNED`). Nothing below is built. It is written down now because the four open
questions all have answers that fall out of facts already established, and an
undecided model is how the departure ended up with three doors in the first place.

## 10.1 What a rehire is, and the one thing it is not

A rehire is a **new employment period** for somebody whose previous one is closed.
It appends; it never edits. The archived rota entries, the closed compensation
period and every past booking stay exactly as they are — the same rule the
departure follows, from the other end.

It is **not** the correction of a mistaken departure. Those are different
operations wearing one word, and conflating them is how an append-only log stops
being one:

| | rehire | correction |
|---|---|---|
| the departure | really happened | should never have been recorded |
| the gap | real, and accrues nothing | does not exist |
| the log | append a new period | withdraw the departure (`ROTA_SUPERSEDE` on its `changeId`) |
| the pay period | a NEW one, opened by the owner | the closed one is amended |

`compUtils.appendPeriod` already enforces the distinction and will not be argued
with: it **throws** when a new period would overlap a closed one. So a same-day
"undo" cannot be expressed as a rehire, and must not be given a code path that
pretends it can. **`REHIRE` refuses rather than amending.**

## 10.2 The four questions, answered

### ① What "reopen the pay period" means — it does NOT open one

`REHIRE` writes **no compensation period at all**, and `comp` leaves the declared
key allowlist.

The asymmetry with `OFFBOARD` is deliberate and it has a reason. A departure has
an unambiguous date to close a period ON — the last working day. A rehire has no
unambiguous **amount** to open one WITH, and inventing one (copying the old rate,
say) writes a commercial decision nobody made into the document Finance prices
from. The correct behaviour when no pay model is open is already defined and
already safe: `compPeriodVerdict` answers `'outside'`, nothing accrues, and
Finance is right to accrue nothing.

So the operation returns a **warning** — the same shape `OFFBOARD` returns when
there was no period to close — and the owner sets the pay model in the one place
that owns it, exactly as a brand-new member does (design §4: a new member lands
on the Pay tab). This keeps every `staffComp` write in the Pay tab and the
departure, and adds no third writer.

### ② Backdated? No. Future-dated? Also no. `returnOn` is TODAY.

Both halves are refusals, and they are refused for **opposite** reasons — which is
why neither gets the exemption the other might suggest.

- **The past** is refused because `ROTA_CHANGE` refuses it outright, and that rule
  is the one the 2026-08-12 wage incident bought. `ROTA_OFFBOARD` was given a
  narrow, argued exception because a departure is the one period edit with a
  legitimate past — somebody left three weeks ago and the log was never told. A
  rehire has no such story: the person is standing in the salon. **No exception is
  argued, so none is taken.**
- **The future** is refused because publishing a future period is a job somebody
  must do on the effective date, and nothing runs (`ROTA_FUTURE_ACTIVATION_ENABLED
  = false`). `ROTA_OFFBOARD` was exempted from that gate on the argument that
  `passive` is an undated absolute stop, so the legacy cache did not matter. **For
  a rehire the opposite is true**: the member becomes bookable, and the legacy
  cache is precisely what the availability surfaces read. A future rehire would
  need the cache published on the return date — which is the job that does not
  exist. So the exemption is not merely unavailable here, it would be wrong.

One rule, no exceptions: **`returnOn` must equal the tenant's today.** When
`ROTA_FUTURE_ACTIVATION_ENABLED` becomes true, this is the first thing that may
be revisited — and until then a salon that knows somebody returns next Monday
performs the rehire on Monday.

### ③ One transaction, through the same seam

Yes. `appendRotaChange` with an ordinary **`ROTA_CHANGE`** — no new engine action
is needed, because the rota half already works: A3a in
`functions/src/staff/rotaArchive.test.js` proves that a `ROTA_CHANGE` on the
return date closes the terminal archive and opens a new weekly period with every
archived entry preserved byte for byte.

The status write rides in `attachExtraWrite`, and the reads in `attachExtraRead`,
exactly as the departure does. That seam gets its **second consumer**, which is
the argument for having added it rather than special-casing the departure.

**The legacy cache republishes itself, and this is the mechanism that makes the
whole thing work.** `rotaLegacyWriteGate` gives opposite answers to the two
operations, and both are correct:

| | new period | convergence reason | gate |
|---|---|---|---|
| `OFFBOARD` | `by_exception` / `[]` | `BY_EXCEPTION_LEGACY_UNSAFE` | **BLOCK** — an empty `workingDays` would flip `hasWeeklyPattern` and drop every accrual to the booking fallback |
| `REHIRE` | `weekly` / real days | `PATTERN_CHANGED` | **ALLOW** — the engine republishes `workingDays` / `dayHours` / `hours`, which is exactly what a returning member needs |

So the rehire does not write the legacy cache itself and must not: the engine
writes it, from the canonical period, as a projection.

### ④ App access — excluded, for the reason `OFFBOARD` excluded it

`restoreAppAccess` and `restoreServices` leave the declared key allowlist.
`staff/{uid}.accessStatus` belongs to the S4A offboarding state machine, which is
**resumable precisely because Auth + Firestore + FCM cannot be made atomic**.
Folding it into this transaction would make the transaction unable to keep the one
promise its whole design is. Restoring an account stays a separate, resumable
operation.

## 10.3 The resulting contract

```jsonc
{
  "op": "REHIRE",
  "barberId": "barber-…",
  "idempotencyKey": "slv-rhr-…",
  "returnOn": "2026-09-01",      // MUST equal the tenant's today
  "pattern": { "scheduleMode": "weekly", "workingDays": ["Tuesday", "Thursday"], … }
}
```

`comp`, `restoreAppAccess`, `restoreServices` are **removed** from
`LIFECYCLE_REQUEST_KEYS.REHIRE`. Everything else stays server-derived and refused
by name.

**Authority:** owner or super-admin — the same gate as `OFFBOARD`. It writes no
`staffComp`, so a narrower argument for admin could be made; it is not made,
because a rehire changes employment state and re-enables bookability, and one
lifecycle boundary with one role list is worth more than a marginal permission.

**Writes (all or nothing):**

```
barbers/{id}                     status: 'active', active: true, updatedAt   (set, merge)
staffRota/{id}/rotaEntries/{e1}  ROTA_CLOSE  → effectiveTo = returnOn − 1     (create)
staffRota/{id}/rotaEntries/{e2}  ROTA_OPEN   → effectiveFrom = returnOn, the new week
staffRota/{id}                   revision, entriesHash, entryCount, lastChangeId, lastOrigin
barbers/{id}                     workingDays / dayHours / hours — by the ENGINE's convergence
auditLogs/stafflifecycle_rehire_…  the lifecycle record                      (create)
auditLogs/rota_append_…            the engine's own append record
```

**Refusals** (each costs zero writes):

| Code | When |
|---|---|
| `SUBJECT_NOT_PASSIVE` | only a departed member can be rehired |
| `NO_TERMINAL_PERIOD` | the rota holds no terminal archive to close — they were never properly offboarded, so the answer is `OFFBOARD` first, or this is a correction |
| `RETURN_ON_NOT_TODAY` | `returnOn` is not the tenant's today (both directions, §10.2 ②) |
| `PATTERN_REQUIRED` | no weekly pattern supplied; its CONTENT is judged by the fold, not here |
| `PERMISSION_DENIED` / `ACTOR_OFFBOARDED` / `IDEMPOTENCY_CONFLICT` / `ROTA_REFUSED` / `PARTIAL_STATE` | as `OFFBOARD` |

**`SETTLED`** when the member is already `active` with a live weekly period —
zero writes, however many times it is asked, under any key.

**Warning on success:** `no compensation period is open for this member; set their
pay model on the Pay tab` — always, because §10.2 ① means it is always true.

## 10.4 The UI, and the payoff

The Former staff row's **"✓ Activate"** becomes the rehire sheet: `returnOn` fixed
to today and read-only, a weekly pattern seeded from the **archived pre-departure
week** (read from the log, not from `barbers.workingDays`, which is a cache), the
consequence rows, and the confirm phrase.

`cycleStatus` then has no caller and is **deleted**. That is the payoff worth
naming: after `STAFF-REHIRE`, the Team Members page performs **no lifecycle status
write at all** — every transition (leave, return, departure, rehire) goes through
`salownStaffLifecycle`, and `barbers.status` has exactly one writer.

## 10.5 What this fixes, stated plainly

Today, activating a departed member writes only `status`/`active`. The terminal
rota period stays in force, so every dated reader keeps answering `works: false`
— verified on Whitecross/Arda out to 2027-01-04 — while `barbers.workingDays` was
never cleared, so legacy availability offers them again. The member is **bookable,
scheduled for zero days and accruing nothing**: the mirror image of the drift this
document exists to describe. `STAFF-REHIRE` is what closes it.

## 10.6 Deliberately still out of scope

- **Location transfer** (`LOCATION_LEAVE`) — declared, unimplemented, untouched.
- **Correcting a mistaken departure** — `ROTA_SUPERSEDE` plus an owner decision on
  the compensation period. A different operation, and it needs its own review.
- **Scheduled returns** — blocked on `ROTA_FUTURE_ACTIVATION_ENABLED`, §10.2 ②.
