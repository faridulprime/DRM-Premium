# DUCS Usage Rules

1. Prefer a semantic token when writing shared styles; use component aliases when a component-specific role exists.
2. Do not copy a HEX literal from another file. Search the registry first.
3. Never use the success palette for a brand accent, or the danger palette for ordinary emphasis.
4. Text, icon, and surface colors must be selected as a tested combination.
5. Define hover, active, focus, selected, disabled, and loading states intentionally.
6. Do not rely on color alone for status, errors, selection, or required fields.
7. Keep page-specific accents in `themes/page-mapping.css` until a deliberate theme system is introduced.
8. If a component needs a one-off color, document why it cannot use an existing token.
9. Before changing a primitive, identify all semantic tokens and page/component consumers.
10. DUCS does not own font size, spacing, dimensions, or transitions; use DUSS and DUME respectively.
