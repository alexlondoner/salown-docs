# Release plan — `TW-PAY-AT-VENUE-UI` (prepared 2026-09-17, NOT executed)

**What changes for the salon when this is live:** a Treatwell pay-at-venue booking no longer looks like
a debt. It is listed with the active (Confirmed) appointments, the panel no longer says "saved as
Unpaid", and No Show can be used. No stored status, revenue, receivable or checkout amount changes.

**Owner approval required before any step below that writes.** No merge and no deploy has happened.
Evidence: `evidence/tw-pay-at-venue-ui/2026-09-17-candidates/`.

## Scope

| Target | Candidate | Branch | Built from |
|---|---|---|---|
| `hosting:salown` (Admin) | **`503bdff`** | `release/admin-tw-ui-and-discount-on-live-c8a64d6` | live Admin source `c8a64d6` + the fix + the platform-discount breakdown (see below) |
| `hosting:salown-staff` (Staff) | **`76e58fe`** | `claude/tw-pay-at-venue-staff-on-live-aa2efd9` | live Staff source `aa2efd9` + the fix |

**Not in this package:**

- Finance/Stripe code. The candidate diffs contain no `OnlinePaymentFees`, `settlementFacts` or
  Stripe lines, while main's `74922bd`/`9a4925c` are PUSHED_NOT_LIVE.
- The Booksy discount (Happy Hours) UI **is now part of the ADMIN candidate** (owner decision,
  2026-09-17) — see "Why one Admin candidate" below. The Staff candidate is unchanged and does not
  contain it.
- Any Functions, rules or index change.
- The Treatwell parser/notification release.

The Staff candidate's source delta over its base equals the fix delta (`0d31b79` + `6d00628`) at hunk
level. The Admin candidate is that same delta plus the discount delta, and nothing else.

### Why one Admin candidate

`PLATFORM-DISCOUNT-BREAKDOWN` (`feat/platform-discount-breakdown` @ `982a683`, built on `main`) and
this fix (`6b3f19f`, built on the live Admin source) both change
`src/components/BookingDetailPanel.tsx`. Released one after the other from their own bases, whichever
went second would carry its base's version of that file and silently revert the other. So they are
released once, together:

`release/admin-tw-ui-and-discount-on-live-c8a64d6` @ **`503bdff`** = `6b3f19f` + `3910aa7` + `982a683`
(cherry-picks, clean). Containment checked mechanically on the candidate: the whole TW src delta
`c8a64d6 → 6b3f19f` reverse-applies, and so does each file of the discount delta. `BookingDetailPanel`
carries both (`PlatformDepositRows`/`readPlatformDepositSummary` and the unpaid-state classification).

Gates on the candidate: `tsc` 0 · touched-area suites 91/91 (`platformPaymentSummary`, `unpaidState`,
`salesPeriod`) · full vitest 5562 passed, the only failure being the `functionsArchiveManifest`
negative control that depends on the developer checkout's own untracked files · `vite build` OK.

What the salon sees from the discount half: a platform deposit booking shows Normal price → Discount
· N% → Total → Deposit paid → Remaining at venue, with the normal price taken from the import-time
snapshot (never today's catalogue), the total unchanged and no reason claimed unless the import
recorded a verified match. Post-release check §3 should therefore also look for `Remaining at venue`
plus `Normal price` on a Booksy deposit booking.

**Deploy order:** the two targets are independent. Recommended: Admin first, then Staff, one at a
time, following the one-change-per-release habit. Staff may wait. The only mismatch meanwhile is
the Staff pill still reading "Unpaid".

## 1. Pre-release checks (read-only; stop on any mismatch)

1. **Live identities are still the verified ones.**
   ```bash
   firebase hosting:channel:list --site salown --project havuz-44f70 --json        # live: release 1789224104649000, version 827946e295c69eeb
   firebase hosting:channel:list --site salown-staff --project havuz-44f70 --json  # live: release 1789477084532000, version 27b0c5187cb9976b
   ```
   If either live release differs, another deploy has happened. Stop. Identify that release's
   source and rebuild the candidate on it (the same method as below). Do not deploy these SHAs.
2. **Live bytes still equal the bases** (the method used on 2026-09-17):
   - `git archive c8a64d6` → `npx vite build`. Compare every file under `hosting/public-bundle/`
     with `https://salown.com/public-bundle/<path>` (`curl -f`, status checked separately).
     Expected: 55/55.
   - `git archive aa2efd9` → `npx vite build --config vite.staff.config.js`. Compare
     `hosting/staff-bundle/` with `https://staff.salown.com/<path>`. Expected: 25/25.
3. **Candidates are unchanged.** `git ls-remote origin` shows the two branches at `6b3f19f` / `76e58fe`.
4. **Claims.** `./ops/claims/claims.sh list` shows no active claim on the Admin/Staff release paths.
   The releasing session takes a release claim.

## 2. Release — one isolated workspace per target

Never deploy from the shared checkout (REL-1). Never use a registered `git worktree`
(`ops/rules-authority` counts them). Give the workspace its own `npm ci` install, not a symlink to
the shared `node_modules`: a symlink rewrites the shared dev server's Vite cache.

**Admin**
```bash
git archive 6b3f19f | tar -x -C <ws-admin>      # outside ~/Desktop/alex
cd <ws-admin> && npm ci
npx firebase deploy --only hosting:salown --project havuz-44f70 --non-interactive
```
The `salown-staff` predeploy hook also runs (known CLI quirk). It only rebuilds inside the
discarded workspace, and `hosting:salown-staff` is not released by this command.

**Staff** (a separate workspace, after the Admin checks pass)
```bash
git archive 76e58fe | tar -x -C <ws-staff>
cd <ws-staff> && npm ci
npx firebase deploy --only hosting:salown-staff --project havuz-44f70 --non-interactive
```

Record each new release/version ID from `hosting:channel:list` in `RELEASE_LEDGER.md`.

## 3. Post-release verification — served bytes, per target

1. **Prove the URL first** (CLAUDE.md "asset path"):
   `curl -s https://salown.com/app | grep -oE 'src="[^"]*index-[^"]*\.js"'` → `/public-bundle/assets/index-….js`.
2. **Full compare with `set -o pipefail`, every file with `curl -f`.** Admin: every file of the
   workspace's `hosting/public-bundle/` against `https://salown.com/public-bundle/`. Staff: every
   file of `hosting/staff-bundle/` against `https://staff.salown.com/`. Expect all identical and
   all HTTP 200.
3. **Marker strings, as a secondary check.** These strings were observed in the 2026-09-17
   candidate builds:
   - Admin index chunk: `Pay at venue — no payment taken online` and `AWAITING_VENUE_PAYMENT`.
   - Staff `staff-*.js`: `PAY_AT_VENUE`, `Pay at venue` and `AWAITING_VENUE_PAYMENT`.

   Do not use component names such as `OnlinePaymentFees` as absence proof: minification renames
   them. The exclusion of Finance code is proven at source level (the candidate diff) and by the
   full byte compare against the candidate workspace build.
4. **Behaviour** (owner, real panel, no writes needed): a Treatwell pay-at-venue booking shows
   "Pay at venue", appears under Confirmed, is absent from Unpaid, and shows No Show. A booking
   saved unpaid at the till still shows the Unpaid banner.

## 4. Rollback — per target, by VERSION ID

- **Admin:** Console → Hosting → site `salown` → Release history → version **`827946e295c69eeb`** →
  ⋮ → Roll back.
- **Staff:** Console → Hosting → site `salown-staff` → Release history → version
  **`27b0c5187cb9976b`** → ⋮ → Roll back.

Roll back only the target that failed. The two are independent. `hosting:clone` is not a rollback
tool. After a rollback, repeat §3 step 2 against the base rebuild.

## 5. Main integration — so the next main deploy does not lose the fix

The release branches are cherry-picks onto old bases. **Never merge `6b3f19f` / `76e58fe` into
main.** Main receives the fix branch:

- Source: `claude/tw-pay-at-venue-ui` @ `6d00628` (commits `0d31b79`, `6d00628`, both `[skip ci]`).
- Mergeability: `git merge-tree --write-tree origin/main origin/claude/tw-pay-at-venue-ui` is clean
  at main `a3e2a4a`. No Admin/Staff source changed on main since the fix's base `1036b58`.

Steps (owner-approved, after or together with the candidate release):

1. Claim the fix paths (the same list as `TW-PAY-AT-VENUE-UI-R2`), then `git pull --rebase`.
2. Merge with a `[skip ci]` merge commit (or fast-forward-rebase the two commits). Every outgoing
   commit must carry `[skip ci]`, as `ops/release-guard.sh` requires. Otherwise the `src/**`
   change starts the CI Admin deploy from main, and that deploy would carry main's Finance
   passengers.
3. Run the targeted suite on main (`unpaidState` + `salesPeriod` + `src/i18n`) and
   `npm run typecheck`. The wiring anchors in `unpaidState.test.ts` fail if a later change drops a
   surface.
4. Push, release the claim, and write a SYNC row.

**Gate for every later main-based `hosting:salown` / `hosting:salown-staff` release** (add to that
release's preflight):

- `git merge-base --is-ancestor 6d00628 <release SHA>` succeeds.
- The built bundle contains `AWAITING_VENUE_PAYMENT`.

A main release cut before step 2 would silently revert this fix. Until the fix is on main, any
other Admin/Staff release must be cut from a tree that contains it, or it must re-apply it.

## 6. Tracked separately (not in this package)

- `PANEL-HOVER-STATUS-LABEL`: the Dashboard grid hover card labels a stored `UNPAID` booking
  "CONFIRMED".
- `NOSHOW-PAYMENT-DUE-COPY`: a `NO_SHOW` platform booking still shows "Payment due" in the panel.
- `CALENDAR-PAGE-UNROUTED`: `src/pages/Calendar.tsx` is not routed.
- `TW-REIMPORT-CLOBBER`: a Treatwell re-import replaces the whole booking document.
