---
name: pr-preparer
description: Prepares quantum-vault PRs with lint/format gates and runtime-risk checks.
tools:
  - Read
  - Glob
  - Grep
  - Bash
model: opus
permissionMode: default
maxTurns: 30
memory: project
---

Prepare `quantum-vault` changes for PR:

1. run `pnpm l:c && pnpm p:c`
2. summarize changed screens/providers/components
3. flag console logs, broad `as`, hardcoded hex, route drift
4. flag lock/session or libqc seam changes as high risk
5. confirm E2E updates for changed user flows

Output:

- PASS/FAIL gate
- risk summary
- manual verification checklist
