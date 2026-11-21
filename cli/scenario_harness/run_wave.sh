#!/usr/bin/env bash
# run_wave.sh "002|Retail feature assessment" "004|Insurance claim triage" ...
# For each: run plan -> raw .txt -> readable .md under scenario_testing/.
set -uo pipefail
cd /Users/kevindavies/Development/AI/Arturo/cli
HARN=scenario_harness
TDIR=/Users/kevindavies/Development/AI/Arturo/scenario_testing
for spec in "$@"; do
  n="${spec%%|*}"; name="${spec#*|}"
  echo "########## $n — $name ##########"
  raw="$TDIR/.raw-$n.txt"
  "$HARN/run_scenario.sh" "$HARN/plans/$n.plan" "s$n" "$raw"
  "$HARN/txt_to_md.sh" "$raw" "$TDIR/Scenario $n — $name.md" "Scenario $n — $name"
  rm -f "$raw"
  echo "  -> Scenario $n — $name.md"
done
echo "WAVE DONE"
