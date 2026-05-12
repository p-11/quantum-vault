---
name: sync-repos
description: >-
  Pull the latest `main` for quantum-vault and the sibling libqc SDK. Run at the
  start of a session, after long breaks, or before starting a new ticket.
---

# Sync Repos

quantum-vault consumes `@project-eleven/libqc` as a pinned published package. For source-level verification and coordinated SDK + extension work, the sibling `libqc` checkout must stay on current `main`. Drift between the installed pin, the sibling checkout, and upstream `main` causes silent runtime bugs, broken builds, or outdated types.

## Workflow

Run these from the `quantum-vault` repo root; `../libqc` resolves to the sibling SDK checkout.

### 1. Sync quantum-vault

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
```

If `git pull --ff-only` refuses because of local commits on `main`, stop and ask the user - never discard their work.

### 2. Sync libqc

```bash
(cd ../libqc && git fetch origin && git checkout main && git pull --ff-only origin main)
```

### 3. Reinstall if libqc changed

```bash
pnpm install
```

Only required when `libqc/package.json` or `libqc/src/` public exports changed. If unsure, run `pnpm install` - it is fast and idempotent.

### 4. Smoke Check

```bash
pnpm l:c
pnpm build:dev
```

If either fails on fresh `main`, report the failure to the user immediately - this is a blocker for new work.

## Output

Report per repo:

- Current branch
- Commits pulled (or "already up to date")
- Any failures

## Rules

- Never discard local changes with `git reset --hard` or `git clean -fd` during sync
- Use `git pull --ff-only` so drift is caught, not hidden
- Do not sync into a branch you are not currently on
- If either repo has uncommitted work, skip that repo and warn the user
