const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { _electron: electron } = require("playwright");
let app, page, userData;
const errors = [];
before(async () => {
  userData = await mkdtemp(path.join(os.tmpdir(), "investorme-test-"));
  const args = [".", "--user-data-dir=" + userData];
  if (process.platform === "linux") args.push("--ozone-platform=headless");
  // Root containers cannot use Chromium's OS sandbox. Production startup never sets this flag.
  if (process.getuid?.() === 0) args.push("--no-sandbox");
  app = await electron.launch({ args });
  page = await app.firstWindow();
  page.on("pageerror", (err) => errors.push(err.message));
  await page.waitForSelector("h1");
});
after(async () => {
  await app?.close();
  if (userData) await rm(userData, { recursive: true, force: true });
});
const click = (action) =>
  page.locator(`[data-action="${action}"]`).first().click();
const fill = (name, value) => page.locator(`[name="${name}"]`).fill(value);
const save = () => page.locator('button[type="submit"]').click();
async function navigate(id) {
  const lab = ["strategies", "models", "scripts", "backtests"];
  const portfolio = [
    "positions",
    "performance",
    "income",
    "allocation",
    "risk",
  ];
  if (lab.includes(id)) {
    await page.locator('#navigation a[href="#lab/strategies"]').click();
    await page.locator(`.section-tabs a[href="#lab/${id}"]`).click();
  } else if (portfolio.includes(id)) {
    await page.locator('#navigation a[href="#portfolio"]').click();
    await page.locator(`.section-tabs a[href="#portfolio/${id}"]`).click();
  } else if (id === "alerts")
    await page.locator('[data-action="notifications"]').click();
  else if (id === "settings")
    await page.locator('[data-action="go-settings"]').click();
  else await page.locator(`#navigation a[href="#${id}"]`).click();
  await page.waitForSelector(`main[data-page="${id}"]`);
}

test("Every page renders without horizontal window overflow at desktop sizes", async () => {
  for (const width of [1480, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const id of [
      "overview",
      "portfolio",
      "markets",
      "strategies",
      "models",
      "backtests",
      "risk",
      "alerts",
      "settings",
    ]) {
      await navigate(id);
      assert.ok(await page.locator("h1").textContent());
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${id} overflows at ${width}`,
      );
    }
  }
  await page.setViewportSize({ width: 1480, height: 960 });
  assert.deepEqual(errors, []);
});
test("Portfolio CRUD validates duplicates, cancels safely and persists after reload", async () => {
  await navigate("portfolio");
  await click("add-holding");
  await page.locator('[name="ticker"]').selectOption("BBDC4");
  await fill("quantity", "12");
  await fill("cost", "10");
  await save();
  assert.match(await page.locator("table").textContent(), /BBDC4/);
  await click("add-holding");
  await save();
  assert.match(await page.locator(".form-error").textContent(), /já está/);
  await click("close-modal");
  const row = page.locator("tr").filter({ hasText: "BBDC4" });
  await row.locator('[data-action="edit-holding"]').click();
  await fill("quantity", "25");
  await click("close-modal");
  assert.match(await row.textContent(), /12/);
  await row.locator('[data-action="edit-holding"]').click();
  await fill("quantity", "25");
  await save();
  await page.reload();
  assert.match(await row.textContent(), /25/);
  await row.locator('[data-action="edit-holding"]').click();
  await click("delete-holding");
  await click("confirm-delete");
  assert.equal(
    await page.locator("tr").filter({ hasText: "BBDC4" }).count(),
    0,
  );
});
test("Search, watchlist and market filters respond", async () => {
  await navigate("markets");
  await page.locator("#market-search").fill("NVIDIA");
  assert.equal(await page.locator("tbody tr").count(), 1);
  assert.match(await page.locator("tbody").textContent(), /NVDA/);
  const star = page.locator('[data-action="star"]');
  const initial = await star.getAttribute("aria-pressed");
  await star.click();
  assert.notEqual(await star.getAttribute("aria-pressed"), initial);
  await page.keyboard.press("Control+k");
  await page.locator("#global-search").fill("Gestão de risco");
  await click("search-page");
  await page.waitForSelector('main[data-page="risk"]');
  assert.equal(
    await page.locator("#breadcrumb").textContent(),
    "Carteira / Gestão de risco",
  );
});
test("Strategy creation, pause, backtest validation and demo history", async () => {
  await navigate("strategies");
  await click("add-strategy");
  await fill("name", "Estratégia de teste");
  await fill("rule", "RSI < 40");
  await save();
  assert.match(
    await page.locator(".strategy-grid").textContent(),
    /Estratégia de teste/,
  );
  await click("toggle-strategy");
  assert.match(
    await page.locator(".strategy-detail-tags").textContent(),
    /Ativa/,
  );
  await click("strategy-backtest");
  await fill("start", "2025-01-01");
  await fill("end", "2024-01-01");
  await save();
  assert.match(await page.locator(".form-error").textContent(), /posterior/);
  await fill("end", "2025-12-31");
  await save();
  await page.waitForSelector("dialog:not([open])", { state: "attached" });
  await page.waitForFunction(() => location.hash === "#lab/backtests");
  assert.match(
    await page.locator("tbody").textContent(),
    /Estratégia de teste/,
  );
  await click("view-backtest");
  assert.match(
    await page.locator("#modal-content").textContent(),
    /Não foram calculados/,
  );
  await click("close-modal");
});
test("Models and alerts can be configured and simulated", async () => {
  await navigate("models");
  await click("add-model");
  await fill("name", "Modelo de teste");
  await save();
  await click("train-model");
  await page.waitForSelector("dialog:not([open])", { state: "attached" });
  assert.doesNotMatch(
    await page.locator(".details").textContent(),
    /Ainda não executada/,
  );
  await navigate("alerts");
  await click("add-alert");
  await fill("value", "50");
  await save();
  assert.ok((await page.locator("tbody tr").count()) > 3);
  await click("read-alerts");
  assert.equal(await page.locator(".nav-count").count(), 0);
  const toggle = page.locator('[data-action="toggle-alert"]').first();
  const before = await toggle.getAttribute("aria-checked");
  await toggle.click();
  assert.notEqual(await toggle.getAttribute("aria-checked"), before);
});
test("Theme, preferences, export and reset confirmation work", async () => {
  await navigate("settings");
  await page.locator('[data-action="theme"][data-id="light"]').click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  await page.locator("#density").selectOption("compact");
  await page.reload();
  assert.equal(
    await page.locator("html").getAttribute("data-density"),
    "compact",
  );
  await click("profile");
  await fill("profile", "<script>alert(1)</script>");
  await save();
  assert.match(await page.locator(".profile-large").textContent(), /<script>/);
  assert.equal(await page.locator(".profile-large script").count(), 0);
  const exportPath = path.join(userData, "export.json");
  await app.evaluate(({ dialog }, exportPath) => {
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath: exportPath,
    });
  }, exportPath);
  await page.locator('main [data-action="export"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector("#toast").textContent === "Workspace exportado.",
  );
  assert.equal(
    JSON.parse(await readFile(exportPath, "utf8")).profile,
    "<script>alert(1)</script>",
  );
  await click("reset");
  await click("close-modal");
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  await click("reset");
  await click("confirm-reset");
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  assert.equal(
    await page.locator("html").getAttribute("data-density"),
    "comfortable",
  );
  assert.deepEqual(errors, []);
});

test("Page layouts support resize, reorder, visibility, customization and persistence", async () => {
  const edit = () => page.locator('[data-layout="edit"]').click();
  await navigate("overview");
  await edit();
  assert.equal(await page.locator(".layout-widget").count(), 8);
  await page
    .locator('[data-layout="configure"][data-widget="performance"]')
    .click();
  await fill("title", "Meu desempenho");
  await page.locator('[name="width"]').selectOption("12");
  await fill("height", "400");
  await page.locator('[name="accent"]').selectOption("blue");
  await save();
  const performance = page.locator('[data-layout-id="performance"]');
  assert.equal(await performance.getAttribute("data-width"), "12");
  assert.equal(await performance.getAttribute("data-accent"), "blue");
  assert.equal(await performance.locator("h2").innerText(), "Meu desempenho");
  await page.locator('[data-layout="up"][data-widget="performance"]').click();
  assert.equal(
    await page.locator(".layout-widget").nth(3).getAttribute("data-layout-id"),
    "performance",
  );
  await page
    .locator('[data-drag-widget="performance"]')
    .dragTo(page.locator('[data-drag-widget="total"]'));
  assert.equal(
    await page.locator(".layout-widget").first().getAttribute("data-layout-id"),
    "performance",
  );
  const handle = performance.locator(".widget-resize");
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x - 350, box.y + 80, { steps: 8 });
  await page.mouse.up();
  assert.notEqual(await performance.getAttribute("data-width"), "12");
  assert.ok((await performance.boundingBox()).height > 400);
  await page.locator('[data-layout="hide"][data-widget="performance"]').click();
  assert.equal(await performance.count(), 0);
  await page.locator('[data-layout="catalog"]').click();
  await page
    .locator('[data-layout="visibility"][data-widget="performance"]')
    .click();
  await page.locator('[data-layout="close"]').click();
  await page.locator('[data-layout="done"]').click();
  await page.reload();
  assert.equal(await performance.locator("h2").innerText(), "Meu desempenho");
  assert.equal(await page.locator(".widget-tools").count(), 0);
  await navigate("portfolio");
  assert.equal(await page.locator(".custom-layout-grid").count(), 0);
  await edit();
  await page.locator('[data-layout="hide"][data-widget="cash"]').click();
  // Normal interactions still work inside rearranged panels.
  await click("edit-holding");
  await fill("quantity", "301");
  await save();
  await navigate("overview");
  assert.equal(await performance.locator("h2").innerText(), "Meu desempenho");
  await edit();
  await page.locator('[data-layout="reset"]').click();
  await page.locator('[data-layout="confirm-reset"]').click();
  assert.equal(await page.locator(".custom-layout-grid").count(), 0);
  await navigate("portfolio");
  assert.equal(await page.locator('[data-layout-id="cash"]').count(), 0);
  assert.match(await page.locator("tbody").textContent(), /301/);
  await navigate("markets");
  await edit();
  await page.locator('[data-layout="hide"]').click();
  assert.equal(await page.locator(".layout-empty").count(), 1);
  await page.locator('[data-layout="catalog"]').last().click();
  await page.locator('[data-layout="visibility"]').click();
  await page.locator('[data-layout="close"]').click();
  assert.equal(await page.locator(".layout-widget").count(), 1);
  assert.deepEqual(errors, []);
});

test("Every page can enter customization with stable widget IDs", async () => {
  for (const id of [
    "overview",
    "portfolio",
    "markets",
    "strategies",
    "models",
    "backtests",
    "risk",
    "alerts",
    "settings",
  ]) {
    await navigate(id);
    if (await page.locator('[data-layout="edit"]').count())
      await page.locator('[data-layout="edit"]').click();
    const ids = await page
      .locator(".layout-widget")
      .evaluateAll((nodes) => nodes.map((n) => n.dataset.layoutId));
    assert.ok(ids.length > 0, id);
    assert.ok(
      ids.every((x) => x && x !== "undefined"),
      id,
    );
    assert.equal(new Set(ids).size, ids.length, id);
    assert.equal(
      await page.locator("main").evaluate((n) => n.scrollWidth > n.clientWidth),
      false,
      id,
    );
    await page.locator('[data-layout="done"]').click();
  }
  assert.deepEqual(errors, []);
});

test("Four main areas, internal sections and legacy links remain accessible", async () => {
  assert.deepEqual(await page.locator("#navigation a").allTextContents(), [
    "◈Visão geral",
    "◴Carteira",
    "▥Mercados",
    "⬡Laboratório",
  ]);
  for (const id of [
    "positions",
    "performance",
    "income",
    "allocation",
    "scripts",
  ]) {
    await navigate(id);
    assert.ok(await page.locator("h1").innerText());
    await page.locator('[data-layout="edit"]').click();
    assert.ok(await page.locator(".layout-widget").count());
    await page.locator('[data-layout="done"]').click();
  }
  await page.evaluate(() => {
    location.hash = "models";
  });
  await page.waitForSelector('main[data-page="models"]');
  assert.match(page.url(), /#lab\/models$/);
  await navigate("alerts");
  await navigate("settings");
  assert.deepEqual(errors, []);
});

test("Script editor saves inert code and strategy/model associations", async () => {
  await navigate("scripts");
  await page.locator('[data-script="new"]').click();
  await fill("name", "modelo.py");
  await save();
  const code =
    'document.body.innerHTML = "EXECUTED";\n<script>alert(1)</script>';
  await page.locator("#script-source").fill(code);
  await page.keyboard.press("Control+s");
  await navigate("models");
  await navigate("scripts");
  assert.equal(await page.locator("#script-source").inputValue(), code);
  await page.reload();
  await page.waitForSelector("#script-source");
  assert.equal(await page.locator("#script-source").inputValue(), code);
  await page.locator('[data-script="properties"]').click();
  await page.locator('[name="strategyId"]').selectOption({ index: 1 });
  await page.locator('[name="modelId"]').selectOption({ index: 1 });
  await save();
  await navigate("strategies");
  await page.locator('[data-action="select-strategy"]').first().click();
  assert.equal(await page.locator('[data-script="open-script"]').count(), 1);
  await page.locator('[data-script="links"]').click();
  await page.locator('[name="model"]').first().check();
  await save();
  await page.locator('[data-script="open-model"]').click();
  await page.waitForSelector('main[data-page="models"]');
  await navigate("strategies");
  await page.locator("[data-strategy-tests]").click();
  await page.waitForSelector('main[data-page="backtests"]');
  assert.notEqual(await page.locator("#test-strategy-filter").inputValue(), "");
  await navigate("strategies");
  await page.locator('[data-script="open-script"]').click();
  await page.waitForSelector('main[data-page="scripts"]');
  assert.equal(await page.locator("#script-source").inputValue(), code);
  await page.locator('[data-script="duplicate"]').click();
  assert.equal(await page.locator(".script-item").count(), 2);
  await page.locator('[data-script="delete"]').click();
  await page.locator('[data-script="confirm-delete"]').click();
  assert.equal(await page.locator(".script-item").count(), 1);
  assert.deepEqual(errors, []);
});
