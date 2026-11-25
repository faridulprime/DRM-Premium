# DRM Premium — Next Tasks
Last updated: 2026-11-25
Target review branch: `duga-foundation-review`
Draft PR: https://github.com/faridulprime/DRM-Premium/pull/4

## DUGA foundation and test assets

- Architecture, implementation plan, repository baseline, continuity docs, roles, ownership, registry, dependencies and policies are present.
- D1 operational schema remains design-only.
- `scripts/test-duga-fixture-sync.py` compares the current schema draft, disposable fixture and Console SQL through comment-free source parity and in-memory SQLite schema-object checks.
- Disposable fixture and Console SQL are synchronized, including the predecessor-link column/index/immutable trigger and AI-review terminal-rejection guard.
- The parity test is in the DUGA schema smoke workflow and its paths are in both push and PR filters.
- CI after the workflow v7 upgrade: push run #251 (`45605522156`) and PR run #252 (`45605531276`) both succeeded against current review head `37f8e021793549478c0962c2eb22d7d621c048ba`. Worker syntax, schema SQLite tests, fixture parity, governance validation and malformed-input tests passed; the Node 20 action deprecation warning was absent.
- The older owner-operated D1 Worker aggregate PASS predates the latest schema additions. It does not prove revised-schema Cloudflare D1 acceptance.

## Next implementation/review sequence

0. CI-only action upgrade verified by push run #251 and PR run #252. This does not constitute Cloudflare D1 acceptance.
1. Obtain explicit owner approval for a fresh revised-schema disposable D1 acceptance deployment/test. Confirm the exact disposable database name and ID before deployment.
2. Use a newly created disposable D1 database only; never bind the Worker to shared Preview or Production. Apply the synchronized current fixture only to that disposable DB.
3. Run the authenticated Worker and retain the complete JSON response, including nested per-case counts. Confirm CAS success, stale writer, replay, token reuse, forced audit rollback and competing-writer assertions.
4. Obtain independent third-party review of the SQL schema, state machine, authorization policy and CAS/audit design.
5. Reconcile the actual shared Preview migration history and complete object inventory before proposing any Preview migration.
6. Test canonical Git provenance, role/scope authorization, commit-bound evidence invalidation, block/unblock provenance, linked terminal requests and immutable audit behavior in the future service contract.
7. Test the Pages catch-all router/session integration and existing application regressions before proposing DUGA API runtime integration.

## Not implemented / not authorized

- No DUGA migration is applied to shared Preview or Production.
- No governance write API, AI service credential, validation-service identity or Control Center runtime exists.
- DACE remains analysis-only by policy; no automatic deletion/cleanup runs.
- Do not merge PR #4, modify `main`, deploy Production, change Cloudflare bindings/secrets, or mutate shared Preview without explicit, separate owner approval.
- Human identities remain unassigned.

## Evidence distinction

- CI/local SQLite parity is source validation only.
- The earlier disposable D1 Worker aggregate PASS is historical evidence for the earlier schema, not the revised schema.
- Shared Preview screenshot/query evidence is owner-supplied and does not establish applied migration history.
