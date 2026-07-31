# TR_BEAUTY_MARKET_REQUIREMENTS.md — what a Turkish laser/beauty salon needs

> **Scope.** This is the PRODUCT requirements record for the Turkish beauty vertical —
> laser hair removal, skin treatments, and the course-based businesses that look like them.
> It is not the localization plan ([TR_LOCALIZATION_PLAN.md](TR_LOCALIZATION_PLAN.md), which
> covers language/currency/timezone infrastructure) and not the company roadmap
> ([ROADMAP.md](ROADMAP.md)).
>
> **Status legend:** ✅ shipped · 🟡 built, not yet reachable · 🔵 planned · 💡 future · ⛔ deliberately not doing

---

## 1. Why this vertical is different from a barbershop

salOWN was built for a business that sells a **single transaction**: someone books, comes,
pays, leaves. A Turkish laser salon sells a **course** — eight sessions bought up front, paid
over weeks, delivered over months, at intervals a clinician recommends.

Three things break when you point a booking product at that business:

| Barbershop assumption | Course reality |
|---|---|
| The appointment IS the commercial unit | The appointment is one delivery against an agreement made months ago |
| Money resolves once, at checkout | Money arrives in an unknown number of instalments |
| A missed appointment is a lost slot | A missed session is a client drifting out of a course they already paid for |

The third is the expensive one, and it is what TR-C exists for: in this market the salon has
**already been paid**, so a client who quietly stops coming is not just lost revenue — it is
an unfulfilled obligation, a refund risk, and in Turkey a very common consumer complaint.

## 2. The eight operational questions

A Turkish salon's front desk is asked these all day. The product must answer every one
without anybody opening a spreadsheet.

| # | Question | Answered by | Status |
|---|---|---|---|
| 1 | Which session is this? | `TreatmentSession.sessionNumber` + `package.ordinal` | ✅ TR-C |
| 2 | How many sessions remain? | TR-B `counters.remainingSessions`, read-only in TR-C | ✅ TR-B/TR-C |
| 3 | When did they last attend? | `ClientContinuity.lastAttendedAt` | ✅ TR-C |
| 4 | Did they miss the latest appointment? | `MISSED_LATEST_APPOINTMENT` | ✅ TR-C |
| 5 | Have they missed the last three? | `MISSED_LAST_THREE` (threshold is policy, not a literal) | ✅ TR-C |
| 6 | Are they overdue for the next treatment? | `OVERDUE_FOR_NEXT_SESSION`, in tenant timezone | ✅ TR-C |
| 7 | Which clients are likely to stop attending? | **See §3 — answered honestly, not predictively** | ✅ TR-C |
| 8 | Who should staff follow up with today? | `FOLLOW_UP_RECOMMENDED` + the Recovery workspace | ✅ TR-C |

## 3. Question 7 deserves its own section — what salOWN will and will not claim

The brief asked for "which clients are likely to stop attending". salOWN answers it with
**observations, never predictions**, and this is a locked product decision.

**What ships:** flags that state what did or did not happen — no future appointment, missed
the last one, missed the last three, overdue, package sitting unused. Each carries its
evidence (counts, dates, the session ids it was computed from). The strongest phrase in the
product is **"Follow-up recommended"**.

**What does not ship, and why:**

- ⛔ **A churn score or "at risk" label.** salOWN has no model, no validation set and no
  ground truth. A number on a screen is acted on as if it were knowledge; a salon would ring
  the wrong people and, worse, *stop* ringing the people the score scored low.
- ⛔ **"This client will not return."** It is unfalsifiable at the moment it is shown and it
  is often wrong — the most common reason a Turkish client pauses a laser course is
  pregnancy, illness or a holiday, all of which end.
- ⛔ **Any medical or diagnostic framing.** salOWN is a booking and operations product. It
  stores no diagnosis, captures no clinical consent and makes no treatment claim, so no
  string may imply one.

These are enforced, not merely intended: `treatments.dictionary.test.ts` fails the build on
predictive or clinical vocabulary in **both** English and Turkish, and
`treatmentContinuity.test.ts` asserts no flag code matches `/CHURN|WILL_NOT|LOST|RISK|PREDICT|LIKELY|DIAGNOS/`.

> If a predictive feature is ever wanted, it arrives as its own package with a stated model,
> a measured error rate, and copy that says how confident it is. It does not arrive as a
> quietly renamed flag.

## 4. Requirements by area

### 4.1 Session lifecycle — ✅ LIVE (`d9856e5`, 2026-07-31)

Nine operational states, server-authoritative transitions, audited history, entitlement
effects handed to TR-B. Full design: **[SESSION_LIFECYCLE.md](SESSION_LIFECYCLE.md)**.

Turkish-market specifics baked in:
- **No-shows burn the session** by tenant policy (`noShowConsumesSession`) — Turkish laser
  salons overwhelmingly do this. Default is off; each salon switches it on deliberately.
  TR-C and TR-B read the SAME stored field, so they cannot disagree about what it costs.
- **A no-show is correctable — as an ATTENDANCE record.** The client who turns up twenty
  minutes late is normal here, and an uncorrectable absence record becomes the thing a
  consumer dispute is argued from. The entitlement is NOT restored: TR-B treats that
  decision as final, so *absent → corrected → completed* burns exactly one session. A salon
  that wants to be generous makes a deliberate package adjustment with its own ledger row.
- **Cancelling in good time is never counted as a miss** — the behaviour the salon wants.

### 4.2 Packages, instalments and the open account — ✅ LIVE (TR-B `c3716f7`)

Owned entirely by TR-B (`packages/shared/src/treatmentPackage.ts`): append-only ledger,
payment plans (`FULL`/`INSTALMENTS`/`PER_SESSION`/`OPEN`), partial payments, the
reconciliation invariant, entitlement counters.

TR-C reads it through one narrow interface and writes none of it. See
[SESSION_LIFECYCLE.md §2](SESSION_LIFECYCLE.md#2-the-ownership-split-with-tr-b--the-single-most-important-thing-in-this-document).

### 4.3 Client recovery — ✅ LIVE

Deterministic queue, filters, follow-up outcomes, one follow-up record per client
(structurally), `do_not_contact` as a one-way door for staff.

**Messaging: ⛔ nothing automated.** No provider is configured and, more importantly, no
lawful basis exists: consent to an appointment reminder does not extend to a win-back
campaign. Under **KVKK** a commercial electronic message needs an explicit consent record
(and, for the Turkish market, İYS registration). The UI offers `tel:` links and
copy-to-clipboard; a human contacts the client and records the outcome.

> 🔵 **To unlock automated follow-up:** İYS-registered sender + explicit marketing-consent
> capture on the client record + per-message audit. Own package, not a flag.

### 4.4 Localization — ✅ TR-A (`424747d`), extended by TR-C

TR-C adds a fully translated `treatments` namespace (EN complete fallback, TR complete) and
uses TR-A's tenant `presentation` for **every** date, time and money rendering. Day
arithmetic uses `tenantDateKey`, so "overdue by 3 days" means the same thing on an Istanbul
phone and a London laptop.

### 4.5 Payments — 🔵 open, and a real blocker for the market

**Stripe does not onboard Turkey-resident businesses.** A genuine TR launch needs a
TR-resident PSP (iyzico / PayTR) or TR tenants stay on pay-at-venue + manually recorded
package payments (which is what TR-B builds). This is a commercial dependency, not a code
one. See [TR_LOCALIZATION_PLAN.md](TR_LOCALIZATION_PLAN.md) §3.3.

### 4.6 KVKK — 🔵 open, and it gates two features

Not started (`TR_LOCALIZATION_PLAN.md` §3.6). It currently blocks:

- **before/after treatment photographs** — special-category data under KVKK art. 6 / UK GDPR
  art. 9. Deliberately deferred by TR-C rather than shipped-and-disabled; the four
  preconditions are listed in [SESSION_LIFECYCLE.md §Media](SESSION_LIFECYCLE.md#media--beforeafter-photographs-are-deferred-not-designed-and-disabled).
- **automated marketing messages** — see §4.3.

### 4.7 Multi-location — 💡 future, but the seam exists now

Turkish beauty chains are commonly multi-branch. `TreatmentSession.locationId` and
`RecoveryFilter.locationId` ship **now**, always present and `null`, so adding locations
later is a backfill rather than a schema change mid-flight. The filter already works.

### 4.8 No parsers — ✅ locked decision (owner, 2026-07-23)

No Turkish tenant uses the Booksy/Fresha/Treatwell email-parser pipeline. salOWN is the
single booking source of truth for this market; tenants who keep another calendar get the
one-way iCal feed (`salownIcalFeed`). See [TR_LOCALIZATION_PLAN.md](TR_LOCALIZATION_PLAN.md).

## 5. What a TR pilot salon can do today vs. after Phase 2

| | Live today (`d9856e5`) |
|---|---|
| Track a session course | ✅ |
| See who missed their last three | ✅ |
| Work a follow-up queue | ✅ |
| Record a package sale, instalments and payments | ✅ TR-B |
| See a client's outstanding balance in the recovery queue | ✅ read-only from TR-B |
| Take a card payment online | ❌ no TR-resident PSP — §4.5 |
| Store before/after photos | ⛔ deferred — KVKK art.6 / UK GDPR art.9, §4.6 |
| Send an automated win-back | ⛔ by design — no lawful basis, §4.3 |

### 5.1 TR-B demo UX gaps still open (recorded, not claimed complete)

TR-B shipped its engine and panel, and reported these as **still outstanding**. They are
listed here so the market record does not imply a completeness the product does not have:

- **Package selection in `NewBookingSheet` / walk-in flow** — a session can be redeemed from
  the Packages screen and the Staff App sheet, but not yet while taking a booking.
- **Custom-instalment UI** — the engine supports arbitrary schedules; the panel currently
  offers the generated ones.
- ~~**Finance / Reports package-revenue policy + integration**~~ — ✅ **CLOSED by TR-B2 Stage 1**
  (`c5bd1dc`, 2026-07-31). The policy is decided and shipped: cash received, delivered/earned
  value, outstanding, deferred, accrued and refunds are reported **side by side and never
  summed**, on a Reports tab — not Finance, which is gated to one UK tenant and can never be
  opened by a Turkish salon. See [TREATMENT_PACKAGE_SYSTEM.md §16](TREATMENT_PACKAGE_SYSTEM.md).
  ⏳ Package accounting is live in Reports for package-enabled tenants. The legacy Finance page remains Whitecross-specific; making Finance tenant-generic is a separate TR-D/platform task.

## 6. Open questions for the owner

1. **Default no-show policy for TR tenants.** TR-C defaults `noShowConsumesSession` to
   `false` (nothing is burnt unless switched on). Turkish market practice is the opposite.
   Should the `tr-demo` seed — and future TR onboarding — default it to `true`?
2. **Recommended-interval source.** TR-C falls back to `defaultIntervalDays: 28` when neither
   the package nor the clinician states one. Should the package *definition* carry a
   mandatory interval, so the fallback is never reached in practice?
3. **PSP decision.** iyzico vs PayTR vs pay-at-venue-only for the pilot. Blocks nothing in
   TR-C; blocks a real commercial launch.
