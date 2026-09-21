# FIN_B1B_RELEASE_PREFLIGHT.md — refunds in the settlement ledger

> **Status 2026-09-21: LOCALLY VERIFIED CANDIDATE, NOT RELEASED.** Nothing in this document has been
> executed against Stripe, staging or production. Every numbered step in §4 is a **step to be taken**,
> not a step taken. No real Stripe call, no webhook-subscription change, no flag flip, no deploy has
> happened in the sessions that produced the candidate.
>
> **2026-09-21 preparation pass (`FIN-B1B-RELEASE-PREP`), no deploy:** §4 is now the combined
> **B1 + B1b** sequence and carries the three decisions that used to live only in a handoff —
> `WC_SETTLEMENT_START_ISO` (step 2), the `charge.updated` decision and what it costs (step 3), and
> the `autoRefundEnabled` intersection (step 6a). §5 rollback is written out in full, to be agreed
> before the release rather than composed during it. **§3 corrects how the 220/220 figure is
> obtained** — the published command produced 219/220 + 1 silent degradation in the workspace this
> document tells you to build. An arming tool now exists
> (`whitecross-site/scripts/activateSettlementLedger.mjs`, 29 tests, never run against production),
> and the two new Stripe reads have a local write-free rehearsal
> (`whitecross-site/ops/rehearsal/api-readonly/`, 52/52). **Step 1 has no green gate today** — see §1.
>
> **This release must not be bundled with the Treatwell/Booksy parser releases**, and it does not touch
> the B1 release, which stays pinned at whitecross-site `22850996`.
>
> Companion documents: [`PROCESSOR_FEES_PLAN.md`](PROCESSOR_FEES_PLAN.md) (the contract, §2.4/§2.6/§3.1/§6.3.1),
> [`FIN_B1_RELEASE_PREFLIGHT.md`](FIN_B1_RELEASE_PREFLIGHT.md) (B1, a separate release lane),
> [`TESTS.md`](TESTS.md) §0-B (the gates that ran).

## 0. What B1b ships, and what it does not

**Ships (source only, not deployed):** refunds reach the settlement ledger.

* `REFUNDED` entries `stripe:re_<id>` for refunds Stripe reports `succeeded`, with `amount_m` from the
  Refund object;
* `REFUND_FEE_ACTUAL` entries `stripe:txn_<id>` for the refund's own balance transaction — an unknown
  fee is never 0, it blocks completeness instead;
* automated `COMPENSATION` entries `comp:<entryId>:REFUND_FAILED|REFUND_CANCELED` when a recorded
  refund later fails or is canceled; entries are never edited;
* per-charge reconciliation metadata `booking.settlementRefundState.<chargeId>` (generation fence,
  "as of" snapshot, `state`/`attempts`), which is the only mutable part;
* the webhook hook in the BL-5 refund block of `functions/index.js` (runs before each 200; the refund
  reconcile's own responses and writes are unchanged);
* a Stripe **Events API backstop** inside the existing `wcSettlementSweeper` (`events.list` over a
  persisted cursor with a resume position and an explicit retention gap) — **this is a new Stripe API
  use** in this lane;
* refund completeness feeding `settledNet_m` / `settledNetStatus` in the existing projection.

**Does not ship:** any screen (B2 owns the reader), any change to confirmation, checkout or the
existing refund reconcile behaviour, any date policy (refund day and the no-checkout fee date remain
open owner decisions), any new Firestore query or composite index, and no refund-creating API call — a test asserts that `refunds.create` is unreachable from the settlement path. Nor any change to B1's entries.

## 1. Source identity (to be re-checked on the day)

| Unit | Live now | Candidate | Delta |
|---|---|---|---|
| `stripeWebhook` (us-central1, gen2) | revision **`stripewebhook-00106-dof`** (as recorded 2026-09-14; **re-verify**) | whitecross-site **`925debde`** | the B1 branch **plus** the B1b refund path and the `index.js` BL-5 hook |
| `wcSettlementSweeper` | **does not exist** | same SHA | new function; now also runs the refund events backstop |
| Firestore indexes | 2 composite `bookings` indexes | **unchanged by B1b** | B1b adds **no** query and **no** index (verified: the query set is byte-identical to `22850996`) |
| Firestore rules | ruleset `5e102dd4-…` | **unchanged** | B1b needs no rules change; the `settlementLedgerEnabled` arm is already live |

**Byte identity of the candidate:** `functions/settlements.js` at `925debde` is sha256 `61e1ebb4764eb983…`; the
`origin/main` head at the time, `0e6de132`, differs from it only by removing a claim file, so `functions/` is
identical. Re-check both on the day.

> **Re-verified read-only 2026-09-21.** `925debde` → `origin/main` (`a4c4b724`) is an **empty diff under
> `functions/`**; `settlements.js` still hashes `61e1ebb4764eb983…`. Live identities unmoved: `stripeWebhook`
> `stripewebhook-00106-dof` (`updateTime 2026-08-28T23:50:59Z`, source generation `1787960993781215`),
> `wcSettlementSweeper` absent from functions, Cloud Run and Scheduler, ruleset `5e102dd4-…`, 2 composite
> indexes READY, `settlementLedgerEnabled` absent, `platform/settlementScan` 404, the `settlements`
> collection group empty. `autoRefundEnabled` is **`true`** — see §2 and §4.

**A gate outside this repo blocks step 1.** The index ships from salown-app, and
`salown-app/ops/rules-authority.test.js` is **red** there while any git worktree carrying a deployable
Firestore config exists. On 2026-09-21 two such paths belong to a live `CLIENT-IDENTITY-P1-MERGEPREP`
session (`ci-p1`, a registered worktree; `bookkeep2`, a stray `firestore.rules`). Neither is this lane's
to remove. **Until that session clears them, the index step has no green gate and must not be treated as
passed.** Claim paths do not overlap, so this is a gate conflict, not a claim conflict.

**B1 relationship:** B1b is a superset of B1 in source. If B1 has not been released when B1b is
approved, the two ship as one deploy of the same two functions; if B1 is already live, B1b is a
redeploy of `stripeWebhook` + `wcSettlementSweeper` from `925debde`. Either way the pinned B1
candidate `22850996` is not modified.

## 2. Environment, flag and Stripe readiness — **all TODO**

| Item | State | Step to take |
|---|---|---|
| `WC_STRIPE_ACCOUNT_ID`, `WC_STRIPE_LIVEMODE`, `WC_SETTLEMENT_START_ISO` | unchanged from B1; B1b introduces no new variable | reuse exactly the B1 values; `WC_SETTLEMENT_START_ISO` is the ledger's permanent origin and must never move on a redeploy |
| Kill switch `settings/settings.settlementLedgerEnabled` | **absent** (B1 never released; field-mask read re-confirmed 2026-09-21) | B1b is inert while it is absent or false — every refund path checks it before any Stripe call. **A tool now exists:** `whitecross-site/scripts/activateSettlementLedger.mjs` (`c2f29b6f`) — dry run by default, `updateTime` CAS, exact-field diff, flag + audit row in one commit, and it refuses to arm unless the due-pass index is READY. The earlier "no activation tool exists" note is superseded |
| **`autoRefundEnabled`** | **`true` since 2026-09-18**, left armed by owner decision (`REFUND-RELEASE-ANCHORS.md`) | **owner decision, §4 step 6a.** Both preflights were written when this flag was absent. With both switches on, every automatic refund writes `REFUNDED` + `REFUND_FEE_ACTUAL` from the moment the ledger is armed. The arming tool refuses without `--ack-auto-refund-armed` and records the acknowledgement in the audit row |
| Live endpoint event list | last *recorded* 2026-08-29: `charge.refunded`, `checkout.session.completed`, `refund.updated`. **Re-verified behaviourally 2026-09-18**: the BL-4 activation record shows `stripeWebhook` handling `charge.refunded` and `refund.updated` that day, and names the endpoint's three events | **TODO (owner, Dashboard):** re-read on the day and record id + sorted list. B1b needs **no** new subscription: the backstop pulls `refund.created`/`refund.failed` from `events.list` itself rather than by delivery. **`charge.updated` is deliberately NOT being added** (owner, 2026-09-21) — see the §4 note on what that costs |
| Stripe API surface | **two** new reads in this lane: `events.list` (the backstop) and `refunds.list` with `expand[]=data.balance_transaction` (the refund listing). Both are reads on the existing secret key; no new key and no write API | **Rehearsed 2026-09-21**, `whitecross-site/ops/rehearsal/api-readonly/` (`47501347`): real Firestore emulator, real handlers, fake Stripe under an *enforcing* read-only guard — 12 steps, 52/52 checks, 291 calls, **all reads, 0 write attempts**, with a negative control proving the guard bites. The bounds are asserted against what was sent: `types[]` is exactly the four backstop types, `limit` ≤ 100, one closed `created` window per pass, and an unending refund list is refused rather than turned into money. **Still TODO:** the owner's approval for the new API use itself |
| Staging project | B1 rehearsed there 2026-09-08; `salown-staging` is **ACTIVE but torn down to 0 functions** (re-checked 2026-09-21) | **TODO:** repeat for B1b with Stripe **test mode**: a real refund on a test charge, a redelivered refund webhook, a deliberately lost webhook recovered by the backstop, and a sweeper pass. **Not free** — it needs 4 secrets, `.env.salown-staging`, the targeted deploy, a new Stripe test-mode endpoint and the synthetic seed rebuilt first. No Stripe test-mode call has been made and none may be made without owner approval |

## 3. Tests — what has run, and what has not

> ### ⚠️ How to actually get 220 / 220 — corrected 2026-09-21
>
> The earlier version of this table said "**220 / 220 pass, 0 skipped** — `cd functions && npm test`"
> and put B1 parity and the reader contract "inside that run". Reproduced in the workspace this
> document tells you to build — a `git archive` of the candidate, which is what §4 steps 4 and 5
> require — the same command gives **220 tests, 219 pass, 1 SKIPPED**, and a second gate degrades
> *silently*. Both of the rows that matter most were measuring nothing:
>
> * **B1 parity** runs `git show 22850996:functions/settlements.js`. A `git archive` export has no
>   `.git`, so the command fails and the test calls `t.skip('the pinned B1 source is not reachable
>   from this checkout')`. Visible in the output, easy to read past.
> * **Reader contract** resolves `../../salown-app/src/utils/settlementFacts.ts` and, if the file is
>   not there, `return`s. Not a skip — a **pass**. In a scratch workspace that path does not exist,
>   so the half that checks salown-app's real reader never runs and the suite still reports green.
>
> **The run is only valid when both dependencies are present**, which means:
>
> 1. a checkout from which `22850996` is reachable — a clone (`git clone -s <repo> <dest> &&
>    git checkout 925debde`) or the repo itself, **not** `git archive`; and
> 2. a sibling `salown-app` whose `src/utils/settlementFacts.ts` exists, laid out as
>    `<root>/whitecross-site/functions` and `<root>/salown-app/src/utils/settlementFacts.ts`.
>
> Verified under those conditions on 2026-09-21: **220 / 220, 0 skipped**, with
> `B1b · B1 parity …` and `B1b · every projection … reader contract` both ticked in the output.
> **On release day, read the skip count, not just the pass count**: `0 skipped` is part of the gate.
>
> The release build itself still comes from a `git archive` of the candidate, as §4 requires — that
> is a *deploy* workspace. What this note changes is where the suite is *run*.

| Gate | Result | Where |
|---|---|---|
| Unit suite at `925debde` | **220 / 220 pass, 0 skipped** | `cd functions && npm test`, in a clone with history **and** a sibling `salown-app` (see the note above). In a `git archive` workspace the same command reports 219/220 + 1 skip |
| B1 parity | never-refunded bookings byte-identical to `22850996` | inside that run — **only if `22850996` is reachable from the checkout**, otherwise the test skips itself |
| Reader contract | every projection passes salown-app `readProjection` | inside that run — **only if `../../salown-app/src/utils/settlementFacts.ts` exists**, otherwise that half returns early and the test still passes |
| **Local Firestore emulator rehearsal** | **7 / 7 scenarios** (both writer-race orders, a parallel race, fencing after an unchanged snapshot, retry exhaustion → sweeper takeover, two charges keeping both totals, `pending → succeeded` with no human step) | `whitecross-site/ops/rehearsal/`, evidence `evidence/2026-09-17-925debde.txt` |
| **Local scenario rehearsal** (real `stripeWebhook` handler + sweeper + salown-app reader, fake Stripe) | **8 / 8 steps** — capture, fee, refund by webhook, a lost webhook recovered by the backstop, a pending refund dropping completeness, a cancellation restoring it, a refund that failed after succeeding, replay, kill switch | `docs/evidence/fin-processor-fees/2026-09-16-b1b-local-rehearsal/` |
| **API-read rehearsal** (the two new Stripe reads, enforcing read-only guard, real emulator) | **12 steps, 52 / 52 checks, exit 0** — 291 Stripe calls, all reads, **0 write attempts**; A0 negative control proves the guard blocks `refunds.create` | `whitecross-site/ops/rehearsal/api-readonly/`, evidence `evidence/2026-09-21-925debde-api-readonly.jsonl` |
| B1 candidate suite at `22850996` | **182 / 182 pass, 0 skipped** (re-run 2026-09-21) | `git archive` of `22850996`; this one has no cross-repo dependency |
| salown-app workspace guards (`deploy-policy`, `rules-authority`, `functions-ownership`) | **125 passed / 1 excluded** in an isolated sibling tree carrying this lane's new files. **Red in the shared checkout** — see the §1 gate note | `npx vitest run ops/…`. The excluded test spawns `firebase-tools deploy --dry-run`; it is not run under a read-only mandate |
| Staging, real GCP + Stripe test mode | **NOT RUN** — and no Stripe test-mode call has been made | — |
| Production live-verify | **NEVER RUN**; nothing is deployed | — |
| `activateSettlementLedger.mjs` (the arming tool) | **29 / 29 pass** | `node --test scripts/activate-settlement-ledger.test.mjs`. **Never run against production**, not even a dry run |

## 4. The approval package — ordered steps, **none of them taken**

> This is the combined **B1 + B1b** sequence. `925debde` is a source superset of the pinned B1
> candidate `22850996`, so one deploy of the same two functions ships both. `22850996` is not modified.

0. **Same-day re-check.** Confirm `925debde` is still the candidate, the live `stripeWebhook`
   revision, the live ruleset id and the index list. Stop if any identity moved. Run the unit suite
   **with both dependencies present** (§3 note) and read the **skip count**.
   **Gate:** `salown-app/ops/rules-authority.test.js` must be green in the shared workspace. It is
   not today (§1). Wait for that session — do not work around it.
1. **Index** (salown-app, not this repo). Deploy `firestore:indexes` from a `git archive` workspace of
   the salown-app candidate; answer **No** to any deletion prompt. Expected: **creates 1, deletes 0**
   (`firestore.indexes.json` is byte-identical at `9a9547a`, `b6c325c` and today's `origin/main`, and
   the live `stripePaymentIntent` field override already matches the file). Poll
   `gcloud firestore indexes composite list --project havuz-44f70` until **all three are READY**.
   *Why first, and why blocking:* the sweeper's due pass runs **before** the provider scan and the
   refund-events backstop. Without the index that query throws, the sweeper's outer catch logs
   `pass failed`, and the whole pass — due work, scan and backstop — is skipped. The flag would say
   the ledger is live while the sweeper is dead. The arming tool refuses for this reason.
2. **`WC_SETTLEMENT_START_ISO` — owner decision, and it is permanent.** Take one UTC instant
   (`date -u +%Y-%m-%dT%H:%M:%SZ`) **immediately before** step 4, write it into
   `functions/.env.havuz-44f70` in the whitecross-site archive workspace together with
   `WC_STRIPE_ACCOUNT_ID` and `WC_STRIPE_LIVEMODE`, and record it in the `RELEASE_LEDGER.md` row.
   It is the ledger's origin: every scan window is floored at it and the events backstop refuses
   anything before it. **It must never move on a redeploy** — moving it backwards re-scans history,
   moving it forwards creates a permanent blind span. Confirm before step 4 that the live function
   carries **no** `WC_*` settlement variable today (verified 2026-09-21), so this is a first write,
   not a change.
3. **Stripe endpoint.** Read the live endpoint's event list in the Dashboard; record the id and the
   sorted list; confirm `charge.refunded` and `refund.updated`. **Change nothing.**
   *Owner decision 2026-09-21: `charge.updated` is NOT being added.* What that costs, stated plainly:
   the capture arrives on `checkout.session.completed`, and if Stripe has not set
   `balance_transaction` by that moment the fee is `pending` and the **only** path that completes it
   is the indexed due pass (≤ 15 min). Whether live mode has it set at that moment is unverified.
   So with `charge.updated` unsubscribed, step 1 is not a performance step — it is the fee path.
4. **Staging rehearsal** with Stripe test mode, from an isolated `git archive` workspace of the
   candidate: partial refund, full refund, a refund that fails after succeeding, a deliberately
   dropped webhook recovered by the backstop, a sweeper pass, and the kill switch off → on.
   Requires `salown-staging` rebuilt first (§2) and **explicit owner approval for the Stripe
   test-mode calls**. The local API-read rehearsal (§3) bounds the two new reads but does not
   replace this.
5. **Functions deploy** (only after 0–4 pass and the owner approves): from an isolated archive
   workspace of `925debde`, `./scripts/deploy-functions.sh whitecross stripeWebhook wcSettlementSweeper`.
   The flag decides whether anything runs; with it absent both are inert. Record in the ledger row
   that this deploy also republishes the already-live `loyaltyEnroll.js` into the `stripeWebhook`
   bundle — `externalCheckout.js`, `refunds.js` and `emailParsers.js` are unchanged bytes.
6. **Arm the flag** — `whitecross-site/scripts/activateSettlementLedger.mjs`. Dry run first; it
   prints the exact command, including the `--expect-update-time` value:
   ```
   node scripts/activateSettlementLedger.mjs                      # dry run, writes nothing
   node scripts/activateSettlementLedger.mjs --arm --expect-update-time <ts> [--ack-auto-refund-armed]
   ```
   It refuses if the due-pass index is not READY, if the settings document moved since the read, or
   if the tenant has no settings document; it writes the flag and its audit row in one commit and
   proves afterwards that exactly one field moved and that it is a real boolean.
   **6a. The BL-4 intersection — owner decision, taken at this step.** `autoRefundEnabled` has been
   `true` since 2026-09-18 by owner decision. From the moment the ledger is armed, **every automatic
   refund writes `REFUNDED` and `REFUND_FEE_ACTUAL` entries**. That is what B1b is for, but neither
   preflight was written for that combination, so the choice is explicit:
   *(a)* arm with `--ack-auto-refund-armed` and accept it — the acknowledgement lands in the audit
   row; or *(b)* `node scripts/activateAutoRefund.mjs --disarm --expect-update-time <ts>` first,
   observe the first captures, then re-arm automatic refunds. There is no third option in which the
   combination is simply not noticed.
7. **Live verification:** the first real refund after the flag is on produces `stripe:re_…` and
   `stripe:txn_…` entries, `settlementRefundState.<charge>.generation` ≥ 1 with `state: ok`, the
   projection's `refunded_m` equal to Stripe's `amount_refunded`, `settledNetStatus: complete`, and no
   `refundReview`. The booking's confirmation and money fields are unchanged. The first sweeper pass
   logs `pass complete { enabled: true, configOk: true, … advanced: true }`, creates
   `platform/settlementScan`, and refuses nothing.
8. **Ledger row.** Record the release in `RELEASE_LEDGER.md` with the rollback identity, the chosen
   `WC_SETTLEMENT_START_ISO`, the endpoint event list as read at step 3, and which branch of 6a was taken.

## 5. Rollback — agreed **before** the release, not composed during it

1. **Stop first, always.** `node scripts/activateSettlementLedger.mjs --disarm --expect-update-time <ts>`.
   Every **new** invocation of the webhook's settlement branch and of the sweeper is inert at once.
2. **Let in-flight work drain, per unit.** `stripeWebhook`: one HTTPS invocation lives at most its
   timeout (60 s default), and Stripe redeliveries keep arriving for up to 3 days but now hit the flag
   first. `wcSettlementSweeper`: one pass ≤ 120 s, no retry on failure, schedule every 15 min — so at
   most one already-running pass can still write. **Writes that land during the drain are valid ledger
   facts, not errors.**
3. **Verify quiescence, not a timestamp cut-off.** List `collectionGroup('settlements')` ordered by
   `recordedAt` desc and confirm no new entry across **two further scheduler intervals**; likewise no
   new `settlementSync` marker.
4. **Code, fastest:** `gcloud run services update-traffic stripewebhook --region=us-central1
   --to-revisions=stripewebhook-00106-dof=100 --project=havuz-44f70`. That revision is still listed and
   Ready (re-verified 2026-09-21); it holds only until the next deploy of the function.
   **Code, permanent:** redeploy a `git archive` of **`6817356f`** (byte-identical to today's live
   bundle) with `./scripts/deploy-functions.sh whitecross stripeWebhook`, from a workspace **without**
   the env file.
5. **Sweeper:** pause `firebase-schedule-wcSettlementSweeper-us-central1`, then
   `firebase functions:delete wcSettlementSweeper --region us-central1 --project havuz-44f70`. **No
   earlier revision exists** — the only way back is deletion.
6. **Index:** leave it in place. It is inert and deleting it is a separate, slower operation.
7. **Rules:** there is **no** B1/B1b rules rollback. The `settlementLedgerEnabled` arms shipped
   inseparably with A3 in ruleset `5e102dd4-…`; reverting would revert A3. They are owner-only and
   loosen nothing, so none is needed.
8. **Data:** entries already written are correct facts and stay. `settlementRefundState` is
   coordination metadata; it can be left in place (it is inert without the code) and is never a money
   authority. A `COMPENSATION` is only ever written for a fact shown to be wrong, with its own
   evidence and its own approval.

## 6. Known limits carried into the release conversation

* **Stripe read consistency is not guaranteed by anything in this design.** The fence orders *our*
  writers only. A stale read from Stripe is detected as a contradiction and re-read (bounded), then
  raised for review — it is never resolved by guessing.
* The refund status transition table is a health check built on **tier-B evidence**
  (`PROCESSOR_FEES_PLAN.md` §3.1) — coordinator-fetched doc pages that the implementing session could
  not re-verify. No ordinary-flow guarantee rests on it.
* The events backstop can only recover what Stripe still lists: **30-day retention**, charges after
  `WC_SETTLEMENT_START_ISO`, and events whose charge resolves to exactly one booking. Everything else
  is recorded as a retention gap or an unmatched row rather than silently skipped.
* Refund day and the no-checkout fee date remain **open owner decisions** (§9 of the plan). B1b stores
  provider timestamps only and picks no day.
