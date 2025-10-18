const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  startOAuthFlow: (config) => ipcRenderer.invoke("start-oauth-flow", config),
});
