import {
  listBusinessFunctions,
} from "../business/businessFunctionRuntimeStore";
import {
  listJobs,
} from "./jobQueue";
import {
  measureRuntimeJobOutcome,
  type RuntimeOutcomeReasoner,
} from "./businessFunctionRuntimeOutcome";

let coordinatorStarted = false;
let coordinatorBusy = false;

/** Measures terminal Runtime Jobs, including work completed outside AI Workers. */
export async function runBusinessFunctionRuntimeCycle(
  reasoner?: RuntimeOutcomeReasoner
): Promise<void> {
  if (coordinatorBusy) {
    return;
  }

  coordinatorBusy = true;
  try {
    const terminalJobs = new Set(
      listBusinessFunctions()
        .filter((runtime) => runtime.state === "running")
        .flatMap((runtime) => runtime.jobIds)
    );

    for (const job of listJobs()) {
      if (
        terminalJobs.has(job.id) &&
        (
          job.status === "completed" ||
          job.status === "failed"
        )
      ) {
        await measureRuntimeJobOutcome(
          job,
          reasoner
        );
      }
    }
  } finally {
    coordinatorBusy = false;
  }
}

/** Starts the enduring Runtime outcome-and-learning cycle once per process. */
export function startBusinessFunctionRuntimeCoordinator(): void {
  if (coordinatorStarted) {
    return;
  }

  coordinatorStarted = true;
  setInterval(
    () => {
      void runBusinessFunctionRuntimeCycle();
    },
    1000
  );
}
