# DUGA — DRM Universal Governance Architecture
Version: 1.0.0
Status: Foundation design and Git-based registry initialized; operational backend and enforcement are not implemented.

## Purpose
DUGA coordinates system ownership, dependency intelligence, change governance, auditability, recovery and AI continuity across DRM Premium. It does not replace subsystem responsibilities or become a runtime dependency of the public website.

## Architecture decisions
- Control Center: separate application, outside the public website runtime.
- System ownership: human accountability with scoped AI maintainer and independent AI auditor roles.
- Deep Cleaner: evidence-first; initial operation is analysis-only.
- Initial implementation scope: Foundation.
- Governance storage: hybrid. GitHub is authoritative for desired-state definitions and policy; Cloudflare D1 is authoritative for operational state.
- Change approval: independent AI review + Human Owner approval + automated validation.

## Ownership boundaries
- DUME owns motion, timing, easing, animation orchestration and reduced-motion behavior.
- DUSS owns dimensions, typography sizing, spacing, icons and layout geometry.
- DUPS owns positioning modes, containing-block intent, logical offsets, anchors and stacking layers.
- DUCS owns color values, semantic color meaning, themes and color-related accessibility.
- DCP coordinates governance; it does not take ownership of those domains.
- DACP maintains project continuity records.
- DACE produces evidence-based code archaeology and cleanup proposals.

## Hybrid source-of-truth model
### GitHub desired state
Architecture definitions, system registry, ownership policy, dependency declarations, governance policy, schemas, migration source and versioned decision records.

### D1 operational state
Live change requests, role assignments, approval/review events, validation jobs, audit event stream/indexes and analysis findings.

The same field must not have two writable authorities. D1 operational snapshots must identify the Git commit/version from which policy was loaded. GitHub policy changes are applied through reviewed commits; runtime state transitions are recorded in D1.

## Roles and separation of duties
Human roles: Platform Owner, Governance Manager, System Owner, Read-only Observer.
AI roles: AI Maintainer, Independent AI Auditor.
The implementer cannot audit the same change. AI cannot provide final human approval. High-risk/destructive actions require explicit Platform Owner approval. Human identities remain unassigned until explicitly confirmed.

These are DUGA governance roles; they do not silently replace the current application's Owner/Admin/User authorization.

## Change lifecycle
Proposed → Analysis → Impact Review → Independent AI Audit → Human Approval → Feature-branch Implementation → Automated Validation → Final Review → Accepted/Rejected.
Production merge/deployment is separate and requires explicit authorization. Failed required validation blocks acceptance.

## DACE safety model
DACE begins in analysis-only mode. It must distinguish active, compatibility-critical, possibly obsolete, potential dead code and evidence-supported removal candidates. Static absence of references is insufficient proof of non-use. Runtime evidence, dynamic loading, external contracts, CSS/HTML references, API routes and database dependencies must be considered. Quarantine and permanent deletion require human approval; permanent deletion is out of Foundation scope.

## DACP continuity
Repository documents are the project handover source. They must identify verified commit and date, separate implemented from planned work, document known limitations, and contain no credentials or secrets. New ChatGPT accounts still require separately granted repository and infrastructure access.

## Failure isolation
DUGA and the future separate Super Admin Center must not be required for public page rendering or existing content APIs. Governance outage must not take down the website.

## Security requirements
Server-side authorization, least privilege, session revocation, same-origin/CSRF protection where applicable, rate limiting, audit integrity, secrets isolation, explicit high-risk approval and recovery procedures. UI-only permission hiding is not authorization.

## Current implementation status
The Git governance registry, role definitions, ownership boundaries, dependency baseline and policies are being initialized. D1 schema, API enforcement, Control Center UI, automated DACE and runtime validation are not implemented by this foundation commit series.

## Change policy
All implementation remains on feature branches. Production main and Production D1 must remain untouched unless separately and explicitly authorized.


## D1 schema and API design references
- Operational schema design: docs/DUGA-D1-SCHEMA-DESIGN.md.
- Non-executable SQL draft: governance/schemas/d1-operational-schema.sql. Do not execute this file.
- API authorization contract: docs/DUGA-API-AUTHORIZATION-DESIGN.md.
- Proposed migration name after review: migrations/0009_duga_governance_foundation.sql.
