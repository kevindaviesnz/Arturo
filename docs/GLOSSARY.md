# Arturo glossary

This page explains Arturo's main words in plain English.

| Word | Plain meaning |
|---|---|
| AI model | Software that produces an answer from a prompt. A model can be useful and still be wrong. |
| AI Worker | A registered Worker that uses an AI model to perform Tasks. |
| Approval | A Human decision that allows or rejects a governed Task. Approval to run is not approval of the answer produced later. |
| Archetype | A broad work category, such as `analyst`, `creator`, or `guardian`. Arturo uses it to help match Tasks to Workers. |
| Artefact | Arturo's versioned record of a file or HTTPS file reference, including its creator, source work, hash, and exact Human review state. Arturo records metadata; it does not copy or upload the file. |
| Audit trail | Records that help show what happened and when. Arturo's records help investigation, but do not automatically meet every legal audit rule. |
| Bounded | Kept within clear limits. A bounded Task says what to do, what result to produce, and where to stop. |
| Business Function | See **Function**. An ongoing responsibility the Enterprise needs over time, such as Product Safety, Customer Support, or Science Discovery. |
| Capability | An ability to do a kind of work. |
| Delegation | One ongoing Function asks another Function in the same Enterprise to do a limited Task. The first Function keeps responsibility. |
| Deterministic | Decided by fixed application rules, so the same input follows the same rule. It does not ask an AI model to make the rule decision. |
| Enterprise | The company or organisation represented in Arturo. |
| Event | A saved record that something happened. Running Functions may examine it. |
| Evidence | Information used to support a claim. AI-generated text is not automatically evidence that the claim is true. |
| External model | An AI model reached through another provider's service. Using one may send data outside the local computer and may cost money. |
| Function | An ongoing responsibility the Enterprise needs over time (short for **Business Function**), such as Product Safety, Customer Support, or Science Discovery. Older docs called this a **Job**. |
| Go-ahead | A Human approval given before consequential work starts. It authorises execution; it does not accept what the AI will later produce. |
| Governance | Fixed rules that allow, block, or require approval for work. |
| Health | Arturo's operational summary for an ongoing Function. It describes recorded activity, not the overall success or safety of the real company. |
| Human Task | A decision or action assigned to a person and recorded by Arturo. |
| Human Worker | A person registered as a participant. Registration does not prove identity, employment, qualifications, or authority. |
| Job | Older compatibility word for an ongoing **Function** (and in low-level code, a queued **Task**). New documentation and commands use `/function` and `/task`. |
| Local model | An AI model running on the user's own computer, such as a model served by Ollama. |
| Memory | See Operational Memory. |
| Model routing | Choosing which approved AI model may handle a request. |
| Objective | The repeated result an ongoing Function is meant to pursue. |
| Operational Memory | Selected, labelled information that may help future work. |
| Policy | A Governance rule. |
| Provenance | Where information came from. Arturo often calls this its evidence source or evidence status. |
| Runtime | Arturo's older internal name for the operating process behind a running Function. Most users can use `/function start` and do not need this term. |
| Scope | The part of Arturo where a rule or Memory entry applies. |
| Sign-off | A signed Human decision recording that a named person read a finished AI result and accepts it. Sign-off records acceptance; it does not prove the result is correct. |
| Signal | Information that a running Function can examine, often carried by an Event. |
| Synthetic data | Made-up information used for safe testing or demonstration. It must not contain real private records. |
| Teaching exercise | A chapter's worked example, built from Synthetic data and a made-up Enterprise such as Ethical Toys. It shows how Arturo's commands behave, not a real safety, legal, or business judgement — never substitute it for one. |
| Timeline | Arturo records shown in time order. |
| Task | One bounded piece of work with an instruction, status, required capability, routing record, and possible result. |
| Unverified model synthesis | Text produced by an AI model without enough outside evidence to treat it as confirmed fact. |
| Worker | An AI or Human participant that can perform a Task for a Function. |
| Worker Chat | A read-only conversation with an AI Worker (except staffed Arturo Office Workers, which create governed draft Tasks). |
| Workflow | A temporary set of ordered Tasks for one objective. An ongoing Function is longer-lived. |

## Three words that are easy to confuse

### Function, Task, and Worker

- The **Function** owns an ongoing responsibility.
- The **Task** describes one bounded piece of work.
- The **Worker** performs that Task.

Example:

```text
Function: Customer Insight
Task: List three unclear parts of the service offer
Worker: Customer Insight Analyst
```

### Approval and verification

An approval can allow a Task to run. It does not prove that the later result is
correct.

Verification means checking a claim against suitable evidence.

### Event and command

An Event says that something happened.

A command asks Arturo to do something.

For example:

```text
/event publish "New product idea submitted" ...
```

The command publishes an Event. The Event itself is the saved fact:

> New product idea submitted.
