import {
  describe,
  expect,
  it,
} from "vitest";

import {
  handleUiEnterpriseAdviseCreateSubcommand,
} from "./uiCommandHandlers";

describe("handleUiEnterpriseAdviseCreateSubcommand", () => {
  it("refuses the guided flow in a non-interactive session", async () => {
    // Under vitest stdin is not a TTY, so the session is non-interactive. The
    // guided flow must refuse with guidance rather than hang or call the model.
    const entries =
      await handleUiEnterpriseAdviseCreateSubcommand([
        "Ethical Toys",
      ]);

    expect(entries).toHaveLength(1);
    expect(entries[0].label).toBe("Interactive guidance unavailable");
    expect(entries[0].body).toContain("--mission");
  });
});
