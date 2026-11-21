#!/usr/bin/env bash
# run_blueprints.sh [n...]
#
# Recaptures the six blueprint sessions, one after another, and says which are
# fit to film. With no arguments it runs all six; give numbers to run a subset:
#
#   bash scenario_harness/run_blueprints.sh          # all six
#   bash scenario_harness/run_blueprints.sh 6        # just the event-driven one
#   bash scenario_harness/run_blueprints.sh 2 5
#
# Runs are sequential on purpose. They share one Ollama, and six at once would
# make every model call slower and the timings meaningless.
#
# Each blueprint is attempted twice. About one run in five fails for reasons
# that have nothing to do with the product — a staffing plan that proposes no
# Workers, an expect invocation that does not start — and a single-shot script
# would report those as broken demos.
#
# This is the verification pass, so it runs at full speed. Film with
# run_scenario_clean.sh directly, which types at reading pace.
set -uo pipefail

cd "$(dirname "$0")/.." || exit 2

if [ ! -e node_modules ]; then
  cat >&2 <<MISSING
cli/node_modules is missing, so nothing can start.

In a worktree it is a symlink to the main checkout, and it is removed before
each commit because git does not ignore it. Recreate it:

  ln -sf /Users/kevindavies/Development/AI/Arturo/cli/node_modules "$(pwd)/node_modules"
MISSING
  exit 2
fi

OUT_DIR="../scenario_testing/blueprints"
mkdir -p "$OUT_DIR"

# Verification, not filming.
export ARTURO_DEMO_TYPE_DELAY="${ARTURO_DEMO_TYPE_DELAY:-0}"
export ARTURO_DEMO_READ_PAUSE="${ARTURO_DEMO_READ_PAUSE:-0}"

names=(
  "1|blueprint-1-pipeline|Blueprint 1 — Pure Digital Pipeline"
  "2|blueprint-2-dispatcher|Blueprint 2 — The Dispatcher"
  "3|blueprint-3-sensor|Blueprint 3 — The Sensor"
  "4|blueprint-4-orchestrator|Blueprint 4 — The Orchestrator"
  "5|blueprint-5-prototyper|Blueprint 5 — The Prototyper"
  "6|blueprint-6-event-driven|Blueprint 6 — Event driven"
)

wanted=("$@")
selected() {
  [ "${#wanted[@]}" -eq 0 ] && return 0
  for n in "${wanted[@]}"; do [ "$n" = "$1" ] && return 0; done
  return 1
}

# A session is fit to film when it finished. A Task still Running, a detail view
# with no result, or a line Arturo did not recognise all mean the plan ran off
# the end of the work rather than through it.
check() {
  local out="$1"
  [ -s "$out" ] || { echo "empty"; return 1; }
  grep -q "arturo" "$out" || { echo "never started"; return 1; }
  local bad
  bad=$(grep -c "Status  *Running\|No output yet\|Not a command" "$out" 2>/dev/null || true)
  [ "${bad:-0}" -eq 0 ] || { echo "$bad unfinished or unrecognised line(s)"; return 1; }
  echo "$(wc -l < "$out" | tr -d ' ') lines"
  return 0
}

results=()
failed=0

for entry in "${names[@]}"; do
  IFS="|" read -r num plan title <<< "$entry"
  selected "$num" || continue

  out="$OUT_DIR/$title.txt"
  status=""

  for attempt in 1 2; do
    printf '\n=== Blueprint %s — attempt %s ===\n' "$num" "$attempt"
    rm -rf ".data/bp$num"
    rm -f "$out.raw" "$out.driver.log" "$out.driver.raw"

    bash scenario_harness/run_scenario_clean.sh \
      "scenario_harness/plans/$plan.plan" "bp$num" "$out" >/dev/null 2>&1

    if status=$(check "$out"); then
      results+=("  ok    Blueprint $num — $status")
      break
    fi
    if [ "$attempt" = 2 ]; then
      results+=("  FAIL  Blueprint $num — $status")
      failed=1
    fi
  done

  rm -rf ".data/bp$num"
done

printf '\n================================\n'
for line in "${results[@]}"; do echo "$line"; done
printf '================================\n'

if [ "$failed" = 1 ]; then
  echo "Some blueprints did not finish. Their .raw and .driver.log files were kept."
  exit 1
fi

echo "All selected blueprints finished. Film with run_scenario_clean.sh."
