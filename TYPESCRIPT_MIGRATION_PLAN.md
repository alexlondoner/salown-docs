# TypeScript Migration Plan — salOWN

> _This is no longer just a "migration checklist" — it is the **constitution** of the
> technical evolution over the next 2-3 years of a live, real-money SaaS. We are not
> changing a file extension; we are preparing the production foundation for the long
> term. The Invariants + Rules + DoD sections exist for this reason: even if the plan
> changes, these boundaries stay fixed._

> **Decision: 2026-07-08 (owner).** The system will be built on TS. This document is
> the *how* — with zero risk to the live system, phased, reversible.
> Source discussion: owner + Xlaude. Related: [ROADMAP.md](ROADMAP.md) I2 (index.js
> split) · [INVARIANTS.md](INVARIANTS.md) (externalId/money/date invariants).

> ## 🚫 NO PRODUCTION CODE IS MOVED IN PHASE 0
> The **only** output of Phase 0: `toolchain` + `type infrastructure`. **Features = 0**,
> refactor = 0, migrated prod modules = 0. This rule cuts scope-creep: the sole purpose
> of the first technical step is to set up the infrastructure; no behavior-changing work
> is mixed into the same commit → if a problem arises later, isolating the cause is easy.

## Milestone map (owner+GPT 07-08)
Tempo — each one is separate, verified, then passed (the discipline so far: *small change
→ production verification → documentation → next step*):
| | Milestone | Content |
|---|-----------|--------|
| **A** | 📄 Docs | This plan + ROADMAP commit+push → official decision (ADR) |
| **B** | 🛠 Toolchain ✅ **(2026-07-08)** | `tsconfig` (allowJs/checkJs:false/noEmit/strict:false), pipeline unchanged — see §7 DoD |
| **C** | 📦 Shared types ✅ **(2026-07-08)** | `packages/shared` models + domain language — option (b), see §7 Phase 1 DoD |
| **D** | 🔧 First real migration | first small module (identity/utils), `.js`+JSDoc |
| **E** | 💳 Stripe / Checkout | **LAST** — money modules, parity + rollback |

## 📜 Migration Invariants (if broken, migration stops — GPT 07-08)
These 8 items are a reference for "those who start reading the code, not the plan." Violation = stop.
1. **No tenant experiences downtime.**
2. **No Firestore path changes** (collection/doc paths are fixed).
3. **No API response shape changes** (callable/HTTP function output contract).
4. **NO database migration** (the TS transition does not change data schema/documents).
5. **The Stripe webhook contract does not change** (the fields we read from the event + handler behavior are fixed).
6. **Feature development does NOT stop** (migration does not block new features; new features come in TS).
7. **Every phase is rollback-able** (git revert + release tag + smoke).
8. **Production behavior IS the reference implementation** — old JS = spec. When in doubt, we do not ask
   "what should TS do?" but "what does today's JS do?". Parity is born from this item.
9. **Documentation is updated BEFORE implementation** — the decision is written here/in ROADMAP
   first, then the code. (This very plan is proof of that; it reduces indecision.)

## 📏 Migration Rules (team discipline — today 1 person+Claude, tomorrow 2+ engineers)
Rules that keep the migration from being left half-done:
- **No new JS is written.** New file = `.ts`/`.tsx` (or, as an intermediate step, `.js`+JSDoc).
- **New features come in TS.**
- **Old JS changes only for a bugfix** (NO opportunistic refactor).
- **Refactor only in a migration PR** (not mixed into a feature PR).
- **One concern per PR** — a PR is either migration or feature or bugfix; no mixing.
- **Behavior parity before optimization** — first the exact same behavior, improvement later.
- **Code and in-code comments in ENGLISH** (owner decision 2026-07-08) — so that when a non-Turkish-speaking
  engineer joins the team tomorrow, it is not a barrier. Docs can stay in Turkish; the code artifact
  (type files, comments, commit messages, script output) is English.

## 📊 KPI — progress board (directional, NOT a deadline · **counted automatically**)
> These numbers show *direction*, not a date (see §0.6 parity-driven). "0 JS" is a target
> direction; not a gate. **Not updated manually** → `npm run migration:stats` produces them (spec §7),
> so the numbers in the document are always real.

| Metric | Start (2026-07-08) | Target direction |
|--------|------------------------|-----------|
| Frontend JS/JSX files | **104** | → 0 |
| Frontend TS/TSX files | **0** | → 104 |
| Functions JS files | **5** (including index.js 5759 lines) | → 0 (split + .ts) |
| Functions TS | **0%** | → 100% |
| Shared models | **0 / 8** | → 8 / 8 |
| `any` usage | 0 | → as close to 0 as possible |
| `@ts-ignore` | 0 | → 0 (stays zero) |
| `strict` errors | N/A (off) | → 0 (by end of Phase 4) |

## Why now
For the first 3-4 months "a quickly-working product" was the right goal. Today: multi-tenant, Stripe
Connect, loyalty, marketing automation, campaign attribution, finance, AI, email
webhooks, discount engine, (soon) Capacitor — dozens of interconnected modules,
real money, real customers. At this scale the class of bugs we catch by hand today
(`'deposit'≠'DEPOSIT'` casing, phone format `083...`≠`+447...`, slug serviceId,
Firestore odd-path, dupes) **can be caught at compile-time.** TS is not a new feature
— it is the armor that protects tenants at scale.

---

## 0. Non-negotiable safety principles (these first)

> **GOLDEN RULE:** The working system runs the exact same code until we *consciously +
> verifiably* flip the switch — and the switch can be flipped back at any moment.

1. **Phase 0 is entirely inert.** New `.ts` files do NOT touch runtime as long as no one
   `require`s/`import`s them. The live system runs bit-for-bit the same bytes.
2. **Every behavior-carrying transformation comes with a parity test** (same input → same
   output, compared against the old JS) — especially money/date/dedup.
3. **Deploy discipline:** only in a clean window (index.js `git status` clean +
   other sessions pause for 30 min) · **`firebase deploy --only functions:salown`**
   (NEVER blanket `--only functions` = deletes 27 us-central1 orphans) · before deploy,
   announce tenant+URL, wait for approval · then booking-confirmation + Telegram smoke.
4. **Rollback = `git revert` + redeploy** (2 min, return to known-good state). Every phase
   must be independently revertible.
5. **Frontend and functions build SEPARATELY.** One cannot break the other in deploy; each
   phase targets one side.
6. **NO deadline — advances via parity.** Nowhere in this plan does it say "done in 3 weeks."
   Progress: `JS → TS → is the behavior exactly the same? → yes → next module`.
   Production migration proceeds by parity, not by calendar. The criterion is confidence, not speed.

---

## 1. Toolchain — two sides, two realities

### Frontend (`salown-app/src/`) — low friction
Vite supports TS **natively** (esbuild transpiles it). The `.jsx→.tsx` rename is
gradual; Vite works with no config at all. Type-checking is an optional layer
(`tsc --noEmit` in CI), it does not block the build. → **The React side is risk-free + gradual.**

### Functions (`salown-app/functions/`) — the careful side
Currently: `main: index.js`, CommonJS, no tsconfig, no build. Real `.ts` requires a
`tsc` build: `src/*.ts → lib/*.js`, `main` → `lib/index.js`, `predeploy`
build hook. **This is the ONLY real decision that changes the pipeline** → done in a single clean window,
keeping the old `index.js` as an instant rollback.

**✅ TOOLCHAIN DECISION (owner+GPT 07-08): DON'T skip the intermediate step — production stability >
developer convenience.** Order:
1. **Phase 0:** `allowJs/checkJs:false/noEmit` — pipeline does NOT change at all, only type info.
2. **Phase 1:** `packages/shared` models — runtime does not change.
3. **Phase 2:** first small module (identity, utils) + **real deploy** — pipeline is STILL the same.
4. **Phase 3:** toolchain proven + types settled + team accustomed → then move to **full `.ts`
   build for functions** (main→lib). Not before.

> **⚠️ CommonJS limitation (functions) — CAUTION**
> - `tsc --noEmit` only does **type checking**; it does not produce JS.
> - CommonJS `index.js` **cannot `require()` uncompiled `.ts` files.**
> - For this reason, throughout Phases 0-2 the running Functions code stays as **`.js` + JSDoc**.
> - The transition to a `.ts` implementation is done **only when the build pipeline (`src → lib`) is enabled**
>   (Phase 3).
> - → The existing `functions/clients/identity.ts` draft: is either converted to `identity.js`+JSDoc
>   for Phase 2, or kept inert until Phase 3. (There is NO such problem on the frontend — Vite
>   compiles `.ts`/`.tsx` natively.)

### Phase mechanics — at a glance "what is changing?" (owner+GPT 07-08)
| Phase | Runtime | Type checking | Build (src→lib) |
|-----|---------|---------------|-----------------|
| **0** | JS | JSDoc + `tsc --noEmit` | ❌ pipeline same |
| **1** | JS | + shared types | ❌ pipeline same |
| **2** | JS (`.js`+JSDoc) | JSDoc + shared types | ❌ pipeline same |
| **3** | **TS (`src/`)** | **Full TS** | ✅ **`src → lib`, `main: lib/index.js`** |
| **4** | TS | **`strict: true`** | ✅ |

> **The only moment the pipeline actually changes = Phase 3.** Throughout Phases 0-2 the functions deploy
> is bit-for-bit the same as today; `main: index.js` is preserved. In Phase 3 it becomes `main: lib/index.js`
> and the old `index.js` is kept for rollback. Note: the Phases in this table are a *runtime/build*
> lens; the module-order table in §3 is a *which module when* lens — the two complement each other
> like vertical/horizontal axes.

### Gradual tsconfig — NO big-bang (owner addition 07-08)
Don't convert everything on day one. Starting config:
```jsonc
{
  "compilerOptions": {
    "allowJs": true,     // existing .js keeps running
    "checkJs": false,    // don't type-check old JS yet (no noise)
    "strict": false,     // ⚠️ DON'T turn on day one — otherwise thousands of errors (see below)
    "noEmit": true       // in Phase 0 only checking, no emit
  }
}
```
This way: existing JS runs as is · new files are TS · no big-bang.

### `strict` is NOT turned on day one (owner addition 07-08)
Throughout the migration `strict:false` (or selectively: `strictNullChecks` first). **When migration
is done** `strict:true`. Turning it on early = being drowned in thousands of old-code errors →
it hides the real work. Keep strict as a finish line, not a starting line.

---

## 2. `shared/` — the single type source (and the deploy trap)

Goal: `Booking`, `Client`, `Tenant`, `Campaign`, `Coupon`, `Payment`, `Loyalty`
models **in one place** → used by both React and Functions, no duplicate interface.

**Trap:** Firebase Functions deploy uploads only the `functions/` folder →
it CANNOT require the repo-root `shared/`. The frontend (Vite) picks it up seamlessly via alias.

**Solution — monorepo workspace (owner preference 07-08, preferred):**
```
packages/shared/src/{booking,client,tenant,campaign,coupon,loyalty,invoice,payment}.ts
salown-app/            (frontend, Vite)
salown-app/functions/  (Cloud Functions)
```
`packages/shared` is a real npm **workspace package** (`@salown/shared`) → both
frontend and functions say `import type { Booking } from '@salown/shared'`. No copy
script, no duplicate interface.

> **🔑 Why this does NOT BREAK the functions deploy (critical insight):** as long as `packages/shared`
> is **type-only** (only `interface`/`type`, NO runtime code), when `tsc`
> compiles functions the `import type`s are **completely erased** → in the compiled `lib/`
> there is **no reference left** to `@salown/shared` → the deploy artifact is self-contained,
> no workspace-symlink resolution headache. Type-only shared is what makes the monorepo
> clean for functions too.
>
> ⚠️ **Boundary:** if runtime code ever enters shared (zod validators etc.) this
> erasure breaks → at that moment, bundling (esbuild/tsc into `outDir`) becomes necessary
> for the functions deploy. Rule: **`packages/shared` stays type-only**; runtime
> validation (zod) goes into a separate package/layer.

- The single source of truth (SSOT) = `packages/shared/src/`; both sides import it.
- If the repo structure isn't workspace-friendly, a temporary copy/generation can be used; but
  the long term = a shared package (cleaner).

### `packages/shared` — strict rules (owner+GPT 07-08): TRULY "zero runtime"
The "import type is erased" guarantee depends on **using `import type` everywhere**. If someone
writes `import { Booking }` (without type), TS may leave it as a runtime import → a
package-resolution error in functions. We prevent this in **two layers**:

**(1) Package content rule** — `packages/shared` only:
| ✔ ALLOWED | ✘ FORBIDDEN |
|--------|---------|
| `interface`, `type` | `function`, `class`, `const` (runtime value) |
| `enum` → **prefer union type** (`type X = 'a'\|'b'`, enum produces runtime code) | runtime validation / **zod** |
| utility types | `firebase`, `stripe` imports |

**(2) ESLint enforcement** — the `@typescript-eslint/consistent-type-imports` rule **forces**
`import type` at the editor + CI level → a wrong runtime import cannot form. (This rule
is included in the DoD's "ESLint clean" item.)

### Zod = SEPARATE package (type ≠ validation)
Types are lost at compile; zod runs at runtime. Don't mix them:
```
packages/shared-types/       # Booking.ts, Client.ts ...  → compile-time, erased
packages/shared-validation/  # booking.schema.ts ...      → runtime zod (Firestore boundary)
```
`shared-types` stays type-only (functions deploy clean); because `shared-validation` is runtime,
the side that uses it bundles it. The separation makes life much easier later.

### Shared = not just interfaces, but the DOMAIN LANGUAGE
Common unions/enums in one place → frontend + functions + admin + marketing **speak the same
language**: `BookingStatus`, `BookingSource`, `PaymentType`, `CampaignType`, `CampaignStatus`,
`CouponType`, `LoyaltyReason` (`LoyaltyAdjustmentReason`), `EmailEventType`,
`StripePaymentMode`, `TenantRole` (owner/admin/staff — see security/permissions).
These are scattered as string literals today (the source of the casing bug)
→ a single union type = compile-time protection. This "domain vocabulary" will be used in
dozens of places over time → a single source is essential.

---

## 3. Phase plan (order + each phase's "done" definition)

| Phase | Scope | Risk | Done definition (DoD) |
|-----|--------|------|--------------------|
| **0** | Toolchain skeleton: `shared/types/` + functions `tsconfig` (noEmit) + Vite alias. No prod file requires it. | **Zero** | `tsc --noEmit` green; deploy runs UNCHANGED; live bit-for-bit same |
| **1** ✅ **(2026-07-08)** | **Types first, implementation later** (owner 07-08): first-week goal = `Booking`, `Client`, `Tenant`, `Campaign`, `Coupon`, `Loyalty`, `Invoice`, `Payment` (`PaymentType='DEPOSIT'\|'FULL'`) + `BookingStatus`, `BookingSource` interfaces. **The code stays the same** — only type definitions. Even this starts preventing hundreds of bugs. | **Zero** | ✅ Models compile; no one imports them yet (see §7 Phase 1 DoD — including the invoice reality) |
| **2** | Functions split → TS, **order: stable/pure FIRST** (`clients/identity`, `utils/`, `parsers/`, `notifications/`, `marketing/`), **money modules LAST** (`checkout/`, `stripe/`, `bookings/` — actively being edited + money-critical). Each module: move → type → parity test → clean-window deploy. | **Controlled** | Each module: parity test passes + `functions:salown` deploy + 50 fn ACTIVE + booking-confirmation & Telegram smoke; index.js shrinks |
| **3** | React `src/` modules → `.tsx`; `utils/` + new components first; `strict` gradual. | **Low** (Vite native) | `tsc --noEmit` green; `npm run build` zero-error; app verified live |
| **4** | The biggest/riskiest files last (index.js remainder, Finance, Dashboard). | **High → isolated** | Full parity + smoke; rollback ready |

**Folder layout (functions):** `bookings/ · checkout/ · stripe/ · marketing/ ·
finance/ · loyalty/ · clients/ · parsers/ · notifications/ · reports/ · ai/ ·
utils/ · shared/`. (Not just readability — also better use of TS type checking.)

**First concrete module (start of Phase 2):** `clients/identity.ts` — the canonical identity
resolver (`normalizePhone/Email`, `matchIdentity`). Why first: (a) pure + fully
testable, (b) does not touch money/stripe/bookings, (c) simultaneously solves the
cross-source recognition + dedup + converted-client problem we live with today. The draft
is already written (`functions/clients/identity.ts`, currently inert, no one requires it).

---

## 3b. Canonical migration order (owner 07-08)
The file order *within* Phases 2-4 — from low-risk toward money. Because frontend TS
is Vite-native (no deploy risk) it can come early; no module that generates live money
movement is touched **in the first wave**:

```
Utilities → Types → Hooks → UI Components → Marketing → Clients →
Calendar → Reports → Admin → Functions → Notifications → Emails →
Stripe → Checkout → Payments
```

That is: utils/types/hooks/pure-UI first (cheapest, safest) → feature
areas → **Stripe / Checkout / Payments LAST**, one by one, with parity + smoke.

## 4. Rationale for the order (why money is last)
`Discount Codes → Checkout → Finance → Marketing Attribution → Reports` all share the same
areas — TS helps most here BUT also does the most damage here.
This chain is **actively being edited** (Stripe Phase 5, discount engine) and **carries
money.** So: first type its surroundings (harden the models + pure modules),
touch the chain last and one by one, with parity + smoke at every step.

---

## 5. Every migration PR's "Definition of Done" (owner 07-08)
No PR merges without passing these 7 conditions:
- ✅ TypeScript compiles (`tsc --noEmit` green)
- ✅ ESLint clean
- ✅ Vite build succeeds (`npm run build`)
- ✅ Firebase Functions build succeeds (if the functions side was touched)
- ✅ **Existing behavior unchanged** (a parity test on a behavior-carrying transformation)
- ✅ If no production deploy is required, **NO deploy**
- ✅ ROADMAP / this plan updated (DoD ✅ marked)

## 5b. Phase X — Production Verification (owner+GPT 07-08)
"TypeScript compiles" is NOT ENOUGH — the live system, the real flows must be verified. After a
module carrying money or hot paths is migrated (especially Phase 6 functions), the following
end-to-end flows are run manually/automatically:
- ✅ Vite build · ✅ Functions build · ✅ Firebase deploy smoke
- ✅ Stripe test payment · ✅ Walk-in checkout · ✅ Online booking
- ✅ Loyalty earn · ✅ Loyalty redeem
- ✅ Campaign send · ✅ Coupon redeem · ✅ Reports open

(see the `/verify` skill logic — drive the change in the real app, not just test/typecheck.)

## 5c. Rollback strategy (written for each phase — owner+GPT 07-08)
Especially when we reach Stripe/Checkout/Payments, so that the "return" decision does not
have to be made on the spot, it is **written in advance:**
- **Code:** `git revert <commit>` → return to a clean working tree.
- **Deploy:** the previous **git tag / release** (tag before every money-phase deploy).
- **Functions artifact:** revert to the previous deploy from the reverted code via
  `firebase deploy --only functions:salown` (NEVER blanket).
- **Verification:** re-run the §5b smoke checklist after rollback.
- **Rule:** before a money-module (stripe/checkout/bookings) deploy, no merge without the release tag +
  rollback steps written in the PR.

## 6. Open decisions (owner)
1. ~~Toolchain~~ → **DECIDED (07-08): start with the intermediate step (allowJs/checkJs); full
   `.ts` build in Phase 3, once the toolchain is proven and types have settled.** (see §1)
2. ~~`shared/` location~~ → **DECIDED (07-08, revised same day): option (b) —
   `salown-app/packages/shared/src/` (not a workspace, a type-only folder; see §7).**
   The type-only rule + separate zod `shared-validation` package principle (§2) applies as is;
   the "monorepo workspace" narrative in §2 was the target architecture, (b) is its root-free version.
3. **Tempo:** Phase 0+1 (zero-risk ground) this week; afterward by parity (no deadline).
   Approval of the first concrete step is yours.

---

## 7. Phase 0 — kickoff note (recon 2026-07-08, handed to a new session)

**Recon findings (repo structure):**
- `alex/` is NOT a **git repo** + there is NO root `package.json`.
- `salown-app` = its **own git root**; `functions/` is inside it (a separate deploy unit).
- Frontend: typescript is **not** installed (but `@types/react`/`@types/react-dom` exist); scripts have `dev/build/lint/test(vitest)`.
- functions: **no** typescript, CommonJS, `main: index.js`.

**✅ STRUCTURAL DECISION MADE (owner 2026-07-08): option (b)** — `shared` inside `salown-app`.
Eliminated alternatives: (a) making `alex/` the monorepo root (cleanest but the most structural touch;
`alex/` is not a git repo), (c) a separate `salown-shared` repo (setup + sync overhead).

**The concrete shape of (b):**
- Location: **`salown-app/packages/shared/src/{booking,client,tenant,campaign,coupon,loyalty,invoice,payment}.ts`**
  — NOT an npm workspace, just a folder of type-only `.ts` files (no root package.json needed).
- **Frontend resolution:** Vite/`tsc` relative path (later, if wanted, a tsconfig `paths` alias `@salown/shared`).
- **Functions resolution:** since in Phases 0-2 functions stay `.js`+JSDoc, the types are
  used via a JSDoc type-import `/** @type {import('../packages/shared/src/booking').Booking} */`
  — this is ONLY compile-time (`tsc --noEmit`); in the deploy artifact it's nothing but a comment
  → zero runtime effect, and `firebase deploy` does NOT hit the problem of uploading files outside the functions folder.
- ⚠️ In Phase 3 (functions `src→lib` build) these paths are revisited (rootDir/copy decision
  then) — as long as the type-only rule in §2 holds, the solution stays simple.

### ✅ Phase 1 DoD — COMPLETED (2026-07-08)
The **"types first, implementation later"** slice landed: under `salown-app/packages/shared/src/`
8/8 models + domain language, all **type-only** (interface/type/union; NO runtime code,
enum, firebase/stripe import), all with **English comments** (the language rule added to
the Migration Rules). The code stayed the same — no file imports these types yet (per the
definition of the Phase 1 DoD). The types were written with "old JS = spec": 5 parallel code
inventories (booking/client/tenant/campaign+coupon/payment) extracted all write sites with
file:line evidence; the quirks
(no `date` in walk-in, `barberId` name-vs-id, parser `price` "£25.00" string, three separate
paymentType dictionaries, the `paymentType:'CONFIRMED'` sentinel...) were documented in the types.

Files: `booking client tenant campaign coupon loyalty invoice payment` + `firestore`
(TimestampLike/DateLike/MoneyValue stand-ins) + `index` barrel. Domain language:
`BookingStatus` (7), `BookingSource` (7+`'block'`), `BookingPaymentType` (6, UPPERCASE),
`PaymentMethod`, `PaymentState`, `StripePaymentMode` (5, lowercase), `AggregatorPaymentType`,
`CouponType` (`'percent'|'amount'`), `CampaignType`, `EmailEventType` (Brevo, open-ended),
`TenantRole` (`owner|admin|staff`), `PlanKey`, `TenantFeatureKey`, `EmailOptOutReason`.

**Where the inventory CORRECTED the plan's assumptions (spec > plan):**
- **Invoice does NOT exist in the code** — no collection/number/PDF; the only artifact is ReceiptPanel (a
  non-persisted booking projection). `invoice.ts` was written as a RESERVED draft, clearly marked.
- **CampaignStatus is not persisted** (scheduling off; every campaignRun = sent) —
  no enum was invented. The `campaigns` collection is a template library, the send log is `campaignRuns`.
- **No LoyaltyReason enum** — adjustment `reason` is free text, earn/redeem from the sign of
  `points`; the auditLogs `manual_points_adjustment` shape was typed.
- **PaymentType is three separate dictionaries** (booking UPPERCASE / Stripe policy lowercase / aggregator
  config) — deliberately three separate unions; the boundary of the historical `'deposit'≠'DEPOSIT'` bug.

Verification: `tsc --noEmit` green (frontend `include: ["src","packages"]` + functions) ·
`npm run build` green unchanged (hosting output UNCHANGED) · `migration:stats` **8/8**
shared, other numbers fixed at baseline (104 js/jsx, 5 fn js, index.js 5759, any 0,
@ts-ignore 0) · NO deploy · behavior bit-for-bit same. Next: **Phase 2** — the first real module
`clients/identity` (`.js`+JSDoc, with parity test + clean-window deploy).

### ✅ Phase 2 (first wave: identity + utils) — LIVE (2026-07-09 morning, with owner "go")
**Move ✅ type ✅ parity ✅ deploy ✅ smoke ✅.** Two separate deploys (`--only functions:salown`):
1. **identity wiring** (`cedc677`): index.js requires `./clients/identity`; inline
   `_resolveClientDocId`/`_redemptionKey` deleted, 4 call sites routed to the module.
2. **utils wiring** (`aab2e73`): `./utils/{emailText,parserTime,campaignMerge}` required;
   16 inline helpers deleted. **index.js 5759 → 5582 lines (−177).**

Verification: after wiring, parity suite 6 pass / 6 self-skip (as designed) · tsc +
require-smoke green · 57 fn ACTIVE · iCal feed before/after deploy identical (whitecross
137, herohairs 2 VEVENT) · salownInboundEmail gate returns 401 on a wrong key · no crash in logs.

**Baggage surfaced by the deploy (non-migration, resolved):** `salownInboundEmail`
had been added to index.js but was NEVER deployed; the `INBOUND_WEBHOOK_SECRET` it
wanted was not in Secret Manager → the full-codebase deploy stopped at pre-flight. With owner approval
a random strong secret was generated (`functions:secrets:set`, an empty secret = the gate would be OPEN)
and the function went live for the FIRST TIME (staging-only behavior, locked with the secret).

**Phase 3 slice-1 is also LIVE:** 15 `src/utils` files → TypeScript (`9bd50df` rename +
`b2da067` annotation; byte-identical bundle proven → hosting no-op). KPI: frontend 89 js/jsx +
15 ts · functions 11 js (index.js 5582) · shared 8/8. Remaining Phase 2 order: parsers →
notifications → marketing → (LAST) checkout/stripe/bookings.

### ✅ Phase 2 COMPLETED — functions split done, ALL waves LIVE (2026-07-08 afternoon)
5 more waves the same day, each with a separate test + owner-approved deploy (`--only functions:salown`):
| Wave | Commit | Modules | index.js |
|---|---|---|---|
| parsers | `c8196ac` | parsers/{shared,booksy,fresha,treatwell,ical} | 5582→4395 |
| notifications | `37f1bcd` | notifications/ (Telegram+in-app+FCM) | →4250 |
| emails | `1eb1e45` | emails/ (transporter/Brevo/confirmation/reschedule) | →4001 |
| marketing | `764e074` | marketing/ (campaign render+sender routing) | →3950 |
| misc | `a74de84` | utils/ical + tenants/ + bookings/shared + inbound/ | →3719 |
| **money (LAST)** | `fde49bd` + tag `pre-money-modules-20260708` | checkout/ + finance/exit | **→3597** |

**Method (all waves):** scripted BYTE-VERBATIM move → test layer 1: byte-equality against
git HEAD (self-skip after wiring) → layer 2: behavior pins with fake IMAP/Firestore
→ tsc + require → deploy → smoke. Suite total **47 tests: 36 pass / 0 fail / 11 self-skip**.
Notable pins: inbound ADR-015 isolation (a token in the body NEVER routes; unknown
token quarantined) · checkout paymentMode matrix (off/pay_at_venue rejection, optional selection,
deposit→full fallback, deposit≤discounted-full cap, over-discount THROW = a free checkout
cannot reach Stripe) · EXIT_TERMS figures pinned (silent drift impossible).

**Smoke:** after each deploy, iCal feed identical + parser cron healthy (the 13:02 run verified
with the new parser modules) · inbound gate 401 · **money smoke:** a live `salownCreateCheckoutSession`
call against whitecross with a temporary invisible PENDING doc → the new checkout module's own error
("Online payment is not enabled") returned in prod = the moved money code runs live; the
artifact was deleted. Positive-path full-payment smoke: Stripe is in TEST mode; because whitecross
paymentMode=pay_at_venue, a real session can only be created if the mode is temporarily opened / a demo Connect
is attached — separately with the owner (the matrix already pins all branches).

**What tsc caught during the move** (the reason migration exists): INBOUND_TOKEN_RE,
extractSubjectFromRaw, isUkDst — three missing dependencies caught at compile-time.

**index.js remaining content (~3597):** 52 exports (trigger/callable orchestrators) + Stripe
Connect functions + AI (askAI). Bringing these down into modules will be handled together with
Phase 3's functions build (src→lib). **The remaining big work:** Phase 3 frontend (89 js/jsx), Phase 3
functions build, Phase 4 strict.

### 🗄️ Archive — night prep note (2026-07-08→09)
**Move + type + parity test ✅ · clean-window deploy ⏳ (owner decision: together in the morning).**
- **`functions/clients/identity.js`** (INERT, `91eb3d5`): `_resolveClientDocId` (:3818) +
  `_redemptionKey` (:4811) verbatim; `@ts-check`+JSDoc→shared types. Quirks deliberately
  preserved (loose phone normalization does NOT fold the country prefix; email match untrimmed;
  a phone-only probe returns null). Parity: node:test, the old impl is sliced from the index.js source
  and eval'd at test time → old===new, fixture + seeded sweep, 6/6. Server
  `_redemptionKey` === frontend `discountCodes.js redemptionKey` mirror also proven.
- **`functions/utils/{emailText,parserTime,campaignMerge}.js`** (INERT, `6de0bf9`):
  parser/campaign plumbing, 16 helpers verbatim (QP/RFC2047/multipart decode, UK-DST date
  math, parseTwTime, merge fields). Parity 6/6 — including THROW parity on a malformed date
  input (the old code throws too). The tests self-skip after wiring
  (characterization pins are permanent guards).
- **ESLint type-only guard ✅** (§2 DoD item, `6de0bf9`): `typescript-eslint` +
  `packages/shared`-scoped `consistent-type-imports` + a firebase/stripe/zod import BAN.
- **Wiring ready, NOT APPLIED:** the index.js diff is in the scratchpad
  (`phase2/identity-wiring.patch` 92 lines + `identity-plus-utils-wiring.patch` 326 lines,
  cumulative). Sandbox rehearsal: the patched index.js `node --check` + `require()` OK; the test
  suite 6 pass / 6 self-skip after wiring. Deploy plan (owner-approved, morning):
  1) identity wire → targeted `functions:salown` deploy → smoke (impact: sendMarketingEmail,
  salownSetEmailConsent), 2) utils wire → deploy → watch the next parser run (impact:
  salownParseEmails + iCal + campaign paths). Rollback: git revert + redeploy.

**The safe part of Phase 0 that DOES NOT REQUIRE A STRUCTURAL DECISION (do this):**
1. `salown-app/tsconfig.json` (frontend): `allowJs, checkJs:false, noEmit, strict:false, jsx:"react-jsx"` — DOES NOT AFFECT the Vite build (Vite uses esbuild); this config is only for `tsc --noEmit` type-checking + the editor.
2. `salown-app/functions/tsconfig.json`: `allowJs, checkJs:false, noEmit, strict:false`.
3. `typescript` devDep (frontend + functions) + a `"typecheck": "tsc --noEmit"` script.
4. **`npm run migration:stats`** — a small read-only dev script (`scripts/migration-stats.mjs`):
   JS/JSX + TS/TSX file counts, functions TS %, shared models N/8, `any` + `@ts-ignore`
   grep counts, date → prints to console. It feeds the KPI table (§KPI) **instead of by hand**.
   Does not touch prod, does not enter deploy (developer tool only).
5. **Verify:** `tsc --noEmit` green (no .ts yet → nothing to check, passes trivially) · `npm run build` (Vite) green unchanged · NO deploy · no behavior changed.
> This step DOES NOT CHANGE the pipeline, DOES NOT MOVE prod code, DOES NOT REQUIRE a deploy. The `packages/shared`
> stand-up waits until the (a/b/c) decision above (Milestone C).

### ✅ Phase 0 DoD — COMPLETED (2026-07-08)
Done (salown-app, single commit):
- ✅ `tsconfig.json` (frontend): allowJs / checkJs:false / noEmit / strict:false / jsx:react-jsx — does not touch the Vite build
- ✅ `functions/tsconfig.json`: allowJs / checkJs:false / noEmit / strict:false / module+moduleResolution:`nodenext` (TS6 deprecated `moduleResolution:node`; no `type` in package.json → .js files resolve as CJS, identical to runtime)
- ✅ `typescript` devDep (frontend + functions) + `npm run typecheck` on both sides
- ✅ `scripts/migration-stats.mjs` + `npm run migration:stats` (read-only KPI counter)

Verification results:
- ✅ `tsc --noEmit` green (frontend + functions; no .ts yet → passes trivially)
- ✅ `npm run build` (Vite) green unchanged — hosting bundle output UNCHANGED
- ✅ `migration:stats` verified the baseline exactly: frontend **104** js/jsx / **0** ts, functions **5** js (index.js **5759** lines) / **0%** TS, shared **0/8**, `any` **0**, `@ts-ignore` **0**
- ✅ NO deploy · `main: index.js` as is · no prod file moved · behavior bit-for-bit same

Note: `packages/shared` was deliberately NOT SET UP (the structural a/b/c decision → Milestone C). Next step: **Phase 1** (shared model types) — ~~the a/b/c decision first~~ → decided: **(b)**, below.

---

---

## 9. Release Candidate discipline (tech-lead advice, 2026-07-08 — ACCEPTED)
From now on progress is told not by commit but by RELEASE. The stops:

| Tag | Gate | Status |
|---|---|---|
| `v0.9.0-rc1` | Phase 2 done (functions split, 6 waves live) | ✅ 2026-07-08 |
| `v0.9.0-rc2` | Frontend TS ≥ 50% | ✅ 2026-07-09 (52 ts / 52 js) |
| `v0.9.0-rc3` | Functions TS build (`src→lib`, `main` change) | ⏳ |
| `v1.0.0` | `strict: true` + `any`=0 + ARCHITECTURE_V2.md | ⏳ |

**⚠️ rc3 DAY RULE (tech-lead, 2026-07-09 — BINDING):** rc3 (functions
`src→lib`, `main` change) is the ONE step in the whole migration that changes the runtime model.
On that day NO OTHER big work is done — the day's sole goal: *pipeline changed · deploy
successful · smoke passed · rollback verified* — and the day ends. It is NOT a "let's do a
couple more things" day. Frontend slice, feature, refactor → another day.

**⚠️ rc3+1 PRODUCT-VERIFICATION DAY (tech-lead suggestion, owner 2026-07-11 — BINDING):**
On the day after rc3 NO migration/refactor is done. The day is spent USING the product:
take a real booking · do a checkout · use loyalty · run a discount code · try a Stripe
refund · send a marketing campaign · look at the Finance report. What is verified is
not code but the PRODUCT. **The success metric is a single question:** *"Did the salon
using this system notice at all that a migration happened?"* If the answer is NO, the migration
is done at the product level too; if YES, everything noticed is treated as an rc3 regression
(v1.0.0 is not tagged until that day closes).

**Every RC's INVARIANT checklist** (written into the annotated tag message):
- ✅ Type coverage (TYPE_COVERAGE.md current, numbers from the board)
- ✅ Test count (functions npm test + vitest, 0 fail)
- ✅ Production smoke (§5b — the paths that phase affects verified live)
- ✅ Rollback verified (return path from the previous tag written + testable)
- ✅ Documentation current (this plan + TESTS.md + edit log)

## 10-11. Framework: **Evidence-driven migration** (name: 2026-07-09)

The backbone of the migration is three safety layers — none sufficient alone, together
strong: **(1) Type-only rule** (§11, intent evidence: a commit cannot change behavior) →
**(2) Bundle equality** (method, behavior evidence: prove it didn't change with a byte-diff)
→ **(3) Firebreak** (§10, diagnosis evidence: if something slips through anyway, the fault
range is a single commit). Supporting layers: production smoke (production evidence, §5b) +
rollback tag (recovery evidence, §5c/§9). The principle: *not "I think we didn't break it" but
"we have this evidence that we didn't break it."*

## 10. Firebreak rule (tech-lead advice, 2026-07-09 — ACCEPTED, BINDING)

The last 20% of Phase 3 is a "controlled landing," not a marathon. **The goal from this point
on is not to increase coverage but diagnosis speed: if a regression appears, the fault range = 1 commit.**

**Rule:** Interconnected high-risk domain files (**Clients, Marketing,
CheckoutPanel, BookingPage, Finance, Settings, firestoreActions.js** — all
touch the Booking→Client→Payment→Firestore→Marketing→Finance chain) are NOT migrated
consecutively in the same work window. After each critical migration, a **firebreak**:

1. Coverage is updated (board/TYPE_COVERAGE.md).
2. Production smoke is done (§5b — the live paths that file affects).
3. At least one observation window is left (preferably 1 night).
4. Move to the next critical file ONLY if the previous commit stayed clean in production.

**Rationale — the limit of byte-identical proof:** the bundle-equality proof rests on the
"surgical slice" assumption. It is very strong on small/medium files; on the monsters, lint
enforcements (ternary→if/else, catch binding), implicit-return changes, prop
defaults, type-narrowing refactors become inevitable and bundle equality alone is
not enough → isolation on the time axis is provided by the firebreak. If the last 8 files
are converted in two days, a regression has 8 candidates; with the firebreak, always 1.

For small/medium files (byte-identical proven) a firebreak is NOT NEEDED — the existing
per-slice tsc+lint+bundle-diff+vitest chain is sufficient.

### §10 REVISION — risk-clustered window grouping (owner, 2026-07-11 — BINDING)

The "a separate day for each file" tempo was relaxed for the remaining 7 firebreak files into
**windows by risk cluster.** Each slice still goes with the full evidence chain (tsc + lint +
bundle-diff + vitest + smoke); what changes is the granularity of the observation window:

```
Day 1: firestoreActions → Clients → Marketing        (─ night: shared observation)
Day 2: CheckoutPanel → BookingPage                   (─ night: shared observation)
Day 3: Finance                                        (─ night: ALONE)
Day 4: Settings                                       (─ night: ALONE)
```

**Rationale:** Finance = the center of the money side; Settings = the center that can change
system behavior. **Two different risk clusters — never left in production in the same
observation window.** The first five files are neighboring domains; the grouping limits the
regression-candidate count to at most 3 on day 1, 2 on day 2 (an accepted trade-off),
and always 1 for Finance and Settings.

Do NOT move to the next window until a window's night comes out clean (item 4 as is).

**KPI change (owner, 2026-07-11):** In the last 8%, the success metric is no longer "how many
files did we convert today?" — but **"did we keep the risk controlled today?"** Technical risk
comes not from line count but from blast radius (firestoreActions = central dependency,
Finance = the money-flow center, Settings = the behavior-configuration center). The measure:
**all four of the four windows closing clean** — if all four are clean, rc3 has been reached
on solid ground.

## 11. "Migration = Type-only" rule (tech-lead advice, 2026-07-09 — ACCEPTED, BINDING)

**A TS migration commit is NOT a behavior commit.** It is a trust contract:
everyone on the team must be able to say "if I see a migration commit, behavior did not change" —
6 months later, the answer to "why did LoginScreen change?" must be a single sentence: *"type
migration."* In a regression hunt, migration commits are automatically eliminated → the search space
shrinks (when a wrong number appears in Finance, the refactor(ts)'s among the last 15 commits drop instantly).

**Rules:**
1. Within a migration slice, NO behavior improvement/UX change/business-rule change
   is done. Content: rename + interface/type/generic/`import type`/ref-event types.
2. If a REAL BUG is found during migration (e.g. missing import → ReferenceError):
   it is fixed as a **separate commit**, with a `fix(...)` prefix and explicitly stated
   in the commit message. It is not mixed into the slice commit.
3. Behavior-neutral cleanups like dead code / unused binding also do not enter the slice:
   they are marked in the slice with line-level eslint-disable, and the cleanup is done in a
   SEPARATE follow-up commit. (Example: ProfileBar `activeSocials`/`isAdmin`, slice 2z.)
4. The micro-transformations FORCED by lint (ternary-statement→if/else, unused catch
   binding→`catch {}`) may stay in the slice BUT are listed one by one in the commit message and
   their behaviorlessness is proven by bundle byte-equality.
5. Commit message convention: slices `refactor(ts): migrate X to TypeScript`
   (with a slice label) · bugs `fix(scope): ...` · behavior `feat(scope): ...`.

**Retro note:** e66a5bf (the ProfileView signOut import fix was inside the slice) was BEFORE this
rule; it was stated in the commit message, but from now on a separate fix commit is required.

## 8. Post-migration deliverable: `docs/ARCHITECTURE_V2.md` (tech-lead advice, 2026-07-08)
When the migration is done (after Phase 4) this document WILL BE WRITTEN — the answer to
"how does the system work today". Content: repository structure · why packages/shared exists (type-only rule)
· functions build chain (src→lib) · frontend-functions type sharing · deployment flow
(CI hosting + targeted functions) · domain boundaries (module map) · the rationale of the decisions
taken (with pointers to DECISIONS.md). This plan is the document of the migration; V2 the document of the architecture.
Also, the test classification was recorded in TESTS.md (parity/pin/money/integration/cross-mirror/smoke)
and all deliberate `any`s are labeled `TODO(ts-migration)` (grep-able).

*This plan is a living document — mark the DoD ✅ when each phase is done, and if there is a
deviation, add it consciously by saying "it's not in the plan, let's add it" (ROADMAP discipline).*
