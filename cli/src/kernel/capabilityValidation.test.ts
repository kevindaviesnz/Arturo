import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  Kernel,
} from "./kernel";

describe(
  "capability validation",
  () => {
    it(
      "terminates process using unknown capability",
      () => {
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

          name:
            "bad-process",

          context: {},

          run: function* () {
            yield {
              type: "call",

              capability:
                "unknown.capability",

              input:
                "hello",
            };
          },
        });

        kernel.syscall({
          type: "tick",
        });

        const process =
          kernel
            .getState()
            .processes[1];

        expect(
          process.state
        ).toBe(
          "terminated"
        );

        expect(
          kernel
            .getState()
            .results[1]
        ).toEqual({
          pid: 1,

          name:
            "bad-process",

          result: {
            error:
              "Unknown capability: unknown.capability",
          },

          completedAt:
            expect.any(
              Number
            ),
        });

        consoleError.mockRestore();
      }
    );

    it(
      "terminates process using invalid capability input",
      () => {
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

          name:
            "invalid-input-process",

          context: {},

          run: function* () {
            yield {
              type: "call",

              capability:
                "research",

              input: {
                topic:
                  "AI startups",
              },
            };
          },
        });

        kernel.syscall({
          type: "tick",
        });

        const process =
          kernel
            .getState()
            .processes[1];

        expect(
          process.state
        ).toBe(
          "terminated"
        );

        expect(
          kernel
            .getState()
            .results[1]
            .result
        ).toEqual({
          error:
            "Invalid input for capability research: expected string, received object",
        });

        expect(
          Object.values(
            kernel
              .getState()
              .pendingCalls
          )
        ).toHaveLength(0);

        consoleError.mockRestore();
      }
    );

    it(
      "creates pending call for valid capability input",
      () => {
        const kernel =
          new Kernel();

        kernel.syscall({
          type: "spawn",

          name:
            "valid-input-process",

          context: {},

          run: function* () {
            yield {
              type: "call",

              capability:
                "research",

              input:
                "AI startups",
            };
          },
        });

        kernel.syscall({
          type: "tick",
        });

        const pendingCalls =
          Object.values(
            kernel
              .getState()
              .pendingCalls
          );

        expect(
          pendingCalls
        ).toHaveLength(1);

        expect(
          pendingCalls[0]
        ).toMatchObject({
          pid: 1,
          capability:
            "research",
          input:
            "AI startups",
        });
      }
    );

    it(
      "terminates process when email.send payload is missing body",
      () => {
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

          name:
            "invalid-email-process",

          context: {},

          run: function* () {
            yield {
              type: "call",

              capability:
                "email.send",

              input: {
                to:
                  "admin@example.com",

                subject:
                  "Important",
              },
            };
          },
        });

        kernel.syscall({
          type: "tick",
        });

        const process =
          kernel
            .getState()
            .processes[1];

        expect(
          process.state
        ).toBe(
          "terminated"
        );

        expect(
          Object.values(
            kernel
              .getState()
              .pendingCalls
          )
        ).toHaveLength(0);

        consoleError.mockRestore();
      }
    );

    it(
      "creates approval-gated pending call for valid email.send payload",
      () => {
        const kernel =
          new Kernel();

        kernel.syscall({
          type: "spawn",

          name:
            "valid-email-process",

          context: {},

          run: function* () {
            yield {
              type: "call",

              capability:
                "email.send",

              input: {
                to:
                  "admin@example.com",

                subject:
                  "System Alert",

                body:
                  "Disk usage exceeded threshold.",
              },
            };
          },
        });

        kernel.syscall({
          type: "tick",
        });

        const process =
          kernel
            .getState()
            .processes[1];

        expect(
          process.state
        ).toBe(
          "waiting_call"
        );

        const pendingCalls =
          Object.values(
            kernel
              .getState()
              .pendingCalls
          );

        expect(
          pendingCalls
        ).toHaveLength(1);

        expect(
          pendingCalls[0]
        ).toMatchObject({
          capability:
            "email.send",
        });
      }
    );

    it(
      "creates approval-gated pending call for shell.exec",
      () => {
        const kernel =
          new Kernel();

        kernel.syscall({
          type: "spawn",

          name:
            "shell-process",

          context: {},

          run: function* () {
            yield {
              type: "call",

              capability:
                "shell.exec",

              input:
                "rm -rf /tmp/test",
            };
          },
        });

        kernel.syscall({
          type: "tick",
        });

        const process =
          kernel
            .getState()
            .processes[1];

        expect(
          process.state
        ).toBe(
          "waiting_call"
        );

        expect(
          Object.values(
            kernel
              .getState()
              .pendingCalls
          )
        ).toHaveLength(1);
      }
    );

    it(
      "creates approval-gated pending call for file.delete",
      () => {
        const kernel =
          new Kernel();

        kernel.syscall({
          type: "spawn",

          name:
            "delete-process",

          context: {},

          run: function* () {
            yield {
              type: "call",

              capability:
                "file.delete",

              input:
                "/tmp/test.txt",
            };
          },
        });

        kernel.syscall({
          type: "tick",
        });

        const process =
          kernel
            .getState()
            .processes[1];

        expect(
          process.state
        ).toBe(
          "waiting_call"
        );

        expect(
          Object.values(
            kernel
              .getState()
              .pendingCalls
          )
        ).toHaveLength(1);
      }
    );

    it(
      "fails closed before dangerous capability dispatch",
      () => {
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

          name:
            "dangerous-invalid-process",

          context: {},

          run: function* () {
            yield {
              type: "call",

              capability:
                "shell.exec",

              input: {
                command:
                  "rm -rf /",
              },
            };
          },
        });

        kernel.syscall({
          type: "tick",
        });

        const process =
          kernel
            .getState()
            .processes[1];

        expect(
          process.state
        ).toBe(
          "terminated"
        );

        expect(
          Object.values(
            kernel
              .getState()
              .pendingCalls
          )
        ).toHaveLength(0);

        consoleError.mockRestore();
      }
    );
  }
);