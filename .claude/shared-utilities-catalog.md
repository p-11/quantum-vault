# P11 Shared Utilities - Implementation Priority

Canonical reference for all utility signatures, types, and usage patterns:
**`p-11/skills` plugin** (`references/patterns.md`, `references/error-handling.md`,
`references/utilities.md`, `references/react.md`).

Install via `claude plugin install p-11/skills`. Do not duplicate signatures here.

---

## Priority Tiers (quantum-vault)

### Tier 1 - Need immediately (referenced in rules, used daily)
- `attempt`, `withFallback`, `Result<T, E> = [T, null] | [null, E]`
- `match`, `Match` component, `MatchQuery` component
- `ensurePresent` / `ensureDefined`
- `convertDuration`
- `pipe`
- Type utilities: `Defined`, `Resolver`, `Stateful`
- `setupValueProvider`, `setupStateProvider`
- `useBoolean`, `useStepNavigation`
- `Query<T,E>`, `EagerQuery<T,E>` types

### Tier 2 - Need for wallet creation redesign
- `matchRecordUnion`, `matchDiscriminatedUnion`, `MatchRecordUnion`
- `PartialMatch`
- `withInFlightCoalescer`
- `useKeyDown`, `useDebounce`
- `extractErrorMsg`, `prefixErrorWith`, `transformError`
- `isOneOf`
- `useClickGate`
- `useCombineQueries`, `useStateDependentQuery`
- Array utilities: `without`, `isEmpty`, `groupItems`
- Record utilities: `recordMap`, `pick`, `omit`

### Tier 3 - Adopt as needed
- `retry`, `asyncFallbackChain`, `chainPromises`
- `memoize`, `memoizeAsync`
- `ignorePromiseOutcome`
- `formatAmount`, `formatWalletAddress`
- Form utilities, navigation hooks
- `useStateCorrector`, `useOnClickOutside`
- Remaining array/record utilities
- Entity composable types, prop types
