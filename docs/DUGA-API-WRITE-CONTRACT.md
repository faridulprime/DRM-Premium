# DUGA Governance API — Write Contract and CAS Design
Version: 0.1.0
Status: Design only; no write route is implemented or authorized.
Target branch: `feature/full-admin-panel`

## 1. Purpose and hard boundary

This contract defines the minimum safe server behavior for future DUGA mutations. It does not authorize a migration, a write endpoint, a Preview database operation, or a Production change.

Current evidence:
- The Pages catch-all is `functions/api/[[path]].js`.
- Existing governance endpoints are Owner-only and read-only.
- `getSession()` returns the authenticated application user ID, email, username and application role.
- The operational schema remains a draft. Its lifecycle trigger enforces 29 allowed edges, version increments, immutable proposal scope and audit-triggered database transition facts.
- No trusted AI workload identity exists in the inspected implementation.
- D1 batch atomicity, `changes()` behavior across a batch, live foreign-key enforcement, and rollback semantics for this exact statement sequence have not been validated in a disposable D1 database.

**NO-GO:** Do not implement or expose governance write endpoints until the D1 acceptance gates in Section 10 pass and the owner separately authorizes API mutation work.

## 2. Identity and authorization boundary

### Human caller

1. Resolve the existing opaque session using the server-side session lookup.
2. Require `user.role === "owner"` for the initial governance API. The application role is not itself a DUGA scoped assignment.
3. Derive `actor_type='human'` and `actor_user_id=user.id` exclusively from the authenticated session.
4. Ignore or reject caller-supplied `actor_user_id`, `actor_principal_id`, `approver_user_id`, `approver_role`, `authorization_assignment_id`, and success flags.
5. Re-read active DUGA assignments and scope from D1 inside the mutation's authorization/evidence checks. Do not accept a role or assignment copied from the browser.

### AI caller

AI mutation is disabled. A principal ID is an attribution label, not a credential. Never authenticate an AI caller from JSON, a URL parameter, a static browser key or a user-controlled header.

A later AI service requires a separate approved workload-identity design: short-lived server-verifiable credentials, issuer/audience/expiry validation, narrow scopes, key rotation/revocation and replay protection. The authenticated principal must be mapped to an active DUGA assignment. Until that mechanism exists, AI review and AI implementation write routes return a controlled 403/503 and cannot insert AI-attributed evidence.

### Validation runner

Browser-submitted `passed=true`, `validation_passed=true`, result JSON or commit SHA is not trusted validation evidence. Only a separately authenticated runner may record a result, and its credential/identity design is still open.

## 3. Command model — no arbitrary status setter

Do not expose `PATCH /changes/:id {status: ...}`. Use explicit commands and let the server derive the next state from the reviewed transition allow-list.

Proposed contracts (not implemented):

| Route | Caller | Server-derived authority | Effect |
|---|---|---|---|
| `POST /api/governance/changes` | Human Owner | Session user | Create a `proposed` request, version 1; bind source/base/policy context server-side |
| `POST /api/governance/changes/:id/transitions` | Human Owner initially | Session user + action-specific policy | Execute one named command; never accept arbitrary target status |
| `POST /api/governance/changes/:id/reviews` | Disabled until trusted reviewer identity exists | Trusted reviewer identity | Append immutable review evidence for the exact commit |
| `POST /api/governance/changes/:id/approvals` | Human Owner with valid scoped assignment | Session user + active assignment | Append immutable approval/rejection for the exact commit and policy revision |
| `POST /api/governance/changes/:id/validation-runs` | Disabled until trusted runner identity exists | Verified runner | Append validation evidence for the exact commit |

Each command has a strict per-action JSON schema, maximum body size, unknown-key rejection, bounded strings/arrays, explicit status/method handling and parameter-bound SQL. IDs, timestamps, actor identity, policy binding and resulting state version are server-generated.

## 4. Compare-and-Swap (CAS) contract

Every state-changing command must include the caller's observed `expected_state_version` and a command/action identifier. The server loads the current request and derives:
- current status and version;
- allowed next status for the named command;
- immutable source/base/policy bindings;
- current proposal scope and risk;
- prerequisite reviews, approvals and validation evidence;
- actor's active authorization assignment and scope.

The final write must be conditional on the exact current state, version and immutable policy binding. Conceptual SQL:

```sql
UPDATE duga_change_requests
SET status = ?,
    state_version = state_version + 1,
    updated_at = ?
WHERE id = ?
  AND status = ?
  AND state_version = ?
  AND policy_commit_sha = ?;
```

The values for target status, current status and policy SHA come from server-side validation, not from caller authority. The implementation must inspect the D1 result's affected-row metadata. Zero changed rows is a conflict (HTTP 409); it is never success and must not create an actor-attributed transition event. Do not rely on read-then-write checks without this conditional update.

The state trigger creates a database-attributed event for the transition. That event is not proof of the authenticated actor. The API must also create an actor-attributed audit event in the same atomic unit as the transition.

## 5. Atomic transition + actor audit

The intended D1 operation is one tested `DB.batch([...])` containing:
1. the conditional CAS `UPDATE`;
2. the actor-attributed audit insert, conditionally coupled to the successful update;
3. any additional immutable evidence insert required by that command.

A candidate coupling mechanism is a second SQL statement that inserts the actor event only when SQLite's `changes()` reports that the immediately preceding CAS updated one row. This is a design hypothesis, not an accepted D1 guarantee. Verify that `changes()` observes the prior statement in the same D1 batch, that batch statements are transactionally atomic, and that a failure in the audit insert rolls back both the CAS update and the database-trigger event. If the exact behavior is not proven, do not ship this sequence; design an alternative with equivalent atomicity.

The application must inspect every batch result and return success only after the complete batch commits and the CAS affected exactly one row. If the CAS changes zero rows, return 409. If any statement fails, return a controlled 5xx and do not claim a transition occurred. Do not perform the CAS and audit insert as separate `.run()` calls.

Audit payloads must be minimal, schema-versioned and JSON-serializable. They should include command, previous/new status, previous/new state version, immutable commit/policy references and a request/correlation ID. Do not put secrets, session tokens or unnecessary personal data in the payload.

## 6. Action-specific gates

### Create proposal
- Force initial status `proposed` and version 1.
- Derive requester type/ID from the authenticated identity.
- Bind source branch, base commit and policy SHA using trusted server-side repository/policy state.
- Do not permit caller-selected implementer or implementation commit.
- Persist proposal and creation audit atomically.

### Review
- Only the trusted independent reviewer service may create `independent_ai_audit` evidence.
- The implementer principal must not review its own change.
- Review evidence must identify the exact implementation commit and include bounded, validated evidence JSON.
- A review for a different commit is not eligible for the current gate.

### Human approval
- Derive approver user ID from the session.
- Resolve an active human assignment matching the request's affected system(s) or platform scope, role, and current policy SHA.
- Insert the approval with the exact assignment ID, scope, policy SHA and implementation commit.
- The database approval trigger is a backstop, not a replacement for application authorization.
- A later assignment revocation does not rewrite historical approval evidence; any policy requiring re-approval after revocation must be enforced explicitly.

### Validation
- Only the trusted runner may report results.
- Validation commit SHA must equal the implementation commit.
- A failed, stale, cancelled, missing or mismatched run cannot satisfy acceptance.
- A non-empty implementation commit is required before entering `validating` (already enforced by the schema draft).

## 7. Concurrency, idempotency and retry

- Two requests with the same expected version: at most one may commit.
- A stale expected version returns 409 with the current version only if disclosure is allowed; never auto-retry a state transition.
- Add an idempotency key for commands that may be retried by clients. Store the key, actor, route/command, request digest and resulting resource/event reference with a uniqueness constraint. Reuse with a different request digest returns 409.
- A network timeout after commit is an unknown outcome, not evidence of failure. The client must query the resulting resource or retry with the same idempotency key.
- Do not allow a new implementation commit to overwrite the write-once implementation SHA. A changed-commit retry requires a successor request until a separately reviewed implementation-attempt history model exists.

## 8. HTTP response contract

| Condition | Response |
|---|---|
| Missing/invalid session | 401 |
| Authenticated but not permitted / trusted identity unavailable | 403 |
| Invalid body, unknown key, invalid command or malformed ID | 400 |
| Request not found | 404 |
| Unsupported method | 405 with `Allow` |
| Stale version, duplicate idempotency key with different digest, or conflicting state | 409 |
| Missing DUGA schema or unavailable storage | 503 |
| Unexpected internal failure | 500 with generic message and correlation ID |

Do not expose SQL, stack traces, session data, credentials or internal policy secrets in error responses.

## 9. Required tests before implementation approval

### Handler-level tests (mock D1)
- Owner succeeds; Admin/User/anonymous are denied.
- Actor ID is always derived from session; spoofed body actor fields are rejected.
- Every command rejects unknown keys and invalid state/action pairs.
- Missing, revoked, wrong-scope and wrong-policy assignments deny approval.
- Implementer/reviewer self-review is denied.
- Stale version maps to 409 and does not report success.
- Review/approval/validation commit mismatch blocks the next state.
- Unknown routes and methods fail closed.
- Existing auth, profile, Builder, public pages and read-only governance routes remain unchanged.

### SQLite draft tests
- CAS with current version changes one row.
- CAS with stale version changes zero rows.
- Two sequential competing CAS operations: exactly one changes a row.
- Trigger event and actor event are both append-only.
- Audit insert failure rolls back the state change in a real transaction.
- Invalid actor combinations and empty principal IDs are rejected.
- A transition cannot advance without its required evidence.

### Disposable Cloudflare D1 acceptance (mandatory; not yet done)
- Confirm the target database ID/environment and verified migration ledger.
- Export/verify backup and recovery procedure before any schema write.
- Verify foreign-key behavior and every required trigger on D1.
- Verify the exact `DB.batch()` ordering, `changes()` coupling, per-statement result metadata and rollback behavior.
- Inject failure into the actor-audit statement and prove neither transition nor either audit event persists.
- Run two concurrent CAS attempts and prove exactly one wins.
- Confirm no writes reach shared Preview or Production during disposable tests.

## 10. Release gates and current decision

| Gate | Current state |
|---|---|
| Read-only Owner API and mocked tests | Implemented |
| Lifecycle schema draft and in-memory SQLite tests | Implemented; CI passed |
| Trusted AI reviewer identity | Not implemented |
| Trusted validation-runner identity | Not implemented |
| D1 batch/CAS/rollback semantics verified | Not verified |
| Preview migration ledger and backup/recovery verified | Not verified |
| Disposable D1 acceptance | Not performed |
| Governance write endpoints | Not implemented |

**Decision: NO-GO for Governance write endpoints and all shared Preview/Production migrations.**

Allowed work now: static review, route-contract refinement, mock/SQLite test design and CI documentation. The next runtime gate is an explicitly approved disposable D1 acceptance exercise, not a migration to shared Preview.

## 11. Health-readiness alignment — resolved in feature branch

The earlier finding in this section has been resolved. `GET /api/governance/health` now requires all four `duga_change_requests` lifecycle triggers (`insert_guard`, `update_guard`, `no_delete`, and `transition_audit`) and the `blocked_from_status` / `block_reason_code` columns. It also checks selected SQL-definition markers for those triggers. The mocked handler suite independently omits each of the four lifecycle triggers and proves every omission yields `schema: partial`; it also verifies the `block_reason_code` column is required. All cases passed in [run #45674314833](https://github.com/faridulprime/DRM-Premium/actions/runs/45674314833).

The health endpoint checks expected tables, columns, named indexes, required triggers, and selected trigger-definition markers. It is still a targeted structural check—not full SQL equivalence, migration-ledger verification, data-integrity proof, or evidence that the schema exists in a live Cloudflare D1 database. The endpoint must not be used as a substitute for the disposable-D1 acceptance gates in Section 10.

## 12. Validation evidence

The read-only health-route hardening and mocked regression suite passed on commit `2481651798ef60c3793bfeafe81abff1cd9aeec6` ([run #45673718961](https://github.com/faridulprime/DRM-Premium/actions/runs/45673718961)). The subsequent documentation commits were also checked: run #45673812326 passed on `e0a85898697e159afccf38a575099a1d7ea307a4`, and run #45673820027 passed on the current branch head `277f7aaf1752abe0c0ea478289e81c1611d555c1`. The latest run completed every step successfully, including JS syntax, mocked Owner-only health API tests, registry validators, static migration inventory, in-memory SQLite schema tests and structural validation.

This CI run does not verify Cloudflare D1 batch semantics, live Preview schema, migrations or deployed runtime.

## 13. Change history

- 2026-11-26: Initial write contract created from the inspected Pages handler, API authorization design, operational schema draft and current DUGA readiness constraints.
- 2026-11-26: Added health-readiness alignment requirements and recorded the passing mocked/SQLite CI run.
