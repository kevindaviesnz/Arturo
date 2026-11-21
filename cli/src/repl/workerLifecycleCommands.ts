import { readFileSync } from "node:fs";
import { getWorker, isWorkerAvailableForNewTask, registerWorkflowWorker, setWorkerAvailability, type WorkerAvailability } from "../control/workers";
import { validateWorkflowDefinition } from "../control/workflowWorker";

import { enqueueJob } from "../runtime/jobQueue";
import { resolveJobEnterpriseId } from "../runtime/jobOrganisation";
import { workerBelongsToEnterprise } from "../identity/organisationIdentity";
import { getEnterprise } from "../enterprise/enterpriseStore";

/** Thin trusted local administration commands. */
export function handleWorkerLifecycleCommand(command: string, args: readonly string[]): void {
  try {
    if (command === "/workflow-worker") {
      if (args.length !== 2) throw new Error("Usage: /workflow-worker <name> <definition.json>");
      const definition = validateWorkflowDefinition(JSON.parse(readFileSync(args[1]!, "utf8")));
      const worker = registerWorkflowWorker(args[0]!, definition);
      console.log(`Workflow Worker ${worker.name} registered (conversion; available).`);
    } else if (command === "/workflow-run") {
      if ((args.length !== 2 && args.length !== 4) || (args.length === 4 && args[2] !== "--enterprise")) throw new Error('Usage: /workflow-run <name> "<input>" [--enterprise <id>]');
      const worker = getWorker(args[0]);
      if (worker?.kind !== "workflow") throw new Error("A registered workflow Worker is required.");
      if (!isWorkerAvailableForNewTask(worker)) throw new Error("Workflow Worker is not available for new work.");
      if (args[3] && !getEnterprise(args[3])) throw new Error("Unknown Enterprise.");
      const enterpriseId = resolveJobEnterpriseId({id:"",task:args[1],status:"queued",createdAt:Date.now(),enterpriseId:args[3]});
      if (!workerBelongsToEnterprise(worker.name, enterpriseId)) throw new Error("Workflow Worker does not belong to the selected Enterprise; specify --enterprise.");
      const job = enqueueJob(args[1],worker.name,{requiredCapabilities:["conversion"],enterpriseId});
      console.log(`Workflow Task ${job.id} queued for ${worker.name}; normal governance applies.`);
    } else if (command === "/worker-availability") {
      if (args.length !== 2) throw new Error("Usage: /worker-availability <name> <available|busy|offline>");
      const worker = setWorkerAvailability(args[0]!, args[1] as WorkerAvailability);
      console.log(`Worker ${worker.name}: ${worker.availability}`);
    } else throw new Error("Unknown Worker lifecycle command.");
  } catch (error) {
    console.log(error instanceof Error ? error.message : String(error));
  }
}
