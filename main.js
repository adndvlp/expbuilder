import { app, BrowserWindow, ipcMain, shell } from "electron";
import { dialog } from "electron";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import pkg from "electron-updater";
import { createOAuthCallbackServer, isPortAvailable } from "./oauth-handler.js";
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

  // Handler IPC para abrir URLs externas
  ipcMain.handle("open-external", (event, url) => {
    return shell.openExternal(url);
  });

  // Handler IPC para iniciar el flujo OAuth con servidor local
  ipcMain.handle(
    "start-oauth-flow",
    async (event, { provider, clientId, scope, state }) => {
      try {
        // Puerto para el callback local
        const OAUTH_PORT = 8888;

        // Verificar si el puerto está disponible
        const portAvailable = await isPortAvailable(OAUTH_PORT);
        if (!portAvailable) {
          throw new Error(`Port ${OAUTH_PORT} is not available`);
        }

        // Construir la URL de autorización según el proveedor
        let authUrl;
        const redirectUri = `http://localhost:${OAUTH_PORT}/callback`;

        if (provider === "google-drive") {
          authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
            redirectUri
          )}&response_type=code&scope=${encodeURIComponent(
            scope
          )}&access_type=offline&prompt=consent&state=${state}`;
        } else if (provider === "dropbox") {
          authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
            redirectUri
          )}&response_type=code&token_access_type=offline&state=${state}&scope=${encodeURIComponent(
            scope
          )}`;
        } else if (provider === "github") {
          authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
            redirectUri
          )}&scope=${encodeURIComponent(scope)}&state=${state}`;
        } else {
          throw new Error(`Unsupported provider: ${provider}`);
        }

        // Abrir el navegador con la URL de autorización
        await shell.openExternal(authUrl);

        // Esperar el callback en el servidor local
        const result = await createOAuthCallbackServer(OAUTH_PORT);

        return {
          success: true,
          code: result.code,
          state: result.state,
        };
      } catch (error) {
        console.error("OAuth flow error:", error);
        return {
          success: false,
          error: error.message,
        };
      }
    }
  );

  function createWindow() {
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
      },
    });
    win.loadFile(path.join(process.resourcesPath, "client/dist/index.html"));
  }

  app.whenReady().then(() => {
    startBackend();
    createWindow();
    autoUpdater.checkForUpdatesAndNotify();
    autoUpdater.on("update-downloaded", async () => {
      const result = await dialog.showMessageBox({
        type: "info",
        buttons: ["Install now", "Later"],
        defaultId: 0,
        cancelId: 1,
        title: "Update available",
        message:
          "A new version is available. Do you want to install it now? The application will restart.",
      });
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
