#!/usr/bin/env bash
set -euo pipefail
operation="${1:?prepare or apply}"
scope="${2:?pvp, invitation or full}"
[[ "$scope" == pvp || "$scope" == invitation || "$scope" == full ]]
[[ "${GITHUB_ACTIONS:-}" == true && -n "${RUNNER_TEMP:-}" && -n "${GITHUB_WORKSPACE:-}" ]] || {
  echo 'This harness only runs on disposable GitHub Actions runners' >&2; exit 1;
}
[[ -z "${SUPABASE_ACCESS_TOKEN:-}${SUPABASE_DB_PASSWORD:-}${SUPABASE_PROJECT_ID:-}" ]] || {
  echo 'Hosted-project credentials are forbidden in this harness' >&2; exit 1;
}
harness="$RUNNER_TEMP/site-$scope-supabase"
if [[ "$operation" == prepare ]]; then
  [[ ! -e "$harness" ]] || { echo 'Refusing to reuse an existing database harness' >&2; exit 1; }
  mkdir -p "$harness"
  cd "$harness"
  supabase init
  python3 - "$scope" <<'PY'
import re, sys
from pathlib import Path
config = Path('supabase/config.toml')
text = config.read_text()
text, versions = re.subn(r'(?m)^(\s*major_version\s*=\s*)\d+(\s*)$', r'\g<1>17\g<2>', text)
text, projects = re.subn(r'(?m)^\s*project_id\s*=\s*"[^"]*"\s*$', 'project_id = "site_' + sys.argv[1] + '_ci"', text)
if versions != 1 or projects != 1:
    raise SystemExit('Unexpected Supabase config layout')
config.write_text(text)
Path('.ci-disposable').write_text(sys.argv[1])
PY
  mkdir -p supabase/migrations supabase/tests/database supabase/functions
  if [[ "$scope" == invitation || "$scope" == full ]]; then
    cp -R "$GITHUB_WORKSPACE/supabase/functions/award-coins" supabase/functions/
    cp -R "$GITHUB_WORKSPACE/supabase/functions/_shared" supabase/functions/
  fi
  # Start with no application migrations. Fixtures are SQL prerequisites, never
  # made-up migration versions. The apply operation runs only after stack start.
elif [[ "$operation" == apply ]]; then
  [[ "$(pwd -P)" == "$harness" && "$(cat .ci-disposable)" == "$scope" ]]
  db_url="$(supabase status -o env | sed -nE 's/^DB_URL="?([^" ]+)"?$/\1/p')"
  [[ "$db_url" =~ ^postgres(ql)?://[^/]+@127\.0\.0\.1:[0-9]+/postgres$ ]] || {
    echo 'Refusing a non-loopback database' >&2; exit 1;
  }
  if [[ "$scope" != full ]]; then
    fixture="$(node -e 'console.log(require(process.argv[1])[process.argv[2]].fixture)' "$GITHUB_WORKSPACE/.github/ci/migration-scopes.json" "$scope")"
    psql "$db_url" -X -v ON_ERROR_STOP=1 --single-transaction -f "$GITHUB_WORKSPACE/$fixture"
  fi
  python3 - "$scope" <<'PY'
import json, os, shutil, sys
from pathlib import Path
root = Path(os.environ['GITHUB_WORKSPACE'])
scope = sys.argv[1]
if scope == 'full':
    migrations = sorted((root / 'supabase/migrations').glob('*.sql'))
    tests = sorted((root / 'supabase/tests/database').glob('*.sql'))
else:
    plan = json.loads((root / '.github/ci/migration-scopes.json').read_text())[scope]
    migrations = [root / 'supabase/migrations' / name for name in plan['migrations']]
    tests = [root / 'supabase/tests/database' / name for name in plan['tests']]
for source in migrations:
    shutil.copyfile(source, Path('supabase/migrations') / source.name)
for source in tests:
    shutil.copyfile(source, Path('supabase/tests/database') / source.name)
PY
  supabase migration up --local
else
  echo 'Unknown harness operation' >&2; exit 1
fi
