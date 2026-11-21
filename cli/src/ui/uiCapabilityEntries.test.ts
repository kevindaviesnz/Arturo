import {
  describe,
  expect,
  it,
} from "vitest";

import {
  readCapabilitiesEntry,
} from "./uiCapabilityEntries";

describe("capability entries", () => {
  it("lists canonical capability ids and explains their boundary", () => {
    const entry =
      readCapabilitiesEntry([]);

    expect(entry.label).toBe("Capabilities");
    expect(entry.body).toContain("analysis");
    expect(entry.body).toContain("safety");
    expect(entry.body).toContain("email-send");
    expect(entry.body).toContain("do not grant tools");
  });

  it("explains one capability with routing examples", () => {
    const entry =
      readCapabilitiesEntry([
        "web",
      ]);

    expect(entry.label).toBe("Capability · web");
    expect(entry.body).toContain("approved web or connector integration");
    expect(entry.body).toContain("does not let a Worker browse the web");
    expect(entry.body).toContain(
      '/task create "<one clear outcome>" --job "<job>"'
    );
  });

  it("accepts explain/inspect verbs before the capability id", () => {
    expect(
      readCapabilitiesEntry(["explain", "web"]).label
    ).toBe("Capability · web");
    expect(
      readCapabilitiesEntry(["inspect", "web"]).label
    ).toBe("Capability · web");
  });

  it("directs unknown values back to the canonical list", () => {
    const entry =
      readCapabilitiesEntry([
        "fashion",
      ]);

    expect(entry.label).toBe("Capability not found");
    expect(entry.body).toContain("Run /capabilities");
  });
});
