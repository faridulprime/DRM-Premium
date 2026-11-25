# DRM Premium — Current State
Verified ref: `feature/full-admin-panel`
Verification date: 2026-11-25

## Application branch and safety

- Public website and Admin application work remains on `feature/full-admin-panel`.
- Do not merge, rebase onto `main`, or deploy to Production without explicit authorization.
- Shared Preview and Production D1 remain separate. No D1 writes or migrations were performed in this work.
- The latest repository source audit is `docs/REPOSITORY-AUDIT-2026-11-25.md`.

## DUGA

- Current feature-branch head at this checkpoint: `277f7aaf1752abe0c0ea478289e81c1611d555c1` (new documentation-only commits follow); Production `main` remains untouched.
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

## DUMC — DRM Universal Movie Section — 2026-11-26

- DUMC v1.0.0 taxonomy is committed at `assets/dumc/taxonomy.json`: 12 top-level sections and 226 stable folder nodes.
- Added additive D1 migration `migrations/0009_dumc_movie_library.sql`, plus manifest entry. It seeds all taxonomy nodes, backfills one `dumc_movies` metadata row for each existing video without inferring language/industry/country/year, and creates many-to-many assignments, audio-track references and subtitle references.
- Added authenticated Owner/Admin APIs under `/api/admin/dumc` for folder browsing/custom folder management, movie metadata, multi-folder classification, and audio/subtitle references. New video creation attempts to create its canonical DUMC metadata row when the migration is installed.
- Upload Studio now loads `dumc-manager.js`: live database folder tree when available, static taxonomy fallback otherwise; movie metadata editor; multi-select genres/dubs/subtitles/collections; custom folders; audio/subtitle reference registration; optional folder assignment on video creation.
- Added `scripts/test-dumc-migration.py` and `.github/workflows/dumc-validation.yml` for SQLite migration regression, inventory and JavaScript syntax checks. Source-level syntax checks were performed on the changed API code; the GitHub Actions run has not yet been observed.
- **Not executed:** migration 0009 has not been applied to any D1 database. The manifest is documentation-only and Wrangler migrations remain unconfigured; applied migration history and target database identity are not available through the connected tools. No Preview/Production deployment or live-browser verification was performed.
- Audio/subtitle APIs store an existing `movies/...` asset key or HTTPS source reference only. Actual upload/playback requires a configured movie media bucket and upload pipeline; this is not yet implemented.

## Application code audit findings

- Website Builder JSON document changes are draft-only; `/api/builder/state` reports `publishEnabled: false`. Separate `Save website style` and legacy visual-editor actions write `settings.visual_editor_config`, which the homepage reads and applies. Confirmation prompts and clearer UI text were added so these live-style writes are not confused with the JSON draft.
- Public `POST /api/presence` and `POST /api/analytics/event` routes write to D1 without login. A signed-in heartbeat executes four D1 statements; a guest heartbeat executes two; frontend heartbeats run every 30 seconds. Analytics inserts one row per accepted event without route-local per-IP metering or deduplication. The global Origin check is a CSRF/origin gate, not a rate limit. The shared 20 KB JSON reader now counts actual streamed bytes, including when Content-Length is absent or understated; regression coverage passed in run #45710504527. Registration OTP has separate per-IP/per-email controls, not shared by these routes. Cloudflare edge/WAF configuration remains uninspected and no analytics-retention path was found in the catch-all API source; therefore the remaining resource-abuse exposure is unverified, not a confirmed exploit. Full detail: `docs/PUBLIC-API-RESOURCE-ABUSE-REVIEW.md`.
- No governance runtime service is required to render the public website.

## Validation status

- DUSS static source validation run #20 passed on `c423ea1fe0e35459d279f40bf444afa69fcd4c53`: [run #20](https://github.com/faridulprime/DRM-Premium/actions/runs/45620765851). It checks the 20 icon/slot tokens and consumers, v0.8 header/marker, 44px target token, touch-target module wiring, five page cache keys, and CSS brace balance.
- Browser audit run #11 passed on the same commit: [run #11](https://github.com/faridulprime/DRM-Premium/actions/runs/45620765803). It covers 35 page/viewport states on five pages, reports zero horizontal overflow and zero undersized visible targets, and validates representative DUSS/DUPS/DUCS/DUME behaviors.
- Native browser zoom, complete Bengali/Latin long-content stress cases, optical glyph alignment, full DUCS contrast matrix, every DUPS stacking/anchor context and all DUME animation families remain unverified.
- These tests run against the checked-out static site. They do not establish Pages Functions, D1, live authentication, Cloudflare edge security, deployed Preview or Production behavior.

## Next direction

1. Continue DUCS contrast review: 98 curated source-level pairs and 16 calculation-engine unit tests now pass CI; 93 pairs meet thresholds and five non-text boundaries need rendered-context review. Add only source-backed state pairs and complete forced-colors/browser checks.
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
- Corrected the DUGA API authorization/readiness documents: current feature-branch Owner-only read routes are distinguished from the 2026-11-25 historical baseline, and the four lifecycle health-trigger checks are documented accurately.
- Added `docs/DUGA-API-WRITE-CONTRACT.md` covering session-derived actors, disabled untrusted AI/runner identities, named commands, CAS, atomic audit coupling, idempotency, concurrency, HTTP semantics and disposable-D1 acceptance gates. No write endpoint was added.
- Hardened `GET /api/governance/health`: it now requires the four `duga_change_requests` lifecycle triggers and both blocked-state metadata columns. Mocked regressions independently omit each of the four change-request lifecycle triggers and omit the block-reason column; all return `schema: partial` and passed in [run #45674314833](https://github.com/faridulprime/DRM-Premium/actions/runs/45674314833).
- Complete DUGA Governance CI passed on `2481651798ef60c3793bfeafe81abff1cd9aeec6`: [run #45673718961](https://github.com/faridulprime/DRM-Premium/actions/runs/45673718961). Follow-up documentation CI also passed on `e0a85898697e159afccf38a575099a1d7ea307a4` (run #45673812326) and the then-current head `277f7aaf1752abe0c0ea478289e81c1611d555c1` (run #45673820027).
- D1 `batch()` atomicity / `changes()` coupling remain unverified; Governance write APIs and shared Preview/Production migration remain NO-GO. The earlier health-route gap for change-request lifecycle triggers and blocked-state columns is resolved on the feature branch; see `docs/DUGA-API-WRITE-CONTRACT.md` Section 11 and `docs/DUGA-API-INTEGRATION-READINESS.md` Section 11.
- Next: complete CI verification, then add exact D1 statement-semantics tests only in an explicitly approved disposable database after its identity, backup and migration history are verified. Do not create migration 0009 or touch shared Preview/Production.


## DUCS contrast calculation hardening — 2026-11-25

- Added `scripts/test-ducs-contrast-unit.py` with 16 tests covering HEX/RGB parsing, alpha channels, modern RGB syntax, invalid grammar/ranges, token fallback/nesting/cycles, WCAG reference math and alpha compositing.
- Updated `.github/workflows/ducs-contrast-audit.yml` to run the unit suite before the 106-pair source audit and to trigger on unit-test file changes.
- CI passed on `d77b339e5c0fcc1ec32fcb9c0f6adafb9914d18e`: [run #45675221898](https://github.com/faridulprime/DRM-Premium/actions/runs/45675221898). All 16 unit tests passed; the initial source audit reported 93/98 pairs meeting thresholds and five non-text boundary pairs for contextual review.
- Expanded the source-backed registry with Live Users admin/restricted drawer-role gradient endpoints, active restriction-tab text, back-link hover text and drawer-action hover text. The 106-pair audit now reports 101/106 meeting thresholds; the same five boundary findings remain. The expansion passed [run #45675604695](https://github.com/faridulprime/DRM-Premium/actions/runs/45675604695).
- Updated DUCS contrast/accessibility documentation and next-task tracking. No color token values or page styling were changed in this pass.
- Remaining: verify the latest docs-triggered CI, review the five boundary pairs in rendered component context, and add remaining page-state/overlay/forced-colors checks. Do not call the source-level audit a full WCAG conformance test.


## DUPS targeted positioning audit — 2026-11-26

- Replaced the Restricted Users modal's literal `z-index: 120` with the existing `--dups-layer-live-drawer` token; numeric behavior is preserved.
- Extended the Chromium design-system browser audit to verify computed fixed positioning, modal z-index/token agreement, and viewport-center geometry at all seven existing viewport widths.
- Chromium browser audit passed in [run #45676504120](https://github.com/faridulprime/DRM-Premium/actions/runs/45676504120) on commit `5cacd550b19b5d2e227b56de25d5fd235494e9a8`; the modal assertions passed at all seven viewport widths, alongside the existing 35 page/viewport checks. This is a targeted modal check, not full stacking-context, anchor-collision, or deployed-environment validation.


- Follow-up DUPS work: added `--dups-layer-builder-inspector: 2` and migrated the responsive Website Builder inspector's existing local layer without changing its value. Chromium run #45677034569 passed Homepage fixed-layer/token assertions (Builder, suspension screen, profile-completion backdrop/bar), responsive inspector checks through 900 CSS px, and the prior Live Users Restricted Users modal placement checks. Full DUPS coverage remains incomplete.


## DUPS anchor and local sticky-layer follow-up — 2026-11-26

- Mobile Homepage header login status now uses `--dups-anchor-gap-status` and the existing `--dups-offset-2`; Chromium verifies computed absolute placement, header-relative 4px gap and 8px right offset at existing mobile viewport widths.
- Live Users detail-dialog sticky header now uses `--dups-layer-live-dialog-sticky-header`; Chromium verifies sticky positioning and local z-index/token agreement.
- Browser suite passed in [run #45677961245](https://github.com/faridulprime/DRM-Premium/actions/runs/45677961245) on commit `d9953b483c21eaf2dd8ba0011c61d50cf9b5edf6`, including all 35 page/viewport checks and DUME lifecycle assertions.
- These checks cover named components only. Complete positioned-element inventory, ancestor stacking-context analysis, anchor collision/fallback, native zoom, safe-area and deployed behavior remain open.


- Strengthened the responsive Builder inspector browser test to reveal the static Builder shell and verify the shell is a rendered fixed containing block, then check the inspector's top/right/bottom offsets against it. Passed in [run #45678321298](https://github.com/faridulprime/DRM-Premium/actions/runs/45678321298) across existing viewport widths up to 900 CSS px.


- Migrated the closing Live Users drawer `::before` pseudo-element's remaining literal z-index 5 to the existing `--dups-layer-live-effect` token. Chromium run [#45678490915](https://github.com/faridulprime/DRM-Premium/actions/runs/45678490915) passed computed z-index checks for both closing pseudo-elements against the base/top tokens, alongside the full existing browser suite.


## DUPS visual-editor anchor follow-up — 2026-11-26

- Added semantic anchor tokens for the base visual-editor toggle, panel top/left, and the active theme's desktop/compact floating-toggle edge clearance.
- Migrated the corresponding declarations in `styles.css` and `theme.css` without changing coordinates: panel 56px/12px, desktop toggle edge 14px, compact edge 12px; existing z-index tokens are unchanged.
- Expanded the Chromium browser audit to reveal the static hidden editor controls and verify computed fixed positioning, token-resolved geometry, and both existing local stacking layers at all Homepage viewport checks.
- This is static geometry validation only; authenticated editor interaction, collision/fallback behavior, and native zoom remain unverified.
