#!/usr/bin/env bash
#
# Daily Project Truth — reconciliation check. READ ONLY.
#
# Companion to end-of-day-sync-check.sh. That script answers "is my work backed
# up?". This one answers the question that actually goes wrong here:
#
#     "Does the written record still match what is running?"
#
# It NEVER commits, pushes, deploys, resets, checks out or edits anything. The
# only write it performs is `git fetch --prune`, which updates remote-tracking
# refs, not your files. It reads no credentials and contacts no Firebase API —
# production identities are verified by a human or by a session with read-only
# metadata access, and recorded in RELEASE_LEDGER.md.
#
# It reports, and exits non-zero if the day looks unreconciled:
#   - per repo: HEAD / origin/main / ahead / behind / dirty
#   - active claims (path ownership) across the workspace
#   - today's commits, per repo
#   - whether ROADMAP.md carries TODAY's reconciliation stamp
#   - whether RELEASE_LEDGER.md was touched today, if a release-shaped commit exists
#
# Usage:
#   ./daily-reconciliation-check.sh                 # workspace = parent of the docs repo
#   ./daily-reconciliation-check.sh ~/code/alex     # explicit workspace
#
set -uo pipefail   # NOT -e: one bad repo must not abort the sweep

SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCS_DIR="$(cd "$SELF_DIR/.." && pwd)"
DEFAULT_WORKSPACE="$(cd "$DOCS_DIR/.." && pwd)"
WORKSPACE="${1:-${WORKSPACE:-$DEFAULT_WORKSPACE}}"
[[ -d "$WORKSPACE" ]] || { echo "ERROR: workspace not found: $WORKSPACE" >&2; exit 1; }

ROADMAP="$DOCS_DIR/ROADMAP.md"
LEDGER="$DOCS_DIR/RELEASE_LEDGER.md"
TODAY="$(date -u +%Y-%m-%d)"

echo "Daily Project Truth — reconciliation check"
echo "workspace: $WORKSPACE"
echo "date (UTC): $TODAY"
echo "note: READ ONLY — nothing is committed, pushed, deployed or modified."
echo "==================================================================="

problems=0
note() { printf '  ⚠️  %s\n' "$1"; problems=$((problems+1)); }
ok()   { printf '  ✅ %s\n' "$1"; }

# ---------------------------------------------------------------- repos ----
echo
echo "1. REPOSITORY STATE"
commits_today=0
release_shaped=0
for dir in "$WORKSPACE"/*/; do
  [[ -d "${dir}.git" ]] || continue
  repo="$(basename "$dir")"
  cd "$dir" || continue
  git fetch --prune --quiet 2>/dev/null || true

  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
  head="$(git rev-parse --short HEAD 2>/dev/null || echo '?')"
  dirty="$(git status --porcelain 2>/dev/null | grep -c . || true)"
  if git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
    ahead="$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)"
    behind="$(git rev-list --count 'HEAD..@{u}' 2>/dev/null || echo 0)"
  else
    ahead=0; behind=0
  fi

  n="$(git log --since="${TODAY}T00:00:00Z" --oneline 2>/dev/null | grep -c . || true)"
  commits_today=$((commits_today + n))

  printf '  %-18s [%s] %s  ahead/behind %s/%s  dirty %s  commits today %s\n' \
    "$repo" "$branch" "$head" "$ahead" "$behind" "$dirty" "$n"

  if [[ "$dirty" -gt 0 ]]; then
    git status --porcelain 2>/dev/null | sed 's/^/        /'
    note "$repo has uncommitted changes — a release must never be built from this tree"
  fi
  [[ "$ahead"  -gt 0 ]] && note "$repo has $ahead unpushed commit(s)"
  [[ "$behind" -gt 0 ]] && note "$repo is $behind behind origin — pull --rebase before claiming"

  # release-shaped commits today (heuristic, deliberately loose)
  if git log --since="${TODAY}T00:00:00Z" --format='%s' 2>/dev/null \
       | grep -qiE 'deploy|release|LIVE|hosting:'; then
    release_shaped=1
    printf '        ↳ release-shaped commit(s) today in %s\n' "$repo"
  fi
done

# --------------------------------------------------------------- claims ----
echo
echo "2. ACTIVE CLAIMS (path ownership)"
found_claims=0
while IFS= read -r c; do
  found_claims=1
  printf '  • %s\n' "$(basename "$c")"
  grep -E '^(owner|status|task):' "$c" 2>/dev/null | sed 's/^/      /'
done < <(find "$WORKSPACE" -path '*/ops/claims/*.claim' \
           -not -path '*/node_modules/*' \
           -not -path '*/.wt-*' \
           -not -path '*/worktrees/*' 2>/dev/null | sort)
[[ "$found_claims" -eq 0 ]] && ok "no active claims"
# Linked worktrees carry stale copies of a claim registry they no longer own.
# They are excluded above on purpose; surface them separately so a spent
# worktree is visible without being mistaken for live path ownership.
stale="$(find "$WORKSPACE" -path '*/ops/claims/*.claim' \
           \( -path '*/.wt-*' -o -path '*/worktrees/*' \) 2>/dev/null | wc -l | tr -d ' ')"
[[ "$stale" -gt 0 ]] && printf '  ℹ️  %s claim file(s) in linked worktrees — NOT active ownership; prune the worktree\n' "$stale"

# -------------------------------------------------------------- roadmap ----
echo
echo "3. ROADMAP RECONCILIATION STAMP"
if [[ ! -f "$ROADMAP" ]]; then
  note "ROADMAP.md not found at $ROADMAP"
elif grep -q "$TODAY" "$ROADMAP"; then
  ok "ROADMAP.md carries today's date ($TODAY)"
elif grep -q "DAILY_RECONCILIATION_COMPLETE — NO STATUS CHANGE" "$ROADMAP"; then
  ok "ROADMAP.md carries a no-status-change reconciliation marker"
else
  note "ROADMAP.md has no $TODAY stamp — reconcile, or record 'DAILY_RECONCILIATION_COMPLETE — NO STATUS CHANGE'"
fi

# --------------------------------------------------------------- ledger ----
echo
echo "4. RELEASE LEDGER"
if [[ ! -f "$LEDGER" ]]; then
  note "RELEASE_LEDGER.md not found at $LEDGER"
elif [[ "$release_shaped" -eq 1 ]]; then
  if grep -q "$TODAY" "$LEDGER"; then
    ok "a release-shaped commit exists today AND RELEASE_LEDGER.md carries $TODAY"
  else
    note "a release-shaped commit exists today but RELEASE_LEDGER.md has no $TODAY row — a release without a ledger row does not count as done"
  fi
else
  ok "no release-shaped commit today; ledger row not required"
fi

# ------------------------------------------------------------- unknowns ----
echo
echo "5. OPEN UNKNOWNS AND BLOCKERS (from ROADMAP)"
if [[ -f "$ROADMAP" ]]; then
  for tag in STATUS_UNKNOWN BLOCKED PUSHED_NOT_LIVE IN_PROGRESS; do
    printf '  %-18s %s\n' "$tag" "$(grep -o "$tag" "$ROADMAP" | grep -c . || true)"
  done
  echo "     (counts are mentions, not items — open ROADMAP §4 for the authoritative table)"
fi

echo
echo "==================================================================="
if [[ "$problems" -eq 0 ]]; then
  echo "VERDICT: ✅ RECONCILED — record is consistent with the tree."
  echo "Reminders that no script can check for you:"
  echo "  · a live revision/version is the ONLY proof of LIVE_VERIFIED"
  echo "  · never deploy from a dirty tree, and never deploy then commit"
  echo "  · record the PREVIOUS live identity before deploying — it is the rollback anchor"
  exit 0
else
  echo "VERDICT: ⚠️  $problems item(s) need attention before the day is closed."
  echo "Fix, or record the gap explicitly as STATUS_UNKNOWN in ROADMAP §13."
  exit 2
fi
