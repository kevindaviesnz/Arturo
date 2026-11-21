import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  Kernel,
} from "./kernel";

import {
  blogWorkflow,
} from "./kernelWorkflowPrototype";

/**
 * Runs the kernel for a fixed number of scheduler ticks.
 *
 * @param kernel Kernel instance to advance.
 * @param count Number of ticks to execute.
 * @returns void
 *
 * SIDE EFFECT: Advances kernel state through tick syscalls.
 */
function runTicks(
  kernel: Kernel,
  count: number
): void {
  for (
    let index = 0;
    index < count;
    index += 1
  ) {
    kernel.syscall({
      type: "tick",
    });
  }
}

describe("kernel scenario runner", () => {
  it("spawns a kernel workflow and blocks on the first capability call", () => {
    const kernel =
      new Kernel();

    kernel.syscall({
      type: "spawn",
      name: "kernel-blog",
      context:
        "AI-native startups",
      run: function* (
        ctx: string
      ) {
        return yield* blogWorkflow(
          ctx
        );
      },
    });

    runTicks(
      kernel,
      1
    );

    const pendingCalls =
      Object.values(
        kernel.getState()
          .pendingCalls
      );

    expect(
      pendingCalls
    ).toHaveLength(1);

    expect(
      pendingCalls[0]
    ).toMatchObject({
      pid: 1,
      capability: "research",
      input:
        "AI-native startups",
    });

    expect(
      kernel.getState()
        .processes[1].state
    ).toBe(
      "waiting_call"
    );
  });

  it("completes a kernel workflow when each capability call is resolved", () => {
    const kernel =
      new Kernel();

    kernel.syscall({
      type: "spawn",
      name: "kernel-blog",
      context:
        "AI-native startups",
      run: function* (
        ctx: string
      ) {
        return yield* blogWorkflow(
          ctx
        );
      },
    });

    runTicks(
      kernel,
      1
    );

    const researchCall =
      Object.values(
        kernel.getState()
          .pendingCalls
      )[0];

    kernel.syscall({
      type: "resolve-call",
      callId:
        researchCall.callId,
      result:
        "Research notes",
    });

    runTicks(
      kernel,
      1
    );

    const writingCall =
      Object.values(
        kernel.getState()
          .pendingCalls
      )[0];

    expect(
      writingCall
    ).toMatchObject({
      capability: "writing",
      input: "Research notes",
    });

    kernel.syscall({
      type: "resolve-call",
      callId:
        writingCall.callId,
      result:
        "Draft article",
    });

    runTicks(
      kernel,
      1
    );

    const reviewCall =
      Object.values(
        kernel.getState()
          .pendingCalls
      )[0];

    expect(
      reviewCall
    ).toMatchObject({
      capability: "human-review",
      input: "Draft article",
    });

    kernel.syscall({
      type: "resolve-call",
      callId:
        reviewCall.callId,
      result:
        "Approved article",
    });

    runTicks(
      kernel,
      1
    );

    expect(
      kernel.getState()
        .processes[1].state
    ).toBe(
      "terminated"
    );

    expect(
      kernel.getState()
        .results[1]
    ).toMatchObject({
      pid: 1,
      name: "kernel-blog",
      result:
        "Approved article",
    });
  });

  it("completes a kernel workflow with a rejected review result", () => {
    const kernel =
      new Kernel();

    kernel.syscall({
      type: "spawn",
      name: "kernel-blog",
      context:
        "AI-native startups",
      run: function* (
        ctx: string
      ) {
        return yield* blogWorkflow(
          ctx
        );
      },
    });

    runTicks(
      kernel,
      1
    );

    const researchCall =
      Object.values(
        kernel.getState()
          .pendingCalls
      )[0];

    kernel.syscall({
      type: "resolve-call",
      callId:
        researchCall.callId,
      result:
        "Research notes",
    });

    runTicks(
      kernel,
      1
    );

    const writingCall =
      Object.values(
        kernel.getState()
          .pendingCalls
      )[0];

    kernel.syscall({
      type: "resolve-call",
      callId:
        writingCall.callId,
      result:
        "Draft article",
    });

    runTicks(
      kernel,
      1
    );

    const reviewCall =
      Object.values(
        kernel.getState()
          .pendingCalls
      )[0];

    kernel.syscall({
      type: "resolve-call",
      callId:
        reviewCall.callId,
      result:
        "Rejected: needs rewrite",
    });

    runTicks(
      kernel,
      1
    );

    expect(
      kernel.getState()
        .processes[1].state
    ).toBe(
      "terminated"
    );

    expect(
      kernel.getState()
        .results[1].result
    ).toBe(
      "Rejected: needs rewrite"
    );
  });

  it("runs multiple workflows concurrently", () => {
    const kernel =
      new Kernel();

    kernel.syscall({
      type: "spawn",
      name: "blog-a",
      context:
        "AI startups",
      run: function* (
        ctx: string
      ) {
        return yield* blogWorkflow(
          ctx
        );
      },
    });

    kernel.syscall({
      type: "spawn",
      name: "blog-b",
      context:
        "Quantum computing",
      run: function* (
        ctx: string
      ) {
        return yield* blogWorkflow(
          ctx
        );
      },
    });

    runTicks(
      kernel,
      2
    );

    const pendingCalls =
      Object.values(
        kernel.getState()
          .pendingCalls
      );

    expect(
      pendingCalls
    ).toHaveLength(2);

    expect(
      pendingCalls.map(
        (call) =>
          call.capability
      )
    ).toEqual([
      "research",
      "research",
    ]);

    for (const call of pendingCalls) {
      kernel.syscall({
        type: "resolve-call",
        callId:
          call.callId,
        result:
          `research:${call.input}`,
      });
    }

    runTicks(
      kernel,
      2
    );

    const writingCalls =
      Object.values(
        kernel.getState()
          .pendingCalls
      );

    expect(
      writingCalls
    ).toHaveLength(2);

    expect(
      writingCalls.map(
        (call) =>
          call.capability
      )
    ).toEqual([
      "writing",
      "writing",
    ]);

    for (const call of writingCalls) {
      kernel.syscall({
        type: "resolve-call",
        callId:
          call.callId,
        result:
          `draft:${call.input}`,
      });
    }

    runTicks(
      kernel,
      2
    );

    const reviewCalls =
      Object.values(
        kernel.getState()
          .pendingCalls
      );

    expect(
      reviewCalls
    ).toHaveLength(2);

    for (const call of reviewCalls) {
      kernel.syscall({
        type: "resolve-call",
        callId:
          call.callId,
        result:
          `approved:${call.input}`,
      });
    }

    runTicks(
      kernel,
      2
    );

    expect(
      kernel.getState()
        .results[1]
        .result
    ).toContain(
      "approved:"
    );

    expect(
      kernel.getState()
        .results[2]
        .result
    ).toContain(
      "approved:"
    );

    expect(
      kernel.getState()
        .processes[1]
        .state
    ).toBe(
      "terminated"
    );

    expect(
      kernel.getState()
        .processes[2]
        .state
    ).toBe(
      "terminated"
    );
  });

  it("isolates a crashing process from a healthy process", () => {
    const consoleError =
      vi.spyOn(
        console,
        "error"
      ).mockImplementation(
        () => {}
      );

    const kernel =
      new Kernel();

    kernel.syscall({
      type: "spawn",
      name: "crasher",
      context: {},
      run: function* () {
        throw new Error(
          "boom"
        );
      },
    });

    kernel.syscall({
      type: "spawn",
      name: "healthy-blog",
      context:
        "AI startups",
      run: function* (
        ctx: string
      ) {
        return yield* blogWorkflow(
          ctx
        );
      },
    });

    runTicks(
      kernel,
      2
    );

    expect(
      kernel.getState()
        .processes[1]
        .state
    ).toBe(
      "terminated"
    );

    expect(
      kernel.getState()
        .processes[2]
        .state
    ).toBe(
      "waiting_call"
    );

    const pendingCalls =
      Object.values(
        kernel.getState()
          .pendingCalls
      );

    expect(
      pendingCalls
    ).toHaveLength(1);

    expect(
      pendingCalls[0]
    ).toMatchObject({
      pid: 2,
      capability: "research",
      input:
        "AI startups",
    });

    consoleError.mockRestore();
  });
});