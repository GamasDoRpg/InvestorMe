const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  market: {
    info: () =>
      ipcRenderer.invoke("market:request", { method: "info", args: [] }),
    getQuote: (asset) =>
      ipcRenderer.invoke("market:request", {
        method: "getQuote",
        args: [asset],
      }),
    getQuotes: (assets) =>
      ipcRenderer.invoke("market:request", {
        method: "getQuotes",
        args: [assets],
      }),
    getHistory: (asset, options) =>
      ipcRenderer.invoke("market:request", {
        method: "getHistory",
        args: [asset, options],
      }),
    searchAssets: (query) =>
      ipcRenderer.invoke("market:request", {
        method: "searchAssets",
        args: [query],
      }),
  },
  windowAction: (action) => {
    if (["minimize", "maximize", "close"].includes(action))
      ipcRenderer.send("window:action", action);
  },
  exportWorkspace: (data) => ipcRenderer.invoke("workspace:export", data),
  onMaximized: (callback) =>
    ipcRenderer.on("window:maximized", (_event, value) => callback(value)),
});
