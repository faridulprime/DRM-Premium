# DRM Premium — Safety and Change Protocol
Version: 0.1.0

## Branch and production
- Target development branch: feature/full-admin-panel.
- Production main is protected by project policy; do not edit or merge without explicit authorization.
- Preview and Production D1 databases must remain isolated.
- Production deployment is a separate action from code acceptance.

## File editing
- Inspect the current file and relevant consumers before editing.
- Fetch fresh content and SHA immediately before updating an existing file.
- For sequential edits to one file, fetch its fresh SHA again.
- Do not overwrite files based only on stale conversation summaries.
- Prefer additive, scoped changes and preserve existing visual behavior unless redesign is requested.

## Approval model
- Proposed → Analysis → Impact Review → Independent AI Audit → Human Approval → Implementation → Automated Validation → Final Review → Accepted/Rejected.
- The implementer cannot be the independent auditor for the same change.
- AI review is not human approval.
- High-risk, destructive, security-sensitive, migration and production-impacting work requires explicit Platform Owner approval.

## Validation claims
- State exactly which checks were run.
- Distinguish syntax/static validation from runtime, browser, accessibility and production validation.
- Never claim a test passed if it was not executed.

## Security
- Never commit secrets or personal credentials.
- Enforce authorization on the server, not only in the UI.
- Preserve least privilege and auditability.
- Do not delete suspected dead code without evidence, quarantine, tests and human approval.

## Recovery
- Record relevant commit SHAs and changed paths.
- Keep rollback/recovery plans for schema and destructive changes.
- Governance services must not become dependencies required to render the public website.
