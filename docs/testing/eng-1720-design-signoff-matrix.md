# ENG-1720 Design Sign-off Matrix (31:1152)

Date: 2026-04-23  
Ticket: ENG-1720  
Figma file: https://www.figma.com/design/lI9ahghN9Rl58MCaaTKxBB/Thrya-UI

## Scope

- Home + Vaults parity sweep for all 19 nodes listed in ENG-1720.
- Copy/casing/punctuation and flow-branch verification against Figma node text.

## Changes Implemented In This Branch

- Added safe-vault suggestion branch in withdraw flow (`YES` / `NO, WITHDRAW TO EXTERNAL WALLET`).
- Added source-aware review confirm CTA:
  - suggested-safe path -> `CONFIRM`
  - manual external path -> `CONFIRM WITHDRAWAL`
- Updated vulnerable activity CTA to `Withdraw to Safe Vault`.
- Updated E2E helper flow navigation to handle suggestion step before destination input.

## Matrix

| Node | Frame | Status | Evidence |
|---|---|---|---|
| `31:7140` | Home - Vaults | PASS | Home layout + section taxonomy in `src/components/home-screen.tsx` and `src/modules/vaults/shared/vault-section.tsx`. |
| `44:12930` | Home - Vaults - Alerts | BLOCKED | `Undo` CTA exists in Figma text but alert action slot is not implemented in `src/modules/vaults/shared/alert-banner.tsx`. |
| `32:1597` | Home - Vaults - Vulnerable | BLOCKED | Same `Undo` CTA gap as above for vulnerable banner state. |
| `44:12731` | Home - Vaults - Vulnerable - Activity | PASS | Vulnerable activity CTA updated to `Withdraw to Safe Vault` in `src/lib/copy.ts`. |
| `44:5123` | Home - Vaults - Safe | PASS | Safe vault detail shell/actions match implemented safe branch in `src/modules/vaults/detail/chrome.tsx`. |
| `44:13318` | Home - Vaults - Safe - Activity | PASS | Safe activity tab behavior and labels in `src/components/vault-detail-screen.tsx` + `src/modules/vaults/detail/panels.tsx`. |
| `43:4152` | Home - Vaults - Vulnerable - Pending | BLOCKED | `Undo` CTA present in Figma text; pending banner has no action control yet. |
| `44:3776` | Home - Vaults - Vulnerable - Withdrawal sent | BLOCKED | `Undo` CTA missing action slot for sent state banner. |
| `44:8676` | Home - Vaults - Safe - Withdraw - Pending | BLOCKED | `Undo` CTA missing action slot for pending banner. |
| `44:8696` | Home - Vaults - Safe - Withdraw - Withdrawal sent | BLOCKED | `Undo` CTA missing action slot for sent banner. |
| `39:31491` | Home - Vaults - Withdraw - Suggestion | PASS | Suggestion step added in `src/components/vault-withdraw-screen.tsx` (`withdraw-suggestion-step`). |
| `44:8786` | Home - Vaults - Safe - Withdraw | PASS | Warning step copy/structure in `src/components/vault-withdraw-screen.tsx`. |
| `41:3340` | Home - Vaults - Withdraw - Suggestion - YES | PASS | Suggested-safe review path now uses `CONFIRM` label via source-aware mapping in `src/components/vault-withdraw-screen.tsx`. |
| `44:8601` | Home - Vaults - Safe - Withdraw - Yes | PASS | Manual-address review path keeps `CONFIRM WITHDRAWAL` in `src/components/vault-withdraw-screen.tsx`. |
| `41:3371` | Home - Vaults - Withdraw - Suggestion - NO | PASS | NO branch routes to external destination step in `src/components/vault-withdraw-screen.tsx`. |
| `44:8821` | Home - Vaults - Safe - Withdraw - Add | PASS | Add-address screen copy and controls in `src/components/vault-withdraw-screen.tsx`. |
| `44:8909` | Home - Vaults - Safe - Deposit | PASS | Deposit receive screen copy and vault address block in `src/components/receive-screen.tsx`. |
| `44:8962` | Home - Vaults - Withdraw - Funds | BLOCKED | Funds state includes Figma `Undo` copy not yet represented in banner actions. |
| `44:12442` | Home - Vaults - Withdraw - Activity | BLOCKED | Activity state includes Figma `Undo` copy not yet represented in banner actions. |

## Validation Log

- `pnpm l:c` PASS
- `pnpm p:c` PASS
- `pnpm test:unit` PASS
- `pnpm playwright test __tests__/e2e/flows/withdraw-flows.test.ts --project=flows` FAIL (test environment bootstrap timeout before flow interaction in `createWalletAndOpenHome`)

## Remaining Sign-off Blocker

- Implement and approve `Undo` banner action semantics (design/product + backend behavior), then re-run the 19-node matrix with screenshot proof.
