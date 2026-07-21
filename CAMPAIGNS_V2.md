# CAMPAIGNS_V2.md — Audience Scope + Category Library (DESIGN)

> **Status:** 🔵 Approved design, implementation **WAITING until the TS migration is done** (feature-freeze, owner decision 2026-07-10).
> Once the migration is done, all code will be written **on the TSX/TS foundation**. This doc holds the full spec + code anchors so that day requires no discovery from scratch.

## 1. Problem (identified in the 2026-07-10 audit)

Members (who can't accumulate points because they receive a standing discount) keep receiving
client-targeted promo emails. Point earning is CORRECTLY disabled
(checkout writes 0 points to a member) — the leak is at the **campaign layer**:

| # | Problem | Evidence (file:line, 2026-07-10) |
|---|-------|----------------------------------|
| 1 | The campaign recipient filter never looks at `isMember` | `salown-app/src/components/BulkCampaignPanel.tsx:181-205` — email/opt-out/segment/suppression present, no member |
| 2 | The `haspoints` segment = just `points > 0` → members who accumulated points before becoming a member receive the "Redeem points" email (the balance isn't wiped, only earning stops) | `BulkCampaignPanel.tsx:187` |
| 3 | No server-side member guard — `sendCampaignBulk` only re-checks opt-out | `salown-app/functions/index.js:2168-2172` (sendOne) |
| 4 | Per-client drawer shows no member badge/warning | `SendCampaignPanel.tsx` (no isMember reference) |
| 5 | **(Independent latent bug)** `salownSendLoyaltyEmail` member detection is a single, case-sensitive email query — inconsistent with checkout's chain (manualId→phone→email(lc)→alias→norm-phone). A member matched by phone / with a different email case gets a full loyalty-card receipt | `functions/index.js:585` vs `src/firestoreActions.js:55-101` |

Things working correctly (no action needed): checkout points=0 (`CheckoutPanel.jsx:761`,
`firestoreActions.js:125`), receipt email member branch (`functions/index.js:702`,
`emailTemplates.js:332` MemberZone card), double-points hiding in confirmation
(`functions/emails/index.js:159,192`).

## 2. Approved design — Audience Scope

Each campaign gets a single field: **`audienceScope: 'clients' | 'members' | 'everyone'`**.
NOT an embedded "exclude members" rule — members become a separate marketing audience
(a member-only campaign can be sent).

- **UI (Compose ①):** a 3-way pill above the segment pills: 👥 Clients only (default) / ◆ Members only / 🌐 Everyone. How many members were dropped and why is always visible ("182 recipients · 14 members excluded") — the opt-out counter pattern.
- **Filter:** `clients` → drops `isMember`; `members` → only `isMember`; `everyone` → no filter. Data is ready: `audienceUtils.ts:164` already computes `isMember` (currently unused).
- **Server (the real guarantee):** `sendCampaignBulk` takes an `audienceScope` parameter (**default `'clients'`** — even a parameterless legacy call can't send promo to a member, the safest side). The server fetches its own member list (`clients where isMember==true` → lowercase email set) — it doesn't trust the `isMember` flag the client sent. `audience` is written to the `campaignRuns` log → history chip.
- **Template defaults:** each template carries an `audience`. We-miss-you / Redeem-points / Fill-this-week → `clients`; **Birthday → `everyone`** (owner approval 2026-07-10: the celebration goes to everyone, no problem since there are no points in it); member templates → `members`.
- **Per-client drawer:** if the target is a member, a ◆ badge + a warning if the template is clients-only; since a single send is a deliberate choice the server doesn't block it (that's the difference from bulk).
- **Backward compatible:** old `campaignRuns` records with no field → counted as `everyone` (display effect only). No migration.

## 3. Category library (vision, owner 2026-07-10)

The current flat template list is split into categories; in Compose you pick a category first:

| Category | Examples | Default audience |
|---|---|---|
| 🎂 Lifecycle | Birthday, "1 year with us", welcome | Everyone |
| 💤 Win-back | Lapsed 30/60/90 + discount | Clients |
| ⭐ Loyalty | Redeem points, double points, milestone | Clients |
| 📦 Packages & Offers | Big packages, **quiet-day 30-40%**, bundle | Depends on selection |
| ◆ Members | Member appreciation, founding-member perks | Members |
| 📣 Announcements | New staff/service, hours, seasonal | Everyone |

- **Founding clients segment:** those whose `firstVisitMs` falls in the tenant's opening period ("with us from day one") — audienceUtils data exists, a new segment is small work.
- **Quiet-day packages:** Phase 1 manual day/hour selection ("Tue-Wed 30%"); Phase 2 automatic "quietest day" suggestion from occupancy data. Dual purpose: attract external customers + build long-term relationships with members.
- Later, dynamic tenant settings: per-tenant default audience + tier-based sub-audiences (`memberTier: student` vs MemberZone) sit on top of this area.

## 4. Implementation slices (AFTER migration, on TSX)

1. **`BulkCampaignPanel.tsx`** — `AUDIENCES` constant + `audienceScope` state (default `clients`) + pill UI + recipient filter + "N members excluded" counter + template `audience` defaults + `audienceScope` in payload (+ `isMember` in recipients).
2. **`functions/index.js` `sendCampaignBulk`** — `audienceScope` param (whitelist, default `clients`) + server-side member email set + skip in sendOne + `campaignRuns.audience`. (`where('isMember','==',true)` single-field → no index needed.)
3. **`SendCampaignPanel.tsx`** — member badge + clients-only template warning.
4. **Campaign history** — audience chip.
5. ✅ **CLOSED (2026-07-11, `b38d820` PUSHED — exempted from the freeze by owner instruction, via an explicit worktree).** `salownSendLoyaltyEmail` member lookup hardened: if the exact email query misses, `matchesClient` fallback (normalized phone + lowercase email, no name probe); the opt-out check uses the same chain too. Didn't touch the migration (backend JS, not written to the main working tree). ✅ LIVE (2026-07-11 targeted deploy, owner approved). Note: this receipt email is transactional, audience scope covers the campaign layer — that's why it was a separate slice.
6. **Category library + founding-clients segment + quiet-day package templates** — separate slice (with the Phase-2 backend wave: scheduling cron C3.1 + open-tracking C3.3 + C7 metrics).

Note: on 2026-07-10 slice 1 was started and rolled back by owner instruction (working tree clean);
no code was written, only this spec remained. Roadmap record: **C8**.
