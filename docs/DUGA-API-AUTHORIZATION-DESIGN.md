# DUGA API & Authorization Design
Version: 0.1.0
Status: Proposed contract only; no endpoint is implemented.

## Existing API behavior observed
The current API is implemented in one Cloudflare Pages catch-all file: functions/api/[[path]].js.
- It requires env.DB.
- Non-GET requests require matching same-origin Origin and JSON content type.
- Session lookup reads the frame_admin_session cookie, hashes the opaque token and joins sessions to users.
- General admin routes require a session with role owner or admin.
- Owner-only routes explicitly check user.role === "owner".
- The existing role model is application authorization and is not equivalent to DUGA governance roles.

## Proposed authorization policy
Foundation API administration is Owner-only initially. This reuses the existing authenticated human Owner and avoids silently granting governance powers to all Admins. Later scoped System Owner permissions may be introduced only after explicit human identity assignments and a separately reviewed authorization integration.

AI principal IDs in D1 are labels for attribution and review separation, not credentials. No request is authenticated merely by sending a principal ID. A future AI service identity must use a separately designed short-lived credential, narrow scopes, rotation/revocation and server-side verification.

## Request processing order
1. Resolve route and reject unknown methods.
2. Enforce content type and same-origin checks for mutations (preserve existing middleware).
3. Authenticate session for all governance endpoints.
4. Check current user role is Owner for initial governance management.
5. Load the desired-state policy/registry from a pinned, verified source revision or deployment-bundled snapshot.
6. Validate request schema, allowed scope, risk and state transition on server.
7. Parse and validate the canonical Git source ref; reject the default/protected branch and independently verify the PR base branch. A literal string check against `main` is insufficient.
8. Derive actor identity from the authenticated session; never trust actor identity from request JSON.
9. Resolve the actor's current active assignment and exact scope from the pinned registry for every authorization decision; revocation must take effect immediately.
10. Check independent reviewer is not the implementer.
11. Check human approver's active assignment, scope and risk-specific authority; high/critical changes require Platform Owner approval.
12. Verify review, approval and validation records all reference the same implementation commit.
13. Persist state transition and audit event atomically where possible.
14. Return minimum necessary data; paginate audit and findings endpoints.

## Proposed route contracts
- GET /api/governance/overview — Owner-only operational summary.
- GET /api/governance/systems — versioned registry snapshot, read-only.
- GET /api/governance/changes — cursor-paginated requests.
- POST /api/governance/changes — create a proposal; server assigns actor and ID.
- GET /api/governance/changes/:id — request plus related reviews, approvals and validations.
- POST /api/governance/changes/:id/reviews — AI audit/human review record; identity derived from trusted execution context.
- POST /api/governance/changes/:id/approvals — human Owner approval/rejection only.
- POST /api/governance/changes/:id/validation-runs — trusted validation runner result, not arbitrary browser assertion.
- GET /api/governance/audit — cursor-paginated append-only audit events.
- GET /api/governance/findings — DACE evidence findings; no destructive endpoint.

## State transition transaction contract

A state transition must be a compare-and-swap operation, not a read-then-unconditional-write:
- Read `status`, `state_version` and `implementation_commit_sha`.
- Validate the transition matrix, active actor assignment, risk gates and commit-bound evidence.
- Update with `WHERE id = ? AND state_version = ? AND status = ?`, incrementing `state_version`.
- Require one changed row. If zero rows changed, return a conflict and do not append an accepted/approved event. Cloudflare documents each D1 statement result with `meta.changes`; inspect the conditional UPDATE's result entry, not aggregate batch totals.
- Insert the audit event in the same D1 batch/transaction as the state update. A failed audit insert must roll back the state change.
- Treat evidence rows as immutable history. If `implementation_commit_sha` changes, all prior review, approval and validation evidence is stale until re-recorded against the new commit.

The local SQLite test suite models a stale second writer and verifies rollback when an audit insert fails. Cloudflare's current D1 docs state that `batch()` is transactional and rolls back the sequence on statement failure. A disposable-Preview test remains necessary for this schema's concrete statement results and exactly-one-row detection. D1's documented `D1Result.meta.changes` is the row-change count for each `run()`/`batch()` statement result. References: https://developers.cloudflare.com/d1/worker-api/d1-database/ and https://developers.cloudflare.com/d1/worker-api/return-object/.

## Security invariants
- Never accept a browser-supplied role, approver identity, AI identity, implementation SHA or risk downgrade as authoritative.
- The SQL approval-role enum is not proof of authorization; verify active assignment and scope against the pinned registry.
- Validate Git refs canonically and verify both source and target branches; do not rely on rejecting only the literal `main`.
- A changed implementation commit invalidates earlier review/approval/validation gates.
- Use optimistic state_version and conditional UPDATE for state transitions.
- The conditional UPDATE and audit-event INSERT must execute in one D1 batch/transaction; require exactly one changed request row, and return a conflict without recording success if the version/status predicate matches zero rows. Cloudflare documents batch execution as transactional with rollback on any failed statement; verify the exact D1 result metadata used for the row-count check in disposable Preview.
- Before accepting a change, compare the current implementation commit with every required review, approval and successful validation commit. A mismatch makes that evidence stale even though the historical row remains stored.
- Enforce actor/reviewer separation in application logic and, where practical, database triggers.
- Keep audit actor references under ON DELETE RESTRICT.
- No public unauthenticated governance endpoint.
- Governance API outage must not affect public content, auth, profile or website rendering.
