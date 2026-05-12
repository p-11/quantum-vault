#!/usr/bin/env bash
#
# Asserts that every required CI secret is present and non-empty.
# Sourced by .github/workflows/pr.yml and .github/workflows/main.yml.
#
# The list of required secrets lives ONLY in this file. The workflow
# files inject the secret values via their own env: blocks (this is
# unavoidable in GitHub Actions - secrets must be explicitly mapped
# into env vars before any script can read them), but the validation
# logic is single-source.
#
# Why this exists: GitHub Actions silently substitutes empty strings
# for missing secret references, so a workflow can run for days
# against a misconfigured repo and produce misleading test failures
# instead of a clear "missing secret" error. This script makes that
# failure mode loud and immediate.

set -euo pipefail

required=(
  VITE_ETHEREUM_RPC_URL
  VITE_ETHEREUM_BUNDLER_RPC_URL
  VITE_ETHEREUM_BUNDLER_API_KEY
  VITE_BITCOIN_API_URL
  VITE_ASSET_PRICES_URL
  NPM_TOKEN
)

missing=()
for var in "${required[@]}"; do
  raw="${!var:-}"
  # Trim leading and trailing whitespace. A secret accidentally set
  # to a single space character should be treated as missing, not
  # as a valid value that gets passed through to the build.
  trimmed="${raw#"${raw%%[![:space:]]*}"}"
  trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
  if [ -z "$trimmed" ]; then
    missing+=("$var")
  fi
done

if [ ${#missing[@]} -gt 0 ]; then
  printf '::error::Missing required CI secrets: %s\n' "${missing[*]}"
  printf '\n'
  printf 'Set them in one of:\n'
  printf '  Repository secrets:  https://github.com/p-11/quantum-vault/settings/secrets/actions\n'
  printf '  Environment secrets: https://github.com/p-11/quantum-vault/settings/environments\n'
  printf '\n'
  printf 'main.yml runs in the "staging" environment, so secrets defined\n'
  printf 'there will override repository-level secrets for that workflow.\n'
  exit 1
fi

echo "All required secrets are set."
