# PARSER_NOTES.md

Email parsers (Booksy, Fresha, Treatwell) have historically been the most problematic area.
This file: architecture, recurring bug patterns, and "never do this again" rules.

---

## How It Works

salown-app reads the tenant Gmail account via IMAP. Each parser runs its own parse logic.
Deploy: `firebase deploy --only functions` — mandatory for a parser change.

```
salownManualImport (callable)
  └─ parseBooksyForTenant(db, tenantId, since, until)
  └─ parseFreshaForTenant(db, tenantId, since, until)
  └─ parseTreatwellForTenant(db, tenantId, since, until, reimport)
  └─ parseTreatwellIcalForTenant(db, tenantId, since, until)

Each parser uses shared helpers:
  imapSearchAndFetch()   ← IMAP connection + fetch + seen flag
  extractTextFromRaw()   ← MIME/base64/quoted-printable decode
  hasExternalIdMulti()   ← externalId dedup check
  isTombstoned()         ← tombstone dedup check
```

---

## Dedup System — Two Layers

### Layer 1: externalId
Every booking has an `externalId` field. Format:
- Booksy: `BOOKSY-{BookingNumber}` (e.g.: `BOOKSY-1780000805806`)
- Fresha: `FRESHA-{ref}`
- Treatwell: `TREATWELL-T{7+digit}`

`hasExternalIdMulti(db, tenantId, externalId)` — checks both the doc ID and the `externalId` field.

### Layer 2: Tombstone
`tenants/{tenantId}/parserTombstones/{key}` — permanent, cannot be deleted (super-admin only).

Two types of tombstone:
1. **ExternalId tombstone**: `isTombstoned(db, tenantId, externalId)` — even if the booking is deleted it is not recreated
2. **Slot tombstone**: `SLOT-Booksy-{date}-{time}` — an email arriving at the same slot with a different externalId is blocked (Booksy-specific, after the Jakov Zorić incident)

**When a tombstone is written:**
- Successful import → slot tombstone (Booksy)
- `deleteBooking()` → externalId tombstone (all parser bookings)
- Bulk delete (Settings cleanup) → tombstone batch

**Deleting a tombstone:** Never delete. If you want to re-process an email, mark it "Unread" in Gmail.

---

## UNSEEN Logic  (updated 2026-06-24 — seen-skip fully removed in ALL THREE parsers)

IMAP search is **date-based** (`{ from, since: last 7 days }`), not UNSEEN → the parser
fetches ALL emails (seen+unseen), reads the `seen` flag per-message, and marks the unseen ones as seen at the end of processing.

Previously every read (seen) non-cancel email was skipped:
```js
if (seen && !isCancellation) { skipped++; continue }   // OLD — caused booking loss
```
Problem: if staff opened the email in Gmail before the parser (5 min cycle), that booking was
**silently dropped without ever being created** (Damian Adams-Peatling 21 June incident). Solution: remove
seen-skip, leave every path to idempotent guards.

**Current state (per parser):**

| Parser | seen-skip status |
|--------|------------------|
| **Booksy** | seen-skip FULLY removed (2026-06-20). new=dedup, reschedule=ordering guard, cancel=DEAD. |
| **Fresha** | seen-skip FULLY removed (2026-06-24). Booksy parity. |
| **Treatwell** | seen-skip FULLY removed (2026-06-24). Booksy parity. |

✅ **CLOSED (2026-06-24):** In all three parsers there is no `if (seen && ...)` line. A seen NEW booking
is no longer skipped; the "Damian 21 June" / "Muhamed T2185616487" scenario is closed on all three platforms.
Previously Fresha + Treatwell were half-fixed: on 2026-06-20 only a reschedule/cancel exception
was added, the seen NEW booking skip remained (commit `472fbec` applied it halfway). See: Bug Pattern #8.

**Idempotency guards (replacing seen-skip):**
- new booking → `isTombstoned` + `isTombstonedBySlot` + `hasExternalIdMulti`
- reschedule → already-applied (date/time match) skip + `lastRescheduleEmailMs` ordering guard
- cancel → DEAD-status (`CANCELLED`/`CHECKED_OUT`/...) guard

**Exceptions:**
- Manual import (`isHistorical = true`) or Treatwell reimport: all emails are processed
- To manually re-process an email: mark it "Unread" in Gmail → the parser picks it up automatically

---

## extractTextFromRaw — MIME Decode (CRITICAL)

Booksy's `Booking #` exists only in the `text/plain` MIME part, not in the HTML part.
Before this fix: the IMAP parser could not find `Booking #` → it generated a date/time-based externalId → a different ID than the Gmail API parser → duplicate.

```js
// Order: text/plain first, base64 decode, quoted-printable decode
// HTML fallback: extractHtmlAsText() — last resort
```

**NEVER revert:** Do not read the HTML part directly. Always try the `text/plain` MIME part first.

---

## Recurring Bug Patterns

### 1. ExternalId Inconsistency
**Symptom:** The same booking written to Firestore as two different docs.
**Root cause:** Two different parsers (or two runs of the same parser) generate a different externalId.
**Check:** Is the externalId format stable? Can `BOOKSY-{BookingNumber}` always be found?
**Fix:** Is MIME decode correct? Is `Booking #` present in the plain text?

### 2. Source/Status Casing
**Symptom:** A feature looks like it doesn't work at all (cancel not arriving, cleanup not running).
**Root cause:** Casing mismatch like `'website'` vs `'Website'`, `'booksy'` vs `'Booksy'`.
**Rule:** In Firestore the `source` field is capitalized: `'Booksy'`, `'Fresha'`, `'Treatwell'`, `'Website'`, `'Walk-in'`.
Compare lowercase in queries: `source?.toLowerCase() === 'booksy'`.

### 3. Service Name Mismatch
**Symptom:** "Payment due: —" or wrong price on Fresha/Booksy bookings.
**Root cause:** The service name in the email (`"Classic Short Back and Side"`) differs from the name in Firestore (`"Classic Short Back & Sides"`).
**Fix:** `normSvc()` fuzzy normalize — `&`→`and`, strip trailing `s`. Use it in both parser match and display.
**⚠️ Note:** `normSvc` is inline in 5 places and inconsistent (some don't strip trailing `s`). Single reference for all normalize/match
rules + this inconsistency: [NORMALIZATION.md](NORMALIZATION.md).

### 4. Two Parsers Same Inbox (Jakov Zorić incident)
**Symptom:** Duplicate bookings at Whitecross.
**Root cause:** The whitecross-site parser + salown-app parser read the same Gmail.
**Rule:** Before one parser is enabled, the other must be disabled. See migration table: [MULTI_TENANT_NOTES.md](MULTI_TENANT_NOTES.md)

### 5. Treatwell T-ref Missing
**Symptom:** Treatwell bookings duplicate or strange externalIds appear.
**Root cause:** `Date.now()` fallback generated an unstable externalId.
**Fix:** If there's no T-ref, skip the email (with `console.warn`). Real Treatwell emails always have `T{7+digit}`.

### 6. Cancel Cross-Match
**Symptom:** When a Booksy cancel arrives it cancels the Fresha booking (or vice versa).
**Root cause:** Relied on the source field without an externalId.
**Fix:** A prefix check is mandatory in the cancel fallback: `externalId.startsWith('BOOKSY-')`.

### 7. Chain Reschedule — broken old-doc match (Booksy-specific, 2026-06-20)
**Symptom:** A→B is applied but B→C is not. The booking is not moved a second time.
**Root cause:** A Booksy reschedule email often does not carry the original booking number →
`oldExternalId` falls back to `BOOKSY-{name}-{date}-{time}` format. The apply fallback tried to
split this string by position and extract the old date/time; with multi-word names
("Damian Adams-Peatling") the split shifted → the live booking could not be found.
**Fix (A+B+C, commit 42def41):**
- **A:** Carry clean `oldDate`/`oldTime` from the reschedule email, find the live booking with `where date== / time==` (NO string parse).
- **B:** Ordering guard — if `emailDateMs <= booking.lastRescheduleEmailMs`, skip (don't let an old email override a newer one).
- **C:** Remove seen-skip on reschedules (see #8).
**Why NOT in Fresha/Treatwell:** Those platforms' reschedule emails carry a stable reference code
(`FRESHA-{ref}`, `TREATWELL-T{...}`) → the booking is found directly via `doc(externalId)`, no date/time
regeneration is needed. So only **B + C** were applied to them, not A.

**🔑 Core principle (never forget):** A reschedule is **DIRECTION-INDEPENDENT** — the customer can move the booking
to a LATER date OR an EARLIER one. The assumption "the customer always moves forward → the newly arrived date is already
later, beat the previous one" is WRONG. Damian went 21 Jun→31 Jul (forward) then 31 Jul→**1 Jul
(back)** and the logic built on that assumption collapsed. The correct criterion is always **the arrival
time of the newest arriving email (`emailDateMs`)** — NOT the direction/magnitude of the booking date. The code implements this:
within-batch selection `emailDateMs > existing.emailDateMs`, cross-run is the B ordering guard. If you see an expression
like "higher date wins" in the comments, fix it — it means the email time, not the booking date.

### 8. Seen-skip Booking Loss (2026-06-20 Damian + 2026-06-24 Muhamed/Treatwell — CLOSED)
**Symptom:** A new booking (or reschedule) never lands in the system; no trace in Firestore, no error either.
**Root cause:** `if (seen && !isCancellation) { skip }` — if staff opened the email in Gmail before the parser's
5-min cycle, the read (seen) email was skipped and the booking was never created.
**Fix:** Remove seen-skip, rely on dedup/ordering guards (idempotent). Fully removed on Booksy 2026-06-20;
Fresha + Treatwell **fully removed on 2026-06-24** (three-parser parity).
**Half-fix trap:** On 2026-06-20 only a `&& !isReschedule` exception was added to Fresha/Treatwell
(commit `472fbec`); the comment said "No seen-skip for reschedules/cancels" but a seen NEW booking was still
skipped. Because the comment gave the impression "it's handled," it was overlooked for 4 days → Muhamed T2185616487 didn't land.
**Lesson:** When applying a fix across multiple parsers, physically verify all three (`grep "if (seen"`);
"there's a similar comment" ≠ "same behavior." When the fix commit is done, confirm zero residue with grep.

### 9. Refactor-Orphan ReferenceError (2026-06-24, Treatwell `orderRef` — CLOSED)
**Symptom:** ALL new bookings of one parser silently drop (no trace in Firestore). The other parsers work normally → the problem isn't shared, it's specific to that parser.
**Root cause:** The 2026-06-13 refactor (commit `96d6e7a`) deleted the `const orderRef = refMatch[1]` definition in Treatwell but left the 3 places that use `orderRef` (`treatwellRef: orderRef`, reschedule map). The orphaned variable throws `ReferenceError: orderRef is not defined` on every `set()`; the try/catch in the loop catches it and puts it in `result.errors`, the booking isn't written. Went unnoticed for 11 days (seen-skip was also masking it).
**Diagnosis:** `firebase functions:log --only salownParseEmails | grep -i treatwell` → gave the error directly. **If a booking isn't landing, the FIRST step: look at the parser logs, don't guess.**
**Fix:** `const orderRef = refMatch[1];` was re-added below `externalId` (`functions/index.js:2293`).
**Lesson:** When deleting/renaming a variable definition, grep ALL of its uses (`grep -n "orderRef" functions/index.js`). `node -c` does NOT CATCH a runtime ReferenceError — only syntax. A run/lint or a real email test is needed. Look for the same pattern in the other parsers too: if there's a `treatwellRef`/`orderRef`-type orphan variable in one parser, grep for the `freshaRef`/`booksyRef` equivalent in Fresha/Booksy.

---

## Booksy-Specific Notes

- **Subject format changed:** Old: `"Booking confirmed: Hafiz — 15:00"`. New: `"John Smith: new booking"` (no date). Date/time must be parsed from the body.
- **Price:** `BOOKSY_DURATION_MAP[key].p` first (from config), otherwise regex `£([\d.]+)` fallback. The regex was catching £22 (remaining) in the new format — config always first.
- **Duration:** From the time range in the body (`15:00 - 15:25` → 25 min), fallback from the map.
- **HTML-only email:** `extractHtmlAsText()` fallback — some emails contain only an HTML part.

## Fresha-Specific Notes

- **Service name normalize:** Compare with `normSvc()` — mind the `&`/`and` and trailing `s` difference.
- **Price:** If not in the email, pull `svc.price` from the Firestore service catalog, write it in the parser.
- **Cancel:** `source === 'fresha'` OR `externalId.startsWith('FRESHA-')`.
- **Duration — NOT in the Fresha email** (fixed 2026-06-24). Booksy gives a time range
  (`15:00-15:25`) → it's calculated; Treatwell gives `(40 minutes )` → it's parsed; **Fresha
  gives only the start time, no end/duration.** Previously `endTime` was written as a fixed `+30` and
  the `duration` field was NEVER written → conflict detection (`parseInt(b.duration)` truth source)
  thought every Fresha booking was 30 min, causing calendar clashes/wrong blocks on long services.
  **Solution:** the matched service's (`svcCache`) `duration` is used; the `duration` field is WRITTEN on both the new
  booking and reschedule paths. If there's no match, 30 fallback (old behavior).
  - **Reschedule = time move only:** the existing `existingData.duration` is preserved (not reset to 30).
  - **Reschedule-create (rare, no booking):** resolved from `svcCache` if loaded, otherwise 30.
  - All Fresha write paths now write all four `date/time/duration/startTime/endTime` consistently.

## Treatwell-Specific Notes

- **externalId:** `T{7+digit}` ref required. Skip if missing.
- **iCal parser:** `since`/`until` range filter → skip those where `evt.dtStart < since || evt.dtStart >= until`.
- **Reschedule fallback:** If the booking isn't found, do NOT create a new booking — the tombstone blocks it anyway.
- **Reimport:** `reimport=true` → UNSEEN logic bypass, all emails are re-processed.

---

## Manual Import Safety

- `isHistorical = true` → UNSEEN logic off
- Re-run from a past date → missing bookings are created, existing ones are not duplicated (externalId + tombstone)
- `since`/`until` parameters are passed to all parsers
- **Safe to re-run:** Every parser is idempotent — you can import the same date multiple times.

---

## Deploy Order (Parser Change)

```bash
cd ~/Desktop/alex/salown-app
firebase deploy --only functions --project havuz-44f70
```

No hosting change needed — the parser is just a Cloud Function.

---

## Firestore Rules — parserTombstones

```
parserTombstones/{key}:
  create: tenant users
  read: tenant users
  update/delete: super-admin only (immutable after write)
```

Tombstones are not deleted. If you want to delete, use the super-admin panel.
