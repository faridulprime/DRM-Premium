# DUGA API & Authorization Design
Version: 0.1.0
Status: Owner-only read-only health, overview, change-list, change-detail, findings-list and audit-list endpoints implemented and mocked-handler-tested; all governance write endpoints remain proposed.

## Existing API behavior observed
The current API is implemented in one Cloudflare Pages catch-all file: `functions/api/[[path]].js`.
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
- GET /api/governance/health — authenticated Owner-only, read-only D1 connectivity and schema-readiness probe. It checks `SELECT 1`, then inspects the eight expected DUGA tables, required column names, named indexes and required trigger ownership. For selected critical triggers—including all four `duga_change_requests` lifecycle triggers—it also checks SQL-definition markers (the expected operation/table and abort-message or event markers). It reports `not_installed`, `partial` or `ready` and returns missing structural elements; it never mutates the database. The response labels this level `presence-and-critical-trigger-markers`; it is not full schema equivalence. The separate in-memory schema validator now checks selected critical column declarations, index column order/uniqueness/partial flags, critical foreign-key relationships plus `ON UPDATE NO ACTION`/`ON DELETE RESTRICT`, trigger timing/operation markers, and targeted CHECK-expression anchors for assignment identity/role/scope, change-request requester/implementer attribution and source branch, reviewer identity/review-type pairing, audit actor identity, finding review metadata/confidence and job lease invariants. These are targeted anchors, not a full SQL-expression equivalence proof. It still does not verify every column declaration, every CHECK expression, complete trigger semantics, live D1 state, or the migration ledger.

## Remaining proposed route contracts
- GET /api/governance/overview — Owner-only operational summary.
- GET /api/governance/systems — versioned registry snapshot, read-only.
- GET /api/governance/changes — implemented Owner-only, read-only cursor-paginated list. Supports a bounded 1–50 page size, allow-listed status filter and title/summary search; returns only an explicit set of change-request columns and parsed affected-system/path arrays. Uses descending `(created_at,id)` keyset pagination and returns an opaque cursor. No write operations are exposed.
- POST /api/governance/changes — create a proposal; server assigns actor and ID.
- GET /api/governance/changes/:id — implemented Owner-only, read-only detail endpoint. Returns one request plus up to 50 reviews, approvals, validation runs and audit events per collection.
- POST /api/governance/changes/:id/reviews — AI audit/human review record; identity derived from trusted execution context.
- POST /api/governance/changes/:id/approvals — human Owner approval/rejection only.
- POST /api/governance/changes/:id/validation-runs — trusted validation runner result, not arbitrary browser assertion.
- GET /api/governance/audit — implemented Owner-only, read-only cursor-paginated append-only audit events. Supports bounded page size and allow-listed aggregate type filter; exposes explicit event/actor/payload fields only. No mutation is exposed.
- GET /api/governance/findings — implemented Owner-only, read-only, cursor-paginated DACE evidence findings. Supports bounded status/classification filters and file/symbol/commit search; returns an explicit column set. No mutation is exposed.

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

## 21. Read-only audit event listing — 2026-11-25

`GET /api/governance/audit` returns a bounded, keyset-paginated stream of DUGA audit events, optionally filtered by allow-listed `aggregate_type`. It selects an explicit set of event and actor fields, uses bound SQL parameters, validates cursors and returns a controlled 503 if the audit table is unavailable. The route is Owner-only and read-only; append-only enforcement remains a database-trigger responsibility in the schema draft. Mocked handler tests cover pagination, filters, authorization and storage failure. Live Preview behavior and real audit data remain unverified.

## 22. Read-only analysis findings listing — 2026-11-25

`GET /api/governance/findings` is implemented as an Owner-only read route. It supports a bounded page size (1–50), allow-listed finding status (`open`, `under_review`, `accepted`, `dismissed`, `quarantined`) and classification (`A`–`E`) filters, a bounded file/symbol/commit search term, and descending `(created_at,id)` keyset pagination. The response uses an explicit column allow-list and bound SQL parameters. Invalid filters/cursors return 400, non-GET requests return 405, and storage failures return 503. Mocked tests cover pagination, filters, authorization and error handling. Live Preview schema/data and runtime behavior remain unverified.

## 23. Read-only governance overview — 2026-11-25

`GET /api/governance/overview` returns Owner-only aggregate counts grouped by status for change requests, analysis findings, jobs and assignments. It performs four read-only grouped-count queries in parallel, returns a generation timestamp, and exposes no individual records or mutation capability. Missing/unavailable DUGA tables fail closed with 503. Mocked handler tests cover counts, Owner authorization, GET-only behavior and query failure. This endpoint is not evidence that Preview D1 has the draft schema installed; live Preview data remains unverified.


## 22. Change-request lifecycle schema-draft enforcement — 2026-11-26

The feature-branch operational schema draft now includes database-level lifecycle enforcement for `duga_change_requests`:

- New requests must begin as `proposed`, version 1, without an implementer or implementation commit, and with matching creation/update timestamps.
- The database enforces the 29-edge transition allow-list, exact +1 `state_version` increments, terminal-state protection and physical-delete denial.
- Request identity and all proposal content/scope fields (title, summary, rationale, risk, affected systems/paths, rollback plan, source branch, base commit and policy commit) are immutable after creation. Corrections require a successor request.
- `blocked_from_status` and an enumerated `block_reason_code` are required when entering `blocked`; the only resume path is `impact_review`, or cancellation.
- Implementer identity can be assigned only on `approved → implementing` and cannot later be replaced. The first implementation commit is write-once; changed-commit retries require a future attempt-history model or a successor request.
- A database trigger appends a synthetic transition event with actor `system / duga-db-trigger`. This proves the database transition occurred, not who authenticated. A future API must add a separate actor-attributed audit event in the same D1 batch.

Validation evidence: GitHub Actions passed on schema/test commit `28cbb5fa41da702f1e32258520084561476e2e59`:
- [DUGA Governance run #45672777605](https://github.com/faridulprime/DRM-Premium/actions/runs/45672777605)
- [DUGA schema smoke run #45672777617](https://github.com/faridulprime/DRM-Premium/actions/runs/45672777617)

The in-memory suite exercises all 29 allowed edges and rejects 127 unlisted source/target pairs. It also tests proposal immutability, stale expected-version updates returning zero changed rows, atomic rollback when the audit insert is forced to fail, and the non-empty implementation-commit requirement before validation. Structural-validator assertions for proposal-scope immutability and commit-before-validation passed on commit `223d81f3d8543616a6a21e2185416b8695af2bd1` in [DUGA Governance run #45672833627](https://github.com/faridulprime/DRM-Premium/actions/runs/45672833627).

**Boundary:** this is schema-draft and local SQLite evidence only. No governance write route, migration, D1 operation or Preview/Production deployment was performed. The API remains NO-GO until migration history, backup/recovery, D1 batch semantics, trusted actor identity and separate approval gates are complete.


## 24. Write contract and lifecycle-readiness hardening — 2026-11-26

The detailed future mutation contract is now documented in `docs/DUGA-API-WRITE-CONTRACT.md`. It specifies session-derived human identity, disabled/untrusted AI and runner identities until separately designed, named commands rather than arbitrary status setters, exact-state/version CAS, atomic actor-attributed audit requirements, idempotency, concurrency handling, HTTP conflict semantics and disposable-D1 acceptance gates.

No write route was added. D1 `batch()` atomicity and the proposed `changes()` coupling mechanism remain unverified; therefore the write API remains NO-GO.

A code review found that `GET /api/governance/health` did not require any lifecycle trigger on `duga_change_requests`, and omitted `blocked_from_status` / `block_reason_code` from its expected columns. It could therefore return `schema: ready` while the core lifecycle enforcement was missing. The health contract now requires:
- `duga_change_requests_insert_guard`
- `duga_change_requests_update_guard`
- `duga_change_requests_no_delete`
- `duga_change_request_transition_audit`
- both blocked-state metadata columns.

The mocked health suite now explicitly tests a missing transition-audit trigger and a missing block-reason column; both return `schema: partial`. The complete DUGA Governance CI workflow passed on commit `2481651798ef60c3793bfeafe81abff1cd9aeec6` ([run #45673718961](https://github.com/faridulprime/DRM-Premium/actions/runs/45673718961)), including handler syntax, mocked route tests, in-memory SQLite smoke tests and deep structural validation. These checks are targeted markers, not full schema equivalence or live D1 evidence.
