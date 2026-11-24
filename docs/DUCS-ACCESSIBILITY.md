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

## Current status
The token foundation includes contrast target variables and a forced-colors hook. It is not a completed accessibility certification. Full token-pair calculations and browser testing are pending.
