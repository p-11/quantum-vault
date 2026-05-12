---
name: commit
description: >-
  Stage, commit, and optionally push changes for quantum-vault with conventional commit format.
  Enforces lint + prettier + unit tests before the commit lands.
argument-hint: '[optional message]'
---

# Commit Changes

## Workflow

### 1. Review Changes

```bash
git status
git diff --staged
git diff
```

### 2. Pre-commit Checks

Run the fast gate:

```bash
pnpm l:c && pnpm p:c && pnpm test:unit
```

If Prettier drifts, run `pnpm p:f` and re-run `pnpm p:c`. If ESLint reports auto-fixable issues, run `pnpm l:f` and re-check.

For changes that touch build configuration, the extension manifest, or Vite config, also run `pnpm build:dev`.

### 3. Stage Files

Stage specific files - never `git add .` or `git add -A`:

```bash
git add <specific-files>
```

### 4. Create Conventional Commit

Format: `type(scope): description`

Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `style`, `perf`

Keep the first line under 72 characters. Add a body for non-trivial changes. Link the Linear ticket at the end.

```bash
git commit -m "$(cat <<'EOF'
feat(send): add chain selector on send screen

- Resolve chain list from libqc resolver
- Colocate selected chain in SendFlowProvider
- Closes P11-1234
EOF
)"
```

### 5. Push (if requested)

```bash
git push -u origin "$(git branch --show-current)"
```

Before pushing, verify `git remote -v`, `git config user.name`, `git config user.email`, and `gh auth status` all match the account authorized for the `p-11` GitHub org. Keep per-contributor identity mappings in your own home-dir Claude Code setup; do not commit them to this repo.

## Rules

- Scope reflects the module or feature (`send`, `vault`, `screen-provider`, `libqc-bridge`, etc.)
- Keep the first line under 72 characters
- Add a body for complex changes
- Do NOT include `Co-Authored-By` trailer - the user is the sole author
- Never commit `.env`, credentials, or secrets
- Never use `--no-verify` unless the user explicitly requests it - if husky blocks you, fix the root cause and commit again
- Never amend a previously pushed commit without user approval (prefer a new commit)

## Husky Hooks

quantum-vault has `.husky/pre-commit` and `.husky/pre-push`. If either blocks the commit or push, read the error, fix the underlying issue, re-stage, and create a new commit.
