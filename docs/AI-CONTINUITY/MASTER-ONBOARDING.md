# DRM Premium — AI Master Onboarding
Version: 0.1.0
Last verified against: feature/full-admin-panel, 2026-11-25

## Start here
1. Read the root README.md before proposing infrastructure or deployment changes.
2. Read docs/DUGA-SPEC.md and docs/DUGA-REPOSITORY-BASELINE.md.
3. Read governance/registry/systems.json, governance/ownership/ and governance/dependencies/.
4. Read the relevant subsystem specification before editing subsystem code: DUME, DUSS, DUPS or DUCS.
5. Inspect the current branch and fetch fresh file contents before every edit.

## Project facts
DRM Premium is a static Cloudflare Pages site with Pages Functions and Cloudflare D1. The repository currently has an Owner/Admin/User application role model. DUGA governance roles are separate and are not yet wired into application authorization.

## Non-negotiable change safety
- Work on feature/full-admin-panel or a specifically authorized feature branch.
- Do not modify main, merge a PR, or deploy to Production without explicit user authorization.
- Never point Preview at Production D1.
- Fetch fresh file SHA before updating an existing file.
- Keep changes scoped; inspect dependencies before editing.
- Do not claim browser, runtime, or production validation unless actually performed.
- Never commit or request secrets, passwords, API keys or tokens in repository docs or chat.

## System ownership
- DUME: motion and animation.
- DUSS: dimensions, spacing, typography and layout geometry.
- DUPS: positioning, anchors and stacking.
- DUCS: colors and semantic color meaning.
DCP coordinates governance and does not override subsystem ownership.

## Evidence discipline
Separate implemented, partially implemented, planned, unknown and tested states. Treat static source checks as static checks only. Do not infer runtime behavior from token presence or file names.

## Governance metadata validation
Run `node scripts/validate-governance.mjs` from the repository root after changing the system registry, ownership roles or dependency baseline. This is a static repository check only; it does not validate D1, API authorization, browser behavior or deployment.

## D1 migration inventory validation
Run `node scripts/validate-migration-inventory.mjs` after changing `migrations/**`, the migration manifest or the DUGA schema draft. It checks manifest/file coverage, execution order, dependency references, duplicate numeric-prefix documentation and the design-only draft safety header. It never connects to D1 or executes SQL.
## Access limitations
These documents do not grant GitHub, Cloudflare, database or other service permissions. A new AI account needs access granted independently by the project owner.

## Verified repository work — 2026-11-25
- Added `scripts/validate-governance.mjs` to check governance JSON parsing, unique system/role IDs, role references, dependency references, page assets and declared source paths.
- Added `scripts/validate-migration-inventory.mjs` to verify the migration manifest against SQL files, contiguous fresh-database order, dependency ordering, duplicate-prefix notes and the DUGA draft safety header.
- Added an initial `GET /api/governance/health` route in the catch-all API. It requires an authenticated application Owner, performs read-only database/schema probes, and reports whether expected DUGA tables, required columns, named indexes and required triggers are not installed, partial or structurally present; the endpoint documents that this is not a full DDL equivalence check. Added mocked handler-level tests for Owner/Admin/User/anonymous access, method and origin checks, unknown routes, missing D1 binding, probe failures and not-installed/partial/ready schema reporting.
- Tightened the DUGA SQL draft: role assignments require a human assigning user; finding review metadata must be paired; only running jobs may hold a lease; a database trigger blocks AI self-audit; AI principal IDs must be non-empty; affected-system/path fields must be JSON arrays.
- Updated `migrations/manifest.json` so both files in each duplicate numeric prefix (`0004` and `0007`) explicitly document the collision.
- Updated `.github/workflows/duga-governance.yml` to syntax-check the API router and run the mocked health API tests, both static validators and the in-memory SQLite schema regression suite for relevant pull requests and pushes, plus manual dispatch.
- Extended `scripts/test-duga-schema.py` with regression probes for assignment actor requirements, finding review metadata pairing, job lease invariants and implementer/auditor separation. The suite uses only in-memory SQLite.
- GitHub Actions run `45640243820` for commit `b484957649a6b5278bf6e636e08f78305e3ff02a` completed successfully. Governance metadata validation, migration inventory validation and the expanded in-memory SQLite schema regression suite all passed. The separate existing SQLite smoke-test workflow also passed as run `45640243719`.
- This remains repository-only validation. No D1 migration was applied, no Cloudflare Pages deployment was performed, and Production was not modified.
- GitHub Actions run `45641444605` completed successfully. API syntax, mocked Owner-only health endpoint tests, governance metadata, migration inventory and SQLite schema tests all passed. No live Preview Pages/D1 runtime test has been performed.
- Next safe step: reconcile the actual Preview D1 migration history and backup before proposing an executable migration. Do not infer applied state from filenames or the manifest.

- Expanded the Owner health route from table-name detection to read-only structural inspection: required columns via `PRAGMA table_info`, named indexes and required triggers via `sqlite_master`. The response includes missing tables, columns, indexes and triggers. Tests cover a missing required column and complete/partial structures. This still does not prove exact constraints, index definitions, trigger bodies, migration history or data integrity.

- Added `scripts/validate-duga-schema-structure.py` to the governance CI: it validates the DUGA draft's exact table/column inventory, index uniqueness/partial flags, trigger body markers, critical foreign keys and selected CHECK constraints using in-memory SQLite only. The health API inventory now includes the unique single-platform-owner index. CI initially exposed an incomplete mock inventory and a case-sensitive assertion in the new validator; both were corrected. The deep validator's corrected version is awaiting a fresh CI result.
