# DEPLOYMENT_STATUS.md — what is live vs. what is only on origin/main

> **Role:** a point-in-time ledger of **deploy state** — the gap between "committed/pushed to
> `origin/main`" and "actually deployed and live-verified in production." It answers one question:
> *for a given commit, is the running system actually on it?*
>
> **This is not** the retrospective sync ledger (that is `salown-app/SYNC.md`), nor the plan
> (`ROADMAP.md`), nor path ownership (`salown-app/ops/claims/`). It exists because **push ≠ deploy**:
> `salown-app` `main` auto-deploys **hosting only** via GitHub Actions; **functions, rules, and the
> separate `whitecross-site` repo deploy manually**, so code can sit on `origin/main` for days while
> production runs older behavior. Confusing "merged" with "live" has caused real incidents.
>
> **Snapshot date:** 2026-07-27 15:05 UK after the Treatwell parser deploy + T2188888050 repair (previous: 12:55 UK after the whitecross test-mode lockdown deploy) (previous
> revisions: 2026-07-26 19:45 UK; 2026-07-24 16:40 UK after Parser-3C landed on `origin/main`; earlier
> 16:05 revision during BSP-H1, see the hosting-baseline correction below). Verify against `git log origin/main` + the live system before acting;
> a row here is a claim about a moment, not a standing guarantee.

---

## Hosting baseline — what is ACTUALLY live (measured 2026-07-26 19:45 UK)

**Live `salown` hosting release = `1785091173083000`** (2026-07-26T18:39:33Z, bundle
`index-D0JrelmL.js`), deployed manually from HEAD `f30ae4a` with `--only hosting:salown`. It adds the
extras/price fold fix (`694c2bb`) on top of everything in the previous baseline. Previous baseline =
`1785005794084000` (bundle `index-CLNge9uB.js`, HEAD `433ec7f`, the 2026-07-25 wave carrying BSP-I2,
BSP-H1, Parser-3C Super Admin panel + two lint cleanups); before that `ad20475` (`index-DdVeuO0D.js`,
"I1 canonical UK phone foundation"). Exactly ONE new release was created — verified by listing the
site's last 3 releases (new / 07-25 baseline / 07-24), so CI did not also fire.

**Re-confirmed independently 2026-07-27 15:10 UK (DOCID-1):** `curl https://salown.com/book/whitecross` emits
`assets/index-D0JrelmL.js`, and `npm run build` of an UNTOUCHED `f30ae4a` in a clean worktree emits the same
`index-D0JrelmL.js`. The live-source boundary is therefore `f30ae4a`, reproduced rather than trusted.

⚠️ **`origin/main` is AHEAD of live for hosting, and the gap is not releasable as a whole.** Undeployed
frontend on `main`: OPT-1 (`b6b622e`, service options → `BookingDetailPanel` + `src/utils/{serviceOptions,
bookingPrice}.ts`) and DOCID-1 (`c01e4b5`, the booking-page identity hotfix). **A hosting deploy ships the
whole bundle from whatever HEAD it builds — the `--only hosting:salown` target scopes the SITE, not the
COMMIT SCOPE.** So deploying DOCID-1 off `main` would co-release OPT-1 without its owner's approval.
Standing decision (owner, 2026-07-27): do NOT co-deploy. The releasable artefact is branch `hotfix/docid-1`
(cut from `f30ae4a`, booking path only, +16/−6 across `BookingPage.tsx` + `SalonSitePage.tsx` +
`src/utils/firestoreIdentity.ts`; zero file intersection with OPT-1; 279/279 vitest, tsc clean, builds to
`index-Dv_tTyTd.js`) — built and verified, **awaiting go/no-go**. Until it ships, production runs a strict
SUBSET of `main` and **online booking on salown.com/book/whitecross is broken** (INCIDENTS 2026-07-27).

*Method (repeatable, no production data touched):* fetch `https://salown.web.app/public-bundle/index.html`,
read the emitted asset name, compare to the local `npm run build` output of HEAD. The live bundle's markers
confirm the shipped packages: `phoneCanonical` (I2), `salownCreateBooking` + `IDEMPOTENCY` + `SLOT_CONFLICT`
(H1), `isSuperAdmin`-gated Parser panel (3C).

**`salown-staff` release = `1784882253065000`** (version `5fd6406875bc9653`) — **UNCHANGED** since
2026-07-24, by the 07-25 wave and by the 2026-07-26 deploy alike; the staff bundle still predates I2.
Both deployed `hosting:salown` **only**. Re-verified after the 07-26 deploy: same release ID, same
timestamp. ⚠️ The staff app therefore also does NOT have the extras/price fold fix — its
`BookingDetailSheet` is a separate component from the web `BookingDetailPanel`, so that fix has to be
mirrored there before a staff deploy is worth doing.

⚠️ **`--only hosting` (no target) deploys BOTH sites, but `--only hosting:salown` does NOT.** `firebase.json`
defines `salown` **and** `salown-staff`. The `salown` target's predeploy runs `npm run build` (→ gitignored
`hosting/public-bundle`); a `hosting:salown` deploy releases only the salown site. Note: the firebase CLI
still runs the `salown-staff` predeploy build hook during a `hosting:salown` deploy, which regenerates the
**tracked** `hosting/staff-bundle/` files locally — discard that build-output churn (explicit path) so it is
never committed. The **CI** workflow (`.github/workflows/deploy.yml`) runs blanket `firebase deploy --only
hosting`, which DOES ship both sites — so every doc/ops commit in a manual wave must carry `[skip ci]`.

---

## Legend

| Mark | Meaning |
|---|---|
| ✅ **Deployed + live-verified** | On `origin/main` **and** confirmed running in production |
| 🟡 **On origin/main, NOT deployed** | Committed/pushed but production still runs older behavior — a pending deploy |
| ⬜ **Not started** | No implementation on `origin/main` yet (design/plan only) |
| ♻️ **Live, no new deploy** | Already-live state a commit merely *records* — nothing new to ship |

**Deploy order (from `DEPLOY.md` / CLAUDE.md, security changes):** functions → hosting → **rules LAST**.
Hosting on `salown-app` is automatic on push to `main`; functions/rules/`whitecross-site` are manual and
owner-gated (state tenant + URL, wait for confirmation).

---

## Current deploy state (2026-07-25, rev. 20:15 UK — H1/Parser-3C/R1-A controlled wave)

> **2026-07-25 controlled deploy wave (functions → hosting → rules LAST), project `havuz-44f70`,
> account `whitecrossbarbers@gmail.com`, salown-app HEAD `433ec7f`:**
> - **Stage 1 (functions, targeted):** `firebase deploy --only functions:salown:salownRescheduleByToken,functions:salown:salownParseEmails,functions:salown:salownParseInboxDispatch,functions:salown:salownManualImport --project havuz-44f70` → all four ACTIVE, europe-west2, nodejs22, updated 2026-07-25 ~11:10Z (reschedule `salownreschedulebytoken` hash `00727dc8`, the 3 parsers share hash `d6a301e1`). **Exactly 4 functions changed; `salownCreateBooking` unchanged & ACTIVE; the 27 us-central1 legacy functions untouched (89 total, all ACTIVE).** Negative smoke on reschedule callable: `{}`→`INVALID_ARGUMENT`, fake token→`NOT_FOUND` (both reject before any write). First natural 5-min parser runs (11:12–11:27Z) produced healthy 3C ledgers: `outcome:success`, `errorCount:0`, `parserBroken:false`, `dataLossSignal:NONE`, reason-coded outcomes present, **zero UNKNOWN_SKIP / MISSING_REQUIRED_FIELDS**, no PII. Prod writes from this session = 0 (only the normal scheduled parser cron wrote its additive ledger).
> - **Stage 2 (hosting, targeted):** `firebase deploy --only hosting:salown --project havuz-44f70` → **salown** new release `1785005794084000` / version `0aacd49d5a9202cd` (was `1784882253096000` / `79cb725fe2c7e53c`). **salown-staff UNCHANGED** (`1784882253065000`); all whitecross premium hosting UNCHANGED. New bundle `index-CLNge9uB.js`. Hosted smoke: page loads, services/selection load, no console errors, callable-mode markers present (`salownCreateBooking`, `SLOT_CONFLICT`×4, `IDEMPOTENCY`, `phoneCanonical`), no public `clients` read, entered-name success preserved, Parser panel `isSuperAdmin`-gated, checkout keys on `docId` not the human WEB id, no legacy addDoc fallback. No production booking created.
> - **Stage 3 (rules, LAST):** `firebase deploy --only firestore:rules --project havuz-44f70` → new live ruleset **`323f1726-f6bf-4d6e-b9b9-24e152f6e494`** (2026-07-25T19:14:08Z), byte-identical to local `firestore.rules`; **rollback target = pre-R1-A `1474907b-af60-4bb4-a54a-8026c6c61273`** (`firestore.rules.ROLLBACK.txt` refreshed). Live-behavior verification via the Rules Test API on the deployed ruleset: **131/131**, 7 keys DENY, hosted+premium single/group ALLOW, staff BLOCKED/Busy ALLOW, cross-tenant isolation intact, 3 phase-B guards ALLOW (**phase-B still blocked**). Only rules changed (hosting + functions no drift).
>
> **Still undeployed after this wave:** BSP-W1 premium cutover (⬜ not started), E1 payment E2E (⬜ not started), R1 **phase (b)** deny-anonymous-create (⬜ blocked on W1+E1). Premium staff-shift (`whitecross-site` `e0003845`) still pending its separate manual deploy.

## 2026-07-27 — WC-LEGACY-TESTMODE-LOCKDOWN (whitecross-site functions only) 🔴 SECURITY

> Targeted manual deploy, project `havuz-44f70`, **us-central1**, `whitecross-site` HEAD `917c2439`
> (implementation `8dcdebc7`). **Functions only — no hosting, no rules, no other function.** Run via
> `./scripts/deploy-functions.sh whitecross createCheckoutSession stripeWebhook` (the guarded wrapper;
> raw/blanket `firebase deploy` is forbidden — a blanket functions deploy would orphan the other 25
> us-central1 functions).

| Item | Commit(s) | Repo / target | State | Notes |
|---|---|---|---|---|
| Legacy test-mode lockdown (`createCheckoutSession`, `stripeWebhook`) | `8dcdebc7` | whitecross-site / functions us-central1 | ✅ **Deployed + live-verified** | Deployed 2026-07-27 ~11:41Z. Closes a **live free-booking exploit**: the legacy public path let `req.body.testMode` select the Stripe **test** key for a **real** production booking (payable with `4242…`), which the test-signed webhook then confirmed. Now: mode-selection keys → **400 `UNTRUSTED_FIELD`** before Stripe/Firestore; production always resolves the live key (test key only behind `WC_NONPROD_TEST_MODE=1`, **never set on `havuz-44f70`**); `stripeWebhook` rejects every `livemode !== true` event **before `getAdminDb()`** (zero reads/writes) on all branches; per-document mode gates on legacy single + group + MOBILE_CHECKOUT (absent/garbage `stripeMode` ⇒ live-only). Gates: `main == origin/main`, clean tree, zero claims, 52/52 tests, node syntax+load, namespace guard, live-key guard **pre and post** (`mode = LIVE`, Whitecross account). Post-deploy: 27 us-central1 functions before == 27 after (list byte-identical); exploit body → 400; alias sweep (`mode`/`stripeMode`/`livemode`/`stripeKey`/`testmode`/`test_mode`) → 400; `testMode:false` → 400 (presence not truthiness); control clean body → pre-existing `Missing required fields`; webhook unsigned → 400, forged → 400, GET → 405; runtime log `mode-selection field rejected { field: 'testMode' }` proves the new revision executes. **Zero production writes** — no booking created, no charge, no refund, no customer email. 🔴 Logs show the exploit had actually fired: 2026-07-22T15:40:43Z a **`cs_test_`** session confirmed real booking `WCB-1784734815258-zwmv` (owner's own canary email) — owner to verify/cancel that record. Rollback: `git revert 8dcdebc7` + rerun the wrapper; pre-lockdown `functions/index.js` = `7bc75e7e`. ⚠️ `script.js` (`?testMode=1` canary removal) is **hosting and NOT deployed** — needs `firebase deploy --only hosting:whitecrossbarbers-saas --config firebase.saas.json`. |
| PAY-2 external-checkout adapter | `132d88d5`, `7c5fb680` | whitecross-site / functions us-central1 | ✅ **Deployed, dormant by design** | Shipped in the same two functions. The new trusted path activates only for a request carrying `bookingDocId`, which nothing sends until **BSP-W1**. No behaviour change for current traffic. |

## 2026-07-27 — Treatwell parser body-shape + semantic guardrail (functions only)

> Targeted manual deploy, project `havuz-44f70`, salown-app HEAD `105bd53`. **No hosting, no rules,
> no other function.** Owner-approved two-stage operation: deploy first, then one exact record repair.

| Item | Commit(s) | Repo / target | State | Notes |
|---|---|---|---|---|
| Treatwell flattened-body fix + semantic validation | `4c9809c`, `1507610` | salown-app / functions (`salown` codebase) | ✅ **Deployed** | Deployed 2026-07-27 ~13:54Z, `firebase deploy --only functions:salown:salownParseEmails,functions:salown:salownParseInboxDispatch,functions:salown:salownManualImport --project havuz-44f70` — three "Successful update operation", europe-west2, nodejs22. **Exactly 3 functions changed:** function count 90 → 90 with a byte-identical name set (no orphan deletion — the blanket-deploy hazard did not occur). Hosting releases unchanged (`salown` `2026-07-26T18:39:33.083Z`, `salown-staff` `2026-07-24T08:37:33.065Z`); rules releases unchanged (`cloud.firestore` ruleset `323f1726-f6bf-4d6e-b9b9-24e152f6e494` @ `2026-07-25T19:14:09Z`, storage `4c00eef7…` @ `2026-05-24`). Gates: `main == origin/main`, clean tree, zero active claims, all four required commits ancestors of HEAD, focused Treatwell 19/19, parser+inbound 168 (0 fail), **3× consecutive full suite 350/337 pass/13 skip/0 fail**, typecheck exit 0, `diff --check` clean, no failure waived. `salownManualImport` deployed but **NOT invoked**. |
| Live repair of `TREATWELL-T2188888050` | — (data) | Firestore `tenants/whitecross/bookings` | ✅ **Repaired + verified** | Single `update()` on exactly one document, after uniqueness proof (1 doc on each of `externalId` / `treatwellRef` / ref-mention) and a precondition re-check. Six approved fields only: `clientName`→`Jack Wells`, `serviceId`→`the-full-experience`, `barberId`→`alex`, `barberName`→`Alex`, `twPaymentMode`→`prepaid`, `paymentMethod`→`CARD`. Read-back proved 26 preserved fields byte-identical, zero keys removed, only the approved key added, Treatwell booking count 6 → 6, grid column resolves to **Alex** (`barber-1777257519766`), money intact (£40 `paidAmount`, `FULL`, prepaid). **This update is the ONLY production write of the operation** — no checkout, cancel, reschedule, re-import or customer communication; the audit pre-image lives in INCIDENTS.md, deliberately not in Firestore `auditLogs`. |

> ⚠️ **Known and accepted:** `salownParseEmails` continues to log `whitecross IMAP error: Command
> failed` every 5 minutes. The Gmail app password was intentionally revoked by the owner; whitecross
> is deliberately becoming PIPE_ONLY. Credentials were NOT restored here — the intentional-skip
> contract belongs to the separate PIPE_ONLY package.

## 2026-07-26 — Booking Detail extras/price fix (hosting only)

> Single-target manual deploy, project `havuz-44f70`, salown-app HEAD `f30ae4a`. No functions, no rules,
> no `salown-staff`. Push carried `[skip ci]` on HEAD so CI's blanket `--only hosting` never fired —
> confirmed by the release list (exactly one new `salown` release, `salown-staff` untouched since 07-24).

| Item | Commit(s) | Repo / target | State | Notes |
|---|---|---|---|---|
| Booking Detail extras → folded `price` fix | `694c2bb` | salown-app / hosting | ✅ **Deployed + live-verified** | Deployed 2026-07-26 18:39Z, `firebase deploy --only hosting:salown --project havuz-44f70` (NOT `--only hosting`). Live bundle `index-D0JrelmL.js` == local build of HEAD `f30ae4a`; release `1785091173083000`; exactly one new release; `salown-staff` release ID + timestamp unchanged. Gates before deploy: clean tree, `main == origin/main`, zero active claims, 266/266 vitest, typecheck clean, Vite build ok, `diff --check` clean, 5/5 price-arithmetic scenarios. Prod writes during deploy+verification = 0 (Sanga's record re-read only: CHECKED_OUT, £32 total = £10 deposit + £22 at venue, `soldAddOns` []). Functions + rules untouched. See INCIDENTS 2026-07-26. |

## Superseded snapshot (2026-07-24, rev. 13:22 UK)

| Item | Commit(s) | Repo / target | State | Notes |
|---|---|---|---|---|
| Booksy barber slot-tombstone fix | `41e2bc1` | salown-app / functions | ✅ **Deployed + live-verified** | Parser slot-tombstone barber fix; deployed and verified live. |
| Parser Canary Slice 3B | `7d6eb25` | salown-app / functions | ✅ **Deployed + live** | Canary persist slice, live. ⚠️ Commit `7d6eb25`'s message is the **2026-07-23 website add-on release** (`fix(checkout+grid+email): website add-on…`) — the combined functions/hosting deploy at that commit is what carried the persisted-canary slice live, superseding the earlier "3B persist not deployed" note. Confirm with owner if the 3B label should point at slice commit `381477b` instead. |
| salown-app staff-shift work — **hosting half** | `847e8f6`, `9bb65ed` (+ `8ddd91a`…`9c8ef84`) | salown-app / hosting | ✅ **Deployed + live-verified** | **Row corrected 2026-07-24 16:05.** Effective-shift SSOT + 15-min overrun allowance are LIVE in the `salown` bundle. Basis: live JS carries the resolver reason strings and its `BookingForm` chunk is byte-identical to a post-allowance build (see "Hosting baseline" above). |
| salown-app staff-shift work — **functions half** | `e879220` | salown-app / functions | ✅ **Deployed + live-verified** | **Shipped 2026-07-25** in the targeted `salownRescheduleByToken` deploy (Stage 1). The server reschedule guard's shift-window + fit enforcement is now live (`salownreschedulebytoken` hash `00727dc8`, ACTIVE, europe-west2). |
| Premium staff-shift (whitecross-site) | `e0003845` | whitecross-site (separate repo) | 🟡 **On origin/main, NOT deployed** | Premium-site mirror of the staff-shift change; on `origin/main`, **not deployed**. Separate manual deploy for the premium tenant. |
| July UI recovery | `775268ec` | salown-app / hosting | ♻️ **Live, no new deploy** | Commit **records** UI that is already live; it does **not** introduce a new deploy. Do not re-deploy on its account. |
| UK phone-identity implementation | — | salown-app / functions + hosting | ⬜ **Not started** | Identity handoff (`HANDOFF_uk_phone_identity.md`) — package **I1** in the migration plan. No code on `origin/main`. |
| BSP-C1 `salownCreateBooking` callable | `cb88af0`, `6d2859f`, `0c3a599` | salown-app / functions | ✅ **Deployed + live-verified** | Targeted deploy 2026-07-24 12:21:54Z: `firebase deploy --only functions:salown:salownCreateBooking --project havuz-44f70` → **CREATE**, `europe-west2`, nodejs22, rev `salowncreatebooking-00001-hab`, state ACTIVE. Live-verification basis: negative smoke (`{"data":{}}` and forged `price`/`startTime`) → HTTP 400 `INVALID_INPUT` **before any Firestore write**; booking counts unchanged across all 5 tenants (**prod writes = 0**); no successful production booking was created. **The callable is live but UNUSED** — nothing calls it until H1/W1 cut over. |
| B2 booking-settings (P1 validator) | `2a3ab96` | salown-app / functions | ✅ **Live via C1** | Pure P1 validator shipped inside the C1 functions deploy above (it had no deploy of its own by design). |
| C1 reschedule-guard thread (`salownRescheduleByToken`) | `cb88af0` | salown-app / functions | ✅ **Deployed + live-verified** | **Shipped 2026-07-25** (Stage 1). The resolved `shiftOverrunAllowanceMins` is now threaded into the live reschedule guard (`functions/src/index.ts:1430`); the hardcoded `15` is gone. `salownRescheduleByToken` ACTIVE, hash `00727dc8`. Negative smoke: `INVALID_ARGUMENT` / `NOT_FOUND` before any mutation. |
| BSP-H1 hosted booking cutover | `9480185` (+ lint `5d5def4`) | salown-app / hosting | ✅ **Deployed + live-verified** | **Shipped 2026-07-25** (Stage 2, salown release `1785005794084000`). `BookingPage.tsx` creates via `salownCreateBooking` in `callable` mode; smoke-verified live (callable markers in bundle `index-CLNge9uB.js`, no public `clients` read, no legacy addDoc fallback, checkout on `docId`, entered-name success preserved). Rollback = flip `HOSTED_BOOKING_CREATE_MODE` to `'legacy'` + redeploy hosting. |
| BSP-I2 canonical identity (hosting + staff bundle) | `321ff19` | salown-app / hosting | ✅ **Deployed + live-verified** | **Shipped 2026-07-25** with the Stage-2 hosting deploy (`phoneCanonical` marker present in the live salown bundle). Staff-bundle half is built from the same source but **not released** — salown-staff release unchanged; it will ship on the next `salown-staff` deploy. |
| Parser-3C lint cleanup | `80d9a95` | salown-app / hosting | ✅ **Deployed** | Dead `PARSER_HEALTH`/`PARSER_DATA_LOSS` imports dropped from `ParserImportHealthPanel.tsx` (owner-authorized one-line cleanup, 2026-07-25); shipped in the Stage-2 bundle. |
| BSP-R1 phase (a) — booking-create rules | `2a6a641` (+ docs `03b5fb3`) | salown-app / **firestore rules** | ✅ **Deployed + live-verified** | **Shipped 2026-07-25 LAST** (Stage 3). New live ruleset **`323f1726-f6bf-4d6e-b9b9-24e152f6e494`** (2026-07-25T19:14:08Z), byte-identical to local `firestore.rules`. Anonymous booking create rejects the 7 server-owned keys (`clientManualId`, `matchedBy`, `identityLinkedBy`, `identityLinkedAt`, `clientPhoneCanonical`, `emailCanonical`, `note`); anonymous create itself **stays allowed** (locked decision 18). Live-verified via Rules Test API on the deployed ruleset: **131/131** (7 keys DENY, hosted+premium single/group ALLOW, staff BLOCKED/Busy ALLOW, cross-tenant isolation intact, 3 phase-B guards ALLOW). **Rollback target = `1474907b-af60-4bb4-a54a-8026c6c61273`** (`firestore.rules.ROLLBACK.txt` refreshed with both ids). |
| BSP-W1 / R1 phase (b) | — | salown-app + whitecross-site | ⬜ **Not started** | W1 premium cutover; R1 **phase (b)** (deny anonymous create) remains blocked on W1 + E1 (H1 now live). Phase (a) is **live** as of 2026-07-25 — see the R1 phase (a) row above. R1 rules LAST. |
| Parser Canary Slice 3C | `308a7c0` | salown-app / functions | ✅ **Deployed + live-verified** | **Shipped 2026-07-25** (Stage 1; parsers share hash `d6a301e1`). First natural 5-min cron runs (11:12–11:27Z) wrote reason-coded ledgers on live `parserStats`: `herohairs/treatwell` {ALREADY_APPLIED, DUPLICATE_EXTERNAL_ID, TARGET_NOT_FOUND}, `whitecross/booksy` {DUPLICATE_EXTERNAL_ID, FILTERED_NON_BOOKING}, `whitecross/fresha` {FILTERED_NON_BOOKING}. All `outcome:success`, `errorCount:0`, `dataLossSignal:NONE`, zero UNKNOWN_SKIP / MISSING_REQUIRED_FIELDS, no PII. Shadow/reporting mode (no alert). |
| Super Admin health surface | `308a7c0` (+ lint `80d9a95`) | salown-app / hosting | ✅ **Deployed + live-verified** | **Shipped 2026-07-25** (Stage 2). Per-source import-health panel behind `isSuperAdmin` in Settings → Integrations; `isSuperAdmin` gate confirmed in the deployed bundle (ordinary tenants cannot see it). With the 3C functions side now live (same wave, Stage 1), it renders real reason-coded documents. Renders counts/codes only — stored `lastRun.errors` never shown. |

---

## Pending-deploy watch (🟡 rows — the risk list)

These are the rows where **`origin/main` is ahead of production**. Until they deploy, do not describe
their behavior as live.

> **Cleared by the 2026-07-25 wave** (all now ✅ live — see the table above): staff-shift functions half
> `e879220`, BSP-I2 hosting `321ff19` (staff-bundle half still pending a `salown-staff` deploy), BSP-H1
> `9480185`, Parser-3C `308a7c0` (both halves), C1 reschedule-guard thread `cb88af0`, R1 phase (a) `2a6a641`.

- **BSP-I2 staff-bundle half** `321ff19` — the staff app (`salown-staff`) still runs the pre-I2 bundle; ships on the next `salown-staff` deploy (this wave deployed `hosting:salown` only).
- **premium staff-shift** `e0003845` — `whitecross-site` separate manual deploy pending.
- **`?testMode=1` canary removal** (`whitecross-site` `script.js`, in `8dcdebc7`) — 🟡 **hosting NOT
  deployed.** The server-side rejection is live, so the hole is closed; this is defence-in-depth.
  Deploy with `firebase deploy --only hosting:whitecrossbarbers-saas --config firebase.saas.json`.
- **BSP-W1 premium cutover** — ⬜ not started; blocks R1 phase (b).
- **E1 payment E2E** — ⬜ not started; gates R1 phase (b).
- **R1 phase (b)** deny-anonymous-create — ⬜ blocked on W1 + E1; rules LAST when it lands.

> **Cross-repo caution:** the staff-shift slot rule is hand-mirrored across the `salown-app` ⇄
> `whitecross-site` CJS boundary. Deploying one side without the other leaves the hosted and premium
> booking surfaces on **different** slot rules. Coordinate both 🟡 rows in the same rollout.

---

## How to update this file

1. When something deploys, change its state mark, and record the **live-verification** basis (what you
   checked, not just "deployed").
2. Keep the retrospective narrative in `salown-app/SYNC.md`; keep the plan in `ROADMAP.md`. This file is
   only the push-vs-live gap.
3. Re-stamp the snapshot date at the top when you revise.
