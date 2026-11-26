/**
 * Terminal commands for off-terminal sign-off: the path, email checks,
 * device-check enrolment, and the real-person test record. Every decision
 * goes through the same functions the rest of this path already uses.
 * Refusals happen before those functions write.
 *
 * SIDE EFFECT: May send mail, write path, email, passkey or test records.
 */

import { flagValue, resolveEnterprise } from "../clients/clientCommands";
import { formatNzTime } from "../core/nzTime";
import { listPeople, type Actor } from "../identity/companySignIn";
import {
  cancelOffTerminalPathOn,
  requestOffTerminalPathOn,
  turnOffTerminalPathOff,
} from "./offTerminalPath";
import { getOffTerminalPath, isOffTerminalPathOn } from "./offTerminalPathState";
import {
  confirmPasskeyEnrolment,
  formatEnrolmentOffer,
  startPasskeyEnrolment,
} from "./passkeys";
import {
  formatRealPersonTestInstructions,
  getRealPersonTest,
  recordRealPersonTest,
} from "./realPersonTest";
import { confirmEmailVerification, startEmailVerification } from "./verifiedEmail";

export const OFF_TERMINAL_USAGE = [
  "Usage:",
  '  /off-terminal status [--enterprise "<business>"]',
  '  /off-terminal on --reason "<why, in your own words>" --notify-to "<email>" [--enterprise "<business>"] [--as "<owner>"]',
  '  /off-terminal cancel --as "<name>" [--enterprise "<business>"]',
  '  /off-terminal off [--enterprise "<business>"] [--as "<owner>"]',
  '  /off-terminal verify-email --person "<name>" --address "<email>" [--enterprise "<business>"] [--as "<owner>"]',
  '  /off-terminal confirm-email --person "<name>" --code "<code from the email>" [--enterprise "<business>"]',
  '  /off-terminal enrol --person "<name>" --reason "<why, in your own words>" [--enterprise "<business>"] [--as "<owner>"]',
  '  /off-terminal confirm --person "<name>" --confirmation "<text that names them>" [--enterprise "<business>"] [--as "<owner>"] [--credential <id>]',
  '  /off-terminal record-test --outcome passed|failed --person "<name>" --recorded-by "<your name>" --unaided yes|no --started <time> [--enrolled <time>] [--signed-off <time>] [--minutes <n>] [--notes "<text>"]',
  '  /off-terminal instructions',
  'Times for record-test may be "now", milliseconds, or an ISO time such as 2026-11-20T15:00:00+13:00.',
].join("\n");

export type OffTerminalCommandOutcome = {
  readonly text: string;
  readonly refused: boolean;
};

let nowForTests: number | undefined;

/** Test seam only. Clears with undefined. */
export function setOffTerminalCommandNowForTests(now: number | undefined): void {
  nowForTests = now;
}

function commandNow(): number {
  return nowForTests ?? Date.now();
}

function tidy(value: string | undefined): string {
  return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

function actorFrom(enterpriseId: string, as: string | undefined): Actor | { readonly refused: string } {
  const named = tidy(as);
  if (!named) {
    return undefined;
  }
  const person = listPeople(enterpriseId).find(
    (one) => one.name.trim().toLowerCase() === named.toLowerCase()
  );
  if (!person) {
    return { refused: "Choose someone who works here." };
  }
  return {
    userId: "",
    workerName: person.name,
    displayName: person.name,
    roles: new Map([[enterpriseId, person.role === "owner" ? "owner" : "member"]]),
  };
}

function parseTime(
  value: string | undefined,
  label: string,
  required: boolean
): number | { readonly refused: string } | undefined {
  const raw = tidy(value);
  if (!raw) {
    return required ? { refused: `Say ${label}.` } : undefined;
  }
  if (raw.toLowerCase() === "now") {
    return commandNow();
  }
  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    return {
      refused: `Say ${label} as a time Arturo can read (for example 2026-11-20T15:00:00+13:00, or now).`,
    };
  }
  return parsed;
}

function parseUnaided(value: string | undefined): boolean | { readonly refused: string } {
  const raw = tidy(value).toLowerCase();
  if (raw === "yes" || raw === "true") {
    return true;
  }
  if (raw === "no" || raw === "false") {
    return false;
  }
  return { refused: 'Say whether they were unaided, with --unaided yes or --unaided no.' };
}

function formatPathStatus(enterpriseId: string, name: string): string {
  const now = commandNow();
  const record = getOffTerminalPath(enterpriseId);
  if (isOffTerminalPathOn(enterpriseId, now)) {
    const since =
      record?.effectiveAt !== undefined ? ` It took effect at ${formatNzTime(record.effectiveAt)}.` : "";
    return `Off-terminal sign-off is on at ${name}.${since}`;
  }
  if (record?.state === "waiting" && record.effectiveAt !== undefined) {
    return `Off-terminal sign-off at ${name} is waiting to turn on at ${formatNzTime(record.effectiveAt)}.`;
  }
  return `Off-terminal sign-off is off at ${name}.`;
}

/**
 * Runs one /off-terminal command. Missing or unknown subcommands print usage
 * and write nothing.
 */
export async function runOffTerminalCommand(
  args: readonly string[]
): Promise<OffTerminalCommandOutcome> {
  const refuse = (text: string): OffTerminalCommandOutcome => ({ text, refused: true });
  const ok = (text: string): OffTerminalCommandOutcome => ({ text, refused: false });

  const [sub, ...rest] = args;
  const command = (sub ?? "").trim().toLowerCase();
  if (!command || command === "help" || command === "--help") {
    return ok(OFF_TERMINAL_USAGE);
  }
  if (command === "instructions") {
    return ok(formatRealPersonTestInstructions());
  }

  const enterprise = resolveEnterprise(flagValue(rest, "--enterprise") ?? flagValue(args, "--enterprise"));
  if ("refused" in enterprise) {
    return refuse(enterprise.refused);
  }

  const as = flagValue(args, "--as");
  const actor = actorFrom(enterprise.id, as);
  if (actor && "refused" in actor) {
    return refuse(actor.refused);
  }

  if (command === "status") {
    return ok(formatPathStatus(enterprise.id, enterprise.name));
  }

  if (command === "on") {
    const reason = tidy(flagValue(args, "--reason"));
    const notifyTo = tidy(flagValue(args, "--notify-to"));
    if (!reason || !notifyTo) {
      return refuse(OFF_TERMINAL_USAGE);
    }
    const outcome = await requestOffTerminalPathOn({
      enterpriseId: enterprise.id,
      reason,
      notifyTo,
      actor,
      now: commandNow(),
    });
    if ("refused" in outcome) {
      return refuse(outcome.refused);
    }
    return ok(
      `${outcome.message}\nCancel with: /off-terminal cancel --as "<name of someone who can sign off>".`
    );
  }

  if (command === "cancel") {
    const named = tidy(as);
    if (!named) {
      return refuse('Say who is cancelling, with --as "<name>". Anyone who can sign off may cancel.');
    }
    if (!actor || "refused" in actor) {
      return refuse("Choose someone who works here.");
    }
    const outcome = cancelOffTerminalPathOn({
      enterpriseId: enterprise.id,
      actor: { workerName: actor.workerName, ...(actor.userId ? { userId: actor.userId } : {}) },
      now: commandNow(),
    });
    return "refused" in outcome ? refuse(outcome.refused) : ok(outcome.message);
  }

  if (command === "off") {
    const outcome = turnOffTerminalPathOff({
      enterpriseId: enterprise.id,
      actor,
      now: commandNow(),
    });
    return "refused" in outcome ? refuse(outcome.refused) : ok(outcome.message);
  }

  if (command === "verify-email") {
    const person = tidy(flagValue(args, "--person"));
    const email = tidy(flagValue(args, "--address"));
    if (!person || !email) {
      return refuse(OFF_TERMINAL_USAGE);
    }
    const outcome = await startEmailVerification({
      enterpriseId: enterprise.id,
      person,
      email,
      actor,
      now: commandNow(),
    });
    return "refused" in outcome ? refuse(outcome.refused) : ok(outcome.message);
  }

  if (command === "confirm-email") {
    const person = tidy(flagValue(args, "--person"));
    const code = tidy(flagValue(args, "--code"));
    if (!person || !code) {
      return refuse(OFF_TERMINAL_USAGE);
    }
    const outcome = confirmEmailVerification({
      enterpriseId: enterprise.id,
      person,
      code,
      now: commandNow(),
    });
    return "refused" in outcome ? refuse(outcome.refused) : ok(outcome.message);
  }

  if (command === "enrol") {
    const person = tidy(flagValue(args, "--person"));
    const reason = tidy(flagValue(args, "--reason"));
    if (!person || !reason) {
      return refuse(OFF_TERMINAL_USAGE);
    }
    const outcome = await startPasskeyEnrolment({
      enterpriseId: enterprise.id,
      person,
      reason,
      actor,
      now: commandNow(),
    });
    if ("refused" in outcome) {
      return refuse(outcome.refused);
    }
    return ok(outcome.offer || formatEnrolmentOffer(outcome.url, outcome.expiresAt));
  }

  if (command === "confirm") {
    const person = tidy(flagValue(args, "--person"));
    const confirmation = tidy(flagValue(args, "--confirmation"));
    if (!person || !confirmation) {
      return refuse(OFF_TERMINAL_USAGE);
    }
    const credentialId = tidy(flagValue(args, "--credential")) || undefined;
    const outcome = confirmPasskeyEnrolment({
      enterpriseId: enterprise.id,
      person,
      confirmation,
      actor,
      ...(credentialId ? { credentialId } : {}),
      now: commandNow(),
    });
    return "refused" in outcome ? refuse(outcome.refused) : ok(outcome.message);
  }

  if (command === "record-test") {
    const outcomeFlag = tidy(flagValue(args, "--outcome")).toLowerCase();
    if (outcomeFlag !== "passed" && outcomeFlag !== "failed") {
      return refuse('Say --outcome passed or --outcome failed.');
    }
    const personName = tidy(flagValue(args, "--person"));
    const recordedBy = tidy(flagValue(args, "--recorded-by"));
    const unaided = parseUnaided(flagValue(args, "--unaided"));
    if (typeof unaided === "object") {
      return refuse(unaided.refused);
    }
    const startedAt = parseTime(flagValue(args, "--started"), "when the test started, with --started", true);
    if (startedAt === undefined || (typeof startedAt === "object" && "refused" in startedAt)) {
      return refuse(startedAt && typeof startedAt === "object" ? startedAt.refused : "Say when the test started, with --started.");
    }
    const enrolledAt = parseTime(flagValue(args, "--enrolled"), "when they enrolled, with --enrolled", false);
    if (enrolledAt && typeof enrolledAt === "object" && "refused" in enrolledAt) {
      return refuse(enrolledAt.refused);
    }
    const signedOffAt = parseTime(flagValue(args, "--signed-off"), "when they signed off, with --signed-off", false);
    if (signedOffAt && typeof signedOffAt === "object" && "refused" in signedOffAt) {
      return refuse(signedOffAt.refused);
    }
    const minutesRaw = tidy(flagValue(args, "--minutes"));
    let timedMinutes: number | undefined;
    if (minutesRaw) {
      const minutes = Number(minutesRaw);
      if (!Number.isFinite(minutes) || minutes < 0) {
        return refuse("Say how many minutes the run took, with --minutes, as a number.");
      }
      timedMinutes = minutes;
    }
    const notes = tidy(flagValue(args, "--notes")) || undefined;
    const recorded = recordRealPersonTest({
      outcome: outcomeFlag,
      personName,
      recordedBy,
      startedAt,
      unaided,
      ...(typeof enrolledAt === "number" ? { enrolledAt } : {}),
      ...(typeof signedOffAt === "number" ? { signedOffAt } : {}),
      ...(timedMinutes !== undefined ? { timedMinutes } : {}),
      ...(notes ? { notes } : {}),
      now: commandNow(),
    });
    if ("refused" in recorded) {
      return refuse(recorded.refused);
    }
    const saved = getRealPersonTest() ?? recorded;
    const unaidedText = saved.unaided ? "enrolled and signed off unaided" : "needed help, so this is a fail";
    return ok(
      `Recorded: ${saved.outcome}. ${saved.personName} ${unaidedText}, recorded by ${saved.recordedBy}.`
    );
  }

  return refuse(OFF_TERMINAL_USAGE);
}
