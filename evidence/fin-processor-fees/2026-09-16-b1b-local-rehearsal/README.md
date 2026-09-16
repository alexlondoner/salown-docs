# B1b local rehearsal — 2026-09-16

Candidate: whitecross-site **`925debde`** (`FIN-B1B-RECENCY`; `functions/settlements.js` sha256 `61e1ebb4764eb983…`,
byte-identical to the file the run loaded).

## What is real here, and what is not

| Real | Faked / not covered |
|---|---|
| `functions/index.js` as deployed would run it: the real `stripeWebhook` handler and the real `wcSettlementSweeper` scheduled handler | The Stripe client — a scripted double (`settlements.fakes.js`). **No Stripe API, test mode or live, was contacted** |
| Stripe signature verification (the real SDK signs and verifies each request) | Real webhook delivery, retries and ordering |
| The **Firestore emulator**: real transactions, real `Timestamp`, real document semantics | Firestore rules (the Admin SDK bypasses them), composite-index enforcement (the emulator does not enforce), production data |
| salown-app's real reader `src/utils/settlementFacts.ts`, imported and run over every projection | Any Finance/P&L behaviour — untouched by B1b |

**This is not a Stripe test-mode or staging verification.** It proves the wiring, the ledger arithmetic, the fence
and the reader contract against a scripted double. The staging package is prepared but not executed —
`FIN_B1B_RELEASE_PREFLIGHT.md` §6.

## Steps and results (`rehearsal-output.jsonl`, one JSON object per step)

| # | Step | Result |
|---|---|---|
| 1a | capture with no balance transaction | `CAPTURED` only, fee `null`, marker `FEE_PENDING`, reader `pending` |
| 1b | `charge.updated` brings the fee | `FEE_ACTUAL`, projection `fee_m 68`, reader `known` / `exact` |
| 2 | partial refund `re_1` by webhook | `REFUNDED` + `REFUND_FEE_ACTUAL`, snapshot generation 1 `ok`, `settledNetStatus: complete`, `refunded_m 1000` |
| 3 | **lost webhook**: `re_2` never delivered | the **events backstop** found it from `refund.created`: `refunded_m 1600`, still `complete`, generation 2 |
| 4 | a **pending** `re_3` appears, no new refund entry | completeness drops to `refunds_not_recorded`, marker `REFUND_PENDING`, `refunded_m` stays 1600 — the defect this work fixed |
| 5 | `re_3` canceled | `complete` again, and `re_3` never gets a `REFUNDED` entry |
| 6 | `re_1` fails after having succeeded | `comp:stripe:re_1:REFUND_FAILED`, `refunded_m 600`, `complete` |
| 7 | replay: the same webhook and another sweep | no new entries, projection `version` unchanged; the generation advances (coordination state, not money) |
| 8 | kill switch off | zero Stripe calls, zero writes |

Final projection: `gross_m 3200`, `fee_m 68`, `refunded_m 600`, `settledNet_m 2532`, `settledNetStatus complete`.
Reader: accepted at every step.

## How to re-run

```bash
# 1. Firestore emulator on a demo project (no rules needed; the Admin SDK bypasses them)
cd <scratch>/emu-b1b && JAVA_HOME=/opt/homebrew/opt/openjdk \
  firebase emulators:start --only firestore --project demo-salown-b1b

# 2. a git-archive workspace of the candidate, with functions/node_modules symlinked
git -C whitecross-site archive 925debde | tar -x -C <scratch>/b1b-candidate

# 3. the rehearsal
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 \
REHEARSAL_FUNCTIONS_DIR=<scratch>/b1b-candidate/functions \
REHEARSAL_READER_TS=file:///…/salown-app/src/utils/settlementFacts.ts \
node scenario.cjs
```

`harness.cjs` refuses to run unless `FIRESTORE_EMULATOR_HOST` is the local emulator, the workspace is not a repo
checkout, and no secret or env file is present in it.

## Two notes about the harness, for the next person

- `wcSettlementSweeper.run()` returns **nothing**: the firebase-functions wrapper discards the handler's return
  value, so a pass is measured from what it persisted (`platform/settlementScan.refundEvents.lastRun`).
- The backstop only scans up to `now − lag`, so straight after a catch-up there is no scannable span and a
  rehearsal would have to idle out the lag. The scenario rewinds the persisted cursor a few minutes before a
  backstop step, which reproduces the normal state between two 15-minute passes. That rewind is a **fixture**, not
  production behaviour.
