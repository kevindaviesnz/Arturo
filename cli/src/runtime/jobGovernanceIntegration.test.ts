import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPolicyRules, savePolicyRules } from "../storage/policyRepository";
import { clearJobs, enqueueJob, getJob, requestJobApproval } from "./jobQueue";
import { clearApprovalChains, getApprovalChain } from "./approvalChainStore";
import { processNextQueuedJob, recoverAwaitingApprovalChains } from "./workerRuntime";
import { clearRuntimeEventLog } from "../storage/runtimeEventRepository";
import { handleApproveCommand, handleRejectCommand } from "../repl/approvalCommands";
import { addWorker, clearWorkers, createHumanWorker } from "../control/workers";

describe("Job governance integration", () => {
  beforeEach(() => {
    clearJobs(); clearApprovalChains(); clearPolicyRules(); clearRuntimeEventLog(); clearWorkers();
    addWorker(createHumanWorker("Kevin", "guardian"));
  });
  afterEach(() => { clearJobs(); clearApprovalChains(); clearPolicyRules(); clearRuntimeEventLog(); clearWorkers(); });

  it("fails a Job before execution when a matching policy denies it", async () => {
    savePolicyRules([{
      id: "deny-safety",
      description: "Deny safety work",
      effect: "deny",
      match: { capabilityId: "safety" },
      scope: { type: "global", id: "global" },
    }]);
    const job = enqueueJob("Release toy", undefined, { requiredCapabilities: ["safety"] });
    const result = await processNextQueuedJob(() => undefined);
    expect(result?.status).toBe("failed");
    expect(getJob(job.id)?.error).toContain("Governance denied capability safety");
  });

  it("creates an approval gate before executing a governed Job", async () => {
    savePolicyRules([{
      id: "approve-safety",
      description: "Review safety work",
      effect: "require-approval",
      match: { capabilityId: "safety" },
      scope: { type: "global", id: "global" },
    }]);
    const job = enqueueJob("Release toy", undefined, { requiredCapabilities: ["safety"] });
    expect(await processNextQueuedJob(() => undefined)).toBeUndefined();
    expect(getApprovalChain(job.id)?.status).toBe("pending");
    expect(getJob(job.id)?.status).toBe("awaiting_approval");

    vi.spyOn(console, "log").mockImplementation(() => undefined);
    handleApproveCommand([job.id]);
    expect(getApprovalChain(job.id)?.status).toBe("approved");
    expect(getApprovalChain(job.id)?.decisions[0].worker).toBe("Kevin");
    expect(getJob(job.id)?.status).toBe("queued");
  });

  it("fails a governed Job when its approval is rejected", async () => {
    savePolicyRules([{
      id: "approve-safety",
      description: "Review safety work",
      effect: "require-approval",
      match: { capabilityId: "safety" },
      scope: { type: "global", id: "global" },
    }]);
    const job = enqueueJob("Release toy", undefined, { requiredCapabilities: ["safety"] });
    await processNextQueuedJob(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    handleRejectCommand([job.id, "Evidence is incomplete"]);
    expect(getApprovalChain(job.id)?.status).toBe("rejected");
    expect(getApprovalChain(job.id)?.decisions[0].worker).toBe("Kevin");
    expect(getJob(job.id)?.status).toBe("failed");
    expect(getJob(job.id)?.error).toContain("Evidence is incomplete");
  });

  it("recovers an awaiting approval chain after local state reload", async () => {
    savePolicyRules([{
      id: "approve-safety",
      description: "Review safety work",
      effect: "require-approval",
      match: { capabilityId: "safety" },
      scope: { type: "global", id: "global" },
    }]);
    const job = enqueueJob("Release toy", undefined, { requiredCapabilities: ["safety"] });
    await processNextQueuedJob(() => undefined);
    clearApprovalChains();
    expect(recoverAwaitingApprovalChains()).toBe(1);
    expect(getApprovalChain(job.id)?.status).toBe("pending");
  });

  it("repairs legacy capability jobs incorrectly routed to a human", async () => {
    addWorker({
      name: "Toy Safety Worker",
      kind: "ai",
      archetype: "guardian",
      capabilities: ["safety"],
      run: function* (input: unknown) { return input; },
    });
    savePolicyRules([{
      id: "approve-safety",
      description: "Review safety work",
      effect: "require-approval",
      match: { capabilityId: "safety" },
      scope: { type: "global", id: "global" },
    }]);
    const job = enqueueJob("Review safety", "Kevin", {
      requiredCapabilities: ["safety"],
      selectedWorker: "Kevin",
      routingReason: "Selected first worker matching: safety",
    });

    expect(await processNextQueuedJob(() => undefined)).toBeUndefined();
    expect(getJob(job.id)).toMatchObject({
      worker: "Toy Safety Worker",
      selectedWorker: "Toy Safety Worker",
      status: "awaiting_approval",
    });
  });

  it("repairs persisted human routing before displaying an awaiting approval", () => {
    addWorker({
      name: "Toy Safety Worker",
      kind: "ai",
      archetype: "guardian",
      capabilities: ["safety"],
      run: function* (input: unknown) { return input; },
    });
    const job = enqueueJob("Review safety", "Kevin", {
      requiredCapabilities: ["safety"],
      selectedWorker: "Kevin",
    });
    requestJobApproval(job.id);

    expect(recoverAwaitingApprovalChains()).toBe(1);
    expect(getJob(job.id)).toMatchObject({
      worker: "Toy Safety Worker",
      selectedWorker: "Toy Safety Worker",
      status: "awaiting_approval",
    });
  });
});
