# salOWN Documentation

This repository is the brain of salOWN.

Not just code documentation — it's the memory, architecture, decisions, incidents, and operating principles behind the platform.

If the application disappeared tomorrow, this documentation should be enough for a new team to understand:

* why salOWN exists,
* how it works,
* why certain decisions were made,
* what has gone wrong before,
* and where the platform is going next.

> **Where the code lives:** `salown-app` (main repo, `salOWN.git`) · `super-admin` (`salownadmin.git`) · `whitecross-site` (`whitecross-site.git`). These docs cover all of them → a deliberately separate, cross-repo "brain" repo ([DECISIONS.md](DECISIONS.md) ADR-012).

---

## What is salOWN?

salOWN is a salon operating system built inside a real London barbershop.

It combines bookings, walk-ins, sales, loyalty, marketing, reporting and multi-channel integrations into one live operating panel.

Unlike marketplaces such as Booksy, Fresha and Treatwell, salOWN does not own the client relationship or take commission on bookings.

Instead, it helps salons run their entire business while keeping ownership of their customers and data.

> 🗺️ **Visual system map:** [SYSTEM_MAP.html](SYSTEM_MAP.html) — surfaces → backend/data → aggregator pipe → output → tenant/deploy/commercial layer, on one page. **Updated as salOWN changes** (snapshot; source: ARCHITECTURE_V2 / ROADMAP / FIRESTORE_SCHEMA + code).

---

## How did it start?

It started with an old Celeron laptop, a simple price list for our own barbershop, and a website.

One problem led to another:

* Lost walk-ins
* Double bookings
* Checkout chaos
* Five platforms that never talked to each other

So we started building our own tools.

Today, salOWN runs live in London salons and is improved continuously using real feedback from real businesses.

---

## Technology

* Frontend: React + Vite — **TypeScript, strict** (v1.0.0, 2026-07-13; see [ARCHITECTURE_V2](ARCHITECTURE_V2.md))
* Backend: Firebase (Auth + Firestore + Functions, `havuz-44f70`, `europe-west2`)
* Multi-tenant architecture — all tenant data under `tenants/{tenantId}/...`; `tenantId` in the Firebase custom claim

Core differentiators:

* IMAP booking parser (unifies Booksy / Fresha / Treatwell emails into one screen)
* Unified booking panel
* Ask salOWN AI
* Built and tested inside a working salon

> **Current status lives in one place only:** 👉 [ROADMAP.md](ROADMAP.md). It is *not* repeated here — status duplicated in prose goes stale.

---

## Start Here

### Product Manager (~30 min)

1. [MANIFESTO.md](MANIFESTO.md) — why it exists, philosophy, goal
2. [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) — where the pieces are, repo map
3. [ROADMAP.md](ROADMAP.md) — done / next / blockers (**single source of truth**)
4. [DECISIONS.md](DECISIONS.md) — why we chose this (with rejected alternatives)
5. [INCIDENTS.md](INCIDENTS.md) — what broke before, what we learned

### Engineer (~60 min)

Above 1–2, then:

3. [FIRESTORE_SCHEMA.md](FIRESTORE_SCHEMA.md) — data model, booking quirks
4. [INVARIANTS.md](INVARIANTS.md) — **break these and the system breaks** (read BEFORE writing code)
5. [KNOWN_QUIRKS.md](KNOWN_QUIRKS.md) — strange but intentional ("don't fix it thinking it's a bug")
6. [BUSINESS_RULES.md](BUSINESS_RULES.md) + [SECURITY.md](SECURITY.md) + [NORMALIZATION.md](NORMALIZATION.md)
7. The detail doc for the area you'll work in (see map below)

### Designer

[MANIFESTO.md](MANIFESTO.md) → [SERVICE_EDITOR_DESIGN_BRIEF.md](SERVICE_EDITOR_DESIGN_BRIEF.md) → the relevant feature plan

> 📖 **Stuck on a term?** [GLOSSARY.md](GLOSSARY.md) — tenant, Class A/B, walk-in, aggregator, squeeze-in, canary, SSOT, `pp()`, `toDateKey()`… all with one-line explanations. Keep it open while reading.

---

## Project Memory System

The project's "why / how / what happened" knowledge lives in 4 cross-linked files. Know where to look:

| File | Question it answers | When it's written |
|------|--------------------|-------------------|
| [INCIDENTS.md](INCIDENTS.md) | **What broke?** — event + root cause + lesson | When a serious bug/outage is resolved |
| [INVARIANTS.md](INVARIANTS.md) | **What must always remain true?** | When an incident produces a permanent rule |
| [KNOWN_QUIRKS.md](KNOWN_QUIRKS.md) | **What looks strange but is intentional?** | When counter-intuitive-but-correct behaviour is found |
| [DECISIONS.md](DECISIONS.md) | **Why did we choose this approach?** — ADR + rejected paths | When a significant architecture/product call is made |

**Flow:** `INCIDENTS (what happened) → INVARIANTS (rule) → KNOWN_QUIRKS (don't touch) → DECISIONS (why)`. All four are cross-linked.

---

## Document Map (35 files)

### 1. Orientation
[CLAUDE](CLAUDE.md) (AI context index — canonical; `alex/CLAUDE.md` symlinks here) · [MANIFESTO](MANIFESTO.md) · [SYSTEM_ARCHITECTURE](SYSTEM_ARCHITECTURE.md) · [GLOSSARY](GLOSSARY.md) · [TENANTS](TENANTS.md) (Whitecross/HeroHairs live; EeKurt inactive) · [PEOPLE](PEOPLE.md) (people/roles/emails)

### 2. Rules & Memory
[INVARIANTS](INVARIANTS.md) · [KNOWN_QUIRKS](KNOWN_QUIRKS.md) · [DECISIONS](DECISIONS.md) · [INCIDENTS](INCIDENTS.md)

### 3. How it works (domain rules)
[BUSINESS_RULES](BUSINESS_RULES.md) (cancel/reschedule/slot/deposit) · [FIRESTORE_SCHEMA](FIRESTORE_SCHEMA.md) · [NORMALIZATION](NORMALIZATION.md) (match/casing) · [EMAIL_ARCHITECTURE](EMAIL_ARCHITECTURE.md) (Brevo/GDPR) · [PARSER_NOTES](PARSER_NOTES.md) (Booksy/Fresha/Treatwell) · [FEATURE_FLAGS](FEATURE_FLAGS.md) · [MULTI_TENANT_NOTES](MULTI_TENANT_NOTES.md) (Class A/B guards) · [SECURITY](SECURITY.md) (rules single source of truth)

### 4. Planning & diagnosis
[ROADMAP](ROADMAP.md) (**status SSOT** — status vocabulary + Master Active Table) · [RELEASE_LEDGER](RELEASE_LEDGER.md) (**what is actually running**, per deployable unit) · [ARCHITECTURE_REVIEW_2026-07-02](ARCHITECTURE_REVIEW_2026-07-02.md) (outside-eye diagnosis) · [TESTS](TESTS.md) (test records SSOT) · Design/plan: [BUSY_SLOT_V2](BUSY_SLOT_V2.md) (+[RISKS](BUSY_SLOT_V2_RISKS.md)/[TESTPLAN](BUSY_SLOT_V2_TESTPLAN.md)) · [SERVICE_CONFIG_V2](SERVICE_CONFIG_V2.md) · [SERVICE_EDITOR_DESIGN_BRIEF](SERVICE_EDITOR_DESIGN_BRIEF.md) · [STRIPE_CONNECT_PLAN](STRIPE_CONNECT_PLAN.md) · [C5_LAPSED_DEDUP_PLAN](C5_LAPSED_DEDUP_PLAN.md) · [CAMPAIGNS_V2](CAMPAIGNS_V2.md) (C8 audience scope) · [CLIENT_CARD_V2](CLIENT_CARD_V2.md) (C9 client panel redesign) · [RC3_RUNBOOK](RC3_RUNBOOK.md) (functions src→lib day) · [V1_RUNBOOK](V1_RUNBOOK.md) (migration finishing sprint → v1.0.0) · [ARCHITECTURE_V2](ARCHITECTURE_V2.md) (post-TS architecture, v1.0.0) · [AUDIT_TRAIL_PLAN](AUDIT_TRAIL_PLAN.md) (I4 full audit coverage)

### 5. Operations
[DEPLOY](DEPLOY.md) (build/deploy + security order) · [RELEASE_LEDGER](RELEASE_LEDGER.md) (release rows + rollback identities) · `scripts/daily-reconciliation-check.sh` (read-only Daily Project Truth check) · `scripts/end-of-day-sync-check.sh` (read-only backup check) · [PROMPTS](PROMPTS.md) · `firestore.rules.{LIVE,DRAFT,PREV-*,ROLLBACK}` (live = **LIVE**) · `test-firestore-rules.py` (rules test suite)

---

## Conventions (everyone follows)

**Source of truth (SSOT):** the *current status* of any work lives only in [ROADMAP.md](ROADMAP.md). Detail docs hold the technical content, not the status badge. **ROADMAP is a company roadmap, not a feature list** — priority-ordered business themes, with the detail moved to a bottom **Completed** section. Item IDs (A1, B3, C8, G3, I2, S1…) are preserved, so cross-references still resolve.

**Status vocabulary (mandatory since the 2026-08-12 reconciliation).** Every active item carries exactly one of `LIVE_VERIFIED` · `PUSHED_NOT_LIVE` · `IN_PROGRESS` · `PLANNED` · `BLOCKED` · `DORMANT` · `STATUS_UNKNOWN`. Bare "Done" / "Shipped" / "LIVE" are **forbidden**, because they hide the only distinction that has ever mattered here: *on `origin/main`* versus *actually serving customers*. ROADMAP opens with a **Master Active Table** keyed by stable Work IDs (`REL-*`, `FIN-*`, `WCP-*`, `CAM-*`, `BK-*`, `STF-*`, `TR-*`, `LOC-*`, `SEC-*`, `TEC-*`, `VIS-*`…). Never infer "live" from a commit existing or from a commit timestamp — this team has deployed *then* committed, so timestamps prove nothing in either direction.

**What is actually running:** [RELEASE_LEDGER.md](RELEASE_LEDGER.md) — one structured row per release per deployable unit (source SHA or an explicit `UNKNOWN`, previous→new live identity, verification, rollback identity, exclusions). [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md) keeps the narrative push-vs-live story; `salown-app/SYNC.md` keeps the human day log.

**Adding a new record:**
- **Incident?** → the 8-field template at the top of [INCIDENTS.md](INCIDENTS.md) (Severity/Owner/Status + Impact/Root Cause/Resolution/Prevention + Lessons).
- **Decision?** → the ADR format in [DECISIONS.md](DECISIONS.md) (Context/Decision/Alternatives/Outcome).
- **Rule?** → [INVARIANTS.md](INVARIANTS.md); **intentional quirk?** → [KNOWN_QUIRKS.md](KNOWN_QUIRKS.md).
- **New work appeared?** → add it to [ROADMAP.md](ROADMAP.md) under the right theme with a label (don't drift off-road).
- **Marking something Done?** → say which: `PUSHED_NOT_LIVE` or `LIVE_VERIFIED`. Find the *real feature commit* (`git log -S --follow`, not the migration commit); code-present ≠ working. `LIVE_VERIFIED` needs production evidence for the exact behaviour — a live revision, a version id, a served byte, or a source marker inside the deployed artifact. Move the detail to the **Completed** section.
- **Released something?** → add the [RELEASE_LEDGER.md](RELEASE_LEDGER.md) row, **including the rollback identity**, in the same commit as the status change. A release with no ledger row has not been recorded.
- **Closing the day?** → run `scripts/daily-reconciliation-check.sh` (read-only) and follow the **Daily Project Truth** protocol in [CLAUDE.md](CLAUDE.md#daily-project-truth). No product status change? Record `DAILY_RECONCILIATION_COMPLETE — NO STATUS CHANGE`, so silence is distinguishable from forgetting.

**Before diagnosing a bug:** search [INCIDENTS.md](INCIDENTS.md) for a similar event — the same patterns keep recurring.

**Before deploying:** announce the target tenant + URL, wait for confirmation. **Never deploy from an uncommitted or dirty tree, and never deploy then commit** — pin a commit, build from it, release it, and record the *previous* live identity first, because it is the rollback anchor and cannot be recovered afterwards. Order (for security changes): functions → hosting → rules LAST. Details: [DEPLOY.md](DEPLOY.md) · [RELEASE_LEDGER.md](RELEASE_LEDGER.md).

---

## Contributing to this docs repo

```bash
cd ~/Desktop/alex/docs        # = salown-docs (private)
# edit...
git pull                      # another session may have updated (active, shared repo)
git commit <file> -m "..."    # docs is its OWN repo → safe here
git push
```
- **In this docs repo** `git add` is safe (it's its own repo). But in **app repos** (salown-app etc.) commit ONLY your own file by explicit path — never `git add .` / `reset --hard` (it wipes another session's work).
- If you add a new file, add a line to the **document map** in this README.
- The AI context index is now **versioned as [`CLAUDE.md`](CLAUDE.md) in this repo** (canonical). `alex/CLAUDE.md` is a **symlink** to it — edit `docs/CLAUDE.md`, never the symlink target's copy.

### Bootstrap (new machine setup)

The `alex/` folder is NOT a git repo → its `CLAUDE.md` symlink is set up by hand once per machine:

```bash
cd ~/Desktop/alex
ln -sf docs/CLAUDE.md CLAUDE.md      # AI context index (canonical = docs/CLAUDE.md)
ls -l CLAUDE.md                       # verify: CLAUDE.md -> docs/CLAUDE.md
```

The canonical content lives in `docs/CLAUDE.md` (versioned + pushed); thanks to the symlink, editing happens in one place, no drift. `salown-app/CLAUDE.md` is separate and is already versioned in its own repo.

---

## One Rule

The code explains **what** the system does.

The docs explain **why**.

---

*This repo is maintained jointly by multiple Claude sessions and the founder. `git pull` at the start of each session, `git push` after every meaningful change — so the memory stays single and current.*
