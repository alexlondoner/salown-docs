# FIN-B1 — production release preflight (2026-09-09, read-only; NOT a release)

*Prepared after the staging rehearsals (`STAGING_PROJECT_PLAN.md` §10). Nothing was deployed, no setting,
subscription or production document was changed. This page fixes the release candidates and the approval
package; the release itself needs the owner's separate approval.*

## 1. Source selection — what is live, what is tested, what would ship

| Unit | Live today (verified read-only) | Tested on staging | Candidate | Delta candidate − live |
|---|---|---|---|---|
| `stripeWebhook` (us-central1, gen2) | bundle `gcf-v2-sources-…/stripeWebhook/function-source.zip`, updated 2026-08-28T23:50Z; its `index.js`, `externalCheckout.js`, `refunds.js`, `emailParsers.js`, `package.json` are **byte-identical to commit `6817356f`** (BL-4/BL-5) — so the BL-5 R1 refund branch is already live | whitecross-site `8137711b` | **whitecross-site `a5da93d4`** (= origin/main; `functions/` byte-identical to `8137711b`, the two later commits touch only a claim file) | `index.js` +99 lines in 3 hunks (require, settlement branch, sweeper) + new `settlements.js`. **Live `index.js` == `8137711b~1`**, so the deploy carries B1 and nothing else from any session |
| `wcSettlementSweeper` (new) | does not exist | same | same | new function + Cloud Scheduler job `every 15 minutes` |
| Firestore indexes | 2 composite indexes (`barberId+startTime`; CG `source+status+expiresAt`) | salown-app `9a9547a` | **salown-app `8bb05ad`** (= origin/main; `firestore.indexes.json` and `firestore.rules` identical to `9a9547a`) | **+1** index (`settlementSync.state ASC, settlementSync.nextAttemptAt ASC`); live-not-in-file = none → no deletion is offered |
| Firestore rules | ruleset `a0a10819-3b62-46d5-9f95-9ea048701c59` (released 2026-08-30T01:27Z) — **byte-identical to commit `5a3ecdd`** | `9a9547a` (rules emulator 221/221 incl. B1 35) | file at `8bb05ad` | live→candidate: **0 lines removed, 153 added** = `edfa6e7` (+138, `[COA] CHECKOUT-OVER-ALLOCATION`, GTM gate A3, **another session's change, `PUSHED_NOT_LIVE`**) + `9a9547a` (B1: 4 arms extended with `settlementLedgerEnabled`, +11 comment lines). `autoRefundEnabled` arms: live 5 → candidate 6 (comment), all four arms intact |

No source change is required for the tested B1 behaviour: staging ran the same bytes that `a5da93d4` carries.

## 2. Coupling that needs a decision (not a code problem)

**Rules — owner decision 2026-09-09: path R-a.** COA is released and verified separately by its owner first;
B1's deploy does not start before that. This decision is not a release approval for COA either. The alternatives
considered were:
- **(R-a) COA first, by its owner** — release rules from `edfa6e7` (their own release, their own ledger row),
  then B1's rules release from `8bb05ad` is a pure B1 delta (4 arms + comments). **Chosen.**
- **(R-b) Joint release** from `8bb05ad`, recorded as one ruleset release carrying both, with the COA owner's
  explicit acknowledgment in the ledger row. COA is additive (0 lines removed), has its own emulator suite
  (`checkoutOverAllocation.emulator.test.js`, registered) and ROADMAP already lists it as `PUSHED_NOT_LIVE`.
- Not acceptable: hand-editing a rules file that matches no commit (deploy from a dirty/uncommitted state).

Consequences of R-a for this plan: (i) B1's rules rollback target is **the verified live ruleset immediately
before the B1 rules release** — i.e. the ruleset COA's owner released and verified — never `a0a10819-…`, which
would silently revert COA; its id is recorded at step 5 of §4 before B1's rules deploy. (ii) After COA is live,
only two things are re-checked before B1 (§5); the staging rehearsals are not repeated.

**Deploy wrapper lists.** `whitecross-site/scripts/deploy-functions.sh` classifies money functions
(`CHECKOUT_FNS` / `REFUND_FNS`); `wcSettlementSweeper` is in neither. It is accepted (name regex) and deployed,
and the live-key guard still runs because `stripeWebhook` is in the same command. It reads the live key but
moves no money. Follow-up (not a blocker): add a read-only class for it so the guard and the checklist know the
name.

## 3. Env and flag readiness (values not shown)

| Item | State | Release action |
|---|---|---|
| Secrets in `havuz-44f70` | `WC_STRIPE_SECRET_KEY` (1 enabled version), `STRIPE_WEBHOOK_SECRET` (versions 1, 2 enabled), `WC_STRIPE_TEST_SECRET_KEY` (1), `STRIPE_TEST_WEBHOOK_SECRET` (1) — all four names the two functions declare exist | none |
| `WC_NONPROD_TEST_MODE` | not present on the live function (env names: only the platform's) | **must stay absent** — the production env file below must not contain it |
| B1 trusted config | not yet on the live function | create `functions/.env.havuz-44f70` **in the isolated workspace only** (gitignored pattern `.env.*`; never a bare `.env`) with `WC_STRIPE_ACCOUNT_ID=acct_1T3CrpRfgDnpYJzP` (the Whitecross Stripe account; the same id in test and live mode — a wrong id produces `ACCOUNT_MISMATCH` refusals and **no writes**), `WC_STRIPE_LIVEMODE=true`, `WC_SETTLEMENT_START_ISO=<chosen once>` |
| `WC_SETTLEMENT_START_ISO` | to be chosen by the owner, once | **A single UTC instant recorded immediately before the release starts** (e.g. `date -u +%Y-%m-%dT%H:%M:%SZ` at step 2, written into the env file and into the ledger row), not rounded back to midnight or any earlier time. Captures between deploy (flag off) and flag-on are not lost: the provider scan starts at this origin after the flag opens. Never changed on a redeploy (`PROCESSOR_FEES_PLAN.md` §8) |
| Kill switch `tenants/whitecross/settings/settings.settlementLedgerEnabled` | **absent** (read-only check; `autoRefundEnabled` also absent) | set `true` only at step 6 |
| `tenants/whitecross/platform/settlementScan` | **absent** (404) | created by the first enabled sweeper pass |
| Live Stripe endpoint events | **not verified** — the live key was not used in this preflight | at step 3 the owner first **records the endpoint's current event list** (Dashboard, live mode; endpoint id + events, into the ledger row), then **adds** `charge.updated` **keeping every existing event**; `charge.succeeded` is expected to be present already (confirmation path). Unhandled types return 200, so adding early is harmless |
| Scheduler | 4 jobs in us-central1 today (`wcRefundSweeper` every 10 min among them) | +1 job created by the deploy |

## 4. The approval package (one decision; production release not yet approved)

**Sources (pinned, as of the latest §6 re-check):** whitecross-site **`d7c5822a`** (functions), salown-app **`f6b869a`** (indexes, rules).
Both are origin/main at the time of the re-check; if either moves before release, re-run §1's byte checks against the new head (§6 records each re-pin).

**Workspaces:** `git archive` of each SHA into a scratchpad directory; whitecross-site needs `.firebaserc`
(gitignored — copy from the repo) and `functions/node_modules` (symlink) for the CLI to load the code, plus the
env file of §3; the deploy uploads source only.

**Ordered commands (all with explicit `--project havuz-44f70`):**
1. Indexes — salown-app workspace: `firebase deploy --only firestore:indexes --project havuz-44f70`. Expected: creates 1 index, offers no deletion; **answer No to any deletion prompt.** Wait `READY` (`gcloud firestore indexes composite list --project havuz-44f70`).
2. Env — record the UTC instant now (`date -u +%Y-%m-%dT%H:%M:%SZ`) as `WC_SETTLEMENT_START_ISO`; write `functions/.env.havuz-44f70` in the whitecross-site workspace (§3). Confirm no `WC_NONPROD_TEST_MODE` line. This value is final.
3. Stripe — owner records the live endpoint's current event list, then adds `charge.updated` to it (Dashboard, live mode). No event removed, no other endpoint change.
4. Functions — whitecross-site workspace: `./scripts/deploy-functions.sh whitecross stripeWebhook wcSettlementSweeper` (wrapper: rules-authority guard, live-key guard, `--only functions:whitecross:stripeWebhook,functions:whitecross:wcSettlementSweeper`, post-deploy key guard). Flag absent ⇒ both inert. Expected logs: `stripeWebhook` unchanged behaviour on live events (`settlement not recorded — left to the sweeper` / `DISABLED` on the B1 branch); `wcSettlementSweeper: pass complete { enabled: false, reason: 'DISABLED' }` every 15 min; no `settlements` subcollection anywhere; `platform/settlementScan` still absent.
5. Rules — precondition: COA is live and verified by its owner (§5 re-check done). **Record the live ruleset id at this moment as B1's rules rollback target.** Then `firebase deploy --only firestore:rules --project havuz-44f70` from the salown-app workspace; then **read-only verification**: fetch `projects/havuz-44f70/releases/cloud.firestore` → ruleset → compare content byte-for-byte with the committed file (the method used in this preflight); confirm `autoRefundEnabled` still on all four arms, `settlementLedgerEnabled` on all four, and the COA block unchanged. No writes as staff/owner in production.
6. Flag — owner sets `settlementLedgerEnabled: true` (owner account; staff must be refused by the rules).

**What to observe after the flag opens (LIVE_VERIFIED criteria):**
- next sweeper pass: `pass complete { enabled: true, configOk: true, scan: { from: <START_ISO>, … advanced: true } }`, `platform/settlementScan` created, `refused: 0`, no `ACCOUNT_MISMATCH`;
- first live capture after the flag: `stripeWebhook[B1] settlement recorded { created: ['stripe:ch_…', 'stripe:txn_…'], feeSource: 'actual' }` (or `estimate` first and `actual` on `charge.updated`), booking `settlementSync.state = done`, projection `gross_m` = charge amount, `fee_m` = Stripe fee;
- a capture whose webhook Stripe delays is picked up by the scan within 15 min (`recordedBy: wcSettlementSweeper:scan`);
- nothing else on the booking changes (confirmation fields untouched); Finance UI unchanged (no consumer yet).

**Rollback, per unit (from `PROCESSOR_FEES_PLAN.md` §8, made concrete):**
- *Stop first, always:* owner sets the flag `false` → new invocations inert at once; wait two scheduler intervals and confirm no new entry/marker.
- *`stripeWebhook`:* redeploy from a `git archive` of **`6817356f`** (byte-identical to today's live bundle, proven above) with `./scripts/deploy-functions.sh whitecross stripeWebhook`. Confirmation behaviour is unaffected either way (the B1 branch is after the confirmation and swallows its own errors).
- *`wcSettlementSweeper`:* pause the Cloud Scheduler job, then `firebase functions:delete wcSettlementSweeper --project havuz-44f70` (the job goes with it). There is no earlier revision.
- *Rules:* re-release **the ruleset recorded at step 5** (the verified live ruleset immediately before B1's rules release, which already carries COA) — only if the rules release itself misbehaves; the B1 arms cannot loosen anything (0 lines removed). `a0a10819-…` is **not** a rollback target any more: it predates COA and would revert it.
- *Stripe endpoint:* leave the subscription as it is. `charge.updated` is harmless to any deployed handler (200 on unhandled types) and the events that existed before step 3 are never removed as part of a B1 rollback.
- *Indexes:* leave in place (inert). Written entries are correct facts and stay.

**Remaining concrete items before the owner can say "go":**
1. COA released and verified by its owner (path R-a); its live ruleset id known.
2. §5 re-check after COA (below).
3. At release time: the START_ISO instant (step 2) and the recorded endpoint event list (step 3).

## 5. Re-check after COA is live (limited; no staging repeat)

Only these two, read-only:
1. **Rules delta** — fetch the live ruleset (must match the COA owner's released commit byte-for-byte), diff it
   against `firestore.rules` at the B1 candidate SHA: expected **exactly** the B1 delta (4 arms extended with
   `settlementLedgerEnabled` + comment lines, 0 lines removed). Anything else ⇒ stop and re-select the candidate.
2. **Source state** — `origin/main` heads of both repos versus the pinned candidates (`a5da93d4`, `8bb05ad`): if
   either moved, repeat §1's byte checks (`functions/` and `firestore.indexes.json` identical to the tested
   commits; live `index.js` still `== 8137711b~1`). No new rehearsal unless those checks fail.

Hosting is out of scope. No production deploy is approved by this page.

## 6. Re-check log

### 2026-09-09 (after alish-83 closed; COA still not released)
- **Live ruleset unchanged:** `a0a10819-…` == `5a3ecdd`; COA absent; `autoRefundEnabled` 5; `settlementLedgerEnabled` 0.
  No COA release row in the ledger. R-a precondition not met — B1's rules step (and therefore the flag) stays blocked.
- **Source heads moved; candidates re-pinned (read-only byte checks):**
  - whitecross-site origin/main **`d7c5822a`** (was `a5da93d4`). In between: WC-LOYALTY-ENROLL-PII (`21b51b9e`,
    `e40f2f32`, **live** as `enrollloyalty-00063-qil` / `wcloyaltylookup-00002-pec`, R-2026-09-09-A) and the
    REL-12 hosting anchor. `functions/index.js` hunks `a5da93d4→d7c5822a` lie only in `sendLoyaltyCardEmail` /
    `enrollLoyalty` (lines ~2426–2477) plus new `loyaltyEnroll.js`. The `stripeWebhook` body (642 lines), the
    `wcSettlementSweeper` body (24 lines), `settlements.js`, `externalCheckout.js`, `refunds.js`, `package.json` are
    **byte-identical** between `8137711b` and `d7c5822a`. The live `stripeWebhook` bundle is still the `6817356f`
    one (updateTime 2026-08-28T23:50Z). Functions suite at `d7c5822a`: **182/182** (B1 166 + loyalty 16).
    → **New functions candidate: `d7c5822a`.** `a5da93d4` is retired: it predates the live loyalty fix, so a bundle
    built from it would no longer match the code that is live in the other functions of this codebase.
  - salown-app origin/main **`f6b869a`** (was `8bb05ad`): `firestore.rules` and `firestore.indexes.json` unchanged
    since `9a9547a`. → **New indexes/rules candidate: `f6b869a`** (same files as before).
- Everything else in §3/§4 stands. Before release, repeat this §5 check once more against the heads of that day.
