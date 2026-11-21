import { isWorkerAvailableForNewTask } from "../control/workers";
import {
  listBusinessFunctionDefinitions,
} from "../business/businessFunctionDefinitionStore";
import {
  getBusinessFunction,
} from "../business/businessFunctionRuntimeStore";
import {
  type Worker,
  workerSupportsCapabilities,
} from "../control/workers";
import {
  getEnterprise,
} from "../enterprise/enterpriseStore";
import {
  publishOrganisationalEventToRuntimes,
} from "../events/organisationalEventBus";
import {
  getJob,
} from "./jobQueue";
import type {
  RuntimeSignalEvaluation,
  RuntimeSignalReasoner,
} from "./businessFunctionRuntimeEvaluator";
import {
  inferBusinessFunctionCapabilities,
} from "./businessFunctionRuntimeRouting";

/**
 * Lets matching running Runtimes observe a newly available Worker immediately.
 * The signal is targeted so unrelated Business Functions do not spend model
 * calls evaluating a capability they cannot use.
 */
export async function evaluateNewWorkerForRunningRuntimes(
  worker: Worker<any, any>,
  reasoner?: RuntimeSignalReasoner
): Promise<readonly RuntimeSignalEvaluation[]> {
  if (!isWorkerAvailableForNewTask(worker)) {
    return [];
  }

  const matchingDefinitions = listBusinessFunctionDefinitions()
    .filter((definition) => {
      if (
        !definition.runtimeId ||
        getBusinessFunction(definition.runtimeId)?.state !== "running"
      ) {
        return false;
      }

      const runtime = getBusinessFunction(definition.runtimeId);
      const alreadyHasOpenWorkForWorker = runtime?.jobIds.some((jobId) => {
        const job = getJob(jobId);
        const workerCanTakeUnassignedJob = Boolean(
          job &&
          !job.worker &&
          job.requiredCapabilities?.length &&
          job.requiredCapabilities.every(
            (capability) =>
              capability !== "human-review" &&
              worker.capabilities?.includes(capability)
          )
        );

        return Boolean(
          job &&
          job.status !== "completed" &&
          job.status !== "failed" &&
          (
            job.worker === worker.name ||
            workerCanTakeUnassignedJob
          )
        );
      });

      if (alreadyHasOpenWorkForWorker) {
        return false;
      }

      const archetypeMatches = Boolean(
        worker.archetype &&
        definition.requiredArchetypes.includes(worker.archetype)
      );

      return archetypeMatches || workerSupportsCapabilities(
        worker,
        inferBusinessFunctionCapabilities(definition)
      );
    });

  const evaluations: RuntimeSignalEvaluation[] = [];

  for (const definition of matchingDefinitions) {
    const enterprise = getEnterprise(definition.enterpriseId);

    if (!enterprise || !definition.runtimeId) {
      continue;
    }

    const publication = await publishOrganisationalEventToRuntimes(
      {
        label: "Matching Worker Available",
        enterpriseName: enterprise.name,
        sourceBusinessFunction: "Workforce",
        payload: {
          worker: worker.displayName ?? worker.name,
          workerArchetype: worker.archetype ?? "unspecified",
          workerCapabilities: worker.capabilities?.join(", ") ?? "unspecified",
          matchingBusinessFunction: definition.label,
          instruction: "Determine whether bounded domain work is now warranted. If so, describe the work itself without mentioning Worker assignment, selection, routing, delegation, or registration.",
        },
      },
      reasoner,
      [definition.runtimeId]
    );

    evaluations.push(...publication.evaluations);
  }

  return evaluations;
}
