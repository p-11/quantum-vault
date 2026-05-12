# Extension Security Rules

Paths: `src/hooks/use-session-timeout.ts`, `src/providers/screen-provider.tsx`, `manifest.json`

## Session Timeout

- timeout policy is centralized in `useSessionTimeout`
- default inactivity lock window: 10 minutes
- reset on mouse/keyboard/touch/scroll activity

If adding authenticated screens, update `AUTHENTICATED_SCREENS` list.

## Locking Behavior

Timeout and explicit lock flows must:

1. clear wallet in-memory state
2. clear cached encryption key via vault lock path
3. navigate to lock screen

## Vault + Secret Hygiene

- never log password/mnemonic/keys
- treat zeroization TODO areas as security debt, not casual cleanup

## CSP + Environment

- maintain strict extension-page CSP
- env variables must use `VITE_*`
- do not commit `.env` files with secrets

## UX Messages

Use centralized toast/content strings where possible (for consistency and auditability).
