# NORMALIZATION.md

The single reference for all "can't match / uppercase-lowercase / normalize" problems.
The most frequently recurring bug class historically: two sides hold the same value in different formats →
exact match fails → the feature silently doesn't work (cancel not arriving, price empty, history split).

**Golden rule:** Before comparing, pass BOTH sides through the same helper. Never compare
user/email/parser data with raw `===`.

---

## Normalize Helpers (source of truth)

| Field | Helper | Location | What it does | Bug it prevents |
|------|--------|-------|------------|--------------|
| **Service name** | `normSvc()` | ⚠️ inline ×5 (see below) | lowercase + trim + `&`→`and` + whitespace collapse (+ trailing `s` strip in some places) | "Classic Short Back **and Side**" ≠ "Classic Short Back **& Sides**" |
| **Booking source** | `normalizeBookingSource()` | `src/utils/bookingUtils.js:7` | `'website'/'direct'/'app'` → canonical (`'salOWN'`, `'Client App'` …) | `'website'` vs `'Website'` casing → cancel/cleanup not working |
| **Booking status** | `normalizeBookingStatus()` | `src/utils/bookingUtils.js:19` | converts to UPPERCASE | `'checked_out'` from import ≠ `'CHECKED_OUT'` |
| **Barber** | `barberKey()` | `src/utils/barberUtils.js:25` | `trim().toLowerCase()` | walk-in = lowercase name, online = doc id; must match id OR name |
| **Phone (canonical — identity matching)** | `canonicalUkPhone()` | `src/utils/ukPhone.ts` + mirror `functions/src/clients/ukPhone.ts` (parity-tested vs `salown-app/test/fixtures/ukPhoneGolden.json`) | strip non-digits; `00…`→`…`; `0`+10 → `44`+10; `44`+10 unchanged; else digits as-is; **`''` if <7 digits (never matches)** | `+447429416291` vs `07429416291` treated as two people → duplicate client, lost loyalty/history (I1, 2026-07-24). UK-only; bare 10-digit `7…` (no leading 0) is NOT folded |
| **Phone (legacy last-10)** | `normalizePhone()` | `src/pages/Clients.jsx:220` | strip whitespace/`-()+`, last 10 digits | UK formats (`+44`, `0…`, spaced) different strings → duplicate client. ⚠️ Superseded by `canonicalUkPhone` for identity matching; `redemptionKey()` (persisted discount keys) DELIBERATELY stays last-10 forever |
| **Email** | `.toLowerCase().trim()` | `src/firestoreActions.js` (dedup) | lowercase + trim | `Alex@x.com` ≠ `alex@x.com` → duplicate / merge fails |
| **Name (accent)** | `stripAccents()` | `src/firestoreActions.js:10` | NFD + U+0300–U+036F strip (`Zorić`→`Zoric`) | accented Booksy name ≠ direct record → history split |
| **Name (rename)** | `_origName`-prioritized match | `whitecross-site` Clients | binds a renamed client to bookings | "Ozcem" → "OZCEM delibas" history loss on rename |
| **Date (key)** | `toDateKey()` | ⚠️ inline ×4 (see below) | `YYYY-MM-DD` local time | `.toISOString()` shifts the day in BST |
| **Working day/hour** | object→array + key case | self-signup + Dashboard defensive | `{monday:true}` → `['Monday',…]`; `settings/hours` key `Monday`→`monday` | shop-closed days wrong; old tenant doc incompatible |

---

## ⚠️ Known Inconsistencies (latent bug — must be fixed)

### normSvc is inline in 5 places and NOT THE SAME
| Location | trailing `s` strip? |
|-------|---------------------|
| `functions/index.js:1585` (Booksy) | ❌ NO |
| `functions/index.js:1772` (Booksy reschedule) | ❌ NO |
| `functions/index.js:2079` (Fresha new) | ✅ YES |
| `functions/index.js:2324` (Treatwell) | ❌ NO |
| `src/components/BookingDetailPanel.jsx:420` | ✅ YES |

**Result:** The same service name matches differently depending on which parser/screen it passes through. E.g.
"Classic Short Back & Sides" → Fresha (2079) matches, Booksy (1585) doesn't. **Solution:** extract to a single
`normSvc` helper (e.g. `src/utils/serviceUtils.js` + shared on the functions side),
fix the trailing `s` behavior. Not done yet.

### toDateKey copied in 4 files
`timeUtils.js:32` (canonical), but `Calendar.jsx:18`, `Home.jsx:15`, `Finance.jsx:43` keep their own
copy. All the same logic but drift risk → should be imported from `timeUtils`.

### settings/hours day keys = CAPITALIZED (canonical) ✅ staff fixed
`Settings.tsx` writes `tenants/{id}/settings/hours` with **Capitalized** day keys
(`Monday`…`Sunday` — verified in the live whitecross doc 2026-07-14). Staff
NewBookingSheet was looking for lowercase (`monday`) → `undefined` → thinking "day closed" and
**the "outside opening hours" warning was firing on EVERY booking**. Fix `c3111e0` (salown-app):
Capitalized lookup + lowercase fallback; if the key doesn't exist at all there's now NO warning (only
`closed:true` or a time outside open..close warns). New code reading `settings/hours` should use the
Capitalized key; `getAvailableBarbersForDate`'s `barber.dayHours`/
`workingDays` keys are also Capitalized — same standard.

---

## 🎯 Parser Matching Standard (DRAFT — awaiting approval + ChatGPT suggestions)

> **Why critical:** salOWN is on its way to becoming an aggregator. Until Booksy/Fresha/Treatwell give a direct API,
> our only data source is the email parsers. Matching must be 100% — a wrong match = booking to the wrong customer,
> double record, lost history. This standard will be binding for all parser + client identity
> comparisons.

**Every compared value is put into this canonical form, THEN compared:**

| Dimension | Canonical rule | Example |
|-------|---------------|-------|
| **Uppercase/lowercase** | everything `toLowerCase()` | `ARDA` = `arda` |
| **& / and** | `&` → `and`, multiple whitespace → single | `Back & Sides` = `back and sides` |
| **Trailing s / plural** | strip trailing `s` in service name (fix in ONE rule) | `Side` = `Sides` |
| **Price** | convert to number: strip `£`, comma, whitespace → `parseFloat`; **compare numerically** | `£28` = `28` = `28.00` = `28,00` |
| **Accent** | `stripAccents()` (NFD + diacritic strip) | `Zorić` = `Zoric` |
| **Name** | lowercase + trim + accent strip + multiple whitespace → single | `Damian  Adams-Peatling` = `damian adams-peatling` |
| **Phone** | `canonicalUkPhone()` (since I1, 2026-07-24): strip non-digit, `00`-prefix strip, `0`+10 → `44`+10, `<7` digits → no identity | `+44 7700 900123` = `07700900123` = `447700900123` (all → `447700900123`) |

### ⚠️ Phone "last 4 digits" — CAUTION (engineering warning)
Last 4 digits = only 10,000 combinations. In a salon with hundreds of customers a **collision is nearly certain**
→ if last-4 ALONE is the match criterion it **mixes up different people** (wrong merge).
**Recommended usage:**
- **Primary:** last **10 digits** exact match (nearly unique, safe).
- **Last 4 digits only as a SUPPORT signal:** if the normalized name + last-4 hold together, "strong match."
  Never merge/cancel based on last-4 alone.
- If a source gives a truncated/incomplete phone (e.g. 7 digits), verify with the last-4 + name + date/time triple.

### Name matching rule (aligned with current policy)
- The name is NOT a match criterion **ON ITS OWN when contact info (phone/email) is present** (wrong merge risk).
  See: client identity lookup order.
- The name is normalized (rule above) but is always **secondary/confirmatory** — primary key:
  `externalId` in the parser, phone/email on the client.

### Price normalize — currently MISSING
In some places the price is compared as a **string** (`"£28"` vs `"28.00"`). Standard: always
convert to a **number** with `parseFloat(str.replace(/[£,\s]/g,''))`, compare numerically. There's no single helper yet
(`normalizePrice()` should be added).

---

## Recurring Pattern (shared with PARSER_NOTES)

- **Source/Status casing:** see [PARSER_NOTES.md](PARSER_NOTES.md) #2 — write capitalized in Firestore,
  compare with `?.toLowerCase()` in queries.
- **Service name mismatch:** see [PARSER_NOTES.md](PARSER_NOTES.md) #3.
- **Client identity:** see [CLAUDE.md](../salown-app/CLAUDE.md) "Client identity" — lookup order
  `clientManualId` → phone/email → `_aliases` → normalize phone → name-only fallback.

**Rule:** When adding a new comparison — ask "can these two values arrive in different formats?"
If the answer is yes, pass through the helper, both of them. Don't write a new normalize helper; use one from the table above.
