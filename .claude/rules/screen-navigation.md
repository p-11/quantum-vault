# Screen Navigation Rules

Paths: `src/providers/screen-provider.tsx`, `src/screens.tsx`, `src/components/*-screen.tsx`

## Source Of Truth

`screens` object in `src/screens.tsx` is the registry and `ScreenKey` source of truth.

When adding a new screen:

1. create component
2. register in `screens`
3. use `ScreenKey` navigation

## Navigation Contract

Use `useScreen().navigate(screenKey, options?)`.

Options:

- `direction`: `forward | back`
- `type`: transition type (`slide` or `fade` currently)

Keep transitions coherent with existing motion patterns.

## Hydration + Entry

App entry behavior in `ScreenProvider` decides initial screen based on vault password/lock state.

Do not bypass this flow by imperatively routing in unrelated components.

## Balance Refresh Behavior

`ScreenProvider` triggers refresh on balance-sensitive screens.

If adding new balance-sensitive views, update refresh screen list deliberately.

## Screen Ownership

Screens should be self-contained and read domain hooks directly when practical (avoid deep prop drilling chains).

## Target: Typed View State

The target pattern uses a discriminated union for typed per-screen state:

```typescript
type CoreView =
  | { id: 'home' }
  | { id: 'vault-detail'; state: { assetId: string } }
  | { id: 'send'; state: { coin: CoinKey; address?: string } }
```

This gives compile-time safety for navigation state. When quantum-vault grows beyond simple screens, consider migrating `ScreenKey` to a discriminated union with typed state per screen. This eliminates runtime state shape errors.

Current `navigate(screenKey, options?)` could evolve to `navigate(view)` where `view` carries typed state.
