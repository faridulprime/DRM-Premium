# DRM Universal Motion Engine (DUME)
Version: 0.2.1 — Responsive drawer lifecycle and token-duration validation
Status: Shared mobile drawer controller and CSS timing tokens are integrated on Homepage, Admin, Live Users and Upload Studio. Chromium validates normal/reduced-motion open/close, rapid-toggle recovery, resize cleanup across the 760px breakpoint, ARIA/backdrop state, and transform/opacity timing against DUME tokens. Other motion families and Profile remain outside this controller migration.

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
- Only the shared mobile universal sidebar-drawer controller is centralized; this is not a migration of every motion family.
- Profile drawer, Live Users user drawers/modals and cinematic effects, Site Builder, dialogs, and other page-specific animations still contain local motion rules.
- Browser validation covers the four integrated pages and the listed lifecycle states. It does not provide a visual/optical approval of every animation or native browser-zoom validation.
- Broader keyboard review, visual frame-by-frame review, and motion consistency review across the remaining local animation families remain pending.

## Browser validation update — 2026-11-25

- GitHub Actions browser audit run #4 passed on commit `f0663e0d276d778da2c1ee96dc7cfa2655c00503`: [run #4](https://github.com/faridulprime/DRM-Premium/actions/runs/45617602710).
- Chromium rendered Homepage, Admin, Live Users, Upload Studio and Profile at seven viewport widths: 1440, 900, 390, 320, 720 (200%-zoom layout-width proxy), 760 and 761 CSS px. All 35 page/viewport checks passed.
- Verified DUSS/DUPS/DUCS stylesheet and semantic-token loading, horizontal overflow, zero-geometry visible controls, first keyboard focus visibility, and representative DUCS contrast pairings (primary text/canvas, secondary text/canvas, action/canvas, border/canvas).
- DUME mobile drawer open/close and cleanup passed on Homepage, Admin, Live Users and Upload Studio under both normal and reduced-motion preferences; the 760/761px desktop/mobile boundary passed. The run exposed and led to correction of an Admin mobile-menu toggle state bug.
- DUPS computed header stacking values are checked against the page-header, Homepage mobile-header, and Live Users header layer tokens for the applicable pages and widths.
- The audit reports, but does not fail on, interactive targets smaller than 44px. Several remain and need a deliberate DUSS touch-target review; the visible logo links are included in this observation. No blanket size increase was made.
- Scope is local static-site rendering, not deployed Cloudflare Pages or Pages Functions. No D1, authentication, edge, or Production behavior is exercised. The 720px case is not native browser zoom. This is not a full WCAG certification or visual/optical approval.

## Browser lifecycle acceptance — 2026-11-25

Browser audit run #11 passed on commit `c423ea1fe0e35459d279f40bf444afa69fcd4c53`: [run #11](https://github.com/faridulprime/DRM-Premium/actions/runs/45620765803). The test covers mobile drawer open/close, backdrop visibility, post-close cleanup and reduced-motion duration on Homepage, Admin, Live Users and Upload Studio, plus desktop-side menu behavior at 761px.

The test does not establish that every animation/transition in DRM is centralized in DUME. Profile drawer, Live Users modal effects, Site Builder, dialogs and other local motion remain separate migration candidates. Rapid viewport resize while a drawer is open and broader keyboard/visual animation review remain pending.

## Browser lifecycle acceptance — DUME v0.2.1 — 2026-11-25

Browser audit run #16 passed on commit `13b7132c865d8ca04c627be37fc9337d5eb108a0`: [run #16](https://github.com/faridulprime/DRM-Premium/actions/runs/45633016197).

The Chromium audit checks Homepage, Admin, Live Users and Upload Studio for:
- Normal and reduced-motion drawer open/close, backdrop visibility and post-close cleanup.
- Rapid open/close recovery without stale close timers.
- Mobile-to-desktop resize cleanup at the 760/761px boundary, including `aria-expanded`, body classes, sidebar classes and backdrop state; it then reopens and closes the drawer after returning to mobile.
- Computed transform and opacity transition durations against `--dume-drawer-duration` and `--dume-drawer-opacity-duration`.

The controller now uses the opacity-duration token rather than a hard-coded 520ms value. This acceptance applies to the tested shared sidebar drawer states only; it is not evidence that every page animation is centralized in DUME.
