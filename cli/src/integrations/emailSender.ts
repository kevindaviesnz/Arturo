import nodemailer from "nodemailer";

/**
 * Email configuration.
 */
export type EmailConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
};

/**
 * Builds email configuration from environment variables.
 *
 * @returns Email configuration or undefined when disabled.
 *
 * PURE: No side effects.
 */
export function getEmailConfig():
  | EmailConfig
  | undefined {
  const enabled =
    process.env.EMAIL_NOTIFICATIONS ===
    "true";

  if (!enabled) {
    return undefined;
  }

  const host =
    process.env.SMTP_HOST;

  const port =
    Number(
      process.env.SMTP_PORT ??
        "587"
    );

  const user =
    process.env.SMTP_USER;

  const password =
    process.env.SMTP_PASSWORD;

  const from =
    process.env.SMTP_FROM;

  if (
    !host ||
    !user ||
    !password ||
    !from
  ) {
    throw new Error(
      "SMTP configuration incomplete"
    );
  }

  return {
    host,
    port,
    user,
    password,
    from,
  };
}

/**
 * Creates a nodemailer transport.
 *
 * @param config SMTP configuration.
 * @returns Mail transport.
 *
 * SIDE EFFECT:
 * Creates transport object.
 */
export function createTransport(
  config: EmailConfig,
  options: { requireTLS?: boolean; connectionTimeout?: number; greetingTimeout?: number; socketTimeout?: number } = {}
) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure:
      config.port === 465,
    auth: {
      user: config.user,
      pass: config.password,
    },
    ...options,
  });
}

/**
 * Sends an email.
 *
 * @param to Recipient email.
 * @param subject Email subject.
 * @param body Email body.
 * @returns Promise<void>
 *
 * SIDE EFFECT:
 * Sends email through SMTP.
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<void> {
  const config =
    getEmailConfig();

  if (!config) {
    return;
  }

  const transport =
    createTransport(
      config
    );

  await transport.sendMail({
    from: config.from,
    to,
    subject,
    text: body,
  });
}

/**
 * Sends an email using SMTP regardless of EMAIL_NOTIFICATIONS.
 *
 * @param to Recipient email.
 * @param subject Email subject.
 * @param body Email body.
 * @returns Promise<void>
 *
 * SIDE EFFECT: Sends email through SMTP.
 */
export async function sendEmailNow(
  to: string,
  subject: string,
  body: string
): Promise<void> {
  const config = {
    host:
      process.env.SMTP_HOST ?? "",
    port:
      Number(process.env.SMTP_PORT ?? "587"),
    user:
      process.env.SMTP_USER ?? "",
    password:
      process.env.SMTP_PASSWORD ?? "",
    from:
      process.env.SMTP_FROM ?? "",
  };

  if (
    !config.host ||
    !config.user ||
    !config.password ||
    !config.from
  ) {
    throw new Error(
      "SMTP configuration incomplete"
    );
  }

  const transport =
    createTransport(config);

  await transport.verify();

  await transport.sendMail({
    from: config.from,
    to,
    subject,
    text: body,
  });
}
