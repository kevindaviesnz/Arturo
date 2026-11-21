import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Neutralises the launch environment. See the file for why.
    setupFiles: ["./vitest.setup.ts"],
    // Both of these were only ever passed by `npm run test:run`, so running a
    // couple of files directly with `npx vitest` got the unsafe defaults.
    // The suite shares SQLite and file-backed state, so files cannot run in
    // parallel, and better-sqlite3's native binding segfaults the process when
    // loaded into vitest's default worker threads.
    fileParallelism: false,
    pool: "forks",
  },
});
