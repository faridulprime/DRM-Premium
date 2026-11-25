# DRM Premium — Next Tasks
Last updated: 2026-11-25
Target application branch: `feature/full-admin-panel`
Separate DUGA review branch: `duga-foundation-review`
DUGA Draft PR: https://github.com/faridulprime/DRM-Premium/pull/4

## Application: DUSS

1. Verify the latest DUSS run after correcting the success-message count to derive from the 20-token/20-consumer registries; run #13 passed the underlying checks.
2. Perform browser screenshots and computed-style/bounding-box comparisons for Homepage, Admin, Live Users, Upload Studio and Profile; no browser-runner integration is currently available in this work session.
3. Test mobile/tablet/desktop, 200% zoom, keyboard focus, touch targets and Bengali/Latin overflow.
4. Review SVG/glyph optical alignment using rendered evidence; do not infer optical equivalence from CSS dimensions.
5. Continue auditing remaining icon implementations and page-specific buttons/badges, cards/grids and dialogs/tables only after consumers and breakpoints are mapped.

## Application: API and Website Builder review

1. Inspect the actual Cloudflare edge/WAF/rate-limit rules for unauthenticated `POST /api/presence` and `POST /api/analytics/event`; repository source does not include this account configuration.
2. Measure legitimate 30-second heartbeat and tab-event traffic before selecting endpoint-specific limits; avoid blocking users behind shared NATs.
3. Define privacy-preserving analytics event deduplication and retention/aggregation rules. No analytics cleanup path was found in the inspected Pages catch-all API source.
4. Review the 20 KB `Content-Length` guard in `readBody(req)`; it does not measure actual streamed body bytes when the header is absent or inaccurate.
5. If edge protections are absent or insufficient, design bounded controls and route-level regression tests before changing runtime behavior.
6. Maintain the separation between unpublished Builder JSON (`/api/builder/draft`) and separately persisted live style settings (`/api/builder/style`, legacy `/api/admin/settings`).
7. Add application regression tests for authentication, registration OTP, role management, presence, analytics, profile images and Builder style/draft flows.

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
