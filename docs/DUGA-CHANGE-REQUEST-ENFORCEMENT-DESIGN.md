# DUGA Change-Request Database Enforcement Design
Version: 0.1.0
Date: 2026-11-25
Status: implemented in the operational schema draft and in-memory test definitions; API enforcement, executed test evidence, migrations and deployment remain outstanding.

## 1. Purpose and boundary

This design records the database-draft enforcement for `duga_change_requests` and the remaining trusted API contract. It is intentionally limited to change-request lifecycle integrity. The operational schema draft and its local SQLite test/structure-validator definitions have been updated; no write route, migration 0009, D1 operation or deployment has been performed.

Target branch for future implementation: `feature/full-admin-panel`. Production `main`, Production D1 and shared Preview D1 remain out of scope until their separate approval and readiness gates are met.

## 2. Verified starting point

The operational schema draft contains 13 statuses, `state_version`, requester/implementer identity fields, base and implementation commit fields, policy commit binding, separate review/approval/validation tables, and an append-only audit table. It now also contains `blocked_from_status` and `block_reason_code`, lifecycle INSERT/UPDATE/DELETE guards, and a transition-audit trigger.

The draft-level lifecycle gap is closed structurally: new requests must begin as `proposed` at version 1 with no implementer/commit; transitions follow an explicit allow-list and increment the version exactly once; requester and original source/base/policy bindings are immutable; terminal requests cannot be updated; requests cannot be physically deleted; and transitions create a database-generated audit event.

The migration manifest describes only fresh-database ordering. It does not prove which migrations have been applied to any D1 database. The SQL file remains a design draft, not an executable migration. The updated in-memory tests and structural validator have been authored but have not yet been executed in this session.

## 3. Conservative policy defaults recommended for the next implementation

These are proposed defaults to encode after review against the actual workflow; this document does not claim that the owner has separately ratified each policy choice.

| Policy question | Recommended default | Reason |
|---|---|---|
| `accepted`, `rejected`, `cancelled` | Permanently terminal | Preserve evidence; corrections create a linked successor request |
| `blocked` | Resume only to `impact_review`, or cancel | Force fresh impact/evidence review instead of returning directly to an advanced gate |
| Block metadata | Record the prior state in `blocked_from_status` plus an enumerated `block_reason_code`; clear both only on resume to `impact_review` or cancellation | Make recovery deterministic and auditable |
| Approval revocation | No silent revocation or mutation of approval rows; use a new superseding request before implementation, and a new change request after implementation has begun | Preserve historical decision evidence |
| AI audit | Required for every request that enters implementation | Keeps the stated independent-review model consistent |
| Human approval | Required for every request that enters implementation; Platform Owner may approve all scopes, System Owner only affected system scopes | Avoid risk-tier bypasses until a reviewed risk matrix exists |
| Separation of duties | Requester cannot be approver; implementer cannot be AI auditor; AI cannot provide human approval | Reduce self-approval and self-audit risk |
| Risk-based exceptions | None in Foundation | Avoid a weak or ambiguous low-risk bypass |

If the product later needs a narrower low-risk path, define it as a versioned policy with explicit risk criteria, tests and owner approval. Do not infer exceptions from a free-form rationale or client-supplied risk label.

## 4. State-transition allow-list

The database guard should enforce this graph, independent of API checks:

- `proposed → analyzing | cancelled | blocked`
- `analyzing → impact_review | blocked | cancelled`
- `impact_review → awaiting_ai_audit | awaiting_human_approval | blocked | cancelled`
- `awaiting_ai_audit → awaiting_human_approval | impact_review | blocked`
- `awaiting_human_approval → approved | rejected | impact_review | blocked`
- `approved → implementing | blocked`
- `implementing → validating | blocked`
- `validating → final_review | implementing | blocked`
- `final_review → accepted | implementing | blocked`
- `blocked → impact_review | cancelled`
- `accepted`, `rejected`, `cancelled` → no transition

The graph is necessary but not sufficient. A valid edge does not prove that the actor is authorized or that required evidence exists.

### Block/resume semantics

A transition into `blocked` must preserve the immediately previous state as `blocked_from_status` and require one enumerated `block_reason_code` (`security_review`, `missing_evidence`, `policy_changed`, `dependency_unavailable`, `scope_conflict`, `external_incident`, or `other`). The database permits only `blocked → impact_review` or `blocked → cancelled`; both paths clear the block metadata and increment `state_version`. The API must prove the reason is resolved and re-check current assignment, policy and evidence before resuming. This deliberately forces a fresh impact review and prevents direct resumption into approval or implementation.

## 5. Database invariants

### INSERT guard

Require:
- Initial `status='proposed'`.
- `state_version=1`.
- `implementer_type`, implementer identity and `implementation_commit_sha` are NULL.
- `created_at=updated_at` (or a documented server timestamp convention).
- `source_branch` is not `main`.
- Requester identity is structurally valid; actual identity must still be derived by the authenticated API.

### UPDATE guard

For every update:
- `id`, requester identity, creation timestamp, initial source/base context and initial policy binding are immutable unless a separately designed versioned revalidation event exists.
- A status change must be an allowed edge.
- A status change must increment `state_version` by exactly one.
- A non-status update must not change `state_version`; preferably restrict non-status updates to a small explicit allow-list.
- `updated_at` must be monotonic and server assigned.
- Once terminal, no update is allowed.
- Implementer identity may be assigned only on `approved → implementing` and cannot later be replaced.
- The first implementation commit may be recorded only on `implementing → validating`; once present it is immutable. The current draft has no attempt-history table, so a changed commit cannot be used for a retry. A new commit requires a successor request until a separately reviewed attempt model is added.
- A blocked transition/resume must obey the block metadata rules above.

### DELETE guard

Reject all physical deletion of change requests. Use cancellation or a linked superseding request.

### Atomic audit

The schema trigger inserts a transactional database event for every status change. Its actor is explicitly `system / duga-db-trigger`; it proves the database transition occurred but does not identify the authenticated human or service. The future API must derive actor identity from the authenticated session/service principal and insert a separate actor-attributed audit event in the same D1 batch as the conditional state update. The batch must roll back if that API audit insert fails. Never treat the synthetic trigger actor as human/service attribution.

## 6. API compare-and-swap contract

Every transition request must:
1. Authenticate a human session or a separately verified service principal.
2. Derive actor identity server-side; ignore/reject caller-supplied actor IDs.
3. Load the current request and verify `expected_status`, `expected_state_version`, policy SHA and relevant commit SHA.
4. Check active assignment, role and affected-system scope.
5. Verify immutable review/approval/validation evidence against the same request, commit and policy revision.
6. Execute a conditional update matching request ID + expected status + expected version + policy/commit binding.
7. Require exactly one changed row. Zero rows means stale/conflicting request, not success.
8. Insert the audit event in the same D1 batch/transaction.
9. Return success only after the batch commits.
10. On concurrent transitions with the same expected version, exactly one may succeed.

A database trigger is defense in depth, not a substitute for these checks.

## 7. Evidence gates by transition

| Transition | Required verified evidence |
|---|---|
| Create → proposed | Authenticated requester; validated title, summary, risk, affected systems/paths, rollback plan, non-main source branch, policy SHA |
| proposed → analyzing | Active authorized analysis assignment |
| analyzing → impact_review | Completed analysis bound to request version, base commit and policy SHA |
| impact_review → awaiting_ai_audit | Complete impact assessment and affected-system/path set |
| awaiting_ai_audit → awaiting_human_approval | Independent AI audit by a principal different from implementer, referencing exact commit and policy |
| awaiting_human_approval → approved/rejected | Active human Owner/authorized System Owner assignment, scope match, requester/approver separation, immutable approval record |
| approved → implementing | Current approval and policy still valid; authorized implementer assignment; target branch not `main` |
| implementing → validating | Immutable implementation commit and attempt record |
| validating → final_review | Trusted validation run terminal and passed, exact commit match, verified runner provenance |
| validating → implementing | Trusted validation run terminal and failed; current draft supports only same-commit revalidation because it has no attempt-history table |
| final_review → accepted | Human final review, all required gates current, exact commit/policy match, successful validation |
| final_review → implementing | Review changes requested; current draft supports same-commit re-review only; a changed commit requires a successor request |
| any eligible state → blocked | Authorized actor, stable reason code and audit evidence |
| blocked → impact_review | Block reason resolved, fresh authorization and impact/evidence revalidation |

JSON fields supplied by a caller are not proof. The API must verify provenance and record evidence in the dedicated tables.

## 8. Migration design sequence (not yet authorized)

When the design is accepted:
1. Fetch and inspect the exact current schema draft, migration inventory, all relevant SQL files and validation scripts at the branch head.
2. The first draft-level increment is now present: block metadata columns, INSERT/UPDATE/DELETE guards, transition audit, schema validator expectations and in-memory adversarial test cases.
3. Execute both Python validators locally/CI and fix every failure before designing a migration. A separate implementation-attempt table remains future work if multi-commit retries are required.
4. Add API CAS + transactional audit behavior with mocked D1 tests, including audit failure rollback and concurrent stale-version cases.
5. Generate an additive migration only after the draft is stable; never edit an already-applied migration.
6. Run migration inventory and all schema validators; run in-memory SQLite adversarial tests.
7. Verify Preview migration history and backup/recovery before any Preview migration is proposed.
8. Run disposable D1 acceptance against the exact revised schema and record the D1 acceptance evidence.
9. Obtain independent security review and trusted validation/AI identity design.
10. Only then request explicit authorization for shared Preview migration. Production remains separately gated.

## 9. Required adversarial regression tests

- Direct insert into any status other than `proposed` fails.
- Insert with non-1 state version or pre-populated implementer/commit fails.
- Every allowed graph edge succeeds structurally; every unlisted edge fails.
- Version unchanged, skipped or decremented on a transition fails.
- Requester, identity, creation time, source branch, base commit or policy SHA mutation fails.
- Any update to accepted/rejected/cancelled fails.
- Any physical delete fails.
- Block without reason/previous-state metadata fails.
- Blocked requests can resume only to `impact_review` or be cancelled; direct resume to `approved`/`implementing` fails.
- Block metadata is required on entry to `blocked`, reason codes are enumerated, and metadata is cleared on exit.
- Resume with unresolved reason or stale policy/assignment fails at API layer.
- Same human requester/approver fails at API layer.
- Implementer/AI auditor identity collision fails.
- Approval for wrong affected-system scope, inactive assignment, wrong policy or wrong commit fails.
- AI review for wrong commit or stale policy fails.
- Final review/acceptance with missing, failed, stale or different-commit validation fails.
- Caller-forged actor ID or success flag is rejected/ignored.
- Two concurrent transitions with the same expected version: one succeeds, one receives conflict.
- Audit insertion failure rolls back the state transition.
- Implementation commit cannot be overwritten after it is recorded; changed-commit retries are not supported until an immutable attempt-history model is added.
- Database-generated audit events are clearly attributed to `duga-db-trigger`; the API must separately record the authenticated actor.
- All rejected operations leave request state/version and audit stream unchanged.

## 10. Exit criteria

This design's schema-draft phase is ready for local/CI validation. API implementation remains gated until:
- The product workflow is reconciled with the transition graph.
- The recommended policy defaults are accepted or explicitly amended.
- Both updated in-memory SQLite scripts pass against the exact branch-head schema.
- API actor attribution, CAS and transactional audit rollback are implemented and tested.
- The migration history/backup gate is separately completed before Preview operations.

## 11. Explicit non-actions

The operational schema draft, smoke-test definitions and structural-validator expectations were changed on the feature branch. No test execution result is claimed yet. No D1 database was read or written. No migration was created or executed. No write API was added. No Preview or Production deployment occurred. This document does not authorize any of those actions.
