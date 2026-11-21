import { existsSync, readdirSync, readFileSync } from "node:fs";
import { INFERABLE_CAPABILITIES } from "../runtime/businessFunctionRuntimeRouting";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  UI_BEYOND_PRIMARY_COMMANDS,
  UI_COMMAND_HELP,
  UI_PRIMARY_COMMANDS,
} from "./uiCommandHelp.js";

const scenarioDirectory = join(process.cwd(), "docs", "scenarios");
const cliDocsDirectory = join(process.cwd(), "docs");
const repositoryRoot = join(process.cwd(), "..");
const investorDemoPath = join(
  repositoryRoot,
  "docs",
  "ARTURO_BUILDS_ARTURO.md"
);

/**
 * Repository-root documents an investor, evaluator, or new reader meets first.
 * These are held to the primary command surface: a deprecated alias in a live
 * demonstration script teaches the wrong command and dates the product.
 */
const investorFacingPaths: readonly string[] = [
  "README.md",
  "ROADMAP.md",
  "ARCHITECTURE.md",
  join("docs", "START_HERE.md"),
  join("docs", "ARTURO_BUILDS_ARTURO.md"),
  ...readdirSync(join(repositoryRoot, "docs", "investor-scenarios"))
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => join("docs", "investor-scenarios", name)),
];

function readInvestorFacingDocuments(): readonly DocumentationFile[] {
  return investorFacingPaths.map((name) => ({
    name,
    path: join(repositoryRoot, name),
    body: readFileSync(join(repositoryRoot, name), "utf8"),
  }));
}

type DocumentationFile = {
  readonly name: string;
  readonly path: string;
  readonly body: string;
};

function readDocumentationTree(directory: string): readonly DocumentationFile[] {
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return readDocumentationTree(path);
      }
      return [{
        name: path.slice(cliDocsDirectory.length + 1),
        path,
        body: readFileSync(path, "utf8"),
      }];
    });
}

function readScenarioDocuments(): readonly DocumentationFile[] {
  // Documents only. This read everything in the directory, so a transcript or
  // any other stray file saved beside the scenarios failed the whole lint for
  // lacking a "Safe completion condition" — a confusing way to be told you put
  // a file somewhere unexpected.
  return readdirSync(scenarioDirectory)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => ({
      name,
      path: join(scenarioDirectory, name),
      body: readFileSync(join(scenarioDirectory, name), "utf8"),
    }));
}

/** Flags each command documents in its own usage strings, keyed by command. */
const supportedFlags = new Map<string, ReadonlySet<string>>(
  UI_COMMAND_HELP.map((help) => [
    help.command,
    new Set(
      help.usage.flatMap((usage) =>
        [...usage.matchAll(/--[a-z0-9-]+/g)].map((match) => match[0])
      )
    ),
  ])
);

type DocumentedFlag = {
  readonly command: string;
  readonly flag: string;
};

/**
 * Returns every command-line flag a document uses that the command's own help
 * does not document. Catches the case a name-only check misses: a real command
 * invoked with syntax Arturo no longer accepts.
 */
function undocumentedFlags(body: string): readonly DocumentedFlag[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("/"))
    .flatMap((line) => {
      const command = line.split(/\s+/, 1)[0];
      const known = supportedFlags.get(command);

      if (!known) {
        return [];
      }

      return [...line.matchAll(/--[a-z0-9-]+/g)]
        .map((match) => match[0])
        .filter((flag) => !known.has(flag))
        .map((flag) => ({ command, flag }));
    });
}

function documentedCommands(body: string): readonly string[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("/"))
    .map((line) => line.split(/\s+/, 1)[0]);
}

describe("native terminal scenario documentation", () => {
  it("uses only commands the terminal help catalog defines", () => {
    const supported = new Set([
      ...UI_PRIMARY_COMMANDS,
      // Current commands the guide does not advertise. A scenario may name
      // one -- 012 demonstrates Workflows -- because the rule here is that a
      // document must not tell an operator to type something that does not
      // exist. Aliases stay out: a reader learning from a scenario should
      // learn the name Arturo recommends.
      ...UI_BEYOND_PRIMARY_COMMANDS,
    ]);

    for (const document of readScenarioDocuments()) {
      for (const command of documentedCommands(document.body)) {
        expect(supported.has(command), `${document.name}: ${command}`).toBe(true);
      }
    }
  });

  /**
   * A Function has to be staffed before it can take a Task. Registering a
   * Worker does not do that — /staff does — and a scenario that skips it is
   * refused at the step that matters with "has no Worker assigned to it".
   *
   * Two investor demonstrations and one scenario shipped with exactly this
   * defect, each looking correct on the page. Only running them found it, and
   * the manually-run scenarios have no transcript to run.
   */
  it("staffs a Function before creating a Task for it", () => {
    for (const document of readScenarioDocuments()) {
      // Any form that creates a Task counts: "/task create", "/task-cap", the
      // guided "/task", and the guided form written with its answers after an
      // arrow. Only "/task inspect" reads without creating.
      //
      // Matching too narrowly is the real hazard here. An earlier version keyed
      // on "/task create" and silently stopped guarding every scenario written
      // in the guided style — a lint that quietly matches nothing is worse than
      // no lint, because it reads as a passing check.
      const createsTask = /^\/task(?:-cap)?\b(?!\s+inspect)/m.test(
        document.body
      );
      if (!createsTask) continue;

      // A scenario that runs on the seeded demo Enterprise inherits its
      // staffing, and says so.
      const usesSeededDemo =
        /seeded demo|no \/reset/i.test(document.body);
      if (usesSeededDemo) continue;

      expect(
        /^\/staff\b/m.test(document.body),
        `${document.name}: creates a Task but never runs /staff, so the Function has no Worker assigned`
      ).toBe(true);
    }
  });

  it("uses only flags each command actually documents", () => {
    for (const document of readScenarioDocuments()) {
      for (const { command, flag } of undocumentedFlags(document.body)) {
        expect.fail(
          `${document.name}: ${command} does not accept ${flag}`
        );
      }
    }
  });

  it("does not reintroduce removed low-level scenario syntax", () => {
    const removed = [
      "/workflow-runs",
      "/workflow-run",
      "/job-output",
      "/worker add",
      "/jobs inspect",
      "/replay-checkpoint",
      "/replay-verify-checkpoint",
      "/replay-history",
    ];

    for (const document of readScenarioDocuments()) {
      for (const command of removed) {
        expect(document.body, `${document.name}: ${command}`).not.toContain(command);
      }
    }
  });

  it("gives every numbered scenario commands, verification, and a safe completion condition", () => {
    const scenarios = readScenarioDocuments().filter(({ name }) => name !== "README.md");

    // The scenario set grows over time; assert a floor and that numbering is
    // contiguous from 001 rather than pinning an exact count.
    expect(scenarios.length).toBeGreaterThanOrEqual(13);
    const numbers = scenarios
      .map(({ name }) => Number(/Scenario (\d+)/.exec(name)?.[1] ?? 0))
      .filter((n) => n > 0)
      .sort((a, b) => a - b);
    numbers.forEach((n, index) => expect(n, `contiguous numbering at ${n}`).toBe(index + 1));
    for (const scenario of scenarios) {
      expect(documentedCommands(scenario.body).length, scenario.name).toBeGreaterThan(2);
      expect(scenario.body, scenario.name).toMatch(/verify|what to verify|inspect/i);
      expect(scenario.body, scenario.name).toContain("Safe completion condition");
    }
  });
});

describe("CLI documentation conformance", () => {
  it("uses only defined terminal commands in copyable command blocks", () => {
    const supported = new Set([
      ...UI_PRIMARY_COMMANDS,
      // Current commands the guide does not advertise. A scenario may name
      // one -- 012 demonstrates Workflows -- because the rule here is that a
      // document must not tell an operator to type something that does not
      // exist. Aliases stay out: a reader learning from a scenario should
      // learn the name Arturo recommends.
      ...UI_BEYOND_PRIMARY_COMMANDS,
    ]);

    for (const document of readDocumentationTree(cliDocsDirectory)) {
      for (const command of documentedCommands(document.body)) {
        expect(supported.has(command), `${document.name}: ${command}`).toBe(true);
      }
    }
  });

  it("uses only flags each command actually documents", () => {
    for (const document of readDocumentationTree(cliDocsDirectory)) {
      for (const { command, flag } of undocumentedFlags(document.body)) {
        expect.fail(
          `${document.name}: ${command} does not accept ${flag}`
        );
      }
    }
  });

  it("has no broken relative Markdown links", () => {
    const linkPattern = /\]\(([^)]+)\)/g;

    for (const document of readDocumentationTree(cliDocsDirectory)) {
      for (const match of document.body.matchAll(linkPattern)) {
        const rawTarget = match[1].trim();
        const target =
          rawTarget.startsWith("<") && rawTarget.endsWith(">")
            ? rawTarget.slice(1, -1)
            : rawTarget;
        if (/^(?:https?:|mailto:|#)/.test(target)) {
          continue;
        }
        const pathWithoutFragment = decodeURIComponent(target.split("#", 1)[0]);
        expect(
          existsSync(join(dirname(document.path), pathWithoutFragment)),
          `${document.name}: ${target}`
        ).toBe(true);
      }
    }
  });
});

describe("investor-facing documentation", () => {
  it("demonstrates only primary commands, never a deprecated alias", () => {
    const supported = new Set(UI_PRIMARY_COMMANDS);

    for (const document of readInvestorFacingDocuments()) {
      for (const command of documentedCommands(document.body)) {
        expect(supported.has(command), `${document.name}: ${command}`).toBe(true);
      }
    }
  });

  it("uses only flags each command actually documents", () => {
    for (const document of readInvestorFacingDocuments()) {
      for (const { command, flag } of undocumentedFlags(document.body)) {
        expect.fail(`${document.name}: ${command} does not accept ${flag}`);
      }
    }
  });
});

describe("Arturo Builds Arturo investor demonstration", () => {
  it("uses only primary native-terminal commands", () => {
    const supported = new Set(UI_PRIMARY_COMMANDS);
    const body = readFileSync(investorDemoPath, "utf8");

    for (const command of documentedCommands(body)) {
      expect(
        supported.has(command),
        `ARTURO_BUILDS_ARTURO.md: ${command}`
      ).toBe(true);
    }
  });

  it("preserves the counterfactual disclosure and evidence boundaries", () => {
    const body = readFileSync(investorDemoPath, "utf8");

    expect(body).toContain("counterfactual reconstruction");
    expect(body).toContain("It is not a claim that Arturo historically built itself.");
    expect(body).toContain("A completed Task is not automatically a verified result.");
    expect(body).toContain("No email, publication, repository edit, or external action occurred.");
  });

  it("does not claim a deny rule refuses work the scenario never sends it", () => {
    // A Governance rule keyed on a capability Arturo never infers from typed
    // text cannot be triggered by anything a scenario types. Seven scenarios
    // configured `--effect deny --capability "execution"` and their docs said
    // the action was "denied deterministically"; no transcript contained a
    // single refusal, because "Execute the containment action now." infers no
    // capability at all. The rule is real — it guards Procedures, Workflow
    // operator steps and Event-declared work — but the run does not show it,
    // and a reader must not be told otherwise.
    const inferable = new Set<string>(INFERABLE_CAPABILITIES);

    for (const document of readScenarioDocuments()) {
      const denied = [
        ...document.body.matchAll(
          /--effect\s+deny\b[^\n]*?--capability\s+"([^"]+)"/g
        ),
      ].map((match) => match[1]);

      for (const capability of denied) {
        if (inferable.has(capability)) continue;
        expect(
          document.body,
          `${document.name}: denies "${capability}", which no typed Task can request`
        ).toContain("cannot be triggered by anything typed here");
        expect(
          document.body,
          `${document.name}: must not claim the refusal is demonstrated`
        ).not.toContain("denied deterministically");
      }
    }
  });
});
