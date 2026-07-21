# KNOWN_QUIRKS.md — weird but intentional, don't touch

> **What this file is:** behaviors that look counterintuitive but are **intentional / accepted**. Purpose: so a new session (or human) doesn't mistake them for a "bug", try to "fix" them, and break something.
>
> **INVARIANTS vs QUIRKS vs latent bug — know the difference:**
> - [INVARIANTS.md](INVARIANTS.md) = a rule that must not break ("always DO it this way").
> - **KNOWN_QUIRKS (this file)** = weird but correct, deliberately this way ("don't be surprised, DON'T TOUCH").
> - [NORMALIZATION.md](NORMALIZATION.md) → "Known Inconsistencies" = actual **latent bug**, must be fixed (NOT a quirk).
>
> **If you think you've found a new "bug":** first search here and in [INCIDENTS.md](INCIDENTS.md). If it's written here it's intentional — ask before fixing.

**Columns:** Behavior · Why it's this way (intentional) · What happens if you touch it · Source.

---

## Table of Contents
1. [Data Model](#1-data-model)
2. [Parser & Aggregator](#2-parser--aggregator)
3. [Security & Public Pages](#3-security--public-pages)
4. [UI & Grid](#4-ui--grid)
5. [Deploy & Infrastructure](#5-deploy--infrastructure)
6. [Temporary Quirks (will be fixed after a phase)](#6-temporary-quirks-will-be-fixed-after-a-phase)

---

## 1. Data Model

| Behavior | Why it's this way (intentional) | If you touch it | Source |
|----------|----------------------|-----------|--------|
| A walk-in booking has **NO** `date` field, only `startTime` (Timestamp) | `createWalkIn` writes it this way; a walk-in is instantaneous | A date-based query **misses** walk-ins → query with a `startTime` range | CLAUDE §Booking |
| `barberId` is inconsistent: walk-in = lowercase barber **name**; online = barber **doc id** + `barberName` | Two different write paths, historical | If you match on a single form half of them drop → match **both** | CLAUDE §Booking |
| `endTime` shape varies: Dashboard = label **string**; Bookings.jsx/Clients.jsx = raw **Timestamp** | Different screens produced it differently | `conflictUtils.getExistingRangeMinutes` handles both — don't write your own parse | CLAUDE §Booking |
| `bookingId` = `WCB-…` / `SALE-…` / `BLOCKED-…` — **NOT** a Firestore doc id | Business-meaningful id and doc id are separate | If you assume it's the doc id and read with `doc(id)` it won't be found | CLAUDE §Booking |
| `price` field is sometimes a currency-symbol string (`"£20.00"`) — import residue | Legacy from Booksy/Fresha/Treatwell imports | Raw `Number()` → `NaN` → use `pp()` (INV-PARA-1) | INC 2026-06-22 |
| Finance **derives** its `dateKey` from `startTime`, not from a stored field | So the booking shows even if the parser didn't write dateKey | Don't add it thinking "dateKey is missing"; the derivation is intentional | INC 2026-06-26 |
| `reset service` = delete all services + refresh → **auto-seed 21 hardcoded services** from `config.js` | Fast pilot reset | Don't panic "the services were deleted/came back"; that's by design | [reset services](FEATURE_FLAGS.md) |

## 2. Parser & Aggregator

| Behavior | Why it's this way (intentional) | If you touch it | Source |
|----------|----------------------|-----------|--------|
| A Treatwell booking can be **per-booking** prepaid OR pay-at-venue (not a global setting) — `twPaymentMode` comes from the email `Status` | In the real world the two are mixed | If you show a single global `paymentType` it's wrong (double-charge risk) → "Both" mode | INC 2026-06-26 |
| The aggregator barber name format **may not** be the same as the tenant's (Treatwell full name, system first name) | Platforms send the full name | Don't add fuzzy to the matcher → map to the canonical name in the parser | INC 2026-06-26 |
| `checkDuplicateInFirestore` (whitecross-site) **fails open** under locked rules | Not dropping a booking > perfect dedup | Don't break it over "why does it always return true"; acceptable, the booking continues | INCIDENTS §Notes |
| Whitecross Stripe is still in `whitecross-site/functions` (**us-central1**), not in salown-app | The migration isn't at Phase 5 yet | When adding Stripe to salown-app don't mix in the whitecross flow | CLAUDE §Related repos |

## 3. Security & Public Pages

| Behavior | Why it's this way (intentional) | If you touch it | Source |
|----------|----------------------|-----------|--------|
| The `tenants/{id}` root doc is **world-readable** (public) | The public booking page must read tenant meta | Don't put secrets here (INV-SEC-3); don't say "let me close public read", the booking page breaks | [MULTI_TENANT_NOTES.md](MULTI_TENANT_NOTES.md) |
| `success.html` reads the booking from **`sessionStorage.pendingBooking`** (not from Firestore) | Booking read is auth-only (GDPR); a public query 403s | Don't change it over "why doesn't it read from Firestore" → returns a 403 blank screen. A bare `?id=` URL doesn't work in a new tab (normal) | INC 2026-06-26 |
| Booking read returns 403 (when not logged in) | GDPR — booking PII is auth-gated | This is not a bug; do NOT open public read | INC 2026-06-26 |
| `salownGetBusySlots` + `salownRescheduleByToken` **skip** expired PENDING (`expiresAt < now`) bookings | So an abandoned Stripe session doesn't ghost-block a slot for 0–20 min | Don't remove the skip → abandoned payments lock slots | INCIDENTS §Notes |

## 4. UI & Grid

| Behavior | Why it's this way (intentional) | If you touch it | Source |
|----------|----------------------|-----------|--------|
| Booking card: **background = source color**, left edge (3px) = **barber color** | Deliberate redesign 2026-06-14; `sourceColors.js` is the single source | Don't change it over "the colors are mixed up"; the dual coding is intentional | [source badges](FEATURE_FLAGS.md) |
| A checked-out card **only shortens** with `min(scheduled, actual)`, never grows | So a late checkout doesn't inflate the card (cascade) | If you remove the cap, INC 2026-06-27 comes back (🔴 Regressed) | INC 2026-06-27 |
| `actualDuration` = booking start ↔ **the moment checkout is pressed** (not the real service duration, clamp 5..240 min) | A "finished early, free the slot" signal for squeeze-in | Don't assume it's the service duration and use it raw in capacity/conflict → cap it (INV-BK-5) | INC 2026-06-27 |

## 5. Deploy & Infrastructure

| Behavior | Why it's this way (intentional) | If you touch it | Source |
|----------|----------------------|-----------|--------|
| `hosting/public-bundle/` and `staff-bundle/` are **gitignored** (build output) | The artifact isn't committed; the predeploy hook produces it | Manual editing is wasted; a raw `firebase deploy` (skipping build) deletes the bundle | INC 2026-06-29 |
| `FORCE_SALOWN_SENDER_TENANTS=['whitecross']` → whitecross email goes from Brevo `noreply@salown.com` | Multi-tenant email consolidation | If you remove it from this list, whitecross's email sender changes | INC 2026-06-26 · [EMAIL_ARCHITECTURE.md](EMAIL_ARCHITECTURE.md) |
| barber-panel / barber-mobile = **LEGACY**; FCM disabled 2026-06-19. Live staff = `staff.salown.com` (salOWN Staff App) | Moved to salown-app | Don't add features to the old panels; do it in salown-app | CLAUDE §Notification · [whitecross tenant](MULTI_TENANT_NOTES.md) |
| The `alex/` root is **not** a git repo; `docs/` is a separate `salown-docs` (private) repo; the apps are separate repos | Deliberate multi-repo structure | Don't `git init` the root (nested repo mess) | [DECISIONS.md](DECISIONS.md) 2026-07-02 |

## 6. Temporary Quirks (will be fixed after a phase)

> These are intentional but **not permanent** — they'll be fixed when the relevant phase arrives. Until then "leave it as is".

| Behavior | When it will be fixed | Source |
|----------|-------------------|--------|
| `salownNotifyBookingCreated` sends Telegram for PENDING bookings too | When Phase 5 (Stripe active) arrives | CLAUDE §Notification |
| Deposit flow INCOMPLETE: no webhook, no `expiresAt` → do NOT enable `features.stripe` / `websiteDepositsEnabled` | Phase 5 | CLAUDE §Deposit · [BUSINESS_RULES](BUSINESS_RULES.md) |
| Finance/Reports card/cash tip split still uses the service `paymentMethod` (the staff app was fixed) | Migration to the `tipPaymentMethod` helper (awaiting whitecross approval) | INC 2026-06-28 |
| app-password is stored as plain text in Settings (leak closed but storage is plain) | Move to Secret Manager (T-b) | [security sprint](SECURITY.md) |

---

## Maintenance
- Every time a behavior is understood to be "weird but intentional" (especially when a session mistakes it for a "bug" and asks), add it here.
- If a quirk **actually** turns into a bug that must be fixed → move it to [NORMALIZATION.md](NORMALIZATION.md) "Known Inconsistencies" or a ROADMAP item, and remove it from here.
- When a temporary quirk is fixed (Section 6), delete the row + update the relevant incident/decision record.
- Commit: `cd alex/docs && git commit KNOWN_QUIRKS.md && git push`.
