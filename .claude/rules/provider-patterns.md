# Provider Patterns

Paths: `src/providers/*.tsx`, `src/hooks/use-*.ts`

## Provider Order

Required order:

- `CurrencyProvider`
- `WalletProvider`
- `ScreenProvider`

Changing order can break initialization, navigation, and timeout behavior.

## WalletProvider

`WalletProvider` owns:

- single `LibQC` instance (`useRef`)
- wallet/account/asset/balance state
- libqc operations exposed as context methods
- refresh deduplication behavior keyed by currency

Do not instantiate additional `LibQC` instances in screen components.

## CurrencyProvider

- owns selected currency and persistence
- exposes simple context (`currency`, setter, loading)

## ScreenProvider

- owns active screen, transition options, and hydration entry flow
- integrates session timeout behavior

## Hook Convention

Each provider has paired `useX` hook that throws outside provider context.

Preserve explicit provider-missing errors for developer clarity.

## Known Debt Zone

Some provider/screen files intentionally use callback/memo patterns today.

Do not perform broad memoization architecture rewrites without ticket scope.

## Target: Provider Factory Pattern

The `setupValueProvider<T>()` and `setupStateProvider<T>()` factory pattern returns `[Provider, useHook]` tuples (see p11-provider-factories.md). This eliminates boilerplate and enforces consistent fail-fast behavior.

CurrencyProvider is the simplest migration candidate (basic value + setter). WalletProvider is too complex for the factory (owns LibQC ref + many domain methods). Do not migrate without dedicated ticket.
