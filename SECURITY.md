# SECURITY.md — Firestore Rules & Security (single source)

> **Purpose:** EVERYTHING related to Firebase/Firestore security is here. It used to be scattered
> (ROADMAP.md, DEPLOY.md, firestore.rules comments, .LIVE/.DRAFT/.ROLLBACK artifacts).
> It was categorized so we don't keep coming back to the same places. Security work = this file.
>
> **Canonical rules file:** `salown-app/firestore.rules` (firebase.json points to it).
> **Live ruleset:** G1+G4 (`0f8de7e`, 2026-06-27) — `tenantRole==null` fallback REMOVED + catch-all
> write→false. Before: G2+G3 (`851efeb`, ruleset `22bdc429`, 2026-06-24) → Phase 1 (`ef31d16a`, 06-21).
> **Scope of this doc:** Firestore rules + custom claims + booking create/cancel/reschedule
> flow security. **⚠️ WORK STATUS is not here — the SINGLE SOURCE is [ROADMAP.md](ROADMAP.md) Pre-Scale Gate;**
> this doc holds technical detail. Related: [DEPLOY.md](DEPLOY.md) (deploy discipline), memory `feedback-firestore-rules-safety`.

---

## 0. Quick status table

| # | Topic | Status | Risk |
|---|------|-------|------|
| Phase 1 | Cross-tenant isolation (global fallback `isAuth`→`isSuperAdmin`) | ✅ **DONE** (2026-06-21, ruleset `ef31d16a`) | — |
| Phase 1 | Single canonical rules file (`salown-app/firestore.rules`) | ✅ **DONE** | — |
| **G1** | Role-claim backfill (`tenantRole == null → admin` fallback) | ✅ **LIVE** (2026-06-27, commit `0f8de7e`) — fallback removed, claims were already complete, test 49/49 | 🔴→✅ |
| **G2** | `bookings read: if true` → tenant-scoped | ✅ **LIVE** (ruleset `22bdc429`, 2026-06-24) | 🟠 Medium |
| **G3** | Public create financial forge (`paidAmount/discount/tip`) | ✅ **LIVE** (ruleset `22bdc429`, 2026-06-24) | 🟢 Low |
| **G4** | staff-doc recursive catch-all (staff self-escalate) | ✅ **LIVE** (2026-06-27, commit `0f8de7e`) — catch-all write→false + 14 collections explicit, test 49/49. ⚠️ Follow-up: `AppRouter.jsx:104` `isAdmin=true` hardcoded → bind to real role before a new staff enters the web panel | 🟠→✅ |
| **G5** | Single global ruleset blast radius | ⚠️ Partial (deploy discipline exists, no structural fix) | 🟠 Medium |
| **S1** | staffComp financial data protection | ✅ **LIVE** (ruleset `1474907b`, 2026-07-16) — `match /staffComp/{barberId}` read/write=`isSuperAdmin()\|\|isOwner(tenantId)` (admin/staff CANNOT SEE comp, Finance gate parity). Catch-all READ narrowed with `{coll}/{document=**}`+`coll!='staffComp'` — because of OR-semantics an explicit block alone was not enough (G4 lesson). Comp is NEVER written to the world-readable barbers. Test 95/95 (12 S1 cases + catch-all regression), pre-deploy live-fetch+diff, post-deploy byte-identical verified | 🟢 Low |

> **2026-06-24 progress:**
> - **G2 + G3 WENT LIVE** — `firestore.rules` merged+pushed to main (`851efeb`), `firebase deploy
>   --only firestore:rules` → ruleset **`22bdc429-9501-4bd5-ae43-df4a694bd850`** (verified via API,
>   [G2]/[G3] present). Test API 25/25; whitecross/herohairs/panel flows proven preserved.
> - **G1 dry-run done.** Only 4 users have a staff doc (herohairs owner; whitecross
>   owner/admin/staff). ⚠️ ~6 users that have a tenantId claim but no staff doc (eekurt
>   `eekurt`↔`ee-kurt-barbers` mismatch) → **if the fallback is removed they lose admin.**
>   `--apply` was not run (ineffective while fallback is active, removing fallback without audit is risky).
> - **G4 exhaustively enumerated** (~20 collections: settings/*, clients/*/campaignsSent,
>   finance_expenses/_payments, investment_transactions, auditLogs, campaigns, notifications,
>   team, fcmTokens, dashboardPrefs, ledger... + possible storage ones logo/cover/photo).
>   Removing the catch-all write and enumerating breaks panel writes live if a single collection is missed
>   → a SEPARATE job needing comprehensive test + review; not taken live.
> - functions/index.js was not touched (the busy-slot v2 round had dirtied it). Test tracking: [TESTS.md](TESTS.md).

> ⚠️ ROADMAP says "before tenant #4" but **3 tenants are already live** (whitecross, eekurt,
> herohairs). These gates are active risk today too. Most critical: **G1**.

> **🔴 2026-06-27 FINDING — catch-all overrides everything (G1↔G4 link):** Rules Test API probes
> (scratchpad/probe.py) proved that the in-tenant `match /{document=**}` `write: if isTenantAny`
> rule overrides ALL more-specific rules (Firestore rules are OR'ed):
> - a user without `tenantRole` **can write `profileStatus` to the tenant-root → ALLOW** → `[P1-D]`
>   publication-control protection is effectively INEFFECTIVE (any tenant member can publish/unpublish).
> - a user without `tenantRole` **can delete a booking → ALLOW** → bookings `delete: if isAdmin` is overridden
>   (delete=admin-only is effectively gone; conflicts with the target delete=superadmin-only).
> - **a staff can write their own `staff/{uid}.permissions` → ALLOW** (G4 self-escalate, live).
>
> **Conclusion:** `isAdmin/isStaff/P1-D` are effectively dead at the rules level; the real lock is narrowing the catch-all (**G4**).
> **G1 fallback-removal must NOT be deployed ON ITS OWN** (safe but useless theater). G1+G4 together.
> Audit (2026-06-27): ALL 6 live tenant users have the correct `tenantRole` claim (backfill
> already applied); the 3 users that have `tenantId` but no `tenantRole` are only in dead/test tenants
> (ee-kurt-barbers/the-hair-lab/the-test-lab) → removing the fallback does not affect live (25/25 green).

---

## 1. Rules architecture (current, proven)

### Helper layers (`firestore.rules:14-23`)
```
isAuth()        → request.auth != null
isSuperAdmin()  → token.superAdmin == true          (alish; delete + cross-tenant)
isTenant(tid)   → token.tenantId == tid             (the user's own tenant)
isAdmin(tid)    → isTenant && (tenantRole == null || in ['owner','admin'])   ← G1 leaks from here
isStaff(tid)    → isTenant && (tenantRole == null || in ['owner','admin','staff'])
isTenantAny(tid)→ isTenant(tid)                      (no role check; only correct tenant)
```

### Access layers (top to bottom)
1. **`/tenants/{tenantId}`** root doc — `read: if true` (public booking sites read it),
   write `isSuperAdmin() || isAdmin()`, publication-control fields protected (`[P1-D]`).
2. **Tenant sub-collections** — bookings/services/barbers/gallery/announcements (public read),
   staff (auth read), parserTombstones (tenant-only).
3. **Tenant catch-all** (`firestore.rules:105-108`, `[P1-B]`) — for deep `{document=**}` paths
   `isSuperAdmin() || isTenantAny()`. The G4 vulnerability is at this layer.
4. **`/superAdmin/**`** — only `isSuperAdmin()`.
5. **Global fallback** (`firestore.rules:122-124`, `[P1-A]`) — every uncovered path only
   `isSuperAdmin()`. **In Phase 1 the `isAuth()` hole here was closed.**

---

## 2. Phase 1 — done (2026-06-21)

**Problem:** The global fallback was `allow read, write: if isAuth()` → EVERYONE who logs in
(any tenant user) could access OTHER tenants' data. The real
cross-tenant security hole.

**Fix:** `[P1-A]` global fallback lowered to `isSuperAdmin()`; `[P1-B]` tenant catch-all
extended to `{document=**}` (so same-tenant deep access isn't broken); `[P1-C]` temporary
backwards-compat (tenantRole null→admin — this gave birth to G1).

**Proof:** Rules Test API 16/16 (`docs/test-firestore-rules.py`); live ruleset
`ef31d16a` verified via securityRules API (createTime 2026-06-21 13:38 GMT).
Rollback: `docs/firestore.rules.ROLLBACK.txt`. Snapshot: `docs/firestore.rules.LIVE`.

---

## 3. Open gates — verification against code + fix plan

> The blast-radius analyses below were done **against real code** (2026-06-24). For each,
> the question "is the ROADMAP claim correct?" was answered.

### 🔴 G1 — Role-claim backfill (MOST CRITICAL)

**Claim:** Because of `tenantRole == null → admin` the whole permission system is dead; everyone
who has a tenant is treated as admin. **→ CORRECT.** `firestore.rules:21-22` has the `== null` fallback;
the 2026-06-21 audit found that NONE of the current ~10 users had a `tenantRole` claim.
The `setCustomUserClaims(... tenantRole ...)` call does **NOT EXIST AT ALL** in the codebase (grep: zero).

**Conclusion:** the owner/admin/staff distinction is effectively absent at the rules level. The permission UI (the
7 permissions in Settings) is only in-app; on the rules side a staff can write like an admin.

**✅ Backfill script WRITTEN: `salown-app/scripts/backfillTenantRoles.cjs`** (not yet run).
Dry-run default; reads `tenants/*/staff/{uid}.role` and MERGES with `setCustomUserClaims(uid, {...existing,
tenantId, tenantRole})` (tenantId/superAdmin preserved). Convention:
same as `migrateWhitecrossServices.cjs` (service account `../../salown-panel/serviceAccountKey.json`).

**Fix order (wrong order locks everyone out):**
1. `node scripts/backfillTenantRoles.cjs` → **dry-run**, review output (10 users, role matches).
2. `node scripts/backfillTenantRoles.cjs --apply` → write the claims.
3. Users' tokens must refresh (re-login or `getIdToken(true)`).
4. **ONLY after that** remove the `tenantRole == null ||` fallback from `firestore.rules:21-22`.
5. Verify with Test API → deploy (rules LAST).
> ⚠️ If you do step 4 BEFORE the backfill, all admins without a claim are locked out (can't write Settings).

**🔴 AUDIT FINDING (2026-06-24) — removing the fallback is NOT SAFE:** Active tenant = **only whitecross +
herohairs** (eekurt/the-hair-lab/test not live → irrelevant). Auth audit (`auth.listUsers` + staff doc check):
- ✓ staff doc EXISTS: aerulas@ (whitecross owner+superAdmin), auzun9499@ (whitecross admin),
  muhammedkanidagli74@ (whitecross staff), durvezek@ (herohairs owner) → backfill stamps the correct tenantRole on these.
- ❌ **staff doc MISSING but tenantId claim EXISTS (2 LIVE users):** `whitecrossbarbers@gmail.com` (whitecross,
  superAdmin:false — **the owner's own account**) and `alex2ayyildiz3@gmail.com` (herohairs). Backfill cannot stamp
  `tenantRole` on these (no staff doc) → **if the fallback is removed these two lose whitecross/herohairs admin.**

**MANDATORY before step 4 (fallback removal):** decide about these 2 users — (a) create a staff doc (appropriate role:
whitecrossbarbers@=owner?/admin?, alex2ayyildiz3@=?), OR (b) manually assign the tenantRole claim. Then re-run the backfill
→ token propagation (re-login/getIdToken(true) or ~1h) → ONLY after that remove the fallback + deploy.

**Risk:** If the fallback is removed BEFORE the backfill, all admins without a claim are locked out
(can't write the tenant doc from Settings → Stripe/features break). That's why the script comes first.

---

### 🟠 G2 — `bookings read: if true` (whitecross has a client-side dependency — DECISION REQUIRED)

**Claim:** Everyone (even unauthenticated) can read all customer bookings (GDPR); whitecross
dup-check relies on it. **→ CLEARLY CORRECT. The first assessment was "low risk"; after reading whitecross-site
code it was CORRECTED → medium risk, requires a decision.**

**Analysis against code (2026-06-24):**
- `firestore.rules:39` → `allow read: if true` is exactly open.
- **salown-app (including herohairs) reads bookings nowhere public.** `BookingPage.jsx:313-317`
  only reads services/serviceCategories/barbers; it gets busy slots from the `salownGetBusySlots`
  **callable** (`functions/index.js:1088`, Admin SDK → rules bypass). → herohairs is NOT AFFECTED by G2.
- The panel/staff reads bookings with `${TENANT}/bookings` **authenticated** in
  `firestoreActions.js` → falls under the tenant-scoped rule, not broken.
- ⚠️ **whitecross-site (separate codebase) READS bookings unauthenticated in 3 places:**
  1. `script.js:471` dup-check — `try/catch` **fails-open** → booking continues. ✅ Safe.
  2. `script.js:1809` group-confirm read (to write CONFIRMED client-side after Stripe return)
     — code comment "webhook also does this server-side" → when DENYed the webhook compensates. Degrade.
  3. `script.js:1846` Stripe-back cancel read (cancel a PENDING) — when DENYed the client cannot cancel;
     `salownCleanupExpiredPending` cleans up after 15min. Degrade (not instant).

**Conclusion:** G2 does NOT break booking CREATE (both tenants), but it downgrades whitecross's two post-Stripe
client-side conveniences (group-confirm + Stripe-back instant cancel) to server fallback.
Per the "don't break the flow" red line this DECISION belongs to the user — it was not applied silently.

**Options:**
- **(a) Apply now, accept the degrade:** webhook + 15min cleanup already compensate; the GDPR hole
  closes immediately. Risk: permission-denied logs in the whitecross console, a group booking confirm delay
  on a rare webhook delay.
- **(b) Defer:** first remove/move-to-callable whitecross-site's 3 reads, then deploy G2.
  But that means touching whitecross-site (the busy-slot round dirtied functions; separate round).

**Fix (when applied):** `firestore.rules:39` → `allow read: if isSuperAdmin() || isTenantAny(tenantId);`

---

### 🟢 G3 — Public create financial forge

**Claim:** Public create has no validation of `paidAmount`/`discount`/`tip` → they can be forged.
**→ CORRECT.** `firestore.rules:40-42` create only checks `status in ['PENDING','CONFIRMED']`;
no financial-field check. (The update path has a whitelist, protected.)

**Analysis against code:** The legitimate public create payload (`BookingPage.jsx:541-563`) **does NOT write
paidAmount/discount/tip/platformDepositAmount** — it only writes `price` (service price, display).

**Conclusion:** Adding a constraint "these financial fields MUST NOT be present at create" to the create rule does not break
the legitimate flow (it doesn't send them anyway), but it prevents an attacker from forging `paidAmount: 999`.

**⚠️ whitecross-site verification (2026-06-24):** `writeBookingStatus` (script.js:1136) and group
create (script.js:1360) WRITE `paymentState`/`paymentType`/`depositPerPerson` but do NOT write `paidAmount`/
`discount`/`tip` (grep: zero). salown-app `BookingPage` doesn't write them either. → The blocklist
**should be only `paidAmount`/`discount`/`tip`**; if we block `paymentState` whitecross create breaks.

**✅ APPLIED (`firestore.rules:38-46`, awaiting deploy):**
```
allow create: if isSuperAdmin() || isTenantAny(tenantId) || (
  request.resource.data.status in ['PENDING','CONFIRMED'] &&
  !request.resource.data.keys().hasAny(['paidAmount', 'discount', 'tip'])
);
```
(`price`/`paymentState` forge is a separate/low topic — display + state; real money is written on the
callable/webhook side. If desired, Phase 2 server-side validation in `salownCreateBooking` transactional.)

---

### 🟠 G4 — staff-doc recursive catch-all (staff self-escalate)

**Claim:** The specific staff rule (`firestore.rules:89`) is admin-only but the catch-all `{document=**}`
(`:105-108`) opens the same path to `isTenantAny`; rules are OR'ed → a staff can write their own
`permissions`. **→ CORRECT** (in Firestore match rules are OR'ed; the broadest permission wins).

**Danger:** A staff with `canViewRevenue:false` can directly write the `permissions` in their own staff doc
and set `canViewRevenue:true` → the in-app permission system (together with G1) is completely holed.

**Why a simple patch is NOT ENOUGH:** Firestore match rules are OR'ed; even if the more-specific `match /staff/{uid}`
rule is admin-only, because the catch-all `{document=**}` write grants `isTenantAny` the staff write
passes. "Add a stricter specific rule" doesn't work (union, not intersection). The only solution: **remove the catch-all
write + enumerate the collections that authed users write.**

**Enumeration (2026-06-24, `grep tenants/{id}/<col>` src):**
- Already explicitly matched: `bookings, services, serviceCategories, barbers, gallery, announcements,
  staff, parserTombstones, public`.
- **Only bound to the catch-all (needs a new explicit rule):** `advances, auditLogs, campaigns,
  clients (+ deep: clients/{id}/campaignsSent), cover, expenses, finance, investment, logo,
  notifications, products, team, settings, fcmTokens`.

**Proposed fix (DRAFT — do NOT deploy without Rules Test API):**
```
// every tenant sub-collection except staff is open to the auth tenant member (recursive — for deep paths)
match /clients/{document=**}  { allow read, write: if isSuperAdmin() || isTenantAny(tenantId); }
match /campaigns/{document=**} { allow read, write: if isSuperAdmin() || isTenantAny(tenantId); }
match /settings/{document=**}  { allow read, write: if isSuperAdmin() || isTenantAny(tenantId); }
... (advances, auditLogs, cover, expenses, finance, investment, logo, notifications, products, team, fcmTokens)
// catch-all: READ stays open, WRITE goes away → staff/{uid} is written only from the admin-only rule above
match /{document=**} {
  allow read:  if isSuperAdmin() || isTenantAny(tenantId);
  allow write: if false;   // all writable collections are explicit above
}
```
- ⚠️ **Verification IS MANDATORY:** before/after the change, ALL write paths of the panel + staff
  app (booking, walk-in, checkout, client merge, campaign, settings, finance,
  audit) must stay green with `docs/test-firestore-rules.py`. A single missed collection = that panel feature breaks (whitecross/herohairs).
- **That's why G4 is not yet APPLIED to `firestore.rules`** — whether the enumeration list is complete must be proven with tests.

---

### 🟠 G5 — Single global ruleset blast radius

**Status:** All tenants share a single ruleset → one mistake hits every tenant. A structural fix
(per-tenant ruleset) is not practical in Firestore. Existing mitigations:
- SINGLE SOURCE rule (`DEPLOY.md:24`): rules deploy only from `salown-app/firestore.rules`.
- Test-before-deploy: `python3 docs/test-firestore-rules.py salown-app/firestore.rules`.
- Rollback ready: `docs/firestore.rules.ROLLBACK.txt`.
- Live verification: fetch ruleset from securityRules API, the latest deploy wins.

**Remaining:** Wire this discipline into a CI check (automatic test before deploy). Low priority.

---

## 4. Booking flow security (create / cancel / reschedule) — BREAKAGE MAP

> Gate fixes MUST NOT BREAK these flows. Each flow's dependency on rules:

| Flow | Mechanism | Depends on rules? | Gate effect |
|------|-----------|---------------------|-------------|
| **Public booking create** | `BookingPage.jsx:541` `addDoc` (client) | ✅ Yes — `bookings create` | G3 tightens here (safe; payload doesn't write financial fields) |
| **Busy slot query** | `salownGetBusySlots` callable (Admin SDK) | ❌ No (bypass) | not affected by G2 |
| **Cancel (customer)** | `salownCancelByToken` callable (Admin SDK) | ❌ No (bypass) | not affected by any gate |
| **Reschedule (customer)** | `salownRescheduleByToken` callable (Admin SDK) | ❌ No (bypass) | not affected by any gate |
| **Panel/staff read** | `${TENANT}/bookings` authenticated | ✅ Yes — `bookings read` | works with `isTenantAny` after G2 |
| **Panel/staff write** | walk-in/checkout addDoc/update | ✅ Yes — catch-all/bookings | must be tested in the G4 narrowing |

**Golden rule:** Because cancel/reschedule are **server-side callables**, tightening the rules
NEVER affects them. The real attention: (a) public create (G3) and (b) panel write paths (G4).

### ⚠️ whitecross-site = separate codebase, writes directly to the SAME Firestore (binds the rules)

> whitecrossbarbers.com (`whitecross-site/script.js`) is NOT salown-app — but it accesses `tenants/whitecross/bookings`
> directly, mostly **unauthenticated**. Every rules change affects these too. Map:

| Line | Operation | Fields | Rules branch | Gate effect |
|-------|-------|---------|-----------|-------------|
| `script.js:471` | **read** dup-check (clientPhone) | — | `bookings read` | G2 → DENY but `try/catch` fails-open, booking continues |
| `script.js:1136/1360` | **create** (writeBookingStatus/group) | paymentState, paymentType, depositPerPerson (paidAmount/discount/tip NONE) | `bookings create` | G3 → safe (doesn't write these fields) |
| `script.js:1809` | **read** group-confirm | — | `bookings read` | G2 → DENY; webhook compensates server-side |
| `script.js:1813` | **update** group-confirm | status, paymentState, paidAt | `bookings update` whitelist | paymentState/paidAt NOT in whitelist → DENY today too, silent fail, webhook does it (no regression) |
| `script.js:1846` | **read** Stripe-back cancel | — | `bookings read` | G2 → DENY; 15min cleanup compensates |
| `script.js:1850` | **update** Stripe-back cancel | status, cancelledAt | `bookings update` whitelist | IN the whitelist → works today; can't be triggered once G2 cuts the read |

**Takeaway:** whitecross booking CREATE is not broken by any gate. G2 only downgrades 2 client-side
post-Stripe conveniences to server fallback (see §3 G2 decision). All gates can be closed with rules + script
without touching whitecross-site.

---

## 5. Recommended application order (low to high risk)

1. **G3** (financial forge) — pure rules, legit flow doesn't write financial fields anyway. Safest.
2. **G2** (bookings read) — pure rules, salown-app not affected, whitecross fails-open.
3. **G4** (staff catch-all) — rules, but panel/staff write tests are mandatory.
4. **G1** (role-claim backfill) — script + token refresh + rules; most critical, most careful.
5. **G5** — wire deploy discipline into CI (optional).

**Each step:** change → test with `docs/test-firestore-rules.py` → approval → deploy
(order: functions first if any, **rules LAST**). Don't deploy more than one gate in the same round;
verify one by one (G5 blast radius logic).

> ⚠️ **functions/index.js is currently dirty** (busy-slot v2 / processing-time work, another session).
> G2's optional "PII-less dup-check callable" touches functions → DON'T GO INTO that job, it collides with
> the busy-slot round. All gates can be closed with **only `firestore.rules` + a new script file**
> (without touching functions). See §3.

---

## 6. Artifact & tool inventory

| File | Type | Purpose |
|-------|-----|------|
| `salown-app/firestore.rules` | live code | THE single canonical source (firebase.json) |
| `docs/firestore.rules.LIVE` | snapshot | Copy of what's deployed (drift check) |
| `docs/firestore.rules.ROLLBACK.txt` | rollback | Emergency revert |
| `docs/firestore.rules.DRAFT` | draft | Phase 1 draft (old; no `[P1-D]`) — reference |
| `docs/test-firestore-rules.py` | test | Rules Test API (no Java/emulator needed) |

---

## 7. Roles & authorization model (target + current) — 2026-06-24

> **Owner decision (2026-06-24):** Authorization currently runs in "everyone is admin" (null→admin fallback)
> mode; the real role system is not in force. Target is a **dynamic** role architecture: in the future
> `superadmin / admin / manager / staff` assignments will be done **by design** → the structure must be ready for it
> (roles+permissions data-driven, not hardcoded).

### Target authorization matrix (interim — until the dynamic design)
| Role | Scope |
|-----|--------|
| **superadmin** | EVERYTHING, cross-tenant. Deleting tenant root/staff/settings/auditLogs/finance is ONLY superadmin. |
| **owner** | Everything in their own tenant + **deleting their own DATA** (E1b, 2026-07-11): bookings/services/serviceCategories/gallery/announcements/discountCodes/clients/campaigns/products/**barbers** (barbers has a strong-confirm modal in the UI). NOTHING cross-tenant. |
| **admin** | Sees + modifies everything (create/update), **cannot delete**. |
| **manager** | (to be designed later — between admin/staff) |
| **staff** | Limited; permissions via a `permissions` object (canCreateBookings/canCheckOut/... toggles) |

> ✅ **E1b LIVE (2026-07-11, ruleset test 83/83):** delete = `isSuperAdmin() || isOwner(tenantId)`
> (on the collections in the owner row above). `isOwner(tid)` = tenantId matches + tenantRole=='owner'.
> Admin/staff/cross-tenant delete DENY — tested. Super-only remaining: tenant root, staff, settings,
> auditLogs, finance family, Clients merge-drag. The "Delete ONLY superadmin" period (2026-07-02→07-11)
> was a pilot policy; E1b extended it to the tenant-scoped owner (status record: ROADMAP E1b).
> See memory `feedback-delete-superadmin-only`.

### Current users (2026-06-24, live = whitecross + herohairs)
| Email | Tenant | Role (staff doc) | superAdmin claim | Note |
|-------|--------|-----------------|------------------|-----|
| aerulas@gmail.com | whitecross | owner | **YES** | **The owner's superadmin account — delete authority is only here** |
| auzun9499@gmail.com (Arda) | whitecross | admin | false | Everything except delete |
| muhammedkanidagli74@gmail.com | whitecross | staff | false | Permissions in the permissions object |
| whitecrossbarbers@gmail.com | whitecross | **staff** ✅ | false | 2026-06-24 staff doc created (previously had no role, appeared as admin via fallback) |
| durvezek@gmail.com | herohairs | owner | false | herohairs owner |
| alex2ayyildiz3@gmail.com | herohairs | **owner** ✅ | false | 2026-06-24 owner doc created |

> ✅ **All live users' roles are COMPLETE** (2026-06-24) → G1 backfill is now unblocked.

### Open TODO (next session)
- [ ] **Complete G1:** `node scripts/backfillTenantRoles.cjs --apply` → token propagation (re-login/~1h)
      → remove the `tenantRole==null ||` fallback from `firestore.rules:21-22` → Test API → deploy. ⚠️ Removing the fallback
      while active users are present causes an instant admin-drop; wait for token refresh.
- [ ] **Dynamic role system** (superadmin/admin/manager/staff, data-driven permissions) — design + impl.
- [ ] **delete = superadmin-only** rules refactor (comprehensive; together with the dynamic role).
- [ ] **Signup protection:** `salownSelfSignup` is public → bot registration is possible (2026-06-24 a spam account was deleted).
      Add email confirmation / verification code / CAPTCHA.

## Related documents
- [DEPLOY.md](DEPLOY.md) — rules deploy discipline, SINGLE SOURCE rule, deploy order
- [ROADMAP.md](ROADMAP.md) — #9 (Rules Phase 2) + PRE-SCALE HARDENING GATE (G1–G5)
- [BUSINESS_RULES.md](BUSINESS_RULES.md) — booking create/cancel/reschedule business rules
- [INCIDENTS.md](INCIDENTS.md) — past security/rules accidents
- memory `feedback-firestore-rules-safety`, `feedback-tenant-root-doc-public`,
  `feedback-delete-superadmin-only`, `project-salown-prescale-hardening`
