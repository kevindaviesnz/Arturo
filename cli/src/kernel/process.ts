/**
 * Process lifecycle state inside the cooperative kernel scheduler.
 */
export type ProcessState =
  | "ready"
  | "running"
  | "blocked"
  | "waiting_call"
  | "terminated";

/**
 * IPC message delivered between kernel processes.
 */
export type MailMessage = {
  from: number;
  payload: any;
};

/**
 * Effect contract yielded by worker processes.
 */
export type Effect =
  | {
      type: "log";
      message: string;
    }
  | {
      type: "sleep";
      ms: number;
    }
  | {
      type: "send";
      to: number;
      payload: any;
    }
  | {
      type: "receive";
    }
  | {
      type: "call";
      capability: string;
      input: any;
    };

/**
 * Generator contract for kernel processes.
 *
 * The generator yields effects, may return a final result, and can be
 * resumed with values supplied by the kernel.
 */
export type WorkerGenerator<
  TResume = any,
  TResult = any
> = Generator<
  Effect,
  TResult,
  TResume
>;

/**
 * Kernel process record.
 */
export type Process = {
  pid: number;

  name: string;

  state: ProcessState;

  context: any;

  run: (
    ctx: any
  ) => WorkerGenerator;

  fiber?: WorkerGenerator;

  resumeValue?: any;

  result?: any;

  mailbox: MailMessage[];
};