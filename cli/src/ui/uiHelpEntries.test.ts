import { describe, expect, it } from "vitest";
import {
  createUiHelpEntry,
  formatApprovedModelAliasHelp,
  formatUiCommandHelp,
  formatUiHelpText,
} from "./uiHelpEntries";
import {
  findUiCommandHelp,
  getUiCommandExplanation,
  UI_COMMAND_HELP,
  UI_PRIMARY_COMMANDS,
  getUiCommandGuidance,
} from "./uiCommandHelp";
import { UI_COMMAND_LONG_HELP } from "./uiCommandLongHelp";

describe("terminal help", () => {
  it("shows curated command groups and detailed-help guidance", () => {
    const text = formatUiHelpText();
    expect(text).toContain("Use /help <command>");
    expect(text).toContain("/delegation");
    expect(text).toContain("/model-routing");
    expect(text).toContain("/schedule");
    expect(text).toContain("Governance and people");
  });

  // The guide advertises what a scenario runs. The multi-Worker Workflow
  // subsystem has no scenario running it end to end, so /start, /workflow and
  // /run sit with the other developer surface under /help all until one does.
  // /ask stays: it is the plain-English way in, and a scenario runs it.
  it("keeps unproven Workflow commands and lifecycle aliases out of the guide", () => {
    expect(UI_PRIMARY_COMMANDS).toContain("/ask");
    expect(UI_PRIMARY_COMMANDS).not.toContain("/workflow");
    expect(UI_PRIMARY_COMMANDS).not.toContain("/run");
    expect(UI_PRIMARY_COMMANDS).not.toContain("/start");
    expect(UI_PRIMARY_COMMANDS).not.toContain("/start-function");
    expect(UI_PRIMARY_COMMANDS).not.toContain("/add-function");
    expect(formatUiHelpText()).not.toContain("/kernel-");
    // Still documented, still reachable.
    expect(findUiCommandHelp("/workflow")).toBeDefined();
    expect(findUiCommandHelp("/run")).toBeDefined();
    expect(findUiCommandHelp("/start")).toBeDefined();
  });

  it("keeps one unique detail record for every primary command", () => {
    expect(new Set(UI_PRIMARY_COMMANDS).size).toBe(UI_PRIMARY_COMMANDS.length);
    expect(new Set(UI_COMMAND_HELP.map((entry) => entry.command)).size)
      .toBe(UI_COMMAND_HELP.length);
    for (const command of UI_PRIMARY_COMMANDS) {
      expect(findUiCommandHelp(command), command).toBeDefined();
      expect(UI_COMMAND_LONG_HELP[command], `${command} long help`).toBeDefined();
      expect(
        formatUiCommandHelp(
          findUiCommandHelp(command)!
        ),
        `${command} explanation`
      ).toContain("Explanation:");
    }
  });

  it("gives every primary command a substantial concept-first explanation", () => {
    for (const command of UI_PRIMARY_COMMANDS) {
      const detail = findUiCommandHelp(command)!;
      const explanation =
        getUiCommandExplanation(
          detail
        );
      const sentenceCount =
        explanation.match(
          /[.!?](?:\s|$)/g
        )?.length ?? 0;

      expect(
        explanation.length,
        `${command} explanation length`
      ).toBeGreaterThanOrEqual(
        250
      );
      expect(
        sentenceCount,
        `${command} explanation sentences`
      ).toBeGreaterThanOrEqual(
        2
      );
    }
  });

  it("explains what Operational Memory is and how Arturo uses it safely", () => {
    const text =
      formatUiCommandHelp(
        findUiCommandHelp(
          "memory"
        )!
      );

    expect(text).toContain(
      "shared company notebook"
    );
    expect(text).toContain(
      "Enterprise or Function scope matches"
    );
    expect(text).toContain(
      "eligible for future Worker context"
    );
    expect(text).toContain(
      "not the same as a Task result"
    );
    expect(text).toContain(
      "quarantined"
    );
    expect(text).toContain(
      "Human assertions rather than proven facts"
    );
  });

  it("documents deterministic post-Job Event rules and their evidence gate", () => {
    const text =
      formatUiCommandHelp(
        findUiCommandHelp(
          "event"
        )!
      );

    expect(text).toContain(
      "/event rule add --when task.completed"
    );
    expect(text).toContain(
      "Arturo—not the model"
    );
    expect(text).toContain(
      "A Task must identify the ongoing Function"
    );
    expect(text).toContain(
      "verifies the captured evidence hash"
    );
    expect(text).toContain(
      "does not duplicate the Event"
    );
  });

  it("documents deterministic daily and weekly Task schedules", () => {
    const text =
      formatUiCommandHelp(
        findUiCommandHelp(
          "schedule"
        )!
      );

    expect(text).toContain(
      "Pacific/Auckland"
    );
    expect(text).toContain(
      "--search-query"
    );
    expect(text).toContain(
      "--every friday"
    );
    expect(text).toContain(
      "queues the existing Task"
    );
    expect(text).toContain(
      "creates a dormant Task"
    );
    expect(text).toContain(
      "real, authorized backup tool"
    );
  });

  it("documents capability discovery and the consolidated Worker inspection command", () => {
    expect(formatUiHelpText()).toContain("/capabilities");
    expect(formatUiHelpText()).not.toContain("/worker ");
    expect(
      formatUiCommandHelp(
        findUiCommandHelp("workers")!
      )
    ).toContain('/workers inspect "<worker-name>"');
    expect(
      formatUiCommandHelp(
        findUiCommandHelp("workers")!
      )
    ).toContain('/workers remove "<worker-name>"');
    expect(
      formatUiCommandHelp(
        findUiCommandHelp("workers")!
      )
    ).toContain(
      "preserves historical Tasks"
    );
    expect(
      formatUiCommandHelp(
        findUiCommandHelp("task")!
      )
    ).toContain("A bounded Task");
  });

  it("uses staffing instructions rather than correction feedback", () => {
    const text =
      formatUiCommandHelp(
        findUiCommandHelp("staff")!
      );

    expect(text).toContain("--enterprise");
    expect(text).toContain("--instructions");
    expect(text).not.toContain('--feedback "<correction>"');
  });

  it("normalizes command names with or without a slash", () => {
    expect(findUiCommandHelp("delegation")).toEqual(findUiCommandHelp("/delegation"));
  });

  it("formats detailed syntax, examples, and safety notes", () => {
    const detail = findUiCommandHelp("chat")!;
    const text = formatUiCommandHelp(detail);
    expect(text).toContain('/chat "<worker-name>" "<message>"');
    expect(text).toContain("Prerequisites:");
    expect(text).toContain("When to use it:");
    expect(text).toContain("Examples:");
    expect(text).toContain("How Arturo handles it:");
    expect(text).toContain("State and side effects:");
    expect(text).toContain("How to verify the result:");
    expect(text).toContain("Common problems and recovery:");
    expect(text).toContain("Boundaries:");
    expect(text).toContain("Worker chat is read-only");
    expect(text).toContain("Chat history is persisted locally");
    expect(text).toContain("Related commands:");
    expect(text.split("\n").length).toBeGreaterThan(30);
  });

  it("points model choice at /model and lists what can be chosen there", () => {
    const environment = {
      ARTURO_LLM_MODEL: "llama-test",
      ARTURO_PAID_ESCALATION_MODEL: "gemini-test",
      ARTURO_MODEL_PROFILES_JSON: JSON.stringify({
        "premium-reasoning": {
          provider: "gemini",
          model: "gemini-reasoning-test",
        },
        "local-review": {
          provider: "ollama",
          model: "local-review-test",
        },
      }),
    };
    const next =
      formatUiCommandHelp(
        findUiCommandHelp("next")!,
        environment
      );
    const staff =
      formatUiCommandHelp(
        findUiCommandHelp("staff")!,
        environment
      );

    for (const text of [
      next,
      staff,
    ]) {
      expect(text).toContain("Model selection:");
      // The model is chosen in one place, and help must not teach any other.
      expect(text).toContain("chosen with /model, and only with /model");
      expect(text).toContain("until you run /model again");
      expect(text).not.toContain("--model");
      expect(text).not.toContain("--compare");
      expect(text).toContain("Models available to choose in this installation:");
      expect(text).toContain("local-default — ollama/llama-test (local)");
      expect(text).toContain("premium-default — gemini/gemini-test (external; session budget applies)");
      expect(text).toContain("premium-reasoning — gemini/gemini-reasoning-test");
      expect(text).toContain("local-review — ollama/local-review-test");
      expect(text).toContain("/models");
      expect(text).toContain("/model-routing");
    }
  });

  it("says when only local routes are configured", () => {
    expect(
      formatApprovedModelAliasHelp({
        ARTURO_LLM_MODEL: "llama-test",
      }).join("\n")
    ).toContain(
      "Only local routes are configured; /model will say so."
    );
  });

  it("creates overview, detailed, and unknown help entries", () => {
    expect(createUiHelpEntry().label).toBe("Help");
    expect(createUiHelpEntry(["memory"])).toMatchObject({
      label: "Help · /memory",
    });
    expect(createUiHelpEntry(["not-a-command"])).toMatchObject({
      label: "Help · command not found",
    });
    const all = createUiHelpEntry(["all"]);
    expect(all.label).toBe("Help · all commands");
    expect(all.body).toContain("Kernel and process tools");
  });
  it("points primary commands only at other primary commands", () => {
    // A deprecated alias in "Related commands" teaches a newcomer the wrong
    // command, and it is not listed in /help so they cannot look it up.
    const primary = new Set(UI_PRIMARY_COMMANDS);

    for (const command of UI_PRIMARY_COMMANDS) {
      for (const related of getUiCommandGuidance(command).related) {
        expect(primary.has(related), `${command} → ${related}`).toBe(true);
      }
    }
  });
});
