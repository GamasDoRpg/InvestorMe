// Presentation metadata only. Never infer brand identity from ticker prefixes
// or load provider-supplied image URLs into the renderer.
const companies = Object.freeze({
  "B3:PETR4": "petrobras",
  "B3:VALE3": "vale",
  "B3:WEGE3": "weg",
  "B3:ITUB4": "itau",
  "B3:BBDC4": "bradesco",
  "B3:MGLU3": "magalu",
  "NASDAQ:AAPL": "apple",
  "NASDAQ:MSFT": "microsoft",
  "NASDAQ:NVDA": "nvidia",
});
export function assetLogo(asset) {
  const key = `${asset.exchange}:${asset.symbol}`;
  return Object.hasOwn(companies, key)
    ? new URL(`./assets/companies/${companies[key]}.svg`, import.meta.url).href
    : null;
}
