import { Candle } from "../../core/index.mjs";
import {
  MarketDataProvider,
  validateAsset,
  validateAssets,
  validateHistory,
  validateQuery,
} from "../../core/market-data/contract.mjs";
import { MarketDataError } from "../../core/market-data/errors.mjs";
import { demoMarket } from "./mock-data.mjs";
export class MockMarketDataProvider extends MarketDataProvider {
  async getQuote(asset) {
    validateAsset(asset);
    const record = demoMarket.find(
      (row) =>
        row.asset.id === asset.id &&
        row.asset.currency === asset.currency &&
        row.asset.symbol === asset.symbol &&
        row.asset.exchange === asset.exchange,
    );
    if (!record) throw new MarketDataError("INVALID_SYMBOL");
    return record.quote;
  }
  async getQuotes(assets) {
    return new Map(
      await Promise.all(
        validateAssets(assets).map(async (a) => [a.id, await this.getQuote(a)]),
      ),
    );
  }
  async searchAssets(query) {
    const term = validateQuery(query).toLowerCase();
    return demoMarket
      .filter(({ asset }) =>
        `${asset.symbol} ${asset.name}`.toLowerCase().includes(term),
      )
      .map((row) => row.asset);
  }
  async getHistory(asset, options) {
    const quote = await this.getQuote(asset),
      { start, end } = validateHistory(options),
      result = [];
    // Synthetic session-date bars, not exchange calendars or financial history.
    for (let ms = Date.parse(start); ms <= Date.parse(end); ms += 86400000) {
      const day = new Date(ms);
      if ([0, 6].includes(day.getUTCDay())) continue;
      const base = Math.round(quote.price * 100),
        offset = (Math.floor(ms / 86400000) % 11) - 5;
      const open = (base + offset) / 100,
        close = (base + offset + 2) / 100;
      result.push(
        new Candle({
          timestamp: ms,
          open,
          close,
          high: close + 0.1,
          low: open - 0.1,
          volume: 100000 + offset * 100,
          interval: "1d",
        }),
      );
    }
    return result;
  }
}
