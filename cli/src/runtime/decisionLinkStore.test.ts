import {
  clearDecisionLinks,
  createDecisionLink,
  findDecisionLinkByJobId,
  getDecisionLink,
  listDecisionLinks,
  markDecisionLinkExpired,
  markDecisionLinkUsed,
} from "./decisionLinkStore";

import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

describe(
  "decisionLinkStore",
  () => {
    beforeEach(() => {
      clearDecisionLinks();
    });

    it(
      "creates a decision link",
      () => {
        const link =
          createDecisionLink(
            "job-1",
            "sarah@example.com",
            "hash-1",
            9999999999999
          );

        expect(
          link.jobId
        ).toBe("job-1");

        expect(
          link.email
        ).toBe(
          "sarah@example.com"
        );

        expect(
          link.tokenHash
        ).toBe("hash-1");

        expect(
          link.status
        ).toBe("active");

        expect(
          link.id.length
        ).toBeGreaterThan(0);
      }
    );

    it(
      "retrieves a decision link by id",
      () => {
        const created =
          createDecisionLink(
            "job-1",
            "sarah@example.com",
            "hash-1",
            9999999999999
          );

        const found =
          getDecisionLink(
            created.id
          );

        expect(found)
          .toEqual(created);
      }
    );

    it(
      "returns undefined for unknown id",
      () => {
        expect(
          getDecisionLink(
            "missing"
          )
        ).toBeUndefined();
      }
    );

    it(
      "finds a decision link by job id",
      () => {
        const created =
          createDecisionLink(
            "job-123",
            "sarah@example.com",
            "hash-1",
            9999999999999
          );

        const found =
          findDecisionLinkByJobId(
            "job-123"
          );

        expect(found)
          .toEqual(created);
      }
    );

    it(
      "returns undefined when job id does not exist",
      () => {
        expect(
          findDecisionLinkByJobId(
            "missing"
          )
        ).toBeUndefined();
      }
    );

    it(
      "marks a decision link as used",
      () => {
        const created =
          createDecisionLink(
            "job-1",
            "sarah@example.com",
            "hash-1",
            9999999999999
          );

        const updated =
          markDecisionLinkUsed(
            created.id
          );

        expect(
          updated?.status
        ).toBe("used");

        expect(
          updated?.usedAt
        ).toBeDefined();
      }
    );

    it(
      "returns undefined when marking unknown link as used",
      () => {
        expect(
          markDecisionLinkUsed(
            "missing"
          )
        ).toBeUndefined();
      }
    );

    it(
      "marks a decision link as expired",
      () => {
        const created =
          createDecisionLink(
            "job-1",
            "sarah@example.com",
            "hash-1",
            9999999999999
          );

        const updated =
          markDecisionLinkExpired(
            created.id
          );

        expect(
          updated?.status
        ).toBe("expired");
      }
    );

    it(
      "returns undefined when marking unknown link as expired",
      () => {
        expect(
          markDecisionLinkExpired(
            "missing"
          )
        ).toBeUndefined();
      }
    );

    it(
      "lists all decision links",
      () => {
        createDecisionLink(
          "job-1",
          "sarah@example.com",
          "hash-1",
          9999999999999
        );

        createDecisionLink(
          "job-2",
          "bob@example.com",
          "hash-2",
          9999999999999
        );

        const links =
          listDecisionLinks();

        expect(
          links.length
        ).toBe(2);
      }
    );

    it(
      "clears all decision links",
      () => {
        createDecisionLink(
          "job-1",
          "sarah@example.com",
          "hash-1",
          9999999999999
        );

        expect(
          listDecisionLinks()
            .length
        ).toBe(1);

        clearDecisionLinks();

        expect(
          listDecisionLinks()
            .length
        ).toBe(0);
      }
    );

    it(
      "supports multiple links for different jobs",
      () => {
        const linkA =
          createDecisionLink(
            "job-a",
            "a@example.com",
            "hash-a",
            9999999999999
          );

        const linkB =
          createDecisionLink(
            "job-b",
            "b@example.com",
            "hash-b",
            9999999999999
          );

        expect(
          findDecisionLinkByJobId(
            "job-a"
          )?.id
        ).toBe(linkA.id);

        expect(
          findDecisionLinkByJobId(
            "job-b"
          )?.id
        ).toBe(linkB.id);
      }
    );

    it(
      "preserves createdAt timestamp",
      () => {
        const before =
          Date.now();

        const link =
          createDecisionLink(
            "job-1",
            "sarah@example.com",
            "hash-1",
            9999999999999
          );

        const after =
          Date.now();

        expect(
          link.createdAt
        ).toBeGreaterThanOrEqual(
          before
        );

        expect(
          link.createdAt
        ).toBeLessThanOrEqual(
          after
        );
      }
    );
  }
);