#!/bin/bash
# PreToolUse (Bash/Edit/Write/MultiEdit) hook: block destructive or secret-exposing
# operations in quantum-vault. Exit 2 blocks the tool call.

# Claude Code passes hook payload as JSON on stdin. Use $1 when run interactively.
if [ -t 0 ]; then
  INPUT="${1:-}"
else
  INPUT=$(cat)
  if [ -z "$INPUT" ]; then
    INPUT="${1:-}"
  fi
fi

CMD=$(echo "$INPUT" | jq -r '.command // .tool_input.command // .tool_input // empty' 2>/dev/null)
if [ -z "$CMD" ]; then
  CMD="$INPUT"
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.file_path // .tool_input.file_path // empty' 2>/dev/null)

# --- Git safety ---

if echo "$CMD" | grep -Eq 'git[[:space:]]+reset[[:space:]]+--hard'; then
  echo "Dangerous git command blocked (reset --hard). Ask for explicit user approval first." >&2
  exit 2
fi

if echo "$CMD" | grep -Eq 'git[[:space:]]+clean[[:space:]]+-[A-Za-z]*f'; then
  echo "Dangerous git command blocked (clean -f). Ask for explicit user approval first." >&2
  exit 2
fi

if echo "$CMD" | grep -Eq 'git[[:space:]]+push'; then
  if echo "$CMD" | grep -Eq '(^|[[:space:]])--force([[:space:]]|$)|(^|[[:space:]])-f([[:space:]]|$)'; then
    echo "Force push blocked. Ask for explicit user approval first." >&2
    exit 2
  fi
fi

# Block direct pushes to main (bracket char classes to avoid matching this script when embedded in payload).
if echo "$CMD" | grep -Eq 'git[[:space:]]+push.*(origin|upstream).*([m]ain|mas[t]er)(\s|$)'; then
  echo "Direct push to main/master blocked." >&2
  exit 2
fi

# --- Secret hygiene ---

CHECK_PATH="${FILE_PATH:-$CMD}"
if echo "$CHECK_PATH" | grep -Eq '\.([e]nv|pem|p12)$|credentia[l]s\.|sec[r]et\.|key[s]tore|\.en[v]\.local'; then
  echo "Editing a secret/credential file blocked. Ask for explicit user approval." >&2
  exit 2
fi

if echo "$CMD" | grep -Eq 'pri[n]tenv|expo[r]t -p|ec[h]o.*\$\((TOK[E]N|SECRE[T]|KE[Y]|PASSWO[R]D|MN[E]MONIC|P[R]IVATE)\)'; then
  echo "Environment variable exposure blocked." >&2
  exit 2
fi

# Block logging of sensitive wallet material in changes or commands.
if echo "$CMD" | grep -Eq 'conso[l]e\.(log|info|debug).*\b(mn[e]monic|passwo[r]d|privat[e]Key|secr[e]tKey|se[e]d)\b'; then
  echo "Logging sensitive wallet data blocked. Never log mnemonic/password/keys." >&2
  exit 2
fi

exit 0
