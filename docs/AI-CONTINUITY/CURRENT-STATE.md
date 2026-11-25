# DRM Premium — Current State
Verified ref: `feature/full-admin-panel`
Verification date: 2026-11-25

## Application branch and safety

- Public website and Admin application work remains on `feature/full-admin-panel`.
- Do not merge, rebase onto `main`, or deploy to Production without explicit authorization.
- Shared Preview and Production D1 remain separate. No D1 writes or migrations were performed in this work.
- The latest repository source audit is `docs/REPOSITORY-AUDIT-2026-11-25.md`.

## DUGA

- DUGA architecture, roles, ownership, dependency metadata and policies are present on this branch.
- D1 operational schema remains a design draft here. No DUGA API or separate Control Center is implemented in the website runtime.
- A separate branch, `duga-foundation-review`, contains Draft PR #4 based on `main`; it is open and unmerged.
- DUGA PR #4 GitHub Actions run `45601966255` (run 250) completed successfully on head `4b05f82232bebba39d137cb5f8e3d58741494302`. Logs confirm disposable Worker syntax, local DUGA schema SQLite tests, draft/fixture/Console parity, governance validation and malformed-input tests all passed. It still emitted Node 20 action deprecation warnings. The review-branch workflow has since been upgraded to checkout/setup-node/setup-python v7; its next run is pending.
- PR #4 records an earlier disposable-D1 Worker acceptance PASS (run `53d70371-008c-46a0-8bc3-33522be990eb`). The DUGA lifecycle review explicitly notes that the schema was subsequently extended with predecessor-link and AI-review constraints, and revised-schema disposable D1 acceptance has NOT RUN.
- Shared Preview migration-history reconciliation, independent third-party review, trusted AI/validation identity, Git provenance and application integration tests remain outstanding. Preview migration and DUGA write endpoints remain NO-GO.
- Human identity assignments remain unassigned. AI principal IDs are not credentials.

## Existing subsystem status

- DUME 0.2.0: shared mobile drawer controller integrated on four pages; broader motion migration and browser validation pending.
- DUSS 0.7.0: foundation, selected form/profile geometry, public shell geometry, role badges, Admin action buttons and 20 audited SVG/glyph/icon-slot dimensions migrated to semantic tokens. Two missed icon variants and later hardcoded responsive search overrides were corrected; source dimensions of effective components remain unchanged. Visual/optical equivalence is not established without browser rendering.
- DUPS 0.3.0: token foundation and selected positioning/layer migrations; browser validation pending.
- DUCS 0.3.1: token foundation and partial page/component migration; residual literals, full computed-style audit, browser regression and complete contrast validation remain.

## Application code audit findings

- Website Builder JSON document changes are draft-only; `/api/builder/state` reports `publishEnabled: false`. Separate `Save website style` and legacy visual-editor actions write `settings.visual_editor_config`, which the homepage reads and applies. Confirmation prompts and clearer UI text were added so these live-style writes are not confused with the JSON draft.
- Public `POST /api/presence` and `POST /api/analytics/event` routes write to D1 without login. A signed-in heartbeat executes four D1 statements; a guest heartbeat executes two; frontend heartbeats run every 30 seconds. Analytics inserts one row per accepted event without route-local per-IP metering or deduplication. The global Origin check is a CSRF/origin gate, not a rate limit. The API checks declared Content-Length (20 KB) but does not measure streamed body bytes. Registration OTP has separate per-IP/per-email controls, not shared by these routes. No Cloudflare edge/WAF configuration was inspected and no analytics-retention path was found in the catch-all API source; therefore this is an unverified resource-abuse risk, not a confirmed exploit. Full detail: `docs/PUBLIC-API-RESOURCE-ABUSE-REVIEW.md`.
- No governance runtime service is required to render the public website.

## Validation status

- DUSS v0.7.0 run #14 passed with dynamically reported counts: 20 icon/slot tokens and 20 consumer references, audited duplicate overrides, profile-banner and Live Users drawer variants, mobile nav slot, prior badge/button tokens, seven CSS brace checks and five page cache keys. The workflow uses checkout/setup-python v7; run #11 independently confirmed the v7 actions and no longer logged the Node 20 deprecation warning. This remains static source verification only.
- Browser screenshots, computed dimensions, keyboard/touch checks, 200% zoom and Bengali/Latin overflow tests have not been run.
- The source audit does not establish Cloudflare edge configuration or Production runtime behavior.

## Next direction

1. Complete browser-based DUSS sizing and interaction validation when a browser test environment is available.
2. Perform browser-based sizing and interaction validation before further geometry changes; no rendered-browser test has been run.
3. Continue with icon optical review, then remaining page-specific controls, cards/grids and dialogs.
4. Inspect Cloudflare edge rate-limits and establish normal heartbeat volume for public presence/analytics before designing quotas.
5. Define analytics deduplication and retention before any runtime or D1 changes.
5. Keep DUGA's revised-schema disposable D1 acceptance, independent review and Preview migration reconciliation on its separate review track.
