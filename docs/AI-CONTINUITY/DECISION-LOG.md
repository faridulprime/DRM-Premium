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
