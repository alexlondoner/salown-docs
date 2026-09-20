# LIVE ↔ main alignment audit — 2026-09-20

**main audited:** `d646573` (merge `57dbf9a` is its parent) · **No merge, no deploy was performed by this audit.**
Everything below was read read-only, in an isolated worktree; the shared checkout was never switched, reset or rebased.

## 0. What was anchored first (live facts, not ledger claims)

| Target | Live identity | Source SHA | How the SHA was proven |
|---|---|---|---|
| `hosting:salown` (Admin + landing) | version `07c90b756c541a6a`, release `1789843984606000` (2026-09-19T18:53:04Z) | `56ceccc` | `git archive 56ceccc` + own `npm ci` + `npm run build`, compared to the served bytes: **95/95 files byte-identical, 0 differ, 0 missing** |
| `hosting:salown-staff` (Staff app) | version `4c0ce013b1e45dfa`, release `1789679980588000` (2026-09-17T21:19:40Z) | `76e58fe` | same method with `build:staff`: **25/25 byte-identical** |
| Firestore **rules** | ruleset `5e102dd4-e7e7-4950-b12a-14a74daa82e8` (2026-09-10T13:39:16Z) | — | ruleset source fetched from the Rules API and diffed against main's `firestore.rules`: **0 differing lines** |
| Firestore **indexes** | 2 composite indexes, both `READY` | — | compared field-by-field with `firestore.indexes.json` |
| **Functions** | 124 deployed gen-2 functions | per function | every `salown`-codebase package downloaded from GCS and diffed against main |
| Storage rules | ruleset `4c00eef7…` (2026-05-24) | — | fetched; **not managed by this repo** |
| Extensions | 0 instances | — | Extensions API |

Files excluded from the hosting comparison: `/__/firebase/init.js(on)` (injected by Firebase) and `schema.html` (deploy-ignored in `firebase.json`).

## 1. Live-only — in live, missing from main

**Admin source: none. Staff source: none. Functions: none.**

- Admin (`main` ↔ `56ceccc`, three-way against their merge base `c8a64d6`): **LIVE_AHEAD = 0**. The only paths live has that main does not are `hosting/staff-bundle/assets/staff-CLriqZe3.js` (a tracked *build artefact*, see §5) and another session's claim file — no behaviour.
- Staff (`main` ↔ `76e58fe`, base `aa2efd9`): **LIVE_AHEAD = 0, LIVE_ONLY = 0**.
- Functions: **89/89 `salown`-codebase functions, across 52/52 distinct source generations**, each deployed package's `src/` diffed against main. **Only-in-live = 0 in every group.** Independently spot-checked on two packages deployed from non-main bases (`salownSendLoyaltyEmail` gen `1789847386381762`, `salownPatchBookingDetails` gen `1789834585890846`): 111 live files each, **0 only-in-live**.

**Consequence: no integration candidate is required.** The earlier alignments (Booksy summary, receipt `buildPaidTodayMethodLabel`, Treatwell pay-at-venue, tip base, apply-once + `checkoutRevision`) closed the last live-only gaps; nothing was re-added by this audit.

## 2. Main-only, unreleased — in main, NOT live. Do not deploy silently.

| # | Work | Commits | Live where? | What a deploy from main would newly ship |
|---|---|---|---|---|
| M1 | **FIN-PROCESSOR-FEES B2 / B2a** (Stripe fee reader, booking-detail fee block, one refund summary) | `74922bd`, `9a4925c` | **Nowhere** | Admin bundle: `OnlinePaymentFees.tsx`, `settlementFacts.ts` + tests and the `BookingDetailPanel` refund branch |
| M2 | **Finance `settlementSync` composite index** (`bookings`: `settlementSync.state`, `settlementSync.nextAttemptAt`) | in `firestore.indexes.json` | **Nowhere** | an index CREATE on the first `--only firestore:indexes` deploy |
| M3 | **Staff availability gap P1/P2 + walk-in backdate floor + override prompts/toasts + walk-in policy gate** | `da44310`, `a7c79f3`, `631b768`, `9ea0aca`, `a7b1f33`, `aa2efd9` | **Live in the Staff bundle** (`76e58fe`), **not** in the Admin bundle | Admin bundle only: shared staff components/dictionaries move forward to what Staff already runs |
| M4 | **Reports: passive staff drop off Insights → Barbers** | `261fed1` | Live in the Staff bundle, not in Admin | Admin `Reports.tsx` + its test |
| M5 | **Functions work newer than each function's own snapshot** | many | per function | each function runs its own snapshot; redeploying function X from main ships main's whole `functions/src` into X's runtime, so X inherits every shared-module change since X was last deployed (e.g. `createBooking.ts` staff-policy-gate, `paymentAllocation.ts`, parsers, `emails/i18n.ts`) |

Nothing in this list is to be deleted, and nothing here should be deployed as a side effect of an unrelated release.

## 3. Both sides, divergent — minimum diff to keep live behaviour

| File | Verdict |
|---|---|
| `src/components/BookingDetailPanel.tsx` | Changed on both sides since `c8a64d6`. Checked line by line: the 4 "live-only" lines are the old unconditional refund rows, which main's M1 work **kept** inside the `settlementFacts.tracked ? … : …` else-branch. **No live behaviour is missing from main. Minimum diff = none.** |
| `src/components/CheckoutPanel.tsx` (vs live **Staff** source) | The live-only lines are the **old** tip math; main is newer (the released tip base). Staff bundle is simply behind. **Minimum diff = none.** |

## 4. Deprecated / intentionally not ported

| Item | Why it stays out |
|---|---|
| `9c7bf91` (receipt tender label branch) | Superseded: the deployed `c67da9e` was forward-ported instead (owner decision) |
| `whitecross` functions codebase (33 live functions) | A separate codebase from the `whitecross-site` repo; not comparable to `salown-app/functions/src`, and untouched by any `salown` deploy |
| `onBookingCreated`, `onBookingConfirmed` (us-central1, no codebase label, deployed 2026-05-22) | **Orphans.** Their entry points exist in neither repo's `main`. They trigger on `tenants/eekurt/bookings/{id}`; `onBookingCreated` flips `PENDING → CONFIRMED` and pushes Telegram + an Apps-Script webhook. **Dormant:** the only log entries are from deploy day, and `tenants/eekurt` **does not exist** in Firestore today. Owner decision to delete; no redeploy of either codebase touches them |
| Live Storage rules (`allow read: if true`, `allow write: if request.auth != null`) | Live-only, not managed by this repo (`firebase.json` declares no storage target). Flagged, not imported — see §5 |

## 5. Findings worth a decision (not alignment items)

1. **`salown.com` serves a second, stale copy of the Staff app.** `hosting/staff-bundle/` is a *tracked build artefact* inside the directory site `salown` serves whole, so `https://salown.com/staff-bundle/index.html` returns **200** and loads `staff-CRqN2rBX.js` — a third variant, matching neither the tracked copy in main (`staff-CxdWlU6-.js`) nor the live Staff site (`staff-BVUJwYTL.js`). Every Admin deploy rewrites it (both `predeploy` hooks fire regardless of `--only`), and a fresh `build:staff` produced yet another hash. It is an unversioned, publicly reachable Staff entry point.
2. **Storage rules allow world read** on every path of the default bucket, and any authenticated user may write. Unmanaged by the repo, so no review gate covers it.
3. **Per-function staleness is the real functions risk**, not divergence: 52 distinct source generations are live, some from July. Any single-function redeploy silently upgrades that function's view of every shared module.

## 6. Gate status of main itself (`d646573`), isolated worktree, own `npm ci`

| Gate | Result |
|---|---|
| app `tsc --noEmit` | **0 errors** |
| functions build + `tsc --noEmit` | **0 / 0** |
| functions `npm test` | **2873 pass / 0 fail / 45 skipped** (all emulator-gated) |
| canonical functions emulator gate | **725/725** (general 698 + packages 27) |
| Admin checkout writer emulator gate | **5/5** |
| app `npm test` | **5701 pass / 8 fail / 2 skipped** |
| `vite build` (Admin) · `build:staff` (Staff) | **OK / OK** |

The 8 failures are `ops/rules-authority.test.js` (6) + `scripts/functionsArchiveManifest.test.js` (2): they scan the developer-machine sibling layout and fail identically on clean `origin/main` in the same directory. The 2 skips are `verifyReleaseManifest`, gated on the `docs/` sibling — 3/3 when it is present.

## 7. Decision table — what must be deployed for real parity, what must be held

| Decision | Recommendation |
|---|---|
| Is a main-based **Admin** deploy safe from *reverting* live behaviour? | **Yes** — live-only is empty. But it would ship M1 (Finance) + M3/M4 (already live on Staff) to the Admin bundle in one release. Hold until Finance is explicitly approved, or cut Finance out of the release. |
| Is a main-based **Staff** deploy safe? | **Yes, no revert risk**; it moves Staff forward onto the released tip base and Booksy/prepaid work. Still a behaviour change, so it needs its own approval. |
| **Rules** | Already identical. Nothing to deploy. |
| **Indexes** | M2 would be created. Deploy only together with the Finance release that needs it. |
| **Functions** | No live-only code anywhere. Any redeploy is a *forward* move; scope it per function and state which shared-module changes ride along. |
| **Orphan functions / staff-bundle shadow copy / storage rules** | Owner decisions, separate from alignment. None of them is fixed by a merge. |
