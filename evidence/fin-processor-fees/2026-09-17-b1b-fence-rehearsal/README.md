# B1b fence rehearsal — 2026-09-17

Candidate: whitecross-site **`925debde`** (`FIN-B1B-RECENCY`). Written and run by the implementing session; the
script, its output and the emulator config are committed here so the evidence outlives the session scratchpad.

**Why it exists, next to the scenario rehearsal.** The unit suite drives a hermetic Firestore fake, and
`2026-09-16-b1b-local-rehearsal/` walks the product scenarios (webhook refund, lost-webhook recovery through the
events backstop, a pending refund, a cancellation, a refund that failed after succeeding, replay, kill switch). The
generation fence, though, is a claim about **real** transaction semantics: a read taken outside the transaction, a
re-check inside it, and two writers contending on one document. That is what this run exercises against the real
Firestore engine.

## Result — 7/7

| # | Scenario | Result |
|---|---|---|
| 1a | race, fresh read commits first | the stale worker is fenced and writes **nothing** |
| 1b | race, stale read commits first | the newer worker is fenced; the work is redone from a fresh read |
| 1c | genuinely parallel race | exactly one reconciliation wins; the refund is recorded once |
| 2 | fencing after an **unchanged** snapshot | the generation still advances, so a slow worker cannot slip in |
| 3 | retry exhaustion | no partial write, a durable `REFUND_FENCED` marker, then the sweeper's due pass completes it |
| 4 | two charges on one booking | independent generations; `gross_m` 6400 and `refunded_m` 1500 both kept |
| 5 | `pending → succeeded` | completes with **no** review flag and no human step |

Full output, including the persisted document shape: `rehearsal-output.txt`.

## What it does not prove

Stripe is entirely faked — no Stripe API, test mode or live, was contacted. It says nothing about real webhook
delivery or ordering, composite indexes (the emulator does not enforce them), the Cloud Scheduler, live mode, or any
production behaviour. The staging rehearsal with real Stripe test-mode deliveries is still unrun and needs owner
approval: `FIN_B1B_RELEASE_PREFLIGHT.md` §6.

## Where the runnable copy lives

The same rehearsal was afterwards committed **next to the code it exercises**, in whitecross-site
`ops/rehearsal/` (`settlements-fence.rehearsal.js`, its own README, the emulator config and
`evidence/2026-09-17-925debde.txt`). That copy is the one to run and to keep in step with the module; the files here
are the frozen artefact of the 2026-09-17 run, kept with the rest of this work stream's evidence.

## Re-running

```bash
# canonical copy, repo-relative paths:
cd whitecross-site && firebase emulators:exec --only firestore --project demo-b1b-recency \
  'node ops/rehearsal/settlements-fence.rehearsal.js'

# or the frozen copy here, against a checkout of 925debde:
firebase emulators:start --only firestore --project demo-b1b-recency   # emulator-firebase.json, port 8099
node rehearse.js
```
