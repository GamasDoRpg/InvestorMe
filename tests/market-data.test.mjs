import { test } from "node:test";
import assert from "node:assert/strict";
import { Asset, Quote, Candle } from "../core/index.mjs";
import {
  MarketDataProvider,
  validateHistory,
} from "../core/market-data/contract.mjs";
import { MarketDataError } from "../core/market-data/errors.mjs";
import { MemoryCache } from "../core/market-data/MemoryCache.mjs";
import { MarketDataService } from "../core/market-data/MarketDataService.mjs";
import { MockMarketDataProvider } from "../providers/MockMarketDataProvider.mjs";
import { TwelveDataProvider } from "../providers/TwelveDataProvider.mjs";
import { TwelveHttpClient } from "../providers/http.mjs";
import { twelveSymbol, twelveAsset } from "../providers/symbols.mjs";
import { demoMarket } from "../providers/mock-data.mjs";
import {
  createMarketBackend,
  createMarketHandler,
} from "../desktop/market-data.mjs";
import { RemoteMarketDataProvider } from "../ui/RemoteMarketDataProvider.mjs";
const mock = new MockMarketDataProvider();
const aapl = demoMarket.find((row) => row.asset.symbol === "AAPL").asset;
const msft = demoMarket.find((row) => row.asset.symbol === "MSFT").asset;
const petr = demoMarket[0].asset;
const history = { timeframe: "1d", start: "2025-01-01", end: "2025-01-10" };
const fails = (promise, code) =>
  assert.rejects(
    promise,
    (error) => error instanceof MarketDataError && error.code === code,
  );
const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const wireQuote = (asset, extra = {}) => ({
  symbol: asset.symbol,
  exchange: asset.exchange === "B3" ? "Bovespa" : asset.exchange,
  currency: asset.currency,
  close: "22.50",
  previous_close: "20",
  timestamp: 1735848000,
  ...extra,
});
const provider = (fetchImpl) =>
  new TwelveDataProvider({
    apiKey: "unit-test-secret",
    fetchImpl,
    sleep: async () => {},
  });

test("Provider contract rejects unimplemented operations and validates requests", async () => {
  const abstract = new MarketDataProvider();
  for (const op of ["getQuote", "getQuotes", "getHistory", "searchAssets"])
    await fails(abstract[op](), "UNSUPPORTED");
  assert.throws(() => new MarketDataService({}), MarketDataError);
  const service = new MarketDataService(mock);
  await fails(service.getQuote({ ...aapl }), "INVALID_REQUEST");
  await fails(service.getQuotes(Array(51).fill(aapl)), "INVALID_REQUEST");
  await fails(service.searchAssets("x".repeat(81)), "INVALID_REQUEST");
  await fails(
    service.getHistory(aapl, { ...history, start: "2025-02-30" }),
    "INVALID_REQUEST",
  );
  await fails(
    service.getHistory(aapl, { ...history, timeframe: "1m" }),
    "UNSUPPORTED",
  );
  assert.throws(
    () => validateHistory({ ...history, start: "2023-01-01" }),
    MarketDataError,
  );
});
test("Mock quotes/search/history are deterministic Core objects for all eight assets", async () => {
  const all = await mock.searchAssets("");
  assert.deepEqual(all.map((a) => a.symbol).sort(), [
    "AAPL",
    "BBDC4",
    "ITUB4",
    "MSFT",
    "NVDA",
    "PETR4",
    "VALE3",
    "WEGE3",
  ]);
  assert.ok(all.every((a) => a instanceof Asset));
  assert.equal((await mock.searchAssets("NVIDIA"))[0].symbol, "NVDA");
  assert.equal((await mock.searchAssets("no such asset")).length, 0);
  const quotes = await mock.getQuotes(all);
  assert.equal(quotes.size, 8);
  for (const asset of all) {
    assert.ok(quotes.get(asset.id) instanceof Quote);
    assert.deepEqual(await mock.getQuote(asset), quotes.get(asset.id));
  }
  const candles = await mock.getHistory(petr, history);
  assert.ok(candles.length > 0 && candles.every((c) => c instanceof Candle));
  assert.deepEqual(await mock.getHistory(petr, history), candles);
  assert.ok(
    candles.every((c, i) => !i || c.timestamp > candles[i - 1].timestamp),
  );
  await fails(
    mock.getQuote(new Asset({ ...petr, id: "B3:UNKNOWN", symbol: "UNKNOWN" })),
    "INVALID_SYMBOL",
  );
  assert.deepEqual(await mock.getQuotes([]), new Map());
});
test("Provider symbol normalization preserves canonical exchange-qualified identities", () => {
  assert.equal(twelveSymbol(petr), "PETR4:Bovespa");
  assert.equal(twelveSymbol(aapl), "AAPL:NASDAQ");
  assert.equal(petr.symbol, "PETR4");
  const asset = twelveAsset({
    symbol: "PETR4",
    exchange: "Bovespa",
    currency: "BRL",
    instrument_name: "Petrobras",
    instrument_type: "Preferred Stock",
  });
  assert.equal(asset.id, "B3:PETR4");
  assert.equal(asset.symbol, "PETR4");
  assert.equal(twelveAsset({ exchange: "UNKNOWN" }), null);
  assert.throws(
    () => twelveSymbol(new Asset({ ...petr, exchange: "OTHER" })),
    /Ativo/,
  );
  assert.throws(
    () =>
      twelveAsset({
        symbol: "TEST",
        exchange: "NASDAQ",
        instrument_type: "Common Stock",
      }),
    /Resposta/,
  );
});
test("Memory cache expires deterministically, evicts bounded entries and clears", () => {
  let now = 100;
  const cache = new MemoryCache({ now: () => now, maxEntries: 2 });
  cache.set("a", 1, 10);
  assert.equal(cache.get("a"), 1);
  now = 110;
  assert.equal(cache.get("a"), undefined);
  cache.set("b", 2, 10);
  cache.set("c", 3, 10);
  cache.set("d", 4, 10);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("c"), 3);
  cache.clear();
  assert.equal(cache.get("c"), undefined);
});
test("Service batches cache misses and coalesces overlapping single/batch requests", async () => {
  let calls = 0,
    now = 0;
  const requested = [];
  class Counted extends MockMarketDataProvider {
    async getQuotes(assets) {
      calls++;
      requested.push(assets.map((a) => a.id));
      await Promise.resolve();
      return super.getQuotes(assets);
    }
  }
  const service = new MarketDataService(new Counted(), {
    now: () => now,
    cache: new MemoryCache({ now: () => now }),
    ttl: { quote: 10 },
  });
  const [single, batch] = await Promise.all([
    service.getQuote(aapl),
    service.getQuotes([aapl, msft, aapl]),
  ]);
  assert.equal(calls, 2);
  assert.deepEqual(requested, [[aapl.id], [msft.id]]);
  assert.equal(batch.get(aapl.id), single);
  batch.clear();
  assert.equal((await service.getQuotes([aapl, msft])).size, 2);
  assert.equal(calls, 2);
  now = 10;
  await service.getQuotes([aapl, msft]);
  assert.equal(calls, 3);
  assert.deepEqual(requested[2], [aapl.id, msft.id]);
});
test("Service independently caches search/history and never caches failures", async () => {
  let searches = 0,
    histories = 0,
    failed = true;
  class Counted extends MockMarketDataProvider {
    async searchAssets(q) {
      searches++;
      if (failed) {
        failed = false;
        throw new MarketDataError("NO_NETWORK");
      }
      return super.searchAssets(q);
    }
    async getHistory(...args) {
      histories++;
      return super.getHistory(...args);
    }
  }
  const service = new MarketDataService(new Counted());
  await fails(service.searchAssets("Apple"), "NO_NETWORK");
  const rows = await service.searchAssets("Apple");
  assert.throws(() => rows.push(aapl), TypeError);
  await service.searchAssets("APPLE");
  assert.equal(searches, 2);
  await service.getHistory(aapl, history);
  await service.getHistory(aapl, history);
  assert.equal(histories, 1);
  await service.getHistory(aapl, { ...history, end: "2025-01-09" });
  assert.equal(histories, 2);
});
test("Service enforces timeout for a provider ignoring cancellation", async () => {
  class Hung extends MockMarketDataProvider {
    async getQuotes() {
      return new Promise(() => {});
    }
  }
  await fails(
    new MarketDataService(new Hung(), { timeoutMs: 10 }).getQuote(aapl),
    "TIMEOUT",
  );
});
test("Service rejects partial quotes, wrong assets and invalid history", async () => {
  class Partial extends MockMarketDataProvider {
    async getQuotes() {
      return new Map();
    }
  }
  await fails(
    new MarketDataService(new Partial()).getQuote(aapl),
    "INVALID_RESPONSE",
  );
  class Wrong extends MockMarketDataProvider {
    async getQuotes() {
      return new Map([[aapl.id, await mock.getQuote(msft)]]);
    }
  }
  await fails(
    new MarketDataService(new Wrong()).getQuote(aapl),
    "INVALID_RESPONSE",
  );
  class Descending extends MockMarketDataProvider {
    async getHistory(...args) {
      return (await super.getHistory(...args)).reverse();
    }
  }
  await fails(
    new MarketDataService(new Descending()).getHistory(aapl, history),
    "INVALID_RESPONSE",
  );
});
test("429 establishes cooldown without extra provider calls", async () => {
  let calls = 0,
    now = 0;
  class Limited extends MockMarketDataProvider {
    async getQuotes() {
      calls++;
      throw new MarketDataError("RATE_LIMIT", { retryAfterMs: 120000 });
    }
  }
  const service = new MarketDataService(new Limited(), { now: () => now });
  await fails(service.getQuote(aapl), "RATE_LIMIT");
  await fails(service.getQuote(msft), "RATE_LIMIT");
  assert.equal(calls, 1);
  now = 120001;
  await fails(service.getQuote(aapl), "RATE_LIMIT");
  assert.equal(calls, 2);
});
test("Twelve quotes use one batch, fixed destination, header auth and Core normalization", async () => {
  let calls = 0;
  const p = provider(async (url, init) => {
    calls++;
    assert.equal(url.origin, "https://api.twelvedata.com");
    assert.equal(url.pathname, "/quote");
    assert.equal(url.searchParams.get("symbol"), "AAPL:NASDAQ,MSFT:NASDAQ");
    assert.equal(url.searchParams.has("apikey"), false);
    assert.equal(init.headers.Authorization, "apikey unit-test-secret");
    assert.equal(init.redirect, "error");
    return json({
      "AAPL:NASDAQ": wireQuote(aapl),
      "MSFT:NASDAQ": wireQuote(msft),
    });
  });
  const result = await p.getQuotes([aapl, msft]);
  assert.equal(calls, 1);
  assert.equal(result.get(aapl.id).price, 22.5);
  assert.equal(result.get(aapl.id).percentageChange, 12.5);
  assert.equal(
    result.get(aapl.id).timestamp,
    new Date(1735848000000).toISOString(),
  );
  assert.ok(
    (await provider(async () => json(wireQuote(petr))).getQuote(
      petr,
    )) instanceof Quote,
  );
});
test("Twelve daily history is bounded, chronological and independent of local timezone", async () => {
  const row = (date) => ({
    datetime: date,
    open: "20",
    high: "23",
    low: "19",
    close: "22",
    volume: "100",
  });
  const p = provider(async (url) => {
    assert.equal(url.pathname, "/time_series");
    assert.equal(url.searchParams.get("interval"), "1day");
    assert.equal(url.searchParams.get("start_date"), history.start);
    return json({
      meta: wireQuote(aapl),
      values: [row("2025-01-03"), row("2025-01-02")],
    });
  });
  const result = await p.getHistory(aapl, history);
  assert.equal(result[0].timestamp, "2025-01-02T00:00:00.000Z");
  assert.ok(result[0] instanceof Candle);
  await fails(
    provider(async () =>
      json({
        meta: wireQuote(aapl),
        values: [{ ...row("2025-01-02"), high: "1" }],
      }),
    ).getHistory(aapl, history),
    "INVALID_RESPONSE",
  );
  await fails(
    provider(async () =>
      json({
        meta: wireQuote(aapl),
        values: [row("2025-01-02"), row("2025-01-02")],
      }),
    ).getHistory(aapl, history),
    "INVALID_RESPONSE",
  );
});
test("Twelve search normalizes B3 and US assets while excluding unsupported exchanges", async () => {
  const p = provider(async (url) => {
    assert.equal(url.pathname, "/symbol_search");
    return json({
      data: [
        {
          symbol: "PETR4",
          exchange: "Bovespa",
          currency: "BRL",
          instrument_name: "Petrobras",
          instrument_type: "Preferred Stock",
        },
        {
          symbol: "AAPL",
          exchange: "NASDAQ",
          currency: "USD",
          instrument_name: "Apple",
          instrument_type: "Common Stock",
        },
        { symbol: "OTHER", exchange: "LSE" },
      ],
    });
  });
  assert.deepEqual(
    (await p.searchAssets("test")).map((a) => a.id),
    ["B3:PETR4", "NASDAQ:AAPL"],
  );
});
test("HTTP handles missing/invalid keys, offline, timeout, 429, 500 and malformed bodies", async () => {
  let calls = 0;
  await fails(
    new TwelveDataProvider({
      fetchImpl: () => {
        calls++;
      },
    }).getQuote(aapl),
    "AUTH_ERROR",
  );
  assert.equal(calls, 0);
  for (const [status, code, count] of [
    [401, "AUTH_ERROR", 1],
    [403, "AUTH_ERROR", 1],
    [404, "INVALID_SYMBOL", 1],
    [429, "RATE_LIMIT", 1],
    [500, "PROVIDER_ERROR", 2],
  ]) {
    calls = 0;
    await fails(
      provider(async () => {
        calls++;
        return json({}, status, { "retry-after": "120" });
      }).getQuote(aapl),
      code,
    );
    assert.equal(calls, count);
  }
  calls = 0;
  await fails(
    provider(async () => {
      calls++;
      throw new TypeError("secret network details");
    }).getQuote(aapl),
    "NO_NETWORK",
  );
  assert.equal(calls, 2);
  await fails(
    new TwelveDataProvider({
      apiKey: "x",
      timeoutMs: 10,
      fetchImpl: () => new Promise(() => {}),
    }).getQuote(aapl),
    "TIMEOUT",
  );
  await fails(
    provider(async () => new Response("not json")).getQuote(aapl),
    "INVALID_RESPONSE",
  );
  await fails(
    provider(async () =>
      json({ status: "error", code: 429, message: "do not leak" }),
    ).getQuote(aapl),
    "RATE_LIMIT",
  );
  await fails(
    provider(async () => json(wireQuote(aapl, { close: null }))).getQuote(aapl),
    "INVALID_RESPONSE",
  );
  await fails(
    provider(async () => json(wireQuote(msft))).getQuote(aapl),
    "INVALID_RESPONSE",
  );
  await fails(
    provider(async () => json({ "AAPL:NASDAQ": wireQuote(aapl) })).getQuotes([
      aapl,
      msft,
    ]),
    "INVALID_RESPONSE",
  );
});
test("HTTP retries 500 once, honors cancellation and times out a stalled body", async () => {
  let calls = 0;
  const p = provider(async () =>
    ++calls === 1 ? json({}, 500) : json(wireQuote(aapl)),
  );
  assert.equal((await p.getQuote(aapl)).price, 22.5);
  assert.equal(calls, 2);
  const controller = new AbortController();
  controller.abort();
  await fails(p.getQuote(aapl, { signal: controller.signal }), "TIMEOUT");
  const slow = new TwelveDataProvider({
    apiKey: "x",
    timeoutMs: 10,
    fetchImpl: async () => ({ ok: true, text: () => new Promise(() => {}) }),
  });
  await fails(slow.getQuote(aapl), "TIMEOUT");
  await fails(
    new TwelveHttpClient({ apiKey: "x" }).request("https://evil.test", {}),
    "INVALID_REQUEST",
  );
});
test("Safe logs/errors contain only status and timing, never keys or raw failures", async () => {
  const events = [],
    secret = "PRIVATE-key";
  const backend = createMarketBackend(
    { MARKET_DATA_PROVIDER: "twelve", TWELVE_DATA_API_KEY: secret },
    {
      fetchImpl: async () => {
        throw new Error(secret);
      },
      sleep: async () => {},
      logger: (event) => events.push(event),
    },
  );
  await fails(backend.service.getQuote(aapl), "NO_NETWORK");
  assert.ok(events.some((e) => e.provider === "twelve"));
  assert.ok(events.some((e) => e.status === "NO_NETWORK"));
  assert.ok(events.some((e) => typeof e.durationMs === "number"));
  assert.equal(JSON.stringify(events).includes(secret), false);
});
test("Configuration defaults to offline mock, explicitly labels missing-key fallback", () => {
  assert.equal(createMarketBackend().info.demo, true);
  const missing = createMarketBackend({ MARKET_DATA_PROVIDER: "twelve" });
  assert.equal(missing.info.demo, true);
  assert.match(missing.info.notice, /AUTH_ERROR/);
  assert.match(
    createMarketBackend({ MARKET_DATA_PROVIDER: "typo" }).info.notice,
    /INVALID_REQUEST/,
  );
  const live = createMarketBackend({
    MARKET_DATA_PROVIDER: "twelve",
    TWELVE_DATA_API_KEY: "secret",
  });
  assert.equal(live.info.demo, false);
  assert.equal(JSON.stringify(live.info).includes("secret"), false);
});
test("IPC rejects untrusted senders, arbitrary operations, oversized requests and fields", async () => {
  const backend = createMarketBackend(),
    event = { trusted: true };
  const handle = createMarketHandler(backend, (e) => e?.trusted === true);
  assert.equal(
    (await handle({}, { method: "info", args: [] })).error.code,
    "INVALID_REQUEST",
  );
  for (const request of [
    { method: "fetch", args: ["https://evil.test"] },
    { method: "constructor", args: [] },
    { method: "getQuote", args: [{ ...aapl, url: "https://evil.test" }] },
    { method: "getQuotes", args: [Array(51).fill(aapl)] },
    { method: "searchAssets", args: ["x".repeat(1000)] },
    { method: "info", args: [], token: "anything" },
  ])
    assert.equal((await handle(event, request)).ok, false);
});
test("IPC serializes values; renderer adapter reconstructs Core objects for every operation", async () => {
  const handle = createMarketHandler(createMarketBackend(), () => true);
  const bridge = Object.fromEntries(
    ["info", "getQuote", "getQuotes", "getHistory", "searchAssets"].map(
      (method) => [
        method,
        async (...args) =>
          JSON.parse(JSON.stringify(await handle({}, { method, args }))),
      ],
    ),
  );
  const remote = new RemoteMarketDataProvider(bridge);
  assert.equal((await remote.info()).demo, true);
  assert.ok((await remote.getQuote(aapl)) instanceof Quote);
  assert.ok(
    (await remote.getQuotes([aapl, msft])).get(msft.id) instanceof Quote,
  );
  assert.ok((await remote.searchAssets("Apple"))[0] instanceof Asset);
  assert.ok((await remote.getHistory(aapl, history))[0] instanceof Candle);
});
