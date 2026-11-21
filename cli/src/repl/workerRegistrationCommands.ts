import {
  AgentArchetype,
} from "../agents/agentArchetype";

import {
  getEffectiveModelName,
} from "../llm/modelSelection";

import {
  archetypeRegistry,
  getArchetypeCapabilities,
} from "../agents/archetypeRegistry";

import {
  addWorker,
  createHumanWorker,
  listWorkers,
  registerAiWorker,
  workerSupportsCapabilities,
  type WorkerAvailability,
  type Worker,
} from "../control/workers";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

import {
  listJobs,
  replaceJob,
} from "../runtime/jobQueue";

import {
  resolveModelProfile,
} from "../llm/modelProfiles";

import {
  handleWorkerInspectCommand,
} from "./workerInspectionCommands";

/**
 * Purpose: Finds a flag value in worker command args.
 *
 * Params:
 * - args: Command arguments.
 * - flag: Flag name.
 *
 * Returns:
 * - Flag value or undefined.
 *
 * PURE: No side effects.
 */
export function getWorkerFlagValue(
  args: readonly string[],
  flag: string
): string | undefined {
  const equalsPrefix =
    `${flag}=`;

  const equalsValue =
    args.find(
      (arg) =>
        arg.startsWith(
          equalsPrefix
        )
    );

  if (equalsValue) {
    return equalsValue.slice(
      equalsPrefix.length
    );
  }

  const flagIndex =
    args.indexOf(
      flag
    );

  if (flagIndex === -1) {
    return undefined;
  }

  return args[flagIndex + 1];
}

/**
 * Purpose: Removes a flag and its value from worker command args.
 *
 * Params:
 * - args: Command arguments.
 * - flag: Flag name.
 *
 * Returns:
 * - Args without the flag pair.
 *
 * PURE: No side effects.
 */
export function removeWorkerFlagPair(
  args: readonly string[],
  flag: string
): readonly string[] {
  const equalsPrefix =
    `${flag}=`;

  const flagIndex =
    args.findIndex(
      (arg) =>
        arg === flag ||
        arg.startsWith(
          equalsPrefix
        )
    );

  if (flagIndex === -1) {
    return args;
  }

  const isEqualsForm =
    args[flagIndex].startsWith(
      equalsPrefix
    );

  return args.filter(
    (_arg, index) =>
      isEqualsForm
        ? index !== flagIndex
        : index !== flagIndex &&
          index !== flagIndex + 1
  );
}

/**
 * Purpose: Formats a worker capability for Chapter 6 display.
 *
 * Params:
 * - capability: Raw capability name.
 *
 * Returns:
 * - Human-readable capability name.
 *
 * PURE: No side effects.
 */
export function formatWorkerCapabilityLabel(
  capability: string
): string {

const labels: Record<string, string> = {
  llm: "General reasoning",
  writing: "Writing",
  research: "Research",
  review: "Review",
  "human-review": "Approve",
  summarisation: "Summarisation",
  analysis: "Analysis",
  planning: "Planning",
  coordination: "Coordination",
  safety: "Product Safety",
};

  return labels[capability] ??
    capability
      .replace(
        /-/g,
        " "
      )
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      );
}

/**
 * Purpose: Formats worker capabilities for Chapter 6 registration output.
 *
 * Params:
 * - worker: Registered worker.
 *
 * Returns:
 * - Capability display lines.
 *
 * PURE: No side effects.
 */
export function formatWorkerCapabilityLines(
  worker: Worker<any, any>
): readonly string[] {
  const capabilities =
    worker.capabilities ?? [];

  if (capabilities.length === 0) {
    return [
      "  none",
    ];
  }

  return capabilities
    .map(
      (capability) =>
        `  ${formatWorkerCapabilityLabel(
          capability
        )}`
    );
}

/**
 * Purpose: Formats Worker registration output for book-facing commands.
 *
 * Params:
 * - worker: Registered worker.
 *
 * Returns:
 * - Human-readable Worker registration output.
 *
 * PURE: No side effects.
 */
export function formatWorkerRegistered(
  worker: Worker<any, any>
): string {
  const typeLabel =
    worker.kind === "human"
      ? "Human"
      : "AI";

  if (worker.kind === "human") {
    return [
      "✓ Worker registered",
      "",
      "Name:",
      `  ${worker.displayName ?? worker.name}`,
      "",
      "Type:",
      `  ${typeLabel}`,
      "",
      "Archetype:",
      `  ${worker.archetype ?? "none"}`,
      "",
      "Email:",
      `  ${worker.email ?? "none"}`,
      "",
      "Availability:",
      `  ${worker.availability ?? "available"}`,
      "",
      "Refinement:",
      `  ${worker.refinement ?? "none"}`,
      "",
      "Capabilities:",
      ...formatWorkerCapabilityLines(
        worker
      ),
    ].join("\n");
  }

  return [
    "✓ Worker registered",
    "",
    "Name:",
    `  ${worker.displayName ?? worker.name}`,
    "",
    "Archetype:",
    `  ${worker.archetype ?? "assistant"}`,
    "",
    "Model:",
    `  ${worker.model ?? "none"}`,
    "",
    "Refinement:",
    `  ${worker.refinement ?? "none"}`,
    "",
    "Availability:",
    `  ${worker.availability ?? "available"}`,
    "",
    "Capabilities:",
    ...formatWorkerCapabilityLines(
      worker
    ),
  ].join("\n");
}

/**
 * Purpose: Completes the first running unassigned Job after a Worker is registered.
 *
 * Params:
 * - worker: Registered worker.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Reads and mutates the Job queue.
 * - Broadcasts worker assignment and job completion Events.
 */
export function assignQueuedJobsToWorker(
  worker: Worker<any, any>
): number {
  const matchingJobs = listJobs().filter(
    (job) =>
      job.status === "queued" &&
      !job.worker &&
      Boolean(job.requiredCapabilities?.length) &&
      workerSupportsCapabilities(
        worker,
        job.requiredCapabilities ?? []
      )
  );

  matchingJobs.forEach((job) => {
    replaceJob({
      ...job,
      worker: worker.name,
      selectedWorker: worker.name,
      routingReason: `Assigned when ${worker.name} registered with ${job.requiredCapabilities?.join(", ")}`,
    });

    broadcastEvent(
      "worker.assigned",
      "success",
      `Worker ${worker.displayName ?? worker.name} assigned to Task ${job.id}`
    );
  });

  return matchingJobs.length;
}

/**
 * Purpose: Registers a Worker from /worker add args.
 *
 * Params:
 * - args: Command arguments after "add".
 *
 * Returns:
 * - Registered Worker or error text.
 *
 * SIDE EFFECT:
 * - Registers a Worker.
 * - Broadcasts a Worker registration Event.
 * - May complete the first running unassigned Job.
 */
export function registerWorkerFromArgs(
  args: readonly string[]
):
  | {
      readonly ok: true;
      readonly worker: Worker<any, any>;
    }
  | {
      readonly ok: false;
      readonly message: string;
    } {
  const workerType =
    getWorkerFlagValue(
      args,
      "--type"
    ) ?? "ai";

  const model =
    getWorkerFlagValue(
      args,
      "--model"
    );

  const refinement =
    getWorkerFlagValue(
      args,
      "--refine"
    );

  const email =
    getWorkerFlagValue(
      args,
      "--email"
    );

  const availabilityRaw =
    getWorkerFlagValue(
      args,
      "--availability"
    ) ?? "available";

  if (
    args.some(
      (arg) =>
        arg === "--capabilities" ||
        arg.startsWith("--capabilities=")
    )
  ) {
    return {
      ok: false,
      message:
        "Worker capabilities are derived from the selected archetype. Remove --capabilities and choose an archetype that provides the required capability.",
    };
  }

  const archetypeRaw =
    getWorkerFlagValue(
      args,
      "--archetype"
    ) ?? (
      workerType === "ai"
        ? "assistant"
        : undefined
    );

  const positionalArgs =
    removeWorkerFlagPairs(
      args,
      [
        "--type",
        "--archetype",
        "--model",
        "--refine",
        "--email",
        "--availability",
      ]
    );

  const [
    name,
  ] = positionalArgs;

  if (!name) {
    return {
      ok: false,
      message:
        'Usage: /worker add "<name>" [--type ai|human] [--archetype <archetype>] [--refine "<specialization>"] [--email "<email>"] [--availability <available|busy|offline>]',
    };
  }

  if (
    workerType !== "ai" &&
    workerType !== "human"
  ) {
    return {
      ok: false,
      message:
        `unknown worker type: ${workerType}`,
    };
  }

  if (
    ![
      "available",
      "busy",
      "offline",
    ].includes(
      availabilityRaw
    )
  ) {
    return {
      ok: false,
      message: `unknown availability: ${availabilityRaw}\nallowed availability: available, busy, offline`,
    };
  }

  // The model is chosen in one place — /model — and holds until it is changed
  // there. A per-Worker model was never passed to the provider anyway, so it
  // only put a second, contradicting name in the Worker record.
  if (model) {
    return {
      ok: false,
      message:
        workerType === "human"
          ? "Human Workers do not use AI models. Use --archetype, --availability, and --refine to describe their participation."
          : "--model has been replaced by the /model command. Run /model to choose which AI model Arturo uses; every Worker uses that choice until you change it there.",
    };
  }

  if (workerType === "human") {
    if (
      archetypeRaw &&
      !archetypeRegistry[
        archetypeRaw as AgentArchetype
      ]
    ) {
      return {
        ok: false,
        message: [
          `unknown archetype: ${archetypeRaw}`,
          `allowed archetypes: ${Object.keys(archetypeRegistry).join(", ")}`,
        ].join("\n"),
      };
    }

    const worker =
      createHumanWorker(
        name,
        archetypeRaw as AgentArchetype | undefined,
        email,
        availabilityRaw as WorkerAvailability,
        refinement
      );

    addWorker(
      worker
    );

    assignQueuedJobsToWorker(
      worker
    );

    broadcastEvent(
      "worker.registered",
      "success",
      `Human worker registered: ${worker.displayName ?? worker.name}`
    );

    return {
      ok: true,
      worker,
    };
  }

  const definition =
    archetypeRegistry[
      archetypeRaw as AgentArchetype
    ];

  if (!definition) {
    return {
      ok: false,
      message: [
        `unknown archetype: ${archetypeRaw}`,
        `allowed archetypes: ${Object.keys(archetypeRegistry).join(", ")}`,
      ].join("\n"),
    };
  }

  // Whatever /model currently selects. The Worker record names it for the
  // operator's benefit; execution and attestation read the live choice, so
  // changing /model changes what actually runs.
  const resolvedModel = getEffectiveModelName();

  const worker =
    registerAiWorker(
      name,
      archetypeRaw as AgentArchetype,
      resolvedModel,
      refinement
    );

  broadcastEvent(
    "worker.registered",
    "success",
    `Worker registered: ${worker.displayName ?? worker.name} (total: ${listWorkers().length})`
  );

  assignQueuedJobsToWorker(
    worker
  );

  return {
    ok: true,
    worker,
  };
}

/**
 * Purpose: Removes multiple flag/value pairs from worker command args.
 *
 * Params:
 * - args: Command arguments.
 * - flags: Flag names to remove.
 *
 * Returns:
 * - Args without the supplied flag pairs.
 *
 * PURE: No side effects.
 */
export function removeWorkerFlagPairs(
  args: readonly string[],
  flags: readonly string[]
): readonly string[] {
  return flags.reduce(
    (currentArgs, flag) =>
      removeWorkerFlagPair(
        currentArgs,
        flag
      ),
    args
  );
}

/**
 * Purpose: Handles /worker add.
 *
 * Params:
 * - args: Command arguments after "add".
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Registers a Worker through registerWorkerFromArgs.
 * - May complete the first running unassigned Job.
 * - May broadcast Worker registration, Worker assignment, and Job completion Events.
 * - Writes CLI output.
 */
export function handleWorkerAddCommand(
  args: readonly string[]
): void {
  const result =
    registerWorkerFromArgs(
      args
    );

  if (!result.ok) {
    console.log(
      result.message
    );

    return;
  }

  console.log(
    formatWorkerRegistered(
      result.worker
    )
  );
}

/**
 * Purpose: Handles /worker commands.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - May register Workers.
 * - May inspect Workers.
 * - Writes CLI output.
 */
export function handleWorkerCommand(
  args: readonly string[]
): void {
  const [
    subcommand,
    ...subcommandArgs
  ] = args;

  if (subcommand === "add") {
    handleWorkerAddCommand(
      subcommandArgs
    );

    return;
  }

  if (subcommand === "inspect") {
    handleWorkerInspectCommand(
      subcommandArgs
    );

    return;
  }

  console.log(
    [
      "Usage:",
      '  /worker add "<name>" --type ai --archetype <archetype> [--refine "<specialization>"]',
      '  /worker add "<name>" --type human [--archetype <archetype>] [--email "<email>"] [--availability <available|busy|offline>] [--refine "<specialization>"]',
      '  /workers inspect "<worker-name>"',
    ].join("\n")
  );
}

/**
 * Handles the legacy /add-ai-worker command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Registers an AI worker.
 * - Broadcasts runtime event.
 * - Writes CLI output.
 */
export function handleAddAiWorkerCommand(
  args: readonly string[]
): void {
  if (
    args.some(
      (arg) =>
        arg.startsWith("--")
    )
  ) {
    const archetype =
      getWorkerFlagValue(
        args,
        "--archetype"
      );
    if (!archetype) {
      console.log(
        'Usage: /add-ai-worker "<name>" --archetype <archetype> [--refine "<specialization>"]'
      );
      return;
    }
    const result =
      registerWorkerFromArgs([
        ...args,
        "--type",
        "ai",
      ]);
    console.log(
      result.ok
        ? formatWorkerRegistered(
            result.worker
          )
        : result.message
    );
    return;
  }

  const [
    name,
    archetypeRaw,
  ] = args;

  if (!name) {
    console.log(
      'Usage: /add-ai-worker "<name>" --archetype <archetype> [--refine "<specialization>"]'
    );

    return;
  }

  const archetype =
    archetypeRaw ?? "assistant";

  const definition =
    archetypeRegistry[
      archetype as AgentArchetype
    ];

  if (!definition) {
    console.log(
      `unknown archetype: ${archetype}`
    );

    console.log(
      `allowed archetypes: ${Object.keys(archetypeRegistry).join(", ")}`
    );

    return;
  }

  addWorker({
    name,
    kind: "ai",
    archetype:
      archetype as AgentArchetype,
    // Whatever /model currently selects; execution reads the live choice.
    model: getEffectiveModelName(),
    availability: "available",
    trust: false,
    capabilities: [
      ...getArchetypeCapabilities(
        archetype as AgentArchetype
      ),
    ],
    run: function* (
      ctx: any
    ) {
      return ctx;
    },
  });

  console.log(
    `AI worker added: ${name}`
  );

  console.log(
    `archetype: ${archetype}`
  );

  broadcastEvent(
    "worker.registered",
    "success",
    `AI worker registered: ${name} (total: ${listWorkers().length})`
  );
}

/**
 * Handles the legacy /add-human-worker command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Registers a human worker.
 * - Broadcasts runtime event.
 * - Writes CLI output.
 */
export function handleAddHumanWorkerCommand(
  args: readonly string[]
): void {
  if (
    args.some(
      (arg) =>
        arg.startsWith("--")
    )
  ) {
    const result =
      registerWorkerFromArgs([
        ...args,
        "--type",
        "human",
      ]);
    console.log(
      result.ok
        ? formatWorkerRegistered(
            result.worker
          )
        : result.message
    );
    return;
  }

  const [
    name,
    archetypeRaw,
    email,
  ] = args;

  if (!name) {
    console.log(
      'Usage: /add-human-worker "<name>" [--archetype <archetype>] [--email "<email>"] [--availability <available|busy|offline>] [--refine "<specialization>"]'
    );

    return;
  }

  const archetype =
    archetypeRaw as
      AgentArchetype | undefined;

  if (
    archetype &&
    !archetypeRegistry[
      archetype
    ]
  ) {
    console.log(
      `unknown archetype: ${archetype}`
    );

    return;
  }

  addWorker(
    createHumanWorker(
      name,
      archetype,
      email
    )
  );

  console.log(
    `Human worker added: ${name}`
  );

  if (archetype) {
    console.log(
      `archetype: ${archetype}`
    );
  }

  broadcastEvent(
    "worker.registered",
    "success",
    `Human worker registered: ${name}`
  );
}
