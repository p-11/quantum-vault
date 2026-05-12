# /orchestrate - End-to-End Workflow

Quick reference:
- /orchestrate <issue> - Feature delivery: issue analysis -> branch -> plan -> implement -> validate -> PR
- /orchestrate review <pr> - PR review: parallel agents for type safety, architecture, quality, cross-repo

Key phases:
1. Context gathering (parallel: issue analysis, codebase recon, cross-repo impact)
2. Planning (present to user, wait for approval)
3. Implementation (parallel by complexity: direct / agents / staged)
4. Validation loop (pnpm l:c && pnpm p:c until clean)
5. Commit + push (verify local git identity, conventional format, no Co-Authored-By)
6. Draft PR creation via gh pr create
