import {
  createDefaultHelpText,
  createFullHelpText,
} from "./helpText";
import { findUiCommandHelp } from "../ui/uiCommandHelp";
import { formatUiCommandHelp } from "../ui/uiHelpEntries";

/**
 * Handles the /help command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Writes CLI output.
 */
export function handleHelpCommand(
  args: readonly string[]
): void {
  const requested = args[0];
  const detail = requested && requested !== "all"
    ? findUiCommandHelp(requested)
    : undefined;
  const helpText = requested === "all"
    ? createFullHelpText()
    : detail
      ? formatUiCommandHelp(detail)
      : requested
        ? `No primary terminal command matches: ${requested}\nUse /help to list supported commands, or /help all for low-level developer commands.`
        : createDefaultHelpText();

  console.log(
    helpText
  );
}
