# DRM Premium — Next Tasks
Last updated: 2026-11-25
Target application branch: `feature/full-admin-panel`
Separate DUGA review branch: `duga-foundation-review`
DUGA Draft PR: https://github.com/faridulprime/DRM-Premium/pull/4

## Application: Universal Design Systems

1. DUSS v0.8 static smoke run #20 and browser audit run #11 passed. Five-page/seven-viewport coverage has zero horizontal overflow and zero visible targets below 44px in the tested states.
2. Native 200% browser zoom has not been tested; the 720px viewport is only a layout-width proxy. Long Bengali/Latin strings and real user-font/zoom settings still need dedicated stress cases.
3. Review SVG/glyph optical alignment using rendered screenshots; do not infer optical equivalence from CSS dimensions.
4. Continue DUSS audit for remaining page-specific buttons, badges, cards/grids, tables, pagination, dialogs, toast and tooltip after mapping all consumers.
5. Expand DUCS contrast checks beyond the four representative pairs and test state pairs, overlays and forced-colors.
6. Expand DUPS beyond current header/drawer stacking assertions to positioned components, stacking contexts, anchors and collision fallbacks.
7. Expand DUME beyond the shared mobile drawer controller to Profile, Live Users modal effects, Site Builder and dialogs; add rapid open/close and resize-during-transition tests.

## Application: API and Website Builder review

1. Inspect the actual Cloudflare edge/WAF/rate-limit rules for unauthenticated `POST /api/presence` and `POST /api/analytics/event`; repository source does not include this account configuration.
2. Measure legitimate 30-second heartbeat and tab-event traffic before selecting endpoint-specific limits; avoid blocking users behind shared NATs.
3. Define privacy-preserving analytics event deduplication and retention/aggregation rules. No analytics cleanup path was found in the inspected Pages catch-all API source.
4. Review the 20 KB `Content-Length` guard in `readBody(req)`; it does not measure actual streamed body bytes when the header is absent or inaccurate.
5. If edge protections are absent or insufficient, design bounded controls and route-level regression tests before changing runtime behavior.
6. Maintain the separation between unpublished Builder JSON (`/api/builder/draft`) and separately persisted live style settings (`/api/builder/style`, legacy `/api/admin/settings`).
7. Add application regression tests for authentication, registration OTP, role management, presence, analytics, profile images and Builder style/draft flows.

## DUGA review track — Draft PR #4

0. Latest feature-branch DUGA CI run #45651462886 passed, including 12 negative-case registry validator regression tests. Registry publication remains blocked on verified Pages build/output settings and asset binding; the inspected 139-path branch tree has no build manifest or Wrangler/Pages config, and Dashboard settings are unavailable through this repository connection.

0. DUGA workflow action upgrade verified: review-branch runs #251/#252 and #254/#255 plus feature-branch run #253 passed; no D1 execution is part of this change.
0. Latest schema-validator work on `feature/full-admin-panel`: commits `d5b5f1a` and `ccf1235` add assignment role/identity/scope and change-request implementer/reviewer-type CHECK anchors; commit `1765d59` adds negative SQLite smoke cases for mismatched implementer and reviewer identities. These changes are in-memory draft checks only. The GitHub connector's workflow-run wrapper only returns PR-triggered runs; combined commit status is empty for the latest feature-branch commits, so push-triggered CI remains unverified. The workflow supports `workflow_dispatch`, but no dispatch action is exposed through the current GitHub connection.
0. Follow-up validator hardening: commit `9a641fb` adds non-empty requester/implementer/AI actor/system actor identity and non-empty source-branch CHECK anchors; commit `7727279` adds three negative SQLite smoke cases for empty implementer and audit actor identifiers. Not yet executed locally or verified by a fresh CI run. The push CI run exposed one remaining omission: the reviewer AI principal's non-empty CHECK anchor was missing; commit `0004746` adds it. The earlier schema-smoke workflow passed all 3 added negative cases, while governance CI remained failing at the structural validator pending a rerun.
1. F-01 resolved in the schema draft: `duga_reviews` rejects UPDATE/DELETE; tests cover reviewer-identity mutation and deletion, and the structural validator requires both triggers. Latest baseline CI at `989e4ef` passed.
2. F-02 implemented in the design-only draft: approvals now snapshot the authorization assignment ID, scope and policy commit; INSERT requires a matching active human assignment and applicable scope; UPDATE/DELETE are blocked. SQLite smoke cases cover valid approval, wrong scope/user, stale policy, revoked assignment and mutation/deletion. Commits: `7c123ac` schema, `0d7bb03` tests, `f382b30` validator, `428d099` design/review docs, `6b06708` FK validator correction. Smoke run #272 passed on `0d7bb03`; governance runs #127/#128 passed on earlier intermediate commits. The final `6b06708` validator correction has not yet been covered by CI. F-03 implemented in the design-only draft: status-specific timestamp CHECK constraints cover queued/running/passed/failed/cancelled, including cancellation before start. Smoke tests cover valid and invalid lifecycle combinations; structural validator requires the CHECK fragments. Commits: `b48d3cb` schema, `d059aae` tests, `60396fb` validator, `f85c0fc` design/review docs. CI status pending at the time of this update. F-04 is resolved in the design-only schema: lease owner/token/generation, guarded transitions, partial unique active-token index and stale-worker regression cases. F-05 is now addressed in the design-only schema with immutable evidence, constrained versioned transitions and trigger-generated audit rows. No worker API or D1 runtime test exists.
1. Obtain independent third-party review of the SQL schema, lifecycle transitions, authorization policy and CAS/audit design.
2. Run full revised-schema acceptance against a fresh disposable D1 after the parent-change-request and AI-review constraints; the older Worker PASS does not cover these later schema additions.
3. Reconcile the actual shared Preview D1 migration history and repository migration sequence, including duplicate `0004` and `0007` prefixes.
4. Verify complete Preview schema/index/trigger inventory and preserve a verified backup/recovery plan.
5. Design/test trusted Git provenance and AI/validation service identity before any service write endpoints.
6. Before publishing the canonical registry, obtain the Pages project build command/output directory, Functions routing behavior and exact asset binding from Cloudflare Dashboard; then implement and test a static-asset or Owner-only read-only publication path.
6. Test the Pages catch-all router/session integration and existing application regressions before proposing DUGA API runtime integration.

## Not authorized / not implemented

- No DUGA migration is applied to shared Preview or Production.
- No DUGA API or Control Center runtime exists.
- No trusted AI service credentials or automatic DACE execution exist.
- No Production deploy, merge, database mutation or Cloudflare binding change is authorized by this task.
- Do not delete suspected dead code; use evidence-first quarantine, tests and explicit approval.

## Preview D1 preflight reference

The read-only diagnostic script is `governance/schemas/d1-preview-preflight.sql`. It contains SELECT/PRAGMA inspection only. Run it in the Cloudflare D1 Console against Preview only; do not execute the DUGA schema draft or a migration. The migration/meta-name query returning no rows does not prove the historical migration ledger is absent.


### F-04 — Fenced job lease design
- Added lease_owner, lease_token, lease_generation to the DUGA job draft. Claim/reclaim increments attempts and generation together; heartbeat retains identity; terminal transitions clear the lease.
- Added a transition guard and unique active-token index; tests cover reclaim, stale-token heartbeat/completion, generation skipping and completion.
- Required runtime semantics: atomic conditional UPDATE for claim/reclaim; every heartbeat/completion must match job ID, running status, token, generation and unexpired lease. A zero-row update means stale worker.
- Cloudflare D1 docs explicitly guarantee D1Database.batch() is transactional; the proposed claim itself should remain one conditional statement, avoiding read-then-write races. Cloudflare documents D1 write results through meta.changes (and empty results for UPDATE in run()); this design therefore avoids assuming UPDATE RETURNING support. No D1 runtime or concurrent-worker test has been run.


### F-05 — Evidence mutability classification
- Reviews, approvals and audit events are immutable. Assignment grant identity is immutable; revocation is one-way with revoker/time. Validation identity is fixed and terminal evidence is immutable. Finding analyzer evidence is immutable; review state is versioned and reviewer-attributed.
- Assignment grant/revoke, validation transitions and finding review changes generate audit rows in the same database statement through triggers. Inserts must start in the correct initial state; assignment and validation evidence cannot be deleted.
- Validation audit actor is the database label duga-db-trigger, not an authenticated runner identity. API trusted-session derivation, CAS enforcement, runner provenance and result authenticity remain open runtime requirements.
- Tests and structural validator extended for the selected rules. This remains in-memory SQLite only; Preview D1 is untouched.
