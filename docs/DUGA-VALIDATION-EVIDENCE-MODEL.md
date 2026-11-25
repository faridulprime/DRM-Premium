# DUGA Validation Evidence Model and Threat Acceptance Matrix

**Status:** design contract only. No API, credential exchange, worker, schema migration, D1 write, or deployment is implemented here.

## 1. Purpose and trust boundary

This document converts `DUGA-TRUSTED-PROVENANCE.md` into a field-level evidence contract and testable rejection matrix.

The trust boundary is the server-side verifier. Browser input, worker payloads, D1 audit labels, Git branch names, workflow badges, and caller-provided success claims are not trust roots. A validation result is acceptable only when the verifier independently obtains and binds the relevant provider evidence to the exact change request, commit, workflow execution, validator, and authenticated service principal.

**Fail-closed rule:** missing, ambiguous, stale, unverifiable, or mismatched evidence must never produce PASS or an approval-eligible result.

## 2. Evidence provenance matrix

| Evidence item | Authoritative source | Caller may submit | Server must verify / derive | Persistence requirement |
|---|---|---|---|---|
| Canonical repository ID | Server-side allowlist plus Git provider repository metadata | Optional repository hint only | Resolve immutable provider repository ID; require allowlisted ID | Persist immutable numeric/string provider ID |
| Repository display name | Git provider metadata | No | Derive from canonical repository ID | Display/audit metadata only; never use as trust key |
| Commit object ID | Git provider commit object | Full SHA as lookup request | Resolve within canonical repository; require full object ID and object existence | Persist full immutable object ID |
| Source ref | Approved change request plus provider ref/PR metadata | Ref name as a hint | Verify ref belongs to canonical repository and resolves to expected commit | Persist exact ref and observation time |
| Base ref | Protected-branch policy plus provider PR metadata | No authoritative value | Verify allowed protected target and exact PR base SHA | Persist base ref and base commit ID |
| Pull request identity | Git provider PR metadata | PR number as lookup hint | Verify repository ID, PR number, head repo, head SHA, base repo/ref/SHA and open/allowed state under policy | Persist PR number and verified head/base IDs |
| Workflow run ID and attempt | Git provider Actions API | Run ID as lookup hint | Retrieve run; verify repository ID, event, head SHA, attempt, conclusion and timestamps | Persist run ID, attempt, conclusion and verification time |
| Workflow definition path | Git provider workflow metadata / run metadata | No | Require allowlisted workflow path | Persist exact path |
| Workflow definition revision | Provider run metadata and immutable Git content at the executed revision | No | Verify workflow content/revision is approved; reject mutable or unapproved definition | Persist full workflow revision SHA and policy decision |
| Validator version | Server-maintained validator release policy | Claimed version may be diagnostic only | Derive from trusted workflow/artifact metadata; require allowlisted version | Persist version and immutable tool/container digest |
| Validator/tool digest | Trusted build provenance or artifact metadata | Digest may be a lookup hint only | Verify digest against trusted provider/build evidence | Persist immutable digest |
| Result artifact | Git provider artifact metadata and downloaded bytes | Artifact ID as lookup hint | Download via server-held provider access; hash bytes; compare expected digest and run association | Persist artifact ID, digest, size and verification time; avoid unnecessary raw artifact retention |
| Service principal | Verified OIDC token or trusted server-side credential exchange | No identity claim is authoritative | Validate issuer, audience, subject, repository/workflow/ref/environment claims, expiry, nonce/replay and policy mapping | Persist server-derived principal ID and token key/issuer metadata, never bearer token |
| Lease ownership | D1 atomic claim result | Job ID only; never caller-selected token/generation | Bind authenticated worker to job ID, lease token, generation and expiry | Persist lease token securely according to runtime design; persist generation and claim audit |
| Validation outcome | Server-side validator execution and verified result artifact | Claimed PASS/FAIL is untrusted | Derive outcome from verified execution result; reject contradictory or incomplete evidence | Persist immutable result/evidence record and digest |
| Verification timestamp | Server clock | No | Generate server-side after provider verification | Persist UTC timestamp and verifier version |

### 2.1 Required binding keys

A completed validation evidence record must be cryptographically and relationally bound to at least:

- canonical repository ID;
- change-request ID and approved policy revision;
- full commit object ID;
- source ref and verified base ref/commit;
- PR identity and head/base commit IDs when PR-backed;
- workflow run ID and run attempt;
- workflow path and immutable workflow revision;
- validator version and tool/container digest;
- result artifact digest;
- authenticated service principal ID;
- job ID and lease generation where a DUGA job was used;
- server verification timestamp and verifier implementation version.

A retry or rerun is a new attempt/evidence record. Do not overwrite prior evidence or mutate a historical PASS into a different result. Supersession must be represented explicitly and auditable.

## 3. OIDC and service identity acceptance contract

The backend, not the worker request body, determines the service principal. Before authorizing a validation write, it must verify:

1. Signature against the issuer's published keys and supported algorithm policy.
2. Exact issuer and audience.
3. Subject mapped to the expected repository, workflow and ref/environment context.
4. Repository identity equals the configured canonical repository ID.
5. Workflow identity and immutable workflow revision satisfy allowlist policy.
6. Token is within its validity window, with bounded clock skew.
7. Replay protection is enforced using a unique token identifier or equivalent one-time exchange state.
8. Token is scoped to the intended operation and short-lived.
9. The authenticated identity is authorized for this specific job, commit, run attempt and lease generation.

Do not assume a particular Cloudflare OIDC exchange mechanism until the actual deployment architecture and supported token flow are confirmed. Do not place long-lived secrets in workflow files, client bundles, job JSON, or D1 evidence rows.

## 4. Threat acceptance matrix

| Threat / test fixture | Required rejection condition | Required durable evidence |
|---|---|---|
| Caller submits `conclusion=success` without provider run | No independently verified successful run exists | Rejection reason, request correlation ID, server verifier identity/time |
| Correct SHA from wrong repository | Canonical repository ID mismatch | Expected and observed repository IDs |
| PR head differs from requested commit | PR head SHA mismatch | PR number and observed head/base IDs |
| PR targets unapproved base branch | Base ref or base SHA violates protected-target policy | Observed base ref/SHA and policy rule |
| Workflow run belongs to another commit | Run head SHA mismatch | Run ID/attempt and observed head SHA |
| Workflow run belongs to another repository | Run repository ID mismatch | Run ID/attempt and observed repository ID |
| Workflow event is disallowed | Event type outside policy | Observed event and policy decision |
| Workflow path is not allowlisted | Workflow identity mismatch | Observed workflow path |
| Workflow revision is unapproved | Executed workflow revision differs from approved immutable revision | Observed revision and approved revision |
| Rerun attempt is stale or substituted | Run attempt does not match the requested evidence attempt | Expected and observed attempt |
| Artifact digest is forged | Server-computed digest differs from expected trusted digest | Artifact ID, computed digest, expected digest |
| Artifact is missing/unavailable | Evidence cannot be verified | Provider error class and blocked outcome; do not store secrets |
| OIDC token has wrong issuer/audience/subject | Claim validation fails | Rejection category and safe claim identifiers |
| OIDC token expired or not-yet-valid | Time validation fails | Token timing metadata and server time |
| OIDC token replayed | One-time identifier/exchange state already consumed | Replay detection event ID |
| Valid token from unrelated workflow/repository | Identity-to-policy mapping fails | Authenticated principal ID and rejected resource binding |
| Worker checks out a different commit | Checked-out object ID differs from approved full SHA | Expected/observed SHA and job ID |
| Worker has stale lease after reclaim | Token/generation/expiry conditional update affects zero rows | Stale-worker rejection with job ID and generation; no result publication |
| Worker reuses prior run result for a new attempt | Run attempt/artifact digest binding mismatch | Both attempt identifiers and evidence IDs |
| Policy revision changed after validation | Evidence policy SHA differs from currently required approved policy | Validated and required policy SHAs |
| Provider API unavailable or partial | Required evidence cannot be retrieved completely | Provider failure category, retryability and blocked status |
| D1 write partially fails | No success response unless the evidence and state transition commit atomically | Transaction outcome/correlation ID |
| Audit actor is supplied by caller | Caller actor label is ignored; server derives principal | Derived principal and rejected caller-field indicator |

**Acceptance rule:** each row requires a negative automated test. Tests must assert both the rejected state transition and absence of a PASS/approval-eligible evidence row. Where safe, also assert a durable rejection/audit event. Never log bearer tokens, private keys, session cookies, or raw secret material.

## 5. State and persistence semantics

- A validation run begins queued and follows only the schema-defined legal transitions.
- Provider verification and authenticated identity checks must complete before a successful terminal transition is allowed.
- The evidence record and corresponding state transition must be committed atomically by the server-side API.
- A failed verification is not a successful validation. Distinguish blocked/unverifiable from validator-reported failure if the eventual state model supports it; do not overload PASS.
- Historical evidence is append-only. A new attempt creates a new record; supersession is an explicit relationship/event.
- The database trigger actor label `duga-db-trigger` records a database transition, not the identity of the runner or verifier.
- State-version compare-and-swap is required for change-request/finding transitions; lease-token/generation fencing is required for job completion.
- Rejection events must be bounded and privacy-safe. Store stable reason codes and minimal identifiers, not raw tokens or unnecessary provider payloads.

## 6. API boundary requirements

No validation write route is authorized by this design document. When an implementation is separately approved, its contract must:

1. Require authenticated service identity before parsing caller-supplied identity claims as anything other than untrusted hints.
2. Load the target job/change request and expected commit/policy from server-side state.
3. Verify repository, PR, workflow, artifact and validator evidence through provider APIs using server-held credentials.
4. Bind the request to the currently valid lease token/generation and expected state version.
5. Derive actor/principal identifiers server-side.
6. Perform one conditional state/evidence write; check the database's actual changed-row result.
7. Return success only after durable commit; reject stale or zero-row updates.
8. Rate-limit and bound payload sizes; redact secrets and sensitive provider response data from logs.
9. Keep read-only governance endpoints separate from privileged evidence-submission routes.
10. Provide negative tests for every threat row above and integration tests against the actual provider/runtime.

## 7. D1 schema implications — not migration instructions

The current schema draft does not persist the complete evidence chain. The candidate fields in section 2 are a logical model, not a directive to add all values as columns. Before any migration:

- choose normalized evidence tables versus a strictly validated immutable JSON envelope plus indexed lookup columns;
- define uniqueness for repository/run/attempt/artifact/evidence identities;
- define foreign keys and retention policy;
- define how evidence supersession and revocation are represented;
- define transaction boundaries between evidence insert, run transition and audit event;
- reconcile actual Preview D1 migration history and verify a recoverable backup.

No migration should be authored/applied against shared Preview until the migration ledger and backup are independently verified. Production remains out of scope.

## 8. Verification plan and release gates

### Design review
- Independent security review of trust roots, OIDC claims, workflow immutability, artifact provenance, replay prevention and failure semantics.
- Confirm GitHub repository/workflow policy and actual Cloudflare Pages/Workers architecture.
- Decide validator packaging and reproducible/attested build strategy.

### Automated tests
- Unit tests for claim validation, repository/PR/run matching, artifact hashing, policy revision checks and safe rejection logging.
- Table-driven negative tests for every row in section 4.
- API tests for unauthorized, wrong-principal, wrong-lease, stale-attempt and zero-row CAS paths.
- Concurrency tests proving only one worker can claim/complete a generation.
- Tests proving no failed/blocked verification can create PASS or approval-eligible state.

### Environment acceptance
1. In-memory SQLite tests validate SQL-level invariants only.
2. Disposable D1 tests validate D1 SQL compatibility and transactional behavior.
3. Preview D1 tests require a verified migration-history inventory and backup/recovery plan first.
4. Preview runtime tests validate real OIDC/provider/API integration.
5. Production requires a separate explicit release authorization and rollback plan.

## 9. Current status

This is a design and acceptance document only. No OIDC token flow, provider verifier, evidence API, worker, evidence migration, Preview D1 test, Cloudflare runtime test, or Production deployment has been implemented. The existing successful GitHub Actions run validates repository tests and static checks, not this future runtime trust chain.
