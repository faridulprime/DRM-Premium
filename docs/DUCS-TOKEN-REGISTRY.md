# DUCS Token Registry — v0.2.1

## Primitive tokens
| Family | Tokens |
|---|---|
| Neutral | `--ducs-neutral-0`, `--ducs-neutral-50`, `--ducs-neutral-75`, `--ducs-neutral-100`, `--ducs-neutral-200/300/400/450/500/600/650/700/800/850/900/925/940/950/975` |
| Brand | `--ducs-brand-blue-300/400/500`, `--ducs-brand-red-500`, `--ducs-brand-mint-400`, `--ducs-brand-violet-400`, `--ducs-brand-indigo-500`, `--ducs-brand-gold-400`, `--ducs-brand-steel-400`, `--ducs-brand-rose-400`, `--ducs-brand-lavender-50` |
| Status palette | `--ducs-green-400/450/500`, `--ducs-yellow-400`, `--ducs-orange-400`, `--ducs-red-350/400/450/500`, `--ducs-blue-400`, `--ducs-purple-400` |
| Transparency | `--ducs-alpha-black-*`, `--ducs-alpha-white-*`, `--ducs-alpha-{success,warning,danger,info}-12`, `--ducs-ink-on-primary` |

## Semantic tokens
Background: `--ducs-bg-canvas`, `--ducs-bg-subtle`.
Surface: `--ducs-surface-base`, `--ducs-surface-raised`, `--ducs-surface-sunken`, `--ducs-surface-hover`.
Text: `--ducs-text-primary`, `--ducs-text-secondary`, `--ducs-text-muted`, `--ducs-text-inverse`.
Border: `--ducs-border-subtle`, `--ducs-border-default`, `--ducs-border-strong`.
Icon: `--ducs-icon-primary`, `--ducs-icon-secondary`, `--ducs-icon-muted`.
Action/focus: `--ducs-action-primary`, `--ducs-action-primary-hover`, `--ducs-action-danger`, `--ducs-focus-ring`.
Status: `--ducs-status-success`, `--ducs-status-warning`, `--ducs-status-danger`, `--ducs-status-info`.
Overlay: `--ducs-overlay-scrim`.

## Component tokens
Buttons: `--ducs-button-primary-*`, `--ducs-button-secondary-*`.
Fields: `--ducs-field-bg`, `--ducs-field-text`, `--ducs-field-placeholder`, `--ducs-field-border`, `--ducs-field-border-focus`.
Badges: `--ducs-badge-{success,warning,danger,info}-{bg,text}`.
Cards/dividers: `--ducs-card-bg`, `--ducs-card-border`, `--ducs-divider`.
Feedback: `--ducs-notice-{success,warning,danger,info}`.
Tooltip/dialog: `--ducs-tooltip-*`, `--ducs-dialog-backdrop`.

## Page mapping tokens
Page-scoped descriptive tokens use `--ducs-page-*`; Upload Studio creative accents use `--ducs-page-creative-*`. These are compatibility mappings, not yet component consumers.

## State and accessibility
States: `--ducs-state-{hover,active,selected,focus,disabled,loading}-*`.
Accessibility: `--ducs-a11y-focus-width`, `--ducs-a11y-focus-offset`, and contrast target tokens.

New tokens must be added here with a description, owner, and intended foreground/background pairing where relevant.
