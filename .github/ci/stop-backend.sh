#!/usr/bin/env bash
set -euo pipefail
scope="${1:?scope}"
[[ "$scope" == pvp || "$scope" == invitation || "$scope" == full ]]
[[ "${GITHUB_ACTIONS:-}" == true && -n "${RUNNER_TEMP:-}" ]]
if [[ "$scope" == invitation && -f "$RUNNER_TEMP/rpg-invitation-edge.pid" ]]; then
  kill "$(cat "$RUNNER_TEMP/rpg-invitation-edge.pid")" 2>/dev/null || true
fi
harness="$RUNNER_TEMP/site-$scope-supabase"
if command -v supabase >/dev/null && [[ -f "$harness/.ci-disposable" ]]; then
  supabase --workdir "$harness" stop
fi
