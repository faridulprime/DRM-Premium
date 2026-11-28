# DUCS Color Accessibility

## Baseline
Use WCAG 2.2 AA contrast targets:
- Normal text: at least 4.5:1.
- Large text: at least 3:1.
- Meaningful UI component boundaries and graphical indicators: at least 3:1 against adjacent colors.

## Required review
- Calculate contrast for actual foreground/background pairs, not isolated color values.
- Check default, hover, active, focus, selected, disabled, validation, and status states.
- Verify both Bengali and English text at their actual font weights and sizes.
- Do not communicate success, warning, error, or selection through color alone.
- Preserve visible keyboard focus and test Windows/high-contrast forced-colors behavior.
- Include color-vision deficiency simulation as a review aid, not as a substitute for contrast measurement.

## Initial token spot-check
The current default border token (#666666) measures approximately 3.38:1 against #0d0d0d and 3.09:1 against #181818. This is a limited calculation for these two pairings only; it does not validate every component, opacity blend, state, or page.

## Current status
The token foundation includes contrast target variables and a forced-colors hook. A curated 106-pair source-level audit and calculation-engine unit tests are available, but five registered non-text boundary pairs remain below the selected 3:1 review threshold. This is not a completed accessibility certification. Full component/state coverage, computed-style and pixel-level browser checks, forced-colors behavior, and color-vision review remain pending.
