#!/bin/bash
# PostToolUse (Compact) hook: re-inject critical project reminders after compaction.

cat <<'REMINDER'
Context was compacted. Remember for quantum-vault:
- Package manager: pnpm only (pnpm@10.20.0). Never yarn or npm.
- Quality gate before done: pnpm l:c && pnpm p:c && pnpm test:unit (full: pnpm ci:pr)
- Provider order invariant: CurrencyProvider -> WalletProvider -> ScreenProvider
- LibQC is a singleton owned by WalletProvider (useRef). Never instantiate elsewhere.
- No switch/case, no useMemo/useCallback, no `as` assertions, no `?.`/`??` on required types
- No hardcoded hex colors outside src/index.css - use theme tokens
- No Co-Authored-By trailer on commits. Conventional commits only.
- libqc sibling SDK lives at ../libqc. Check its exports via /check-libqc before assuming.
- Skills index: .claude/AUTOMATION.md. Rules index: .claude/rules/README.md.
REMINDER

exit 0
