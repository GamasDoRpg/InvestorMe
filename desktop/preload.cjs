const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  windowAction: (action) => {
    if (["minimize", "maximize", "close"].includes(action))
      ipcRenderer.send("window:action", action);
  },
  exportWorkspace: (data) => ipcRenderer.invoke("workspace:export", data),
  onMaximized: (callback) =>
    ipcRenderer.on("window:maximized", (_event, value) => callback(value)),
});
