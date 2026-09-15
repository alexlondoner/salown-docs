# FIN-B1 — production release preflight (re-derived 2026-09-14, read-only; NOT a release)

> **Re-derived 2026-09-14 against the live project and current heads.** It supersedes the 2026-09-09 package, which is
> kept in §8 as history. Two facts changed the plan:
> 1. **The rules step is already done.** `R-2026-09-10-C` released GTM A3 (COA) and B1's `settlementLedgerEnabled`
>    owner-authority arms in one ruleset (`5e102dd4-…`). The "COA first / path R-a" precondition is cleared, and the B1
>    rules arm can no longer be rolled back separately from A3.
> 2. **The recorded endpoint list has no capture/fee-update event such as `charge.updated`.** The last recorded read
>    (2026-08-29, whitecross-site `docs/REFUND-RELEASE-ANCHORS.md`) listed exactly `charge.refunded`,
>    `checkout.session.completed`, `refund.updated` — `charge.refunded` is the only `charge.*` event, and it serves refunds.
>    The current subscription is unverified. The earlier sentence "`charge.succeeded` is expected to be present already" was an assumption, and it
>    contradicts that record.
>
> Nothing was deployed, no setting, subscription, flag or production document was changed, no Stripe API call was made.
> The release itself needs the owner's separate approval.

## 0. What B1 ships, and what it does not

**Ships:** for every new whitecross website payment after `WC_SETTLEMENT_START_ISO`, append-only entries
`tenants/whitecross/bookings/{docId}/settlements/{stripe:ch_…, stripe:txn_…}` (`CAPTURED`, `FEE_ACTUAL`), a derived
`booking.settlementProjection` (`gross_m`, `fee_m`, `feeSource`, `providerNet_m`, …), a retry marker
`booking.settlementSync`, and `tenants/whitecross/platform/settlementScan` (provider-side charge scan cursor). A second
capture on one booking sets `paymentNeedsReview: true` (`SECOND_CAPTURE`) and never refunds.

**Does not ship:** any screen. No Finance, Reports or booking-panel reader exists (B2). No refund entries (B1b). No
history (B3). No change to confirmation, refund or checkout behaviour (confirmation gates run first; the B1 branch
swallows its own errors — `functions/index.js:1220-1250`).

## 1. Source selection — exact candidates (verified 2026-09-14)

> **Pinned 2026-09-15 (owner).** The B1 release source is whitecross-site
> **`22850996613cd1a6519b42d11c7bc3a076af1a77`** and stays there. The `FIN-B1-SETTLEMENTS` path lock that froze the
> rehearsed bytes was handed over (`ef17f1f6`). The freeze is now this SHA: build only from a `git archive` of it.
> Never deploy from whitecross-site `origin/main`: from `ef17f1f6` on it carries **B1b refund work (`FIN-B1B-REFUNDS`)
> that is not part of this release** and has not been rehearsed. The §6 re-check compares the four settlement files and
> `index.js` against this SHA, not against `origin/main`. A candidate that includes B1b is a new rehearsal and a new
> preflight.

| Unit | Live now (read-only) | Candidate | Delta candidate − live |
|---|---|---|---|
| `stripeWebhook` (us-central1, gen2) | revision **`stripewebhook-00106-dof`**, 100 % traffic, `updateTime 2026-08-28T23:50:59Z`, source object `gcf-v2-sources-1050766582653-us-central1/stripeWebhook/function-source.zip#1787960993781215`. Source zip downloaded and compared: `index.js`, `externalCheckout.js`, `refunds.js`, `emailParsers.js`, `package.json` **byte-identical to whitecross-site `6817356f`**. Env: platform variables only (no `WC_STRIPE_ACCOUNT_ID`, `WC_STRIPE_LIVEMODE`, `WC_SETTLEMENT_START_ISO`, `WC_NONPROD_TEST_MODE`). Secrets: `WC_STRIPE_SECRET_KEY` v1, `STRIPE_WEBHOOK_SECRET` v2, `WC_STRIPE_TEST_SECRET_KEY` v1, `STRIPE_TEST_WEBHOOK_SECRET` v1 | **whitecross-site `22850996613cd1a6519b42d11c7bc3a076af1a77`** (= origin/main 2026-09-14). `functions/` is **byte-identical to the previous candidate `101c3c2d`** (empty diff); `settlements.js`, `settlements.fakes.js`, `stripeWebhook.integration.test.js` byte-identical to `8137711b` (the rehearsed commit) | `functions/` 6817356f → 22850996: 7 files, +2457/−50. Shared runtime files that differ: **`index.js` only** (`externalCheckout.js`, `refunds.js`, `emailParsers.js` unchanged). New: `settlements.js` (+tests/fakes) = B1; `loyaltyEnroll.js` (+test) = the loyalty lane already live in `enrollLoyalty`/`wcLoyaltyLookup` (`R-2026-09-09-A`), which a `stripeWebhook` deploy also republishes into its own bundle — record it in the ledger row. The live zip also carries `get-gmail-token.js` and `.DS_Store`, which are gitignored/untracked: an archive-workspace deploy drops them (nothing in `index.js` requires `get-gmail-token.js`) |
| `wcSettlementSweeper` (new) | does not exist (functions list, Cloud Run, Scheduler) | same SHA — `onSchedule({ schedule: 'every 15 minutes', secrets: ['WC_STRIPE_SECRET_KEY'], timeoutSeconds: 120 })` (`index.js:3783-3806`) | new function + Scheduler job `firebase-schedule-wcSettlementSweeper-us-central1`. Scheduler today: 4 us-central1 jobs |
| Firestore indexes | **2** composite `bookings` indexes, both `READY` (`barberId+startTime` COLLECTION; `source+status+expiresAt` COLLECTION_GROUP); field override `bookings.stripePaymentIntent` present | **salown-app `b6c325cc5262c267fe37cc7b83e7380f0c074af9`** (or any later head where `firestore.indexes.json` is byte-identical to `9a9547a`; `55abb91` only adds a claim file). `firebase.json` delta since `9a9547a` = one `emulators.auth` block (local only) | **+1** index `bookings (settlementSync.state ASC, settlementSync.nextAttemptAt ASC)`; live-not-in-file = none; field override matches → no deletion offered |
| Firestore rules | ruleset **`5e102dd4-e7e7-4950-b12a-14a74daa82e8`** (release 2026-09-10T13:39:16Z), 80,896 B, sha256 `b05ac1e7515cb5a5…`, byte-identical to salown-app `HEAD:firestore.rules`; `settlementLedgerEnabled` ×5, `autoRefundEnabled` ×6 | **none — already released** | **no rules deploy in this release.** Verify the ruleset id is unchanged before and after |

## 2. Env, flag and Stripe readiness (values not shown)

| Item | State 2026-09-14 | Release action |
|---|---|---|
| `functions/.env.havuz-44f70` (isolated workspace only) | not present; pattern `.env.*` is gitignored (`git check-ignore`: `.gitignore:15`) | create in the whitecross-site archive workspace with `WC_STRIPE_ACCOUNT_ID=acct_1T3CrpRfgDnpYJzP` (Whitecross Stripe account; a wrong id yields `ACCOUNT_MISMATCH` and no writes), `WC_STRIPE_LIVEMODE=true`, `WC_SETTLEMENT_START_ISO=<UTC instant recorded at step 2>`. No `WC_NONPROD_TEST_MODE` line. The file is read by every function deployed from that workspace — deploy exactly the two targets |
| `WC_SETTLEMENT_START_ISO` | not chosen | one UTC instant, `date -u +%Y-%m-%dT%H:%M:%SZ`, immediately before step 3; written into the env file and the ledger row; **never changed on a redeploy** |
| Kill switch `tenants/whitecross/settings/settings.settlementLedgerEnabled` | **absent** (field-mask read); owner-only in the live rules | set boolean `true` at step 6 only. **No activation tool exists** for this flag (no script or UI references it, unlike `activateAutoRefund.mjs`). Decide before release: a guarded script with an `updateTime` precondition + audit row, or a Console write recorded in the ledger row |
| `tenants/whitecross/platform/settlementScan` | 404 | created by the first enabled sweeper pass |
| **Live Stripe endpoint `we_1TU3wwRfgDnpYJzPS6E4eUxU` event list** | **UNVERIFIED.** Last recorded 2026-08-29: `["charge.refunded","checkout.session.completed","refund.updated"]` | owner reads it (Dashboard, live mode) and records id + sorted list in the ledger row. Stripe's update **replaces** the list: re-send every existing event plus `charge.updated` |
| Event coverage of the B1 branch | `settlements.js:153-155`: `charge.succeeded`/`charge.updated`/`charge.captured`, `checkout.session.completed`/`async_payment_succeeded`, `payment_intent.succeeded` | With today's recorded subscription B1 already runs on `checkout.session.completed` (charges looked up by PaymentIntent). A `balance_transaction` that is `null` at that moment leaves `settlementSync` pending and the sweeper fills it on its next pass (≤ 15 min). Adding `charge.updated` makes the fee arrive with Stripe's own update. `charge.succeeded` is not needed (the session event covers the capture). **Recommended: add `charge.updated` only.** Whether `balance_transaction` is already set at `checkout.session.completed` in live mode is **unverified** (the test API showed it `null` on `charge.succeeded`) |
| Deploy wrapper | `scripts/deploy-functions.sh`: `wcSettlementSweeper` is in neither `CHECKOUT_FNS` nor `REFUND_FNS`; the live-key guard still runs because `stripeWebhook` is in the same command | none (follow-up: a read-only class for the sweeper) |
| `.firebaserc` | present in the repo checkout (gitignored) | copy into the archive workspace |

## 3. Tests — what ran on 2026-09-14, and what did not

| Gate | Result | Where |
|---|---|---|
| whitecross-site functions suite (`node --test *.test.js`) on a `git archive` of `22850996` | **182/182 pass** (B1 166 + loyalty 16; includes `stripeWebhook.integration.test.js`: kill switch off writes nothing, settlement throw does not change the 200, test-mode event rejected before any read) | scratchpad archive, `node_modules` symlinked |
| salown-app ops guards `deploy-policy`, `rules-authority`, `functions-ownership` (`vitest run`) | **120/120 pass** | salown-app `55abb91` tree |
| Rules emulator suite | **not re-run** — the rules are already live and byte-identical to HEAD; last recorded gate 228/228 (`R-2026-09-10-C`) | — |
| Staging rehearsals (index query, real Stripe→GCP HTTP, scheduler, kill switch) | **not repeated** — B1 payload byte-identical to the rehearsed `8137711b`; `STAGING_PROJECT_PLAN.md` §10 | — |
| Live `checkout.session.completed` → fee timing | **not testable without a live payment** | first post-flag capture (§5) |

## 4. The approval package — ordered steps (all with `--project havuz-44f70`)

0. **Same-day re-check** (§6). Stop if any identity in §1 moved.
1. **Indexes** — salown-app `git archive` workspace of the §1 candidate:
   `npx firebase deploy --only firestore:indexes --project havuz-44f70`. Expected: creates 1 index, **no deletion prompt;
   answer No to any deletion prompt**. Wait for `READY`
   (`gcloud firestore indexes composite list --project havuz-44f70`). Confirm the rules release id is still `5e102dd4-…`.
2. **Env** — record `WC_SETTLEMENT_START_ISO`; write `functions/.env.havuz-44f70` in the whitecross-site workspace (§2).
3. **Stripe** — owner records the live endpoint event list, then updates it to the recorded list **plus**
   `charge.updated`. Nothing removed; no other endpoint field changed.
4. **Functions** — whitecross-site workspace:
   `./scripts/deploy-functions.sh whitecross stripeWebhook wcSettlementSweeper`. Flag absent ⇒ both inert. Expected:
   `stripeWebhook` → a new revision after `00106-dof`, confirmation/refund behaviour unchanged, B1 branch logs
   `DISABLED`; `wcSettlementSweeper: pass complete { enabled: false, reason: 'DISABLED' }` every 15 min; no
   `settlements` document anywhere; `platform/settlementScan` still 404. Inventory: us-central1 +1 function, +1 job,
   nothing deleted.
5. ~~Rules~~ — **done 2026-09-10**; only confirm the ruleset id is unchanged.
6. **Flag** — owner sets `settlementLedgerEnabled: true` by the mechanism decided in §2.

**LIVE_VERIFIED criteria after the flag:**
- next sweeper pass: `pass complete { enabled: true, configOk: true, scan: { from: <START_ISO>, … advanced: true } }`,
  `platform/settlementScan` created, `refused: 0`, no `ACCOUNT_MISMATCH`;
- first live website payment after the flag: `stripeWebhook[B1] settlement recorded { created: ['stripe:ch_…', …] }`
  with `feeSource: 'actual'`, or `pending` then `actual` on `charge.updated` / the next sweeper pass;
  `projection.gross_m` = the charge amount, `fee_m` = the Stripe fee, T6 `fee_m + providerNet_m === gross_m`;
- booking confirmation fields unchanged; no refund call; Finance UI unchanged (no reader).

## 5. Rollback, per unit

- **Stop first, always:** flag `false` → new invocations inert at once. In-flight ones finish (webhook ≤ its timeout,
  sweeper ≤ 120 s). Confirm no new `settlements` entry or `settlementSync` marker across two scheduler intervals.
- **`stripeWebhook`:** fastest — `gcloud run services update-traffic stripewebhook --region=us-central1
  --to-revisions=stripewebhook-00106-dof=100 --project=havuz-44f70` (the revision is still listed and Ready; it holds
  only until the next deploy of the function). Permanent — redeploy a `git archive` of **`6817356f`** (byte-identical to
  today's live bundle, verified 2026-09-14) with `./scripts/deploy-functions.sh whitecross stripeWebhook`, from a
  workspace **without** the env file.
- **`wcSettlementSweeper`:** pause `firebase-schedule-wcSettlementSweeper-us-central1`, then
  `firebase functions:delete wcSettlementSweeper --region us-central1 --project havuz-44f70` (no earlier revision exists).
- **Index:** leave in place (inert).
- **Rules:** no B1 rules rollback exists — the arms are part of `5e102dd4-…` with A3; rolling back would revert A3.
  They loosen nothing (owner-only), so none is needed.
- **Stripe endpoint:** leave `charge.updated` (any deployed handler answers 200 to unhandled types) or re-send the list
  recorded at step 3.
- **Entries already written** are correct facts and stay.

## 6. Same-day re-check before "go" (read-only)

1. `git rev-parse origin/main` in whitecross-site and salown-app; if moved, repeat §1's byte checks
   (`functions/` vs `22850996`; `firestore.indexes.json` vs `9a9547a`) and re-pin §1 — not only this list.
2. Live identities: `stripeWebhook` revision + source generation, function/scheduler inventory, rules release id,
   index list, flag absent.
3. The Stripe endpoint event list (§2) — owner, Dashboard.
4. Flag-write mechanism decided (§2).

## 7. Out of scope of this release, and kept separate

- **Automatic refunds (BL-4, `autoRefundEnabled`)** — separate lane, separate approval, separate £10 test; do not
  combine with B1 in one change window. Without B1b, refunds produce no settlement entry.
- B1b refund entries, B2 Finance display (`FIN_FEES_UX_DRAFT.md`), B3 history backfill.

## 8. Re-check log (history; newest first)

### 2026-09-14 (this re-derivation)
- Live ruleset is `5e102dd4-…` (R-2026-09-10-C) and already carries the B1 arms → rules step removed from the package;
  the path-R-a precondition is closed.
- Candidates re-pinned: whitecross-site `101c3c2d` → **`22850996`** (`functions/` diff empty); salown-app `e0fd2e8` →
  **`b6c325c`** (`firestore.indexes.json` identical to `9a9547a`; `firestore.rules` changed since but is already live).
- `stripeWebhook` live bundle re-proven byte-identical to `6817356f` by downloading the deployed source zip.
- Correction: §3 of the 2026-09-09 package assumed `charge.succeeded` was subscribed; the 2026-08-29 endpoint record shows no
  capture/fee-update event such as `charge.succeeded` or `charge.updated` (its only `charge.*` event is `charge.refunded`).
  The current subscription is unverified; the endpoint list is now an explicit release item. *(Wording corrected
  2026-09-14 after owner review: an earlier version of this line and of §0 said "no `charge.*` event".)*
- New finding: no activation tool exists for `settlementLedgerEnabled`.
- Tests: functions 182/182 (archive of `22850996`), ops guards 120/120.

### 2026-09-09, 2nd pass (after REL-12 went live; doc-truth sweep)
- Live ruleset still `a0a10819-3b62-46d5-9f95-9ea048701c59`: `settlementLedgerEnabled` ×0, COA ×0. COA not released —
  R-a precondition unmet (superseded 2026-09-10).
- Production indexes exactly 2 READY; functions 121 (91 `europe-west2`, 30 `us-central1`), no settlement function;
  `stripeWebhook` updateTime 2026-08-28.
- Candidates re-pinned `d7c5822a`/`f6b869a` → `101c3c2d`/`e0fd2e8` (payload unchanged). Functions suite 182/182.
- Finding: the `stripeWebhook` deploy delta is no longer B1-only (B1 + the already-live loyalty lane).

### 2026-09-09 (after alish-83 closed; COA still not released)
- Live ruleset `a0a10819-…` == `5a3ecdd`; COA absent; `autoRefundEnabled` 5; `settlementLedgerEnabled` 0.
- Candidates re-pinned `a5da93d4`/`8bb05ad` → `d7c5822a`/`f6b869a`. `stripeWebhook` body, `wcSettlementSweeper` body,
  `settlements.js`, `externalCheckout.js`, `refunds.js`, `package.json` byte-identical between `8137711b` and `d7c5822a`.
  Functions suite 182/182.
