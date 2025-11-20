const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  startOAuthFlow: (config) => ipcRenderer.invoke("start-oauth-flow", config),
  saveCsvZip: (files, defaultName) =>
    ipcRenderer.invoke("save-csv-zip", { files, defaultName }),
  saveJsonFile: (content, defaultName) =>
    ipcRenderer.invoke("save-json-file", { content, defaultName }),
});
