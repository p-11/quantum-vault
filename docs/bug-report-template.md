# Bug Report Template

Use this template when filing a Quantum Vault bug in Linear.

**Before filing:**
1. Run `pnpm qa:prep` to get a clean, deterministic build, then retest.
2. Run `pnpm run diagnostics:runtime` and paste the full JSON output into the Diagnostics field below.

---

## Report

**Quantum Vault commit**
(from diagnostics: `git.commitShort`)

**libqc version**
(from diagnostics: `libqc.installedVersion`)

**Build / run path**
<!-- Choose one:
- pnpm dev (HMR dev server)
- pnpm build:dev (local dev build to build/)
- pnpm build:prod (local prod build to dist/)
- pnpm qa:prep (clean install + dev build, recommended for QA)
- GitHub prerelease zip from main
-->

**Environment**
OS and Chrome version, e.g. macOS 15.4, Chrome 136.0.x

**Summary**
One-line description of the failure.

**Reproduction steps**
1.
2.
3.

**Actual result**
What happened.

**Expected result**
What should have happened.

**Deterministic?**
<!-- Choose one: Always / Sometimes (flaky) / Once, not reproduced / Unknown -->

**Expected outcome after fix**
What a correct fix looks like. Include measurable deltas where applicable, e.g. gas cost should decrease from X to Y, or balance displayed should match on-chain value.

**Diagnostics**
```json
<paste pnpm run diagnostics:runtime output here>
```

The diagnostics JSON includes the quantum-vault commit SHA, libqc version, env source files, and RPC/bundler hostnames (API keys redacted). This is the primary signal for environment mismatches.

---

## Parity checklist

- [ ] Reset extension state before reproducing (chrome://extensions, Remove and re-add, or use the reset flow in the extension)
- [ ] Not using a local `file:` / `link:` / `workspace:` libqc override
- [ ] Reproduced on the build / artifact listed above
