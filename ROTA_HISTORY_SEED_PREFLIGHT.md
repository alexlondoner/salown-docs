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

---

## 20 · Arda — the authenticated production dry run, 2026-08-24

> ### Result
> ```
> PLANNED · readiness GRANTED · ZERO WRITES · APPLY NOT INVOKED
> ```
> Exactly **one** authenticated dry-run invocation of `salownRotaSeedTenantHistory`, through the
> deployed super-admin operator surface, as `aerulas@gmail.com`. It wrote nothing. **Apply was never
> clicked, never enabled, and cannot be constructed in this artifact.**

**Identities.** `salownadmin` `c1c2b14` → **`4f8a295`** · `salown-app` `9b6f7ea` → **`6178a59`** ·
`salown-docs` **`815d537`** (this section is the next commit). All three `main`, all clean, no claims.

### 20.1 · Why a corrective release came first

§19 accepted the evidence but the **operator could not run it**, for two independent reasons found
before any browser was opened:

1. **The Arda manifest was not in the deployed artifact.** The live surface was
   `ef97ebdd3834ec74` (2026-08-20), predating `c1c2b14`. A served-byte scan found
   `alex-whitecross-2026-02-06` ×1 and `arda-whitecross-2026-02-06` ×0.
2. **The readiness validator could not accept a fresh-fingerprint manifest.** `c1c2b14` did not
   touch `rotaSeedContract.js`, whose fingerprint rule was a single unconditional equality. Arda
   deliberately pins none (§19.10), so `undefined !== <any real fingerprint>` failed *every*
   possible Arda readiness. Proven by feeding a **perfect** contract-conformant Arda response
   through the real validator: `FINGERPRINT_MISMATCH`, while an Alex control passed.

The one authorized dry run was **not spent** on that predetermined refusal. `4f8a295` fixed both.

### 20.2 · The correction, and that it did not weaken Alex

`4f8a295` changed three files — `rotaSeedContract.js`, `RotaHistorySeed.jsx`, and a new
`rotaSeedFreshFingerprint.test.js`. **`rotaSeedManifests.js` is not in the diff**, so the Arda
manifest is byte-identical to the reviewed `c1c2b14` (`git diff c1c2b14 HEAD -- …manifests.js` is
empty) and the accepted digest, integrity checksum and 21 segments are untouched.

The fingerprint rule is now two modes, **both fail closed**:

| Manifest | Policy | Rule |
|---|---|---|
| Alex | `pinned` | `expected.sourceRotaFingerprint` present → **exact match**; mismatch is still `FINGERPRINT_MISMATCH` |
| Arda | `fresh` | expected absent → the server **must** return a well-formed lowercase 64-hex SHA-256; accepted, surfaced for audit, **never written back** |

`fresh` is a **shape** test, not a truthiness test. Verified case by case against the shipped
validator:

| Server value | Verdict |
|---|---|
| valid lowercase 64-hex | **ACCEPT** |
| 63 chars · 65 chars · UPPERCASE · non-hex · `''` · missing · `null` · number · boolean | **REFUSE — `FINGERPRINT_MALFORMED`** |
| Alex + a *well-formed but wrong* fingerprint | **REFUSE — `FINGERPRINT_MISMATCH`** |

### 20.3 · The deployment — one target, proven

| | |
|---|---|
| Command | `bash deploy.sh` (repo-guarded; requires typing `salown-admin`) → `npm run build` + `npx firebase-tools deploy --only hosting --project havuz-44f70` |
| Scope | `firebase.json` declares **one** hosting entry, `site: salown-admin`, **no predeploy/postdeploy hooks** and no `functions`/`rules`/`indexes`/`storage` keys — so `--only hosting` cannot reach a second target from this repo |
| CLI | **15.15.0** (global and `npx firebase-tools` resolve identically — no version ambiguity) |
| Project | `havuz-44f70` |
| Output | `found 5 files in dist`, **3 uploaded**, version finalized, release complete |
| `salown-admin` | `ef97ebdd3834ec74` → **`7c41a5f53da72474`**, release `1787586651571000`, `2026-08-24T15:50:44.463825Z` |

`dist/` is **git-ignored and untracked**, so the build dirtied no tracked file — repo `dirty=0`
before and after. No REL-1-style cross-bundle contamination is possible from this repo.

**Every other deployable target, before → after — all identical:**

| Target | Before | After |
|---|---|---|
| `salown` | `c0d31a9fac873c69` | `c0d31a9fac873c69` ✅ |
| `salown-staff` | `c0606fdcb48f5207` | `c0606fdcb48f5207` ✅ |
| `whitecrossbarbers-saas` | `d7d72c6755a35044` | `d7d72c6755a35044` ✅ |
| **callable** `salownRotaSeedTenantHistory` | `…-00002-dun` (2026-08-21T21:13:59Z) | **`…-00002-dun`, unmoved** ✅ |

### 20.4 · Served-byte verification, in the documented order

1. The operator page references **`/assets/index-B2ep1SQp.js`** (read from the served HTML, not assumed).
2. That asset returns **HTTP/2 200** — checked as its own step.
3. Served hash **equals** the local build byte for byte:

```
served : 1086427 B  sha256 7143c8ec9d92a03af2388119ea829b5b04b9684cf830022243e122d57ef013fa
local  : 1086427 B  sha256 7143c8ec9d92a03af2388119ea829b5b04b9684cf830022243e122d57ef013fa   MATCH
```

| Assertion | Result |
|---|---|
| `arda-whitecross-2026-02-06` | ✅ present |
| `barber-1777655430086` | ✅ present |
| full digest `d32c6d4b…8b702` | ✅ present |
| full integrity `3402ac05…e6260` | ✅ present |
| `FINGERPRINT_MALFORMED` · `fingerprintPolicy` · `server-bound` copy | ✅ present |
| 64-hex shape test `[0-9a-f]{64}` | ✅ present |
| `alex-whitecross-2026-02-06` + Alex digest + Alex **pinned** fingerprint + `FINGERPRINT_MISMATCH` | ✅ preserved |
| hardcoded **"24 entries"** operator copy | ✅ **gone** — now `${entryCount} entries + 1 header + 1 audit + ${+!!predictedPublish} barber projection` |

**One posture change, recorded rather than glossed.** In the previous release `buildApplyPayload`
was *tree-shaken out*; in this build it is **present** (minified `B3`). That is weaker than before
and worth stating plainly. It is nevertheless unreachable in three independent ways, all verified in
the **served** bytes: `ROTA_SEED_APPLY_ENABLED = false`; the function's first statement is
`if(!n)throw Error("APPLY_DISABLED_IN_THIS_BUILD: ROTA_SEED_APPLY_ENABLED is false")` with the gate
defaulted from that constant; and its only call site sits behind the same gate plus a plan-identity
check. The page renders **"Apply seed — DISABLED IN THIS BUILD"** with no reachable handler.

### 20.5 · Operator identity and the displayed plan

Single connected browser, confirmed with the owner before use: **Browser 1**
(`c78ec85f-1d0b-40f6-8dad-e64dd17c6cdd`, macOS, local). Surface
`https://salown-admin.web.app/ops/rota-seed`, project `havuz-44f70`. Operator
**`aerulas@gmail.com` · `CsktIKNC0wRaP2eK8DECVMWPD0m1`**, super-admin.

Default selection is **Alex**; `arda-whitecross-2026-02-06` was selected explicitly. Displayed
before invoking, all matching the authoritative values:

| Row | Displayed |
|---|---|
| Tenant | `whitecross` |
| Subject | `Arda · barber-1777655430086` |
| Kind | `HISTORY` |
| Periods | 21 periods — base six-day weeks (Wednesday off), two dated worked Wednesdays (02-11, 03-18), eight dated off exceptions, 1 open-ended from 2026-08-04 |
| Expected digest | `d32c6d4b…8b702` |
| Source fingerprint | **fresh / server-bound — pinned by nothing (docs §19.10)** |
| Expected writes | **`23 = 21 entries + 1 header + 1 audit + 0 barber projection`** |
| Barber Document | NOT written … `predictedPublish: null` |
| Final Segment | open-ended from 2026-08-04, **omits dayHours so the live stray `dayHours.Wednesday` is left untouched** |
| Apply | **DISABLED IN THIS BUILD** |

**Manifest-driven confirmed:** Arda's own `Worked Wednesdays` / `Final Segment` rows render, Alex's
`Partial Day` / `Off Tuesdays` / `Final Thursday` rows are **absent**, and there are **no
`undefined` rows**. The Stage-2 confirm phrase re-keyed to `whitecross/barber-1777655430086/d32c6d4b6226`.

> ⚠️ **Two contract fields are not rendered as rows** — `integritySha256` and `declaredGaps: []`.
> Neither *differs*; both were verified by other means (integrity present in the served bytes;
> `declaredGaps: []` in the reviewed manifest and in the payload builder). Recorded as a UI display
> gap, not a contract mismatch, so a future operator is not surprised by their absence.

### 20.6 · Readiness and the dry run are ONE action here

Worth stating because the distinction matters for counting invocations: this operator has **no
separate non-callable preflight**. `runDryRun` calls the real callable with `dryRun: true` and feeds
the response into `validateDryRunResponse`, whose verdict *is* readiness. So readiness and the dry
run are the same single click and the same single request — which is why the count below is one, not
two.

### 20.7 · The invocation, and its result

**Exactly one** request, captured at the network layer:

```
POST https://europe-west2-havuz-44f70.cloudfunctions.net/salownRotaSeedTenantHistory   200
```

One request in the whole session — no retry, no second dry run, no apply. The payload is
`buildDryRunPayload`, which hardcodes `dryRun: true` and carries **only** `tenantId`, `barberId`,
`segments`, `declaredGaps` — it cannot express `dryRun:false`, an `expectedRevision` or a fingerprint.

**Server verdict — `Dry run verified.`**

| Field | Expected | Actual | |
|---|---|---|---|
| tenantId | `whitecross` | `whitecross` | ✅ |
| barberId | `barber-1777655430086` | `barber-1777655430086` | ✅ |
| manifest | `arda-whitecross-2026-02-06` | same | ✅ |
| kind | `HISTORY` | `HISTORY`, `archiveTerminalFrom` null | ✅ |
| state | `PLANNED` | `PLANNED` | ✅ |
| entryCount | 21 | **21** | ✅ |
| seedPlanDigest | `d32c6d4b…8b702` | matched | ✅ |
| changeId | `rota-seed-d32c6d4b62260440ac399c307c1031cf` | matched | ✅ |
| revision | 0 → 1 | 0 → 1 | ✅ |
| write set | 23 | **`23 = 21 entries + 1 header + 1 audit + 0 barber projection`** | ✅ |
| predictedPublish | `null` | `null` (0 barber projection) | ✅ |
| declaredGaps | `[]` | `[]` | ✅ |
| issues | `[]` | none | ✅ |
| genesis pre-state | `17516577…dcdc2b3` | unseeded, at genesis | ✅ |
| published | false | false — dry run, zero writes | ✅ |

**Fresh `sourceRotaFingerprint`, server-generated:**

```
c0bfbcb39b8a9bef4ecc4f71950192e6f27b355a913c5f639e6951db1e02d74c
```

> **This is EVIDENCE, not a manifest constant.** It is audit-only, explicitly *not persisted*, and
> **must never be pinned into the manifest**. It is a hash of Arda's live rota-relevant fields, so it
> **goes stale the moment his barber document changes** — any later apply requires its own fresh dry
> run in the artifact that will perform it. Pinning it would defeat the precondition it exists to be.

An independent corroboration worth recording: §19's read-only capture computed the same value
locally from the barber document via `sourceRotaFingerprint`'s five inputs. The server derived it
from live production; the two agree exactly — the plan is bound to the subject state we audited.

`predictedEntriesHash` `e2099b646239ae7af2fce85c039ffa6e07fef8aea89307183d5715a08d02e46f` is
**OUTPUT ONLY** — actor-dependent, never a precondition.

**The three warnings are exactly the three §19.11 predicted**, none a defect: 7 overlapping
`shiftChanges` keys (not removed, not migrated, still outranking the log until ROTA-SSOT-2); the
subject is passive; the legacy cache publishes nothing so the barber document is unchanged.

### 20.8 · Zero-mutation proof

Full baseline re-read after the invocation and compared field by field — **21/21 identical**:

| Field | Value | |
|---|---|---|
| barber `docHash` | `716eccd2a0b7998153571d69…` | ✅ |
| barber `updateTime` | `2026-08-14T23:04:30.613Z` | ✅ |
| status / active | `passive` / `false` | ✅ |
| `workingDays` | Mon, Tue, Thu, Fri, Sat, Sun | ✅ |
| `hours` | `{open 09:00, close 19:00}` | ✅ |
| **`dayHours` (full byte hash)** | `ebaa65769faa53bdc8ec315dbea34c24…` | ✅ |
| **`dayHours.Wednesday`** | `{open 09:00, close 19:00, closed false, source staff}` | ✅ **untouched** |
| `shiftChanges` (full byte hash) | `9258ac3907cae4cea6292ef4762ac6fe…` · 7 keys | ✅ |
| `availabilityFrom` | `2026-02-06` | ✅ |
| fingerprint inputs | `c0bfbcb3…` | ✅ |
| `staffComp` hash / `updateTime` | `b44afdef…` / `2026-08-12T22:13:50.923Z` | ✅ |
| **`staffRota/barber-1777655430086`** | **still ABSENT** | ✅ |
| **`rotaEntries`** | **still 0** | ✅ |
| **`rotaPolicy/rollout`** | **still ABSENT** | ✅ |
| lifecycle audits | **13**, id-set hash `7e4e0f67…` unchanged | ✅ |
| Arda records | 667 | ✅ |

**No header, no entries, no rollout, no seed/bootstrap/lifecycle/Finance audit was created.** Finance
constants unchanged: `ROTA_HISTORY=legacy`, `COMP_PERIOD=periods`, `COMP_AMOUNT=legacy`,
`FIXED_COST=legacy`.

Tenant-wide `bookings` read 1615 both before and after this invocation. (It stood at 1610 during the
§19 capture; the difference is the salon's ordinary live trading across the intervening days, not
attributable to anything here — Arda's own record count is unchanged at 667 and he is passive.)

### 20.9 · Rollback and boundaries

**Hosting rollback target: `ef97ebdd3834ec74`** (Console → Hosting → `salown-admin` → Release
history → ⋮ → Roll back). Nothing else needs rolling back — the deploy is the only mutation this
task made anywhere, and it is a static artifact with apply compile-time disabled.

Still **not** authorized and **not** done: apply, `dryRun:false`, any second dry run, function
deployment, other hosting targets, rules/indexes, bootstrap, rollout, Finance-mode change, Schedule
Hub save, `dayHours.Wednesday` normalization.

### 20.10 · The next separately authorized step

An apply would require, in order: a reviewed source change setting `ROTA_SEED_APPLY_ENABLED = true`,
a redeploy of `hosting:salown-admin`, a **fresh** dry run *inside that apply-enabled artifact*
(the fingerprint above is not reusable), the typed confirmation
`whitecross/barber-1777655430086/d32c6d4b6226`, and its own explicit authorization. The seed remains
**append-only and irreversible**; `salownRotaBootstrapTenant` must never run for this subject.

---

## 21 · Arda — ✅ APPLIED, 2026-08-25

> ### Result
> ```
> SEEDED · revision 0 → 1 · 21 entries · 23 writes · barber document NOT written
> ```
> One fresh dry run and **one** Apply through the deployed super-admin operator as
> `aerulas@gmail.com`. The seed is committed and **irreversible**. Finance modes are unchanged and
> **no wage total moved**. `dayHours.Wednesday` is untouched.
>
> ⚠️ **The operator UI reported the apply as FAILED. It did not fail.** The client-side response
> validator is defective for a fresh-fingerprint manifest — §21.6. The write is correct and
> complete; only the browser's verdict was wrong.

**Anchors.** `salownadmin` `4f8a295` → **`7af5090`** · `salown-app` `6178a59` → **`a1d863e`** ·
`salown-docs` `6960ca0`. All clean, no claims.

### 21.1 · The apply-enabled release

`7af5090` deliberately ships `ROTA_SEED_APPLY_ENABLED = false`; the enabled artifact is produced only
by a reviewed one-line flip at deploy time. That flip was made, deployed, and **immediately reverted**:

| Step | Evidence |
|---|---|
| flip | `false` → `true` — **one line, one file**; `git diff --stat` = `1 file changed, 1 insertion(+), 1 deletion(-)`; untracked 0 |
| gates | `node --test` **133/140**. The 7 failures are *exactly* the kill-switch guards (`AO-15 the committed build is apply-DISABLED…`, `the kill switch is a source constant…`, `APPLY-1 false build…`, `ARCH-23 apply copy is DERIVED…`, `OP-9 Apply stays disabled…`, `production apply is DISABLED…`, `apply is disabled in this build and says so`). They assert the *committed* constant is `false`, so they **must** fail during an authorized flip — that is their purpose: catching an *accidental* enabled build. Before the flip 140/140; after the revert **140/140** |
| deploy | `bash deploy.sh` → `npm run build` + `npx firebase-tools deploy --only hosting --project havuz-44f70`, **CLI 15.15.0**, 5 files found, **2 uploaded** |
| hosting | `salown-admin` `7c41a5f53da72474` → **`b208d564c11edc34`**, release `1787616045731000`, `2026-08-25T00:00:38.217516Z` |
| revert | source restored to `false`; `rotaSeedContract.js` **byte-identical** to the pristine `7af5090` copy (`sha256 020e5751ade21026…ebac55`); tree `dirty=0`, untracked 0 |

**Nothing else moved.** `salown` `c0d31a9fac873c69`, `salown-staff` `c0606fdcb48f5207`,
`whitecrossbarbers-saas` `d7d72c6755a35044`, callable `salownrotaseedtenanthistory-00002-dun` —
identical before and after.

### 21.2 · Served-byte proof of the apply-enabled artifact

Asset read from the served HTML, status checked separately, then hashed:

```
/assets/index-DvympQm7.js   HTTP/2 200   1 087 131 B
served sha256 7d2ff33ce56278ed60fb07a698ca0f9c86946f7d4f86935b234a67533f0de69c
local  sha256 7d2ff33ce56278ed60fb07a698ca0f9c86946f7d4f86935b234a67533f0de69c   MATCH
```

The **compiled enabled marker**, from the served bytes — the gate's default is `!0` where the
previous release compiled `!1`:

```js
function B3(e,t,n=!0){if(!n)throw Error(`APPLY_DISABLED_IN_THIS_BUILD: …`)…
```

Present: Arda id, `barber-1777655430086`, full digest `d32c6d4b…8b702`, full integrity
`3402ac05…e6260`, **`Integrity SHA-256` and `Declared gaps` rows** (the two §20.5 display gaps, now
closed), `fingerprintPolicy` / `FINGERPRINT_MALFORMED`, single-flight ref guards. Preserved: Alex id,
Alex **pinned** fingerprint, `FINGERPRINT_MISMATCH`. **Absent:** the §20 fingerprint as a constant.

The confirmation phrase and the `[]`-gaps text are **runtime-constructed**
(``n6(e) → `${tenantId}/${barberId}/${digest.slice(0,12)}` `` and `J3(C)`), so their absence as string
literals is correct, not a miss.

### 21.3 · Genesis, the fresh dry run, and the drift recheck

Genesis proven clean immediately before: header **absent**, `rotaEntries` **0**, the plan's audit id
**absent**, `rotaPolicy/rollout` **absent**.

**Exactly one** dry-run POST → `200`: `PLANNED`, entryCount **21**, digest `d32c6d4b…8b702`,
revision 0 → 1, write set **23 = 21 + 1 header + 1 audit + 0 barber projection**, `predictedPublish`
null, `declaredGaps` `[]`, no issues, genesis pre-state, and **exactly the three expected warnings**.

Fresh server fingerprint **`c0bfbcb39b8a9bef4ecc4f71950192e6f27b355a913c5f639e6951db1e02d74c`**.

> **Not a reuse of §20's value.** It was generated by *this* dry run inside the *new* artifact, and
> independently recomputed here from the live barber document. It equals §20's value because the
> subject's rota-relevant fields genuinely have not changed — which is exactly what a fingerprint is
> for. **The identity is the drift proof, not a shortcut.**

Pre-Apply drift recheck, 17/17 fields: **CLEAN**.

**Apply gate progression, observed in order** — proof it opened only on the exact phrase:
`NO_SUCCESSFUL_DRY_RUN` → (dry run) → `CONFIRMATION_MISMATCH` → (typed
`whitecross/barber-1777655430086/d32c6d4b6226`, 44 chars, character-exact) → *"All other apply
preconditions are currently satisfied."*

### 21.4 · The Apply — one request, and what it wrote

**Exactly one** Apply POST. No retry, no refresh, no second click.

**Header `tenants/whitecross/staffRota/barber-1777655430086`**, created `2026-08-25T00:13:42.272Z`:

| Field | Value |
|---|---|
| `revision` | **1** |
| `entryCount` | **21** |
| `lastChangeId` | `rota-seed-d32c6d4b62260440ac399c307c1031cf` |
| `lastOrigin` | `ROTA_IMPORT` · `legacyMode` `canonical` · `legacyBlocked` `null` |
| `entriesHash` | `e2099b646239ae7af2fce85c039ffa6e07fef8aea89307183d5715a08d02e46f` |
| `cacheState` | `appliedRevision 1`, `coverage "covered"`, `effectiveDate 2026-08-25`, `activatedAt null` |

The `entriesHash` **equals** the `predictedEntriesHash` the dry run reported — predicted and actual agree.

**The 21 entries**, ids `rota-seed-d32c6d4b62260440ac399c307c1031cf-e1 … -e21`, all `ROTA_OPEN`,
`seq` 0–20, **21 unique ids**, matching §19.7 segment for segment:

| seq | from → to | workingDays |
|---:|---|---|
| 0 | `2026-02-06` → `2026-02-10` | base 6 |
| 1 | `2026-02-11` → `2026-02-11` | **Wednesday** |
| 2 | `2026-02-12` → `2026-03-17` | base 6 |
| 3 | `2026-03-18` → `2026-03-18` | **Wednesday** |
| 4 | `2026-03-19` → `2026-03-27` | base 6 |
| 5 | `2026-03-28` → `2026-03-29` | Mon, Tue, Thu, Fri |
| 6 | `2026-03-30` → `2026-04-16` | base 6 |
| 7 | `2026-04-17` → `2026-04-17` | Mon, Tue, Thu, Sat, Sun |
| 8 | `2026-04-18` → `2026-06-29` | base 6 |
| 9 | `2026-06-30` → `2026-06-30` | Mon, Thu, Fri, Sat, Sun |
| 10 | `2026-07-01` → `2026-07-01` | base 6 |
| 11 | `2026-07-02` → `2026-07-02` | Mon, Tue, Fri, Sat, Sun |
| 12 | `2026-07-03` → `2026-07-15` | base 6 |
| 13 | `2026-07-16` → `2026-07-16` | Mon, Tue, Fri, Sat, Sun |
| 14 | `2026-07-17` → `2026-07-18` | base 6 |
| 15 | `2026-07-19` → `2026-07-19` | Mon, Tue, Thu, Fri, Sat |
| 16 | `2026-07-20` → `2026-07-24` | base 6 |
| 17 | `2026-07-25` → `2026-07-26` | Mon, Tue, Thu, Fri |
| 18 | `2026-07-27` → `2026-08-02` | base 6 |
| 19 | `2026-08-03` → `2026-08-03` | Tue, Thu, Fri, Sat, Sun |
| 20 | `2026-08-04` → **`null`** | base 6, `hours {09:00, 19:00}` |

*base 6* = Mon, Tue, Thu, Fri, Sat, Sun. **Every entry carries `dayHours: null`**; only entry 21
carries `hours` — exactly as the manifest declares.

**Chain integrity via the canonical fold** (`foldRotaEntries` over the live entries): `ok: true`,
`revision 1`, `entriesHash e2099b64…e46f` (matches the header), **`issues: []`**, **21 periods**,
21/21 unique ids. Spot-checks through `rotaVerdictForDate`:

| Date | Weekday | Verdict |
|---|---|---|
| `2026-02-11` | Wednesday | covered, **works** ✅ |
| `2026-03-18` | Wednesday | covered, **works** ✅ |
| `2026-04-29` | Wednesday | covered, **not worked** ✅ |
| `2026-05-15` | Friday | covered, **works** ✅ |
| `2026-03-28` | Saturday | covered, **not worked** ✅ |
| `2026-08-04` | Tuesday | covered, **works** ✅ |

**Audit — exactly one**, `tenants/whitecross/auditLogs/rota-seed-barber-1777655430086-9ca43d62e806d1c1`
(the manifest's predicted id), created `2026-08-25T00:13:42.272Z`:

```
action  ROTA_SEED_IMPORT              source rota-seed-import
actor   CsktIKNC0wRaP2eK8DECVMWPD0m1  role super-admin   ← the real owner, no synthetic actor
target  staffRota / barber-1777655430086
changeId rota-seed-d32c6d4b62260440ac399c307c1031cf   revision 1   entryCount 21
seedPlanDigest d32c6d4b…8b702        sourceRotaFingerprint c0bfbcb3…d74c
seedFrom 2026-02-06                  seedFinalFrom 2026-08-04     declaredGaps []
convergenceReason AS_OF_ADVANCED     gateDecision ALLOW   gateMode canonical
legacyFieldsPublished FALSE          overlappingShiftChangeKeys [the 7, recorded not touched]
```

Tenant-wide there are now **exactly two** `rota-seed-*` audits: Alex's (2026-08-20) and Arda's
(2026-08-25). No bootstrap, rollout or Finance audit was created.

### 21.5 · Before/after matrix — everything else untouched

| Field | | |
|---|---|---|
| barber `docHash` `716eccd2…f40f0cb8` | **unchanged** ✅ | |
| barber `updateTime` `2026-08-14T23:04:30.613Z` | **unchanged** ✅ | the seed wrote **no** barber projection |
| `status` `passive` / `active` `false` | unchanged ✅ | |
| `workingDays`, `hours`, `availabilityFrom` | unchanged ✅ | |
| **`dayHours` full hash `ebaa6576…eae501`** | **unchanged** ✅ | 7 keys |
| **`dayHours.Wednesday`** `{open 09:00, close 19:00, closed false, source staff}` | **UNTOUCHED** ✅ | §19.8 held in production |
| `shiftChanges` full hash `9258ac39…aab435`, 7 keys | unchanged ✅ | not removed, not migrated |
| `staffComp` `b44afdef…5269ae`, `2026-08-12T22:13:50.923Z` | unchanged ✅ | |
| `rotaPolicy/rollout` | **still absent** ✅ | no rollout flip |
| barberId-keyed audits | **13**, unchanged ✅ | the seed audit is keyed by `target.docId` — a separate document |
| Arda booking records | 667, unchanged ✅ | |
| **Finance modes** | `ROTA_HISTORY=legacy` · `COMP_PERIOD=periods` · `COMP_AMOUNT=legacy` · `FIXED_COST=legacy` — **unchanged** ✅ | |
| Changed, as authorized | `staffRota` absent → **present** · `rotaEntries` 0 → **21** | |

**Request proof:** exactly **1** dry-run POST and exactly **1** Apply POST to
`europe-west2-havuz-44f70.cloudfunctions.net/salownRotaSeedTenantHistory`, both `200`. Zero retries,
zero direct Firestore/Admin writes, zero Schedule Hub saves.

**No wage total moved, and none should have.** `FINANCE_ROTA_HISTORY_MODE` is still `legacy`, so no
Finance module reads the log. The seed makes Arda's history *sayable*; it does not make Finance
*read* it. The −£100 / combined −£1,200 of §19.9 remains a **projection**, not a booked change.

### 21.6 · ⚠️ The operator reported failure on a successful apply — a real defect

The UI displayed:

```
The apply response did not validate: FINGERPRINT_MISMATCH: c0bfbcb3…d74c
Verification required. This page is now finished and will not send again.
```

**The apply had already succeeded.** Cause: `4f8a295` taught **`validateDryRunResponse`** the
two-mode pinned/fresh fingerprint rule, but **`validateApplyResponse` still applies the old
unconditional equality** `s.sourceRotaFingerprint !== e.sourceRotaFingerprint`. For Arda,
`expected.sourceRotaFingerprint` is deliberately `undefined`, so a correct server response fails
validation — the *same* bug §20.1 found on the dry-run side, surviving on the apply side.

A **reporting** defect, not a write defect. The page's fail-closed design worked exactly as intended
around it: it refused to claim success, locked itself against re-sending, and directed the operator
to read-only verification — which is how this was resolved without a second Apply.

**To fix separately:** teach the apply-side validator the same fresh mode, with a mutation-proof
test, and exercise the seeded-state path (`ALREADY_SEEDED` / `HEADER_EXISTS`) against it.

### 21.7 · Open items and rollback

> ⚠️ **The live `salown-admin` artifact is still APPLY-ENABLED** (`b208d564c11edc34`). The *source* is
> restored to `false`, but the deployed bundle is not. Blast radius today is nil — both reviewed
> manifests are now seeded, so a further apply is refused at the header check — but this is a posture
> regression that should be closed by redeploying the disabled build. **Not done here: redeploying is
> not authorized by this task.**

**Hosting rollback:** `7c41a5f53da72474` (the apply-disabled artifact) — Console → Hosting →
`salown-admin` → Release history → ⋮ → Roll back. A fresh disabled build is preferable to a rollback,
since it also carries the §21.2 UI improvements.

**Data rollback — from the runbook, NOT executed and NOT authorized.** There is none in the ordinary
sense: the rota log is **append-only**; `rotaSeedImport.ts` has no update path and no delete path, and
`ROTA_SUPERSEDE` carries no pattern and no dates (§4), so it can retract an entry's authority but
cannot restore the pre-seed state. Undoing this would require deleting
`staffRota/barber-1777655430086`, its 21 `rotaEntries` and the audit document by privileged Admin-SDK
write — outside every sanctioned writer, and destroying the audit trail. **It must not be attempted
without its own explicit authorization**, and it is not needed: the log is inert while
`FINANCE_ROTA_HISTORY_MODE` stays `legacy`.

### 21.8 · State, and the next separately authorized step

Arda is **seeded but not published and not projected**: the canonical log states his history,
`legacyFieldsPublished` is `false`, the barber document is untouched, and no Finance consumer reads
the log.

Next, separately authorized: **Finance / read-side rollout evaluation** (`FIN-ROTA-HISTORY-READ`).
Whitecross now has two of three accruing subjects seeded (Alex, Arda); **Muhamed is not**, so
flipping `FINANCE_ROTA_HISTORY_MODE` to `dated` today would half-migrate the tenant, which
`financeRotaHistoryCutover.ts` explicitly forbids. That precondition, plus `ROTA-BOOTSTRAP-APPLY`
settling every remaining subject, gates the flip. Also open: the apply-side validator fix (§21.6) and
the apply-disabled redeploy (§21.7).

> ✅ **Both §21 open items are now CLOSED by §22** (2026-08-25): the validator parity defect is fixed
> (`fc6259e`) and the live operator is back to apply-disabled (`39b47e0206fd73f3`).

---

## 22 · Safe posture restored — the corrected apply-DISABLED operator, 2026-08-25

> ### Result
> ```
> hosting:salown-admin b208d564c11edc34 → 39b47e0206fd73f3 · apply DISABLED · validator parity FIXED
> ZERO callable invocations · ZERO production-data mutation
> ```
> Hosting-only deployment. The seed operator was **not used to perform any action**: no dry run, no
> apply, no callable of any kind. Arda's applied seed is byte-for-byte as §21 left it.

**Anchors.** `salownadmin` `7af5090` → **`fc6259e`** (`VALIDATOR_FIX_COMMIT`) ·
`salown-app` `a1d863e` → **`457b25f`** (`COORDINATION_COMMIT`) · `salown-docs` `27e1a5c`.
All clean, no claims.

### 22.1 · The validator parity fix

`fc6259e` closes §21.6 at its root cause rather than at its symptom. The fingerprint rule is no
longer implemented twice — one canonical helper is now used by **both** validators:

```js
function G3(expected, server, bound) {           // compiled form, from the served bytes
  return typeof expected === 'string'
    ? (server === expected ? null : {code:'FINGERPRINT_MISMATCH', …})   // PINNED  (Alex)
    : isSha256(server)                                                  // FRESH   (Arda)
        ? (bound != null && server !== bound ? {code:'FINGERPRINT_MISMATCH', …} : null)
        : {code:'FINGERPRINT_MALFORMED', …};
}
```

The apply side additionally **binds** the value to `readiness.serverFingerprint` — the fresh value
the handshake actually produced — so a different well-formed fingerprint is still refused. The dry
run passes no bound, because it *produces* the fingerprint. Neither path ever writes it back.

Proven locally against **the exact §21 apply response that was wrongly rejected**:

| Case | Verdict |
|---|---|
| the real §21 response (`c0bfbcb3…d74c`) | **validates ✅** — the false failure is gone |
| a different well-formed fingerprint | refused — `FINGERPRINT_MISMATCH` ✅ |
| a malformed value (`zz`) | refused — `FINGERPRINT_MALFORMED` ✅ |
| Alex, pinned, wrong value | refused — `FINGERPRINT_MISMATCH` ✅ (unchanged) |

Also corrected: the operator's failed-verdict copy now states the outcome is **AMBIGUOUS** and
directs to read-only verification, rather than implying nothing was written — the §21.6 lesson,
written into the product.

Gates at `fc6259e`, apply-disabled: **157/157** `node --test`, eslint clean on the 3 changed files,
`vite build` ok, `git diff --check` clean. **`rotaSeedManifests.js` is not in the diff** — Arda's
manifest remains byte-identical to `c1c2b14`, and the local manifest assertion suite passes 23/23.

### 22.2 · The deployment — one target, flag never flipped

| | |
|---|---|
| Command | `bash deploy.sh` (typed `salown-admin`) → `npm run build` + `npx firebase-tools deploy --only hosting --project havuz-44f70` |
| CLI | **15.15.0** |
| Flag | `ROTA_SEED_APPLY_ENABLED = false` **before, during and after** the internal build — no flip, no temporary edit, tree `dirty=0` throughout |
| Output | 5 files found, **3 uploaded** |
| `salown-admin` | `b208d564c11edc34` → **`39b47e0206fd73f3`**, release `1787618993820000`, `2026-08-25T00:49:46.874Z` |

`firebase.json` declares one hosting entry (`site: salown-admin`), **no predeploy hooks**, and no
`functions`/`rules`/`indexes`/`storage` keys. `dist/` is untracked. **Every other target unchanged:**
`salown` `c0d31a9fac873c69`, `salown-staff` `c0606fdcb48f5207`, `whitecrossbarbers-saas`
`d7d72c6755a35044`, callable **`salownrotaseedtenanthistory-00002-dun`** (unmoved,
`2026-08-21T21:13:59Z`).

### 22.3 · Served-byte proof

```
/assets/index-C7Ie3K1l.js   HTTP/2 200   1 087 346 B
served sha256 08ffb6118f4d040a01b7edb18597e2384c96accad6257ab70ab13362889313a1
local  sha256 08ffb6118f4d040a01b7edb18597e2384c96accad6257ab70ab13362889313a1   MATCH
```

**The compiled kill switch, before and after — the core assertion of this task:**

| Build | `buildApplyPayload` gate default |
|---|---|
| previous (`index-DvympQm7.js`, apply-enabled) | **`!0`** ⚠️ |
| **now** (`index-C7Ie3K1l.js`) | **`!1`** ✅ **DISABLED** |

| Assertion | |
|---|---|
| Arda + Alex manifest ids | ✅ both present (evidence only) |
| Arda full digest `d32c6d4b…8b702`, full integrity `3402ac05…e6260` | ✅ |
| `FINGERPRINT_MALFORMED` + `FINGERPRINT_MISMATCH` + `fingerprintPolicy` | ✅ both policies present |
| shared parity helper `G3(expected, server, bound)` | ✅ present |
| `Integrity SHA-256` and `Declared gaps` rows | ✅ |
| `APPLY_DISABLED_IN_THIS_BUILD` + *"is false in this artifact"* | ✅ |
| the §20/§21 fresh fingerprint pinned as a constant | ✅ **absent** |

### 22.4 · Read-only browser smoke

Single connected browser (Browser 1, macOS, local). Operator opened read-only as
`aerulas@gmail.com`. **Nothing was invoked:** the network capture for the tab shows **zero**
`cloudfunctions` requests. Dry run was not clicked, no confirmation typed, Apply not clicked.

The page renders **"Apply seed — DISABLED IN THIS BUILD"** with the full explanation
(*"…no apply payload can even be constructed…"*) — the safe posture, confirmed in the live UI.

Alex (the default selection) renders **`Integrity SHA-256`** and **`Declared gaps: none — [] (contiguous plan)`**
correctly.

> ⚠️ **Stated honestly:** the manifest dropdown would not commit a change to Arda in this session.
> macOS renders a native `<select>` popup as an OS-level menu that page-level synthetic input cannot
> reach, and after several attempts it stayed on Alex. I stopped rather than keep poking near
> controls I must not touch. **Arda's rows are nevertheless proven** three ways: the row values are
> rendered generically off the *selected manifest object* (`v: C.integritySha256`, `v: J3(C)` — one
> code path, no per-manifest branch), Alex demonstrates that path working live, and Arda's integrity
> and `declaredGaps` are present in the served bytes. Arda's rows were also confirmed live in §21.2
> on the previous build with identical rendering code. This is a tooling limitation of the smoke,
> not an unverified claim.

### 22.5 · Production non-mutation — nothing moved

Re-read after deployment and compared field by field against the §21 post-apply state.

**Arda's seed — 16/16 identical:** header `exists`, `createTime` and `updateTime`
`2026-08-25T00:13:42.272Z`, `revision 1`, `entryCount 21`, `lastChangeId`, `entriesHash e2099b64…e46f`,
`legacyBlocked null` (**published false**), 21 entries with an identical id-set **and identical
payload hash**, the single seed audit with identical `createTime` and identical content hash, still
exactly **two** `rota-seed-*` audits tenant-wide, and an unchanged tenant `auditLogs` total of 3061.

**Subject and configuration — 13/13 identical:** barber `docHash 716eccd2…f40f0cb8` and `updateTime
2026-08-14T23:04:30.613Z`, `passive`/`false`, `workingDays`, `hours`, **`dayHours` full hash
`ebaa6576…eae501` including `Wednesday`**, `shiftChanges` full hash `9258ac39…aab435`, `staffComp`
`b44afdef…5269ae`, `rotaPolicy/rollout` **still absent**, 13 barberId-keyed audits, 667 Arda records.

**Finance modes unchanged:** `ROTA_HISTORY=legacy` · `COMP_PERIOD=periods` · `COMP_AMOUNT=legacy` ·
`FIXED_COST=legacy`.

**Request proof: ZERO callable invocations.** No dry-run POST, no Apply POST, no seed/bootstrap/
rollout/Finance audit created, no direct Firestore write, no Schedule Hub save. The only production
change made by this task is one hosting release.

### 22.6 · Rollback and state

**Hosting rollback: `b208d564c11edc34`** — but note what that version *is*: the **apply-enabled**
artifact. Rolling back to it would re-open the apply path, so it is the wrong remedy for almost any
problem with this release. The correct fallback for a defect in `fc6259e` is a forward deploy of a
corrected disabled build. The earlier safe version `7c41a5f53da72474` is also apply-disabled but
lacks both the §21.2 UI rows and this validator fix.

**Arda remains seeded, not published, not projected.** The canonical log states his history;
`legacyFieldsPublished` is false; the barber document is untouched; no Finance consumer reads the
log. Nothing about the applied seed was altered by this task.

### 22.7 · Next, separately authorized

**Finance / read-side rollout evaluation** (`FIN-ROTA-HISTORY-READ`) — unchanged from §21.8 and
**not started here**. Whitecross has two of three accruing subjects seeded; **Muhamed is not**, so
flipping `FINANCE_ROTA_HISTORY_MODE` to `dated` would half-migrate the tenant, which
`financeRotaHistoryCutover.ts` forbids. That, plus `ROTA-BOOTSTRAP-APPLY` settling every remaining
subject, gates the flip.

---

## 23 · Muhamed — read-only evidence audit, 2026-08-25

> ### State
> ```
> EVIDENCE_CAPTURED · PLAN VALIDATES · TWO MONEY DECISIONS NEED AN OWNER RULING
> MANIFEST NOT CREATED · NOT DRY-RUN · NOT APPLIED · ZERO PRODUCTION MUTATION
> ```
> Read-only audit only. No manifest, no dry run, no apply, no deploy, no Finance-mode change,
> no browser action, no production write of any kind.

**Anchors.** `salown-app` **`457b25f`** · `salownadmin` **`fc6259e`** · `salown-docs` `60c6f83`
(this section is the next commit). All `main`, all clean, **no claims**. Project `havuz-44f70`,
hosting `salown-admin` `39b47e0206fd73f3` (apply-disabled), callable
`salownrotaseedtenanthistory-00002-dun`. Finance modes `legacy` / `periods` / `legacy` / `legacy`.

### 23.1 · Muhamed is not Arda — the contract differences that matter

| | Arda (§19) | **Muhamed** |
|---|---|---|
| lifecycle | `passive`, `active:false` | **`active`, `active:true`** |
| comp period | closed, `effectiveTo 2026-08-04` | **OPEN, `effectiveTo: null`** |
| wage authority (live `COMP_AMOUNT=legacy`) | `partnerConfig` £100/day | **`partnerConfig` £41.60/day** |
| stored comp | £600/week | **£250/week** |
| day off | Wednesday | **Monday** |
| history | complete and bounded | **still being written** |

**£1,414.40 is not a rate — it is `34 × £41.60`, a window-bounded total.** The day rate comes from
`partnerConfig.Muhamed.wage = 41.6` because `FINANCE_COMP_AMOUNT_MODE` is `legacy`. The dated
alternative — `staffComp` £250/week ÷ 6 contracted days = £41.666… — is **not live** and is the
known 7-hundredths-of-a-penny discrepancy `financeCompAmount.ts` deliberately refuses to settle in
source. **Arda's £100/day assumptions were not used anywhere in this audit.**

### 23.2 · Baseline (field-masked, read-only)

`barbers/barber-1781007454543` — `createTime 2026-06-09T12:18:10.766Z`,
`updateTime 2026-08-23T14:55:07.730Z`, hash `fbd512ada9fbec00…5fee3eb`:

| Field | Value |
|---|---|
| `status` / `active` | `active` / `true` |
| `availabilityFrom` | **`2026-06-09`** |
| `workingDays` | Tue, Wed, Thu, Fri, Sat, Sun — **Monday off** |
| `hours` | `{09:00, 19:00}` |
| `dayHours` | 6 keys Tue–Sun. **`Monday` ABSENT** ✅ — the sanctioned Schedule Hub normalization removed the stray row and nothing has re-added it |
| weekly hours | Tue–Sat 10h × 5 + Sun 6h = **56 h/week** ✅ as accepted |
| `shiftChanges` | **THREE keys, not one** — see below |
| `leaves` | `[{from: 2026-07-14, until: 2026-08-17}]` ✅ ; `leaveFrom`/`leaveUntil` null |
| `sourceRotaFingerprint` (local, evidence only) | `0ab34f9d911f7e65ffea0e45494e44f1d701d03b7d72b4895df9c94e39cb71d6` |

> ⚠️ **Lead corrected.** The brief named one dated override (`2026-07-13`). Production carries
> **three** `shiftChanges` keys: `2026-07-13 {open 09:00, close 19:00}`,
> `2026-08-24 {open 09:00, close 19:00}` and `2026-08-25 {closed: true}`. The second is a **genuinely
> worked Monday**; the third is a closure on **today**, and §23.6 shows it is load-bearing.

`staffComp/barber-1781007454543` — `createTime 2026-07-15T14:49:12.677Z`,
`updateTime 2026-08-12T22:13:50.730Z`, hash `68e24a5059b090cf…148c667d`: **one** `wage` period,
`{amount: 250, period: 'week'}`, `effectiveFrom 2026-06-09`, **`effectiveTo: null`**.

**Genesis — clean.** `staffRota/barber-1781007454543` **absent**, `rotaEntries` **0**,
`rotaPolicy/rollout` **absent**, and tenant-wide the only `rota-seed-*` audits are Alex's and Arda's
— **none for Muhamed**. 11 barberId-keyed audits, id-set hash `…` unchanged across the audit.

### 23.3 · Query shapes and identity resolution

Reads only — `.get()` / `.select()` / `getAll()` with explicit field masks; the capture script
contains no Firestore write vocabulary (sole lexical match: `crypto.createHash().update()`). The
historical range was **derived, not assumed**: the booking scan ran unbounded (`FROM = 2000-01-01`).

Identity resolved through the canonical Finance boundary rule
(`scripts/wageDriftAudit.cjs:1157-1161`): `normalizeName(barberName || nameById[barberId] || barberId)`
→ nameKey **`muhamed`**.

| | |
|---|---|
| candidate records resolving to `muhamed` | **86** |
| matched by barber **document id** | 26 |
| matched by `barberName` | 60 |
| recovered via **legacy `barberId`** | **0** |
| `barber`-field residue | none |
| duplicate hashes | 0 |

Unlike Arda (79 records recoverable only through the legacy fallback), Muhamed's records never need
it — he joined after the document-id convention. The fallback was still applied, and its zero count
is itself evidence.

### 23.4 · Classification — no exclusions, no ambiguity

| Class | Count |
|---|---|
| qualifying `CHECKED_OUT` | **85** |
| qualifying `UNPAID` | **1** |
| born-block | **0** |
| standalone product sale | **0** |
| cancelled / no-show / pending | **0** |
| **ambiguous** | **0** |

Source histogram: `Walk-in 80 · Website 4 · Treatwell 1 · salOWN 1`. Every record has a resolvable
Europe/London date key (timezone from `settings/settings.presentation` via the TR-A precedence).
**No record is excluded, so no exclusion can change a worked-date decision.**

### 23.5 · Attendance reconstruction

**37 worked dates**, `2026-06-09` → `2026-08-24`. The first qualifying date equals both
`availabilityFrom` and the barber document's `createTime` day — the range is corroborated three ways,
not assumed.

| Weekday | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---:|---:|---:|---:|---:|---:|---:|
| worked | **2** | 5 | 6 | 6 | 6 | 6 | 6 |

Months: `2026-06` 18 · `2026-07` 12 · `2026-08` 7.

**Verifications the brief asked for:**

| Question | Answer |
|---|---|
| `2026-07-13` | **worked** — a Monday (outside the base pattern), 2 qualifying records, `shiftChanges` override present ✅ |
| leave `2026-07-14` → `2026-08-17` | **zero** qualifying records inside it — leave is clean, no attendance conflict |
| records after leave end | 7 consecutive days `2026-08-18` → `2026-08-24` |
| any Monday genuinely worked | **two**: `2026-07-13` and **`2026-08-24`** — both carry a dated override |
| first / last qualifying | `2026-06-09` / `2026-08-24` |
| did the weekly normalization change a historical fact | **No.** It removed only `dayHours.Monday`; `workingDays` never contained Monday, so no worked date, no wage day and no weekday histogram entry moves. Both worked Mondays are established by **bookings + dated overrides**, not by the weekly field |

**Scheduled dates with zero qualifying attendance: 31.** Thirty fall inside the approved leave.
**Exactly one does not — `2026-06-23` (Tuesday).**

> **`2026-06-23` disambiguated rather than assumed.** The shop was **open** that day: Arda has 4
> bookings. Muhamed has zero. So it is a personal absence, not a closure. Under the owner ruling
> *"do not invent attendance merely from a weekly working-day field"*, `2026-06-23` is **not worked**
> — and legacy Finance pays it today purely because `workingDays` contains Tuesday.

### 23.6 · The candidate plan — four shapes through the real planner

Derived with the canonical `canonicalizeSeedPlan` / `buildSeedEntries` / `computeCacheConvergence` /
`rotaLegacyWriteGate` from `salown-app@457b25f`. **All four validate with `issues: []`,
`fold.ok true`, and `predictedPublish: null`** — none would write the barber document.

| Candidate | Segments | Digest | Publish |
|---|---:|---|---|
| **A — attendance-faithful, final omits `dayHours`** | **7** | `012ad0cd…c10fce3e` | `null` |
| B — pattern-faithful (no `2026-06-23` exception) | 5 | `397f9c6c…dbda5cdf` | `null` |
| C — attendance-faithful, final carries `dayHours` | 7 | `cff02c55…454381e4` | `null` |
| D — attendance-faithful, final bare (no `hours`) | 7 | `78d3cee4…2bdf2216` | `null` |

**C does not fail as Arda's equivalent did**, and the reason is instructive: Muhamed's `dayHours`
keys are a **subset** of his `workingDays` (no stray Monday), so `DAY_HOURS_NOT_IN_PATTERN` never
fires and the values already equal the live projection. It is still **not** preferred — it would
state historical daily hours no owner has ruled on. **A is the recommended shape**: it omits
`dayHours` (so `dayHours.Monday` can never be reintroduced and no barber write occurs) and carries
only the live `hours` summary on the final segment.

**Plan A — the ordered 7 segments** (base = Tue, Wed, Thu, Fri, Sat, Sun):

| # | from → to | workingDays | Kind |
|---:|---|---|---|
| 1 | `2026-06-09` → `2026-06-22` | base 6 | base |
| 2 | `2026-06-23` → `2026-06-23` | Wed, Thu, Fri, Sat, Sun | **off exception** — no booking, shop open |
| 3 | `2026-06-24` → `2026-07-12` | base 6 | base |
| 4 | `2026-07-13` → `2026-07-13` | **Monday** | **worked exception** |
| 5 | `2026-07-14` → `2026-08-23` | base 6 | base (spans the leave — see below) |
| 6 | `2026-08-24` → `2026-08-24` | **Monday** | **worked exception** |
| 7 | `2026-08-25` → **`null`** | base 6, `hours {09:00, 19:00}` | **final, open-ended** |

`entryCount` **7** · `declaredGaps` **`[]`** · `coversTodayFrom 2026-08-25` · fold `ok, revision 1,
7 periods, issues []` · `entriesHash dc845d5738e07ce8…286d350e` ·
`changeId rota-seed-012ad0cdbe1cadba01fbff1d6bf5b09b` ·
`auditId rota-seed-barber-1781007454543-69bb55eaf800af0d` · predicted write set **9** = 7 entries +
1 header + 1 audit + 0 barber projection. Deterministic entry ids `…-e1` … `…-e7`.
Overlapping `shiftChanges`: all three keys, **reported not touched**.

> **The leave interval is deliberately NOT encoded as rota segments.** Two reasons, both from source:
> a weekly segment with no working days is refused (`SEGMENT_WEEKLY_NO_WORKING_DAYS`), and a
> `by_exception` terminal is legal only as the FINAL segment. More importantly it is unnecessary —
> leave is a **separate authority**: `accruesWageOnDay` suppresses accrual via `isOnLeave` unless an
> explicit override exists, identically in both modes. Encoding it would duplicate a rule that
> already works and would make the log say something about availability it does not own.

**`sourceRotaFingerprint` `0ab34f9d…39cb71d6` is EVIDENCE ONLY.** It is not installed anywhere and
must be generated fresh by a sanctioned readiness/dry run. Its inputs are exactly
`workingDays`, `dayHours`, `hours`, `availabilityFrom` and `status` — so any Schedule Hub save that
touches those five voids it.

### 23.7 · Finance — the £1,414.40 reproduces, and then two dates move

Computed with the shipped pure readers, **without changing any production configuration**
(`rotaMode` passed per call).

**Reconciliation of the earlier figure — it reproduces exactly.** In the accepted historical window
`2026-02-06 → 2026-08-20`, Muhamed **legacy = 34 days = £1,414.40** ✅, and the previously reported
**delta £0** was correct *for the unseeded state*: with no log, `rotaDayResolver` returns `null` and
dated falls back to legacy on every date. **£0 was the absence of a log, not a property of Muhamed.**

Introducing candidate plan A changes that:

| Window | Muhamed legacy | Muhamed dated (plan A) | Δ |
|---|---|---|---|
| `2026-02-06 → 2026-08-20` (accepted historical) | 34 d · **£1,414.40** | 33 d · £1,372.80 | **−£41.60** |
| `2026-02-06 → 2026-08-25` (as-of today) | 38 d · £1,580.80 | 38 d · £1,580.80 | **£0.00** |

> ⚠️ **That £0 is a coincidence, not agreement.** It is two offsetting £41.60 moves:
> `2026-06-23` **removed** and `2026-08-25` **added**. A net-zero delta that hides two changed dates
> is exactly the kind of figure that gets mistaken for "no change".

**Whitecross combined, both windows** (Alex and Arda from their live seeded logs):

| Window | Subject | legacy | dated | Δ |
|---|---|---:|---:|---:|
| **`→ 2026-08-20`** | Alex | £19,100.00 | £18,000.00 | −£1,100.00 |
| | Arda | £14,800.00 | £14,700.00 | −£100.00 |
| | Muhamed (plan A) | £1,414.40 | £1,372.80 | −£41.60 |
| | **combined** | **£35,314.40** | **£34,072.80** | **−£1,241.60** |
| **`→ 2026-08-25`** | Alex | £19,600.00 | £18,500.00 | −£1,100.00 |
| | Arda | £14,800.00 | £14,700.00 | −£100.00 |
| | Muhamed (plan A) | £1,580.80 | £1,580.80 | £0.00 |
| | **combined** | **£35,980.80** | **£34,780.80** | **−£1,200.00** |

Alex −£1,100 and Arda −£100 reproduce §19/§21 exactly. The historical-window combined figure differs
from §19's accepted **−£1,200** by precisely **−£41.60** — Muhamed's `2026-06-23`, and nothing else.

### 23.8 · ⚠️ The structural finding — a seeded log outranks a *future* closure

Proven at the resolver, not inferred:

| Date | `shiftChanges` | legacy | dated (plan A) | |
|---|---|---|---|---|
| `2026-06-23` Tue | — | pays | **does not pay** | diverges |
| `2026-08-24` Mon | `{open, close}` | pays | pays | agrees |
| **`2026-08-25` Tue (today)** | **`{closed: true}`** | **does not pay** | **pays** | **diverges** |

Cause, from `financeWages.accruesWageOnDay`: in `dated` mode, when the log can speak for a day,
`const sc = answer ? undefined : barber?.shiftChanges?.[dk]` — **the map is not read at all**. A seed
must contain an open-ended final segment covering today, that segment states a weekly pattern, today
is a base weekday, so the log says "works" and today's `{closed: true}` becomes invisible.

**This is not a defect in the plan; it is the ROTA-SSOT-2 gap made concrete.** A seed cannot express
a closure on today or any future date, and the log outranks the map for every day it covers. Arda
never surfaced it (passive, comp closed, so post-boundary dates accrue nothing either way). Muhamed
surfaces it because he is **active with an open comp period and a closure on the day of seeding**.

Practical consequence: **the correctness of a Muhamed seed depends on the day it is applied.** Applied
today it would create a wage day the owner explicitly closed.

### 23.9 · Cutover-readiness matrix

| Check | State |
|---|---|
| Alex header + entries valid | ✅ 26 entries, fold `ok`, revision 2, 25 periods, `issues []` |
| Arda header + entries valid | ✅ 21 entries, fold `ok`, revision 1, 21 periods, `issues []` |
| Muhamed header / entries | ❌ **absent / 0** — at genesis |
| Candidate Muhamed plan valid | ✅ 4 shapes, all `issues: []`, all `predictedPublish: null` |
| All accruing subjects covered | ❌ **2 of 3** |
| No subject partially migrated | ❌ Muhamed unseeded ⇒ a `dated` flip half-migrates the tenant |
| Finance legacy↔dated parity understood | ✅ every moved date enumerated and explained |
| Compensation periods covered | ✅ all three subjects have a usable `staffComp` period |
| `rotaPolicy/rollout` | **absent** — tenant is LEGACY |
| Cutover preconditions (`financeRotaHistoryCutover.ts`) | ❌ requires **every** accruing subject seeded **and** `ROTA-BOOTSTRAP-APPLY` settling the rest |

**Verdict: NOT READY** — and source, not convention, is why. `financeRotaHistoryCutover.ts` states a
half-seeded tenant "is not wrong — it is half-migrated, which is worse to reason about than either
end." Muhamed's individual delta being £0 in the current window is **not** an argument for the flip;
§23.7 shows that £0 is two offsetting changes.

### 23.10 · ⛔ Two money decisions require an owner ruling

Both are determinate in *evidence* and open in *policy*. Neither is mine to settle.

**Ruling 1 — `2026-06-23`, −£41.60.** The evidence is unambiguous: shop open, colleague working,
Muhamed zero bookings. Applying the stated attendance ruling makes it not-worked, which **removes a
wage day the owner has been paying**. Arda's equivalent dates were ruled on individually and
explicitly; Muhamed has no such ruling. *Does a scheduled day with no booking become unpaid for
Muhamed, as it did for Arda?*

**Ruling 2 — seeding while a same-day closure exists, +£41.60.** Per §23.8 a seed applied today makes
`2026-08-25` payable in dated mode despite `{closed: true}`. Options: apply on a day with no closure
on it; accept the divergence and record it; or defer Muhamed until ROTA-SSOT-2 closes the
`shiftChanges`-vs-log precedence. *Which?*

### 23.11 · Production non-mutation proof

Full baseline re-read after the audit — **21/21 fields identical**: barber `docHash`, `createTime`,
`updateTime 2026-08-23T14:55:07.730Z`, `status`/`active`, `workingDays`, `hours`, `dayHours` full
hash, **`dayHours.Monday` still ABSENT**, `shiftChanges` full hash, `leaves`, `availabilityFrom`,
fingerprint inputs, `staffComp` hash + `updateTime`, `staffRota` still **absent**, `rotaEntries`
still **0**, `rotaPolicy/rollout` still **absent**, 11 audits with an unchanged id-set, 86 records.

Tenant-wide `bookings` 1617 before and after. **No manifest created, no callable invoked, no dry run,
no apply, no deploy, no browser action, no Finance-mode change.** `salownadmin` and `salown-app` were
read only — neither was edited.

### 23.12 · Next, separately authorized

1. **Obtain the two rulings in §23.10.** Nothing downstream is safe to fix without them.
2. Then materialize `MUHAMED_WHITECROSS_MANIFEST` in `salownadmin` from the ruled shape (A or B),
   with tests and an `integritySha256`, **no pinned `sourceRotaFingerprint`** — code + tests only,
   not dry-run, not applied.
3. Then a single sanctioned dry run, then a single Apply, each separately authorized.
4. Only after all three subjects are seeded does `FIN-ROTA-HISTORY-READ` become evaluable — and it
   still needs `ROTA-BOOTSTRAP-APPLY` and its own authorization.

> ✅ **Steps 1–3a are now done: both rulings were given, the manifest is materialized (`db3e9e6`), and
> the production dry run is VERIFIED — see §24.** The Apply remains unauthorized.

---

## 24 · Muhamed — the authenticated production dry run, 2026-08-25

> ### Result
> ```
> PLANNED · 5 entries · write set 7 · predictedPublish null · ZERO WRITES · APPLY NOT INVOKED
> ```
> Exactly **one** authenticated dry-run invocation as `aerulas@gmail.com`, through the deployed
> **apply-DISABLED** operator. Nothing was written. Apply is compile-time disabled in this artifact
> and was never available.

**Anchors.** `salownadmin` `fc6259e` → **`db3e9e6`** · `salown-app` `457b25f` → **`0f6e118`** ·
`salown-docs` `c6e3152`. All `main`, clean, **no claims**. `ROTA_SEED_APPLY_ENABLED = false`
throughout — never flipped, tree `dirty=0` before, during and after the build.

### 24.1 · The two owner rulings, and the plan they selected

§23.10 stopped on two money questions. Both were ruled, and the manifest is **candidate B** — the
plan I derived as *pattern-faithful* — not candidate A:

| Ruling | Decision | Consequence |
|---|---|---|
| **`2026-06-23`** (scheduled Tuesday, no booking, shop open) | **WORKED and PAYABLE** — no off exception | the −£41.60 removal does **not** happen; his historical pay is untouched |
| **`2026-08-25`** (open final segment vs live `{closed:true}`) | **divergence ACCEPTED**, recorded not blocking | in dated mode that date becomes payable, **+£41.60** (§23.8) |

The operator surfaces both rulings as first-class rows (`Ruling20260623`, `Accepted Divergence`), so
an approver reads the reasoning on the screen rather than trusting a commit message. That choice
drops the plan from **7 segments to 5** and the write set from 9 to **7**.

### 24.2 · Gates and manifest verification

`db3e9e6` touched five files — `rotaSeedManifests.js` plus four test files; **no product source, no
contract change**. Gates at HEAD: `node --test` **180/180**.

**Alex and Arda are byte-preserved**, asserted individually rather than assumed: Alex integrity
`26b81a28…1bb970`, digest `0cdde2f9…966e2`, 24 segments; Arda integrity `3402ac05…e6260`, digest
`d32c6d4b…8b702`, 21 segments. Registry order is Alex, Arda, Muhamed.

**Muhamed manifest — 19/19 field checks PASS:**

| Field | Value |
|---|---|
| id | `muhamed-whitecross-2026-06-09` |
| kind / tenant / barber | `HISTORY` / `whitecross` / `barber-1781007454543` |
| segments · declaredGaps | **5** · `[]` |
| `expected.seedPlanDigest` | `397f9c6cf9eff14c26619e1444f4dedbcc69d3d37daaa08b7eb6c54fdbda5cdf` |
| `integritySha256` | `ad23c4fcaa6268ce81022d077441f2ec82567331240f452ca26926e947f1dd7e` |
| entryCount · writeCount · revision | 5 · **7** · 0 → 1 |
| `predictedPublish` | `null` |
| `expected.sourceRotaFingerprint` | **ABSENT** ✅ |
| final segment | `2026-08-25` → `null`, **omits `dayHours`** |
| segments carrying `dayHours` | **0** |

**Independently recomputed** from the manifest's own segments through the authoritative pure
functions — not taken on trust:

```
computeSeedPlanDigest → 397f9c6c…5cdf                    MATCHES the manifest
deriveSeedChangeId    → rota-seed-397f9c6cf9eff14c26619e1444f4dedb      MATCHES
deriveSeedAuditId     → rota-seed-barber-1781007454543-50e2ebce0a59a128 MATCHES
```

The five segments: `2026-06-09→07-12` base 6 · `07-13` **Monday** · `07-14→08-23` base 6 ·
`08-24` **Monday** · `08-25→null` base 6 with `hours {09:00,19:00}`.

### 24.3 · Deployment — one target, flag never flipped

| | |
|---|---|
| Command | `bash deploy.sh` → `npm run build` + `npx firebase-tools deploy --only hosting --project havuz-44f70` |
| CLI | **15.15.0** · 5 files found, **2 uploaded** |
| `salown-admin` | `39b47e0206fd73f3` → **`5a4af3c69dc5bad4`**, `2026-08-25T15:43:56.105280Z` |

Unchanged: `salown` `c0d31a9fac873c69`, `salown-staff` `c0606fdcb48f5207`, `whitecrossbarbers-saas`
`d7d72c6755a35044`, callable **`salownrotaseedtenanthistory-00002-dun`**.

**Served-byte proof** — `/assets/index-DF-ESqGR.js`, HTTP/2 200, 1,089,526 B,
`sha256 c23601c6eb212a2d…1f98925c`, **identical to the local build**. Present: Muhamed id, barberId,
digest, integrity; Alex and Arda preserved; `APPLY_DISABLED_IN_THIS_BUILD`. **Compiled apply gate
default `!1` — DISABLED.** Absent: Muhamed's evidence-only fingerprint and Arda's §21 fingerprint —
no historical fingerprint is embedded anywhere.

### 24.4 · Operator selection — and an honest note on how it was made

Operator `aerulas@gmail.com` · `CsktIKNC0wRaP2eK8DECVMWPD0m1`. Displayed values all matched §24.2,
including both ruling rows, `Declared gaps none — []`, `Predicted publish null — no barber projection
write`, `Final segment from 2026-08-25`, `Expected writes 7 = 5 entries + 1 header + 1 audit + 0
barber projection`, the confirm phrase re-keyed to `whitecross/barber-1781007454543/397f9c6cf9ef`,
and **Apply seed — DISABLED IN THIS BUILD**.

> ⚠️ **The manifest selection was made by the owner by hand, not by automation.** macOS renders a
> native `<select>` popup as an OS-level menu that synthetic input cannot reach; several approaches
> (click+typeahead, arrow+Enter, option-element click, keyboard focus without opening) all left the
> panel on Alex. **The dry run was NOT invoked while the wrong subject was selected** — doing so
> would have spent the single authorization on Alex, who is already seeded. The workflow paused,
> the owner selected Muhamed, and the panel was re-verified field by field before the click. The
> same limitation is recorded in §22.4; it is a tooling constraint of the automation environment,
> never a reason to proceed unverified.

### 24.5 · The invocation

**Exactly one** request:

```
POST https://europe-west2-havuz-44f70.cloudfunctions.net/salownRotaSeedTenantHistory   200
```

No retry, no second dry run, no apply. The payload is `buildDryRunPayload`, which hardcodes
`dryRun: true` and carries only `tenantId`, `barberId`, `segments`, `declaredGaps`.

**Server verdict — `Dry run verified.`**

| Field | Expected | Actual | |
|---|---|---|---|
| tenant / barber / manifest | `whitecross` / `barber-1781007454543` / `muhamed-whitecross-2026-06-09` | matched | ✅ |
| kind · state | `HISTORY` · `PLANNED` | matched | ✅ |
| entryCount | 5 | **5** | ✅ |
| seedPlanDigest | `397f9c6c…5cdf` | matched | ✅ |
| changeId | `rota-seed-397f9c6cf9eff14c26619e1444f4dedb` | matched | ✅ |
| revision | 0 → 1 | 0 → 1 | ✅ |
| write set | 7 | **`7 = 5 entries + 1 header + 1 audit + 0 barber projection`** | ✅ |
| predictedPublish | `null` | `null` | ✅ |
| declaredGaps · issues | `[]` · `[]` | none reported | ✅ |
| genesis pre-state | `17516577…dcdc2b3` | unseeded, at genesis | ✅ |

**Fresh `sourceRotaFingerprint`, server-generated:**

```
0ab34f9d911f7e65ffea0e45494e44f1d701d03b7d72b4895df9c94e39cb71d6
```

Accepted under the **fresh** policy (`fingerprintPolicy` = `fresh`, since the manifest pins none),
surfaced for audit and **not written back into source or the manifest**. It equals the value §23.2
computed locally from the live document — the server derived it independently from production, so
the agreement is proof the subject has not drifted since the audit, not a reused constant.

`predictedEntriesHash 5cfd3f96c751187988cb54d0d5c9050dde808bf557edea41851409458e9d3287` is
**OUTPUT ONLY** — actor-dependent, never a precondition.

**Two warnings, and two is correct.** The 3 overlapping `shiftChanges` keys, and the legacy cache
publishing nothing. **There is no "subject is passive" warning** — unlike Arda, Muhamed is `active`,
so the core does not emit it. Warning count differing from Arda's three is expected, not a defect.

### 24.6 · Zero-mutation proof

Full baseline re-read after the invocation — **22/22 fields identical**: barber `docHash
fbd512ad…5fee3eb`, `createTime`, `updateTime 2026-08-23T14:55:07.730Z`, `active`/`true`,
`workingDays`, `hours`, `dayHours` full hash `fc3dab9f…e734917c`, **`dayHours.Monday` still ABSENT**,
`shiftChanges` full hash `b9ff930e…f1befdec` with all three keys, `leaves`, `availabilityFrom`,
fingerprint inputs, `staffComp 68e24a50…148c667d`, **`staffRota` still absent**, **`rotaEntries`
still 0**, **`rotaPolicy/rollout` still absent**, 11 audits with an unchanged id-set, 86 records.

Tenant-wide `rota-seed-*` audits remain **exactly two** — Alex's and Arda's. **No Muhamed seed audit
exists.** Finance modes unchanged: `legacy` / `periods` / `legacy` / `legacy`.

### 24.7 · State and the next separately authorized step

Muhamed is **planned and proven, not seeded**. His log is still empty; the tenant remains at two of
three subjects seeded, so `FIN-ROTA-HISTORY-READ` is still **NOT READY**.

**Next: the single production Apply for Muhamed** — which requires, in order, a reviewed
`ROTA_SEED_APPLY_ENABLED = true` flip, a redeploy, a **fresh** dry run inside that apply-enabled
artifact (the fingerprint above is not reusable), the typed confirmation
`whitecross/barber-1781007454543/397f9c6cf9ef`, and its own explicit authorization. The seed is
**append-only and irreversible**, and `salownRotaBootstrapTenant` must never run for this subject.

**Hosting rollback:** `39b47e0206fd73f3` — also apply-disabled, so it is a safe target, though it
lacks the Muhamed manifest.

> ✅ **Applied 2026-08-25 — see §25.** All three Whitecross subjects are now seeded.

---

## 25 · Muhamed — ✅ APPLIED, 2026-08-25

> ### Result
> ```
> SEEDED · revision 0 → 1 · 5 entries · 7 writes · barber document NOT written
> ALL THREE WHITECROSS SUBJECTS NOW SEEDED · Finance modes UNCHANGED
> ```
> One fresh dry run and **one** Apply as `aerulas@gmail.com`. Append-only and irreversible. The live
> operator was returned to **apply-DISABLED** immediately afterwards.

**Anchors.** `salownadmin` **`db3e9e6`** · `salown-app` **`0f6e118`** · `salown-docs` `5f0442c`.
All clean, no claims, no commit of the temporary flip.

### 25.1 · Owner rulings — final, and carried into the log

| Ruling | Effect in the applied log |
|---|---|
| `2026-06-23` **worked and payable** | no off exception — the fold answers **works = true** for that date |
| `2026-08-25` dated divergence **accepted** (+£41.60) | the open final segment covers today; documented, not blocking |

No further ruling was required, and none was invented.

### 25.2 · The apply-enabled window

| Step | Evidence |
|---|---|
| flip | `false` → `true`, **one line, one file**; `git diff --stat` = `1 file changed, 1 insertion(+), 1 deletion(-)`; untracked 0 |
| gates | **172/180**. The 8 failures are *exactly* the kill-switch assertions — `AO-15`, `AP-16`, `APPLY-1`, `ARCH-23`, `OP-9`, `production apply is DISABLED…`, `the kill switch is a source constant…`, `apply is disabled in this build and says so`. Every apply state-machine, manifest and validator test stayed green. Before the flip 180/180; after the revert **180/180** |
| **`AP-16` checked specifically** | it asserts *two* things — flag `false` **and** no historical fingerprint in product source. Verified the second half still holds: `0ab34f9d…` and `c0bfbcb3…` each appear **0** times in `rotaSeedContract.js`, `rotaSeedManifests.js` and `RotaHistorySeed.jsx`. It failed **only** on the flag |
| enabled deploy | `salown-admin` `5a4af3c69dc5bad4` → **`f06bac5b2ed72b3e`**, CLI 15.15.0 |
| enabled served bytes | `/assets/index-BS1wblzO.js`, 200, `sha256 b06e4e32fa73a60e…89678f72` = local build. Compiled gate **`!0` ENABLED**. All three manifests present; validator parity present; **no** fingerprint constant embedded |
| revert | source restored **before any browser action**; `rotaSeedContract.js` `sha256 84e388bd…db427312`, byte-identical to `db3e9e6`; `git diff db3e9e6 HEAD` empty; `dirty=0`; untracked 0 |

The temporary flip was **never committed**.

### 25.3 · The fresh dry run

Muhamed selected **synthetically this time** (single-character `M` typeahead worked on this load,
unlike §24 where the owner had to select by hand). Every displayed field re-verified, and Apply was
correctly blocked at **`NO_SUCCESSFUL_DRY_RUN`** before invocation.

**Exactly one** dry-run POST → `200`. `PLANNED` · entryCount **5** · digest `397f9c6c…5cdf` ·
changeId `rota-seed-397f9c6cf9eff14c26619e1444f4dedb` · revision 0 → 1 · write set
**7 = 5 + 1 header + 1 audit + 0 barber projection** · `predictedPublish null` · `declaredGaps []` ·
no issues · genesis pre-state · **two** warnings (no passive warning — Muhamed is active).

Fresh server fingerprint **`0ab34f9d911f7e65ffea0e45494e44f1d701d03b7d72b4895df9c94e39cb71d6`**.

> This is a **new** value produced by *this* dry run inside the apply-enabled artifact and bound to
> *this* readiness object — `buildApplyPayload` reads `readiness.serverFingerprint`, so the Apply
> could only ever carry the fingerprint from this run. It equals the §23/§24 value because the
> subject's five fingerprint inputs genuinely have not changed; that identity is the drift proof, not
> a reuse.

**Final drift check immediately before Apply: 16/16 fields clean**, fingerprint independently
recomputed from the live document and matching, genesis re-confirmed (header absent, entries 0, only
Alex's and Arda's seed audits).

### 25.4 · The Apply — one request, and what it wrote

Confirmation typed `whitecross/barber-1781007454543/397f9c6cf9ef` — **44 characters, character-exact**,
and independently re-derived as `whitecross/<barberId>/<digest[:12]>`. Gate progression observed in
order: `NO_SUCCESSFUL_DRY_RUN` → `CONFIRMATION_MISMATCH` → satisfied. One Apply click, no retry.

**The operator reported success correctly this time** — *"Seed applied. State SEEDED"* with the full
result block. This is the §21.6 defect staying fixed: `fc6259e`'s shared
`sourceFingerprintFailure` helper accepted the fresh fingerprint on the **apply** side, where Arda's
run wrongly reported `FINGERPRINT_MISMATCH` on a successful write. **The parity fix is now proven in
production, not just in tests.**

**Header `tenants/whitecross/staffRota/barber-1781007454543`** — created `2026-08-25T16:15:40.299Z`:

| Field | Value |
|---|---|
| `revision` | **1** · `entryCount` **5** |
| `lastChangeId` | `rota-seed-397f9c6cf9eff14c26619e1444f4dedb` |
| `lastOrigin` · `legacyMode` · `legacyBlocked` | `ROTA_IMPORT` · `canonical` · `null` |
| `entriesHash` | `5cfd3f96c751187988cb54d0d5c9050dde808bf557edea41851409458e9d3287` |
| `cacheState` | `appliedRevision 1`, `coverage "covered"`, `effectiveDate 2026-08-25`, `activatedAt null` |

The `entriesHash` **equals the dry run's `predictedEntriesHash`** — predicted and actual agree.

**The 5 entries**, ids `rota-seed-397f9c6cf9eff14c26619e1444f4dedb-e1 … -e5`, all `ROTA_OPEN`,
`seq` 0–4, **5 unique ids**, actor `CsktIKNC0wRaP2eK8DECVMWPD0m1` / `super-admin` on every entry:

| seq | from → to | workingDays | hours |
|---:|---|---|---|
| 0 | `2026-06-09` → `2026-07-12` | Tue–Sun (base 6) | — |
| 1 | `2026-07-13` → `2026-07-13` | **Monday** | — |
| 2 | `2026-07-14` → `2026-08-23` | Tue–Sun (base 6) | — |
| 3 | `2026-08-24` → `2026-08-24` | **Monday** | — |
| 4 | `2026-08-25` → **`null`** | Tue–Sun (base 6) | `{09:00, 19:00}` |

**Every entry carries `dayHours: null`** — the final segment omits it, so the absent
`dayHours.Monday` can never be reintroduced.

**Canonical fold over the live entries:** `ok: true`, `revision 1`,
`entriesHash 5cfd3f96…e9d3287` (matches the header), **`issues: []`**, **5 periods**, 5/5 unique ids.
**Only the two exception entries contain Monday** — `2026-07-13` and `2026-08-24`, asserted rather
than eyeballed. Date verdicts:

| Date | Weekday | Verdict |
|---|---|---|
| `2026-06-23` | Tuesday | covered, **works** ✅ (owner ruling honoured) |
| `2026-07-13` | Monday | covered, **works** ✅ |
| `2026-08-24` | Monday | covered, **works** ✅ |
| `2026-08-25` | Tuesday | covered, **works** ✅ (the accepted divergence) |
| `2026-06-15` | Monday | covered, **not worked** ✅ (ordinary Monday) |

**Audit — exactly one**, `rota-seed-barber-1781007454543-50e2ebce0a59a128` (the predicted id),
created `2026-08-25T16:15:40.299Z`: `action ROTA_SEED_IMPORT`, `source rota-seed-import`, actor
`CsktIKNC0wRaP2eK8DECVMWPD0m1` / `super-admin` — **the real owner, no synthetic actor** — `revision 1`,
`entryCount 5`, `seedPlanDigest 397f9c6c…5cdf`, `sourceRotaFingerprint 0ab34f9d…71d6`,
`seedFrom 2026-06-09`, `seedFinalFrom 2026-08-25`, `declaredGaps []`,
**`legacyFieldsPublished: false`**, `convergenceReason AS_OF_ADVANCED`, `gateDecision ALLOW`,
5 `entryIds`, and the 3 overlapping `shiftChanges` keys recorded but untouched.

**Tenant-wide there are now exactly three `rota-seed-*` audits** — Alex (2026-08-20), Arda
(2026-08-25 00:13), Muhamed (2026-08-25 16:15). One per subject, no duplicates.

### 25.5 · Before/after — everything else untouched

**20/20 fields identical**: barber `docHash fbd512ad…5fee3eb`, `createTime`, **`updateTime
2026-08-23T14:55:07.730Z` unmoved** (no barber projection), `active`/`true`, `workingDays`, `hours`,
`dayHours` full hash `fc3dab9f…e734917c`, **`dayHours.Monday` still ABSENT**, `shiftChanges` full hash
`b9ff930e…f1befdec` with all three keys, `leaves`, `availabilityFrom`, fingerprint inputs,
`staffComp 68e24a50…148c667d`, **`rotaPolicy/rollout` still absent**, 11 barberId-keyed audits with an
unchanged id-set, 86 records.

Changed, as authorized: `staffRota` absent → **present**; `rotaEntries` 0 → **5**.

**Finance modes unchanged:** `ROTA_HISTORY=legacy` · `COMP_PERIOD=periods` · `COMP_AMOUNT=legacy` ·
`FIXED_COST=legacy`. **No wage total moved** — the log is inert until `FIN-ROTA-HISTORY-READ`.

> ⚠️ **Request-count evidence, stated precisely.** Directly observed: one dry-run POST (`200`) after
> the dry run, and still exactly one dry-run POST with **zero** Apply POSTs immediately before the
> Apply click. After the Apply the extension's network buffer had **rolled over** — it retained only
> two recent Firestore listen-channel requests — so the Apply POST itself was not re-read from that
> buffer. The authoritative proof of exactly-one-apply is Firestore: **one** header at revision 1,
> **exactly 5** entries with deterministic ids, and **exactly one** create-only seed audit. A second
> Apply would have been refused at the header check and could not have produced a second audit,
> because the audit id is derived and create-only.

### 25.6 · Posture restored — mandatory cleanup completed

Source flag was already `false` (restored in §25.2). Rebuilt and redeployed from the clean tree:
`salown-admin` `f06bac5b2ed72b3e` → **`4cd8def008cef920`**. Served
`/assets/index-DF-ESqGR.js`, 200, `sha256 c23601c6eb212a2d…1f98925c` — **byte-identical to the §24
disabled build** — compiled gate **`!1` DISABLED**, `APPLY_DISABLED_IN_THIS_BUILD` present.

**The live operator is NOT left apply-enabled.** Across the whole task only `salown-admin` moved;
`salown` `c0d31a9fac873c69`, `salown-staff` `c0606fdcb48f5207`, `whitecrossbarbers-saas`
`d7d72c6755a35044` and callable **`salownrotaseedtenanthistory-00002-dun`** are all unchanged.

### 25.7 · Rollback

**Hosting rollback: `39b47e0206fd73f3`** — apply-disabled and safe, though it predates the Muhamed
manifest. **Do not roll back to `f06bac5b2ed72b3e`**: that is the apply-ENABLED window artifact.

**Data rollback: none exists.** The log is append-only; `rotaSeedImport.ts` has no update and no
delete path, and `ROTA_SUPERSEDE` carries no pattern or dates (§4). Undoing would require privileged
Admin-SDK deletion of the header, its 5 entries and the audit — outside every sanctioned writer and
destructive of the audit trail. **Not attempted, not authorized**, and not needed while
`FINANCE_ROTA_HISTORY_MODE` stays `legacy`.

### 25.8 · State and the next separately authorized step

**All three Whitecross accruing subjects are now seeded** — Alex (24 entries, rev 2), Arda (21, rev 1),
Muhamed (5, rev 1). Each is seeded but **not published and not projected**: `legacyFieldsPublished`
false, barber documents untouched, no Finance consumer reading the log.

Next, separately authorized: **`FIN-ROTA-HISTORY-READ`** — the Finance read-side cutover, now
*evaluable* for the first time since the "half-migrated tenant" precondition is satisfied. It still
requires its own analysis and authorization, and `ROTA-BOOTSTRAP-APPLY` must still settle any
remaining subject. The accepted arithmetic to re-verify before any flip is §23.7 plus this seed's
accepted `2026-08-25` +£41.60 divergence. **This task changed no Finance mode and moved no wage.**

---

## 26 · Whitecross tenant bootstrap — production dry run, 2026-08-25

> ### Result
> ```
> DRY RUN VERIFIED · 3/3 ALREADY_CANONICAL · blocking [] · rolloutFlipped false
> ZERO WRITES · BOOTSTRAP NOT APPLIED · Finance modes UNCHANGED
> ```
> Exactly **one** `salownRotaBootstrapTenant` dry run as `aerulas@gmail.com`, through the deployed
> **apply-DISABLED** bootstrap operator. Nothing was written. `rotaPolicy/rollout` is still absent and
> the tenant is still LEGACY.

**Anchors.** `salownadmin` `db3e9e6` → **`9467df5`** · `salown-app` `0f6e118` → **`517b721`** ·
`salown-docs` `9e1ca2d`. All `main`, clean, **zero claims** (the bootstrap-operator coordination claim
was acquired in `dc603da` and released in `517b721`). Both Apply flags committed `false`:
`ROTA_SEED_APPLY_ENABLED` and `ROTA_BOOTSTRAP_APPLY_ENABLED`.

Gates at `9467df5`: `node --test` **219/219**, eslint clean on all six changed files, `vite build` ok,
`git diff --check` clean, tree `dirty=0` after build. **The seed surface is untouched** —
`git diff db3e9e6 HEAD` over `rotaSeedManifests.js`, `rotaSeedContract.js` and `RotaHistorySeed.jsx`
is empty.

### 26.1 · Pre-state — the bootstrap's own preconditions, proven

This is the first operation whose *correctness argument is the state of the other three*. All of it
was proven read-only before invoking:

| Subject | Header | revision | entries | fold | `entriesHash` == fold hash |
|---|---|---:|---:|---|---|
| **Alex** `barber-1777257519766` | present, `canonical`, `lastOrigin ROTA_CHANGE` | **2** | 26/26 | `ok`, 25 periods, `issues []` | ✅ `751de38d…960cf4` |
| **Arda** `barber-1777655430086` | present, `canonical`, `lastOrigin ROTA_IMPORT` | **1** | 21/21 | `ok`, 21 periods, `issues []` | ✅ `e2099b64…02e46f` |
| **Muhamed** `barber-1781007454543` | present, `canonical`, `lastOrigin ROTA_IMPORT` | **1** | 5/5 | `ok`, 5 periods, `issues []` | ✅ `5cfd3f96…9d3287` |

Exactly **3** barbers in the tenant and exactly **3** `staffRota` documents — no fourth subject and no
orphan header. Exactly **3** `ROTA_SEED_IMPORT` audits, one per subject.
**`rotaPolicy/rollout` ABSENT**, **zero `ROTA_TENANT_BOOTSTRAP` audits**, `auditLogs` total 3082.
Finance modes `legacy` / `periods` / `legacy` / `legacy`. Callable
**`salownrotabootstraptenant-00002-nuy`** (2026-08-19), unchanged all task.

Every stop condition in the brief was checked and none fired.

### 26.2 · Deployment — apply-disabled, one target

`bash deploy.sh` → `--only hosting --project havuz-44f70`, CLI 15.15.0, 5 files found / 2 uploaded.
**Both flags stayed `false` throughout** — no flip at any point, tree `dirty=0` before and after.

`salown-admin` `4cd8def008cef920` → **`cbb1b9e702ce26ae`**. Unchanged: `salown`
`c0d31a9fac873c69`, `salown-staff` `c0606fdcb48f5207`, `whitecrossbarbers-saas` `d7d72c6755a35044`,
callable `salownrotabootstraptenant-00002-nuy`.

**Served-byte proof** — `/assets/index-CaKUcZsm.js`, HTTP/2 200, 1,106,513 B,
`sha256 7d70f0859394ce40fa1a94a702fa2d7e5fd8f03260c84e17a1e1d2578e2e1075`, **identical to the local
build**.

| Assertion | |
|---|---|
| route `/ops/rota-bootstrap` | ✅ |
| `salownRotaBootstrapTenant` callable name | ✅ |
| `ALREADY_CANONICAL`, `ROTA_TENANT_BOOTSTRAP` | ✅ |
| all three barber ids in the reviewed config | ✅ |
| **`BOOTSTRAP_APPLY_DISABLED_IN_THIS_BUILD`** | ✅ |
| `APPLY_DISABLED_IN_THIS_BUILD` (seed gate still present) | ✅ |
| **compiled bootstrap gate default `!1`** | ✅ DISABLED |
| any production fingerprint embedded | ✅ **none** — Alex, Arda and Muhamed values all absent |

The confirmation phrase is **runtime-constructed**, `` `${tenantId}/bootstrap/${expected.rolloutTo}` ``
→ `whitecross/bootstrap/canonical`, so its absence as a string literal is correct rather than a miss.
The payload builder is `{ tenantId, dryRun: true }` and can express nothing else.

### 26.3 · The invocation — and an honest note on the first click

> ⚠️ **The first click did not fire.** It landed while the page was still hydrating and produced **no
> request at all** — verified by a clean network read showing **zero** `cloudfunctions` entries with a
> non-full buffer, and by the page showing no result and no in-flight state. Because nothing had been
> invoked, clicking again was **the single authorized invocation, not a retry**. That distinction was
> established from evidence before acting, not assumed.

**Verdict: `Dry run verified.`** Write set **2 = 0 per-subject + 1 rollout + 1 audit**; rollout
**legacy → canonical**.

That verdict is **code-enforced**, not a reading of the screen. `validateBootstrapDryRunResponse` +
`checkBootstrapSubjects` refuse readiness unless *all* of the following hold, so a green verdict is
proof of every one:

| Enforced condition | |
|---|---|
| `ok: true`, `dryRun: true`, `tenantId === whitecross` | ✅ |
| exactly the 3 expected barber ids — `UNEXPECTED_SUBJECT`, `DUPLICATE_SUBJECT`, `MISSING_SUBJECT` all clear | ✅ |
| every subject `state === ALREADY_CANONICAL` | ✅ |
| **no subject carries a `changeId`** — i.e. no planned `ROTA_START`, zero per-subject writes | ✅ |
| every subject's `sourceFingerprint` is a valid **lowercase 64-hex** sha256 | ✅ |
| `blocking` is an array **and empty** | ✅ |
| `rolloutMode === legacy` (the pre-state) | ✅ |
| **`rolloutFlipped === false`** — a dry run flips nothing | ✅ |

The fingerprints are captured into the readiness object's `subjectFingerprints` for a later apply
handshake and are **memory-bound only — never persisted, never pinned into source**. The bundle scan
in §26.2 confirms none is embedded.

**Apply remained unavailable throughout** — `Apply cutover — DISABLED IN THIS BUILD`, and no
confirmation was typed.

> **Request count, stated precisely.** The extension's buffer retained the **CORS preflight**
> `OPTIONS … /salownRotaBootstrapTenant` → `204` (one preflight per POST) but the POST itself had aged
> out of the captured window by the time I read it — the same buffer limitation recorded in §25.5. The
> authoritative proof that at most one invocation occurred is production: `rotaPolicy/rollout` is
> still absent and no `ROTA_TENANT_BOOTSTRAP` audit exists, so no apply ran; and the first click is
> proven to have produced no request at all.

### 26.4 · Zero-mutation proof

Full tenant baseline re-read after the dry run and compared field by field — **every field
identical**:

- **`rotaPolicy/rollout` still ABSENT**; **zero `ROTA_TENANT_BOOTSTRAP` audits**; `auditLogs` total
  unchanged at 3082; the 3 `ROTA_SEED_IMPORT` audits unchanged by id-set.
- All three headers: `revision`, `entryCount`, `entriesHash`, `lastChangeId`, **`headerUpdateTime`**,
  live entry count, **entry id-set hash and entry payload hash**, `foldOk`, fold hash, fold periods and
  `foldIssues` — unchanged for Alex, Arda and Muhamed.
- All three barber documents: `docHash`, **`updateTime`**, `dayHours` hash and keys, `shiftChanges`
  hash and keys, `leaves` hash, `availabilityFrom`, `status`, `active` and `sourceRotaFingerprint` —
  unchanged.
- All three `staffComp` documents unchanged.
- Finance modes `legacy` / `periods` / `legacy` / `legacy`.

### 26.5 · State and the next separately authorized step

Whitecross is **still LEGACY**. The bootstrap is *proven ready* and **not applied**: the tenant has
three canonically seeded subjects, all classifying `ALREADY_CANONICAL`, with nothing blocking, and an
apply would write exactly **two** documents — the rollout flip and one audit — and **no** per-subject
history, barber document, compensation or wage.

Next, separately authorized: **`ROTA-BOOTSTRAP-APPLY`** — requiring a reviewed
`ROTA_BOOTSTRAP_APPLY_ENABLED = true` flip, a redeploy, a **fresh** dry run inside that artifact (these
fingerprints are memory-bound and not reusable), the typed confirmation
`whitecross/bootstrap/canonical`, and its own explicit authorization. Separately again, and still
unauthorized: **`FIN-ROTA-HISTORY-READ`**. **This task changed no Finance mode and moved no wage.**

**Hosting rollback:** `4cd8def008cef920` — apply-disabled and safe, though it predates the bootstrap
operator.
