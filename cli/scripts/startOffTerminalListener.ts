/**
 * Starts the off-terminal sign-off listener on 127.0.0.1 only.
 * Point the business's own tunnel at the printed port, with TLS ending
 * on this computer. The hosted relay is not started here.
 *
 * Usage, after setting APPROVAL_SIGNING_SECRET and PUBLIC_BASE_URL:
 *   npx ts-node scripts/startOffTerminalListener.ts
 */
import { startSignOffListener } from "../src/offterminal/startSignOffListener";

async function main(): Promise<void> {
  const listener = await startSignOffListener();
  process.stdout.write(
    [
      `Arturo sign-off listener is on 127.0.0.1:${listener.port}.`,
      "Point your own tunnel or reverse proxy at that address.",
      "TLS must end on this computer. Do not use a hosted relay that can read the traffic.",
      "Set PUBLIC_BASE_URL to https:// plus your hostname before any link is sent.",
      "Press Ctrl+C to stop.",
      "",
    ].join("\n")
  );
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
