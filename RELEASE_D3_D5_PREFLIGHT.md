# Release preflight — D3 + D5 (refunded deposits at the till)

Status: **assembled and awaiting the owner's decision. NOTHING HAS BEEN DEPLOYED.**
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

## 8. Sequencing against the GTM A3 rules release

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
