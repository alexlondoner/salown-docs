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
- `Settings.jsx` — 6-tab layout (General, Opening Hours, Integrations, Notifications, Staff, Danger Zone)
- `Finance.jsx` — Whitecross-only (NOT multi-tenant). Never mix Finance logic into Reports.
- `Reports.jsx` — platform-wide, multi-tenant. Never hardcode tenant-specific names here.
- `Login.jsx` — uses `window.location.replace('/app')` (not href) to avoid back-button

**Key logic files:**
- `firestoreActions.js` — `setActiveTenant(tenantId)` must be called before any action
- `PanelLayout.jsx` — loads tenant config, popstate guard
- `AppRouter.jsx` — lazy loads all pages, checks onboarding status
- `src/utils/timeUtils.js` — `toDateKey()` for UK dates (never use `.toISOString().split('T')[0]`)
- `conflictUtils.js` — `hasTimeConflict()`, `getExistingRangeMinutes()`

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
