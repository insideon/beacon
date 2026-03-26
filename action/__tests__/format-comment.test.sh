#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0

assert_contains() {
  local label="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: $label — expected to contain: $needle"
  fi
}

INPUT_JSON='{
  "project": { "name": "my-app", "techStack": ["TypeScript"] },
  "analysis": {
    "summary": "Project is healthy.",
    "recommendations": [
      {
        "title": "Fix auth bug",
        "description": "Auth tokens expire too early",
        "priority": "high",
        "category": "bug",
        "effort": "small",
        "reasoning": "Security risk"
      },
      {
        "title": "Add docs",
        "description": "Missing API docs",
        "priority": "low",
        "category": "docs",
        "effort": "medium",
        "reasoning": "Developer experience"
      }
    ],
    "todaysFocus": [
      {
        "title": "Fix auth bug",
        "description": "Auth tokens expire too early",
        "priority": "high",
        "category": "bug",
        "effort": "small",
        "reasoning": "Security risk"
      }
    ]
  }
}'

OUTPUT=$(echo "$INPUT_JSON" | bash "$SCRIPT_DIR/format-comment.sh")

assert_contains "has marker" "$OUTPUT" "<!-- beacon-analysis -->"
assert_contains "has title" "$OUTPUT" "## Beacon Analysis"
assert_contains "has summary" "$OUTPUT" "Project is healthy."
assert_contains "has recommendation title" "$OUTPUT" "Fix auth bug"
assert_contains "has priority emoji" "$OUTPUT" "🟠"
assert_contains "has today focus" "$OUTPUT" "Today's Focus"
assert_contains "has low priority emoji" "$OUTPUT" "🟢"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
