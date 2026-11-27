# DRM Universal Motion System (DUME)
Version: 0.3.1 — Visible dropdown motion and adaptive list width
Status: Shared mobile drawer motion and reusable dropdown disclosure motion are integrated. Homepage DUFS category dropdowns use the DUME controller for symmetric open/close transitions, rapid-toggle cancellation and reduced-motion behavior. Other motion families and Profile remain outside this controller migration.

## Purpose
DUME centralizes interaction motion: transition duration, easing, animation sequencing, reduced-motion behavior, and motion state orchestration. It does not own element dimensions, coordinate placement, or colors.

## Ownership boundaries
- DUME owns motion timing, easing, animation/transition orchestration, and reduced-motion adaptations.
- DUSS owns dimensions, typography sizing, spacing, and layout geometry.
- DUPS owns positioning modes, anchors, offsets, and stacking layers.
- DUCS owns colors and semantic color meaning.

## Current implementation
- `assets/motion/motion.css` defines shared drawer and dropdown duration/easing/transform tokens, opacity timing, and mobile drawer/backdrop primitives.
- `assets/motion/motion-controller.js` exposes `window.DRMMotion.drawer({sidebar, backdrop, toggle, open})` and `window.DRMMotion.dropdown({panel, open, onFinish})`.
- The controller owns the mobile universal drawer transition at the 760px breakpoint and the reusable dropdown disclosure lifecycle. It sets toggle/panel ARIA and inert state, coordinates backdrop visibility, cancels stale close timers/animations, and clears temporary inline styles after transitions.
- Reduced-motion preference sets both drawer and dropdown animation durations to zero; semantic visibility/ARIA/inert state changes still occur immediately.
- Desktop drawer behavior remains with existing page CSS; the controller delegates to the existing desktop class state.

## Token contract
- `--dume-drawer-duration`: primary drawer transition duration.
- `--dume-drawer-opacity-duration`: drawer opacity transition duration.
- `--dume-drawer-easing`: drawer transition easing.
- `--dume-backdrop-duration`: backdrop opacity transition duration.
- `--dume-dropdown-duration`: symmetric dropdown enter/exit duration (380ms default).
- `--dume-dropdown-easing`: shared dropdown enter/exit easing.
- `--dume-dropdown-offset`: vertical translation used by the dropdown motion (22px default).
- Dropdown opening/closing also applies a subtle 2px-to-0px blur so the panel motion remains visually legible rather than relying on the small arrow rotation.
- `--dume-dropdown-scale`: starting/ending scale for the dropdown motion.

The controller reads the duration and easing from computed root custom properties. JavaScript fallbacks are retained for resilience if a token stylesheet is unavailable.

## Migration rules
1. Keep motion values in DUME tokens instead of duplicating timing literals in controllers.
2. Respect `prefers-reduced-motion`; do not make essential state changes depend on animation completion.
3. Cancel or replace pending animation jobs when the same component is reopened rapidly.
4. Keep layout geometry and positioning outside DUME.
5. Migrate one component family at a time and preserve existing visual behavior.
6. Avoid global transitions that animate unrelated layout or content.
7. Enter and exit for one disclosure component use the same duration/easing and reverse the same visual path. Visibility is removed only after a normal-motion close finishes; close state is announced and made inert immediately.
8. Reopening during a close cancels the stale animation and reverses from the current rendered frame, preventing a late close callback from hiding an already reopened panel.

## Definition of done
A component is migrated only when timing and easing are tokenized, state changes remain correct under rapid interaction, reduced motion is respected, keyboard interaction is preserved, and desktop/mobile behavior is validated in a browser.

## Remaining work and limitations
- The shared mobile universal sidebar-drawer and DUFS category-dropdown disclosure controllers are centralized; this is not a migration of every motion family.
- Profile drawer, Live Users user drawers/modals and cinematic effects, Site Builder, dialogs, and other page-specific animations still contain local motion rules.
- Browser validation covers the four integrated pages and the listed lifecycle states. It does not provide a visual/optical approval of every animation or native browser-zoom validation.
- Broader keyboard review, visual frame-by-frame review, and motion consistency review across the remaining local animation families remain pending.

## Browser validation update — 2026-11-25

- GitHub Actions browser audit run #4 passed on commit `f0663e0d276d778da2c1ee96dc7cfa2655c00503`: [run #4](https://github.com/faridulprime/DRM-Premium/actions/runs/45617602710).
- Chromium rendered Homepage, Admin, Live Users, Upload Studio and Profile at seven viewport widths: 1440, 900, 390, 320, 720 (200%-zoom layout-width proxy), 760 and 761 CSS px. All 35 page/viewport checks passed.
- Verified DUSS/DUPS/DUCS stylesheet and semantic-token loading, horizontal overflow, zero-geometry visible controls, first keyboard focus visibility, and representative DUCS contrast pairings (primary text/canvas, secondary text/canvas, action/canvas, border/canvas).
- DUME mobile drawer open/close and cleanup passed on Homepage, Admin, Live Users and Upload Studio under both normal and reduced-motion preferences; the 760/761px desktop/mobile boundary passed. The run exposed and led to correction of an Admin mobile-menu toggle state bug.
- DUPS computed header stacking values are checked against the page-header, Homepage mobile-header, and Live Users header layer tokens for the applicable pages and widths.
- The early run #4 audit reported sub-44px targets before DUSS v0.8 integration. Later run #11 and run #16 browser audits report zero visible targets below 44px in their sampled states; this is scoped to the rendered controls enumerated by those tests.
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

## DUME dropdown/disclosure rule — 2026-11-27

The DRM Universal Motion System owns the shared category-dropdown motion used by DUFS on the Movies homepage. All seven category dropdowns use one interaction contract: click/keyboard activation opens a closed menu; activating the same category again closes it; activating a different category closes the old menu while opening the new one; Escape, outside click and the explicit close control close the active menu. Pointer hover does not mutate open/closed state, so mouse and touch clicks have identical toggle semantics.

The controller animates from a compact, slightly raised and transparent state to the normal panel state. Closing runs the exact same duration/easing and motion path in reverse. The panel becomes `aria-hidden` and inert at the start of closing, but remains rendered until the exit animation completes. Reopening during either transition cancels the old animation and begins from the current computed frame. Under `prefers-reduced-motion: reduce`, the same state changes happen immediately with no animation.

## Browser acceptance — dropdown disclosure rule — 2026-11-27

The Design System browser audit now exercises all seven DUFS category dropdowns in desktop normal-motion, mobile normal-motion and mobile reduced-motion contexts. It verifies click-to-open/click-same-to-close, hover non-activation, symmetric token duration/easing on open and close, visible-but-inert close state, category hand-off, rapid open-close-open cancellation, explicit close control, outside click, Escape, and immediate reduced-motion state changes. This is a static Chromium rendering test; it does not exercise deployed Pages Functions or D1.

## DUME dropdown visual clarity refinement — 2026-11-27

The shared dropdown transition was visually strengthened after review: 380ms duration, 22px vertical travel, 0.97 starting scale and a subtle 2px blur all resolve to the natural panel state. Closing reverses these same frames using the same easing and duration. `prefers-reduced-motion` still disables the visual transition.

DUFS list width remains a DULM layout concern, not a DUME motion concern. DULM now sizes category lists intrinsically to the widest folder label, with a 460px/viewport cap; Year retains a 172px minimum and 240px cap. The width is content-driven, so a longer future folder label naturally expands the panel until the viewport safety bound is reached.
