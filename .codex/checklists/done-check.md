# Done Check - quantum-vault

1. Run `pnpm l:c && pnpm p:c`.
2. Run targeted tests when behavior changed (`pnpm test:unit` and E2E scope as needed).
3. Confirm extension security boundaries are preserved (lock/session/provider order).
4. Confirm `.codex/*` contains no token-shaped secrets.
