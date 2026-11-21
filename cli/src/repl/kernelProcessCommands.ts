import {
  Kernel,
} from "../kernel/kernel";

import {
  WorkerGenerator,
} from "../kernel/process";

import {
  addWorker,
  listWorkers,
} from "../control/workers";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

/**
 * Handles the /add-worker command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Registers a worker.
 * - Broadcasts runtime event.
 * - Writes CLI output.
 */
export function handleAddWorkerCommand(
  args: readonly string[]
): void {
  const name =
    args[0];

  if (!name) {
    console.log(
      "Usage: /add-worker <name>"
    );

    return;
  }

  addWorker({
    name,
    run: function* (
      ctx: any
    ) {
      const next = {
        ...(ctx || {}),
      };

      next[name] =
        "processed";

      yield {
        type: "log",
        message: `${name} updated ctx`,
      };

      return next;
    },
  });

  console.log(
    `worker added: ${name}`
  );

  broadcastEvent(
    "worker.registered",
    "success",
    `Worker registered: ${name} (total: ${listWorkers().length})`
  );
}

/**
 * Handles the /spawn command.
 *
 * @param kernel Runtime kernel instance.
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Spawns a kernel process.
 * - Writes CLI output.
 */
export function handleSpawnCommand(
  kernel: Kernel,
  args: readonly string[]
): void {
  const name =
    args[0] || "worker";

  kernel.syscall({
    type: "spawn",
    name,
    context: {},
    run: function* (): WorkerGenerator {
      yield {
        type: "log",
        message: `${name} running`,
      };
    },
  });

  console.log(
    `spawned ${name}`
  );
}

/**
 * Handles the /spawn-receiver command.
 *
 * @param kernel Runtime kernel instance.
 * @returns void
 *
 * SIDE EFFECT:
 * - Spawns a receiver kernel process.
 * - Writes CLI output.
 */
export function handleSpawnReceiverCommand(
  kernel: Kernel
): void {
  kernel.syscall({
    type: "spawn",
    name: "receiver",
    context: {},
    run: function* (): WorkerGenerator<{
      from: number;
      payload: any;
    }> {
      yield {
        type: "log",
        message:
          "receiver waiting...",
      };

      const msg =
        yield {
          type: "receive",
        };

      yield {
        type: "log",
        message:
          "receiver got: " +
          msg.payload,
      };
    },
  });

  console.log(
    "spawned receiver"
  );
}

/**
 * Handles the /spawn-sender command.
 *
 * @param kernel Runtime kernel instance.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads kernel process list.
 * - Spawns a sender kernel process.
 * - Writes CLI output.
 */
export function handleSpawnSenderCommand(
  kernel: Kernel
): void {
  const list =
    kernel.syscall({
      type: "list",
    }) as any[];

  const receiver =
    list.find(
      (process) =>
        process.name ===
        "receiver"
    );

  if (!receiver) {
    console.log(
      "receiver process not found"
    );

    return;
  }

  kernel.syscall({
    type: "spawn",
    name: "sender",
    context: {},
    run: function* (): WorkerGenerator {
      yield {
        type: "log",
        message:
          "sender sending...",
      };

      yield {
        type: "send",
        to: receiver.pid,
        payload: "hello",
      };

      yield {
        type: "log",
        message:
          "sender sent!",
      };
    },
  });

  console.log(
    "spawned sender"
  );
}

/**
 * Handles the /tick command.
 *
 * @param kernel Runtime kernel instance.
 * @returns void
 *
 * SIDE EFFECT:
 * - Advances kernel execution.
 */
export function handleTickCommand(
  kernel: Kernel
): void {
  kernel.syscall({
    type: "tick",
  });
}

/**
 * Handles the /ps command.
 *
 * @param kernel Runtime kernel instance.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads kernel process state.
 * - Writes CLI output.
 */
export function handlePsCommand(
  kernel: Kernel
): void {
  const list =
    kernel.syscall({
      type: "list",
    }) as any[];

  if (!list?.length) {
    console.log(
      "(no processes)"
    );

    return;
  }

  for (const process of list) {
    const hasResult =
      kernel.getState()
        .results[process.pid] !==
      undefined;

    console.log(
      `${process.pid} ${process.name} ${process.state}${hasResult ? " result" : ""}`
    );
  }
}