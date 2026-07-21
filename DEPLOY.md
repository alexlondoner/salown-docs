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

### Firestore Rules — SINGLE SOURCE = `salown-app/firestore.rules` (2026-06-21)
Multiple repos (salown-panel, whitecross-site, eekurt…) could deploy rules to `havuz-44f70` →
**last one to deploy wins** → an old copy can overwrite the secure rule (the cross-tenant hole reopens).
**From now on rules are deployed ONLY from `salown-app/firestore.rules`.**
```bash
cd ~/Desktop/alex/salown-app
firebase deploy --only firestore:rules --project havuz-44f70
```
- The `firestore.rules` copies in other repos are DEAD — don't deploy `firestore:rules` from them.
- CI (`--only hosting`) doesn't touch rules; rules deploy is always manual + approved.
- Pull live rule + test (no Java/emulator needed): `python3 docs/test-firestore-rules.py salown-app/firestore.rules`.
- Rollback: `docs/firestore.rules.ROLLBACK.txt` (old ruleset name). Snapshot: `docs/firestore.rules.LIVE` (before the change).

### Hub.salown.com lesson (2026-06-21)
`hub.salown.com` is NOT a separate hosting site — it's a custom domain attached to the `salown` site.
The root path (`/`) serves `hosting/index.html` (landing) → opens **exactly the same** as salown.com.
The actual hub page is at the `/hub` rewrite (app bundle). Firebase cannot serve a different root
per host within a single site. It's not "old build overwrote it" — **the domain is attached to the wrong site**.
To fix: open a separate hosting site (`salown-hub`) for hub + move the domain to it, OR
in the landing index.html redirect to `/hub` if `location.host==='hub.salown.com'`.

## salown-app Deploy

```bash
cd ~/Desktop/alex/salown-app
npm run build          # only needed if src/ changed
npx firebase-tools deploy --only hosting --project havuz-44f70
```

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
firebase deploy --config firebase.saas.json --only hosting --project havuz-44f70
```
For panel/staff/owner sites use `deploy.sh` (interactive selection).

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
