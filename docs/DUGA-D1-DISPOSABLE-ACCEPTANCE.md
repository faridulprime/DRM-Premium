# DUGA — Disposable Cloudflare D1 Acceptance Plan

Status: PARTIAL — the earlier CAS/audit Worker acceptance passed against the prior schema, but it predates the immutable predecessor-link and AI-review decision constraints. Revised-schema D1 acceptance is NOT RUN.
Applies to: current `duga-foundation-review` schema draft v0.1.0, baseline commit `b3606febb30804d139eb0822fc00024424b726b7`.
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

1. Create a NEW D1 database through the Cloudflare dashboard or Wrangler, explicitly named for revised-schema disposable DUGA acceptance testing. This is necessary: the previously tested database contains the older schema and retained synthetic rows; do not reuse it for the revised-schema run.
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
- All expected DUGA indexes, both audit append-only triggers, and the immutable predecessor-link trigger exist.
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

### 4.3 Revised lifecycle/schema constraints

Use synthetic IDs and a valid synthetic human user from this database.

- Insert a valid terminal predecessor (`status='rejected'`) and a new request whose `parent_change_request_id` references it; the insert must succeed.
- Attempt a child with a nonexistent parent ID; it must fail the foreign key.
- Attempt a self-parent request (`parent_change_request_id` equal to its own `id`); it must fail.
- Attempt to change an existing request's `parent_change_request_id`; it must fail with `change request parent link is immutable`.
- Insert an AI review (`reviewer_type='ai'`, `review_type='independent_ai_audit'`, non-empty `reviewer_principal_id`) with `decision='rejected'`; it must fail. An AI `approved` or `changes_requested` row may pass when all other fields are valid.
- Confirm a human review can still record `decision='rejected'` when all other fields are valid.

Important: SQL enforces referential integrity and immutable linkage, but it does NOT enforce that the predecessor is currently `rejected` or `cancelled` when the child is created. That terminal-state check, and the prohibition on copying predecessor evidence/authority, remain mandatory server-side API rules and are not D1 acceptance claims.

### 4.4 Append-only audit checks

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

## 8. Earlier verified status (prior schema only)

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


## 9. Revised-schema D1 acceptance evidence — 2026-11-25

Status: PARTIAL — revised-schema structural/constraint probes and the authenticated Cloudflare D1 CAS + audit Worker suite passed on the new disposable database. The complete checklist in sections 3–5 is not yet fully evidenced; see remaining gaps below. This is not Production or Preview acceptance.

### Isolated environment

- D1 database: `drm-duga-acceptance-v2-disposable`
- D1 database ID: `716a4f20-25a5-4a59-9dd2-c764b193f385`
- Worker: `duga-d1-acceptance-v2-disposable`
- Worker URL: `https://duga-d1-acceptance-v2-disposable.faridulprime.workers.dev`
- Worker D1 binding: `DB` → the D1 database ID above (confirmed in Wrangler deploy output).
- Worker source path: `scripts/duga-d1-acceptance-worker/src/index.js`
- Worker source blob SHA on `duga-foundation-review`: `faeff7eb8b2be5b2a97626b82ba05883b3b17841`
- Schema blob SHA on `duga-foundation-review`: `650d03d1473c503becca3414f8dfa928d95daecf`
- Fixture blob SHA on `duga-foundation-review`: `a48481c17be1c57736b2776bcef4bcdf025e3d87`
- Worker deployment version used for the authenticated acceptance run: `544e2a39-16d3-4363-a42a-fcbad340b21e`
- Run ID: `a330b683-c8e0-4187-a8b0-0adc961816fa`
- Completion timestamp: `2026-11-25T09:13:59.408Z`
- Authentication: POST-only diagnostic check reported `secretConfigured=true`, `authorizationBearerPresent=true`, both secret lengths 44, and `fingerprintMatch=true`. The diagnostic route was removed from the final Worker source; the final source exposes only the authenticated `POST /run` suite. No secret value or fingerprint is recorded here.

### Revised schema and fixture observations

- The disposable fixture was applied to the newly created D1 database; the reported inventory was 8 DUGA tables, 20 indexes and 3 triggers.
- `PRAGMA foreign_key_check` returned no violation rows.
- `duga_change_requests` includes `parent_change_request_id`, `state_version` and `last_transition_id`.
- Verified revised lifecycle behavior: valid terminal predecessor/child linkage; missing-parent FK rejection; self-parent rejection; immutable parent-link update rejection.
- Verified review boundary: AI `rejected` review rejected; AI `changes_requested`/approved and human rejected review cases behaved as expected.
- JSON shape probes rejected malformed JSON and wrong top-level types for change-request arrays, review evidence, audit payload, validation results, analysis finding evidence, job input and job result.
- A 12-case probe batch reported 12/12 passed, 0 failed, including malformed/wrong-type JSON cases and orphan-FK checks for review, approval and validation-run change-request references.
- Append-only audit UPDATE and DELETE were both rejected; the original audit row remained.
- Cloudflare D1 rejected `SELECT sqlite_version()` as an unauthorized function. Therefore the engine version is not recorded; this is a tooling limitation, not a schema test failure.

### Authenticated CAS + audit Worker result

The authenticated `POST /run` response returned `results.pass = true` (HTTP success). Captured nested results:

- Success: `updateChanges=1`, `auditChanges=1`, `auditCountForToken=1`.
- Stale expected version: `0/0`.
- Replay: `0/0`.
- Reuse of an already audited token: `0/0`.
- Forced audit CHECK failure: batch rejected; row remained `status='proposed'`, `state_version=1`, `last_transition_id=null`.
- Concurrent writers: exactly one `1/1` winner and one `0/0` loser; final row `status='analyzing'`, `state_version=2`; audit count `1`.
- The Worker response explicitly states that only synthetic test rows and audit events are retained.

### Remaining evidence gaps

The overall D1 acceptance remains PARTIAL because the complete plan in sections 3–5 has not yet been evidenced in full:

- The owner-operated 12-case probe batch did not include the assignment `user_id` / `assigned_by_user_id` orphan-FK cases or the review `reviewer_user_id` orphan-FK case.
- The available record does not establish a fresh complete inventory of every expected index definition against the reviewed schema, nor every positive counterpart for each JSON probe.
- The D1 SQLite version could not be queried through the available Console function.
- The Worker runtime suite passed, but that alone does not satisfy every structural and FK checklist item above.

Do not mark the full plan PASS until these gaps are closed and recorded. Do not create a production migration, change any application binding, implement state-changing API routes, merge PR #4, or deploy Production as a consequence of this evidence. No Production or shared Preview database was used; no live Pages binding was changed. PR #4 remains Draft and unmerged.


## 10. Revised-schema gap probes — owner-reported execution 2026-11-25

The follow-up script `scripts/duga-d1-revised-gap-probes.sql` was supplied to the owner as comment-free, individual SQL statements for the D1 Console. On 2026-11-25, the owner reported that every statement produced the expected outcome:

- synthetic user and change-request setup: expected success;
- valid assignment: expected success;
- orphan assignment `user_id`: expected rejection;
- orphan assignment `assigned_by_user_id`: expected rejection;
- orphan review `reviewer_user_id`: expected rejection;
- valid human-rejected review: expected success;
- positive validation, finding and job JSON-object inserts: expected success;
- change-request JSON array type query: expected array types;
- named index/trigger inventory query: executed and reported as expected;
- `PRAGMA foreign_key_check`: expected zero rows;
- positive-row count query: expected one row for each of its five probes.

Evidence qualification: these outcomes are recorded as owner-reported execution, not independently captured raw Console output. The conversation record does not contain the actual inventory rows, SQL error text for the three expected FK failures, or the numeric result table from the final count query. Therefore the individual tests are reported as owner-confirmed, but the raw evidence package is incomplete. Do not claim an independently audited exact index count based solely on the summary “as expected”.

The reviewed schema draft defines 19 explicitly named DUGA indexes and 3 triggers. The earlier reported total of 20 indexes may include an SQLite-generated internal autoindex. Reconcile this against the actual `sqlite_master` output before asserting the exact total.

SQLite engine version remains unverified. The D1 Console rejected `sqlite_version()`; do not substitute a guessed version.

## 11. Current acceptance assessment — 2026-11-25

The owner reports that all statements in the comment-free gap-probe sequence returned the expected outcomes. Together with the previously recorded revised-schema structural/constraint observations and the authenticated Worker response (`results.pass = true`), this closes the *execution gaps as reported by the owner*.

Overall status: **CONDITIONALLY COMPLETE / EVIDENCE PACKAGE INCOMPLETE**.

Why this is not an unqualified PASS:
- The latest gap-probe output was summarized by the owner rather than preserved as raw result/error captures in the record.
- The exact index/trigger inventory rows and count reconciliation are not present here.
- SQLite engine version is unavailable through the attempted D1 Console query.

The runtime CAS + audit suite itself remains PASS on the isolated disposable D1. The owner's report supports that all follow-up SQL statements behaved as expected. Do not conflate this disposable acceptance with Preview or Production migration readiness.

No Production or shared Preview database was used; no live Pages binding was changed; no production migration was applied. Synthetic rows and append-only audit events are retained in the disposable database. PR #4 remains Draft and unmerged. Do not merge or deploy Production solely on the basis of this disposable test.
