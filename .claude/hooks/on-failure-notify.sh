#!/bin/bash
# PostToolUseFailure (Bash) hook: print a concise hint when a common quantum-vault
# command fails. Non-blocking - always exits 0.

EXIT_CODE="${TOOL_EXIT_CODE:-1}"
OUTPUT="${TOOL_OUTPUT:-}"

if [ "$EXIT_CODE" = "0" ]; then
  exit 0
fi

if echo "$OUTPUT" | grep -qi "typecheck\|type error\|TS[0-9]"; then
  echo "TypeScript error. Fix narrowing, imports, or ensurePresent() at boundaries. Do not use 'as'."
elif echo "$OUTPUT" | grep -qi "eslint"; then
  echo "ESLint failed. Try: pnpm l:f (auto-fix). Then: pnpm l:c"
elif echo "$OUTPUT" | grep -qi "prettier\|format"; then
  echo "Prettier check failed. Run: pnpm p:f to write, then pnpm p:c to verify."
elif echo "$OUTPUT" | grep -qi "vitest\|test.*fail\|FAIL"; then
  echo "Unit tests failed. Run: pnpm test:unit. Fix the code (not the test) unless the spec changed."
elif echo "$OUTPUT" | grep -qi "playwright\|e2e"; then
  echo "E2E check failed. Run: pnpm test:e2e:check (parse) or pnpm exec playwright test. Preserve selector stability."
elif echo "$OUTPUT" | grep -qi "vite\|build.*fail\|bundle"; then
  echo "Vite build failed. Run: pnpm build:dev. Likely a missing export or type-only import boundary."
elif echo "$OUTPUT" | grep -qiE "MODULE_NOT_FOUND|ENOENT|Cannot find module"; then
  echo "Dependency resolution error. Try: pnpm install. If libqc drift, also pull the sibling and re-install."
elif echo "$OUTPUT" | grep -qi "dep-doc"; then
  echo "dep-doc audit failed. Inspect the reported dependency notes and update dep-doc.toml or package.json accordingly."
fi

exit 0
