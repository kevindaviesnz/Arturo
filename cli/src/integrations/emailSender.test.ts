import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("nodemailer", () => ({
  default: {
    createTransport:
      vi.fn(),
  },
}));

import nodemailer from "nodemailer";

import {
  createTransport,
  getEmailConfig,
  sendEmail,
  sendEmailNow,
} from "./emailSender";

const createTransportMock =
  vi.mocked(
    nodemailer.createTransport
  );

/**
 * Saves selected environment variables for restoration.
 *
 * @returns Environment snapshot.
 *
 * PURE: No side effects.
 */
function snapshotEmailEnv(): Record<string, string | undefined> {
  return {
    EMAIL_NOTIFICATIONS:
      process.env.EMAIL_NOTIFICATIONS,
    SMTP_HOST:
      process.env.SMTP_HOST,
    SMTP_PORT:
      process.env.SMTP_PORT,
    SMTP_USER:
      process.env.SMTP_USER,
    SMTP_PASSWORD:
      process.env.SMTP_PASSWORD,
    SMTP_FROM:
      process.env.SMTP_FROM,
  };
}

/**
 * Restores selected environment variables.
 *
 * @param snapshot Environment snapshot.
 * @returns void
 *
 * SIDE EFFECT: Mutates process.env.
 */
function restoreEmailEnv(
  snapshot: Record<string, string | undefined>
): void {
  Object.entries(snapshot).forEach(
    ([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
        return;
      }

      process.env[key] = value;
    }
  );
}

describe("emailSender", () => {
  const envSnapshot =
    snapshotEmailEnv();

  afterEach(() => {
    restoreEmailEnv(
      envSnapshot
    );

    createTransportMock.mockReset();
  });

  it("returns undefined when email notifications are disabled", () => {
    process.env.EMAIL_NOTIFICATIONS =
      "false";

    expect(
      getEmailConfig()
    ).toBeUndefined();
  });

  it("throws when email notifications are enabled but SMTP config is incomplete", () => {
    process.env.EMAIL_NOTIFICATIONS =
      "true";

    expect(() =>
      getEmailConfig()
    ).toThrow(
      "SMTP configuration incomplete"
    );
  });

  it("builds email config from environment variables", () => {
    process.env.EMAIL_NOTIFICATIONS =
      "true";
    process.env.SMTP_HOST =
      "smtp.example.com";
    process.env.SMTP_PORT =
      "465";
    process.env.SMTP_USER =
      "user@example.com";
    process.env.SMTP_PASSWORD =
      "local-password";
    process.env.SMTP_FROM =
      "from@example.com";

    expect(
      getEmailConfig()
    ).toEqual({
      host: "smtp.example.com",
      port: 465,
      user: "user@example.com",
      password: "local-password",
      from: "from@example.com",
    });
  });

  it("creates secure transport for port 465", () => {
    createTransport({
      host: "smtp.example.com",
      port: 465,
      user: "user@example.com",
      password: "local-password",
      from: "from@example.com",
    });

    expect(
      createTransportMock
    ).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 465,
      secure: true,
      auth: {
        user: "user@example.com",
        pass: "local-password",
      },
    });
  });

  it("does not send email when notifications are disabled", async () => {
    process.env.EMAIL_NOTIFICATIONS =
      "false";

    await sendEmail(
      "to@example.com",
      "Subject",
      "Body"
    );

    expect(
      createTransportMock
    ).not.toHaveBeenCalled();
  });

  it("sends email when notifications are enabled", async () => {
    const sendMail =
      vi.fn();

    createTransportMock.mockReturnValue({
      sendMail,
    } as never);

    process.env.EMAIL_NOTIFICATIONS =
      "true";
    process.env.SMTP_HOST =
      "smtp.example.com";
    process.env.SMTP_PORT =
      "587";
    process.env.SMTP_USER =
      "user@example.com";
    process.env.SMTP_PASSWORD =
      "local-password";
    process.env.SMTP_FROM =
      "from@example.com";

    await sendEmail(
      "to@example.com",
      "Subject",
      "Body"
    );

    expect(
      sendMail
    ).toHaveBeenCalledWith({
      from: "from@example.com",
      to: "to@example.com",
      subject: "Subject",
      text: "Body",
    });
  });

  it("sendEmailNow verifies transport before sending", async () => {
    const verify =
      vi.fn().mockResolvedValue(
        true
      );

    const sendMail =
      vi.fn().mockResolvedValue(
        undefined
      );

    createTransportMock.mockReturnValue({
      verify,
      sendMail,
    } as never);

    process.env.SMTP_HOST =
      "smtp.example.com";
    process.env.SMTP_PORT =
      "587";
    process.env.SMTP_USER =
      "user@example.com";
    process.env.SMTP_PASSWORD =
      "local-password";
    process.env.SMTP_FROM =
      "from@example.com";

    await sendEmailNow(
      "to@example.com",
      "Subject",
      "Body"
    );

    expect(
      verify
    ).toHaveBeenCalled();

    expect(
      sendMail
    ).toHaveBeenCalledWith({
      from: "from@example.com",
      to: "to@example.com",
      subject: "Subject",
      text: "Body",
    });
  });
});