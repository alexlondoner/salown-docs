# Team Member identity & role — the server contract (TEAM-LIFECYCLE O1)

**Status:** contract + 2 of 5 writers **LIVE 2026-08-08**. Source `salown-app` `960db19`,
SYNC `7ae16d5`. Closes the contract half of ROADMAP **T-e**; the remaining writers are
**O2**, and self-signup is blocked on ROADMAP **T-h** (repo ownership, not code).

Source: `functions/src/staff/identity.ts` · tests `identity.test.js` (32) +
`identity.emulator.test.js` (31). Companion: [STAFF_ACCESS_CONTROL.md](STAFF_ACCESS_CONTROL.md)
(S4A — the *access* axis, a different question).

---

## 1. The two authorities, and which one wins

A Team Member's role has two representations. They are **not** interchangeable.

| | Where | Who reads it |
|---|---|---|
| **The claim** | `request.auth.token.tenantRole` | `firestore.rules` — **19 gates** via `isOwner()`/`isAdmin()`/`isStaff()`, plus 10 frontend files |
| **The document** | `tenants/{tid}/staff/{uid}.role` | every server core — `bookings/blocks.ts`, `treatmentSessions/sessions.ts`, `packages/executor.ts`, … |

> **The staff document is the AUTHORITY. The claim is a PROJECTION of it.**

Every function in this contract writes the claim **from** the document, never the reverse,
and never invents one. There is deliberately **no trigger** syncing them: a trigger makes
the claim eventually-consistent with no way for a caller to learn whether it landed, and a
failed trigger is invisible. These writers converge synchronously and each reports
`mustRefreshToken`, because until the client calls `getIdToken(true)` the rules layer is
still reading the *old* token.

## 2. Why `setCustomUserClaims` is the dangerous primitive

`setCustomUserClaims(uid, claims)` **REPLACES the entire claim object.** It has no merge
semantics. Three live writers called it with a bare `{ tenantId }`, which:

- silently **deleted `tenantRole`** — and since Gate-G1 removed the `tenantRole == null →
  admin` fallback, a role-less claim fails every gate. That is a **lock-out**, not a
  downgrade; and
- silently **deleted `superAdmin`** from any account that carried it. The whitecross owner
  carries it, so the platform's only super-admin was one staff-creation away from losing it.

Separately, **neither `provisionTenant` nor `approveApplication` ever created `staff/{uid}`**
— both wrote only `barbers/{uid}`. That is why a self-signed-up owner cannot pass
`createStaffUser`'s own authorization read and cannot manage their own team.

## 3. The invariants

Each has a named test. If you change this module, these are what must not move.

| | Invariant | Why it exists |
|---|---|---|
| **I1** | Unrelated claims survive a tenant-claim write | The production defect. `superAdmin` and anything future must pass through untouched. |
| **I2** | `tenantId` and `tenantRole` are written as a **pair** | A half-identified account is the lock-out state; there is no legitimate "tenant but no role". |
| **I3** | Role ∈ `owner\|admin\|staff`; unknown is **refused**, never defaulted | Guessing a role mints a privilege level nobody assigned. |
| **I4** | An account bound to tenant A is **never** rebound to B | Otherwise signing up for salon B locks you out of salon A. A **corrupt non-string** `tenantId` counts as *bound*, not free — fail closed. |
| **I5** | A provision/repair path never **lowers** a live role | A retry must not demote a working owner. Corrupt roles rank `0`, so repairing one is not a downgrade. |
| **I6** | Re-running converges and performs **no redundant Auth write** | A redundant `setCustomUserClaims` is a real write: a round trip and account churn for no change. Idempotence must be *observable* (`changed: false`). |
| **I7** | The claim is always derived from the staff document | §1. |
| **I8** | A suspended/offboarded account is never re-granted claims here | Otherwise this path silently undoes an S4A revocation while performing no authorization of its own. Recovery is `restoreStaffAccessCore`, which is authorized and audited. |

## 4. The API

| Function | Kind | Contract |
|---|---|---|
| `planTenantClaims(existing, {tenantId, role, allowDowngrade})` | **pure** | The merge decision. Refuses `INVALID_TENANT` / `INVALID_ROLE` / `CROSS_TENANT_FORBIDDEN` / `WOULD_DOWNGRADE`. Returns `changed` so the caller can skip the RPC. |
| `applyTenantClaims(auth, uid, input)` | write | read → plan → **conditional** write. The only sanctioned claim write site outside S4A. |
| `planOwnerStaffDoc(existing, input, nowTs)` | **pure** | `create` / **upgrade-only** `repair` / `noop`. Fills gaps; **never renames**. |
| `ensureOwnerIdentityCore(db, input, opts)` | write | Idempotent owner create/repair. **Both refusals happen before ANY write.** |
| `reconcileStaffClaimsCore(db, {tenantId, uid}, opts)` | write | The **repair primitive** — rebuild the claim from the document. The one place `allowDowngrade: true` is correct by default: the document is authority, so if it says `staff` the claim must say `staff`, even though that lowers the account. Refusing would leave the escalation in place. |
| `setStaffRoleCore(db, input, actor, opts)` | write | Authorized role change. **NOT EXPOSED** — no `onCall` wrapper in this slice (S4A precedent: prove the authorization contract by test first). |

### `setStaffRoleCore` authorization, all re-read server-side inside the transaction

- actor + tenant from **verified auth only**, never the payload (a smuggled
  `tenantId`/`superAdmin` is a hard `INVALID_INPUT`);
- actor must hold `owner`/`admin`; super-admin is the documented break-glass path;
- an actor whose **own** access is revoked is denied;
- **no actor may grant a role above their own** → `ROLE_ESCALATION_FORBIDDEN`. Without it
  any admin promotes themselves to owner via a colleague and back;
- the **last owner who can still act** may not be demoted → `LAST_OWNER_FORBIDDEN`, reusing
  S4A's `countRemainingOwners` so demotion and offboarding cannot strand a tenant by taking
  one route each;
- the target is looked up **inside this tenant's path**, so another tenant's member is
  indistinguishable from a non-existent one — nothing cross-tenant is observable.

## 5. Write ordering

Same rule as S4A: **commit the state that DENIES first.**

- **Creation / promotion** → **document first, claim second.** A crash between them leaves
  the authority correct and the projection stale (and `reconcileStaffClaimsCore` converges
  it). The reverse order would leave the rules layer granting a privilege **no document
  backs** — the one unacceptable outcome.
- **Demotion** → **claim first.** Rights are removed immediately; a torn demotion leaves the
  person with *fewer* rights than the document records, which a re-run converges.

`setStaffRoleCore` reports `claimSynced: false` + `claimReason` rather than hiding a lost
claim write behind `ok: true`. Until it converges, the rules layer still sees the old role,
and the caller is entitled to know that.

## 6. What is live, and what is not

| Writer | State |
|---|---|
| `createStaffUser` (europe-west2, codebase `salown`) | ✅ **LIVE** `createstaffuser-00058-kur` (rollback `-00057-doq`) |
| `approveApplication` (europe-west2, codebase `salown`) | ✅ **LIVE** `approveapplication-00013-yob` (rollback `-00012-kix`) |
| `provisionTenant` | 🔴 **fixed in source, NOT deployable from this repo** — ROADMAP **T-h** |
| `updateStaffRole` / `registerMeAsAdmin` (`Settings.tsx`) | 🔵 **O2** — client-side writes that `firestore.rules:203` already blocks for non-super-admins, so they fail *and* report success |
| `setTenantClaim` (whitecross-site, super-admin) | 🔵 **O2** — merges correctly, but its only caller never sends a role |

> ⚠️ **`provisionTenant` — do not deploy from `salown-app`.** The live europe-west2 artifact
> carries `firebase-functions-codebase: whitecross` (`provisiontenant-00136-taj`). Deploying
> `functions:salown:provisionTenant` would seize the name from the other codebase. Read
> **T-h** before touching it.

### Verifying a deploy of this area

A revision number proves a *deploy*, not *which code*. Use a source marker (see
`feedback_live_deploy_hash_check`). The one this slice used, which writes nothing:

> An authenticated caller with **no** tenant claim calls `createStaffUser` with any
> `tenantId` → new code returns **403 `"You may only create staff in your own salon."`**;
> old code reaches the staff-doc read and returns `"Only owners can create staff accounts."`

The guard fires before `auth.createUser` and before any Firestore write, so the probe is
side-effect free apart from the throwaway Auth account used to obtain a token.

## 7. Known live drift — NOT repaired

Found by read-only audit 2026-08-08 (6 tenants, 7 staff docs). **Production repair is
separately authorized work and was deliberately not performed.**

| Tenant | Account | State |
|---|---|---|
| `the-hair-lab` | owner `epF8CRYW…` | claims `{tenantId}` only — **no `tenantRole`, no staff doc**. Fails every `isOwner()`/`isAdmin()` gate. |
| `yusufo` | owner `vHnYi5Cp…` | has `tenantRole` — **no staff doc**. Cannot manage their team. |

Both arrived via self-signup, i.e. through `provisionTenant`, which is why T-h gates the
cleanup: repairing them while the writer is unfixed just refills the set. When authorized,
`reconcileStaffClaimsCore` + `ensureOwnerIdentityCore` are the tools — both idempotent.
