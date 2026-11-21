#!/usr/bin/env bash
set -uo pipefail
cd /Users/kevindavies/Development/AI/Arturo/cli
declare -A NAMES=(
  [002]="Retail feature assessment"
  [003]="Legal contract review"
  [004]="Insurance claim triage"
  [005]="Discovery research framing"
  [006]="Investment assessment"
  [007]="Climate evidence synthesis"
  [008]="Cybersecurity incident response"
  [009]="Therapeutic target assessment"
  [010]="Security incident investigation"
  [011]="Synthesis strategy review loop"
)
for n in 002 003 004 005 006 007 008 009 010 011; do
  echo "########## RUNNING $n — ${NAMES[$n]} ##########"
  ./run_scenario.sh "scenario_plans/$n.plan" "s$n" \
    "/Users/kevindavies/Development/AI/Arturo/scenario_testing/Scenario $n — ${NAMES[$n]}.txt"
done
echo "ALL DONE"
