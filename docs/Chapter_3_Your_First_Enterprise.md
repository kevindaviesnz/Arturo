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

Type the command on its own:

```text
/enterprise
```

Arturo asks what you want to do:

```text
What would you like to do?

  1. Set up a new business — a name, then one sentence
  2. Talk it through with Arturo first
  3. Look at a business you've set up
  4. Change a business's details
  5. See all your businesses

Reply with a number, or or ESC to go back.
```

Answer `1`. Arturo then asks three short questions. Answer each one and press
Return:

| Arturo asks | You answer |
|---|---|
| What is the business called? | `Ethical Toys` |
| Mission | `Help families choose safe and responsibly made toys.` |
| Description | `A teaching example that uses synthetic toy information only.` |

The third question is optional. Type `skip` to leave it blank. It is extra
background for people and for Workers, so it is worth answering.

Arturo should create an Enterprise with an ID such as `enterprise-1`. The exact
ID and time will be different on your computer.

You can type `cancel` at any question to stop. Nothing is created until you
have answered them all.

### If you are not sure what to say

Choose `2` instead of `1`. Arturo talks it through with you in plain language,
reacting to what you say rather than working through a fixed list. When it
understands the business, it creates the Enterprise with a mission drawn from
the conversation and goes on to recommend areas of work. If you have no name
yet, it will suggest one — you can accept it, decline to be asked again, or
type your own.

## 2. Inspect it

Run `/enterprise` again and answer `3`. With only one business set up, Arturo
shows it straight away.

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

Details are not locked in. Run `/enterprise`, answer `4`, and pick the detail
to change — the name, what the business does, or the extra background.

## 5. List Enterprises

Run `/enterprise` and answer `5`.

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

- `/enterprise` answered with `5` shows Ethical Toys;
- looking at Ethical Toys shows its mission; and
- you can explain that an Enterprise is the organisation, not a task or AI
  Worker.

Next: [Chapter 4 — Your first Business Function](./Chapter_4_Your_First_Business_Function.md).
