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
> **Snapshot date:** 2026-07-24 (revised 16:05 UK during BSP-H1; see the hosting-baseline correction below). Verify against `git log origin/main` + the live system before acting;
> a row here is a claim about a moment, not a standing guarantee.

---

## Hosting baseline — what is ACTUALLY live (measured 2026-07-24 16:05 UK)

**Live `salown` hosting release = `ad20475`** ("I1 canonical UK phone foundation"), not an older commit.

*Method (repeatable, no production data touched):* fetch `https://salown.web.app/public-bundle/index.html`,
read the emitted asset name, then rebuild candidate trees (`git archive <sha> | tar -x`, symlinked
`node_modules`, `npx vite build`) and compare. `ad20475`'s build emits **`index-DdVeuO0D.js`** — the exact
file the live page loads — and its hash-normalized content is byte-identical to live. `321ff19` (BSP-I2)
produces a different bundle and its marker strings (`phoneCanonical`) are **absent** from the live JS.

**Correction to the previous snapshot:** the staff-shift row below claimed the whole
`847e8f6`/`e879220`/`9bb65ed` set was undeployed. That is true only of the **functions** half. The
**hosting** half has been live since at least `9c8ef84`: the live bundle contains the central resolver's
reason strings (`shift-open`, `salon-fallback`, `off-day`, `day-closed`, introduced in `8ddd91a`) and its
`BookingForm` chunk is byte-identical to a post-allowance build. Push-vs-live for hosting is now measured,
not inferred from `[skip ci]` markers.

**Main-vs-live hosting delta (frontend that would ship on the next hosting deploy):**

| Commit | What ships | Notes |
|---|---|---|
| `321ff19` | BSP-I2 canonical identity queries — `src/firestoreActions.ts`, `src/pages/Clients.tsx`, `src/pages/Settings.tsx`, `src/components/BookingDetailPanel.tsx`, `src/staff/sheets/ClientDetailSheet.tsx`, `src/utils/clientIdentityQueries.ts`, `src/utils/ukPhone.ts` | Latent since 2026-07-24; not live |
| `9480185` | BSP-H1 hosted booking cutover — `src/pages/BookingPage.tsx`, `src/utils/hostedBooking*.ts` | The cutover itself; see the H1 row |
| `2a3ab96` | B2-P1 resolver | **Bundle-neutral before H1** (nothing imported it); H1 now imports it |

⚠️ **`--only hosting` deploys BOTH sites.** `firebase.json` defines `salown` **and** `salown-staff`, each
with a predeploy build hook (`npm run build` / `npm run build:staff`). The CI workflow runs
`firebase deploy --only hosting`, so a hosting deploy also rebuilds and ships the **staff app** from
current `main` — today that includes the latent I2 `ClientDetailSheet` change. Sequence and announce both.

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

## Current deploy state (2026-07-24, rev. 13:22 UK)

| Item | Commit(s) | Repo / target | State | Notes |
|---|---|---|---|---|
| Booksy barber slot-tombstone fix | `41e2bc1` | salown-app / functions | ✅ **Deployed + live-verified** | Parser slot-tombstone barber fix; deployed and verified live. |
| Parser Canary Slice 3B | `7d6eb25` | salown-app / functions | ✅ **Deployed + live** | Canary persist slice, live. ⚠️ Commit `7d6eb25`'s message is the **2026-07-23 website add-on release** (`fix(checkout+grid+email): website add-on…`) — the combined functions/hosting deploy at that commit is what carried the persisted-canary slice live, superseding the earlier "3B persist not deployed" note. Confirm with owner if the 3B label should point at slice commit `381477b` instead. |
| salown-app staff-shift work — **hosting half** | `847e8f6`, `9bb65ed` (+ `8ddd91a`…`9c8ef84`) | salown-app / hosting | ✅ **Deployed + live-verified** | **Row corrected 2026-07-24 16:05.** Effective-shift SSOT + 15-min overrun allowance are LIVE in the `salown` bundle. Basis: live JS carries the resolver reason strings and its `BookingForm` chunk is byte-identical to a post-allowance build (see "Hosting baseline" above). |
| salown-app staff-shift work — **functions half** | `e879220` | salown-app / functions | 🟡 **On origin/main, NOT deployed** | The server reschedule guard's shift-window + fit enforcement is still unshipped; the 2026-07-24 deploy was scoped to `salownCreateBooking`. Ship with the H1/W1 functions rollout. |
| Premium staff-shift (whitecross-site) | `e0003845` | whitecross-site (separate repo) | 🟡 **On origin/main, NOT deployed** | Premium-site mirror of the staff-shift change; on `origin/main`, **not deployed**. Separate manual deploy for the premium tenant. |
| July UI recovery | `775268ec` | salown-app / hosting | ♻️ **Live, no new deploy** | Commit **records** UI that is already live; it does **not** introduce a new deploy. Do not re-deploy on its account. |
| UK phone-identity implementation | — | salown-app / functions + hosting | ⬜ **Not started** | Identity handoff (`HANDOFF_uk_phone_identity.md`) — package **I1** in the migration plan. No code on `origin/main`. |
| BSP-C1 `salownCreateBooking` callable | `cb88af0`, `6d2859f`, `0c3a599` | salown-app / functions | ✅ **Deployed + live-verified** | Targeted deploy 2026-07-24 12:21:54Z: `firebase deploy --only functions:salown:salownCreateBooking --project havuz-44f70` → **CREATE**, `europe-west2`, nodejs22, rev `salowncreatebooking-00001-hab`, state ACTIVE. Live-verification basis: negative smoke (`{"data":{}}` and forged `price`/`startTime`) → HTTP 400 `INVALID_INPUT` **before any Firestore write**; booking counts unchanged across all 5 tenants (**prod writes = 0**); no successful production booking was created. **The callable is live but UNUSED** — nothing calls it until H1/W1 cut over. |
| B2 booking-settings (P1 validator) | `2a3ab96` | salown-app / functions | ✅ **Live via C1** | Pure P1 validator shipped inside the C1 functions deploy above (it had no deploy of its own by design). |
| C1 reschedule-guard thread (`salownRescheduleByToken`) | `cb88af0` | salown-app / functions | 🟡 **On origin/main, NOT deployed** | Commit `cb88af0` also threaded the resolved `shiftOverrunAllowanceMins` into the reschedule guard (`functions/src/index.ts:1430`, inside **`salownRescheduleByToken`**), killing the hardcoded `15`. The 2026-07-24 deploy was scoped to `salownCreateBooking` **only**, so this function still runs its **previous** code with the hardcoded `15`. Ship it with the H1/W1 functions rollout. |
| BSP-H1 hosted booking cutover | `9480185` | salown-app / hosting | 🟡 **On origin/main, NOT deployed** | `BookingPage.tsx` creates via `salownCreateBooking`; legacy direct-create kept behind the build-time switch `src/utils/hostedBookingCutover.ts` (`HOSTED_BOOKING_CREATE_MODE`, default `'callable'`, no automatic fallback). Committed `[skip ci]`, so **no hosting deploy fired**. ⚠️ Because the switch defaults to `callable`, **any** hosting deploy from `main` — including one triggered by unrelated work — ships the cutover. Gate it: `salownRescheduleByToken` targeted functions deploy FIRST, then hosting, announced. Rollback = flip the constant to `'legacy'` + redeploy hosting. |
| BSP-W1 / R1 | — | salown-app + whitecross-site | ⬜ **Not started** | W1 premium cutover, R1 rules — **explicitly excluded** from the 2026-07-24 C1 deploy and from H1. R1 rules LAST. R1 phase (a) is authored-and-ready work that must land with/before the H1 hosting deploy (see the parent plan). |
| Parser Canary Slice 3C | — | salown-app / functions | ⬜ **Not started** | Follow-on to 3B; not started. |
| Super Admin health surface | — | salown-app | ⬜ **Not started** | Not started. |

---

## Pending-deploy watch (🟡 rows — the risk list)

These are the rows where **`origin/main` is ahead of production**. Until they deploy, do not describe
their behavior as live, and remember any *new* deploy of `salown-app` `main` (including an unrelated
hosting auto-deploy) ships the staff-shift hosting changes with it — sequence and announce accordingly.

- **salown-app staff-shift (functions only)** `e879220` — hosting half is live (see baseline); the server reschedule guard is not.
- **BSP-I2 frontend** `321ff19` — hosting + staff bundle; ships with the next hosting deploy.
- **BSP-H1 hosted cutover** `9480185` — hosting; the switch defaults to the callable, so it goes live with any hosting deploy.
- **premium staff-shift** `e0003845` — `whitecross-site` separate manual deploy pending.
- **C1 reschedule-guard thread** `cb88af0` — `salownRescheduleByToken` still on the hardcoded `15`; a targeted single-function deploy left it behind. A targeted deploy ships **only the named function**, even when the same commit changed others.

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
