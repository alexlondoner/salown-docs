# SYSTEM_ARCHITECTURE.md

## Repo Map

```
~/Desktop/alex/
├── salown-panel/       ← Barber/admin React panel (CRA, legacy — phased out)
├── salown-site/        ← SİLİNDİ 2026-06-29 (her şey salown-app/hosting/'den deploy)
├── salown-app/         ← MAIN ACTIVE REPO — Vite + .jsx, all new work goes here
├── super-admin/        ← SaaS super-admin panel (Vite)
├── eekurtbarbers/      ← EeKurt legacy site (tenant İNAKTİF 2026-07-18 — klasör duruyor)
└── whitecross-site/    ← Being phased out incrementally
```

## Firebase

- Project: `havuz-44f70`, region `europe-west2`
- Storage bucket: `havuz-44f70.firebasestorage.app`
- All tenant data lives under `tenants/{tenantId}/...`
- Admin panel hosting target: `whitecross-admin` → `admin.whitecrossbarbers.com`

## Tech Stack

- **salown-app**: Vite + React (.jsx), Firebase Auth + Firestore + Functions
- **salown-panel**: CRA (.js) — legacy, being phased out (see ROADMAP.md)
- **salown-site**: SİLİNDİ (2026-06-29) — deploy artık YALNIZCA `salown-app/hosting/`
- **whitecross-site**: Legacy, some functions still active (see MULTI_TENANT_NOTES.md)

## Migration Decision: salown-panel → salown-app

Tüm sayfalar adım adım salown-panel (CRA, .js) → salown-app (Vite, .jsx)'e taşınıyor.
Hardcoded `whitecross` referansları → dynamic `tenantId` (Firebase custom claims).

Taşıma sırası: ~~Dashboard~~ ✅ → Bookings → Calendar → Finance → Reports → Clients → diğerleri

**salown-panel'e yeni feature ekleme — taşınacak sayfa için önce .jsx yaz.**

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
