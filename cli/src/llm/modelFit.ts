import { totalmem } from "node:os";

/**
 * Whether a local model can actually run on this computer.
 *
 * `/model` used to decide this with a sentence in the catalogue note — llama3.3
 * said "needs a powerful computer" and was then offered, downloaded (40 GB, 21
 * minutes) and selected on a 16 GB machine, where it cannot run at all. The
 * runner was killed after three and a half minutes with "model runner has
 * unexpectedly stopped, this may be due to resource limitations", and every
 * model call in the installation failed until the selection was changed back by
 * hand. Advice the operator has to act on is not a precondition check.
 *
 * The arithmetic is deliberately crude, because the failure it prevents is not
 * marginal — a 70B model on a 16 GB machine is out by a factor of four, not by
 * a rounding error.
 */

/**
 * How much of the machine's memory a model may actually use.
 *
 * On Apple Silicon the memory is unified but the GPU may only wire down about
 * three quarters of it; elsewhere the OS and everything else the operator is
 * running need their share too. 75% is the conservative figure that holds well
 * enough on both.
 */
const USABLE_MEMORY_FRACTION = 0.75;

/**
 * Working memory needed on top of the weights: the KV cache, which grows with
 * context length, plus the runner's own overhead.
 */
const OVERHEAD_MULTIPLIER = 1.2;

export type ModelFit = {
  /** Whether the model is expected to run here at all. */
  readonly fits: boolean;
  /** What the model needs in total, weights plus working memory, in GB. */
  readonly needsGb: number;
  /** What this machine can give it, in GB. */
  readonly usableGb: number;
};

/** This machine's physical memory in GB. SIDE EFFECT: reads system memory. */
export function machineMemoryGb(): number {
  return totalmem() / 1024 ** 3;
}

/**
 * Whether a model of a given size can run on a machine of a given size.
 *
 * PURE: No side effects.
 */
export function assessModelFit(input: {
  readonly approximateGb: number;
  readonly machineGb: number;
}): ModelFit {
  const needsGb = input.approximateGb * OVERHEAD_MULTIPLIER;
  const usableGb = input.machineGb * USABLE_MEMORY_FRACTION;
  return {
    fits: needsGb <= usableGb,
    needsGb: Math.round(needsGb),
    usableGb: Math.round(usableGb),
  };
}

/**
 * Says, in the operator's words, why a model will not run here.
 *
 * Returns undefined when it will, so a caller can use it as the refusal reason
 * and the absence of one as permission to continue.
 *
 * PURE: No side effects.
 */
export function describeModelUnfit(input: {
  readonly model: string;
  readonly approximateGb: number;
  readonly machineGb: number;
}): string | undefined {
  const fit = assessModelFit(input);
  if (fit.fits) return undefined;
  return [
    `${input.model} needs about ${fit.needsGb} GB of memory to run, and this`,
    `computer has ${Math.round(input.machineGb)} GB — of which roughly`,
    `${fit.usableGb} GB can be given to a model.`,
    "",
    "Downloading it would take a long time and it still would not run.",
  ].join(" ").replace(/ {2,}/g, " ");
}
