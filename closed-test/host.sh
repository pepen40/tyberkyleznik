#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
export PATH="$PWD/.runtime/host-tools/node-v22.23.4-linux-x64/bin:$PWD/.runtime/host-tools/cli/node_modules/.bin:$PATH"
operation="${1:-doctor}"
if [[ $# -gt 0 ]]; then shift; fi
case "$operation" in
  doctor) node closed-test/host-check.cjs doctor ;;
  init)
    node closed-test/host-check.cjs doctor
    node closed-test/manage.cjs prepare "$@"
    node closed-test/manage.cjs start "$@"
    node closed-test/manage.cjs apply "$@"
    ;;
  edge) node closed-test/manage.cjs functions "$@" ;;
  web) node closed-test/manage.cjs serve "$@" ;;
  verify) node closed-test/host-check.cjs verify "$@" ;;
  add-user) node closed-test/manage.cjs add-user "$@" ;;
  stop) node closed-test/manage.cjs stop "$@" ;;
  *) echo 'Expected doctor/init/edge/web/verify/add-user/stop'; exit 1 ;;
esac
