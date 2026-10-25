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

1. **Main twin (CC + B3 + VOID)** into current `origin/main`, semantic integration, **no deploy**. Needs a widened claim (`functions/src/checkout/executor.ts`, `voidExecutor.ts`, `memberships/redeemSeam.ts`, `legacyProjection.ts`, the void tests, runbook). Main carries its own unapproved checkout changes — integrate around them, do not ship them.
2. **Production canary on a demo tenant** — separate scope, own data-cleanup / rollback plan, own dated owner approval. **Mandatory before membership is enabled for any tenant.** Only after it can the status move beyond `DORMANT_NO_TRAFFIC`.
3. E-Admin → E-Staff (MEMBERSHIP-PHASE1 plan), each its own approval.

## 5. Do not

- Do not deploy `84d10934` or `ea37bbcc` (wrapper refuses both).
- Do not call this release OWNER_VERIFIED.
- Do not reuse the probe exception for any other release.
- Do not enable `membershipEnabled` on any tenant before the canary.
