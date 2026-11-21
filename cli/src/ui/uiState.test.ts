import {
  appendWorkStreamEntry,
  createInitialUiState,
  formatCommandPaletteText,
  formatStatusBarText,
  formatWorkStreamText,
  getSelectedCommand,
  parseUiInput,
  selectNextCommand,
  selectPreviousCommand,
  toggleCommandPalette,
  formatWorkStreamActor,
  addUiInputPrompt,
  removeUiInputPrompt,
} from "./uiState";

import {
  escapeBlessedTags,
  formatBlessedColourText,
  getWorkStreamEntryColour,
} from "./uiState";

import {
  parseUiInputTokens,
} from "./uiState";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  clearWorkStream,
} from "./uiState";

describe(
  "uiState",
  () => {
    it(
      "adds and removes the Arturo shell prompt",
      () => {
        expect(
          addUiInputPrompt(
            "/jobs"
          )
        ).toBe(
          "arturo > /jobs"
        );

        expect(
          removeUiInputPrompt(
            "arturo > /jobs"
          )
        ).toBe(
          "/jobs"
        );
      }
    );

    it(
      "creates the initial UI state",
      () => {
        const state =
          createInitialUiState();

        expect(
          state.commandPaletteOpen
        ).toBe(
          false
        );

        expect(
          state.workStream
        ).toHaveLength(
          1
        );
      }
    );

    it(
  "escapes blessed tag markers",
  () => {
    expect(
      escapeBlessedTags(
        "{red-fg}bad{/red-fg}"
      )
    ).toBe(
      "\\{red-fg\\}bad\\{/red-fg\\}"
    );
  }
);

it(
  "selects red for failed entries",
  () => {
    expect(
      getWorkStreamEntryColour({
        actor: "Arturo",
        label: "Workflow failed",
        body: "Broken",
      })
    ).toBe(
      "red-fg"
    );
  }
);

it(
  "selects green for created entries",
  () => {
    expect(
      getWorkStreamEntryColour({
        actor: "Planner",
        label: "Workflow created",
        body: "Done",
      })
    ).toBe(
      "green-fg"
    );
  }
);

it(
  "formats blessed colour text",
  () => {
    expect(
      formatBlessedColourText(
        "green-fg",
        "Done"
      )
    ).toBe(
      "{green-fg}Done{/green-fg}"
    );
  }
);
      it(
    "clears the work stream",
    () => {
      const state =
        clearWorkStream({
          input: "",
          commandPaletteOpen: false,
          selectedCommandIndex: 0,
          workStream: [
            {
              actor: "Old",
              label: "Entry",
              body: "Old body",
            },
          ],
        });

      expect(
        state.workStream
      ).toEqual([
        {
          actor: "Arturo",
          label: "Cleared",
          body: "Terminal work stream cleared.",
        },
      ]);
    }
      );
    
    it(
      "toggles the command palette immutably",
      () => {
        const state =
          createInitialUiState();

        const next =
          toggleCommandPalette(
            state
          );

        expect(
          next.commandPaletteOpen
        ).toBe(
          true
        );

        expect(
          state.commandPaletteOpen
        ).toBe(
          false
        );
      }
    );

    it(
      "appends a work stream entry immutably",
      () => {
        const state =
          createInitialUiState();

        const next =
          appendWorkStreamEntry(
            state,
            {
              actor: "Worker",
              label: "Complete",
              body: "Done.",
            }
          );

        expect(
          next.workStream
        ).toHaveLength(
          2
        );

        expect(
          state.workStream
        ).toHaveLength(
          1
        );
      }
    );

    it(
      "parses empty input",
      () => {
        expect(
          parseUiInput(
            "   "
          )
        ).toEqual({
          kind: "empty",
        });
      }
    );

    it(
      "parses plain input as ask request",
      () => {
        expect(
          parseUiInput(
            "Plan launch"
          )
        ).toEqual({
          kind: "ask",
          request: "Plan launch",
        });
      }
    );

    it(
      "parses slash command input",
      () => {
        expect(
          parseUiInput(
            "/jobs active"
          )
        ).toEqual({
          kind: "command",
          command: "/jobs",
          args: [
            "active",
          ],
        });
      }
    );

    it(
      "formats status bar text",
      () => {
        expect(
          formatStatusBarText({
            workers: 2,
            jobs: 3,
            waitingApprovals: 1,
            businessFunctions: 4,
          })
        ).toContain(
          "2 workers"
        );
      }
    );

    it(
      "formats command palette text with selected command",
      () => {
        const formatted =
          formatCommandPaletteText(
            [
              "/ask",
              "/jobs",
            ],
            1
          );

        expect(formatted).toContain(
          "{cyan-bg}"
        );
        expect(formatted).toContain(
          "◆ /jobs"
        );
      }
    );

it(
  "formats work stream entries",
  () => {
    expect(
      formatWorkStreamText([
        {
          actor: "Arturo",
          label: "Ready",
          body: "Waiting.",
        },
      ])
    ).toBe(
      "{cyan-fg}◆{/cyan-fg} {bold}Arturo{/bold} {cyan-fg}Ready{/cyan-fg}\n  Waiting."
    );
  }
);
    
    it(
  "formats You actor with prompt marker",
  () => {
    expect(
      formatWorkStreamActor(
        "You"
      )
    ).toBe(
      "arturo >"
    );
  }
);

it(
  "does not add prompt marker to non-user actors",
  () => {
    expect(
      formatWorkStreamActor(
        "Arturo"
      )
    ).toBe(
      "Arturo"
    );
  }
);

        it(
      "selects the next command and wraps around",
      () => {
        const state =
          createInitialUiState();

        const first =
          selectNextCommand(
            state,
            2
          );

        const second =
          selectNextCommand(
            first,
            2
          );

        expect(
          first.selectedCommandIndex
        ).toBe(
          1
        );

        expect(
          second.selectedCommandIndex
        ).toBe(
          0
        );
      }
    );

    it(
      "selects the previous command and wraps around",
      () => {
        const state =
          createInitialUiState();

        const next =
          selectPreviousCommand(
            state,
            2
          );

        expect(
          next.selectedCommandIndex
        ).toBe(
          1
        );
      }
    );

    it(
      "returns the selected command",
      () => {
        expect(
          getSelectedCommand(
            [
              "/ask",
              "/jobs",
            ],
            1
          )
        ).toBe(
          "/jobs"
        );
      }
    );

    it("renders user command entries on one line", () => {
      expect(
        formatWorkStreamText([
          {
            actor: "You",
            label: "/enterprise",
            body: "list",
          },
        ])
      ).toBe(
        "{cyan-fg}›{/cyan-fg} {cyan-fg}arturo >{/cyan-fg} {bold}/enterprise list{/bold}"
      );
    });
    
  }
);
