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
