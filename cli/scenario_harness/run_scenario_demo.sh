#!/usr/bin/env bash
# Like run_scenario.sh but seeds the demo Enterprise first (npm run demo),
# then drives the week plan against that seeded state.
set -uo pipefail
PLAN="$1"; DATADIR=".data/$2"; OUT="$3"
export APPROVAL_SIGNING_SECRET=test-approval-secret-000000000000
export HUMAN_TASK_TOKEN_SECRET=test-human-task-secret-000000000000
export RUNTIME_REPLAY_ATTESTATION_SECRET=test-replay-secret-000000000000000
export API_SECRET_ENCRYPTION_KEY=test-api-secret-encryption-key-00000000
export ARTURO_HTTP_ALLOWED_HOSTS=example.com
rm -rf "$DATADIR"; mkdir -p "$DATADIR"
ARTURO_DATA_DIRECTORY="$DATADIR" ARTURO_RUNTIME_DATABASE_PATH="$DATADIR/runtime.db" npx tsx src/demo/seedDemo.ts > "$DATADIR/seed.log" 2>&1
expect scenario_harness/scenario_driver.exp "$PLAN" "$DATADIR" 2>&1 \
  | tr -d '\r' | sed -E 's/\x1b\[[0-9;]*[a-zA-Z]//g' \
  | perl -CSD -pe 's/.*Ctrl\+C to interrupt//;' \
  | perl -CSD -pe 's/[\x{2800}-\x{28FF}]\s*(Running|Thinking|Working)[^\n]*?…\s*\d+s\s*//g;' \
  | grep -vE '^[[:space:]]*[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏].*(…|\.\.\.)' | grep -vE '^\[[0-9]+m' > "$OUT"
echo "wrote $OUT ($(wc -l < "$OUT") lines)"
