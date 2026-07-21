# V1 RUNBOOK — Migration Closing Sprint (start: 2026-07-13)

> Owner decision (2026-07-12 night): "After the 12th we finish everything."
> Product-validation passed A DAY EARLY on the 12th (clean end-to-end, "did the salon
> notice?" → NO) → the calendar was pulled forward. This runbook was prepared the night of
> the 12th; all numbers verified from the live repo. Status SSOT: ROADMAP. Method constitution:
> TYPESCRIPT_MIGRATION_PLAN + MIGRATION_PATTERNS (22 patterns) + RC3_RUNBOOK result block.

---

## PHASE A — Closing screws (half a day, this first)

1. ✅ **Push + tag DONE (evening of the 12th, another session):** after the rebase, the rc3
   commit is **`df08b9c`** (73ce8f8 invalid), tag `v0.9.0-rc3` on the new hash,
   CI green, all surfaces 200. The staff-bundle artifact dirt is still in the working tree
   (another session's — DON'T TOUCH; no risk thanks to the CI predeploy).
2. **Move tests into src:** the 8 `*.test.js` files currently sit next to the ROOT copies
   and import them — they break once the root is deleted. With `git mv` into
   `src/<module>/` (relative imports keep working; the build already excludes
   `**/*.test.js`) + change the package.json test glob to `src/...`
   → `npm test` green (35 pass).
3. **Root copy cleanup (rc3's deferred commit):** the decision on the 22 runtime
   `.js` + `test-parser.js` + `_preview/` in the root → delete (the runtime already runs from
   `lib/`; NOTHING uses the root files). Then the proof triad:
   `npm run build` + export-parity 52/52 + `npm test`. Single commit:
   `chore(rc3): remove root .js originals — src/ is the single source`.
4. **Hosting closeout (independent, not code):** www → Firebase (console +
   GoDaddy CNAME) → remove GH Pages custom domain → **repo private** →
   update DEPLOY.md + project_whitecross memory (site deploy is now
   `firebase deploy --config firebase.saas.json --only hosting`; a GitHub push
   NO LONGER UPDATES the site).

## PHASE B — Functions `.js → .ts` (the real work; wave by wave, each file proven)

**Proof method (the backend counterpart of byte-proof v2 — "lib-diff"):**
because tsc emit is a deterministic printer, the lib output is stable. Per file:
```
cp -R lib <scratchpad>/lib-base
git mv src/X.js src/X.ts && <pure type annotation, behavior ZERO>
npx tsc --noEmit                 # 0 errors (editor config, fully checks the .ts)
npm run build && diff -r <scratchpad>/lib-base lib   # ONLY the X.js diff expected
node -e "<52-export-parity>"     # on waves that touch index
npm test                         # green
git commit (explicit path, refactor(ts): ... )
```
- If `diff` shows a diff OUTSIDE X.js → suspicion of Pattern 20 (import-elision) → STOP, diagnose.
- **Import style:** to keep the CJS emit byte-stable, `import x = require('y')`
  (TS-CJS syntax, emits as `const x = require('y')`) or the existing
  `const {a} = require('y')` stays AS-IS. DON'T SWITCH to ESM `import` — the emit changes.
- `strict` is still OFF (turned on in Phase C) — annotation minimal, `Rec`/`any` allowed
  (frontend patterns apply), a behavior commit is FORBIDDEN (§11).

**Wave order (small→large, money LAST; line counts as of 2026-07-12):**
| Wave | Files | Note |
|---|---|---|
| B1 — utils (tested, pure) | utils/ical 24 · bookings/shared 33 · utils/campaignMerge 51 · utils/parserTime 85 · utils/emailText 169 | Warm-up; parity tests already pinned |
| B2 — parsers (tested) | parsers/shared 86 · ical 223 · booksy 288 · treatwell 302 · fresha 368 | salOWN's most sensitive area (memory parser-priority) — 1 night of observation after the wave |
| B3 — domain | marketing 70 · finance/exit 87 · tenants 95 · clients/identity 127 (JSDoc→real types) · inbound 129 · notifications 171 · emails 279 | in identity @ts-check/typedef comes off, import type comes from shared |
| B4 — money | checkout/index 79 | Small but money — ON ITS OWN, ghost-smoke after deploy (rc3-ghost-smoke.cjs pattern) |
| B5 — templates | emailTemplates 618 | Pure string builder; preview scripts (_demo/_preview) can stay .js (allowJs, dev-only) |
| B6 — FINAL BOSS | **index.js 3619 / 52 exports** | See below |
- End of wave = targeted deploy (that wave's functions, `functions:salown:X,...`)
  + smoke; NEVER blanket. A night of observation before the money wave.

**B6 decision point (to ask the owner):** **in-place conversion** to index.ts (recommended:
single-variable principle — split stays as separate work in I2, doesn't block v1.0.0) vs
**split+convert together** (also finishes I2 but two big variables at once —
the same strategy A we rejected in rc3, not recommended). In-place conversion may take 2-3
sessions; each session an intermediate commit with lib-diff.

## PHASE C — v1.0.0 closeout

1. `strict: true` (functions tsconfig + does `noCheck` come off the build config → NO,
   the build stays emit-only; strict only on the typecheck config) + frontend tsconfig.
   The fallout is zeroed out file by file (byte/lib-diff proof continues).
2. **Accumulated cleanup list** (the inventory in project_ts_migration memory:
   dead imports/state/props) — ONE chore commit, behavior change allowed for the first time
   (the type-only rule is now over), still vitest+build+smoke.
3. `any` hunt: intentional anys marked `TODO(ts-migration)` are closed (target 0;
   any remaining with a justified inline comment).
4. Tag **v1.0.0** + `docs/ARCHITECTURE_V2.md` + TYPE_COVERAGE final dashboard +
   ROADMAP/memory closeout updates.

## ✅ RESULT — WHAT ACTUALLY HAPPENED (2026-07-13 night session, with wholesale owner approval)

- **Phase A ✅:** push/tag (df08b9c, previous session) · 8 tests moved to src
  (parity tests now read `HEAD:functions/src/index.ts` + source-text
  `index.ts`; identity frontend-mirror path +1 level) · the 22 root .js
  deleted (`57ce08e`) · hosting closeout ✅ (whitecrossbarbers.com+www =
  Firebase `whitecrossbarbers-saas`, GH Pages off, **repo private**,
  DEPLOY.md updated).
- **Phase B ✅ — FUNCTIONS 100% TYPESCRIPT (22/22 runtime files):**
  B1 `2897ef6→cf116d9` · B2 `846f2cc→e979f2e` (+targeted parser deploy,
  25 min live observation 0 errors) · B3 `6cf648b`+`227fd3d` · B4 `89b3a65` ·
  B5 `4ae1ad6` · B6 `7881cfe`. Proof chain on every file: tsc 0 · lib-diff
  isolated · export surface identical (renames `export { _x as x }`) · tests
  35/0. **Tests now test lib/ (the shipped artifact) + pretest build.**
  52/52 functions redeployed from the full-TS build (canary→8 groups→money last),
  smoke: brevo 200 · busy-slots · 5 frontend 200 · ghost loyalty end-to-end
  PASS · us-central1 27 legacy in place. Remaining .js = _demo/_preview (dev-only,
  intentional).
- **New patterns learned:** TS's CJS interop (@ts-check consumer +
  module.exports/export= → TS2459/2497) → **named export standard**; a
  non-enumerable `__esModule` appears in the emit (Object.keys/Firebase discovery UNAFFECTED);
  criteria/payload literal narrowings → `:any`; tsc emit pretty-print →
  lib-diff file-isolation proof instead of bytes.
- **Phase C ⏳ SEPARATE DAY (measured, decided):** `--strict` fallout = **355 errors
  (functions only)** + the frontend's intentional anys are a separate large slice.
  Zeroing money-adjacent code in a hurry at 2:30am is contrary to the proof culture →
  the v1.0.0 tag along with strict+any-zero+cleanup chore+ARCHITECTURE_V2 in
  a later session(s). The codebase is now END-TO-END TypeScript (frontend
  104/104 + functions 22/22) and all of it is live.

## Risks / rules (unchanged)
- Deploy = announce tenant+URL first; functions ALWAYS codebase-prefixed targeted.
- On a day the money file is touched, NO other high-risk work (firebreak spirit).
- On the 14th the feature-freeze lifts → other sessions can return to feature work;
  while this sprint runs, **the functions/ directory is this session's** (conflict avoidance),
  we don't touch the frontend (except the cleanup commit, and that's coordinated).
- Rollback is cheap at every stage: per-file `git revert` + targeted redeploy
  (rc3 drill: ~90 sec).
