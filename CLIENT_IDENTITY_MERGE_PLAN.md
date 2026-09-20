# Client Identity & Merge — Hardening Plan

**Status:** DESIGN ONLY — no code written, no merge executed, no production write performed.
**Date:** 2026-09-20 · **Tenant surveyed:** `whitecross` (read-only Firestore REST reads)
**Trigger:** the Conrad Swift duplicate (2026-09-20 10:36Z merge) — used here as a dry-run
specimen only.

---

## 0. Measured baseline (read-only survey, `tenants/whitecross`)

| Fact | Value | Why it matters |
|---|---|---|
| client docs | 471 | population under management |
| booking docs | 1,887 | |
| bookings with **no** `clientManualId` | **1,769 (93.8%)** | id-based relink can reach only 6.2% of history |
| …of those, `CHECKED_OUT` | **1,747** | the visits that carry money and points |
| clients with **neither** `phoneCanonical` nor `emailCanonical` | **202 (42.9%)** | indexed lookup misses them; every probe degrades to a full-collection scan |
| merged-away (`hidden:true`) clients | 2 | both carry `mergedInto` |
| same-name hidden/visible collisions | **1** (Conrad Swift) | survivor is invisible in the Clients list (§7) |
| **unmerged** visible duplicate pairs | **5** (by canonical email; 1 of them also by phone) | `gerry.steele@`, `paul.kay@evolveuk.biz`, `kluidino@`, `dansmethurst90@`, `nmheilpern@` |

The two headline numbers — 93.8% of bookings unlinked and 42.9% of clients uncanonicalised —
are the reason the current merge "succeeds" while moving almost nothing. They also set the
order of work: **normalisation and relink must precede any stats rebuild**, because a rebuild
over an unlinked history computes the wrong number with full confidence.

---

## 1. Code inventory — every place identity is decided today

| # | Location | What it does | Defect |
|---|---|---|---|
| 1 | `functions/src/clients/identity.ts:185` `resolveClientIdentity` | authoritative public resolver: trusted id → `emailCanonical`/`phoneCanonical` → legacy scan → conflict | **no `hidden` / `mergedInto` / `_aliases` awareness.** A merged-away doc is a live match; a merge can be silently undone by the next booking |
| 2 | `functions/src/clients/identity.ts:116` `resolveClientDocId` | find-or-create for re-engage stamps (`index.ts:3000`, `:3158`) | **matches by NAME alone** (`matchesClient`), **creates** client docs, full-collection scan, and a phone-only probe returns `null` without trying phone |
| 3 | `src/lib/clientWriter.ts` | the intended single create door; canonical stamps, alias-aware `matchClientCandidate`, refuses duplicates | correct — and the **only** code in the repo that follows `mergedInto` to a survivor (`:251-270`) |
| 4 | `src/pages/Clients.tsx:343` `resolveMemberDocId` | resolves/creates the merge target | **third create path**; scans by name; **no `hidden` filter** — in a same-name merge it can return the hidden twin |
| 5 | `src/pages/Clients.tsx:426` `handleMerge` | the merge itself | relinks **only** `where('clientManualId','==',sourceId)`; never touches stats; not transactional; no merge reason; no unmerge |
| 6 | `src/pages/Clients.tsx:253-261` | Clients list assembly | `hiddenKeys` contains the hidden doc's **name** → same-name survivor disappears entirely (§7) |
| 7 | `src/components/BookingDetailPanel.tsx:670` | "Nth visit" badge | counts distinct **days** of `CHECKED_OUT` bookings matched by the current booking's own phone-variants/email; ignores `_aliases`, `mergedInto`, `clientManualId` |
| 8 | `src/firestoreActions.ts:895-940` `checkoutBooking` | admin checkout stats | `increment()`-based; client **resolution happens outside the transaction**, `tx.set(newClientRef,…)` inside → two concurrent checkouts create two clients |
| 9 | `src/firestoreActions.ts:952` `getClientLoyaltyPoints` | points/member/returning lookup | filters `hidden` (good) but **does not follow `mergedInto`** → a probe on an absorbed identity reports 0 points instead of the survivor's |
| 10 | `functions/src/checkout/executor.ts:1574` | server checkout stats | `totalSpent + (paidNow_m + paidEarlier_m)`, `totalVisits + 1` — a **different money fold** from the reader-side `clientBookingGross` |
| 11 | `src/utils/audienceUtils.ts:67` `buildAudience`, `:181` `canonicalBookingKeys` | the identity graph behind Marketing, Reports, Home | union-find over `manualId·email·phone` — **no `hidden` filter, no alias or `mergedInto` edges** → a merged twin returns as a separate person and can be emailed twice |
| 12 | `functions/src/parsers/*` | Booksy/Treatwell/Fresha import | never resolve a client, never write `clientManualId` — the direct cause of `bookingsRelinked: 0` |
| 13 | `firestore.rules:856` | `clients` | `read, create, update` for any tenant member; a browser-side merge is unconstrained by rules |

**Structural conclusion.** There is no owner of client identity. There are three creation paths
(3, 2, 4), four matchers with four different rule sets (1, 3, 4, 11), and one soft-delete marker
that exactly one of them respects. Every defect below is a symptom of that.

---

## 2. Target data model

### 2.1 Canonical client document

```
tenants/{tid}/clients/{clientId}
  name, phone, email                    # as typed — display only, never matched on directly
  nameNormalized        string          # NEW — casefold + NFKD diacritic strip + whitespace collapse
  phoneCanonical        string          # existing — canonicalUkPhone(); omitted when invalid
  emailCanonical        string          # existing — trim + lowercase; omitted when invalid
  identities            string[]        # NEW — every token this doc owns: 'em:…' | 'ph:…' | 'ext:booksy:…'
  aliasEmails           string[]        # NEW — canonical form, absorbed identities
  aliasPhones           string[]        # NEW — canonical form, absorbed identities
  _aliases              string[]        # LEGACY raw mixed array — read-only after migration
  hidden                bool            # merge tombstone
  mergedInto            string          # survivor clientId
  mergedAt              timestamp
  mergeReason           string          # NEW — 'operator_drag' | 'dedup_backfill' | 'review_queue'
  mergeId               string          # NEW — idempotency key of the merge that folded it
  statsVersion          number          # NEW — rebuild generation; a rebuild is a no-op at the current version
  loyaltyPoints, totalSpent, totalVisits, totalDiscount, lastVisit, lastBarber, lastService
```

`identities` is a single array field so one `array-contains` query replaces the current
two-query + scan fan-out, and so an alias is queryable rather than scan-only. A single-field
index covers it; no composite index is required.

### 2.2 Deterministic identity index (the concurrency primitive)

```
tenants/{tid}/clientIdentities/{token}     # token = 'em:conradjswift@gmail.com' | 'ph:447947766655'
  clientId    string
  createdAt   timestamp
  mergedFrom  string|null                  # set when a merge repoints the token
```

The document **id is the identity**, so `tx.create()` on it is the mutual exclusion: two
concurrent creates for the same email cannot both succeed. This is the only structure in the
design that makes §8 solvable without a distributed lock.

### 2.3 Merge journal

```
tenants/{tid}/clientMerges/{mergeId}        # mergeId = deterministic: hash(sourceId, targetId)
  sourceId, targetId, reason, requestedBy, requestedAt
  phase            'planned' | 'relinked' | 'rebuilt' | 'done'
  bookingsRelinked number
  statsBefore, statsAfter   map             # for unmerge and for audit
  cursor           string|null              # last relinked booking id — resume point
```

Deterministic `mergeId` + `phase` is what makes "merge run twice" a no-op rather than a
double-count (§6).

---

## 3. Normalization contract (heading 1)

One module, reused by frontend and Functions, pinned by a parity test over shared golden
fixtures — the pattern `ukPhone.ts` already uses.

| Field | Rule | Empty result means |
|---|---|---|
| email | `trim()` → `toLowerCase()`. **No** Gmail dot/plus folding (a policy choice: it would merge deliberately-separate addresses) | not an identity |
| phone | existing `canonicalUkPhone()` — UK-only, `<7 digits ⇒ ''` | not an identity |
| name | casefold → NFKD → strip combining marks → collapse internal whitespace → trim | never an identity on its own |

Two legacy rules must be **retired, not kept in parallel**:
`normalizeEmail` (lowercase **without** trim, `identity.ts:44`) and the last-10-digit phone
compare (`firestoreActions.ts:956`). Both exist only to serve the legacy scan; once §11's
backfill stamps every doc, the scan and both rules are deleted in one commit.

`redemptionKey` (`identity.ts:~230`) is **deliberately excluded** — its output is persisted in
redemption records and changing its shape would re-open already-redeemed discount codes.
It stays byte-identical forever.

Conrad specimen: `conraddjswift@` vs `conradjswift@` differ by a real character, so no
normalisation rule will ever unify them. They are an **alias** relationship, not a
normalisation one — which is precisely why §4's alias model has to exist.

---

## 4. Deterministic resolution ladder (heading 2)

Evaluated in order; **first level that produces exactly one candidate wins**.

| L | Signal | Source of truth | Auto-link? |
|---|---|---|---|
| L0 | `clientManualId` | trusted caller only (`trustClientManualId`), doc must exist in tenant | yes |
| L1 | external source id | `ext:<source>:<id>` token (Booksy/Treatwell booking ref) | yes |
| L2 | `em:` token agrees with `ph:` token | both resolve to the same clientId | yes — strongest |
| L3 | `em:` token alone | `clientIdentities` → `clients.identities` | yes |
| L4 | `ph:` token alone | as above | yes |
| L5 | alias token (`aliasEmails`/`aliasPhones`) | same index, `mergedFrom` set | yes, **resolving to the survivor** |
| L6 | name only | — | **never.** Locked. |

Two rules ride on every level:

- **Tombstone following is mandatory.** A hit on a doc with `hidden && mergedInto` resolves to
  the survivor, transitively, with a depth cap of 8 and a cycle guard. Today only
  `clientWriter.ts` does this; it becomes a shared helper that levels L0–L5 all call.
- **Determinism replaces first-hit-wins.** Where the current code does
  `s.forEach(d => { if (id === null) id = d.id })` over an unordered snapshot, the resolver
  must instead treat `>1` visible candidate as a **conflict** (§9), never as "take whichever
  Firestore returned first". With 5 live duplicate pairs in whitecross, that branch is reachable
  today and its outcome is currently arbitrary.

`resolveClientDocId` (the name-matching find-or-create at `identity.ts:116`) is **deleted**.
Its two callers move to `resolveClientIdentity` + the write path in §5.

---

## 5. Create-time deduplication (heading 3)

Every client birth goes through **one** server-side door, `ensureClient()`, which is
`clientWriter.ts`'s rules moved into Functions and made transactional:

1. Normalise → tokens.
2. Resolve via the L0–L5 ladder (tombstone-following).
3. Hit → return that id. **No new document.**
4. Miss → single transaction: `tx.create` each `clientIdentities/{token}`, then `tx.create` the
   client doc carrying those tokens in `identities`. A `create` collision aborts the whole
   transaction; the caller retries once and the retry resolves to the winner.
5. Conflict (tokens point at different clients) → create nothing, return the conflict, enqueue
   for review (§9).

Callers to converge: `checkoutBooking` (`firestoreActions.ts:930`), `checkout/executor.ts`,
`resolveMemberDocId` (`Clients.tsx:353`), `AddClientModal`, the Staff App create sheets, and
— new — the parser import path, so aggregator bookings stop arriving unlinked (defect 12).

Public booking creates keep their current posture: `createBooking.ts` resolves **without**
`trustClientManualId` and still never creates a client doc. That boundary is correct and is not
being widened; the parser path is server-side and is a different trust class.

---

## 6. Booking relink (heading 5)

The current relink is one query on `clientManualId`, which reaches 6.2% of bookings. The
replacement resolves each booking by its **own recorded contact fields** against the source's
identity set:

```
candidates = bookings where clientEmail ∈ {source emails ∪ aliasEmails}          (canonical compare)
           ∪ bookings where clientPhone ∈ ukPhoneQueryVariants(source phones)    (bounded `in`)
           ∪ bookings where clientManualId == sourceId
```

Then **filter**, do not trust:

- a booking already carrying `clientManualId == targetId` → skip (idempotent).
- a booking carrying a **different, visible** `clientManualId` → do **not** move; record as
  `ambiguous` in the merge journal for human review.
- a contact-less booking matched only by name → do **not** move. Name never moves money.

Writes are chunked `writeBatch`es of ≤ 400, each stamping
`clientManualId`, `identityLinkedBy: 'merge:<mergeId>'`, `identityLinkedAt`, and advancing
`clientMerges/{mergeId}.cursor`. Resumable, and re-running from any cursor position is a no-op
on already-stamped bookings.

**Sequencing note.** Because 1,747 checked-out bookings carry no link at all, the §11 backfill
should relink the whole collection *before* any stats rebuild runs. Relinking inside individual
merges only would leave the rebuild reading a partial history.

---

## 7. Same-name UI bug (heading 7)

`src/pages/Clients.tsx:253`:

```js
const hiddenKeys = new Set(manualClients.filter(m => m.hidden)
  .flatMap(m => [m.phone, m.email, m.name?.toLowerCase(), m._origName?.toLowerCase()]))
…
bookingClients.filter(c => !hiddenKeys.has(c.phone) && !hiddenKeys.has(c.email)
                        && !hiddenKeys.has(c.name?.toLowerCase()))
```

The hidden doc's **name** is a hide key. When source and target share a name — the normal case
for a duplicate — every booking-derived group with that name is dropped, including the
survivor's. The manual re-add loop at `:261` then tests `exists` against the *unfiltered*
`bookingClients`, finds a match, and does not re-add the survivor either. Net effect: the
client vanishes from the Clients page. Confirmed against live data: Conrad Swift is the only
same-name collision in whitecross, and the two earlier merges (Matthew→Matt, Thomas→Tom) had
differing names, which is why this has not been seen before.

**Fix:** hiding is an **identity** operation, never a name operation.

- build `hiddenTokens` from canonical email/phone tokens of hidden docs, plus their doc ids —
  never `name`;
- group bookings with `canonicalBookingKeys` (which already understands `clientManualId`), then
  drop a group only when it resolves to a hidden doc whose survivor is present;
- re-add check runs against the **filtered** set, by `manualId`, not by name;
- replace every inline `!m.hidden` (`BookingForm.tsx:236`, `WalkInForm.tsx:332`, `Clients.tsx`)
  with the existing shared `isVisibleClient` / `visibleClients` from `src/lib/clientVisibility.ts`.

The same blindness exists in `buildAudience`/`canonicalBookingKeys` (defect 11): they filter
nothing and carry no alias or `mergedInto` edges, so the merged twin reappears as a separate
person in Marketing, Reports and Home. Those two functions take `hidden` filtering and
alias/tombstone edges in the same change, or the merge is only cosmetic.

---

## 8. Concurrency (heading 8)

Today: `checkoutBooking` runs its lookup queries **before** `runTransaction`, then `tx.set`s a
freshly allocated `doc()` ref inside it. Two tills, two devices, or a webhook racing a checkout
all resolve "no client" and both create one. Firestore cannot detect the collision because the
two refs differ.

Design: the `clientIdentities/{token}` document **is** the lock.

```
runTransaction(tx => {
  for (token of tokens) {
    const idx = await tx.get(indexRef(token));
    if (idx.exists) return { existing: idx.data().clientId };   // loser path, no write
  }
  const clientRef = col.doc();
  for (token of tokens) tx.create(indexRef(token), { clientId: clientRef.id, createdAt: now });
  tx.create(clientRef, buildClientDoc(...));
})
```

`tx.create` on an occupied path fails the whole transaction — the structural guard, not the
advisory one. The loser retries once and resolves to the winner. A booking that supplies both
email and phone acquires both tokens in the same transaction, so a half-claimed identity is
impossible.

**Transaction boundaries, stated explicitly:**

| Operation | Boundary | Rationale |
|---|---|---|
| `ensureClient` | one transaction: read all tokens → create tokens + client | atomic identity claim |
| checkout stats | existing transaction, extended to include the client doc | already correct in `executor.ts`; `firestoreActions.ts` must move its *resolution* inside |
| merge relink | **not** a transaction — chunked batches + journal cursor | 1,769 bookings exceeds any transaction limit; idempotency comes from the stamp, not from atomicity |
| token repoint | one transaction per token | moving `em:x` from source to target must not be partially visible |
| stats rebuild | one transaction: read journal + client, write stats + `statsVersion` | read-modify-write on a single doc |
| tombstone | same transaction as the final rebuild | survivor and tombstone become consistent together |

---

## 9. Conflict policy (heading 9)

Nothing on this table auto-merges. Each lands in `tenants/{tid}/clientReviewQueue/{id}` with
both candidates, the evidence, and a one-click operator resolution.

| Case | Signal | Action |
|---|---|---|
| same email, different phone | `em:` → A, `ph:` → B | **review.** Family sharing an inbox is real |
| same phone, different email | `ph:` → A, `em:` → B | **review.** Shared landline / couple |
| shared phone, ≥3 distinct names | one `ph:` token, many names | **never merge.** Mark the token `shared: true` and demote it to a weak signal for that number only |
| identical email **and** identical phone | both → same id | auto-link (L2) |
| >1 visible candidate on one token | duplicate pair already exists | **review**, and surface as a dedup suggestion — this is the 5 live pairs |
| candidate is `hidden` with `mergedInto` | tombstone | follow to survivor, auto |
| name equal, no contact overlap | — | **never.** Locked (L6) |
| email differs by one character | Levenshtein ≤ 2 | **suggest only**, never auto. This is exactly Conrad, and it must stay a human decision |

The review queue is the deliverable that makes the rest safe: without it, every ambiguity has to
resolve to either "merge wrongly" or "duplicate silently", and the system currently picks the
second.

---

## 10. Stats rebuild (heading 6)

Stats today are **incremental** (`increment(1)`, `increment(total + prePaid)`). Nothing
recomputes them, so every missed link is permanent. The rebuild makes them a **pure function of
the canonical client's bookings**, so a merge is "relink, then recompute" and never "add two
numbers".

### 10.1 Inclusion rules — stated, not implied

| Rule | Decision |
|---|---|
| a visit | one booking with `normalizeBookingStatus(status) === 'CHECKED_OUT'` |
| cancelled / no-show | excluded from visits, spend and points |
| blocks (`isBlockRecord`) | excluded entirely |
| product-only sales (`bookingType: 'sale'`) | excluded — no visit, no spend, no points (pinned by `executor.ts:1556` comment) |
| refunds / negative corrections | subtract at the receipt level; a fully refunded booking contributes £0 but **still counts as a visit** unless it is also un-checked-out |
| duplicate bookings (same client, same day, same service) | counted once, keyed by `(clientId, dayKey, serviceId, startTime)` |
| money | **one** fold contract, adopted explicitly |
| points | `Σ(loyaltyPointsEarned − loyaltyPointsRedeemed)` over included bookings **+** `Σ` manual adjustments from `auditLogs` where `action == 'manual_points_adjustment'`, clamped `≥ 0`; forced to `0` while `isMember` |

### 10.2 The money fold is a real fork in the road

Two folds exist and disagree:

- writer side — `executor.ts:1574`: `paidNow_m + paidEarlier_m`
- reader side — `src/pages/clientSpend.ts` `clientBookingGross`: `(paidAtCheckout + preDeskAmount) || price`, with a separate config-driven branch for Booksy

Conrad's data shows why this cannot be hand-waved: the 29 Aug Booksy booking has
`price: "£32.00"`, `paidAmount: 28`, one add-on, and the writer stored `totalSpent: 38`. A naive
`Σ price` rebuild would produce £64 for this client; the writer contract produces £70. **The
rebuild must adopt the writer contract** (`totalSpent` as the checkout actually recorded it) and
prove it by replaying against a sample of 50 existing clients whose stats were never touched by a
merge — if the replay does not reproduce their stored values, the contract is wrong and no
backfill runs.

### 10.3 Idempotency

`rebuildStats(clientId)` reads bookings + audit adjustments and **writes absolute values**, never
increments, stamped with `statsVersion`. Running it twice is identical to running it once.
`mergeClients(source, target)` = relink → repoint tokens → rebuild target → tombstone source,
each phase advancing `clientMerges/{mergeId}.phase`. Re-running a completed merge is a no-op at
`phase: 'done'`. Double-merge safety comes from the journal and from absolute writes together;
neither is sufficient alone.

**Unmerge** becomes possible for the first time: `statsBefore` in the journal plus the
`identityLinkedBy: 'merge:<mergeId>'` stamp on every moved booking is enough to reverse the
operation exactly. It is in scope for the design, out of scope for the first release.

---

## 11. Migration (heading 11)

Three gated phases. Nothing in phase A or B writes customer data.

**Phase A — dry-run report (read-only, no approval needed).**
`scripts/clientIdentityDryRun.cjs` emits JSON + a human table:
proposed canonical stamps (the 202 uncanonicalised docs), proposed relinks (the 1,769 unlinked
bookings, each with its match level L0–L5 and its evidence), duplicate-pair suggestions (the 5
live pairs), conflict/review rows, and — critically — a **stats replay diff**: what the rebuild
would compute versus what is stored today, per client. A replay that disagrees on clients who
were never merged is a bug in the contract, not a finding about the data.

**Phase B — emulator rehearsal.**
The dry-run plan is applied against a Firestore emulator seeded from a production export, then
the report is regenerated. Success criterion: second run proposes zero changes (convergence),
and no client's stats move except those explained by a relink.

**Phase C — one-time backfill, owner-approved, tenant by tenant.**
Order is fixed: canonical stamps → identity tokens → booking relink → stats rebuild →
duplicate merges (operator-confirmed, one at a time). Each step writes its own journal and is
individually reversible. `whitecross` first, as the only tenant with measured drift.

---

## 12. Test plan (heading 10)

Unit (`vitest`, `npm test`):

1. normalisation golden fixtures — email trim/case, phone E.164/UK, name diacritics
   (`Ayşe`/`AYSE`, `José`/`Jose`), shared frontend/Functions parity
2. missing `clientManualId` — relink by email only, phone only, both, neither
3. typo email — `conraddjswift@` vs `conradjswift@` resolves **only** via alias, never via fuzzy
4. phone format drift — `07947 766655` / `+447947766655` / `00447947766655` → one identity
5. same-name, different-contact clients are **never** linked (L6 locked)
6. alias hit resolves to the **survivor**, not the tombstone; transitive chain; cycle guard
7. double merge — second run changes nothing (`phase: 'done'`, absolute stats identical)
8. stats rebuild determinism — shuffled booking order, same result
9. inclusion rules — cancelled, no-show, block, product-sale, refund, same-day duplicate
10. money-fold replay — 50 untouched clients reproduce their stored `totalSpent`
11. points rebuild with a manual adjustment in `auditLogs`, and with `isMember: true`
12. Clients-list assembly — same-name merge keeps the survivor **visible** (the §7 regression)
13. `buildAudience` — a merged pair yields **one** person, not two
14. conflict matrix — each row of §9 produces the stated outcome

Emulator (`ops/test-emulator.sh`, run alone, per the canonical gate):

15. concurrent `ensureClient` with the same email → exactly one client doc, one token
16. concurrent checkout + public booking for the same new person → one client
17. relink interrupted mid-cursor → resumes, no double stamp
18. token repoint partially applied → transaction aborts, no half-claimed identity
19. unmerge restores `statsBefore` and clears every `identityLinkedBy` stamp

---

## 13. Conrad Swift — the specimen, and its separate repair

**Do not run this as part of the general backfill.** It is a single-record correction, listed
here so it can be executed and verified on its own once approved.

Current state (verified read-only, 2026-09-20):

| | survivor `ouHXBYEWwi7byV8ipSpK` | tombstone `gmnwwvU7nRj23dcEvVfh` |
|---|---|---|
| created | 2026-08-29 | 2026-09-05 |
| email | `conradjswift@gmail.com` | `conraddjswift@gmail.com` |
| phone | `07947 766655` → `447947766655` | `+079476655` → `079476655` (malformed, 9 digits) |
| loyaltyPoints | 38 | 32 |
| totalSpent | 38 | 32 |
| totalVisits | 1 | 1 |
| markers | `_aliases: ['+079476655','conraddjswift@gmail.com']` | `hidden`, `mergedInto: ouHX…`, `mergedAt` |

Bookings: `BOOKSY-…-29-August-2026-09:00` (CHECKED_OUT, £38 recorded, 38 pts, **no**
`clientManualId`), `WX5RBb383ZLEnEStWskh` (05 Sep, CHECKED_OUT, £32, 32 pts, **no**
`clientManualId`), `ZtHZowZbGH3q93mK0TGk` (22 Sep, CONFIRMED, correctly linked to the survivor).
Audit: `CLIENTS_MERGED … bookingsRelinked: 0`.

Repair, in order, each step verified before the next:

1. **Relink** both checked-out bookings to `ouHXBYEWwi7byV8ipSpK`, stamping
   `identityLinkedBy: 'manual-repair-2026-09-20'`.
2. **Alias canonicalisation** on the survivor: `aliasEmails: ['conraddjswift@gmail.com']`,
   `aliasPhones: []`. The tombstone's phone canonicalises to `079476655` — 9 digits, below the
   7-digit floor only in UK-shape terms but not a valid UK number; it must **not** become a
   matchable alias. Keep the raw string in `_aliases` for the audit trail only.
3. **Rebuild** the survivor's stats from the two included bookings:
   `totalVisits: 2`, `totalSpent: 70`, `loyaltyPoints: 70`, `lastVisit: 2026-09-05`,
   `totalDiscount: 0`. (£38 + £32 — **not** £32 + £32; the Booksy visit's recorded value is 38,
   not its `price` field. This step is the live proof of §10.2.)
4. **Zero the tombstone's** `loyaltyPoints`/`totalSpent`/`totalVisits` so no future reader can
   double-count them, keeping `mergedInto` intact.
5. **Verify** in the panel: the 22 Sep booking's badge reads **3rd visit**, points read **70**,
   and Conrad Swift is **visible again** in the Clients list. Step 5 cannot pass until §7 ships —
   the list bug is code, not data.

Expected post-repair badge behaviour is itself a §7/§10 dependency: the badge counts distinct
days via the booking's own contact fields, so until it consults `clientManualId`/aliases, it will
read 3rd visit only because the relink gives both bookings the survivor's id **and** the badge is
changed to use it. Repairing the data alone fixes points and totals, not the badge.

---

## 14. Sequencing

1. §3 normalisation module + §7 UI/audience hidden-by-identity fix — no data migration, ships alone, restores the invisible survivor
2. §2.2 identity index + §5 `ensureClient` + §8 transaction — stops new duplicates being born
3. §4 resolver ladder + tombstone following everywhere — stops merges being undone
4. §6 relink + §10 rebuild as a server callable, with §12 tests green on the emulator gate
5. §11 phase A dry-run → owner review → phase C backfill
6. §13 Conrad repair (can run any time after step 4; its verification needs step 1)
7. Delete the legacy scan, `resolveClientDocId`, `normalizeEmail`, and the last-10 phone compare

---

## 15. Open decisions for the owner

1. **Gmail dot/plus folding** — recommended **no**. `a.b@gmail` and `ab@gmail` are the same
   inbox but not reliably the same customer intent, and the rule does not generalise to other
   providers.
2. **Refunded visit counts as a visit** — recommended **yes** (the person was served).
3. **Points on a merge** — recommended **sum**, as §10 computes. The alternative (survivor's
   points only) silently confiscates loyalty the customer earned.
4. **Auto-merge threshold** — recommended **none**. Every merge stays operator-confirmed; the
   system only ever suggests.
5. **Unmerge in v1** — recommended **design now, ship later**; the journal fields it needs cost
   nothing to write from day one.
