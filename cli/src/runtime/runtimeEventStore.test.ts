import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  appendRuntimeEventToStore,
  clearRuntimeEventStore,
  getRuntimeEventStore,
  listRuntimeEventStore,
} from "./runtimeEventStore";

/**
 * Creates test runtime event input.
 *
 * @param id Runtime event id.
 * @returns Runtime event input.
 *
 * PURE: No side effects.
 */
function createEventInput(
  id: string
) {
  return {
    id,
    type: "job.created",
    level: "info" as const,
    message: "Job created",
    timestamp: 1000,
  };
}

beforeEach(() => {
  clearRuntimeEventStore();
});

describe("runtimeEventStore", () => {
  it("appends runtime event to store", () => {
    const event =
      appendRuntimeEventToStore(
        createEventInput(
          "event-1"
        )
      );

    expect(event).toMatchObject({
      id: "event-1",
      sequence: 1,
    });

    expect(
      listRuntimeEventStore()
    ).toHaveLength(1);
  });

  it("assigns sequential event numbers", () => {
    appendRuntimeEventToStore(
      createEventInput(
        "event-1"
      )
    );

    appendRuntimeEventToStore(
      createEventInput(
        "event-2"
      )
    );

    expect(
      listRuntimeEventStore().map(
        (event) => event.sequence
      )
    ).toEqual([
      1,
      2,
    ]);
  });

  it("returns immutable event store copy", () => {
    appendRuntimeEventToStore(
      createEventInput(
        "event-1"
      )
    );

    const store =
      getRuntimeEventStore();

    store.events.push({
      sequence: 99,
      id: "mutated",
      type: "mutation",
      level: "warn",
      message: "Mutated",
      timestamp: 99,
    });

    expect(
      listRuntimeEventStore()
    ).toHaveLength(1);
  });

  it("clears runtime event store", () => {
    appendRuntimeEventToStore(
      createEventInput(
        "event-1"
      )
    );

    clearRuntimeEventStore();

    expect(
      listRuntimeEventStore()
    ).toEqual([]);

    expect(
      getRuntimeEventStore()
    ).toEqual({
      nextSequence: 1,
      events: [],
    });
  });
});