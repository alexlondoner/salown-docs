# HANDOFF — LEAVE-CLOSE-BUTTON Admin release CANDIDATE (2026-11-25)

**Status: READY (candidate only). NOT deployed, NOT pushed, no owner approval yet.** Related: `HANDOFF_LEAVE_CLOSE_BUTTON_2026-11-25.md` (root cause / fix).

## Candidate
- Branch (local only): `release/leave-close-on-live-61d9b54a`, worktree `~/release-work/leave-close-admin-20261125/cand`
- **Candidate SHA `a7fb579fd63e16a4f95e44f07c9f955603b36b76`** (tree `4924a7bfa26575ba87cbb3d1a93c0a63f5861cb3`) = live source `61d9b54a` + `75bc4b5e` (= cherry-pick of `9ed6592f`, fix + 8 render tests) + `a7fb579f` (test-only: "no re-send" assertions).
- Changes vs live source: `src/pages/Barbers.tsx` (+41/−21) and `src/pages/Barbers.leaveClose.render.test.tsx` (new). Nothing else. Special Hours and all other live behaviour untouched.
- Claim `LEAVE-CLOSE-BUTTON` (main `36e4a9d8`) still `working`; close it when released/abandoned.

## Pre-state (live, measured 25 Nov)
- `hosting:salown` live version **`3ad05c035c7553bd`**, release `1795616616368000` (14:23:36Z), 104 files (= 102 uploaded + Firebase-reserved `__/firebase/init.js|json`). Matches ledger R-2026-11-25-A..F.
- **Source parity proven:** clean `git archive 61d9b54a` + own `npm ci` (284 pkgs) + `vite build` → **102/102 files byte-identical (full SHA-256) to what `https://salown.com` serves** (`base-vs-live.tsv`); file-path set equals the live version's file list (`live-files.json`, Hosting REST) apart from the 2 reserved files. Base manifest digest `004afe7f…d56b2`.
- Note: `61d9b54a` is NOT an ancestor of main (main twin of Special Hours is `768181c6`/`bb8a5047`); candidate is built on the live lineage, not main.

## Candidate build
- Built twice (clean `rm -rf hosting/public-bundle`, own `npm ci`) plus once more on the final commit: **manifests identical**, 102 files, **manifest digest (sha256 of `cand-manifest-1.txt`) `c281f164ea23f9f9754c50efdc9d2cbe2ae37a9dd00bec18817b968edcd51835`**.
- Bundle diff vs live (`base-manifest.txt` ↔ `cand-manifest-1.txt`): 70 files unchanged. **One real content change: `Barbers-Bhpxc0EH.js` → `Barbers-CjJKkiXh.js` (172,722 → 173,096 chars, +374).** The other 29 JS chunks are renamed only (hash cascade: after normalising chunk-hash names they are byte-identical); `public-bundle/index.html` and `reset-password.html` change only by referencing the new entry `index-B6LWawvT.js` (was `index-CKPRYHUh.js`). Static root pages, emails, images unchanged. Upload set size 102, no new/removed logical files.
- Candidate key files: `public-bundle/assets/Barbers-CjJKkiXh.js` `db355fa3…ffe25`; `index-B6LWawvT.js` `4849bc19…e69df`; `public-bundle/index.html` `83683c2d…bfee09`.

## Tests / gates (on the clean candidate lineage)
- 8 new render tests (real `Barbers`, mocked firebase + callable boundary): **8/8 pass**. They run in a SEPARATE copy (`cand-test`) because the live lineage's `package.json` has no `jsdom`/`@testing-library`; they were installed `--no-save` there, candidate `package.json`/lock untouched.
- Explicit no-resend checks (5a unexpected throw, 5b write ok + refresh failure): Close enabled, send control + confirm input gone, Enter/Ctrl+Enter ignored, callable called exactly once. Honest scope: the UI offers no re-send path after a result; the ref/key guards are defence in depth and are exercised through the single-click/double-click/close-while-pending tests, not by calling `submitLeave` directly.
- Lifecycle: `functions/lib` built with the candidate's own `functions/` deps (`npm ci` 766 pkgs, `npm run build`); `staffLifecycle.test.ts` **121/121 pass** (previous 10 failures were the missing lib, not code). The 293 source-guard tests were not re-run (unchanged files).
- Lint: `Barbers.tsx` = 1 error `rehireRota` unused (line 349) — **identical on live source**; not fixed. `tsc --noEmit`: base 90 errors, candidate 91; the single extra is the new test's `@testing-library/react` import (same class as 15 existing errors in live lineage, whose package.json lacks the dep). No unrelated error fixed.
- Admin build: OK ×3, deterministic.
- NOT done: manual browser check of the leave flow; Muhamed's real leave not re-submitted; no live call of any kind.

## Deploy plan (for the owner-approved step — not executed)
1. Fresh clone/worktree of `a7fb579f`, `npm ci`, `vite build`, confirm manifest digest `c281f164…1835`.
2. `firebase deploy --only hosting:salown --project havuz-44f70` from that tree (targeted; never unscoped `--only hosting`).
3. Post-check: `curl -s https://salown.com/app | grep -oE 'src="[^"]*index-[^"]*\.js"'` → expect `index-B6LWawvT.js` under `/public-bundle/assets/`; `curl -fsI` 200; then full SHA-256 of every upload-set file vs `cand-manifest-1.txt` (use `verify_served.sh`, run it with the candidate tree and compare). Expect new version ID ≠ `3ad05c03…`; 104 files.
4. Owner check: Team Members → a test member → Put on leave sheet → after a result, Close closes. Do NOT use Muhamed's real record.

## Rollback (NOT rehearsed)
- Target: previous live version **`3ad05c035c7553bd`** (release `1795616616368000`).
- Preferred: Firebase Console → Hosting → site `salown` → Release history → that version → ⋮ → Roll back (per CLAUDE.md; `hosting:clone` is not a rollback tool).
- Fallback (reproducible, also untried): deploy the verified base tree (`~/release-work/leave-close-admin-20261125/base`, clean `61d9b54a` build, manifest digest `004afe7f…d56b2`, proven byte-equal to live) with the same targeted command; then re-run `verify_served.sh`.
- **Neither rollback path was executed or tested. Version retention of `3ad05c03…` was not checked.** Treat rollback as "planned", not "verified".

## Artefacts (`~/release-work/leave-close-admin-20261125/`)
`base/` clean live-source build · `cand/` candidate worktree · `cand-test/` test copy · `base-manifest.txt`, `cand-manifest-{1,2,final}.txt` · `base-vs-live.tsv`, `live-files.json` · `verify_served.sh`, `manifest.sh` · `tsc-base.txt`, `tsc-cand.txt`.

## Open
- Offboard / rehire / availability-until sheets: out of scope, same pattern unaudited.
- Main twin of this fix is `9ed6592f` on `work/leave-close-button` (local); the extra no-resend assertions in `a7fb579f` are not yet ported there.
- Pre-existing: unused `rehireRota`; live-lineage package.json lacks test deps.

---
## Final pre-deploy checks (25 Nov, later) — no deploy, no push, no live write
1. **tsc, same conditions** (separate copies `base-test` / `cand-test`: own `npm ci`, `--no-save` jsdom + testing-library, own `functions/` `npm ci` + `npm run build`): **base 9 errors, candidate 9 errors, `diff` empty**; 0 errors mention `leaveClose`. The earlier "90 vs 91" was an unequal environment (no test deps / no `functions/lib` in base) and is superseded. Release `package.json` / `package-lock.json` of the candidate are byte-identical to live source `61d9b54a`. Files: `tsc2-base-test.txt`, `tsc2-cand-test.txt`.
2. **Rollback target, read-only (Hosting REST GET):** version `3ad05c035c7553bd` exists, **status FINALIZED**, 104 files, 4,040,213 bytes, finalized 2026-11-25T14:23:35Z; it is the current `live` channel release `1795616616368000` (type DEPLOY). Four earlier FINALIZED versions are also listed (`bf72e458…`, `ae5dfbf5…`, `865a6003…`, `cc5d24ee…`). Existence/FINALIZED is verified; **the rollback itself was NOT executed or rehearsed — "rollback verified" does not apply.**
   - **Committed rollback path:** Firebase Console → Hosting → site `salown` (project `havuz-44f70`) → Release history → version `3ad05c03…` (release 25 Nov 14:23) → ⋮ → **Roll back**. Afterwards: `curl -s https://salown.com/app | grep -oE 'index-[^"]*\.js'` must show `index-CKPRYHUh.js`, then `verify_served.sh` against `base` must give 102/102 MATCH.
   - There is no supported CLI "roll back to version" command (`hosting:clone` takes `site:channel`, not a version). Fallback = redeploy the clean `base` tree (manifest `004afe7f…d56b2`, byte-equal to live) with the same targeted `--only hosting:salown`. Untested.
3. **Extra no-resend assertions on the main work branch:** `a7fb579f` cherry-picked onto `work/leave-close-button` as **`c55cd3b8`** (test file only, +13 lines; `Barbers.tsx` still identical to `9ed6592f`; test file byte-identical to the candidate's). 8/8 render tests pass there. Not pushed.
**Candidate SHA and digests are unchanged:** candidate `a7fb579fd63e16a4f95e44f07c9f955603b36b76`, tree `4924a7bf…`, manifest digest `c281f164ea23f9f9754c50efdc9d2cbe2ae37a9dd00bec18817b968edcd51835` (the new commit touches no shipped file).

---
## RELEASED — `hosting:salown` LIVE (25 Nov 2026, 22:02Z / 22:02 UK)
Owner-approved, ONE target, ONE attempt, isolated firebase-tools 15.26.0 (`~/release-work/leave-close-admin-20261125/fbtools`), from a fresh archive of `a7fb579f` (`.../deploy`), own `npm ci`. Command: `firebase deploy --only hosting:salown --project havuz-44f70`. Exit 0; "found 102 files", version finalized, release complete. Log: `deploy-output.txt`.

**Pre-flight pins (all matched before deploy):** live `salown` = `3ad05c035c7553bd` (release `1795616616368000`); candidate HEAD `a7fb579fd63e16a4f95e44f07c9f955603b36b76`, tree `4924a7bf…`, clean; manifest digest of the fresh pre-deploy build = `c281f164ea23f9f9754c50efdc9d2cbe2ae37a9dd00bec18817b968edcd51835`; 10 hosting sites' live versions recorded (`sites-pre.tsv`).

**Result**
- `salown` live: **`3ad05c035c7553bd` → `0490cef0f6e290da`**, release **`1795644122054000`** (2026-11-25T22:02:02Z), FINALIZED.
- Version file list: 104 = **102 uploaded** (set identical to the candidate manifest; no live-only/local-only) **+ 2 Firebase-reserved `__/firebase/init.js`, `init.json`** (counted separately; their bytes were not compared).
- **Served bytes vs candidate manifest: 102/102 full SHA-256 MATCH, 0 DIFF** (`deploy-vs-live.tsv`). `https://salown.com/app` now loads `/public-bundle/assets/index-B6LWawvT.js` (candidate entry).
- **Other 9 hosting sites unchanged** (`diff sites-pre.tsv sites-post.tsv`: only `salown` differs). `salown-staff` is at `a42ae43f13547821` (release `1795632947042000`, before this deploy; it is not the version in the ledger and was not touched by this step).
- No deviation, no retry, no rollback. Functions, rules, Staff, mail, Muhamed's leave record: untouched. No leave operation re-sent.

**Rollback (still NOT executed/rehearsed):** Console → Hosting → `salown` → Release history → `3ad05c035c7553bd` (release `1795616616368000`, FINALIZED as of the pre-deploy check; re-confirm it is still listed) → ⋮ → Roll back. Expect `index-CKPRYHUh.js`, then `verify_served.sh` vs `base` = 102/102.

**Owner post-release check (not done by me):** Team Members → Put on leave sheet → after a result, **Close** closes. Do NOT re-send Muhamed's leave; no need to re-enter his dates.

**Not done / out of scope:** main integration (`9ed6592f`+`c55cd3b8` on `work/leave-close-button`), SYNC.md/ledger entry (R-id) and claim `LEAVE-CLOSE-BUTTON` closure — still open and need their own step.

---
## SOURCE + RELEASE RECORDS CLOSED (25 Nov, late)
- **Main twin pushed:** `cb4e8b0f` (fix) + `0a0fe163` (no-resend assertions), both `[skip ci]`, on `origin/main 5df0156e`. Verified on `origin/main`: `src/pages/Barbers.tsx` blob `3fcb3ab1b1e561ea8ec43f46b3f3359b5e999443` and `src/pages/Barbers.leaveClose.render.test.tsx` blob `ad3bf735bde88c4c4ff1bc129cb85f4bb8c14fc7` equal the live candidate's blobs; main's other changes preserved (cherry-pick, no file replaced).
- **Clean-archive verification of the main result** (`~/release-work/leave-close-main-verify-20261125/{head,base}`, own locks, `functions` built first): render 8/8; 7 related suites 356/356; Admin build OK; `tsc` 0 vs 0 (identical); eslint on `Barbers.tsx` identical to base (`rehireRota` pre-existing), test file clean.
- Records updated: `SYNC.md` (salown-app main), `RELEASE_LEDGER.md` R-2026-11-25-J, `ROADMAP.md`, this file. Claim `LEAVE-CLOSE-BUTTON` closed (removed).
- Still open: owner's live Close check; audit of offboard/rehire/availability-until sheets; rollback never rehearsed; pre-existing `rehireRota` lint error.
