# BOOKING_SECURITY_POLICY_MIGRATION.md — authoritative parent plan

> **Status:** 🔵 Planned — coordination artifact, no code yet (2026-07-24).
> **Role:** the **single authoritative plan** that merges two previously separate work streams —
> the **B2 booking-settings / authoritative-createBooking** design and the **UK phone-identity +
> public-booking-linking** handoff — into one migration with one target architecture, one
> dependency order, and bounded child packages.
> **Supersedes as the merge point:** the B2 planning artifact `~/.claude/plans/purrfect-conjuring-dove.md`
> and the identity handoff `HANDOFF_uk_phone_identity.md`. Those remain the detailed source material;
> **this file is the contract** when the two disagree (they are reconciled below).
> **ROADMAP anchors:** `B2` (dynamic booking settings), `B3` (`salownCreateBooking` transactional),
> `B4` (phone country-code standardization). **Invariant anchors:** `INV-SEC-1`, `INV-MATCH-4/7`,
> `INV-BK-6`, `INV-PARA-3`. **Security anchors:** `SECURITY.md` G3 (public-create forge), G5 (blast radius).
> **This plan authorizes no deploy.** Every deploy is separately owner-gated per `INV-SEC-4`
> (functions → hosting → **rules LAST**).

---

## 0. ID namespace warning (read first)

The child-package IDs in this document — **I1, I2, P1, C1, H1, W1, R1, U1, S1, E1** — are **local to
this migration plan**. They are **NOT** the ROADMAP work-area IDs and collide with them by letter:

| This plan | Do **not** confuse with ROADMAP |
|---|---|
| `I1` phone-identity-foundation | ROADMAP `I1` = parser silent-breakage canary (✅ done) |
| `H1` hosted-booking-cutover | ROADMAP `H1` = onboarding/parser item |
| `S1` staff-app-booking-parity | ROADMAP `S1` = staffComp financial protection (✅ live) |
| `P1` booking-policy-contract | ROADMAP has no `P1`; `P0` = a security grouping |

Whenever this plan touches company-roadmap tracking it cites the **ROADMAP** ID explicitly (`B2`, `B3`,
`B4`, `L1`, `Gate-G5`, `INV-…`). Treat a bare `I1`/`H1`/`S1` inside this file as a **migration package**,
never a ROADMAP row. If these packages are ever promoted onto ROADMAP, give them fresh unambiguous IDs
(e.g. `B2-*`/`B3-*`) at that time.

---

## 1. Why one plan (the problem the merge solves)

Two designs were drafted independently and **overlap on the same code path**:

- **B2** wants booking *rules* (overrun allowance, slot interval, lead time, max-advance, same-day) to
  become tenant-dynamic and, crucially, to be **enforced by an authoritative server callable** instead
  of the browser — because today public booking creation is a **direct client `addDoc`**
  (`BookingPage.tsx:659`) gated only by Firestore rules (`INV-SEC-1`, `SECURITY.md` G3).
- **Identity** wants public website bookings to be **linked server-side** to the resolved existing
  client via `clientManualId`, which requires the *same* trusted server write path and closes the
  *same* create-side rules gap (`clientManualId`/`matchedBy` are currently forgeable on public create).

They are the **same architectural move**: stop trusting the browser to create trusted booking data.
Shipping them separately would build the server create path twice, or ship identity linking onto the
still-untrusted direct-create path (leaving the forge open). Hence **one callable, one cutover, one
rules tightening** — sequenced so identity foundation lands first and the anonymous-create denial lands
last.

---

## 2. Target architecture (authoritative)

```
  BookingPage (hosted SPA)            Premium website (whitecross-site, separate repo)
            │                                    │
            │  customer-entered info +           │  customer-entered info +
            │  selected IDs ONLY                 │  selected IDs ONLY
            ▼                                    ▼
  ┌───────────────────────────────────────────────────────────────┐
  │  salownCreateBooking  — authoritative callable (europe-west2)  │
  │                                                                │
  │  1. booking-policy validation  (pure resolver/validator)       │
  │       nested bookingSettings → legacy flat field → platform    │
  │       default;  own-property checks (0/false respected)        │
  │  2. server identity resolution  (trusted Firestore records)    │
  │       clientManualId → phone/email → _aliases → canonicalPhone │
  │       → (NEVER name-only for public linking)                   │
  │  3. transactional trusted booking creation                     │
  │       recompute service/duration/price/start-end server-side;  │
  │       SLOT_CONFLICT check inside a Firestore transaction;       │
  │       stamp server-owned link + provenance + audit fields      │
  └───────────────────────────────────────────────────────────────┘
            │                                    ▲
            │ writes PENDING (+expiresAt) when   │  finalize payment state ONLY,
            │ stripe on, else CONFIRMED          │  idempotently (no booking authority)
            ▼                                    │
     Firestore  bookings/{id}   ◄───────  salownConnectWebhook (Stripe)
```

**Load-bearing statements of the architecture:**

- **The callable is the only authority.** Frontend validation (hosted + premium) is **advisory UX**;
  it can never authorize a booking. Anything the browser sends that is trust-sensitive
  (`duration`, `price`, `service` name, `startTime/endTime`, `status`, payment fields, identity
  metadata) is **recomputed or discarded** server-side.
- **Stripe webhook finalizes payment state only, idempotently.** It flips `PENDING→CONFIRMED` and
  reflects refunds; it **does not create bookings and does not own identity linking authority**. Writing
  the same state twice is a no-op — and note the house gotcha (`§9.4` of the handoff): an identical-value
  Firestore write **fires no update trigger**, so assert idempotency by **final document state**, never
  by trigger count.
- **Rules are the outer boundary.** Public input is constrained by Firestore rules; the callable (Admin
  SDK) bypasses rules and is the trusted writer. `checkoutBooking` (client-side, admin panel) is a
  **data-correctness** control, **not** an authorization boundary — do not describe it as security.

---

## 3. Locked decisions (the contract — 22 items)

These are **fixed** for this migration. Where a locked decision **diverges from the source B2 plan**, the
divergence is called out — this file wins.

1. **Nested `bookingSettings` with legacy read-through.** New B2 policy fields live under
   `settings/settings.bookingSettings` (extend the existing doc — do **not** open a new collection, per
   ROADMAP `B2` house rule and `FIRESTORE_SCHEMA` `settings/settings`).
2. **Existing flat `cancellationWindowHours` / `rescheduleWindowHours` / deposit fields are not moved,
   renamed, or backfilled.** They stay flat and authoritative for cancel/reschedule windows.
3. **Missing values preserve current behavior; explicit `0`/`false` are respected.** Resolution uses
   own-property checks (`Object.prototype.hasOwnProperty`), never truthiness.
4. **Raw explicit `null` on input is invalid** → `INVALID_INPUT`. But a **normalized absent**
   `maximumAdvanceDays` may resolve to `null`/unbounded. (Refines the B2 default `maximumAdvanceDays:null`:
   *absent* ⇒ unbounded; *explicit input `null`* ⇒ rejected. Absence and explicit-null are different.)
5. **`shiftOverrunAllowanceMins`: `0` = strict fit, `> 0` = bounded overrun** (default `15`, `INV-BK-6`).
6. **`serviceFitPolicy` is REMOVED from the B2 field set** — it duplicates allowance semantics
   (`allowance == 0` already means strict; `> 0` means bounded overrun). **⚠️ Divergence from
   `purrfect-conjuring-dove.md` §3**, which listed `serviceFitPolicy: 'allowOverrun' | 'strict'`. Do
   **not** implement that field; the allowance minutes are the single control.
7. **No location field/collection now.** The resolver is *designed* with a future location-override
   layer (`future location → tenant bookingSettings → legacy flat → platform default`) but that layer is
   **inert** — no location field is invented, read, or written in this migration.
8. **`salownCreateBooking` is authoritative** (ROADMAP `B3`).
9. **Frontend validation is advisory only** (hosted + premium).
10. **`@salown/shared` stays type-only** (`packages/shared/src/index.ts` "NO runtime code"). Types only:
    `BookingSettings`, `BookingDecision`, `ReasonCode`, identity `matchedBy` union.
11. **Pure frontend + Functions implementations share one set of golden fixtures and a mandatory parity
    test** that fails on any output drift (byte-identical defaults + identical decisions + reason codes).
12. **`SLOT_CONFLICT` is outside the pure resolver** — it requires reading other bookings transactionally,
    so it belongs to **C1** (transactional server validation), not P1's pure validator.
13. **Public identity linking must never use name-only fallback.** `INV-MATCH-4`'s name-only step is a
    **last resort for admin/staff in-memory matching only**; the public/server link path stops at
    phone/email/`_aliases`/canonicalPhone. No contact ⇒ unlinked (never name-guessed).
14. **Public input must not accept** `clientManualId`, `matchedBy`, identity metadata
    (`identityLinkedBy`/`identityLinkedAt`), trusted `price`, `duration`, `status`, or payment fields.
    Enforced in **rules** (R1) **and** the callable (C1) — not by convention.
15. **Public success screen keeps the entered first name** (`BookingPage.tsx:802,1026` — verify, don't
    rewrite).
16. **Canonical client name is read live from the linked client document** in admin/staff UI (U1). The
    booking's `clientName` stays a **snapshot** of what the customer typed and is never overwritten.
17. **`redemptionKey` must not be changed or migrated** (handoff Trap 2). It uses last-10 (`p_7700900123`),
    is **persisted** in redemption records, and its frontend mirror (`src/utils/discountCodes.js`) stays
    byte-identical. `canonicalPhone` is a **separate** helper; do not unify them.
18. **Anonymous direct booking `create` is denied only after** hosted (H1) **and** premium (W1) cutovers
    **plus** payment E2E (E1). Until then the direct-create path stays open (migration coexistence).
19. **No production backfill.** No writes to any tenant's live data as part of this migration. (Any B1
    canonical-field backfill script — see I2 — is dry-run-only here; `--apply` needs separate owner sign-off
    and is not part of the migration cutover.)
20. **Whitecross and HeroHairs are the fixed regression tenants.** Behavior must be byte-for-byte
    equivalent for both while `bookingSettings` is absent (both run entirely on defaults today).
21. **Rules tests reuse the existing `docs/test-firestore-rules.py` harness** (Firebase Rules Test API,
    no emulator/Java) **unless evidence proves another harness is required**; if so, record the evidence.
22. **Minimal audit now.** On booking-rule save, write a redacted before/after `auditLogs` entry via the
    existing settings-edit trigger. **Expanded settings audit/history is a separate package** (out of scope;
    tracked separately, cf. `AUDIT_TRAIL_PLAN.md`).

**Regression anchor (mandatory golden vector):** `whitecross/barber-1777257519766` (Alex),
`shiftChanges["2026-07-23"] = {open 09:00, close 20:00}` (one hour past salon close). A 30-min service may
start **19:45** (ends 20:15 ≤ 20:00 + 15) but a **20:00** start (ends 20:30) is **rejected**
(`OUTSIDE_EFFECTIVE_SHIFT`). This exact case must pass identically before and after.

---

## 4. Shared decision model (produced by P1, consumed by C1)

```ts
{ allowed: boolean, reason: ReasonCode,
  effectiveShiftEnd?: string, allowanceMins?: number, calculatedEnd?: string }
```
**Reason codes (stable, machine-readable — never UI strings):**
`ALLOWED · OUTSIDE_EFFECTIVE_SHIFT · MINIMUM_NOTICE_NOT_MET · MAXIMUM_ADVANCE_EXCEEDED ·
SAME_DAY_DISABLED · INVALID_SLOT_INTERVAL · STAFF_UNAVAILABLE · SERVICE_UNAVAILABLE · SLOT_CONFLICT ·
INVALID_INPUT`. `SLOT_CONFLICT` is emitted **only** by C1's transactional layer, never by the pure
resolver (decision 12).

**Identity match reason (produced by I1, persisted by C1):**
`matchedBy ∈ { 'manual_id' | 'email' | 'phone' | 'email_and_phone' | null }`. `email_and_phone` =
both independently resolve to the **same** client (strongest). Email→A while phone→B is a **conflict**,
not a match: leave unlinked, log to `auditLogs`, **do not block checkout**.

---

## 5. Child packages — bounded, in dependency order

Order is the task-specified chain **I1 → I2 → P1 → C1 → H1 → W1 → R1 → U1 → S1 → E1**. True dependency
edges are stated per package (some can parallelize once their inputs exist). Every package: **commit only
its own files by explicit path** (multi-session repo), log to `salown-app/SYNC.md` + `edit_log_salown.md`,
**no deploy without owner gate**.

---

### I1 — phone-identity-foundation
- **Scope:** one canonical UK phone helper + the Class-A in-memory matchers + the `matchedBy` match-reason
  + the **server-side** identity resolver used by C1. Add the new `canonicalPhone` rule to
  `NORMALIZATION.md` (new row in the Normalize Helpers table; today's canonical is "last 10 digits").
  Rewrite the identity tests that currently **encode the bug as intended** and update the file's BEHAVIOR
  PARITY header to record the intentional divergence (owner approval granted, handoff §4 Trap 1).
- **canonical rule (single source, backend + frontend):** strip non-digits (drop leading `+`);
  `00…→…`; `0`+10→`44`+rest; `44`+10→unchanged; else digits as-is; **return `''` if < 7 digits**
  (too weak to match). Must collapse the five equivalent Alexandre formats; must **not** collapse
  different numbers sharing a suffix, short/garbage, empty, or letters (`O7700900I23`).
- **Explicit exclusions:** **NOT** `redemptionKey`/`discountCodes.js` (decision 17 — leave byte-identical;
  if touched, add a comment saying why it is deliberately not migrated). **NOT** the Class-B equality
  queries (that is I2). **NOT** non-UK international numbering (note the limitation in the helper doc
  comment; no libphonenumber). **NOT** name-only public linking (decision 13).
- **Likely file ownership:** `packages/shared/src/` (new `canonicalPhone` — type-only rule lives in shared,
  runtime helper co-located per house pattern), `functions/src/clients/identity.ts` (+ `identity.test.js`),
  `src/utils/audienceUtils.ts`, `src/firestoreActions.ts` (the `normPhone` fallback **scan** only, not the
  equality queries), `src/pages/Clients.tsx` (`matchManual`/`nameMatch` comparisons), `docs/NORMALIZATION.md`.
- **Dependencies:** none (foundation). Blocks I2, C1, U1, S1.
- **Tests:** table-driven equivalence (both directions: stored `0…`+probe `+44…` and vice-versa);
  non-matches; `matchesClient` same-phone/diff-email/diff-name ⇒ true; `resolveClientDocId` same-phone/
  diff-email ⇒ existing id, never new doc; **backend↔frontend parity test** across the whole format table.
- **Commit boundary:** identity helper + matchers + tests + `NORMALIZATION.md` in one logical commit
  (explicit paths; `NORMALIZATION.md` is a separate git repo — commit **and push** there).
- **Deploy boundary:** **no deploy** (functions change ships only with C1's controlled deploy, or its own
  owner-gated functions deploy if landed alone).
- **Acceptance criteria:** same phone + different email ⇒ matches existing client, **no duplicate**;
  canonical name never overwritten by a booking name; `clientName` stays a snapshot; last-4 never used
  alone (`INV-MATCH-7`); parity test green.
- **Rollback gate:** if the parity test cannot be made green, or before/after visit-count diff on live
  `whitecross` changes for any client already sharing one phone format, **stop** — the normalizer is
  wrong; revert (helper is additive, revert is clean).

---

### I2 — legacy-query-compliance
- **Scope:** make the **Class-B Firestore equality queries** (`where('phone'|'clientPhone','==',…)`)
  format-tolerant so a `0…` vs `+44…` mismatch stops silently returning zero rows. **Pick ONE strategy
  and apply it to all seven sites** (state the choice in the diff): **B1** persisted canonical field
  (`phoneCanonical`/`clientPhoneCanonical`, written at every write site, queried on, dry-run-first
  backfill script under `scripts/`) — recommended, permanent; or **B2-fanout** one exported variant
  helper (`0…`/`+44…`/`44…`) routed through all seven sites — no migration, but every future site must
  remember. **⚠️ this "B2" is the fan-out strategy name, unrelated to ROADMAP `B2` booking-settings.**
- **Explicit exclusions:** no `--apply` of any backfill in this migration (decision 19 — dry-run output
  only, `--apply` is a separate owner-gated step). No new query call-sites beyond the seven listed.
- **Likely file ownership (the seven sites):** `src/firestoreActions.ts:74,243`,
  `src/components/BookingDetailPanel.tsx:592`, `src/staff/sheets/ClientDetailSheet.tsx:75`,
  `src/pages/Clients.tsx:463,475,480`, `src/pages/Settings.tsx:672-673`; + `scripts/` backfill (B1 only,
  house pattern `scripts/backfillPublicBooking.cjs`, dry-run default).
- **Dependencies:** **I1** (canonical helper). Blocks nothing hard, but S1's `ClientDetailSheet` query and
  the GDPR-erasure/delete sites should land here.
- **Tests:** `getClientLoyaltyPoints('+447429416291') ⇒ 25` (chosen strategy); delete/GDPR-erase leaves
  **no** orphan when stored format differs; the four real Alexandre bookings collapse to `visits: 4`.
- **Commit boundary:** all seven sites + helper/field + (B1) dry-run script in one strategy-coherent commit;
  include the **dry-run output** in the deliverable.
- **Deploy boundary:** **no deploy** (hosting rides the normal pipeline later; backfill never auto-runs).
- **Acceptance criteria:** GDPR erasure and client-delete are **complete** across phone formats; loyalty/
  visit/history queries return the returning customer; no strategy left half-applied.
- **Rollback gate:** if B1 backfill dry-run shows any unexpected collapse (two people merging), **stop** —
  do not `--apply`; re-examine canonicalization (ties back to I1).

---

### P1 — booking-policy-contract
- **Scope:** the **pure** resolver + validator, **duplicated** frontend + Functions, plus the shared
  golden fixtures and the parity test; and the type contract in `@salown/shared`. Resolver precedence:
  `future location (inert) → tenant bookingSettings → legacy flat field → platform default`, own-property
  checks. Platform defaults centralized **once**: `shiftOverrunAllowanceMins:15, slotIntervalMins:15,
  minimumLeadTimeMins:30, maximumAdvanceDays:null(absent⇒unbounded), sameDayBookingEnabled:true`
  (**no `serviceFitPolicy`**, decision 6).
- **Explicit exclusions:** **no `SLOT_CONFLICT`** (decision 12 — that is C1). No Firestore reads inside the
  resolver (takes normalized plain data, returns a decision). No `@salown/shared` runtime code (decision 10).
  No `serviceFitPolicy`. No UI. No callable.
- **Likely file ownership:** `packages/shared/src/tenant.ts` (types: `BookingSettings`/`BookingDecision`/
  `ReasonCode`), `src/utils/bookingSettings.ts` (frontend, advisory), `functions/src/utils/bookingSettings.ts`
  (CJS, authoritative), shared golden-fixtures file + parity test.
- **Dependencies:** independent of I1/I2 in code, but ordered after them. Blocks **C1**.
- **Tests:** the golden-vector matrix (absent⇒defaults; explicit `0` strict; explicit `false` same-day;
  input `null`⇒`INVALID_INPUT`; the Alex 20:00/19:45 vectors; strict-fit; salon-close-earlier-than-shift;
  closed-salon-override-open; lead-time boundary; max-advance boundary; interval-grid; exact-boundary
  ALLOWED; +1-min OUTSIDE; UK-DST/BST). **Parity test fails on any drift** between the two implementations.
- **Commit boundary:** types + both resolvers + fixtures + parity test in one commit (explicit paths).
- **Deploy boundary:** **no deploy** (pure code; ships with C1).
- **Acceptance criteria:** both implementations byte-identical defaults + identical decisions/reason codes
  across every vector; Whitecross + HeroHairs absent-settings ⇒ today's constants exactly.
- **Rollback gate:** parity drift that can't be closed ⇒ **stop**; the contract is not stable, C1 must not
  start.

---

### C1 — create-booking-callable
- **Scope:** the authoritative `salownCreateBooking` callable (`europe-west2`). Loads tenant settings,
  resolves B2 policy server-side (P1 validator), **resolves service + staff from trusted Firestore records**
  (recompute `service`/`duration`/`price`/`startTime`/`endTime` — never trust client), **resolves client
  identity server-side** (I1 resolver, no name-only), performs the **transactional `SLOT_CONFLICT`** check,
  stamps **server-owned** fields (`clientManualId`, `matchedBy`, `identityLinkedBy:'server'`,
  `identityLinkedAt`, `createdBy`, `bookingId`, `source`, timestamps), is **idempotent** under retry /
  Stripe return, and preserves unpaid/deposit/full-payment behavior (PENDING+`expiresAt` when stripe on,
  else CONFIRMED; amount computed server-side). Also **thread resolved overrun/window values into the
  existing reschedule/cancel guards**, killing the hardcoded `15` at `functions/src/index.ts:1378`.
- **Explicit exclusions:** does **not** flip Firestore rules (that is R1). Does **not** cut over the
  websites (H1/W1). Does **not** invent a location field (decision 7). Does **not** move the flat
  cancel/reschedule fields (decision 2). Stripe webhook keeps **payment-only** authority (decision:
  webhook finalizes idempotently, does not create/own-link).
- **Likely file ownership:** `functions/src/index.ts` (new callable + reschedule-guard value thread),
  `functions/src/utils/bookingSettings.ts` (consume P1), `functions/src/clients/identity.ts` (consume I1
  resolver), functions tests.
- **Dependencies:** **P1** (validator) **+ I1** (identity resolver). Blocks H1/W1/E1.
- **Tests (functions, `cd functions && npm test`, node:test; harness = Admin-SDK/functions tests, **not**
  the rules harness):** trusted-field recompute (client-sent `price`/`duration` ignored); transactional
  double-book ⇒ `SLOT_CONFLICT`; **idempotent** retry/webhook replay ⇒ one booking (assert by final state,
  not trigger count); server writes all four link fields (rules bypassed); entered-name≠canonical ⇒ links,
  canonical untouched; diff-email/same-phone ⇒ links, no duplicate; email→A/phone→B ⇒ **unlinked**, conflict
  logged, checkout not blocked; no-contact ⇒ unlinked, no crash.
- **Commit boundary:** callable + guard thread + tests in one commit; **no rules, no UI, no site**.
- **Deploy boundary:** **no deploy on its own** — the callable may exist server-side unused until H1/W1
  cut over; any functions deploy is owner-gated (functions first in the order).
- **Acceptance criteria:** callable produces bookings byte-equivalent to today's direct-create for
  Whitecross + HeroHairs default inputs; forged trusted/identity fields are ignored/recomputed;
  idempotency proven by final-state assertion.
- **Rollback gate:** any idempotency or SLOT_CONFLICT test failure ⇒ **stop**; do not let H1/W1 point at a
  non-idempotent callable (double-booking / duplicate-charge risk).

---

### H1 — hosted-booking-cutover — ✅ IMPLEMENTED 2026-07-24 (`9480185`), **NOT deployed**
> Implemented: `src/pages/BookingPage.tsx` + new `src/utils/hostedBooking.ts` (payload allowlist, idempotency
> lifecycle, reason→copy mapping, submitter) + `src/utils/hostedBookingCutover.ts`
> (`HOSTED_BOOKING_CREATE_MODE`, the single reviewable rollback switch, default `'callable'`) +
> `src/utils/hostedBooking.test.ts` (34 tests). Legacy direct-create preserved but reachable ONLY through
> that build-time switch — no rejection, permission error, server error or network timeout falls back to it.
> Advisory constants swapped for the P1 resolver **in `BookingPage` only**; the admin/staff advisory
> call-sites (`BookingForm`, `WalkInForm`, `BookingDetailPanel`, `staffAvailability`) and the
> `ManageBooking.tsx:352,372` cutoff copy are **still on the constants** and remain open H1 follow-ups.
> Deploy gate: `salownRescheduleByToken` targeted functions deploy must land FIRST (it still runs the
> hardcoded 15). See `DEPLOYMENT_STATUS.md`.

- **Scope:** `BookingPage.tsx` (hosted SPA) creates via `salownCreateBooking` **instead of** `addDoc`;
  swap the advisory constants (`15`/`30`/interval) for **resolved** values across the advisory call-sites;
  fix stale customer-facing cutoff copy in `ManageBooking.tsx:352,372`. Direct-create path **stays allowed**
  during coexistence (decision 18).
- **Explicit exclusions:** does **not** deny anonymous create (R1). Does **not** touch premium site (W1).
  Frontend stays advisory (decision 9). Success screen unchanged beyond verifying entered-first-name
  (decision 15).
- **Likely file ownership:** `src/pages/BookingPage.tsx`, `src/components/BookingForm.tsx`,
  `src/components/WalkInForm.tsx`, `src/components/BookingDetailPanel.tsx` (advisory reschedule value),
  `src/utils/staffAvailability.ts` (pass resolved `overrunAllowanceMins`/`stepMins`),
  `src/pages/ManageBooking.tsx`.
- **Dependencies:** **C1**. Parallel with W1 (both need C1; can proceed independently).
- **Tests:** hosted booking end-to-end against the callable in a test tenant; advisory values match
  resolver; the Alex 19:45/20:00 case behaves identically through the UI.
- **Commit boundary:** hosted cutover + advisory swaps in one commit (explicit paths).
- **Deploy boundary:** hosting auto-deploys on push to `salown-app` `main` — so this commit **is** a hosting
  deploy; **announce tenant + URL and get owner confirmation before merging to main** (a `main` push ships
  it live). Functions (C1) must already be deployed first (order: functions → hosting).
- **Acceptance criteria:** hosted bookings for Whitecross + HeroHairs are indistinguishable from today
  (before/after equivalence) while going through the callable; no regression in slot availability.
- **Rollback gate:** any before/after divergence for the regression tenants ⇒ revert the cutover commit
  (direct-create still present, so revert restores prior behavior instantly).

---

### W1 — premium-booking-cutover
- **Scope:** the premium website (`../whitecross-site`, **separate repo**) creates via the **same**
  `salownCreateBooking` callable and consumes the **mirrored** resolver values; `source:'Website'` payloads
  (incl. `paymentState`/`paymentType`) must keep working.
- **Explicit exclusions:** no rules change (R1). No shared-repo edits. Keep the hand-mirrored slot rule in
  sync with `salown-app` (do not let hosted/premium diverge — cf. `DEPLOYMENT_STATUS.md` cross-repo caution).
- **Likely file ownership:** `whitecross-site/script.js` (+ its booking create path), premium resolver mirror.
- **Dependencies:** **C1** (and H1 proven is strongly advised before flipping the premium tenant).
- **Tests:** premium booking end-to-end against the callable; `whitecross-site` create payload accepted;
  Stripe premium path (its own us-central1 flow) untouched.
- **Commit boundary:** premium-repo commit only (separate repo; its own explicit-path discipline).
- **Deploy boundary:** **separate manual deploy** of `whitecross-site` (premium tenant) — owner-gated,
  announce tenant + URL. Do **not** bundle with `salown-app`.
- **Acceptance criteria:** premium bookings land via the callable with identical customer-visible behavior;
  payment state still finalizes via the premium Stripe flow.
- **Rollback gate:** premium regression ⇒ revert premium commit (its direct-create path remains until R1).

---

### R1 — booking-create-rules
- **Scope:** two Firestore-rules changes, **in two gated phases**:
  **(a) reject server-owned fields on public create** — add
  `!request.resource.data.keys().hasAny(['clientManualId','matchedBy','identityLinkedBy','identityLinkedAt'])`
  to the create branch (defense-in-depth for I1/C1's link fields; the update branch is already an
  `hasOnly` allowlist — add an explicit test rather than a clause). This can land **early** (it only
  forbids fields no legitimate public client sends).
  **(b) deny anonymous direct `create`** — require callable/Admin-SDK — **gated** on H1 + W1 + E1
  (decision 18). Rules deploy **LAST** (`INV-SEC-4`).
- **Explicit exclusions:** no field-level **validation** in rules (validation lives in the callable). No
  broadening of the settings-doc rule. Do **not** branch on `source` anywhere (public-writable — handoff
  §9.3 sharp edge 1). Phase (b) must not precede its gate.
- **Likely file ownership:** `salown-app/firestore.rules` (SINGLE SOURCE), `docs/test-firestore-rules.py`
  (add cases), and the mirror doc `docs/firestore.rules.LIVE`/`.DRAFT` after deploy.
- **Dependencies:** phase (a) after **C1** (fields must be defined); phase (b) after **H1 + W1 + E1**.
- **Tests (reuse `docs/test-firestore-rules.py`, decision 21):** anonymous create + any of the four link
  fields ⇒ DENY; normal website payload (`status:PENDING`, contact, no link fields) ⇒ ALLOW;
  `whitecross-site` payload incl. `paymentState`/`paymentType` ⇒ ALLOW; public update changing any link
  field ⇒ DENY; authenticated staff create carrying a link ⇒ ALLOW; (phase b) anonymous create at all ⇒
  DENY. **Report the new total.** *Count note:* the harness header / `firestore.rules.LIVE` currently reads
  **49/49**, but the **live ruleset is at 95/95** (after the S1/staffComp deploy `1474907b`); build the new
  total from **95/95**, and fix the stale 49/49 markers as part of this package.
- **Commit boundary:** rules + harness cases together; **author only** — do not deploy in the same step.
- **Deploy boundary:** **rules deploy LAST, separately, owner-approved.** Fetch the **LIVE** ruleset from the
  API first (do not trust the file), map every affected path, keep fallbacks load-bearing (a blind rules
  edit has broken booking + settings before — `feedback_firestore_rules_safety`). Phase (b) is the single
  hard cutover of the whole migration.
- **Acceptance criteria:** forged link/identity fields impossible on public create/update; after phase (b),
  no anonymous booking write path exists and every booking flows through the callable; harness green at the
  new total.
- **Rollback gate:** phase (b) deploys **only** after E1 proves hosted+premium+payment E2E; if E1 is not
  green, phase (b) does not ship (phase (a) may still stand). Keep `firestore.rules.ROLLBACK.txt` current.

---

#### R1 phase (a) — EXACT handoff, prepared by H1 (2026-07-24)

H1 is implemented (`9480185`, not deployed). The hosted client no longer sends any server-owned field, so
phase (a) now forbids only fields **no legitimate public client sends** and can be authored immediately.

**Rejected keys on anonymous booking `create` (the exact set):**

```
clientManualId · matchedBy · identityLinkedBy · identityLinkedAt ·
clientPhoneCanonical · emailCanonical · note
```

**Rule clause** (create branch of `match /tenants/{tenantId}/bookings/{bookingId}`):

```
&& !request.resource.data.keys().hasAny([
     'clientManualId','matchedBy','identityLinkedBy','identityLinkedAt',
     'clientPhoneCanonical','emailCanonical','note'
   ])
```

**Why each key is safe to forbid on the public create branch:**

| Key | Written by | Public sender today |
|---|---|---|
| `clientManualId`, `matchedBy`, `identityLinkedBy`, `identityLinkedAt` | `salownCreateBooking` only (Admin SDK, rules bypassed) | none — H1 payload excludes them; the callable rejects them as `INVALID_INPUT` |
| `clientPhoneCanonical`, `emailCanonical` | same (stamped only on a safe identity match) | none |
| `note` | admin/staff surfaces | none — and `note` carries reserved block-time semantics (`'Busy'`, `'Quick block'` in `BookingDetailPanel`), so a public `note` could masquerade a booking as a staff block |

**Dependencies / order (all satisfied except the deploy gates):**

1. **C1 deployed** — ✅ live since 2026-07-24 (the callable is the writer of these fields).
2. **H1 payload proven clean** — ✅ pinned by tests: `hostedBooking.test.ts` asserts the 11-key allowlist and
   the absence of every key above (`note` included).
3. **W1 (premium) must be checked before deploy** — `whitecross-site` still direct-creates. Confirm its
   payload sends none of the seven keys, or phase (a) breaks premium bookings. **This is the one open
   blocker for phase (a).**
4. **Staff/admin writes are authenticated** — the clause must sit on the **public/anonymous** create branch
   only; authenticated staff create legitimately carries `note` and (via S1) identity markers.

**Rules-test additions** (`docs/test-firestore-rules.py`, build the new total from the live **95/95**, and fix
the stale 49/49 markers):

- anonymous create + each of the seven keys ⇒ **DENY** (7 cases)
- anonymous create, normal hosted payload (`status:PENDING`, contact, no forbidden keys) ⇒ **ALLOW**
- anonymous create, `whitecross-site` payload incl. `paymentState`/`paymentType` ⇒ **ALLOW**
- authenticated staff create carrying `note` + a link field ⇒ **ALLOW**
- public update changing any link field ⇒ **DENY** (the update branch is already an `hasOnly` allowlist —
  assert it rather than adding a clause)

**Deploy boundary unchanged:** rules deploy **LAST**, separately, owner-approved; fetch the LIVE ruleset from
the API first (never trust the file), keep `firestore.rules.ROLLBACK.txt` current. Phase (b) — deny anonymous
create outright — still requires **H1 + W1 + E1** green.

---

### U1 — canonical-name-admin-ui
- **Scope:** admin booking detail loads the **canonical** client name **live** from the linked client
  document (decision 16) and renders: canonical name as the heading; `Booking name: …` only when
  meaningfully different; `Matched via: …` as staff-only audit. Surface identity-conflict records for staff
  review.
- **Explicit exclusions:** do **not** copy/snapshot canonical name onto the booking; do **not** rewrite
  `clientName`; no change to the public success screen (decision 15).
- **Likely file ownership:** `src/components/BookingDetailPanel.tsx` (admin detail), possibly a small
  read-through helper. (Staff-app equivalents belong to S1.)
- **Dependencies:** **I1** (`matchedBy` persisted) and **C1** (link fields written). Pure UI read; no deploy
  authority of its own.
- **Tests:** linked booking shows canonical heading + snapshot booking-name when divergent + `Matched via`;
  conflict record renders; entered `"Alexandre "` snapshot preserved.
- **Commit boundary:** admin UI read-through in one commit.
- **Deploy boundary:** hosting (auto on `main`); owner-gated announce (ships with a hosting deploy).
- **Acceptance criteria:** staff see the real client name without the booking snapshot being mutated; audit
  (`Matched via`) visible to staff only.
- **Rollback gate:** if canonical read ever writes back to the booking (mutation), **stop** — that violates
  decision 16; revert.

---

### S1 — staff-app-booking-parity
- **Scope:** the staff app's booking/walk-in create paths reach parity with the trusted model — every
  trusted staff write **stamps the provenance marker** (`identityLinkedBy:'staff:<uid>'`) so the
  §9.3 sharp-edge-2 regression (staff walk-ins legitimately have a link and **no** contact fields) does not
  drop good links; and the staff client-history query is I2-compliant. Canonical-name read-through in the
  staff sheets (mirror of U1).
- **Explicit exclusions:** no change to the `WalkInFlow` `phone:''` contract (deliberate — client doc
  carries contact). No name-only linking. No blanket "no marker ⇒ re-verify" that would break existing
  walk-ins — treat link+no-marker+no-contact as **legacy** (accept, or one-time dry-run-first marker
  backfill; state which, decision 19 keeps `--apply` out of the migration cutover).
- **Likely file ownership:** `src/staff/flows/WalkInFlow.tsx`, `src/staff/sheets/NewBookingSheet.tsx`,
  `src/staff/.../CheckoutPanel`, `src/staff/sheets/ClientDetailSheet.tsx`.
- **Dependencies:** **I1** (+ **I2** for the history query; + C1's marker semantics).
- **Tests (functions + frontend as applicable):** staff walk-in with marker + no contact ⇒ link **still
  honoured** (regression guard); staff client history complete across phone formats; checkout
  re-verification honours marker, re-verifies unmarked-link against contact, ignores forged unmarked link.
- **Commit boundary:** staff paths in one commit (explicit `src/staff/**` paths).
- **Deploy boundary:** staff bundle build + hosting deploy (`npm run build:staff` → `hosting:salown-staff`),
  owner-gated.
- **Acceptance criteria:** no duplicate clients created from staff walk-ins on checkout; staff history and
  identity display correct; markers present on all trusted staff writes.
- **Rollback gate:** any live-data duplicate-client regression on staff checkout ⇒ revert; do not `--apply`
  a marker backfill without separate sign-off.

---

### E1 — booking-migration-e2e
- **Scope:** the end-to-end gate that authorizes the hard cutover. Verify Stripe deposit + full-payment
  flows (PENDING→CONFIRMED webhook, **idempotency** on replay), then **Whitecross smoke** + **HeroHairs
  regression**, then before/after **behavior equivalence** while `bookingSettings` is absent. This is the
  gate that unlocks **R1 phase (b)** (deny anonymous create) and the controlled deploy.
- **Explicit exclusions:** does **not** itself deploy rules (hands the green light to R1). No production
  backfill. No new features.
- **Likely file ownership:** test artifacts / verification records only (e.g. `TESTS.md` entries, a
  verification note). No product-code ownership.
- **Dependencies:** **C1 + H1 + W1** (and S1 for staff parity). Precedes **R1 phase (b)**.
- **Tests:** Stripe test-mode deposit + full-payment happy paths; webhook replay ⇒ no duplicate booking /
  no double charge (final-state assertion); Whitecross + HeroHairs before/after per-client visit-total diff
  = zero; the Alex golden vector end-to-end.
- **Commit boundary:** verification records / `TESTS.md` updates only.
- **Deploy boundary:** **no deploy**; it produces the **evidence** that gates R1(b) + the final controlled
  deploy (functions → hosting → rules LAST, owner-confirmed tenant + URL).
- **Acceptance criteria:** the plan is **not "done"** until Whitecross + HeroHairs before/after equivalence
  is demonstrated with `bookingSettings` absent, and Stripe idempotency is proven. Only then may anonymous
  create be denied.
- **Rollback gate:** any equivalence or idempotency failure ⇒ R1(b) does **not** ship; the migration stays
  in coexistence (direct-create open) until resolved.

---

## 6. Dependency graph (edges, not just the linear list)

```
  I1 ──► I2
  I1 ──► C1 ◄── P1
  C1 ──► H1 ─┐
  C1 ──► W1 ─┼──► E1 ──► R1(b: deny anonymous create)  [rules LAST, owner-gated]
  I1 ──► U1
  I1,I2 ──► S1 ─┘
  C1 ──► R1(a: reject server-owned fields on create)   [can land early]
```
Linear task order **I1 → I2 → P1 → C1 → H1 → W1 → R1 → U1 → S1 → E1** is a valid topological sort; in
practice **P1 may run in parallel with I1/I2**, **H1 ∥ W1** after C1, and **U1** any time after C1. The one
immovable rule: **R1 phase (b) is last and gated by E1.**

---

## 7. Rollout & rollback (whole migration)

1. I1 identity foundation + I2 query compliance (no deploy).
2. P1 pure contract + parity (no deploy).
3. C1 callable + guard thread + functions tests (functions deploy owner-gated; callable can sit unused).
4. R1 **phase (a)** reject-server-owned-fields (rules authored; deploy owner-gated, LAST).
5. H1 hosted cutover (hosting deploy, direct-create still allowed).
6. W1 premium cutover (separate premium deploy).
7. U1 admin canonical-name + S1 staff parity (hosting / staff-bundle deploys).
8. E1 Stripe idempotency + Whitecross smoke + HeroHairs regression + before/after equivalence.
9. **R1 phase (b)** deny anonymous create — **only after 8 is green** — rules deploy LAST, owner-confirmed.

**Rollback:** every step is independently revertible; absent-settings behavior = current behavior, so the
schema is a no-op to roll back. The rules-tightening (step 9) is the single hard cutover and is gated on
steps 5–8. Keep `firestore.rules.ROLLBACK.txt` current before any rules deploy.

---

## 8. Cross-references

| This plan needs | Lives in |
|---|---|
| Company tracking rows `B2`/`B3`/`B4`/`L1`/`Gate-G5` | `ROADMAP.md` |
| `INV-SEC-1` (create public, financial blocked), `INV-MATCH-4/7`, `INV-BK-6`, `INV-PARA-3` | `INVARIANTS.md` |
| Gate G3 (public-create forge), G5 (blast radius), booking-flow security map | `SECURITY.md` |
| Rules harness `test-firestore-rules.py`, count 49/49 (header) vs 95/95 (live) | `TESTS.md`, `firestore.rules.LIVE` |
| `canonicalPhone` new rule row, last-10 canonical, last-4 caution | `NORMALIZATION.md` (I1 edits it) |
| `settings/settings`, `clientManualId` lookup order (`matchedBy` is NEW) | `FIRESTORE_SCHEMA.md` |
| Deploy order functions→hosting→rules LAST, `SYNC.md` ledger (salown-app repo) | `DEPLOY.md`, `INV-SEC-4` |
| Push-vs-live deploy state of prerequisite work | `DEPLOYMENT_STATUS.md` |
| Detailed source material (this file reconciles them) | `~/.claude/plans/purrfect-conjuring-dove.md`, `HANDOFF_uk_phone_identity.md` |

---

## 9. Owner questions still open

1. **I2 strategy:** B1 (persisted canonical field + dry-run backfill) vs B2-fanout (variant helper). This
   plan recommends **B1** (permanent, fixes GDPR-erasure completeness) but the choice is owner's; it changes
   I2's file ownership and whether a backfill script exists.
2. **Minimal audit (decision 22):** confirm audit-now on booking-rule save via the settings-edit trigger,
   or defer to the separate audit package. B2 source marked this "PROPOSED (audit-now)".
3. **`bookingSettings` home:** confirmed as a **nested field in `settings/settings`** (ROADMAP `B2` says
   extend, not open a new collection) — flag if a subdoc is preferred instead.
4. **R1 phase (a) timing:** land the reject-server-owned-fields rule early (right after C1) as
   defense-in-depth, or hold all rules changes for the single step-9 window? (Recommend early.)
5. **Whitecross/HeroHairs test tenants:** confirm a non-production test tenant for H1/W1/C1 end-to-end runs
   (decision 19 forbids writing live data during the migration).
