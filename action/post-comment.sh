#!/bin/bash
# Posts or updates a Beacon analysis comment on a PR.
# Usage: post-comment.sh <pr-number> <repo> <comment-body-file>
# Requires: GITHUB_TOKEN env var, gh CLI
set -euo pipefail

PR_NUMBER="$1"
REPO="$2"
BODY_FILE="$3"
MARKER="<!-- beacon-analysis -->"

# Find existing beacon comment
EXISTING_COMMENT_ID=$(gh api \
  "repos/$REPO/issues/$PR_NUMBER/comments" \
  --jq ".[] | select(.body | contains(\"$MARKER\")) | .id" \
  2>/dev/null || echo "")

if [ -n "$EXISTING_COMMENT_ID" ]; then
  # Update existing comment
  gh api \
    "repos/$REPO/issues/comments/$EXISTING_COMMENT_ID" \
    --method PATCH \
    -f body="$(cat "$BODY_FILE")" \
    --silent
  echo "Updated existing Beacon comment (#$EXISTING_COMMENT_ID)"
else
  # Create new comment
  gh api \
    "repos/$REPO/issues/$PR_NUMBER/comments" \
    --method POST \
    -f body="$(cat "$BODY_FILE")" \
    --silent
  echo "Created new Beacon comment on PR #$PR_NUMBER"
fi
