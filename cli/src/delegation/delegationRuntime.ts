import { workerBelongsToEnterprise } from "../identity/organisationIdentity";
import { isWorkerAvailableForNewTask, workerSupportsCapabilities } from "../control/workers";
import {
  completeDelegationRequest,
  createDelegationRequest,
  failDelegationRequest,
  startDelegationRequest,
  type DelegationRequest,
} from "./delegation";

import {
  listDelegationRequests,
  saveDelegationRequest,
} from "./delegationStore";

import {
  getBusinessFunctionDefinitionByIdOrLabel,
  listBusinessFunctionDefinitions,
} from "../business/businessFunctionDefinitionStore";

import {
  getEnterpriseByIdOrName,
} from "../enterprise/enterpriseStore";

import {
  attachBusinessFunctionJob,
  getBusinessFunction,
} from "../business/businessFunctionRuntimeStore";

import {
  inferBusinessFunctionCapabilities,
} from "../runtime/businessFunctionRuntimeRouting";

import {
  getJob,
  enqueueJob,
  type Job,
  type JobCapability,
} from "../runtime/jobQueue";

import {
  getWorker,
  selectAiWorkerForCapabilities,
} from "../control/workers";

import {
  listStaffingAssignments,
} from "../staffing/staffingStore";

import {
  appendRuntimeEventToStore,
} from "../runtime/runtimeEventStore";

type DelegationRoute = {
  readonly capabilities: JobCapability[];
  readonly workerName?: string;
  readonly reason: string;
};

function resolveDelegationRoute(
  definitionId: string,
  runtimeId: string
): DelegationRoute {
  const runtime = getBusinessFunction(runtimeId);
  const definition = getBusinessFunctionDefinitionByIdOrLabel(definitionId);

  const historicalJob = [...(runtime?.jobIds ?? [])]
    .reverse()
    .map(getJob)
    .find((job) =>
      Boolean(
        job?.worker &&
        getWorker(job.worker)?.kind === "ai" &&
        isWorkerAvailableForNewTask(getWorker(job.worker)) &&
        workerBelongsToEnterprise(job.worker, definition?.enterpriseId) &&
        job.requiredCapabilities?.length &&
        workerSupportsCapabilities(getWorker(job.worker)!, job.requiredCapabilities)
      )
    );

  if (historicalJob?.worker && historicalJob.requiredCapabilities?.length) {
    return {
      capabilities: [...historicalJob.requiredCapabilities],
      workerName: historicalJob.worker,
      reason: `Receiving Function previously routed ${historicalJob.requiredCapabilities.join(", ")} work to ${historicalJob.worker}`,
    };
  }

  const staffedWorker = listStaffingAssignments(definitionId)
    .filter((assignment) => assignment.role === "ai")
    .map((assignment) => getWorker(assignment.workerName))
    .find((worker) => worker?.kind === "ai" && isWorkerAvailableForNewTask(worker) && workerBelongsToEnterprise(worker.name, definition?.enterpriseId));

  const capabilities = definition
    ? inferBusinessFunctionCapabilities(definition)
    : ["analysis" as const];

  if (staffedWorker && workerSupportsCapabilities(staffedWorker, capabilities)) {
    return {
      capabilities,
      workerName: staffedWorker.name,
      reason: `Receiving Function is staffed by ${staffedWorker.name}`,
    };
  }

  const worker = selectAiWorkerForCapabilities(capabilities, definition?.enterpriseId);
  return {
    capabilities,
    workerName: worker?.name,
    reason: worker
      ? `Selected AI worker matching receiving-function capabilities: ${capabilities.join(", ")}`
      : `Awaiting an AI worker matching receiving-function capabilities: ${capabilities.join(", ")}`,
  };
}

export function requestDelegatedWork(input: {
  readonly fromBusinessFunction: string;
  readonly toBusinessFunction: string;
  readonly work: string;
  readonly enterprise?: string;
}): DelegationRequest {
  const enterprise =
    input.enterprise
      ? getEnterpriseByIdOrName(
          input.enterprise
        )
      : undefined;
  if (input.enterprise && !enterprise) {
    throw new Error(
      `Enterprise not found: ${input.enterprise}`
    );
  }

  const resolveFunction = (
    reference: string
  ) => {
    if (!enterprise) {
      return getBusinessFunctionDefinitionByIdOrLabel(
        reference
      );
    }
    const normalized =
      reference.trim().toLowerCase();
    return listBusinessFunctionDefinitions()
      .filter(
        (definition) =>
          definition.enterpriseId ===
          enterprise.id
      )
      .find(
        (definition) =>
          definition.id === reference ||
          definition.label.trim().toLowerCase() ===
            normalized
      );
  };

  const from = resolveFunction(input.fromBusinessFunction);
  if (!from) {
    throw new Error(`Delegating Function not found: ${input.fromBusinessFunction}`);
  }

  const to = resolveFunction(input.toBusinessFunction);
  if (!to) {
    throw new Error(`Receiving Function not found: ${input.toBusinessFunction}`);
  }

  if (from.id === to.id) {
    throw new Error("A Function cannot delegate work to itself");
  }

  if (from.enterpriseId !== to.enterpriseId) {
    throw new Error("Cross-Enterprise delegation is not supported by the current CLI");
  }

  if (!to.runtimeId) {
    throw new Error(`Receiving Function has not been started: ${to.label}`);
  }

  const runtime = getBusinessFunction(to.runtimeId);
  if (!runtime || runtime.state !== "running") {
    throw new Error(`Receiving Function is not running: ${to.label}`);
  }

  const route = resolveDelegationRoute(to.id, to.runtimeId);
  const created = createDelegationRequest({
    id: crypto.randomUUID(),
    fromBusinessFunction: from.label,
    toBusinessFunction: to.label,
    work: input.work,
  });

  const job = enqueueJob(input.work, route.workerName, {
    requiredCapabilities: route.capabilities,
    selectedWorker: route.workerName,
    routingReason: `Delegation ${created.id}: ${route.reason}`,
  });
  attachBusinessFunctionJob(to.runtimeId, job.id);

  const requested = saveDelegationRequest(
    startDelegationRequest(
      created,
      job.id,
      route.workerName,
      route.capabilities
    )
  );

  appendRuntimeEventToStore({
    id: crypto.randomUUID(),
    type: "delegation.requested",
    level: "success",
    message: `Delegation requested: ${from.label} delegated Task ${job.id} to ${to.label}`,
    timestamp: Date.now(),
    payload: {
      delegationId: requested.id,
      jobId: job.id,
      fromBusinessFunction: from.label,
      toBusinessFunction: to.label,
      work: input.work,
      ownership: `${from.label} retains accountability`,
    },
  });

  return requested;
}

export function settleDelegationForJob(job: Job): DelegationRequest | undefined {
  const request = listDelegationRequests().find(
    (candidate) => candidate.jobId === job.id
  );

  if (!request || (request.status !== "requested" && request.status !== "in_progress")) {
    return undefined;
  }

  const activeRequest =
    job.worker && !request.workerName
      ? startDelegationRequest(
          request,
          job.id,
          job.worker,
          job.requiredCapabilities ?? request.requiredCapabilities ?? []
        )
      : request;

  const settled = job.status === "completed"
    ? completeDelegationRequest(activeRequest, job.output ?? "", job.completedAt)
    : job.status === "failed"
      ? failDelegationRequest(activeRequest, job.error ?? "Delegated Task failed", job.failedAt)
      : undefined;

  if (!settled) return undefined;
  saveDelegationRequest(settled);
  appendRuntimeEventToStore({
    id: crypto.randomUUID(),
    type: settled.status === "completed" ? "delegation.completed" : "delegation.failed",
    level: settled.status === "completed" ? "success" : "error",
    message: `Delegation ${settled.status}: Task ${job.id} from ${settled.toBusinessFunction} returned to ${settled.fromBusinessFunction}`,
    timestamp: Date.now(),
    payload: {
      delegationId: settled.id,
      jobId: job.id,
      result: settled.result,
      error: settled.error,
      ownership: `${settled.fromBusinessFunction} retains accountability`,
    },
  });
  return settled;
}
