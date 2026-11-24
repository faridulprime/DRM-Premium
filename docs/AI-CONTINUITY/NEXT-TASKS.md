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
