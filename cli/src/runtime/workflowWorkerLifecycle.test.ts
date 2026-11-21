import { clearBusinessFunctionDefinitions, createAndSaveBusinessFunctionDefinition } from "../business/businessFunctionDefinitionStore";
import { clearStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { addEventSchedule, clearEventSchedules, getEventSchedule } from "../scheduling/eventScheduleStore";
import { runDueEventSchedules } from "../scheduling/eventScheduleRuntime";
import { clearEnterprises, createAndSaveEnterprise } from "../enterprise/enterpriseStore";
import { assignWorkerOwnership } from "../identity/organisationIdentity";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerWorkflowWorker, setWorkerAvailability, clearWorkers, addWorker } from "../control/workers";
import { loadWorkers } from "../storage/workerRepository";
import { clearJobs, enqueueJob, enqueueScheduledJob, getJob } from "./jobQueue";
import { clearPolicyRules } from "../storage/policyRepository";
import { clearApprovalChains, storeApprovalChain } from "./approvalChainStore";
import { processNextQueuedJob } from "./workerRuntime";
import { executeWorkerJob } from "./taskExecutor";
import { generateWithOllama } from "../llm/ollamaClient";
vi.mock("../llm/ollamaClient", () => ({ generateWithOllama: vi.fn() }));
const definition = { version: 1 as const, steps: [{ operation: "template" as const, template: "Result: {{input}}" }] };
beforeEach(() => { clearEventSchedules(); clearStaffingAssignments(); clearBusinessFunctionDefinitions(); clearEnterprises(); clearWorkers(); clearJobs(); clearPolicyRules(); clearApprovalChains(); vi.clearAllMocks(); });
describe("Workflow Worker lifecycle", () => {
  it("restores executable definitions and pauses/resumes queue dispatch", async () => {
    registerWorkflowWorker("format", definition);
    const restored = loadWorkers().find(worker => worker.name === "format")!;
    expect(restored.workflowDefinition).toEqual(definition);
    addWorker(restored);
    setWorkerAvailability("format", "offline");
    const job = enqueueJob("source", "format", { requiredCapabilities: ["conversion"] });
    expect(await processNextQueuedJob()).toBeUndefined();
    expect(getJob(job.id)?.status).toBe("queued");
    setWorkerAvailability("format", "available");
    await processNextQueuedJob();
    expect(getJob(job.id)?.status).toBe("completed");
    expect(getJob(job.id)?.rawOutput).toBe("Result: source");
    expect(generateWithOllama).not.toHaveBeenCalled();
  });
  it("uses the normal approval gate before executing a workflow", async () => {
    registerWorkflowWorker("format", definition);
    const job = enqueueJob("source", "format", { requiredCapabilities: ["conversion"], requiredApprovals: 1 });
    storeApprovalChain({ jobId: job.id, requiredApprovals: 1, decisions: [], status: "pending" });
    expect(await processNextQueuedJob()).toBeUndefined();
    expect(getJob(job.id)?.rawOutput).toBeUndefined();
  });
  it("rejects dispatch of an owned Worker with ambiguous Enterprise scope", async () => {
    registerWorkflowWorker("owned", definition);
    const enterprise = createAndSaveEnterprise({ name: "Workflow ownership test" });
    createAndSaveEnterprise({ name: "Another Enterprise" });
    assignWorkerOwnership({ workerName: "owned", enterpriseId: enterprise.id });
    const job = enqueueJob("source", "owned", { requiredCapabilities: ["conversion"] });
    await processNextQueuedJob();
    expect(getJob(job.id)?.status).toBe("failed");
    expect(getJob(job.id)?.rawOutput).toBeUndefined();
  });
  it("honours cancellation before performing deterministic work", async () => {
    registerWorkflowWorker("format", definition);
    const job = enqueueJob("source", "format", { requiredCapabilities: ["conversion"] });
    const controller = new AbortController(); controller.abort();
    await executeWorkerJob(job, "unused", { abortSignal: controller.signal });
    expect(getJob(job.id)?.rawOutput).toBeUndefined();
    expect(getJob(job.id)?.status).not.toBe("completed");
  });
});

it("schedules staffed workflow work with the same availability, ownership and execution semantics", async () => {
 const enterprise=createAndSaveEnterprise({name:"Practice"});
 const fn=createAndSaveBusinessFunctionDefinition({id:`${enterprise.id}:format`,enterpriseId:enterprise.id,label:"Matter formatting"});
 registerWorkflowWorker("scheduled-formatter",definition);
 assignWorkerOwnership({workerName:"scheduled-formatter",enterpriseId:enterprise.id});
 saveStaffingAssignment({businessFunctionId:fn.id,workerName:"scheduled-formatter",role:"ai",rationale:"Deterministic conversion"});
 const task=enqueueScheduledJob("Matter 12",{owningJobId:fn.id,enterpriseId:enterprise.id,requiredCapabilities:["conversion"]});
 const schedule=addEventSchedule({id:"workflow-schedule",enterpriseId:enterprise.id,owningJobId:fn.id,taskId:task.id,taskLabel:task.task,every:"friday",at:"18:00",timezone:"Pacific/Auckland",now:Date.parse("2026-07-18T00:00:00.000Z")});
 setWorkerAvailability("scheduled-formatter","busy");
 expect((await runDueEventSchedules(schedule.nextRunAt))[0].status).toBe("skipped");
 expect(getJob(task.id)?.status).toBe("scheduled");
 setWorkerAvailability("scheduled-formatter","available");
 await runDueEventSchedules(getEventSchedule(schedule.id)!.nextRunAt);
 expect(getJob(task.id)).toMatchObject({status:"queued",worker:"scheduled-formatter"});
 await processNextQueuedJob();
 expect(getJob(task.id)).toMatchObject({status:"completed",rawOutput:"Result: Matter 12"});
 expect(generateWithOllama).not.toHaveBeenCalled();
});
