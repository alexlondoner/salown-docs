# ICAL-FEED-AUTH — tokenised per-consumer busy feeds (phase 2)

> **Status: DRAFT — design only.** This document is **not** an approval to code, deploy, change
> IAM, create secrets, add log exclusions or write production data. Every slice in §11 needs its
> own owner approval. Work ID `ICAL-FEED-AUTH` (follows `ICAL-PII-HOTFIX`, INCIDENTS 2026-09-28).
>
> Written 2026-09-29 from a read-only audit of salown-app `9f8c346`, whitecross-site `0e176cce`,
> live Cloud Functions / Cloud Run / Logging configuration and counts-only Firestore reads.
> No URL, token or feed body appears anywhere in this document.

---

## 0. Why

`ICAL-PII-HOTFIX` (`R-2026-09-29-A`, `R-2026-09-29-B`) removed client detail from both public
feeds. It did not add authentication:

| Feed | Access key today | Residual risk |
|---|---|---|
| legacy `icalFeed` (whitecross, us-central1) | a barber's first name | guessable; name-based filter; one URL shared by Treatwell and a personal calendar |
| `salownIcalFeed` (salown, europe-west2) | a tenant id | guessable; whole salon in one feed |
| both | — | UIDs pseudonymized with a public hash (no server secret) |

The incident stays **open** until this phase replaces both.

## 1. Goals / non-goals

**Goals**
1. One feed record per **consumer** — Treatwell and a personal calendar are independent records,
   independently rotated and revoked.
2. Filter by the **stable barber doc id**, never by name matching alone.
3. ≥ 256-bit random secret per feed; the server stores **only SHA-256(secret)**.
4. Constant-time secret comparison.
5. **Server-secret HMAC** UIDs, stable per (tenant, booking, range) and versioned.
6. Body = busy blocks only: `UID`, `DTSTAMP`, `DTSTART`, `DTEND`, `SUMMARY:Busy`, `STATUS`.
7. Rotate / revoke take effect on the **next request**; offboarding revokes the member's feeds.
8. The URL exists in plain text **only** in the one callable response that minted it — never in
   Firestore, logs, analytics or persisted UI state.
9. Uniform, non-leaking error responses; `no-store`; best-effort abuse dampening.

**Non-goals (this phase):** inbound Treatwell iCal import; per-feed detail levels (personal feeds
are busy-only too); changing how booking writers store `barberId` (see §7 and phase 2c).

---

## 2. Facts this design is built on (measured 2026-09-29)

1. **`barberId` is dual-form.** Online / walk-in / Admin writers store the barber **doc id**.
   Blocks (`functions/src/bookings/blocks.ts:306`), all parsers
   (`functions/src/parsers/importAssignment.ts:239`) and the Treatwell parser
   (`functions/src/parsers/treatwell.ts:372`) store the **lowercased current name**. Conflict
   checks already accept both (`bidLow` / `bnameLow`). Raw `"alex"` rows are the platform's
   normal import shape, not corruption.

   | Feed window (−14 d … +91 d) | doc-id | name-form, unique | ambiguous | no match |
   |---|---|---|---|---|
   | Whitecross | 140 | 15 (all Alex: Booksy 12 — 1 future CONFIRMED, 9 CHECKED_OUT, 2 CANCELLED; Fresha 2; Treatwell 1) | 0 | 0 |
   | HeroHairs | 9 | 15 (all Hero, Treatwell: 13 CHECKED_OUT, 2 CONFIRMED of which 1 future) | 0 | 0 |

   No duplicate barber names in either tenant (passive included). Out-of-window history has
   unmatched name-form rows (Whitecross 10 walk-ins, HeroHairs 63 Treatwell) that no feed needs.
2. **Cloud Run request logs record the full request URL** (`run.googleapis.com/requests`,
   `httpRequest.requestUrl`), path and query alike, 30-day retention. The `_Default` sink has
   **no exclusions** today.
3. All functions run as the **default compute service account**. Secrets bind via the
   `secrets: [...]` option (no `defineSecret` in the salown codebase).
4. Precedent to **reject**: the parse-inbox token is stored in plain text as a doc id and mirrored
   into `settings/integrations` (`functions/src/index.ts:2684`).
5. `firestore.rules` keeps a root super-admin **read** grant (`match /{document=**}`).
6. Existing composite index `tenants/{t}/bookings (barberId ASC, startTime ASC)` already serves
   a per-barber window query.
7. Treatwell subscribes to Whitecross **per barber** through the legacy feed (Java poller,
   ~5 min); a personal Google Calendar polls the same legacy URL (~7–8 h). A second barber's
   legacy URL began polling on 2026-09-28 15:45Z; its Treatwell mapping is unverified.
8. No client-side analytics / error-reporting SDK is present in the Admin app.

---

## 3. Review corrections incorporated

| # | Correction | Where |
|---|---|---|
| 1 | Uniqueness by a **deterministic registry doc**, not by a query | §4.2, §5.3 |
| 2 | **Lost CREATE/ROTATE response** protocol | §5.4 |
| 3 | `excludeSources` is **not stored**; derived from `consumer` in code | §4.1, §6.3 |
| 4 | Release order **index READY → IAM / secret / log exclusion → functions → UI** | §11 |
| 5 | Log exclusion proven with a **dummy token** before any real feed exists | §9.3 |
| 6 | Rate limiter classified **best-effort** (cost dampener, not a control) | §6.5 |
| 7 | **`roles/datastore.viewer` is project-wide** — scope stated honestly | §9.2 |
| 8 | **`uidKeyVersion`** on every feed; versioned HMAC keys | §4.1, §6.4 |
| 9 | **Treatwell compatibility gate** before any live consumer is switched | §11 slice 3 |
| 10 | Firestore **rules are OR-semantics**; a nested `if false` does not deny super-admin read | §8 |

---

## 4. Data model

### 4.1 `calendarFeeds/{feedId}` (root collection, server-only)

`feedId` = 128-bit random, base64url (22 chars). It is a **locator**, not a secret.

| Field | Type | Notes |
|---|---|---|
| `tenantId` | string | authority for which tenant is queried; never read from the URL |
| `barberId` | string | barber **doc id** |
| `consumer` | `'treatwell'` \| `'personal'` | fixes exclusion + purpose; immutable |
| `tokenHash` | string | hex SHA-256 of the 32 raw secret bytes |
| `tokenVersion` | int | +1 on every rotate |
| `uidKeyVersion` | int | which HMAC key renders this feed's UIDs (§6.4) |
| `status` | `'active'` \| `'revoked'` | revoked is terminal |
| `slotId` | string | back-reference to the registry doc (§4.2) |
| `createdAt/By`, `rotatedAt/By` | ts / uid | |
| `revokedAt/By`, `revokeReason` | ts / uid / `'manual'`\|`'offboard'`\|`'superseded'` | |

**Deliberately absent:** `excludeSources` (derived from `consumer`, §6.3 — a stored copy could
drift or be edited into an echo), the secret, any URL, any display name, last-access stamps (no
writes on GET).

### 4.2 `calendarFeedSlots/{slotId}` — the uniqueness registry

`slotId = "${tenantId}__${barberId}__${consumer}"` — deterministic; each part validated against
`^[A-Za-z0-9-]{1,64}$` before use (tenant ids and `barber-<n>` ids already fit).

| Field | Notes |
|---|---|
| `tenantId`, `barberId`, `consumer` | copies for audit |
| `activeFeedId` | string \| null — **the** single active feed for this slot |
| `generation` | int, +1 on every create / revoke through the slot |
| `updatedAt/By` | |

Every state change (CREATE, REVOKE, OFFBOARD) runs in one transaction over the slot doc and the
feed doc(s). The slot doc — not a query — decides "is there already an active feed". Offboarding
reads exactly two deterministic slot docs per barber, so it needs **no query and no index**
inside the transaction.

### 4.3 `calendarFeedOps/{opId}` — idempotency records

`opId = hex(SHA-256(tenantId | actorUid | op | idempotencyKey))`. Fields: `op`, `fingerprint`
(SHA-256 of the normalized input), `feedId`, `tokenVersion`, `outcome`, `createdAt`,
`expireAt` (Firestore TTL, proposed 30 days). **Never** the secret or its hash.

### 4.4 Audit

`tenants/{tenantId}/auditLogs` via the existing `buildServerAuditEntry`:
`CALENDAR_FEED_CREATED | ROTATED | REVOKED` with `feedId`, `barberId`, `consumer`,
`tokenVersion`, `reason`. No token, hash or URL.

---

## 5. Admin callable — `salownCalendarFeedAdmin` (onCall, europe-west2)

### 5.1 Authorisation

Caller must hold the tenant claim with `tenantRole == 'owner'` and must not be offboarded
(existing `accessStatus` authority). Super-admin may act with an explicit `tenantId` (existing
super-admin target-tenant selector pattern). Staff and admin roles are refused. The tenant is
never taken from the payload for non-super-admin callers.

### 5.2 Operations

| op | Input | Output | Notes |
|---|---|---|---|
| `CREATE` | `barberId`, `consumer`, `idempotencyKey` | `{feedId, tokenVersion, url}` | refuses a passive / unknown barber; refuses `FEED_EXISTS` when the slot has an active feed |
| `ROTATE` | `feedId`, `idempotencyKey` | `{feedId, tokenVersion, url}` | new secret + hash in one transaction; old secret invalid on the next request |
| `REVOKE` | `feedId`, `reason: 'manual'`, `idempotencyKey` | `{feedId, status}` | terminal; clears the slot |
| `LIST` | `barberId?` | metadata only | never hash, never URL |

Machine reasons: `PERMISSION_DENIED`, `INVALID_INPUT`, `BARBER_UNAVAILABLE`, `FEED_EXISTS`,
`NOT_FOUND`, `IDEMPOTENCY_CONFLICT`. The callable **never logs** its result or input secret
material (asserted by test, §10).

### 5.3 CREATE transaction (registry)

```
read slot(tenant, barber, consumer); read barber doc; read op record
if op record: replay path (§5.4)
if barber missing/passive → BARBER_UNAVAILABLE
if slot.activeFeedId && feed(activeFeedId).status == 'active' → FEED_EXISTS
mint feedId (128-bit), secret (256-bit); hash = sha256(secret)
create feed{…, status:'active', tokenVersion:1, uidKeyVersion:CURRENT}
set slot{activeFeedId: feedId, generation+1}
create op record{feedId, tokenVersion:1, outcome:'created'}
audit
→ return url built from feedId + secret (only here)
```

### 5.4 Lost CREATE / ROTATE response protocol

The secret is never stored, so **no retry can re-show a URL**. The protocol makes that safe:

1. The UI generates one `idempotencyKey` per user action and keeps it only in the open modal.
2. **Retry with the same key after the write committed** → the server finds the op record, checks
   the fingerprint, and returns `{replayed: true, feedId, tokenVersion, urlAvailable: false}`.
   A different input under the same key → `IDEMPOTENCY_CONFLICT`.
3. On `urlAvailable: false`, a network error or a timeout, the UI calls `LIST` for that slot and
   tells the owner: *"The link was created but could not be shown."* The only recovery offered is
   **ROTATE** with a fresh key. This is safe: nobody holds the lost secret.
4. A **lost ROTATE** response has already invalidated the previous secret. If a consumer used it,
   that consumer now gets 404 until the owner pastes a new URL. The UI therefore asks for
   confirmation before ROTATE (*"only rotate when you are ready to paste the new link"*), and the
   recovery for a lost ROTATE is another ROTATE.
5. REVOKE replays are harmless (terminal state).

### 5.5 UI contract

- A "Calendar feeds" section in the Team Members editor: one row per consumer
  (Treatwell / Personal) showing status, `tokenVersion`, created / rotated dates.
- The URL is shown **once**, in a modal, with a copy button. It lives only in that modal's local
  component state and is cleared on close. Never in the route, `localStorage`, a global store,
  a query cache, a toast or an error message.

---

## 6. Feed endpoint — `salownCalendarFeed` (onRequest, europe-west2)

### 6.1 URL shape

`…/salownCalendarFeed/{feedId}/{secret}.ics` — path only, no query string. `feedId` 22 chars and
`secret` 43 chars, both base64url. **Pending the Treatwell gate (§11 slice 3):** whether Treatwell
accepts this shape (suffix, length, no query). Alternatives are decided before slice 3, not
improvised during it.

### 6.2 Request handling (in order)

1. Method must be GET or HEAD.
2. Path must match `^/([A-Za-z0-9_-]{22})/([A-Za-z0-9_-]{43})\.ics$`.
3. Best-effort limiter (§6.5).
4. `get calendarFeeds/{feedId}`.
5. Compute `sha256(secret)` and compare with `crypto.timingSafeEqual` against `tokenHash`, or
   against a fixed dummy hash when the doc is missing, so existence is not observable through
   timing.
6. `status == 'active'`.
7. The barber doc exists and is not `passive` (defence in depth; offboarding already revokes).
8. The `uidKeyVersion` key is present in the environment; if not → fail closed (503).
9. Query and render (§6.3).

Any refusal in 1, 2 or 4–7 → **the same** `404` body (`Not found`) and the same headers, for
every reason. Limiter → `429` + `Retry-After`. Internal → `503`, generic body, no stack.

The handler is wrapped so that `req.url`, `req.path` and `req.originalUrl` are **never logged**,
including from uncaught errors.

### 6.3 Query, resolver, render

**Query:** `tenants/{tenantId}/bookings where barberId in [docId, lower(currentName), ''] and
startTime in [now−14d, now+90d]`. This uses the existing `(barberId, startTime)` index.

**Resolver.** A row belongs to the feed's barber if either holds:
- `barberId === docId`, or
- `lower(barberId) === lower(currentName)`, or `barberId === ''` and
  `lower(barberName) === lower(currentName)`, **and** that name is unique among all the tenant's
  barber docs, passive included.

Otherwise the row is excluded and counted as `ambiguousNameRows`.

**Consumer semantics (code constant, not stored):**

| consumer | excluded sources | purpose |
|---|---|---|
| `treatwell` | `treatwell` (case-insensitive) | no echo of Treatwell's own bookings |
| `personal` | none | the staff member sees every booking as busy |

**Render:** the hotfix contract (`functions/src/utils/icalBusyFeed.ts`), i.e. the status
allowlist CONFIRMED, PENDING, BLOCKED, CHECKED_OUT, UNPAID and `feedRanges` processing gaps.
Differences from the hotfix:
- UID per §6.4.
- `X-WR-CALNAME:Busy — salOWN`, with no tenant name and no staff name.

**Headers:** `Content-Type: text/calendar; charset=utf-8`,
`Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer`. No CORS.

### 6.4 UIDs — HMAC with `uidKeyVersion`

`UID = d(HMAC-SHA256(K[v], tenantId|bookingDocId|rangeIdx)) + "-k" + v + "@cal.salown.com"`,
where `d()` is the first 128 bits rendered as decimal digits, and `v = feed.uidKeyVersion`.

- **Keys:** one Secret Manager secret per version: `CALENDAR_UID_HMAC_KEY_V1`, then `_V2` and so
  on. Each is 32 random bytes, and the function binds every version still in use.
- **Rotation:** add `V(n+1)`, deploy, then move feeds one at a time (ROTATE with
  `rotateUidKey: true`, which accepts one-time UID churn for that feed only). A version is
  retired only when no feed references it.
- **Why versioned:** a single unversioned key could only be rotated by changing every
  subscriber's UIDs at once.

### 6.5 Rate limiting — best-effort only

- **What it is:** an in-memory token bucket per instance, keyed by `feedId`. A second bucket,
  keyed by a hashed IP, applies to invalid attempts only.
  - Proposed values: valid feed ≤ 12 requests/min/instance; invalid ≥ 20/min → 429 for 10 min.
- **What it is not:** it resets on cold start, is not shared between instances, and is bypassable
  by IP rotation. It is therefore classified as a **cost / abuse dampener, not a security
  control**. Security rests on 256-bit secret entropy plus hash-only storage.
- **Hard ceiling:** `maxInstances: 10`, `concurrency: 80`, 256 MiB, 30 s timeout.
- **Rejected:** Firestore-backed counters, because they would add a write to every request.

### 6.6 Structured access log (no secrets)

One JSON line per request: `{feedIdPrefix (6 chars), outcome, httpStatus, consumer, uaClass,
ipHash, events, ambiguousNameRows, ms}`. `uaClass` is one of a fixed set (`java-poller`,
`google-calendar`, `apple`, `other`). No URL, no path, no secret, no hash.

---

## 7. Legacy `barberId: "alex"` rows — mapping decision

**No production backfill in this phase.**

**Why the §6.3 resolver is enough:**
- It resolves every in-window row in both tenants unambiguously: Whitecross 15 of 15, HeroHairs
  15 of 15.
- Rewriting `barberId` would break readers that rely on the name form today: block and parser
  writers, conflict checks, parser dedup and Finance grouping.

**Residual risk — renaming a barber.** Name-form rows written under the old name stop matching
after the rename. Proposed follow-up, **phase 2c**, as a separate approval:
1. Writers stamp an additive `staffRef` (doc id). `barberId` is left untouched.
2. The rename flow counts in-window name-form rows for the old name and stamps `staffRef` on
   exactly those rows.
3. If a bounded backfill is approved, its evidence package is:
   - a dry-run CSV of doc ids — 30 docs as of 2026-09-29;
   - diff = `+staffRef` only;
   - rollback = `FieldValue.delete()` on the listed ids, or 7-day PITR.

---

## 8. Firestore rules — OR semantics

Rules grant access when **any** matching `allow` is true. A nested
`match /calendarFeeds/{id} { allow read, write: if false; }` therefore **cannot** take away the
root super-admin read grant. Effective access:

| Principal | calendarFeeds / Slots / Ops read | write |
|---|---|---|
| anonymous, owner, admin, staff | denied (no matching grant) | denied |
| super-admin (client SDK) | **allowed** via the root read grant | denied |
| Admin SDK (functions) | bypasses rules | yes |

The explicit `if false` blocks are documentation plus protection against a future broader
sibling grant. The super-admin read exposes hashes and metadata only, which is accepted
(owner decision D3). Removing it would mean changing the root grant, which is out of scope.
Rules tests assert this **effective** matrix, not the text of the rule.

---

## 9. IAM, secrets, logging

### 9.1 Secrets

`CALENDAR_UID_HMAC_KEY_V1`: 32 random bytes. The owner generates it and sets it with
`firebase functions:secrets:set` from a local Keychain entry. The value is never shown to an
assistant, printed or committed. It is bound to `salownCalendarFeed` only.

### 9.2 Service account — honest scope

- **Proposal:** a dedicated runtime SA `salown-calendar-feed@…`. Roles:
  - `roles/datastore.viewer`;
  - `roles/secretmanager.secretAccessor` on the UID key secret(s) only.
- **Caveat:** `datastore.viewer` is **project-wide read of every Firestore document**, including
  client PII. IAM conditions cannot restrict Firestore by document path.
- **What it does buy**, compared with the default compute SA:
  - the feed runtime has no Firestore **write** permission;
  - it has none of the default SA's other project permissions.
- **What it does not buy:** read confinement to feed data. That confinement is enforced only by
  the code path, i.e. a single doc get plus a tenant/barber-scoped query.
- The admin callable keeps the default SA, because it must write.

Owner decision D1.

### 9.3 Log exclusion — and how it is proven

- **Exclusion** on the `_Default` sink, created **before** the function receives any real
  traffic:

  ```
  resource.type="cloud_run_revision"
  AND resource.labels.service_name="salowncalendarfeed"
  AND log_id("run.googleapis.com/requests")
  ```

  - Needs `logging.configWriter` (owner).
  - Cost: the platform request log for this one service disappears; §6.6 replaces it.
  - `_Required` carries only audit logs and never HTTP URLs.
- **Dummy-token proof** (slice 2 gate, before any real feed exists):
  1. Generate a random, well-formed dummy `feedId` and secret locally. They match no feed.
  2. Send 5 GET requests. Expect 404 for each.
  3. Query Logging for the time window and confirm:
     - zero `run.googleapis.com/requests` entries for the service;
     - zero entries of any kind whose payload contains the dummy secret, or the dummy
       `feedId` beyond its 6-char prefix;
     - exactly 5 structured access-log lines with `outcome: not_found`.
  4. Also check Error Reporting for the interval.
  5. Only then continue. The dummy values are discarded and never recorded.

---

## 10. Test plan (unit + emulator + rules)

| Area | Assertion |
|---|---|
| Wrong token | Unknown `feedId`, wrong secret, revoked feed, malformed path, wrong lengths, POST → byte-identical 404 body and headers |
| Cross-tenant / feed / barber | Feed A's secret with feed B's id → 404; feed for barber X never contains barber Y rows; a same-named barber in another tenant never mixes in; the tenant comes only from the feed doc |
| Rotation | After ROTATE the old secret → 404 on the **same warm instance**; the new secret → 200; `tokenVersion` +1; lost-response replay returns `urlAvailable:false` |
| Revoke | → 404; LIST shows revoked; REVOKE is terminal; the slot is cleared; a new CREATE is allowed afterwards |
| Offboard | OFFBOARD revokes both slots in the same transaction; replay idempotent; REHIRE does not revive; a passive barber's feed → 404 |
| Registry | Two concurrent CREATEs for one slot → exactly one succeeds, the other `FEED_EXISTS` |
| Same name | Two barbers named "Alex": name-form rows excluded from both and counted; doc-id rows correct |
| Rename | doc-id rows follow the member; old name-form rows drop (documented; phase 2c guard tested separately) |
| Timing-safe | `timingSafeEqual` is invoked on every path with equal-length buffers (spy); a missing doc uses the dummy hash. A wall-clock timing check is informational only |
| Log redaction | All console and logger output is captured across every test; zero occurrences of any secret substring, full URL or `tokenHash`; the callable result is never logged |
| Treatwell exclusion | The treatwell consumer drops Treatwell-sourced rows (any case) and keeps Booksy / Fresha / Website |
| Personal source behaviour | The personal consumer keeps every source, including Treatwell |
| Output privacy | Hotfix schema: exact key set; SUMMARY `Busy`; no DESCRIPTION; UID contains no booking id; UID deterministic per `uidKeyVersion` and different across versions and tenants |
| Rules (emulator) | The effective matrix in §8, including super-admin read allowed and write denied |
| Callable authz | staff / admin refused; another tenant's owner refused; offboarded actor refused; super-admin with an explicit tenant allowed |
| HTTP hygiene | `no-store`, `nosniff`, `no-referrer`; HEAD has no body; limiter → 429 with `Retry-After` |

The emulator gate is the canonical `npm run test:emulator`, run on its own; ad-hoc emulator runs
are not evidence.

---

## 11. Delivery — four slices

Each slice has its own claim, approval and release-ledger row, and stops at its gate.

### Slice 1 — core + rules/index + emulator · **no production release**

- **Code:**
  - `functions/src/calendarFeeds/feedCore.ts` (token, hash, verify, resolver, HMAC UID, render);
  - `feedHttp.ts` and `feedAdminCallable.ts`;
  - exports in `functions/src/index.ts`;
  - the offboard hook in `functions/src/staff/lifecycleOffboard.ts`;
  - `firestore.rules` blocks and a `firestore.indexes.json` entry for `calendarFeeds`
    (`tenantId ASC, barberId ASC`) for `LIST`.
- **Tests:** unit tests, `test/rules/calendarFeeds.emulator.test.js` and
  `scripts/calendarFeeds.emulator.test.ts`.
- **Gate:** clean-archive full suite, `tsc`, canonical emulator run, rules emulator, and
  `deploy-functions.sh --check-only` for the two new names.
- **Deliverable:** commit to `main` (`[skip ci]`). Nothing deployed.

### Slice 2 — index READY → IAM / secret / log exclusion → two new functions

Steps, in this order:
1. Deploy `firestore.indexes.json` and wait until the new index is **READY**. Also confirm the
   existing `bookings (barberId, startTime)` index is READY.
2. The owner creates the SA and bindings (§9.2), the secret (§9.1) and the log exclusion (§9.3).
3. Named deploy of `salownCalendarFeed` and `salownCalendarFeedAdmin` only.
4. **Dummy-token log proof** (§9.3).
5. Deploy `firestore.rules` **last**.

**No feed is created in this slice.** The two functions are live but unreachable from the UI.

### Slice 3 — UI, Whitecross feeds and migration

1. Release `salownStaffLifecycle` with the offboard revocation **before the first feed exists**.
2. Release the Admin UI (`hosting:salown`, Team Members → Calendar feeds).
3. **Treatwell compatibility gate — Kadim first** (he has no feed today, so the blast radius is
   minimal). The owner creates **Kadim-Treatwell** and pastes the URL into Kadim's Treatwell
   staff profile. It passes only if all of the following hold:
   - Treatwell accepts the URL format;
   - the structured log shows the Java poller getting 200 within 30 min;
   - a known upcoming busy block is visible as unavailable in Treatwell (owner, visual);
   - two consecutive polls return the same UID set;
   - no duplicate blocks appear.

   If it fails: revoke the feed, keep the legacy path, and redesign the URL shape (§6.1) before
   retrying.
4. **Alex-Treatwell:** create, then the owner replaces Alex's URL in Treatwell. The legacy `alex`
   poller traffic should stop.
5. **Alex-Personal:** create, then the owner subscribes Alex's Google Calendar to it and removes
   the legacy subscription.
6. **Arda:** the owner removes the Treatwell slot or URL that polls `arda` (first confirming it is
   not Kadim's mapping) and, where reachable, the Google subscription. Unreachable subscriptions
   are cut by slice 4.

I never see or handle URLs; the owner pastes them directly.

### Slice 4 — traffic zero → 410 → legacy deletion

1. A read-only traffic report counts legacy `icalFeed` requests per barber per user-agent class.
   The gate is **zero** poller and Google requests for ≥ 7 consecutive days (≥ 3 Google cycles).
2. Legacy `icalFeed` returns **410 Gone** for one week (a code change; reversible by
   redeploying `b12fa8a6`).
3. Explicit `firebase functions:delete icalFeed --region us-central1 --project havuz-44f70`
   (owner approval), then the export is removed from whitecross-site `functions/index.js`.
4. Remove the super-admin per-barber link list (`super-admin/src/pages/Tenants.jsx`), which
   points at a region that returns 404.
5. `salownIcalFeed` / HeroHairs is a **separate track** (owner decision D8). The incident closes
   when both legacy feeds are retired or tokenised.

---

## 12. Rollback

| Change | Rollback |
|---|---|
| Two new functions | additive; delete them or remove traffic. Legacy feeds keep working until slice 4 |
| Offboard revision | Cloud Run traffic back to the previous `salownStaffLifecycle` revision |
| Rules / index | previous ruleset id; the index may stay |
| Log exclusion | delete the exclusion |
| SA / secret | unbind; keep the secret (deleting it changes UIDs if it is ever re-created) |
| A consumer switch (slice 3) | the owner puts the previous URL back in Treatwell / Google; legacy still serves |
| 410 stage | redeploy whitecross `b12fa8a6` |
| After deletion | re-create `icalFeed` from `b12fa8a6` (same URL) |

---

## 13. Proposed exact paths (for future slice claims)

| Repo | Path |
|---|---|
| salown-app | `functions/src/calendarFeeds/feedCore.ts`, `feedHttp.ts`, `feedAdminCallable.ts` (+ `.test.js` each) |
| salown-app | `functions/src/index.ts`, `functions/src/utils/icalBusyFeed.ts` (export `feedRanges` / statuses) |
| salown-app | `functions/src/staff/lifecycleOffboard.ts` (+ test) |
| salown-app | `firestore.rules`, `firestore.indexes.json`, `test/rules/calendarFeeds.emulator.test.js`, `scripts/calendarFeeds.emulator.test.ts` |
| salown-app | `src/pages/Barbers.tsx`, `src/components/team/CalendarFeedsPanel.tsx`, `src/i18n/dictionaries/{en,tr}/…` |
| salown-app | `scripts/legacyFeedTraffic.mjs` (read-only, counts only) |
| whitecross-site | `functions/index.js` (410, then export removal) |
| super-admin | `src/pages/Tenants.jsx` |
| salown-docs | this file, `RELEASE_LEDGER.md`, `INCIDENTS.md`, `ROADMAP.md`, `DEPLOYMENT_STATUS.md` |

---

## 14. Open owner decisions

| # | Decision |
|---|---|
| D1 | Dedicated feed SA with **project-wide** `datastore.viewer` (§9.2), or stay on the default SA |
| D2 | Accept losing platform request logs for `salowncalendarfeed` in exchange for keeping secrets out of logs (§9.3) |
| D3 | Accept super-admin client read of feed metadata and hashes under OR semantics (§8) |
| D4 | Kadim as the Treatwell compatibility canary; who performs each Treatwell / Google panel step |
| D5 | URL shape (§6.1) — confirmed only by the D4 gate; fallback shapes if rejected |
| D6 | Personal feeds busy-only as well (no service / client detail for the staff member) |
| D7 | Phase 2c `staffRef` + rename guard, or accept the documented rename risk |
| D8 | HeroHairs migration timing and `salownIcalFeed` retirement |
| D9 | Whose Google account holds the `arda` subscription; acceptable to cut it by retirement |
| D10 | Op-record TTL (proposed 30 d) and limiter numbers (§6.5) |
| D11 | HMAC key custody and rotation policy (§6.4) |
