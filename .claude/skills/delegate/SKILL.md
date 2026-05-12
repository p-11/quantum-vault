---
name: delegate
description: >-
  Create a delegation-ready plan that can be executed by a faster, less capable model.
  Use when you want to hand off mechanical implementation to a fast agent.
argument-hint: '[task description]'
---

# Delegate

Create a plan executable by a less capable model. The goal is zero ambiguity - the delegate should not need to read any file outside the ones you cite.

## Requirements

1. **Numbered steps** - each step is one atomic action
2. **Exact file paths** - workspace-relative (e.g., `src/modules/send/core.ts`)
3. **Full code snippets** - the actual code to write, not a description of it
4. **Find/Replace blocks** - show the exact lines to find and the exact replacement
5. **No ambiguity** - pick one approach and provide the full implementation
6. **Quality gate at the end** - always finish with `pnpm l:c && pnpm p:c && pnpm test:unit`

## Format

```
## Step 1: Create `src/modules/vault-detail/core.ts`

Create the file with this content:

\`\`\`typescript
import type { ChainKind } from '@/lib/types/chain'

export const vaultDetailTabs = ['overview', 'activity', 'settings'] as const
export type VaultDetailTab = (typeof vaultDetailTabs)[number]

export const vaultDetailTabLabels: Record<VaultDetailTab, string> = {
  overview: 'Overview',
  activity: 'Activity',
  settings: 'Settings'
}
\`\`\`

## Step 2: Update `src/modules/vault-detail/page.tsx`

Find:

\`\`\`tsx
<div className="p-4">
\`\`\`

Replace with:

\`\`\`tsx
<div className="p-4 bg-surface-elevated text-text-primary">
\`\`\`

## Step 3: Quality gate

Run:

\`\`\`bash
pnpm l:c && pnpm p:c && pnpm test:unit
\`\`\`

If ESLint reports auto-fixable issues, run `pnpm l:f` and re-run the gate.
```

## Rules for the Delegate

The plan must already embed the rules the delegate has to follow. Include a "Constraints" block at the top when the delegate might need the reminder:

```
## Constraints (must not violate)
- `type` not `interface`
- No `useMemo` / `useCallback`
- No `as` assertions - use `ensurePresent()` at boundaries
- No hardcoded hex - use tokens from `src/index.css`
- One component per file
```

## Avoid

- "Add appropriate styling" -> show the actual Tailwind token classes
- "Handle edge cases" -> show the exact logic
- "Similar to X" -> paste the full reference code into the step
- "Update imports as needed" -> list the exact imports
- "Run tests" -> specify which command and how to react to failures
