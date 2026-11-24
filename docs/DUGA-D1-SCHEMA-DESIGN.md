# DUGA Operational D1 Schema Design
Version: 0.1.0
Status: Design only — not a migration; not applied to any database.
Target future migration filename: migrations/0009_duga_governance_foundation.sql

## 1. Existing database constraints observed
- Existing application identities live in users(id,email,username,role,...); roles currently include owner, admin and user.
- Sessions are opaque-token hashes in sessions, joined to users.
- The API is a single Cloudflare Pages Functions catch-all at functions/api/[[path]].js.
- Mutating requests currently require JSON content type and a matching same-origin Origin header.
- Admin API access currently requires an authenticated user with role owner/admin; the Website Builder has an additional owner-only check.
- Existing schema includes users, sessions, login_attempts, content tables, owner_setup_otps, analytics_events, admin_presence, site_builder_documents, site_builder_revisions, visitor_presence, user_registration_otps, user_restrictions, user_activity_hours and user_profiles.

## 2. Migration ordering hazard
The repository contains both 0004_admin_analytics.sql and 0004_owner_email_otp.sql, and both 0007_user_registration.sql and 0007_user_restrictions_and_activity.sql. These are distinct files sharing numeric prefixes. README lists both files as required, but manual D1 execution history has not been inspected. The proposed next filename is migrations/0009_duga_governance_foundation.sql because the highest existing prefix is 0008. Before creating/running it, confirm Preview's actual applied migration state and use D1 migration history or a verified export. Do not infer applied state from filenames alone.

## 3. Hybrid authority
GitHub remains authoritative for desired-state system definitions, roles/policies, schemas and migration source. D1 stores operational assignments, requests, reviews, approvals, validation runs, audit events, jobs and evidence findings. Each operational record should capture relevant policy/schema version and Git commit SHA. Never maintain two writable authorities for the same field.

## 4. Proposed tables
1. duga_assignments: scoped human or AI principal role assignments. Exactly one of user_id or principal_id is populated. Human references use users(id); AI principals are identifiers, not fake user accounts or login credentials.
2. duga_change_requests: request metadata, state, risk, affected systems/paths, source branch, base commit, policy commit, rollback plan and optional implementer identity/commit.
3. duga_reviews: independent AI audit or human review, reviewer identity, decision, reviewed commit and evidence. The implementer must not review their own change.
4. duga_approvals: human-only approval/rejection records. AI identities cannot satisfy human approval.
5. duga_validation_runs: machine validation status, tool/version, commit, evidence and timestamps.
6. duga_audit_events: append-only operational event log with actor, aggregate, event type, payload and policy commit reference.
7. duga_analysis_findings: DACE evidence and classification A–E; no delete/execute capability.
8. duga_jobs: asynchronous validation/analysis job lifecycle, lease and retry metadata.

Do not create a D1 copy of the Git system registry as an independent writable source. A later read-only cache can be added only with an explicit source commit and refresh contract.

## 5. Integrity and constraints
- Use TEXT UUIDs for externally referenced records.
- Use integer Unix epoch seconds consistently, matching existing API patterns.
- Use CHECK constraints for enumerations, trimmed non-empty identifiers/required text and JSON syntax validity where supported; reject whitespace-only rollback plans, principals and evidence identifiers.
- Use foreign keys to existing users for human identities; use ON DELETE RESTRICT for governance actors/approvers so deleting an account cannot erase accountability history.
- Use XOR CHECK constraints for human vs AI actor identity.
- Use scoped unique indexes for active assignments; enforce at most one active Platform Owner and one active human System Owner per system. Revoked assignments remain as history and permit replacement.
- Add indexes for status/time, request references, actor lookups and pending jobs.
- Enforce basic temporal consistency in SQL: assignment revocation cannot predate creation; change/job updates cannot predate creation; validation status must agree with start/completion timestamps; completed validation cannot finish before it starts; running jobs require a lease, queued/terminal jobs must not retain one, and succeeded jobs must contain a result payload.
- Require finding review timestamp and reviewer identity to be either both absent or both present, with review time not before finding creation.
- Use optimistic state versioning on change requests to prevent lost updates.
- Preserve audit history: UPDATE and DELETE triggers should abort for duga_audit_events. Corrections are new events.
- A trigger is not cryptographic tamper-proofing against a database administrator. Periodically export/sign audit checkpoints outside D1 in a later operational phase.
- D1 foreign-key enforcement and batch transaction semantics must be verified in Preview before relying on them.

## 6. State machine
Change request states:
proposed → analyzing → impact_review → awaiting_ai_audit → awaiting_human_approval → approved → implementing → validating → final_review → accepted.
Terminal alternatives: rejected, cancelled, blocked.
Only documented transitions are allowed. A state transition must append an audit event in the same D1 batch where feasible. API validates actor permission and transition preconditions; SQL CHECK only validates the allowed state value.

Approval gates:
- Independent AI review must be recorded against the implementation commit.
- Human approval is a separate record and must reference the reviewed commit.
- Validation must pass for the same commit being accepted.
- If commit SHA changes after approval/review, the gates become stale and must be repeated.
- High/critical risk requires Platform Owner approval; production merge/deploy remains a separate explicitly authorized operation.

## 7. Authorization integration design
- Do not replace current Owner/Admin/User application roles.
- Initial governance access: require a valid existing session and server-side Owner role check for governance administration. Do not expose AI-principal API credentials or pretend an AI principal is authenticated merely because its ID exists in D1.
- A future scoped governance permission check must validate active assignment, scope, user session, and role on every request.
- Read-only endpoints must still authenticate; mutation endpoints also require existing same-origin/JSON protections, rate limiting where appropriate, and audit writes.
- AI automation should use a separately designed service identity/short-lived credential mechanism, not a user session or hard-coded principal ID.
- Do not trust role, actor, risk, approval state, commit SHA or scope supplied by the browser without server-side validation.
- Existing catch-all router needs explicit governance route handling before generic admin fallback; route order and getSession semantics must be tested.

## 8. API contract proposal (not implemented)
- GET /api/governance/overview: Owner-only counts and health summary.
- GET /api/governance/systems: read-only registry snapshot sourced from versioned Git config.
- GET /api/governance/changes: paginated requests.
- POST /api/governance/changes: create proposal with server-generated ID and actor identity.
- GET /api/governance/changes/:id: request and related evidence.
- POST /api/governance/changes/:id/reviews: AI audit/human review record; identity derived from trusted execution context.
- POST /api/governance/changes/:id/approvals: human approval/rejection only.
- POST /api/governance/changes/:id/validation-runs: trusted validation runner result, not arbitrary browser assertion.
- GET /api/governance/audit: filtered, cursor-paginated audit events.
- GET /api/governance/findings: DACE evidence findings; no destructive endpoint.
All endpoints are proposals. No route is live as a result of this document.

## 9. Preview acceptance tests before migration rollout
1. Export/backup Preview D1 and record migration history.
2. Apply the candidate migration to a disposable Preview database first.
3. Verify all tables, indexes, checks, foreign keys and triggers.
4. Test human/AI XOR constraints and invalid roles/states.
5. Test audit UPDATE/DELETE rejection.
6. Test that deleting a referenced human account is restricted.
7. Test duplicate scoped assignment rejection.
8. Test review/approval commit staleness and implementer/auditor separation in API.
9. Test transaction/batch behavior and concurrent state updates.
10. Verify all existing auth, content, registration, profile, presence and builder flows still pass.
11. Confirm Production DB binding is not used by Preview.
12. Do not apply to Production under this design approval.

## 10. Explicit non-goals
This document does not create a migration, API, UI, AI credential system, executable DACE, production deployment or database change. Those require a separate reviewed implementation change.


## 11. Local SQL prototype review — 2026-11-25
The schema draft was syntax-tested in a local SQLite 3.46.1 in-memory database with a minimal users parent table. Eight DUGA tables, 16 indexes and two append-only audit triggers were created successfully. Behavioral probes passed for duplicate Platform Owner prevention, invalid human/AI actor combinations, audit UPDATE/DELETE rejection, referenced-user deletion restriction and malformed JSON rejection.

The first probe exposed a role-kind/scope gap: the original draft did not prevent an AI principal from being assigned a human-only role. The SQL draft was tightened with CHECK constraints matching governance/ownership/roles.json: platform-owner, governance-manager and system-owner are human roles; ai-maintainer and independent-ai-auditor are AI roles; platform-wide roles use platform scope and system roles use system scope. Follow-up probes passed for AI-as-platform-owner rejection, wrong-scope AI maintainer rejection, human-as-AI-auditor rejection and a valid system-scoped AI maintainer.

Limitations: this was a local SQLite syntax/constraint test, not a Cloudflare D1 test. It does not validate Cloudflare's deployed SQLite runtime, D1 foreign-key settings, D1 batch semantics, migration history, API authorization, or regression compatibility with the live Preview database. No D1 database was accessed or modified.


## 12. Lifecycle and authorization gap review — 2026-11-25

The schema was reviewed against the state-machine and authorization requirements above. The SQL draft enforces allowed enum values and identity-shape constraints, but it intentionally does not enforce the complete governance workflow. These are implementation gates, not evidence that the API already enforces them.

### SQL-level checks now covered by local probes
- Active assignment cardinality: at most one active Platform Owner globally and one active human System Owner per system; revocation permits reassignment.
- Temporal consistency: assignment revocation ordering, validation queued/running/completed timestamp shapes, job lease/status consistency, successful job result requirement, and update timestamp ordering.
- Required text/identity values reject whitespace-only strings, including rollback plan and AI principal IDs.
- Change request rejects unknown risk values, invalid human/AI requester combinations and the literal `main` source branch.
- Review rows reject mismatched reviewer type and review type (for example, an AI principal cannot submit a `human_review`).
- Approval rows reject role labels outside `system-owner` and `platform-owner`.
- Validation rows reject unknown statuses and malformed JSON evidence.
- A valid terminal status is accepted by the SQL enum. This demonstrates that enum validation is not transition authorization.

### Mandatory server-side invariants before any API can be enabled
1. **Transition matrix:** validate every old-state → new-state pair against an explicit transition table; reject direct jumps such as proposed → accepted. Use `state_version` in a conditional UPDATE and require exactly one affected row.
2. **Commit-bound gates:** before acceptance, require the current `implementation_commit_sha` to equal the reviewed, approved and successfully validated commit. Any implementation SHA change invalidates all earlier gates and requires a new review/approval/validation sequence.
3. **Reviewer separation:** resolve the implementer from the stored request; reject a review if reviewer identity equals the implementer. AI principal IDs are attribution labels only until a trusted AI service authentication design exists.
4. **Approver authorization:** derive the human approver from the authenticated session; verify the current active assignment and scope in the pinned Git registry. Never trust `approver_role` from request JSON or the database row alone.
5. **Risk-specific approval:** high/critical changes require Platform Owner approval; production merge and deployment remain separate authorization events.
6. **Trusted validation:** only a trusted CI/validation runner may create authoritative validation results. A browser must not be able to assert `passed`.
7. **Assignment lifecycle:** check active assignment, scope and role on every authorization decision. Revocation must take effect immediately; do not treat an old assignment row as active merely because it exists.
8. **Audit actor integrity:** derive human actor from session and system actor from a server-controlled allowlist. Never accept `actor_type`, `actor_user_id`, `actor_principal_id` or `actor_system_id` as trusted client claims.
9. **JSON shape validation:** SQL currently checks JSON syntax, not that affected-system/path values are arrays of the expected primitive types. Validate those shapes in the API before persistence.
10. **Registry references:** D1 does not own a writable system registry. Verify system IDs and path ownership against the pinned Git registry revision referenced by the change.
11. **Canonical branch validation:** the SQL check only rejects the literal `main`; the API must parse and validate the Git ref, reject `main`, `refs/heads/main`, protected/default branches and malformed refs, and independently verify the PR base branch. Never infer branch safety from a string inequality.
12. **Role-specific approval:** the SQL `approver_role` enum is descriptive, not authorization. Resolve the approver's active assignment and scope from the pinned registry; require Platform Owner for high/critical risk, and enforce the applicable System Owner/platform-policy gates for lower risk.

### Local test boundary
The expanded in-memory SQLite smoke test exercises the SQL constraints above and includes an explicit probe showing that the database permits a listed status to be written directly. This is expected under the current draft: transition order, commit staleness, assignment authorization and trusted actor provenance must be enforced in the future API/service layer. The test does not claim those server-side controls are implemented. Cloudflare D1 behavior remains unverified.
