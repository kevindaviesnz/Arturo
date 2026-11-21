#!/usr/bin/env bash
# verify.sh: summarise health signals for each transcript in scenario_testing/
TDIR=/Users/kevindavies/Development/AI/Arturo/scenario_testing
cd "$TDIR"
printf "%-46s %6s %6s %6s %6s %6s %6s\n" "scenario" "staff" "queued" "apprv" "compl" "human" "FAIL"
for f in Scenario\ *.md; do
  [ -f "$f" ] || continue
  staff=$(grep -c "Staffing applied" "$f")
  queued=$(grep -c "Task queued" "$f")
  apprv=$(grep -c "Approved by" "$f")
  compl=$(grep -ciE "unverified model synthesis|status +completed" "$f")
  human=$(grep -c "Human task completed" "$f")
  fail=$(grep -cE "has no Worker assigned|No Functions are available|WARN: staffing not confirmed|<task-id>|<deleg-id>|<human-task-id>|<worker>|Worker chat failed|could not capture|policy not added|unknown executable|Not a command|◆ Usage" "$f")
  name=$(echo "$f" | sed -E 's/^Scenario ([0-9]+).*/\1/')
  printf "%-46s %6s %6s %6s %6s %6s %6s\n" "$name" "$staff" "$queued" "$apprv" "$compl" "$human" "$fail"
done
