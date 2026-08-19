# `ROTA-HISTORY-SEED-PREFLIGHT` — can the canonical rota tell Alex's real history?

> ### Verdict
> ```
> HISTORICAL_SEED_CHANGE_REQUIRED
> ```
> The read model is ready. **The writer is missing.** No sanctioned writer can put the past into
> the canonical log, so a bootstrap applied today would freeze a schedule that is true only from
> today and say nothing about the six months Finance is actually replaying.

**Read-only source audit, 2026-08-18.** Anchored to `salown-app` @ `dd3e772` (tree identical to
release anchor `ef5c0ed`) and `whitecross-site` @ `18946538`.

**Nothing was executed against production** *when this audit was written*. No production read, no
production write, no bootstrap invocation of any kind (not even `dryRun`), no callable invocation,
no Auth access, no migration, no edit, no claim, no deploy. Every statement in §§1–10 is a citation
of source at those two commits.

> ⚠️ **That sentence is no longer true of the tenant as a whole.** A production **dry run for
> `whitecross` was executed on 2026-08-19** under the owner approval
> `APPROVE PROD BOOTSTRAP DRYRUN whitecross`. It wrote nothing. Its result, its limits and what it
> does *not* license are recorded in **§11** at the end of this document. §§1–10 are left exactly
> as audited.

**Why it was run.** `FIN-DATED-ROTA-R2c` is live (`RELEASE_LEDGER.md` → `R-2026-08-17-A`) and the
next step in the release order is the Whitecross canonical bootstrap. Before applying an
**append-only, irreversible** cutover, the question is whether the thing being frozen is true.

---

## 1 · The accepted owner evidence this was tested against

Tenant `whitecross`, subject **Alex**, `barber-1777257519766`. Pay policy: **daily £100 per worked
day; a partial day is still one full wage day.**

| | |
|---|---|
| Base, effective **2026-02-06** | Tuesday **off**; works Mon, Wed, Thu, Fri, Sat, Sun |
| **11 owner-approved worked Tuesdays** | 2026-02-10 · 02-17 · 03-10 · 04-28 · 05-26 · 06-30 · 07-14 · **07-21** · 07-28 · 08-04 · 08-11 |
| 2026-07-21 | shift **17:00–19:00** — still one full wage day |
| 4 confirmed-off Tuesdays | 2026-06-02 · 06-09 · 06-16 · 06-23 |
| Current open-ended change | Tuesday enabled **from 2026-08-16**, open-ended. **This is not evidence that earlier Tuesdays were recurring workdays** |
| Finance today | **£2,300** Tuesday wage · accepted historical figure **£1,100** · **replay overstatement £1,200** |

---

## 2 · What the bootstrap would actually write today

**One transaction. One entry. Nothing historical.**

`rotaBootstrap.ts:492-509` issues exactly one `appendRotaChange(... action: 'ROTA_START' ...)` per
eligible subject:

| Field | Value |
|---|---|
| origin / type | `ROTA_START` / a single `ROTA_OPEN` |
| lane | `null` |
| **effectiveFrom** | **the tenant's today (2026-08-18)** — never `availabilityFrom` |
| effectiveTo | **`null`**, open-ended (`rotaWriter.ts:986`) |
| pattern | read from the barber document as it stands: `scheduleMode:'weekly'`, `workingDays` = the **current seven days**, plus `dayHours` / `hours` |
| expectedRevision / hash | `0` / `ROTA_CHAIN_GENESIS` |
| changeId | `rota-bootstrap-<effectiveFrom>-<digest>` |

Alongside it: the rota header, an append audit record, one tenant-level bootstrap audit document,
and the `rotaPolicy/rollout` flip if no subject is blocking.

**Total for Alex: one event, describing today forward. Zero entries describing 2026-02-06 → 2026-08-17.**

### It does **not** misplace the seven-day pattern at `availabilityFrom`

It cannot. `rotaBootstrap.ts:362-367` refuses a backdated cutover outright:

> `'a cutover may not be backdated; the canonical log begins on the cutover date and the period before it stays legacy'`

The module is deliberately **stricter than the engine in both directions** (`rotaBootstrap.ts:20-36`):
the engine would permit a `ROTA_START` back to a stored `availabilityFrom`, but for a *migration*
that is a restatement of days already worked and already priced.

### …and that correctness buys nothing, because the silence is not protection

**Finance never reads the log.** The only product importers of `rotaFold` are `rotaActivation.ts`,
`rotaBootstrap.ts`, `rotaWriter.ts` and `src/utils/rotaIntent.ts`. Finance resolves a day from
`barbers.workingDays` + `shiftChanges` (`financeWages.ts:323-333`). So after the bootstrap:

- the canonical log is **truthful but silent** about the past;
- `barbers.workingDays` is still the seven-day array, still replayed over every historical Tuesday;
- **£2,300 / +£1,200 is completely untouched.**

One thing does change, and not for the better: because `effectiveFrom == today`, the engine
**publishes** the cache, so that seven-day array becomes **server-authored**. The value does not
move; the authorship does. And after the flip the rules deny direct client writes to those three
fields — so the wrong number becomes *harder* to correct, not more correct.

---

## 3 · Once canonical, no sanctioned writer can add the past

| Action | Backdating | Authority |
|---|---|---|
| `ROTA_START` | 🟡 **permitted** back to a stored `availabilityFrom` | `rotaWriter.ts:958-982`. Alex has `availabilityFrom = 2026-02-06`, so a single backdated start **is** reachable through `salownRotaTransaction`. The UI caps at today; the callable does not |
| `ROTA_CHANGE` | ❌ **never** | `rotaWriter.ts:1006` — *"a rota change may not take effect in the past."* The rule the wage incident bought |
| `ROTA_END` | ❌ **never**, at any date | `rotaActivation.ts:183-194` refuses `effectiveTo >= today`; the writer's `BACKDATED` refuses anything earlier. EV.2 closed both ends |
| `ROTA_SUPERSEDE` | n/a | see §4 |
| `ROTA_IMPORT` | — | **not implemented.** `rotaWriter.ts:240-243`: *"Backfilling history that predates the log is `ROTA_IMPORT`"* — deliberately absent from R2 |

**Consequence.** Exactly one backdatable event exists, and it is the single opening `ROTA_START`.
Every subsequent dated segment needs a `ROTA_CHANGE`, which is hard-refused in the past. Even the
owner's own 2026-08-16 seven-day change can no longer be entered — that window shut when the date
rolled over.

---

## 4 · `ROTA_SUPERSEDE` cannot repair effective history

Its entire key set is (`rotaFold.ts:163-166`):

```
['entryId','changeId','prevHash','type','lane','origin','audit','targetChangeId']
```

**No pattern. No `effectiveFrom`. No `effectiveTo`.** Its only semantic is to withdraw an entire
earlier transaction — backwards only, not itself, not another supersession (`rotaFold.ts:826-856`),
origin `ROTA_CORRECTION` (`rotaWriter.ts:251`).

It is a **retraction device, not an authoring device.** It can unsay a mistake; it cannot say what
should have been there instead. Of the three things the accepted history needs — a six-day base at
2026-02-06, eleven dated Tuesdays, a seven-day change from 2026-08-16 — supersede expresses **none**.

---

## 5 · The fold **can** represent this. Nothing can write it.

This is the pivot of the whole audit, and it is good news.

| Capability | Read model (fold) | Writer |
|---|---|---|
| Bounded period (`effectiveTo` set) | ✅ schema-legal; validation only rejects `effectiveTo < effectiveFrom` (`rotaFold.ts:605-610`) | ❌ both emitters hardcode `effectiveTo: null` |
| Single-day period (`from == to`) | ✅ legal and correctly resolved by `periodCoversDate` | ❌ no action produces one |
| **Multi-open import transaction** | ✅ **already specified and already validated** — `validateGroupShape` carries a `ROTA_IMPORT` case: *"ROTA_IMPORT holds only ROTA_OPEN"* (`rotaFold.ts:694-696`) | ❌ nothing emits it |
| Twin parity | ✅ **identical in both copies** — `src/utils/rotaFold.ts:810-811` | — |

So a historical seed needs **no change to the event schema, no change to either fold twin, and
almost certainly no rules change** (`staffRota/**` is already server-only). What is missing is a
**tested, authorized writer**.

Two things that look like they might help, and do not:

- **`by_exception` is not a per-date mechanism.** It means a *deliberate zero-day week*, requires an
  empty `workingDays` (`rotaFold.ts:454-460`), and publishes nothing.
- **Lanes are a LOCATION concept, not an exception overlay.** Precedence keys on a `locationId` the
  caller supplies (`rotaFold.ts:989-1013`), and no Finance reader supplies one. Same-lane overlap is
  forbidden, so a dated exception must be a **split of the base period**, not a layer over it.

**Partial-day is the one genuine representation gap.** `dayHours` is keyed by *weekday*, not by
date, so "17:00–19:00 on 2026-07-21" cannot be stated as such. Inside a one-day period it becomes
expressible — `dayHours.Tuesday = {open:'17:00', close:'19:00'}` for that period alone — which is
another reason the seed must be built from bounded periods rather than from overrides.

---

## 6 · `shiftChanges` stays outside the log — and Finance still reads it first

**Zero** occurrences of `shiftChanges` in `rotaBootstrap.ts` and `rotaWriter.ts`. It is neither
folded into the canonical log nor cleared by the cutover. The rules deliberately keep it
client-writable. And it outranks everything in the wage decision (`financeWages.ts:328-331`):

```ts
const sc = barber?.shiftChanges?.[dk]
if (sc?.closed) return false
if (!sc && opts.onLeave) return false
const wdays = ...
if (wdays.length > 0) return !!sc || wdays.includes(dayName)
```

So after the flip, a tenant whose rota is a server-owned append-only history still has an **undated,
unaudited, browser-writable override map sitting above it that Finance consults first.**

**Reconciling it against the accepted history, honestly.** Alex carries **12** `shiftChanges` keys.
The accepted evidence records, of 27 historical Tuesday candidates, **4** with a `closed` override
and **5** with an already-open override. So of the **15** accepted dates (11 worked + 4 confirmed
off), `shiftChanges` corroborates **9**; **6 of the 11 worked Tuesdays exist only in owner
testimony**, and the remaining 3 keys fall on non-Tuesday dates. `shiftChanges` is therefore neither
a source of truth for the seed nor a usable fallback.

---

## 7 · Finance cannot reconstruct the accepted wage days

Two independent reasons, either sufficient:

1. **No Finance module imports the fold** (§2).
2. **Even if it did, the log would be empty for that period.** After a bootstrap the log holds one
   period starting today. `rotaVerdictForDate` answers `outside` / `NO_PERIOD_COVERS_DATE` for every
   historical Tuesday — which is **not** the same answer as "did not work" — and nothing
   distinguishes the 11 worked Tuesdays from the 4 confirmed-off ones.

**£1,100 is not derivable from canonical data. £2,300 stands.**

---

## 8 · The smallest safe change — `FIN-ROTA-SEED`

A **server-only `ROTA_IMPORT` seed builder**. The change lives in the *writer*, not the model.

1. **New builder** (e.g. `functions/src/staff/rotaSeedImport.ts`) emitting, in **one** `ROTA_IMPORT`
   transaction, an ordered run of bounded `ROTA_OPEN`s in the default lane.
2. **Its own date gate**, without relaxing `buildAppend`'s: `effectiveFrom >= availabilityFrom`, and
   every period except the last bounded strictly before today. The `BACKDATED` rule for
   `ROTA_START` / `ROTA_CHANGE` stays exactly as it is.
3. **Reuse the bootstrap's two-phase contract** rather than inventing a second one: super-admin only,
   `dryRun` default true, per-subject fingerprint precondition.

### The accepted Alex plan — **24 segments**

| Kind | Count |
|---|---|
| Base six-day segments (Tuesday off) | **12** |
| Single-day special Tuesdays (Tuesday on) | **11** |
| Final open-ended seven-day period from **2026-08-16** | **1** |
| **Total `ROTA_OPEN` entries in one transaction** | **24** |

Roughly 28 writes including header, barber and audit — comfortably inside the 500-write transaction
limit.

**The 4 confirmed-off Tuesdays need no event at all.** They fall inside the base segment
2026-05-27 → 2026-06-29, which already excludes Tuesday. Correctness there is free.

**2026-07-21's partial shift** becomes `dayHours.Tuesday = {open:'17:00', close:'19:00'}` on that
one-day period. Wage-neutral under the owner's policy — one covered day is one full wage day.

**Target: £2,300 → £1,100**, i.e. the £1,200 overstatement removed.

> ⚠️ **The seed alone moves no money.** It makes the truth *sayable*. It does not make Finance
> *read* it.

### Sequencing is forced, and it is easy to get wrong

The bootstrap writes with `expectedRevision: 0` and `ROTA_CHAIN_GENESIS`
(`rotaBootstrap.ts:503-504`) — it only works on a **virgin** subject. So:

- seed first → the bootstrap marks Alex `REFUSED` (no longer at genesis);
- bootstrap first → its open-ended period from today **overlaps** the seed's final period
  (`SAME_LANE_OVERLAP`).

The two **cannot both run on the same subject.** For Alex, the seed must *replace* the bootstrap.

### Both of these are mandatory before any bootstrap apply

| Work ID | Why it blocks |
|---|---|
| **`FIN-ROTA-SEED`** | Without it the canonical log cannot state the accepted history at all, and the cutover is append-only and irreversible |
| **`FIN-ROTA-HISTORY-READ`** | Without it Finance never consults the log, so the seed is inert and £1,200 persists |

---

## 9 · Claim surface for the implementation

| Path | Why |
|---|---|
| `functions/src/staff/rotaSeedImport.ts` (+ `.test.js`, `.emulator.test.js`) | the new builder and its gate |
| `functions/src/staff/rotaWriter.ts` | expose the builder / shared helpers — **without touching the existing `BACKDATED` rule** |
| `functions/src/index.ts` | a separate super-admin callable export (76 → 77) |
| `firestore.rules` | **probably no change** — `staffRota/**` is already server-only and the seed goes through the Admin SDK. Must be proven, never assumed |
| `functions/src/utils/rotaFold.ts` + `src/utils/rotaFold.ts` | **probably no change** — the `ROTA_IMPORT` case already exists. If either moves, **claim both twins together** |
| UI | none for the seed itself; reviewing the plan on screen is separate work |
| `src/utils/financeWages.ts`, `src/pages/Finance.tsx` | `FIN-ROTA-HISTORY-READ` — **separate claim, separate release** |
| `docs/FIN_DATED_ROTA_R2C_DESIGN.md`, `docs/ROADMAP.md`, `docs/RELEASE_LEDGER.md` | the record |

---

## 10 · No new capability has to be unlocked

**Neither future activation nor `ROTA_END` is needed**, and both stay disabled:

- `ROTA_FUTURE_ACTIVATION_ENABLED` stays **false**. `futureActivationRefusal` fires only on
  `effectiveFrom > today`, or `effectiveTo >= today` for an END (`rotaActivation.ts:183-194`). A seed
  whose bounded periods all end before today and whose last period is open-ended from a past date
  trips neither branch.
- **`ROTA_END` is not required**: bounded periods come from the builder's own `effectiveTo`, not from
  an END action. The `ROTA_IMPORT` group shape *enforces* this — the group may contain **only**
  `ROTA_OPEN`, never a `ROTA_CLOSE` — so the design satisfies EV.2 structurally rather than by
  discipline.
- One item to verify when building: the cache-convergence rule for a **past-dated period that covers
  today** (the final segment). Expected behaviour is that it publishes the seven-day array, i.e. the
  value already stored.

---

## 11 · Evidence required before any apply

1. **A fresh `salownRotaBootstrapTenant` dry run.** Alex's document changed at **2026-08-16
   20:31:22**, so every earlier `sourceFingerprint` is void. The fingerprint covers exactly
   `workingDays`, `dayHours`, `hours`, `availabilityFrom`, `status` (`rotaBootstrap.ts:220-232`).
   Alex returning `ELIGIBLE` with a seven-day pattern is the **expected** result — and, if the goal
   is a truthful history, the result to **refuse** rather than approve.
2. **`blocking[]` empty** for the tenant flip; Muhamed and every other Whitecross subject settled by
   that dry run, not by widening any read-only probe.
3. **The seed's own dry run**: the full ordered period list (`from`, `to`, `pattern`) plus a seed
   fingerprint covering the same five fields **and the intended period list**, so the approval is of
   the exact history rather than of a summary figure.
4. **Apply carries every fingerprint back verbatim**; a subject whose source moved is refused.
5. **Post-apply**: header `revision` / `entriesHash` / `entryCount`, and a re-fold proving the 11
   worked Tuesdays resolve `covered` with Tuesday in the pattern, the 4 confirmed-off Tuesdays
   resolve `covered` **without** Tuesday, and 2026-07-21 carries `17:00–19:00`.
6. **The money proof is separate and comes later.** Finance will not move until
   `FIN-ROTA-HISTORY-READ` is live, so a £2,300 → £1,100 change is **not** evidence for the seed and
   must not be presented as such.

---

## 12 · What this audit did not do

No production document was read or written. No callable was invoked. **No bootstrap was run, not
even `dryRun`.** No migration, no edit to application source, no claim, no deploy. Nothing here
proposes editing a production barber document by hand — the whole point of a seed builder is that
history enters through an audited, append-only, server-authoritative door or not at all.

---

## 11 · The executed dry run — `whitecross`, 2026-08-19

**Approval:** `APPROVE PROD BOOTSTRAP DRYRUN whitecross` (owner, 2026-08-19).
**Deployed callable:** `salownRotaBootstrapTenant` at `salownrotabootstraptenant-00002-nuy`
(released the same day, `RELEASE_LEDGER.md` → `R-2026-08-19-A`).

### What was actually executed, stated precisely

The **authoritative compiled core** — `functions/lib/staff/rotaBootstrap.js`,
`bootstrapTenantRotaCore` — was run against **real production data** with `dryRun: true` forced,
through a Firestore shim exposing only `.doc(p).get()` and `.collection(p).get()`. The shim has no
`set`, `update`, `create`, `delete`, `add`, `commit`, `batch` or `runTransaction` method at all, so
a write was not merely forbidden, it was **unrepresentable**; `serverTimestamp` was replaced by a
function that throws. **8 Firestore reads, 0 writes.**

> ⚠️ **What this was NOT.** The deployed **callable** was not invoked. The harness supplied a
> synthetic actor `{ superAdmin: true }` directly to the core, which means the production
> authorization path — `staffActorFrom` reading a *verified* Firebase ID token — **was not
> exercised**. The classification below is authoritative because it is the same code over the same
> data; the auth gate is proven only by `rotaBootstrap`'s unit tests, not by this run. A true
> end-to-end callable dry run still requires an authenticated super-admin session.
>
> This route was chosen deliberately over minting a `superAdmin` custom token from a service
> account key: that would have **created a durable privileged session** in order to read three
> barber documents, which is disproportionate to a dry run and contrary to the standing rule that
> the `superAdmin` claim is never granted casually.

### Result

```
ok: true · dryRun: true · rolloutFlipped: false · rolloutMode: "legacy"
effectiveFrom: 2026-08-19 · todayKey: 2026-08-19 · blocking: []
```

| Subject | id | State | `availabilityFrom` | `status` | Working days |
|---|---|---|---|---|---|
| **Alex** | `barber-1777257519766` | **ELIGIBLE** | `2026-02-06` | active | all 7 |
| **Arda** | `barber-1777655430086` | **SKIPPED_PASSIVE** | `2026-02-06` | passive | 6 (no Wednesday) |
| **Muhamed** | `barber-1781007454543` | **ELIGIBLE** | `2026-06-09` | leave | 6 (no Monday) |

**Nothing blocks.** `STAFF-START-A2` paid off: all three carry a real `availabilityFrom`, so no
subject lands in `BLOCKED_NO_START_DATE`, and all three carry a pattern, so none lands in
`BLOCKED_NO_PATTERN`.

Three observations worth recording:

* **`status: leave` is ELIGIBLE, and that is correct.** The classifier skips only `passive`. Leave
  is not a reason to refuse to freeze a baseline pattern, because leave outranks the seed at read
  time in the precedence chain (employment window > dated override > approved leave > dated
  schedule change > seed/baseline). Freezing Muhamed's pattern does not make him bookable while on
  leave.
* **Arda's `workingDays` now excludes Wednesday**, which matches his real day off. The
  `["Wednesday"]`-only corruption recorded against `FIN-ARDA-REPAIR` is not present in the current
  data. He is skipped as passive regardless, so his pattern would not be frozen by an apply.
* **No rollout document exists** (`tenants/whitecross/rotaPolicy/rollout` → `NOT_FOUND`), so
  `rolloutMode` reports `legacy` by absence rather than by an explicit setting.

### Post-run state, verified

`rotaPolicy/rollout` **absent** · `staffRota/{barber-1777257519766,barber-1777655430086,barber-1781007454543}`
all **404** · `auditLogs/rota-bootstrap-2026-08-19` **404**. Nothing was created.

### ⛔ What this dry run does NOT license

A green dry run is **not** a recommendation to apply, and this document's own verdict is the reason.

`effectiveFrom` is **2026-08-19**. Applying the bootstrap today would freeze *today's* pattern as
the canonical baseline and say nothing about the six months Finance is actually replaying — which
is exactly the `HISTORICAL_SEED_CHANGE_REQUIRED` verdict at the top of this file. The writer that
answers it, **`salownRotaSeedTenantHistory`**, went live the same day at
`salownrotaseedtenanthistory-00001-tol` and **has never been invoked**.

So the standing order is unchanged: **do not apply the bootstrap** until the historical seed has
been run and reviewed. `FINANCE_ROTA_HISTORY_MODE` remains `'legacy'`; no tenant is canonical.
