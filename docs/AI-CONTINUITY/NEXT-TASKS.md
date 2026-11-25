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

## Disposable D1 acceptance — completed (disposable environment only)

- The CAS + conditional audit token pattern is now specified in `docs/DUGA-CAS-AUDIT-PATTERN.md` and locally tested.
- The D1 acceptance plan has been updated to test success, stale writer, replay, token reuse, audit-failure rollback and two competing writers on an isolated D1 database.
- Owner provisioned and confirmed disposable D1 `drm-duga-acceptance-disposable` (`6d512429-34a3-498b-9430-45f11d382da9`); it was empty except `_cf_KV`.
- Owner manually applied the comment-free fixture with synthetic `users(id)`. Screenshots verify all eight DUGA tables, both audit triggers, clean foreign-key check, successful audit INSERT, and blocked audit UPDATE/DELETE.
- Deployed the separate bearer-secret-protected acceptance Worker as `duga-d1-acceptance-disposable`, with Wrangler config pinned to this disposable DB only. Temporary diagnostic route was removed before final redeployment.
- Authenticated `POST /run` returned `results.pass = true` at `2026-11-25T01:04:19.420Z`; run ID `53d70371-008c-46a0-8bc3-33522be990eb`.
- The Worker PASS predicate requires successful CAS + audit (1/1), stale writer/replay/token reuse (0/0), forced audit CHECK failure with transactional rollback and unchanged state, and a two-writer race with exactly one winner (1/1), one loser (0/0), and exactly one audit event.
- PowerShell output exposed the aggregate PASS but not nested per-case counts; the exact assertion predicates are documented in `docs/DUGA-D1-DISPOSABLE-ACCEPTANCE.md`.
- Test-only synthetic rows and audit events remain in the disposable database. Do not bind it to Pages or shared Preview/Production.


## API security and lifecycle design — proposed; blocked-state policy selected

- Added `docs/DUGA-API-SECURITY-AND-LIFECYCLE-DESIGN.md` covering bootstrap Owner-session authorization, future scoped assignments, AI/validation trust boundaries, risk approval, commit-bound evidence staleness, guarded commit updates, a candidate transition matrix, route payload rules and security/regression tests.
- Added an explicit candidate transition matrix from the existing DUGA lifecycle states. It is not approved executable policy.
- Owner decisions recorded: `blocked` is resumable (option B); `rejected` and `cancelled` are terminal, and renewed attempts require a new linked Change Request with independent evidence/approvals and preserved original history. Unblock requires immutable prior-state provenance, authorized action with rationale and proof the condition cleared, CAS + audit, and re-evaluation of all gates. Proposed rework edges still await Owner review.
- API integration readiness remains NO-GO for Preview write endpoints. No API runtime code, migration or binding was changed.
- Next: review/confirm the remaining proposed rework edges and complete the transition matrix; then specify canonical Git ref/PR-base verification and policy/registry revision pinning. Only after those reviews and Preview migration-history reconciliation should implementation planning be revisited.

## Immediate blockers / required evidence
1. Disposable D1 CAS + audit acceptance is PASS for the isolated Worker/database only. Production and shared Preview remain untested and untouched.
2. Human authentication/assignment authorization, reviewer/implementer separation, commit-bound evidence invalidation, trusted validation and canonical Git-ref checks remain design contracts, not runtime enforcement.

## Next review sequence
1. Independently review the disposable D1 evidence and Worker implementation; retain the run ID and aggregate PASS qualification.
2. Complete Owner review of proposed rework edges and the API transition matrix, retaining optimistic `state_version` checks, explicit block/unblock paths, terminal rejected/cancelled states and new-linked-request semantics.
3. Specify commit-bound gate invalidation: changed implementation SHA must stale prior review, approval and validation evidence.
4. Specify active assignment/scope checks, reviewer/implementer separation, trusted CI validation, canonical Git-ref verification and server-derived audit actors.
5. Review Preview D1 migration history read-only; do not infer applied history from filenames or table shape.
6. Convert the reviewed SQL draft into a uniquely named additive migration only after migration-history reconciliation, disposable D1 acceptance and independent review.
7. Implement Owner-only governance API routes only after schema, trusted actor/authentication and concurrency design are approved.
8. Keep `main` and Production D1 untouched unless separately authorized.

## Not implemented / not verified
- No DUGA migration has been applied.
- No DUGA API or Control Center exists.
- No trusted AI service credentials or automatic DACE execution exist.
- No human identity assignments have been made.
- The disposable D1 Worker suite returned aggregate PASS, but its nested individual counts were not printed in the captured PowerShell output. This is not Production or shared Preview acceptance.
- The assistant did not directly access Cloudflare; deployment and execution were owner-operated.
- Local SQLite CI and a successful Pages Preview do not establish Production/shared Preview behavior.

## Preview D1 preflight handoff
A read-only diagnostic script is available at `governance/schemas/d1-preview-preflight.sql`. Run each SELECT/PRAGMA separately in the Cloudflare D1 Console against Preview only. Share the SQLite version, sqlite_master table/index/trigger listings, migration/meta table discovery and `PRAGMA table_info('users')` output. Do not execute the schema draft or any migration in a shared Preview database.

## Owner decision recorded — 2026-11-25
- Selected option B: `blocked` is resumable, not terminal.
- Unblocking must be an explicit authorized operation with a non-empty rationale and evidence that the blocking condition is cleared. It must use CAS + an append-only audit event, retain the prior state in immutable block-event provenance, and re-evaluate all gates before selecting a safe resume stage.
- This is a policy/design decision only; no runtime code or schema migration has been implemented.
