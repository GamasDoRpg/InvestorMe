// Presentation metadata only. Never infer brand identity from ticker prefixes
// or load provider-supplied image URLs into the renderer. Remote sources are fixed.
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
  if (Object.hasOwn(companies, key))
    return new URL(`./assets/companies/${companies[key]}.svg`, import.meta.url).href;
  if (typeof asset.symbol !== "string" || !/^[A-Z0-9][A-Z0-9.-]{0,23}$/.test(asset.symbol)) return null;
  if (asset.exchange === "B3")
    return `https://icons.brapi.dev/icons/${encodeURIComponent(asset.symbol)}.svg`;
  if (["NASDAQ", "NYSE"].includes(asset.exchange))
    return `https://raw.githubusercontent.com/nvstly/icons/main/ticker_icons/${encodeURIComponent(asset.symbol)}.png`;
  return null;
}
