import { app, BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";

// Variable para guardar la URL recibida por el esquema personalizado
let deepLinkUrl = null;

function createWindow() {
  const win = new BrowserWindow({ width: 1200, height: 800 });
  win.loadFile("JsPsych/client/index.html"); // Cambia la ruta si usas build/dist

  // Envía la URL recibida al renderizador si existe
  if (deepLinkUrl) {
    win.webContents.once("did-finish-load", () => {
      win.webContents.send("deep-link-url", deepLinkUrl);
    });
  }
}

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();
});

// Manejo de esquema personalizado en macOS
app.on("open-url", (event, url) => {
  event.preventDefault();
  deepLinkUrl = url;
  // Si la ventana ya está creada, puedes enviar el URL al renderizador aquí
});

// Manejo en Windows/Linux: revisar argumentos al iniciar
if (!app.isDefaultProtocolClient("expbuilder")) {
  app.setAsDefaultProtocolClient("expbuilder");
}

if (process.platform === "win32" || process.platform === "linux") {
  // El argumento con el esquema personalizado estará en process.argv
  const deeplinkArg = process.argv.find((arg) =>
    arg.startsWith("expbuilder://")
  );
  if (deeplinkArg) {
    deepLinkUrl = deeplinkArg;
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
