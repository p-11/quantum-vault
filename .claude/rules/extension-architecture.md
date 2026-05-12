# Extension Architecture

Key files: `manifest.json`, `vite.config.ts`, `src/App.tsx`, `src/main.tsx`

## Runtime Model

- Chrome Extension Manifest V3 popup app
- Popup lifecycle is ephemeral; in-memory state dies when popup closes
- Durable wallet state must come from storage through `libqc`/providers

## Permissions + CSP

- Current manifest permission scope is minimal (`storage`)
- Maintain strict extension-page CSP (`script-src 'self'`)

## Build + Load

- Build output target: `build/`
- Static assets copied via `vite-plugin-static-copy`
- Load extension as unpacked from `build/`

## Shell Constraints

Popup container intentionally constrained to ~`400px` width.

Do not alter shell dimensions/layout baseline without design/product alignment.
