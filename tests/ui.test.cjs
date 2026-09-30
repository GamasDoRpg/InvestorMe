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
  await page.locator(`nav a[href="#${id}"]`).click();
  await page.waitForFunction((id) => location.hash === "#" + id, id);
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
  await page.waitForFunction(() => location.hash === "#risk");
  assert.equal(
    await page.locator("#breadcrumb").textContent(),
    "Gestão de risco",
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
  await page.waitForFunction(() => location.hash === "#backtests");
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
