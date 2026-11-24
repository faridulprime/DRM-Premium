# DRM Universal Color System (DUCS)
Version: 0.2.7 — Admin dashboard and login color migration
Status: Token foundation, page mappings, per-file source inventory, dependency registry, component alias modules, shared shell aliases, and a first Live Users surface/field/status/dialog migration are in place. Live Users and Admin component migrations are partial; broader component migration and full contrast validation remain in progress.

## Purpose
DUCS centralizes color decisions for DRM Premium. It separates raw palette values from semantic meaning and component implementation so color changes can be reviewed across their dependencies.

## Ownership boundaries
- DUCS owns color values, semantic color meaning, theme mappings, and color-related accessibility rules.
- DUSS owns dimensions, typography sizing, spacing, icon geometry, layout, and control geometry.
- DUME owns motion, timing, easing, and animation behavior.
- A component's height is a DUSS decision; its background and text colors are DUCS decisions; its transition behavior is a DUME decision.

## Architecture
`assets/colors/`
- `primitives/`: raw palette values; no component selectors.
- `semantic/`: meaning-based tokens for backgrounds, surfaces, text, borders, icons, actions, overlays, and status.
- `components/`: component color aliases for buttons, fields, badges, surfaces, and feedback.
- `themes/`: page/theme mappings; distinct page identities are preserved.
- `states/`: hover, active, selected, focus, disabled, and loading color states.
- `accessibility/`: contrast targets and forced-colors integration.
- `docs/`: specifications, token registry, usage and accessibility guidance, source inventory, and dependency registry.

## Token layers
1. Primitive: `--ducs-neutral-950`, `--ducs-brand-blue-400`.
2. Semantic: `--ducs-bg-canvas`, `--ducs-text-primary`, `--ducs-status-success`.
3. Component: `--ducs-button-primary-bg`, `--ducs-field-border-focus`, `--ducs-badge-success-text`.

Components should consume component or semantic tokens, never reach into the primitive palette directly unless a documented exception exists.

## Source audit and dependency tracking
A per-stylesheet source inventory and dependency map are maintained in `DUCS-COLOR-INVENTORY.md` and `DUCS-COLOR-DEPENDENCY-REGISTRY.md`. Counts are distinct literal HEX and RGB(A) expressions per file, not a deduplicated runtime color count.

## Initial page mappings
The mapping records existing page identity:
- Homepage and Admin: dark neutral foundation with blue action accent.
- Live Users: near-black neutral foundation with green online and red restriction states.
- Upload Studio: near-black foundation with mint and violet creative accents.
- Profile: near-black foundation with green accent and status.

These are compatibility mappings, not a redesign or a claim that every existing CSS color has been normalized.

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
Component aliases are split into focused files under `components/`. The Live Users and Admin pages now consume dedicated DUCS aliases for its page/panel surfaces, search field states, selected hover surfaces, drawer/dialog gradients and surfaces, role/restriction states, dialog backdrop and close control, warning/danger action states, activity-chart bars, overlay, and notice colors. These aliases preserve the exact prior CSS values; this is a source migration, not a visual redesign.

The initial shared shell migration replaces the legacy root aliases in `theme.css` with DUCS semantic references. Those referenced semantic tokens resolve to the same original shell values. The remaining component CSS is still authoritative. Migrate one component family at a time: audit, map, compare rendered states, verify contrast, then remove obsolete literals.

## Known limitations
- The Live Users and Admin migrations are intentionally partial; numerous decorative, typography, shadow, and ancillary micro-state colors remain literal. Activity-chart track and bar colors plus key dialog/action colors now use DUCS aliases. Admin dashboard buttons, fields, data rows, overview cards/metrics, progress indicators, activity markers, owner badge, feedback states, and login controls now consume page-scoped DUCS aliases.
- Existing CSS contains many literal color values; the initial audit counted unique HEX and RGB(A) literals per stylesheet, not a deduplicated repository-wide inventory.
- Contrast ratios have not been computed for every token pairing.
- Light and high-contrast theme variants are planned but not activated.
- Browser visual regression, keyboard focus, forced-colors, and color-vision simulation checks remain outstanding.
