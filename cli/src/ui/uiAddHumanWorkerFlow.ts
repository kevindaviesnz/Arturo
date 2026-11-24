import {
  addWorker,
  createHumanWorker,
} from "../control/workers";

import {
  isApprovalCapableMode,
  resolveDefaultHumanWorkerMode,
} from "../control/humanWorkerMode";

import type {
  AgentArchetype,
} from "../agents/agentArchetype";

import {
  listArchetypes,
} from "../agents/archetypeRegistry";

import {
  ARCHETYPE_USES,
} from "./uiArchetypeEntries";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

import type {
  WorkStreamEntry,
} from "./uiState";

/**
 * The switch-free way to register a person: /add-human-worker with no name
 * starts a short guided conversation — name, then role by number — so a
 * non-technical operator never types "--archetype guardian". The flag form
 * still works for scripts and for the copy-paste line the staffing plan prints.
 *
 * The role a person is given decides whether they can approve governed work,
 * which is usually why they are being added at all, so the choice is put
 * plainly rather than hidden behind an archetype id.
 */

type RoleOption = {
  readonly summary: string;
  readonly archetype?: AgentArchetype;
  /** Offers every archetype instead of creating the person straight away. */
  readonly opensFullList?: boolean;
};

/**
 * The roles offered, in order. Approving is first because it is the common need.
 *
 * The short list is deliberate: a newcomer adding the one person who signs
 * things off should not have to read every archetype. The last option opens the
 * full list, so a role like "creator" — a person who produces the actual files
 * — stays reachable without a switch.
 */
const ROLE_OPTIONS: readonly RoleOption[] = [
  {
    summary: "Sign off sensitive work. If it's just you, this is you.",
    archetype: "guardian",
  },
  {
    summary: "Review work before it's delivered (can also approve and sign off).",
    archetype: "reviewer",
  },
  {
    summary: "Just do the tasks they're given (cannot sign off work or give go-aheads).",
    archetype: undefined,
  },
  {
    summary: "Something else — choose from the full list of roles.",
    archetype: undefined,
    opensFullList: true,
  },
];

type PendingState =
  | { readonly stage: "name" }
  | { readonly stage: "role"; readonly name: string }
  | { readonly stage: "archetype"; readonly name: string }
  | {
      readonly stage: "email";
      readonly name: string;
      readonly archetype: AgentArchetype | undefined;
    };

let pending: PendingState | undefined;

export function clearAddHumanWorkerFlow(): void {
  pending = undefined;
}

export function isAddHumanWorkerFlowActive(): boolean {
  return pending !== undefined;
}

/**
 * Ends a half-finished add-a-person flow because a command was typed instead.
 *
 * Left open, this flow outlives the command that interrupted it, and it is
 * checked ahead of every other flow when the next plain line arrives — so it
 * answers a question it was never asked. That is not theoretical: a person
 * half-added before `/staff` consumed the `yes` that was confirming the
 * staffing plan, reporting a person added while the Workers were silently
 * never applied.
 *
 * Returns undefined when nothing was open, so the caller adds no noise.
 *
 * SIDE EFFECT: Clears the module-level flow state.
 */
export function abandonAddHumanWorkerFlow(): string | undefined {
  if (!pending) return undefined;
  clearAddHumanWorkerFlow();
  return "adding a person";
}

/**
 * Begins the flow at the role question, for `/add-human-worker "<name>"`.
 *
 * The role decides whether the person can approve governed work, which is
 * usually the whole reason they are being added. Registering them with no role
 * silently produced someone who cannot approve, and the failure surfaced much
 * later at /approve — see isApprovalCapableMode.
 */
export function startAddHumanWorkerRole(
  name: string
): readonly WorkStreamEntry[] {
  pending = { stage: "role", name };
  return askRole();
}

/** Begins the guided flow (used when /add-human-worker is typed with no name). */
export function startAddHumanWorkerFlow(): readonly WorkStreamEntry[] {
  pending = { stage: "name" };
  return [
    {
      actor: "Arturo",
      label: "Name (eg Warehouse Lead):",
      body: "",
    },
  ];
}

function askRole(): readonly WorkStreamEntry[] {
  return [
    {
      actor: "Arturo",
      label: "Responsibilities:",
      body: [
        ...ROLE_OPTIONS.map(
          (option, index) => `${index + 1}. ${option.summary}`
        ),
        "",
        "Reply with a number, or ESC to go back.",
        "",
        // Answers the common "why can't I pick both?" — one person, one role,
        // and the other roles are for other people you can add later.
        "Most solo owners pick 1. You can add more people later, each with their own role.",
      ].join("\n"),
    },
  ];
}

/**
 * Asks for an email address.
 *
 * This is not decoration: `isContactableHumanWorker` gates the governed
 * human-contact path on it, so a person registered without one can never be
 * contacted through it. It stays optional, and stays honest about what it is —
 * Arturo neither verifies the address nor emails it off its own bat.
 */
/** Offers every registered role, for a person whose job is not one of the three. */
function askArchetype(name: string): readonly WorkStreamEntry[] {
  const archetypes = listArchetypes();
  return [
    {
      actor: "Arturo",
      label: "Which role?",
      body: [
        `What kind of work will ${name} do?`,
        "",
        ...archetypes.map(
          (archetype, index) =>
            `  ${index + 1}. ${archetype} — ${ARCHETYPE_USES[archetype]}`
        ),
        "",
        "Reply with a number, or ESC to go back.",
      ].join("\n"),
    },
  ];
}

function askEmail(name: string): readonly WorkStreamEntry[] {
  return [
    {
      actor: "Arturo",
      label: "Email address:",
      body: "",
    },
  ];
}

function createPerson(
  name: string,
  archetype: AgentArchetype | undefined,
  email: string | undefined
): readonly WorkStreamEntry[] {
  addWorker(
    createHumanWorker(
      name,
      archetype,
      email,
      "available",
      undefined
    )
  );

  broadcastEvent(
    "worker.registered",
    "success",
    `Human worker registered: ${name}`
  );

  const canApprove = isApprovalCapableMode(
    resolveDefaultHumanWorkerMode(archetype)
  );

  return [
    {
      actor: "Arturo",
      label: "Human worker added",
      body: [
        `${name} is now on your team.`,
        canApprove
          ? `${name} can now approve sensitive work. Anything waiting is under /approvals — approve it with /approve <task-id>.`
          : `${name} can be given tasks, but cannot sign off work or give go-aheads. Add someone who can with /add-human-worker if you need an approver.`,
      ].join("\n"),
    },
  ];
}

/**
 * Routes a plain-text reply to the guided add-person flow, if one is active.
 * Returns undefined when nothing is pending, so the caller can pass the reply on.
 *
 * SIDE EFFECT: May register a Human Worker and broadcast an event.
 */
export function handleAddHumanWorkerReply(
  reply: string
): readonly WorkStreamEntry[] | undefined {
  if (!pending) return undefined;

  const trimmed = reply.trim();

  if (trimmed.toLowerCase() === "cancel") {
    clearAddHumanWorkerFlow();
    return [
      {
        actor: "Arturo",
        label: "Cancelled",
        body: "No one was added.",
      },
    ];
  }

  if (pending.stage === "name") {
    if (!trimmed) {
      return [
        {
          actor: "Arturo",
          label: "Name (eg Warehouse Lead):",
          body: "Please type the person's name, or ESC to go back.",
        },
      ];
    }
    pending = { stage: "role", name: trimmed };
    return askRole();
  }

  const index = Number(trimmed);
  if (
    pending.stage === "role" &&
    (!Number.isInteger(index) || index < 1 || index > ROLE_OPTIONS.length)
  ) {
    return [
      {
        actor: "Arturo",
        label: "Responsibilities:",
        body: `Please reply with a number from 1 to ${ROLE_OPTIONS.length}.`,
      },
    ];
  }

  if (pending.stage === "role") {
    const { name } = pending;
    const option = ROLE_OPTIONS[index - 1];
    if (option.opensFullList) {
      pending = { stage: "archetype", name };
      return askArchetype(name);
    }
    pending = { stage: "email", name, archetype: option.archetype };
    return askEmail(name);
  }

  if (pending.stage === "archetype") {
    const archetypes = listArchetypes();
    if (!Number.isInteger(index) || index < 1 || index > archetypes.length) {
      return askArchetype(pending.name);
    }
    const { name } = pending;
    pending = { stage: "email", name, archetype: archetypes[index - 1] };
    return askEmail(name);
  }

  // stage: email
  const { name, archetype } = pending;
  // Enter on its own leaves it unset. The prompt no longer says "or type
  // skip", and an empty string here is worse than undefined: it reads as an
  // address that is present but blank to anything checking contactability.
  const email =
    !trimmed || trimmed.toLowerCase() === "skip" ? undefined : trimmed;
  clearAddHumanWorkerFlow();
  return createPerson(name, archetype, email);
}
