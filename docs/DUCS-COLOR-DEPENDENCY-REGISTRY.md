# DUCS Color Dependency Registry — v0.2.1

This registry links page/component color responsibilities to semantic tokens and source stylesheets. It is a migration map, not a claim that every listed component has already been converted.

## Dependency map

| Dependency domain | Primary stylesheet(s) | DUCS token family | Priority |
|---|---|---|---|
| Shared shell and navigation | `theme.css` | `--ducs-page-*`, `--ducs-bg-*`, `--ducs-surface-*`, `--ducs-text-*`, `--ducs-border-*`, `--ducs-icon-*` | High |
| Homepage content and cards | `styles.css`, `theme.css` | `--ducs-card-*`, `--ducs-action-*`, `--ducs-status-*`, page accent tokens | High |
| Admin dashboard and forms | `admin.css`, `theme.css`, `live-users.css` | button, field, badge, status, table, dialog tokens | High |
| Live Users presence and restrictions | `live-users.css` | status success/danger/warning, badge, surface, border, overlay tokens | High |
| Upload Studio editor and preview | `upload-studio.css` | creative page tokens, field, button, card, status, progress tokens | High |
| Profile and avatar setup | `profile.css` | profile page tokens, field, action, status, avatar surface tokens | Medium |
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
- Shared shell root palette alias migration: complete; individual shared shell components still pending.\n- Component token aliases are now separated into `components/buttons.css`, `fields.css`, `badges.css`, `surfaces.css`, and `feedback.css`; page CSS consumers remain pending.
- Button, field, badge, card, dialog, table, chart, and notification migrations: pending.
- Visual regression and full contrast audit: pending.
