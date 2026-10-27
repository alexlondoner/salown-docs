# HANDOFF — SAAS-ONBOARDING-INVITE (owner-invite) — 2026-10-25

Deploy-free step 0 after the read-only re-inventory. **Nothing was deployed; no production write, no
callable call, no email.** Release history (ledger) is unchanged — this is not a release.

## 1. Live state (measured 2026-10-25, freeze `salown-app/ops/releases/owner-invite-repin-20261025/`, main `cc1b181e`)

- 144 functions. Owner-invite family on their recorded releases: Peek `-00001-yeq`, Activate
  `-00001-ceb`, Status `-00001-toj` (R1A `97c56f98`), Recovery `-00001-bak` (R1B `fcc68521`), Issue
  `-00003-wiw` / RequestNew `-00003-caj` (route `smtp`, `ea3304b5`), approveApplication `-00018-xur`
  (R3 saga `2eedd404`), salownSuperAdminTenantStatus `-00001-ror` (`e4ba6284`), provisionTenant
  `-00139-veq` (14-day). Secrets: SMTP USER@2 + PASS@1; BREVO v1 disabled / v2 enabled.
- `hosting:salown` `f544310d` (Activate chunk served) · `salown-admin` `f0b4ce3d` (`5267fc8e`) ·
  rules `4bdefed6` (Membership D2 `3b449025` on the owner-invite guard `b6a00f89`) · SPF google-only.
- Production: 12 applications (6 approved / 6 rejected, 0 open, 0 saga record), 11 tenants all legacy,
  0 owner invites / slots / ops / tenantBilling.
- `check-live.sh` re-measures; any drift = STOP and re-pin.

## 2. Rollback matrix

Full table: `ops/releases/owner-invite-repin-20261025/README.md`. **VOID** (never execute; forward-fix
from the current live lineage): R1A delete, transport `ebd2fb64`, R2 `b410dcab`, TRIAL-14D hosting
`4026623b`, R4 `0252b1bb`, R3-B `dcc15e8f`, TSG `e166e6e9`, rules guard `14e504e4` (would drop
Membership D2), Forgot Password v1 traffic. **Valid as a source only after a re-cut wrapper:** route A
`551c41c0`, R3-A `f557827b` (= the original P0 bug back), provisionTenant `c89c0e1b` (= 90-day back),
SA admin `bd2ea33f`. Conditional: R1B delete (only while 0 invites), SA callable delete (only after
the admin is back on `bd2ea33f`). TTL rollback valid.

## 3. SA-TENANT-STATUS main twin (no deploy)

- salown-app main `ef7ed102`: live `tenantStatusOperation.ts` + export block + live unit/emulator suites (byte-equal
  to `e4ba6284`), release records + runbook from `work/sa-tenant-status-records`; the never-deployed
  ONB-PD version removed; main-only tests / mutation anchors re-pointed. Record
  `ops/releases/sa-tenant-status-callable/MAIN_TWIN_2026-10-25.md`.
- super-admin main `1877729`: live guard + trial policy, ONB-PE confirm step on the live contract, Add
  Tenant 14 days, LIVE.json, new gate `SUPER_ADMIN_MAIN_NOT_RELEASE_SOURCE` (main still refused).
- Neither main is a release source.

## 4. Canary (owner-performed, NOT RUN)

`salown-app/ops/runbooks/owner-invite-canary.md`. The owner submits the salown.com form, approves in
Super Admin and activates from the email; the session only reads and verifies. Approval lines
`OWNER-INVITE-CANARY-{APPLY,APPROVE,ACTIVATE,CLEANUP}-<yyyy-mm-dd>`. Cleanup is separately approved
and is not a rollback; the live PURGE tool does not cover `rotaPolicy`, owner-invite records or
`tenantBilling`.

## 5. R5 decision (owner 2026-10-25) — record only

`salown-app/ops/runbooks/owner-invite-r5.md`: legacy `trialEndsAt` kept exactly; activation never
restarts / shortens / extends it; past date → MANUAL_REVIEW, zero writes; new applications unchanged
(14 tenant-local days at activation). Dependencies: canary, K3 live, an existing-account operation.
kathleen-birch trial ends 2026-12-08.

## 6. R6 — research only

`salown-app/ops/runbooks/owner-invite-r6.md`: `sendPasswordResetPublic` has no rate limit, sends the
Firebase reset link through click-tracking Brevo, early return (timing), unescaped address, default
6-char policy; `salown.com` is not an authorized Auth domain. Measurement needs one owner-approved
reset mail on an owner-controlled account (after the canary).

## 7. Claims / commits

salown-app main: claim widen `c16fadc6` → re-pin + runbooks `cc1b181e` → twin `ef7ed102` → SYNC + claim narrowed `febf0b1c` (`SAAS-OWNER-INVITE-R1` blocked = waiting for the canary). super-admin main `1877729` (no claims directory in that repo). WHATSAPP-B7 claim, Membership paths and the shared checkouts untouched. GitHub Actions unchanged (727).

## 8. Next safe step

Owner runs the canary (§4) when ready; the session runs `check-live.sh` and the precondition reads
first.

## 9. Update 2026-10-27 — canary PASS, R6-A LIVE + OWNER_VERIFIED (supersedes §4, §6, §8)

- **Canary PASS 2026-10-26** (`salown-app/ops/releases/owner-invite-canary-20261026/RESULT.md`): tenant
  `salown-canary-20261026`, owner uid `oi_3esEA7…` — **kept** (R6-B verification uses it; cleanup only under its own approval).
- **R6-A1** `sendPasswordResetPublic` `-00056-hiy` from `5a83a7e0` — `R-2026-10-26-A`; **R6-A2** `sendStaffPasswordReset`
  `-00058-cop` from `1b8dbd72` — `R-2026-10-27-A`. Both: Google Workspace SMTP (`OWNER_INVITE_SMTP_USER@2` + `PASS@1`, sender
  `info@salown.com`), no Brevo, timeout 60 / maxInstances 12 unchanged; A1 adds rate limit (client 10/h, target 3/h), uniform
  answer, 3.5 s floor, escaping, fixed log codes. **OWNER_VERIFIED 2026-10-27** (mail mailed-by / signed-by `salown.com`, link
  straight to `havuz-44f70.firebaseapp.com/__/auth/action`). Detail: `RELEASE_LEDGER.md`, `salown-app/ops/runbooks/owner-invite-r6.md`
  "R6-A LIVE + OWNER_VERIFIED", `ops/releases/r6-a{1,2}/RECORD.md`.
- **Rollback:** traffic only → `sendpasswordresetpublic-00055-rig` / `sendstaffpasswordreset-00057-xuk`
  (`OWNER-INVITE-R6-<A1|A2>-ROLLBACK-<date>`, `~/release-work/r6-a<1|2>/kit/rollback.sh --traffic`); a rebuild of `a60bfaad` is NOT
  a rollback (resets timeoutSeconds). Rollback re-opens the Brevo tracking leak — forward-fix preferred.
- **Evidence kept (no cleanup):** kits `~/release-work/r6-a1/kit`, `~/release-work/r6-a2/kit` (freezes, kit digests, deploy /
  check-only / rollback runs), worktrees `~/release-work/r6-a{1,2}/salown-app`, CLI `~/release-work/r6-cli`, records worktree
  `~/release-work/r6-records/salown-app`.
- **Main twin OPEN** (claim `SAAS-OWNER-INVITE-R6` stays blocked / handoff-ready): main has the Brevo handlers and no R6 modules;
  main's `sendStaffPasswordReset` carries K3 (`cc38e330`, not live) → twin keeps K3 and swaps only transport + escaping. Steps in
  the runbook "Main twin debt". The twin session must also claim `functions/src/index.ts`.
- **Follow-ups, not started (ROADMAP):** R6-B (after the twin), `STAFF-RESET-TARGET-SCOPE` P1 (fix exists on main as K3),
  `RESET-MAIL-DELIVERABILITY` P2 (owner direction `noreply@`; alias = owner action; scope + Reply-To open).
- Commits: salown-app main `51da7fa2`; docs ledger `fa34ea2` · `2bfb97d` · `da350af` · `4ebd553` · `c653bd8` · `e9bb458`,
  ROADMAP `b2837d7` · `3556667`.

**Next safe step:** new R6 session → A1/A2 main twin (no deploy) → then R6-B preparation.
