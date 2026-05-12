#!/bin/bash
# TaskCompleted hook: run the fast quality gate when the working tree has tracked changes.
# Non-blocking for Claude's workflow (exits 0) but surfaces the first failing command to the user.

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

if ! git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

# Only run when there are changes Claude may be responsible for.
if [ -z "$(git -C "$ROOT" diff --name-only --diff-filter=ACMR HEAD 2>/dev/null)" ]; then
  exit 0
fi

cd "$ROOT" || exit 0

echo "Quality gate: pnpm l:c && pnpm p:c"
if ! pnpm l:c; then
  echo "-> ESLint failed. Run: pnpm l:f"
  exit 0
fi

if ! pnpm p:c; then
  echo "-> Prettier drift. Run: pnpm p:f"
  exit 0
fi

exit 0
