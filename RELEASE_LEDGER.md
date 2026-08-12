# RELEASE_LEDGER.md — one row per release, per deployable unit

> **What this is.** The structured, append-only record of **what is actually running in
> production**, one row per release event per deployable unit. It answers *"which source produced
> the bytes serving customers right now, and how do I roll back?"* — nothing else.
>
> **What it is not.**
> [ROADMAP.md](ROADMAP.md) = status of the work · [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md) =
> the narrative push-vs-live story and *why* a gap exists · `salown-app/SYNC.md` = the human day
> log across devices · `salown-app/ops/claims/` = who owns which path right now.
> A release that appears in prose but not here **has not been recorded**.
>
> **Created 2026-08-12** by `REL-2` (ROADMAP-MASTER-TRUTH-RECONCILIATION). Everything before that
> date is backfilled **only where reliable evidence exists**; where it does not, the row says
> `UNKNOWN` and says so out loud. Historical source SHAs are never invented.

---

## Deployable units

| Unit | Repo | Target | Released by |
|---|---|---|---|
| **U1 salOWN Admin + landing + public booking + salon pages** | `salown-app` | `hosting:salown` | CI on push to `main` touching the Admin allow-list, **or** hand |
| **U2 Staff App** | `salown-app` | `hosting:salown-staff` | **hand only** (`npm run deploy:staff`) — CI cannot reach it |
| **U3 Super Admin** | `super-admin` | `hosting:salown-admin` | hand |
| **U4 Whitecross premium site** | `whitecross-site` | `hosting:whitecrossbarbers-saas` | hand, `firebase.saas.json` only |
| **U5 Functions — codebase `salown`** | `salown-app` | `functions:salown:<name>` europe-west2 | hand, **always targeted, never blanket** |
| **U6 Functions — codebase `whitecross`** | `whitecross-site` | `scripts/deploy-functions.sh` | hand |
| **U7 Firestore rules** | `salown-app` | `firestore:rules` | hand, **always LAST** |
| **U8 Firestore indexes** | `salown-app` | `firestore:indexes` | hand |
| **U9 Production data migration / feature activation** | — | Firestore | hand, owner-authorised, dry-run first |

## Required fields — a row is incomplete without all of them

`date/time UTC` · `environment` · `repository` · `exact source SHA` (or an explicit `UNKNOWN`) ·
`clean-tree proof` · `Firebase project` · `codebase / hosting target` · `previous live identity` ·
`new live identity` · `included commits` · `tests` · `verification` · `rollback identity` ·
`operator/device` · `result` · `known exclusions`.

**`UNKNOWN` is a legitimate value and a lying value is not.** Write `UNKNOWN` and move on.

---

## Live state at the last reconciliation — `2026-08-12T14:26:31Z`

| Unit | Live identity | Released (UTC) | Source | Provenance |
|---|---|---|---|---|
| U1 | version `11cc739f548c5e10` · release `1786493555545000` | 2026-08-12T00:12:35.545Z | **UNKNOWN** | R-2026-08-12-A |
| U2 | version `b9a396c48836840f` · release `1786389184539000` | 2026-08-10T19:13:04.539Z | `eac5a95` | R-2026-08-10-D |
| U3 | version `9f457fc2c8ee4b35` · release `1785493665740000` | 2026-07-31T10:27:45.740Z | `51e70a0` | R-2026-07-31-A |
| U4 | version `e6be08684d312ce7` · release `1786401587236000` | 2026-08-10T22:39:47.236Z | **UNKNOWN / HYBRID** | R-2026-08-10-F |
| U5+U6 | 108 functions (81 `europe-west2` + 27 `us-central1`); labels `salown` 76 · `whitecross` 30 · unlabelled 2 | — | per function | see rows |
| U7 | ruleset `640c3dae-a9c8-4cb3-80c4-bc189e72874a` | updated 2026-08-05T12:52:07Z | not proven against the file | R-2026-08-05-R |
| U8 | 2 composite indexes, both `READY` | UNKNOWN | **UNKNOWN** — the repo declares 0 | ⚠️ see U8 warning |

> ⚠️ **U8 warning.** `salown-app/firestore.indexes.json` declares **0 indexes** and 1 field
> override, while production runs **2 composite indexes**. A `firebase deploy --only
> firestore:indexes` today would propose **deleting both**. Export the live definition into the
> file before any index deploy. ROADMAP `TEC-6`.

---

# Releases

Newest first. One `###` heading per release event.

## 2026-08-12

### R-2026-08-12-A — U1 `hosting:salown` — ⚠️ RECONSTRUCTED, SOURCE UNPROVABLE

| Field | Value |
|---|---|
| **Date/time (UTC)** | 2026-08-12T00:12:35.545Z |
| **Environment** | production |
| **Repository** | `salown-app` |
| **Source SHA** | **UNKNOWN** — see *provenance* |
| **Clean-tree proof** | **NONE** — no pre-release status was recorded |
| **Firebase project** | `havuz-44f70` |
| **Target** | `hosting:salown` |
| **Previous live identity** | `3a0fcdea1e1f8434` (release `1786368571831000`) |
| **New live identity** | **`11cc739f548c5e10`** · release `1786493555545000` |
| **Included commits (proven by served bytes, not by log order)** | `9af1272` BARBER-HOURS-PROPAGATION-RACE-P0 · `01bfebe` CAMPAIGN-LIFECYCLE-PARITY frontend · `e1df13a` TR-DEMO-ADMIN-LOCALIZATION-P0 · `ac5b156` landing demo-request popup |
| **Tests** | UNKNOWN — no gate record exists for this release |
| **Verification** | Retrospective, 2026-08-12, read-only: served `index-CjxIhWAr.js`; `Settings-ZjvTQcBn.js` contains ``source:`salon` `` + `` `dayHours.${…}` `` (⇒ `9af1272`); entry chunk contains `⚡ Bonus points earned` and neither `Double Points — Active` nor `2× loyalty points` (⇒ `01bfebe`); `🛍 Ürün ekle` / `dk kapatıldı` / `1,5 saat` (⇒ `e1df13a`); served landing contains `wl-spinner` (⇒ `ac5b156`); `` · from ${…formatMoney(t)}`` (⇒ `d726b1b`, carried from the previous release) |
| **Rollback identity** | `3a0fcdea1e1f8434` |
| **Operator/device** | UNKNOWN |
| **Result** | Live and working. **Provenance lost.** |
| **Known exclusions** | No Functions, rules, indexes or Storage changed. `salown-staff` unmoved. |

> **Why the source is UNKNOWN, and why that matters.** `ac5b156` is served, and it was **committed
> at 00:13:21Z — 46 seconds *after* this release finalised**. So the release was built from a tree
> that was not a commit. There is no `SYNC.md` line, no `DEPLOYMENT_STATUS.md` row and no commit
> message in any repo naming `11cc739f548c5e10` or `1786493555545000`.
>
> **Two live consequences were introduced by this release and are still open:**
> ① `01bfebe` made the salOWN booking page resolve campaigns from `tenants/{tid}/public/campaign`
> through a **fail-closed** resolver, while the publisher (`c8036f0`) is **not deployed** and no
> mirror carries `multiplier` — so the repair shipped without taking effect (ROADMAP `CAM-1`/`CAM-3`).
> ② `9af1272` is `LIVE_VERIFIED`, which **unblocks HOURS-SSOT-C** — and nobody knew, because the
> release was never recorded.

### R-2026-08-11-F — U5 `adminPurgeTenant` — ⚠️ DEPLOY→COMMIT

| Field | Value |
|---|---|
| **Date/time (UTC)** | 2026-08-11T23:59:33.258Z |
| **Environment** | production · `havuz-44f70` · europe-west2 · codebase `salown` |
| **Repository** | `salown-app` |
| **Source SHA** | **UNKNOWN as a commit** — the content is `d316893`, which was committed at 2026-08-12T00:00:22Z, **49 seconds after the deploy** |
| **Clean-tree proof** | NONE |
| **Target** | `functions:salown:adminPurgeTenant` |
| **Previous live identity** | `adminpurgetenant-00011-*` (exact predecessor not recorded) |
| **New live identity** | **`adminpurgetenant-00012-vav`** |
| **Included commits** | content of `d316893` only |
| **Tests** | UNKNOWN |
| **Verification** | 2026-08-12, read-only: the deployed source package downloaded via `generateDownloadUrl` contains `` superAdmin/backups/entries/${backupId} `` in **both** `lib/index.js:3424` and `src/index.ts:3582`. `LIVE_VERIFIED` |
| **Rollback identity** | previous revision (not recorded) |
| **Operator/device** | UNKNOWN |
| **Result** | Correct behaviour; provenance and rollback anchor incomplete |
| **Known exclusions** | one function; nothing else touched |

### R-2026-08-11-W — U5 intake repair (recorded in `SYNC.md`, promoted here)

| Field | Value |
|---|---|
| **Date/time (UTC)** | 2026-08-11T22:54:48Z – 22:54:55Z |
| **Repository / target** | `salown-app` → `functions:salown:{provisionTenant, addToWaitlist, approveApplication}`, europe-west2 |
| **Source SHA** | UNKNOWN (redeploy from codebase `salown`; the point of the deploy was the *codebase*, not a new commit) |
| **Previous → new** | `provisiontenant-00136-taj` → **`-00137-bij`** · `addtowaitlist-00037-weg` → **`-00038-fof`** · `approveapplication-00013-yob` → **`-00014-yup`** |
| **Verification** | 2026-08-12 label sweep: all three carry `firebase-functions-codebase: salown`. Behavioural proof: the first apply→approve owner account since 2026-07-13 (`dayi-barbers`, owner signed in and completed onboarding) |
| **Rollback identity** | `-00136-taj` / `-00037-weg` |
| **Operator/device** | Ubuntu · `alby23` (reconstructed by macOS · `alish` 2026-08-12) |
| **Result** | 22-day intake outage closed |
| **Known exclusions** | no hosting, rules, indexes |

## 2026-08-10

### R-2026-08-10-F — U4 Whitecross public — ⚠️ HYBRID ARTEFACT

| Field | Value |
|---|---|
| **Date/time (UTC)** | 2026-08-10T22:39:47.236Z |
| **Repository** | `whitecross-site` |
| **Source SHA** | **UNKNOWN / HYBRID** — hand-composed hotfix artefact, not built from `main`. Content of `1b92584d` (exposure containment) + the `bacfda34` hours fix, **without** `bc25d257` |
| **Clean-tree proof** | NONE (deliberate hotfix composition) |
| **Target** | `hosting:whitecrossbarbers-saas` via `firebase.saas.json` |
| **Previous → new** | `7968b392f63b629c` → **`e6be08684d312ce7`** (release `1786399405078000` → `1786401587236000`) |
| **Tests** | 19/19 internal paths 404 · 27/27 customer paths 200 · published files 3,684 → 59 |
| **Verification** | 2026-08-12 re-verified read-only: served `script.js` sha256 **`ffa63589e2dc38d42199fbefb35d5a7357b12704a6512dcbaa2f1c7aaae77637`** (unchanged); reads `public/profile` ×4 (hours fix present); `SALON_TIMEZONE` / `resolveActiveCampaign` / `fmtCampaignDate` **all absent**; served `index.html` still carries `Double Points — Live Now` + hardcoded `2× loyalty points` and **no** `doublePointsMultiplier` ⇒ **`bc25d257` proven absent** |
| **Rollback identity** | `7968b392f63b629c` |
| **Operator/device** | macOS · `alish/wc-hosting-containment` |
| **Result** | Repository exposure closed; artefact provenance not reproducible |
| **Known exclusions** | no functions, rules, indexes; no customer-facing asset changed |

> ⛔ **Deploying `origin/main` to U4 is BLOCKED** until a reproducible release anchor exists
> (ROADMAP `REL-4`/`WCP-1`) — `main` carries the held W1 C1-cutover *and* `bc25d257`, and
> `bc25d257` against today's multiplier-less mirror would blank a banner that is live right now.
> **`firebase.public-site.json` is UNSAFE** (9 ignore entries vs 25) and would re-publish the
> repository. `firebase.saas.json` is the only approved config.

### R-2026-08-10-E — U5 Whitecross-hours 4 Functions

| Field | Value |
|---|---|
| **Date/time (UTC)** | 2026-08-10T22:01:34Z – 22:01:39Z |
| **Repository / source** | `salown-app` @ `067b2f3` |
| **Target** | `functions:salown:{salownPublishProfile, salownReviewProfile, salownRepublishProfileOnEdit, salownRepublishOnSettingsEdit}` |
| **Previous → new** | `-00029-zon`→**`-00030-woy`** · `-00029-ved`→**`-00030-niy`** · `-00026-ner`→**`-00027-nef`** · `-00001-wib`→**`-00002-vut`** |
| **Verification** | `specialHours` joined the public profile projection; 2026-08-12 sweep confirms all four revisions still live |
| **Rollback identity** | the four `-000NN` predecessors above |
| **Operator/device** | macOS · `alish/wc-hours-live` |
| **Result** | Success |

### R-2026-08-10-D — U2 Staff App — ⚠️ WAS UNRECORDED

| Field | Value |
|---|---|
| **Date/time (UTC)** | 2026-08-10T19:13:04.539Z |
| **Repository** | `salown-app` |
| **Source SHA** | **`eac5a95`** (TR-STAFF-LOCALIZATION-P0, "reconcile tracked Staff artifact with production") |
| **Clean-tree proof** | not recorded at the time; **byte parity establishes it retrospectively** |
| **Target** | `hosting:salown-staff` |
| **Previous → new** | `926999f6f3edddde` (19:07:42Z, same evening) → **`b9a396c48836840f`**; the version before both was `d8de0132fd465ef9` |
| **Included commits** | `dde52ab`, `06650c4`, `1f13ef3`, `eac5a95` (TR-STAFF-LOCALIZATION-P0) — and, already in the tree, `234441d` O1S-STAFF-CREATE-CUTOVER |
| **Tests** | claim release `1c04e92` records "gates green"; exact counts not recorded |
| **Verification** | 2026-08-12: served `/assets/staff-BhghYLPT.js` sha256 **`d7410dee99b255dafbddffc35ba34e8329edc7917bfc1dc0567659d85739da35`** is **byte-identical** to the tracked `hosting/staff-bundle/assets/staff-BhghYLPT.js`; carries Turkish (`Randevusuz`, `Müşteri`, `Bugün`) and `salownCreateWalkIn` with no bare `createWalkIn`. **`LIVE_VERIFIED`; this also closes the 2026-08-10 "classification owed" note on `234441d`.** |
| **Rollback identity** | `926999f6f3edddde`, then `d8de0132fd465ef9` |
| **Operator/device** | macOS · `alish/tr-staff-l10n` (from the claim id) |
| **Result** | Success |
| **Known exclusions** | Functions, rules, indexes, `hosting:salown` untouched |

> Recorded here for the first time on 2026-08-12. It appeared in the claim-release commit message
> `1c04e92` and in **neither** `SYNC.md` nor `DEPLOYMENT_STATUS.md`. A whole work item
> (TR-STAFF-LOCALIZATION-P0) was invisible to the roadmap until this reconciliation.

### R-2026-08-10-C — U5 `salownGetBusySlots` (HOURS-CASING-B)

| Field | Value |
|---|---|
| **Date/time (UTC)** | 2026-08-10T13:47:08Z |
| **Repository / source** | `salown-app` @ `10febff` |
| **Target** | `functions:salown:salownGetBusySlots` |
| **Previous → new** | `salowngetbusyslots-00063-hab` → **`-00064-foj`** |
| **Tests** | functions 1321/0 · emulator 419/419 · deploy-policy 28/28 · RED/GREEN 8-of-21 → 21/21 |
| **Verification** | live on production data, zero writes (whitecross Sunday `10:00–16:00`, herohairs `10:00–17:00`). 2026-08-12 sweep: still `-00064-foj`. **Not proven live:** the lowercase-legacy and `closed:true` branches — no live tenant carries either shape |
| **Rollback identity** | `-00063-hab` |
| **Operator/device** | macOS · `alish/hours-casing-b` |
| **Result** | Success · 108 functions before and after, exactly one revision changed |

### R-2026-08-10-B — U1 ADMIN-PENDING-SLICES-RELEASE

| Field | Value |
|---|---|
| **Date/time (UTC)** | 2026-08-10T13:29:31.831Z |
| **Repository / source** | `salown-app`, **pinned `25f39c1`**, range `b94b8fa..25f39c1` (11 commits), deployed from an **isolated clone** |
| **Clean-tree proof** | isolated clone pinned to a commit — the shared tree held 7 uncommitted files from 3 peer sessions |
| **Target** | `hosting:salown` |
| **Previous → new** | `ffbc7898e4a8556e` → **`3a0fcdea1e1f8434`** (release `1786368571831000`) |
| **Included commits** | `d726b1b` TR-CURRENCY-G · `afb40fb` MULTI-LOCATION-PRE-B · `c942329` HOURS-SAFETY-A + PACKAGE-EDITOR-RESTRICTION-ROUNDTRIP |
| **Tests** | 118/118 served files byte-identical to the gated build, 0 non-200 |
| **Verification** | `/app` `index-Dr9fNRee.js` → `index-BeHw3XM5.js`, live sha256 `2cb240c8…`. GBP live-verified on two published tenants. **TRY `/s` pass NOT run** — no TRY tenant has a published `public/profile`. 2026-08-12: TR-CURRENCY-G's formatter is still served |
| **Rollback identity** | `ffbc7898e4a8556e` |
| **Operator/device** | macOS · `alish/admin-pending-slices-release` |
| **Result** | Success |
| **Known exclusions** | MULTI-LOCATION-PRE-A's Functions half **not** deployed; `salown-staff`, Functions, rules, indexes, Storage untouched |

### R-2026-08-10-A — U1 TR-CURRENCY-F

Admin `0d42517d7cba104a` → **`ffbc7898e4a8556e`** (release `1786357943340000`), pinned `b94b8fa`,
isolated clone, `/app` = `index-Dr9fNRee.js` (live sha256 `5daeedf7…`, 30/30 assets byte-identical).
Authenticated **TRY** UI pass done (`🛒 Cart (2) · ₺600,00`); **GBP authenticated pass NOT run**.
Rollback `0d42517d7cba104a`. Operator macOS · `alish`. Zero production writes.

---

## Backfilled earlier releases

Full narrative for everything before 2026-08-10 is in [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md)
and `salown-app/SYNC.md` and is **not** duplicated here. The load-bearing identities:

| Ref | Date (UTC) | Unit | Source | Previous → new live identity |
|---|---|---|---|---|
| R-2026-08-09-A | 2026-08-09 | U1 | `81fe195d535f9c5d` era | `f35a939ea269aba6` → `81fe195d535f9c5d` → `0d42517d7cba104a` (TR-P1, TR-CURRENCY-D/E/A/C) |
| R-2026-08-09-S | 2026-08-09 | U2 | `509e63e` | `staff-DPP2bVf5.js` → `staff-BALp7dqM.js` (PSA2 Staff re-cut, after a ~6-minute rollback of `f2426b6`) |
| R-2026-08-08-A | 2026-08-08 | U5 | `960db19` | `createstaffuser-00057-doq` → **`-00058-kur`** · `approveapplication-00012-kix` → **`-00013-yob`** |
| R-2026-08-06-A | 2026-08-06 | U1 | `571ab9d` | `73f57ac0dd04b54a` → `274d34604d2894d7` (ADMIN-SALES-FILTER-1; **live UI pass still outstanding**) |
| R-2026-08-05-R | 2026-08-05 | U7 | DPPP | ruleset → **`640c3dae-a9c8-4cb3-80c4-bc189e72874a`** (still live) |
| R-2026-08-05-A | 2026-08-05 | U1 | Unit 9 + DPPP | `452e75959e3131ea` → `838faa77330f8574` |
| R-2026-07-31-A | 2026-07-31T10:27:45.740Z | U3 | `51e70a0` | `52d85c362cc267ef` → **`9f457fc2c8ee4b35`** — verified 2026-08-12 by the served marker `no email on this conversation` |
| R-2026-07-21-W | 2026-07-21T00:06Z | U6 | UNKNOWN | the whitecross Functions deploy that silently took `addToWaitlist`/`provisionTenant`; **five europe-west2 functions still carry codebase `whitecross` from this deploy** |

---

## How to add a row

1. **Pin a commit.** `git log -1`, clean tree, `0/0`. Never deploy from a dirty tree.
2. **Record the previous live identity BEFORE deploying** — that is the rollback anchor and it
   cannot be recovered afterwards without guessing.
3. Deploy the named target only.
4. **Verify the exact behaviour in production** — a served byte, a source marker in the deployed
   artifact, a live revision id. Not a commit, not a timestamp.
5. Add the row here **and** the status change in [ROADMAP.md](ROADMAP.md), in the same commit.
6. Release the claim.

**Never deploy and then commit.** Two rows above say `SOURCE_SHA = UNKNOWN` for exactly that
reason, and neither can ever be repaired.
