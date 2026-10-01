import { Asset, Quote } from "../core/index.mjs";
// Fixed illustrative snapshot; never presented as current market data.
const seed = [
  {
    ticker: "PETR4",
    name: "Petrobras",
    price: 36.5,
    change: 1.42,
    sector: "Energia",
    market: "Brasil",
    color: "green",
  },
  {
    ticker: "VALE3",
    name: "Vale",
    price: 62.1,
    change: -0.83,
    sector: "Mineração",
    market: "Brasil",
    color: "gold",
  },
  {
    ticker: "WEGE3",
    name: "WEG",
    price: 41.95,
    change: 2.15,
    sector: "Indústria",
    market: "Brasil",
    color: "blue",
  },
  {
    ticker: "ITUB4",
    name: "Itaú Unibanco",
    price: 30.82,
    change: 0.74,
    sector: "Financeiro",
    market: "Brasil",
    color: "orange",
  },
  {
    ticker: "BBDC4",
    name: "Bradesco",
    price: 12.43,
    change: -0.32,
    sector: "Financeiro",
    market: "Brasil",
    color: "red",
  },
  {
    ticker: "AAPL",
    name: "Apple",
    price: 207.15,
    change: 1.24,
    sector: "Tecnologia",
    market: "EUA",
    color: "blue",
  },
  {
    ticker: "NVDA",
    name: "NVIDIA",
    price: 126.45,
    change: 3.42,
    sector: "Tecnologia",
    market: "EUA",
    color: "green",
  },
  {
    ticker: "MSFT",
    name: "Microsoft",
    price: 448.37,
    change: 0.82,
    sector: "Tecnologia",
    market: "EUA",
    color: "purple",
  },
];

export const demoMarket = Object.freeze(
  seed.map(({ ticker, price, change, color, ...info }) => {
    const us = info.market === "EUA";
    const asset = new Asset({
      ...info,
      id: `${us ? "NASDAQ" : "B3"}:${ticker}`,
      symbol: ticker,
      exchange: us ? "NASDAQ" : "B3",
      currency: us ? "USD" : "BRL",
      country: us ? "US" : "BR",
      assetType: "equity",
    });
    const quote = new Quote({
      asset,
      timestamp: "2025-01-02T21:00:00Z",
      price,
      previousClose: price / (1 + change / 100),
    });
    return Object.freeze({ asset, quote, color });
  }),
);
