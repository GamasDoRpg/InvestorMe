import { MarketDataProvider, validateAssets } from "../core/market-data/contract.mjs";
import { MarketDataError } from "../core/market-data/errors.mjs";
export class UnavailableMarketDataProvider extends MarketDataProvider {
  async getQuote() { throw new MarketDataError("AUTH_ERROR"); }
  async getQuotes(assets) {
    if (!validateAssets(assets).length) return new Map();
    throw new MarketDataError("AUTH_ERROR");
  }
  async getHistory() { throw new MarketDataError("AUTH_ERROR"); }
  async searchAssets() { throw new MarketDataError("AUTH_ERROR"); }
}
