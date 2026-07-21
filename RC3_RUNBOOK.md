# RC3 Runbook — Functions `src → lib` Build Day (target: 2026-07-12)

> **BINDING:** rc3 = the ONLY step in the whole migration that changes the runtime model
> (TYPESCRIPT_MIGRATION_PLAN.md §9). No OTHER major work is done that day.
> The day's four goals: **pipeline changed · deploy succeeded · smoke passed ·
> rollback verified** — and the day ends. The next day (2026-07-13) = rc3+1
> product-validation day (no code, the product gets used).

Prepared by: Claude (evening of 2026-07-11, after TimeGrid slice 6). This runbook
was written so the discovery cost isn't left to the morning; all numbers were
verified that evening from the live repo.

---

## ✅ RESULT — WHAT ACTUALLY HAPPENED (2026-07-12 night, 00:15–01:30)

Status SSOT: ROADMAP.md. This block = execution record (what was planned → what happened).

- **Strategy B approved and executed** (owner, night window — salon closed).
- **Commit `73ce8f8` + tag `v0.9.0-rc3` (LOCAL, push pending):** src/ copy (22
  files), `tsconfig.build.json` **emit-only** (`noCheck`+`noResolve` — see note),
  `main: lib/index.js`, predeploy hook, `.gitignore` lib/, blanket `npm run
  deploy` script locked (echo+exit 1).
- **Deviations from plan (3):** (1) the `// @ts-check` at the top of `identity.js`
  overrides `checkJs:false` → the JSDoc shared-type import first gave TS2307, and
  once the path was fixed, TS6059 (emit input outside rootDir); fix = making the
  build emit-only + moving the typedef path to `../../../` in the src copy
  (comment line, zero runtime effect). Type checking is in `npm run typecheck`
  (0 errors). (2) The first bad build emitted `packages/shared/src/*.js`
  leftovers — deleted (they could have shadowed the frontend .ts imports). (3) tsc
  emit pretty-prints the JS (NOT byte-identical; whitespace/brace/single-line-if) —
  parity proof instead of bytes: 52/52 exports + full module graph load + tests.
- **Canary:** `salownCleanupExpiredPending` deployed OK but the `functions:log`
  window came back delayed/unreliable → observable 2nd canary
  `salownBrevoWebhook` (curl 200 + correct handler reply). Then 9 sequential groups
  (parsers→emails→notifications→marketing→bookings→tenant→admin→exit→
  **money/stripe LAST**) — zero delete suggestions, zero errors; us-central1 27
  legacy in place.
- **Smoke:** brevo 200 · `salownGetBusySlots` live reply (param name `dateStr`)
  · salown.com/book/login/staff 200 · **ghost-booking loyalty trigger end-to-end
  PASS** (dated 2020 + `testMode:true` [Telegram/FCM muted at 1am] + gmail
  plus-alias → `loyaltyEmailSent` marker + flag reset, side effects 0, record
  deleted). Script: scratchpad `rc3-ghost-smoke.cjs`
  (Admin SDK, salown-panel serviceAccountKey).
- **Real-flow with Telegram deliberately left to the 13th** (rc3+1 product-validation
  already starts with a real booking).
- **Rollback drill (§7) two-way:** main→`index.js` redeploy 88 sec,
  fast-forward 104 sec; webhook 200 in both. Real-incident MTTR ≈ **90 sec**.
- **Push deliberately DEFERRED:** CI runs `npm run build` (main app) + `deploy --only
  hosting` (all) but does NOT run `build:staff` → the staff-bundle would ship as
  committed (old); another session's staff-bundle is uncommitted in the working tree.
  Push = when that session commits / with owner approval.
- **Once the 13th passes clean:** root `.js` copies + tag push + cleanup commit.

---

## 0. Current-state snapshot (verified 2026-07-11)

| Fact | Value |
|---|---|
| Runtime | CommonJS, `main: index.js` (3619 lines, **52 exports**) |
| Modules | 11 folders / 26 `.js` files (bookings, checkout, clients, emails, finance, inbound, marketing, notifications, parsers, tenants, utils) |
| Tests | **8 `.test.js`** — `npm test` = `node --test` (clients/utils/parsers/notifications/emails/marketing/inbound/checkout) |
| tsconfig | Phase-0 mode: `allowJs`, `checkJs:false`, `noEmit`, `strict:false`, `nodenext` |
| Node | `engines.node = 22` |
| firebase.json | functions source `functions`, codebase **`salown`**, NO predeploy hook |
| Shared types | `salown-app/packages/shared/src/` 10 files (8 models + firestore + index), type-only |
| JSDoc shared imports | compile-time only (`checkJs:false`) — path drift does NOT affect runtime |
| ⚠️ package.json `deploy` script | `firebase deploy --only functions` = **BLANKET — NEVER USE** (feedback_functions_deploy_gotcha: deletes 27 orphans in us-central1) |

## 1. Strategy decision (morning owner approval — recommendation: B)

- **A) Big-bang `.ts`:** convert the 27 files to `.ts` + change the pipeline the same day.
  ❌ Two big variables on the same day — contrary to the evidence-driven principle; if a
  regression appears you can't tell whether it's the pipeline or the conversion (the
  opposite of the firebreak lesson).
- **B) Pipeline-first (RECOMMENDED):** Today ONLY the pipeline changes. The `.js`
  files are **copied** under `src/` (the originals stay in the root AS-IS → instant
  rollback), tsc emits `src → lib` with `allowJs`, and `main: lib/index.js`.
  The code content does NOT change at all today. The `.js → .ts`
  conversion happens AFTER rc3, file by file, in separate slices with
  lib-output-diff proof. Plan §9's rc3 definition ("pipeline changed · deploy · smoke ·
  rollback") is exactly this scope. The original root copies are removed once the
  13th's product-validation passes CLEAN, in a separate cleanup commit.

## 2. Morning pre-flight (WITH NO changes)

```bash
cd salown-app && git status && git log origin/main..HEAD   # should be clean
cd functions && npm test          # 8 files green (baseline)
npx tsc --noEmit                  # 0 errors (baseline)
```

## 3. Build setup (single commit)

1. Create `functions/src/`; **copy** `index.js` + 11 module folders + `emailTemplates.js`
   + `_demoEmails.js` + `_previewEmails.js` (no git cp → `cp -R`,
   originals in place). `_preview/` and `test-parser.js` are dev-only → outside src.
   `*.test.js` files are NOT COPIED into src (tests keep running against the root copy).
2. `tsconfig.build.json` (new): `allowJs:true, checkJs:false, outDir:"lib",
   rootDir:"src", module:"nodenext", target:"ES2022", noEmit OFF`,
   include `src`, exclude tests. (The existing tsconfig.json = stays as editor/typecheck,
   don't touch it.)
3. `package.json`: `"main": "lib/index.js"` + `"build": "tsc -p tsconfig.build.json"`.
4. predeploy in the `firebase.json` functions block:
   `"predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]`.
5. Add `functions/lib/` to `.gitignore`.

## 4. Parity proof (BEFORE deploy, local)

```bash
cd functions && npm run build
node -e "const a=Object.keys(require('./index.js')).sort();
         const b=Object.keys(require('./lib/index.js')).sort();
         if(JSON.stringify(a)!==JSON.stringify(b)){console.error('EXPORT DIFF',a.filter(x=>!b.includes(x)),b.filter(x=>!a.includes(x)));process.exit(1)}
         console.log('EXPORT-PARITY OK:',a.length)"   # 52 expected
npm test                                              # still green
```
⚠️ `require('./lib/index.js')` tries to initialize firebase-admin —
not a problem (idempotent); if it blows up, verify with the emulator:
`firebase emulators:start --only functions` → 52 functions should be listed.

## 5. Deploy (canary → grouped; NEVER blanket)

1. **Canary (1 function, low risk):**
   `firebase deploy --only functions:salown:salownCleanupExpiredPending --project havuz-44f70`
   → log clean + scheduled run OK.
2. **The rest grouped** (sequential with lists of 5-8 `functions:salown:X,functions:salown:Y,...`;
   parsers+emails → notifications → bookings/checkout →
   money/stripe LAST).
3. **If the CLI suggests DELETING any function → ABORT** (it means export parity
   is broken; no delete is approved).

## 6. Smoke (live)

- `salownBrevoWebhook` POST 200 (curl, empty event → `ignored` reply is enough)
- Booking page: `/book/whitecross` slot loads (salownGetBusySlots)
- Real flow: 1 test booking → did the confirmation email + Telegram land
- Money path: ghost-booking technique (dated 2020, invisible; proven on 07-08)
- Frontend smoke: salown.com / login / staff 200 (functions untouched but the ritual)

## 7. Rollback drill (BINDING — before the day ends)

Revert `main` to `index.js` → redeploy the canary function → verify it runs from the
old pipeline → set it back to `lib/index.js` + redeploy. Note the time (expected MTTR in
a real incident). Because the original root `.js` files are in place, rollback = 1 line +
1 deploy.

## 8. End of day

- Annotated tag `v0.9.0-rc3` (checklist §9: coverage + test count + smoke)
- TYPE_COVERAGE dashboard updated in CI; update edit log + handoff memory
- Overnight observation; 2026-07-13 = product-validation day (single question: "did the salon notice?")

## Open items (to ask the owner in the morning)

1. Strategy A/B approval (recommendation B).
2. Canary function choice (recommendation salownCleanupExpiredPending).
3. Deploy time window (recommendation: morning, when salon traffic is low).
