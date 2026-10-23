# HANDOFF — ONLINE-EXTRAS (whitecross extras on salown.com/book) · state at 2026-10-22 ~22:40 Europe/London

Owner rules that still apply (see memory MEMORY.md + project_online_extras_p1.md):
- No production change without the owner's **exact, Europe/London-date-bound approval lines** pasted in chat. Never invent an APPROVAL_ID. "yolla gitsin" is not an approval.
- Any difference → STOP. No automatic rollback (rollback scripts need their own approval line).
- Secrets: never print values. `BREVO_API_KEY@2` everywhere; v1 DISABLED (not destroyed).
- Don't edit a script while a running process executes it (broke the TOKEN watch on 2026-10-22 — memory feedback_no_edit_running_script).
- Main integration (main twin) is NOT to be done in this phase.

## 0. UPDATE 2026-10-23 (read this first)
- **-00074-pit diagnosed → PLATFORM_FAILURE** (no instance ever started; build/spec/archive/cold start clean). Report:
  `runs/diag-CANCEL-LINK-00074-pit-2026-10-23.md`. Not deleted. Recorded `state/failed_attempts.json` (FAILED_ATTEMPT).
- **Gate fix:** serving base = sole untagged 100 % Ready Cloud Run revision (`tools/serving.py`, tests 72, mutants 47/47, run
  in every deploy-fn). Function resource may name another revision ONLY as the recorded failed attempt; split/tag/other newer
  revision/config or source mismatch/frozen-digest drift → STOP. Post-verify requires the new revision to serve 100 % + Ready.
  ORDER gates (deploy-fn WRITER check, deploy-site `fn_unit_serves_candidate`) use `serves_candidate` (serving rev's own
  source) — before the fix STAFF's ORDER wrongly reported CANCEL-LINK=candidate. rollback-fn classifies by the serving archive.
  chain.sh run files now dated `d-<date>-` / `w-<date>-`. Pre-change copies `state/pre-20261023/`.
- **Re-frozen 2026-10-23** (inventory diff = 6 released + 1 recorded failed attempt, 0 unexplained; neighbours unchanged).
  Check-only CANCEL-LINK, CANCEL-EMAIL, STAFF, HOSTING + 4 rollback check-only: all OK (`runs/c23b-*.out`, `runs/rb23b-*.out`).
- 2026-10-22 approvals void. New lines for 2026-10-23 presented to the owner; next free id R-2026-10-23-A. Nothing deployed.
- **2026-10-23 evening: P3 COMPLETE (all units live).** R-2026-10-23-A CANCEL-LINK `-00075-gab` (rb -00073-qey) · B CANCEL-EMAIL `-00110-lup` (rb -00109-yuy) · C STAFF `c80748a54239a527` (rb f54087aa) · D HOSTING `29e1dbb95722adcc` (rb 32a0f8e5). All DEPLOYED_VERIFIED + OBSERVED_CLEAN. Chain stop at STAFF (pre-existing `chain.sh` env-assignment bug, exit 127, nothing contacted) fixed with `env`; resumed on owner "devam". Next: owner live check with a real extras booking → then abandoned-cart A/B/C → main integration prompt → cleanup. Membership/Onboarding prompts stay paused.
- ✅ **2026-10-23 17:06Z OWNER_VERIFIED → P3 DONE.** Real booking (The Full Experience + Face Mask + Nose Wax): staff detail, confirmation email, Manage Booking all show main service £40, extras in page order, Total £58 · 50 min. Next: abandoned-cart A/B/C → main integration prompt → cleanup.

## 1. What is LIVE (all verified)

| Release | What | Live | Rollback target |
|---|---|---|---|
| R-2026-10-21-K…R | ONLINE-EXTRAS P2 (6 fn + STAFF + HOSTING) | — | see ledger |
| R-2026-10-22-A | PAYVENUE hosting hotfix `b889c195` (extras for pay_at_venue, basket kept across services) | hosting:salown `32a0f8e58eb441d2` | `99b7ef02d812f209` |
| R-2026-10-22-B | ALLSVC config: 13 whitecross main services got I CUT Deluxe's 10 OPTIONAL_PAID extras (owner verified live) | Firestore config | `~/release-work/online-extras-allsvc-config/config.sh --rollback` (own approval) |
| R-2026-10-22-C | CANCEL-EMAIL-SERVICE-LABEL `2fa58ec7` (staff cancel email said "Unknown service") — owner verified | salownSendCancellationEmail `-00109-yuy` | `-00108-woz` |
| R-2026-10-22-D | P3 **WRITER** `ffb9e9be` — salownCreateBooking stamps `bookingOptionDisplayOrder` | `salowncreatebooking-00011-xer` | `-00010-tob` |
| R-2026-10-22-E | P3 **TOKEN** `18be56f7` — ordered lines + `priceSummary` | `salowngetbookingbytoken-00066-yep` | `-00065-jux` |
| R-2026-10-22-F | P3 **CONFIRM** `bf375a3a` | confirmationTrigger `-00049-tas`, confirmedEmailTrigger `-00047-veq` | `-00048-xow`, `-00046-har` |
| R-2026-10-22-G | P3 **RESCHED-LINK** `b2619908` | `salownreschedulebytoken-00080-buf` | `-00079-vos` |
| R-2026-10-22-H | P3 **NOTIFY-UPDATED** `7b026820` | `salownnotifybookingupdated-00114-sew` | `-00113-nak` |

## 2. ONLINE-EXTRAS-BREAKDOWN-PARITY (P3) — what is left

Kit: `~/release-work/online-extras-p3` (worktrees `wt-<UNIT>`, `units.sh`, `frozen/pins.tsv`, `deploy-fn.sh`, `deploy-site.sh`,
`rollback-*.sh`, `chain.sh`, `tools/`, `qa/`, `state/released.json`, runs/*.out). ROADMAP row `ONLINE-EXTRAS-BREAKDOWN-PARITY`.

| Unit | Candidate (branch *-r2) | Live base / revision (rollback) | State |
|---|---|---|---|
| CANCEL-LINK | `b427fd18` on `a2147ad4` | salownCancelByToken `-00073-qey` | **R-2026-10-22-I FAILED**: deploy created `-00074-pit`, Ready True 21:23:47Z → False 21:27:51Z ("container failed to start and listen on PORT=8080"); no container logs. Cloud Run traffic 100 % on `-00073-qey` (latestReady), but the function resource names `-00074-pit`. Customer self-cancel unchanged. |
| CANCEL-EMAIL | `46daa037` on `2fa58ec7` (keeps the C label fix) | `-00109-yuy` | not started |
| STAFF | `fe41f709` on `cb8ad7f9` | salown-staff `f54087aaf49fbf9a` | not started (waits for every fn unit) |
| HOSTING | `afa54daa` on `b889c195` | salown `32a0f8e58eb441d2` | not started (waits for fn units + STAFF) |

Partial state is safe: CANCEL-LINK/CANCEL-EMAIL still send the P2 cancellation email (extras lines, no total); staff detail and
Manage are the P2 views (Manage ignores the new token `priceSummary`). New bookings with extras already carry the stamp.

### Next steps (new session)
1. **Diagnose `salowncancelbytoken-00074-pit` read-only**: revision logs (all severities), the revision spec vs `-00073-qey`
   (env, secrets BREVO@2 / STRIPE@5, memory/cpu/timeout), the uploaded archive (`gcloud functions describe` storageSource → fetch,
   treecmp vs `b427fd18`), cold start time of `lib/index.js` (the candidate passed every local gate incl. the emulator handler run).
   A platform flake is plausible (Ready=True first) but NOT proven.
2. **Re-freeze** CANCEL-LINK: `deploy-fn.sh` compares `serviceConfig.revision` with `units.sh` (`-00073-qey`) — the function now
   reports `-00074-pit`, so the live-revision gate will BLOCK until units/frozen are re-measured. Decide with the owner how to
   treat the dead revision (traffic stays on -00073-qey).
3. Re-run check-only for CANCEL-LINK, CANCEL-EMAIL, STAFF, HOSTING (ORDER gates now see WRITER…NOTIFY live).
4. New date-bound approval lines (next free id from the ledger on that day) → `./chain.sh runs/approved-<date>.tsv` with only
   the remaining units (WRITER is first only for a fresh chain; deploy-fn's ORDER gate already sees it live).
5. After HOSTING: owner live check (booking with extras → Manage, staff detail, confirmation/reschedule/cancel emails show
   main service + its price, extras in page order, Total). Only then DONE + ROADMAP/ledger final.

Approval line formats: fn `APPROVAL_ID=ONLINE-EXTRAS-P3-FN-<UNIT>-<CAND8 upper>-<date>` + `ACK_P3_FN_CONFIG=<UNIT_>__TIMEOUT60_RESET__MAX20_RESET`;
sites `ONLINE-EXTRAS-P3-<STAFF|HOSTING>-<CAND8>-<date>` + `ACK_P3_STAFF_SCOPE=DETAIL_SHEET_BREAKDOWN_DISPLAY_ONLY_NO_CHECKOUT_CHANGE` /
`ACK_P3_HOSTING_SCOPE=MANAGE_BOOKING_BREAKDOWN_DISPLAY_ONLY_NO_PAYMENT_CHANGE`. Rollback: `ONLINE-EXTRAS-P3-FN-<UNIT>-ROLLBACK-<date>`,
`ONLINE-EXTRAS-P3-<UNIT>-ROLLBACK-<date>`.

### P3 contract (owner, 2026-10-22)
- Order = the WRITER's server stamp `bookingOptionDisplayOrder` (accepted snapshot ids in the public mirror candidate order:
  allowlist → service → tenant → category layers; derived in the booking transaction; request order never used).
  Readers validate it (distinct, names every canonical line, ≤50); otherwise the STORED order — never today's config.
- Main service price = writer `servicePrice` only when it reconciles with the stored total; total = stored price/duration.
- Token returns lines + `priceSummary` only (no ids, no stamp). No-extras output byte-identical (golden 72/72).
- Evidence: mutants all killed (WRITER 9, TOKEN 19, emails 21–22, STAFF/HOSTING 21); writer canonical emulator 645/645;
  E2E `qa/e2e-p3.cjs` 60 bookings / 117 surface sweeps / 344 emails; visual 390/1440 `qa/shots/`.

## 3. Other open items
- **Main twin owed** (not now): P1/P2/P3, PAYVENUE, CANCEL-EMAIL label, ALLSVC kit — main still on the old contract.
- **Secret rotations still open:** Anthropic, Telegram, Gmail (SEC-INC-SECRETLOCAL). Brevo done.
- **Cleanup** after P3 is closed (plan/apply, never follow symlinks, registered worktrees via `git worktree remove`):
  P3 `wt-*` (9), `cancel-email-label/wt`, `online-extras-payvenue/wt`, P3 `shared/`, `qa/live`, `qa/pw`, run `ws` dirs; keep kits,
  frozen, state, runs/*.out, rollback tools. Then secret/fingerprint scan (tools/archive-scan.py) and report space. Free now ~12 GiB.
- Claims: ONLINE-EXTRAS-P1 / P2 claims (owner alish) still `working` on main.
