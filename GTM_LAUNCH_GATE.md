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

> **Re-verified 2026-09-09.** All still true, with one number corrected: whitecross **does** have a
> connected Stripe account (`acct_1TpIWBRkKlXdPojN`, charges + payouts enabled) — in **test** mode
> (`stripeConnectMode: 'test'`), which is what "entirely in TEST mode" means. `features.stripe` is
> `false` on **every** tenant, and that flag — not any code fix — is what currently prevents the
> `C-1`/`C-2` money defects from firing. Do not flip it on a tenant before those are fixed.
>
> **"0 `checkoutReceipt` docs in TRY" — re-measured, and it is stronger than written.** `checkoutReceipt`
> is a **field on a booking**, not a collection. Across 2,686 sampled bookings (whitecross 1,500 ·
> demo 772 · herohairs 405 · tr-demo 9) there are **0 `checkoutReceipt` fields in ANY currency on ANY
> tenant** — the TR-D1 server executor has never run in production, exactly as `TR_CHECKOUT_ARCHITECTURE.md`
> says ("deployed, deliberately unreachable").
> **But TRY money HAS been taken:** two tr-demo bookings are `CHECKED_OUT` with `saleCurrency: 'TRY'`,
> `paidAmount 300`, sources `Panel` and `Staff App` — i.e. through the **legacy browser path**, with no
> receipt snapshot. So "no receipts" must not be read as "no TRY sales"; it means those sales carry no
> currency-explicit snapshot. Relevant to the TR payment integrity hold, not a new defect.

---

## 1. Gate A — must close BEFORE the first marketing message goes out

| # | Work ID | What | ROADMAP status (2026-09-07) | Why it gates marketing |
|---|---|---|---|---|
| A1 | `LEG-1` | salOWN Terms of Service + Privacy pages; landing footer links are `href="#"` (`hosting/index.html:652-653`) | `PLANNED` (filed P2) — **drafts written 2026-09-07:** [LEGAL_TERMS_DRAFT.md](LEGAL_TERMS_DRAFT.md) · [LEGAL_PRIVACY_DRAFT.md](LEGAL_PRIVACY_DRAFT.md), owner fields + solicitor pending | Ad platforms reject a site with dead legal links; GDPR requires a privacy notice before collecting sign-up data. **Proposed P0.** |
| A2 | *(owner decision)* | Pricing + how the first paying salons pay. salOWN has **no subscription pipeline** (`M3` is vision); landing deliberately shows no price ("Request a demo") | — | You cannot market without knowing what you charge and how you collect. Manual invoice or a Stripe Payment Link needs **zero code**; `M1`/`M3` are not prerequisites. |
| A3 | `CHECKOUT-SERVER-AUTHORITY` | Till arithmetic enforced only in the browser; a till on a stale bundle can still write a double-counted checkout | **CLOSED 2026-09-10** — rules constraint LIVE, ruleset `5e102dd4-…`, ledger `R-2026-09-10-C`, published source byte-identical to `34f64af`. `ARTIFACT_VERIFIED`; promotes to `LIVE_VERIFIED` on the first observed production refusal | A new salon's first double-charge is a lost customer. Cheapest closing move per ROADMAP §5.0 option 2: **a Firestore rules constraint on the booking write**. |
| A4 | *(release)* | ~~`hosting:salown-staff` carries the 2026-08-30 checkout fix in source but the live staff bundle predates it~~ | **CLOSED before this gate opened** — `R-2026-08-30-H`, `c6df19884456d78b`, served bytes verified | Listed here on 2026-09-07 from a stale ROADMAP §5.0 paragraph; the ledger proved it live the same evening it was written. Kept struck through so nobody re-opens it. |
| A5 | `T-e` paths 3 + 4 | `updateStaffRole` / `registerMeAsAdmin` in `Settings.tsx` write the staff doc, never the claim. **Re-measured 2026-09-09 — two failures, and the gating one is (a):** **(a)** live rules make `staff/{uid}` writes **super-admin only**, so a non-super-admin owner is **hard-denied** and just sees `alert('Error: …')` — they cannot promote or register staff at all; **(b)** a super-admin's write succeeds doc-only → claim drift (the false success). `setStaffRoleCore` is written and tested but **not exposed as a callable and not deployed** | **`CONFIRMED_OPEN`** (Security theme) | The first thing a new owner does is add a colleague as admin. Today it reports "Saved" and changes nothing. Repoint at `setStaffRoleCore` (canonical writer `functions/src/staff/identity.ts`). |

**Gate A is done when:** legal pages are live and linked · the owner has written the price and the
collection method into ROADMAP §9.1 · the rules constraint (or the executor cutover) is
`LIVE_VERIFIED` · a non-super-admin owner
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
3. `T-e` paths 3 + 4 → `setStaffRoleCore`, then `E1` Phase 2 owner team management — 2–3 days.
4. `EV2` health-check + daily doc — 1 day.
5. `B7` WhatsApp finish (secrets → targeted deploy → owner live test) — as soon as Meta approves.
6. Owner in parallel: price + collection method · Stripe decision (Gate C) · confirm the funnel is the form.

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

- **2026-09-07 · A1 drafts** — Terms + Privacy written from the code (sub-processors, region, consent gating,
  unsubscribe, Connect model all checked). Blocked on the owner's entity name/address/ICO number and a
  solicitor read; then one owner-approved `hosting:salown` release (footer links + two pages).
- **2026-09-07 · A4 struck** — already live as `R-2026-08-30-H` (`c6df19884456d78b`); the gate had copied a
  stale ROADMAP paragraph. ROADMAP §5.0 corrected.
- **2026-09-07 · A3 `CHECKOUT-SERVER-AUTHORITY` — source complete, `PUSHED_NOT_LIVE`** (salown-app
  `edfa6e7`). Rules constraint + emulator suite 15/15 + mutation control; rules gate 186/186; Codex
  cross-review findings fixed. **Not closed:** needs the owner-approved ruleset release (rules last),
  then a read-only production observation of one refused over-allocation. ROADMAP §5.0 carries the detail.

- **2026-09-10 · A3 — release preparation found the rule would have REFUSED THE FIX; amended, still
  `PUSHED_NOT_LIVE`.** Gate work only, no deploy. Rules emulator gate re-run green on the day
  (221/221 before the amendment, **228/228** after); `ops/rules-authority.test.js` +
  `ops/deploy-policy.test.js` 58/58, so `salown-app/firestore.rules` is still the single deployable
  rules configuration; the LIVE ruleset was fetched from the API and diffed against the tree, and
  the delta is exactly the two intended work items with no console-side drift.
  **The finding:** the constraint mirrors `resolvePrePaidAmount`, and package D corrected that
  writer the same morning (`d9329a2` shape A+, `c10be71` D5). The rule still keyed its refund branch
  on `paymentProvider == 'EXTERNAL_CHECKOUT'`, a field ABSENT on 20 of the 25 exposed whitecross
  DEPOSIT bookings. Driven over the real population, the live-candidate ruleset DENIED the corrected
  till write on exactly those rows — not a missed defect, a refused fix. Amended to mirror
  `hasAuthoritativeRefund` and to carry both platform rails; pinned as §8 with a mutation control.
  **Ordering is now one-way:** `hosting:salown` released D3+D5 at 12:56Z, so the corrected writer is
  live and the rule is not. Deploying an older `firestore.rules` would take those checkouts to
  `permission-denied` at the desk. The amendment is a precondition of the release, not an
  improvement to it.
  **This release carries a second work item and it cannot be separated** — one file, one ruleset:
  FIN-B1's `settlementLedgerEnabled` owner-authority guard (`9a9547a`) landed in `firestore.rules`
  after `edfa6e7`. It must be presented for approval alongside A3.
  **What the release still will NOT close:** `whitecross-site/barber-mobile/app.js` is a separate
  deploy unit, and a writer that sends no receipt columns at all remains undecidable in rules. "A3
  is live" will not mean "the till can no longer double-count".

- **2026-09-10 · A3 `CHECKOUT-SERVER-AUTHORITY` — RELEASED, gate item closed.** Owner-approved
  `firestore:rules` deploy from `34f64af`; ruleset `a0a10819-…` → **`5e102dd4-e7e7-4950-b12a-14a74daa82e8`**
  at 13:39:16Z. Published source fetched back from the Rules API and compared: **80,896 bytes and
  sha256 `b05ac1e7515cb5a5…` on both sides, byte-identical.** Hosting ×3 unchanged, storage ruleset
  unchanged, composite indexes still 2 — `--only firestore:rules` kept the FIN-B1 index out of it.
  The release carried the amendment and FIN-B1's `settlementLedgerEnabled` owner-authority with it,
  both disclosed before approval; one file, one ruleset, no way to separate them.
  **Gate A now stands on A1 `LEG-1` (owner: legal entity name + address) and A2 (owner: pricing).**
  A5 `T-e` 3+4 is the next executable item and is NOT a Gate A blocker.
