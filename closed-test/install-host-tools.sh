#!/usr/bin/env bash
# Workspace-only tool installation on an operator-provided Linux x86_64 host.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
[[ "$(uname -s)" == Linux && "$(uname -m)" == x86_64 ]] || { echo 'Use a dedicated Linux x86_64 host'; exit 1; }
for tool in curl tar sha256sum; do command -v "$tool" >/dev/null || { echo "Missing prerequisite: $tool"; exit 1; }; done
mkdir -p .runtime/host-tools/download .runtime/host-tools/cli
cd .runtime/host-tools/download
archive=node-v22.23.4-linux-x64.tar.xz
curl --fail --location --proto '=https' --tlsv1.2 --output "$archive" "https://nodejs.org/dist/v22.23.4/$archive"
curl --fail --location --proto '=https' --tlsv1.2 --output SHASUMS256.txt https://nodejs.org/dist/v22.23.4/SHASUMS256.txt
sha256sum --check --ignore-missing SHASUMS256.txt
tar -xJf "$archive" -C ..
cd ..
export PATH="$PWD/node-v22.23.4-linux-x64/bin:$PATH"
printf '{"private":true}\n' > cli/package.json
npm install --prefix cli --save-exact --no-audit --no-fund supabase@2.84.2
echo 'Workspace tools ready. Use bash closed-test/host.sh doctor from the checkout.'
