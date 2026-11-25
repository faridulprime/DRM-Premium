# DRM Premium — Source Audit
Date: 2026-11-25
Target ref: `feature/full-admin-panel`
Review mode: GitHub source inspection and repository-document reconciliation

## Scope

Inspected the current homepage, public scripts, Pages API catch-all, Admin, Live Users, Upload Studio, Profile styles, DUSS token definitions, README, DUSS specification, and continuity files. Reviewed the separate DUGA Draft PR #4 metadata and its linked validation records.

This is a source-level audit. It is not a browser test, penetration test, Cloudflare configuration audit, or Production verification.

## Work completed in this continuation

- Advanced DUSS from v0.5.0 through v0.7.0.
- Corrected the token stylesheet's stale version header and added a regression assertion so its marker must match DUSS v0.6.0; v0.7.0 keeps this check active.
- Added 20 semantic icon/slot-size tokens and migrated their audited selector consumers without intentionally changing effective CSS dimensions.
- Updated the five DUSS stylesheet cache keys to `duss-07`.
- Added `scripts/test-duss-tokens.py` and `.github/workflows/duss-sizing-smoke.yml` for static regression checks.
- Tokenized the two remaining audited icon variants and the later hardcoded responsive search overrides; removed one superseded 25px Profile brand declaration.
- Completed the Admin search token wiring in both `admin.css` and `theme.css`, and migrated the Homepage mobile sidebar's 24px icon slot to the existing navigation-size token.
- Strengthened regression checks to require token references in every matching compact-search and Profile brand selector block.
- Confirmed DUSS v0.7.0 GitHub Actions run #10 and expanded runs #12–#13 passed static source checks. Run #13 validated 20 token definitions and 20 mapped consumers; its printed summary still said 16, so the test output was corrected to calculate counts dynamically and a follow-up run is required.
- Updated the DUSS workflow actions to current v7 majors after run #10 exposed a Node 20 deprecation/forced Node 24 warning.
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

### F-02 — Public presence and analytics endpoints have no route-local request metering

**Evidence**
- `POST /api/presence` is handled before the general authenticated-user gate. It accepts both a valid session and an anonymous visitor cookie.
- A signed-in presence heartbeat executes four D1 statements: an activity-hour upsert, activity-history cleanup, visitor-presence upsert, and stale-presence cleanup.
- A guest heartbeat executes two D1 statements: visitor-presence upsert and stale-presence cleanup. The presence schema has an index on `visitor_presence(last_seen)`.
- Frontend presence heartbeat functions in `app.js`, `admin.js`, and `live-users.js` use a 30-second interval. This is the legitimate baseline to preserve when sizing any future rate rule.
- `POST /api/analytics/event` validates the `tab` value against a fixed allow-list, then inserts one `analytics_events` row for each accepted request. No per-IP quota or duplicate-event suppression is visible in this route.
- `migrations/0004_admin_analytics.sql` creates an index on `analytics_events(tab,created_at)`. No analytics-event retention/delete path was found in the inspected Pages catch-all API; this does not exclude an external scheduled cleanup.
- The shared non-GET guard requires a matching `Origin` and JSON content type. This is a browser-origin/CSRF gate, not a request-rate limit; an API client can send an `Origin` header.
- `readBody(req)` checks the declared `Content-Length` against 20,000 bytes before calling `req.json()`. This is a header check rather than a measured streaming-byte limit when the header is absent or inaccurate.
- Registration OTP uses separate controls: a 60-second per-email resend interval and at most five requests per IP hash in a 15-minute window. Those controls do not cover presence or analytics.
- No Cloudflare WAF, bot-management, or rate-limit configuration was available in the repository source review.

**Conclusion**

The public write paths have a source-level resource-abuse exposure that needs edge-configuration verification. The available source proves repeated D1 writes are possible through these unauthenticated routes, but it does not prove that the deployed Cloudflare edge lacks protection or that abuse has occurred. Treat this as an unverified risk item, not a confirmed exploitable vulnerability.

**Next action**

Inspect the actual Pages/Cloudflare edge rules and establish normal traffic/heartbeat volume first. Then design endpoint-specific limits with enough burst headroom for the 30-second heartbeat, an event-deduplication policy, and an analytics retention/aggregation policy. Avoid raw-IP storage in D1 unless a documented privacy and retention basis exists. Do not change live route behavior or D1 schema until the controls have regression tests and separate approval.

### F-03 — DUSS migration is source-level only

DUSS v0.7.0 centralizes selected role-badge, Admin action-button, and 20 audited SVG/glyph/icon-slot dimensions. The latest source audit added the 11px Live Users role glyph and 15px Profile drawer logout glyph, and removed hardcoded duplicate search-icon overrides. The icon migration intentionally preserves current CSS dimensions. It does not claim optical equivalence or establish rendered visual alignment.

**Outstanding validation**
- DUSS GitHub Actions run #10 passed on commit `58c8cbaa4a392757a4c34cd4d472f568fd729f7a`; run #10 verifies source wiring only.
- Compare rendered screenshots and computed bounding boxes across all five pages.
- Check desktop/mobile, keyboard and touch operation, 200% zoom, and Bengali/Latin overflow.
- Perform optical alignment review only after rendered evidence is available.

### F-04 — DUGA remains separate from the website branch

- DUGA review work is on `duga-foundation-review`, Draft PR #4, based on `main`.
- PR #4 remains open, Draft, and unmerged.
- GitHub Actions run `45601804933` (run 244) completed successfully on the review branch's fixture-parity/test update before the latest documentation-only continuity commit. Its logs show the Worker syntax check, DUGA SQLite schema tests, the new draft/fixture/Console parity test, governance validation and malformed-input tests all passed.
- PR #4 records an earlier authenticated disposable-D1 Worker acceptance PASS (run `53d70371-008c-46a0-8bc3-33522be990eb`) on the disposable database only.
- The lifecycle review says the schema was subsequently extended with predecessor-link and AI-review constraints; revised-schema disposable D1 acceptance is still NOT RUN.
- Shared Preview migration reconciliation, third-party independent review, trusted service identity, Git provenance, and application integration tests remain outstanding. DUGA Preview write readiness remains NO-GO.

## Validation ledger

| Check | Result |
|---|---|
| DUSS token and selector source assertions | GitHub Actions run #10 passed: 16 tokens, 16 consumers, audited overrides, prior badge/button tokens and CSS brace checks |
| Five page cache keys | All five pages use `duss-07`; run #10 verified each |
| DUSS GitHub Actions | Run #10 succeeded; workflow action majors upgraded to v7 for the next run |
| Browser screenshots / computed geometry | Not run |
| JavaScript browser interaction regression | Not run |
| Cloudflare edge/rate-limit configuration | Not inspected |
| Shared Preview or Production D1 | No write performed |
| Production deploy / merge | None |

## Recommended next sequence

1. Run the DUSS smoke workflow after the v7 action upgrade and inspect its logs.
2. Complete browser-based geometry and interaction checks; no browser-rendered proof is currently available.
3. Audit remaining icon variants, then buttons/badges across all page-specific surfaces.
4. Inspect Cloudflare edge rate-limits for public presence and analytics writes; measure normal heartbeat traffic before setting thresholds.
5. Define event deduplication and analytics retention requirements before changing the API or database.
5. Keep DUGA's revised-schema disposable acceptance and independent review separate from the public-site branch.
6. Do not apply DUGA migration to shared Preview or Production until the migration-history and review gates close.
