# DRM Universal Color System (DUCS)
Version: 0.3.2 — explicit contrast candidate audit and text-token remediation
Status: Token foundation, page mappings, source inventory, dependency registry and component aliases are in place. First-pass component migrations exist across all five pages. Chromium validates token loading and representative semantic contrast pairings. A source-level audit covers 98 explicit foreground/background candidates; seven text-token values were remediated and five non-text boundary candidates remain under contextual review. Residual literal cleanup, computed-style contrast coverage and theme/forced-colors validation remain pending.

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
Component aliases are split into focused files under `components/`. The Live Users, Admin, Profile, and Upload Studio pages now consume dedicated DUCS aliases for its page/panel surfaces, search field states, selected hover surfaces, drawer/dialog gradients and surfaces, role/restriction states, dialog backdrop and close control, warning/danger action states, activity-chart bars, overlay, and notice colors. These aliases preserve the exact prior CSS values; this is a source migration, not a visual redesign.

The initial shared shell migration replaces the legacy root aliases in `theme.css` with DUCS semantic references. Those referenced semantic tokens resolve to the same original shell values. The remaining component CSS is still authoritative. Migrate one component family at a time: audit, map, compare rendered states, verify contrast, then remove obsolete literals.

## Known limitations
- The Live Users, Admin, Profile, and Upload Studio migrations are intentionally partial; numerous decorative, typography, shadow, dormant base declarations, and ancillary micro-state colors remain literal. Live Users page chrome and account drawer/dialog text roles now consume component aliases, while smoke-effect gradients remain deliberate decorative literals. Activity-chart track and bar colors plus key dialog/action colors now use DUCS aliases. Admin dashboard buttons, fields, data rows, overview cards/metrics, progress indicators, activity markers, owner badge, feedback states, and login controls now consume page-scoped DUCS aliases.
- Existing CSS still contains literal color values, including dormant base rules, decorative treatments, and unmigrated homepage components. The source inventory counts unique HEX and RGB(A) literals per stylesheet; it is not a computed-style audit.
- Contrast ratios have not been computed for every token pairing.
- Light and high-contrast theme variants are planned but not activated.
- Browser visual regression, keyboard focus, forced-colors, and color-vision simulation checks remain outstanding.

## Source validation snapshot — 2026-11-25

- Token modules declare 518 DUCS custom properties across the audited component and foundation files.
- Six page/shared stylesheets contain 368 unique DUCS token references; the reference scan found zero undefined DUCS references.
- CSS brace-balance checks passed for the six consumer stylesheets and the audited DUCS token modules.
- The source inventory remains partial: unique literal HEX and rgb()/rgba() counts are recorded in `DUCS-COLOR-INVENTORY.md`. These literals are not automatically defects; each requires context-aware review before migration.
- This is static source validation only. It does not establish runtime cascade correctness, rendered contrast, responsive behavior, or visual equivalence.

## Browser validation update — 2026-11-25

- GitHub Actions browser audit run #4 passed on commit `f0663e0d276d778da2c1ee96dc7cfa2655c00503`: [run #4](https://github.com/faridulprime/DRM-Premium/actions/runs/45617602710).
- Chromium rendered Homepage, Admin, Live Users, Upload Studio and Profile at seven viewport widths: 1440, 900, 390, 320, 720 (200%-zoom layout-width proxy), 760 and 761 CSS px. All 35 page/viewport checks passed.
- Verified DUSS/DUPS/DUCS stylesheet and semantic-token loading, horizontal overflow, zero-geometry visible controls, first keyboard focus visibility, and representative DUCS contrast pairings (primary text/canvas, secondary text/canvas, action/canvas, border/canvas).
- DUME mobile drawer open/close and cleanup passed on Homepage, Admin, Live Users and Upload Studio under both normal and reduced-motion preferences; the 760/761px desktop/mobile boundary passed. The run exposed and led to correction of an Admin mobile-menu toggle state bug.
- DUPS computed header stacking values are checked against the page-header, Homepage mobile-header, and Live Users header layer tokens for the applicable pages and widths.
- The audit reports, but does not fail on, interactive targets smaller than 44px. Several remain and need a deliberate DUSS touch-target review; the visible logo links are included in this observation. No blanket size increase was made.
- Scope is local static-site rendering, not deployed Cloudflare Pages or Pages Functions. No D1, authentication, edge, or Production behavior is exercised. The 720px case is not native browser zoom. This is not a full WCAG certification or visual/optical approval.

## Browser contrast sample acceptance — 2026-11-25

Browser audit run #11 passed on commit `c423ea1fe0e35459d279f40bf444afa69fcd4c53`: [run #11](https://github.com/faridulprime/DRM-Premium/actions/runs/45620765803). It parses and checks representative semantic foreground/background pairs for primary text, secondary text, action color and border against the canvas on the five principal pages across seven viewport widths.

This is a representative sample, not a full DUCS contrast audit. It does not measure every component/state pair, overlays, gradients, image-backed text, light/high-contrast themes, forced-colors, or color-vision simulation. Do not treat the run as complete WCAG conformance.

## Explicit contrast audit and first remediation — 2026-11-25

The registered source-level contrast review is maintained in `DUCS-CONTRAST-REVIEW.md`. Its 98 explicit token pairs are diagnostic candidates, not a complete selector/runtime inventory. Seven text-role token values were adjusted to satisfy their registered 4.5:1 candidate targets. Five non-text border candidates remain review-only pending inspection of the actual rendered component boundaries. Do not infer full WCAG conformance from the source-level candidate count or ratios.
