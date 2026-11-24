# DRM Premium — Next Tasks
Last updated: 2026-11-25
Target review branch: duga-foundation-review
Draft PR: https://github.com/faridulprime/DRM-Premium/pull/4

## DUGA foundation completed
- D1 docs confirm per-statement `D1Result.meta.changes`; use the conditional UPDATE's result for compare-and-swap row-count checks, not aggregate batch metadata.
- Hardened DACE finding-evidence JSON validation against malformed JSON and added negative tests.
- Reviewed current official Cloudflare D1 docs for FK enforcement, transactional `batch()` behavior and JSON function support; design docs distinguish documented platform guarantees from required D1 integration evidence.
- Added foreign-key integrity probes for orphan actor/evidence references and a clean `PRAGMA foreign_key_check` assertion.
- Added local compare-and-swap concurrency and audit-failure rollback probes; documented that Cloudflare D1 batch semantics still require D1 verification.
- Added SQL JSON value-shape constraints plus negative tests for wrong container types and malformed JSON.
- Isolated governance foundation from unrelated application/Admin changes on a branch based directly on `main`.
- Added specification, implementation plan, repository baseline and continuity documentation.
- Added role, ownership, system registry, dependency baseline and governance policy metadata.
- Added D1 operational schema design draft and Preview read-only preflight SQL; neither is a migration.
- Added API authorization and route contract design; no API is implemented.
- Added local SQLite schema smoke tests for request/review/approval/validation constraints, active assignment cardinality, temporal ordering, validation lifecycle, job lease/status/result invariants, nonblank values, policy/registry validation and malformed-input cases.
- Latest CI on head `bb3923dbb62dac5f1bcc240273a0dc9a85d15f06`: push run `45509730303` and PR run `45509738006` both completed successfully; the `sqlite-smoke-test` job and local schema/registry/validator test step passed.
- Added `docs/DUGA-D1-DISPOSABLE-ACCEPTANCE.md`, a stepwise Cloudflare D1 acceptance plan restricted to a newly created disposable database. It includes schema inventory, JSON/FK/append-only probes, batch rollback, per-statement row counts, and a required stale-writer/no-audit replay test.
- Closed the known CAS/audit gap at the design and local-test level: request rows store `last_transition_id`; audit rows store a unique nullable `transition_id`; conditional `INSERT ... SELECT` appends only for the exact successful state version. Local SQLite tests cover success, stale writer, replay, token reuse and audit failure rollback.
- Cloudflare Pages automatically published a branch Preview. This does not modify D1 and is not a Production deployment.

## Disposable D1 acceptance — next external step

- The CAS + conditional audit token pattern is now specified in `docs/DUGA-CAS-AUDIT-PATTERN.md` and locally tested.
- The D1 acceptance plan has been updated to test success, stale writer, replay, token reuse, audit-failure rollback and two competing writers on an isolated D1 database.
- No Cloudflare D1 tools are connected to this session; no database or Worker has been created/deployed.
- Required: user provisions a newly created disposable D1 database (not existing Preview or Production), confirms its database name/ID and supplies the reviewed `users` schema baseline or a synthetic test-user ID. Then bind it only to a separate acceptance Worker and execute the plan.
- Do not create billable resources, change Pages bindings, deploy a worker, apply a migration or use shared Preview/Production as a substitute.

## Immediate blockers / required evidence
1. D1 acceptance has not been run. A newly created disposable D1 database and explicit authorization to create/use that resource are required; do not substitute shared Preview or Production.
2. The API concurrency contract has a known unresolved edge case: a zero-row conditional UPDATE is not a SQL error, so a later audit INSERT in the same transactional batch may still execute. Do not assume batch transactionality solves this.
3. Before implementing state-changing API routes, choose and test a design that makes the audit INSERT conditional on the exact successful transition (e.g. a unique transition token written by the successful update and checked by the audit insert). Prove stale writers and replayed tokens create no audit event.
4. Human authentication/assignment authorization, reviewer/implementer separation, commit-bound evidence invalidation, trusted validation and canonical Git-ref checks remain design contracts, not runtime enforcement.

## Next review sequence
1. Review the disposable D1 acceptance plan for completeness and provision a separate disposable database only after explicit resource-creation approval.
2. Run every acceptance probe in `docs/DUGA-D1-DISPOSABLE-ACCEPTANCE.md` against that disposable D1; retain exact outputs and errors.
3. Verify the CAS token + conditional audit insert pattern on D1, including simultaneous writers, stale state, replay, token reuse and rollback.
4. Complete the API transition matrix with optimistic `state_version` checks.
5. Specify commit-bound gate invalidation: changed implementation SHA must stale prior review, approval and validation evidence.
6. Specify active assignment/scope checks, reviewer/implementer separation, trusted CI validation, canonical Git-ref verification and server-derived audit actors.
7. Review Preview D1 migration history read-only; do not infer applied history from filenames or table shape.
8. Convert the reviewed SQL draft into a uniquely named additive migration only after migration-history reconciliation, D1 acceptance and independent review.
9. Implement Owner-only governance API routes only after schema, trusted actor/authentication and concurrency design are approved.
10. Keep `main` and Production D1 untouched unless separately authorized.

## Not implemented / not verified
- No DUGA migration has been applied.
- No DUGA API or Control Center exists.
- No trusted AI service credentials or automatic DACE execution exist.
- No human identity assignments have been made.
- No disposable D1 database has been created or tested by the assistant.
- Local SQLite CI and a successful Pages Preview do not establish Cloudflare D1 behavior.

## Preview D1 preflight handoff
A read-only diagnostic script is available at `governance/schemas/d1-preview-preflight.sql`. Run each SELECT/PRAGMA separately in the Cloudflare D1 Console against Preview only. Share the SQLite version, sqlite_master table/index/trigger listings, migration/meta table discovery and `PRAGMA table_info('users')` output. Do not execute the schema draft or any migration in a shared Preview database.
