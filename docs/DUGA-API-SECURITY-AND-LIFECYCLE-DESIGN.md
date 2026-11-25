# DUGA — API Security, State Lifecycle and Commit-Bound Evidence Design

Version: 0.1.0  
Status: Proposed design only. No API, migration, UI, or runtime authorization code is implemented by this document.

## 1. Purpose and boundaries

This document consolidates server-side controls required before DUGA write endpoints can be enabled. It extends `DUGA-API-AUTHORIZATION-DESIGN.md`, `DUGA-SPEC.md`, `DUGA-CAS-AUDIT-PATTERN.md`, and `governance/ownership/roles.json`.

Initial integration remains human Owner-session-only. DUGA assignments are not yet application permissions. AI principal IDs are attribution labels, not credentials. This document does not authorize a D1 migration, Preview binding change, Production action, merge, or deployment.

The transition matrix is a proposed explicit interpretation of the documented lifecycle. It requires review before becoming executable policy.

## 2. Trust boundaries

### Human requests
For every `/api/governance/*` request:
1. Require a valid, unexpired existing `frame_admin_session`, resolved server-side.
2. Require `user.role === "owner"` for the initial API slice. Ordinary Admin sessions do not receive governance access.
3. Derive actor ID/type only from the authenticated session.
4. Reject client-supplied actor, approver, reviewer, role, assignment, approval, validation status, risk, implementation SHA, policy SHA, transition token, or audit actor fields.
5. Preserve same-origin and JSON content-type checks for mutations.
6. Enforce a Governance-specific streaming byte limit, strict field allowlists, schema validation, bounded arrays/strings, capped pagination and generic external errors.
7. Never return password/session/OTP hashes, secrets, raw SQL errors or stack traces.

Owner-session-only is a conservative bootstrap gate, not proof that the Owner has a DUGA role assignment. Named identities and scope assignments must be explicitly confirmed before scoped role authorization is enabled.

### AI and validation services
- A `principal_id` in D1 or JSON is never authentication.
- Do not expose AI review or AI implementation write routes to browsers.
- Do not accept browser assertions that validation passed.
- Before service-originated writes, define short-lived, narrowly scoped, environment-bound credentials with server-side verification, expiry, rotation, revocation, replay protection and verified-principal audit attribution.
- Until then, AI analysis may be offline/static and human-submitted; it cannot authenticate as an AI reviewer or maintainer through a principal label.

### Policy and registry
- Load policy, roles, system registry and ownership from a pinned, verified Git revision or deployment-bundled snapshot.
- Record the exact policy/registry commit SHA used for each decision.
- Verify system IDs and path ownership against that snapshot; D1 is operational state, not a second writable registry.
- Fail closed if the policy snapshot is absent, invalid, or not tied to a known commit.

## 3. Authorization matrix

| Operation | Initial caller | Required rule |
|---|---|---|
| Read overview, systems, changes, one change, audit, findings | Human Owner session | Valid session; Owner role; bounded response and pagination |
| Create proposal | Human Owner session | Owner gate; actor from session; validate systems, paths, risk, branch and rollback |
| Human review | Human Owner session | Owner gate; reviewer from session; reviewer differs from stored implementer |
| Human approval/rejection | Human Owner session | Owner gate; human-only; applicable active assignment/scope required when scoped authorization is enabled |
| Validation result write | No browser caller | Trusted validation service only; no route until service identity exists |
| AI review write | No browser caller | Trusted independent AI service only; no route until service identity exists |
| Assignment/role mutation | Not in initial slice | Separate privileged workflow, explicit human actor, scope validation and audit |

Do not map existing application roles `owner/admin/user` silently to DUGA roles.

Future scoped authorization must resolve the current active assignment on every request, matching subject, role, scope type and exact scope ID. Revoked assignments grant no permission. Platform operations require the relevant platform-scoped role; system operations require a registered system and exact system scope.

Role semantics follow `governance/ownership/roles.json`: Platform Owner (platform-wide authority); Governance Manager (registry/config maintenance within delegated scope); System Owner (accountable human for assigned system); AI Maintainer (scoped implementation, not human approval); Independent AI Auditor (review only, cannot audit own implementation); Read-only Observer (read only). SQL role labels are descriptive, not authorization.

## 4. Proposed state-transition matrix

Documented states: `proposed`, `analyzing`, `impact_review`, `awaiting_ai_audit`, `awaiting_human_approval`, `approved`, `implementing`, `validating`, `final_review`, `accepted`; alternatives `rejected`, `cancelled`, `blocked`.

Only these candidate transitions are allowed; all unlisted pairs are denied:

| From | To | Required gate |
|---|---|---|
| proposed | analyzing | Proposal valid; systems/paths resolve against pinned registry |
| proposed | cancelled | Authorized human cancellation with rationale |
| analyzing | impact_review | Analysis evidence attached to current proposal revision |
| analyzing | blocked | Blocking reason recorded |
| analyzing | cancelled | Authorized human cancellation with rationale |
| impact_review | awaiting_ai_audit | Impact assessment complete; scope and risk fixed |
| impact_review | analyzing | Rework requested; rationale recorded |
| impact_review | blocked | Blocking reason recorded |
| impact_review | cancelled | Authorized human cancellation with rationale |
| awaiting_ai_audit | awaiting_human_approval | Trusted independent audit passed for current commit; reviewer differs from implementer |
| awaiting_ai_audit | impact_review | Audit requests changes; rationale/evidence recorded |
| awaiting_ai_audit | rejected | Explicit rejection and rationale |
| awaiting_ai_audit | blocked | Blocking reason recorded |
| awaiting_human_approval | approved | Required human approver authorized for scope/risk; same implementation commit |
| awaiting_human_approval | impact_review | Human reviewer requests changes; rationale recorded |
| awaiting_human_approval | rejected | Authorized human rejection with rationale |
| awaiting_human_approval | cancelled | Authorized human cancellation with rationale |
| approved | implementing | Approved commit/scope unchanged; implementer assigned and recorded |
| approved | cancelled | Authorized human cancellation with rationale |
| approved | blocked | Blocking reason recorded |
| implementing | validating | Implementation commit verified and fixed for this validation attempt |
| implementing | blocked | Blocking reason recorded |
| implementing | cancelled | Authorized human cancellation with rationale |
| validating | final_review | Trusted validation passed for current implementation commit |
| validating | implementing | Validation failed or implementation changed; new cycle required |
| validating | blocked | Blocking reason recorded |
| final_review | accepted | Final human gate satisfied; all required evidence matches current commit |
| final_review | implementing | Final review requests changes; rationale recorded; next commit invalidates old gates |
| final_review | rejected | Authorized human rejection with rationale |
| final_review | blocked | Blocking reason recorded |

Candidate terminal semantics:
- `accepted`, `rejected`, and `cancelled` are terminal. Reopening requires a new linked change request.
- `blocked` is a hold state with no outgoing transition in this proposal. Resumption requires an explicit policy amendment; otherwise create a new linked request.
- A `blocked` transition requires a non-empty reason and blocking condition.

**Owner review required:** confirm whether `blocked` is terminal or resumable, whether rejected/cancelled requests require a new linked request, and whether the rework edges above are correct. This matrix is proposed, not previously approved.

## 5. Risk and approval gates

- Risk is computed or validated server-side; clients cannot downgrade it.
- High/critical changes require Platform Owner approval.
- Lower-risk approval still requires the applicable active System Owner or Platform Owner assignment and exact scope under pinned policy.
- `duga_approvals.approver_role` is not proof of authorization.
- AI review and human approval are separate; neither substitutes for the other.
- Production merge, deployment, destructive operations and credential changes are separate actions requiring separate explicit authorization. An accepted change request does not authorize them.

## 6. Commit-bound evidence and invalidation

For a change request, `implementation_commit_sha` is the evidence target. Each review's `reviewed_commit_sha`, approval's `approved_commit_sha`, and validation's `commit_sha` must equal that exact target before the gate counts.

Evidence rows remain immutable historical records. Evidence is current only if:
- request ID matches;
- evidence commit exactly equals current `implementation_commit_sha`;
- decision/status satisfies the gate (approved review, approved human approval, passed validation);
- actor was authenticated/authorized under the relevant policy revision;
- reviewer/implementer separation and scope checks passed;
- policy/registry revision remains acceptable for this decision.

Any implementation SHA change makes all prior review, approval and validation evidence stale by comparison. Do not delete or rewrite historical evidence; derive staleness at read/transition time and require fresh evidence against the new SHA.

A commit update must be a guarded server operation:
1. Authenticate and authorize actor.
2. Verify canonical source ref and independently verify PR base/default/protected branch constraints.
3. Obtain SHA from trusted Git provider/API or trusted execution result; do not trust a browser SHA as proof.
4. Compare-and-swap request using expected `state_version` and allowed source state.
5. Store new SHA and append transition/audit event atomically using the tested token pattern.
6. Recompute gates; old evidence remains stored but no longer satisfies them.
7. Require fresh review, approval and successful validation against the new SHA.

If Git provider/ref verification is unavailable, fail closed. A policy/registry revision change that affects the decision also requires re-evaluation; record the exact policy/registry revision used.

## 7. Transition service algorithm

1. Authenticate and derive actor from trusted context.
2. Load pinned policy/registry and current request.
3. Verify scope, authorization, transition matrix, risk gates, evidence freshness and separation of duties.
4. Generate a cryptographically random one-time token on the server.
5. Execute conditional state UPDATE and token-guarded audit `INSERT ... SELECT` in one D1 batch, per `DUGA-CAS-AUDIT-PATTERN.md`.
6. Inspect each statement's own `meta.changes`; success requires exactly one update and one audit insert.
7. Zero changes means conflict; failed batch means no success response.
8. Re-read resulting state/evidence as needed.

The disposable D1 Worker returned aggregate PASS for CAS/audit, stale/replay/token reuse, rollback and competing-writer assertions. Captured PowerShell output did not print nested per-case counts; see `DUGA-D1-DISPOSABLE-ACCEPTANCE.md`. This is not Production or shared Preview acceptance.

## 8. Route contract refinements

Routes in `DUGA-API-AUTHORIZATION-DESIGN.md` remain proposals:
- Keep Governance dispatcher isolated after session resolution and before generic Builder/Admin fallback.
- Explicitly enumerate method/path pairs; unknown methods/paths return controlled 404/405.
- GET routes still require authentication and Owner authorization.
- Mutation payloads use strict allowlists; server-owned fields are generated/resolved server-side.
- Proposal creation accepts title, summary, rationale, affected system IDs, normalized paths, rollback plan and source ref; not status, actor, approval, implementation SHA or policy SHA as authoritative.
- Review creation does not accept reviewer identity or arbitrary `reviewer_type`; AI review requires trusted context.
- Approval creation does not accept approver identity or role claims.
- Validation writes do not exist until trusted runner authentication exists.
- Audit/findings reads are cursor-paginated with bounded limits and field minimization.

## 9. Required security and regression tests

Before any Preview write endpoint:
- unauthenticated, expired session, ordinary Admin and Owner access matrix;
- same-origin, wrong-origin, missing-origin, wrong content type, oversized/chunked body;
- unknown fields and spoofed actor/role/approver/reviewer/principal/risk/SHA/token;
- malformed/oversized arrays, paths and JSON;
- revoked assignment, wrong scope, unknown system and invalid path ownership;
- every allowed and denied state transition;
- stale `state_version`, replayed token and concurrent writers;
- implementer self-review; AI identity attempting human approval;
- high/critical risk without Platform Owner approval;
- changed implementation SHA makes all old evidence stale;
- browser validation assertion rejected; trusted runner with wrong commit rejected;
- canonical ref parsing, protected/default branch and incorrect PR base rejection;
- append-only audit, actor provenance, rollback and exactly-one audit event;
- regression tests for public auth/registration, profile, presence, Builder and existing Admin routes;
- Governance outage does not break public rendering or authentication.

## 10. No-go conditions

Do not implement or enable write endpoints until:
1. Owner approves exact transition matrix and blocked/terminal semantics.
2. D1 migration is reconciled with Preview migration history and separately approved.
3. Disposable D1 evidence is independently reviewed.
4. Trusted Git ref/commit verification is specified and tested.
5. Existing Owner-session integration and route isolation have regression tests.
6. AI/validation service identities exist before their respective write endpoints.
7. Security review confirms actor, scope, risk, commit and audit invariants.

No production migration, deployment, merge or live binding change is authorized by this design.
