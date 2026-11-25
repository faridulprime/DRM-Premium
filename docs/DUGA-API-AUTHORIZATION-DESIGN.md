# DUGA API & Authorization Design
Version: 0.1.0
Status: Initial Owner-only health endpoint implemented and mocked-integration-tested; remaining governance API contract is proposed.

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
7. Derive actor identity from the authenticated session; never trust actor identity from request JSON.
8. Check independent reviewer is not the implementer.
9. Check human approver is authorized for the scope and risk level.
10. Verify review, approval and validation records all reference the same implementation commit.
11. Persist state transition and audit event atomically where possible.
12. Return minimum necessary data; paginate audit and findings endpoints.

## Implemented initial route
- GET /api/governance/health — authenticated Owner-only, read-only D1 connectivity and schema-readiness probe. It checks `SELECT 1`, then inspects the eight expected DUGA tables, required columns, named indexes and required triggers. It reports `not_installed`, `partial` or `ready` and returns missing structural elements; it never mutates the database.

## Remaining proposed route contracts
- GET /api/governance/overview — Owner-only operational summary.
- GET /api/governance/systems — versioned registry snapshot, read-only.
- GET /api/governance/changes — implemented Owner-only, read-only cursor-paginated list. Supports a bounded 1–50 page size, allow-listed status filter and title/summary search; returns only an explicit set of change-request columns and parsed affected-system/path arrays. Uses descending `(created_at,id)` keyset pagination and returns an opaque cursor. No write operations are exposed.
- POST /api/governance/changes — create a proposal; server assigns actor and ID.
- GET /api/governance/changes/:id — implemented Owner-only, read-only detail endpoint. Returns one request plus up to 50 reviews, approvals, validation runs and audit events per collection.
- POST /api/governance/changes/:id/reviews — AI audit/human review record; identity derived from trusted execution context.
- POST /api/governance/changes/:id/approvals — human Owner approval/rejection only.
- POST /api/governance/changes/:id/validation-runs — trusted validation runner result, not arbitrary browser assertion.
- GET /api/governance/audit — cursor-paginated append-only audit events.
- GET /api/governance/findings — DACE evidence findings; no destructive endpoint.

## Security invariants
- Never accept a browser-supplied role, approver identity, AI identity, implementation SHA or risk downgrade as authoritative.
- A changed implementation commit invalidates earlier review/approval/validation gates.
- Use optimistic state_version and conditional UPDATE for state transitions.
- Enforce actor/reviewer separation in application logic and, where practical, database triggers.
- Keep audit actor references under ON DELETE RESTRICT.
- No public unauthenticated governance endpoint.
- Governance API outage must not affect public content, auth, profile or website rendering.


## 14. Initial health endpoint — 2026-11-25
The catch-all API now handles `GET /api/governance/health` after normal session authentication and before generic admin route handling. It explicitly requires the existing application Owner role, returns 403 for Admin, probes D1 with a read-only `SELECT 1`, and reports the count/names of the expected eight DUGA tables from `sqlite_master`. Unknown governance paths return 404. This is a minimal routing/authentication foothold, not evidence of a deployed or runtime-tested endpoint; the branch has not been deployed to Preview.

## 16. Mocked health API test coverage
`scripts/test-governance-health-api.mjs` imports the Pages handler and tests the route with a minimal mock D1 binding. It verifies Owner success, Admin denial, unauthenticated/User denial, unknown-route 404, non-GET rejection, cross-origin mutation rejection, D1 probe failure 503 and missing-binding 503. This is handler-level integration coverage with mocked D1, not a live Cloudflare Preview test.

## 17. DUGA schema readiness response
The Owner health route reports `schema: not_installed` when none of the expected tables exist, `partial` when only some exist, and `ready` when all eight are present. This is a structural presence check only: it does not prove that table definitions, indexes, triggers, migration order or data integrity match the reviewed draft. A separate schema fingerprint/validation step is still required before declaring a Preview database accepted.

## 20. Read-only change request detail — 2026-11-25

`GET /api/governance/changes/:id` now returns a single change request and its related review, approval, validation-run and audit-event records. It requires the authenticated application Owner role, validates the path ID, uses parameter-bound queries, returns 404 for a missing request, and caps each related collection at 50 rows. The endpoint performs no writes and exposes no approval or state-transition action. Handler tests use mocked D1; live Preview D1 and deployed runtime remain unverified.

## 19. Read-only change request listing — 2026-11-25

`GET /api/governance/changes` is now implemented in the Pages catch-all handler. It reuses session authentication and explicitly requires the application Owner role. Query parameters are bounded: `limit` accepts 1–50 (default 25), `status` must be one of the DUGA lifecycle states, `q` is limited to 120 characters, and `cursor` is validated before use. SQL values are parameter-bound; sort order is deterministic by `created_at DESC,id DESC` and pagination is keyset-based. The response selects only named columns and converts the two JSON-array fields into arrays.

This is a read-only route. It does not create, update, approve, reject, assign, or audit a change request. If the DUGA table is absent or query fails, it returns a controlled 503. The new tests use mocked D1; they do not prove live Preview behavior, query performance under production data, or actual database readiness.

## 18. Structural schema inspection boundary
The health route now checks the required column names via read-only `PRAGMA table_info`, named index presence and required trigger presence via `sqlite_master`. A `ready` result means these named structural elements exist. It does not yet compare column types, nullability, CHECK/FK definitions, index column order/uniqueness, trigger SQL bodies, migration ledger or data integrity. Preview acceptance must still run a stronger schema-diff/fingerprint validator against a verified backup and migration history.
