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

---

## 12 · The executed seed dry run — Alex, 2026-08-19

**Approval:** `APPROVE PROD ROTA SEED DRYRUN whitecross barber-1777257519766`.
**Deployed callable:** `salownRotaSeedTenantHistory` at `salownrotaseedtenanthistory-00001-tol`.
**Executed:** the authoritative compiled core `seedTenantRotaHistoryCore` with `dryRun: true`,
against real production data, through an adapter exposing only `.doc(p).get()`.
**5 Firestore reads · 0 writes** — the adapter has no write method, so a write was unrepresentable.

> ⚠️ **The deployed callable was not invoked.** A synthetic `{ superAdmin: true }` actor was passed
> to the core directly, so the production auth shell (`staffActorFrom` over a verified ID token)
> **was not exercised**. Minting a privileged session for a read-only run was explicitly excluded.

### Result — `state: PLANNED`, no issues

| | |
|---|---|
| Source rota fingerprint | `ba3d051c59ab2f2e0499be3c24633acf6fb40679def14ef2cbe1c3985db85f94` |
| Seed plan digest | `f1cac381bd140db4daf38cf1750518740246bf516a4bfbf61ee7235c926637c6` |
| Change ID | `rota-seed-f1cac381bd140db4daf38cf175051874` |
| Audit ID | `rota-seed-barber-1777257519766-6c289aeb1ae60e30` |
| Expected revision | `0` → predicted `1` · genesis hash `17516577f8999903811e95a4f7918d24dd22b4a29c8cc6791ecec95a4dcdc2b3` |
| Predicted entries hash | `fbd79cc8d822445255ee78550475f6a5aa726dca1186b7719f3824c0df63e65d` |
| Origin | `ROTA_IMPORT` |
| Segments / entries | **24 / 24** · declared gaps `[]` · validation issues **none** |
| Covered range | `2026-02-06` → open-ended, final segment from **`2026-08-16`** (`coversTodayFrom`) |
| Header path | `tenants/whitecross/staffRota/barber-1777257519766` |
| Entries path | `…/staffRota/barber-1777257519766/rotaEntries/{entryId}` |
| Audit path | `tenants/whitecross/auditLogs/rota-seed-barber-1777257519766-6c289aeb1ae60e30` |
| Writes if later applied | **27** — 24 entry creates + 1 header create + 1 audit create + 1 barber publish update |
| Idempotent retry | **Yes.** A second identical dry run reproduced every derived value byte-for-byte. An apply carrying this digest back a second time lands `ALREADY_SEEDED` with zero writes (`header.lastChangeId === changeId`) |

**Proof nothing was written:** header `404` · `rotaEntries` **0 docs** · seed audit `404` · bootstrap
audit `404` · `rotaPolicy/rollout` **absent (unflipped, legacy by absence)** · Alex's barber document
`updateTime` unchanged at `2026-08-16T19:31:22.625534Z`.

### ⚠️ Finding 1 — `2026-07-13` — **RULED ON 2026-08-19, see §13. Alex WORKED it; the plan stands.**

`barbers/barber-1777257519766.shiftChanges` holds **12** keys overlapping the seeded range. Eleven
are consistent with §1. **One is not:**

| Key | Weekday | Live value | In the accepted plan? |
|---|---|---|---|
| **`2026-07-13`** | **Monday** | **`{closed: true}`** | ❌ **No.** It falls inside base segment `2026-07-01 → 2026-07-13`, where Monday is a working day |
| `2026-07-23` | Thursday | `{open:'09:00', close:'20:00'}` | ❌ No — an extended shift. **Wage-neutral** (a covered day is one full wage day); only the hours differ |
| `2026-08-18` | Tuesday | `{open:'09:00', close:'19:00'}` | ✅ Redundant, not contradictory — inside the open-ended segment where Tuesday already works |

The other nine are the 4 confirmed-off Tuesdays (`{closed:true}`) and 5 of the 11 worked Tuesdays.

**`2026-07-13` has a £100 consequence and it runs OPPOSITE to the correction being pursued.** The
seed exists to remove a £1,200 overstatement; seeding a day the live record says was closed would
add £100 back. It is **not** covered by any of the approval's stop conditions — those name worked/off
*Tuesdays*, and this is a Monday. It is reported rather than passed over.

**This needs an owner decision before any apply:** either 2026-07-13 was worked (the shiftChange is
wrong) or it was off (the plan needs a 25th segment splitting `2026-07-01 → 2026-07-13` into
`2026-07-01 → 2026-07-12` plus a closed one-day period). Either answer changes the plan digest.

### ⚠️ Finding 2 — base daily hours — **RULED ON 2026-08-19, see §13. Mon–Sat 09:00–19:00, Sun 10:00–16:00 are ACCEPTED, no longer conditional.**

§1 fixes the *days*; it never states the historical daily hours. This run used **Alex's real live
hours** — Mon–Sat `09:00–19:00`, Sun `10:00–16:00` — not the unit test's `09:00–18:00`, which is a
test constant. **The digest above is conditional on that choice.** It is wage-neutral under the
owner's day-based policy, but if a different historical hours basis is intended, the digest changes.

### ⛔ Not a permission to apply

`state: PLANNED` means the plan validates, not that the plan is right. Findings 1 and 2 are both
open, `FINANCE_ROTA_HISTORY_MODE` is still `'legacy'` so nothing would read the seed, and the
bootstrap must never run on Alex before or after this seed (§8, sequencing).

---

## 13 · Owner rulings applied, and the re-run — 2026-08-19

Rulings accepted (they close §12's two findings):

1. Alex **WORKED** Monday **2026-07-13**. 2. The live `shiftChanges['2026-07-13'] = {closed:true}` is
**erroneous** and must not redefine the plan. 3. Historical hours **Mon–Sat 09:00–19:00, Sun
10:00–16:00**. 4. Plan remains **24** entries. 5. The four off-Tuesdays stay inside base
`2026-05-27 → 2026-06-29`. 6. `2026-07-21` stays its own worked Tuesday at **17:00–19:00**.
7. `2026-07-23` 09:00–20:00 is wage-neutral. 8. `2026-08-18` is redundant. 9. The bootstrap must
**never** run for Alex.

⇒ **The accepted plan is unchanged.** Ruling 1 confirms the base segment `2026-07-01 → 2026-07-13`
with Monday working; ruling 3 confirms the hours the previous run had used provisionally. The plan
digest was **recomputed from the accepted plan, not reused**, and independently reproduced the same
value — which is the correct outcome when the plan is genuinely identical.

### How the erroneous `2026-07-13` entry must be handled — determined from source

**It requires no separate correction, and none should be written.** `src/utils/financeWages.ts`
(post-`ROTA-SSOT-2`):

```ts
const answer = rotaHistoryMode(opts.rotaMode) === 'dated' && opts.rotaDay ? opts.rotaDay(dk, dayName) : null
const sc = answer ? undefined : barber?.shiftChanges?.[dk]
```

In `'dated'` mode, if the log can speak for a day the map **is not read at all**. The seed covers
`2026-02-06 →` open-ended, so it speaks for `2026-07-13`, and the erroneous entry becomes
structurally unreachable for the wage decision. In `'legacy'` mode — what is live now — `answer` is
`null` by construction and the map still decides, so **the £100 stays wrong until
`FINANCE_ROTA_HISTORY_MODE` flips to `'dated'`**, seed or no seed. That is the standing
"the seed alone moves no money" position, unchanged.

Writing a `ROTA_OVERRIDE` to "fix" it would be **worse**, not better: an override *outranks* the
pattern (`overridden ? answer.works : …`), so it would install a permanent per-day authority for a
day the base pattern already answers correctly — and it would be a production write nobody needs.
§6 of this document, which says `shiftChanges` "outranks everything in the wage decision", was
audited at `ef5c0ed` and is **superseded** by `ROTA-SSOT-2` for `'dated'` mode only.

### Re-run result — deterministic, and it moved

| | Run A (pre-ruling) | **Run B + C (accepted plan)** |
|---|---|---|
| State | `PLANNED` | **`PLANNED`** |
| Segments / entries | 24 / 24 | **24 / 24** |
| Plan digest | `f1cac381…37c6` | **`f1cac381bd140db4daf38cf1750518740246bf516a4bfbf61ee7235c926637c6`** (unchanged — same plan) |
| Change ID | — | **`rota-seed-f1cac381bd140db4daf38cf175051874`** |
| Audit ID | — | **`rota-seed-barber-1777257519766-6c289aeb1ae60e30`** |
| Predicted entries hash | `fbd79cc8…e65d` | **`fbd79cc8d822445255ee78550475f6a5aa726dca1186b7719f3824c0df63e65d`** |
| Expected revision | 0 → 1 | **0 → 1** (genesis `17516577…c2b3`) |
| **Source fingerprint** | `ba3d051c…5f94` | **`93e4bbd45ad9b851e2e65cad2e05ec2eaaf672f947f79bf8925d623907fdcdb8` — CHANGED** |

Runs B and C are byte-identical to each other: deterministic. Local invariant self-check before the
core saw the plan: total 24 · bases 12 · single-day Tuesdays 11 (list-equal to the accepted 11) ·
open-ended 1 from `2026-08-16` · four off-Tuesdays inside the base period · `2026-07-21` partial
exact · **contiguous with zero gaps**.

### ⛔ BLOCKER — **CLEARED 2026-08-19, see §14.** Alex's document changed mid-session, and an apply would have reverted the owner's edit

`barbers/barber-1777257519766.updateTime` moved from `2026-08-16T19:31:22.625534Z` to
**`2026-08-19T19:57:09.584434Z`**. Exactly one field changed:

```
dayHours.Thursday.close :  "19:00"  →  "20:00"
```

Everything else — status, `availabilityFrom`, `workingDays`, `hours`, leave fields and all 12
`shiftChanges` keys — is unchanged. **This session did not and could not have written it:** the
adapter exposes only `.doc().get()`, and the new value is `20:00` while every Thursday in this
session's plan is `19:00` — the opposite direction.

Two consequences, and the second is the blocker:

1. **The fingerprint is void for any earlier plan.** Correct, designed behaviour — the precondition
   caught it. The values above are current as of `19:57:09Z`.
2. **An apply would silently revert that edit.** The seed publishes the FINAL segment's pattern onto
   the barber document (`predictedPublish`). The final open-ended segment carries Thursday
   `09:00–19:00`, so applying would write Thursday back to `19:00` and undo the 19:57 change.

Ruling 3 fixes the **historical** hours. It does not say what the **open-ended segment from
2026-08-16** — which covers today and every future day — should carry, and live configuration now
disagrees with it by one hour on Thursdays. Note the likely provenance: `2026-07-23` was a Thursday
`09:00–20:00` exception, and Thursday has now become `20:00` as a standing pattern.

**This needs an owner ruling before any apply:** either the final segment adopts Thursday
`09:00–20:00` (which changes the plan digest), or the 19:57 edit is itself unintended. Wages are
unaffected either way — the policy is day-based — but bookable Thursday hours are not.

### Reconciliation — all 12 overlapping `shiftChanges`, none unexplained

| Key | Day | Value | Verdict |
|---|---|---|---|
| 2026-06-02 · 06-09 · 06-16 · 06-23 | Tue | `{closed:true}` | ✅ ruling 5 — inside base `2026-05-27→06-29`, Tuesday already excluded, no event needed |
| **2026-07-13** | **Mon** | `{closed:true}` | ⚠️ rulings 1+2 — **erroneous**; plan unchanged; neutralised structurally in `'dated'` mode; **not** corrected by a write |
| 2026-07-14 · 07-28 · 08-04 · 08-11 | Tue | `09:00–19:00` | ✅ worked Tuesdays, in plan |
| 2026-07-21 | Tue | `17:00–19:00` | ✅ ruling 6 — exact match to the one-day segment |
| 2026-07-23 | Thu | `09:00–20:00` | ✅ ruling 7 — wage-neutral. ⚠️ but see the blocker: Thursday `20:00` is now the standing pattern |
| 2026-08-18 | Tue | `09:00–19:00` | ✅ ruling 8 — redundant, inside the open-ended segment |

**No new `shiftChanges` discrepancy.** The only new discrepancy is `dayHours.Thursday`, above.

### Production unchanged by this session

header `404` · `rotaEntries` **0 docs** · seed audit `404` · bootstrap audit `404` ·
`rotaPolicy/rollout` **absent, unflipped** · 5 reads per run, writes structurally impossible.
Alex's barber document did change — at 19:57, by something outside this session, as evidenced above.

### Checks run

seed suite **62/62** · rotaWriter + fold parity **142/142** · financeWages + financeRotaHistory +
rotaIntent **128/128** · ops guards **119/119** · claims selftest + **45/45** · release-guard ·
export count **78** · `git diff --check` clean.

---

## 14 · The blocker cleared — the effective-dated amendment, 2026-08-19

**Ruling.** Thursday **20:00 is intentional and current**. The open-ended segment from
`2026-08-16` must therefore carry Thursday **09:00–20:00**; every completed historical period keeps
Thursday **09:00–19:00**. This is an **effective-dated change, not a retroactive correction** —
earlier periods are not rewritten. Alex worked `2026-07-13`; the erroneous `{closed:true}` needs no
mutation. The bootstrap must never run for Alex.

### The amendment, and the one line that carries it

Only the final segment's pattern moved. `dayHours` is built by two different resolvers:

```
histH(d) → Sunday 10:00–16:00 · everything else 09:00–19:00     ← the 23 bounded segments
nowH(d)  → Sunday 10:00–16:00 · Thursday 09:00–20:00 · rest 19:00 ← the open-ended segment ONLY
```

Verified locally before the core saw the plan: **12** bounded segments carry a Thursday and
**every one of them closes at 19:00** (`historicalThursdaysAll19: true`); the final segment's
Thursday is `{"open":"09:00","close":"20:00"}`.

### Structural validity and the entry count — from the module, not assumed

The module returned **`entryCount: 24`** for 24 supplied segments; the count is reported as the core
derived it, not carried over. Invariants, all machine-checked before the call: supplied **24** ·
bounded base **12** · single-day Tuesdays **11**, list-equal to the accepted eleven · open-ended
**1** from `2026-08-16` · the four off-Tuesdays inside base `2026-05-27 → 2026-06-29` ·
`2026-07-21` partial exactly `17:00–19:00` · **contiguous, zero gaps** · `declaredGaps: []` ·
validation issues **none** · state **`PLANNED`**.

### Recomputed identifiers — the previous set is STALE and must not be applied

| | STALE — do not apply | **CURRENT** |
|---|---|---|
| Seed plan digest | ~~`f1cac381…37c6`~~ | **`bfad3779b0ff47031c84d4976d571f907193d86fef3a83cfd33c4621822b8abb`** |
| Change ID | ~~`rota-seed-f1cac381bd140db4daf38cf175051874`~~ | **`rota-seed-bfad3779b0ff47031c84d4976d571f90`** |
| Audit ID | ~~`…-6c289aeb1ae60e30`~~ | **`rota-seed-barber-1777257519766-2189926c0f9baed4`** |
| Predicted entries hash | ~~`fbd79cc8…e65d`~~ | **`d2be374dd8565dc8de110d98457a58175f846e44337d62811103935fbb90d40f`** |
| Source rota fingerprint | — | **`93e4bbd45ad9b851e2e65cad2e05ec2eaaf672f947f79bf8925d623907fdcdb8`** |
| Expected revision | — | **0 → 1**, genesis `17516577…c2b3` |
| Audit path | — | `tenants/whitecross/auditLogs/rota-seed-barber-1777257519766-2189926c0f9baed4` |
| Write set if applied | — | **27** — 24 entry creates + header create + audit create + 1 barber publish update |

Both stale audit id and current audit id return **404** in production: neither has ever been written.

### The blocker is cleared, and here is the proof

`predictedPublish.dayHours.Thursday` is now **`{"open":"09:00","close":"20:00"}`** — the value the
owner set at 19:57. An apply would therefore **preserve** that edit rather than revert it, which is
exactly what §13 said had to change. `workingDays` (all seven) and top-level `hours`
(`09:00–19:00`) already match the live document, so the publish moves nothing else.

> ⚠️ **One publish side effect, named rather than discovered later.** `predictedPublish` emits
> `dayHours` entries as `{open, close}` only, while the live document also carries `source:'staff'`
> and `closed:false` on each day. An apply would drop those two keys. No rota or Finance reader
> consults `dayHours[].source`, and an absent `closed` is falsy exactly as `closed:false` is, so no
> behaviour depends on it — but the document would visibly lose the metadata.

### Ruling 5 verified — a later 20:00 → 19:00 edit cannot rewrite this seed

Read-only, from source **and** a passing test.

* `ROTA_CHANGE` (`rotaWriter.ts`) emits **two NEW entries**: a `ROTA_CLOSE` carrying
  `targetEntryId: current.entryId` and `effectiveTo` = the day before the change, then a fresh
  `ROTA_OPEN` from the change date with the new pattern. The prior entry is **referenced, never
  mutated**.
* `if (from < todayKey) return reject(BACKDATED, 'a rota change may not take effect in the past')` —
  a change cannot be dated into the past at all.
* Persistence is `tx.create(entryRefs[i], record)`. Across `rotaWriter.ts`, `rotaSeedImport.ts` and
  `rotaBootstrap.ts` the only `tx.update`/`tx.delete` calls target **`barberRef`** — the projection.
  **No entry document is ever updated or deleted.**
* Test **`12d. the log is append-only in the code, not only in the prose`** asserts the engine
  contains no `.delete(`, no `FieldValue.delete`, uses `tx.create(entryRefs[i], record)` and
  **not** `tx.set(entryRefs…)`, and pins the exact set of barber writes. It **passes** (rotaWriter
  suite 72/72).

**The guarantee exists and is proven.** Nothing to report as missing.

### Reconciliation under the CURRENT precedence

`financeWages.ts`: `const sc = answer ? undefined : barber?.shiftChanges?.[dk]` — in `'dated'` mode
the map is not read for any day the log covers. The seed covers `2026-02-06 →` open-ended, so **all
twelve** overlapping keys become unreachable for the wage decision once the mode flips; in
`'legacy'` mode (live now) every one of them still decides, exactly as today. Reconciliation is
unchanged from §13: the four off-Tuesdays are represented by the base excluding Tuesday, five worked
Tuesdays corroborate the plan, `2026-07-21` matches the partial exactly, `2026-07-13` is the
erroneous entry that needs no mutation, `2026-07-23` is wage-neutral, `2026-08-18` is redundant.
**No new discrepancy.**

### Production state — stable and unmutated

Alex's `updateTime` read **`2026-08-19T19:57:09.584434Z`** before, during and after all three runs —
the harness records every value it saw and observed exactly one. `dayHours.Thursday.close` is
`20:00`. Header **404** · `rotaEntries` **0 docs** · new seed audit **404** · old seed audit
**404** · bootstrap audit **404** · `rotaPolicy/rollout` **absent, unflipped**. Five reads per run;
the adapter exposes only `.doc().get()`, so a write was unrepresentable.

### Checks

seed **62/62** · rotaWriter + fold twins **142/142** · rotaBootstrap **25/25** · full Functions
**1891** (1854 pass · 0 fail · 37 emulator self-skips) · frontend rota/finance readers **140/140** ·
ops guards **119/119** · claims selftest + **45/45** · release-guard · exports **78** ·
`git diff --check` clean.

---

## 15 · Production apply gate — **BLOCKED**, 2026-08-19

Gate preparation only; nothing was applied. Every bound value was independently re-read and
recomputed rather than carried over. **Two gates fail, and a third value does not reproduce.**

### Fresh pre-apply checks — 1–6, 9, 10 all PASS

| Check | Result |
|---|---|
| 1 · ledger row + deployed revision | `R-2026-08-19-A` present · `salownrotaseedtenanthistory-00001-tol` ACTIVE GEN_2 |
| 2 · Finance modes | `FINANCE_ROTA_HISTORY_MODE = 'legacy'` · `FINANCE_PERIOD_CLOSE_MODE = 'legacy'` |
| 3 · bootstrap | never run for Alex — `auditLogs/rota-bootstrap-2026-08-19` **404** |
| 4 · genesis | header **404** · rotaEntries **0** · seed audit **404** · bootstrap audit **404** · rollout **absent/unflipped** |
| 5 · doc identity | `updateTime` **`2026-08-19T19:57:09.584434Z`** == bound |
| 6 · Thursday | `dayHours.Thursday.close` = **`20:00`** |
| 9 · race surface | no active claim; no concurrent cutover; no operator action in flight |
| 10 · target ids | tenant `whitecross`, subject `barber-1777257519766` — from §1 of this document |

### Check 7–8 — one bound value does NOT reproduce

| Bound value | Recomputed | |
|---|---|---|
| source fingerprint `93e4bbd4…cdb8` | identical | ✅ |
| plan digest `bfad3779…8abb` | identical | ✅ |
| change ID `rota-seed-bfad3779b0ff47031c84d4976d571f90` | identical | ✅ |
| audit ID `rota-seed-barber-1777257519766-2189926c0f9baed4` | identical | ✅ |
| entry count 24 · revision 0 → 1 · state `PLANNED` | identical | ✅ |
| **predicted entries hash `d2be374d…d40f`** | **`a70c7ba8…7a96`** | ❌ |

**Cause, established from source — it is not a defect.** `buildSeedEntries` stamps every entry with
`audit: { actorRef, actorRole?, channel:'import' }`. The hash is therefore a function of the CALLER
IDENTITY. Measured directly: `dryrun-local-harness` → `d2be374d…`, `gate-verify` → `a70c7ba8…`,
`some-real-operator` → `a1fceb5b…`. It is **not** time-dependent — the callable deliberately does
not supply `nowInstant`, so `audit.atInstant` is absent.

**Consequence for the gate:** the bound hash is reproducible only under the synthetic dry-run actor,
which must never be used in production. A real operator will necessarily produce a different value,
**correctly**. `predictedEntriesHash` is therefore not a valid pre-apply commitment and must not be
bound. It is *not* an apply precondition — the apply requires `expectedEntriesHash ===
ROTA_CHAIN_GENESIS` (the PRE-state) — so nothing downstream depends on it.

### ⛔ GATE A FAILS — the publish narrowing is NOT a contractual normalization

Exact recursive diff of the complete publish (`tx.update(barberRef, {...publish})`; a nested map
in `update()` replaces the whole field):

* top-level keys **written**: `workingDays`, `dayHours`, `hours`
* top-level keys **untouched** (14): `active`, `availabilityFrom`, `bio`, `color`, `id`,
  `leaveFrom`, `leavePaid`, `leaveUntil`, `name`, `order`, `photo`, `role`, **`shiftChanges`**,
  `status`
* **ADDED: 0 · CHANGED: 0** — `dayHours.Thursday.close` is `20:00` on both sides
* **REMOVED: 13 keys across all SEVEN days** — `source:'staff'` ×**7**
  (Mon, Tue, Wed, Thu, Fri, Sat, Sun) and `closed:false` ×**6** (all but Tuesday, which has no
  `closed` key live). **This is not a Thursday-only effect.**

**Why this blocks.** The removal is not guaranteed by any contract:

1. `toRotaBarberFieldUpdate` — the single shared projection used by the seed **and** by the live
   `salownRotaTransaction` writer — does `if (pattern.dayHours != null) update.dayHours =
   pattern.dayHours`. It copies **verbatim**. There is **no normalization step anywhere**, and the
   frontend twin is identical.
2. Nothing post-processes it: `tx.update(barberRef, { ...publish })`.
3. **No test asserts `source`/`closed` are stripped.** There is no stripping contract to appeal to.
4. The canonical vocabulary positively **includes** them: `DAY_HOURS_KEYS = ['open','close',
   'closed','source']`, and the accepted golden fixture `packages/shared/src/rotaFold.golden.json`
   carries `"source"` 6× and `"closed"` 12× inside `dayHours`.

So `{open, close}` is **what this hand-authored plan happens to contain**, not the canonical
published representation. The 13 removals are an **unreviewed mutation introduced by the plan**, and
the gate's own rule applies: stop.

**Consumers — recorded, but not the reason for the block.** `bookingUtils.ts:475`
(`barber.dayHours[dayName].closed`) and `createBooking.ts` read `dayHours.*.closed`; an absent key
is falsy exactly as `false` is, so those specific reads would behave identically. `weekHours.ts`
types `closed: boolean` and pins key order `open, close, closed[, note]`. No reader of
`dayHours.*.source` was found. **None of that is sufficient** — the gate forbids accepting the
removal merely because current readers appear unaffected, and the contract evidence above shows it
is unintended rather than sanctioned.

**Smallest remedy, NOT implemented here.** Only the FINAL segment's pattern is ever published, so
carrying `{open, close, closed, source}` on that one segment — matching live byte-for-byte — makes
the publish diff empty. That changes the plan digest and every dependent identifier, so it needs a
fresh dry run and a fresh owner ruling. It is named, not applied.

### ⛔ GATE B FAILS — no sanctioned authenticated production invocation path exists

* **No UI or product surface invokes `salownRotaSeedTenantHistory`.** Searched `salown-app/src`,
  `salown-app/hosting`, `whitecross-site/barber-panel/src`: the only match anywhere is a *comment*
  in `financeRotaHistoryCutover.ts`.
* **No runbook procedure.** `FIN_PERIOD_CLOSE_DESIGN.md` §225 records that apply/adjust are
  `superAdmin`-only — an authorization statement, not an invocation method.
* **No callable-invocation tooling** in either repository.

The callable requires a Firebase ID token carrying `superAdmin: true`. The permitted routes are
exhausted: a durable privileged session may not be minted, the synthetic dry-run actor may not be
used in production, and invoking the core directly would evade the callable boundary — which is the
very gate the apply must exercise.

**Smallest safe missing prerequisite** (stated, deliberately not built): an authenticated
super-admin surface that calls the callable from a real operator session — e.g. a super-admin-only
control that issues `httpsCallable('salownRotaSeedTenantHistory')` with `dryRun` first and the
returned digest handed back for apply. That exercises the real `staffActorFrom` path, needs no new
credential, and leaves the operator identity in `audit.actorRef` where it belongs.

### Verified again: zero production mutation

header 404 · rotaEntries 0 · seed audit 404 · bootstrap audit 404 · rollout absent ·
`updateTime` unchanged at `2026-08-19T19:57:09.584434Z`. 5 reads per run; the adapter exposes only
`.doc().get()`.

**Terminal: `ALEX_ROTA_SEED_APPLY_BLOCKED`.** — **Gate A RESOLVED in §16 (2026-08-20). Gate B still outstanding.**

---

## 16 · Gate A resolved — the snapshot-derived final segment, 2026-08-20

**Ruling.** The final open-ended segment must preserve Alex's current live rota projection
*exactly*, including every canonical `dayHours` key. Historical bounded segments keep their accepted
historical hours. An eventual publish must add, change and remove **nothing**.

### The fix: derive, do not retype

The final segment's pattern is now **read from production through the same read-only adapter,
validated against the canonical vocabulary, and used verbatim**:

* keys checked against `DAY_HOURS_KEYS = ['open','close','closed','source']` (unknown key ⇒ refuse);
* `open`/`close` required and time-shaped; `closed` boolean if present; `source` ∈
  `DAY_HOURS_SOURCES = {'salon','staff'}` if present;
* the snapshot is **digest-bound** — it is part of the segments, so any later live change produces a
  different plan digest and voids the plan by construction.

**Ruling 5, answered from source rather than assumed.** `closed` and `source` are **optional**:
`validatePattern` checks them only `if (row.x !== undefined)`, and `DAY_HOURS_KEYS` is an allowlist,
not a requirement. The 23 bounded historical segments therefore carry only `{open, close}` and
validate cleanly (`issues: null`, `histDayHoursKeysOnlyOpenClose: true`). **No historical `source`
provenance was invented.** Consequence, stated: historical entries record hours without a
provenance marker, which is exactly what the accepted evidence supports — nobody recorded who set
Alex's hours in February.

### ⛔→✅ GATE A — and the result is stronger than a zero-diff write

**`predictedPublish` is `null`.** Because the final segment's pattern now equals the live
projection, `computeCacheConvergence` reports no pattern change, so `barberFieldUpdate` is `null`
and `rotaSeedImport` never reaches `tx.update(barberRef, …)` at all. The core says so itself:

> *"the legacy cache publishes nothing for today; the barber document is unchanged by this seed"*

| Gate A requirement | Result |
|---|---|
| added keys | **0** |
| changed keys | **0** |
| removed keys | **0** |
| all seven days keep exact `source` / `closed` presence and value | ✅ — `source` **7/7**, `closed` **6/7** (Tuesday has none live), untouched |
| Thursday 09:00–20:00 | ✅ `{"close":"20:00","closed":false,"open":"09:00","source":"staff"}` |
| `workingDays` and top-level `hours` unchanged | ✅ all seven days; `hours` `{09:00, 19:00}` |

Not "a write that happens to change nothing" — **no write to the barber document is emitted.**

**Consequence for the write set: 27 → 26.** 24 entry creates + 1 header create + 1 audit create, and
**no barber publish update**.

Consumer search re-run as a regression check only (`bookingUtils.ts` still reads
`dayHours[dayName].closed`); it is no longer load-bearing, because a publish that does not happen
cannot remove a key.

### Recomputed identifiers — everything from `bfad3779…8abb` is STALE

| | STALE — must not be applied | **CURRENT** |
|---|---|---|
| Seed plan digest | ~~`bfad3779…8abb`~~ | **`0cdde2f9910b4096f2eb696acfcede401c1b9c51f3d4696e5216be3a879966e2`** |
| Change ID | ~~`rota-seed-bfad3779b0ff47031c84d4976d571f90`~~ | **`rota-seed-0cdde2f9910b4096f2eb696acfcede40`** |
| Audit ID | ~~`…-2189926c0f9baed4`~~ | **`rota-seed-barber-1777257519766-1ede6e017a3a9800`** |
| Predicted entries hash (synthetic actor A only) | ~~`d2be374d…d40f`~~ | **`3bacfb31c62838c7bd4260c736157ec8bcec2112fd52c32ae9614168f6e3ff44`** |
| Source fingerprint | — | **`93e4bbd45ad9b851e2e65cad2e05ec2eaaf672f947f79bf8925d623907fdcdb8`** (unchanged) |
| Entry count · revision | — | **24** · **0 → 1** |
| **Expected write set** | ~~27~~ | **26** |

Both stale audit ids and the current one return **404**: none has ever been written.

### Determinism, actor-independence and the absence of a clock

* **Three runs, same synthetic actor** → output files byte-identical, sha256
  `28fa9b66c31ac146a62e9c6177af5448832474f5ec8b02f16b55add58e4dea94`.
* **A different synthetic actor** → `sourceRotaFingerprint`, `seedPlanDigest`, `changeId`,
  `auditId`, `entryCount`, `predictedRevision`, `state` and `predictedPublish` all **identical**;
  only `predictedEntriesHash` moves (`3bacfb31…` → `14f122b7…`), because `buildSeedEntries` stamps
  `audit.actorRef` on every entry.
* **No clock contaminates the plan.** The date rolled from 2026-08-19 to 2026-08-20 between runs.
  Re-digesting *yesterday's* plan *today* still yields exactly `bfad3779…8abb`. `todayKey` is the
  only date-bearing field and it is reported output, not plan input.

### The future gate rule — binding for any real apply

1. **Never compare a real operator's `predictedEntriesHash` to a synthetic actor's.** They differ by
   design and must. Actor attribution is not to be weakened or removed to make hashes match.
2. **The authenticated callable dry run and the apply must be performed by the SAME authenticated
   operator**, in one session.
3. **Bind the apply to the real callable dry-run response** — its `seedPlanDigest` and
   `sourceRotaFingerprint` handed straight back — plus the unchanged genesis pre-state
   (`expectedRevision: 0`, `expectedEntriesHash: ROTA_CHAIN_GENESIS`). `predictedEntriesHash` is
   **output, never precondition**.

### Safety, re-verified after all five runs

header **404** · rotaEntries **0** · new seed audit **404** · stale seed audit **404** · bootstrap
audit **404** for both 2026-08-19 and 2026-08-20 · rollout **absent/unflipped** · barber
`updateTime` **`2026-08-19T19:57:09.584434Z`**, one value observed throughout · both Finance modes
`'legacy'` · no active claim · bootstrap never run for Alex.

**Checks:** seed 62/62 · rotaWriter + fold twins 142/142 · rotaBootstrap 25/25 · full Functions 1891
(1854 pass · 0 fail · 37 self-skips) · frontend rota/finance 158/158 · ops guards 119/119 · claims
selftest + 45/45 · release-guard · exports **78** · `git diff --check` clean.

### ⛔ Gate B remains outstanding

No sanctioned authenticated production invocation path exists (§15). Not bypassed, not implemented
here. The plan is ready for that tool; it is not ready to apply.

---

## 17 · The authenticated production dry run — Stage 1, executed 2026-08-20

**One real production invocation, `dryRun: true`, through the deployed Gate B surface. Zero writes.**
Appended as a dated record; §§1–16 are unchanged.

### How it was invoked

Through the deployed UI only — `https://salown-admin.web.app/ops/rota-seed`, artifact
`da385a716686bb6d` (served `index-nocVEGff.js` sha256 `1515292e…b145`, re-verified immediately
before). An **existing** Firebase-authenticated super-admin browser session was used: operator
**`aerulas@gmail.com` · UID `CsktIKNC0wRaP2eK8DECVMWPD0m1`**, which is the security-audit baseline
super-admin. The page rendered past `ProtectedRoute`, which is itself proof the verified ID-token
claim carried `superAdmin: true`; the claim was resolved by the application's own
`getIdTokenResult`, and no forced refresh was needed or performed.

**No token was minted, copied, printed or exposed. No credential was created, no actor synthesized,
no core called directly.** The callable was reached only by clicking the page's Stage 1 control —
**exactly once**, with no retry, no DevTools invocation and no manipulation of the request or
payload.

### Pre-state, captured read-only immediately before

header `staffRota/barber-1777257519766` **404** · `rotaEntries` **0** · seed audit
`rota-seed-barber-1777257519766-1ede6e017a3a9800` **404** · `rotaPolicy/rollout` **404** · Alex's
barber document `updateTime` **`2026-08-19T19:57:09.584434Z`** · seed callable
**`salownrotaseedtenanthistory-00001-tol`** · no active claim, all three repos clean.

### Result — `PLANNED`, readiness GRANTED

The page's own validator granted readiness, which it does only when its failure list is empty —
so **every** checked field matched: state `PLANNED`, tenant `whitecross`, subject
`barber-1777257519766`, digest `0cdde2f9…966e2`, fingerprint `93e4bbd4…cdb8`, change ID
`rota-seed-0cdde2f9910b4096f2eb696acfcede40`, entry count **24**, predicted revision **1**
(from `0`), write count **26**, `predictedPublish` **null**, issues empty, blocking empty.

| | |
|---|---|
| Write set displayed | **26 = 24 entries + 1 header + 1 audit + 0 barber projection** |
| **Real predicted entries hash** | **`bec05d23c10283cc30998833f47bbf46c03f17bfc925e1e9db2fe16be5807064`** |

> ⚠️ That hash is **OUTPUT ONLY and actor-dependent** — `buildSeedEntries` stamps `audit.actorRef`
> on every entry. It is a **third distinct value**, different from both synthetic-actor hashes
> recorded in §16 (`3bacfb31…ff44`, `14f122b7…`), which is exactly what §16's rule predicted and is
> evidence that attribution is working. It was **not** compared to any earlier harness hash and
> **must never** become a precondition. The apply binds on digest + fingerprint + `expectedRevision: 0`
> + `expectedEntriesHash: ROTA_CHAIN_GENESIS`, all of which the server re-derives.

### The two server warnings, recorded rather than dismissed

1. **`12 shiftChanges key(s) overlap the seeded range; they are NOT removed, NOT migrated and still
   outrank the log in Finance until ROTA-SSOT-2 is closed.`** This matches §13's reconciliation of
   the same 12 keys and is the known consequence of Finance still running in `legacy` mode.
2. **`the legacy cache publishes nothing for today; the barber document is unchanged by this seed.`**
   This is Gate A's conclusion (§16) confirmed by the server on real production data — the reason
   the write set is 26 and not 27.

### Apply remained unavailable — proven in the strongest available state

Readiness was **true** and the typed-confirmation input became **enabled**, so every apply
precondition except the kill switch was satisfied — and the apply control stayed disabled, labelled
*"Apply seed — DISABLED IN THIS BUILD"*, with its accessible name being the disabled title. The
confirmation phrase was deliberately **not** typed: the served bytes already fold the button's
`disabled` expression to a literal `true` and contain **no `buildApplyPayload` at all**, so typing
could not change the outcome. **Apply was not enabled, `ROTA_SEED_APPLY_ENABLED` was not modified.**

### Post-invocation — nothing was written

header **404** · `rotaEntries` **0** · seed audit **404** · `rotaPolicy/rollout` **404** · Alex's
barber `updateTime` **`2026-08-19T19:57:09.584434Z`, unmoved** · bootstrap audit for 2026-08-20
**404** · `salownRotaSeedTenantHistory` **`-00001-tol`** unchanged · `salownRotaTransaction`
**`salownrotatransaction-00003-gov`** unchanged · `salownRotaBootstrapTenant` **`-00002-nuy`**
unchanged · hosting `salown-admin` `da385a716686bb6d`, `salown` `64a94ff80d5c2d9a`, `salown-staff`
`c0606fdcb48f5207` all unchanged · Finance modes are source constants and remain
`FINANCE_ROTA_HISTORY_MODE = 'legacy'` / `FINANCE_COMP_PERIOD_MODE = 'periods'` · all repos clean.

### What this does and does not license

It establishes that the **accepted plan reproduces against live production data through the real
callable, as a real authenticated operator** — the last unknown Gate B existed to remove. It is
**not** an authorisation to apply. Applying needs a reviewed source change setting
`ROTA_SEED_APPLY_ENABLED = true`, a redeploy, a **fresh** dry run in that new artifact by the same
operator in one session, and its own explicit authorisation. Bootstrap must still never run for this
subject, and the Finance cutover remains a separate, later operation.

---

## 18 · ✅ APPLIED — the seed is committed, 2026-08-20

**Owner-authorised, single-use. One dry run, one apply, 26 writes, `SEEDED`.**
Appended as a dated record; §§1–17 unchanged.

### The temporary apply window

`ROTA_SEED_APPLY_ENABLED` was flipped to `true` in a dedicated, explicitly-labelled commit
**`e99128b`**, deployed to `hosting:salown-admin` **`da385a716686bb6d` → `5be94b0d23d3d3b8`**
(release `1787249196154000`, **18:06:36.154Z**), and reverted by **`9e5e591`** and redeployed as
**`ef97ebdd3834ec74`** (release `1787249939594000`, **18:18:59.594Z**).

**Exposure window: 12 minutes 23 seconds.** The apply-enabled artifact is gone —
`index-1Eb26_2w.js` now returns the SPA-shell `text/html`, and the live bundle is
`index-BORmnUzX.js`, byte-identical to the reviewed disabled build.

`src/pages/RotaHistorySeed.jsx` was **byte-unchanged** across the whole operation, so the handler
that applied is exactly the one reviewed at `a3a4382`; the manifest was byte-identical too
(sha256 `e5a89c7c…968e`). The revert restores source **byte-identical to `a3a4382`**
(`git diff a3a4382 HEAD` is empty).

### The invocation

Operator **`aerulas@gmail.com` · UID `CsktIKNC0wRaP2eK8DECVMWPD0m1`**, through the deployed UI only.
**One** fresh dry run, then **one** apply. No token minted, copied or printed; no credential
created; no synthetic actor; no REST/curl/Node/Admin-SDK/direct-core path.

Pre-apply state, read-only: header **404** · entries **0** · seed audit **404** · rollout **404** ·
barber `updateTime` `2026-08-19T19:57:09.584434Z` · seed callable `-00001-tol` · guard `-00003-gov`
· no active claim.

The state machine was observed advancing exactly as designed: `Blocked: NO_SUCCESSFUL_DRY_RUN` →
(dry run) → `Blocked: CONFIRMATION_MISMATCH` → (typed phrase) → actionable → applied → consumed.

### Fresh dry run — `PLANNED`

All fields matched; write set **26 = 24 + 1 + 1 + 0**; `predictedPublish` null. Real
actor-dependent **`predictedEntriesHash` = `bec05d23c10283cc30998833f47bbf46c03f17bfc925e1e9db2fe16be5807064`**
— output only, not sent back, not required to equal anything.

### Apply — `SEEDED`

| Field | Value |
|---|---|
| State | **`SEEDED`** |
| Tenant · subject | `whitecross` · `barber-1777257519766` |
| Digest | `0cdde2f9910b4096f2eb696acfcede401c1b9c51f3d4696e5216be3a879966e2` |
| Source fingerprint | `93e4bbd45ad9b851e2e65cad2e05ec2eaaf672f947f79bf8925d623907fdcdb8` |
| Revision | **0 → 1** |
| Entries | **24** |
| Write set | **26** = 24 entries + 1 header + 1 audit + **0** barber projection |
| Change ID | `rota-seed-0cdde2f9910b4096f2eb696acfcede40` |
| Audit ID (derived) | `rota-seed-barber-1777257519766-1ede6e017a3a9800` |
| Barber projection | **not written** |
| Resulting entries hash | `bec05d23…7064` — OUTPUT ONLY |

### Independent read-only post-state verification

**Header** — exists · `revision` **1** · `entriesHash` **`bec05d23…7064`**, equal to the dry run's
predicted hash · `entryCount` **24** · `lastChangeId` the accepted seed change id · `lastOrigin`
**`ROTA_IMPORT`** · `legacyMode` `canonical` · `updateTime` `2026-08-20T18:10:59.737300Z`.

**Entries** — **24**, `seq` dense 0…23, `entryId` unique and equal to the document id, a **single**
changeId across all of them, every `origin` `ROTA_IMPORT`, every `type` `ROTA_OPEN`, every
`audit.actorRef` **`CsktIKNC0wRaP2eK8DECVMWPD0m1`**, the first entry anchored to
**`ROTA_CHAIN_GENESIS`**, first segment `2026-02-06 → 2026-02-09`, last segment
`2026-08-16 → open-ended`.

**Audit** — exists at the expected id, `action` `ROTA_SEED_IMPORT`, `userId` the operator UID,
`changeId` and `seedPlanDigest` matching the manifest, `entryCount` 24. Uniqueness is structural:
the id is `deriveSeedAuditId(barberId, digest)` and the writer uses `tx.create`.

**Untouched** — Alex's barber document `updateTime` is **still `2026-08-19T19:57:09.584434Z`**, so
the seed wrote nothing to it and the live weekly snapshot is intact; its **12** `shiftChanges`
compatibility keys are all still present; `rotaPolicy/rollout` is still **absent (404)**; the two
other Whitecross subjects have **no** `staffRota` document; no bootstrap audit exists; the seed,
guard and bootstrap callables are unmoved (`-00001-tol`, `-00003-gov`, `-00002-nuy`), europe-west2
count still 86; ruleset `a9806b0b-…` `updateTime` unmoved; 2 indexes; `hosting:salown`
`64a94ff80d5c2d9a` and `hosting:salown-staff` `c0606fdcb48f5207` unmoved; salown-app not edited or
deployed.

**Finance is unchanged and reads nothing from this.** `FINANCE_ROTA_HISTORY_MODE` is still
`'legacy'` — a source constant in salown-app, which was not touched. **No wage total changed**, and
the server said so itself in both warnings: the 12 overlapping `shiftChanges` keys still outrank the
log in Finance until ROTA-SSOT-2 closes, and the legacy cache published nothing.

### ⚠️ One cosmetic defect observed and not fixed under the window

In the apply-enabled build the static red paragraph still read *"Production apply is compile-time
disabled… is `false` in this artifact"* while apply was in fact enabled. It is presentational only —
the gate, the button state and the `Blocked:` line were all correct throughout — but it was
misleading copy on an irreversible-action screen. It was **not** patched mid-window, deliberately:
changing page source during an open apply window would have invalidated the reviewed handler
guarantee. It is harmless in the steady disabled state, where the sentence is true. Worth fixing
before any future window.

### What this does and does not license

Alex's rota history is now sayable: 24 dated periods, revision 1, append-only. It is **not** read by
Finance and changes no figure. Still separate and unauthorised: the Finance cutover, the rollout
flip, and the bootstrap — which **must never run for this subject**, before or after this seed.


---

## 19 · Arda — accepted evidence, 2026-08-24

> ### State
> ```
> EVIDENCE_ACCEPTED_MANIFEST_NOT_YET_MATERIALIZED_NOT_DRY_RUN_NOT_APPLIED
> ```
> Owner-authorized **READ-ONLY** production evidence capture. Nothing was written: no Firestore
> create/update/delete, no Auth or Storage mutation, no callable invocation of any kind — not
> `salownRotaSeedTenantHistory`, not `salownRotaTransaction`, not `salownRotaBootstrapTenant`, and
> not in `dryRun`. No deploy, no rules/index change, no Finance-mode change, no Arda Save.

**Anchors.** `salown-app` @ `73e9ead` (== `origin/main`; `0eac653`, the passive weekly-project gate,
is an ancestor and `WEEKLY_PROJECT_PASSIVE_UNSUPPORTED` is present in
`functions/src/staff/rotaWriter.ts:469`). `salownadmin` @ `f2df127`. `salown-docs` @ `f7d21f5`
(the `eac5700` checkpoint is an ancestor; the repo had advanced two commits, both unrelated).
No claim was held or created in any repo.

### 19.1 · Identity and lifecycle

| | |
|---|---|
| Project | `havuz-44f70`, authenticated `whitecrossbarbers@gmail.com`; reads via the admin SA `firebase-adminsdk-fbsvc@havuz-44f70.iam.gserviceaccount.com` |
| Tenant | `whitecross` · timezone **Europe/London**, resolved from `settings/settings.presentation` through the TR-A precedence (`rotaActivation.resolveTenantTodayKey`), never assumed |
| Subject | **Arda**, `barber-1777655430086` |
| Lifecycle | `status: 'passive'`, `active: false` · `availabilityFrom: 2026-02-06` |
| `workingDays` (live) | `Monday, Tuesday, Thursday, Friday, Saturday, Sunday` — **Wednesday is the day off** |
| `staffComp` | ONE wage period, `effectiveFrom 2026-02-06` → **`effectiveTo 2026-08-04`**, `{amount: 600, period: 'week'}` |
| Lifecycle audit | `BARBER_STATUS_CHANGED` **2026-08-04T17:45:11.619Z**, then `COMP_PERIOD_CLOSED` **2026-08-04T17:45:12.152Z** — the passive/effective-to boundary is production-established, not asserted |
| Canonical rota today | `staffRota/barber-1777655430086` **does not exist**; `rotaEntries` count **0**; `rotaPolicy/rollout` **does not exist** (tenant is LEGACY) |

`tenants/whitecross/staffRota` holds exactly one document — Alex's (§18), 26 entries, revision 2.
Arda is at genesis.

### 19.2 · Owner rulings this was tested against

1. A date counts as worked only if it holds ≥1 qualifying genuine booking for Arda.
2. `CHECKED_OUT` genuine bookings count.
3. A genuine `UNPAID` booking still establishes attendance — payment status does not erase work.
4. Therefore the `2026-05-15` £20 UNPAID walk-in counts.
5. BLOCKED / born-block records alone do not establish attendance.
6. Standalone product sales do not establish attendance.
7. Wednesday is Arda's normal day off.
8. Two exceptional worked Wednesdays are expected: `2026-02-11`, `2026-03-18`.
9. `2026-04-29` is not worked — it holds only a born-block.
10. Ten zero-booking/off dates are expected (listed in §19.6).
11. Reconstruction begins `2026-02-06`.
12. Lifecycle becomes passive / effective-to at `2026-08-04`.
13. No bookings expected after `2026-08-04`.
14. Final open segment `[Monday, Tuesday, Thursday, Friday, Saturday, Sunday]` from `2026-08-04`.
15. No terminal zero-day week — the seed core refuses empty weekly patterns.

**Every one of them was verified against production rather than assumed.** All fifteen hold.

### 19.3 · The sanitized evidence method

Reads only. Each carries an explicit Firestore **field mask**, so a client name, phone, email or
booking note never entered the process — it is not filtered from the output, it is never read.
The query shapes, in full:

```
getAll( tenants/whitecross,
        tenants/whitecross/settings/settings )          fieldMask: presentation
getAll( tenants/whitecross/barbers/barber-1777655430086 )
        fieldMask: name,status,active,workingDays,dayHours,hours,availabilityFrom,
                   shiftChanges,leaveFrom,leaveUntil,leaves,scheduleMode
getAll( tenants/whitecross/staffComp/barber-1777655430086 )      fieldMask: history
doc(    tenants/whitecross/staffRota/barber-1777655430086 ).get()
coll(   tenants/whitecross/staffRota/{id}/rotaEntries ).count().get()
doc(    tenants/whitecross/rotaPolicy/rollout ).get()
coll(   tenants/whitecross/auditLogs ).where(barberId == barber-1777655430086)
        .select(action,timestamp,barberId,details).get()
coll(   tenants/whitecross/bookings )
        .select(barberName,barberId,startTime,date,time,status,source,bookingId,
                serviceId,service,soldProducts,paidAmount,price,total).get()
coll(   tenants/whitecross/barbers ).select(name,status,active,workingDays,dayHours,hours,
                                            shiftChanges,leaveFrom,leaveUntil,leaves,
                                            availabilityFrom).get()
getAll( tenants/whitecross/settings/finance_config )             fieldMask: partnerConfig
coll(   tenants/whitecross/staffComp ).select(history).get()
```

`.get()`, `.select()`, `.count()` and `getAll()` only. The capture script was scanned for write
vocabulary (`set/update/delete/create/add/batch/runTransaction/createUser/setCustomUserClaims`)
and holds **none** — its single lexical match is `crypto.createHash(...).update(...)`, a hash.

Booking identifiers are **hashed** (SHA-256, first 12 hex) everywhere below; no raw booking id,
client name or amount attributable to a person is printed.

**Subject identity — the load-bearing detail.** Production stores `barberId` as a *legacy name
string* on most booking documents (`arda` 635, `Arda` 4) and the barber **document id** on only 13.
Matching on the document id alone finds **588 of 667** records. The correct resolver is the one
Finance itself uses at its read boundary (`scripts/wageDriftAudit.cjs:1157-1161`):

```
nameKey = normalizeName( barberName || nameById[barberId] || barberId )   →  'arda'
```

where `nameById` is keyed by barber **document id**. The third fallback is what catches the 79
records carrying only a legacy `barberId`. A reconstruction that skipped it would have under-counted
by 79 records and silently produced a shorter history.

### 19.4 · Baseline aggregates — the immutable pre-state

| Document | `updateTime` | SHA-256 of the masked content |
|---|---|---|
| `barbers/barber-1777655430086` | `2026-08-14T23:04:30.613Z` | `716eccd2a0b7998153571d69bfa50d5f0902533fe365ff044f46868ff40f0cb8` |
| `staffComp/barber-1777655430086` | `2026-08-12T22:13:50.923Z` | `b44afdeff4edb3ed70b6505d01542145e7f2ceffe22442d92c77a60fbc5269ae` |
| `barbers/*` (all 3, masked) | — | `bebc61c81e6532cf4c271f6e33fc95e075d16aa0248ae4720ee88844936be4e1` |
| `settings/finance_config.partnerConfig` | — | `7d410ddda7b1840f747cfd7cd96cef6544d4a26504cd1a1d524047b8b0de7afa` |
| `staffComp/*` (all 3) | — | `1929692479e3a68f8ecde8f7088008972ad231fce0a244847567b9c00fee40d2` |

Tenant `bookings` collection size at capture: **1610**. Arda's share: **667**.

Live `shiftChanges` on Arda — **7 keys, all `{closed: true, reason: 'personal'}`**:
`2026-06-30 · 07-02 · 07-16 · 07-19 · 07-25 · 07-26 · 08-03`. They are **not removed, not migrated
and not read for meaning** by this evidence; `overlappingShiftChangeKeys` reports all seven, and
they continue to outrank the log in Finance until `ROTA-SSOT-2` closes.

### 19.5 · Qualifying attendance — the rules, source-backed

Every classifier below is the **shipped** discriminator, quoted, not a restatement:

| Class | Authority |
|---|---|
| status normalization | `src/utils/bookingUtils.ts` → `normalizeBookingStatus` |
| source normalization | `src/utils/bookingUtils.ts` → `normalizeBookingSource` |
| born-block | `src/utils/bookingUtils.ts:99` → `isBlockRecord` — `status==='BLOCKED'` **or** `source==='block'` **or** `bookingId` starts `BLOCKED-` |
| standalone product sale | `src/utils/bookingUtils.ts:130` → `isProductSaleRecord` |
| tenant date key | `Intl.DateTimeFormat('en-CA', {timeZone})` over `startTime`, falling back to `date`+`time` — the `wageDriftAudit` boundary rule, ICU owns the DST arithmetic (INV-DATE-1) |

**Record classification, all 667:**

| Class | Count |
|---|---|
| qualifying `CHECKED_OUT` | **657** |
| qualifying `UNPAID` | **1** |
| non-qualifying — standalone product sale | **7** |
| non-qualifying — born-block | **2** |
| cancelled / no-show / other | **0** |
| **ambiguous** | **0** |

Status histogram: `CHECKED_OUT 664 · BLOCKED 2 · UNPAID 1` — matching the expected
`667 / 664 / 2 / 1` exactly.
Source histogram: `Walk-in 624 · Booksy 14 · Website 13 · Product Sale 7 · Fresha 4 · Treatwell 3 ·
block 2`.

The seven product-sale dates (`2026-05-08 · 06-08 · 06-13 · 06-28 · 07-20 · 07-24`) are **all** dates
Arda independently worked, so ruling 6 removes no date from the history — it is nevertheless applied,
because a rule that only matters when it does not matter is the one that breaks later.

### 19.6 · The worked-date evidence

**147 deduplicated worked dates**, `2026-02-06` → `2026-08-04`.

| Weekday | Count |
|---|---|
| Monday | 25 |
| Tuesday | 25 |
| **Wednesday** | **2** |
| Thursday | 23 |
| Friday | 25 |
| Saturday | 24 |
| Sunday | 23 |

**The two exceptional worked Wednesdays** — sanitized provenance:

| Date | Records | Classification |
|---|---|---|
| `2026-02-11` | 2 | two `CHECKED_OUT` **Walk-in** records, hashes `462697494735`, `e1c9ae42932d` |
| `2026-03-18` | 1 | one `CHECKED_OUT` **Booksy** record, hash `f78584e7d174` |

**The ten off dates.** Derived, not typed: every date in `[2026-02-06, 2026-08-03]` that falls on a
base working weekday and carries no qualifying record.

| Date | Weekday | Live `shiftChanges` |
|---|---|---|
| `2026-03-28` | Saturday | — |
| `2026-03-29` | Sunday | — |
| `2026-04-17` | Friday | — |
| `2026-06-30` | Tuesday | `closed: true` |
| `2026-07-02` | Thursday | `closed: true` |
| `2026-07-16` | Thursday | `closed: true` |
| `2026-07-19` | Sunday | `closed: true` |
| `2026-07-25` | Saturday | `closed: true` |
| `2026-07-26` | Sunday | `closed: true` |
| `2026-08-03` | Monday | `closed: true` |

Seven are already closed by the mutable map; **three — `2026-03-28`, `2026-03-29`, `2026-04-17` — are
not**, and those three are precisely the legacy false positives §19.9 removes.

**`2026-04-29` — RULED NOT WORKED.** It holds exactly one record: a born-block
(`status: BLOCKED`, `source: block`, hash `cf82440afa6c`). Ruling 5 applies and the date stays
non-worked. It is a **Wednesday**, so the base pattern already excludes it — no segment is needed and
the ruling costs nothing. The other born-block, `2026-05-28`, sits on a Thursday Arda independently
worked; it is likewise ignored, and the date stands on its own qualifying records.

**`2026-05-15` — RULED WORKED.** The £20 `UNPAID` walk-in (hash `57a7f4b934b2`, `price 20`,
`paidAmount 0`) is present exactly as the owner described, and ruling 3/4 admits it. **Stated
honestly: the ruling is not load-bearing for this date.** `2026-05-15` also carries four
`CHECKED_OUT` walk-ins, so it qualifies under ruling 2 alone. The ruling is recorded because it is the
*policy* — an UNPAID booking establishes attendance — not because this date depends on it. No date in
the whole reconstruction depends on it.

**After `2026-08-04`: zero records.** Ruling 13 confirmed — the latest Arda record of any class is
`2026-08-04`.

### 19.7 · The accepted seed plan — **21 segments**

Derived deterministically from the evidence and then validated by the **canonical planner itself**
(`functions/lib/staff/rotaSeedImport.js` built from `73e9ead`), not by hand:

```
canonicalizeSeedPlan(segments, [], todayKey='2026-08-24', barberDoc)
  → segments: 21   issues: []   coversTodayFrom: '2026-08-04'
buildSeedEntries(...)                    → entryCount: 21   (one ROTA_OPEN per segment)
computeCacheConvergence(...)             → reason: 'AS_OF_ADVANCED'
rotaLegacyWriteGate(..., passiveAuthorityLive: false)
                                         → ALLOW, blocking: null
predictedPublish                         → null
overlappingShiftChangeKeys               → the 7 keys listed in §19.4
declaredGaps                             → []   (the plan is contiguous; no holes to declare)
```

**Zero plan issues.** No `SEGMENT_GAP`, no `SEGMENT_OVERLAP`, no `SEGMENT_NOT_HISTORICAL`, no
`TODAY_NOT_COVERED`, no `BEFORE_AVAILABILITY_FROM`.

The base pattern is `Monday, Tuesday, Thursday, Friday, Saturday, Sunday` — abbreviated **BASE**
below. An **off** exception states the base *minus* the weekday it covers; a **worked-Wednesday**
exception states `['Wednesday']` alone.

| # | effectiveFrom | effectiveTo | workingDays | Kind | Evidence |
|---:|---|---|---|---|---|
| 1 | `2026-02-06` | `2026-02-10` | BASE | base | base weekly pattern, Wednesday off |
| 2 | `2026-02-11` | `2026-02-11` | `Wednesday` | single-date exception | 2 CHECKED_OUT walk-ins on a Wednesday |
| 3 | `2026-02-12` | `2026-03-17` | BASE | base | base weekly pattern |
| 4 | `2026-03-18` | `2026-03-18` | `Wednesday` | single-date exception | 1 CHECKED_OUT Booksy booking on a Wednesday |
| 5 | `2026-03-19` | `2026-03-27` | BASE | base | base weekly pattern |
| 6 | `2026-03-28` | `2026-03-29` | `Monday, Tuesday, Thursday, Friday` | 2-day exception | no qualifying booking on a base Saturday **+** Sunday |
| 7 | `2026-03-30` | `2026-04-16` | BASE | base | base weekly pattern |
| 8 | `2026-04-17` | `2026-04-17` | `Monday, Tuesday, Thursday, Saturday, Sunday` | single-date exception | no qualifying booking on a base Friday |
| 9 | `2026-04-18` | `2026-06-29` | BASE | base | base weekly pattern (contains `2026-04-29`, a Wednesday — block-only, already non-working) |
| 10 | `2026-06-30` | `2026-06-30` | `Monday, Thursday, Friday, Saturday, Sunday` | single-date exception | no qualifying booking on a base Tuesday |
| 11 | `2026-07-01` | `2026-07-01` | BASE | base | one-day base run between two exceptions |
| 12 | `2026-07-02` | `2026-07-02` | `Monday, Tuesday, Friday, Saturday, Sunday` | single-date exception | no qualifying booking on a base Thursday |
| 13 | `2026-07-03` | `2026-07-15` | BASE | base | base weekly pattern |
| 14 | `2026-07-16` | `2026-07-16` | `Monday, Tuesday, Friday, Saturday, Sunday` | single-date exception | no qualifying booking on a base Thursday |
| 15 | `2026-07-17` | `2026-07-18` | BASE | base | base weekly pattern |
| 16 | `2026-07-19` | `2026-07-19` | `Monday, Tuesday, Thursday, Friday, Saturday` | single-date exception | no qualifying booking on a base Sunday |
| 17 | `2026-07-20` | `2026-07-24` | BASE | base | base weekly pattern |
| 18 | `2026-07-25` | `2026-07-26` | `Monday, Tuesday, Thursday, Friday` | 2-day exception | no qualifying booking on a base Saturday **+** Sunday |
| 19 | `2026-07-27` | `2026-08-02` | BASE | base | base weekly pattern |
| 20 | `2026-08-03` | `2026-08-03` | `Tuesday, Thursday, Friday, Saturday, Sunday` | single-date exception | no qualifying booking on a base Monday |
| 21 | `2026-08-04` | **`null`** | BASE | **final, open-ended** | live projection at the passive / effective-to boundary |

Covered interval: **`2026-02-06` → open-ended, contiguous, no declared gaps.**

**Why 21 and not 23.** Twelve exception dates + eleven base runs would be 23 segments. Two pairs of
exceptions are *calendar-adjacent* — `2026-03-28/29` and `2026-07-25/26` — and each pair collapses
into ONE period whose pattern excludes both weekdays. Two adjacent one-day segments and one two-day
segment say the identical thing about the identical days; the merged form is the smaller true
statement. That merge, and only that merge, is the difference between 23 and **21**.

**No segment carries `dayHours` or `hours` except the last.** Arda has **no owner ruling on
historical hours** — unlike Alex, whose Mon–Sat 09:00–19:00 / Sun 10:00–16:00 was ruled on in §13.
`validatePattern` treats both keys as optional, so the plan states exactly what the evidence
establishes (which days were worked) and invents no shift times nobody recorded. **If the owner wants
historical hours in Arda's log, that is a separate ruling and a different digest.**

#### Every Phase-4 obligation, discharged

| Claim | Proof |
|---|---|
| exactly 21 segments | `canonicalizeSeedPlan` → `segments.length === 21`, `issues: []` |
| first effective date `2026-02-06` | segment 1; `availabilityStartVerdict` passes — `availabilityFrom` is `2026-02-06` |
| final segment from `2026-08-04` | `coversTodayFrom === '2026-08-04'`, `effectiveTo === null` |
| no terminal empty pattern | final pattern has 6 working days; `isArchiveTerminalPattern` is false for every segment; no `SEGMENT_WEEKLY_NO_WORKING_DAYS` |
| both worked Wednesdays represented | segments 2 and 4 |
| the three legacy false positives become non-worked | segments 6 and 8 (see §19.9) |
| all ten off dates represented | segments 6, 8, 10, 12, 14, 16, 18, 20 |
| `2026-04-29` stays non-worked | inside segment 9, a Wednesday, excluded by BASE |
| `2026-05-15` stays worked | inside segment 9, a Friday, included in BASE |
| 147 dated wage days | §19.9, computed by the shipped Finance reader |
| no segment depends on deleting `dayHours.Wednesday` | §19.8 |

### 19.8 · `dayHours.Wednesday` stays, and this is why

Arda's live document carries a `dayHours` row for **all seven weekdays**, including the Wednesday he
does not work — a stray left by the Staff editor. It must not be touched. The final segment's shape
is what decides that, and the three candidate shapes were each run through the real planner and the
real convergence:

| Final-segment `dayHours` | Planner | Convergence | Effect on `barbers.dayHours` |
|---|---|---|---|
| **A — omitted (ACCEPTED)** | ✅ valid | `AS_OF_ADVANCED` | `predictedPublish: null` — **no barber write at all** |
| B — verbatim 7-day snapshot (Alex's §16 recipe) | ❌ **`DAY_HOURS_NOT_IN_PATTERN`** | — | plan refused outright |
| C — retyped 6-day rows (Wednesday dropped) | ✅ valid | `PATTERN_CHANGED` | **WRITE** `dayHours` = 6 keys → **`Wednesday` DELETED** |

Both failure modes trace to one line each, and neither is incidental:

- **B** — `canonicalizeSeedPlan` checks `dayHours` containment on the *normalized* pattern
  (`rotaSeedImport.ts:729-733`), and `normalizeRotaPattern` passes `input.dayHours` through
  **verbatim** without stripping non-working rows (`rotaFold.ts`). So the stray Wednesday row makes a
  verbatim snapshot illegal. Alex's manifest could snapshot verbatim only because his `dayHours` keys
  are a subset of his `workingDays`; Arda's are not.
- **C** — `hashCurrentAgainst` compares the live document *under the key set the target declares*
  (`rotaFold.ts`). Declare `dayHours` and the seven-key live value is compared against the six-key
  plan, `patternChanged` becomes true, and `toRotaBarberFieldUpdate` emits a `dayHours` write. The
  gate does **not** stop it: Arda is passive, but the passive branch only fires on an `UNCOVERED`
  convergence, and today *is* covered by the open final segment — so the gate returns `ALLOW` and the
  write would land.

Omitting `dayHours` makes the comparison run over `scheduleMode + workingDays + hours` only. All
three already equal the live values, so `patternChanged` is false, `barberFieldUpdate` is `null`, and
**the seed performs no write to Arda's barber document.** `dayHours.Wednesday` survives because
nothing goes near it — not because a rule protects it. Reintroduce `dayHours` into segment 21 and
option C is what you get.

This is the concrete meaning of the earlier terminal marker
`ARDA_STRAY_CACHE_PROVEN_SEED_SAFE_NO_CLEANUP`: seed-safe **given this segment shape**, and not
otherwise.

### 19.9 · Independent Finance proof — legacy vs dated

Computed **locally** against the captured read-only evidence with the shipped pure readers
(`src/utils/financeWages.accrualDayKeys`, `financeRotaHistory.buildRotaHistoryIndex` /
`rotaDayResolver`), the dated side driven by the 21 segments through
`rotaSeedImport.buildSeedEntries`. The entries are read the way the app reads them — ordered by
`seq`, unwrapped from the `.entry` envelope (`src/utils/rotaHistoryActions.ts:73-77`).

**Deployed Finance modes at `73e9ead`** — the dated path is exercised here through the per-call
`rotaMode` seam only; none of these constants is changed by this task:

```
FINANCE_ROTA_HISTORY_MODE = 'legacy'      FINANCE_COMP_PERIOD_MODE = 'periods'
FINANCE_COMP_AMOUNT_MODE  = 'legacy'      FINANCE_FIXED_COST_MODE  = 'legacy'
```

#### The four authorities, kept separate

| Authority | Who decides | Value for Arda |
|---|---|---|
| **attendance** | qualifying bookings | 147 worked dates (§19.6) |
| **rota** | which weekday the day is — `barbers.workingDays` + `shiftChanges` (legacy) *vs* the dated log (dated) | the only thing that moves |
| **compensation period** | `staffComp.history` under `FINANCE_COMP_PERIOD_MODE='periods'` | `2026-02-06` → **`2026-08-04`** |
| **compensation amount** | `finance_config.partnerConfig` under `FINANCE_COMP_AMOUNT_MODE='legacy'` | `Arda.wage = 100`, `wageStartDate = 2026-02-06` |

The **£100/day authority is `partnerConfig`, not `staffComp`.** `staffComp` says £600/week, which
normalises to the same £100 over six contracted days — but under the live `'legacy'` amount mode it
is not read at all. Both agree here; the distinction is recorded so a later amount-mode flip is a
decision rather than a surprise.

#### Arda

| | Days | Cost |
|---|---:|---:|
| legacy | **148** | **£14,800.00** |
| dated (these 21 segments) | **147** | **£14,700.00** |
| **delta** | **−1** | **−£100.00** |

`148 × £100 = £14,800` · `147 × £100 = £14,700` · delta `−£100`.

**The five changed dates, and nothing else changed:**

| Date | Weekday | legacy | dated | Δ | Why |
|---|---|---|---|---:|---|
| `2026-02-11` | Wednesday | no pay | **pay** | **+£100** | worked; the undated array says Wednesday is off |
| `2026-03-18` | Wednesday | no pay | **pay** | **+£100** | worked; same |
| `2026-03-28` | Saturday | pay | **no pay** | **−£100** | no qualifying booking, and no `shiftChanges` entry to close it |
| `2026-03-29` | Sunday | pay | **no pay** | **−£100** | same |
| `2026-04-17` | Friday | pay | **no pay** | **−£100** | same |

Net `+£200 − £300 = −£100`. The seven `shiftChanges`-closed off dates move nothing: legacy already
excludes them, and so does the dated plan — they agree, which is the correct outcome.

**Arda's figures are window-invariant.** His comp period closes `2026-08-04`, so every day after it
is `'outside'` and accrues nothing under either authority — even though the open final segment names
six working days. That is the compensation-period authority doing its job, and it is why the open
segment is safe: **the rota says he *would* work; the comp period says he is no longer paid.**

#### The accepted combined comparison, reproduced

Over the window **`2026-02-06` → `2026-08-20`** (the §18 Alex apply date):

| Subject | legacy | dated | delta |
|---|---:|---:|---:|
| Alex | £19,100.00 (191 d) | £18,000.00 (180 d) | **−£1,100.00** |
| Muhamed | £1,414.40 (34 d) | £1,414.40 (34 d) | **£0.00** |
| Arda | £14,800.00 (148 d) | £14,700.00 (147 d) | **−£100.00** |
| **combined** | **£35,314.40** | **£34,114.40** | **−£1,200.00** |

Every figure in the accepted comparison reproduces to the penny.

> ⚠️ **Two scopes exist and neither overwrites the other.** The accepted totals above are a
> **window-bounded** measurement ending `2026-08-20`. Recomputed to **today (`2026-08-24`)** from the
> same live compensation data, the levels move because Alex and Muhamed are still accruing:
> Alex £19,500.00 → £18,400.00, Muhamed £1,580.80 → £1,580.80, Arda **unchanged** at
> £14,800.00 → £14,700.00, combined £35,880.80 → £34,680.80. **Every delta is identical in both
> scopes** — Alex −£1,100, Muhamed £0, Arda −£100, combined −£1,200. The accepted absolute totals are
> therefore a correct measurement of a *stated window*, not a standing balance, and must be read with
> that window attached. Arda is the only subject for whom the two scopes coincide, because his comp
> period is closed.

Muhamed's `leaves[] = [{from: 2026-07-14, until: 2026-08-17}]` is load-bearing for his figure and is
applied through the real `isBarberOnLeaveForDate` rule. Stubbing leave out inflates him from 34 to 68
days — recorded because it is the easiest way to get this comparison wrong.

### 19.10 · Identifiers — what is local evidence and what is not

| Value | Status |
|---|---|
| `seedPlanDigest` `d32c6d4b62260440ac399c307c1031cf074bf0cb30b00d367169ea578298b702` | **LOCAL EVIDENCE ONLY.** Computed here by `computeSeedPlanDigest` over the canonicalized 21 segments. Recorded so a future manifest can be checked against it. **NOT installed in `salownadmin` by this task.** |
| `changeId` `rota-seed-d32c6d4b62260440ac399c307c1031cf` | derived locally from that digest |
| `auditId` `rota-seed-barber-1777655430086-9ca43d62e806d1c1` | derived locally from `(barberId, digest)` |
| `entryCount` **21**, `revisionFrom` 0 → `revisionTo` 1 | from the local plan |
| `predictedPublish` **`null`** | from the local convergence + gate |
| **`sourceRotaFingerprint`** | ⛔ **DELIBERATELY NOT FIXED HERE.** A local value over the 2026-08-14 snapshot (`c0bfbcb3…d74c`) exists but is **not** a manifest constant. It must be generated fresh by the sanctioned production **dry run** at the moment of materialization — its entire purpose is to refuse a run whose subject document moved, and pinning a stale one defeats it. |

Any of the derived identifiers becomes **STALE** the moment a segment, a boundary or a pattern
changes. They are a record of *this* plan, not a licence for a different one.

### 19.11 · Expected warnings at the eventual dry run

Not defects — things an approver must read before approving:

- `the subject is passive; a departed member's history is rarely what a seed is for` — expected and
  correct: this seed exists **because** Arda departed and his months are already priced.
- `7 shiftChanges key(s) overlap the seeded range; they are NOT removed, NOT migrated and still
  outrank the log in Finance until ROTA-SSOT-2 is closed`.
- `the legacy cache publishes nothing for today; the barber document is unchanged by this seed` —
  this is §19.8's guarantee, surfaced by the server.

No **terminal-archive** warning is expected: this is a `HISTORY` manifest, not an `ARCHIVE`. Ruling
15 forbids a terminal zero-day week, and the departure is expressed by the closed **compensation
period**, not by a `by_exception` rota terminal.

### 19.12 · Boundaries — what this evidence does NOT license

- It does **not** create `ARDA_WHITECROSS_MANIFEST`. `salownadmin/src/ops/rotaSeedManifests.js` still
  registers **Alex only**, unchanged at `f2df127`.
- It does **not** authorise a dry run, an apply, a bootstrap, a rollout flip or a Finance-mode change.
- `salownRotaBootstrapTenant` **must never run for Arda**, before or after any seed: the bootstrap
  writes at `expectedRevision: 0` / `ROTA_CHAIN_GENESIS`, so seed-then-bootstrap is `REFUSED` and
  bootstrap-then-seed is `SAME_LANE_OVERLAP`. The two cannot both run on one subject (§8).
- **Rollback boundary:** there is nothing to roll back. Zero production writes were made. The seed
  itself, once applied, is **append-only and irreversible** — which is exactly why this evidence is
  being frozen before anything is materialized.
- Arda's `status`, `active`, `workingDays`, `dayHours` (including the stray `Wednesday`), `hours`,
  `shiftChanges`, `availabilityFrom`, `staffComp` and bookings are **untouched and byte-identical** to
  the baseline in §19.4.

### 19.13 · The next separately authorized step

Materialize `ARDA_WHITECROSS_MANIFEST` in `salownadmin` — `kind: MANIFEST_KIND.HISTORY`, the 21
segments of §19.7, `declaredGaps: []`, `expected.seedPlanDigest` set to §19.10's value,
`expected.entryCount: 21`, `expected.predictedPublish: null`,
`expected.finalSegmentFrom: '2026-08-04'`, **no `sourceRotaFingerprint` constant** — with its tests
and its `integritySha256`. **Do not dry-run and do not apply until separately authorized.**
