# SYSTEM_ARCHITECTURE.md

## Repo Map

```
~/Desktop/alex/
├── salown-panel/       ← Barber/admin React panel (CRA, legacy — phased out)
├── salown-site/        ← DELETED 2026-06-29 (everything deploys from salown-app/hosting/)
├── salown-app/         ← MAIN ACTIVE REPO — Vite + .jsx, all new work goes here
├── super-admin/        ← SaaS super-admin panel (Vite)
├── eekurtbarbers/      ← EeKurt legacy site (tenant INACTIVE 2026-07-18 — folder remains)
└── whitecross-site/    ← Being phased out incrementally
```

## Firebase

- Project: `havuz-44f70`, region `europe-west2`
- Storage bucket: `havuz-44f70.firebasestorage.app`
- All tenant data lives under `tenants/{tenantId}/...`
- Admin panel hosting target: `whitecross-admin` → `admin.whitecrossbarbers.com`

### Deploy ownership — which repo owns which Firebase product

`FIRESTORE-RULES-SSOT-P0`, 2026-08-16. Several repos hold a `firebase.json`; **owning a config is
not owning a product.** Only the config listed here may deploy the product beside it.

| Product | Sole authority | Config → target | Enforced by |
|---|---|---|---|
| **Firestore rules** | **`salown-app/`** | `firebase.json` → `firestore.rules` | `salown-app/ops/rules-authority.test.js`; every other `firebase.json` has **no** `firestore` block, so a rules deploy there fails at config parse |
| **Firestore indexes** | **`salown-app/`** | `firebase.json` → `firestore.indexes.json` | same test. ⚠️ Do not deploy indexes at all yet — ROADMAP `TEC-6` |
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

- **salown-app**: Vite + React (.jsx), Firebase Auth + Firestore + Functions
- **salown-panel**: CRA (.js) — legacy, being phased out (see ROADMAP.md)
- **salown-site**: DELETED (2026-06-29) — deploy is now ONLY from `salown-app/hosting/`
- **whitecross-site**: Legacy, some functions still active (see MULTI_TENANT_NOTES.md)

## Migration Decision: salown-panel → salown-app

All pages are being moved step by step from salown-panel (CRA, .js) → salown-app (Vite, .jsx).
Hardcoded `whitecross` references → dynamic `tenantId` (Firebase custom claims).

Migration order: ~~Dashboard~~ ✅ → Bookings → Calendar → Finance → Reports → Clients → others

**Don't add new features to salown-panel — for a page that will be migrated, write the .jsx first.**

> ⚠️ **`~/Desktop/alex/salown-panel/` is NOT A GIT REPOSITORY**, is in no claim registry, and its
> `firebase.json` deploys to hosting target `salown-admin`. It holds a byte-identical copy of the
> whitecross `barber-panel` Team Members page — so it writes the three rota cache fields directly and
> still carries the 2026-08-10 lost-update propagation fan-out — and it has a populated `build/`.
> **Whether `salown-admin` is live is `STATUS_UNKNOWN`.** ROADMAP `SALOWN-PANEL-1`; decide before
> any Firestore rules deploy, because if it IS live it is on the blast radius.

## salown-app — Key Files

**Brand:** Purple `#534AB7` / `#7B72E8`, Inter font. Gold `#d4af37` checkout/loyalty UI only.

**Theme system:**
- `src/context/ThemeContext.jsx` — reads/writes `localStorage('salown-theme')`, applies `data-theme` to `<html>`
- `src/index.css` — `[data-theme="dark"]` + `[data-theme="light"]` CSS variables
- Key vars: `--bg`, `--surface`, `--surface2`, `--card`, `--card2`, `--border`, `--text`, `--muted`, `--input-bg`

**Shared components:**
- `Drawer.jsx` — right-side slide-in panel (540px forms, 400px tools)
- `Toast.jsx` — success/error/info, auto-dismiss 3.2s, top-center
- `AddClientModal.jsx` — always use this, never inline add-client forms

**Pages (salown-app/src/pages/):**
- `Dashboard.jsx` — 15-min slot grid, FAB with Walk-in/Booking/Block Time/Product Sale
- `Settings.jsx` — 6-tab layout (General, Opening Hours, Integrations, Notifications, Staff, Danger Zone).
  Opening Hours writes the salon's own hours ONLY — it has written no barber document since R2c.
- `Finance.jsx` — Whitecross-only (NOT multi-tenant). Never mix Finance logic into Reports.
- `Reports.jsx` — platform-wide, multi-tenant. Never hardcode tenant-specific names here.
- `Login.jsx` — uses `window.location.replace('/app')` (not href) to avoid back-button

**Key logic files:**
- `firestoreActions.js` — `setActiveTenant(tenantId)` must be called before any action
- `PanelLayout.jsx` — loads tenant config, popstate guard
- `AppRouter.jsx` — lazy loads all pages, checks onboarding status
- `src/utils/timeUtils.js` — `toDateKey()` for UK dates (never use `.toISOString().split('T')[0]`)
- `conflictUtils.js` — `hasTimeConflict()`, `getExistingRangeMinutes()`

## Staff rota — who may write it (FIN-DATED-ROTA, R2/R2b/R2c · `PUSHED_NOT_LIVE`)

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
- `CheckoutPanel.jsx` derives `LOYALTY_REDEEM_RATE = 100 / cashbackPct` (default 20 = 5% back)
- `firestoreActions.js` reads on checkout — default = legacy whitecross behavior

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
