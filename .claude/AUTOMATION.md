# quantum-vault Automation

Index of skills, hooks, and agents for this repo. Coding standards live in `CLAUDE.md`, `AGENTS.md`, and `.claude/rules/` - this file is a routing layer, not a rulebook.

## Quick Start

```bash
# Full feature delivery from Linear ticket to draft PR
/orchestrate P11-1234

# Exhaustive PR review with parallel agents
/orchestrate feat/my-branch --review

# Finish current work: gate + commit + push + draft PR
/finish

# Pre-commit with full fast gate
/commit "feat(send): add chain selector"

# Search the sibling libqc SDK before assuming an export exists
/check-libqc getCoinBalance

# Pull main in both quantum-vault and libqc
/sync-repos
```

## Skills

| Skill                   | Purpose                                                             | Example                                       |
| ----------------------- | ------------------------------------------------------------------- | --------------------------------------------- |
| `/orchestrate`          | End-to-end feature delivery (Mode A) or exhaustive PR review (Mode B) | `/orchestrate P11-1234` or `... --review`     |
| `/finish`               | Run CI gate, commit if needed, push, draft PR                       | `/finish`                                     |
| `/commit`               | Stage + commit with conventional format + fast gate                 | `/commit "feat(vault): rename field"`         |
| `/create-pr`            | Open a draft PR with Linear link + extension test plan              | `/create-pr P11-1234`                         |
| `/linear`               | Linear ticket workflows (fetch, create branch, create ticket, block) | `/linear P11-1234`                            |
| `/resolve-pr-comments`  | Triage CodeRabbit/reviewer comments on a PR                         | `/resolve-pr-comments 42`                     |
| `/delegate`             | Produce a zero-ambiguity plan for a faster/less-capable model       | `/delegate`                                   |
| `/check-libqc`          | Search the sibling libqc SDK for exports, resolvers, types          | `/check-libqc getBalance`                     |
| `/sync-repos`           | Pull latest `main` for quantum-vault + libqc                        | `/sync-repos`                                 |
| `/testing-guide`        | Reference for Vitest (unit + component) + Playwright (E2E)          | `/testing-guide`                              |

Each skill's full instructions live in `.claude/skills/<name>/SKILL.md`.

## Agents

| Agent          | Use when                                                             |
| -------------- | -------------------------------------------------------------------- |
| `code-reviewer`| Pre-PR review of providers/screens/security/libqc seam               |
| `investigator` | Trace provider/screen/data-flow dependencies                         |
| `pr-preparer`  | Prepare a PR with lint/format gates and runtime-risk checks          |
| `refactorer`   | Refactor while preserving provider, navigation, and security behavior |
| `test-writer`  | Write or update tests with focus on E2E user journeys                |
| `styling`      | Review/implement styling, tokens, shadcn usage                       |

Agent definitions live in `.claude/agents/*.md`.

## Hooks (see `.claude/settings.json`)

| Event                    | Script                          | What it does                                                                 |
| ------------------------ | ------------------------------- | ---------------------------------------------------------------------------- |
| SessionStart             | `load-envrc.sh`                 | Sources `.envrc` if present so direnv vars flow into tool calls              |
| PreToolUse (Bash/Edit/Write/MultiEdit) | `block-dangerous.sh`  | Blocks force-push, reset --hard, clean -f, direct main push, secret files, credential exposure, sensitive logging |
| PostToolUse (Edit/Write) | `post-edit-format.sh`           | Runs Prettier on the touched file                                            |
| PostToolUse (Compact)    | `post-compact-reminder.sh`      | Re-injects project reminders after context compaction                        |
| PostToolUseFailure (Bash)| `on-failure-notify.sh`          | Prints a concise hint when a common command fails                            |
| TaskCompleted            | `task-completed-check.sh`       | Scans changed .ts/.tsx for anti-patterns (console, useMemo, switch, hex)     |
| TaskCompleted            | `quality-gate.sh`               | Runs `pnpm l:c && pnpm p:c` when the tree has changes                        |

Husky hooks: `.husky/pre-commit`, `.husky/pre-push`.

Ensure hook scripts remain executable: `chmod +x .claude/hooks/*.sh`.

## Rules

`.claude/rules/README.md` is the loading order and index:

- `anti-patterns.md` - cross-cutting forbidden implementation patterns
- `extension-architecture.md` - extension runtime/build/CSP architecture
- `extension-security.md` - lock flow, timeout, secret hygiene, env rules
- `extension-testing.md` - E2E coverage + selector stability
- `provider-patterns.md` - provider responsibilities + LibQC singleton contract
- `screen-navigation.md` - screen registry + navigation + hydration contracts
- `styling-and-brand.md` - token usage and visual system constraints

`~/.claude/rules/` provides the global baseline (git identity, code quality, execution strategy, systems architecture, decision framework, cross-company isolation).

## Troubleshooting

- **ESLint fails**: `pnpm l:f` auto-fixes import sorts and simple issues. Fix remaining manually.
- **Prettier drift**: `pnpm p:f` writes, then `pnpm p:c` to verify.
- **TypeScript error**: Fix at source. No `as` cast. Add `ensurePresent()` at boundaries.
- **Unit tests fail**: Fix the code, not the test (unless spec changed).
- **E2E parse fails**: Selector or label broke. Restore or update `__tests__/e2e/*.test.ts` in the same PR.
- **Vite build fails**: Read the error. Likely a type-only import boundary or missing export.
- **Branch behind main**: `git pull --rebase origin main && git push --force-with-lease` (confirm the active GitHub account is authorized for the `p-11` org first).
- **libqc API drift**: `/check-libqc <export>` to verify exports; re-install with `pnpm install` after pulling libqc main.
- **Wrong git identity**: This repo lives under the `p-11` GitHub org; switch to the account authorized for that org via `gh auth switch` and set per-repo `git config user.name` / `user.email` accordingly. Contributors keep their own account mapping; any personal rules that encode this mapping belong in the user's home directory, not in this repo.
- **Husky blocks commit**: Fix the root cause. Do not use `--no-verify`.
