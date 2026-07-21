# AGGREGATOR_WRITEBACK_PLAN.md — Two-Way Block / Write-Out (multi-platform)

> **Status (2026-07-15):** DESIGN — no code, awaiting validation.
> **Owner:** Alfa (Whitecross owner + dev)
> **Goal:** When a block/booking is created in salOWN, automatically close the same slot in the
> salon's **Fresha and Booksy** calendar too (outbound blocking) — via **one-tap easy**
> integration for the user.
>
> **🎯 End state (north star):** For each platform the target = **Treatwell model** —
> the salon gives the platform salOWN's **iCal feed** (`salownIcalFeed`), the platform pulls
> busyness in from the external calendar, the slot closes automatically. The feed **already exists and works** (live on
> Treatwell). Problem: Fresha/Booksy currently do **not** import busyness from an external calendar → the official bridge
> is dead on them. **Fresha will soon open two-way (like Treatwell); the moment it does, all we do
> is share the feed.** Until that day we fill the gap with **headless automation** (Playwright)
> by writing a block on the salon's behalf. Booksy is on the same bridge — when it opens it too moves to the feed.
>
> So headless = **temporary scaffolding**; the permanent building = the Treatwell
> model where everyone subscribes to the iCal feed. The architecture moves a platform from headless to iCal via a **one-line adapter-swap**.
> **Relation:** [BUSY_SLOT_V2.md](BUSY_SLOT_V2.md) (channel architecture, iCal OUT=`salownIcalFeed`),
> [DECISIONS.md](DECISIONS.md) (isolation), Quick Block (`QuickBlockSheet.jsx`).

---

## 1. Problem — asymmetry

| Direction | Meaning | Today |
|---|---|---|
| **INBOUND** (platform → salOWN) | A booking on the platform fills a salOWN slot | ✅ Exists — email-parse pipeline (Fresha proven end-to-end 2026-07-14/15; Booksy/Treatwell same pipeline) |
| **OUTBOUND** (salOWN → platform) | A salOWN block/booking closes a platform slot | ⚠️ Partial — **Treatwell ✅** (iCal feed), **Fresha/Booksy ❌** (subject of this doc) |

Inbound already works. The unsolved half = **outbound blocking to Fresha/Booksy**. The official
routes are (for now) closed on these two platforms:
- **iCal / Calendar-subscribe (Treatwell's working route):** Fresha/Booksy do **not yet** import
  busyness from an external calendar → we can't give them the feed. **Fresha will open soon → that moment
  this line becomes ✅ for Fresha too, and headless retires.**
- **Public API:** Fresha/Booksy don't provide an outward-facing write API (partner-closed).

→ Until it opens, the only route: **write a block into the platform panel with a headless browser, on the salon's
behalf, with the salon's permission.** This is automation of the salon's **own account** (authorized, owner-approved) —
not unauthorized access to third-party data.

---

## 2. Scope

**WILL DO:**
- salOWN block/booking create/delete → create/remove a matching block in the platform calendar.
- **Fresha + Booksy** (both the same adapter interface, separate implementation). **Outbound** only.
  **Block/busyness** only (we carry no customer PII — we write an empty block labeled "salOWN-{id}" to the platform,
  not the customer name/phone).
- Phase order: Fresha first (validation + MVP), Booksy right after with the **same scaffolding** (new
  adapter + selector map, the rest shared).

**WILL NOT DO:**
- Inbound reading (email-parse already does it; don't repeat).
- **Creating** a customer booking on the platform (only a busyness block — less fragile,
  less PII, single purpose: prevent double-booking).

---

## 3. Core insight — **Pluggable PlatformAdapter**

The most critical design decision: **separate the automation engine from the business logic.** A single interface:

```ts
interface PlatformAdapter {
  connect(cred: Credential): Promise<Session>          // login / validate session
  createBlock(s: Session, b: BlockSpec): Promise<ExternalRef>
  removeBlock(s: Session, ref: ExternalRef): Promise<void>
  healthCheck(s: Session): Promise<HealthStatus>       // is the login + block flow still working
}
```

Each platform has **3 possible states**, all implementations of the same interface:

| State | Adapter | When |
|---|---|---|
| **Closed** (no external calendar import) | `*PlaywrightAdapter` (headless) | Today Fresha + Booksy |
| **Open — iCal** (like Treatwell) | `IcalAdapter` — just give the feed URL to the platform | **Fresha soon** + Booksy once it opens; on Treatwell **today ✅** |
| **Open — API** (full partner API) | `*ApiAdapter` | If it exists (bonus) |

`IcalAdapter` is **already solved** — the feed (`salownIcalFeed`) is live, Treatwell subscribes to it. When a
platform opens two-way, the only thing we do: turn that tenant-platform pair from
`PlaywrightAdapter` to `IcalAdapter` (config flip) + an "now paste this feed URL into Fresha"
onboarding for the owner. **The queue, data model, UI scaffolding, reconcile NEVER
change.** This way the fact that "Fresha will open soon" does **not throw away** today's headless work —
the dirty half retires, the permanent scaffolding (Treatwell model) stays.

---

## 4. Architecture

### 4.1 Where the automation runs
**NOT in Firebase Functions.** Playwright + Chromium binary (~300MB), cold-start,
540s timeout, headful-fallback need don't fit in Functions. A separate worker:

- **Cloud Run (job or min-instance service)** — the Playwright container. It consumes the task queue
  in Firestore. In the `havuz-44f70` project, `europe-west2`.
- Trigger: a Firestore trigger writes a task → the Cloud Run worker pulls it via Pub/Sub or Firestore-listen.
  (Pub/Sub push = instant; poll = simple. Poll is enough for the MVP.)

### 4.2 Data model (Firestore)

```
tenants/{tid}/integrations/fresha
  status: 'connected'|'needs_reauth'|'error'|'disconnected'
  sessionSecretRef: 'projects/…/secrets/fresha-session-{tid}/versions/latest'  // Secret Manager
  lastHealthCheckAt, lastError, connectedAt

tenants/{tid}/syncTasks/{taskId}
  platform: 'fresha'
  action: 'block'|'unblock'
  start, end, barberRef            // BlockSpec — NO PII
  sourceBlockId                    // salOWN block/booking doc id (idempotency)
  externalRef                      // block id in Fresha (for unblock)
  status: 'PENDING'|'RUNNING'|'DONE'|'FAILED'|'DEAD'
  attempts, nextAttemptAt, error
```

### 4.3 Flow
```
salOWN block/booking create ─┐
salOWN block/booking cancel ─┤→ Firestore trigger → syncTasks/{id} PENDING
                            │      (self-managed tenant guard + features.freshaSync flag)
Cloud Run worker ──poll──> PENDING task
   → load session (storageState) from Secret Manager
   → FreshaPlaywrightAdapter.createBlock/removeBlock
   → DONE + externalRef  |  FAILED (retry)  |  needs_reauth (banner to owner)
```

### 4.4 Credential vault (the most sensitive part)
- Keep the salon Fresha login in **Secret Manager** — **never Firestore plain text**
  (see the T-b app-password lesson). Preferably store a **session**, not a password:
- Capture **Playwright `storageState`** (cookie + localStorage) on the first login → encrypt →
  Secret Manager. Subsequent jobs load the session **without re-login** → 2FA friction
  and bot-detection are minimized. Re-auth only when the session dies.
- Never storing the password is ideal (session is enough); if stored, only Secret Manager +
  only the worker SA can access it.

---

## 5. User integration — "one-tap easy" (owner's explicit priority)

Settings → Integrations → **"Connect Fresha"** wizard:

1. **Assisted login (once):** The owner enters their Fresha email+password **or** more securely:
   the worker opens a temporary session, the owner completes 2FA/OTP one time. On success
   `storageState` is captured → "Connected ✓".
2. **Validation:** the worker creates+deletes a test block (health check) → green badge.
3. **After that fully silent:** the owner does nothing; blocks sync in the background.
4. **When the session dies:** a **"Reconnect Fresha"** banner in the panel + push/email; the owner passes 2FA
   again with one tap. NO silent failure.

Friction goal: first setup < 60 sec, zero touch afterward.

---

## 6. Durability / anti-fragility (manage headless's fragility)

Headless's real risk = silently breaking when the platform UI changes. Countermeasures:

- **Central selector map:** each platform's selectors in a single file
  (`fresha.selectors.ts`, `booksy.selectors.ts`); prefer text/role-based + data-testid.
  On a UI change = single-file fix, platform-isolated.
- **Health canary (scheduled):** every day the worker runs the login + test-block-create-delete flow;
  if it breaks, alert **US first, not the owner** (Brevo/Telegram) → repaired before the customer notices.
  (The aggregator-write equivalent of the I1 canary pattern.)
- **Idempotency + reconcile:** each salOWN block is tagged in Fresha with a `salOWN-{sourceBlockId}` note
  → re-running doesn't write a double block; a periodic reconcile fixes the "exists in salOWN but
  not in Fresha / vice versa" difference.
- **Retry + dead-letter:** exponential backoff; after N attempts `DEAD` + an "manually block this slot in
  Fresha" fallback notification to the owner (never a silent loss).
- **Human-like pacing + rate limit:** reduce bot-detection; 1 concurrent session per account.
- **Failure UX = honesty:** a slot that can't be synced shows in the panel with a "⚠️ Not reflected to Fresha"
  badge; the owner knows the truth.

---

## 7. Risks (honest) + mitigation

| Risk | Reality | Mitigation |
|---|---|---|
| **ToS / account ban** | Fresha may forbid automation | Owner is automating their own account (authorized); human-pacing; low volume (blocks only); swap immediately when the API arrives |
| **2FA / login challenge** | The most frequent breaking point | Session (`storageState`) reuse → login rare; assisted reconnect flow |
| **UI change** | Selector breaks | Central selector + daily canary + fast fix |
| **Bot detection** | Automation blocked | Pacing, single-session, stable session, real browser fingerprint |
| **Credential liability** | Holding the salon password is a burden | Session instead of password; Secret Manager; only worker SA; transparent owner approval |
| **Fragile ground** | The advantage rests on a hack | Deliberately **temporary scaffolding**; the Treatwell model (iCal feed) is ready via adapter-swap |

**Stance:** This is a **transitional scaffolding**, not the product's permanent backbone. The permanent building =
the Treatwell model where everyone subscribes to the salOWN iCal feed. When the platform opens, we move to that
building via adapter-swap and dismantle the scaffolding — the investment is *preserved*. The "unfair advantage" = the salon stays
in sync from a single center (salOWN) across all platforms; headless fills the gap until that day.

---

## 8. When a platform opens — migration (the real goal)
When a platform (Fresha first, then Booksy) opens external-calendar import:
`*PlaywrightAdapter` → **`IcalAdapter`** (the route Treatwell uses today, which is **ready**).
One onboarding for the owner: "Paste this feed URL into your Fresha settings." After that, blocking happens
via the platform's **own** iCal-sync → the headless worker **shuts down completely** for that platform
(no more login/session/2FA/canary/selector trouble). Unchanged: the syncTasks queue, data model,
onboarding UI scaffolding, reconcile, failure UX. **This is the guarantee that today's headless work is temporary but
not thrown away** — the permanent building is the Treatwell model, headless is only the scaffolding up to that
building. (If there's a full API, `*ApiAdapter` connects with the same swap too; iCal is usually enough.)

---

## 9. Phases

- **Phase 0 — Validation (no code):** **Manually** record the block create/delete flow on a Fresha test
  account (full click/selector sequence, 2FA behavior, session lifetime). Without this, Phase 1 is a blind flight.
- **Phase 1 — Fresha MVP:** Cloud Run worker + Secret Manager session + assisted login wizard +
  single block create/remove + syncTasks queue + `FreshaPlaywrightAdapter`. Single tenant (whitecross).
- **Phase 2 — Booksy:** same scaffolding + `BooksyPlaywrightAdapter` + Booksy selector map +
  Phase 0's Booksy equivalent. Queue/UI/vault shared.
- **Phase 3 — Hardening:** reconcile job + daily canary + retry/dead-letter + failure UX
  + reconnect banner (both platforms).
- **Phase 4 — Scale:** multi-tenant session pool, concurrency, monitoring dashboard.
- **Phase 5 — Migration (goal):** when a platform opens two-way, `PlaywrightAdapter` → `IcalAdapter`
  (share the feed), headless shuts down on that platform. Fresha probably first.

---

## 10. Open questions (to be answered in Phase 0 — separately for each platform)
1. How many days does the session (storageState) live? (determines re-auth frequency)
2. Is 2FA mandatory at login, or skipped with a "trusted device"?
3. What is the most stable UI route to create a "block/personal time" in the panel?
4. Is there bot-detection (Cloudflare challenge, device fingerprint)?
5. Can a note/label be added to the block (for idempotency `salOWN-{id}`)?
6. **Critical / goal:** Does the platform support "subscribe to an external iCal calendar and pull busyness in,"
   and when will it open it? (As soon as it supports it, switch to `IcalAdapter`, finish headless.)

---

## 11. References
- [BUSY_SLOT_V2.md](BUSY_SLOT_V2.md) — channel architecture, iCal OUT (Treatwell is the already-working bridge)
- [DECISIONS.md](DECISIONS.md) — isolation/security decisions
- [EMAIL_ARCHITECTURE.md](EMAIL_ARCHITECTURE.md) — inbound parse pipeline (complement to this doc)
- Quick Block: `salown-app/src/…/QuickBlockSheet.jsx` — the UI source of the outbound trigger
