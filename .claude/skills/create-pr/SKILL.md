---
name: create-pr
description: >-
  Create a GitHub draft PR for quantum-vault with Linear ticket linking, a Summary,
  a Test Plan that mirrors `pnpm ci:pr`, and extension-specific verification items.
argument-hint: '[ticket-id]'
---

# Create Pull Request

## Workflow

### 1. Gather Context

```bash
git log --oneline origin/main..HEAD
git diff --stat origin/main..HEAD
git branch --show-current
```

### 2. Confirm Identity + Remote

Before opening the PR, verify the active GitHub account matches the repo:

```bash
git remote -v
gh auth status
```

If the account does not match the `p-11` GitHub org, stop. Switch with `gh auth switch` to the account authorized for this org (contributors keep their own mapping in their personal Claude Code setup, not in this repo).

### 3. Extract Linear Ticket

- From argument: `P11-1234`
- From branch name: look for the ticket prefix token
- If no ticket is found, ask the user - do not fabricate a ticket ID

### 4. Final Quality Gate

```bash
pnpm ci:pr
```

This runs lint, prettier, unit tests, dev build, E2E parse check, and the `dep-doc` audit. Only proceed once it passes.

### 5. Push Current Branch

```bash
git push -u origin "$(git branch --show-current)"
```

### 6. Create Draft PR

```bash
gh pr create --draft \
  --title "feat(scope): description (P11-1234)" \
  --body "$(cat <<'EOF'
## Summary
- What this PR does and why (1-3 bullets)

## Test Plan
- [ ] `pnpm l:c` passes
- [ ] `pnpm p:c` passes
- [ ] `pnpm test:unit` passes
- [ ] `pnpm test:e2e:check` passes
- [ ] `pnpm build:dev` passes
- [ ] Extension loads unpacked from `build/` and boots to the expected screen
- [ ] Lock/unlock + idle timeout verified for any authenticated screen touched
- [ ] Manual walk-through of the changed flow on the extension popup

## Related
- Closes P11-1234
EOF
)"
```

### 7. Return PR URL

Print the PR URL so the user can review it.

## Rules

- PR title follows conventional commit format
- Always create as a **draft** PR
- Always include Summary + Test Plan sections
- Include the Linear ticket link (`Closes P11-XXXX`) when a ticket exists
- Do NOT include `Co-Authored-By` trailer
- Push before creating the PR
- Never force-push to `main`
- If the PR already exists for this branch, update it with `gh pr edit` instead of opening a new one

## Cross-Repo Coordination

If the change depends on updates to the sibling `libqc` SDK, call that out in the PR body under a `Related` subsection with the SDK PR link, and ensure the `quantum-vault` PR bumps `package.json` to a published `@project-eleven/libqc` version that includes the required changes.
