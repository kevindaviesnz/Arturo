# Scenario 021 — Energy grid operations

## Goal and boundary

Southern Grid Co runs three collaborating Functions and keeps every switching decision under human control. Synthetic scenarios only — no SCADA, telemetry, or control connector is present. Arturo issues no switching instruction; a deny policy stands against any work that declares the `execution` capability.

## Create, staff, and start three Functions

```text
/reset               → yes
/enterprise          → 1 · "Southern Grid Co"
                       · "Keep the network stable with evidence-led analysis and accountable human control of every switching decision."
                       · skip
/function            → 1 · "Grid Monitoring"
                       · "Frame monitoring signals and evidence gaps for network events."
                       · skip
/function            → 1 · "Load Analysis"
                       · "Analyse synthetic load and constraint scenarios for accountable review."
                       · skip
/function            → 1 · "Response Planning"
                       · "Prepare bounded response options and route switching decisions to a person."
                       · skip
/add-human-worker    → "Control Engineer" · 1 (signs off sensitive work) · skip
/function start "Grid Monitoring"
/function start "Load Analysis"
/function start "Response Planning"
/staff               → yes to each Worker it proposes
```

Reply `yes` to each proposed Worker across all three Functions.

## Add governance and a daily monitoring review

```text
/governance policy add "Response analysis requires engineer sign-off" --effect require-approval --capability "analysis"
/governance policy add "Automated switching is denied" --effect deny --capability "execution"
/schedule add "Summarise overnight constraint breaches and list those needing engineer review, labelling assumptions." --every daily --at "06:00" --timezone "Pacific/Auckland" --function "Grid Monitoring"
```

Those two rules differ in reach, and the difference is the point. `analysis` is a
capability Arturo infers from what you type, so the require-approval rule acts on
the Tasks below. `execution` is not, and deliberately so: inferring a
consequential capability from a turn of phrase would make a Task demand something
nobody staffed and fail closed over a word it happened to contain. So the deny
rule cannot be triggered by anything typed here. It stands against work that
declares `execution` outright — a Procedure, a Workflow's operator step, an
Event-driven follow-up, or a Worker that holds it. Expect no refusal in this run:
the rule is a standing boundary, not something the transcript demonstrates.

## Delegate the constraint analysis

```text
/delegation request "Analyse a synthetic scenario where a feeder approaches its thermal limit during evening peak: evidence needed, load-transfer options at a high level, risks, and the switching decisions a human must make. Do not issue switching instructions." --from "Response Planning" --to "Load Analysis"
/delegation list
/delegation inspect <delegation-id>
/approve <task-id>
/task inspect <task-id>
/functions
/timeline
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


The delegated analysis is consequential, so it is held for sign-off — approve it to run.

## Safe completion condition

Three Functions collaborate, the deny rule stands recorded against `execution`, monitoring runs on a clock, and the constraint analysis is delegated with accountability retained. A qualified control engineer using real telemetry remains responsible for every switching action.
