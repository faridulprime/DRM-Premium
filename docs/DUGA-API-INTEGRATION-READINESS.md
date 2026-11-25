# DUGA API Integration Readiness Audit

Version: 0.1.0
Status: Static source review; no runtime API changes
Branch: `feature/full-admin-panel`
Reviewed: 2026-11-25
Baseline at start of review: `542d4fc95db50a48f607a0728335a9e1bae78af7`

## 1. Executive decision

**DUGA API implementation is not ready to be enabled against the current Preview D1 database.**

The existing application has a suitable starting point for a separately gated Owner-only API:
- one Pages Functions catch-all router at `functions/api/[[path]].js`;
- server-side session lookup from the HttpOnly `frame_admin_session` cookie;
- a server-derived user record with `id`, `email`, `username` and `role`;
- a global same-origin check and JSON content-type requirement for non-GET requests;
- Owner-only checks already used by existing management operations.

However:
- no `/api/governance/*` endpoint is implemented;
- the DUGA operational schema remains a design draft and has not been applied;
- no trusted AI service-authentication mechanism exists;
- the migration history for Preview is not recorded in the inspected schema;
- D1 transactional and foreign-key behavior for the proposed governance workflow has not been tested in Cloudflare D1.

Therefore this audit recommends an implementation sequence, not immediate endpoint activation.

## 2. Existing request pipeline observed

Source: `functions/api/[[path]].js`.

The current handler performs these operations:

1. Rejects requests if `env.DB` is missing.
2. Parses the path after `/api/` into path segments.
3. For every non-GET request, requires:
   - an `Origin` header equal to the request URL's origin;
   - a content type containing `application/json`.
4. Handles public/presence/authentication routes.
5. Handles profile routes.
6. Resolves the authenticated session using `getSession(req, env)`.
7. Rejects requests without an authenticated Owner/Admin session.
8. Handles Builder routes and existing Admin routes.
9. Returns 404 for unmatched routes.

Session lookup hashes the opaque cookie token and joins `sessions` to `users`, checking session expiry. The returned user identity is derived from D1, not the request body.

### Integration consequence

A Governance route must be placed deliberately in this pipeline. It must not be placed among public auth routes, and it must not accidentally inherit a broad Admin permission without its own explicit Owner check.

Recommended initial placement: after successful session resolution and before the Builder/Admin fallback, using an explicit `p[0] === "governance"` dispatcher that checks `user.role === "owner"` for every governance route. Keep the existing generic Admin gate unchanged for all other routes.

This is a placement recommendation only; no code has been changed.

## 3. Required security boundary

Initial Governance authorization should use the existing human Owner session.

For every Governance request:
- require an authenticated, unexpired session;
- require server-side `user.role === "owner"`;
- derive actor user ID and actor type from the session;
- ignore or reject client-supplied actor IDs, roles, approver IDs and principal IDs;
- do not trust browser-supplied risk level, scope, implementation SHA, review status or approval status;
- validate every state transition on the server;
- use optimistic `state_version` checks to prevent stale concurrent updates;
- append an audit event for every accepted state transition;
- paginate audit and findings reads;
- do not expose password hashes, session hashes, OTP hashes or secrets.

DUGA role assignments are not currently application permissions. Do not silently map the existing `owner/admin/user` roles to the separate governance role set.

## 4. AI identity boundary

The current API has no trusted AI principal authentication or execution identity.

A `principal_id` stored in D1 is attribution metadata, not proof of identity. A browser or API caller must not become an AI maintainer/auditor by sending a principal ID.

Before any AI-originated write is introduced, design a separate service-authentication mechanism with:
- short-lived credentials;
- narrow scopes and explicit environment binding;
- server-side signature/token verification;
- expiry, rotation and revocation;
- replay protection;
- audit attribution to the verified service principal;
- separation between implementer and independent auditor.

Until then, AI-originated actions should be limited to offline/static analysis and human-submitted proposals. No AI service endpoint should accept unauthenticated principal labels.

## 5. Request validation and payload limits

The existing generic `readBody` helper limits requests to 20 KB based on Content-Length and parses JSON. It does not provide a Governance-specific schema validator or a complete streaming byte-limit guarantee for chunked requests.

The existing Builder has a separate 250 KB parser and recursive validation logic, but that helper is Builder-specific and should not be reused as a generic Governance parser without review.

Recommended Governance-specific validation:
- enforce a byte limit while reading the actual body, not only from Content-Length;
- reject unknown fields for state-changing operations;
- validate JSON shape and string/array limits;
- validate enum values against the versioned policy;
- validate all referenced paths and scope identifiers;
- cap pagination limits and cursor lengths;
- reject malformed or oversized evidence payloads;
- avoid returning raw internal stack traces or SQL errors.

The first API slice should use small, bounded request bodies. Large evidence bundles should be stored/referenced through a separately designed artifact mechanism, not posted directly as arbitrary JSON.

## 6. Proposed route dispatch and authorization matrix

| Route | Method | Initial access | Mutation |
|---|---|---|---|
| `/api/governance/overview` | GET | Owner session | No |
| `/api/governance/systems` | GET | Owner session | No |
| `/api/governance/changes` | GET | Owner session | No |
| `/api/governance/changes` | POST | Owner session | Yes |
| `/api/governance/changes/:id` | GET | Owner session | No |
| `/api/governance/changes/:id/reviews` | POST | Trusted reviewer context; human Owner review allowed | Yes |
| `/api/governance/changes/:id/approvals` | POST | Human Owner only | Yes |
| `/api/governance/changes/:id/validation-runs` | POST | Trusted validation runner only | Yes |
| `/api/governance/audit` | GET | Owner session | No |
| `/api/governance/findings` | GET | Owner session | No |

Important qualifications:
- The routes above are proposed contracts, not implemented routes.
- The review endpoint must not accept an arbitrary `reviewer_type="ai"` from a browser.
- The validation endpoint must not accept a browser's self-assertion that tests passed.
- Human approval must be recorded separately from AI review.
- All review, approval and validation records must reference the same implementation commit.
- A changed commit invalidates previous gates.
- Governance access should initially remain Owner-only until a separate scoped permission system is reviewed.

## 7. D1 write consistency requirements

The proposed design requires a state transition and its audit event to be persisted together where feasible.

Before relying on this:
1. Test D1 `batch()` atomicity for the exact statement pattern.
2. Test conditional updates using `WHERE id=? AND state_version=?`.
3. Verify the affected-row metadata and treat zero changes as a concurrency conflict.
4. Verify foreign-key enforcement in the target Preview binding.
5. Verify append-only audit triggers in Cloudflare D1, not only local SQLite.
6. Test rollback behavior when any statement in a batch fails.

Do not assume local SQLite prototype success proves Cloudflare D1 behavior.

## 8. Existing application compatibility constraints

The API catch-all currently serves authentication, registration, presence, profile, Builder and Admin functions. The new dispatcher must be isolated so that:
- public authentication and registration continue to work;
- profile read/write and avatar routes remain unchanged;
- Builder route behavior remains unchanged;
- Owner/Admin management remains unchanged;
- unknown Governance methods return a controlled 404/405;
- a Governance storage/API failure does not break public website rendering or authentication;
- no Governance route writes to unrelated application tables.

The existing `getSession` function returns a small user object; this is sufficient for initial Owner-only human access. It does not establish a governance assignment or a trusted AI identity.

## 9. Implementation phases recommended

### API Phase A — Read-only shell (after D1 baseline is safe)

- Add an isolated Governance dispatcher.
- Add explicit method/path matching.
- Require Owner session on every route.
- Add read-only health/overview and systems endpoints only after DUGA tables or a clearly defined read-only Git registry source are available.
- Add no AI service authentication and no mutation routes yet.
- Test route isolation and existing API regression.

### API Phase B — Human proposal workflow

Only after the migration is approved and applied to Preview:
- create proposal endpoint;
- read proposal and list endpoints;
- strict state machine;
- state_version conflict checks;
- audit event writes in tested D1 batches;
- append-only trigger tests.

### API Phase C — Review, approval and validation

- independent AI audit identity mechanism;
- implementer/reviewer separation;
- human Owner approval;
- trusted validation runner identity;
- commit SHA consistency and stale-gate invalidation;
- full audit export and integrity review.

### API Phase D — scoped roles and Control Center

Only after the Owner-only workflow is secure:
- scoped System Owner authorization;
- governance manager permissions;
- observer access;
- separate Control Center UI;
- no change to the existing website Admin role model without a separate design review.

## 10. Go / No-Go

| Area | Result |
|---|---|
| Existing session authentication source identified | PASS |
| Existing server-side Owner check pattern identified | PASS |
| Global same-origin mutation guard identified | PASS |
| Dedicated Governance routes exist | NO |
| DUGA operational tables exist in Preview | NO evidence; not present in supplied inventory |
| Preview migration history verified | NO |
| Trusted AI service identity exists | NO |
| D1 atomic batch behavior verified for DUGA | NO |
| Full schema equivalence certified | NO |

**Decision: NO-GO for DUGA write endpoints or migration rollout.**

Allowed next work:
- static code review;
- route contract and validation design;
- isolated test harnesses;
- disposable-database tests;
- documentation and security test planning.

No database, Production environment, `main` branch, or existing runtime code was modified during this audit.

## 11. Safe local schema test harness — 2026-11-25

Added `scripts/test-duga-schema.py`, a standard-library-only smoke test that creates an in-memory SQLite database, creates a minimal `users` parent table, and executes the DUGA schema draft. It checks role/subject constraints, scope restrictions, duplicate active Platform Owner prevention, append-only audit triggers, user deletion restriction and malformed JSON rejection.

Run from the repository root:

```bash
python scripts/test-duga-schema.py
```

This is a local test harness only. It neither connects to Cloudflare nor changes Preview/Production. The harness is intended as an early regression check before a separate disposable D1 test is designed and approved.


## 12. Security/lifecycle design follow-up — 2026-11-25

Added `docs/DUGA-API-SECURITY-AND-LIFECYCLE-DESIGN.md` as a proposed contract, not runtime implementation. It consolidates the initial Owner-session-only trust boundary, future scoped assignment checks, AI/validation service identity boundary, risk/approval gates, commit-bound evidence staleness, guarded implementation-SHA updates, transition-service algorithm, and required security/regression tests.

The document includes an explicit candidate old-state → new-state matrix. This matrix is not yet approved policy. The Owner selected resumable `blocked` handling (option B). The design now requires an immutable block event recording the prior state, an authorized unblock operation with rationale and proof the condition cleared, fresh CAS/audit, and re-evaluation of all gates before resumption. Owner has now decided that `rejected` and `cancelled` are terminal: any renewed attempt must be a new Change Request linked to the original, with independent evidence/approvals and preserved original history. The Owner approved the lifecycle policy on 2026-11-25. A consistency review against DUGA-SPEC, the D1 schema design and role definitions closed missing block-entry edges from `proposed` and `awaiting_human_approval`. The matrix specifies impact/analysis rework, audit-to-impact rework, human-approval-to-impact rework, validation-to-implementation retry, final-review-to-implementation correction, and resumable blocking. AI audit may request rework but cannot issue terminal rejection. Rework requires rationale, CAS + audit, preserved history and re-evaluation/invalidation of affected evidence. This is design approval only; independent technical review and all other no-go conditions remain before implementation. No write endpoint should be implemented until they are cleared.

The existing NO-GO decision for Preview write endpoints remains unchanged. No API, migration, Preview binding, Production resource or runtime code was changed.
