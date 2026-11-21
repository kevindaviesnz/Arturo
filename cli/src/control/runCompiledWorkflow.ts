import { CompiledWorkflow } from "./workflowCompiler";
import { createRun, appendEvent } from "./runStore";
import { Effect } from "../kernel/process";

/**
 * Safe execution engine
 */
export function runCompiledWorkflow(wf: CompiledWorkflow) {
  const run = createRun(wf.name);

  let ctx: any = {};

  for (const step of wf.steps) {
    try {
      const result = step.worker.run(ctx);

      // generator safety loop
      const iter = result as Generator<Effect, any, any>;

      let next = iter.next();

      while (!next.done) {
        const effect = next.value;

        if (isLogEffect(effect)) {
          appendEvent(run, {
            type: "log",
            message: `[${step.name}] ${effect.message}`
          });
        }

        next = iter.next();
      }

    } catch (err: any) {
      appendEvent(run, {
        type: "log",
        message: `ERROR in ${step.name}: ${err.message}`
      });

      // ❗ DO NOT crash pipeline
      continue;
    }
  }

  return run;
}

/**
 * Type guard = fixes TS "{}" inference problem
 */
function isLogEffect(effect: any): effect is { type: "log"; message: string } {
  return (
    effect &&
    typeof effect === "object" &&
    effect.type === "log" &&
    typeof effect.message === "string"
  );
}