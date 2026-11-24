# DUCS Color Inventory — updated source audit

Version: 0.2.3
Branch: `feature/full-admin-panel`
Scope: stylesheet source inventory; not a computed-style or screenshot audit.

## Per-file source inventory

Counts below are the number of distinct literal HEX values and distinct rgb()/rgba() expressions found in each stylesheet. They are per-file counts; values can repeat between files. HSL, named colors, gradients, shadows, SVG attributes, inline styles, and runtime-generated colors are not represented by these two counts.

| Stylesheet | Unique HEX literals | Unique RGB(A) expressions | Dominant source palette / notes |
|---|---:|---:|---|
| `styles.css` | 128 | 31 | Homepage editorial palette and editor/builder overlays; core consumers tokenized, auxiliary literals remain |
| `theme.css` | 61 | 27 | Shared dark shell; Admin navigation migrated, other shared components partial |
| `admin.css` | 32 | 5 | Admin dashboard components and login; partial migration |
| `live-users.css` | 72 | 40 | Live Users components; partial migration |
| `upload-studio.css` | 119 | 5 | Upload Studio creator workspace; first-pass migration |
| `profile.css` | 39 | 3 | Profile page and form; first-pass migration |

These counts must not be summed and described as repository-wide unique colors. A deduplicated repository inventory requires parsing every color syntax and resolving CSS cascade, variables, pseudo-states, SVG, and runtime styles.

## Initial page identity map

| Page | Base | Primary accent | Secondary / status identity |
|---|---|---|---|
| Homepage | Light editorial palette | Red | Neutral surfaces, steel-blue builder/editor controls, green account feedback |
| Admin | Dark neutral | Blue | Green success; red danger; blue information |
| Live Users | Near-black | Blue/neutral | Green online; red restriction/danger; amber warning |
| Upload Studio | Near-black | Mint | Violet/lavender creative controls; pink/red validation |
| Profile | Near-black | Green | Blue secondary; red validation |

Page mappings in `assets/colors/themes/page-mapping.css` record this observed direction. Core homepage, Admin, Live Users, Upload Studio, and Profile consumers now use page/component aliases in partial first-pass migrations; residual components and decorative treatments remain.

## Migration groups

1. Shared shell: page background, text, muted text, surface, border, navigation, overlay.
2. Actions: primary/secondary/danger buttons and their hover/active/disabled/focus states.
3. Form controls: input/select/textarea backgrounds, text, placeholder, borders, validation, focus.
4. Status: success, warning, danger, info, online/offline, restricted/blocked.
5. Creative workspace: upload media panels, violet tool surfaces, mint accent, preview and progress states.
6. Profile: avatar, profile fields, success and validation feedback.
7. Data presentation: tables, charts, progress, badges, empty/loading states.

## Audit limitations

- This is a source-text inventory, not a browser computed-style inspection. Counts were refreshed after the latest stylesheet token migrations.
- It does not prove that every literal is visible or active at runtime.
- It does not include every CSS color grammar or colors created by JavaScript.
- No global literal replacement was performed; page identity and existing color values were preserved through explicit aliases.
- Contrast validation is limited to explicitly recorded foreground/background pairs in `DUCS-ACCESSIBILITY.md`.
