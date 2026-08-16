# DEPLOY.md

## Core Rule

**Before every deploy, state tenant + URL, wait for confirmation.**
Deploy scripts: available under `salown-app/` and `whitecross-site/`.

## ⛔ SINGLE SOURCE RULE — never build/deploy the old one from somewhere else

**There is ONE correct source folder for each site. Deploy ONLY from there.**
If we update a feature in one place and then build from another folder (old bundle/old source)
and deploy, the live site reverts to the OLD version and our work is wiped out.

| Live URL / site | THE correct source | Build | NEVER deploy from here |
|---|---|---|---|
| salown.com `/`, `/app`, `/book`, `/s` (`salown`) | `salown-app/hosting/` | `npm run build` | — (`salown-site/` DELETED 2026-06-29) |
| staff.salown.com (`salown-staff`) | `salown-app/` | `npm run build:staff` | ❌ another bundle |
| whitecrossbarbers.com (`whitecrossbarbers-*`) | `whitecross-site/` | in-site | — |

**Before every deploy always:** are `git status` + `git log origin/main..HEAD` clean? If not,
commit/push first — because push to `main` = CI auto deploy, and uncommitted files
do NOT go live → risk of partial/old state.

### Firestore Rules — SINGLE SOURCE = `salown-app/firestore.rules` (2026-06-21, ENFORCED 2026-08-16)

**The one canonical directory, and the one canonical command:**

```bash
cd ~/Desktop/alex/salown-app                                   # the ONLY directory
firebase deploy --only firestore:rules --project havuz-44f70   # the ONLY command
```

Multiple repos could deploy rules to `havuz-44f70` → **last one to deploy wins** → an old copy
overwrites the secure ruleset and the cross-tenant hole reopens.

> ⚠️ **This rule was written here on 2026-06-21 and enforced by nothing until 2026-08-16.**
> `FIRESTORE-RULES-SSOT-P0` audited the workspace and found **five** other directories that could
> still publish a ruleset — `salown-panel/`, `whitecross-site/` (root), `whitecross-site/barber-panel/`,
> and **two git worktrees**. Three of the stale copies ended in
> `match /{document=**} { allow read, write: if isAuth(); }` — every logged-in user of every tenant,
> read and write, across all tenants — and a worktree held one where every tenant subcollection was
> `allow read: if true`. Nothing about the command would have looked wrong. **A documented rule that
> no machine checks is not a control.**

**What now enforces it**

| Layer | Where | Fails when |
|---|---|---|
| Config removal | the `firestore` block is gone from every non-canonical `firebase.json` | `--only firestore:rules` there fails **locally at config parse**, before any network call or credential: `Cannot understand what targets to deploy/serve.` |
| Renaming | stale copies are `*.LEGACY-DO-NOT-DEPLOY.txt`, never `firestore.rules` | a re-added block cannot silently find a rules file by its default name |
| Workspace scan | `salown-app/ops/rules-authority.test.js` (in `npm test` **and** the deploy workflow) | a second config declares `firestore`; a script outside `salown-app` runs a rules deploy; a stray `firestore.rules` appears; a git worktree carries a deployable config; the canonical ruleset grows a **global write grant** |
| Repo-local | `whitecross-site/scripts/check-rules-authority.sh`, called at the top of `deploy.sh` and `scripts/deploy-functions.sh` | that repo regains a Firestore target, or a caller forwards a `firestore:*` selector |

- The `firestore.rules` copies in other repos are DEAD, renamed, and now unreachable by any config.
- **Git worktrees are time machines.** Their `firebase.json` is whatever the checked-out commit said,
  so fixing `main` cannot fix them. A stale worktree carrying a rules config is **removed**, never
  allowlisted (`git worktree remove`, then `git worktree prune`).
- CI never touches rules; rules deploy is always manual + approved. Since 2026-08-08 a
  `firestore.rules` change does not even start the hosting workflow (see the matrix below).
- Pull live rule + test (no Java/emulator needed): `python3 docs/test-firestore-rules.py salown-app/firestore.rules`.

**Rollback identity — capture it BEFORE you deploy, never after**

A ruleset is rolled back by **ID**, not by re-deploying a file (re-deploying makes a third ruleset
and loses the identity of what was live). The pre-change ID must be fetched first:

```bash
# 1) BEFORE deploying — the current live ruleset name IS the rollback target
firebase firestore:rules:list --project havuz-44f70 | head -3   # or the Rules REST API
# 2) record it in docs/RELEASE_LEDGER.md as "previous → new", and in
#    docs/firestore.rules.ROLLBACK.txt; snapshot the live bytes to docs/firestore.rules.LIVE
# 3) deploy, then verify the new ruleset is byte-identical to the local file
# 4) to roll back: re-publish the recorded PREVIOUS ruleset id (Console → Firestore → Rules →
#    history → that version → Restore), from salown-app and nowhere else
```

⚠️ `ROADMAP.md` currently records the pre-`SEC-CATCHALL-1` live ruleset id as **`STATUS_UNKNOWN`**
(two rows disagree: `640c3dae-…` vs `10914cef-…`). It must be fetched at deploy time and not guessed.

### Hub.salown.com lesson (2026-06-21)
`hub.salown.com` is NOT a separate hosting site — it's a custom domain attached to the `salown` site.
The root path (`/`) serves `hosting/index.html` (landing) → opens **exactly the same** as salown.com.
The actual hub page is at the `/hub` rewrite (app bundle). Firebase cannot serve a different root
per host within a single site. It's not "old build overwrote it" — **the domain is attached to the wrong site**.
To fix: open a separate hosting site (`salown-hub`) for hub + move the domain to it, OR
in the landing index.html redirect to `/hub` if `location.host==='hub.salown.com'`.

## Deployment matrix — which trigger releases which site (CI-HOSTING-SCOPE-P0, 2026-08-08)

**⛔ Never `--only hosting`, anywhere.** It selects the hosting *product*, so it releases every
site in that config's hosting array — a set that changes when the config changes rather than
when you decide something. Both repos' workflows and both deploy scripts now name their targets.

| Site | Released by | Trigger / command |
|---|---|---|
| `salown` — salown.com, `/app`, `/book`, `/s` | `salown-app/.github/workflows/deploy.yml` | push to `main` touching the Admin-shipped allow-list → `--only hosting:salown` |
| `salown-staff` — staff.salown.com | **hand only** | `npm run deploy:staff` (`--only hosting:salown-staff`) |
| `whitecrossbarbers-admin` + `-owner` | `whitecross-site/.github/workflows/deploy.yml` | push to `main` touching `barber-panel/src|public|package*.json`, `firebase.admin.json`, `.firebaserc` → `--only hosting:whitecrossbarbers-admin,hosting:whitecrossbarbers-owner` |
| `whitecrossbarbers-app` / `-clientapp` | **hand only** | `whitecross-site/deploy.sh` (interactive, confirm-to-ship) |
| `whitecrossbarbers-saas` — **the live public site** | **hand only** | `--only hosting:whitecrossbarbers-saas --config firebase.saas.json` |
| functions / rules / indexes | **hand only**, targeted | never CI, never blanket |

**The Admin allow-list** (`salown-app`): `index.html`, `src/**` *except* `src/staff/**`,
`public/**`, `packages/**`, `hosting/**` *except* `hosting/staff-bundle/**`, `vite.config.js`,
`package.json`, `package-lock.json`. It is fail-closed: a path nobody listed does not deploy.
So a commit touching only `functions/`, `firestore.rules`, `firestore.indexes.json`, `docs/`,
`ops/`, `scripts/`, `SYNC.md` or `src/staff/**` starts no Hosting deploy at all.

Both halves of the salOWN scope — the named target and the allow-list — are asserted by
`salown-app/ops/deploy-policy.test.js`, in `npm test` and as a step inside the deploy workflow
itself. Widening CI back to `--only hosting` fails a test before it can reach production.

**Why this mattered:** the unscoped `--only hosting` is exactly how `0f9a064` (2026-08-03) and
`f01c902` (2026-08-04) put unapproved Staff builds live for 23 and 30 minutes. See
[INCIDENTS.md](INCIDENTS.md).

**`[skip ci]` is still required on every outgoing salown-app commit** — `ops/release-guard.sh`
refuses an untagged push, and `ALLOW_CI_RELEASE=1` (legacy alias: `ALLOW_BOTH_TARGETS=1`) is how
you say you mean it. The path filter decides whether CI *starts*; the guard decides whether the
release is *deliberate*. They are different questions, because the predeploy hook rebuilds from
current `src/` — so the first push that does clear the filter ships every unreleased change with it.

## salown-app Deploy

```bash
cd ~/Desktop/alex/salown-app
npx firebase deploy --only hosting:salown --project havuz-44f70        # Admin/landing
npx firebase deploy --only hosting:salown-staff --project havuz-44f70  # Staff — separate approval
```

The predeploy hook builds for you; a manual `npm run build` first is optional.

### ⚠️ OPEN DEBT — the predeploy topology is shared, so a single-target deploy still builds BOTH

**Observed on the Unit 8 release, 2026-08-05.** `firebase deploy --only hosting:salown` **does not
release** `salown-staff` (verified: it stayed at `8409e666da7ea223`), but it **does run that target's
predeploy hook**. The tracked `hosting/staff-bundle/**` is rebuilt and left dirty on every Admin
deploy — `staff-CU9kxXXw.js` deleted, `staff-M0geOKYo.js` written, `index.html` modified.

It is not `npm run build` doing it: that script is plain `vite build`. It is the hook attached to the
*other* hosting entry in `firebase.json` running regardless of the `--only` filter.

**This is a release-process debt, NOT a Staff deployment incident** — the live Staff version did not
move on that run. But the topology is wrong: a single-target Admin deploy must not build or mutate
the other target's tracked artifact. Two things follow from it that are worth naming: the tracked
staff bundle can silently drift out of step with what is actually served, and the Admin site's
mirrored `/staff-bundle/` path carries whatever the hook last produced.

**REQUIRED until the fix is designed and tested — after every `hosting:salown` deploy:**

```bash
git status --short                      # expect ONLY hosting/staff-bundle/** churn
rm -f hosting/staff-bundle/assets/<newly-generated>.js
git restore hosting/staff-bundle/assets/<tracked>.js hosting/staff-bundle/index.html
git status --porcelain | wc -l          # must be 0 before committing
```

Explicit paths only — never `git restore .`, never `git checkout .`: other sessions share this repo
([`ops/claims/README.md`](../salown-app/ops/claims/README.md)).

**The fix is not yet designed.** Candidates: move the staff build out of `firebase.json` predeploy
into an explicit step; stop tracking `hosting/staff-bundle/**` (it is build output, and
`hosting/public-bundle/` is already ignored); or split the two sites' public roots so neither
contains the other. Tracked under Tech Debt in [ROADMAP.md](ROADMAP.md).

**Separate deploy targets** (owner approval required):
```bash
firebase deploy --only functions
firebase deploy --only firestore:rules
```

**Order for security changes:** functions → hosting → rules LAST.

⚠️ **`salown-site/` DELETED (2026-06-29)** — the only hosting source is now `salown-app/hosting/`. Landing, public profile (`/s/**`), booking (`/book/**`) all deploy from here. Backup: `../salown-site-backup-20260629-1841.zip`.

## Landing / hosting source

`salown-app/hosting/index.html` is now a REAL file (the old salown-site symlink was removed).
- Edit `salown-app/hosting/*.html` → landing pages (`/`, `/barbers`, `/vs-*`, …)
- Edit `salown-app/src/` → `npm run build` → `/app`, `/login`, `/s/**`, `/book/**` update

## whitecross-site Deploy

**⚠️ Since 2026-07-12 whitecrossbarbers.com = Firebase Hosting** (`whitecrossbarbers-saas`
site; GH Pages OFF, repo private, GitHub push does NOT UPDATE the site). DNS GoDaddy →
apex A `199.36.158.100`, www CNAME `whitecrossbarbers-saas.web.app`, Enforce equivalent
http→301 automatic in Firebase. Public site deploy:
```bash
cd ~/Desktop/alex/whitecross-site
firebase deploy --only hosting:whitecrossbarbers-saas --config firebase.saas.json --project havuz-44f70
```
`firebase.saas.json` currently declares this one site, so the target is redundant *today* — name
it anyway: the redundancy is what keeps the command correct if a second entry is ever added.
No workflow deploys this site; a GitHub push does **not** update whitecrossbarbers.com.

For the staff/client/owner panel sites use `deploy.sh` (interactive, confirm-to-ship; every
option resolves to an explicit `hosting:<site>` list, option 5 included). The admin + owner
panels also auto-deploy from `whitecross-site`'s own workflow when `barber-panel/` changes.

Whitecross functions deploy — **NEVER WRITE blanket `--only functions`** (it proposes
deleting salown codebase's 52 functions; see functions-deploy-gotcha):
```bash
firebase deploy --only functions:FN_NAME --project havuz-44f70
```

## Critical Rule: Data Deletion

**NEVER bulk-delete from Firestore.**
1. Full export: `gcloud firestore export gs://...`
2. Dry-run → CSV → owner review
3. Write only after approval

## Build Check

`npm run build` — must pass with zero errors. Mandatory before deploy.
