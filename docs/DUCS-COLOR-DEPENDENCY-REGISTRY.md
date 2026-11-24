# DUCS Color Dependency Registry — v0.3.1

This registry links page/component color responsibilities to semantic tokens and source stylesheets. It is a migration map, not a claim that every listed component has already been converted.

## Dependency map

| Dependency domain | Primary stylesheet(s) | DUCS token family | Priority |
|---|---|---|---|
| Shared shell and navigation | `theme.css` | `--ducs-page-*`, `--ducs-bg-*`, `--ducs-surface-*`, `--ducs-text-*`, `--ducs-border-*`, `--ducs-icon-*` | High |
| Homepage content and cards | `styles.css`, `theme.css` | `--ducs-home-*`, `--ducs-card-*`, `--ducs-action-*`, `--ducs-status-*` | High (core first-pass migration) |
| Admin dashboard and forms | `admin.css`, `theme.css`, `live-users.css` | `--ducs-admin-*` button, field, badge, status, surface, feedback, and login tokens; shared header, search/auth controls, category navigation, sidebar, and logout states now consume `--ducs-shell-*` aliases | High |
| Live Users presence and restrictions | `live-users.css` | `--ducs-live-*` surface, field, status, border, dialog, action, chart, and overlay aliases; remaining decorative tokens | High (partial migration) |
| Upload Studio editor and preview | `upload-studio.css` | `--ducs-upload-*` graphite workspace, field, action, preview, dialog, and feedback tokens | High (first-pass migration) |
| Profile and avatar setup | `profile.css` | `--ducs-profile-*` page surface, field, action, identity, and feedback tokens | Medium (first-pass migration) |
| Motion overlays and backdrops | `theme.css`, page stylesheets | `--ducs-overlay-*`, state tokens | Medium |
| Data visualization | page-specific stylesheets (to be enumerated) | chart categorical/sequential/diverging tokens (planned) | Later |

## Change impact rules

- Changing a primitive can affect every semantic and component token that references it.
- Changing a semantic token can affect every component alias and page mapping that consumes it.
- Changing a page-scoped token should affect only elements inside that page scope once component migration is complete.
- Upload Studio's violet creative palette must not be treated as a generic danger/status color.
- Green online/success states must not be reused as an unrelated brand accent without an explicit design decision.
- A dependency is not considered migrated until the literal is removed or justified, the consumer is tokenized, and the rendered state is compared.

## Current migration status

- Token foundation: added.
- Initial page palette mapping: added as descriptive CSS custom properties.
- Per-file source inventory: added.
- Shared shell root palette alias migration: complete; Admin header, search/auth controls, category navigation, sidebar, brand badge, and logout colors now consume shared shell DUCS aliases. Other shell component colors remain pending.
- Component token aliases are separated into `components/buttons.css`, `fields.css`, `badges.css`, `surfaces.css`, and `feedback.css`.
- Live Users first-pass migration: page/panel surfaces, search-field states, drawer/dialog gradients and surfaces, role/restriction states, overlay, notice, and restriction-trigger color aliases are consumed by `live-users.css`; exact legacy values are retained. Some decorative and ancillary colors remain literal.
- Live Users: page/panel, search field, drawer/dialog, role/status, restriction list, overlay, notice, dialog controls, and chart colors partially migrated; decorative colors remain.
- Admin: dashboard buttons, fields, data rows, overview cards/metrics, progress indicators, activity markers, owner badge, feedback states, and login controls consume `--ducs-admin-*` aliases. Admin shared header, search/auth controls, category navigation, sidebar, brand badge, and logout states consume `--ducs-shell-*` aliases; remaining shell/component colors are pending.
- Profile first-pass migration: page header, card, avatar surface, dividers, form fields and focus states, upload/save actions, identity accents, and status feedback consume `--ducs-profile-*` aliases. Decorative background gradient and remaining minor literals are not fully inventoried.
- Upload Studio first-pass migration: creator workspace page/panel surfaces, primary form controls and focus states, tab/action states, preview/list surfaces, publish controls, dialog, and error notice consume `--ducs-upload-*` aliases. The underlying legacy stylesheet still contains dormant base palette declarations and some decorative literals; full literal cleanup is pending.
- Homepage core page/header, hero, cards, navigation, account field, and action consumers now use `--ducs-home-*` aliases. Homepage visual-editor controls, Site Builder shell/workbench, registration dialog, suspension screen, and profile-completion banner now consume first-pass `--ducs-home-*` aliases. Decorative and ancillary homepage literals remain.
- Shared shell profile drawer, profile menu control, account-role badges, and homepage compact search surfaces now consume `--ducs-shell-*` aliases. Remaining shared shell decorative colors and ancillary components are still pending.
- Live Users page chrome now consumes `--ducs-live-*` aliases for its top bar, brand/back link, panel heading, list metadata, row highlight, avatar, presence marker, role label, group heading, empty/error state, and footnote. Drawer and dialog typography, close controls, profile identity, action labels, detail rows, activity summary, and note text now consume DUCS aliases. Decorative smoke effects and residual micro-states remain pending.
- Admin ancillary states, Upload Studio decorative/base legacy declarations, Profile decorative gradients and minor literals, and residual Live Users micro-states: pending.
- Full foreground/background contrast matrix, responsive state screenshots, and visual regression: pending.
