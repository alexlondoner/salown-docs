# Release plan — `CHECKOUT-TIP-PREPAID` + `ADMIN-CHECKOUT-CONCURRENCY` + `CHECKOUT-REVISION-GUARD` (Admin)

**Status: AWAITING OWNER APPROVAL. Nothing in this document has been executed.**
Scope approved by the owner 2026-09-19: *"mevcut canlı + tip ve transaction düzeltmesi; diğer dokuz commit kapsam dışı"*.
Deploy approval is a **separate** decision and has not been given.

- **Target:** `hosting:salown` (Admin panel + landing) — **one site, nothing else**
- **Source:** `release/admin-tip-concurrency-on-live-503bdff` @ **`2957fdf`**
- **Base:** live Admin source **`503bdff`**, proven below to be exactly what is serving
- **Staff is NOT in this plan.** The Staff release comes from the Welcome Offer session's combined
  candidate (`release/staff-loyalty-welcome-on-live-76e58fe`, built on `8456b1d`) and is theirs to plan.

---

## 1. What this release changes

Three commits, all `[skip ci]`, on top of the live Admin source:

| SHA | What |
|---|---|
| `53c88fd` | **Percentage tip is a percentage of the visit, not of the remaining balance.** On a fully pre-paid booking all four presets collapsed to £0.00 — live controls whose only possible answer was zero. On a £10 deposit, 20% offered £4.40 instead of £6.40. |
| `158923f` | **One checkout applies once.** The booking stamp and the client's loyalty/stats move in a single `runTransaction` with a compare-and-set, and the `catch` that logged `Client update failed (non-critical)` and swallowed the error is gone. |
| `2957fdf` | **The guard no longer depends on a clock.** A monotonic `checkoutRevision` replaces the millisecond-resolution `checkedOutAt` comparison. |

### Why the tip number changes, and why it is not a new policy

`subtotal` is byte-identical between live `503bdff` and the candidate:
`max(0, startingTotal - discountAmt - pointsApplied + serviceCharge)`. `resolveTipBase` is that same
expression with **one term removed**. The money order (discount → redeemed points → service charge)
is untouched and `total = subtotal + tip` is unchanged. £6.40 → £4.40 falls out of the **existing**
rule; no pricing or tipping policy was introduced.

### The new stored field

`checkoutRevision` (integer) is written to a booking on every checkout. It is **absent** on every
pre-existing booking, which reads as `0`, so a first checkout expects `0 → 1`.
**No migration and no backfill.** Nothing reads the field except the guard itself.

---

## 2. Pre-release verification — COMPLETED 2026-09-19, read-only

Both checks the owner required, performed in an authorised environment
(`gcloud` + Firebase CLI 15.26.0 as `whitecrossbarbers@gmail.com`). **No rules were deployed.**

### 2a. Live ruleset agreement ✅

| | |
|---|---|
| Live Firestore ruleset | **`5e102dd4-e7e7-4950-b12a-14a74daa82e8`**, released 2026-09-10T13:39:16Z, 79,060 bytes |
| Versus repo `firestore.rules` | **byte-identical** (whole-file diff, trailing whitespace normalised) |
| Method | `GET firebaserules.googleapis.com/v1/projects/havuz-44f70/releases` then `…/rulesets/{id}`, with an `x-goog-user-project: havuz-44f70` header |

The live bookings `allow update` arm reads:

```
allow update: if a1UpdateWithinWindow(tenantId)
  && coaNotOverAllocated()
  && !…affectedKeys().hasAny(['loyaltyPromotionSnapshot']) && (
  isSuperAdmin() || isTenantAny(tenantId) || (
  … request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['status','rescheduledTo','cancelledAt','cancelReason',
                'date','time','startTime','endTime','rescheduledAt',
                'barberName','barberId','updatedAt'])
));
```

**Consequence for this release:** an authenticated till takes the `isTenantAny` arm, which
short-circuits **before** the `hasOnly([...])` allow-list. That allow-list governs only the
anonymous customer branch (cancel/reschedule links). So the new `checkoutRevision` key **cannot be
refused for being a new field**, and the three above-the-branch guards
(`a1UpdateWithinWindow`, `coaNotOverAllocated()`, the snapshot ban) are untouched by it.
This was also exercised end-to-end in the emulator against these same rules with a real signed-in
`staff` user. **No rules change is required by this release.**

> ⚠️ Records corrected while doing this: several docs named `a0a10819-…` as the ruleset "live today".
> That id was superseded on 2026-09-10. Corrected in `CLAUDE.md`, `SYSTEM_ARCHITECTURE.md`, `INCIDENTS.md`.

### 2b. Live hosting has not drifted ✅

| | |
|---|---|
| Live `salown` version | **`3d090f91a64cea18`**, release `1789679753178000`, 2026-09-17T21:15:53Z, by `whitecrossbarbers@gmail.com`, 122 files |
| Matches ledger row | **`R-2026-09-17-B`** records exactly this version + release id |
| Releases since | **none** |
| Served bytes vs the base | `git archive 503bdff` + `vite build` compared file-by-file against `https://salown.com/public-bundle/`: **55 identical / 55, 0 differ, 0 missing** |
| Base build reproduces the live asset name | **`index-DYUKBSbN.js`** exactly (Vite's filename hash is content-derived) |

So production is serving precisely the candidate's base, with **no unrecorded deploy** in between.

**Negative control for this release** — `hosting:salown-staff`, which must NOT move:
version **`4c0ce013b1e45dfa`**, release `1789679980588000` (2026-09-17T21:19:40Z).

---

## 3. Candidate gates already run

| Gate | Result |
|---|---|
| `tsc --noEmit` | **0 errors** |
| Five mocked writer suites | **113 / 113** |
| `scripts/adminCheckoutWriter.emulator.test.ts` (real Firestore+Auth emulator) | **5 / 5** |
| Negative control — remove the counter check | frozen-clock case **FAILS at 442** (232 expected) |
| Negative control — remove the timestamp check | all 5 still **PASS** |
| Release artefact built from `git archive 2957fdf` | `index-DHeEezw7.js`; carries `CHECKOUT_ALREADY_APPLIED` + `checkoutRevision`; **0** hits for `EMULATOR MODE` / `demo-staffloyalty` / `connectFirestoreEmulator` |

The emulator suite refuses to start unless the client SDK is demonstrably pointed at the emulator,
so it cannot write to production.

---

## 4. Out of scope — deliberately

**Nine Admin-shipped commits on `main` that this candidate does NOT contain.** The candidate is cut
from the *live* source, not from `main`, so releasing it ships live + the three fixes and **not** these:

```
9a4925c  fix(finance)   FIN-PROCESSOR-FEES B2a — refund summary per Stripe payment
74922bd  feat(finance)  FIN-PROCESSOR-FEES B2 — Stripe fee reader + booking-detail fee block
aa2efd9  WALKIN-BACKDATE-FLOOR — remove untouched-time Save & Checkout 09:00 floor
a7b1f33  fix(staff-avail-gap-p2) — stale WalkInFlow boundary test
261fed1  fix(reports)   passive staff drop off Insights → Barbers
9ea0aca  feat(staff)    Walk-in server policy gate
631b768  fix(staff)     correct owner-required toast
a7c79f3  fix(staff)     override-reason prompt owner-only
da44310  STAFF-AVAIL-GAP-P1 — New Booking server-side enforcement (NOT DEPLOYED)
```

Also **not** touched: `hosting:salown-staff`, any Cloud Function, `firestore.rules`,
`firestore.indexes.json`, Stripe settings, tenant data. No production write, no synthetic booking,
no customer message, no real customer points spent.

---

## 5. Release procedure

### Step 0 — claim and re-baseline (no existing claim covers a hosting release)

1. Take a release claim naming `hosting:salown` and this plan; push it to `main` (`[skip ci]`).
2. **Immediately before deploying**, re-read and confirm unchanged:
   - `salown` live version is still `3d090f91a64cea18` / release `1789679753178000`
   - `salown-staff` live version is still `4c0ce013b1e45dfa`
   - live ruleset is still `5e102dd4-e7e7-4950-b12a-14a74daa82e8`
   - `origin/release/admin-tip-concurrency-on-live-503bdff` is still `2957fdf`
   If any has moved, **stop** and re-plan. A moved baseline means someone released in between.

### Step 1 — isolated release workspace (never the main repo, never CI)

```bash
WS=$(mktemp -d)
git -C <clone> archive origin/release/admin-tip-concurrency-on-live-503bdff | tar -x -C "$WS"
cd "$WS" && npm ci
npx vite build          # expect assets/index-DHeEezw7.js
```

The workspace is an extracted tarball with **no `.git`**, which is why the deploy cannot dirty the
real repository.

> **REL-1 does not apply to this release.** Both `hosting[]` `predeploy` hooks fire regardless of
> `--only` (known CLI quirk), so `build:staff` will run and rewrite `hosting/staff-bundle/` — but
> only *inside the ephemeral workspace*. `hosting/public-bundle/` has **0** tracked files and
> `hosting/staff-bundle/` has 25, none of which exist in a git working tree here. No cleanup step,
> and no `git restore` of build artefacts, is needed. Only `hosting[salown]` may finalize/release;
> `hosting[salown-staff]` must never be uploaded — verify that in the CLI output.

### Step 2 — deploy, one target

```bash
cd "$WS"
npx firebase deploy --only hosting:salown --project havuz-44f70 --non-interactive
```

Record the new version id and release id from the output.

### Step 3 — verify the artefact actually reached production

1. Read the path the app really loads — **do not guess it**:
   `curl -s https://salown.com/app | grep -oE 'src="[^"]*index-[^"]*\.js"'`
   → must be `/public-bundle/assets/index-DHeEezw7.js`.
2. Confirm `200` separately: `curl -fsI https://salown.com/public-bundle/assets/index-DHeEezw7.js | head -1`.
   A wrong URL returns Firebase's **HTML 404 page**, whose hash looks plausible; `curl -f` empties the
   body instead, so a wrong URL yields the empty-string hash
   `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. Seeing that means you hashed
   nothing — go back to step 1.
3. Compare **all 55 files** under `/public-bundle/` against the workspace build, by sha256.
   Expect **55/55 identical, 0 differ, 0 missing**.
   ⚠️ Compare against **the workspace you deployed**, not against the old live set: Vite re-hashes the
   whole graph, so 27 chunk filenames legitimately change. A filename-level comparison with the
   previous release would look like total drift and must not be used as a rollback trigger.
4. Marker strings in the served `index-*.js`:
   - **present:** `CHECKOUT_ALREADY_APPLIED`, `checkoutRevision`
   - **absent:** `Client update failed` (the old swallow), `EMULATOR MODE`, `demo-staffloyalty`
5. Negative control: `salown-staff` version still `4c0ce013b1e45dfa`; live ruleset still `5e102dd4-…`.

### Step 4 — owner live test (what can and cannot be tested in production)

**Can be tested, on a real booking:**
- A **pre-paid** booking's tip presets now offer a percentage of the visit, not £0.00.
  On a £32 visit with a £10 deposit, 20% should read **£6.40**.
- A normal checkout still completes and collects the correct remaining amount.
- A legitimate **re-checkout correction** of a finished sale is still accepted.
- Manual tip entry, deposit and unpaid flows unchanged.

**Must NOT be tested in production:** the double-application guarantee. Proving it requires firing
two concurrent checkouts at one real booking, which risks a real customer's balance. That property is
emulator-proven (two concurrent first checkouts, lost-response retry, two concurrent corrections,
and the frozen-clock pair) and is deliberately left unexercised against live data.

### Step 5 — records, same session as the deploy

- `RELEASE_LEDGER.md`: new row with source SHA `2957fdf`, previous→new live version, the verification
  result, exclusions, and the **rollback identity** below.
- `INCIDENTS.md` 2026-09-18 entry: the status may move off **FIX READY, OPEN IN PRODUCTION** only
  after step 3 and step 4 pass, and only for the Admin surface — Staff stays open until its own release.
- `ROADMAP.md`: `CHECKOUT-TIP-PREPAID` and the concurrency work → `LIVE_VERIFIED` with today's date.
- Release the claim; leave a clean tree.

---

## 6. Rollback

| | |
|---|---|
| **Rollback identity** | `hosting:salown` version **`3d090f91a64cea18`** (release `1789679753178000`) |
| **How** | Firebase Console → Hosting → site `salown` → Release history → that version → ⋮ → Roll back. `hosting:clone` is **not** a rollback tool; it takes `siteId:channelId`, not a version id. |
| **Then verify** | Re-read the served asset path and confirm it matches that version's own build — the same method as step 3, not an assumption. |
| **Data** | Nothing to undo. `checkoutRevision` is additive; bookings written under the new bundle simply carry an extra integer that the old bundle ignores. A rolled-back till reverts to the old guard, so the concurrency defect returns — that is the cost of rollback, and it is why the incident stays open until this release is verified. |

---

## 7. Open items, stated rather than buried

- **`main` is ahead of live** in ways unrelated to this work (the nine commits in §4). Bringing them
  live is a separate, unplanned decision.
- **Merging this candidate to `main`** would trigger the CI Admin deploy unless the merge carries
  `[skip ci]`. This plan does not merge to `main`.
- **Staff** remains defective in production until the Welcome Offer session's combined candidate
  (`602c7b9`, which has `8456b1d` as an ancestor and carries the same writer guard) is released.
- **The Admin till still burns loyalty points on a fully pre-paid checkout with no compensation**
  (recorded 2026-09-18, 🔴 Open, production reach unmeasured). Not fixed here, not in scope.
