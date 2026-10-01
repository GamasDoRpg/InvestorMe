# InvestorMe

> A customizable investment research platform focused on portfolio tracking, quantitative analysis, strategy automation, and machine-learning-assisted market signals.

InvestorMe is an experimental software project designed to help investors analyze assets, monitor portfolios, test strategies, and build probabilistic models for financial markets.

The project is built around one principle:

> **The software should not pretend to know the future. It should measure probabilities, risk, uncertainty, and historical evidence as clearly as possible.**

InvestorMe is currently in an early stage of development. The architecture and features described below represent the intended direction of the project and should not be interpreted as already implemented unless explicitly marked otherwise.

---

## Desktop interface preview (v0.1)

The repository now includes a runnable **Electron desktop interface**, inspired by the eight mockups in `assets/FirstInterfaceModel`. The interface is in Brazilian Portuguese and uses a monochrome textured theme with restrained lime accents, with dark, light and system modes available.

![InvestorMe dark interface](assets/desktop-preview-dark.jpg)

![InvestorMe light interface](assets/desktop-preview-light.jpg)

### Run on Windows

Install Node.js 22 LTS or later, then run from the repository root:

```powershell
npm ci
npm start
```

InvestorMe opens as a desktop window with minimize, maximize/restore, and close controls. The minimum window size is 1024 × 700; 1480 × 960 or larger is recommended.

### What works in this preview

- Four main areas: Overview, Portfolio, Markets, and Laboratory. Portfolio and Laboratory use internal sections; alerts are opened from the bell and settings from the profile gear.
- Add, edit, and delete Brazilian equity positions; edit cash; calculate totals using the selected market-data provider (mock by default).
- Filter example assets, inspect details, manage a watchlist, and search pages/assets with `Ctrl+K`.
- Create/edit/delete strategies, change their local active/paused state, and configure position limits.
- Create/edit/delete model configurations and simulate the training flow.
- Configure backtest dates, validate date ranges, simulate the execution flow, and inspect experiment history.
- Configure risk limits and calculate a simplified uniform-price-drop scenario.
- Create/edit/delete alert rules, toggle them, filter unread rules, and mark all as read.
- Save a local display name, notification preferences, theme, and density.
- Persist the workspace locally, export it to JSON through a native save dialog, and restore the initial demo after confirmation.

Prices and market changes use **demonstrative data by default**. The optional Twelve Data provider can supply external quotes and daily OHLCV; access and freshness depend on the account and exchange. Charts remain illustrations, not financial outputs. Model training, backtesting, alert monitoring, brokerage connections, authentication, and live trading are **not implemented**. The active strategy switch only changes its saved local state. Exported JSON is a snapshot; importing is not implemented yet.

### Navigation and research workspace

| Main area | Frontend sections and purpose |
| --- | --- |
| Overview | Summary of portfolio, positions and research activity. |
| Portfolio | Summary, Positions, Performance, Income, Allocation and Risk. Existing demo positions and risk controls remain available. Income currently shows an explicit empty state; no income engine is implemented. |
| Markets | Asset filtering/provider search, quotes with timestamps, watchlist and daily history. |
| Laboratory | Strategies, Models, Scripts and Tests in one workspace. |

Alerts remain accessible from the bell in the header. Settings are available through the profile/gear at the bottom of the sidebar and through global search.

The Scripts section provides local file creation, editing, renaming, duplication and deletion. Python and JavaScript are metadata choices for the editor, **not execution environments**. Source text is saved automatically, survives navigation/reopening, and is included in workspace JSON exports. `Ctrl+S` also saves; Tab inserts four spaces. No source code is evaluated, imported, compiled or run.

Strategies can reference reusable models and associated scripts. The strategy details open linked models/scripts and filter the test history for that strategy. Models also show their linked scripts. New backtest records store the strategy ID; older records retain their name snapshot and are matched by name when available. These links organize the frontend only and do not run a research pipeline.

Canonical routes use `#lab/strategies`, `#lab/models`, `#lab/scripts`, `#lab/backtests`, and `#portfolio/risk` (with equivalent portfolio sections). Legacy `#strategies`, `#models`, `#backtests` and `#risk` links still resolve. Existing workspace and layout keys are preserved so earlier positions, models, strategies and panel arrangements continue to load.

### Customize a page

Click **Personalizar** in the page header. Drag a panel by its title (or use the arrow buttons) to reorder it; drag the bottom-right corner to resize it. The gear button edits its name, width, height and accent color. Use **Painéis** to show or hide existing panels, then **Concluir** to leave edit mode. **Restaurar padrão** resets only the current page layout, keeping portfolio and research data. Layouts are saved per page in the local workspace and included in JSON exports. On narrower windows, panels adapt to keep their contents accessible.

### Build for Windows

```powershell
npm run dist:win
```

The `release/` directory receives an NSIS installer and a portable executable. Builds are unsigned. The **Desktop preview** GitHub Actions workflow also runs the interaction tests and uploads `InvestorMe-Windows-x64` artifacts for successful builds; it does not publish a GitHub Release.

### Development and verification

```powershell
npm run check
npm test
npm run preview
```

Tests drive the actual Electron renderer with Playwright using an isolated temporary user profile. On Linux, they use Chromium's headless Ozone backend. A root test container additionally requires `--no-sandbox`; normal application startup never sets this flag. The browser preview is served only on `http://127.0.0.1:4173` and omits native window controls. Desktop and browser previews have separate local storage.

Source layout:

```text
desktop/       Electron main process, restricted preload bridge, preview server, app icon
ui/            Local HTML, CSS, JavaScript interface and demo workspace
core/          Independent financial domain and market-data service (native ES modules)
providers/     Deterministic mock and optional Twelve Data HTTP adapter
tests/         Core unit tests and Electron/browser interaction tests
scripts/       Cross-platform syntax validation
.github/       Test and Windows packaging workflow
```

The renderer runs with Node integration disabled, context isolation and sandbox enabled, a restrictive Content Security Policy, and no external navigation. The preload exposes window controls, validated JSON export and a limited, validated market-data IPC API. Network access and API keys remain in the main process.

---

## Financial core — technical stage 1

Implemented: independent `Asset`, `Quote`, `Candle`, `Position` and `Portfolio` models. The core imports no DOM, Electron, storage or UI APIs and can be consumed directly from Node or a browser through `core/index.mjs`.

| Layer | Responsibility |
| --- | --- |
| `core/market/` | Immutable asset identity and market metadata; timestamped quotes with derived changes; validated provider-independent OHLCV candles. |
| `core/portfolio/` | Immutable positions and portfolios; invested capital, market value, cash, equity, unrealized P/L and allocation. |
| `core/common/` | Domain errors, input validation and shared decimal arithmetic. |
| `ui/demo-market.mjs` | Compatibility re-export of `providers/mock-data.mjs`; fixtures now belong to the mock provider. |
| `ui/finance.mjs` | Converts legacy workspace records into domain objects and exposes a presentation facade for the current UI. |
| `ui/app.js` | Rendering, interactions, formatting and localStorage persistence. Basic portfolio calculations delegate to the core. |
| `desktop/` | Electron lifecycle, restricted native bridge and browser preview; no financial rules. |

**Module compatibility.** The core uses native `.mjs` ES modules, without a bundler, framework, dependencies or a repository-wide module conversion. The Electron process remains CommonJS. `ui/bootstrap.mjs` loads the financial adapter first, exposes one read-only `window.InvestorMeFinance` bridge, then loads the existing classic `app.js`. This preserves the shared lexical scope used by `research.js` and `layouts.js`. The core itself creates no globals. The preview serves only UI/core files with the correct module MIME type; packaging includes `core/**/*.mjs`. The existing CSP, renderer sandbox and disabled Node integration are unchanged.

**Domain contracts.** Assets require ID, symbol, exchange, name, currency and asset type; sector, market and country are optional. IDs distinguish exchanges; tickers alone are not portfolio quote keys. Asset types are extensible, including equities, ETFs and indices. Quotes accept epoch milliseconds or an ISO timestamp with a timezone and calculate changes from an optional previous close. Candles require a timestamp, interval and finite nonnegative OHLCV values, with coherent high/low bounds. Positions accept nonnegative quantities (including fractions) and average costs. Invalid inputs raise `DomainError`; validated objects and position arrays are immutable.

`Portfolio.evaluate(quotes)` accepts a `Map` keyed by asset ID. It returns invested capital, market value, total equity (positions plus cash), unrealized P/L and per-position results. Allocation is a percentage of total equity **including cash**; `investedAllocation` is the percentage of position market value **excluding cash**, preserving the existing risk-page convention. Empty portfolios return zero values and zero allocations. Unknown quotes produce `null` valuation-dependent results rather than pretending the asset is worth zero; zero-quantity positions are worth zero without a quote. Returns on a zero cost basis and changes against a zero previous close are `null` because the percentage is undefined.

**Currencies and precision.** Core models support currencies independently of market/country. Each portfolio currently accepts only positions in its base currency; mixing currencies throws an explicit conversion-required error. No FX rates are assumed. The UI retains its existing BRL-only portfolio and USD market examples. Addition, subtraction and multiplication use decimal representations with integer arithmetic internally, avoiding common artifacts such as `0.1 + 0.2` without rounding intermediate values to cents. Inputs/outputs remain JavaScript Numbers and percentages use floating-point division; this is not an arbitrary-precision accounting ledger. Overflow/underflow in the decimal operations is rejected. Only presentation formats values to two decimal places.

**Workspace compatibility.** No migration or reset is needed. The key `investorme.workspace.v1`, version `1`, `cash` and position records `{ id, ticker, quantity, cost }` remain unchanged, as do scripts, strategies, models, alerts, settings, layouts and JSON export. Domain objects are reconstructed in memory. Financial form submissions validate before saving. Invalid saved financial values surface an error with edit/delete/cash/export actions; they are not silently repaired, discarded or replaced by demo positions.

**Still demonstrative.** The default mock prices and previous closes are fictitious. Stage 2 below adds an optional external provider. Charts remain illustrations; the stress scenario is simple arithmetic, not a risk engine. Model training, backtests and alert monitoring remain simulated; scripts remain inert text. Indicators, historical persistence, real backtesting, machine learning and trading are not implemented.

`npm run check` validates all JavaScript source and test files. `npm test` runs the core calculations/validation tests plus all existing Electron tests and new compatibility, invalid-data recovery and browser-preview checks.

---

## Market data — technical stage 2

Market data is requested through `MarketDataService`, independently of vendors. Existing `Asset`, `Quote` and `Candle` classes are reused without changes.

| Component | Responsibility |
| --- | --- |
| `core/market-data/contract.mjs` | Async provider contract and bounded input/output validation. |
| `core/market-data/MarketDataService.mjs` | Provider-independent calls, batching cache misses, in-flight deduplication, deadlines, validation and rate-limit cooldown. |
| `core/market-data/MemoryCache.mjs` | Bounded in-memory TTL cache with an injectable clock. |
| `core/market-data/errors.mjs` | Safe typed errors that do not contain upstream payloads or secrets. |
| `providers/MockMarketDataProvider.mjs`, `mock-data.mjs` | Eight deterministic demo assets, quotes, search and synthetic weekday daily candles. |
| `providers/TwelveDataProvider.mjs`, `symbols.mjs`, `http.mjs` | Vendor-specific HTTP, symbol mapping and normalization. |
| `desktop/market-data.mjs` | Main-process provider configuration and validated IPC handler. |
| `ui/RemoteMarketDataProvider.mjs`, `finance.mjs` | Reconstruct Core objects after IPC and expose a quote snapshot to the existing synchronous renderer. |

All four methods are asynchronous:

```js
import { MarketDataService } from './core/market-data/MarketDataService.mjs';
import { MockMarketDataProvider } from './providers/MockMarketDataProvider.mjs';

const marketData = new MarketDataService(new MockMarketDataProvider());
const [asset] = await marketData.searchAssets('PETR4'); // Asset[]
const quote = await marketData.getQuote(asset); // Quote
const quotes = await marketData.getQuotes([asset]); // Map<asset.id, Quote>
const candles = await marketData.getHistory(asset, {
  timeframe: '1d', start: '2025-01-01', end: '2025-01-31',
}); // Candle[], chronological
```

**Provider contract.** Quote batches are atomic: missing/invalid entries reject explicitly rather than silently dropping assets. The UI requests separate batches by exchange so a B3 entitlement failure does not discard available US quotes. Batches are bounded to 50 assets. Quote timestamps originate from the provider, never the request completion time. History currently supports **daily bars only**, inclusive ISO session dates, and a maximum span of 366 days. Daily candles encode the exchange session date at `00:00:00Z` for stable date identity; that value is **not an assertion that the exchange opens at midnight UTC**. Intraday timeframes reject with `UNSUPPORTED`. Missing volume, impossible OHLC and duplicate dates reject; no fabricated volume or silently truncated multi-year history. Mock weekdays are synthetic, not an exchange holiday calendar.

**Symbol mapping.** Only the provider knows that `Asset(symbol='PETR4', exchange='B3')` becomes `PETR4:Bovespa`, while `AAPL` on `NASDAQ` becomes `AAPL:NASDAQ`. Search results map back to IDs such as `B3:PETR4`. The Twelve adapter supports the B3/Bovespa, NASDAQ and NYSE mappings and common/preferred equities, ETFs and indices when their required fields are available. Other exchanges/types are excluded from search. No `.SA` suffix or API-specific identifier enters the Core/UI. The existing workspace uses one position/watchlist entry per ticker, so the UI retains the first exchange for cross-listed tickers; the Core/service still use exchange-qualified IDs. Discovered asset metadata is saved in an optional `marketAssets` field (maximum 100 catalog entries); prices, secrets and historical series are never persisted. Existing version-1 workspaces need no migration.

**Why Twelve Data.** It documents quote batching, search and OHLCV for US equities and B3, allowing one adapter instead of scraping. It is optional and requires a user-supplied key with suitable entitlements. Its B3 listing specifies **EOD (end of day), Grow+/Venture+**; this project does not claim free B3 coverage. US feed coverage and access depend on the subscription. No exact 15-minute delay or real-time guarantee is invented. The UI labels the source, shows quote timestamps, marks quotes older than 60 seconds, and displays the oldest loaded timestamp. That age marker is not a market-open detector or a guarantee of freshness for newer quotes.

Official documentation reviewed for this implementation:

- [API endpoints and schemas](https://twelvedata.com/docs)
- [Batch API requests](https://support.twelvedata.com/en/articles/5203360-batch-api-requests)
- [B3 coverage and EOD delay](https://twelvedata.com/exchanges/bvmf)
- [US equity feed coverage](https://support.twelvedata.com/en/articles/9935903-us-equities-market-data)
- [API credits](https://support.twelvedata.com/en/articles/5615854-credits) and [current plans](https://twelvedata.com/pricing)
- [Terms of Use](https://twelvedata.com/terms): account eligibility, permitted use, free-tier non-commercial restrictions and additional permissions for redistribution/external display apply. Shipping this adapter grants no data redistribution license.

The Basic plan documentation lists 800 daily credits; minute budgets depend on the plan. Batching reduces HTTP calls but **still consumes credits per instrument**. Check current endpoint weights and account limits before enabling the provider; no automatic polling is enabled.

### Configuration

The default is offline mock, requiring no account or API key:

```powershell
$env:MARKET_DATA_PROVIDER = "mock"
npm start
```

Optional external data in Electron:

```powershell
$env:MARKET_DATA_PROVIDER = "twelve"
$env:TWELVE_DATA_API_KEY = "YOUR_PERSONAL_KEY"
$env:MARKET_DATA_DEBUG = "1" # optional safe development logs
npm start
```

On bash/zsh, set the same names with `export` before `npm start`. `.env.example` documents the names; `.env` files are ignored by Git and **are not automatically loaded**. Set variables in the launching process. A missing key or unknown provider selects mock with an explicit visible notice. An invalid key, insufficient plan, offline network or runtime provider failure does **not** silently switch an active external session to mock. Existing quote snapshots stay visible with their original timestamps and a failure notice; unavailable values display `—`. Restart after changing provider configuration. Browser `npm run preview` is intentionally mock-only and never receives credentials.

### Cache, errors and security

- TTLs: quotes **60 seconds**, search **5 minutes**, history **5 minutes**. Each service has a maximum of 256 cache entries. Concurrent overlapping quote requests share pending entries, and only uncached assets go to the provider batch. Failed calls are not cached. The main service is authoritative; the renderer has a separate in-memory cache to avoid redundant IPC. Refresh respects TTLs and does not bypass quota cooldowns. Nothing survives process exit.
- HTTP timeout: **8 seconds per attempt**, including the body. At most one retry, after 300 ms, for network/server failures. No automatic retry for timeout, auth, invalid symbols or 429. Service calls have an **18-second deadline** and cancellation signal even if a provider stalls. A 429 triggers at least 60 seconds of service cooldown, respecting longer `Retry-After` values up to 24 hours.
- Errors: `NO_NETWORK`, `RATE_LIMIT`, `INVALID_SYMBOL`, `AUTH_ERROR`, `PROVIDER_ERROR`, `TIMEOUT`, plus `INVALID_REQUEST`, `INVALID_RESPONSE` and `UNSUPPORTED`. Upstream messages are never forwarded to the renderer or logs.
- `MARKET_DATA_DEBUG=1` logs selected provider, operation, normalized status and duration in the main process. It logs no key, headers, full URLs, response payloads or raw exceptions. No analytics service is used.
- The only external host is `https://api.twelvedata.com`; only `/quote`, `/time_series` and `/symbol_search` are allowed. Keys use the Authorization header; redirects are rejected. No renderer-selected URL or credential parameter exists.
- Preload exposes only `desktop.market.info/getQuote/getQuotes/getHistory/searchAssets`. The main handler validates sender window, top frame, local app URL, method, argument counts, asset fields, query length, history ranges and batch sizes, and bounds concurrent IPC calls. `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` and `connect-src 'none'` remain unchanged. Browser preview does not serve the real provider, HTTP module, desktop backend or environment files.

### UI and verification

Markets uses the service's quote snapshot. Typing filters the loaded catalog locally; **Consultar provedor** performs provider search and saves discovered metadata. **Atualizar cotações** refreshes quotes subject to cache/limits. Asset details expose **Histórico diário** for the last 30 days. Portfolio valuation uses the same quote snapshot and the existing Core. BRL-only portfolio accounting is unchanged; no FX conversion was added. Charts, backtests, models, alerts and script execution remain illustrative or simulated as before.

`npm run check` covers the new modules. `npm test` exercises the contract, deterministic mock, symbol mapping, batch calls, cache expiration/coalescing, errors/timeouts/retries, configuration, IPC validation, secret-safe logs and the UI. Real-provider tests use injected HTTP fixtures; they make no internet calls and need no key. No authenticated live-provider smoke test was performed during implementation, so account entitlements and live response availability remain unverified. Windows packaging includes the new modules; a Windows binary was not built locally.

No SQLite, persistent historical storage, indicators, strategy engine, real backtesting, ML, brokers, orders or stage-3 features are introduced.

---

## Vision

Most investment tools specialize in only one part of the workflow: charting, portfolio tracking, screening, backtesting, or quantitative research.

InvestorMe aims to bring these workflows together into one programmable platform:

- Portfolio and cash tracking
- Market monitoring
- Custom screeners
- Technical and fundamental analysis
- Strategy creation
- Backtesting
- Alerts
- Risk analysis
- Machine learning
- Probabilistic predictions
- Paper trading
- Scriptable extensions
- Model and strategy versioning

The long-term goal is to create an **investment operating system** that can be used at different levels of complexity, from visual configuration to custom quantitative scripts.

---

## Core concepts

### 1. Probabilities instead of promises

InvestorMe should avoid deterministic claims such as:

```text
PETR4 will reach R$ 42.00 next week.
```

Models should instead produce measurable probabilistic outputs such as:

```text
Asset: PETR4
Horizon: 7 days

P(return > +5%)       61.4%
P(return < -5%)       18.7%
P(neutral range)      19.9%

Model confidence      Moderate
```

Predictions are estimates produced from historical data and model assumptions. They are never guarantees.

---

### 2. Highly customizable strategies

Users should be able to combine market data, indicators, fundamentals, risk rules, and machine-learning predictions into custom strategies.

Example:

```text
Strategy: Brazilian Value Momentum

Universe:
B3 equities

Entry conditions:
P/E < 8
ROE > 15%
Debt / EBITDA < 2
RSI < 40
Price < estimated fair value

Risk:
Maximum 5% of portfolio per company

Evaluation interval:
1 hour
```

The same concepts should eventually be available through both a graphical strategy builder and scripts.

---

### 3. Scriptable investment engine

Advanced users should be able to extend InvestorMe through a controlled scripting API.

A future script system may expose hooks such as:

```text
on_market_data()
on_feature_calculation()
on_before_training()
on_after_training()
on_prediction()
on_signal()
on_risk_calculation()
on_portfolio_update()
```

Example concept:

```python
@investorme.on_prediction
def adjust_prediction(prediction, asset):
    if asset.market_volatility > 0.35:
        prediction.confidence *= 0.70

    if asset.earnings_in_days < 3:
        prediction.risk *= 1.40

    return prediction
```

Scripts that interact with external systems or live brokerage accounts should use an explicit permission model.

---

## Planned architecture

```text
                      InvestorMe
                          |
        +-----------------+-----------------+
        |                 |                 |
   Market Data        Portfolio         Research
        |                 |                 |
        v                 v                 v
   Data Engine       Portfolio Engine   Feature Engine
        |                                   |
        +----------------+------------------+
                         |
                         v
                     ML Engine
                         |
                         v
                 Probability Engine
                         |
                         v
                     Risk Engine
                         |
                         v
                  Strategy Engine
                         |
            +------------+------------+
            |            |            |
          Alerts      Backtests    Paper Trading
```

The components should remain modular so that individual data providers, models, strategies, and execution systems can be replaced without redesigning the entire application.

---

## Machine learning

Machine learning is intended to be a major part of InvestorMe, but not a black-box replacement for investment research.

Possible supported model families include:

- Logistic regression
- Random forests
- Gradient boosting
- XGBoost / LightGBM
- Neural networks
- Time-series models
- Ensembles
- User-defined models

Instead of having one universal model for every asset, InvestorMe may support specialized models by sector, asset class, market regime, or investment horizon.

For example:

```text
PETR4  -> Commodity / Energy model
ITUB4  -> Financial model
WEGE3  -> Industrial Growth model
NVDA   -> Technology Growth model
```

A meta-model or ensemble can then combine multiple specialized signals.

---

## Prediction targets

Price prediction does not need to be the only objective.

InvestorMe should support targets such as:

- Probability of a return above a threshold
- Probability of a drawdown
- Probability of outperforming a benchmark
- Expected volatility
- Trend or regime classification
- Earnings surprise probability
- Breakout probability
- Risk-adjusted expected return

Examples:

```text
P(return > 3% in 7 days)
P(return > 10% in 90 days)
P(drawdown > 10%)
P(outperforming IBOV in 30 days)
P(volatility increasing)
```

This allows models to answer narrow, testable questions instead of attempting to predict a single exact future price.

---

## Feature engine

Models may combine different categories of information.

### Market data

- Open, high, low, close
- Volume
- Returns
- Volatility
- Liquidity
- Order-flow data where available

### Technical indicators

- RSI
- Moving averages
- MACD
- ATR
- Momentum
- Bollinger Bands
- User-defined indicators

### Fundamentals

- Revenue
- Earnings
- Free cash flow
- ROE
- Margins
- P/E
- P/B
- EV/EBITDA
- Debt ratios

### Macroeconomic data

- Interest rates
- Inflation
- Currency rates
- Commodity prices
- Yield curves
- Relevant economic indicators

### Alternative data

Future versions may support additional datasets such as news sentiment or other legally obtainable alternative data.

---

## Portfolio tracking

InvestorMe is intended to provide portfolio-level context instead of analyzing each asset in isolation.

Planned portfolio information includes:

- Current positions
- Average purchase price
- Realized profit/loss
- Unrealized profit/loss
- Cash balance
- Dividends
- Allocation by asset
- Allocation by sector
- Exposure by currency
- Historical portfolio value
- Risk contribution
- Benchmark comparison

Example:

```text
Portfolio

Invested                 R$ 48,920
Available cash            R$ 8,400
Total                    R$ 57,320

Accumulated profit        R$ 6,140
12-month dividends        R$ 2,310
```

---

## Strategy engine

Strategies should be able to combine deterministic rules with probabilistic model outputs.

Example:

```text
BUY when:

Fundamental score > 70
AND momentum score > 65
AND model P(return > 5%) > 60%
AND expected drawdown < 12%
AND portfolio exposure remains within risk limits
```

The engine should also support exit rules, rebalancing rules, position sizing, and portfolio-level constraints.

---

## Risk engine

Risk management should be treated as a first-class component.

Possible metrics and controls include:

- Maximum drawdown
- Volatility
- Value at Risk
- Conditional Value at Risk
- Sharpe ratio
- Sortino ratio
- Beta
- Correlation
- Exposure limits
- Position-size limits
- Sector concentration
- Portfolio concentration
- Stop conditions

A strategy with strong historical returns but unacceptable risk should not be presented as superior simply because of its raw return.

---

## Validation

InvestorMe is designed to treat market predictions as probabilistic signals rather than guaranteed outcomes. Every model or strategy should be validated before it is used for investment decisions.

The validation pipeline should include:

- **Train / validation / test separation** using chronological market data
- **Out-of-sample testing** so models are evaluated on periods they have never seen during training
- **Walk-forward validation** to simulate how a model behaves as new market data becomes available
- **Data leakage checks** to ensure future information is never used to predict the past
- **Benchmark comparison** against simple baselines and relevant market indexes
- **Risk metrics** such as maximum drawdown, volatility, Sharpe ratio, win rate, and profit factor
- **Paper trading** before any strategy is considered for live execution

Example:

```text
TRAIN
2012 ---------------- 2020

VALIDATION
2021 ------ 2023

OUT-OF-SAMPLE TEST
2024 ------ 2026
```

Walk-forward testing:

```text
Train 2014-2018 -> Test 2019
Train 2015-2019 -> Test 2020
Train 2016-2020 -> Test 2021
...
```

Backtest performance alone is not considered sufficient evidence that a strategy will remain profitable in future market conditions.

---

## Preventing overfitting

Financial datasets contain large amounts of noise. A sufficiently flexible strategy can easily appear profitable historically while having no useful predictive power.

InvestorMe should therefore track:

- Number of strategy iterations
- In-sample vs out-of-sample performance
- Parameter sensitivity
- Feature importance stability
- Model calibration
- Performance across different market regimes
- Transaction costs
- Slippage
- Survivorship bias
- Look-ahead bias

Datasets, models, strategy configurations, and validation results should be reproducible whenever possible.

---

## Model Lab

A future **Model Lab** should make it possible to train and compare different models under the same dataset and validation conditions.

Example:

```text
Model Lab
Strategy: Brazilian Value Momentum v12

XGBoost                 61.8%
Random Forest           58.4%
Neural Network          60.1%
Logistic Regression     55.3%
Ensemble                64.7%

Sharpe                    1.42
Max Drawdown            -13.8%
Win Rate                 57.2%
Profit Factor             1.61
```

Metrics must always be interpreted in the context of the dataset, test period, transaction costs, and validation methodology.

---

## Versioning

Strategies and models should be versioned so experiments remain reproducible.

Example:

```text
Strategy v18

Changes:
+ Added earnings momentum
+ Added volatility regime filter
- Removed MACD
~ RSI period changed from 14 to 21

Out-of-sample Sharpe:
v17: 1.31
v18: 1.44
```

A future versioning system may track:

- Source code
- Parameters
- Feature definitions
- Dataset versions
- Training period
- Model artifacts
- Validation results
- Backtest results

---

## Automation and monitoring

InvestorMe should eventually be able to evaluate strategies automatically on configurable intervals.

Examples:

```text
Every hour
Every trading session
At candle close
After financial results
After portfolio changes
```

When conditions are satisfied, the platform may generate alerts rather than automatically execute trades by default.

Possible notification channels may include:

- In-app notifications
- Email
- Webhooks
- External integrations

---

## Research, paper trading, and live execution

The project should separate environments with different levels of risk.

```text
Research
   |
   v
Backtesting
   |
   v
Paper Trading
   |
   v
Live Trading
```

Live execution, if implemented, should require explicit configuration and permissions.

A script that can read market data should not automatically receive permission to:

- Access arbitrary files
- Access the internet
- Read credentials
- Connect to a broker
- Submit orders

---

## Script permissions

A future permissions system may look like:

```text
Script permissions

[x] Market data
[x] Technical indicators
[x] Fundamentals
[x] ML models

[ ] Internet access
[ ] File-system access
[ ] Broker API
[ ] Execute trades
```

This design reduces the risk of third-party extensions accessing sensitive resources without the user's knowledge.

---

## Possible project structure

The repository is currently at an early stage. A possible future structure is:

```text
InvestorMe/
|
+-- apps/
|   +-- desktop/
|   +-- web/
|
+-- core/
|   +-- market/
|   +-- portfolio/
|   +-- strategy/
|   +-- risk/
|   +-- backtest/
|
+-- ml/
|   +-- features/
|   +-- models/
|   +-- training/
|   +-- validation/
|
+-- scripting/
|   +-- api/
|   +-- sandbox/
|   +-- permissions/
|
+-- integrations/
|   +-- data-providers/
|   +-- brokers/
|   +-- notifications/
|
+-- tests/
+-- docs/
+-- README.md
```

This layout is only a proposal and may change as the implementation evolves.

---

## Development principles

InvestorMe should prioritize:

1. **Reproducibility** — experiments must be repeatable.
2. **Transparency** — predictions should expose assumptions and relevant metrics.
3. **Modularity** — data sources, models, and strategies should be replaceable.
4. **Safety** — research and execution environments must remain separated.
5. **Validation** — models must be evaluated on unseen data.
6. **Extensibility** — advanced users should be able to build custom tools.
7. **Risk awareness** — expected return should never be shown without risk context.

---

## Roadmap

The roadmap will evolve with the project, but a possible development order is:

### Phase 1 - Foundation

- [ ] Project architecture
- [x] Market-data abstraction
- [ ] Local data storage
- [x] Basic asset model
- [x] Portfolio model
- [ ] Technical indicators

### Phase 2 - Research

- [ ] Screener
- [ ] Strategy engine
- [ ] Backtesting engine
- [ ] Benchmark comparison
- [ ] Risk metrics
- [ ] Results dashboard

### Phase 3 - Machine learning

- [ ] Feature engine
- [ ] Dataset builder
- [ ] Training pipeline
- [ ] Model registry
- [ ] Walk-forward validation
- [ ] Probability calibration
- [ ] Model comparison

### Phase 4 - Automation

- [ ] Scheduled strategy evaluation
- [ ] Alerts
- [ ] Paper trading
- [ ] Portfolio monitoring

### Phase 5 - Extensibility

- [ ] Script API
- [ ] Sandboxed execution
- [ ] Script permissions
- [ ] Strategy/model versioning
- [ ] Plugin architecture

### Phase 6 - Integrations

- [ ] External market-data providers
- [ ] Notification providers
- [ ] Broker integrations
- [ ] Optional live execution safeguards

---

## Example future workflow

```text
1. User selects a market universe
               |
               v
2. InvestorMe collects historical data
               |
               v
3. Feature engine builds datasets
               |
               v
4. Models are trained
               |
               v
5. Walk-forward validation is executed
               |
               v
6. Strategy is backtested with costs
               |
               v
7. Strategy moves to paper trading
               |
               v
8. Signals are monitored in real time
```

A model should not skip directly from training to live capital.

---

## Disclaimer

InvestorMe is an experimental software project for research, education, portfolio analysis, and quantitative experimentation.

Nothing produced by InvestorMe should be interpreted as guaranteed investment performance or certainty about future market behavior.

Financial markets involve substantial risk. Historical performance, backtests, statistical relationships, machine-learning outputs, and simulated results do not guarantee future returns.

Anyone using the software is responsible for independently evaluating investment decisions and applicable legal, regulatory, tax, and brokerage requirements.

---

## Status

**Early development / research stage.**

The repository contains a functional desktop UI with local demo data and an independent basic financial core for assets, quotes, candles, positions and portfolio valuation. Market data now has a deterministic mock and an optional Twelve Data adapter. The research, machine-learning and trading engines described in this roadmap are not implemented. APIs and architecture may change as development progresses.

---

## Contributing

Contribution guidelines will be added as the project becomes ready for external contributions.

For now, ideas, experiments, architecture discussions, quantitative methods, validation techniques, and risk-management approaches are welcome as the project evolves.

---

## License

No license has been defined yet.

Until a license is explicitly added to the repository, standard copyright rules apply.
