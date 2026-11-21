/**
 * Passing a finished result on to be checked, before a person signs it off.
 *
 * When a task finishes, Arturo looks at the rule its business function has
 * (passOnRules.ts) and at what the person asking chose for that task. If
 * either says to send it on, Arturo creates one task for the other business
 * function's AI worker to check it, through createTask itself, so every check
 * Arturo makes on new work (what no AI worker can do, the business function's
 * own checks, who may ask, go-aheads) is made again. Nothing a model wrote
 * decides where it goes: only the rule or the choice a person made.
 *
 * The check is told what to do in fixed words (CHECK_INSTRUCTION): list the
 * points that need attention and where they are, say what it did not check,
 * never rewrite the result and never give an overall verdict. The result it
 * checks is given to it marked off as data (taskExecutor.ts). It cannot change
 * the result: it writes its own.
 *
 * Only a plain AI-written result is passed on: one whose stored text begins
 * with the unverified-model banner. Anything else (a deterministic
 * conversion, an Office receipt, a record a person confirmed) is not, and
 * nothing passes on a check (PASS_ON_STEPS). A result is passed on once.
 * Whatever happens, the result then waits for a person to sign it off: when
 * the check is done, when it failed, or when it could not be created.
 */

import crypto from "node:crypto";

import { getBusinessFunctionDefinition } from "../business/businessFunctionDefinitionStore";
import { clientsNamedInText } from "../clients/clientRecords";
import { getClientTerms, listClientRecords } from "../clients/clientStore";
import { createTask } from "../repl/taskRoutingCommands";
import { carriedTaskArgs } from "../task/carriedTaskArgs";
import { claimPassOnDelivery, claimRouteChain, loadPassOnDelivery, loadRouteChain, updatePassOnDelivery, updateRouteChain } from "../storage/passOnRepository";
import { getJob, type Job } from "./jobQueue";
import { getPassOnChoice, getPassOnRule, mayChangeWhereResultsGo, passOnChecking, refusePassOnRuleStanding, refusePassOnTarget, refuseRouteRun, routeStepOf, ruleSha256, type PassOnDelivery, type PassOnRule, type RouteChain } from "./passOnRules";
import { standingRefusal } from "./standingPermission";
import { hashResult } from "./resultSignOff";
import { appendRuntimeEventToStore } from "./runtimeEventStore";

/** What the checking AI worker is told, whatever the result says. */
export function checkInstruction(who: string, sourceTaskId: string): string {
  return [
    `Check the result of ${sourceTaskId} before ${who} reads it.`,
    'Begin with "Points to check:" and the number of points.',
    "Then list each point that needs attention, saying where it is (the clause, section or line) and why.",
    "Then say what you did not check.",
    'Do not rewrite the result, and do not give an overall verdict such as "looks fine".',
  ].join(" ");
}

/** The business function a finished result goes to first, and why, if any. SIDE EFFECT: Reads rules and choices. */
export function passOnTargetFor(job: Job): { readonly to: string; readonly via: "rule" | "task"; readonly setBy: string } | undefined {
  if (job.status !== "completed" || !job.businessFunctionId) return undefined;
  // Work on a named piece of work comes straight back: passing on is off for drafts.
  if (job.workId) return undefined;
  if (!job.output?.startsWith("Evidence status: UNVERIFIED MODEL SYNTHESIS")) return undefined;
  if (job.workflowRunId || job.reviewLoop) return undefined;
  // One step: a check is never passed on again, and a route's step goes only where its route says.
  if (passOnChecking(job.id) || routeStepOf(job.id)) return undefined;
  const rule = getPassOnRule(job.businessFunctionId);
  if (rule?.mode === "never") return undefined;
  const choice = getPassOnChoice(job.id);
  if (choice?.choice === "off") return undefined;
  if (choice) return { to: choice.choice, via: "task", setBy: choice.by ?? job.requestedBy ?? "" };
  if (rule?.mode === "send" && rule.toFunctionId) return { to: rule.toFunctionId, via: "rule", setBy: rule.setBy };
  return undefined;
}

/** Why a web step's result is not passed on: it counts as leaving the business (Story G). */
export const WEB_STEP_STOPS = "It used web search, which counts as leaving the business, so it isn't passed on.";

/** Whether a Task was a web step: one given a person's own search words. PURE: No side effects. */
export function usedWebSearch(job: Pick<Job, "webSearchQuery">): boolean {
  return Boolean(job.webSearchQuery?.trim());
}

export type PassOnOutcome = { readonly sent: string } | { readonly stopped: string } | undefined;

/**
 * Passes a finished result on to be checked, if its business function's rule
 * or the choice made for it says so. Called when any task finishes.
 *
 * SIDE EFFECT: May create a Task, and records a delivery and a runtime event.
 */
export function deliverPassOn(job: Job, now = Date.now()): RouteOutcome {
  const step = routeStepOf(job.id);
  if (step) return job.status === "completed" ? continueRoute(step, job, now) : undefined;
  const route = routeFor(job);
  if (route) return startRoute(job, route, now);
  const target = passOnTargetFor(job);
  if (!target) return undefined;
  const enterpriseId = job.enterpriseId ?? getBusinessFunctionDefinition(job.businessFunctionId!)?.enterpriseId;
  if (!enterpriseId) return undefined;
  const base: PassOnDelivery = { sourceTaskId: job.id, toFunctionId: target.to, via: target.via, setBy: target.setBy, at: now };
  if (!claimPassOnDelivery(base)) return undefined;
  const to = getBusinessFunctionDefinition(target.to);

  const stop = (reason: string): PassOnOutcome => {
    updatePassOnDelivery({ ...base, stopped: reason });
    appendRuntimeEventToStore({
      id: crypto.randomUUID(),
      type: "runtime.pass_on.stopped",
      level: "warn",
      message: `Task ${job.id} was not sent to ${to?.label ?? target.to} to be checked: ${reason} It waits for a person to sign it off.`,
      timestamp: now,
      payload: { sourceTaskId: job.id, toFunctionId: target.to, via: target.via, setBy: target.setBy },
    });
    return { stopped: reason };
  };

  // A web step counts as leaving the business, so it always stops after it
  // runs and waits for a person (Story G).
  if (usedWebSearch(job)) return stop(WEB_STEP_STOPS);

  // A business function's rule is a standing permission, checked live (B9,
  // C3): its setter must still be able to sign off, for this business, under
  // the provider routing policy and model it was set under.
  if (target.via === "rule") {
    const rule = getPassOnRule(job.businessFunctionId);
    const standing = rule
      ? refusePassOnRuleStanding(rule, enterpriseId)
      : standingRefusal("permission_withdrawn", { what: "The rule that sent it on" });
    if (standing) return stop(standing.message);
  }

  // Checked again now: staffing may have changed since the rule was set.
  const refusal = refusePassOnTarget({ enterpriseId, fromFunctionId: job.businessFunctionId!, toFunctionId: target.to });
  if (refusal) return stop(refusal);

  const outcome = createTask(
    [
      checkInstruction(job.requestedBy ?? "the person who signs it off", job.id),
      "--function", target.to,
      "--enterprise", enterpriseId,
      ...carriedTaskArgs(job),
      "--follows", job.id,
    ],
    { passOnClaim: oneTimeClaim(job.id) }
  );
  if (!outcome.created || !outcome.taskId) return stop(outcome.message.split("\n")[0]);

  updatePassOnDelivery({ ...base, nextTaskId: outcome.taskId });
  appendRuntimeEventToStore({
    id: crypto.randomUUID(),
    type: "runtime.pass_on.sent",
    level: "info",
    message: `Task ${job.id} was sent to ${to?.label ?? target.to} to be checked, as Task ${outcome.taskId}, ${target.via === "rule" ? `by its business function's rule, set by ${target.setBy}` : `as ${target.setBy || "the person asking"} chose for this task`}. Nobody signed it off first.`,
    timestamp: now,
    payload: { sourceTaskId: job.id, nextTaskId: outcome.taskId, toFunctionId: target.to, via: target.via, setBy: target.setBy },
  });
  return { sent: outcome.taskId };
}

/** A claim good for one result, once, and only while its delivery is open. SIDE EFFECT: Reads one delivery when used. */
function oneTimeClaim(sourceId: string): (sourceTaskId: string) => boolean {
  let used = false;
  return (sourceTaskId) => {
    if (used || sourceTaskId !== sourceId) return false;
    const open = loadPassOnDelivery(sourceId);
    if (!open || open.nextTaskId || open.stopped) return false;
    used = true;
    return true;
  };
}

/**
 * The route a finished result starts, if its business function has one and
 * the task did not choose otherwise.
 *
 * SIDE EFFECT: Reads rules and choices.
 */
export function routeFor(job: Job): PassOnRule | undefined {
  if (job.status !== "completed" || !job.businessFunctionId) return undefined;
  // Routes are off for named work, as passing on is.
  if (job.workId) return undefined;
  if (!job.output?.startsWith("Evidence status: UNVERIFIED MODEL SYNTHESIS")) return undefined;
  if (job.workflowRunId || job.reviewLoop || passOnChecking(job.id) || routeStepOf(job.id)) return undefined;
  // A choice made for this task (straight back, or one check) is followed instead.
  if (getPassOnChoice(job.id)) return undefined;
  const rule = getPassOnRule(job.businessFunctionId);
  return rule?.mode === "route" && rule.steps?.length ? rule : undefined;
}

/**
 * The business's other clients named in a task or its result, by name, with
 * no model involved: a possible conflict a person should look at before the
 * work goes on.
 *
 * SIDE EFFECT: Reads client records.
 */
export function otherClientsNamed(job: Job, enterpriseId: string): string[] {
  return clientsNamedInText(`${job.task}\n${job.output ?? ""}`, listClientRecords(enterpriseId), job.clientId)
    .map((client) => client.name.trim());
}

export type RouteOutcome = PassOnOutcome | { readonly paused: string };

/**
 * Starts a route from a finished result: Arturo first looks, by name, for
 * the business's other clients in it (and stops if it finds one), then either
 * waits for the result to be signed off or sends it to the first step.
 *
 * SIDE EFFECT: Records the route's run, and may create a Task.
 */
function startRoute(job: Job, rule: PassOnRule, now: number): RouteOutcome {
  const enterpriseId = job.enterpriseId ?? getBusinessFunctionDefinition(job.businessFunctionId!)?.enterpriseId;
  if (!enterpriseId) return undefined;
  const others = otherClientsNamed(job, enterpriseId);
  const conflict = others.length
    ? `${others.join(" and ")} ${others.length === 1 ? "is" : "are"} also on your list of ${getClientTerms(enterpriseId).plural}. Arturo stopped the route before it went on, so you can check for a conflict first.`
    : undefined;
  const chain: RouteChain = {
    startTaskId: job.id,
    functionId: rule.functionId,
    enterpriseId,
    steps: rule.steps!,
    pauseFirst: rule.pauseFirst !== false,
    setBy: rule.setBy,
    ruleSha256: ruleSha256(rule),
    at: now,
    // A route whose first result used web search waits for its sign-off, whatever the rule says (Story G).
    state: conflict ? "stopped" : rule.pauseFirst !== false || usedWebSearch(job) ? "paused" : "running",
    ...(conflict ? { stopReason: conflict, stoppedAt: now } : {}),
  };
  if (!claimRouteChain(chain)) return undefined;
  routeEvent(conflict ? "runtime.route.stopped" : "runtime.route.started", job.id, conflict ?? `Task ${job.id} started its route${chain.state === "paused" ? ", waiting for its sign-off before going on" : ""}.`, now);
  if (conflict) return { stopped: conflict };
  if (chain.state === "paused") return { paused: job.id };
  return deliverRouteStep(job, chain, 1, now);
}

/** Sends a finished step on to the next, if the route has one and was not stopped. SIDE EFFECT: May create a Task. */
function continueRoute(step: PassOnDelivery, job: Job, now: number): RouteOutcome {
  const chain = loadRouteChain(step.routeStart!);
  if (!chain || chain.state !== "running") return undefined;
  const index = step.stepIndex ?? 0;
  if (index >= chain.steps.length) return undefined;
  return deliverRouteStep(job, chain, index + 1, now);
}

/**
 * When a route waits for its first result's sign-off, sends it on once it is
 * signed off. Called from signOffTaskResult, after the sign-off is recorded.
 *
 * SIDE EFFECT: May update the route's run and create a Task.
 */
export function continueRouteAfterSignOff(job: Job, now = Date.now()): RouteOutcome {
  const chain = loadRouteChain(job.id);
  if (!chain || chain.state !== "paused") return undefined;
  const running: RouteChain = { ...chain, state: "running" };
  updateRouteChain(running);
  return deliverRouteStep(job, running, 1, now);
}

/** SIDE EFFECT: Records a runtime event. */
function routeEvent(type: string, taskId: string, message: string, now: number): void {
  appendRuntimeEventToStore({ id: crypto.randomUUID(), type, level: type.endsWith("stopped") ? "warn" : "info", message, timestamp: now, payload: { taskId } });
}

/**
 * Creates one step of a route, through createTask with --follows, under a
 * claim good once for that result. Everything is checked again first.
 *
 * SIDE EFFECT: Records a delivery, may stop the route, and may create a Task.
 */
function deliverRouteStep(previous: Job, chain: RouteChain, index: number, now: number): RouteOutcome {
  const step = chain.steps[index - 1];
  const base: PassOnDelivery = { sourceTaskId: previous.id, toFunctionId: step.functionId, via: "rule", setBy: chain.setBy, at: now, routeStart: chain.startTaskId, stepIndex: index };
  if (!claimPassOnDelivery(base)) return undefined;
  const to = getBusinessFunctionDefinition(step.functionId);
  const stop = (reason: string): RouteOutcome => {
    updatePassOnDelivery({ ...base, stopped: reason });
    updateRouteChain({ ...chain, state: "stopped", stopReason: reason, stoppedAt: now });
    routeEvent("runtime.route.stopped", chain.startTaskId, `The route from Task ${chain.startTaskId} stopped before step ${index} (${to?.label ?? step.functionId}): ${reason}`, now);
    return { stopped: reason };
  };
  // The rule the run started under is checked live before every step (B9,
  // C3): withdrawn, changed, lapsed or set under another provider policy,
  // the run stops here, saying why. A step already working finishes.
  const standing = refuseRouteRun(chain);
  if (standing) return stop(standing.message);
  const refusal = refusePassOnTarget({ enterpriseId: chain.enterpriseId, fromFunctionId: chain.functionId, toFunctionId: step.functionId });
  if (refusal) return stop(refusal);
  if (getPassOnRule(step.functionId)?.mode === "never") return stop(`${to?.label ?? "That business function"} never passes its results on.`);
  const start = getJob(chain.startTaskId);
  const outcome = createTask(
    [
      step.instruction,
      "--function", step.functionId,
      "--enterprise", chain.enterpriseId,
      ...carriedTaskArgs({ requestedBy: start?.requestedBy, clientId: start?.clientId, workId: previous.workId }),
      "--follows", previous.id,
    ],
    { passOnClaim: oneTimeClaim(previous.id) }
  );
  if (!outcome.created || !outcome.taskId) return stop(outcome.message.split("\n")[0]);
  updatePassOnDelivery({ ...base, nextTaskId: outcome.taskId });
  routeEvent("runtime.route.step", chain.startTaskId, `Step ${index} of the route from Task ${chain.startTaskId}: ${to?.label ?? step.functionId} is working from ${previous.id}, as Task ${outcome.taskId}.`, now);
  return { sent: outcome.taskId };
}

/**
 * Stops a route's run: nothing more is started. A step already running
 * finishes and comes to a person with the rest. Only someone at the business
 * who can sign off work may stop it.
 *
 * SIDE EFFECT: May update one run and record a runtime event.
 */
export function stopRoute(input: { readonly taskId: string; readonly as: string; readonly now?: number }): { readonly stopped: boolean; readonly message: string } {
  const startId = routeStepOf(input.taskId)?.routeStart ?? input.taskId;
  const chain = loadRouteChain(startId);
  if (!chain) return { stopped: false, message: `${input.taskId} is not on a route. Nothing was changed.` };
  const who = mayChangeWhereResultsGo(chain.enterpriseId, input.as);
  if (!who) return { stopped: false, message: `Only someone at this business who can sign off work may stop a route. ${input.as.trim() || "Nobody"} cannot. Nothing was changed.` };
  if (chain.state === "stopped") return { stopped: false, message: `The route from ${startId} was already stopped. Nothing was changed.` };
  if (routeFinished(chain)) return { stopped: false, message: `The route from ${startId} has finished, so there is nothing to stop.` };
  const now = input.now ?? Date.now();
  updateRouteChain({ ...chain, state: "stopped", stoppedBy: who, stoppedAt: now, stopReason: `Stopped by ${who}.` });
  routeEvent("runtime.route.stopped", startId, `The route from Task ${startId} was stopped by ${who}.`, now);
  return { stopped: true, message: `Stopped. Nothing more on this route will start. A step already working finishes and comes to you with the rest, each to sign off on its own.` };
}

/** The tasks of one route's run, in order: the result it started from, then each step created. SIDE EFFECT: Reads deliveries. */
export function routeTasks(startTaskId: string): string[] {
  const ids = [startTaskId];
  for (let delivery = loadPassOnDelivery(startTaskId); delivery?.routeStart === startTaskId && delivery.nextTaskId && ids.length <= 10; delivery = loadPassOnDelivery(delivery.nextTaskId)) {
    ids.push(delivery.nextTaskId);
  }
  return ids;
}

/** Whether a run has nothing left to do. SIDE EFFECT: Reads deliveries and Tasks. */
export function routeFinished(chain: RouteChain): boolean {
  if (chain.state === "paused") return false;
  const ids = routeTasks(chain.startTaskId);
  const last = getJob(ids[ids.length - 1]);
  if (!last) return true;
  if (last.status === "failed") return true;
  if (last.status !== "completed") return false;
  if (chain.state === "stopped") return true;
  return ids.length - 1 >= chain.steps.length || Boolean(loadPassOnDelivery(last.id)?.stopped);
}

/**
 * What a sign-off attests to beside the result itself: the results it was
 * built on along a route, and a check kept with it, each by the SHA-256 of
 * its text. Bound into the sign-off's signature.
 *
 * SIDE EFFECT: Reads deliveries and Tasks.
 */
export function signOffAlongside(job: Job): { taskId: string; role: "built-on" | "check"; sha256: string }[] {
  const alongside: { taskId: string; role: "built-on" | "check"; sha256: string }[] = [];
  const check = loadPassOnDelivery(job.id);
  const checkJob = check && !check.routeStart && check.nextTaskId ? getJob(check.nextTaskId) : undefined;
  if (checkJob?.status === "completed" && checkJob.output) alongside.push({ taskId: checkJob.id, role: "check", sha256: hashResult(checkJob.output) });
  const seen = new Set<string>([job.id]);
  for (let step = routeStepOf(job.id); step && !seen.has(step.sourceTaskId); step = routeStepOf(step.sourceTaskId)) {
    seen.add(step.sourceTaskId);
    const earlier = getJob(step.sourceTaskId);
    if (earlier?.output) alongside.push({ taskId: earlier.id, role: "built-on", sha256: hashResult(earlier.output) });
  }
  return alongside;
}

/**
 * Keeps, with a sign-off, what the check said at that moment, so the record
 * says what the person had beside the result when they signed it off.
 * Called from signOffTaskResult, after the sign-off is recorded.
 *
 * SIDE EFFECT: May update one delivery.
 */
export function recordCheckSeenAtSignOff(job: Job, by: string, now = Date.now()): void {
  const delivery = loadPassOnDelivery(job.id);
  if (!delivery || delivery.routeStart || delivery.seenAtSignOff) return;
  const check = delivery.nextTaskId ? getJob(delivery.nextTaskId) : undefined;
  const checkState = !check ? "not sent" : check.status === "completed" ? "finished" : check.status === "failed" ? "failed" : "not finished";
  updatePassOnDelivery({
    ...delivery,
    seenAtSignOff: {
      by,
      at: now,
      ...(check ? { checkTaskId: check.id } : {}),
      checkState,
      ...(check?.status === "completed" && check.output ? { checkSha256: crypto.createHash("sha256").update(check.output).digest("hex") } : {}),
    },
  });
}
