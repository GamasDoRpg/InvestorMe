"use strict";
// IDs are independent of visible titles and of the selected strategy/model.
const layoutWidgetIds = {
  scripts: ["files", "editor"],
  positions: ["holdings"],
  performance: ["performance"],
  income: ["income"],
  allocation: ["allocation"],
  overview: [
    "total",
    "profit",
    "strategies-count",
    "cash",
    "performance",
    "strategy-shortcut",
    "holdings",
    "workspace",
  ],
  portfolio: [
    "total",
    "invested",
    "profit",
    "cash",
    "allocation",
    "performance",
    "holdings",
  ],
  markets: ["assets"],
  strategies: ["library", "strategy-details"],
  models: ["count", "configured", "training", "registry", "model-details"],
  backtests: ["history"],
  risk: [
    "largest-position",
    "position-limit",
    "drawdown-limit",
    "allocation",
    "drawdown",
    "limits",
    "stress",
  ],
  alerts: ["active", "unread", "delivery", "rules"],
  settings: ["profile", "appearance", "notifications", "data"],
};
let layoutEditingPage = null;
let layoutCatalog = [];
let layoutDragId = null;
const layoutWidths = [3, 4, 6, 8, 12];
function layoutConfig() {
  return state.layouts?.[page] || { widgets: {}, order: [] };
}
function writeLayout(config) {
  state.layouts ||= {};
  state.layouts[page] = config;
  save();
}
function layoutButton(label, action, id = "", extra = "") {
  return `<button type="button" class="button" data-layout="${action}" data-widget="${id}" ${extra}>${label}</button>`;
}
function updateWidget(id, patch) {
  const config = layoutConfig();
  config.widgets ||= {};
  config.widgets[id] = { ...config.widgets[id], ...patch };
  writeLayout(config);
}
function applyPageLayout() {
  const main = $("#main");
  const editing = layoutEditingPage === page;
  const config = layoutConfig();
  const nodes = $$(".stat, .panel, .strategy-library", main);
  layoutCatalog = nodes.map((node, index) => {
    const id = layoutWidgetIds[page][index];
    const titleNode = $(".panel-heading h2, .stat-label, .section-label", node);
    // Clone to omit icon/count from the default label.
    const label = titleNode?.cloneNode(true);
    label?.querySelectorAll("span").forEach((n) => n.remove());
    const title = label?.textContent.trim() || "Painel";
    let width = 12;
    if (node.classList.contains("stat"))
      width = node.parentElement.classList.contains("three") ? 4 : 3;
    else if (node.parentElement.matches(".two-cols")) width = 6;
    else if (node.parentElement.matches(".overview-grid,.lower-grid"))
      width = node === node.parentElement.firstElementChild ? 8 : 4;
    else if (page === "strategies")
      width = node.classList.contains("strategy-library") ? 4 : 8;
    node.dataset.widgetId = id;
    return { id, title, node, titleNode, width };
  });
  $(".heading-actions", main).insertAdjacentHTML(
    "beforeend",
    layoutButton(
      editing ? "✓ Concluir" : "⚙ Personalizar",
      editing ? "done" : "edit",
    ),
  );
  if (!editing && !state.layouts?.[page]) return;
  const grid = document.createElement("div");
  grid.className = "custom-layout-grid";
  if (editing) grid.classList.add("layout-editing");
  if (editing) {
    const bar = document.createElement("div");
    bar.className = "layout-toolbar";
    bar.innerHTML = `<div><strong>Personalizar página</strong><small>Arraste pelo título para mover e pelo canto para redimensionar.</small></div><div>${layoutButton("＋ Painéis", "catalog")}${layoutButton("Restaurar padrão", "reset")}</div>`;
    $(".page-heading", main).after(bar);
  }
  const order = [
    ...(config.order || []),
    ...layoutCatalog.map((w) => w.id),
  ].filter((id, i, list) => list.indexOf(id) === i);
  for (const id of order) {
    const widget = layoutCatalog.find((w) => w.id === id);
    if (!widget) continue;
    const prefs = config.widgets?.[id] || {};
    if (prefs.hidden) continue;
    const { node, titleNode } = widget;
    const width = layoutWidths.includes(prefs.width)
      ? prefs.width
      : widget.width;
    const height = Number.isFinite(prefs.height)
      ? Math.max(180, Math.min(800, prefs.height))
      : 0;
    const name = prefs.title || widget.title;
    if (prefs.title && titleNode) {
      // Preserve metric icon, count, and panel actions.
      const children = [...titleNode.children];
      titleNode.textContent = prefs.title;
      children.forEach((child) => titleNode.appendChild(child));
    }
    const wrapper = document.createElement("section");
    wrapper.className = "layout-widget";
    wrapper.dataset.layoutId = id;
    wrapper.dataset.width = width;
    wrapper.dataset.accent = ["green", "blue", "purple", "gold"].includes(
      prefs.accent,
    )
      ? prefs.accent
      : "default";
    if (height) {
      wrapper.style.height = height + "px";
      wrapper.classList.add("fixed-height");
    }
    if (editing) {
      const tools = document.createElement("div");
      tools.className = "widget-tools";
      tools.innerHTML = `<button type="button" class="widget-grip" draggable="true" data-drag-widget="${id}" aria-label="Arrastar ${escapeHTML(name)}">⠿ <span>${escapeHTML(name)}</span></button><div>${layoutButton("↑", "up", id, `aria-label="Mover ${escapeHTML(name)} para antes"`)}${layoutButton("↓", "down", id, `aria-label="Mover ${escapeHTML(name)} para depois"`)}${layoutButton("⚙", "configure", id, `aria-label="Configurar ${escapeHTML(name)}"`)}${layoutButton("×", "hide", id, `aria-label="Ocultar ${escapeHTML(name)}"`)}</div>`;
      wrapper.appendChild(tools);
    }
    const body = document.createElement("div");
    body.className = "widget-body";
    body.appendChild(node);
    wrapper.appendChild(body);
    if (editing) {
      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "widget-resize";
      handle.dataset.resizeWidget = id;
      handle.setAttribute(
        "aria-label",
        `Redimensionar ${name}; use as configurações para ajustar pelo teclado`,
      );
      handle.textContent = "◢";
      wrapper.appendChild(handle);
    }
    grid.appendChild(wrapper);
  }
  // Original grouping containers are replaced only after all panels have been moved.
  [...main.children]
    .filter((n) => !n.matches(".page-heading,.layout-toolbar"))
    .forEach((n) => n.remove());
  main.appendChild(grid);
  if (!grid.children.length)
    grid.innerHTML = `<div class="layout-empty"><h2>Nenhum painel visível</h2><p>Escolha quais painéis adicionar a esta página.</p>${layoutButton("＋ Adicionar painéis", "catalog")}</div>`;
}
function showLayoutCatalog() {
  const config = layoutConfig();
  openModal(
    "Painéis da página",
    `<div class="layout-catalog">${layoutCatalog
      .map((w) => {
        const p = config.widgets?.[w.id] || {};
        return `<div class="setting-row"><strong>${escapeHTML(p.title || w.title)}</strong><button type="button" class="switch ${p.hidden ? "" : "on"}" data-layout="visibility" data-widget="${w.id}" role="switch" aria-label="Mostrar ${escapeHTML(w.title)}" aria-checked="${!p.hidden}"></button></div>`;
      })
      .join(
        "",
      )}</div><div class="modal-footer">${layoutButton("Concluir", "close")}</div>`,
  );
}
function configureWidget(id) {
  const w = layoutCatalog.find((w) => w.id === id);
  if (!w) return;
  const p = layoutConfig().widgets?.[id] || {};
  openModal(
    "Personalizar painel",
    `<form data-layout-form="${id}"><div class="form-fields"><label>Nome do painel<input name="title" value="${escapeHTML(p.title || w.title)}" maxlength="60" required></label><div class="form-row"><label>Largura<select name="width">${[
      [3, "¼ da página"],
      [4, "⅓ da página"],
      [6, "½ da página"],
      [8, "⅔ da página"],
      [12, "Página inteira"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${v === (p.width || w.width) ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Altura (px; 0 = automática)<input name="height" type="number" min="0" max="800" step="1" value="${p.height || 0}" required></label></div><label>Cor de destaque<select name="accent">${[
      ["default", "Padrão"],
      ["green", "Verde"],
      ["blue", "Azul"],
      ["purple", "Roxo"],
      ["gold", "Dourado"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${(p.accent || "default") === v ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label></div><div class="modal-footer">${layoutButton("Cancelar", "close")}<button type="submit" class="button primary">Salvar painel</button></div></form>`,
  );
}
function moveWidget(id, target) {
  const config = layoutConfig();
  const ids = [
    ...(config.order || []),
    ...layoutCatalog.map((w) => w.id),
  ].filter((v, i, a) => a.indexOf(v) === i);
  const from = ids.indexOf(id);
  if (from < 0) return;
  const to =
    typeof target === "number"
      ? Math.max(0, Math.min(ids.length - 1, from + target))
      : ids.indexOf(target);
  if (to < 0 || to === from) return;
  ids.splice(from, 1);
  ids.splice(to, 0, id);
  config.order = ids;
  writeLayout(config);
  render();
  $(`[data-layout-id="${id}"] .widget-grip`)?.focus();
}
document.addEventListener("click", (event) => {
  const el = event.target.closest("[data-layout]");
  if (!el) return;
  const action = el.dataset.layout,
    id = el.dataset.widget;
  switch (action) {
    case "edit":
      layoutEditingPage = page;
      render();
      break;
    case "done":
      layoutEditingPage = null;
      render();
      break;
    case "catalog":
      showLayoutCatalog();
      break;
    case "close":
      closeModal();
      break;
    case "configure":
      configureWidget(id);
      break;
    case "hide":
      updateWidget(id, { hidden: true });
      render();
      toast("Painel ocultado. Você pode adicioná-lo novamente em Painéis.");
      break;
    case "visibility":
      updateWidget(id, { hidden: !layoutConfig().widgets?.[id]?.hidden });
      render();
      showLayoutCatalog();
      $(`[data-layout="visibility"][data-widget="${id}"]`)?.focus();
      break;
    case "up":
      moveWidget(id, -1);
      break;
    case "down":
      moveWidget(id, 1);
      break;
    case "reset":
      openModal(
        "Restaurar layout desta página?",
        `<p>A ordem, os tamanhos, os nomes e a visibilidade dos painéis voltarão ao padrão. Os dados do workspace serão mantidos.</p><div class="modal-footer">${layoutButton("Cancelar", "close")}${layoutButton("Restaurar layout", "confirm-reset")}</div>`,
      );
      break;
    case "confirm-reset":
      if (state.layouts) delete state.layouts[page];
      save();
      layoutEditingPage = null;
      closeModal();
      render();
      toast("Layout da página restaurado.");
      break;
  }
});
document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!form.dataset.layoutForm) return;
  event.preventDefault();
  const data = new FormData(form),
    title = String(data.get("title")).trim();
  if (!title) {
    form.elements.title.setCustomValidity("Informe um nome.");
    form.elements.title.reportValidity();
    return;
  }
  updateWidget(form.dataset.layoutForm, {
    title,
    width: Number(data.get("width")),
    height: Number(data.get("height")),
    accent: String(data.get("accent")),
  });
  closeModal();
  render();
  toast("Painel atualizado.");
});
document.addEventListener("input", (event) => {
  if (event.target.form?.dataset.layoutForm) event.target.setCustomValidity("");
});
document.addEventListener("dragstart", (event) => {
  const grip = event.target.closest("[data-drag-widget]");
  if (!grip) return;
  layoutDragId = grip.dataset.dragWidget;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", layoutDragId);
});
document.addEventListener("dragover", (event) => {
  if (layoutDragId && event.target.closest("[data-layout-id]")) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }
});
document.addEventListener("drop", (event) => {
  const target = event.target.closest("[data-layout-id]");
  if (!layoutDragId || !target) return;
  event.preventDefault();
  moveWidget(layoutDragId, target.dataset.layoutId);
  layoutDragId = null;
});
document.addEventListener("dragend", () => {
  layoutDragId = null;
});
document.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest("[data-resize-widget]");
  if (!handle || event.button !== 0) return;
  event.preventDefault();
  const wrapper = handle.closest(".layout-widget"),
    grid = wrapper.parentElement;
  const startX = event.clientX,
    startY = event.clientY,
    rect = wrapper.getBoundingClientRect();
  let width = Number(wrapper.dataset.width),
    height = rect.height;
  handle.setPointerCapture(event.pointerId);
  wrapper.classList.add("resizing");
  const move = (e) => {
    const ratio =
      ((rect.width + e.clientX - startX) / (grid.clientWidth + 20)) * 12;
    width = layoutWidths.reduce((a, b) =>
      Math.abs(b - ratio) < Math.abs(a - ratio) ? b : a,
    );
    height = Math.round(
      Math.max(180, Math.min(800, rect.height + e.clientY - startY)),
    );
    wrapper.dataset.width = width;
    wrapper.style.height = height + "px";
    wrapper.classList.add("fixed-height");
  };
  const finish = (e) => {
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", finish);
    handle.removeEventListener("pointercancel", cancel);
    updateWidget(handle.dataset.resizeWidget, { width, height });
    render();
  };
  const cancel = () => {
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", finish);
    handle.removeEventListener("pointercancel", cancel);
    render();
  };
  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", cancel);
});
