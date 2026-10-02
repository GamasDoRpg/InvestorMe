# Current architecture

[Documentation index](../README.md) · [Market data](MARKET_DATA.md) · [Development](DEVELOPMENT.md)

This document describes the implemented code, reviewed on 2026-10-02. Future research engines are described separately in [VISION.md](VISION.md).

## Modules and dependency direction

| Module | Responsibility |
| --- | --- |
| `core/` | Validated immutable financial models, arithmetic, provider contract and market-data service. No UI, Electron or persistence dependencies. |
| `providers/` | Twelve Data/brapi normalization, HTTP access, market routing and explicit unavailable state. |
| `desktop/main.cjs` / `preload.cjs` | Application lifecycle, trusted IPC boundaries, native window controls and JSON export. |
| `desktop/connections.mjs` | Credential validation, OS encryption, configuration persistence and replacing provider sessions. |
| `desktop/market-data.mjs` | Backend construction, provider information and bounded market-data IPC. |
| `ui/finance.mjs` / `RemoteMarketDataProvider.mjs` | Domain adapter, reconstructed IPC objects, in-memory quote snapshots and unavailable values. |
| `ui/connections.mjs` | Account status and save/test requests; never receives stored secrets. |
| `ui/workspace.mjs` | Empty initial workspace and migration of old demonstration records. |
| `ui/app.js` | Rendering, financial forms, account settings and local workspace persistence. |
| `ui/research.js` / `layouts.js` | Navigation, inert script editor, research associations and customizable panels. |
| `tests/fixtures/` | Synthetic data for automated tests only; excluded from packaging and the preview allowlist. |

UI and providers consume Core. Core never imports them. There is no backend web server in desktop mode and no database. `desktop/preview.cjs` is only a local static preview server.

## Financial core — technical stage 1

Implemented: independent `Asset`, `Quote`, `Candle`, `Position` and `Portfolio` models. The core imports no DOM, Electron, storage or UI APIs and can be consumed directly from Node or a browser through `core/index.mjs`.

| Layer | Responsibility |
| --- | --- |
| `core/market/` | Immutable asset identity and market metadata; timestamped quotes with derived changes; validated provider-independent OHLCV candles. |
| `core/portfolio/` | Immutable positions and portfolios; invested capital, market value, cash, equity, unrealized P/L and allocation. |
| `core/common/` | Domain errors, input validation and shared decimal arithmetic. |
| `core/market/catalog.mjs` | Reference asset metadata only; no prices or generated market data. |
| `ui/finance.mjs` | Converts legacy workspace records into domain objects and exposes a presentation facade for the current UI. |
| `ui/app.js` | Rendering, interactions, formatting and localStorage persistence. Basic portfolio calculations delegate to the core. |
| `desktop/` | Electron lifecycle, restricted native bridge and browser preview; no financial rules. |

**Module compatibility.** The core uses native `.mjs` ES modules, without a bundler, framework, dependencies or a repository-wide module conversion. The Electron process remains CommonJS. `ui/bootstrap.mjs` loads the financial adapter first, exposes one read-only `window.InvestorMeFinance` bridge, then loads the existing classic `app.js`. This preserves the shared lexical scope used by `research.js` and `layouts.js`. The core itself creates no globals. The preview serves UI/core files and the explicitly allowed unavailable-provider module with the correct module MIME type; packaging includes `core/**/*.mjs`. The existing CSP, renderer sandbox and disabled Node integration are unchanged.

**Domain contracts.** Assets require ID, symbol, exchange, name, currency and asset type; sector, market and country are optional. IDs distinguish exchanges; tickers alone are not portfolio quote keys. Asset types are extensible, including equities, ETFs and indices. Quotes accept epoch milliseconds or an ISO timestamp with a timezone and calculate changes from an optional previous close. Candles require a timestamp, interval and finite nonnegative OHLCV values, with coherent high/low bounds. Positions accept nonnegative quantities (including fractions) and average costs. Invalid inputs raise `DomainError`; validated objects and position arrays are immutable.

`Portfolio.evaluate(quotes)` accepts a `Map` keyed by asset ID. It returns invested capital, market value, total equity (positions plus cash), unrealized P/L and per-position results. Allocation is a percentage of total equity **including cash**; `investedAllocation` is the percentage of position market value **excluding cash**, preserving the existing risk-page convention. Empty portfolios return zero values and zero allocations. Unknown quotes produce `null` valuation-dependent results rather than pretending the asset is worth zero; zero-quantity positions are worth zero without a quote. Returns on a zero cost basis and changes against a zero previous close are `null` because the percentage is undefined.

**Currencies and precision.** Core models support currencies independently of market/country. Each portfolio currently accepts only positions in its base currency; mixing currencies throws an explicit conversion-required error. No FX rates are assumed. The UI retains its existing BRL-only portfolio and USD market assets. Addition, subtraction and multiplication use decimal representations with integer arithmetic internally, avoiding common artifacts such as `0.1 + 0.2` without rounding intermediate values to cents. Inputs/outputs remain JavaScript Numbers and percentages use floating-point division; this is not an arbitrary-precision accounting ledger. Overflow/underflow in the decimal operations is rejected. Only presentation formats values to two decimal places.

**Workspace compatibility.** A compatible migration removes legacy examples as described below. The key `investorme.workspace.v1`, version `1`, `cash` and position records `{ id, ticker, quantity, cost }` remain unchanged, and the workspace continues to store scripts, strategies, models, alerts, settings and layouts for JSON export. Domain objects are reconstructed in memory. Financial form submissions validate before saving. Invalid saved financial values surface an error with edit/delete/cash/export actions; they are not silently repaired, discarded or replaced by demo positions.

**No demonstration outputs.** Mock providers and synthetic data are restricted to automated test fixtures, excluded from desktop packaging. Portfolio performance charts show unavailable history rather than invented lines. The stress scenario is arithmetic applied to user-selected assumptions and actual available valuations, not a prediction. Indicators, historical persistence, real backtesting, model training, alert monitoring and trading are not implemented.

**Legacy data migration.** `ui/workspace.mjs` starts new workspaces empty. On first loading an older workspace, exact unchanged seed records and the old default cash/watchlist are removed. Custom or edited records, scripts, layouts and preferences are preserved. Simulated model-run/backtest outputs are removed while their user configuration remains as drafts. When localStorage permits the write, a local recovery copy is saved once under `investorme.workspace.v1.before-real-data`; it is never displayed as current data. Because old records lacked provenance, an unchanged seed value cannot be distinguished from a user independently choosing that identical value; the recovery copy preserves the original workspace. The current workspace keeps version 1 and adds `dataRevision: 2`. No automatic workspace reset occurs.

`npm run check` validates all JavaScript source and test files. `npm test` runs the core calculations/validation tests plus all existing Electron tests and new compatibility, invalid-data recovery and browser-preview checks.

## Storage boundaries

| Data | Location / lifetime |
| --- | --- |
| Positions, cash, watchlist, research configuration, script source, preferences and layouts | Renderer localStorage, key `investorme.workspace.v1`. |
| Migration recovery copy | localStorage key `investorme.workspace.v1.before-real-data`, created once when storage permits. |
| Discovered asset metadata | Optional `marketAssets` in the workspace; bounded to 100 entries when restoring. No prices or series. |
| Quotes, history, search cache | Memory only; cleared on process exit and replaced when connection configuration changes. |
| Provider mode and encrypted credentials | `market-connections.json` under Electron `app.getPath("userData")`. |
| JSON export | User-selected file, containing workspace data only. No credential or price-cache export. |

The desktop and browser preview use different localStorage origins. There is no cloud synchronization, account login, automatic workspace import or transaction ledger. The account panel configures external data credentials and local preferences.

The migration retains version 1 and adds `dataRevision: 2`. Existing layout widget IDs remain stable; the account connection panel adds its own ID. If the migration backup/write fails, the migrated workspace remains in memory and the original stored value is not replaced by that failed write. Subsequent edits still depend on available localStorage capacity; the recovery copy is not a general backup system.

## Electron and credential security

The window runs with `contextIsolation: true`, `nodeIntegration: false` and `sandbox: true`. Its CSP includes `connect-src 'none'`. External navigation and new windows are denied. The main process checks the sender window, top frame and local application URL before privileged IPC.

`desktop.market` exposes only info, quote(s), history and search operations. `desktop.connections` exposes status, save and test. Credentials are entered in password inputs, sent to main through restricted IPC and cleared from the form; stored keys are never returned through status. Status reports mode, key-presence flags, secure-storage availability, persistence and warnings.

Credential updates are validated and serialized, then written via a temporary file and rename. With OS encryption available, `safeStorage` encrypts the key object. Without it, including Linux's `basic_text` backend, only the selected mode is persisted and keys remain in memory for the session. These encrypted files are tied to the local OS account/environment, not portable credential backups. A corrupt or locked file is preserved until an explicit save replaces it.

Changing connections builds new services/caches. A revision check rejects replies from the old main-process connection; the UI generation check prevents old refresh results from restoring cleared prices. Provider destinations are fixed; scripts cannot use the native bridge as a general filesystem, network or code-execution API.

## Current limits

The UI still uses classic scripts sharing lexical scope. The single read-only bridge is a compatibility boundary, not a broad conversion to modules. Core supports extensible assets, but that does not guarantee provider coverage or UI support for every asset type. Portfolio accounting is BRL-only in the UI; USD quotes can be inspected without implying FX conversion. Performance history, realized returns, transaction costs, corporate actions, income and research engines remain future work.
