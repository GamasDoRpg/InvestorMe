const { app, BrowserWindow, ipcMain, dialog, safeStorage } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");
let window;
function createWindow() {
  window = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    title: "InvestorMe",
    icon: path.join(__dirname, "icon.png"),
    backgroundColor: "#0a101a",
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.setMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.on("maximize", () =>
    window.webContents.send("window:maximized", true),
  );
  window.on("unmaximize", () =>
    window.webContents.send("window:maximized", false),
  );
  window.loadFile(path.join(__dirname, "..", "ui", "index.html"));
}
function trusted(event) {
  const expected = pathToFileURL(
    path.join(__dirname, "..", "ui", "index.html"),
  ).href;
  return (
    window &&
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame &&
    event.senderFrame.url.split("#")[0] === expected
  );
}
ipcMain.on("window:action", (event, action) => {
  if (!trusted(event)) return;
  if (action === "minimize") window.minimize();
  if (action === "maximize")
    window.isMaximized() ? window.unmaximize() : window.maximize();
  if (action === "close") window.close();
});
ipcMain.handle("workspace:export", async (event, data) => {
  if (!trusted(event) || typeof data !== "string" || data.length > 5_000_000)
    throw new Error("Invalid export");
  JSON.parse(data);
  const result = await dialog.showSaveDialog(window, {
    defaultPath: "investorme-workspace.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (result.canceled) return false;
  await fs.writeFile(result.filePath, data, "utf8");
  return true;
});
app.whenReady().then(async () => {
  const { createConnections } = await import("./connections.mjs");
  const connections = await createConnections({
    directory: app.getPath("userData"), encryption: safeStorage, trusted,
    env: { MARKET_DATA_PROVIDER:process.env.MARKET_DATA_PROVIDER,
      TWELVE_DATA_API_KEY:process.env.TWELVE_DATA_API_KEY,
      BRAPI_API_KEY:process.env.BRAPI_API_KEY, MARKET_DATA_DEBUG:process.env.MARKET_DATA_DEBUG },
  });
  ipcMain.handle("market:request", connections.market);
  ipcMain.handle("market:credentials", connections.credentials);
  createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
