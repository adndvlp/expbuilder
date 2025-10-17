import { app, BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";

function createWindow() {
  const win = new BrowserWindow({ width: 1200, height: 800 });
  win.loadFile("JsPsych/client/index.html"); // Cambia la ruta si usas build/dist
}

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
