const messages = Object.freeze({
  NO_NETWORK: "Sem conexão com o provedor.",
  RATE_LIMIT: "Limite do provedor atingido. Aguarde antes de atualizar.",
  INVALID_SYMBOL: "Ativo inexistente ou não suportado.",
  AUTH_ERROR: "Chave ausente, inválida ou plano sem acesso.",
  PROVIDER_ERROR: "O provedor não conseguiu atender à solicitação.",
  TIMEOUT: "O provedor excedeu o tempo limite.",
  INVALID_RESPONSE: "Resposta incompleta ou inválida do provedor.",
  INVALID_REQUEST: "Solicitação de mercado inválida.",
  UNSUPPORTED: "Operação ou intervalo não suportado.",
});
export class MarketDataError extends Error {
  constructor(code, { retryAfterMs = 0 } = {}) {
    super(messages[code] || messages.PROVIDER_ERROR);
    this.name = "MarketDataError";
    this.code = messages[code] ? code : "PROVIDER_ERROR";
    this.retryAfterMs = Number.isFinite(retryAfterMs)
      ? Math.max(0, Math.min(86400000, retryAfterMs))
      : 0;
  }
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      retryAfterMs: this.retryAfterMs,
    };
  }
}
export function normalizeError(error) {
  return error instanceof MarketDataError
    ? error
    : new MarketDataError("PROVIDER_ERROR");
}
