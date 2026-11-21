import {
  describe,
  expect,
  it,
} from "vitest";

import {
  addBusinessFunctionJobId,
  addBusinessFunctionRefinement,
  createBusinessFunctionRuntime,
  setBusinessFunctionState,
} from "./businessFunctionRuntime";

import {
  failBusinessFunction,
  pauseBusinessFunction,
  resumeBusinessFunction,
  startBusinessFunction,
  stopBusinessFunction,
} from "./businessFunctionRuntime";

describe("businessFunctionRuntime", () => {
  it("creates a draft runtime business function", () => {
    expect(
      createBusinessFunctionRuntime({
        id: "function-1",
        label: "Market Research",
        objective: "Research Gen Z fashion trends.",
        ownerWorker: "auto-researcher",
      })
    ).toEqual({
      id: "function-1",
      label: "Market Research",
      objective: "Research Gen Z fashion trends.",
      ownerWorker: "auto-researcher",
      refinements: [],
      state: "draft",
      jobIds: [],
    });
  });

  it("adds a refinement", () => {
    const businessFunction =
      createBusinessFunctionRuntime({
        id: "function-1",
        label: "Market Research",
        objective: "Research Gen Z fashion trends.",
        ownerWorker: "auto-researcher",
      });

    expect(
      addBusinessFunctionRefinement(
        businessFunction,
        "Focus on TikTok trend signals."
      ).refinements
    ).toEqual([
      "Focus on TikTok trend signals.",
    ]);
  });

  it("ignores empty refinements", () => {
    const businessFunction =
      createBusinessFunctionRuntime({
        id: "function-1",
        label: "Market Research",
        objective: "Research Gen Z fashion trends.",
        ownerWorker: "auto-researcher",
      });

    expect(
      addBusinessFunctionRefinement(
        businessFunction,
        "   "
      )
    ).toBe(
      businessFunction
    );
  });

  it("sets the runtime state", () => {
    const businessFunction =
      createBusinessFunctionRuntime({
        id: "function-1",
        label: "Market Research",
        objective: "Research Gen Z fashion trends.",
        ownerWorker: "auto-researcher",
      });

    expect(
      setBusinessFunctionState(
        businessFunction,
        "ready"
      ).state
    ).toBe(
      "ready"
    );
  });

  it("adds a job id", () => {
    const businessFunction =
      createBusinessFunctionRuntime({
        id: "function-1",
        label: "Market Research",
        objective: "Research Gen Z fashion trends.",
        ownerWorker: "auto-researcher",
      });

    expect(
      addBusinessFunctionJobId(
        businessFunction,
        "job-1"
      ).jobIds
    ).toEqual([
      "job-1",
    ]);
  });

  it("starts a business function", () => {
  const businessFunction =
    createBusinessFunctionRuntime({
      id: "enterprise-1:function-1",
      label: "News Discovery",
      objective: "Find trusted articles.",
      ownerWorker: "unassigned",
    });

  expect(
    startBusinessFunction(
      businessFunction
    )
  ).toEqual({
    ...businessFunction,
    state: "running",
  });
});

it("pauses a business function", () => {
  const businessFunction =
    createBusinessFunctionRuntime({
      id: "enterprise-1:function-1",
      label: "News Discovery",
      objective: "Find trusted articles.",
      ownerWorker: "unassigned",
    });

  expect(
    pauseBusinessFunction(
      businessFunction
    )
  ).toEqual({
    ...businessFunction,
    state: "paused",
  });
});

it("resumes a business function", () => {
  const businessFunction =
    createBusinessFunctionRuntime({
      id: "enterprise-1:function-1",
      label: "News Discovery",
      objective: "Find trusted articles.",
      ownerWorker: "unassigned",
    });

  expect(
    resumeBusinessFunction(
      businessFunction
    )
  ).toEqual({
    ...businessFunction,
    state: "running",
  });
});

it("stops a business function", () => {
  const businessFunction =
    createBusinessFunctionRuntime({
      id: "enterprise-1:function-1",
      label: "News Discovery",
      objective: "Find trusted articles.",
      ownerWorker: "unassigned",
    });

  expect(
    stopBusinessFunction(
      businessFunction
    )
  ).toEqual({
    ...businessFunction,
    state: "stopped",
  });
});

it("fails a business function", () => {
  const businessFunction =
    createBusinessFunctionRuntime({
      id: "enterprise-1:function-1",
      label: "News Discovery",
      objective: "Find trusted articles.",
      ownerWorker: "unassigned",
    });

  expect(
    failBusinessFunction(
      businessFunction
    )
  ).toEqual({
    ...businessFunction,
    state: "failed",
  });
});
});