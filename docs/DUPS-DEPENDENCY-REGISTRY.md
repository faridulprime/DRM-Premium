# DUPS Dependency Registry — v0.1.0

This registry records the initial lexical source audit and the intended migration ownership. Counts are declaration occurrences in source text, not unique components or computed runtime behavior.

## Initial source audit

Branch: `feature/full-admin-panel`
Scope: six principal page/shared stylesheets.
Method: count CSS declaration starts for `position:`, `z-index:`, and physical/logical inset-like properties using a source-text regular expression. The audit does not parse CSS syntax or resolve selectors/cascade.

| Stylesheet | position declarations | z-index declarations | inset/edge declarations |
|---|---:|---:|---:|
| `theme.css` | 9 | 17 | 51 |
| `styles.css` | 28 | 12 | 30 |
| `admin.css` | 0 | 0 | 4 |
| `live-users.css` | 14 | 13 | 26 |
| `upload-studio.css` | 9 | 2 | 7 |
| `profile.css` | 0 | 0 | 0 |
| **Total** | **60** | **44** | **118** |

These totals are lexical declaration counts, not a claim that 60 distinct components use positioning or that all 118 offsets should become tokens. Shorthands and declarations outside the matched syntax may be omitted; duplicate selectors and overridden declarations may be counted.

## Dependency map

| Dependency domain | Primary stylesheet(s) | DUPS responsibility | Priority |
|---|---|---|---|
| Shared shell, navigation, menus | `theme.css`, `styles.css` | Positioning context, pinned placement, stacking | High |
| Homepage floating controls and overlays | `styles.css`, `theme.css` | Fixed/absolute placement and layer policy | High |
| Admin dashboard and utility panels | `admin.css`, `theme.css` | Local positioned affordances and overlay order | Medium |
| Live Users drawer, smoke layers, menus | `live-users.css`, `theme.css` | Drawer/backdrop stacking and anchored controls | High |
| Upload Studio editor and preview | `upload-studio.css` | Preview overlays, sticky/anchored tools | Medium |
| Profile forms and cards | `profile.css` | Only if positioned elements are introduced | Low |

## Ownership exclusions

- Grid/flex tracks, gaps, page gutters, widths, and heights remain DUSS.
- Color and shadow values remain DUCS/component styling.
- Transform, transition, animation, and motion timing remain DUME.
- DOM semantics, focus management, and dialog behavior remain component/application responsibilities.

## Migration status

- DUPS specification: added.
- Token foundation: added; no existing component selectors changed.
- Stylesheet integration: linked on Homepage, Admin, Live Users, Upload Studio, and Profile with cache key `dups-01`.
- Token registry: added.
- Source dependency audit: added.
- Shared-shell stacking migration: source-level tokenized in `theme.css` for desktop header, category bar, desktop/mobile sidebar, sidebar backdrop, mobile home header/sidebar/backdrop, and Profile drawer/backdrop. Numeric fallbacks preserve the audited values.
- Other component positioning migration: pending.
- Stacking-context inspection and browser visual validation: pending.
- Keyboard, zoom, mobile safe-area, and RTL checks: pending.

## Phase 1 migration note — shared shell stacking

The first consumer migration is intentionally limited to stacking order in `theme.css`. It replaces audited z-index literals with DUPS layer tokens while preserving their original numeric fallback values. This includes the page header, category bar, desktop and mobile sidebar, sidebar backdrop, mobile homepage header/sidebar/backdrop, and Profile drawer/backdrop. Position modes and inset coordinates remain unchanged in this phase. No layout, color, or motion declarations were changed as part of this migration.

This is a source-level migration only. Actual stacking-context behavior still requires browser inspection because z-index is scoped by ancestor stacking contexts.

## Migration rule

Do not globally replace numeric z-index or offset values. For each component family: inspect the selector and ancestor stacking contexts, establish the intended containing block, map only semantically equivalent values, preserve rendered behavior, and validate all consuming pages.


## Migration update — DUPS v0.2.0

Audited stacking-layer consumers have been migrated to semantic DUPS aliases in `theme.css`, `styles.css`, `live-users.css`, and `upload-studio.css`. Scope includes shared shell layers, Profile drawer/backdrop, Live Users header/highlight/drawer/backdrop/notice/avatar/effects, visual editor, site builder, suspension screen, profile-completion overlay, and Upload Studio sidebar/inspector/header. Numeric fallbacks preserve the original audited values. This does not migrate every position/inset declaration, implement anchor collision handling, or prove computed stacking behavior. Browser verification remains pending.


### Viewport placement migration — DUPS v0.3.0

`live-users.css` now consumes DUPS tokens for the established Live Users drawer desktop coordinates, modal viewport center, and mobile center overrides. Values preserve the prior `51.1%`, `calc(54.4% - 90px)`, and `50%` behavior. No automatic anchor collision handling or viewport repositioning engine was introduced. Browser placement validation remains pending.


### Restricted Users modal follow-up — 2026-11-26

The Restricted Users modal now consumes the existing `--dups-layer-live-drawer` token instead of a literal z-index. The design-system Chromium audit checks its computed fixed positioning, token-resolved z-index, and viewport-center geometry across the existing seven viewport widths. The check passed in Chromium run #45676504120 at all seven viewport widths. It is scoped to this modal and does not imply complete DUPS migration or collision/fallback coverage.


### Website Builder responsive inspector — 2026-11-26

The inspector's responsive absolute-positioning layer now uses `--dups-layer-builder-inspector` with fallback 2. Chromium browser assertions check its computed `position:absolute` and z-index/token agreement at the existing widths up to 900 CSS px. This is a local layer inside the fixed Website Builder shell, not a global overlay layer.
