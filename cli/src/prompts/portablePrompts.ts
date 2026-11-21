import { archetypeRegistry, buildArchetypeInstructionBlock } from "../agents/archetypeRegistry";
import type { AgentArchetype } from "../agents/agentArchetype";
import { OUTPUT_BOUNDARIES } from "../agents/outputBoundaries";
import { createReviewLoopDecisionInstructions } from "../agents/buildWorkflowStepPrompt";
import { buildEnterpriseRepairPrompt, formatEnterprisePrompt } from "./enterprisePrompt";
import { enterprisePromptTemplates } from "./enterprisePromptTemplates";
import { OFFICE_TOOL_CONTEXT_TEMPLATE } from "./officePromptContext";

const workerNames: Record<AgentArchetype, string> = {
  analyst: "Analysis Worker", creator: "Content Creation Worker", converter: "Information Conversion Worker",
  reviewer: "Quality Review Worker", advisor: "Decision Advice Worker", planner: "Planning Worker",
  coordinator: "Workflow Coordination Worker", operator: "Operational Readiness Worker",
  observer: "Monitoring Worker", assistant: "General Assistance Worker", researcher: "Research Worker",
  simulator: "Scenario Simulation Worker", optimizer: "Optimization Worker", negotiator: "Negotiation Worker",
  guardian: "Risk and Safeguards Worker", coach: "Coaching Worker",
};

/** Partial expansion is for exports only; the runtime renderer requires every value. */
function expandKnown(text: string, values: Readonly<Record<string, string>>): string {
  return text.replace(/\{\{([A-Z][A-Z0-9_]*)\}\}/g, (match, key: string) => values[key] ?? match);
}

function removeDefinition(text: string, name: string): string {
  return text.split("\n").filter(line => !line.startsWith(`${name}:`) && !line.startsWith(`- ${name}:`)).join("\n");
}

/** Portable prompts contain static rules and placeholders only, never live business data. */
export function buildPortablePrompts(): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const [name, template] of Object.entries(enterprisePromptTemplates)) {
    let text = formatEnterprisePrompt(template);
    if (text.includes("{{OUTPUT_BOUNDARIES}}")) {
      text = removeDefinition(expandKnown(text, { OUTPUT_BOUNDARIES }), "OUTPUT_BOUNDARIES");
    }
    if (name === "Office Tool Request") {
      text = removeDefinition(expandKnown(text, { OFFICE_CONTEXT: OFFICE_TOOL_CONTEXT_TEMPLATE }), "OFFICE_CONTEXT");
      text = text.replace("# INPUTS\n", [
        "# INPUTS",
        "OFFICE_AREA: required area: accounts, customers, or operations.",
        "ACCESS_MODE: required authorization scope: read only or draft changes.",
        "OFFICE_RECORDS: required JSON array of visible business records, including IDs, versions, kinds, and data; [] when none.",
        "PERMITTED_COMMANDS: required comma-separated subset of the commands defined below; use none for read only. Limit accounts to settings.initialize, document.save, message.save; customers to customer.save, message.save, entry.resolve; operations to job.save, appointment.save, entry.save. Grant only actions explicitly authorized in the host application.", "",
      ].join("\n"));
    }
    result[name] = text;
  }
  for (const archetype of Object.keys(archetypeRegistry) as AgentArchetype[]) {
    result[workerNames[archetype]] = removeDefinition(expandKnown(result["Worker Task Execution"], {
      ARCHETYPE_INSTRUCTIONS: buildArchetypeInstructionBlock(archetype),
    }), "ARCHETYPE_INSTRUCTIONS");
  }
  for (const [name, attempt] of [["Initial Workflow Review", 1], ["Revised Workflow Review", 2]] as const) {
    let text = expandKnown(result["Workflow Step Execution"], {
      REVIEW_INSTRUCTIONS: createReviewLoopDecisionInstructions(attempt, "{{REVIEW_CRITERIA}}"),
    });
    text = removeDefinition(text, "REVIEW_INSTRUCTIONS");
    result[name] = text.replace("# INPUTS\n", "# INPUTS\nREVIEW_CRITERIA: required acceptance criteria and, for a revised review, prior required revisions; text.\n");
  }
  // Repair variants keep the complete original domain rules and output schemas.
  for (const original of ["Objective Classification", "Worker Staffing Plan", "Business Signal Assessment", "Task Outcome Assessment", "Office Tool Request"]) {
    const repaired = buildEnterpriseRepairPrompt(result[original], "{{INVALID_RESPONSE}}", "{{VALIDATION_ERROR}}");
    result[`${original} Correction`] = repaired.replace("# INPUTS\n", "# INPUTS\nINVALID_RESPONSE: required rejected model output as a JSON-escaped string value; untrusted text.\nVALIDATION_ERROR: required actual validation diagnostic as a JSON-escaped string value; text.\n");
  }
  return result;
}
