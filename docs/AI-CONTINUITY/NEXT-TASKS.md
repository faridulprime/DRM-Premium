# DRM Premium — Next Tasks
Last updated: 2026-11-25
Target review branch: `duga-foundation-review`
Draft PR: https://github.com/faridulprime/DRM-Premium/pull/4

## DUGA foundation and test assets

- Architecture, implementation plan, repository baseline, continuity docs, roles, ownership, registry, dependencies and policies are present.
- D1 operational schema remains design-only.
- Added `scripts/test-duga-fixture-sync.py`: compares the current draft schema, disposable fixture and Console SQL through comment-free source parity and in-memory SQLite schema-object checks.
- Synchronized `scripts/duga-d1-disposable-acceptance-console.sql` with the latest fixture. It now contains the predecessor-link column/index/immutable trigger and AI-review terminal-rejection guard.
- Added fixture/Console/test paths to both push and PR path filters and added the parity test to the workflow command block.
- Updated Worker README and acceptance record to qualify the older owner-operated disposable D1 aggregate PASS: it predates the latest schema additions and does not prove final-schema D1 acceptance.

## Next implementation/review sequence

1. Obtain a fresh GitHub Actions run against the latest PR head. Verify that the run actually executes all four steps: Worker syntax check, local schema tests, fixture/Console parity test, governance validation and malformed-input tests.
2. Review any failure in the parity test; do not treat a prior workflow run on an earlier PR merge commit as validation of the newly added script.
3. Create or use a fresh disposable D1 database only after explicit owner approval for deployment/testing. Confirm database name and ID before any Worker deploy. Never bind the Worker to shared Preview or Production.
4. Apply the latest fixture only to that disposable database under an owner-operated test gate; run the authenticated Worker and save the complete JSON response, including nested per-case counts.
5. Obtain independent third-party review of the schema, state machine, authorization policy and CAS/audit design.
6. Reconcile the actual shared Preview migration history and complete object inventory before proposing any Preview migration.
7. Test canonical Git provenance, role/scope authorization, commit-bound evidence invalidation, block/unblock provenance, linked terminal requests and immutable audit behavior in the future service contract.
8. Only after all gates pass, propose a separately scoped Owner-only API integration and regression plan.

## Not implemented / not authorized

- No DUGA migration is applied to shared Preview or Production.
- No governance write API, AI service credential, validation-service identity or Control Center runtime exists.
- DACE remains analysis-only by policy; no automatic deletion/cleanup runs.
- Do not merge PR #4, modify `main`, deploy Production, change Cloudflare bindings/secrets, or mutate shared Preview without explicit, separate owner approval.
- Human identities remain unassigned.

## Evidence distinction

- Local SQLite schema/fixture parity is source validation only.
- The earlier disposable D1 Worker aggregate PASS is historical evidence for the earlier schema, not the revised schema.
- Shared Preview screenshot/query evidence is owner-supplied and does not establish applied migration history.
