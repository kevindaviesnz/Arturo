/**
 * The real-person test gate: one real person who does not use the
 * terminal enrols a passkey and signs off one result from their own
 * phone, unaided and timed, on the in-repo path through the business's
 * own tunnel (off-terminal sign-off brief). If they cannot, the rest
 * is not built. The hosted relay is not part of this test.
 *
 * SIDE EFFECT: May write the runtime database.
 */

import {
  clearPersistedRealPersonTest,
  loadRealPersonTestRow,
  saveRealPersonTestRow,
} from "../storage/realPersonTestRepository";

export type RealPersonTestOutcome = "not_run" | "passed" | "failed";

export type RealPersonTestRecord = {
  readonly outcome: "passed" | "failed";
  readonly personName: string;
  readonly recordedBy: string;
  readonly recordedAt: number;
  readonly startedAt: number;
  readonly enrolledAt?: number;
  readonly signedOffAt?: number;
  readonly unaided: boolean;
  readonly timedMinutes?: number;
  readonly notes?: string;
};

export function getRealPersonTest(): RealPersonTestRecord | undefined {
  const row = loadRealPersonTestRow();
  if (!row) {
    return undefined;
  }
  try {
    return JSON.parse(row) as RealPersonTestRecord;
  } catch {
    return undefined;
  }
}

export function realPersonTestOutcome(): RealPersonTestOutcome {
  return getRealPersonTest()?.outcome ?? "not_run";
}

export function isRealPersonTestPassed(): boolean {
  const record = getRealPersonTest();
  return record?.outcome === "passed" && record.unaided === true;
}

/**
 * Records the result of the real-person test. A pass requires that the
 * person was unaided. This does not start the test; a person has to run it.
 */
export function recordRealPersonTest(input: {
  readonly outcome: "passed" | "failed";
  readonly personName: string;
  readonly recordedBy: string;
  readonly startedAt: number;
  readonly enrolledAt?: number;
  readonly signedOffAt?: number;
  readonly unaided: boolean;
  readonly timedMinutes?: number;
  readonly notes?: string;
  readonly now?: number;
}): RealPersonTestRecord | { readonly refused: string } {
  if (!input.personName.trim() || !input.recordedBy.trim()) {
    return { refused: "Name the person who ran the test, and who is recording it." };
  }
  if (input.outcome === "passed" && !input.unaided) {
    return { refused: "This test only passes if the person enrolled and signed off without help." };
  }
  const record: RealPersonTestRecord = {
    outcome: input.outcome,
    personName: input.personName.trim(),
    recordedBy: input.recordedBy.trim(),
    recordedAt: input.now ?? Date.now(),
    startedAt: input.startedAt,
    unaided: input.unaided,
    ...(input.enrolledAt !== undefined ? { enrolledAt: input.enrolledAt } : {}),
    ...(input.signedOffAt !== undefined ? { signedOffAt: input.signedOffAt } : {}),
    ...(input.timedMinutes !== undefined ? { timedMinutes: input.timedMinutes } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
  };
  saveRealPersonTestRow(JSON.stringify(record));
  return record;
}

/** What Kevin (or the owner) must do, in order, on the business's own tunnel. */
export function formatRealPersonTestInstructions(): string {
  return [
    "Real-person test gate (business's own tunnel; the hosted relay is not used).",
    "If the person cannot enrol and sign off without help, the rest is not built.",
    "",
    "1. On this computer, set two environment variables (do not commit them):",
    "   APPROVAL_SIGNING_SECRET — at least 32 characters, not a placeholder",
    "   PUBLIC_BASE_URL — https:// plus your hostname, not an IP, for example https://sign.yourbusiness.example",
    "2. Put a TLS certificate for that hostname on this computer. TLS must end here.",
    "3. Start the Arturo sign-off listener:",
    "   npx ts-node scripts/startOffTerminalListener.ts",
    "   It listens only on 127.0.0.1 and will print the port.",
    "4. Point your own tunnel or reverse proxy at that port, passing through TLS or",
    "   terminating TLS on this computer and forwarding to 127.0.0.1. Do not use a",
    "   hosted relay that decrypts the traffic.",
    "5. At the terminal, turn off-terminal sign-off on (typed reason, email notice):",
    '     /off-terminal on --reason "<why, in your own words>" --notify-to "<your email>"',
    "   Wait 12 hours. Check the wait with /off-terminal status. Or cancel if you change",
    '   your mind (anyone who can sign off may cancel): /off-terminal cancel --as "<your name>"',
    "   The owner can turn it off at once with /off-terminal off.",
    "6. Record and verify email addresses (one-time code) for you and for the test person:",
    '     /off-terminal verify-email --person "<name>" --address "<email>"',
    '     /off-terminal confirm-email --person "<name>" --code "<the code from the email>"',
    "7. Give that person an account and the right to sign off work. Run /staff later and",
    "   give them the sign-off right. (If it is just you, /setup already did this when you",
    '   chose "just me".)',
    "8. Start a device-check setup for them (typed reason). They get a 30-minute link:",
    '     /off-terminal enrol --person "<name>" --reason "<why, in your own words>"',
    "9. They open the link on their own phone and set up the device check, without help.",
    "   Time this. They never use the Arturo computer.",
    "10. Wait 12 hours. Then confirm at the terminal only if they told you themselves",
    "    that they set it up, after you check with them through another channel",
    "    (a call or in person). Type a confirmation that names them, not only yes:",
    '     /off-terminal confirm --person "<name>" --confirmation "<text that names them>"',
    "11. Finish a Task so a draft is waiting. Create one with /task create. A sign-off",
    "    email is sent if this path is on.",
    "12. They open the link on their phone, check it's them, read the draft, and sign it off,",
    "    without help. Time the whole run. There is no terminal command for this step.",
    "13. Record whether it passed: the person must have enrolled and signed off unaided.",
    "    If they needed help, record a fail. If they could not, the rest is not built:",
    '     /off-terminal record-test --outcome passed --person "<name>" --recorded-by "<your name>" --unaided yes --started now --minutes <n>',
    '     /off-terminal record-test --outcome failed --person "<name>" --recorded-by "<your name>" --unaided no --started now',
  ].join("\n");
}

export function clearRealPersonTest(): void {
  clearPersistedRealPersonTest();
}
