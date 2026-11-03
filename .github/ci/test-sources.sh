#!/usr/bin/env bash
set -uo pipefail
failed=0
for source in script.js chess-delivery.js scripts/ci/*.cjs .github/ci/*.cjs tests/e2e/*.cjs closed-test/*.cjs; do
  name="syntax-$(basename "$source" .cjs)"
  name="${name//./-}"
  node scripts/ci/run.cjs "$name" node --check "$source" || failed=1
done
for test in tests/run-*.cjs; do
  node scripts/ci/run.cjs "$(basename "$test" .cjs)" node "$test" || failed=1
done
for source in .github/ci/*.sh .github/pvp-schema-test/*.sh; do
  node scripts/ci/run.cjs "shell-$(basename "$source" .sh)" bash -n "$source" || failed=1
done
node scripts/ci/run.cjs backend-safety bash .github/ci/test-safety.sh || failed=1
exit "$failed"
