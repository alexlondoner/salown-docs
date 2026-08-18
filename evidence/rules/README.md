# `evidence/rules/` — byte-exact Firestore ruleset snapshots kept as rollback artefacts

**What this is.** One file per *previously live* Firestore ruleset, captured byte-exact from
production before it was replaced, so a rollback never depends on re-deriving a ruleset from git
history. [`RELEASE_LEDGER.md`](../../RELEASE_LEDGER.md) names the rollback identity; this directory
holds the bytes it names.

**Why it exists.** Added 2026-08-18 by `R2C-RELEASE-EVIDENCE-DURABILITY-P0`. The
`FIN-DATED-ROTA-R2c` Phase B rollback artefact existed only under `/private/tmp`, one reboot from
gone, while the ledger row that would have pointed at it had not been written either. A rollback
identity you cannot execute is a rollback identity in name only.

## The naming rule — not decorative

A snapshot **must never** be named `firestore.rules`.

`salown-app/ops/rulesAuthority.mjs:255-267` scans the whole workspace for files with exactly that
name, because that is what `firebase deploy --only firestore:rules` would pick up by default if a
`firestore` block were ever re-added to a config near it. Its own words:

> Snapshots and legacy copies must not carry that name — `firestore.rules.LIVE`, `…PREV-*`,
> `…LEGACY-DO-NOT-DEPLOY.txt` are inert, `firestore.rules` is a loaded gun.

So the convention here is:

```
firestore.rules.PREV-<full-ruleset-id>
```

The full ruleset id is in the filename on purpose: the file is self-identifying even if it is
copied somewhere with no ledger next to it.

**Two independent reasons a file here cannot be deployed:**

1. it does not carry the default name, so no rules deploy resolves to it; and
2. `salown-docs` contains **no** `firebase.json` and **no** `.firebaserc`, so this repository has
   no deploy target of any kind.

## Rules for this directory

- **Rulesets only.** No credentials, tokens, service-account keys, customer data or scratch output.
  A ruleset legitimately contains `request.auth.token.<claim>` expressions and collection paths such
  as `fcmTokens`; those are rule syntax, not secrets. Anything that is an actual secret does not
  belong in a repository at all.
- **Append-only in spirit.** A snapshot is evidence of what was running. Never edit one; if it is
  wrong, add a corrected file and say so in the ledger.
- **Every file must be reachable from a ledger row**, and every rules row's rollback identity should
  name the file that backs it.
- **Verify on arrival.** Record the sha256 in the ledger and re-hash after copying.

## Contents

| File | Ruleset | Live from → until | Bytes | sha256 |
|---|---|---|---|---|
| `firestore.rules.PREV-10914cef-35a1-4b2d-a085-4d79680f212c` | `10914cef-35a1-4b2d-a085-4d79680f212c` | 2026-08-14T22:31:55.188630Z → 2026-08-17T17:06:06.400701Z | 30,132 | `2d2097a0cd9262dc6db819097ba9c6c6f08977b3b488c5b41c6e3b55b93c6c8e` |

**The current live ruleset is deliberately NOT duplicated here.** `60abf8e4-e6ca-43e0-8bb7-26ef72ae58ba`
is byte-identical to `salown-app/firestore.rules` at commit `dd3e772` (sha256
`b04f7745c5b420db3aaeeefdc7355e085f9115a28b573e7ed80ff1ba1b9809a4`, verified against the source
fetched back out of production), so git already holds it durably. A snapshot is taken when a ruleset
*stops* being live, not when it starts.
