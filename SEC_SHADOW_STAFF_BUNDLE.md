# SEC — `salown.com/staff-bundle/`: a pre-enforcement Staff app on the public landing site

**Work ID:** `SHADOW-STAFF-BUNDLE` · **Raised:** 2026-09-20 · **Fix shape APPROVED** (§7) · **Candidate `5be583c`** off `56ceccc` (§8) · **Status: `LIVE_VERIFIED`** — released 2026-09-20 as
`R-2026-09-20-A`, `hosting:salown` version **`be573ea0498fc71f`** (§9). Nothing was merged to `main`,
no artefact was untracked or deleted, and `hosting:salown-staff` was not touched.

Parent record: [CLOSING_COORDINATION_2026-09-20.md](CLOSING_COORDINATION_2026-09-20.md) §2 ·
Source finding: [LIVE_MAIN_ALIGNMENT_AUDIT_2026-09-20.md](LIVE_MAIN_ALIGNMENT_AUDIT_2026-09-20.md) §5.1
(where it was recorded as "an unversioned, publicly reachable Staff entry point" — this document is the
part the audit left open: **it is also an un-enforced one**).

---

## 1. The finding, in live facts (read-only, 2026-09-20)

| Probe | Result |
|---|---|
| `GET https://salown.com/staff-bundle/index.html` | **200**, loads `assets/staff-CRqN2rBX.js` (1,124,215 B) |
| `GET https://staff.salown.com/index.html` | 200, loads `assets/staff-BVUJwYTL.js` (1,122,493 B) |
| `main` (`9020560`), tracked artefact | `hosting/staff-bundle/assets/staff-CxdWlU6-.js` — **a third hash** |

Callable-name **string literals survive minification**, and that is where the two live bundles part:

| Literal | `salown.com/staff-bundle/` (`CRqN2rBX`) | `staff.salown.com` (`BVUJwYTL`) |
|---|---|---|
| `salownCreateStaffBooking` | **absent** | present |
| `salownCreateStaffWalkIn` | **absent** | present |
| `salownCreateWalkIn` (legacy, no D1-D7 enforcement) | **present** | absent |

So the landing site publishes a **Staff app build from before `STAFF-AVAIL-GAP` Phase 1 + Phase 2**
(`R-2026-09-13-A`, `R-2026-09-15-A`). It is a working SPA: it signs in against the same Firebase project
and routes walk-ins through the legacy callable that has **no** passive/leave/conflict/hours enforcement —
the callable whose gap is a *named standing exception* in `ROADMAP` precisely because the Staff App
surface was supposed to be the enforced one.

**Severity: 🟠.** Not a data leak and not privilege escalation — the same person, the same auth, the same
rules. What it defeats is a *shipped safety control*: bookings and walk-ins that the server would now
refuse or force through a logged owner override can be written from a URL nobody publishes and nobody
monitors. It is also, silently, the reason a "released" protection can be true and untrue at once.

### Two things it is NOT (checked, so the fix does not carry cargo)

- **No service worker is installed from it.** The shadow `index.html` registers `'/sw.js'` — a *root-absolute*
  path, i.e. `https://salown.com/sw.js`, which returns **404**. (`/staff-bundle/sw.js` exists and is
  byte-identical to the Staff site's, but nothing on `salown.com` ever registers it.) There is therefore no
  cached offline copy, no push registration, and **no kill-switch service worker is needed** — removing the
  files is enough. On `staff.salown.com` the same relative registration resolves correctly, which is why the
  real Staff app's SW is unaffected by everything below.
- **`/public-bundle/index.html` is not a second instance of this problem.** It is reachable (200) but serves
  `assets/index-CiEeRNFs.js` — byte-identical to what `/app` serves. Same artefact, no version skew.
  Hygiene at most; out of scope here.

---

## 2. Root cause, proven from the CLI's own code

Two independent mechanisms, and **only the second one is the hole**:

1. **Why the file is regenerated.** `firebase-tools` `lib/deploy/lifecycleHooks.js` → `getReleventConfigs()`
   filters hosting configs with `config.target || onlyTargets.includes(config.target)` — it keys on
   **`target`**. This repo's two hosting entries declare **`site`**, never `target`, so `!config.target` is
   always true and **every** hosting `predeploy` hook runs under **any** `--only`. An Admin-only deploy
   therefore executes `npm run build:staff`, which rewrites `hosting/staff-bundle/` (`vite.staff.config.js`
   → `outDir: './hosting/staff-bundle'`, `emptyOutDir: true`). This is the `REL-1` observation, now with its
   mechanism. *(Note: `lib/hosting/config.js` → `filterOnly()` matches on `site` correctly, so the deploy
   itself is properly scoped. Only the hook dispatcher is target-keyed.)*
2. **Why the file is published.** `hosting[salown].public = "hosting"`, and `staff-bundle/` sits inside it.
   The upload set is `listFiles(publicDir, config.ignore)` (`lib/deploy/hosting/deploy.js`), and `ignore`
   does not mention it — so all 25 files go up with the landing site.

**Probe, run against the shipped dispatcher with the real hook commands replaced by `echo`** (no network,
no build, no deploy):

```
### firebase.json (unpatched)   --only hosting:salown
    HOOK FIRED -> salown        (npm ... run build)
    HOOK FIRED -> salown-staff  (npm ... run build:staff)      ← regenerates the shadow artefact
```

---

## 3. What a fix has to achieve

1. `salown.com/staff-bundle/**` must stop serving an old, enforcement-free Staff bundle.
2. `staff.salown.com` and its normal deploy flow must be **unchanged**.
3. An Admin deploy must not put it back.

Goals 1 and 3 are the same property at two different times: the upload set must exclude it, permanently
and by assertion, not by anyone remembering.

---

## 4. Options — separate diffs, each verified

All patches are against `firebase.json` at `origin/main` `9020560`, in an isolated `git archive` workspace
(deliberately **not** a git worktree: `ops/rulesAuthority.mjs` treats any worktree carrying a deployable
rules config as a permanent finding, so an agent worktree would trip this repo's own security guard).

### Option (a) — stop publishing it from the Admin target

```diff
--- a/firebase.json
+++ b/firebase.json
@@ -4,7 +4,7 @@
       "site": "salown",
       "public": "hosting",
       "predeploy": ["npm --prefix \"$PROJECT_DIR\" run build"],
-      "ignore": ["firebase.json", "**/.*", "schema.html"],
+      "ignore": ["firebase.json", "**/.*", "schema.html", "staff-bundle/**"],
       "headers": [
```

*The pattern is `staff-bundle/**`, not `hosting/staff-bundle/**`: `listFiles` globs with `cwd` set to the
site's `public` dir, so an ignore path is relative to `hosting/`. The wrong spelling silently ignores nothing.*

| | |
|---|---|
| **Live behaviour after the next Admin deploy** | `salown.com/staff-bundle/**` → **404** (there is no catch-all rewrite on this site; `/nonexistent-xyz` already returns 404 today). Landing, `/app`, `/book/**` unchanged. |
| **Effect on the Staff site** | None. Publish set of `salown-staff` stays **25 files incl. `index.html` + `assets/`**. |
| **Verification** | `listFiles()` — the exact function the deploy uses — over each site: `salown` **65 → 40 files**, `staff-bundle/` **25 → 0**; `salown-staff` **25 → 25**. |
| **Rollback** | Delete the one array entry, redeploy `hosting:salown`. No data, no build, no client state involved. |
| **Limit, stated plainly** | The hosting **emulator does not apply `ignore`** (it is an upload filter; `lib/emulator/hostingEmulator.js` never reads it). Local HTTP still returns 200 under this patch — that is expected and is **not** evidence against it. This option is provable only at the upload-set level. |

### Option (a2) — also stop *regenerating* it (`site` → `target`) — **not recommended now**

Renaming both hosting entries' `site` key to `target` and committing a `targets` map in `.firebaserc`
(`rc.target()` reads it, so no per-machine `firebase target:apply` is needed) makes the hook dispatcher
scope correctly.

```
### patched   --only hosting:salown
    HOOK FIRED -> salown            ← only one
### patched   --only hosting        (control)
    HOOK FIRED -> salown
    HOOK FIRED -> salown-staff      ← a full deploy is still unchanged
```

**Cost, measured:** `ops/deploy-policy.test.js` builds `DECLARED_SITES = firebaseJson.hosting.map(h => h.site)`.
Under this patch that becomes `[null, null]` and its *"names a site that actually exists"* assertion **FAILS** —
and that test is a gate inside the deploy workflow, so CI would refuse to release. It is a correct change
made for the wrong reason: it fixes tree-dirtying, not the exposure, and it costs a rewrite of the one guard
that keeps CI target-scoped. Keep it as a separate, later cleanup.

### Option (b) — untrack the artefact — **hygiene, not a fix**

`git rm -r --cached hosting/staff-bundle` + `.gitignore`. It removes the "stash before pull" friction and
the third hash in `main`. **It does not close the hole:** the upload set is built from the working directory
at deploy time, and the `salown-staff` predeploy hook regenerates the directory immediately before the
upload — so an untracked artefact is published exactly as a tracked one is. It also makes `main` unable to
show what the Staff site was built from. **Do not take (b) as a substitute for (a).** Not executed here.

### Option (c) — redirect the stale path to the real Staff site

```diff
--- a/firebase.json
+++ b/firebase.json
@@ -5,6 +5,10 @@
       "public": "hosting",
       "predeploy": ["npm --prefix \"$PROJECT_DIR\" run build"],
       "ignore": ["firebase.json", "**/.*", "schema.html"],
+      "redirects": [
+        { "source": "/staff-bundle",    "destination": "https://staff.salown.com/", "type": 302 },
+        { "source": "/staff-bundle/**", "destination": "https://staff.salown.com/", "type": 302 }
+      ],
       "headers": [
```

| | |
|---|---|
| **Live behaviour** | Firebase Hosting evaluates redirects **before** static content, so this wins even while the files are still published — it stops the stale app on its own. Everything under the path goes to the Staff root, **not** to a path-preserving `:splat`: the asset hashes differ between the two bundles, so preserving the path would only produce a 404 with extra steps. |
| **Effect on the Staff site** | None — redirects live on the `salown` config only. Proven on the local emulator: the `salown-staff` server still returns 200 and serves its own entry chunk. |
| **Verification** | Local hosting emulator (`--only hosting`, isolated workspace): `/staff-bundle/index.html` → **302 → `https://staff.salown.com/`**, `/staff-bundle/assets/staff-*.js` → **302**, `/` → **200**, Staff site port → **200**. |
| **Rollback** | Remove the two entries, redeploy. **`type: 302` is deliberate** — a `301` is cached by browsers indefinitely, which would make rollback ineffective for anyone who had already hit it. |
| **Limit** | A redirect is a *server* instruction: it does not remove the files, so anything already open in a tab keeps running until reload. Pair it with (a). |

### Recommended: **(a) + (c)**, one commit

(a) removes it from the published set; (c) closes the window between now and the next Admin deploy and
gives anyone with a bookmark the correct destination instead of a bare 404. Combined patch verified:
`salown` 40 files / 0 under `staff-bundle/`, `salown-staff` 25 files unchanged, `/staff-bundle/**` → 302,
`/` → 200.

---

## 5. The guard that makes it stay fixed

New file `ops/hosting-shadow-bundle.test.js`, style matched to `ops/deploy-policy.test.js`.

> **Correction of record (2026-09-20, written with the candidate).** This section first described a guard
> that computed the publish set with `glob`, mirroring firebase-tools' `listFiles()`. **The repo has no
> `glob` dependency** (and no `fast-glob`/`tinyglobby`; CI runs Node 20, so `fs.globSync` is not available
> either), and adding one so a config assertion could re-implement the uploader would be a worse trade than
> asserting the contract directly. The shipped guard is dependency-free — node builtins + vitest — and the
> upload-set proof lives in the probe (§8), where it runs against firebase-tools' real function.

It asserts:

- the shadow path **derived** as `relative(adminPublic, staffPublic)` — so the guard cannot be satisfied by
  the repo-root spelling `hosting/staff-bundle/**`, which ignores nothing, and it follows the Staff bundle
  if that directory ever moves;
- the artefact really is on disk at that path, so the guard is not vacuous;
- `hosting[salown].ignore` contains `${shadow}/**`, and contains no pattern (`*`, `**`, `**/*`) broad
  enough to swallow the landing page;
- both `/staff-bundle` and `/staff-bundle/**` redirect to `https://staff.salown.com/`, with **every**
  redirect on this site a `302` — never a `301`;
- the `salown-staff` config is untouched: its own `public`, its unchanged `ignore`, its single SPA rewrite,
  and **no** redirects of its own.

**Firing negative control**, measured against the unpatched `56ceccc`: **2 failed / 10 passed**, and the two
failures are exactly the ignore rule and the redirect pair. The guard fails without the fix, which is what
makes it a guard rather than a decoration. It runs inside `npm test`, and is cheap enough for the deploy
workflow's policy step.

---

## 6. Release consequences — read before committing anything

- `.github/workflows/deploy.yml` releases `hosting:salown` on push to `main`, but its path filter lists
  `index.html`, `vite.config.js`, `package.json`, `package-lock.json`, `public/**`, `packages/**`,
  `src/**` (minus `src/staff/**`) and `hosting/**` (minus `hosting/staff-bundle/**`). **`firebase.json` is
  not in that list**, so a commit of this patch alone does **not** trigger a deploy. It sits inert until the
  next Admin release. A commit that also touches `ops/` or a test does not trigger it either.
- **The removal only happens at that deploy.** Nothing in this document changes production by itself, and
  the deploy that applies it is a normal `hosting:salown` release — which, per §2, also rebuilds the Staff
  artefact locally (harmless once it is no longer published) and ships whatever else `main` carries for the
  Admin bundle. That is the **M1/M3/M4 release-scope decision** in the closing-coordination record: this fix
  cannot ride to production without it, and must not be used as a reason to wave it through.
- Therefore: **commit needs a claim** on `firebase.json` (+ the new `ops/` test), and **production needs the
  Admin release decision**. Both are owner calls. Neither was taken here.

---

## 7. Owner decision — TAKEN 2026-09-20

**(a) + (c), cut as an independent security release from the last live Admin source `56ceccc`, not from `main`.**

- Scope is exactly three things: `hosting[salown].ignore` gains `staff-bundle/**`; `/staff-bundle` and
  `/staff-bundle/**` redirect **302** to `https://staff.salown.com/`; `ops/hosting-shadow-bundle.test.js`
  plus the documentation. Nothing else travels.
- **`main` is not the base.** `main` carries M1 Finance, M3 Staff availability and M4 Reports as unreleased
  work; a `main`-based Admin deploy would ship them alongside this fix. `56ceccc` is not an ancestor of
  `main` (branch `origin/fix/panel-paid-online-label-on-live-09401a2`, merge-base `c8a64d6`), but the
  alignment audit proved it **byte-identical to the live Admin site (95/95 files)** — so it is the correct
  base, and this fix can reach production **before** the main-alignment release decisions are settled.
- **`hosting:salown-staff` and the Staff bundle stay byte-identical.** No Staff deploy, no untrack, no
  artefact deletion, no merge to `main`.
- **(a2) is declined for now** — it breaks `ops/deploy-policy.test.js`, a gate inside the deploy workflow.
  **(b) is declined as a fix** — it closes nothing (it remains available later as hygiene).
- Acceptance gates for the candidate: the Admin publish set contains no `staff-bundle/**`; `/staff-bundle/`
  and its asset paths return **302**; `/` and `staff.salown.com` keep working; **no `301` anywhere**;
  the Admin build and the hosting emulator/upload-set probes pass.
- Handed to session `alish-88` on 2026-09-20 to prepare in a clean `git archive` workspace, reporting the
  candidate SHA, the file diffs and the test results for a **separate `hosting:salown`-only owner approval**.
  No merge and no deploy on that handover.

### Options as they were presented

| Question | Options |
|---|---|
| Fix shape | **(a)+(c) recommended** · (a) alone · (c) alone · accept the exposure |
| Hygiene | take (b) later as its own change, or leave the artefact tracked |
| Hook scoping | take (a2) later with the `ops/deploy-policy.test.js` update, or leave it |
| Release path | wait for the next approved Admin release, or cut an isolated release of the live Admin base + this config change only |
| Record | open an `INCIDENTS.md` entry now, or when the fix goes live |

## 8. The candidate — `5be583c`

**Branch `security/shadow-staff-bundle-on-live-56ceccc`, one commit on top of `56ceccc`, pushed 2026-09-20.
Not merged to `main`. Not deployed.** Built in a clean local clone (not a worktree) with its own
`npm ci` for the app and for `functions/`.

**Diff = 2 files, +105 / −1**

| File | Change |
|---|---|
| `firebase.json` | +5 / −1 — `hosting[salown].ignore` gains `staff-bundle/**`; `hosting[salown].redirects` gains `/staff-bundle` and `/staff-bundle/**` → `https://staff.salown.com/`, **302** |
| `ops/hosting-shadow-bundle.test.js` | +100, new — dependency-free (node builtins + vitest) |

`firebase.json` is byte-identical between `56ceccc` and `main`, so the patch is the same on both — but the
**base is the live Admin source**, so a release of this candidate ships no `main`-only work.

The guard derives the shadow path as `relative(adminPublic, staffPublic)` rather than hard-coding it, so
the repo-root spelling (`hosting/staff-bundle/**`, which ignores nothing) cannot pass, and it asserts the
Staff site's own config is untouched. It needs no `glob`: the repo has no such dependency, and inventing
one for a config assertion would be a worse trade than asserting the contract directly. The upload-set
proof stays where it belongs — in the probe, below.

### Acceptance gates — all met

| Gate | Result |
|---|---|
| Admin publish set carries no `staff-bundle/**` | `listFiles()` (firebase-tools' own): `salown` **120 → 95 files**, `staff-bundle/` **25 → 0** |
| `salown-staff` unaffected | publish set **25 → 25**; config untouched; `hosting/staff-bundle` checksum identical before and after `npm run build`; `git status` clean on that path |
| `/staff-bundle/` and asset paths redirect | emulator: `/staff-bundle/`, `/staff-bundle/index.html`, `/staff-bundle/assets/staff-*.js`, `/staff-bundle/sw.js` → **302 → `https://staff.salown.com/`** |
| `/` and the Staff site keep working | emulator: `/` **200**, `/app` **200**, `/book/**` **200**, Staff site root **200** serving its own chunk |
| No `301` anywhere | asserted by the guard over every redirect on this site |
| Admin build | `npm run build` **OK** |
| Test suite | **5619 pass / 16 fail / 2 skipped** vs pristine `56ceccc` **5607 / 16 / 2** — identical failures, **+12 = the new guard**. The 16 are the sibling-repo scanners (`ops/rules-authority`, `ops/functions-ownership`, `scripts/functionsArchiveManifest`), which fail the same way on the untouched base in this workspace |
| Negative control | guard against the **unpatched** base: **2 failed / 10 passed**, and the two failures are exactly the ignore rule and the redirect pair |
| Deploy-policy gate | `ops/deploy-policy.test.js` **passes** (it would not under the rejected `site`→`target` variant) |

### What a release of it would do, and would not do

- `hosting:salown` only. After it, `salown.com/staff-bundle/**` returns a **302** to the Staff site and the
  files are no longer published at all. Landing, `/app`, `/book/**`, `/s/**` unchanged.
- It ships **no** `main`-only work: no FIN-PROCESSOR-FEES B2/B2a, no Staff availability changes in the Admin
  bundle, no Reports fix.
- `hosting:salown-staff` is not deployed and its bundle is not rebuilt into the release.
- **Rollback:** redeploy `hosting:salown` from `56ceccc` — the exact source the site is already running.
  The redirect is a 302, so nothing is cached permanently on the client side.
- Still required: an owner approval naming tenant + URL, per Quick Rule 1, and a `RELEASE_LEDGER.md` row
  afterwards. Neither exists yet.

### Bookkeeping done with it

`ops/claims/SHADOW-STAFF-BUNDLE--alish--shadow-bundle.claim` (paths: `firebase.json`,
`ops/hosting-shadow-bundle.test.js`, `SYNC.md`) and a `SYNC.md` entry, both on `main` — neither path is in
the deploy workflow's trigger list, so neither started a release.

---

## 9. Released — `R-2026-09-20-A`, 2026-09-20 13:06 UK

`firebase deploy --only hosting:salown --project havuz-44f70`, from a clean `git archive 5be583c`
workspace with its own `npm ci`. Full row with every number: [RELEASE_LEDGER.md](RELEASE_LEDGER.md)
`R-2026-09-20-A`. Incident record: [INCIDENTS.md](INCIDENTS.md) 2026-09-20.

| Check | Before | After |
|---|---|---|
| `hosting:salown` version | `07c90b756c541a6a` (1789843984606000) | **`be573ea0498fc71f`** (1789909611896000) |
| Version contents | 122 files / 5,443,903 B | **97 files / 3,937,077 B** (−25 files, −1,506,826 B = the artefact) |
| CLI upload enumeration | — | *"found 95 files in hosting"* |
| `/staff-bundle/`, `index.html`, `assets/staff-*.js`, `sw.js`, `site.webmanifest` | 200, pre-enforcement Staff app | **302 → `https://staff.salown.com/`**, no `301` anywhere |
| `/`, `/app`, `/book/whitecross`, `/login`, `/features` | 200 | **200** |
| Admin bundle vs pinned build | 55/55 identical (pre-deploy anchor, proving live was `56ceccc`) | **55/55 identical**, plus `index.html` and `features.html` |
| `hosting:salown-staff` | `4c0ce013b1e45dfa` / 27 files / `staff-BVUJwYTL.js` | **unchanged**, all three |

**Rollback:** redeploy `hosting:salown` from `56ceccc`, or promote version `07c90b756c541a6a`. The redirect
is a `302`, so no client caches it permanently.

### ⚠️ The one thing left open

`main` does **not** carry these two config lines. A future Admin deploy from `main` would republish the
shadow bundle — the same 25 files, under the same URL. Cherry-picking `5be583c`'s `firebase.json` change and
the guard onto `main` is a separate decision and is **not** done. Until it is, treat it as a release trap:
any `main`-based `hosting:salown` release must carry this fix or re-open this finding.

**Compounded 2026-09-20 14:xx:** `main` now also carries **unreleased, un-approved Admin source** — `CLIENT-IDENTITY-P1` (`a2a627b`, `src/utils/clientIdentity.ts`, `clientTombstone`, `clientWriter`, `Clients.tsx`, `firestoreActions.ts` + `functions/src`), which reached `main` when a claim-only push named a SHA that descended from the code commit. Source-only and gated, never released. So a `main`-based Admin deploy today would republish the shadow bundle **and** ship client-identity Phase 1 — two unreviewed payloads in one release. Live is unaffected: version `be573ea0498fc71f` still serves `index-CiEeRNFs.js` with zero Phase 1 markers, and no CI run followed (every commit carried `[skip ci]`).

---

## 10. How to reproduce every claim here

```
git archive origin/main | tar -x -C <workspace>          # isolated, not a worktree
curl -s https://salown.com/staff-bundle/index.html       # 200 + entry chunk
curl -s .../assets/staff-CRqN2rBX.js | grep -o 'salown[A-Za-z]\{3,40\}' | sort -u
node upload-set.mjs <variant>...                         # firebase-tools listFiles(), per site
node predeploy-probe.mjs <variant> hosting:salown        # firebase-tools lifecycleHooks(), echo-stubbed
node guard-probe.mjs <variant>...                        # the proposed assertions, incl. negative control
firebase emulators:start --only hosting --project havuz-44f70   # local only; redirects honoured, ignore NOT
```

No step touches production, and none of them may be run as `firebase deploy`.
