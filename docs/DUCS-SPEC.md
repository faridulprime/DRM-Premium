# DRM Universal Color System (DUCS)
Version: 0.1.0 — Token foundation
Status: Initial architecture and token foundation added; component migration and contrast validation remain in progress.

## Purpose
DUCS centralizes color decisions for the DRM Premium interface. It separates raw palette values from semantic meaning and component implementation so that a color can be changed coherently without hunting through unrelated CSS files.

## Ownership boundaries
- DUCS owns color values, semantic color meaning, theme mappings, and color-related accessibility rules.
- DUSS owns dimensions, typography sizing, spacing, icon geometry, layout, and control geometry.
- DUME owns motion, timing, easing, and animation behavior.
- A component's height is a DUSS decision; its background and text colors are DUCS decisions; its transition behavior is a DUME decision.

## Architecture
`assets/colors/`
- `primitives/`: raw palette values; no component selectors.
- `semantic/`: meaning-based tokens for backgrounds, surfaces, text, borders, icons, actions, overlays, and status.
- `components/`: aliases for buttons, fields, badges, cards, dialogs, tooltips, and notifications.
- `themes/`: page/theme mappings; distinct page identities are preserved.
- `states/`: hover, active, selected, focus, disabled, and loading color states.
- `accessibility/`: contrast targets and forced-colors integration.
- `docs/`: specifications, token registry, usage and accessibility guidance.

## Token layers
1. Primitive: `--ducs-neutral-950`, `--ducs-brand-blue-400`.
2. Semantic: `--ducs-bg-canvas`, `--ducs-text-primary`, `--ducs-status-success`.
3. Component: `--ducs-button-primary-bg`, `--ducs-field-border-focus`, `--ducs-badge-success-text`.

Components should consume component or semantic tokens, never reach into the primitive palette directly unless a documented exception exists.

## Initial page mappings
The first mapping records existing visual direction without applying new styling:
- Homepage and Admin: dark neutral foundation with blue action accent.
- Live Users: near-black neutral foundation.
- Upload Studio: near-black foundation with mint accent.
- Profile: near-black foundation with green accent.

These are compatibility mappings, not a redesign or a claim that every existing CSS color has already been normalized.

## Rules
1. Do not introduce arbitrary HEX/RGB values in new component styles; add or reuse a named token.
2. Keep brand/action colors separate from success, warning, danger, and informational status colors.
3. A status must not be communicated by color alone; pair it with text, icon, or another cue.
4. Define foreground/background pairs together and test their contrast.
5. Do not use opacity as a universal disabled-state solution; define explicit state tokens.
6. Keep page-scoped exceptions documented until the owning component is migrated.
7. Do not force every page into one palette; preserve intentional page identity through theme mappings.
8. A token change must be reviewed for all consuming pages and components.

## Accessibility targets
Use WCAG 2.2 AA as the baseline: 4.5:1 for normal text, 3:1 for large text, and 3:1 for meaningful UI boundaries and graphical indicators. Visible keyboard focus is required. Test actual foreground/background pairs, including hover, disabled, selected, and error states. Forced-colors support is provided as a hook, not yet a completed full-page audit.

## Compatibility and migration
DUCS v0.1.0 adds tokens only. Existing page CSS remains authoritative; no broad color replacement is performed. Migrate one component family at a time: audit current computed colors, map them to semantic/component tokens, compare screenshots, verify contrast and interaction states, then remove obsolete literals.

## Known limitations
- Existing CSS contains many literal color values; the initial audit counted unique HEX literals per stylesheet, not a deduplicated repository-wide inventory.
- Contrast ratios have not yet been computed for every token pairing.
- Light and high-contrast theme variants are planned but not activated.
- Browser visual regression, keyboard focus, forced-colors, and color-vision simulation checks remain outstanding.
