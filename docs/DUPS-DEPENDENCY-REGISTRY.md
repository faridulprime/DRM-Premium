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
- Token foundation: added; no existing selectors changed.
- Token registry: added.
- Source dependency audit: added.
- Component mapping and migration: pending.
- Stacking-context inspection and browser visual validation: pending.
- Keyboard, zoom, mobile safe-area, and RTL checks: pending.

## Migration rule

Do not globally replace numeric z-index or offset values. For each component family: inspect the selector and ancestor stacking contexts, establish the intended containing block, map only semantically equivalent values, preserve rendered behavior, and validate all consuming pages.
