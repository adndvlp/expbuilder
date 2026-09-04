const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  getApiBaseUrl: () => ipcRenderer.sendSync("get-api-base-url"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  startOAuthFlow: (config) => ipcRenderer.invoke("start-oauth-flow", config),
  saveCsvZip: (files, defaultName) =>
    ipcRenderer.invoke("save-csv-zip", { files, defaultName }),
  saveZipFile: (buffer, defaultName) =>
    ipcRenderer.invoke("save-zip-file", { buffer, defaultName }),
  saveJsonFile: (content, defaultName) =>
    ipcRenderer.invoke("save-json-file", { content, defaultName }),
  readFirebaseConfig: () => ipcRenderer.invoke("read-firebase-config"),
  writeFirebaseConfig: (config) =>
    ipcRenderer.invoke("write-firebase-config", config),
  deleteFirebaseConfig: () => ipcRenderer.invoke("delete-firebase-config"),
  readOauthConfig: () => ipcRenderer.invoke("read-oauth-config"),
  writeOauthConfig: (config) => ipcRenderer.invoke("write-oauth-config", config),
  deleteOauthConfig: () => ipcRenderer.invoke("delete-oauth-config"),
  startBackendSetup: (args, token) =>
    ipcRenderer.invoke("backend-setup:start", { args, token }),
  writeBackendSetupInput: (id, text) =>
    ipcRenderer.invoke("backend-setup:write", { id, text }),
  killBackendSetup: (id) => ipcRenderer.invoke("backend-setup:kill", { id }),
  onBackendSetupOutput: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("backend-setup:output", listener);
    return () => ipcRenderer.removeListener("backend-setup:output", listener);
  },
  onBackendSetupExit: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("backend-setup:exit", listener);
    return () => ipcRenderer.removeListener("backend-setup:exit", listener);
  },
  writeBackendEnv: (env) => ipcRenderer.invoke("backend-setup:write-env", { env }),
});
