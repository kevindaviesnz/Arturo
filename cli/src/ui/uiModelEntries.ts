import {
  execFileSync,
  spawn,
} from "node:child_process";

import {
  getSelectedModel,
  setSelectedModel,
} from "../llm/modelSelection";

import {
  getModelRoutingStatus,
} from "../llm/modelRouting";

import {
  checkOllamaAvailability,
  pullOllamaModel,
} from "../llm/ollamaStatus";

import {
  CLOUD_CATALOG,
  LOCAL_CATALOG,
  apiKeyEnvVar,
  apiKeyHelpUrl,
  providerLabel,
  type CatalogModel,
} from "../llm/modelCatalog";

import {
  assessModelFit,
  describeModelUnfit,
  machineMemoryGb,
} from "../llm/modelFit";

import {
  hasApiKey,
  looksLikePlausibleKey,
  saveApiKey,
} from "../llm/apiKeyStore";

import {
  isInteractiveSession,
} from "../core/interactivity";

import type {
  WorkStreamEntry,
} from "./uiState";

/**
 * /model — choose which AI model Arturo uses, entirely by picking from a list
 * and typing plain values. No switches.
 *
 * Rules this command lives by:
 * - Arturo never uses a paid model unless the operator picks one here and
 *   confirms the cost. A paid pick is an informed opt-in, never a default.
 * - A paid model that needs an API key prompts for it and saves it, so the
 *   operator never edits a config file.
 * - Anything that downloads or installs happens only after a yes to a question
 *   that said exactly what would happen.
 * - When the local model server is missing, the command walks the operator
 *   through getting one, rather than printing a connection error.
 */

type ModelChoice =
  | {
      readonly kind: "installed-local";
      readonly model: string;
    }
  | {
      readonly kind: "download-local";
      readonly entry: CatalogModel;
    }
  | {
      readonly kind: "cloud";
      readonly entry: CatalogModel;
    }
  | {
      readonly kind: "custom-local";
    };

type PendingModelState =
  | {
      readonly stage: "choose";
      readonly choices: readonly ModelChoice[];
    }
  | {
      readonly stage: "confirm-download";
      readonly model: string;
    }
  | {
      readonly stage: "enter-custom-local";
    }
  | {
      readonly stage: "confirm-cloud";
      readonly provider: "gemini" | "anthropic" | "openai";
      readonly model: string;
    }
  | {
      readonly stage: "enter-api-key";
      readonly provider: "gemini" | "anthropic" | "openai";
      readonly model: string;
    }
  | {
      readonly stage: "confirm-install-ollama";
    };

let pendingModel: PendingModelState | undefined;

export function clearPendingModelState(): void {
  pendingModel = undefined;
}

/**
 * True while a /model menu is waiting for the operator's reply. The reply
 * router uses this to let the open model menu own the next reply, ahead of any
 * stale yes/no confirmation — otherwise a pending "create these?" confirmation
 * would swallow the model pick the operator was invited to make.
 */
export function isModelMenuActive(): boolean {
  return pendingModel !== undefined;
}

/** True when the reply reads as yes. */
function isYes(reply: string): boolean {
  const normalized = reply.trim().toLowerCase();
  return normalized === "yes" || normalized === "y";
}

/** Whether a command exists on this machine. */
function commandExists(name: string): boolean {
  try {
    execFileSync("/usr/bin/which", [name], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function describeChoice(
  choice: ModelChoice,
  activeModel: string
): string {
  switch (choice.kind) {
    case "installed-local": {
      const marker = choice.model === activeModel ? "   ← in use now" : "";
      return `${choice.model} — on this computer, free.${marker}`;
    }
    case "download-local": {
      // Said on the row itself, not only on refusal. "Needs a powerful
      // computer" is advice about computers in general; "too big for this
      // computer" is a fact about the one the operator is sitting at.
      const tooBig = choice.entry.approximateGb !== undefined &&
        !assessModelFit({
          approximateGb: choice.entry.approximateGb,
          machineGb: machineMemoryGb(),
        }).fits;
      return tooBig
        ? `${choice.entry.model} — too big for this computer (${choice.entry.sizeHint ?? "size varies"}). ${choice.entry.note}`
        : `${choice.entry.model} — free, needs downloading (${choice.entry.sizeHint ?? "size varies"}). ${choice.entry.note}`;
    }
    case "cloud":
      return `${choice.entry.model} — paid, online. ${choice.entry.note}`;
    case "custom-local":
      return "Something else — type the name of any local model yourself.";
  }
}

/**
 * Handles /model: shows what is available and starts a numbered choice.
 *
 * SIDE EFFECT:
 * - One HTTP request to the local model server.
 * - Sets the module-level pending choice state.
 */
export async function handleUiModelCommand(): Promise<readonly WorkStreamEntry[]> {
  clearPendingModelState();

  const availability = await checkOllamaAvailability();
  const routing = getModelRoutingStatus();
  const selected = getSelectedModel();
  const activeModel = selected?.model ?? routing.localModel;

  if (!availability.reachable) {
    return handleOllamaUnavailable();
  }

  const installed = new Set(availability.models);

  const choices: ModelChoice[] = [
    ...availability.models.map(
      (model): ModelChoice => ({ kind: "installed-local", model })
    ),
    ...LOCAL_CATALOG
      .filter((entry) => !installed.has(entry.model))
      .map((entry): ModelChoice => ({ kind: "download-local", entry })),
    ...CLOUD_CATALOG.map(
      (entry): ModelChoice => ({ kind: "cloud", entry })
    ),
    { kind: "custom-local" },
  ];

  pendingModel = { stage: "choose", choices };

  return [
    {
      actor: "Arturo",
      label: "Choose a model",
      body: [
        `Arturo is using: ${selected && selected.provider !== "ollama" ? `${selected.model} (paid, online)` : `${activeModel} (free, on this computer)`}`,
        "",
        "Free models run on this computer and keep your work private.",
        "Paid models run online, cost money, and need an API key (Arturo will ask).",
        "",
        ...choices.map(
          (choice, index) =>
            `${index + 1}. ${describeChoice(choice, activeModel)}`
        ),
        "",
        "Reply with a number to choose, or anything else to keep what you have.",
      ].join("\n"),
    },
  ];
}

/**
 * Explains a missing local model server and offers to fix it, with consent.
 */
function handleOllamaUnavailable(): readonly WorkStreamEntry[] {
  const hasOllamaBinary = commandExists("ollama");
  const hasBrew = commandExists("brew");

  if (hasOllamaBinary) {
    return [
      {
        actor: "Arturo",
        label: "Local model server not running",
        body: [
          "Ollama is installed on this computer, but it isn't running, so Arturo has no model to think with.",
          "",
          "Start it from another terminal window with:",
          "  ollama serve",
          "",
          "Or, if you installed it as the desktop app, open the Ollama app.",
          "Then run /model again.",
        ].join("\n"),
      },
    ];
  }

  if (hasBrew && isInteractiveSession()) {
    pendingModel = { stage: "confirm-install-ollama" };
    return [
      {
        actor: "Arturo",
        label: "No local model server",
        body: [
          "Arturo thinks using a free AI model that runs on this computer, through a program called Ollama — and Ollama isn't installed yet.",
          "",
          "Arturo can install it for you now using Homebrew. That runs:",
          "  brew install ollama",
          "",
          'Reply "yes" to install it, or anything else to skip.',
          "(Arturo never uses a paid online service unless you choose one in /model.)",
        ].join("\n"),
      },
    ];
  }

  return [
    {
      actor: "Arturo",
      label: "No local model server",
      body: [
        "Arturo thinks using a free AI model that runs on this computer, through a program called Ollama — and Ollama isn't installed yet.",
        "",
        "To set it up:",
        "  1. Install Ollama from https://ollama.com/download",
        "  2. Open it (or run: ollama serve)",
        "  3. Run /model here again — Arturo will help you download a model.",
      ].join("\n"),
    },
  ];
}

/** Applies a local model choice and confirms it in plain words. */
function selectLocalModel(model: string): readonly WorkStreamEntry[] {
  setSelectedModel({ provider: "ollama", model });
  return [
    {
      actor: "Arturo",
      label: "Model changed",
      body: [
        `Arturo now thinks using ${model}, running free on this computer.`,
        "This choice is remembered next time you open Arturo.",
      ].join("\n"),
    },
  ];
}

/** Applies a cloud model choice (its key is already set). */
function selectCloudModel(
  provider: "gemini" | "anthropic" | "openai",
  model: string
): readonly WorkStreamEntry[] {
  setSelectedModel({ provider, model });
  return [
    {
      actor: "Arturo",
      label: "Model changed",
      body: [
        `Arturo now thinks using ${model} on ${providerLabel(provider)} — a paid online service.`,
        "You can switch back to a free local model any time by running /model.",
      ].join("\n"),
    },
  ];
}

/** Starts the cost confirmation for a cloud model. */
function beginCloudConfirmation(
  provider: "gemini" | "anthropic" | "openai",
  model: string
): readonly WorkStreamEntry[] {
  pendingModel = { stage: "confirm-cloud", provider, model };
  return [
    {
      actor: "Arturo",
      label: "This one costs money",
      body: [
        `${model} runs online on ${providerLabel(provider)}. Using it sends your work to that service and costs money for each use.`,
        "",
        'Reply "yes" to use it, or anything else to stay with a free local model.',
      ].join("\n"),
    },
  ];
}

/** Either selects the cloud model or asks for its API key first. */
function proceedWithCloud(
  provider: "gemini" | "anthropic" | "openai",
  model: string
): readonly WorkStreamEntry[] {
  const keyVar = apiKeyEnvVar(provider);

  if (keyVar && hasApiKey(keyVar)) {
    clearPendingModelState();
    return selectCloudModel(provider, model);
  }

  pendingModel = { stage: "enter-api-key", provider, model };
  const url = apiKeyHelpUrl(provider);
  return [
    {
      actor: "Arturo",
      label: "Paste your API key",
      body: [
        `${providerLabel(provider)} needs an API key to use ${model}.`,
        ...(url ? [`Get one (free to create) at: ${url}`] : []),
        "",
        "Paste the key here and press enter. Arturo saves it privately on this",
        "computer (in your .env file) and never shows it again.",
        "",
        "Or type anything short to cancel and stay with a free local model.",
      ].join("\n"),
    },
  ];
}

/**
 * Routes a plain-text reply to the pending /model question, when there is one.
 *
 * Returns undefined when /model is not waiting on anything, so the caller can
 * pass the reply along to other continuations.
 *
 * SIDE EFFECT:
 * - May download a model (after a yes).
 * - May install Ollama through Homebrew (after a yes).
 * - May write an API key to .env (when one is pasted).
 * - May persist the model selection.
 */
export async function handleUiModelReply(
  reply: string
): Promise<readonly WorkStreamEntry[] | undefined> {
  if (!pendingModel) return undefined;

  const state = pendingModel;

  if (state.stage === "choose") {
    const index = Number(reply.trim());
    if (
      !Number.isInteger(index) ||
      index < 1 ||
      index > state.choices.length
    ) {
      clearPendingModelState();
      return [
        {
          actor: "Arturo",
          label: "Model unchanged",
          body: "Kept the model you already had. Run /model any time to look again.",
        },
      ];
    }

    const choice = state.choices[index - 1];

    if (choice.kind === "installed-local") {
      clearPendingModelState();
      return selectLocalModel(choice.model);
    }

    if (choice.kind === "custom-local") {
      pendingModel = { stage: "enter-custom-local" };
      return [
        {
          actor: "Arturo",
          label: "Type a model name",
          body: [
            "Type the exact name of the local model you want, as Ollama lists it",
            "(for example: llama3.1:8b or qwen2.5:14b).",
            "",
            "Arturo will use it if it's installed, or offer to download it.",
          ].join("\n"),
        },
      ];
    }

    if (choice.kind === "download-local") {
      // Refused before the download, not after it. The download is the
      // expensive part — 40 GB and 21 minutes on the run that prompted this —
      // and it buys a model that cannot start.
      const unfit = choice.entry.approximateGb === undefined
        ? undefined
        : describeModelUnfit({
            model: choice.entry.model,
            approximateGb: choice.entry.approximateGb,
            machineGb: machineMemoryGb(),
          });
      if (unfit) {
        clearPendingModelState();
        return [
          {
            actor: "Arturo",
            label: "That model is too big for this computer",
            body: [
              unfit,
              "",
              "Nothing was downloaded and your model is unchanged.",
              "Run /model again to pick one that will run here.",
            ].join("\n"),
          },
        ];
      }

      pendingModel = { stage: "confirm-download", model: choice.entry.model };
      return [
        {
          actor: "Arturo",
          label: "Download needed",
          body: [
            `${choice.entry.model} isn't on this computer yet (${choice.entry.sizeHint ?? "size varies"}). Arturo can download it now — this may take a while.`,
            "",
            'Reply "yes" to download it, or anything else to cancel.',
          ].join("\n"),
        },
      ];
    }

    // cloud
    return beginCloudConfirmation(choice.entry.provider as "gemini" | "anthropic" | "openai", choice.entry.model);
  }

  if (state.stage === "enter-custom-local") {
    const model = reply.trim();
    if (!model || /\s/.test(model)) {
      clearPendingModelState();
      return [
        {
          actor: "Arturo",
          label: "Model unchanged",
          body: "That didn't look like a model name, so nothing changed. Run /model to try again.",
        },
      ];
    }

    const availability = await checkOllamaAvailability();
    const installed =
      availability.reachable && availability.models.includes(model);

    if (installed) {
      clearPendingModelState();
      return selectLocalModel(model);
    }

    pendingModel = { stage: "confirm-download", model };
    return [
      {
        actor: "Arturo",
        label: "Download needed",
        body: [
          `${model} isn't on this computer yet. Arturo can download it now — this may take a while.`,
          "",
          'Reply "yes" to download it, or anything else to cancel.',
        ].join("\n"),
      },
    ];
  }

  if (state.stage === "confirm-download") {
    clearPendingModelState();
    if (!isYes(reply)) {
      return [
        {
          actor: "Arturo",
          label: "Download cancelled",
          body: "Nothing was downloaded, and the model you had is unchanged.",
        },
      ];
    }

    const result = await pullOllamaModel(
      state.model,
      (line) => console.log(line)
    );

    if (!result.ok) {
      return [
        {
          actor: "Arturo",
          label: "Download failed",
          body: [
            result.reason,
            "The model you had is unchanged.",
          ].join("\n"),
        },
      ];
    }

    return selectLocalModel(state.model);
  }

  if (state.stage === "confirm-cloud") {
    if (!isYes(reply)) {
      clearPendingModelState();
      return [
        {
          actor: "Arturo",
          label: "Staying local",
          body: "Kept the free local model. Nothing was sent anywhere.",
        },
      ];
    }
    return proceedWithCloud(state.provider, state.model);
  }

  if (state.stage === "enter-api-key") {
    const key = reply.trim();
    if (!looksLikePlausibleKey(key)) {
      clearPendingModelState();
      return [
        {
          actor: "Arturo",
          label: "Staying local",
          body: [
            "That didn't look like an API key, so nothing was saved and Arturo",
            "kept the free local model. Run /model to try again.",
          ].join("\n"),
        },
      ];
    }

    const keyVar = apiKeyEnvVar(state.provider);
    if (keyVar) {
      saveApiKey(keyVar, key);
    }
    clearPendingModelState();
    return selectCloudModel(state.provider, state.model);
  }

  // confirm-install-ollama
  clearPendingModelState();
  if (!isYes(reply)) {
    return [
      {
        actor: "Arturo",
        label: "Nothing installed",
        body: "Skipped. Install Ollama from https://ollama.com/download any time, then run /model again.",
      },
    ];
  }

  return installOllamaWithBrew();
}

/**
 * Installs and starts Ollama through Homebrew, after explicit consent.
 *
 * SIDE EFFECT: Runs `brew install ollama` and starts the server.
 */
async function installOllamaWithBrew(): Promise<readonly WorkStreamEntry[]> {
  console.log("Installing Ollama with Homebrew — this can take a few minutes…");

  const installed = await new Promise<boolean>((resolve) => {
    const child = spawn("brew", ["install", "ollama"], {
      stdio: ["ignore", "ignore", "ignore"],
    });
    child.on("close", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });

  if (!installed) {
    return [
      {
        actor: "Arturo",
        label: "Install failed",
        body: [
          "Homebrew could not install Ollama.",
          "Install it by hand from https://ollama.com/download, then run /model again.",
        ].join("\n"),
      },
    ];
  }

  try {
    const server = spawn("ollama", ["serve"], {
      detached: true,
      stdio: "ignore",
    });
    server.unref();
  } catch {
    // The check below reports honestly if it did not come up.
  }

  await new Promise((resolve) => setTimeout(resolve, 3000));
  const availability = await checkOllamaAvailability();

  if (!availability.reachable) {
    return [
      {
        actor: "Arturo",
        label: "Installed, but not running yet",
        body: [
          "Ollama installed, but its server hasn't come up yet.",
          "Start it from another terminal with:  ollama serve",
          "Then run /model again — Arturo will help you download a model.",
        ].join("\n"),
      },
    ];
  }

  return [
    {
      actor: "Arturo",
      label: "Ollama is ready",
      body: [
        "Ollama is installed and running.",
        "Run /model again to pick and download a model — Arturo suggests llama3.2 to start.",
      ].join("\n"),
    },
  ];
}
