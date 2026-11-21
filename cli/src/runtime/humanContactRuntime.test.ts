import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  Worker,
} from "../control/workers";

import {
  createHumanContactEmailBody,
  isContactableHumanWorker,
  requestHumanContact,
} from "./humanContactRuntime";

vi.mock(
  "../integrations/emailSender",
  () => ({
    sendEmail:
      vi.fn(async () => undefined),
  })
);

import {
  sendEmail,
} from "../integrations/emailSender";

describe("humanContactRuntime", () => {
  const requester: Worker<any, any> = {
    name: "Researcher",
    displayName: "Researcher",
    kind: "ai",
    capabilities: [
      "llm",
      "research",
      "human-contact",
    ],
    run: function* () {
      return {};
    },
  };

  const human: Worker<any, any> = {
    name: "Sarah",
    displayName: "Sarah",
    kind: "human",
    email: "sarah@example.com",
    capabilities: [
      "human-review",
    ],
    run: function* () {
      return {};
    },
  };

  it("does not allow raw email contact without human-contact", async () => {
  await expect(
    requestHumanContact({
      requestingWorker: {
        name: "Writer",
        displayName: "Writer",
        kind: "ai",
        capabilities: [
          "llm",
          "writing",
        ],
        run: function* () {
          return {};
        },
      },
      humanWorker:
        human,
      subject:
        "Review requested",
      body:
        "Please review this.",
    })
  ).rejects.toThrow(
    "lacks required capability: human-contact"
  );

  expect(
    sendEmail
  ).not.toHaveBeenCalledWith(
    "sarah@example.com",
    "Review requested",
    expect.any(String)
  );
  });
  
  it("detects contactable human workers", () => {
    expect(
      isContactableHumanWorker(
        human
      )
    ).toBe(true);
  });

  it("rejects human workers without email", () => {
    expect(
      isContactableHumanWorker({
        ...human,
        email: undefined,
      })
    ).toBe(false);
  });

  it("creates a controlled email body", () => {
    expect(
      createHumanContactEmailBody(
        requester,
        "Please review this."
      )
    ).toContain(
      "Requested by: Researcher"
    );
  });

  it("allows workers with human-contact to contact registered humans", async () => {
    await requestHumanContact({
      requestingWorker:
        requester,
      humanWorker:
        human,
      subject:
        "Review requested",
      body:
        "Please review this.",
    });

    expect(
      sendEmail
    ).toHaveBeenCalledWith(
      "sarah@example.com",
      "Review requested",
      expect.stringContaining(
        "Please review this."
      )
    );
  });

  it("rejects workers without human-contact", async () => {
    await expect(
      requestHumanContact({
        requestingWorker: {
          ...requester,
          capabilities: [
            "llm",
            "research",
          ],
        },
        humanWorker:
          human,
        subject:
          "Review requested",
        body:
          "Please review this.",
      })
    ).rejects.toThrow(
      "lacks required capability: human-contact"
    );
  });

  it("rejects non-contactable human workers", async () => {
    await expect(
      requestHumanContact({
        requestingWorker:
          requester,
        humanWorker: {
          ...human,
          email: undefined,
        },
        subject:
          "Review requested",
        body:
          "Please review this.",
      })
    ).rejects.toThrow(
      "Human worker is not contactable"
    );
  });
});
