import {
  Kernel,
} from "../kernel/kernel";

/**
 * Handles the /kernel-save command.
 *
 * @param kernel Runtime kernel instance.
 * @returns void
 *
 * SIDE EFFECT:
 * - Saves kernel snapshot through kernel syscall.
 * - Writes CLI output.
 */
export function handleKernelSaveCommand(
  kernel: Kernel
): void {
  const snapshot =
    kernel.syscall({
      type: "save-snapshot",
    });

  console.log(
    `kernel snapshot saved: processes=${Object.keys(snapshot.processes).length} pendingCalls=${Object.keys(snapshot.pendingCalls).length}`
  );
}

/**
 * Handles the /kernel-load command.
 *
 * @param kernel Runtime kernel instance.
 * @returns void
 *
 * SIDE EFFECT:
 * - Loads kernel snapshot through kernel syscall.
 * - Writes CLI output.
 */
export function handleKernelLoadCommand(
  kernel: Kernel
): void {
  const snapshot =
    kernel.syscall({
      type: "load-snapshot",
    });

  if (!snapshot) {
    console.log(
      "(no kernel snapshot found)"
    );

    return;
  }

  console.log(
    `kernel snapshot loaded: processes=${Object.keys(snapshot.processes).length} pendingCalls=${Object.keys(snapshot.pendingCalls).length}`
  );
}

/**
 * Handles the /kernel-clear-snapshot command.
 *
 * @param kernel Runtime kernel instance.
 * @returns void
 *
 * SIDE EFFECT:
 * - Clears kernel snapshot through kernel syscall.
 * - Writes CLI output.
 */
export function handleKernelClearSnapshotCommand(
  kernel: Kernel
): void {
  kernel.syscall({
    type: "clear-snapshot",
  });

  console.log(
    "kernel snapshot cleared"
  );
}

/**
 * Handles the /kernel-snapshot-status command.
 *
 * @param kernel Runtime kernel instance.
 * @returns void
 *
 * SIDE EFFECT:
 * - Loads kernel snapshot through kernel syscall.
 * - Writes CLI output.
 */
export function handleKernelSnapshotStatusCommand(
  kernel: Kernel
): void {
  const snapshot =
    kernel.syscall({
      type: "load-snapshot",
    });

  if (!snapshot) {
    console.log(
      "(no kernel snapshot found)"
    );

    return;
  }

  console.log(
    `snapshot version=${snapshot.version}`
  );

  console.log(
    `createdAt=${snapshot.createdAt}`
  );

  console.log(
    `processes=${Object.keys(snapshot.processes).length}`
  );

  console.log(
    `pendingCalls=${Object.keys(snapshot.pendingCalls).length}`
  );

  console.log(
    `results=${Object.keys(snapshot.results).length}`
  );
}