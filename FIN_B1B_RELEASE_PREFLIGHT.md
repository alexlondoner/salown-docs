# FIN-B1b RELEASE PREFLIGHT — refund entries + hardening + fenced reconciliation

> Sibling of `FIN_B1_RELEASE_PREFLIGHT.md`, which stays the authority for the **B1** release pinned at
> whitecross-site **`22850996`**. **That pin does not move.** This file prepares a **separate, later** release of a
> candidate that also contains B1b.
>
> **No deploy, no production read, no Stripe call has been made for this candidate.** The live values in §1 are the
> last recorded ones from B1's preflight (2026-09-14) and are marked as such: they must be re-read by an
> owner-approved session before any "go" (§7).

## 0. What this release would ship, and what it would not

**Ships (on top of B1):**
- refund entries — `REFUNDED` `stripe:re_<id>` for succeeded refunds, and the refund's own fee as its own
  `REFUND_FEE_ACTUAL` `stripe:txn_<id>` entry (an unknown fee writes no entry and is never read as 0);
- automated corrections `comp:<compensatesEntryId>:<REASON>` when a recorded refund later fails or is canceled
  (`comp:<uuid>` stays reserved for manual and batch corrections);
- a hook in the existing BL-5 refund block of `stripeWebhook`, without which refund events never reached the ledger
  at all (they were answered with 200 and returned before the settlement call);
- **fenced reconciliation**: one mutable per-charge record `booking.settlementRefundState.<chargeId>` (generation,
  the refund snapshot, `readAt`, source, trigger event, state `ok|recheck|review`), with every writer fenced by the
  generation it read before calling Stripe. Money stays immutable in `settlements/`;
- **new scope:** a Stripe **Events API backstop** inside `wcSettlementSweeper` for lost refund webhooks, with its own
  persisted cursor and resume position in `platform/settlementScan.refundEvents`.

**Does not ship:** any screen; any P&L, Bank Balance or fee-day behaviour; any refund *action* (the module never
calls `refunds.create`, and a test asserts it); any change to confirmation or refund-reconcile behaviour — the hook
only adds a swallowed ledger call before the same 200 responses, with the same bodies.

## 1. Source selection — candidate

| Unit | Live now — **last recorded 2026-09-14, NOT re-read for this candidate** | Candidate | Delta |
|---|---|---|---|
| `stripeWebhook` (us-central1, gen2) | revision `stripewebhook-00106-dof`, bundle = whitecross-site `6817356f` | **whitecross-site `925debde`** (`origin/main` head `0e6de132`, which only removes a claim file; `functions/` identical) | B1 + B1b + hardening + recency. `functions/index.js` differs from `22850996` **only** by the refund-block hook (+26 lines) |
| `wcSettlementSweeper` | does not exist | same commit | new function + Scheduler job; it now also runs the events backstop |
| Firestore indexes | 2 composite READY; the B1 `settlementSync` index is file-only | salown-app `b6c325c` (unchanged) | **no new index.** B1b adds no query — the query set is identical to the pinned B1 source, verified by reading every `.where`/`.orderBy` in the diff |
| Firestore rules | ruleset `5e102dd4-…` (B1's arm already live) | none | no rules change |

`functions/settlements.js` at the candidate: sha256 `61e1ebb4764eb983…`.

## 2. Env, flag and Stripe readiness

`FIN_B1_RELEASE_PREFLIGHT.md` §2 applies unchanged (the env file in the archive workspace,
`WC_SETTLEMENT_START_ISO` chosen once and never moved, the owner-only kill switch, the endpoint event list). On top
of it:

| Item | Requirement |
|---|---|
| Live endpoint event list | B1 needs `charge.updated` added. B1b's webhook path uses the refund events the endpoint already carries (`charge.refunded`, `refund.updated`). The owner re-reads the list and records it; Stripe **replaces** the whole list on update, so re-send everything plus `charge.updated` |
| New Stripe API uses | `refunds.list` (with `expand[]=data.balance_transaction`) and **`events.list`**. Both are reads on the existing secret key; no new key, no write API |
| `platform/settlementScan.refundEvents` | created by the first enabled sweeper pass: `cursor`, `page` (resume position), `lastRun` (counters **and** stop reason), `retentionGaps`, `lastRetentionGap` |
| `booking.settlementRefundState` | created per charge on the first refund reconciliation; it is coordination state, never money |
| Kill switch | one flag for everything, the backstop included: absent or false ⇒ no Stripe call and no write on either path (asserted by tests and by rehearsal step 8) |

## 3. Tests and rehearsal — what ran, and what did NOT

| Gate | Result |
|---|---|
| whitecross-site `functions` suite at the candidate (`npm test`, node:test) | **220/220 pass, 0 skipped** — re-run by the coordinator, not only reported. settlements 83 · stripeWebhook integration 8 · refunds 40 · externalCheckout 73 · loyaltyEnroll 16 |
| Race and fence tests | written **before** the implementation; 25 of them failed against the previous code |
| B1 parity | in-suite, against `git show 22850996:functions/settlements.js`: a booking that never had a refund produces byte-identical entries, projection, marker and scan cursor |
| salown-app reader compatibility | in-suite, against the pinned validator **and** the real `src/utils/settlementFacts.ts` |
| Local rehearsal — real Firestore emulator, real `stripeWebhook` handler and sweeper, real reader, **fake Stripe** | **8/8 steps pass**: `evidence/fin-processor-fees/2026-09-16-b1b-local-rehearsal/` (README, harness, scenario, full output) |
| **Stripe test-mode / staging rehearsal (real HTTP, real Stripe objects, real delivery)** | **NOT RUN.** Needs an owner approval — §6 |
| Live `amount_refunded` semantics (does it count a pending refund; does it drop when one fails) | **unverified** — not stated in Stripe's docs. The code never depends on it: completeness compares the snapshot with the recorded refunds |
| Composite-index behaviour of the due-pass query | unchanged from B1, which was rehearsed on `salown-staging` (`STAGING_PROJECT_PLAN.md` §10). The emulator does not enforce indexes |

## 4. The approval package — ordered steps (all with `--project havuz-44f70`)

0. **Same-day re-check** (§7). Stop if any identity moved.
1. **Indexes** — as in B1's §4 step 1. **B1b adds none.**
2. **Env** — record `WC_SETTLEMENT_START_ISO`; write `functions/.env.havuz-44f70` in the archive workspace.
3. **Stripe** — the owner records the live endpoint event list, then sets it to that list **plus `charge.updated`**,
   keeping the refund events.
4. **Functions** — from a `git archive` of `925debde`:
   `./scripts/deploy-functions.sh whitecross stripeWebhook wcSettlementSweeper`. Flag absent ⇒ both inert.
   Expected: a new `stripeWebhook` revision after `00106-dof`; confirmation and refund behaviour unchanged; the B1
   and B1b branches log `DISABLED`; `wcSettlementSweeper: pass complete { enabled: false, reason: 'DISABLED' }`; no
   `settlements` document anywhere; `platform/settlementScan` still absent.
5. ~~Rules~~ — already live (`5e102dd4-…`); only confirm the id is unchanged.
6. **Flag** — the owner sets `settlementLedgerEnabled: true` by the mechanism decided in B1's §2.

**LIVE_VERIFIED criteria, B1b's own:**
- the first enabled sweeper pass writes `platform/settlementScan.refundEvents` with a window, `advanced: true`, no
  `RETENTION_GAP`, and `lastRun.error: null`;
- the first live refund that occurs naturally — **no refund is issued to test this** — produces `REFUNDED` +
  `REFUND_FEE_ACTUAL`, a `settlementRefundState.<chargeId>` with `state: ok`, and `settledNetStatus: complete`;
- no booking money field changes on any of these paths; the refund reconcile's own fields behave exactly as before;
- no `refundReview` opens without a matching `recheck` history.

## 5. Rollback, per unit

B1's §5 applies unchanged: **flag false first** (new invocations inert at once; in-flight ones finish), then
`stripeWebhook` traffic back to `stripewebhook-00106-dof`, then delete `wcSettlementSweeper` and pause its job.
B1b adds nothing that needs its own rollback: `settlementRefundState`, `refundReview` and
`platform/settlementScan.refundEvents` are inert once the flag is off, and entries already written are correct
facts that stay.

## 6. The staging rehearsal package — prepared, NOT executed

B1 was rehearsed on `salown-staging` with real Stripe test-mode HTTP delivery (`STAGING_PROJECT_PLAN.md` §10).
B1b's webhook hook, the refund listing, the fence and the events backstop have **not** been exercised that way. The
package to approve, when wanted:
1. deploy `stripeWebhook` + `wcSettlementSweeper` from `925debde` to `salown-staging` (test-mode keys, its own
   endpoint secret, `WC_NONPROD_TEST_MODE=1`);
2. a test-mode payment, then a **test-mode partial refund** and a second refund with the endpoint enabled — the
   webhook path end to end, including a real `refund.updated` sequence;
3. the same with the endpoint disabled — the events backstop alone must recover both refunds and advance its cursor;
4. a kill-switch pass (flag false ⇒ no Stripe call, no write);
5. cleanup as in `STAGING_PROJECT_PLAN.md` §7 D.
This **deploys code and touches Stripe test mode**, so it needs an explicit owner approval. It is also the only way
to observe the real `amount_refunded` semantics and real delivery ordering.

## 7. Same-day re-check before "go" (read-only)

1. `git rev-parse origin/main` in whitecross-site and salown-app; if either moved, re-pin §1 and repeat the byte
   checks (`functions/` against the candidate; `firestore.indexes.json` against `9a9547a`).
2. Live identities, **which this work never read**: `stripeWebhook` revision and source generation, the function and
   scheduler inventory, the rules release id, the index list, and that the flag is still absent.
3. The Stripe endpoint event list (owner, Dashboard).
4. Re-run the suite and the local rehearsal against the pinned candidate; both must reproduce §3.

## 8. Out of scope, kept separate

Automatic refunds (BL-4) — separate lane, separate approval. B2 P&L / Bank Balance / fee-day — waits on the owner's
open date decisions and on the T18 write-once first-checkout time, which does not exist yet. B3 history backfill —
the only way to close a `RETENTION_GAP` older than Stripe's 30-day event retention.

## 9. Known gaps of this candidate

1. **Stripe read consistency is not guaranteed by anything we can build.** The fence orders *our* writers; if Stripe
   returns a stale read, the contradiction is detected against the triggering event, goes to bounded recheck and
   then to review. It is never silently accepted.
2. **Retention:** events older than 30 days cannot be recovered by the backstop; the span is recorded as
   `RETENTION_GAP` and only a B3-style backfill could close it. A flag-off or outage period longer than that
   becomes such a gap.
3. **Unmatched:** an event whose charge resolves to no booking (or to two) waits in the unmatched queue.
4. **Before the start boundary:** refunds on charges created before `WC_SETTLEMENT_START_ISO` are out of scope and
   write nothing.
5. **Truncated refund list:** a charge with more refunds than the page budget records no snapshot and stays pending
   rather than recording a partial one.
6. Some documented status transitions (notably `succeeded → requires_action`) come from Stripe's public docs, not
   from a test against the API. They are used only as a health check, never to order anything.
