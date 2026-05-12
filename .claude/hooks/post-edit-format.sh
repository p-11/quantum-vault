#!/bin/bash
# PostToolUse (Edit/Write) hook: run Prettier on the touched file so the working tree
# stays format-clean between tool calls.
# Only formats files that are inside the project root and match the repo Prettier glob.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Only format files inside the project root (avoid touching absolute paths outside).
case "$FILE_PATH" in
  "$ROOT"/*) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.json)
    (cd "$ROOT" && pnpm exec prettier --config .prettierrc --write --ignore-unknown "$FILE_PATH") >/dev/null 2>&1
    ;;
esac

exit 0
