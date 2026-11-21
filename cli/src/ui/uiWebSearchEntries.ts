import type {
  WorkStreamEntry,
} from "./uiState";

import {
  getWebSearchConfiguration,
} from "../integrations/webSearchConfig";

import {
  getWebSearchSessionUsage,
} from "../integrations/webSearch";

import { getEnterpriseByIdOrName, listEnterprises } from "../enterprise/enterpriseStore";
import { describeWebSearchSwitch, turnWebSearchOff, webSearchRefusal } from "../runtime/webSearchSwitch";

/** Builds the read-only governed Web Search configuration and usage view. */
export function readWebSearchEntry(
  environment:
    Readonly<
      Record<
        string,
        string |
        undefined
      >
    > =
    process.env
): WorkStreamEntry {
  const configuration =
    getWebSearchConfiguration(
      environment
    );
  const usage =
    getWebSearchSessionUsage();
  const remaining =
    Math.max(
      0,
      configuration
        .maxCallsPerSession -
        usage.used
    );

  return {
    actor:
      "Arturo",
    label:
      "Web Search",
    body: [
      "Governed Web Search",
      "",
      `Provider:             ${configuration.provider}`,
      `Ready:                ${configuration.ready ? "yes" : "no"}`,
      `Results per search:   ${configuration.maxResults}`,
      `Session call budget:  ${configuration.maxCallsPerSession}`,
      `Calls used:           ${usage.used}`,
      `Calls remaining:      ${remaining}`,
      `Allowed domains:      ${configuration.allowedDomains.join(", ") || "all public HTTPS result domains"}`,
      `Blocked domains:      ${configuration.blockedDomains.join(", ") || "none configured"}`,
      `Timeout:              ${configuration.timeoutMs} ms`,
      ...(
        configuration
          .reason
          ? [
              `Reason:               ${configuration.reason}`,
            ]
          : []
      ),
      "",
      "Per business (this computer's setting alone never lets anything search):",
      ...(
        listEnterprises().length
          ? listEnterprises().map((enterprise) => `  ${enterprise.name}: ${describeWebSearchSwitch(enterprise.id)}`)
          : ["  No businesses yet."]
      ),
      "",
      "Execution:",
      "  Someone who can sign off work turns web search on for their business from the company page, signed in, with a reason.",
      "  Only an AI Worker whose archetype allows it (researcher) searches, and only with words a person gives:",
      '  /task create "<analysis outcome>" --job "<job>" --search-query "<public search query>" --enterprise "<enterprise>"',
      "  Each web step waits for its own go-ahead. Every search is logged as a send.",
      '  Turn it off: /web-search off --enterprise "<enterprise>" --as "<who can sign off>" [--note "<why>"]',
      "",
      "Arturo stores normalized search results as a dated evidence Artefact before model analysis.",
      "It does not open result pages, sign in to websites, or treat snippets as verified facts.",
    ].join(
      "\n"
    ),
  };
}

/** PURE: No side effects. */
function flagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

/**
 * /web-search, /web-search on and /web-search off. Turning it on is refused
 * here: it is turned on from the company page, signed in, with a reason (W1).
 * Turning it off is open to anyone who can sign off work (W4).
 *
 * SIDE EFFECT: /web-search off may write one signed record.
 */
export function handleWebSearchCommand(args: readonly string[]): WorkStreamEntry {
  const sub = args[0]?.toLowerCase();
  if (!sub) return readWebSearchEntry();
  if (sub === "on") {
    return { actor: "Arturo", label: "Web search not turned on", body: webSearchRefusal("web_search_sign_in_needed").message };
  }
  if (sub === "off") {
    const named = flagValue(args, "--enterprise")?.trim() ?? "";
    const enterprise = named ? getEnterpriseByIdOrName(named) : listEnterprises().length === 1 ? listEnterprises()[0] : undefined;
    if (!enterprise) {
      return { actor: "Arturo", label: "Web search not changed", body: named ? `No business called ${named}.` : 'Say which business: --enterprise "<business>".' };
    }
    const outcome = turnWebSearchOff({ enterpriseId: enterprise.id, as: flagValue(args, "--as"), note: flagValue(args, "--note") });
    return "refused" in outcome
      ? { actor: "Arturo", label: "Web search not changed", body: outcome.refused }
      : { actor: "Arturo", label: "Web search off", body: outcome.message };
  }
  return { actor: "Arturo", label: "Usage", body: '/web-search · /web-search off --enterprise "<business>" --as "<who can sign off>" [--note "<why>"] · Web search is turned on from the company page.' };
}
