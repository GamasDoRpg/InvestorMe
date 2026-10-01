import { Asset, Quote, Candle } from "../index.mjs";
import { MarketDataError } from "./errors.mjs";
export const operations = Object.freeze([
  "getQuote",
  "getQuotes",
  "getHistory",
  "searchAssets",
]);
// Async provider contract. Implementations receive an optional AbortSignal.
// getQuotes returns a Map keyed by Asset.id; partial batches reject explicitly.
// History currently supports inclusive exchange-session dates and 1d bars only.
export class MarketDataProvider {
  async getQuote() {
    throw new MarketDataError("UNSUPPORTED");
  }
  async getQuotes() {
    throw new MarketDataError("UNSUPPORTED");
  }
  async getHistory() {
    throw new MarketDataError("UNSUPPORTED");
  }
  async searchAssets() {
    throw new MarketDataError("UNSUPPORTED");
  }
}
export function validateProvider(provider) {
  if (!provider || operations.some((op) => typeof provider[op] !== "function"))
    throw new MarketDataError("INVALID_REQUEST");
  return provider;
}
export function validateAsset(asset) {
  if (
    !(asset instanceof Asset) ||
    asset.id.length > 100 ||
    !/^[A-Za-z0-9.^-]{1,24}$/.test(asset.symbol) ||
    asset.exchange.length > 30
  )
    throw new MarketDataError("INVALID_REQUEST");
  return asset;
}
export function validateAssets(assets) {
  if (!Array.isArray(assets) || assets.length > 50)
    throw new MarketDataError("INVALID_REQUEST");
  assets.forEach(validateAsset);
  const ids = new Map();
  for (const asset of assets) {
    if (
      ids.has(asset.id) &&
      JSON.stringify(ids.get(asset.id)) !== JSON.stringify(asset)
    )
      throw new MarketDataError("INVALID_REQUEST");
    ids.set(asset.id, asset);
  }
  return [...ids.values()];
}
export function validateQuery(query) {
  if (
    typeof query !== "string" ||
    query.length > 80 ||
    /[\x00-\x1f]/.test(query)
  )
    throw new MarketDataError("INVALID_REQUEST");
  return query.trim();
}
export function validateHistory(options) {
  if (!options || options.timeframe !== "1d")
    throw new MarketDataError("UNSUPPORTED");
  const { start, end } = options;
  for (const date of [start, end]) {
    if (
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      throw new MarketDataError("INVALID_REQUEST");
  }
  if (start > end || Date.parse(end) - Date.parse(start) > 366 * 86400000)
    throw new MarketDataError("INVALID_REQUEST");
  return { timeframe: "1d", start, end };
}
export function validateQuotes(result, assets) {
  if (!(result instanceof Map) || result.size !== assets.length)
    throw new MarketDataError("INVALID_RESPONSE");
  for (const asset of assets) {
    const quote = result.get(asset.id);
    if (
      !(quote instanceof Quote) ||
      quote.asset.id !== asset.id ||
      quote.asset.symbol !== asset.symbol ||
      quote.asset.exchange !== asset.exchange ||
      quote.asset.assetType !== asset.assetType ||
      quote.currency !== asset.currency
    )
      throw new MarketDataError("INVALID_RESPONSE");
  }
  return result;
}
export function validateCandles(result, options) {
  if (!Array.isArray(result) || result.length > 367)
    throw new MarketDataError("INVALID_RESPONSE");
  let previous = "";
  for (const candle of result) {
    if (
      !(candle instanceof Candle) ||
      candle.interval !== options.timeframe ||
      candle.timestamp <= previous ||
      candle.timestamp.slice(0, 10) < options.start ||
      candle.timestamp.slice(0, 10) > options.end
    )
      throw new MarketDataError("INVALID_RESPONSE");
    previous = candle.timestamp;
  }
  return Object.freeze([...result]);
}
