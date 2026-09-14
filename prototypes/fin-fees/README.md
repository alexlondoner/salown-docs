# FIN-FEES — local Finance fee prototype (synthetic data)

> **Status: design prototype for owner review (2026-09-14). Not a product change, not approved, not deployed.**
> Work IDs: `FIN-PROCESSOR-FEES` B1b / B2. Draft it renders: [`../../FIN_FEES_UX_DRAFT.md`](../../FIN_FEES_UX_DRAFT.md).
> Status evidence: [`../../evidence/fin-processor-fees/2026-09-14-status-audit.md`](../../evidence/fin-processor-fees/2026-09-14-status-audit.md).
> Screenshots: [`../../evidence/fin-processor-fees/2026-09-14-prototype/`](../../evidence/fin-processor-fees/2026-09-14-prototype/).

## What it is

A standalone React page that reproduces the **current** Finance screen's design tokens and section shapes
(`salown-app/src/pages/Finance.tsx`) and adds the fee display proposed by the draft, over **invented** data.
It connects to nothing: no Firebase, no Stripe, no production reader, no network except Google Fonts.

It is **not** B2. A real B2 must be built inside `salown-app/src` on B1's `settlementProjection`, with parity
tests, after the owner decides the open questions below. Nothing here may be copied into the product as data.

## Two layers

| Layer | Where | Content |
|---|---|---|
| **Product copy** | the Finance frame | only what an owner would read: fee confirmed / awaiting Stripe / no fee record, "up to" figures with what is missing, refunds and the fee Stripe keeps, duplicate charge, closed month and a later refund |
| **Design notes** | dashed teal "DESIGN NOTE" boxes, off by default; switch in the dark prototype bar or `?notes=1` | which assumption placed a number, what is unchanged from today, what is an open decision, what needs B1b |

The dark bar at the top is prototype chrome, not part of the product.

## Assumptions (undecided — review, do not treat as rules)

- **Fee day:** switchable between service day and payment day (`?fee=service|payment`). **No decision has been made.**
- **Revenue** follows today's Finance contract: checked-out sales on the service day; it never moves with fees.
- **Refunds** are displayed from Stripe. Today's Finance does not read refunds, so revenue is not reduced; refunds on
  checked-out sales are raised for review. How revenue should treat them is an open decision.
- **Closed months** keep their stored figures; later facts are listed, never added. Only the existing super-admin post-close
  adjustment (`FIN_PERIOD_CLOSE_DESIGN.md` §8) could change one; the prototype performs none.
- **Unknown fees** are never £0; totals that depend on them are shown as "up to".
- **Payouts** are not recorded; nothing is presented as bank money. Bank Balance is today's card and formula, unchanged.
- Fee tracking start (synthetic) 2026-09-05 09:00 UTC; "as of" 2026-09-14 16:00. Fee amounts are illustrative, not Stripe pricing.

## Synthetic scenarios (`app/data.ts`)

| Ref | State |
|---|---|
| W-01 | fee confirmed, paid in full online |
| W-02 | fee confirmed, deposit online + card at the desk |
| W-03 | fee awaiting Stripe |
| W-04 | no fee record (paid before fee tracking) |
| W-05 | no fee record, deposit paid in a closed month, service in the open month |
| W-06 | partial refund after checkout, fee kept by Stripe |
| W-07 | cancelled and fully refunded, never checked out, fee kept by Stripe |
| W-08 | charged twice — review |
| W-09 | refund in September for a sale in closed August |

## Run it

Requires the canonical `salown-app` checkout next to `docs/` (for `node_modules` and `src/index.css`). Nothing in either
repo is written; the workspace goes to `$TMPDIR/salown-fin-fees-proto` and is rebuilt on every run.

```bash
cd docs/prototypes/fin-fees
./run.sh check                     # typecheck + model tests (6)
PROTO_PORT=5288 ./run.sh serve     # http://127.0.0.1:5288/ — refuses a port that is already in use
```

**Before `serve`:** pick a free port (never 5173 — the shared salown-app dev server) and make sure no emulator run
or other session needs the memory. Stop it with Ctrl-C.

### Review URLs (append to `http://127.0.0.1:<port>/`)

| Screen | Query |
|---|---|
| Daily Ledger | `?month=2026-09&tab=daily&fee=service` |
| Daily Ledger, payment-day assumption | `?month=2026-09&tab=daily&fee=payment` |
| Fee states (confirmed / awaiting / no record) | `?month=2026-09&tab=online&only=W-01,W-03,W-04&focus=tabs` |
| Partial and full refund | `?month=2026-09&tab=online&only=W-06,W-07&focus=tabs` |
| Duplicate charge | `?month=2026-09&tab=online&only=W-08&focus=review` |
| Closed month + later refund | `?month=2026-08&tab=daily` |
| Any screen with design notes | add `&notes=1` · dark theme: add `&theme=dark` |

`only` and `focus` are review aids of the prototype, not product features.

## Files

| File | Role |
|---|---|
| `app/model.ts` | pure derivations: fee coverage, revenue (today's contract), daily rows, Stripe activity, review items |
| `app/data.ts` | synthetic dataset (integer pence) |
| `app/model.test.ts` | pins: unknown fee ≠ 0, revenue independent of fees/assumption, closed month never receives a fee, upper bounds |
| `app/App.tsx` | the screen; product copy and design notes kept apart |
| `app/main.tsx`, `app/index.html`, `app/tsconfig.json` | entry and typecheck config |
| `vite.proto.config.js` | local-only Vite config (127.0.0.1, strictPort, workspace-local cache) |
| `run.sh` | builds the throw-away workspace and runs `check` or `serve` |
