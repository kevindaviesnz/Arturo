/**
 * Builds the demonstration Enterprise by running real Arturo commands.
 *
 * Driving `handleUiCommand` rather than writing to the stores directly means
 * the seed can only produce state an operator could have reached themselves,
 * and it fails loudly if a command it depends on changes.
 *
 * Run with `npm run demo`. This is destructive: it resets local state first.
 */

import "dotenv/config";
import { join } from "node:path";
import {
  handleUiCommand,
  handleUiResetConfirmation,
} from "../ui/uiCommandHandlers";
import { getEnterpriseByName, listEnterprises } from "../enterprise/enterpriseStore";
import { assignWorkerOwnership, listEnterpriseWorkers } from "../identity/organisationIdentity";
import { listBusinessFunctionDefinitions } from "../business/businessFunctionDefinitionStore";
import { saveStaffingAssignment } from "../staffing/staffingStore";
import { listJobs } from "../runtime/jobQueue";
import { evaluateJobGovernance } from "../runtime/jobGovernance";
import {
  demoAgreementStep,
  demoBalancedAgreementStep,
  demoGovernedTaskStep,
  demoOpeningMoves,
  demoStaffing,
  demoSteps,
  DEMO_ENTERPRISE_NAME,
  type DemoStep,
} from "./demoScript";

/** Resolved from this file so the seed works whatever directory it is run from. */
function demoAsset(fileName: string): string {
  return join(
    __dirname,
    "..",
    "..",
    "scenario_harness",
    "assets",
    fileName
  );
}

const FAILURE_TEXT =
  /failed|error|not found|unknown|unsupported|denied|invalid|usage|no ai staffing/i;

/**
 * Runs one step, treating a failure reported anywhere in the entry as fatal.
 *
 * The label alone is not sufficient: some handlers return a success-shaped
 * label such as "Task created" with a refusal in the body, which is exactly the
 * case that let an earlier version of this seed report success while producing
 * no Task at all.
 *
 * SIDE EFFECT: Executes an Arturo command.
 */
async function runStep(
  step: DemoStep,
  log: (message: string) => void
): Promise<void> {
  const entries =
    await handleUiCommand(
      step.command,
      step.args
    );
  const failure =
    entries.find(
      (entry) =>
        FAILURE_TEXT.test(entry.label) ||
        FAILURE_TEXT.test(entry.body)
    );

  if (failure) {
    throw new Error(
      [
        `Demo seeding failed at: ${step.narrative}`,
        `  ${step.command} ${step.args.join(" ")}`,
        `  ${failure.label}: ${failure.body.split("\n")[0]}`,
      ].join("\n")
    );
  }

  log(`  ${step.narrative}`);
}

/**
 * Empties the installation, confirming the reset the way an operator would.
 *
 * `/reset` only asks; nothing is deleted until the reply. The seed used to send
 * the command alone, so it reported "Resetting…" and then built the
 * demonstration on top of whatever was already there — a second run left two
 * copies of the governed Task queued. The emptiness is checked on the stores
 * rather than on the reply's wording.
 *
 * SIDE EFFECT: Deletes all local Arturo state.
 */
async function resetBeforeSeeding(): Promise<void> {
  await handleUiCommand("/reset", []);
  handleUiResetConfirmation("yes");

  if (listEnterprises().length > 0 || listJobs().length > 0) {
    throw new Error(
      "Demo seeding could not reset local Arturo state; refusing to seed on top of existing records."
    );
  }
}

/** Every Worker the demonstration registers, AI and Human. */
function demoWorkerNames(): readonly string[] {
  return demoSteps()
    .filter(
      (step) =>
        step.command === "/add-ai-worker" ||
        step.command === "/add-human-worker"
    )
    .map((step) => step.args[0]);
}

/**
 * Records that the demonstration's Workers belong to its Enterprise.
 *
 * Registration alone leaves a Worker unowned, and the company overview lists
 * unowned Workers apart from every company — the practice appeared to have no
 * people. No User is bound to the Human Worker: the seed has verified nobody's
 * identity, and ownership is not authority to decide.
 *
 * SIDE EFFECT: Writes Worker ownership records.
 */
function assignDemoWorkersToEnterprise(): void {
  const enterprise = getEnterpriseByName(DEMO_ENTERPRISE_NAME);

  if (!enterprise) {
    throw new Error(
      `Demo seeding failed: no Enterprise named "${DEMO_ENTERPRISE_NAME}".`
    );
  }

  for (const workerName of demoWorkerNames()) {
    assignWorkerOwnership({ workerName, enterpriseId: enterprise.id });
  }
}

/**
 * Runs every seeding step, stopping at the first command Arturo rejects.
 *
 * A partially-seeded Enterprise is worse than none: it would be presented as
 * real and quietly missing whatever the failed step established.
 *
 * SIDE EFFECT:
 * - Resets and rewrites local Arturo state.
 * - Writes progress to stdout.
 */
export async function seedDemoEnterprise(
  log: (message: string) => void = console.log
): Promise<void> {
  log("Resetting local Arturo state…");
  await resetBeforeSeeding();

  for (const step of demoSteps()) {
    await runStep(step, log);
  }

  assignDemoWorkersToEnterprise();
  log(`  Ownership: ${demoWorkerNames().length} Workers belong to ${DEMO_ENTERPRISE_NAME}`);

  const definitions =
    listBusinessFunctionDefinitions();

  for (const assignment of demoStaffing()) {
    const definition =
      definitions.find(
        (candidate) => candidate.label === assignment.functionLabel
      );

    if (!definition) {
      throw new Error(
        `Demo seeding failed: no Function named "${assignment.functionLabel}".`
      );
    }

    saveStaffingAssignment({
      businessFunctionId: definition.id,
      workerName: assignment.workerName,
      role: assignment.role,
      rationale: "Seeded demonstration staffing.",
    });
  }

  log(`  Staffing: ${demoStaffing().length} assignments`);

  await runStep(
    demoAgreementStep(demoAsset("draft-services-agreement.txt")),
    log
  );

  await runStep(
    demoBalancedAgreementStep(demoAsset("balanced-services-agreement.txt")),
    log
  );

  await runStep(
    demoGovernedTaskStep(),
    log
  );

  await assertDemoReady();
}

/**
 * Verifies the demonstration actually reached its intended end state.
 *
 * Pattern-matching command output for failure text is not reliable — a handler
 * can return a success-shaped label with a refusal in the body. Asserting the
 * end state directly is what catches a seed that "succeeded" into an empty
 * Enterprise, which is exactly the failure a presenter would otherwise discover
 * live.
 *
 * SIDE EFFECT: Reads Task and Governance policy state.
 */
export async function assertDemoReady(): Promise<void> {
  const tasks = listJobs();
  const [task] = tasks;

  if (tasks.length > 1) {
    throw new Error(
      `Demo seeding left ${tasks.length} Tasks where the demonstration expects one; earlier state was not cleared.`
    );
  }

  const enterprise = getEnterpriseByName(DEMO_ENTERPRISE_NAME);
  const owned = new Set(
    enterprise
      ? listEnterpriseWorkers(enterprise.id).map((record) => record.workerName)
      : []
  );
  const unowned = demoWorkerNames().filter((name) => !owned.has(name));

  if (unowned.length > 0) {
    throw new Error(
      `Demo seeding left Workers outside ${DEMO_ENTERPRISE_NAME}, so the company overview would show them as unscoped: ${unowned.join(", ")}.`
    );
  }

  if (!task) {
    throw new Error(
      "Demo seeding produced no Task. The governed Task could not be routed — " +
      "check that the staffed archetypes cover the capabilities its wording infers."
    );
  }

  // The Task is queued rather than already held: Governance is evaluated when
  // the Worker runtime picks the Task up, which needs a model provider. What
  // can be checked here — and what actually breaks the demonstration when it is
  // wrong — is the decision the runtime will reach. It is asked of the runtime's
  // own evaluator rather than read off `/tasks` and `/governance` output: that
  // output was reworded into plain English, the wording this check searched for
  // disappeared, and a correctly seeded demonstration was reported as broken.
  const decision = evaluateJobGovernance(task);

  if (decision?.effect !== "require-approval") {
    throw new Error(
      [
        "Demo seeding produced a Task no policy holds for approval, so the",
        `approval beat would never fire. Task requires "${(task.requiredCapabilities ?? []).join(", ") || "unknown"}";`,
        `Governance decided "${decision?.effect ?? "no decision"}".`,
      ].join(" ")
    );
  }
}

/**
 * SIDE EFFECT: Seeds state and prints the presenter's opening moves.
 */
async function main(): Promise<void> {
  await seedDemoEnterprise();

  console.log(
    [
      "",
      `${DEMO_ENTERPRISE_NAME} is ready.`,
      "",
      "Start Arturo with:  npm run ui",
      "",
      "Opening moves:",
      ...demoOpeningMoves().map((command) => `  ${command}`),
      "",
      "A Task is queued under a require-approval policy. With a model provider",
      "running it moves to awaiting-approval, so the first decision in the",
      "demonstration is a human one. Without a provider, everything above is",
      "still inspectable — nothing in the seeded state needed a model to build.",
      "",
    ].join("\n")
  );
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
