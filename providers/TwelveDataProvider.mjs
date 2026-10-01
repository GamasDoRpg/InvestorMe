import { Quote, Candle } from "../core/index.mjs";
import {
  MarketDataProvider,
  validateAssets,
  validateAsset,
  validateHistory,
  validateQuery,
} from "../core/market-data/contract.mjs";
import { MarketDataError } from "../core/market-data/errors.mjs";
import { TwelveHttpClient, providerFailure } from "./http.mjs";
import { twelveSymbol, twelveAsset, normalizedExchange } from "./symbols.mjs";
function numeric(value) {
  if (
    !(
      typeof value === "number" ||
      (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value))
    ) ||
    !Number.isFinite(Number(value))
  )
    throw new MarketDataError("INVALID_RESPONSE");
  return Number(value);
}
function checkIdentity(row, asset) {
  if (
    !row ||
    row.symbol !== asset.symbol ||
    normalizedExchange(row.exchange) !== asset.exchange ||
    row.currency !== asset.currency
  )
    throw new MarketDataError("INVALID_RESPONSE");
}
function quoteFrom(row, asset) {
  if (row?.status === "error") throw providerFailure(Number(row.code));
  checkIdentity(row, asset);
  try {
    const seconds = numeric(row.last_quote_at ?? row.timestamp);
    if (seconds <= 0 || !Number.isInteger(seconds))
      throw new Error("timestamp");
    return new Quote({
      asset,
      timestamp: seconds * 1000,
      price: numeric(row.close),
      previousClose:
        row.previous_close == null ? null : numeric(row.previous_close),
      currency: row.currency,
    });
  } catch {
    throw new MarketDataError("INVALID_RESPONSE");
  }
}
export class TwelveDataProvider extends MarketDataProvider {
  #http;
  constructor(options = {}) {
    super();
    this.#http = new TwelveHttpClient(options);
  }
  async getQuote(asset, options) {
    return (await this.getQuotes([validateAsset(asset)], options)).get(
      asset.id,
    );
  }
  async getQuotes(input, options) {
    const assets = validateAssets(input);
    if (!assets.length) return new Map();
    const symbols = assets.map(twelveSymbol);
    const data = await this.#http.request(
      "/quote",
      { symbol: symbols.join(",") },
      options,
    );
    return new Map(
      assets.map((asset, index) => {
        const row =
          assets.length === 1 && data.symbol
            ? data
            : (data[symbols[index]] ??
              (assets.filter((a) => a.symbol === asset.symbol).length === 1
                ? data[asset.symbol]
                : undefined));
        return [asset.id, quoteFrom(row, asset)];
      }),
    );
  }
  async getHistory(asset, options, requestOptions) {
    validateAsset(asset);
    const { start, end } = validateHistory(options);
    const data = await this.#http.request(
      "/time_series",
      {
        symbol: twelveSymbol(asset),
        interval: "1day",
        start_date: start,
        end_date: end,
        outputsize: 5000,
        order: "ASC",
      },
      requestOptions,
    );
    checkIdentity(data.meta, asset);
    if (!Array.isArray(data.values) || data.values.length > 367)
      throw new MarketDataError("INVALID_RESPONSE");
    try {
      const candles = data.values
        .map((row) => {
          // Daily bars identify an exchange session date, not an intraday UTC instant.
          const date = row.datetime;
          if (
            typeof date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            new Date(date).toISOString().slice(0, 10) !== date ||
            date < start ||
            date > end
          )
            throw new Error("date");
          return new Candle({
            timestamp: date + "T00:00:00Z",
            interval: "1d",
            open: numeric(row.open),
            high: numeric(row.high),
            low: numeric(row.low),
            close: numeric(row.close),
            volume: numeric(row.volume),
          });
        })
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      if (new Set(candles.map((c) => c.timestamp)).size !== candles.length)
        throw new Error("duplicate");
      return candles;
    } catch {
      throw new MarketDataError("INVALID_RESPONSE");
    }
  }
  async searchAssets(query, options) {
    const valid = validateQuery(query);
    if (!valid) return [];
    const data = await this.#http.request(
      "/symbol_search",
      { symbol: valid, outputsize: 30 },
      options,
    );
    if (!Array.isArray(data.data) || data.data.length > 120)
      throw new MarketDataError("INVALID_RESPONSE");
    const assets = data.data.map(twelveAsset).filter(Boolean);
    return [...new Map(assets.map((a) => [a.id, a])).values()];
  }
}
