import importlib.util
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('package_source', Path(__file__).with_name('package_source.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SourcePackageTests(unittest.TestCase):
    def test_exports_committed_source_and_excludes_even_tracked_private_state(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            def git(*args):
                return subprocess.check_output(['git', '-C', directory, *args], stderr=subprocess.DEVNULL)
            git('init')
            safe = ['cli/package.json', 'cli/package-lock.json', 'cli/tsconfig.json', 'cli/src/cli.ts', 'cli/.env.example', 'docs/guide.md', 'cli/scenario_harness/plans/001.plan', 'cli/scenario_harness/assets/bom.txt', 'cli/src/office/public/app.js', 'cli/src/office/public/index.html', 'cli/src/office/public/style.css', 'cli/src/office/public/manifest.webmanifest']
            unsafe = ['cli/.env', 'cli/.env.new', 'cli/src/.env.production', 'cli/.data/state.json', 'cli/src/.data/nested.ts', 'cli/runtime.db', 'cli/events.jsonl', 'cli/approval-signing-secret', 'cli/dist/app.ts', 'cli/node_modules/leak.ts', 'cli/private.key', 'docs/records.log', 'cli/docs/transcript session', 'cli/scenario_harness/transcript.txt', 'cli/scenario_harness/assets/approval-signing-secret.txt']
            for name in safe + unsafe:
                file = root / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text('committed fixture')
            git('add', '.')
            git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture')
            (root / 'cli/src/cli.ts').write_text('UNCOMMITTED')
            (root / 'cli/src/private.ts').write_text('UNTRACKED')
            target = root / 'release.tar.gz'
            module.package(root, target)
            with tarfile.open(target) as archive:
                self.assertEqual(set(archive.getnames()), {'Arturo/' + p for p in safe} | {'Arturo/SOURCE_COMMIT'})
                self.assertEqual(archive.extractfile('Arturo/cli/src/cli.ts').read(), b'committed fixture')
            second = root / 'second.tar.gz'
            module.package(root, second)
            self.assertEqual(target.read_bytes(), second.read_bytes())
            with self.assertRaises(FileExistsError):
                module.package(root, target)
            (root / 'cli/src/linked.ts').symlink_to('/etc/passwd')
            git('add', 'cli/src/linked.ts')
            git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'symlink')
            with self.assertRaisesRegex(ValueError, 'non-regular'):
                module.package(root, root / 'bad.tar.gz')

    def test_rejects_traversal_and_private_paths(self):
        for name in ['../cli/src/leak.ts', '/cli/src/leak.ts', 'cli/src/.env/file.ts', 'cli/src/key.pem', '.git/config']:
            self.assertFalse(module.allowed(name), name)


if __name__ == '__main__':
    unittest.main()
