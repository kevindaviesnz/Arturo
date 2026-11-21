import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  createBusinessFunctionRuntime,
} from "./businessFunctionRuntime";

import {
  attachBusinessFunctionJob,
  clearBusinessFunctions,
  getBusinessFunction,
  listBusinessFunctions,
  refineBusinessFunction,
  saveBusinessFunction,
  updateBusinessFunctionState,
} from "./businessFunctionRuntimeStore";

import {
  failBusinessFunctionRuntime,
  pauseBusinessFunctionRuntime,
  resumeBusinessFunctionRuntime,
  startBusinessFunctionRuntime,
  stopBusinessFunctionRuntime,
} from "./businessFunctionRuntimeStore";

beforeEach(() => {
  clearBusinessFunctions();
});

describe("businessFunctionRuntimeStore", () => {
  it("saves and lists business functions", () => {
    const businessFunction =
      createBusinessFunctionRuntime({
        id: "function-1",
        label: "Market Research",
        objective: "Research Gen Z fashion trends.",
        ownerWorker: "auto-researcher",
      });

    saveBusinessFunction(
      businessFunction
    );

    expect(
      listBusinessFunctions()
    ).toEqual([
      businessFunction,
    ]);
  });

  it("gets a business function by id", () => {
    const businessFunction =
      createBusinessFunctionRuntime({
        id: "function-1",
        label: "Market Research",
        objective: "Research Gen Z fashion trends.",
        ownerWorker: "auto-researcher",
      });

    saveBusinessFunction(
      businessFunction
    );

    expect(
      getBusinessFunction(
        "function-1"
      )
    ).toEqual(
      businessFunction
    );
  });

  it("refines a stored business function", () => {
    saveBusinessFunction(
      createBusinessFunctionRuntime({
        id: "function-1",
        label: "Market Research",
        objective: "Research Gen Z fashion trends.",
        ownerWorker: "auto-researcher",
      })
    );

    expect(
      refineBusinessFunction(
        "function-1",
        "Focus on TikTok trend signals."
      )?.refinements
    ).toEqual([
      "Focus on TikTok trend signals.",
    ]);
  });

  it("updates a stored business function state", () => {
    saveBusinessFunction(
      createBusinessFunctionRuntime({
        id: "function-1",
        label: "Market Research",
        objective: "Research Gen Z fashion trends.",
        ownerWorker: "auto-researcher",
      })
    );

    expect(
      updateBusinessFunctionState(
        "function-1",
        "ready"
      )?.state
    ).toBe(
      "ready"
    );
  });

  it("attaches a job id to a stored business function", () => {
    saveBusinessFunction(
      createBusinessFunctionRuntime({
        id: "function-1",
        label: "Market Research",
        objective: "Research Gen Z fashion trends.",
        ownerWorker: "auto-researcher",
      })
    );

    expect(
      attachBusinessFunctionJob(
        "function-1",
        "job-1"
      )?.jobIds
    ).toEqual([
      "job-1",
    ]);
  });

  it("returns undefined when refining a missing business function", () => {
    expect(
      refineBusinessFunction(
        "missing",
        "Focus on TikTok."
      )
    ).toBeUndefined();
  });

  it("starts a business function runtime", () => {
  saveBusinessFunction(
    createBusinessFunctionRuntime({
      id: "enterprise-1:function-1",
      label: "News Discovery",
      objective: "Find news.",
      ownerWorker: "unassigned",
    })
  );

  expect(
    startBusinessFunctionRuntime(
      "enterprise-1:function-1"
    )
  ).toEqual(
    expect.objectContaining({
      state: "running",
    })
  );
});

it("pauses a business function runtime", () => {
  saveBusinessFunction(
    createBusinessFunctionRuntime({
      id: "enterprise-1:function-1",
      label: "News Discovery",
      objective: "Find news.",
      ownerWorker: "unassigned",
    })
  );

  expect(
    pauseBusinessFunctionRuntime(
      "enterprise-1:function-1"
    )
  ).toEqual(
    expect.objectContaining({
      state: "paused",
    })
  );
});

it("resumes a business function runtime", () => {
  saveBusinessFunction(
    createBusinessFunctionRuntime({
      id: "enterprise-1:function-1",
      label: "News Discovery",
      objective: "Find news.",
      ownerWorker: "unassigned",
    })
  );

  expect(
    resumeBusinessFunctionRuntime(
      "enterprise-1:function-1"
    )
  ).toEqual(
    expect.objectContaining({
      state: "running",
    })
  );
});

it("stops a business function runtime", () => {
  saveBusinessFunction(
    createBusinessFunctionRuntime({
      id: "enterprise-1:function-1",
      label: "News Discovery",
      objective: "Find news.",
      ownerWorker: "unassigned",
    })
  );

  expect(
    stopBusinessFunctionRuntime(
      "enterprise-1:function-1"
    )
  ).toEqual(
    expect.objectContaining({
      state: "stopped",
    })
  );
});

it("fails a business function runtime", () => {
  saveBusinessFunction(
    createBusinessFunctionRuntime({
      id: "enterprise-1:function-1",
      label: "News Discovery",
      objective: "Find news.",
      ownerWorker: "unassigned",
    })
  );

  expect(
    failBusinessFunctionRuntime(
      "enterprise-1:function-1"
    )
  ).toEqual(
    expect.objectContaining({
      state: "failed",
    })
  );
});

it("returns undefined when transitioning a missing runtime", () => {
  expect(
    startBusinessFunctionRuntime(
      "missing"
    )
  ).toBeUndefined();
});
  
});