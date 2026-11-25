# DUGA — Disposable Cloudflare D1 Acceptance Plan

Status: PASS — owner-operated authenticated Worker acceptance completed on the named disposable Cloudflare D1 database on 2026-11-25. The Worker returned `results.pass = true` for the combined CAS, audit atomicity, rollback, replay, token-reuse and competing-writer assertions. This is disposable-D1 evidence only; it is not Production or shared Preview acceptance.
Applies to: `duga-foundation-review` schema draft v0.1.0 at commit `c33045567c4a94cc6c818d12a66efb4109c2b894`.
Purpose: prove the candidate DUGA schema against Cloudflare D1 itself before any migration is proposed.

## 0. Hard safety gate

Run this plan only against a newly created, disposable D1 database with no production data and no application traffic.

- Do not use Production D1.
- Do not use the existing Preview D1 unless its owner has verified a restorable backup and explicitly approved destructive testing.
- Do not bind the disposable database to the live Pages project.
- Record the database name/ID and verify it in the Cloudflare dashboard before running SQL.
- Stop if the selected database cannot be positively identified as disposable.
- This plan is not authorization to create billable resources, change bindings, run a migration, or deploy anything.

## 1. Prepare a disposable test database

1. Create a new D1 database through the Cloudflare dashboard or Wrangler, explicitly named for disposable DUGA acceptance testing.
2. This database was confirmed empty except for Cloudflare's internal `_cf_KV` table. Do not import the application's real users schema or data.
3. Use the isolated test fixture `scripts/duga-d1-disposable-acceptance-fixture.sql`. It creates only a minimal synthetic `users(id)` parent table and then applies the reviewed DUGA schema draft.
4. The fixture is test-only and must be run only after visually verifying the exact database name and ID in the Cloudflare dashboard. It must never be run against Production or shared Preview.
5. Save the database name/ID, SQLite version, fixture commit, schema baseline and test timestamp with the test results.

If a clean disposable database cannot be provisioned, stop. Do not substitute Preview or Production.

## 2. Apply the DUGA schema draft manually

Use `scripts/duga-d1-disposable-acceptance-fixture.sql` from the review branch. It contains a minimal synthetic `users(id)` parent followed by the exact reviewed contents of `governance/schemas/d1-operational-schema.sql`.

- Apply it only to the verified disposable database.
- Record whether each CREATE TABLE, CREATE INDEX and CREATE TRIGGER statement succeeds.
- If any statement fails, stop and preserve the exact error and database state for diagnosis.
- Do not convert the draft into `migrations/0009_...` during this test.

## 3. Structural inventory

Run each query separately and save the outputs:

```sql
SELECT sqlite_version() AS sqlite_version;

SELECT type, name, tbl_name, sql
FROM sqlite_master
WHERE name LIKE 'duga_%'
ORDER BY type, name;

PRAGMA foreign_key_check;

PRAGMA table_info('duga_change_requests');
PRAGMA table_info('duga_audit_events');
```

Acceptance:
- All eight expected DUGA tables exist.
- All expected DUGA indexes and the two audit append-only triggers exist.
- `PRAGMA foreign_key_check` returns no rows after valid fixtures.
- The observed schema matches the reviewed draft; no unreviewed objects are introduced.

## 4. Constraint probes

Use unique synthetic IDs for every probe. Substitute a real synthetic `users.id` from this disposable database wherever a human user FK is required. Do not run these statements against any shared database.

### 4.1 JSON value-shape checks

For each applicable table, attempt both a malformed JSON value and a valid JSON value of the wrong top-level type. Each invalid INSERT must fail; a correctly shaped JSON value must be accepted when all other required fields are valid.

Expected top-level shapes:
- arrays: `duga_change_requests.affected_systems_json`, `affected_paths_json`
- objects: review/finding evidence, validation results, audit payloads, job input and non-null job result

Include the DACE finding-evidence case specifically. The malformed JSON probe must be rejected cleanly by the CHECK constraint.

### 4.2 Foreign-key checks

Attempt orphan references for:
- assignment `user_id` / `assigned_by_user_id`
- review `change_request_id` / `reviewer_user_id`
- approval `change_request_id` / `approver_user_id`
- validation `change_request_id`

Each orphan INSERT must fail. Then insert valid parent/child fixtures and confirm `PRAGMA foreign_key_check` returns no rows.

### 4.3 Append-only audit checks

Insert one valid audit event, then separately attempt:
```sql
UPDATE duga_audit_events SET event_type = 'tampered' WHERE id = '<synthetic-audit-id>';
DELETE FROM duga_audit_events WHERE id = '<synthetic-audit-id>';
```
Both mutations must fail because of the append-only triggers. Confirm the original event remains unchanged.

## 5. Transaction and compare-and-swap probes

Cloudflare documents `D1Database.batch()` as transactional, but the actual DUGA statement sequence must be tested through a small Worker bound only to the disposable database. The isolated Worker source at `scripts/duga-d1-acceptance-worker/` returns each statement's individual `D1Result.meta.changes` value and batch error/result. It was deployed only as `duga-d1-acceptance-disposable`, bound only to the disposable D1 ID recorded below. Do not infer row counts from aggregate metadata.

Probe A — rollback:
1. In one `db.batch([...])`, perform a valid disposable test-row insert followed by a deliberately failing statement.
2. Confirm the batch rejects.
3. Query the test row and confirm the first insert was rolled back.

Probe B — affected-row reporting:
1. Perform a conditional update using the expected current `state_version`.
2. Confirm the matching update reports `meta.changes === 1`.
3. Repeat with the stale version.
4. Confirm the stale update reports `meta.changes === 0`.

Probe C — audit atomicity:
- Do not assume that a zero-row conditional UPDATE automatically prevents a later audit INSERT in the same batch. Batch transactionality rolls back on statement errors; a zero-row UPDATE is not itself an error.
- The selected draft design is documented in `docs/DUGA-CAS-AUDIT-PATTERN.md`. It uses a server-generated one-time token stored by the successful conditional UPDATE (`last_transition_id`), a conditional `INSERT ... SELECT` that checks the exact incremented version/token, and a unique partial index on non-null audit `transition_id`.
- Run the exact pattern from that document as a two-statement `db.batch([...])`; capture each statement's own `meta.changes`.
- Verify success: UPDATE changes=1 and audit INSERT changes=1.
- Verify stale expected version: UPDATE changes=0 and audit INSERT changes=0.
- Verify replay of the original token: UPDATE changes=0 and audit INSERT changes=0.
- Verify reuse of an already audited token against the next expected version: UPDATE changes=0 and audit INSERT changes=0.
- Force the audit INSERT to fail a CHECK constraint and confirm the batch rejects and the state row remains at its pre-batch version/status/token.
- Run two competing transitions with different tokens and the same expected version. Exactly one may win; there must be exactly one audit event for the winning token.

This probe remains a required blocker. Local SQLite models these cases, but D1 acceptance must demonstrate them on Cloudflare D1 before state-changing API routes are implemented.

## 6. Evidence package

Record:
- disposable database name/ID and confirmation it is not Production or shared Preview
- reviewed source commit SHA and schema file hash
- SQLite version
- statement-by-statement schema application outcome
- table/index/trigger inventory
- every positive and negative constraint probe with exact result/error
- foreign-key check output
- Worker test source/commit and each batch statement's individual `meta.changes`
- rollback, stale-writer and audit-atomicity outcomes
- tester, timestamp and any deviations

## 7. Exit criteria

D1 acceptance is PASS only when every required probe above passes on Cloudflare D1, including the audit-atomicity stale-writer case. A local SQLite pass, successful Pages Preview deployment, or review of Cloudflare documentation is not a substitute.

If any probe fails or cannot be run, report PARTIAL/FAIL with the exact gap. Do not create a production migration, connect the test database to the app, implement state-changing API routes, merge PR #4, or deploy Production as a consequence of this test.

## 8. Current verified status

Owner-operated Cloudflare D1 Console observations (2026-11-24):
- Disposable database: `drm-duga-acceptance-disposable` / `6d512429-34a3-498b-9430-45f11d382da9`.
- The database was initially empty except for Cloudflare's `_cf_KV` table.
- The comment-free fixture was manually executed. The inventory query showed all eight DUGA tables and both append-only audit triggers.
- `PRAGMA foreign_key_check` completed successfully with no violation rows shown.
- A synthetic audit event INSERT succeeded.
- UPDATE and DELETE against that event were both rejected by `DUGA audit events are append-only` (`SQLITE_CONSTRAINT_TRIGGER`).
- These are direct Cloudflare D1 Console observations supplied by the owner.

Authenticated disposable Worker acceptance (2026-11-25):
- Worker: `duga-d1-acceptance-disposable` at `https://duga-d1-acceptance-disposable.faridulprime.workers.dev`.
- D1 binding: `DB`, pinned in Wrangler config to `drm-duga-acceptance-disposable` / `6d512429-34a3-498b-9430-45f11d382da9`.
- Authenticated `POST /run` completed at `2026-11-25T01:04:19.420Z`.
- Run ID: `53d70371-008c-46a0-8bc3-33522be990eb`.
- Worker response: `results.pass = true`.
- The aggregate PASS is computed only when all assertions succeed: successful transition has UPDATE changes=1 and audit INSERT changes=1; stale writer, replay and token reuse each have 0/0; forced audit CHECK failure rejects the batch and leaves state version/token unchanged; two competing writers produce exactly one 1/1 winner and one 0/0 loser; exactly one audit event exists for the successful token and concurrent race.
- The user-visible PowerShell output showed only the aggregate PASS, not each nested count. The above individual outcomes are the Worker source's explicit predicates underlying that PASS, not separately printed per-test output.
- Test-only synthetic rows and audit events are retained in this disposable database.
- Temporary unauthenticated diagnostic route was removed from source before the final deployment; the owner pulled the removal and redeployed. Do not reintroduce it.
- No production migration has been applied. No Production or shared Preview database was used; no live Pages binding was changed. PR #4 remains Draft and unmerged.
