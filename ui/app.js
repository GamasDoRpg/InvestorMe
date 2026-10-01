"use strict";
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const uid = () => crypto.randomUUID();
const KEY = "investorme.workspace.v1";
const pages = [
  ["overview", "Visão geral", "◈"],
  ["portfolio", "Carteira", "◴"],
  ["markets", "Mercados", "▥"],
  ["strategies", "Estratégias", "◇"],
  ["models", "Modelos", "⬡"],
  ["backtests", "Testes", "⌁"],
  ["scripts", "Scripts", "⌘"],
  ["positions", "Posições", "◴"],
  ["performance", "Desempenho", "⌁"],
  ["income", "Rendimentos", "◴"],
  ["allocation", "Alocação", "◈"],
  ["risk", "Gestão de risco", "⬟"],
  ["alerts", "Alertas", "♧"],
  ["settings", "Configurações", "⚙"],
];
const finance = window.InvestorMeFinance;
const assets = finance.assets;
const defaults = () => ({
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
let state;
try {
  const stored = JSON.parse(localStorage.getItem(KEY));
  state =
    stored?.version === 1 &&
    Array.isArray(stored.holdings) &&
    Array.isArray(stored.strategies)
      ? { ...defaults(), ...stored }
      : defaults();
} catch {
  state = defaults();
}
try { finance.restoreAssets(state.marketAssets); }
catch { /* Keep persisted records for export; loading issues are made visible below. */
  setTimeout(() => toast("Catálogo salvo inválido; dados preservados para exportação."), 0);
}
let page = "overview",
  period = "6M",
  marketFilter = "Todos",
  assetQuery = "",
  selectedStrategy = state.strategies[0]?.id,
  alertFilter = "Todos",
  selectedModel = state.models[0]?.id;
let previousFocus,
  toastTimer,
  busy = false;
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    toast("Não foi possível salvar: armazenamento indisponível.");
  }
}
function money(n, currency = "BRL") {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}
function pct(n) {
  if (n === null || n === undefined) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2).replace(".", ",")}%`;
}
function asset(ticker) {
  return assets.find((a) => a.ticker === ticker);
}
function totals() {
  const t = finance.evaluate(state);
  return {
    ...t,
    invested: t.investedCapital,
    value: t.marketValue,
    profit: t.unrealizedPL,
    total: t.totalEquity,
  };
}

function button(label, action, kind = "", id = "") {
  return `<button type="button" class="button ${kind}" data-action="${action}" ${id ? `data-id="${escapeHTML(id)}"` : ""}>${label}</button>`;
}
function badge(label, kind = "green") {
  return `<span class="badge ${kind}">${escapeHTML(label)}</span>`;
}
function heading(title, actions = "") {
  return `<div class="page-heading"><div><h1>${title}</h1></div><div class="heading-actions">${actions}</div></div>`;
}
function panel(title, content, action = "", cls = "") {
  return `<section class="panel ${cls}"><div class="panel-heading"><h2>${title}</h2>${action}</div>${content}</section>`;
}
function stat(label, value, sub, icon = "↗", kind = "positive") {
  return `<div class="stat"><div class="stat-label">${label}<span class="stat-icon">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-sub ${kind}">${sub}</div></div>`;
}
function periods() {
  return `<div class="segments" aria-label="Período">${["1M", "3M", "6M", "1A", "Tudo"].map((p) => `<button data-action="period" data-id="${p}" class="${period === p ? "selected" : ""}">${p}</button>`).join("")}</div>`;
}
function chart(kind = "area") {
  const samples = {
    "1M": [90, 84, 89, 71, 75, 63, 72, 53, 56, 35, 44, 29],
    "3M": [112, 100, 107, 88, 83, 92, 71, 76, 60, 53, 58, 35],
    "6M": [
      134, 123, 130, 116, 105, 109, 96, 104, 86, 91, 72, 78, 59, 65, 39, 48, 27,
      35, 21,
    ],
    "1A": [
      140, 126, 138, 120, 125, 97, 107, 113, 85, 99, 72, 82, 64, 71, 55, 64, 35,
      42, 28,
    ],
    Tudo: [
      153, 147, 138, 148, 128, 133, 119, 111, 121, 97, 103, 85, 95, 66, 77, 50,
      63, 34, 42, 20,
    ],
  };
  const data = samples[period],
    points = data
      .map(
        (v, i) =>
          `${20 + (i * 660) / (data.length - 1)},${kind === "risk" ? 175 - v * 0.75 : v + 12}`,
      )
      .join(" ");
  return `<div class="chart"><div class="chart-axis"><span>${kind === "risk" ? "0%" : "150 mil"}</span><span>${kind === "risk" ? "-5%" : "100 mil"}</span><span>${kind === "risk" ? "-10%" : "50 mil"}</span><span>${kind === "risk" ? "-15%" : "0"}</span></div><svg viewBox="0 0 700 210" role="img" aria-label="Ilustração de ${kind === "risk" ? "drawdown" : "evolução"} com dados fictícios, período ${period}"><defs><linearGradient id="fill-${kind}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#14db99" stop-opacity=".25"/><stop offset="100%" stop-color="#14db99" stop-opacity="0"/></linearGradient></defs>${[35, 80, 125, 170].map((y) => `<line x1="20" y1="${y}" x2="680" y2="${y}" class="gridline"/>`).join("")}<polygon points="20,190 ${points} 680,190" fill="url(#fill-${kind})"/><polyline points="${points}" fill="none" stroke="#24dba0" stroke-width="2.5" stroke-linejoin="round"/><circle cx="680" cy="${points.split(" ").at(-1).split(",")[1]}" r="4" fill="#24dba0"/></svg><div class="chart-months">${(period === "1M" ? ["Semana 1", "Semana 2", "Semana 3", "Semana 4"] : ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"]).map((x) => `<span>${x}</span>`).join("")}</div></div>`;
}
function quoteFreshness(a) {
  if (!a.quote) return '<small>Cotação indisponível</small>';
  const old = !finance.status().demo && Date.now() - Date.parse(a.quote.timestamp) > 60000;
  return `<small>${finance.status().demo ? "Demo · " : ""}${escapeHTML(new Date(a.quote.timestamp).toLocaleString("pt-BR"))}${old ? " · cotação antiga / possível atraso" : ""}</small>`;
}
async function refreshMarket() {
  const task = finance.refresh();
  render();
  await task;
  render();
}
function assetCell(a) {
  return `<div class="asset-cell"><span class="asset-logo ${a.color}">${a.ticker.slice(0, 2)}</span><div><strong>${a.ticker}</strong><small>${escapeHTML(a.name)}</small></div></div>`;
}
function holdingsTable(full = false) {
  const valuation = totals();
  return `<div class="table-wrap"><table><thead><tr><th>Ativo</th><th>Quantidade</th><th>Preço médio</th><th>Preço</th><th>Resultado</th>${full ? "<th>Ações</th>" : ""}</tr></thead><tbody>${
    state.holdings
      .map((h) => {
        const a = asset(h.ticker),
          gain = valuation.positions.find((row) => row.position.id === h.id).unrealizedPL;
        return `<tr><td><button class="cell-button" data-action="asset" data-id="${a.ticker}">${assetCell(a)}</button></td><td>${h.quantity.toLocaleString("pt-BR")}</td><td>${money(h.cost)}</td><td>${money(a.price)}${quoteFreshness(a)}</td><td class="${gain >= 0 ? "positive" : "negative"}">${money(gain)}</td>${full ? `<td><button class="text-button" data-action="edit-holding" data-id="${h.id}">Editar</button></td>` : ""}</tr>`;
      })
      .join("") ||
    '<tr><td colspan="6" class="empty">Sua carteira está vazia. Adicione uma posição demonstrativa.</td></tr>'
  }</tbody></table></div>`;
}
function allocation() {
  const t = totals(),
    total = t.total;
  return `<div class="allocation"><div class="donut"><div><small>Patrimônio</small><strong>${money(total)}</strong><span>BRL</span></div></div><div class="legend">${state.holdings
    .map((h, i) => {
      const weight = t.positions.find((row) => row.position.id === h.id).allocation;
      return `<div><span class="legend-dot c${i % 5}"></span><span>${h.ticker}</span><strong>${weight === null ? "—" : weight.toFixed(1)}%</strong></div>`;
    })
    .join(
      "",
    )}<div><span class="legend-dot cash"></span><span>Caixa</span><strong>${t.cashAllocation === null ? "—" : t.cashAllocation.toFixed(1)}%</strong></div></div></div><p class="panel-note">Anel ilustrativo · Percentuais calculados com as cotações carregadas</p>`;
}
function overview() {
  const t = totals();
  return (
    heading(
      "Visão geral",
      button("↗ Exportar workspace", "export") +
        button("+ Adicionar posição", "add-holding", "primary"),
    ) +
    `<div class="stats">${stat("Patrimônio total", money(t.total), finance.modeLabel())}${stat("Resultado da carteira", money(t.profit), `${t.unrealizedPLPercentage === null ? "—" : pct(t.unrealizedPLPercentage)} sobre o custo`)}${stat("Estratégias ativas", state.strategies.filter((s) => s.status === "active").length, "Prontas para explorar", "◇")}${stat("Caixa disponível", money(state.cash), "Saldo editável na carteira", "◴", "muted")}</div><div class="grid overview-grid">${panel("Evolução da carteira", `<div class="chart-head"><strong>${money(t.total)}</strong><span class="subtle">Visualização ilustrativa</span>${badge("DADOS DEMO", "neutral")}</div>${chart()}`, periods())}${panel("Seu próximo movimento", `<div class="insight-icon">✦</div><h3>Da ideia à estratégia.</h3><p>Combine regras e explore novas possibilidades em um ambiente de pesquisa.</p>${button("Explorar estratégias ↗", "go-strategies", "primary")}<div class="insight-bottom"><span class="demo-dot"></span> Nenhuma operação real será enviada.</div>`, "", "insight-panel")}</div><div class="grid lower-grid">${panel("Posições da carteira", holdingsTable(), button("Ver carteira ↗", "go-portfolio", "text"))}${panel("Workspace em foco", `<div class="activity"><span class="activity-symbol green">◇</span><div><strong>${state.strategies.length} estratégias na biblioteca</strong><small>Crie, edite e pause suas ideias.</small></div></div><div class="activity"><span class="activity-symbol blue">⬡</span><div><strong>${state.models.length} modelos de pesquisa</strong><small>Configure seu laboratório.</small></div></div><div class="activity"><span class="activity-symbol purple">♧</span><div><strong>${state.alerts.filter((a) => a.enabled).length} regras de alerta ativas</strong><small>Regras demonstrativas, sem monitoramento real.</small></div></div><div class="small-callout">Seu progresso fica salvo neste dispositivo.</div>`)}</div>`
  );
}
function portfolio() {
  const t = totals();
  return (
    heading(
      "Carteira",
      button("Editar caixa", "cash") +
        button("+ Adicionar posição", "add-holding", "primary"),
    ) +
    `<div class="stats">${stat("Patrimônio total", money(t.total), finance.modeLabel())}${stat("Capital investido", money(t.invested), `${state.holdings.length} posições na carteira`, "◴", "muted")}${stat("Resultado", money(t.profit), "Calculado a partir das cotações carregadas")}${stat("Caixa", money(state.cash), "Disponível para simulação", "◈", "muted")}</div><div class="grid two-cols">${panel("Alocação da carteira", allocation())}${panel("Evolução ilustrativa", chart(), periods())}</div>${panel("Todas as posições", holdingsTable(true), badge("BRL · " + finance.modeLabel(), "neutral"))}`
  );
}
function markets() {
  const list = assets.filter(
    (a) =>
      (marketFilter === "Todos" || a.market === marketFilter) &&
      (a.ticker + " " + a.name)
        .toLowerCase()
        .includes(assetQuery.toLowerCase()),
  );
  return (
    heading("Mercados", button("Consultar provedor", "market-search") + button("★ Minha watchlist", "watchlist")) +
    panel(
      "Universo de ativos",
      `<div class="filterbar"><div class="segments">${["Todos", "Brasil", "EUA"].map((p) => `<button data-action="market-filter" data-id="${p}" class="${marketFilter === p ? "selected" : ""}">${p}</button>`).join("")}</div><input id="market-search" type="search" placeholder="Filtrar por nome ou ticker…" aria-label="Filtrar ativos" value="${escapeHTML(assetQuery)}"></div><div class="table-wrap"><table><thead><tr><th>Ativo</th><th>Mercado</th><th>Setor</th><th>Preço</th><th>Variação</th><th>Watchlist</th></tr></thead><tbody>${list.map((a) => `<tr><td><button class="cell-button" data-action="asset" data-id="${a.ticker}">${assetCell(a)}</button></td><td>${escapeHTML(a.market)}</td><td>${escapeHTML(a.sector)}</td><td>${money(a.price, a.currency)}${quoteFreshness(a)}</td><td class="${a.change >= 0 ? "positive" : "negative"}">${pct(a.change)}</td><td><button class="star-button ${state.watchlist.includes(a.ticker) ? "starred" : ""}" data-action="star" data-id="${a.ticker}" aria-label="${state.watchlist.includes(a.ticker) ? "Remover" : "Adicionar"} ${a.ticker} ${state.watchlist.includes(a.ticker) ? "da" : "à"} watchlist" aria-pressed="${state.watchlist.includes(a.ticker)}">${state.watchlist.includes(a.ticker) ? "★" : "☆"}</button></td></tr>`).join("") || '<tr><td colspan="6" class="empty">Nenhum ativo encontrado.</td></tr>'}</tbody></table></div>`,
      badge(`${list.length} ATIVOS`, "neutral"),
    )
  );
}
function strategies() {
  const s =
    state.strategies.find((x) => x.id === selectedStrategy) ||
    state.strategies[0];
  return (
    heading(
      "Estratégias",
      button("+ Nova estratégia", "add-strategy", "primary"),
    ) +
    `<div class="grid strategy-grid"><section class="strategy-library"><div class="section-label">BIBLIOTECA <span>${state.strategies.length}</span></div>${state.strategies.map((x) => `<button class="strategy-card ${s?.id === x.id ? "active" : ""}" data-action="select-strategy" data-id="${x.id}"><div class="strategy-card-top"><span class="activity-symbol ${x.type === "Value" ? "purple" : "green"}">${x.type === "Dividendos" ? "◴" : "▥"}</span>${badge(x.status === "active" ? "Ativa" : "Pausada", x.status === "active" ? "green" : "neutral")}</div><h3>${escapeHTML(x.name)}</h3><p>${escapeHTML(x.type)} · ${escapeHTML(x.universe)}</p><div class="strategy-card-foot"><span>Limite por posição</span><strong>${x.limit}%</strong></div></button>`).join("") || '<div class="empty">Crie sua primeira estratégia.</div>'}</section><div>${s ? panel(escapeHTML(s.name), `<div class="strategy-detail-tags">${badge(s.type, "blue")}${badge("SIMULAÇÃO", "neutral")}${badge(s.status === "active" ? "Ativa" : "Pausada", s.status === "active" ? "green" : "neutral")}</div><div class="rule"><span>01</span><div><small>UNIVERSO</small><strong>${escapeHTML(s.universe)}</strong></div></div><div class="rule"><span>02</span><div><small>CONDIÇÃO DE ENTRADA</small><strong>${escapeHTML(s.rule)}</strong></div></div><div class="rule"><span>03</span><div><small>GESTÃO DE CAPITAL</small><strong>Até ${s.limit}% do capital por posição</strong></div></div>${linkedComponents(s)}<div class="detail-actions">${button(s.status === "active" ? "Ⅱ Pausar estratégia" : "▷ Ativar estratégia", "toggle-strategy", "", s.id)}${button("Criar backtest ↗", "strategy-backtest", "primary", s.id)}</div><div class="small-callout">Ativar altera o estado local. A execução de estratégias será implementada em uma próxima etapa.</div>`, button("Editar regras", "edit-strategy", "text", s.id)) : panel("Sua biblioteca começa aqui", '<div class="empty">Adicione uma estratégia para configurar suas regras.</div>')}</div></div>`
  );
}
function models() {
  const m = state.models.find((x) => x.id === selectedModel) || state.models[0];
  return (
    heading("Modelos", button("+ Novo modelo", "add-model", "primary")) +
    `<div class="stats three">${stat("Modelos no workspace", state.models.length, "Biblioteca local", "⬡", "muted")}${stat("Modelos configurados", state.models.filter((x) => x.status === "ready").length, "Prontos para uma simulação", "✓")}${stat("Treinamento real", "Em breve", "Esta versão demonstra o fluxo", "⌁", "muted")}</div><div class="grid two-cols">${panel("Registro de modelos", `<div class="model-list">${state.models.map((x) => `<button class="model-row ${m?.id === x.id ? "selected" : ""}" data-action="select-model" data-id="${x.id}"><span class="activity-symbol blue">⬡</span><div><strong>${escapeHTML(x.name)}</strong><small>${escapeHTML(x.type)}</small></div>${badge(x.status === "ready" ? "Configurado" : "Rascunho", x.status === "ready" ? "green" : "neutral")}</button>`).join("")}</div>`)}${m ? panel("Detalhes do modelo", `<div class="model-detail-icon">⬡</div><h3>${escapeHTML(m.name)}</h3><p>${escapeHTML(m.type)}</p><dl class="details"><div><dt>Dataset</dt><dd>Exemplo demonstrativo</dd></div><div><dt>Validação</dt><dd>Walk-forward (planejado)</dd></div><div><dt>Última simulação</dt><dd>${m.lastRun ? escapeHTML(new Date(m.lastRun).toLocaleString("pt-BR")) : "Ainda não executada"}</dd></div></dl><div class="small-callout">O fluxo abaixo simula uma execução. Nenhum modelo é treinado e nenhuma previsão é gerada.</div>${modelLinks(m)}<div class="detail-actions">${button("Editar", "edit-model", "", m.id)}${button("▷ Simular treinamento", "train-model", "primary", m.id)}</div>`) : ""}</div>`
  );
}
function backtests() {
  return (
    heading("Testes", button("+ Novo backtest", "add-backtest", "primary")) +
    panel(
      "Histórico de testes",
      testFilterControl() +
        `<div class="table-wrap"><table><thead><tr><th>Teste</th><th>Estratégia</th><th>Período</th><th>Capital inicial</th><th>Status</th><th></th></tr></thead><tbody>${
          visibleBacktests()
            .map(
              (b) =>
                `<tr><td><strong>${escapeHTML(b.name)}</strong><small>${new Date(b.created).toLocaleDateString("pt-BR")}</small></td><td>${escapeHTML(b.strategy)}</td><td>${escapeHTML(b.start)} → ${escapeHTML(b.end)}</td><td>${money(b.capital)}</td><td>${badge("Demo concluída")}</td><td><button class="text-button" data-action="view-backtest" data-id="${b.id}">Ver detalhes ↗</button></td></tr>`,
            )
            .join("") ||
          '<tr><td colspan="6"><div class="empty-state"><span>⌁</span><h3>Nenhum teste salvo.</h3><p>Crie um backtest para conhecer o fluxo de pesquisa.</p>' +
            button("Criar backtest", "add-backtest", "primary") +
            "</div></td></tr>"
        }</tbody></table></div>`,
    )
  );
}
function risk() {
  const t = totals(),
    max = t.value === null ? null : Math.max(0, ...t.positions.map((row) => row.investedAllocation));
  return (
    heading(
      "Gestão de risco",
      button("Ajustar limites", "risk-limits", "primary"),
    ) +
    `<div class="stats three">${stat("Maior posição", (max === null ? "—" : max.toFixed(1) + "%"), max === null ? "Cotação indisponível" : max > state.risk.position ? "Acima do limite configurado" : "Dentro do limite configurado", "⬟", max > state.risk.position ? "negative" : "positive")}${stat("Limite por posição", state.risk.position + "%", "Parâmetro local editável", "◈", "muted")}${stat("Limite de drawdown", state.risk.drawdown + "%", "Sem monitoramento real", "⌁", "muted")}</div><div class="grid two-cols">${panel("Exposição da carteira", allocation())}${panel("Drawdown ilustrativo", chart("risk"), periods())}</div><div class="grid two-cols">${panel("Limites de pesquisa", `<dl class="details"><div><dt>Máximo por posição</dt><dd>${state.risk.position}%</dd></div><div><dt>Máximo por setor</dt><dd>${state.risk.sector}%</dd></div><div><dt>Drawdown máximo</dt><dd>${state.risk.drawdown}%</dd></div></dl><p class="panel-note">Parâmetros salvos para futuras integrações.</p>`)}${panel("Cenários de estresse", `<p>Explore o efeito aritmético de uma queda uniforme nas cotações carregadas.</p><label>Cenário<select id="stress-scenario"><option value="10">Correção moderada · −10%</option><option value="20">Queda acentuada · −20%</option><option value="35">Choque de mercado · −35%</option></select></label><div class="detail-actions">${button("Calcular cenário", "stress", "primary")}</div><div id="stress-result" aria-live="polite"></div>`)}</div>`
  );
}
function alerts() {
  const list = state.alerts.filter(
    (a) =>
      alertFilter === "Todos" ||
      (alertFilter === "Ativos" ? a.enabled : !a.read),
  );
  return (
    heading(
      "Alertas",
      button("Marcar todos como lidos", "read-alerts") +
        button("+ Criar alerta", "add-alert", "primary"),
    ) +
    `<div class="stats three">${stat("Regras ativas", state.alerts.filter((a) => a.enabled).length, "Configuração local", "♧")}${stat("Não lidos", state.alerts.filter((a) => !a.read).length, "Alertas de demonstração", "◷", "muted")}${stat("Entrega de notificações", "Local", "Sem envio de e-mail ou webhooks", "◈", "muted")}</div>` +
    panel(
      "Regras de alerta",
      `<div class="filterbar"><div class="segments">${["Todos", "Ativos", "Não lidos"].map((x) => `<button data-action="alert-filter" data-id="${x}" class="${x === alertFilter ? "selected" : ""}">${x}</button>`).join("")}</div></div><div class="table-wrap"><table><thead><tr><th>Ativo</th><th>Condição</th><th>Valor</th><th>Status</th><th>Ativado</th><th></th></tr></thead><tbody>${list.map((a) => `<tr><td>${assetCell(asset(a.ticker))}</td><td>${escapeHTML(a.condition)}</td><td>${a.condition.includes("%") ? a.value + "%" : money(a.value, asset(a.ticker).currency)}</td><td>${badge(a.read ? "Lido" : "Não lido", a.read ? "neutral" : "blue")}</td><td><button class="switch ${a.enabled ? "on" : ""}" data-action="toggle-alert" data-id="${a.id}" role="switch" aria-checked="${a.enabled}" aria-label="Ativar alerta de ${a.ticker}"></button></td><td><button class="text-button" data-action="edit-alert" data-id="${a.id}">Editar</button></td></tr>`).join("") || '<tr><td colspan="6" class="empty">Nenhum alerta neste filtro.</td></tr>'}</tbody></table></div>`,
    )
  );
}
function settings() {
  return (
    heading("Configurações") +
    `<div class="grid two-cols">${panel("Perfil do workspace", `<div class="profile-large"><span class="avatar">${escapeHTML(state.profile.charAt(0).toUpperCase())}</span><div><h3>${escapeHTML(state.profile)}</h3><p>Perfil local · Sem conta conectada</p></div>${button("Editar", "profile")}</div><dl class="details"><div><dt>Moeda da carteira</dt><dd>Real brasileiro (BRL)</dd></div><div><dt>Idioma</dt><dd>Português (Brasil)</dd></div><div><dt>Persistência</dt><dd>Neste dispositivo</dd></div></dl>`)}${panel(
      "Aparência",
      `<p>Escolha o ambiente que combina com sua pesquisa.</p><div class="theme-options">${[
        ["dark", "☾", "Escuro"],
        ["light", "☼", "Claro"],
        ["system", "▣", "Sistema"],
      ]
        .map(
          ([v, i, l]) =>
            `<button class="theme-option ${state.theme === v ? "active" : ""}" data-action="theme" data-id="${v}" aria-pressed="${state.theme === v}"><span>${i}</span>${l}</button>`,
        )
        .join(
          "",
        )}</div><label>Densidade da interface<select id="density"><option value="comfortable" ${state.density === "comfortable" ? "selected" : ""}>Confortável</option><option value="compact" ${state.density === "compact" ? "selected" : ""}>Compacta</option></select></label>`,
    )}${panel(
      "Preferências de notificações",
      `<p>Preferências locais para futuras integrações.</p>${[
        ["price", "Alertas de preço", "Mudanças nos ativos acompanhados"],
        ["portfolio", "Atualizações da carteira", "Posições e alocação"],
        ["news", "Notícias do mercado", "Contexto para sua pesquisa"],
      ]
        .map(
          ([k, l, d]) =>
            `<div class="setting-row"><div><strong>${l}</strong><small>${d}</small></div><button class="switch ${state.notifications[k] ? "on" : ""}" data-action="notification-pref" data-id="${k}" role="switch" aria-checked="${state.notifications[k]}" aria-label="${l}"></button></div>`,
        )
        .join("")}`,
    )}${panel("Dados & workspace", `<div class="setting-row"><div><strong>Exportar configurações</strong><small>Baixe suas posições, regras e preferências em JSON.</small></div>${button("Exportar", "export")}</div><div class="setting-row"><div><strong>Restaurar demonstração</strong><small>Substitui suas alterações pelos exemplos iniciais.</small></div>${button("Restaurar", "reset", "danger")}</div><div class="small-callout">${escapeHTML(finance.modeLabel())}. Corretoras e execução real não estão conectadas.</div>`)}</div>`
  );
}
const renderers = {
  overview,
  scripts,
  positions,
  performance,
  income,
  allocation: allocationPage,
  portfolio,
  markets,
  strategies,
  models,
  backtests,
  risk,
  alerts,
  settings,
};
function applyTheme() {
  document.documentElement.dataset.theme =
    state.theme === "system"
      ? matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : state.theme;
  document.documentElement.dataset.density = state.density;
}
function render() {
  applyTheme();
  const mainPages = [
    ["overview", "Visão geral", "◈"],
    ["portfolio", "Carteira", "◴"],
    ["markets", "Mercados", "▥"],
    ["laboratory", "Laboratório", "⬡"],
  ];
  $("#navigation").innerHTML = mainPages
    .map(
      ([id, label, icon]) =>
        `<a href="#${routePath(id)}" class="nav-link ${pageGroup(page) === id ? "active" : ""}" ${pageGroup(page) === id ? 'aria-current="page"' : ""}><span>${icon}</span>${label}${id === "alerts" && state.alerts.some((a) => !a.read) ? '<i class="nav-count">' + state.alerts.filter((a) => !a.read).length + "</i>" : ""}</a>`,
    )
    .join("");
  $("#breadcrumb").textContent =
    (pageGroup(page) === "laboratory"
      ? "Laboratório / "
      : pageGroup(page) === "portfolio" && page !== "portfolio"
        ? "Carteira / "
        : "") + pages.find((x) => x[0] === page)[1];
  $("#profile-name").innerHTML =
    `${escapeHTML(state.profile)}<small>Workspace local</small>`;
  $("#notification-dot").hidden = !state.alerts.some((a) => !a.read);
  try {
    $("#main").innerHTML = renderers[page]();
    applyPageLayout();
  } catch (error) {
    if (!(error instanceof finance.DomainError)) throw error;
    // Keep the stored workspace intact and offer repair/export instead of reset.
    $("#main").innerHTML = heading("Dados financeiros inválidos",
      button("Exportar workspace", "export") + button("Editar caixa", "cash")) +
      panel("Verifique os dados da carteira", `<p role="alert">${escapeHTML(error.message)}</p><p>Os dados foram preservados. Corrija ou exclua a posição inválida.</p>${state.holdings.map(h => `<div>${escapeHTML(h.ticker)} ${button("Editar", "edit-holding", "", h.id)} ${button("Excluir", "delete-holding", "danger", h.id)}</div>`).join("")}`);
  }
  renderSectionNavigation();
  if (["overview", "portfolio", "positions", "allocation", "risk", "markets"].includes(page)) {
    const info = finance.status();
    const banner = document.createElement("div");
    banner.className = "small-callout market-status";
    banner.setAttribute("role", "status");
    banner.innerHTML = `<strong>${escapeHTML(info.label)}</strong> ${button(info.refreshing ? "Carregando…" : "Atualizar cotações", "market-refresh")}<p>${escapeHTML(info.notice || (info.demo ? "Preços fictícios; nenhuma conexão externa." : "Timestamp do provedor em cada cotação. B3: fim de dia. Sem garantia de tempo real."))}</p>${info.oldestQuote ? `<p>Cotação mais antiga carregada: ${escapeHTML(new Date(info.oldestQuote).toLocaleString("pt-BR"))}</p>` : ""}${info.problems.map(message => `<p>${escapeHTML(message)} Valores anteriores, quando disponíveis, foram mantidos.</p>`).join("")}`;
    $(".page-heading", $("#main")).after(banner);
  }
  $(".demo-badge").textContent = finance.status().demo ? "Modo demo" : "Dados externos";
  $(".sandbox-card").innerHTML = `<span class="demo-dot"></span> ${finance.status().demo ? "Ambiente demonstrativo" : "Dados externos"}<p>Pesquisa local.<br />Nenhuma operação real.</p>`;
}
function route() {
  const id = routeId(location.hash.slice(1));
  page = renderers[id] ? id : "overview";
  if (location.hash !== "#" + routePath(page))
    history.replaceState(null, "", "#" + routePath(page));
  if (layoutEditingPage !== page) layoutEditingPage = null;
  render();
  $("#main").scrollTop = 0;
}
function go(id) {
  if (page === id) render();
  else location.hash = routePath(id);
}
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 3500);
}
function openModal(title, content, wide = false) {
  previousFocus = document.activeElement;
  const d = $("#modal");
  $("#modal-content").innerHTML =
    `<div class="modal-heading"><div><span class="eyebrow">INVESTORME · WORKSPACE DEMO</span><h2 id="modal-title">${title}</h2></div><button class="icon-button" data-action="close-modal" aria-label="Fechar janela">×</button></div>${content}`;
  d.classList.toggle("wide", wide);
  d.setAttribute("aria-labelledby", "modal-title");
  if (!d.open) d.showModal();
}
function closeModal() {
  if (busy) return;
  $("#modal").close();
  if (previousFocus?.isConnected) previousFocus.focus();
}
function field(label, name, value = "", type = "text", attrs = "") {
  return `<label>${label}<input name="${name}" type="${type}" value="${escapeHTML(value)}" ${attrs} required></label>`;
}
function selectField(label, name, options, value) {
  return `<label>${label}<select name="${name}">${options
    .map((o) => {
      const [v, l] = Array.isArray(o) ? o : [o, o];
      return `<option value="${escapeHTML(v)}" ${v === value ? "selected" : ""}>${escapeHTML(l)}</option>`;
    })
    .join("")}</select></label>`;
}
function form(type, fields, id = "", extra = "") {
  return `<form data-form="${type}" data-id="${id}"><div class="form-fields">${fields}</div><p class="form-error" role="alert"></p><div class="modal-footer">${extra}<span class="spacer"></span>${button("Cancelar", "close-modal")}<button class="button primary" type="submit">${type === "backtest" ? "Executar demo" : "Salvar"}</button></div></form>`;
}
function editHolding(id) {
  const h = state.holdings.find((x) => x.id === id);
  openModal(
    h ? "Editar posição" : "Adicionar posição",
    form(
      "holding",
      selectField(
        "Ativo (carteira em BRL)",
        "ticker",
        assets
          .filter((a) => a.market === "Brasil")
          .map((a) => [a.ticker, a.ticker + " · " + a.name]),
        h?.ticker,
      ) +
        `<div class="form-row">${field("Quantidade", "quantity", h?.quantity ?? 100, "number", 'min="1" max="100000000" step="1"')}${field("Preço médio (R$)", "cost", h?.cost ?? 30, "number", 'min="0.01" max="1000000000" step="0.01"')}</div><p class="panel-note">${escapeHTML(finance.modeLabel())}. Nenhuma ordem será enviada.</p>`,
      id,
      h ? button("Excluir", "delete-holding", "danger", id) : "",
    ),
  );
}
function editStrategy(id) {
  const s = state.strategies.find((x) => x.id === id);
  openModal(
    s ? "Editar estratégia" : "Nova estratégia",
    form(
      "strategy",
      field(
        "Nome da estratégia",
        "name",
        s?.name || "",
        "text",
        'maxlength="60"',
      ) +
        `<div class="form-row">${selectField("Estilo", "type", ["Momentum", "Value", "Dividendos", "Personalizada"], s?.type)}${selectField("Universo", "universe", ["Ações brasileiras", "Ações americanas", "Multiativos"], s?.universe)}</div><label>Regra de entrada<textarea name="rule" required maxlength="500" rows="3">${escapeHTML(s?.rule || "")}</textarea></label>` +
        field(
          "Limite por posição (%)",
          "limit",
          s?.limit || 5,
          "number",
          'min="1" max="100" step="1"',
        ),
      id,
      s ? button("Excluir", "delete-strategy", "danger", id) : "",
    ),
  );
}
function editModel(id) {
  const m = state.models.find((x) => x.id === id);
  openModal(
    m ? "Editar modelo" : "Novo modelo",
    form(
      "model",
      field("Nome do modelo", "name", m?.name || "", "text", 'maxlength="60"') +
        selectField(
          "Família de modelo",
          "type",
          [
            "Gradient Boosting",
            "Random Forest",
            "Regressão logística",
            "Rede neural",
          ],
          m?.type,
        ),
      id,
      m ? button("Excluir", "delete-model", "danger", id) : "",
    ),
  );
}
function editAlert(id) {
  const a = state.alerts.find((x) => x.id === id);
  openModal(
    a ? "Editar alerta" : "Criar alerta",
    form(
      "alert",
      selectField(
        "Ativo",
        "ticker",
        assets.map((a) => [a.ticker, a.ticker + " · " + a.name]),
        a?.ticker,
      ) +
        selectField(
          "Condição",
          "condition",
          ["Preço acima de", "Preço abaixo de", "Variação acima de (%)"],
          a?.condition,
        ) +
        field(
          "Valor (moeda do ativo ou %)",
          "value",
          a?.value || 40,
          "number",
          'min="0.01" max="1000000000" step="0.01"',
        ) +
        '<p class="panel-note">Regra salva localmente. Não há monitoramento de cotações.</p>',
      id,
      a ? button("Excluir", "delete-alert", "danger", id) : "",
    ),
  );
}
function newBacktest(strategyId) {
  if (!state.strategies.length) {
    toast("Crie uma estratégia antes de iniciar um backtest.");
    return;
  }
  openModal(
    "Novo backtest",
    form(
      "backtest",
      field("Nome", "name", "Meu backtest", "text", 'maxlength="60"') +
        selectField(
          "Estratégia",
          "strategy",
          state.strategies.map((s) => [s.id, s.name]),
          strategyId,
        ) +
        `<div class="form-row">${field("Início", "start", "2024-01-01", "date")}${field("Fim", "end", "2024-12-31", "date")}</div>` +
        field(
          "Capital inicial (R$)",
          "capital",
          10000,
          "number",
          'min="1" max="1000000000" step="0.01"',
        ) +
        '<div class="small-callout">Execução demonstrativa, sem dados históricos ou cálculo de rentabilidade.</div>',
    ),
  );
}
async function simulate(title, onDone) {
  busy = true;
  openModal(
    title,
    '<div class="simulation"><div class="spinner"></div><h3 id="simulation-stage">Preparando configuração…</h3><p>Simulação da interface · Nenhum cálculo real</p><progress id="simulation-progress" value="0" max="3"></progress></div>',
  );
  for (const [i, label] of [
    "Validando parâmetros…",
    "Percorrendo etapas do fluxo…",
    "Finalizando demonstração…",
  ].entries()) {
    await new Promise((r) => setTimeout(r, 450));
    $("#simulation-stage").textContent = label;
    $("#simulation-progress").value = i + 1;
  }
  busy = false;
  onDone();
  save();
  closeModal();
  render();
  toast("Simulação concluída. Nenhum resultado financeiro foi calculado.");
}
function showAsset(ticker) {
  const a = asset(ticker);
  openModal(
    `${a.ticker} · ${escapeHTML(a.name)}`,
    `<div class="asset-modal-head">${assetCell(a)}${badge(finance.modeLabel(), "neutral")}</div><div class="asset-price">${money(a.price, a.currency)} <small class="${a.change >= 0 ? "positive" : "negative"}">${pct(a.change)}</small>${quoteFreshness(a)}</div><dl class="details"><div><dt>Mercado</dt><dd>${escapeHTML(a.market)}</dd></div><div><dt>Setor</dt><dd>${escapeHTML(a.sector)}</dd></div></dl><div class="modal-footer">${button("Histórico diário", "market-history", "", ticker)}${button(state.watchlist.includes(ticker) ? "★ Remover da watchlist" : "☆ Adicionar à watchlist", "modal-star", "", ticker)}${a.market === "Brasil" ? button("+ Adicionar posição", "asset-position", "primary", ticker) : ""}</div>`,
  );
}
function showSearch() {
  openModal(
    "Encontre seu próximo passo.",
    `<input id="global-search" class="global-search" type="search" placeholder="Busque por ativo ou página…" aria-label="Busca global" autofocus><div id="search-results"></div>`,
  );
  renderSearch("");
}
function renderSearch(query) {
  const q = query.toLowerCase();
  $("#search-results").innerHTML =
    pages
      .filter((x) => x[1].toLowerCase().includes(q))
      .map(
        ([id, l, i]) =>
          `<button class="search-result" data-action="search-page" data-id="${id}"><span>${i}</span><strong>${l}</strong><small>Página ↗</small></button>`,
      )
      .join("") +
    assets
      .filter((a) => (a.ticker + " " + a.name).toLowerCase().includes(q))
      .map(
        (a) =>
          `<button class="search-result" data-action="asset" data-id="${a.ticker}">${assetCell(a)}<small>Ativo ↗</small></button>`,
      )
      .join("");
  if (!$("#search-results").children.length)
    $("#search-results").innerHTML =
      '<p class="empty">Nenhum resultado encontrado.</p>';
}
function confirmDelete(type, id) {
  const types = {
    holding: ["posição", "holdings"],
    strategy: ["estratégia", "strategies"],
    model: ["modelo", "models"],
    alert: ["alerta", "alerts"],
  };
  const [label, key] = types[type];
  openModal(
    `Excluir ${label}?`,
    `<p>O item será removido deste workspace local.</p><div class="modal-footer">${button("Cancelar", "close-modal")}${button("Confirmar exclusão", "confirm-delete", "danger", key + ":" + id)}</div>`,
  );
}
async function exportWorkspace() {
  try {
    const data = JSON.stringify(state, null, 2);
    if (window.desktop) {
      if (await window.desktop.exportWorkspace(data))
        toast("Workspace exportado.");
    } else {
      const url = URL.createObjectURL(
        new Blob([data], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "investorme-workspace.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("Exportação iniciada.");
    }
  } catch {
    toast("Não foi possível exportar o workspace.");
  }
}
document.addEventListener("click", async (event) => {
  const el = event.target.closest("[data-action],[data-window]");
  if (!el) return;
  if (el.dataset.window) {
    window.desktop?.windowAction(el.dataset.window);
    return;
  }
  const action = el.dataset.action,
    id = el.dataset.id;
  if (busy) return;
  if (action.startsWith("go-")) {
    go(action.slice(3));
    return;
  }
  if (action.startsWith("delete-")) {
    confirmDelete(action.slice(7), id);
    return;
  }
  switch (action) {
    case "market-refresh":
      await refreshMarket();
      break;
    case "market-search":
      try {
        await finance.searchAssets(assetQuery);
        state.marketAssets = finance.assets.map(row => row.asset);
        save();
        render();
      } catch (error) { toast(error.message); }
      break;
    case "market-history":
      try {
        const end = new Date().toISOString().slice(0, 10);
        const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const candles = await finance.getHistory(id, { timeframe: "1d", start, end });
        openModal("Histórico diário · " + escapeHTML(id), `<p>${escapeHTML(finance.modeLabel())}. Datas de sessão; OHLCV sem indicadores. Últimos 30 dias.</p><div class="table-wrap"><table><thead><tr><th>Data</th><th>Abertura</th><th>Máxima</th><th>Mínima</th><th>Fechamento</th><th>Volume</th></tr></thead><tbody>${candles.map(c => `<tr><td>${c.timestamp.slice(0,10)}</td><td>${money(c.open, asset(id).currency)}</td><td>${money(c.high, asset(id).currency)}</td><td>${money(c.low, asset(id).currency)}</td><td>${money(c.close, asset(id).currency)}</td><td>${c.volume}</td></tr>`).join("") || '<tr><td colspan="6">Sem dados no período.</td></tr>'}</tbody></table></div>`);
      } catch (error) { toast(error.message); }
      break;
    case "close-modal":
      closeModal();
      break;
    case "search":
      showSearch();
      break;
    case "search-page":
      closeModal();
      go(id);
      break;
    case "notifications":
      go("alerts");
      break;
    case "period":
      period = id;
      render();
      break;
    case "add-holding":
      editHolding();
      break;
    case "edit-holding":
      editHolding(id);
      break;
    case "asset-position":
      editHolding();
      $('[name="ticker"]').value = id;
      break;
    case "asset":
      showAsset(id);
      break;
    case "cash":
      openModal(
        "Editar caixa",
        form(
          "cash",
          field(
            "Saldo disponível (R$)",
            "cash",
            state.cash,
            "number",
            'min="0" max="1000000000" step="0.01"',
          ),
        ),
      );
      break;
    case "star":
    case "modal-star":
      state.watchlist = state.watchlist.includes(id)
        ? state.watchlist.filter((x) => x !== id)
        : [...state.watchlist, id];
      save();
      render();
      if (action === "modal-star") showAsset(id);
      break;
    case "watchlist":
      openModal(
        "Minha watchlist",
        `<div class="model-list">${state.watchlist.map((t) => `<button class="search-result" data-action="asset" data-id="${t}">${assetCell(asset(t))}<small>Ver detalhes ↗</small></button>`).join("") || '<div class="empty">Marque a estrela de um ativo para adicioná-lo aqui.</div>'}</div>`,
      );
      break;
    case "market-filter":
      marketFilter = id;
      render();
      break;
    case "add-strategy":
      editStrategy();
      break;
    case "edit-strategy":
      editStrategy(id);
      break;
    case "select-strategy":
      selectedStrategy = id;
      render();
      break;
    case "toggle-strategy": {
      const s = state.strategies.find((x) => x.id === id);
      s.status = s.status === "active" ? "paused" : "active";
      save();
      render();
      toast("Estado da estratégia atualizado.");
      break;
    }
    case "strategy-backtest":
      newBacktest(id);
      break;
    case "add-model":
      editModel();
      break;
    case "edit-model":
      editModel(id);
      break;
    case "select-model":
      selectedModel = id;
      render();
      break;
    case "train-model":
      await simulate("Simular treinamento", () => {
        const m = state.models.find((x) => x.id === id);
        m.status = "ready";
        m.lastRun = new Date().toISOString();
      });
      break;
    case "add-backtest":
      newBacktest();
      break;
    case "view-backtest": {
      const b = state.backtests.find((x) => x.id === id);
      openModal(
        escapeHTML(b.name),
        `<dl class="details"><div><dt>Estratégia</dt><dd>${escapeHTML(b.strategy)}</dd></div><div><dt>Período</dt><dd>${escapeHTML(b.start)} → ${escapeHTML(b.end)}</dd></div><div><dt>Capital inicial</dt><dd>${money(b.capital)}</dd></div></dl><div class="small-callout">Fluxo demonstrativo concluído. Não foram calculados retorno, Sharpe ou drawdown. O motor de backtesting ainda não está implementado.</div><div class="modal-footer">${button("Fechar", "close-modal", "primary")}</div>`,
      );
      break;
    }
    case "risk-limits":
      openModal(
        "Limites de risco",
        form(
          "risk",
          field(
            "Máximo por posição (%)",
            "position",
            state.risk.position,
            "number",
            'min="1" max="100"',
          ) +
            field(
              "Máximo por setor (%)",
              "sector",
              state.risk.sector,
              "number",
              'min="1" max="100"',
            ) +
            field(
              "Drawdown máximo (%)",
              "drawdown",
              state.risk.drawdown,
              "number",
              'min="1" max="100"',
            ),
        ),
      );
      break;
    case "stress": {
      const drop = Number($("#stress-scenario").value) / 100,
        t = totals();
      if (t.value === null) { toast("Cotações indisponíveis para calcular o cenário."); break; }
      $("#stress-result").innerHTML =
        `<div class="small-callout"><strong>Impacto: <span class="negative">−${money(t.value * drop)}</span></strong><p>Patrimônio após o cenário: ${money(t.total - t.value * drop)}. Caixa preservado. Cálculo simplificado, sem previsão de mercado.</p></div>`;
      break;
    }
    case "add-alert":
      editAlert();
      break;
    case "edit-alert":
      editAlert(id);
      break;
    case "toggle-alert": {
      const a = state.alerts.find((x) => x.id === id);
      a.enabled = !a.enabled;
      save();
      render();
      break;
    }
    case "read-alerts":
      state.alerts.forEach((a) => (a.read = true));
      save();
      render();
      toast("Todos os alertas foram marcados como lidos.");
      break;
    case "alert-filter":
      alertFilter = id;
      render();
      break;
    case "notification-pref":
      state.notifications[id] = !state.notifications[id];
      save();
      render();
      break;
    case "profile":
      openModal(
        "Seu perfil",
        form(
          "profile",
          field(
            "Nome de exibição",
            "profile",
            state.profile,
            "text",
            'maxlength="40"',
          ),
        ),
      );
      break;
    case "theme":
      state.theme = id;
      save();
      render();
      break;
    case "export":
      await exportWorkspace();
      break;
    case "reset":
      openModal(
        "Restaurar demonstração?",
        `<p>Suas posições, estratégias, modelos e preferências locais serão substituídos pelos exemplos iniciais. Exporte o workspace antes se quiser guardar uma cópia.</p><div class="modal-footer">${button("Cancelar", "close-modal")}${button("Restaurar dados demo", "confirm-reset", "danger")}</div>`,
      );
      break;
    case "confirm-reset":
      state = defaults();
      selectedStrategy = state.strategies[0].id;
      selectedModel = state.models[0].id;
      save();
      closeModal();
      render();
      toast("Demonstração restaurada.");
      break;
    case "confirm-delete": {
      const [key, itemId] = id.split(":");
      state[key] = state[key].filter((x) => x.id !== itemId);
      save();
      closeModal();
      render();
      toast("Item excluído.");
      break;
    }
  }
});
document.addEventListener("submit", async (event) => {
  const f = event.target;
  if (!f.dataset.form) return;
  event.preventDefault();
  const d = Object.fromEntries(new FormData(f));
  const id = f.dataset.id;
  for (const [k, v] of Object.entries(d))
    if (typeof v === "string") d[k] = v.trim();
  if (Object.values(d).some((v) => v === "")) {
    $(".form-error", f).textContent = "Preencha todos os campos.";
    return;
  }
  const number = (k) => Number(d[k]);
  switch (f.dataset.form) {
    case "holding": {
      const other = state.holdings.find(
        (h) => h.ticker === d.ticker && h.id !== id,
      );
      if (other) {
        $(".form-error", f).textContent =
          "Este ativo já está na carteira. Edite a posição existente.";
        return;
      }
      const h = {
        id: id || uid(),
        ticker: d.ticker,
        quantity: number("quantity"),
        cost: number("cost"),
      };
      try {
        finance.validatePosition(h);
      } catch (error) {
        if (!(error instanceof finance.DomainError)) throw error;
        $(".form-error", f).textContent = "Posição inválida: " + error.message;
        return;
      }
      if (id) state.holdings = state.holdings.map((x) => (x.id === id ? h : x));
      else state.holdings.push(h);
      break;
    }
    case "cash":
      try {
        finance.validateCash(number("cash"));
      } catch (error) {
        if (!(error instanceof finance.DomainError)) throw error;
        $(".form-error", f).textContent = "Caixa inválido: " + error.message;
        return;
      }
      state.cash = number("cash");
      break;
    case "profile":
      state.profile = d.profile;
      break;
    case "strategy": {
      const s = {
        ...state.strategies.find((x) => x.id === id),
        id: id || uid(),
        ...d,
        limit: number("limit"),
        status: state.strategies.find((x) => x.id === id)?.status || "paused",
      };
      if (id)
        state.strategies = state.strategies.map((x) => (x.id === id ? s : x));
      else state.strategies.push(s);
      selectedStrategy = s.id;
      break;
    }
    case "model": {
      const previous = state.models.find((x) => x.id === id);
      const m = {
        ...previous,
        id: id || uid(),
        ...d,
        status: previous?.status || "draft",
      };
      if (id) state.models = state.models.map((x) => (x.id === id ? m : x));
      else state.models.push(m);
      selectedModel = m.id;
      break;
    }
    case "alert": {
      const a = {
        id: id || uid(),
        ...d,
        value: number("value"),
        enabled: state.alerts.find((x) => x.id === id)?.enabled ?? true,
        read: false,
      };
      if (id) state.alerts = state.alerts.map((x) => (x.id === id ? a : x));
      else state.alerts.push(a);
      break;
    }
    case "risk":
      state.risk = {
        position: number("position"),
        sector: number("sector"),
        drawdown: number("drawdown"),
      };
      break;
    case "backtest":
      if (d.start >= d.end) {
        $(".form-error", f).textContent =
          "A data final precisa ser posterior à data inicial.";
        return;
      }
      await simulate("Executando backtest demo", () => {
        state.backtests.unshift({
          id: uid(),
          name: d.name,
          strategy: state.strategies.find((s) => s.id === d.strategy).name,
          strategyId: d.strategy,
          start: d.start,
          end: d.end,
          capital: number("capital"),
          created: new Date().toISOString(),
        });
        page = "backtests";
        location.hash = routePath("backtests");
      });
      return;
  }
  save();
  closeModal();
  render();
  toast("Alterações salvas no workspace.");
});
document.addEventListener("input", (event) => {
  if (event.target.id === "global-search") renderSearch(event.target.value);
  if (event.target.id === "market-search") {
    assetQuery = event.target.value;
    const pos = event.target.selectionStart;
    render();
    const input = $("#market-search");
    input.focus();
    try {
      input.setSelectionRange(pos, pos);
    } catch {}
  }
});
document.addEventListener("change", (event) => {
  if (event.target.id === "density") {
    state.density = event.target.value;
    save();
    applyTheme();
  }
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (!busy) showSearch();
  }
});
$("#modal").addEventListener("cancel", (event) => {
  event.preventDefault();
  closeModal();
});
$("#modal").addEventListener("click", (event) => {
  if (event.target === $("#modal")) {
    const r = event.target.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      closeModal();
  }
});
window.addEventListener("hashchange", route);
matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
  if (state.theme === "system") applyTheme();
});
if (!window.desktop) $("#window-controls").hidden = true;
window.desktop?.onMaximized((maximized) => {
  const b = $('[data-window="maximize"]');
  b.textContent = maximized ? "❐" : "□";
  b.setAttribute("aria-label", maximized ? "Restaurar janela" : "Maximizar");
});
route();
void refreshMarket();
