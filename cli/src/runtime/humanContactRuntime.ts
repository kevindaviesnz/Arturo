import {
  assertWorkerCapability,
  type Worker,
} from "../control/workers";

import {
  sendEmail,
} from "../integrations/emailSender";

export type HumanContactRequest = {
  readonly requestingWorker: Worker<any, any>;
  readonly humanWorker: Worker<any, any>;
  readonly subject: string;
  readonly body: string;
};

export type ContactableHumanWorker =
  Worker<any, any> & {
    readonly kind: "human";
    readonly email: string;
  };

/**
 * Checks whether a worker is a contactable human worker.
 *
 * @param worker Worker to check.
 * @returns True when the worker is human and has an email address.
 *
 * PURE: No side effects.
 */
export function isContactableHumanWorker(
  worker: Worker<any, any>
): worker is ContactableHumanWorker {
  return (
    worker.kind === "human" &&
    typeof worker.email === "string" &&
    worker.email.trim().length > 0
  );
}

/**
 * Creates a controlled human-contact email body.
 *
 * @param requestingWorker Worker requesting contact.
 * @param body Message body.
 * @returns Controlled email body.
 *
 * PURE: No side effects.
 */
export function createHumanContactEmailBody(
  requestingWorker: Worker<any, any>,
  body: string
): string {
  return [
    "Arturo human-contact request",
    "",
    `Requested by: ${requestingWorker.displayName ?? requestingWorker.name}`,
    "",
    body,
  ].join("\n");
}

/**
 * Sends a controlled human-contact request.
 *
 * @param request Human contact request.
 * @returns Promise<void>
 *
 * SIDE EFFECT:
 * - Validates requesting worker capability.
 * - Sends email to a registered human worker.
 */
export async function requestHumanContact(
  request: HumanContactRequest
): Promise<void> {
  assertWorkerCapability(
    request.requestingWorker,
    "human-contact"
  );

  if (
    !isContactableHumanWorker(
      request.humanWorker
    )
  ) {
    throw new Error(
      `Human worker is not contactable: ${request.humanWorker.displayName ?? request.humanWorker.name}`
    );
  }

  await sendEmail(
    request.humanWorker.email,
    request.subject,
    createHumanContactEmailBody(
      request.requestingWorker,
      request.body
    )
  );
}
