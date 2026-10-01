import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Asset,
  Quote,
  Candle,
  Position,
  Portfolio,
  DomainError,
} from "../core/index.mjs";
import { sum, multiply, subtract } from "../core/common/arithmetic.mjs";
import { evaluate, position, assets } from "../ui/finance.mjs";
const fields = {
  id: "B3:TEST3",
  symbol: "TEST3",
  exchange: "B3",
  name: "Test",
  currency: "BRL",
  assetType: "equity",
};
const asset = new Asset(fields);
const time = "2025-01-02T21:00:00Z";
const quote = (price, a = asset) =>
  new Quote({ asset: a, timestamp: time, price });
const holding = (overrides = {}) =>
  new Position({
    id: "p1",
    asset,
    quantity: 10,
    averageCost: 20,
    ...overrides,
  });
const book = (positions = [holding()], cash = 50) =>
  new Portfolio({ positions, cash, baseCurrency: "BRL" });

test("Asset validates mandatory fields and supports independent markets and asset types", () => {
  assert.equal(asset.symbol, "TEST3");
  for (const key of Object.keys(fields)) {
    const input = { ...fields };
    delete input[key];
    assert.throws(() => new Asset(input), DomainError, key);
    assert.throws(() => new Asset({ ...fields, [key]: " " }), DomainError, key);
  }
  for (const assetType of ["equity", "etf", "index", "future-type"]) {
    assert.equal(
      new Asset({
        ...fields,
        id: "NYSE:TEST",
        exchange: "NYSE",
        currency: "USD",
        assetType,
      }).currency,
      "USD",
    );
  }
  assert.throws(
    () => new Asset({ ...fields, currency: "dollars" }),
    DomainError,
  );
  assert.throws(() => {
    asset.currency = "USD";
  }, TypeError);
});
test("Quote derives changes, validates numbers, asset, currency and timestamp", () => {
  const q = new Quote({ asset, timestamp: time, price: 22, previousClose: 20 });
  assert.equal(q.absoluteChange, 2);
  assert.equal(q.percentageChange, 10);
  assert.equal(quote(10).absoluteChange, null);
  assert.equal(quote(10).percentageChange, null);
  assert.equal(
    new Quote({ asset, timestamp: 0, price: 5, previousClose: 0 })
      .percentageChange,
    null,
  );
  assert.equal(
    new Quote({ asset, timestamp: time, price: 18, previousClose: 20 })
      .percentageChange,
    -10,
  );
  for (const price of [-1, NaN, Infinity, "20", null, undefined])
    assert.throws(() => quote(price), DomainError);
  for (const timestamp of ["invalid", "", "2025-01-01", NaN, Infinity, null])
    assert.throws(() => new Quote({ asset, timestamp, price: 1 }), DomainError);
  assert.throws(
    () => new Quote({ asset, timestamp: time, price: 1, currency: "USD" }),
    DomainError,
  );
  assert.throws(
    () => new Quote({ asset: fields, timestamp: time, price: 1 }),
    DomainError,
  );
});
test("Candle accepts valid OHLCV and rejects impossible or invalid candles", () => {
  const data = {
    timestamp: time,
    open: 10,
    high: 12,
    low: 8,
    close: 11,
    volume: 0,
    interval: "1d",
  };
  assert.equal(new Candle(data).close, 11);
  for (const patch of [
    { high: 9 },
    { low: 11 },
    { close: 13 },
    { open: 7 },
    { volume: -1 },
    { interval: "" },
  ])
    assert.throws(() => new Candle({ ...data, ...patch }), DomainError);
  for (const key of ["open", "high", "low", "close", "volume"])
    for (const value of [NaN, Infinity, -1, undefined])
      assert.throws(() => new Candle({ ...data, [key]: value }), DomainError);
});
test("Position calculates invested capital, market value and positive/negative P/L", () => {
  const p = holding();
  assert.equal(p.investedCapital, 200);
  assert.equal(p.marketValue(quote(25)), 250);
  assert.equal(p.unrealizedPL(quote(25)), 50);
  assert.equal(p.unrealizedPLPercentage(quote(25)), 25);
  assert.equal(p.unrealizedPL(quote(15)), -50);
  assert.equal(p.unrealizedPLPercentage(quote(15)), -25);
  assert.equal(p.marketValue(), null);
  assert.equal(p.unrealizedPL(), null);
  assert.equal(p.unrealizedPLPercentage(), null);
  assert.equal(
    holding({ averageCost: 0 }).unrealizedPLPercentage(quote(20)),
    null,
  );
  assert.equal(holding({ quantity: 0 }).marketValue(), 0);
  assert.equal(
    holding({ quantity: 0.3, averageCost: 0.1 }).investedCapital,
    0.03,
  );
});
test("Position rejects invalid values and unrelated quotes", () => {
  for (const key of ["quantity", "averageCost"])
    for (const value of [-10, NaN, Infinity, "1", null])
      assert.throws(() => holding({ [key]: value }), DomainError);
  assert.throws(
    () =>
      holding().marketValue(quote(20, new Asset({ ...fields, id: "OTHER" }))),
    DomainError,
  );
  assert.throws(
    () =>
      holding().marketValue(
        quote(20, new Asset({ ...fields, currency: "USD" })),
      ),
    DomainError,
  );
  assert.throws(() => holding().marketValue({ price: 20 }), DomainError);
});
test("Portfolio sums positions, cash, equity, P/L and both allocation bases", () => {
  const p = book([
    holding(),
    holding({ id: "p2", quantity: 5, averageCost: 10 }),
  ]);
  const r = p.evaluate(new Map([[asset.id, quote(30)]]));
  assert.equal(r.investedCapital, 250);
  assert.equal(r.marketValue, 450);
  assert.equal(r.cash, 50);
  assert.equal(r.totalEquity, 500);
  assert.equal(r.unrealizedPL, 200);
  assert.equal(r.unrealizedPLPercentage, 80);
  assert.equal(r.positions[0].allocation, 60);
  assert.equal(r.positions[1].allocation, 30);
  assert.equal(r.cashAllocation, 10);
  assert.ok(Math.abs(r.positions[0].investedAllocation - 200 / 3) < 1e-12);
});
test("Empty, cash-only and missing-quote portfolios have explicit results", () => {
  const empty = book([], 0).evaluate();
  assert.equal(empty.investedCapital, 0);
  assert.equal(empty.marketValue, 0);
  assert.equal(empty.totalEquity, 0);
  assert.equal(empty.unrealizedPL, 0);
  assert.equal(empty.unrealizedPLPercentage, null);
  assert.equal(empty.cashAllocation, 0);
  assert.deepEqual(empty.positions, []);
  assert.equal(book([], 100).evaluate().cashAllocation, 100);
  const missing = book().evaluate();
  assert.equal(missing.investedCapital, 200);
  for (const key of [
    "marketValue",
    "totalEquity",
    "unrealizedPL",
    "cashAllocation",
  ])
    assert.equal(missing[key], null);
  assert.equal(missing.positions[0].allocation, null);
  const zero = book([holding()], 0).evaluate(new Map([[asset.id, quote(0)]]));
  assert.equal(zero.positions[0].allocation, 0);
  assert.equal(zero.unrealizedPLPercentage, -100);
});
test("Portfolio rejects bad cash, duplicates, foreign currency and invalid quote maps", () => {
  for (const cash of [-1, Infinity, NaN, "1", null])
    assert.throws(() => book([], cash), DomainError);
  assert.throws(() => book([holding(), holding()]), DomainError);
  assert.throws(() => book([{}]), DomainError);
  const usd = new Asset({ ...fields, currency: "USD", exchange: "NASDAQ" });
  assert.throws(() => book([holding({ asset: usd })]), /currency conversion/);
  assert.equal(
    new Portfolio({ positions: [holding({ asset: usd })], baseCurrency: "USD" })
      .investedCapital,
    200,
  );
  assert.throws(() => book().evaluate({}), DomainError);
  assert.throws(
    () => book().evaluate(new Map([["wrong-key", quote(1)]])),
    DomainError,
  );
  const input = [holding()];
  const p = book(input);
  input.pop();
  assert.equal(p.positions.length, 1);
  assert.throws(() => p.positions.push(holding()), TypeError);
});
test("Decimal arithmetic avoids common binary artifacts without rounding to cents", () => {
  assert.equal(sum([0.1, 0.2]), 0.3);
  assert.equal(subtract(0.3, 0.1), 0.2);
  assert.equal(multiply(3, 0.1), 0.3);
  assert.equal(multiply(0.000001, 0.000001), 1e-12);
  assert.equal(
    holding({ quantity: 3, averageCost: 0.1 }).unrealizedPL(quote(0.2)),
    0.3,
  );
  assert.throws(() => multiply(Number.MAX_VALUE, 2), DomainError);
  assert.throws(() => multiply(Number.MIN_VALUE, 0.1), DomainError);
});
test("Legacy workspace adapter preserves records and reproduces demo totals", () => {
  const workspace = {
    cash: 8400,
    holdings: [
      { id: "h1", ticker: "PETR4", quantity: 300, cost: 28.5 },
      { id: "h2", ticker: "VALE3", quantity: 100, cost: 54.2 },
      { id: "h3", ticker: "WEGE3", quantity: 200, cost: 38.2 },
      { id: "h4", ticker: "ITUB4", quantity: 250, cost: 29.6 },
    ],
    scripts: [{ content: "saved" }],
  };
  const before = JSON.stringify(workspace),
    r = evaluate(workspace);
  assert.equal(r.investedCapital, 29010);
  assert.equal(r.marketValue, 33255);
  assert.equal(r.totalEquity, 41655);
  assert.equal(r.unrealizedPL, 4245);
  assert.equal(JSON.stringify(workspace), before);
  assert.ok(position(workspace.holdings[0]) instanceof Position);
  assert.equal(assets.find((a) => a.ticker === "AAPL").currency, "USD");
  assert.throws(
    () => position({ ...workspace.holdings[0], ticker: "UNKNOWN" }),
    DomainError,
  );
});
