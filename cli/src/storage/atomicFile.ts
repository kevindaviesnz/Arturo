import fs from "node:fs";
import path from "node:path";

/**
 * Writes a UTF-8 file by atomically replacing its final pathname.
 * Temporary and final files are restricted to the current user.
 */
export function writePrivateFileAtomic(
  filePath: string,
  value: string
): void {
  const directory = path.dirname(filePath);
  const temporaryPath =
    `${filePath}.${process.pid}.${Date.now()}.tmp`;

  fs.mkdirSync(directory, {
    recursive: true,
    mode: 0o700,
  });

  try {
    fs.writeFileSync(
      temporaryPath,
      value,
      {
        encoding: "utf8",
        mode: 0o600,
        flag: "wx",
      }
    );
    fs.renameSync(
      temporaryPath,
      filePath
    );
    fs.chmodSync(filePath, 0o600);
  } finally {
    if (fs.existsSync(temporaryPath)) {
      fs.unlinkSync(temporaryPath);
    }
  }
}
