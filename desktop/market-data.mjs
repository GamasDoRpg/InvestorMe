import { Asset } from "../core/index.mjs";
import { MarketDataService } from "../core/market-data/MarketDataService.mjs";
import {
  MarketDataError,
  normalizeError,
} from "../core/market-data/errors.mjs";
import {
  validateAssets,
  validateHistory,
  validateQuery,
} from "../core/market-data/contract.mjs";
import { UnavailableMarketDataProvider } from "../providers/UnavailableMarketDataProvider.mjs";
import { TwelveDataProvider } from "../providers/TwelveDataProvider.mjs";
import { BrapiProvider } from "../providers/BrapiProvider.mjs";
import { RoutedMarketDataProvider } from "../providers/RoutedMarketDataProvider.mjs";
const baseInfo = {
  provider: "disabled",
  demo: false,
  label: "Sem conexão com provedores",
  notice: null,
};
export function createMarketBackend(env = {}, dependencies = {}) {
  const selected = env.MARKET_DATA_PROVIDER || "disabled";
  const logger =
    dependencies.logger ||
    (env.MARKET_DATA_DEBUG === "1"
      ? (event) => console.info("[market-data]", JSON.stringify(event))
      : () => {});
  let provider, info;
  if (["brapi", "combined"].includes(selected)) {
    const brazil = new MarketDataService(new BrapiProvider({ ...dependencies, apiKey: env.BRAPI_API_KEY }), { logger, ...dependencies.serviceOptions });
    const hasUS = selected === "combined" && typeof env.TWELVE_DATA_API_KEY === "string" && !!env.TWELVE_DATA_API_KEY.trim();
    const us = hasUS ? new MarketDataService(new TwelveDataProvider({ ...dependencies, apiKey: env.TWELVE_DATA_API_KEY }), { logger, ...dependencies.serviceOptions }) : null;
    provider = new RoutedMarketDataProvider({ brazil, us });
    info = { provider: selected, demo: false, quoteBatchSize: 1,
      label: hasUS ? "brapi (B3) + Twelve Data (EUA)" : "brapi · ações brasileiras",
      notice: "B3: atraso aproximado de 30 min no plano gratuito. " +
        (env.BRAPI_API_KEY?.trim() ? "Token brapi configurado. " : "Sem token: apenas PETR4, VALE3, ITUB4 e MGLU3. ") +
        (hasUS ? "EUA: conforme plano Twelve Data." : "EUA indisponíveis; use combined com TWELVE_DATA_API_KEY para habilitar.") };
  } else if (
    selected === "twelve" &&
    typeof env.TWELVE_DATA_API_KEY === "string" &&
    env.TWELVE_DATA_API_KEY.trim()
  ) {
    provider = new TwelveDataProvider({
      ...dependencies,
      apiKey: env.TWELVE_DATA_API_KEY,
    });
    info = {
      provider: "twelve",
      demo: false,
      label: "Twelve Data · B3: fim de dia; EUA: conforme plano",
      notice: "Chave configurada. Acesso às cotações conforme seu plano.",
    };
  } else {
    provider = new UnavailableMarketDataProvider();
    info = {
      ...baseInfo,
      notice:
        selected === "twelve"
          ? "Chave Twelve Data ausente. Configure sua conta."
          : selected !== "disabled"
            ? "Provedor indisponível. Configure sua conta."
            : "Adicione suas chaves na conta para receber cotações.",
    };
  }
  try {
    logger({ provider: info.provider, status: "selected" });
  } catch {}
  const service = provider instanceof RoutedMarketDataProvider ? provider : new MarketDataService(provider, {
    logger,
    ...dependencies.serviceOptions,
  });
  return { service, info: Object.freeze(info) };
}
function assetFromWire(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new MarketDataError("INVALID_REQUEST");
  const fields = [
    "id",
    "symbol",
    "exchange",
    "name",
    "currency",
    "assetType",
    "sector",
    "market",
    "country",
  ];
  if (
    Object.keys(value).some((key) => !fields.includes(key)) ||
    Object.values(value).some((v) => typeof v !== "string" || v.length > 200)
  )
    throw new MarketDataError("INVALID_REQUEST");
  try {
    return new Asset(value);
  } catch {
    throw new MarketDataError("INVALID_REQUEST");
  }
}
// Main-only IPC boundary. No URLs, headers, configuration or credentials accepted.
export function createMarketHandler(backend, trusted) {
  let active = 0;
  return async (event, request) => {
    try {
      if (
        !trusted(event) ||
        !request ||
        typeof request !== "object" ||
        Array.isArray(request) ||
        Object.keys(request).some((k) => !["method", "args"].includes(k)) ||
        !Array.isArray(request.args)
      )
        throw new MarketDataError("INVALID_REQUEST");
      if (active >= 8)
        throw new MarketDataError("RATE_LIMIT", { retryAfterMs: 1000 });
      const { method, args } = request;
      if (method === "info" && args.length === 0)
        return { ok: true, data: backend.info };
      const arity = {
        getQuote: 1,
        getQuotes: 1,
        getHistory: 2,
        searchAssets: 1,
      };
      if (!Object.hasOwn(arity, method) || args.length !== arity[method])
        throw new MarketDataError("INVALID_REQUEST");
      let input;
      if (method === "searchAssets") input = [validateQuery(args[0])];
      else if (method === "getQuotes") {
        if (!Array.isArray(args[0]) || args[0].length > 50)
          throw new MarketDataError("INVALID_REQUEST");
        input = [validateAssets(args[0].map(assetFromWire))];
      } else
        input =
          method === "getQuote"
            ? [assetFromWire(args[0])]
            : [assetFromWire(args[0]), validateHistory(args[1])];
      active++;
      try {
        const data = await backend.service[method](...input);
        return {
          ok: true,
          data: data instanceof Map ? [...data.values()] : data,
        };
      } finally {
        active--;
      }
    } catch (error) {
      return { ok: false, error: normalizeError(error).toJSON() };
    }
  };
}
