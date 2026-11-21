import { startRepl } from "./commands";
import { Kernel } from "../kernel/kernel";

export function bootRepl(kernel: Kernel) {
  startRepl(kernel);
}