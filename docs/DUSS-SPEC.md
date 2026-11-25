# DRM Universal Sizing System (DUSS)
Version: 0.5.0 — Role badge and Admin action-button sizing migration
Status: Core token foundation, selected form/profile geometry, public shell, role badges, and Admin action-button geometry migrated to semantic tokens

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


## Phase 2 implementation update — 2026-11-24

Completed on `feature/full-admin-panel`:
- Added semantic typography aliases for captions, body text, emphasis, and heading roles.
- Added semantic control, field, form-gap, header, sidebar, modal, table, tooltip, and toast geometry tokens.
- Migrated shared Admin and Upload Studio form-control typography and minimum field heights to DUSS tokens.
- Migrated Profile form typography, card padding, avatar dimensions, field gaps, and form row gaps to DUSS tokens.
- Added the DUSS stylesheet to Profile, which previously did not load the sizing system.
- Bumped the DUSS cache key to `duss-02` on Homepage, Admin, Live Users, Upload Studio, and Profile.

## Migration status and remaining work

The following are not yet fully migrated and must not be marked complete:
- Header and navigation dimensions across the public site and admin shell.
- Sidebar/drawer geometry and menu item sizing.
- Icon sizing and optical alignment across SVG, icon-font, and inline icon implementations.
- Button variants, badges, status pills, and touch-target audit.
- Cards, grids, page gutters, modal/drawer widths, tables, pagination, toast, tooltip, and progress indicators.
- Responsive behavior and density modes across every page.
- Browser-based visual regression, keyboard, zoom (200%), and Bengali/Latin overflow checks.

The CSS-only migration is intentionally conservative. Existing component-specific layout, colors, and motion remain unchanged. Static source checks are not a substitute for rendered-browser validation.


## Phase 3 implementation update — 2026-11-24

Completed on `feature/full-admin-panel`:
- Centralized public shell geometry in DUSS: desktop/mobile header and category-bar heights, combined page offsets, sidebar widths, menu-trigger sizes, navigation row/icon geometry, category-chip spacing, brand icon sizes, and homepage gutters.
- Replaced the corresponding audited legacy dimensions in `theme.css` with semantic DUSS references while retaining the original pixel-equivalent values.
- Preserved the existing 760px responsive boundary and the established desktop/mobile dimensions; this is a tokenization pass, not a visual redesign.
- Bumped the DUSS stylesheet cache key to `duss-03` on all five pages.

Still outstanding:
- Admin and utility-page sidebar/header variants need their own selector-level audit before migration.
- Remaining icon implementations, action buttons, badges/status pills, cards/grids, dialogs, tables, pagination, toasts, tooltips, and progress indicators.
- Responsive density modes and full browser-based visual, keyboard, zoom, and Bengali/Latin overflow validation.

No rendered-browser regression test was available during this source update. The migrated shell dimensions are source-level verified only.


## Phase 4 implementation update — 2026-11-25

Completed on `feature/full-admin-panel`:
- Added semantic DUSS sizing tokens for the shared role-badge baseline and its audited dashboard, mobile, Live Users, drawer, and Upload Studio variants.
- Migrated the shared role-badge rule in `theme.css` and the matching component overrides in `admin.css`, `live-users.css`, and `upload-studio.css`.
- Preserved the existing pixel-equivalent values using rem-based tokens and explicit pixel fallbacks; no intended visual redesign or dimension change.
- Updated the DUSS stylesheet cache key to `duss-04` on all five consuming pages.

Validation:
- Source-level assertions confirmed the new token references exist in all four consuming stylesheets.
- This verifies source wiring only. Browser screenshots, computed-style comparison, keyboard/touch interaction, 200% zoom, and Bengali/Latin overflow checks remain outstanding.


## Phase 5 implementation update — 2026-11-25

Completed on `feature/full-admin-panel`:
- Added semantic tokens for Admin primary/outline actions, compact actions, row actions, and their mobile minimum heights.
- Migrated the corresponding audited geometry in `admin.css` while retaining the existing 10×16px, 8×13px, 8×12px, 42px, and 38px values.
- Kept color, border, interaction, and page composition rules outside DUSS ownership.
- Bumped the sizing stylesheet cache key to `duss-05` on all five consuming pages.

Validation:
- Source-level assertions verify each migrated selector uses the new token family.
- No browser-rendered or interaction validation is claimed. Browser screenshots, computed-style comparison, keyboard/touch interaction, 200% zoom, and Bengali/Latin overflow checks remain outstanding.
