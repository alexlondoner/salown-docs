<!--
  CANONICAL SOURCE. This file is consumed via a symlink through alex/CLAUDE.md (Claude Code root context).
  ALWAYS edit here (docs/CLAUDE.md) → commit + push → up to date on every machine.
  The `docs/...` links inside are relative to the alex/ root (the symlink resolves from there); if you open
  it directly from within docs/ the links are off by one directory — this is intentional, the consumption point is the alex/ root.
  New machine bootstrap: see docs/README.md → "Bootstrap".
-->
# salOWN — AI Context Index

Multi-tenant SaaS barbershop booking platform. Firebase project `havuz-44f70` (europe-west2).
All tenant data lives under `tenants/{tenantId}/...`.

**Main repo:** `salown-app/` (Vite + .jsx). For other folders see: [SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md)

---

## Documentation

| File | Contents |
|-------|--------|
| [README.md](docs/README.md) | **ENTRY POINT** — newcomers (PM/engineer/designer) start here: 60-sec summary, reading order by role, doc map, record system |
| [GLOSSARY.md](docs/GLOSSARY.md) | Term glossary — tenant/Class A-B/walk-in/aggregator/squeeze-in/canary/SSOT/`pp()`/`toDateKey()`... check here when stuck on jargon |
| [MANIFESTO.md](docs/MANIFESTO.md) | Why it exists, "grabbing" philosophy, goal |
| [SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) | Repo map, Firebase, stack, key files, DO NOT list |
| [TENANTS.md](docs/TENANTS.md) | **Tenant roster of record** — active: Whitecross + HeroHairs. EeKurt left the platform 2026-07-18 (record kept, data preserved, NOT a current tenant). Class A/B definition |
| [PEOPLE.md](docs/PEOPLE.md) | People, roles, emails |
| [FIRESTORE_SCHEMA.md](docs/FIRESTORE_SCHEMA.md) | Data structure, booking model quirks, client identity |
| [BUSINESS_RULES.md](docs/BUSINESS_RULES.md) | Cancel/reschedule policy, slot generation, deposit flow |
| [BUSY_SLOT_V2.md](docs/BUSY_SLOT_V2.md) | DESIGN: processing-time / multi-interval busy engine + channel architecture, test matrix, phases |
| [SERVICE_CONFIG_V2.md](docs/SERVICE_CONFIG_V2.md) | DESIGN: detailed service config (Booksy+Fresha+Treatwell superset), segment array model (service/processing/blocked), editor sections |
| [SERVICE_EDITOR_DESIGN_BRIEF.md](docs/SERVICE_EDITOR_DESIGN_BRIEF.md) | Service editor REDESIGN brief (for the designer): all fields, sections, wait/squeeze-in hero module, states, brand tokens, "visual only" rule |
| [FEATURE_FLAGS.md](docs/FEATURE_FLAGS.md) | Flag list + what it does, loyalty/telegram config |
| [EMAIL_ARCHITECTURE.md](docs/EMAIL_ARCHITECTURE.md) | Brevo, "via salOWN", GDPR unsubscribe, IMAP parser |
| [LIVE_CHAT.md](docs/LIVE_CHAT.md) | salown.com live chat (LC1) — bot-first widget + `salownLandingChat` + super-admin inbox; the 4 cost guards on a public AI endpoint, why polling instead of a listener, local-run recipe |
| [DEPLOY.md](docs/DEPLOY.md) | Build/deploy commands, symlink, safety order |
| [INCIDENTS.md](docs/INCIDENTS.md) | Past incidents + lessons learned — **read BEFORE starting bug diagnosis** (see Quick Rule #7) |
| [INVARIANTS.md](docs/INVARIANTS.md) | **Breaks the system if violated** — money/date/booking/matching/security/deploy invariants, with source citations; read BEFORE touching the relevant area |
| [KNOWN_QUIRKS.md](docs/KNOWN_QUIRKS.md) | Odd but **intentional** behaviors — "don't mistake for a bug and fix"; INVARIANTS/latent-bug distinction inside |
| [DECISIONS.md](docs/DECISIONS.md) | **Why we did it this way** (ADR): email/payment/POS/deletion/repo decisions + rationale + rejected alternatives |
| [PRINCIPLES.md](docs/PRINCIPLES.md) | **How we engineer** (P1-P14) — each principle tagged ⚙️ machine-enforceable / 🧠 human-discipline. (DECISIONS=why, INVARIANTS=what won't break, PRINCIPLES=how) |
| [PARSER_NOTES.md](docs/PARSER_NOTES.md) | Booksy/Fresha/Treatwell parser architecture, dedup system, recurring bug patterns |
| [TREATMENT_PACKAGE_SYSTEM.md](docs/TREATMENT_PACKAGE_SYSTEM.md) | **TR-B session packages** (LIVE): immutable commercial snapshot, append-only `packageLedger`, entitlement consumed exactly once (derived doc ids), owner-only Payment settings, and WHY package payments earn no loyalty (`price: 0` at link time — no checkout code changed) |
| [TR_CHECKOUT_ARCHITECTURE.md](docs/TR_CHECKOUT_ARCHITECTURE.md) | **TR-D1 in-salon checkout** (server executor DEPLOYED 2026-08-02, deliberately unreachable): one transaction over booking + tenders + receivable + package entitlement + loyalty + receipt, the read-before-write ordering rule and WHY a refusal may never follow the package seam, idempotent intent/result recovery, and the explicit `stockQty` deferral |
| [PAYMENT_SETTINGS.md](docs/PAYMENT_SETTINGS.md) | **The three payment settings contracts** — PAY-1 `paymentSettings` (public, online) vs TR-B `packageSettings` vs TR-D1 `checkoutSettings` (both private): what each owns, why `enabled: false` is load-bearing, three-level capability resolution, and the owner-only rules gap still open on `checkoutSettings` |
| [PAYMENT_PLAN_ENGINE.md](docs/PAYMENT_PLAN_ENGINE.md) | **TR-B arithmetic**: instalment split (remainder on the first payment, and why), oldest-first allocation, overdue + grace, admissibility gates, why overpayment is refused, TR/UK money-input parsing, idempotency (incl. the UI half people lose) |
| [STRIPE_CONNECT_PLAN.md](docs/STRIPE_CONNECT_PLAN.md) | DESIGN: salOWN payment = Stripe Connect Standard + Checkout Session; fixed £ deposit; per-tenant policy; disabled/future |
| [TIERS_AND_UPGRADE.md](docs/TIERS_AND_UPGRADE.md) | DESIGN: tiers (Free/Starter/Pro/Pro+) + tenant's **in-account** plan upgrade ("like Anthropic"); Phase 1 request→approve (no charge), Phase 2 Stripe **Billing** subscription (Connect≠Billing), Pro+ = premium website+SEO; ROADMAP **Monetization** theme |
| [MIGRATION_PATTERNS.md](docs/MIGRATION_PATTERNS.md) | 21 engineering patterns discovered with proof during the TS migration (byte-neutral solution alphabet, Pattern 20 TS import-elision diagnosis recipe, byte-proof v2 method) — KEEP OPEN when translating a slice |
| [SECURITY.md](docs/SECURITY.md) | **Firestore rules & security SINGLE SOURCE**: rules architecture, Phase 1 (done), open gates G1–G5 (code counter-analysis + blast radius + fix), booking flow security |
| [BOOKING_SECURITY_POLICY_MIGRATION.md](docs/BOOKING_SECURITY_POLICY_MIGRATION.md) | **AUTHORITATIVE parent plan** merging B2 booking-settings + UK phone-identity into one migration: BookingPage/premium → authoritative `salownCreateBooking` callable → policy validation → server identity resolution → transactional trusted create (Stripe webhook payment-only). 22 locked decisions + 10 bounded child packages (I1–E1) in dependency order. ROADMAP `B2`/`B3`/`B4` |
| [DEPLOYMENT_STATUS.md](docs/DEPLOYMENT_STATUS.md) | **Push-vs-live ledger** — for a given commit, is production actually on it? Tracks the gap between `origin/main` and deployed (hosting auto-deploys; functions/rules/whitecross-site are manual). Not `SYNC.md` (retrospective), not `ROADMAP.md` (plan) |
| [STAFF_SETTINGS_AUDIT.md](docs/STAFF_SETTINGS_AUDIT.md) | Staff availability/settings audit (2026-07-12): leave has 5 different behaviors across 5 surfaces, Finance ghost-wage risk, target model (single resolver) + implementation order — ROADMAP G5 |
| [STAFF_ACCESS_CONTROL.md](docs/STAFF_ACCESS_CONTROL.md) | **Staff ACCESS authority + revocation (S4A, source+tests, NOT LIVE)** — why `barbers.status` (assignability) must never drive app access, the canonical `staff/{uid}.accessStatus` (absent=active, unknown=fail closed, one `ACTOR_OFFBOARDED` code), the 5 cores that enforce it in-transaction, and WHY offboarding is a resumable state machine rather than a transaction (Auth+Firestore+FCM cannot be atomic) |
| [TEAM_IDENTITY_CONTRACT.md](docs/TEAM_IDENTITY_CONTRACT.md) | **Team Member identity + role server contract (O1, LIVE)** — why the staff doc is the AUTHORITY and the `tenantRole` claim only its projection, why `setCustomUserClaims` REPLACES (the T-e lock-out + the deleted `superAdmin`), the 8 invariants, the escalation/last-owner guards, the deny-first write ordering, and the side-effect-free source marker for verifying a deploy of this area. **⚠️ `provisionTenant` must not be deployed from this repo — ROADMAP T-h** |
| [STAFF_MANAGEMENT_DESIGN.md](docs/STAFF_MANAGEMENT_DESIGN.md) | DESIGN: Staff Management & Compensation (ROADMAP **Employment Model** theme, S1-S3) — staffComp collection, wage/commission/self-employed accounting rules, migration plan, Staff hub UI, 3 phases |
| [NORMALIZATION.md](docs/NORMALIZATION.md) | All normalize/match/casing rules, helper table, known inconsistencies |
| [MULTI_TENANT_NOTES.md](docs/MULTI_TENANT_NOTES.md) | Class A/B guards, whitecross migration table |
| [ROADMAP.md](docs/ROADMAP.md) | **Company roadmap — READ FIRST, every session.** Restructured 2026-08-12: mandatory status vocabulary (`LIVE_VERIFIED` / `PUSHED_NOT_LIVE` / `IN_PROGRESS` / `PLANNED` / `BLOCKED` / `DORMANT` / `STATUS_UNKNOWN`), a **Master Active Table** with stable Work IDs at the top, then P0/P1/P2/DORMANT, blockers, the per-target release truth table, and the unknowns. Theme detail and the Completed archive follow below it; item IDs (A1/B3/C8/S1…) preserved |
| [RELEASE_LEDGER.md](docs/RELEASE_LEDGER.md) | **What is actually running** — one structured row per release per deployable unit: source SHA (or an explicit `UNKNOWN`), previous→new live identity, verification, rollback identity, exclusions. A release not recorded here has not been recorded |
| [TESTS.md](docs/TESTS.md) | **All test records SINGLE SOURCE**: rules (automated), security gate manual, Stripe live, Staff App, Post-Class-A, busy-slot pointer |
| [PROMPTS.md](docs/PROMPTS.md) | Claude Code prompt templates |
| [ops/claims/README.md](salown-app/ops/claims/README.md) | **Parallel-session path ownership** — how concurrent sessions claim/lock the files they edit so two sessions never touch the same path; protocol + `claims.sh` + conflict rule (see Quick Rules coordination block) |

---

## salown-app/CLAUDE.md

Technical details (booking model, conflict utils, reschedule invariants, GDPR rules) live there.

---

## Parallel session coordination — path ownership

Multiple sessions may work concurrently across `alby23`, `macbook`, and `alish`.
A session identity must use:

`<device>/<session-id>`

Before modifying any source file:

1. Run `git pull --rebase`.
2. Run `./ops/claims/claims.sh check <path>` for every intended path.
3. If any path is `LOCKED`, stop and report `SKIP` with the current owner.
4. If all paths are free, create one claim file containing every intended path.
5. Commit and push only that claim file using an explicit path.
6. Run `git pull --rebase` again and recheck all claimed paths.
7. If a competing claim exists for any path, stop. Do not choose a winner automatically — wait for a human owner decision.
8. Modify only paths declared in your own active claim.
9. If additional paths become necessary, update and push the claim before touching them.
10. When finished, commit the implementation with explicit paths, remove only your own claim, push, and record the result in `SYNC.md`.

Never:
- use `git add .`
- edit or delete another session's claim
- touch an undeclared path
- continue after a claim conflict
- treat a claim as a substitute for reviewing the working tree

Source roles:
- `ROADMAP.md` — status of every piece of work (the SSOT for status)
- `RELEASE_LEDGER.md` — what is actually running, and how to roll it back
- `ops/claims/` — current path ownership
- `SYNC.md` — completed sync and deployment history (human day log)

Full protocol: `salown-app/ops/claims/README.md`

---

<a id="daily-project-truth"></a>
## Daily Project Truth — MANDATORY for every coding/release session

*Added 2026-08-12 by `REL-2`. It exists because a reconciliation found three unrecorded release
events, one entire work item that had shipped and appeared on no roadmap, and two cases of
deploying and committing afterwards — which permanently destroyed the provenance of what is
serving customers today.*

### The five rules

1. **Read [ROADMAP.md](docs/ROADMAP.md)'s Master Active Table first**, and work under a **Work ID**.
2. **`PUSHED_NOT_LIVE` ≠ `LIVE_VERIFIED`.** Never infer "live" from a commit existing or from a
   commit timestamp. Only a live revision, version id, served byte or a source marker inside the
   deployed artifact proves it.
3. **Never deploy from an uncommitted or dirty tree, and never deploy then commit.** Pin a commit,
   build from it, release it. Deploy→commit is a **process violation**, not a shortcut.
4. **Never mark work live without production verification of the exact behaviour**, and never
   silently overwrite another session's status. Concurrent claims are preserved, never released
   on someone else's behalf.
5. **A release without a `RELEASE_LEDGER.md` row does not count as done.**

### At session start

- read the ROADMAP active table;
- `git fetch --prune`; report `HEAD` / `origin/main` / ahead / behind / working tree, per repo;
- `./ops/claims/claims.sh check <path>` for every path you intend to touch, then claim exactly
  those paths (claims protocol rules 1–9, including **rule 7: a competing claim is a hard stop**);
- mark or register your Work ID as `IN_PROGRESS`.

### At completion

- update your Work ID's status and its **Last verified** date;
- record the implementation SHA;
- state **pushed** vs **deployed** explicitly — they are different sentences;
- record the test gates you actually ran;
- record the live revision/version **only after production verification**;
- if you released anything, add the `RELEASE_LEDGER.md` row **including the rollback identity**;
- release your claim and leave a clean `0/0` tree, or say plainly that you did not.

### End of day — one designated reconciliation pass

Inventory every repo · list active claims · flag dirty/ahead/behind · reconcile the day's commits ·
reconcile the day's deployments · update the ROADMAP active table · update `RELEASE_LEDGER.md` ·
update incident/blocker statuses · record unresolved unknowns as `STATUS_UNKNOWN` (never a guess) ·
stamp the reconciliation timestamp in ROADMAP §1.

If nothing about product status changed, write exactly:

```
DAILY_RECONCILIATION_COMPLETE — NO STATUS CHANGE
```

so that *absence of an update* is distinguishable from *forgetting*.

**Run:** `docs/scripts/daily-reconciliation-check.sh` — read-only; it reports repo state, active
claims, today's commits and deployments, and whether ROADMAP carries today's reconciliation stamp.
It **never** commits, pushes, deploys or edits anything.

**Deliberately NOT required:** a ROADMAP edit for docs-only commits, test-only commits or claim
bookkeeping. The rule attaches to *product status changes and releases*, not to every commit.

---

## Quick Rules

1. **Before deploy:** state tenant + URL, wait for confirmation
2. **New salown-app trigger:** add self-managed tenant guard (see: MULTI_TENANT_NOTES.md)
3. **Date:** use `toDateKey()`, never `.toISOString().split('T')[0]`
4. **Bulk delete:** export → dry-run CSV → confirm → write
5. **Feature flag:** read from tenant doc, don't hardcode
6. **Fix:** one bug, changed lines report, then move to the next
7. **Bug/incident:** Before starting to diagnose a problem (email not sending, booking not landing/showing, blank page, 404, payment/confirmation), **read [docs/INCIDENTS.md](docs/INCIDENTS.md) FIRST** — the same patterns recur, the root cause + diagnosis method is probably there. Also add a resolved serious incident there with the **standard template**: `## YYYY-MM-DD — title` + metadata line (**Severity** 🔴/🟠/🟡/🟢 · **Owner** · **Status** ✅/🟡/🔴) + **Impact/Root Cause/Resolution/Prevention** + **Lessons**. The template is at the top of the file; where possible write a permanent guard/test into Prevention. If the same bug returns, Status = 🔴 Regressed.

---

## Information architecture — where a screen belongs (TR-B2, 2026-08-01)

Recorded because these were being answered inconsistently, and a feature landing in the
wrong place is expensive to move once salons have learned it.

| Concern | Lives in |
|---|---|
| Package **catalogue** | **Services → Packages** (`/app/services?view=packages`) |
| **Purchased packages / history** | **Client Detail** |
| **Package accounting** | **Reports** *(Finance remains Whitecross-specific — see below)* |
| **Follow-ups** | **Clients → Follow-ups** (`/app/clients?view=follow-ups`) |
| Tenant **configuration** | Settings |

This is navigation only. **No collection, document path, callable or stored field changes** —
it is not a data migration, and nothing about TR-C's lifecycle or continuity engine moved.

> ⚠️ **Correction of record.** The first version of this table (written at `a5b6f20`) said the
> catalogue lived under "Packages → Catalogue". That recorded what had been *built* rather than the
> rule that had been *specified*, and it hid a real source gap: `a5b6f20` moved Follow-ups under
> Clients but left **Packages as a top-level sidebar item**, in source and in production. The owner
> found it by opening the app. Closed by `58624ea`, which also made the navigation contract
> test-asserted against the source (`src/pages/servicesView.test.ts`) so a report claiming a
> completed move now fails a test instead of reaching the owner.
>
> **Authorization consequence:** Services is the owner/admin configuration area, so catalogue
> management inherits that gate. Reception no longer sees the Packages page — including its
> *sold packages* list. They keep package selection in the booking and walk-in forms and
> remaining-sessions/balance on the Staff App client card. If the desk list is needed back, the
> answer is a client-scoped view, not re-exposing catalogue configuration.


---

## TR-D1 checkout — which settings contract owns what (Phase 1, 2026-08-01)

> Long form: [PAYMENT_SETTINGS.md](docs/PAYMENT_SETTINGS.md). Phase 2B deployed the server executor
> 2026-08-02 and Phase 3 deployed the owner's Settings for it the same day — see
> [TR_CHECKOUT_ARCHITECTURE.md](docs/TR_CHECKOUT_ARCHITECTURE.md). **Nothing calls the executor yet:**
> a salon can now configure this checkout, but the Admin and Staff checkout screens are unchanged.
>
> **`checkoutSettings` is owner-only in `firestore.rules` as of Phase 3** (ruleset `b30abf64…`) — the
> gap Phase 1 recorded is closed. **The stored `schemaVersion` is now the monotonic settings version**
> (contract version moved to `contractVersion`), because the deployed executor compares exactly that
> field; every owner save increments it, so a till opened before a change cannot commit under it.

Three payment-ish contracts now exist. They are **not** interchangeable and must never be merged.

| Contract | Location | Public? | Owns |
|---|---|---|---|
| **PAY-1** `paymentSettings` | `tenants/{tid}` **root** | **PUBLIC** | ONLINE booking payment: pay-at-venue vs salOWN Connect, deposit/full/optional, expiry |
| **TR-B** `packageSettings` | `settings/settings` | private, owner-only | package sale, ledger, plan, outstanding, refunds, entitlement, **package payment permission** |
| **TR-D1** `checkoutSettings` | `settings/settings` | private, owner-only | IN-SALON tender methods, split, partial, unpaid, salon instalments, POS providers, general checkout permissions, receivables policy |

**Where both apply, both gates apply.** A staff member recording a PACKAGE payment by card needs
`packageSettings.staffMayRecordPayments` **and** the checkout card permission. There is deliberately
no second `staffMayRecordPayments` in `checkoutSettings`.

**Receivable arithmetic is shared, package semantics are not.** `foldReceivableLedger` in the
packagePlan parity core is package-free; `foldPackageLedger` is a thin adapter over it (TR-D1
strategy B, *logical* extraction — the generic functions live in a package-named file for now
because that core has no runtime imports by design; relocation waits for a second consumer).

**Nothing selects checkout mode from IP.** `countryCode`/tenant configuration decides. A TR tenant
opened from London stays TR.
