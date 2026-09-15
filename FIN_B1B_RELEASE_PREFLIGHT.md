# FIN-B1b RELEASE PREFLIGHT — refund entries + hardening (DRAFT, candidate not final)

> Sibling of `FIN_B1_RELEASE_PREFLIGHT.md`, which stays the authority for the **B1** release pinned at
> whitecross-site **`22850996`**. That pin does not move. This file prepares a **separate, later** release of a
> candidate that also contains B1b and its hardening.
>
> **Status 2026-09-16: DRAFT.** No deploy, no production read, no Stripe call has happened for it. The candidate
> below is not final: `FIN-B1B-RECENCY` (observation recency by happens-after instead of status order) is still in
> progress, and the local rehearsal is re-run against the final source before this file leaves draft.

## 0. What this release would ship, and what it would not

**Ships (on top of B1):**
- refund entries — `REFUNDED` `stripe:re_<id>` for succeeded refunds, with the refund's own fee in its own
  `REFUND_FEE_ACTUAL` `stripe:txn_<id>` entry (unknown fee ⇒ no entry, never 0);
- `REFUND_OBSERVED` entries — one per complete refund listing, the only source of refund completeness;
- automated corrections `comp:<compensatesEntryId>:<REASON>` for a refund that failed or was canceled after it was
  recorded;
- a hook in the existing BL-5 refund block of `stripeWebhook` so refund events reach the ledger at all;
- **new scope:** a Stripe **Events API backstop** inside `wcSettlementSweeper` for lost refund webhooks, with its own
  persisted cursor and resume position in `platform/settlementScan.refundEvents`.

**Does not ship:** any screen; any P&L, Bank Balance or fee-day behaviour; any refund *action* (the module never
calls `refunds.create`); any change to confirmation or refund-reconcile behaviour (the hook only adds a swallowed
ledger call before the same 200 responses).

## 1. Source selection — candidate

| Unit | Live now (last recorded, **must be re-read before go**) | Candidate | Delta |
|---|---|---|---|
| `stripeWebhook` (us-central1, gen2) | revision `stripewebhook-00106-dof`, bundle = whitecross-site `6817356f` (recorded 2026-09-14; **not re-read for this draft — no production access in this work**) | **pending final `FIN-B1B-RECENCY` commit** (after `ecd029ab`) | B1 + B1b + hardening; `functions/index.js` differs from `22850996` only by the refund-block hook |
| `wcSettlementSweeper` | does not exist | same commit | new function + Scheduler job, now also running the events backstop |
| Firestore indexes | 2 composite READY + the file-only B1 `settlementSync` index | salown-app `b6c325c` (unchanged by B1b) | **no new index**: B1b adds no query — verified by reading every `.where`/`.orderBy` in the diff |
| Firestore rules | ruleset `5e102dd4-…` (B1's arm already live) | none | no rules change |

## 2. Env, flag and Stripe readiness

Everything in `FIN_B1_RELEASE_PREFLIGHT.md` §2 still applies (env file in the archive workspace,
`WC_SETTLEMENT_START_ISO` chosen once, the kill switch `settlementLedgerEnabled`, the endpoint event list). On top of
it, for B1b:

| Item | Requirement |
|---|---|
| Live endpoint event list | B1 needs `charge.updated` added. B1b's webhook path additionally needs the refund events the endpoint already carries (`charge.refunded`, `refund.updated`). **Owner re-reads and records the list; Stripe replaces the whole list on update.** |
| Stripe API surface | New calls: `refunds.list` (with `expand[]=data.balance_transaction`) and **`events.list`**. Both are reads. The secret key already permits them; no restricted key is introduced by this release |
| `platform/settlementScan.refundEvents` | created by the first enabled sweeper pass; carries `cursor`, `page`, `retentionGaps`, `lastRun` |
| Kill switch | one flag for everything, including the backstop: with it absent or false, no Stripe call and no write happens on either path |

## 3. Tests and rehearsal — what ran, and what did NOT

| Gate | Result |
|---|---|
| whitecross-site `functions` suite | *(filled in from the final candidate)* |
| Local rehearsal — real Firestore emulator, real `stripeWebhook` handler and sweeper, real salown-app reader, **fake Stripe** | *(filled in from the final candidate)* |
| salown-app reader compatibility | asserted in the suite against `readProjection` and the real `settlementFacts.ts` |
| B1 parity | asserted in the suite against `git show 22850996:functions/settlements.js` for bookings that never had a refund |
| **Stripe test-mode / staging rehearsal (real HTTP, real Stripe objects)** | **NOT RUN — needs owner approval.** §6 prepares it |
| Live `amount_refunded` semantics (does it count a pending refund; does it drop when one fails) | **unverified** — not stated in the docs; the code avoids depending on it |

**The local rehearsal is not a Stripe or staging verification.** It proves the wiring, the ledger arithmetic and the
reader contract against a scripted Stripe double — nothing about Stripe's real behaviour, delivery or timing.

## 4. The approval package — ordered steps

Same shape as `FIN_B1_RELEASE_PREFLIGHT.md` §4, with B1b's additions:

0. Same-day re-check (§7): every identity in §1 re-read; stop if anything moved.
1. Indexes — unchanged from B1 (**no new index for B1b**).
2. Env values.
3. Stripe endpoint event list: record it, then set it to the recorded list **plus `charge.updated`**, keeping the
   refund events.
4. Targeted functions deploy: `./scripts/deploy-functions.sh whitecross stripeWebhook wcSettlementSweeper`, flag
   absent ⇒ both inert.
5. Flag `true` by the mechanism decided in B1's §2.
6. **First live checks specific to B1b:** the first sweeper pass after the flag logs a `refundEvents` window with
   `advanced: true` and no `RETENTION_GAP`; `platform/settlementScan.refundEvents.cursor` moves; a real refund (the
   first one that occurs naturally — **no refund is issued for the test**) produces `REFUNDED` +
   `REFUND_FEE_ACTUAL` + `REFUND_OBSERVED` and `settledNetStatus: complete`.

## 5. Rollback

B1's §5 applies unchanged (flag false first; `stripeWebhook` traffic back to `stripewebhook-00106-dof`; delete
`wcSettlementSweeper`; entries already written are correct facts and stay). B1b adds nothing that needs a separate
rollback: `platform/settlementScan.refundEvents` is inert once the flag is off, and no booking money field is ever
written by this path.

## 6. The staging rehearsal package — prepared, NOT executed

B1 was rehearsed on the `salown-staging` project with real Stripe test-mode HTTP delivery
(`STAGING_PROJECT_PLAN.md` §10). B1b's webhook hook, the refund listing and the events backstop have **not** been
exercised that way. The package to approve, when wanted:
1. redeploy `stripeWebhook` + `wcSettlementSweeper` from the candidate to `salown-staging` (test-mode keys, its own
   endpoint secret, `WC_NONPROD_TEST_MODE=1`);
2. a test-mode payment, then a **test-mode partial refund** and a second refund, with the endpoint enabled — checks
   the webhook path end to end;
3. the same again with the endpoint disabled — checks that the events backstop alone recovers both refunds, and that
   the cursor advances;
4. a kill-switch pass (flag false ⇒ no Stripe call, no write);
5. cleanup as in `STAGING_PROJECT_PLAN.md` §7 D.
Cost and controls are unchanged from that plan. **This needs an explicit owner approval — it deploys code and
touches Stripe test mode.**

## 7. Same-day re-check before "go" (read-only)

1. `git rev-parse origin/main` in whitecross-site and salown-app; if either moved, re-pin §1 and repeat the byte
   checks (`functions/` vs the candidate; `firestore.indexes.json` vs `9a9547a`).
2. Live identities: `stripeWebhook` revision and source generation, function and scheduler inventory, rules release
   id, index list, flag absent.
3. The Stripe endpoint event list (owner, Dashboard).
4. Re-run the local rehearsal against the pinned candidate; it must reproduce §3 exactly.

## 8. Out of scope, kept separate

Automatic refunds (BL-4) — a separate lane. B2 P&L / Bank Balance / fee-day work — waits on the owner's open date
decisions and on T18. B3 history backfill — the only way to close a `RETENTION_GAP` older than 30 days.
