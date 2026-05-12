# /commit - Conventional Commit

1. Verify git identity matches local config
2. Analyze changes (git status, git diff)
3. Run quality checks (pnpm l:c && pnpm p:c)
4. Stage specific files (never git add -A)
5. Commit: type(scope): description - no Co-Authored-By
6. Types: feat, fix, chore, refactor, docs, test, style, perf
