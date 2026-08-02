# DEPLOYMENT_STATUS.md — what is live vs. what is only on origin/main

> **Role:** a point-in-time ledger of **deploy state** — the gap between "committed/pushed to
> `origin/main`" and "actually deployed and live-verified in production." It answers one question:
> *for a given commit, is the running system actually on it?*
>
> **This is not** the retrospective sync ledger (that is `salown-app/SYNC.md`), nor the plan
> (`ROADMAP.md`), nor path ownership (`salown-app/ops/claims/`). It exists because **push ≠ deploy**:
> `salown-app` `main` auto-deploys **hosting only** via GitHub Actions; **functions, rules, and the
> separate `whitecross-site` repo deploy manually**, so code can sit on `origin/main` for days while
> production runs older behavior. Confusing "merged" with "live" has caused real incidents.
>
> **Snapshot date:** 2026-08-02 (latest) — **`demo` checkout mode set to `tr`, CONFIGURATION ONLY, no deploy of any kind** (row directly below); the same pass corrected a stale claim in this file that `demo` had `checkoutSettings` ABSENT. Previous: 2026-08-02 — **TR-D1 Phase 3B deployed**: `hosting:salown` ONLY, a presentation-only settings-UX fix after the Phase 3 visual review failed (row directly below). No Function, no rules, no staff hosting. Previous: 2026-08-02 — **TR-D1 Phase 3 deployed and live-verified**: one NEW callable (`salownSaveCheckoutSettings`), `hosting:salown`, and the **first `firestore.rules` release since TR-A** (row directly below). `hosting:salown-staff` deliberately NOT deployed. Previous: 2026-08-02 (earlier) — **LOYALTY-RECEIPT-SALVAGE deployed and live-verified**: one Function updated (`salownSendLoyaltyEmail`) and both hosting targets released by CI (row directly below). Previous: 2026-08-02 — **TR-D1 Phase 2B deployed and live-verified**: ONE new callable, `salownCheckoutBooking` (row directly below). No hosting target, no rules, no existing Function revision changed. Previous: 2026-08-01 (later) — **TR-D1 Phase 0.5 deployed and live-verified**. Previous: **TR-B2 fully deployed and live-verified** (row directly below); no Function or rules revision changed. Previous snapshot 2026-07-31 ~16:3x UK — **TR-B is fully deployed and live-verified** (row directly below); TR-C Phase 1 remains pushed but deliberately NOT deployed. Previous snapshot 2026-07-31 ~15:5x UK. Previous snapshot 2026-07-31 01:5x UK — **three deploy waves have landed since the previous snapshot and this file now reflects them.** 2026-07-30 ~14:4x (Session A: ANY-BARBER + PUSH-RECOVERY + RECEIPT-WRITER), 2026-07-30 ~17:5x–18:1x (Session B: receipt READER + the remaining UK financial work), 2026-07-31 ~00:5x–01:4x (master closure: whitecross saas hosting + LC1 live chat). The previous revision of this line said *no deploy occurred* on 07-30; that was true when written and false within the hour. · 2026-07-27 15:05 UK after the Treatwell parser deploy + T2188888050 repair (previous: 12:55 UK after the whitecross test-mode lockdown deploy) (previous
> revisions: 2026-07-26 19:45 UK; 2026-07-24 16:40 UK after Parser-3C landed on `origin/main`; earlier
> 16:05 revision during BSP-H1, see the hosting-baseline correction below). Verify against `git log origin/main` + the live system before acting;
> a row here is a claim about a moment, not a standing guarantee.

---

## ⚙️ PRE-ADMIN-TR-CHECKOUT — `demo` checkout mode set to `tr` · **CONFIGURATION ONLY** 2026-08-02

**No deploy.** Not a code release and deliberately not one: **no Function, no hosting target, no rules,
no Staff bundle** changed, and `origin/main` is unchanged except for documentation. It is recorded here
anyway because it changes what production *resolves* for a tenant, which is exactly the
"committed ≠ live" gap this file exists to close — live behaviour can move without a deploy.

| Surface | State |
|---|---|
| Every Function | ⏸️ **unchanged** — no deploy issued |
| `hosting:salown` / `hosting:salown-staff` | ⏸️ **unchanged** |
| `firestore.rules` / indexes | ⏸️ **unchanged** |
| `tenants/demo/settings/settings.checkoutSettings` | ✅ **`mode: uk → tr`**, `schemaVersion` **1 → 2** |

Written through the deployed owner-authoritative callable **`salownSaveCheckoutSettings`** (not a direct
Firestore patch), authenticated as the `demo` tenant **owner**, under the real `expectedVersion: 1`
stale-version gate and strict validation. The submitted payload was `{ enabled: true, mode: 'tr' }` and
nothing else; the callable's top-level merge preserved every other stored field.

**Why:** `demo` presents as Turkish (`countryCode: TR`, `TRY`, `tr-TR`, `Europe/Istanbul`) but its
authoritative checkout mode still said `uk`, so the persistent Turkish sales demo was configured to
resolve UK checkout. The mode is a stamped label on the checkout intent and receipt, not a gate over
other fields, so nothing else had to move with it.

**Verified read-only after the save:** exactly **three** fields differ — `mode`, and the two the server
owns (`schemaVersion`, `updatedAt`); **43** stored fields are unchanged. `packageSettings` is
**byte-identical** (`sha256/16 40a4e26d0a7d0cc8` before and after), `paymentSettings` (PAY-1) is still
absent, and the settings key set is unchanged. **No booking, payment, receipt, loyalty award,
receivable, `checkoutIntent`, package definition, client package or package-ledger row was created** —
every count is flat; `auditLogs` `70 → 71` is the one expected `CHECKOUT_SETTINGS_SAVED` record.
`tr-demo`, `whitecross` and `herohairs` settings documents are byte-identical and untouched.

---

## 🧭 TR-D1 Phase 3B — regional disclosure on Payment Settings · **DEPLOYED** 2026-08-02

**Baseline commit `ecb6d93`** (`origin/main`). Production **is** on it.

Phase 3 shipped functionally correct and **failed the owner's visual review**: a UK tenant was shown
the entire Turkey-native checkout configuration with every irrelevant control merely *disabled*, which
made Settings a long, confusing wall. This release is the fix and is **presentation only**.

| Surface | State |
|---|---|
| `hosting:salown` | ✅ **released** — version **`34d390b1afb16bc9`**, `2026-08-02T20:29:09Z` (previous `2aed6e662d41ad1b`) |
| `hosting:salown-staff` | ⏸️ **NOT deployed** — still `8409e666da7ea223` |
| `salownSaveCheckoutSettings` | ⏸️ **unchanged** — `salownsavecheckoutsettings-00001-pic` |
| `salownCheckoutBooking` | ⏸️ **unchanged** — `salowncheckoutbooking-00001-taf` |
| `firestore.rules` | ⏸️ **unchanged** — ruleset `b30abf64-5515-4429-87f8-fafaa085af2c` |
| Every other Function / indexes | ⏸️ **unchanged** |

**Deployed command, verbatim:**
`firebase deploy --only hosting:salown --project havuz-44f70`

`[skip ci]` again, for the same reason as Phase 3 and one more: CI's `--only hosting` covers **both**
targets, and this release must not ship `salown-staff`.

### Scope was verified, not asserted

The diff touches `src/components/`, `src/i18n/dictionaries/` and nothing else. No file under
`functions/`, no `firestore.rules`, no `packages/shared/` — checked against `git status` before commit.
`src/pages/Settings.tsx` did not need to change at all: the Payments tab already held both cards.

### What a UK owner now sees

One line — *"In-salon checkout: GB — your current checkout remains active."* — and nothing else. No
Türkiye wall, no disabled debt fields, no POS instalment controls, no Salon Taksit Planı, no irrelevant
staff permissions, and **no invitation to configure TR-only functionality**.

The one case that is deliberately NOT hidden: a non-TR tenant with an **enabled** stored configuration.
That is a live policy the executor would honour, so hiding it would hide a financial setting from the
only person allowed to change it. It gets a warning, an inspect path and a switch-off action — and
nothing is discarded or rewritten. A saved-but-off configuration is reported without a warning.

### What a TR owner now sees

Summary first (status · region/currency · methods · balances), then **one** action: activate, or edit.
Sections appear only when they mean something — Card/POS when Card is on, provider and commission rows
when Kart Taksiti is on, receivable policy only once a debt capability exists, staff permissions
collapsed and filtered to the enabled methods. Version, contract version and resolver issues moved
behind **Technical details**, closed by default.

### The property that mattered while fixing it

**Hiding a control never changes a stored value.** A permission the screen no longer renders is still
submitted with its stored value; hidden provider commission terms survive turning Kart Taksiti off;
collapsing a section cannot mark the page dirty. The Save payload is byte-identical to the Phase 3
contract, and `saveCheckoutSettings(payload, storedVersion)` is the same call.

### Verification

Frontend **1229/1229** (was 1185; +44 disclosure tests) · typecheck clean · production build clean ·
**lint delta ZERO** (2377 both sides) · secret scan and `git diff --check` clean.

The deployed `Settings-DeAHVGgw.js` chunk is **byte-identical** to the local build and carries every
disclosure marker and both languages' new copy. The shipped decision table was executed across all five
tenant shapes: `GB`+none → `REGIONAL_COMPACT` (no detail form), `GB`+saved-off → `LEGACY_TR_DORMANT`,
`GB`+active → `LEGACY_TR_ACTIVE` (disable offered), `TR`+none → `TR_OFF`, `TR`+on → `TR_ON`.

Live on `tr-demo`: **Save still reaches the deployed callable** (version `1 → 2`), the stored document
is the unchanged Phase 3 shape, no booking / receivable / clientPackage / checkoutIntent /
finance_payment was created by editing Settings, `packageSettings` and `presentation` untouched, and
the tenant was **restored byte-exactly** with its synthetic owner doc removed.

> ✅ **Owner-confirmed on the live release**, 2026-08-02 — *"its fine i checked it"*. The Phase 3
> visual review that failed is now closed.
>
> Scope of that confirmation, stated so it is not read as more than it is: the owner reviewed the
> deployed page. Automated verification here is artifact-level and behavioural. **No 320/360/390/430
> width matrix was walked** — the Chrome extension was disconnected — so a narrow-width regression is
> not something this release is proven against.

---

## 💳 TR-D1 Phase 3 — private checkout Payment Settings · **DEPLOYED + LIVE-VERIFIED** 2026-08-02

**Baseline commit `8239620`** (`origin/main`). Production **is** on it.

| Surface | State |
|---|---|
| `functions:salown:salownSaveCheckoutSettings` | ✅ **created** — revision **`salownsavecheckoutsettings-00001-pic`**, `updateTime` `2026-08-02T18:05:54Z` |
| `functions:salown:salownCheckoutBooking` | ⏸️ **unchanged** — still **`salowncheckoutbooking-00001-taf`**. The Phase 2B executor was not rebuilt, and its parity core (`checkoutTender.ts`) was not edited |
| `salownSendLoyaltyEmail` / `salownSavePackageSettings` | ⏸️ **unchanged** — `-00063-vec` / `-00001-zof`. The loyalty release is intact |
| Every other Function | ⏸️ **unchanged** — targeted deploy, never a blanket `--only functions` |
| `hosting:salown` | ✅ **released** — version **`2aed6e662d41ad1b`**, `2026-08-02T18:06:52Z` (previous `76dc0749d03789d0`) |
| `hosting:salown-staff` | ⏸️ **NOT deployed** — still **`8409e666da7ea223`** from the loyalty CI run |
| `firestore.rules` | ✅ **released** — ruleset **`b30abf64-5515-4429-87f8-fafaa085af2c`**, `2026-08-02T18:07:02Z` |
| Indexes | ⏸️ **unchanged** |

**Deployed commands, verbatim and in this order:**
```
firebase deploy --only functions:salown:salownSaveCheckoutSettings --project havuz-44f70
firebase deploy --only hosting:salown --project havuz-44f70
firebase deploy --only firestore:rules --project havuz-44f70
```

### Why `[skip ci]` was required, and why the staff bundle did NOT ship

`.github/workflows/deploy.yml` runs `firebase deploy --only hosting`, which covers **both** targets and
would have released the panel **before** the callable existed — a Save button with no server behind it.
Both commits therefore carry `[skip ci]` and all three targets were deployed by hand in dependency
order. Unlike the loyalty release, nothing here is staff-visible: the Staff App imports the dictionaries
(so its bundle content would change) but renders no checkout-settings surface, so it stays on its
existing release. `hosting/staff-bundle/` is committed build output; the local verification build that
touched it was reverted before commit, so the tracked bundle is byte-unchanged.

### Rules — the Phase 1 gap is closed

`checkoutSettings` joined `presentation` and `packageSettings` in the existing owner-only `hasAny()`
list. **One added key, no new match block, read rule untouched.** Phase 1 shipped this gap open on
purpose and recorded it as an explicit follow-on; it was acceptable only while the feature was dark and
nothing wrote the field. Rules suite **154 → 170**, run against the local file before deploy.

### Live verification — `tr-demo` only, 22/22

Run end-to-end against the **deployed** callable and the **deployed** rules with real minted ID tokens
(owner, stylist, unauthenticated). Owner saved; version incremented `1 → 2`; a save carrying the
superseded version was refused `SETTINGS_VERSION_CONFLICT` **and changed nothing**; a stylist token was
refused `PERMISSION_DENIED`; an unauthenticated call `UNAUTHENTICATED`; an unauthenticated REST read of
the private Settings document returned **HTTP 403**.

The deployed **Phase 2B executor** was then proven to resolve the saved configuration without being
redeployed: with a superseded version it answered `TENDER_REFUSED / STALE_SETTINGS_VERSION`, and with
the current one it moved **past** the settings gate to `BOOKING_NOT_FOUND`. Both probes return before
any write, so nothing was created.

`PAY-1` (public tenant root), `packageSettings` and `presentation` were byte-compared before and after:
unchanged. No booking, receivable, `checkoutIntent`, package effect, loyalty award or email was created
by any of it.

**`tr-demo` was restored byte-exactly** — the settings document is identical to its pre-verification
JSON, and the two synthetic staff docs minted for the role test (the tenant had none) were deleted, back
to 0.

> **⚠️ CORRECTED 2026-08-02 (later).** This paragraph used to end: *"`whitecross`, `herohairs`, `demo`
> and `tr-demo` all have `checkoutSettings` ABSENT."* That was true **when Phase 3 was verified** and
> stopped being true within the hour — the owner saved a real configuration on `demo` from the Phase 3B
> UI at `2026-08-02T20:58:43Z`. It is the tenant-state line that is corrected, not the `tr-demo`
> restoration above it, which still holds. Current live truth is in
> [TENANTS.md → Demo & verification tenants](TENANTS.md#demo--verification-tenants); the short version:
> `whitecross`, `herohairs` and `tr-demo` have `checkoutSettings` **ABSENT** (today's UK behaviour,
> feature dark), and **`demo` has it PRESENT, `enabled: true`, `mode: tr`** by owner decision.

### `firestore.rules.LIVE` was stale and is now refreshed

`docs/firestore.rules.LIVE` is meant to be a verbatim snapshot of the **deployed** ruleset, refreshed
on each rules deploy. It had not been: the copy sitting there predated **TR-A** (no `presentation`
gate, no public-safe root mirror, and the stale `49/49` marker `TESTS.md` already flags). Someone
saved `firestore.rules.PREV-20260731-pre-tr-a` at that deploy and did not update `LIVE` itself, so the
file has been describing a ruleset that has not been live since 2026-07-31.

It is now refreshed to ruleset `b30abf64-5515-4429-87f8-fafaa085af2c`, byte-identical to the
`salown-app/firestore.rules` that produced it (deployed from a clean tree, `git status` empty). The
outgoing copy is preserved as `firestore.rules.PREV-20260802-pre-tr-d1-p3` — labelled honestly as what
it was, a stale snapshot, not as the previously-live ruleset.

### Still pending after this release

- **Admin / Staff Checkout UI cutover** — nothing calls `salownCheckoutBooking`. The existing browser
  checkout path is untouched, and this phase deliberately did not change it.
- **P0 — a selected package cannot be saved or checked out.** User-visible, open, and the exact
  next implementation package. See
  [TREATMENT_PACKAGE_SYSTEM.md → P0: package selection does not reach the cart](TREATMENT_PACKAGE_SYSTEM.md#151-p0--package-selection-does-not-reach-the-cart).
- **Finance SPLIT→CARD defect** — out of scope, unchanged.
- **Staff visual pass** — pending.

---

## 🧾 LOYALTY-RECEIPT-SALVAGE — zero-price walk-in guard + flagged-receipt recovery · **DEPLOYED + LIVE-VERIFIED** 2026-08-02

**Baseline commit `53bf4a1`** (`origin/main`). Production **is** on it.

| Surface | State |
|---|---|
| `functions:salown:salownSendLoyaltyEmail` | ✅ **updated** — revision **`salownsendloyaltyemail-00063-vec`**, service `updateTime` `2026-08-02T14:54:44Z` (previous `-00062-hok`) |
| Every other Function | ⏸️ **unchanged** — a single targeted deploy, never a blanket `--only functions` |
| `hosting:salown` | ✅ **released** by CI — version `76dc0749d03789d0`, `2026-08-02T14:53:59Z` (walk-in price guard + reporting reader) |
| `hosting:salown-staff` | ✅ **released** by the same CI run — see the note below |
| `firestore.rules` / indexes | ⏸️ **unchanged** — no rules change was made and none is needed |

**Deployed command, verbatim:**
`npx firebase-tools deploy --only functions:salown:salownSendLoyaltyEmail --project havuz-44f70`
→ `updating Node.js 22 (2nd Gen) function salown:salownSendLoyaltyEmail(europe-west2)` → `Successful update operation.`

### Why the Staff bundle shipped too

`.github/workflows/deploy.yml` runs `firebase deploy --only hosting`, which covers **both** targets — the split is not available on a push-triggered deploy. It is also correct here: `src/staff/views/WeekView.tsx` and `src/staff/sheets/ClientDetailSheet.tsx` both import `bookingNetWithoutTip`, so the reporting fix is genuinely staff-visible. Shipping the panel alone would have left the two surfaces disagreeing about the same money. `hosting/staff-bundle/` is committed build output (unlike `hosting/public-bundle/`, which is gitignored and built in CI), so it was rebuilt and committed in `53bf4a1`.

### The canonical gate was NOT weakened

`readCanonicalReceipt` is byte-unchanged. `readSalvageableReceipt` is a **separate, narrower** reader that only ever runs after the canonical one has refused, and it can never promote a snapshot to trustworthy. It applies to a flagged receipt with exactly one unknown and exactly one solution (`service = paidToday + redeemed`), re-checks the invariant codes from the stored numbers rather than trusting `receiptFailures`, and refuses any future `receiptMathVersion` exactly as the canonical reader does.

### Live verification

Two synthetic whitecross bookings (created, triggered, deleted — never Mason's record): the salvageable shape logged `salvaged view — derived-service-line (… awarded 36 implied 38 MISMATCH)`, the ambiguous twin stayed on `legacy view — writer-flagged`. Confirmed independently by the owner's first post-deploy real redemption, `WCB-1785686381122-9uzy`, which reconciled canonically and rendered the full breakdown. Detail: [TESTS.md §21](TESTS.md). Cause: [INCIDENTS.md 2026-08-02](INCIDENTS.md).

### Closed by owner decision, not outstanding

Mason Borrett's loyalty balance is **2 points short** (36, should be 38) and his receipt was not resent. The owner declined both on 2026-08-02 — going-forward correctness was what mattered. Nothing was written to his booking or client doc, and no follow-up is owed.

### Rollback

`git revert 53bf4a1 4587f50` then redeploy the same two targets. The Function revision rolls back with it; no data migration to unwind, because nothing was written to any booking or client.

---

## 🧾 TR-D1 Phase 2B — server-authoritative checkout executor · **DEPLOYED + LIVE-VERIFIED** 2026-08-02

**Baseline commit `ceb5316`** (`origin/main`). Production **is** on it.

| Surface | State |
|---|---|
| `functions:salown:salownCheckoutBooking` | ✅ **NEW — created** (europe-west2, v2 callable, nodejs22, 256 MB) · revision **`salowncheckoutbooking-00001-taf`**, created `2026-08-02T10:21:22Z`, `RoutesReady` + `ConfigurationsReady` = SUCCEEDED |
| Every other Function | ⏸️ **unchanged** — a single targeted deploy, never a blanket `--only functions` |
| `hosting:salown` | ⏸️ **not deployed** — every app commit carried `[skip ci]`; no bundle changed |
| `hosting:salown-staff` | ⏸️ **not deployed** — same |
| `firestore.rules` / indexes | ⏸️ **unchanged** — no rules change was made and none is needed (below) |

**Deployed command, verbatim:**
`firebase deploy --only functions:salown:salownCheckoutBooking --project havuz-44f70`
→ `creating Node.js 22 (2nd Gen) function salown:salownCheckoutBooking(europe-west2)` → `Successful create operation.`

### ⚠️ Deployed but DELIBERATELY UNREACHABLE

**Nothing calls this callable.** The Admin panel and the Staff App keep their existing browser
checkout path (`src/firestoreActions.ts`), unchanged and undeployed. A tenant with no
`checkoutSettings` resolves to `enabled: false`, so the callable fails closed with
`CHECKOUT_DISABLED` — verified live on `tr-demo` **before** the synthetic settings were applied.
All four UK production tenants are therefore unaffected by construction, not by care.

This is the same "built, pushed, not reachable" posture TR-D1 Phase 1 and Phase 2A hold, except the
server half is now genuinely running so it can be verified against real Firestore behaviour rather
than only against an emulator.

### Rules: nothing changed, and the ledger should say why

`checkoutIntents`, `receivables` and `receivableLedger` are **not** in the `[G4]` explicit write
list, so the existing catch-all `allow write: if false` already denies every client write to them.
Nine new rules cases pin that (145 → **154/154**) so a future edit to that list fails a test instead
of silently opening a financial collection. Rules tightening beyond this happens only **after** the
Admin and Staff UI cutover — the current UI still writes bookings directly.

### Rollback / deletion

The function is **new**, so rollback is deletion, and deletion is safe precisely because nothing
calls it:

```
firebase functions:delete salownCheckoutBooking --region europe-west2 --project havuz-44f70
```

No data migration to unwind: the executor's collections are new and, since no UI writes them, empty
in every production tenant. Reverting the code alone (`git revert ceb5316 a0bc7fa`) leaves the
deployed function orphaned — delete it explicitly rather than relying on a blanket redeploy, which
would also destroy the 27 legacy `us-central1` functions.

### Live verification

28 assertions through the deployed callable on `tr-demo` only, with a real Firebase ID token. All
synthetic records removed and `settings/settings` restored **sha256-identical**; the synthetic auth
user deleted. Detail: [TESTS.md §20](TESTS.md). Design: [TR_CHECKOUT_ARCHITECTURE.md](TR_CHECKOUT_ARCHITECTURE.md).

---

## 💷 TR-D1 Phase 0.5 — legacy split-payment report correction · **DEPLOYED + LIVE-VERIFIED** 2026-08-01

**Baseline commit `5926c1c`** (`origin/main`). Production **is** on it.

| Surface | State |
|---|---|
| `hosting:salown` | ✅ live — entry `index-BKqdCc8k.js`, chunk `Reports-_UZ4qFUZ.js`; old `g.cash+=net` predicate **absent** |
| `hosting:salown-staff` | ⏸️ **not deployed** — Reports is panel-only; tracked staff bundle unchanged and still byte-identical to production |
| Functions / rules / indexes | ⏸️ **unchanged** — nothing outside `src/` was touched |

Fixes an **existing** production defect (not introduced by TR-D1): split checkouts were bucketed by
`paymentMethod` alone, so `financeGrouped` **lost** the money entirely and `financeTotals`
attributed it wholly to card. Live proof on synthetic `tr-demo` data: expected net £340 →
old grouped reported **£100**, corrected reports **£340** (cash 222.50 / card 117.50).

**UK regression:** `whitecross` has **0** SPLIT rows across 400 checked-out bookings, so its cash/card
totals are **byte-identical** before and after (read-only check, nothing written).

⚠️ **Known, unfixed, authorized separately:** `Finance.tsx:48` maps `'SPLIT'` → `'CARD'`. Reported in
[TESTS.md](TESTS.md) §17; not claimed, not changed. Finance is whitecross-gated and whitecross has no
split rows, so live impact is nil today.

---

## 🇹🇷 TR-B2 — package booking UX, custom instalments, Finance/Reports, Clients IA · **DEPLOYED + LIVE-VERIFIED** 2026-08-01

**Baseline commit `a5b6f20`** (`origin/main`). Production **is** on it. Four stages, each pushed,
deployed and live-verified on the same cycle. **No Function or rules revision was deployed by any
stage** — every gap turned out to be backed by the contract TR-B already shipped.

| Stage | Commit | Deployed | Live verification |
|---|---|---|---|
| 1 · package accounting + Reports | `c5bd1dc` | `hosting:salown` (CI 23:18:12) | `tr-demo` **23/23** + 8/8 anchors |
| 2 · catalogue archive/restore + custom instalments | `b0a2051` | `hosting:salown` | `tr-demo` **35/35** |
| 3 · booking / walk-in package selection | `b40e182` | `hosting:salown` **+ `hosting:salown-staff`** | `tr-demo` **29/29** incl. a negative control |
| 4 · Follow-ups → a view of Clients | `a5b6f20` | `hosting:salown` + `hosting:salown-staff` | markers live; 16 routing tests |
| — · production package-gating anchor | `4408759` | n/a (script + unit gate) | **anchor holds** |

| Surface | State |
|---|---|
| `hosting:salown` | ✅ live — entry `index-DEnMEobb.js` |
| `hosting:salown-staff` | ✅ live — `staff-bURxN_lq.js`, **byte-identical to the tracked bundle**. No tracked deployable Staff artifact is ahead of production. |
| Functions | ⏸️ **unchanged** — all seven package/treatment callables still on their TR-B/TR-C revisions and still failing closed (`UNAUTHENTICATED`) |
| `firestore.rules` | ⏸️ **unchanged** — no rule change was needed or made; **no Firestore delete permission was added** |

**Scope note, stated so it is not over-read:** package accounting is live in **Reports** for
package-enabled tenants. The legacy **Finance** page remains Whitecross-specific
(`tenantId === 'whitecross'`, `£`-hardcoded); making Finance tenant-generic is a separate
TR-D/platform task. `Finance.tsx` is not in any TR-B2 diff, and its built chunk was verified
**byte-identical live vs local** — the `2a69735` date-selection fix is provably untouched.

**Gates at `a5b6f20`:** frontend **969** · functions **816** (797 pass / 19 self-skip / 0 fail) ·
emulator **105**. ⚠️ Manual visual pass NOT done — checklist in [TESTS.md](TESTS.md) §15.

---

## 🇹🇷 TR-B — treatment packages, partial payments and the open-account ledger · **DEPLOYED + LIVE-VERIFIED** 2026-07-31 ~16:3x UK

**Baseline commit `c3716f7`** (`origin/main`). Production **is** on it, on every surface.

| Surface | State |
|---|---|
| Functions | ✅ **DEPLOYED** — 6 NEW callables created in `europe-west2`, codebase `salown`: `salownSavePackageDefinition`, `salownSellPackage`, `salownRecordPackagePayment`, `salownPackageSession`, `salownSavePackageSettings`, `salownCancelClientPackage`. **Targeted deploy list** (never a blanket `--only functions`, which would delete the 27 us-central1 legacy functions). **No existing function was changed.** |
| Hosting `salown` | ✅ **DEPLOYED** — `public-bundle/assets/index-BnmVHeV5.js` live, lazy chunk `Packages-CYWHDamY.js` serving HTTP 200. Deployed manually because GitHub Actions status was not readable from the work machine (private repo, no `gh`); the manual deploy is idempotent with CI. |
| Hosting `salown-staff` | ✅ **DEPLOYED** — `staff-Dn9rrW0b.js` live (tracked bundle rebuilt and committed; CI builds only the main app). |
| `firestore.rules` | ✅ **DEPLOYED LAST**, after functions and hosting. ONE key added to the existing `settings/{document=**}` `hasAny()` list: `packageSettings` is now owner-or-super-admin only, beside `presentation`. No new match block. |
| `firestore.indexes.json` | ❌ not changed — every package query is a single-field equality, which Firestore serves from automatic indexes. |

**Live verification.** 37 assertions against **production Firestore**, `tr-demo` only, driving the
exact deployed executor: owner-only settings, a 3-instalment sale with a ₺2.000 deposit, double-tap
idempotency (one ledger row from two attempts), overpayment refusal, the staff payment/refund
permission split, refund + reversal leaving history intact, the `price: 0` prepaid seam on a real
booking, entitlement consumed once and the retry refused, tenant isolation, and cancellation moving
no money. **All 12 synthetic documents deleted and the `packageSettings` key removed** — `tr-demo`
was left exactly as found. No email sent, no card touched.

Callable liveness independently confirmed over HTTPS: all six return
`{"reason":"UNAUTHENTICATED","errors":["sign-in required"]}` — the executor's own code, proving the
deployed build is this one and the auth gate is closed.

**Blast radius on existing tenants: none.** `packageSettings` is absent on all six live tenants
(`demo`, `herohairs`, `the-hair-lab`, `tr-demo`, `whitecross`, `yusufo`), so the resolver returns
`enabled: false` and every entry point refuses before any write. The rules clause cannot bite on a
key nobody has.

⚠️ **Not deployed, because not built:** package selection inside `NewBookingSheet`/`WalkInFlow`, the
custom-instalment UI, and Finance/Reports recognition of package revenue. See
[TREATMENT_PACKAGE_SYSTEM.md](TREATMENT_PACKAGE_SYSTEM.md) §15.

---

## 🇹🇷 TR-C — treatment session lifecycle + client recovery · DEPLOYED + LIVE-VERIFIED 2026-07-31 ~20:5x UK

**Baseline commit `d9856e5`** (`origin/main`, clean tree at deploy time). Baseline chain:
TR-A `424747d` → TR-C Phase 1 `bc82454` → TR-B `c3716f7` → TR-C Phase 2 `d9856e5`, all
verified ancestors before any mutation. Deployed in the order **functions → hosting**;
no rules change was required.

### Functions — 3 targeted, europe-west2, `nodejs22` (NEVER blanket: a blanket deploy deletes the 27 us-central1 legacy functions)

| Function | Cloud Run revision (rollback anchor) |
|---|---|
| `salownCreateTreatmentSession` | `salowncreatetreatmentsession-00001-vap` |
| `salownTransitionTreatmentSession` | `salowntransitiontreatmentsession-00001-jur` |
| `salownRecordFollowUp` | `salownrecordfollowup-00001-mez` |

All three reported "Successful create operation" and all three Cloud Run services report
`RoutesReady` + `ConfigurationsReady` = `CONDITION_SUCCEEDED`. **Function name set: 98
before → 101 after; the diff is exactly these three additions and NOTHING was removed** —
re-checked by name because a first pass with a naive `awk` field split (broken by the CLI's
ANSI colour codes) falsely reported three `us-central1` legacy functions as deleted. They
are all present: `sendLoyaltyCardEmail`, `sendManualLoyaltyAdjustmentEmail`, `sendReceipt`.

Deployed endpoints independently confirmed live and failing closed: an unauthenticated
POST to each returns `UNAUTHENTICATED`.

### Hosting

| Target | Version | Rollback anchor |
|---|---|---|
| `hosting:salown` | `a5c3f0e4622644a7` | `f2428d9b468ac4bf` |
| `hosting:salown-staff` | `c10550cbbe1ffebb` | `d8275712fa1a828a` |

`salown-staff` was deployed because its bundle GENUINELY changed: registering the
`treatments` namespace in the shared i18n barrel puts those strings in the Staff App
bundle too (it consumes the same barrel). The Staff App renders none of them.

### Not deployed, deliberately

- **`firestore.rules`** — unchanged. The `[G4]` catch-all already grants same-tenant READ
  and denies client WRITE on any unlisted collection, which is exactly the
  server-authoritative posture `treatmentSessions` / `treatmentFollowUps` /
  `treatmentRequests` want. Adding explicit blocks would be documentation, not a control.
- **`firestore.indexes.json`** — unchanged; every query is a plain collection read.
- **TR-B's six package functions** — untouched. The integration diff changes no TR-B
  deployed code; TR-C injects `PKG.packageSessionCore` in-process.

### Live blast radius for existing UK tenants

Two visible changes, both intended:
1. A **"Follow-ups" sidebar item** appears for every tenant; opening it shows
   *"This salon has no treatment sessions yet."* (Same precedent TR-B set with "Packages".)
2. The Staff App bundle carries the treatments dictionary and renders none of it.

Everything else is inert: the active UK tenants whitecross / herohairs have zero `treatmentSessions`,
so `buildRecoveryRows` returns `[]`, the dashboard strip renders `null` and the client
card is unchanged.

### Live verification — `tr-demo` only

**37/37 passed**, all synthetic documents deleted afterwards and `packageSettings` removed
again (it was absent before). Full record: [TESTS.md](TESTS.md) §14.
⚠️ The manual **visual** pass is NOT done.

---

## 🇹🇷 TR-A — Turkey pilot foundation · DEPLOYED + LIVE-VERIFIED 2026-07-31 ~14:5x UK

**Baseline commit `424747d`** (`origin/main`, clean tree at deploy time). Everything below was
deployed in the security order **functions → hosting → rules LAST**, then the demo tenant seeded.

### Functions — 9 targeted, europe-west2, `nodejs22` (NEVER blanket: a blanket deploy deletes the 27 us-central1 legacy functions)

| Function | Cloud Run revision (rollback anchor) |
|---|---|
| `salownBookingConfirmationTrigger` | `-00043-zom` |
| `salownBookingConfirmedEmailTrigger` | `-00041-fon` |
| `salownCancelByToken` | `-00068-jur` |
| `salownNotifyBookingUpdated` | `-00109-vux` |
| `salownRescheduleByToken` | `-00074-zab` |
| `salownSendBookingConfirmation` | `-00108-nof` |
| `salownSendCancellationEmail` | `-00103-yif` |
| `salownSendLoyaltyEmail` | `-00062-hok` |
| `salownSendManualLoyaltyAdjustmentEmail` | `-00050-buj` |

All nine reported "Successful update operation". **Function name set: 65 before → 65 after,
`diff` empty** — no orphan deleted.

### Hosting
- `hosting:salown` → release complete (24 files uploaded). Live shell verified by `curl`:
  `<html lang="en" translate="no">` + `<meta name="google" content="notranslate">`.
- `hosting:salown-staff` → release complete. Live: `<title>salOWN Professionals</title>`,
  `apple-mobile-web-app-title` = `salOWN Pro`, splash wordmark renders `>OWN<`.
- Live manifest: `name` = `salOWN Professionals`, `short_name` = `salOWN Pro`.

### Rules
Deployed LAST. **145/145** against the deployed file. Pre-change snapshot saved as
`docs/firestore.rules.PREV-20260731-pre-tr-a`. The `[W] 33:56 Invalid variable name: request`
warning is **pre-existing** (identical on the file 5 commits back).

### Data
`tenants/tr-demo` seeded — 23 documents, guarded + idempotent. Re-run hit the demo-marker guard
and rewrote the same 23 documents.

### UK regression — measured, not assumed
All 6 tenants in the project were audited after deploy: **`tr-demo` is the ONLY one carrying a
`presentation` key.** whitecross, herohairs, demo, the-hair-lab and yusufo have none, so the
resolver returns the platform default, which IS the pre-TR-A UK behaviour.

### ⚠️ Outstanding
The manual **visual verification pass** (TESTS.md §12.3), including the Chrome
auto-translate-to-Turkish condition, is **NOT done** — the browser extension was not connected in
the deploying session. The mechanism is verified statically and live; the human pass is not.

---

## Hosting baseline — what is ACTUALLY live (measured 2026-07-26 19:45 UK)

**Live `salown` hosting release = `1785091173083000`** (2026-07-26T18:39:33Z, bundle
`index-D0JrelmL.js`), deployed manually from HEAD `f30ae4a` with `--only hosting:salown`. It adds the
extras/price fold fix (`694c2bb`) on top of everything in the previous baseline. Previous baseline =
`1785005794084000` (bundle `index-CLNge9uB.js`, HEAD `433ec7f`, the 2026-07-25 wave carrying BSP-I2,
BSP-H1, Parser-3C Super Admin panel + two lint cleanups); before that `ad20475` (`index-DdVeuO0D.js`,
"I1 canonical UK phone foundation"). Exactly ONE new release was created — verified by listing the
site's last 3 releases (new / 07-25 baseline / 07-24), so CI did not also fire.

🚨 **SUPERSEDED AGAIN 2026-07-31 — the DOCID-1 baseline below is three waves old.** Current live state,
measured against the Hosting API:

| Site | Live version | Rollback target | Deployed |
|---|---|---|---|
| `salown` | **`3880d3e7def72458`** | `f91b1d339413588a` | 2026-07-31 (LC1 identity form) |
| `salown-staff` | **`3290e71ede72802e`** | `05a26b9bcfe00925` | 2026-07-30 (Session B staff checkout) |
| `salown-admin` | **`9f457fc2c8ee4b35`** | `52d85c362cc267ef` | 2026-07-31 (LC1 inbox contact block) |
| `whitecrossbarbers-saas` | **`c5f243463afdc6df`** | `ff062a75bc1e5ea0` | 2026-07-31 (staff-shift SSOT + testMode removal) |

The `salown-staff` line in the section below — *"release `1784882253065000`, UNCHANGED since 2026-07-24"* —
is therefore also superseded: the staff bundle now carries the Session B checkout-payload fix.

🚨 **SUPERSEDED 2026-07-27 18:23 UK — live `salown` was then release `1785173028995000`** (2026-07-27T17:23:48.995Z,
version `a6b54b3273c9f7a4`, bundle `index-Dv_tTyTd.js`), deployed from branch **`hotfix/docid-1` HEAD `ae61566`** —
**NOT from `main`**. This is the DOCID-1 booking hotfix (INCIDENTS 2026-07-27); see the dedicated wave entry below.
The `f30ae4a` / `index-D0JrelmL.js` baseline described in this section is now the ROLLBACK TARGET.

**Re-confirmed independently 2026-07-27 15:10 UK (DOCID-1):** `curl https://salown.com/book/whitecross` emits
`assets/index-D0JrelmL.js`, and `npm run build` of an UNTOUCHED `f30ae4a` in a clean worktree emits the same
`index-D0JrelmL.js`. The live-source boundary is therefore `f30ae4a`, reproduced rather than trusted.

⚠️ **`origin/main` is AHEAD of live for hosting, and the gap is not releasable as a whole.** Undeployed
frontend on `main`: OPT-1 (`b6b622e`, service options → `BookingDetailPanel` + `src/utils/{serviceOptions,
bookingPrice}.ts`) and the FULL DOCID-1 commit (`c01e4b5` — the booking fix plus the admin-mapper sweep).
**A hosting deploy ships the whole bundle from whatever HEAD it builds — the `--only hosting:salown` target
scopes the SITE, not the COMMIT SCOPE.** So deploying off `main` co-releases OPT-1 without its owner's
approval. Owner decision 2026-07-27: do NOT co-deploy — ship the isolated branch instead (done, see below).
**Production therefore runs a strict SUBSET of `main`:** the booking path is fixed live, but `c01e4b5`'s
`BookingDetailPanel`/mapper sweep and all of OPT-1 are still NOT live. Permanent integration of `main` is a
separate, controlled job; `main` was deliberately NOT merged or rewritten during the emergency deploy.

*Method (repeatable, no production data touched):* fetch `https://salown.web.app/public-bundle/index.html`,
read the emitted asset name, compare to the local `npm run build` output of HEAD. The live bundle's markers
confirm the shipped packages: `phoneCanonical` (I2), `salownCreateBooking` + `IDEMPOTENCY` + `SLOT_CONFLICT`
(H1), `isSuperAdmin`-gated Parser panel (3C).

**`salown-staff` release = `1784882253065000`** (version `5fd6406875bc9653`) — **UNCHANGED** since
2026-07-24, by the 07-25 wave and by the 2026-07-26 deploy alike; the staff bundle still predates I2.
Both deployed `hosting:salown` **only**. Re-verified after the 07-26 deploy: same release ID, same
timestamp. ⚠️ The staff app therefore also does NOT have the extras/price fold fix — its
`BookingDetailSheet` is a separate component from the web `BookingDetailPanel`, so that fix has to be
mirrored there before a staff deploy is worth doing.

⚠️ **`--only hosting` (no target) deploys BOTH sites, but `--only hosting:salown` does NOT.** `firebase.json`
defines `salown` **and** `salown-staff`. The `salown` target's predeploy runs `npm run build` (→ gitignored
`hosting/public-bundle`); a `hosting:salown` deploy releases only the salown site. Note: the firebase CLI
still runs the `salown-staff` predeploy build hook during a `hosting:salown` deploy, which regenerates the
**tracked** `hosting/staff-bundle/` files locally — discard that build-output churn (explicit path) so it is
never committed. The **CI** workflow (`.github/workflows/deploy.yml`) runs blanket `firebase deploy --only
hosting`, which DOES ship both sites — so every doc/ops commit in a manual wave must carry `[skip ci]`.

---

## Legend

| Mark | Meaning |
|---|---|
| ✅ **Deployed + live-verified** | On `origin/main` **and** confirmed running in production |
| 🟡 **On origin/main, NOT deployed** | Committed/pushed but production still runs older behavior — a pending deploy |
| ⬜ **Not started** | No implementation on `origin/main` yet (design/plan only) |
| ♻️ **Live, no new deploy** | Already-live state a commit merely *records* — nothing new to ship |

**Deploy order (from `DEPLOY.md` / CLAUDE.md, security changes):** functions → hosting → **rules LAST**.
Hosting on `salown-app` is automatic on push to `main`; functions/rules/`whitecross-site` are manual and
owner-gated (state tenant + URL, wait for confirmation).

---

## Current deploy state (2026-07-25, rev. 20:15 UK — H1/Parser-3C/R1-A controlled wave)

> **2026-07-25 controlled deploy wave (functions → hosting → rules LAST), project `havuz-44f70`,
> account `whitecrossbarbers@gmail.com`, salown-app HEAD `433ec7f`:**
> - **Stage 1 (functions, targeted):** `firebase deploy --only functions:salown:salownRescheduleByToken,functions:salown:salownParseEmails,functions:salown:salownParseInboxDispatch,functions:salown:salownManualImport --project havuz-44f70` → all four ACTIVE, europe-west2, nodejs22, updated 2026-07-25 ~11:10Z (reschedule `salownreschedulebytoken` hash `00727dc8`, the 3 parsers share hash `d6a301e1`). **Exactly 4 functions changed; `salownCreateBooking` unchanged & ACTIVE; the 27 us-central1 legacy functions untouched (89 total, all ACTIVE).** Negative smoke on reschedule callable: `{}`→`INVALID_ARGUMENT`, fake token→`NOT_FOUND` (both reject before any write). First natural 5-min parser runs (11:12–11:27Z) produced healthy 3C ledgers: `outcome:success`, `errorCount:0`, `parserBroken:false`, `dataLossSignal:NONE`, reason-coded outcomes present, **zero UNKNOWN_SKIP / MISSING_REQUIRED_FIELDS**, no PII. Prod writes from this session = 0 (only the normal scheduled parser cron wrote its additive ledger).
> - **Stage 2 (hosting, targeted):** `firebase deploy --only hosting:salown --project havuz-44f70` → **salown** new release `1785005794084000` / version `0aacd49d5a9202cd` (was `1784882253096000` / `79cb725fe2c7e53c`). **salown-staff UNCHANGED** (`1784882253065000`); all whitecross premium hosting UNCHANGED. New bundle `index-CLNge9uB.js`. Hosted smoke: page loads, services/selection load, no console errors, callable-mode markers present (`salownCreateBooking`, `SLOT_CONFLICT`×4, `IDEMPOTENCY`, `phoneCanonical`), no public `clients` read, entered-name success preserved, Parser panel `isSuperAdmin`-gated, checkout keys on `docId` not the human WEB id, no legacy addDoc fallback. No production booking created.
> - **Stage 3 (rules, LAST):** `firebase deploy --only firestore:rules --project havuz-44f70` → new live ruleset **`323f1726-f6bf-4d6e-b9b9-24e152f6e494`** (2026-07-25T19:14:08Z), byte-identical to local `firestore.rules`; **rollback target = pre-R1-A `1474907b-af60-4bb4-a54a-8026c6c61273`** (`firestore.rules.ROLLBACK.txt` refreshed). Live-behavior verification via the Rules Test API on the deployed ruleset: **131/131**, 7 keys DENY, hosted+premium single/group ALLOW, staff BLOCKED/Busy ALLOW, cross-tenant isolation intact, 3 phase-B guards ALLOW (**phase-B still blocked**). Only rules changed (hosting + functions no drift).
>
> **Still undeployed after this wave:** BSP-W1 premium cutover (⬜ not started), E1 payment E2E (⬜ not started), R1 **phase (b)** deny-anonymous-create (⬜ blocked on W1+E1). Premium staff-shift (`whitecross-site` `e0003845`) still pending its separate manual deploy.

## 2026-07-27 — DOCID-1 booking hotfix (hosting:salown only, deployed from an ISOLATED branch) 🟠 OUTAGE FIX

> Emergency hosting deploy, project `havuz-44f70`, **branch `hotfix/docid-1` HEAD `ae61566`** — deliberately
> **not** `main`. Restores online booking on salown.com, which had been rejecting every attempt with
> `SERVICE_UNAVAILABLE` since the BSP-H1 cutover (INCIDENTS 2026-07-27).

| Item | Evidence |
|---|---|
| **Release** | `1785173028995000` · version `a6b54b3273c9f7a4` · **2026-07-27T17:23:48.995Z** · bundle `index-Dv_tTyTd.js` |
| **Previous (rollback target)** | `1785091173083000` · `ba04343dc998a3a2` · bundle `index-D0JrelmL.js` · HEAD `f30ae4a` |
| **Source** | `hotfix/docid-1` `ae61566`, cut from `f30ae4a`; pushed to `origin/hotfix/docid-1` (CI fires on `main` only) |
| **Deployed diff vs baseline** | 4 files, +187/−6: `src/pages/BookingPage.tsx` (+12/−3), `src/pages/SalonSitePage.tsx` (+10/−3), NEW `src/utils/firestoreIdentity.ts` (69), NEW `src/utils/firestoreIdentity.test.ts` (102, not bundled) |
| **OPT-1 exclusion** | `git merge-base --is-ancestor b6b622e HEAD` → **false**. Zero file intersection. |
| **Gates** | worktree clean · `f30ae4a` is an ancestor · clean rebuild hash == approved `index-Dv_tTyTd.js` · 279/279 vitest · `tsc --noEmit` clean |
| **Blast radius** | Exactly ONE new release on `salown`. `salown-staff` unchanged (`1784882253065000`). **9 of the project's 10 hosting sites** — incl. every `whitecrossbarbers-*` — carry unchanged release timestamps. |
| **Live proof** | `/public-bundle/assets/index-Dv_tTyTd.js` sha256 `90709208b6c53f4eb2c8281934f0da60d9f454a57e26a14b94ff841b6d0cfe1a` == the locally built, test-verified artefact; contains the DOCID-1 helper (`legacyId`). `/book/whitecross`, `/s/whitecross`, `salown.web.app` all serve it. |
| **Callable probe** (past date ⇒ policy rejects before any write) | doc id `a8XexksOAkVxabmmre5O` → `MINIMUM_NOTICE_NOT_MET` (service + staff resolve) · slug `skin-fade` → `SERVICE_UNAVAILABLE` (server still resolves by document path ONLY — no fallback was added, by design) |
| **Not deployed / not touched** | No functions deploy command run (deploy log shows `hosting[salown]` only) · rules untouched · `salownManualImport` not invoked · **zero production writes** · other sessions' dirty `functions/` tree untouched (deploy ran from a separate git worktree) |

⏸️ **A real customer-path booking was deliberately NOT created.** The callable's identity resolution creates/links
a **client record** alongside the booking, which is production data mutation — excluded by the same approval that
authorised the deploy. The owner's own genuine booking closes that last gap.

⚠️ Could not verify `salownCreateBooking`'s `updateTime` via the Cloud Functions REST API (the service account
lacks `cloudfunctions.functions.get`). Substitute evidence: the deploy log's scope, and the callable returning
byte-identical reason codes before and after the deploy.

## 2026-07-27 — WC-LEGACY-TESTMODE-LOCKDOWN (whitecross-site functions only) 🔴 SECURITY

> Targeted manual deploy, project `havuz-44f70`, **us-central1**, `whitecross-site` HEAD `917c2439`
> (implementation `8dcdebc7`). **Functions only — no hosting, no rules, no other function.** Run via
> `./scripts/deploy-functions.sh whitecross createCheckoutSession stripeWebhook` (the guarded wrapper;
> raw/blanket `firebase deploy` is forbidden — a blanket functions deploy would orphan the other 25
> us-central1 functions).

| Item | Commit(s) | Repo / target | State | Notes |
|---|---|---|---|---|
| Legacy test-mode lockdown (`createCheckoutSession`, `stripeWebhook`) | `8dcdebc7` | whitecross-site / functions us-central1 | ✅ **Deployed + live-verified** | Deployed 2026-07-27 ~11:41Z. Closes a **live free-booking exploit**: the legacy public path let `req.body.testMode` select the Stripe **test** key for a **real** production booking (payable with `4242…`), which the test-signed webhook then confirmed. Now: mode-selection keys → **400 `UNTRUSTED_FIELD`** before Stripe/Firestore; production always resolves the live key (test key only behind `WC_NONPROD_TEST_MODE=1`, **never set on `havuz-44f70`**); `stripeWebhook` rejects every `livemode !== true` event **before `getAdminDb()`** (zero reads/writes) on all branches; per-document mode gates on legacy single + group + MOBILE_CHECKOUT (absent/garbage `stripeMode` ⇒ live-only). Gates: `main == origin/main`, clean tree, zero claims, 52/52 tests, node syntax+load, namespace guard, live-key guard **pre and post** (`mode = LIVE`, Whitecross account). Post-deploy: 27 us-central1 functions before == 27 after (list byte-identical); exploit body → 400; alias sweep (`mode`/`stripeMode`/`livemode`/`stripeKey`/`testmode`/`test_mode`) → 400; `testMode:false` → 400 (presence not truthiness); control clean body → pre-existing `Missing required fields`; webhook unsigned → 400, forged → 400, GET → 405; runtime log `mode-selection field rejected { field: 'testMode' }` proves the new revision executes. **Zero production writes** — no booking created, no charge, no refund, no customer email. 🔴 Logs show the exploit had actually fired: enumerating `stripeWebhook`'s confirmations across multiple log windows shows **≥3 distinct bookings confirmed by a `cs_test_` session** (`WCB-1783254246431-fzo9`, `WCB-1784368144606-pix5`, `WCB-1784590975162-xeck`) alongside ~10 legitimate `cs_live_` ones. These are the **owner's own `?testMode=1` canary bookings** (email `whitecrossbarbers@gmail.com`; `pix5` is recorded in `whitecross-site/edit_log_whitecross.md` as a deliberate test booking marked for deletion), not an attack, and such records are routinely deleted afterwards. **Correction 2026-07-27:** an earlier revision of this row cited one id (`WCB-1784734815258-zwmv`) and told the owner to cancel it; the owner checked and **no such booking exists** — the log line was real but its document had since been deleted, and its current existence was never verified before an action was recommended. Instruction withdrawn; **no owner cleanup is outstanding.** Note `firebase functions:log` returns a *varying* window per call, so a single sampled entry is weak evidence — enumerate across calls. Rollback: `git revert 8dcdebc7` + rerun the wrapper; pre-lockdown `functions/index.js` = `7bc75e7e`. ⚠️ `script.js` (`?testMode=1` canary removal) is **hosting and NOT deployed** — needs `firebase deploy --only hosting:whitecrossbarbers-saas --config firebase.saas.json`. |
| PAY-2 external-checkout adapter | `132d88d5`, `7c5fb680` | whitecross-site / functions us-central1 | ✅ **Deployed, dormant by design** | Shipped in the same two functions. The new trusted path activates only for a request carrying `bookingDocId`, which nothing sends until **BSP-W1**. No behaviour change for current traffic. |

## 2026-07-29 — Treatwell ghost-barber fix (functions targeted + hosting via CI) + 2-record repair

> Project `havuz-44f70`, code `a687c06`. Functions deployed manually and targeted; the frontend half
> rode the normal `main`→CI hosting deploy. Owner-approved two-stage operation: deploy first, then
> repair exactly two records. See INCIDENTS.md 2026-07-29 (ghost stylists) for the root cause.

| Item | Commit(s) | Repo / target | State | Notes |
|---|---|---|---|---|
| Treatwell barber extraction anchored + `resolveBarberName` fails closed | `a687c06` | salown-app / functions (`salown` codebase) | ✅ **Deployed + live-verified** | `firebase deploy --only functions:salown:salownParseEmails,functions:salown:salownParseInboxDispatch,functions:salown:salownManualImport --project havuz-44f70` — three "Successful update operation", europe-west2, nodejs22. **Exactly 3 functions changed; the 27 us-central1 legacy functions verified present after the deploy** (no orphan deletion — the blanket-deploy hazard did not occur). ⚠️ **Deployed from an ISOLATED worktree cut at `a687c06`**, not from the working tree: `functions/src/index.ts` carried another session's *uncommitted* live-chat work and a functions deploy ships the whole source directory. The worktree was verified clean (`git status` empty) and its compiled `lib/parsers/treatwell.js` confirmed to carry `TW_BARBER_ANCHORED_RE`/`extractTreatwellBarber` before upload; worktree removed afterwards. Live proof came from **Firestore, not Cloud Logging** (which lagged ~30 min): `tenants/herohairs/parserStats/treatwell` `lastRunAt 2026-07-29T16:15:04Z` — i.e. after the deploy — `health HEALTHY`, `outcome success`, `errorCount 0`. Gates: functions 396 pass / 0 fail / 14 skip, frontend 436/436, both typechecks exit 0, `git diff --check` clean. `salownManualImport` deployed but **NOT invoked**. |
| Home "Stylists performance" reads the canonical roster | `a687c06` | salown-app / hosting `salown` (GitHub Actions) | ✅ **Deployed + byte-verified** | Rode the automatic `main`→CI hosting deploy (live release `2026-07-29 17:01:22` UK). Verified properly rather than assumed: a local `npm run build` of `origin/main` emitted `index-B6rqLP05.js`, and that file is **sha256-identical** to the one served at `https://salown.web.app/public-bundle/assets/index-B6rqLP05.js` (`62038c3e…`), proving live hosting runs code containing `a687c06`. Zero-impact for whitecross: its 42 non-roster booking names (Kadim/Manoj/Owner — former staff, not parser artefacts) all lack a `dateKey`, so they never entered this month-scoped card in the first place. |
| Live repair of `TREATWELL-T2188419290` + `TREATWELL-T2188431287` | — (data) | Firestore `tenants/herohairs/bookings` | ✅ **Repaired + verified** | **2 production writes, the ONLY writes of the operation.** Performed AFTER the functions deploy was live-verified. Each an `update()` touching exactly two fields — `barberId` `"blow dry"`/`"rough dry"` → `"hero"`, `barberName` `"Blow Dry"`/`"Rough Dry"` → `"HERO"` — after a uniqueness proof (1 doc per `treatwellRef`) and an already-repaired precondition guard. `barberName "HERO"` / `barberId "hero"` follows the parser's own convention, matching 43 of the 45 other herohairs Treatwell bookings. Read-back confirmed 22 immutable fields byte-identical per document (booking id, dates, times, client, price, paidAmount, source, status, Treatwell refs and fee breakdown). **Deliberately NOT changed:** `serviceId "Ladies - Balayage with Blow Dry"` (no Balayage service exists in the 15-item herohairs catalogue — unresolvable without inventing one) and both `duration` values (30 is the parser default over an unknown; 50 came from the email's own parenthetical). Recorded as residual risk, not silently patched. Widget reconciles exactly: £1,450 + £220 + £95 = **£1,765** and 31 + 1 + 1 = **33 clients**, now all under HERO — the repair moved revenue rather than losing it. No checkout, cancel, reschedule, re-import or customer communication. |

> ⚠️ **Pre-existing and NOT addressed here:** `salownParseEmails` continues to log `whitecross IMAP
> error: Command failed` on every 5-minute run (observed 15:15–15:45Z, unchanged before and after this
> deploy). Unrelated to this fix — whitecross's Treatwell `parserStats` last succeeded 2026-07-27.
> ✅ **`booksy.ts:194` — CLOSED the same day** by `a5489dc` (row below). The residual risk noted in the
> original revision of this row is no longer outstanding.

## 2026-07-29 — Booksy barber extraction hardened (same bug class, functions only)

> Project `havuz-44f70`, code `a5489dc`. Follow-up to `a687c06` closing the residual risk it recorded.
> **Preventive, not corrective** — no live corruption existed to repair. **Zero production data writes.**

| Item | Commit(s) | Repo / target | State | Notes |
|---|---|---|---|---|
| Booksy barber validated against the tenant roster | `a5489dc` | salown-app / functions (`salown` codebase) | ✅ **Deployed + live-verified** | Same targeted 3-function deploy (`salownParseEmails`, `salownParseInboxDispatch`, `salownManualImport`), europe-west2, three "Successful update operation" — deployed again from an ISOLATED worktree at `a5489dc` (`functions/src/index.ts` still carried another session's uncommitted work), worktree verified clean and its `lib/parsers/booksy.js` confirmed to carry the new extractor before upload. **27 us-central1 legacy functions verified present after the deploy.** Live proof: `tenants/herohairs/parserStats/treatwell` `lastRunAt 2026-07-29T22:30:03Z` — strictly after the deploy completed at 22:15:34Z — `HEALTHY`, `outcome success`, `errorCount 0`, examined 17 / skipped 17. ⚠️ **The Booksy code path itself has not yet been exercised in production**: no Booksy email has arrived since the deploy, so the verification covers the deployed bundle executing cleanly, not a live Booksy import. |
| Exposure measured before changing anything | — (read-only) | Firestore, all 5 tenants | ✅ **No corruption found** | `booksyParser` is on for whitecross (50 Booksy bookings, **0** services containing `" with "`) and yusufo (0 bookings); herohairs holds the 2 trigger services but has Booksy **off**; demo/the-hair-lab off. Across every tenant, **zero** Booksy bookings carried a non-roster `barberId` — the single flagged record (`BOOKSY-Karl-Bichmann-26-July-2026-12:30`) is Alex's doc-id form with a matching `barberName`, legitimate and on-roster. So the trigger and the parser have never been enabled together; this change shuts a trap rather than repairing damage. |

> ⚠️ **Treatwell's price anchor was deliberately NOT reused.** Booksy has the same two body shapes but
> the barber sits elsewhere — the price comes AFTER it, so `£<amount>\s+with` matches nothing in a
> Booksy body. The mirror anchor was measured and rejected: on a flattened line carrying a `" with "`
> service it captures across the second "with" (`"Haircut with HERO"`). The roster, not position,
> decides which candidate is a person.
> ⚠️ **A self-inflicted regression was caught by the existing suite, not waived.** The first revision
> read the barber roster once at the top of `parseBooksyMessages`, outside the per-message try/catch —
> `messages.test.js` then failed 2 tests because a throwing Firestore read rejected the whole run
> instead of being reason-coded `PARSE_ERROR`, losing `examined` entirely (the 2026-06-24 failure mode:
> a parser exception swallowed 11 days of bookings). The read is now lazy and inside the try.
> ⚠️ **Still pre-existing and NOT addressed:** the `whitecross IMAP error: Command failed` loop, and
> Treatwell's own roster read sitting outside its per-message try/catch (same structural weakness as the
> one fixed here, but pre-dating this work — not introduced by it).

## 2026-07-27 — Treatwell parser body-shape + semantic guardrail (functions only)

> Targeted manual deploy, project `havuz-44f70`, salown-app HEAD `105bd53`. **No hosting, no rules,
> no other function.** Owner-approved two-stage operation: deploy first, then one exact record repair.

| Item | Commit(s) | Repo / target | State | Notes |
|---|---|---|---|---|
| Treatwell flattened-body fix + semantic validation | `4c9809c`, `1507610` | salown-app / functions (`salown` codebase) | ✅ **Deployed** | Deployed 2026-07-27 ~13:54Z, `firebase deploy --only functions:salown:salownParseEmails,functions:salown:salownParseInboxDispatch,functions:salown:salownManualImport --project havuz-44f70` — three "Successful update operation", europe-west2, nodejs22. **Exactly 3 functions changed:** function count 90 → 90 with a byte-identical name set (no orphan deletion — the blanket-deploy hazard did not occur). Hosting releases unchanged (`salown` `2026-07-26T18:39:33.083Z`, `salown-staff` `2026-07-24T08:37:33.065Z`); rules releases unchanged (`cloud.firestore` ruleset `323f1726-f6bf-4d6e-b9b9-24e152f6e494` @ `2026-07-25T19:14:09Z`, storage `4c00eef7…` @ `2026-05-24`). Gates: `main == origin/main`, clean tree, zero active claims, all four required commits ancestors of HEAD, focused Treatwell 19/19, parser+inbound 168 (0 fail), **3× consecutive full suite 350/337 pass/13 skip/0 fail**, typecheck exit 0, `diff --check` clean, no failure waived. `salownManualImport` deployed but **NOT invoked**. |
| Live repair of `TREATWELL-T2188888050` | — (data) | Firestore `tenants/whitecross/bookings` | ✅ **Repaired + verified** | Single `update()` on exactly one document, after uniqueness proof (1 doc on each of `externalId` / `treatwellRef` / ref-mention) and a precondition re-check. Six approved fields only: `clientName`→`Jack Wells`, `serviceId`→`the-full-experience`, `barberId`→`alex`, `barberName`→`Alex`, `twPaymentMode`→`prepaid`, `paymentMethod`→`CARD`. Read-back proved 26 preserved fields byte-identical, zero keys removed, only the approved key added, Treatwell booking count 6 → 6, grid column resolves to **Alex** (`barber-1777257519766`), money intact (£40 `paidAmount`, `FULL`, prepaid). **This update is the ONLY production write of the operation** — no checkout, cancel, reschedule, re-import or customer communication; the audit pre-image lives in INCIDENTS.md, deliberately not in Firestore `auditLogs`. |

> ⚠️ **Known and accepted:** `salownParseEmails` continues to log `whitecross IMAP error: Command
> failed` every 5 minutes. The Gmail app password was intentionally revoked by the owner; whitecross
> is deliberately becoming PIPE_ONLY. Credentials were NOT restored here — the intentional-skip
> contract belongs to the separate PIPE_ONLY package.

## 2026-07-26 — Booking Detail extras/price fix (hosting only)

> Single-target manual deploy, project `havuz-44f70`, salown-app HEAD `f30ae4a`. No functions, no rules,
> no `salown-staff`. Push carried `[skip ci]` on HEAD so CI's blanket `--only hosting` never fired —
> confirmed by the release list (exactly one new `salown` release, `salown-staff` untouched since 07-24).

| Item | Commit(s) | Repo / target | State | Notes |
|---|---|---|---|---|
| Booking Detail extras → folded `price` fix | `694c2bb` | salown-app / hosting | ✅ **Deployed + live-verified** | Deployed 2026-07-26 18:39Z, `firebase deploy --only hosting:salown --project havuz-44f70` (NOT `--only hosting`). Live bundle `index-D0JrelmL.js` == local build of HEAD `f30ae4a`; release `1785091173083000`; exactly one new release; `salown-staff` release ID + timestamp unchanged. Gates before deploy: clean tree, `main == origin/main`, zero active claims, 266/266 vitest, typecheck clean, Vite build ok, `diff --check` clean, 5/5 price-arithmetic scenarios. Prod writes during deploy+verification = 0 (Sanga's record re-read only: CHECKED_OUT, £32 total = £10 deposit + £22 at venue, `soldAddOns` []). Functions + rules untouched. See INCIDENTS 2026-07-26. |

## Superseded snapshot (2026-07-24, rev. 13:22 UK)

| Item | Commit(s) | Repo / target | State | Notes |
|---|---|---|---|---|
| Booksy barber slot-tombstone fix | `41e2bc1` | salown-app / functions | ✅ **Deployed + live-verified** | Parser slot-tombstone barber fix; deployed and verified live. |
| Parser Canary Slice 3B | `7d6eb25` | salown-app / functions | ✅ **Deployed + live** | Canary persist slice, live. ⚠️ Commit `7d6eb25`'s message is the **2026-07-23 website add-on release** (`fix(checkout+grid+email): website add-on…`) — the combined functions/hosting deploy at that commit is what carried the persisted-canary slice live, superseding the earlier "3B persist not deployed" note. Confirm with owner if the 3B label should point at slice commit `381477b` instead. |
| salown-app staff-shift work — **hosting half** | `847e8f6`, `9bb65ed` (+ `8ddd91a`…`9c8ef84`) | salown-app / hosting | ✅ **Deployed + live-verified** | **Row corrected 2026-07-24 16:05.** Effective-shift SSOT + 15-min overrun allowance are LIVE in the `salown` bundle. Basis: live JS carries the resolver reason strings and its `BookingForm` chunk is byte-identical to a post-allowance build (see "Hosting baseline" above). |
| salown-app staff-shift work — **functions half** | `e879220` | salown-app / functions | ✅ **Deployed + live-verified** | **Shipped 2026-07-25** in the targeted `salownRescheduleByToken` deploy (Stage 1). The server reschedule guard's shift-window + fit enforcement is now live (`salownreschedulebytoken` hash `00727dc8`, ACTIVE, europe-west2). |
| Premium staff-shift (whitecross-site) | `e0003845` | whitecross-site (separate repo) | 🟡 **On origin/main, NOT deployed** | Premium-site mirror of the staff-shift change; on `origin/main`, **not deployed**. Separate manual deploy for the premium tenant. |
| July UI recovery | `775268ec` | salown-app / hosting | ♻️ **Live, no new deploy** | Commit **records** UI that is already live; it does **not** introduce a new deploy. Do not re-deploy on its account. |
| UK phone-identity implementation | — | salown-app / functions + hosting | ⬜ **Not started** | Identity handoff (`HANDOFF_uk_phone_identity.md`) — package **I1** in the migration plan. No code on `origin/main`. |
| BSP-C1 `salownCreateBooking` callable | `cb88af0`, `6d2859f`, `0c3a599` | salown-app / functions | ✅ **Deployed + live-verified** | Targeted deploy 2026-07-24 12:21:54Z: `firebase deploy --only functions:salown:salownCreateBooking --project havuz-44f70` → **CREATE**, `europe-west2`, nodejs22, rev `salowncreatebooking-00001-hab`, state ACTIVE. Live-verification basis: negative smoke (`{"data":{}}` and forged `price`/`startTime`) → HTTP 400 `INVALID_INPUT` **before any Firestore write**; booking counts unchanged across all 5 tenants (**prod writes = 0**); no successful production booking was created. **The callable is live but UNUSED** — nothing calls it until H1/W1 cut over. |
| B2 booking-settings (P1 validator) | `2a3ab96` | salown-app / functions | ✅ **Live via C1** | Pure P1 validator shipped inside the C1 functions deploy above (it had no deploy of its own by design). |
| C1 reschedule-guard thread (`salownRescheduleByToken`) | `cb88af0` | salown-app / functions | ✅ **Deployed + live-verified** | **Shipped 2026-07-25** (Stage 1). The resolved `shiftOverrunAllowanceMins` is now threaded into the live reschedule guard (`functions/src/index.ts:1430`); the hardcoded `15` is gone. `salownRescheduleByToken` ACTIVE, hash `00727dc8`. Negative smoke: `INVALID_ARGUMENT` / `NOT_FOUND` before any mutation. |
| BSP-H1 hosted booking cutover | `9480185` (+ lint `5d5def4`) | salown-app / hosting | ✅ **Deployed + live-verified** | **Shipped 2026-07-25** (Stage 2, salown release `1785005794084000`). `BookingPage.tsx` creates via `salownCreateBooking` in `callable` mode; smoke-verified live (callable markers in bundle `index-CLNge9uB.js`, no public `clients` read, no legacy addDoc fallback, checkout on `docId`, entered-name success preserved). Rollback = flip `HOSTED_BOOKING_CREATE_MODE` to `'legacy'` + redeploy hosting. |
| BSP-I2 canonical identity (hosting + staff bundle) | `321ff19` | salown-app / hosting | ✅ **Deployed + live-verified** | **Shipped 2026-07-25** with the Stage-2 hosting deploy (`phoneCanonical` marker present in the live salown bundle). Staff-bundle half is built from the same source but **not released** — salown-staff release unchanged; it will ship on the next `salown-staff` deploy. |
| Parser-3C lint cleanup | `80d9a95` | salown-app / hosting | ✅ **Deployed** | Dead `PARSER_HEALTH`/`PARSER_DATA_LOSS` imports dropped from `ParserImportHealthPanel.tsx` (owner-authorized one-line cleanup, 2026-07-25); shipped in the Stage-2 bundle. |
| BSP-R1 phase (a) — booking-create rules | `2a6a641` (+ docs `03b5fb3`) | salown-app / **firestore rules** | ✅ **Deployed + live-verified** | **Shipped 2026-07-25 LAST** (Stage 3). New live ruleset **`323f1726-f6bf-4d6e-b9b9-24e152f6e494`** (2026-07-25T19:14:08Z), byte-identical to local `firestore.rules`. Anonymous booking create rejects the 7 server-owned keys (`clientManualId`, `matchedBy`, `identityLinkedBy`, `identityLinkedAt`, `clientPhoneCanonical`, `emailCanonical`, `note`); anonymous create itself **stays allowed** (locked decision 18). Live-verified via Rules Test API on the deployed ruleset: **131/131** (7 keys DENY, hosted+premium single/group ALLOW, staff BLOCKED/Busy ALLOW, cross-tenant isolation intact, 3 phase-B guards ALLOW). **Rollback target = `1474907b-af60-4bb4-a54a-8026c6c61273`** (`firestore.rules.ROLLBACK.txt` refreshed with both ids). |
| BSP-W1 / R1 phase (b) | — | salown-app + whitecross-site | ⬜ **Not started** | W1 premium cutover; R1 **phase (b)** (deny anonymous create) remains blocked on W1 + E1 (H1 now live). Phase (a) is **live** as of 2026-07-25 — see the R1 phase (a) row above. R1 rules LAST. |
| Parser Canary Slice 3C | `308a7c0` | salown-app / functions | ✅ **Deployed + live-verified** | **Shipped 2026-07-25** (Stage 1; parsers share hash `d6a301e1`). First natural 5-min cron runs (11:12–11:27Z) wrote reason-coded ledgers on live `parserStats`: `herohairs/treatwell` {ALREADY_APPLIED, DUPLICATE_EXTERNAL_ID, TARGET_NOT_FOUND}, `whitecross/booksy` {DUPLICATE_EXTERNAL_ID, FILTERED_NON_BOOKING}, `whitecross/fresha` {FILTERED_NON_BOOKING}. All `outcome:success`, `errorCount:0`, `dataLossSignal:NONE`, zero UNKNOWN_SKIP / MISSING_REQUIRED_FIELDS, no PII. Shadow/reporting mode (no alert). |
| Super Admin health surface | `308a7c0` (+ lint `80d9a95`) | salown-app / hosting | ✅ **Deployed + live-verified** | **Shipped 2026-07-25** (Stage 2). Per-source import-health panel behind `isSuperAdmin` in Settings → Integrations; `isSuperAdmin` gate confirmed in the deployed bundle (ordinary tenants cannot see it). With the 3C functions side now live (same wave, Stage 1), it renders real reason-coded documents. Renders counts/codes only — stored `lastRun.errors` never shown. |

---

## Pending-deploy watch (🟡 rows — the risk list)

These are the rows where **`origin/main` is ahead of production**. Until they deploy, do not describe
their behavior as live.

> **Cleared by the 2026-07-25 wave** (all now ✅ live — see the table above): staff-shift functions half
> `e879220`, BSP-I2 hosting `321ff19` (staff-bundle half still pending a `salown-staff` deploy), BSP-H1
> `9480185`, Parser-3C `308a7c0` (both halves), C1 reschedule-guard thread `cb88af0`, R1 phase (a) `2a6a641`.

- **P1-RECEIPT-MATH canonical receipt snapshot** — ✅ **WRITER AND READER BOTH LIVE** (2026-07-30). The row that stood here said *"not live, and mostly not even pushed"* and *"the reader half was never started"*; both statements are now false. Writer `aeed3cf`+`5dcd5a4` (Session A, `hosting:salown`); reader `61ee2c1` plus the rest of the UK financial closure `e02ddc5`·`e70ed5f`·`af2fb8c`·`7290ccb` (Session B). `salownSendLoyaltyEmail` now READS the snapshot — supported version + writer-reconciled + invariants re-checked at read time — instead of re-deriving from `after.price`, which is what double-counted the add-on. Deployed revisions: `salownsendloyaltyemail-00061-zix` · `salownbookingconfirmationtrigger-00042-xac` · `salownbookingconfirmedemailtrigger-00040-xuz` · `salownnotifybookingupdated-00108-vij` · `salownreschedulebytoken-00073-foj`; deployed function source was re-downloaded and is **byte-identical** to the local build. **Deliberate residue, no backfill:** a booking already CHECKED_OUT before that release with a folded price still over-counts its add-on in Sales/Finance/Reports — after checkout the document cannot tell "folded at booking" from "added at the desk", and guessing would shrink real revenue. Pinned by a named test. See INCIDENTS 2026-07-30 (three entries).
- **BSP-I2 staff-bundle half** `321ff19` — the staff app (`salown-staff`) still runs the pre-I2 bundle; ships on the next `salown-staff` deploy (this wave deployed `hosting:salown` only).
- **premium staff-shift** `e0003845` — ✅ **DEPLOYED 2026-07-31**, `whitecrossbarbers-saas` version `c5f243463afdc6df`. Live proof: `overrun` 0×→1× in the served `script.js`, which is byte-identical to `origin/main`.
- **`?testMode=1` canary removal** (`whitecross-site` `script.js`, in `8dcdebc7`) — ✅ **DEPLOYED 2026-07-31** in the same `whitecrossbarbers-saas` release. Live `script.js` now has `IS_TEST_MODE` **0×** (was 4×) and no `testMode` on any executable line. The server-side rejection had been live since 07-27, so this closed the defence-in-depth half.
- **LC1 landing live chat** — ✅ **DEPLOYED AND LIVE-VERIFIED 2026-07-31**, then **gated behind visitor identity the same day**. Surfaces, in deploy order: function `salownLandingChat` **`salownlandingchat-00002-loc`** (was `-00001-qay`) → `hosting:salown` **`3880d3e7def72458`** (rollback `f91b1d339413588a`) → `hosting:salown-admin` **`9f457fc2c8ee4b35`** (rollback `52d85c362cc267ef`). Commits: salown-app `173db95` then `310624c`, super-admin `06d2a4c` then `51e70a0`.
  **Identity gate (LC1-IDENTITY-GATE):** a visitor gives **full name + email (required)** and **phone (optional)** before the assistant answers. Enforced SERVER-SIDE — `send` returns **403 `IDENTITY_REQUIRED`** without stored details, so a fabricated session id cannot consume AI. The `identify` action calls no model and sends no email; it is IP-metered, first-identity-wins, and cannot reset a ceiling. Poll returns `identified` as a boolean and never the contact values. **Legacy sessions are not backfilled** — a pre-gate conversation is asked for details before its next bot answer, with its history intact. Handoff email carries name/email/phone and the conversation id, still once per session.
  Earlier abuse fixes remain: `lead` is IP-metered, 404s on an unknown session and notifies once; `poll` is deliberately unmetered (two reads; a counter would add a costlier write). No firestore.rules change — everything is under `superAdmin/liveChat/**`.
- **BSP-W1 premium cutover** — ⬜ not started; blocks R1 phase (b).
- **E1 payment E2E** — ⬜ not started; gates R1 phase (b).
- **R1 phase (b)** deny-anonymous-create — ⬜ blocked on W1 + E1; rules LAST when it lands.

> **Cross-repo caution:** the staff-shift slot rule is hand-mirrored across the `salown-app` ⇄
> `whitecross-site` CJS boundary. Deploying one side without the other leaves the hosted and premium
> booking surfaces on **different** slot rules. Coordinate both 🟡 rows in the same rollout.

---

## How to update this file

1. When something deploys, change its state mark, and record the **live-verification** basis (what you
   checked, not just "deployed").
2. Keep the retrospective narrative in `salown-app/SYNC.md`; keep the plan in `ROADMAP.md`. This file is
   only the push-vs-live gap.
3. Re-stamp the snapshot date at the top when you revise.
