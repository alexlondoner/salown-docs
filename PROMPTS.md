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

_To add a new prompt: title + use case + template._
