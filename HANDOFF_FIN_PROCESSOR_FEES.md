# HANDOFF — FIN-PROCESSOR-FEES (Stripe fees → Finance) · 2026-09-15

> Start here for any new session on processor fees, the settlement ledger (FIN-B1/B1b), the Finance fee display (B2)
> or the fee-day rules. **No deploy, flag, Stripe setting, production write or real refund has been approved.**
> Automatic refunds (BL-4) are a separate lane and must not be bundled with this work.

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
| **B1b** refund entries | **BLOCKED** by the claim above — no code | fold already reads `REFUNDED` + `refundsComplete`; missing: writer, `stripe:re_…` ids, partial/full/repeated-event tests |
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

1. **B1b claim:** release `FIN-B1-SETTLEMENTS` or hand it over (whitecross-site registry). Without it B1b cannot start.
2. **T18 re-checkout:** a correction re-checkout overwrites `checkedOutAt` (`src/firestoreActions.ts` ~680/787). Is the
   fee day the first or the latest checkout time?
3. Fee left on a payment cancelled or fully refunded **without** checkout: which day, if any?
4. Refund day, including closed periods.
5. B1 production release approval. Before it: re-run preflight §6, read the live Stripe endpoint event list (Dashboard),
   decide how `settlementLedgerEnabled` is written (no tool exists).
6. When to start B2 P&L / Bank Balance (after 2–4 and B1 live).

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
  whitecross-site, claim in its own `ops/claims/`.
- `tsc --noEmit` inside a fresh worktree reports 5 environment errors (node types, `functions/lib`) that are not from
  this work.
- `gh` is not installed on this machine, so CI runs cannot be listed from the CLI.

## 6. First steps for the next session

1. Read ROADMAP `FIN-PROCESSOR-FEES` row, then this file, then `PROCESSOR_FEES_PLAN.md` §5.1, §7.1, §8, §9.
2. `git fetch` all three repos; `claims.sh list` in salown-app and `ls ops/claims` in whitecross-site.
3. Ask the owner which open item (§4) to take; do not pick a fee-day sub-policy on your own.
