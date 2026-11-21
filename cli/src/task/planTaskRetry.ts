import { getBusinessFunctionDefinition } from "../business/businessFunctionDefinitionStore";
import { getEnterprise } from "../enterprise/enterpriseStore";
import { getJob } from "../runtime/jobQueue";
import { resolveJobEnterpriseId } from "../runtime/jobOrganisation";
import { buildTaskRetry, type TaskRetry } from "./taskRetry";

/**
 * The retry plan for a Task named by id, as `/task retry` and the overview's
 * "Try again" both build it.
 *
 * SIDE EFFECT: Reads Task, Function and Enterprise state.
 */
export function planTaskRetry(taskId: string): TaskRetry {
  const job = getJob(taskId);
  const enterpriseId = job ? resolveJobEnterpriseId(job) : undefined;
  return buildTaskRetry(job, taskId, {
    functionLabel: job?.businessFunctionId ? getBusinessFunctionDefinition(job.businessFunctionId)?.label : undefined,
    enterpriseName: enterpriseId ? getEnterprise(enterpriseId)?.name : undefined,
  });
}
