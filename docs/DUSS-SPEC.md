# DRM Universal Sizing System (DUSS)
Version: 0.8.0 — 44px interactive target baseline — Expanded audited icon variants and override coverage
Status: Core token foundation and selected component migrations; 20 audited icon/slot tokens, 20 mapped consumers, and 44px interactive-target rules are in place. Five-page browser regression passed with zero undersized visible targets in the tested states; broader component/optical review remains.

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
- Remaining icon variants and optical alignment across SVG, icon-font, and inline icon implementations.
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
- Preserved the separate 13px mobile action-label size with its own token; row-action buttons retain the more specific 14px label size.
- Kept color, border, interaction, and page composition rules outside DUSS ownership.
- Bumped the sizing stylesheet cache key to `duss-05` on all five consuming pages.

Validation:
- Source-level assertions verify each migrated selector uses the new token family.
- No browser-rendered or interaction validation is claimed. Browser screenshots, computed-style comparison, keyboard/touch interaction, 200% zoom, and Bengali/Latin overflow checks remain outstanding.


## Phase 6 implementation update — 2026-11-25

Completed on `feature/full-admin-panel`:
- Added component-specific icon-size tokens for the global menu icon, search icons, authentication-field icons, sidebar logout icon/glyphs, Live Users search, Profile brand mark, and homepage field glyph.
- Migrated only selectors whose current dimensions and responsive overrides were identified in the source audit: `theme.css`, `styles.css`, `live-users.css`, and `profile.css`.
- Preserved the existing source dimensions: 24, 21, 16, 14, 22, 20, 19, 17, 15, 30 and 27 CSS px as applicable.
- Kept visual/optical alignment changes out of this phase; CSS source sizes alone cannot establish visual centering or perceived size.
- Updated the sizing cache key to `duss-06` on all five consuming pages.

Validation:
- Static token-reference and cache-key checks are added in `scripts/test-duss-tokens.py` and a dedicated GitHub Actions workflow.
- Browser screenshots, computed bounding boxes, keyboard/touch interaction, zoom and Bengali/Latin text layout remain separate runtime checks.

## Phase 7 implementation update — 2026-11-25

Completed on `feature/full-admin-panel`:
- Added two component-specific icon tokens for the Live Users role-badge SVG (11px legacy exception) and Homepage Profile drawer logout SVG (15px).
- Replaced later hardcoded `!important` search-icon overrides in the Homepage and Admin responsive cascade with the existing DUSS compact-search tokens; effective dimensions are unchanged.
- Removed a superseded 25px Profile brand rule inside the same 600px media query after confirming a later 27px DUSS rule wins in the cascade.
- Strengthened the static regression script to inspect every matching override block for the audited compact-search and Profile brand selectors, not merely find one token reference somewhere in the stylesheet.
- Completed the Admin search token migration in both `admin.css` and `theme.css`, so an earlier stylesheet cannot retain a hardcoded duplicate.
- Replaced the Homepage mobile sidebar icon-slot width and flex-basis with the existing navigation-size token, preserving the 24px slot.
- Added separate desktop/mobile shield-icon tokens for the Homepage profile-completion banner (16px/14px).
- Labeled the v0.7 component-variant token section explicitly and added a regression assertion for the section marker.
- Added independent 23px action-symbol slot and 12px glyph tokens for Live Users' action drawer.
- Updated all five DUSS cache keys to `duss-07`.

Validation boundary:
- CSS source dimensions remain unchanged for effective components. The 25px declaration was unreachable because the later same-breakpoint rule sets 27px.
- Static CI can confirm token wiring and selector block coverage, but cannot prove browser-computed layout, touch behavior, localization fit, or optical alignment. The expanded v0.7.0 test now checks 20 icon/slot tokens and all audited consumer variants.

## Browser validation update — 2026-11-25

- GitHub Actions browser audit run #4 passed on commit `f0663e0d276d778da2c1ee96dc7cfa2655c00503`: [run #4](https://github.com/faridulprime/DRM-Premium/actions/runs/45617602710).
- Chromium rendered Homepage, Admin, Live Users, Upload Studio and Profile at seven viewport widths: 1440, 900, 390, 320, 720 (200%-zoom layout-width proxy), 760 and 761 CSS px. All 35 page/viewport checks passed.
- Verified DUSS/DUPS/DUCS stylesheet and semantic-token loading, horizontal overflow, zero-geometry visible controls, first keyboard focus visibility, and representative DUCS contrast pairings (primary text/canvas, secondary text/canvas, action/canvas, border/canvas).
- DUME mobile drawer open/close and cleanup passed on Homepage, Admin, Live Users and Upload Studio under both normal and reduced-motion preferences; the 760/761px desktop/mobile boundary passed. The run exposed and led to correction of an Admin mobile-menu toggle state bug.
- DUPS computed header stacking values are checked against the page-header, Homepage mobile-header, and Live Users header layer tokens for the applicable pages and widths.
- The audit reports, but does not fail on, interactive targets smaller than 44px. Several remain and need a deliberate DUSS touch-target review; the visible logo links are included in this observation. No blanket size increase was made.
- Scope is local static-site rendering, not deployed Cloudflare Pages or Pages Functions. No D1, authentication, edge, or Production behavior is exercised. The 720px case is not native browser zoom. This is not a full WCAG certification or visual/optical approval.

## Phase 8 implementation update — 2026-11-25

- Added `assets/sizing/touch-targets.css`, loaded after the page-specific stylesheets on Homepage, Admin, Live Users, Upload Studio and Profile.
- The module consumes the existing `--duss-touch-target-min` (44px) token for primary menu triggers, brand/back links, search fields and buttons, the Live Users restriction action, profile save action, sidebar links and category chips.
- Component icon and text sizes remain unchanged. Interactive control boxes are allowed to grow to the DUSS minimum; responsive header/search layout must still pass the browser overflow and viewport checks.
- Updated the DUSS cache key to `duss-08` on all five pages. This is a consumer integration pass; it does not establish complete coverage of every dynamic dialog, generated action, or third-party control.

### Phase 8 follow-up — rendered target audit

The first 35-state Chromium audit exposed remaining undersized controls in the public login row and Admin sign-in/setup panels. The DUSS touch-target consumer module now applies the existing 44px token to those authentication inputs/actions, the Home/Admin search icon buttons, and the Home mobile menu/search slots. This was done as a hit-area adjustment; typography and icon glyph sizing remain unchanged. The acceptance run passed: five pages at seven viewport widths, zero horizontal overflow, and zero visible interactive targets below 44px in the tested states.

The first touch-target pass also showed that a broad width override could collapse the responsive Home search field at narrow widths. That page-wide width/grid override has been removed; only the specific menu/search action hit areas are enlarged, preserving the original responsive search layout. Search-clear buttons and compact category chips receive explicit 44px inline targets. The browser audit is used to re-check 320px overflow and visible control geometry.

## DUSS v0.8 browser acceptance — 2026-11-25

- Static DUSS source validation run #20 passed on commit `c423ea1fe0e35459d279f40bf444afa69fcd4c53`: [run #20](https://github.com/faridulprime/DRM-Premium/actions/runs/45620765851).
- Browser regression run #11 passed on the same commit: [run #11](https://github.com/faridulprime/DRM-Premium/actions/runs/45620765803).
- The browser suite rendered Homepage, Admin, Live Users, Upload Studio and Profile at 1440, 900, 390, 320, 720 (layout-width proxy), 760 and 761 CSS px. It reported 35/35 page/viewport checks passed and zero visible interactive targets below 44px.
- The v0.8 consumer stylesheet is loaded after page styles on all five pages. Static checks verify the 44px minimum token, its consumer module, Live Users fallback link class, five page cache keys and the existing icon/slot token consumers.
- Scope limitations: generated/dynamic controls outside the sampled states are not comprehensively enumerated; the 720px case is not native browser zoom; optical glyph alignment and visual design approval remain separate tasks.
