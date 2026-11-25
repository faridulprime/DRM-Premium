# DUGA Change-Request State Machine and Authorization Contract

**Status:** design contract and gap assessment only. No status trigger, write route, migration, D1 operation, or deployment is implemented.

## 1. Current verified baseline

The current DUGA draft defines the allowed status vocabulary in `duga_change_requests.status`:

`proposed`, `analyzing`, `impact_review`, `awaiting_ai_audit`, `awaiting_human_approval`, `approved`, `implementing`, `validating`, `final_review`, `accepted`, `rejected`, `cancelled`, `blocked`.

The table also contains `state_version`, `policy_commit_sha`, base/implementation commit fields and requester/implementer identities. However, unlike assignments, findings, validation runs and jobs, the current draft has **no change-request INSERT/UPDATE/DELETE lifecycle triggers** and no automatic change-request transition audit trigger.

Consequences:
- A caller with database write access could insert a request directly in a late or terminal status.
- An update can currently jump between any CHECK-allowed statuses, including terminal states, without incrementing `state_version`.
- Identity, commit and policy fields are not protected by a change-request immutability/transition trigger.
- No database-generated audit event currently proves a change-request status transition.

These are schema-draft gaps, not proof of a live Preview vulnerability. The draft has not been installed in Preview.

## 2. State machine proposal

The following is a conservative proposed graph. It deliberately does not assume that a status label alone proves a gate was satisfied.

| Current state | Allowed next state | Gate that must be satisfied by the API |
|---|---|---|
| proposed | analyzing, cancelled, blocked | Authenticated requester/authorized Owner; required request fields validated |
| analyzing | impact_review, blocked, cancelled | Analysis evidence attached to exact request version and policy SHA |
| impact_review | awaiting_ai_audit, awaiting_human_approval, blocked, cancelled | Impact assessment complete; required systems/paths and risk decision recorded |
| awaiting_ai_audit | awaiting_human_approval, impact_review, blocked | Independent AI audit evidence is verified and references the exact implementation/base commit under review; changes-requested returns to impact review |
| awaiting_human_approval | approved, rejected, impact_review, blocked | Valid human approval/rejection evidence; approver assignment/scope/policy/commit match |
| approved | implementing, blocked | Approval still current; implementation assignment authorized; approved commit/policy binding unchanged |
| implementing | validating, blocked | Implementer identity and immutable target commit recorded; implementation evidence available |
| validating | final_review, implementing, blocked | Validation run is terminal and provider-verified; failed validation returns to implementation, never to final review |
| final_review | accepted, implementing, blocked | Final review verifies exact commit, successful validation, current approvals and policy |
| blocked | an explicitly recorded eligible resume state, or cancelled | Block reason resolved; fresh authorization and evidence; resume target recorded in audit payload |
| accepted | none | Terminal |
| rejected | none | Terminal |
| cancelled | none | Terminal |

No automatic transition is implied by a job finishing. The API must verify the relevant evidence and actor authority before changing a change-request state.

### 2.1 Important policy decisions still requiring owner/security review

- Whether `blocked` may resume and which states are eligible for each block reason.
- Whether `rejected` and `cancelled` are permanently terminal (this proposal says yes).
- Whether an approved request can be revoked after implementation starts, and what explicit supersession workflow is required.
- Whether a high/critical-risk request requires both independent AI audit and human approval, while low/medium risk may use a narrower path.
- Whether the same human can request, implement, review and approve; separation-of-duties policy must be explicit.
- What constitutes a new implementation attempt and whether each attempt must create a new immutable commit/evidence record.

Until these are decided, do not implement a permissive fallback transition.

## 3. Authorization contract by action

| Action | Required identity | Server-side authorization |
|---|---|---|
| Create request | Authenticated human session or authenticated AI principal | Derive requester identity from session/principal; never accept actor ID as authority |
| Start analysis | Authorized DUGA service principal or explicitly assigned operator | Check active assignment, scope, request version and policy SHA |
| Record impact assessment | Authorized analyst/service | Bind assessment to request ID, state version, commit and policy revision |
| Submit independent AI audit | Authenticated AI service principal | Must differ from implementer principal; verify trusted provenance and exact commit |
| Approve/reject | Authenticated human session | Verify active assignment, role, affected-system/platform scope, current policy SHA and exact commit |
| Start implementation | Authorized implementer identity | Verify approved request and active assignment; freeze implementation target |
| Start/finish validation | Authenticated validation service | Verify OIDC/provider evidence, run attempt, validator digest, artifact digest and job lease generation |
| Accept final result | Authorized human reviewer/Owner per policy | Verify all required evidence is complete, current and bound to same commit/policy |
| Block/cancel | Authorized actor for the relevant stage | Require stable reason code and immutable audit event; terminal cancellation cannot be reopened |

Role names alone are insufficient. Authorization must be evaluated against active assignment scope and the current request state/version.

## 4. Required database invariants before write API

A future schema revision should consider:

1. INSERT guard: every change request begins in `proposed`, with `state_version=1` and no implementation commit/implementer assignment.
2. UPDATE guard: status changes must follow the approved transition graph and increment `state_version` by exactly one.
3. Immutable identity: request ID, requester identity, creation time and original source/base/policy context cannot be silently rewritten. If a policy/base refresh is allowed, represent it as a separately versioned, auditable event with explicit revalidation requirements.
4. Commit binding: implementation commit is write-once per implementation attempt; a new attempt must be represented explicitly, not by silently replacing prior evidence.
5. Terminal-state guard: accepted/rejected/cancelled cannot be edited or reopened. Corrections require a new request linked by an explicit supersession relation.
6. Audit: every state transition produces an append-only audit event in the same database statement/transaction, including previous state, next state, old/new version, reason code, policy SHA and server-derived actor reference.
7. CAS: API update predicate must include request ID, expected status, expected state_version and relevant policy/commit values; require exactly one changed row.
8. DELETE: change requests are evidence roots and should not be physically deleted; use explicit cancellation/supersession.
9. Evidence prerequisites: state transition must not treat an arbitrary JSON claim as proof. Reviews, approvals and validations must be separately verified and reference the same request/commit/policy tuple.
10. Separation of duties: database constraints can prevent selected self-review cases, but trusted session/service identity and role/scope checks remain API responsibilities.

The SQL guard is defense in depth. It does not replace server-side authorization or trusted evidence verification.

## 5. API write contract

No write route is defined or authorized by this document. When separately approved, every mutation should follow this order:

1. Authenticate session or service principal.
2. Load request and server-side current state/version/policy/commit.
3. Derive actor identity from verified authentication context.
4. Validate action-specific role and active assignment scope.
5. Verify prerequisite review/approval/validation/provenance evidence.
6. Execute one conditional state transition with expected state/version and immutable bindings.
7. Check D1 `meta.changes`; zero rows means stale/conflicting state and must not be reported as success.
8. Insert the audit event atomically with the transition (or use a DB trigger).
9. Return success only after durable commit.
10. Test simultaneous conflicting transitions; only one may win.

Do not rely on read-then-write authorization without compare-and-swap. Do not accept `actor_user_id`, `actor_principal_id`, `approved=true`, `validation_passed=true`, or arbitrary commit/policy fields from the caller as authoritative.

## 6. Required regression and adversarial tests

- Insert directly as `approved`, `accepted`, `rejected`, `cancelled`, `blocked` -> rejected.
- Insert with state version other than 1 -> rejected.
- Skip required states (e.g. proposed -> approved; validating -> accepted) -> rejected.
- Change state without incrementing version or increment by more than one -> rejected.
- Change requester, creation time, original base/policy context or request identity -> rejected.
- Change implementation commit without a new attempt record -> rejected.
- Update/delete accepted, rejected or cancelled request -> rejected.
- Resume blocked request without reason, target state and fresh authorization -> rejected.
- Human approval with wrong user, revoked assignment, wrong scope, stale policy or different commit -> rejected.
- AI audit by the implementer principal -> rejected.
- Mark final review/accepted with failed, missing, stale or different-commit validation evidence -> rejected.
- Supply caller-forged actor identity or success flags -> ignored/rejected.
- Two concurrent transitions using the same expected state_version -> exactly one succeeds.
- Audit insert failure -> transition rolls back; no success response.
- All rejected cases prove no terminal or approval-eligible state was created.

## 7. Release gates and current limits

- Obtain explicit owner/security decisions for the open policy choices in section 2.1.
- Review the proposed graph against the product's actual DUGA workflow before encoding it.
- Design a migration only after Preview D1 migration history and backup/recovery are verified.
- Test the new schema in SQLite, then disposable D1, then Preview D1/runtime.
- Keep Production untouched absent separate explicit authorization.

This document is a design/gap assessment only. No schema change, API write route, OIDC flow, Preview D1 access, or deployment was performed.
