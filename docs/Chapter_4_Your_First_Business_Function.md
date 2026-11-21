# Chapter 4 — Your first Business Function

## What you will learn

You will give Ethical Toys one lasting ability.

A **Business Function** is something the Enterprise needs to be able to do
over time. Think of it as like the departments in a business - Accounts, Customer Support, etc.

## Before you begin

Ethical Toys should already exist. If it does not, work through
[Chapter 3 — Your first Enterprise](./Chapter_3_Your_First_Enterprise.md)
first and come back.

## 1. Create Product Safety

Type the command on its own:

```text
/function
```

Arturo asks what you want to do:

```text
A Function is an ongoing responsibility your business needs handled.
What would you like to do?

  1. Add a new Function
  2. Start one running
  3. Look at a Function you've set up
  4. Change a Function's details
  5. See all your Functions

Reply with a number, or type cancel to stop.
```

Answer `1`. Arturo then asks three short questions:

| Arturo asks | You answer |
|---|---|
| Name (eg 'Accounts', 'Product marketing') | `Product Safety` |
| Objective | `Identify safety questions in supplied toy information and keep release decisions under Human control.` |
| Description | `Reviews supplied toy information, identifies missing safety evidence, and sends important release decisions to a Human.` |

The second answer is the **Objective**. The third is the **description**. You
can type `skip` for either, but both are worth answering, and the next section
explains why they are different.

Because Ethical Toys is your only business, Arturo does not ask which one this
Function belongs to. It would ask if you had more than one.

Arturo should create an ID such as:

```text
enterprise-1:function-1
```

The Function starts with status `declared`. 

## Objective and description

The **Objective** says what result the Function should pursue.

It should not name:

- one person;
- one AI model;
- one tool; or
- one temporary set of steps.

Those things can change. The company's need for Product Safety remains.

The Objective and description have different jobs:

- **Objective:** the result to pursue;
- **Description:** a clear explanation of the Function.

Both are context Arturo gives to Workers later, so plain and specific beats
polished.

## 2. Inspect the Function

```text
/function inspect "Product Safety"
```

Check:

- Enterprise is Ethical Toys;
- status is `declared`;
- Objective and description are clear.

## 3. List Functions

```text
/function list
```

You should see Product Safety. Running `/function` and answering `5` does the
same thing.

Leave it as it is for now. Chapter 5 starts it running.

## Good and bad names

Good Business Function names describe lasting abilities:

- Product Safety;
- Customer Support;
- Learning Design; and
- Supplier Management.

Weak names describe people, tools, or temporary work:

- Kevin;
- GPT Worker;
- Run Safety Prompt; and
- July Launch Project.

## Important limits

- A declared Function does not perform work.
- A Function is not a department or employee.
- Arturo has not verified that Product Safety meets any real safety standard.
- Use synthetic information in this lesson.

## Check your understanding

You are ready for Chapter 5 when:

- Product Safety appears in `/function list`;
- its status is `declared`; and
- you can explain the difference between the Enterprise and its Business
  Function.

Next: [Chapter 5 — Bringing a Business Function to life](./Chapter_5_Bringing_a_Business_Function_to_Life.md).
