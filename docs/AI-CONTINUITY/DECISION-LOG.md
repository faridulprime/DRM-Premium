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
Status: Proposed defaults encoded in the feature-branch schema draft; owner/security ratification and API enforcement remain pending

Recommended defaults:
- `accepted`, `rejected` and `cancelled` are permanently terminal; corrections use a linked successor request.
- `blocked` can resume only to `impact_review`, or be cancelled; the prior state and enumerated reason code are retained in audit evidence.
- Every request entering implementation requires an independent AI audit and human approval in Foundation.
- Requester/approver separation and implementer/AI-auditor separation are required.
- Approval and review records remain immutable. The current schema draft makes the first implementation commit write-once; changed-commit retries require a future attempt-history model or a successor request.
- The database draft enforces lifecycle shape, immutable bindings, terminal/delete guards, block metadata and optimistic version increments; the trusted API must enforce authenticated actor identity, scope, evidence provenance, CAS and actor-attributed audit persistence.

Rationale:
- Prevent silent gate bypass and preserve immutable decision history.
- Avoid treating database-trigger labels as proof of authenticated actor identity.
- Keep database invariants separate from application authorization and trusted evidence verification.

Consequences:
- These defaults are documented in `docs/DUGA-CHANGE-REQUEST-ENFORCEMENT-DESIGN.md`.
- The database-draft implementation is present on `feature/full-admin-panel`; GitHub Actions passed both the in-memory SQLite smoke suite and structural validator on commit `d0d21d774689417624d75cd255f9f7e2f4485966` (runs #45672305048 and #45672305053). The smoke suite covers 29 allowed edges and 127 rejected source/target pairs. Proposal content and scope fields are now also frozen after creation; latest CI validation is pending.
- The database-generated audit actor `duga-db-trigger` is synthetic and must not be presented as authenticated user attribution.
- No migration, D1 operation, write API or deployment is authorized by this ADR.
