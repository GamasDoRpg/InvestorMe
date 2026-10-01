import { Asset } from "../market/Asset.mjs";
import { Quote } from "../market/Quote.mjs";
import { DomainError, number, text } from "../common/validation.mjs";
import { multiply, subtract, percentage } from "../common/arithmetic.mjs";
export class Position {
  constructor({ id, asset, quantity, averageCost } = {}) {
    this.id = text(id, "position.id");
    if (!(asset instanceof Asset))
      throw new DomainError("position.asset: expected Asset");
    this.asset = asset;
    this.quantity = number(quantity, "position.quantity");
    this.averageCost = number(averageCost, "position.averageCost");
    Object.freeze(this);
  }
  get investedCapital() {
    return multiply(this.quantity, this.averageCost);
  }
  marketValue(quote) {
    if (quote === undefined || quote === null)
      return this.quantity === 0 ? 0 : null;
    if (
      !(quote instanceof Quote) ||
      quote.asset.id !== this.asset.id ||
      quote.currency !== this.asset.currency
    )
      throw new DomainError("position: quote asset/currency mismatch");
    return multiply(this.quantity, quote.price);
  }
  unrealizedPL(quote) {
    const value = this.marketValue(quote);
    return value === null ? null : subtract(value, this.investedCapital);
  }
  unrealizedPLPercentage(quote) {
    const profit = this.unrealizedPL(quote);
    return profit === null ? null : percentage(profit, this.investedCapital);
  }
}
