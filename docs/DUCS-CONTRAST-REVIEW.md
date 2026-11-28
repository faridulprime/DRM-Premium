# DUCS Contrast Pair Review

## Purpose

This review defines an explicit, repeatable registry of foreground/background token pairs. It is a diagnostic complement to the DUCS source inventory and browser checks; it is not a WCAG conformance declaration.

## Method

- Reads DUCS primitive, semantic, component and interaction token files.
- Resolves token-to-token var() references before measurement.
- Supports HEX (3/4/6/8 digit), RGB/RGBA, percentages, and alpha compositing when a base surface is explicitly registered.
- Uses WCAG relative luminance and contrast ratio.
- Uses 4.5:1 for normal-text candidates and 3:1 for registered non-text UI boundary candidates.
- Tests each declared gradient endpoint separately; it does not interpolate every gradient pixel.
- Missing tokens, unsupported color syntax, conflicting declarations or unregistered translucent backgrounds fail the audit.
- Below-target ratios are reported as review findings rather than automatically changing legacy colors.

## Automated calculation-unit coverage

The contrast workflow now runs `scripts/test-ducs-contrast-unit.py` before auditing the registered candidate pairs. These unit tests cover short/long HEX parsing, alpha channels, modern RGB percentage syntax, out-of-range and unsupported color rejection, nested token references, fallback resolution, missing references, circular/composite references, known WCAG black/white math, foreground alpha compositing, and the requirement for an explicit base behind translucent backgrounds.

These tests validate the calculation engine and fail-closed parser behavior. They do not expand the curated pair registry, discover component states automatically, inspect computed browser styles, or establish WCAG conformance.

## Scope limits

The pair registry is curated and explicit. It includes core semantic text/action roles, buttons, form placeholders, badges, Live Users, Admin, Profile, Upload Studio, Homepage and selected boundaries. It does not discover every CSS selector or actual runtime background. Images/textures, blend modes, complete gradients, dynamic custom colors, forced-colors, color-vision simulation, and all hover/disabled/loading states remain separate tasks. Confirm the rendered component context before changing a flagged token.

## Decision rule

A low ratio is evidence that the registered pair needs review, not proof that the token is wrong: the assumed background may not match the actual component. Any remediation must preserve page identity and be validated in a browser.

## Remediation pass 1 — 2026-11-25

The source-level audit flagged six registered text pairs (including one muted-text token without a page-style consumer) below 4.5:1. Seven token values were adjusted to bring all seven candidates above the normal-text threshold without changing font size, weight, layout, or icon geometry.

| Pair | Previous | Updated | Source-level ratio after change |
|---|---:|---:|---:|
| Live Users placeholder on field | #6f6f6f | #858585 | 4.86:1 |
| Admin login placeholder on field | #6f6f6f | #858585 | 4.86:1 |
| Profile placeholder on field | #666666 | #7d7d7d | 4.75:1 |
| Live Users muted-text role on page | #777777 | #808080 | 4.92:1 |
| Live Users list metadata on raised row | #737373 | #858585 | 4.86:1 |
| Shared Profile drawer footer on drawer | #697585 | #7d8999 | 5.28:1 |
| Homepage empty-card muted text on card | #777777 | #737373 | 4.67:1 |

The Live Users muted-text role is registered in the DUCS token set but is not referenced by the current page stylesheets inspected in this pass. Its color was still brought above the registered contrast target so it is safe as a future semantic token; this does not establish a live page defect.

### Remaining review-only candidates

Five non-text boundary pairs remain below the selected 3:1 candidate threshold:

- Secondary button border on raised surface.
- Live Users dialog border on dialog.
- Upload Studio panel border on panel.
- Profile card border on card.
- Admin button border on button.

They are not automatically changed. Their visual boundary may be partly communicated by surface contrast, geometry, shadow, or context; a source token pair alone does not establish that the border is the only information identifying the component. Confirm the rendered context and component boundary requirement before changing these values.

### Scope and validation limits

The registered candidate audit resolves the explicit token pairs and checks their color math. It is not a full computed-style or pixel-level WCAG audit. Alpha/gradient endpoints, dynamic states, image/texture backgrounds, actual browser compositing, forced-colors, and all runtime overrides still need dedicated validation. A passing source audit must not be described as WCAG certification.

## Automated validation result — 2026-11-25

The DUCS contrast workflow run #2 passed on commit `4d9e87971447cd2363e8e655046043873ed7f794`: [run #2](https://github.com/faridulprime/DRM-Premium/actions/runs/45631187748). The result was 93/98 explicit candidate pairs meeting their registered thresholds, with the five non-text boundary pairs listed above remaining for contextual review.

The subsequent design-system browser audit run #16 passed on commit `13b7132c865d8ca04c627be37fc9337d5eb108a0`: [run #16](https://github.com/faridulprime/DRM-Premium/actions/runs/45633016197). It verifies the representative rendered contrast pairs and the responsive/rendered design-system states described in the browser audit specification. It does not turn the source-level candidate registry into a full runtime WCAG audit.

## Calculation engine unit tests — 2026-11-25

Added 16 unit tests for HEX/RGB parsing (including alpha and modern slash syntax), invalid color rejection, nested token references, fallback and cycle handling, WCAG black/white ratio, foreground compositing, and explicit base requirements for translucent backgrounds. The workflow now runs these tests before the 98-pair source audit, and its path filters include the unit-test file. Both steps passed on commit `d77b339e5c0fcc1ec32fcb9c0f6adafb9914d18e`: [run #45675221898](https://github.com/faridulprime/DRM-Premium/actions/runs/45675221898). The original source audit reported 93/98 pairs meeting their registered thresholds. A subsequent source-reviewed state-pair expansion added Live Users admin/restricted drawer roles across all three modal-gradient stops, active restriction-tab text, back-link hover text, and drawer-action hover text. The expanded audit now reports 101/106 pairs meeting their registered thresholds; the same five non-text boundary pairs remain contextual review findings. The expansion passed in [run #45675604695](https://github.com/faridulprime/DRM-Premium/actions/runs/45675604695) on commit `5ae4fecb3079cdb8325d96df27bfb24d95a98041`. This remains source-level diagnostic evidence, not a full runtime WCAG audit.
