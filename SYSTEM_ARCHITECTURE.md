# SYSTEM_ARCHITECTURE.md

## Repo Map

*Verified against the working tree and the live project on 2026-09-09.*

```
~/Desktop/alex/
├── salown-app/         ← MAIN ACTIVE REPO — Vite + React, 100 % TypeScript (.ts/.tsx).
│                         Panel, landing, public booking, public salon site, staff app,
│                         the `salown` Functions codebase (europe-west2), rules + indexes.
├── whitecross-site/    ← ACTIVE, SEPARATE REPO — Whitecross's premium public site
│                         (hosting `whitecrossbarbers-saas`) and the `whitecross` Functions
│                         codebase in us-central1: Stripe, refunds, loyalty, receipts.
│                         Still released regularly (REL-12 went live 2026-09-09). NOT legacy.
│   └── barber-panel/   ← LEGACY panel — do not develop
├── super-admin/        ← SaaS super-admin console (Vite) → hosting `salown-admin`
├── salown-panel/       ← LEGACY CRA panel, NOT a git repo, served by nothing.
│                         ⛔ Never run a deploy from this directory (see the warning below).
├── salown-marketplace/ ← marketplace work
└── whitecross2/        ← scratch copy
```

**Gone:** `salown-site/` (deleted 2026-06-29 — everything deploys from `salown-app/hosting/`) and
`eekurtbarbers/` (the folder is no longer on disk; **there is no `eekurt` tenant in Firestore either**).

### The four repos in one sentence each

- **`salown-app`** — the product. Everything new goes here.
- **`whitecross-site`** — one premium tenant's own website **plus** the money functions that serve it.
  Whitecross is a salOWN **tenant**, not a separate product; its *panel* is salOWN, its *site* is here.
- **`super-admin`** — the platform operator's console.
- **`salown-panel`** — history. Read-only reference at most.

## Firebase

- Project: `havuz-44f70`, region `europe-west2`
- Storage bucket: `havuz-44f70.firebasestorage.app`
- All tenant data lives under `tenants/{tenantId}/...`
- **10 Hosting sites exist on the project** (read 2026-09-09). The four that matter:
  `salown` → salown.com (landing + panel + `/book/**` + `/s/**`) ·
  `salown-admin` → admin.salown.com (**super-admin console, served from `super-admin/dist`**) ·
  `salown-staff` → staff.salown.com (mobile staff app) ·
  `whitecrossbarbers-saas` → the Whitecross premium site.
  Also live but secondary: `whitecrossbarbers-admin` / `whitecrossbarbers-owner` (the legacy premium
  barber panel, two targets, byte-identical) and `whitecrossbarbers-app`, `havuz-44f70*` (unused).
- **121 Cloud Functions live**: 91 `europe-west2` (codebase `salown`) + 30 `us-central1` (codebase `whitecross`).

### Deploy ownership — which repo owns which Firebase product

`FIRESTORE-RULES-SSOT-P0`, 2026-08-16. Several repos hold a `firebase.json`; **owning a config is
not owning a product.** Only the config listed here may deploy the product beside it.

| Product | Sole authority | Config → target | Enforced by |
|---|---|---|---|
| **Firestore rules** | **`salown-app/`** | `firebase.json` → `firestore.rules` | `salown-app/ops/rules-authority.test.js`; every other `firebase.json` has **no** `firestore` block, so a rules deploy there fails at config parse |
| **Firestore indexes** | **`salown-app/`** | `firebase.json` → `firestore.indexes.json` | same test. `TEC-6` (the file/live drift) is **closed** in `9a9547a`: file 3 vs live 2, live-not-in-file = none, so a deploy creates the B1 index and offers no deletion. ⚠️ Still don't run it outside the FIN-B1 release sequence, and answer *no* to any deletion prompt |
| **Storage rules** | `whitecross-site/` | `firebase.json` → `storage.rules` | sole declaration in the workspace (unreviewed by this package — it is the only copy, not a verified one) |
| Hosting `salown`, `salown-staff` | `salown-app/` | CI (`hosting:salown`) / `npm run deploy:staff` | `ops/deploy-policy.test.js` |
| Hosting `whitecrossbarbers-*` | `whitecross-site/` | `firebase.admin.json` (CI) · `firebase.json` (`./deploy.sh`) · `firebase.saas.json` (public site) | `scripts/check-rules-authority.sh` (rules only) |
| Hosting `salown-admin` | `super-admin/` | `firebase.json` | — |
| Functions `salown` | `salown-app/` | `firebase.json` codebase `salown` | targeted `--only functions:salown:FN` |
| Functions `whitecross` | `whitecross-site/` | `firebase.json` codebase `whitecross` | `scripts/deploy-functions.sh` (no blanket deploys) |

Dead configs kept for reference are renamed `*.LEGACY-DO-NOT-DEPLOY.txt` and are referenced by no
config: `salown-panel/firestore.rules.LEGACY-DO-NOT-DEPLOY.txt`,
`whitecross-site/barber-panel/firestore.rules.LEGACY-DO-NOT-DEPLOY.txt`,
`whitecross-site/firestore.indexes.json.LEGACY-DO-NOT-DEPLOY.txt`. Per-repo detail lives in each
repo's `FIRESTORE_RULES_AUTHORITY.md`. Full command + rollback procedure: [DEPLOY.md](DEPLOY.md).

## Tech Stack

- **salown-app**: Vite + React, **strict TypeScript throughout** — `src/` is 297 `.ts` + 124 `.tsx`
  and **zero** `.js`/`.jsx` (counted 2026-09-09). Firebase Auth + Firestore + Functions.
  The TS migration closed 2026-07-13 at v1.0.0; **new code is `.ts`/`.tsx`, a `.js` file is never added.**
  `functions/src` is mixed by design: `.ts` for source, `.js` for the node-test files next to it.
- **whitecross-site**: **active**, plain JS Functions (`us-central1`) + the premium static site.
  Released independently and manually — see `MULTI_TENANT_NOTES.md` and `DEPLOY.md`.
- **salown-panel**: CRA (.js) — legacy, developed by nobody, served by nothing.
- **salown-site**: DELETED (2026-06-29) — deploy is now ONLY from `salown-app/hosting/`.

## ~~Migration Decision: salown-panel → salown-app~~ — ✅ **FINISHED** (historical)

*This migration is over.* Every page named in the old order — Dashboard, Bookings, Calendar, Finance,
Reports, Clients and the rest — lives in `salown-app/src/pages` as `.tsx`, and hardcoded `whitecross`
references were replaced by `tenantId` from Firebase custom claims. The separate TypeScript migration
closed on top of it (v1.0.0, 2026-07-13). **Nothing is pending here.**

The rule that survives: **never add anything to `salown-panel`**, and never deploy from it.

> ⚠️ **`~/Desktop/alex/salown-panel/` is NOT A GIT REPOSITORY**, is in no claim registry, and its
> `firebase.json` deploys to hosting target `salown-admin`. It holds a byte-identical copy of the
> whitecross `barber-panel` Team Members page — so it writes the three rota cache fields directly and
> still carries the 2026-08-10 lost-update propagation fan-out — and it has a populated `build/`.
> **✅ RESOLVED 2026-08-17 (`R2c-EV.3`, read-only): this panel is served by NOTHING**, so it is *not*
> on any rules-deploy blast radius. `salown-admin` **is** a live site — but it serves the
> **super-admin console** from `alex/super-admin/dist` (`versions/9f457fc2c8ee4b35`, released
> `2026-07-31T10:27:45Z`, 7 files / 318 KB, `<title>super-admin</title>`, Vite). `salown-panel/build`
> is CRA, base-pathed `/app-bundle/`, and that path 404s everywhere.
> ⚠️ **The hazard that remains is the deploy AIM, not the panel:** a bare `firebase deploy --only
> hosting` in `salown-panel` would replace the live super-admin console with a June CRA build, from a
> directory with no git history to roll back to. **Do not run a deploy from this directory.**
> ROADMAP `SALOWN-PANEL-1` (resolved) → `SALOWN-PANEL-2` (fix the aim; blocks nothing).

## salown-app — Key Files

**Brand:** Purple `#534AB7` / `#7B72E8`, Inter font. Gold `#d4af37` checkout/loyalty UI only.

*All paths below verified on disk 2026-09-09 — every one of them is TypeScript.*

**Theme system:**
- `src/context/ThemeContext.tsx` — reads/writes `localStorage('salown-theme')`, applies `data-theme` to `<html>`
- `src/index.css` — `[data-theme="dark"]` + `[data-theme="light"]` CSS variables
- Key vars: `--bg`, `--surface`, `--surface2`, `--card`, `--card2`, `--border`, `--text`, `--muted`, `--input-bg`

**Shared components:**
- `src/components/Drawer.tsx` — right-side slide-in panel (540px forms, 400px tools)
- `src/components/Toast.tsx` — success/error/info, auto-dismiss 3.2s, top-center
- `src/components/AddClientModal.tsx` — always use this, never inline add-client forms

**Pages (salown-app/src/pages/):**
- `Dashboard.tsx` — 15-min slot grid, FAB with Walk-in/Booking/Block Time/Product Sale
- `Settings.tsx` — 6-tab layout (General, Opening Hours, Integrations, Notifications, Staff, Danger Zone).
  Opening Hours writes the salon's own hours ONLY — it has written no barber document since R2c.
- `Finance.tsx` — Whitecross-only (NOT multi-tenant). Never mix Finance logic into Reports.
- `Reports.tsx` — platform-wide, multi-tenant. Never hardcode tenant-specific names here.
- `Login.tsx` — uses `window.location.replace('/app')` (not href) to avoid back-button

**Key logic files:**
- `src/firestoreActions.ts` — `setActiveTenant(tenantId)` must be called before any action
- `src/PanelLayout.tsx` — loads tenant config, popstate guard
- `src/pages/AppRouter.tsx` — lazy loads all pages, checks onboarding status
- `src/utils/timeUtils.ts` — `toDateKey()` for UK dates (never use `.toISOString().split('T')[0]`)
- `src/utils/conflictUtils.ts` — `hasTimeConflict()`, `getExistingRangeMinutes()`

## Staff rota — who may write it (FIN-DATED-ROTA, R2/R2b/R2c · **LIVE**)

> **Status corrected 2026-09-09.** This section used to be headed `PUSHED_NOT_LIVE`. It is deployed:
> `salownRotaTransaction` runs in production (`-00003-gov`, release `R-2026-08-20-A`) and the `[R2b]` and
> `[R2c]` rules bodies are in the live ruleset `a0a10819-…` (read-only verification 2026-09-09).
> **`FIN-DATED-ROTA-R2d` — the activator — is still `PLANNED`**, so everything below about future-dated
> rotas and `ROTA_END` being refused remains exactly true in production.

A staff rota is a **HISTORY**, not a setting. `barbers/{id}.workingDays` / `.dayHours` / `.hours`
are the **published projection** of an append-only dated log, and after R2c they have exactly one
writer.

```
tenants/{tid}/staffRota/{barberId}                   header  — revision, entriesHash, cacheState
tenants/{tid}/staffRota/{barberId}/rotaEntries/{id}  the LOG — append-only, client-unwritable
tenants/{tid}/rotaPolicy/rollout                     the rollout DECLARATION — server-owned
```

**The engine** — `functions/src/staff/rotaWriter.ts`. Four actions, one Firestore transaction each,
optimistic concurrency on `(revision, entriesHash)`. Every rule in it is a CALL into the accepted
fold (`utils/rotaFold.ts`), never a second opinion. It is the ONLY writer of the three cache fields.

**The three server doors, and nothing else:**

| Callable | Who | What |
|---|---|---|
| `salownRotaTransaction` | owner \| admin \| super-admin | change one person's rota |
| `salownProvisionTeamMember` | owner \| admin \| super-admin | bring a member into existence — profile + first `ROTA_START` in ONE transaction |
| `salownRotaBootstrapTenant` | **super-admin only** | the guarded legacy → canonical tenant cutover; `dryRun` defaults TRUE |

`convergeRotaCache` exists, is proven, and is reached by **nothing** — the activator is
`FIN-DATED-ROTA-R2d`.

**⛔ FUTURE-DATED ROTAS AND `ROTA_END` ARE DISABLED (`R2c-EV.1` / `R2c-EV.2`).** Because nothing runs on an effective date, a
future-dated `ROTA_START` / `ROTA_CHANGE` / `ROTA_END` would record an intention the product cannot
carry out — the log advances, nothing publishes today (correctly), and nothing publishes on the
chosen day either. Every production boundary therefore refuses one with `FUTURE_ACTIVATION_NOT_READY`.

* the capability is `RotaWriterDeps.futureActivationEnabled`, a DEPLOYMENT fact defaulting to the
  fail-closed `false`, exactly like `passiveAuthorityLive`. It is a **dep, never an input** — absent
  from `RotaWriteInput` and from both request allowlists;
* the ENGINE enforces it, against the TENANT's calendar day resolved inside its own transaction.
  Never the browser, the device or the runtime's UTC day;
* `salownProvisionTeamMember` additionally PRE-checks, before Firebase Auth — the one side effect no
  transaction can roll back;
* **`ROTA_SUPERSEDE` is deliberately NOT gated.** It withdraws, carries no effective date and creates
  no effective state; gating it would strand an already-recorded future change in the one state with
  no way out;
* both admin UIs remove the date picker rather than offering it with a caveat. Their constants are
  **affordances**; the server is the authority, and a test pins them to it;
* **`ROTA_END` is refused at ANY date** (`R2c-EV.2`), not merely a future one: an end dated today is
  correct today and wrong from tomorrow, and tomorrow is what an end is for. A **backdated** end
  keeps its sharper `BACKDATED` refusal. Ending a rota is therefore unavailable in production until
  R2d — no capability is lost today, because neither admin UI composes one and a departure is
  `status: 'passive'`, a different contract.

Turning it on is `FIN-DATED-ROTA-R2d`, and the flag may only be flipped together with the activator
that makes it true. It lives in `functions/src/staff/rotaActivation.ts`.

**The rollout boundary is TWO conditions.** A direct client write to a cache field is permitted only
when the tenant is not `canonical` **AND** the subject has no `staffRota` header. The per-subject
half is not a flag — it becomes true when the engine commits that person's first transaction — which
is what makes "a canonical barber cannot fall back to a direct cache write" a property rather than a
policy. Absence of the rollout document resolves to LEGACY (the fail-safe direction).

**Browser surfaces compose, they do not write.** `src/utils/rotaIntent.ts` is the app's ONLY importer
of the fold; every page reaches it through that module. The whitecross `barber-panel` holds no copy
of the fold at all — it reads the header and lets the server decide.

**Salon opening hours no longer touch any rota** (owner decision 2026-08-17). `barberHoursPropagation.ts`
is deleted on both panels. Staff working days and shift times are managed in Team Members only.

Full record: [`FIN_DATED_ROTA_R2C_DESIGN.md`](FIN_DATED_ROTA_R2C_DESIGN.md).

## Loyalty System (per-tenant)

- Settings: `loyalty.enabled`, `loyalty.earnRate` (pts/£1, default 1), `loyalty.cashbackPct` (%, default 5)
- `src/components/CheckoutPanel.tsx` derives `LOYALTY_REDEEM_RATE = 100 / cashbackPct` (default 20 = 5% back)
- `src/firestoreActions.ts` reads on checkout — default = legacy whitecross behavior

## Security Rules

- Firestore `get`/`list`/`update`: auth-only
- `create`: public but blocks financial fields (`paidAmount`, `paymentState != PENDING`)
- Cancel/reschedule: fully server-side callables — no unauthenticated Firestore writes
- GDPR round: COMPLETE + DEPLOYED 2026-06-12

## DO NOT

- Do NOT hardcode colors — use CSS variables
- Do NOT hardcode tenant IDs — read from Firebase Auth custom claims
- Do NOT modify Firestore rules without checking public booking create + callables
- Do NOT add inline add-client forms — always use `AddClientModal`
- Do NOT push `serviceAccountKey.json` to GitHub (exposed once, revoked)
- Do NOT bulk-delete Firestore data. Full export first → dry-run CSV → write.
- Do NOT write `barbers/{id}.workingDays`, `.dayHours` or `.hours` from any client, or from any
  server path other than the R2 engine. They are the published projection of a dated log; an undated
  weekly array re-prices every closed month (INCIDENTS 2026-08-12). Use the callables above.
- Do NOT copy `src/utils/rotaFold.ts` into another repo. The whitecross `barber-panel` deliberately
  has no copy: one calculation, one implementation, and the server answers the rest.
- Do NOT make salon opening hours write a staff rota again. That was withdrawn deliberately — a
  salon being open and a stylist being rostered are different facts.
