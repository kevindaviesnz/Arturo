import type {
  RuntimeEventRecord,
} from "./runtimeEventLog";

export type HistoricalPolicyEffect =
  | "allow"
  | "deny"
  | "require-approval";

export type HistoricalPolicyEvaluation = {
  id: string;
  capabilityId: string;
  riskLevel: string;
  role?: string;
  effect: HistoricalPolicyEffect;
  matchedRuleId?: string;
  lastEventSequence: number;
};

export type HistoricalScheduledJobStatus =
  | "queued"
  | "dispatched"
  | "retry-scheduled"
  | "dead-lettered";

export type HistoricalJobStatus =
  | "queued"
  | "started"
  | "completed"
  | "failed";

export type HistoricalApprovalStatus =
  | "requested"
  | "approved"
  | "rejected";

export type HistoricalWorkflowStatus =
  | "started"
  | "completed"
  | "failed";

export type HistoricalNotificationLevel =
  | "info"
  | "success"
  | "warn"
  | "error";

export type HistoricalCronJobStatus =
  | "scheduled"
  | "advanced";

export type HistoricalJob = {
  id: string;
  status: HistoricalJobStatus;
  lastEventSequence: number;
};

export type HistoricalApproval = {
  jobId: string;
  status: HistoricalApprovalStatus;
  lastEventSequence: number;
};

export type HistoricalWorkflow = {
  id: string;
  status: HistoricalWorkflowStatus;
  lastEventSequence: number;
};

export type HistoricalNotification = {
  id: string;
  level: HistoricalNotificationLevel;
  message: string;
  lastEventSequence: number;
};

export type HistoricalScheduledJob = {
  id: string;
  workflowId: string;
  status: HistoricalScheduledJobStatus;
  lastEventSequence: number;
};

export type HistoricalCronJob = {
  id: string;
  status: HistoricalCronJobStatus;
  lastEventSequence: number;
};

export type HistoricalRuntimeState = {
  jobs: Record<string, HistoricalJob>;
  approvals: Record<string, HistoricalApproval>;
  workflows: Record<string, HistoricalWorkflow>;
  notifications: Record<string, HistoricalNotification>;
  scheduledJobs: Record<string, HistoricalScheduledJob>;
  cronJobs: Record<string, HistoricalCronJob>;
  policyEvaluations: Record<string, HistoricalPolicyEvaluation>;
  eventCount: number;
};

/**
 * Creates empty historical runtime state.
 *
 * @returns Empty historical runtime state.
 *
 * PURE: No side effects.
 */
export function createEmptyHistoricalRuntimeState():
  HistoricalRuntimeState {
  return {
    jobs: {},
    approvals: {},
    workflows: {},
    notifications: {},
    scheduledJobs: {},
    cronJobs: {},
    policyEvaluations: {},
    eventCount: 0,
  };
}

/**
 * Extracts string payload field from runtime event.
 *
 * @param event Runtime event record.
 * @param key Payload field key.
 * @returns Payload string value or undefined.
 *
 * PURE: No side effects.
 */
export function getStringPayloadField(
  event: RuntimeEventRecord,
  key: string
): string | undefined {
  const payload =
    event.payload as
      | Record<string, unknown>
      | undefined;

  const value =
    payload?.[key];

  return typeof value === "string"
    ? value
    : undefined;
}

/**
 * Extracts an id from a runtime event message.
 *
 * @param event Runtime event record.
 * @param pattern Regular expression with the id in capture group 1.
 * @returns Extracted id or undefined.
 *
 * PURE: No side effects.
 */
export function getIdFromMessage(
  event: RuntimeEventRecord,
  pattern: RegExp
): string | undefined {
  const match =
    event.message.match(
      pattern
    );

  return match?.[1];
}

/**
 * Resolves historical policy effect from runtime event.
 *
 * @param event Runtime event record.
 * @returns Historical policy effect or undefined.
 *
 * PURE: No side effects.
 */
export function getHistoricalPolicyEffect(
  event: RuntimeEventRecord
): HistoricalPolicyEffect | undefined {
  const effect =
    getStringPayloadField(
      event,
      "effect"
    );

  if (
    effect === "allow" ||
    effect === "deny" ||
    effect === "require-approval"
  ) {
    return effect;
  }

  return undefined;
}

/**
 * Resolves historical job status from event type.
 *
 * @param eventType Runtime event type.
 * @returns Historical job status or undefined.
 *
 * PURE: No side effects.
 */
export function getHistoricalJobStatus(
  eventType: string
): HistoricalJobStatus | undefined {
  if (eventType === "job.queued") {
    return "queued";
  }

  if (eventType === "job.started") {
    return "started";
  }

  if (eventType === "job.completed") {
    return "completed";
  }

  if (eventType === "job.failed") {
    return "failed";
  }

  return undefined;
}

/**
 * Resolves historical approval status from event type.
 *
 * @param eventType Runtime event type.
 * @returns Historical approval status or undefined.
 *
 * PURE: No side effects.
 */
export function getHistoricalApprovalStatus(
  eventType: string
): HistoricalApprovalStatus | undefined {
  if (eventType === "approval.requested") {
    return "requested";
  }

  if (eventType === "approval.approved") {
    return "approved";
  }

  if (eventType === "approval.rejected") {
    return "rejected";
  }

  return undefined;
}

/**
 * Resolves historical workflow status from event type.
 *
 * @param eventType Runtime event type.
 * @returns Historical workflow status or undefined.
 *
 * PURE: No side effects.
 */
export function getHistoricalWorkflowStatus(
  eventType: string
): HistoricalWorkflowStatus | undefined {
  if (eventType === "workflow.started") {
    return "started";
  }

  if (eventType === "workflow.completed") {
    return "completed";
  }

  if (eventType === "workflow.failed") {
    return "failed";
  }

  return undefined;
}

/**
 * Resolves historical scheduled job status from event type.
 *
 * @param eventType Runtime event type.
 * @returns Historical scheduled job status or undefined.
 *
 * PURE: No side effects.
 */
export function getHistoricalScheduledJobStatus(
  eventType: string
):
  | HistoricalScheduledJobStatus
  | undefined {
  if (
    eventType ===
    "scheduled-job.queued"
  ) {
    return "queued";
  }

  if (
    eventType ===
    "scheduled-job.dispatched"
  ) {
    return "dispatched";
  }

  if (
    eventType ===
    "scheduled-job.retry-scheduled"
  ) {
    return "retry-scheduled";
  }

  if (
    eventType ===
    "scheduled-job.dead-lettered"
  ) {
    return "dead-lettered";
  }

  return undefined;
}

/**
 * Resolves historical cron job status from event type.
 *
 * @param eventType Runtime event type.
 * @returns Historical cron job status or undefined.
 *
 * PURE: No side effects.
 */
export function getHistoricalCronJobStatus(
  eventType: string
): HistoricalCronJobStatus | undefined {
  if (
    eventType ===
    "cron-job.scheduled"
  ) {
    return "scheduled";
  }

  if (
    eventType ===
    "cron-job.advanced"
  ) {
    return "advanced";
  }

  return undefined;
}

/**
 * Applies job event to historical state.
 *
 * @param state Historical runtime state.
 * @param event Runtime event record.
 * @returns Updated historical runtime state.
 *
 * PURE: No side effects.
 */
export function applyHistoricalJobEvent(
  state: HistoricalRuntimeState,
  event: RuntimeEventRecord
): HistoricalRuntimeState {
  const status =
    getHistoricalJobStatus(
      event.type
    );

  const jobId =
    getStringPayloadField(
      event,
      "jobId"
    ) ??
    getIdFromMessage(
      event,
      /Job (?:queued|started|completed|failed): ([0-9a-f-]{36})/
    );

  if (!status || !jobId) {
    return state;
  }

  return {
    ...state,
    jobs: {
      ...state.jobs,
      [jobId]: {
        id: jobId,
        status,
        lastEventSequence:
          event.sequence,
      },
    },
  };
}

/**
 * Applies approval event to historical state.
 *
 * @param state Historical runtime state.
 * @param event Runtime event record.
 * @returns Updated historical runtime state.
 *
 * PURE: No side effects.
 */
export function applyHistoricalApprovalEvent(
  state: HistoricalRuntimeState,
  event: RuntimeEventRecord
): HistoricalRuntimeState {
  const status =
    getHistoricalApprovalStatus(
      event.type
    );

  const jobId =
    getStringPayloadField(
      event,
      "jobId"
    );

  if (!status || !jobId) {
    return state;
  }

  return {
    ...state,
    approvals: {
      ...state.approvals,
      [jobId]: {
        jobId,
        status,
        lastEventSequence:
          event.sequence,
      },
    },
  };
}

/**
 * Applies workflow event to historical state.
 *
 * @param state Historical runtime state.
 * @param event Runtime event record.
 * @returns Updated historical runtime state.
 *
 * PURE: No side effects.
 */
export function applyHistoricalWorkflowEvent(
  state: HistoricalRuntimeState,
  event: RuntimeEventRecord
): HistoricalRuntimeState {
  const explicitStatus =
    getHistoricalWorkflowStatus(
      event.type
    );

  const inferredStatus =
    event.type ===
    "workflow.created"
      ? "started"
      : event.type ===
          "workflow.step.awaiting_review"
        ? "started"
        : undefined;

  const status =
    explicitStatus ??
    inferredStatus;

  const workflowId =
    getStringPayloadField(
      event,
      "workflowId"
    ) ??
    getIdFromMessage(
      event,
      /Workflow created: ([^\s]+)/
    );

  if (!status || !workflowId) {
    return state;
  }

  return {
    ...state,
    workflows: {
      ...state.workflows,
      [workflowId]: {
        id: workflowId,
        status,
        lastEventSequence:
          event.sequence,
      },
    },
  };
}

/**
 * Applies notification-like event to historical state.
 *
 * @param state Historical runtime state.
 * @param event Runtime event record.
 * @returns Updated historical runtime state.
 *
 * PURE: No side effects.
 */
export function applyHistoricalNotificationEvent(
  state: HistoricalRuntimeState,
  event: RuntimeEventRecord
): HistoricalRuntimeState {
  if (
    !event.type.startsWith(
      "notification."
    )
  ) {
    return state;
  }

  return {
    ...state,
    notifications: {
      ...state.notifications,
      [event.id]: {
        id: event.id,
        level: event.level,
        message: event.message,
        lastEventSequence:
          event.sequence,
      },
    },
  };
}

/**
 * Applies scheduled job event to historical state.
 *
 * @param state Historical runtime state.
 * @param event Runtime event record.
 * @returns Updated historical runtime state.
 *
 * PURE: No side effects.
 */
export function applyHistoricalScheduledJobEvent(
  state: HistoricalRuntimeState,
  event: RuntimeEventRecord
): HistoricalRuntimeState {
  const status =
    getHistoricalScheduledJobStatus(
      event.type
    );

  const scheduledJobId =
    getStringPayloadField(
      event,
      "scheduledJobId"
    );

  const workflowId =
    getStringPayloadField(
      event,
      "workflowId"
    );

  if (
    !status ||
    !scheduledJobId ||
    !workflowId
  ) {
    return state;
  }

  return {
    ...state,
    scheduledJobs: {
      ...state.scheduledJobs,
      [scheduledJobId]: {
        id: scheduledJobId,
        workflowId,
        status,
        lastEventSequence:
          event.sequence,
      },
    },
  };
}

/**
 * Applies cron job event to historical state.
 *
 * @param state Historical runtime state.
 * @param event Runtime event record.
 * @returns Updated historical runtime state.
 *
 * PURE: No side effects.
 */
export function applyHistoricalCronJobEvent(
  state: HistoricalRuntimeState,
  event: RuntimeEventRecord
): HistoricalRuntimeState {
  const status =
    getHistoricalCronJobStatus(
      event.type
    );

  const cronJobId =
    getStringPayloadField(
      event,
      "cronJobId"
    );

  if (
    !status ||
    !cronJobId
  ) {
    return state;
  }

  return {
    ...state,
    cronJobs: {
      ...state.cronJobs,
      [cronJobId]: {
        id: cronJobId,
        status,
        lastEventSequence:
          event.sequence,
      },
    },
  };
}

/**
 * Applies policy evaluation event to historical state.
 *
 * @param state Historical runtime state.
 * @param event Runtime event record.
 * @returns Updated historical runtime state.
 *
 * PURE: No side effects.
 */
export function applyHistoricalPolicyEvaluationEvent(
  state: HistoricalRuntimeState,
  event: RuntimeEventRecord
): HistoricalRuntimeState {
  if (
    event.type !==
    "policy.evaluated"
  ) {
    return state;
  }

  const capabilityId =
    getStringPayloadField(
      event,
      "capabilityId"
    );

  const riskLevel =
    getStringPayloadField(
      event,
      "riskLevel"
    );

  const effect =
    getHistoricalPolicyEffect(
      event
    );

  if (
    !capabilityId ||
    !riskLevel ||
    !effect
  ) {
    return state;
  }

  const matchedRuleId =
    getStringPayloadField(
      event,
      "matchedRuleId"
    );
  
  const role =
  getStringPayloadField(
    event,
    "role"
  );

  return {
    ...state,
    policyEvaluations: {
      ...state.policyEvaluations,
[event.id]: {
  id: event.id,
  capabilityId,
  riskLevel,
  ...(role
    ? {
        role,
      }
    : {}),
  effect,
  ...(matchedRuleId
    ? {
        matchedRuleId,
      }
    : {}),
  lastEventSequence:
    event.sequence,
},
    },
  };
}

/**
 * Applies one runtime event to historical runtime state.
 *
 * @param state Historical runtime state.
 * @param event Runtime event record.
 * @returns Updated historical runtime state.
 *
 * PURE: No side effects.
 */
export function applyHistoricalRuntimeEvent(
  state: HistoricalRuntimeState,
  event: RuntimeEventRecord
): HistoricalRuntimeState {
  const nextState =
    applyHistoricalPolicyEvaluationEvent(
      applyHistoricalCronJobEvent(
        applyHistoricalScheduledJobEvent(
          applyHistoricalNotificationEvent(
            applyHistoricalWorkflowEvent(
              applyHistoricalApprovalEvent(
                applyHistoricalJobEvent(
                  state,
                  event
                ),
                event
              ),
              event
            ),
            event
          ),
          event
        ),
        event
      ),
      event
    );

  return {
    ...nextState,
    eventCount:
      state.eventCount + 1,
  };
}

/**
 * Reconstructs historical runtime state from runtime events.
 *
 * @param events Runtime event records.
 * @returns Historical runtime state.
 *
 * PURE: No side effects.
 */
export function reconstructHistoricalRuntimeState(
  events: RuntimeEventRecord[]
): HistoricalRuntimeState {
  return events.reduce(
    applyHistoricalRuntimeEvent,
    createEmptyHistoricalRuntimeState()
  );
}