/**
 * The terminal's /work commands: open named work (a matter, a book or a
 * deal), list it, inspect it, and turn "no AI" on for it.
 *
 * Changes only the owner may make (turning "no AI" off, changing a matter
 * from one unlocked type to another, the law-practice setting, paid
 * escalation, adding or unlocking a matter type, reopening a cancelled locked
 * matter's number as an unlocked type) are refused here by the same rule the
 * company page follows: the terminal has no signed-in owner, so
 * refuseUnlessOwner refuses it (work/workChanges.ts). Changing a matter's
 * type goes through changeMatterType, which decides the rule: locked to
 * locked for someone who can sign off (--as, --reason), unlocked to locked
 * for anyone at the business (--as, optional --reason), locked to unlocked
 * never.
 *
 * Times are shown in NZ time with the zone (core/nzTime.ts).
 *
 * SIDE EFFECT: Reads and may write the runtime database.
 */

import { flagValue, resolveEnterprise } from "../clients/clientCommands";
import { formatNzDay, formatNzTime } from "../core/nzTime";
import { getPracticeSetting } from "./practiceSetting";
import {
  BUILT_IN_MATTER_TYPES,
  isLockedMatterType,
  matterTypeLabel,
  precedentsForMatterType,
  type WorkRecord,
} from "./workRecord";
import { effectiveNoAi, getWork, listWorkChanges, listWorkFor, verifyWorkChangeLog } from "./workStore";
import { describeWorkSends, listWorkSends } from "./workSendLog";
import {
  addMatterType,
  addTypeChangeReason,
  allowPaidEscalation,
  cancelWork,
  changeMatterType,
  createWork,
  describeCancelEffects,
  describeNoAiEffects,
  NO_AI_CONFIRM_LINES,
  setLawPractice,
  setWorkNoAi,
  unlockMatterType,
} from "./workChanges";

export const WORK_USAGE = [
  'Usage: /work create "<name>" --kind matter|book|deal|work [--client <client-id>] [--number <matter-number>] [--type <matter-type>] [--parent <work-id>] [--no-ai] [--replaces <cancelled-work-id> | --separate [--leave-ai-off]] [--as "<name>"] [--enterprise <business>]',
  "       /work list [--enterprise <business>]",
  "       /work types [--enterprise <business>]",
  "       /work inspect <work-id>",
  '       /work no-ai <work-id> on [--confirm] --as "<your name>"',
  '       /work cancel <work-id> --as "<your name>" --reason "<why>" [--confirm]   (someone who can sign off; for good, nothing is deleted)',
  '       /work type <work-id> <matter-type> --as "<your name>" [--reason "<why>"]   (locked to locked: someone who can sign off, with a reason; unlocked to locked: anyone, reason optional; locked to unlocked: never)',
  '       /work type-reason <work-id> --as "<your name>" --reason "<why>"   (adds a reason to the last type change, in its own signed entry)',
  "Owner only, on the company page, each with a typed reason where it loosens a lock: /work no-ai <work-id> off, /work type between unlocked types, /work practice, /work escalation, /work matter-type add|unlock, and reopening a cancelled locked matter's number as an unlocked type.",
  "On a law-practice account, only a matter with --number and --type can be opened.",
].join("\n");

const VALUED = ["--kind", "--client", "--number", "--type", "--parent", "--as", "--enterprise", "--reason", "--label", "--replaces"];

/** The words that are not a flag or a flag's value. PURE: No side effects. */
function words(args: readonly string[]): string[] {
  const rest: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (VALUED.includes(arg)) { index += 1; continue; }
    if (arg.startsWith("--")) continue;
    rest.push(arg);
  }
  return rest;
}

/** One line for a piece of work. PURE apart from reading the setting. */
function describeWork(work: WorkRecord): string {
  const custom = getPracticeSetting(work.enterpriseId).customMatterTypes;
  const parts = [
    `${work.id}  ${work.name} (${work.kind})`,
    ...(work.matterNumber ? [`number ${work.matterNumber}`] : []),
    ...(work.matterType ? [`${matterTypeLabel(work.matterType, custom).toLowerCase()}${isLockedMatterType(work.matterType, custom) ? ", locked" : ""}`] : []),
    ...(work.clientId ? [`client ${work.clientId}`] : []),
    ...(work.parentWorkId ? [`within ${work.parentWorkId}`] : []),
  ];
  const noAi = effectiveNoAi(work.id);
  return `${parts.join(", ")}${work.typeHeld ? "  [type held locked: the record it replaces couldn't be confirmed]" : ""}${work.cancelledAt !== undefined ? `  [cancelled by ${work.cancelledBy}: ${work.cancelReason}]` : ""}${noAi.noAi ? `  [no AI: ${noAi.because}]` : ""}`;
}

/**
 * Handles /work and its subcommands. Returns the text the terminal shows.
 *
 * SIDE EFFECT: Reads and may write the runtime database.
 */
export function handleWorkCommand(args: readonly string[], now = Date.now()): string {
  return runWorkCommand(args, now).text;
}

/**
 * Handles /work and says whether it was refused, so the terminal can label
 * a refusal "[Refused]" rather than "[Work]" (Amy, addendum 1).
 *
 * SIDE EFFECT: Reads and may write the runtime database.
 */
export function runWorkCommand(args: readonly string[], now = Date.now()): { readonly text: string; readonly refused: boolean } {
  let refused = false;
  const no = (text: string): string => {
    refused = true;
    return text;
  };
  const text = workCommandText(args, now, no);
  return { text, refused };
}

/** The text of a /work command; `no` marks a refusal. SIDE EFFECT: as handleWorkCommand. */
function workCommandText(args: readonly string[], now: number, no: (text: string) => string): string {
  const [sub, ...rest] = args;
  const owner = (refusal: { readonly refused: string } | { readonly message: string }) =>
    "refused" in refusal ? no(refusal.refused) : refusal.message;

  if (sub === "create") {
    const enterprise = resolveEnterprise(flagValue(rest, "--enterprise"));
    if ("refused" in enterprise) return no(enterprise.refused);
    const name = words(rest).join(" ");
    if (!name) return WORK_USAGE;
    if (name.startsWith("-")) return "Start the name with a letter, not a dash.";
    const outcome = createWork({
      enterpriseId: enterprise.id,
      name,
      kind: flagValue(rest, "--kind") ?? "",
      parentWorkId: flagValue(rest, "--parent"),
      clientId: flagValue(rest, "--client"),
      matterNumber: flagValue(rest, "--number"),
      matterType: flagValue(rest, "--type"),
      noAi: rest.includes("--no-ai"),
      replacesWorkId: flagValue(rest, "--replaces"),
      separate: rest.includes("--separate"),
      ...(rest.includes("--separate") && rest.includes("--leave-ai-off") ? { noAiAfterDeclining: false } : {}),
      actor: undefined,
      as: flagValue(rest, "--as"),
      now,
    });
    if ("refused" in outcome) return no(`${outcome.refused} Nothing was opened.`);
    if ("prompt" in outcome) {
      const prompt = outcome.prompt;
      if (prompt.kind === "title-match") {
        return [
          ...prompt.matches.map((match) => match.noAi
            ? `A cancelled ${flagValue(rest, "--kind")} called ${match.name} had 'no AI' switched on. Link this one to it and keep 'no AI'? Add --replaces ${match.id}.`
            : `A cancelled ${flagValue(rest, "--kind")} has this title: ${match.name}, cancelled ${formatNzDay(match.cancelledAt)}. If this replaces it, add --replaces ${match.id}.`),
          "If it's separate, add --separate. Nothing was opened.",
        ].join("\n");
      }
      if (prompt.kind === "reopen-unlocked") return `${prompt.lines.join(" ")} Nothing was opened.`;
      return `The cancelled ${prompt.matched.name} had 'no AI' switched on. Nothing has been sent for this one yet. Add --no-ai to turn it on, or --leave-ai-off to leave it off. Nothing was opened.`;
    }
    const carried = outcome.work.carryOver;
    return [
      `Opened: ${describeWork(outcome.work)}`,
      ...(carried && !carried.checked ? ["No AI is on and the type is locked because Arturo couldn't confirm the record this replaces."] : []),
      ...(carried?.checked && carried.noAi ? [`No AI: on, as it was on ${carried.from}. Only the owner can turn it off, with a reason.`] : []),
      ...(carried?.checked && carried.lockedType && !carried.reopenedAs ? [`Matter type: ${carried.lockedType}, locked, as it was on ${carried.from}. It can only change to another locked type.`] : []),
      ...(carried?.reopenedAs ? [`Reopened as ${carried.reopenedAs}, an unlocked type, by the owner. It was ${carried.lockedType} on ${carried.from}.`] : []),
      `Give a Task to it with /task create "<instruction>" --work ${outcome.work.id}`,
    ].join("\n");
  }

  if (sub === "list") {
    const enterprise = resolveEnterprise(flagValue(rest, "--enterprise"));
    if ("refused" in enterprise) return no(enterprise.refused);
    const { work, unverified } = listWorkFor(enterprise.id);
    const setting = getPracticeSetting(enterprise.id);
    const lines = [
      `${enterprise.name}${setting.lawPractice ? " (a law practice)" : ""}:`,
      ...(work.length ? work.map((one) => `  ${describeWork(one)}`) : ["  No named work yet. Open some with /work create."]),
      ...unverified.map((id) => `  ${id}  does not verify, so it is treated as "no AI" and nothing on it can run.`),
    ];
    return lines.join("\n");
  }

  if (sub === "types") {
    const enterprise = resolveEnterprise(flagValue(rest, "--enterprise"));
    if ("refused" in enterprise) return no(enterprise.refused);
    const custom = getPracticeSetting(enterprise.id).customMatterTypes;
    const describe = (id: string) => {
      const precedents = precedentsForMatterType(id);
      return `  ${id}  ${matterTypeLabel(id, custom)}${isLockedMatterType(id, custom) ? " (locked: no AI)" : ""}${precedents.length ? `, precedents: ${precedents.join(", ")}` : ""}`;
    };
    return [`Matter types at ${enterprise.name}:`, ...BUILT_IN_MATTER_TYPES.map(describe), ...custom.map((one) => describe(one.id))].join("\n");
  }

  if (sub === "inspect") {
    const id = words(rest)[0];
    if (!id) return WORK_USAGE;
    const standing = getWork(id);
    if (standing.state === "missing") return no(`There is no work called ${id}.`);
    if (standing.state === "unverified") return no(`${id}'s record does not verify. It is treated as "no AI", and nothing on it can run.`);
    const work = standing.work;
    const sends = listWorkSends([work.id]);
    const changes = listWorkChanges(work.enterpriseId, work.id);
    const broken = verifyWorkChangeLog();
    return [
      describeWork(work),
      `Opened by ${work.createdBy} on ${formatNzTime(work.createdAt)}, version ${work.version}. Paid escalation: ${work.paidEscalationAllowed ? "allowed" : "off"}.`,
      "",
      "Changes:",
      ...changes.map((change) => `  ${formatNzTime(change.at)}  ${change.by} ${change.what}${change.reason ? `: ${change.reason}` : ""}`),
      ...(broken >= 0 ? [`  The change log does not verify from entry ${broken + 1}.`] : []),
      "",
      "Sent to an AI worker:",
      ...describeWorkSends(sends.sends).map((line) => `  ${line}`),
      ...(sends.unverified ? [`  ${sends.unverified} send record(s) do not verify and are not counted.`] : []),
    ].join("\n");
  }

  if (sub === "no-ai") {
    const [id, setting] = words(rest);
    if (!id || (setting !== "on" && setting !== "off")) return WORK_USAGE;
    if (setting === "on" && !rest.includes("--confirm")) {
      const effects = describeNoAiEffects(id);
      return [
        `Turning "no AI" on for ${id}:`,
        ...NO_AI_CONFIRM_LINES.map((line) => `  ${line}`),
        `  Not started, and cancelled: ${effects.cancellable.join(", ") || "none"}.`,
        `  Running, and set aside when they finish: ${effects.running.join(", ") || "none"}.`,
        "  Already sent:",
        ...describeWorkSends(effects.sent).map((line) => `    ${line}`),
        `Nothing was changed yet. To go ahead: /work no-ai ${id} on --confirm`,
      ].join("\n");
    }
    const outcome = setWorkNoAi({ workId: id, noAi: setting === "on", actor: undefined, as: flagValue(rest, "--as"), reason: flagValue(rest, "--reason"), now });
    return owner(outcome);
  }

  if (sub === "cancel") {
    const [id] = words(rest);
    if (!id) return WORK_USAGE;
    if (!rest.includes("--confirm")) {
      const effects = describeCancelEffects(id);
      if ("refused" in effects) return no(effects.refused);
      const work = effects.work;
      return [
        `Cancelling ${work.name}${effects.deals.length ? ` and its ${effects.deals.length} deal${effects.deals.length === 1 ? "" : "s"} (${effects.deals.map((deal) => deal.name).join(", ")})` : ""}:`,
        "  Nothing new can start on it, and no go-ahead can be given on it.",
        `  Not started, and cancelled: ${effects.cancellable.join(", ") || "none"}.`,
        `  Running, and set aside by Arturo when they finish: ${effects.running.join(", ") || "none"}.`,
        ...(effects.deals.length ? [`  ${effects.runningDeals ? `${effects.runningDeals} of these deals have AI work running.` : "None of these deals has AI work running."}`] : []),
        "  Nothing is deleted. This can't be undone. To pick it up again, open new work with --replaces.",
        ...(effects.carriesNoAi ? ["  New work replacing it will start with No AI on, as this one has."] : []),
        ...(effects.carriesLockedType ? [`  New work replacing it will keep the locked type ${effects.carriesLockedType}.`] : []),
        `Nothing was changed yet. To go ahead: /work cancel ${id} --as "<your name>" --reason "<why>" --confirm`,
      ].join("\n");
    }
    return owner(cancelWork({ workId: id, reason: flagValue(rest, "--reason") ?? "", actor: undefined, as: flagValue(rest, "--as"), now }));
  }

  // changeMatterType decides who may: owner-only changes are refused here by
  // refuseUnlessOwner, which has no owner at the terminal.
  if (sub === "type") {
    const [id, type] = words(rest);
    if (!id || !type) return WORK_USAGE;
    return owner(changeMatterType({ workId: id, matterType: type, reason: flagValue(rest, "--reason"), actor: undefined, as: flagValue(rest, "--as"), now }));
  }
  if (sub === "type-reason") {
    const [id] = words(rest);
    if (!id) return WORK_USAGE;
    return owner(addTypeChangeReason({ workId: id, reason: flagValue(rest, "--reason") ?? "", actor: undefined, as: flagValue(rest, "--as"), now }));
  }
  if (sub === "escalation") {
    const [id, setting] = words(rest);
    if (!id || (setting !== "on" && setting !== "off")) return WORK_USAGE;
    return owner(allowPaidEscalation({ workId: id, allowed: setting === "on", actor: undefined, reason: flagValue(rest, "--reason"), now }));
  }
  if (sub === "practice") {
    const enterprise = resolveEnterprise(flagValue(rest, "--enterprise"));
    if ("refused" in enterprise) return no(enterprise.refused);
    const [setting] = words(rest);
    if (setting !== "on" && setting !== "off") {
      return `${enterprise.name} is ${getPracticeSetting(enterprise.id).lawPractice ? "" : "not "}a law practice.`;
    }
    return owner(setLawPractice({ enterpriseId: enterprise.id, on: setting === "on", reason: flagValue(rest, "--reason"), actor: undefined, now }));
  }
  if (sub === "matter-type") {
    const enterprise = resolveEnterprise(flagValue(rest, "--enterprise"));
    if ("refused" in enterprise) return no(enterprise.refused);
    const [action, id] = words(rest);
    if (action === "add" && id) return owner(addMatterType({ enterpriseId: enterprise.id, id, label: flagValue(rest, "--label") ?? "", actor: undefined, now }));
    if (action === "unlock" && id) return owner(unlockMatterType({ enterpriseId: enterprise.id, id, reason: flagValue(rest, "--reason") ?? "", actor: undefined, now }));
    return WORK_USAGE;
  }

  return WORK_USAGE;
}
