# DRM Premium — Next Tasks
Last updated: 2026-11-25
Target branch: feature/full-admin-panel

## DUGA completed
- Foundation architecture and repository baseline documents.
- GitHub desired-state / D1 operational-state boundary.
- System registry, roles, ownership definitions, dependency baseline and governance policies.
- D1 operational schema design draft (not a migration).
- API authorization and route contract draft (not implemented).

## Next implementation sequence
1. Review D1 design, especially append-only audit behavior, role assignment scope, state transitions and AI principal attribution. Local SQLite syntax/constraint probes passed; see docs/DUGA-D1-SCHEMA-DESIGN.md.
2. Confirm actual Preview D1 applied migration history; do not infer from migration filenames.
3. Create a disposable Preview D1 database or verified backup before testing a candidate migration.
4. Convert the approved SQL draft into a uniquely named additive migration only after review.
5. Apply candidate migration only to disposable/Preview D1; test constraints, triggers, indexes and foreign keys.
6. Implement Owner-only governance API routes with server-derived actor identity and state transition checks.
7. Add automated schema/registry validation to CI.
8. Perform regression tests for existing auth, content, registration, profile, presence and Website Builder routes.
9. Keep Production D1 and main untouched unless separately authorized.

## Not implemented
- No DUGA migration has been applied.
- No DUGA API or Control Center exists.
- No AI service credentials or automatic DACE execution exist.


## Preview D1 preflight handoff
A read-only diagnostic script is available at `governance/schemas/d1-preview-preflight.sql`. Run each SELECT separately in the Cloudflare D1 Console against the Preview database only. Share the outputs for the SQLite version, sqlite_master table/index/trigger listings, migration/meta table discovery, and `PRAGMA table_info('users')`. Do not execute the schema draft or any migration yet. The script contains SELECT/PRAGMA inspection only and makes no database changes.

## DUGA validation automation — 2026-11-25
- Added `scripts/validate-duga-registries.py` for standard-library structural checks of roles, role kinds, required governance roles, permission lists, separation-of-duties statements, dependency edge metadata/types, duplicate edges, page asset references, and dependency-rule documentation.
- Added the registry validator to `.github/workflows/duga-schema-smoke.yml` alongside the local SQLite schema smoke test.
- CI exposed an existing registry edge type, `governance-documentation`, that was missing from the validator's accepted type set. The validator and dependency rules now explicitly recognize it.
- CI run for commit `9813aa01a1f7dd0d9d755d89d62f6e917acdf291` completed both test commands successfully; the run's job finalization was still being checked at the time of this note.
- The workflow remains scoped to the feature branch and pull requests targeting `main`; no deploy, migration or D1 action is included.
