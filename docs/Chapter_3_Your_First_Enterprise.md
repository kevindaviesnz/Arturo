# Chapter 3 — Your first Enterprise

## What you will learn

You will create a company in Arturo and inspect it.

In Arturo, an **Enterprise** is a company or organisation. It has a name and a
mission.

## Before you begin

Install Arturo first — see
[Getting started](../cli/docs/getting_started.md) — then start it from the
`cli` folder:

```bash
npm run ui
```

Commands in this book do not include the `arturo ›` prompt. Type only the
command.

## 1. Create Ethical Toys

Type `/setup`. `/enterprise` on its own is the same command.

```text
/setup
```

Arturo starts a four-step route. The first screen is labelled **Step 1 of 4**
and asks one question at a time. Answer each one and press Return:

| Arturo asks | You answer |
|---|---|
| What is the business called? | `Ethical Toys` |
| In one sentence, what does Ethical Toys exist to do? | `Help families choose safe and responsibly made toys.` |
| What should Arturo call you? | Type `q` for this lesson |

The name and mission are saved once you have answered both. Arturo then asks
what to call you, which is used later when you mark work. For this chapter,
type `q` to pause. You can type `/setup` later to continue from where you left
off (next is Step 2 of 4, Functions). Chapter 4 creates a Function by hand
instead.

Arturo should create an Enterprise with an ID such as `enterprise-1`. The exact
ID and time will be different on your computer.

You can type `q` or `cancel` at any question to pause. Nothing is created until
you have answered the name and the mission. Each screen also offers `b` to go
back.

If you are not sure what the mission should say, write one short sentence in
your own words. You can change it later.

## 2. Inspect it

Run `/enterprise inspect`. With only one business set up, Arturo shows it
straight away.

You should see:

- the name;
- the ID;
- status `active`;
- Mission;
- Description;
- no Business Functions yet;
- no Workers yet; and
- no policies yet.

This empty state is correct. The company exists, but you have not given it any
abilities or Workers.

## 3. Ask Arturo for ideas

```text
/next "Ethical Toys"
```

Arturo uses the configured AI model to suggest ongoing areas of work, which it
calls Functions. It shows them one at a time:

```text
I'll show them one at a time — say yes to add each, or skip.
Nothing is created until you answer.
```

The suggestions are advice. Arturo shows what it would create and asks for
confirmation. It does not create anything until you answer `yes` to each
suggestion.

For this lesson, answer `skip` to every one. Chapter 4 creates a Function by
hand instead.

When you skip them all, Arturo asks what was wrong with them, so it can do
better next time. Type `no` to leave it.

## 4. Change something later

Details are not locked in. Run `/enterprise update "Ethical Toys"` and pick the
detail to change — the name, what the business does, or the extra background.

## 5. List Enterprises

Run `/enterprise list`.

You should see Ethical Toys in the list.

## Enterprise or Business Function?

Create a new Enterprise only for a separate organisation with its own mission
and Governance.

Do not create a new Enterprise for every team, product, or task. Those may be
Business Functions, projects, or Tasks inside the same Enterprise.

## Important limits

- An Enterprise is a record in Arturo. It is not a legally registered company.
- Creating one does not start any AI work.
- You can set up several businesses in one copy of Arturo, and it will keep
  their records apart. It does not keep them *secret* from each other: anyone
  using this copy can see all of them, so do not treat it as a way to hold two
  clients' confidential data on one machine.

## Check your understanding

You are ready for Chapter 4 when:

- `/enterprise list` shows Ethical Toys;
- `/enterprise inspect` shows its mission; and
- you can explain that an Enterprise is the organisation, not a task or AI
  Worker.

Next: [Chapter 4 — Your first Business Function](./Chapter_4_Your_First_Business_Function.md).
