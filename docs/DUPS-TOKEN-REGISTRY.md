# DUPS Token Registry — v0.1.0

All tokens are defined in `assets/positioning/tokens.css`. The initial release adds definitions only; existing component declarations remain authoritative.

## Logical offset primitives

| Token | Value | Intended use |
|---|---:|---|
| `--dups-offset-0` | 0 | Explicit zero offset |
| `--dups-offset-1` | 0.25rem | Minimal offset |
| `--dups-offset-2` | 0.5rem | Compact offset |
| `--dups-offset-3` | 0.75rem | Small offset |
| `--dups-offset-4` | 1rem | Standard offset |
| `--dups-offset-6` | 1.5rem | Large offset |
| `--dups-offset-8` | 2rem | Extra-large offset |

## Semantic placement tokens

| Token | Alias | Intended use |
|---|---|---|
| `--dups-inset-edge` | offset-4 | Default edge-pinned inset |
| `--dups-inset-edge-compact` | offset-2 | Compact edge-pinned inset |
| `--dups-overlay-inset` | offset-4 | Overlay boundary clearance |
| `--dups-floating-clearance` | offset-3 | Clearance for floating UI |

These are defaults, not universal constraints. Component-specific responsive values require documented justification.

## Stacking layers

| Token | Value | Intended use |
|---|---:|---|
| `--dups-layer-base` | 0 | Base positioned content |
| `--dups-layer-raised` | 10 | Locally raised content |
| `--dups-layer-sticky` | 100 | Sticky navigation or utility surfaces |
| `--dups-layer-dropdown` | 200 | Dropdown menus |
| `--dups-layer-overlay` | 300 | Backdrops and non-modal overlays |
| `--dups-layer-drawer` | 400 | Drawers and side panels |
| `--dups-layer-modal` | 500 | Modal dialogs |
| `--dups-layer-popover` | 600 | Popovers and contextual surfaces |
| `--dups-layer-tooltip` | 700 | Tooltips |
| `--dups-layer-toast` | 800 | Toast notifications |
| `--dups-layer-critical` | 900 | Exceptional critical UI only |

Layer numbers are conventions within a stacking context, not a guarantee of global order. A child cannot out-rank an ancestor stacking context.

## Anchor gaps

| Token | Value |
|---|---:|
| `--dups-anchor-gap-xs` | 0.25rem |
| `--dups-anchor-gap-sm` | 0.5rem |
| `--dups-anchor-gap-md` | 0.75rem |
| `--dups-anchor-gap-lg` | 1rem |

## Alignment references

- `--dups-align-start`: logical start edge.
- `--dups-align-center`: center alignment.
- `--dups-align-end`: logical end edge.

These references are for coordinate/anchor placement only. They do not replace Grid/Flex alignment or DUSS layout tokens.

## Governance
New tokens require a semantic name, a single owner, an intended use, and a dependency entry where they are consumed. Avoid duplicate aliases and arbitrary per-component z-index values. Document exceptions rather than silently expanding the scale.


## Audited component layer aliases (v0.2.0)

The token file also includes component-specific aliases for shared shell, Profile, Live Users, visual editor/site builder, suspension/profile-completion overlays, and Upload Studio. These aliases intentionally retain legacy numeric values. They are compatibility mappings, not a mandate that unrelated components share the same layer. See `DUPS-DEPENDENCY-REGISTRY.md` for migrated scope and limitations.


## Responsive Website Builder inspector layer — 2026-11-26

| Token | Value | Intended use |
|---|---:|---|
| `--dups-layer-builder-inspector` | 2 | Local overlay order for the Website Builder inspector when it becomes absolutely positioned at widths up to 900 CSS px |
| `--dups-anchor-builder-inspector-top` | 66px desktop/tablet; 112px compact | Top offset within the fixed Website Builder shell, following the responsive toolbar |
| `--dups-anchor-builder-inspector-right` | 0 | Flush right edge within the Builder shell |
| `--dups-anchor-builder-inspector-bottom` | 34px | Clearance for the Builder footer within the shell |

This is a component-scoped alias preserving the existing numeric value. It does not establish a global layer above unrelated content; it is scoped within the fixed Website Builder shell.


## Header login status anchor — 2026-11-26

| Token | Value | Intent |
|---|---|---|
| `--dups-anchor-gap-status` | `var(--dups-anchor-gap-xs)` (4px at the default root size) | Separation between the mobile Homepage header and its anchored login status |

The existing `--dups-offset-2` (0.5rem; 8px at the default root size) supplies the right-edge offset. The mobile Homepage status selector consumes both tokens; no layout or visibility behavior is changed.


## Live Users dialog sticky-header layer — 2026-11-26

| Token | Value | Intent |
|---|---:|---|
| `--dups-layer-live-dialog-sticky-header` | 1 | Local stacking order for the sticky header inside the Live Users detail dialog |
| `--dups-anchor-live-dialog-sticky-header-top` | 0 | Sticky top anchor for the Live Users detail-dialog header |

The alias preserves the existing component-local value and must not be interpreted as a global layer.


## Live Users drawer closing-effect layers — 2026-11-26

The closing drawer's lower smoke pseudo-element now consumes the existing `--dups-layer-live-effect` token (5), while its upper pseudo-element already consumes `--dups-layer-live-effect-top` (6). These are component-local layers within the drawer's isolated effect context.


## Visual editor anchors — 2026-11-26

| Token | Value | Intent |
|---|---:|---|
| `--dups-anchor-visual-editor-legacy-top` | `var(--dups-offset-3)` (12px) | Legacy top anchor retained for the base toggle declaration |
| `--dups-anchor-visual-editor-legacy-left` | `var(--dups-offset-3)` (12px) | Legacy left anchor retained for the base toggle declaration |
| `--dups-anchor-visual-editor-panel-top` | 3.5rem (56px) | Fixed panel top coordinate |
| `--dups-anchor-visual-editor-panel-left` | `var(--dups-offset-3)` (12px) | Fixed panel left coordinate |
| `--dups-anchor-visual-editor-edge` | 0.875rem (14px) | Desktop floating toggle right/bottom clearance |
| `--dups-anchor-visual-editor-edge-compact` | `var(--dups-offset-3)` (12px) | Compact viewport toggle right/bottom clearance |

The base toggle coordinates are overridden by the theme's fixed bottom-right placement on the Homepage. The browser audit reveals the static hidden controls and checks the computed positions and existing local layers against these tokens at the established viewport set. Values preserve the previous geometry.


## Profile drawer displacement anchor — 2026-11-26

| Token | Value | Responsibility |
|---|---:|---|
| `--dups-anchor-profile-drawer-clearance` | 390px desktop; 0px compact | Right-side clearance applied to the fixed Category Bar while the Profile drawer is open |

## Profile completion overlay anchors — 2026-11-26

| Token | Value | Intent |
|---|---:|---|
| `--dups-anchor-profile-complete-top` | 74px desktop; 66px compact/mobile | Top coordinate of the fixed profile-completion bar |
| `--dups-anchor-profile-complete-center` | 50% | Horizontal viewport-center anchor |
| `--dups-anchor-profile-backdrop-inset` | `var(--dups-offset-0)` (0) | Full-viewport backdrop edge inset |

The values preserve the existing fixed overlay geometry. Chromium checks the computed top/center anchors, full-viewport backdrop insets and existing bar-above-backdrop layer ordering at all Homepage viewport states.


## Responsive Category Bar anchor — 2026-11-26

| Token | Default | Intent |
|---|---|---|
| `--dups-anchor-category-bar-top` | Desktop: DUSS header height; mobile: DUSS mobile header height | Shared fixed Category Bar top coordinate |

Homepage state selectors override this token for the existing guest, login-form, profile-menu and narrow-viewport header arrangements. Admin mobile Category Bar selectors also use the token with their existing 86px coordinate. The Chromium audit toggles the static Homepage header controls through three supported visibility states and checks computed fixed positioning/top against the active token at each mobile viewport. Existing coordinates are preserved.


## Live Users notice anchor — 2026-11-26

| Token | Value | Intent |
|---|---:|---|
| `--dups-anchor-live-notice-center` | 50% | Horizontal viewport-center anchor for the fixed live notice |
| `--dups-anchor-live-notice-bottom` | 18px | Bottom viewport clearance for the fixed live notice |
| `--dups-anchor-live-notice-left-compact` | 10px | Compact viewport left inset |
| `--dups-anchor-live-notice-right-compact` | 10px | Compact viewport right inset |

The existing translateX(-50%) centering behavior and local layer 140 are retained. Chromium checks computed fixed positioning, viewport-center coordinate, bottom clearance and layer at every Live Users viewport.


## Registration close and Live Users presence anchors — 2026-11-26

| Token | Value | Intent |
|---|---:|---|
| `--dups-anchor-register-close-top` | 17px | Registration dialog close-control top offset within its form |
| `--dups-anchor-register-close-right` | 18px | Registration dialog close-control right offset within its form |
| `--dups-anchor-live-presence-edge` | -1px | Presence indicator's slight outward overlap beyond its avatar |

The migration preserves existing values. Chromium opens the static registration dialog and checks its close-control offsets, and creates a temporary Live Users avatar fixture to verify the presence dot's absolute positioning and negative edge offsets at each viewport.


## Website Builder live-edit overlay layer — 2026-11-26

| Token | Value | Intent |
|---|---:|---|
| `--dups-layer-builder-live-overlay` | 20 | Local interaction layer above the Website Builder preview iframe |

The overlay keeps a zero inset via `--dups-offset-0` and remains absolutely positioned within `.sb-live-preview-wrap` (`position: relative; isolation: isolate`). Chromium builds a matching wrapper fixture and checks the containing block, full-edge coverage and local layer. This validates CSS composition, not the iframe preview's full event lifecycle.


## Homepage hero decorative anchors — 2026-11-26

| Token | Value | Intent |
|---|---:|---|
| `--dups-anchor-hero-corner-edge` | 0 | Bottom/right edge placement for the hero corner decoration |
| `--dups-anchor-hero-overlay-inset` | 0 | Full-containing-block inset for the hero pseudo-element overlay |

The hero remains the relative containing block; both decorative elements remain absolute. Chromium checks the computed containing-block relationship, corner edge coordinates and full pseudo-element coverage at every Homepage viewport.

## Homepage login-status responsive anchor and layer — 2026-11-26

| Token | Value | Intent |
|---|---:|---|
| `--dups-anchor-header-login-status-gap` | 8px | Desktop gap below the badge's `.top-actions` containing block |

The compact header retains its existing 4px gap and 8px right inset through the compact spacing/offset tokens; the existing `--dups-layer-header-status` token preserves the effective layer of 110. Chromium compares rendered badge-to-header geometry, right offset and computed layer at every Homepage viewport, including the 760/761px breakpoint. No responsive coordinates or stacking values change.

## Live Users account drawer viewport anchors — 2026-11-26

| Token | Value | Intent |
|---|---:|---|
| `--dups-anchor-live-drawer-top` | 51.1% | Existing desktop drawer vertical anchor |
| `--dups-anchor-live-drawer-left` | calc(54.4% - 90px) | Existing desktop drawer horizontal anchor aligned to the primary panel |
| `--dups-anchor-live-drawer-top-compact` | 50% | Compact viewport vertical center anchor |
| `--dups-anchor-live-drawer-left-compact` | 50% | Compact viewport horizontal center anchor |

The original desktop coordinates and the effective 760px compact centering breakpoint are preserved. A later 760px rule overrides the earlier 700px drawer-only rule; the compact anchor tokens are now consumed by that final rule. Chromium opens the static drawer fixture and checks its rendered center against the expected viewport coordinates and existing local layer at every Live Users viewport.


## Upload Studio mobile global-header edge anchors — 2026-11-26

The fixed mobile Upload Studio global header uses `--dups-offset-0` for its top, left and right viewport edges. This reuses the zero-offset primitive rather than introducing duplicate component-specific zero tokens; the existing mobile-header layer alias remains unchanged.


## Shared shell viewport-edge anchors — 2026-11-26

The shared fixed header, Category Bar horizontal edges, compact navigation drawer top/bottom edges and navigation backdrop full-viewport inset reuse `--dups-offset-0`. No duplicate zero-valued component tokens were introduced. The Category Bar's vertical header-height dependency remains owned by DUSS.


## Profile drawer and navigation edge anchors — 2026-11-26

Reused `--dups-offset-0` for the shared sidebar's left/bottom anchors, compact Homepage sidebar top, Profile drawer top/right/bottom and compact Profile drawer backdrop inset. No new zero-value semantic tokens were added; header-relative sidebar placement remains owned by DUSS.

## Live Users drawer backdrop viewport edges — 2026-11-26

The fixed Live Users drawer backdrop now reuses `--dups-offset-0` for all four viewport insets. This avoids a duplicate zero-valued token; its fixed positioning, blur, opacity lifecycle and existing backdrop layer remain unchanged. The dynamic Chromium overlay fixture checks computed fixed edge coordinates against the zero-offset token while the drawer is open.
