# CI/CD Operations

## Workflow Ownership

- `pr.yml` owns parallel PR validation: static checks, unit tests, build, smoke E2E, and security scan.
- `main.yml` owns main-branch integration, release smoke coverage, prerelease packaging, and prerelease creation.
- `release.yml` owns tagged production releases. It now guards against tags that do not point into `origin/main` history before handing off to the shared workflow.
- `nightly.yml` owns informational Trivy plus sharded Playwright full runs (`test:e2e:full:ci`) and merged reports. Nightly full E2E builds and validates production `dist/` so Playwright preview matches PR/main smoke and release artifact parity. The full CI script collects the full failure set instead of stopping at the first failure. Nightly is separate from the release path and does not block production releases.
- `libqc-bump.yml` owns manual and scheduled `@project-eleven/libqc` bump orchestration. It resolves target version (manual input or latest published), validates/pins dependencies, runs preflight checks, and opens or updates a deterministic PR branch.
- Shared CI behavior lives in `.github/workflows/_ci-shared.yml`; caller workflows should select the narrowest mode they need.

Workflow changes are owned through `.github/CODEOWNERS` by `@antoni0dev` and `@crosby`.

## LibQC Bump Runbook

Use this path whenever Quantum Vault needs to consume a new published `@project-eleven/libqc` version.

1. In GitHub Actions, run the `LibQC Bump` workflow (`.github/workflows/libqc-bump.yml`).
   - Run it from the `main` branch.
2. Provide:
   - `libqc_version`: optional exact semver (leave empty to auto-resolve latest published)
   - `draft_pr`: optional (`false` by default)
3. Workflow guardrails:
   - Rejects non-exact semver input.
   - Fails if the npm version does not exist or cannot be fetched.
   - Runs `pnpm add @project-eleven/libqc@<version> --ignore-scripts`.
   - Revalidates lock/source parity with `pnpm install --frozen-lockfile --ignore-scripts` and `pnpm run verify:libqc-source`.
   - Requires only `package.json` and `pnpm-lock.yaml` to change.
   - Runs preflight checks: `l:c`, `p:c`, `typecheck`, `test:unit`, `build:dev`.
   - Requires `CI_PR_TOKEN` secret with contents write and pull requests write access so downstream `pull_request` checks run; the workflow verifies push access with a dry-run branch push and pull request access with a validation-only PR creation probe before installing dependencies.
4. No-op behavior:
   - If `libqc_version` is already pinned, the workflow exits successfully with no PR creation (`has_changes=false`).
5. Review and merge the generated PR after normal branch protections pass.
6. Create a production release from the GitHub Actions page:
   - Open **Actions > Release**.
   - Click **Run workflow**.
   - Keep the branch set to `main`.
   - Enter the next production tag, for example `v0.0.15`.
   - Click **Run workflow**.
7. `release.yml` enforces `libqc` freshness before production CI/release.
8. `release.yml` runs production CI and publishes the release artifact from that tag.

Tag pushes still work for automation and CLI users: pushing a `v*` tag starts the same release workflow.

### Freshness Override (Emergency Only)

- Default behavior: production release fails if pinned `@project-eleven/libqc` is behind latest published.
- Explicit override: set repository variable `ALLOW_STALE_LIBQC_RELEASE=true` for an emergency release, then revert it to `false` immediately after.

## Triage

### Playwright

- Treat failures with assertion mismatches, screenshot diffs, or trace evidence of wrong wallet state as app regressions.
- Treat failures during browser install, dev-server startup, timeout waiting, missing report upload, or runner-only flakes as CI/infra issues.
- Keep the `playwright-report` artifact available for debugging before closing the issue.

### Trivy

- Treat `HIGH` and `CRITICAL` findings as security work until proven otherwise.
- First check whether the finding came from a dependency bump, base image update, or a new transitive package.
- If a finding is a false positive, document the rationale in the PR and keep the scanner gate intact.

## Timeouts, Artifacts, Caching

- Keep workflow-level job caps below the runner quota and keep the Playwright step timeout below the job cap.
- Retain Playwright reports for 14 days so failures can be debugged after the initial run.
- Cache pnpm through `actions/setup-node`; do not add extra caches for browser binaries or build output unless a measured bottleneck justifies it.
- Never cache secrets, release artifacts, or user wallet state.

## Branch Protection Baseline

`main` must enforce pull requests plus the PR validation checks.
The transitional `pr-ci / ci` aggregate remains for existing branch protection
until the split checks are configured directly.

Apply or update branch protection with:

```bash
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  repos/p-11/quantum-vault/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Static checks / ci",
      "Unit tests / ci",
      "Build / ci",
      "Smoke E2E / ci",
      "Security scan / ci"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
```
