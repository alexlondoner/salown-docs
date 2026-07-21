# MIGRATION_PATTERNS.md — Engineering Patterns Discovered During the TS Migration

> **What this is:** A permanent record of the patterns discovered **with proof** during the
> salOWN TS migration (2026-07, Phase 3). Each pattern was lived through in a real slice, verified
> with a byte-proof diff, and written up with its reusable solution. These aren't
> learned from the internet — they are this repo's own engineering accumulation.
>
> **Context:** [TYPESCRIPT_MIGRATION_PLAN.md](TYPESCRIPT_MIGRATION_PLAN.md)
> (§10 Firebreak · §11 Type-only · Evidence-driven migration framework).
> The plan tells "what will we do?"; this doc tells "why did it turn out this way?".
> The method summary is at the bottom. When a new pattern is discovered: add it here with a number + metadata
> and log it in the slice edit-log. **This doc is live until RC3.**
>
> **Metadata fields (per pattern):**
> - **First:** the slice/file + date it was first seen ("≈" = no exact slice record, early period).
> - **Severity:** low = tsc catches it instantly, mechanical fix · medium = could have slipped in without an evidence
>   diff · high = behavior/byte impact is invisible, only discipline catches it.
> - **Validity:** 🔁 **during-migration** — once the byte-identical condition is lifted (Phase 4
>   strict + cleanup commit) the workaround becomes unnecessary, solved with a permanent type ·
>   ♾️ **permanent** — engineering knowledge that holds even after the migration ends.

---

## Core principle (the mother of all patterns)

**A migration slice = type-only.** Behavior is not touched; the proof = the compiled bundle being
**byte-for-byte identical** to HEAD. Most of the patterns below are a
consequence of these two facts:

1. **The minifier deletes less than you think:** destructure keys, object props,
   JSX props are preserved. Deleting "dead" code often CHANGES the bytes. *(♾️ permanent knowledge)*
2. **The TS transform deletes more than you think:** type annotations are erased
   (safe), but unused value imports are also elided (Pattern 20 — sneaky). *(♾️ permanent knowledge)*

The solution alphabet: *type annotation* (always safe) → *`as any` cast* (erased;
parens are folded by the minifier) → *eslint-disable + cleanup list* (instead of deleting) →
*deprecated member on the interface* (instead of changing the call-site) → *bare side-effect
import* (instead of deleting the import).

---

## Type-error patterns (byte-neutral ways to silence tsc)

**Pattern 01 — Date arithmetic `a - b`:** if both are Date, TS2363; `: any` on **both variables**
(one side isn't enough).
*First: ≈2026-07-09 early slices · Severity: low · Validity: 🔁 migration*

**Pattern 02 — Firestore spread narrowing:** `{...d.data(), id: d.id}` narrows to `{id: string}`;
give the map callback a return type: `(d): Rec =>`.
*First: ≈2026-07-09 early slices (then in nearly every slice) · Severity: low · Validity: 🔁 migration (lifted in Phase 4 with real Booking/Client types)*

**Pattern 03 — Mixed style map** (plain object + function member) →
`satisfies Record<string, CSSProperties | ((...args:any[])=>CSSProperties)>`.
*First: OnboardingWizard (around slice 3o) · 2026-07-10 · Severity: low · Validity: ♾️ (satisfies technique is permanent; TS 6.0.3)*

**Pattern 04 — Tuple destructure with a boolean** (React key error TS2322) →
`([l,v,c,bold]: any[])`.
*First: ≈2026-07-09/10 · Severity: low · Validity: 🔁 migration*

**Pattern 05 — `isNaN(new Date(...))`:** `: any` on the variable + a TODO comment
(works at runtime, typed properly in Phase 4).
*First: ≈2026-07-09/10 (recurred: 4b WalkInForm, 4c Dashboard) · Severity: low · Validity: 🔁 migration*

**Pattern 06 — map destructure of a heterogeneous object-literal array** → `: Rec` on the param.
*First: ≈2026-07-09/10 · Severity: low · Validity: 🔁 migration*

**Pattern 07 — jsx-residue eslint-disable comment** (`react-hooks/exhaustive-deps` etc.)
gives a "rule not found" error in the TS config → remove the comment (comment-only, byte-neutral).
*First: ≈2026-07-10 (recurred: 4b, 4c) · Severity: low · Validity: 🔁 migration (ends once all jsx is converted)*

**Pattern 08 — What is safe to delete:** `let→const` + deleting an unused map-index is
byte-neutral PROVEN; **deleting a destructure key is NOT** (the minifier preserves it).
*First: ProfileBar · 2026-07-09 (the event where the type-only rule proved itself: deleting a "harmless" prop turned the bundle diff red) · Severity: MEDIUM · Validity: ♾️ (minifier behavior is permanent knowledge)*

**Pattern 09 — Destructure with partial reassign** (`let [h,m]`, only h changes) →
eslint-disable on prefer-const (splitting it isn't type-only); if all can be const, let→const.
*First: staff NewBookingSheet (slice 3s) · 2026-07-10 · Severity: low · Validity: 🔁 migration*

**Pattern 10 — Style consts:** `{position:'relative'}` can't be assigned to widened string CSSProperties
→ `: CSSProperties` on the const + `import type`; CSS custom-property object
(`'--brand'`) → `as CSSProperties` cast.
*First: OccupancyPanel (3t) / SalonSitePage (3u) · 2026-07-10 · Severity: low · Validity: 🔁 migration*

**Pattern 11 — Assignment after `querySelector`** narrows to the declared union →
`querySelector<HTMLMetaElement>` generic.
*First: SalonSitePage (3u) · 2026-07-10 · Severity: low · Validity: ♾️ (correct TS technique, permanent)*

**Pattern 12 — Arity:** when there's a single-argument call, the second param MUST be `?:` — independent of
TS2554 strict. (For the reverse direction see Pattern 15: if changing the callee changes bytes,
`(fn as any)(...)`.)
*First: SalonSitePage (3u) · 2026-07-10 · Severity: low · Validity: ♾️*

**Pattern 13 — Unused useState is NOT DELETED** (hook order = behavior) →
eslint-disable + add to the cleanup list.
*First: SalonSitePage/Bookings (3u/3v) · 2026-07-10 (recurred: 4b extrasCategoryId, 4c four states) · Severity: MEDIUM (deleting it = runtime crash — the React state cleanup lesson) · Validity: ♾️ (the hook-order fact is permanent; the workaround is 🔁)*

**Pattern 14 — Duplicate object key (TS1117):** deleting the dead first key CHANGES bytes;
a computed key is also TS1117; the solution is **inline spread `...{ key: val }`** — the minifier folds it to the same
bytes.
*First: Bookings (3v) · 2026-07-10 · Severity: MEDIUM · Validity: 🔁 migration*

**Pattern 15 — React 19 `useRef()` has no 0-arg overload (TS2554)** and general arity/type
mismatch: adding an argument/param changes bytes → **`(fn as any)(...)`** is byte-neutral
proven (after erasure the minifier drops the `(fn)(...)` parens). Same technique:
`(window as any).webkitAudioContext`, `(location.state as any)?.x`,
`new Date(parts[3] as any, ...)`.
*First: OnlineProfile (3z) · 2026-07-10 (generalized: 4c Dashboard ×4) · Severity: low · Validity: 🔁 migration*

**Pattern 16 — Value-returning ref callback (TS2322):** casting the whole arrow leaves parens
(+2 bytes, caught) → **cast the assignment**: `ref={el => (x[k] = el) as any}`.
*First: OnlineProfile (3z) · 2026-07-10 · Severity: MEDIUM (without byte-proof, +2 bytes would slip in) · Validity: 🔁 migration*

**Pattern 17 — Callable result `res.data` unknown** → `const res: Rec = await fn(...)`.
*First: OnlineProfile (3z) · 2026-07-10 · Severity: low · Validity: 🔁 migration (callable return types in Phase 4)*

**Pattern 18 — Dead prop in an inline options literal (TS2353 excess-property):**
deleting the prop from the call changes bytes → **add `@deprecated prop?: type` to the target
interface** (erased).
*First: BookingDetailPanel→conflictUtils.ConflictOptions.processingEnabled (4a) · 2026-07-10 · Severity: MEDIUM (requires a type-only touch to a second file) · Validity: 🔁 migration (in the cleanup commit, the prop + the deprecated member are lifted together)*

**Pattern 19 — A Rec spread loses the index signature in a map return:**
the return of `rows.map(r => ({...r, start, end}))` narrows to `{start,end}` → subsequent
accesses are TS2339; annotate the callback return `(r): Rec =>`. Also: if the callee
wants `{name:string} & Rec`, type the const with the same intersection — Rec on its
own is TS2345.
*First: WalkInForm (4b) · 2026-07-11 · Severity: low · Validity: 🔁 migration*

**Pattern 21 — `Rec[]` can't be assigned to a typed component prop, `any[]` can:**
concrete prop types like `SelectorProduct[]` give TS2322 for `Rec[]` → make those states
`useState<any[]>([])`. Also: a required-param function can't be assigned to a `() => void`
prop (TS2322) → type the param optional: `(force?: any) =>` (erased, byte-identical).
Excess-property variant: give the receiving component a loose `: Rec` prop contract
(4a/4c — legacy extra props stay type-legal).
*First: Dashboard (4c) · 2026-07-11 · Severity: low · Validity: 🔁 migration (the anys become real types in Phase 4)*

**Pattern 22 — Lint's behavioral rewrite requests are REJECTED:** `no-unused-expressions`
wants to convert a ternary-statement (like legacy-compat patterns `mq.addEventListener ? ... : mq.addListener(...)`)
into if/else — converting it CHANGES BYTES (§10's exact warning).
Solution: eslint-disable + a rationale comment on the line; the rewrite goes to Phase 4 cleanup.
*First: BookingPage (5e) · 2026-07-11 · Severity: MEDIUM (an absent-minded rewrite = a byte leak) · Validity: 🔁 migration*

---

## 🔴 Pattern 20 — TS's unused-import elision changes the module graph (MOST SNEAKY)

| Field | Value |
|---|---|
| **First seen** | 2026-07-11 |
| **First file** | `Dashboard.tsx` (slice 4c; triggering import: dead `SlotPopup`) |
| **Severity** | **HIGH** — zero difference in behavior, no test/lint catches it; only byte-proof discipline sees it (the difference was 5 bytes) |
| **Evidence** | `BYTE_IDENTICAL ❌` → normalized hash diff → real difference in a single chunk → module-order comparison → import elision confirmed |
| **Permanent solution** | During the migration, convert the dead import to a **bare side-effect import** — the graph edge is preserved |
| **Applies until** | Until the frontend TS migration ends (once the byte-identical condition is lifted, the bare imports go away with real deletion in the cleanup commit) — but *TS's elision behavior* is ♾️ permanent knowledge |

```
Unused value import (import X from './X'; X is never used)
        ↓
TS transform ELIDES the import (assumption "might be a type import")
        ↓
that edge drops from the module graph → the module discovery ORDER changes
  (the module is discovered later via a different importer)
        ↓
the in-chunk module order + minifier alias distribution change
        ↓
the chunk hash changes → ALL bundle hashes cascade-change
```

- **When it blows up:** the module is **also used by someone else** + the dead import in the
  migrated file is the **only direct edge**. (4c: `SlotPopup` was also coming via TimeGrid
  → order shifted, chunk −5 bytes.)
- **When it doesn't blow up:** the module is already tree-shaken in both builds (a pure module
  that's never used) → elision is invisible (ReceiptPanel/ResizeHandle in 4c).
- **Solution:** DON'T DELETE the dead import (deleting also changes bytes) — **convert it to the bare
  side-effect form:** `import SlotPopup from '../components/SlotPopup'` →
  `import '../components/SlotPopup'`. TS never elides a side-effect import;
  the graph edge stays at the same line position → byte-identical PROVEN.
- **Diagnosis recipe** ("why did all the hashes change?"):
  1. Normalize the hashes: `sed -E 's/-[A-Za-z0-9_-]{8}\.js/.HASH.js/g'`
  2. Match chunk pairs by name prefix and compare with `cmp` →
     the real difference is usually in a SINGLE chunk (the rest is the hash cascade).
  3. In that chunk, find the first difference with the `cmp` offset; if an import line / alias
     reshuffle is visible, an order change = elision suspicion; compare the module order with a
     `;` split + diff.

---

## Method — byte-proof v2 (each slice's evidence chain)

*Validity: 🔁 during-migration (lives together with the byte-identical condition); but
the "diff not claim" principle is ♾️ permanent — the behavior-proof layer of evidence-driven migration.*

```
git mv X.jsx X.tsx
→ surgical type-only annotation (with the patterns above)
→ npx tsc --noEmit                        (type proof)
→ byte-proof v2:                          (behavior proof)
    git worktree add <scratch>/wt-head HEAD
    ln -s <repo>/node_modules <scratch>/wt-head/node_modules
    both builds to the scratchpad (--outDir ... --emptyOutDir)
    diff -r base after   → exit 0 REQUIRED
    (for a staff file --config vite.staff.config.js is REQUIRED;
     when done, remove the symlink + git worktree remove --force)
→ eslint (file)                           (discipline proof)
→ vitest                                  (regression proof)
→ explicit-path commit (refactor(ts): ... (slice NX))
→ git pull --rebase --autostash → push
```

For every edit made AFTER the proof (comment-only included), run a **final re-proof** —
it's cheap, and it turns the assumption "comments are definitely byte-neutral" into proof every time.

## Cleanup discipline

*Validity: 🔁 during-migration — the list is closed in a SINGLE chore commit after the migration.*

Every dead thing disabled during the migration (import/useState/const/destructure)
goes to the **cleanup list** (memory `project_ts_migration` → "Accumulated cleanup
list"); after the migration it's deleted in a SINGLE chore commit, with repo-wide grep proof.
Grep anchor: `type-only rule`.
