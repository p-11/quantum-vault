---
name: resolve-pr-comments
description: >-
  Triage and address CodeRabbit and reviewer comments on a quantum-vault PR. Filters out
  invalid suggestions that violate project conventions and enforces the full CI gate
  before re-pushing.
argument-hint: '[pr-number]'
---

# Resolve PR Comments

## Workflow

### 1. Fetch PR Comments

```bash
# Overview + conversation comments
gh pr view <number> --comments

# Inline code review comments (file-level)
gh api repos/<org>/quantum-vault/pulls/<number>/comments

# Full review verdicts
gh api repos/<org>/quantum-vault/pulls/<number>/reviews
```

Determine the repo `<org>` from `git remote -v`.

### 2. Triage Each Comment

Read every comment before making any changes. Categorize:

| Category                      | Action                                                     |
| ----------------------------- | ---------------------------------------------------------- |
| Valid fix needed              | Code change required - address in step 3                   |
| Already addressed             | Change is already present - reply confirming               |
| Disagree (with reason)        | Conflicts with project conventions - reply in step 4       |
| Not applicable / outdated     | Reply briefly and dismiss                                  |

### 3. Address Valid Comments

1. Make the code change
2. Run `pnpm l:c && pnpm p:c && pnpm test:unit` after each logical group of changes
3. If errors appear, run `pnpm l:f` then fix any remaining issues manually
4. Repeat until gates pass
5. Reply to the comment explaining the fix:

```bash
gh api repos/<org>/quantum-vault/pulls/<number>/comments/<comment_id>/replies \
  -f body="Fixed - extracted the repeated calculation into \`calculateAvgPrice\` in \`src/lib/format/avg-price.ts\`."
```

### 4. Respond to Invalid Comments

Reply clearly, respectfully, and cite the specific project convention when relevant:

```bash
gh api repos/<org>/quantum-vault/pulls/<number>/comments/<comment_id>/replies \
  -f body="Project convention is \`type\` over \`interface\` for data shapes (see CLAUDE.md). Keeping the current code."
```

### 5. CodeRabbit-Specific Handling

CodeRabbit suggestions must be verified critically. Skip or reply-dismiss when it suggests any of the following:

| CodeRabbit Suggestion                        | Why It Is Wrong Here                                                                   | Reply Template                                                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Use `interface` instead of `type`            | `type` for data shapes; `interface` only for class contracts                           | "Convention is `type` over `interface` for data shapes."                                                                   |
| Add `useMemo` / `useCallback`                | React Compiler handles memoization                                                     | "React Compiler handles memoization; manual `useMemo`/`useCallback` is not used in this project."                          |
| Add `?.` / `??` on non-optional values       | Trust the type system; use `ensurePresent()` at boundaries only                        | "The type guarantees this is present. Adding a fallback would mask a real bug."                                            |
| Wrap in `try-catch` just to log              | `attempt()` for user-facing errors; otherwise let errors bubble                        | "Convention uses `attempt()` for user-facing errors and lets internals bubble. No wrap needed here."                       |
| Use `switch/case`                            | Pattern matching only (Record lookups, `match()`, config arrays)                       | "Convention is Record lookups / `match()` instead of switch/case."                                                         |
| Replace arrow fns with `function` decls      | Arrow function expressions across the codebase                                         | "Convention is arrow function expressions."                                                                                |
| Hardcode hex / add inline styles             | Theme tokens only (see `src/index.css`)                                                | "Theme tokens are the source of truth for visuals; hardcoding colors is disallowed."                                       |
| Instantiate `LibQC` outside `WalletProvider` | Single instance pattern preserved by `WalletProvider`                                  | "`LibQC` is owned by `WalletProvider` as a `useRef` singleton; we do not instantiate it elsewhere."                        |

For any other CodeRabbit suggestion:

1. Check if it aligns with `CLAUDE.md` and `.claude/rules/`
2. Search the codebase for how similar code is written
3. If it introduces a pattern not used in the project, skip it
4. If it is a genuine improvement that aligns with conventions, apply it

### 6. Commit, Push, Finalize

After all comments are addressed:

```bash
pnpm ci:pr
git add <specific-files>
git commit -m "$(cat <<'EOF'
fix(scope): address PR review comments

- Summary of the fixes that landed
EOF
)"
git push
```

If the PR still has pending reviewers, optionally re-request review:

```bash
gh pr edit <number> --add-reviewer <reviewer-handle>
```

## Rules

- Read every comment before making any changes - understand the full picture first
- Batch related fixes into a single commit
- Never dismiss valid feedback - if the comment reveals a real issue, fix it
- Be respectful but firm when disagreeing; cite the specific convention
- Never blindly apply CodeRabbit suggestions - verify each against project patterns
- Run `pnpm ci:pr` before pushing - never push broken code
- Do NOT include `Co-Authored-By` trailer
