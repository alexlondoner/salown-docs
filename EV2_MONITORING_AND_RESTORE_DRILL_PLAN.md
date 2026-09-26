# EV2 — monitoring, alerting and restore-drill plan (read-only audit + proposal)

*Written 2026-09-26 (evidence timestamps below are UTC). Read-only: no production config change, no
restore, no deploy, no merge, no data write, no e-mail. ROADMAP `EV2` stays `PLANNED` until the owner
approves the steps in §8; this file is the technical detail, ROADMAP keeps the status badge.*

## 1. Current state (what is true today)

| Area | State | Evidence (read-only, 2026-09-26) |
|---|---|---|
| Firestore `(default)` `havuz-44f70` | europe-west2, Native, Standard edition | `firebase firestore:databases:get` 11:4xZ |
| **Point-in-time recovery (PITR)** | **ENABLED**, retention `604800s` (7 days), earliest version `2026-09-19T11:48Z` | same call |
| **Managed daily backup schedule** | **EXISTS since 2026-06-10**, `DAILY`, retention `8467200s` (**14 weeks**, the maximum) | `firestore:backups:schedules:list` |
| Managed backups | one `READY` backup per night, snapshot ≈ 01:10–02:25Z; the newest is `2026-09-26T02:24:08Z`; the first page lists 9 (18–26 Sep) | `firestore:backups:list` |
| Delete protection on `(default)` | ~~DISABLED~~ → **`DELETE_PROTECTION_ENABLED` since 2026-09-26T12:25:50Z (S1, owner-approved; ledger `OPS-2026-09-26-A`)** | `firestore:databases:get` before 12:25:16Z and after 12:26:07Z |
| `dailyFirestoreBackup` export function (v2, europe-west2, 03:00 London) | deployed; log shows `Export started` for 19, 20, 21, 22 Sep (`operationState: PROCESSING`) | `functions:log --only dailyFirestoreBackup` (pagination unreliable, see memory) |
| Export **completion** (`overall_export_metadata` per day folder) | **NOT VERIFIED** — needs a Storage object listing (no Firebase CLI command; gcloud/gsutil forbidden by AGENTS.md; the REST/token path was blocked in this session) | — |
| Bucket lifecycle (`firestore-backups/` age>30 → delete) | recorded in INCIDENTS 2026-07-13; **NOT re-verified** today | INCIDENTS.md |
| Backup failure alarm | code path: Brevo e-mail to `info@salown.com` + rethrow; verified live once on 2026-07-13 | `functions/src/index.ts` `dailyFirestoreBackup` |
| Cloud Monitoring alert policies / uptime checks / notification channels | **NOT VERIFIED** — no Firebase CLI surface; assume **none** (nothing in any doc, SYNC or ledger ever mentions one) | docs grep: 0 hits for "uptime"/"alert policy" outside EV2 itself |
| Cloud Scheduler job state | not read directly; indirect evidence = the nightly `Export started` log lines | functions:log |
| Hosting surfaces | all `200 text/html` in 70–290 ms: `salown.com/`, `/app`, `/book/whitecross`, `/s/whitecross`, `staff.salown.com`, `salown-staff.web.app`, `salown.web.app/app`, `whitecrossbarbers.com` | curl 11:48:24Z |
| Hosting sites in the project | `havuz-44f70`, `havuz-44f70-admin`, `havuz-44f70-mobile`, `salown`, `salown-admin`, `salown-staff`, `whitecrossbarbers-admin`, … (list truncated; `whitecrossbarbers-saas` is the live whitecross site per memory) | `hosting:sites:list` |
| Staging project `salown-staging` | exists, `(default)` europe-west2 Native, **PITR disabled, no backup schedule**, empty except 3 indexes | `firestore:databases:get --project salown-staging` |
| EV2 health-check function | **does not exist** (grep `onSchedule(` → only `salownParseEmails`, `dailyFirestoreBackup`, `salownCleanupExpiredPending`) | source |
| Repo docs on backups | only the export function + the 07-13 incident. **The managed backup schedule and PITR are documented nowhere** in the repo | docs grep |

**Two verification gaps caused by this session's tooling, not by the platform:** the Cloud Monitoring
and Cloud Storage reads need either the Console or a bearer token; the token path (`~/.config/configstore`
refresh token → REST, the pattern used by `scripts/testAvailabilityRules.py`) was refused by the
session's permission classifier, so those rows are `NOT VERIFIED` rather than "none".

## 2. Gap list

| # | Gap | Why it matters |
|---|---|---|
| G1 | ~~No external uptime check~~ **closed 2026-09-26 (S2a: five checks live, §3.1)**; availability now measurable, still not alerted (G1b → S2b) | first "your site is down" ticket has no timeline |
| G2 | No alert on function failures (`dailyFirestoreBackup`, `salownParseEmails`, `salownCreateBooking`, `salownStripeWebhook`) except the backup's own e-mail | a silent nightly failure repeats INCIDENTS 07-13 |
| G3 | No "absence" alert: if the backup job never *starts*, no error is logged and no e-mail goes out | the 07-13 class of failure, one level up |
| G4 | Delete protection is off on the production database | one wrong `databases:delete` is irreversible beyond PITR/backup |
| G5 | Restore has **never been rehearsed**; RPO/RTO are unmeasured | a backup that was never restored is a hypothesis |
| G6 | Two backup mechanisms (managed backups 14 w + export 30 d) run in parallel and only the export is documented; nobody knows which is the recovery path | wrong tool under pressure |
| G7 | Export completion is not verified by anything after "Export started" | `PROCESSING` ≠ done |
| G8 | Backup storage cost is unknown (14 weeks × daily full snapshots) | could be the largest Firestore line item |
| G9 | Staging has no PITR/backups — fine for staging, but it must not become a restore target by accident | scope hygiene |

## 3. Proposed alert + uptime plan (Cloud Monitoring, production config change → needs approval)

### 3.1 Uptime checks — ✅ U1–U5 CREATED 2026-09-26 (S2a, ledger `OPS-2026-09-26-B`)

Created in the Cloud Console (owner session; no gcloud, no REST, no CLI credential file), one at a time, each
verified read-only on its details page before the next. **No alert policy, log-based metric or notification
channel exists** — the form's "Create an alert" toggle defaults to ON and was switched off on every check.

**Common settings (all five, read back from the details page):** HTTPS `GET` · port 443 · check every `300s`
· timeout `10s` · regions `EUROPE, ASIA_PACIFIC, USA_VIRGINIA` (Global off) · SSL validation enabled ·
acceptable response code **200 only** · content matcher `CONTAINS_STRING` · no auth, no custom headers · no
policies. Redirect following is **not configurable** in the Console or the API; "200 only + matcher" covers it.

| Display name | URL | Matcher (`CONTAINS_STRING`) | Source of the marker | Pre-create test |
|---|---|---|---|---|
| `prod-salown-landing` | `https://salown.com/` | `Salon Operating System for UK Barbers` | `salown-app/hosting/index.html:14` `<title>` | 200, 49 ms |
| `prod-salown-admin-shell` | `https://salown.com/app` | `Own your salon.</title>` | `salown-app/index.html:18` `<title>` | 200, 61 ms |
| `prod-salown-booking-shell` | `https://salown.com/book/whitecross` | `href="/public-bundle/site.webmanifest"` | `salown-app/index.html:25` + `vite.config.js:10` `base` | 200, 134 ms |
| `prod-salown-staff-shell` | `https://staff.salown.com/` | `<div id="staff-root">` | `salown-app/staff.html:176` | 200, 142 ms |
| `prod-whitecross-site` | `https://whitecrossbarbers.com/` | `Whitecross EC1</title>` | `whitecross-site/index.html:23` `<title>` | 200, 16 ms |

**Scope limit — `prod-salown-booking-shell`:** `/app` and `/book/whitecross` serve byte-identical HTML (2,043 B);
the tenant name is rendered by JavaScript, which uptime checks do not execute. This check proves the `/book/**`
rewrite serves the salOWN booking shell and nothing else. It is **not** a tenant, Firestore or booking-API
health signal; that belongs to `U6`/`S5`.

**Matcher-change rule:** every matcher is pinned to a versioned source line above (no hashed chunk names). A PR
that edits one of those lines must update the corresponding uptime check in the same change, and say so in
its ledger row. A matcher that fails after a deploy with the page otherwise healthy is a doc/config drift, not
an outage.

**First measurements (13:0xZ):** every region that had probed was green. One event: the very first
`usa-virginia` probe of `prod-salown-landing` at `12:56:19Z` logged `REQUEST_EXCEPTION` — *"libcurl request
failed: Timeout was reached (Operation timed out after 10002 milliseconds with 0 bytes received)"*,
`content_mismatch: false`. The next cycle from the same region was green. Classified as a **single regional
connection timeout, not an outage** — and the reason S2b's condition must not fire on one region / one cycle.

| Check | URL | Notes |
|---|---|---|
| U6 (phase 2) booking API | POST `salownGetBusySlots` with a fixed body | proves the callable path, not just Hosting — **not created** |

Volume: 5 checks × 3 regions × 8,640/month ≈ **130 k executions/month → inside the 1 M free allotment**.

### 3.2 Alert policies

| Policy | Condition | Channel |
|---|---|---|
| A1 site down | any uptime check fails in ≥2 regions for 5 min | e-mail |
| A2 function errors | Cloud Run `request_count` `response_code_class=5xx` > 0 for 5 min on `salowncreatebooking`, `salownstripewebhook`, `provisiontenant` | e-mail |
| A3 backup failed | log-based: `resource.labels.service_name="dailyfirestorebackup" AND severity>=ERROR` | e-mail (duplicate of the Brevo path — deliberately independent) |
| A4 backup absent | log-based metric on `textPayload:"Export started"`; **metric absence** > 26 h | e-mail — closes G3 |
| A5 parser stalled | metric absence on `salownparseemails` invocations > 30 min | e-mail |
| A6 scheduler failed | Cloud Scheduler job `status` not OK (log-based on `cloudscheduler.googleapis.com` `jsonPayload.status`) | e-mail |

Notification channel: **e-mail `info@salown.com`** only (the one human mailbox). Telegram can be added
later through a Pub/Sub channel → small function; not in this package.

### 3.3 EV2 daily availability doc (code, separate one-change release — NOT in the config package)

A scheduled function `salownHealthProbe` (every 5 min) GETs U1–U5, writes
`platform/health/daily/{YYYY-MM-DD}` with `{probes, ok, total}`; a monthly % falls out by division.
Cloud Monitoring is the external prover; the daily doc is the number for METRICS.md (EV3). Ships via
`./scripts/deploy-functions.sh salownHealthProbe` after emulator proof, one change at a time.

## 4. Restore drill plan (production restore operation → needs approval)

**Which backup:** the newest `READY` managed backup (snapshot `2026-09-26T02:24:08Z` at the time of
writing; re-read `firestore:backups:list` on the day and pick the newest).
**Why the managed backup, not the export:** it is the mechanism with 14-week retention and a one-command
restore; the export path stays as the second copy (and G7 gets its own check).

**Where:** a **new database in the same project**, id `drill-YYYYMMDD`, same location (the API creates it
in the backup's location; a different project is not the documented path — see sources). `(default)`
is never the target. Staging is **not** used (cross-project restore not documented; export→import into
staging would need a bucket IAM grant on production = a production change for no extra proof).

**How it is proven without writing production:**
1. `firebase firestore:databases:restore -b projects/havuz-44f70/locations/europe-west2/backups/<backup-id> -d drill-YYYYMMDD --project havuz-44f70`
   (record `T0` = command time; the operation's `endTime` = `T1`). *Corrected 2026-09-26: firebase-tools 15.15.0 has no
   `firestore:backups:restore`; the restore command lives under `firestore:databases:restore` with `-b`/`-d` (verified from `--help`).*
2. Read-only verification against **the drill database only** (`databases/drill-YYYYMMDD`):
   aggregation `count()` on `tenants`, `tenants/whitecross/bookings`, `tenants/herohairs/bookings`,
   `tenants/whitecross/clients`; compare with the same counts read from `(default)` **at the backup's
   snapshot time using PITR `readTime`** (so both sides describe the same instant, and the live database
   is only read). Spot-check 3 documents by id-less field match (no ids in the log).
3. Confirm no client can reach the drill database: no ruleset is released for it and no app passes a
   `databaseId` — verify by an unauthenticated REST read → 403.
4. **Delete the drill database** (`firebase firestore:databases:delete drill-YYYYMMDD`) — it has no
   delete protection; record `T2`.
5. Write the record (§5) and add the runbook to `docs/DEPLOY.md` → "Recovery".

**Verification-script constraint:** the counts need a credential (Admin SDK key or CLI token). In this
session both paths are blocked by the permission classifier; the owner runs the script or grants the
Bash rule. The script is read-only and prints counts only.

## 5. RPO / RTO record (format)

| Field | Value |
|---|---|
| Backup used | snapshot time (UTC) + short id |
| **RPO (measured)** | `incident time − snapshot time` worst case ≈ **24 h** for managed backups; **≤ 1 min within 7 days** via PITR (`readTime` / in-place restore) |
| **RTO (measured)** | `T1 − T0` (restore) + verification time + app re-pointing time (not applicable to a drill; note it) |
| Data parity | counts per collection: backup vs `(default)@readTime` |
| Cost observed | Billing report line for the day |
| Recorded in | `docs/RELEASE_LEDGER.md` as `DRILL-2026-MM-DD-A` (no deployable unit) + ROADMAP `EV2` note |

## 6. Cost and risk

| Item | Estimate | Source |
|---|---|---|
| Uptime checks | £0 (≈156 k of 1 M free executions) | Observability pricing |
| Alert policies / e-mail channel | £0 now; metered from **Sept 2027** ($0.35 per metric reference/month) | Observability pricing |
| Log-based metrics | £0 at this log volume | — |
| Restore drill | restore ≈ **$0.40 per GiB** of backup + a few hours of stored data for the drill db; **database size is unknown from the CLI** → read it in Console → Firestore → Usage before approving. A ≤2 GiB database ≈ under £1 | Firestore pricing |
| Managed backups already running | backup storage ≈ **$0.03 per GiB-month × ~98 retained snapshots** (each a full copy); a 2 GiB database ≈ **$6/month**, 10 GiB ≈ $30/month — check the Billing report (G8) | Firestore pricing |

Risks: (a) a restore is a production-project write (new database) — mitigated by a non-default id and
immediate deletion; (b) deleting the wrong database — mitigated by enabling delete protection on
`(default)` **first** (G4) so a mistyped delete fails; (c) alert fatigue — start with A1/A3/A4 only if the
owner prefers; (d) uptime checks hitting `/book/whitecross` add ≈26 k requests/month to a public page —
negligible.

## 7. IAM / permissions required

The CLI account holds `roles/owner` on `havuz-44f70` (verified 2026-09-08, STAGING_PROJECT_PLAN §0);
owner covers everything below, so **no new grant is needed for the human**:

| Action | Permission / role |
|---|---|
| Create uptime checks, alert policies, channels | `roles/monitoring.editor` (`monitoring.uptimeCheckConfigs.create`, `monitoring.alertPolicies.create`, `monitoring.notificationChannels.create`) |
| Log-based metrics | `roles/logging.configWriter` |
| Restore a backup | `roles/datastore.restoreAdmin` + `datastore.databases.create` |
| Delete the drill database | `datastore.databases.delete` (`roles/datastore.owner`) |
| Enable delete protection | `datastore.databases.update` |
| Read Storage export folders (G7) | `roles/storage.objectViewer` on `havuz-44f70.firebasestorage.app` |

Nothing here needs `gcloud`: uptime/alerts are Console (or Monitoring REST), restore/delete/protection
are `firebase firestore:*` subcommands.

## 8. Steps that need explicit owner approval (each separately, one at a time)

| Step | Change | Reversible? |
|---|---|---|
| S1 | ✅ **DONE 2026-09-26T12:25:50Z** — delete protection on `(default)` `ENABLED` via `firebase firestore:databases:update "(default)" --delete-protection ENABLED --project havuz-44f70`; the CLI's PATCH body carried only `deleteProtectionState` (source-verified: the undefined PITR key is dropped by `JSON.stringify`); PITR `ENABLED/604800s`, backup schedule (`2026-06-10`) and `salown-staging` (`updateTime 2026-09-08T18:32:48Z`) re-read unchanged | yes (same flag, `DISABLED`) |
| S2a | ✅ **DONE 2026-09-26 ~12:52–13:00Z** — U1–U5 uptime checks created (§3.1); no policy, metric or channel | yes (delete) |
| S2b | A1/A3/A4 alert policies + e-mail channel `info@salown.com` — **not before 2026-09-27 14:05Z** and only after a read-only 24 h S2a report (per-region success rate, latency, timeout/error count, matcher failures). Condition under review: **two or more regions failing for two consecutive cycles** instead of "≥2 regions for 5 min", so a single regional connection timeout never e-mails | yes (delete) |
| S3a | Restore newest backup → `drill-YYYYMMDD`, verify read-only, record RPO/RTO; drill db **kept** for owner review (≤48 h); drill db IAM access model recorded first — an unauthenticated 403 proves only that public access is closed | `(default)` untouched |
| S3b | Delete the drill db — **separate approval, only after the S3a evidence is reviewed** (`firestore:databases:delete`, no `--force`) | irreversible for the copy only |
| S4 | A2/A5/A6 policies (function errors, parser stall, scheduler) | yes |
| S5 | `salownHealthProbe` function (code) — separate release via one-change flow | rollback = previous revision |

Not requested and not recommended now: changing the managed backup retention, touching the export
function, any Telegram bridge, any staging restore.

## Sources

- Firestore backups: https://firebase.google.com/docs/firestore/backups
- Restore reference: https://docs.cloud.google.com/sdk/gcloud/reference/firestore/databases/restore
- Firestore pricing: https://cloud.google.com/firestore/pricing
- Observability pricing: https://cloud.google.com/products/observability/pricing
