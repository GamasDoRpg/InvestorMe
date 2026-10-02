# Market data and account connections

[Documentation index](../README.md) · [User guide](USER_GUIDE.md) · [Architecture](ARCHITECTURE.md)

Implementation reviewed on 2026-10-02. Provider integrations exist; live access and entitlement are account-dependent.

Market data is requested through `MarketDataService`, independently of vendors. Existing `Asset`, `Quote` and `Candle` classes are reused without changes.

| Component | Responsibility |
| --- | --- |
| `core/market-data/contract.mjs` | Async provider contract and bounded input/output validation. |
| `core/market-data/MarketDataService.mjs` | Provider-independent calls, batching cache misses, in-flight deduplication, deadlines, validation and rate-limit cooldown. |
| `core/market-data/MemoryCache.mjs` | Bounded in-memory TTL cache with an injectable clock. |
| `core/market-data/errors.mjs` | Safe typed errors that do not contain upstream payloads or secrets. |
| `providers/UnavailableMarketDataProvider.mjs` | Explicit unavailable state without fallback prices. Test-only fixtures live under `tests/fixtures/` and are not packaged. |
| `providers/TwelveDataProvider.mjs`, `symbols.mjs`, `http.mjs` | Vendor-specific HTTP, symbol mapping and normalization. |
| `providers/BrapiProvider.mjs` | B3 quotes/history via v2, search, free-plan serialization and normalization. |
| `providers/RoutedMarketDataProvider.mjs` | Routes Brazil to brapi and US to Twelve Data with independent services. |
| `desktop/market-data.mjs` | Main-process provider configuration and validated IPC handler. |
| `ui/RemoteMarketDataProvider.mjs`, `finance.mjs` | Reconstruct Core objects after IPC and expose a quote snapshot to the existing synchronous renderer. |

All four methods are asynchronous. Example for a trusted Node ES module in the repository root (requires a real key, network access and account entitlement):

```js
import { MarketDataService } from './core/market-data/MarketDataService.mjs';
import { TwelveDataProvider } from './providers/TwelveDataProvider.mjs';

const marketData = new MarketDataService(new TwelveDataProvider({ apiKey: process.env.TWELVE_DATA_API_KEY }));
const [asset] = await marketData.searchAssets('AAPL'); // Asset[] — run in a trusted Node process
if (!asset) throw new Error('No supported asset found');
const quote = await marketData.getQuote(asset); // Quote
const quotes = await marketData.getQuotes([asset]); // Map<asset.id, Quote>
const candles = await marketData.getHistory(asset, {
  timeframe: '1d', start: '2025-01-01', end: '2025-01-31',
}); // Candle[], chronological
```

**Provider contract.** Quote batches are atomic: missing/invalid entries reject explicitly rather than silently dropping assets. The UI requests separate batches by exchange so a B3 entitlement failure does not discard available US quotes. Batches are bounded to 50 assets. Quote timestamps originate from the provider, never the request completion time. History currently supports **daily bars only**, inclusive ISO session dates, and a maximum span of 366 days. Twelve daily candles encode the exchange session date at `00:00:00Z` for stable date identity; that value is **not an assertion that the exchange opens at midnight UTC**. Intraday timeframes reject with `UNSUPPORTED`. Missing volume, impossible OHLC and duplicate dates reject; no fabricated volume or silently truncated multi-year history.

**Symbol mapping.** Only the provider knows that `Asset(symbol='PETR4', exchange='B3')` becomes `PETR4:Bovespa`, while `AAPL` on `NASDAQ` becomes `AAPL:NASDAQ`. Search results map back to IDs such as `B3:PETR4`. The Twelve adapter supports the B3/Bovespa, NASDAQ and NYSE mappings and common/preferred equities, ETFs and indices when their required fields are available. Other exchanges/types are excluded from search. No `.SA` suffix or API-specific identifier enters the Core/UI. The existing workspace uses one position/watchlist entry per ticker, so the UI retains the first exchange for cross-listed tickers; the Core/service still use exchange-qualified IDs. Discovered asset metadata is saved in an optional `marketAssets` field (maximum 100 catalog entries); prices and historical series are not persisted in the workspace; credentials are stored separately as described below. The compatible workspace migration is described in [Architecture](ARCHITECTURE.md#storage-boundaries).

**Why Twelve Data.** It documents quote batching, search and OHLCV for US equities and B3, allowing one adapter instead of scraping. It is optional and requires a user-supplied key with suitable entitlements. The app labels its B3 feed as end-of-day; B3 access requires the corresponding provider entitlement. Do not assume that a free Twelve Data key enables B3. The separate brapi adapter below offers a free option. US feed coverage and access depend on the subscription. No exact 15-minute delay or real-time guarantee is invented. The UI labels the source, shows quote timestamps, marks quotes older than 60 seconds, and displays the oldest loaded timestamp. That age marker is not a market-open detector or a guarantee of freshness for newer quotes.

Official provider references (commercial terms and availability can change):

- [API endpoints and schemas](https://twelvedata.com/docs)
- [Batch API requests](https://support.twelvedata.com/en/articles/5203360-batch-api-requests)
- [B3 coverage and EOD delay](https://twelvedata.com/exchanges/bvmf)
- [US equity feed coverage](https://support.twelvedata.com/en/articles/9935903-us-equities-market-data)
- [API credits](https://support.twelvedata.com/en/articles/5615854-credits) and [current plans](https://twelvedata.com/pricing)
- [Terms of Use](https://twelvedata.com/terms): account eligibility, permitted use, permitted uses and redistribution/external display conditions depend on the applicable terms. Shipping this adapter grants no data redistribution license.

Batching reduces HTTP calls but does not imply one credit for an entire batch. Consult the provider dashboard and current documentation for endpoint weights, per-minute/daily quotas, prices and allowed use. These commercial limits are not defined by InvestorMe. There is no periodic polling; startup, saving connection settings and user actions can request data.

### Configuration

Use the desktop app; no terminal configuration is required:

1. Open the profile gear → **Conta e configurações** → **Conexões de mercado**.
2. Select **Brasil: brapi · EUA: Twelve Data** (or one provider).
3. Paste your personal brapi and Twelve Data API keys and click **Salvar e conectar**.
4. Use **Testar conexão salva** for each provider to check authentication and a quote (PETR4/AAPL). A saved key alone does not confirm access.
5. Open Markets and use **Atualizar cotações** as needed. Access, timestamps and quotas depend on your accounts.

Saving changes providers immediately and clears previous connection caches; no restart is needed. Blank key fields preserve saved keys. **Remover chave** clears one credential; **Desconectar** stops normal quote queries and clears displayed quotes while retaining credentials for later use. A failed refresh removes affected prices; totals depending on those prices become unavailable. No mock fallback exists, even for missing keys or an unsupported provider setting.

`desktop/connections.mjs` stores credentials outside the workspace, encrypted through Electron `safeStorage` in the OS user-data directory. Status IPC returns key-presence flags and connection/storage metadata; saved secrets are never returned to the renderer, placed in localStorage, or included in JSON exports. Password inputs are cleared on submission. On Linux, the insecure `basic_text` backend is refused: without OS encryption, keys are session-only and the UI explains that they must be entered again after restarting. Corrupt/locked credential files are left intact until an explicit save replaces them.

Optional environment variables (`MARKET_DATA_PROVIDER=disabled|brapi|twelve|combined`, `BRAPI_API_KEY`, `TWELVE_DATA_API_KEY`, `MARKET_DATA_DEBUG`) configure a first launch when no saved connection file exists. Saved account settings take precedence. `.env.example` documents them; `.env` files are ignored and not automatically loaded. Browser `npm run preview` remains disconnected and cannot configure or query providers.

### Free Brazilian data with brapi

In first-launch environment configuration, use `MARKET_DATA_PROVIDER=brapi` for Brazilian stocks only, or `combined` to route B3 to brapi and NASDAQ/NYSE to Twelve Data. The default is disconnected; no mode substitutes fictitious prices for unavailable assets.

```powershell
$env:MARKET_DATA_PROVIDER = "combined"
$env:BRAPI_API_KEY = "YOUR_FREE_BRAPI_TOKEN"
$env:TWELVE_DATA_API_KEY = "YOUR_FREE_TWELVE_KEY"
npm start
```

On first launch without saved settings, for a keyless B3 trial set `MARKET_DATA_PROVIDER=brapi` and leave `BRAPI_API_KEY` unset. Only **PETR4, VALE3, ITUB4 and MGLU3** are eligible without a token. Existing unsupported holdings remain saved; their quotes show unavailable, not demo values. A brapi account/token can enable additional stocks according to the account entitlement. Missing US credentials disable US queries explicitly without preventing B3 access. Search without a brapi token can discover assets that require a token for quotes.

The adapter deliberately sends one ticker per call and serializes brapi HTTP requests. The UI currently describes the free B3 feed as approximately 30 minutes delayed; that label is not a measured freshness guarantee. Check the provider dashboard and official limits for current quotas, history allowance and plan access. InvestorMe does not track your remaining credits. It uses 60-second quote/5-minute history/search caches and no periodic polling. UI B3 refreshes handle assets individually, so a token-only asset failure does not discard quotes that succeeded. Each market has an independent quote service/cache/cooldown; a B3 429 does not block US quotes. Combined provider search is atomic and reports a provider failure explicitly.

Only the adapter knows brapi symbols (`PETR4`); Core identities remain `B3:PETR4`. Search currently supports equities/units and ETFs; FIIs, BDRs, indices and other asset types are excluded. Quote timestamps come from `regularMarketTime`; the request timestamp is never used as quote freshness. Changed/renamed symbols are rejected instead of silently changing portfolio identity. Daily candles retain the provider's Unix timestamp and reported OHLCV; null fields and impossible bars are rejected. The provider may supply adjusted OHLC prices; this adapter does not claim a raw/unadjusted or uniform adjustment policy. History outside the account allowance returns an explicit error (HTTP 400 → `INVALID_REQUEST`, 403 → `AUTH_ERROR`), never silently truncates.

Saved tokens are decrypted only in the main process and sent in Authorization headers. `.env` is not auto-loaded. The Windows packaging configuration includes all provider modules. No account signup or paid subscription is performed by the app.

Official references: [authentication](https://brapi.dev/docs/authentication), [API schemas](https://brapi.dev/openapi.json), [daily history](https://brapi.dev/docs/acoes/historico), [free access](https://brapi.dev/faq/api-e-gratis-mesmo), [limits](https://brapi.dev/faq/quais-as-limitacoes), [terms](https://brapi.dev/termos-de-uso). Data access remains subject to the provider's terms and plan; this integration does not grant redistribution rights.

Validation uses HTTP fixtures for brapi and Electron tests for keyless partial availability. A keyless PETR4 smoke request was attempted; this environment returned `NO_NETWORK`. Live availability and account entitlements have not been confirmed here.

### Cache, errors and security

- TTLs: quotes **60 seconds**, search **5 minutes**, history **5 minutes**. Each service has a maximum of 256 cache entries. Concurrent overlapping quote requests share pending entries, and only uncached assets go to the provider batch. Failed calls are not cached. The main service is authoritative; the renderer has a separate in-memory cache to avoid redundant IPC. Refresh respects TTLs and does not bypass quota cooldowns. Nothing survives process exit.
- HTTP timeout: **8 seconds per attempt**, including the body. At most one retry, after 300 ms, for network/server failures. No automatic retry for timeout, auth, invalid symbols or 429. Service calls have an **18-second deadline** and cancellation signal even if a provider stalls. A 429 triggers at least 60 seconds of service cooldown, respecting longer `Retry-After` values up to 24 hours.
- Errors: `NO_NETWORK`, `RATE_LIMIT`, `INVALID_SYMBOL`, `AUTH_ERROR`, `PROVIDER_ERROR`, `TIMEOUT`, plus `INVALID_REQUEST`, `INVALID_RESPONSE` and `UNSUPPORTED`. Upstream messages are never forwarded to the renderer or logs.
- `MARKET_DATA_DEBUG=1` logs selected provider, operation, normalized status and duration in the main process. It logs no key, headers, full URLs, response payloads or raw exceptions. No analytics service is used.
- Allowed external hosts/endpoints are fixed: `https://api.twelvedata.com` (`/quote`, `/time_series`, `/symbol_search`) and `https://brapi.dev` (`/api/v2/stocks/quote`, `/api/v2/stocks/historical`, `/api/quote/list`). Keys use the Authorization header; redirects are rejected. No renderer-selected URL exists; credential updates use a separate restricted IPC endpoint.
- Preload exposes `desktop.market.info/getQuote/getQuotes/getHistory/searchAssets` and `desktop.connections.status/save/test`. The main handler validates sender window, top frame, local app URL, method, argument counts, asset fields, query length, history ranges and batch sizes, and bounds concurrent IPC calls. `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` and `connect-src 'none'` remain unchanged. Browser preview does not serve the real provider, HTTP module, desktop backend or environment files.

### UI and verification

Markets uses the service's quote snapshot. Typing filters the loaded catalog locally; **Consultar provedor** performs provider search and saves discovered metadata. **Atualizar cotações** refreshes quotes subject to cache/limits. Asset details expose **Histórico diário** for the last 30 days. Portfolio valuation uses the same quote snapshot and the existing Core. BRL-only portfolio accounting is unchanged; no FX conversion was added. Unavailable charts show an empty state. Backtests and models store configurations only; alert monitoring and script execution remain unimplemented.

`npm run check` covers the new modules. `npm test` exercises the contract, deterministic mock, symbol mapping, batch calls, cache expiration/coalescing, errors/timeouts/retries, configuration, IPC validation, secret-safe logs and the UI. Real-provider tests use injected HTTP fixtures; they make no internet calls and need no key. Automated tests do not prove authenticated live-provider access; use the account connection test with your own keys to verify your entitlement. Windows packaging includes the new modules; a Windows binary was not built locally.

No SQLite, persistent historical storage, indicators, strategy engine, real backtesting, ML, brokers, orders or stage-3 features are introduced.

## Configuration precedence

The normal desktop path is the account panel. At startup, an existing `market-connections.json` takes precedence over environment variables, including when its selected mode is `disabled`. An unreadable file reports a warning and leaves the connection disabled; it is not silently replaced by environment credentials.

When no saved file exists, `ConnectionStore` accepts an explicit supported mode. Without one, a Twelve Data key selects `combined`, a brapi-only key selects `brapi`, and no keys selects `disabled`. A direct call to `createMarketBackend()` itself defaults to disabled. `mock` is not an application provider mode.

The `.env.example` file is documentation only: there is no dotenv loader. Do not paste secrets into source files or commit a populated environment file. **Testar conexão salva** checks the stored credentials, not unsaved text in the inputs. A successful probe verifies one symbol at that time, not every endpoint or market. Saving and testing can consume API quota. Removing a brapi key can still leave keyless public symbols accessible until you disconnect.

## Unavailable data behavior

A missing quote displays `—`, not zero and not a generated value. Empty portfolios legitimately total zero; user-entered invested capital and cash remain known without market data. A failed refresh removes affected snapshots, and totals that depend on them become unavailable. Existing real responses may be reused within the cache TTL. Disconnecting clears quote snapshots immediately. A quote older than 60 seconds is marked as old; the app does not check exchange holidays or market-open status.

History is currently shown as daily OHLCV for the selected asset; portfolio performance charts remain unavailable. Unsupported instruments, missing fields and impossible candles are rejected rather than repaired using invented numbers.
