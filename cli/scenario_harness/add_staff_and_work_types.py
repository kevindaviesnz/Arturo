#!/usr/bin/env python3
"""Add the staff-step pause and work-type answers to scenario harness plans.

The new /enterprise route is /setup: name, mission, then who. These plans still
create Functions and staff themselves, so after the mission is saved the script
answers q to leave setup. Bare /task now asks for a work type and a go-ahead
after the evidence question; the script adds those two replies.

A person should check the diff before a harness run. This script is idempotent.
"""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent / "plans"

ENTERPRISE_RE = re.compile(
    r"^(/enterprise)\n"
    r"1\n"
    r"([^\n]+)\n"
    r"([^\n]+)\n"
    r"(?:skip\n|@blank\n)?",
    re.MULTILINE,
)

def rewrite_enterprise(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        return f"{match.group(1)}\n{match.group(2)}\n{match.group(3)}\nq\n"
    return ENTERPRISE_RE.sub(repl, text)

def append_work_type(block_lines: list[str]) -> list[str]:
    # Already updated
    if block_lines[-2:] == ["1", "1"] and "work type" in "\n".join(block_lines).lower():
        return block_lines
    # A marker comment plus two replies, if not already present after a marker
    if block_lines[-3:] == ["@note Work type, then go-ahead.", "1", "1"]:
        return block_lines
    # Standard create: /task, 1, description, then one or more numeric replies
    if len(block_lines) >= 4 and block_lines[0] == "/task" and block_lines[1] == "1":
        # If we already appended a go-ahead on a previous run (marker)
        if "@note Work type, then go-ahead." in block_lines:
            return block_lines
        return block_lines + ["@note Work type, then go-ahead.", "1", "1"]
    return block_lines

def rewrite_tasks(text: str) -> str:
    lines = text.splitlines()
    out: list[str] = []
    i = 0
    while i < len(lines):
        if lines[i].strip() == "/task":
            block = [lines[i]]
            i += 1
            while i < len(lines) and not (lines[i].startswith("/") or lines[i].startswith("@")):
                block.append(lines[i])
                i += 1
            # include an existing note we may have added
            if i < len(lines) and lines[i].startswith("@note Work type"):
                block.append(lines[i])
                i += 1
                while i < len(lines) and lines[i] in {"1", "2"}:
                    block.append(lines[i])
                    i += 1
            out.extend(append_work_type(block))
            continue
        out.append(lines[i])
        i += 1
    return "\n".join(out) + ("\n" if text.endswith("\n") else "")

def main() -> None:
    changed = 0
    for path in sorted(ROOT.glob("*.plan")):
        original = path.read_text()
        updated = rewrite_tasks(rewrite_enterprise(original))
        if updated != original:
            path.write_text(updated)
            changed += 1
            print(f"updated {path.name}")
    print(f"{changed} plans updated")

if __name__ == "__main__":
    main()
