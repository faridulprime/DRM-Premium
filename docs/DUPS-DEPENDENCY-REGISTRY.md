# DUPS Dependency Registry — v0.1.0

This registry records the initial lexical source audit and the intended migration ownership. Counts are declaration occurrences in source text, not unique components or computed runtime behavior.

## Initial source audit

Branch: `feature/full-admin-panel`
Scope: six principal page/shared stylesheets.
Method: count CSS declaration starts for `position:`, `z-index:`, and physical/logical inset-like properties using a source-text regular expression. The audit does not parse CSS syntax or resolve selectors/cascade.

| Stylesheet | position declarations | z-index declarations | inset/edge declarations |
|---|---:|---:|---:|
| `theme.css` | 9 | 17 | 51 |
| `styles.css` | 28 | 12 | 30 |
| `admin.css` | 0 | 0 | 4 |
| `live-users.css` | 14 | 13 | 26 |
| `upload-studio.css` | 9 | 2 | 7 |
| `profile.css` | 0 | 0 | 0 |
| **Total** | **60** | **44** | **118** |

These totals are lexical declaration counts, not a claim that 60 distinct components use positioning or that all 118 offsets should become tokens. Shorthands and declarations outside the matched syntax may be omitted; duplicate selectors and overridden declarations may be counted.

## Dependency map

| Dependency domain | Primary stylesheet(s) | DUPS responsibility | Priority |
|---|---|---|---|
| Shared shell, navigation, menus | `theme.css`, `styles.css` | Positioning context, pinned placement, stacking | High |
| Homepage floating controls and overlays | `styles.css`, `theme.css` | Fixed/absolute placement and layer policy | High |
| Admin dashboard and utility panels | `admin.css`, `theme.css` | Local positioned affordances and overlay order | Medium |
| Live Users drawer, smoke layers, menus | `live-users.css`, `theme.css` | Drawer/backdrop stacking and anchored controls | High |
| Upload Studio editor and preview | `upload-studio.css` | Preview overlays, sticky/anchored tools | Medium |
| Profile forms and cards | `profile.css` | Only if positioned elements are introduced | Low |

## Ownership exclusions

- Grid/flex tracks, gaps, page gutters, widths, and heights remain DUSS.
- Color and shadow values remain DUCS/component styling.
- Transform, transition, animation, and motion timing remain DUME.
- DOM semantics, focus management, and dialog behavior remain component/application responsibilities.

## Migration status

- DUPS specification: added.
- Token foundation: added; no existing component selectors changed.
- Stylesheet integration: linked on Homepage, Admin, Live Users, Upload Studio, and Profile with cache key `dups-01`.
- Token registry: added.
- Source dependency audit: added.
- Shared-shell stacking migration: source-level tokenized in `theme.css` for desktop header, category bar, desktop/mobile sidebar, sidebar backdrop, mobile home header/sidebar/backdrop, and Profile drawer/backdrop. Numeric fallbacks preserve the audited values.
- Other component positioning migration: pending.
- Fixed/sticky containing-block ancestor checks: Chromium run #45697389096 passed across 35 page/viewport states and the dynamic Live Users overlay suite.
- Expanded stacking-context ancestor inventory: implemented in the browser audit; execution/result review on the latest commit is pending.
- Full browser visual collision validation, native zoom, physical mobile safe-area, and RTL checks: pending.
- Keyboard, zoom, mobile safe-area, and RTL checks: pending.

## Phase 1 migration note — shared shell stacking

The first consumer migration is intentionally limited to stacking order in `theme.css`. It replaces audited z-index literals with DUPS layer tokens while preserving their original numeric fallback values. This includes the page header, category bar, desktop and mobile sidebar, sidebar backdrop, mobile homepage header/sidebar/backdrop, and Profile drawer/backdrop. Position modes and inset coordinates remain unchanged in this phase. No layout, color, or motion declarations were changed as part of this migration.

This is a source-level migration only. Actual stacking-context behavior still requires browser inspection because z-index is scoped by ancestor stacking contexts.

## Migration rule

Do not globally replace numeric z-index or offset values. For each component family: inspect the selector and ancestor stacking contexts, establish the intended containing block, map only semantically equivalent values, preserve rendered behavior, and validate all consuming pages.


## Migration update — DUPS v0.2.0

Audited stacking-layer consumers have been migrated to semantic DUPS aliases in `theme.css`, `styles.css`, `live-users.css`, and `upload-studio.css`. Scope includes shared shell layers, Profile drawer/backdrop, Live Users header/highlight/drawer/backdrop/notice/avatar/effects, visual editor, site builder, suspension screen, profile-completion overlay, and Upload Studio sidebar/inspector/header. Numeric fallbacks preserve the original audited values. This does not migrate every position/inset declaration, implement anchor collision handling, or prove computed stacking behavior. Browser verification remains pending.


### Viewport placement migration — DUPS v0.3.0

`live-users.css` now consumes DUPS tokens for the established Live Users drawer desktop coordinates, modal viewport center, and mobile center overrides. Values preserve the prior `51.1%`, `calc(54.4% - 90px)`, and `50%` behavior. No automatic anchor collision handling or viewport repositioning engine was introduced. Browser placement validation remains pending.


### Restricted Users modal follow-up — 2026-11-26

The Restricted Users modal now consumes the existing `--dups-layer-live-drawer` token instead of a literal z-index. The design-system Chromium audit checks its computed fixed positioning, token-resolved z-index, and viewport-center geometry across the existing seven viewport widths. The check passed in Chromium run #45676504120 at all seven viewport widths. It is scoped to this modal and does not imply complete DUPS migration or collision/fallback coverage.


### Website Builder responsive inspector layer and anchors — 2026-11-26

The inspector's responsive absolute-positioning layer now uses `--dups-layer-builder-inspector` with fallback 2. Its top/right/bottom offsets now consume explicit DUPS anchors (66px/0/34px, with the existing compact 112px top override). Chromium resolves these custom properties from the positioned inspector and compares computed geometry against the shell's bounding box at the existing desktop/tablet/mobile widths. This is a local layer inside the fixed Website Builder shell, not a global overlay layer.


### Homepage overlay and responsive inspector browser acceptance — 2026-11-26

Chromium run #45677034569 passed the added Homepage fixed-layer/token checks for the Website Builder, suspension screen and profile-completion overlay pair, plus the responsive Builder inspector's absolute-positioning/token checks at widths up to 900 CSS px. The Live Users Restricted Users modal checks also pass in the same browser suite. This remains a curated set of components, not a complete DUPS inventory.


### Mobile Homepage header-status anchor — 2026-11-26

The header login status uses the existing DUPS anchor-gap and logical offset tokens for its mobile absolute position: 4px below the header and 8px from the right edge at the default root size. The Chromium audit verifies computed absolute positioning and both offsets against the token values on the existing Homepage mobile viewport checks. The containing block remains the fixed Homepage header; no general-purpose popover engine or collision fallback is implied.


### Live Users detail-dialog sticky header — 2026-11-26

The sticky detail-dialog header now consumes `--dups-layer-live-dialog-sticky-header` (fallback 1) and `--dups-anchor-live-dialog-sticky-header-top` (0). The Chromium audit checks computed sticky positioning, top-anchor and z-index/token agreement on the Live Users page at all existing viewport widths. Its layer is local to the dialog; it does not compete with page-level overlays.


### Latest DUPS targeted Chromium verification — 2026-11-26

Run #45677961245 passed the mobile Homepage header-status anchor token checks and Live Users detail-dialog sticky-header token checks, along with Homepage overlay layers, responsive Builder inspector and Restricted Users modal checks. The run also passed all 35 existing page/viewport checks and DUME lifecycle assertions. This curated browser suite does not constitute full DUPS conformance.


### Live Users drawer closing-effect pseudo layers — 2026-11-26

Migrated the remaining literal `z-index: 5` on `.live-user-drawer.is-closing::before` to the existing `--dups-layer-live-effect` token. Chromium reads both closing pseudo-element computed z-index values and checks them against the base/top DUPS tokens. These layers remain local to the drawer; no global overlay ordering is implied.


### Website Builder inspector containing-block geometry — 2026-11-26

Chromium run #45678321298 passed the expanded check that reveals the hidden static Builder shell, verifies the shell is fixed and rendered, and checks the inspector's absolute position plus top/right/bottom geometry relative to that shell (including the mobile top offset). This is stronger than checking computed `position` and `z-index` alone, but does not cover interactive Builder runtime behavior.


### Live Users drawer effect pseudo-layer browser acceptance — 2026-11-26

Chromium run #45678490915 passed the computed z-index checks for the closing drawer `::before` and `::after` pseudo-elements against `--dups-layer-live-effect` and `--dups-layer-live-effect-top`. The same run passed all 35 page/viewport checks and existing DUME drawer lifecycle checks. This validates token agreement, not visual effect quality.


### Visual editor fixed-anchor migration — 2026-11-26

The base visual-editor toggle and panel now consume semantic DUPS anchor tokens. The active Homepage theme override consumes desktop (14px) and compact (12px) edge tokens for the fixed toggle. A Chromium assertion reveals the static hidden toggle/panel and verifies computed fixed positioning, top/left/right/bottom geometry, and existing local z-index token agreement at the existing Homepage viewport set. Numeric coordinates and stacking order are preserved. This does not validate the editor's authenticated interaction flow, dynamic collision handling, or every route where the editor may be mounted.


### Profile completion overlay anchor migration — 2026-11-26

The fixed profile-completion bar now consumes DUPS top and viewport-center anchor tokens; its backdrop consumes an explicit zero-inset token. Chromium verifies computed fixed positioning, top offset, center alignment, full-viewport backdrop coverage and existing stacking order at the Homepage viewport set. Existing 74px/50%/0px geometry and layer values are preserved.

### Profile drawer Category Bar clearance — 2026-11-26

The Category Bar's 390px right displacement while the desktop Profile drawer is open now consumes `--dups-anchor-profile-drawer-clearance`; the compact override sets that same token to 0px. Chromium toggles the drawer-open body state in the Homepage fixture and compares computed `right` against the resolved token at every existing viewport. The Admin mobile Category Bar's final late 86px override also now sets and consumes the state-scoped Category Bar top token instead of bypassing it with a literal.


The responsive compact/mobile override retains its pre-existing 66px top coordinate through the same component-scoped token. The browser test reveals the hidden static bar/backdrop before reading computed geometry, so it validates actual pixel positioning rather than the unresolved percentage returned for a display:none element.


### Responsive Category Bar anchor migration — 2026-11-26

Migrated all 13 numeric Homepage Category Bar top declarations in `theme.css` to a state-scoped `--dups-anchor-category-bar-top` token. The token defaults to DUSS desktop/mobile header heights and is overridden only by the pre-existing responsive/state selectors; Admin mobile overrides use the same semantic anchor token. Chromium now checks computed fixed positioning and token agreement across the Homepage's guest, login-hidden and profile-menu-visible states at each mobile viewport. This is a token migration only: all previous numeric top coordinates and selector precedence are retained.


The compact/mobile 66px override exists in both the base stylesheet and the later Homepage theme layer. Both declarations now set and consume the same DUPS anchor token, preserving cascade precedence and the original computed position. A duplicate late `theme.css` Admin Category Bar override previously bypassed the token; it now consumes the same state-scoped token. Chromium also checks the Admin bar's computed fixed top against the resolved token.


### Live Users notice anchor migration — 2026-11-26

The fixed Live Users status notice now consumes semantic DUPS tokens for its 50% horizontal anchor and 18px bottom clearance. The existing horizontal centering transform and local z-index 140 are unchanged. Chromium verifies computed geometry and layer at all existing Live Users desktop, tablet, mobile, narrow and breakpoint viewport checks. This validates static rendering, not the authenticated notice lifecycle or timing.


### Registration close and Live Users presence micro-anchor migration — 2026-11-26

The registration dialog close button now consumes dedicated top/right tokens (17px/18px); the Live Users presence dot consumes one shared -1px edge token for right/bottom. Computed Chromium checks cover the dialog's opened state and a temporary avatar fixture across the viewport matrix. These are local component coordinates; no visual geometry changed.


The compact/mobile rule retains its existing 10px left and right insets through separate compact tokens; the test now distinguishes desktop center anchoring from the compact full-width inset layout at the 760px breakpoint.


### Website Builder live-edit overlay migration — 2026-11-26

The dynamically created `.sb-live-edit-overlay` now uses the zero-offset primitive for its full-wrapper inset and a dedicated local layer token (20). The actual parent selector remains a positioned, isolated wrapper. Chromium verifies the wrapper context, absolute fill geometry and computed layer using a DOM fixture that matches the runtime class structure; iframe pointer/event integration remains outside this static audit.


### Homepage hero decorative-anchor migration — 2026-11-26

The hero corner decoration and its `::before` overlay now use zero-inset DUPS tokens. Their existing relative/absolute containing-block relationship and geometry are preserved. Chromium verifies the hero positioning context, zero corner offsets and full pseudo-element coverage across the Homepage viewport matrix.


### Homepage login-status responsive anchor/layer migration — 2026-11-26

The Homepage login-status badge now consumes a semantic 8px desktop gap token and the existing header-status layer token (110), matching the effective theme cascade. The compact rule continues to use the existing 4px gap and 8px right offset tokens. Chromium temporarily supplies fixture text so the normally empty/hidden badge renders, measures its gap from the actual `offsetParent` (`.top-actions` on desktop and the fixed header on compact layouts), then checks the right offset and layer across the Homepage viewport matrix, including both sides of the 760px breakpoint. The fixture text is restored immediately. This is a behavior-preserving token migration.


### Live Users account drawer responsive anchor migration — 2026-11-26

The fixed account drawer's existing desktop placement (51.1% vertical; calc(54.4% - 90px) horizontal) and compact 50%/50% centering are now represented by semantic DUPS anchor tokens. The effective 760px breakpoint, translate-based center alignment and local layer remain unchanged. The earlier 700px drawer rule remains compatible; the later 760px rule now consumes the same compact anchor tokens while the Restricted Users modal retains its independent viewport-center token. Chromium reveals the static drawer via its is-open state and checks rendered center coordinates against the viewport-derived targets across the existing Live Users viewport matrix.

### Stacking-context audit implementation — 2026-11-26

The browser test now emits a diagnostic inventory of stacking-context-producing ancestors for visible fixed/sticky elements across the five static pages and seven viewport widths. It includes positioned/fixed/sticky z-index, opacity, blend mode, isolation, transforms, filters, perspective, containment, container queries, clip-path/masks, flex/grid-item z-index and relevant `will-change` values. This inventory is diagnostic only; it does not fail merely because an intentional context exists. The latest test expansion has not yet been verified by a completed Chromium run. It does not cover all pseudo-elements, shadow roots, iframe documents, dynamic application states, native browser zoom, physical iOS safe areas, or deployed runtime.



### Upload Studio mobile global-header anchors — 2026-11-26

The mobile fixed `.studio-global-topbar` now uses the existing `--dups-offset-0` primitive for its top, left and right viewport edges; its existing `--dups-layer-home-header-mobile` layer and 58px header geometry are unchanged. The Chromium audit checks computed fixed positioning, all three rendered viewport-edge offsets and layer-token agreement at the sampled Upload Studio widths up to 760 CSS px. This is a targeted source/geometry assertion, not a native browser zoom, physical safe-area or deployed-runtime test.


### Shared shell viewport-edge anchors — 2026-11-26

The shared fixed `.topbar` now consumes `--dups-offset-0` for top/left/right. The fixed `.category-bar` consumes the same zero primitive for left/right while retaining its DUSS header-height top anchor. The mobile shared sidebar consumes the zero primitive for top/bottom, and the mobile sidebar backdrop uses it for all four insets. Existing fixed positioning, dimensions, responsive overrides and layer aliases are preserved. The Chromium audit now checks the Homepage header's zero top/left/right edges and the Category Bar's left/right edges plus alignment directly beneath the rendered header across all seven viewport widths. The assertion is limited to the static Homepage shell fixture.


### Profile drawer and navigation viewport-edge anchors — 2026-11-26

The shared desktop sidebar's left/bottom edges, compact Homepage sidebar's top edge, Profile drawer's top/right/bottom edges and compact Profile drawer backdrop's full-viewport inset now reuse `--dups-offset-0`. Existing fixed positioning, drawer width, desktop header-relative sidebar top, compact breakpoints and layer tokens are preserved. The Chromium Homepage viewport matrix now checks the Profile drawer's fixed edge geometry, sidebar left/bottom edges, compact sidebar top edge, and compact backdrop's four rendered edges. The assertion is source-level test coverage only until a new Chromium workflow run is confirmed.
