# Closing coordination — remaining work after the 2026-09-20 alignment audit

**Input:** [LIVE_MAIN_ALIGNMENT_AUDIT_2026-09-20.md](LIVE_MAIN_ALIGNMENT_AUDIT_2026-09-20.md) (salown-docs `216ab84`).
**Audit conclusion accepted:** live-only code is empty for Admin, Staff and the 89 `salown` functions; deployed
behaviour is aligned with `main`. No integration candidate is required.

**This session performed no merge, no deploy, no branch switch, no reset, no rebase, and deleted nothing.**
Everything below was read read-only from `origin/main` and from public HTTP endpoints.

---

## 0. State verified at the start of this session (read-only)

| Fact | Value |
|---|---|
| salown-app `origin/main` | **`9020560`** = audited `d646573` + one docs/SYNC commit (`git merge-base --is-ancestor d646573 origin/main` → true). **The audit is still current for code.** |
| salown-app shared checkout | on `release/admin-tip-concurrency-on-live-503bdff`, 176 behind / 6 ahead of `origin/main`, working tree clean. **Not touched.** |
| salown-docs | `216ab84`, clean, 0/0 vs `origin/main`. |
| Active claims | `WHATSAPP-B7--alish--whatsapp` (`functions/src/whatsapp/`, status `blocked`) · `CUST-LANG-AUDIENCE--alish--cust-lang` (status `working`; presentation/i18n paths in app **and** `functions/src/emails/i18n.ts`) — this claim exists on the release branch, not on `origin/main`. **Both treated as live locks; no claimed path was read-modified.** |
| Live Admin source | `56ceccc` — **not an ancestor of `main`** (release-branch commit, merge-base `c8a64d6`). Alignment was proven by *content* diff, not ancestry. |
| Live Staff source | `76e58fe` — **not an ancestor of `main`** (merge-base `aa2efd9`). Same caveat. |

> Consequence to keep in mind for every row below: "live" is a *forward-ported branch build*, so
> "is X in main?" and "is X live?" are two independent questions and neither implies the other.

---

## 1. Main-only, unreleased

| # | Item | Current SHA (on `origin/main` `9020560`) | Live status | Risk | Owner decision required | Recommended safe next step |
|---|---|---|---|---|---|---|
| M1 | **FIN-PROCESSOR-FEES B2 / B2a** — Stripe fee reader, booking-detail fee block, one refund summary (`src/components/OnlinePaymentFees.tsx`, `src/utils/settlementFacts.ts` + tests, `BookingDetailPanel` refund branch) | `74922bd`, `9a4925c` — both verified present in `main`; the 4 files exist in the `main` tree | **Nowhere.** Admin bundle is built from `56ceccc`, whose merge-base with main is `c8a64d6` — predates both commits | Display-only (no fee is written to P&L), but a plain `main` build of the Admin target ships it **together with M3+M4** in one release. `ROADMAP` records it `PUSHED_NOT_LIVE` | **Release Finance fee UI to Admin now, or cut it out of the next Admin release?** | Hold. When approved, build from an **isolated release workspace** (`git archive` of a pinned commit, own `npm ci`), not from a plain `main` checkout — the established pattern. Do not bundle with M2 |
| M2 | **`settlementSync` composite index** (`bookings`: `settlementSync.state` + `settlementSync.nextAttemptAt`) | declared in `firestore.indexes.json`; landed at `9a9547a`. Verified: `main` declares **3** indexes, live has **2 READY** | **Not deployed.** File-only | An `--only firestore:indexes` deploy **creates** it and deletes nothing — but `TEC-6` states no index deploy outside the FIN-B1 release sequence, and B1 itself is pinned at whitecross-site `22850996` with the sweeper, flag and `settlements` data all absent | **Confirm the index stays tied to the B1 release lane** (no standalone index deploy) | Keep held. It only moves with the B1 sequence in `FIN_B1_RELEASE_PREFLIGHT.md` |
| M3 | **Staff availability gap P1/P2 + walk-in backdate floor + override prompts/toasts + walk-in policy gate** | `da44310`, `a7c79f3`, `631b768`, `9ea0aca`, `a7b1f33`, `aa2efd9` — all verified in `main` | **Live in the Staff bundle** (`76e58fe`, merge-base `aa2efd9`) and in `functions` (`salownCreateStaffBooking`, `salownCreateStaffWalkIn`, `R-2026-09-13-A` / `R-2026-09-15-A`). **Not in the Admin bundle** | An Admin deploy from `main` moves shared staff components and dictionaries forward to what Staff already runs — a real behaviour change in Admin, not a no-op. Independently: the **legacy Admin `salownCreateWalkIn` callable still has no D1-D7 enforcement** (named standing exception, 2026-09-15) | **Should Admin be moved onto the Staff-aligned shared code in the next release, and is the Admin-callable enforcement gap still deliberately open?** | No action. Name M3 explicitly in the scope statement of any future Admin release; it is never an invisible ride-along |
| M4 | **Reports: passive staff drop off Insights → Barbers** (`src/pages/Reports.tsx` + test) | `261fed1` — verified in `main` (original `f494f16` is an unreachable orphan object; do not cite it) | **Not live on `hosting:salown`** (`ROADMAP`: `PUSHED_NOT_LIVE`) | Lowest risk in this table — display-only, 2 files. Its only real risk is that a plain `main` build drags M1/M3 with it | **Ship alone, or wait and ride with a larger Admin release?** | If shipped alone: cherry-pick onto the live Admin base in an isolated workspace, exactly as the `INSIGHTS-PASSIVE-BARBER` audit prescribed |
| M5 | **Per-function staleness** — 52 distinct source generations live, some from July | per function | Each live function runs its own snapshot; **no live-only code anywhere** | Redeploying any one function ships `main`'s **whole** `functions/src` into that function's runtime, so it inherits every shared-module change since it was last deployed (`createBooking.ts` staff policy gate, `paymentAllocation.ts`, parsers, `emails/i18n.ts` — the last of which is **actively claimed** by `CUST-LANG-AUDIENCE`). **Additional finding this session:** `functions/src/index.ts` on `main` exports `salownWhatsAppOnBookingCreated` / `…OnBookingConfirmed` / the webhook, each declaring `WHATSAPP_SEND_SECRETS`; those secrets do not exist yet (B7 blocked on the Meta side). A blanket `--only functions` deploy would therefore try to **create** WhatsApp triggers — never run one | **None now.** Standing rule to confirm: functions deploys are per-function and named, never blanket | Before any single-function deploy, produce that function's ride-along diff list (shared modules changed since its own generation) and state it in the approval request |

---

## 2. Hosting anomaly — the third Staff bundle ⚠️ escalate

**Verified live, read-only, 2026-09-20 (plain public `GET`, no tooling against the project):**

| Copy | Entry chunk | Note |
|---|---|---|
| `https://salown.com/staff-bundle/index.html` | **`staff-CRqN2rBX.js`** (HTTP **200**, 1,124,215 B) | the shadow copy |
| `https://staff.salown.com/index.html` | `staff-BVUJwYTL.js` (1,122,493 B) | the real Staff app |
| `main`, tracked artefact | `staff-CxdWlU6-.js` | a third, different hash |

**New evidence beyond the audit — this is not only an unversioned copy, it is a pre-enforcement one.**
Callable-name string literals survive minification, and the two bundles differ exactly where it matters:

| Callable literal | shadow `CRqN2rBX` | live Staff `BVUJwYTL` |
|---|---|---|
| `salownCreateStaffBooking` | **absent** | present |
| `salownCreateStaffWalkIn` | **absent** | present |
| `salownCreateWalkIn` (legacy, no D1-D7 enforcement) | **present** | absent |

So `salown.com/staff-bundle/` is serving a Staff App build from **before** `STAFF-AVAIL-GAP` Phase 1+2,
which routes walk-ins through the legacy unenforced callable.

| Field | Content |
|---|---|
| **Current SHA** | None — it is a *tracked build artefact* (`hosting/staff-bundle/**`), not a source state. The served hash matches neither `main` nor the live Staff site |
| **Live status** | Publicly reachable, HTTP 200, today |
| **Why it keeps changing** | `firebase.json` declares `hosting[salown].public = "hosting"` (the whole directory, `staff-bundle` inside it) and `hosting[salown-staff].public = "hosting/staff-bundle"`. **Both `predeploy` hooks fire regardless of `--only`**, so every Admin deploy rebuilds and republishes a fresh, unpublished-elsewhere Staff build under `salown.com` |
| **Risk** | A staff member (or anyone) loading that URL runs a Staff App whose server-side availability protections were never shipped, plus a registered `sw.js` that can keep it alive in a browser. It is also the root cause of the recurring "stash before pull" friction, and of `REL-1`'s rule that a `hosting:salown` deploy dirties `hosting/staff-bundle/**` |
| **Owner decision required** | **(a)** stop publishing it under `salown.com` — add `hosting/staff-bundle/**` to `hosting[salown].ignore` only (the `salown-staff` target's own `public` path is unaffected); **(b)** additionally untrack the artefact and let `build:staff` generate it; **(c)** accept and leave it. (a) and (b) are independent and can both be taken |
| **Recommended safe next step** | Prepare (a) as a one-key `firebase.json` change **plus a test that asserts the ignore rule and that both hosting targets still resolve**, claimed and pushed, **not deployed**. Treat the pre-enforcement finding as an `INCIDENTS.md` candidate once the owner has decided — the fix is what closes it, not the discovery |

---

## 3. Security/config — Storage rules live outside the repo

| Field | Content |
|---|---|
| **Current SHA** | **None in this repo.** Verified: `firebase.json` on `main` has keys `hosting`, `functions`, `firestore`, `emulators` — **no `storage` block**. The only `storage.rules` file on the machine sits in `whitecross-site` and was never audited (`FIRESTORE-RULES-SSOT-P0` closed leaving this explicitly OPEN) |
| **Live status** | Ruleset `4c00eef7-e45c-4b35-856a-b0e911018990`, updated 2026-05-24T19:56:00Z (per the audit; not re-fetched here — `AGENTS.md` forbids `gcloud`/`firebase` calls from a working session) |
| **Content** | `allow read: if true` on every path of the default bucket; `allow write: if request.auth != null` |
| **Risk** | Every object in the bucket is world-readable by URL, and any authenticated user of **any** tenant may write to **any** path. No review gate, no emulator test, no CI guard covers it — the same class of defect `FIRESTORE-RULES-SSOT-P0` fixed for Firestore, still open for Storage |
| **Owner decision required** | **(1)** Does `salown-app` become the single authority for Storage rules, exactly as it is for `firestore.rules`? **(2)** Tighten immediately, or first inventory what actually lives in the bucket and which surfaces read it unauthenticated (logos, cover photos and salon-site images are plausibly *intended* to be public)? |
| **Recommended safe next step** | Source-side inventory first (grep every upload/download path in `salown-app` + `whitecross-site` and list which are customer-public by design), then a **draft** ruleset with emulator tests in the repo. **Do not import `whitecross-site/storage.rules`** — a mirrored ruleset silently becomes wrong when the target moves; write it against the real path population. Deployment is a separate, later approval and goes last, after any code that depends on it |

---

## 4. Orphan Functions — `onBookingCreated` / `onBookingConfirmed`

| Field | Content |
|---|---|
| **Current SHA** | **None. Unbuildable from either repo.** Verified this session: `git grep` over `origin/main:functions/src` in salown-app returns only a *comment* mentioning the whitecross names; `whitecross-site` `origin/main` has `onBookingConfirmedPush` (a different export). Neither `onBookingCreated` nor `onBookingConfirmed` has an entry point anywhere |
| **Live status** | Deployed 2026-05-22, `us-central1`, no codebase label. Trigger: `tenants/eekurt/bookings/{id}`. `onBookingCreated` flips `PENDING → CONFIRMED` and pushes Telegram + an Apps-Script webhook. **Dormant:** only deploy-day log entries, and `tenants/eekurt` does not exist in Firestore (EeKurt left the platform 2026-07-18, `TENANTS.md`) |
| **Risk of keeping** | Two unreviewed functions in a region nothing else uses, holding Telegram and Apps-Script credentials of unknown provenance, which would fire on any write to that path. They are invisible to every repo-side guard |
| **Risk of deleting** | **Irreversible** — there is no source to redeploy from. If EeKurt data were ever restored, the behaviour is gone silently. A `us-central1` delete is also outside every deploy path this project uses, so it is a hand-run production action |
| **Owner decision required** | **Delete, or keep and document as known-dormant?** Deletion is not urgent — no tenant exists at that path |
| **Recommended safe next step** | Before any delete: download both deployed source packages from GCS and commit them to `docs/evidence/orphan-functions-2026-05-22/` as the **only** archive that will ever exist; re-confirm `tenants/eekurt` absence; then one named delete, recorded in `RELEASE_LEDGER.md` with "rollback: none — source archived at `docs/evidence/…`". **Not done in this session** |

---

## 5. Deliberately not reopened

Booksy summary, receipt `buildPaidTodayMethodLabel`, Treatwell pay-at-venue, tip base, apply-once +
`checkoutRevision`, and the "Paid online" label fix are **closed alignments**. §1 of the audit proves
they left no live-only residue. They are not to be re-ported, re-cherry-picked or re-audited.

`9c7bf91` (receipt tender label branch) stays superseded by the forward-ported `c67da9e` — owner decision.

---

## 6. What is blocked on an owner decision, in one list

1. Admin release scope — Finance M1 in or out (and therefore M3/M4 with it).
2. Whether M4 ships alone on the live Admin base.
3. `salown.com/staff-bundle/` — stop publishing (a), untrack (b), or accept (c). **Pre-enforcement bundle: decide first.**
4. Storage rules authority + tighten-now vs inventory-first.
5. Orphan functions — delete after archiving, or keep documented.

Nothing in this document authorises a deploy, a merge or a deletion.
