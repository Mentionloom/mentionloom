# Orbit source installation

Installed September 10, 2026 from Orbit's official [getting-started guide](https://giovanitier.github.io/orbit/guides/getting-started/).

- Version: **0.2.0** (see `orbit.json`).
- Installer package: `https://giovanitier.github.io/orbit/downloads/orbit-ui-0.2.0.tgz`.
- Source reference: `giovanitier/orbit`, tag `v0.2.0`, upstream main inspected at `02a8359`.
- Install directory: `app/components/orbit`.

The official CLI copies editable source; it is intentionally not listed as an npm runtime dependency. Reproduce a component installation with:

```sh
npm exec --yes --package="https://giovanitier.github.io/orbit/downloads/orbit-ui-0.2.0.tgz" -- orbit add button --dir app/components/orbit
```

Installed templates: button, icon-button, segmented-control, dropdown-menu, checkbox-and-radio, badge-and-status, text-input, text-area, select-and-date, rolling-number, metric-and-sparkline, filter-chips, simple-data-table, side-drawer, command-palette, toast, tooltip, funnel, empty-state.

The dashboard imports `runtime/orbit.js`, calls `initialize()`, `setTheme('light')` and `prepare()` on its composed controls. Its eight runtime stylesheets are loaded before the application theme so initialization cannot reorder the cascade. The installer ships the shared catalog/runtime together; this release is not tree-shaken.

## Product adaptations

- Density, layout, semantic foreground corrections and focus treatment live outside vendor code in `../../tokens.css`, `../../foundation.css` and `../../app.css`.
- `../../lib/ui.js` uses Orbit's dropdowns, indicators, dialog lifecycle, number renderer and icon catalog. The adapter removes only the gallery-specific `specimen-body` layout class after `prepare()`; the actual runtime enhancement remains.
- **One vendor extension:** `runtime/numbers.js` adds `kind: 'percent'` with one decimal to the existing formatter. The app passes a fractional value, preserving 48.1% precisely while using Orbit's animated and accessible number implementation. Retain this extension when replacing the installed runtime unless upstream provides equivalent percentage precision.
- The domain chart, custom engine marks, app search results, evidence and local setup flows remain product-specific. They consume Orbit tokens and interaction primitives.
- App selectors use `data-app-icon`, `data-source-page`, `#app-detail-title` and `#app-toast` to avoid collisions with the catalog's global enhancement selectors and support-template IDs.
- Filter updates run after the native event dispatch so the selected option remains available while Orbit closes the menu and restores focus.

`npm test` checks the complete installed runtime and font assets reach the build unchanged, and protects semantic contrast thresholds.
