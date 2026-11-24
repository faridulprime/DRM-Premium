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

## Security invariants
- Never accept a browser-supplied role, approver identity, AI identity, implementation SHA or risk downgrade as authoritative.
- The SQL approval-role enum is not proof of authorization; verify active assignment and scope against the pinned registry.
- Validate Git refs canonically and verify both source and target branches; do not rely on rejecting only the literal `main`.
- A changed implementation commit invalidates earlier review/approval/validation gates.
- Use optimistic state_version and conditional UPDATE for state transitions.
- Enforce actor/reviewer separation in application logic and, where practical, database triggers.
- Keep audit actor references under ON DELETE RESTRICT.
- No public unauthenticated governance endpoint.
- Governance API outage must not affect public content, auth, profile or website rendering.
