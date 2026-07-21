# ARCHITECTURE REVIEW — 2026-07-02

> Outside-eye architecture assessment. **Union of two sources:**
> - **GPT (SaaS pattern lens):** architectural shape, maturity diagnosis, mid-term debt suggestions.
> - **Claude (repo lens):** verifying GPT's claims against the real code + re-prioritizing.
>
> **Why both together:** GPT reasons from SaaS patterns (does not see the files); Claude
> reads `firestore.rules` / `functions/index.js` / `Reports.jsx`. Where they diverge, **code wins** —
> this document records *where* the difference is.
>
> This is not a source of state → actionable items live in [ROADMAP.md](ROADMAP.md). This file is *diagnosis*.

---

## 🟢 Strengths (GPT — confirmed by Claude)

| # | Finding | Claude note (from code) |
|---|-------|----------------------|
| 1 | **Multi-tenant foundation is correct** — `tenants/{tenantId}/...` | Not just path, but **claim-based**: `tenantId` in Firebase custom claim (`AuthContext.jsx`, `firestore.rules:18`). Being in the JWT rather than app-state also saves the migration. The hardest work was solved up front. |
| 2 | **Booking model is from the real world** — walk-in quirks, `barberId` inconsistency, DST, status normalize, parser tombstones | Confirmed. These are the trail of "a real user broke the system → it was fixed" = maturity. Documented in `FIRESTORE_SCHEMA.md`. |
| 3 | **Notifications across 3 channels** — Email · Push · Telegram | Confirmed: FCM is real in the staff app (`StaffApp.jsx`, `fcmTokens/`), Telegram in `settings/integrations`. A layer that is hard to add later. |
| 4 | **Public booking security is correct** — server-side | Confirmed: `salownCancelByToken` / `salownRescheduleByToken` onCall (`index.js:1315,1384`), token-based email link, no unauthenticated Firestore write. |
| 5 | **IMAP parser** (Booksy/Fresha/Treatwell in one screen) = differentiator | Confirmed **but with a warning** → see 🔴-2 below (strength and fragility in the same place). |
| 6 | **Ask salOWN** — booking+finance+marketing+clients+loyalty in a single DB → AI is efficient | Confirmed: `askAI` onCall, **Anthropic Claude Haiku 4.5** (`index.js:3362`, secret `ANTHROPIC_API_KEY`). Single AI touch point. |

---

## 🟡 Mid-term debts (GPT — Claude confirms + nuance)

1. **`functions/index.js` 4541 lines → split it.** GPT suggestion: `bookings/ marketing/ notifications/ parsers/ stripe/ ai/ staff/ clients/`.
   **Claude nuance:** because these are v2 functions the refactor is **low-risk/mechanical** (each export redeploys independently). Not a debt to fear — the **first to pay off**, because it's cheap and immediately opens up readability.
2. **`settings/emailConfig` app-password in plaintext → Secret Manager.** Already tracked as `T-b`. Gains importance at scale.
3. **Single Firebase project** (`havuz-44f70`). Not a problem now; later a `dev/staging/prod` split may be wanted.
4. **Canonical booking model debt** (`barberId` id-vs-name, `endTime` string-vs-Timestamp, no `date` on walk-in). Good that it's known; a trap in every new query.

---

## 🔴 Re-prioritization — where GPT and Claude DIVERGE

> This section is the document's real value: what looks big from the outside ≠ what burns on the inside.

### GPT's 🔴: "Finance hardcoded to Whitecross = biggest technical risk"
**Claude: not 🔴, it's 🟡.** Finance is isolated — single file (`Finance.jsx` 1905), single tenant, no data-integrity threat. "The second salon wants finance" → **feature-rebuild**, not a disaster. Contained. From the outside the line count looks big; inside it's limited.

### Claude's real 🔴's (GPT couldn't see them because it didn't read the rules/code):

- **🔴-1 · The `allow read: if true` surface + world-readable tenant root.**
  So that public booking sites can read them, most collections are world-readable (`firestore.rules`), and the `tenants/{id}` root doc is open to the world. Invisible at 10 salons; **at 1000 salons a PII enumerate + Firestore read-cost bomb**. And once 1000 tenants rely on this behavior it's hard to roll back → **systemic, hard to undo.** (`prescale_hardening` Tier 1.)

- **🔴-2 · Parser fragility is in the *same place* as the differentiator.**
  Not an API integration — a cron that reads the salon's Gmail via IMAP+regex (`salownParseEmails`). If Booksy/Fresha change their email format the parser breaks **silently** (not an exception, just 0 imports). The strongest feature has the quietest failure mode.
  → **The 20 highest-ROI lines:** a "fewer imports than expected → alarm" canary.

### Timing correction: "10 salons no problem" — one exception
**`delete = super-admin only`** (only `aerulas@`, in `firestore.rules` `allow delete: if isSuperAdmin()` across all collections). The security instinct is right but this becomes an operational bottleneck **not at 1000 but at ~the 3rd salon**: every wrong-booking deletion request lands on a single person. Bus-factor + operational risk combine here.

---

## 📈 Scale reading (GPT table + Claude addition)

| Scale | GPT | Claude addition |
|-------|-----|-----------------|
| **10 salons** | No problem | ⚠️ Exception: the delete-bottleneck hits at ~the 3rd salon (above). |
| **100 salons** | Some optimization | **Flag reporting:** `Reports.jsx` is client-side aggregation (Firestore→JS `reduce`). Without waiting for 1000, it crashes in the browser at ~100 → move to a cloud function / pre-aggregated `stats/` doc. |
| **1000 salons** | parser scheduling · Firestore cost · index · cold start · reporting aggregation | Confirmed + 🔴-1 (read:true cost) blows up here. |

---

## ✅ Cheapest first moves (priority order)

1. **Parser canary** — fewer imports than expected → alarm. (~20 lines, highest ROI, protects the differentiator.)
2. **`functions/index.js` split** — mechanical, low risk, opens up readability.
3. **Reporting pre-aggregation plan** — design the `stats/` doc before 100 salons arrive.
4. **🔴-1 read:true narrowing** — Pre-Scale Hardening Gate Tier 1 (before tenant #4).

---

## 🧭 Division of labor (the meta-lesson this review produced)

- **GPT** → SaaS direction / patterns / "what to build".
- **Founder (Alex)** → reads the architecture, makes the decision.
- **Claude** → verifies against the repo + writes + designs.
- **Rule:** ask GPT for direction, have Claude verify "is it really so in this code". If they diverge, **code wins.**
