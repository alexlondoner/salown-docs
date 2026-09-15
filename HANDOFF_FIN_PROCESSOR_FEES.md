# HANDOFF — FIN-PROCESSOR-FEES (Stripe fees → Finance) · 2026-09-15

> Start here for any new session on processor fees, the settlement ledger (FIN-B1/B1b), the Finance fee display (B2)
> or the fee-day rules. **No deploy, flag, Stripe setting, production write or real refund has been approved.**
> Automatic refunds (BL-4) are a separate lane and must not be bundled with this work.

> **Update 2026-09-15 evening — read this before §1:**
> - **B1b:** whitecross-site `95a963fe`, SOURCE_READY_NOT_DEPLOYED. The claim was handed over with owner approval
>   (`ef17f1f6`) and released (`3668c506`); no claim of this stream is open in either repo.
> - **B2a UX:** salown-app `9a4925c`, PUSHED_NOT_LIVE.
> - **The B1 release source stays pinned at `22850996`.** whitecross-site `main` now carries unrehearsed B1b, so never
>   deploy `stripeWebhook` / `wcSettlementSweeper` from it.
> - Still open for the owner:
>   - the T18 write-once first checkout time (not built);
>   - the no-checkout fee date;
>   - the open-period refund day;
>   - B1 release approval;
>   - a B1b rehearsal and preflight before any release that includes it.
> - The §1 table below is the morning snapshot.

## 1. State at hand-off (verified 2026-09-15)

| Repo | HEAD = origin/main | Tree |
|---|---|---|
| salown-app | `2cb1411` | clean, 0/0 |
| docs | `7ddbb31` | clean, 0/0 |
| whitecross-site | `22850996` | clean, 0/0 |

No claim of this work stream is open. Still open and **not ours**:
- salown-app: `WHATSAPP-B7`.
- whitecross-site: `FIN-B1-SETTLEMENTS--alish--finance-passive-hide.claim`, which holds `functions/settlements.js`,
  `settlements.test.js`, `settlements.fakes.js` and `stripeWebhook.integration.test.js` "until production release".

No prototype server is running.

## 2. What exists

| Package | Status | Where |
|---|---|---|
| Phase 0 online tender leg (gross only) | `LIVE_VERIFIED` | R-2026-09-05-B |
| B0 data contract | DONE (docs) | `PROCESSOR_FEES_PLAN.md` §2–§7 |
| **B1** Stripe captures + actual fees | rules arm **LIVE** (ruleset `5e102dd4-…`, R-2026-09-10-C). Functions, index and flag **NOT deployed**; `settlements` count 0 | wc `8137711b`, sa `9a9547a`; release package `FIN_B1_RELEASE_PREFLIGHT.md` (candidates wc `22850996` / sa `b6c325c`, no rules step) |
| **B1b** refund entries | **SOURCE_READY_NOT_DEPLOYED** (2026-09-15) — *not* in the B1 release pinned at `22850996` | whitecross-site `95a963fe` (claim handed over `ef17f1f6`, index.js `977062bb`, released `3668c506`); 201/201 tests; rules, ids and known limits in plan §8 B1b row |
| **B2a UX** refund summary + fee cost | **PUSHED_NOT_LIVE** (2026-09-15) | salown-app `9a4925c` (claim `ac19c29` → `9175536`, SYNC `ab6c1dd`); see §4a |
| **B2a** policy-free reader + booking-detail fee block | **PUSHED_NOT_LIVE** | salown-app `74922bd` (claim `96200b6` → released `7b03fd9`): `src/utils/settlementFacts.ts`, `src/components/OnlinePaymentFees.tsx`, mount in `BookingDetailPanel.tsx`; 37 new tests, panel suites 137/137 |
| B2 P&L / Bank Balance / fee-day grouping | PLANNED — not started | waits on §4 decisions |
| B3 history backfill, B4 Reports, B5+ other providers | PLANNED | plan §8 |
| Local UX prototype (synthetic) | docs only | `prototypes/fin-fees/` (`./run.sh check` · `PROTO_PORT=… ./run.sh serve`), screenshots `evidence/fin-processor-fees/2026-09-14-prototype/` |

## 3. Owner decisions already made

- **Fee day (2026-09-15):** the salon-time-zone calendar day of `booking.checkedOutAt`, not the appointment, payment or
  payout day. A late fee keeps that checkout day. A closed period is corrected only through the existing post-close
  adjustment. No `checkedOutAt` means review, with no fallback. A no-checkout fee is a separate decision.
  Canonical text: plan §9; tests T11–T18 in §7.1.
- **Revenue date is not to be changed.** Finance, Reports and Sales book revenue on `startTime`. Impact is measured in
  plan §5.1: 6 of 150 online-paid whitecross bookings would carry fee and revenue on different days, 4 of them in
  different months.
- **UX:** product copy and design notes are kept apart. Unknown fees are never £0. Gross − fee is never presented as
  bank money.

## 4. Open — needs the owner

1. ~~**B1b claim**~~ — **HANDED OVER 2026-09-15 (owner-approved).** Re-checked immediately before the change: claim
   blob `4791dfe0` unchanged since `a5da93d4`, no commit to the four files after 2026-09-08, no live session with that
   owner id. whitecross-site `ef17f1f6` retired `FIN-B1-SETTLEMENTS` (reason recorded in the commit and the new claim)
   and opened `FIN-B1B-REFUNDS` (`alish/fin-processor-fees`) on the same four files. `977062bb` extended it to
   `functions/index.js`: the BL-5 refund block answers 200 and returns before the settlement call, so refund events
   never reached `settlements.js`. **The B1 release source stays pinned at `22850996`; B1b code is not part of it.**
   The pre-hand-over analysis follows, kept for the record:
   `FIN-B1-SETTLEMENTS--alish--finance-passive-hide.claim` is still on whitecross-site `origin/main` (last change
   `a5da93d4`, 2026-09-08). The owning lane's last registry activity is salown-app `a1f214f` (2026-09-10); no peer
   session in `ListAgents` carries that id. **B1b cannot route around the held files:** `classifyEvent`
   (`settlements.js:484`) does not route `charge.refunded`, and no caller passes `refundsComplete` to `foldSettlements`
   (`:297`). A refund writer in a new file would leave the B1 writer re-folding the projection without refunds, flipping
   `settledNetStatus` back to `refunds_not_recorded`. Proposed separation:
   - (a) The B1 release is pinned by SHA, not by a path lock: whitecross-site `22850996` (optionally tagged, e.g.
     `fin-b1-rc1`), deployed from a `git archive` of that SHA as the preflight already requires. Preflight §1/§6 re-checks
     then compare the four files against the pinned SHA, not against `origin/main`.
   - (b) The owner authorises one hand-over commit in the whitecross-site registry that retires this claim, and B1b opens
     its own claim on the same four files (plus `functions/refunds.js` / `index.js` if its wiring needs them).
   - (c) B1b work on `main` never changes the B1 candidate. A later candidate that contains B1b is a new rehearsal and a
     new preflight, not an amendment.
   - Owner's yes is needed before (b). Until then B1b stays `BLOCKED`.
2. ~~**T18 re-checkout**~~ — **decided 2026-09-15:** the fee day is the first successful checkout time. A real date change
   is a separate audited operation. A first time the data cannot show is not estimated and goes to review. **Build gap:**
   the checkout writer overwrites `checkedOutAt` (`src/firestoreActions.ts` ~680/787), so a write-once first-checkout time
   is needed. Field name and package are not decided.
3. No-checkout fee (paid, then cancelled/refunded): **the date is deliberately left open.** Choose it from a worked example
   in which the cancellation and the refund fall on different days.
4. Refund day: closed periods are **confirmed** (never silent, post-close adjustment only). **Which open-period day** a
   refund lands on is still open.
5. B1 production release approval — **its own release lane, the one that starts fee collection.** B2a verification does
   not wait for it. Before it: re-run preflight §6, read the live Stripe endpoint event list (Dashboard), decide how
   `settlementLedgerEnabled` is written (no tool exists).
6. When to start B2 P&L / Bank Balance (after 3–4, the T18 writer, and B1 live).

### 4a. B2a local verification — 2026-09-15 (no deploy, no production read or write)

Source `2cb1411` (contains `74922bd`), exported with `git archive` into the scratchpad; `npm ci` root + functions;
`functions` `npm run build`.
- `tsc --noEmit`: **0 errors** with `functions/lib` built. Without it the same 5 errors reappear: 2× TS2307 in
  `src/utils/staffLifecycle.test.ts` (imports `functions/lib/staff/lifecycleRehire.js`) and 3× TS2591 `node:fs` in test
  files. **The 3 node-type errors are a real latent config dependency:** the root has no `@types/node`, and node types
  reach the root program only through `functions/lib` declarations. None is in a B2a file. Not fixed (out of scope).
- `vite build` OK. B2a + panel suites 99/99. eslint 0 on the touched files.
- Full vitest in the **main repo**: 191/191 files, 5606 tests. Inside a `git worktree` the same run fails 3 tests:
  `ops/rules-authority.test.js` refuses any worktree carrying `firebase.json` by design, and the
  `functionsArchiveManifest` negative control needs the untracked `functions/.secret.local`. **A git worktree left behind
  makes every other session's `npm test` red.** Use a `git archive` copy for verification and remove worktrees promptly.
- Browser: the full Admin panel (`/app/bookings` → BookingDetailPanel drawer), served by a scratch Vite on `127.0.0.1:5317`
  with `src/firebase.ts` aliased to an emulator shim. Project `demo-salown-b2a`, Auth + Firestore emulators with the repo's
  rules (byte-identical, `f298bd20`), password-free custom-token sign-in for a synthetic owner, 12 synthetic bookings.
  All 12 render as the reader specifies: known −£0.58 / net £24.42 exact; pending "Awaiting Stripe"; before-start and
  no-record "Not recorded"; estimate "≈ −£0.60"; 2 charges partial + "Charged more than once"; unresolved and malformed
  "Needs review"; full and partial refund rows; **Connect and cash show no block**. No console errors. Screenshots:
  `evidence/fin-processor-fees/2026-09-15-b2a-browser/`.
- **Copy note for the owner, not a defect:** a full refund shows the net as "up to −£0.58". It is arithmetically right
  (Stripe keeps the fee and the fee on a refund is unknown), but "up to" with a negative amount reads oddly.
- **Visual observation (screenshot 02), not changed:** on a refunded booking the refund appears twice. The existing
  Payment section shows "Refunded £25.00" in green; the new block shows "Refunded −£25.00" in orange. Same money,
  different sign and colour. Owner decision whether B2 should drop one of them.
- **Both notes above: FIXED 2026-09-15 (owner direction), salown-app `9a4925c`, PUSHED_NOT_LIVE, no deploy.**
  - One refund summary: on payments the fee block covers, the legacy Payment-section "Refunded" row is suppressed.
    Connect and other types are unchanged.
  - No negative "up to":
    - exact → "Remaining fee cost £0.58";
    - incomplete → "Known fee cost · Not final — <missing scope>";
    - unknown → "Fee cost · Not known yet";
    - estimate → "Estimated fee cost ≈".
  - Reader gains `refundsComplete`.
  - Checks:
    - suites 82/82, tsc 0; full vitest 5616/5616 in the main repo;
    - panel check against emulators with 15 synthetic bookings, including a full refund with a complete ledger, a full
      refund with a pending fee and a Connect refund;
    - screenshots 03 and 04 in the evidence folder.
  - **This is display only.** Fees are not written to P&L, and the write-once first checkout time (T18) is not built.

Record corrections made on 2026-09-14/15 are listed in `evidence/fin-processor-fees/2026-09-14-status-audit.md` §8.
The recorded Stripe endpoint list (2026-08-29) has `charge.refunded` but **no capture/fee-update event such as
`charge.updated`**; the current list is unverified.

## 5. Traps seen in this stream

- **Always `git commit -- <paths>`.** Twice in this stream a pathspec-less commit could sweep another session's
  staged files. It happened once, in docs `01be737`, which carried 8 STAFF-AVAIL-GAP-P2 evidence files; provenance is
  recorded in `0ab4376`.
- Another session may run emulators. Check `pgrep -fl emulators` and memory before heavy tests or serving the
  prototype. Never use port 5173.
- Implement salown-app changes in an isolated worktree, push `HEAD:main` with `[skip ci]`, and claim first. In
  whitecross-site, claim in its own `ops/claims/`. **Remove the worktree as soon as the push is done:** while any
  worktree carrying `firebase.json` exists, `ops/rules-authority.test.js` fails for every session. For verification use
  a `git archive` copy in the scratchpad (§4a).
- ~~`tsc --noEmit` reports 5 environment errors~~ — corrected 2026-09-15: install `functions` deps and run its
  `npm run build` first, then `tsc` is 0. Three of the five are a real latent dependency (the root has no `@types/node`;
  node types arrive only via `functions/lib`), recorded in §4a, not fixed.
- `gh` is not installed on this machine, so CI runs cannot be listed from the CLI.

## 6. First steps for the next session

1. Read ROADMAP `FIN-PROCESSOR-FEES` row, then this file, then `PROCESSOR_FEES_PLAN.md` §5.1, §7.1, §8, §9.
2. `git fetch` all three repos; `claims.sh list` in salown-app and `ls ops/claims` in whitecross-site.
3. Ask the owner which open item (§4) to take; do not pick a fee-day sub-policy on your own.
