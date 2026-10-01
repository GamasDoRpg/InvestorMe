import { text, currency } from "../common/validation.mjs";
export class Asset {
  constructor({
    id,
    symbol,
    exchange,
    name,
    currency: code,
    assetType,
    sector,
    market,
    country,
  } = {}) {
    this.id = text(id, "asset.id");
    this.symbol = text(symbol, "asset.symbol");
    this.exchange = text(exchange, "asset.exchange");
    this.name = text(name, "asset.name");
    this.currency = currency(code);
    this.assetType = text(assetType, "asset.assetType");
    for (const [key, value] of Object.entries({ sector, market, country }))
      if (value !== undefined) this[key] = text(value, `asset.${key}`);
    Object.freeze(this);
  }
}
