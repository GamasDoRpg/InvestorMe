import { Asset, Quote, Candle } from "../core/index.mjs";
import { MarketDataProvider, validateAsset, validateAssets, validateHistory, validateQuery, validateCandles } from "../core/market-data/contract.mjs";
import { MarketDataError } from "../core/market-data/errors.mjs";
import { BrapiHttpClient } from "./http.mjs";
const sandbox = new Set(["PETR4", "VALE3", "ITUB4", "MGLU3"]);
export function brapiSymbol(asset) {
  validateAsset(asset);
  if (asset.exchange !== "B3" || asset.currency !== "BRL" || !["equity", "etf"].includes(asset.assetType) || !/^[A-Z0-9]{4,12}$/.test(asset.symbol))
    throw new MarketDataError("INVALID_SYMBOL");
  return asset.symbol;
}
function number(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new MarketDataError("INVALID_RESPONSE");
  return value;
}
function result(data, symbol) {
  if (!Array.isArray(data.results) || data.results.length !== 1) throw new MarketDataError("INVALID_RESPONSE");
  const row = data.results[0];
  // Renames/conversions require an explicit portfolio migration, never silently substitute.
  if (row?.symbol !== symbol || row.requestedSymbol !== symbol || row.changed !== false || !row.data)
    throw new MarketDataError("INVALID_RESPONSE");
  return row.data;
}
export class BrapiProvider extends MarketDataProvider {
  #http;
  #authenticated;
  #queue = Promise.resolve();
  constructor(options = {}) {
    super();
    this.#http = new BrapiHttpClient(options);
    this.#authenticated = typeof options.apiKey === "string" && !!options.apiKey.trim();
  }
  #symbol(asset) {
    const symbol = brapiSymbol(asset);
    if (!this.#authenticated && !sandbox.has(symbol)) throw new MarketDataError("AUTH_ERROR");
    return symbol;
  }
  #request(endpoint, params, options = {}) {
    // Free accounts permit one in-flight request and one ticker per call.
    const request = this.#queue.then(() => {
      if (options.signal?.aborted) throw new MarketDataError("TIMEOUT");
      return this.#http.request(endpoint, params, options);
    });
    this.#queue = request.catch(() => {});
    return request;
  }
  async getQuote(asset, options) {
    const symbol = this.#symbol(asset);
    const row = result(await this.#request("/api/v2/stocks/quote", { symbols: symbol }, options), symbol);
    try {
      if (row.currency !== asset.currency || typeof row.regularMarketTime !== "string") throw new Error("identity");
      return new Quote({ asset, currency: row.currency, timestamp: row.regularMarketTime,
        price: number(row.regularMarketPrice), previousClose: row.regularMarketPreviousClose == null ? null : number(row.regularMarketPreviousClose) });
    } catch { throw new MarketDataError("INVALID_RESPONSE"); }
  }
  async getQuotes(input, options) {
    const assets = validateAssets(input);
    assets.forEach(asset => this.#symbol(asset));
    const quotes = new Map();
    for (const asset of assets) quotes.set(asset.id, await this.getQuote(asset, options));
    return quotes;
  }
  async getHistory(asset, options, requestOptions) {
    const symbol = this.#symbol(asset), valid = validateHistory(options);
    const row = result(await this.#request("/api/v2/stocks/historical", {
      symbols: symbol, interval: "1d", startDate: valid.start, endDate: valid.end, sortOrder: "asc",
    }, requestOptions), symbol);
    if (row.usedInterval !== "1d" || !Array.isArray(row.historicalDataPrice) || row.historicalDataPrice.length > 367)
      throw new MarketDataError("INVALID_RESPONSE");
    try {
      const candles = row.historicalDataPrice.map(bar => {
        const seconds = number(bar.date);
        if (!Number.isInteger(seconds) || seconds <= 0) throw new Error("date");
        return new Candle({ timestamp: seconds * 1000, interval: "1d", open: number(bar.open), high: number(bar.high), low: number(bar.low), close: number(bar.close), volume: number(bar.volume) });
      }).sort((a,b) => a.timestamp.localeCompare(b.timestamp));
      return validateCandles(candles, valid);
    } catch { throw new MarketDataError("INVALID_RESPONSE"); }
  }
  async searchAssets(query, options) {
    const search = validateQuery(query);
    if (!search) return [];
    const data = await this.#request("/api/quote/list", { search, limit: 30, page: 1 }, options);
    if (!Array.isArray(data.stocks) || data.stocks.length > 30) throw new MarketDataError("INVALID_RESPONSE");
    try {
      const assets = data.stocks.flatMap(row => {
        const type = row.subType ?? row.type;
        if (!["stock", "unit", "etf"].includes(type)) return [];
        const asset = new Asset({ id: `B3:${row.stock}`, symbol: row.stock, exchange: "B3", currency: "BRL", name: row.name,
          assetType: type === "etf" ? "etf" : "equity", sector: row.sector || undefined, market: "Brasil", country: "BR" });
        brapiSymbol(asset);
        return [asset];
      });
      return [...new Map(assets.map(a => [a.id,a])).values()];
    } catch { throw new MarketDataError("INVALID_RESPONSE"); }
  }
}
