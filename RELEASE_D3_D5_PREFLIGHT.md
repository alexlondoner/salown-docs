# Release preflight — D3 + D5 (refunded deposits at the till)

Status: **RELEASED 2026-09-10 with the owner's explicit approval.** `hosting:salown`
version `2c8cc94f29a0ccad` → **`e2b8af15cd701ba4`**. Live bytes byte-verified against the
pinned build. **Behaviour is LIVE_UNPROVEN** — see §7; there is no production booking
carrying a refund to exercise it.
Prepared by `alish/connect-prepaid-d`, 2026-09-10. This document does not authorise
anything; it exists so the decision can be made on measured facts rather than on a
summary.

## 1. What is being asked for

One deploy, one target: **`hosting:salown`**. Nothing else. No functions, no rules,
no indexes, no staff bundle, no whitecross-site.

## 2. What actually changes for a user

| commit | change | live effect |
|---|---|---|
| `3a02620` | D3 — the Admin till's `DEPOSIT` branch nets a recorded refund | **Real.** A refunded web deposit stops being credited in full. |
| `c10be71` | D5 — a refund counts without a `paymentProvider` field | **Real, and this is the one that reaches the population.** D3 alone covered 5 of 25 exposed bookings; D5 covers the other 20. |
| `d9329a2` | A+ — `SALOWN_CONNECT` is a webhook-verified rail | **Inert.** `features.stripe` is OFF for every tenant and no live Connect payment exists. It ships because it is in the same file, not because it does anything yet. |

Nothing else in the bundle moved: no other source file was touched by this work.

**Exactly one behaviour changes:** a booking that carries `refundedAmount > 0` and a
webhook-written `stripeAmountPaid` now presents the NET prepaid at the desk instead of
the original amount. Every booking without a recorded refund is byte-identical — pinned
by 41 regression tests that pass both before and after the change.

## 3. Blast radius, measured not estimated

Read-only census of `tenants/whitecross/bookings`, 2026-09-10 (positive controls run on
the same query path, so the zeros are real):

- bookings with `refundedAmount` set: **0**. No existing document changes its answer.
- bookings on the external Stripe rail (`stripeAmountPaid > 0`): **88** — 63 `FULL/PAID`, 25 `DEPOSIT`.
- the 25 DEPOSIT rows are the population that becomes correct on the *next* refund.

So this release cannot restate a single settled sale. Its whole effect is forward.

## 4. Why it is worth releasing at all, given zero affected rows

Because the mechanism is live and has fired. `stripeWebhook` logged a real
`charge.refunded` on **2026-08-30** — £10, `REFUND_MANUAL_DETECTED`, `refundOrigin:
STRIPE_DASHBOARD`, booking `WEB-1788048932037-b89caf` — and `tenants/whitecross/auditLogs`
carries the matching entry. That booking was deleted afterwards rather than checked out,
which is the only reason nobody was mis-billed. The rail took a live `cs_live` DEPOSIT
booking at 11:42 on 2026-09-10. The salon refunds by hand in the Stripe dashboard.

The shape that is not self-limiting has simply not happened yet: a **partial** refund on
a booking that stays `CONFIRMED` and is then attended.

## 5. Live identities — rollback is by VERSION ID

| | value |
|---|---|
| site | `salown` (project `havuz-44f70`) |
| current live version — **THIS IS THE ROLLBACK TARGET** | `2c8cc94f29a0ccad` |
| current live release | `1788970434073000` (2026-09-09T16:13:54Z) |
| current live bundle | `/public-bundle/assets/index-DpGhxvDe.js` |
| current live bundle sha256 | `196cb27e87abf063b21912f174811d9d2d725287e36dbfd5050587d0a93f99c9` |
| source commit to release | `c10be71` (or `5ec1c7b`, identical source; the later commit is claim bookkeeping) |

Rollback is Console → Hosting → site `salown` → Release history → version
`2c8cc94f29a0ccad` → ⋮ → Roll back. `hosting:clone` is **not** a rollback tool.

## 6. Preflight, in order

1. `git fetch --prune`; confirm salown-app `0/0` and a clean tree. Codex's three
   untracked `checkoutProjectionParity` files are expected and **must not be committed
   or removed** — they belong to `C2B-B0-PARITY`.
2. Build and deploy from an **isolated `git archive` workspace pinned to the commit**,
   never from the shared repo. The tree is shared with several sessions.
3. REL-1: a `hosting:salown` deploy runs the *staff* target's predeploy hook and dirties
   tracked `hosting/staff-bundle/**`. Clean it with explicit paths afterwards —
   never `git restore .`
4. Record the before/after version id for **all** sites, so an accidental second target
   is visible.
5. Re-run Codex's zero-caller measurement for `salownCheckoutBooking` if a functions
   deploy is ever added to this release. It is **not** part of this one.

## 7. Verification after the deploy

⚠️ **This change has no string marker.** It is a predicate, and minification renames it,
so `grep`-ing the live bundle for a function name proves nothing. Verify these two ways:

1. **Artifact identity.** Read the path the page actually loads
   (`curl -s https://salown.com/app | grep -oE 'src="[^"]*index-[^"]*\.js"'`), confirm it
   returns **200** as its own step, then compare its sha256 to the locally built file.
   A wrong URL yields the empty-string hash
   `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`, not a plausible one.
2. **Behaviour.** There is no production booking to test against — zero rows carry
   `refundedAmount`. So the honest options are: accept that the live check is deferred
   until the next real refund, or create and refund a test booking deliberately. **Do not
   claim live verification without one of those.**

## 8. Sequencing against the GTM A3 rules release — ⚠️ NOW ONE-WAY

**This section was written before the release and its conclusion has since been
overturned by measurement. Read all of it; the first half is still true and the second
half is why it no longer decides anything.**

`alish-8a` holds `CHECKOUT-SERVER-AUTHORITY` and is awaiting owner approval for a
`firestore:rules` deploy carrying `coaNotOverAllocated`. It warned that landing rules
first would make a pre-D3 till fail the write.

**Measured, and it does not hold on the writer path.** Driving the real
`resolveCheckoutOverAllocation` and `resolvePrePaidAmount` over the £40-sale/£10-refunded
case: pre-fix the till credits £10 too much and therefore collects £10 too little, so
`claimed` (30) lands *below* `owed` (40) and COA — which is over-direction only, by its
own contract — returns `false`. Post-fix, `claimed` 40 = `owed` 40, also `false`. The
2026-08-30 double-count, by contrast, returns `true` (claimed 64 vs owed 32).

COA guards the double-count direction; D3/D5 guard the under-count direction. **No
sequencing constraint between the two releases from this mechanism.** That result is on
the browser writer path; the rules half recomputes over the stored document and its owner
has been asked to run the same four rows against the rules suite.

## 9. What this release does NOT do

- It does not fix `whitecross-site/barber-mobile/app.js` (D4, `dacefe56`). Separate deploy
  unit, separate decision, and that target's actual staff usage is **unverified**.
- It does not close package D. The writer-level rows — webhook idempotency, refund-before-
  capture ordering, `paidAmount + prepaid == sale total` — are untouched, and no
  connected-account test-mode rehearsal has run.
- It does not enable Stripe anywhere.

### 8b. The hazard is on the OTHER side of the fix (measured by `alish-8a`, 2026-09-10)

My correction above was right and incomplete. A *pre*-fix till is never denied — COA is
over-direction only. But the **corrected** writer can be, and on exactly the population
D5 exists for. `alish-8a` ran the four rows against the live-candidate ruleset on a real
emulator, before amending anything:

| row | document | writer | verdict |
|---|---|---|---|
| A | provider ABSENT + `stripeAmountPaid`, fully refunded | pre-D5 | ALLOWED |
| B | same document | **post-D5** | **DENIED** |
| C | same, partial refund | **post-D5** | **DENIED** |
| D | provider `EXTERNAL_CHECKOUT`, fully refunded | post-D3 | ALLOWED |
| E | provider ABSENT, no refund | any | ALLOWED |
| F | provider ABSENT, refunded, no `platformDepositAmount` | post-D5 | **DENIED** |

Cause: the rule's `coaStoredPrepaid_p` mirrored `resolvePrePaidAmount` as of 2026-09-07,
whose refund branch keyed on `paymentProvider == 'EXTERNAL_CHECKOUT'`. With the provider
absent it falls through to the stored `platformDepositAmount` and credits the refunded
£10. The corrected writer nets it to 0 and collects the full £40, so
`paidToday 4000 + rule-derived prepaid 1000 = 5000 > 4000` — over-allocated, denied.
It is the D5 census hole one layer down: not the rule missing a defect, **the rule
refusing the fix**.

**Because the hosting half is now LIVE, this is no longer a sequencing choice.** An
unamended `firestore.rules` deploy would go straight into the DENY state for every
checkout of a refunded provider-less deposit. `alish-8a` has amended the rule inside its
own claim (`coaAuthoritativeRefund` mirroring `hasAuthoritativeRefund`, `coaVerifiedRail`
carrying both rails, refund branch only, `PAY_AT_VENUE` still refused) with 22/22 pinned
including a mutation control that reproduces the DENY. **Nothing rules-side is deployed.**

Verified independently, 2026-09-10, on the live ruleset
`projects/havuz-44f70/rulesets/a0a10819-3b62-46d5-9f95-9ea048701c59` (updated 2026-08-30):
`coaNotOverAllocated`, `coaStoredPrepaid`, `coaVerifiedRail`, `OverAlloc`,
`refundedAmount`, `stripeAmountPaid`, `platformDepositAmount` — **all absent**. No COA
constraint is live, so nothing at the till can be denied by it today.

### 8c. Scope limit on the census — stated because a second party now depends on it

The 20-of-25 figure is **tenant-scoped to whitecross**. The query was
`tenants/whitecross/bookings` and nothing else. herohairs and any other tenant were **not
measured**, and the ratio is not verified platform-wide. The rules half is platform-wide,
so "the provider field is usually absent" is a demonstrated property of whitecross and an
unmeasured assumption elsewhere.
