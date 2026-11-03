#!/usr/bin/env bash
set -euo pipefail
# Exercise the actual shell entrypoints; no database or network is used.
supabase() { printf '%s\n' 'DB_URL="postgresql://fixture:fixture@remote.invalid:5432/postgres"'; }
psql() { echo 'UNSAFE_PSQL_WAS_CALLED'; return 99; }
export -f supabase psql
for harness in .github/pvp-schema-test/concurrency.sh .github/pvp-schema-test/admission-race.sh; do
  set +e
  output="$(bash "$harness" 2>&1)"
  code=$?
  set -e
  [[ "$code" != 0 && "$output" != *UNSAFE_PSQL_WAS_CALLED* && "$output" == *'disposable local Supabase DB_URL'* ]]
  echo "PASS: $harness rejects a remote URL before psql"
done
set +e
output="$(GITHUB_ACTIONS=false bash .github/ci/backend.sh prepare pvp 2>&1)"
code=$?
set -e
[[ "$code" != 0 && "$output" == *'only runs on disposable GitHub Actions runners'* ]]
echo 'PASS: backend provisioning rejects a non-CI invocation before filesystem changes'
set +e
output="$(GITHUB_ACTIONS=true RUNNER_TEMP=/unused-test-root GITHUB_WORKSPACE=/unused-workspace SUPABASE_ACCESS_TOKEN=fixture-only bash .github/ci/backend.sh prepare pvp 2>&1)"
code=$?
set -e
[[ "$code" != 0 && "$output" == *'Hosted-project credentials are forbidden'* ]]
echo 'PASS: backend provisioning rejects hosted-project credentials before filesystem changes'
