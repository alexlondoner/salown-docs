# salOWN staging project — setup plan and execution record

*Written 2026-09-08 under FIN-B1, revised after owner review; **executed the same evening under the owner's B-package
approval — see §10 for what actually happened.** It is not a production release approval; production was not touched.*

> ## Read this first — state on 2026-09-09
>
> **This plan is FINISHED. §7, §8 and §9 are a historical record; nothing in them is waiting on the owner.**
> The approval in §9 was requested, **granted and spent** on 2026-09-08; setup, both rehearsals and the full
> cleanup all ran (§10). The `FIN-B1-INDEX-DRIFT` blocker in §8 is **closed** (commit `9a9547a`; re-verified
> read-only 2026-09-09 — production carries 2 composite `bookings` indexes, the repo file declares those 2 plus
> the undeployed B1 index, live-not-in-file = none).
>
> **What still exists on `salown-staging`:** the empty project, its europe-west2 Firestore with 3 READY indexes,
> the budget alert and the Firebase link. **What was torn down:** both functions, the scheduler job, the Stripe
> test endpoint, 4 secrets, all synthetic documents, the artifact/source buckets.
> **So a NEXT rehearsal is not free** — it must redo: 4 secrets, `.env.salown-staging`, the targeted functions
> deploy, a new Stripe test-mode endpoint, and the synthetic seed. The indexes and the project itself are reusable.
>
> **What FIN-B1 is actually waiting on is not here** — it is the production release, gated by
> `FIN_B1_RELEASE_PREFLIGHT.md` (COA rules release first, path R-a) and `PROCESSOR_FEES_PLAN.md` §8.

## 0. Why a separate project

Firebase's guidance: "Firebase recommends using a *separate* Firebase project for *each* environment in your
development workflow" and "builds based on release status should *not* share the same Firebase resources
because that risks your debug data polluting or even overriding your prod data"
(firebase.google.com/docs/projects/dev-workflows/general-best-practices).

What exists today (verified read-only 2026-09-08 with the CLI account `whitecrossbarbers@gmail.com`):

| Project | Firebase? | Firestore | Billing | Role held | Verdict |
|---|---|---|---|---|---|
| `havuz-44f70` (production) | yes | `(default)`, **europe-west2**, Native | Blaze, account `01B741-62F1F4-49A88C` "My Billing Account" | owner | never used for rehearsal |
| `project-0b7d3005-bf45-41ea-84b` "My First Project" (2026-04-20) | **no** | none, Firestore API not enabled | unknown | `roles/owner` | **not converted** — purpose unknown, left alone |
| docs | no staging/test project recorded anywhere; `demo-c1`, `demo-a13`, `demo-whitecross` are emulator-only ids | | | | |

Proposal: a new, explicitly named salOWN staging project. It serves the two remaining B1 checks now and every
later pre-release rehearsal.

## 1. The smallest environment that covers the two remaining B1 checks

| Check | Needs |
|---|---|
| **Real composite index** (`bookings`: `settlementSync.state ASC, settlementSync.nextAttemptAt ASC`) | Firestore database + `firebase deploy --only firestore:indexes` + one read-only query through the index |
| **Real GCP HTTP delivery** (Stripe → deployed `stripeWebhook` URL; `wcSettlementSweeper` on Cloud Scheduler) | Cloud Functions 2nd gen deploy of exactly two functions, Secret Manager (the 4 secret names the two functions declare), Cloud Scheduler (1 job), a Stripe **test-mode** webhook endpoint |

Nothing else: no Hosting, no Auth, no Storage, no email/Telegram secrets, no other functions.

## 2. Proposed identity and region

| Item | Proposal | Reason |
|---|---|---|
| Project id | `salown-staging` — **availability is unknown until creation**; if taken, the owner picks the variant, it is not guessed here | Explicit name; cannot be confused with `havuz-44f70` or "My First Project" |
| Display name | `salOWN staging` | |
| Firestore location | **europe-west2** (Native mode) | Matches production; the location is permanent |
| Functions region | `us-central1` for `stripeWebhook` + `wcSettlementSweeper` | Where the whitecross-site functions run in production (no `region` option in `index.js`) |
| Node runtime | 22 | `functions/package.json` engines |

## 3. Services, permissions, billing, secrets (verified against official docs 2026-09-08)

**Billing — required for the HTTP check.** "To deploy functions, your project must be on the Blaze pricing
plan" (firebase.google.com/docs/functions/get-started). The index check alone would work on Spark. The only
billing account visible to this CLI account is `01B741-62F1F4-49A88C` ("My Billing Account", the one
production uses). Linking it — or another account the owner names — is an **owner decision not yet taken**.

**APIs.** The Firebase CLI enables what a functions deploy needs on first deploy (Cloud Functions, Cloud Build,
Artifact Registry, Cloud Run, Eventarc, Pub/Sub, Cloud Logging). Two must be explicit: **Secret Manager**
(`functions:secrets:set`) and **Cloud Scheduler** ("The Cloud Scheduler API must be enabled for your project",
firebase.google.com/docs/functions/schedule-functions). Firestore is enabled by creating the database.

**Permissions.** The owner account creates the project and is its owner, so a solo rehearsal needs no extra
grants. For a future non-owner operator the narrow set is `roles/datastore.indexAdmin` + `roles/datastore.user`
(index check) and `roles/cloudfunctions.developer` + `roles/iam.serviceAccountUser` +
`roles/secretmanager.admin` + `roles/cloudscheduler.admin` (HTTP check). Admin SDK reads use Application
Default Credentials of the owner account (`gcloud auth application-default login`, currently **not
configured**) — no service-account key file.

**Secrets — names and necessity only; no values are written in any document.** The two functions declare
these names, and a 2nd-gen deploy fails if a declared secret does not exist in the target project:

| Secret name | Declared by | Why it must exist on staging | Staging content (described, never shown) |
|---|---|---|---|
| `WC_STRIPE_TEST_SECRET_KEY` | `stripeWebhook` | test-pair signature verification, charge retrieval | the Whitecross **test-mode** secret key |
| `STRIPE_TEST_WEBHOOK_SECRET` | `stripeWebhook` | test-pair signature verification | signing secret of the **staging test-mode endpoint** (created in step C2) |
| `WC_STRIPE_SECRET_KEY` | `stripeWebhook`, **`wcSettlementSweeper`** | the sweeper reads **only this name** (`index.js` `wcSettlementSweeper`: `const key = process.env.WC_STRIPE_SECRET_KEY`; there is no non-production branch) — a placeholder here would make every sweeper pass fail with Stripe 401 and the scheduler check (C5) could not run | the same Whitecross **test-mode** key — staging holds **no live value under any name** |
| `STRIPE_WEBHOOK_SECRET` | `stripeWebhook` | declared, so it must exist; the live signature pair is never expected to verify on staging | inert placeholder string (not a Stripe secret) |

Why no real payment can start from staging, from the code as it is:
- Stripe binds mode to the key: a test-mode key can only create and see test objects; staging holds no live key
  under any name, so no function on staging can touch live money.
- `createCheckoutSession` / `createMobileCheckout` (the only payment-starting functions) are **not deployed** to
  staging (targeted deploy of two functions only).
- `stripeWebhook` verifies the live pair first, then the test pair (`externalCheckout.verifyStripeSignature`).
  On staging the live pair is (test key, placeholder secret) and can never verify a genuine Stripe signature;
  the test pair verifies the staging endpoint's deliveries. A **live** event could only be signed by the live
  endpoint's secret, which staging does not have → 400, nothing read or written (that was proved locally).
- `assertProductionEventMode` admits non-live events only because `WC_NONPROD_TEST_MODE=1` is set — and that
  flag exists only in the staging env file (§6).
- B1's trusted config on staging says `WC_STRIPE_LIVEMODE=false`; `validateChargeBinding` refuses any charge
  whose `livemode` disagrees, so even a mis-routed live charge object would be refused, not recorded.

**Stripe.** Test mode of the existing Whitecross account (`acct_1T3CrpRfgDnpYJzP`). One **test-mode** webhook
endpoint for the staging URL, events `charge.succeeded`, `charge.updated`, created through the API with the
test key (no Dashboard change) or in the Dashboard in test mode. A test-mode endpoint cannot receive live events.

## 4. Cost — an estimate, not a guarantee

| Item | Expected charge (estimate) | Basis |
|---|---|---|
| Cloud Scheduler job (sweeper, every 15 min) | about **$0.10 (USD)/month** | "Each Cloud Scheduler job costs $0.10 (USD) per month, and there is an allowance of three jobs per Google account, at no charge" — production already holds 8 jobs, so the allowance is assumed used |
| Secret Manager (4 active versions) | likely $0 | free tier "6 active secret versions per month", "10,000 access operations per month" |
| Cloud Functions / Cloud Run invocations | likely $0 | free tier 2M invocations, 400K GB-s; the rehearsal is a few hundred invocations + 96 sweeper runs/day |
| Cloud Build, Artifact Registry | likely $0 | free 2,500 build-min/month; free 0.5 GB registry storage — two small images |
| Firestore | likely $0 | free tier 1 GiB / 50K reads / 20K writes per day; synthetic data is a handful of documents |
| Stripe test mode | $0 | |

**Free quotas are shared, not per project.** Google's Free Tier page: "there are monthly usage limits that are
calculated per billing account". If staging is linked to production's billing account, every "likely $0" line
above draws from the **same** allowance production already consumes; any overflow is billed at list price on
that account. Google also "reserves the right to change the offering, including changing or eliminating usage
limits, with 30 days' advance notice". A separate billing account isolates the quotas but not the money.

**A budget alert is a notification, not a spending cap.** It emails when thresholds are crossed; it stops
nothing. Set one anyway (e.g. £5/month) so an overlooked resource is noticed.

**Paid resources that can survive cleanup** (all seen in production today as precedent):

| Leftover | Where | Note |
|---|---|---|
| Function container images | Artifact Registry repository `gcf-artifacts` (production holds two today) | `functions:delete` does not always remove images; delete the repository or its images explicitly |
| Uploaded function source + build artefacts | Cloud Storage buckets `gcf-v2-sources-<project-number>-<region>` and `gcf-v2-uploads-<project-number>.<region>.cloudfunctions.appspot.com` (four exist in production) | created by the deploy, not removed by function deletion; storage is billed per GiB-month beyond the free tier |
| Cloud Build logs | Cloud Storage / Cloud Logging | small, but persistent |
| Scheduler job | Cloud Scheduler | removed with the function; verify with `gcloud scheduler jobs list` |
| Secret versions | Secret Manager | only destroyed versions stop counting |
| Firestore data + the composite index | Firestore | data must be deleted by hand; an index on an empty collection costs nothing measurable |

Realistic order of magnitude for a one-week rehearsal: **under £1**, assuming the free tier behaves as
documented and no leftover is forgotten. An empty project itself costs nothing.

## 5. Data policy — synthetic only, Stripe test mode only

- Staging Firestore contains only documents written by the rehearsal seed script under
  `tenants/whitecross/...` with `bookingId` prefixed `REH-` and `stripeMode: 'test'`. **No export/import from
  `havuz-44f70`**, no client documents, no real names or phones.
- Only Stripe **test** objects: test key, test webhook secret, `pm_card_visa` payments of £32.00.
- The sweeper's provider-side scan lists test-mode charges only (the test key cannot see live charges).

## 6. Controls that keep production out of the rehearsal

| Control | How it is enforced |
|---|---|
| No live Stripe value on staging | All four secret names exist on staging, none holds a live value (§3 table). |
| Test-mode events accepted **only** on staging | `WC_NONPROD_TEST_MODE=1` is set **only** in `whitecross-site/functions/.env.<staging-project-id>` (project-scoped env file; `.gitignore` already ignores `.env.*`). **Never** create `functions/.env` — a bare `.env` applies to every project including production. Same guard `TESTING_STRIPE.md` relies on. |
| Trusted B1 config on staging | Same env file: `WC_STRIPE_ACCOUNT_ID=acct_1T3CrpRfgDnpYJzP`, `WC_STRIPE_LIVEMODE=false`, `WC_SETTLEMENT_START_ISO=<rehearsal day>` (staging's own value; the production value is chosen once on release day and never moved). |
| Production webhook untouched | The production live-mode endpoint is not edited. The staging endpoint is a new test-mode endpoint. |
| Repo default project untouched | `.firebaserc` stays `havuz-44f70` in both repos; `firebase use` is never run; **every** command carries `--project <staging-id>`; before each deploy the operator echoes the target and confirms it is not `havuz-44f70`. |
| Targeted deploys only | `--only functions:stripeWebhook,functions:wcSettlementSweeper` and `--only firestore:indexes`. Never blanket `--only functions`. |
| Kill switch as in production | `settlementLedgerEnabled` set `true` on the staging settings doc by the seed script; flipped off at the end to observe the drain. |
| Nothing flows back | No production deploy, no rules deploy, no data copy, no commit is part of this plan. |

## 7. Order of operations

### A. Setup (one-time) — ✅ **EXECUTED 2026-09-08** under the granted B-package approval; see §10
1. Create the project (`salown-staging` or the owner's variant), add Firebase, link the billing account the owner names (Blaze), set a budget alert (notification only).
2. Create Firestore `(default)` in **europe-west2**, Native mode.
3. Enable Secret Manager and Cloud Scheduler APIs (the rest is enabled by the first functions deploy).
4. `gcloud auth application-default login` for the owner account (read-only Admin SDK checks).
5. Set the four secrets on staging (`firebase functions:secrets:set <NAME> --project <staging-id>`), contents as described in §3.
6. Write `whitecross-site/functions/.env.<staging-id>` locally (never committed).

### B. Rehearsal 1 — real composite index — ✅ **EXECUTED 2026-09-08**, passed (§10)
1. Precondition: `FIN-B1-INDEX-DRIFT` (§8) is closed, i.e. the canonical file also carries the two live production indexes. Otherwise the staging deploy proves the B1 index but the same command would later threaten production.
2. `firebase deploy --only firestore:indexes --project <staging-id>` from `salown-app/`.
3. Wait for `READY` (`gcloud firestore indexes composite list --project <staging-id>`); "the minimum build time for an index is a few minutes, even for an empty database".
4. Seed 3 synthetic bookings with `settlementSync.state = 'pending'` and different `nextAttemptAt`; run the exact sweeper query (`where state == 'pending' orderBy nextAttemptAt limit 25`) through the Admin SDK — ordered results, no `FAILED_PRECONDITION`.

### C. Rehearsal 2 — real GCP HTTP delivery — ✅ **EXECUTED 2026-09-08**, passed (§10)
1. `firebase deploy --only functions:stripeWebhook,functions:wcSettlementSweeper --project <staging-id>` from `whitecross-site/` (pinned commit; the B1 files must be committed first — this is the moment the local B1 work is committed to a branch; still no production deploy).
2. Create the Stripe test-mode endpoint with the staging `stripeWebhook` URL; store its signing secret as `STRIPE_TEST_WEBHOOK_SECRET` (redeploy if the secret version was created after step C1).
3. Seed one booking + `settlementLedgerEnabled=true`; one test payment (unconfirmed PI → seed → confirm, as in the local rehearsal).
4. Verify in staging Firestore: `settlementSync.state = done`, CAPTURED + FEE_ACTUAL entries, projection = Stripe balance transaction; Cloud Logging: `settlement recorded`. Resend the event from Stripe → 200, no duplicate entry.
5. Withhold the webhook for a second booking (temporarily disable the endpoint), pay, wait ≤15 min: the scheduler-driven sweeper must record it (`wcSettlementSweeper: pass complete`).
6. Flip `settlementLedgerEnabled=false`; the next sweeper pass must log the disabled reason and write nothing.

### D. Cleanup — ✅ **EXECUTED 2026-09-08**, complete (§10)
1. Delete the Stripe test-mode endpoint.
2. `firebase functions:delete stripeWebhook wcSettlementSweeper --project <staging-id>`; confirm the scheduler job is gone.
3. `functions:secrets:destroy` ×4 (verify no active versions remain); delete the synthetic `tenants/whitecross` subtree.
4. Delete leftover images in `gcf-artifacts` and the `gcf-v2-sources-*` / `gcf-v2-uploads-*` buckets (§4 table); check the billing report once after the next cycle.
5. Delete the local `.env.<staging-id>` or keep it for the next rehearsal (it holds no secrets).
6. Keep the empty project (free) or delete it — owner's call.

## 8. ~~Separate release blocker~~ — `FIN-B1-INDEX-DRIFT`: ✅ **CLOSED** (historical finding below)

> **Closed 2026-09-08 in `9a9547a`**: the two live definitions were written into `salown-app/firestore.indexes.json`
> alongside the B1 index. Re-verified read-only 2026-09-09 — live 2 (`READY`), file 3, live-not-in-file = none, so
> an indexes deploy now **creates** the B1 index and offers no deletion. The finding below is kept as the record of
> what the drift was; it no longer blocks anything.

**Finding (read-only, 2026-09-08).** Production `havuz-44f70` has two composite indexes that are **absent from the
canonical `salown-app/firestore.indexes.json`**. They pre-date B1: on `origin/main` the file has `"indexes": []`
(last touched by `8747fea`), so the two were created outside the file (console or error-link). The working-tree
copy only adds the B1 index. Exact live definitions versus the file:

| Live index id | Collection group | Scope | Fields (order) | Density | In the file? |
|---|---|---|---|---|---|
| `CICAgOjXh4EK` | `bookings` | COLLECTION | `barberId ASC`, `startTime ASC`, `__name__ ASC` (implicit) | SPARSE_ALL (default) | **no** |
| `CICAgJiUpoMK` | `bookings` | COLLECTION_GROUP | `source ASC`, `status ASC`, `expiresAt ASC`, `__name__ ASC` (implicit) | SPARSE_ALL (default) | **no** |
| (B1, working tree) | `bookings` | COLLECTION | `settlementSync.state ASC`, `settlementSync.nextAttemptAt ASC` | default | yes (not deployed) |

Field override `bookings.stripePaymentIntent` (single-field, COLLECTION + COLLECTION_GROUP ascending): **live and
file agree**.

**Why it blocks.** `firebase deploy --only firestore:indexes` treats the file as the full desired state and
**offers to delete** indexes that exist live but not in the file. Answering *yes* would drop the two live
indexes and break whatever queries depend on them (barber-day booking lists; the expiry sweep over
`source/status/expiresAt`) until they rebuild. So production step (1) of the B1 release order in
`PROCESSOR_FEES_PLAN.md` §8 is blocked until this is closed.

**How it was closed:** the two definitions above were added to `firestore.indexes.json` (without the implicit
`__name__`) under the `FIN-B1-INDEX` claim and committed as `9a9547a` — **source only, not deployed**. The indexes
deploy itself is still ahead, inside the B1 release sequence; answer *no* to any deletion prompt regardless.
*(Historical: nothing was changed and no index was deleted during the 2026-09-08 rehearsal round itself.)*

## 9. ~~Approval that will be requested~~ — ✅ **GRANTED AND SPENT 2026-09-08** (historical)

> Do not re-request this. It was asked, approved as the "B package", and fully executed; §10 is the outcome.
> A *future* rehearsal needs a fresh, narrower approval (the project already exists — see the box at the top for
> what has to be rebuilt).

The package as it was put to the owner — setup step A:

| What | Value |
|---|---|
| Project | new Firebase project, proposed id `salown-staging` (owner confirms or supplies the id), display name "salOWN staging" |
| Region | Firestore europe-west2 Native; functions us-central1 |
| Billing | the account the owner names — `01B741-62F1F4-49A88C` ("My Billing Account") is the only one visible; Blaze is mandatory for the HTTP check; **no account is linked until the owner says which** |
| Resources | Firestore database; Secret Manager (4 names: 2 test-mode Stripe values, 1 staging endpoint secret, 1 inert placeholder); Cloud Scheduler API; later 2 functions + 1 job + 1 Stripe test-mode endpoint |
| Actions | create project → add Firebase → link named billing account + budget alert → create Firestore → enable 2 APIs → ADC login → set 4 secrets → write local `.env.<staging-id>` |
| Explicitly excluded | touching `project-0b7d3005-bf45-41ea-84b`; any command without `--project`; any production deploy, rules, index, data or Dashboard change; committing the env file; pushing claim files (separate permission) |

~~Unknowns left open on purpose: final project id availability; which billing account; whether the empty project
is kept after cleanup.~~ **All three were answered on the day:** id `salown-staging` was available; billing account
`01B741-62F1F4-49A88C`; the empty project was **kept** (free).

## 10. Execution record — 2026-09-08 (owner-approved B package; no production change)

| Item | Result |
|---|---|
| Project | `salown-staging` (number `902365366985`), display "salOWN staging", created 18:31Z; id was available; "My First Project" untouched |
| Billing | linked to `01B741-62F1F4-49A88C` ("My Billing Account", GBP); budget alert "salown-staging monthly alert" £5 at 50/90/100 % — **a notification, not a cap** |
| Firestore | `(default)` europe-west2 Native; 3 composite indexes deployed from the pinned salown-app workspace (`9a9547a`) → all `READY` (B1 index + the two live production definitions) |
| Rehearsal B (index) | 3 synthetic `pending` bookings + 1 `done`; the sweeper's due-pass query (`settlementSync.state == pending` orderBy `nextAttemptAt` limit 25) returned `idx_a, idx_b, idx_c` in order, no `FAILED_PRECONDITION` |
| Deploy | `stripeWebhook` + `wcSettlementSweeper` only, from the pinned whitecross-site workspace (`8137711b`), us-central1, Node 22 gen2; secrets: 4 names (2 test-mode Stripe values, 1 staging endpoint secret, 1 placeholder); `.env.salown-staging` in the workspace only (`WC_NONPROD_TEST_MODE=1`, account, `WC_STRIPE_LIVEMODE=false`, `WC_SETTLEMENT_START_ISO=2026-09-08T18:00:00Z`) |
| Rehearsal C3/C4 (real GCP HTTP) | Stripe test-mode endpoint `we_1UDTqt…` → `https://us-central1-salown-staging.cloudfunctions.net/stripeWebhook`. Payment `pi_3UDTz3…` (£32.00): Stripe delivered `charge.succeeded` + `charge.updated` (Cloud Logging: 3 × `200`, user-agent `Stripe/1.0`); booking `done` after 8 s with CAPTURED + FEE_ACTUAL, projection `gross_m 3200 / fee_m 124 / actual`, = Stripe balance transaction (net 3076). Real redelivery via `stripe events resend` → `200`, no duplicate entry. Log shows `stripeWebhook[B1] settlement recorded`; the `PAY-2 MODE INVARIANT BLOCKED a confirmation` line is the confirmation path refusing a synthetic booking without checkout metadata — expected and unrelated |
| Rehearsal C5 (scheduler) | endpoint disabled, payment `pi_3UDU0S…` made 18:44:59Z with no webhook; first scheduled pass 19:00:05Z recorded it (`recordedBy: wcSettlementSweeper:scan`, scan `listed 2 / applied 1 / noop 1`); 16 further passes to 22:46Z all `listed 0`, cursor advancing, no unmatched |
| Rehearsal C6 (kill switch) | `settlementLedgerEnabled=false` at 22:54:57Z; pass 23:01:06Z logged `enabled: false, reason: 'DISABLED'`, scan `null`, `scannedUntil` unchanged, bookings untouched |
| Cleanup D | Stripe endpoint deleted (0 staging endpoints remain); both functions + scheduler job deleted; 4 secrets deleted; 8 synthetic documents deleted (0 bookings left); `gcf-artifacts` repository, `gcf-v2-sources-*` and `gcf-v2-uploads-*` buckets deleted; Cloud Run services 0, Pub/Sub topics 0, Eventarc triggers 0 |
| Kept (free) | the empty project, the Firestore database with its 3 READY indexes, the budget alert, the Firebase link. Enabled APIs stay enabled (no cost by themselves) |
| Untouched | `havuz-44f70` (no deploy, no rules/index/data change); `.firebaserc` defaults and `gcloud` default project (`havuz-44f70`) unchanged; both source trees clean |

Corrections during execution (recorded so they are not repeated): the first attempt to capture the Stripe
endpoint's signing secret also captured stdout, so `STRIPE_TEST_WEBHOOK_SECRET` version 1 was corrupt — the
endpoint was deleted and recreated, version 2 stored, version 1 destroyed before any deploy. The Admin SDK
refuses a custom access-token credential for Firestore, so staging reads/writes used the Firestore REST API with
the operator's gcloud user token (no key file, no ADC). `--only functions:whitecross:stripeWebhook,…` (codebase
prefix) is the working deploy filter for this repo.

**Remaining before production (unchanged in kind, now all local to the release itself):** the ordered release in
`PROCESSOR_FEES_PLAN.md` §8 — production indexes deploy (drift closed in `9a9547a`, so no deletion prompt is
expected; still answer *no* to any), production env values (`WC_SETTLEMENT_START_ISO` chosen once), live
`charge.updated` subscription, targeted functions deploy with the flag absent, rules release last with the owner's
separate approval, then the flag. Also open: the sweeper reads only `WC_STRIPE_SECRET_KEY` (correct for
production, noted for any future non-production deploy).
