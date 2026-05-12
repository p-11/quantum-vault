#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PACKAGE_NAME="@project-eleven/libqc"

declared_version="$(
  node --input-type=module <<'NODE'
import fs from 'node:fs';

const packageName = '@project-eleven/libqc';
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const dependencyValue = packageJson.dependencies?.[packageName];

if (typeof dependencyValue !== 'string' || dependencyValue.length === 0) {
  process.exit(1);
}

process.stdout.write(dependencyValue);
NODE
)"

if [[ -z "${declared_version:-}" ]]; then
  echo "::error::package.json must declare ${PACKAGE_NAME} in dependencies."
  exit 1
fi

if [[ "$declared_version" =~ ^(file:|link:|workspace:|portal:|git\+|github:|https?:) ]]; then
  echo "::error::${PACKAGE_NAME} must use a published pinned version, found '${declared_version}'."
  exit 1
fi

if ! [[ "$declared_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]]; then
  echo "::error::${PACKAGE_NAME} must be pinned to an exact semver version, found '${declared_version}'."
  exit 1
fi

if [[ ! -f "node_modules/@project-eleven/libqc/package.json" ]]; then
  echo "::error::Installed ${PACKAGE_NAME} package was not found. Run 'pnpm install --frozen-lockfile'."
  exit 1
fi

installed_version="$(
  node --input-type=module <<'NODE'
import fs from 'node:fs';

const packageJson = JSON.parse(
  fs.readFileSync('node_modules/@project-eleven/libqc/package.json', 'utf8'),
);

if (typeof packageJson.version !== 'string' || packageJson.version.length === 0) {
  process.exit(1);
}

process.stdout.write(packageJson.version);
NODE
)"

if [[ "$installed_version" != "$declared_version" ]]; then
  echo "::error::Installed ${PACKAGE_NAME} version '${installed_version}' does not match package.json '${declared_version}'."
  exit 1
fi

resolved_package_json="$(
  node --input-type=module <<'NODE'
import { realpathSync } from 'node:fs';

process.stdout.write(realpathSync('node_modules/@project-eleven/libqc/package.json'));
NODE
)"

expected_segment="/node_modules/.pnpm/@project-eleven+libqc@${declared_version}"
if [[ "$resolved_package_json" != *"$expected_segment"* ]]; then
  echo "::error::${PACKAGE_NAME} resolved from an unexpected location: ${resolved_package_json}."
  echo "::error::This usually means a local link or override is active. Use the published pinned package only."
  exit 1
fi

echo "Verified ${PACKAGE_NAME} parity: package.json=${declared_version}, installed=${installed_version}."
