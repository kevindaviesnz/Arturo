/**
 * Plain-English names for the capabilities that make a Task consequential.
 *
 * When governance fails closed with no rule of the operator's own, the reason
 * shown was "a Governance rule that is no longer stored
 * (fail-closed:consequential-default)" — the approval views look the recorded
 * rule id up in stored rules, and that id has never been a stored rule. It
 * reads as though a rule the operator wrote had been deleted. What actually
 * happened is that the Task can do something outside Arturo and nothing
 * covered it, so that is what these say.
 *
 * PURE: No side effects.
 */

import {
  builtInCapabilityRegistry,
} from "../kernel/builtInCapabilities";

/**
 * Keyed on the ids in `jobGovernance.ts` — both the hyphenated Worker
 * capabilities a Task carries and the dotted kernel ids.
 */
const CONSEQUENTIAL_CAPABILITY_WORDING: Record<string, string> = {
  "email-send": "send email",
  "email.send": "send email",
  "shell-execute": "run commands on this machine",
  "shell.exec": "run commands on this machine",
  "file-write": "write files",
  "file.delete": "delete files",
  "human-contact": "contact someone outside Arturo",
  "http.get": "call a service outside Arturo",
  "http.post": "call a service outside Arturo",
  "webhook.send": "send a webhook",
};

/** What one consequential capability lets a Task do, in the operator's words. */
export function describeConsequentialCapability(
  capabilityId: string
): string {
  return (
    CONSEQUENTIAL_CAPABILITY_WORDING[capabilityId] ??
    builtInCapabilityRegistry[capabilityId]?.description ??
    capabilityId
  );
}

/**
 * Joins several into one phrase, de-duplicated because two ids can share a
 * phrase — a Task carrying both `email-send` and `email.send` should not say
 * "send email and send email".
 */
export function describeConsequentialCapabilities(
  capabilityIds: readonly string[]
): string {
  const phrases = [
    ...new Set(
      capabilityIds.map(describeConsequentialCapability)
    ),
  ];

  if (phrases.length === 0) return "";
  if (phrases.length === 1) return phrases[0];
  return `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;
}
