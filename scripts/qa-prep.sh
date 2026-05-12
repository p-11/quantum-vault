#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Preparing deterministic QA environment..."

rm -rf build build-hmr release
pnpm install --frozen-lockfile --ignore-scripts
pnpm run verify:libqc-source
pnpm run build:dev
pnpm run diagnostics:runtime

echo
echo "Next steps:"
echo "1. In chrome://extensions remove old unpacked Quantum Vault entries."
echo "2. Load unpacked extension from the local build/ directory."
echo "3. If needed, clear extension storage before retesting."
