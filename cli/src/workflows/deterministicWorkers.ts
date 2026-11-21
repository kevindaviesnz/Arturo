export type WorkflowContext = {
  goal: string;

  plan?: string[];

  result?: string;

  approved?: boolean;
};

export type DeterministicWorker = {
  name: string;

  run: (
    ctx: WorkflowContext
  ) => WorkflowContext;
};

export const plannerWorker: DeterministicWorker = {
  name: "planner",

  run(ctx) {
    return {
      ...ctx,

      plan: [
        "extract key ideas",
        "generate concise summary",
      ],
    };
  },
};

export const executorWorker: DeterministicWorker = {
  name: "executor",

  run(ctx) {
    return {
      ...ctx,

      result:
        "Deterministic summary generated successfully.",
    };
  },
};

export const reviewerWorker: DeterministicWorker = {
  name: "reviewer",

  run(ctx) {
    return {
      ...ctx,

      approved:
        !!ctx.result &&
        ctx.result.length > 0,
    };
  },
};