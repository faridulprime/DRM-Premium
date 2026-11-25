# DRM Universal Positioning System (DUPS)
Version: 0.3.0 — Shared shell, floating layers, and viewport placement migration
Status: Token foundation and selected shared-shell/overlay migrations; computed header and mobile drawer/backdrop layer checks passed in Chromium on five pages/four drawer pages. Broader position/anchor migration and collision validation remain pending.

## Purpose
DUPS centralizes coordinate-based positioning decisions in DRM Premium. It makes positioning contexts, logical offsets, anchored placement, and stacking order explicit and reviewable across pages.

DUPS is not a replacement for CSS layout. It governs where an element is positioned relative to a containing block, viewport, or anchor, and how positioned layers are ordered.

## Ownership boundaries
- DUPS owns CSS positioning modes, containing-block intent, logical inset/offset values, anchored placement relationships, and stacking-layer conventions.
- DUSS owns dimensions, spacing, typography sizing, control geometry, page gutters, and flow/grid/flex layout geometry.
- DUCS owns color values, semantic color meaning, themes, and color accessibility.
- DUME owns motion, animation, timing, easing, and transform-based animation behavior.

Examples:
- A card's width, height, grid track, and gap are DUSS decisions.
- A tooltip's position relative to its trigger and its stacking layer are DUPS decisions.
- A tooltip's surface and text colors are DUCS decisions.
- A tooltip's entrance/exit motion is a DUME decision.

## Non-goals
1. DUPS does not replace Grid, Flexbox, normal document flow, or layout composition.
2. DUPS does not own width, height, margin, padding, gap, or responsive size scales; those remain DUSS.
3. DUPS does not own color, opacity-as-color, shadows, borders, or theme decisions; those remain DUCS/component styling.
4. DUPS does not own transform animation or transition behavior; those remain DUME.
5. DUPS does not force every element into absolute positioning.
6. DUPS does not introduce a global z-index reset or change current stacking behavior during foundation setup.

## Architecture
`assets/positioning/`
- `tokens.css`: shared logical offset, anchor-gap, alignment-reference, and stacking-layer tokens.

`docs/`
- `DUPS-SPEC.md`: architecture, rules, boundaries, migration policy.
- `DUPS-TOKEN-REGISTRY.md`: token names, meaning, and intended use.
- `DUPS-DEPENDENCY-REGISTRY.md`: page/component source audit and migration dependencies.

## Positioning model
- Static: normal-flow default; do not add a declaration without a component reason.
- Relative: establish a local positioning context or apply a small intentional visual offset. Prefer not to use it as a substitute for layout.
- Absolute: position within a deliberately established containing block; document the anchor/container.
- Fixed: viewport- or explicitly fixed-containing-block placement; reserve for viewport-level controls and overlays.
- Sticky: scroll-bound placement; verify the nearest scrolling ancestor and available scroll range.

Use logical properties (`inset-block-start`, `inset-inline-end`, etc.) for direction-aware placement where practical. Physical `top/right/bottom/left` may remain where compatibility or existing component semantics require them.

## Anchoring and alignment
Anchored UI (menus, tooltips, popovers, contextual actions) should declare:
- the anchor element;
- preferred side and alignment;
- gap from the anchor;
- collision/fallback behavior;
- behavior when the anchor or viewport changes.

Native CSS Anchor Positioning is a progressive enhancement only. Do not make it a required baseline until browser support and a tested fallback are documented. Existing JavaScript or static fallback placement remains authoritative until migrated.

DUPS alignment applies to coordinate/anchor placement. Alignment inside normal Grid/Flex layouts remains a DUSS/layout responsibility.

## Stacking and layer policy
Use the sparse semantic layer scale in the token registry rather than arbitrary escalating integers. A layer token does not escape a CSS stacking context; transforms, opacity, isolation, positioned ancestors, and containment can create local stacking contexts. Each overlay family must be tested in its real ancestor tree.

A component should use the lowest layer that satisfies its interaction requirement. Avoid using z-index as a repair for incorrect DOM structure or unintended stacking contexts.

## Principles
1. Normal flow first; position only when the interaction or visual model requires it.
2. Declare the containing block and anchor relationship intentionally.
3. Prefer logical inset properties for internationalized layouts.
4. Keep layer values semantic, sparse, and documented.
5. Avoid arbitrary z-index values and unbounded escalation.
6. Do not use positioning to compensate for incorrect DUSS layout geometry.
7. Preserve current rendered behavior during token introduction.
8. Migrate one component family at a time: audit, map, tokenize, compare, validate.
9. Keep responsive placement rules scoped to the component that needs them.
10. Support reduced motion through DUME; do not encode motion behavior in DUPS.

## Accessibility and robustness
- Fixed and sticky elements must not obscure focused controls, headings, or page content.
- Check keyboard navigation, focus visibility, zoom, text enlargement, and narrow viewports.
- Respect safe-area insets for edge-pinned mobile controls when applicable.
- Ensure overlays have an intentional focus and dismissal model; positioning alone does not provide dialog semantics.
- Test right-to-left direction and Bengali/Latin mixed content where placement depends on inline direction.
- Avoid fixed coordinates that assume a single viewport or content length.

## Compatibility and migration
Version 0.1.0 adds custom properties only. The stylesheet is linked by Homepage, Admin, Live Users, Upload Studio, and Profile. The token file contains root custom properties only. Consumer migrations now map audited shared-shell, Profile drawer, Live Users overlay, visual editor, site builder, profile-completion overlay, suspension screen, and Upload Studio fixed-layer stacking values to DUPS layer tokens with numeric fallbacks. The migrations preserve audited numeric values, including legacy exceptions. These are source-level changes; browser stacking-context validation remains pending.

The initial source audit is lexical and limited to declarations for position, z-index, and inset-like offsets in the six principal stylesheets. It does not resolve computed styles, selectors' runtime applicability, JavaScript positioning, SVG, or stacking-context behavior.

## Definition of done
A component is considered migrated only when:
- its positioning mode and containing block are intentional;
- offsets use semantic DUPS tokens or a documented local exception;
- stacking order uses the semantic layer scale or a documented local exception;
- anchor collision/fallback behavior is covered where relevant;
- no old declaration competes with the new rule;
- desktop, mobile, keyboard, zoom, and relevant RTL/long-content states are validated;
- no unintended visual or interaction regression is observed.

## Known limitations
- Component migrations cover audited stacking-layer values and selected Live Users viewport coordinates only; general positioning modes, anchor offsets, collision handling, and all component families have not been fully migrated.
- The token layer does not automatically normalize existing z-index values.
- CSS Anchor Positioning is not enabled as a required dependency.
- Browser-based visual, stacking, keyboard, zoom, and mobile safe-area validation remains outstanding.

## Browser validation update — 2026-11-25

- GitHub Actions browser audit run #4 passed on commit `f0663e0d276d778da2c1ee96dc7cfa2655c00503`: [run #4](https://github.com/faridulprime/DRM-Premium/actions/runs/45617602710).
- Chromium rendered Homepage, Admin, Live Users, Upload Studio and Profile at seven viewport widths: 1440, 900, 390, 320, 720 (200%-zoom layout-width proxy), 760 and 761 CSS px. All 35 page/viewport checks passed.
- Verified DUSS/DUPS/DUCS stylesheet and semantic-token loading, horizontal overflow, zero-geometry visible controls, first keyboard focus visibility, and representative DUCS contrast pairings (primary text/canvas, secondary text/canvas, action/canvas, border/canvas).
- DUME mobile drawer open/close and cleanup passed on Homepage, Admin, Live Users and Upload Studio under both normal and reduced-motion preferences; the 760/761px desktop/mobile boundary passed. The run exposed and led to correction of an Admin mobile-menu toggle state bug.
- DUPS computed header stacking values are checked against the page-header, Homepage/Upload Studio mobile-header, and Live Users header layer tokens for the applicable pages and widths.
- The early run #4 audit reported small targets before DUSS v0.8 touch-target integration. The later run #11 and run #16 browser audits report zero visible interactive targets below 44px in the sampled page/viewport states. This result is scoped to the controls rendered in those tests; it does not claim every generated or dynamic control has been enumerated.
- Scope is local static-site rendering, not deployed Cloudflare Pages or Pages Functions. No D1, authentication, edge, or Production behavior is exercised. The 720px case is not native browser zoom. This is not a full WCAG certification or visual/optical approval.

## DUPS overlay stacking validation — 2026-11-25

Browser audit run #4 had already checked the computed page-header layer against its semantic DUPS header token on five pages. The expanded audit now also inspects the computed sidebar, backdrop and page-header z-indexes after opening the mobile drawer. It checks the matching DUPS mobile sidebar/backdrop token values and the expected page-specific stack order: Homepage/Admin drawers above backdrop and header; Live Users/Upload Studio headers above drawer and backdrop. This tests the active rendered cascade rather than merely checking that token definitions exist.

## Browser acceptance — 2026-11-25

Browser audit run #11 passed on commit `c423ea1fe0e35459d279f40bf444afa69fcd4c53`: [run #11](https://github.com/faridulprime/DRM-Premium/actions/runs/45620765803). It verifies computed page-header z-index values against the DUPS header tokens and, after opening mobile drawers, verifies the computed sidebar/backdrop/header values and page-specific stacking order on Homepage, Admin, Live Users and Upload Studio.

This is limited to the tested header/drawer layers and their active rendered cascade. It does not validate every positioned element, every stacking context, anchored tooltip/popover collision handling, native zoom, safe-area layout, or all pages' overlay interactions.

## Expanded browser acceptance — 2026-11-25

The latest browser audit run #16 passed on commit `13b7132c865d8ca04c627be37fc9337d5eb108a0`: [run #16](https://github.com/faridulprime/DRM-Premium/actions/runs/45633016197). It retains the earlier computed header/sidebar/backdrop z-index checks and DUME drawer lifecycle checks, and reports no sub-44px visible targets in its sampled states.

DUPS validation remains deliberately scoped: it checks the shared page headers and four mobile drawer/backdrop stacks, not all positioned selectors, all containing-block contexts, popover/tooltip collision handling, native zoom, or every overlay interaction.


## Restricted Users modal placement acceptance — 2026-11-26

- Replaced the Restricted Users modal's remaining literal `z-index: 120` with the existing `--dups-layer-live-drawer` token and preserved the numeric fallback.
- Extended the Chromium browser audit to inspect the actual computed modal positioning mode, computed z-index versus its DUPS token, and viewport-center geometry at the seven existing viewport widths (1440, 900, 390, 320, 720, 760 and 761 CSS px).
- This validates the modal's source-backed fixed placement and center alignment in the checked-out static site. It does not prove visual collision handling, every ancestor stacking context, or deployed behavior.


The new Restricted Users modal assertions passed at all seven viewport widths in the same Chromium run. The complete browser job also passed its 35 existing page/viewport checks and the established DUME drawer lifecycle checks.


## Homepage overlay and responsive Builder inspector acceptance — 2026-11-26

- Added a DUPS alias for the Website Builder inspector's existing local z-index 2 and migrated the responsive absolute-positioned inspector to that token without changing its numeric value.
- Chromium run #45677034569 passed on commit `21eb5ce2ad9e1388955f8b6ad8223447c0d9b6f3`: [run #45677034569](https://github.com/faridulprime/DRM-Premium/actions/runs/45677034569).
- The browser test checks the responsive inspector's computed absolute positioning and token-resolved layer at widths up to 900 CSS px. It also checks the Homepage Website Builder, suspension screen, profile-completion backdrop and profile-completion bar for fixed positioning and token-matched z-index, including bar-above-backdrop order.
- The run passed all 35 existing page/viewport checks and the added Homepage/Live Users DUPS assertions. Native browser zoom, visual collision/fallback, full ancestor-context inventory and deployed behavior remain outside this audit.
