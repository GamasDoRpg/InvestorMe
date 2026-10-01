import { DomainError, number, text, timestamp } from "../common/validation.mjs";
export class Candle {
  constructor({
    timestamp: time,
    open,
    high,
    low,
    close,
    volume,
    interval,
  } = {}) {
    this.timestamp = timestamp(time);
    for (const [key, value] of Object.entries({
      open,
      high,
      low,
      close,
      volume,
    }))
      this[key] = number(value, `candle.${key}`);
    if (high < Math.max(open, close, low) || low > Math.min(open, close, high))
      throw new DomainError("candle: impossible OHLC range");
    this.interval = text(interval, "candle.interval");
    Object.freeze(this);
  }
}
