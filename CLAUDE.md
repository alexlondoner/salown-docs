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
| [TENANTS.md](docs/TENANTS.md) | Whitecross/HeroHairs/EeKurt details, Class A/B definition |
| [PEOPLE.md](docs/PEOPLE.md) | People, roles, emails |
| [FIRESTORE_SCHEMA.md](docs/FIRESTORE_SCHEMA.md) | Data structure, booking model quirks, client identity |
| [BUSINESS_RULES.md](docs/BUSINESS_RULES.md) | Cancel/reschedule policy, slot generation, deposit flow |
| [BUSY_SLOT_V2.md](docs/BUSY_SLOT_V2.md) | DESIGN: processing-time / multi-interval busy engine + channel architecture, test matrix, phases |
| [SERVICE_CONFIG_V2.md](docs/SERVICE_CONFIG_V2.md) | DESIGN: detailed service config (Booksy+Fresha+Treatwell superset), segment array model (service/processing/blocked), editor sections |
| [SERVICE_EDITOR_DESIGN_BRIEF.md](docs/SERVICE_EDITOR_DESIGN_BRIEF.md) | Service editor REDESIGN brief (for the designer): all fields, sections, wait/squeeze-in hero module, states, brand tokens, "visual only" rule |
| [FEATURE_FLAGS.md](docs/FEATURE_FLAGS.md) | Flag list + what it does, loyalty/telegram config |
| [EMAIL_ARCHITECTURE.md](docs/EMAIL_ARCHITECTURE.md) | Brevo, "via salOWN", GDPR unsubscribe, IMAP parser |
| [DEPLOY.md](docs/DEPLOY.md) | Build/deploy commands, symlink, safety order |
| [INCIDENTS.md](docs/INCIDENTS.md) | Past incidents + lessons learned — **read BEFORE starting bug diagnosis** (see Quick Rule #7) |
| [INVARIANTS.md](docs/INVARIANTS.md) | **Breaks the system if violated** — money/date/booking/matching/security/deploy invariants, with source citations; read BEFORE touching the relevant area |
| [KNOWN_QUIRKS.md](docs/KNOWN_QUIRKS.md) | Odd but **intentional** behaviors — "don't mistake for a bug and fix"; INVARIANTS/latent-bug distinction inside |
| [DECISIONS.md](docs/DECISIONS.md) | **Why we did it this way** (ADR): email/payment/POS/deletion/repo decisions + rationale + rejected alternatives |
| [PRINCIPLES.md](docs/PRINCIPLES.md) | **How we engineer** (P1-P14) — each principle tagged ⚙️ machine-enforceable / 🧠 human-discipline. (DECISIONS=why, INVARIANTS=what won't break, PRINCIPLES=how) |
| [PARSER_NOTES.md](docs/PARSER_NOTES.md) | Booksy/Fresha/Treatwell parser architecture, dedup system, recurring bug patterns |
| [STRIPE_CONNECT_PLAN.md](docs/STRIPE_CONNECT_PLAN.md) | DESIGN: salOWN payment = Stripe Connect Standard + Checkout Session; fixed £ deposit; per-tenant policy; disabled/future |
| [TIERS_AND_UPGRADE.md](docs/TIERS_AND_UPGRADE.md) | DESIGN: tiers (Free/Starter/Pro/Pro+) + tenant's **in-account** plan upgrade ("like Anthropic"); Phase 1 request→approve (no charge), Phase 2 Stripe **Billing** subscription (Connect≠Billing), Pro+ = premium website+SEO; ROADMAP **Monetization** theme |
| [MIGRATION_PATTERNS.md](docs/MIGRATION_PATTERNS.md) | 21 engineering patterns discovered with proof during the TS migration (byte-neutral solution alphabet, Pattern 20 TS import-elision diagnosis recipe, byte-proof v2 method) — KEEP OPEN when translating a slice |
| [SECURITY.md](docs/SECURITY.md) | **Firestore rules & security SINGLE SOURCE**: rules architecture, Phase 1 (done), open gates G1–G5 (code counter-analysis + blast radius + fix), booking flow security |
| [BOOKING_SECURITY_POLICY_MIGRATION.md](docs/BOOKING_SECURITY_POLICY_MIGRATION.md) | **AUTHORITATIVE parent plan** merging B2 booking-settings + UK phone-identity into one migration: BookingPage/premium → authoritative `salownCreateBooking` callable → policy validation → server identity resolution → transactional trusted create (Stripe webhook payment-only). 22 locked decisions + 10 bounded child packages (I1–E1) in dependency order. ROADMAP `B2`/`B3`/`B4` |
| [DEPLOYMENT_STATUS.md](docs/DEPLOYMENT_STATUS.md) | **Push-vs-live ledger** — for a given commit, is production actually on it? Tracks the gap between `origin/main` and deployed (hosting auto-deploys; functions/rules/whitecross-site are manual). Not `SYNC.md` (retrospective), not `ROADMAP.md` (plan) |
| [STAFF_SETTINGS_AUDIT.md](docs/STAFF_SETTINGS_AUDIT.md) | Staff availability/settings audit (2026-07-12): leave has 5 different behaviors across 5 surfaces, Finance ghost-wage risk, target model (single resolver) + implementation order — ROADMAP G5 |
| [STAFF_MANAGEMENT_DESIGN.md](docs/STAFF_MANAGEMENT_DESIGN.md) | DESIGN: Staff Management & Compensation (ROADMAP **Employment Model** theme, S1-S3) — staffComp collection, wage/commission/self-employed accounting rules, migration plan, Staff hub UI, 3 phases |
| [NORMALIZATION.md](docs/NORMALIZATION.md) | All normalize/match/casing rules, helper table, known inconsistencies |
| [MULTI_TENANT_NOTES.md](docs/MULTI_TENANT_NOTES.md) | Class A/B guards, whitecross migration table |
| [ROADMAP.md](docs/ROADMAP.md) | **Company roadmap** (restructured 2026-07-16): priority-ordered work themes + 5 tags (✅/🔄/🔵 Planned/⏸ Waiting/💡 Future); active=single-line, completed at the bottom under **Completed**; item IDs (A1/B3/C8/S1…) preserved |
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
- `ROADMAP.md` — what is planned
- `ops/claims/` — current path ownership
- `SYNC.md` — completed sync and deployment history

Full protocol: `salown-app/ops/claims/README.md`

---

## Quick Rules

1. **Before deploy:** state tenant + URL, wait for confirmation
2. **New salown-app trigger:** add self-managed tenant guard (see: MULTI_TENANT_NOTES.md)
3. **Date:** use `toDateKey()`, never `.toISOString().split('T')[0]`
4. **Bulk delete:** export → dry-run CSV → confirm → write
5. **Feature flag:** read from tenant doc, don't hardcode
6. **Fix:** one bug, changed lines report, then move to the next
7. **Bug/incident:** Before starting to diagnose a problem (email not sending, booking not landing/showing, blank page, 404, payment/confirmation), **read [docs/INCIDENTS.md](docs/INCIDENTS.md) FIRST** — the same patterns recur, the root cause + diagnosis method is probably there. Also add a resolved serious incident there with the **standard template**: `## YYYY-MM-DD — title` + metadata line (**Severity** 🔴/🟠/🟡/🟢 · **Owner** · **Status** ✅/🟡/🔴) + **Impact/Root Cause/Resolution/Prevention** + **Lessons**. The template is at the top of the file; where possible write a permanent guard/test into Prevention. If the same bug returns, Status = 🔴 Regressed.
