# DRM Premium — Source Audit
Date: 2026-11-25
Target ref: `feature/full-admin-panel`
Review mode: GitHub source inspection and repository-document reconciliation

## Scope

Inspected the current homepage, public scripts, Pages API catch-all, Admin, Live Users, Upload Studio, Profile styles, DUSS token definitions, README, DUSS specification, and continuity files. Reviewed the separate DUGA Draft PR #4 metadata and its linked validation records.

This is a source-level audit. It is not a browser test, penetration test, Cloudflare configuration audit, or Production verification.

## Work completed in this continuation

- Advanced DUSS from v0.5.0 to v0.6.0.
- Added 14 semantic icon-size tokens and migrated their audited selector consumers without intentionally changing their current CSS dimensions.
- Updated the five DUSS stylesheet cache keys to `duss-06`.
- Added `scripts/test-duss-tokens.py` and `.github/workflows/duss-sizing-smoke.yml` for future static regression checks.
- Added confirmation prompts to both the legacy visual-style save/reset actions and the Builder's direct live-style save action.
- Clarified the Builder's draft/live-style distinction in the UI and README.

## Findings

### F-01 — Website Builder has two different persistence paths

**Evidence**
- `/api/builder/state`, `/api/builder/draft`, and `/api/builder/history` operate on the versioned Builder document. The state response reports `publishEnabled: false`.
- `/api/builder/style` instead writes `settings.visual_editor_config`.
- The legacy visual editor writes the same setting through `/api/admin/settings`.
- The homepage fetches `/api/settings`, parses `visual_editor_config`, and applies the resulting style overrides.

**Conclusion**

The JSON Builder document is an unpublished draft. The separate “Save website style” and legacy visual-style actions persist settings that the homepage applies. Treating every Builder action as draft-only was inaccurate.

**Mitigation completed**

The direct live-style save and reset actions now require confirmation. Their status messages identify the public-site effect. README distinguishes the draft JSON document from the separately persisted style overrides.

**Not changed**

No publish endpoint, public renderer, D1 schema, or Builder persistence model was added or altered.

### F-02 — Public presence and analytics endpoints write to D1

**Evidence**
- `POST /api/presence` accepts authenticated and anonymous visitors and writes presence/activity rows.
- `POST /api/analytics/event` inserts an analytics event after validating the allowed tab name.
- The catch-all API performs same-origin Origin checks for mutations, but no per-IP rate limiter is visible in these route handlers.

**Conclusion**

These routes are intentionally reachable without an application login because the site records visitor presence and page events. Their D1 writes warrant resource-abuse controls. The absence of a route-local limiter in the inspected code does not prove the Cloudflare edge has no WAF/rate-limit protection; that configuration was not inspected.

**Next action**

Review the Pages/Cloudflare edge rules and measure expected write volume before designing route-level IP quotas, event deduplication, or retention controls. Do not change production routing or database behavior without a separate regression and approval step.

### F-03 — DUSS migration is source-level only

DUSS v0.6.0 centralizes selected role-badge, Admin action-button, and SVG/glyph icon dimensions. The icon migration intentionally preserves current CSS dimensions. It does not claim optical equivalence or establish rendered visual alignment.

**Outstanding validation**
- Run and inspect the dedicated DUSS GitHub Actions result.
- Compare rendered screenshots and computed bounding boxes across all five pages.
- Check desktop/mobile, keyboard and touch operation, 200% zoom, and Bengali/Latin overflow.
- Perform optical alignment review only after rendered evidence is available.

### F-04 — DUGA remains separate from the website branch

- DUGA review work is on `duga-foundation-review`, Draft PR #4, based on `main`.
- PR #4 remains open, Draft, and unmerged.
- GitHub Actions run `45594551319` completed successfully; its job includes the disposable Worker JavaScript syntax check and Python schema/registry tests.
- PR #4 records an earlier authenticated disposable-D1 Worker acceptance PASS (run `53d70371-008c-46a0-8bc3-33522be990eb`) on the disposable database only.
- The lifecycle review says the schema was subsequently extended with predecessor-link and AI-review constraints; revised-schema disposable D1 acceptance is still NOT RUN.
- Shared Preview migration reconciliation, third-party independent review, trusted service identity, Git provenance, and application integration tests remain outstanding. DUGA Preview write readiness remains NO-GO.

## Validation ledger

| Check | Result |
|---|---|
| DUSS token and selector source assertions | Inspected; automated repository script added |
| Five page cache keys | Updated to `duss-06`; source verification pending final check |
| DUSS GitHub Actions | Workflow added; successful run not confirmed in this audit |
| Browser screenshots / computed geometry | Not run |
| JavaScript browser interaction regression | Not run |
| Cloudflare edge/rate-limit configuration | Not inspected |
| Shared Preview or Production D1 | No write performed |
| Production deploy / merge | None |

## Recommended next sequence

1. Confirm the DUSS smoke workflow result; fix any static failure before extending the token layer.
2. Complete browser-based geometry and interaction checks for the migrated components.
3. Audit remaining icon variants, then buttons/badges across all page-specific surfaces.
4. Review Cloudflare edge rate-limits for public presence and analytics writes; design tests before changing handlers.
5. Keep DUGA's revised-schema disposable acceptance and independent review separate from the public-site branch.
6. Do not apply DUGA migration to shared Preview or Production until the migration-history and review gates close.
