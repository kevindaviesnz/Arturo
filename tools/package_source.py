#!/usr/bin/env python3
"""Export an allowlisted source archive from a committed Git revision."""
import argparse
import gzip
import io
from pathlib import Path, PurePosixPath
import subprocess
import tarfile

ROOT_FILES = {"README.md", "ARCHITECTURE.md", "CONTRIBUTING.md", "LICENSE", "SECURITY.md", "THREAT_MODEL.md", "ROADMAP.md"}
CLI_FILES = {"package.json", "package-lock.json", "tsconfig.json", "vitest.config.ts", "vitest.setup.ts", "office.playwright.config.ts", "README.md", "LICENSE", "ABILITIES.md", ".env.example"}
BLOCKED_PARTS = {".git", ".data", "node_modules", "dist", "coverage", ".nyc_output", "test-results", "playwright-report", "office-backups", "unused", "legacy", "__pycache__"}
BLOCKED_SUFFIXES = (".db", ".db-wal", ".db-shm", ".sqlite", ".sqlite3", ".jsonl", ".log", ".pem", ".key", ".p12", ".pfx", ".access", ".zip", ".tar", ".gz")


def allowed(name):
    p = PurePosixPath(name)
    if p.is_absolute() or ".." in p.parts or not p.parts:
        return False
    if any(part.lower() in BLOCKED_PARTS for part in p.parts):
        return False
    base = p.name.lower()
    if any(part.lower().startswith('.env') for part in p.parts) and name != 'cli/.env.example':
        return False
    if base.endswith(BLOCKED_SUFFIXES) or 'signing-secret' in base or base in {'.ds_store', 'id_rsa', 'id_ed25519'}:
        return False
    if name in ROOT_FILES or (len(p.parts) == 2 and p.parts[0] == 'cli' and p.name in CLI_FILES):
        return True
    if p.parts[:2] in [('cli', 'src'), ('cli', 'scripts'), ('cli', 'office-tests')]:
        return p.suffix in {'.ts', '.js', '.cjs', '.mjs', '.html', '.css', '.webmanifest'}
    if p.parts[:3] == ('cli', 'scenario_harness', 'plans'):
        return p.suffix == '.plan'
    if p.parts[:3] == ('cli', 'scenario_harness', 'assets'):
        return p.suffix == '.txt'
    if len(p.parts) == 3 and p.parts[:2] == ('cli', 'scenario_harness'):
        return p.suffix in {'.sh', '.exp', '.md'}
    if p.parts[:2] == ('cli', 'docs') or p.parts[0] in {'docs', 'legal'}:
        return p.suffix == '.md'
    if p.parts[0] == 'tools':
        return p.name in {'package_source.py', 'test_package_source.py'}
    return False


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args])


def package(root, destination, revision='HEAD'):
    commit = git(root, 'rev-parse', '--verify', revision + '^{commit}').decode().strip()
    entries = []
    for record in git(root, 'ls-tree', '-rz', '--full-tree', commit).split(b'\0'):
        if not record:
            continue
        metadata, raw_name = record.split(b'\t', 1)
        mode, kind, oid = metadata.decode().split()
        name = raw_name.decode('utf-8')
        if allowed(name):
            if mode not in {'100644', '100755'} or kind != 'blob':
                raise ValueError('Refusing non-regular source entry: ' + name)
            entries.append((name, mode, oid))
    required = {'cli/package.json', 'cli/package-lock.json', 'cli/tsconfig.json', 'cli/src/cli.ts'}
    if not required.issubset({name for name, _, _ in entries}):
        raise ValueError('Revision is missing required Arturo source files')
    # Read committed blobs only. A local .env, modified tracked file or symlink
    # cannot redirect this export to machine-local state.
    output = io.BytesIO()
    with gzip.GzipFile(fileobj=output, mode='wb', mtime=0, filename='') as compressed:
        with tarfile.open(fileobj=compressed, mode='w') as archive:
            for name, mode, oid in sorted(entries):
                data = git(root, 'cat-file', 'blob', oid)
                info = tarfile.TarInfo('Arturo/' + name)
                info.size, info.mode = len(data), int(mode[-3:], 8)
                archive.addfile(info, io.BytesIO(data))
            data = (commit + '\n').encode()
            info = tarfile.TarInfo('Arturo/SOURCE_COMMIT')
            info.size, info.mode = len(data), 0o644
            archive.addfile(info, io.BytesIO(data))
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation prevents accidentally overwriting an existing release.
    with destination.open('xb') as target:
        target.write(output.getvalue())
    return commit, len(entries)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--revision', default='HEAD')
    args = parser.parse_args()
    commit, count = package(Path(__file__).resolve().parents[1], args.output, args.revision)
    print(f'Packaged {count} committed source files from {commit} into {args.output}')
