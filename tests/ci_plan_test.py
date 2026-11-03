"""Tests CI staging/configuration only. Does not start Postgres or execute SQL."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[1]
SCOPES = json.loads((ROOT / '.github/ci/migration-scopes.json').read_text())
PYTHON_BLOCKS = re.findall(r"<<'PY'\n(.*?)\nPY", (ROOT / '.github/ci/backend.sh').read_text(), re.S)


class CiPlanTests(unittest.TestCase):
    def workspace(self):
        directory = ROOT / '.runtime/ci-plan-tests' / str(uuid.uuid4())
        (directory / 'supabase/migrations').mkdir(parents=True)
        (directory / 'supabase/tests/database').mkdir(parents=True)
        return directory  # Retain ignored fixtures; never delete repository/user data.

    def execute(self, block, scope, directory):
        return subprocess.run([sys.executable, '-B', '-c', block, scope], cwd=directory,
                              env={**os.environ, 'GITHUB_WORKSPACE': str(ROOT)},
                              text=True, capture_output=True, check=False)

    def test_scopes_only_reference_original_sql_and_external_fixtures(self):
        for scope in SCOPES.values():
            self.assertTrue((ROOT / scope['fixture']).is_file())
            self.assertTrue(scope['fixture'].startswith('.github/'))
            self.assertEqual(scope['migrations'], sorted(set(scope['migrations'])))
            for name in scope['migrations']:
                self.assertTrue((ROOT / 'supabase/migrations' / name).is_file(), name)

    def test_all_existing_pgtap_suites_have_one_scoped_runner(self):
        selected = [name for scope in SCOPES.values() for name in scope['tests']]
        actual = [file.name for file in (ROOT / 'supabase/tests/database').glob('*.sql')]
        self.assertCountEqual(selected, actual)
        self.assertEqual(len(selected), len(set(selected)))

    def test_known_historical_aliases_stay_excluded(self):
        inventory = json.loads((ROOT / 'docs/migration-inventory.json').read_text())
        for row in inventory['excluded_history']:
            if row['reason'].startswith('byte-identical duplicate'):
                self.assertFalse((ROOT / row['path']).exists(), row['path'])
                version = row['reason'].split()[-1]
                kept = next(item for item in inventory['migrations'] if item['version'] == version)
                self.assertEqual(row['blob'], kept['git_blob_sha1'])

    def test_config_targets_postgres17_and_preserves_auth_settings(self):
        directory = self.workspace()
        config = directory / 'supabase/config.toml'
        config.write_text('project_id = "initial"\n[db]\nmajor_version = 15\n[auth]\nenabled = true\n')
        result = self.execute(PYTHON_BLOCKS[0], 'invitation', directory)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('major_version = 17', config.read_text())
        self.assertIn('project_id = "site_invitation_ci"', config.read_text())
        self.assertIn('[auth]\nenabled = true', config.read_text())
        self.assertEqual((directory / '.ci-disposable').read_text(), 'invitation')

    def test_ambiguous_config_fails_before_writing(self):
        directory = self.workspace()
        config = directory / 'supabase/config.toml'
        original = 'project_id = "initial"\nmajor_version = 15\nmajor_version = 16\n'
        config.write_text(original)
        result = self.execute(PYTHON_BLOCKS[0], 'pvp', directory)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(config.read_text(), original)
        self.assertFalse((directory / '.ci-disposable').exists())

    def test_invitation_staging_does_not_invent_a_fixture_migration_version(self):
        directory = self.workspace()
        result = self.execute(PYTHON_BLOCKS[1], 'invitation', directory)
        self.assertEqual(result.returncode, 0, result.stderr)
        actual = sorted(file.name for file in (directory / 'supabase/migrations').iterdir())
        self.assertEqual(actual, SCOPES['invitation']['migrations'])
        for name in actual:
            self.assertEqual((directory / 'supabase/migrations' / name).read_bytes(),
                             (ROOT / 'supabase/migrations' / name).read_bytes())

    def test_full_staging_copies_originals_without_constructing_a_baseline(self):
        directory = self.workspace()
        result = self.execute(PYTHON_BLOCKS[1], 'full', directory)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertCountEqual([p.name for p in (directory / 'supabase/migrations').iterdir()],
                              [p.name for p in (ROOT / 'supabase/migrations').glob('*.sql')])


if __name__ == '__main__':
    unittest.main(verbosity=2)
