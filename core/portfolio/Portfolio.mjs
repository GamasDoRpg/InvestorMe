import { Position } from "./Position.mjs";
import { Quote } from "../market/Quote.mjs";
import { DomainError, number, currency } from "../common/validation.mjs";
import { sum, subtract, percentage } from "../common/arithmetic.mjs";
export class Portfolio {
  constructor({ positions = [], cash = 0, baseCurrency } = {}) {
    if (
      !Array.isArray(positions) ||
      positions.some((p) => !(p instanceof Position))
    )
      throw new DomainError("portfolio.positions: expected Position array");
    this.baseCurrency = currency(baseCurrency);
    this.cash = number(cash, "portfolio.cash");
    if (new Set(positions.map((p) => p.id)).size !== positions.length)
      throw new DomainError("portfolio: duplicate position id");
    if (positions.some((p) => p.asset.currency !== this.baseCurrency))
      throw new DomainError("portfolio: currency conversion required");
    this.positions = Object.freeze([...positions]);
    Object.freeze(this);
  }
  get investedCapital() {
    return sum(this.positions.map((p) => p.investedCapital));
  }
  // Quotes are keyed by stable asset ID, never by ambiguous ticker alone.
  evaluate(quotes = new Map()) {
    if (!(quotes instanceof Map))
      throw new DomainError("portfolio.quotes: expected Map");
    for (const [id, quote] of quotes) {
      if (!(quote instanceof Quote) || quote.asset.id !== id)
        throw new DomainError("portfolio: invalid quote map");
    }
    const rows = this.positions.map((position) => {
      const quote = quotes.get(position.asset.id);
      return {
        position,
        investedCapital: position.investedCapital,
        marketValue: position.marketValue(quote),
        unrealizedPL: position.unrealizedPL(quote),
        unrealizedPLPercentage: position.unrealizedPLPercentage(quote),
      };
    });
    const complete = rows.every((row) => row.marketValue !== null);
    const investedCapital = this.investedCapital;
    const marketValue = complete
      ? sum(rows.map((row) => row.marketValue))
      : null;
    const totalEquity = complete ? sum([marketValue, this.cash]) : null;
    const unrealizedPL = complete
      ? subtract(marketValue, investedCapital)
      : null;
    return Object.freeze({
      investedCapital,
      marketValue,
      cash: this.cash,
      totalEquity,
      unrealizedPL,
      unrealizedPLPercentage: complete
        ? percentage(unrealizedPL, investedCapital)
        : null,
      cashAllocation: complete
        ? totalEquity === 0
          ? 0
          : percentage(this.cash, totalEquity)
        : null,
      positions: Object.freeze(
        rows.map((row) =>
          Object.freeze({
            ...row,
            allocation: complete
              ? totalEquity === 0
                ? 0
                : percentage(row.marketValue, totalEquity)
              : null,
            investedAllocation: complete
              ? marketValue === 0
                ? 0
                : percentage(row.marketValue, marketValue)
              : null,
          }),
        ),
      ),
    });
  }
}
