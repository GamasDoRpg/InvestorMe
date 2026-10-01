import { Asset, Quote, Candle } from "../core/index.mjs";
import { MarketDataError } from "../core/market-data/errors.mjs";
import { MarketDataProvider } from "../core/market-data/contract.mjs";
export class RemoteMarketDataProvider extends MarketDataProvider {
  constructor(bridge) {
    super();
    this.bridge = bridge;
  }
  async call(method, args) {
    const result = await this.bridge[method](...args);
    if (!result?.ok)
      throw new MarketDataError(result?.error?.code, {
        retryAfterMs: result?.error?.retryAfterMs,
      });
    return result.data;
  }
  async info() {
    return this.call("info", []);
  }
  async getQuote(asset) {
    const row = await this.call("getQuote", [asset]);
    return new Quote({ ...row, asset: new Asset(row.asset) });
  }
  async getQuotes(assets) {
    const rows = await this.call("getQuotes", [assets]);
    if (!Array.isArray(rows)) throw new MarketDataError("INVALID_RESPONSE");
    return new Map(
      rows.map((row) => [
        row.asset.id,
        new Quote({ ...row, asset: new Asset(row.asset) }),
      ]),
    );
  }
  async getHistory(asset, options) {
    return (await this.call("getHistory", [asset, options])).map(
      (row) => new Candle(row),
    );
  }
  async searchAssets(query) {
    return (await this.call("searchAssets", [query])).map(
      (row) => new Asset(row),
    );
  }
}
