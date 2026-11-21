export type DelegationStatus =
  | "requested"
  | "in_progress"
  | "completed"
  | "failed";

export type DelegationRequest = {
  readonly id: string;
  readonly fromBusinessFunction: string;
  readonly toBusinessFunction: string;
  readonly work: string;
  readonly jobId?: string;
  readonly workerName?: string;
  readonly requiredCapabilities?: readonly string[];
  readonly status: DelegationStatus;
  readonly result?: string;
  readonly error?: string;
  readonly createdAt: number;
  readonly completedAt?: number;
};

/**
 * Purpose: Creates a delegation request.
 *
 * Params:
 * - input: Delegation request creation input.
 *
 * Returns:
 * - Delegation request.
 *
 * PURE: No side effects.
 */
export function createDelegationRequest(
  input: {
    readonly id: string;
    readonly fromBusinessFunction: string;
    readonly toBusinessFunction: string;
    readonly work: string;
    readonly now?: number;
  }
): DelegationRequest {
  const now =
    input.now ?? Date.now();

  return {
    id:
      input.id,
    fromBusinessFunction:
      input.fromBusinessFunction,
    toBusinessFunction:
      input.toBusinessFunction,
    work:
      input.work,
    status:
      "requested",
    createdAt:
      now,
  };
}

/**
 * Purpose: Completes a delegation request with a bounded result.
 *
 * Params:
 * - request: Delegation request.
 * - result: Delegated work result.
 * - now: Completion timestamp.
 *
 * Returns:
 * - Completed delegation request.
 *
 * PURE: No side effects.
 */
export function completeDelegationRequest(
  request: DelegationRequest,
  result: string,
  now: number = Date.now()
): DelegationRequest {
  return {
    ...request,
    status:
      "completed",
    result,
    completedAt:
      now,
  };
}

export function startDelegationRequest(
  request: DelegationRequest,
  jobId: string,
  workerName: string | undefined,
  requiredCapabilities: readonly string[]
): DelegationRequest {
  return {
    ...request,
    jobId,
    workerName,
    requiredCapabilities,
    status: workerName ? "in_progress" : "requested",
  };
}

export function failDelegationRequest(
  request: DelegationRequest,
  error: string,
  now: number = Date.now()
): DelegationRequest {
  return {
    ...request,
    status: "failed",
    error,
    completedAt: now,
  };
}

/**
 * Purpose: Formats the accountability principle for a delegation.
 *
 * Params:
 * - request: Delegation request.
 *
 * Returns:
 * - Human-readable ownership statement.
 *
 * PURE: No side effects.
 */
export function formatDelegationOwnership(
  request: DelegationRequest
): string {
  return `${request.fromBusinessFunction} is still answerable for it`;
}

/**
 * Turns a stored delegation status into words rather than a field name.
 *
 * The status itself is unchanged — it is a stored value other code compares
 * against. This is only what the reader is shown.
 *
 * PURE: No side effects.
 */
export function describeDelegationStatus(
  status: string
): string {
  const plain: Record<string, string> = {
    requested: "Asked for",
    in_progress: "Being worked on",
    completed: "Done",
    failed: "Didn't finish",
  };
  return plain[status] ?? status.replace(/_/g, " ");
}

/**
 * Purpose: Formats a delegation request for Chapter 18 output.
 *
 * Params:
 * - request: Delegation request.
 *
 * Returns:
 * - Human-readable delegation output.
 *
 * PURE: No side effects.
 */
export function formatDelegationRequest(
  request: DelegationRequest
): string {
  const lines = [
    request.status === "completed"
      ? "Delegation completed."
      : request.status === "failed"
        ? "Delegation failed."
        : request.status === "in_progress"
          ? "Delegation in progress."
          : "Delegation requested.",
    "",
    `  ID:          ${request.id}`,
    `  From:        ${request.fromBusinessFunction}`,
    `  To:          ${request.toBusinessFunction}`,
    `  Work:        ${request.work}`,
    `  Answerable:  ${formatDelegationOwnership(
      request
    )}`,
    `  Status:      ${describeDelegationStatus(request.status)}`,
    ...(request.jobId ? [`  Task:        ${request.jobId}`] : []),
    ...(request.workerName ? [`  Worker:      ${request.workerName}`] : []),
    ...(request.requiredCapabilities?.length
      ? [`  Skills needed: ${request.requiredCapabilities.join(", ")}`]
      : []),
  ];

  if (request.result) {
    lines.push(
      `  Result:      ${request.result}`
    );
  }

  if (request.error) {
    lines.push(`  Error:       ${request.error}`);
  }

  return lines.join("\n");
}

/** Formats a compact delegation row for list views. */
export function formatDelegationSummary(
  request: DelegationRequest,
  index?: number
): string {
  // The handover itself leads, not its id. A delegation is the one record with
  // a raw UUID for a name — Tasks are task-1, Human Tasks human-task-1 — so a
  // listing that opened with 36 characters of hex buried the one line telling
  // the reader what the row was. The id still shows, for anyone scripting.
  return [
    `${index === undefined ? "" : `${index + 1}. `}${request.fromBusinessFunction} → ${request.toBusinessFunction} · ${describeDelegationStatus(request.status)}`,
    `   Work: ${request.work}`,
    ...(request.jobId ? [`   Task: ${request.jobId}`] : []),
    ...(request.workerName ? [`   Worker: ${request.workerName}`] : []),
    ...(request.error ? [`   Error: ${request.error}`] : []),
    `   ID: ${request.id}`,
    // Points at the menu rather than at 36 characters to retype.
    `   Look at it: /delegation, then 3`,
  ].join("\n");
}
