# DRM Premium — Current State
Verified ref: `feature/full-admin-panel`
Verification date: 2026-11-25

## Application branch and safety

- Public website and Admin application work remains on `feature/full-admin-panel`.
- Do not merge, rebase onto `main`, or deploy to Production without explicit authorization.
- Shared Preview and Production D1 remain separate. No D1 writes or migrations were performed in this work.
- The latest repository source audit is `docs/REPOSITORY-AUDIT-2026-11-25.md`.

## DUGA

- Current feature-branch head is being updated on `feature/full-admin-panel`; Production `main` remains untouched.
- DUGA operational SQL remains a design draft, not an applied migration. No D1 database has been read or written in this workstream.
- The change-request lifecycle draft now has:
  - initial INSERT guard: `proposed`, `state_version=1`, no implementer/implementation commit, matching create/update timestamps;
  - explicit transition allow-list and exact +1 state-version increments;
  - immutable request ID, requester, creation time, source branch, base commit and policy commit bindings;
  - terminal-state and physical-delete guards;
  - blocked-state metadata with enumerated reason codes; resume is restricted to `impact_review` or cancellation;
  - write-once implementer identity and implementation commit;
  - append-only database transition audit event attributed to `system / duga-db-trigger` (not authenticated human/service attribution).
- The in-memory SQLite smoke suite and deep structural validator both PASS in GitHub Actions on commit `d0d21d774689417624d75cd255f9f7e2f4485966`: [DUGA Governance run #45672305048](https://github.com/faridulprime/DRM-Premium/actions/runs/45672305048) and [DUGA schema smoke run #45672305053](https://github.com/faridulprime/DRM-Premium/actions/runs/45672305053). The lifecycle matrix tests 29 allowed transitions and rejects 127 unlisted pairs. The further hardening that freezes title/summary/rationale/risk/affected-scope/rollback fields after creation passed both GitHub Actions workflows on `28cbb5fa41da702f1e32258520084561476e2e59` (runs #45672777605 and #45672777617). Additional tests prove stale expected versions update zero rows, failed audit inserts roll back the transition, and validation cannot begin without a non-empty implementation commit. Structural-validator assertions passed on `223d81f3d8543616a6a21e2185416b8695af2bd1` (run #45672833627).
- Current schema limitation: there is no implementation-attempt history table. A changed implementation commit cannot be recorded as a retry; a new commit needs a successor request until a separately reviewed attempt model is added. Same-commit revalidation is the only safe retry interpretation.
- API work remains outstanding: authenticated actor derivation, scoped role/assignment checks, evidence/provenance verification, compare-and-swap, and an actor-attributed audit insert in the same D1 batch. The trigger event is only a database fact and cannot identify the authenticated actor.
- Revised-schema disposable D1 acceptance, independent security review, Preview migration-history reconciliation and backup/recovery checks remain outstanding. Shared Preview migration and DUGA write endpoints remain NO-GO.
- No migration was created/executed; no Preview or Production deployment occurred.

## Existing subsystem status

- DUME 0.2.0: shared mobile drawer controller integrated on Homepage, Admin, Live Users and Upload Studio. Browser checks for normal/reduced-motion drawer lifecycle, cleanup and 760/761px behavior pass on those pages. Broader motion families and Profile drawer remain uncentralized.
- DUSS 0.8.0: 20 audited icon/slot tokens and 20 mapped consumers, plus 44px interactive-target module on five pages. Static smoke run #20 and browser audit run #11 pass. Browser suite reported zero visible interactive targets below 44px in its 35 tested page/viewport states. Optical alignment, all dynamic controls and broader component coverage remain unfinished.
- DUPS 0.3.0: token foundation and selected shell/overlay migrations. Browser audit verifies computed page-header layers and mobile drawer/sidebar/backdrop stacking on four drawer pages. General positioning, anchor collision/fallback and complete stacking-context coverage remain pending.
- DUCS 0.3.1: token foundation and partial first-pass component migration. Browser audit validates four representative semantic contrast pairs; full token-pair/state contrast audit, residual literal review, light/high-contrast themes and forced-colors remain pending.

## Application code audit findings

- Website Builder JSON document changes are draft-only; `/api/builder/state` reports `publishEnabled: false`. Separate `Save website style` and legacy visual-editor actions write `settings.visual_editor_config`, which the homepage reads and applies. Confirmation prompts and clearer UI text were added so these live-style writes are not confused with the JSON draft.
- Public `POST /api/presence` and `POST /api/analytics/event` routes write to D1 without login. A signed-in heartbeat executes four D1 statements; a guest heartbeat executes two; frontend heartbeats run every 30 seconds. Analytics inserts one row per accepted event without route-local per-IP metering or deduplication. The global Origin check is a CSRF/origin gate, not a rate limit. The API checks declared Content-Length (20 KB) but does not measure streamed body bytes. Registration OTP has separate per-IP/per-email controls, not shared by these routes. No Cloudflare edge/WAF configuration was inspected and no analytics-retention path was found in the catch-all API source; therefore this is an unverified resource-abuse risk, not a confirmed exploit. Full detail: `docs/PUBLIC-API-RESOURCE-ABUSE-REVIEW.md`.
- No governance runtime service is required to render the public website.

## Validation status

- DUSS static source validation run #20 passed on `c423ea1fe0e35459d279f40bf444afa69fcd4c53`: [run #20](https://github.com/faridulprime/DRM-Premium/actions/runs/45620765851). It checks the 20 icon/slot tokens and consumers, v0.8 header/marker, 44px target token, touch-target module wiring, five page cache keys, and CSS brace balance.
- Browser audit run #11 passed on the same commit: [run #11](https://github.com/faridulprime/DRM-Premium/actions/runs/45620765803). It covers 35 page/viewport states on five pages, reports zero horizontal overflow and zero undersized visible targets, and validates representative DUSS/DUPS/DUCS/DUME behaviors.
- Native browser zoom, complete Bengali/Latin long-content stress cases, optical glyph alignment, full DUCS contrast matrix, every DUPS stacking/anchor context and all DUME animation families remain unverified.
- These tests run against the checked-out static site. They do not establish Pages Functions, D1, live authentication, Cloudflare edge security, deployed Preview or Production behavior.

## Next direction

1. Expand DUCS contrast validation from the four representative pairs to all meaningful semantic foreground/background pairs and interaction states; keep page-scoped palette identity intact.
2. Continue DUPS migration by mapping the remaining positioned elements, anchoring relationships, collision/fallback behavior and stacking contexts before tokenizing further.
3. Continue DUME beyond the shared mobile drawer: Profile drawer, Live Users modal effects, Site Builder and dialog transitions; add resize-during-transition and rapid interaction checks.
4. Continue DUSS component-family audit for remaining buttons, badges, cards, grids, tables, pagination, dialogs, toast and tooltip; review icon optical alignment with rendered evidence.
5. Inspect Cloudflare edge/WAF rate-limit configuration and measure legitimate heartbeat/event volume before changing public endpoint controls; the Cloudflare account settings are not accessible from this repository connection.
6. Keep DUGA revised-schema disposable D1 acceptance, independent review and Preview migration reconciliation on its separate review track. These database/resource actions require owner approval and remain unperformed.


## DUGA change-request enforcement progress — 2026-11-26

- Implemented draft-only lifecycle guards in `governance/schemas/d1-operational-schema.sql`.
- Added blocked-state metadata and synthetic transition audit.
- Updated `scripts/test-duga-schema.py` with lifecycle adversarial cases and an exhaustive 29-allowed/127-rejected transition matrix; both schema test workflows passed.
- Updated `scripts/validate-duga-schema-structure.py` with new columns, trigger and CHECK-expression expectations.
- Updated the enforcement design and state-machine docs to reflect the actual draft behavior and limitations.
- Added `docs/DUGA-API-WRITE-CONTRACT.md` covering session-derived actors, disabled untrusted AI/runner identities, named commands, CAS, atomic audit coupling, idempotency, concurrency, HTTP semantics and disposable-D1 acceptance gates. No write endpoint was added.
- Hardened `GET /api/governance/health`: it now requires the four `duga_change_requests` lifecycle triggers and both blocked-state metadata columns. Mocked regressions assert missing transition-audit trigger and missing block-reason column return `schema: partial`.
- Complete DUGA Governance CI passed on `2481651798ef60c3793bfeafe81abff1cd9aeec6`: [run #45673718961](https://github.com/faridulprime/DRM-Premium/actions/runs/45673718961). This includes the new health-trigger/blocked-column regressions, in-memory SQLite smoke suite and deep structural validator.
- D1 `batch()` atomicity / `changes()` coupling remain unverified; Governance write APIs and shared Preview/Production migration remain NO-GO.
- Next: complete CI verification, then add exact D1 statement-semantics tests only in an explicitly approved disposable database after its identity, backup and migration history are verified. Do not create migration 0009 or touch shared Preview/Production.
