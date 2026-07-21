# ARCHITECTURE V2 — post-TypeScript architecture (v1.0.0, 2026-07-13)

> The closing document that was TYPESCRIPT_MIGRATION_PLAN's promise. V1 architecture =
> pre-migration state (SYSTEM_ARCHITECTURE.md is still valid as the repo/service
> map — this document does NOT REPLACE it, it describes the language/build/proof layer).

## 1. Language state

| Layer | State | Source |
|---|---|---|
| Frontend (panel + staff + booking) | **104/104 files .ts/.tsx** (2026-07-11) | `salown-app/src/` |
| Functions (52 exports) | **22/22 runtime files .ts** (2026-07-13) | `salown-app/functions/src/` |
| Deliberate .js remainders | `functions/src/_demoEmails.js` + `_previewEmails.js` (dev-only preview scripts) | — |
| Shared types | `packages/shared/src/` (type-only, 10 files) | shared by frontend+functions |

**strict: TRUE in both layers** (functions morning of 2026-07-13, frontend the same day).
`any` policy: during the strict-cleanup deliberate `any` was allowed
(when the data is a Firestore doc-bag this is the honest type); places wanting narrowing are
marked `TODO(ts-strict)` / `TODO(ts-migration)` — improvement is opportunistic, not bulk.

## 2. Build & runtime

- **Frontend:** Vite (esbuild transpile — type annotations are stripped before
  codegen; therefore on type-only changes the bundle stays BYTE-IDENTICAL = the basis of
  our proof method). Two bundles: main (`npm run build`) + staff
  (`npm run build:staff`, `vite.staff.config.js`). CI (GitHub Actions) on
  push to main builds both from source and pushes to hosting.
- **Functions:** `tsconfig.build.json` = EMIT-ONLY (`noCheck`+`noResolve`;
  type checking never breaks the build) → `src/ → lib/`, runtime `main: lib/index.js`.
  Type checking at a separate gate: `npm run typecheck` (`tsconfig.json`, strict).
  The `firebase.json` functions predeploy hook guarantees the build. Tests
  require `lib/` (the shipped artifact); `pretest` runs the build.
- **Deploy:** functions ALWAYS codebase-prefix targeted (`--only
  functions:salown:X,...`); blanket FORBIDDEN (27 legacy fns in us-central1 +
  `npm run deploy` script is locked). Order: functions → hosting → rules LAST.

## 3. Proof culture (the permanent legacy of the migration)

1. **Byte-proof (frontend):** after a change, two builds (main+staff) `diff -r`'d
   against the HEAD worktree build — type-only work must come out byte-identical.
   Method detail: MIGRATION_PATTERNS.md "byte-proof v2".
2. **lib-diff (functions):** after a file translation/type work, only the target
   file may change in the `lib/` output; the only accepted noise is the tsc printer's
   arrow-parameter parenthesis. The export surface is verified one-to-one via `Object.keys(require(...))`
   (`__esModule` is non-enumerable — doesn't affect the count, nor Firebase's
   function discovery).
3. **Characterization/parity tests:** `functions/src/**/*.test.js` (node --test,
   47 tests) — the old inline behavior is accepted as spec; the source-text anchors
   are `src/index.ts` + `HEAD:functions/src/index.ts`.
4. **Ghost-booking smoke:** end-to-end trigger proof that leaves no trace in production
   (dated 2020 + testMode + plus-alias; scratchpad `rc3-ghost-smoke.cjs` pattern).
5. **Live observation:** after deploy, scan the scheduled run from Cloud Logging
   (`entries:list` via firebase CLI OAuth — the CLI's own `functions:log` can lag
   days behind, don't trust it).

## 4. TS writing conventions (functions)

- Modules use **named export** (`export function` / `export { _x as x }`)
  — `module.exports`/`export =` conflicts with @ts-check'd consumers (TS2459/2497).
- CJS value import: `const { X } = require('...')`; if a type is needed, alongside it
  `import type { X as XT } from '...'`. **Don't switch to ESM `import`** — the emit changes.
- Firestore doc data is carried with `any`/`Rec`; field contracts are
  in FIRESTORE_SCHEMA.md + packages/shared, the documentation is binding, not the TS type
  (because of index-based queries/dynamic fields).
- A new function = `export const name = onCall/onRequest/...` (`src/index.ts`);
  the I2 split (distributing into modules) is still open work, a separate decision.

## 5. Version line

- `v0.9.0-rc1/rc2` — Phase 0-2 (toolchain, shared, module extraction)
- `v0.9.0-rc3` — runtime flip: src→lib pipeline (2026-07-12; RC3_RUNBOOK)
- **`v1.0.0`** — codebase end-to-end TS + strict everywhere (2026-07-13; V1_RUNBOOK)
- After: the TYPE_COVERAGE dashboard keeps living in CI; `any` narrowing +
  I2 index split are opportunistic work.
