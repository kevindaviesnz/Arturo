import { createKernelState, KernelState } from "./state";
import { tick } from "./scheduler";

export type KernelEventLog = Array<{
  type: "spawn" | "tick" | "effect" | "transition";
  pid?: number;
  name?: string;
  from?: string;
  to?: string;
  effect?: unknown;
}>;

export function replay(events: KernelEventLog): KernelState {
  let state = createKernelState();

  console.log("🔁 REPLAY START");

  for (const event of events) {
    switch (event.type) {
      case "spawn":
        console.log(`spawn pid=${event.pid} ${event.name}`);
        break;

      case "tick":
        state = tick(state);
        break;

      case "effect":
        console.log(`effect pid=${event.pid}`, event.effect);
        break;

      case "transition":
        console.log(
          `transition pid=${event.pid} ${event.from} → ${event.to}`
        );
        break;
    }
  }

  console.log("🔁 REPLAY END");
  return state;
}