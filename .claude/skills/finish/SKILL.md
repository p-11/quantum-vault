---
name: finish
description: >-
  Finish current quantum-vault work: run the full CI gate, commit if needed, push, create or
  reuse a draft PR, and hand off cleanly. Stops when explicit user judgment is required.
disable-model-invocation: true
---

# Finish

## Goal

Run as much of the pre-PR workflow as possible programmatically so the user is not stuck in the loop. The happy path ends with:

- All quality gates green
- A commit landed on the ticket branch
- The branch pushed
- A draft PR created or the existing one updated
- A summary printed with the PR URL

Only stop for human judgment when automation reports a real blocker.

## Workflow

### 1. Check Branch State

```bash
git branch --show-current
git status --short
```

Rules:

- If already on `main` with nothing to finish, stop and tell the user there is nothing to finish.
- If on `main` with uncommitted work that still needs a ticket branch, run `/linear` first to create a ticket and branch.
- Otherwise, continue on the current ticket branch.

### 2. Run the Full CI Gate

```bash
pnpm ci:pr
```

If anything fails, enter the fix loop:

```
while !pass:
  1. Read the first failing gate's output
  2. Fix the root cause in code (never disable the gate)
  3. If auto-fixable, run `pnpm l:f` or `pnpm p:f`
  4. Re-run `pnpm ci:pr`
```

Stop after 2 iterations with the same error and surface it to the user.

### 3. Commit If Needed

If the working tree has changes, follow the `commit` skill:

- Stage only the relevant files (`git add <paths>` - never `git add .`)
- Conventional commit format
- No `Co-Authored-By` trailer

### 4. Verify Identity + Remote

```bash
git remote -v
gh auth status
```

The active account must be the one authorized for the `p-11` GitHub org. If it is not, stop and ask the user to switch with `gh auth switch` rather than guessing.

### 5. Push

```bash
git push -u origin "$(git branch --show-current)"
```

If the branch already exists remotely and has drifted, use `git push --force-with-lease` only after confirming with the user.

### 6. Create or Reuse PR

```bash
gh pr view --json number,url,isDraft --jq '.'
```

- If no PR exists, create a draft PR via the `create-pr` skill
- If a PR exists and is draft, update its body via `gh pr edit` to reflect the current commit set
- Do NOT mark the PR ready-for-review unless the user asks

Print the PR URL.

### 7. Interpret Outcomes

- **All gates pass + PR ready** -> print the summary and stop
- **Gate fails after 2 iterations** -> stop with a concise failure summary
- **Unresolved review threads** -> run the `resolve-pr-comments` skill
- **Branch behind main** -> `git pull --rebase origin main`, re-run `pnpm ci:pr`, then push with `--force-with-lease` (confirmed)

## Rules

- Prefer automation over manual GitHub browsing
- Never mark a draft PR as ready without user confirmation
- Never force-push to `main`
- Only bypass husky hooks or CI gates with explicit user permission
- Do not update the Linear ticket status - the GitHub-Linear integration handles it when the PR is moved to ready-for-review
