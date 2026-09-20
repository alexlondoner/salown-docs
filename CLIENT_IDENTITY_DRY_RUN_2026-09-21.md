# Client Identity — Phase A dry run (READ-ONLY)

**Date:** 2026-09-21 · **Status:** MEASURED — nothing applied, nothing deployed, no production write
**Candidate:** `wip/client-identity-p1-rebuild` @ `8b2515d` (salown-app)
**Plan:** [CLIENT_IDENTITY_MERGE_PLAN.md](CLIENT_IDENTITY_MERGE_PLAN.md) §11 Phase A
**Tools:** `scripts/clientIdentityDryRun.cjs` (new) · `scripts/clientStatsReplay.cjs`
**Tenants surveyed:** `whitecross`, `herohairs` — Firestore REST **GET only**

This report exists so Phase C is authorised against measured numbers rather than against the
design's expectations. Two of those expectations turned out to be wrong, and both change the
order of work.

---

## 0. Baseline re-measurement

The plan's §0 table was taken on 2026-09-20. Re-measured a day later, it holds, with ordinary
drift:

| Fact | Plan (20 Sep) | Measured (21 Sep) |
|---|---|---|
| client docs | 471 | **473** |
| booking docs | 1,887 | **1,891** |
| bookings with no `clientManualId` | 1,769 (93.8%) | **1,773 (93.8%)** |
| …of those, `CHECKED_OUT` | 1,747 | **1,751** |
| clients with neither canonical field | 202 (42.9%) | **201 (42.5%)** |
| merged-away (`hidden` + `mergedInto`) | 2 | **2** |
| same-name hidden/visible collisions | 1 (Conrad Swift) | **1 (Conrad Swift)** |
| unmerged visible duplicate pairs | 5 by email, 1 also by phone | **5 by email, 1 also by phone** |

`herohairs`, never surveyed before: 136 clients, 426 bookings, 408 (95.8%) unlinked, 69 (50.7%)
uncanonicalised, **zero** tombstones and **one** duplicate pair.

---

## 1. FINDING — the relink reaches far less history than the plan assumes

§6 and §11 are written as though relinking is mostly a matter of running it. It is not.

| whitecross | bookings |
|---|---|
| already linked (L0) | 118 |
| **proposed auto relinks** | **701** — L2 448 · L3 210 · L4 39 · L5 4 |
| held for REVIEW (ambiguous) | 12 |
| **unreachable — no identity at all** | **1,060**, of which **1,043 are counted `CHECKED_OUT` visits** |

So of the 1,773 unlinked bookings, identity can reach **701 (39.5%)**. The remaining 1,060 carry
no email and no phone: they are the contact-less walk-in population, and **no** resolution rule
will ever reach them, because the only thing they carry is a name and L6 is locked shut.

`herohairs` is the opposite shape — 280 of 408 relinked, and only 5 unreachable counted visits —
which is worth recording: this is a whitecross data-history problem, not a platform property.

**Consequence.** The plan's sequencing note ("relink the whole collection *before* any stats
rebuild") is necessary but **not sufficient**. After a complete relink, whitecross history is
still 56% unreachable, so a rebuild is not a safe global operation there.

---

## 2. FINDING — an unconditional rebuild would destroy recorded money

The dry run projects, per client, what a rebuild would write after the proposed relinks, and
classifies the result:

| whitecross | clients |
|---|---|
| stats unchanged | 345 of 471 |
| **gain** — rebuild finds MORE history | 99 |
| **LOSS** — rebuild would write a SMALLER visit count or spend | **27** |

| herohairs | clients |
|---|---|
| stats unchanged | 135 of 136 |
| gain | 1 |
| **LOSS** | **0** |

A `loss` row is not a correction. It is the rebuild overwriting money the till really took,
because the history that justifies it is unreachable or is being held in review. Examples,
verified individually:

- `hzRuYGOrbhI7KTMd6aqE` "Daniel Smethurst" — stored 4 visits / £132. Projected **0 / £0**: his
  bookings carry `dansmethurst90@gmail.com`, which **two** visible client docs own, so the ladder
  correctly refuses to move them. 5 bookings held in review.
- `7snr3VnYsaiqbLQhKgBf` "Thomas Featherstone" — stored 5 / £153.60, projected 3 / £89.60. Part
  of his history is reachable, part is not.
- `6bAjPMnJslzeS6zb05Jk` "Whitecross Barbers LIMITED" — stored 2 / £84, projected 0. No contact
  identity at all.

**Consequence.** `rebuildStats` must be **gated per client**, not run as a collection sweep. The
gate is mechanical and already computed: a client whose projection is `loss` is not rebuilt until
either the review that blocks it is resolved, or the owner accepts the figure. This is the single
most important change this dry run makes to the plan.

---

## 3. The money fold is confirmed, on a much broader base than §10.2 asked for

§10.2 asked for a replay against **50 untouched clients**. Two independent runs:

**A — like-for-like (`clientStatsReplay.cjs`).** Compares ONLY clients whose history is already
fully linked, so it measures the fold and nothing else.

```
tenant: whitecross
compared: 17 of 50 requested      matched: 17      mismatch: 0
skipped:  hidden 2 · mergeTarget 2 · adjusted 38 · member 29
          unlinkedHistory 47 · noBookings 334 · statsNeverWritten 4
```

**17 is not a sample cap — it is the entire eligible population.** Re-running with `--limit 500`
returns the same 17, and `herohairs` contributes 0 (no client there has a fully-linked history).
The requested 50 is not reachable on live data, and saying so is more useful than widening the
eligibility rules until the number is met.

**B — post-relink reproduction (the new dry run).** Every client with written, non-zero stats,
rebuilt from the relinked history:

| tenant | clients with written stats | reproduced **exactly** | moved |
|---|---|---|---|
| whitecross | 433 | **320** | 113 (99 gain · 27 loss — §2 above) |
| herohairs | 134 | **133** | 1 (gain) |

**453 of 567 clients reproduce their stored lifetime spend to the penny** under the writer
contract. Every one of the 114 that does not is explained by §1 or §2 — reachability, not
arithmetic. The writer fold (`paidAmount + platformDepositAmount`, with the tenant Booksy deposit
as the fallback) is correct and may be adopted.

### 3.1 The £38 proof, and a correction to the plan

Plan §10.2 and §13 say the 29 August Booksy booking is £38 because it carries "one add-on". The
booking carries **no add-on**. Read-only, verbatim:

```
29 August 2026  BOOKSY-Conrad-Swift-29-August-2026   CHECKED_OUT  source=Booksy
  price="£32.00"  paidAmount=28  platformDepositAmount=10  addOns=null  loyaltyPointsEarned=38
  naive sum(price) = 32        WRITER fold (paid + prePaid) = 38
```

The £38 is `28` collected at the desk plus a `10` platform deposit settled before it — an
explicitly stored field, not the config fallback. The plan's **number is right and its reason is
wrong**, which matters because the stated reason would send a reader looking for an add-on field
that does not exist.

Rebuild over Conrad's two counted visits:

```
totalVisits 2   totalSpent 70 (WRITER)   vs 64 (naive Σ price)   loyaltyPoints 70
sum of the two stored documents today = 38 + 32 = 70   ✓
```

---

## 4. Review rows and duplicate suggestions

12 bookings (whitecross) and 2 (herohairs) are held for review. Every one is a
`>1 visible owner on one identity` row, i.e. the five live duplicate pairs.

Duplicate suggestions, all `review`, none auto-merged, none with ≥3 distinct names on one token
(so no shared-line "never-merge" case exists in either tenant today):

| token | clients |
|---|---|
| `em:dansmethurst90@gmail.com` | Daniel Smethurst (£132/4) · Dan Smethurst (£30/1) |
| `em:gerry.steele@gmail.com` | Gerry Steele (£90.80/4) · Gerry Steele (£0/0) |
| `em:kluidino@gmail.com` | Klyde Gironella (£0/0) · Klyde Gironella (£56/2) |
| `em:nmheilpern@hotmail.com` | Nigel (£30/1) · Nigel heilpwrn (£28/1) |
| `em:paul.kay@evolveuk.biz` + `ph:447970382133` | Paul Kay (£28/1) · Paul Kay (£96/3) |
| `em:aerulas@gmail.com` (herohairs) | AERULAS (£0/0) · Alex (£250/1) |

Three of the six pairs have an empty twin, which is the cheapest class of merge to approve.

**173 canonical stamps** (whitecross) and **69** (herohairs) are proposed — clients whose
canonical field is missing but derivable from the raw value. 28 whitecross clients have no
derivable identity at all and are permanently name-only.

---

## 5. Still open, and deliberately not done here

- **§7 Clients-list bug is NOT fixed.** `src/pages/Clients.tsx:254` still builds `hiddenKeys`
  from the hidden doc's **name**, so Conrad Swift is still invisible in the Clients list. The
  audience/report half of defect 11 IS fixed on the candidate (`buildAudience` and
  `canonicalBookingKeys` now carry hidden, alias and `mergedInto` edges); the page itself is not.
  It was left alone because it is outside the scope this session was given — it is the one
  remaining item of plan sequencing step 1.
- **Conrad repair is not applied** — see plan §13, unchanged except for §3.1 above.
- **No merge, relink, rebuild, backfill, migration or deploy was performed**, in either tenant.

---

## 6. What this changes in the plan

1. §11 Phase C gains a **per-client gate**: a client whose projection is `loss` is not rebuilt.
2. §6's relink is re-scoped: it is a 39.5% operation on whitecross, not a 93.8% one, and the
   contact-less remainder needs its own decision (leave stats as the writer left them, which is
   what the `loss` gate achieves by default).
3. §10.2's "50 untouched clients" acceptance test is replaced by the two-run form in §3 — the
   like-for-like run proves the fold, the post-relink run sizes the movement. The first cannot
   reach 50 on live data and should not be made to.
4. §13's add-on explanation is corrected.
