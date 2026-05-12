---
name: orchestrate
description: >-
  End-to-end orchestrator for quantum-vault. Takes a Linear ticket OR a PR branch and runs the
  entire workflow: context gathering, implementation across files with parallel agents,
  build/review/fix loop, smart test generation, commit and draft PR creation. Also supports
  exhaustive PR review mode with a review agent per quality dimension.
argument-hint: '[ticket-id or PR branch/URL] [--review] [--auto]'
disable-model-invocation: true
---

# Orchestrator: End-to-End Workflow

Two operating modes:

## Mode A - Feature Delivery (default)

Takes a Linear ticket ID and handles the entire pipeline:

1. Fetch and understand the ticket
2. Parallel context gathering across `src/`, shared utilities, and `libqc` sibling SDK
3. Create the git branch
4. Plan implementation with parallelization strategy
5. Implement across files with maximum parallelism
6. Orchestrator review + integration pass
7. Build/review/fix loop until clean
8. Smart test generation (unit + E2E where applicable)
9. Commit
10. Ask user for permission to push and create the draft PR

## Mode B - PR Review (`--review`)

Takes a PR branch name or URL and performs an exhaustive audit:

1. Fetch commits, diff, changed files
2. Spawn parallel review agents across every quality dimension
3. Report findings with `file:line` references and fix suggestions
4. Optionally auto-fix and re-validate

---

## Architecture: Opus Orchestrator + Opus Reasoning Agents

Use as many parallel agents as needed. There is no artificial cap on concurrency - spawn agents aggressively for independent work streams. The goal is perfection at maximum speed. The user has unlimited resources; **default to Opus 4.6 for every agent whose work requires reasoning, judgment, bug hunting, or test design**. Fall back to the default model only for purely mechanical operations.

### Model Selection Rule

Pass `model: "opus"` (Claude Opus 4.6) to every agent in the following categories - these are the reasoning-heavy surfaces that benefit most from the stronger model:

- **Exploration** (`subagent_type: "Explore"`) when the goal is to synthesize architectural context, trace data flow, or judge pattern fit. Reserve the default model only for "find this exact string" lookups.
- **Planning** (`subagent_type: "Plan"`) - always Opus.
- **Implementation agents** building anything non-trivial: new modules, provider wiring, libqc seam code, anything touching security/lock/timeout.
- **Code review agents** (`code-reviewer`, Type Safety, Pattern Matching, Provider Architecture, Extension Security, Screen Navigation, Performance, Architecture) - always Opus.
- **Test generation** (`test-writer`): what to test, where, how to guard against regressions - always Opus.
- **Bug-finding / investigation** (`investigator`): dependency tracing and judgment calls - always Opus.
- **Refactoring** (`refactorer`): architectural judgment and safety-critical edits - always Opus.
- **Styling review** (`styling`): token usage + design token decisions - always Opus.
- **PR body writing** and **PR review synthesis** - orchestrator handles directly (already Opus).

Use the default model only for:

- Pure shell operations (git branch setup, stage + push commands)
- Running a single quality-gate command and reporting PASS/FAIL
- Mechanical scaffolding where every line is already specified by the orchestrator (see `/delegate`)

When in doubt, choose Opus. The user explicitly wants reasoning quality over token cost.

### How to spawn Opus agents

When using the `Agent` tool, pass `model: "opus"` alongside `subagent_type` and `description`:

```
Agent({
  description: "Review extension security impact",
  subagent_type: "code-reviewer",
  model: "opus",
  prompt: "..."
})
```

Project agents (`code-reviewer`, `investigator`, `refactorer`, `styling`, `test-writer`, `pr-preparer`) already declare `model: opus` in their frontmatter. The parent invocation should still pass `model: "opus"` explicitly to make the contract visible in the orchestrator log.

```
+---------------------------------------------------+
|               ORCHESTRATOR (Opus)                  |
|  Planning - Architecture - Judgment - Integration  |
|  libqc API semantics - Sync - Final review         |
+---+---------+---------+---------+---------+-------+
    |         |         |         |         |
 +--v--+   +--v--+   +--v--+   +--v--+   +--v--+
 | A   |   | B   |   | C   |   | D   |   | ... |
 | fast|   | fast|   | fast|   | fast|   | fast|
 +-----+   +-----+   +-----+   +-----+   +-----+
```

### Orchestrator Responsibilities (never delegate)

- **Planning**: decompose the ticket into work streams with dependencies
- **Architecture decisions**: which patterns, where to put code, module boundaries
- **libqc API semantics**: verify SDK field meanings and return shapes before any runtime logic
- **Provider topology**: ordering, `LibQC` instance ownership, context usage
- **Cross-cutting integration**: wire together outputs from multiple agents
- **Final review**: read every file touched by agents, fix integration issues
- **Security review**: vault lock/unlock behavior, idle timeout, secret hygiene
- **PR body writing**: requires understanding the full change

### Delegable Work (still Opus by default)

With unlimited resources, lean Opus for anything involving judgment. Delegation is about parallelism, not about cost minimization:

- **Architectural exploration** (Opus): synthesizing patterns, tracing data flow, judging pattern fit
- **Component implementation** (Opus): building UI from a precise spec - even "clear" specs hit type-safety edges
- **Hook scaffolding** (Opus): React Query composition, boundary handling, assert hooks
- **Test generation** (Opus via `test-writer`): deciding coverage, regression guards, selector stability
- **PR review dimensions** (Opus): type safety, pattern matching, provider architecture, security, performance - one Opus agent per dimension for maximum parallelism
- **Refactor passes** (Opus via `refactorer`): safety-critical changes preserving provider/navigation/security invariants

### Truly Mechanical Work (default model OK)

- **Exact string lookups** in the codebase (one grep, no synthesis needed)
- **Pure shell operations**: `git checkout`, `git add`, `git push`
- **Running a single quality-gate command** and reporting PASS/FAIL verbatim
- **Screen registry wiring** when the exact lines to add are already specified

### Worker Coordination Protocol

1. **File isolation** - each agent owns distinct files. Never two agents on the same file.
2. **Cross-agent synthesis** - when Agent A produces output Agent B needs, the orchestrator reads A's deliverables and feeds them into B's prompt. Workers never talk directly - the orchestrator is the routing layer.
3. **Quality gates with push-back** - no agent's work is marked done until deliverables are reviewed. Bad output goes back with specific fix instructions.
4. **Stall detection** - if an agent keeps failing after 2 attempts, reassess: provide specific unblocking instructions, simplify the task, or take it over directly.
5. **Convergence collapse** - when parallel agents produce overlapping concerns (shared types, cross-module imports), collapse remaining work to sequential. Parallel is for independent work; the moment dependencies emerge, go sequential.

---

## Repo Paths

| Repo          | Location (relative to quantum-vault repo root) | Default branch | Role                              |
| ------------- | ---------------------------------------------- | -------------- | --------------------------------- |
| quantum-vault | `.` (this repo)                                | `main`         | Chrome Extension (MV3)            |
| libqc         | `../libqc` (sibling checkout)                  | `main`         | Published SDK (pinned in package) |

`quantum-vault` consumes `@project-eleven/libqc` as a pinned published package (see `package.json`); the sibling `libqc` checkout is required for source-level verification and coordinated SDK changes. Breaking changes to the SDK's public surface require a new release and a matching pin bump, plus validation of extension imports and runtime flows.

## Package Manager + Commands

`pnpm` only (pinned to `pnpm@10.20.0`). Never use `yarn` or `npm`.

| Task                 | Command                                  |
| -------------------- | ---------------------------------------- |
| Install deps         | `pnpm install`                           |
| Dev server           | `pnpm dev`                               |
| Dev build            | `pnpm build:dev`                         |
| Lint check           | `pnpm l:c`                               |
| Lint fix             | `pnpm l:f`                               |
| Prettier check       | `pnpm p:c`                               |
| Prettier write       | `pnpm p:f`                               |
| Unit tests           | `pnpm test:unit`                         |
| E2E parse check      | `pnpm test:e2e:check`                    |
| E2E run (local)      | `pnpm exec playwright test`              |
| Full CI gate         | `pnpm ci:pr`                             |

`pnpm ci:pr` runs lint check, prettier check, unit tests, dev build, E2E parse check, and the `dep-doc` audit in sequence. Use it as the final pre-PR gate.

---

# Mode A: Feature Delivery

## Step 1: Fetch Ticket + Parallel Context Gathering

### 1a: Fetch ticket (orchestrator)

```
Linear MCP: get_issue({ id: "<TICKET-ID>", includeRelations: true })
```

Extract: title, description, acceptance criteria, `gitBranchName`, blockers, Figma URLs, libqc dependencies, extension-runtime concerns.

### 1b: Parallel context exploration

While the orchestrator analyzes the ticket, spawn parallel Explore agents:

- Agent A: search `src/` for related feature modules, screens, providers, hooks, shared utilities. Return file paths, existing patterns, reusable primitives.
- Agent B: search `libqc/src/` for SDK functions, types, resolvers, storage interfaces relevant to the feature. Return public API signatures and chain-dispatch points.
- Agent C: search `__tests__/e2e/` for existing test selectors and flows that touch the same surface. Return fixture data and selector patterns at risk.
- Agent D+: any additional context gathering (design refs, CLAUDE.md reference docs, prior PRs touching the same module).

Add more Explore agents as needed - there is no cap on context gathering.

### 1c: Fetch design (orchestrator, if Figma URL present)

Extract `fileKey` and `nodeId`. Map Figma variables to Tailwind v4 CSS-first tokens from `src/index.css` and existing `src/components/ui/` primitives. Never implement UI without actually retrieving the design via MCP.

### 1d: Synthesize (orchestrator)

Read all agent outputs. Produce a unified context document:

```markdown
## Existing Codebase Context
- Relevant screens/providers: [paths]
- Relevant hooks/utilities: [paths]
- Reusable components: [paths]
- libqc surface touched: [exported functions + types]
- Design tokens needed: [from Figma]
- Reference implementations: [best example files]
- E2E coverage at risk: [test files + selectors]
- Constraints: [blockers, missing libqc exports, CSP implications]
```

---

## Step 2: Git Branch Setup

Run from repo root:

```bash
git checkout main && git pull
git checkout -b {gitBranchName-from-linear}
```

If the branch already exists: `git checkout {branch} && git rebase origin/main`.

Always use the exact `gitBranchName` from Linear - do not modify it.

---

## Step 3: Plan Implementation

Synthesize the ticket, design, and exploration context into a plan. Present to the user unless `--auto`.

### Plan Template

```markdown
## Implementation Plan for <TICKET-ID>: <title>

### Work Streams

#### Stream 1: <name> [owner: fast-agent | orchestrator]
- Files: [exact paths to create or modify]
- Depends on: [other streams, or "none"]
- Description: [what to implement]
- Parallelizable with: [other stream names]

#### Stream 2: ...

### Execution Order
1. [Streams A + B + C] - parallel (no shared files)
2. [Stream D] - sequential (needs A output types)
3. [Integration] - orchestrator assembles everything

### Agent Allocation
| Stream | Owner        | Reason                              |
| ------ | ------------ | ----------------------------------- |
| ...    | fast-agent   | Mechanical: clear contract, one file|
| ...    | orchestrator | Needs judgment on libqc semantics   |
```

### Work Stream Decomposition Rules

1. **File isolation** - each agent owns distinct files
2. **Clear contracts** - each agent gets exact input types, output types, file paths
3. **No ambiguity** - full code for patterns, exact class names, exact imports
4. **Dependency ordering** - agents producing types must complete before consumers start

---

## Step 4: Parallel Implementation

Execute the plan with parallel agents. The orchestrator monitors, validates, and integrates.

### Parallelization Patterns

**Pattern A: UI + Data Layer Parallel**

```
PHASE 1 - Parallel scaffolding
├── Agent A: core.ts + types.ts for the feature module
├── Agent B: data/hooks.ts + data/mappers/
├── Agent C: UI components (one per file, from design spec)
└── Agent Explore: verify pattern consistency with existing modules

PHASE 2 - Orchestrator integration
├── Read all agent output
├── Verify libqc API semantics (NEVER delegate)
├── Wire components together, fix cross-cutting issues
└── Register in screen registry + provider tree if needed

PHASE 3 - Parallel completion
├── Agent: unit tests for pure logic
├── Agent: E2E impact check
└── Orchestrator: final review pass
```

**Pattern B: Multi-Component Feature**

```
PHASE 1 - Parallel build (one agent per independent file)
├── Agent A: components/feature/part-a.tsx
├── Agent B: components/feature/part-b.tsx
├── Agent C: hooks/use-feature.ts
└── Agent D: providers/feature-provider.tsx (if needed)

PHASE 2 - Orchestrator assembly
├── Compose parts into parent screen
├── Wire screen into registry
└── Verify type flow end-to-end
```

**Pattern C: Sequential Core + Parallel Polish**

```
PHASE 1 - Orchestrator implements core logic (tight dependencies)
PHASE 2 - Parallel completion
├── Agent: styling/tokens pass
├── Agent: quality gates
└── Agent: test scaffolding
```

### Spawning Fast Agents

**UI implementation agent prompt template:**

```
You are implementing a component for quantum-vault (Chrome Extension MV3).

PROJECT: React 19 + Vite + TypeScript, Tailwind v4 CSS-first + shadcn/ui, libqc SDK
FILE: {exact path to create or modify}

## Existing Code (reference)
{paste relevant existing patterns, types, imports, design tokens}

## What to Build
{exact spec: imports, types, component structure, exports}

## Rules (MUST follow - see .claude/rules/ and CLAUDE.md)
- `type` not `interface` (interface only for class contracts)
- No `useMemo` or `useCallback` (React Compiler handles memoization)
- No `as` assertions - use type narrowing, discriminated unions, `ensurePresent()`
- No `?.` / `??` on non-optional types - trust the type system
- No `switch/case` - use `Record<Key, Value>`, `match()`, `<Match>`, config arrays
- Never hardcode hex colors in feature components - use tokens from src/index.css
- Use `cn()` for class merging
- One component per file, feature-based organization (no generic `components/`)
- core.ts for runtime values + derived types, types.ts for pure types only
- Object params for functions with >1 arg
- Colocate state with consumers - no prop drilling

## Pattern to Follow
{paste a real example from the codebase}
```

**Shared utility or hook agent prompt template:**

```
You are implementing a pure utility/hook for quantum-vault.

FILE: {exact path}
PROJECT: TypeScript strict mode

## Existing Code (reference)
{paste relevant patterns from src/lib/ or src/hooks/}

## What to Build
{exact spec with signatures, examples, error handling}

## Rules
- `attempt()` over try-catch (only when user-facing error needed)
- `ensurePresent()` at runtime boundaries
- No side effects in mappers
- Pure functions for data transformation
- Derive types from const arrays (source of truth)
- Check shared utilities before creating new helpers

## Pattern to Follow
{paste a real example}
```

---

## Step 5: Orchestrator Review + Integration

Never skip this step. After all agents complete:

### 5a: Read every file touched by agents

Check for:

- Correct imports and type references across files
- Consistent naming between layers (`core.ts` ↔ types.ts ↔ consumers)
- No `as` assertions, no `useMemo`/`useCallback`
- Provider order preserved (CurrencyProvider -> WalletProvider -> ScreenProvider)
- `LibQC` instantiated only in `WalletProvider` (never in screens)
- No hardcoded colors outside `src/index.css`
- libqc API field semantics correct (verify against SDK source)
- Timeout/lock behavior still consistent for new authenticated screens
- No sensitive data logged (mnemonic, password, private key)

### 5b: Cross-agent integration

1. Verify type flow: libqc types -> mappers -> hooks -> component props
2. Verify screen wiring connects to the registry in `src/screens.tsx`
3. Verify provider integration (e.g., refresh list in `ScreenProvider` if balance-sensitive)
4. Fix import paths, naming mismatches, missing type exports

### 5c: Fix issues directly

Make edits to resolve integration issues. Only re-delegate if the fix is large and mechanical.

---

## Step 6: Build/Review/Fix Loop

This is a persistent loop. Do NOT stop until ALL gates pass.

```
while true:
  1. pnpm l:c                -> fix errors (pnpm l:f for auto-fixable)
  2. pnpm p:c                -> pnpm p:f to format
  3. pnpm test:unit          -> fix logic, not assertions (unless assertion is wrong)
  4. pnpm test:e2e:check     -> verify E2E tests still parse (selector stability)
  5. pnpm build:dev          -> catch Vite/TS build-only issues
  6. If any fail -> read output, fix, go to 1
  7. All pass -> break
```

Common fixes:

- ESLint unused import -> remove or switch to `import type`
- ESLint suggests import sort -> `pnpm l:f`
- TypeScript error -> fix at source. Never `as` cast. Add `ensurePresent()` at boundaries.
- Prettier whitespace -> `pnpm p:f`
- Unit test fails -> fix the code. Only edit the test when the spec actually changed.
- E2E selector broken -> either restore the selector or update `__tests__/e2e/*.test.ts` in the same PR.

### Stall Detection

If the same error keeps failing after 2 iterations:

1. Re-read the error carefully. Real issue or pre-existing?
2. Try a different fix approach.
3. If still stuck after 2 attempts, stop and surface the specific error to the user.

---

## Step 7: Smart Test Generation

After quality checks pass, evaluate what tests are needed.

### 7a: Evaluate (orchestrator)

| What was built                           | Test type                                                   |
| ---------------------------------------- | ----------------------------------------------------------- |
| Pure utility or mapper                   | Unit test (Vitest) in `__tests__/` colocated with source    |
| Hook with state                          | Hook integration test (Vitest + `renderHook`)               |
| Component with interaction               | Component integration test (Vitest + Testing Library)       |
| New user-facing screen or critical flow  | E2E test (Playwright) in `__tests__/e2e/`                   |
| libqc integration seam logic             | Unit test against a mocked `LibQC` instance                 |
| Config/types/barrel only                 | Skip - no tests needed                                      |

### 7b: Generate tests (parallel agents, one per test type)

```
Unit Test Agent    -> Vitest unit tests for pure logic. Arrange-Act-Assert.
                      Edge cases: empty, zero, BigNumber boundaries, error paths.
Integration Agent  -> Testing Library component tests with user events.
                      Assert on visible text/roles, not implementation details.
E2E Agent          -> Playwright in __tests__/e2e/*.test.ts.
                      Follow existing patterns; keep selectors/test-ids stable.
                      Mock chain RPC reads when feasible (see existing test scaffolding).
```

### 7c: Run + fix

```bash
pnpm test:unit        # fix failures - fix the code, not the test unless spec changed
pnpm test:e2e:check   # parse-check all E2E files compile and register
# Full E2E only when the flow is touched:
pnpm exec playwright test __tests__/e2e/<file>.test.ts
```

Repeat until all gates pass.

---

## Step 8: Commit

Run the full gate before any commit:

```bash
pnpm ci:pr   # or at minimum: pnpm l:c && pnpm p:c && pnpm test:unit && pnpm build:dev
```

Stage specific files - never `git add .` or `git add -A`:

```bash
git add <specific-files>
git commit -m "$(cat <<'EOF'
feat(scope): imperative description

- Detail 1
- Detail 2
- Closes P11-1234
EOF
)"
```

Conventional commits. No `Co-Authored-By` trailer.

---

## Step 9: Ask User Before Pushing + Creating PR

STOP and ask before pushing or creating the PR. Present a summary:

```markdown
## Ready to push

### Changes
- {summary of files changed}
- {summary of what was implemented}

### Branch
- `{gitBranchName}` in quantum-vault ({N} files changed)

### Quality gates
- `pnpm l:c` - pass
- `pnpm p:c` - pass
- `pnpm test:unit` - pass
- `pnpm test:e2e:check` - pass
- `pnpm build:dev` - pass

Shall I push and create a draft PR?
```

Only proceed after explicit user confirmation.

---

## Step 10: Push + Draft PR

After user confirms, push and create the PR as a draft:

```bash
git push -u origin {branch}
gh pr create --draft \
  --title "feat(scope): description (P11-1234)" \
  --body "$(cat <<'EOF'
## Summary
- What this PR does and why

## Test Plan
- [ ] `pnpm l:c` passes
- [ ] `pnpm p:c` passes
- [ ] `pnpm test:unit` passes
- [ ] `pnpm test:e2e:check` passes
- [ ] `pnpm build:dev` passes
- [ ] Extension loads unpacked from `build/`
- [ ] Lock/unlock + idle timeout verified for any authenticated screen touched

## Related
- Closes P11-1234
EOF
)"
```

### Before every `git push` + `gh pr create`

1. `git remote -v` and confirm the remote org
2. `gh auth status` and confirm the active account is authorized for the `p-11` GitHub org
3. Verify `git config user.name` and `user.email` match the expected identity for this folder

If any check fails, stop and surface the mismatch to the user.

---

## Linear Ticket Status

The GitHub-Linear integration handles status transitions automatically:

| GitHub PR event                   | Linear status change       |
| --------------------------------- | -------------------------- |
| PR created as draft               | no change                  |
| PR moved from draft -> ready      | -> In Review / In Progress |
| PR merged                         | -> Done                    |

- Always include `Closes P11-XXXX` in the PR body (links to the Linear ticket)
- Always include `(P11-XXXX)` in the PR title
- Do not call `save_issue` to change `state`
- Do not call `save_comment` just to post the PR link

Only post a Linear comment when there is meaningful context beyond the PR link (implementation decisions, open questions, deferred scope).

---

# Mode B: PR Review

## Stage 1: Gather PR Context (parallel)

- Agent A (shell): `git fetch origin && git log --oneline origin/main..HEAD`, `git diff --stat origin/main..HEAD`, full diff. Report commits + changed files.
- Agent B (explore): categorize touched domains (screens, providers, hooks, data, styling, libqc seam, tests). For each, list the relevant rules from `.claude/rules/`.

## Stage 2: Deep Review (parallel, one agent per dimension)

Spawn a review agent for EACH quality dimension across ALL changed files:

### Type Safety Agent
Check for:
- `as` assertions (forbidden - use type narrowing or discriminated unions)
- Unnecessary `?.` on non-optional properties
- `?? ''` or `?? 0` fallbacks on non-optional values
- `any` types (use `unknown` + narrow)
- Missing `ensurePresent()` at boundary lookups
- `interface` for data shapes (should be `type`)
- Derived union types from const arrays (single source of truth)
- `core.ts` vs `types.ts` split respected

### Pattern Matching Agent
Check for:
- `switch/case` (forbidden - use Record lookups, `match()`, `<Match>`, config arrays)
- Nested ternaries (>=2 levels - extract to `match()` / `<Match>`)
- Manual `if (isLoading)` instead of `<MatchQuery>`
- Non-exhaustive record lookups (should `Record<Variant, V>` not `Partial<...>` unless intentional)

### React Patterns Agent
Check for:
- `useMemo`/`useCallback` (forbidden - React Compiler)
- Multiple components per file (one per file, small helpers < 10 lines excepted)
- Prop drilling where hook-based autonomy would be clearer
- Domain components receiving domain data as props (should use hooks directly)
- Conditional hook calls (use guard components instead)

### Provider Architecture Agent
Check for:
- Provider order changes (CurrencyProvider -> WalletProvider -> ScreenProvider)
- `LibQC` instantiated outside `WalletProvider`
- Deep imports into libqc internals from app code
- Missing paired `useX` hook that throws outside provider context
- Data fetching inside a provider (providers distribute state, hooks fetch)

### Extension Security Agent
Check for:
- New authenticated screens not added to `AUTHENTICATED_SCREENS` in `useSessionTimeout`
- Lock flow not clearing wallet in-memory state
- CSP drift in `manifest.json`
- `console.log` with sensitive data (mnemonic, password, private key, raw vault)
- `.env*` files committed or referenced
- Missing `VITE_*` prefix for new env variables

### Screen Navigation Agent
Check for:
- Imperative navigation that bypasses `ScreenProvider` hydration
- New screen not registered in `src/screens.tsx`
- Missing `ScreenKey` usage (raw strings instead of registry keys)
- Balance-sensitive screen added without updating refresh list

### Styling Agent
Check for:
- Hardcoded hex colors outside `src/index.css`
- Inline font-size/weight instead of typography tokens
- `!important` overrides (fix specificity)
- Mixing ad-hoc styled components with shadcn primitives
- Popup shell width deviating from ~400px baseline

### Performance Agent
Check for:
- State not colocated with consumers (re-render blast radius)
- O(n^2) operations where O(n) works
- Redundant state that could be derived
- Unnecessary re-renders from parent prop changes
- Missing key-based remount when needed

### Code Quality Agent
Check for:
- Magic numbers/strings not extracted to named constants
- DRY violations (same value/logic repeated 2+ times)
- Missing `attempt()` where user-facing errors are handled
- Shared utilities not reused (local helper duplicates something in `src/lib/`)
- Boolean params at call sites that should be object params or split functions
- `console.log` in production paths
- Commented-out code committed

### Architecture Agent
Check for:
- Generic `components/` folder at feature level (should be feature-based)
- `hooks/` folder at module level (should be `data/hooks.ts` or colocated)
- Missing one-component-per-file rule
- `index.ts` barrel exports that re-export everything (import directly instead)
- Cross-layer leakage (e.g., UI importing from API response types directly)

### Test Impact Agent
Check for:
- `data-testid` changes that break existing E2E tests
- New user-facing flow without E2E coverage
- Timing-sensitive assertions introduced to E2E
- Unit tests that assert implementation instead of behavior

## Stage 3: Synthesize + Report (orchestrator)

1. Read every review agent's output
2. Deduplicate (multiple agents may flag the same line)
3. Prioritize: **critical** (breaks at runtime) > **important** (violates standards) > **nitpick** (style)
4. Present a structured report:

```markdown
## PR Review: {branch-name}

### Critical (must fix)
- `src/path/file.tsx:42` - {issue} -> {fix}

### Important (should fix)
- `src/path/file.ts:15` - {issue} -> {fix}

### Nitpick (consider)
- `src/path/file.tsx:88` - {issue} -> {fix}

### Summary
- {X} critical, {Y} important, {Z} nitpick findings
- Overall assessment: APPROVE | REQUEST CHANGES
```

5. If the user says "fix" or `--fix` was passed: auto-apply fixes, run `pnpm ci:pr`, re-validate.

---

# Agent Allocation Matrix

Default model is **Opus 4.6** unless the task is purely mechanical. The user has unlimited resources - choose Opus whenever reasoning, judgment, or bug-finding is involved.

| Task                                  | Owner         | Model   | Why                                                  |
| ------------------------------------- | ------------- | ------- | ---------------------------------------------------- |
| Ticket analysis + scope detection     | orchestrator  | Opus    | Requires judgment                                    |
| Codebase exploration (architectural)  | Explore agent | Opus    | Synthesize patterns, judge fit                       |
| Codebase exploration (exact lookup)   | Explore agent | default | Pure search for a known string                       |
| libqc API semantics verification      | orchestrator  | Opus    | Critical - errors cause silent bugs                  |
| Provider topology decisions           | orchestrator  | Opus    | Must preserve ordering invariants                    |
| Architecture + plan creation          | orchestrator  | Opus    | Judgment on module boundaries                        |
| Component from clear spec             | agent         | Opus    | Even "clear spec" hits edge cases at implementation  |
| Component with complex state          | orchestrator  | Opus    | Architectural judgment                               |
| Hook scaffolding from spec            | agent         | Opus    | Type safety + boundary handling                      |
| Screen registry wiring                | agent         | default | Mechanical file update                               |
| Cross-component integration           | orchestrator  | Opus    | Multi-output assembly                                |
| Quality gates (`pnpm ci:pr`)          | agent         | default | Command execution + error reporting                  |
| Quality gate fixes                    | orchestrator  | Opus    | Requires understanding why it failed                 |
| Test strategy + generation            | test-writer   | Opus    | Decide what to test, find regressions                |
| Test failure diagnosis                | orchestrator  | Opus    | Root cause analysis                                  |
| Git operations (branch, push)         | agent         | default | Mechanical commands                                  |
| PR body writing                       | orchestrator  | Opus    | Full-change understanding                            |
| PR review - type safety               | review agent  | Opus    | Judgment on narrowing and invariants                 |
| PR review - pattern matching          | review agent  | Opus    | Spot exhaustive/non-exhaustive dispatch              |
| PR review - React patterns            | review agent  | Opus    | React Compiler compliance + autonomy judgment        |
| PR review - provider architecture     | review agent  | Opus    | Provider order, `LibQC` singleton, guard boundaries  |
| PR review - extension security        | review agent  | Opus    | Lock/timeout/CSP/secret hygiene                      |
| PR review - screen navigation         | review agent  | Opus    | Registry + hydration contracts                       |
| PR review - styling                   | review agent  | Opus    | Token discipline + hardcode detection                |
| PR review - performance               | review agent  | Opus    | Re-render blast radius, state colocation             |
| PR review - code quality              | review agent  | Opus    | DRY + magic values + shared utility reuse            |
| PR review - architecture              | review agent  | Opus    | Module layout + boundary leakage                     |
| PR review - test impact               | review agent  | Opus    | Selector stability + flake risk                      |
| PR review synthesis                   | orchestrator  | Opus    | Dedup, prioritize, assess                            |
| Linear status updates                 | NEVER         | -       | GitHub-Linear integration handles this               |

---

# Synchronization Protocol

### When agents finish

1. **Read the full output** of every completed agent
2. **Validate file isolation** - confirm no agent wrote to another agent's files
3. **Check type flow** - libqc types -> mappers -> hook outputs -> component props
4. **Resolve naming conflicts** - pick one canonical name, fix every reference
5. **Merge integration points** - add imports that cross agents' files

### Context handoff between sequential agents

```
Task prompt: "...

## Context from Previous Work
File `{path}` was created with this content:
{paste the relevant code}

Your task depends on the types above. Specifically:
- Use type `{TypeName}` from `{import path}`
- The hook returns `{describe shape}`
..."
```

### When to collapse parallel to sequential

- Two agents need to modify the same file
- Agent B's implementation depends on Agent A's output type
- An agent's output reveals an architectural issue requiring replanning
- libqc API semantics ambiguous and need investigation

### Stall detection and recovery

1. Read the agent's output - identify the specific failure
2. Provide targeted fix instructions and re-delegate with more context
3. If still failing after 2 attempts, take over directly
4. Never let a stuck agent block the pipeline - route around it

---

# Decision Trees

### Should I create a new feature module?

- YES: own state/data layer, used in multiple places, significant enough to isolate
- NO: small component in an existing module, used in one place, UI-only change

### Should this be delegated to a fast agent?

```
Does the task require architectural judgment?
  YES -> orchestrator
  NO  -> Does it modify files another agent is touching?
    YES -> orchestrator (or wait)
    NO  -> Is the spec unambiguous and complete?
      YES -> fast agent
      NO  -> orchestrator writes the spec first, then delegates
```

### React Query vs provider vs local `useState`?

- Server/async data -> React Query (`useQuery`, `useSuspenseQuery`, `<MatchQuery>`)
- Cross-cutting client state -> Zustand (only when provider nesting becomes unwieldy)
- Subtree siblings sharing mutable state -> `setupStateProvider`
- Read-only computed value for a subtree -> `setupValueProvider`
- Persisted across refresh -> `usePersistentState`
- Component-only, no sharing -> `useState`
- Derived from existing state -> inline computation (no extra state)

### Custom hook vs shared utility?

- Shared utility (`src/lib/`) - pure function, no React, reusable across contexts
- Custom hook - uses React APIs (useState, useEffect, useContext), component-specific logic

### What tests are needed?

- Pure function -> unit test (highest ROI)
- Hook with state -> `renderHook` test
- Interactive component -> component test
- New user flow -> E2E test
- Config/types/barrel only -> skip

---

# Pre-Submit Gate

Before the branch is considered ready:

- [ ] Ticket fetched and understood
- [ ] Branch created from Linear `gitBranchName`
- [ ] Implementation complete (exhaustive typing + pattern matching)
- [ ] All agent output reviewed by the orchestrator before commit
- [ ] libqc API semantics verified (not delegated)
- [ ] Provider order invariants preserved
- [ ] Extension-security rules satisfied (timeout, lock, CSP, secret hygiene)
- [ ] E2E selector/label stability preserved (or tests updated in the same PR)
- [ ] `pnpm l:c` passes
- [ ] `pnpm p:c` passes
- [ ] `pnpm test:unit` passes
- [ ] `pnpm test:e2e:check` passes
- [ ] `pnpm build:dev` passes
- [ ] `pnpm ci:pr` passes (final gate)
- [ ] Conventional commit(s) created (no Co-Authored-By)
- [ ] User confirmed push + PR creation
- [ ] PR created as draft with test plan and `Closes P11-XXXX`
- [ ] All `.claude/rules/` satisfied

---

# Troubleshooting

| Problem                             | Fix                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm l:c` fails                    | Read output. `pnpm l:f` for auto-fixable. TypeScript errors -> fix at source.         |
| `pnpm p:c` fails                    | `pnpm p:f` to format touched files.                                                  |
| `pnpm test:unit` fails              | Fix the code (not the test) unless the spec changed.                                 |
| `pnpm test:e2e:check` fails         | Selector/label broke - restore selector or update E2E tests in the same PR.          |
| `pnpm build:dev` fails              | Read the Vite error. Likely a type/import boundary that ESLint missed.               |
| Branch behind main                  | `git pull --rebase origin main && git push --force-with-lease` (confirm account).    |
| Wrong git identity                  | `gh auth switch` to the account authorized for `p-11`; align `git config user.*` too. |
| libqc API mismatch                  | Inspect `../libqc/src/index.ts` (sibling checkout) and the relevant export.           |
| Agent produced wrong pattern        | Orchestrator fixes directly. Re-delegate only if the fix is large + mechanical.      |
| Agent modified the wrong file       | Revert. Re-delegate with a stricter file list.                                       |
| Parallel agents created type clash  | Orchestrator picks canonical name, updates all references.                           |
| Agent stuck / no progress           | Provide specific unblocking instructions. After 2 attempts, take over directly.      |
| Review agents disagree              | Orchestrator resolves by reading the actual code and project rules.                  |

---

# Examples

## Feature Delivery

```
/orchestrate P11-1234

Step 1: Fetch ticket -> "Add token details screen"
  ├── Parallel Explore agents:
  │   ├── src/ Explorer -> found existing screen registry + `DepositAccessGuard` pattern
  │   ├── libqc Explorer -> found `getCoinBalance` + `AccountCoin` types
  │   └── Test Explorer -> found wallet.test.ts touches similar flow, no collision
  └── Orchestrator synthesizes, no Figma URL (design is in ticket attachments)

Step 2: Create branch from Linear gitBranchName

Step 3: Plan with 3 streams
  Stream 1 (fast): core.ts + types.ts + hooks skeleton
  Stream 2 (fast): UI components (header, balance, actions)
  Stream 3 (orchestrator): screen registration + provider integration
  Streams 1+2 parallel, Stream 3 sequential after both

Step 4: Execute
  ├── Fast Agent A -> module scaffolding + hooks
  ├── Fast Agent B -> UI components
  ├── Orchestrator -> verify libqc semantics, wait for agents
  └── Orchestrator -> register screen + wire transitions

Step 5: Integration review -> fix import paths, wire MatchQuery

Step 6: Quality gates -> lint, prettier, unit, e2e:check, build:dev all PASS

Step 7: Smart test eval -> unit tests for mapper, add selector-stable test ids

Step 8-10: Commit -> ask user -> push + draft PR (with Closes P11-XXXX)
```

## PR Review

```
/orchestrate feat/token-details --review

Stage 1: Parallel context
  ├── shell: fetch diff (9 files, 2 commits)
  └── explore: categorize domains (2 providers, 3 screens, 4 components)

Stage 2: Parallel review (10 agents)
  ├── Type Safety -> 1 finding (`as Chain` at L42)
  ├── Pattern Matching -> 2 findings (nested ternary L18, switch on chain kind L67)
  ├── React Patterns -> 1 finding (`useMemo` at L12)
  ├── Provider Architecture -> 0 findings
  ├── Extension Security -> 1 critical (new authenticated screen not in AUTHENTICATED_SCREENS)
  ├── Screen Navigation -> 0 findings
  ├── Styling -> 1 finding (`#111827` at L55 - use token)
  ├── Performance -> 0 findings
  ├── Code Quality -> 1 finding (magic number `300_000` - extract)
  └── Architecture -> 0 findings

Stage 3: Orchestrator report
  1 critical, 5 important, 0 nitpick
  -> REQUEST CHANGES with fix suggestions
```

---

Run with:

- `/orchestrate P11-1234` - feature delivery
- `/orchestrate P11-1234 --auto` - skip plan confirmation
- `/orchestrate feat/my-branch --review` - exhaustive PR review
- `/orchestrate 42 --review` - PR review by number (if the harness recognizes it)
