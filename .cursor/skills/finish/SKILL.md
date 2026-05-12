# /finish - PR Lifecycle

1. Verify git identity matches local config
2. Run quality checks (pnpm l:c && pnpm p:c)
3. Push branch
4. Create or reuse PR via gh pr create --draft
5. Mark ready + enable auto-merge
6. Poll CI, fix failures
7. Land on main after merge
