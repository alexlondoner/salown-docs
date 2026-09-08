# salOWN staging project — setup plan (proposal, nothing executed)

*Written 2026-09-08 under FIN-B1, revised the same day after owner review. This is a **test-environment
preparation plan**. It is not a production release approval. **No approval for creating resources or linking
billing has been given yet**, and none of it has been executed: no project created, no API enabled, no
billing linked, nothing deployed, nothing written.*

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

### A. Setup (one-time, needs the owner's explicit approval — not given yet)
1. Create the project (`salown-staging` or the owner's variant), add Firebase, link the billing account the owner names (Blaze), set a budget alert (notification only).
2. Create Firestore `(default)` in **europe-west2**, Native mode.
3. Enable Secret Manager and Cloud Scheduler APIs (the rest is enabled by the first functions deploy).
4. `gcloud auth application-default login` for the owner account (read-only Admin SDK checks).
5. Set the four secrets on staging (`firebase functions:secrets:set <NAME> --project <staging-id>`), contents as described in §3.
6. Write `whitecross-site/functions/.env.<staging-id>` locally (never committed).

### B. Rehearsal 1 — real composite index
1. Precondition: `FIN-B1-INDEX-DRIFT` (§8) is closed, i.e. the canonical file also carries the two live production indexes. Otherwise the staging deploy proves the B1 index but the same command would later threaten production.
2. `firebase deploy --only firestore:indexes --project <staging-id>` from `salown-app/`.
3. Wait for `READY` (`gcloud firestore indexes composite list --project <staging-id>`); "the minimum build time for an index is a few minutes, even for an empty database".
4. Seed 3 synthetic bookings with `settlementSync.state = 'pending'` and different `nextAttemptAt`; run the exact sweeper query (`where state == 'pending' orderBy nextAttemptAt limit 25`) through the Admin SDK — ordered results, no `FAILED_PRECONDITION`.

### C. Rehearsal 2 — real GCP HTTP delivery
1. `firebase deploy --only functions:stripeWebhook,functions:wcSettlementSweeper --project <staging-id>` from `whitecross-site/` (pinned commit; the B1 files must be committed first — this is the moment the local B1 work is committed to a branch; still no production deploy).
2. Create the Stripe test-mode endpoint with the staging `stripeWebhook` URL; store its signing secret as `STRIPE_TEST_WEBHOOK_SECRET` (redeploy if the secret version was created after step C1).
3. Seed one booking + `settlementLedgerEnabled=true`; one test payment (unconfirmed PI → seed → confirm, as in the local rehearsal).
4. Verify in staging Firestore: `settlementSync.state = done`, CAPTURED + FEE_ACTUAL entries, projection = Stripe balance transaction; Cloud Logging: `settlement recorded`. Resend the event from Stripe → 200, no duplicate entry.
5. Withhold the webhook for a second booking (temporarily disable the endpoint), pay, wait ≤15 min: the scheduler-driven sweeper must record it (`wcSettlementSweeper: pass complete`).
6. Flip `settlementLedgerEnabled=false`; the next sweeper pass must log the disabled reason and write nothing.

### D. Cleanup
1. Delete the Stripe test-mode endpoint.
2. `firebase functions:delete stripeWebhook wcSettlementSweeper --project <staging-id>`; confirm the scheduler job is gone.
3. `functions:secrets:destroy` ×4 (verify no active versions remain); delete the synthetic `tenants/whitecross` subtree.
4. Delete leftover images in `gcf-artifacts` and the `gcf-v2-sources-*` / `gcf-v2-uploads-*` buckets (§4 table); check the billing report once after the next cycle.
5. Delete the local `.env.<staging-id>` or keep it for the next rehearsal (it holds no secrets).
6. Keep the empty project (free) or delete it — owner's call.

## 8. Separate release blocker — `FIN-B1-INDEX-DRIFT` (production, not this rehearsal)

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

**Closing it (a separate, owner-approved change — not done in this round):** add the two definitions above to
`firestore.indexes.json` (without the implicit `__name__`), commit under its own claim, and only then run the
indexes deploy — answering *no* to any deletion prompt regardless. **Nothing was changed and no index was
deleted in this round**; the canonical file is untouched by this plan.

## 9. Approval that will be requested (not yet granted)

Setup step A only (no rehearsal yet):

| What | Value |
|---|---|
| Project | new Firebase project, proposed id `salown-staging` (owner confirms or supplies the id), display name "salOWN staging" |
| Region | Firestore europe-west2 Native; functions us-central1 |
| Billing | the account the owner names — `01B741-62F1F4-49A88C` ("My Billing Account") is the only one visible; Blaze is mandatory for the HTTP check; **no account is linked until the owner says which** |
| Resources | Firestore database; Secret Manager (4 names: 2 test-mode Stripe values, 1 staging endpoint secret, 1 inert placeholder); Cloud Scheduler API; later 2 functions + 1 job + 1 Stripe test-mode endpoint |
| Actions | create project → add Firebase → link named billing account + budget alert → create Firestore → enable 2 APIs → ADC login → set 4 secrets → write local `.env.<staging-id>` |
| Explicitly excluded | touching `project-0b7d3005-bf45-41ea-84b`; any command without `--project`; any production deploy, rules, index, data or Dashboard change; committing the env file; pushing claim files (separate permission) |

Unknowns left open on purpose: final project id availability; which billing account; whether the empty project
is kept after cleanup.
