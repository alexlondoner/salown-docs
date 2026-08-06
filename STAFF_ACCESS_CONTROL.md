# STAFF_ACCESS_CONTROL.md — Staff **access** authority and revocation

> **Status: S4A source + tests COMPLETE, PUSHED, NOT LIVE.** Nothing here is deployed. The
> offboarding/re-enable cores exist and are tested but are **deliberately not exposed** —
> there is no callable, no Admin UI and no Staff UI yet (that is S4B).
> Status badge of record: [ROADMAP.md](ROADMAP.md) › Employment Model.

---

## 1. The problem this exists to fix

Before S4A, salOWN had exactly one lever that looked like "turn this person off":
`barbers/{id}.status` = `active | passive | leave`.

That field is a **service-provider assignability** axis — it answers *"can a booking be
assigned TO this person?"*. It was never an **access** axis, and treating it as one breaks
the business in a specific, expensive way:

> An owner or admin who stops taking clients becomes a `passive` **barber**. They still run
> the salon. If passive were wired to Staff App access, the person who owns the business
> would be locked out of the business the day they stopped cutting hair.

And the converse hole: a barber who *left* could keep a working Staff account, because
nothing about `barbers.status` touches their login, their claims or their push tokens.

So there are two independent axes, and they must stay independent:

| Axis | Field | Answers | Values |
|---|---|---|---|
| **Assignability** (service provider) | `barbers/{id}.status` | Can a booking be assigned *to* them? | `active` · `passive` · `leave` |
| **Access** (account) | `staff/{uid}.accessStatus` | May this account *operate the app*? | `active` · `suspended` · `offboarded` |

**`leave` never means suspended or offboarded.** Leave is availability on the barber
record; a staffer on leave keeps their account and can still use the app.

---

## 2. The canonical field

`tenants/{tenantId}/staff/{uid}.accessStatus`

| Value | Meaning |
|---|---|
| `active` | Normal. May operate the app, subject to the usual role checks. |
| `suspended` | Temporarily denied (dispute, investigation, unpaid handover). |
| `offboarded` | Permanently denied (left the business). |

**Absent means `active`.** Every staff document written before S4A lacks the field;
without this rule, shipping it would lock out every existing user of every tenant. A
stored `null` counts as absent (a cleared field is not a value).

**A present but unrecognised value fails CLOSED.** `'ACTIVE'`, `'Active'`, `''`,
`'left'`, `'passive'`, `'leave'`, `42`, `{}` — none of these are guessed at, and none are
read as active. They resolve to `unknown` and are **denied**. Only server code writes this
field, so an unrecognised value means corruption or hand-editing, and the safe reading of
*"somebody wrote something we do not understand into the access field"* is deny.
*Recovery from a bad hand-edit: set the field to a canonical value, delete it (absent =
active), or run the restore core. The lock-out is recoverable; an unnoticed permit is not.*

### One client-facing reason code

Every denial — suspended, offboarded, corrupt — returns the single stable code
**`ACTOR_OFFBOARDED`**, mapped to HTTPS `permission-denied`. The caller is never told
*which* administrative state they are in, or that the distinction exists. The **precise**
state is carried in the audit record, which owners read and the denied actor does not.

**Source:** `functions/src/staff/accessStatus.ts` (pure, synchronous, no I/O, never throws).

---

## 3. Where the gate is enforced

The check runs **inside the existing transaction**, on the staff snapshot the core
**already reads for the role** — no additional Firestore read is introduced anywhere.

| Core | File | Actor read |
|---|---|---|
| `createWalkInCore` | `bookings/createWalkIn.ts` | in-tx `staff/{uid}` |
| `reassignBookingCore` | `bookings/reassignBooking.ts` | in-tx `staff/{uid}` |
| `createBookingCore` **privileged/Admin branch only** | `bookings/createBooking.ts` | in-tx `staff/{actorUid}` |
| `createBlockCore` | `bookings/blocks.ts` (`roleFromSnap`) | in-tx `staff/{uid}` |
| `deleteBlockCore` | `bookings/blocks.ts` (`roleFromSnap`) | in-tx `staff/{uid}` |

The **public** booking path has no actor and is untouched — a revoked staff document in a
tenant must never break customer self-booking. That is asserted by a test.

> ⚠️ **This is server-side only.** It is not in `firestore.rules`. Any surface still doing
> a direct client-side Firestore write bypasses it — which is exactly why O1S (Staff app
> direct writes) matters, and why S4A is not a completed enforcement story on its own.

---

## 4. Revocation cannot be atomic — and does not claim to be

Revoking access touches three systems:

1. **Firestore** — `staff/{uid}.accessStatus`, the FCM token documents, the audit record
2. **Firebase Auth** — custom claims (`tenantId`/`tenantRole`) and refresh-token revocation
3. **FCM** — reached through its Firestore token registry, but a separate concern

**Firebase Auth, Firestore and FCM cleanup cannot share one transaction.** A Firestore
transaction covers Firestore documents only; `setCustomUserClaims` and
`revokeRefreshTokens` are Admin-Auth RPCs with no transactional participation and no
rollback, taking effect the moment they return. Any claim of cross-service atomicity here
would be false.

So it is modelled as a **resumable, idempotent state machine**:

```
TX-1 (atomic)   authorize · flip accessStatus · open the op record at stage PENDING
── effects ──   clear tenant claims → revoke refresh tokens → delete FCM token docs
TX-2 (atomic)   flip the op record to DONE · emit the audit event
```

### Why that order is the safe one

The Firestore state that **denies** access commits **first**, before any Auth work. A
crash anywhere after TX-1 therefore leaves the actor **already locked out of every server
core** (they resolve `offboarded` from their staff document), with the remaining cleanup
pending and visibly so.

> The failure mode is **"more revoked than recorded"** — never *"recorded as revoked but
> still able to act"*.

### Resumption

An interrupted operation is recorded in two places: the op document
(`tenants/{tid}/staffAccessOps/{opId}`, stage `PENDING`) and a pointer on the staff
document (`accessRevocation.opId` + `.stage`). A retry converges either way:

- **same idempotency key** → the derived op id is the same document; the machine resumes
  and completes it;
- **different idempotency key** → TX-1 sees the staff document still pointing at an OPEN
  op and **adopts** it; the new key's document is written as an alias (`aliasOf`). The
  operative op — and therefore the derived audit id — is unchanged.

### Audit exactly-once

The audit record is written **inside TX-2 at a derived document id**
(`staffaccess_<operativeOpId>`), not appended with an auto id. Exactly-once therefore does
not depend on the process surviving: the stage guard stops a second write, and a torn
retry would overwrite the same document rather than create a second one.

This is why these two cores do **not** use the fire-and-forget `logAuditServer` sink the
booking cores use — for a security event an at-most-once best-effort log is not good
enough, and a duplicate is as wrong as a miss.

> **Naming trap, found by a test:** the audit redactor masks any key whose normalised name
> contains `refreshtoken`. The meta field is therefore `sessionsRevoked`, **not**
> `refreshTokensRevoked` — the latter would be stored as `***` and the record would
> silently lose the fact it exists to prove. A test asserts no meta field is redacted.

---

## 5. Authorization matrix (both cores)

| Condition | Result |
|---|---|
| no `request.auth` | `UNAUTHENTICATED` |
| no `tenantId` claim | `PERMISSION_DENIED` |
| actor has no staff doc, not super-admin | `PERMISSION_DENIED` |
| actor role ∉ {owner, admin}, not super-admin | `PERMISSION_DENIED` |
| actor's own access suspended/offboarded/corrupt | `ACTOR_OFFBOARDED` |
| target uid missing/malformed, or any forbidden field | `INVALID_INPUT` |
| target not in this tenant | `TARGET_NOT_FOUND` |
| target == actor | `SELF_OFFBOARD_FORBIDDEN` |
| target is the last owner who can still act | `LAST_OWNER_FORBIDDEN` |
| restore: target role unrecognised | `TARGET_ROLE_UNRECOGNIZED` |
| same key, different request | `IDEMPOTENCY_CONFLICT` |

**tenantId and actor uid come from the VERIFIED auth token/session only, never the
payload.** The role is re-read server-side inside TX-1.

**The target is a `uid`, never an email.** `targetEmail` is a forbidden field that fails
the allowlist. Resolving a person from an email is a matching problem (aliases, case,
reuse, two accounts on one address) and getting it wrong revokes the **wrong person's**
access.

**No cross-tenant existence leak.** The target path is tenant-scoped, so a uid belonging
to another tenant simply does not exist here: *"never existed"* and *"exists elsewhere"*
are the same code path and the same reason code.

**Last-owner guard.** An owner whose own access is already suspended/offboarded/corrupt
does **not** count as a remaining owner — otherwise the last two owners could offboard
each other in sequence and strand the tenant.

**Super-admin is the documented break-glass path**, and is deliberately **not** a blanket
bypass: a super-admin normally holds no staff document in a tenant, so the role check is
skipped — but if they *do* hold one and it is suspended/offboarded, they are denied like
anyone else. The access gate is uniform. Recovery from that state is another super-admin
or correcting the field directly.

---

## 6. What offboard and restore actually do

### `offboardStaffCore` — `STAFF_ACCESS_REVOKED`

- `accessStatus: 'offboarded'`
- **tenant** custom claims cleared (`tenantId`, `tenantRole`) — *other* custom claims on
  the account are preserved; this revokes access to ONE tenant, it is not a platform-wide
  account wipe
- refresh tokens revoked (clearing the claim alone is not enough: an already-issued ID
  token stays valid until it expires, up to an hour, still carrying the old claims)
- **every** FCM token document in this tenant with `uid == target` deleted; other users'
  and other tenants' tokens untouched
- one audit record: previous → next state, actor, target, FCM deletion count
- a missing Auth user is a **completed** revocation, not a failure (the account may have
  been deleted separately); recorded as `authUserMissing`

### `restoreStaffAccessCore` — `STAFF_ACCESS_RESTORED`

- `accessStatus: 'active'`
- claims explicitly reinstated to `{ tenantId, tenantRole }` **derived from the staff
  document's role** — the authority on what this person is — so a restore can never
  reinstate a stale or elevated claim
- **it does NOT un-revoke refresh tokens, because it cannot.** Revocation is one-way in
  Firebase Auth; there is no un-revoke call and pretending otherwise would be a lie in the
  API. Every successful result carries `mustSignInAgain: true`.
- deleted FCM registrations are **not** resurrected; the Staff App re-registers on the
  next sign-in

`tenantRole` is load-bearing in `firestore.rules` (`isAdmin`/`isOwner`/`isStaff` all read
it), which is why clearing it is what actually closes the client-side door, and why
restoring the *correct* one matters.

---

## 7. Data written

```
tenants/{tid}/staff/{uid}
    accessStatus          'active' | 'suspended' | 'offboarded'   (absent = active)
    accessStatusUpdatedAt Timestamp
    accessStatusUpdatedBy uid of the acting owner/admin
    accessRevocation      { opId, op, stage: 'PENDING'|'DONE', startedAt, completedAt, actorUid }

tenants/{tid}/staffAccessOps/{opId}          ← NEW collection (server-only)
    op, tenantId, targetUid, actorUid, actorRole, targetRole, superAdminActor,
    rawKey, fingerprint, previousStatus, nextStatus, stage, attempts,
    startedAt, completedAt, fcmTokensDeleted, fcmSweptAt, authUserMissing, tokensRevoked
    aliasOf                                  ← only on an alias record

tenants/{tid}/auditLogs/staffaccess_{opId}   ← derived id = the exactly-once mechanism
```

`opId` is derived from `(op, tenantId, actorUid, rawKey)` — the same namespacing
discipline as the booking cores, so it can never collide with another operation type,
tenant, or actor reusing the same raw key. **The raw client key is never the document id.**

> ⚠️ `staffAccessOps` has **no `firestore.rules` entry yet** and no index. It is written
> only by server code with Admin credentials, which bypasses rules — but before anything
> reads it from a client, S4B must add an explicit rule. Under the current global
> catch-all posture, do not assume it is closed.

---

## 8. Test coverage (S4A)

| Suite | File | Count |
|---|---|---|
| Access resolver (unit) | `functions/src/staff/accessStatus.test.js` | 32 |
| Offboarding contract (unit, db-trap) | `functions/src/staff/offboarding.test.js` | 33 |
| State machine (emulator) | `functions/src/staff/offboarding.emulator.test.js` | 33 |
| Actor gate × 5 cores (emulator) | `functions/src/staff/actorAccessGate.emulator.test.js` | 69 |

The emulator suites use the **real** Firestore emulator. Firebase Auth is a **recording
double** — `--only firestore` is what the canonical gate starts, and the point of
injecting `opts.auth` is that the Auth contract (which calls, how many times, with what
claims) is assertable without a live Auth backend. What the double cannot prove — that
Google's API works — is explicitly not claimed.

---

## 9. Remaining work (S4B and beyond)

- **Callable wrappers** for both cores + `ACTOR_OFFBOARDED` reason mapping (the two error
  maps in `index.ts` are already prepared).
- **Admin UI** — Staff/Barbers: revoke, suspend, re-enable, and showing an access state
  that is visibly *not* the same thing as barber `passive`/`leave`.
- **Staff App** — a revoked user must land somewhere honest instead of a generic error.
- **`firestore.rules`** — a `staffAccessOps` rule, and a decision on whether clients may
  read `accessStatus` at all.
- **O1S** — while the Staff app still writes bookings directly from the client, the gate
  is bypassable; server enforcement is not universal until that cutover lands.
- **A reconciliation sweep** for op documents stuck at `PENDING` (today they are only
  resumed when someone retries the operation).
