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

## Governance metadata validation\nRun `node scripts/validate-governance.mjs` from the repository root after changing the system registry, ownership roles or dependency baseline. This is a static repository check only; it does not validate D1, API authorization, browser behavior or deployment.\n\n## Access limitations
These documents do not grant GitHub, Cloudflare, database or other service permissions. A new AI account needs access granted independently by the project owner.

## Verified repository work — 2026-11-25
- Added `scripts/validate-governance.mjs` to check governance JSON parsing, unique system/role IDs, role references, dependency references, page assets and declared source paths.
- Added `.github/workflows/duga-governance.yml` to run that validator on relevant pull requests, pushes to `main` or `feature/full-admin-panel`, and manual dispatch.
- The workflow file and validator are present on `feature/full-admin-panel`. GitHub has not yet reported a workflow run or status for the latest commit at the time of this note; do not describe CI as passing.
- This work is repository-only. It does not apply migrations, access D1, deploy Pages, or implement the proposed governance API.
- Next safe step: run/inspect the CI result, then prepare a separately reviewed D1 migration only after reconciling the actual Preview migration history and backup. Keep Production untouched.
