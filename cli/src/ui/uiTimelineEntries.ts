import {
  listRuntimeEventStore,
} from "../runtime/runtimeEventStore";

import {
  formatEventMessage,
} from "../repl/eventCommands";

import {
  WorkStreamEntry,
} from "./uiState";

type UiRuntimeEvent =
  ReturnType<typeof listRuntimeEventStore>[number];

/**
 * Formats a runtime event's time as the person reading it would write it, in
 * their own time zone and naming it.
 *
 * It printed `2026-10-13T20:22:38.496Z`. A lawyer in New Zealand read that as
 * the evening of the 13th for something she approved at 9:22 on the morning of
 * the 14th, and said an insurer would ask about it. The stored event keeps its
 * timestamp; only the display changes.
 *
 * PURE: No side effects (reads the host's time zone when none is given).
 */
export function formatRuntimeEventTimestamp(
  timestamp: number,
  timeZone?: string
): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZoneName: "short",
      ...(timeZone ? { timeZone } : {}),
    })
      .formatToParts(new Date(timestamp))
      .map((part) => [part.type, part.value])
  );
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}:${parts.second} ${parts.timeZoneName}`;
}

/**
 * Purpose: Turns a stored event type into the words above a timeline entry.
 *
 * `runtime.outcome.measurement_skipped` tells a reader nothing; the message
 * underneath already says what happened in plain words, and this heading was
 * competing with it. The stored type is untouched — replay, the event store and
 * every `event.type ===` comparison still see the original string.
 *
 * A handful of types are named outright because the mechanical rewrite of them
 * is worse than useless ("Bot input" for a line the bot typed). Everything else
 * falls through to dots and underscores becoming spaces, which is enough:
 * "delegation.completed" reads as "Delegation completed".
 *
 * PURE: No side effects.
 */
export function describeRuntimeEventType(
  type: string
): string {
  const named: Record<string, string> = {
    "bot.input": "Bot typed a line",
    "bot.session_started": "Bot run started",
    "bot.session_finished": "Bot run finished",
    "runtime.outcome.measured": "Result counted towards Function health",
    "runtime.outcome.measurement_skipped": "Result not counted",
    "runtime.outcome.measurement_failed": "Result could not be counted",
    // "Runtime" is the internal word for a Function's operating state, and the
    // message underneath these already says "<Function> evaluated ...".
    "runtime.signal.evaluated": "Function checked whether work was needed",
    "runtime.signal.evaluation_failed": "Function could not check whether work was needed",
    // The heading read "Job started" over a message reading "Function started",
    // which is the contradiction the rename exists to remove.
    "job.started": "Function started",
    "job.operating_state_reset": "Function stopped and reset",
    "runtime.snapshot": "State saved",
    // These three still fell through to the mechanical rewrite, which says
    // "Runtime …" and "Scheduled-job …" — the two words the rename exists to
    // keep off the screen.
    "runtime.heartbeat": "Function still running",
    "runtime.error": "Function error",
    "scheduled-job.queued": "Scheduled Task queued",
    "scheduled-job.dispatched": "Scheduled Task dispatched",
    "scheduled-job.ignored": "Scheduled Task ignored",
    "task.node_entered": "Workflow reached a step",
    "memory.entry.added": "Lesson saved to memory",
  };
  if (named[type]) return named[type];

  // A published Event's type is built from the operator's own label, so the
  // mechanical rewrite turned "Safety review" into the heading "Business
  // safety review" — a sentence nobody wrote. The label is already the first
  // thing in the message underneath, so the heading just names the kind.
  if (type.startsWith("business.")) {
    return "Event published";
  }

  // The Job/Runtime substitution is applied here rather than trusted to the
  // caller. createTimelineWorkStreamEntry rewrites "job." to "task." before
  // calling in, so this function looked correct while anything else calling it
  // directly got "Job queued" — the heading the rename exists to remove.
  const words = type.replace(/[._-]/g, " ").trim();
  return formatEventMessage(
    words.charAt(0).toUpperCase() + words.slice(1)
  );
}

/**
 * Purpose: Converts a runtime event into a UI work stream entry.
 *
 * Params:
 * - event: Runtime event record.
 *
 * Returns:
 * - Work stream entry representing the runtime event.
 *
 * PURE: No side effects.
 */
export function createTimelineWorkStreamEntry(
  event: UiRuntimeEvent,
  timeZone?: string
): WorkStreamEntry {
  const displayType =
    event.type ===
    "runtime.started"
      ? "job.started"
      : event.type ===
          "runtime.reset"
        ? "job.operating_state_reset"
        : event.type.replace(
            /^job\./,
            "task."
          );
  return {
    actor: event.level.toUpperCase(),
    label: `#${event.sequence} · ${describeRuntimeEventType(displayType)}`,
    body: [
      formatEventMessage(
        event.message
      ),
      `time: ${formatRuntimeEventTimestamp(
        event.timestamp,
        timeZone
      )}`,
      `id: ${event.id}`,
    ].join("\n"),
  };
}

/**
 * Purpose: Converts runtime events into recent timeline entries.
 *
 * Params:
 * - events: Runtime event records.
 * - limit: Maximum number of events to include.
 *
 * Returns:
 * - Timeline work stream entries, newest first, or an empty-state message.
 *
 * PURE: No side effects.
 */
export function createTimelineEntries(
  events: readonly UiRuntimeEvent[],
  limit: number,
  timeZone?: string
): readonly WorkStreamEntry[] {
  const entries =
    events
      .slice()
      .reverse()
      .slice(
        0,
        limit
      )
      .map(
        (event) => createTimelineWorkStreamEntry(event, timeZone)
      );

  if (entries.length > 0) {
    return entries;
  }

  return [
    {
      actor: "Arturo",
      label: "Timeline",
      body: "No runtime events found.",
    },
  ];
}

/**
 * Purpose: Reads recent runtime events for the terminal UI.
 *
 * Params:
 * - limit: Maximum number of events to include.
 *
 * Returns:
 * - Work stream entries for recent runtime events.
 *
 * SIDE EFFECT:
 * - Reads runtime event store.
 */
export function readTimelineEntries(
  limit: number
): readonly WorkStreamEntry[] {
  return createTimelineEntries(
    listRuntimeEventStore(),
    limit
  );
}
