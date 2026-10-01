import { Asset } from "../core/index.mjs";
import { MarketDataError } from "../core/market-data/errors.mjs";
import { validateAsset } from "../core/market-data/contract.mjs";
const exchanges = Object.freeze({
  B3: "Bovespa",
  NASDAQ: "NASDAQ",
  NYSE: "NYSE",
});
export function normalizedExchange(value) {
  const name = typeof value === "string" ? value.toUpperCase() : "";
  return (
    { BOVESPA: "B3", BVMF: "B3", B3: "B3", NASDAQ: "NASDAQ", NYSE: "NYSE" }[
      name
    ] || null
  );
}
export function twelveSymbol(asset) {
  validateAsset(asset);
  const exchange = exchanges[asset.exchange];
  if (!exchange || !["equity", "etf", "index"].includes(asset.assetType))
    throw new MarketDataError("INVALID_SYMBOL");
  return `${asset.symbol}:${exchange}`;
}
export function twelveAsset(row) {
  const exchange = normalizedExchange(row?.exchange);
  if (!exchange) return null;
  const types = {
    "Common Stock": "equity",
    "Preferred Stock": "equity",
    ETF: "etf",
    Index: "index",
  };
  const assetType = types[row.instrument_type];
  if (!assetType) return null;
  try {
    const asset = new Asset({
      id: `${exchange}:${row.symbol}`,
      symbol: row.symbol,
      exchange,
      name: row.instrument_name,
      currency: row.currency,
      assetType,
      market: exchange === "B3" ? "Brasil" : "EUA",
      country: exchange === "B3" ? "BR" : "US",
    });
    return validateAsset(asset);
  } catch {
    throw new MarketDataError("INVALID_RESPONSE");
  }
}
