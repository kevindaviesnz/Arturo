# Scenario 006 — Investment assessment

## Goal and boundary

Harbour Capital Partners wants to test a structured assessment of a hypothetical high-growth, unprofitable software company. No live accounts, market data, mandate documents, valuation inputs, portfolio exposures, or regulatory records are connected.

The output is not investment advice, a valuation, or authority to trade.

## Check model-cost controls

```text
/reset               → yes
/model-routing
```

`/model-routing` is read-only. Confirm that local-first routing is effective and that external escalation is disabled unless every required environment setting is present. "Configuration ready" does not assert live provider quota. The command never changes configuration or spends tokens.

## Set up and staff the Function

```text
/enterprise          → 1 · "Harbour Capital Partners"
                       · "Make evidence-based investment decisions within mandate and risk appetite."
                       · skip
/function            → 1 · "Investment Assessment"
                       · "Build bounded diligence frameworks for candidate investments and route them to committee approval."
                       · skip
/add-human-worker    → "Investment Committee Chair" · 1 (signs off sensitive work) · skip
/function start "Investment Assessment"
/staff               → yes to each Worker it proposes
```

Reply `yes` to each proposed Worker. `/staff` records that this Function's work
needs committee sign-off.

## Create, approve, and read the assessment

```text
/task                → 1 · "Using hypothetical inputs only, assess a software company described as fast-growing and currently unprofitable. Build a decision framework covering evidence needed, unit economics, cash runway, concentration, governance, downside cases, valuation uncertainty, mandate fit, and reasons not to invest. Do not recommend a trade." · 1 (nothing to work from)
/approval-status <task-id>
/approve <task-id>
/tasks
/task inspect <task-id>
/timeline
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


Approval requires a valid `APPROVAL_SIGNING_SECRET` or `APPROVAL_SIGNING_SECRET_FILE`. It authorises this bounded analysis; it does not approve an investment or verify the result.

## What to verify

- The Task is held for approval before model execution.
- The result labels missing evidence and uncertainty (`Unverified model synthesis`).
- The result does not claim current prices, financial statements, or mandate compliance.
- Session token usage and model routing remain visible in the terminal.

## Safe completion condition

The exercise yields a traceable diligence framework. An authorised investment committee using verified information and applicable legal controls remains responsible for every investment decision.
