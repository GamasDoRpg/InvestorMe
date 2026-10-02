// Old release fingerprints are only used to remove unmodified example records.
const legacyDefaults = () => ({
  version: 1,
  profile: "Meu perfil",
  theme: "dark",
  density: "comfortable",
  cash: 8400,
  watchlist: ["PETR4", "VALE3", "WEGE3", "AAPL", "NVDA"],
  holdings: [
    { id: "h1", ticker: "PETR4", quantity: 300, cost: 28.5 },
    { id: "h2", ticker: "VALE3", quantity: 100, cost: 54.2 },
    { id: "h3", ticker: "WEGE3", quantity: 200, cost: 38.2 },
    { id: "h4", ticker: "ITUB4", quantity: 250, cost: 29.6 },
  ],
  strategies: [
    {
      id: "s1",
      name: "Momentum Core",
      type: "Momentum",
      universe: "Ações brasileiras",
      status: "active",
      rule: "RSI abaixo de 40 e preço acima da média de 200 dias",
      limit: 5,
    },
    {
      id: "s2",
      name: "Value & Quality",
      type: "Value",
      universe: "Ações brasileiras",
      status: "paused",
      rule: "P/L abaixo de 12 e ROE acima de 15%",
      limit: 8,
    },
    {
      id: "s3",
      name: "Dividend Income",
      type: "Dividendos",
      universe: "Ações brasileiras",
      status: "active",
      rule: "Dividend yield acima de 6%",
      limit: 10,
    },
  ],
  models: [
    {
      id: "m1",
      name: "Price Momentum",
      type: "Gradient Boosting",
      status: "ready",
    },
    {
      id: "m2",
      name: "Mean Reversion",
      type: "Random Forest",
      status: "ready",
    },
    {
      id: "m3",
      name: "Regime de mercado",
      type: "Regressão logística",
      status: "draft",
    },
  ],
  alerts: [
    {
      id: "a1",
      ticker: "PETR4",
      condition: "Preço acima de",
      value: 38,
      enabled: true,
      read: false,
    },
    {
      id: "a2",
      ticker: "NVDA",
      condition: "Preço abaixo de",
      value: 120,
      enabled: true,
      read: false,
    },
    {
      id: "a3",
      ticker: "VALE3",
      condition: "Variação acima de (%)",
      value: 3,
      enabled: false,
      read: true,
    },
  ],
  notifications: { price: true, portfolio: true, news: false },
  risk: { position: 25, sector: 40, drawdown: 15 },
  backtests: [],
  scripts: [],
});
export function emptyWorkspace() {
 return {version:1, dataRevision:2, profile:"Meu perfil", theme:"dark", density:"comfortable", cash:0,
   watchlist:[], holdings:[], strategies:[], models:[], alerts:[], backtests:[], scripts:[],
   notifications:{price:true,portfolio:true,news:false}, risk:{position:25,sector:40,drawdown:15}};
}
const same = (a,b) => Object.keys(a).length === Object.keys(b).length && Object.keys(b).every(k => a[k] === b[k]);
export function migrateWorkspace(input) {
 if (!input || input.version !== 1 || !Array.isArray(input.holdings) || !Array.isArray(input.strategies)) return emptyWorkspace();
 const result = {...emptyWorkspace(), ...structuredClone(input)};
 if (input.dataRevision === 2) return result;
 const old = legacyDefaults();
 for (const key of ["holdings","strategies","models","alerts"])
  result[key] = (result[key] || []).filter(row => !old[key].some(seed => same(row,seed)));
 if (result.cash === old.cash) result.cash = 0;
 if (JSON.stringify(result.watchlist) === JSON.stringify(old.watchlist)) result.watchlist = [];
 result.models = result.models.map(({lastRun, ...model}) => ({...model, status:"draft"}));
 result.backtests = result.backtests.map(({result, metrics, ...config}) => ({...config, status:"draft"}));
 result.dataRevision=2;
 return result;
}
