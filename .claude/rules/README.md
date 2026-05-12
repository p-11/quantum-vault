# Claude/Codex Rule Index

These rules are mandatory for both Claude and Codex workflows in this repository.

## Loading Order

1. `AGENTS.md` (Codex-facing repo contract)
2. `CLAUDE.md` (project Claude contract)
3. `.claude/rules/*.md` (detailed domain and architecture constraints)
4. Global baseline from `~/.claude/CLAUDE.md` and `~/.claude/rules/*.md`

When rules overlap, prefer the stricter rule.

## Rule Files

- `anti-patterns.md` - cross-cutting forbidden implementation patterns
- `extension-architecture.md` - extension runtime/build/CSP architecture
- `extension-security.md` - lock flow, timeout, secret hygiene, env rules
- `extension-testing.md` - E2E coverage and selector stability constraints
- `provider-patterns.md` - provider responsibilities and factory migration notes
- `screen-navigation.md` - screen registry, navigation, hydration contracts
- `styling-and-brand.md` - token usage and visual system constraints
