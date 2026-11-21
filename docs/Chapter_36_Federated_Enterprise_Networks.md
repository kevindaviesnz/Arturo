# Chapter 36 — Federated Enterprise Networks

> **Summary:** Separate Enterprises need identity, trust,
> contracts, and delivery rules before they can safely work together. Arturo
> does not yet provide that federation system.

*Federation coordinates independent organizations through explicit agreements; it does not turn several Enterprise records into a trusted network.*

## Current versus target architecture

Arturo can persist more than one Enterprise record. The current implementation does not provide:

- a Federation, Membership, Standard, Agreement, Ratification, Message, Credential, or Settlement entity;
- Enterprise-isolated tenancy;
- authenticated organization identity;
- cross-Enterprise delegation;
- cross-Enterprise Event delivery;
- shared contract schemas;
- multi-party approval;
- network discovery; or
- federated governance.

The `/delegation request` command explicitly rejects Functions belonging to different Enterprises.

This chapter demonstrates the boundary using fictional Enterprises and an external ratification ledger. It does not create a functioning federation.

## Starting state

`Harbour Studio Sandbox` needs independent accessibility advice but should not grant an external organization control over its internal Runtimes, Workers, or release decisions.

The proposed network has two fictional participants:

```text
Harbour Studio Sandbox
  owns: resource design, internal review, release decisions

Harbour Accessibility Partner Sandbox
  owns: independent accessibility-advice process

Shared candidate standard
  defines: a synthetic advisory request and response
  does not transfer: release authority or internal governance
```

Use no personal, customer, confidential, regulated, or partner data.

## Federation versus centralization

A federation preserves independent authority:

- each participant chooses whether to join;
- each authenticates and authorizes its own people and systems;
- shared obligations are bounded and explicit;
- private internal state remains private;
- standards change through agreed procedures;
- participants can suspend or leave under defined conditions; and
- disputes have a resolution process.

A central platform may still technically transport messages, but it must not silently acquire authority over every participant's internal decisions.

Federation is not “no governance.” It requires internal governance plus network governance plus enforceable agreements.

## 1. Create a second fictional participant

```text
/enterprise create "Harbour Accessibility Partner Sandbox" --mission "Explore independent accessibility-advice workflows using synthetic materials only."

/function create "External Accessibility Advisory Function" --enterprise "Harbour Accessibility Partner Sandbox" --objective "Review supplied synthetic resource descriptions and return bounded accessibility questions without making release decisions."

/enterprise list
/enterprise inspect "Harbour Studio Sandbox"
/enterprise inspect "Harbour Accessibility Partner Sandbox"
/function list
```

These are records in the same Arturo installation. They are not isolated tenants, authenticated legal entities, or separate databases. Global commands can display information across them.

## 2. Register participants honestly

```text
/add-human-worker "Studio Federation Reviewer" --archetype guardian --availability available
/add-human-worker "Partner Federation Reviewer" --archetype guardian --availability available
/add-ai-worker "Federation Standards Analyst" --archetype analyst
/workers
```

Worker records are global and are not owned by either Enterprise. Their names and capabilities do not verify identity, employment, authority, independence, conflicts, organizational mandate, or signing power.

That means these records can support a tabletop exercise but cannot establish multi-party ratification.

## 3. Define the candidate shared contract externally

Use a typed design artifact outside Arturo.

### v1 request

```json
{
  "schema": "accessibility-advice-request",
  "version": 1,
  "request_id": "synthetic-request-001",
  "artifact_id": "synthetic-guide-001",
  "artifact_version": "1.0",
  "evidence_status": "synthetic-unverified",
  "question": "Identify accessibility questions for human review."
}
```

### v1 response

```json
{
  "schema": "accessibility-advice-response",
  "version": 1,
  "request_id": "synthetic-request-001",
  "response_id": "synthetic-response-001",
  "evidence_status": "unverified-advisory",
  "questions": [],
  "limitations": [],
  "decision_authority": "none"
}
```

The design should also define:

- field types and allowed values;
- required and optional fields;
- semantic meaning;
- timestamps and time zones;
- organization and message identity;
- correlation and idempotency;
- error and retry behavior;
- authentication and signatures;
- confidentiality and data classification;
- retention, correction, and deletion;
- version compatibility; and
- dispute and incident handling.

Arturo does not validate or transmit these JSON documents.

## 4. Record authorization for standards analysis

```text
/create-human-task "Authorize synthetic federation standards analysis" "Review the fictional v1 request and response contract. Authorize advisory compatibility analysis only. Do not authorize data sharing, cross-Enterprise execution, external communication, or ratification."
/complete-human-task <standards-authorization-task-id> "Authorized for synthetic analysis only. Each participant must review independently, and no Arturo record constitutes legal agreement." --as "Studio Federation Reviewer"
/human-task <standards-authorization-task-id>
```

Create the task first and substitute the returned ID.

## 5. Run bounded compatibility analysis

Do not attach an organization-scoped Governance policy to this direct `/task-cap` example. With multiple active Enterprises, a direct capability Task may not have an unambiguous Enterprise context; organization-scoped policy evaluation can therefore deny ambiguous work rather than prove federation-aware Governance.

Run an advisory Task using the unique global capability:

```text
/task-cap --capability analysis --bounded-task "Analyze this fictional federation contract: request fields schema, version, request_id, artifact_id, artifact_version, evidence_status, question; response fields schema, version, request_id, response_id, evidence_status, questions, limitations, decision_authority=none. Identify ambiguous semantics, compatibility risks, identity and authorization gaps, privacy risks, failure handling, versioning needs, ratification questions, and evidence required from each participant. Do not claim agreement, transmit data, or invent legal requirements."
/task inspect <standards-analysis-task-id>
```

The result is unverified model synthesis. It is not legal advice, a security review, a validated schema, or acceptance by either participant.

## 6. Test the current hard boundary

The following command is expected to fail because the Functions belong to different Enterprises:

```text
/delegation request "Review a synthetic guide under the candidate advisory standard" --from "Quality Review Function" --to "External Accessibility Advisory Function"
```

Expected result:

```text
Cross-Enterprise delegation is not supported by the current CLI
```

Verify that no new delegation was created. Existing same-Enterprise delegations may still appear:

```text
/delegation list
```

This rejection is safer than pretending a local Task is a trusted inter-organizational exchange.

## 7. Understand why Events are not federation messages

`/event publish` targets running Runtimes in the named Enterprise. It does not deliver an authenticated Event to another Enterprise.

Do not simulate federation by publishing sensitive data into one Enterprise and assuming another received it. Arturo's Event record lacks the full set of cross-organization transport, receipt, authorization, schema, and disclosure guarantees.

For this chapter, keep the conceptual request and response in the external design packet rather than publishing them as live Events.

## 8. Record independent participant reviews

Create one Human Task for each fictional participant:

```text
/create-human-task "Studio review of candidate federation standard" "From Harbour Studio's perspective, review purpose, minimum data, release-authority boundaries, evidence status, security, versioning, cost, exit, and incident obligations. Record approve-for-revision, ratify, or reject."
/complete-human-task <studio-review-task-id> "Approve for revision only. Require authenticated organization identity, signed receipts, data minimization, explicit decision-authority limits, and version migration rules." --as "Studio Federation Reviewer"
/human-task <studio-review-task-id>
```

```text
/create-human-task "Partner review of candidate federation standard" "From the Accessibility Partner's perspective, review scope, workload, evidence limitations, confidentiality, liability boundaries, response timing, payment assumptions, versioning, exit, and incident obligations. Record approve-for-revision, ratify, or reject."
/complete-human-task <partner-review-task-id> "Approve for revision only. Clarify service scope, workload limits, evidence sources, response expectations, liability, payment, and suspension rights." --as "Partner Federation Reviewer"
/human-task <partner-review-task-id>
```

These Tasks remain in one global Arturo store and are not cryptographic organizational signatures. They demonstrate two recorded human perspectives, not multi-party ratification.

## 9. Maintain an external ratification ledger

```text
Standard: accessibility-advice v1
Draft hash: <content hash from external artifact system>

Participant                         Reviewer                    Status
Harbour Studio Sandbox              verified externally         revision required
Harbour Accessibility Partner       verified externally         revision required

Unresolved:
- organization identity
- signing and non-repudiation
- minimum data and purpose
- service and workload limits
- evidence provenance
- liability and payment
- incident handling
- version migration
- suspension and exit
```

Ratification must bind each verified organization to the exact same artifact version. A shared title is insufficient; participants can unknowingly approve different text.

## 10. Federation trust stack

A production network needs controls at several layers.

### Legal and organizational trust

- verified legal identity;
- authority to participate;
- contract and purpose;
- jurisdiction;
- liability and indemnity;
- audit and assurance rights;
- dispute resolution; and
- suspension, termination, and exit.

### Technical identity and transport

- organization and service credentials;
- key issuance, rotation, and revocation;
- mutual authentication;
- encryption in transit;
- endpoint authorization;
- replay protection;
- signed messages or receipts where required; and
- availability and denial-of-service controls.

### Contract and data governance

- typed versioned schemas;
- semantic definitions;
- data minimization;
- classification and purpose limitation;
- consent or other authority where applicable;
- retention, correction, and deletion;
- provenance and quality;
- compatibility and migration; and
- derived-inference restrictions.

### Operational reliability

- delivery guarantees;
- idempotency;
- ordering;
- correlation;
- timeouts and retries;
- dead-letter handling;
- reconciliation;
- service levels;
- observability; and
- incident coordination.

### Economic coordination

- pricing and cost allocation;
- metering;
- invoicing and settlement;
- credits and penalties;
- fraud and dispute controls;
- resource limits; and
- incentives against overuse.

Arturo currently implements none of this as a federation subsystem.

## 11. Network Governance

Federation Governance should distinguish decision classes:

| Decision | Possible rule |
|---|---|
| Correct non-semantic typo | maintainer review plus notice |
| Add optional compatible field | defined quorum plus compatibility review |
| Add required field | unanimous affected-party ratification and migration plan |
| Change security requirement | security review and participant ratification |
| Emergency suspension | narrowly authorized emergency process with later review |
| Admit new participant | membership criteria and conflict review |
| Expel participant | due process, evidence, appeal, and continuity plan |

Unanimity protects participants but can create veto deadlock. Majority voting can impose costs on dissenters. Quorum rules, weighted votes, opt-in versions, forks, transition periods, and exit rights each create different power distributions.

Do not let the model choose the constitution of the network. Participants must negotiate it knowingly.

## 12. Internal Governance remains independent

Ratifying a shared advisory schema should not grant the Partner authority over:

- Studio Worker selection;
- internal prompt design;
- unrelated Memory;
- release decisions;
- budgets;
- customers; or
- internal policies.

Likewise, the Studio should not control the Partner's staffing, methods, other clients, or internal Governance.

Only the bounded shared commitments should cross the network boundary.

## 13. Network failure and exit

Design for:

- participant outage;
- delayed or malformed messages;
- key compromise;
- schema incompatibility;
- disputed advice;
- non-payment;
- regulatory change;
- participant merger or insolvency;
- emergency suspension;
- voluntary exit; and
- continuation for remaining participants.

An Enterprise should retain a safe degraded mode when the federation is unavailable. Dependency on the network must not silently eliminate its own accountability.

## 14. Federation security threats

Threats include:

- a compromised participant sending validly signed malicious data;
- Sybil participants or forged organizations;
- schema abuse and oversized payloads;
- prompt injection through federated text;
- data poisoning;
- inference attacks across aggregated data;
- replay and duplicate requests;
- confused-deputy authorization;
- collusion;
- supply-chain compromise;
- metadata leakage; and
- governance capture by dominant members.

Cryptographic authentication proves which credential sent a message, not that its content is truthful or safe. Treat all external content as untrusted input.

## Federated AI Workers

Do not share one global AI Worker across legal Enterprises merely because Arturo's local registry makes that technically easy. Questions include:

- whose instructions and policies govern it;
- which organization's data it can see;
- who pays;
- who is liable;
- whether prompts leak between participants;
- how conflicts are resolved;
- who may update its model or tools;
- how its actions are attributed; and
- how access is revoked when a participant leaves.

Current global Worker selection is a limitation, not a federation pattern.

## Model and cost considerations

A federation can amplify token spending because several participants may analyze, verify, and retry the same message. Arturo does not currently provide:

- per-participant budgets;
- cost attribution;
- cheapest-model routing;
- paid-model escalation approval;
- shared caching with confidentiality boundaries;
- network quotas;
- settlement; or
- provider invoice reconciliation.

Economic incentives and cost allocation are part of federation design, not an afterthought. Chapter 37 examines this further.

## Target architecture — non-executable

The following illustrates a possible future interface. **Do not enter these commands in the current CLI.**

```text
# NOT IMPLEMENTED
/federation create "Harbour Accessibility Network" --constitution <artifact-id>

# NOT IMPLEMENTED
/federation member invite <network-id> --enterprise <verified-enterprise-id>

# NOT IMPLEMENTED
/federation standard propose <network-id> --schema <versioned-schema-id>

# NOT IMPLEMENTED
/federation standard review <proposal-id> --as <verified-member-id>

# NOT IMPLEMENTED
/federation standard ratification-status <proposal-id>

# NOT IMPLEMENTED
/federation message send <network-id> --contract <schema-version> --payload <artifact-id>

# NOT IMPLEMENTED
/federation message receipt <message-id>

# NOT IMPLEMENTED
/federation member suspend <member-id> --reason <incident-id>

# NOT IMPLEMENTED
/federation member leave <network-id> --transition-plan <artifact-id>
```

A trustworthy implementation requires verified identities, contracts, keys, schemas, independent policy evaluation, ratification, secure transport, receipts, reliability, audit, privacy, economics, disputes, and exit—not merely these commands.

## Current implementation boundaries

Arturo currently does **not** provide:

- Federation, Member, Standard, Proposal, Ratification, Agreement, Message, Receipt, Meter, Invoice, Dispute, or Incident entities;
- Enterprise-isolated Worker, Memory, policy, Task, Event, Human Task, approval, or audit stores;
- verified legal or technical organization identity;
- membership, invitation, admission, suspension, expulsion, exit, or succession workflows;
- cross-Enterprise delegation or Event transport;
- versioned schemas, contract negotiation, compatibility, migration, or consumer tracking;
- multi-party approval, quorum, voting, veto, fork, or constitutional Governance;
- cross-organization authentication, authorization, encryption, signing, key management, receipts, or non-repudiation;
- delivery guarantees, retries, idempotency, ordering, reconciliation, or network service levels;
- privacy-preserving aggregation, consent, purpose, retention, correction, revocation, or disclosure controls;
- network metering, budgets, pricing, invoicing, settlement, penalties, or economic incentives; or
- proof that participants, standards, messages, approvals, or agreements are genuine, authorized, safe, or legally binding.

## Common mistakes

**Calling multiple Enterprise records a federation.** They share a local application and lack network trust boundaries.

**Treating Worker names as organization identity.** Registration does not verify a person or participant.

**Using Human Tasks as legal ratification.** They are global workflow records, not organizational signatures.

**Working around rejected cross-Enterprise delegation.** Copying data through Memory or Events weakens boundaries rather than implementing federation.

**Assuming a schema creates shared meaning.** Semantics, authority, process, and versions still need agreement.

**Letting one participant change a shared standard unilaterally.** Affected parties need their agreed decision process.

**Requiring unanimity for every decision.** It can make routine maintenance impossible and concentrate veto power.

**Letting majority rule override critical rights.** Efficient voting can still be unjust or unsafe.

**Treating authenticated content as trusted content.** A known participant can be wrong or compromised.

**Sharing a global Worker across legal boundaries.** Data, instructions, cost, and accountability can leak.

**Ignoring exit.** A network without safe withdrawal can become coercive and operationally brittle.

## Design challenge

Using fictional Enterprises and data only:

1. Define the federation's narrow purpose and what remains internal.
2. Create two separate Enterprise records and inspect the lack of isolation.
3. Draft a typed request and response contract externally.
4. Record authorization for advisory standards analysis.
5. Run the bounded standards-analysis Task and classify every claim by evidence.
6. Confirm that cross-Enterprise delegation is rejected.
7. Record two independent Human Task perspectives without calling them ratification.
8. Build an external ratification ledger tied to an exact artifact hash.
9. Design membership, standard-change, emergency, dispute, and exit Governance.
10. Specify identity, transport, schema, reliability, privacy, security, and economic controls.
11. Define a safe degraded mode when the network is unavailable.

## Chapter summary

Current Arturo can demonstrate this boundary-aware design exercise:

```text
separate Enterprise records → external shared-contract draft
                            → advisory compatibility analysis
                            → rejected cross-Enterprise delegation
                            → separate human perspectives
                            → external ratification and trust design
```

A federation requires independent organizations to coordinate without surrendering internal authority. That depends on verified identity, bounded agreements, shared semantics, multi-party Governance, secure reliable exchange, economic alignment, dispute handling, and exit rights. Arturo's current multi-Enterprise records provide none of those guarantees.

## Looking ahead

Chapter 37 explores Economic Modelling: how cost, value, scarcity, incentives, pricing, budgets, and externalities should be represented without letting invented model numbers masquerade as financial evidence.
