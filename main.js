import { app, BrowserWindow, ipcMain, shell } from "electron";
import { dialog } from "electron";
import http from "http";
import os from "os";
import JSZip from "jszip";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "electron-updater";

import { createOAuthCallbackServer, isPortAvailable } from "./oauth-handler.js";
const { autoUpdater } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

ipcMain.handle("open-external", (event, url) => {
  return shell.openExternal(url);
});

// Handler para abrir un archivo HTML local en el navegador por defecto (sin cloudflared)
ipcMain.handle("open-html-in-browser", async (_event, htmlPath) => {
  try {
    // Asegura que la ruta sea absoluta y tenga el prefijo file://
    const fileUrl = `file://${path.resolve(htmlPath)}`;
    await shell.openExternal(fileUrl);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Servidor estático Node.js para servir el HTML del experimento

function serveStaticDir(dirPath, port = 8080) {
  const server = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url || "/");
    if (reqPath === "/") reqPath = "/index.html";
    const filePath = path.join(dirPath, reqPath);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
      } else {
        const ext = path.extname(filePath);
        const contentType =
          ext === ".html"
            ? "text/html"
            : ext === ".js"
            ? "application/javascript"
            : ext === ".css"
            ? "text/css"
            : ext === ".json"
            ? "application/json"
            : ext === ".png"
            ? "image/png"
            : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : ext === ".gif"
            ? "image/gif"
            : "application/octet-stream";
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
      }
    });
  });
  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      resolve({ server, port, url: `http://localhost:${port}/` });
    });
    server.on("error", reject);
  });
}

// Handler para exponer un HTML local con cloudflared usando Node.js y binario local
ipcMain.handle("share-html-with-cloudflared", async (_event, htmlPath) => {
  const dirToServe = path.dirname(htmlPath);
  const fileName = path.basename(htmlPath);
  const port = 8080;

  // Inicia el servidor estático Node.js
  let serverInfo;
  try {
    serverInfo = await serveStaticDir(dirToServe, port);
  } catch (err) {
    return { error: `No se pudo iniciar el servidor: ${err.message}` };
  }

  // Lógica para encontrar el binario correcto de cloudflared
  function getCloudflaredPath() {
    const baseDir = path.join(__dirname, "cloudflared");
    if (os.platform() === "darwin") {
      if (os.arch() === "arm64") {
        return path.join(baseDir, "cloudflared-darwin-arm64");
      } else {
        return path.join(baseDir, "cloudflared-darwin-amd64");
      }
    } else if (os.platform() === "win32") {
      return path.join(baseDir, "cloudflared-windows-amd64.exe");
    } else if (os.platform() === "linux") {
      return path.join(baseDir, "cloudflared-linux-amd64");
    } else {
      throw new Error("Unsupported OS for cloudflared");
    }
  }

  const cloudflaredPath = getCloudflaredPath();
  const spawn = require("child_process").spawn;
  const urlRegex = /https?:\/\/(.*?)\.trycloudflare\.com/;
  let tunnelUrl = null;

  return await new Promise((resolve, reject) => {
    const cloudflared = spawn(cloudflaredPath, [
      "tunnel",
      "--url",
      `http://localhost:${port}`,
      "--no-autoupdate",
    ]);

    function handleTunnelOutput(data) {
      const output = data.toString();
      const match = output.match(urlRegex);
      if (match && !tunnelUrl) {
        tunnelUrl = `${match[0]}`;
        resolve({ url: `${tunnelUrl}/${fileName}` });
      }
    }

    cloudflared.stdout.on("data", handleTunnelOutput);
    cloudflared.stderr.on("data", handleTunnelOutput);
    cloudflared.on("error", (err) => reject(err));
    // Opcional: timeout para evitar espera infinita
    setTimeout(() => {
      if (!tunnelUrl) {
        cloudflared.kill();
        reject(new Error("Timeout esperando la URL de cloudflared"));
      }
    }, 15000);
  });
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
  win.loadFile(path.join(process.resourcesPath, "client/dist/index.html"));
}

app.whenReady().then(() => {
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
// Handler to save ZIP of CSVs
ipcMain.handle("save-csv-zip", async (_event, { files, defaultName }) => {
  try {
    // Select destination folder
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
