# Connect and new-salon profile readiness

Source audit: 2026-09-10. Status: **local corrections and source findings; no production activation or deployment**.

This is a handoff for the interrupted documentation/readiness task. Source evidence is from salown-app `1455ca2` plus claim-only commits, before the narrow onboarding correction below. Live identities in the linked release documents are dated measurements, not newly verified live state. No real customer booking, Stripe connection or public profile was created by this audit.

## 1. Answers and evidence

**Is a new member's Online Profile immediately ready and published? No.** Both tenant creation paths initialise `profileStatus: 'draft'`, `profileSelfManaged: false` and `onboardingComplete: false` (`functions/src/index.ts`, `provisionTenant` around 340 and `approveApplication` around 3594). The wizard completion only changes `onboardingComplete`. It neither publishes the profile nor demonstrates a successful anonymous booking.

There are three different outcomes:

| Outcome | Source behaviour | What remains to prove |
|---|---|---|
| Account and tenant exist | Self-signup and application approval are separate provisioning paths | Exercise both with synthetic users in an isolated environment |
| Public booking page | `salownSyncPublicBooking` writes `public/booking` independently of profile status; `_buildPublicBooking` supplies display/payment flags | Services, staff, working hours and availability must yield a usable anonymous booking flow; trigger existence alone is insufficient |
| Published salon profile | Standard salon submits for review; self-managed salon follows a separate publish path | Moderation must keep drafts private and prevent publication on invalid data; see P1 below |

**Can Connect simply be switched on now? Not on this evidence.** Its writer and the checkout prepaid resolver disagree for full payment and refunds. B1 is the Whitecross external-account fee ledger; it is not the salOWN Connect integration and does not close this defect.

## 2. Confirmed source defects and limits

### C1 — Connect writer/reader/refund contract (activation blocker)

`salownConnectWebhook` in `functions/src/index.ts` around 4224–4249 writes `stripeAmountPaid`, `paidAmount`, `paymentType: FULL/DEPOSIT` and Stripe IDs. This update does not stamp `paymentProvider` or `platformDepositAmount`. `resolvePrePaidAmount` in `src/firestoreActions.ts` around 280–312 gives refund precedence only to `EXTERNAL_CHECKOUT`, otherwise reads a stored platform deposit or legacy DEPOSIT `paidAmount`, and returns zero for the remaining cases.

Consequences from those source paths:

- A FULL Connect payment without a previously stamped platform deposit resolves to zero prepaid at the desk.
- A refunded Connect DEPOSIT can still resolve to its original `paidAmount`.
- Merely stamping `platformDepositAmount` on capture does not prove correctness after a refund; a stored snapshot can become stale.

These are source contract findings, not observations of a newly executed live payment. A fix must cover the actual booking-creation, capture, refund and checkout paths together. Coordinate with the C2b parity owner; do not introduce a second allocation model or assume all canonical readers are missing. COA rejection is a separate defence, not a correct prepaid display.

### C2 — OAuth callback hardening (before new Connect activation)

`salownConnectCallback` around 3875–3898 inserts query `error` directly into an HTML response. It also consumes state with separate read/delete operations and suppresses delete errors. The source therefore lacks HTML escaping for that reflected value and an atomic one-use state boundary. No exploit or live callback was sent during this audit.

Use fixed/escaped error output, strict scalar input checks and atomic nonce consumption, with expiry and replay tests. The redirect is currently fixed to the production callback; a staging rehearsal must use an explicitly isolated redirect/configuration, never reuse that target accidentally. Do not infer a successful connection from the presence of OAuth functions alone.

### P1 — Publishing writes before review (publication blocker)

`salownPublishProfile` around 133 calls `buildPublicProfile` to validate. That helper (`functions/src/tenants/index.ts`, around 103) already writes `tenants/{id}/public/profile`. The standard branch subsequently deletes it and suppresses deletion errors before marking the tenant `pending_review`. The source rules grant anonymous reads to `public/{doc}` (`firestore.rules`, around 757).

This sequence can expose an unreviewed projection between write and delete; a failed delete can leave it present. The self-managed branch also marks the profile published even when `profileChecks` returns issues. The UI (`OnlineProfile.tsx`, `handlePublish`, around 1156) then reports “Fix before publishing” instead of updating its displayed published status when issues exist.

Separate read/build/validate from public writes. Standard submission must not create public content, and publication/status must be consistent on failures. Explicitly retain the intended standard-review versus self-managed policy; do not silently make every signup public. Test draft submission, rejection, approval, invalid self-managed submission, concurrent edits and failed persistence in an emulator. This audit does not claim that public exposure was observed in production.

### P2 — Wizard completion (narrow local correction)

Previously `StepLive` called `onComplete()` even when saving `onboardingComplete` failed and displayed “You're live!” without a publication check. The local change keeps the user in the wizard on save failure with a retry message, calls completion only after successful persistence, and labels the booking link separately from Online Profile publication. This is not an automatic publication feature. It is not live until a separately reviewed hosting release.

## 3. Documentation corrections in this package

- Preflight has one source for candidate identities (§1), removes a duplicated contradictory “only B1” table fragment and dates its live snapshot. Later instructions point back to that table and require rechecking it.
- The processor fee plan distinguishes implemented/rehearsed B1 from planned later packages.
- ROADMAP no longer treats the absent server-side COA rule as proof that no client-side over-allocation guard exists. Connect stamping alone is no longer described as a proven complete fix.
- PROGRESS preserves unresolved loyalty-toggle and public-hours checks, distinguishes historical tenant evidence from deletion conclusions, and avoids equating code package values with approved commercial policy.
- TENANTS recognises the self-signup path and dates the reported absence of the EeKurt root document. Neither data preservation nor deletion cause was proved here.
- CLAUDE no longer says Connect requires only a secret switch; it points to the remaining readiness evidence.

## 4. Ordered continuation prompt

Use this section as the master prompt for the next implementation session.

> Continue the Connect/profile readiness task from this document. First read AGENTS.md, CLAUDE.md, ROADMAP, the current claims and the latest commits. Treat dated live snapshots as historical until refreshed by an authorised release owner. Do not deploy, enable payments, connect a live Stripe account or publish a real salon profile under this implementation task.
>
> 1. Check ownership before editing. Preserve FIN-B1 rules/index and settlement claims, the C2b parity fixtures and SYNC claim, and any newer claims. Use separate commits and explicit paths. A claimed path is a coordination dependency, not permission to append. Do not send another session a message without the owner's messaging authorisation; prepare a concise handoff when needed.
> 2. Fix P1 as one bounded profile-publication package, with emulator tests proving that standard submission never writes public content, validation failures never publish, and publication status agrees with stored content. Keep the existing moderation policy. Complete isolated signup and invitation flows through service/staff/hours setup, anonymous booking and profile review; report booking readiness and profile publication separately.
> 3. Fix C2 OAuth input/output and one-use state handling. Add tests for malicious error text, malformed inputs, expired/replayed state and concurrent consumption. Keep platform mode, account identity and redirect configuration explicit; use test mode for the rehearsal.
> 4. With the C2b owner, pin one payment contract for C1. Drive actual writer outputs into the actual checkout readers. Cover FULL, DEPOSIT, partial/full refund, checkout retry, duplicate/out-of-order webhook, desk remainder, totals and existing EXTERNAL_CHECKOUT/legacy behaviour. Do not stamp a compatibility field and declare parity without those tests. Keep canonical allocation and advance-ledger responsibilities intact.
> 5. Rehearse the chosen Connect implementation only in an explicitly authorised isolated environment: connected-account test events, server-priced checkout, refund reflection, desk prepaid/remainder and accounting views. Verify account readiness and tenant feature configuration independently. A test payment on Whitecross's external account is not a Connect rehearsal.
> 6. Update only owned documentation with tested source SHA, evidence limits and status (local, pushed, staged, live). Prepare the exact live target salon/account, release deltas and rollback before requesting a single concrete production activation approval. COA/B1 release dependencies remain separate and must not be silently bundled.

No production approval is implied by this prompt. If an ownership dependency blocks one package, continue an independent unclaimed package and report the precise blocked paths.

## 5. External reference boundaries

The current code is a Standard-account OAuth integration. Check the applicable Stripe API version rather than migrating account models incidentally. References consulted for the source audit:

- [Standard account OAuth](https://docs.stripe.com/connect/oauth-standard-accounts) and [OAuth reference](https://docs.stripe.com/connect/oauth-reference): state and the OAuth exchange.
- [Connect webhooks](https://docs.stripe.com/connect/webhooks): connected-account events and test delivery are distinct from a platform-only payment rehearsal.
- [Account capabilities](https://docs.stripe.com/connect/account-capabilities): account readiness must be checked; successful OAuth alone is not sufficient proof of usable payments.

## 6. Coordination and validation record

The audit claim reserves only the listed documentation files and `OnboardingWizard.tsx`. No payment/rules/settlement implementation was changed. `SYNC.md` is owned by C2B-B0-PARITY, so this record is kept here instead of writing through that claim. The earlier 166/182/221 test totals belong to their respective historical packages and are not claimed as rerun for this change.

Validation on 2026-09-10: `npm run typecheck` passed; temporary execution of the actual `StepLive` callback with mocked hooks/Firestore passed pending, success, failure and retry checks. These are callback checks, not a browser or emulator rehearsal. `git diff --check` passed in both repositories; the preflight table has five columns on each row; claims validation found no conflicts. No new full signup, OAuth, live API or publication rehearsal was performed by this package.
