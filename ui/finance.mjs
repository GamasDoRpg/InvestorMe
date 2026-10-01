import { Asset, Position, Portfolio, DomainError } from "../core/index.mjs";
import { validateAsset } from "../core/market-data/contract.mjs";
import { MarketDataService } from "../core/market-data/MarketDataService.mjs";
import { MockMarketDataProvider } from "../providers/MockMarketDataProvider.mjs";
import { demoMarket } from "../providers/mock-data.mjs";
import { RemoteMarketDataProvider } from "./RemoteMarketDataProvider.mjs";
import {
  MarketDataError,
  normalizeError,
} from "../core/market-data/errors.mjs";
export { DomainError };
let service = new MarketDataService(new MockMarketDataProvider());
let info = {
  provider: "mock",
  demo: true,
  label: "Mock Provider · dados demonstrativos",
  notice: null,
};
let quotes = await service.getQuotes(demoMarket.map((row) => row.asset));
let problems = [],
  refreshing = false;
export const assets = [];
function register(asset, color = "blue") {
  validateAsset(asset);
  const existing = assets.find((a) => a.ticker === asset.symbol);
  // The legacy persisted workspace uses unique tickers. Do not merge cross-listings.
  if (existing) return existing;
  const facade = Object.freeze({
    ...asset,
    sector: asset.sector || "—",
    ticker: asset.symbol,
    color,
    asset,
    get quote() {
      return quotes.get(asset.id);
    },
    get price() {
      return quotes.get(asset.id)?.price ?? null;
    },
    get change() {
      return quotes.get(asset.id)?.percentageChange ?? null;
    },
  });
  if (assets.length >= 100) throw new MarketDataError("INVALID_REQUEST");
  assets.push(facade);
  return facade;
}
demoMarket.forEach(({ asset, color }) => register(asset, color));
export function restoreAssets(records) {
  if (records === undefined) return;
  if (!Array.isArray(records) || records.length > 100)
    throw new DomainError("Invalid saved market catalog");
  const restored = records.map((row) => new Asset(row));
  restored.forEach((asset) => register(asset));
}
export async function initialize(bridge) {
  if (!bridge) return;
  const remote = new RemoteMarketDataProvider(bridge);
  let timer;
  try {
    const selected = await Promise.race([
      remote.info(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("IPC timeout")), 5000);
      }),
    ]);
    info = selected;
    service = new MarketDataService(remote);
    if (!info.demo) quotes = new Map();
  } catch {
    info = {
      ...info,
      notice: "PROVIDER_ERROR: conexão indisponível; modo demonstrativo ativo.",
    };
  } finally {
    clearTimeout(timer);
  }
}
export function status() {
  const timestamps = [...quotes.values()].map((q) => q.timestamp).sort();
  return {
    ...info,
    problems: [...problems],
    refreshing,
    oldestQuote: timestamps[0] || null,
  };
}
export function modeLabel() {
  return info.demo
    ? "Dados demonstrativos"
    : "Cotações externas · conforme plano";
}
export async function refresh() {
  if (refreshing) return;
  refreshing = true;
  problems = [];
  try {
    const groups = new Map();
    for (const row of assets) {
      if (!groups.has(row.exchange)) groups.set(row.exchange, []);
      groups.get(row.exchange).push(row.asset);
    }
    await Promise.all(
      [...groups].map(async ([exchange, list]) => {
        try {
          for (let i = 0; i < list.length; i += 50)
            for (const [id, quote] of await service.getQuotes(
              list.slice(i, i + 50),
            ))
              quotes.set(id, quote);
        } catch (error) {
          const safe = normalizeError(error);
          problems.push(`${exchange}: ${safe.code} — ${safe.message}`);
        }
      }),
    );
  } finally {
    refreshing = false;
  }
}
export async function searchAssets(query) {
  const found = await service.searchAssets(query);
  found.forEach((asset) => register(asset));
  await refresh();
  return found;
}
export async function getHistory(ticker, options) {
  const row = assets.find((a) => a.ticker === ticker);
  if (!row) throw new DomainError("Unknown asset");
  return service.getHistory(row.asset, options);
}
export function position(record) {
  const asset = assets.find((a) => a.ticker === record.ticker)?.asset;
  if (!asset) throw new DomainError(`Unknown asset: ${record.ticker}`);
  return new Position({
    id: record.id,
    asset,
    quantity: record.quantity,
    averageCost: record.cost,
  });
}
export function validatePosition(record) {
  return new Portfolio({ positions: [position(record)], baseCurrency: "BRL" });
}
export function validateCash(cash) {
  return new Portfolio({ cash, baseCurrency: "BRL" });
}
export function evaluate(workspace) {
  return new Portfolio({
    positions: workspace.holdings.map(position),
    cash: workspace.cash,
    baseCurrency: "BRL",
  }).evaluate(quotes);
}
