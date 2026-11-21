# Chapter 16 — Business Function Collaboration

## What you will learn

One part of a company can help another part. It does not take over the other
part's responsibility.

This chapter explains the design idea. Chapters 17 and 18 give you commands.
Arturo does not have a general `/collaborate` command.

## Keep each Function focused

Imagine an online shop. It may need these Business Functions:

- Order Processing accepts valid orders.
- Inventory keeps an accurate stock count.
- Shipping delivers accepted orders.
- Customer Support helps customers.

One giant Function could try to do all four jobs. That would be hard to
understand and change.

A better design gives each Function:

- one clear purpose;
- its own Runtime;
- its own Tasks;
- its own Health; and
- clear boundaries.

## Work as peers

One Function should not secretly change another Function's data or rules.

For example, Order Processing should not edit Inventory's stock count. It can
publish an Event saying that an order was accepted. Inventory can then decide
how to respond.

This is peer-to-peer work. It is not an org chart:

```text
Order Processing ── publishes a fact ──> Inventory
Inventory        ── publishes a fact ──> Shipping
```

Each Function still owns its own result.

## Three rules

1. **Keep ownership clear.** A Function keeps responsibility for its own
   objective.
2. **Share facts, not hidden details.** Other Functions should not need to know
   how a result was produced.
3. **Use bounded requests.** If one Function asks another for work, the request
   should have a clear end.

## Common mistakes

- Do not join several different abilities into one huge Function.
- Do not create a new Function for every tiny task.
- Do not let one Function reach into another Runtime.
- Do not assume that collaboration removes accountability.

## Design exercise

Draw a simple online shop with four to six Business Functions.

For each Function, write:

- its name;
- its objective;
- one fact it may publish; and
- one fact it may need from another Function.

If a Function needs another Function's private details, improve the boundary.
It should depend on a clear result instead.

## Completion check

You are ready for Chapter 17 when you can explain:

- why the Functions stay separate;
- what each Function owns; and
- what facts pass between them.
