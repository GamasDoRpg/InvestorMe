import { MarketDataError } from "../core/market-data/errors.mjs";
const endpoints = new Set(["/quote", "/time_series", "/symbol_search"]);
export function providerFailure(status, retryAfterMs = 0) {
  return new MarketDataError(
    status === 429
      ? "RATE_LIMIT"
      : [401, 403].includes(status)
        ? "AUTH_ERROR"
        : [400, 404].includes(status)
          ? "INVALID_SYMBOL"
          : "PROVIDER_ERROR",
    { retryAfterMs },
  );
}
export class TwelveHttpClient {
  #key;
  #fetch;
  constructor({
    apiKey,
    fetchImpl = globalThis.fetch,
    timeoutMs = 8000,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = Date.now,
  } = {}) {
    this.#key = typeof apiKey === "string" ? apiKey.trim() : "";
    this.#fetch = fetchImpl;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
      throw new TypeError("Invalid timeout");
    this.timeoutMs = timeoutMs;
    this.sleep = sleep;
    this.now = now;
  }
  async request(endpoint, params, { signal } = {}) {
    if (!endpoints.has(endpoint)) throw new MarketDataError("INVALID_REQUEST");
    if (!this.#key) throw new MarketDataError("AUTH_ERROR");
    const url = new URL(endpoint, "https://api.twelvedata.com");
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, String(value));
    // The host, endpoint set and credential handling are not renderer configurable.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal?.aborted) throw new MarketDataError("TIMEOUT");
      const controller = new AbortController();
      let timer;
      const abort = () => controller.abort();
      signal?.addEventListener("abort", abort, { once: true });
      try {
        return await Promise.race([
          (async () => {
            let response;
            try {
              response = await this.#fetch(url, {
                headers: { Authorization: `apikey ${this.#key}` },
                redirect: "error",
                signal: controller.signal,
              });
            } catch {
              throw new MarketDataError(
                controller.signal.aborted ? "TIMEOUT" : "NO_NETWORK",
              );
            }
            if (!response.ok) {
              const retry = response.headers.get("retry-after");
              const delay =
                retry === null
                  ? 60000
                  : /^\d+$/.test(retry)
                    ? Number(retry) * 1000
                    : Math.max(0, Date.parse(retry) - this.now());
              throw providerFailure(response.status, delay);
            }
            let data;
            try {
              const body = await response.text();
              if (body.length > 2_000_000) throw new Error("size");
              data = JSON.parse(body);
            } catch {
              throw new MarketDataError(
                controller.signal.aborted ? "TIMEOUT" : "INVALID_RESPONSE",
              );
            }
            if (!data || typeof data !== "object" || Array.isArray(data))
              throw new MarketDataError("INVALID_RESPONSE");
            if (data.status === "error")
              throw providerFailure(Number(data.code));
            return data;
          })(),
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new MarketDataError("TIMEOUT"));
            }, this.timeoutMs);
          }),
          new Promise((_, reject) => {
            controller.signal.addEventListener(
              "abort",
              () => reject(new MarketDataError("TIMEOUT")),
              { once: true },
            );
          }),
        ]);
      } catch (error) {
        const safe =
          error instanceof MarketDataError
            ? error
            : new MarketDataError("PROVIDER_ERROR");
        // At most one retry for network/server failures. Never retry 429/auth/timeout.
        if (
          attempt ||
          !["NO_NETWORK", "PROVIDER_ERROR"].includes(safe.code) ||
          signal?.aborted
        )
          throw safe;
        await this.sleep(300);
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      }
    }
  }
}
