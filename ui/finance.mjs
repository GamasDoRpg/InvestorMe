import { Asset, Position, Portfolio, DomainError } from "../core/index.mjs";
import { validateAsset } from "../core/market-data/contract.mjs";
import { MarketDataService } from "../core/market-data/MarketDataService.mjs";
import { UnavailableMarketDataProvider } from "../providers/UnavailableMarketDataProvider.mjs";
import { catalog } from "../core/market/catalog.mjs";
export { emptyWorkspace, migrateWorkspace } from "./workspace.mjs";
import { RemoteMarketDataProvider } from "./RemoteMarketDataProvider.mjs";
import {
  MarketDataError,
  normalizeError,
} from "../core/market-data/errors.mjs";
export { DomainError };
export { initializeConnections, connectionStatus, saveConnections, testConnection } from "./connections.mjs";
let service = new MarketDataService(new UnavailableMarketDataProvider());
let info = {
  provider: "disabled",
  demo: false,
  label: "Sem conexão com provedores",
  notice: "Configure suas chaves na conta. A prévia web não acessa provedores.",
};
let quotes = new Map();
let generation = 0;
let brazilService = null;
let searchService = service;
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
catalog.forEach(asset => register(asset));
export function restoreAssets(records) {
  if (records === undefined) return;
  if (!Array.isArray(records) || records.length > 100)
    throw new DomainError("Invalid saved market catalog");
  const restored = records.map((row) => new Asset(row));
  restored.forEach((asset) => register(asset));
}
export async function initialize(bridge) {
  generation++;
  quotes = new Map();
  problems = [];
  refreshing = false;
  brazilService = null;
  service = new MarketDataService(new UnavailableMarketDataProvider());
  searchService = service;
  if (!bridge) { info = {provider:"disabled", demo:false, label:"Sem conexão com provedores", notice:"Configure suas chaves no aplicativo desktop."}; return; }
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
    if (["brapi", "combined"].includes(info.provider)) {
      brazilService = new MarketDataService(remote);
      // A combined search can fail on either market. Its cooldown must not
      // contaminate the independent quote services.
      searchService = new MarketDataService(remote);
    } else searchService = service;
    if (!info.demo) quotes = new Map();
  } catch {
    info = {
      ...info,
      provider: "disabled", demo: false, label: "Sem conexão com provedores",
      notice: "Conexão indisponível. Nenhum preço foi carregado.",
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
  return info.provider === "disabled" ? "Cotações indisponíveis" : "Cotações dos provedores";
}
export async function refresh() {
  if (refreshing || info.provider === "disabled") return;
  const current = generation;
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
        const batchSize = info.quoteBatchSize === 1 && exchange === "B3" ? 1 : 50;
        for (let i = 0; i < list.length; i += batchSize) {
          if (generation !== current) return;
          try {
            for (const [id, quote] of await (exchange === "B3" && brazilService ? brazilService : service).getQuotes(list.slice(i, i + batchSize))) {
              if (generation === current) quotes.set(id, quote);
            }
          } catch (error) {
            const safe = normalizeError(error);
            if (generation !== current) return;
            // Failed refreshes must not continue displaying a last known price.
            list.slice(i, i + batchSize).forEach(asset => quotes.delete(asset.id));
            problems.push(`${exchange} (${list.slice(i, i + batchSize).map(a => a.symbol).join(", ")}): ${safe.code} — ${safe.message}`);
            if (safe.code === "RATE_LIMIT") { list.slice(i).forEach(asset => quotes.delete(asset.id)); break; }
          }
        }
      }),
    );
  } finally {
    if (generation === current) refreshing = false;
  }
}
export async function searchAssets(query) {
  const found = await searchService.searchAssets(query);
  found.forEach((asset) => register(asset));
  await refresh();
  return found;
}
export async function getHistory(ticker, options) {
  const row = assets.find((a) => a.ticker === ticker);
  if (!row) throw new DomainError("Unknown asset");
  return (row.exchange === "B3" && brazilService ? brazilService : service).getHistory(row.asset, options);
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
