# ROADMAP.md

> **This file is the single source of truth for the STATUS of every piece of work.**
> Detail documents (SECURITY.md, TESTS.md, INCIDENTS.md, `*_PLAN.md`, `*_ARCHITECTURE.md`) hold the
> *technical detail* — never the status badge. If a status conflict arises, **ROADMAP wins**.
> Release evidence lives in [RELEASE_LEDGER.md](RELEASE_LEDGER.md); the narrative push-vs-live
> record stays in [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md); path ownership stays in
> `salown-app/ops/claims/`; the retrospective day log stays in `salown-app/SYNC.md`.

---

## 0. Status vocabulary — MANDATORY

Every active item carries **exactly one** of these. `Done` / `Shipped` / `LIVE` on their own are
**forbidden**: they hide the only distinction that has ever mattered here.

| Status | Means |
|---|---|
| `LIVE_VERIFIED` | Production evidence exists **for the exact behaviour/target** — a served byte, a source marker in the deployed artifact, a live revision, a read-only production read. |
| `LIVE_UNVERIFIED` | The **artefact** is live and byte-proven, but the **behaviour** has not been observed in production. Added 2026-08-14 by `FIN-PL-SCOPE-P0`, whose release was hash-verified on four served chunks while the authenticated UI smoke could not be run. It exists so a release like that cannot be filed as `LIVE_VERIFIED` — the `LIVE_VERIFIED` definition above requires evidence of the *exact behaviour*, and served bytes are not that. Promote to `LIVE_VERIFIED` only after the outstanding screen checks are actually performed — which is exactly what happened to its first user, promoted the same day once the smoke ran 10/10. |
| `PUSHED_NOT_LIVE` | The implementation is on `origin/main`, and production evidence shows it is **not** live, or no authorised deployment occurred. |
| `IN_PROGRESS` | An active, valid claim/session owns the work right now. |
| `PLANNED` | Accepted scope, implementation not started. |
| `BLOCKED` | Cannot proceed until a named dependency, decision, migration, credential, release window or safety correction completes. |
| `DORMANT` | Deliberately outside the active execution horizon (vision/future). |
| `STATUS_UNKNOWN` | Documentation and commit evidence are **insufficient**. Never guess. Never infer "live" from a commit existing or from a commit timestamp. |

**Two rules learned the hard way and now permanent:**

1. **A commit is not a release.** `git log` cannot answer "is this live?". Only a live revision,
   version id, served byte or source marker can.
2. **A timestamp is not a release order.** This team has historically deployed *then* committed
   (two proven instances on 2026-08-11/12, §12.1), so "commit is newer than the deploy ⇒ not live"
   is invalid reasoning here. The 2026-08-10 "47 commits are not live" conclusion was **disproven**
   for exactly that reason and must not be repeated. Deploy→commit is now a **process violation**
   (§15) — but until it stops, timestamp-only inference stays forbidden in both directions.

---

## 1. Last reconciled — evidence snapshot

**Reconciliation timestamp (snapshot boundary): `2026-08-12T14:26:31Z`** (15:26:31 UK).
Work ID **`REL-2`** · claim `ROADMAP-MASTER-TRUTH-RECONCILIATION--alish--roadmap-master`.
**Documentation and governance only — no product code, no deploy, no production write, no rules,
no Firestore write.** Every production fact below came from read-only Firebase Hosting / Cloud
Functions / Firebase Rules / Firestore REST metadata and from fetching served bytes.

**Repository anchors at the snapshot** (all four `0/0` against `origin/main`):

| Repo | Path | HEAD at snapshot | Clean | Ahead/Behind |
|---|---|---|---|---|
| `salown-app` | `alex/salown-app` | `d66f433` → **`7776d92`** (see §1.1) | yes | 0/0 |
| `salown-docs` | `alex/docs` | **`d7e1e6f`** | yes | 0/0 |
| `whitecross-site` | `alex/whitecross-site` | **`a336ddce`** | yes | 0/0 |
| `super-admin` (`salownadmin`) | `alex/super-admin` | **`51e70a0`** | yes | 0/0 |

Linked worktrees found: `alex/.wt-specialhours-backfill` (detached `de26b0e`, 10 behind — a spent
PROFILE-SPECIALHOURS-BACKFILL worktree, safe to prune) · `whitecross-site/.claude/worktrees/exciting-easley-bc6e13`
(`89e102ec`) · a prunable super-admin worktree under a dead session scratchpad. No separate
deployment/release-infrastructure repository exists; release tooling lives inside
`salown-app/ops/` and `whitecross-site/scripts/`.

### 1.1 AFTER_SNAPSHOT — what moved while this ran

| Work ID | Commits | Landed | Treatment |
|---|---|---|---|
| `FIN-COMP-S3A` | `f1239ba` + claim release `7776d92` | 2026-08-12T14:28:50Z / 14:28:57Z | **Reconciled in this pass.** Its final report arrived before this session closed and was independently verified (§5). Recorded `PUSHED_NOT_LIVE`, **not** LIVE_VERIFIED, **not** complete. |
| `REL-2` | claim `fbabc0d` · reconciliation `e2ae1b5` (salown-docs) · claim release `67e8d25` | 2026-08-12T14:38Z → 17:0xZ | This reconciliation itself. |
| `FIN-COMP-S3A-ANALYSER-FIX` | claim `cf97c6c` · **`18405c6`** · claim release `abbc6a6` | 2026-08-12T17:11:49Z | **Reconciled in this pass** (§9.3). Two readiness defects in `scripts/analyseCompPeriods.cjs`. `PUSHED_NOT_LIVE` — a read-only analyser script, no deployable target. |
| `FIN-COMP-S3C-ARDA-BOUNDARY` | claim `9ff…`/`abbc6a6`+1 · addendum `9776789` (salown-docs) | 2026-08-12T17:2xZ | Owner's Arda final-week clarification + the read-only verification it asked for (§9.3). Documentation only. |
| `ROADMAP-AFTER-SNAPSHOT-CLOSE` | this register | 2026-08-12T17:35Z | Closes §1.1. |

Anything landing after the last row above is **AFTER_SNAPSHOT — requires next reconciliation** and
is not reflected below. **Nothing in this register was deployed and nothing wrote to production.**

---

## 2. Current production summary

Every identity here was read from production on 2026-08-12, read-only.

| Surface | Live identity | Released | Status |
|---|---|---|---|
| `hosting:salown` — Admin `/app` + landing + public booking `/book/**` + salon pages `/s/**` (one deployable unit, one bundle) | version **`84eb7dda5e1b2140`** · release `1786641531101000` | 2026-08-13T17:18:51.101Z | **LIVE_VERIFIED** — source `a72f409`, 4 served chunks hash-proven, ledger `R-2026-08-13-C` (via the passive-only intermediate `2eff0455ed404c15`, `R-2026-08-13-A`) |
| `hosting:salown-staff` — staff.salown.com | version **`585dd333a4a429cf`** · release `1786641658556000` | 2026-08-13T17:20:58.556Z | LIVE_VERIFIED, byte-proven — source `a72f409`, ledger `R-2026-08-13-D` |
| `hosting:salown-admin` — Super Admin | version **`9f457fc2c8ee4b35`** · release `1785493665740000` | 2026-07-31T10:27:45.740Z | LIVE_VERIFIED, marker-proven |
| `hosting:whitecrossbarbers-saas` — whitecrossbarbers.com | version **`25b14188c8e6e9ed`** · release `1786646659069000` | 2026-08-13T18:44:19.069Z | LIVE, **reproducible** from the `REL-4` anchor `ops/rel4/` (anchor commit `36d77f82`) — the passive gate transplanted onto the live artefact, `WCP-5` closed. The 2026-08-13 stop (`R-2026-08-13-X`) is what made this possible. Rollback `e6be08684d312ce7`. ⛔ `main` is **still** not deployable here (`WCP-2` + `WCP-3`) |
| Cloud Functions | **108 total** — 81 `europe-west2` + 27 `us-central1`; labels: `salown` 76 · `whitecross` 30 · unlabelled 2. `salownSendLoyaltyEmail` = **`-00065-hej`** (2026-08-13T17:16:00.012Z) | — | see §10; ledger `R-2026-08-13-B`, deployed archive byte-proven |
| `firestore.rules` | ruleset **`640c3dae-a9c8-4cb3-80c4-bc189e72874a`** | updated 2026-08-05T12:52:07Z | LIVE_VERIFIED, unchanged since Unit-9/DPPP |
| Firestore indexes | **2 composite, both READY** | — | STATUS_UNKNOWN — `TEC-6`, the repo declares **0** |
| Storage rules | ruleset `4c00eef7-e45c-4b35-856a-b0e911018990` | updated 2026-05-24T19:56:00Z | LIVE, untouched |

**Business reality is unchanged by this reconciliation.** 2 live salons (whitecross · herohairs),
6 tenant *documents* + `dayi-barbers` provisioned 2026-08-12 (7 documents — never quote a document
sweep as a customer count; [TENANTS.md](TENANTS.md)). Stripe Connect is entirely in **TEST** mode —
no tenant takes real money. The **TR payment integrity hold** is active: production holds **zero**
`checkoutReceipt` documents, so no TRY money has ever been rendered from real data.

---

## 3. Active sessions and claims

At the snapshot: **one** claim, this one.

| Claim | Owner | Work ID | Locked paths | Status |
|---|---|---|---|---|
| `ROADMAP-MASTER-TRUTH-RECONCILIATION` | `alish/roadmap-master` | `REL-2` | `docs/ROADMAP.md` · `docs/RELEASE_LEDGER.md` · `docs/CLAUDE.md` · `docs/README.md` · `docs/scripts/daily-reconciliation-check.sh` | working → released on commit |
| `PASSIVE-R3-R3B-AND-SPLIT-PAYMENT-RELEASE` (2026-08-13) | `alish/passive-r3-split-release` | `PASSIVE-R3`, `SPLIT-B`, `WCP-5` | `SYNC.md` · `hosting/staff-bundle/` · `docs/RELEASE_LEDGER.md` · `docs/DEPLOYMENT_STATUS.md` · `docs/ROADMAP.md` | released on completion |
| `FIN-PL-SCOPE-P0` (2026-08-14) | `alish/finance-pl-scope` | `FIN-PL-SCOPE`, `FIN-TENDER-SCOPE-P1`/`P1.1` | `src/pages/Finance.tsx` · `src/pages/financePlScope.test.ts` · `src/utils/financeSummary.test.ts` · `SYNC.md` · `docs/ROADMAP.md` · `docs/RELEASE_LEDGER.md` · `docs/DEPLOYMENT_STATUS.md` | released on completion |
| `FIN-SPLIT-LOYALTY-FILTER-P0` (2026-08-13) | `alish/finance-split-loyalty-filter` | `SPLIT-B2` | `src/utils/financeSummary.ts` · `src/utils/financeSummary.test.ts` · `src/pages/Finance.tsx` · `src/pages/Reports.tsx` · `SYNC.md` · `docs/RELEASE_LEDGER.md` · `docs/ROADMAP.md` · `docs/INCIDENTS.md` | released on completion |

`STAFF-FINANCE-COMPENSATION-PERIODS-S3A` (`alish/comp-periods-s3a`) held a claim across the
snapshot and released it at `7776d92`. `claims.sh validate` was clean throughout; no conflict, no
claim of another session was read, edited or released by this pass.

---

## 4. MASTER ACTIVE TABLE

Every active item has a **stable Work ID**. Existing established ids (`A1`, `B2`, `C8`, `S4`,
`T-e`, `REL-1`, `TR-*`, `Unit 11`…) are preserved inside the theme bodies below and cross-referenced
here; commit and release identifiers are never renamed.

| Pri | Work ID | Work item | Status | Repo | Claim | Dependency | Source SHA | Live identity | Next action | Last verified |
|---|---|---|---|---|---|---|---|---|---|---|
| P0 | `REL-2a` | The 2026-08-12 Admin release has no ledger entry and no provable source | `STATUS_UNKNOWN` | salown-app | — | — | **UNKNOWN** (deploy→commit) | `11cc739f548c5e10` | Backfill from operator memory or accept UNKNOWN permanently | 2026-08-12 |
| P0 | `REL-3` | Prohibit deploy→commit; every release needs a clean-tree pinned anchor | `PLANNED` | all | — | `REL-2` | — | — | Adopt §15; add the pre-release tree/anchor gate | 2026-08-12 |
| P0 | `CAM-2` | `salownPublishPublicCampaign` server-side publisher | `PUSHED_NOT_LIVE` | salown-app | — | owner release window | `c8036f0` | **absent from the 108 live functions** | Deploy the publisher by exact name, then `CAM-3` | 2026-08-12 |
| P0 | `CAM-3` | Republish `public/campaign` mirrors so they carry `multiplier` | `BLOCKED` | data | — | `CAM-2` | — | whitecross mirror written 2026-06-18, **no `multiplier`** | Server-side backfill after `CAM-2`; **never** "press Save once" | 2026-08-12 |
| P0 | `CAM-1` | salOWN campaign resolver (frontend half) | `LIVE_VERIFIED` **but not delivering** | salown-app | — | `CAM-3` | `01bfebe` | `11cc739f548c5e10` | Do not close: the guarantee is dark until `CAM-3` | 2026-08-12 |
| P0 | `WCP-2` | Whitecross homepage campaign parity | `PUSHED_NOT_LIVE` / `BLOCKED` | whitecross-site | — | `CAM-3` | `bc25d257` | **proven absent** from `e6be08684d312ce7` | Hold. Deploying now blanks a live banner | 2026-08-12 |
| P0 | `WCP-3` | W1 premium cutover — booking created before payment fail-closed (phantom bookings) | `BLOCKED` | whitecross-site | — | O1W F→D→E2E coordinated activation | — | current live artefact still on the legacy path | Coordinated activation, owner-scheduled | 2026-08-12 |
| P0 | `WCP-1` | Live Whitecross artefact is a hand-composed hybrid matching no Git SHA | `IN_PROGRESS` — **releases are reproducible now, `main` still is not** | whitecross-site | released | — | anchor `36d77f82` (`ops/rel4/`) | `25b14188c8e6e9ed` · `script.js` sha256 `2abd181e…49575` (prev `e6be08684d312ce7` / `ffa63589…e77637`) | `REL-4` closed the *release* half: `ops/rel4/assemble.sh` rebuilds the served artefact byte-for-byte. **Still open:** reconciling `main` with production, which needs `WCP-2` + `WCP-3` | 2026-08-13 |
| P0 | `WCP-4` | `firebase.public-site.json` would re-expose the repository | `PLANNED` | whitecross-site | — | — | — | 9 ignore entries vs 25 in `firebase.saas.json` | Delete or hard-fail it; `firebase.saas.json` is the only approved config | 2026-08-12 |
| P0 | `WCP-5` | Whitecross premium site resurrected a **departed** barber from a stale `shiftChanges` override | **`LIVE_VERIFIED`** | whitecross-site | released | — | `8c655389` (impl) · `36d77f82` (REL-4 anchor) | `hosting:whitecrossbarbers-saas` **`25b14188c8e6e9ed`** · release `1786646659069000` · 2026-08-13T18:44:19.069Z | Shipped by transplanting the gate onto the live artefact, **not** by deploying `main`. Served `script.js` `2abd181e…49575`; `isBarberPassive` precedes `shiftChanges` in both paths. Ledger `R-2026-08-13-Y` | 2026-08-13 |
| P1 | `SEC-CATCHALL-1` | The platform-wide super-admin catch-all `match /{document=**} { allow read, write: if isSuperAdmin(); }` ORs across every match, so NO per-collection rule can constrain a super-admin browser session | `PLANNED` | salown-app | — | — | — | live ruleset `640c3dae-a9c8-4cb3-80c4-bc189e72874a` | Surfaced twice now as disclosed residue — by `scripts/testPromotionSnapshotRules.py` (a forged `loyaltyPromotionSnapshot`) and by `STAFF-START-A1` (a pre-start booking). Neither package could close it: the grant is above them, and no clause inside a collection can take it away. It is **asserted rather than described** by the last case in `test/rules/availabilityFrom.emulator.test.js`, so scoping it will turn that test red and force this row to be revisited. **Next:** decide between removing the catch-all and field-scoping it (e.g. super-admin write limited to the collections the super-admin console actually writes), then re-run every rules suite — this is a platform-wide grant with real blast radius, so it is its own package with its own live-parity proof, never a side edit | 2026-08-14 |
| P2 | `STAFF-START-A2` | The temporary `availabilityFrom` fail-open branch cannot be removed while any barber document lacks the field | `PLANNED` | salown-app + data | — | `STAFF-START-A1` (live) | — | live ruleset `10914cef-…`; whitecross **3/3 migrated**, herohairs **0/1** | One record left on the whole platform: the single **herohairs** barber. Until it has a date, `missing ⇒ FAIL OPEN` must stay, so the boundary is a guarantee on Whitecross and only a default everywhere else. **This is not a script job.** The whitecross migration was done by the owner by hand precisely because the right value is a business fact, and the evidence for it is per-person — barber doc createTime, `partnerConfig.startDate`/`wageStartDate`, `staffComp.effectiveFrom` and the first real booking. On whitecross all four agreed to the day; on another tenant they may not, and a script that picks one silently would fabricate a start date, which is exactly the failure `staffComp.effectiveFrom` already made once (all three records said 2026-07-15, the minute the Pay tab was first saved). `scripts/availabilityFromInventory.cjs --all-tenants` is the read-only sizing tool and has still **never been run**. **Next:** ask HeroHairs for their barber's real start date, enter it the same way, re-run the anomaly check, and only then delete the fail-open branch and flip `missing` to fail CLOSED — with a rules-parity proof, since that is a rules change | 2026-08-15 |
| P1 | `STAFF-START-A1` | Team members had **no employment-start boundary at all** — a future-start staffer was bookable on every surface, because `barbers/{id}` carried no start date and no writer produced one | **`LIVE_VERIFIED`** | salown-app + whitecross-site | released | `PASSIVE-R3` (extends it) | **`51171e8`** (salown-app, A1.2) · **`f046aa14`** (whitecross-site, `ops/rel5/`) | rules **`10914cef-…`** · 7 Functions (`-00004-gom`/`-00002-sem`/`-00002-miw`/`-00002-viw`/`-00075-gug`/`-00015-suy`/`-00138-qog`) · `hosting:salown` **`ffdb95bce7a3fc9b`** · `hosting:salown-staff` **`9cd83c70960e062f`** · `hosting:whitecrossbarbers-saas` **`d7d72c6755a35044`** | Adds `barbers/{id}.availabilityFrom`, a tenant-local inclusive `YYYY-MM-DD` scheduling key. **Public scheduling metadata only — never payroll**; a static test fails the build if any Finance module reads it, so `partnerConfig.startDate` / `staffComp.effectiveFrom` stay the sole wage authorities and no closed month can move. Precedence extends R3 rather than replacing it: passive → **before `availabilityFrom`** → dated override → leave → weekly → salon, with source-ORDER assertions in all four copies. **Legacy is asymmetric on purpose:** missing ⇒ FAIL OPEN (100% of production documents are legacy on day one, so fail-closed would empty every calendar at once), malformed ⇒ FAIL CLOSED. `scripts/availabilityFromInventory.cjs` is the read-only measurement of the open branch; the Team Members page shows the same counts as a loud migration warning. Premium-site half is anchor `ops/rel5/` (baseline = the live REL-4 bytes, re-fetched and hash-confirmed), whose **negative control proves the defect on production bytes**: 5 pre-start rows fail against the live artefact and pass against the release. **A1.1 landed:** creation now requires the date in ALL THREE statuses (a `leave`/`passive` member created without one was a brand-new legacy document that failed OPEN on activation); the rule moved into pure `resolveAvailabilityFromWrite`; a third writer (`seedDemoTenant.cjs`) was found and stamped; the affected Functions export list is DERIVED and pinned by `deployableExports.test.js`; whitecross2 parity is now a tracked patch + both hashes + `apply.sh` under `ops/rel5/whitecross2/`. Full coordinated plan with live identities, rollback revisions and pinned artefact hashes: **`docs/RELEASE_MANIFEST_A1.md`**. **A1.2 closed the direct-write hole:** whitecrossbarbers.com writes bookings STRAIGHT TO FIRESTORE (W1/C1 held), so REL-5 was a client guard with no server authority behind it — a narrow `firestore.rules` gate now enforces the boundary on that channel (hoisted above the `isTenantAny` branch per the [P0-PROMO-2] lesson; one `exists()` + one `get()`; undecidable inputs never guessed; cancellation of a pre-start anomaly deliberately still allowed). Live rules parity was PROVEN byte-identical (`640c3dae…`, sha256 `ded4a970…`) BEFORE the file was touched, by `scripts/availabilityRulesParity.cjs`. Rules 33/33 + 170/170. **`T-h` is now CLOSED on production evidence** — the deployed `provisionTenant` archive was downloaded and its `src/index.ts` is byte-identical to `c8036f0`, an ancestor of HEAD, so salown-app is conclusively the deployment authority; the export is in the plan. ⚠️ **Data rule: no `availabilityFrom` may be written to production until every unit is live** — the field is inert while absent, and the first one written activates every gate at once. **RELEASED 2026-08-14 in five phases (`R-2026-08-14-B`).** LIVE_VERIFIED covers only what the READ-ONLY smoke proved: served-byte parity on all three sites, the seven revisions at 100 % traffic, the live ruleset verified behaviourally against its own bytes, the migration warning, legacy staff unchanged, the creation gate refusing all three statuses without submitting a valid form, and Finance source byte-identical to the previous release. ⏳ **Still PENDING:** the monitored first-real-member verification — the owner has since set Alex `availabilityFrom = 2026-02-06` (past date, verified read-only) but a genuine FUTURE-start member has not yet been created, so the hidden-then-appears path is unproven in production. ✅ **WHITECROSS MIGRATION COMPLETE 2026-08-14/15 — by the OWNER, by hand, three writes, not by a script and not by this session.** Alex `2026-02-06` · Arda `2026-02-06` · Muhamed `2026-06-09`; the in-app warning went **3 of 3 → 0 of 3**. Verified READ-ONLY afterwards: **every one of the three has their first booking on exactly their start date** (Alex 755 bookings, Arda 668, Muhamed 60), so **zero** records fall before a boundary — no `record-only` lane was created, no historical booking was hidden, and no Finance figure moved. Each boundary was then re-checked against the LIVE ruleset with the real stored record: day-before DENY, start-day ALLOW (inclusive), day-after ALLOW. Arda's value is the *availability* fact, correctly not the payroll one: `partnerConfig.startDate` is `2026-06-29` (the partner→employee conversion) while `wageStartDate` is `2026-02-06`, and he was physically working from February. ⏳ **Still PENDING:** a genuine FUTURE-start member — all three dates are in the past, so the hidden-then-appears path is proven in tests and in the live ruleset but has never been seen on screen. It will verify itself at the next real hire; no action is needed to obtain it. **Next:** `STAFF-START-A2` | 2026-08-14 |
| P1 | `PASSIVE-R3` | `passive` raised to an ABSOLUTE stop, resolved **before** the dated `shiftChanges` override, on every salOWN display surface | **`LIVE_VERIFIED`** | salown-app | released | — | `78124db` / `00cfc43` | `hosting:salown` **`84eb7dda5e1b2140`** (first shipped alone in `2eff0455ed404c15`, release `1786640876872000`) | Whitecross half `WCP-5` **also live** since 18:44Z (`R-2026-08-13-Y`) — both surfaces now resolve passive before the override | 2026-08-13 |
| — | `FIN-PL-SCOPE-SMOKE` | ~~The 2026-08-14 Finance/P&L release has no screen verification~~ | **`LIVE_VERIFIED`** — closed same day | salown-app | released | — | — | ten authenticated read-only checks **10/10 PASS** on the owner's Whitecross session | Closed 2026-08-14. Also produced a second, independent read-only proof that `SPLIT-B-JACK` is canonical: the `⚠ SPLIT ROW CLAMPED` badge is gone from every Breakdown view | 2026-08-14 |
| P0 | `FIN-PL-SCOPE` | Profit-and-loss surfaces were tender-filtered — a P&L charged ONE method's revenue with EVERY method's costs | **`LIVE_VERIFIED`** | salown-app | released | ADR-024 | **`29a7016`** · `5bd2b8d` · `b34d984` | `hosting:salown` **`6cc0254d73227a96`** · release `1786699000997000` · 2026-08-14T09:16:40.997Z | Whole waterfall + Daily Ledger P&L columns read the authoritative roll-up (0 filtered reads, 0 filter branches inside the card, source-asserted); filter can be non-All only where its control renders. Owner confirmed the shell independently; the **ten Finance/Reports screen checks then ran 10/10 PASS** on the owner's Whitecross session, read-only, no credential typed. Net P&L **+£51.60** identical in All/Cash/Card and reconciling. Ledger `R-2026-08-14-A` | 2026-08-14 |
| P1 | `FIN-TENDER-SCOPE-P1` / `P1.1` | `productRev` whole-transaction/non-additive; `Service = Gross − Product` withheld under a filter; the nine Breakdown measures scoped **individually** across three scopes (Tips is leg-additive, Service/Add-ons withhold, four are transaction) | **`LIVE_VERIFIED`** | salown-app | released | `SPLIT-B2` | `0fe662a` · `6f4d335` · `6148dd7` | `hosting:salown` **`6cc0254d73227a96`** | Shipped in the same release as `FIN-PL-SCOPE`; screen-verified 10/10 (`SERVICE (NOT DERIVABLE PER TENDER)` withheld, `(WHOLE TRANSACTIONS)` on Gross/Disc/Loyalty/Net, `CASH TIPS`/`CARD TIPS` additive). No pro-rata allocation invented anywhere; `platformFees` deliberately untouched — it is one of five whole-period costs, and ADR-024 rather than a per-tender scope is its answer. Ledger `R-2026-08-14-A` | 2026-08-14 |
| P1 | `SPLIT-B2` | A tender filter presented TRANSACTION-level loyalty as though it belonged to that method — Cash + Card claimed £12.40 of a £9.20 redemption | **`LIVE_VERIFIED`** | salown-app | released | `SPLIT-B` (done) | `562148d` | `hosting:salown` **`422bcb40aab7df89`** · release `1786651199938000` · 2026-08-13T19:59:59.938Z | Closed. New pure `summariseTransactions` + `(whole transactions)` scope labels on Finance and Reports/Breakdown; **no cash/card share of a redemption is invented**, no P&L figure moves, no stored value changes. Ledger `R-2026-08-13-Z` | 2026-08-13 |
| P1 | `SPLIT-B` | Canonical `paymentAllocation` writer + one set of tender facts across receipt, email, Finance, Reports and Staff Sales; B1 makes a filtered view report the **selected** legs | **`LIVE_VERIFIED`** | salown-app | released | — | `8bbab59` · `52fe47f` · `9b5cb6d` · `7a2598b` · `110e06e` | `hosting:salown` **`84eb7dda5e1b2140`** · `hosting:salown-staff` **`585dd333a4a429cf`** · `salownsendloyaltyemail` **`-00065-hej`** | Writer prevents recurrence; the **existing** malformed row is not repaired — see `SPLIT-B-JACK` | 2026-08-13 |
| P1 | `SPLIT-B-JACK` | The one live booking already written in the malformed shape (`splitAmount "15"`, `splitSecond ""`, no `paymentAllocation`) | **`LIVE_VERIFIED`** — repaired | data | released | `SPLIT-B` (done) | **`839815f`** (tool + proof) | `tenants/whitecross/bookings/3ori9n79QSj09Xyu96fQ` — doc sha256 `b76e344c…` → `7696c275…` | Closed. Four field paths + one audit record in ONE fail-closed transaction; hash re-verified inside the transaction; idempotent; **no deploy**. Receipt/loyalty untouched as required: £49.80 total, 64 pts = £3.20. Canonical and legacy readers now agree rather than merely coexist | 2026-08-13 |
| P1 | `FIN-COMP-S3B` | Wire all six Finance consumers + legacy-vs-period parity mode | `LIVE_VERIFIED` | salown-app | released | — | `5e69b63` | live in `2620fb29bf2e064e` via source `d9bdbc5` | — | 2026-08-12 |
| P1 | `FIN-COMP-S3C` | Compensation-period gate ACTIVATED (`FINANCE_COMP_PERIOD_MODE='periods'`) | `LIVE_VERIFIED` | salown-app | released | — | **`d9bdbc5`** | `hosting:salown` **`2620fb29bf2e064e`** · release `1786574988937000` · 2026-08-12T22:49:48.937Z | Ships S2+S3A+S3B too — none were live before | 2026-08-12 |
| P1 | `FIN-ARDA-REPAIR` | Arda `workingDays` restored — `["Wednesday"]` was his day **OFF**; real rota Mon/Tue/Thu/Fri/Sat/Sun | **`LIVE_VERIFIED`** | data | applied | — | tool `9a90202` | one field, one document, audit `oBEsAFyVVNSZ0O9kMqBW`; `c64453d4…`→`c02bc7a6…`, 2026-08-13T00:07:46.874Z | Owner re-authorised 2026-08-13, declining to defer behind `FIN-PERIOD-CLOSE`. All-time Net P&L −£2,740.86 → **−£14,840.86** (§9.5) | 2026-08-13 |
| — | `FIN-MUHAMED-GHOST-WAGE-P0` | ~~Muhamed accrues rota wages through his 2026-07-14→2026-08-19 leave (≈£1,123.20)~~ | **`WITHDRAWN` — not a defect** | data | **no write** | — | — | leave record **intact and audited**; live resolver accrues **£0 on all 37 leave days**, proven against the exact source live in `2620fb29bf2e064e` | The £1,123.20 was the *leave-blind counterfactual* (27 rota days × £41.60), not a live figure. Reconciled in full (§9.6). No production write, no deploy | 2026-08-13 |
| P1 | `FIN-EFFECTIVEFROM-BACKDATE` | All 3 whitecross `staffComp.effectiveFrom` said **2026-07-15** (the day the Pay tab was opened) | `LIVE_VERIFIED` | data | applied | — | tool `edd4e85` | Alex→`2026-02-06` · Muhamed→`2026-06-09` · Arda→`2026-02-06`; 3 audited writes, idempotent, analyser `ready=true` | — | 2026-08-12 |
| — | `FIN-ARDA-0804` | ~~Open override on `2026-08-04`~~ | **`WITHDRAWN`** | data | — | — | — | — | Right answer, wrong question: the rota itself is corrupt. Once repaired, 2026-08-04 is a Tuesday **in** the rota and accrues on its own — no override is needed or authorised | 2026-08-12 |
| P0 | `SEC-FN-NS` | Nothing stops a third repo re-colliding a function name; no guard on the salown side | `PLANNED` | both | — | — | `a336ddce` (wc) | both names now serve codebase `salown` | Mirror `deploy-functions.sh` step 5b into salown-app | 2026-08-12 |
| P1 | `FIN-COMP-S3A` | Wage resolver can honour a dated employment period | `LIVE_VERIFIED` | salown-app | released | — | `f1239ba` | live in `2620fb29bf2e064e` via source `d9bdbc5` | — | 2026-08-12 |
| P1 | `FIN-S2` | One wage-day rule for all six Finance paths | `LIVE_VERIFIED` | salown-app | released | — | `10e754a` | live in `2620fb29bf2e064e` via source `d9bdbc5` | — | 2026-08-12 |
| P1 | `FIN-S1` | Wage-integrity cause, rejected fixes, S3 scope | `LIVE_VERIFIED` (docs) | salown-docs | released | — | `d7e1e6f` | `origin/main` — docs have no deploy target | — | 2026-08-12 |
| P0 | `FIN-PERIOD-CLOSE` | Closed-month immutability: closing / snapshot / attributable adjustment | `PLANNED` | salown-app | — | owner approval of the baseline (§9.4) | — | — | **URGENT.** The rota is repaired, so today's derived totals are now sound — but they are still *derived*, so the next rota edit re-prices history again. August 2026 is **open** and must not be frozen | 2026-08-13 |
| P0 | `FIN-DATED-ROTA` | Effective-dated rota — move `workingDays` into the dated `staffComp` period so a rota edit stops re-pricing history | `PLANNED` | salown-app | — | `FIN-PERIOD-CLOSE` | — | — | **URGENT.** Root cause of the wage-integrity incident. The 2026-08-13 restore was correct **and** re-priced every closed month a second time — proof the mechanism is still armed | 2026-08-13 |
| P1 | `BK-7` | `HOURS-SSOT-C` — bind Admin availability to canonical tenant hours | `PLANNED` (**newly unblocked**) | salown-app | — | A ✅ + B ✅ both live | — | — | Start; A and B are both LIVE_VERIFIED (§11) | 2026-08-12 |
| P1 | `LOC-1` | `MULTI-LOCATION-PHASE-1` — location authority/registry | `PLANNED` | salown-app | — | `BK-7` first | — | — | Phase order is a dependency chain, not a preference | 2026-08-12 |
| P1 | `STF-2` | S4B staff access callables + UI + rules entry + `PENDING` sweep | `PLANNED` | salown-app | — | `STF-2A` | `3097521` (S4A) | S4A pushed, **no callable, no UI, not deployed** | Build S4B | 2026-08-12 |
| P1 | `SEC-TE` | `T-e` claim writers — paths 1/3/4/5 | `PLANNED` | salown-app + super-admin | — | `SEC-FN-NS` | — | path 2 LIVE; path 1's blocker cleared | Repoint `Settings.tsx` writers at `setStaffRoleCore`; fix the super-admin caller | 2026-08-12 |
| P1 | `SEC-VICTIMS` | Repair the two live identity victims (`the-hair-lab`, `yusufo`) | `BLOCKED` | data | — | owner authorisation | — | — | Separately authorised production write | 2026-08-10 |
| P1 | `ADM-H5` | Super-admin has no working way to open an owner account | `PLANNED` | super-admin | — | — | — | — | One "Create Owner Account" form routed through `approveApplication` | 2026-08-12 |
| P1 | `TR-P2` | Home stat cards + `BookingDetailPanel` (51 sites) currency/i18n | `PLANNED` | salown-app | — | — | — | — | Largest remaining Admin i18n block | 2026-08-12 |
| P1 | `TR-U11` | Unit 11 controlled TRY E2E | `BLOCKED` | salown-app | — | owner lifts the TR payment integrity hold | — | zero `checkoutReceipt` docs in production | Cannot be closed by fabricating data | 2026-08-12 |
| P1 | `RCP-1` | Staff walk-in loyalty/receipt parity | `STATUS_UNKNOWN` | salown-app | — | — | — | — | Audit against the live staff bundle before planning | 2026-08-12 |
| P1 | `BK-5` | In-app notification (reschedule/cancel) live test | `STATUS_UNKNOWN` | salown-app | — | owner field test | — | — | One real reschedule; bell appears or the trigger is stale | 2026-07-20 |
| P1 | `TEC-6` | Firestore index drift: 2 live, repo declares 0 | `STATUS_UNKNOWN` | salown-app | — | — | — | 2 composite READY | Export live indexes into `firestore.indexes.json` **before** any index deploy | 2026-08-12 |
| P2 | `PAY-1` | Stripe Go-LIVE (real money) | `BLOCKED` | salown-app | — | owner live keys | `138e8d7` | TEST mode only | Owner supplies `sk_live_`/live `ca_`/`whsec_` | 2026-07-17 |
| P2 | `PAY-2` | `A1` stylist cap soft→hard | `BLOCKED` | salown-app | — | `PAY-1` / M4 | — | soft nudge is live | Decision, not code | 2026-08-10 |
| P2 | `SEC-STRIPE-SPLIT` | salOWN half of the secret namespace split | `PLANNED` | salown-app | — | — | — | whitecross half done | `SALOWN_STRIPE_SECRET_KEY`, then retire the shared name | 2026-07-21 |
| P2 | `COM-M1` | In-account plan upgrade (request→approve) | `PLANNED` | salown-app | — | — | — | — | Focus-day task | 2026-08-10 |
| P2 | `LEG-1` | salOWN ToS / Privacy pages | `PLANNED` | salown-app | — | — | — | landing footer `href="#"` | Write before onboarding scales | 2026-07-16 |
| P2 | `TEC-2` | `I2` Phase 2 — functions modularisation (parsers slice next) | `PLANNED` | salown-app | — | — | — | `index.ts` **4,738** lines | One slice, one targeted deploy | 2026-08-10 |
| P2 | `TEC-1` | `REL-1` predeploy topology dirties the tracked staff bundle | `PLANNED` | salown-app | — | — | — | — | Isolated-clone deploys sidestep it — candidate fix | 2026-08-10 |
| DORM | `VIS-*` | Marketplace + Trust Score · Stripe Billing M3–M5 · Capacitor/App Store · cross-tenant AI · subdomain themes · Booksy write-back | `DORMANT` | — | — | — | — | — | Not scheduled | 2026-08-10 |

---

## 5. P0 — Production integrity and financial correctness

### 5.1 The campaign chain is half-live, and that is the most important fact in this file

The 2026-08-10 decision was: **do not release CAMPAIGN-LIFECYCLE-PARITY until a server-side
`public/campaign` publisher exists.** Half of it shipped anyway, inside the unrecorded 2026-08-12
Admin release.

Evidence, all read from production on 2026-08-12:

- **`CAM-1` is LIVE.** The served entry chunk `index-CjxIhWAr.js` on `hosting:salown`
  `11cc739f548c5e10` contains `⚡ Bonus points earned` and **no** `Double Points — Active` /
  `2× loyalty points`. That is `01bfebe`'s BookingPage: it reads `tenants/{tid}/public/campaign`
  and resolves through `resolveActiveCampaign`, which is **strict** — a campaign with no configured
  `multiplier` returns `null`.
- **`CAM-2` is not live.** `salownPublishPublicCampaign` does not exist among the 108 deployed
  functions. There is still no server-side writer of `public/campaign`.
- **`CAM-3` is the gap.** `tenants/whitecross/public/campaign` reads
  `{active: true, startDate: "2026-05-24", endDate: "2026-08-24"}` — **no `multiplier`** —
  `updateTime` **2026-06-18T09:38:38Z**. The campaign is inside its window today.

**What this does and does not mean.** It did **not** remove a live banner from the salOWN booking
page: that banner had never rendered for a customer (it previously read auth-only
`settings/settings` and swallowed the 403). So the customer-visible state is unchanged — dark
before, dark now. What changed is that **the repair shipped and did not take effect**, and the item
must not be recorded as delivered. The premium site is the mirror image: `whitecrossbarbers.com`
**is** showing the banner right now, from live `script.js` that reads the same mirror but needs only
`active` + dates — with a hardcoded "2× loyalty points" and the *visitor's* clock. Deploying `WCP-2`
against today's mirror would blank it. `CAM-3` first, in the coordinated order already recorded
under the Marketing theme.

### 5.2 Release governance — `REL-2a`, `REL-3`, `REL-4`

- **`REL-2a`** — `hosting:salown` `11cc739f548c5e10` (2026-08-12T00:12:35.545Z) appears in **no**
  `SYNC.md` entry, **no** `DEPLOYMENT_STATUS.md` row and **no** commit message in any repo. It is
  the release that took `9af1272`, `01bfebe`, `e1df13a` and `ac5b156` live. Its source tree cannot
  be proven: `ac5b156` was **committed 46 seconds after** the release finalised, and its content
  (`wl-spinner`) is served. Ledger row: `SOURCE_SHA = UNKNOWN`.
- **`REL-3` — deploy→commit is a process violation from now on.** Two proven instances on
  consecutive minutes: `adminPurgeTenant` deployed `23:59:33Z`, `d316893` committed `00:00:22Z`;
  `hosting:salown` released `00:12:35Z`, `ac5b156` committed `00:13:21Z`. Both produced correct
  behaviour and **unprovable provenance**, which is the whole cost. See §15.
- **`REL-4` — DONE 2026-08-13, and used the same day.** `whitecross-site/ops/rel4/` is the anchor:
  it vendors the exact served pre-patch `script.js` (`ffa63589…e77637`), the one reviewed patch, the
  released artefact (`2abd181e…49575`), both file manifests, a reproducible `assemble.sh` and a
  read-only `verify.sh` that is run against the built workspace **and** against the served bytes.
  `scripts/rel4-passive-gate.test.mjs` runs one matrix against **both** artefacts and requires the
  pre-patch one to FAIL exactly the defect rows — so a release here cannot be justified by a defect
  that is not demonstrable on the live bytes. First use: `R-2026-08-13-Y` (`WCP-5`).
  **It does not make `main` deployable to U4** — that is still `WCP-2` + `WCP-3`.

### 5.3 Finance / Employment — where the money model actually stands

`FIN-S1` `d7e1e6f` (docs, pushed) · `FIN-S2` `10e754a` (six consumers centralised, 261
golden-parity assertions, 2889/2889 frontend, **pushed, not deployed, production unchanged**) ·
**`FIN-COMP-S3A` `f1239ba` — `PUSHED_NOT_LIVE`, reconciled after the snapshot.**

S3A's final report was received and **independently verified read-only** by this pass:
`origin/main` = `7776d92`, tree clean, `0/0`, no claim outstanding; `FINANCE_COMP_PERIOD_MODE`
ships as **`'legacy'`**; the only referrers of the switch are the resolver itself, its tests and a
read-only analyser script — **no Finance page or consumer imports it**; no Function or hosting
target moved. Reported gates, carried as reported: frontend **3034/3034** · S2 golden parity
**261/261** with the parity file byte-untouched · new S3A period tests **108** · read-only analyser
tests **37** · typecheck/build/scoped lint/diff-check clean · **no deploy, no production write, no
Arda/staff data change**.

What landed: the canonical resolver *can* gate accrual on `staffComp.effectiveFrom`/`effectiveTo`;
both boundaries inclusive; multiple periods and gaps supported; missing/malformed period data
**fails open to legacy**; nothing is wired and no tenant is enabled. **Period closing / month
immutability was explicitly NOT implemented** — do not describe closed months as immutable.

Whitecross dry-run (read-only): 3 accruing staff · 3 `staffComp` records · 2 complete and valid ·
**1 inactive staff member with an open compensation period** · no malformed, overlapping, gapped,
missing or ambiguous record · `readiness = false` · exactly one owner-supplied last-employed date
required. ⚠️ *Corrected the same day by `18405c6`: that flag was an analyser defect (a barber on **leave** also carries `active: false`), so the corrected verdict is **0 open-period anomalies** and **3 subjects whose periods start after their legacy wage window**. Arda's period was already closed at `2026-08-04`. Owner decision and the full read-only verification: §9.3.*

---

## 6. P1 — Product completion and TR readiness

**Turkey is not "Future".** TR-A regional settings, TR-B packages + ledger, TR-B2 accounting +
booking UX, TR-C session lifecycle + follow-ups, TR-D1 checkout Phases 0.5→3B, the Admin TR
checkout cutover, Units 4–9, TR-P1 Admin localisation Phase 1, TR-CURRENCY A–G and
TR-STAFF-LOCALIZATION-P0 are all **deployed and production-verified**. Any line still describing
the TR programme as future work is stale and is corrected in the theme bodies below.

What genuinely remains, in order:

1. **`TR-P2`** — customer-facing i18n and the remaining hardcoded values: Home stat cards,
   `BookingDetailPanel` (51 sites, no `useLocale` at all), and the **stored-money leak**
   (`.replace('£','')` readers) which is a *migration*, not a formatting fix.
2. **`TR-U11`** — the only thing that can prove a real TRY checkout renders. `BLOCKED` on the owner
   lifting the payment integrity hold.
3. **Payment/instalment completeness** — the `onlineBooking` Settings tab is still a read-only
   shell; post-sale plan editing is deliberately absent; a TR-resident PSP is out of scope
   (Stripe does not onboard TR-resident businesses).
4. **`LOC-1` multi-location** — preparation only exists today; nothing reads a location.
5. **KVKK** — gates treatment photographs and automated marketing. Not started.

**Booking / Staff, reclassified against production this pass:**

- Block-time concurrency + mixed-race protection, the service-label resolver, and ANY-BARBER
  server-side assignment: `LIVE_VERIFIED` (§11).
- **`O1S-STAFF-CREATE-CUTOVER` (`234441d`) — the "classification owed" gap is CLOSED as
  `LIVE_VERIFIED`**: the served `staff-BhghYLPT.js` is **byte-identical** (sha256
  `d7410dee…da35`) to the tracked bundle committed at `eac5a95`, and contains `salownCreateWalkIn`
  with no bare `createWalkIn`. It has been live since 2026-08-10T19:13:04Z.
- `O1S` **future-booking core** (`e428124`) remains `PUSHED_NOT_LIVE` — Functions were not deployed.
- `RCP-1` Staff walk-in loyalty/receipt parity and `RCP-4` booking identity/name parity +
  receipt-consumer cutover stay `STATUS_UNKNOWN` until someone audits them against the live bundle.

---

## 7. P2 — Scale and commercial maturity

Monetisation `COM-M1`/`M2` · Stripe Go-LIVE `PAY-1` and the `A1` hard gate `PAY-2` · secret
namespacing `SEC-STRIPE-SPLIT` · pre-scale Tier 2 (`read:true` root-doc lock, `I3` reporting
pre-aggregation, `I4` audit trail Phase B/C) · inventory `A3-2`/`A3-3` · evidence and metrics
`EV1`/`EV2`/`EV3`/`C7` · premium themes `F1`/`F2` · technical debt `TEC-1`/`TEC-2`/`G3`/`DOCID-1`
data residual / 27 us-central1 orphans · legal `LEG-1`. All keep their existing ids and detail
under their themes; none is started.

---

## 8. DORMANT — vision / future

Marketplace + Trust Score (`J1`, ADR-016) · self-serve Stripe **Billing** (`M3`–`M5`) · Capacitor /
App Store (`D1`, ready and waiting, owner decision) · cross-tenant AI assistant (`C4`) · subdomain
themed sites · Booksy write-back robot (`B5` Phase 2). Deliberately outside the execution horizon.
There is **no** personal/consumer calendar sync anywhere on this roadmap — the only calendar work
that exists is `salownIcalFeed`, a one-way iCal feed OUT.

---

## 9. Blocked decisions and dependencies

### 9.1 Owner decisions that block code

| # | Decision | Blocks |
|---|---|---|
| 1 | Lift the **TR payment integrity hold** | `TR-U11`, any real Turkish takings |
| 2 | Supply **Stripe live keys** | `PAY-1`, commission activation, `PAY-2` soft→hard |
| 3 | Authorise the **`FIN-COMP-S3C`** period-closure production write | `FIN-ARDA-REPAIR`, closed-month correctness |
| 4 | Authorise repair of the **two live identity victims** | `SEC-VICTIMS` |
| 5 | Schedule the **`CAM-2` → `CAM-3` → `WCP-2`** coordinated campaign release | the entire campaign chain |
| 6 | Schedule the **O1W F→D→E2E** coordinated activation | `WCP-3` phantom bookings |

### 9.2 Technical dependency chains

- **Campaign:** `CAM-2` publisher deployed by exact name → `CAM-3` republish every tenant's mirror
  from `settings/settings.doublePointsCampaign` → verify source/version/timestamp + normalised
  fields → prove disabled / incomplete / expired / not-yet-started each resolve to `null` → *then*
  `hosting:salown`, and the Whitecross artefact (`WCP-2`) separately.
- **Finance:** `FIN-COMP-S3A` ✅ → `FIN-COMP-S3B` wiring + parity, activation OFF → `FIN-COMP-S3C`
  closure + activation + release + authenticated verification → `FIN-ARDA-REPAIR` →
  `FIN-PERIOD-CLOSE` design.
- **Hours:** `HOURS-SAFETY-A` ✅ LIVE (superseded by `9af1272`) **and** `HOURS-CASING-B` ✅ LIVE
  ⇒ **`BK-7` HOURS-SSOT-C is unblocked.** Then location-scoped hours, after `LOC-1`.
- **Multi-location:** authority/registry → staff/auth → booking/availability → public booking →
  packages → checkout/finance/reporting. `PRE-A`/`PRE-B` are seams, not a feature.
- **Booking security:** `WCP-3` (W1) + `E1` payment E2E → `R1` phase (b) deny anonymous create →
  delete the legacy `addDoc` branch.
- **Function namespace:** `a336ddce` removed both contested exports from whitecross and
  `deploy-functions.sh` step 5b hard-fails on their return. Live labels confirm `addToWaitlist`
  (`-00038-fof`) and `provisionTenant` (`-00137-bij`) both serve codebase **`salown`**.
  `SEC-FN-NS` remains open: no equivalent guard exists on the salown side, and **five** other
  `europe-west2` functions still carry codebase `whitecross` (§10). `createStaffUser` /
  `deleteStaffUser` existing in **both** regions is *not* a same-resource collision — different
  region, different resource — but the legacy `barber-panel` still calls the us-central1 pair
  through a region-less `getFunctions()`, which is its own item.

### 9.3 Owner-confirmed decision — Arda employment boundary *(2026-08-12)*

> ⚠️ **Correction of record (2026-08-12, later the same day).** This section originally opened
> *"the whitecross `openPeriodButStaffInactive` record found by the S3A dry-run is **Arda**"*. **It
> was not.** That flag was an analyser defect — a barber on **leave** also carries `active: false`,
> which the readiness heuristic read as "employment ended"; departure is `status: 'passive' |
> 'deleted'`. Fixed in `18405c6`. **Arda's `staffComp` period was already closed.** The corrected
> read-only whitecross verdict is **0 open-period anomalies**, 0 complete valid periods, **3
> subjects whose periods start after their legacy wage window**, readiness `false`. The owner's
> decision below stands on its own merits and is unaffected; only the sentence that justified
> raising it was wrong.

Owner confirms Arda's employment/wage boundary:

- last worked day **2026-08-04 (Tuesday)**; last wage-entitled day **2026-08-04**;
- canonical `staffComp.effectiveTo` = **2026-08-04, inclusive**;
- expected wage accrual from **2026-08-05 onward = £0**;
- wages through 2026-08-04 have **already been entered** by the owner.

**Final-week clarification (owner, 2026-08-12):**

- **2026-08-03 Monday** — Arda did not attend/work; expected accrual **£0**;
- **2026-08-04 Tuesday** — Arda worked; **his only wage-entitled day that week**;
- expected final-week accrual: **exactly one wage day, 2026-08-04**;
- `effectiveTo` remains **2026-08-04 inclusive**; **2026-08-05 onward = £0**.

**Constraints that travel with this decision:** do not create another wage payment or settlement ·
do not alter historical payment entries · do not change Arda's `workingDays` yet · the `staffComp`
period closure stays a separately authorised **`FIN-COMP-S3C`** production write, after `S3B`
wiring and parity proof · the later verification must show **zero accrual from 2026-08-05** without
duplicating or changing the wages already recorded through 2026-08-04. **This clarification does
not authorise a production write.**

#### Required `FIN-COMP-S3C` proof

| # | Assertion | State today (read-only, 2026-08-12) |
|---|---|---|
| 1 | `2026-08-03` = £0 | ✅ **already true** — see below |
| 2 | `2026-08-04` = exactly one wage day | ❌ **£0 today, in BOTH modes** |
| 3 | `2026-08-05` onward = £0 | ❌ **legacy accrues every Wednesday, unbounded**; ✅ under `'periods'` |
| 4 | no duplicate payment/settlement | not yet exercised |
| 5 | historical settled totals unchanged | ⛔ **would FAIL today** — see the `effectiveFrom` trap |

#### Read-only verification, 2026-08-12 — run before S3C changes anything

Performed against the **real exported resolver** (`accruesWageOnDay`, bundled unmodified from
`src/utils/financeWages.ts`) and **real production data** read from Firestore. **No write, no
deploy, no data change.** Arda = `barbers/barber-1777655430086`, `status: 'passive'`.

**① `2026-08-03` already resolves to £0, and the cause is exactly the one hoped for.** The barber
document carries a date-specific Off record: `shiftChanges['2026-08-03'] = { closed: true, reason:
'personal' }` — one of the owner's seven, all `closed: true`. `accruesWageOnDay` returns `false` at
the `if (sc?.closed)` line, in legacy **and** in `'periods'` mode. **No correction is needed and no
authorisation is requested for this day.**

**② `2026-08-04` does NOT accrue today, and S3C alone cannot make it.** `workingDays` is
`["Wednesday"]` — a single day — and `2026-08-04` is a Tuesday with **no** shift override and no
leave record (`leaves: []`, `leaveFrom: null`). The rota branch therefore answers `!!sc ||
wdays.includes('Tuesday')` = `false`. **The period gate can only remove a day, never add one**, so
`effectiveTo = 2026-08-04` cannot produce the expected single wage day. Delivering assertion 2
requires **adding** an open date-specific override on `2026-08-04` — a date-specific correction,
which is precisely the case the owner reserved for **separate authorisation**, and which must not
be done by editing `workingDays`.

**③ `2026-08-05` onward accrues today.** Legacy resolves **YES** on `2026-08-05`, `-08-12`,
`-08-19`, `-08-26`, `2026-09-02` … every Wednesday, without end — there is no `wageEndDate` and
none may be invented (INV-PARA-13/14). Under `'periods'` every one of them resolves **£0**, so the
S3C gate is the correct and sufficient fix for this assertion.

**④ The final week's *count* is right today by accident, and its *day* is wrong.** Mon 2026-08-03 →
Sun 2026-08-09 currently accrues **exactly one** wage day — but it is **Wednesday 2026-08-05**, a
day *after* the employment boundary, not Tuesday 2026-08-04. Anyone checking "one wage day that
week" without checking *which* would pass a broken state.

**⑤ `effectiveTo = 2026-08-04` is ALREADY stored.** `staffComp/barber-1777655430086` holds
`history[0] = { effectiveFrom: '2026-07-15', effectiveTo: '2026-08-04', type: 'wage', params:
{ amount: 600, period: 'week' } }`, `updatedAt` **2026-08-04T17:45:12Z**. **S3C therefore needs no
production write to set the boundary** — only the controlled flag activation. That materially
shrinks S3C.

**⑥ ⛔ But activation is blocked by `effectiveFrom`, and it breaks assertion 5.** All three
whitecross `staffComp` records start **2026-07-15** — the day the Phase B Pay tab was first used,
not the day anyone was hired — while `partnerConfig` pays from **2026-02-06** (Alex, Arda) and
**2026-06-09** (Muhamed). Flipping `FINANCE_COMP_PERIOD_MODE` to `'periods'` today would zero
**February → 14 July** for all three and move the salon total from **£24,136.80 → £6,605.60
(−£17,531.20)**. That is INCIDENTS 2026-08-12 running backwards — the past silently rewritten — and
it fails the owner's own assertion 5 outright. **Every `effectiveFrom` must be pulled back to the
real employment start (owner-approved, audited) BEFORE the flag is turned on for any tenant.**
"Records look clean" is not readiness; `scripts/analyseCompPeriods.cjs` now reports this as
`periodStartsAfterLegacyWageStart` (`18405c6`).

**Reported cause, per the owner's instruction, with no correction made:** `workingDays` was **not**
changed, payment history was **not** altered, and nothing was written. Two date-specific
corrections now need separate authorisation — **(a)** an open override on `2026-08-04` so the day
Arda actually worked is paid, and **(b)** the `effectiveFrom` backdating for all three records
before activation.

### 9.4 `FIN-COMP-S3C` — activated, verified live, and what it deliberately did NOT settle (2026-08-12)

**Released.** `hosting:salown` version **`2620fb29bf2e064e`** · release `1786574988937000` ·
2026-08-12T22:49:48.937Z, built from an isolated clean checkout pinned to
**`d9bdbc5797d6255c86c08a3f26181dadedf45757`**. Ledger row `R-2026-08-12-B`. S2 (`10e754a`), S3A
(`f1239ba`) and S3B (`5e69b63`) went live in the same release — **none of them was live before**,
which is why the pre-release `Finance` chunk carried no cutover marker at all.

**The three `staffComp` corrections landed first, and that ordering was the whole point.** All
three records said `effectiveFrom: 2026-07-15` — the minute the Pay tab was first saved (three
`COMP_CHANGED` audit events at 14:49:12 / 14:50:41 / 14:51:31). Activating against those dates
would have zeroed February → 14 July by **−£17,289.60**. Corrected first (audited, idempotent,
hash + `updateTime` preconditioned; only `effectiveFrom` moved), so activation moved
February–July by exactly **£0.00 per month**.

**Verified live, with no `periodMode` passed anywhere:** 2026-08-12 **£200 → £100** (Alex £100 ·
Arda £0 · Muhamed £0) · Arda **£0 on every date after 2026-08-04** through 2026-12-31 · August
−£200 · all-time wages £20,489.60 → £20,289.60 · payments/advances/settlement/bookings/barbers all
byte-unchanged.

#### Arda's rota is corrupt, and it is NOT what this release fixed

`workingDays: ["Wednesday"]` is his **day OFF**. Of 147 worked days: 25 Mondays, 25 Tuesdays,
**2 Wednesdays**, 23 Thursdays, 25 Fridays, 24 Saturdays, 23 Sundays. Six independent sources
agree on the real rota (Mon/Tue/Thu/Fri/Sat/Sun): the booking distribution · the employee window
reconciling exactly (25 days = 25 booking days = £2,500 earned = £2,500 paid = £0 balance) · the
£400 "Wages" payment on 2026-08-02 clearing July's month-end shortfall · the owner's own
"−14k" expectation · the signed exit agreement's own clause recording **"off günü Çarşamba"** ·
and the partner-era total reproducing the workbook exactly (123 days / £12,300) with advances
matching the signed £6,282 to the penny.

**When it broke is now bounded by hard evidence.** Eight **Website** (online) bookings exist for
Arda on non-Wednesdays, the last created **2026-08-03T20:50:43Z** for Tuesday 2026-08-04. Online
booking gates on `workingDays`, so Tuesday was still in the rota then. His document was last
written **2026-08-10T19:24:26.175Z** — unaudited, 43 seconds after `settings/hours` was saved,
carrying the documented `BARBER-HOURS-PROPAGATION-RACE-P0` fingerprint (Tuesday is the only day in
his `dayHours` lacking `closed`, and still holds 09:00 against the salon's new 10:00). The audited
Team editor **does** diff `workingDays` (`Barbers.tsx:407`) and never recorded a change. So the
corruption window is **2026-08-03 20:50Z → 2026-08-10 19:24Z** — two days before the owner
noticed, not months. *Not proven:* the exact mutation step. With every salon day open, the
pre-fix propagation only ever **adds** days, so a six-day rota cannot shrink to one by that path
alone, and no before-image is stored anywhere.

**Consequence, unfixed:** live all-time Net P&L reads **−£2,740.86**; reconstructed with the real
rota it is **−£14,840.86**. Arda's historical labour cost is understated by ≈£12,300.

#### Accounting baseline — read-only reconciliation, owner-blocked

The ≈£9,000 is **a debt owed BY the company TO Arda**, not the reverse, and it is **not in
Firestore**: `settings/exit_agreement` does not exist (never signed) and no value in the
7,500–11,000 range exists in any of the tenant's 30 collections. Composition per the signed
`Arda_Exit_Agreement.md`: capital refund **£5,500** + net wage **£3,500** (122d × £100 = £12,200 −
£6,282 advances = £5,918 unpaid, less **£2,418** borne loss share) = **£9,000**; the £3,623 capital
shortfall was cancelled. Arda's ownership share was **25%** — the **40% is the repayment rate**
from future monthly net profit, not his share. Clause 7.2 has triggered (he left 2026-08-04, before
2027-02-06), so the goodwill £1,061 is added back and the figure becomes **≈£7,939**.

**No double count.** Partnership-period wage accrual is an operating P&L expense; the unpaid/settled
amount is a liability/capital item. `netPL`/`companyNetPL`/`rawPL` reference neither `initialPool`,
`investmentTransactions` nor `settlement` (`Finance.tsx:325/402/442`), and Arda is
`isPartner:false` so he is excluded from the partner ledger entirely. The only in-system settlement
ever recorded was a **different** £1,193.36 Plan-A entry, signed 2026-06-25T10:00:16Z and
**reversed** at 10:55:30Z the same morning.

**Unresolved:** a **≈£569.97** Feb–Jun gap between the reconstructed system P&L (−£13,044.73) and
the workbook's `HESAP_OZETI` (−£13,780.30) remains open on the revenue/expense/fixed side. The
wage half reconciles exactly (−£165.60: Alex −3 days, Arda +1 day, Muhamed +1 day and £41.60 vs
£42). The workbook's own daily sheets also do not reconcile to its own `HESAP_OZETI` by ≈£711 —
February's sheet uses a column layout that could not be mapped reliably, and two off-book items
(£600 injection, £60) are known to be absent. **No bridge was invented for it.**

**Therefore `FIN-PERIOD-CLOSE` must NOT freeze today's derived totals** — they are computed from
the corrupt rota. The baseline it should eventually freeze is: Feb–Jun from the **workbook**
(−3,037.99 / −3,758.98 / −2,577.86 / −2,255.66 / −2,149.81), July–August from the **system**
(the owner never entered July in the workbook), and **August 2026 is open and must not be frozen**.
`£7,939` is **not** recorded here as a production liability — only that the signed external
agreement supports it, and that its canonical production representation is a separate,
owner-authorised accounting migration.

### 9.5 `FIN-ARDA-REPAIR` — the rota is restored, and the books now say what happened (2026-08-13)

**Owner re-authorised Phase 6 on 2026-08-13**, explicitly declining to defer the restoration behind
`FIN-PERIOD-CLOSE`: the live Finance screen was materially wrong *today*, and with
`FINANCE_COMP_PERIOD_MODE='periods'` LIVE_VERIFIED the repair can no longer re-open accrual past
`effectiveTo`. That ordering is the entire reason it was safe — under `'legacy'` the same write
would have turned a one-day-a-week ghost accrual into a six-day one.

**One field, one document.** `tenants/whitecross/barbers/barber-1777655430086` ·
`workingDays: ["Wednesday"]` → `["Monday","Tuesday","Thursday","Friday","Saturday","Sunday"]`.
Written with a `lastUpdateTime` precondition, `c64453d4833f9f4a` → `c02bc7a6a61c8454`,
2026-08-10T19:24:26.175Z → **2026-08-13T00:07:46.874Z**, audit **`oBEsAFyVVNSZ0O9kMqBW`**
(`BARBER_ROTA_CORRECTED`, before/after + both hashes + both updateTimes + rollback identity + owner
authorisation + a reason that names the 2026-08-10 unaudited write). A second dry-run proposes
**0 updates**. Nothing else on the document moved: `shiftChanges` (7 keys), `dayHours`, `status`,
`active`, `leaves` all byte-identical.

**Pre-write gate: 16/16.** Live hosting still `2620fb29bf2e064e` with the `` periods `` marker
served · `workingDays` still exactly `["Wednesday"]` · document hash and `updateTime` matched the
frozen identity · full rollback snapshot captured · payments/advances/settlement identities
reconfirmed · the exact after-state simulated through the live resolver first.

**Post-write, verified live across the six consumers (no `periodMode` passed anywhere):**

| Assertion | Result |
|---|---|
| Employee period 2026-06-29 → 2026-08-04 | **25 wage days** |
| Earned / paid / balance | **£2,500 / £2,500 / £0.00** |
| 2026-08-03 · 2026-08-04 · 2026-08-05→12-31 | **£0** (existing Off) · **1 wage day** · **£0** |
| 2026-08-12 | Alex £100 · Arda **£0** · Muhamed £0 · **total £100** |
| All-time wages | £20,489.60 → £20,289.60 (activation) → **£32,589.60** (repair) |
| **All-time Net P&L** | −£2,740.86 → **−£14,840.86** — the predicted figure, to the penny |
| Payments · advances · settlement · bookings · Alex · Muhamed · all three `staffComp` | **byte-unchanged** |
| Deployment | **none in this phase** |

**No difference to explain.** `£40,308.74 − £32,589.60 − £22,560.00 = −£14,840.86` reproduces the
reconstruction exactly, and matches the owner's independent "over −14k" recollection.

**What this does NOT close.** The repair itself re-priced every closed month a second time
(+≈£12,300) — correctly this time, but by the same undated mechanism that caused the incident. So
`FIN-PERIOD-CLOSE` and `FIN-DATED-ROTA` are **raised to P0/urgent**, not satisfied: until a closed
month is stored rather than derived, the next legitimate rota edit will move history again. The
**≈£569.97** Feb–Jun workbook reconciliation gap stays open as a separate accounting item (the wage
half reconciles exactly at −£165.60; the workbook's own daily sheets also disagree with its own
`HESAP_OZETI` by ≈£711). **August 2026 remains open and must not be frozen.** `£7,939` is still
**not** recorded as a production liability.

### 9.6 `FIN-MUHAMED-GHOST-WAGE-P0` — the ghost was in the measurement, not in production (2026-08-13)

A P0 was raised on the report that Muhamed accrues rota wages straight through his
2026-07-14 → 2026-08-19 leave, ≈**£1,123.20**. Investigated read-only under a pre-write gate.
**No such accrual exists.** Nothing was written, nothing was deployed.

**The leave record is intact, and it is the one the owner entered.** `tenants/whitecross/barbers/barber-1781007454543`
holds `status: 'leave'` · `leaveFrom: '2026-07-14'` · `leaveUntil: '2026-08-19'` · `leaves: []`,
hash `9a037865ee683089`, `updateTime` **2026-08-10T19:24:26.211Z**. Audit `PJw1MYQGQRlIQOxIMSGu`
(2026-07-14T20:39:33Z, `BARBER_UPDATED`) records `status: active→leave` and
`leave: null → "2026-07-14->2026-08-19"` — the live document still matches that event **field for
field, 30 days later**. So the 2026-08-10 propagation write touched his document in the same
unaudited cluster as Alex (…25.900Z) and Arda (…26.175Z), but it did **not** erase or corrupt the
leave fields. There was nothing to restore, and the Phase-2 authorisation — which covers *restoration
of an erased leave record only* — never opened.

**The resolver honours it, on every one of the 37 days.** Proven twice over: through
`scripts/wageDriftAudit.cjs`'s parity-pinned twin, and by running the **real**
`accruesWageOnDay` / `resolveAccrualDays` / `isBarberOnLeaveForDate` over the live document with
each leave date asserted individually. `src/utils/financeWages.ts`, `bookingUtils.ts`, `Finance.tsx`,
`compUtils.ts` and `financeCompPeriodCutover.ts` are **byte-identical** between the working tree and
`d9bdbc5`, the source of the live release `2620fb29bf2e064e` — so this is the live behaviour, not a
local build. All six consumers agree:

| Consumer | Muhamed, leave window |
|---|---|
| 1/6 daily P&L row | **£0.00** (0 of 37 days) |
| 2/6 monthly company wages | Jul **12 d / £499.20** (all ≤ 07-13) · Aug **10 d / £416.00** (all ≥ 08-20) |
| 3/6 partner ledger · 4/6 credited-employee | not applicable (`isPartner: false`, `creditTo: null`, 0 rows credit to him) |
| 5/6 non-partner staff ledger | leave window **0 d**; to-date **31 d / £1,289.60** |
| 6/6 G4 weekly ledger | w/c 07-20, 07-27, 08-03, 08-10 = **0 d** each |

**Where £1,123.20 came from, exactly.** It is 27 × £41.60 — the rota days between 2026-07-14 and
2026-08-13 **with the leave gate not applied**. The companion "58 days" is 31 + 27: the true 31
pre-leave days plus the same 27 phantom ones. Both figures are reproducible as a *counterfactual*
and neither is a live total. The genuine numbers: **31 wage days / £1,289.60** for
2026-06-09 → 2026-07-13 (26 rota days to 07-12, plus 07-13 — a Monday, off-rota, accruing on an
explicit **open** `shiftChanges` override, his last day before the leave), then **£0.00** through
2026-08-19. Booking evidence agrees independently: 30 distinct booking days, first 2026-06-09, last
**2026-07-13**, none after. `ACCRUAL_WITHOUT_WORK` reports **0 findings** for him, and
`ROTA_CONTRADICTS_WORK_EVIDENCE` does not fire on him at all.

**One real forward-looking question, for the owner — not a repair.** The leave is dated and *ends*.
From **2026-08-20** Muhamed resumes accruing £41.60/day automatically (10 days = **£416.00** in
August alone), because `staffComp.effectiveTo` is `null` and `status: 'leave'` is a *temporary*
state. Every stored fact says "away until 19 August, then back". `active: false` and the absence of
bookings since 13 July are **not** evidence of termination and were deliberately not read as such.
If he is not returning, the correct instrument is `staffComp.effectiveTo` — **not** a leave edit, and
explicitly not the 2099-leave or `wageEndDate` shapes already rejected in the 2026-08-12 incident.

**Transferable lesson.** Every previous finding in this thread was a *production* defect found by
looking at a screen. This one was a *measurement* defect: a wage figure computed without the leave
gate looks exactly like a ghost wage, reconciles to a plausible penny amount, and names a real
person. `FIN-WAGE-DRIFT-A` already encodes the rule that catches it — a drift claim must be
reproduced through the parity-pinned resolver before it is treated as money.

---

## 10. Per-target release truth table

| Unit | Repository | Source SHA | Live identity | Status | Evidence | Next action |
|---|---|---|---|---|---|---|
| `hosting:salown` — Admin + landing + `/book/**` + `/s/**` | salown-app | **UNKNOWN** | `11cc739f548c5e10` · rel `1786493555545000` · 2026-08-12T00:12:35Z | `STATUS_UNKNOWN` (source) / LIVE (target) | served `index-CjxIhWAr.js`; `wl-spinner` in served landing; no ledger entry anywhere | `REL-2a` |
| ↳ `9af1272` barber-hours propagation race | salown-app | `9af1272` | same | **`LIVE_VERIFIED`** | served `Settings-ZjvTQcBn.js` contains ``source:`salon` `` + `` `dayHours.${…}` `` field-scoped update | — |
| ↳ `01bfebe` campaign resolver (frontend) | salown-app | `01bfebe` | same | **`LIVE_VERIFIED`** | `⚡ Bonus points earned`; old strings absent | `CAM-3` |
| ↳ `e1df13a` TR-DEMO-ADMIN-LOCALIZATION-P0 | salown-app | `e1df13a` | same | **`LIVE_VERIFIED`** | `🛍 Ürün ekle`, `dk kapatıldı`, `1,5 saat` served | — |
| ↳ `ac5b156` landing demo-request popup | salown-app | `ac5b156` | same | **`LIVE_VERIFIED`** | `wl-spinner` served; **committed 46 s after the release** | `REL-3` |
| ↳ `d726b1b` TR-CURRENCY-G public `/s/**` prices | salown-app | `d726b1b` | `3a0fcdea…`, still served | **`LIVE_VERIFIED`** | served `` · from ${…formatMoney(t)}``; old `from £${minPrice}` gone. *Corrects the previous "on main, NOT DEPLOYED".* | — |
| ↳ `afb40fb` MULTI-LOCATION-PRE-B | salown-app | `afb40fb` | `3a0fcdea…` onward | **`LIVE_VERIFIED`** | DEPLOYMENT_STATUS release row (client-side only). *Corrects "pushed, no deploy".* | — |
| ↳ `72ce9be` MULTI-LOCATION-PRE-A | salown-app | `72ce9be` | frontend type-level only | **`PUSHED_NOT_LIVE`** | Functions half never deployed; no reader consults `locationIds` | `LOC-1` |
| `hosting:salown-staff` | salown-app | **`eac5a95`** | `b9a396c48836840f` · rel `1786389184539000` · 2026-08-10T19:13:04Z | **`LIVE_VERIFIED`** | served `staff-BhghYLPT.js` sha256 `d7410dee…da35` **== tracked bundle**; Turkish strings present; `salownCreateWalkIn` present | write the missing ledger row |
| ↳ `234441d` O1S staff create cutover | salown-app | `234441d` | same | **`LIVE_VERIFIED`** | ancestor of `eac5a95` + byte parity + callable marker | closes the 2026-08-10 "classification owed" |
| ↳ TR-STAFF-LOCALIZATION-P0 `dde52ab`…`eac5a95` | salown-app | `eac5a95` | same | **`LIVE_VERIFIED`** | as above — **had no SYNC or DEPLOYMENT_STATUS record at all** | ledger row written |
| `hosting:salown-admin` — Super Admin | super-admin | **`51e70a0`** | `9f457fc2c8ee4b35` · rel `1785493665740000` · 2026-07-31T10:27:45Z | **`LIVE_VERIFIED`** | served `index-DmG8j3Xi.js` contains `no email on this conversation` | — |
| `hosting:whitecrossbarbers-saas` | whitecross-site | **REPRODUCIBLE via `ops/rel4/`** (anchor `36d77f82`; still ≠ `main`) | `25b14188c8e6e9ed` · rel `1786646659069000` · 2026-08-13T18:44:19Z | **`LIVE_VERIFIED`** | 2026-08-13 `R-2026-08-13-Y`: served `script.js` sha256 `2abd181e…49575`, 125,531 bytes = `ops/rel4/baseline/script.js` + `ops/rel4/script.passive-gate.patch`, reproducible by `assemble.sh`. Only `/script.js` differs from the previous version across the whole 59-file version. `salownCreateBooking` **0**, `expectedPaymentFlow` **0**, `isBarberPassive` **3** (was 0); served `index.html` byte-unchanged, still carrying `Double Points` + `2× loyalty points` and no `doublePointsMultiplier` ⇒ `bc25d257` **still absent** | `WCP-2` + `WCP-3`, then reconcile `main` |
| Functions codebase `salown` | salown-app | mixed per function | 76 functions | LIVE, per-revision | `addToWaitlist -00038-fof` · `provisionTenant -00137-bij` · `approveApplication -00014-yup` · `adminPurgeTenant -00012-vav` · `salownGetBusySlots -00064-foj` · `createStaffUser -00058-kur` | keep targeted; never blanket |
| ↳ `d316893` adminPurgeTenant backup path | salown-app | `d316893` | `adminpurgetenant-00012-vav` (2026-08-11T23:59:33Z) | **`LIVE_VERIFIED`** | deployed source package contains `superAdmin/backups/entries/${backupId}` in **both** `lib/index.js` and `src/index.ts` | — |
| ↳ `c8036f0` `salownPublishPublicCampaign` | salown-app | `c8036f0` | **absent** | **`PUSHED_NOT_LIVE`** | not among the 108 deployed functions | `CAM-2` |
| ↳ `e428124` O1S future-booking core | salown-app | `e428124` | not deployed | **`PUSHED_NOT_LIVE`** | no Functions deploy on 2026-08-09 | — |
| ↳ `3097521` S4A access foundation | salown-app | `3097521` | not deployed | **`PUSHED_NOT_LIVE`** | no callable, no UI | `STF-2` |
| Functions codebase `whitecross` | whitecross-site | `a336ddce` (source) | 30 functions — **5 in europe-west2** (`salownNotifyNewBooking`, `salownSendTestTelegram`, `salownSyncTreatwellIcal`, `sendProInterest`, `setTenantClaim`, all `2026-07-21T00:06Z`) + 25 in us-central1 | LIVE | read-only label sweep | on the next wc deploy confirm `addToWaitlist`/`provisionTenant` stay codebase `salown` |
| `firestore.rules` | salown-app | not proven against file | ruleset `640c3dae-a9c8-4cb3-80c4-bc189e72874a`, updated 2026-08-05T12:52:07Z | **`LIVE_VERIFIED`** (identity) | Rules API release read | — |
| Firestore indexes | salown-app | — | **2 composite, READY** | **`STATUS_UNKNOWN`** | repo `firestore.indexes.json` declares **0 indexes** + 1 fieldOverride ⇒ a `--only firestore:indexes` deploy would propose deleting both | `TEC-6` — export live first |
| Production data migrations / activations | data | — | none pending-applied | — | `public/campaign` mirrors stale (`CAM-3`); `staffComp` closure not written (`FIN-COMP-S3C`); Arda `workingDays` untouched | see §9 |

---

## 11. Recently completed and LIVE_VERIFIED

Verified against production in this pass (2026-08-12) unless dated otherwise:

- **`9af1272` BARBER-HOURS-PROPAGATION-RACE-P0** — one transaction, seven days, field-scoped dotted
  paths; supersedes the `HOURS-SAFETY-A` pin. Live on `11cc739f548c5e10`.
- **`HOURS-CASING-B` `10febff`** — `salowngetbusyslots-00064-foj`, live 2026-08-10.
- **`d316893` adminPurgeTenant** — corrected `superAdmin/backups/entries/${backupId}`, live in the
  deployed source package at `-00012-vav`.
- **`SHARED-FN-NAMESPACE` symptom** — `addToWaitlist` + `provisionTenant` both serve codebase
  `salown` (`-00038-fof` / `-00137-bij`), and the first owner account since 2026-07-13 was
  provisioned end-to-end through apply→approve on 2026-08-12 (`dayi-barbers`).
- **`TR-STAFF-LOCALIZATION-P0` + `O1S-STAFF-CREATE-CUTOVER`** — byte-proven on
  `b9a396c48836840f`.
- **`e1df13a` TR-DEMO-ADMIN-LOCALIZATION-P0**, **`d726b1b` TR-CURRENCY-G**, **`afb40fb`
  MULTI-LOCATION-PRE-B**, **`ac5b156` landing popup** — all served.
- **Super Admin `51e70a0`** — live-chat visitor contact details.
- Standing, re-confirmed: server-authoritative booking (`C1`/`H1`/`R1a`/ANY-BARBER/`O1A`/`O1C`/`O1P`),
  UK financial parity (`P1-RECEIPT-MATH`, Units 4–6, DPPP, ghost-wage, ADMIN-SALES-FILTER-1),
  product-sale authority (PSA1/PSA2 both tills), team identity contract `O1`, the Turkey foundation
  (TR-A/B/B2/C/D1 + Units 4–9 + TR-P1), TR-CURRENCY A–G, service identity read side, CI hosting
  scope + release guard + emulator pin.

**`CAM-1` is LIVE_VERIFIED but is deliberately NOT in this list as "completed"** — see §5.1.

---

## 12. Recently pushed but not live

*Nothing here may be described as working for a salon.*

| Work ID | Commit | Why not live |
|---|---|---|
| `FIN-COMP-S3A` | `f1239ba` | no deploy; `FINANCE_COMP_PERIOD_MODE='legacy'`; no consumer wired; no tenant enabled |
| `FIN-S2` | `10e754a` | pushed, no deployment at completion; production unchanged |
| `CAM-2` | `c8036f0` | publisher absent from the 108 deployed functions |
| `WCP-2` | `bc25d257` | proven absent from the live Whitecross artefact; deploying blanks a live banner |
| `LOC-PRE-A` (Functions half) | `72ce9be` | storage-only seam; Functions half never deployed |
| `STF-2A` S4A | `3097521` | source + tests; no callable, no UI |
| `O1S` future-booking core | `e428124` | Functions not deployed |
| `A3` inventory cores | `34ddb12`/`980f6f1`/`98e4bcd` | NOT WIRED / NOT DEPLOYABLE by design |
| `SEC-FN-NS` source protection | `a336ddce` (+ record `cb710db` in **salown-docs**, not whitecross-site) | on `origin/main`; the guard only proves itself on the next whitecross Functions deploy |
| `PROFILE-SPECIALHOURS-BACKFILL` | `2cc2a1e` | read-only tool, dry run only, no write |

`salownCheckoutBooking` is **deployed but dormant** — reachable only from the Admin TR till, TR
tenants only (today `demo`); a tenant without `checkoutSettings` fails closed with
`CHECKOUT_DISABLED`. `O1W` hosted payment routing + `PAY-CHANNELS-A` are **live but dormant** — no
tenant root doc carries `paymentSettings.channels`.

### 12.1 Process violations found in this pass

1. **Deploy→commit, twice** (`adminPurgeTenant` −49 s; `hosting:salown` −46 s). Prohibited from now
   on (§15).
2. **Three unrecorded release events** — `hosting:salown` `11cc739f548c5e10`, and both
   `salown-staff` releases of 2026-08-10 (`926999f6f3edddde` 19:07, `b9a396c48836840f` 19:13). The
   Staff one is named in a claim-release commit message (`1c04e92`) but appears in neither
   `SYNC.md` nor `DEPLOYMENT_STATUS.md`.
3. **A whole work item with no roadmap entry** — `TR-STAFF-LOCALIZATION-P0` (four commits, one live
   release) appeared in no roadmap, ledger or SYNC record before this pass.

---

## 13. STATUS_UNKNOWN — audit required

Never guess these. Each names the cheapest experiment that would settle it.

| Work ID | Question | Cheapest resolution |
|---|---|---|
| `REL-2a` | What tree produced `11cc739f548c5e10`? | Operator recollection, or accept `UNKNOWN` permanently in the ledger |
| `WCP-1` | What tree produced `e6be08684d312ce7`? | **Still unknown, and now largely moot for releasing**: `ops/rel4/` pins the served bytes and manifests directly, so U4 releases are reproducible without ever answering this. The open question is narrower — what has to change in `main` for it to *become* the source (`WCP-2` + `WCP-3`) |
| `TEC-6` | Which 2 composite indexes are live, and why is the repo empty? | `firebase firestore:indexes` export → commit → compare. **Do not deploy indexes until then** |
| `RCP-1` | Is Staff walk-in loyalty/receipt parity live? | Marker audit against the served `staff-BhghYLPT.js` |
| `RCP-4` | Booking identity/name parity + receipt-consumer cutover | Same audit, same bundle |
| `BK-5` | Does the in-app reschedule/cancel notification fire? | One real reschedule from the panel |
| `FIN-GHOST-PASSIVE` | Does a **passive** barber still accrue a daily wage (`Finance.tsx`), and is a barber on leave still in the occupancy denominator (`OccupancyPanel.tsx`)? | Read the two files. **Not** closed by `5746237`, which removed a different ghost |
| `TR-CURR-GBP` | TR-CURRENCY-F GBP authenticated pass | One authenticated UK session |
| `ADMIN-SALES-UI` | ADMIN-SALES-FILTER-1 running screen | One authenticated browser pass |
| `TESTS §12/§14/§15/§16` | Manual visual passes (TR-A incl. Chrome auto-translate · Turkish follow-ups · TR-B2 Stage 4 · package catalogue desktop) | Owner/browser session |

---

## 14. Completed archive

The dated detail, commits and narrative for everything closed live in the **Completed (archive)**
section at the bottom of this file, and in [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md),
[RELEASE_LEDGER.md](RELEASE_LEDGER.md), [INCIDENTS.md](INCIDENTS.md) and `salown-app/SYNC.md`.
Nothing was deleted by this reconciliation: superseded statuses were replaced in place with a short
audit note saying **what changed and why**.

---

## 15. Daily maintenance protocol

The full **Daily Project Truth** process — session start, session completion, and the end-of-day
reconciliation pass — is in [CLAUDE.md](CLAUDE.md#daily-project-truth) and is checked by
`docs/scripts/daily-reconciliation-check.sh`. The three rules that exist because of what §12.1
found:

1. **Never deploy from an uncommitted or dirty tree, and never deploy then commit.** Pin a commit,
   build from it, release it, and let the ledger name it.
2. **A release without a `RELEASE_LEDGER.md` row does not count as done**, however well it went.
3. **Never mark work live without production verification** of the exact behaviour — and never
   silently overwrite another session's status.

If a day produces no product status change, record
`DAILY_RECONCILIATION_COMPLETE — NO STATUS CHANGE` so that *absence of an update* is
distinguishable from *forgetting*.

---

# Theme detail

> Below this line the themes keep their original structure, ids and technical detail. Where the
> evidence in §10 contradicted a line, the status was corrected **in place** with a dated audit
> note. Where an item is genuinely old but genuinely unfinished, it was kept.

## 👥 Employment Model & Staff Management

> **NOT an ordinary "Staff" item — it represents the salon's financial model.** In the same system, **salaried + commission + chair-rent (self-employed)** staff coexist; each affects P&L completely differently (+ the UK legal distinction self-employed≠employee). "Adding a barber" is easy in Booksy/Fresha/Treatwell; the real problem is **managing the employment model**. Design: [STAFF_MANAGEMENT_DESIGN.md](STAFF_MANAGEMENT_DESIGN.md). Backbone: `tenants/{tid}/staffComp/{barberId}` + append-only date-effective `history[]` + "passive = comp period closed" + pure-derivation.

- ✅ **Lifecycle** — active / leave (dated, returns automatically) / passive / deleted; leave archive (`barber.leaves[]`), 5 surfaces pulled to a single precedence (override>leave>passive>workingDays), including the whitecross-site port. *(detail: Completed › G5)*
- ✅ **Compensation model UI (Phase B)** — Staff Hub tabbed drawer (Profile/Availability/Pay/History), PayModelChip, 3-step CompChangeFlow, wage periods hour..year + actual-work accrual semantics, paid-leave toggle, passive=close-comp-period. Rules deploy (`1474907b`, staffComp=owner+super). *(detail: Completed › S2)*
- ✅ **Archive / snapshot safety (hole 1)** — product sale + block snapshot `barberName` (`0db230c`); deletion is super-admin+owner only, strong confirmation modal, `BARBER_DELETED` audit.
- 🔄 **S4 Staff access & offboarding** — **S4A server foundation ✅ source+tests, PUSHED, NOT LIVE** (`functions/src/staff/`): canonical `staff/{uid}.accessStatus` (`active`/`suspended`/`offboarded`; **absent=active**, unknown **fails closed**, one `ACTOR_OFFBOARDED` code) enforced in-transaction by all 5 Staff-actor mutation cores at **zero extra Firestore reads**; server-only offboard/re-enable cores as a **resumable state machine** (Auth+Firestore+FCM cannot be atomic — ADR-023) with claim clearing, token revocation, per-uid FCM sweep and exactly-once audit at a derived doc id. `barbers.status` still means assignability ONLY (ADR-022) — a passive owner keeps running the salon. **Nothing exposed or deployed: no callable, no UI.** Detail: [STAFF_ACCESS_CONTROL.md](STAFF_ACCESS_CONTROL.md). **S4B remaining:** callable wrappers · Admin Staff/Barbers UI · Staff App revoked state · `staffAccessOps` rules entry · stuck-`PENDING` reconciliation sweep. Still bypassable while O1S Staff direct-writes remain.
- 🔄 **Team lifecycle & ownership — where it actually stands** *(added 2026-08-10; the detail and the five affected paths stay under Security › T-e, this is the index)*. **LIVE:** the identity contract itself (O1 `960db19`) — the staff doc is the authority, the `tenantRole` claim only its projection, `setCustomUserClaims` **replaces** so every write must be merge-aware; `createStaffUser` (`-00058-kur`) and `approveApplication` (`-00013-yob`) deployed 2026-08-08 and live-verified **by source marker, zero writes**. **DEPLOYED BUT DORMANT / NOT LIVE:** S4A's access-authority foundation (`3097521`) has cores and tests but **no callable and no UI**, and `setStaffRoleCore` exists but is deliberately **not exposed**. **REMAINING CUTOVERS:** O2 must repoint `Settings.tsx`'s `updateStaffRole` + `registerMeAsAdmin` at `setStaffRoleCore` (today they write the staff doc, are blocked by `firestore.rules:203` for non-super-admins, and **report success anyway** — false success is the defect, not the block), fix the `super-admin/` caller that grants tenant access with no role, and land S4B (callable wrappers · Admin Staff/Barbers UI · Staff App revoked state · `staffAccessOps` rules entry · stuck-`PENDING` reconciliation sweep). **OWNER PREREQUISITES, not code:** ① the **T-h** `provisionTenant` repo-ownership fork — until it is decided, every new self-signup still mints a role-less, staff-doc-less owner and path 1 cannot be fixed; ② authorization to **repair the two live victims found 2026-08-08 and deliberately left alone** (`the-hair-lab` owner — `{tenantId}` only, no `tenantRole`, no staff doc; `yusufo` owner — role claim, no staff doc). All 7 other staff docs are consistent. Contract: [TEAM_IDENTITY_CONTRACT.md](TEAM_IDENTITY_CONTRACT.md).
- 🔄 **S3 Compensation periods — closed months must stop changing** *(added 2026-08-12; the wage-integrity incident · updated 2026-08-12 after S3A)*. **Cause confirmed · S1 + S2 + S3A landed, all `PUSHED_NOT_LIVE` · S3B/S3C not built.** `barbers/{id}.workingDays` is a single **undated** array with no history, so Finance replays *today's* rota over every past month — a closed period is not closed, and one rota edit silently moves every historical Total Wages / Net P&L / partner + staff Wages Earned / G4 ledger. `shiftChanges[date]` stays a correct **single-date** override and is not the cause; **the owner's seven date-specific Off records are correct**. `staffComp.effectiveFrom`/`effectiveTo` already exists (`compUtils.ts`, Phase B, LIVE) and **Finance reads none of it** — that is the gap S3 closes. **✅ S2 done (`10e754a`, pushed, NOT deployed):** all six wage-accrual consumers now decide a day in ONE resolver (`src/utils/financeWages.ts`) with exact parity (261 golden-parity assertions, no total moved, no write, no deploy) + a static test that fails if manual wage logic returns. **Explicitly rejected:** a fake leave-until-2099 record and a `partnerConfig.wageEndDate` field — both are duplicate SSOTs for "when employment ended". **`FIN-COMP-S3A` ✅ landed (`f1239ba`, 2026-08-12, `PUSHED_NOT_LIVE`):** the canonical resolver *can* gate accrual on `staffComp.effectiveFrom`/`effectiveTo` — both boundaries **inclusive**, multiple periods and gaps supported, missing/malformed period data **fails open to legacy**. The activation constant `FINANCE_COMP_PERIOD_MODE` ships as **`'legacy'`**, **no Finance consumer is wired**, **no tenant is enabled**, and **period closing / month immutability was explicitly NOT implemented** — `effectiveFrom`/`effectiveTo` does *not* make a closed month immutable, and nobody may describe it as doing so. Gates as reported: frontend **3034/3034** · S2 golden parity **261/261** (parity file byte-untouched) · new period tests **108** · read-only analyser tests **37**; no deploy, no production write, no Arda/staff data change. Whitecross read-only dry run: 3 accruing staff · 3 `staffComp` records · 2 valid · **1 inactive staff member with an open compensation period** · nothing malformed/overlapping/gapped/ambiguous · `readiness = false` · exactly one owner-supplied last-employed date required. **Remaining:** `FIN-COMP-S3B` (wire all six consumers + a legacy-vs-period parity mode, activation still OFF) → **`FIN-EFFECTIVEFROM-BACKDATE`** (owner-approved, audited: all three whitecross `effectiveFrom` values say `2026-07-15`, the day the Pay tab was first opened, so activating today zeroes February→14 July by **−£17,531.20** — §9.3 ⑥) → `FIN-COMP-S3C` (controlled flag activation, targeted Hosting release, authenticated Finance verification against the 5-assertion proof in §9.3; **Arda's `effectiveTo = 2026-08-04` is already stored, so no write is needed to set the boundary**) → `FIN-PERIOD-CLOSE` (the separate closed-period / snapshot / attributable-adjustment design). **Blocked on `FIN-COMP-S3C` being LIVE_VERIFIED:** the Arda `workingDays` repair — see the owner-confirmed boundary in **§9.3** (last wage-entitled day **2026-08-04**, `effectiveTo` inclusive, £0 accrual from 2026-08-05, wages through 2026-08-04 already entered: do not re-pay, do not alter historical entries, do not change `workingDays` yet). Booking-derived workdays are corroborating evidence only, never the permanent SSOT. Detail: [INCIDENTS 2026-08-12](INCIDENTS.md) · [STAFF_SETTINGS_AUDIT.md](STAFF_SETTINGS_AUDIT.md) · [STAFF_MANAGEMENT_DESIGN.md](STAFF_MANAGEMENT_DESIGN.md) §1.1.
- 🔵 **Payroll / accrual engine (Phase C)** — wage worked-time accrual (hour..year day/hour rate) + paid-leave days at normal rate + commission booking-based + chair-rent calendar accrual.
- 🔵 **Settlement + Finance/Reports integration (Phase C)** — M1 migration (partnerConfig→staffComp, dry-run CSV) · Finance reads from staffComp + remove implicit £100 fallback (with parity proof) · Balance line "Tracked in Finance".
- 🔵 **S1 hole 2** — the Reports "Barbers" tab builds the list only from LIVE barbers (`Reports.tsx:182`) → a deleted/passive barber's historical statistic row disappears. Fix: include historical booking names as "Archive/former staff". *(code-confirmed open 2026-07-16)*
- 🔵 **S3 Finance/Occupancy bugs** — (a) a passive barber still accrues a daily wage in Finance (`Finance.tsx:265` has leave, NO passive filter); (b) a barber on leave is counted in the occupancy capacity denominator (`OccupancyPanel.tsx:54` `barberWorksOn` without a leave-check). Both cleanly resolved by the Phase C comp engine. *(code-confirmed open 2026-07-16)* ⚠️ **Do not read STAFF-FINANCE-GHOST-WAGE-P0 as closing (a)** *(noted 2026-08-10)*: `5746237` (LIVE 2026-08-08) removed the invented **£100/day fallback for a barber missing from `partnerConfig`** — a different ghost. The **passive-barber** accrual is a separate filter and has not been re-verified since 2026-07-16; check the code before quoting either state.
- 🔵 **§7 safety fixes (separate mini-run)** — occupancy resolver, legacy active-readers→barberStatusOf, Reports archive. **Keep Scope Narrow.**
- 🔵 **G5 step 6 remainder** — staff-app migration (coordination with the other device); per-barber Staff Hub UI ✅ (above). §8 has 4 open owner questions (must be answered before code).

---

## 🔒 Security, Scale & Pre-Scale Gate

> **Mindset:** "whitecross pilot, whatever works" → at 1000 customers these decisions hit **everyone**. Read the roadmap as a gate. Detail: memory `project-salown-prescale-hardening`, [SECURITY.md](SECURITY.md), [ARCHITECTURE_REVIEW_2026-07-02.md](ARCHITECTURE_REVIEW_2026-07-02.md).

**Tier 1 gate — ✅ CLOSED** (verified 2026-07-02): Gate-G1 role-claim backfill (`0f8de7e`) · Gate-G2 bookings read tenant-scoped (`851efeb`) · Gate-G3 public-create financial forge guard (`851efeb`) · Gate-G4 staff-doc catch-all→false (`0f8de7e`). Test 49/49. + Follow-up: T-a1 delete=super-admin (`7e95d40`) · T-a2 admin role-based (`643c8ce`) · T-d self-escalate closed (`643c8ce`). *(detail: Completed › Security)*
- 🔄 **Gate-G5 blast radius** — single global ruleset; discipline exists (pull from API, latest deploy, rollback ready), no structural solution. **Ongoing.**

**Delete policy — ✅ LIVE (E1b):** delete = `isSuperAdmin() || isOwner(tenantId)`, 10 collections (including barbers, with a strong confirmation modal); owner only within their own tenant; staff/finance/settings/merge super-only (`8670051`+`2af303c`, test 83/83). *(detail: Completed › Security)*

**🔑 P0 — Shared secret namespacing (from INCIDENTS 2026-07-21):** *Corporate principle: secrets belong to the **application boundary**, not the tenant boundary; no secret name should be SHARED by two different applications.* This is not a "Stripe bug" but a shared-infrastructure naming problem.
- 🔄 **Split `STRIPE_SECRET_KEY`** → `WC_STRIPE_SECRET_KEY` + `SALOWN_STRIPE_SECRET_KEY`. **Whitecross side ✅ DONE (2026-07-21):** `WC_STRIPE_SECRET_KEY` + `WC_STRIPE_TEST_SECRET_KEY` created (byte-identical to originals); 4 payment fns (`createCheckoutSession`/`stripeWebhook`/`checkBookingPayment`/`createMobileCheckout`) migrated + deployed via the guarded `scripts/deploy-functions.sh`; live smoke passed (`cs_live` + `CONFIRMED` + `DEPOSIT_PAID`, booking `WCB-1784645026181-qq8o`); `STRICT_NAMESPACE` default=1 so shared `STRIPE_SECRET_KEY` in code now hard-fails. **Remaining:** (a) salOWN Connect → `SALOWN_STRIPE_SECRET_KEY` (salown-app session); (b) THEN retire old shared `STRIPE_SECRET_KEY` — **blocked until salOWN migrates** (salownConnect still binds it); (c) follow-up: webhook signing secrets (`STRIPE_WEBHOOK_SECRET`) + `/v1/account` API account-identity guard. **Why P0:** the shared `STRIPE_SECRET_KEY` let the salOWN Connect sandbox setup overwrite whitecross's **live** payment (2 real customers lost); whitecross is now isolated, salOWN still shares the name.
- 🔵 **Namespace all shared secrets before tenant #4** — the same principle for all shared credentials: `BREVO_API_KEY`→`SALOWN_BREVO_API_KEY`, Telegram/OpenAI/Google OAuth etc. app-prefix. Small but permanent; removes a big risk at scale. *(Note: salOWN TENANTS already hold no secret — only `acct_`, the Connect model; this item is within the application-boundary, not the tenant-boundary.)*

**Tier 2 — blows up at scale, does not block onboarding:**
- 🔵 **read:true surface → root doc lock** — the real PII (`clients`/`products`) is already auth-only; the remaining legitimately-public (`services`/`barbers`/`gallery`/…) + `tenants/{id}` root doc is world-readable. **The one task:** `BookingPage.tsx:386` should read from the `public/booking` projection instead of the raw root (Phase 1 projection trigger + backfill ✅ `2db8721`; Phase 2 read+fallback; Phase 3 rules `read:true`→`isTenantAny` LAST). *(code-confirmed: BookingPage still reads the raw root 2026-07-16)*
- 🔵 **B3 `salownCreateBooking` transactional** — see Booking theme (double-booking race).
- 🔵 **A1 plan enforcement remainder** — see Payments theme (stylist cap + hard-gate).

**Tier 3 — tenant-local, safe (contained):** Finance/partnerConfig · Muhamed wage · workingDays. *(review: "not the biggest risk, contained"; not 🔴.)*

**Follow-up work (remaining from Tier 1):**
- 🔄 **T-e `tenantRole` is written by the migration but not by the writers** — **O1 CLOSED THE CONTRACT + 2 of the 5 paths, LIVE 2026-08-08.** The canonical writer is now `functions/src/staff/identity.ts` (**the ONLY sanctioned tenant-claim write site**, alongside S4A's revoke/restore pair): merge-aware `planTenantClaims`/`applyTenantClaims`, idempotent `ensureOwnerIdentityCore` (creates/repairs `staff/{uid}`, which neither provisioning path ever wrote), the `reconcileStaffClaimsCore` repair primitive, and `setStaffRoleCore` (authorized role change, **not exposed** — O2 wires the callable + UI). 8 invariants, one named test each; 32 unit + 31 emulator. Detail: [TEAM_IDENTITY_CONTRACT.md](TEAM_IDENTITY_CONTRACT.md). **Deployed (europe-west2, codebase `salown` only):** `createStaffUser` `-00058-kur` (rollback `-00057-doq`) · `approveApplication` `-00013-yob` (rollback `-00012-kix`). Live-verified by source marker, zero writes.
  **STILL OPEN — paths 1, 3, 4, 5** (numbered below; the audit text is kept verbatim because it is still the map): **path 1 is BLOCKED on repo ownership, not on code** (see T-h) · paths 3+4 are the client-side `Settings.tsx` writers, which `firestore.rules:203` already blocks for non-super-admins, so they fail *and* report success — O2 repoints them at `setStaffRoleCore` · path 5 is a `super-admin/` caller fix. **Two live victims found 2026-08-08 and deliberately NOT repaired** (repair is separately authorized work): `the-hair-lab` owner `epF8CRYW…` = `{tenantId}` only, no `tenantRole`, **no staff doc**; `yusufo` owner `vHnYi5Cp…` has the role claim but no staff doc. All 7 other staff docs are consistent. — *Original audit follows.* Gate-G1 removed the `tenantRole == null → admin` fallback and `scripts/backfillTenantRoles.cjs` repaired the accounts that existed then, but the code that **mints and mutates** the role was never corrected, so every newly provisioned account recreates the defect. Full read-only audit 2026-08-01/02 — **five affected paths, not two**, and the role now has two disagreeing authorities: the **claim** (19 gates in `firestore.rules` via `isAdmin()`/`isOwner()`/`isStaff()`, 10 frontend files) and the **staff doc** (`functions/src/index.ts:1266`, `bookings/blocks.ts`, `treatmentSessions/sessions.ts`, `packages/executor.ts`). **No trigger syncs them.**
  1. **`provisionTenant` (self-signup, europe-west2) — the live artifact is `whitecross-site/functions/index.js:3371`, NOT `salown-app/functions/src/index.ts:239`.** Both repos deploy to `havuz-44f70` and both export this name; the deployed function carries `firebase-functions-codebase: whitecross` (updated 2026-07-21). `Signup.tsx:234` calls it on `europe-west2` (`src/firebase.ts:26`). ⚠️ **Fixing only the salown-app copy changes nothing in production** — and deploying it collides with the whitecross codebase. Decide which repo owns the name first.
  2. ✅ **`createStaffUser`** — **the europe-west2 / codebase `salown` artifact is FIXED AND LIVE** (`-00058-kur`): merge-aware claim carrying the role, tenant taken from the **verified claim** instead of `request.data`, and an admin may no longer mint an owner. The us-central1 / codebase `whitecross` copy (`whitecross-site/functions/index.js:2357`, called by the legacy `barber-panel/src/pages/Settings.js:349`) is a **separate function in a separate region and repo** and is still `{ tenantId }` only — fix it with the legacy panel, or retire both together.
  3. **`updateStaffRole` (`salown-app/src/pages/Settings.tsx:610`)** — a role change writes the staff doc only; the claim is untouched, so promoting staff→admin/owner has **no effect at the rules layer**.
  4. **`registerMeAsAdmin` (`Settings.tsx:664`)** — writes `role:'owner'` to the staff doc and reports "✓ Saved as Owner. Refresh to apply."; refreshing changes nothing, because the claim was never written. **False success.**
  5. **`setTenantClaim` merges correctly (`whitecross-site/functions/index.js:3425`, super-admin only) — but its only caller never sends a role:** `super-admin/src/pages/Tenants.jsx:294` posts `{ uid, tenantId, superAdmin:false }`, granting tenant access with no role, then reports "✅ Claim set!". **False success**, and it is the tool the other four paths are repaired with.
  **Correct writers, for reference:** `staff/identity.ts` (O1, the canonical one) · `approveApplication` (now routed through it, LIVE `-00013-yob`) · `scripts/seedDemoTenant.cjs:387` · `scripts/backfillTenantRoles.cjs`.
  **Beyond rules:** `salownConnectStart`/`salownConnectDisconnect` (`index.ts:3324`, `:3407`) refuse a role-less owner, so Stripe Connect cannot be set up. `ai/askAI.ts:19` documents the drift and deliberately tolerates it.
  **Live drift measured 2026-08-02 (read-only, 15 Auth accounts):** 10 healthy · **3 with `tenantId` and no `tenantRole`** — `cpsuk@yandex.com`/`ee-kurt-barbers`, `cspuk@yandex.com`/`the-test-lab`, and `araserulas@gmail.com`/**`the-hair-lab`, which is `status: trial`, not the dead tenant the G1 rules comment assumed** · 1 super-admin · 2 claimless orphans (see T-g). The drift set has not grown since June only because no self-signup has completed since; the writers are unchanged.
  **Scope: standalone Tier-1 onboarding fix — do NOT fold it into the loyalty fix or the TR Checkout work.**
- 🟡 **T-h `provisionTenant` repo ownership — RESOLVED IN PRACTICE 2026-08-11, cause still open** *(opened 2026-08-08 by TEAM-LIFECYCLE-O1)*. Both `salown-app/functions/src/index.ts` and `whitecross-site/functions/index.js:3358` export `provisionTenant` to **europe-west2 on `havuz-44f70`**; until 2026-08-11 the live artifact was **whitecross's** (`provisiontenant-00136-taj`), which is why self-signup minted role-less, staff-doc-less owners. During the intake repair (INCIDENTS 2026-08-11) it was redeployed from codebase `salown` → **`provisiontenant-00137-bij`**, artifact verified as the `lib/` TS build carrying `ensureOwnerIdentityCore`, so self-signup now produces a proper `tenantRole:'owner'`. ⚠️ *Updated 2026-08-12: the whitecross export was **deleted** at `a336ddce` (record: salown-docs `cb710db`), so the "next whitecross deploy takes the name back" mechanism is gone from source. Confirmed live: `provisionTenant` = `provisiontenant-00137-bij` and `addToWaitlist` = `addtowaitlist-00038-fof`, both labelled `firebase-functions-codebase: salown`, and the first apply→approve owner account since 2026-07-13 (`dayi-barbers`) was provisioned end to end on 2026-08-12.* **What is still open** is the general defence, tracked as `SEC-FN-NS` under **SHARED-FN-NAMESPACE** (Tech Debt): no equivalent guard exists on the salown side, and **five** other functions in europe-west2 still carry codebase `whitecross` (`salownNotifyNewBooking`, `salownSendTestTelegram`, `salownSyncTreatwellIcal`, `sendProInterest`, `setTenantClaim`). ⚠️ Newly live as a side effect: the salown welcome email sends from `hello@salown.com`, a mailbox that does not exist (`index.ts:321,324`) — a self-signup today gets a tenant and no welcome mail.
- 🔵 **T-f manual claim scripts replace instead of merge** — `salown-panel/setClaims.js`, `set-admin-claim.js` (repo root, untracked) and `whitecross-site/barber-panel/setClaims.js` all call `setCustomUserClaims` with a literal object. `set-admin-claim.js` writes `{ superAdmin: true }` to `aerulas@`'s uid — running it today would **strip `tenantId` + `tenantRole` from the platform's only super-admin**. The first two also load a `serviceAccountKey.json` (both copies are the same `firebase-adminsdk-fbsvc@` key, `private_key_id 040c0a61…`); both are gitignored and neither is committed, but the key exists twice on disk. Delete the dead scripts, or route them through `setTenantClaim`.
- 🔵 **T-g signup creates the Auth user before the tenant, with no rollback** — `Signup.tsx:233` calls `createUserWithEmailAndPassword` and only then `provisionTenant`; if provisioning throws, the account survives with `{}` claims and no tenant. Two such orphans exist (`a.riz.u.lik.i75@gmail.com` 2026-06-25, `cole.ttib.ela@gmail.com` 2026-07-02 — neither owns any of the 6 tenant docs, neither has signed in since the day it was created). Fold the cleanup into T-c rather than deleting separately.
- 🔵 **T-b app-password → Secret Manager** — `tenants/{id}/settings/emailConfig.appPassword` is still plaintext, client-readable (`index.ts:315` IMAP reads from there). ⚠️ **depends on H4** — once the parse-inbox model settles, the app-password is removed entirely → T-b **evaporates**; must wait for the H4 decision. *(code-confirmed: still plaintext 2026-07-16)*
- 🔵 **T-c auth user cleanup** — KEEP `durvezek@`/`aerulas@`/`auzun9499@`; dump the rest→CSV confirm→delete. NO blind deletion.
- 🔵 **E1 Phase 2 scale** — let the owner manage their own staff/barbers (staff-assignment still super-only) · cross-tenant permission management from the super-admin panel · final: remove delete buttons entirely · Staff App delete parity. ⚠️ review: the delete-bottleneck is a chokepoint not at 1000 but at **~the 3rd salon**.
- 🔵 **I3 reporting pre-aggregation** — `Reports.tsx` does client-side aggregation → crashes in the browser at ~100 salons (won't last to 1000). Direction: `tenants/{id}/stats/{period}` pre-agg doc (trigger/job). *(code-confirmed open 2026-07-16)*
- 🔵 **I4 audit trail Phase B/C** — Phase A ✅ (staff/client, `2ab0328`). Phase B: catalog/price + settings + discount codes (code-confirmed: Services/Products/Settings/DiscountCodes don't call `logAudit`). Phase C: staff-user fns, super-admin, TTL, viewer filters, append-only rules. Design: [AUDIT_TRAIL_PLAN.md](AUDIT_TRAIL_PLAN.md).
- 🔵 Single Firebase project quota/blast radius (scale).

---

## 💳 Payments (Stripe Connect)

> **⚠️⚠️ ENTIRELY IN TEST MODE — NO REAL MONEY.** All modes were tested with the Stripe **sandbox** ("Turquoise Swing"); `features.stripe`/`websiteDepositsEnabled` were NOT turned on in live mode. Direction: Standard + Direct charge, fixed £ deposit, per-tenant policy. Plan: [STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md).

- ✅ **A2 Connect — verified end-to-end in TEST mode (2026-07-04):** Phase 0 onboarding (`salownConnect*`, tenant secret NEVER stored) · Phase 1 Checkout (`salownCreateCheckoutSession` + parallel `salownConnectWebhook`, `863e3db`) · UI Settings→Integrations "Online payments" card (`8747fea`) · Phase 2 policy (paymentMode + defaultDepositAmount) · Phase 3 refund + configurable windows (`e3221cd`). Owner tested all modes (deposit/full/optional/pay-at-venue/off). *(detail: Completed › Payments)*
- ⏸ **Go LIVE (real money)** — the code side is READY (2026-07-17, `138e8d7`): mode-mismatch guard (`salownCreateCheckoutSession` under a live key turns a test `acct_` into a clear "reconnect" error; `salownConnectStatus` `modeMismatch` flag) + Settings reconnect banner + step-by-step **Go-Live Runbook** ([STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md)). The code is key-agnostic → test→live = secret-swap + targeted functions deploy (single block). **The only blocker = the owner's live keys** (`sk_live_`/live `ca_`/live `whsec_`). First live attempt is whitecross's online profile; then commission activation (`application_fee` wired at 0%) + a refund test on success. **Waiting (live keys).**
- 🔵 **Premium deposit rules (Booksy model) — design FINAL, build pending** *(owner 2026-07-16)* — rule-based: N deposit rules (`%/£` + amount + `mode:deposit/full`) → assigned to desired services (`depositRules` collection, world-readable; service→rule resolution at booking time; unassigned=no deposit). **Channel split:** premium custom site (whitecross-site) vs salown-hosted online-profile have **independent** master switches; depositRules is shared. Group=per-person. Server=amount authority (don't trust the client, a security fix). Bridge ✅ (`public/booking` `2db8721`). **Build phases:** F1 depositRules + Settings "Deposits" UI (Booksy-like, NO LIVE RISK) → F2 whitecross-site wiring (⚠️ **live-revenue path, owner test-booking required**) → F3 extend to salown-hosted. Open: premium gating (Pro+?). Spec: [STRIPE_CONNECT_PLAN.md](STRIPE_CONNECT_PLAN.md) §G.
- 🔵 **A1 stylist cap (plan enforcement Phase 4)** — plan enforcement largely ✅ (planLimits config `0a31141` + super-admin editor `e2cd4b4` + FeatureLock `8189df4` + usage nudge `2723220`, all SOFT+pilot exempt). ⚠️ **Status corrected 2026-08-10.** This line said the `stylistLimitReached` helper "EXISTS in `Barbers.tsx` but isn't called". It **is** called — `Barbers.tsx:586` computes `stylistCapReached` and `:650` renders the soft plan-cap nudge — so the *soft* half is wired and live. What remains is the **hard gate**, and it is a decision, not a missing call: the nudge's own comment says "you can still add more", and the "Add team member" button is deliberately left fully functional. Soft→hard flips **only once money-taking starts** (Monetization M4), so A1 is blocked on the same owner decision as Go-LIVE, not on code.
- 🔵 **A3 product inventory / stock** — basics ✅ (`soldProducts` SSOT, `84635ed`+`b5cebac`). **A3-1 domain foundation landed (2026-07-29, `34ddb12`, NOT WIRED / NOT DEPLOYABLE):** `functions/src/inventory/inventory.ts` — pure decision helper `computeStockDeltas(items, currentStocks, sign, options)` + `normalizeSoldProductsForStock` + `stockRequirement`; stable reason codes (INVALID_INPUT · INVALID_SIGN · PRODUCT_ID_REQUIRED · INVALID_PRODUCT_QUANTITY · PRODUCT_NOT_FOUND · INSUFFICIENT_STOCK · INVENTORY_CORRUPT; per-item INVENTORY_NOT_TRACKED advisory only); bounded qty (MAX_PRODUCT_QTY=999 per-line AND per-coalesced), bounded distinct count (MAX_DISTINCT_PRODUCTS=50), bounded productId regex, strict numeric coercion (0/neg/decimal/NaN/Infinity/string rejected), explicit `stockQty:0` vs missing separated (own-property probe), deterministic fail order (corrupt>not_found>insufficient), `allowOversell` owner-policy hook, 57/57 hermetic tests. **Owns correctness of the delta plan; owns NEITHER transaction, callable, cutover, rules, UI nor idempotency.** *(Tenant isolation left for the future callable path + auth boundary + rules over `tenants/{tid}/products/{docId}`.)* **A3-2 remainder (exact transaction contract):** ONE Firestore transaction that opens per sale, reads the required product docs (`stockRequirement`), calls `computeStockDeltas`, validates against per-sale idempotency marker (stable key stored on the booking doc — e.g. `stockAppliedAt`/`stockAppliedFingerprint`; a re-check of the marker at the START of the tx skips a replay), writes the sale doc AND the stock updates atomically, and exposes stable reasons via HttpsError. Then: `checkoutBooking`/`createProductSale` cutover through this callable; `Products.tsx` `stockQty` input + low-stock badge; firestore.rules stockQty write guard (only-callable) — none of this is done. Existing boolean `inStock` is a UI-visibility flag and STAYS orthogonal at the domain layer (the callable will read both signals at the seam). Undo/rollback on booking edit / refund / cancel = A3-2 as well (out of A3-1 by design).
- 🧹 **Orphan cleanup** — 27 legacy functions in `havuz-44f70`/us-central1 (from the migration, not in code). A blanket `deploy --only functions` proposes to delete them → deliberate separate task; verify the old endpoints aren't being called.
- 🔵 **Whitecross Stripe checkout branding** (owner requested) — Level 1 Dashboard branding (owner, no code) · Level 2 small code (whitecross-site `createCheckoutSession`: `product_data.images`+`custom_text`+`locale:'en-GB'`) · Level 3 embedded Elements → deferred to Phase 5.

---

## 💰 Monetization & Self-Serve Upgrade

> **Vision:** today the tier is flagged **only by super-admin**; a tenant should be able to
> upgrade its own plan from **Settings** ("in-account upgrade like Anthropic"). The tier engine (limit/feature resolution) is ready
> and correct (`planLimits.ts` single source, SOFT enforcement); what's missing = **(a)** the in-account request surface,
> **(b)** the approve queue, **(c)** later a real billing pipeline. ⚠️ salOWN **cannot** take money from a tenant
> (Stripe is only Connect/deposit + TEST mode; there is **NO subscription pipeline**). Full design: [TIERS_AND_UPGRADE.md](TIERS_AND_UPGRADE.md).

- 🔵 **M1 in-account upgrade (Phase 1 — request→approve, no charging)** — a **"Plan" tab** in Settings
  (4 tier cards + comparison + the current usage bar moved in) + `requestPlanChange`/`decidePlanChange`
  callables + a **super-admin "Upgrade requests" queue** (`collectionGroup('planRequests')`). Flow:
  tenant "Upgrade" → `tenants/{id}/planRequests` doc → super-admin approves → flag flip + tenant email.
  UX *feels* self-serve, backend is a queue. NO live-revenue risk, enforcement stays SOFT. A separate focus-day task.
- 🔵 **M2 Pro+ = premium website + SEO package** — the top tier stays "Let's talk"; add
  **`premiumWebsite: boolean`** to `PlanFeatureFlags` (proplus=true), representing the whitecross package: hosted premium
  site + custom domain + SEO (schema/meta/perf) + white-label email + priority support. Premium site
  delivery is operations, not code → same family as [Premium Themes F1](ROADMAP.md#-premium-themes-gelir-kalemi).
- 💡 **M3 real self-serve Stripe *Billing* (Phase 2 — VISION)** — ⚠️ a **SEPARATE** pipe from Connect
  (Connect=customer deposit; Billing=**salOWN charging the tenant via subscription**). Components:
  Stripe Products/Prices (Starter/Pro Price ID) · `createBillingCheckout` (subscription Checkout) ·
  `billingWebhook` (lifecycle→`plan/status`, the new authority for plan) · `createBillingPortalSession`
  (Stripe Customer Portal = "Manage billing"). Billing fields go in the `settings/billing` subdoc (root=public,
  keep no secrets). Precondition: owner "we're taking money" decision + salOWN platform-merchant Stripe + live keys.
- 💡 **M4 maturation (Phase 3)** — proration (Stripe default) · invoice/receipt email · dunning
  (`payment_failed`→retry→`past_due`→grace→downgrade) · enforcement **soft→hard** (A1 stylist cap trigger,
  once money-taking starts). NOT today.
- 💡 **M5 public pricing page (Future)** — the landing shows no price today (vetted "Request a demo",
  deliberate). Once self-serve billing (M3) is live + tiers are stable, `/pricing` opens (the dead `.pricing-grid`
  CSS already exists `index.html:156`); self-signup is preserved (memory `keep-self-onboarding-active`). *(H3 "Billing page placeholder" moved under this theme.)*

---

## 📊 Evidence & Metrics

> **Goal:** every important production claim should be backed by data — not "I think it works" but "here is N months of production data". **Operational infrastructure, not marketing** (NO heavy stack). ⏱ Nothing ACCUMULATES until the Platform+Reliability layers start being collected — a day unmeasured today is a lost day; that's why EV1/EV2 are small but early.

- 🔵 **EV1 parser telemetry** ⏱ — the parse result of every inbound email should be written persistently to Firestore (success/failure+reason, dedup, latency receivedAt→parsedAt). Currently failures are only in Cloud Logging (~30 days) → history doesn't accumulate. Note: `recordParserRun` writes a daily AGGREGATE (I1 canary), EV1 per-email is DIFFERENT. Small task, doesn't wait for I2. *(code-confirmed: no per-email telemetry 2026-07-16)*
- 🔵 **EV2 health-check + uptime** ⏱ — a scheduled fn probes the critical surfaces (booking-create path, parser inbox, hosting 200), writes to a daily doc → a monthly availability % forms by itself. The numeric sibling of INCIDENTS.md. *(code-confirmed: no health-check job 2026-07-16)*
- 🔵 **EV3 auto-generated METRICS.md** — a script produces a snapshot of business metrics from Firestore (booking volume, repeat rate, loyalty redemption, source distribution, active tenants, avg spend) + the EV1/EV2 accumulation; hand-entered numbers rot. **Order: after I2 Phase 2 + Tier 2.**
- 🔵 **C7 automation outcome metrics** — each automation card ("Birthday Treat", "Loyalty Boost", later C3) should show its own outcome ON THE CARD: **Sent / Opened / Booked (+£)**. *(code-confirmed: cards show at most "Sent" `Marketing.tsx:958`, no Opened/Booked.)* Principle: a new automation isn't "done" without a Sent/Opened metric. Gate: same Phase-2 wave as the scheduling cron (C3) + open-tracking.

---

## 🎫 Onboarding, Super-Admin & Parser Pipeline

- ✅ **H1 early-access intake** (`a2689f9`) + **H2 invite-based onboarding** (demo funnel + Applications approve→provision, `ae495a1`/`57e3959`). Self-signup preserved (buttons hidden, `/signup`+`provisionTenant` works — memory `keep-self-onboarding-active`). *(detail: Completed › Onboarding)*
- ✅ **H3a analytics accuracy** (`fb92c8b`/`2e04a66`) · **H3b owner login visibility** (`adminGetOwnerActivity`, `f4aee2b`) · **H3c parse-inbox address management UI** (`a31538f`).
- 🔵 **H5 super-admin has no way to open an owner account** *(2026-08-12)* — the only working path is *wait for a demo request → Applications → Approve*. "Add Tenant" writes `tenants/{id}` client-side and nothing else (no Auth user, no claim, no `staff`/`barbers` doc, no email — `Tenants.jsx:169`), and the **`Set Tenant Claim`** box calls `setTenantClaim` **without `tenantRole`** (`Tenants.jsx:294`), which since G1 (2026-06-27) removed the `tenantRole == null → admin` fallback produces an account that signs in and is denied everywhere. Three live fossils carry exactly that shape: `cpsuk@yandex.com` (`ee-kurt-barbers`), `araserulas@gmail.com` (`the-hair-lab`), `cspuk@yandex.com` (`the-test-lab`). **Shape of the fix:** one "Create Owner Account" form (email + salon + contact + phone) that writes the `entries` doc and calls the existing, correct `approveApplication` — not a second provisioning path — and either give the claim box a role selector or remove it. Also worth surfacing: `eekurtbookings@gmail.com` holds an owner claim on `kwolf-barbers` but never set a password (dangling invite).
- 🔄 **H4 parser email intake — parse-inbox hybrid + token isolation** · **PILOT FULLY LIVE** (2026-07-13/14): forwarding set up, full lifecycle drill PASSED (create/reschedule/chain/cancel × two pipes, zero duplicate records), first organic customer mail + Fresha pipe proven live. Isolation: token→tenant lookup, fail-closed (cross-tenant misroute structurally impossible). *(detail: Completed › Onboarding)*
  - 🔵 **Remaining:** herohairs parse-inbox migration (token rotate ✅ `herohairs_2e1355…`, forwarding to be set up with the new address) · Treatwell pipe first-mail observation · whitecross IMAP retirement (owner keen — 5min cron overhead; remove the app-password, DON'T TOUCH the feature flags → **T-b evaporates**).
  - 🧹 **Chore:** the drill's UNSEEN test emails cause the IMAP cron to re-log the same "not found" triple every 5min (harmless but noise) → owner should mark them read OR add a terminal not-found mark-seen to the parser (without breaking out-of-order retry).
- 🔵 **H3 remainder** — cross-tenant user/permission management (=E1) · tenant metric deepening. *(Billing page → moved to the **Monetization & Self-Serve Upgrade** theme: M1/M5.)*

---

## 📅 Booking Experience

- ✅ **B1 cancel/reschedule self-service UI** (`3d63c39`) — `/manage/{tenantId}/{bookingId}`, cancel+MiniCal reschedule, all tenant emails carry a "Manage Booking" button; owner tested end-to-end.
- ✅ **B6 BookingDetailPanel size + compact** (`36d58a4`, LIVE 2026-07-18) — the panel opened via "View full details" from the notification bell was in a hand-written fixed `380px` wrapper (narrow + no `overflowY` → the bottom was clipped); equalized to Dashboard/Bookings' `Drawer width="540px"` size (`PanelLayout.tsx`, maxWidth 96vw + overflowY:auto + border/shadow). Also the detail-view vertical spacing was measuredly tightened (section/field/client-row; only spacing, font/color unchanged) → a typical booking fits without scroll. Because it's a single component, it reflects across all panel usages.
- ⚠️ **Panel in-app notification (reschedule/cancel) — CODE EXISTS, FIELD-CONFLICTING, needs live test.** The in-app `writeNotification('cancelled'/'rescheduled')` calls have **existed in the code since 2026-06-05** (`54ee368`, `index.ts:2056/2095`, gated by `ns.customerCancel/Reschedule`) + click→open-booking wired (`NotificationBell.tsx:116`). BUT the owner did NOT get a notification in the panel during the 07-13 H4 drill → git doesn't resolve it. **To do:** live-test whether the bell appears in the panel on a real reschedule/cancel — if it appears ✅ closes, if not it's a trigger/firing bug. + 🔵 per-person notification preference (fcmToken filter; token docs carry `uid`/`barberName`/`role`).
- ✅ **ANY-BARBER server-side "no preference" assignment** (`f980978`, LIVE 2026-07-30) — the browser no longer names the staffer. It sends the reserved sentinel `AUTO_ASSIGN_BARBER_ID` (`'__any__'`) and `salownCreateBooking` resolves the assignment **inside the create transaction** (qualified + not passive → per-candidate shift/policy → drop clashes → least-busy, ties by tenant `order`), so it is race-safe rather than advisory. Fixes a live 🟠 bug where "No preference" was rejected while a barber sat free. Deploy order is load-bearing (function first, hosting second) and was verified read-only against the deployed revision `salowncreatebooking-00002-wus`. INCIDENTS 2026-07-30.
- ✅ **P1-RECEIPT-MATH canonical receipt snapshot — writer AND reader LIVE 2026-07-30.** Writer `aeed3cf`+`5dcd5a4`; reader + the remaining UK financial work `e02ddc5`·`e70ed5f`·`af2fb8c`·`61ee2c1`·`7290ccb` (origin/main `c5ae035`), 5 functions + both hosting targets deployed and verified byte-identical. Closed with it: the loyalty email reads the snapshot instead of re-deriving (add-on no longer printed twice); one shared fold contract `resolveServiceBaseAmount` replaces three hand-copied variants; `price: 0` is a KNOWN zero so a product-only sale stops earning double points; the Staff sheet no longer destroys the booking's `soldProducts`/`soldAddOns`; the admin walk-in writes the BASE price; unpaid/blocked bookings cannot receive a paid receipt; re-checkout is idempotent on receipt content; the review CTA is off the two pre-visit emails. Gates: vitest 550 · functions 610 · emulator 53/53. **Deliberate residue, no backfill:** a booking already CHECKED_OUT before this release with a folded price still over-counts its add-on in Sales/Finance/Reports — post-checkout the document cannot tell "folded at booking" from "added at the desk", and guessing would shrink real revenue (pinned by a named test). See INCIDENTS 2026-07-30 (three entries).
- 🔵 **B2 booking settings (dynamic) — Booksy-level Booking Rules** — cancel/reschedule windows (8h/2h) ✅ LIVE in Settings "Booking policy" (`Settings.tsx:1016`, `dcdf6e0`). **Vision (owner 2026-07-23):** move the hardcoded booking rules into a tenant-scoped **Settings → Booking Settings** block (extend the existing tenant `settings/settings` model — do NOT open a new collection; missing value ⇒ back-compat default). Server-side validation MUST read the same tenant value, never just the UI. Candidate settings: **`shiftOverrunAllowanceMins`** (default 15 — the FIRST to dynamicize: constant `STAFF_SHIFT_OVERRUN_ALLOWANCE_MINS` is already the single default and `generateStaffSlots` already takes an `overrunAllowanceMins` override, so the tenant value plugs straight in) · slot interval (5/10/15/30, currently 15) · min advance notice · max advance booking (e.g. 60 days) · same-day on/off · service-fit policy (strict / allowance) · late-booking permission · online reschedule cutoff · deposit/full-payment rules (service/price based). **Fixed system rule, NOT a setting:** staff-shift precedence (INV-BK-6) stays hardcoded. Prior remaining also here: off-day reschedule behavior (block/auto-shift/allow) · barber change on customer reschedule (`newBarberId` exists, UI closed).
- ✅ **B3 `salownCreateBooking` transactional — CLOSED, LIVE** *(status corrected 2026-08-10; the line here still said "still a direct client-side `addDoc`, code-confirmed open 2026-07-16", which stopped being true on 2026-07-25).* The hosted booking page creates through the authoritative callable: `HOSTED_BOOKING_CREATE_MODE = 'callable'` (`src/utils/hostedBookingCutover.ts`, a **build-time** constant deliberately unreachable from a query parameter, cookie or tenant doc), and **no error, timeout or rejection may fall through to the legacy path**. Chain: C1 callable `cb88af0` deployed 2026-07-24 (`salowncreatebooking-00001-hab`) → H1 hosted cutover `9480185` live 2026-07-25 (release `1785005794084000`) → R1 phase (a) rules `2a6a641` live 2026-07-25 LAST (ruleset `323f1726…`, 131/131 against the deployed ruleset), rejecting the 7 server-owned keys while anonymous create itself stays allowed (locked decision 18). Later hardening on the same path: ANY-BARBER server-side assignment inside the create transaction (`f980978`, LIVE 2026-07-30) and the DPPP rules release forbidding a client-written `loyaltyPromotionSnapshot` (2026-08-05). **Residual, and it is not B3:** the legacy `addDoc` branch still exists in `BookingPage.handleSubmit` as the isolated rollback, and is deleted only by **R1 phase (b)** (deny anonymous create) — which is blocked on **W1** premium cutover + **E1** payment E2E. Ledger: [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md); parent plan: [BOOKING_SECURITY_POLICY_MIGRATION.md](BOOKING_SECURITY_POLICY_MIGRATION.md). ⚠️ **That parent plan's own header still reads "🔵 Planned — coordination artifact, no code yet (2026-07-24)" and is wrong** — a detail document must not carry a status badge (rule at the top of this file); ROADMAP wins.
- 🔵 **W1 + E1 + R1 phase (b)** — W1 premium (`whitecross-site`) cutover to the authoritative callable · E1 payment E2E · then R1 phase (b) denies anonymous create, **rules LAST**. All three ⬜ not started; together they are the only thing standing between today and deleting the legacy create path.
- 🔵 **B4 phone country code standardization** (owner has feedback, Ireland +353) — `COUNTRY_CODES` is local only in `BookingForm.tsx:46` (NO +353); the other 4 entry points are free-text. The phone is the main key of client-identity → an inconsistent code splits the same customer in two. Task: single shared component (including IE) → 5 entry points. *(code-confirmed open 2026-07-16)*
- 🔄 **OPT-1 tenant-configurable service options + authoritative add-ons** — resolver + C1 `selectedOptionIds` + folded-price fix LANDED (`b6b622e`, 2026-07-27). ⚠️ **Status corrected 2026-08-10: its frontend half is LIVE, and was never released on its own merit.** The 2026-07-27 record ("dev+test, not deployed") was true for exactly the emergency DOCID-1 window, when the owner declined to co-deploy it off `main`. Every `hosting:salown` release since 2026-08-01 builds the whole bundle from `main`, and `b6b622e` is an ancestor of all of them — so it has shipped as a co-release many times over. Treat the *behaviour* as live and unverified rather than as pending: nobody has run OPT-1's own live pass. Same option resolves per tenant/category/service to INCLUDED/OPTIONAL_PAID/OPTIONAL_FREE/UNAVAILABLE (precedence service→category→tenant→catalogue, **no tenantId hardcode** — Whitecross INCLUDED is a fixture). Closes the ADDON-PRICE test debt. **Remaining (C2):** option-config admin UI + wire advisory resolver into booking/checkout UI; live effect for Whitecross needs **W1** cutover. Full spec: [SERVICE_OPTIONS.md](SERVICE_OPTIONS.md). *(2026-07-27)*
- ⏸ **B5 2-way sync / auto-block** (⭐ differentiator) — salOWN should AUTOMATICALLY close its occupancy in Booksy+Fresha. **Status:** Treatwell ✅ live (`salownIcalFeed` iCal OUT) · Fresha ⏳ "Import from external calendar URL = COMING SOON" (when released, paste the feed, zero code) · Booksy ❌ closed → Puppeteer-or-accept decision (owner DECIDED on the Phase 2 Playwright robot, the design ADR is separate; BOUNDARY: outbound slot-locking only, INBOUND flow is always in the parser). Phase 0 verification results [B5 archive]. *(GCal bridge DEAD — the platforms don't listen to an external calendar.)*
  > **What "calendar integration" means on this roadmap, so nobody plans a phantom** *(clarified 2026-08-10)*: the only calendar work that exists is **`salownIcalFeed`, a one-way iCal feed OUT** — live, used by Treatwell, and the agreed answer for TR tenants who keep another calendar (a TR tenant never gets a parser — owner decision 2026-07-23). **There is no personal/consumer calendar sync** (Google Calendar, Apple Calendar, two-way staff calendars): no roadmap item, no design doc and no code in either repo at this snapshot. If it is wanted, it starts as a new item, not as a continuation of B5.

---

## 🏢 Multi-location & Opening Hours *(new theme, opened 2026-08-10)*

> **Why this is its own theme.** Two independent workstreams landed in August that had no home on this
> roadmap and were therefore invisible from the top: the **multi-location seams** and the **opening-hours
> authority chain**. They are grouped because HOURS-SSOT-C's canonical tenant hours are the thing
> location-scoped hours will later be scoped *by* — do them in this order or do them twice.

**⚠️ Multi-location is NOT an end-to-end feature and must not be described as one.** What exists is
*preparation*: two seams so that adding locations later is a backfill rather than a schema change
mid-flight. Nothing reads a location yet. Market context: [TR_BEAUTY_MARKET_REQUIREMENTS.md §4.7](TR_BEAUTY_MARKET_REQUIREMENTS.md).

- 🟡 **MULTI-LOCATION-PRE-A — sale-time eligibility freeze** (`72ce9be`, 2026-08-10, **`PUSHED_NOT_LIVE`** — its Functions half was never deployed; the frontend half is type-level with zero runtime emit). `PackageCommercialSnapshot.locationIds` + the executor writer, so a sold package folds against its own frozen snapshot and never re-reads the definition. All four states are distinct and load-bearing: **ABSENT / `null` / `[]` / `[ids…]`**. **STORAGE ONLY** — no reader, no eligibility check. Frontend impact is type-level (a `packages/shared` interface field, zero runtime emit), which is why it rode harmlessly into the TR-CURRENCY-F release; **its Functions half was not deployed**.
- ✅ **MULTI-LOCATION-PRE-B — archive/restore is status-only** (`afb40fb`, 2026-08-10, **`LIVE_VERIFIED`**). ⚠️ *Status corrected 2026-08-12: this said "pushed, no deploy"; it is client-side only and shipped in ADMIN-PENDING-SLICES-RELEASE (`3a0fcdea1e1f8434`).* `setDefinitionStatus` has no callable of its own: it resends the whole definition through `salownSavePackageDefinition`, whose save contract is a **full replace**. `savePackageDefinitionCore` maps `undefined → null` through `optIdList` and then *names* that key in `tx.update` — so **omission from the payload is not neutrality, it is an erase**. The seam sent `allowedBarberIds` but not `locationIds` and not `allowedServiceIds`, so every archive and every restore silently blanked a package's branch eligibility and its redemption service list. Nothing already sold was harmed (PRE-A's frozen snapshot); the damage was forward-looking — the **next** sale off an archived-and-restored definition would have been recorded as valid everywhere with nothing in the document showing a restriction had ever existed. `?? null` is load-bearing, not shorthand: `[]` is not nullish, so an explicitly empty list survives as `[]`. The new suite asserts the **stored document** through a faithful replica of the server writer (asserting the payload would have proven a key was sent while proving nothing about what it does to the document — the entire defect lived in that gap); 7/13 fail against the pre-change seam. No server change was needed.
- ✅ **PACKAGE-EDITOR-RESTRICTION-ROUNDTRIP — landed `c942329`, `LIVE_VERIFIED`.** ⚠️ *Status corrected 2026-08-12: this said "claimed and in flight"; it merged on 2026-08-10 (claim release `8ea75f3`) in the same commit as HOURS-SAFETY-A, and rode the `3a0fcdea1e1f8434` release.* `PackageBuilderModal`'s **edit** path had dropped `locationIds` + `allowedServiceIds` by the same full-replace mechanism PRE-B named — same class of defect, different door.
- 🔵 **MULTI-LOCATION-PHASE-1 — location authority/registry + compatibility contract.** The first work permitted to *read* `locationIds`. **Phase order is a dependency chain, not a preference:** ① authority/registry → ② staff/auth → ③ booking/availability → ④ public booking → ⑤ packages → ⑥ checkout/finance/reporting. Skipping ahead means a surface enforcing a restriction another surface cannot see.

**Opening hours — the corrected sequence.** These were being done out of order, which is how a "safety" fix
and an "SSOT" fix ended up able to contradict each other.

- ✅ **HOURS-SAFETY-A — landed `c942329`, superseded and extended by `9af1272`, `LIVE_VERIFIED`.** ⚠️ *Status corrected 2026-08-12: this said "claimed and in flight, no commit"; it merged 2026-08-10 (claim release `97b0cbe`) and `BARBER-HOURS-PROPAGATION-RACE-P0` (`9af1272`, claim `f7ed82f` explicitly extended to the pin it supersedes) replaced the seven concurrent whole-document `setDoc` writes with ONE `runTransaction` over all barbers and all seven days, `tx.update` on dotted paths only.* Live on `hosting:salown` `11cc739f548c5e10`, proven by the served `Settings-ZjvTQcBn.js` containing ``source:`salon` `` and the `` `dayHours.${dayName}` `` field-scoped update.
- ✅ **HOURS-CASING-B — `10febff`, DEPLOYED + `LIVE_VERIFIED` 2026-08-10** (`salowngetbusyslots-00063-hab` → **`-00064-foj`**, europe-west2, codebase `salown`; still the live revision at the 2026-08-12 sweep). `settings/hours` has two writers with different key casing, and this callable was the last server reader still lowercase-only, so a Capitalized document fell through to the 09:00–19:00 defaults and reported a **closed day as open**. One narrow reader `functions/src/utils/weekHours.ts`: Capitalized (canonical) > lowercase (legacy) > default, whole entry, never a field merge. Proven on production data with zero writes (whitecross Sunday `10:00–16:00`, herohairs `10:00–17:00`); rollback anchor `-00063-hab`. ⚠️ The lowercase-legacy and `closed:true` branches are **not** proven live — no live tenant carries either shape. *(Historical anchor: `c3111e0`, 2026-07-14, the same class of bug.)*
- 🔵 **HOURS-SSOT-C — ✅ UNBLOCKED, not started.** ⚠️ *Status corrected 2026-08-12: the gate read "⛔ do not start until A and B are green" and both are now green **and live** — A via `9af1272` on `11cc739f548c5e10`, B via `salowngetbusyslots-00064-foj` with its rollback identity known.* Bind Admin availability to canonical tenant hours and remove **all** Opening Hours → barber-shift propagation. This is the one that changes behaviour a salon will feel — and `9af1272`'s `source: 'salon' | 'staff'` provenance marker is the field it must read: `salon` means "may be re-derived", `staff` and *unmarked* mean **keep**.
- 🔵 **Location-scoped hours** — after C, and only after C: hours resolve per location. Depends on MULTI-LOCATION-PHASE-1's registry existing.

> **Hours audit result, recorded plainly** *(updated 2026-08-12)*: there is still **no standalone hours
> audit document** in either repo. HOURS-CASING-B now has both a `SYNC.md` line (`e9f7d11`) and a
> [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md) row; **`9af1272` has neither**, and the release that took
> it live has no record at all — see ROADMAP §5.2 `REL-2a`. The evidence for this
> chain is the claim files, the historical casing fix `c3111e0`, and the 2026-07-23 central-availability
> resolver series (`6121460`/`95ae2aa`/`12b36d8`/`7c2db70`/`96d4ef9`/`e879220`, all live) that made a single
> resolver possible in the first place. Anyone who needs more than that should generate it, not infer it.

---

## 📣 Marketing & Retention

- ✅ **Campaign infrastructure** — C1 redesign (`3e26610`/`2ce03b1`) · discount codes 4 phases (`3c6c81d`..`fe875aa`) · re-engagement attribution (`ef7f751`) · C2/C2b/C2c premium email+preview (`82e86d6`/`1e81915`/`42cd5d4`) · C5 lapsed dedup A+B (`3c4039f`/`5fa051a`/`1bf3416`) · Marketing Performance card (`5218d91`) · email open/click tracking (`c87c883`/`7730e7f`) · C6 Marketing↔Analytics split (Marketing=`TABS=['campaigns']`, `2a2e92d`). *(detail: Completed › Marketing)*
- 🔄 **CAMPAIGN-LIFECYCLE-PARITY — one campaign resolver across every surface** *(source ON origin/main: salown-app `01bfebe` + claim release `df28087`; whitecross-site `bc25d257`, with its `script.js` half absorbed into `bacfda34`.)* ⚠️ **STATUS CORRECTED 2026-08-12 — this line said "NOT deployed — nothing of this work is in production" and that is no longer true.** The salown-app **frontend half is `LIVE_VERIFIED`** on `hosting:salown` `11cc739f548c5e10` (2026-08-12T00:12:35Z, an **unrecorded** release — §5.2 `REL-2a`): the served entry chunk carries `⚡ Bonus points earned` and no `Double Points — Active` / `2× loyalty points`. The **publisher (`c8036f0`) is still `PUSHED_NOT_LIVE`** — `salownPublishPublicCampaign` is absent from the 108 deployed functions — and `tenants/whitecross/public/campaign` still reads `{active:true, 2026-05-24→2026-08-24}` with **no `multiplier`**, `updateTime` 2026-06-18. So the resolver fails CLOSED and the repair **shipped without taking effect**. Customer-visible state is unchanged (the salOWN banner was already dark behind the 403 this work exists to fix) — but the item is **not delivered** and must not be closed. The whitecross artefact is the mirror image: its banner **is rendering right now** from the multiplier-less mirror, so `bc25d257` still must not be deployed. Campaign **VISIBILITY** and campaign **BENEFIT** are two guarantees and are now proved separately. The benefit half (`loyaltyPromotionSnapshot`, frozen at booking creation, read by the award) was audited and **deliberately not rewritten** — it was already airtight; `campaignId` stays `null` because the persisted window + multiplier + `policyVersion` already identify what was promised, and an id nothing generates would be ceremony. The visibility half is new: `evaluateCampaignWindow` is the **only** place that decides where a campaign's edges are, `resolveActiveCampaign` returns a campaign or exactly `null`, and the twin byte-parity contract is preserved. **Fixed a live defect the audit had marked ✅:** the salOWN booking-page banner read auth-only `settings/settings` and swallowed the 403, so it had never rendered for any customer — it now reads the world-readable `public/campaign` mirror — **which is the half that has not landed: no mirror carries `multiplier` yet** (`CAM-3`). Also closed: the till preview re-derived the campaign with a hardcoded `2` while checkout awarded from the snapshot; the receipt email compared a **UTC** day to tenant-local window ends; the manual and automatic confirmation-email paths disagreed about who gets promised what; and `multiplier` **had no UI at all** (migration-script only), so a salon creating a campaign produced one worth nothing. Half-open `[startAt, endAt)` reconciled **without moving any money** — `endAt` is local midnight *ending* `endDate`, which is exactly the inclusive-day rule in different units; the opposite reading would have silently shortened every live campaign by a day. Gates: frontend **2496/2496** · functions **1290/0 fail** · emulator **419/419** · tsc 0 · eslint 0; campaign tests 37→74 (frontend), 8→15 (functions). **⚠️ Release is BLOCKED on a publisher that does not exist yet — owner decision 2026-08-10.** Existing `public/campaign` mirrors carry no `multiplier` (whitecross's last written 2026-06-18) and the resolver fails CLOSED, so the mirror cannot be released against as-is. **An earlier recommendation to have the owner press "Save campaign" once per tenant was REJECTED, and correctly so:** it would make an incidental production write from a browser the migration strategy, and would treat a stale mirror as release evidence. **There is currently NO server-side writer of `public/campaign` anywhere in `functions/src/`** (verified 2026-08-10) — the only writer is `Marketing.tsx`. The canonical publisher has to be built first; its natural home is the existing `salownRepublishOnSettingsEdit` (`index.ts:100`), already an `onDocumentUpdated` on `settings/settings` that republishes `public/profile` through `buildPublicProfile`. **Coordinated release order, once that exists:** ① deploy the publisher/republisher by exact name → ② republish `public/campaign` from each tenant's existing `settings/settings.doublePointsCampaign` → ③ verify the mirror's source/version/timestamp and normalized fields → ④ prove disabled / incomplete / expired / not-yet-started campaigns each resolve to `null` → ⑤ only then `hosting:salown`, and the Whitecross artifact separately. See INCIDENTS 2026-08-10.
- 🔵 **ANON-READ-1 · public booking page loses tenant loyalty config** *(follow-up defect, opened by CAMPAIGN-LIFECYCLE-PARITY 2026-08-10)* — `BookingPage.tsx` reads `settings/settings` for `loyalty.{enabled,cashbackPct,earnRate}` behind a silent `.catch()`; the read is auth-only and the page never authenticates, so `loyaltyCfg` is always `null`. **Reachable surface:** `salown.com/book/{tenantId}`, every public booking, every tenant — the points estimate and the post-payment points figure. **Security boundary: none crossed** — the read is DENIED, so this is silent feature loss, not exposure. **Do not fix by weakening rules or enabling anonymous auth:** the shape is a public projection (as `public/profile` already is) plus a LOUD failure.
- 🔵 **ANON-READ-2 · public booking page cannot see `specialHours`** *(follow-up defect, 2026-08-10)* — same file, same denied read; `normalizeSpecialHours(sData.specialHours)` therefore always receives `undefined`. **Reachable surface:** the public slot grid. **This is the most severe of the three**: a salon that declared a date closed (bank holiday, one-off closure) still has slots offered on it publicly — operationally the same class as the 2026-08-10 self-reschedule Sunday-slots incident. **Security boundary: none crossed.**
- 🔵 **ANON-READ-3 · public booking page falls back to platform booking policy** *(follow-up defect, 2026-08-10)* — same denied read supplies `bookingSettings`, so `resolveBookingSettings` returns platform defaults (lead time, cancellation window, overrun allowance) instead of the tenant's. **Reachable surface:** the public slot grid and the review screen. **Lowest severity of the three, and deliberately so:** `salownCreateBooking` re-validates server-side and is the authority, so this is advisory/UX drift, not an enforcement hole. **Security boundary: none crossed.**
- 🔵 **ANON-READ-4 · `loyalty.html` reads `clients` and `settings` with no authentication** *(follow-up defect, 2026-08-10 — DIFFERENT IN KIND from 1–3, treat separately)* — the whitecross digital loyalty card, linked from customer email, does a direct Firestore lookup it describes in its own comment as "FIND CARD (no auth, pure Firestore lookup)". Both collections are auth-only; anonymous sign-up is disabled project-wide (`ADMIN_ONLY_OPERATION`), so the page has no identity to inherit and its whole data load appears unreachable. **Reachable surface:** whitecrossbarbers.com/loyalty.html. **Security boundary: this one is load-bearing.** The other three are degraded reads; this page's entire identity model is "type a phone number, read the clients collection". **Opening `clients` to anonymous reads would expose the full customer database** — names, phones, emails, point balances, booking history — to anyone. The only acceptable shape is a server-side callable taking phone/email + surname that returns ONLY that one client's card payload, rate-limited and audited. **Explicitly NOT to be solved by enabling anonymous auth or relaxing `firestore.rules`.**
- 🔵 **ANON-READ-0 · enumerate every anonymous surface still reading a G4-closed document** *(2026-08-10)* — three instances have now been found independently, twice on the same day (this item's banner, `WHITECROSS-HOURS-SAVE-LIVE-P0`'s hours read). G4 (2026-06-27) was correct; what was never produced is the list of readers it broke. That enumeration is the missing artifact, and it is cheap: one unauthenticated request per document path.
- 🔵 **C3 abandoned-cart automatic** — manual "We've missed you" button ✅ LIVE. Remaining: X-hours-after-abandonment scheduled trigger (one-time guard + opt-out) · "You left something behind" prefill deep-link template · return-rate funnel. *(code-confirmed: only manual `sendAbandonedCart` onCall, no scheduled.)* Engine shared with C7/C3.1 scheduling.
- 🔵 **C8 audience scope** — `audienceScope` on a campaign (Clients default / Members / Everyone) + server-side member guard (NOT in `sendCampaignBulk`, `index.ts:2290`) + category library + founding-clients segment. Members receive client promos (a leak at the campaign layer). Spec: [CAMPAIGNS_V2.md](CAMPAIGNS_V2.md). *(code-confirmed open 2026-07-16)*
- 🔵 **C9 client card redesign** — Phase 1 ✅ LIVE (lifetime point-spend visibility + trusted client flag, `70247f0`). Phase 2: card full-height premium drawer, hero header + inline edit (owner will have it done with Claude Design → code after approval). Spec: [CLIENT_CARD_V2.md](CLIENT_CARD_V2.md).
- 🔵 **REDEEM-VISIBILITY · redemption is invisible to every surface that reads the client document** *(opened by a Jack Powell loyalty audit, 2026-08-11 — report only, no code changed)* — the client document carries **no redemption field at all**: all 367 whitecross client docs were scanned and `loyaltyPoints` (the balance) is the only loyalty key. Redemption lives exclusively on the booking (`loyaltyPointsRedeemed`, `loyaltyRedeemedValue`), so **the admin Clients page can show it only because it loads all 1,496 bookings and aggregates them in the browser** (`Clients.tsx:235-236`) — that is C9 Phase 1's mechanism, and it does not generalise. Consequences, all code-confirmed: (1) the **Staff App client card shows no redemption** — `ClientDetailSheet.tsx:180` renders the balance and nothing else; `ClientsView.tsx:36` and `CustomersPanel.tsx:144` likewise; (2) **`client.totalDiscount` excludes loyalty redemption entirely** — verified across the 49 whitecross clients who have ever redeemed: 47 equal booking discounts alone, **0** include the loyalty value (2 differ for unrelated reasons). Jack Powell reads `totalDiscount: 12` while the value actually given him is £12 + £9.10 = **£21.10**. Any report built on `totalDiscount` understates what the salon gave away. **Shape of the fix: persist a `totalRedeemed`/`totalRedeemedValue` aggregate on the client document in the same server-side commit that decrements the balance** (`executor.ts:1406-1420`, `firestoreActions.ts:345-354`) so every reader gets it for free, rather than teaching a second surface to aggregate 1,496 bookings. **Do NOT fold this into C9 Phase 2** — that is a visual redesign, this is a missing field.
- 🔵 **LOYALTY-LIABILITY-VISIBILITY · unredeemed points are not reported anywhere** *(2026-08-11)* — measured directly from Firestore: **15,575 outstanding points = £778.75** of unredeemed liability across 326 point-holding whitecross clients (0 negative balances, so no floor bug has fired in production). £197.25 has been returned to date. No screen shows this number, and nothing shows it moving — yet it is the number that decides whether a double-points campaign should be extended. Related: the 2× campaign (24 May–24 Aug 2026) makes effective cashback **10%, not the configured 5%**, for direct website bookings. Cheapest first cut is a single figure on the Marketing → Loyalty Boost card, sourced the same way as EV3's other metrics; consider folding into **EV3 auto-generated METRICS.md** rather than shipping a bespoke screen.
- 🔵 **Slice 3b remainder** — (1) Revenue SSOT: reduce OverviewPanel gross `bookingRev` vs Reports net/paidAmount to a single source (keep aligned with Finance) *(code-confirmed: OverviewPanel still uses independent `bookingRev()` `OverviewPanel.tsx:48`)*; (2) design polish (two-column, numbers/% more prominent).
- 🔵 **Discount codes remainder** — end-to-end live test of a code (oncePerCustomer/limit/expiry) + %100-off online edge (£0 Stripe session).
- ✅ **LC1 landing live chat (bot-first + human handoff) — LIVE 2026-07-31.** The owner's 2026-07-28 "write-only" hold was lifted; the work was rebased onto current `origin/main` in clean worktrees and shipped function → widget → inbox: `salownLandingChat` rev `salownlandingchat-00002-loc` · `hosting:salown` `3880d3e7def72458` · `hosting:salown-admin` `9f457fc2c8ee4b35`. **Visitors are identified before the bot answers** (name + email required, phone optional), enforced server-side with `IDENTITY_REQUIRED`; legacy sessions are asked on their next message and never backfilled. Commits salown-app `173db95`, super-admin `06d2a4c`. Bot (Haiku 4.5) answers strangers instantly from `landingGuide.ts`+`productGuide.ts`; the founder takes over from super-admin → **Live Chat** and the bot goes silent (`mode:'human'`), "Hand back to assistant" returns it. Zero `firestore.rules` change — everything under `superAdmin/liveChat/**`. **Two abuse gaps were found and closed before deploy:** `lead` sent an email on every call with no rate limit and no session check (an unauthenticated mail-flood on info@salown.com, and it could create session docs for invented ids) — now IP-metered, 404s on an unknown session, notifies once per session; `handoff` is metered too. `poll` is deliberately unmetered and the reasoning is in the code. 30 focused tests. Full doc: [LIVE_CHAT.md](LIVE_CHAT.md). **Maintenance rule (same family as C10):** landing copy/pricing changes ⇒ `landingGuide.ts` changes in the SAME commit.

---

## 🤖 AI

- ✅ **C10 salOWN AI accuracy pack + product knowledge** — buildContext DAILY TOTALS + DEFINITIONS, chat history, askAI auth guard (`1bd0885`/`695a61f`); `functions/src/ai/productGuide.ts` sitemap+~18 how-to (`58668af`). Maintenance rule: when a user-visible feature ships, add a line to productGuide.ts + targeted askAI deploy. *(detail: Completed › AI)*
- 🔵 **C10 remainder** — feature-flag awareness + tool-use → C4. *(code-confirmed: productGuide is a static string, no tool-use.)*
- ✅ **LC1 landing chat bot** (LIVE 2026-07-31) — the SECOND place a Claude prompt now faces users, and the first facing *strangers*: `functions/src/ai/landingChat.ts` + `landingGuide.ts`. Same maintenance rule as C10 (ship a user-visible change ⇒ update the guide in the same commit). Status + detail under **Marketing & Retention** / [LIVE_CHAT.md](LIVE_CHAT.md).
- 💡 **C4 salOWN AI (cross-tenant data assistant)** — owner/super-admin asks in natural language, the AI walks each tenant's Firestore and compiles. Parts: read-only tenant-scoped query layer · Claude tool-use → aggregation fns · NL→metric/table · PII/GDPR/tenant isolation. ⚠️ cross-tenant access is the most sensitive point. A subset of C1 suggestion + C3 funnel.

---

## 📱 Mobile (Staff App)

- ✅ **Staff App core** — D3 mobile stability (`4f1bd13`) · D4 modernization: speed+weekly+icon system+day-swipe (`e3f3e9f`) · D5 walk-in Booksy-cart redesign + iOS drift root-fix (`7f46858`) · D7 weekly schedule Day|Week (`20a3bcb`). Also: Setup/Shell/Today/Sheets/Clients/Sales/Reschedule/No-show/WorkingHours/Notification-bell all ✅. *(detail: Completed › Mobile + Staff App)*
- 🔵 **D0 hardening remainder** — ~~push silent-failure (T2-7)~~ **✅ CLOSED 2026-07-30 (LIVE)** — `PUSH-RECOVERY` (`20e6aba`+`e4ac115`): the FCM channel now logs per-send success/failure counts, the FCM error codes and the stale-token cleanup result (`salownnotifybookingpush-00037-vog`, `salownnotifybookingconfirmedpush-00037-fat`), and the Staff App revalidates its subscription on every open and says so in the UI when push is off (`staff-DcYsEgSg.js`). INCIDENTS 2026-07-30 · reschedule time-guard (RescheduleSheet has a conflict-guard but NO opening-hours guard, `RescheduleSheet.tsx:141`) · empty-state/access message · silent-error swallowing. Full report: [STAFF_APP_HARDENING.md](STAFF_APP_HARDENING.md). *(code-confirmed 2026-07-16.)*
- 🔵 **D2 Google/Apple sign-in + onboarding routing** — the buttons are "coming soon" visuals (`LoginScreen.tsx:113`, NO provider wire). Parts: Google provider · Apple ($99/yr Service ID) · post-login member-check · onboarding flow (for an owner opening a new salon, the biggest task). *(code-confirmed open 2026-07-16)*
- 🤔 **D6 mobile catalog (decision pending)** — should adding a new service/barber from the phone be allowed, or panel-only? Owner deferred (2026-07-16). If done: "+" FAB → add-menu (Walk-in/New service[name+price+duration+category]/New barber[name+color]), schema parity. *(code-confirmed: no add-service/barber UI in the staff app — correct.)*
- ⏸ **D1 Capacitor / App Store** — iOS web push doesn't work → a native wrap solves it. **READY & WAITING, NO rush** (owner 2026-07-14: "we need to go over the app more"). Prep ✅ (D4 SVG icons + D5 viewport fix "Capacitor-safe"). Plan: [D1_CAPACITOR_NATIVE_PLAN.md](D1_CAPACITOR_NATIVE_PLAN.md); precondition $99/yr Apple+Mac+APNs. **Waiting.**

---

## 🛠️ Tech Debt & Reliability

- 🟡 **SHARED-FN-NAMESPACE · the two contested names are back with codebase `salown`, and the deploy guard now keeps them there** *(2026-08-12, opened by the incident of 2026-08-11, source fix same day)* — `addToWaitlist` and `provisionTenant` were exported from **both** `salown-app/functions` and `whitecross-site/functions/index.js`, both naming `region: 'europe-west2'`, so the two repos deployed onto the same Cloud Function and the last deploy silently won (22-day intake outage; INCIDENTS 2026-08-11). ✅ Both exports deleted from whitecross (`a336ddce`; no whitecross caller existed) and `scripts/deploy-functions.sh` step **5b** now hard-fails if either name is a deploy target or reappears as an export — negative controls fire, positive control still deploys. **Verified live 2026-08-12** (read-only label sweep of all 108 functions): `addToWaitlist` `-00038-fof` and `provisionTenant` `-00137-bij`, both `firebase-functions-codebase: salown`. **Left open deliberately — this is `SEC-FN-NS`:** (a) the equivalent guard does not exist on the salown side, so nothing stops a third repo repeating this; (b) on the next whitecross Functions deploy, confirm once that both functions are still present and unchanged; and (c) **five** europe-west2 functions still carry codebase `whitecross` — `salownNotifyNewBooking`, `salownSendTestTelegram`, `salownSyncTreatwellIcal`, `sendProInterest`, `setTenantClaim`, all last updated `2026-07-21T00:06Z` — so the two repos still share a region and a deploy surface. **Second, smaller finding in the same neighbourhood:** the whitecross `createStaffUser`/`deleteStaffUser` are live in us-central1 and `whitecross-site/barber-panel/src/pages/Settings.js:348` calls them through a region-less `getFunctions()`, so the legacy panel still creates staff via the pre-O1 code — no `tenantRole` on the claim, none of the escalation guards. Retire the panel path or repoint it at europe-west2.
- ✅ **TypeScript migration — v1.0.0 TAGGED (2026-07-13)** — codebase end-to-end STRICT TS (frontend 1400→0, functions 355→0, byte-proven). Post-1.0 chores (NOT release-blockers): dead-code chore (pending), any-narrowing, I2 split. Patterns: [MIGRATION_PATTERNS.md](MIGRATION_PATTERNS.md), [ARCHITECTURE_V2.md](ARCHITECTURE_V2.md). *(detail: Completed › Reliability)*
- ✅ **I1 parser silent-breakage canary** — `recordParserRun` in BOTH pipes (`tenants/{id}/parserStats/{source}`, daily counter + 0-import alarm).
- 🔄 **I2 `functions/src/index.ts` split** — Phase 1 (helpers→domain modules) ✅ effectively done (parity-tested). Phase 2: move the bodies of 55 exports into domain modules (index.ts 3816 lines). Slice 1 (askAI+auth) ✅ `bccd828`; **next is parsers** (see Current focus). 🔴 Golden rule: export name+config exactly matched. Operation: in a single CLEAN window, codebase-prefixed deploy (`--only functions:salown`, NEVER blanket). Plan: [TYPESCRIPT_MIGRATION_PLAN.md](TYPESCRIPT_MIGRATION_PLAN.md).
- 🔄 **DOCID-1 service identity** — ⚠️ **status corrected 2026-08-10: the outage is long closed and this line's "awaiting hosting go/no-go … online booking on salown.com stays broken until it ships" was three waves stale.** The booking fix shipped **2026-07-27 18:23 UK** from the isolated branch `hotfix/docid-1` HEAD `ae61566` (salown release `1785173028995000`, version `a6b54b3273c9f7a4`) — deliberately NOT from `main`, so OPT-1 would not co-release; the full `main` commit `c01e4b5` has since shipped as part of later waves. `origin/hotfix/docid-1` still exists and can be deleted once someone confirms nothing references it. Residual debt AFTER the deploy: whitecross service docs answer to TWO identities (document id + a legacy `id` slug), and walk-ins store the service NAME in `serviceId` while the parsers store slugs — so every reader compensates differently. Retiring it = a data+code package (drop the stored `id` field, migrate historical `serviceId` values, then delete the `legacyId` read path), NOT a quick cleanup: export → dry-run → owner approval.
  - ✅ **DOCID-1 read-side parity SHIPPED (2026-07-28, live `a55e9bf`)** — the "every reader compensates differently" half is closed by ONE resolver per app: Staff App `resolveServiceLabel` (`STAFF-SERVICE-LABEL-1`) + Admin `getBookingServiceLabel` delegating to it (`SERVICE-LABEL-PARITY-1`), catalogue keyed by document id + legacy slug + name so a booking's `serviceId` resolves to the service NAME on every surface (no raw `eixVCzbO5FVPMZHJLa1G` on screen). `config.services` now additively carries `docId`+`legacyId`. Read/display mapping only — **no booking-doc write, no migration**. Landed together with `STAFF-BLOCK-SALE-GUARD-1` (born-block sale/checkout guard). Deployed by the standing `main`→CI (`firebase deploy --only hosting`) which built+shipped ALL hosting targets (Admin + Staff), verified live via deterministic bundle-hash match. **Still open (the DATA residual above):** drop the stored `id` field, migrate historical `serviceId` values, delete the `legacyId` read path (export → dry-run → owner approval).
  - ✅ **SERVICE-IDENTITY-A Stage 1 DEPLOYED + LIVE 2026-08-10** (`bd5ccab` + review `c9c9017` + `ac36887`; 5 exact Functions, europe-west2, last updated `2026-08-10T09:05:55Z`, Level A verified — record in `SYNC.md`, **not yet written up in [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md)**). Gives the **server** one service-label contract and repairs the last two DOCID-1 catalogues. The `ac36887` correction is the lesson worth keeping: the first cut removed `serviceId` from the token payload while fixing the DISPLAY field — **correct the label, never remove the identity.**
- 🔵 **G3 unsaved-changes guards** — forms silently lose data via backdrop/Esc/✕. The gold standard is in WalkInForm (dirtyRef) → shared `ConfirmDiscard` component. F1 (6 surfaces): Products · AddClientModal · Clients edit · BookingForm · BulkCampaign Compose · SendCampaignPanel. F2: CheckoutPanel/Settings. F3: staff app Sheets. *(code-confirmed: guard exists on 0/6 surfaces 2026-07-16)*
- 🔵 **salOWN ToS/Privacy pages** — the landing footer Terms/Privacy `href="#"` is dead (`hosting/index.html:648-649`); salOWN has NO ToS/Privacy page of its own (the whitecross tenant side ✅). Must be written before tenant onboarding scales (SaaS ToS + GDPR privacy + loyalty framework). *(code-confirmed open 2026-07-16)*
- 🔵 **REL-1 predeploy topology — a single-target hosting deploy still builds the OTHER target** (observed on the Unit 8 release, 2026-08-05). `firebase deploy --only hosting:salown` does **not** release `salown-staff` (it stayed `8409e666da7ea223`), but it **does** run that target's predeploy hook, so tracked `hosting/staff-bundle/**` is rebuilt and left dirty on every Admin deploy. Not `npm run build` (plain `vite build`) — the hook on the other `firebase.json` hosting entry runs regardless of `--only`. **Not a Staff deployment incident:** the live Staff version did not move. Consequences worth naming: the tracked staff bundle can drift from what is actually served, and Admin's mirrored `/staff-bundle/` path carries whatever the hook last produced. **Until fixed, the explicit-path cleanup after every `hosting:salown` deploy is REQUIRED** ([DEPLOY.md](DEPLOY.md)); explicit paths only, never `git restore .` — the repo is shared by concurrent sessions. Fix not yet designed; candidates: move the staff build out of predeploy into an explicit step · stop tracking `hosting/staff-bundle/**` (build output; `public-bundle/` is already ignored) · split the two sites' public roots so neither contains the other. **Design + test required before the requirement is relaxed.**
- 🔵 **Small infra** — G2 salOWNHub DNS (`salown.web.app/app`→`hub.salown.com`) · ~~EeKurt legacy site redirect~~ (tenant inactive 2026-07-18, dropped) · `categoryId` migration · dead `isStaff` Firestore rule.

---

## 🎨 Premium Themes (revenue line)

- 🔵 **F1 per-tenant public site themes** — two drop-in themes (`style.original.css`+`style.premium.css`) local, **NO deploy**. Remaining: live site sync (whitecross-site `siteTheme` onSnapshot+href swap) · panel "Available Themes" (`OnlineProfile.jsx`, Premium-gated) · theme registry · *(code-confirmed: no theme picker in OnlineProfile; whitecross-site hardcoded DEFAULT_THEME.)* Detail: memory `project_premium_themes`.
- 🔵 **F2 premium custom-domain site = ONE shared template, tenant-agnostic (owner 2026-07-23)** — the custom-domain booking site (`whitecross-site`) must NOT become per-tenant cloned copies; every premium tenant is served by a single tenant-parameterized codebase (reads `TENANT`, no salon hardcoding), so booking logic lives in one place and cannot drift. **Precedent set:** the staff-shift SSOT + 15-min overrun allowance fix (`whitecross-site/script.js` `e0003845`) was written tenant-agnostically for exactly this reason. Note: the salown-hosted booking (`/book/:tenantId`, `BookingPage.tsx`) ALREADY covers all tenants with the same rule (Phase 1) — so a premium tenant on the salown-hosted flow is already correct; F2 only concerns the custom-domain path. Keep the two engines' rules in sync (both reference `STAFF_SHIFT_OVERRUN_ALLOWANCE_MINS`) until they can share source.
- 💡 **Subdomain themed sites** — `{tenant}.salown.com` themed public site (same infra family as salOWNHub DNS).

---

## 🏪 Marketplace & Discovery

- 💡 **J1 Trust Score — outcome-based salon ranking** · 🕓 Vision locked (ADR-016, opens when the marketplace phase begins). Ranking in the salown.com consumer marketplace via an internal Trust Score (verified CHECKOUT, repeat-client, no-show behavior, rating consistency, longevity…). Principle: "reward outcomes, not activity" — a structural antidote to Fresha's fake-booking gaming. The score is for internal use. Spec: [DECISIONS.md ADR-016](DECISIONS.md).

---

## 🌍 Internationalization (TR market)

> **Tenant roles are fixed and not interchangeable (owner decision, 2026-08-02).** `demo` is the
> **persistent Turkish product/sales demo** — country TR, packages enabled, `checkoutSettings`
> intentionally **enabled in `tr` mode**; it is a legitimate anchor for what TR should look like and
> must not be "cleaned up". `tr-demo` is the **disposable synthetic verification tenant**, restored
> to default after every test run — **never cite its configuration as a product decision**. Full
> per-tenant table: [TENANTS.md](TENANTS.md#demo--verification-tenants).

- ✅ **TR-A Turkey pilot foundation** — DEPLOYED + LIVE 2026-07-31 (`424747d`). Canonical tenant `presentation` (language/locale/currency/timezone/timeFormat/countryCode) on `settings/settings` + a public-safe root mirror, layered resolver (location → tenant → platform default) with a byte-identical functions twin; native i18n (no dependency, static dictionaries, EN complete fallback, measured TR coverage); brand protection + browser page-translation disabled on both app shells; tenant-timezone dates across the staff app (365-day UK regression anchor); owner-only Regional Settings enforced in `firestore.rules`; Turkish transactional emails; guarded idempotent `tr-demo` seed (LIVE). Existing UK tenants carry NO `presentation` key ⇒ platform default ⇒ unchanged (verified against all 6 live tenants). ⚠️ REMAINING: manual visual pass (incl. the Chrome auto-translate condition) — checklist in [TESTS.md](TESTS.md) §12, NOT yet done.
- ✅ **TR-C treatment session lifecycle + client recovery** — DEPLOYED + LIVE-VERIFIED 2026-07-31 (`d9856e5`; chain TR-A `424747d` → TR-C P1 `bc82454` → TR-B `c3716f7`). Versioned 9-state server-authoritative lifecycle (`in_progress` omitted — no surface writes it; `no_show` NON-terminal so a late arrival is correctable, reason-required + owner/admin + audited); deterministic continuity engine with per-flag evidence (**observations only — no churn score, no “will not return”**, enforced by a build-failing dictionary test in EN *and* TR); Client Recovery workspace at `/app/follow-ups`, dashboard cards whose counts are the SAME call as the list they open, client treatment-journey timeline. **Financial seam to TR-B is one enum** (`reserve|consume|release|none`) — TR-C names no money field and writes none of TR-B's collections; a full lifecycle leaves TR-B's `snapshot`/`financialCache`/`plan` byte-identical. Two contract corrections the cross-contract suite forced, both REMOVING a TR-C capability rather than keeping one that could lie: `cancelledConsumesSession` deleted (TR-B has no such verb), and a no-show correction no longer claims to restore an entitlement (TR-B's decision is final) — so *absent → corrected → completed* burns exactly ONE session. Also closed TR-B's reported gap: its two suites are now in the default Functions gate (742 → **816**). Gates: frontend **833** · functions **816** (0 fail) · emulator **105** incl. 15 cross-contract scenarios against the real TR-B executor · live `tr-demo` **37/37**, all synthetic data cleaned up. ⚠️ REMAINING: manual visual pass (Turkish `/app/follow-ups`) — checklist in [TESTS.md](TESTS.md) §14, NOT yet done. Design: [SESSION_LIFECYCLE.md](SESSION_LIFECYCLE.md) · market record: [TR_BEAUTY_MARKET_REQUIREMENTS.md](TR_BEAUTY_MARKET_REQUIREMENTS.md).
- ✅ **TR-B treatment packages, partial payments & open-account ledger** — DEPLOYED + LIVE-VERIFIED 2026-07-31 (`c3716f7`). Session packages sold against an **immutable price snapshot** (a Monday price rise cannot change what a Friday customer owes — proven live); pay in full / instalments / per session / arbitrary partial / open account; **append-only** `packageLedger` with `packageTotal = paid + outstanding + refunded` re-checked on every fold, never trusted from the cache; corrections are `REVERSAL`/`ADJUSTMENT` entries — there is no edit or delete action for anyone, including super-admin; entitlement consumed **exactly once by construction** (session doc ids are derived, so two devices contend for one Firestore path); tenant-configurable Payment settings, owner-only and enforced in `firestore.rules` beside `presentation` (one key added to an existing `hasAny()` — no new match block, zero blast radius). Loyalty: package payments earn **nothing** — a redeemed session is stamped `price: 0` at link time so the existing checkout, canonical receipt writer/reader and loyalty award are untouched (**not one line changed** in `firestoreActions.ts` / `receiptMath.ts` / `receipts/index.ts`) — ADR-021. Provider-neutral: no Stripe client, no `STRIPE_SECRET_KEY`, no simulated authorisation; every method is a manual record. Engine is a byte-identical twin pinned from both sides. 6 callables live (europe-west2); **72 engine + 27 emulator-concurrency + 20 frontend tests**, and **37 live assertions on `tr-demo`** (six concurrent identical payments → one ledger row; two payments that would overpay → exactly one refused; five concurrent completions → one session; all synthetic data removed, tenant restored). UK tenants unchanged **by construction** — `packageSettings` absent ⇒ feature dark (verified against all 6 live tenants). Docs: [TREATMENT_PACKAGE_SYSTEM.md](TREATMENT_PACKAGE_SYSTEM.md) · [PAYMENT_PLAN_ENGINE.md](PAYMENT_PLAN_ENGINE.md) · ADR-020/021 · INV-PARA-7…12. ⚠️ **REMAINING:** package selection inside `NewBookingSheet`/`WalkInFlow`; the custom-instalment UI (engine + callable already support it); Finance/Reports recognition of package revenue (needs a cash-received vs. delivered-value decision); `functions/package.json` test-glob registration (yielded to TR-C's claim).
- 🔄 **TR-B2 package booking UX, custom instalments & Finance/Reports** — Stage 1 DEPLOYED + LIVE-VERIFIED 2026-07-31 (`c5bd1dc`). **Package accounting** (`src/utils/packageAccounting.ts`, pure): cash received · delivered/earned value · outstanding · deferred · accrued · refunds, reported side by side and **never summed** — one ₺8.000 course paid in full and fully delivered is ₺8.000 of cash AND ₺8.000 earned, not ₺16.000 of anything. Every in-period flow is a **difference of cumulative folds** over TR-B's own `foldPackageLedger`, so reversal resolution and M1–M8 keep exactly ONE implementation; the deliberate consequence is that an August reversal of a July payment shows as negative cash in **August** (a closed period is never restated, and the periods sum exactly to the final balance). Delivered value allocates via TR-B's own `splitEvenly` — the remainder rule IS the instalment rule — over a base that includes audited `ADJUSTMENT`s, so a write-off restates the remaining sessions instead of leaving a package reporting more earned than it will ever bill. Where delivered exceeds collected it reports **ACCRUED**, never a negative deferral. Surface is a **Reports** tab, not Finance: `/app/finance` is gated to `tenantId === 'whitecross'` and `£`-hardcoded, so a Turkish salon can never open it — and leaving `Finance.tsx` out of the diff entirely is the strongest guarantee the `2a69735` date-selection fix is untouched (its Finance chunk is **byte-identical live vs local** once the entry-chunk filename is normalised; 23/23 tests green). Tab absent unless `packageSettings.enabled`; all four UK production tenants verified absent. Export rows state whether an amount is cash/delivered/outstanding/deferred/refund and carry minor units with a separate currency column. Tests: **41 new**, frontend **897/897**. Live `tr-demo`: **23/23** after correcting one stale assertion of mine — it had copied TR-B's "no live tenant carries `packageSettings`" baseline, which expired when `demo` deliberately opted in; it now asserts EFFECTIVE behaviour (whitecross + herohairs resolve disabled). All synthetic data removed, tenant restored. **Stage 2 DEPLOYED + LIVE-VERIFIED 2026-08-01** (`b0a2051`, **no Function deployed** — the server contract already backed both): catalogue **archive/restore** with Active/Archived/All filters — removal is a **reversible archive, never a delete**, and no Firestore delete permission was added; archiving closes a definition to NEW sales only, proven live by delivering a session and recording a payment on an already-sold package *while its definition was archived*, with its snapshot/plan/financialCache byte-identical. Restore reuses the same definition id. Archive-vs-sale was already resolved inside `sellPackageCore`'s transaction, so a stale browser cannot sell an archived package and no second callable was invented. Plus the **custom instalment editor** over the existing engine: rows must reconcile EXACTLY, under-allocation is refused rather than silently becoming an open balance (that is the `OPEN` arrangement, by name), and every plan the editor accepts the engine accepts. **Post-sale plan editing is deliberately NOT implemented** rather than faked — the executor exposes no verb for it. Tests 19 new, frontend **916/916**; live `tr-demo` **35/35**, all synthetic data removed. ⏳ Package accounting is live in Reports for package-enabled tenants; the legacy Finance page remains Whitecross-specific and making Finance tenant-generic is a separate TR-D/platform task. **Stage 3 DEPLOYED + LIVE-VERIFIED 2026-08-01** (`b40e182`, no Function deployed): **package selection in the admin booking form, the admin walk-in form and both Staff App sheets**, through one shared picker. The finding that shaped it: the executor stamps `price: 0` + `packagePrepaid` **only** on the transition to `scheduled`, so a walk-in redeemed straight to `complete` would consume the entitlement while leaving the booking at full price — charging the client a second time for a session they had already bought AND awarding loyalty on it. Not a TR-B bug: the `(none) → completed` shortcut is for redemptions with NO booking. So `linkBookingToPackage` always **reserves then completes**, in one function rather than four call sites — which is also why no checkout, receipt or loyalty code needed changing. Proven live with a **negative control** (complete-without-reserve leaves the booking at full price). Customer-first: the picker renders nothing until a client is RESOLVED, so an anonymous walk-in never sees it. A covered session leaves the staff cart total; add-ons and products stay chargeable. Outstanding debt is shown, never auto-collected. `createWalkInDetailed` returns the Firestore doc id the derived session id needs; `createWalkIn` is a thin wrapper so no caller changed. Gates: frontend **953** · functions **816** (0 fail) · emulator **105** · live `tr-demo` **29/29**, all synthetic data removed. `hosting:salown-staff` deployed and **byte-identical to the tested tracked bundle** — the Stage-1 staff drift is cleared. **Stage 4 DEPLOYED + LIVE 2026-08-01** (`a5b6f20`, information architecture only — no Function, no collection, no callable, no continuity calculation and no authorization rule touched; the Segments screen is NOT redesigned and gains no cards): **Follow-ups is now a VIEW of Clients**, a third option in the existing segmented control (`All Clients | Segments | Follow-ups` · `Tüm Müşteriler | Segmentler | Takip Listesi`), with `+ Add Client` left outside it as the primary action. The TR-C workspace component is reused unchanged and lazily loaded. View state moved into the URL (`?view=`) because a bookmark, a Dashboard card that opens the list already filtered, and refresh/Back all depend on it and none survives `useState`; the flag filter keeps TR-C's existing `?flag=` parameter rather than inventing a second convention. `/app/follow-ups` survives as a **redirect, not a second mount** — there is now exactly one `<FollowUps>` in the codebase and one primary nav entry. 16 routing tests; frontend **969/969**, TR-C's 111 re-run green. ⚠️ REMAINING: manual visual pass — checklist in [TESTS.md](TESTS.md) §15.
- ✅ **Pre-TR-D IA remediation — package catalogue under Services** — DEPLOYED + LIVE-VERIFIED 2026-08-01 (`58624ea`). The pre-TR-D audit found a **SOURCE GAP**: `a5b6f20` reported the IA work complete but left **Packages as a top-level sidebar item**, in source *and* production — source and live agreed with each other and disagreed with the report, so only opening the app revealed it. The catalogue is configuration ("what does this salon sell?", the same question Services answers about single treatments), so Services gained a URL-backed `Services | Packages` control (`?view=packages`) mounting the existing Packages page **unchanged and lazily**; the top-level item is gone and `/app/packages` is a compatibility redirect, **not** a second mount. Authorization follows Services: `OWNER_ONLY` was **not** weakened, and the Services **route** is now gated so an unauthorized URL cannot open configuration. ⚠️ **Consequence:** reception loses the Packages page's *sold* list; they keep package selection in booking/walk-in and remaining-sessions/balance on the Staff App client card. The navigation contract is now **test-asserted against the source**, so a future report claiming a completed move fails a test rather than reaching the owner. 24 tests; frontend **993/993**; `hosting:salown` only — no Functions, rules, or staff deploy. ⚠️ REMAINING: desktop visual pass (Chrome extension unavailable here) — [TESTS.md](TESTS.md) §16.
- 🔄 **TR-D1 in-salon checkout (TR tenders, split, partial, unpaid, taksit, receivables)** — Phase 0.5 ✅ DEPLOYED 2026-08-01 (`5926c1c`, an EXISTING split-payment report defect, not introduced by TR-D1) · Phase 1 ✅ pushed `2eb8587` (checkoutSettings contract + pure tender engine + the generic B2 receivable fold, strategy-B logical extraction) · Phase 2A ✅ pushed `f70a35d` (`packageSessionTx` — the entitlement body split out of its own transaction so a checkout can consume a session and complete a booking in ONE atomic commit; behaviour-neutral, 12 seam tests, exactly ONE entitlement implementation) · **Phase 2B ✅ DEPLOYED + LIVE-VERIFIED 2026-08-02 (`ceb5316`)** — the server-authoritative checkout executor and one new callable `salownCheckoutBooking`, **deployed and deliberately UNREACHABLE**: no UI calls it, no hosting deployed, no rules changed, and a tenant without `checkoutSettings` fails closed with `CHECKOUT_DISABLED` (verified live before enabling). ONE transaction covers booking state, canonical tender allocations, the intent/result record, client statistics, the loyalty delta, the receipt snapshot, the ordinary receivable and its schedule, the deterministic product-only sale, and the package entitlement through the 2A seam — the package **callable** is never invoked. **The two taksit are modelled as different debts**: Kart Taksiti is owed to the BANK (no salon receivable; provider/count/commission-bp/fee/expected-settlement snapshotted) while Salon Taksit Planı is owed to the SALON (ordinary receivable + real schedule); collapsing them would make every settlement reconciliation and every debtor list wrong in a different direction. Client submits INTENT ONLY — a submitted product price is REJECTED, not ignored; currency is not a request field and resolves from the tenant's own `presentation` (TR→TRY, UK→GBP, never from IP). Loyalty reuses the canonical `computeEarnBase_p`/`expectedPointsFor` as **byte-proven twins** (the suite compares both files character for character), capped by what was actually COLLECTED — full payment is byte-identical to today's award, partial earns on what was taken, unpaid earns zero, package-prepaid earns zero. **Two real defects the suites caught and killed before commit:** a refusal sited after the package seam would have committed an entitlement consumption with no checkout attached (Firestore does not abort on a returned rejection — every refusal moved ahead of the seam, with a static test forbidding the regression), and a product-only sale computed and STORED 100 loyalty points it never granted. **Product stock deliberately deferred (inventory audit result I2):** catalogue price and active/`inStock` are authoritative, `stockQty` is neither read for admission nor decremented — a stock figure nothing maintains is worse than none; `inventorySaleTx` extraction is the prerequisite for enabling it. Gates: functions **861** (was 828) · emulator **147/147** (was 105) · frontend **1069** unchanged · rules **154/154** (was 145; +9 pinning that the catch-all still denies client writes to the new financial collections — **no rules change was made**) · live `tr-demo` **28/28**, all synthetic data removed and `settings/settings` restored sha256-identical. Docs: [TR_CHECKOUT_ARCHITECTURE.md](TR_CHECKOUT_ARCHITECTURE.md) · [PAYMENT_SETTINGS.md](PAYMENT_SETTINGS.md) · [TESTS.md §20](TESTS.md). **Phase 3 ✅ DEPLOYED + LIVE-VERIFIED 2026-08-02 (`8239620`)** — the owner's Payment Settings for the private `checkoutSettings` contract, plus ONE new callable `salownSaveCheckoutSettings` and **the first `firestore.rules` release since TR-A**. The executor was NOT touched and NOT redeployed (`salowncheckoutbooking-00001-taf` unchanged; its Phase 1 parity core is byte-for-byte as deployed, which is why the new strict validator lives in a separate twin). Settings joins the EXISTING Payment settings tab beside TR-B rather than taking a sidebar entry. **The rules gap Phase 1 left open on purpose is closed**: `checkoutSettings` joined `presentation`/`packageSettings` in the owner-only `hasAny()` list — one key, no new match block, read rule untouched — so an ADMIN can no longer edit the switches that decide who may create salon debt. **The staleness gate became real**: the stored `schemaVersion` is now the monotonic settings version (the contract version moved to `contractVersion`), because the deployed executor already compares exactly that field and a tidier separate `revision` would have been enforced by nothing; the same number is optimistic concurrency on the write path (`SETTINGS_VERSION_CONFLICT`). READ stays lenient, WRITE is strict — unknown keys, coercions, float basis points, duplicate provider ids, unsupported instalment counts and archived-but-enabled providers are all refused rather than repaired. Providers are **archived, never deleted** (their id is snapshotted into historical `BankInstalmentMeta`). Defaults unchanged and load-bearing: absent `checkoutSettings` = today's UK behaviour, feature dark, every debt-producing capability off; **no backfill**, and the conservative TR template is offered into the form but never silently written. Gates: frontend **1185** (+87) · functions **877 pass/0 fail** (+13) · emulator **165/165** (+18) · rules **170/170** (+16) · live `tr-demo` **22/22** with the tenant restored byte-exactly and its two synthetic staff docs removed; ~~`whitecross`/`herohairs`/`demo`/`tr-demo` all still have `checkoutSettings` ABSENT~~ — **CORRECTED 2026-08-02:** true at Phase 3 verification and false within the hour. `whitecross`/`herohairs`/`tr-demo` are ABSENT; **`demo` is PRESENT, `enabled: true`, `mode: tr`** by owner decision (persistent Turkish sales demo). Per-tenant truth now lives in ONE place: [TENANTS.md](TENANTS.md#demo--verification-tenants). **Phase 3B ✅ DEPLOYED 2026-08-02 (`ecb6d93`, `hosting:salown` only)** — the Phase 3 visual review FAILED (a UK owner met the whole Turkey-native form with everything merely disabled) and this is the fix: regional disclosure + progressive sections, **presentation only**, no Function/rules/shared-schema file touched. UK/non-TR gets one regional line; a non-TR tenant with an ENABLED stored config is deliberately NOT hidden (live policy → warning + inspect + disable, nothing discarded); TR gets summary-first with sections revealed only when they mean something, and version/contract noise behind Technical details. Debt switches now need an out-loud confirmation, ON only. Treatment packages compact when selling is off, every control unchanged when on — **packages are NOT made TR-only**, the panel never reads `countryCode`. Load-bearing property: **hiding a control never changes a stored value** — hidden permissions and provider terms are still submitted, and collapsing a section cannot dirty the page; Save payload byte-identical to Phase 3. Gates: frontend **1229** (+44) · typecheck + build clean · **lint delta zero** · deployed chunk byte-identical to the local build, shipped decision table executed across all five tenant shapes · `tr-demo` Save still reaches the deployed callable, restored byte-exactly. ✅ **Owner-confirmed visually on the live release 2026-08-02** — the Phase 3 review that failed is closed (no per-width 320/360/390/430 matrix was walked; Chrome extension was disconnected). ✅ **P0 CLOSED 2026-08-03 (`a240925`, `hosting:salown` `9cdeb39163cc258e`)** — choosing a package now brings its covered service into the cart, so Save is reachable. The mapping is READ from the sale snapshot (`allowedServiceIds`, else `serviceId`) and never inferred; an unmappable package is refused with an actionable message rather than matched by name, because a fuzzy match would burn a paid session off the wrong client's course. Multi-service packages ask; they never auto-pick. `PackagePicker` gained an OPT-IN `autoLinkService` prop defaulting to false, so both Staff sheets are behaviour-unchanged and their cutover stays its own package. **Admin TR checkout is also cut over** to the deployed `salownCheckoutBooking` for TR tenants (today: `demo` only), with payment summary, part payment and leave-unpaid, methods derived from `checkoutSettings`. **⚠️ The live UI pass on `demo` is OUTSTANDING** (browser unavailable) — see DEPLOYMENT_STATUS. **🔴 One live incident:** a settings-load gate disabled the whitecross Checkout button for ~75 minutes; repaired, INCIDENTS 2026-08-03.
- 🔄 **Admin TR Checkout Unit 8 — currency-grouped Reports** — ✅ **DEPLOYED 2026-08-05** (`bf62745`, `hosting:salown` `da6d0a281e42e3c4` → **`452e75959e3131ea`**). Reports folds one group per currency from the canonical `checkoutReceipt` in integer minor units and **never sums across currencies** — structurally, not by care: every accumulator sits inside a currency-keyed group, the function returns a list, and no grand total exists for a caller to reach for. No exchange rate anywhere; salOWN has no rate source and a converted figure would be a fabricated number wearing a currency symbol. Digits follow the READER's locale, the symbol follows the MONEY (`narrowSymbol` → `₺1,234.50` to a UK reader, not Intl's default `TRY 1,234.50`). The Unit 7B exclusion funnel is unchanged — non-GBP still leaves every £ aggregate — so the banner was *replaced*, not weakened: the money it hid is now reported in its own currency, in its own box. A GBP group can never appear in the panel (its input is the funnel's reject pile), so the screen cannot show two competing £ totals. **GBP unchanged, verified against production**: whitecross 1429 checked-out sales / 0 foreign, herohairs 130 / 0 → panel renders `null`; and rebuilding 7B locally reproduced the exact chunk that had been live, whose £-literal set differs only by the retired banner. Gates: currencyGroups 20 · reportsCurrency 20 · frontend **1602**. **⏸️ THE TRY RENDERING IS NOT PROVEN IN PRODUCTION** — a read-only sweep of all six tenants found **zero** `checkoutReceipt` documents and tr-demo has no checked-out sales, because the **TR payment integrity hold is active**. That proof is **carried into Unit 11 controlled E2E, after hold-removal approval**. It will NOT be closed by fabricating production data or by lifting the hold to manufacture a sale. **Unit 7S stays DEFERRED** to the Staff Checkout package (`SalesView` ships on `hosting:salown-staff`, a target this programme does not deploy).
- ✅ **Admin TR Checkout Unit 9 — terminology + localization — DEPLOYED + LIVE 2026-08-05** (9a `3c10b99` + `310dcff` + `b348cb7`; 9b `943f859`). ⚠️ **Status corrected 2026-08-10: this line read "PUSHED AND TESTED, NOT DEPLOYED" and had been false since the day it was written.** Unit 9 shipped **combined with DPPP** in the owner-ordered coordinated release later the same day — `hosting:salown` `452e75959e3131ea` → **`838faa77330f8574`** (`2026-08-05T11:48:43.348Z`), alongside the whitecross campaign `multiplier` migration, a `firestore.rules` release and exactly four targeted Functions; the live chunk `index-CIYwq4Bf.js` was byte-identical to the local build. `hosting:salown-staff` stayed at `8409e666da7ea223` as required. The owner's "Unit 9 ships as ONE release" decision was honoured — it was one release, just not a Unit-9-only one. **Still outstanding from that release:** no end-to-end live test — the first real online booking should be checked for `loyaltyPromotionSnapshot`, and its confirmation-email points figure compared against what checkout awards. Full deploy record: [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md). Owner decision: Unit 9 ships as **ONE** release, so no partial terminology change reaches a salon. Closes a defect that was live for **every** tenant: `checkout.till.prepaidPlatformShort` had a call site in `CheckoutPanel` and existed in **no dictionary**, so `t()` fell through to `humanizeKey` and the till printed the literal words *"Prepaid platform short"* — to UK salons as much as Turkish ones. The existing suite could not see it because it proves **en↔tr key parity**, and parity compares the dictionaries to each other; it never asks what the code calls, so symmetric absence looks exactly like symmetric presence. The new guard scans the checkout **sources**, extracts every key passed to `t()`, and requires it to resolve in both languages — **mutation-proven**: deleting the key turns it red and names it. **Terminology:** the TR summary called a debt *"Müşteri bakiyesi"*, but Turkish `bakiye` is **direction-free** — money the client is owed reads identically to money the client owes — so the one row whose purpose is to say a receivable was just created could not say it (the English beside it is "Client still owes"). Now *"Müşterinin kalan borcu"*, the same word the package screens already use (`packages.money.outstanding` = "Kalan borç"): one debt, one name, whichever screen the owner opened. **`CurrencyTotalsPanel`** — Unit 8's box, the only screen a Turkish salon reads its own takings on — shipped 100% hardcoded English **including an English plural rule (`count === 1 ? 'sale' : 'sales'`) applied to every language**; now fully translated with the count through `Intl.PluralRules`. The scope sentence is split **lead + emphasised clause**, not lead+noun+tail, because Turkish puts the verb last ("yalnızca GBP satışlarını **kapsar**") — a three-fragment split would impose English word order on Turkish, the exact failure this unit exists to prevent. **No currency is written into copy:** "GBP" is interpolated from a named constant (a fact about the DATA — the 7B funnel — not about the language) and the empty-GBP zero comes from the canonical formatter, so it renders `£0.00` to a UK reader and `£0,00` to a Turkish one. **UK output unchanged, structurally:** the one reworded English sentence sits on a branch reachable only with foreign-currency groups **and** zero GBP sales; whitecross (1429/0) and herohairs (130/0) produce no groups, so `groups.length === 0` returns `null` and neither tenant can reach any string on the panel — that early return is now test-pinned. Gates: frontend **1679** (74 files) · typecheck 0 · build 0 · release-guard 16/16 · no `hosting/**` drift from `npm run build`. **⚠️ A CORRECTION IS PART OF THIS RECORD (`b348cb7`).** 9a first claimed English output was unchanged *because whitecross (1429/0) and herohairs (130/0) cannot reach the branch*. The sentence HAD changed (`every £ figure below` → `every figure below`), and today's data is not a contract — one foreign-currency sale makes it reachable. **"Unreachable" is a fact about the rows in Firestore this morning; "unchanged" is a fact about the product.** Fixed by resolving the symbol from Intl and interpolating it, so the rendered English is character-identical while no `£` exists in any dictionary; asserted on the RENDER (the real component through a real `LocaleProvider`, with a foreign group present so the branch actually executes), English and Turkish independently, and mutation-proven.

  **Unit 9b (`943f859`) closed the half 9a yielded**, once `DOUBLE-POINTS-STAGE2` released `CheckoutPanel.tsx` (which it had claimed defensively and never edited — verified, last real change was Unit 6 `fa8dea2`). The headline defect: the till rendered TR money as `₺${(v / 100).toFixed(2)}` — hardcoded symbol, hardcoded divisor, **English decimal point** — on the one screen whose operator types Turkish, while `parseMinorUnits` on the way IN already read `1.234,50` correctly (the A1c note records the fifty-kuruş ledger drift from when it did not). **The screen accepted Turkish and answered in English.** ~28 emission sites now go through one `useTillMoney()` hook bound to the tenant's presentation — symbol follows the MONEY, digits follow the READER, and the TR summary formats in the SALE's currency, not the reader's. ~30 hardcoded English till strings moved into the dictionary **verbatim**, with every English result asserted character for character. Turkish written for a salon desk: "Kapora ödendi" (not "depozito", which means a refundable security deposit), "Randevusuz", `%10` where English writes `10%`, verb last, and a confirm button saying the operator **collects** ("₺500,00 tahsil et") rather than telling the client to pay. **Deliberately NOT moved:** the `discountType` `'%'`/`'£'` TOKENS (compared in code — translating them would be a schema change wearing a translation's clothes), the `.replace('£','')` readers of STORED data (the known stored-money leak, a migration), and `£{basePrice}`'s digit count ("£25", not "£25.00" — renormalising English output is a Unit 10 decision). **⚠️ ONE DECLARED UK RENDERING DIFFERENCE, pinned by its own test:** at and above 1000, `.toFixed(2)` does not group and Intl does, so `£1234.50` → `£1,234.50`. Same amount; the till now matches Reports, which has grouped since Unit 8; unavoidable, because suppressing grouping would also produce `₺1234,50`, which is simply wrong. Below 1000 — every ordinary checkout — output is character-identical, asserted across a value table. Gates: frontend **1705** · typecheck 0 · build 0 · lint clean · release guard OK · no `hosting/**` drift. `Reports.tsx` is **out of scope by design**: its `£` aggregates are GBP by construction (the 7B funnel), so those literals are correct, not defects. Finance, `src/staff/**`, functions, rules and indexes untouched; **TR payment integrity hold preserved**. ~~Awaiting approval for `hosting:salown` only; rollback anchor `da6d0a281e42e3c4`; Staff frozen at `8409e666da7ea223` / `staff-CU9kxXXw.js`.~~ → **Approved and released the same day inside the DPPP wave** (see the corrected headline above); rollback anchor became `452e75959e3131ea`. Staff has since moved on its own account (2026-08-09 PSA2, now `d8de0132fd465ef9` / `staff-BALp7dqM.js`).
- 🔵 **Unit 11 controlled E2E (TR) — after hold-removal approval** — carries the one thing Unit 8 could not prove: a **real TRY checkout rendered on screen**, end to end, so the grouped panel is verified against money the executor actually wrote rather than against fixtures. Prerequisite: explicit approval to lift the TR payment integrity hold. Until then Unit 8's TRY path is *shipped, tested, unexercised in production* and must be described that way — see [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md) and [TESTS.md](TESTS.md).
- ✅ **TR-P1 Admin localization Phase 1 — DEPLOYED + LIVE 2026-08-09** (`8fa75c6`; `hosting:salown` `f35a939ea269aba6` → **`81fe195d535f9c5d`**, `2026-08-09T22:20:10Z`, authenticated UI verified). The primary Admin journey — nav, Home, Calendar controls, the Clients/Services/Products landings and the shared states — reads in the tenant's language. Recorded in `SYNC.md`; **not yet written up in [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md)**. **Phase 2 owns** the Home stat cards (still `£0` / `£1,500`, English).
- 🔄 **TR-CURRENCY — money reads in the tenant's own currency.** The defect this series exists to kill is not cosmetic: the **numbers were never converted, only the symbol lied**, so a ₺13 shampoo read "£13.00" and was sold at that label without anything ever *looking* broken. Two rules came out of it and now apply everywhere: **a real zero is a real price and must survive** (`£0.00`), and **an unreadable price is returned verbatim** (`"TBC"` stays `TBC`) — never coerced into a plausible `£0.00` a till would charge. `Number(price) || 0` and `parseFloat(x) || 0` are forbidden in this area for exactly that reason.
  - ✅ **A + C** (`53ffe30`) Services/Products card price + Barbers revenue chip · ✅ **D** (`f5a79bf`) locale-aware price *entry* (the write side: `type="number"` rejected `12,99` outright, and a comma reaching Firestore would have been read as **1299** — a plausible 100×) · ✅ **E** (`e850820`) ProductSelector line + cart total, moved **together** because a `₺13,00` line under a `£26.00` total looks like a completed FX conversion and is worse than where we started. All three **DEPLOYED + LIVE 2026-08-10**, `hosting:salown` `81fe195d535f9c5d` → **`0d42517d7cba104a`**, authenticated TRY pass done. One accepted UK-visible difference: Intl always gives GBP two fraction digits, so Services cards read `£25.00` and the Barbers chip gained pence.
  - ✅ **F** (`fca8054`) Products page cart — basket button, line, `Total:` — **DEPLOYED + LIVE 2026-08-10**, `0d42517d7cba104a` → **`ffbc7898e4a8556e`**; runtime hardcoded pounds in `Products.tsx` **3 → 0**, and the built chunk contains **zero** `£`. ⚠️ **The GBP authenticated pass was not run** (no authenticated UK session existed); GBP is proven statically only.
  - ✅ **G** (`d726b1b`) public `/s/**` salon-page prices — **`LIVE_VERIFIED`.** ⚠️ *Status corrected 2026-08-12: this line read "ON `main`, NOT DEPLOYED", which was already false when written — G shipped in ADMIN-PENDING-SLICES-RELEASE (`3a0fcdea1e1f8434`, 2026-08-10T13:29:31Z), as [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md) recorded and this file did not.* Proven from production: the served entry chunk renders `` · from ${…formatMoney(t)}`` and contains no `from £${minPrice}`. Evidence chain: commit `d726b1b` + claim release `d557522` + the release row + the served byte.
  - 🔵 **Remaining hardcoded surfaces, grouped honestly** — ① **calculation / persistence**: none known open in the Product path after D (entry now normalises to canonical dot-decimal MAJOR units); the **stored-money leak** (`.replace('£','')` readers of stored data) is a **migration**, not a formatting fix, and is untouched. ② **Finance**: `/app/finance` is gated to `tenantId === 'whitecross'` and `£`-hardcoded — a Turkish salon can never open it; making Finance tenant-generic is a separate platform task. ③ **Reports**: its `£` aggregates are GBP **by construction** (the Unit 7B funnel), so those literals are correct, not defects. ④ **Staff**: `src/staff/**` untouched by this series; Unit 7S is deferred to the Staff Checkout package (`SalesView` ships on `hosting:salown-staff`, a target this programme does not deploy). ⑤ **Public**: closed by G, pending its release. ⑥ **Admin remainder**: `BookingDetailPanel.tsx` — **51 sites, no `useLocale` at all**, the largest single block left — and the Home stat cards (TR-P1 Phase 2). *(Repo-wide there were ~412 non-comment hardcoded `£` at the 2026-08-09 count; that number is a scale indicator, not a work list.)*
- 🔵 **TR-B/TR-C follow-on** — online-booking settings editor (the `onlineBooking` Settings tab is still a read-only shell). A TR-resident PSP for online card payment remains out of scope; salOWN never shares a Stripe key.
- 🗄️ **L1 TR localization — SUPERSEDED, kept as the historical gap analysis.** ⚠️ *Reclassified 2026-08-12: it carried a 💡 Future label, which made the delivered TR programme (TR-A/B/B2/C/D1, Units 4–9, TR-P1, TR-CURRENCY A–G, TR-STAFF-L10N — all LIVE) read as unstarted from a skim.* Items 1–4 were delivered by TR-A; what genuinely remains is tracked as `TR-P2`, `TR-U11` and KVKK in ROADMAP §6. Original gap analysis ✅ 2026-07-23: zero i18n infra; ~1,500–2,000 hardcoded EN strings, 486 `£`, 110 `'en-GB'`, ~45 `Europe/London`, no tenant `language`/`currency`/`timezone` field (the foundational blocker). Sequence: tenant locale triplet → central money/date formatters (incl. `£`-in-stored-data fix) → i18n + string extraction (customer-facing first) → email `lang` → tz/DST → small items. Minimum TR pilot = locale fields + formatters + booking SPA/email translation (panel may stay EN). Parser explicitly out of TR scope (owner 2026-07-23: no parsers in TR; iCal feed instead). Full analysis: [TR_LOCALIZATION_PLAN.md](TR_LOCALIZATION_PLAN.md).

---

## 🧪 Test Lists → [TESTS.md](TESTS.md)
All test records in one place: Firestore Rules (automatic, latest ✅ **170/170** — *corrected 2026-08-10; this line said 145/145, which was the count before TR-D1 Phase 2B took it to 154 and Phase 3 to 170*) · Security gate manual · Stripe live (TEST) · Staff App · Post-Class-A · Busy-slot v2.

**Gate sizes at this snapshot** (for spotting a suite that quietly stopped running): frontend **2278/2278** · functions **1244 pass / 0 fail / 31 skip** · emulator **419/419** (version-pinned, EMU-TX-FLAKE-1 `c6a5c79`) · rules **170/170** · `deploy-policy` 28/28 · `release-guard` OK.

---

# ✅ Completed (archive)

> The detail + commits of each ✅ in the active themes; dated tables at the very bottom.

### 🗓️ 2026-08 — the August wave *(added 2026-08-10; this work had shipped without ever appearing on the roadmap)*

Each of these is deployed and verified unless the line says otherwise. Grouped so the top-level index
above has something to point at; the narrative record is `salown-app/SYNC.md` and the push-vs-live
record is [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md).

- **Server-authoritative write path (the "O1" series).** O1A canonical staff-eligibility validator + walk-in/reassign cores and their callables (`a3f219e`/`8746201`, deployed 2026-08-05) · **O1C Admin cutover LIVE** 2026-08-06 (`63efafc`, `hosting:salown` `838faa77330f8574` → `73f57ac0dd04b54a`) · **O1AB** `salownCreateAdminBooking` deployed (`788f13d`) · **O1P** transactional import-assignment across all 4 parsers + fail-closed empty-roster (`08914a9`/`e803106`), **3 named parser Functions deployed** 2026-08-06 (`cf60dace` → `4f467666`, exactly 3 revisions changed of 106) · **O1S** staff walk-in create cutover `234441d` — **`LIVE_VERIFIED` 2026-08-12** (the 2026-08-10 *classification owed* note is closed: the served `staff-BhghYLPT.js` is byte-identical to the tracked bundle committed at `eac5a95`, of which `234441d` is an ancestor, and carries `salownCreateWalkIn` with no bare `createWalkIn`) — and future-booking core `e428124`, still **`PUSHED_NOT_LIVE`** · **PANEL-SOURCE-PARITY-A** canonical Panel source across the Admin UI, LIVE 2026-08-06 (`34a7e4b`).
- **Product-sale authority (PSA).** PSA1 server core (`4cbd84d`) → PSA2 reader parity (`f9b7301`/`4d243e2`) → **Admin cutover LIVE + E2E** 2026-08-09 (`d9e7684`) → Staff cutover shipped, **found broken in E2E and rolled back within ~6 minutes** (`f2426b6` → `cfe60cf`) → root cause fixed and **Staff re-cut, LIVE + E2E** 2026-08-09 (`509e63e`, Staff `staff-DPP2bVf5.js` → `staff-BALp7dqM.js`). **The lesson of record:** the Staff cart was building "Products" out of the **services** collection and sending a *service* doc id where the callable resolves `tenants/{tid}/products/{productId}` — every test verified the **call** (payload shape, which callable, no fallback) and none verified that the id space the UI produces is the id space the server resolves. Gates were green and the code was still wrong. Blast radius was provably zero (no tenant has a `Products`-category service), and no migration was needed.
- **Loyalty / double points (DPPP).** One server-owned promotion snapshot consumed everywhere (`0a5aa14`), released 2026-08-05 with the whitecross campaign `multiplier` migration, a `firestore.rules` release forbidding a client-written `loyaltyPromotionSnapshot` (`80dcda7`), four targeted Functions and `hosting:salown`. **Rules went FIRST, deliberately inverting the house order**, because the change only *forbids* a key no legitimate writer sends. Also: the promotion snapshot no longer depends on the email (`12185e7`), and `REVIEW-CTA-AUDIENCE-1` stopped offering members points for a Google review (`280cdb5`).
- **Finance.** **STAFF-FINANCE-GHOST-WAGE-P0** removed the invented £100/day wage for barbers missing from `partnerConfig` (`5746237`), LIVE 2026-08-08 and independently re-verified from a second machine as already live (30/30 assets byte-identical, ghost `?100:0 = 0`). **ADMIN-SALES-FILTER-1** made Admin Sales period-accurate and timezone-correct on one dataset (`571ab9d`), LIVE 2026-08-06 — **live UI pass still outstanding**.
- **Ops / release safety.** **CI-HOSTING-SCOPE-P0** — CI hosting deploys now name **one** target behind a fail-closed path allow-list (`d304541`, 2026-08-08), which is the structural answer to "a push released a site nobody meant to release". The release guard now refuses **every** untagged commit, not just shipped-path ones (`a8c49f5`). **EMU-TX-FLAKE-1** (`c6a5c79`, 2026-08-10) pinned the Firestore emulator the canonical gate is proven against: the 418/419 flake was the **emulator**, not the product — under contention it ended a blocked *read* on an open transaction with `3 INVALID_ARGUMENT` instead of a retryable `10 ABORTED`, so pure contention was classified permanent. Isolated version probe: emulator v1.20.4 failed at round 30; v1.22.0 passed 150/150 while contending *more*. Production never produced that signature (30 days of read-only Cloud Logging, all booking/checkout callables: 0 results). **The 2026-08-04 two-phase-split rationale was wrong and is corrected in [TESTS.md](TESTS.md).**
- **Isolated-clone deploys.** Both 2026-08-10 releases were built and shipped from a **disposable clone pinned to a commit**, because `firebase.json`'s predeploy hook builds from the *current* tree and a concurrent session had uncommitted edits in shared files. An in-place deploy would have published another session's unreviewed work. Side effect worth keeping: **REL-1 never fired** — the staff predeploy hook ran inside the clone, so the tracked `hosting/staff-bundle/**` stayed clean. That is a candidate fix for REL-1 itself.

### 🔒 Security & Rules
Tier 1 gate: Gate-G1 role-claim (`0f8de7e`, `tenantRole==null→admin` fallback removed, 49/49) · Gate-G2 bookings read tenant-scoped (`851efeb`, ruleset `22bdc429`) · Gate-G3 public-create financial forge guard (`851efeb`) · Gate-G4 staff-doc catch-all→false + 14 collections explicit (`0f8de7e`). Follow-up: T-a1 delete=super (`7e95d40`, AppRouter hardcoded `isAdmin=true` wired to the real claim) · T-a2 admin role-based (`643c8ce`, AuthContext exposes tenantRole) · T-d self-escalate behind super (`643c8ce`). Delete=super/owner: `694a762` (super-only, 65/65) → E1b owner tenant-scoped (`8670051`, ruleset `1a818130`, 81/81, 9 collections) → E1b+ barbers (`2af303c`, 83/83) + strong confirmation modal + '✓ Activate' (`25e6407`). Phase 1 cross-tenant hole (`ef31d16a`, 16/16, `firestore.rules` canonical).

### 👥 Employment Model & Staff (S + G4 + G5)
S2 Phase B: Staff Hub UI 12 commits (`c1103af..b7208a7`) + rules deploy (ruleset `1474907b`, staffComp=owner+super, 95/95) — tabbed drawer, PayModelChip, CompChangeFlow, wage hour..year + actual-work accrual semantics, paid-leave toggle, passive=close-comp-period, compUtils/staffCompActions unit-tested (59/59). S1 hole 1 barberName snapshot (`0db230c`). G4 weekly wages ledger (`1405020`, Mon–Sun carry-over ledger, pure-derivation, Arda £87-carry verified). G5 staff availability overhaul (owner "total chaos"): 2a-extra public projection `salownRepublishOnSettingsEdit` (`81f2824`) · 2a resolver shiftChange override (`282e5ae`) · 2b+3 Dashboard/BookingPage leave (`ca82f76`, returns automatically when leave ends) · step 4 server reschedule leave-guard (`2af65a0`) · step 5 semantic merge OVERRIDE WINS 5 surfaces (`e68dca8`) + Finance daily P/L leave-guard (`4b7b592`) + leave-history archive `barber.leaves[]` (`3898eb0`) · whitecross-site resolver port (`bc2f98ef`) · cycleStatus leave protection + audit (`b582042`). Muhamed on-leave case [STAFF_SETTINGS_AUDIT.md](STAFF_SETTINGS_AUDIT.md).

### 💳 Payments (A2, TEST mode)
Phase 0 onboarding `salownConnect{Start,Callback,Disconnect,Status}` (OAuth, tenant secret NEVER stored, only `acct_`) · Phase 1 Checkout `salownCreateCheckoutSession` + parallel `salownConnectWebhook` (`863e3db`, amount on the server, Direct charge, cross-check) · UI "Online payments" card (`8747fea`, mode selector + default deposit £ + gate) · Phase 2 policy · Phase 3 refund + configurable windows (`e3221cd`, `cancellationWindowHours`/`rescheduleWindowHours`). Owner verified all modes end-to-end in TEST (2026-07-04). whitecross-site's old Payment Link model (Phase 5) is live but Connect is retiring it.

### 📣 Marketing
C1 redesign Stage 1+2 (`3e26610`/`2ce03b1`, landing zone A-D + Templates + Compose 4-step) · re-engagement attribution (`ef7f751`) · discount codes 4 phases (`3c6c81d`/`e3841f7`/`c932ccf`/`fe875aa`, in-salon+online same code) · C2 premium campaign email (`82e86d6`) + C2b compose preview (`1e81915`) + C2c per-client preview DRY util (`42cd5d4`) · C5 lapsed dedup (`3c4039f`) + C5-A booking-only (`5fa051a`) + C5-B bulk stamp (`1bf3416`) · Marketing Performance card (`5218d91`, recovered revenue/returned/redeemed) · email open/click tracking `salownBrevoWebhook`→`emailEvents` (`c87c883`/`7730e7f`) · Marketing↔Analytics split Slice 1 Occupancy (`e8e57b5`) + Slice 2 campaigns-first (`5f4c874`) + Slice 3a Customers→Reports (`b9c5b2e`) + Slice 3b Overview→Insights, Marketing=campaigns (`5744937`, C6 effectively done) + client-identity SSOT (`eca8cc8`) + filter-scope clarity (`1fb9b28`) + orphan helper cleanup (`28bf376`). C9 Phase 1 client card lifetime+trusted (`70247f0`).

### 🤖 AI
C10 accuracy pack buildContext DAILY TOTALS+DEFINITIONS + chat history + askAI auth guard (`1bd0885`/`695a61f`) · productGuide.ts sitemap+how-to (`58668af`).

### 🎫 Onboarding & Parser Pipeline (H)
H1 `addToWaitlist` intake (`a2689f9`) · H2 P1 hide self-signup + P2 full form + P3 Applications tab `approveApplication`+`adminPurgeTenant` (`ae495a1`/`57e3959`) + approve 2 bug fixes (domain fallback + claim-clobber guard, INCIDENTS 07-02) · H3a analytics accuracy source/MRR (`fb92c8b`/`88b92cc`/`2e04a66`) · H3b owner-activity `adminGetOwnerActivity` (`5fb26e9`/`f4aee2b`/`b424aeb`) · H3c parse-inbox address UI (`a31538f`). H4 pilot: parse dispatch `salownParseInboxDispatch` + `messages.test.js` no-fork (41/41, `c944b28`) + DNS+Brevo inbound webhook + tokens (`1183f50` named token `<slug>_<32hex>`) + envelope-priority routing fix (`0b829ba`) + full lifecycle drill PASSED + first organic mail + Fresha pipe proven.

### 📱 Mobile & Staff App
D3 mobile stability 3-layer clamp (`4f1bd13`) · D4 modernization speed+Week tab+Icon.tsx 28 SVG+day-swipe (`e3f3e9f`) · D5 walk-in Booksy-cart WalkInFlow+orphan fix+iOS viewport root-fix (`7f46858`) · D7 weekly schedule Day|Week WeekScheduleGrid (`20a3bcb`). Staff App COMPLETE (except OAuth): Setup/Shell/Today/Sheets/Clients · Panel Parity · Permissions (7 permissions) · Notification bell (FCM) · Reschedule · No-show · WorkingHours validation · Sales · Login redesign.

### 🛠️ Reliability
TS migration v1.0.0: rc3 src→lib pipeline (`73ce8f8`, `v0.9.0-rc3`, 52/52 fn) → functions 100% TS (`7881cfe`) → strict everywhere functions 355→0 (`71312de`) + frontend 1400→0 (`eb348b7`), byte-proof v2. I1 canary `recordParserRun`. I4 Phase A staff/client audit (`2ab0328`). **UK financial/notification blockers release (2026-07-30, `7fc0f09`)** — three local-only payloads (ANY-BARBER · PUSH-RECOVERY · RECEIPT-WRITER) shipped from a clean `origin/main` worktree, functions before hosting, `[skip ci]` so the two hosting targets deployed manually and in order. Also closed a **false** long-standing blocker: the "no Java runtime on the Mac" that had been skipping the emulator suite is only Homebrew `openjdk` being keg-only — `JAVA_HOME=/opt/homebrew/opt/openjdk` runs it (53/53).

### 🔧 Infra (G)
Email observability stamps (`56c8e5e`, confirmation/reschedule/cancellation EmailSentAt) · `dailyFirestoreBackup` fixed + 30-day lifecycle + failure-alarm (`740916b`, INCIDENTS 07-13) · www.whitecrossbarbers.com→apex 301 + GH Pages shutdown · confirmation email button email-safe table (`0d974f3`) + week-view source label + staff push London date · bounce-checker fix (`62d79fe3`) · G6 landing mobile (`288e566`) · loyalty legal terms no-cash-value (`2636d24` + whitecross `terms.html`).

---

### 🗓️ Dated archive

**2026-07-13** — Loyalty program legal terms (no-cash-value): emailTemplates (`2636d24`) + whitecross terms.html/loyalty.html.

**2026-07-03** — Online profile header resize+focal-point (`7d06c33`/`895a30a`) · Booking flow reorder (Service→Date→Time→Barber-ops, `94b11f9`) · Barber chosen-vs-auto tracking + salon badge · Product-sale visibility soldProducts SSOT (`84635ed`/`b5cebac`).

**2026-07-02** — Early-access funnel H1+H2 (`a2689f9`/`ae495a1`/`57e3959`) · Approve 2 bug fixes · Architecture review + docs brain system (ARCHITECTURE_REVIEW + theme I + README/GLOSSARY/4-layer memory).

**2026-06-27→07-01** — Campaigns redesign Stage 1+2 (`3e26610`/`2ce03b1`) · Plan enforcement Phase 1+3+5+6 (`0a31141`/`e2cd4b4`/`8189df4`/`2723220`) · Dashboard pill-customiser (`23f4191`) · Busy-slot v2 processing-time dynamic (`f958aee`) · whitecross→noreply@salown.com · Campaign sender selection (`f519356`/`124321b`) · Abandoned-cart manual button.

**2026-06-26** — Finance Partner Settlement Plan A (`8fae0d8`) · Platform "Both per booking" (`dc1a471`) · Treatwell fee 35%+VAT (`5f69f86`/`83b484c`) · Landing "OUR STORY" (`b89986d`) · Whitecross success "Add to Calendar" (`28262d9b`) · Confirmation/cancel/reschedule email 3-layer fix + live test · Google review incentive.

**2026-06-23** — Money NaN sweep (`pp()`) · New customer email set (5 builders) · Walk-in vs booking (`bookingType`) · Notification policy (single notification CONFIRMED) · New Settings toggles · Source salOWN≠Website.

**2026-06-21** — 🔒 Firestore cross-tenant hole closed (`ef31d16a`, 16/16) · Muhamed wage config · SINGLE SOURCE `firestore.rules` · Staff App login redesign · Grid source-color · eekurt lingering auth fix. Tools: `test-firestore-rules.py`, `firestore.rules.LIVE/ROLLBACK`.

**Whitecross → Class A Migration ✅ COMPLETE** — Booksy/Fresha/Treatwell parser · Loyalty email (Brevo) · Telegram+in-app notifications · Booking confirmation trigger · Cancel/reschedule email · `cleanupExpiredPending` multi-tenant · FCM push.

**Platform ✅ COMPLETE** — GDPR rules · Actor tracking · Client dedup engine · Service-eligibility no-preference · BST/UK timezone · Cancel/reschedule server-side callables · Booksy SLOT tombstone+externalId dedup · Race-check at submit · White screen on deploy fix.

**Stripe Phase 5 (whitecross-site) ✅ Live parts** — `expiresAt` PENDING · `salownStripeWebhook` · `salownBookingConfirmedEmailTrigger` · Settings→Integrations→Stripe UI · E2E test · Live test (2026-06-26). *(salown.com/book Connect flow = Payments theme.)*

---

### 🗄️ Superseded planning blocks

> Kept **verbatim**, because a plan that was believed for three weeks is evidence about how the project
> was steered, not clutter. Do not act on anything in here — every item's live status is under its theme.

**SUPERSEDED 2026-08-10 — the 2026-07-20 COMPLETION SPRINT block, removed from *Current focus*.**
Why it was retired: it was written as "finish everything started but not closed **before** vision work",
and then the project spent three weeks on work that was *not in it at all* (TR-D1 Phases 1→3B, Admin TR
checkout, Units 4–9, DPPP, the O1 server-authority series, PSA1/PSA2, TR-P1, the TR-CURRENCY series,
the multi-location seams, the hours chain). So it stopped being a gate and became a stale index that
made the roadmap look like it was still in July. Several of its lines were also simply out of date by
the time they were read — `B3` had closed on 2026-07-25, and `S1 + S3`'s ghost-wage half closed on
2026-08-08 (`5746237`). **Not carried forward and still genuinely open:** A1 stylist cap, A3-3, C3, C8,
B2, B4, Marketing Slice 3b, G3, H4 remainder, I2 Phase 2 — all under their themes.

> **🏁 COMPLETION SPRINT (owner decision 2026-07-20):** BEFORE moving to vision work (marketplace / billing / hub), finish everything on the roadmap that is *started but not closed*. The list below is a **sequential index + closing gate** — the status badge still lives under its theme (SSOT); this is just to gather the "unfinished tails" in one place and keep the order. When an item is done: ✅ + commit under the theme, then check the box here. **Do not enter vision themes (💡) before the sprint is finished.**
>
> **🧪 To be tested (code ready → awaits owner live verification; does not block the flow):**
> - [ ] **In-app notification (reschedule/cancel) live test** — *code review ✅ 2026-07-20:* the pipe is wired correctly end-to-end (write `notifications/index.ts:66` → trigger `index.ts:2056/2095`, gate `ns.customerCancel/Reschedule !== false` = default ON → bell `NotificationBell.tsx:80`, no filter). The reschedule notification doesn't distinguish staff/customer (`index.ts:2094`) → **reschedule a real (not walk-in) booking from the panel, the bell + 🔄 diff should appear.** If it appears ✅ closes; if not, the live `salownNotifyBookingUpdated` is stale → targeted redeploy.
>
> **A — open ends waiting to close a ✅ (first; small):**
> - [ ] **A1 stylist cap enforce** — `stylistLimitReached` helper exists but isn't called in `Barbers.tsx`. *(Payments theme)*
> - [ ] **A3 inventory stockQty** — A3-1 domain foundation ✅ (2026-07-29, `34ddb12`) · A3-2 transactional executor ✅ (`980f6f1`, emulator-validated on a Java host 2026-07-29) · **A3-2.1 atomic reconciliation ✅ (2026-07-29, backend-only, NOT WIRED / NOT DEPLOYABLE).** Remaining **A3-3**: callable/HTTP surface + `checkoutBooking`/`createProductSale` cutover + `stockQty` UI + low-stock warning + firestore.rules stockQty write guard. *(Payments theme — the full A3-2.1 text is preserved on the A3 item under Payments.)*
> - [ ] **C3 abandoned-cart scheduled** — manual button ✅; X-hours-later scheduled trigger + one-time guard + opt-out. *(Marketing theme)*
>
> **B — active in-progress (🔄):**
> - [ ] **I2 Phase 2 parsers slice** — 5 parser fns → domain module. *(Tech Debt)*
> - [ ] **H4 remainder** — herohairs parse-inbox migration + Treatwell first mail + whitecross IMAP retirement. *(Onboarding theme)*
>
> **C — the "remainder" of shipped features:**
> - [ ] **B2 booking settings** — off-day reschedule behavior + barber-change UI + configurable slot interval. *(Booking)*
> - [ ] **B4 phone country code** — single shared component (5 entry points, IE +353). *(Booking)*
> - [ ] **C8 audience scope** — member leak + server-side guard (`sendCampaignBulk`). *(Marketing)*
> - [ ] **Marketing Slice 3b** — Revenue SSOT (OverviewPanel vs Reports to a single source). *(Marketing)*
> - [ ] **S1 + S3 Employment** — passive barber ghost-wage + Reports deleted-barber statistic. *(Employment Model)*
> - [ ] **G3 unsaved-changes guard** — 6 forms (ConfirmDiscard shared component). *(Tech Debt)*

---

### 📎 B5 Phase 0 archive (2-way sync verification)
❌ Neither platform listens to an external calendar LIVE (Booksy/Fresha sync is OUTBOUND only) → the GCal bridge (Phase 1) is DEAD. 🎯 Fresha "Import events from external calendar URL = COMING SOON" (primary source, owner saw it in the panel) → when released, paste `salownIcalFeed?tenantId=X` = zero code. Booksy offers none → Puppeteer-or-accept. Side gain: the Fresha EXPORT feed was obtained (`integrations.freshaIcalExportUrls`, a parser cross-check candidate). Booksy robot DECISION: owner approved (outbound only, Secret Manager, narrow permission, audit, kill-switch, isolated Cloud Run; INBOUND flow always in the parser).
