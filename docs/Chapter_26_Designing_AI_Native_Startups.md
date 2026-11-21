# Chapter 26 — Designing an AI-Native Startup

## What you will learn

A startup should begin with a small set of real abilities. It should not create
dozens of Workers and Functions before it understands the problem.

## 1. Create the Enterprise

```text
/enterprise create "BrightPath" --mission "Help small service businesses explain and improve their customer setup."
```

## 2. Create three focused Functions

```text
/function create "Product Strategy" --enterprise "BrightPath" --objective "Turn supplied customer problems into small product priorities."
/function create "Service Design" --enterprise "BrightPath" --objective "Design clear and testable service information."
/function create "Quality Review" --enterprise "BrightPath" --objective "Check claims, assumptions, and completion evidence."
```

## 3. Add the smallest useful team

```text
/add-ai-worker "Product Analyst" --archetype analyst
/add-ai-worker "Service Writer" --archetype creator
/add-ai-worker "Quality Reviewer" --archetype reviewer
/add-human-worker "Founder" --archetype guardian --availability available
```

## 4. Inspect before starting

```text
/enterprise inspect "BrightPath"
/function list --enterprise "BrightPath"
/workers
```

Start only the Functions needed for the first demonstration:

```text
/function start "Product Strategy"
/function start "Quality Review"
```

## Keep the first task small

```text
/task-cap --capability analysis --bounded-task "Using only the supplied note that some customers ask whether setup is included, list three questions BrightPath should answer before writing its service page. Mark assumptions. Do not claim customer research."
```

This task is clear because it states:

- the one supplied fact;
- the requested output;
- the evidence limit; and
- what the Worker must not claim.

## Common mistakes

- Too many Functions make the startup hard to understand.
- A Worker name should describe a role, not a model brand.
- Model output is not customer research.
- A completed Task is not market validation.
- Do not start paid models without a cost limit.

## Completion check

You have finished when the Enterprise has a clear mission, three focused
Functions, a small Worker pool, and one inspectable Task.
