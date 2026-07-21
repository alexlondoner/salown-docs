# PRINCIPLES.md — Engineering Principles (corporate engineering principles)

> **What this file is:** **cross-cutting engineering rules** distilled from incidents, decisions, and recurring mistakes. The division of labor with sibling documents is preserved (they are NOT copies of each other):
>
> | Document | Its responsibility |
> |---|---|
> | [DECISIONS.md](DECISIONS.md) | **Why** did we choose this path? (individual ADR) |
> | [INCIDENTS.md](INCIDENTS.md) | **What broke?** (postmortem) |
> | [INVARIANTS.md](INVARIANTS.md) | **What must never be broken** |
> | **PRINCIPLES.md** | **How do we engineer?** (a rule applied everywhere) |

> **Meta-principle:** *As long as a principle stays prose, it is decorative.* But not every principle CAN be auto-enforced — that doesn't make it worthless. So every principle has a **Type**:
> - **⚙️ Machine-enforceable** — can be embedded in a guard/test/CI/lint. These have a **Status:** `✅ enforced` or `⏳ guard TODO`.
> - **🧠 Human discipline** — inherently non-automatable (e.g. "listen to the owner's field knowledge"). Staying prose is CORRECT; it sets the reader's expectation right.
>
> ⚠️ **Don't make the "enforced count" a KPI.** The goal is not "12 of 14 enforced"; the goal is to move the ⚙️ ones into a guard and to express the 🧠 ones clearly. The two categories give the reader the right expectation — that's all.

> Source: these principles were scattered across [INCIDENTS.md](INCIDENTS.md) + [ROADMAP.md](ROADMAP.md) + memory; gathered into one place at the owner's suggestion (2026-07-21).

---

## 1. Deploy Discipline

**P1 — Targeted deploy, never blanket.** Function deploy with the codebase prefix (`functions:salown:X` / `functions:whitecross:Y`); never a bare `--only functions`.
- *Why:* a bare deploy deletes orphans in another region + rebinds unrelated functions. · *Source:* memory `functions_deploy_gotcha`; INCIDENTS 2026-07-21.
- **Type:** ⚙️ Machine-enforceable — **Status:** ✅ `whitecross-site/scripts/deploy-functions.sh` (function name required; `all`/`functions`/blanket rejected; tested).

**P2 — Announce before deploy; confirm.** Before deploy, tenant + URL, wait for confirmation (exception: if during an incident the owner says "fix first").
- *Source:* CLAUDE.md #1; memory `deploy_safety`.
- **Type:** 🧠 Human discipline.

**P3 — Post-deploy smoke on the money path.** After a payment/critical fn deploy, one end-to-end check (does a new booking get a `cs_live`).
- *Why:* silent credential/binding errors aren't visible in the code. · *Source:* INCIDENTS 2026-07-21 (a test key hidden for 17 days).
- **Type:** ⚙️ Machine-enforceable — **Status:** ✅ `whitecross-site/scripts/check-stripe-live-key.sh` (verifies before/after deploy that the live slot is `sk_live`; test key → deploy rejected).

---

## 2. Data Integrity & SSOT

**P4 — One source of truth per concept.** Every concept (booking, normalization rule, slot generation, sourceColors) in one place; every consuming path goes through it.
- *Why:* two copies drift → field-conflict. · *Source:* booking=SSOT; `generateSlots` outer-scope; `sourceColors.js`.
- **Type:** 🧠 Human discipline (code review).

**P5 — Never duplicate normalization.** Add-on/status/name/date from a single helper (`normalizeSoldAddOns`, `barberKey()`, status uppercase, `toDateKey()`); DON'T WRITE a second local normalize.
- *Why:* three layers with the same mistake = data loss. · *Source:* INCIDENTS 2026-07-18.
- **Type:** ⚙️ Machine-enforceable — **Status:** ✅ `soldAddOns.test.ts` (7 regression); ⏳ lint/test can be extended for the other helpers.

**P6 — Dates: `toDateKey()`, never `toISOString().split('T')[0]`.**
- *Why:* timezone shift → wrong day. · *Source:* CLAUDE.md #3.
- **Type:** ⚙️ Machine-enforceable — **Status:** ⏳ guard TODO: lint rule banning `toISOString().split`.

---

## 3. Secrets & Config

**P7 — Secrets belong to the application boundary, not the tenant boundary. No secret name shared across two apps.** ❌ `STRIPE_SECRET_KEY` → ✅ `WC_STRIPE_SECRET_KEY` / `SALOWN_STRIPE_SECRET_KEY` / `ADMIN_…`; the same for Brevo/Telegram/OpenAI/Google OAuth.
- *Why:* a shared name = one app's Stripe test overwrites the other's live payment. · *Source:* 🏛️ INCIDENTS 2026-07-21 (the event that birthed this principle); ROADMAP P0. *(Tenants already hold no secret — the Connect `acct_` model; the problem is at the app-boundary.)*
- **Type:** ⚙️ Machine-enforceable — **Status:** ⏳ guard TODO: secret split (ROADMAP P0) + a validator that rejects writing `sk_test` to the live slot. (The P3 guard provides an interim shield.)

**P8 — Feature flags from tenant doc, before rollout.** Read the flag from the tenant doc (don't hardcode); ship behind a new feature flag, live-test, then turn it on.
- *Source:* CLAUDE.md #5; the `EXTRAS_ENABLED` flow.
- **Type:** 🧠 Human discipline.

---

## 4. Change Discipline

**P9 — One bug at a time; report changed lines; keep scope narrow.** "Fix this" = exactly that; mention the opportunity, don't spread without approval.
- *Source:* CLAUDE.md #6; memory `keep_scope_narrow`.
- **Type:** 🧠 Human discipline.

**P10 — Every fix ships a regression test that pins the bug.**
- *Why:* so the same class of bug doesn't return. · *Source:* memory `incidents_discipline`.
- **Type:** ⚙️ Machine-enforceable — **Status:** ✅ rules suite (95/95) + `npm test`; ⏳ PR template + CI check "test for the changed behavior?" (frontend not broad).

**P11 — Check INCIDENTS.md before diagnosing.**
- *Source:* CLAUDE.md #7; memory `check_incidents_first`.
- **Type:** 🧠 Human discipline.

---

## 5. Safety & Isolation

**P12 — Best-effort side effects never break the main path.** Notification/email/telemetry/loyalty isolated with try/catch; the main flow doesn't fall with them.
- *Source:* confirmation email `sendBrevoEmail` try/catch.
- **Type:** 🧠 Human discipline (code pattern).

**P13 — Multi-session git isolation: explicit paths only.** Only your own file with an explicit path; never `git restore .`/`checkout .`/`reset --hard`/`add .`.
- *Why:* it deletes someone else's uncommitted work. · *Source:* memory `multi_session_git_isolation`.
- **Type:** 🧠 Human discipline.

**P14 — Destructive bulk ops: export → dry-run → confirm → write.**
- *Source:* CLAUDE.md #4.
- **Type:** 🧠 Human discipline.

---

## How it grows

- If a new incident points to a recurring pattern → add a principle here, link the incident in **Source**.
- **The real work is not prose but moving the ⚙️ ones into a guard.** Loop: `Incident → Root Cause → Principle → Roadmap → Automation/Guard → can't recur`. The 🧠 ones stay prose — this is not a gap but the correct classification.
