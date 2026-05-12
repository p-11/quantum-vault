# CLAUDE.md - quantum-vault

## What This Repo Is

`quantum-vault` is the Project Eleven Chrome extension wallet UI.

Stack:

- React 19 + Vite
- Manifest V3 extension runtime
- Tailwind v4 + shadcn/ui (New York style)
- `@project-eleven/libqc` as a pinned published SDK dependency

## Rule Discovery

All sessions must load and follow both local and global rules.

1. `AGENTS.md`
2. `CLAUDE.md`
3. `.claude/rules/README.md`
4. `.claude/rules/*.md`
5. Global baseline from `~/.claude/CLAUDE.md` + `~/.claude/rules/*.md`

## Package Manager

- Always use `pnpm` (`pnpm@10.20.0`)
- Never use `yarn` or `npm`

## Commands

### Development

- `pnpm dev` - Vite dev mode
- `pnpm build:dev` - extension build to `build/`

### Quality

- `pnpm l:c` - ESLint check
- `pnpm l:f` - ESLint fix
- `pnpm p:c` - Prettier check
- `pnpm p:f` - Prettier fix

### Other

- `pnpm preview` - Vite preview

## App + Runtime Shape

- Extension popup container is fixed at ~`400px` width (`src/App.tsx`)
- `manifest.json` uses strict CSP for extension pages
- Build output is loaded as unpacked extension from `build/`

## Provider Topology

Provider order is architecture-critical:

1. `CurrencyProvider`
2. `WalletProvider`
3. `ScreenProvider`

`WalletProvider` owns a single `LibQC` instance via `useRef`. Do not instantiate `LibQC` inside screen components.

## Screen Navigation Model

- Navigation is view/screen registry based (`src/screens.tsx`)
- `ScreenKey` is derived from `screens` object
- Transition contract uses `navigate(screenKey, { direction, type })`
- Motion defaults + variants handled in `ScreenProvider` + `AnimateScreen`
- Balance refresh is event-driven. For balance-sensitive screens, ensure query keys are session-scoped and refreshed via `invalidateWalletQueriesForSession` after state mutations.

## Security Model

- Idle timeout lock is centralized in `useSessionTimeout`
- Authenticated screen list controls timeout enforcement
- Lock flow must clear wallet in-memory state and navigate to lock screen
- Environment variables must use `VITE_*` prefix
- Never commit `.env` files with secrets

## libqc Integration

`src/providers/wallet-provider.tsx` is the integration seam for:

- chain definitions
- bundler config provider
- vault lifecycle wiring
- account/balance refresh orchestration

Do not duplicate chain/bundler configuration in random UI files.
Do not replace `@project-eleven/libqc` with `file:`, `link:`, or `workspace:` dependencies in this repository.

## Styling System

- Tailwind v4 CSS-first via `src/index.css` (`@theme inline`)
- Semantic CSS variables for brand tokens
- Use `cn()` utility (cva + clsx + tailwind-merge)
- Geist fonts are bundled locally

## Test Surface

- Playwright E2E: `__tests__/e2e/wallet.test.ts`
- Keep test selectors/labels stable for existing user-journey coverage
- Keep test behavior deterministic and avoid timing-sensitive flake
- Add focused utility tests when changing isolated helper logic

## Compact Instructions

Keep during compact:

- screen flow touched + navigation impact
- provider/API boundary changes
- timeout/lock/security behavior impact
- libqc API assumptions
- E2E coverage updated or intentionally deferred
