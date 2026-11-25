# DUGA Trusted Git Provenance and Validation Service Identity

**Status:** design contract only. No credentials, webhook endpoint, worker API, D1 migration, or deployment is implemented by this document.

## 1. Security objective

A DUGA validation result is trustworthy only when the system can establish all of the following independently:

1. Which repository and immutable Git commit were evaluated.
2. Which protected branch or approved change request authorized that commit.
3. Which workflow run, attempt, workflow definition and validator version produced the result.
4. Which authenticated service identity submitted the result.
5. That the submitted result is bound to the exact commit and execution evidence, rather than a caller-supplied claim.

A commit SHA stored in a row is an identifier, not proof that the commit was checked out or tested. A string in `validator`, `actor_system_id`, or `lease_owner` is also not authentication.

## 2. Canonical repository and Git evidence

The service must be configured with an allowlisted canonical repository identity (immutable GitHub repository ID, plus owner/name for display). Never accept an arbitrary repository URL or repository name from a job payload as the trust root.

For every proposed change and validation run, retain and verify:

- Canonical repository ID.
- Full commit object ID (accept the repository's actual Git object hash format; do not truncate or abbreviate it).
- Full source ref and expected base ref.
- Pull request number and head/base commit IDs when the change is PR-backed.
- Workflow run ID and run attempt.
- Workflow file path and the workflow revision/ref that executed.
- Validator/tool version and immutable artifact or container digest where applicable.
- Result artifact digest and the time the evidence was obtained.

The verifier must retrieve evidence from the Git provider using server-held credentials and compare the provider response with the approved change request. Caller-provided JSON is input to verify, never authoritative evidence.

## 3. Required verification sequence

1. Resolve the requested commit through the configured repository ID; reject unknown repositories and missing commit objects.
2. Resolve the exact source ref and pull request context. Confirm the head commit is the requested commit and the base ref is an allowed protected target.
3. Confirm the commit is reachable from the expected PR head/ref. Do not infer ancestry from branch names or timestamps.
4. Retrieve workflow run metadata from the provider. Require repository ID, head SHA, event, workflow path, run ID, run attempt and conclusion to match policy.
5. Verify the workflow definition is from the approved revision and the required workflow identity. A green status badge or caller-supplied `conclusion=success` is insufficient.
6. Verify validator identity/version and bind the result to the exact commit SHA, run ID/attempt and artifact digest.
7. Only then create an immutable validation evidence record. A retry is a new evidence record or run attempt; never overwrite a previous result.
8. Before an approval or final acceptance transition, re-check that the validated commit is still the exact implementation commit being accepted and that required evidence has not been superseded or revoked.

If any required provider evidence is unavailable, ambiguous, mismatched or unverifiable, the validation state must remain non-passing (for example, queued/failed/blocked according to the state machine). Never convert missing evidence into PASS.

## 4. Authenticated service identity

Use a dedicated least-privilege service principal for validation submission. Prefer short-lived GitHub Actions OIDC credentials exchanged by a trusted backend for a narrowly scoped service token. Do not embed a long-lived shared secret in repository files, workflow YAML, client-side code, job input, or D1 rows.

The backend must validate issuer, audience, subject, repository ID, workflow identity, ref/environment claims, token expiry and replay protection. Bind authorization to the exact expected repository and workflow. A valid token from an unrelated workflow or repository must not authorize a result.

The D1 `actor_system_id` / `validator` values are audit labels only. They must be derived from the authenticated token/session after verification, never copied from request JSON. Rotate/revoke credentials and record identity changes. Separate identities for job dispatch, validation execution and independent audit where practical.

## 5. Worker and lease binding

A worker claim is not proof of Git provenance. The worker must:

- Claim a job through one atomic conditional database operation and retain the returned lease token/generation privately.
- Fetch the job from the canonical repository context; validate the requested commit and policy before execution.
- Check out the full immutable commit ID, not a moving branch name.
- Include job ID, lease generation, commit ID, workflow run ID/attempt and result digest in the signed/authenticated completion request.
- Complete only when the database update matches job ID, running status, lease token, generation and an unexpired lease.
- Treat zero changed rows as stale-worker rejection; never retry completion without re-reading and re-validating ownership.

A valid service token must not bypass fencing. A valid lease must not bypass Git/workflow provenance verification.

## 6. D1 evidence contract

The current schema draft has `duga_validation_runs.commit_sha`, `validator`, `validator_version` and `results_json`; audit rows have actor labels and optional `policy_commit_sha`. These fields alone do not persist the complete evidence chain above.

Before adding columns or migrations, review the minimum normalized evidence model. Candidate evidence fields include canonical repository ID, source/base refs, PR number, workflow run ID/attempt, workflow path/revision, validator image/tool digest, result artifact digest, authenticated service principal ID and provider-verification timestamp. Store structured evidence with strict server-side validation; do not store bearer tokens or private credentials.

The validation insert/transition API must atomically bind the verified evidence to the change request's approved commit and policy revision. The database trigger-generated `duga-db-trigger` audit actor remains a database event label, not proof of the external runner.

## 7. Threat cases that must be tested

- Caller forges a successful conclusion or validator name in JSON.
- Correct SHA supplied with the wrong repository ID.
- Correct repository but wrong PR head or base branch.
- Workflow run belongs to a different commit, repository, event, workflow file or run attempt.
- Workflow was executed from an unapproved workflow revision.
- Expired, wrong-audience, wrong-subject or replayed OIDC token.
- Result artifact digest does not match the retrieved artifact.
- Worker has a valid lease but checks out a different commit.
- Old worker submits after lease expiry/reclaim.
- Validation result is for a prior implementation commit or policy revision.
- Provider API is unavailable or returns incomplete evidence.

Every case must fail closed and leave an auditable rejection record without storing secrets.

## 8. Acceptance gates before runtime implementation

- Independent security review of the trust model and threat cases.
- Confirm Git provider and Cloudflare deployment architecture, secrets handling and OIDC support.
- Implement server-side provider verification and token validation; never trust browser/client claims.
- Add schema changes only after evidence model review and migration-history/backup preflight.
- Add mocked negative tests plus provider integration tests and concurrent worker tests.
- Verify the implementation on disposable D1 and Preview runtime before any shared migration.
- Keep Production untouched until a separately approved release plan.

## 9. Current limitations

This document is a design contract, not an implemented control. No trusted Git verifier, OIDC exchange, service credential, validation worker API, D1 evidence migration, Preview runtime test or Production deployment is established by this work.
