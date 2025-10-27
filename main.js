import { app, BrowserWindow, ipcMain, shell } from "electron";
import { dialog } from "electron";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import pkg from "electron-updater";
import { createOAuthCallbackServer, isPortAvailable } from "./oauth-handler.js";
const { autoUpdater } = pkg;

// Define __dirname in ES module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// If this process is the backend, do not launch window or backend again
if (process.env.IS_ELECTRON_BACKEND === "1") {
  // Backend only, no window
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

  // IPC handler to open external URLs
  ipcMain.handle("open-external", (event, url) => {
    return shell.openExternal(url);
  });

  // IPC handler to start OAuth flow with local server
  ipcMain.handle(
    "start-oauth-flow",
    async (event, { provider, clientId, scope, state }) => {
      try {
        // Port for local callback
        const OAUTH_PORT = 8888;

        // Check if the port is available
        const portAvailable = await isPortAvailable(OAUTH_PORT);
        if (!portAvailable) {
          throw new Error(`Port ${OAUTH_PORT} is not available`);
        }

        // Build the authorization URL according to the provider
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

        // Open the browser with the authorization URL
        await shell.openExternal(authUrl);

        // Wait for the callback on the local server
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
