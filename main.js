import { app, BrowserWindow, ipcMain, shell } from "electron";
import dotenv from "dotenv";

import { dialog } from "electron";
import JSZip from "jszip";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "electron-updater";
import { createOAuthCallbackServer, isPortAvailable } from "./oauth-handler.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check if running from asar (production) or not (development)
const isProduction = __dirname.includes("app.asar");

// Set NODE_ENV before loading dotenv
if (isProduction) {
  process.env.NODE_ENV = "production";
}

const envFile =
  process.env.NODE_ENV === "production" ? ".env.production" : ".env";
const envPath = path.join(__dirname, envFile);

dotenv.config({ path: envPath });

// Importar el backend dinámicamente después de definir DB_PATH
let backendLoaded = false;
app.whenReady().then(async () => {
  // Usar la ruta definida en el archivo .env
  // En desarrollo: server/database/db.json
  // En producción: database/db.json (en la carpeta de usuario)

  if (isProduction) {
    const userDataPath = app.getPath("userData");
    process.env.DB_ROOT = userDataPath;
  }

  await import("./server/api.js");
  backendLoaded = true;
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

const { autoUpdater } = pkg;

// Importa y ejecuta el servidor Express directamente

ipcMain.handle("open-external", (event, url) => {
  return shell.openExternal(url);
});

ipcMain.handle(
  "start-oauth-flow",
  async (_event, { provider, clientId, scope, state }) => {
    try {
      const OAUTH_PORT = 8888;
      const portAvailable = await isPortAvailable(OAUTH_PORT);
      if (!portAvailable) {
        throw new Error(`Port ${OAUTH_PORT} is not available`);
      }

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

      await shell.openExternal(authUrl);

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

  // En desarrollo, cargar desde Vite; en producción, cargar archivos compilados
  if (isProduction) {
    win.loadFile(path.join(process.resourcesPath, "client/dist/index.html"));
  } else {
    // Modo desarrollo: cargar desde el servidor de Vite
    win.loadURL("http://localhost:5173");
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Handler to save ZIP of CSVs
ipcMain.handle("save-csv-zip", async (_event, { files, defaultName }) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Save sessions ZIP",
      defaultPath: defaultName || "sessions.zip",
      filters: [{ name: "ZIP", extensions: ["zip"] }],
    });
    if (canceled || !filePath) return { success: false, error: "Cancelled" };
    const zip = new JSZip();
    for (const f of files) {
      zip.file(f.name, f.content);
    }
    const zipContent = await zip.generateAsync({ type: "nodebuffer" });
    fs.writeFileSync(filePath, zipContent);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Handler to save db.json in the chosen path
ipcMain.handle("save-json-file", async (_event, { content, defaultName }) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Save database file",
      defaultPath: defaultName || "db.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (canceled || !filePath) return { success: false, error: "Cancelled" };
    fs.writeFileSync(filePath, content, "utf8");
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Firebase config handlers
const getFirebaseConfigPath = () => {
  return path.join(app.getPath("userData"), "firebase-config.json");
};

ipcMain.handle("read-firebase-config", async () => {
  try {
    const configPath = getFirebaseConfigPath();
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, "utf8");
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error("Error reading firebase config:", error);
    return null;
  }
});

ipcMain.handle("write-firebase-config", async (_event, config) => {
  try {
    const configPath = getFirebaseConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
    return { success: true };
  } catch (error) {
    console.error("Error writing firebase config:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("delete-firebase-config", async () => {
  try {
    const configPath = getFirebaseConfigPath();
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    return { success: true };
  } catch (error) {
    console.error("Error deleting firebase config:", error);
    return { success: false, error: error.message };
  }
});
