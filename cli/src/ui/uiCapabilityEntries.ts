import {
  CORE_CAPABILITIES,
  isWorkerCapability,
  type WorkerCapability,
} from "../control/workers";

import type {
  WorkStreamEntry,
} from "./uiState";

type CapabilityDescription = {
  readonly meaning: string;
  readonly boundary: string;
};

const CAPABILITY_DESCRIPTIONS: Readonly<
  Record<WorkerCapability, CapabilityDescription>
> = {
  llm: {
    meaning: "General language-model reasoning and response generation.",
    boundary: "Does not grant external tools, factual verification, or authority.",
  },
  writing: {
    meaning: "Draft and structure written content from supplied context.",
    boundary: "Does not publish, email, or write files by itself.",
  },
  research: {
    meaning: "Investigate a question and separate evidence, assumptions, and uncertainty.",
    boundary: "Looking anything up outside Arturo needs a separate tool, set up and approved first.",
  },
  review: {
    meaning: "Evaluate supplied work for quality, completeness, accuracy, and risk.",
    boundary: "Review metadata is not a Human approval or professional certification.",
  },
  "human-review": {
    meaning: "Take part in an accountable Human review or approval step.",
    boundary: "Reserved for Human participation; it does not make AI output authoritative.",
  },
  "human-contact": {
    meaning: "Prepare or route work that may need a Human participant.",
    boundary: "Does not grant permission to send email or contact anyone directly.",
  },
  analysis: {
    meaning: "Organize supplied information into comparisons, patterns, and conclusions.",
    boundary: "Conclusions remain limited by the evidence supplied to the Task.",
  },
  conversion: {
    meaning: "Transform content between formats while preserving its intended meaning.",
    boundary: "Does not prove the transformed content is correct.",
  },
  advice: {
    meaning: "Offer practical recommendations with trade-offs and risks.",
    boundary: "Advice is not a binding decision or professional opinion.",
  },
  planning: {
    meaning: "Break an objective into ordered, achievable steps and dependencies.",
    boundary: "A plan does not execute its steps.",
  },
  coordination: {
    meaning: "Route work and organize handoffs between suitable Workers or ongoing Functions.",
    boundary: "Cannot bypass capability, Governance, or approval requirements.",
  },
  monitoring: {
    meaning: "Observe supplied state and report significant changes or exceptions.",
    boundary: "Continuous monitoring requires a running Function and a real signal source.",
  },
  simulation: {
    meaning: "Explore possible outcomes using explicit assumptions.",
    boundary: "A simulation is not a prediction or real-world evidence.",
  },
  optimization: {
    meaning: "Compare alternatives and improve toward a stated objective.",
    boundary: "The objective and constraints must be supplied and reviewable.",
  },
  negotiation: {
    meaning: "Prepare positions, options, and trade-offs for a negotiation.",
    boundary: "Does not authorize the Worker to make commitments or contact another party.",
  },
  safety: {
    meaning: "Identify safety risks, constraints, and missing evidence in supplied material.",
    boundary: "Does not replace testing, regulation, or a qualified Human decision.",
  },
  coaching: {
    meaning: "Give supportive, practical guidance intended to improve performance over time.",
    boundary: "Specialization should be added with --refine; expertise is not independently verified.",
  },
  execution: {
    meaning: "Carry out a precisely defined step through a runtime-approved mechanism.",
    boundary: "The capability label alone grants no tool or operating-system permission.",
  },
  backup: {
    meaning: "Represent eligibility to create and verify backups through an approved backup mechanism.",
    boundary: "The label alone cannot read, copy, upload, restore, or verify files; a real authorized backup integration is required.",
  },
  "email-draft": {
    meaning: "Draft email content for review.",
    boundary: "Does not send the email.",
  },
  "office-read": {
    meaning: "Read business records through a Function's connected Office tools.",
    boundary: "Requires explicit Office access and staffing in the owning Function and Enterprise.",
  },
  "office-write": {
    meaning: "Save customer and job records and prepare document or message drafts through Office.",
    boundary: "Requires connected write access, staffing and Task governance. Cannot issue invoices, send messages or record bank movements.",
  },
  "email-send": {
    meaning: "Allowed to send email, once email has been set up and approved.",
    boundary: "No email is sent unless an actual connector, policy, and approval path are configured.",
  },
  "file-read": {
    meaning: "Represent eligibility to read files through a runtime-approved tool.",
    boundary: "The capability label alone does not expose any file.",
  },
  "file-write": {
    meaning: "Represent eligibility to create or update files through a runtime-approved tool.",
    boundary: "The capability label alone cannot create a file or artefact.",
  },
  "shell-read": {
    meaning: "Represent eligibility for non-mutating shell inspection through an approved tool.",
    boundary: "The capability label alone cannot run a command.",
  },
  "shell-execute": {
    meaning: "Allowed to run commands, through an approved tool only.",
    boundary: "The capability label alone cannot run a command and never overrides approval controls.",
  },
  web: {
    meaning: "Represent eligibility to use a general approved web or connector integration.",
    boundary: "Holding this label does not let a Worker browse the web or use social media. For searching the public web, use web-research; anything beyond that needs a separate tool set up first.",
  },
  "web-research": {
    meaning: "Search an approved provider and capture normalized source results as an exact, dated evidence Artefact before model analysis.",
    boundary: "Search snippets are third-party claims, not verified facts; Arturo does not open result pages, sign in, or bypass website restrictions.",
  },
  summarisation: {
    meaning: "Condense supplied content while preserving its important meaning and limits.",
    boundary: "A summary is only as reliable as its source material.",
  },
};

/** Returns the canonical descriptions used by help and /capabilities. */
export function getCapabilityDescription(
  capability: WorkerCapability
): CapabilityDescription {
  return CAPABILITY_DESCRIPTIONS[
    capability
  ];
}

/** Lists capabilities or explains one exact capability. */
export function readCapabilitiesEntry(
  args: readonly string[]
): WorkStreamEntry {
  // Accept "explain/inspect/show <id>" as well as the bare "<id>" form, for the
  // same grammar consistency as /archetypes and the other inspect commands.
  const leadingVerbs =
    ["explain", "inspect", "show", "list"];
  const requested =
    (leadingVerbs.includes(args[0]?.trim().toLowerCase() ?? "")
      ? args[1]
      : args[0])
      ?.trim()
      .toLowerCase();

  if (requested) {
    if (
      !isWorkerCapability(
        requested
      )
    ) {
      return {
        actor: "Arturo",
        label: "Capability not found",
        body: [
          `Unknown capability: ${requested}`,
          "Run /capabilities to list the canonical capability IDs.",
        ].join("\n"),
      };
    }

    const description =
      getCapabilityDescription(
        requested
      );
    return {
      actor: "Arturo",
      label: `Capability · ${requested}`,
      body: [
        description.meaning,
        "",
        `Boundary: ${description.boundary}`,
        "",
        "Example:",
        `  /workers --capability "${requested}"`,
        `  /task create "<one clear outcome>" --job "<job>"`,
        "  Task capabilities come from the Function's staffed Worker archetype.",
      ].join("\n"),
    };
  }

  return {
    actor: "Arturo",
    label: "Capabilities",
    body: [
      "Capabilities are canonical routing labels. Arturo compares a Task's required capabilities with Worker capabilities before assigning work.",
      "They describe eligibility; they do not grant tools, prove expertise, or bypass Governance.",
      "",
      ...CORE_CAPABILITIES.flatMap(
        (capability) => {
          const description =
            getCapabilityDescription(
              capability
            );
          return [
            capability,
            `  ${description.meaning}`,
          ];
        }
      ),
      "",
      "Inspect one capability:",
      "  /capabilities <capability>",
    ].join("\n"),
  };
}
