#!/bin/bash
# Reads beacon JSON output from stdin, outputs markdown comment
set -euo pipefail

INPUT=$(cat)

SUMMARY=$(echo "$INPUT" | jq -r '.analysis.summary')

# Build recommendations table
RECS_TABLE="| Priority | Title | Category | Effort |\n|----------|-------|----------|--------|"
while IFS= read -r rec; do
  TITLE=$(echo "$rec" | jq -r '.title')
  PRIORITY=$(echo "$rec" | jq -r '.priority')
  CATEGORY=$(echo "$rec" | jq -r '.category')
  EFFORT=$(echo "$rec" | jq -r '.effort')

  case "$PRIORITY" in
    critical) EMOJI="🔴" ;;
    high)     EMOJI="🟠" ;;
    medium)   EMOJI="🟡" ;;
    low)      EMOJI="🟢" ;;
    *)        EMOJI="⚪" ;;
  esac

  RECS_TABLE="$RECS_TABLE\n| $EMOJI $PRIORITY | $TITLE | $CATEGORY | $EFFORT |"
done < <(echo "$INPUT" | jq -c '.analysis.recommendations[]')

# Build today's focus list
FOCUS_LIST=""
while IFS= read -r item; do
  TITLE=$(echo "$item" | jq -r '.title')
  DESC=$(echo "$item" | jq -r '.description')
  FOCUS_LIST="$FOCUS_LIST\n- **$TITLE**: $DESC"
done < <(echo "$INPUT" | jq -c '.analysis.todaysFocus[]')

# Output markdown
cat <<MARKDOWN
<!-- beacon-analysis -->
## Beacon Analysis

**Summary:** $SUMMARY

### Recommendations
$(echo -e "$RECS_TABLE")

### Today's Focus
$(echo -e "$FOCUS_LIST")
MARKDOWN
