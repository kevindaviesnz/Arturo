/**
 * One command from nothing to a sandboxed example Enterprise in the terminal.
 *
 * Run with `npm run try`. Each run rebuilds the Harbour Legal example from
 * scratch in `.data/harbour` so your real Arturo data is never touched.
 */

import { join } from "node:path";

/**
 * Where the example lives. Fixed, not configurable: seeding wipes the data
 * directory it is pointed at, so this must never be whatever directory the
 * operator's real Arturo data is in.
 */
export const TRY_DATA_DIRECTORY = join(".data", "harbour");

/**
 * What to tell the person about the local model before they approve anything.
 *
 * PURE: No side effects.
 */
export function describeModelReadiness(
  availability: { readonly reachable: boolean; readonly models?: readonly string[] }
): string {
  if (!availability.reachable) {
    return "The local AI model is NOT running. You can look around, but work you approve will fail until you open the Ollama app. Then type /model to check.";
  }
  if ((availability.models ?? []).length === 0) {
    return "The local AI model server is running but has no model installed. Type /model to choose one before approving work.";
  }
  return "The local AI model is running.";
}

/**
 * SIDE EFFECT: Wipes and rebuilds the example data directory and starts the
 * Arturo terminal against it.
 */
async function main(): Promise<void> {
  // Before anything that reads the storage location is loaded.
  process.env.ARTURO_DATA_DIRECTORY = TRY_DATA_DIRECTORY;
  process.env.ARTURO_RUNTIME_DATABASE_PATH = join(TRY_DATA_DIRECTORY, "runtime.db");

  console.log(
    [
      "",
      "Setting up the example practice, Harbour Legal, in its own sandbox.",
      "Your other Arturo data is not touched.",
    ].join("\n")
  );

  // Loaded here, not at the top, so they see the sandbox location set above.
  const { seedDemoEnterprise } = await import("./seedDemo");
  await seedDemoEnterprise(() => undefined);

  const { checkOllamaAvailability } = await import("../llm/ollamaStatus");
  console.log(
    [
      "Done: one lawyer, five AI workers, four Business Functions.",
      "",
      describeModelReadiness(await checkOllamaAvailability()),
      "",
      "One Task is waiting for your approval.",
      "Try:  /overview  ·  /approvals  ·  /approve task-1",
      "",
    ].join("\n")
  );

  const { startLineInterface } = await import("../ui/lineInterface");
  startLineInterface();
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
