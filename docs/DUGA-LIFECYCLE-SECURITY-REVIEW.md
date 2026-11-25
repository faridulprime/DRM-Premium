# DUGA Lifecycle and API Security — Internal Consistency Review
Date: 2026-11-25
Review target: duga-foundation-review / PR #4
Review type: Internal source/design consistency review by the assisting model; NOT an independent third-party security review.
Status: Findings below were corrected in the design/schema draft where noted. Runtime/API readiness remains NO-GO.

## Scope inspected
- docs/DUGA-API-SECURITY-AND-LIFECYCLE-DESIGN.md
- docs/DUGA-API-AUTHORIZATION-DESIGN.md
- docs/DUGA-API-INTEGRATION-READINESS.md
- docs/DUGA-SPEC.md
- docs/DUGA-D1-SCHEMA-DESIGN.md
- governance/schemas/d1-operational-schema.sql
- scripts/test-duga-schema.py
- governance/ownership/roles.json
- Relevant continuity records and PR #4 metadata.

## Findings corrected

### 1. Duplicate AI-audit rework edge
The transition matrix listed awaiting_ai_audit → impact_review twice with overlapping descriptions. Consolidated it into one transition requiring audit findings/evidence and a non-empty rationale.

### 2. Lifecycle documentation drift
The architecture spec and D1 schema design still described blocked as terminal, contradicting the Owner-approved resumable-block decision. Updated both to state:
- accepted, rejected, cancelled are terminal;
- blocked is resumable only through the explicit authorized unblock operation;
- rejected/cancelled retries require a new linked Change Request;
- AI audit can request changes but cannot make a terminal rejection decision.

### 3. Missing predecessor relationship for renewed requests
The policy required a new request to link to its rejected/cancelled predecessor, but the draft schema had no relational field. Added nullable self-referencing parent_change_request_id with ON DELETE RESTRICT, self-link rejection, an index, and a trigger preventing parent-link mutation. Added local SQLite probes for valid linkage, missing parent, self-parent and mutation rejection.

### 4. AI audit could store a rejected decision
The draft review table allowed decision='rejected' for an AI reviewer, despite the policy reserving terminal rejection for a human. Added a SQL CHECK that disallows rejected for AI review rows and a local negative test. API contracts now limit AI review decisions to approved or changes_requested; only an authorized human can reject.

### 5. API contract alignment
Updated proposal creation to accept an optional predecessor reference only when it resolves to an existing terminal rejected/cancelled request. The server must validate and persist the link; it must not copy approvals, reviews, validation or implementation authorization from the predecessor. Updated review contract to enforce AI/human decision separation.

## Review observations — still required before implementation

1. Third-party independent review: this pass is an internal consistency review, not an independent reviewer sign-off. A separate qualified reviewer must inspect the transition matrix, SQL draft, authorization contract and tests.
2. Preview migration history: actual shared Preview migration history has not been inspected/reconciled. Filename ordering is insufficient. Do not create/apply migration 0009 until this is done and reviewed.
3. Cloudflare D1 acceptance: local SQLite tests and the disposable D1 Worker aggregate PASS do not prove the complete revised schema, self-FK/trigger behavior, D1 concurrency, per-statement meta.changes, and rollback behavior for the final schema. Re-run the complete revised schema/transition probes on a fresh disposable D1 database before Preview consideration.
4. Trusted identity: no trusted AI service identity or validation-runner credential exists. AI IDs are attribution only. Do not enable AI review writes or validation writes before separate authentication design and tests.
5. Git provenance: canonical source-ref parsing, protected/default branch checks, PR-base verification, and trusted commit SHA retrieval still need a tested server-side implementation.
6. Application integration: the existing Pages catch-all router/session behavior and Owner-only access need regression tests before any governance endpoint is enabled. No API routes currently exist.
7. Evidence/gate enforcement: commit-bound review/approval/validation staleness, active assignment/scope revocation, reviewer/implementer separation, risk-specific approver authority, and server-derived audit actor must be enforced in the future service, not assumed from SQL enums or client payloads.
8. Block/unblock evidence: the future API must atomically persist block provenance and state transition; unblock must derive prior state from the latest immutable block event and re-evaluate stale gates. No client-supplied resume target is trusted.
9. Terminal-linked request enforcement: SQL provides the relationship and immutable link, but API must enforce that the predecessor is actually terminal as rejected or cancelled at creation time, and prevent inheritance of evidence/authority.
10. Production separation: Production merge/deploy and Production D1 remain separate approvals. Nothing in this review authorizes them.

## Test evidence
- The schema workflow previously passed on commit 9461243b6ee9d8e0af3e5c9f87df71418d485b48, which included the parent-link SQL trigger and local tests.
- A newer PR workflow was observed running for the then-current head; verify its final conclusion before treating that head as CI-passed.
- Local SQLite is not Cloudflare D1. The earlier disposable D1 Worker acceptance predates the parent-link and AI-review schema additions and does not cover them.

## Decision
The Owner-approved lifecycle policy is now internally more consistent across the inspected spec, API design and schema draft. DO NOT implement or enable Preview write endpoints yet. The next gates are third-party independent review, final-head CI, revised-schema disposable D1 acceptance, Preview migration-history reconciliation, and tested trusted identity/Git provenance/application integration.