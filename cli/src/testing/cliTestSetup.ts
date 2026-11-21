import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentArchetype } from "../agents/agentArchetype";
import { createArtefact } from "../artefacts/artefactStore";
import { createEnterpriseFunction } from "../business/businessFunctionCreation";
import { addWorker, createHumanWorker, registerAiWorker } from "../control/workers";
import { getEnterprise } from "../enterprise/enterpriseStore";
import { assignWorkerOwnership } from "../identity/organisationIdentity";
import { saveStaffingAssignment } from "../staffing/staffingStore";

export type TestPersonInput = {
  readonly enterpriseId: string;
  readonly name: string;
  readonly role?: "worker" | "approver";
  readonly as?: string;
};

/** Registers a human worker at an Enterprise for CLI tests. */
export function addEnterprisePerson(input: TestPersonInput): { readonly added: true; readonly name: string } {
  const archetype: AgentArchetype = input.role === "approver" ? "guardian" : "assistant";
  addWorker(createHumanWorker(input.name, archetype));
  assignWorkerOwnership({ workerName: input.name, enterpriseId: input.enterpriseId });
  return { added: true, name: input.name };
}

export type TestAreaInput = {
  readonly enterpriseId: string;
  readonly name: string;
  readonly purpose?: string;
  readonly helperName?: string;
  readonly helperKind?: string;
  readonly archetype?: string;
  readonly approver?: string;
  readonly as?: string;
};

/** Creates a Business Function, registers its AI worker, and wires staffing for CLI tests. */
export function setUpEnterpriseArea(input: TestAreaInput): { readonly created: true; readonly functionId: string } {
  const enterprise = getEnterprise(input.enterpriseId);
  if (!enterprise) {
    throw new Error(`Enterprise not found: ${input.enterpriseId}`);
  }
  const created = createEnterpriseFunction({
    enterprise,
    label: input.name,
    objective: input.purpose ?? input.name,
  });
  if (!created.created || !created.definition) {
    throw new Error(`Could not create Function ${input.name}`);
  }
  const functionId = created.definition.id;
  const helperName = input.helperName ?? `${input.name} AI worker`;
  const archetype = (input.archetype ?? "assistant") as AgentArchetype;
  registerAiWorker(helperName, archetype);
  assignWorkerOwnership({ workerName: helperName, enterpriseId: input.enterpriseId });
  saveStaffingAssignment({
    businessFunctionId: functionId,
    workerName: helperName,
    role: "ai",
    rationale: "CLI test staffing.",
  });
  if (input.approver) {
    saveStaffingAssignment({
      businessFunctionId: functionId,
      workerName: input.approver,
      role: "human-approver",
      rationale: "CLI test approver.",
    });
  }
  return { created: true, functionId };
}

/** Writes a temporary text file and registers it as a version-1 Artefact for CLI tests. */
export function createTempTextArtefact(input: {
  readonly enterpriseId: string;
  readonly fileName: string;
  readonly content: string;
  readonly createdBy: string;
}): { readonly ref: string; readonly artefactId: string; readonly filePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "arturo-test-"));
  const filePath = join(dir, input.fileName);
  writeFileSync(filePath, input.content, "utf8");
  const artefact = createArtefact({
    enterpriseId: input.enterpriseId,
    name: input.fileName,
    kind: "other",
    file: filePath,
    createdBy: input.createdBy,
  });
  return { ref: `${artefact.id}@1`, artefactId: artefact.id, filePath };
}
