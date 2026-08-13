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

> **U9 rows use a `D-` prefix**, not `R-`: no artefact is released, only production data changes.
> `D-2026-08-13-A` is the first. Calling a data change a "release" is the category error that loses
> provenance — the live identity column on a `D-` row records what stayed live, not what shipped.

## Required fields — a row is incomplete without all of them

`date/time UTC` · `environment` · `repository` · `exact source SHA` (or an explicit `UNKNOWN`) ·
`clean-tree proof` · `Firebase project` · `codebase / hosting target` · `previous live identity` ·
`new live identity` · `included commits` · `tests` · `verification` · `rollback identity` ·
`operator/device` · `result` · `known exclusions`.

**`UNKNOWN` is a legitimate value and a lying value is not.** Write `UNKNOWN` and move on.

---

## Live state after the `2026-08-13T17:2x` release pass — verified `2026-08-13T17:25:00Z`

| Unit | Live identity | Released (UTC) | Source | Provenance |
|---|---|---|---|---|
| U1 | version **`84eb7dda5e1b2140`** · release `1786641531101000` | 2026-08-13T17:18:51.101Z | **`a72f409`** | R-2026-08-13-C — served bytes hash-proven (4 chunks) |
| U2 | version **`585dd333a4a429cf`** · release `1786641658556000` | 2026-08-13T17:20:58.556Z | **`a72f409`** | R-2026-08-13-D — served bytes hash-proven |
| U3 | version `9f457fc2c8ee4b35` · release `1785493665740000` | 2026-07-31T10:27:45.740Z | `51e70a0` | R-2026-07-31-A |
| U4 | version `e6be08684d312ce7` · release `1786401587236000` | 2026-08-10T22:39:47.236Z | **UNKNOWN / HYBRID** | R-2026-08-10-F — ⛔ still blocked, see `R-2026-08-13-X` |
| U5+U6 | 108 functions; `salownSendLoyaltyEmail` now **`-00065-hej`** | 2026-08-13T17:16:00.012Z | `a72f409` | R-2026-08-13-B — deployed archive byte-proven |
| U7 | ruleset `640c3dae-a9c8-4cb3-80c4-bc189e72874a` | updated 2026-08-05T12:52:07Z | not proven against the file | R-2026-08-05-R |
| U8 | 2 composite indexes, both `READY` | UNKNOWN | **UNKNOWN** — the repo declares 0 | ⚠️ see U8 warning |

> U1 passed through an intermediate identity in the same pass: `2620fb29bf2e064e` →
> `2eff0455ed404c15` (passive-only, `R-2026-08-13-A`) → `84eb7dda5e1b2140`. The intermediate was a
> deliberate isolation step, not a mistake, and it is a valid rollback target that keeps the passive
> correction while dropping the split work.

> ⚠️ **U8 warning.** `salown-app/firestore.indexes.json` declares **0 indexes** and 1 field
> override, while production runs **2 composite indexes**. A `firebase deploy --only
> firestore:indexes` today would propose **deleting both**. Export the live definition into the
> file before any index deploy. ROADMAP `TEC-6`.

---

# Releases

Newest first. One `###` heading per release event.

## 2026-08-13

### Policy facts re-confirmed during this pass (read-only, nothing changed)

Recorded because the release touches how tender and loyalty are *presented*, and a presentation
change is easy to mistake for a policy change later. **None of these were altered.**

| Fact | Value | How it was confirmed |
|---|---|---|
| Cashback rate | **5%** | live read of `tenants/whitecross/settings/settings` → `loyalty.cashbackPct: 5` |
| Point conversion | **20 points = £1** | same document → `loyalty.rewardThreshold: 20`; Jack's `loyaltyPointsRedeemed: 64` ↔ `loyaltyRedeemedValue: 3.2` agrees exactly |
| Jack's loyalty transaction | **correct — and will not be changed** | earn base `receiptEarnBase_p 4480` (£44.80 = £48.00 service − £3.20 redemption) × 5% = £2.24 → 44.8 → **44 points**, matching `receiptExpectedPoints`, `receiptAwardedPoints` and `loyaltyPointsEarned`. Redemption 64 ÷ 20 = **£3.20**. The split-payment defect is a *tender-breakdown* defect; the loyalty arithmetic on this booking was never wrong |
| `whitecross2` | **inactive, source-parity only, untracked, never deployed** | not a git repository (`git rev-parse` fails), 0 tracked paths in `whitecross-site`, referenced by no Firebase config. It was not built, opened or deployed by this pass |

### R-2026-08-13-X — U4 Whitecross premium site — **STOPPED BEFORE DEPLOYMENT, nothing released**

Recorded here because a release unit was authorised, prepared, gated and then **not shipped**. An
authorised release that did not happen is a release fact; leaving it out would make the day's record
read as if U4 had simply not been considered.

| Field | Value |
|---|---|
| **Date/time (UTC)** | 2026-08-13T17:1x — stop decision, no deploy command was ever run |
| **Repository / intended source** | `whitecross-site` @ **`5202cad`** (impl ancestor `8c655389` confirmed) |
| **Intended target** | `hosting:whitecrossbarbers-saas` via `firebase.saas.json`, project `havuz-44f70` |
| **Live identity (UNCHANGED)** | version **`e6be08684d312ce7`** · release `1786401587236000` |
| **Gates that DID pass** | `node --check` clean · `passive-authority.test.mjs` **17/17** · `hours-public-read.test.mjs` **14/14** · `w1-c1-cutover.test.mjs` **23/23** · `git diff --check` clean · tree `0/0`, `HEAD == origin/main` |
| **Why it stopped** | The site publishes `script.js` **verbatim** (public root `.`, no build step), so the released artefact is the whole file — there is no way to ship the passive gate alone. Re-measured live: served `script.js` is sha256 `ffa63589e2dc38d42199fbefb35d5a7357b12704a6512dcbaa2f1c7aaae77637`, 123,185 bytes, and matches **no commit in the repository's history** (full `git log --all` scan, 0 matches). It contains `_totalPrice`, `OVERRUN` and the `bacfda34` hours fix, but **zero** occurrences of `salownCreateBooking` (7 in `main`) and zero of `expectedPaymentFlow` (1 in `main`) |
| **What a deploy would therefore have released** | `97045045` W1 plain-single-booking cutover to `salownCreateBooking` · `5acd2dbf` O1W-HARDENING checkout recovery · `c3d06d7a` pay-channels-a-w1 · and `bc25d257` CAMPAIGN-LIFECYCLE-PARITY. Measured on the live page: served `index.html` carries `Double Points` ×1 and `2× loyalty points` ×1 and **no** `doublePointsMultiplier`; `main`'s `index.html` is the mirror image (0 / 0 / 1). Deploying would have **blanked a promotion that is live right now**, and activated a held booking-write path — both unrelated to the passive correction and neither authorised |
| **Prior authority for stopping** | `R-2026-08-10-F` already carries ⛔ *"Deploying `origin/main` to U4 is BLOCKED until a reproducible release anchor exists (`REL-4`/`WCP-1`)"*. This pass independently re-derived the same conclusion from live bytes rather than trusting the note |
| **Rollback identity** | not applicable — nothing was released. `e6be08684d312ce7` remains both the live and the rollback identity |
| **Production data written** | **none** |
| **Next action** | `REL-4` — build a reproducible anchor for U4. Until then the passive-authority fix for whitecrossbarbers.com stays `PUSHED_NOT_LIVE` at `8c655389`/`5202cad`, and the departed-staffer exposure the fix closes **remains live on the premium site** |

> **The exposure that stays open, stated plainly.** `_shouldShowBarber` and
> `getBarberScheduleForDay` in the *served* artefact still read `shiftChanges` before the lifecycle
> status, so a departed barber carrying one stale open override is still shown and still generates
> clickable slots on whitecrossbarbers.com. The salOWN-side half of the same defect **is** now closed
> (`R-2026-08-13-A`/`-C`). This asymmetry is the cost of `WCP-1`, and it is the argument for `REL-4`.

### R-2026-08-13-D — U2 `hosting:salown-staff` — SPLIT-PAYMENT-PARITY-B, Staff half

| Field | Value |
|---|---|
| **Date/time (UTC)** | 2026-08-13T17:20:58.556Z |
| **Environment** | production |
| **Repository** | `salown-app` |
| **Source SHA** | **`a72f409`** (= `origin/main`; `src/**` content identical to `7309f3e` — the two commits between them touch only `ops/claims/`) |
| **Clean-tree proof** | `HEAD == origin/main == a72f409`, `git status --porcelain` empty, recorded before the build |
| **Firebase project** | `havuz-44f70` |
| **Target** | `hosting:salown-staff` (only), via the repository-approved `npm run deploy:staff` |
| **Previous live identity** | **`b9a396c48836840f`** · release `1786389184539000` |
| **New live identity** | **`585dd333a4a429cf`** · release **`1786641658556000`** · FINALIZED |
| **Included commits** | `9b5cb6d` (3/4) is the Staff-touching commit — `src/staff/views/SalesView.tsx`. It rides with the rest of `main` |
| **Tests** | frontend **3733/3733** · functions **1348 pass / 31 skipped (1379)** · deploy-policy **28/28** · release-guard **19/19** · app + functions typecheck clean · scoped eslint clean · `git diff --check` clean |
| **Build/served hash evidence** | `/assets/staff-39ZjehjJ.js` sha256 **`07d623cbba81ef475dc4905dd282d847d8b58a8d0393e2bd9d9386ec76db99a2`** and `/` sha256 **`de0eddcf04e4a9f6c94be6b5579817eb4ec48ab3e4b85e2816be3d7ae5eb5e88`** — both **byte-identical** to the tracked files committed at `c56958a` |
| **Verification — served code, read only** | The served `methodTotals` fold sums `t.service.cash_p` / `t.service.card_p` / `t.service.other_p` — the **service legs**, never the tip-inclusive total, so a split sale is no longer an opaque `SPLIT` bucket. Tip attribution is `…tip.cash_p>0?\`CASH\`:\`CARD\``, so a **cash tip stays in the cash bucket** and `tipCard` is the residual. Split allocation markers `A1_SERVICE_LEGS_SUM`, `A2_TIP_LEGS_SUM`, `A3_COLLECTED_PER_METHOD`, `A7_SPLIT_SECOND_METHOD_REQUIRED`, `CANONICAL_BASE_MISMATCH`, `LEGACY_SPLIT_MALFORMED` all present. Dated-rota `R1` markers (`BY_EXCEPTION_LEGACY_UNSAFE`, `CLOSE_TARGET_NOT_OPEN`, `BAD_SCHEDULE_MODE`, `CHANGE_ID_NOT_CONTIGUOUS`, `rotaFold`) **all absent** — the R1 modules are pure and unimported, so they cannot reach a bundle |
| **REL-1 handling** | The tracked `hosting/staff-bundle/**` was **updated, not restored** (`c56958a`). REL-1's restore step exists for an *Admin* deploy, where the other target's predeploy hook dirties an artefact nobody released; here that artefact **is** the release, and reverting it would create exactly the tracked-vs-served drift REL-1 warns about. Final tree `0/0` |
| **Rollback identity** | version **`b9a396c48836840f`** (release `1786389184539000`) · Console → Hosting → site `salown-staff` → Release history → ⋮ → Roll back |
| **Operator/device** | `aerulas@gmail.com` · macOS · `alish/passive-r3-split-release` |
| **Result** | **LIVE_VERIFIED** (served-code level). ⚠️ **No authenticated Staff UI smoke was run** — no authenticated session was available to this pass, and none is claimed |
| **Known exclusions — nothing here was touched** | Jack's booking and every other production document · Functions (no revision moved in this unit) · rules · indexes · Storage · `whitecrossbarbers-saas` · `hosting:salown-admin` (`9f457fc2c8ee4b35`, unmoved) · dated rota (unimported source only) · `FIN-PERIOD-CLOSE` |
| **Production data written** | **none** |

### R-2026-08-13-C — U1 `hosting:salown` — SPLIT-PAYMENT-PARITY-B + B1 (supersedes `R-2026-08-13-A`)

| Field | Value |
|---|---|
| **Date/time (UTC)** | 2026-08-13T17:18:51.101Z |
| **Environment** | production |
| **Repository** | `salown-app` |
| **Source SHA** | **`a72f409`** (= `origin/main`) |
| **Clean-tree proof** | `HEAD == origin/main == a72f409`, `git status --porcelain` empty, recorded before the build; `hosting/public-bundle` deleted and rebuilt from scratch so no stale chunk could survive |
| **Firebase project** | `havuz-44f70` |
| **Target** | `hosting:salown` (only) |
| **Previous live identity** | **`2eff0455ed404c15`** · release `1786640876872000` (the passive-only intermediate from `R-2026-08-13-A`, 22 minutes earlier) |
| **New live identity** | **`84eb7dda5e1b2140`** · release **`1786641531101000`** · FINALIZED |
| **Included commits** | `8bbab59` canonical allocation + writer validation · `52fe47f` receipt/email/booking-detail · `9b5cb6d` Finance/Reports/Sales · `7a2598b` parity fixtures · `110e06e` B1 filtered tender semantics · `a910f9e` claim release. **Also carried forward, and deliberately so:** `78124db`/`00cfc43` PASSIVE-AUTHORITY-R3 — this release must not regress it |
| **Tests** | frontend **3733/3733** (124 files) · functions **1348 pass / 31 skipped** · deploy-policy **28/28** · release-guard **19/19** · app typecheck clean · functions typecheck clean · eslint clean on all 12 release paths · `git diff --check` clean. Targeted gate re-run on the exact HEAD: `rotaFold` + `passiveAuthority` + `paymentAllocation` + `tenderFacts` + `tenderSelection` + `financeTender` = **296/296** |
| **Build/served hash evidence** | 4 chunks fetched from `https://salown.com` and hashed against the pinned build, **all identical**: entry `/public-bundle/assets/index-qReUF8aQ.js` sha256 **`2cd38c7be90ed10f9548cfb5dfa65f5e789d0000430c5863ab2f932c18de9155`** · `tenderSelection-C_PRojtE.js` **`6f8eedc5bbd2883b0b766e8a0a0207df580b1cf534781e5aa90c1d943ddab227`** · `Finance-CwnDmn9y.js` **`20d3eaac07fd4dde…`** · `Reports-DiwSU6Ng.js` **`15fb2d27b09870a6…`**. The served path was proven *before* hashing (`curl … /app \| grep src=`), per the `/public-bundle/` 404-hash trap in `salown-app/CLAUDE.md` |
| **Verification 1 — passive retained** | The served entry chunk still resolves passive **before** `shiftChanges` in **both** display resolvers: `function SN(e,t,n){if(xA(e)===\`passive\`)return bN(\`passive\`);let r=e?.shiftChanges?.[Uj(t)];…}` (`getEffectiveStaffShift`) and `function zF(e,t){…if(xA(t)===\`passive\`)return!1;let n=t.shiftChanges?.[Uj(e)];…}` (`ManageBooking.barberWorksOn`). `getAvailableBarbersForDate` was already passive-first and is unchanged |
| **Verification 2 — split writer gates** | Served entry chunk carries `A7_SPLIT_SECOND_METHOD_REQUIRED` (a split must name a second method), `A8_SERVICE_LEG_EXCEEDS_SERVICE` (the cash leg cannot exceed the service), `A9_TIP_METHOD_AMBIGUOUS` (a tip must state its own method), `A6_NOT_INTEGER_MINOR_UNITS`, plus `A1_SERVICE_LEGS_SUM`, `A2_TIP_LEGS_SUM`, `A3_COLLECTED_PER_METHOD`, `A4_COLLECTED_LEGS_SUM`, `A5_NON_NEGATIVE`, `CANONICAL_BASE_MISMATCH`, `LEGACY_SPLIT_MALFORMED` |
| **Verification 3 — filtered tender semantics (B1)** | Read out of the **served** `tenderSelection` chunk: with filter `cash` only `service.cash_p + tip.cash_p` is summed; with `card` only `card_p + other_p`; `selectedTotal_p` is the sum of the **selected legs alone**, never the whole transaction. This is the defect that put £29.80 of card money inside a cash-only view |
| **Verification 4 — loyalty subtracted exactly once** | `Reports.tsx` totals: `gross` = service + add-ons + products (redemption-free), and `net = gross − discount − loyalty + tips` accumulates `pp(b.loyaltyRedeemedValue)` **once per row**. Pinned by `financeTender.test.ts` *"THE REPORTS TOTALS BAR — loyalty subtracted exactly once"*: `reportsNet(AS_STORED)` = **49.8**, the old pre-redemption base = **53**, difference exactly **320p** |
| **Verification 5 — Jack golden allocation** | ⚠️ **Stated precisely.** The golden numbers are **not** literals in the shipped bundle — they are a test fixture, and no minified constant `1500`/`2980`/`4980` is claimed. What is proven is the chain: the served bytes are sha256-identical to the build from `a72f409`, and at `a72f409` `computePaymentAllocation(JACK)` is asserted green as service `{cash 1500, card 2980, other 0, total 4480}`, tip `{cash 500, card 0, other 0, total 500}`, collected `{cash 2000, card 2980, other 0, total 4980}`, `firstMethod: SPLIT`, `secondMethod: CARD`, `reconciled: true`, `failures: []`, **and the regression guard `service.card_p ≠ 3480`** — the defective writer's tip-into-card leak |
| **Verification 6 — no dated rota** | `BY_EXCEPTION_LEGACY_UNSAFE`, `CLOSE_TARGET_NOT_OPEN`, `BAD_SCHEDULE_MODE`, `CHANGE_ID_NOT_CONTIGUOUS`, `rotaFold` — **0 occurrences** in every built and served chunk. `src/utils/rotaFold.ts` and `packages/shared/src/rota.ts` have no product importer (verified by repo-wide grep); the only references are their own test and two prose comments |
| **Rollback identity** | version **`2eff0455ed404c15`** (release `1786640876872000`) — keeps the passive correction, drops the split work. Full pre-session rollback: **`2620fb29bf2e064e`** (release `1786574988937000`) |
| **Operator/device** | `aerulas@gmail.com` · macOS · `alish/passive-r3-split-release` |
| **Result** | **LIVE_VERIFIED** (served-code level). ⚠️ **No authenticated Admin UI smoke was run** and none is claimed — this remains the open gap recorded for Finance/Reports. Unauthenticated route smoke: `/`, `/app`, `/login`, `/book/whitecross`, `/s/whitecross` all **200**, entry JS and CSS both **200** |
| **Known exclusions — nothing here was touched** | **Jack's booking was NOT repaired** and no production document was written · no checkout was created or replayed · no email sent · no receipt regenerated · no loyalty mutated · rules · indexes · Storage · `whitecrossbarbers-saas` · `hosting:salown-admin` · Functions (this unit deployed none; see `R-2026-08-13-B`) |
| **Production data written** | **none** |

### R-2026-08-13-B — U5 `functions:salown:salownSendLoyaltyEmail` — the receipt email states the legs

| Field | Value |
|---|---|
| **Date/time (UTC)** | 2026-08-13T17:16:00.012Z (revision created) · 2026-08-13T17:16:15.757Z (function `updateTime`) |
| **Environment** | production |
| **Repository** | `salown-app` |
| **Source SHA** | **`a72f409`** (= `origin/main`) |
| **Clean-tree proof** | `HEAD == origin/main == a72f409`, `git status --porcelain` empty, recorded before the build |
| **Firebase project / region** | `havuz-44f70` · `europe-west2` |
| **Target** | **`functions:salown:salownSendLoyaltyEmail`** — exactly one function, codebase-prefixed. The codebase name was confirmed from `firebase.json` (`{source: functions, codebase: salown}`) and the export from `functions/src/index.ts:704`. **No blanket `--only functions`** — that command is hard-blocked in `functions/package.json` because it proposes deleting the 27 `us-central1` legacy functions |
| **Previous live identity** | revision **`salownsendloyaltyemail-00064-saz`** (created 2026-08-04T20:45:15.216Z) |
| **New live identity** | revision **`salownsendloyaltyemail-00065-hej`** · Ready `True` · **100% traffic** · function state `ACTIVE` · build `8e09c5c6-f01f-4f4d-adb7-a5f492fc9a62` |
| **Included commits** | `52fe47f` only — the sole split commit touching `functions/` (`src/index.ts`, `src/emailTemplates.ts`, new `src/payments/paymentAllocation.{ts,test.js}`, and the `package.json` test glob) |
| **Tests** | functions **1348 pass / 31 skipped (1379)** · functions typecheck clean · `tsc -p tsconfig.build.json` clean · frontend **3733/3733** |
| **Served-code evidence** | The deployed archive was **downloaded back out of production** — `gs://gcf-v2-sources-1050766582653-europe-west2/salownSendLoyaltyEmail/function-source.zip#1786641308144542`, the exact generation named in `sourceProvenance.resolvedStorageSource` — and hashed. **Byte-identical to the local build**: `lib/index.js` `0b97a44298598d4b…`, `lib/payments/paymentAllocation.js` `6c8b08274e946e19…`, `lib/emailTemplates.js` `b8652995c4128b0f…`. This is provenance proven from production backwards, not inferred from a successful deploy |
| **Verification — canonical breakdown present** | `readCanonicalAllocation` and `buildPaymentBreakdownRows` both present in the deployed `lib/index.js` and `lib/payments/paymentAllocation.js`; `paymentBreakdown` present ×4 in the deployed `lib/emailTemplates.js` |
| **Verification — legacy fallback intact** | `readCanonicalAllocation(after)` returning null yields `paymentBreakdown = []`, the template renders **no** breakdown block, and the pre-existing one-line `pmLabel` is unchanged. A legacy record like Jack's therefore renders **exactly as it does today**. The CJS twin is deliberately narrower than the frontend — it has **no** legacy reconstruction, because a reconstruction is not something to assert in an email the customer cannot question. A `SPLIT` row with no canonical allocation emits a diagnostic `console.log` only |
| **Verification — nothing fired** | Cloud Logging for `salownsendloyaltyemail` from 17:10Z onward shows **only** rollout and startup-probe entries (`DEPLOYMENT_ROLLOUT`, TCP probe, Cloud Run auth warnings). **Zero invocations, zero emails, zero Firestore writes.** The trigger fires only on a `sendLoyaltyEmail` `false→true` transition, and nothing wrote that field |
| **Rollback identity** | revision **`salownsendloyaltyemail-00064-saz`** — `gcloud run services update-traffic salownsendloyaltyemail --region europe-west2 --to-revisions salownsendloyaltyemail-00064-saz=100 --project havuz-44f70` |
| **Operator/device** | `aerulas@gmail.com` · macOS · `alish/passive-r3-split-release` |
| **Result** | **LIVE_VERIFIED** |
| **Known exclusions** | Exactly one function updated; **no other revision moved**. `emailTemplates.ts` is shared, but only this function was redeployed, so every other function keeps its existing bundle — and the change is purely additive (a new block, rendered only when `paymentBreakdown` is non-empty). No hosting target, no rules, no indexes, no Storage, no data |
| **Production data written** | **none** |

### R-2026-08-13-A — U1 `hosting:salown` — PASSIVE-AUTHORITY-R3, Admin only, isolated

| Field | Value |
|---|---|
| **Date/time (UTC)** | 2026-08-13T17:07:56.872Z |
| **Environment** | production |
| **Repository** | `salown-app` |
| **Source SHA** | **`00cfc43`** — the exact approved passive checkpoint. `78124db` (the implementation) confirmed an ancestor of it |
| **Clean-tree proof** | Built in an **isolated detached worktree** pinned to `00cfc43` (`git worktree add --detach`), with `node_modules` symlinked in. The shared working tree was **never moved or reset** and stayed `0/0` throughout; the worktree's own tree was `0/0` after the build |
| **Firebase project** | `havuz-44f70` |
| **Target** | `hosting:salown` (only) |
| **Previous live identity** | **`2620fb29bf2e064e`** · release `1786574988937000` |
| **New live identity** | **`2eff0455ed404c15`** · release **`1786640876872000`** · FINALIZED |
| **Included commits** | `9e7b6ad` claim · `78124db` implementation · `b6c8126` claim extension · `00cfc43` SYNC + claim release. **Nothing else** |
| **Tests (re-run inside the pinned worktree)** | vitest **3478 passed / 1 skipped (3479)** across 119 files · `tsc --noEmit` clean · `vite build` clean |
| **Isolation proof — this is the point of the unit** | At `00cfc43` the split and dated-rota modules **do not exist as files**: `src/utils/paymentAllocation.ts`, `src/utils/tenderFacts.ts`, `src/utils/tenderSelection.ts` and `src/utils/rotaFold.ts` are all absent. The built bundle carries **0** split markers and **0** rota markers. The passive-only artefact was isolatable exactly, so the stop condition never triggered |
| **Build/served hash evidence** | Served path proven first (`src="/public-bundle/assets/index-Brj2b8NN.js"`), then `HTTP/2 200`, then hashed: **`f616be720f4294dea1ae7e92cf245f5ec561e09e12471dcafd6a79c6838231bf`** — identical to the pinned build |
| **Verification — passive is checked before `shiftChanges`** | In the served bytes, in **both** display resolvers, exactly as in `R-2026-08-13-C`. `ManageBooking`'s customer-reschedule calendar (`barberWorksOn`) previously had **no lifecycle check at all** |
| **Verification — intermediate scope** | Served bundle contains **no** split marker and **no** dated-rota marker, as required of an intermediate passive-only release. `hosting:salown-staff` re-checked immediately after and **unmoved** at `b9a396c48836840f` |
| **Smoke** | Unauthenticated: `/`, `/app`, `/login`, `/book/whitecross`, `/s/whitecross` all **200**; entry JS and CSS **200**. ⚠️ **No authenticated smoke was run and none is claimed** |
| **Rollback identity** | version **`2620fb29bf2e064e`** (release `1786574988937000`) |
| **Operator/device** | `aerulas@gmail.com` · macOS · `alish/passive-r3-split-release` |
| **Result** | **LIVE_VERIFIED**, then deliberately **superseded 22 minutes later** by `R-2026-08-13-C`, which retains the passive correction |
| **Known exclusions** | No Functions, no Staff, no rules, no indexes, no Storage, no whitecross target, no data |
| **Production data written** | **none** |

### D-2026-08-13-A — production DATA correction, **no deploy** — Arda rota restored

| Field | Value |
|---|---|
| **Date/time (UTC)** | 2026-08-13T00:07:46.874Z |
| **Type** | Production data correction. **No Hosting, Functions, rules, indexes or Storage release of any kind.** |
| **Live identity (unchanged)** | `hosting:salown` **`2620fb29bf2e064e`** · release `1786574988937000` — confirmed still live before and after, with the `` =e=>e||`periods` `` marker served |
| **Target** | `tenants/whitecross/barbers/barber-1777655430086` — field `workingDays` **only** |
| **Change** | `["Wednesday"]` → `["Monday","Tuesday","Thursday","Friday","Saturday","Sunday"]` |
| **Tool** | `scripts/correctWhitecrossCompPeriods.cjs --op=rota` at `9a90202`; a `lastUpdateTime` precondition, and the tool refuses to run at all without `--phase5-verified` |
| **Identities** | sha256 `c64453d4833f9f4a` → `c02bc7a6a61c8454` · updateTime 2026-08-10T19:24:26.175Z → 2026-08-13T00:07:46.874Z |
| **Audit** | `oBEsAFyVVNSZ0O9kMqBW` · `BARBER_ROTA_CORRECTED` · before/after + both hashes + both updateTimes + rollback identity + owner authorisation + a reason naming the 2026-08-10T19:24:26Z unaudited write |
| **Pre-write gate** | 16/16 — live release + served marker confirmed · `workingDays` still exactly `["Wednesday"]` · hash and updateTime matched the frozen identity · `shiftChanges`/`dayHours` unchanged · rollback snapshot captured · payments/advances/settlement reconfirmed · after-state simulated through the live resolver first |
| **Post-write verification** | Employee period **25 days / £2,500 earned / £2,500 paid / £0 balance** · 2026-08-03 £0 · 2026-08-04 one wage day · 2026-08-05→12-31 £0 · 2026-08-12 Alex £100 / Arda £0 / Muhamed £0 / total £100 · all-time wages £20,289.60 → **£32,589.60** · **all-time Net P&L −£2,740.86 → −£14,840.86** (`£40,308.74 − £32,589.60 − £22,560.00`, exact) · second dry-run 0 updates |
| **Rollback identity** | `phase6-rollback-arda-barber.json` (full pre-write document, sha256 `c64453d4833f9f4a`); restore = write `workingDays: ["Wednesday"]` back. **No Hosting rollback is involved — nothing was released.** |
| **Operator/device** | `aerulas@gmail.com` · macOS · `alish` |
| **Result** | **LIVE_VERIFIED.** |
| **Known exclusions** | `shiftChanges` · `dayHours` · `status` · `active` · `leaves` · all three `staffComp` documents · payments · advances · settlement · expenses · bookings · Alex and Muhamed · every Firebase deploy target · `FIN-PERIOD-CLOSE` · dated rota · the ≈£569.97 workbook gap · the £7,939 exit liability |

> **Why this was safe now and would not have been on 2026-08-10.** The gate had to go live first.
> Under `'legacy'` this same write turns a one-day-a-week ghost accrual into a six-day one (measured:
> 9 → 48 days to 2026-09-30). With `effectiveTo = 2026-08-04` honoured, the restored rota adds the
> day Arda actually worked and adds nothing after he left.
>
> **And it proves the incident is not closed.** Restoring one undated array moved every closed month
> by ≈£12,300 — correctly this time. `FIN-PERIOD-CLOSE` and `FIN-DATED-ROTA` are now P0.

## 2026-08-12

### R-2026-08-12-B — U1 `hosting:salown` — FIN-COMP-S3C compensation-period activation

| Field | Value |
|---|---|
| **Date/time (UTC)** | 2026-08-12T22:49:48.937Z |
| **Environment** | production |
| **Repository** | `salown-app` |
| **Source SHA** | **`d9bdbc5797d6255c86c08a3f26181dadedf45757`** |
| **Clean-tree proof** | `HEAD == origin/main == d9bdbc5`, `git status --porcelain` empty, recorded **before** the build. Built from an **isolated detached worktree** pinned to that SHA, so the shared tree could not contribute an uncommitted byte — and the REL-1 `staff-bundle` predeploy dirt landed in the throwaway worktree instead of the shared one |
| **Firebase project** | `havuz-44f70` |
| **Target** | `hosting:salown` (only) |
| **Previous live identity** | **`11cc739f548c5e10`** · release `1786493555545000` |
| **New live identity** | **`2620fb29bf2e064e`** · release **`1786574988937000`** · FINALIZED |
| **Included commits** | `10e754a` FIN-S2 one wage-day rule · `f1239ba` FIN-COMP-S3A period gate · `5e69b63` FIN-COMP-S3B six consumers wired · `d9bdbc5` FIN-COMP-S3C activation. All four were `PUSHED_NOT_LIVE` before this release; they go live together |
| **Tests** | frontend **3241/3241** · S2 golden parity **261/261** (`financeWages.parity.test.ts`, `financeWages.ts`, `financeCompPeriodIndex.ts` and `Finance.tsx` all byte-untouched by this release) · correction-tool tests **24/24** · deploy-policy **28/28** · typecheck clean · scoped lint clean · `git diff --check` clean · claim validate OK. Re-run in the isolated checkout: identical, minus one `skipIf(!existsSync(LIB))` case that needs a gitignored `functions/lib` build artefact absent from a fresh worktree (explained, unrelated) |
| **Build/served hash evidence** | entry `index-CruMPhWI.js` sha256 `7b111ce1596da0b4f158de73127d648b78cb958405994ccb5021128685e90ea7` — **served bytes identical to the pinned build**. Activation marker: `Finance-Bxq7CLSn.js` (sha256 `de2149e530994b7d…`, also identical) contains `` =e=>e||`periods` ``, contains no `legacy` literal, and carries the gate (`'outside'`) and `effectiveFrom`. The pre-release chunk `Finance-D1C8pgkU.js` (sha256 `777fca73…`) carried **no** cutover marker at all — S2/S3A/S3B were not live either |
| **Production data corrections (separate from the release)** | Three audited `staffComp` writes, applied **before** activation via `scripts/correctWhitecrossCompPeriods.cjs` (`edd4e85`), each hash- and `updateTime`-preconditioned. Only `effectiveFrom` moved; `type`, `params`, `changedAt`, `changedBy` and document identity were carried verbatim: Alex `barber-1777257519766` `2026-07-15`→`2026-02-06` (`18db3c65…`→`b08b947c…`, audit `IwVAkK4CxBtlI06tcprB`) · Muhamed `barber-1781007454543` `2026-07-15`→`2026-06-09` (`ff565e2e…`→`b0526718…`, audit `FzXbkSnSthVXkrI4dSHO`) · Arda `barber-1777655430086` `2026-07-15`→`2026-02-06`, `effectiveTo` `2026-08-04` untouched (`dfa912ea…`→`173d91df…`, audit `IPy4dGn3I38uFgRVckCb`). Post-write: analyser `ready = true` (3/3 complete valid periods, 0 malformed/overlapping/gapped), second dry-run proposed **0 updates** (idempotent) |
| **Verification** | Live, read-only, against the deployed source with **no `periodMode` passed anywhere** so the shipped constant answers: 2026-08-12 Alex £100 · Arda £0 · Muhamed £0 · **total £200 → £100**; Arda accrues **£0 on every date 2026-08-05 → 2026-12-31**; February–July each move by **£0.00**; August £1,400 → £1,200 (**−£200**, his two Wednesdays after the boundary); all-time wages £20,489.60 → **£20,289.60**. Payments/advances (114 rows) byte-identical to the pre-release freeze; `finance_config` unchanged; `settlement` still absent; all three barber documents unchanged |
| **Rollback identity** | Hosting: version **`11cc739f548c5e10`** (release `1786493555545000`) · Console → Hosting → site `salown` → Release history → ⋮ → Roll back. Source rollback: set `FINANCE_COMP_PERIOD_MODE` back to `'legacy'`, commit, redeploy — **the data correction does not need reverting with it**, because pulling `effectiveFrom` back is a no-op under `'legacy'`, which reads no period at all. Data rollback identities (unused): the three pre-write hashes above |
| **Operator/device** | `aerulas@gmail.com` · macOS · `alish` |
| **Result** | **LIVE_VERIFIED.** |
| **Known exclusions — nothing here was touched** | Arda `workingDays` (still `["Wednesday"]`, `updateTime` 2026-08-10T19:24:26.175Z) · `FIN-PERIOD-CLOSE` (not implemented) · dated rota (not implemented) · payments, advances, settlement, expenses, bookings · accounting baselines and the Arda exit liability · Functions, rules, indexes, Storage · `hosting:salown-staff` (`b9a396c48836840f`, unmoved) · `hosting:salown-admin` (`9f457fc2c8ee4b35`, unmoved) · `whitecrossbarbers-saas` |

> **What this release deliberately does NOT settle.** Activation stops accrual outside an
> employment interval. It does **not** make a closed month immutable, and nobody may describe it
> as doing so. Arda's rota is still corrupt (`["Wednesday"]` is his day OFF), so his historical
> labour cost remains understated by ≈£12,300 and the live all-time Net P&L reads **−£2,740.86**
> where the reconstructed figure is **−£14,840.86**. Repairing the rota under a live gate is
> `FIN-ARDA-REPAIR`, and it stays **BLOCKED** pending the accounting-baseline approval — repairing
> it before the periods are frozen would re-price every closed month a second time.

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
