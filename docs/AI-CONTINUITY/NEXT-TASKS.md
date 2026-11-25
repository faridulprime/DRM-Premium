# DRM Premium — Next Tasks
Last updated: 2026-11-25
Target application branch: `feature/full-admin-panel`
Separate DUGA review branch: `duga-foundation-review`
DUGA Draft PR: https://github.com/faridulprime/DRM-Premium/pull/4

## Application: DUSS

1. Confirm the GitHub Actions result for `.github/workflows/duss-sizing-smoke.yml`; it runs `scripts/test-duss-tokens.py` on relevant branch pushes and PR changes.
2. Perform browser screenshots and computed-style/bounding-box comparisons for Homepage, Admin, Live Users, Upload Studio and Profile.
3. Test mobile/tablet/desktop, 200% zoom, keyboard focus, touch targets and Bengali/Latin overflow.
4. Review SVG/glyph optical alignment using rendered evidence; do not infer optical equivalence from CSS dimensions.
5. Continue tokenizing remaining audited icons, page-specific buttons/badges, cards/grids and dialogs/tables only after consumers and breakpoints are mapped.

## Application: API and Website Builder review

1. Inspect Cloudflare WAF/rate-limit/edge rules for unauthenticated `POST /api/presence` and `POST /api/analytics/event`; these routes write to D1 and no route-local per-IP limiter was found in the source audit.
2. If edge protections are absent or insufficient, design bounded, privacy-preserving route controls and tests before changing runtime behavior.
3. Maintain a clear separation between the unpublished Builder JSON document (`/api/builder/draft`) and live style settings (`/api/builder/style`, legacy `/api/admin/settings`).
4. Add application regression tests for authentication, registration OTP, role management, presence, analytics, profile images and Builder style/draft flows.

## DUGA review track — Draft PR #4

1. Obtain independent third-party review of the SQL schema, lifecycle transitions, authorization policy and CAS/audit design.
2. Run full revised-schema acceptance against a fresh disposable D1 after the parent-change-request and AI-review constraints; the older Worker PASS does not cover these later schema additions.
3. Reconcile the actual shared Preview D1 migration history and repository migration sequence, including duplicate `0004` and `0007` prefixes.
4. Verify complete Preview schema/index/trigger inventory and preserve a verified backup/recovery plan.
5. Design/test trusted Git provenance and AI/validation service identity before any service write endpoints.
6. Test the Pages catch-all router/session integration and existing application regressions before proposing DUGA API runtime integration.

## Not authorized / not implemented

- No DUGA migration is applied to shared Preview or Production.
- No DUGA API or Control Center runtime exists.
- No trusted AI service credentials or automatic DACE execution exist.
- No Production deploy, merge, database mutation or Cloudflare binding change is authorized by this task.
- Do not delete suspected dead code; use evidence-first quarantine, tests and explicit approval.

## Preview D1 preflight reference

The read-only diagnostic script is `governance/schemas/d1-preview-preflight.sql`. It contains SELECT/PRAGMA inspection only. Run it in the Cloudflare D1 Console against Preview only; do not execute the DUGA schema draft or a migration. The migration/meta-name query returning no rows does not prove the historical migration ledger is absent.
