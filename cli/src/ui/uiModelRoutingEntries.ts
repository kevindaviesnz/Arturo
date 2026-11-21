import { getModelRoutingStatus } from "../llm/modelRouting";
import { listModelProfiles } from "../llm/modelProfiles";
import type { WorkStreamEntry } from "./uiState";

/** Lists every model choice the operator may pass to model-aware commands. */
export function readModelsEntry(
  environment: Readonly<Record<string, string | undefined>> = process.env
): WorkStreamEntry {
  try {
    const profiles =
      listModelProfiles(
        environment
      );
    const premiumDefault =
      profiles.find(
        (profile) =>
          profile.alias === "premium-default"
      );
    const models =
      [
        ...new Set(
          profiles.map(
            (profile) =>
              profile.model
          )
        ),
      ];

    return {
      actor: "Arturo",
      label: "Models",
      body: [
        "Selectable model choices",
        "",
        "Friendly names:",
        "  local",
        "    Uses local-default.",
        "  premium",
        premiumDefault
          ? "    Uses premium-default."
          : "    Not available because premium-default is not configured.",
        "",
        "Approved aliases:",
        ...profiles.map(
          (profile) =>
            `  ${profile.alias}\n    ${profile.provider}/${profile.model} · ${profile.paid ? "external; session budget applies" : "local"}`
        ),
        "",
        "Configured model names:",
        ...models.map(
          (model) =>
            `  ${model}`
        ),
        "",
        "Run /model to choose one of these by number. Every model-backed",
        "command uses that choice until you run /model again.",
        "",
        "Arturo never uses a paid model unless you pick one there and confirm",
        "the cost, and paid calls stay inside the session limit.",
        "This list shows Arturo configuration, not live provider availability or quota.",
        "Use /model-routing for external readiness and calls remaining.",
      ].join("\n"),
    };
  } catch (error) {
    return {
      actor: "Arturo",
      label: "Models unavailable",
      body: [
        "Arturo could not read the configured models.",
        error instanceof Error
          ? error.message
          : String(error),
        "Correct the model profile configuration and restart Arturo.",
      ].join("\n"),
    };
  }
}

/** Shows the deterministic local-first and paid-escalation policy. */
export function readModelRoutingEntry(): WorkStreamEntry {
  const status = getModelRoutingStatus();
  let aliases: string;
  try {
    aliases = listModelProfiles()
      .map(
        (profile) =>
          `${profile.alias}=${profile.provider}/${profile.model}${profile.paid ? " (external)" : ""}`
      )
      .join(", ");
  } catch (error) {
    aliases =
      `invalid configuration: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`;
  }
  return {
    actor: "Arturo",
    label: "Model routing",
    body: [
      `Mode:                 ${status.mode}`,
      `Local tier:           ${status.localProvider}/${status.localModel}`,
      `External escalation:  ${status.paidEscalationEnabled ? "enabled" : "disabled"}`,
      `External tier:        ${status.paidProvider}/${status.paidModel ?? "not configured"}`,
      `External call budget: ${status.maxPaidCallsPerSession}`,
      `External calls used:  ${status.paidCallsUsed}`,
      `External calls left:  ${status.paidCallsRemaining}`,
      `Configuration ready:  ${status.configured ? "yes" : "no"}`,
      `Approved aliases:     ${aliases}`,
      status.configurationError ? `Reason:               ${status.configurationError}` : "",
      status.lastEscalationReason ? `Last escalation:      ${status.lastEscalationReason}` : "",
      "",
      "Automatic trigger: repeated structured-output validation failure only.",
      "Human-authorized /next and /staff model choices may use approved routes.",
      "Ordinary successful local responses do not escalate.",
      "Provider quota and availability are checked only when a request is made.",
    ].filter(Boolean).join("\n"),
  };
}
