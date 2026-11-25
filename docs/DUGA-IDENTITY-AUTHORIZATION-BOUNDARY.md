# DUGA Human Session and Service-Principal Authorization Boundary

**Status:** implementation-independent security contract based on the current Pages API. This document does not add a write route, authentication mechanism, migration, credential, or deployment.

## 1. Verified current API behavior

Source inspected: `functions/api/[[path]].js` on `feature/full-admin-panel`.

### Human session
- Session cookie name: `frame_admin_session`.
- Cookie attributes: `Path=/; HttpOnly; Secure; SameSite=Strict`, with a seven-day Max-Age.
- Session token: 32 cryptographically random bytes, base64url encoded.
- Database stores SHA-256 hash of the token, not the raw token.
- Session lookup joins `sessions` to `users`, checks `expires_at > now`, and returns user ID, email, username and current role.
- Password verification uses PBKDF2-HMAC-SHA-256 with 100,000 iterations and per-password random salt.
- Login rate limiting is keyed by a hash of the connecting IP and session secret, with eight attempts per 15-minute window.
- Restricted users are rejected by the common authenticated route path (HTTP 423), except the access-state endpoint.
- All non-GET requests require an Origin header exactly matching the request URL origin and JSON content type.
- The Origin check is performed before route dispatch; absent Origin is rejected for non-GET requests.

### Current authorization boundary
- The common admin API gate accepts roles `owner` and `admin`.
- The DUGA `/api/governance/*` routes then require `owner`; Admin receives 403.
- Governance routes are currently read-only; the supported list/detail/health/overview/audit routes are GET-only.
- The governance health route probes schema presence/critical trigger markers; it does not authorize a database mutation.
- No DUGA write route or AI/service-principal authentication route was found in the inspected API handler.
- The current session identity comes from the server-side session lookup, not a request-body actor field.

These observations describe the inspected source, not a live Pages runtime or deployed environment.

## 2. Non-negotiable identity separation

Future DUGA authorization must distinguish three principal classes:

1. **Human session principal** — authenticated by the existing session cookie and resolved from the database. Actor user ID and role must come from this lookup, never from request JSON, query parameters, headers supplied by the caller, or UI state.
2. **AI automation principal** — a separately provisioned and authenticated non-human identity. It must not be represented by a human user row or accepted merely because the caller submits a principal ID.
3. **Validation/worker service principal** — a machine identity authenticated through a separately verified workload identity (for example, a narrowly scoped OIDC trust relationship). A job lease token is concurrency/fencing evidence, not authentication by itself.

A valid human session does not authenticate a worker. A worker OIDC identity does not confer human approval authority. A job lease does not prove repository provenance or validation success.

## 3. Proposed authorization matrix (subject to product approval)

| Operation | Human session | AI principal | Validation service |
|---|---|---|---|
| View governance data | Owner only, matching current API | No access defined | No access defined |
| Create/submit change request | Potentially permitted by approved policy | Potentially permitted after principal authentication | No |
| Human review/approval/rejection | Explicitly assigned human with matching scope | Never | Never |
| Independent AI audit | Never as AI identity | Authenticated auditor principal, distinct from implementer | Never |
| Claim/heartbeat/complete validation job | No | No, unless separately designated worker identity | Authenticated worker plus current lease token/generation |
| Mark validation passed | No | No | Only after provider evidence verification and fenced completion |
| Final human acceptance | Authorized human per approved policy | Never | Never |
| Grant/revoke assignments | Explicitly authorized human role/scope | Never | Never |

Do not assume Admin gains DUGA permissions from the common admin gate. The current implementation deliberately narrows Governance to Owner. Any change to that rule requires explicit policy approval and tests.

## 4. Session and mutation requirements for a future API

- Reuse the existing server-side session resolution only for human actions; do not duplicate cookie parsing or trust client-supplied roles.
- Re-check current user role and restriction status on every request. Do not cache authorization decisions in browser state.
- For sensitive mutations, consider re-authentication or recent-authentication policy; the current seven-day session lifetime alone is not proof of recent user intent.
- Require same-origin checks for browser mutations, but do not treat Origin as authentication. Machine-to-machine routes need a separate explicit authentication policy, not a weakened browser Origin exception.
- Use narrowly scoped, revocable service credentials and rotation/replay controls if an OIDC provider integration is unavailable. Never place service secrets in client bundles.
- Derive audit actor fields on the server from the verified principal. Reject/ignore caller-supplied actor identity.
- Enforce authorization and compare-and-swap in the same mutation path; do not rely on UI hiding or a preceding read.
- Return 401 for absent/invalid authentication, 403 for authenticated but unauthorized actors, 409 for stale state/version conflicts, and 503 for unavailable identity dependencies. Do not leak credential or policy internals.
- Keep human approvals distinct from machine validation evidence and AI audit evidence.

## 5. Security tests required before any write route

### Human session
- No cookie, malformed token, unknown token, expired session -> 401.
- Valid User session -> cannot access governance.
- Valid Admin session -> governance remains 403 unless policy is explicitly changed.
- Valid Owner session -> current read-only governance routes work.
- Revoked/expired/restricted account -> mutation rejected even if a stale UI still displays controls.
- Request body/header/query spoofing of `user_id`, `role`, `actor_type` or `principal_id` never changes the server-derived actor.
- Missing Origin, foreign Origin and non-JSON browser mutation -> rejected.
- Exact same-origin request still requires valid authentication and action authorization.

### Service identity
- Human cookie alone cannot call worker/validation endpoints.
- Arbitrary principal ID, forged OIDC claims, wrong audience/issuer/subject/repository/workflow/ref, expired token and replay -> rejected.
- Valid worker identity with wrong job type/scope -> rejected.
- Correct worker identity but stale/expired lease token or generation -> rejected.
- Lease holder without verified Git/workflow/artifact evidence cannot create PASS or approval-eligible validation evidence.
- AI audit principal equal to implementer principal -> rejected.

### Audit and concurrency
- Every mutation's audit actor is derived from verified authentication context.
- Failed audit persistence rolls back the state transition.
- Two concurrent requests with same expected state/version -> exactly one succeeds.
- No API reports success when D1 `meta.changes` is zero or the transaction fails.

## 6. Open implementation gates

- Decide exact Owner/Admin/System Owner/Platform Owner powers and separation-of-duties policy.
- Confirm whether the existing human session model needs recent-authentication or re-authentication for approvals.
- Confirm GitHub Actions / Cloudflare workload identity architecture and claims before implementing worker authentication.
- Define service principal registry, scopes, revocation, rotation and replay handling.
- Only then design endpoints and schema changes.
- Do not apply migrations until Preview D1 migration history and a restorable backup/export are verified. Keep Production untouched without separate explicit authorization.

## 7. Scope and limitations

This is a source-level contract, not a penetration test. No live Cloudflare environment was inspected; no cookie/session integration test against deployed Pages was run; no service principal, OIDC verifier, write route, migration, D1 mutation or deployment was created.
