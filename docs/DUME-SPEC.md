# DRM Universal Motion Engine (DUME)
Version: 0.2.0 — Shared mobile drawer controller token integration
Status: Shared mobile drawer controller and CSS timing tokens are integrated on four pages; broader component motion migration and browser validation remain pending.

## Purpose
DUME centralizes interaction motion: transition duration, easing, animation sequencing, reduced-motion behavior, and motion state orchestration. It does not own element dimensions, coordinate placement, or colors.

## Ownership boundaries
- DUME owns motion timing, easing, animation/transition orchestration, and reduced-motion adaptations.
- DUSS owns dimensions, typography sizing, spacing, and layout geometry.
- DUPS owns positioning modes, anchors, offsets, and stacking layers.
- DUCS owns colors and semantic color meaning.

## Current implementation
- `assets/motion/motion.css` defines shared drawer duration, opacity duration, easing, and mobile drawer/backdrop primitives.
- `assets/motion/motion-controller.js` exposes `window.DRMMotion.drawer({sidebar, backdrop, toggle, open})`.
- The controller owns the mobile universal drawer transition at the 760px breakpoint, sets toggle ARIA state, coordinates backdrop visibility, cancels stale close timers, and clears temporary inline styles after closing.
- Reduced-motion preference sets the drawer transition duration to zero.
- Desktop drawer behavior remains with existing page CSS; the controller delegates to the existing desktop class state.

## Token contract
- `--dume-drawer-duration`: primary drawer transition duration.
- `--dume-drawer-opacity-duration`: drawer opacity transition duration.
- `--dume-drawer-easing`: drawer transition easing.
- `--dume-backdrop-duration`: backdrop opacity transition duration.

The controller reads the duration and easing from computed root custom properties. JavaScript fallbacks are retained for resilience if a token stylesheet is unavailable.

## Migration rules
1. Keep motion values in DUME tokens instead of duplicating timing literals in controllers.
2. Respect `prefers-reduced-motion`; do not make essential state changes depend on animation completion.
3. Cancel or replace pending animation jobs when the same component is reopened rapidly.
4. Keep layout geometry and positioning outside DUME.
5. Migrate one component family at a time and preserve existing visual behavior.
6. Avoid global transitions that animate unrelated layout or content.

## Definition of done
A component is migrated only when timing and easing are tokenized, state changes remain correct under rapid interaction, reduced motion is respected, keyboard interaction is preserved, and desktop/mobile behavior is validated in a browser.

## Remaining work and limitations
- Only the shared mobile universal drawer controller is currently centralized.
- Profile drawer, Live Users drawers/modals, Site Builder, dialogs, and other page-specific animations still contain local motion rules.
- The controller's resize transition from mobile to desktop and rapid open/close sequences require browser interaction testing.
- No browser visual, keyboard, or reduced-motion test was run as part of this source migration.
