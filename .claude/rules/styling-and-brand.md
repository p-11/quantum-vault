# Styling + Brand Rules

Paths: `src/index.css`, `src/components/ui/*.tsx`

## Tailwind Configuration

Tailwind v4 uses CSS-first config in `src/index.css` (`@theme inline`).

Do not introduce `tailwind.config.js` unless explicitly migrating architecture.

## Token Usage

- Prefer semantic CSS variables/tokens
- Avoid hardcoded hex colors in feature components
- Palette source of truth is in `src/index.css`

## shadcn/ui Conventions

- Style system: New York variant
- utility composition via `cn()` (`clsx` + `tailwind-merge`)
- reuse existing UI primitives before creating ad-hoc base components

## Typography + Icons

- Geist family from local font assets
- Lucide React for icons

## Popup Constraints

- maintain `400px` shell width
- preserve shared `Screen` baseline spacing/min-height behavior
