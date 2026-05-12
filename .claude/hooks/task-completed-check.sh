#!/bin/bash

CHANGED_FILES=$(git diff --name-only --diff-filter=ACMR HEAD 2>/dev/null | grep -E '^src/.*\.(ts|tsx)$' || true)

if [ -z "$CHANGED_FILES" ]; then
  exit 0
fi

ISSUES=""

for f in $CHANGED_FILES; do
  [ -f "$f" ] || continue

  if grep -nE 'console\.(log|warn|debug|info|error)' "$f" | grep -v '.test.' >/dev/null 2>&1; then
    ISSUES="$ISSUES\n- console output found: $f"
  fi

  if grep -nE '\b(useMemo|useCallback)\b' "$f" >/dev/null 2>&1; then
    ISSUES="$ISSUES\n- useMemo/useCallback found (verify necessity): $f"
  fi

  if grep -nE ' as (any|unknown|never|[A-Z][A-Za-z0-9_]+)' "$f" | grep -v 'as const' >/dev/null 2>&1; then
    ISSUES="$ISSUES\n- possible broad type assertion: $f"
  fi

  if grep -nE '\bswitch\b|\bcase\b' "$f" >/dev/null 2>&1; then
    ISSUES="$ISSUES\n- switch/case detected (verify necessity): $f"
  fi

  if grep -nE '#[0-9A-Fa-f]{3,8}' "$f" | grep -v 'src/index.css' >/dev/null 2>&1; then
    ISSUES="$ISSUES\n- hardcoded hex color outside theme file: $f"
  fi
done

if [ -n "$ISSUES" ]; then
  printf "quantum-vault task check warnings:%b\n" "$ISSUES"
  echo "Run: pnpm l:f && pnpm p:c"
fi

exit 0
