import { describe, expect, it } from "vitest";
import { describeModelReadiness, TRY_DATA_DIRECTORY } from "./tryArturo";

describe("npm run try", () => {
  it("keeps the example in its own directory, never the default one", () => {
    expect(TRY_DATA_DIRECTORY).toMatch(/harbour$/);
    expect(TRY_DATA_DIRECTORY).not.toBe(".data");
  });

  it("warns before any approval when the local model is not running", () => {
    expect(describeModelReadiness({ reachable: false })).toContain("NOT running");
    expect(describeModelReadiness({ reachable: false })).toContain("will fail until you open the Ollama app");
  });

  it("says so when the server is up but has no model", () => {
    expect(describeModelReadiness({ reachable: true, models: [] })).toContain("no model installed");
  });

  it("says the model is running when it is", () => {
    expect(describeModelReadiness({ reachable: true, models: ["qwen2.5:latest"] })).toBe("The local AI model is running.");
  });
});
