# DUPS Token Registry — v0.1.0

All tokens are defined in `assets/positioning/tokens.css`. The initial release adds definitions only; existing component declarations remain authoritative.

## Logical offset primitives

| Token | Value | Intended use |
|---|---:|---|
| `--dups-offset-0` | 0 | Explicit zero offset |
| `--dups-offset-1` | 0.25rem | Minimal offset |
| `--dups-offset-2` | 0.5rem | Compact offset |
| `--dups-offset-3` | 0.75rem | Small offset |
| `--dups-offset-4` | 1rem | Standard offset |
| `--dups-offset-6` | 1.5rem | Large offset |
| `--dups-offset-8` | 2rem | Extra-large offset |

## Semantic placement tokens

| Token | Alias | Intended use |
|---|---|---|
| `--dups-inset-edge` | offset-4 | Default edge-pinned inset |
| `--dups-inset-edge-compact` | offset-2 | Compact edge-pinned inset |
| `--dups-overlay-inset` | offset-4 | Overlay boundary clearance |
| `--dups-floating-clearance` | offset-3 | Clearance for floating UI |

These are defaults, not universal constraints. Component-specific responsive values require documented justification.

## Stacking layers

| Token | Value | Intended use |
|---|---:|---|
| `--dups-layer-base` | 0 | Base positioned content |
| `--dups-layer-raised` | 10 | Locally raised content |
| `--dups-layer-sticky` | 100 | Sticky navigation or utility surfaces |
| `--dups-layer-dropdown` | 200 | Dropdown menus |
| `--dups-layer-overlay` | 300 | Backdrops and non-modal overlays |
| `--dups-layer-drawer` | 400 | Drawers and side panels |
| `--dups-layer-modal` | 500 | Modal dialogs |
| `--dups-layer-popover` | 600 | Popovers and contextual surfaces |
| `--dups-layer-tooltip` | 700 | Tooltips |
| `--dups-layer-toast` | 800 | Toast notifications |
| `--dups-layer-critical` | 900 | Exceptional critical UI only |

Layer numbers are conventions within a stacking context, not a guarantee of global order. A child cannot out-rank an ancestor stacking context.

## Anchor gaps

| Token | Value |
|---|---:|
| `--dups-anchor-gap-xs` | 0.25rem |
| `--dups-anchor-gap-sm` | 0.5rem |
| `--dups-anchor-gap-md` | 0.75rem |
| `--dups-anchor-gap-lg` | 1rem |

## Alignment references

- `--dups-align-start`: logical start edge.
- `--dups-align-center`: center alignment.
- `--dups-align-end`: logical end edge.

These references are for coordinate/anchor placement only. They do not replace Grid/Flex alignment or DUSS layout tokens.

## Governance
New tokens require a semantic name, a single owner, an intended use, and a dependency entry where they are consumed. Avoid duplicate aliases and arbitrary per-component z-index values. Document exceptions rather than silently expanding the scale.


## Audited component layer aliases (v0.2.0)

The token file also includes component-specific aliases for shared shell, Profile, Live Users, visual editor/site builder, suspension/profile-completion overlays, and Upload Studio. These aliases intentionally retain legacy numeric values. They are compatibility mappings, not a mandate that unrelated components share the same layer. See `DUPS-DEPENDENCY-REGISTRY.md` for migrated scope and limitations.
