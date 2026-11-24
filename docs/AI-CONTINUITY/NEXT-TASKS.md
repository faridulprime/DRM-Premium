# DRM Premium — Next Tasks
Last updated: 2026-11-25
Target review branch: duga-foundation-review
Draft PR: https://github.com/faridulprime/DRM-Premium/pull/4

## DUGA foundation completed
- Added SQL JSON value-shape constraints (arrays for affected systems/paths; objects for evidence, results, audit and job payloads) plus negative tests for wrong container types and malformed JSON.
- Isolated governance foundation from unrelated application/Admin changes on a branch based directly on `main`.
- Added specification, implementation plan, repository baseline and continuity documentation.
- Added role, ownership, system registry, dependency baseline and governance policy metadata.
- Added D1 operational schema design draft and Preview read-only preflight SQL; neither is a migration.
- Added API authorization and route contract design; no API is implemented.
- Added local SQLite schema smoke tests for request/review/approval/validation constraints, active assignment cardinality, temporal ordering, validation lifecycle and job lease/status/result invariants, nonblank required values, policy/registry validation and malformed-input cases.
- Latest expanded schema suite passed in GitHub Actions run `45508682329` (commit `d012b10f34e62a7895bebc4c0af6a31a9ea49230`).
- CI path filters cover governance assets, DUGA design/continuity docs, both validation test scripts and the workflow itself.
- Cloudflare Pages automatically published a branch Preview. This does not modify D1 and is not a Production deployment.

## Next review sequence
1. Continue static schema review for identity, JSON shape, referential and concurrency edge cases; add focused local tests where the database can enforce an invariant safely.
2. Design the API transition matrix with optimistic `state_version` checks; the SQL enum alone permits direct status changes.
3. Specify commit-bound gate invalidation: changed implementation SHA must stale prior review, approval and validation evidence.
4. Specify active assignment/scope checks, reviewer/implementer separation, trusted CI validation, canonical Git-ref verification and server-derived audit actors.
5. Add strict JSON array/type validation for affected systems and paths against a pinned Git registry revision.
6. Review Preview D1 migration history with read-only evidence; do not infer applied history from filenames or table shape.
7. Obtain a verified Preview backup or disposable D1 database before any candidate migration test.
8. D1-specific constraint, trigger, foreign-key and transaction tests require explicit approval and a disposable/Preview database; local SQLite is not D1 evidence.
9. Convert the reviewed SQL draft into a uniquely named additive migration only after migration-history reconciliation and review.
10. Implement Owner-only governance API routes only after schema and trusted actor/authentication design are approved.
11. Keep `main` and Production D1 untouched unless separately authorized.

## Not implemented
- No DUGA migration has been applied.
- No DUGA API or Control Center exists.
- No trusted AI service credentials or automatic DACE execution exist.
- No human identity assignments have been made.

## Preview D1 preflight handoff
A read-only diagnostic script is available at `governance/schemas/d1-preview-preflight.sql`. Run each SELECT/PRAGMA separately in the Cloudflare D1 Console against Preview only. Share the SQLite version, sqlite_master table/index/trigger listings, migration/meta table discovery and `PRAGMA table_info('users')` output. Do not execute the schema draft or any migration yet.
