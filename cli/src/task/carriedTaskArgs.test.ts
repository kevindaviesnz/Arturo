import { describe, expect, it } from "vitest";
import type { BusinessFunctionDefinition } from "../business/businessFunctionDefinition";
import type { Job } from "../runtime/jobQueue";
import { refuseFollowUpWork } from "../runtime/businessFunctionRuntimeOutcome";
import { passOnTargetFor, routeFor } from "../runtime/resultPassOn";
import { carriedTaskArgs } from "./carriedTaskArgs";
import { buildTaskRetry } from "./taskRetry";

const job = (over: Partial<Job> = {}): Job => ({
  id: "task-1", task: "Draft the German rights offer.", status: "failed", createdAt: 1, worker: "Drafting AI worker",
  requestedBy: "Amy Wise", clientId: "client-1", workId: "work-a", businessFunctionId: "harbour-legal:drafting", ...over,
} as Job);

describe("the arguments a rebuilt Task carries", () => {
  it("carries who asked, the client and the named work", () => {
    expect(carriedTaskArgs(job())).toEqual(["--asked-by", "Amy Wise", "--client", "client-1", "--work", "work-a"]);
    expect(carriedTaskArgs(job({ requestedBy: undefined, clientId: undefined, workId: undefined }))).toEqual([]);
  });

  it("each rebuilt task keeps its workId: retry", () => {
    const retry = buildTaskRetry(job(), "task-1", { functionLabel: "Drafting", enterpriseName: "Harbour Legal" });
    expect(retry.retry).toBe(true);
    if (!retry.retry) return;
    expect(retry.createArgs.join(" ")).toContain("--work work-a");
  });

  it("each rebuilt task keeps its workId: pass-on and routes are off for named work, so nothing is rebuilt without it", () => {
    const completed = job({ status: "completed", output: "An offer." });
    expect(passOnTargetFor(completed)).toBeUndefined();
    expect(routeFor(completed)).toBeUndefined();
  });

  it("follow-on is not created for a work-bound job", () => {
    const definition = { id: "harbour-legal:drafting", enterpriseId: "harbour-legal", label: "Drafting" } as BusinessFunctionDefinition;
    expect(refuseFollowUpWork(definition, "Send the offer on.", [], job())).toContain("never continued automatically");
  });
});
