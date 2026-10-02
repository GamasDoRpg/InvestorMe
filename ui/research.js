"use strict";
const labSections = [
  ["strategies", "Estratégias"],
  ["models", "Modelos"],
  ["scripts", "Scripts"],
  ["backtests", "Testes"],
];
const portfolioSections = [
  ["portfolio", "Resumo"],
  ["positions", "Posições"],
  ["performance", "Desempenho"],
  ["income", "Rendimentos"],
  ["allocation", "Alocação"],
  ["risk", "Risco"],
];
function routePath(id) {
  if (id === "laboratory") return "lab/strategies";
  if (labSections.some(([key]) => key === id)) return "lab/" + id;
  if (portfolioSections.some(([key]) => key === id))
    return id === "portfolio" ? "portfolio" : "portfolio/" + id;
  return id;
}
function routeId(hash) {
  return hash === "laboratory" || hash === "lab"
    ? "strategies"
    : hash.startsWith("lab/") || hash.startsWith("portfolio/")
      ? hash.split("/")[1]
      : hash;
}
function pageGroup(id) {
  return labSections.some(([key]) => key === id)
    ? "laboratory"
    : portfolioSections.some(([key]) => key === id)
      ? "portfolio"
      : id;
}
function renderSectionNavigation() {
  const group = pageGroup(page),
    sections =
      group === "laboratory"
        ? labSections
        : group === "portfolio"
          ? portfolioSections
          : null;
  $("#main").dataset.page = page;
  if (sections) {
    const nav = document.createElement("nav");
    nav.className = "section-tabs";
    nav.setAttribute(
      "aria-label",
      group === "laboratory" ? "Seções do Laboratório" : "Seções da Carteira",
    );
    nav.innerHTML = sections
      .map(
        ([id, label]) =>
          `<a href="#${routePath(id)}" ${id === page ? 'aria-current="page"' : ""}>${label}</a>`,
      )
      .join("");
    $("#main").prepend(nav);
  }
}
let selectedScript = null;
function scriptList() {
  state.scripts ||= [];
  return state.scripts;
}
function scriptButton(label, action, id = "", kind = "") {
  return `<button type="button" class="button ${kind}" data-script="${action}" data-id="${id}">${label}</button>`;
}
function scripts() {
  const list = scriptList(),
    s = list.find((x) => x.id === selectedScript) || list[0];
  selectedScript = s?.id;
  const library =
    list
      .map(
        (x) =>
          `<button type="button" class="script-item ${x.id === s?.id ? "selected" : ""}" data-script="select" data-id="${x.id}"><span>⌘</span><div><strong>${escapeHTML(x.name)}</strong><small>${escapeHTML(x.language)} · ${escapeHTML(x.kind)}</small></div></button>`,
      )
      .join("") || '<div class="empty">Nenhum script salvo.</div>';
  return (
    heading("Scripts", scriptButton("+ Novo script", "new", "", "primary")) +
    `<div class="grid two-cols script-grid">${panel("Arquivos", library)}${panel(s ? escapeHTML(s.name) : "Editor", s ? `<div class="editor-meta">${badge(s.language, "blue")}${badge("EDIÇÃO LOCAL", "neutral")}<span id="script-save-status" role="status">Salvo neste dispositivo</span></div><label class="code-label" for="script-source">Código-fonte</label><textarea id="script-source" class="code-editor" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Código-fonte do script">${escapeHTML(s.content)}</textarea><div class="editor-footer"><span id="script-lines">${s.content.split("\n").length} linhas</span><span>Execução indisponível nesta versão</span></div><div class="detail-actions">${scriptButton("Salvar", "save", s.id, "primary")}${scriptButton("Duplicar", "duplicate", s.id)}${scriptButton("Propriedades", "properties", s.id)}${scriptButton("Excluir", "delete", s.id, "danger")}</div><dl class="details"><div><dt>Estratégia</dt><dd>${escapeHTML(state.strategies.find((x) => x.id === s.strategyId)?.name || "Sem vínculo")}</dd></div><div><dt>Modelo</dt><dd>${escapeHTML(state.models.find((x) => x.id === s.modelId)?.name || "Sem vínculo")}</dd></div></dl>` : '<div class="empty">Crie um arquivo para começar a escrever. O editor salva o código, sem executá-lo.</div>')}</div>`
  );
}
function scriptProperties(id) {
  const s = scriptList().find((x) => x.id === id);
  openModal(
    s ? "Propriedades do script" : "Novo script",
    `<form data-research-form="script" data-id="${id || ""}"><div class="form-fields">${field("Nome do arquivo", "name", s?.name || "estrategia.py", "text", 'maxlength="80"')}${selectField("Linguagem", "language", ["Python", "JavaScript"], s?.language)}${selectField("Tipo", "kind", ["Estratégia", "Modelo", "Indicador", "Utilitário"], s?.kind)}${selectField("Estratégia associada", "strategyId", [["", "Sem vínculo"], ...state.strategies.map((x) => [x.id, x.name])], s?.strategyId || "")}${selectField("Modelo associado", "modelId", [["", "Sem vínculo"], ...state.models.map((x) => [x.id, x.name])], s?.modelId || "")}</div><div class="modal-footer">${button("Cancelar", "close-modal")}<button type="submit" class="button primary">Salvar</button></div></form>`,
  );
}
function strategyLinks(id) {
  const s = state.strategies.find((x) => x.id === id);
  if (!s) return;
  openModal(
    "Componentes de " + escapeHTML(s.name),
    `<form data-research-form="links" data-id="${id}"><div class="form-fields"><fieldset class="link-options"><legend>Modelos</legend>${state.models.map((m) => `<label><input type="checkbox" name="model" value="${m.id}" ${(s.modelIds || []).includes(m.id) ? "checked" : ""}>${escapeHTML(m.name)}</label>`).join("") || "<p>Nenhum modelo cadastrado.</p>"}</fieldset><fieldset class="link-options"><legend>Scripts</legend>${
      scriptList()
        .map(
          (x) =>
            `<label><input type="checkbox" name="script" value="${x.id}" ${x.strategyId === id ? "checked" : ""}>${escapeHTML(x.name)}${x.strategyId && x.strategyId !== id ? " (vinculado a outra estratégia)" : ""}</label>`,
        )
        .join("") || "<p>Crie arquivos na seção Scripts para associá-los.</p>"
    }</fieldset></div><div class="modal-footer">${button("Cancelar", "close-modal")}<button type="submit" class="button primary">Salvar vínculos</button></div></form>`,
  );
}
function linkedComponents(s) {
  const models = state.models.filter((m) => (s.modelIds || []).includes(m.id));
  const files = scriptList().filter((x) => x.strategyId === s.id);
  return `<div class="linked-components"><h3>Componentes associados</h3><button type="button" class="text-button" data-strategy-tests="${s.id}">Ver testes desta estratégia ↗</button><div class="detail-actions">${models.map((m) => scriptButton("⬡ " + escapeHTML(m.name), "open-model", m.id)).join("")}${files.map((x) => scriptButton("⌘ " + escapeHTML(x.name), "open-script", x.id)).join("")}${scriptButton("Gerenciar vínculos", "links", s.id)}</div><p class="panel-note">${models.length} modelos · ${files.length} scripts</p></div>`;
}
function positions() {
  return (
    heading(
      "Posições",
      button("+ Adicionar posição", "add-holding", "primary"),
    ) + panel("Posições da carteira", holdingsTable(true))
  );
}
function performance() {
  return (
    heading("Desempenho") + panel("Evolução da carteira", chart(), periods())
  );
}
function allocationPage() {
  return heading("Alocação") + panel("Distribuição por posição", allocation());
}
function income() {
  return (
    heading("Rendimentos") +
    panel(
      "Dividendos e rendimentos",
      '<div class="empty-state"><span>◴</span><h3>Nenhum rendimento registrado</h3><p>O histórico de rendimentos será conectado aos dados da carteira em uma próxima etapa.</p></div>',
    )
  );
}
document.addEventListener("click", (event) => {
  const el = event.target.closest("[data-script]");
  if (!el) return;
  const id = el.dataset.id;
  switch (el.dataset.script) {
    case "new":
      scriptProperties();
      break;
    case "properties":
      scriptProperties(id);
      break;
    case "select":
      selectedScript = id;
      render();
      break;
    case "save":
      save();
      toast("Script salvo. Nenhum código foi executado.");
      break;
    case "duplicate": {
      const s = scriptList().find((x) => x.id === id);
      const copy = { ...s, id: uid(), name: s.name + " (cópia)" };
      state.scripts.push(copy);
      selectedScript = copy.id;
      save();
      render();
      break;
    }
    case "delete":
      openModal(
        "Excluir script?",
        `<p>O arquivo será removido do workspace e seus vínculos serão desfeitos.</p><div class="modal-footer">${button("Cancelar", "close-modal")}${scriptButton("Excluir arquivo", "confirm-delete", id, "danger")}</div>`,
      );
      break;
    case "confirm-delete":
      state.scripts = scriptList().filter((x) => x.id !== id);
      selectedScript = null;
      save();
      closeModal();
      render();
      break;
    case "links":
      strategyLinks(id);
      break;
    case "open-model":
      selectedModel = id;
      go("models");
      break;
    case "open-script":
      selectedScript = id;
      go("scripts");
      break;
  }
});
document.addEventListener("submit", (event) => {
  const f = event.target;
  if (!f.dataset.researchForm) return;
  event.preventDefault();
  const data = new FormData(f),
    id = f.dataset.id;
  if (f.dataset.researchForm === "script") {
    const name = String(data.get("name")).trim();
    if (!name) {
      f.elements.name.setCustomValidity("Informe um nome.");
      f.elements.name.reportValidity();
      return;
    }
    const old = scriptList().find((x) => x.id === id);
    const s = {
      ...old,
      id: id || uid(),
      name,
      language: data.get("language"),
      kind: data.get("kind"),
      strategyId: data.get("strategyId"),
      modelId: data.get("modelId"),
      content: old?.content || "",
    };
    if (old) state.scripts = state.scripts.map((x) => (x.id === id ? s : x));
    else state.scripts.push(s);
    selectedScript = s.id;
  } else {
    const s = state.strategies.find((x) => x.id === id);
    s.modelIds = data.getAll("model");
    const chosen = data.getAll("script");
    scriptList().forEach((x) => {
      if (chosen.includes(x.id)) x.strategyId = id;
      else if (x.strategyId === id) x.strategyId = "";
    });
  }
  save();
  closeModal();
  render();
});
document.addEventListener("input", (event) => {
  if (event.target.form?.dataset.researchForm)
    event.target.setCustomValidity("");
  if (event.target.id !== "script-source") return;
  const s = scriptList().find((x) => x.id === selectedScript);
  if (!s) return;
  s.content = event.target.value;
  s.updated = new Date().toISOString();
  save();
  $("#script-lines").textContent = s.content.split("\n").length + " linhas";
});
document.addEventListener("keydown", (event) => {
  if (event.target.id !== "script-source") return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    save();
    toast("Script salvo.");
  }
  if (event.key === "Tab") {
    event.preventDefault();
    const el = event.target;
    el.setRangeText("    ", el.selectionStart, el.selectionEnd, "end");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
});

let testStrategyFilter = "";
function visibleBacktests() {
  const strategy = state.strategies.find((s) => s.id === testStrategyFilter);
  return strategy
    ? state.backtests.filter(
        (b) =>
          b.strategyId === strategy.id ||
          (!b.strategyId && b.strategy === strategy.name),
      )
    : state.backtests;
}
function testFilterControl() {
  return `<div class="test-filter"><label>Estratégia<select id="test-strategy-filter"><option value="">Todas as estratégias</option>${state.strategies.map((s) => `<option value="${s.id}" ${s.id === testStrategyFilter ? "selected" : ""}>${escapeHTML(s.name)}</option>`).join("")}</select></label></div>`;
}
function modelLinks(m) {
  const linked = scriptList().filter((s) => s.modelId === m.id);
  return `<div class="linked-components"><h3>Scripts associados</h3><div class="detail-actions">${linked.map((s) => scriptButton(escapeHTML(s.name), "open-script", s.id)).join("") || '<span class="subtle">Nenhum script associado</span>'}</div></div>`;
}
document.addEventListener("change", (event) => {
  if (event.target.id === "test-strategy-filter") {
    testStrategyFilter = event.target.value;
    render();
  }
});
document.addEventListener("click", (event) => {
  const el = event.target.closest("[data-strategy-tests]");
  if (el) {
    testStrategyFilter = el.dataset.strategyTests;
    go("backtests");
  }
});
