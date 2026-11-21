/**
 * The scripted state behind `npm run demo`.
 *
 * A demonstration must not depend on a model producing good output live: a slow
 * or weak generation in front of an audience is the single largest avoidable
 * risk in showing Arturo. Every step here is deterministic — no `/next`,
 * `/staff`, `/ask`, or `/suggest` — so the seeded Enterprise is identical on
 * every run and needs no model provider to build.
 *
 * The seed deliberately stops at the interesting moment rather than a finished
 * one: a governed Task sits awaiting approval, so the first live action a
 * presenter takes is `/approvals` followed by `/approve`.
 */

export type DemoStep = {
  /** Command to run, without the leading slash arguments split out. */
  readonly command: string;
  readonly args: readonly string[];
  /** What this step establishes, shown while seeding. */
  readonly narrative: string;
};

/** Enterprise the demonstration builds. */
export const DEMO_ENTERPRISE_NAME = "Harbour Legal";

/** Function used for the governed-approval beat. */
export const DEMO_GOVERNED_FUNCTION = "Client Advice";

const ai = (
  name: string,
  archetype: string,
  refinement: string
): DemoStep => ({
  command: "/add-ai-worker",
  args: [name, "--archetype", archetype, "--refine", refinement],
  narrative: `AI Worker: ${name}`,
});

const fn = (
  label: string,
  objective: string
): DemoStep => ({
  command: "/function",
  args: ["create", label, "--enterprise", DEMO_ENTERPRISE_NAME, "--objective", objective],
  narrative: `Function: ${label}`,
});

/**
 * Returns the ordered steps that build the demonstration Enterprise.
 *
 * PURE: No side effects.
 */
export function demoSteps(): readonly DemoStep[] {
  return [
    {
      command: "/enterprise",
      args: [
        "create",
        DEMO_ENTERPRISE_NAME,
        "--mission",
        "Run a one-lawyer practice that gives small businesses clear, affordable commercial advice.",
        "--description",
        "Harbour Legal is a sole legal practice in Auckland advising small businesses on commercial contracts, employment questions, and disputes.",
      ],
      narrative: "Enterprise: Harbour Legal (sole legal practice)",
    },

    fn(
      "Client Intake",
      "Turn enquiries into properly scoped, conflict-checked engagements."
    ),
    fn(
      DEMO_GOVERNED_FUNCTION,
      "Prepare advice on supplied client material for the principal to review."
    ),
    fn(
      "Contract Review",
      "Identify risks and negotiation points in supplied commercial contracts."
    ),
    fn(
      "Practice Administration",
      "Keep matters, deadlines, and records current and reviewable."
    ),

    ai(
      "Intake Analyst",
      "analyst",
      "Scope enquiries from supplied facts only. Never assess the merits of a claim."
    ),
    ai(
      "Contract Reviewer",
      "reviewer",
      "Identify risks and unclear terms in supplied contracts. Never assert what the law requires."
    ),
    ai(
      "Advice Drafter",
      "creator",
      "Draft advice from supplied material only, labelling every assumption."
    ),
    ai(
      "Legal Researcher",
      "researcher",
      "Gather background from supplied material only. Never assert the current state of the law."
    ),
    ai(
      "Matter Administrator",
      "assistant",
      "Track matters and deadlines from recorded information only."
    ),

    {
      command: "/add-human-worker",
      args: [
        "Principal Lawyer",
        "--archetype",
        "guardian",
        "--availability",
        "available",
        "--refine",
        "Admitted solicitor accountable for all advice released to a client.",
      ],
      narrative: "Human Worker: Principal Lawyer (the accountable human)",
    },

    {
      command: "/governance",
      args: [
        "policy",
        "add",
        "Client-facing legal advice requires review by the principal",
        "--effect",
        "require-approval",
        "--capability",
        "review",
        "--enterprise",
        DEMO_ENTERPRISE_NAME,
      ],
      narrative: "Policy: advice is held for the principal's approval",
    },

    {
      command: "/memory",
      args: [
        "add",
        "The practice does not advise on criminal, family, or immigration matters.",
        "--scope",
        DEMO_ENTERPRISE_NAME,
      ],
      narrative: "Operational Memory: scope of practice",
    },

  ];
}

/** The first document registered in a fresh installation, at its first version. */
export const DEMO_AGREEMENT_REFERENCE = "artefact-1@1";

/**
 * Registers the document the governed Task is about.
 *
 * The Task used to ask for a review of "the client's draft services agreement"
 * with no agreement anywhere. Run for real, the Worker graded a review that
 * did not exist and scored it out of ten. A demonstration of reviewing a
 * document has to contain the document.
 *
 * PURE: No side effects.
 */
export function demoAgreementStep(agreementFile: string): DemoStep {
  return {
    command: "/artefact",
    args: [
      "add",
      "Draft services agreement",
      "--enterprise",
      DEMO_ENTERPRISE_NAME,
      "--kind",
      "other",
      "--file",
      agreementFile,
      "--created-by",
      "Principal Lawyer",
    ],
    narrative: "Document: draft services agreement (synthetic)",
  };
}

/** The second document registered, at its first version. */
export const DEMO_BALANCED_AGREEMENT_REFERENCE = "artefact-2@1";

/**
 * Registers an even-handed agreement beside the lopsided one, attached to
 * nothing.
 *
 * Every clause of the first agreement that a model reviewed on its own came
 * back "one-sided" — true of most of them, and no evidence that the model can
 * tell. The same review of this document is the comparison: a Worker that
 * calls these clauses one-sided too is not judging them.
 *
 * PURE: No side effects.
 */
export function demoBalancedAgreementStep(agreementFile: string): DemoStep {
  return {
    command: "/artefact",
    args: [
      "add",
      "Balanced services agreement",
      "--enterprise",
      DEMO_ENTERPRISE_NAME,
      "--kind",
      "other",
      "--file",
      agreementFile,
      "--created-by",
      "Principal Lawyer",
    ],
    narrative: "Document: balanced services agreement (synthetic, for comparison)",
  };
}

/** The instruction both agreements are reviewed under, so the two results can be compared. */
export const DEMO_REVIEW_INSTRUCTION =
  "Review the supplied draft services agreement and list the clauses that need negotiation, labelling every assumption and noting what a lawyer must verify. Use only the supplied agreement; if it is not supplied, say so and stop.";

/**
 * The governed Task, created after staffing so it can route to a Worker and be
 * held by policy rather than rejected for having no coverage.
 *
 * PURE: No side effects.
 */
export function demoGovernedTaskStep(): DemoStep {
  return {
    command: "/task",
    args: [
      "create",
      DEMO_REVIEW_INSTRUCTION,
      "--function",
      DEMO_GOVERNED_FUNCTION,
      "--enterprise",
      DEMO_ENTERPRISE_NAME,
      "--input-artefact",
      DEMO_AGREEMENT_REFERENCE,
    ],
    narrative: "Task created — held by policy, awaiting approval",
  };
}

/**
 * Which Workers staff which Functions.
 *
 * `/staff` generates this with a model, but the assignment itself is plain
 * data. Writing it directly keeps the seed deterministic while producing
 * exactly the state a `/staff` run would have left behind.
 */
export function demoStaffing(): readonly {
  readonly functionLabel: string;
  readonly workerName: string;
  readonly role: "ai" | "human-approver";
}[] {
  return [
    { functionLabel: "Client Intake", workerName: "Intake Analyst", role: "ai" },
    { functionLabel: "Contract Review", workerName: "Contract Reviewer", role: "ai" },
    { functionLabel: DEMO_GOVERNED_FUNCTION, workerName: "Advice Drafter", role: "ai" },
    { functionLabel: DEMO_GOVERNED_FUNCTION, workerName: "Legal Researcher", role: "ai" },
    { functionLabel: DEMO_GOVERNED_FUNCTION, workerName: "Contract Reviewer", role: "ai" },
    { functionLabel: DEMO_GOVERNED_FUNCTION, workerName: "Principal Lawyer", role: "human-approver" },
    { functionLabel: "Practice Administration", workerName: "Matter Administrator", role: "ai" },
  ];
}

/**
 * Returns the commands a presenter runs after seeding, in order.
 *
 * PURE: No side effects.
 */
export function demoOpeningMoves(): readonly string[] {
  return [
    "/overview",
    "/functions",
    "/workers",
    "/governance policy list",
    "/tasks",
    "/approvals",
    "/approve <task-id>",
    "/timeline",
  ];
}
