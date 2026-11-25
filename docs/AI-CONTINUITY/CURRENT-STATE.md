# DRM Premium — Current State
Verified ref: `feature/full-admin-panel`
Verification date: 2026-11-25

## Application branch and safety

- Public website and Admin application work remains on `feature/full-admin-panel`.
- Do not merge, rebase onto `main`, or deploy to Production without explicit authorization.
- Shared Preview and Production D1 remain separate. No D1 writes or migrations were performed in this work.
- The latest repository source audit is `docs/REPOSITORY-AUDIT-2026-11-25.md`.

## DUGA

- DUGA architecture, roles, ownership, dependency metadata and policies are present on this branch.
- D1 operational schema remains a design draft here. No DUGA API or separate Control Center is implemented in the website runtime.
- A separate branch, `duga-foundation-review`, contains Draft PR #4 based on `main`; it is open and unmerged.
- DUGA review PR #4 remains open, Draft, and unmerged, with latest head `1b2bf55c157eddbed798b4cdbccc46c9b0c6be64` (based on `main`). After workflow action upgrades, review-branch push run #251 and PR run #252 passed on head `37f8e021793549478c0962c2eb22d7d621c048ba`; follow-up push run #254 and PR run #255 both passed on current head `1b2bf55c157eddbed798b4cdbccc46c9b0c6be64`. Feature-branch run #253 passed on `9d82e249b8cac4b6627081a3526c9c97c3108271`. Local schema/registry/fixture and Worker syntax checks passed as applicable. No Node 20 action deprecation warning appeared in the v7 runs. This remains local CI evidence only, not Cloudflare D1 acceptance.
- PR #4 records an earlier disposable-D1 Worker acceptance PASS (run `53d70371-008c-46a0-8bc3-33522be990eb`). The DUGA lifecycle review explicitly notes that the schema was subsequently extended with predecessor-link and AI-review constraints, and revised-schema disposable D1 acceptance has NOT RUN.
- Shared Preview migration-history reconciliation, independent third-party review, trusted AI/validation identity, Git provenance and application integration tests remain outstanding. Preview migration and DUGA write endpoints remain NO-GO.
- Human identity assignments remain unassigned. AI principal IDs are not credentials.

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
