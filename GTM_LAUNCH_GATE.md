# GTM_LAUNCH_GATE.md — what must close before salOWN starts marketing

> **Opened 2026-09-07** by the owner's decision: *"let's go live, meaning let's start marketing."*
> This document is the **go-to-market gate**: the ordered list of work that stands between today
> and actively selling salOWN to new salons. It is a **filter over [ROADMAP.md](ROADMAP.md)**, not
> a second roadmap — every item below keeps its ROADMAP Work ID and **ROADMAP owns the status
> badge**. When an item closes, flip it in ROADMAP first, then tick it here.
>
> **Audience:** every Claude session, Codex (which prepares task prompts from the *prompt seeds*
> below when an item's turn comes), and the owner. Written in English per the repo language rule.

---

## 0. The verdict in one paragraph

The product works: two live salons (whitecross, herohairs), the apply → approve → set-password
funnel is live, the hosted booking page creates through the authoritative callable, and the
campaign chain is closed end-to-end. **Most of ROADMAP's P0 rows are Whitecross-specific
finance/rota depth (`FIN-*`, `ROTA-*`) and do not block a new salon's first month.** What
actually blocks marketing is a short list of commercial, legal and "first stranger walks in"
items, several of which are filed as P2 today. This gate promotes them in *order*, not in badge.

**Business facts at opening:** 2 live salons · 7 tenant documents (never a customer count) ·
Stripe entirely in TEST mode · TR payment integrity hold active · 0 `checkoutReceipt` docs in TRY.

---

## 1. Gate A — must close BEFORE the first marketing message goes out

| # | Work ID | What | ROADMAP status (2026-09-07) | Why it gates marketing |
|---|---|---|---|---|
| A1 | `LEG-1` | salOWN Terms of Service + Privacy pages; landing footer links are `href="#"` (`hosting/index.html:648-649`) | `PLANNED` (filed P2) | Ad platforms reject a site with dead legal links; GDPR requires a privacy notice before collecting sign-up data. **Proposed P0.** |
| A2 | *(owner decision)* | Pricing + how the first paying salons pay. salOWN has **no subscription pipeline** (`M3` is vision); landing deliberately shows no price ("Request a demo") | — | You cannot market without knowing what you charge and how you collect. Manual invoice or a Stripe Payment Link needs **zero code**; `M1`/`M3` are not prerequisites. |
| A3 | `CHECKOUT-SERVER-AUTHORITY` | Till arithmetic enforced only in the browser; a till on a stale bundle can still write a double-counted checkout | `CONFIRMED_OPEN` (P0) | A new salon's first double-charge is a lost customer. Cheapest closing move per ROADMAP §5.0 option 2: **a Firestore rules constraint on the booking write**. |
| A4 | *(release)* | `hosting:salown-staff` carries the 2026-08-30 checkout fix in source but the **live staff bundle predates it** (`496e69c` → `6e28ae8`, +755 B) | not deployed | ROADMAP §5.0: *"the Staff App till must not be used until it is."* A prospect who installs the staff app hits the known fault. |
| A5 | `T-e` paths 3 + 4 | `updateStaffRole` / `registerMeAsAdmin` in `Settings.tsx` write the staff doc, never the claim → **false success**; rules already block them for non-super-admins | open (Security theme) | The first thing a new owner does is add a colleague as admin. Today it reports "Saved" and changes nothing. Repoint at `setStaffRoleCore` (canonical writer `functions/src/staff/identity.ts`). |

**Gate A is done when:** legal pages are live and linked · the owner has written the price and the
collection method into ROADMAP §9.1 · the rules constraint (or the executor cutover) is
`LIVE_VERIFIED` · `hosting:salown-staff` is released and hash-verified · a non-super-admin owner
can promote staff → admin and the claim actually changes (read-only Auth proof).

---

## 2. Gate B — closes during the first 3–5 salons (before it becomes an incident)

| # | Work ID | What | ROADMAP status | Trigger point |
|---|---|---|---|---|
| B1 | `E1` Phase 2 | Staff assignment + delete are super-admin only; owner cannot manage their own team end-to-end | `PLANNED` | ROADMAP's own words: *"chokepoint not at 1000 but at ~the 3rd salon."* |
| B2 | `ADM-H5` | Super-admin cannot open an owner account directly; the only working path is demo request → Applications → Approve. "Add Tenant" + "Set Claim" produce an empty shell (no `tenantRole`) | `PLANNED` | Fine while every lead arrives through the form. Breaks the day a salon is closed on the phone and must be opened by hand. Keep `/signup` + `provisionTenant` active (memory: keep-self-onboarding-active). |
| B3 | `T-g` | Signup creates the Auth user **before** the tenant, no rollback → orphan accounts on provisioning failure (2 exist) | open | Every marketing-driven signup is another chance to mint an orphan. |
| B4 | Secret namespacing | `BREVO_API_KEY`, Telegram, OpenAI, Google OAuth still shared names; ROADMAP: *"namespace all shared secrets before tenant #4"* | 🔵 | Tenant #4. |
| B5 | `EV2` | No health-check / uptime job; availability is unprovable | `PLANNED` | First "your site was down" support ticket. |
| B6 | `B4` | Phone country code inconsistent across 5 entry points (no +353); splits one client into two | 🔵 | First Irish / non-UK salon. |
| B7 | `B7` | WhatsApp booking confirmations (Meta Cloud API, plan-gated) — infrastructure on `main` at `b3b6cb4`, secrets do not exist, owner buys the number 2026-09-06 | `PUSHED_NOT_LIVE` | Not a blocker; a **selling point**. Ships via [WHATSAPP_PLAN.md](WHATSAPP_PLAN.md) §6–7 once the four `WHATSAPP_*` secrets exist. |

---

## 3. Gate C — only if the marketing promise includes it

| Promise in the marketing copy | Then this must close first | ROADMAP status |
|---|---|---|
| "Take deposits / online payments" | `PAY-1` Stripe Go-LIVE (owner supplies **salOWN platform** live keys — never Whitecross's account) + the two SALOWN_CONNECT money bugs (Payments theme, 🔴, Connect has **never run in production**) | `BLOCKED` on owner |
| Turkey | KVKK (not started) · lift the TR payment integrity hold · `TR-U11` controlled TRY E2E · `TR-P2` remaining i18n | `BLOCKED` / `PLANNED` |
| "Multi-location" | `LOC-1` — nothing reads a location today | `PLANNED` |
| "Self-serve plan upgrade" | `COM-M1` request → approve queue | `PLANNED` |
| A native app / App Store listing | `D1` Capacitor | `DORMANT` (owner decision) |

Do not write a promise into the landing page that sits in this table with an open status.

---

## 4. Explicitly NOT on this gate

`FIN-DATED-ROTA-R2d`, `FIN-PERIOD-CLOSE(-C)`, `ROTA-BOOTSTRAP-APPLY`, `ROTA-HISTORY-SEED`,
`FIN-ROTA-HISTORY-READ`, `SALOWN-FIN-ROTA-INTEGRATION-GATE`, `FIN-PROCESSOR-FEES`,
`OCC-CAPACITY-AUTHORITY`, `IN-SALON-DEPOSIT`, `BOOKSY-HAPPY-HOURS`, `WCP-1/3`. All remain P0/P1
for **Whitecross correctness** and keep their ROADMAP priority — they are simply not what a new
salon needs in month one. A GTM sprint must not be spent on them.

---

## 5. Proposed sprint order (2 weeks, single purpose)

1. `LEG-1` legal pages — 1 day.
2. `CHECKOUT-SERVER-AUTHORITY` rules constraint — 1 day, rules deployed **last**, emulator test first.
3. `hosting:salown-staff` isolated release of the 2026-08-30 fix — half a day, hash-verified.
4. `T-e` paths 3 + 4 → `setStaffRoleCore`, then `E1` Phase 2 owner team management — 2–3 days.
5. `EV2` health-check + daily doc — 1 day.
6. `B7` WhatsApp finish (secrets → targeted deploy → owner live test) — as soon as Meta approves.
7. Owner in parallel: price + collection method · Stripe decision (Gate C) · confirm the funnel is the form.

**One change → deploy → owner live test → next** (memory: one-change-at-a-time mode). No bundle.

---

## 6. Prompt seeds — for Codex / any session preparing a task prompt

Every task prompt cut from this gate must carry these five parts. Fill them from ROADMAP and the
detail docs at the time the prompt is written — do not copy stale values from here.

```
GOAL      one sentence, the Work ID, and the Gate letter (A/B/C) from GTM_LAUNCH_GATE.md
SCOPE     exact paths (claim them first: `ops/claims/claims.sh`; Rule 7 = hard stop, no "append anyway")
PROOF     what LIVE_VERIFIED means for THIS item — served byte / marker / live revision / read-only prod read
OUT       what is explicitly not touched (usually: rules unless stated, staff bundle, Whitecross site)
RELEASE   target + rollback identity read BEFORE deploy; hosting:salown only from the git-archive workspace;
          functions only with the `functions:salown:` prefix; rules deployed last; owner approves the deploy
```

Seeds per Gate A item:

- **A1 `LEG-1`** — GOAL: publish `/terms` and `/privacy` under `hosting/` and point the landing
  footer at them. SCOPE: `hosting/index.html` footer + two new static pages; **no `src/**`** so the
  release is landing-only. PROOF: both URLs return 200 with the new content, footer hrefs no longer
  `#`. OUT: tenant-side whitecross legal pages (already ✅). Content needs the owner's legal entity
  name and address — ask, do not invent.
- **A3 `CHECKOUT-SERVER-AUTHORITY`** — GOAL: a booking write whose collected tenders exceed the
  sale total is DENIED by `firestore.rules`, regardless of bundle. SCOPE: `firestore.rules` + a new
  `test/rules/*.emulator.test.js`; the I3 invariant lives in `resolveCheckoutOverAllocation`, mirror
  it, do not reinvent it. PROOF: emulator test red→green, then the live ruleset fetched back and
  byte-compared, then one real over-allocation attempt denied in prod (read-only observation).
  OUT: the UI cutover to `functions/src/checkout/executor.ts` (the "real fix", separate package).
  Rules are shared by every tenant — read [`feedback_firestore_rules_safety`] before touching.
- **A4 staff release** — GOAL: `hosting:salown-staff` serves the `6e28ae8` staff bundle. SCOPE:
  `hosting/staff-bundle/**` build + deploy only. PROOF: before/after version ids, served
  `staff-*.js` sha256 == local build, previous entry 404. OUT: `hosting:salown` (REL-1 hook
  hazard — build from the isolated workspace).
- **A5 `T-e` 3+4** — GOAL: `Settings.tsx` role changes go through `setStaffRoleCore` so the claim
  and the staff doc move together. SCOPE: `src/pages/Settings.tsx` (two handlers) + the callable
  surface in `functions/src/index.ts` (check the B7 claim on that file first). PROOF: read-only
  Auth listing shows `tenantRole` changed for a test staff account at a non-whitecross tenant; the
  old path's false "Saved" is gone. OUT: paths 1 and 5 (`provisionTenant` ownership, super-admin
  `setTenantClaim`), `E1` delete policy.

---

## 7. Owner decisions this gate is waiting on

| # | Decision | Unblocks |
|---|---|---|
| 1 | Price per tier and how the first salons pay (invoice / Payment Link / nothing yet) | A2, landing copy |
| 2 | Legal entity name + address for ToS/Privacy | A1 |
| 3 | Is "online deposits" in the launch promise? If yes: salOWN platform Stripe live keys | Gate C row 1 |
| 4 | UK-only launch, or TR in the same wave? | Gate C row 2 |
| 5 | Confirm every lead enters via the demo/apply form (so `ADM-H5` can stay Gate B) | B2 |

---

*Status of this document: opened 2026-09-07 00:45 UK. Documentation only — no code, no deploy, no
production access. Ticks below are appended as items close in ROADMAP.*

## 8. Closure log

- *(empty — nothing on this gate has closed yet)*
