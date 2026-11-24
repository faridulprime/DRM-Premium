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
- Added local SQLite schema smoke tests and structural registry validation.
- CI run 45506463903 passed for commit `3264662e545af5e3336a1949946130c14bcb7290`.
- CI path filters have been widened to cover all `governance/**` changes, not only a subset of registry files.
- Cloudflare Pages automatically published a branch Preview. This does not modify D1 and is not a Production deployment.

## Next review sequence
1. Review validator coverage and schema invariants against the written governance policies.
2. Review D1 design, especially assignment uniqueness/revocation, state transitions, append-only audit behavior, actor attribution and commit-bound approval gates.
3. Confirm actual Preview D1 applied migration history; do not infer it from migration filenames or table shape.
4. Obtain a verified Preview backup or create a disposable D1 database before any candidate migration test.
5. Convert the approved SQL draft into a uniquely named additive migration only after migration-history reconciliation and review.
6. Test D1-specific constraints, triggers, foreign keys and transaction behavior only in disposable/Preview D1 after explicit approval.
7. Implement Owner-only governance API routes only after schema and trusted actor/authentication design are approved.
8. Add API and application regression tests for existing auth, content, registration, profile, presence and Website Builder routes.
9. Keep `main` and Production D1 untouched unless separately authorized.

## Not implemented
- No DUGA migration has been applied.
- No DUGA API or Control Center exists.
- No trusted AI service credentials or automatic DACE execution exist.
- No human identity assignments have been made.

## Preview D1 preflight handoff
A read-only diagnostic script is available at `governance/schemas/d1-preview-preflight.sql`. Run each SELECT/PRAGMA separately in the Cloudflare D1 Console against Preview only. Share the SQLite version, sqlite_master table/index/trigger listings, migration/meta table discovery and `PRAGMA table_info('users')` output. Do not execute the schema draft or any migration yet.
