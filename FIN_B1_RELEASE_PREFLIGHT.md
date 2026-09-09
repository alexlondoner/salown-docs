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

**Rules.** The only committed rules file that contains the B1 guard also contains the COA guard from
`edfa6e7`. Releasing rules from `8bb05ad` therefore puts COA live at the same time. Two clean ways, owner's call:
- **(R-a) COA first, by its owner** — release rules from `edfa6e7` (their own release, their own ledger row),
  then B1's rules release from `8bb05ad` is a pure B1 delta (4 arms + comments). Recommended.
- **(R-b) Joint release** from `8bb05ad`, recorded as one ruleset release carrying both, with the COA owner's
  explicit acknowledgment in the ledger row. COA is additive (0 lines removed), has its own emulator suite
  (`checkoutOverAllocation.emulator.test.js`, registered) and ROADMAP already lists it as `PUSHED_NOT_LIVE`.
- Not acceptable: hand-editing a rules file that matches no commit (deploy from a dirty/uncommitted state).

Until the rules release happens, the flag stays off (B1 order: rules before flag), so B1 functions can be
deployed inert now regardless of which rules path is chosen.

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
| `WC_SETTLEMENT_START_ISO` | to be chosen by the owner, once | Recommendation: the release day at `00:00:00Z`. Captures between deploy (flag off) and flag-on are not lost: the provider scan starts at this origin after the flag opens. Never moved on a redeploy (`PROCESSOR_FEES_PLAN.md` §8) |
| Kill switch `tenants/whitecross/settings/settings.settlementLedgerEnabled` | **absent** (read-only check; `autoRefundEnabled` also absent) | set `true` only at step 6 |
| `tenants/whitecross/platform/settlementScan` | **absent** (404) | created by the first enabled sweeper pass |
| Live Stripe endpoint events | **not verified** — the live key was not used in this preflight | owner enables `charge.updated` on the live endpoint (Stripe Dashboard, live mode) at step 3; `charge.succeeded` is assumed present (confirmation path) — verify both in the same screen. Unhandled types return 200, so enabling early is harmless |
| Scheduler | 4 jobs in us-central1 today (`wcRefundSweeper` every 10 min among them) | +1 job created by the deploy |

## 4. The approval package (one decision; production release not yet approved)

**Sources (pinned):** whitecross-site **`a5da93d4`** (functions), salown-app **`8bb05ad`** (indexes, rules).
Both are origin/main today; if either moves before release, re-run §1's byte checks against the new head.

**Workspaces:** `git archive` of each SHA into a scratchpad directory; whitecross-site needs `.firebaserc`
(gitignored — copy from the repo) and `functions/node_modules` (symlink) for the CLI to load the code, plus the
env file of §3; the deploy uploads source only.

**Ordered commands (all with explicit `--project havuz-44f70`):**
1. Indexes — salown-app workspace: `firebase deploy --only firestore:indexes --project havuz-44f70`. Expected: creates 1 index, offers no deletion; **answer No to any deletion prompt.** Wait `READY` (`gcloud firestore indexes composite list --project havuz-44f70`).
2. Env — write `functions/.env.havuz-44f70` in the whitecross-site workspace (§3). Confirm no `WC_NONPROD_TEST_MODE` line.
3. Stripe — owner enables `charge.updated` on the **live** endpoint (Dashboard, live mode). No other endpoint change.
4. Functions — whitecross-site workspace: `./scripts/deploy-functions.sh whitecross stripeWebhook wcSettlementSweeper` (wrapper: rules-authority guard, live-key guard, `--only functions:whitecross:stripeWebhook,functions:whitecross:wcSettlementSweeper`, post-deploy key guard). Flag absent ⇒ both inert. Expected logs: `stripeWebhook` unchanged behaviour on live events (`settlement not recorded — left to the sweeper` / `DISABLED` on the B1 branch); `wcSettlementSweeper: pass complete { enabled: false, reason: 'DISABLED' }` every 15 min; no `settlements` subcollection anywhere; `platform/settlementScan` still absent.
5. Rules — after the §2 decision: `firebase deploy --only firestore:rules --project havuz-44f70` from the salown-app workspace; then **read-only verification**: fetch `projects/havuz-44f70/releases/cloud.firestore` → ruleset → compare content byte-for-byte with the committed file (the method used in this preflight); confirm `autoRefundEnabled` still on all four arms, `settlementLedgerEnabled` on all four. No writes as staff/owner in production.
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
- *Rules:* re-release ruleset `a0a10819-…` (or deploy from a `5a3ecdd` workspace) — only if the rules release itself misbehaves; the B1 arms cannot loosen anything (0 lines removed).
- *Indexes:* leave in place (inert). Written entries are correct facts and stay.

**Remaining concrete items before the owner can say "go":**
1. Rules path decision (R-a or R-b) — involves the COA owner.
2. `WC_SETTLEMENT_START_ISO` value.
3. Confirmation that `charge.updated` will be enabled on the live endpoint at step 3 (owner, Dashboard).

Hosting is out of scope. No production deploy is approved by this page.
