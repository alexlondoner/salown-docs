# FIN_B2A_RELEASE_PREFLIGHT.md — the Finance fee **display** release

> **Status: READ-ONLY PREFLIGHT COMPLETE. NOTHING RELEASED. NOTHING WRITTEN.**
> Prepared 2026-09-22. No deploy, no merge, no migration or backfill, no Stripe call, no Firestore
> production write, and no change to Functions, rules, indexes or any flag was made by the session
> that produced this document. Every production fact below came from a GET or a `runQuery`.
>
> **`R-2026-09-22-A` is untouched.** The settlement ledger, `WC_SETTLEMENT_START_ISO`
> (`2026-09-22T00:29:26Z`) and `settlementLedgerEnabled` are exactly as that release left them, and
> this package must not move any of them — it ships **frontend display only**.
>
> **A deploy still needs explicit owner approval.** §7 lists the two decisions the owner has to take
> first; §6 lists what the owner should know they are turning on.
>
> Companion documents: [`HANDOFF_FIN_PROCESSOR_FEES.md`](HANDOFF_FIN_PROCESSOR_FEES.md) (the stream),
> [`PROCESSOR_FEES_PLAN.md`](PROCESSOR_FEES_PLAN.md) §1.3/§7.1/§9 (the contract this reader obeys),
> [`FIN_B1B_RELEASE_PREFLIGHT.md`](FIN_B1B_RELEASE_PREFLIGHT.md) (the writer, already released).

---

## 0. What B2a ships, and what it does not

**Ships.** One new block in the Admin booking-detail drawer, under Payment: *Online payment · Stripe*.
It shows what is known about the Stripe fee on that one booking — gross, fee (or the state of the fee),
refunds, and the net or the remaining fee cost. Plus one behaviour correction: on a booking the block
covers, the Payment section stops repeating the refund, so a refund is summarised in exactly one place.

**Does not ship.** No P&L line, no Bank Balance figure, no fee day, no period, no closed-period
behaviour, no Reports change, no Functions, rules, index or flag change, no write of any kind. The
reader is deliberately policy-free: it reads one booking document and answers one question.

**Two rules it must never break** (plan §1.3), both verified in §4:
an unknown fee is `null`, never `0`; a record that cannot be read is raised for review, never
silently treated as "no fee".

---

## 1. Live baseline, re-read on the day

| Unit | Live identity | How it was read | Verdict |
|---|---|---|---|
| `hosting:salown` | version **`be573ea0498fc71f`**, release `1789909611896000`, 2026-09-20T13:06:51.896Z, **97 files**, built from **`5be583c`** | Hosting REST `sites/salown/releases` | unchanged since `R-2026-09-20-A` |
| Firestore **rules** | ruleset **`5e102dd4-e7e7-4950-b12a-14a74daa82e8`**, updateTime 2026-09-10T13:39:16.896425Z | `firebaserules.googleapis.com/v1/projects/havuz-44f70/releases` | unchanged |
| Firestore **indexes** | **3, all `READY`** — incl. `bookings (settlementSync.state, settlementSync.nextAttemptAt)` id **`CICAgJjF9oIK`** | Firestore Admin REST | unchanged |
| `functions:whitecross` (us-central1) | **31** services · `stripewebhook-00107-yus` · `wcsettlementsweeper-00001-cat` · `enrollloyalty-00063-qil` · `wcloyaltylookup-00002-pec` | Cloud Run Admin REST | unchanged |
| `functions:salown` (europe-west2) | **94** services · `salownsendloyaltyemail-00067-bem` · `salowncreatestaffwalkin-00001-pur` · `salowncreatestaffbooking-00001-jan` | Cloud Run Admin REST | unchanged |
| **Flag** `tenants/whitecross/settings/settings` | `settlementLedgerEnabled: true`, `autoRefundEnabled: true`, updateTime 2026-09-22T11:13:40.640511Z | Firestore REST GET (masked) | unchanged, still armed |

All six identities were read again after every gate in §5 finished. **All six were identical.**

### 1.1 B2a is absent from the live bundle — proven at byte level

Every text asset of the live version was downloaded from `https://salown.web.app` and searched:
**56 files, 2,722,482 bytes** of JS/CSS/HTML.

| Marker | Present in live? |
|---|---|
| `online-payment-fees`, `fees-net`, `fees-cost`, `fees-gross` | **absent** |
| `Awaiting Stripe`, `Not recorded`→`Paid before fee tracking began`, `Needs review` | **absent** |
| `Remaining fee cost`, `Known fee cost`, `Estimated fee cost` | **absent** |
| `Charged more than once`, `Online payment · Stripe` | **absent** |
| `settlementProjection`, `settlementSync`, `settledNetStatus`, `refundsComplete`, `BEFORE_LEDGER_START`, `readSettlementFacts` | **absent** |

Positive control, so a silent grep failure cannot be mistaken for absence: `Card (online)`,
`Deposit paid`, `Remaining at venue` and `Refunded` are all **present**, in the entry chunk
`assets/index-CiEeRNFs.js`, which is where `BookingDetailPanel` lives.

### 1.2 The live artifact is reproducible

`5be583c` was exported with `git archive`, `npm ci`'d and built (`vite build`). Its
`hosting/public-bundle` is **byte-identical to what salown.com serves** for all 33 text assets
(the remaining 22 published files are images/icons and were not downloaded). So the baseline in
§5 is the live product, not an approximation, and any byte difference measured against it is
caused by the candidate and nothing else.

---

## 2. Source identity

| | SHA | Date | On `origin/main`? |
|---|---|---|---|
| B2 reader + block | **`74922bdb51ae8854a6bfb4d559c16a935b8cf190`** | 2026-09-15 00:31 +0100 | yes |
| B2a UX corrections | **`9a4925ca354eea3a2af7895228aeddd656759e5f`** | 2026-09-15 16:10 +0100 | yes |
| `origin/main` today | `55ec9df21109068569d9aea6f69616293d07029f` | 2026-09-22 | — |
| Live Admin source | `5be583c758bf769d9d878a1d84cc1473b9437d13` | 2026-09-20 | **no** (its fix was carried onto main separately, `06dc7e4`) |

**Files touched by the two commits — six, and only six:**

```
src/utils/settlementFacts.ts                          (new, 277 lines)
src/utils/settlementFacts.test.ts                     (new, 193 lines)
src/components/OnlinePaymentFees.tsx                  (new, 116 lines)
src/components/onlinePaymentFees.test.tsx             (new, 121 lines)
src/components/bookingDetailPanel.refundSummary.test.ts (new,  43 lines)
src/components/BookingDetailPanel.tsx                 (modified, +26/−4)
```

No checkout or payment writer, no `functions/`, no `firestore.rules`, no `firestore.indexes.json`,
no feature flag, no Finance calculation, no date policy, no translation file — the block's copy is
inline English, so nothing in `src/i18n/` is touched. `firestoreActions.ts` is not touched, so the
checkout write path is unchanged.

Five of the six files are **byte-identical on `origin/main` today** to what `9a4925c` left.
`BookingDetailPanel.tsx` has since been changed three times by unrelated lanes (Treatwell
pay-at-venue, the Booksy platform-deposit breakdown, the booking-edit fixes); **all five B2a
anchors survive intact** — the import pair, the read-once `const settlementFacts`, the
`settlementFacts.tracked ?` branch in the refunded case, and the `<OnlinePaymentFees facts={settlementFacts} />`
mount.

### 2.1 ⚠ `origin/main` is **not** a B2a-only release — §7 decision 1

`origin/main` is **160 commits** ahead of the B2a commit and **28 files** ahead of the live Admin
source. Building the Admin bundle from `main` and building it from "live + B2a only" are not the
same release:

| Candidate | Chunks whose **content** changes vs live | What that is |
|---|---|---|
| **B2a-only** (live `5be583c` + the two commits) | **1** — entry chunk `index.js` **+7,982 B** | B2a and nothing else |
| **`origin/main`** (`55ec9df`) | **2** — entry `index.js` **+10,510 B**, `Reports.js` **+432 B** | B2a **plus** `INSIGHTS-PASSIVE-BARBER` in Reports **plus** the Staff override-flow copy in EN **and** TR |

In both cases the CSS is byte-identical and the other 26 chunks differ **only** by the renamed
entry-chunk import path (verified by substituting the renamed asset names and re-comparing: 26
cosmetic, 0 real).

The non-B2a payload a `main` deploy would also ship:

- **Reports** — `isVisibleRosterBarber`: a passive team member no longer gets a permanent
  zero-everything card in a period they did not work in.
- **Staff override flow** — new refusal and owner-override prompts in English and Turkish
  ("That professional is not available on this date/time (deactivated or on leave) — this can never
  be overridden.", "Owner authorization is required for this.", and their TR counterparts).

Neither is unsafe, and neither has been released either. But B2a was prepared as a **display-only**
release, and a `main` cut is not one. A B2a-only candidate was built and fully gated for this
preflight (§3) precisely so the owner can choose.

---

## 3. The B2a-only candidate exists and costs almost nothing

Built by cherry-picking `74922bd` and `9a4925c` onto `5be583c` in a **throwaway clone in the
scratchpad** — nothing was pushed, no branch was created in the working checkout, and the shared
checkout was never moved off its current branch.

- `74922bd` produced **one conflict**, in `BookingDetailPanel.tsx`: two adjacent import lines
  (`unpaidState` on the live side, the two B2a imports on the other). Resolution is to keep both.
- `9a4925c` then applied **clean**.
- Result: **6 files changed, +772/−4**, and the five non-panel files are **byte-identical to
  `origin/main`'s**.

This candidate is what §5's `only` column gates. If the owner picks it, it needs a real commit on a
real branch (the cherry-pick above was scratch) before any deploy.

---

## 4. Contract review — the reader against the writer that is actually deployed

The reader was written on 2026-09-15 against the B1 writer as it stood at `22850996`. The writer
**now live** is `925debde` (B1b recency), deployed 2026-09-22. That gap was checked field by field
against `functions/settlements.js` at the deployed SHA.

| Check | Result |
|---|---|
| Projection shape `foldSettlements` emits vs `readProjection` accepts | **matches** — `gross_m`, `captures`, `multipleCharges`, `fee_m`, `feeSource`, `feeComplete`, `providerNet_m`, `refunded_m`, `feeOnRefund_m`, `settledNet_m`, `settledNetStatus`, `currency` |
| Extra fields the writer adds (`chargeIds`, `payoutIds`, `providerAccountIds`, `version`) | ignored by the reader; they do **not** make a record unreadable |
| `settlementSync.state` vocabulary | writer emits exactly `pending` · `done` · `failed` · `unresolvable` · `out_of_scope`; the reader knows exactly those five, and any other value becomes `unreadable` rather than "no fee" |
| `BEFORE_LEDGER_START` | writer's `markerFor` sets `out_of_scope` **if and only if** the reason is `BEFORE_LEDGER_START`, so the reader's "Paid before fee tracking began" copy fires on exactly the right bookings |
| B1b's new `booking.settlementRefundState` (per-charge generation fence) | not read by B2a, and does not need to be — it is coordination state, not money |
| Minor units | ledger `*_m` used as-is; only legacy booking fields go through `majorToPence` (`Math.round(n × 100)`); the component divides by 100 once at the edge. **No float money arithmetic anywhere** |

**Is an unknown fee ever assumed to be £0?**
No fee is *displayed* as £0 when it is unknown — verified by render in §4.1. There is exactly one
place where `0` is substituted arithmetically: the net fallback computes
`gross − (fee ?? 0) − refunded`. That number is never labelled a net-after-fees; it is emitted as
`netKind: 'upper_bound'` and rendered as **"up to £X · May be lower once every Stripe fee is known"**.
That is the documented contract, not a £0 assumption.

**`settledNetStatus` behaviour.**
`complete` → the ledger's own `settledNet_m` is used and the figure is `exact`.
`refunds_not_recorded` → `settledNet_m` is null and the reader falls back to
`gross − fee − refunded`, marked `upper_bound` **unless nothing is refunded at all**, in which case
it is `exact`. See §6 finding **F4** — that last branch is a judgement the owner should see, not a bug.

### 4.1 Rendered evidence — every state the owner asked about

The real `OnlinePaymentFees` component was rendered through `renderToStaticMarkup` against synthetic
bookings, and the text it produces was captured verbatim:

| Case | `status` / `fee_p` | What the owner sees |
|---|---|---|
| captured + actual fee | `known` / 58 | `Paid online +£25.00` · `Stripe fee · Confirmed by Stripe · −£0.58` · `Net from this payment · £24.42` |
| fee pending | `pending` / `null` | `Stripe fee · Stripe hasn't confirmed this fee yet · **Awaiting Stripe**` · `Net … up to £25.00` |
| fee unknown (B1 off / no record) | `not_recorded` / `null` | `Stripe fee · There is no Stripe fee record for this payment · **Not recorded**` |
| before ledger start | `not_recorded` / `null` | `Stripe fee · **Paid before fee tracking began** · Not recorded` |
| `refunds_not_recorded` (partial refund) | `known` / 58 | `Partly refunded −£10.00` · `Net … **up to** £14.42 · May be lower once every Stripe fee is known` |
| refunds complete, refunded in full | `known` / 58 | `Refunded −£25.00` · `**Remaining fee cost** £0.58` — **no negative "up to"** |
| **zero fee** (`fee_m: 0`) | `known` / **0** | `Stripe fee · Confirmed by Stripe · **−£0.00**` · `Net … £25.00` |
| **unknown fee**, same booking otherwise | `pending` / `null` | `Stripe fee · **Awaiting Stripe**` — **no amount at all** |
| non-online booking (cash walk-in) | untracked, rail `none` | **renders nothing** |
| Stripe **Connect** booking | untracked, rail `stripe_connect` | **renders nothing** |
| malformed projection | `unreadable` | `Stripe fee · The fee record for this payment can't be read · **Needs review**` |
| second capture | `partial` | `Paid online · 2 charges +£50.00` · `Confirmed for some of 2 charges…` · `**Charged more than once — check this payment in Stripe.**` |

**Zero vs unknown is distinguishable on screen**: a real £0 fee prints an amount (`−£0.00`) with
"Confirmed by Stripe"; an unknown fee prints a state and no amount, ever. See **F5** — no test pins
this, although the behaviour is correct.

**No duplicate refund row.** `bookingDetailPanel.refundSummary.test.ts` asserts the panel reads the
facts once, hands the same value to the block, keeps the legacy `Refunded` row **only** where the
block is not shown, and that the legacy row appears **exactly once** in the file. Stripe Connect and
every other payment type keep their existing display.

### 4.2 Rendered against **real production data** (read-only)

300 whitecross bookings were read (`runQuery`, `startTime` descending, `tenants/whitecross`) and the
real reader was run over the real documents. **No write was made and nothing was cached back.**

```
untracked (block hidden) ............ 265
tracked ..............................  35
  known (actual fee from the ledger) ..  1
  not_recorded ........................ 34
  pending / partial / estimate ........  0
  unresolved / unreadable .............  0
  needsReview .........................  0
```

**Zero `unreadable`, zero `needsReview` against live data** — the reader parses the live projection
shape correctly. The single `known` booking renders
`Paid online +£40.00 · Stripe fee −£0.80 Confirmed by Stripe · Net from this payment £39.20`.

---

## 5. Gates — three trees, measured separately, from pinned `git archive` copies

Never from the shared checkout, and never from a `git worktree` (a worktree carrying `firebase.json`
turns every other session's `npm test` red). Root `npm ci` **and** `functions/` `npm ci` + `npm run build`
in each tree, because without `functions/lib` the root `tsc` reports five environment errors.

| Gate | **A** baseline `5be583c` (= live) | **B** B2a-only | **C** `origin/main` `55ec9df` |
|---|---|---|---|
| `tsc --noEmit` | **0 errors** | **0 errors** | **0 errors** |
| `eslint src` | 6 errors (pre-existing) | **6** — no delta | **6** — no delta |
| `eslint` on the 6 B2a files | — | **0** | **0** |
| `vitest run` (whole repo) | **5619 passed**, 6 skipped | **5666 passed**, 6 skipped | **5710 passed**, 7 skipped |
| failing test cases | **0** | **0** | **0** |
| suites that failed to load | 1 (see below) | 1 (same) | 1 (same) |
| `vite build` | OK | OK | OK |
| B2a suites alone | n/a | **47/47** | **47/47** |

B − A = **+47 tests**, which is exactly the three B2a suites. C − B = +44, which is the other lanes'
tests, not B2a's.

**The one failing suite, in all three trees identically:**
`scripts/functionsArchiveManifest.test.js` fails to load with
`git -C …/functions ls-files → fatal: not a git repository`. It is an artifact of verifying from a
`git archive` copy, it fails identically on the live source, and it is not B2a.

### 5.1 Skips, reported separately — a skip is not a pass

Six skips in A and B, seven in C. Every one is environment-driven, none is a B2a test:

- `ops/rules-authority.test.js > sibling repos on a developer machine` — **4 skipped in A/B, 5 in C**
  (C has one more because it carries the newer `--config` guard). These tests look for
  `whitecross-site`, `whitecross-site/barber-panel` and `salown-panel` next to the workspace; a
  scratch archive has no siblings, so they skip. **The rules-authority guard is therefore not
  exercised by these runs** — it must be green in a real checkout before any rules or index deploy.
  It is irrelevant to a hosting-only release, which publishes no rules.
- `scripts/verifyReleaseManifest.test.js` — **2 skipped in all three**, same reason.

### 5.2 ⚠ New trap: two verification workspaces must not be siblings

The first run of C produced **15 failures across 3 files** that looked alarming and were entirely
self-inflicted: the baseline workspace was sitting **next to** the candidate workspace, and
`ops/rules-authority.test.js` correctly reported the neighbour's `firebase.json` as a second
Firestore deploy target (`base/firebase.json → [{"rules":"firestore.rules", …}]`). Moving the
baseline to a different parent directory took the same tree to **1 failed file, 0 failed tests**.

The guard was right; the layout was wrong. **Put A/B/C trees under different parents.** This also
means a nested-workspace layout can make a healthy candidate look broken — do not read such a
failure as a product defect without checking the neighbours first.

### 5.3 The emulator gate was deliberately **not** run

`ops/test-emulator.sh` exercises Functions-side behaviour (bookings, checkout, packages, parsers,
payments). **B2a touches no Functions code**, so the gate has zero B2a coverage, and running it
would start an emulator that loads whatever local secrets exist — which sits badly against this
session's "no Stripe call, no production write" instruction. It is recorded here as **not run, with
the reason**, and is **not** counted as a pass. It remains required for any Functions release; it is
not required for a hosting-only display release.

---

## 6. Findings

### F1 — `main` is not a display-only release · **owner decision** · §2.1, §7
A `hosting:salown` deploy from `origin/main` also ships the Reports passive-barber change and the
Staff override-flow copy. The B2a-only alternative is measured, gated and one trivial conflict away.

### F2 — an abandoned checkout renders an empty Stripe block · **real, low severity**
A booking whose **only** Stripe evidence is `paymentProvider: 'EXTERNAL_CHECKOUT'` — no
`stripePaymentIntent`, no `stripeAmountPaid`, status `CANCELLED` — is treated as `tracked`, and the
panel renders:

> **Online payment · Stripe** — Stripe fee · There is no Stripe fee record for this payment · **Not recorded**

with no "Paid online" row, because there is no amount. For a booking that was never paid, this
invents an online-payment section. **4 of the 35 tracked bookings** in the 300-row production sample
are exactly this shape (all `CANCELLED`, all abandoned checkouts). The fix is one condition in
`readSettlementFacts` — treat "`EXTERNAL_CHECKOUT` alone, no intent, no amount, no ledger record" as
untracked — but it is a **contract change to a deliberately policy-free reader** and belongs to the
owner, not to this preflight. It is display-only and misleads nobody about money.

### F3 — every historical online payment says "no record", not "before tracking began"
34 of the 35 tracked bookings predate `WC_SETTLEMENT_START_ISO`. They carry **no** `settlementSync`
marker at all — the sweeper only marks bookings it actually processes — so `reason` is `null` and the
copy is the generic *"There is no Stripe fee record for this payment"* rather than the gentler
*"Paid before fee tracking began"*. The kind copy exists and works, but only fires when an event
arrives for a pre-start booking. Making it fire on date alone would put a policy date inside a
policy-free reader. **Owner decision; not a defect.**

### F4 — "exact" while the ledger says `refunds_not_recorded` · **judgement, worth knowing**
The one real captured booking today has `settledNetStatus: 'refunds_not_recorded'` and
`settledNet_m: null`, yet the panel shows `Net from this payment £39.20` as **exact**, because
nothing is refunded. `refunds_not_recorded` means the ledger has not *proven* the refund picture
complete; the reader treats "no refund recorded anywhere" as "no refund". Mitigation already in
place: the refund figure falls back to `booking.refundedAmount`, which the live refund reconcile
writes, so a refund would have to be missing from **both** the ledger and the booking for the figure
to be wrong. Narrow, but it is the one place the display is more confident than the ledger.

### F5 — no test pins a genuine £0 fee · **coverage gap, low**
`fee_m: 0` with `feeSource: 'actual'` renders `−£0.00 · Confirmed by Stripe`, which is correct and
distinguishable from unknown. No test asserts it, so the "unknown is never £0" rule and its
legitimate opposite are not both locked down. One test case.

### F6 — status correction: the B1 **capture leg is now production-verified**
`ROADMAP.md` and `DEPLOYMENT_STATUS.md` both say `R-2026-09-22-A` is `PARTIALLY LIVE_VERIFIED` and
that "no `settlements` entry exists yet". **That is no longer true.** Booking
`tenants/whitecross/bookings/jgyXnVAcMkQxdiNfsctO` (appointment 2026-09-22T17:30Z) carries two real
ledger entries, written by `stripe-webhook` at **2026-09-22T12:23:43.459807Z**:

```
stripe:ch_3UISjRRfgDnpYJzP1XFltzNC   CAPTURED     gross_m 4000  currency gbp
stripe:txn_3UISjRRfgDnpYJzP1C41nC0B  FEE_ACTUAL   fee_m     80  currency gbp
```

`settlementSync` is `done` with `attempts: 0` and `lastError: null`, and the projection is complete
(`feeSource: 'actual'`, `feeComplete: true`, `providerNet_m: 3920`). £0.80 on £40.00 is Stripe UK's
1.5% + 20p exactly. **The fee completed on the `checkout.session.completed` webhook itself**, in a
single pass — the indexed due pass was not needed for this payment, which is the case
`charge.updated` was deliberately not added for.

The corrections are applied in the same commit as this document. B2a therefore has **real fee data to
display on day one**, not just synthetic states.

### F7 — verification-layout trap
§5.2. Recorded because it will otherwise cost the next session an hour.

---

## 7. What the owner has to decide before anything is deployed

**Decision 1 — which candidate.**

- **(a) B2a-only, cut from the live source** *(recommended)*. Changes one chunk's content. Nothing
  but the fee block moves. Matches how this work was prepared and keeps "one change → deploy →
  live test → next". Needs a real commit of the §3 cherry-pick first.
- **(b) `origin/main` as it stands.** Also ships Reports passive-barber and the Staff override copy,
  neither of which has been released or live-tested, and neither of which is in this preflight's
  scope. If the owner wants those, they should be a named release with their own verification, not
  passengers on a fee-display deploy.

**Decision 2 — F2, the abandoned-checkout block.** Ship as-is and fix later, or fix first. It is
display-only and never wrong about money, so shipping as-is is defensible; the owner should simply
not be surprised by an "Online payment · Stripe" heading on a cancelled, never-paid booking.

Optional, and cheap if either is wanted before the release: **F3** (date-based "before tracking
began") and **F5** (the £0-fee test).

---

## 8. If it is approved — the deploy shape, and the rollback

Not steps taken. Steps to take, and only after an explicit approval that names the candidate.

1. Pin the candidate SHA and commit it properly (for (a), the §3 cherry-pick onto a real branch;
   for (b), `55ec9df` or later `origin/main`).
2. Re-read all six identities in §1 immediately before deploying, and **record the rollback identity
   first**: `hosting:salown` is at **`be573ea0498fc71f`** today — that is the rollback anchor and it
   cannot be recovered afterwards without guessing.
3. Build from a `git archive` copy of the pinned SHA in an isolated workspace with its own `npm ci`.
   **Never from the shared checkout.** Confirm the built `hosting/public-bundle` differs from the
   live bytes in exactly the chunks §2.1 predicts before uploading anything.
4. Deploy **`--only hosting:salown`**. Nothing else. No Functions, no rules, no indexes, no flag.
5. Verify in production by served bytes, not by a commit: the new entry chunk must contain
   `online-payment-fees`, `Awaiting Stripe` and `Remaining fee cost`, and the site must still answer
   200 on `/`, `/app` and `/book/**`. Then open booking `jgyXnVAcMkQxdiNfsctO` in the Admin drawer
   and confirm it reads `+£40.00 / −£0.80 / £39.20` — the first end-to-end proof that the ledger and
   the display agree on a real payment.
6. Record the release in `RELEASE_LEDGER.md` and `DEPLOYMENT_STATUS.md`, in the same commit as the
   `ROADMAP.md` status change.

**Rollback.** Re-release version **`be573ea0498fc71f`** on `hosting:salown`. It is a hosting-only
release of frontend display code: there is no data migration, nothing is written by it, and rolling
back takes the fee block off the screen and changes nothing else. The settlement ledger keeps
recording either way — B2a only decides whether the owner can see it.

---

## 9. Evidence that nothing was written

- All three repos were clean before and after: `salown-app` `158923f` (on
  `release/admin-tip-concurrency-on-live-503bdff`, untouched), `docs` `e79e299`, `whitecross-site`
  `7775d2cf` — `0` modified, `0` untracked in each.
- No branch, commit, tag, stash or worktree was created in any working checkout. The cherry-pick in
  §3 happened in a **throwaway clone** in the session scratchpad.
- Every production call was a read: Hosting `releases`/`versions.files` GET, Firebase Rules
  `releases` GET, Firestore Admin `indexes` GET, Cloud Run `services` GET, Firestore document GET
  (field-masked) and one `runQuery`. **No POST, PATCH, DELETE or `:commit` to any Firestore,
  Functions, Hosting, Rules or Stripe endpoint.**
- `firebase deploy` was never invoked. `hosting:channel:list` (read) was the only `firebase` CLI call
  against production.
- The live `hosting:salown` release id, the rules ruleset id, the three index ids, both Cloud Run
  inventories and the flag document were re-read after all gates finished and were **identical** to
  §1.
- The shared Vite dev server on port 5173 was left running and untouched.
