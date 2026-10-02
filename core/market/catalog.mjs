import { Asset } from "./Asset.mjs";
const references = [
  ["PETR4", "Petrobras", "B3"], ["VALE3", "Vale", "B3"],
  ["WEGE3", "WEG", "B3"], ["ITUB4", "Itaú Unibanco", "B3"],
  ["BBDC4", "Bradesco", "B3"], ["MGLU3", "Magazine Luiza", "B3"],
  ["AAPL", "Apple", "NASDAQ"], ["NVDA", "NVIDIA", "NASDAQ"],
  ["MSFT", "Microsoft", "NASDAQ"],
];
// Reference catalog only; prices, changes and timestamps must come from a provider.
export const catalog = Object.freeze(references.map(([symbol, name, exchange]) => new Asset({
  id: `${exchange}:${symbol}`, symbol, name, exchange, assetType: "equity",
  currency: exchange === "B3" ? "BRL" : "USD",
  country: exchange === "B3" ? "BR" : "US", market: exchange === "B3" ? "Brasil" : "EUA",
})));
