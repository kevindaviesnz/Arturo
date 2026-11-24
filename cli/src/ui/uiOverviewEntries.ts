import { isWorkerAvailableForNewTask } from "../control/workers";
import { listEnterprises } from "../enterprise/enterpriseStore";
import { listBusinessFunctionDefinitions } from "../business/businessFunctionDefinitionStore";
import { listBusinessFunctions } from "../business/businessFunctionRuntimeStore";
import { listWorkers } from "../control/workers";
import { listJobs } from "../runtime/jobQueue";
import { listWorkflowRuns } from "../runtime/workflowRunStore";
import { listHumanTasks } from "../runtime/humanTaskStore";
import { listApprovalChains } from "../runtime/approvalChainStore";
import { listRuntimeEventStore } from "../runtime/runtimeEventStore";
import { listAllOperationalMemory } from "../memory/operationalMemoryStore";
import type { WorkStreamEntry } from "./uiState";
import { formatHandBackCount, formatHandBackWaitingSection, listOpenHandBacks } from "../staffing/handBack";

function percentage(part: number, total: number): string {
  return total === 0 ? "—" : `${Math.round((part / total) * 100)}%`;
}

/** Builds a truthful, investor-friendly view of the current operating system. */
export function createUiOverviewEntries(): readonly WorkStreamEntry[] {
  const enterprises = listEnterprises();
  const definitions = listBusinessFunctionDefinitions();
  const runtimes = listBusinessFunctions();
  const workers = listWorkers();
  const jobs = listJobs();
  const runs = listWorkflowRuns();
  const tasks = listHumanTasks();
  const approvals = listApprovalChains();
  const events = listRuntimeEventStore();
  const memory = listAllOperationalMemory();
  const completedJobs = jobs.filter((job) => job.status === "completed").length;
  const activeRuntimes = runtimes.filter((runtime) => runtime.state === "running").length;
  const waiting = approvals.filter((chain) => chain.status === "pending").length;

  if (enterprises.length === 0) {
    return [
      {
        actor: "Arturo",
        label: "Welcome",
        body: [
          "Build and operate an AI-native company from one place.",
          "Each step below is a command you type. Start at the top:",
          "",
          "1  Set up your business",
          "   /enterprise    Arturo asks about your business and sets it up",
          "",
          "2  Add the ongoing areas of work (Arturo calls these Functions)",
          "   /next          Arturo recommends the Functions to create",
          "",
          "3  Put a team behind them (AI Workers, and you for sign-off)",
          "   /staff         Arturo proposes who does the work",
          "",
          "4  Give it work",
          "   /suggest       Arturo proposes the first tasks to do",
          "",
          'In a hurry? Just describe what you want in plain English with',
          '/ask "<what you want done>", and Arturo plans it, routes it to the',
          "right Workers, applies your sign-off rules, and keeps a full history.",
          "Nothing runs until you say so.",
        ].join("\n"),
      },
    ];
  }

  return [
    {
      actor: "Arturo",
      label: "Enterprise overview",
      body: [
        `${enterprises.length} enterprise${enterprises.length === 1 ? "" : "s"}  ·  ${definitions.length} ongoing Functions  ·  ${activeRuntimes}/${runtimes.length} Functions running`,
        "",
        ...enterprises.map((enterprise) => {
          const owned = definitions.filter((definition) => definition.enterpriseId === enterprise.id);
          return `${enterprise.name}\n  ${enterprise.mission || enterprise.description || "Mission not yet defined"}\n  ${owned.length} Functions · ${enterprise.status}`;
        }),
      ].join("\n"),
    },
    {
      actor: "Work",
      label: "Execution pulse",
      body: [
        `Tasks completed      ${completedJobs}/${jobs.length} (${percentage(completedJobs, jobs.length)})`,
        `Workflow runs        ${runs.length}`,
        `Workers available    ${workers.filter((worker) => isWorkerAvailableForNewTask(worker)).length}/${workers.length}`,
        `Human tasks          ${tasks.length}`,
        `Approvals waiting    ${waiting}`,
        ...(listOpenHandBacks().length ? [formatHandBackCount(listOpenHandBacks().length)] : []),
      ].join("\n"),
    },
    {
      actor: "Governance",
      label: "Trust layer",
      body: [
        `${events.length} durable operational events`,
        `${memory.length} retained operational lessons`,
        `${approvals.length} governed decision chain${approvals.length === 1 ? "" : "s"}`,
        "",
        "Every action remains inspectable through /events, /timeline, /tasks, /memory, and /governance.",
      ].join("\n"),
    },
    ...(formatHandBackWaitingSection()
      ? [{
          actor: "Arturo" as const,
          label: "What's waiting",
          body: formatHandBackWaitingSection() as string,
        }]
      : []),
    {
      actor: "Arturo",
      label: "Next move",
      body: waiting > 0
        ? "A human decision is waiting. Use /approvals to inspect the governance gate."
        : definitions.length === 0
          ? `Use /next "${enterprises[0].name}" to design the first Functions.`
          : activeRuntimes === 0
            ? 'Use /staff to staff the Functions, then /suggest to see what they could do, or /function start "<function-name>" to let one run on its own.'
            : "The operating model is live. Enter a plain-English objective or inspect /timeline for execution evidence.",
    },
  ];
}

/** What's waiting: its own section for handed-back drafts, plus any other waits. */
export function createWhatsWaitingEntries(): readonly WorkStreamEntry[] {
  const section = formatHandBackWaitingSection();
  if (!section) {
    return [{
      actor: "Arturo",
      label: "What's waiting",
      body: "Nothing needs a new signer.",
    }];
  }
  return [{
    actor: "Arturo",
    label: "What's waiting",
    body: section,
  }];
}
