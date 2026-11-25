# Design System Browser Audit

## Purpose

This is a repeatable browser-level regression gate for DUME, DUSS, DUCS and DUPS on the five principal DRM Premium pages. It complements (and does not replace) the existing static source/token checks.

## Coverage

- Homepage, Admin, Live Users, Upload Studio and Profile.
- Desktop (1440px), tablet (900px), mobile (390px), narrow mobile (320px), 760/761px breakpoint boundaries, and a 720px layout-width stress proxy for the width a 1440px desktop would expose at 200% browser zoom.
- Required DUSS, DUPS and DUCS stylesheet linkage and computed semantic-token availability.
- DUME stylesheet linkage on Homepage, Admin, Live Users and Upload Studio. Profile is intentionally excluded in the inspected markup and is not represented as DUME-integrated.
- Horizontal document overflow and zero-geometry interactive controls.
- First keyboard Tab focus and visible focus indicator.
- Representative DUCS semantic contrast pairs: primary text/canvas, secondary text/canvas, action/canvas, and border/canvas.
- Mobile DUME drawer open/close lifecycle under normal and reduced-motion preferences, including cleanup during a transition.
- Desktop drawer routing at 761px, immediately above the established 760px mobile breakpoint.

## Interpretation

The audit uses the checked-out static website served locally in Chromium. It does not access deployed Cloudflare Pages, Pages Functions, D1, authentication, Cloudflare edge settings, or Production. External network resources (including Google Fonts) are blocked so results remain deterministic.

The 720px scenario is a layout-width proxy, not native browser zoom. A true browser-zoom and visual/optical comparison still requires manual or dedicated desktop-browser verification. Touch targets below 44px are reported as warnings for review; they do not automatically fail because some compact controls may be intentional and need context-aware assessment.

A passing run is evidence of the tested static rendered states only. It is not a full accessibility certification, visual approval, or Production acceptance.

## Browser validation update — 2026-11-25

- GitHub Actions browser audit run #4 passed on commit `f0663e0d276d778da2c1ee96dc7cfa2655c00503`: [run #4](https://github.com/faridulprime/DRM-Premium/actions/runs/45617602710).
- Chromium rendered Homepage, Admin, Live Users, Upload Studio and Profile at seven viewport widths: 1440, 900, 390, 320, 720 (200%-zoom layout-width proxy), 760 and 761 CSS px. All 35 page/viewport checks passed.
- Verified DUSS/DUPS/DUCS stylesheet and semantic-token loading, horizontal overflow, zero-geometry visible controls, first keyboard focus visibility, and representative DUCS contrast pairings (primary text/canvas, secondary text/canvas, action/canvas, border/canvas).
- DUME mobile drawer open/close and cleanup passed on Homepage, Admin, Live Users and Upload Studio under both normal and reduced-motion preferences; the 760/761px desktop/mobile boundary passed. The run exposed and led to correction of an Admin mobile-menu toggle state bug.
- DUPS computed header stacking values are checked against the page-header, Homepage/Upload Studio mobile-header, and Live Users header layer tokens for the applicable pages and widths.
- The audit reports, but does not fail on, interactive targets smaller than 44px. Several remain and need a deliberate DUSS touch-target review; the visible logo links are included in this observation. No blanket size increase was made.
- Scope is local static-site rendering, not deployed Cloudflare Pages or Pages Functions. No D1, authentication, edge, or Production behavior is exercised. The 720px case is not native browser zoom. This is not a full WCAG certification or visual/optical approval.

## DUPS overlay stacking validation — 2026-11-25

Browser audit run #4 had already checked the computed page-header layer against its semantic DUPS header token on five pages. The expanded audit now also inspects the computed sidebar, backdrop and page-header z-indexes after opening the mobile drawer. It checks the matching DUPS mobile sidebar/backdrop token values and the expected page-specific stack order: Homepage/Admin drawers above backdrop and header; Live Users/Upload Studio headers above drawer and backdrop. This tests the active rendered cascade rather than merely checking that token definitions exist.
