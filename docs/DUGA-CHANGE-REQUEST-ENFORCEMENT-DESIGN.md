# DUGA Change-Request Database Enforcement Design
Version: 0.1.0
Date: 2026-11-25
Status: implementation design only — not executable SQL and not authorization to migrate a database.

## 1. Purpose and boundary

This design converts the reviewed state-machine contract into a database/API enforcement plan. It is intentionally limited to `duga_change_requests` lifecycle integrity. It does not implement write routes, alter the operational schema draft, create migration 0009, access D1, or deploy anything.

Target branch for future implementation: `feature/full-admin-panel`. Production `main`, Production D1 and shared Preview D1 remain out of scope until their separate approval and readiness gates are met.

## 2. Verified starting point

The current design draft contains 13 statuses, `state_version`, requester/implementer identity fields, base and implementation commit fields, policy commit binding, separate review/approval/validation tables, and an append-only audit table.

The current `duga_change_requests` draft has no lifecycle INSERT/UPDATE/DELETE guard and no automatic change-request transition audit. Existing review and approval evidence is immutable, and the draft already has selected authorization and evidence constraints. Those controls do not close the change-request lifecycle gap.

The migration manifest describes only fresh-database ordering. It explicitly does not prove which migrations have been applied to any D1 database. The DUGA SQL file remains a design draft, not a migration.

## 3. Conservative policy defaults recommended for the next implementation

These are proposed defaults to encode after review against the actual workflow; this document does not claim that the owner has separately ratified each policy choice.

| Policy question | Recommended default | Reason |
|---|---|---|
| `accepted`, `rejected`, `cancelled` | Permanently terminal | Preserve evidence; corrections create a linked successor request |
| `blocked` | Resumable only to an explicitly recorded prior eligible state | Prevent arbitrary privilege/gate bypass |
| Resume target | Record `blocked_from_status` plus stable `block_reason_code`; clear only on a successful authorized resume | Make the recovery path deterministic and auditable |
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
- `blocked → recorded eligible resume target | cancelled`
- `accepted`, `rejected`, `cancelled` → no transition

The graph is necessary but not sufficient. A valid edge does not prove that the actor is authorized or that required evidence exists.

### Block/resume semantics

A transition into `blocked` must preserve the immediately previous non-terminal state as `blocked_from_status`, require a stable `block_reason_code`, and emit an audit event. A resume must name exactly that recorded state, prove the block reason has been resolved, re-check current assignment and policy, and increment `state_version`. A blocked request may instead be cancelled by an authorized actor. No direct resume to `approved`, `implementing`, `validating` or `accepted` is allowed unless that was the exact recorded pre-block state and all gates are revalidated; in practice the initial policy should disallow resuming directly into implementation/finalization and require re-review.

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
- Implementation commit is write-once for an attempt. A retry must have an explicit attempt/evidence record; do not overwrite the old commit or its evidence.
- A blocked transition/resume must obey the block metadata rules above.

### DELETE guard

Reject all physical deletion of change requests. Use cancellation or a linked superseding request.

### Atomic audit

The API must derive the actor from the authenticated session or verified service principal and submit the conditional state update and audit insert in one D1 transactional batch. The audit payload must include old/new status, old/new version, reason code, actor reference, policy SHA, base/implementation SHA and evidence references.

Do not claim that a trigger-generated `duga-db-trigger` actor identifies the human or service that authenticated. A SQLite trigger cannot independently derive the Cloudflare session principal. Database triggers may enforce transition integrity; the trusted API must supply attribution from verified authentication context. The batch must roll back if the audit insert fails.

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
| validating → implementing | Trusted validation run terminal and failed; new implementation attempt required |
| final_review → accepted | Human final review, all required gates current, exact commit/policy match, successful validation |
| final_review → implementing | Review changes requested; new attempt and fresh validation required |
| any eligible state → blocked | Authorized actor, stable reason code and audit evidence |
| blocked → resume | Exact recorded resume target, reason resolved, fresh authorization and revalidation |

JSON fields supplied by a caller are not proof. The API must verify provenance and record evidence in the dedicated tables.

## 8. Migration design sequence (not yet authorized)

When the design is accepted:
1. Fetch and inspect the exact current schema draft, migration inventory, all relevant SQL files and validation scripts at the branch head.
2. Add the minimum columns/tables needed for blocked-state metadata and explicit implementation attempts; update the schema structure validator and in-memory SQLite regression tests first.
3. Add INSERT/UPDATE/DELETE guards and verify trigger ordering and D1-compatible SQLite syntax.
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
- Resume to a state other than the recorded target fails.
- Resume with unresolved reason or stale policy/assignment fails at API layer.
- Same human requester/approver fails at API layer.
- Implementer/AI auditor identity collision fails.
- Approval for wrong affected-system scope, inactive assignment, wrong policy or wrong commit fails.
- AI review for wrong commit or stale policy fails.
- Final review/acceptance with missing, failed, stale or different-commit validation fails.
- Caller-forged actor ID or success flag is rejected/ignored.
- Two concurrent transitions with the same expected version: one succeeds, one receives conflict.
- Audit insertion failure rolls back the state transition.
- Failed validation returns to implementation only through a new attempt; old validation remains immutable.
- All rejected operations leave request state/version and audit stream unchanged.

## 10. Exit criteria

This design is ready to become a schema/API implementation task only when:
- The product workflow is reconciled with the transition graph.
- The recommended policy defaults are accepted or explicitly amended.
- Required schema additions are identified and tested in the in-memory validator.
- Audit attribution and D1 transactional semantics are demonstrated in tests.
- The migration history/backup gate is separately completed before Preview operations.

## 11. Explicit non-actions

No D1 database was read or written. No migration was created or executed. No write API was added. No Preview or Production deployment occurred. This document does not authorize any of those actions.
