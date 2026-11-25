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
