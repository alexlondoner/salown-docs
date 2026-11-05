# PROMPTS.md

Claude Code prompt templates that work. If a new prompt works, add it here.

---

## staff_app_fixes

For fixing multiple independent bugs in the salOWN Staff App in one pass.

```
Read the Staff App files under salown-app/src/.
Fix these bugs in order — after each fix report the changed lines, then move to the next:

1. [bug description]
2. [bug description]
...

Rule: while fixing one bug, don't touch anything else.
```

---

## merge_hardening

For keeping the same logic in salown-app and whitecross-site in sync.

```
Read [function name] in [file name].
The counterpart of the same logic in whitecross-site is [file:line].
List the differences between the two.
Match the Whitecross version to the salown-app version — logic differences only, not style.
Show the changed lines first, wait for confirmation.
```

---

## workspace_hygiene

Append to every coding, verification or release prompt (Claude, Codex or human). Labels only — the rules
themselves live in `docs/PRINCIPLES.md` §6 and win on any conflict; do not expand this block into a copy.

```
Workspace hygiene: docs/PRINCIPLES.md §6 (P15–P19) applies in full.
- P15 verify proportionally; report gates run AND skipped; reuse evidence only with the proving hash.
- P16 one implementation workspace, ≤1 comparison copy; any extra needs reason + disk cost + cleanup plan.
- P17 temp dirs get a cleanup trap; keep reports/hashes/manifests, not node_modules or repo copies.
- P19 never delete what you do not own; destructive cleanup = manifest + checks + owner approval.
- P18 finish with the closure report: WORKSPACE_CLOSED, or WORKSPACE_OPEN — <blocker>.
```

---

_To add a new prompt: title + use case + template._
