import { Asset } from "../index.mjs";
import { MemoryCache } from "./MemoryCache.mjs";
import { MarketDataError, normalizeError } from "./errors.mjs";
import {
  validateProvider,
  validateAsset,
  validateAssets,
  validateQuery,
  validateHistory,
  validateQuotes,
  validateCandles,
} from "./contract.mjs";
export class MarketDataService {
  #provider;
  #pending = new Map();
  #cooldown = 0;
  constructor(
    provider,
    {
      cache = new MemoryCache(),
      now = Date.now,
      timeoutMs = 18000,
      logger = () => {},
      ttl = {},
    } = {},
  ) {
    this.#provider = validateProvider(provider);
    this.cache = cache;
    this.now = now;
    this.timeoutMs = timeoutMs;
    this.logger = logger;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
      throw new TypeError("Invalid timeout");
    this.ttl = { quote: 60000, search: 300000, history: 300000, ...ttl };
    for (const value of Object.values(this.ttl))
      if (!Number.isFinite(value) || value < 0)
        throw new TypeError("Invalid TTL");
  }
  async #call(operation, run) {
    if (this.now() < this.#cooldown)
      throw new MarketDataError("RATE_LIMIT", {
        retryAfterMs: this.#cooldown - this.now(),
      });
    const controller = new AbortController(),
      start = this.now();
    let timer;
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => run(controller.signal)),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new MarketDataError("TIMEOUT"));
          }, this.timeoutMs);
        }),
      ]);
      this.#log({ operation, status: "ok", durationMs: this.now() - start });
      return result;
    } catch (error) {
      const safe = normalizeError(error);
      if (safe.code === "RATE_LIMIT")
        this.#cooldown = this.now() + Math.max(60000, safe.retryAfterMs);
      this.#log({
        operation,
        status: safe.code,
        durationMs: this.now() - start,
      });
      throw safe;
    } finally {
      clearTimeout(timer);
    }
  }
  #log(event) {
    try {
      this.logger(event);
    } catch {
      /* Logging cannot break market data. */
    }
  }
  #key(asset) {
    return JSON.stringify([
      asset.id,
      asset.symbol,
      asset.exchange,
      asset.currency,
      asset.assetType,
    ]);
  }
  async getQuote(asset) {
    validateAsset(asset);
    return (await this.getQuotes([asset])).get(asset.id);
  }
  async getQuotes(input) {
    const assets = validateAssets(input),
      result = new Map(),
      misses = [];
    for (const asset of assets) {
      const key = "q:" + this.#key(asset),
        cached = this.cache.get(key);
      if (cached) result.set(asset.id, cached);
      else if (!this.#pending.has(key)) misses.push(asset);
    }
    if (misses.length) {
      const batch = this.#call("getQuotes", async (signal) =>
        validateQuotes(
          await this.#provider.getQuotes(misses, { signal }),
          misses,
        ),
      );
      for (const asset of misses) {
        const key = "q:" + this.#key(asset);
        const promise = batch
          .then((values) => {
            const value = values.get(asset.id);
            this.cache.set(key, value, this.ttl.quote);
            return value;
          })
          .finally(() => this.#pending.delete(key));
        this.#pending.set(key, promise);
      }
    }
    // Attach handlers to every pending item before any rejection occurs.
    await Promise.all(
      assets
        .filter((a) => !result.has(a.id))
        .map(async (asset) => {
          result.set(
            asset.id,
            await this.#pending.get("q:" + this.#key(asset)),
          );
        }),
    );
    return new Map(assets.map((a) => [a.id, result.get(a.id)]));
  }
  async #cached(key, ttl, operation, run) {
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    if (!this.#pending.has(key))
      this.#pending.set(
        key,
        this.#call(operation, run)
          .then((value) => {
            this.cache.set(key, value, ttl);
            return value;
          })
          .finally(() => this.#pending.delete(key)),
      );
    return this.#pending.get(key);
  }
  async getHistory(asset, options) {
    validateAsset(asset);
    const valid = validateHistory(options);
    return this.#cached(
      "h:" + this.#key(asset) + JSON.stringify(valid),
      this.ttl.history,
      "getHistory",
      async (signal) =>
        validateCandles(
          await this.#provider.getHistory(asset, valid, { signal }),
          valid,
        ),
    );
  }
  async searchAssets(query) {
    const valid = validateQuery(query);
    return this.#cached(
      "s:" + valid.toLowerCase(),
      this.ttl.search,
      "searchAssets",
      async (signal) => {
        const result = await this.#provider.searchAssets(valid, { signal });
        if (
          !Array.isArray(result) ||
          result.length > 120 ||
          result.some((a) => !(a instanceof Asset))
        )
          throw new MarketDataError("INVALID_RESPONSE");
        result.forEach(validateAsset);
        if (new Set(result.map((a) => a.id)).size !== result.length)
          throw new MarketDataError("INVALID_RESPONSE");
        return Object.freeze([...result]);
      },
    );
  }
}
