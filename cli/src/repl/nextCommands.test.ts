import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  Enterprise,
} from "../enterprise/enterprise";

import {
  parseNextCommandOptions,
  resolveNextEnterprise,
} from "./nextCommands";

const createEnterprise =
  (
    id: string,
    name: string
  ): Enterprise => ({
    id,
    name,
    mission:
      `${name} mission`,
    description:
      undefined,
    status:
      "active",
    businessFunctionIds:
      [],
    createdAt:
      100,
    updatedAt:
      100,
  });

describe(
  "nextCommands",
  () => {
    it(
      "parses an approved route, feedback, and Enterprise independently",
      () => {
        expect(
          parseNextCommandOptions([
            "Arturo",
            "--model",
            "premium-reasoning",
            "--feedback",
            "Use fewer capabilities.",
          ])
        ).toEqual({
          enterpriseReference: "Arturo",
          modelAlias: "premium-reasoning",
          compareAliases: [],
          feedback: "Use fewer capabilities.",
        });
      }
    );

    it(
      "maps friendly model choices to stable aliases",
      () => {
        expect(
          parseNextCommandOptions([
            "--retry",
            "premium",
          ]).modelAlias
        ).toBe("premium-default");
        expect(
          parseNextCommandOptions([
            "--model",
            "local",
          ]).modelAlias
        ).toBe("local-default");
        expect(
          parseNextCommandOptions([
            "--compare",
            "local,premium",
          ]).compareAliases
        ).toEqual([
          "local-default",
          "premium-default",
        ]);
      }
    );

    it(
      "requires comparison to be unambiguous and multi-model",
      () => {
        expect(() =>
          parseNextCommandOptions([
            "--compare",
            "local-default",
          ])
        ).toThrow("at least two");
        expect(() =>
          parseNextCommandOptions([
            "--compare",
            "local-default,premium-default",
            "--model",
            "local-default",
          ])
        ).toThrow("cannot be combined");
        expect(() =>
          parseNextCommandOptions([
            "--compare",
            "local-default,LOCAL-default",
          ])
        ).toThrow("must be unique");
      }
    );

    it(
      "explains how to start when no Enterprise exists",
      () => {
        const result =
          resolveNextEnterprise(
            [],
            []
          );

        expect(
          result.ok
        ).toBe(
          false
        );

        if (!result.ok) {
          expect(
            result.message
          ).toContain(
            "/enterprise create"
          );
        }
      }
    );

    it(
      "selects the only Enterprise automatically",
      () => {
        const enterprise =
          createEnterprise(
            "enterprise-1",
            "Ethical Toys"
          );

        expect(
          resolveNextEnterprise(
            [],
            [
              enterprise,
            ]
          )
        ).toEqual({
          ok: true,
          enterprise,
        });
      }
    );

    it(
      "requires a choice when multiple Enterprises exist",
      () => {
        const result =
          resolveNextEnterprise(
            [],
            [
              createEnterprise(
                "enterprise-1",
                "Ethical Toys"
              ),
              createEnterprise(
                "enterprise-2",
                "Autonomous Bank"
              ),
            ]
          );

        expect(
          result.ok
        ).toBe(
          false
        );

        if (!result.ok) {
          expect(
            result.message
          ).toContain(
            '/next "Ethical Toys"'
          );

          expect(
            result.message
          ).toContain(
            '/next "Autonomous Bank"'
          );
        }
      }
    );

    it(
      "resolves an Enterprise by case-insensitive name",
      () => {
        const enterprise =
          createEnterprise(
            "enterprise-1",
            "Ethical Toys"
          );

        expect(
          resolveNextEnterprise(
            [
              "ethical toys",
            ],
            [
              enterprise,
            ]
          )
        ).toEqual({
          ok: true,
          enterprise,
        });
      }
    );

    it(
      "returns a clear error for an unknown Enterprise",
      () => {
        const result =
          resolveNextEnterprise(
            [
              "Missing Company",
            ],
            [
              createEnterprise(
                "enterprise-1",
                "Ethical Toys"
              ),
            ]
          );

        expect(
          result
        ).toEqual({
          ok: false,
          message:
            "enterprise not found: Missing Company",
        });
      }
    );
  }
);
