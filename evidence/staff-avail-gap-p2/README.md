# `evidence/staff-avail-gap-p2/` — Phase 2 (Walk-in) verification and release-evaluation evidence

**What this is.** The raw evidence behind [`STAFF_AVAIL_GAP_PLAN.md`](../../STAFF_AVAIL_GAP_PLAN.md)
§9.7 / §9.7a for salown-app `9ea0aca`: Chrome screenshots, Firestore before/after snapshots, test and
tooling logs, and the old-server/new-client compatibility matrix. Kept here, not under `/private/tmp`,
for the same reason as [`../rules/`](../rules/README.md): evidence one reboot from gone is not evidence.

**Nothing here is production.** Every record was produced against local Firebase emulators
(project `demo-c1`, emulator-only) on synthetic tenants `p2ui`, `p2api` and `p2nb`, with synthetic
`@p2.test` accounts. No deploy and no production read or write happened. No password, ID token or
emulator authorization header value is stored in these files (scanned before copying).

**Layout.** One folder per run: `<date>-<purpose>/`.

| Run | Contents |
|---|---|
| `2026-09-13-local-verification/` | `README.md` (scenario table, automated checks), `RELEASE-EVALUATION.md` (content-level zero-write check, O2 scope, compatibility, release tooling), `MANIFEST.sha256` |

**Verify integrity.**

```bash
cd docs/evidence/staff-avail-gap-p2/2026-09-13-local-verification
shasum -a 256 -c MANIFEST.sha256
```

**Release status.** `PUSHED_NOT_LIVE`; no release approved. Open decisions and the rollback order are
in the plan §9.7a — this folder records evidence, not decisions.
