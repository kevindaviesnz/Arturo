import {
  randomUUID,
} from "crypto";

import {
  KernelState,
} from "./state";

import {
  Effect,
} from "./process";

import {
  decideCapabilityPolicy,
} from "./capabilityPolicy";

import {
  builtInCapabilityRegistry,
} from "./builtInCapabilities";

import {
  createCapabilityInputValidationError,
  getRuntimeSchemaType,
  validateCapabilitySchemaValue,
} from "./capabilitySchema";

/**
 * Runs a single cooperative scheduler tick.
 *
 * @param state Current kernel state.
 * @param emit Optional event emitter.
 * @returns Updated kernel state.
 *
 * PURE: No direct side effects. Event emission is delegated to the supplied callback.
 */
export function tick(
  state: KernelState,
  emit?: (event: any) => void
): KernelState {
  const now =
    Date.now();

  const readyFromTimers: number[] = [];

  const remainingTimers =
    state.timers.filter((timer) => {
      if (timer.wakeAt <= now) {
        readyFromTimers.push(
          timer.pid
        );

        return false;
      }

      return true;
    });

let nextState: KernelState = {
  ...state,

  processes: {
    ...state.processes,
  },

  timers:
    remainingTimers,

  readyQueue: [
    ...state.readyQueue,
    ...readyFromTimers,
  ],

  blockedQueue:
    state.blockedQueue.filter(
      (pid) =>
        !readyFromTimers.includes(
          pid
        )
    ),
};

  for (const pid of readyFromTimers) {
    const process =
      nextState.processes[pid];

    if (process) {
      nextState.processes[pid] = {
        ...process,
        state: "ready",
      };

      emit?.({
        type: "process:update",
        pid,
        state: "ready",
        ts: Date.now(),
      });
    }
  }

  const [
    pid,
    ...rest
  ] =
    nextState.readyQueue;

  if (pid === undefined) {
    return nextState;
  }

  const process =
    nextState.processes[pid];

  if (
    !process ||
    process.state !== "ready"
  ) {
    return {
      ...nextState,
      readyQueue:
        rest,
    };
  }

  let fiber =
    process.fiber;

  if (!fiber) {
    try {
      fiber =
        process.run(
          process.context
        );
    } catch (err) {
      console.error(
        "CRASH INIT:",
        process.name,
        err
      );

      return {
        ...nextState,

        readyQueue:
          rest,

        processes: {
          ...nextState.processes,

          [pid]: {
            ...process,
            state:
              "terminated",
            fiber:
              undefined,
          },
        },
      };
    }
  }

  let result:
    | IteratorResult<
        Effect,
        any
      >;

  try {
    result =
      process.resumeValue !==
      undefined
        ? fiber.next(
            process.resumeValue
          )
        : fiber.next();
  } catch (err) {
    console.error(
      "CRASH RUN:",
      process.name,
      err
    );

    return {
      ...nextState,

      readyQueue:
        rest,

      processes: {
        ...nextState.processes,

        [pid]: {
          ...process,
          state:
            "terminated",
          fiber:
            undefined,
        },
      },
    };
  }

  if (result.done) {
    const completedAt =
      Date.now();

    emit?.({
      type:
        "process:completed",
      pid,
      name:
        process.name,
      result:
        result.value,
      output:
        result.value,
      ts:
        completedAt,
    });

    emit?.({
      type:
        "process:update",
      pid,
      state:
        "terminated",
      ts:
        completedAt,
    });

    return {
      ...nextState,

      readyQueue:
        rest,

      results: {
        ...nextState.results,

        [pid]: {
          pid,
          name:
            process.name,
          result:
            result.value,
          completedAt,
        },
      },

      processes: {
        ...nextState.processes,

        [pid]: {
          ...process,
          state:
            "terminated",
          fiber:
            undefined,
          resumeValue:
            undefined,
        },
      },
    };
  }

  const effect =
    result.value as Effect;

  if (effect.type === "log") {
    emit?.({
      type: "log",
      pid,
      name:
        process.name,
      message:
        effect.message,
      ts:
        Date.now(),
    });
  }

  /**
   * CALL
   */
  if (effect.type === "call") {
    const capabilityDefinition =
      builtInCapabilityRegistry[
        effect.capability
      ];

    if (!capabilityDefinition) {
      const completedAt =
        Date.now();

      console.error(
        "UNKNOWN CAPABILITY:",
        effect.capability
      );

      emit?.({
        type:
          "process:error",
        pid,
        error:
          `Unknown capability: ${effect.capability}`,
        ts:
          completedAt,
      });

      return {
        ...nextState,

        readyQueue:
          rest,

        results: {
          ...nextState.results,

          [pid]: {
            pid,
            name:
              process.name,
            result: {
              error:
                `Unknown capability: ${effect.capability}`,
            },
            completedAt,
          },
        },

        processes: {
          ...nextState.processes,

          [pid]: {
            ...process,
            state:
              "terminated",
            fiber:
              undefined,
            resumeValue:
              undefined,
          },
        },
      };
    }

    const validInput =
      validateCapabilitySchemaValue(
        capabilityDefinition.inputSchema,
        effect.input
      );

    if (!validInput) {
      const completedAt =
        Date.now();

      const actualType =
        getRuntimeSchemaType(
          effect.input
        );

      const error =
        createCapabilityInputValidationError(
          effect.capability,
          capabilityDefinition.inputSchema.type,
          actualType
        );

      console.error(
        "INVALID CAPABILITY INPUT:",
        error
      );

      emit?.({
        type:
          "process:error",
        pid,
        error,
        ts:
          completedAt,
      });

      return {
        ...nextState,

        readyQueue:
          rest,

        results: {
          ...nextState.results,

          [pid]: {
            pid,
            name:
              process.name,
            result: {
              error,
            },
            completedAt,
          },
        },

        processes: {
          ...nextState.processes,

          [pid]: {
            ...process,
            state:
              "terminated",
            fiber:
              undefined,
            resumeValue:
              undefined,
          },
        },
      };
    }

    const policy =
      decideCapabilityPolicy(
        effect.capability
      );

    if (
      policy.type ===
      "deny"
    ) {
      const completedAt =
        Date.now();

      emit?.({
        type:
          "process:call-denied",
        pid,
        name:
          process.name,
        capability:
          effect.capability,
        reason:
          policy.reason,
        ts:
          completedAt,
      });

      return {
        ...nextState,

        readyQueue:
          rest,

        results: {
          ...nextState.results,

          [pid]: {
            pid,
            name:
              process.name,
            result:
              policy.reason,
            completedAt,
          },
        },

        processes: {
          ...nextState.processes,

          [pid]: {
            ...process,
            state:
              "terminated",
            fiber:
              undefined,
            resumeValue:
              undefined,
          },
        },
      };
    }

    const callId =
      randomUUID();

    const createdAt =
      Date.now();

    nextState = {
      ...nextState,

      pendingCalls: {
        ...nextState.pendingCalls,

        [callId]: {
          callId,
          pid,
          capability:
            effect.capability,
          input:
            effect.input,
          createdAt,
        },
      },
    };

    emit?.({
      type:
        "process:call",
      callId,
      pid,
      name:
        process.name,
      capability:
        effect.capability,
      input:
        effect.input,
      policy:
        policy.type,
      ts:
        createdAt,
    });

    if (
      policy.type ===
      "require-approval"
    ) {
      emit?.({
        type:
          "process:call-awaiting-approval",
        callId,
        pid,
        capability:
          effect.capability,
        reason:
          policy.reason,
        ts:
          Date.now(),
      });
    }

    return {
      ...nextState,

      readyQueue:
        rest,

      blockedQueue: [
        ...nextState.blockedQueue,
        pid,
      ],

      processes: {
        ...nextState.processes,

        [pid]: {
          ...process,
          state:
            "waiting_call",
          fiber,
          resumeValue:
            undefined,
        },
      },
    };
  }

  /**
   * SLEEP
   */
  if (effect.type === "sleep") {
    emit?.({
      type:
        "process:update",
      pid,
      state:
        "blocked",
      ts:
        Date.now(),
    });

    return {
      ...nextState,

      readyQueue:
        rest,

      timers: [
        ...nextState.timers,
        {
          pid,
          wakeAt:
            Date.now() +
            effect.ms,
        },
      ],

      blockedQueue: [
        ...nextState.blockedQueue,
        pid,
      ],

      processes: {
        ...nextState.processes,

        [pid]: {
          ...process,
          state:
            "blocked",
          fiber,
          resumeValue:
            undefined,
        },
      },
    };
  }

  if (effect.type === "send") {
    const target =
      nextState.processes[
        effect.to
      ];

    if (target) {
      const updatedTarget = {
        ...target,

        mailbox: [
          ...target.mailbox,

          {
            from: pid,
            payload:
              effect.payload,
          },
        ],
      };

      nextState = {
        ...nextState,

        processes: {
          ...nextState.processes,

          [effect.to]:
            updatedTarget,
        },
      };

      emit?.({
        type:
          "ipc:send",
        from: pid,
        to:
          effect.to,
        ts:
          Date.now(),
      });

      if (
        target.state ===
        "blocked"
      ) {
        nextState = {
          ...nextState,

          readyQueue: [
            ...nextState.readyQueue,
            effect.to,
          ],

          blockedQueue:
            nextState.blockedQueue.filter(
              (blockedPid) =>
                blockedPid !==
                effect.to
            ),

          processes: {
            ...nextState.processes,

            [effect.to]: {
              ...updatedTarget,
              state:
                "ready",
            },
          },
        };
      }
    }
  }

  if (effect.type === "receive") {
    if (
      process.mailbox.length === 0
    ) {
      emit?.({
        type:
          "process:update",
        pid,
        state:
          "blocked",
        ts:
          Date.now(),
      });

      return {
        ...nextState,

        readyQueue:
          rest,

        blockedQueue: [
          ...nextState.blockedQueue,
          pid,
        ],

        processes: {
          ...nextState.processes,

          [pid]: {
            ...process,
            state:
              "blocked",
            fiber,
          },
        },
      };
    }

    const message =
      process.mailbox[0];

    const remainingMailbox =
      process.mailbox.slice(1);

    emit?.({
      type:
        "ipc:receive",
      pid,
      from:
        message.from,
      ts:
        Date.now(),
    });

    fiber.next(
      message
    );

    nextState = {
      ...nextState,

      processes: {
        ...nextState.processes,

        [pid]: {
          ...process,
          mailbox:
            remainingMailbox,
          fiber,
        },
      },
    };
  }

  emit?.({
    type:
      "process:update",
    pid,
    state:
      "running",
    ts:
      Date.now(),
  });

  return {
    ...nextState,

    readyQueue: [
      ...rest,
      pid,
    ],

    processes: {
      ...nextState.processes,

      [pid]: {
        ...process,
        state:
          "ready",
        fiber,
        resumeValue:
          undefined,
      },
    },
  };
}