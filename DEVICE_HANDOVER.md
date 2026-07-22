# DEVICE HANDOVER — Sessions 1–5

**Compiled:** 2026-07-22 · Session 5 (`DEVICE-HANDOVER`, writable docs-only coordination)
**Purpose:** single pick-up point for the next device/session. Consolidates the outcome of
Sessions 1–4 so any machine can `git pull` and know exactly where things stand.

> ⚠️ **Nothing here has been implemented.** Sessions 3 and 4 were **read-only audits** whose
> reports were ACCEPTED; every finding below is deferred to **separate, future writable tasks**
> (each with its own owner, claim, and commit history). This handover changes no app code.

---

## 1. Session status at a glance

| Session | Type | Subject | Result | Artifact / commit |
|--------|------|---------|--------|-------------------|
| **1** | — | (prior session) | **Closed** | — |
| **2** | writable, docs | `processingTime` doc reconciliation | **Shipped** | `salown-docs` `68ccc6c` on `origin/main` |
| **3** | read-only audit | Parser silent-failure **canary** | **ACCEPTED** — plan deferred | see [PARSER_NOTES.md] / memory `parser-canary-audit` |
| **4** | read-only audit | Full-coverage **audit trail** (ROADMAP I4) | **ACCEPTED** — plan deferred | see [AUDIT_TRAIL_PLAN.md] / memory `audit-trail-slice` |
| **5** | writable, docs | **This handover document** | In hand | this file |

**Bottom line:** no claims are open, no code is mid-flight, all repos are clean and synced.
Sessions 3 & 4 produced *plans only*; the work they describe has **not started**.

---

## 2. Session 1 — CLOSED

Session 1 is closed. No open work, claim, or branch is carried forward from it.

---

## 3. Session 2 — `processingTime` docs reconciliation ✅ (`68ccc6c`)

**Repo:** `~/alex/salown-docs` · **Commit:** `68ccc6c` — *"docs(busy-slot): reconcile
processingTime as mixed transition state (D)"* — on `origin/main` (currently repo HEAD).

**What shipped:** documentation was brought back in line with the *actual* half-migrated state
of `features.processingTime`. Files touched:
- `BUSY_SLOT_V2.md`
- `BUSY_SLOT_V2_RISKS.md`
- `BUSY_SLOT_V2_TESTPLAN.md`
- `FEATURE_FLAGS.md`

**Verified reality captured in the docs (state "D" = mixed transition):**
- Conflict engine (`Salown/src/utils/conflictUtils.ts`) **no longer reads** the flag — it is
  service-`segments` driven; the `processingEnabled` opt is `@deprecated Ignored`.
- `salownIcalFeed` (`Salown/functions/src/index.ts` ~`:1511`→`:1518`) **still reads/gates** on it —
  a dormant Phase-5a Treatwell VEVENT split; ⬜ not shipped.
- `Salown/src/pages/Services.tsx:154` is a **dead read** (`pcEnabled` never consumed).
- Tenant creation still writes `false` (`index.ts:220`/`:2831`); still a `TenantFeatureKey`
  (`packages/shared/src/tenant.ts:47`).
- **No supported UI/admin/onboarding/`salownadmin` path sets it `true`** — manual Firestore edit only.

**⚠️ OPEN decision left for the owner/architect (code+product, NOT docs):**
Either **(A) retire** the flag (delete the iCal read preserving single-span default, the dead
`Services.tsx` read, the `false` defaults, and the type member) or **(B) formalize** it into a
real Phase-5a rollout mechanism (migrate the iCal split to booking `segments`, or add a
super-admin toggle + `salownadmin` control). Docs now describe reality accurately, but the code
is half-migrated — leaving it will drift again. If acted on, update the four busy-slot docs +
`BUSY_SLOT_V2.md §6` in the same change. *(Memory: `processing-flag-decision`.)*

---

## 4. Session 3 — Parser silent-failure canary audit (ACCEPTED, read-only)

**Scope:** email-parser silent-failure "canary" in `~/alex/Salown`. Report **ACCEPTED**;
implementation deferred to later **separate writable tasks**.

**Two Critical findings driving the work:**
1. **Total-outage blind spot.** A *throwing* parser bypasses `recordParserRun` (its arg is
   evaluated before the call, `functions/src/index.ts:1799`); the day-canary tests
   `days[yesterday] === 0` (`:1732`) but the key is `undefined` → the alert never fires.
2. **Format break = success-with-zero-data.** `if(!name)continue` / `if(!bookingDate)continue`
   (`parsers/booksy.ts:61,169`) fire before any counter, and no `examined` denominator exists,
   so "no emails" and "parser broke" are indistinguishable. `recordParserRun` also reads only
   `result.imported` (`:1715`), discarding `skipped`/`updated`/`errors`.

**Sanctioned implementation order — DO NOT reorder** (each = its own writable task + claim):
1. **`parser-canary-signal`** — surface an `examined` signal: parsers
   `booksy/fresha/treatwell/ical.ts` (additive `result.examined = msgs.length`; parity-sensitive)
   + `parsers/messages.test.js`.
2. **`parser-canary-logic`** — record every run + preserve `skipped`/`errors`; wrap the iCal
   (`:1776`) & manual (`:1699`) paths — `index.ts` + new `parsers/canary.test.js`. Guard
   `Number(x||0)` so it tolerates Slice 1 not-yet-merged.
3. **`parser-canary-scoring`** — five-state health scoring
   (HEALTHY/DEGRADED/FAILED/NO_DATA/UNKNOWN) — `index.ts` + `notifications/index.ts`
   (stable `parserCanary` mute key).
4. **`parser-canary-flag`** *(optional)* — Super-Admin controls / `features.parserCanary`
   kill-switch — frontend.

**Owner constraints:** no telemetry/Prometheus/Grafana — the 5-state model layers on top of the
Slice 1–2 signals with **no new infra**. Parser changes reach prod only via
`firebase deploy --only functions` (INV-PAR-6). Watch the parser parity test
(`parsers/parity.test.js`) when editing the byte-sensitive parser bodies in Slice 1.
*(Memory: `parser-canary-audit`.)*

---

## 5. Session 4 — Audit-trail I4 slicing report (ACCEPTED, read-only)

**Scope:** read-only audit of ROADMAP **I4** (full-coverage audit trail) after the TS migration,
plus a conflict-safe slicing plan. Report **ACCEPTED**; implementation deferred to **separate
writable tasks — each new owner + new claim + separate commit history**. No claim/code/doc/
commit/deploy was done in the audit session.

**Verified coverage:** I4 **Phase A is live & complete** (`2ab0328`): barbers
(CREATE/UPDATE/DELETE/STATUS_CHANGED/SHIFT_OVERRIDE) + clients
(CREATE/UPDATE/DELETE/CONSENT/TRUSTED/MEMBERSHIP/MERGED/points) all call `logAudit`
(`src/utils/auditLogger.ts`). A second frontend logger `log()` exists in `src/firestoreActions.ts`.
Functions side has 3 hand-written `.add()` (no shared helper) at
`functions/src/index.ts:108,1219,1403`. Super-admin panel logs to its OWN
`superAdmin/auditLog/entries` (not the tenant trail). Viewer `src/pages/AuditLog.tsx` ACTION_META
is stale (Phase-A actions render as "Other"). `firestore.rules:179` `auditLogs` is **NOT
append-only yet**.

**Blind spots (Phase B/C):** catalog 0/17 (`Services.tsx` + duplicate `OnlineProfile.tsx` +
`Products.tsx`, incl. price), settings/permissions 0/20+ (`Settings.tsx`, incl. **appPassword**
secret → must redact), campaign sends (functions `sendMarketingEmail`/`sendCampaignBulk` +
`Marketing.tsx` templates), staff-user fns (`createStaffUser`/delete + claims), super-admin→tenant
mirror (`salownadmin/src/pages/Tenants.jsx`).

**Slice plan (each = a new writable task; suggested claim name):**

| Slice | Claim | Size | Files / notes |
|-------|-------|------|---------------|
| **S0** | `I4-FOUND` | M | extend `logAudit` (role+source/target/changes, back-compat) + `logAuditServer` + redaction util. `src/utils/auditLogger.ts`, `src/utils/auditRedact.ts`(new), `functions/src/utils/audit.ts`(new). **HARD PREREQUISITE FOR ALL** — redaction must be live before any secret is logged into soon-append-only logs. |
| **S1** | `I4-BARBER` | XS | `Barbers.tsx` residual. |
| **S2a** | `I4-CATALOG-SVC` | L | `Services.tsx` + `OnlineProfile.tsx` (must move together). |
| **S2b** | `I4-CATALOG-PROD` | S | `Products.tsx` (log in page handlers, don't lock `firestoreActions.ts`). |
| **S3** | `I4-CLIENT` | S | `Clients.tsx` residual. |
| **S4a** | `I4-SETTINGS` | L | `Settings.tsx` (**redact appPassword**). |
| **S4b** | `I4-DISCOUNT` | XS/S | `DiscountCodesPanel.tsx`. |
| **S5** | `I4-FN-AUDIT` | L | `functions/src/index.ts` (staff-user + campaign send + missing callable audits). **SOLO claim — monolith, highest conflict.** |
| **S5b** | `I4-SUPERADMIN-MIRROR` | M | `salownadmin/src/pages/Tenants.jsx` (no test harness → manual only). |
| **S6a** | `I4-VIEWER` | M | `AuditLog.tsx` META + category/actor filters. |
| **S6b** | `I4-RULES-APPENDONLY` | S | `firestore.rules` append-only; **deploy LAST**, after S0 redaction live. |
| **S7** | `I4-CAMPAIGN-TPL` | S (opt) | `Marketing.tsx` templates. |

**Merge order (waves):**
`W1 = S0` → `W2 = S4a, S2a, S5` → `W3 = S1, S2b, S3, S4b, S5b, S7` → `W4 = S6a` →
`W5 = S6b` (last deploy).
Independent-parallel after S0: `S1, S2a, S2b, S3, S4a, S4b, S5b, S7`.
Conflict-prone: **S5** (`index.ts` monolith), **S4a** (`Settings.tsx` hot), **S2a**
(`OnlineProfile.tsx` ~91 KB), **S0** (`auditLogger.ts` contract — freeze signature first).

**Test harness:** frontend `vitest run` (tests in `src/utils/*.test.ts`); functions
`node --test src/<area>/*.test.js`; `salownadmin` has **NO** test script.
**SSOT:** design → `salown-docs/AUDIT_TRAIL_PLAN.md`; state → `ROADMAP.md` **I4**.
*(Memory: `audit-trail-slice`.)*

---

## 6. Recommended future slices & merge order (consolidated)

No work below has started. Recommended pick-up sequence for whoever resumes:

**A. Audit trail (ROADMAP I4)** — start here; largest, best-scoped, conflict-safe.
1. **S0 `I4-FOUND` first, alone** — it freezes the `logAudit` signature and lands redaction.
   *Nothing else may start until S0 is merged* (secrets must never hit soon-append-only logs).
2. Then fan out by wave: `W2 (S4a, S2a, S5)` → `W3 (S1, S2b, S3, S4b, S5b, S7)` → `W4 (S6a)` →
   `W5 (S6b)`. Keep **S5** a solo claim (monolith). **S6b deploys LAST.**

**B. Parser canary** — independent of I4; can run in parallel by a different owner.
Strict order: `parser-canary-signal` → `parser-canary-logic` → `parser-canary-scoring` →
`parser-canary-flag` (optional). Slice 1 touches byte-sensitive parser bodies — run
`parsers/parity.test.js`; ships only via `firebase deploy --only functions`.

**C. `features.processingTime` decision** — owner/architect call (retire vs formalize, §3).
Blocks nothing, but resolve before it drifts again. Code+product task; if acted on, update the
four busy-slot docs + `BUSY_SLOT_V2.md §6` together.

**Cross-cutting rule (all of the above):** one writable task = one claim = one owner = its own
commit history. Multi-device protocol: pull/rebase `origin/main`, commit **only your own files
by explicit path** (never `git add -A`; revert incidental `package-lock.json` changes), push
promptly to keep `main` always synced.

---

## 7. Current repository / branch / status

All repos live under `~/alex/`. Verified 2026-07-22 — **all on `main`, working trees clean,
in sync with `origin/main` (no ahead/behind, no uncommitted changes)**.

| Repo | Path | Branch | Sync | HEAD |
|------|------|--------|------|------|
| **Salown** (app) | `~/alex/Salown` | `main` | = `origin/main`, clean | `07c825a` docs(sync): log CLAIMS-FIX-HARDENING (F1/F2/F3 fix, `61452a5`) |
| **salown-docs** (brain) | `~/alex/salown-docs` | `main` | = `origin/main`, clean | `68ccc6c` docs(busy-slot): reconcile processingTime as mixed transition state (D) |
| **whitecross-site** (storefront) | `~/alex/whitecross-site` | `main` | = `origin/main`, clean | `ad29b979` booking: extras fold into payment total (`_totalPrice`) + success.html itemises extras |
| **salownadmin** (super-admin) | `~/alex/salownadmin` | `main` | = `origin/main`, clean | `5689b67` chore: stop tracking Firebase hosting cache (`.firebase/`) |

**No open claims. No feature branches in flight. No un-pushed commits.**

*(This handover file — `DEVICE_HANDOVER.md` — is the only pending change; it adds no app code.)*

---

## 8. Where to read more

- **Parser canary** → memory `parser-canary-audit`; design in `PARSER_NOTES.md`.
- **Audit trail I4** → memory `audit-trail-slice`; design in `AUDIT_TRAIL_PLAN.md`; state in `ROADMAP.md` I4.
- **processingTime flag** → memory `processing-flag-decision`; `BUSY_SLOT_V2.md`, `FEATURE_FLAGS.md`.
- **Repo layout / deploy gotchas** → memory `whitecross-repos-setup`, `salown-project`; `DEPLOY.md`.
- **Edit log (shipped app work)** → memory `edit-log-salown`; `STAFF_APP_HARDENING.md`.
