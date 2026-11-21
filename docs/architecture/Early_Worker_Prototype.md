# Early Worker prototype (historical)

> **Note:** This document describes an older experiment. It is
> kept to explain design history, not current Arturo behaviour.

> Historical design note: this page describes the earlier pure-worker prototype. Current AI and human workers are runtime resources and may invoke controlled capabilities through policy-governed adapters.

Workers form a network that defines how tasks flow.

## Example

start → classify → order_lookup → respond

## Rules

- Workers must be pure
- Routing must be explicit
- No hidden side effects

## Future

- Worker composition
- Conditional branching
- Parallel execution
