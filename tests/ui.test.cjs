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
  app = await electron.launch({ args, env: { ...process.env, MARKET_DATA_PROVIDER: "disabled", TWELVE_DATA_API_KEY: "", BRAPI_API_KEY: "" } });
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
const save = () => page.locator('#modal button[type="submit"]').click();
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

test("Fresh workspace has no generated financial or laboratory data", async () => {
 const result=await page.evaluate(()=>({prices:window.InvestorMeFinance.assets.map(a=>a.price),defaults:window.InvestorMeFinance.emptyWorkspace()}));
 assert.ok(result.prices.every(p=>p===null));assert.equal(result.defaults.cash,0);
 for(const field of ['holdings','strategies','models','backtests','alerts','watchlist']) assert.deepEqual(result.defaults[field],[]);
 assert.equal(await page.locator('svg[aria-label*="fictícios"]').count(),0);
});

test("Company logos load locally in both themes and degrade to a ticker", async () => {
  await navigate("markets");
  for (const theme of ["light", "dark"]) {
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    await page.waitForFunction(() => {
      const images = [...document.querySelectorAll("main .asset-logo img")];
      return images.length === 9 && images.every(img => img.complete && img.naturalWidth > 0 && img.src.startsWith("file:"));
    });
  }
  assert.equal(await page.evaluate(() => window.InvestorMeFinance.assetLogo({exchange:"NYSE", symbol:"AAPL"})), null);
  const logo = page.locator("main .asset-logo").first();
  const ticker = await logo.locator("span").textContent();
  await logo.locator("img").dispatchEvent("error");
  assert.equal(await logo.locator("img").count(), 0);
  assert.equal(await logo.textContent(), ticker);
  assert.equal(await logo.getAttribute("title"), "Logo indisponível");
  await navigate("overview");
  assert.deepEqual(errors, []);
});

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
  await page.locator('[name="ticker"]').selectOption("BBDC4");
  await fill("quantity", "1");
  await fill("cost", "10");
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
test("Strategy creation, pause and backtest configuration without invented execution", async () => {
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
  await fill("capital", "10000");
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
test("Models and alerts can be configured without simulated training", async () => {
  await navigate("models");
  await click("add-model");
  await fill("name", "Modelo de teste");
  await save();
  assert.equal(await page.locator('[data-action="train-model"]').count(),0);
  assert.match(await page.locator(".details").textContent(), /Não executado/);
  await navigate("alerts");
  await click("add-alert");
  await fill("value", "50");
  await save();
  assert.ok((await page.locator("tbody tr").count()) > 0);
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

async function seedUserRecords() {
  await page.evaluate(() => {
    const key="investorme.workspace.v1";
    const value=JSON.parse(localStorage.getItem(key));
    value.holdings=[{id:"user-position",ticker:"PETR4",quantity:10,cost:20}];
    value.strategies=[{id:"user-strategy",name:"Minha estratégia",type:"Momentum",universe:"Ações brasileiras",status:"paused",rule:"Minha regra",limit:5}];
    value.models=[{id:"user-model",name:"Meu modelo",type:"Random Forest",status:"draft"}];
    localStorage.setItem(key,JSON.stringify(value));
  });
  await page.reload(); await page.waitForSelector("h1");
}

test("Page layouts support resize, reorder, visibility, customization and persistence", async () => {
  await seedUserRecords();
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

test("Financial core rejects invalid form values and preserves the legacy workspace", async () => {
  await navigate("portfolio");
  const before = await page.evaluate(() => localStorage.getItem("investorme.workspace.v1"));
  await click("edit-holding");
  await fill("quantity", "-10");
  // Bypass browser validation to exercise domain validation at the save boundary.
  await page.locator('form[data-form="holding"]').evaluate(f =>
    f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  assert.match(await page.locator(".form-error").textContent(), /Posição inválida/);
  assert.equal(await page.evaluate(() => localStorage.getItem("investorme.workspace.v1")), before);
  await click("close-modal");
  await click("cash");
  await fill("cash", "-1");
  await page.locator('form[data-form="cash"]').evaluate(f =>
    f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  assert.match(await page.locator(".form-error").textContent(), /Caixa inválido/);
  await click("close-modal");
  await page.reload();
  await page.waitForSelector("h1");
  assert.equal(await page.evaluate(() => localStorage.getItem("investorme.workspace.v1")), before);
  const summary = await page.evaluate(() => window.InvestorMeFinance.evaluate(JSON.parse(localStorage.getItem("investorme.workspace.v1"))));
  const persisted = JSON.parse(before);
  assert.equal(summary.positions.length, persisted.holdings.length);
  assert.ok(persisted.scripts[0].content.includes("EXECUTED"));
  assert.ok(persisted.layouts);
  assert.deepEqual(errors, []);
});

test("Invalid saved financial data remains exportable and repairable without reset", async () => {
  const original = await page.evaluate(() => localStorage.getItem("investorme.workspace.v1"));
  try {
    const invalid = JSON.parse(original);
    invalid.holdings[0].quantity = -10;
    await page.evaluate(value => localStorage.setItem("investorme.workspace.v1", value), JSON.stringify(invalid));
    await page.reload();
    await page.waitForSelector('[role="alert"]');
    assert.match(await page.locator("h1").textContent(), /Dados financeiros inválidos/);
    assert.equal(await page.evaluate(() => localStorage.getItem("investorme.workspace.v1")), JSON.stringify(invalid));
    const exportPath = path.join(userData, "invalid-export.json");
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, exportPath);
    await page.locator('main [data-action="export"]').click();
    await page.waitForFunction(() => document.querySelector("#toast").textContent === "Workspace exportado.");
    assert.deepEqual(JSON.parse(await readFile(exportPath, "utf8")), invalid);
    await click("edit-holding");
    await fill("quantity", "300");
    await save();
    assert.equal(await page.locator("h1").textContent(), "Carteira");
    assert.deepEqual(errors, []);
  } finally {
    await page.evaluate(value => localStorage.setItem("investorme.workspace.v1", value), original);
    await page.reload();
    await page.waitForSelector("h1");
  }
});

test("Browser preview loads core modules under the existing CSP", async () => {
  const { spawn } = require("node:child_process");
  const server = spawn(process.execPath, ["desktop/preview.cjs"], {
    env: { ...process.env, PORT: "4179" }, stdio: ["ignore", "pipe", "pipe"],
  });
  const originalUrl = page.url();
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Preview startup timeout")), 10000);
      server.once("error", reject);
      server.once("exit", code => { clearTimeout(timer); reject(new Error(`Preview exited: ${code}`)); });
      server.stdout.once("data", () => { clearTimeout(timer); resolve(); });
    });
    const logoResponse = await fetch("http://127.0.0.1:4179/assets/companies/petrobras.svg");
    assert.equal(logoResponse.headers.get("content-type"), "image/svg+xml");
    const response = await fetch("http://127.0.0.1:4179/core/index.mjs");
    assert.match(response.headers.get("content-type"), /javascript/);
    assert.match(await response.text(), /Portfolio/);
    assert.equal((await fetch("http://127.0.0.1:4179/package.json")).status, 404);
    await app.evaluate(async ({ BrowserWindow }) => {
      await BrowserWindow.getAllWindows()[0].loadURL("http://127.0.0.1:4179/");
    });
    await page.waitForSelector("h1");
    assert.equal(await page.locator("h1").textContent(), "Visão geral");
    assert.doesNotMatch(await page.locator(".stats").textContent(), /41\.655/);
    assert.equal(await page.evaluate(() => window.InvestorMeFinance.assets.every(a => a.price === null)), true);
    await page.evaluate(() => location.hash = "#markets");
    await page.waitForFunction(() => {
      const images = [...document.querySelectorAll("main .asset-logo img")];
      return images.length === 9 && images.every(img => img.complete && img.naturalWidth > 0);
    });
    assert.deepEqual(errors, []);
  } finally {
    await app.evaluate(async ({ BrowserWindow }, url) => {
      await BrowserWindow.getAllWindows()[0].loadURL(url);
    }, originalUrl);
    server.kill();
  }
});

test("Disconnected UI has no prices, fake history or unsafe IPC", async () => {
  await navigate("markets");
  assert.match(await page.locator('.market-status').textContent(), /Sem conexão/);
  assert.equal(await page.evaluate(() => window.InvestorMeFinance.assets.every(a=>a.price===null)),true);
  await page.locator('#market-search').fill('AAPL');
  await click('asset'); await click('market-history');
  assert.equal(await page.locator('#modal-content table').count(),0);
  await click('close-modal');
  const result=await page.evaluate(()=>window.desktop.market.getQuote({url:'https://evil.test'}));
  assert.equal(result.ok,false); assert.equal(result.error.code,'INVALID_REQUEST');
  const security=await app.evaluate(({BrowserWindow})=>{
    const p=BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return {sandbox:p.sandbox,nodeIntegration:p.nodeIntegration,contextIsolation:p.contextIsolation};
  });
  assert.deepEqual(security,{sandbox:true,nodeIntegration:false,contextIsolation:true});
  assert.equal(await page.evaluate(()=>typeof window.process),'undefined');
  assert.deepEqual(errors,[]);
});

test("Account configures both APIs, tests connections and never exposes saved keys", async () => {
 await app.evaluate(() => {
  globalThis.__originalInvestorFetch=globalThis.fetch;
  globalThis.fetch=async (url,options)=>{
   if(options.headers.Authorization?.includes('invalid')) return new Response('{}',{status:401});
   if(url.hostname==='brapi.dev') return new Response(JSON.stringify({results:[{
    symbol:url.searchParams.get('symbols'),requestedSymbol:url.searchParams.get('symbols'),changed:false,
    data:{currency:'BRL',regularMarketPrice:40,regularMarketPreviousClose:32,regularMarketTime:'2026-10-01T15:00:00Z'},
   }]}));
   const symbols=url.searchParams.get('symbol').split(',');
   const row=s=>({symbol:s.split(':')[0],exchange:s.split(':')[1],currency:'USD',close:'100',previous_close:'80',timestamp:1735848000});
   return new Response(JSON.stringify(symbols.length===1 ? row(symbols[0]) : Object.fromEntries(symbols.map(s=>[s,row(s)]))));
  };
 });
 try {
  await navigate('settings');
  await page.locator('[name="brapiKey"]').fill('brapi-test-key');
  await page.locator('[name="twelveKey"]').fill('twelve-test-key');
  await page.locator('#market-connections button[type="submit"]').click();
  await page.waitForFunction(()=>window.InvestorMeFinance.assets.find(a=>a.ticker==='AAPL').price===100 && !window.InvestorMeFinance.status().refreshing);
  assert.equal(await page.locator('[name="brapiKey"]').inputValue(),'');
  assert.equal(await page.locator('[name="twelveKey"]').inputValue(),'');
  assert.equal(await page.evaluate(()=>JSON.stringify(localStorage).includes('test-key')),false);
  const keyFile=await readFile(path.join(userData,'market-connections.json'),'utf8');assert.equal(keyFile.includes('test-key'),false);
  await page.locator('[data-action="test-connection"][data-id="brapi"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-provider-status="brapi"]').textContent.includes('Conectado'));
  await page.locator('[data-action="test-connection"][data-id="twelve"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-provider-status="twelve"]').textContent.includes('Conectado'));
  await page.reload(); await page.waitForSelector('#market-connections');
  assert.match(await page.locator('[name="twelveKey"]').getAttribute('placeholder'),/configurada/);
  assert.equal(await page.locator('[name="twelveKey"]').inputValue(),'');
  await page.locator('[name="twelveKey"]').fill('invalid-key');
  await page.locator('#market-connections button[type="submit"]').click();
  await page.waitForFunction(()=>window.InvestorMeFinance.status().problems.some(p=>p.includes('AUTH_ERROR')) && !window.InvestorMeFinance.status().refreshing);
  assert.equal(await page.evaluate(()=>window.InvestorMeFinance.assets.find(a=>a.ticker==='AAPL').price),null);
  await page.locator('[data-action="test-connection"][data-id="twelve"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-provider-status="twelve"]').textContent.includes('inválida'));
  await page.locator('[data-action="remove-key"][data-id="twelve"]').click();
  await page.waitForFunction(()=>!window.InvestorMeFinance.connectionStatus().hasTwelveKey && !window.InvestorMeFinance.status().refreshing);
  await click('disconnect-market');
  await page.waitForFunction(()=>window.InvestorMeFinance.status().provider==='disabled');
  assert.equal(await page.evaluate(()=>window.InvestorMeFinance.assets.every(a=>a.price===null)),true);
  assert.deepEqual(errors,[]);
 } finally {
  await page.evaluate(()=>window.desktop.connections.save({mode:'disabled',brapiKey:'',twelveKey:''}));
  await app.evaluate(()=>{globalThis.fetch=globalThis.__originalInvestorFetch;delete globalThis.__originalInvestorFetch;});
  await page.reload();await page.waitForSelector('h1');
 }
});

test("External UI uses normalized IPC quotes and removes unavailable prices on failure", async () => {
  await navigate("portfolio");
  await click("cash");
  await save();
  const { demoMarket } = await import("./fixtures/mock-data.mjs");
  // Only this isolated test process replaces IPC responses; production validates
  // them through createMarketHandler, covered above and in market-data.test.mjs.
  async function install(mode) {
    await app.evaluate(({ ipcMain }, { mode, fixtures }) => {
      ipcMain.removeHandler('market:request');
      ipcMain.handle('market:request', async (_event, { method, args }) => {
        if (method === 'info') return { ok: true, data: {
          provider: mode === 'restore' ? 'disabled' : 'twelve', demo: false,
          label: mode === 'restore' ? 'Sem conexão com provedores' : 'Twelve Data · B3: fim de dia; EUA: conforme plano', notice: null,
        } };
        if (mode === 'fail') return { ok: false, error: { code: 'NO_NETWORK' } };
        if (method !== 'getQuotes') return { ok: false, error: { code: 'INVALID_REQUEST' } };
        return { ok: true, data: args[0].map(asset => mode === 'restore'
          ? fixtures.find(row => row.asset.id === asset.id).quote
          : { asset, currency: asset.currency, price: 100, previousClose: 80, timestamp: '2025-01-02T21:00:00Z' }) };
      });
    }, { mode, fixtures: demoMarket });
  }
  try {
    await install('success');
    await page.addInitScript(() => { const actual = Date.now.bind(Date); Date.now = () => actual() + (window.testTimeOffset || 0); });
    await page.reload();
    await page.waitForFunction(() => window.InvestorMeFinance?.status().provider === 'twelve' && !window.InvestorMeFinance.status().refreshing && window.InvestorMeFinance.assets[0].price === 100);
    await navigate('markets');
    await page.locator('#market-search').fill('AAPL');
    assert.match(await page.locator('tbody').textContent(), /100,00/);
    assert.match(await page.locator('tbody').textContent(), /25,00%/);
    assert.match(await page.locator('tbody').textContent(), /cotação antiga/);
    assert.doesNotMatch(await page.locator('tbody').textContent(), /Demo/);
    await navigate('portfolio');
    assert.match(await page.locator('.market-status').textContent(), /Twelve Data/);
    const totalBefore = await page.evaluate(() => window.InvestorMeFinance.evaluate(JSON.parse(localStorage.getItem('investorme.workspace.v1'))).marketValue);
    assert.ok(totalBefore > 0);
    await install('fail');
    // Expire the renderer cache without waiting a minute.
    await page.evaluate(() => { window.testTimeOffset = 61000; });
    await click('market-refresh');
    await page.waitForFunction(() => window.InvestorMeFinance.status().problems.length > 0);
    assert.match(await page.locator('.market-status').textContent(), /NO_NETWORK/);
    assert.equal(await page.evaluate(() => window.InvestorMeFinance.evaluate(JSON.parse(localStorage.getItem('investorme.workspace.v1'))).marketValue), null);
    assert.deepEqual(errors, []);
  } finally {
    await install('restore');
    await page.reload();
    await page.waitForSelector('h1');
  }
});

test("brapi sandbox UI keeps available Brazilian quotes despite token-only asset failures", async () => {
  const { demoMarket } = await import('./fixtures/mock-data.mjs');
  async function install(restore=false) {
    await app.evaluate(({ipcMain}, {restore, fixtures}) => {
      ipcMain.removeHandler('market:request');
      ipcMain.handle('market:request', async (_event,{method,args}) => {
        if(method==='info') return {ok:true,data:restore
          ? {provider:'disabled',demo:false,label:'Sem conexão com provedores',notice:null}
          : {provider:'brapi',demo:false,quoteBatchSize:1,label:'brapi · ações brasileiras',notice:'B3: atraso aproximado de 30 min. Sem token: PETR4, VALE3, ITUB4 e MGLU3.'}};
        if(method!=='getQuotes') return {ok:false,error:{code:'UNSUPPORTED'}};
        if(!restore && args[0].some(a=>!['PETR4','VALE3','ITUB4','MGLU3'].includes(a.symbol))) return {ok:false,error:{code:'AUTH_ERROR'}};
        return {ok:true,data:args[0].map(a=>restore ? fixtures.find(r=>r.asset.id===a.id).quote
          : {asset:a,currency:a.currency,price:40,previousClose:32,timestamp:'2026-09-01T15:00:00Z'})};
      });
    }, {restore,fixtures:demoMarket});
  }
  try {
    await install(); await page.reload();
    await page.waitForFunction(()=>window.InvestorMeFinance?.status().provider==='brapi' && !window.InvestorMeFinance.status().refreshing && window.InvestorMeFinance.assets.find(a=>a.ticker==='PETR4').price===40);
    await navigate('markets');
    assert.match(await page.locator('.market-status').textContent(),/30 min/);
    const values=await page.evaluate(()=>Object.fromEntries(window.InvestorMeFinance.assets.map(a=>[a.ticker,a.price])));
    assert.equal(values.PETR4,40); assert.equal(values.VALE3,40); assert.equal(values.ITUB4,40);
    assert.equal(values.WEGE3,null); assert.equal(values.AAPL,null);
    assert.match(await page.locator('.market-status').textContent(),/AUTH_ERROR/);
    assert.deepEqual(errors,[]);
  } finally { await install(true); await page.reload(); await page.waitForSelector('h1'); }
});
