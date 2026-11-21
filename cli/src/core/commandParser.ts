/**
 * Command Parser v1
 *
 * PURE FUNCTION
 * - No IO
 * - No state
 * - Deterministic
 *
 * Supports:
 * - basic commands (/help, /status)
 * - whitespace normalization
 * - quoted strings
 */

export type ParsedCommand = {
  name: string;
  args: string[];
};

export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();

  if (!trimmed) return null;

  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === " " && !inQuotes) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  if (tokens.length === 0) return null;

  const [name, ...args] = tokens;

  return {
    name,
    args
  };
}