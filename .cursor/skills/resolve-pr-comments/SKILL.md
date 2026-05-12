# /resolve-pr-comments - Address PR Review Feedback

1. Fetch unresolved threads via gh api graphql
2. Evaluate critically (prefer no-op over churn)
3. Fix valid issues, reply to disagreements
4. Run quality checks, commit, push
