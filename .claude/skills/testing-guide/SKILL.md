---
name: testing-guide
description: >-
  Testing reference for quantum-vault: unit (Vitest), component integration (Vitest +
  Testing Library), and end-to-end (Playwright). Describes what to test, where, how to
  keep selectors stable, and how to run each layer.
---

# Testing Guide

## Decision Tree

```
Pure function (mapper, util, core logic)?
  -> UNIT TEST (Vitest)

Hook composing queries or state?
  -> HOOK TEST (Vitest + renderHook)

Component with user interaction?
  -> COMPONENT TEST (Vitest + Testing Library)

New user-facing screen or critical flow?
  -> E2E TEST (Playwright)

Styled component with no logic?
  -> SKIP (no tests needed)
```

### When to skip

- Pure UI components with zero logic (just prop rendering)
- Config files, type-only files, barrel exports
- Changes under ~5 lines that modify existing tested behavior (extend an existing test instead)

## Running Tests

```bash
pnpm test:unit                                           # Vitest - unit + integration, run once
pnpm test:unit:watch                                     # Vitest - watch mode
pnpm test:e2e:check                                      # Playwright - parse + list tests
pnpm exec playwright test                                # Playwright - run everything
pnpm exec playwright test __tests__/e2e/wallet.test.ts   # Playwright - one file
```

`pnpm ci:pr` runs lint, prettier, `test:unit`, `build:dev`, `test:e2e:check`, and the `dep-doc` audit as the final PR gate.

---

## Unit Tests

### What to Test

- **Mappers** - API or libqc response transformations
- **Utilities** - pure functions in `src/lib/`
- **Core logic** - business rules, BigNumber / `big.js` math, formatting
- **Validation** - schema edge cases and error paths
- **Reducers and pure resolvers** - Record-driven dispatch tables

### Structure

```typescript
import { describe, expect, it } from 'vitest'

import { formatWalletAddress } from './format-wallet-address'

describe('formatWalletAddress', () => {
  it('truncates the middle with default start and end lengths', () => {
    const result = formatWalletAddress(
      '0xabcdef1234567890abcdef1234567890abcdef12'
    )
    expect(result).toBe('0xabcd...ef12')
  })

  it('respects custom start and end lengths', () => {
    const result = formatWalletAddress(
      '0xabcdef1234567890abcdef1234567890abcdef12',
      { start: 8, end: 6 }
    )
    expect(result).toBe('0xabcdef1...cdef12')
  })
})
```

### Principles

- Arrange-Act-Assert
- Assert on the observable result, not internal state
- Cover edge cases: empty, zero, boundary conditions, error paths
- Use factory helpers for test data (colocated in `__tests__/factories/`)
- Never mock pure functions - they are the thing you are testing

---

## Hook Tests

Use `renderHook` from `@testing-library/react`. Wrap providers explicitly in a test-only wrapper:

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TestProviders } from '../../__tests__/providers'

import { useCoinBalance } from './use-coin-balance'

describe('useCoinBalance', () => {
  it('resolves with a formatted balance', async () => {
    const { result } = renderHook(() => useCoinBalance(mockCoin), {
      wrapper: TestProviders
    })

    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data).toEqual({ formatted: '1.2345', raw: 1234500n })
  })
})
```

Principles:

- Test the public hook contract, not the implementation
- Trigger realistic consumer behavior (loading -> success, loading -> error)
- Mock libqc at the seam (a thin test double of the functions you use), never via deep-import spies

---

## Component Tests

Use `@testing-library/react` with user-event. Query by role and name when possible, fall back to `data-testid` for purely visual nodes.

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { TestProviders } from '../../__tests__/providers'
import { SendAmountInput } from './send-amount-input'

describe('<SendAmountInput />', () => {
  it('calls onChange with the typed value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SendAmountInput value="" onChange={onChange} />, { wrapper: TestProviders })

    await user.type(screen.getByLabelText('Amount'), '1.23')

    expect(onChange).toHaveBeenLastCalledWith('1.23')
  })
})
```

Principles:

- Assert on text/role users see, not on CSS classes
- Use `data-testid` only for visual-only elements (icons, spacers)
- Keep assertions behavior-focused (disabled? visible? correct text?)
- Prefer `waitFor` over fixed `setTimeout`

---

## End-to-End Tests

E2E runs against a built extension via Playwright. Tests live in `__tests__/e2e/`.

### Running

```bash
pnpm exec playwright test                                  # all specs
pnpm exec playwright test __tests__/e2e/wallet.test.ts     # one spec
pnpm test:e2e:check                                        # verify specs parse (CI gate)
```

### Structure

Follow the pattern in `__tests__/e2e/wallet.test.ts`. Shared helpers belong in `__tests__/test-utils.ts`.

### Selector Stability Rules

- Preserve existing `data-testid` values and visible labels that tests rely on
- If a label or testid must change, update the E2E test in the same PR
- Prefer visible text or role-based assertions over CSS selectors
- Never assert on computed styles from E2E - inspect the DOM state instead

### Determinism

- Avoid fixed `setTimeout` and animation-length waits - use Playwright auto-waiting and state assertions
- Mock chain RPC reads when the test does not need real network behavior (see existing test scaffolding)
- Tests must be independent - no shared mutable state between specs

---

## What to Test Matrix

| What was built                          | Test type                                                 |
| --------------------------------------- | --------------------------------------------------------- |
| Pure utility / mapper                   | Unit (Vitest)                                             |
| `big.js` calculation                    | Unit with edge cases (zero, negative, overflow)           |
| Custom hook with state                  | Hook (`renderHook`)                                       |
| Interactive component                   | Component (Testing Library)                               |
| New screen or critical flow             | E2E (Playwright)                                          |
| libqc integration seam                  | Unit against a mock of `LibQC`                            |
| Config / types / barrel                 | Skip                                                      |

## Rules

- Fix the code, not the test (unless the spec genuinely changed)
- Test behavior, not implementation
- Keep tests focused - one intent per `it` block
- Tests must be deterministic - no flaky timing, no real network unless E2E
- Do not assert on framework or library internals
- Reset any shared state between tests (factories + fresh providers)
