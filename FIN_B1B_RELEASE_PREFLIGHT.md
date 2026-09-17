# FIN_B1B_RELEASE_PREFLIGHT.md — refunds in the settlement ledger

> **Status 2026-09-17: LOCALLY VERIFIED CANDIDATE, NOT RELEASED.** Nothing in this document has been
> executed against Stripe, staging or production. Every numbered step in §4 is a **step to be taken**,
> not a step taken. No real Stripe call, no webhook-subscription change, no flag flip, no deploy has
> happened in the sessions that produced the candidate.
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

**B1 relationship:** B1b is a superset of B1 in source. If B1 has not been released when B1b is
approved, the two ship as one deploy of the same two functions; if B1 is already live, B1b is a
redeploy of `stripeWebhook` + `wcSettlementSweeper` from `925debde`. Either way the pinned B1
candidate `22850996` is not modified.

## 2. Environment, flag and Stripe readiness — **all TODO**

| Item | State | Step to take |
|---|---|---|
| `WC_STRIPE_ACCOUNT_ID`, `WC_STRIPE_LIVEMODE`, `WC_SETTLEMENT_START_ISO` | unchanged from B1; B1b introduces no new variable | reuse exactly the B1 values; `WC_SETTLEMENT_START_ISO` is the ledger's permanent origin and must never move on a redeploy |
| Kill switch `settings/settings.settlementLedgerEnabled` | **absent** (B1 never released) | B1b is inert while it is absent or false — every refund path checks it before any Stripe call. Flip it only as the B1 lane prescribes |
| Live endpoint event list | last recorded 2026-08-29: `charge.refunded`, `checkout.session.completed`, `refund.updated` — **unverified since** | **TODO:** read the live endpoint in the Dashboard, record id + sorted list, and confirm `charge.refunded` and `refund.updated` are present. B1b needs no new subscription: the backstop pulls `refund.created`/`refund.failed` from `events.list` itself rather than by delivery |
| Stripe API surface | **two** new reads in this lane: `events.list` (the backstop) and `refunds.list` with `expand[]=data.balance_transaction` (the refund listing). Both are reads on the existing secret key; no new key and no write API | **TODO:** owner approval for the new API use; the call is bounded (`types` ≤ 20, `limit` ≤ 100, one window per pass) |
| Staging project | B1 rehearsed there 2026-09-08 | **TODO:** repeat for B1b with Stripe **test mode**: a real refund on a test charge, a redelivered refund webhook, a deliberately lost webhook recovered by the backstop, and a sweeper pass |

## 3. Tests — what has run, and what has not

| Gate | Result | Where |
|---|---|---|
| Unit suite at `925debde` | **220 / 220 pass, 0 skipped** | `cd functions && npm test` |
| B1 parity | never-refunded bookings byte-identical to `22850996` | inside that run (the test loads the pinned source) |
| Reader contract | every projection passes salown-app `readProjection` | inside that run |
| **Local Firestore emulator rehearsal** | **7 / 7 scenarios** (both writer-race orders, a parallel race, fencing after an unchanged snapshot, retry exhaustion → sweeper takeover, two charges keeping both totals, `pending → succeeded` with no human step) | `whitecross-site/ops/rehearsal/`, evidence `evidence/2026-09-17-925debde.txt` |
| **Local scenario rehearsal** (real `stripeWebhook` handler + sweeper + salown-app reader, fake Stripe) | **8 / 8 steps** — capture, fee, refund by webhook, a lost webhook recovered by the backstop, a pending refund dropping completeness, a cancellation restoring it, a refund that failed after succeeding, replay, kill switch | `docs/evidence/fin-processor-fees/2026-09-16-b1b-local-rehearsal/` |
| Staging, real GCP + Stripe test mode | **NOT RUN** | — |
| Production live-verify | **NEVER RUN**; nothing is deployed | — |

## 4. The approval package — ordered steps, **none of them taken**

0. **Same-day re-check.** Confirm `925debde` is still the candidate, the live `stripeWebhook`
   revision, the live ruleset id and the index list. Stop if any identity moved.
1. **Stripe endpoint.** Record the live endpoint's event list; confirm `charge.refunded` and
   `refund.updated`. Change nothing else. (No new subscription is required by B1b.)
2. **Staging rehearsal** with Stripe test mode, from an isolated `git archive` workspace of the
   candidate: partial refund, full refund, a refund that fails after succeeding, a deliberately
   dropped webhook recovered by the backstop, a sweeper pass, and the kill switch off → on.
3. **Functions deploy** (only after 0–2 pass and the owner approves): from an isolated archive
   workspace of `925debde`, `./scripts/deploy-functions.sh whitecross stripeWebhook wcSettlementSweeper`.
   The flag decides whether anything runs; with it absent both are inert.
4. **Live verification:** the first real refund after the flag is on produces `stripe:re_…` and
   `stripe:txn_…` entries, `settlementRefundState.<charge>.generation` ≥ 1 with `state: ok`, the
   projection's `refunded_m` equal to Stripe's `amount_refunded`, `settledNetStatus: complete`, and no
   `refundReview`. The booking's confirmation and money fields are unchanged.
5. **Ledger row.** Record the release in `RELEASE_LEDGER.md` with the rollback identity.

## 5. Rollback

* **Stop first:** set `settlementLedgerEnabled` to `false`. Every refund path is inert at the next
  invocation; in-flight ones finish. Confirm quiescence across two scheduler intervals.
* **Code:** re-point `stripeWebhook` traffic to the previous revision, or redeploy the previous source
  SHA from an isolated workspace; `functions:delete wcSettlementSweeper` if it must go entirely.
* **Data:** entries already written are correct facts and stay. `settlementRefundState` is
  coordination metadata; it can be left in place (it is inert without the code) and is never a money
  authority.

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
