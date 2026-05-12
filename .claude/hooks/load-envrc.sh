#!/bin/bash
# SessionStart hook: sources .envrc at project root so direnv-managed env vars
# (GH_TOKEN, any local overrides) are available in Claude Code shell sessions.
# Writes exported vars into the session env file so later tool calls inherit them.

if [ -z "$CLAUDE_ENV_FILE" ]; then
  exit 0
fi

ENVRC_PATH="${CLAUDE_PROJECT_DIR:-.}/.envrc"

if [ -f "$ENVRC_PATH" ]; then
  BEFORE=$(env | sort)
  # shellcheck disable=SC1090
  source "$ENVRC_PATH" 2>/dev/null
  AFTER=$(env | sort)

  diff <(echo "$BEFORE") <(echo "$AFTER") | grep '^>' | sed 's/^> //' >> "$CLAUDE_ENV_FILE"
fi

exit 0
