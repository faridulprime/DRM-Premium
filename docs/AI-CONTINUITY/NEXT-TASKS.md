# DRM Premium — Next Tasks
Last updated: 2026-11-25
Target review branch: duga-foundation-review
Draft PR: https://github.com/faridulprime/DRM-Premium/pull/4

## DUGA foundation completed
- Isolated governance foundation from unrelated application/Admin changes on a branch based directly on `main`.
- Added specification, implementation plan, repository baseline and continuity documentation.
- Added role, ownership, system registry, dependency baseline and governance policy metadata.
- Added D1 operational schema design draft and Preview read-only preflight SQL; neither is a migration.
- Added API authorization and route contract design; no API is implemented.
- Added local SQLite schema smoke tests for request/review/approval/validation constraints, policy/registry validator and malformed-input tests.
- GitHub Actions run 45507058477 passed: SQLite schema smoke test, governance validator and five malformed-input cases. Expanded lifecycle probes passed in run 45507227112 (commit `93a767474e9a046a27012df9b412b64605c9ce9c`).
- CI path filters cover all governance assets and both validation test scripts.
- Cloudflare Pages automatically published a branch Preview. This does not modify D1 and is not a Production deployment.

## Next review sequence
1. Implement and test the future API transition matrix with optimistic state_version checks; the SQL enum alone permits direct status changes.
2. Implement commit-bound gate invalidation: changed implementation SHA must stale prior review, approval and validation evidence.
3. Enforce active assignment/scope checks, reviewer/implementer separation, trusted CI validation and server-derived audit actors.
4. Add JSON array/type validation for affected systems and paths against the pinned Git registry.
5. Re-run D1-specific tests only against a disposable/Preview D1 after explicit approval; local SQLite tests are not D1 evidence.
4. Review Preview D1 migration history with read-only evidence; do not infer applied history from filenames or table shape.
5. Obtain a verified Preview backup or disposable D1 database before any candidate migration test.
6. Convert the approved SQL draft into a uniquely named additive migration only after migration-history reconciliation and review.
7. Test D1-specific constraints, triggers, foreign keys and transaction behavior only in disposable/Preview D1 after explicit approval.
8. Implement Owner-only governance API routes only after schema and trusted actor/authentication design are approved.
9. Keep `main` and Production D1 untouched unless separately authorized.

## Not implemented
- No DUGA migration has been applied.
- No DUGA API or Control Center exists.
- No trusted AI service credentials or automatic DACE execution exist.
- No human identity assignments have been made.

## Preview D1 preflight handoff
A read-only diagnostic script is available at `governance/schemas/d1-preview-preflight.sql`. Run each SELECT/PRAGMA separately in the Cloudflare D1 Console against Preview only. Share the SQLite version, sqlite_master table/index/trigger listings, migration/meta table discovery and `PRAGMA table_info('users')` output. Do not execute the schema draft or any migration yet.
