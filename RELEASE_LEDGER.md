# RELEASE_LEDGER.md — one row per release, per deployable unit


## R-2026-08-14-B — STAFF-START-AUTHORITY-A1 · coordinated 5-phase release

| Field | Value |
|---|---|
| **Work ID / source** | `STAFF-START-A1` · salown-app **`d64f098`** · whitecross-site **`ebb5cda8`** · docs `3ee1455`. Manifest: `docs/RELEASE_MANIFEST_A1.md`. Built from a **detached worktree pinned to `d64f098`**, removed afterwards; the shared tree stayed `0/0` throughout |
| **Phase 1 — `firestore:rules`** | ruleset `640c3dae-a9c8-4cb3-80c4-bc189e72874a` (23,547 B, sha256 `ded4a970…244d`) → **`10914cef-35a1-4b2d-a085-4d79680f212c`** (30,132 B, sha256 `2d2097a0cd9262dc6db819097ba9c6c6f08977b3b488c5b41c6e3b55b93c6c8e`), released 2026-08-14T22:31:55.188630Z. Repo↔live parity was proven **byte-identical before the file was touched**; after deploy the parity tool reports `✔ PARITY`. Verified behaviourally **against the live bytes**: availability contract 38/38 (incl. an exhaustive 1583–2400 Gregorian corpus), full rules regression 170/170, promotion-snapshot 17/17. **No indexes, no Storage** |
| **Phase 2 — 7 Functions** | `salownCreateBooking` `-00003-viv`→**`-00004-gom`** · `salownCreateAdminBooking` `-00001-lav`→**`-00002-sem`** · `salownCreateWalkIn` `-00001-voc`→**`-00002-miw`** · `salownReassignBooking` `-00001-hog`→**`-00002-viw`** · `salownRescheduleByToken` `-00074-zab`→**`-00075-gug`** · `approveApplication` `-00014-yup`→**`-00015-suy`** · `provisionTenant` `-00137-bij`→**`-00138-qog`**. All `europe-west2`, codebase `salown`, **traffic 100 % on the new revision**. Fully-qualified names only; **never** `--only functions` |
| **Phase 3 — `hosting:salown`** | `6cc0254d73227a96` → **`ffdb95bce7a3fc9b`** (release `1786747080006000`). Served `index-Bj5ICA9p.js` sha256 `75468839832898ed…9e3e` and `Barbers-CDtne5iw.js` `d7d6d1ba75a0a9b6…b317`, both **byte-identical to the pinned build**. `availabilityFrom` marker 1 and 15 respectively (**0 before the release**) |
| **Phase 4 — `hosting:salown-staff`** | `585dd333a4a429cf` → **`9cd83c70960e062f`** (release `1786747190806000`). Served `staff-CQ2TzIGv.js` sha256 `c36e12774f70c667…ab20`, byte-identical to the pinned build; marker 1 (0 before). `hosting:salown` re-read after and **unmoved** |
| **Phase 5 — `hosting:whitecrossbarbers-saas`** | `25b14188c8e6e9ed` → **`d7d72c6755a35044`** (release `1786747286869000`), deployed from the **REL-5 assembled workspace**, not `main`. Served `script.js` sha256 **`f7332e13cebbc9667558f5be5fc1795ef6124e20f8e98a444d20be7a269d28a9`**; `ops/rel5/verify.sh --live` **PASS**, 57/57 byte-identical. Double Points + `2× loyalty points` still present; `salownCreateBooking` / `expectedPaymentFlow` / `doublePointsMultiplier` all **0** (W1/C1 and WCP-2 still held). `whitecross2` **not deployed or initialised** |
| **Deploy archive** | 150 files, 3.28 MiB, manifest digest **`763521f6ff6c5e3b09230830cce3115d9ae44f6e2f706f7dbaa5846a98abd079`**, reproduced identically from the pinned worktree twice. **Prevented exposure:** under the pre-A1.3 ignore list the archive would have carried `functions/.secret.local`; it is **absent from the previous live archive** (verified by download) so nothing was ever deployed. Values were not printed, copied or rotated |
| **Verification** | Post-release read-only smoke on the owner's own Whitecross session, **no credential typed or accepted**: migration warning live (“3 of 3 team members have no start date”); Alex + Muhamed render normally with unchanged rota, wage, bookings and utilisation; **Add Team Member refuses save with no Start date in ALL THREE statuses** (Active, Passive, On leave) with the required-field error — **no valid form submitted, barber count unchanged at 3**; Finance loads (Gross £3,586.85 · Net Revenue £3,225.59 · wages −£1,700.00 · **Net P&L −£154.41**) and **Finance source is byte-identical between `b34d984` (previous release) and `d64f098`** — 0 files changed — so no Finance figure can have moved; public booking page and whitecrossbarbers.com load normally; **zero console errors** |
| **Owner's own first migration (not part of the release)** | After the release the owner set **Alex `availabilityFrom = 2026-02-06`** — a PAST date, so Alex stays available; the migration warning moved to “2 of 3”. Verified **read-only** against the live ruleset with Alex's real record: 05 Feb DENY · **06 Feb ALLOW (inclusive)** · 07 Feb ALLOW · today ALLOW. **Correction appended 2026-08-15 (no new release, no new row):** that “2 of 3” was true only for the minutes after this release. The owner then set **Arda `2026-02-06`** and **Muhamed `2026-06-09`** the same day, taking the warning to **0 of 3**; all three were verified read-only, each has their first booking on exactly their start date, and **zero** records fall before a boundary. Every one of these values was typed by the owner by hand — the release automation and the releasing session wrote **no business data at all** |
| **Rollback identities** | rules `640c3dae-a9c8-4cb3-80c4-bc189e72874a` · the seven revisions listed above · `hosting:salown` `6cc0254d73227a96` · `hosting:salown-staff` `585dd333a4a429cf` · `hosting:whitecrossbarbers-saas` `25b14188c8e6e9ed` |
| **Known exclusions — nothing here was touched** | Firestore **indexes** · Storage · `whitecross2` · `whitecross-site` `main` · the held W1/C1 cutover (`WCP-3`) · `WCP-2` · every other Function (exactly **7** Cloud Run revisions were created; the next-newest is `salownsendloyaltyemail-00065-hej` from 2026-08-13) · all booking, client, finance and staff business data |
| **Known exception (open)** | `SEC-CATCHALL-1` — the platform-wide `match /{document=**} { allow read, write: if isSuperAdmin(); }` still lets a super-admin browser session bypass the gate. Asserted, not silently accepted |
| **Zero production business-data write by the release** | No booking, no client, no staff document, no email, no backfill, no inventory run |

---

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
| **U4 Whitecross premium site** | `whitecross-site` | `hosting:whitecrossbarbers-saas` | hand. `firebase.saas.json` for a repository-root deploy — **which `WCP-1` blocks** — or the `ops/rel4/` release anchor for a narrow change onto the live artefact (`R-2026-08-13-Y`). `firebase.public-site.json` is UNSAFE (`WCP-4`) |
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

## Live state after the `2026-08-14T09:16` release pass — verified `2026-08-14T09:25:00Z`

| Unit | Live identity | Released (UTC) | Source | Provenance |
|---|---|---|---|---|
| U1 | version **`6cc0254d73227a96`** · release `1786699000997000` | 2026-08-14T09:16:40.997Z | **`b34d984`** | R-2026-08-14-A — served bytes hash-proven (4 chunks) **and authenticated read-only UI smoke 10/10 PASS** |
| U2 | version **`585dd333a4a429cf`** · release `1786641658556000` | 2026-08-13T17:20:58.556Z | **`a72f409`** | R-2026-08-13-D — served bytes hash-proven |
| U3 | version `9f457fc2c8ee4b35` · release `1785493665740000` | 2026-07-31T10:27:45.740Z | `51e70a0` | R-2026-07-31-A |
| U4 | version `e6be08684d312ce7` · release `1786401587236000` | 2026-08-10T22:39:47.236Z | **UNKNOWN / HYBRID** | R-2026-08-10-F — ⛔ still blocked, see `R-2026-08-13-X` |
| U5+U6 | 108 functions; `salownSendLoyaltyEmail` now **`-00065-hej`** | 2026-08-13T17:16:00.012Z | `a72f409` | R-2026-08-13-B — deployed archive byte-proven |
| U7 | ruleset `640c3dae-a9c8-4cb3-80c4-bc189e72874a` | updated 2026-08-05T12:52:07Z | not proven against the file | R-2026-08-05-R |
| U8 | 2 composite indexes, both `READY` | UNKNOWN | **UNKNOWN** — the repo declares 0 | ⚠️ see U8 warning |

> U1 passed through three intermediate identities during the day: `2620fb29bf2e064e` →
> `2eff0455ed404c15` (passive-only, `R-2026-08-13-A`) → `84eb7dda5e1b2140` (`R-2026-08-13-C`) →
> `422bcb40aab7df89` (`R-2026-08-13-Z`). Each is a valid rollback target and each drops strictly
> more work than the next; `84eb7dda5e1b2140` is the anchor for the loyalty-filter release and
> keeps everything except it.

> ⚠️ **U8 warning.** `salown-app/firestore.indexes.json` declares **0 indexes** and 1 field
> override, while production runs **2 composite indexes**. A `firebase deploy --only
> firestore:indexes` today would propose **deleting both**. Export the live definition into the
> file before any index deploy. ROADMAP `TEC-6`.

---

# Releases

Newest first. One `###` heading per release event.

## 2026-08-14

### R-2026-08-14-A — U1 salOWN Admin — **P&L scope: profit is never a property of a tender**

| Field | Value |
|---|---|
| **Date/time (UTC)** | 2026-08-14T09:16:40.997Z |
| **Environment** | production |
| **Repository** | `salown-app` |
| **Source SHA** | **`b34d984`** (`b34d984d2a201a7595217dc667cc1b237783002c`) |
| **Clean-tree proof** | `HEAD == origin/main == b34d984`, `git status --porcelain` empty, recorded before the deploy command and again after. All seven release commits verified ancestors of HEAD beforehand: `562148d`, `0fe662a`, `6f4d335`, `6148dd7`, `29a7016`, `5bd2b8d`, `b34d984` |
| **Firebase project** | `havuz-44f70` |
| **Target** | `hosting:salown` — **and no other**, by explicit `--only`. Hand-deployed; every commit carries `[skip ci]` so CI released nothing |
| **Previous → new** | **`422bcb40aab7df89`** (release `1786651199938000`) → **`6cc0254d73227a96`** (release `1786699000997000`) |
| **What shipped** | Three work items. **`FIN-TENDER-SCOPE-P1`** — `productRev` is transaction-level with no recoverable tender attribution (no writer stores a method on a product line; the canonical allocation folds products into "collected for goods"), so it is reported whole and marked non-additive, and `Service = Gross − Product` is **withheld** under a filter instead of clamped to £0.00. **`FIN-TENDER-SCOPE-P1.1`** — the nine Reports/Breakdown measures carry three distinct scopes rather than one blanket suffix: Service/Add-ons `not-derivable` (value withheld), Products/Gross/Discount/Loyalty `transaction` (shown, suffixed), Tips/Cash/Card `tender-leg` (additive, unmarked). Tips is the ONE measure the schema attributes to a tender — `tipPaymentMethod` plus its own `paymentAllocation.tip` bucket — so a card-only view no longer shows a cash tip. **`FIN-PL-SCOPE-P0`** — ADR-024 implemented: the entire P&L waterfall and the Daily Ledger's Net Rev./Wages/Net P&L columns read the authoritative whole-period roll-up, and the tender filter can be non-All only on the two tabs whose control is on screen |
| **Why the whole waterfall, not just Overview** | A waterfall is a bridge — every arrow subtracts from the line above. A filtered Gross above whole-period costs does not reconcile and no label rescues it. `plTotals = monthlyTotalsAll` with **no tab or filter test in the binding**; a source test isolates the card and asserts **0** filtered reads and **0** filter branches inside it. `buildDailyRows` and `rollUpMonthly` are each defined once and called twice, so the wage accrual rule is not duplicated (the `FIN-S2` lesson) |
| **Nothing is apportioned** | No cost and no transaction figure is split across cash and card anywhere. Tests assert the tempting 40/60 revenue-share apportionment of wages is produced nowhere |
| **Tests** | frontend **3844/3844** (127 files) · functions **1348 pass / 31 skipped / 0 fail** · app + functions typecheck 0 · scoped ESLint clean · `ops/deploy-policy.test.js` 28/28 · `ops/release-guard.sh` OK · `git diff --check` clean · focused P1/P&L suite re-run with full output retained immediately pre-deploy: **142/142** across `financeSummary`, `financePlScope`, `financeTender`, `tenderSelection`, `tenderFacts` |
| **⚠️ Unreproduced test observation — recorded, not explained** | On the FIRST full-suite run after the final edits, one test failed (`1 failed | 3843 passed`). That run's output was piped to `tail`, so **the test name was not captured** — an evidence-handling error, not a finding. The identical tree then passed **11 consecutive full runs**, including two under deliberate CPU load (6× and 10×) and one with the vite/vitest caches deleted. Working hypothesis, unproven: a stale `?raw` transform-cache read on the first run after the source file changed, since several source-parity tests import `Finance.tsx?raw`. Carried forward deliberately rather than dismissed |
| **Verification — served bytes** | URL proven before hashing (`/app` → `/public-bundle/assets/index-jgFucvA0.js`), each chunk `HTTP/2 200`, then sha256 compared against the pinned build: `index-jgFucvA0.js` `3e5bee60…ee20` · `Finance-DxZe9b8J.js` `070e6f90…0025` · `Reports-D7Mannvt.js` `c69e583b…fe70` · `financeSummary-BN6rPWMn.js` `9fe6b332…4b10` — **all four byte-identical** |
| **Verification — owner-confirmed shell availability** | The owner confirmed independently, in their own browser, that **salown.com/app loads normally and shows the correct Whitecross panel**. This is a statement about app-shell availability after the release and **nothing more** — it is not a check of any figure on the Finance or Reports screens |
| **Verification — authenticated read-only UI smoke, 10/10 PASS** | Completed 2026-08-14 ~10:0x on the owner's own Whitecross session, which became reachable without any credential being typed, revealed or accepted. Read-only throughout: navigation, tab and filter clicks and one date-field entry, all local view state. **(1) All view unchanged** — Finance Day 13/08/2026: Gross £271.60 · Service £271.60 · Tips £6.98 · ⭐ Loyalty −£9.20 · Net Revenue £271.60 · wages −£100.00 · fixed −£120.00 · **Net P&L +£51.60**, no suffix, no badge, nothing withheld — identical to the pre-deploy record. **(2) Cash/Card collection additive** — Finance cash £63.00 + card £208.60 = £271.60; Reports cash collected £673.00 + card collected £2,824.73 = £3,497.73. **(3) Service "not derivable per tender"** — Reports/Breakdown group rows render `SERVICE (NOT DERIVABLE PER TENDER)` with the value withheld as `—` under both Cash and Card. **(4) Whole-transaction scopes** — `GROSS (WHOLE TRANSACTIONS)`, `DISC (WHOLE TRANSACTIONS)`, `LOYALTY (WHOLE TRANSACTIONS)`, `NET (WHOLE TRANSACTIONS)` on group rows and the totals bar. **(5) Tips method-specific** — Finance 13/08 tips £5.00 cash / £1.98 card / £6.98 All (5.00 + 1.98 = 6.98); Reports chips read `CASH TIPS` / `CARD TIPS` with no suffix, £35.00 + £69.83 = £104.83. **(6) Waterfall All and reconciling** — badge `P&L · All payments` renders under both filters; Gross £271.60 → Net Revenue £271.60 → Net P&L **+£51.60** identical in All, Cash and Card, and 271.60 − 0 − 0 − 100 − 120 = 51.60. **(7) Daily P&L columns All + labelled** — `NET REV. ·ALL` £271.60, `WAGES ·ALL` £100.00, `NET P&L ·ALL` +£51.60 unchanged across filters, footnote reads the corrected scope-neutral copy. **(8) Overview resets** — entering Overview from Card cleared the badge, restored Cash in Hand to +£61.02 and the waterfall to All. **(9) Return to Daily** — `PAYMENT: All` visibly selected, suffixes and badge gone. **(10) No console errors** — none across the Reports load, every filter/tab interaction, and a fresh Finance load with the listener attached |
| **The stall was NOT attributable to this release** | The stall sat at `AppRouter.tsx:140` (`tenantStatus === 'loading'`), a `getDoc(tenants/{tenantId})` that never settled, with zero console errors, and reproduced on `/app/home` which loads neither changed page chunk. Between the previously deployed `562148d` and `b34d984` exactly five files changed — `Finance.tsx`, `Reports.tsx`, `financeSummary.ts` and two test files. `AppRouter.tsx`, `AuthContext.tsx`, `firebase.ts`, `main.tsx` and `App.tsx` are byte-identical across the range, so a rollback could not have cleared it. Classified by the owner as local to the automated browser profile. `tenants/salown` was **not** investigated or modified, per instruction |
| **Rollback identity** | **`422bcb40aab7df89`** (release `1786651199938000`). Console → Hosting → site `salown` → Release history → that version → ⋮ → Roll back. It drops all three work items and keeps `SPLIT-B2` |
| **Jack — second, independent read-only confirmation** | Reports/Breakdown no longer renders the `⚠ 1 SPLIT ROW CLAMPED` badge in any view. That badge appears only when `resolveTenderFacts` returns `malformed: true`, i.e. the legacy reading; its disappearance is production evidence that the row now resolves **canonical**, obtained without reading the document |
| **Jack — read-only verification, this pass** | `tenants/whitecross/bookings/3ori9n79QSj09Xyu96fQ` re-read with the repair tool's **DRY RUN (read-only)** mode — no `--apply`, no `--confirm`. `updateTime` `2026-08-13T20:32:53.769Z`, doc sha256 **`7696c2752224d39851b1cd8edfb586b0281154f307faa7dcbebdac47f30415fd`** (the post-repair hash), repair audit record `repair-split-b-jack-…` **PRESENT**, all four authorised paths already at target, **PROPOSED UPDATES: 0**. Canonical, and untouched by this session |
| **Production data written** | **none.** No Firestore write, no checkout, no email or receipt resend, no loyalty mutation, no Function, no rule, no index, no Storage object |
| **Operator/device** | macOS · `alish/finance-pl-scope` |
| **Result** | Success. Deployed, byte-verified and screen-verified 10/10 |
| **One observed delta, fully attributed — NOT caused by this release** | Finance 13/08 All splits £63.00 cash / £208.60 card, against £58.00 / £213.60 recorded pre-deploy; the total £271.60 is unchanged, and Cash in Hand moved +£5.00 / Bank Balance −£5.00 to match. This is the **`SPLIT-B-JACK` data repair** (`839815f`, applied 2026-08-13T20:32:53Z by `alish/jack-split-repair`) becoming visible in the readers: the legacy reading gave that sale £10.00 of cash service, the canonical one gives £15.00. Expected, arithmetically exact, and unrelated to the code in this release |
| **Known exclusions — verified unchanged after the deploy** | `hosting:salown-staff` **`585dd333a4a429cf`** · `hosting:salown-admin` **`9f457fc2c8ee4b35`** (both re-read post-deploy) · `hosting:whitecrossbarbers-saas` `25b14188c8e6e9ed` · Functions (both codebases) · `firestore.rules` · `firestore.indexes.json` · Storage · `tenants/salown` (not read, not touched) · Jack's booking and every other production document · REL-1 staff-bundle drift: none, tree stayed `0/0` throughout |

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

### R-2026-08-13-Z — U1 salOWN Admin — **a tender filter no longer presents transaction loyalty as additive**

| Field | Value |
|---|---|
| **Date/time (UTC)** | 2026-08-13T19:59:59.938Z |
| **Environment** | production |
| **Repository** | `salown-app` |
| **Source SHA** | **`562148d`** (`562148d635d20fd2502b6d12c0d933b786d1b6ec`) |
| **Clean-tree proof** | `HEAD == origin/main == 562148d`, `git status --porcelain` empty — recorded immediately **before** the deploy command and again after it (the REL-1 staff-bundle rebuild produced byte-identical output this time, so no restore was needed and the tree never left `0/0`) |
| **Firebase project** | `havuz-44f70` |
| **Target** | `hosting:salown` — **and no other target**, by explicit `--only`. Deployed by hand; the commit carries `[skip ci]` so CI released nothing |
| **Previous → new** | **`84eb7dda5e1b2140`** (release `1786641531101000`) → **`422bcb40aab7df89`** (release `1786651199938000`) |
| **The defect** | Live Admin Finance, day 2026-08-13: **All ⭐ Loyalty −£9.20 (correct) · Cash −£3.20 · Card −£9.20** — the two filtered views jointly claimed **£12.40** of a **£9.20** redemption. `SPLIT-B`/`B1` correctly placed a split sale in BOTH filtered views and correctly restricted what it contributes **in tender**; it did not touch the figures that are not tender at all. `Finance.tsx` (`loyaltyDiscount += parsePrice(b.loyaltyRedeemedValue)`) and `Reports.tsx` (`loyalty += pp(b.loyaltyRedeemedValue)`) each summed the WHOLE sale's redemption over rows the filter had already selected, so Jack's £3.20 was counted in full on each side |
| **The change** | New pure helper `src/utils/financeSummary.ts` — `summariseTransactions` returns the TRANSACTION-level facts (gross / discount / loyalty / net / count) for the rows in view **plus** `additiveAcrossFilters`, `splitRowCount` and `splitLoyaltyRedeemed_p`. **No cash/card share of a redemption is invented**: a redemption reduces the sale before a tender exists, so it has no method to belong to. Presentation only — labels and one new scope line. Finance's loyalty figure is display-only (`netRevenue`/`netPL` never read it), so **no P&L number moves**, and no stored value or All view changes |
| **Visible, tender views only** | Finance chip `⭐ Loyalty −£3.20 (whole transactions)` + a scope line *"Tender view — cash collected only. Loyalty is a whole-transaction figure; do not add it across Cash and Card (1 split sale worth £3.20 appears in both views)."* · Reports/Breakdown totals bar: Gross / Discount / Loyalty / Tips / **Net all carry the `(whole transactions)` suffix Net already used** · count reads `N bookings IN THIS VIEW · CASH ONLY · 1 SPLIT SALE ALSO IN THE OTHER VIEW (£3.20 LOYALTY)` |
| **Tests** | frontend **3763/3763** (125 files; **30 new**, incl. a reproduction asserting the exact live 320/920/1240 pence figures against the page's own pre-change arithmetic, and a source-parity block proving both screens are wired to the helper) · functions **1348 pass / 31 skipped / 0 fail** · app typecheck 0 · functions typecheck 0 · scoped ESLint clean · `ops/deploy-policy.test.js` 28/28 · `ops/release-guard.sh` OK · `git diff --check` clean · `claims.sh validate` OK · Admin build 0 errors |
| **Verification (post-deploy, served bytes)** | URL proven before hashing (`/app` → `/public-bundle/assets/index-BH7-7g09.js`), each chunk `HTTP/2 200`, then sha256 compared: `index-BH7-7g09.js` `3582b71d…1237b` · `Finance-8jkKBgqZ.js` `ca11a1df…9aa07` · `Reports-BT1YKQ7v.js` `14d4fa72…dfb9b` · **`financeSummary-DWr0Bqk0.js` `226b2c1a…60330`** — all four **byte-identical** to the local build. The new helper ships as its own chunk carrying the source markers `(whole transactions)`, `must not be added`, `additiveAcrossFilters`, `splitLoyaltyRedeemed`, and both page chunks reference it by name |
| **Verification (authenticated, read-only)** | Signed in as the Whitecross owner. **Finance → Day 13/08/2026:** All `⭐ Loyalty −£9.20` (unchanged, no suffix) · Cash `⭐ Loyalty −£3.20 (whole transactions)` · Card `⭐ Loyalty −£9.20 (whole transactions)`, both filtered views carrying the scope line naming the 1 split sale worth £3.20. Cash collected £58.00 + Card collected £213.60 = £271.60 = the All-view gross — **tenders still reconstruct the day exactly once**. **Reports → Breakdown, August:** All unchanged; Cash `TOTAL — 18 bookings IN THIS VIEW · CASH ONLY · 1 SPLIT SALE ALSO IN THE OTHER VIEW (£3.20 LOYALTY)`, `LOYALTY (WHOLE TRANSACTIONS) −£3.20`, `CASH COLLECTED £668.00`; Card the same shape, `−£91.30`, `CARD COLLECTED £2720.73` (£668.00 + £2720.73 = £3388.73, the All-view total collected). No console error on either page |
| **Rollback identity** | **`84eb7dda5e1b2140`** (release `1786641531101000`). Console → Hosting → site `salown` → Release history → that version → ⋮ → Roll back. It keeps `PASSIVE-R3` and all of `SPLIT-B`/`B1` and drops only this presentation change |
| **Production data written** | **none.** No Firestore write of any kind, no checkout, no email or receipt resend, no loyalty mutation, no Function, no rule, no index, no Storage object. The smoke was navigation, view-mode buttons and payment-filter buttons only — all local React state |
| **Jack's booking** | **NOT repaired** and byte-unchanged: still `paymentMethod 'SPLIT'`, `splitAmount "15"` (string), `splitSecond ""`, no `paymentAllocation`. Confirmed live by behaviour rather than by a document read — Reports still renders **`⚠ 1 SPLIT ROW CLAMPED`**, which only appears when `resolveTenderFacts` returns `malformed: true`, i.e. the legacy malformed reading. A repaired canonical row would not be clamped. `SPLIT-B-JACK` stays open |
| **Cashback policy** | untouched — **5%, 20 points = £1**. Not read, not written, not referenced by the change |
| **Operator/device** | macOS · `alish/finance-split-loyalty-filter` |
| **Result** | Success. The Cash and Card views no longer imply an additive £12.40 loyalty, and every transaction-level figure on a tender view now says which scope it belongs to |
| **Known exclusions — nothing here was touched** | Jack's booking and every other production document · Functions (both codebases, `salownSendLoyaltyEmail` stays `-00065-hej`) · `firestore.rules` · `firestore.indexes.json` · Storage · `hosting:salown-staff` (**`585dd333a4a429cf`**) · `hosting:salown-admin` (`9f457fc2c8ee4b35`) · `hosting:whitecrossbarbers-saas` (`25b14188c8e6e9ed`) · `whitecross-site` · `super-admin` · the dated-rota work (`FIN-DATED-ROTA`, `FIN-PERIOD-CLOSE`) · every Finance P&L, wage, expense, settlement and receivable figure |

> **Why the loyalty figure was labelled rather than removed or split.** Three options were on the
> table. *Splitting* it pro-rata across the legs was rejected outright: a redemption is a commercial
> reduction of the sale, applied before any tender exists, so a cash share and a card share would be
> two invented numbers — and invented money is harder to catch later than absent money. *Removing*
> the badge from filtered views was rejected because the owner uses it to see which sales in a view
> carried a redemption. So it stays, scoped: the figure is honest for the rows shown, and the label
> and the scope line say the one thing the reader could not otherwise know — that the Cash and the
> Card view overlap, by exactly the named amount.

### R-2026-08-13-Y — U4 Whitecross premium site — **REL-4 release anchor + the passive gate, SHIPPED**

The release `R-2026-08-13-X` stopped. It is the first U4 release since 2026-08-10 with a
**reproducible source**, and it is deliberately not a deploy of `main`.

| Field | Value |
|---|---|
| **Date/time (UTC)** | 2026-08-13T18:44:19.069Z |
| **Environment** | production |
| **Repository** | `whitecross-site` |
| **Source SHA** | **`36d77f82`** (= `origin/main` at release time) — the *anchor* commit. The released bytes are **not** that tree: they are `ops/rel4/baseline/script.js` + `ops/rel4/script.passive-gate.patch` over the 56 unrelated files of `e6be08684d312ce7`, all six identities recorded in `ops/rel4/{BASELINE,RELEASE}.manifest.tsv` and reproducible with `ops/rel4/assemble.sh`. **This is the first U4 row whose artefact can be rebuilt byte-for-byte** — `WCP-1`'s `UNKNOWN/HYBRID` is closed as a *release* problem |
| **Clean-tree proof** | `HEAD == origin/main == 36d77f82`, `git status --porcelain` empty, recorded **before** the assembly and again after the deploy |
| **Firebase project** | `havuz-44f70` |
| **Target** | `hosting:whitecrossbarbers-saas` — **and no other target**, by explicit `--only` |
| **Config used** | the REL-4 workspace `firebase.json` (`public: "."` over a directory holding **exactly** the 57 published files), **not** `firebase.saas.json`. See the unit-table note: `firebase.saas.json` publishes the repository root and needs 25 ignore rules to keep the repo out of the upload; the workspace contains no repository for a rule to fail to exclude, and it sets no rewrites/headers/redirects, so the version config stays `{}` as it was |
| **Previous → new** | **`e6be08684d312ce7`** (release `1786401587236000`) → **`25b14188c8e6e9ed`** (release `1786646659069000`) |
| **The change** | ONE shared gate, `isBarberPassive()`, called first in `_shouldShowBarber` and `getBarberScheduleForDay`. Precedence: passive (absolute) > dated `shiftChanges` > leave within `[leaveFrom, leaveUntil]` > weekly rota. Removes the superseded `if (b.active === false && barberStatusOf(b) !== 'leave') return null;`, which sat **below** the override read. `script.js` only: `ffa63589…e77637` (123,185 B) → `2abd181e…49575` (125,531 B), +43 / −2 lines in 5 hunks — byte-identical to `8c655389`'s `script.js` diff, which applied cleanly because the three regions it touches were first proven byte-identical between the served artefact and `8c655389^` |
| **Tests** | `node --check` clean · **REL-4 `scripts/rel4-passive-gate.test.mjs` 24/24** · existing `passive-authority` 17/17 + `hours-public-read` 14/14 + `w1-c1-cutover` 23/23 = **54/54** · `ops/rel4/verify.sh` PASS on the built workspace · `assemble.sh` rebuild byte-identical to the first build |
| **Negative control** | The same matrix run against the **exact live pre-patch file**: **8 of 24 assertions red**, and the behavioural failures are exactly the three passive-resurrection rows — a passive barber carrying one open future override was `_shouldShowBarber → true` and `getBarberScheduleForDay → {open:'10:00',close:'18:00'}`, i.e. **visible and bookable on production**. The active, leave and closed-override rows are green on **both** artefacts; that is the active-staff byte-equivalence claim expressed as a test |
| **Verification (post-deploy, read-only)** | The new version's file list is **59 paths, identical set to the previous version, and `/script.js` is the ONLY content-hash difference in the entire version** — including the two CLI auto-generated `/__/firebase/init.*`, which regenerated to the same stored hashes. `firebase deploy` reported `found 57 files` and uploaded **1**. Served bytes re-fetched from **both** `whitecrossbarbers-saas.web.app` and the apex `whitecrossbarbers.com`: `script.js` sha256 **`2abd181e…49575`**, `index.html` sha256 **`9f57419e…dba72` — unchanged from the pre-deploy baseline**. `ops/rel4/verify.sh --live` PASS: 57/57 byte-identical to `RELEASE.manifest.tsv`, no unexpected file, `isBarberPassive` precedes `shiftChanges` in **both** served paths (lines 171 and 1936, declaration line 111) |
| **Preservation proved, not assumed** | Served `index.html` still carries **`Double Points — Live Now`** and **`2× loyalty points`** — and, being byte-identical to the pre-deploy file, could not have changed in any other respect either. `doublePointsMultiplier` **0** ⇒ `bc25d257` still absent (`WCP-2` still held). `salownCreateBooking` **0**, `expectedPaymentFlow` **0**, `createBookingViaFunction` **0**, `httpsCallable` **3 → 3** ⇒ the W1/C1 cutover is **not** activated (`WCP-3` still held) |
| **Rollback identity** | **`e6be08684d312ce7`** (release `1786401587236000`). Roll back with `firebase hosting:rollback` or by re-releasing that version; `ops/rel4/baseline/` also holds the exact pre-patch `script.js` should the artefact ever need rebuilding by hand |
| **Production data written** | **none.** No Firestore read or write of any business document, no booking, no email, no Function, no rule, no index, no Storage object |
| **Operator/device** | macOS · `alish/rel4-wc-passive-hotfix` |
| **Result** | Success. `WCP-5` closes: whitecrossbarbers.com no longer shows or books a departed barber carrying a stale open `shiftChanges` override. The asymmetry recorded in `R-2026-08-13-X` — closed on salOWN, open on the premium site — is resolved |
| **Known exclusions — nothing here was touched** | `main`'s `script.js`/`index.html` and every other repository-root site file (byte-unchanged; the held W1/C1 cutover stays exactly where it was) · `WCP-2` `bc25d257` · `WCP-3` W1/C1 activation · Functions (both codebases) · rules · indexes · Storage · `hosting:salown` (`84eb7dda5e1b2140`) · `hosting:salown-staff` (`585dd333a4a429cf`) · `hosting:salown-admin` (`9f457fc2c8ee4b35`) · the other four `whitecross-site` panel sites · `whitecross2` (not opened, not built, not deployed) · Jack's booking and every other production document |

> **What this release does NOT do.** It does not make `main` deployable to U4. `main` still
> diverges from the live artefact by the held W1/C1 cutover and `bc25d257`; `WCP-2`, `WCP-3` and
> the eventual reconciliation of `main` with production remain open. The anchor is the mechanism
> for the *next* narrow change too — extend `ops/rel4/`, do not deploy the repository root.

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
| **Next action** | ~~`REL-4`~~ — **done the same day.** The anchor was built and the fix shipped as **`R-2026-08-13-Y`** (`e6be08684d312ce7` → `25b14188c8e6e9ed`, 18:44:19Z), transplanted onto the live bytes rather than deployed from `5202cad`. This row stands as the record of the stop that made that possible |

> ~~**The exposure that stays open, stated plainly.**~~ **CLOSED the same day by `R-2026-08-13-Y`.**
> When this row was written, `_shouldShowBarber` and `getBarberScheduleForDay` in the *served*
> artefact still read `shiftChanges` before the lifecycle status, so a departed barber carrying one
> stale open override was shown and generated clickable slots on whitecrossbarbers.com. The
> served artefact is now `25b14188c8e6e9ed`, in which the shared passive gate precedes the override
> read in both paths. The asymmetry with the salOWN half (`R-2026-08-13-A`/`-C`) is resolved.
> `WCP-1` itself is only closed *as a release problem*: `main` still does not match production.

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

> ⛔ **Deploying `origin/main` to U4 is STILL BLOCKED** — `main` carries the held W1 C1-cutover
> *and* `bc25d257`, and `bc25d257` against today's multiplier-less mirror would blank a banner that
> is live right now. `REL-4` did **not** lift this: it built an anchor for shipping a narrow change
> **onto the live artefact** (`ops/rel4/`, first used by `R-2026-08-13-Y`), which is a different
> thing from making the repository root deployable. **`firebase.public-site.json` is UNSAFE**
> (9 ignore entries vs 25) and would re-publish the repository. For a repository-root deploy,
> `firebase.saas.json` remains the only approved config.

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
