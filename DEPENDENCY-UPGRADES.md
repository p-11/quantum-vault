# Upgrading a dependency

All direct dependencies are pinned to exact versions (no `^` or `~` ranges), so builds are reproducible and won't silently pull in newly published code.

## Process

1. **Find the exact version** you want. Check the npm registry or the package's release notes.

2. **Update `package.json`**: edit the version string directly, or run:
   ```bash
   pnpm add <package>@<exact-version> --ignore-scripts
   ```
   `.npmrc` has `save-exact = true`, so `pnpm add` writes a bare version, not a caret range.

3. **Regenerate the lockfile**:
   ```bash
   pnpm install --ignore-scripts
   ```

4. **Verify everything passes**:
   ```bash
   pnpm run lint && pnpm run p:c && pnpm run build:dev
   ```
   Runs ESLint, Prettier, and the extension build.

5. **Commit both files together**: `package.json` and `pnpm-lock.yaml` go in the same PR. Never commit one without the other.

6. **PR description** must say why the version was upgraded (security fix, new feature needed, API change, etc.).

## pnpm.overrides (vulnerability patches)

The `pnpm.overrides` section in `package.json` is managed separately from direct dependencies. These entries use version ranges intentionally, they match any vulnerable transitive version and force-upgrade it.

- Do not pin overrides to exact versions. A pinned override would stop catching newly introduced vulnerable transitive versions.
- Add a new override entry when a transitive vulnerability is discovered. Use the vulnerable range as the key (e.g. `"tar@<=7.5.7"`), not a pinned version.
- Remove an override entry only when the vulnerable package has been removed from the dependency tree entirely.
