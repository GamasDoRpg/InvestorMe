import { MarketDataProvider, validateAsset, validateAssets, validateQuery } from "../core/market-data/contract.mjs";
import { MarketDataError } from "../core/market-data/errors.mjs";
// Each market owns a service/cache/cooldown. A B3 rate limit cannot block US quotes.
export class RoutedMarketDataProvider extends MarketDataProvider {
  constructor({ brazil, us = null }) { super(); this.brazil = brazil; this.us = us; }
  route(asset) {
    validateAsset(asset);
    if (asset.exchange === "B3") return this.brazil;
    if (["NASDAQ", "NYSE"].includes(asset.exchange)) {
      if (!this.us) throw new MarketDataError("AUTH_ERROR");
      return this.us;
    }
    throw new MarketDataError("INVALID_SYMBOL");
  }
  async getQuote(asset, options) { return this.route(asset).getQuote(asset, options); }
  async getQuotes(input, options) {
    const groups = new Map();
    for (const asset of validateAssets(input)) {
      const target = this.route(asset);
      if (!groups.has(target)) groups.set(target, []);
      groups.get(target).push(asset);
    }
    const results = await Promise.all([...groups].map(([target, assets]) => target.getQuotes(assets, options)));
    return new Map(results.flatMap(result => [...result]));
  }
  async getHistory(asset, options, requestOptions) { return this.route(asset).getHistory(asset, options, requestOptions); }
  async searchAssets(query, options) {
    validateQuery(query);
    // Preserve explicit errors instead of claiming a failed market had no matches.
    const results = await Promise.all([this.brazil, this.us].filter(Boolean).map(p => p.searchAssets(query, options)));
    return [...new Map(results.flat().map(a => [a.id, a])).values()];
  }
}
