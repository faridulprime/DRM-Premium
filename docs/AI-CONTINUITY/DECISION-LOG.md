# DRM Premium — Decision Log

## DUGA-ADR-001 — Initial governance architecture
Date: 2026-11-24
Status: Accepted by project owner in conversation

Decisions:
- Initial scope: Foundation.
- Governance storage: Hybrid.
- Code change approval: Review.
- Control Center: Separate application.
- System Boss model: Human–AI shared responsibilities with human accountability.
- Deep Cleaner: Evidence-first.

Consequences:
- GitHub is authoritative for desired-state governance definitions and policy.
- D1 is authoritative for operational records and state transitions.
- Human approval is mandatory; AI auditor is independent from the implementer.
- DACE starts analysis-only and cannot permanently delete code in Foundation.
- Control Center is not a public website runtime dependency.

## DUGA-ADR-002 — Repository implementation boundary
Date: 2026-11-25
Status: Implemented as documentation/registry foundation

Decision:
- Initial repository work is limited to Phase 0–2: baseline audit, specification, Git registry, ownership definitions, dependency baseline and policy.
- No D1 migration, API, authentication integration or Control Center UI is included in this phase.
- Human identities are not assigned until explicitly confirmed.


## DUGA-ADR-003 — Conservative change-request lifecycle enforcement defaults
Date: 2026-11-25
Status: Proposed in implementation design; not yet encoded in SQL or API

Recommended defaults:
- `accepted`, `rejected` and `cancelled` are permanently terminal; corrections use a linked successor request.
- `blocked` can resume only to an explicitly recorded eligible prior state, with reason resolution, fresh authorization and revalidation.
- Every request entering implementation requires an independent AI audit and human approval in Foundation.
- Requester/approver separation and implementer/AI-auditor separation are required.
- Approval and review records remain immutable; a changed implementation attempt requires distinct commit/evidence history.
- The database enforces lifecycle shape and optimistic version increments; the trusted API enforces authenticated actor identity, scope, evidence provenance and atomic state/audit persistence.

Rationale:
- Prevent silent gate bypass and preserve immutable decision history.
- Avoid treating database-trigger labels as proof of authenticated actor identity.
- Keep database invariants separate from application authorization and trusted evidence verification.

Consequences:
- These defaults are documented in `docs/DUGA-CHANGE-REQUEST-ENFORCEMENT-DESIGN.md`.
- They remain proposed pending workflow reconciliation and owner/security review.
- No migration, D1 operation, write API or deployment is authorized by this ADR.
