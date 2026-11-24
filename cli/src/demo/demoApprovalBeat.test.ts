import { beforeAll, describe, expect, it, vi } from "vitest";
import { seedDemoEnterprise } from "./seedDemo";
import { DEMO_GOVERNED_FUNCTION } from "./demoScript";
import { handleUiCommand } from "../ui/uiCommandHandlers";
import { getJob, listJobs, replaceJob } from "../runtime/jobQueue";
import { getApprovalChain } from "../runtime/approvalChainStore";
import { readResultSignOffStanding } from "../runtime/resultSignOff";
import { processNextQueuedJob } from "../runtime/workerRuntime";
import { generateWithOllama } from "../llm/ollamaClient";

// The model's words are not under test; what the runtime does around them is.
// The first review names two of the agreement's eleven clauses, as real local
// models did; asked about a single clause, the stub answers about that clause.
vi.mock("../llm/ollamaClient", () => ({
  generateWithOllama: vi.fn(async (...request: unknown[]) => ({
    response: JSON.stringify(request).includes("one clause of a supplied document on its own")
      ? "Verdict: ONE-SIDED\nFavours: the Supplier\nThis term should be negotiated. Assumption: New Zealand law governs. A lawyer must verify it."
      : "Clause 4 (Liability): the cap needs negotiation.\nClause 9 (Termination): the notice periods need negotiation.\nAssumption: New Zealand law governs. A lawyer must verify both.",
  })),
}));

/** One call for the review, then one for each of the agreement's eleven clauses. */
const MODEL_CALLS_FOR_ONE_RUN = 12;

/**
 * The seed can only promise a Task that *will* be held. This drives the Worker
 * runtime over the seeded company to prove the moment the demonstration is
 * built around: work stops for the principal and only the principal can release
 * it.
 */
describe("seeded demonstration approval beat", () => {
  let taskId: string;

  beforeAll(async () => {
    await seedDemoEnterprise(() => undefined);
    taskId = listJobs()[0].id;
  });

  it("holds the Task for the principal instead of running it", async () => {
    await processNextQueuedJob(() => undefined);

    expect(getJob(taskId)?.status).toBe("awaiting_approval");
    expect(getApprovalChain(taskId)?.status).toBe("pending");
    const [approvals] = await handleUiCommand("/approvals", []);
    expect(approvals.body).toContain(taskId);
    expect(DEMO_GOVERNED_FUNCTION).toBeTruthy();
  });

  it("refuses a decision from an AI Worker staffed to the same Function", async () => {
    await handleUiCommand("/approve", [taskId, "--as", "Advice Drafter"]);

    expect(getJob(taskId)?.status).toBe("awaiting_approval");
    expect(getApprovalChain(taskId)?.decisions).toHaveLength(0);

    // Nor can a result that does not exist yet be signed off.
    const [early] = await handleUiCommand("/task", ["signoff", taskId, "--as", "Principal Lawyer"]);
    expect(early.body).toContain("has not finished, so there is no result to sign off yet");
  });

  it("releases and completes the Task once the principal approves", async () => {
    await handleUiCommand("/approve", [taskId, "--as", "Principal Lawyer"]);

    expect(getApprovalChain(taskId)?.status).toBe("approved");
    expect(getApprovalChain(taskId)?.decisions.map((decision) => decision.worker)).toEqual(["Principal Lawyer"]);
    // What was approved is that the work may start. Nobody had seen a result.
    expect(getApprovalChain(taskId)?.decisions.map((decision) => decision.kind)).toEqual(["release"]);

    await processNextQueuedJob(() => undefined);

    expect(getJob(taskId)?.status).toBe("completed");
    // The Worker was handed the agreement itself. Without it, a real model
    // graded a review that did not exist.
    expect(JSON.stringify(vi.mocked(generateWithOllama).mock.calls[0])).toContain(
      "Kauri Street Bakery Limited"
    );
    expect(listJobs().filter((job) => job.status === "completed")).toHaveLength(1);
  });

  it("tells whoever reads the result that a model wrote it unchecked", async () => {
    const [details] = await handleUiCommand("/task", ["inspect", taskId]);

    expect(details.body).toContain("Checked: Written by an AI model. Nobody has checked it.");
    expect(details.body).toContain("Clause 4 (Liability): the cap needs negotiation.");
    expect(details.body).not.toContain("UNVERIFIED MODEL SYNTHESIS");
    expect(details.body).toContain(
      "Decision: Principal Lawyer released the work to run; not a sign-off of the result"
    );
  });

  it("lets the principal sign the finished result off, separately from the go-ahead", async () => {
    const before = (await handleUiCommand("/task", ["inspect", taskId]))[0].body;
    expect(before).toContain(`Sign-off: Nobody has signed off this result. Once you have read it and accept it: /task signoff ${taskId}`);

    // Only someone who could approve may sign, and a refusal records nothing.
    const [stranger] = await handleUiCommand("/task", ["signoff", taskId, "--as", "Contract Reviewer"]);
    expect(stranger.label).toBe("Result not signed off");
    expect(stranger.body).toContain("only a Human can sign off work and give go-aheads");
    expect(readResultSignOffStanding(getJob(taskId)!).state).toBe("none");

    const [signed] = await handleUiCommand("/task", ["signoff", taskId, "--as", "Principal Lawyer"]);
    expect(signed.label).toBe("Result signed off");
    expect(signed.body).toContain("Signed off by: Principal Lawyer");
    expect(signed.body).toContain("It does not prove the result is correct.");

    const after = (await handleUiCommand("/task", ["inspect", taskId]))[0].body;
    expect(after).toContain("Decision: Principal Lawyer released the work to run; not a sign-off of the result");
    expect(after).toContain("Sign-off: Principal Lawyer signed off this result on ");
    expect(after).toContain("Checked: Written by an AI model.\n");
    expect(after).not.toContain("Nobody has checked it.");
    // The go-ahead is still the only approval decision on record.
    expect(getApprovalChain(taskId)?.decisions).toHaveLength(1);

    const [again] = await handleUiCommand("/task", ["signoff", taskId, "--as", "Principal Lawyer"]);
    expect(again.label).toBe("Result not signed off");
    expect(again.body).toContain("was already signed off by Principal Lawyer");
  });

  it("puts every clause to the Worker on its own, and says which the review passed over", async () => {
    const [details] = await handleUiCommand("/task", ["inspect", taskId]);

    expect(details.body).toContain(
      "Arturo put each of the document's clauses to the Worker on its own; those answers are at the end. The first review did not address clauses 1 (Services), 2 (Term), 3 (Fees), 5 (Intellectual property), 6 (Changes), 7 (Delay), 8 (Payment default), 10 (Disputes), 11 (Governing law) by number and name."
    );
    expect(details.body).toContain("Clause 5 (Intellectual property)");
    expect(details.body).toContain(
      "One-sided: 1 (Services), 2 (Term), 3 (Fees), 4 (Liability), 5 (Intellectual property), 6 (Changes), 7 (Delay), 8 (Payment default), 9 (Termination), 10 (Disputes), 11 (Governing law)."
    );
    expect(details.body).toContain("- Clause 8 (Payment default): one-sided, favours the Supplier");
    expect(details.body).not.toContain("Coverage check:");

    // Each was asked about its own text and nothing else, including the two
    // clauses the first review had already named.
    const clauseQuestions = vi.mocked(generateWithOllama).mock.calls
      .map((call) => JSON.stringify(call))
      .filter((prompt) => prompt.includes("one clause of a supplied document on its own"));
    expect(clauseQuestions).toHaveLength(MODEL_CALLS_FOR_ONE_RUN - 1);
    expect(clauseQuestions.some((prompt) => prompt.includes("Clause 8: 8. Payment default. Overdue amounts bear interest at 5% per month."))).toBe(true);
    expect(clauseQuestions.some((prompt) => prompt.includes("Clause 4: 4. Liability."))).toBe(true);
    expect(clauseQuestions.filter((prompt) => prompt.includes("NZ$500"))).toHaveLength(1);
    // And each was told who the parties are.
    expect(clauseQuestions.every((prompt) => prompt.includes("Kauri Street Bakery Limited"))).toBe(true);
  });

  it("does not run the work again when the same approval is repeated", async () => {
    await handleUiCommand("/approve", [taskId, "--as", "Principal Lawyer"]);
    await processNextQueuedJob(() => undefined);

    expect(getJob(taskId)?.status).toBe("completed");
    expect(vi.mocked(generateWithOllama)).toHaveBeenCalledTimes(MODEL_CALLS_FOR_ONE_RUN);
  });

  it("creates a failed Task again in one command, held for a fresh approval", async () => {
    const [refused] = await handleUiCommand("/task", ["retry", taskId]);
    expect(refused.body).toContain("did not fail, so there is nothing to retry");

    // Stand-in for the model being unreachable: the first run's failure.
    const original = getJob(taskId)!;
    replaceJob({ ...original, status: "failed", error: "Arturo could not reach the local AI model." });

    const entries = await handleUiCommand("/task", ["retry", taskId]);
    expect(entries[0].body).toContain(`any approval given to ${taskId} does not carry over`);

    const retried = listJobs().find((job) => job.id !== taskId)!;
    expect(retried.task).toBe(original.task);
    expect(retried.inputArtefactRefs).toEqual(original.inputArtefactRefs);
    expect(retried.businessFunctionId).toBe(original.businessFunctionId);
    expect(retried.status).toBe("queued");

    await processNextQueuedJob(() => undefined);
    expect(getJob(retried.id)?.status).toBe("awaiting_approval");
    expect(getApprovalChain(retried.id)?.decisions).toHaveLength(0);
  });
});

