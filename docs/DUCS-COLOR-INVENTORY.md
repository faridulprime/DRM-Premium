# DUCS Color Inventory — initial audit

Version: 0.2.1
Branch: `feature/full-admin-panel`
Scope: stylesheet source inventory; not a computed-style or screenshot audit.

## Per-file source inventory

Counts below are the number of distinct literal HEX values and distinct rgb()/rgba() expressions found in each stylesheet. They are per-file counts; values can repeat between files. HSL, named colors, gradients, shadows, SVG attributes, inline styles, and runtime-generated colors are not represented by these two counts.

| Stylesheet | Unique HEX literals | Unique RGB(A) expressions | Dominant source palette / notes |
|---|---:|---:|---|
| `styles.css` | 128 | 31 | Homepage legacy light neutral palette, blue/steel UI colors, green status accents, warm gold highlights |
| `theme.css` | 57 | 20 | Shared dark neutral shell, blue action accent, green success, additional dashboard/status accents |
| `admin.css` | 31 | 3 | Dark neutral panels, green success, red error, blue informational accents |
| `live-users.css` | 72 | 12 | Near-black surfaces, green online state, multiple red/restricted-account states, amber warning |
| `upload-studio.css` | 119 | 5 | Near-black base, violet/lavender creative palette, mint accent, red/pink validation states |
| `profile.css` | 39 | 3 | Near-black base, green accent/success, blue secondary accent, red error |

These counts must not be summed and described as repository-wide unique colors. A deduplicated repository inventory requires parsing every color syntax and resolving CSS cascade, variables, pseudo-states, SVG, and runtime styles.

## Initial page identity map

| Page | Base | Primary accent | Secondary / status identity |
|---|---|---|---|
| Homepage | Dark shell; legacy light palette declarations also exist in `styles.css` | Blue | Green success; warm gold and steel-blue decorative/secondary accents |
| Admin | Dark neutral | Blue | Green success; red danger; blue information |
| Live Users | Near-black | Blue/neutral | Green online; red restriction/danger; amber warning |
| Upload Studio | Near-black | Mint | Violet/lavender creative controls; pink/red validation |
| Profile | Near-black | Green | Blue secondary; red validation |

Page mappings in `assets/colors/themes/page-mapping.css` record this observed direction. They are documentation tokens only and do not yet override page component styles.

## Migration groups

1. Shared shell: page background, text, muted text, surface, border, navigation, overlay.
2. Actions: primary/secondary/danger buttons and their hover/active/disabled/focus states.
3. Form controls: input/select/textarea backgrounds, text, placeholder, borders, validation, focus.
4. Status: success, warning, danger, info, online/offline, restricted/blocked.
5. Creative workspace: upload media panels, violet tool surfaces, mint accent, preview and progress states.
6. Profile: avatar, profile fields, success and validation feedback.
7. Data presentation: tables, charts, progress, badges, empty/loading states.

## Audit limitations

- This was a source-text inventory, not a browser computed-style inspection.
- It does not prove that every literal is visible or active at runtime.
- It does not include every CSS color grammar or colors created by JavaScript.
- No global literal replacement was performed.
- Contrast validation is limited to explicitly recorded foreground/background pairs in `DUCS-ACCESSIBILITY.md`.
