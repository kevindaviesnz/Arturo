# ANEA architecture guide

ANEA means **AI-Native Enterprise Architecture**.

This folder now contains the consolidated investor edition:

* [ANEA Investor Edition](./ANEA_Investor_Edition.md)

It replaces the older chapter and appendix files, which are backed up outside
this repository.

## What ANEA explains

ANEA is the architecture behind Arturo. It explains why Arturo models an
AI-native organisation as enduring capability rather than as disconnected
chats, prompts, agents, or workflows.

```text
Enterprise
  owns Functions
    own Definitions and Function operating states
      create and route Tasks
        assigned to Workers
      record Events
      update Memory
      report Health
      enforce Governance
```

Governance limits important work. Humans remain accountable for decisions that
need Human authority.

## Reading rule

The investor edition is architecture plus product positioning. It is not a
claim that every target capability is implemented today.

For current executable behavior, verify Arturo's primary `/help`, current
tests, [the documentation guide](../README.md), [the threat model](../../THREAT_MODEL.md),
and [the roadmap](../../ROADMAP.md).
