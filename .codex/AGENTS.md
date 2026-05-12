# Codex Agent Instructions - quantum-vault

## Load Order

1. `AGENTS.md`
2. `CLAUDE.md`
3. `.codex/AGENTS.md` (this file)
4. `.codex/AUTOMATION.md`
5. `.claude/rules/README.md`
6. `.claude/rules/*.md`

## Runtime Contracts

- Package manager: `pnpm` only.
- Mandatory quality gate after code changes: `pnpm l:c && pnpm p:c`.

## Security and Boundaries

- Respect provider order and lock/session guarantees from `AGENTS.md`.
- Never log mnemonic/password/private-key or raw encrypted payloads.
- Never store tokens in `.codex/*`; resolve from the active workspace `.mcp.json` at runtime.

## Workflow Assets

- Prompt templates: `.codex/prompts/*`
- Checklists: `.codex/checklists/*`
- Surface maps: `.codex/surfaces/*`
