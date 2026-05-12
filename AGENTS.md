# AGENTS.md - quantum-vault

Chrome Manifest V3 extension wallet UI for Project Eleven.

Stack: React 19 + Vite + Tailwind v4 + shadcn/ui (New York) + pinned published `@project-eleven/libqc` dependency.

## Instruction Sources

These instructions are shared across Claude and Codex:

- `AGENTS.md` - Codex-facing repository contract
- `CLAUDE.md` - project-level Claude contract
- `.claude/rules/README.md` - rule index and loading order
- `.claude/rules/*.md` - detailed domain rules (architecture, security, testing, providers, navigation, styling)
- Global baseline at `~/.claude/CLAUDE.md` and `~/.claude/rules/*.md`

## Cross-Repo Context

This extension depends on the published `@project-eleven/libqc` version pinned in `package.json`.
Only import from `@project-eleven/libqc`. Never import deep internals.
For QA/release parity in this repo, do not switch the dependency to `file:`, `link:`, or `workspace:` sources.
If a newer `libqc` export is needed, publish/update the package version and bump the pinned dependency here.

## Boundaries

- **Provider order** (CRITICAL): `CurrencyProvider` -> `WalletProvider` -> `ScreenProvider`
- **libqc integration seam**: `src/providers/wallet-provider.tsx`
- **Screen registry**: `src/screens.tsx` - `ScreenKey` derived from `screens` object
- **Session timeout**: `src/hooks/use-session-timeout.ts` - centralized idle lock

## Security-First Areas

Treat as high-risk (extra review depth required):

- `src/hooks/use-session-timeout.ts` - idle lock policy (10 min, reset on mouse/keyboard/touch/scroll)
- `src/providers/wallet-provider.tsx` - LibQC integration seam
- `manifest.json` - CSP (`script-src 'self'`), extension permissions

Lock flow must: clear in-memory state -> clear cached key -> navigate to lock screen.

Never log: mnemonic, password, private keys, raw encrypted vault data. Env vars must use `VITE_*` prefix. Never commit `.env` files with secrets.

## Architecture

### Runtime Model

- Popup lifecycle is ephemeral - in-memory state dies when popup closes
- Durable state comes through `libqc` storage + providers
- Build output: `build/` loaded as unpacked extension
- Fixed popup width: ~400px

### Provider Topology

```
CurrencyProvider   (currency selection + persistence)
  WalletProvider   (LibQC ref + wallet/account/balance state)
    ScreenProvider (screen key + navigation + timeout integration)
```

`WalletProvider` owns a single `LibQC` instance via `useRef`. Never instantiate additional `LibQC` instances in screen components.

### Screen Navigation

- Registry: `screens` object in `src/screens.tsx`
- Navigate: `useScreen().navigate(screenKey, { direction, type })`
- Hydration: `ScreenProvider` decides initial screen from vault state
- Do not bypass hydration flow
- `AUTHENTICATED_SCREENS` list controls timeout enforcement
- Balance refresh is event-driven. For balance-sensitive screens, keep query keys session-scoped and refresh via `invalidateWalletQueriesForSession` after state mutations.

## Styling

- Tailwind v4 CSS-first config in `src/index.css` (`@theme inline`)
- Semantic CSS variables for brand tokens
- `cn()` utility (clsx + tailwind-merge)
- shadcn/ui New York variant
- Geist fonts (bundled locally), Lucide React icons
- Never hardcode hex colors - use theme tokens

## Commands

```bash
pnpm dev           # Vite dev server
pnpm build:dev     # build to build/
pnpm l:c           # ESLint check
pnpm l:f           # ESLint fix
pnpm p:c           # Prettier check
pnpm p:f           # Prettier fix
pnpm preview       # Vite preview
```

Mandatory after changes: `pnpm l:c && pnpm p:c`

## Testing

- Playwright E2E: `__tests__/e2e/wallet.test.ts`
- Critical flows: wallet creation, lock/unlock, account switching, receive/deposit
- Keep `data-testid` and visible labels stable
- Update E2E tests in same PR when changing selectors
- Keep tests deterministic; avoid timing-sensitive UI behavior that introduces flakiness
- Add focused utility tests when changing isolated helpers/formatters

## Git

Conventional commits: `type(scope): description`. No `Co-Authored-By`. Package manager: `pnpm` only (never yarn or npm).

## Workflow

1. Discover architecture boundary touched
2. Implement scoped changes
3. Run `pnpm l:c && pnpm p:c`
4. Self-audit against `.claude/rules/anti-patterns.md`
5. Verify cross-repo compatibility if consuming changed libqc exports
6. Conventional commit (no Co-Authored-By)
