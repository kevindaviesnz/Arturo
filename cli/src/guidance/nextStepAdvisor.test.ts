import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  generateWithConfiguredLlm,
} from "../llm/llmClient";

import {
  buildNextStepAdvicePrompt,
  buildRecommendationReasonPrompt,
  DEFAULT_RECOMMENDATION_REASON,
  mergeRecommendationReasons,
  normaliseRecommendedFunctionName,
  buildNextStepRepairPrompt,
  extractJsonObjectSubstring,
  filterNewBusinessFunctionRecommendations,
  formatNextStepAdvice,
  isEchoedSummary,
  formatRecommendedFunctionCommand,
  generateNextStepGuidance,
  parseBusinessFunctionRecommendation,
  parseNextStepAdvice,
  parseRecommendationExampleTasks,
  resolveNextStepModel,
  stripNextStepMarkdownFences,
} from "./nextStepAdvisor";

vi.mock(
  "../llm/llmClient",
  () => ({
    generateWithConfiguredLlm:
      vi.fn(),
  })
);

const context = {
  enterpriseName:
    "Ethical Toys",
  mission:
    "Provide ethical toys for parents of young children.",
  existingBusinessFunctions: [
    "Sales",
  ],
} as const;

const advice = {
  summary:
    "Ethical Toys is a product Enterprise serving parents and children while making an explicit ethical promise.",
  recommendations: [
    {
      name:
        "Product Safety",
      objective:
        "Ensure every product is safe and appropriate for its intended age group.",
      reason:
        "The Enterprise sells products intended for children.",
      exampleTasks: [],
    },
    {
      name:
        "Ethical Sourcing",
      objective:
        "Verify that products and suppliers satisfy the Enterprise's ethical sourcing commitments.",
      reason:
        "The mission makes an ethical promise that requires explicit ownership.",
      exampleTasks: [],
    },
  ],
  recommendedNextAction:
    "Review the proposed capabilities and create the first Business Function whose boundary and Objective you understand.",
  caveats: [
    "The final operating model depends on whether the Enterprise manufactures, imports, or resells toys.",
  ],
} as const;

beforeEach(
  () => {
    vi.clearAllMocks();
  }
);

describe(
  "nextStepAdvisor",
  () => {
    it(
      "uses the configured model when present",
      () => {
        expect(
          resolveNextStepModel({
            ARTURO_LLM_MODEL:
              "custom-model",
          })
        ).toBe(
          "custom-model"
        );
      }
    );

    it(
      "uses the existing local model default",
      () => {
        expect(
          resolveNextStepModel({})
        ).toBe(
          "llama3.2:latest"
        );
      }
    );

    it(
      "builds a prompt containing the Enterprise context",
      () => {
        const prompt =
          buildNextStepAdvicePrompt(
            context
          );

        expect(
          prompt
        ).toContain(
          "Ethical Toys"
        );

        expect(
          prompt
        ).toContain(
          context.mission
        );

        expect(
          prompt
        ).toContain(
          "1. Sales"
        );

        expect(
          prompt
        ).toContain(
          "Do not recommend a Function already represented"
        );

        expect(
          prompt
        ).toContain(
          "Return valid JSON only"
        );
      }
    );

    it(
      "instructs the model to lead with value-delivery and reject one-off projects",
      () => {
        const prompt =
          buildNextStepAdvicePrompt(
            context
          );

        expect(prompt).toContain(
          "Lead with the Functions that directly produce and deliver what this business sells"
        );
        expect(prompt).toContain(
          "an audit department, not the business"
        );
        expect(prompt).toContain(
          "if the objective is finished once and then done, it is a one-off project"
        );
        expect(prompt).toContain("Establish");
      }
    );

    it(
      "removes model markdown fences",
      () => {
        expect(
          stripNextStepMarkdownFences(
            '```json\n{"summary":"Test"}\n```'
          )
        ).toBe(
          '{"summary":"Test"}'
        );
      }
    );

    it(
      "extracts a JSON object surrounded by model prose",
      () => {
        expect(
          extractJsonObjectSubstring(
            'Sure, here is the JSON:\n{"summary":"Test"}\nLet me know if that helps!'
          )
        ).toBe(
          '{"summary":"Test"}'
        );
      }
    );

    it(
      "leaves text unchanged when no JSON object bounds are found",
      () => {
        expect(
          extractJsonObjectSubstring(
            "Here are some ideas."
          )
        ).toBe(
          "Here are some ideas."
        );
      }
    );

    it(
      "parses advice wrapped in leading and trailing prose (no fences)",
      () => {
        expect(
          parseNextStepAdvice(
            `Here you go:\n${JSON.stringify(advice)}\nHope that helps!`
          )
        ).toEqual(
          advice
        );
      }
    );

    it(
      "tolerates a recommendation missing only its reason, with a transparent fallback",
      () => {
        const parsed =
          parseNextStepAdvice(
            JSON.stringify({
              ...advice,
              recommendations: [
                {
                  name: "Product Safety",
                  objective: "Keep products safe for children.",
                },
              ],
            })
          );

        expect(
          parsed.recommendations[0].reason
        ).toBe(
          "The model did not explain this recommendation."
        );
      }
    );

    it(
      "builds a focused JSON repair prompt",
      () => {
        const prompt =
          buildNextStepRepairPrompt(
            context,
            '{"recommendations":[{"name":"Safety"}]}',
            "reason must be a non-empty string"
          );

        expect(
          prompt
        ).toContain(
          "reason must be a non-empty string"
        );

        expect(
          prompt
        ).toContain(
          "Every recommendation must contain name, objective, and reason."
        );

        expect(
          prompt
        ).toContain(
          "Ethical Toys"
        );
      }
    );

    it(
      "parses valid model advice",
      () => {
        expect(
          parseNextStepAdvice(
            JSON.stringify(
              advice
            )
          )
        ).toEqual(
          advice
        );
      }
    );

    it(
      "rejects non-JSON model output",
      () => {
        expect(
          () =>
            parseNextStepAdvice(
              "Here are some ideas."
            )
        ).toThrow(
          "not valid JSON"
        );
      }
    );

    it(
      "rejects malformed recommendations",
      () => {
        expect(
          () =>
            parseNextStepAdvice(
              JSON.stringify({
                ...advice,
                recommendations: [
                  {
                    name:
                      "Product Safety",
                  },
                ],
              })
            )
        ).toThrow(
          "objective must be a non-empty string"
        );
      }
    );

    it(
      "removes duplicate and existing recommendations",
      () => {
        expect(
          filterNewBusinessFunctionRecommendations(
            [
              {
                name:
                  "Sales",
                objective:
                  "Convert demand.",
                reason:
                  "Revenue.",
              },
              {
                name:
                  "Product Safety",
                objective:
                  "Keep products safe.",
                reason:
                  "Children use them.",
              },
              {
                name:
                  "product safety",
                objective:
                  "Duplicate.",
                reason:
                  "Duplicate.",
              },
            ],
            [
              "sales",
            ]
          )
        ).toEqual([
          {
            name:
              "Product Safety",
            objective:
              "Keep products safe.",
            reason:
              "Children use them.",
          },
        ]);
      }
    );

    it(
      "formats a ready-to-run creation command",
      () => {
        expect(
          formatRecommendedFunctionCommand(
            "Ethical Toys",
            advice.recommendations[0]
          )
        ).toBe(
          '/function create "Product Safety" --enterprise "Ethical Toys" --objective "Ensure every product is safe and appropriate for its intended age group."'
        );
      }
    );

    it(
      "clearly explains what Arturo and the model did",
      () => {
        const output =
          formatNextStepAdvice(
            context,
            advice
          );

        expect(
          output
        ).toContain(
          "Arturo's understanding"
        );

        expect(
          output
        ).toContain(
          "Product Safety"
        );

        // The verbose Transparency block and Example commands were removed; a
        // concise "nothing created yet" safety note stays.
        expect(
          output
        ).toContain(
          "nothing has been created yet"
        );

        expect(output).not.toContain("Example commands");
        expect(output).not.toContain("Arturo sent the Enterprise name");

        expect(
          output
        ).toContain(
          "Would you like to create these Functions?"
        );

        expect(
          output
        ).toContain(
          "To add staff later, run /staff."
        );

        expect(
          output
        ).toContain(
          'Reply "yes" to create all recommended Functions, or "no" to leave them unchanged.'
        );
      }
    );

    it(
      "does not ask to create Functions when none are recommended",
      () => {
        const output =
          formatNextStepAdvice(
            context,
            {
              ...advice,
              recommendations: [],
            }
          );

        expect(
          output
        ).not.toContain(
          "Would you like to create these Functions?"
        );
      }
    );

    it(
      "calls the configured model and returns formatted guidance",
      async () => {
        vi.mocked(
          generateWithConfiguredLlm
        ).mockResolvedValue({
          response:
            JSON.stringify(
              advice
            ),
        });

        const output =
          await generateNextStepGuidance(
            context
          );

        expect(
          generateWithConfiguredLlm
        ).toHaveBeenCalledWith({
          model:
            "llama3.2:latest",
          prompt:
            expect.stringContaining(
              "Ethical Toys"
            ),
        });

        expect(
          output
        ).toContain(
          "Ethical Sourcing"
        );

        expect(
          output
        ).toContain(
          "nothing has been created yet"
        );
      }
    );

    it(
      "repairs a malformed model response once",
      async () => {
        // Missing "objective" — unlike "reason", this stays strictly required,
        // so this fixture still needs a repair round-trip.
        const malformedAdvice = {
          ...advice,
          recommendations: [
            {
              name:
                "Product Safety",
            },
          ],
        };

        vi.mocked(
          generateWithConfiguredLlm
        )
          .mockResolvedValueOnce({
            response:
              JSON.stringify(
                malformedAdvice
              ),
          })
          .mockResolvedValueOnce({
            response:
              JSON.stringify(
                advice
              ),
          });

        const output =
          await generateNextStepGuidance(
            context
          );

        expect(
          generateWithConfiguredLlm
        ).toHaveBeenCalledTimes(
          2
        );

        expect(
          vi.mocked(
            generateWithConfiguredLlm
          ).mock.calls[1][0].prompt
        ).toContain(
          "objective must be a non-empty string"
        );

        expect(
          output
        ).toContain(
          "Product Safety"
        );
      }
    );

    it(
      "reports both validation failures when repair also fails",
      async () => {
        vi.mocked(
          generateWithConfiguredLlm
        )
          .mockResolvedValueOnce({
            response:
              '{"recommendations":[]}',
          })
          .mockResolvedValueOnce({
            response:
              "not json",
          });

        await expect(
          generateNextStepGuidance(
            context
          )
        ).rejects.toThrow(
          "after one automatic repair attempt"
        );
      }
    );
  }
);

describe("operator context in the next-step prompt", () => {
  const context = {
    enterpriseName: "t & s heating ltd",
    mission: "Repairs and services boilers for domestic customers in the county.",
    existingBusinessFunctions: [],
  };

  it("sends what the operator actually said, not only the mission", () => {
    const prompt = buildNextStepAdvicePrompt({
      ...context,
      operatorContext:
        "the problem is invoices. jobs get done and then sit there for weeks before anyone bills them",
    });

    expect(prompt).toContain("in their own words");
    expect(prompt).toContain("sit there for weeks before anyone bills them");
  });

  it("says so plainly when the operator said nothing", () => {
    expect(buildNextStepAdvicePrompt(context)).toContain("(nothing recorded)");
  });
});

describe("recommendation reasons", () => {
  const unexplained = [
    { name: "Invoice Management", objective: "Bill every completed job.", reason: DEFAULT_RECOMMENDATION_REASON },
    { name: "Quality Control", objective: "Keep repairs to standard.", reason: "Already explained." },
  ];

  it("asks only about the Functions it failed to explain", () => {
    const prompt = buildRecommendationReasonPrompt(
      { enterpriseName: "t & s heating ltd", mission: "Repair boilers.", existingBusinessFunctions: [] },
      [unexplained[0]]
    );

    expect(prompt).toContain("This is your only task");
    expect(prompt).toContain("Invoice Management");
    expect(prompt).not.toContain("Quality Control");
  });

  it("fills in a missing reason and leaves the rest alone", () => {
    const merged = mergeRecommendationReasons(
      unexplained,
      JSON.stringify({
        recommendations: [
          { name: "Invoice Management", reason: "Jobs sit unbilled for weeks." },
        ],
      })
    );

    expect(merged[0].reason).toBe("Jobs sit unbilled for weeks.");
    expect(merged[1].reason).toBe("Already explained.");
  });

  it("never lets a second call change what is being recommended", () => {
    const merged = mergeRecommendationReasons(
      unexplained,
      JSON.stringify({
        recommendations: [
          { name: "Something Else Entirely", reason: "Not asked for." },
        ],
      })
    );

    expect(merged.map((item) => item.name)).toEqual([
      "Invoice Management",
      "Quality Control",
    ]);
    expect(merged[0].reason).toBe(DEFAULT_RECOMMENDATION_REASON);
  });

  it("keeps the honest placeholder when the follow-up is unusable", () => {
    expect(
      mergeRecommendationReasons(unexplained, "not json at all")[0].reason
    ).toBe(DEFAULT_RECOMMENDATION_REASON);
  });
});

describe("parseRecommendationExampleTasks", () => {
  it("keeps up to three non-empty strings and trims them", () => {
    expect(
      parseRecommendationExampleTasks(["  Write a note ", "", "Draft a plan", "Third", "Fourth"])
    ).toEqual(["Write a note", "Draft a plan", "Third"]);
  });

  it("returns none for a missing or malformed value rather than throwing", () => {
    expect(parseRecommendationExampleTasks(undefined)).toEqual([]);
    expect(parseRecommendationExampleTasks("not an array")).toEqual([]);
    expect(parseRecommendationExampleTasks([1, 2])).toEqual([]);
  });

  it("reads example tasks off a recommendation, tolerating snake_case", () => {
    const rec = parseBusinessFunctionRecommendation(
      { name: "Client Onboarding", objective: "Welcome clients.", example_tasks: ["Write a welcome note"] },
      0
    );
    expect(rec.exampleTasks).toEqual(["Write a welcome note"]);
  });

  it("defaults example tasks to none when the model omits them", () => {
    const rec = parseBusinessFunctionRecommendation(
      { name: "Client Onboarding", objective: "Welcome clients." },
      0
    );
    expect(rec.exampleTasks).toEqual([]);
  });
});

describe("normaliseRecommendedFunctionName", () => {
  it.each([
    ["Parent Communication Manager", "Parent Communication"],
    ["Safeguarding Compliance Specialist", "Safeguarding Compliance"],
    ["Activity Planning Coordinator", "Activity Planning"],
    ["Membership Database Administrator", "Membership Database"],
    ["Safeguarding Lead", "Safeguarding"],
  ])("names the responsibility, not the post: %s", (given, expected) => {
    expect(normaliseRecommendedFunctionName(given)).toBe(expected);
  });

  it.each([
    ["Invoice Management Function", "Invoice Management"],
    ["Boiler Inventory Management Function", "Boiler Inventory Management"],
  ])("drops Arturo's own word for the thing: %s", (given, expected) => {
    expect(normaliseRecommendedFunctionName(given)).toBe(expected);
  });

  it("drops a job title behind the word Function too", () => {
    expect(
      normaliseRecommendedFunctionName("Parent Communication Manager Function")
    ).toBe("Parent Communication");
  });

  it.each([
    "Customer Support",
    "Product Safety",
    "Safeguarding",
    "Invoicing",
  ])("leaves a well-formed name alone: %s", (name) => {
    expect(normaliseRecommendedFunctionName(name)).toBe(name);
  });

  it.each(["Manager", "Function"])(
    "keeps %s rather than stripping it to nothing",
    (name) => {
      expect(normaliseRecommendedFunctionName(name)).toBe(name);
    }
  );

  it("applies when the recommendation is parsed", () => {
    expect(
      parseNextStepAdvice(
        JSON.stringify({
          ...advice,
          recommendations: [
            {
              name: "Parent Communication Manager",
              objective: "Handle parent email in good time.",
              reason: "Evenings are lost to it.",
            },
          ],
        })
      ).recommendations[0].name
    ).toBe("Parent Communication");
  });
});

describe("isEchoedSummary", () => {
  it.each([
    "Arturo's understanding of Bright Sparks After School Club.",
    "Arturo's understanding of the Enterprise.",
    "Brief explanation of Arturo's understanding of the Enterprise.",
    "Bright Sparks After School Club",
    "   ",
  ])("treats %p as saying nothing", (summary) => {
    expect(isEchoedSummary(summary, "Bright Sparks After School Club")).toBe(true);
  });

  it.each([
    "Bright Sparks runs after-school care for children aged 5 to 11 in one town.",
    "A two-van heating firm whose billing lags weeks behind the work.",
  ])("keeps a summary that actually says something: %p", (summary) => {
    expect(isEchoedSummary(summary, "Bright Sparks After School Club")).toBe(false);
  });

  it("omits the section rather than printing a tautology", () => {
    const guidance = formatNextStepAdvice(
      { enterpriseName: "Bright Sparks", mission: "Care for children.", existingBusinessFunctions: [] },
      { ...advice, summary: "Arturo's understanding of Bright Sparks." }
    );

    expect(guidance).not.toContain("Arturo's understanding");
    expect(guidance).toContain("Recommended Functions");
  });

  it("keeps the section when the summary is real", () => {
    const guidance = formatNextStepAdvice(
      { enterpriseName: "Bright Sparks", mission: "Care for children.", existingBusinessFunctions: [] },
      { ...advice, summary: "Bright Sparks runs after-school care for 40 children a week." }
    );

    expect(guidance).toContain("Arturo's understanding");
    expect(guidance).toContain("40 children a week");
  });
});
