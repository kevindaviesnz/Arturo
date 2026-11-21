import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  getApprovalSigningSecret,
  getLocalApprovalSigningSecret,
  getRequiredRuntimeSecret,
  isUsableRuntimeSecret,
  requireNetworkedApprovalSigningSecret,
  resetNetworkedRuntimeModeForTests,
  setNetworkedRuntimeMode,
} from "./runtimeSecrets";

const FILE_APPROVAL_SIGNING_SECRET =
  "file-approval-secret-00000000000000";

const INLINE_APPROVAL_SIGNING_SECRET =
  "inline-approval-secret-000000000000";

const temporaryDirectories: string[] = [];

function createTemporaryDirectory(): string {
  const directory =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        "arturo-runtime-secret-test-"
      )
    );

  temporaryDirectories.push(
    directory
  );

  return directory;
}

function createSecretFile(
  value: string = FILE_APPROVAL_SIGNING_SECRET,
  mode = 0o600,
  directory: string = createTemporaryDirectory()
): string {
  const filePath =
    path.join(
      directory,
      "approval-signing-secret"
    );

  fs.writeFileSync(
    filePath,
    `${value}\n`,
    {
      encoding: "utf8",
      mode,
    }
  );

  fs.chmodSync(
    filePath,
    mode
  );

  return filePath;
}

describe("runtimeSecrets", () => {
  afterEach(() => {
    // Reset the process-global networked latch so ordering can't leak between tests.
    resetNetworkedRuntimeModeForTests();

    while (temporaryDirectories.length > 0) {
      const directory =
        temporaryDirectories.pop();

      if (directory) {
        fs.rmSync(
          directory,
          {
            recursive: true,
            force: true,
          }
        );
      }
    }
  });

  it("accepts non-empty non-placeholder secrets", () => {
    expect(
      isUsableRuntimeSecret("real-secret-000000000000000000000")
    ).toBe(true);
  });

  it("rejects missing, empty, and placeholder secrets", () => {
    expect(
      isUsableRuntimeSecret(undefined)
    ).toBe(false);

    expect(
      isUsableRuntimeSecret("")
    ).toBe(false);

    expect(
      isUsableRuntimeSecret("   ")
    ).toBe(false);

    expect(
      isUsableRuntimeSecret("change-me")
    ).toBe(false);
    expect(isUsableRuntimeSecret("replace-with-random-secret")).toBe(false);
    expect(isUsableRuntimeSecret("short-secret")).toBe(false);
  });

  it("returns a required runtime secret when present", () => {
    expect(
      getRequiredRuntimeSecret(
        {
          TEST_SECRET: "real-secret-000000000000000000000",
        },
        "TEST_SECRET"
      )
    ).toBe("real-secret-000000000000000000000");
  });

  it("throws when a required runtime secret is missing or placeholder", () => {
    expect(() =>
      getRequiredRuntimeSecret(
        {},
        "TEST_SECRET"
      )
    ).toThrow(
      "TEST_SECRET is required, must contain at least 32 characters, and must not be a placeholder"
    );

    expect(() =>
      getRequiredRuntimeSecret(
        {
          TEST_SECRET: "change-me",
        },
        "TEST_SECRET"
      )
    ).toThrow(
      "TEST_SECRET is required, must contain at least 32 characters, and must not be a placeholder"
    );
  });

  it("reads approval signing secret", () => {
    expect(
      getApprovalSigningSecret({
        APPROVAL_SIGNING_SECRET: "approval-secret-00000000000000000",
      })
    ).toBe("approval-secret-00000000000000000");
  });

  it("reads approval signing secret from a private external file", () => {
    const filePath =
      createSecretFile();

    expect(
      getApprovalSigningSecret({
        APPROVAL_SIGNING_SECRET_FILE: filePath,
      })
    ).toBe(
      FILE_APPROVAL_SIGNING_SECRET
    );
  });

  it("uses an inline approval signing secret before an external file", () => {
    const filePath =
      createSecretFile();

    expect(
      getApprovalSigningSecret({
        APPROVAL_SIGNING_SECRET:
          INLINE_APPROVAL_SIGNING_SECRET,
        APPROVAL_SIGNING_SECRET_FILE:
          filePath,
      })
    ).toBe(
      INLINE_APPROVAL_SIGNING_SECRET
    );
  });

  it("rejects a relative approval signing secret file path", () => {
    expect(() =>
      getApprovalSigningSecret({
        APPROVAL_SIGNING_SECRET_FILE:
          "approval-signing-secret",
      })
    ).toThrow(
      "APPROVAL_SIGNING_SECRET_FILE must be an absolute path"
    );
  });

  it("rejects an approval signing secret file under the runtime data directory", () => {
    const dataDirectory =
      createTemporaryDirectory();

    const filePath =
      createSecretFile(
        FILE_APPROVAL_SIGNING_SECRET,
        0o600,
        dataDirectory
      );

    expect(() =>
      getApprovalSigningSecret({
        ARTURO_DATA_DIRECTORY:
          dataDirectory,
        APPROVAL_SIGNING_SECRET_FILE:
          filePath,
      })
    ).toThrow(
      "APPROVAL_SIGNING_SECRET_FILE must be outside ARTURO_DATA_DIRECTORY"
    );
  });

  it("rejects weak approval signing secret file contents", () => {
    const filePath =
      createSecretFile(
        "short-secret",
        0o600
      );

    expect(() =>
      getApprovalSigningSecret({
        APPROVAL_SIGNING_SECRET_FILE:
          filePath,
      })
    ).toThrow(
      "APPROVAL_SIGNING_SECRET_FILE must contain at least 32 characters and must not be a placeholder"
    );
  });

  it("rejects shared approval signing secret file permissions", () => {
    if (process.platform === "win32") {
      return;
    }

    const filePath =
      createSecretFile(
        FILE_APPROVAL_SIGNING_SECRET,
        0o644
      );

    expect(() =>
      getApprovalSigningSecret({
        APPROVAL_SIGNING_SECRET_FILE:
          filePath,
      })
    ).toThrow(
      /APPROVAL_SIGNING_SECRET_FILE must not be readable/
    );
  });

  it("replaces a local placeholder with a generated usable secret", () => {
    expect(
      isUsableRuntimeSecret(
        getLocalApprovalSigningSecret({
          APPROVAL_SIGNING_SECRET: "change-me",
        })
      )
    ).toBe(true);
  });

  it("refuses to auto-provision an approval secret in networked mode", () => {
    setNetworkedRuntimeMode(true);
    expect(() =>
      getLocalApprovalSigningSecret({
        APPROVAL_SIGNING_SECRET: "change-me",
      })
    ).toThrow(
      /APPROVAL_SIGNING_SECRET or APPROVAL_SIGNING_SECRET_FILE is required when a networked server is running/
    );
  });

  it("still returns a configured secret in networked mode", () => {
    setNetworkedRuntimeMode(true);
    expect(
      getLocalApprovalSigningSecret({
        APPROVAL_SIGNING_SECRET: "approval-secret-00000000000000000",
      })
    ).toBe("approval-secret-00000000000000000");
  });

  it("accepts an external approval signing secret file in networked mode", () => {
    setNetworkedRuntimeMode(true);

    const filePath =
      createSecretFile();

    expect(
      getLocalApprovalSigningSecret({
        APPROVAL_SIGNING_SECRET_FILE:
          filePath,
      })
    ).toBe(
      FILE_APPROVAL_SIGNING_SECRET
    );
  });

  it("requireNetworkedApprovalSigningSecret validates and flips to fail-closed", () => {
    expect(() =>
      requireNetworkedApprovalSigningSecret({})
    ).toThrow(
      "APPROVAL_SIGNING_SECRET or APPROVAL_SIGNING_SECRET_FILE is required, must contain at least 32 characters, and must not be a placeholder"
    );
  });
});
