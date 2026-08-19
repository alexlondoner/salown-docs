# `FIN-PERIOD-CLOSE` — closed-month immutability

**Status: Phase A + Phase B are SOURCE-COMPLETE and `PUSHED_NOT_LIVE`.**
`FINANCE_PERIOD_CLOSE_MODE = 'legacy'`, no tenant has closed a month, **August 2026 is OPEN**, and
nothing here has been deployed. Status of record: [`ROADMAP.md`](ROADMAP.md) — this file is the
technical detail and never the status badge.

> **The one sentence.** A closed month must be **STORED**, not **DERIVED**.

---

## 1 · Why

Every historical Finance total is recomputed on every page load from documents that are still
editable. So a legitimate edit restates months that were already reported and, in one case, settled.

This is not a hypothesis:

| Event | Effect |
|---|---|
| 2026-08-12 · Arda's `workingDays` found collapsed to `["Wednesday"]` (his day **off**) | ≈**£12,300** of historical labour cost missing ([INCIDENTS](INCIDENTS.md) 2026-08-12) |
| 2026-08-13 · `FIN-ARDA-REPAIR` restored the real rota — **one field, one document** | every closed month moved by ≈**£12,300** again, *correctly*, and **by exactly the mechanism that caused the damage it was repairing** (ROADMAP §9.5) |
| 2026-08-16 · one weekday toggled from OFF to ON | **18** past days reinterpreted, wage recomputation moved by exactly **+£1,800**, every historical occupancy percentage fell (`ROTA_HISTORY_SETTINGS_SSOT_AUDIT.md` §1A B.3) |

One of those months underpins a **signed** exit agreement, and the repayment it drives is computed
live from `companyNetPL` (`ExitSettlementCard.tsx:126-137`).

**What the neighbouring items do and do not fix.** `FIN-COMP-S3A` dated *whether somebody was
employed*; `FIN-ROTA-HISTORY-READ` dates *which days they worked*;
`FIN-CONFIG-DATED-AUTHORITY-P0` dates *how much a day pays* and *what a day costs*. All three are
necessary and none of them stores a **result** — so a closed month still moves whenever any
remaining input moves: an expense row, a re-opened booking, a back-dated `shiftChanges` key
(`ROTA-SSOT-2`, still open), a partner share. `INV-PARA-14` and `INCIDENTS` 2026-08-12 both say it
plainly: **`effectiveFrom`/`effectiveTo` does not make a closed month immutable and nobody may
describe it as doing so.**

---

## 2 · The owner-approved baseline

Approved 2026-08-18. Recorded here verbatim in substance because every decision below descends
from it.

| # | Decision |
|---|---|
| 1 | One tenant-local **calendar month** at a time. Key `YYYY-MM`, path `tenants/{tenantId}/financePeriods/{YYYY-MM}`, schema version `1`, document id **is** the period key. No auto ids, no revision suffixes. |
| 2 | Base snapshots are **write-once**. **Reopen is not supported.** A closed base may never be overwritten or deleted through the product. Corrections are append-only attributable adjustments. |
| 3 | Whitecross Feb–Jul 2026 will eventually be closed as **`sourceBasis: 'system'`** — the repaired salOWN reconstruction. The workbook stays **reconciliation evidence only**; the ≈**£569.97** workbook-vs-system difference and the workbook's ≈**£711** internal daily-sheet-vs-summary inconsistency stay **documented, unbridged**. No `acceptedDifferences` may be manufactured to push workbook numbers through the gate. |
| 4 | **August 2026 remains OPEN.** The domain refuses the current tenant-local month with `CURRENT_PERIOD_OPEN` and every future one with `FUTURE_PERIOD`, structurally. |
| 5 | Preview/dry-run: tenant **owner** or **super-admin**. Apply and adjust: **super-admin only**. Snapshot read: owner/admin Finance readers and super-admin. Every browser write denied, super-admin included. |
| 6 | The ≈**£7,939** exit liability is **excluded**. Not in a snapshot, not invented into `settings/exit_agreement`, not described as an existing production liability. Its representation is a separate owner-authorised accounting migration. |
| 7 | No close/reopen/adjust **UI control** in Phase B. A read-only closed-period badge/panel is separate work. |

### 2.1 · Amendment of 2026-08-19 — the tenant selector

The 2026-08-18 baseline also required the target tenant to be **server-derived and forbidden in the
request body**. `FIN-PERIOD-CLOSE-B-CONFORMANCE` returned that clause **BLOCKED** rather than
softening it, because no code change can satisfy it: a super-admin token carries `tenantId: ''` and
`tenantRole` unset, `superAdmin/**` holds no operator→tenant binding, and every accepted super-admin
migration callable in this codebase takes its target the same way. The owner amended the contract
on **2026-08-19**, and this is that amendment:

| # | Amended decision |
|---|---|
| A1 | A **single top-level** request field named `tenantId` is accepted **solely as a target selector**. |
| A2 | `tenantId` is **never authority evidence**. No branch reads it to decide what a caller may do. |
| A3 | Authority comes from: the authenticated Firebase identity · the `superAdmin` custom claim for apply/adjust · server-side staff/account state · the **server-side role re-read inside the transaction** · the **exact tenant/period release allowlist** (§6.1) · the approved plan digest · source-drift validation · the transactional preconditions. |
| A4 | A **super-admin** may select any target tenant through it — that is the point of a break-glass boundary whose token names no tenant. |
| A5 | A **non-super-admin owner** may preview/dry-run only when `request.tenantId === auth.token.tenantId`. |
| A6 | Owner / admin / staff / reception / public users may **not** use `tenantId` to acquire authority. |
| A7 | **Only** the exact top-level field is a selector. |
| A8 | A **nested** `tenantId`, a duplicate selector, a renamed equivalent, and every caller-supplied role, actor, `superAdmin`, audit, hash, tenant-authority or approval field remain **forbidden**. |
| A9 | Apply/close and adjustment remain **super-admin only**. |
| A10 | The amendment authorises **no production access and no production operation**. |

**One behaviour changed to meet A8.** A nested `tenantId` (in `adjustment`, in `differences`, at any
depth) used to be silently ignored on a `CLOSE`. The top-level field is now lifted out of the
forbidden sweep and `tenantId` joined `PERIOD_CLOSE_FORBIDDEN_KEYS`, so exactly one occurrence is a
selector and every other one is `FORBIDDEN_FIELD`. A renamed equivalent (`tenant`, `tenantID`,
`tid`, `targetTenant`, `salonId`, …) is `INVALID_INPUT` — the request allowlist is exact.

This is a **selector**, not an operator-session registry. It was deliberately not redesigned into one.

---

## 3 · The three concepts, kept apart

| | **Dated rota resolution** | **Period close** | **Post-close adjustment** |
|---|---|---|---|
| Answers | *which weekdays did this person work on that date?* | *what did this month's accounts say when we stopped counting?* | *we were wrong — what is the corrected figure, who says so, on what evidence?* |
| Mechanism | append-only `staffRota/{id}/rotaEntries` | write-once `financePeriods/{YYYY-MM}` | `PeriodAdjustment` appended beside the base; `effectivePeriodTotals` folds for READ only |
| **Protects** | one input | **every** input, including ones nobody has thought of | the record's integrity while still allowing a correction |
| **Does not protect** | `shiftChanges` (which still outranks the log — `financeWages.ts:426-429`), wage amount, fixed cost, bookings, expenses, partner config, timezone | anything *before* the close runs — the baseline you freeze is only as good as the inputs on freeze day | the base: `baseSnapshotUnchanged()` is the gate that says a write is a rewrite |

Dated rota is **necessary but not sufficient**; period close is **sufficient but only from the
moment it runs**.

---

## 4 · Architecture

```
                    browser (owner/admin)                    operator (super-admin)
                            │                                          │
              read: financePeriods/{YYYY-MM}                  salownCloseFinancePeriod
                            │                                          │
   src/utils/financePeriodActions.ts                 functions/src/finance/periodClose.ts
     (0 reads while 'legacy')                          (the ONLY writer of financePeriods)
                            │                                          │
   src/utils/financePeriodCloseReader.ts                functions/src/finance/periodCloseDomain.ts
     (precedence + fail-closed)                                (the FUNCTIONS twin)
                            │                                          │
                            └────────► src/utils/financePeriodClose.ts ◄┘
                                        (Phase A — the accepted domain)
```

### 4.1 Why there is a twin

`functions/tsconfig.build.json` sets `rootDir: src` **and** `noResolve`, so a Functions module can
only emit and require modules under `functions/src`. `src/utils/**` is **unreachable** from that
runtime. The same constraint produced `functions/src/utils/rotaFold.ts`, and this is the same
answer to it.

The twin is a **mirror**, not a place to think. It differs from
`src/utils/financePeriodClose.ts` by exactly two things — its header and the depth of one type-only
import — and `periodCloseDomain.test.js` §7 **reconstructs the source from the twin** to prove it.
`packages/shared/src/financePeriodClose.golden.json` is then replayed against **both**
implementations in one process, value for value, so a drift cannot hide in a field the golden
happens not to name. Every behavioural change belongs in the frontend module first; the twin
follows, and the parity test fails until it does.

### 4.2 What the server does **not** do

It does **not** compute Finance. There is exactly one implementation of a wage day
(`src/utils/financeWages.ts`, `INV-PARA-13`) and one of the P&L identity (`src/pages/Finance.tsx`),
and a second one on the server would be the six-copies defect wearing a server's clothes.

So the **caller hands in the component figures** and the boundary:

* **DERIVES** every total that is an identity — `wagesTotal_m` and `netPL_m` are produced by
  `buildClosedPeriod` and nowhere else, so a caller cannot hand in a total that disagrees with its
  own parts. Both are **refused by name** in the request body;
* re-validates the whole record through the accepted domain, **twice** — at preview and again
  inside the write transaction;
* owns the half a browser must never be trusted with: **which documents** the figures came from,
  **whether they moved**, **who may act**, and **when the month is over in the tenant's calendar**.

A figure this boundary cannot check is still a figure an owner approved against a preview whose
provenance it *can* check. That is the honest statement of what a close proves: it does not certify
the arithmetic, it certifies **the inputs, the identity, the approval and the immutability**.

---

## 5 · The persisted contract

`tenants/{tenantId}/financePeriods/{YYYY-MM}` — exactly `ClosedFinancePeriod` as Phase A defines it
(`src/utils/financePeriodClose.ts:264-291`). **No field was added for Phase B.**

```
schemaVersion 1 · tenantId · periodKey · timezone · currency · status 'closed'
closedAt · closedBy · sourceBasis 'system'|'workbook'|'mixed'
cutoff      { fromDateKey, toDateKey, readCeiling }
operating   { revenue_m, expenses_m, fixedCosts_m, wagesByStaffId, wagesTotal_m, netPL_m }
cash        { payments_m, advances_m, tips_m, payouts_m }
capital     { contributions_m, cancelledBalances_m }
liabilities [{ id, label, amount_m, counterpartyRef?, evidenceRef, includedInOperatingPL: false }]
provenance  { sourceSha, documents[{path, updateTime, contentHash}], workbookHash?, agreementHash? }
adjustments [PeriodAdjustment]        // append-only
rollback    { restoreTo, previousDocumentHash, previousUpdateTime }
audit       { engineVersion, approvedPreviewHash, approvalActor, approvalAt, acceptedDifferences[] }
```

**The field mapping Finance and the writer must agree on**, stated once so the two cannot drift:
the stored `operating.expenses_m` is the **whole** operating expense line, which on the Finance page
is `cashExp + bankExp + platformFeesTotal`. A snapshot records what a month came to, not which of
three buckets each pound sat in.

### 5.1 Provenance is bounded, and typed

Two kinds, one persisted shape:

| Kind | One per | `path` | `updateTime` | `contentHash` |
|---|---|---|---|---|
| `document` | each `barbers/{id}`, `staffComp/{id}`, `settings/finance_config`, `settings/settings` | the real document path | Firestore `updateTime` | fingerprint of the deterministically-encoded content |
| `collection-period` | each of `bookings`, `finance_expenses`, `expenses`, `finance_payments`, `advances`, `investment_transactions` | `tenants/{t}/{coll}#period={YYYY-MM}` — **`#` marks it as synthetic; it is never a document** | max `updateTime` of the in-period rows, or the epoch sentinel | fingerprint of `{collection, periodKey, rowCount, rows:[{id, updateTime}]}` |

The aggregate digest input is the **row-id + `updateTime` set plus the row count**, deliberately not
row content: `updateTime` moves on every write to a document, so a changed row changes it, and an
added or removed row changes the id set and the count. That is complete for drift and it removes a
whole class of "the hash disagreed because a Timestamp serialised differently".

Whole collections are **read** (so any add, remove or edit anywhere contends) while the **digest**
covers the in-period subset only (so an edit to another month does not block this one). Membership
is resolved through `Intl` in the tenant timezone — slicing an ISO string here would be
`INV-DATE-1` one unit larger.

**A source value the engine cannot encode deterministically fails CLOSED** (`SOURCE_UNREADABLE`). A
silently-skipped value is a value whose change cannot be detected, and a provenance hash that
ignores a field certifies what it did not look at.

### 5.2 Ceilings — an oversized month refuses, it does not discover a limit

| Constant | Value | Refusal |
|---|---|---|
| `MAX_ROWS_PER_COLLECTION` | 8 000 | `SOURCE_TOO_LARGE` |
| `MAX_TOTAL_SOURCE_ROWS` | 24 000 | `SOURCE_TOO_LARGE` |
| `MAX_PROVENANCE_DOCUMENTS` | 400 | `SOURCE_TOO_LARGE` |
| `MAX_SNAPSHOT_CANONICAL_LENGTH` | 700 000 chars | `SOURCE_TOO_LARGE` — checked **before** the write, well under Firestore's 1 MiB |
| `MAX_WAGE_SUBJECTS` | 500 | `SOURCE_TOO_LARGE` |

### 5.3 `provenance.sourceSha` is an engine id, and says so

`FINANCE_PERIOD_ENGINE_ID = 'fin-period-close-b/1'`. It is **not** a repository SHA and does not
pretend to be one: the Functions runtime has no access to git, and stamping a plausible-looking hex
string would be a fabricated provenance field — the exact class of thing this item exists to stop.
The build that deployed the engine is identified in [`RELEASE_LEDGER.md`](RELEASE_LEDGER.md).

---

## 6 · Authorization

| Operation | Gate | Precedent |
|---|---|---|
| preview / dry-run | `superAdmin`, **or** tenant `owner` whose token `tenantId` equals the body's | `canWriteSensitiveFinance` |
| apply / adjust | **`superAdmin` only** | `salownRotaBootstrapTenant`, `salownRotaSeedTenantHistory` |
| read a snapshot | `isSuperAdmin() \|\| isFinanceReader(tenantId)` (owner\|admin) | `FIN-AUTH-CLOSURE · B` |
| any browser write | **denied, in every role** | `SEC-CATCHALL-1` |

`admin` may **read** a stored month and may **not** propose one — an admin can already open Finance,
and freezing a salon's accounts is not a salon-level operation.

Access is resolved **first**, so a suspended owner is `ACTOR_OFFBOARDED` rather than being waved
through by a role still written in their document; super-admin is checked after that, because
break-glass answers *"may this session act without a staff record"*, never *"may a revoked account
act"*. The decision is re-taken **inside the transaction**, as its first read.

**`tenantId` is the top-level TARGET SELECTOR** (§2.1, amendment A1–A10). A super-admin token
carries `tenantId: ''` — there is nothing to derive — and `SEED_REQUEST_KEYS` names it for the same
reason. It is never an authority input: a non-super-admin caller must present a token whose
`tenantId` **equals** the body's, so the body can select a tenant it already has a claim for and can
never select somebody else's. A nested or renamed selector is refused.

**Refused by name, at any depth:** `actor` `actorRef` `actorRole` `uid` `email` `superAdmin` `role`
`closedAt` `closedBy` `readCeiling` `cutoff` `sourceSha` `provenance` `contentHash` `documentHash`
`previewContentHash` `approvedPreviewHash` `approval` `approvalActor` `approvalAt`
`acceptedDifferences` `audit` `schemaVersion` `status` `timezone` `currency` `rollback`
`adjustments` **`wagesTotal_m`** **`netPL_m`** `operating` `cash` `capital` `liabilities`
`appendedAt` `before_m` `delta_m` `nowMs` `nowInstant` `serverTimestamp` `attachExtraWrite`.

### 6.1 · The server-owned release allowlist

**Authorization answers *who*. This answers *what may be touched at all*, and it is a separate
question with a separate failure mode.**

`PRODUCTION_PERIOD_RELEASE_POLICY` in `functions/src/finance/periodClose.ts` is a **frozen module
constant** naming the exact (tenant, period) pairs a production call may name:

| Tenant | Released periods |
|---|---|
| `whitecross` | `2026-02` `2026-03` `2026-04` `2026-05` `2026-06` `2026-07` |

Everything else is refused with the stable reason **`PERIOD_NOT_RELEASE_AUTHORISED`**: `2026-08`,
every later period, every earlier unlisted period, **HeroHairs**, every other tenant, and a
malformed or caller-extended policy (a policy whose entry is not an array of strings decides
`false`, so a substitution cannot widen anything by being malformed).

**Why it is not `CURRENT_PERIOD_OPEN`.** `periodGate` answers a CALENDAR question — is this month
over in the tenant's own timezone — and that answer **moves by itself**. August 2026 becomes
historically eligible the moment September begins in Europe/London, and on that day a
calendar-only gate would start accepting an August close that nobody released. The allowlist
answers a **rollout** question and does not move with the clock.

**Where it sits.** FIRST — after the pre-authorization staff read, and **above** the tenant document
read, above the `op` branch and above the `dryRun` branch. So it guards **preview, apply and adjust
alike**: an unauthorised production dry run cannot be used to stage an August close, because a dry
run is what produces the `planDigest` an apply must carry back. An unreleased target therefore costs
exactly one staff-document read and nothing else.

**Where it may not come from:** the request body (naming it is `INVALID_INPUT` — it is not in
`PERIOD_CLOSE_REQUEST_KEYS`), the UI, tenant settings, `settings/settings`, a public Firestore
document, an environment variable, or any other caller-supplied value.

**How tests reach it, without a production override.** Two ways, neither of which is one:
`decidePeriodRelease` is **pure** and takes the policy as its first argument, so the unit suite
hands it any policy it likes; and the emulator suite registers the throwaway tenants it creates
through `__setPeriodCloseTestReleasePolicy`, which **throws unless `FIRESTORE_EMULATOR_HOST` is
set** and is re-checked at the read — the `__setPeriodCloseTestBarrier` treatment exactly. The plain
unit suite fires that negative control under exactly the production condition and asserts the
callable shell neither imports nor mentions it; emulator `R27` drops the override and shows the
production policy is what refuses.

**Both gates run, and neither hides the other.** The calendar gate is asserted separately — on the
domain (`periodGate`), through the core for a **released** month viewed from inside itself (§6a in
the unit suite), and against the real backend (emulator `R16`).

---

## 7 · Retry and concurrency

* **`dryRun` defaults to `true`.** A non-boolean is refused rather than coerced, so `dryRun: 'false'`
  can never become a write.
* The apply must carry back the exact **`planDigest`** the dry run produced — a fingerprint over the
  tenant, the period, the content identity of the proposed record **and every source identity**.
* **Close vs close** is `create`-only inside one transaction. At most one commits; the loser leaves
  no snapshot and no audit. An identical replay is `ALREADY_CLOSED_IDENTICAL` (zero writes, and a
  retry may treat it as success); a different close on the same period is `ALREADY_CLOSED`.
* **Close vs source mutation**: every bounded source is re-read *inside* the transaction and every
  identity recomputed; `detectSourceDrift` decides. Any add, remove or change refuses with zero
  writes.
* **Snapshot + close audit commit atomically.** The audit id is derived from
  `tenantId + periodKey + contentHash`, so the same close always writes the same id.
* **Authority revoked before commit** ⇒ zero writes.
* **Adjustment replay** is decided on **intent** (reason, evidence, target, `after_m`), not on
  bytes: `appendedAt` and the derived `before_m` both move once the first append has landed, so a
  byte comparison would turn every legitimate retry into a conflict. Same id + same intent ⇒
  `ADJUSTMENT_IDEMPOTENT`, zero writes. Same id + different intent ⇒ `ADJUSTMENT_CONFLICT`.

### 7.1 The residual window, stated rather than hidden

A row written **between the transaction's read and its commit** is, by `cutoff.readCeiling`'s own
definition — *"A document whose `updateTime` is LATER than this is drift, not input"* — outside the
frozen month by construction. It becomes a post-close **adjustment**, which is the designed path for
it and not a gap. What the in-transaction re-read closes is the **preview → commit** window, and
that is proved on the emulator rather than argued.

---

## 8 · Adjustments — the "both views, no double-count" rule

A post-close correction:

* updates the closed month's **effective** view through `effectivePeriodTotals` (folded once);
* is exposed to the **current open month** as a separate **prior-period-adjustment** line;
* is **non-operating** in the current month and does **not** alter its operating Net P&L;
* carries actor, reason, `evidenceRef`, `before_m`, `after_m`, `delta_m`;
* must name a **stable staff id** when adjusting wages — an unattributable payroll correction is the
  defect this whole item exists for;
* may never target `netPL_m` or `wagesTotal_m` directly (`ADJUSTMENT_TARGET_DERIVED`) — an identity
  is not an input, and a correction has to name the component it actually changes;
* never rewrites the base. `before_m` is **derived** from the current effective view, so stacked
  corrections compose.

**The canonical composition rule:**

```
ALL-TIME  =  Σ effectivePeriodTotals(closed period)  +  Σ reconstruction(open period)
```

An adjustment enters that sum **exactly once**, through its own period's effective totals. The
current month's prior-period line is a **memo** computed from the same adjustments and is never an
addend — and that is enforced *structurally*, not promised: `composeAllTimeTotals` takes decisions
and reconstructions, and **there is no argument a memo could arrive through**
(`financePeriodCloseReader.test.ts` asserts `composeAllTimeTotals.length === 2`).

**Sign convention:** the memo's `netPL` is the effect on the **closed** month's operating result, so
a +£50 wage correction shows as **−£50**. Cash, capital and liability corrections are absent from
the operating memo — they are not operating P&L in the closed month either (invariants 6 + 7).

A month a correction lands in is the **tenant-local** month it was *appended* in, resolved through
`periodKeyForInstant`. Appended at `2026-08-31T23:30Z`, it is a **September** line in London.

---

## 9 · Reader precedence and failure

`FINANCE_PERIOD_CLOSE_MODE: 'legacy' | 'closed'` — ships **`'legacy'`**.

1. a **valid** frozen snapshot for an **eligible past** month;
2. otherwise **dated** reconstruction when `FINANCE_ROTA_HISTORY_MODE === 'dated'`;
3. otherwise **legacy** reconstruction.

The snapshot wins over the dated reconstruction and not the other way round: the snapshot is the
figure a settlement was signed against, the reconstruction is an opinion formed today. **If they
disagree, the disagreement is the finding**, and the way to act on it is an attributable adjustment
— not a silently better number.

| Situation | Answer | Direction |
|---|---|---|
| mode `'legacy'` | never read `financePeriods`; **zero** extra Firestore reads; behaviour byte-for-byte as before | — |
| valid snapshot, eligible past month | effective closed totals | authoritative |
| **no** snapshot (never closed, denied, offline) | reconstruct | **fail open** |
| current/future month, no snapshot | reconstruct (it is an open month) | — |
| snapshot fails `validateClosedPeriod` | refuse; surface codes | **fail closed** |
| content no longer hashes to `audit.approvedPreviewHash` | refuse | **fail closed** |
| no approval identity at all | refuse (`SNAPSHOT_UNAPPROVED`) | **fail closed** |
| supplied document hash mismatches | refuse | **fail closed** |
| snapshot for a period this reader's calendar says is open | refuse (`SNAPSHOT_PERIOD_NOT_ELIGIBLE`) | **fail closed** |
| stored timezone ≠ tenant timezone | refuse (`SNAPSHOT_TIMEZONE_CONFLICT`) | **fail closed** |

**Why the standing integrity check works.** `contentIdentity` deliberately excludes `adjustments`,
`audit` and the closing event, so appending a correction does **not** break the approval-hash check
— which is exactly what makes it usable forever rather than only at close time.

**Why the fail-closed break is right.** Everywhere else in Finance an absent record falls open,
because an absence must never zero a wage. But a stored-but-wrong record silently replaced by a live
recomputation is indistinguishable, **on screen**, from a working close — it would look exactly like
today, which is the state this item exists to leave behind. A month that fails closed contributes
**nothing** to any total and is **named** (`failedPeriods`), so a total is never quietly short by a
month nobody mentioned.

**Absence is counted.** `fetchClosedPeriods` returns `{requested, found, absent, unreadable}` and
Finance renders the `unreadable` count. A denied read and a month never closed are the same absence
to the reader *on purpose* — the diagnostic is the only thing that can tell them apart, and without
it a permissions regression looks exactly like a tenant that has never closed a month.

---

## 10 · Finance wiring, and its stated boundary

The override lands in `partnershipByMonth` **before** `companyNetPL`, so the partnership table,
`rawPL`, every partner's `hisseden`, the settlement preview and `ExitSettlementCard` all follow the
frozen figures through the **same expressions** — no second P&L arithmetic anywhere.

**Deliberately NOT wired, each for a reason:**

| Surface | Why not |
|---|---|
| per-person partner/staff ledgers (consumers 3–5) | a snapshot's `wagesByStaffId` is the **operating**-cost attribution (`startBasis: 'wage'`, consumer 2/6 — the figure `wagesTotal_m` sums to). Consumers 3–5 answer an **employment**-basis question on purpose, because a partner-era wage belongs in February's P&L and **not** in the employee ledger a settlement reads. Pushing one basis into the other would silently merge two the codebase keeps apart by design. |
| the P&L waterfall (`plTotals`) | `plTotals = monthlyTotalsAll` is a **structural pin** of ADR-024 / `FIN-PL-SCOPE-P0`, asserted on the source by `financeSummary.test.ts:964/1027` and `financePlScope.test.ts`. Re-binding it is a scope change that would require editing a Finance parity test this package may not touch. **Tracked as `FIN-PERIOD-CLOSE-C`**, together with the read-only closed-period badge §14 defers. |
| day / week scopes, and the G4 weekly wage ledger | a snapshot is **month**-scoped. A monthly total carries no per-day allocation and inventing one would be fabricating figures nobody closed. |

`ExitSettlementCard` shows the provenance of the month it is about to pay on — **CLOSED MONTH** vs
**LIVE FIGURE** — so a repayment is never suggested from a moving number without saying so.

---

## 11 · Rules

```
match /financePeriods/{periodKey} {
  allow read:  if isSuperAdmin() || isFinanceReader(tenantId);
  allow create, update, delete: if false;
}
match /financePeriods/{periodKey}/{sub=**} {
  allow read, write: if false;
}
```

…**and** `coll != 'financePeriods'` added to **both** `[G4]` catch-all read matches.

**The two halves must deploy together.** Firestore ORs across every matching rule, so the explicit
block is worth nothing while the catch-all still grants `read` to `isTenantAny` — the wider grant
simply wins and every barber keeps the wage table. `test/rules/financePeriods.emulator.test.js` §4b
is the negative control: it shows an *unlisted* collection still readable tenant-wide under the same
ruleset, for the same principal, and `financePeriods` not.

**Known and asserted:** a browser super-admin still **reads** below a closed month, because
`SEC-CATCHALL-1` deliberately retained the root wildcard's super-admin READ grant while removing its
write grant. **Write is refused for super-admin too**, which is the half that matters. §4a asserts
both halves so the distinction cannot quietly change.

**No index is added.** `firestore.indexes.json` is untouched — a period-key document get needs none,
and a collection-group query over money-adjacent data is exactly what this design avoids.

---

## 12 · Audit

| Action | Id derived from | Carries |
|---|---|---|
| `FINANCE_PERIOD_CLOSED` | `tenantId + periodKey + contentHash` | actor · approval actor/instant/hash · `contentHash` · `documentHash` · `planDigest` · `approvalRef` · `readCeiling` · rollback identity · **counts only** |
| `FINANCE_PERIOD_ADJUSTED` | `tenantId + periodKey + adjustmentId` | actor · `evidenceRef` · section/field · `appendedAt` · base `contentHash` (unchanged by the append) + new `documentHash` |

No money, no staff id, no display name. A payroll report is not an audit line, and these documents
are readable wherever `auditLogs` is — asserted in `periodClose.test.js` §7d.

---

## 13 · Test and gate record (2026-08-18, source only)

| Gate | Result |
|---|---|
| Phase-A domain + preview (**byte-unchanged**) | **120/120** |
| new frontend suites (cutover 5 · actions 11 · reader 41) | **57/57** |
| full frontend | **4247/4247** (143 files) |
| functions `node:test` | **1810 tests, 1774 pass, 0 fail** (36 self-skip without the emulator; was 1751) |
| twin parity (golden replayed against both) | **20/20** |
| server unit matrix | **38/38** |
| **finance emulator races** | **21/21** on the pinned emulator (general phase 451 → 472) |
| full functions emulator gate | **499/499** (general 472 · packages 27) |
| rules emulator, 6 suites | **114/114** — `financePeriods` **14/14**; the other five unchanged at 100 |
| both typechecks · both builds | clean |
| scoped lint | clean, with a **firing** negative control (probe restored) |
| `ops/rules-authority` · `deploy-policy` · `functions-ownership` | 30 · 28 · 61 |
| `release-guard` | every outgoing commit `[skip ci]` |
| export count | **77 → 78**, exactly `salownCloseFinancePeriod` |

**Winner distributions printed (the S1-EV1 lesson):** R1 identical closes 3/3 · R2 different closes
4/2 · R11 concurrent adjustment replay 4/1 — both directions really executed. R3b (mutation racing
the apply) measured **0 committed / 6 refused** and R14b **0 committed / 4 refused**; those
committed branches are exercised **causally** instead, by R8b (an out-of-period change does not
block) and R15a (both close-vs-close winner directions forced by ordering).

**A guard caught a real defect in this change.** `ops/rules-authority.test.js`'s SEC-CATCHALL-1
mutation control replaces the *first textual occurrence* of the root read grant. A comment I added
quoted that clause verbatim, absorbed the mutation, and made the control vacuous. Reworded, and the
reason is recorded at the clause so it does not recur.

---

## 14 · Rollout order, and what is still blocked

```
1  FIN-ROTA-SEED-S1 / S1-EV1 / FIN-ROTA-HISTORY-READ-S2      source-complete, PUSHED_NOT_LIVE
2  FIN-PERIOD-CLOSE Phase A + B + B-conformance + C          source-complete, PUSHED_NOT_LIVE
2b SALOWN-FIN-ROTA-INTEGRATION-GATE (amendment + allowlist)  source-complete, PUSHED_NOT_LIVE  ← here
3  coordinated release: functions (targeted) → hosting:salown → rules
4  FRESH salownRotaBootstrapTenant dryRun (every earlier sourceFingerprint is void)
5  blocking[] EMPTY — Muhamed and every remaining subject settled BY that dry run
6  ROTA-HISTORY-SEED applied per subject, each plan separately owner-approved
7  ROTA-BOOTSTRAP-APPLY                                       currently BLOCKED
8  FINANCE_ROTA_HISTORY_MODE 'legacy' → 'dated'  (whitecross)
9  verify no past month moved
10 FINANCE_PERIOD_CLOSE_MODE 'legacy' → 'closed'  (zero snapshots ⇒ zero change)
11 FIRST close: OLDEST eligible month only, dry-run → owner approval → apply
   ⛔ August 2026 is structurally ineligible and stays OPEN
   ⛔ AND August is absent from the §6.1 release allowlist, so it refuses
      PERIOD_NOT_RELEASE_AUTHORISED even after September makes it eligible
```

**The oldest eligible month is `2026-02`, and steps 11's candidate set is exactly the six periods in
§6.1.** Adding a seventh is a source change to a server-owned constant plus a new release — it is
deliberately not a configuration change, a settings edit or a request field.

⚠️ **Nothing in this document authorises any of steps 3–11.** As of 2026-08-19 every one of them is
outstanding: no deploy, no production dry run, no seed, no bootstrap, no mode flip, no close, no
adjustment, no `financePeriods` document in any tenant.


**Rollback.** Code: set the constant back to `'legacy'`, commit, deploy hosting — complete, not
partial, because an unread snapshot changes no figure. Data: delete the one document by exact path,
under its stored `restoreTo: 'ABSENT'` plan, super-admin only, outside the product.
⚠️ **Adjustments are append-only and are not reversible by code**, exactly as `ROTA-SSOT-2` records
for the rota log.

### 14.1 Release blockers that are NOT closed by this package

> ⚠️ **Corrected 2026-08-19 by `SALOWN-FIN-ROTA-INTEGRATION-GATE`.** Items 1–4 below were written on
> 2026-08-18 and **four of the six are now closed in source**. They are rewritten rather than
> annotated, because a blocker list that names a file which no longer exists is worse than no list.
> **None of the closures is deployed**, so every one of them is `PUSHED_NOT_LIVE`.

1. ~~**The divergent live premium-panel Finance.**~~ **CLOSED IN SOURCE — `PUSHED_NOT_LIVE`.**
   `whitecross-site/barber-panel/src/pages/Finance.js` was **removed** at `58587c22`
   (`LEGACY-PREMIUM-FINANCE-CLOSURE`, whitecross-site `f2577871`) and **must no longer be described
   as reachable**. Verified against the merged tree and a fresh build: the file is absent, no
   `Reports.js` route reaches it, the Marketing AI context no longer carries its duplicate engine,
   the `£100` ghost fallback and the hardcoded/`localStorage` partner calculator are unreachable, no
   alternative P&L or settlement surface remains, the unrelated Reports/CSV exports survive, and a
   bundle **and source-map** scan finds the deleted engine only inside comments in the files that
   replaced it. ⚠️ **The currently SERVED premium artefact still predates the removal**, so the
   divergent engine is live until `whitecrossbarbers-admin` / `-owner` are redeployed.
   ⚠️ **Canonical-link limitation, recorded exactly:** the replacement panel links to salOWN through
   `REACT_APP_SALOWN_APP_ORIGIN`, which is **currently unconfigured** (no `.env` in the repository);
   without it the safe deprecation notice stands. No origin is invented or hardcoded, no
   authentication token is passed in a URL, and the lack of cross-origin SSO may require a fresh
   sign-in. None of that restores the legacy Finance engine.
2. ~~**`ROTA-SSOT-2`**~~ **CLOSED IN SOURCE — `PUSHED_NOT_LIVE`** (`fe57640`). One authoritative
   `ROTA_OVERRIDE` server action, every browser `shiftChanges` writer removed, the rules
   affected-field guard present with no role exception, dated-override precedence, legacy parity,
   deterministic event/audit identity, and the backdated reason/evidence/attribution gate.
   **Not deployed:** the live `salownRotaTransaction` predates `ROTA_OVERRIDE` and the production
   ruleset is unchanged, so the browser-writable map is still live.
3. ~~**`FIN-PERIOD-CLOSE-C`**~~ **CLOSED IN SOURCE — `PUSHED_NOT_LIVE`** (`2e285e3`). The P&L
   waterfall reads the closed record through `plTotals` built FROM `plTotalsReconstructed =
   monthlyTotalsAll` (the ADR-024 pin moved, not weakened), and the read-only closed-period panel
   ships with six deterministic states. `FINANCE_PERIOD_CLOSE_MODE` is still `'legacy'`, so **zero
   `financePeriods` reads are issued**.
4. ~~**The reader's day bucketing is the browser's timezone.**~~ **CLOSED IN SOURCE for Finance —
   `PUSHED_NOT_LIVE`** (`2e285e3`). Finance now buckets an instant through `useLocale().dateKey`, the
   same TR-A presentation contract the timezone already came from, so a reader in any device
   timezone receives the **tenant's** boundaries — Europe/London for Whitecross.
   ⚠️ **State it exactly:** this is a correctness fix and it **can change which month a boundary
   booking falls in** for a reader outside the tenant zone. **Exact parity** is claimed only where
   the browser and tenant boundaries already agreed; where they differed the answer is an
   **authoritative tenant-timezone correction**. **Universal byte-for-byte legacy parity across
   different browser timezones is NOT claimed and must not be.** There is one timezone source and no
   second one. **App-wide `toDateKey` is deliberately outside this change** — its blast radius is
   every screen — so a non-Finance surface may still bucket in the browser zone; that remains
   separately scoped. Tests: `financePeriodCloseReader.test.ts` §C5 and §C5b (London read from UTC,
   Istanbul, New York, Tokyo and Auckland, across both UK DST transitions and month boundaries).
5. **≈£569.97** Feb–Jun workbook-vs-system difference and the workbook's ≈**£711** internal
   inconsistency — documented, unbridged, and not to be bridged with an invented figure.
6. **≈£7,939** exit liability — excluded by the baseline; its representation is a separate
   owner-authorised accounting migration.

7. **Neither Finance mode has moved.** `FINANCE_ROTA_HISTORY_MODE` and `FINANCE_PERIOD_CLOSE_MODE`
   both read `'legacy'` in source, and no tenant period has been closed. **August 2026 is OPEN.**
8. **No production release has happened.** `salownCloseFinancePeriod` is absent from the live
   function surface, `firestore.rules` and `firestore.indexes.json` are unchanged, and the export
   count stays **78**.

---

## 15 · Integration record — 2026-08-19 (`SALOWN-FIN-ROTA-INTEGRATION-GATE`)

Source only. **No deploy, no production access, no seed, no bootstrap, no close, no adjustment, no
migration, no mode flip.**

**Merged from four completed parallel tracks**, each verified against the combined tree rather than
its own report: `ROTA-SSOT-2` (`fe57640`, settled `687936a`) · `LEGACY-PREMIUM-FINANCE-CLOSURE`
(whitecross-site `f2577871`) · `FIN-PERIOD-CLOSE-C` (`2e285e3`, settled `8cdaa83`) ·
`FIN-PERIOD-CLOSE-B-CONFORMANCE` (`9b0277e`, settled `2258701`). Every implementation commit was
proven an ancestor of its repository's final HEAD before anything was edited.

**Landed here:** the §2.1 owner tenant-selector amendment and the §6.1 server-owned release
allowlist, at `4f7aa65`.

**Gates on the exact combined committed tree:** period-close unit **51 → 73** · functions
`node:test` **1891** (1854 pass, 37 emulator self-skips, 0 fail) · frontend **4376/4376** across 145
files · Firestore emulator gate **523/523** (general 496 · packages 27) · rules emulator **123/123**
across 6 suites · fold twin parity **70/70** · period-close twin parity **20/20** · both typechecks ·
salown production + staff builds · whitecross admin/owner build (one `barber-panel/build` serves
both hosting sites) + bundle/source-map reachability scan · legacy Finance closure **37/37** ·
scoped lint clean with a **firing** negative control · `deploy-policy` **28** · `rules-authority`
**30** · `functions-ownership` **61** · release-guard OK · claims selftest + **45/45** ·
export-count **78** · `git diff --check` clean.

**Baseline recorded separately, not dismissed:** `whitecross-site/barber-panel/src/App.test.js` is
the untouched CRA scaffold test (`renders learn react link`) and it FAILS — reproduced as the
pre-change baseline at **1 failed / 70 passed / 71 total**, and identical after, because
`whitecross-site` was not modified by this package.

**Still blocking a production release:** every item in §14.1, plus owner authorisation of the §14
rollout order itself.
