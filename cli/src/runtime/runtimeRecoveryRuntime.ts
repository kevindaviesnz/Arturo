import {
  loadCronJobs,
} from "../storage/cronJobRepository";

import {
  loadScheduledJobs,
} from "../storage/scheduledJobRepository";

import {
  loadDeadLetterQueue,
} from "../storage/deadLetterQueueRepository";

import {
  replayHistoricalRuntimeState,
} from "./runtimeHistoricalReplay";

export function recoverRuntimeState() {
  return {
    scheduledJobs:
      loadScheduledJobs(),
    cronJobs:
      loadCronJobs(),
    deadLetterQueue:
      loadDeadLetterQueue(),
    historicalState:
      replayHistoricalRuntimeState(),
  };
}