import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: string[] = [];
vi.mock("../llm/llmClient", () => ({
  generateWithConfiguredLlm: vi.fn(async (request: { prompt: string }) => {
    sent.push(request.prompt);
    return {
      response: JSON.stringify({
        health: "healthy",
        objectiveProgress: "Advanced.",
        lesson: "A lesson.",
        shouldCreateFollowUpJob: false,
      }),
    };
  }),
  generateWithPaidEscalation: vi.fn(),
  resolveConfiguredProvider: () => ({ provider: "ollama", routingMode: "single" }),
}));

import { OUTCOME_WITHHELD, reasonAboutRuntimeJobOutcome } from "./businessFunctionRuntimeOutcome";
import { clearJobs, completeJob, enqueueJob } from "./jobQueue";
import { clearProviderSends, listProviderSends } from "./providerSendLog";

beforeEach(() => {
  sent.length = 0;
  clearJobs();
  clearProviderSends();
});

describe("the outcome assessment (C1)", () => {
  it("never sends the result's text, and logs its call before making it", async () => {
    const job = completeJob(enqueueJob("Assess the failed test.", "safety-specialist").id, "SECRET RESULT TEXT", "SECRET RESULT TEXT");
    const definition = { id: "e:safety", label: "Product Safety", successCriteria: [] } as never;
    const runtime = { objective: "Ensure every toy is safe.", refinements: [] } as never;

    await reasonAboutRuntimeJobOutcome(definition, runtime, job);

    expect(sent).toHaveLength(1);
    expect(sent[0]).not.toContain("SECRET RESULT TEXT");
    expect(sent[0]).toContain(OUTCOME_WITHHELD);
    expect(sent[0]).toContain("Assess the failed test.");
    expect(listProviderSends(job.id)).toMatchObject([{ jobId: job.id, purpose: "outcome-assessment", call: 1, repeat: false, provider: "ollama" }]);
  });
});
