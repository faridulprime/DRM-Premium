# DRM Universal Sizing System (DUSS)
Version: 0.1.0 — Foundation
Status: Token foundation; component migration not started

## Purpose and boundaries
DUSS centralizes sizing for typography, icons, spacing, controls, layout, surfaces, and responsive behavior. DUME continues to own motion and animation. DUSS does not redesign colors or visual themes.

Compatibility rule: introducing DUSS must not change rendered dimensions. Legacy CSS remains authoritative until each component is audited and migrated deliberately.

## Principles
1. One source of truth: shared values use named DUSS tokens.
2. Semantic before numeric: prefer component intent over unexplained numbers.
3. Responsive by constraint: fluid values need sensible minimum and maximum bounds.
4. Content wins: localization, zoom, and user font preferences must not be clipped by fixed heights.
5. Touch size and visual size are separate.
6. Exceptions are explicit and component-scoped.
7. Migrate incrementally: audit, map, migrate, compare, then remove obsolete declarations.

## Primitive scales
- Spacing: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96 CSS px.
- Typography: 10, 12, 14, 16, 18, 20, 24, 30, 36, 48, 60 CSS px. 10px is for non-essential micro-labels; essential information should normally be at least 12px; body copy defaults to 16px.
- Icons: 12, 14, 16, 18, 20, 24, 28, 32, 40, 48 CSS px. Apply optical correction only where visual comparison supports it.
- Control heights: compact 32px, small 36px, standard 40px, comfortable 44px, touch 48px, large 52px. These are presets, not clipping constraints.
- Touch targets: aim for at least 44×44 CSS px; use 48×48 where practical.
- Radius: 4, 8, 12, 16, 20, 24px and pill.
- Layout: content-driven widths by default; max-widths only for readable columns, dialogs, and constrained workspaces.

## Semantic token families
Typography: font-size, line-height, weight, letter-spacing.
Icons: icon-size.
Spacing: space.
Controls: control-height, control-padding, touch-target.
Badges: badge-height, badge-font-size, badge-gap.
Avatars: avatar-size.
Surfaces: radius, card-padding.
Layout: container-max, page-gutter, grid-gap.
Responsive aliases must remain consistent with established repository behavior.

## Responsive policy
The existing DUME drawer breakpoint is 760px and must not be independently redefined by DUSS.
Review bands: mobile <=760px; tablet 761–1023px; desktop >=1024px. These are review ranges, not universal breakpoints. Use clamp() only where fluid sizing improves continuity and retain component-aware constraints.

## Density modes
Comfortable is the default. Compact is opt-in for dense admin tables and utility panels. Spacious is opt-in for content-focused surfaces. Density must be scoped; it must not shrink primary navigation, touch targets, or form controls unexpectedly.

## Accessibility and internationalization
Respect browser zoom and user text scaling. Avoid fixed heights for text containers unless overflow is intentionally designed. Test Bengali and Latin fonts, long labels, numbers, and mixed-script content. Preserve focus visibility and adequate touch targets. Validate at 200% zoom and narrow viewports.

## Repository baseline audit
Audited on feature/full-admin-panel before token introduction. Counts are lexical CSS value occurrences, not unique dimensions and not a claim that every value should be tokenized.

| Stylesheet | Lines | px occurrences | rem occurrences | Root variables |
|---|---:|---:|---:|---:|
| styles.css | 169 | 557 | 0 | 5 |
| theme.css | 1,075 | 779 | 0 | 23 |
| admin.css | 273 | 362 | 0 | 0 |
| live-users.css | 277 | 531 | 0 | 0 |
| upload-studio.css | 196 | 448 | 0 | 10 |
| profile.css | 106 | 159 | 0 | 6 |
| Total | 2,096 | 2,836 | 0 | 44 |

Page stylesheet composition:
- Homepage: styles.css, theme.css
- Admin: admin.css, theme.css, live-users.css
- Live Users: theme.css, live-users.css
- Upload Studio: theme.css, upload-studio.css

The four pages load DUME motion CSS separately. DUSS remains independent from DUME.

## Migration order
1. Add tokens only; no visual changes.
2. Audit component families and map current values to semantic tokens.
3. Migrate shared primitives: typography, spacing, icons, controls.
4. Migrate shared shell: header, navigation, sidebar, page gutters.
5. Migrate cards, forms, badges, dialogs, tables, and page-specific modules.
6. Compare desktop/tablet/mobile, Bengali/Latin, zoom, and density modes.
7. Remove superseded declarations only after all consuming pages pass checks.

## Definition of done
A component is migrated only when its dimensions use semantic tokens or a documented local exception; old declarations no longer compete; no unintended regression appears; Bengali and Latin text do not clip; keyboard focus and touch targets remain usable; and all consuming pages have been checked.

## Known limitations
This is a static source audit. It does not measure computed browser styles, rendered geometry, or visual regressions. Browser screenshots and interaction checks are required before changing live component dimensions.
