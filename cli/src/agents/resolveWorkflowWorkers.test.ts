import {
  describe,
  expect,
  it,
} from "vitest";

import {
  resolveWorkflowWorkers,
  findHumanOperatorWorker,
  findWorkerForStep,
} from "./resolveWorkflowWorkers";

describe(
  "resolveWorkflowWorkers",
  () => {

    it("prefers a user-created human operator over the default operator", () => {
  const worker =
    findHumanOperatorWorker([
      {
        name: "operator",
        kind: "human",
        archetype: "operator",
        run: function* () {
          return {};
        },
      },
      {
        name: "Founder",
        kind: "human",
        archetype: "operator",
        run: function* () {
          return {};
        },
      },
    ]);

  expect(worker?.name).toBe("Founder");
    });
    
    it("falls back to the default operator when it is the only operator", () => {
  const worker =
    findHumanOperatorWorker([
      {
        name: "operator",
        kind: "human",
        archetype: "operator",
        run: function* () {
          return {};
        },
      },
    ]);

  expect(worker?.name).toBe("operator");
    });
    

    it(
      "resolves archetypes to workers",
      () => {
        const result =
          resolveWorkflowWorkers(
            {
              objective:
                "Create report",
              steps: [
                {
                  archetype:
                    "researcher",
                  instruction:
                    "Research topic",
                },
                {
                  archetype:
                    "creator",
                  instruction:
                    "Create report",
                },
              ],
            },
            [
              {
                name:
                  "Albert Einstein",
                archetype:
                  "researcher",
              } as any,
              {
                name:
                  "Isaac Asimov",
                archetype:
                  "creator",
              } as any,
            ]
          );

        expect(
          result.steps[0]
            .workerName
        ).toBe(
          "Albert Einstein"
        );

        expect(
          result.steps[1]
            .workerName
        ).toBe(
          "Isaac Asimov"
        );
      }
    );
  }

  
);
it("does not assign new workflow steps to busy or offline Workers", () => {
 const run=function* () { return {}; };
 expect(findWorkerForStep({archetype:"researcher",instruction:"Use Busy Researcher"},[
  {name:"Busy Researcher",kind:"ai",archetype:"researcher",availability:"busy",run},
  {name:"Ready Researcher",kind:"ai",archetype:"researcher",availability:"available",run},
 ])?.name).toBe("Ready Researcher");
 expect(findHumanOperatorWorker([{name:"Offline",kind:"human",archetype:"operator",availability:"offline",run}])).toBeUndefined();
});
