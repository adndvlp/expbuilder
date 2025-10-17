import { app, BrowserWindow } from "electron";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import pkg from "electron-updater";
const { autoUpdater } = pkg;

// Definir __dirname en ES module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Si este proceso es el backend, no lanzar ventana ni backend de nuevo
if (process.env.IS_ELECTRON_BACKEND === "1") {
  // Solo backend, no ventana
} else {
  let serverProcess;

  function startBackend() {
    const serverPath = path.join(process.resourcesPath, "server", "api.js");
    serverProcess = spawn(process.execPath, [serverPath], {
      cwd: path.join(process.resourcesPath, "server"),
      stdio: "inherit",
      shell: false,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        IS_ELECTRON_BACKEND: "1",
      },
    });
    app.on("before-quit", () => serverProcess.kill());
  }

  function createWindow() {
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
    });
    win.loadFile(path.join(process.resourcesPath, "client/dist/index.html"));
  }

  app.whenReady().then(() => {
    startBackend();
    createWindow();
    autoUpdater.checkForUpdatesAndNotify();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
