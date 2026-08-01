# TREATMENT_PACKAGE_SYSTEM.md — TR-B session packages, entitlement and the open-account ledger

> **Role:** the authoritative description of how salOWN sells a **course of treatment** and tracks
> what has been **delivered** and what has been **paid**. The instalment arithmetic itself has its
> own file — [PAYMENT_PLAN_ENGINE.md](PAYMENT_PLAN_ENGINE.md). Read this one first.
>
> **Status:** ✅ DEPLOYED + LIVE-VERIFIED 2026-07-31 (baseline `c3716f7`).
> **Off by default.** A tenant with no `packageSettings` has the entire feature dark.

---

## 1. Why this is not part of the checkout

A booking's money is **one transaction**, resolved once, at checkout, into the canonical receipt
snapshot ([INVARIANTS.md](INVARIANTS.md) §1, `src/utils/receiptMath.ts`). A treatment package is the
opposite shape: **one commercial agreement** whose money arrives over weeks in an unknown number of
payments, and whose delivery is consumed over an unknown number of appointments.

Those two lifetimes cannot share a schema. A receipt is a photograph; a package is a film. So the
package keeps its own **append-only ledger** and derives every balance by folding it.

**Nothing in TR-B edits a stored balance in place.** A correction is a new `REVERSAL` or `ADJUSTMENT`
entry. The history a salon shows a customer is the same history the totals are computed from — there
is no second, editable copy that could disagree.

---

## 2. Data model

All server-written. The `[G4]` catch-all in `firestore.rules` grants same-tenant READ and denies
client WRITE on every collection not explicitly listed, which is exactly the posture these want — so
**TR-B added no new rule block**. (The one rule change it did make is in §7.)

| Path | What it is |
|---|---|
| `tenants/{tid}/packageDefinitions/{defId}` | The catalogue: what the salon **sells**. |
| `tenants/{tid}/clientPackages/{cpId}` | A **sold** package: snapshot + plan + counters + cached balances. |
| `tenants/{tid}/packageLedger/{entryId}` | **Append-only** money movements. `entryId` IS the idempotency key. |
| `tenants/{tid}/packageSessions/{sessionId}` | One entitlement movement. `sessionId` is **derived** — see §5. |
| `tenants/{tid}/settings/settings.packageSettings` | Tenant policy. A namespaced key on the existing doc, like TR-A's `presentation`. |

Contract types: `packages/shared/src/treatmentPackage.ts` (type-only).
Engine: `src/utils/packagePlan.ts` ⇄ `functions/src/packages/packagePlan.ts` — **byte-identical
twins**, pinned from both sides (see §8).
Transactions: `functions/src/packages/executor.ts`.

### Why `packageSettings` is separate from `paymentSettings`

`paymentSettings` (PAY-1) decides **online card payment for bookings**. `packageSettings` decides
**in-salon package accounting**. They share no field and no failure mode. Merging them would let one
editor break the other.

---

## 3. The immutable commercial snapshot

The single most important immutability rule in TR-B:

> **Raising a package's price on Monday must not change what a client who bought on Friday owes.**

Every `clientPackage` carries a frozen `snapshot` of the definition **as it was at the moment of
sale** — name, session count, single-session price, package price, validity, restrictions, and the
`definitionVersion` it came from. Every balance is folded against **that snapshot**, never against
the live definition.

This is true *by construction*, not by remembering not to look: the fold function's `basePrice_m`
argument comes from the snapshot, and nothing in the executor reads the definition after the sale.
Proven live (`tr-demo`, 2026-07-31) by editing a definition from ₺8.000 → ₺14.000 after a sale and
confirming the sold package's snapshot and totals were byte-identical.

Editing a definition bumps `definitionVersion`, so a sale can always say which revision it was made
against.

---

## 4. The money model

Every stored amount is an **integer in minor units** (kuruş / pence), suffixed `_m`. There is not one
float operation in the engine. `if (money)` is banned — an explicit `0` is a real amount, which is
the exact mistake the P1-RECEIPT-MATH product-only bug was made of.

```
grossPaid_m     = Σ effective PAYMENT
refunded_m      = Σ effective REFUND
paid_m          = grossPaid_m − refunded_m      (cash actually retained)
packageTotal_m  = basePrice_m + Σ ADJUSTMENT    (signed)
outstanding_m   = packageTotal_m − grossPaid_m  (value never funded)
```

### The headline invariant

```
packageTotal_m === paid_m + outstanding_m + refunded_m
```

Substituting: `(gross − ref) + (total − gross) + ref = total`. ∎

It holds **by construction** and is nevertheless **re-checked on every fold**. A ledger document can
be hand-edited, and a total that certifies itself is not a check. Failure codes `M1`–`M8` are listed
in [INVARIANTS.md](INVARIANTS.md) §1.

The three figures and the arithmetic that ties them together are **printed on screen** in the client
package drawer, so a salon owner can check the software rather than trust it.

### What a refund means (an explicit product decision)

A `REFUND` **returns money AND discharges the matching part of the price**. The three buckets
therefore genuinely partition the package value: funded-and-kept, funded-then-returned, never-funded.

The alternative reading — hand the money back but still expect it — is reachable **deliberately**, as
a refund plus an explicit `ADJUSTMENT` that re-raises the total. It is not the default, because a
salon that refunds a customer and silently keeps billing them is the failure this ledger exists to
prevent. Rationale in full: ADR-020.

### Reversal

A `REVERSAL` cancels exactly one prior entry. Both rows stay in the history — the reversed one struck
through and labelled. **A reversal of a reversal is refused** (`M7_REVERSAL_TARGET`) rather than
quietly unwound: "undo the undo" is a correction a human should state as a new entry, not a chain the
machine walks.

---

## 5. Entitlement — consumed exactly once, structurally

```
remainingSessions = totalSessions − consumedSessions − scheduledSessions   (never negative)
```

| Transition | Effect |
|---|---|
| → `scheduled` | Reserves one entitlement (`remaining` → `scheduled`). Links a booking. |
| `scheduled` → `completed` | Consumes it (`scheduled` → `consumed`). |
| (none) → `completed` | Walk-in redemption: straight from `remaining` to `consumed`. |
| → `no_show` | Consumes or releases, per `noShowConsumesSession` (default: **consumes**). |
| → `cancelled` | Always releases. |

`completed` / `no_show` / `cancelled` are **terminal**. Re-deciding a delivered session days later
would move money-adjacent entitlement with no record of the first decision.

### Why double-consumption is impossible

A session's doc id is **derived**, not random:

```
{clientPackageId}__{bookingDocId}          // linked to an appointment
{clientPackageId}__manual__{idempotencyKey} // walk-in redemption
```

Two devices completing the same booking at the same instant contend for the **same Firestore path**,
and a serializable transaction lets exactly one create it. "Consume exactly once" is structural, not
a check that could be forgotten. Proven with five concurrent completions in
`executor.emulator.test.js` and again live on `tr-demo`.

---

## 6. Loyalty: no double award, and no checkout code changed

**Package payments earn no loyalty points.** Points are earned at checkout, on
`receiptEarnBase_p`, once per booking.

The mechanism is a single field, set at **link** time:

> Reserving a session stamps the booking `price: 0` plus the `BookingPackageLink` fields
> (`packagePrepaid: true`, `packageListPrice_m`, …).

The existing checkout, the canonical receipt writer, the receipt reader and the loyalty award then
see a **prepaid zero-value service** and do the right thing without knowing packages exist. So TR-B
changes **not one line** of `src/firestoreActions.ts`, `src/utils/receiptMath.ts` or
`functions/src/receipts/index.ts`.

That closes all four accidental-award paths the brief names:

| Risk | Why it cannot happen |
|---|---|
| Awarded at sale **and** per session | Nothing in TR-B awards points at all. |
| Awarded on outstanding debt | Points come from the checkout's earn base, which never sees the package. |
| Awarded on refunded amounts | Same. |
| Awarded on tips / non-eligible charges | Unchanged — `I4_EARN_BASE_EXCLUDES_TIP_SC` still governs. |

`packageListPrice_m` preserves what a session was worth for reporting, **without ever re-entering the
money math**.

---

## 7. Authorization

One pure function — `canPerform(action, role, settings, isSuperAdmin)` — is called by **both** the
browser (which button to grey out) and the server (the decision). The server re-runs it **inside the
transaction** against a freshly read role, so a revoked staffer cannot land a write on a stale claim.

| Action | owner | admin | staff |
|---|---|---|---|
| `MANAGE_DEFINITIONS`, `CANCEL_PACKAGE`, `OVERRIDE_EXPIRY` | ✅ | ✅ | ❌ |
| `SELL`, `CONSUME_SESSION` | ✅ | ✅ | ✅ |
| `RECORD_PAYMENT` | ✅ | ✅ | only if `staffMayRecordPayments` |
| `RECORD_REFUND` / `RECORD_ADJUSTMENT` / `REVERSE` | ✅ | ✅ | needs `staffMayAdjustPayments` **and** `requireApprovalForWriteOff === false` |

The two correction gates are independent and **the stricter wins**.

**There is no action that edits or deletes financial history** — for anyone, including a super-admin.
Only `REVERSE`, which appends.

### The one `firestore.rules` change

`packageSettings` joins `presentation` as **owner-or-super-admin only** — one key added to the
existing `hasAny()` list on the `settings/{document=**}` match. No new match block.

Rationale: these switches decide **who may move money**. A stylist who could edit them could grant
themselves the right to record refunds, which would make the permission model advisory. The Settings
tab is already owner-gated and the callable re-checks the role; this is the boundary that holds when
neither runs.

Blast radius: **zero**. No live tenant carries the key (verified against all six on 2026-07-31), so
the clause cannot change any current write.

---

## 8. The twin engine

`src/utils/packagePlan.ts` and `functions/src/packages/packagePlan.ts` share a **byte-identical
PARITY CORE** region, pinned from both sides:

- server: `functions/src/packages/packagePlan.test.js` (last test)
- browser: `src/utils/packagePlan.parity.test.ts` (via Vite `?raw`)

Why the browser gets a copy at all: the panel says *"that exceeds the outstanding balance"* **before**
the round-trip. Re-implementing that reasoning in the UI is how two answers to one question appear;
importing the identical module is how there stays one. The browser's verdict is **advisory** — the
server re-runs the same functions inside the transaction and is the only authority.

Same discipline as the `presentation` and `bookingSettings` twins.

---

## 9. UK tenants are unchanged by construction

`packageSettings` absent ⇒ `resolvePackageSettings` returns `enabled: false` ⇒

- the **Packages** nav item and route render nothing usable (the page shows an explanatory card);
- the Staff App client card shows no package block;
- every executor entry point returns `PACKAGES_DISABLED` before any write;
- no existing query, total, receipt or rule behaviour changes.

Same regression anchor TR-A used for `presentation`. Verified live: all six tenants (`demo`,
`herohairs`, `the-hair-lab`, `tr-demo`, `whitecross`, `yusufo`) carry no `packageSettings`.

---

## 10. Surfaces

**Panel** (`/app/packages`) — catalogue + sold packages, deliberately two lists: "what do we sell?"
is a rare owner config task; "who owes us money?" is a daily desk task. Merging them would put a
price-editing control next to a debt a receptionist is trying to collect.

- package builder (live saving calculation, stated in words before Save)
- sell (client, discount, arrangement, **the exact schedule the client is agreeing to**, money taken now)
- client package drawer — progress, the four figures + the reconciliation line, instalment schedule,
  sessions, full payment history including reversed rows, and the actions the role permits
- record payment / refund / adjustment; reverse an entry
- Settings → **Payment settings** (owner-only)

**Staff App** — the client card carries a packages block (sessions left + outstanding); one tap opens
a sheet to use a session, or record a payment if the salon permits it. A stylist can never edit
history, refund, or write off.

All money renders through TR-A `formatMoneyMinor`; all dates through `tenantDateKey` /
`formatDate`. **No `£`, `en-GB` or `Europe/London` anywhere in the new code.**

---

## 11. Provider neutrality

No Stripe client is constructed, no `STRIPE_SECRET_KEY` is referenced, and no code path claims an
external authorisation succeeded. Every method (`CASH`, `CARD_TERMINAL`, `BANK_TRANSFER`, `OTHER`) is
a **manual record of money the salon says it moved**. `CARD_TERMINAL` means "we ran it on our own
machine and are telling the system", not "salOWN charged a card".

Card-processor integration is a later package and will add a provider-settled entry **kind** alongside
these, not replace them.

---

## 12. Deployed surface

Six callables, `europe-west2`, codebase `salown`:

`salownSavePackageDefinition` · `salownSellPackage` · `salownRecordPackagePayment` ·
`salownPackageSession` · `salownSavePackageSettings` · `salownCancelClientPackage`

Each is a thin `onCall` shell: lift the actor from `request.auth`, wire the audit sink, map a stable
machine reason to an `HttpsError`. **`tenantId` is always the auth claim, never a request field.**

---

## 13. Tests

| Where | Count | What it proves |
|---|---|---|
| `functions/src/packages/packagePlan.test.js` | 72 | the arithmetic, the settings resolver, authorization, date-key maths, TRY/GBP parity, and the twin byte-check |
| `functions/src/packages/executor.emulator.test.js` | 27 | what only a real transaction engine can show — see below |
| `src/utils/packagePlan.parity.test.ts` | 8 | the browser copy is loadable **and** agrees |
| `src/lib/packagesApi.test.ts` | 12 | money **input** parsing (a Turkish and a UK keyboard produce the same integer) |

The emulator suite is the important one:

- six concurrent identical payments → **one** ledger row, five replays
- two payments that would together overpay → exactly **one** refused, debt never negative
- five concurrent completions of the same booking → **one** entitlement consumed
- two bookings racing for the **last** session → exactly one winner
- editing a definition after a sale → the sold package is byte-identical
- tenant isolation, staff-vs-owner permission split, deposit enforcement, expiry, no-show policy

⚠️ **The TR-B suites are not in the default `npm test` glob.** `functions/package.json` was claimed by
the concurrent TR-C session and yielded rather than contested. Run them with:

```bash
cd functions
node --test src/packages/*.test.js
firebase emulators:exec --only firestore --project demo-c1 --config ../firebase.json \
  'node --test --test-concurrency=1 src/packages/*.emulator.test.js'
```

**Request to whoever next owns `functions/package.json`:** append `src/packages/*.test.js` to `test`
and `src/packages/*.emulator.test.js` to `test:emulator`. No CI depends on it (`deploy.yml` does not
run `npm test`).

---

## 14. Live verification (2026-07-31, `tr-demo` only)

37 assertions against **production Firestore**, driving the exact deployed executor: settings
authorization, catalogue, a 3-instalment sale with a ₺2.000 deposit, double-tap idempotency,
overpayment refusal, the staff payment/refund permission split, refund + reversal, the `price: 0`
prepaid seam, entitlement consumption and its refused retry, tenant isolation, and cancellation
moving no money.

All 12 synthetic documents deleted and the `packageSettings` key removed afterwards — `tr-demo` was
left exactly as found. No email sent, no card touched.

---

## 15. Known gaps

Closed and still-open items are tracked by TR-B2 (see §16).

- ~~**Finance / Reports** do not include package revenue.~~ **CLOSED by TR-B2 Stage 1** (`c5bd1dc`) — see §16.
- ~~**Booking-flow package selection**~~ — ✅ **CLOSED by TR-B2 Stage 3** (`b40e182`), see §18.
- ~~**Custom instalment amounts/dates**~~ — ✅ **CLOSED by TR-B2 Stage 2** (`b0a2051`), see §17.
- ~~**Catalogue archive/restore**~~ — ✅ **CLOSED by TR-B2 Stage 2** (`b0a2051`), see §17.

---

## 16. Package accounting (TR-B2 Stage 1, `c5bd1dc`)

> **Engine:** `src/utils/packageAccounting.ts` (pure) · **Surface:** Reports → Packages tab.
> **Status:** ✅ accounting policy + Reports integration DEPLOYED + LIVE-VERIFIED 2026-07-31.
>
> ⏳ **Scope, stated precisely.** Package accounting is live in Reports for package-enabled tenants. The legacy Finance page remains Whitecross-specific; making Finance tenant-generic is a separate TR-D/platform task. This section closes the *policy* question
> (what a package amount means) and the *Reports* surface — not tenant-generic Finance.

### The five dimensions, and why they are never summed

An 8-session course sold for ₺8.000 with ₺2.000 taken today has three different right answers:

| Question | Answer | Kind |
|---|---|---|
| How much money came in? | ₺2.000 — **cash received** | flow |
| How much have we earned? | ₺0 — **delivered value** | flow |
| How much treatment do we still owe? | ₺2.000 — **deferred** | stock |

Plus **outstanding** (₺6.000 never funded) and **refunds**, reported separately. Collapsing these into
one "Revenue" figure is how a course-based business books a record month and then discovers it owes
eight months of treatment it already spent the money on.

### Flows are differences of cumulative folds

Every in-period figure is `value(endKey) − value(dayBefore(startKey))` over TR-B's **own**
`foldPackageLedger`. Reversal resolution, sign rules and `M1`–`M8` therefore have exactly one
implementation in the product — a second reversal resolver that drifted from the first is the class
of bug an append-only ledger exists to make impossible.

**Deliberate consequence:** a `REVERSAL` recorded in August against a July payment shows as **negative
cash in August**. July is not restated, because a closed period is something the salon has already
acted on. It also means the periods sum exactly to the final balance, with no reconciling item.

### Allocation

`allocateSessionValue` calls TR-B's own `splitEvenly`, so the remainder rule is not merely *the same
as* the instalment rule — it **is** the instalment rule, and the odd kuruş lands on session #1, the
one most likely already delivered.

The base is the package total **as of the cutoff** — the immutable snapshot price plus audited
`ADJUSTMENT`s. A write-off therefore restates what the remaining sessions are worth, and the
restatement is absorbed into the period the adjustment was recorded in.

> *Rejected:* allocate from the snapshot price alone. A fully-delivered package that had been written
> off would then report more earned than the client will ever be billed, forever.

A session recognises value iff `holdsEntitlement && (completed || no_show)` — reading the **stored**
consequence of the tenant's no-show policy rather than re-deciding it, so this module and the
executor can never disagree about what a missed appointment cost.

### Why the surface is Reports and not Finance

`/app/finance` is gated to `tenantId === 'whitecross'` (`AppRouter.tsx`), renders every amount through
a hardcoded `'£' + …`, and belongs to one UK barbershop's wage/P&L model. A Turkish salon — the only
kind that sells packages — can never open it. Reports is platform-wide.

Not touching `Finance.tsx` is also the strongest available guarantee that the `2a69735` date-selection
fix is unaffected: the file is not in the diff, and its built chunk is **byte-identical live vs
local** once the entry-chunk filename is normalised.

### No double counting

A booking that uses a package session is stamped `price: 0` + `packagePrepaid` at link time (§6), so
its checkout contributes **zero** to service revenue. Package value is counted once, here.
- `locationId` is carried on every write and always `null` until locations ship.


---

## 17. Catalogue archive/restore and custom instalments (TR-B2 Stage 2, `b0a2051`)

> ✅ DEPLOYED + LIVE-VERIFIED 2026-08-01. **No Function was deployed** — both features were
> already backed by the shipped server contract; only the controls were missing.

### Removal is a reversible ARCHIVE. There is no hard delete.

> **Package catalogue removal = reversible archive. Financial and treatment records are never
> deleted through ordinary UI.**

Archiving closes a definition to **new sales only**. Everything already sold keeps working —
proven live by delivering a session and recording a payment on a sold package *while its
definition was archived*, and by confirming the sold package's `snapshot`, `plan` and
`financialCache` were byte-identical afterwards.

Archived definitions stay **reachable** behind an `Archived` filter rather than hidden, because a
package archived by mistake must be restorable. Restore returns it under the **same definition id** —
never a copy.

The confirmation says what does **not** happen ("courses already sold, their sessions and their
payment history will NOT be deleted"), because that is the thing a salon is actually worried about
at the moment it archives.

**No new callable, deliberately.** `status` was already in the definition contract;
`savePackageDefinitionCore` already re-checks `MANAGE_DEFINITIONS` inside its transaction; and
`sellPackageCore` already refuses `DEFINITION_ARCHIVED` **from inside the sell transaction** — so an
archive racing a sale is resolved server-side with one deterministic winner, and a stale browser
cannot sell an archived package. A second endpoint would have meant a second authorization path to
keep in step with the first.

**Idempotency, stated precisely.** The outcome is **state**-idempotent: archiving an archived
definition leaves it archived and the id never changes. It is **not write-idempotent** —
`savePackageDefinitionCore` has no fingerprint replay, so a retry advances `definitionVersion`
again. That counter is monotonic and carries no money, so the cost is a gap in a version sequence
rather than a duplicated fact. The idempotency key is minted when the confirmation **opens**.

### Hard-delete policy (explicit decision)

| Record | Policy |
|---|---|
| Package definitions | **No hard delete.** A future permanent delete would require a server-side dependency-checked callable (never sold · no `clientPackages` · no `packageLedger` · no `packageSessions` · no `treatmentSessions` · no booking references · no audit dependency) — **not** a Firestore rules permission. |
| Client packages | Never hard-deleted through owner/staff UI. Use cancellation, refund, reversal or adjustment, each with an audited reason. |
| Treatment sessions | Completed or financially relevant sessions are never hard-deleted. Use lifecycle cancellation/correction and the audited history. |

**No Firestore delete permission was added by TR-B2.**

### Custom instalments

The engine always accepted arbitrary amounts and dates. The editor adds **no arithmetic**: it
collects rows, converts them at the boundary through the same `parseMinorUnits` that a Turkish
(`1.234,50`) and a UK (`1,234.50`) keyboard both feed, and hands them to the engine the server runs.
The browser's verdict is advisory; the server re-validates and refuses with `CUSTOM_SUM_MISMATCH`.

**The rows must add up exactly.** Under-allocation is refused rather than quietly becoming an open
balance — a salon that wants one asks for the `OPEN` arrangement by name, which is a different plan
kind with different overdue semantics (an open account can never be overdue). The unallocated amount
is on screen at all times, **signed**, so the salon is never guessing which way it is out.

Switching to custom **seeds the rows from the equal split already on screen**, so "custom" starts
from a plan that reconciles instead of an empty table to balance from scratch. Rows are stored in
date order, so "instalment 2" means the same thing on screen and in the document.

**Post-sale plan editing is NOT supported, and is not faked.** The plan is written at sale inside the
sell transaction and the executor exposes no verb to replace a schedule afterwards. Building a
client-only illusion of it would let a screen show a plan the ledger never agreed to. A salon that
needs to change terms today records an `ADJUSTMENT` (which is audited and appends) or cancels and
re-sells. A real implementation would need a new server verb that leaves paid instalments immutable,
replaces only future unpaid rows, re-checks the sum, and records actor and reason — that is its own
package.

---

## 18. Package selection in booking and walk-in flows (TR-B2 Stage 3, `b40e182`)

> ✅ DEPLOYED + LIVE-VERIFIED 2026-08-01. **No Function deployed.**
> Picker: `src/components/packages/PackagePicker.tsx` · rules: `src/utils/packageEligibility.ts`
> · linking: `linkBookingToPackage` in `src/lib/packagesApi.ts`.

### The ordering rule, and why it is not optional

§6 explains that a redeemed session is stamped `price: 0` at **link** time, which is what keeps the
checkout, the canonical receipt writer/reader and the loyalty award ignorant of packages. Stage 3
surfaced the precise condition:

```ts
if (bookingRef && target === 'scheduled') { tx.update(bookingRef, { price: 0, … }) }
```

**Only on `scheduled`.** A booking taken straight to `complete` therefore consumes the entitlement
while keeping its full price — and the checkout charges the client a second time for a session they
have already bought, *and* awards loyalty on it.

That is not a defect in TR-B. The `(none) → completed` shortcut exists for redemptions with **no
booking** (the client card), where there is nothing to stamp. A booking-linked session is meant to
pass through `scheduled`. So:

> **Every booking-linked redemption goes `reserve` → `complete`, in that order, always.**

The rule lives in `linkBookingToPackage`, once, rather than in four call sites. Both calls share the
derived session id (`{clientPackageId}__{bookingDocId}`), so a retry replays and two devices contend
for one Firestore path.

Whether the session is *also* completed answers one honest question — **is the treatment happening
now?** A walk-in reserves and completes; a scheduled appointment stops at reserve and is completed
later through the ordinary lifecycle.

Proven live with a **negative control**: complete-without-reserve was run deliberately and left the
booking at full price. The failure is demonstrated, not asserted.

### Customer-first eligibility

The picker renders **nothing** — not an empty list, not a disabled control — until a client is
RESOLVED: picked from the existing list or just created, never free-typed. A package belongs to a
person, and burning a session off the wrong client's course is the failure worth designing against.
**An anonymous walk-in can never use a package.**

Only that one client's packages are ever read. There is no "all packages" query on this path.

Eligibility (`packageEligibility.ts`, pure) is computed locally so the desk is told instantly in the
salon's own words, and **re-decided by the server inside its transaction**, which is the only
authority — a stale tab is refused and shown why. Ineligible packages are still listed, after the
eligible ones, **with their reason**: hiding them looks like the package vanished.

Two ordering choices worth knowing: a package that is both exhausted and expired reads as
**exhausted** (the reason staff can act on), and expiry is judged against the **appointment date**,
not today — booking into next month against a package that expires next week is refused now rather
than discovered on the day.

### Money stays where it belongs

- A covered session leaves the staff walk-in cart total. **One** session is covered; extra
  quantities, other services, add-ons and products stay chargeable exactly as before.
- Selecting a package **records no payment**, and an outstanding balance is displayed but **never
  auto-collected** at the point of booking.
- Linking writes **no ledger entry** — delivery and payment remain separate facts.

### One additive change to `firestoreActions.ts`

`createWalkIn` discarded `addDoc`'s `DocumentReference`, and the derived session id needs that doc
id. `createWalkInDetailed` returns `{ bookingId, docId }`; `createWalkIn` is now a thin wrapper, so
no existing caller changed. The write itself is byte-for-byte what it was — this captures a value
that was already being produced and thrown away.