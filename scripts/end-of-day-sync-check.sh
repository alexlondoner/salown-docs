#!/usr/bin/env bash
#
# End-of-day sync check — READ ONLY.
#
# Model: the canonical STORAGE is the GitHub remotes, not any single device.
#   canonical device  -> commit -> push -> remote = source of truth
#   secondary devices -> git fetch --prune && git pull --rebase  (catch up)
#
# This script NEVER commits, pushes, resets, checks out, or edits the working
# tree. It only reads state (the single write it performs is `git fetch --prune`,
# which updates remote-tracking refs — not your files) and reports, per repo:
#   CLEAN        working tree clean, no unpushed, not behind
#   DIRTY        uncommitted changes (would be LOST if the device dies)
#   UNPUSHED     local commits not on the remote (would be LOST if the device dies)
#   BEHIND       remote has commits you don't -> `git pull --rebase` to catch up
#   DIVERGED     both ahead and behind -> reconcile manually (never auto-pick)
#   NO-UPSTREAM  branch has no tracking remote -> not backed up anywhere
#
# It auto-discovers every git repo directly under the workspace, so it adapts to
# each device (repo renames like Salown->salown-app, extra clones, etc.).
#
# Usage:
#   ./end-of-day-sync-check.sh                 # workspace = parent of the docs repo
#   ./end-of-day-sync-check.sh ~/code/alex     # explicit workspace
#   WORKSPACE=~/code/alex ./end-of-day-sync-check.sh
#
set -uo pipefail   # NOT -e: one bad repo must not abort the whole sweep

# -- resolve workspace -----------------------------------------------------
# Default: the directory that CONTAINS the docs repo (script lives in docs/scripts/).
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_WORKSPACE="$(cd "$SELF_DIR/../.." && pwd)"
WORKSPACE="${1:-${WORKSPACE:-$DEFAULT_WORKSPACE}}"
[[ -d "$WORKSPACE" ]] || { echo "ERROR: workspace not found: $WORKSPACE" >&2; exit 1; }

echo "End-of-day sync check"
echo "workspace: $WORKSPACE"
echo "note: READ ONLY — nothing is committed, pushed, or modified."
echo "-------------------------------------------------------------------"

# -- counters for the final verdict ---------------------------------------
n_total=0; n_clean=0; n_attention=0
attention_repos=""

# -- sweep every git repo one level under the workspace -------------------
for dir in "$WORKSPACE"/*/; do
  [[ -d "${dir}.git" ]] || continue
  repo="$(basename "$dir")"
  n_total=$((n_total+1))
  cd "$dir" || continue

  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"

  # update remote-tracking refs (best-effort; offline must not break the report)
  fetch_note=""
  if ! git fetch --prune --quiet 2>/dev/null; then
    fetch_note=" (fetch failed — offline? state below may be stale)"
  fi

  # dirty working tree?
  dirty_count="$(git status --porcelain 2>/dev/null | grep -c . || true)"

  # upstream present?
  if git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
    ahead="$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)"
    behind="$(git rev-list --count 'HEAD..@{u}' 2>/dev/null || echo 0)"
    has_upstream=1
  else
    ahead=0; behind=0; has_upstream=0
  fi

  # classify (a repo can carry several flags; collect them all)
  flags=""
  [[ "$has_upstream" == "0" ]] && flags+=" NO-UPSTREAM"
  [[ "$dirty_count" -gt 0 ]]   && flags+=" DIRTY($dirty_count)"
  if [[ "$ahead" -gt 0 && "$behind" -gt 0 ]]; then
    flags+=" DIVERGED(+$ahead/-$behind)"
  else
    [[ "$ahead"  -gt 0 ]] && flags+=" UNPUSHED($ahead)"
    [[ "$behind" -gt 0 ]] && flags+=" BEHIND($behind)"
  fi

  if [[ -z "$flags" ]]; then
    printf '  ✅ %-18s %-14s CLEAN%s\n' "$repo" "[$branch]" "$fetch_note"
    n_clean=$((n_clean+1))
  else
    printf '  ⚠️  %-18s %-14s%s%s\n' "$repo" "[$branch]" "$flags" "$fetch_note"
    n_attention=$((n_attention+1))
    attention_repos+=" $repo"
    # show WHICH files are dirty (never their contents) so the owner can act
    if [[ "$dirty_count" -gt 0 ]]; then
      git status --porcelain 2>/dev/null | sed 's/^/        /'
    fi
  fi
done

echo "-------------------------------------------------------------------"
if [[ "$n_total" -eq 0 ]]; then
  echo "No git repos found directly under $WORKSPACE"
  exit 1
fi

if [[ "$n_attention" -eq 0 ]]; then
  echo "VERDICT: ✅ ALL SYNCED — $n_clean/$n_total repos clean. Remote = source of truth."
  echo "Safe to leave this device. Secondary devices: git fetch --prune && git pull --rebase"
  exit 0
else
  echo "VERDICT: ⚠️  $n_attention/$n_total repo(s) need attention:$attention_repos"
  echo
  echo "  DIRTY / UNPUSHED -> commit (explicit paths, no 'git add .') + push, or"
  echo "                      stash/patch if it's WIP you don't want on the remote yet."
  echo "                      Until then this work exists ONLY on this device."
  echo "  BEHIND           -> git pull --rebase"
  echo "  DIVERGED         -> reconcile manually; never auto-pick a winner."
  echo "  NO-UPSTREAM      -> git push -u; the branch is backed up nowhere."
  echo
  echo "Respect path ownership (salown-app/ops/claims/): a DIRTY file under an"
  echo "active claim belongs to another session — leave it for its owner."
  exit 2
fi
