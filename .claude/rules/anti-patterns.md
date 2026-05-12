# Anti-Patterns

## Core

1. Never use `switch/case` for domain branching. Use `match()` or `Record<Key, Value>`.
2. Never use broad `try/catch` for flow control. Use `attempt()` when fallback behavior is required.
3. Never use `as` type assertions unless a validated boundary makes it unavoidable.
4. Never use `?.` or `??` on non-optional types. Trust types and use `ensurePresent()` at runtime boundaries.
5. Never leave hardcoded magic values in feature logic. Use named constants or duration helpers.
6. Never add `useMemo`/`useCallback` by default. React Compiler is the default optimization path.

## quantum-vault Specific

7. Never hardcode hex colors in feature components. Use theme tokens from `src/index.css`.
8. Never implement manual query loading/error branching in query UI where `MatchQuery` is available.
9. Never introduce generic feature-level `components/` folders that break feature-based structure.
10. Never alter provider order (`CurrencyProvider -> WalletProvider -> ScreenProvider`) without explicit architecture scope.
11. Never add silent early returns in user-action handlers when user feedback is expected.
12. Never bypass `ScreenProvider` hydration flow for initial routing.
13. Never use `min-h-(--popup-content-height)` or `mt-auto` button footers in popup screen flows. Use an outer `flex flex-col justify-between` container with a dedicated footer region so CTA groups stay pinned inside the popup height.
14. Never auto-forward Home -> Deposit into a chain-specific receive screen via account-count fallbacks. Home-origin deposit must always show the network selector first; only explicit user network selection can open the QR/address screen.

## E2E / CI Stability

15. Never start a CI fix from a detached `HEAD` or the wrong branch. Confirm the exact PR head ref before editing or pushing.
16. Never treat a non-CI-parity local E2E environment as authoritative. If RPC/runtime behavior differs from CI, call that out and avoid over-trusting local green runs.
17. Never model serial Playwright teardown as a fixed number of back-clicks. Teardown helpers must navigate to and assert a named stable state.
18. Never use unscoped shared selectors in animated flows. When multiple instances can be mounted, target the visible or state-scoped element explicitly.
19. Never let a serial E2E block inherit implicit state from prior cleanup. Each `beforeAll` and `afterAll` should assert its expected entry or exit screen.
20. Never respond to a flaky UI flow by only adding waits or timeouts before checking whether the state-machine assumption is wrong.
21. Never replay repeated spec edits across diverged branches without an immediate syntax/lint pass. Catch duplicate helpers and conflict leftovers before pushing.
