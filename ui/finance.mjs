import { Position, Portfolio, DomainError } from "../core/index.mjs";
import { demoMarket } from "./demo-market.mjs";
export { DomainError };
// Presentation facade for the existing renderer. Domain objects stay immutable.
export const assets = Object.freeze(
  demoMarket.map(({ asset, quote, color }) =>
    Object.freeze({
      ...asset,
      ticker: asset.symbol,
      color,
      asset,
      quote,
      get price() {
        return quote.price;
      },
      get change() {
        return quote.percentageChange;
      },
    }),
  ),
);
const quotes = new Map(demoMarket.map(({ asset, quote }) => [asset.id, quote]));
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
