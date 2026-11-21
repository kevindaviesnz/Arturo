import "dotenv/config";
// npm run test-email your-email@example.com

import {
  sendEmail,
} from "../src/integrations/emailSender";

import {
  sendEmailNow,
} from "../src/integrations/emailSender";

/**
 * Sends a test email using the current
 * SMTP configuration.
 *
 * SIDE EFFECT:
 * Sends a real email.
 */
async function main(): Promise<void> {
  const recipient =
    process.argv[2];

  if (!recipient) {
    console.error(
      "Usage: ts-node scripts/testEmail.ts <email>"
    );

    process.exit(1);
  }

  console.log(
    `Sending test email to ${recipient}...`
  );

  await sendEmail(
    recipient,
    "Arturo SMTP Test",
    [
      "Congratulations.",
      "",
      "Your Arturo SMTP configuration is working.",
      "",
      `Timestamp: ${new Date().toISOString()}`,
    ].join("\n")
  );

  console.log(
    "Email sent successfully."
  );
  
}



main().catch((err) => {
  console.error(
    "Failed to send email:"
  );

  console.error(err);

  process.exit(1);
});