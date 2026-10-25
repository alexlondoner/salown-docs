# HANDOFF — MEMBERSHIP-CHECKOUT-VOID (2026-10-25)

## 0. State in one line

`salownCheckoutBooking` runs the VOID r2 release `R-2026-10-25-A` (`-00009-sam`, source `73d0a8fb`). Status **`LIVE_VERIFIED_ARTEFACT / DORMANT_NO_TRAFFIC`**, window exception **`EXTERNAL_GET_PROBE_ACCEPTED_THIS_RELEASE_ONLY`**. **NOT OWNER_VERIFIED.** The void has never run in production. Membership is off on every tenant and there are 0 server checkouts.

## 1. What is live

| Item | Value |
|---|---|
| Unit | `functions:salown:salownCheckoutBooking` (europe-west2, nodejs22) |
| Revision | `salowncheckoutbooking-00008-vob` → `salowncheckoutbooking-00009-sam`, 2026-10-25T09:22:29Z |
| Source | `73d0a8fb300e59c6380ecc2c005e958bba409317`, tree `06a958ea`, single parent `ba888c48` (the live B3 source, R-2026-10-15-D) |
| Branch | `origin/release/membership-checkout-void-r2-on-live-ba888c48` |
| Product bytes | `executor.ts` and `voidExecutor.ts` are byte-identical to r1 `84d10934` (SUPERSEDED, approval R-2026-10-18-A spent unused) |
| r2 additions | tests only: unknown-outcome commit → safe replay (EMU 36/37); nothing raw reaches the caller (EMU 38 + 4 static/wire tests) |
| Config | timeout 60 · maxInstances 20 (both declared resets, owner ACK) · concurrency 80 · 256Mi · no secrets · env unchanged |
| Rollback | `rollback-void.sh` → `ba888c48`, own approval `MEMBERSHIP-CHECKOUT-VOID-FN-ROLLBACK-<date>`. A committed void is not undone. Not used. |

Main's unapproved checkout work (C2a, Connect D, refund R3, pricing state) is **not** in production: the candidate was cut on the live lineage, not on main.

## 2. Evidence

- Kit: `~/release-work/membership-checkout-void-r2/` (tooling digest `eb0ac953f63a4997be96a95c40e749cfce805a94af9fcdd747385fa641d11dfd`, 57 files).
- Freeze: `runs/freeze-20261024T231713Z`.
- Final gates (pre-approval): `runs/gates-20261024T232046Z`, 16/16 PASS.
- Check-only: `runs/deploy-20261025T011306Z`; rollback check-only: `runs/rollback-20261025T011557Z`.
- Deploy: `runs/deploy-20261025T072633Z` (gates rerun inside it, 16/16 PASS; `LIVE.void.candidate.json`; `traffic-classify.json`); console `runs/console-deploy-r2.log`.
- r1 kit `~/release-work/membership-checkout-void/` is kept untouched as evidence.

Test numbers: emulator 42/42; mutation 87/87 killed; negative control 6/6 (N1–N4, W1–W2 each survive the r1 suite and are killed by r2); failing set candidate == base (1 baseline placement guard).

## 3. Window

Passive 900 s, no call, no smoke, 09:20:55Z → 09:40:36Z. 0 callable / POST requests; all checkout-void and membership groups 0 and unchanged. Traffic gate exit 8 = 4 Google GET probe requests (`2607:f8b0…`, 2× `GET /` 400, 2× `GET /favicon.ico` 404) + their 8 WARNING/ERROR lines. Owner accepted `ACCEPT_VOID_WINDOW=EXTERNAL_GET_PROBE_4_REQ_8_LINES` for this release only.

## 4. Owed — in order, each its own scope

1. ~~**Main twin (CC + B3 + VOID)**~~ — ✅ DONE 2026-10-25: salown-app main `6281f76c` (no deploy, `[skip ci]`), SYNC + claim removal `15752293`. See §6.
2. **Production canary on a demo tenant** — separate scope, own data-cleanup / rollback plan, own dated owner approval. **Mandatory before membership is enabled for any tenant.** Only after it can the status move beyond `DORMANT_NO_TRAFFIC`.
3. E-Admin → E-Staff (MEMBERSHIP-PHASE1 plan), each its own approval.
4. **`MEMBERSHIP-VOID-C2A-ADVANCE-COMPAT`** (open debt, see §6) — before C2a ships to production or Membership is enabled on any tenant.

## 5. Do not

- Do not deploy `84d10934` or `ea37bbcc` (wrapper refuses both).
- Do not call this release OWNER_VERIFIED.
- Do not reuse the probe exception for any other release.
- Do not enable `membershipEnabled` on any tenant before the canary.

## 6. Main twin — `6281f76c` (2026-10-25, no deploy)

Main-only record. Changes nothing in production: the live release above stays `DORMANT_NO_TRAFFIC`, **NOT OWNER_VERIFIED**, canary pending.

- **Integrated live sources:** CC `45788e2b` → B3 `ba888c48` → VOID r2 `73d0a8fb`. 18 paths on main base `6698da28`.
- `checkout/executor.ts`: three-way merge (base `f7d59aac`). Every line the live chain added and every line main added is present; the 3 lines live removed are gone. Legacy projection fields are applied first, then main's C2a write-set, so the advance projection decides `platformDepositAmount` (pinned by a static ordering test).
- Byte-identical to `73d0a8fb`: `voidExecutor.ts`, `legacyProjection.ts`, `memberships/redeemSeam.ts` + their tests, `release.json`, runbook. Test files adapted to main only by appending: the wire test passes through the ONB-PD2 `gated()` wrapper; the membership isolation test pins the B3 `redeemSeam` edge.
- **Preserved main-only, NOT live:** C2a advance, Connect D (`WEBHOOK_VERIFIED_RAILS`), refund R3, pricing state, C2b-B0 legacy-projection parity. `index.ts`, onboarding, whatsapp, owner-invite, `src`, packages, rules unchanged.
- **Tests:** unit failing set candidate == base (1 pre-existing OWNERSHIP test); emulator base 1128/1128, candidate 1227/1227. EMU 39 was added after that candidate run's mirror was copied, so the void suite was rerun on a fresh mirror: 43/43 including EMU 39. Mutation 91/91 killed (r2's 87 + 4 twin mutants), baseline green. Kit `~/release-work/membership-main-twin/`.
- **Open debt `MEMBERSHIP-VOID-C2A-ADVANCE-COMPAT`:** owner decision (a), 2026-10-25 — a checkout that carries C2a advance fields (`advanceAllocation`, `platformDepositAmount`, `advanceLedgerVersion`) is refused `VOID_BASIS_CORRUPT` with zero writes. No automatic reversal of advance fields and no new error code were added. Must be resolved before C2a ships to production or Membership is enabled. The live release is unaffected (it has no C2a).
- Note: main's C2b plan (legacy-projection parity) overlaps with the CC legacy projection now on main; reconcile when C2b is picked up.
