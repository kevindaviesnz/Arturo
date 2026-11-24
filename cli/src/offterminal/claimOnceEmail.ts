/**
 * Claim-once email for off-terminal notices. Uses getEmailConfig and
 * createTransport, never sendEmail, and records an accepted or unknown
 * outcome (off-terminal sign-off brief).
 *
 * SIDE EFFECT: May send mail through SMTP.
 */

import { createTransport, getEmailConfig } from "../integrations/emailSender";

export type ClaimOnceOutcome = "accepted" | "unknown" | "failed" | "no-sender";

export type ClaimOnceMail = {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
};

export type ClaimOnceSender = (mail: ClaimOnceMail) => Promise<ClaimOnceOutcome>;

let senderForTests: ClaimOnceSender | undefined;

/** Test-only: replaces the SMTP path. Never call from production code. */
export function setClaimOnceSenderForTests(sender: ClaimOnceSender | undefined): void {
  senderForTests = sender;
}

function outcomeFromInfo(info: { accepted?: unknown; rejected?: unknown }): ClaimOnceOutcome {
  const accepted = Array.isArray(info.accepted) ? info.accepted : [];
  const rejected = Array.isArray(info.rejected) ? info.rejected : [];
  if (accepted.length > 0 && rejected.length === 0) {
    return "accepted";
  }
  if (rejected.length > 0) {
    return "failed";
  }
  return "unknown";
}

/**
 * Sends one plain-text mail and returns the recorded outcome. A missing
 * sender or a result other than "accepted" means the caller must not
 * treat the notice as sent.
 */
export async function sendClaimOnceMail(mail: ClaimOnceMail): Promise<ClaimOnceOutcome> {
  if (senderForTests) {
    return senderForTests(mail);
  }
  const config = getEmailConfig();
  if (!config) {
    return "no-sender";
  }
  try {
    const transport = createTransport(config);
    const info = await transport.sendMail({
      from: config.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
    });
    return outcomeFromInfo(info);
  } catch {
    return "failed";
  }
}
