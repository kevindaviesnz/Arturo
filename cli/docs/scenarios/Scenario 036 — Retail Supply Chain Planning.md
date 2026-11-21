# Scenario 036 — Retail supply chain planning

## Goal and boundary

Kea Retail Supply wants demand and supplier analysis routed to a planner who decides every order. Synthetic scenarios only — no ERP, inventory, or supplier connector. Arturo places no order.

## Create, staff, and start two Functions

```text
/reset               → yes
/enterprise          → 1 · "Kea Retail Supply"
                       · "Keep shelves stocked with evidence-led planning and accountable human decisions on every order."
                       · skip
/function            → 1 · "Demand Planning"
                       · "Frame demand-planning questions and route ordering decisions to an accountable planner."
                       · skip
/function            → 1 · "Supplier Analysis"
                       · "Analyse synthetic supplier and lead-time scenarios for accountable review."
                       · skip
/add-human-worker    → "Supply Planner" · 1 (signs off sensitive work) · skip
/function start "Demand Planning"
/function start "Supplier Analysis"
/staff               → yes to each Worker it proposes
```

## Schedule a review and delegate the supplier analysis

```text
/schedule add "List SKUs at risk of stockout this week and the ordering decisions awaiting a planner, labelling assumptions." --every weekly --at "08:00" --timezone "Pacific/Auckland" --function "Demand Planning"
/delegation request "Analyse a synthetic scenario where a key supplier's lead time doubles before a seasonal peak: evidence needed, alternative-sourcing options at a high level, cost and service trade-offs, and the ordering decisions a planner must make. Do not place an order." --from "Demand Planning" --to "Supplier Analysis"
/delegation list
/delegation inspect <delegation-id>
/approve <task-id>
/task inspect <task-id>
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## Record the ordering decision

```text
/create-human-task "Ordering decision" "Decide the sourcing and ordering response and what must be confirmed before any purchase order. Do not place an order."
/complete-human-task <human-task-id> "Hold a bridging order pending a second supplier quote; confirm cash and storage limits before committing. No order placed." --as "Supply Planner"
/human-task <human-task-id>
/timeline
```

## Safe completion condition

Supplier analysis is delegated and gated, and a planner records the ordering decision. No order is placed; a qualified planner using real inventory and supplier data remains responsible.
