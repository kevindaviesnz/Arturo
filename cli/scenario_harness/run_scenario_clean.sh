#!/usr/bin/env bash
# run_scenario_clean.sh <plan-file> <data-subdir> <transcript-out>
#
# Like run_scenario.sh, but the transcript reads as one person's session:
# nothing about a bot, a driver, or a plan.
#
# Use this for anything an outsider will see — a recording, a demonstration,
# a screenshot. Use run_scenario.sh for the internal scenario transcripts,
# where the driver's own markers are worth keeping for diagnosis.
#
# Two things make the difference, and only one is filtering:
#
#   1. It drives the interface through expect, as a person types, rather than
#      through bot mode. Bot mode deliberately announces itself — it opens with
#      "Bot mode — scripted", warns that a script may sign work off, and stamps
#      every approval with "Arturo Bot (automated, not a person)". That
#      attribution is load-bearing and must never be filtered away: an approval
#      made by a script has to say so. Here there is no script signing anything.
#      The plan's bare /approve resolves to the scenario's own named approver,
#      which is what a real operator's session records.
#
#   2. It removes the driver's echo lines (===>), its notes (===NOTE:) and its
#      warnings ([driver]). Those are the harness talking to us, not Arturo
#      talking to an operator. The typed command still appears on the line
#      after each echo, so nothing about the session is lost.
set -uo pipefail

# Say what is missing. Under `set -u` a forgotten argument surfaces as
# "line 30: $3: unbound variable", which names neither the script's arguments
# nor the one left out.
if [ "$#" -lt 3 ]; then
  cat >&2 <<USAGE
usage: run_scenario_clean.sh <plan-file> <data-subdir> <transcript-out>

  plan-file        e.g. scenario_harness/plans/016.plan
  data-subdir      a throwaway name; becomes .data/<name>, wiped each run
  transcript-out   where to write the transcript, quoted if it has spaces

example:
  bash scenario_harness/run_scenario_clean.sh \\
    scenario_harness/plans/016.plan governance016 \\
    "docs/investor-scenarios/transcript governance"
USAGE
  exit 2
fi

PLAN="$1"
DATADIR=".data/$2"
OUT="$3"

export APPROVAL_SIGNING_SECRET=test-approval-secret-000000000000
export HUMAN_TASK_TOKEN_SECRET=test-human-task-secret-000000000000
export RUNTIME_REPLAY_ATTESTATION_SECRET=test-replay-secret-000000000000000
export API_SECRET_ENCRYPTION_KEY=test-api-secret-encryption-key-00000000
export ARTURO_HTTP_ALLOWED_HOSTS=example.com

# A recording must not depend on an external service. /staff escalated to
# gemini-2.5-flash mid-run, got HTTP 401, and produced a demo with no team in
# it — and the failure would have been just as visible in front of an audience.
# Local-only makes the run reproducible and keeps it off anyone's bill.
export ARTURO_PAID_ESCALATION_ENABLED=false

# Typed at about 100 words a minute, with a beat to read each result. This is
# what makes a recording look like a person working rather than a script
# replaying. Override either to taste; set both to 0 for a fast run.
#
# 0.12s a keystroke is bot mode's figure, arrived at there by watching runs
# rather than by arithmetic, so it is the one to match. It replaces 0.045,
# which the comment here called 90 words a minute and which was nearer 265 —
# faster than anyone types and too fast to follow on a recording.
export ARTURO_DEMO_TYPE_DELAY="${ARTURO_DEMO_TYPE_DELAY:-0.12}"
export ARTURO_DEMO_READ_PAUSE="${ARTURO_DEMO_READ_PAUSE:-1.5}"

rm -rf "$DATADIR"
mkdir -p "$DATADIR"

# The readable capture is kept, then filtered — rather than filtered on the way
# through. Writing straight to $OUT threw the driver's own diagnostics away with
# everything else, so a run whose staffing timed out produced a transcript that
# looked perfect: the failure was in a "[driver] TIMEOUT" line the filter had
# already deleted. A recording must not show those lines; verifying the run
# needs them. Keep both.
RAW="$OUT.raw"
LOG="$OUT.driver.log"
LOG_RAW="$OUT.driver.raw"

# Show the session while it runs.
#
# The driver sets log_user 0 and prints each result itself, and everything it
# prints goes down the pipe into the transcript. That is right for generating
# transcripts and useless for filming one: the operator sees a blank terminal
# for several minutes and reasonably concludes it has hung. Teeing to the
# terminal makes the run watchable — which is the whole point of this script —
# while the file is still written. What is shown is the filtered view, not the
# raw one: the driver's own echoes would otherwise be on camera. Falls back to /dev/null where there is no
# terminal, so a batch run or CI is unaffected.

# One unbuffered pass, not seven buffered ones.
#
# Every stage here block-buffers when its output is a pipe — tr, sed, perl and
# grep alike — so the old chain held several kilobytes before anything emerged.
# For a file that is invisible; for a session being watched it looks exactly
# like a hung process, because minutes pass with an empty screen. The regexes
# are collapsed into a single perl with $| set, and both greps line-buffer.
export ARTURO_DEMO_LIVE=1
export ARTURO_DEMO_LOG="$RAW"

# No pipe. expect writes the session straight to this terminal and records it
# to $RAW itself. Piping is what made stdout a non-terminal and buffered the
# typing out of existence; there is nothing left to buffer it.
expect scenario_harness/scenario_driver.exp "$PLAN" "$DATADIR" 2>"$LOG_RAW"

grep -E '^\[driver\] *(WARN|TIMEOUT|ERROR)' "$LOG_RAW" > "$LOG" 2>/dev/null || true

perl -CSD -pe '
    s/\r//g;
    s/\x1b\[[0-9;]*[a-zA-Z]//g;
    s/.*Ctrl\+C to interrupt//;
    s/[\x{2800}-\x{28FF}]\s*(Running|Thinking|Working)[^\n]*?…\s*\d+s\s*//g;
    s/\e\][0-9]*;[^\a]*\a//g;
    s/[\001\002]//g;' "$RAW" \
  | grep -vE '^[[:space:]]*[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏].*(…|\.\.\.)' \
  | grep -vE '^> worker-cli@|^> ts-node ' \
  | cat -s \
  > "$OUT"

# Begin the transcript where the screen was last cleared.
#
# /clear wipes the operator's screen and reprints the banner, so on a recording
# everything before it is gone. In a captured file it is not: the text is still
# there, and the transcript would open on the reset warning the viewer never
# saw. Trimming to the last banner makes the file agree with the screen.
#
# A plan with no /clear has exactly one banner, so this does nothing to it.
BANNER_AT=$(grep -n 'A  R  T  U  R  O' "$OUT" | tail -1 | cut -d: -f1)
if [ -n "$BANNER_AT" ] && [ "$BANNER_AT" -gt 1 ]; then
  tail -n +"$BANNER_AT" "$OUT" > "$OUT.trimmed" && mv "$OUT.trimmed" "$OUT"
fi

# Say so rather than leaving it to be discovered in the edit suite.
if grep -qiE '\bbot\b|\[driver\]|^===>' "$OUT"; then
  echo "WARNING: $OUT still mentions a bot or the driver — check before recording:"
  grep -inE '\bbot\b|\[driver\]|^===>' "$OUT" | head -5
fi

# A run can fail without the transcript showing anything wrong: a timed-out
# staffing review just leaves the Workers uncreated and the demo carries on
# looking tidy. These are the checks that would have caught that.
FAILED=0
if [ -s "$LOG" ]; then
  echo "WARNING: the driver reported problems during this run:"
  sed 's/^/  /' "$LOG" | head -8
  FAILED=1
fi
if [ ! -s "$OUT" ]; then
  echo "WARNING: $OUT is empty — the run produced nothing."
  FAILED=1
fi
if ! grep -q "arturo" "$OUT"; then
  echo "WARNING: $OUT has no prompt in it — the interface may never have started."
  FAILED=1
fi
if [ "$FAILED" = "0" ]; then
  rm -f "$RAW" "$LOG" "$LOG_RAW"
else
  echo "  kept $RAW, $LOG and $LOG_RAW for diagnosis"
fi

echo "wrote $OUT ($(wc -l < "$OUT") lines)"
