# Self-service trial lifecycle (ONB-P1 and the plan for D, E and F)

**Work ID:** `ONB-P1-TRIAL-LIFECYCLE` · **Status:** Phase 1 (A + B + C) `PUSHED_NOT_LIVE`. D, E and F are specified here and have not been started.
**Owner decisions:** 2026-10-01. They are binding, and §1 restates them.
**Code:** `salown-app/functions/src/onboarding/trialLifecycle.ts` (pure core), `trialMessages.ts` (copy), `trialStore.ts` (Firestore store and sweep), and `inviteStore.ts` (the activation transaction, which writes the SSOT). The mutation gate is `salown-app/ops/mutation/trialLifecycle.mutation.sh`.

Nothing in Phase 1 is exported from `functions/src/index.ts`, nothing changes `firestore.rules`, and nothing writes to production. The job and the email transport are wired in a separate step that the owner must approve (§7).

---

## 1. Owner decisions (2026-10-01)

1. A new activation gets a **30-day** trial. The value comes from `TRIAL_POLICY.trialDays` and is defined in one place only.
2. The trial starts **only** in the successful activation transaction. It never starts at approval, at provisioning or on a resend.
3. `trialStartedAt` is immutable. A retry never restarts the trial.
4. `trialEndsAt` is computed on the server.
5. Existing production trials are **never migrated or changed**. The new policy applies only to new activations.
6. Reminders go out at **D-7, D-3, D-1 and D0**.
7. The grace period is **3 days**.
8. When the trial ends:
   - new public booking closes;
   - existing bookings stay visible and manageable during grace;
   - the owner sees a strong upgrade banner.
9. If grace ends without payment, the tenant moves to `suspended`:
   - the owner can reach only billing, data export and support;
   - normal panel, callable and claim operations close;
   - staff lose access;
   - public booking stays closed;
   - no data is deleted.
10. A successful payment makes the tenant active again automatically.
11. A tenant can never write its own status, lifecycle, trial or subscription fields.
12. An existing account is never disabled automatically and its password is never changed.
13. Reminders go by email and in-app only. There is no WhatsApp or SMS in this phase.
14. Email is idempotent: a milestone is never sent twice.
15. Platform subscription is a self-service Stripe flow. Prices are never invented. They come only from a canonical plan catalog (§9 F-0).

State model: `activation_pending → trialing → grace → active_paid | suspended`. No job may ever move a paid tenant backwards.

---

## 2. Inventory (read-only, 2026-10-01, `origin/main` `9f4f530f`)

| Area | What exists today |
|---|---|
| Activation transaction | `inviteStore.finalizeActivation`. It is **source only**, not wired to any callable (S3d is still open). It moves the tenant root from `INVITE_PENDING` to `TRIAL_ACTIVE` and writes `trial{startedAt,endsAt,source}` plus the legacy mirrors `trialEndsAt` and `status:'trial'`. |
| Trial writers that are live | `provisionTenant` (`index.ts` ~362-380) and `approveApplication` (~3786-3803) set `status:'trial'` and `trialEndsAt: +90d` **at approval/provisioning**, with no `lifecycle`. Super-admin `Tenants.jsx:175-184` (create) and `:587-595` (save plan) write `trialEndsAt` the same way. |
| Trial readers | **None enforce anything.** The super-admin UI displays `trialEndsAt`. `src/utils/planLimits.ts` reads only `plan`. |
| Status/lifecycle writers | The super-admin Suspend toggle (`Tenants.jsx:1114`) flips root `status` between `'suspended'` and `'active'`. `salownReviewProfile suspend` changes the **profile** publication state, not the root. `status`, `plan` and `trialEndsAt` are **writable by tenant admins** (rules tenant-root update arm; only `lifecycleControlKeys()` and the profile and presentation keys are locked). |
| Status/lifecycle readers | `requireSuperAdminOperation` refuses on `status === 'suspended'`. `identityProjection.ts:119` refuses with `TENANT_SUSPENDED`. Everything else reads `lifecycle` through `lifecycleGrantsTenantAccess` (`ACCOUNT_ACTIVATED` / `TRIAL_ACTIVE` / `SUBSCRIBED`; a missing value means legacy) and the rules function `tenantLifecycleActive`, where **any other value fails closed**. |
| Scheduled functions | `salownParseEmails` and `salownCleanupExpiredPending` run every 5 minutes. `dailyFirestoreBackup` runs at 03:00 London and `salownHealthProbe` at 04:30 London. The probe uses `maxInstances 1`, `retryCount 0` and injected deps; it is the template for the trial job. |
| In-app notifications | The panel bell (`NotificationBell.tsx:92`) reads `tenants/{t}/notifications`, newest 50, with shape `{type,title,body,bookingId,read,createdAt}`. Rules: any tenant member can create or update; only super-admin can delete. |
| Email | `sendBrevoEmail` (`emails/index.ts:117`) has **no test seam**. The documented GDPR and unsubscribe policy covers salon **customers** only; there is no policy for owner or platform emails. |
| Owner email sources | Root `ownerEmail`/`ownerUID` (client-writable) · `barbers.email` (client-writable) · `staff/{uid}` with `role:'owner'` (**server/super-admin only**) · Auth `getUser(uid)` · token claims. No recipient allowlist helper exists. |
| Timezone | `settings/settings.presentation.timezone` with a public root mirror, default `Europe/London`. ICU helpers live in `utils/presentation.ts`. |
| Public booking gate | `salownCreateBooking` / `createBookingCore` only checks that the tenant root **exists** (`createBooking.ts:733`). The rules anonymous-create branch has **no tenant gate**. `salownCreateCheckoutSession` never reads the root. Today nothing stops a booking for a non-active tenant. |
| Panel/claim gates | Rules: `isTenant()` → `tenantLifecycleActive`. Callables: `requireTenantActor` / `requireCallableActor` check lifecycle, not `status`. `applyTenantClaims` → `tenantClaimGate` checks lifecycle. **No** React router gate, banner or suspended screen exists. |
| Plans / Stripe Billing | `src/utils/planLimits.ts` (frontend only) has free 0 / starter 29 / pro 69 / proplus "Let's talk", with **no currency and no Stripe price ids**. `TIERS_AND_UPGRADE.md` §tier matrix mirrors these numbers. There is **no subscription code anywhere**: no `mode:'subscription'`, no `customer.subscription.*` handler, no price id. |

**Production shape** (read-only REST, 2026-10-01, counts only):
- 9 tenant roots.
- `lifecycle` is absent on all 9, so all are legacy.
- `status`: 4 `active`, 5 `trial`.
- `plan`: 5 `free`, 2 `Pro`, 2 `Pro+`.
- `trialEndsAt`: present on 6 and absent on 3. **One `status:'trial'` tenant has a `trialEndsAt` in the past.**
- `trial`, `activatedAt`, `billing`, `subscriptionStatus`, `stripeCustomerId` and root `timezone` are absent on all 9.
- `tenantBilling` and `ownerInvites` are empty.

The past-due legacy tenant is the reason the job selects **only** tenants that have a billing document. A job keyed on `trialEndsAt` would suspend it.

---

## 3. State and schema contract (Phase 1)

### 3.1 `tenantBilling/{tenantId}`: THE trial SSOT

This is a top-level, **server-only** collection. No `firestore.rules` match exists for it, so every browser principal is denied by default. Only the activation transaction (`inviteStore.finalizeActivation`) creates the document. A tenant without one is legacy, and the job never selects it.

```
schemaVersion   1
tenantId        string
state           'activation_pending' | 'trialing' | 'grace' | 'active_paid' | 'suspended'
stateVersion    int    // +1 per transition; audit ids derive from it
stateChangedAt  Timestamp
ownerUid        string // the activating owner (invite uid); the ONLY email recipient key
trial: {
  startedAt, endsAt, graceEndsAt   Timestamp   // immutable after creation
  trialDays 30, graceDays 3, timeZone 'Europe/London', endLocalDate 'YYYY-MM-DD'
  reminderDueAt { 'D-7','D-3','D-1','D0': Timestamp }
  source 'activation'
}
nextScheduleAt  Timestamp|null   // next reminder or transition due; null = nothing left
nextDeliveryAt  Timestamp|null   // next email attempt (queued/retry/lease expiry)
createdAt, updatedAt
```

Within the same transaction, the tenant root keeps the projection that already exists: `lifecycle:'TRIAL_ACTIVE'`, `trial{startedAt,endsAt,source}`, `trialEndsAt`, `status:'trial'`. Both are computed by **one** `computeTrialWindow` call, and finalize fails closed (`trial_window_mismatch`) if the two ever differ. If a billing document already carries a trial, finalize refuses with `billing_already_started` and makes zero writes, so a trial is never restarted. A malformed billing document gives `billing_malformed`.

### 3.2 Time-zone rules (deterministic, DST-safe)

- The zone is resolved server-side at activation: `settings/settings.presentation.timezone`, then the root `presentation.timezone`, then `Europe/London`. An invalid zone falls back to the default. The zone is **frozen** into the trial, so a later settings edit never moves a deadline.
- `endsAt` is `startLocalDate + 30` **local calendar days** at the same wall-clock time. `graceEndsAt` is `endLocalDate + 3` local days at the same wall-clock time. Because of DST, the elapsed time can be 30 days ± 1 hour.
  - A wall-clock time inside a spring-forward gap resolves **forward**.
  - A wall-clock time inside a fall-back overlap resolves to the **later** instant.
  - Both behaviours come from `instantFromZonedWallClock` and are pinned by tests (London, Istanbul, Sydney).
- D-7, D-3 and D-1 are due at **09:00 local** on `endLocalDate − k`. D0 is due at `endsAt`.

### 3.3 `tenantBilling/{t}/trialReminders/{milestone}`: the reminder queue

There is one document per milestone, and its id is the milestone, so a milestone can be queued at most once per tenant.

The row is created in the **same transaction** that decides it is due, together with the in-app notice and the audit. On a late run, only the most recent eligible milestone is queued and the earlier due ones are written as `skipped`, so a stale "7 days" message never follows a "3 days" one.

Eligibility:
- D-k reminders: only while `trialing` and before `endsAt`.
- D0: only during `grace`.
- `active_paid` and `activation_pending`: no reminders.

Row statuses and how each is reached:

| Status | How a row gets there |
|---|---|
| `queued` | The advance transaction decided the milestone is due. |
| `sending` | The claim transaction leased the row: `attempts + 1`, lease of 5 minutes. |
| `sent` | The transport said "accepted". |
| `retry` | A **definite** rejection that can be retried. Backoff is 30 minutes, with at most 5 attempts. |
| `failed` | A definite non-retryable rejection, or `max_attempts` reached. |
| `delivery_unknown` | The transport threw, or the lease lapsed while sending. **Never resent.** A late "accepted" from the same attempt is reconciled to `sent`. |
| `blocked` | No server-authoritative recipient. Fails closed (§4). |
| `cancelled` | The tenant was paid at send time, or the milestone is no longer true (`stale`). |
| `skipped` | Superseded by a later milestone, or past its window. |

No email address is ever stored. Rows hold reason codes only.

### 3.4 In-app notice

`tenants/{t}/notifications/trial-reminder-{milestone}` uses the existing bell shape:

```
{type:'trial_reminder', title, body, bookingId:null, read:false, createdAt, milestone, ctaLabel:'Choose a plan', ctaPath:'/app/billing'}
```

It is created in the queue transaction, so it lands exactly once even when email is blocked or unconfigured. A forged document with the reserved id (tenant members can create notifications) is detected by a read; the row records `inApp:'preexisting'` and the job is never stalled.

### 3.5 Audit: `tenantBilling/{t}/trialAudit/{id}`

Ids are deterministic, so duplicates are impossible: `transition-v{n}`, `reminder-{m}-{status}`, `reminder-{m}-{status}-a{attempt}`.

Fields are `{type, from, to, milestone, status, reasonCode, effectiveAt, recordedAt, actor ('system:activation' | 'system:trial-lifecycle'), runId, stateVersion}`. The audit carries **no PII**: no email, no name, no token. A test asserts that no `@` appears.

### 3.6 Transition semantics (C)

- `trialing → grace` happens at `endsAt` and `grace → suspended` at `graceEndsAt`. Both boundaries are inclusive and pinned by tests and a mutation.
- If the job first runs after `graceEndsAt`, it applies both steps in one transaction and writes two audit rows.
- `active_paid` and `suspended` are **never** moved by the job. Resume is Phase F's job.
- An unknown state is a no-op that fails closed.
- Every decision is re-made inside a transaction from the stored documents. Running the job twice, concurrently, or after a crash produces no duplicates (tested).
- The job **never writes the tenant root**, never touches Auth, claims or passwords, and never deletes data.

---

## 4. Email recipient: decision

**Decision (Phase 1): the only recipient is the Auth email of the `ownerUid` frozen into the billing document at activation.** It is used only while all of the following hold:

- `tenants/{t}/staff/{ownerUid}` still has `role:'owner'`. That document is writable by the Admin SDK and super-admin only.
- Its `accessStatus` is active or absent.
- The Auth user exists.
- The Auth user is not disabled.
- The Auth user's email is present and `emailVerified === true`. Activation sets this for new-password owners.

If any condition fails, the row becomes `blocked` with `recipient_<reason>` and the transport is not called. A failed **lookup** (an Auth or Firestore error) is retryable, because nothing has been sent at that point.

Client-writable sources are **never** consulted: root `ownerEmail`/`ownerUID`, `barbers.email` and settings. Mutation E03 proves this: switching to root `ownerEmail` fails the suite.

**Real email delivery is still BLOCKED (not wired).** The code path is complete with an injected transport, but no production transport exists in the code. Static tests prove that the lifecycle sources import no `emails/`, `https`, nodemailer, Brevo, `process.env` or secret. Wiring needs all three of the following:
1. A Brevo transport adapter that returns `accepted`, `rejected{retryable}` or throws (ambiguous). It must map Brevo's 2xx/4xx/5xx strictly, and a timeout must count as ambiguous.
2. The `/app/billing` CTA destination (Phase E).
3. Owner approval of the email classification below.

**Classification (proposed, needs owner/legal confirmation):** trial reminders are **service messages to the account holder** about their own contract. They are not marketing, so:
- the customer `emailOptOut` / marketing unsubscribe does not apply;
- they carry no `List-Unsubscribe` header;
- the footer states why the message was sent and gives the support address (`info@salown.com`).

They carry no promotional content.

---

## 5. Phase 1 evidence

| Gate | Result |
|---|---|
| functions `tsc --noEmit` | clean |
| functions `npm test` (isolated archive with `whitecross-site` sibling) | 3437 tests · 3380 pass · 0 fail · 57 skipped (emulator-only) |
| onboarding unit suites | 58 tests · 57 pass · 1 skipped (emulator placeholder) |
| onboarding emulator suites (Firestore + Auth emulators) | 35/35 |
| canonical `npm run test:emulator` (isolated archive, alternate ports) | 859/859 PASS (general 832 · packages 27), firebase-tools 15.26.0 · emulator v1.22.0 |
| mutation gate `--with-emulator` | 17 mutations · 17 killed · 0 survived · 0 stale |

What the tests cover, mapped to the owner's test list:

- **The trial starts once, at activation; approval and resend start nothing.** `approval (issue + resend) never starts a trial…`; finalize test; M02, M03, E01.
- **A retry never changes dates.** `finalize retry keeps every timestamp…`; `re-running activation finalize … never touches the billing doc`; the stray-billing fail-closed test.
- **An existing account is not disabled.** `the owner Auth account is never disabled, re-passworded or re-claimed…`: disabled, passwordHash, claims and tokensValidAfterTime are unchanged through suspension.
- **Each milestone is queued at most once, and double runs create no duplicates.** The timeline runs every checkpoint twice; three concurrent sweeps produce one email; M04 and E02.
- **A paid tenant is unaffected.** Unit and emulator paid tests; M01, M07.
- **30 days for a new activation; legacy is unchanged.** Policy tests and M14; the legacy tenant with a past `trialEndsAt` is never selected, written or created.
- **Trial → grace → suspended.** Boundary tests and M11.
- **Timezone and DST.** London fall-back, spring gap, ambiguous overlap, Istanbul, Sydney, invalid zone; M12; emulator DST boundary.
- **Recipient missing means fail-closed, with no wrong recipient.** Five fail-closed emulator cases plus the attacker `ownerEmail` test; M08, M09, E03.
- **No production transport.** Static scan; the transport is injected only.

---

## 6. Known limits of Phase 1 (by design)

- The billing document is created only by the new invite activation, which is **not wired to a callable** yet (S3d). Until S3d/S5 go live, live approvals still use the legacy 90-day path (`approveApplication`/`provisionTenant`, super-admin create), and those tenants are legacy. Removing those 90-day writers is already on the S3/S5 list.
- Self-signup (`provisionTenant`) creates no billing document. The provisioning moment is its activation (`initialSelfSignupState`). Wiring it is a separate slice.
- `grace` and `suspended` live **only** in the billing document. Projecting them onto the tenant root and enforcing them is Phase D. Writing a new `lifecycle` value today would immediately lock the owner out, because the live rules fail closed on unknown values. That contradicts decision 8.
- In-app notices are visible to every tenant member who sees the bell, staff included. Owner-only targeting is part of E.

---

## 7. Wiring step (after approval, before D): `ONB-P1-WIRE`

1. Export `salownTrialLifecycleSweep` (v2 `onSchedule`). Schedule: `every 15 minutes`, `Europe/London`, `maxInstances: 1`, `retryCount: 0`. It calls `runTrialLifecycleSweep(db, {auth: authUserReader(getAuth()), transport, newAttemptId}, Date.now(), runId)`. The transport is `null` until the Brevo adapter is approved, so in-app notices land and email rows wait in `queued`.
2. Add an ownership manifest entry and a targeted deploy through `scripts/deploy-functions.sh`.
3. No index is needed: two single-field range queries on `tenantBilling`.
4. Acceptance:
   - the deployed zip carries a source marker;
   - the first runs log `tenants=0` (production has no billing documents);
   - no write to any legacy tenant (`updateTime` of all 9 roots unchanged).

---

## 8. Phase D: enforcement (spec)

**Goal:** make `grace` and `suspended` real everywhere, without touching legacy tenants.

**D-1. Root projection.** In the same transaction as each billing transition, write the tenant root:
- `billingState` (a mirror of `state`);
- `lifecycle`: `grace` → `TRIAL_GRACE`, `suspended` → `SUSPENDED`, `active_paid` → `SUBSCRIBED`;
- `status`: `grace` → `'trial_grace'`, `suspended` → `'suspended'`, `active_paid` → `'active'`.

Only tenants with a billing document are projected.

**D-2. Lock the fields (decision 11; also closes the S8 finding).**
- Add `status`, `plan`, `trialEndsAt`, `billingState`, `subscription`, `stripeCustomerId`, `features` and `limitsOverride` to the rules' protected tenant-root keys on **create and update**. The open question for the first three is whether super-admin still writes them.
- `firestore.rules` changes go out last, after the functions release.
- Super-admin `Tenants.jsx` writes go through a super-admin callable or stay with the super-admin rules arm.

**D-3. Rules access matrix.** `tenantLifecycleActive` accepts `TRIAL_GRACE` (full owner and staff access: bookings stay manageable). `SUSPENDED` gets a new helper, `isSuspendedOwner(t)`:
- **read** access to the root, `settings/settings` (billing and presentation), and the data-export sources the export callable needs (or nothing, if export is server-side);
- **no** writes anywhere;
- staff get nothing.

The rules emulator matrix must assert each cell.

**D-4. Callables.**
- `lifecycleGrantsTenantAccess` gains `TRIAL_GRACE` (allowed) and `SUSPENDED` (refused, except on an explicit allowlist: billing checkout/portal, export, support).
- `tenantClaimGate` refuses `SUSPENDED` (no new claims). Existing claims are **not** revoked, because rules and callables refuse on the lifecycle anyway; decision 12 forbids disabling accounts.

**D-5. Public booking.**
- `createBookingCore` reads `billingState` / `lifecycle` from the root it already reads in the transaction, and refuses `TENANT_NOT_ACCEPTING_BOOKINGS` for `TRIAL_GRACE` and `SUSPENDED`.
- The rules anonymous-create branch gains `tenantAcceptsPublicBookings(t)`: a root `get()`, true for legacy, `ACCOUNT_ACTIVATED`, `TRIAL_ACTIVE` and `SUBSCRIBED`.
- `salownCreateCheckoutSession` refuses the same states.
- The public booking page shows a neutral "online booking is unavailable" state (no reason disclosed).

**Dependencies:**
- `ONB-P1-WIRE` must be live.
- K4 (public booking/checkout accepting non-active tenants) is subsumed by D-5.
- The live-lineage rule: build from the deployed lineage for each function.

**Acceptance tests:**
- A rules emulator matrix covering legacy, ACTIVE, TRIAL_ACTIVE, TRIAL_GRACE, SUSPENDED and SUBSCRIBED, for owner, admin, staff and anonymous: root/settings/bookings/clients read and write, anonymous booking create.
- Callable gate tests per group.
- A `createBookingCore` refusal before any write.
- A static scan confirming every booking writer reads the gate.
- A legacy-unchanged matrix.
- Mutations on each gate.
- A batch-cost measurement (the extra root `get()`).

## 9. Phase E: restricted shell (spec)

**E-1.** Add a router gate in the Admin app. It reads root `billingState`/`lifecycle` (already public):
- `TRIAL_GRACE` → full app plus a persistent, non-dismissable banner: "Your trial has ended — choose a plan. New online bookings are paused." with the CTA "Choose a plan" leading to `/app/billing`.
- `SUSPENDED` → only `/app/billing`, `/app/export` and `/app/support`. Every other route redirects to `/app/billing`.

**E-2.** The Staff app shows a "This salon's account is paused" screen for SUSPENDED, with no data.

**E-3.** `/app/export`: a server-side export callable for the owner only (allowed in SUSPENDED). It produces CSV/JSON of clients, bookings and services, using the existing `salownExport…` shapes if present, and is rate-limited.

**E-4.** `/app/support`: a mailto link and the live chat entry.

**E-5.** Trialing tenants see an in-app countdown chip from D-7.

**E-6.** The bell renders `trial_reminder` with the CTA. Owner-only targeting: a `recipientRole:'owner'` field, filtered in the bell.

**Dependencies:** D-1 and D-3 (the shell must match what the rules allow).

**Acceptance:**
- Screen tests for every state.
- A route-escape test: deep links redirect for SUSPENDED.
- Staff paused screen.
- An export callable emulator test showing a suspended owner is allowed and staff are refused.
- An i18n parity test.

## 10. Phase F: Stripe subscription and automatic resume (spec)

**F-0. BLOCKER — canonical plan catalog.**
- What exists: `src/utils/planLimits.ts` prices (29/69, no currency, no Stripe price ids, frontend only) and the matching table in `TIERS_AND_UPGRADE.md`.
- These are UI constants, not a billing catalog. Phase 1 **did not invent or hard-code any price**.
- **Required before F:** an owner-approved catalog. It needs plan id, currency, interval, VAT treatment and the Stripe Price id per environment (test/live). It should be a golden fixture shared by functions and frontend, in the same way as `businessTypeCatalog.json`. Checkout reads the price id from the catalog only.

**F-1.** `salownCreateBillingCheckout` (owner only, allowed in grace and suspended):
- Stripe Checkout `mode:'subscription'` on the **platform** account. This is Stripe Billing, not Connect.
- A customer is created once per tenant and stored as `tenantBilling/{t}.stripeCustomerId`.
- `client_reference_id = tenantId`.
- Idempotency key `checkout:{tenantId}:{planId}:{stateVersion}`.

**F-2.** `salownBillingWebhook`:
- The signature is verified with a **new** secret, separate from the Connect webhook.
- It handles:
  - `checkout.session.completed`;
  - `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`;
  - `invoice.paid`;
  - `invoice.payment_failed`.
- Event-id dedup: `tenantBilling/{t}/stripeEvents/{eventId}`.
- One transaction:
  - `trialing | grace | suspended → active_paid` on an active or trialing subscription;
  - `subscription` snapshot `{id, status, priceId, currentPeriodEnd}`;
  - audit row;
  - root projection (D-1).

  This is the **automatic resume** (decision 10).
- Cancellation or unpaid status → `active_paid → grace`. This is a payment-driven path, not the job, so it does not conflict with "a paid tenant is never moved by the job". The grace window starts at the event time.

**F-3.** A customer portal link, owner only.

**Dependencies:**
- F-0 (catalog).
- D-1 (projection).
- E-1 (`/app/billing`).
- New secrets (`STRIPE_BILLING_WEBHOOK_SECRET`; the platform `STRIPE_SECRET_KEY` already exists) added to the outbound guard list.
- Test mode first.

**Acceptance:**
- Stripe CLI fixtures for each event, with a replay of the same event id (no double transition).
- Out-of-order events (`subscription.updated` before `checkout.session.completed`).
- A paid tenant is never touched by the sweep (already proven in Phase 1).
- Suspended → paid restores full access, verified with the D rules matrix.
- No price literal in the code (static scan against the catalog).

---

## 11. Open items (owner)

1. **Email classification:** confirm reminders as service messages with no unsubscribe (§4).
2. **Plan catalog (F-0 blocker):** prices, currency, VAT and Stripe price ids.
3. **`/app/billing` route:** the CTA destination is declared, not built (E-1).
4. **Who may still write `status`/`plan`/`trialEndsAt` after D-2:** super-admin only, or callable only?
5. **Legacy tenants:** they stay outside the lifecycle (decision 5). The one legacy `status:'trial'` tenant with a past `trialEndsAt` is not touched. If the owner wants legacy tenants moved, that needs its own approved migration.
6. **Wiring order:** `ONB-P1-WIRE` (job with `transport:null`) can go live before D. Real email waits for the Brevo adapter, E-1 and item 1.
