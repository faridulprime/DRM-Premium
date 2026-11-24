# DRM Universal Positioning System (DUPS)
Version: 0.2.0 — Shared shell and floating-layer migration
Status: Token foundation, shared-shell stacking, Live Users overlay layers, editor overlays, and Upload Studio fixed layers migrated; browser validation pending

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
- Component migrations cover audited stacking-layer values only; positioning modes, anchor offsets, collision handling, and all component families have not been fully migrated.
- The token layer does not automatically normalize existing z-index values.
- CSS Anchor Positioning is not enabled as a required dependency.
- Browser-based visual, stacking, keyboard, zoom, and mobile safe-area validation remains outstanding.
