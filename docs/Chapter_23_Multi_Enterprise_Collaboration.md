# Chapter 23 — Multi-Enterprise Collaboration

## What you will learn

An Enterprise boundary separates ownership, policy, Workers, and records.

The current CLI can hold more than one Enterprise. It does not yet support
cross-Enterprise Delegation.

## Create a second Enterprise

```text
/enterprise create "Independent Review Lab" --mission "Provide independent product evidence reviews."
```

Add one Business Function:

```text
/function create "Evidence Testing" --enterprise "Independent Review Lab" --objective "Test supplied product evidence and return bounded reports."
```

Inspect the new boundary:

```text
/enterprise list
/enterprise inspect "Independent Review Lab"
/function list --enterprise "Independent Review Lab"
```

## Try the current boundary

This command is expected to be rejected if the sending and receiving Functions
belong to different Enterprises:

```text
/delegation request "Independently review the supplied evidence" --from "Product Safety" --to "Evidence Testing"
```

The rejection is useful. Arturo should not pretend that a cross-company trust
agreement exists.

## Why the boundary matters

Two Enterprises may have different:

- owners;
- policies;
- evidence rules;
- privacy promises;
- legal duties; and
- cost limits.

A request from one Enterprise should not become a command inside another.

## Future needs

Safe cross-Enterprise work would need more than a new command. It may need:

- verified identities;
- agreed contracts;
- allowed data fields;
- signed requests and results;
- payment rules;
- failure handling; and
- separate audit records.

These are design goals, not current product claims.

## Completion check

You have finished when you can show:

1. two separate Enterprises;
2. their separate Functions; and
3. Arturo's honest rejection of cross-Enterprise Delegation.
