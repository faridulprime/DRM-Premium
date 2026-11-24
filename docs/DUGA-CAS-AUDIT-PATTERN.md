# DUGA — Compare-and-Swap with Idempotent Audit Insert

Status: proposed SQL pattern; locally tested in SQLite only. Not a deployed API and not yet verified on Cloudflare D1.

## Problem

A D1 `batch()` is transactional when a statement fails. But a conditional UPDATE that matches zero rows is not a statement failure. Therefore, a later unconditional audit INSERT can still execute. Transactionality alone does not make the audit conditional on a successful state transition.

## Draft schema additions

The D1 schema draft now contains:
- `duga_change_requests.last_transition_id`: token for the most recent successful transition.
- `duga_audit_events.transition_id`: optional token for a transition event.
- A partial unique index on non-null `duga_audit_events.transition_id`, so one token can create at most one transition audit event.

Non-transition audit events may keep `transition_id = NULL`.

## Two-statement batch pattern

Generate a cryptographically random, unguessable transition token on the trusted server for each transition attempt. Do not accept it from the browser. Use the same token in both statements.

Statement 1 — conditional compare-and-swap:

```sql
UPDATE duga_change_requests
SET status = ?,
    state_version = state_version + 1,
    last_transition_id = ?,
    updated_at = ?
WHERE id = ?
  AND state_version = ?
  AND status = ?
  AND NOT EXISTS (
    SELECT 1
    FROM duga_audit_events
    WHERE transition_id = ?
  );
```

Statement 2 — audit only if that exact update is now visible:

```sql
INSERT INTO duga_audit_events
  (id, aggregate_type, aggregate_id, event_type, actor_type,
   actor_user_id, actor_principal_id, actor_system_id,
   payload_json, transition_id, policy_commit_sha, created_at)
SELECT
  ?, 'change_request', id, 'state_transition', ?,
  ?, ?, ?, ?, ?, ?, updated_at
FROM duga_change_requests
WHERE id = ?
  AND state_version = ?
  AND last_transition_id = ?
  AND NOT EXISTS (
    SELECT 1
    FROM duga_audit_events
    WHERE transition_id = ?
  );
```

The second statement must use the authenticated server-derived actor fields and validated payload. The exact bindings and required actor fields depend on actor type.

## Why the pattern addresses the identified cases

- **Successful transition:** statement 1 changes exactly one row and records the token. Statement 2 sees that token/version and inserts one audit event.
- **Stale writer:** statement 1 changes zero rows. Unless the same token somehow identifies an earlier transition, statement 2 finds no matching newly updated row and inserts nothing.
- **Replay of a successful token:** statement 1 is blocked because the token already exists in the audit table. Statement 2 is also blocked by the existing audit row. No duplicate audit event.
- **Token reuse for a later version:** statement 1 is blocked by the existing audit row even if the caller supplies the later expected version.
- **Audit INSERT constraint failure:** the batch fails; transactional rollback must revert statement 1 as well.
- **Duplicate token race:** the unique index is a final database-level guard against two audit rows for the same transition token.

A trusted server must still inspect the first statement's individual `D1Result.meta.changes`. Exactly one means transition success; zero means conflict/replay. It should also inspect the second statement's result and require exactly one inserted audit row before returning success. If either count is unexpected, return an error and do not report success.

## Mandatory D1 acceptance probes

On a newly created disposable D1 database only:
1. Valid expected state/version: update changes=1, audit insert changes=1.
2. Stale state/version: update changes=0, audit insert changes=0.
3. Replay same token and original expected version: both changes=0.
4. Reuse the old token against the next expected version: both changes=0.
5. Force audit INSERT constraint failure: batch rejects and the state update is rolled back.
6. Concurrent requests with different tokens and the same expected version: exactly one wins and exactly one audit event exists.
7. Confirm the transition unique index rejects duplicate token rows.

## Limits and safety

- Local SQLite tests can validate SQL logic but cannot establish D1 runtime behavior or batch result metadata.
- This pattern does not replace authorization, transition-matrix checks, commit-bound evidence invalidation, active assignment checks, reviewer separation or trusted actor derivation.
- Do not create a migration or runtime API from this proposal until disposable D1 acceptance and independent review pass.
- No D1 database was accessed or modified while preparing this design.
