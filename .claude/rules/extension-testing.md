# Extension Testing Rules

Paths: `__tests__/e2e/*.ts`, `__tests__/test-utils.ts`

## Current Strategy

Primary automated coverage is Playwright E2E user journeys.

Critical flows:

- wallet creation
- lock/unlock
- account switching/navigation
- receive/deposit interactions

## Selector Stability

Preserve existing `data-testid` and stable visible labels used by tests.

If changing labels/selectors in core flows, update E2E tests in same PR.

## Utility Testing

For isolated logic (formatting/currency/helpers), add focused tests where possible, especially around TODO-marked areas.

## Determinism

Avoid introducing timing-sensitive UI behavior that makes E2E flaky.

Keep transitions and async waits test-friendly.
