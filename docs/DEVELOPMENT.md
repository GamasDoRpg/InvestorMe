# Development and verification

[Documentation index](../README.md) · [Architecture](ARCHITECTURE.md) · [Roadmap](ROADMAP.md)

## Source map

| Path | Purpose |
| --- | --- |
| `desktop/` | Electron CommonJS entry/preload, ESM market/credential backend, static preview and icons. |
| `ui/` | HTML/CSS, ESM bootstrap/adapters, classic app/research/layout scripts and local textures. |
| `core/common/` | Validation and decimal arithmetic. |
| `core/market/` | Asset, Quote, Candle and reference asset metadata. |
| `core/portfolio/` | Position and Portfolio valuation. |
| `core/market-data/` | Provider contract, cache, service and safe errors. |
| `providers/` | Twelve Data, brapi, routing, HTTP/symbol helpers and unavailable provider. |
| `tests/` | Node unit tests and Playwright/Electron/browser interaction tests. |
| `tests/fixtures/` | Deterministic mock quotes/history, used only by tests. |
| `scripts/check.cjs` | Recursive JavaScript syntax checks. |
| `.github/workflows/desktop.yml` | Ubuntu verification followed by Windows packaging. |
| `docs/` | Current implementation guides, roadmap and separate future vision. |
| `assets/FirstInterfaceModel/` | Historical design references, not a specification of runtime data. |

There is no bundler, frontend framework, TypeScript conversion, database, Python runtime or ML dependency. `package.json` currently declares Electron `^40.0.0`, electron-builder `^26.0.12` and Playwright `1.58.2` as development dependencies. Use `npm ci` to install the lockfile's resolved versions; do not infer them from the ranges alone.

## Commands

Run from the repository root with Node.js 22 LTS or later.

| Command | Effect |
| --- | --- |
| `npm ci` | Installs locked dependencies. |
| `npm start` | Starts the Electron application with provider/account support. |
| `npm run preview` | Starts the disconnected static preview on `127.0.0.1:4173`; `PORT` can override the port. |
| `npm run check` | Runs `node --check` recursively for source and test JavaScript. This is syntax validation, not a linter or financial audit. |
| `npm test` | Runs `node --test tests/*.test.cjs tests/*.test.mjs`. |
| `npm run dist:win` | Builds NSIS installer and portable Windows executable into `release/`. |

The preview is a long-running process; stop it before ending the session. It intentionally exposes only UI, Core and the unavailable-provider module, never the HTTP providers, desktop backend or environment files. It is not a public hosting service.

## Tests and evidence

The last application-code validation on 2026-10-04 passed `npm run check` and **63 tests**. Tests use temporary user profiles and controlled provider responses; they do not require API keys or internet access to financial services.

| Test file | Main coverage |
| --- | --- |
| `tests/core.test.mjs` | Models, required fields, impossible candles, invalid numbers, decimal arithmetic, positions, portfolios, allocation and missing quotes. |
| `tests/market-data.test.mjs` | Contract, normalization, cache/coalescing, deadlines/retries, errors, Twelve HTTP fixtures, configuration and IPC. |
| `tests/brapi.test.mjs` | brapi normalization/history/search, token headers, serialized requests, errors and independent routing/cooldowns. |
| `tests/connections.test.mjs` | Credential persistence/removal, unavailable encryption, malformed input, corrupt-file preservation, trusted requests, stale replies and workspace migration. |
| `tests/ui.test.cjs` | Actual Electron UI, CRUD, research configuration, scripts, layouts, preferences/export, empty state, preview, local/remote company logos, masked key rows, probe status and fallback and account/provider flow. |

The encryption unit tests inject a cryptographic test implementation; they do not prove every operating system's keychain behavior. Electron tests exercise production IPC/account/provider wiring with injected HTTP responses. An authenticated live-provider smoke test and a restart on a target Windows installation are separate checks; do not report them as completed because fixtures pass.

On Linux, Electron tests use the headless Ozone backend. Root test containers add `--no-sandbox` because Chromium cannot start its OS sandbox as root; normal application startup does not set that flag. Do not weaken production security to make container tests run. Electron still needs its platform libraries installed.

## Windows artifacts and CI

The workflow triggers for pull requests, manual dispatch and pushes to `main` or `feat/desktop-interface`. It uses Node 22, installs dependencies and runs syntax checks/tests on Ubuntu. The dependent Windows job installs dependencies and runs:

```powershell
npm run dist:win -- --publish never
```

`CSC_IDENTITY_AUTO_DISCOVERY=false` disables signing discovery in CI. The build uploads `release/*.exe` as **InvestorMe-Windows-x64**. Download the artifact from a successful workflow run and extract it; no GitHub Release is created automatically. Builds are unsigned. Packaging configuration includes UI, Core, providers and the desktop credential module, but excludes test fixtures. No local Windows build is claimed by the Linux test results.

## Environment and diagnostics

Prefer the account UI. [.env.example](../.env.example) documents optional first-launch variables; the app does not auto-load `.env`. An existing saved connection configuration takes priority. See [Market data](MARKET_DATA.md#configuration-precedence) for exact precedence.

`MARKET_DATA_DEBUG=1` enables normalized operation/status/timing logs in main. Never add raw key/header/URL/payload logging. A useful bug report includes commit, OS, steps, expected behavior and sanitized error codes. Do not attach populated credential files or localStorage containing personal portfolio data.

## Contributing

Keep changes scoped and preserve existing workspace records, routes, widget IDs and export behavior. Use the current code as the source of truth; update the relevant guide and roadmap when behavior changes.

- Keep Core independent of UI, Electron and persistence; put vendor formats in adapters.
- Validate financial numbers and model identities; retain explicit unknown values instead of manufacturing fallback prices.
- Keep mocks under test fixtures. Add focused calculation/provider/interaction tests for behavior changes.
- Preserve context isolation, sandbox, CSP, fixed destinations and trusted IPC validation.
- Keep scripts inert until a separately designed execution/permission system exists.
- Run `npm run check` and `npm test` for code changes. For documentation-only changes, check links, source references and consistency; rerun application tests only when resolving a concrete risk.
- Review the diff and distinguish automated checks, live-account validation and packaging evidence in the PR.

There is no license file in the repository at this revision. Proposed future modules and APIs in [Vision](VISION.md) are design ideas, not compatibility commitments.
