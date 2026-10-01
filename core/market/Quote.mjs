import { Asset } from "./Asset.mjs";
import {
  DomainError,
  number,
  timestamp,
  currency,
} from "../common/validation.mjs";
import { subtract, percentage } from "../common/arithmetic.mjs";
export class Quote {
  constructor({
    asset,
    timestamp: time,
    price,
    previousClose = null,
    currency: code = asset?.currency,
  } = {}) {
    if (!(asset instanceof Asset))
      throw new DomainError("quote.asset: expected Asset");
    this.asset = asset;
    this.timestamp = timestamp(time);
    this.price = number(price, "quote.price");
    this.previousClose =
      previousClose === null
        ? null
        : number(previousClose, "quote.previousClose");
    this.currency = currency(code);
    if (this.currency !== asset.currency)
      throw new DomainError("quote currency differs from asset");
    Object.freeze(this);
  }
  get absoluteChange() {
    return this.previousClose === null
      ? null
      : subtract(this.price, this.previousClose);
  }
  get percentageChange() {
    return this.previousClose === null
      ? null
      : percentage(this.absoluteChange, this.previousClose);
  }
}
